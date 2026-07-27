/**
 * POST /api/billing/cancel
 * Kullanici Plus aboneligini iptal eder — iyzico cancel API + DB.
 * Authorization: Bearer <supabase jwt>
 */
import { createClient } from "@supabase/supabase-js";
import { cors, getBearer, iyzicoConfigured, iyzicoRequest } from "./_shared.js";

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

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = getBearer(req);
  const user = await userFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const supabase = admin();
  if (!supabase) return res.status(503).json({ error: "Service role eksik" });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) {
    await supabase.from("profiles").update({ plan: "free" }).eq("id", user.id);
    return res.status(200).json({ ok: true, status: "already_free" });
  }

  if (iyzicoConfigured()) {
    try {
      const { data } = await iyzicoRequest(
        "POST",
        `/v2/subscription/subscriptions/${encodeURIComponent(sub.iyzico_subscription_reference_code)}/cancel`,
        {}
      );
      if (data && data.status === "failure") {
        console.warn("[billing/cancel] iyzico:", data);
        // Yine de yerel iptal — kullanici deneyimi icin
      }
    } catch (e) {
      console.warn("[billing/cancel] iyzico call:", e.message || e);
    }
  }

  const periodEnd = sub.current_period_end || new Date().toISOString();

  await supabase
    .from("subscriptions")
    .update({
      status: "CANCELED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  // Donem sonuna kadar plus kalabilir; MVP: hemen free
  await supabase
    .from("profiles")
    .update({
      plan: "free",
      plan_expires_at: periodEnd,
    })
    .eq("id", user.id);

  return res.status(200).json({ ok: true, status: "canceled" });
}
