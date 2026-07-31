/**
 * POST /api/contact
 * İletişim formunu canaydinn@gmail.com (veya CONTACT_TO) adresine Resend ile iletir.
 */

const TO = process.env.CONTACT_TO || "canaydinn@gmail.com";

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = readBody(req);
  const name = String(body.name || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().slice(0, 200);
  const subject = String(body.subject || "").trim().slice(0, 200) || "Career Pick iletişim";
  const message = String(body.message || "").trim().slice(0, 5000);

  if (!name || !email || !message) {
    return res.status(400).json({ error: "name, email and message are required" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "invalid email" });
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Career Pick <onboarding@resend.dev>";
  if (!key) {
    return res.status(503).json({ error: "email_not_configured", mailto: TO });
  }

  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
      <p><strong>Career Pick — iletişim formu</strong></p>
      <p><strong>Ad:</strong> ${escapeHtml(name)}<br/>
         <strong>E-posta:</strong> ${escapeHtml(email)}<br/>
         <strong>Konu:</strong> ${escapeHtml(subject)}</p>
      <hr/>
      <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
    </div>
  `;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [TO],
        reply_to: email,
        subject: `[Career Pick] ${subject}`,
        html,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.warn("[contact] resend:", txt.slice(0, 300));
      return res.status(502).json({ error: "send_failed", mailto: TO });
    }
    return res.status(200).json({ ok: true, to: TO });
  } catch (e) {
    console.warn("[contact]", e && e.message);
    return res.status(502).json({ error: "send_failed", mailto: TO });
  }
}
