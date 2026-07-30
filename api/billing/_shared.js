/**
 * iyzico Subscription API yardimcilari (IYZWSv2)
 * Kart bilgisi asla buraya gelmez — sadece Checkout Form / callback.
 */
import crypto from "crypto";

export const FREE_CHAT_LIMIT = 1;
export const PLUS_CHAT_LIMIT = 5;

export function iyzicoConfig() {
  const apiKey = process.env.IYZICO_API_KEY || "";
  const secretKey = process.env.IYZICO_SECRET_KEY || "";
  const baseUrl = (process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com").replace(/\/$/, "");
  const planRef = process.env.IYZICO_PLUS_PLAN_REF || "";
  const appBase = (process.env.APP_BASE_URL || "https://careerpick.vercel.app").replace(/\/$/, "");
  return { apiKey, secretKey, baseUrl, planRef, appBase };
}

export function iyzicoConfigured() {
  const c = iyzicoConfig();
  return !!(c.apiKey && c.secretKey && c.planRef);
}

/** IYZWSv2 Authorization header */
export function iyzicoAuthHeader(uriPath, bodyString) {
  const { apiKey, secretKey } = iyzicoConfig();
  const randomKey = Date.now().toString() + crypto.randomBytes(4).toString("hex");
  const payload = randomKey + uriPath + (bodyString || "");
  const signature = crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
  const authStr = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return {
    Authorization: "IYZWSv2 " + Buffer.from(authStr).toString("base64"),
    "x-iyzi-rnd": randomKey,
    "Content-Type": "application/json",
  };
}

export async function iyzicoRequest(method, uriPath, bodyObj) {
  const { baseUrl } = iyzicoConfig();
  const bodyString = bodyObj ? JSON.stringify(bodyObj) : "";
  const headers = iyzicoAuthHeader(uriPath, method === "GET" ? "" : bodyString);
  const r = await fetch(baseUrl + uriPath, {
    method,
    headers,
    body: method === "GET" ? undefined : bodyString,
  });
  let data = null;
  try {
    data = await r.json();
  } catch (e) {
    data = { status: "failure", errorMessage: "invalid_json" };
  }
  return { httpStatus: r.status, data };
}

export function monthStartDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function cors(req, res) {
  const origin = req.headers.origin || "";
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

export function getBearer(req) {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : "";
}
