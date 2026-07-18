/**
 * GET/POST /api/public-config
 * Tarayıcıya güvenli (anon) Supabase yapılandırmasını döner.
 * Service role ASLA buraya konmaz.
 */

export default async function handler(req, res) {
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const url = process.env.SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || "";

  if (!url || !anonKey) {
    return res.status(503).json({
      error: "Supabase yapilandirmasi eksik.",
      configured: false,
    });
  }

  return res.status(200).json({
    configured: true,
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
  });
}
