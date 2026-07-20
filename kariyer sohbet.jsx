/* global React, ReactDOM, CP_SOHBET, CPAuth, CPShareCardModal, CPPaywallModal */
const { useState: useStateK, useEffect: useEffectK, useRef: useRefK } = React;
const IcK = window.CPIcon;
const LogoK = window.CPLogo;
const MAX_FOLLOWUPS = 1;

async function persistAnswer(meta, answerText) {
  if (!window.CPAuth) return;
  try {
    await CPAuth.saveAnswer({
      questionId: (meta && meta.key) || null,
      questionText: (meta && meta.q) || null,
      answerText,
      sessionId: CPAuth.getSessionId(),
    });
  } catch (e) {
    console.warn("[SOHBET] persistAnswer:", e.message || e);
  }
}

async function persistResults(recs, skills, cevaplar) {
  if (!window.CPAuth) return { comparison: null };
  try {
    const user = await CPAuth.getUser();
    if (!user) return { comparison: null };
    const trainingsPayload = Array.isArray(recs)
      ? recs.map((r) => ({
          training_id: r.link || r.ad,
          training_name: r.ad,
          link: r.link || "",
          status: "eksik",
          gerekce: r.gerekce || "",
          session_id: CPAuth.getSessionId(),
          is_placeholder: !!r.is_placeholder,
        }))
      : [];
    if (trainingsPayload.length) {
      await CPAuth.saveRecommendations(trainingsPayload);
    }
    if (Array.isArray(skills) && skills.length) {
      await CPAuth.saveInsights(skills.map((sk) => ({
        category: sk.yetkinlik || "yetkinlik",
        insight_text: [
          sk.yetkinlik || "Yetkinlik",
          typeof sk.puan !== "undefined" ? `${sk.puan}/5` : "",
          sk.seviye || "",
          sk.yorum || "",
        ].filter(Boolean).join(" — "),
      })));
      const snapRes = await CPAuth.saveCompetencySnapshot(skills, CPAuth.getSessionId());
      const snapId = snapRes && snapRes.snapshot ? snapRes.snapshot.id : null;
      try {
        await CPAuth.generateAndSaveMicroTasks(skills, snapId);
      } catch (e) {
        console.warn("[SOHBET] micro_tasks:", e.message || e);
      }
    }
    await persistRoadmap(trainingsPayload, skills, cevaplar);

    let comparison = null;
    if (Array.isArray(skills) && skills.length) {
      comparison = await CPAuth.compareLastCompetencySnapshots();
      if (comparison && comparison.hasComparison && comparison.rows.length) {
        try {
          const r = await fetch("/api/sohbet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "compare_summary", rows: comparison.rows }),
          });
          if (r.ok) {
            const data = await r.json();
            if (data && data.summary) comparison.summaryLine = data.summary;
          }
        } catch (e) { /* opsiyonel */ }
      }
    }
    return { comparison };
  } catch (e) {
    console.warn("[SOHBET] persistResults:", e.message || e);
    return { comparison: null };
  }
}

function labelYetkinlik(key, skills) {
  if (!key) return "";
  const list = Array.isArray(skills) ? skills : [];
  const hit = list.find((s) => CPAuth.normalizeYetkinlikAdi(s.yetkinlik) === key);
  if (hit && hit.yetkinlik) return hit.yetkinlik;
  return key.charAt(0).toLocaleUpperCase("tr-TR") + key.slice(1);
}

async function persistRoadmap(trainings, skills, cevaplar) {
  if (!window.CPAuth) return;
  try {
    let hedef = "";
    if (Array.isArray(cevaplar)) {
      const hit = cevaplar.find((c) => c && c.key === "kariyer_hedefi");
      if (hit) hedef = (hit.cevap || "").trim();
    }
    if (!hedef) {
      try { hedef = await CPAuth.fetchCareerGoal(); } catch (e) { /* ignore */ }
    }
    const r = await fetch("/api/sohbet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "roadmap",
        hedef,
        yetkinlikler: Array.isArray(skills) ? skills : [],
        trainings: (trainings || []).map((t) => ({
          training_id: t.training_id,
          training_name: t.training_name,
          gerekce: t.gerekce || "",
        })),
      }),
    });
    if (!r.ok) throw new Error("roadmap_http");
    const data = await r.json();
    const steps = Array.isArray(data.steps) ? data.steps : [];
    if (steps.length >= 3) {
      await CPAuth.saveRoadmap(steps);
    }
  } catch (e) {
    console.warn("[SOHBET] persistRoadmap:", e.message || e);
  }
}

/* ---------- Backend cagrilari ---------- */
async function apiDegerlendir(soru, cevap, meta, attempt) {
  const r = await fetch("/api/sohbet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "evaluate",
      soru,
      cevap,
      type: (meta && meta.type) || "profile",
      yetkinlik: (meta && meta.yetkinlik) || "",
      attempt: attempt || 0,
    }),
  });
  if (!r.ok) throw new Error("evaluate");
  return r.json();
}
async function apiSenaryolar(cevaplar) {
  const r = await fetch("/api/sohbet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "scenarios", cevaplar }),
  });
  if (!r.ok) throw new Error("scenarios");
  return r.json(); // { questions, meslek }
}
async function apiOner(cevaplar) {
  const payload = { action: "recommend", cevaplar };
  if (window.CPAuth) {
    try {
      payload.sessionId = CPAuth.getSessionId();
      const u = await CPAuth.getUser();
      if (u && u.id) payload.userId = u.id;
    } catch (e) { /* ignore */ }
  }
  const r = await fetch("/api/sohbet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("recommend");
  return r.json();
}

/* ---------- Profil deposu ---------- */
const PROFILE_KEY = "cp_selected_egitimler";
const ProfileStore = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || []; }
    catch (e) { return []; }
  },
  add(item) {
    const all = ProfileStore.getAll();
    if (!all.some((x) => x.id === item.id)) {
      all.push(item);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
    }
    return all;
  },
  remove(id) {
    const all = ProfileStore.getAll().filter((x) => x.id !== id);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
    return all;
  },
  has(id) { return ProfileStore.getAll().some((x) => x.id === id); },
};

