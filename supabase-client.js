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
    return updateTrainingStatus(id, "devam_ediyor");
  }

  async function markTrainingCompleted(id) {
    return updateTrainingStatus(id, "tamamlandi");
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

  /** Uygulama ici "Bu hafta yapman gerekenler" listesi */
  function getWeekActions(trainings) {
    const list = Array.isArray(trainings) ? trainings : [];
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const actions = [];

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

    actions.sort((a, b) => a.priority - b.priority);
    const next = list.find((t) => t.status !== "tamamlandi") || null;
    return { actions: actions.slice(0, 5), next };
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
    fetchProfile,
    setEmailRemindersOptIn,
    statusProgress,
    overallProgress,
    getWeekActions,
  };
})(typeof window !== "undefined" ? window : globalThis);
