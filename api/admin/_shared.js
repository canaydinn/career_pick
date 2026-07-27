/**
 * Admin API ortak yardımcılar
 * Auth: Bearer JWT + profiles.is_admin
 */
import { createClient } from "@supabase/supabase-js";

export const DAYS_DEFAULT = 90;
export const FREE_CHAT_LIMIT = 1;

export function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

export function getBearer(req) {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : "";
}

export function adminDb() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAdmin(token) {
  const url = process.env.SUPABASE_URL || "";
  const anon = process.env.SUPABASE_ANON_KEY || "";
  if (!url || !anon || !token) return { ok: false, status: 401, error: "Unauthorized" };

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const db = adminDb();
  if (!db) return { ok: false, status: 503, error: "Service role eksik" };

  const { data: profile } = await db
    .from("profiles")
    .select("id, email, is_admin, display_name")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!profile || !profile.is_admin) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, user: authData.user, profile, db };
}

export function sinceIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export function parseBody(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch (e) {
      return {};
    }
  }
  return req.body || {};
}

export function parseDays(body, query) {
  return Math.min(365, Math.max(7, Number(body.days || (query && query.days)) || DAYS_DEFAULT));
}

/** Tablo yok / kolon yok hatalarını yumuşak degrade et */
export function isMissingRelation(err) {
  const msg = String((err && err.message) || err || "").toLowerCase();
  return (
    msg.includes("does not exist")
    || msg.includes("could not find")
    || msg.includes("schema cache")
    || (err && err.code === "42P01")
    || (err && err.code === "PGRST205")
  );
}
