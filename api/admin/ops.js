/**
 * POST /api/admin/ops
 * Authorization: Bearer <supabase access_token>
 * Yalniz profiles.is_admin = true
 *
 * Body: { action: "billing"|"quota"|"users"|"funnel"|"engagement", days?, q? }
 */
import {
  cors,
  getBearer,
  requireAdmin,
  sinceIso,
  parseBody,
  parseDays,
  isMissingRelation,
  FREE_CHAT_LIMIT,
} from "./_shared.js";

function unavailable(reason) {
  return { available: false, reason: reason || "Tablo yok — freemium migration gerekir." };
}

async function buildBilling(db) {
  try {
    const { data: profiles, error: pErr } = await db
      .from("profiles")
      .select("id, email, display_name, plan, plan_expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (pErr) {
      if (isMissingRelation(pErr)) return unavailable(pErr.message);
      return unavailable(pErr.message);
    }

    let free = 0;
    let plus = 0;
    const plusRows = [];
    for (const p of profiles || []) {
      const plan = (p.plan || "free") === "plus" ? "plus" : "free";
      if (plan === "plus") {
        plus += 1;
        plusRows.push(p);
      } else {
        free += 1;
      }
    }

    let statusCounts = {};
    let recentSubs = [];
    const { data: subs, error: sErr } = await db
      .from("subscriptions")
      .select("id, user_id, status, current_period_end, created_at, iyzico_subscription_reference_code")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!sErr && subs) {
      for (const s of subs) {
        const st = s.status || "UNKNOWN";
        statusCounts[st] = (statusCounts[st] || 0) + 1;
      }
      const byUser = new Map((profiles || []).map((p) => [p.id, p]));
      recentSubs = subs.slice(0, 30).map((s) => {
        const p = byUser.get(s.user_id) || {};
        return {
          email: p.email || "—",
          display_name: p.display_name || "",
          status: s.status,
          current_period_end: s.current_period_end,
          created_at: s.created_at,
          plan_expires_at: p.plan_expires_at || null,
        };
      });
    } else if (sErr && !isMissingRelation(sErr)) {
      // subscriptions optional if only plan column exists
      statusCounts = { note: sErr.message };
    }

    return {
      available: true,
      free,
      plus,
      total: free + plus,
      subscriptionStatuses: statusCounts,
      recentPlus: plusRows.slice(0, 25).map((p) => ({
        email: p.email || "—",
        display_name: p.display_name || "",
        plan_expires_at: p.plan_expires_at,
        created_at: p.created_at,
      })),
      recentSubscriptions: recentSubs,
    };
  } catch (e) {
    return unavailable((e && e.message) || "error");
  }
}

async function buildQuota(db, since) {
  try {
    const { data: counters, error: cErr } = await db
      .from("usage_counters")
      .select("user_id, free_chats_used, plus_chats_used, period_start, updated_at")
      .limit(8000);
    if (cErr) {
      if (isMissingRelation(cErr)) return unavailable(cErr.message);
      return unavailable(cErr.message);
    }

    let freeUsedSum = 0;
    let plusUsedSum = 0;
    const exhausted = [];
    for (const c of counters || []) {
      freeUsedSum += Number(c.free_chats_used) || 0;
      plusUsedSum += Number(c.plus_chats_used) || 0;
      if ((Number(c.free_chats_used) || 0) >= FREE_CHAT_LIMIT) {
        exhausted.push(c);
      }
    }

    const ids = exhausted.slice(0, 40).map((c) => c.user_id).filter(Boolean);
    let profileMap = new Map();
    if (ids.length) {
      const { data: profiles } = await db
        .from("profiles")
        .select("id, email, display_name, plan")
        .in("id", ids);
      profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    }

    let completionsInPeriod = 0;
    const countRes = await db
      .from("chat_completions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (!countRes.error && typeof countRes.count === "number") {
      completionsInPeriod = countRes.count;
    } else if (countRes.error && !isMissingRelation(countRes.error)) {
      // keep 0
    }

    return {
      available: true,
      freeChatLimit: FREE_CHAT_LIMIT,
      counterRows: (counters || []).length,
      freeUsedSum,
      plusUsedSum,
      exhaustedFreeCount: exhausted.length,
      completionsInPeriod,
      exhaustedRows: exhausted.slice(0, 25).map((c) => {
        const p = profileMap.get(c.user_id) || {};
        return {
          email: p.email || "—",
          display_name: p.display_name || "",
          plan: p.plan || "free",
          free_chats_used: c.free_chats_used,
          plus_chats_used: c.plus_chats_used,
          period_start: c.period_start,
        };
      }),
    };
  } catch (e) {
    return unavailable((e && e.message) || "error");
  }
}

