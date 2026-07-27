/**
 * GET/POST /api/admin/recommendation-quality
 * Authorization: Bearer <supabase access_token>
 * Yalniz profiles.is_admin = true
 *
 * Donus: empty, sectorGaps, weakJobMatch, thin, pageViews
 */
import {
  cors,
  getBearer,
  requireAdmin,
  sinceIso,
  parseBody,
  parseDays,
} from "./_shared.js";

const FIT_WEAK = 55;

function normKey(s) {
  return String(s || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

/** Boş öneri: events + session_id başına 0 training (snapshot) */
async function buildEmptySection(db, since) {
  const { data: events } = await db
    .from("recommendation_events")
    .select("sektor_raw, hedef_raw, sektor_key, session_id, created_at, final_rec_count, outcome")
    .gte("created_at", since)
    .eq("source", "sohbet")
    .or("outcome.eq.empty_qdrant,final_rec_count.eq.0")
    .order("created_at", { ascending: false })
    .limit(2000);

  const bag = new Map();
  for (const e of events || []) {
    const sektor = (e.sektor_raw || "").trim() || "(boş sektör)";
    const hedef = (e.hedef_raw || "").trim() || "(boş hedef)";
    const key = `${normKey(sektor)}||${normKey(hedef)}`;
    const cur = bag.get(key) || {
      sektor_raw: sektor,
      hedef_raw: hedef,
      sektor_key: e.sektor_key || "genel",
      count: 0,
      last_at: e.created_at,
    };
    cur.count += 1;
    if (e.created_at > cur.last_at) cur.last_at = e.created_at;
    bag.set(key, cur);
  }

  // Tamamlanan snapshot turu ama session_id ile training yok
  const { data: snaps } = await db
    .from("competency_snapshots")
    .select("id, user_id, session_id, created_at")
    .gte("created_at", since)
    .not("session_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(800);

  if (snaps && snaps.length) {
    const sessionIds = [...new Set(snaps.map((s) => s.session_id).filter(Boolean))];
    const chunk = sessionIds.slice(0, 400);
    const { data: trainings } = await db
      .from("recommended_trainings")
      .select("session_id")
      .in("session_id", chunk)
      .eq("source", "sohbet");

    const withRec = new Set((trainings || []).map((t) => t.session_id));
    const eventSessions = new Set((events || []).map((e) => e.session_id).filter(Boolean));
    const emptySessions = snaps.filter(
      (s) => s.session_id && !withRec.has(s.session_id) && !eventSessions.has(s.session_id)
    );

    const emptyIds = emptySessions.map((s) => s.session_id).slice(0, 200);
    if (emptyIds.length) {
      const { data: answers } = await db
        .from("user_answers")
        .select("session_id, question_id, answer_text")
        .in("session_id", emptyIds)
        .in("question_id", ["hedef_sektor", "kariyer_hedefi"]);

      const bySid = new Map();
      for (const a of answers || []) {
        const cur = bySid.get(a.session_id) || { sektor: "(boş sektör)", hedef: "(boş hedef)" };
        if (a.question_id === "hedef_sektor" && a.answer_text) cur.sektor = a.answer_text.trim();
        if (a.question_id === "kariyer_hedefi" && a.answer_text) cur.hedef = a.answer_text.trim();
        bySid.set(a.session_id, cur);
      }

      for (const s of emptySessions) {
        if (!emptyIds.includes(s.session_id)) continue;
        const ans = bySid.get(s.session_id) || { sektor: "(boş sektör)", hedef: "(boş hedef)" };
        const key = `${normKey(ans.sektor)}||${normKey(ans.hedef)}`;
        const cur = bag.get(key) || {
          sektor_raw: ans.sektor,
          hedef_raw: ans.hedef,
          sektor_key: "genel",
          count: 0,
          last_at: s.created_at,
        };
        cur.count += 1;
        if (s.created_at > cur.last_at) cur.last_at = s.created_at;
        bag.set(key, cur);
      }
    }
  }

  const rows = [...bag.values()].sort((a, b) => b.count - a.count).slice(0, 50);
  return {
    totalEmpty: rows.reduce((n, r) => n + r.count, 0),
    distinctPairs: rows.length,
    rows,
  };
}

async function buildSectorGaps(db, since) {
  const { data: answers } = await db
    .from("user_answers")
    .select("answer_text, created_at")
    .eq("question_id", "hedef_sektor")
    .gte("created_at", since)
    .limit(3000);

  const { data: notes } = await db
    .from("sector_notes")
    .select("sector_key")
    .eq("locale", "tr");

  const noteKeys = new Set((notes || []).map((n) => n.sector_key).filter(Boolean));
  // "genel" her zaman var sayilir; spesifik not yoksa gap
  const counts = new Map();

  const aliases = {
    turizm: ["turizm", "otel", "hotel", "hospitality", "konaklama", "resort", "misafir"],
    yazilim: ["yazilim", "software", "developer", "programlama", "bilisim", "teknoloji", "kodlama"],
    insaat: ["insaat", "construction", "santiye", "muteahhit", "yapi"],
    finans: ["finans", "muhasebe", "banka", "finance", "accounting"],
    saglik: ["saglik", "health", "hastane", "hemsire", "medikal", "klinik"],
  };

  function matchKey(text) {
    const t = String(text || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");
    if (!t.trim()) return "genel";
    for (const key of Object.keys(aliases)) {
      if (t.indexOf(key) !== -1) return key;
      for (const a of aliases[key]) {
        if (t.indexOf(a) !== -1) return key;
      }
    }
    return "genel";
  }

  const rawTop = new Map();
  for (const a of answers || []) {
    const raw = (a.answer_text || "").trim();
    if (!raw) continue;
    const key = matchKey(raw);
    counts.set(key, (counts.get(key) || 0) + 1);
    const rk = normKey(raw);
    const cur = rawTop.get(rk) || { raw, matched_key: key, count: 0 };
    cur.count += 1;
    rawTop.set(rk, cur);
  }

  const gaps = [];
  for (const [key, count] of counts.entries()) {
    const hasSpecificNotes = key !== "genel" && noteKeys.has(key);
    const fallsToGeneral = key === "genel" || !hasSpecificNotes;
    if (!fallsToGeneral && hasSpecificNotes) continue;
    // genel'e düşen veya notu olmayan anahtarlar
    if (key === "genel" || !noteKeys.has(key)) {
      gaps.push({
        sektor_key: key,
        ask_count: count,
        has_notes: noteKeys.has(key),
        needs_notes: key === "genel" || !noteKeys.has(key),
        sample_raw: [...rawTop.values()]
          .filter((r) => r.matched_key === key)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((r) => r.raw),
      });
    }
  }

  // genel'e düşen yüksek hacimli ham cevaplar (spesifik not yok)
  const unmatchedRaw = [...rawTop.values()]
    .filter((r) => r.matched_key === "genel")
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  gaps.sort((a, b) => b.ask_count - a.ask_count);

  return {
    totalAnswers: (answers || []).length,
    noteKeys: [...noteKeys],
    gaps: gaps.slice(0, 30),
    unmatchedRaw,
  };
}

async function buildWeakJobMatch(db, since) {
  const { data: matches } = await db
    .from("job_matches")
    .select("id, user_id, job_title, job_url, fit_score, created_at, gaps_json")
    .gte("created_at", since)
    .lt("fit_score", FIT_WEAK)
    .order("fit_score", { ascending: true })
    .limit(100);

  const { data: placeholders } = await db
    .from("recommended_trainings")
    .select("id, is_placeholder, recommended_at, source")
    .eq("source", "job_match")
    .gte("recommended_at", since)
    .limit(2000);

  const totalJm = (placeholders || []).length;
  const phCount = (placeholders || []).filter((t) => t.is_placeholder).length;
  const placeholderRate = totalJm ? Math.round((1000 * phCount) / totalJm) / 10 : 0;

  const { count: allMatchCount } = await db
    .from("job_matches")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  return {
    threshold: FIT_WEAK,
    weakCount: (matches || []).length,
    totalMatches: allMatchCount || 0,
    placeholderRate,
    placeholderCount: phCount,
    jobMatchTrainingCount: totalJm,
    rows: (matches || []).slice(0, 40).map((m) => ({
      id: m.id,
      job_title: m.job_title || "(başlıksız)",
      fit_score: Number(m.fit_score),
      created_at: m.created_at,
      gap_count: Array.isArray(m.gaps_json && m.gaps_json.gaps)
        ? m.gaps_json.gaps.length
        : 0,
    })),
  };
}

async function buildThinSection(db, since) {
  const { data: events } = await db
    .from("recommendation_events")
    .select(
      "sektor_raw, hedef_raw, sektor_key, session_id, created_at, final_rec_count, qdrant_hit_count, top_score, outcome"
    )
    .gte("created_at", since)
    .eq("source", "sohbet")
    .or("outcome.eq.thin,outcome.eq.low_score,final_rec_count.lte.2")
    .gt("final_rec_count", 0)
    .order("created_at", { ascending: false })
    .limit(500);

  // session_id basina training sayisi 1-2 (events yoksa yedek)
  const { data: trainings } = await db
    .from("recommended_trainings")
    .select("session_id, recommended_at")
    .eq("source", "sohbet")
    .gte("recommended_at", since)
    .not("session_id", "is", null)
    .limit(2000);

  const bySession = new Map();
  for (const t of trainings || []) {
    const sid = t.session_id;
    const cur = bySession.get(sid) || { count: 0, last_at: t.recommended_at };
    cur.count += 1;
    if (t.recommended_at > cur.last_at) cur.last_at = t.recommended_at;
    bySession.set(sid, cur);
  }

  const thinFromTrainings = [];
  for (const [sid, info] of bySession.entries()) {
    if (info.count >= 1 && info.count <= 2) {
      thinFromTrainings.push({ session_id: sid, ...info });
    }
  }

  const rows = (events || []).map((e) => ({
    sektor_raw: e.sektor_raw || "",
    hedef_raw: e.hedef_raw || "",
    sektor_key: e.sektor_key || "genel",
    final_rec_count: e.final_rec_count,
    qdrant_hit_count: e.qdrant_hit_count,
    top_score: e.top_score,
    outcome: e.outcome,
    created_at: e.created_at,
    session_id: e.session_id,
  }));

  return {
    eventCount: rows.length,
    thinSessionCount: thinFromTrainings.length,
    rows: rows.slice(0, 50),
  };
}

async function buildPageViews(db, since) {
  try {
    const { data, error } = await db
      .from("product_events")
      .select("page_id, created_at, user_id")
      .eq("event_type", "page_view")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8000);
    if (error) {
      return { available: false, reason: error.message, total: 0, rows: [] };
    }
    const counts = { bugun: 0, yol: 0, pratik: 0, kesfet: 0 };
    const users = new Set();
    for (const e of data || []) {
      const p = e.page_id;
      if (counts[p] != null) counts[p] += 1;
      if (e.user_id) users.add(e.user_id);
    }
    const labels = { bugun: "Bugün", yol: "Yolum", pratik: "Pratikler", kesfet: "Keşif" };
    const rows = Object.keys(counts).map((id) => ({
      page_id: id,
      label: labels[id] || id,
      count: counts[id],
    }));
    const total = rows.reduce((n, r) => n + r.count, 0);
    return {
      available: true,
      total,
      uniqueUsers: users.size,
      rows,
    };
  } catch (e) {
    return { available: false, reason: (e && e.message) || "error", total: 0, rows: [] };
  }
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getBearer(req);
  const gate = await requireAdmin(token);
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, error: gate.error });
  }

  const body = parseBody(req);
  const days = parseDays(body, req.query);
  const since = sinceIso(days);
  const { db, profile } = gate;

  try {
    const [empty, sectorGaps, weakJobMatch, thin, pageViews] = await Promise.all([
      buildEmptySection(db, since),
      buildSectorGaps(db, since),
      buildWeakJobMatch(db, since),
      buildThinSection(db, since),
      buildPageViews(db, since),
    ]);

    return res.status(200).json({
      ok: true,
      days,
      since,
      admin: { email: profile.email, display_name: profile.display_name },
      empty,
      sectorGaps,
      weakJobMatch,
      thin,
      pageViews,
    });
  } catch (e) {
    console.error("[admin/recommendation-quality]", e);
    return res.status(500).json({ ok: false, error: e.message || "admin_error" });
  }
}
