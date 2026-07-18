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
        client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: global.localStorage,
          },
        });
        configured = true;
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
    const { data, error } = await c
      .from("profiles")
      .upsert(
        { id: user.id, email: user.email || null, display_name: display },
        { onConflict: "id" }
      )
      .select()
      .maybeSingle();
    if (error) {
      console.warn("[CPAuth] ensureProfile:", error.message);
      return null;
    }
    return data;
  }

  async function signInWithGoogle(redirectTo) {
    const c = await getClient();
    if (!c) throw new Error("Supabase yapilandirilmadi");
    const target = redirectTo || (global.location.origin + "/auth-callback.html");
    const { error } = await c.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: target, queryParams: { access_type: "offline", prompt: "consent" } },
    });
    if (error) throw error;
  }

  async function signOut() {
    const c = await getClient();
    if (!c) return;
    await c.auth.signOut();
  }

  function onAuthStateChange(cb) {
    let unsub = null;
    init().then((c) => {
      if (!c) { cb(null); return; }
      const { data } = c.auth.onAuthStateChange((_event, session) => {
        cb(session ? session.user : null);
      });
      unsub = () => data.subscription.unsubscribe();
      c.auth.getSession().then(({ data: d }) => cb(d.session ? d.session.user : null));
    });
    return () => { if (unsub) unsub(); };
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
      const recommended_at = new Date().toISOString();

      const { data: existing } = await c
        .from("recommended_trainings")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("training_id", training_id)
        .maybeSingle();

      if (existing) {
        // Mevcut ilerlemeyi (tamamlandi vb.) koru; sadece isim/tarih guncelle
        // Acik status gonderildiyse (orn. devam_ediyor) onu uygula
        const patch = { training_name, recommended_at };
        if (t.status) patch.status = t.status;
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
    const { error } = await c
      .from("recommended_trainings")
      .update({ status })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      console.warn("[CPAuth] updateTrainingStatus:", error.message);
      return { ok: false };
    }
    return { ok: true };
  }

  async function fetchProfile() {
    const c = await getClient();
    const user = await getUser();
    if (!c || !user) return null;
    const { data } = await c.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return data;
  }

  function statusProgress(status) {
    if (status === "tamamlandi") return 100;
    if (status === "devam_ediyor") return 50;
    return 0;
  }

  function overallProgress(trainings) {
    if (!trainings || !trainings.length) return 0;
    const sum = trainings.reduce((acc, t) => acc + statusProgress(t.status), 0);
    return Math.round(sum / trainings.length);
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
    fetchProfile,
    statusProgress,
    overallProgress,
  };
})(typeof window !== "undefined" ? window : globalThis);