async function buildUsers(db, q) {
  const query = String(q || "").trim().slice(0, 120);
  if (query.length < 2) {
    return { available: true, needQuery: true, rows: [], total: 0 };
  }
  try {
    const safe = query.replace(/[%_,]/g, "");
    if (safe.length < 2) {
      return { available: true, needQuery: true, rows: [], total: 0 };
    }
    const pattern = `"%${safe}%"`;
    const { data: profiles, error } = await db
      .from("profiles")
      .select("id, email, display_name, plan, plan_expires_at, created_at, mevcut_rol, email_reminders_opt_in")
      .or(`email.ilike.${pattern},display_name.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) {
      // plan kolonu yoksa daha dar select dene
      if (isMissingRelation(error) || /plan/i.test(error.message || "")) {
        const { data: p2, error: e2 } = await db
          .from("profiles")
          .select("id, email, display_name, created_at, mevcut_rol, email_reminders_opt_in")
          .or(`email.ilike.${pattern},display_name.ilike.${pattern}`)
          .order("created_at", { ascending: false })
          .limit(25);
        if (e2) return unavailable(e2.message);
        return {
          available: true,
          needQuery: false,
          total: (p2 || []).length,
          rows: (p2 || []).map((p) => ({
            id: p.id,
            email: p.email || "—",
            display_name: p.display_name || "",
            plan: "—",
            created_at: p.created_at,
            free_chats_used: null,
            last_snapshot_at: null,
            mevcut_rol: p.mevcut_rol || "",
          })),
        };
      }
      return unavailable(error.message);
    }

    const ids = (profiles || []).map((p) => p.id);
    let usageMap = new Map();
    if (ids.length) {
      const { data: usage } = await db
        .from("usage_counters")
        .select("user_id, free_chats_used, plus_chats_used")
        .in("user_id", ids);
      usageMap = new Map((usage || []).map((u) => [u.user_id, u]));
    }

    let snapMap = new Map();
    if (ids.length) {
      const { data: snaps } = await db
        .from("competency_snapshots")
        .select("user_id, created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(200);
      for (const s of snaps || []) {
        if (!snapMap.has(s.user_id)) snapMap.set(s.user_id, s.created_at);
      }
    }

    return {
      available: true,
      needQuery: false,
      total: (profiles || []).length,
      rows: (profiles || []).map((p) => {
        const u = usageMap.get(p.id);
        return {
          id: p.id,
          email: p.email || "—",
          display_name: p.display_name || "",
          plan: p.plan || "free",
          plan_expires_at: p.plan_expires_at || null,
          created_at: p.created_at,
          free_chats_used: u ? u.free_chats_used : null,
          plus_chats_used: u ? u.plus_chats_used : null,
          last_snapshot_at: snapMap.get(p.id) || null,
          mevcut_rol: p.mevcut_rol || "",
          reminders: !!p.email_reminders_opt_in,
        };
      }),
    };
  } catch (e) {
    return unavailable((e && e.message) || "error");
  }
}

async function buildFunnel(db, since) {
  try {
    const out = {
      available: true,
      draftsTotal: 0,
      draftsInProgress: 0,
      draftsCompleted: 0,
      draftsAbandoned: 0,
      snapshots: 0,
      recommendationOutcomes: {},
      steps: [],
    };

    const { data: drafts, error: dErr } = await db
      .from("chat_drafts")
      .select("id, status, phase, step, created_at, updated_at")
      .gte("created_at", since)
      .limit(8000);
    if (dErr) {
      if (isMissingRelation(dErr)) return unavailable(dErr.message);
      // continue with zeros if drafts missing partially
    } else {
      out.draftsTotal = (drafts || []).length;
      for (const d of drafts || []) {
        if (d.status === "in_progress") out.draftsInProgress += 1;
        else if (d.status === "completed") out.draftsCompleted += 1;
        else if (d.status === "abandoned") out.draftsAbandoned += 1;
      }
    }

    const snapRes = await db
      .from("competency_snapshots")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (!snapRes.error && typeof snapRes.count === "number") {
      out.snapshots = snapRes.count;
    }

    const { data: events, error: eErr } = await db
      .from("recommendation_events")
      .select("outcome")
      .eq("source", "sohbet")
      .gte("created_at", since)
      .limit(8000);
    if (!eErr) {
      for (const e of events || []) {
        const o = e.outcome || "ok";
        out.recommendationOutcomes[o] = (out.recommendationOutcomes[o] || 0) + 1;
      }
    }

    out.steps = [
      { id: "draft_started", label: "Draft başladı", count: out.draftsTotal },
      { id: "in_progress", label: "Devam ediyor", count: out.draftsInProgress },
      { id: "completed", label: "Draft tamam", count: out.draftsCompleted },
      { id: "abandoned", label: "Terk", count: out.draftsAbandoned },
      { id: "snapshot", label: "Yetkinlik snapshot", count: out.snapshots },
      {
        id: "rec_ok",
        label: "Öneri OK",
        count: out.recommendationOutcomes.ok || 0,
      },
      {
        id: "rec_empty",
        label: "Öneri boş/zayıf",
        count:
          (out.recommendationOutcomes.empty_qdrant || 0)
          + (out.recommendationOutcomes.thin || 0)
          + (out.recommendationOutcomes.low_score || 0),
      },
    ];

    return out;
  } catch (e) {
    return unavailable((e && e.message) || "error");
  }
}

async function buildEngagement(db, since) {
  try {
    const out = {
      available: true,
      profilesTotal: 0,
      remindersOn: 0,
      remindersRate: 0,
      checkinUsers: 0,
      checkinRows: 0,
      microTotal: 0,
      microDone: 0,
      microDoneRate: 0,
      cvGapCount: 0,
    };

    const { data: profiles, error: pErr } = await db
      .from("profiles")
      .select("id, email_reminders_opt_in")
      .limit(10000);
    if (pErr && isMissingRelation(pErr)) return unavailable(pErr.message);
    if (!pErr) {
      out.profilesTotal = (profiles || []).length;
      out.remindersOn = (profiles || []).filter((p) => p.email_reminders_opt_in).length;
      out.remindersRate = out.profilesTotal
        ? Math.round((1000 * out.remindersOn) / out.profilesTotal) / 10
        : 0;
    }

    const { data: checkins, error: cErr } = await db
      .from("weekly_checkins")
      .select("user_id, week_start")
      .gte("created_at", since)
      .limit(8000);
    if (!cErr) {
      out.checkinRows = (checkins || []).length;
      out.checkinUsers = new Set((checkins || []).map((c) => c.user_id).filter(Boolean)).size;
    }

    const { data: micros, error: mErr } = await db
      .from("micro_tasks")
      .select("id, status")
      .gte("created_at", since)
      .limit(8000);
    if (!mErr) {
      out.microTotal = (micros || []).length;
      out.microDone = (micros || []).filter((m) => m.status === "yapildi").length;
      out.microDoneRate = out.microTotal
        ? Math.round((1000 * out.microDone) / out.microTotal) / 10
        : 0;
    }

    const cvRes = await db
      .from("cv_gap_analyses")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (!cvRes.error && typeof cvRes.count === "number") {
      out.cvGapCount = cvRes.count;
    }

    return out;
  } catch (e) {
    return unavailable((e && e.message) || "error");
  }
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getBearer(req);
  const gate = await requireAdmin(token);
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, error: gate.error });
  }

  const body = parseBody(req);
  const action = String(body.action || req.query?.action || "").toLowerCase();
  const days = parseDays(body, req.query);
  const since = sinceIso(days);
  const q = body.q || req.query?.q || "";
  const { db, profile } = gate;

  try {
    let payload = null;
    if (action === "billing") payload = await buildBilling(db);
    else if (action === "quota") payload = await buildQuota(db, since);
    else if (action === "users") payload = await buildUsers(db, q);
    else if (action === "funnel") payload = await buildFunnel(db, since);
    else if (action === "engagement") payload = await buildEngagement(db, since);
    else {
      return res.status(400).json({
        ok: false,
        error: "Gecersiz action. billing|quota|users|funnel|engagement",
      });
    }

    return res.status(200).json({
      ok: true,
      action,
      days,
      since,
      admin: { email: profile.email, display_name: profile.display_name },
      data: payload,
    });
  } catch (e) {
    console.error("[admin/ops]", e);
    return res.status(500).json({ ok: false, error: e.message || "admin_error" });
  }
}
