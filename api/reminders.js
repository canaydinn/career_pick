/**
 * POST /api/reminders
 * Haftalik ogrenme + mikro gorev hatirlatmasi (Vercel Cron).
 * Pazartesi: bu hafta icin mikro gorev paketi yoksa sablonla olusturur.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { createClient } from "@supabase/supabase-js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE = ["Pazartesi", "Çarşamba", "Cuma", "Pazar"];

const GENERAL_TASKS = [
  {
    yetkinlik_adi: "genel is becerisi",
    title: "15 dakikalık odak bloğu",
    description: "Telefonsuz 15 dk tek bir işe odaklan. Bitince ne tamamlandığını bir cümle yaz. (15 dk)",
  },
  {
    yetkinlik_adi: "genel is becerisi",
    title: "Haftalık mini hedef",
    description: "Bu hafta için tek, küçük ve yapılabilir bir pratik hedef yaz. (10 dk)",
  },
  {
    yetkinlik_adi: "genel is becerisi",
    title: "Günün kısa özeti",
    description: "Ne iyi gitti / ne zorlandı / yarın ilk adım — 3 satır. (10 dk)",
  },
];

function unauthorized(res) {
  return res.status(401).json({ error: "Unauthorized" });
}

function daysAgo(n) {
  return new Date(Date.now() - n * DAY_MS).toISOString();
}

function weekStartDate() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

async function ensureWeekMicroTasks(supabase, userId, weekStart) {
  const { data: existing } = await supabase
    .from("micro_tasks")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .limit(1);
  if (existing?.length) return { created: false };

  const { data: snaps } = await supabase
    .from("competency_snapshots")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (!snaps?.length) return { created: false };

  const snapId = snaps[0].id;
  const { data: scores } = await supabase
    .from("competency_scores")
    .select("yetkinlik_adi, puan, seviye")
    .eq("snapshot_id", snapId);

  const weak = (scores || []).filter(
    (s) => s.seviye === "gelistirilmeli" || Number(s.puan) < 3
  );
  const yetkinlik =
    weak.length > 0 ? String(weak[0].yetkinlik_adi || "genel is becerisi") : "genel is becerisi";

  const rows = GENERAL_TASKS.slice(0, 3).map((t, i) => ({
    user_id: userId,
    yetkinlik_adi: yetkinlik,
    title: t.title,
    description: t.description,
    week_start: weekStart,
    due_hint: DUE[i % DUE.length],
    status: "bekliyor",
    source: "template",
    competency_snapshot_id: snapId,
  }));

  const { error } = await supabase.from("micro_tasks").insert(rows);
  if (error) {
    console.warn("[reminders] micro_tasks insert:", error.message);
    return { created: false };
  }
  return { created: true };
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
  const weekStart = weekStartDate();

  // Haftalik yenileme: snapshot'i olan kullanicilar icin paket
  const { data: snapRows } = await supabase
    .from("competency_snapshots")
    .select("user_id")
    .order("created_at", { ascending: false })
    .limit(500);
  const userIds = [...new Set((snapRows || []).map((r) => r.user_id).filter(Boolean))];
  let microCreated = 0;
  for (const uid of userIds) {
    const r = await ensureWeekMicroTasks(supabase, uid, weekStart);
    if (r.created) microCreated++;
  }

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
    const { data: trainings } = await supabase
      .from("recommended_trainings")
      .select("id, training_name, status, started_at, recommended_at, last_reminded_at, link, step_id")
      .eq("user_id", profile.id);

    const list = trainings || [];

    const recentlyReminded = list.some((t) => {
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

    const { data: micros } = await supabase
      .from("micro_tasks")
      .select("id, title, status, yetkinlik_adi")
      .eq("user_id", profile.id)
      .eq("week_start", weekStart)
      .eq("status", "bekliyor");

    const pendingMicro = micros || [];

    const continueItems = list.filter(
      (t) =>
        t.status === "devam_ediyor" &&
        t.started_at &&
        t.started_at <= staleContinue
    );
    const startItems = list.filter(
      (t) =>
        t.status === "eksik" &&
        t.recommended_at &&
        t.recommended_at <= staleStart
    );
    const nextUp = list.find((t) => t.status !== "tamamlandi");

    if (!continueItems.length && !startItems.length && !pendingMicro.length) {
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
    if (pendingMicro.length) {
      lines.push("<p><strong>Bu haftanın kısa pratikleri:</strong></p><ul>");
      pendingMicro.slice(0, 4).forEach((t) => {
        lines.push(`<li>${escapeHtml(t.title)}</li>`);
      });
      lines.push("</ul>");
      lines.push("<p>Bunlar yaklaşık gelişim sinyali için nazik hatırlatmalar — kesin ölçüm değil.</p>");
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
    lines.push(`<p><a href="${base}/profil.html">Profiline git →</a></p>`);

    const subject = pendingMicro.length
      ? "Career Pick — bu haftanın pratikleri"
      : activeStep
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
    details.push({
      email: profile.email,
      status: "sent",
      trainings: touchIds.length,
      micro: pendingMicro.length,
    });
  }

  return res.status(200).json({
    ok: true,
    week_start: weekStart,
    micro_packages_created: microCreated,
    profiles: (profiles || []).length,
    emailed,
    skipped,
    details: details.slice(0, 20),
  });
}
