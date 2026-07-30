/**
 * POST /api/billing/checkout
 * iyzico Subscription Checkout Form initialize
 * Body: { name, surname, gsmNumber, identityNumber?, city?, address? }
 * Authorization: Bearer <supabase jwt>
 */
import { createClient } from "@supabase/supabase-js";
import {
  cors,
  getBearer,
  iyzicoConfigured,
  iyzicoConfig,
  iyzicoRequest,
} from "./_shared.js";

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

  if (!iyzicoConfigured()) {
    return res.status(503).json({
      error: "iyzico_yapilandirilmadi",
      message: "IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_PLUS_PLAN_REF gerekli.",
    });
  }

  const token = getBearer(req);
  const user = await userFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const name = String(body.name || "").trim().slice(0, 80);
  const surname = String(body.surname || "").trim().slice(0, 80);
  let gsm = String(body.gsmNumber || body.phone || "").replace(/\s+/g, "");
  if (gsm && !gsm.startsWith("+")) {
    if (gsm.startsWith("0")) gsm = "+9" + gsm;
    else if (gsm.startsWith("5")) gsm = "+90" + gsm;
  }
  const identityNumber = String(body.identityNumber || "11111111111").replace(/\D/g, "").slice(0, 11) || "11111111111";
  const city = String(body.city || "Istanbul").trim().slice(0, 60);
  const address = String(body.address || "Turkiye").trim().slice(0, 200);
  const email = user.email || String(body.email || "").trim();

  if (!name || !surname || !gsm || !email) {
    return res.status(400).json({
      error: "eksik_alan",
      message: "Ad, soyad ve telefon gerekli.",
    });
  }

  const { planRef, appBase } = iyzicoConfig();
  const conversationId = `cp_${user.id}_${Date.now()}`;
  const callbackUrl = `${appBase}/api/billing/callback`;

  const payload = {
    locale: "tr",
    conversationId,
    callbackUrl,
    pricingPlanReferenceCode: planRef,
    subscriptionInitialStatus: "ACTIVE",
    customer: {
      name,
      surname,
      email,
      gsmNumber: gsm,
      identityNumber,
      billingAddress: {
        contactName: `${name} ${surname}`,
        city,
        country: "Turkey",
        address,
      },
      shippingAddress: {
        contactName: `${name} ${surname}`,
        city,
        country: "Turkey",
        address,
      },
    },
  };

  try {
    const { data } = await iyzicoRequest(
      "POST",
      "/v2/subscription/checkoutform/initialize",
      payload
    );

    if (!data || data.status !== "success") {
      console.error("[billing/checkout] iyzico:", data);
      return res.status(502).json({
        error: "iyzico_init_failed",
        message: (data && data.errorMessage) || "Checkout baslatilamadi",
        detail: data || null,
      });
    }

    return res.status(200).json({
      ok: true,
      token: data.token,
      checkoutFormContent: data.checkoutFormContent,
      tokenExpireTime: data.tokenExpireTime,
      conversationId,
    });
  } catch (e) {
    console.error("[billing/checkout]", e);
    return res.status(500).json({ error: e.message || "checkout_error" });
  }
}
