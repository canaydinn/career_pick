/**
 * POST /api/billing/callback
 * iyzico Checkout Form sonucu — token POST edilir.
 * Imza/dogrulama: token ile sunucu tarafinda retrieve (kart yok).
 * Basariliysa plan=plus; HTML redirect profil.html
 */
import { createClient } from "@supabase/supabase-js";
import { iyzicoConfigured, iyzicoConfig, iyzicoRequest } from "./_shared.js";

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
  const raw = String(req.body);
  try {
    return JSON.parse(raw);
  } catch (e) {
    // application/x-www-form-urlencoded
    const out = {};
    raw.split("&").forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k) out[decodeURIComponent(k)] = decodeURIComponent((v || "").replace(/\+/g, " "));
    });
    return out;
  }
}

function redirect(res, url) {
  res.writeHead(302, { Location: url });
  res.end();
}

export default async function handler(req, res) {
  const { appBase } = iyzicoConfig();
  const failUrl = `${appBase}/fiyatlandirma.html?billing=failed`;
  const okUrl = `${appBase}/profil.html?billing=plus`;

  if (req.method === "GET") {
    // Manuel test / yanlis method
    return redirect(res, `${appBase}/fiyatlandirma.html`);
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!iyzicoConfigured()) {
    return redirect(res, failUrl);
  }

  const body = parseBody(req);
  const token = String(body.token || "").trim();
  if (!token) {
    console.warn("[billing/callback] token yok");
    return redirect(res, failUrl);
  }

  // Zorunlu dogrulama: token ile iyzico retrieve (sahte callback kabul etme)
  let retrieve;
  try {
    retrieve = await iyzicoRequest(
      "GET",
      `/v2/subscription/checkoutform/${encodeURIComponent(token)}`,
      null
    );
  } catch (e) {
    console.error("[billing/callback] retrieve", e);
    return redirect(res, failUrl);
  }

  const data = retrieve.data;
  if (!data || data.status !== "success" || !data.data) {
    console.warn("[billing/callback] retrieve failure", data);
    return redirect(res, failUrl);
  }

  const sub = data.data;
  const status = String(sub.subscriptionStatus || "").toUpperCase();
  if (status !== "ACTIVE" && status !== "PENDING") {
    console.warn("[billing/callback] bad status", status);
    return redirect(res, failUrl);
  }

  const conversationId = String(data.conversationId || "");
  const m = /^cp_([0-9a-f-]{36})_/i.exec(conversationId);
  const userId = m ? m[1] : null;
  if (!userId) {
    console.warn("[billing/callback] conversationId parse fail", conversationId);
    return redirect(res, failUrl);
  }

  const supabase = admin();
  if (!supabase) return redirect(res, failUrl);

  const ref = sub.referenceCode;
  const customerRef = sub.customerReferenceCode || null;
  const endMs = sub.endDate ? Number(sub.endDate) : null;
  const periodEnd = endMs ? new Date(endMs).toISOString() : null;

  try {
    // PENDING ise aktive etmeyi dene
    if (status === "PENDING" && ref) {
      try {
        await iyzicoRequest(
          "POST",
          `/v2/subscription/subscriptions/${encodeURIComponent(ref)}/activate`,
          {}
        );
      } catch (e) {
        console.warn("[billing/callback] activate", e.message || e);
      }
    }

    await supabase.from("profiles").update({
      plan: "plus",
      plan_expires_at: periodEnd,
      iyzico_customer_id: customerRef,
    }).eq("id", userId);

    // subscriptions upsert
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("iyzico_subscription_reference_code", ref)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("subscriptions")
        .update({
          status: "ACTIVE",
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
          user_id: userId,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("subscriptions").insert({
        user_id: userId,
        iyzico_subscription_reference_code: ref,
        status: "ACTIVE",
        current_period_end: periodEnd,
      });
    }

    return redirect(res, okUrl);
  } catch (e) {
    console.error("[billing/callback] db", e);
    return redirect(res, failUrl);
  }
}
