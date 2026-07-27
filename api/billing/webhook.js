/**
 * POST /api/billing/webhook
 * iyzico abonelik bildirimleri (yenileme / basarisiz tahsilat / iptal).
 * Dogrulama: subscription reference ile iyzico retrieve; sahte payload kabul edilmez.
 */
import { createClient } from "@supabase/supabase-js";
import { cors, iyzicoConfigured, iyzicoRequest } from "./_shared.js";

function admin() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(String(req.body));
  } catch (e) {
    const out = {};
    String(req.body).split("&").forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k) out[decodeURIComponent(k)] = decodeURIComponent((v || "").replace(/\+/g, " "));
    });
    return out;
  }
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!iyzicoConfigured()) {
    return res.status(503).json({ error: "iyzico_yapilandirilmadi" });
  }

  const body = parseBody(req);
  const ref =
    String(
      body.subscriptionReferenceCode
      || body.referenceCode
      || body.iyziReferenceCode
      || ""
    ).trim();

  if (!ref) {
    return res.status(400).json({ error: "reference_missing" });
  }

  // Zorunlu dogrulama: iyzico'dan abonelik durumunu cek
  let remote;
  try {
    const { data } = await iyzicoRequest(
      "GET",
      `/v2/subscription/subscriptions/${encodeURIComponent(ref)}`,
      null
    );
    remote = data;
  } catch (e) {
    console.error("[billing/webhook] retrieve", e);
    return res.status(502).json({ error: "retrieve_failed" });
  }

  if (!remote || remote.status !== "success") {
    console.warn("[billing/webhook] bad retrieve", remote);
    return res.status(400).json({ error: "invalid_subscription" });
  }

  const subData = remote.data || remote;
  const status = String(subData.subscriptionStatus || subData.status || "").toUpperCase();
  const endMs = subData.endDate ? Number(subData.endDate) : null;
  const periodEnd = endMs ? new Date(endMs).toISOString() : null;

  const supabase = admin();
  if (!supabase) return res.status(503).json({ error: "service_role" });

  const { data: local } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("iyzico_subscription_reference_code", ref)
    .maybeSingle();

  if (!local) {
    // Bilinmeyen ref — yine de 200 (iyzico retry spam'i engelle)
    return res.status(200).json({ ok: true, ignored: true });
  }

  const active = status === "ACTIVE" || status === "PENDING";
  const canceled = status === "CANCELED" || status === "CANCELLED" || status === "UNPAID" || status === "EXPIRED";

  await supabase
    .from("subscriptions")
    .update({
      status: active ? "ACTIVE" : (canceled ? "CANCELED" : status || local.status),
      current_period_end: periodEnd || local.current_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq("id", local.id);

  if (active) {
    await supabase
      .from("profiles")
      .update({
        plan: "plus",
        plan_expires_at: periodEnd,
      })
      .eq("id", local.user_id);
  } else if (canceled) {
    await supabase
      .from("profiles")
      .update({
        plan: "free",
        plan_expires_at: periodEnd || new Date().toISOString(),
      })
      .eq("id", local.user_id);
  }

  return res.status(200).json({ ok: true, status });
}
