/* CareerPick — tarayıcı Supabase istemcisi (CDN @supabase/supabase-js gerekir) */
(function (global) {
  const SESSION_KEY = "cp_sohbet_session_id";
  let client = null;
  let readyPromise = null;
  let configured = false;

  function uuid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getSessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = uuid();
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return uuid();
    }
  }

  function newSessionId() {
    const id = uuid();
    try { sessionStorage.setItem(SESSION_KEY, id); } catch (e) { /* ignore */ }
    return id;
  }

  async function loadConfig() {
    const r = await fetch("/api/public-config", { method: "GET" });
    if (!r.ok) throw new Error("public-config");
    return r.json();
  }

  async function init() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      if (!global.supabase || !global.supabase.createClient) {
        console.warn("[CPAuth] @supabase/supabase-js yuklu degil");
        configured = false;
        return null;
      }
      try {
        const cfg = await loadConfig();
        if (!cfg.configured || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
          configured = false;
          return null;
        }
        // Sabit storageKey: sayfa degisse bile ayni localStorage kaydini kullan
        const storageKey = "cp-supabase-auth";
        try {
          // Eski varsayilan sb-<ref>-auth-token kaydini bir kez tasi
          if (!global.localStorage.getItem(storageKey)) {
            const host = new URL(cfg.supabaseUrl).hostname || "";
            const ref = host.split(".")[0];
            const legacy = ref ? global.localStorage.getItem("sb-" + ref + "-auth-token") : null;
            if (legacy) global.localStorage.setItem(storageKey, legacy);
          }
        } catch (e) { /* ignore */ }

        client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: "pkce",
            storage: global.localStorage,
            storageKey,
          },
        });
        configured = true;
        // Arka planda token yenilemeyi acik tut
        try { client.auth.startAutoRefresh(); } catch (e) { /* ignore */ }
        return client;
      } catch (e) {
        console.warn("[CPAuth] init:", e.message || e);
        configured = false;
        return null;
      }
    })();
    return readyPromise;
  }

  async function getClient() {
    await init();
    return client;
  }

  async function getSession() {
    const c = await getClient();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return data.session || null;
  }

  async function getUser() {
    const session = await getSession();
    return session ? session.user : null;
  }

  async function ensureProfile(user) {
    const c = await getClient();
    if (!c || !user) return null;
    const display =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      (user.email ? user.email.split("@")[0] : "");
    // Opt-in alanini ezme: sadece kimlik alanlarini guncelle
    const { data: existing } = await c
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (existing) {
      const { data, error } = await c
        .from("profiles")
        .update({ email: user.email || existing.email, display_name: existing.display_name || display })
        .eq("id", user.id)
        .select()
        .maybeSingle();
      if (error) {
        console.warn("[CPAuth] ensureProfile update:", error.message);
        return existing;
      }
      return data || existing;
    }
    const { data, error } = await c
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email || null,
        display_name: display,
        email_reminders_opt_in: false,
      })
      .select()
      .maybeSingle();
    if (error) {
      console.warn("[CPAuth] ensureProfile insert:", error.message);
      return null;
    }
    return data;
  }

  async function signInWithGoogle(redirectTo) {
    const c = await getClient();
    if (!c) throw new Error("Supabase yapilandirilmadi");
    const target = redirectTo || (global.location.origin + "/auth-callback.html");
    // prompt:consent kullanma — her seferinde yeniden onay isteyip oturumu bozabiliyor
    const { error } = await c.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: target },
    });
    if (error) throw error;
  }

  async function signOut() {
    const c = await getClient();
    if (!c) return;
    // Yalniz bu tarayici oturumu; global sign-out diger cihazlari da dusurmesin
    await c.auth.signOut({ scope: "local" });
  }

  function onAuthStateChange(cb) {
    let unsub = () => {};
    let cancelled = false;

    init().then(async (c) => {
      if (cancelled) return;
      if (!c) {
        cb(null);
        return;
      }

      // Once localStorage'dan hydrate et; INITIAL_SESSION null yarisiyla
      // yanlis "cikis yapildi" gostermemek icin
      const { data: initial } = await c.auth.getSession();
      if (!cancelled) cb(initial.session ? initial.session.user : null);

      const { data } = c.auth.onAuthStateChange((event, session) => {
        if (cancelled) return;
        // getSession ile zaten isledik
        if (event === "INITIAL_SESSION") return;
        cb(session ? session.user : null);
      });
      unsub = () => {
        try { data.subscription.unsubscribe(); } catch (e) { /* ignore */ }
      };
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }

  async function saveAnswer({ questionId, questionText, answerText, sessionId }) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return { ok: false, reason: "auth" };
    const { error } = await c.from("user_answers").insert({
      user_id: user.id,
      question_id: questionId || null,
      question_text: questionText || null,
      answer_text: answerText || null,
      session_id: sessionId || getSessionId(),
    });
    if (error) {
      console.warn("[CPAuth] saveAnswer:", error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  }

  async function saveRecommendations(trainings) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user || !Array.isArray(trainings) || !trainings.length) {
      return { ok: false, reason: "auth_or_empty" };
    }

    for (const t of trainings) {
      const training_id = String(t.training_id || t.id || t.link || t.ad || "").trim();
      if (!training_id) continue;
      const training_name = t.training_name || t.ad || t.name || "Egitim";
      const status = t.status || "eksik";
      const link = (t.link || t.url || "").trim() || null;
      const recommended_at = new Date().toISOString();

      const { data: existing } = await c
        .from("recommended_trainings")
        .select("id, status, link")
        .eq("user_id", user.id)
        .eq("training_id", training_id)
        .maybeSingle();

      if (existing) {
        const patch = { training_name, recommended_at };
        if (t.status) patch.status = t.status;
        if (link) patch.link = link;
        const { error } = await c
          .from("recommended_trainings")
          .update(patch)
          .eq("id", existing.id)
          .eq("user_id", user.id);
        if (error) console.warn("[CPAuth] saveRecommendations update:", error.message);
      } else {
        const { error } = await c.from("recommended_trainings").insert({
          user_id: user.id,
          training_id,
          training_name,
          status,
          link,
          recommended_at,
        });
        if (error) console.warn("[CPAuth] saveRecommendations insert:", error.message);
      }
    }
    return { ok: true };
  }

  async function saveInsights(insights) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user || !Array.isArray(insights) || !insights.length) {
      return { ok: false, reason: "auth_or_empty" };
    }
    const rows = insights.map((i) => ({
      user_id: user.id,
      insight_text: i.insight_text || i.text || "",
      category: i.category || "genel",
    })).filter((r) => r.insight_text);
    if (!rows.length) return { ok: false, reason: "empty" };
    const { error } = await c.from("user_insights").insert(rows);
    if (error) {
      console.warn("[CPAuth] saveInsights:", error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  }

  async function fetchTrainings() {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return [];
    const { data, error } = await c
      .from("recommended_trainings")
      .select("*")
      .eq("user_id", user.id)
      .order("recommended_at", { ascending: false });
    if (error) {
      console.warn("[CPAuth] fetchTrainings:", error.message);
      return [];
    }
    return data || [];
  }

  async function updateTrainingStatus(id, status) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return { ok: false };
    const now = new Date().toISOString();
    const patch = { status };
    if (status === "devam_ediyor") {
      const { data: row } = await c
        .from("recommended_trainings")
        .select("started_at")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!row || !row.started_at) patch.started_at = now;
      patch.completed_at = null;
    } else if (status === "tamamlandi") {
      const { data: row } = await c
        .from("recommended_trainings")
        .select("started_at")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!row || !row.started_at) patch.started_at = now;
      patch.completed_at = now;
    } else if (status === "eksik") {
      patch.started_at = null;
      patch.completed_at = null;
    }
    const { error } = await c
      .from("recommended_trainings")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      console.warn("[CPAuth] updateTrainingStatus:", error.message);
      return { ok: false };
    }
    return { ok: true };
  }

  async function markTrainingStarted(id) {
    const res = await updateTrainingStatus(id, "devam_ediyor");
    if (res.ok) await syncRoadmapProgress();
    return res;
  }

  async function markTrainingCompleted(id) {
    const res = await updateTrainingStatus(id, "tamamlandi");
    if (res.ok) await syncRoadmapProgress();
    return res;
  }

  async function fetchCareerGoal() {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return "";
    const { data, error } = await c
      .from("user_answers")
      .select("answer_text, created_at")
      .eq("user_id", user.id)
      .eq("question_id", "kariyer_hedefi")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) {
      console.warn("[CPAuth] fetchCareerGoal:", error.message);
      return "";
    }
    return (data && data[0] && data[0].answer_text) || "";
  }

  async function fetchActiveRoadmap() {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return [];
    const { data, error } = await c
      .from("roadmap_steps")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("step_order", { ascending: true });
    if (error) {
      console.warn("[CPAuth] fetchActiveRoadmap:", error.message);
      return [];
    }
    return data || [];
  }

  async function archiveActiveRoadmaps() {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return { ok: false };
    const { error } = await c
      .from("roadmap_steps")
      .update({ archived: true })
      .eq("user_id", user.id)
      .eq("archived", false);
    if (error) {
      console.warn("[CPAuth] archiveActiveRoadmaps:", error.message);
      return { ok: false };
    }
    return { ok: true };
  }

  /**
   * steps: [{ title, description, training_ids: string[] }]
   * Once mevcut roadmap arsivlenir, yeni 3-5 adim yazilir, egitimlere step_id baglanir.
   */
  async function saveRoadmap(steps) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user || !Array.isArray(steps) || !steps.length) {
      return { ok: false, reason: "auth_or_empty" };
    }

    const cleaned = steps.slice(0, 5).map((s, i) => ({
      title: String(s.title || "").trim() || ("Adım " + (i + 1)),
      description: String(s.description || "").trim(),
      training_ids: Array.isArray(s.training_ids) ? s.training_ids.map(String) : [],
    })).filter((s) => s.title);

    if (cleaned.length < 3) {
      return { ok: false, reason: "too_few_steps" };
    }

    await archiveActiveRoadmaps();

    const rows = cleaned.map((s, i) => ({
      user_id: user.id,
      step_order: i + 1,
      title: s.title.slice(0, 160),
      description: s.description.slice(0, 500) || null,
      status: i === 0 ? "aktif" : "bekliyor",
      archived: false,
    }));

    const { data: inserted, error } = await c
      .from("roadmap_steps")
      .insert(rows)
      .select();
    if (error || !inserted) {
      console.warn("[CPAuth] saveRoadmap insert:", error && error.message);
      return { ok: false, reason: error ? error.message : "insert" };
    }

    const byOrder = {};
    inserted.forEach((row) => { byOrder[row.step_order] = row; });

    // Once bu kullanicinin egitimlerinde eski step_id'leri temizleme: yeni eslestirme yap
    for (let i = 0; i < cleaned.length; i++) {
      const step = byOrder[i + 1];
      if (!step) continue;
      const ids = cleaned[i].training_ids.filter(Boolean);
      for (const tid of ids) {
        const { error: uErr } = await c
          .from("recommended_trainings")
          .update({ step_id: step.id })
          .eq("user_id", user.id)
          .eq("training_id", tid);
        if (uErr) console.warn("[CPAuth] saveRoadmap link:", uErr.message);
      }
    }

    await syncRoadmapProgress();
    return { ok: true, steps: inserted };
  }

  /** Adimdaki tum egitimler tamamlandiysa adimi bitti yap, sonrakini aktif et. */
  async function syncRoadmapProgress() {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return { ok: false };

    const steps = await fetchActiveRoadmap();
    if (!steps.length) return { ok: true };

    const { data: trainings } = await c
      .from("recommended_trainings")
      .select("id, step_id, status")
      .eq("user_id", user.id);

    const byStep = {};
    (trainings || []).forEach((t) => {
      if (!t.step_id) return;
      if (!byStep[t.step_id]) byStep[t.step_id] = [];
      byStep[t.step_id].push(t);
    });

    let firstOpen = null;
    for (const step of steps) {
      const linked = byStep[step.id] || [];
      const allDone = linked.length > 0 && linked.every((t) => t.status === "tamamlandi");
      if (allDone) {
        if (step.status !== "bitti") {
          await c.from("roadmap_steps").update({ status: "bitti" })
            .eq("id", step.id).eq("user_id", user.id);
        }
      } else if (firstOpen === null) {
        firstOpen = step;
      }
    }

    for (const step of steps) {
      const linked = byStep[step.id] || [];
      const allDone = linked.length > 0 && linked.every((t) => t.status === "tamamlandi");
      if (allDone) continue;
      const nextStatus = firstOpen && firstOpen.id === step.id ? "aktif" : "bekliyor";
      if (step.status !== nextStatus) {
        await c.from("roadmap_steps").update({ status: nextStatus })
          .eq("id", step.id).eq("user_id", user.id);
      }
    }
    return { ok: true };
  }

  function stepProgressLabel(steps) {
    const list = Array.isArray(steps) ? steps : [];
    if (!list.length) return null;
    const done = list.filter((s) => s.status === "bitti").length;
    const active = list.find((s) => s.status === "aktif");
    return {
      done,
      total: list.length,
      activeOrder: active ? active.step_order : (done >= list.length ? list.length : 1),
      activeTitle: active ? active.title : "",
      label: (active ? active.step_order : Math.min(done + 1, list.length)) + " / " + list.length,
    };
  }

  async function fetchProfile() {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return null;
    const { data } = await c.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return data;
  }

  async function setEmailRemindersOptIn(enabled) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return { ok: false };
    const { data, error } = await c
      .from("profiles")
      .update({ email_reminders_opt_in: !!enabled })
      .eq("id", user.id)
      .select()
      .maybeSingle();
    if (error) {
      console.warn("[CPAuth] setEmailRemindersOptIn:", error.message);
      return { ok: false };
    }
    return { ok: true, profile: data };
  }

  function statusProgress(status) {
    if (status === "tamamlandi") return 100;
    if (status === "devam_ediyor") return 50;
    return 0;
  }

  function overallProgress(trainings) {
    if (!trainings || !trainings.length) return 0;
    const done = trainings.filter((t) => t.status === "tamamlandi").length;
    return Math.round((done / trainings.length) * 100);
  }

  /** Yetkinlik adi: trim + kucuk harf (TR) — eslestirme anahtari */
  function normalizeYetkinlikAdi(name) {
    return String(name || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ");
  }

  /**
   * Sohbet sonu yetkinlik snapshot'i.
   * skills: [{ yetkinlik, puan, seviye, yorum }]
   * Onceki snapshotlar silinmez.
   */
  async function saveCompetencySnapshot(skills, sessionId) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user || !Array.isArray(skills) || !skills.length) {
      return { ok: false, reason: "auth_or_empty" };
    }

    const rows = [];
    const seen = new Set();
    for (const sk of skills) {
      const key = normalizeYetkinlikAdi(sk.yetkinlik || sk.yetkinlik_adi || "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      let puan = Number(sk.puan);
      if (!Number.isFinite(puan)) puan = 3;
      puan = Math.max(1, Math.min(5, Math.round(puan * 10) / 10));
      rows.push({
        yetkinlik_adi: key,
        puan,
        seviye: sk.seviye || null,
        yorum: (sk.yorum || "").trim().slice(0, 400) || null,
      });
    }
    if (!rows.length) return { ok: false, reason: "empty" };

    const { data: snap, error: sErr } = await c
      .from("competency_snapshots")
      .insert({
        user_id: user.id,
        session_id: sessionId || getSessionId() || null,
      })
      .select()
      .maybeSingle();
    if (sErr || !snap) {
      console.warn("[CPAuth] saveCompetencySnapshot:", sErr && sErr.message);
      return { ok: false, reason: sErr ? sErr.message : "insert" };
    }

    const scoreRows = rows.map((r) => ({ ...r, snapshot_id: snap.id }));
    const { error: cErr } = await c.from("competency_scores").insert(scoreRows);
    if (cErr) {
      console.warn("[CPAuth] saveCompetencySnapshot scores:", cErr.message);
      return { ok: false, reason: cErr.message, snapshot: snap };
    }
    return { ok: true, snapshot: snap };
  }

  async function fetchLastSnapshots(limit) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return [];
    const n = Math.max(1, Math.min(10, limit || 2));
    const { data, error } = await c
      .from("competency_snapshots")
      .select("id, session_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(n);
    if (error) {
      console.warn("[CPAuth] fetchLastSnapshots:", error.message);
      return [];
    }
    return data || [];
  }

  async function fetchScoresForSnapshot(snapshotId) {
    const c = await getClient();
    if (!c || !snapshotId) return [];
    const { data, error } = await c
      .from("competency_scores")
      .select("*")
      .eq("snapshot_id", snapshotId);
    if (error) {
      console.warn("[CPAuth] fetchScoresForSnapshot:", error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Son iki snapshot'i karsilastir.
   * Donus: { isFirst, improved, declined, unchanged, unmatched, rows, summaryLine? }
   */
  async function compareLastCompetencySnapshots() {
    const snaps = await fetchLastSnapshots(2);
    if (!snaps.length) {
      return {
        empty: true,
        isFirst: false,
        hasComparison: false,
        improved: 0,
        declined: 0,
        unchanged: 0,
        unmatched: 0,
        rows: [],
      };
    }
    if (snaps.length < 2) {
      return {
        empty: false,
        isFirst: true,
        hasComparison: false,
        improved: 0,
        declined: 0,
        unchanged: 0,
        unmatched: 0,
        rows: [],
        currentSnapshot: snaps[0],
      };
    }

    const currentSnap = snaps[0];
    const previousSnap = snaps[1];
    const [currScores, prevScores] = await Promise.all([
      fetchScoresForSnapshot(currentSnap.id),
      fetchScoresForSnapshot(previousSnap.id),
    ]);

    const prevMap = {};
    prevScores.forEach((s) => {
      prevMap[normalizeYetkinlikAdi(s.yetkinlik_adi)] = s;
    });
    const currMap = {};
    currScores.forEach((s) => {
      currMap[normalizeYetkinlikAdi(s.yetkinlik_adi)] = s;
    });

    const rows = [];
    let improved = 0;
    let declined = 0;
    let unchanged = 0;
    let unmatched = 0;

    Object.keys(currMap).forEach((key) => {
      const curr = currMap[key];
      const prev = prevMap[key];
      const label = curr.yetkinlik_adi;
      if (!prev) {
        unmatched++;
        rows.push({
          yetkinlik: label,
          status: "new",
          previous: null,
          current: Number(curr.puan),
          delta: null,
          seviye: curr.seviye,
        });
        return;
      }
      const prevP = Number(prev.puan);
      const currP = Number(curr.puan);
      const delta = Math.round((currP - prevP) * 10) / 10;
      let status = "unchanged";
      if (delta > 0) {
        status = "improved";
        improved++;
      } else if (delta < 0) {
        status = "declined";
        declined++;
      } else {
        unchanged++;
      }
      rows.push({
        yetkinlik: label,
        status,
        previous: prevP,
        current: currP,
        delta,
        seviye: curr.seviye,
      });
      delete prevMap[key];
    });

    // Onceki oturumda olup simdi olmayanlar
    Object.keys(prevMap).forEach((key) => {
      unmatched++;
      rows.push({
        yetkinlik: prevMap[key].yetkinlik_adi,
        status: "unmatched",
        previous: Number(prevMap[key].puan),
        current: null,
        delta: null,
        seviye: prevMap[key].seviye,
      });
    });

    rows.sort((a, b) => {
      const order = { improved: 0, declined: 1, unchanged: 2, new: 3, unmatched: 4 };
      return (order[a.status] || 9) - (order[b.status] || 9);
    });

    return {
      empty: false,
      isFirst: false,
      hasComparison: true,
      improved,
      declined,
      unchanged,
      unmatched,
      rows,
      currentSnapshot: currentSnap,
      previousSnapshot: previousSnap,
    };
  }

  /** Profil ozeti: son iki snapshot karsilastirmasi */
  async function fetchCompetencyComparisonSummary() {
    return compareLastCompetencySnapshots();
  }

  /** Uygulama ici "Bu hafta yapman gerekenler" listesi (+ aktif adim) */
  function getWeekActions(trainings, roadmapSteps) {
    const list = Array.isArray(trainings) ? trainings : [];
    const steps = Array.isArray(roadmapSteps) ? roadmapSteps : [];
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const actions = [];
    const activeStep = steps.find((s) => s.status === "aktif") || null;
    const stepInfo = stepProgressLabel(steps);

    list.forEach((t) => {
      if (t.status === "devam_ediyor") {
        const started = t.started_at ? new Date(t.started_at).getTime() : 0;
        const stale = !started || now - started >= 7 * day;
        actions.push({
          id: t.id,
          type: "continue",
          training: t,
          priority: stale ? 1 : 2,
        });
      } else if (t.status === "eksik") {
        const rec = t.recommended_at ? new Date(t.recommended_at).getTime() : 0;
        const waiting = !rec || now - rec >= 3 * day;
        if (waiting) {
          actions.push({
            id: t.id,
            type: "start",
            training: t,
            priority: 3,
          });
        }
      }
    });

    // Aktif adıma bağlı eğitimleri öne al
    if (activeStep) {
      actions.sort((a, b) => {
        const aActive = a.training.step_id === activeStep.id ? 0 : 1;
        const bActive = b.training.step_id === activeStep.id ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return a.priority - b.priority;
      });
    } else {
      actions.sort((a, b) => a.priority - b.priority);
    }

    const next = list.find((t) => t.status !== "tamamlandi") || null;
    return {
      actions: actions.slice(0, 5),
      next,
      activeStep,
      stepInfo,
    };
  }

  global.CPAuth = {
    init,
    isConfigured: () => configured,
    getClient,
    getSession,
    getUser,
    ensureProfile,
    signInWithGoogle,
    signOut,
    onAuthStateChange,
    getSessionId,
    newSessionId,
    saveAnswer,
    saveRecommendations,
    saveInsights,
    fetchTrainings,
    updateTrainingStatus,
    markTrainingStarted,
    markTrainingCompleted,
    fetchCareerGoal,
    fetchActiveRoadmap,
    archiveActiveRoadmaps,
    saveRoadmap,
    syncRoadmapProgress,
    stepProgressLabel,
    fetchProfile,
    setEmailRemindersOptIn,
    statusProgress,
    overallProgress,
    getWeekActions,
    normalizeYetkinlikAdi,
    saveCompetencySnapshot,
    fetchLastSnapshots,
    compareLastCompetencySnapshots,
    fetchCompetencyComparisonSummary,
  };
})(typeof window !== "undefined" ? window : globalThis);