/* ---------- Sayfa ---------- */
function KariyerSohbet() {
  const lang = (typeof localStorage !== "undefined" && localStorage.getItem("cp_lang")) === "en" ? "en" : "tr";
  const S = CP_SOHBET[lang];
  const PROFILE_N = S.questions.length;
  const EXPECTED_SCENARIOS = S.scenarioCount || 5;

  const [scenarioQs, setScenarioQs] = useStateK([]); // RAG'den gelen senaryolar
  const [scenariosReady, setScenariosReady] = useStateK(false);
  const [matchedMeslek, setMatchedMeslek] = useStateK("");
  const [scenarioMatchQuality, setScenarioMatchQuality] = useStateK("");
  const [loadingScenarios, setLoadingScenarios] = useStateK(false);

  const questions = S.questions.concat(scenarioQs);
  const N = questions.length;

  const [answers, setAnswers] = useStateK([]);
  const [step, setStep] = useStateK(0);
  const [input, setInput] = useStateK("");
  const [busy, setBusy] = useStateK(false);
  const [phase, setPhase] = useStateK("asking");
  const [editingIndex, setEditingIndex] = useStateK(null);
  const [attempts, setAttempts] = useStateK({});
  const [errorMsg, setErrorMsg] = useStateK("");
  const [recomputing, setRecomputing] = useStateK(false);
  const [recs, setRecs] = useStateK([]);
  const [skills, setSkills] = useStateK([]);
  const [skillCompare, setSkillCompare] = useStateK(null);
  const [sectorFeatured, setSectorFeatured] = useStateK(null);
  const [selected, setSelected] = useStateK(() => ProfileStore.getAll());
  const [authUser, setAuthUser] = useStateK(null);
  const [authReady, setAuthReady] = useStateK(false);
  const [authConfigured, setAuthConfigured] = useStateK(false);
  const [pendingDraft, setPendingDraft] = useStateK(null);
  const [resumed, setResumed] = useStateK(false);
  const [draftGateDone, setDraftGateDone] = useStateK(false);
  const [shareOpen, setShareOpen] = useStateK(false);
  const [paywallOpen, setPaywallOpen] = useStateK(false);
  const [paywallReason, setPaywallReason] = useStateK("free_exhausted");
  const [usageInfo, setUsageInfo] = useStateK(null);
  const [quotaNudge, setQuotaNudge] = useStateK(false);

  const bodyRef = useRefK(null);
  const taRef = useRefK(null);
  const skipDraftSave = useRefK(false);
  const draftTimer = useRefK(null);

  useEffectK(() => {
    let alive = true;
    let off = () => {};
    if (!window.CPAuth) { setAuthReady(true); setAuthConfigured(false); setDraftGateDone(true); return; }
    (async () => {
      await CPAuth.init();
      if (!alive) return;
      setAuthConfigured(!!CPAuth.isConfigured());
      // Index / profil arasinda gezerken oturumu localStorage'dan geri yukle
      const existing = await CPAuth.getUser();
      if (!alive) return;
      setAuthUser(existing);
      if (existing) await CPAuth.ensureProfile(existing);
      if (!alive) return;
      setAuthReady(true);
      off = CPAuth.onAuthStateChange(async (u) => {
        if (!alive) return;
        setAuthUser(u);
        if (u) await CPAuth.ensureProfile(u);
      });
    })();
    return () => { alive = false; off(); };
  }, []);

  useEffectK(() => {
    if (!authReady) return;
    if (!authUser || !window.CPAuth) {
      setPendingDraft(null);
      setDraftGateDone(true);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const d = await CPAuth.fetchActiveChatDraft();
        if (!alive) return;
        const meaningful = d && (
          d.step > 0
          || (Array.isArray(d.answers) && d.answers.some((a) => String(a || "").trim()))
          || d.scenarios_ready
        );
        if (!meaningful) {
          setPendingDraft(null);
          return;
        }
        const wantResume = typeof location !== "undefined"
          && /(?:\?|&)resume=1(?:&|$)/.test(location.search || "");
        if (wantResume) {
          skipDraftSave.current = true;
          hydrateFromDraft(d);
          setResumed(true);
          setPendingDraft(null);
          setTimeout(() => { skipDraftSave.current = false; }, 700);
          try {
            const url = new URL(location.href);
            url.searchParams.delete("resume");
            history.replaceState({}, "", url.pathname + url.search + url.hash);
          } catch (e) { /* ignore */ }
        } else {
          setPendingDraft(d);
        }
      } catch (e) {
        console.warn("[SOHBET] draft fetch:", e.message || e);
        setPendingDraft(null);
      } finally {
        if (alive) setDraftGateDone(true);
      }
    })();
    return () => { alive = false; };
  }, [authReady, authUser]);

  // Kota durumu (banner + yeni tur engeli)
  useEffectK(() => {
    if (!authReady || !authUser || !window.CPAuth || pendingDraft) return;
    let alive = true;
    (async () => {
      try {
        const u = await CPAuth.fetchUsage();
        if (!alive || !u || !u.ok) return;
        setUsageInfo(u);
        // Bos yeni tur + kota yok → paywall (draft yoksa)
        if (!u.allowed && phase === "asking" && step === 0 && !resumed) {
          const hasContent = answers.some((a) => String(a || "").trim());
          if (!hasContent) {
            setPaywallReason(u.reason || "free_exhausted");
            setPaywallOpen(true);
          }
        }
      } catch (e) { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [authReady, authUser, pendingDraft, phase]);

  // Debounced draft upsert (300–500ms)
  useEffectK(() => {
    if (!draftGateDone || pendingDraft || !authUser || !window.CPAuth) return;
    if (skipDraftSave.current) return;
    if (phase !== "asking") return;
    const hasContent = step > 0
      || answers.some((a) => String(a || "").trim())
      || scenariosReady
      || Object.keys(attempts || {}).length > 0;
    if (!hasContent) return;

    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      CPAuth.saveChatDraft({
        sessionId: CPAuth.getSessionId(),
        phase: "asking",
        step,
        locale: lang,
        answers,
        attempts,
        scenarioQuestions: scenarioQs,
        scenariosReady,
      }).catch(() => {});
    }, 400);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [answers, step, phase, attempts, scenarioQs, scenariosReady, draftGateDone, pendingDraft, authUser, lang]);

  function hydrateFromDraft(d) {
    if (!d) return;
    if (d.session_id && window.CPAuth) CPAuth.setSessionId(d.session_id);
    setAnswers(Array.isArray(d.answers) ? d.answers.slice() : []);
    setAttempts(d.attempts && typeof d.attempts === "object" ? d.attempts : {});
    setStep(typeof d.step === "number" ? d.step : 0);
    setPhase("asking");
    setEditingIndex(null);
    setErrorMsg("");
    setRecomputing(false);
    setRecs([]);
    setSkills([]);
    setSkillCompare(null);
    setSectorFeatured(null);
    setInput("");
    const scenarios = Array.isArray(d.scenario_questions) ? d.scenario_questions : [];
    if (scenarios.length) {
      setScenarioQs(scenarios);
      setScenariosReady(true);
      setLoadingScenarios(false);
    } else {
      setScenarioQs([]);
      setScenariosReady(false);
      const profileFilled = (d.answers || []).slice(0, PROFILE_N).filter((a) => String(a || "").trim()).length >= PROFILE_N;
      if (profileFilled && (d.step || 0) >= PROFILE_N) {
        loadScenarios((d.answers || []).slice(0, PROFILE_N));
      }
    }
  }

  async function gateNewTour() {
    if (!window.CPAuth || !authUser) return true;
    try {
      const check = await CPAuth.canStartChat();
      setUsageInfo(check.raw || check);
      if (check.allowed) return true;
      setPaywallReason(check.reason || "free_exhausted");
      setPaywallOpen(true);
      return false;
    } catch (e) {
      return true;
    }
  }

  async function onResumeDraft() {
    if (!pendingDraft) return;
    skipDraftSave.current = true;
    hydrateFromDraft(pendingDraft);
    setPendingDraft(null);
    setResumed(true);
    setTimeout(() => { skipDraftSave.current = false; }, 700);
  }

  async function onAbandonDraft() {
    const ok = await gateNewTour();
    if (!ok) return;
    skipDraftSave.current = true;
    if (window.CPAuth) {
      try { await CPAuth.abandonChatDraft(); } catch (e) { /* ignore */ }
      CPAuth.newSessionId();
    }
    setPendingDraft(null);
    setResumed(false);
    setAnswers([]);
    setStep(0);
    setEditingIndex(null);
    setErrorMsg("");
    setAttempts({});
    setRecomputing(false);
    setRecs([]);
    setSkills([]);
    setSkillCompare(null);
    setSectorFeatured(null);
    setScenarioQs([]);
    setScenariosReady(false);
    setLoadingScenarios(false);
    setMatchedMeslek("");
    setScenarioMatchQuality("");
    setPhase("asking");
    setInput("");
    setTimeout(() => { skipDraftSave.current = false; }, 400);
  }

  const qMeta = (i) => questions[i] || null;
  const questionText = (i) => (questions[i] ? questions[i].q : "");
  const isScenario = (i) => !!(questions[i] && questions[i].type === "scenario");
  const activeIndex = editingIndex !== null ? editingIndex : step;
  const activePlaceholder = (qMeta(activeIndex) && qMeta(activeIndex).placeholder) || S.placeholder;

  // Profil bitince senaryolar henuz gelmediyse tahmini toplam; sonra gercek N
  const progressTotal = scenariosReady
    ? Math.max(N, PROFILE_N)
    : PROFILE_N + EXPECTED_SCENARIOS;
  const progressCurrent = (phase === "result" && editingIndex === null && !recomputing && !loadingScenarios)
    ? progressTotal
    : Math.min(step + (editingIndex !== null ? 0 : 1), progressTotal);

  function pushAttempts(arr, i, prefix) {
    (attempts[i] || []).forEach((att, ai) => {
      arr.push({ key: prefix + "u" + i + "-" + ai, role: "user", content: att.q });
      arr.push({ key: prefix + "a" + i + "-" + ai, role: "assistant", content: att.followupText, isFollowup: true });
    });
  }

  function pushQuestion(arr, i, key, extra) {
    arr.push({
      key,
      role: "assistant",
      content: questionText(i),
      isScenario: isScenario(i),
      yetkinlik: (qMeta(i) && qMeta(i).yetkinlik) || "",
      ...(extra || {}),
    });
  }

  function buildMessages() {
    const arr = [{ key: "greeting", role: "assistant", content: S.greeting }];
    for (let i = 0; i < step; i++) {
      if (editingIndex === i) {
        pushQuestion(arr, i, "editq" + i, { isEditing: true });
        pushAttempts(arr, i, "editatt");
        if (errorMsg) arr.push({ key: "editerr" + i, role: "assistant", content: errorMsg, isError: true });
      } else {
        pushQuestion(arr, i, "q" + i);
        pushAttempts(arr, i, "att");
        arr.push({ key: "a" + i, role: "user", content: answers[i], editableIndex: i });
      }
    }
    if (editingIndex === null) {
      if (loadingScenarios) {
        arr.push({ key: "scintro", role: "assistant", content: S.scenarioIntro });
        arr.push({ key: "loadsc", role: "assistant", content: S.loadingScenarios });
      } else if (recomputing) {
        arr.push({ key: "thinking2", role: "assistant", content: S.thinking });
      } else if (phase === "asking") {
        if (step < N) {
          if (step >= PROFILE_N && scenarioQs.length > 0) {
            arr.push({ key: "scintro", role: "assistant", content: S.scenarioIntro });
          }
          pushQuestion(arr, step, "curq");
          pushAttempts(arr, step, "curatt");
          if (errorMsg) arr.push({ key: "curerr", role: "assistant", content: errorMsg, isError: true });
        } else {
          arr.push({ key: "thinking", role: "assistant", content: S.thinking });
        }
      }
    }
    return arr;
  }
  const msgs = buildMessages();
  const showChatUI = phase === "asking" || editingIndex !== null || recomputing || loadingScenarios;

  useEffectK(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs.length, busy, showChatUI, loadingScenarios]);

  useEffectK(() => {
    if (taRef.current) autosize(taRef.current);
  }, [input]);

  const progressPct = (phase === "result" && editingIndex === null && !recomputing && !loadingScenarios)
    ? 100
    : Math.round((Math.min(step, progressTotal) / progressTotal) * 100);

  function buildCevaplar(arr, qs) {
    const list = qs || questions;
    return list.map((qq, i) => ({
      soru: qq.q,
      key: qq.key,
      type: qq.type || "profile",
      yetkinlik: qq.yetkinlik || "",
      ana_yetkinlik_rubrik: qq.ana_yetkinlik_rubrik || "",
      cevap: arr[i] || "",
    }));
  }

  async function loadScenarios(profileAnswers) {
    setLoadingScenarios(true);
    try {
      const data = await apiSenaryolar(buildCevaplar(profileAnswers, S.questions));
      const qs = Array.isArray(data.questions) ? data.questions : [];
      setScenarioQs(qs);
      setScenariosReady(true);
      setMatchedMeslek((data && data.meslek) || "");
      setScenarioMatchQuality((data && data.match_quality) || "");
      return qs;
    } catch (e) {
      console.error("[SOHBET] scenarios:", e.message);
      setScenarioQs([]);
      setScenariosReady(true);
      setMatchedMeslek("");
      setScenarioMatchQuality("");
      return [];
    } finally {
      setLoadingScenarios(false);
    }
  }

  async function loadSectorFeatured(cevaplar) {
    if (!window.CPAuth) return;
    try {
      let sectorAnswer = "";
      if (Array.isArray(cevaplar)) {
        const hit = cevaplar.find((c) => c && c.key === "hedef_sektor");
        if (hit) sectorAnswer = hit.cevap || hit.answer || "";
      }
      if (!sectorAnswer) {
        const idx = S.questions.findIndex((q) => q.key === "hedef_sektor");
        if (idx >= 0 && answers[idx]) sectorAnswer = answers[idx];
      }
      const pack = await CPAuth.fetchSectorNotesPack({
        answerText: sectorAnswer,
        locale: lang,
        personalize: false,
      });
      const note = pack && pack.notes && pack.notes[0] ? pack.notes[0] : null;
      if (!note) {
        setSectorFeatured(null);
        return;
      }
      setSectorFeatured({
        note: note,
        sector_key: pack.sector_key,
        sector_answer: pack.sector_answer || sectorAnswer,
      });
      // Opsiyonel tek cumle
      let goal = "";
      try { goal = await CPAuth.fetchCareerGoal(); } catch (e) { /* ignore */ }
      const line = await CPAuth.personalizeSectorNote(note, {
        goal: goal,
        sectorAnswer: sectorAnswer,
      });
      if (line) {
        setSectorFeatured((prev) => {
          if (!prev || !prev.note || prev.note.slug !== note.slug) return prev;
          return Object.assign({}, prev, {
            note: Object.assign({}, prev.note, { personal_line: line }),
          });
        });
      }
    } catch (e) {
      console.warn("[SOHBET] sector notes:", e.message || e);
      setSectorFeatured(null);
    }
  }

  async function runRecommend(finalAnswers, qs) {
    const sidBefore = window.CPAuth ? CPAuth.getSessionId() : null;
    try {
      const cevaplar = buildCevaplar(finalAnswers, qs || questions);
      const data = await apiOner(cevaplar);
      const nextRecs = Array.isArray(data.recommendations) ? data.recommendations : [];
      const nextSkills = Array.isArray(data.yetkinlikler) ? data.yetkinlikler : [];
      setRecs(nextRecs);
      setSkills(nextSkills);
      const persisted = await persistResults(nextRecs, nextSkills, cevaplar);
      setSkillCompare((persisted && persisted.comparison) || null);
      loadSectorFeatured(cevaplar);
      // Kota: sonuc basariyla uretildiginde (ayni session ikinci kez sayilmaz)
      if (window.CPAuth && (nextSkills.length || nextRecs.length)) {
        try {
          const rec = await CPAuth.recordChatCompletion(sidBefore);
          if (rec && rec.ok) {
            setUsageInfo(rec);
            if (rec.plan === "free" || (rec.free_chats_used >= (rec.free_limit || 1) && rec.plan !== "plus")) {
              setQuotaNudge(true);
            }
          }
        } catch (err) {
          console.warn("[SOHBET] recordChatCompletion:", err.message || err);
        }
      }
    } catch (e) {
      console.error("[SOHBET] recommend:", e.message);
      setRecs([]);
      setSkills([]);
      setSkillCompare(null);
      setSectorFeatured(null);
    } finally {
      setPhase("result");
      setResumed(false);
      setPendingDraft(null);
      if (window.CPAuth) {
        try { await CPAuth.completeChatDraft(); } catch (err) { /* ignore */ }
      }
    }
  }

  async function advanceAfterAnswer(newAnswers, idx) {
    if (editingIndex !== null) {
      setEditingIndex(null);
      if (phase === "result") {
        setRecomputing(true);
        await runRecommend(newAnswers, S.questions.concat(scenarioQs));
        setRecomputing(false);
      }
      return;
    }

    const nextStep = idx + 1;

    // Profil sorulari bitti → RAG senaryolarini yukle
    if (nextStep === PROFILE_N && !scenariosReady) {
      setStep(nextStep);
      const qs = await loadScenarios(newAnswers);
      if (!qs.length) {
        await runRecommend(newAnswers, S.questions);
      }
      return;
    }

    setStep(nextStep);
    const total = PROFILE_N + scenarioQs.length;
    if (scenariosReady && nextStep >= total) {
      await runRecommend(newAnswers, S.questions.concat(scenarioQs));
    }
  }

  async function submit(text) {
    if (!authUser) return;
    const q = (text ?? input).trim();
    if (!q || busy || loadingScenarios) return;
    const idx = editingIndex !== null ? editingIndex : step;
    if (idx >= N) return;

    // Yeni tur basinda kota yoksa engelle (draft devaminda veya duzenlemede degil)
    if (
      editingIndex === null
      && step === 0
      && !(answers[0] && String(answers[0]).trim())
      && window.CPAuth
    ) {
      const ok = await gateNewTour();
      if (!ok) return;
    }

    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    setBusy(true);
    setErrorMsg("");

    try {
      const meta = qMeta(idx) || {};
      const prevAttempts = (attempts[idx] || []).length;

      // Bir takipten sonra zorunlu kabul (sonsuz donguyu kes)
      let sufficient = prevAttempts >= MAX_FOLLOWUPS;
      let followupText = "";

      if (!sufficient) {
        const ev = await apiDegerlendir(questionText(idx), q, meta, prevAttempts);
        sufficient = !(ev && ev.sufficient === false);
        followupText = (ev && ev.followup) || questionText(idx);
      }

      if (!sufficient) {
        setAttempts((prev) => {
          const list = prev[idx] ? prev[idx].slice() : [];
          list.push({ q, followupText });
          return { ...prev, [idx]: list };
        });
      } else {
        const newAnswers = answers.slice();
        newAnswers[idx] = q;
        setAnswers(newAnswers);
        await persistAnswer(meta, q);
        await advanceAfterAnswer(newAnswers, idx);
      }
    } catch (e) {
      console.error("[SOHBET] evaluate:", e.message);
      setInput(q);
      setErrorMsg(S.error);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(i) {
    if (busy || loadingScenarios || i < 0 || i >= step) return;
    setEditingIndex(i);
    setErrorMsg("");
    setAttempts((prev) => {
      if (!prev[i]) return prev;
      const next = { ...prev };
      delete next[i];
      return next;
    });
    setInput(answers[i] || "");
  }

  function cancelEdit() {
    if (busy) return;
    setEditingIndex(null);
    setErrorMsg("");
    setInput("");
  }

  function goBack() {
    if (busy || loadingScenarios || step <= 0) return;
    startEdit(step - 1);
  }

  function onAdd(rec) {
    const id = rec.link || rec.ad;
    ProfileStore.add({ id, ad: rec.ad, kurum: rec.kurum, link: rec.link, sure: rec.sure });
    setSelected(ProfileStore.getAll());
    if (window.CPAuth) {
      CPAuth.saveRecommendations([{
        training_id: id,
        training_name: rec.ad,
        link: rec.link || "",
        status: "devam_ediyor",
      }]);
    }
  }
  function onRemove(id) {
    ProfileStore.remove(id);
    setSelected(ProfileStore.getAll());
  }

  async function loginGoogle() {
    try {
      sessionStorage.setItem("cp_auth_next", "kariyer%20sohbet.html");
      await CPAuth.signInWithGoogle(location.origin + "/auth-callback.html");
    } catch (e) {
      alert((S.auth && S.auth.error) || e.message);
    }
  }
  async function logout() {
    if (window.CPAuth) await CPAuth.signOut();
  }

  async function restart() {
    const ok = await gateNewTour();
    if (!ok) return;
    skipDraftSave.current = true;
    if (window.CPAuth) {
      try { await CPAuth.abandonChatDraft(); } catch (e) { /* ignore */ }
      CPAuth.newSessionId();
    }
    setAnswers([]);
    setStep(0);
    setEditingIndex(null);
    setErrorMsg("");
    setAttempts({});
    setRecomputing(false);
    setRecs([]);
    setSkills([]);
    setSkillCompare(null);
    setSectorFeatured(null);
    setScenarioQs([]);
    setScenariosReady(false);
    setLoadingScenarios(false);
    setMatchedMeslek("");
    setScenarioMatchQuality("");
    setPhase("asking");
    setInput("");
    setPendingDraft(null);
    setResumed(false);
    setQuotaNudge(false);
    setPaywallOpen(false);
    setTimeout(() => { skipDraftSave.current = false; }, 400);
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }
  function autosize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

  const isEditing = editingIndex !== null;
  const backDisabled = busy || loadingScenarios || (isEditing ? false : step === 0);
  const displayProgress = isEditing
    ? S.editingBadge(editingIndex + 1, progressTotal)
    : (showChatUI ? S.progress(Math.min(progressCurrent, progressTotal), progressTotal) : `${progressTotal} / ${progressTotal}`);

  const authLabel = authUser
    ? ((authUser.user_metadata && (authUser.user_metadata.full_name || authUser.user_metadata.name)) || authUser.email || "")
    : "";
  const A = S.auth || {};
  const D = S.draft || {};
  const P = S.paywall || {};
  const gateBlocked = !authReady || !authUser;
  const waitingDraftChoice = !!pendingDraft;
  const draftChecking = !!authUser && !draftGateDone;
  const showFreeBanner = !!(
    authUser
    && usageInfo
    && usageInfo.plan === "free"
    && (Number(usageInfo.free_chats_used) || 0) < (usageInfo.free_limit || 1)
    && phase === "asking"
    && !waitingDraftChoice
  );

  const draftBannerStep = pendingDraft
    ? Math.min((pendingDraft.step || 0) + 1, Math.max(
      pendingDraft.scenarios_ready
        ? PROFILE_N + (pendingDraft.scenario_questions || []).length
        : PROFILE_N + EXPECTED_SCENARIOS,
      1
    ))
    : 0;
  const draftBannerTotal = pendingDraft
    ? (pendingDraft.scenarios_ready
      ? Math.max(PROFILE_N + (pendingDraft.scenario_questions || []).length, PROFILE_N)
      : PROFILE_N + EXPECTED_SCENARIOS)
    : progressTotal;

  return (
    <div className="cs-page">
      <div className="cs-top">
        <a href="index.html" aria-label={S.brand} style={{ display: "inline-flex" }}><LogoK /></a>
        <div className="cs-auth">
          <a className="cs-auth-link" href="profil.html">{A.profile || "Profil"}</a>
          {authReady && authUser ? (
            <React.Fragment>
              <span className="cs-auth-name" title={authUser.email || ""}>{authLabel}</span>
              <button type="button" className="cs-auth-btn ghost" onClick={logout}>
                {A.logout || "Çıkış"}
              </button>
            </React.Fragment>
          ) : (
            <button type="button" className="cs-auth-btn" onClick={loginGoogle} disabled={!authReady || !authConfigured}>
              {A.login || "Gmail ile giriş"}
            </button>
          )}
        </div>
      </div>

      {gateBlocked ? (
        <div className="cs-shell">
          <div className="cs-gate">
            {!authReady ? (
              <p className="cs-gate-muted">{A.loading || "…"}</p>
            ) : !authConfigured ? (
              <React.Fragment>
                <h2>{A.requiredTitle}</h2>
                <p>{A.notConfigured}</p>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <h2>{A.requiredTitle}</h2>
                <p>{A.requiredBody}</p>
                <button type="button" className="cs-auth-btn cs-gate-btn" onClick={loginGoogle}>
                  {A.login || "Gmail ile giriş"}
                </button>
              </React.Fragment>
            )}
          </div>
        </div>
      ) : (
      <div className="cs-shell">
        {waitingDraftChoice ? (
          <div className="cs-draft-banner" role="region" aria-label={D.resume || "Draft"}>
            <p className="cs-draft-text">
              {typeof D.banner === "function"
                ? D.banner(draftBannerStep, draftBannerTotal)
                : (D.banner || "")}
            </p>
            <div className="cs-draft-actions">
              <button type="button" className="cs-draft-btn primary" onClick={onResumeDraft}>
                {D.resume || "Devam et"}
              </button>
              <button type="button" className="cs-draft-btn" onClick={onAbandonDraft}>
                {D.restart || "Baştan başla"}
              </button>
            </div>
          </div>
        ) : null}

        {showFreeBanner ? (
          <div className="cs-quota-banner" role="status">
            {P.freeBanner || "Bir ücretsiz sohbet hakkın var."}
          </div>
        ) : null}

        <div className="cs-head">
          {isEditing ? (
            <button className="cs-back" onClick={cancelEdit} disabled={busy || waitingDraftChoice}>
              <IcK name="close" size={16} /> {S.cancelEdit}
            </button>
          ) : (
            <button className="cs-back" onClick={goBack} disabled={backDisabled || waitingDraftChoice}>
              <IcK name="back" size={16} /> {S.back}
            </button>
          )}
          <div className="cs-title">
            {S.headerTitle}
            {resumed && !waitingDraftChoice ? (
              <span className="cs-resumed-chip">{D.resumedChip || ""}</span>
            ) : null}
            {matchedMeslek && scenariosReady && phase === "asking" ? (
              <span className="cs-meslek-chip" title={scenarioMatchQuality || ""}>
                {matchedMeslek}
              </span>
            ) : null}
          </div>
          <div className="cs-progress">{displayProgress}</div>
        </div>

        <div className="cs-progress-track">
          <div className="cs-progress-fill" style={{ width: (waitingDraftChoice ? 0 : progressPct) + "%" }}></div>
        </div>

        {draftChecking ? (
          <div className="cs-draft-wait">
            <p className="cs-gate-muted">{(S.auth && S.auth.loading) || "…"}</p>
          </div>
        ) : waitingDraftChoice ? (
          <div className="cs-draft-wait">
            <p>{S.greeting}</p>
          </div>
        ) : showChatUI ? (
          <React.Fragment>
            <div className="cs-body" ref={bodyRef}>
              {msgs.map((m) => (
                <div className={"cs-msg-group " + m.role} key={m.key}>
                  {m.isFollowup && <div className="cs-followup-tag">{S.followupTag}</div>}
                  {m.isScenario && !m.isFollowup && (
                    <div className="cs-scenario-tag">
                      {S.scenarioTag}{m.yetkinlik ? ` · ${m.yetkinlik}` : ""}
                    </div>
                  )}
                  <div className={"cs-msg " + m.role + (m.isEditing ? " cs-editing" : "") + (m.isFollowup ? " cs-followup" : "") + (m.isError ? " cs-error" : "") + (m.isScenario ? " cs-scenario" : "")}>
                    <div className="cs-bubble">{m.content}</div>
                    {m.role === "user" && typeof m.editableIndex === "number" && !isEditing && !busy && (
                      <button
                        type="button"
                        className="cs-edit-btn"
                        onClick={() => startEdit(m.editableIndex)}
                        aria-label={S.editAnswer}
                        title={S.editAnswer}
                      >
                        <IcK name="edit" size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {(busy || loadingScenarios) && (
                <div className="cs-msg assistant">
                  <div className="cs-bubble"><span className="cs-typing"><i></i><i></i><i></i></span></div>
                </div>
              )}
            </div>

            <div className="cs-inputbar">
              <div className="cs-inputrow">
                <textarea
                  ref={taRef}
                  rows={1}
                  value={input}
                  placeholder={activePlaceholder}
                  disabled={busy || loadingScenarios}
                  onChange={(e) => { setInput(e.target.value); autosize(e.target); }}
                  onKeyDown={onKey}
                />
                <button className="cs-send" onClick={() => submit()} disabled={busy || loadingScenarios || !input.trim()} aria-label="Send">
                  <IcK name="send" size={18} />
                </button>
              </div>
            </div>
          </React.Fragment>
        ) : (
          <div className="cs-result">
            <div className="cs-result-head">
              <h2>{S.result.title}</h2>
              <p>{S.result.sub}</p>
            </div>

            {quotaNudge ? (
              <div className="cs-quota-nudge" role="status">
                <p>{P.afterResult || "Profilin kaydedildi. Ekstra tur için Career Pick Plus."}</p>
                <a className="cs-quota-nudge-link" href="fiyatlandirma.html">{P.cta || "Plus’a geç"}</a>
              </div>
            ) : null}

            <div className="cs-share-row">
              <button type="button" className="cs-auth-btn" onClick={() => setShareOpen(true)}>
                {(S.result && S.result.shareCardBtn) || "Özet kartı"}
              </button>
            </div>

            {typeof CPShareCardModal === "function" ? (
              <CPShareCardModal
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                locale={lang}
                labels={(S.result && S.result.shareCard) || {}}
                skills={skills}
              />
            ) : null}

            {skills.length > 0 && (
              <div className="cs-skills">
                {skillCompare && skillCompare.isFirst ? (
                  <div className="cs-compare cs-compare-first">
                    <h3>{S.result.compareTitle}</h3>
                    <p className="cs-skills-hint">{S.result.compareFirst}</p>
                  </div>
                ) : null}
                {skillCompare && skillCompare.hasComparison ? (
                  <div className="cs-compare">
                    <h3>{S.result.compareTitle}</h3>
                    <p className="cs-skills-hint">{S.result.compareHint}</p>
                    {skillCompare.summaryLine ? (
                      <p className="cs-compare-summary">{skillCompare.summaryLine}</p>
                    ) : null}
                    <ul className="cs-compare-list">
                      {skillCompare.rows.map((row, i) => {
                        const name = labelYetkinlik(row.yetkinlik, skills);
                        const deltaTxt = row.delta == null
                          ? ""
                          : (row.delta > 0 ? "+" : "") + row.delta;
                        let note = "";
                        if (row.status === "improved") note = S.result.compareUp;
                        else if (row.status === "declined") note = S.result.compareDown;
                        else if (row.status === "unchanged") note = S.result.compareSame;
                        else if (row.status === "new") note = S.result.compareNew;
                        else note = S.result.compareUnmatched;
                        return (
                          <li className={"cs-compare-item " + row.status} key={i}>
                            <div className="cs-compare-name">{name}</div>
                            <div className="cs-compare-scores">
                              {row.previous != null ? (
                                <span>{S.result.comparePrev}: {row.previous}</span>
                              ) : (
                                <span>{S.result.comparePrev}: —</span>
                              )}
                              <span>{S.result.compareNow}: {row.current != null ? row.current : "—"}</span>
                              {row.delta != null ? (
                                <span className={"cs-compare-delta " + row.status}>{deltaTxt}</span>
                              ) : null}
                            </div>
                            <div className="cs-compare-note">{note}</div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                <h3>{S.result.skillsTitle}</h3>
                <p className="cs-skills-hint">{S.result.skillsHint}</p>
                <ul className="cs-skills-list">
                  {skills.map((sk, i) => {
                    const strong = sk.seviye === "guclu";
                    return (
                      <li className={"cs-skill-item " + (strong ? "strong" : "develop")} key={i}>
                        <div className="cs-skill-top">
                          <span className="cs-skill-name">{sk.yetkinlik}</span>
                          <span className="cs-skill-badge">{strong ? S.result.skillStrong : S.result.skillDevelop}</span>
                        </div>
                        <div className="cs-skill-score">{S.result.skillScore(sk.puan, 5)}</div>
                        {sk.yorum ? <div className="cs-skill-note">{sk.yorum}</div> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {sectorFeatured && sectorFeatured.note ? (
              <div className="cs-sector-note">
                <div className="cs-sector-note-head">
                  <h3>{S.result.sectorNoteTitle}</h3>
                  <a className="cs-sector-all" href="profil.html#sektor-notlari">{S.result.sectorNoteAll}</a>
                </div>
                <p className="cs-skills-hint">{S.result.sectorNoteHint}</p>
                <article className="cs-sector-card">
                  <h4>{sectorFeatured.note.title}</h4>
                  <p>{sectorFeatured.note.body}</p>
                  {sectorFeatured.note.personal_line ? (
                    <p className="cs-sector-personal">{sectorFeatured.note.personal_line}</p>
                  ) : null}
                  <a
                    className="cs-sector-cta"
                    href={(window.CPAuth && CPAuth.sectorCtaHref(sectorFeatured.note.cta_type)) || "profil.html#sektor-notlari"}
                  >
                    {(S.result.sectorCta && S.result.sectorCta[sectorFeatured.note.cta_type])
                      || sectorFeatured.note.cta_type}
                  </a>
                </article>
              </div>
            ) : null}

            {recs.length === 0 ? (
              <p className="cs-profile-empty" style={{ textAlign: "center" }}>{S.result.empty}</p>
            ) : (
              <div className="cs-cards">
                {recs.map((r, i) => {
                  const id = r.link || r.ad;
                  const added = selected.some((x) => x.id === id);
                  return (
                    <div className="cs-card" key={i}>
                      <h3>{r.ad}</h3>
                      {r.kurum ? <div className="cs-card-kurum">{r.kurum}</div> : null}
                      {r.aciklama ? <p className="cs-card-desc">{r.aciklama}</p> : null}
                      {r.sure ? <div className="cs-card-meta"><span>{S.result.duration}: {r.sure}</span></div> : null}
                      {r.gerekce ? <div className="cs-card-reason"><strong>{S.result.reason}:</strong> {r.gerekce}</div> : null}
                      <button className="cs-add" disabled={added} onClick={() => onAdd(r)}>
                        <IcK name={added ? "check" : "plus"} size={15} /> {added ? S.result.added : S.result.add}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="cs-answers-review">
              <h3>{S.result.answersTitle}</h3>
              <p className="cs-answers-hint">{S.result.answersHint}</p>
              <ul className="cs-answers-list">
                {questions.map((qq, i) => (
                  <li className="cs-answer-item" key={qq.key || i}>
                    <div className="cs-answer-text">
                      {qq.type === "scenario" && (
                        <div className="cs-answer-skill">{S.scenarioTag}{qq.yetkinlik ? ` · ${qq.yetkinlik}` : ""}</div>
                      )}
                      <div className="cs-answer-q">{qq.q}</div>
                      <div className="cs-answer-a">{answers[i]}</div>
                    </div>
                    <button
                      type="button"
                      className="cs-edit-btn cs-edit-btn-inline"
                      onClick={() => startEdit(i)}
                      disabled={busy}
                      aria-label={S.editAnswer}
                      title={S.editAnswer}
                    >
                      <IcK name="edit" size={13} /> {S.editAnswer}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="cs-actions">
              <button className="cs-restart" onClick={restart}>{S.result.restart}</button>
            </div>

            <div className="cs-profile">
              <h3>{S.result.profileTitle}</h3>
              {selected.length === 0 ? (
                <p className="cs-profile-empty">{S.result.profileEmpty}</p>
              ) : (
                <ul className="cs-profile-list">
                  {selected.map((s) => (
                    <li className="cs-profile-item" key={s.id}>
                      <span>{s.link ? <a href={s.link} target="_blank" rel="noopener noreferrer">{s.ad}</a> : s.ad}</span>
                      <button onClick={() => onRemove(s.id)}>{S.result.remove}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
      )}
      {typeof CPPaywallModal === "function" ? (
        <CPPaywallModal
          open={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          reason={paywallReason}
          labels={P}
        />
      ) : null}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<KariyerSohbet />);
