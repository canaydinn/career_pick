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

  function setSessionId(id) {
    const sid = String(id || "").trim();
    if (!sid) return getSessionId();
    try { sessionStorage.setItem(SESSION_KEY, sid); } catch (e) { /* ignore */ }
    return sid;
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
      let training_name = t.training_name || t.ad || t.name || "Egitim";
      if (t.gerekce && String(t.gerekce).trim()) {
        // Gerekce ayri kolon yok; kisa not olarak isimde degil, kayitta source=job_match
        training_name = String(training_name).trim();
      }
      const status = t.status || "eksik";
      const link = (t.link || t.url || "").trim() || null;
      const source = (t.source === "job_match" ? "job_match" : (t.source || "sohbet"));
      const recommended_at = new Date().toISOString();
      const session_id = t.session_id || t.sessionId || null;
      const is_placeholder = !!t.is_placeholder;

      const { data: existing } = await c
        .from("recommended_trainings")
        .select("id, status, link")
        .eq("user_id", user.id)
        .eq("training_id", training_id)
        .maybeSingle();

      if (existing) {
        const patch = { training_name, recommended_at, source, is_placeholder };
        if (t.status) patch.status = t.status;
        if (link) patch.link = link;
        if (session_id) patch.session_id = session_id;
        const { error } = await c
          .from("recommended_trainings")
          .update(patch)
          .eq("id", existing.id)
          .eq("user_id", user.id);
        if (error) console.warn("[CPAuth] saveRecommendations update:", error.message);
      } else {
        const row = {
          user_id: user.id,
          training_id,
          training_name,
          status,
          link,
          source,
          recommended_at,
          is_placeholder,
        };
        if (session_id) row.session_id = session_id;
        const { error } = await c.from("recommended_trainings").insert(row);
        if (error) console.warn("[CPAuth] saveRecommendations insert:", error.message);
      }
    }
    return { ok: true };
  }

  async function buildJobMatchProfile() {
    const snaps = await fetchLastSnapshots(1);
    let scores = [];
    if (snaps[0]) {
      scores = await fetchScoresForSnapshot(snaps[0].id);
      scores = scores.map((s) => ({
        yetkinlik: s.yetkinlik_adi,
        yetkinlik_adi: s.yetkinlik_adi,
        puan: s.puan,
        seviye: s.seviye,
      }));
    }
    const c = await getClient();
    const user = await getUser();
    let answers = [];
    if (c && user) {
      const { data } = await c
        .from("user_answers")
        .select("question_id, answer_text, created_at")
        .eq("user_id", user.id)
        .in("question_id", ["kariyer_hedefi", "mevcut_yetenekler", "deneyim_suresi", "hedef_sektor"])
        .order("created_at", { ascending: false })
        .limit(20);
      answers = data || [];
    }
    return { scores, answers };
  }

  async function analyzeJobMatch({ url, text }) {
    const profile = await buildJobMatchProfile();
    const r = await fetch("/api/job-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url || "",
        text: text || "",
        profile,
      }),
    });
    let data = null;
    try { data = await r.json(); } catch (e) { data = null; }
    if (!data) return { ok: false, error: "Yanit okunamadi" };
    return data;
  }

  async function saveJobMatch(result) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user || !result) return { ok: false };
    const gaps_json = {
      strong: result.strong || [],
      gaps: result.gaps || [],
      items: result.items || [],
      job: result.job || {},
      recommendations: (result.recommendations || []).map((x) => ({
        ad: x.ad,
        gerekce: x.gerekce,
        link: x.link,
      })),
      disclaimer: result.disclaimer || "",
      kariyer_haritasi: result.kariyer_haritasi || null,
    };
    const eslesmeAdi = (result.kariyer_haritasi_eslesme || "").trim() || null;
    const { data, error } = await c
      .from("job_matches")
      .insert({
        user_id: user.id,
        job_url: result.job_url || null,
        job_title: (result.job && result.job.title) || null,
        fit_score: Number(result.fit_score) || 0,
        gaps_json,
        kariyer_haritasi_eslesme: eslesmeAdi,
      })
      .select()
      .maybeSingle();
    if (error) {
      console.warn("[CPAuth] saveJobMatch:", error.message);
      return { ok: false, reason: error.message };
    }

    const recs = result.recommendations || [];
    if (recs.length) {
      await saveRecommendations(recs.map((r) => ({
        training_id: r.link || r.ad,
        training_name: r.ad,
        link: r.link || "",
        status: "eksik",
        source: "job_match",
        gerekce: r.gerekce || "",
        is_placeholder: !!r.is_placeholder,
      })));
    }
    return { ok: true, match: data };
  }

  async function fetchLatestJobMatch() {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return null;
    const { data, error } = await c
      .from("job_matches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[CPAuth] fetchLatestJobMatch:", error.message);
      return null;
    }
    return data;
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
   * kaynak: "roadmap_veri" | "roadmap_genel" (varsayilan: roadmap_genel)
   * Once mevcut roadmap arsivlenir, yeni 3-5 adim yazilir, egitimlere step_id baglanir.
   */
  async function saveRoadmap(steps, kaynak) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user || !Array.isArray(steps) || !steps.length) {
      return { ok: false, reason: "auth_or_empty" };
    }

    const kaynakVal = kaynak === "roadmap_veri" ? "roadmap_veri" : "roadmap_genel";

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
      kaynak: kaynakVal,
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
    return { ok: true, steps: inserted, kaynak: kaynakVal };
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

  async function saveMevcutRol(rol) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return { ok: false, reason: "auth" };
    const val = String(rol || "").trim().slice(0, 160);
    const { data, error } = await c
      .from("profiles")
      .update({ mevcut_rol: val || null })
      .eq("id", user.id)
      .select()
      .maybeSingle();
    if (error) {
      console.warn("[CPAuth] saveMevcutRol:", error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true, profile: data, mevcut_rol: val };
  }

  /**
   * Mevcut role gore yatay gecis onerileri (2-4).
   * Eslesme yok / hata → suggestions=[] (UI bolumu gizlenir).
   */
  async function fetchYatayGecis(mevcutRol) {
    const rol = String(mevcutRol || "").trim();
    if (rol.length < 2) return { ok: true, suggestions: [] };
    try {
      const r = await fetch("/api/yatay-gecis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mevcut_rol: rol }),
      });
      let data = null;
      try { data = await r.json(); } catch (e) { data = null; }
      if (!data || !data.ok) return { ok: true, suggestions: [] };
      const list = Array.isArray(data.suggestions) ? data.suggestions : [];
      const cleaned = list
        .map((x) => ({
          hedef_rol: String((x && x.hedef_rol) || "").trim(),
          gerekce: String((x && x.gerekce) || "").trim(),
        }))
        .filter((x) => x.hedef_rol)
        .slice(0, 4);
      return {
        ok: true,
        suggestions: cleaned.length >= 2 ? cleaned : [],
        meslek_adi: data.meslek_adi || "",
      };
    } catch (e) {
      console.warn("[CPAuth] fetchYatayGecis:", e && e.message);
      return { ok: true, suggestions: [] };
    }
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

  /** Sektor metni: TR kucuk harf + aksan sadeleştirme (eslestirme) */
  function normalizeSectorText(text) {
    return String(text || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i")
      .replace(/İ/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  var SECTOR_ALIASES = {
    turizm: ["turizm", "otel", "hotel", "hospitality", "konaklama", "resort", "misafir"],
    yazilim: ["yazilim", "software", "developer", "programlama", "bilisim", "teknoloji", "kodlama", "devops", "frontend", "backend"],
    insaat: ["insaat", "construction", "santiye", "muteahhit", "yapi"],
    finans: ["finans", "muhasebe", "banka", "finance", "accounting", "maliye", "yatirim"],
    saglik: ["saglik", "health", "hastane", "hemsire", "medikal", "klinik", "eczane"],
  };

  /**
   * hedef_sektor yanitini sector_key ile eslestir.
   * Eslesme yoksa "genel".
   */
  function matchSectorKey(answerText) {
    const t = normalizeSectorText(answerText);
    if (!t) return "genel";
    const keys = ["turizm", "yazilim", "insaat", "finans", "saglik"];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const aliases = SECTOR_ALIASES[key] || [];
      for (let j = 0; j < aliases.length; j++) {
        if (t.indexOf(aliases[j]) !== -1) return key;
      }
      if (t.indexOf(key) !== -1) return key;
    }
    return "genel";
  }

  function sectorNotesFallback(sectorKey, locale) {
    const list = (typeof global.CP_SECTOR_NOTES_FALLBACK !== "undefined" && Array.isArray(global.CP_SECTOR_NOTES_FALLBACK))
      ? global.CP_SECTOR_NOTES_FALLBACK
      : [];
    const loc = locale === "en" ? "en" : "tr";
    let key = sectorKey || "genel";
    let notes = list
      .filter((n) => n.sector_key === key && (n.locale || "tr") === loc)
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!notes.length && key !== "genel") {
      key = "genel";
      notes = list
        .filter((n) => n.sector_key === "genel" && (n.locale || "tr") === loc)
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    if (!notes.length && loc === "en") {
      return sectorNotesFallback(sectorKey, "tr");
    }
    return { sector_key: key, notes: notes, source: "fallback" };
  }

  async function querySectorNotes(sectorKey, locale) {
    const c = await getClient();
    if (!c) return [];
    const loc = locale === "en" ? "en" : "tr";
    const { data, error } = await c
      .from("sector_notes")
      .select("id, sector_key, slug, title, body, tags, order, locale, cta_type")
      .eq("sector_key", sectorKey)
      .eq("locale", loc)
      .order("order", { ascending: true });
    if (error) {
      console.warn("[CPAuth] querySectorNotes:", error.message);
      return null;
    }
    return data || [];
  }

  /**
   * Sektör notlarını getir. Eslesmeyen / bos paket → genel.
   * DB yoksa veya hata varsa istemci fallback.
   */
  async function fetchSectorNotes(sectorKeyOrAnswer, locale) {
    const loc = locale === "en" ? "en" : "tr";
    const raw = String(sectorKeyOrAnswer || "").trim();
    const known = ["turizm", "yazilim", "insaat", "finans", "saglik", "genel"];
    const matched = known.indexOf(raw) !== -1 ? raw : matchSectorKey(raw);

    let notes = await querySectorNotes(matched, loc);
    if (notes === null) {
      return sectorNotesFallback(matched, loc);
    }
    let usedKey = matched;
    if (!notes.length && matched !== "genel") {
      notes = await querySectorNotes("genel", loc);
      usedKey = "genel";
      if (notes === null) return sectorNotesFallback(matched, loc);
    }
    if (!notes.length) {
      return sectorNotesFallback(matched, loc);
    }
    return { sector_key: usedKey, matched_key: matched, notes: notes, source: "db" };
  }

  async function fetchLatestSectorAnswer() {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return "";
    const { data, error } = await c
      .from("user_answers")
      .select("answer_text, created_at")
      .eq("user_id", user.id)
      .eq("question_id", "hedef_sektor")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) {
      console.warn("[CPAuth] fetchLatestSectorAnswer:", error.message);
      return "";
    }
    return (data && data[0] && data[0].answer_text) || "";
  }

  /**
   * Profil / sohbet icin paket: eslesen sektor + notlar.
   * personalize=true ise her nota opsiyonel tek cumle ekler (basarisiz olursa sessizce atlar).
   */
  async function fetchSectorNotesPack({ answerText, locale, personalize, goal } = {}) {
    let sectorAnswer = answerText;
    if (sectorAnswer == null || sectorAnswer === "") {
      sectorAnswer = await fetchLatestSectorAnswer();
    }
    const matched = matchSectorKey(sectorAnswer);
    const pack = await fetchSectorNotes(matched, locale || "tr");
    const notes = (pack.notes || []).map((n) => Object.assign({}, n));
    if (personalize && notes.length) {
      const g = goal != null ? goal : await fetchCareerGoal();
      await Promise.all(
        notes.map(async (n) => {
          try {
            const line = await personalizeSectorNote(n, {
              goal: g,
              sectorAnswer: sectorAnswer,
            });
            if (line) n.personal_line = line;
          } catch (e) { /* ignore */ }
        })
      );
    }
    return {
      sector_key: pack.sector_key || matched,
      matched_key: matched,
      sector_answer: sectorAnswer || "",
      notes: notes,
      source: pack.source || "db",
    };
  }

  /** Opsiyonel: Claude ile not sonuna tek cumle (basarisiz → "") */
  async function personalizeSectorNote(note, { goal, sectorAnswer } = {}) {
    if (!note || !note.body) return "";
    try {
      const r = await fetch("/api/sohbet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "personalize_sector_note",
          title: note.title || "",
          body: String(note.body || "").slice(0, 1200),
          hedef: String(goal || "").slice(0, 300),
          sektor: String(sectorAnswer || "").slice(0, 200),
        }),
      });
      if (!r.ok) return "";
      const data = await r.json();
      const line = (data && data.line) ? String(data.line).trim() : "";
      return line.slice(0, 220);
    } catch (e) {
      console.warn("[CPAuth] personalizeSectorNote:", e.message || e);
      return "";
    }
  }

  function sectorCtaHref(ctaType) {
    if (ctaType === "micro_task") return "pratikler.html#pratiker";
    if (ctaType === "training") return "yol-haritam.html";
    return "kariyer%20sohbet.html";
  }

  /** Profil ailesi sayfa görüntüleme — admin kaliteye bağlanır (product_events). */
  async function logProductEvent(eventType, pageId, meta) {
    const c = client();
    const user = await getUser();
    if (!c || !user) return { ok: false, reason: "auth" };
    const type = String(eventType || "page_view");
    const pid = String(pageId || "").toLowerCase();
    if (["bugun", "yol", "pratik", "kesfet"].indexOf(pid) < 0) {
      return { ok: false, reason: "bad_page" };
    }
    try {
      const { error } = await c.from("product_events").insert({
        user_id: user.id,
        event_type: type,
        page_id: pid,
        meta: meta && typeof meta === "object" ? meta : {},
      });
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: (e && e.message) || "error" };
    }
  }

  var CHAT_DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

  function parseDraftJson(raw, fallback) {
    if (raw == null) return fallback;
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function normalizeDraftRow(row) {
    if (!row || !row.id) return null;
    if (row.status !== "in_progress") return null;
    if (row.phase === "result") return null;
    const updated = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    if (!updated || Date.now() - updated > CHAT_DRAFT_TTL_MS) return null;

    const answers = parseDraftJson(row.answers_json, []);
    const attempts = parseDraftJson(row.attempts_json, {});
    const scenarios = parseDraftJson(row.scenario_questions_json, []);
    if (!Array.isArray(answers) || !attempts || typeof attempts !== "object" || !Array.isArray(scenarios)) {
      return null;
    }

    let step = Number(row.step);
    if (!Number.isFinite(step) || step < 0) step = 0;

    return {
      id: row.id,
      session_id: row.session_id,
      status: row.status,
      phase: row.phase === "result" ? "result" : "asking",
      step: Math.floor(step),
      locale: row.locale === "en" ? "en" : "tr",
      answers: answers.map((a) => (a == null ? "" : String(a))),
      attempts: attempts,
      scenario_questions: scenarios,
      scenarios_ready: !!row.scenarios_ready,
      updated_at: row.updated_at,
      created_at: row.created_at,
    };
  }

  async function fetchActiveChatDraft() {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return null;
    const { data, error } = await c
      .from("chat_drafts")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[CPAuth] fetchActiveChatDraft:", error.message);
      return null;
    }
    return normalizeDraftRow(data);
  }

  /**
   * Aktif in_progress draft'i upsert et.
   * state: { sessionId, phase, step, locale, answers, attempts, scenarioQuestions, scenariosReady }
   */
  async function saveChatDraft(state) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user || !state) return { ok: false, reason: "auth_or_empty" };

    const phase = state.phase === "result" ? "result" : "asking";
    const status = state.status === "completed"
      ? "completed"
      : (state.status === "abandoned" ? "abandoned" : "in_progress");
    if (status !== "in_progress") {
      return { ok: false, reason: "use_complete_or_abandon" };
    }

    const session_id = setSessionId(state.sessionId || getSessionId());
    let step = Number(state.step);
    if (!Number.isFinite(step) || step < 0) step = 0;
    const answers = Array.isArray(state.answers) ? state.answers : [];
    const attempts = state.attempts && typeof state.attempts === "object" ? state.attempts : {};
    const scenarioQuestions = Array.isArray(state.scenarioQuestions) ? state.scenarioQuestions : [];

    const payload = {
      user_id: user.id,
      session_id,
      status: "in_progress",
      phase,
      step: Math.floor(step),
      locale: state.locale === "en" ? "en" : "tr",
      answers_json: answers,
      attempts_json: attempts,
      scenario_questions_json: scenarioQuestions,
      scenarios_ready: !!state.scenariosReady,
      updated_at: new Date().toISOString(),
    };

    const existingRes = await c
      .from("chat_drafts")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .maybeSingle();
    const existingId = existingRes.data && existingRes.data.id;

    if (existingId) {
      const { data, error } = await c
        .from("chat_drafts")
        .update(payload)
        .eq("id", existingId)
        .eq("user_id", user.id)
        .select()
        .maybeSingle();
      if (error) {
        console.warn("[CPAuth] saveChatDraft update:", error.message);
        return { ok: false, reason: error.message };
      }
      return { ok: true, draft: data };
    }

    const { data, error } = await c
      .from("chat_drafts")
      .insert(payload)
      .select()
      .maybeSingle();
    if (error) {
      // Race: baska in_progress oluşmuş olabilir — update dene
      if (String(error.message || "").indexOf("chat_drafts_one_in_progress") !== -1
        || error.code === "23505") {
        const again = await c
          .from("chat_drafts")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "in_progress")
          .maybeSingle();
        if (again.data && again.data.id) {
          const { data: d2, error: e2 } = await c
            .from("chat_drafts")
            .update(payload)
            .eq("id", again.data.id)
            .select()
            .maybeSingle();
          if (e2) {
            console.warn("[CPAuth] saveChatDraft race update:", e2.message);
            return { ok: false, reason: e2.message };
          }
          return { ok: true, draft: d2 };
        }
      }
      console.warn("[CPAuth] saveChatDraft insert:", error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true, draft: data };
  }

  async function completeChatDraft(sessionId) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return { ok: false, reason: "auth" };
    const sid = sessionId || getSessionId();
    const { error } = await c
      .from("chat_drafts")
      .update({
        status: "completed",
        phase: "result",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("status", "in_progress");
    if (error) {
      console.warn("[CPAuth] completeChatDraft:", error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true, session_id: sid };
  }

  async function abandonChatDraft(sessionId) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return { ok: false, reason: "auth" };
    const { error } = await c
      .from("chat_drafts")
      .update({
        status: "abandoned",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("status", "in_progress");
    if (error) {
      console.warn("[CPAuth] abandonChatDraft:", error.message);
      return { ok: false, reason: error.message };
    }
    if (sessionId) setSessionId(sessionId);
    else newSessionId();
    return { ok: true };
  }

  /** Profil / banner icin ozet */ 
  async function hasResumableChatDraft() {
    const d = await fetchActiveChatDraft();
    return !!d;
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

  /** Bu haftanin Pazartesi tarihi (YYYY-MM-DD, yerel) */
  function currentWeekStart() {
    const d = new Date();
    const day = d.getDay(); // 0=Pazar
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, "0");
    const dd = String(monday.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + dd;
  }

  async function fetchWeekMicroTasks(weekStart) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return [];
    const ws = weekStart || currentWeekStart();
    const { data, error } = await c
      .from("micro_tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", ws)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("[CPAuth] fetchWeekMicroTasks:", error.message);
      return [];
    }
    return data || [];
  }

  async function hasWeekMicroTasks(weekStart) {
    const list = await fetchWeekMicroTasks(weekStart);
    return list.length > 0;
  }

  var CHECKIN_CHOICES = ["egitim", "pratik", "basvuru", "belirsiz"];

  function checkinTemplateReflection(q2Choice, q2Text) {
    const choiceLabels = {
      egitim: "eğitim",
      pratik: "pratik",
      basvuru: "başvuru",
      belirsiz: "netleşecek bir odak",
    };
    let focus = "";
    if (q2Choice && choiceLabels[q2Choice]) focus = choiceLabels[q2Choice];
    else if (q2Text && String(q2Text).trim()) focus = String(q2Text).trim().slice(0, 80);
    if (focus) {
      return "Notunu aldık — gelecek hafta odağın: " + focus + ". Küçük bir adım yeterli.";
    }
    return "Notunu aldık — gelecek hafta odağın öncelik. Küçük bir adım yeterli.";
  }

  async function fetchWeekCheckin(weekStart) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return null;
    const ws = weekStart || currentWeekStart();
    const { data, error } = await c
      .from("weekly_checkins")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", ws)
      .maybeSingle();
    if (error) {
      console.warn("[CPAuth] fetchWeekCheckin:", error.message);
      return null;
    }
    return data || null;
  }

  async function fetchCheckinHistory(limit) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return [];
    const lim = Math.min(Math.max(Number(limit) || 6, 1), 8);
    const { data, error } = await c
      .from("weekly_checkins")
      .select("*")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false })
      .limit(lim);
    if (error) {
      console.warn("[CPAuth] fetchCheckinHistory:", error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Opsiyonel Claude yansima; basarisizsa sablon.
   * payload: { q1, q2, q2_choice, goal }
   */
  async function reflectCheckin(payload) {
    const q1 = String((payload && payload.q1) || "").trim();
    const q2 = String((payload && payload.q2) || "").trim();
    const choice = (payload && payload.q2_choice) || null;
    const fallback = checkinTemplateReflection(choice, q2);
    if (!q1) return fallback;
    try {
      const r = await fetch("/api/sohbet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkin_reflect",
          q1: q1.slice(0, 800),
          q2: q2.slice(0, 400),
          q2_choice: choice || "",
          hedef: String((payload && payload.goal) || "").slice(0, 300),
        }),
      });
      if (!r.ok) return fallback;
      const data = await r.json();
      const line = (data && data.reflection) ? String(data.reflection).trim() : "";
      return line ? line.slice(0, 220) : fallback;
    } catch (e) {
      console.warn("[CPAuth] reflectCheckin:", e.message || e);
      return fallback;
    }
  }

  /**
   * Haftalik check-in upsert (user_id + week_start).
   * opts: { q1, q2, q2_choice, source, weekStart, reflect, goal }
   */
  async function saveWeekCheckin(opts) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user || !opts) return { ok: false, reason: "auth_or_empty" };

    const q1 = String(opts.q1 || "").trim().slice(0, 1000);
    if (!q1) return { ok: false, reason: "q1_required" };

    const q2 = String(opts.q2 || "").trim().slice(0, 500) || null;
    let choice = opts.q2_choice || null;
    if (choice && CHECKIN_CHOICES.indexOf(choice) === -1) choice = null;
    const ws = opts.weekStart || currentWeekStart();
    const source = opts.source === "email_link" ? "email_link" : "profile";

    let reflection = null;
    if (opts.reflect !== false) {
      reflection = await reflectCheckin({
        q1: q1,
        q2: q2 || "",
        q2_choice: choice,
        goal: opts.goal || "",
      });
    } else if (opts.reflection) {
      reflection = String(opts.reflection).trim().slice(0, 220);
    } else {
      reflection = checkinTemplateReflection(choice, q2);
    }

    const payload = {
      user_id: user.id,
      week_start: ws,
      q1_text: q1,
      q2_text: q2,
      q2_choice: choice,
      reflection: reflection,
      source: source,
    };

    const existing = await fetchWeekCheckin(ws);
    if (existing && existing.id) {
      const { data, error } = await c
        .from("weekly_checkins")
        .update({
          q1_text: payload.q1_text,
          q2_text: payload.q2_text,
          q2_choice: payload.q2_choice,
          reflection: payload.reflection,
          source: payload.source,
        })
        .eq("id", existing.id)
        .eq("user_id", user.id)
        .select()
        .maybeSingle();
      if (error) {
        console.warn("[CPAuth] saveWeekCheckin update:", error.message);
        return { ok: false, reason: error.message };
      }
      return { ok: true, checkin: data };
    }

    const { data, error } = await c
      .from("weekly_checkins")
      .insert(payload)
      .select()
      .maybeSingle();
    if (error) {
      // Race on unique — update
      if (error.code === "23505") {
        const again = await fetchWeekCheckin(ws);
        if (again && again.id) {
          const { data: d2, error: e2 } = await c
            .from("weekly_checkins")
            .update({
              q1_text: payload.q1_text,
              q2_text: payload.q2_text,
              q2_choice: payload.q2_choice,
              reflection: payload.reflection,
              source: payload.source,
            })
            .eq("id", again.id)
            .select()
            .maybeSingle();
          if (e2) return { ok: false, reason: e2.message };
          return { ok: true, checkin: d2 };
        }
      }
      console.warn("[CPAuth] saveWeekCheckin insert:", error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true, checkin: data };
  }

  /**
   * tasks: [{ yetkinlik_adi, title, description, minutes, due_hint }]
   * Ayni hafta icin zaten paket varsa yazmaz (yenileme cron/sohbet cakismasin).
   */
  async function saveMicroTasks(tasks, { snapshotId, source, weekStart, force } = {}) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user || !Array.isArray(tasks) || !tasks.length) {
      return { ok: false, reason: "auth_or_empty" };
    }
    const ws = weekStart || currentWeekStart();
    if (!force) {
      const existing = await hasWeekMicroTasks(ws);
      if (existing) return { ok: true, skipped: true, week_start: ws };
    }

    const src = source === "claude" ? "claude" : "template";
    const rows = tasks.slice(0, 4).map((t) => {
      const key = normalizeYetkinlikAdi(t.yetkinlik_adi || t.yetkinlik || t.yetkinlik_label || "genel");
      let desc = (t.description || "").trim();
      if (t.minutes) desc = (desc ? desc + " " : "") + "(" + t.minutes + " dk)";
      return {
        user_id: user.id,
        yetkinlik_adi: key || "genel",
        title: String(t.title || "Pratik").trim().slice(0, 160),
        description: desc.slice(0, 500) || null,
        week_start: ws,
        due_hint: (t.due_hint || "").trim().slice(0, 40) || null,
        status: "bekliyor",
        source: src,
        competency_snapshot_id: snapshotId || null,
      };
    }).filter((r) => r.title);

    if (!rows.length) return { ok: false, reason: "empty" };
    const { data, error } = await c.from("micro_tasks").insert(rows).select();
    if (error) {
      console.warn("[CPAuth] saveMicroTasks:", error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true, tasks: data || [], week_start: ws };
  }

  async function markMicroTaskDone(id) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user || !id) return { ok: false };
    const { error } = await c
      .from("micro_tasks")
      .update({ status: "yapildi" })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      console.warn("[CPAuth] markMicroTaskDone:", error.message);
      return { ok: false };
    }
    return { ok: true };
  }

  /**
   * Zayif yetkinliklerden API ile gorev uretip bu haftaya kaydeder.
   * skills: sohbet yetkinlik listesi; yoksa son snapshot skorlari kullanilir.
   */
  async function generateAndSaveMicroTasks(skills, snapshotId) {
    let yetkinlikler = Array.isArray(skills) ? skills : [];
    let snapId = snapshotId || null;

    if (!yetkinlikler.length) {
      const snaps = await fetchLastSnapshots(1);
      if (!snaps.length) return { ok: false, reason: "no_snapshot" };
      snapId = snaps[0].id;
      const scores = await fetchScoresForSnapshot(snapId);
      yetkinlikler = scores.map((s) => ({
        yetkinlik: s.yetkinlik_adi,
        puan: s.puan,
        seviye: s.seviye || (Number(s.puan) < 3 ? "gelistirilmeli" : "guclu"),
      }));
    }

    const weak = yetkinlikler.filter((y) => {
      const sev = y.seviye || "";
      const p = Number(y.puan);
      return sev === "gelistirilmeli" || (Number.isFinite(p) && p < 3);
    });
    if (!weak.length && !yetkinlikler.length) {
      return { ok: false, reason: "no_weak" };
    }

    try {
      const r = await fetch("/api/sohbet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "micro_tasks",
          yetkinlikler: weak.length ? weak : yetkinlikler,
        }),
      });
      if (!r.ok) throw new Error("micro_tasks_http");
      const data = await r.json();
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      if (!tasks.length) return { ok: false, reason: "empty_tasks" };
      if (!snapId) {
        const snaps = await fetchLastSnapshots(1);
        if (snaps[0]) snapId = snaps[0].id;
      }
      return saveMicroTasks(tasks, {
        snapshotId: snapId,
        source: data.source === "claude" ? "claude" : "template",
      });
    } catch (e) {
      console.warn("[CPAuth] generateAndSaveMicroTasks:", e.message || e);
      return { ok: false, reason: e.message || "error" };
    }
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

  /**
   * LinkedIn / paylasim ozet karti payload.
   * opts: { includeName?, locale?, skills? (sohbet anlik) }
   */
  async function buildShareCardPayload(opts) {
    const options = opts || {};
    const locale = options.locale === "en" ? "en" : "tr";
    const includeName = !!options.includeName;

    let goal = "";
    let displayName = "";
    let steps = [];
    let skills = [];

    try { goal = (await fetchCareerGoal()) || ""; } catch (e) { goal = ""; }

    if (includeName) {
      try {
        const p = await fetchProfile();
        displayName = (p && p.display_name) ? String(p.display_name).trim() : "";
      } catch (e) { displayName = ""; }
    }

    try {
      const roadmap = await fetchActiveRoadmap();
      steps = (roadmap || [])
        .filter((s) => s && s.title)
        .slice(0, 4)
        .map((s) => ({
          order: s.step_order,
          title: String(s.title).trim().slice(0, 80),
          status: s.status || "bekliyor",
        }));
    } catch (e) { steps = []; }

    if (Array.isArray(options.skills) && options.skills.length) {
      skills = options.skills.map((sk) => {
        const name = normalizeYetkinlikAdi(sk.yetkinlik || sk.yetkinlik_adi || "");
        const puan = Number(sk.puan);
        const seviye = sk.seviye || "";
        const strong = seviye === "guclu" || (Number.isFinite(puan) && puan >= 3.5);
        return {
          name: name || String(sk.yetkinlik || "").trim(),
          label: strong
            ? (locale === "en" ? "Strong signal" : "Güçlü sinyal")
            : (locale === "en" ? "Developing" : "Geliştiriyorum"),
          strong: !!strong,
          sort: strong ? 0 : 1,
          puan: Number.isFinite(puan) ? puan : null,
        };
      }).filter((s) => s.name);
    } else {
      try {
        const snaps = await fetchLastSnapshots(1);
        if (snaps[0]) {
          const scores = await fetchScoresForSnapshot(snaps[0].id);
          skills = (scores || []).map((s) => {
            const puan = Number(s.puan);
            const seviye = s.seviye || "";
            const strong = seviye === "guclu" || (Number.isFinite(puan) && puan >= 3.5);
            return {
              name: s.yetkinlik_adi,
              label: strong
                ? (locale === "en" ? "Strong signal" : "Güçlü sinyal")
                : (locale === "en" ? "Developing" : "Geliştiriyorum"),
              strong: !!strong,
              sort: strong ? 0 : 1,
              puan: Number.isFinite(puan) ? puan : null,
            };
          });
        }
      } catch (e) { skills = []; }
    }

    skills.sort((a, b) => {
      if (a.sort !== b.sort) return a.sort - b.sort;
      const pa = a.puan == null ? 0 : a.puan;
      const pb = b.puan == null ? 0 : b.puan;
      return pb - pa;
    });
    skills = skills.slice(0, 5).map((s) => ({
      name: s.name,
      label: s.label,
      strong: s.strong,
    }));

    if (!skills.length && !steps.length && !String(goal || "").trim()) {
      return { ok: false, empty: true, locale: locale };
    }

    const disclaimer = locale === "en"
      ? "Approximate growth signal — not a scientific measurement or hiring guarantee."
      : "Yaklaşık gelişim sinyali — bilimsel ölçüm veya işe alım garantisi değil.";

    return {
      ok: true,
      empty: false,
      locale: locale,
      brand: "Career Pick",
      goal: String(goal || "").trim().slice(0, 160),
      display_name: includeName ? displayName.slice(0, 60) : "",
      include_name: includeName,
      skills: skills,
      steps: steps,
      disclaimer: disclaimer,
      app_url: "https://careerpick.vercel.app",
      created_at: new Date().toISOString(),
    };
  }

  function shareCardLinkedInText(payload) {
    if (!payload || payload.empty) return "";
    const locale = payload.locale === "en" ? "en" : "tr";
    const strong = (payload.skills || []).filter((s) => s.strong).map((s) => s.name);
    const developing = (payload.skills || []).filter((s) => !s.strong).map((s) => s.name);
    const skillBits = strong.length ? strong : developing;
    const path = (payload.steps || []).map((s) => s.title).filter(Boolean);
    if (locale === "en") {
      return [
        "I clarified my career focus with Career Pick.",
        "",
        payload.goal ? ("Goal: " + payload.goal) : null,
        skillBits.length ? ("Signals: " + skillBits.slice(0, 4).join(", ")) : null,
        path.length ? ("My path: " + path.slice(0, 4).join(" → ")) : null,
        "",
        payload.disclaimer || "",
        payload.app_url || "https://careerpick.vercel.app",
      ].filter((x) => x !== null).join("\n");
    }
    return [
      "Career Pick ile kariyer odağımı netleştirdim.",
      "",
      payload.goal ? ("Hedef: " + payload.goal) : null,
      skillBits.length ? ("Güçlü / gelişen sinyaller: " + skillBits.slice(0, 4).join(", ")) : null,
      path.length ? ("Şu anki yolum: " + path.slice(0, 4).join(" → ")) : null,
      "",
      payload.disclaimer || "",
      payload.app_url || "https://careerpick.vercel.app",
    ].filter((x) => x !== null).join("\n");
  }

  function randomShareToken() {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    for (let i = 0; i < 12; i++) {
      out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return out;
  }

  async function saveShareCard(payload, { isPublic } = {}) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user || !payload || payload.empty) return { ok: false, reason: "empty" };
    const token = randomShareToken();
    const { data, error } = await c
      .from("share_cards")
      .insert({
        user_id: user.id,
        public_token: token,
        payload_json: payload,
        is_public: isPublic !== false,
      })
      .select()
      .maybeSingle();
    if (error) {
      console.warn("[CPAuth] saveShareCard:", error.message);
      return { ok: false, reason: error.message };
    }
    const origin = (typeof location !== "undefined" && location.origin)
      ? location.origin
      : "https://careerpick.vercel.app";
    return {
      ok: true,
      card: data,
      url: origin + "/ozet.html?t=" + encodeURIComponent(token),
    };
  }

  async function fetchShareCardByToken(token) {
    const c = await getClient();
    if (!c || !token) return null;
    const { data, error } = await c
      .from("share_cards")
      .select("id, public_token, payload_json, is_public, created_at")
      .eq("public_token", String(token).trim())
      .eq("is_public", true)
      .maybeSingle();
    if (error) {
      console.warn("[CPAuth] fetchShareCardByToken:", error.message);
      return null;
    }
    return data || null;
  }

  async function setShareCardPublic(id, isPublic) {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user || !id) return { ok: false };
    const { error } = await c
      .from("share_cards")
      .update({ is_public: !!isPublic })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      console.warn("[CPAuth] setShareCardPublic:", error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  }

  async function getAccessToken() {
    const c = await getClient();
    if (!c) return "";
    const { data } = await c.auth.getSession();
    return (data.session && data.session.access_token) || "";
  }

  async function billingQuota(action, sessionId) {
    const token = await getAccessToken();
    if (!token) return { ok: false, reason: "auth", allowed: false, canStart: false };
    try {
      const r = await fetch("/api/billing/quota", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          action: action || "status",
          sessionId: sessionId || getSessionId(),
        }),
      });
      let data = null;
      try { data = await r.json(); } catch (e) { data = null; }
      if (!data) return { ok: false, reason: "bad_response", allowed: false, canStart: false };
      data.httpStatus = r.status;
      return data;
    } catch (e) {
      console.warn("[CPAuth] billingQuota:", e.message || e);
      return { ok: false, reason: e.message || "error", allowed: false, canStart: false };
    }
  }

  async function fetchPlan() {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return { plan: "free" };
    const { data } = await c
      .from("profiles")
      .select("plan, plan_expires_at")
      .eq("id", user.id)
      .maybeSingle();
    const usage = await billingQuota("status");
    return {
      plan: (data && data.plan) || usage.plan || "free",
      plan_expires_at: data ? data.plan_expires_at : null,
      usage: usage,
    };
  }

  async function fetchUsage() {
    return billingQuota("status");
  }

  async function canStartChat() {
    const data = await billingQuota("can_start");
    return {
      ok: !!data.ok,
      allowed: !!(data.allowed || data.canStart),
      reason: data.reason || "",
      plan: data.plan || "free",
      remaining: data.remaining,
      free_chats_used: data.free_chats_used,
      plus_chats_used: data.plus_chats_used,
      free_limit: data.free_limit,
      plus_limit: data.plus_limit,
      raw: data,
    };
  }

  async function recordChatCompletion(sessionId) {
    return billingQuota("record", sessionId || getSessionId());
  }

  async function createIyzicoCheckout(fields) {
    const token = await getAccessToken();
    if (!token) return { ok: false, reason: "auth" };
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(fields || {}),
      });
      const data = await r.json();
      if (!r.ok) return { ok: false, ...data };
      return data;
    } catch (e) {
      return { ok: false, reason: e.message || "error" };
    }
  }

  async function cancelSubscription() {
    const token = await getAccessToken();
    if (!token) return { ok: false, reason: "auth" };
    try {
      const r = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (!r.ok) return { ok: false, ...data };
      return data;
    } catch (e) {
      return { ok: false, reason: e.message || "error" };
    }
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
    setSessionId,
    newSessionId,
    saveAnswer,
    saveChatDraft,
    fetchActiveChatDraft,
    completeChatDraft,
    abandonChatDraft,
    hasResumableChatDraft,
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
    saveMevcutRol,
    fetchYatayGecis,
    setEmailRemindersOptIn,
    statusProgress,
    overallProgress,
    getWeekActions,
    normalizeYetkinlikAdi,
    normalizeSectorText,
    matchSectorKey,
    fetchSectorNotes,
    fetchLatestSectorAnswer,
    fetchSectorNotesPack,
    personalizeSectorNote,
    sectorCtaHref,
    logProductEvent,
    saveCompetencySnapshot,
    fetchLastSnapshots,
    compareLastCompetencySnapshots,
    fetchCompetencyComparisonSummary,
    currentWeekStart,
    fetchWeekMicroTasks,
    hasWeekMicroTasks,
    saveMicroTasks,
    markMicroTaskDone,
    generateAndSaveMicroTasks,
    fetchWeekCheckin,
    saveWeekCheckin,
    fetchCheckinHistory,
    reflectCheckin,
    checkinTemplateReflection,
    buildJobMatchProfile,
    analyzeJobMatch,
    saveJobMatch,
    fetchLatestJobMatch,
    buildShareCardPayload,
    shareCardLinkedInText,
    saveShareCard,
    fetchShareCardByToken,
    setShareCardPublic,
    getAccessToken,
    fetchPlan,
    fetchUsage,
    canStartChat,
    recordChatCompletion,
    createIyzicoCheckout,
    cancelSubscription,
  };
})(typeof window !== "undefined" ? window : globalThis);
