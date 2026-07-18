/**
 * POST /api/reminders
 * Haftalik ogrenme hatirlatmasi (Vercel Cron).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (RLS bypass — sadece sunucu)
 *   RESEND_API_KEY             (opsiyonel; yoksa e-posta atlanir)
 *   RESEND_FROM                (orn. Career Pick <onboarding@resend.dev>)
 *   APP_BASE_URL               (orn. https://careerpick.vercel.app)
 *   CRON_SECRET
 */

import { createClient } from "@supabase/supabase-js";

const DAY_MS = 24 * 60 * 60 * 1000;

function unauthorized(res) {
  return res.status(401).json({ error: "Unauthorized" });
}

function daysAgo(n) {
  return new Date(Date.now() - n * DAY_MS).toISOString();
}

async function sendResend({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Career Pick <onboarding@resend.dev>";
  if (!key) return { ok: false, reason: "no_resend" };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!r.ok) {
    const txt = await r.text();
    return { ok: false, reason: txt.slice(0, 200) };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.authorization || "";
  const cronHeader = req.headers["x-cron-secret"] || "";
  const ok =
    (secret && auth === `Bearer ${secret}`) ||
    (secret && cronHeader === secret) ||
    (secret && req.query?.secret === secret);
  if (!secret || !ok) return unauthorized(res);

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return res.status(503).json({ error: "Supabase service role eksik." });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const base = (process.env.APP_BASE_URL || "https://careerpick.vercel.app").replace(/\/$/, "");
  const staleContinue = daysAgo(7);
  const staleStart = daysAgo(5);

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .eq("email_reminders_opt_in", true)
    .not("email", "is", null);

  if (pErr) {
    return res.status(500).json({ error: pErr.message });
  }

  let emailed = 0;
  let skipped = 0;
  const details = [];

  for (const profile of profiles || []) {
    const { data: trainings, error: tErr } = await supabase
      .from("recommended_trainings")
      .select("id, training_name, status, started_at, recommended_at, last_reminded_at, link, step_id")
      .eq("user_id", profile.id);

    if (tErr || !trainings?.length) {
      skipped++;
      continue;
    }

    // Haftada en fazla 1 ozet: son 6 gunde hatirlatma varsa atla
    const recentlyReminded = trainings.some((t) => {
      if (!t.last_reminded_at) return false;
      return new Date(t.last_reminded_at).getTime() > Date.now() - 6 * DAY_MS;
    });
    if (recentlyReminded) {
      skipped++;
      continue;
    }

    const { data: steps } = await supabase
      .from("roadmap_steps")
      .select("id, step_order, title, status")
      .eq("user_id", profile.id)
      .eq("archived", false)
      .order("step_order", { ascending: true });

    const activeStep = (steps || []).find((s) => s.status === "aktif") || null;
    const stepTotal = (steps || []).length;

    const continueItems = trainings.filter(
      (t) =>
        t.status === "devam_ediyor" &&
        t.started_at &&
        t.started_at <= staleContinue
    );
    const startItems = trainings.filter(
      (t) =>
        t.status === "eksik" &&
        t.recommended_at &&
        t.recommended_at <= staleStart
    );
    const nextUp = trainings.find((t) => t.status !== "tamamlandi");

    if (!continueItems.length && !startItems.length) {
      skipped++;
      continue;
    }

    const name = profile.display_name || "Merhaba";
    const lines = [];
    if (activeStep) {
      lines.push(
        `<p><strong>Yol haritanın ${activeStep.step_order}. adımındasın` +
          (stepTotal ? ` / ${stepTotal}` : "") +
          `:</strong> ${escapeHtml(activeStep.title)}</p>`
      );
      lines.push("<p>Devam etmek ister misin?</p>");
    }
    if (continueItems.length) {
      lines.push("<p><strong>Devam eden eğitimlerin:</strong></p><ul>");
      continueItems.slice(0, 3).forEach((t) => {
        lines.push(`<li>${escapeHtml(t.training_name)}</li>`);
      });
      lines.push("</ul>");
    }
    if (startItems.length) {
      lines.push(`<p><strong>Henüz başlamadığın ${startItems.length} öneri seni bekliyor.</strong></p>`);
    }
    if (nextUp) {
      lines.push(`<p>Sıradaki önerin: <em>${escapeHtml(nextUp.training_name)}</em></p>`);
    }
    lines.push(`<p><a href="${base}/profil.html">Yol haritana git →</a></p>`);

    const subject = activeStep
      ? `Career Pick — yol haritanın ${activeStep.step_order}. adımı`
      : "Career Pick — bu haftaki öğrenme planın";

    const mail = await sendResend({
      to: profile.email,
      subject,
      html: `<div style="font-family:sans-serif;line-height:1.5"><p>${escapeHtml(name)},</p>${lines.join("")}</div>`,
    });

    if (!mail.ok) {
      details.push({ email: profile.email, status: "email_skipped", reason: mail.reason });
      skipped++;
      continue;
    }

    const touchIds = [...continueItems, ...startItems].map((t) => t.id);
    if (touchIds.length) {
      await supabase
        .from("recommended_trainings")
        .update({ last_reminded_at: new Date().toISOString() })
        .in("id", touchIds);
    }

    emailed++;
    details.push({ email: profile.email, status: "sent", count: touchIds.length });
  }

  return res.status(200).json({
    ok: true,
    profiles: (profiles || []).length,
    emailed,
    skipped,
    details: details.slice(0, 20),
  });
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
