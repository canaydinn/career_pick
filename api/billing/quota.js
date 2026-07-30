/**
 * POST /api/billing/quota
 * { action: "status" | "can_start" | "record", sessionId? }
 * Authorization: Bearer <supabase access_token>
 * Yazmalar service role ile.
 */
import { createClient } from "@supabase/supabase-js";
import {
  cors,
  getBearer,
  FREE_CHAT_LIMIT,
  PLUS_CHAT_LIMIT,
  monthStartDate,
} from "./_shared.js";

function admin() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function userFromToken(token) {
  const url = process.env.SUPABASE_URL || "";
  const anon = process.env.SUPABASE_ANON_KEY || "";
  if (!url || !anon || !token) return null;
  const c = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

async function ensureUsage(supabase, userId) {
  const period = monthStartDate();
  const { data: row } = await supabase
    .from("usage_counters")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    const { data, error } = await supabase
      .from("usage_counters")
      .insert({
        user_id: userId,
        free_chats_used: 0,
        plus_chats_used: 0,
        period_start: period,
      })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  if (row.period_start !== period) {
    const { data, error } = await supabase
      .from("usage_counters")
      .update({
        period_start: period,
        plus_chats_used: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || { ...row, period_start: period, plus_chats_used: 0 };
  }
  return row;
}

async function fetchPlan(supabase, userId) {
  const { data } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at, iyzico_customer_id")
    .eq("id", userId)
    .maybeSingle();
  let plan = (data && data.plan) || "free";
  const expires = data && data.plan_expires_at ? new Date(data.plan_expires_at).getTime() : null;
  if (plan === "plus" && expires && expires < Date.now()) {
    plan = "free";
    await supabase
      .from("profiles")
      .update({ plan: "free" })
      .eq("id", userId);
  }
  return {
    plan,
    plan_expires_at: data ? data.plan_expires_at : null,
    iyzico_customer_id: data ? data.iyzico_customer_id : null,
  };
}

function evaluate(plan, usage) {
  const isPlus = plan === "plus";
  const freeUsed = Number(usage.free_chats_used) || 0;
  const plusUsed = Number(usage.plus_chats_used) || 0;
  const freeLeft = Math.max(0, FREE_CHAT_LIMIT - freeUsed);
  const plusLeft = isPlus ? Math.max(0, PLUS_CHAT_LIMIT - plusUsed) : 0;

  // Once ucretsiz hak, sonra Plus aylik kota
  let allowed = false;
  let reason = "";
  let remaining = 0;
  let nextBucket = "none";

  if (freeLeft > 0) {
    allowed = true;
    reason = "ok";
    remaining = freeLeft + plusLeft;
    nextBucket = "free";
  } else if (isPlus && plusLeft > 0) {
    allowed = true;
    reason = "ok";
    remaining = plusLeft;
    nextBucket = "plus";
  } else if (isPlus) {
    allowed = false;
    reason = "plus_limit";
    remaining = 0;
  } else {
    allowed = false;
    reason = "free_exhausted";
    remaining = 0;
  }

  return {
    plan,
    allowed,
    reason,
    remaining,
    next_bucket: nextBucket,
    free_chats_used: freeUsed,
    plus_chats_used: plusUsed,
    free_limit: FREE_CHAT_LIMIT,
    plus_limit: PLUS_CHAT_LIMIT,
    period_start: usage.period_start,
  };
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getBearer(req);
  const user = await userFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const supabase = admin();
  if (!supabase) {
    return res.status(503).json({ error: "Service role yapilandirmasi eksik" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const action = body.action || (req.method === "GET" ? "status" : "status");
    const sessionId = (body.sessionId || body.session_id || "").trim() || null;

    const planInfo = await fetchPlan(supabase, user.id);
    let usage = await ensureUsage(supabase, user.id);

    if (action === "status" || action === "can_start") {
      const ev = evaluate(planInfo.plan, usage);
      return res.status(200).json({
        ok: true,
        ...ev,
        canStart: ev.allowed,
      });
    }

    if (action === "record") {
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId gerekli" });
      }

      // Ayni session daha once sayildi mi?
      const { data: existing } = await supabase
        .from("chat_completions")
        .select("id, counted")
        .eq("user_id", user.id)
        .eq("session_id", sessionId)
        .maybeSingle();

      if (existing) {
        const ev = evaluate(planInfo.plan, usage);
        return res.status(200).json({
          ok: true,
          skipped: true,
          reason: "same_session",
          ...ev,
        });
      }

      // Kayit oncesi tekrar yetki (sunucu zorunlu)
      const before = evaluate(planInfo.plan, usage);
      if (!before.allowed || before.next_bucket === "none") {
        return res.status(402).json({
          ok: false,
          error: "quota_exceeded",
          ...before,
        });
      }

      const { error: insErr } = await supabase.from("chat_completions").insert({
        user_id: user.id,
        session_id: sessionId,
        counted: true,
      });
      if (insErr) {
        // race unique — treat as skipped
        if (insErr.code === "23505") {
          usage = await ensureUsage(supabase, user.id);
          return res.status(200).json({
            ok: true,
            skipped: true,
            reason: "same_session",
            ...evaluate(planInfo.plan, usage),
          });
        }
        throw new Error(insErr.message);
      }

      const patch = { updated_at: new Date().toISOString() };
      if (before.next_bucket === "free") {
        patch.free_chats_used = (Number(usage.free_chats_used) || 0) + 1;
      } else {
        patch.plus_chats_used = (Number(usage.plus_chats_used) || 0) + 1;
      }

      const { data: updated, error: upErr } = await supabase
        .from("usage_counters")
        .update(patch)
        .eq("user_id", user.id)
        .select()
        .maybeSingle();
      if (upErr) throw new Error(upErr.message);

      usage = updated || { ...usage, ...patch };
      const ev = evaluate(planInfo.plan, usage);
      return res.status(200).json({ ok: true, recorded: true, ...ev });
    }

    return res.status(400).json({ error: "Gecersiz action" });
  } catch (e) {
    console.error("[billing/quota]", e);
    return res.status(500).json({ error: e.message || "quota_error" });
  }
}
