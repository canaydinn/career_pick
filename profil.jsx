/* global React, ReactDOM, CP_PROFIL, CPAuth, CPIcon, CPLogo, CPShareCardModal */
const { useState, useEffect } = React;

const PF_PAGES = ["bugun", "yol", "pratik", "kesfet"];

const PF_HREF = {
  bugun: "profil.html",
  yol: "yol-haritam.html",
  pratik: "pratikler.html",
  kesfet: "kesfet.html",
};

function pageFromBody() {
  try {
    const id = String(
      (typeof document !== "undefined" && document.body && document.body.dataset.pfPage) || ""
    ).toLowerCase();
    if (PF_PAGES.indexOf(id) >= 0) return id;
  } catch (e) { /* ignore */ }
  return "bugun";
}

/** Legacy profil.html#… → real pages (run once, before React). */
function redirectLegacyProfilHash() {
  try {
    if (pageFromBody() !== "bugun") return;
    const path = String((location.pathname || "").split("/").pop() || "").toLowerCase();
    if (path && path !== "profil.html" && path !== "" && path !== "profil") return;

    const h = String(location.hash || "").replace(/^#/, "").toLowerCase();
    if (!h || h === "bugun") return;

    let target = "";
    let keepHash = "";
    if (h === "yol") {
      target = PF_HREF.yol;
    } else if (h === "pratik" || h === "check-in" || h === "pratiker") {
      target = PF_HREF.pratik;
      if (h === "check-in") keepHash = "#check-in";
      else if (h === "pratiker") keepHash = "#pratiker";
    } else if (h === "kesfet" || h === "sektor-notlari") {
      target = PF_HREF.kesfet;
      if (h === "sektor-notlari") keepHash = "#sektor-notlari";
    }
    if (target) {
      location.replace(target + (location.search || "") + keepHash);
    }
  } catch (e) { /* ignore */ }
}

redirectLegacyProfilHash();

function statusClass(status) {
  if (status === "tamamlandi") return "done";
  if (status === "devam_ediyor") return "progress";
  return "missing";
}

function stepStatusClass(status) {
  if (status === "bitti") return "done";
  if (status === "aktif") return "active";
  return "waiting";
}

function formatDate(iso, lang) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch (e) {
    return "";
  }
}

function TrainingCard({ t, S, lang, busy, onStart, onComplete, openLink, resolveLink }) {
  const pct = CPAuth.statusProgress(t.status);
  return (
    <li className={"pf-item " + statusClass(t.status)}>
      <div className="pf-item-top">
        <h3>{t.training_name}</h3>
        <span className={"pf-badge " + statusClass(t.status)}>
          {S.status[t.status] || t.status}
        </span>
      </div>
      <div className="pf-bar"><div className="pf-bar-fill" style={{ width: pct + "%" }} /></div>
      <div className="pf-item-meta">
        {t.started_at ? <span>{S.startedAt}: {formatDate(t.started_at, lang)}</span> : null}
        {t.completed_at ? <span>{S.completedAt}: {formatDate(t.completed_at, lang)}</span> : null}
      </div>
      <div className="pf-item-actions">
        <button type="button" className="primary" disabled={busy || !resolveLink(t)} onClick={() => openLink(t)}>
          {S.openTraining}
        </button>
        <button type="button" disabled={busy || t.status === "devam_ediyor"} onClick={() => onStart(t.id)}>
          {S.markStarted}
        </button>
        <button type="button" disabled={busy || t.status === "tamamlandi"} onClick={() => onComplete(t.id)}>
          {S.markCompleted}
        </button>
      </div>
    </li>
  );
}

function ProfilPage() {
  const lang = (typeof localStorage !== "undefined" && localStorage.getItem("cp_lang")) === "en" ? "en" : "tr";
  const S = CP_PROFIL[lang];
  const page = pageFromBody();

  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [trainings, setTrainings] = useState([]);
  const [roadmap, setRoadmap] = useState([]);
  const [goal, setGoal] = useState("");
  const [skillSummary, setSkillSummary] = useState(null);
  const [microTasks, setMicroTasks] = useState([]);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [sectorPack, setSectorPack] = useState(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [weekCheckin, setWeekCheckin] = useState(null);
  const [checkinHistory, setCheckinHistory] = useState([]);
  const [checkinEditing, setCheckinEditing] = useState(false);
  const [checkinQ1, setCheckinQ1] = useState("");
  const [checkinQ2, setCheckinQ2] = useState("");
  const [checkinChoice, setCheckinChoice] = useState("");
  const [checkinHistoryOpen, setCheckinHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [planInfo, setPlanInfo] = useState(null);
  const [billingMsg, setBillingMsg] = useState("");
  const [mevcutRolDraft, setMevcutRolDraft] = useState("");
  const [yataySuggestions, setYataySuggestions] = useState([]);
  const [yatayBusy, setYatayBusy] = useState(false);

  async function loadYatayGecis(rol) {
    const text = String(rol || "").trim();
    if (text.length < 2) {
      setYataySuggestions([]);
      return;
    }
    setYatayBusy(true);
    try {
      const res = await CPAuth.fetchYatayGecis(text);
      setYataySuggestions((res && res.suggestions) || []);
    } catch (e) {
      setYataySuggestions([]);
    } finally {
      setYatayBusy(false);
    }
  }

  async function loadPlan() {
    const needBugun = page === "bugun";
    const needYol = page === "yol";
    const needPratik = page === "pratik";
    const needKesfet = page === "kesfet";

    const jobs = [];
    const keys = [];

    function add(key, promise) {
      keys.push(key);
      jobs.push(promise);
    }

    if (needBugun || needYol) {
      add("trainings", CPAuth.fetchTrainings());
      add("roadmap", CPAuth.fetchActiveRoadmap());
    }
    if (needBugun || needKesfet) {
      add("goal", CPAuth.fetchCareerGoal());
    }
    if (needBugun) {
      add("draft", CPAuth.fetchActiveChatDraft());
      add("micros", CPAuth.fetchWeekMicroTasks());
      add("checkin", CPAuth.fetchWeekCheckin());
      add("snaps", CPAuth.fetchLastSnapshots(1));
    }
    add("usage", CPAuth.fetchUsage().catch(() => null));
    if (needYol) {
      add("cmp", CPAuth.fetchCompetencyComparisonSummary());
    }
    if (needPratik) {
      add("micros", CPAuth.fetchWeekMicroTasks());
      add("snaps", CPAuth.fetchLastSnapshots(1));
      add("checkin", CPAuth.fetchWeekCheckin());
      add("history", CPAuth.fetchCheckinHistory(6));
      add("goal", CPAuth.fetchCareerGoal());
    }
    if (needKesfet) {
      add("pack", CPAuth.fetchSectorNotesPack({ locale: lang, personalize: false }));
    }

    const results = await Promise.all(jobs);
    const by = {};
    keys.forEach((k, i) => { by[k] = results[i]; });

    if (by.trainings !== undefined) setTrainings(by.trainings || []);
    if (by.roadmap !== undefined) setRoadmap(by.roadmap || []);
    if (by.goal !== undefined) setGoal(by.goal || "");
    if (by.cmp !== undefined) setSkillSummary(by.cmp || null);
    if (by.micros !== undefined) setMicroTasks(by.micros || []);
    if (by.snaps !== undefined) setHasSnapshot(!!(by.snaps && by.snaps.length));
    if (by.draft !== undefined) setHasDraft(!!by.draft);
    if (by.usage !== undefined && by.usage && by.usage.ok) setPlanInfo(by.usage);

    if (by.checkin !== undefined) {
      const checkin = by.checkin || null;
      setWeekCheckin(checkin);
      if (needPratik) {
        setCheckinEditing(!checkin);
        setCheckinQ1(checkin ? (checkin.q1_text || "") : "");
        setCheckinQ2(checkin ? (checkin.q2_text || "") : "");
        setCheckinChoice(checkin ? (checkin.q2_choice || "") : "");
      }
    }
    if (by.history !== undefined) setCheckinHistory(by.history || []);

    const pack = by.pack;
    if (pack !== undefined) {
      setSectorPack(pack || null);
      if (pack && pack.notes && pack.notes.length) {
        const goalText = by.goal || goal || "";
        const sectorAnswer = pack.sector_answer || "";
        Promise.all(
          pack.notes.map(async (n) => {
            const line = await CPAuth.personalizeSectorNote(n, {
              goal: goalText,
              sectorAnswer: sectorAnswer,
            });
            return line ? Object.assign({}, n, { personal_line: line }) : n;
          })
        ).then((enriched) => {
          setSectorPack((prev) => {
            if (!prev || prev.sector_key !== pack.sector_key) return prev;
            return Object.assign({}, prev, { notes: enriched });
          });
        }).catch(() => {});
      }
    }
  }

  useEffect(() => {
    let alive = true;
    let off = () => {};

    async function applyUser(u) {
      if (!alive) return;
      setUser(u);
      if (u) {
        const p = await CPAuth.ensureProfile(u);
        if (!alive) return;
        const resolved = p || (await CPAuth.fetchProfile());
        if (!alive) return;
        setProfile(resolved);
        const rol = (resolved && resolved.mevcut_rol) || "";
        setMevcutRolDraft(rol);
        await loadPlan();
        if (!alive) return;
        if (page === "kesfet") await loadYatayGecis(rol);
      } else {
        setProfile(null);
        setTrainings([]);
        setRoadmap([]);
        setGoal("");
        setSkillSummary(null);
        setMicroTasks([]);
        setHasSnapshot(false);
        setSectorPack(null);
        setMevcutRolDraft("");
        setYataySuggestions([]);
        setHasDraft(false);
        setWeekCheckin(null);
        setCheckinHistory([]);
        setCheckinEditing(false);
        setCheckinQ1("");
        setCheckinQ2("");
        setCheckinChoice("");
        setPlanInfo(null);
      }
    }

    (async () => {
      await CPAuth.init();
      if (!alive) return;
      setConfigured(CPAuth.isConfigured());
      const existing = await CPAuth.getUser();
      if (!alive) return;
      await applyUser(existing);
      setReady(true);
      off = CPAuth.onAuthStateChange((u) => { applyUser(u); });
    })();

    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    if (typeof CPAuth.logProductEvent === "function") {
      CPAuth.logProductEvent("page_view", page, { path: PF_HREF[page] || "" }).catch(() => {});
    }
  }, [ready, user, page]);

  useEffect(() => {
    if (!ready || !user) return;
    if (page === "pratik") {
      const hash = String((typeof location !== "undefined" && location.hash) || "");
      if (hash === "#check-in") {
        setCheckinEditing(true);
        setTimeout(() => {
          const el = document.getElementById("check-in");
          if (el) {
            try { el.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { /* ignore */ }
          }
        }, 50);
      } else if (hash === "#pratiker") {
        setTimeout(() => {
          const el = document.getElementById("pratiker");
          if (el) {
            try { el.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { /* ignore */ }
          }
        }, 50);
      }
    }
    if (page === "kesfet" && location.hash === "#sektor-notlari") {
      setTimeout(() => {
        const el = document.getElementById("sektor-notlari");
        if (el) {
          try { el.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { /* ignore */ }
        }
      }, 50);
    }
    try {
      const p = new URLSearchParams(location.search || "");
      if (p.get("billing") === "plus") {
        setBillingMsg(S.billingPlusOk || "Career Pick Plus aktif.");
        p.delete("billing");
        const q = p.toString();
        history.replaceState({}, "", location.pathname + (q ? "?" + q : "") + location.hash);
        loadPlan();
      }
    } catch (e) { /* ignore */ }
  }, [ready, user]);

  useEffect(() => {
    try {
      const titles = (S.pageTitle && S.pageTitle[page]) || "";
      if (titles) document.title = titles + " — Career Pick";
    } catch (e) { /* ignore */ }
  }, [page, lang]);

  async function onCancelPlus() {
    if (!window.confirm(S.cancelConfirm || "Plus aboneliğini iptal etmek istiyor musun?")) return;
    setBusy(true);
    setBillingMsg("");
    const res = await CPAuth.cancelSubscription();
    setBusy(false);
    if (res && res.ok) {
      setBillingMsg(S.cancelDone || "Abonelik iptal edildi.");
      await loadPlan();
      const p = await CPAuth.fetchProfile();
      if (p) setProfile(p);
    } else {
      setBillingMsg((res && (res.message || res.error)) || S.cancelFail || "İptal başarısız.");
    }
  }

  async function onSaveMevcutRol() {
    setBusy(true);
    const res = await CPAuth.saveMevcutRol(mevcutRolDraft);
    if (res && res.ok) {
      if (res.profile) setProfile(res.profile);
      await loadYatayGecis(res.mevcut_rol || mevcutRolDraft);
    } else {
      setYataySuggestions([]);
    }
    setBusy(false);
  }

  async function login() {
    try {
      const next = PF_HREF[page] || "profil.html";
      sessionStorage.setItem("cp_auth_next", next);
      await CPAuth.signInWithGoogle(location.origin + "/auth-callback.html");
    } catch (e) {
      alert(e.message || S.notConfigured);
    }
  }

  async function logout() {
    await CPAuth.signOut();
  }

  async function onStart(id) {
    setBusy(true);
    await CPAuth.markTrainingStarted(id);
    await loadPlan();
    setBusy(false);
  }

  async function onComplete(id) {
    setBusy(true);
    await CPAuth.markTrainingCompleted(id);
    await loadPlan();
    setBusy(false);
  }

  async function onMicroDone(id) {
    setBusy(true);
    await CPAuth.markMicroTaskDone(id);
    await loadPlan();
    setBusy(false);
  }

  async function onSaveCheckin() {
    const q1 = (checkinQ1 || "").trim();
    if (!q1) {
      alert(S.checkinNeedQ1);
      return;
    }
    setBusy(true);
    const source = (typeof location !== "undefined" && location.hash === "#check-in")
      ? "email_link"
      : "profile";
    const res = await CPAuth.saveWeekCheckin({
      q1: q1,
      q2: checkinQ2,
      q2_choice: checkinChoice || null,
      source: source,
      goal: goal,
      reflect: true,
    });
    if (res && res.ok) {
      setWeekCheckin(res.checkin || null);
      setCheckinEditing(false);
      const hist = await CPAuth.fetchCheckinHistory(6);
      setCheckinHistory(hist || []);
    }
    setBusy(false);
  }

  function startEditCheckin() {
    setCheckinQ1(weekCheckin ? (weekCheckin.q1_text || "") : "");
    setCheckinQ2(weekCheckin ? (weekCheckin.q2_text || "") : "");
    setCheckinChoice(weekCheckin ? (weekCheckin.q2_choice || "") : "");
    setCheckinEditing(true);
  }

  function cancelEditCheckin() {
    if (weekCheckin) {
      setCheckinEditing(false);
      setCheckinQ1(weekCheckin.q1_text || "");
      setCheckinQ2(weekCheckin.q2_text || "");
      setCheckinChoice(weekCheckin.q2_choice || "");
    }
  }

  function formatWeekStart(ws) {
    if (!ws) return "";
    try {
      return new Date(ws + "T12:00:00").toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      return ws;
    }
  }

  async function toggleReminders() {
    if (!profile) return;
    setBusy(true);
    const next = !profile.email_reminders_opt_in;
    const res = await CPAuth.setEmailRemindersOptIn(next);
    if (res.ok && res.profile) setProfile(res.profile);
    else {
      const p = await CPAuth.fetchProfile();
      if (p) setProfile(p);
    }
    setBusy(false);
  }

  function resolveLink(t) {
    const direct = (t.link || "").trim();
    if (direct) return direct;
    const id = (t.training_id || "").trim();
    if (/^https?:\/\//i.test(id)) return id;
    return "";
  }

  function openLink(t) {
    const href = resolveLink(t);
    if (!href) {
      alert(S.noLink);
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  }

  const overall = CPAuth.overallProgress(trainings);
  const week = CPAuth.getWeekActions(trainings, roadmap);
  const stepInfo = CPAuth.stepProgressLabel(roadmap);
  const name = (profile && profile.display_name) || (user && user.email) || "";
  const remindersOn = !!(profile && profile.email_reminders_opt_in);

  const stepIds = new Set(roadmap.map((s) => s.id));
  const trainingsByStep = {};
  roadmap.forEach((s) => { trainingsByStep[s.id] = []; });
  const unassigned = [];
  trainings.forEach((t) => {
    if (t.step_id && trainingsByStep[t.step_id]) {
      trainingsByStep[t.step_id].push(t);
    } else if (!t.step_id || !stepIds.has(t.step_id)) {
      unassigned.push(t);
    }
  });

  const cardProps = { S, lang, busy, onStart, onComplete, openLink, resolveLink };
  const headTitle = (S.pageTitle && S.pageTitle[page]) || S.title;
  const headSub = (S.pageSubtitle && S.pageSubtitle[page]) || S.subtitle;

  const microDoneCount = microTasks.filter((m) => m.status === "yapildi").length;
  const microTotal = microTasks.length;
  const microAllDone = microTotal > 0 && microDoneCount >= microTotal;
  let loopMicroText = "";
  if (microTotal > 0) {
    loopMicroText = typeof S.loopMicro === "function"
      ? S.loopMicro(microDoneCount, microTotal)
      : (microDoneCount + "/" + microTotal + " pratik");
  } else if (!hasSnapshot) {
    loopMicroText = S.loopMicroNeedChat || S.microEmptyChat;
  } else {
    loopMicroText = S.loopMicroEmpty || S.microEmptyWeek;
  }
  const loopCheckinText = weekCheckin
    ? (S.loopCheckinDone || "Check-in tamam")
    : (S.loopCheckinTodo || "Check-in yap");
  const loopLine = loopMicroText + " · " + loopCheckinText;

  const firstName = (name || "").trim().split(/\s+/)[0] || "";
  const hubHello = firstName
    ? (typeof S.hubHelloNamed === "function" ? S.hubHelloNamed(firstName) : ("Merhaba, " + firstName))
    : (S.hubHello || "Merhaba");

  let hubStatus = S.hubStatusEmpty || S.empty;
  if (hasDraft) {
    hubStatus = S.hubStatusDraft || S.draftResumeTitle;
  } else if (week.activeStep) {
    const stepLabel = week.stepInfo ? week.stepInfo.label : "";
    const stepTitle = week.activeStep.title || "";
    hubStatus = typeof S.hubStatusStep === "function"
      ? S.hubStatusStep(stepLabel, stepTitle)
      : ((S.weekActiveStep || "Aktif adımın:") + " " + stepLabel + (stepTitle ? (" — " + stepTitle) : ""));
  } else if (goal) {
    hubStatus = typeof S.hubStatusGoal === "function" ? S.hubStatusGoal(goal) : goal;
  } else if (roadmap.length === 0 && trainings.length === 0) {
    hubStatus = S.hubStatusStart || S.empty;
  } else if (week.actions.length === 0) {
    hubStatus = S.hubStatusClear || S.weekEmpty;
  }

  const primaryWeekAction = week.actions && week.actions.length ? week.actions[0] : null;
  const weekPreview = (week.actions || []).slice(0, 3);
  const hubIsEmpty = roadmap.length === 0 && trainings.length === 0 && !hasDraft;

  return (
    <div className="pf-page">
      <div className="pf-top">
        <a href="index.html" aria-label={S.brand} style={{ display: "inline-flex" }}><CPLogo /></a>
        <div className="pf-top-actions">
          <a className="pf-link" href="kariyer%20sohbet.html">{S.chatBtn}</a>
          <a className="pf-link" href="ilan-uyumu.html">{S.jobFitBtn}</a>
          {user ? (
            <button className="pf-btn ghost" onClick={logout}>{S.logoutBtn}</button>
          ) : (
            <button className="pf-btn" onClick={login} disabled={!configured}>{S.loginBtn}</button>
          )}
        </div>
      </div>

      <div className="pf-shell">
        <header className={"pf-head" + (page === "bugun" ? " hub" : "")}>
          {page !== "bugun" ? (
            <React.Fragment>
              <h1>{headTitle}</h1>
              <p>{headSub}</p>
              {user && name ? <div className="pf-user">{name}</div> : null}
              {user && planInfo ? (
                <div className="pw-plan-row">
                  <span className={"pw-badge " + (planInfo.plan === "plus" ? "plus" : "free")}>
                    {planInfo.plan === "plus" ? (S.planPlus || "Plus") : (S.planFree || "Free")}
                  </span>
                  <span className="pw-remaining">
                    {(S.chatsLeft || "Kalan sohbet")}: {typeof planInfo.remaining === "number" ? planInfo.remaining : "—"}
                  </span>
                  {planInfo.plan === "plus" ? (
                    <button type="button" className="pw-cancel-link" onClick={onCancelPlus} disabled={busy}>
                      {S.cancelPlus || "Aboneliği iptal et"}
                    </button>
                  ) : (
                    <a className="pw-upgrade-link" href="fiyatlandirma.html">{S.upgradePlus || "Plus’a geç"}</a>
                  )}
                </div>
              ) : null}
            </React.Fragment>
          ) : null}
          {billingMsg ? <p className="pw-billing-msg">{billingMsg}</p> : null}
        </header>

        {!ready ? (
          <p className="pf-muted">{S.loading}</p>
        ) : !configured ? (
          <p className="pf-muted">{S.notConfigured}</p>
        ) : !user ? (
          <div className="pf-login-card">
            <p>{S.loginPrompt}</p>
            <button className="pf-btn" onClick={login}>{S.loginBtn}</button>
          </div>
        ) : (
          <React.Fragment>
            {typeof CPShareCardModal === "function" ? (
              <CPShareCardModal
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                locale={lang}
                labels={S.shareCard || {}}
              />
            ) : null}

            <nav className="pf-tabs pf-tabs-top" aria-label={S.tabAria || "Profil sayfaları"}>
              {PF_PAGES.map((id) => (
                <a
                  key={id}
                  href={PF_HREF[id]}
                  className={"pf-tab" + (page === id ? " on" : "")}
                  aria-current={page === id ? "page" : undefined}
                >
                  {(S.tabs && S.tabs[id]) || id}
                </a>
              ))}
            </nav>

            {page === "bugun" ? (
              <div className="pf-tab-panel pf-hub">
                <section className="pf-hub-hero" aria-label={S.pageTitle && S.pageTitle.bugun}>
                  <p className="pf-hub-brand">{S.brand}</p>
                  <h1 className="pf-hub-hello">{hubHello}</h1>
                  <p className="pf-hub-status">{hubStatus}</p>

                  <div className="pf-hub-progress" aria-label={S.overall}>
                    <div className="pf-bar"><div className="pf-bar-fill" style={{ width: overall + "%" }} /></div>
                    <span className="pf-hub-pct">{overall}%</span>
                  </div>

                  <div className="pf-hub-cta">
                    {hasDraft ? (
                      <a className="pf-btn" href="kariyer%20sohbet.html?resume=1">
                        {S.hubCtaResume || S.draftResumeLink || "Devam et"}
                      </a>
                    ) : primaryWeekAction ? (
                      primaryWeekAction.type === "start" ? (
                        <button type="button" className="pf-btn" onClick={() => onStart(primaryWeekAction.id)} disabled={busy}>
                          {S.hubCtaStart || S.markStarted}
                        </button>
                      ) : (
                        <button type="button" className="pf-btn" onClick={() => onComplete(primaryWeekAction.id)} disabled={busy}>
                          {S.hubCtaContinue || S.weekContinue}
                        </button>
                      )
                    ) : (
                      <a className="pf-btn" href="kariyer%20sohbet.html">
                        {S.hubCtaChat || S.chatBtn}
                      </a>
                    )}
                    {roadmap.length > 0 ? (
                      <a className="pf-btn ghost" href={PF_HREF.yol}>
                        {S.hubCtaPath || "Yolum"}
                      </a>
                    ) : null}
                    <a className="pf-btn ghost" href="cv-bosluk.html">
                      {S.hubCtaCv || "CV analizi"}
                    </a>
                    {hasDraft || primaryWeekAction ? (
                      <a className="pf-btn ghost" href="kariyer%20sohbet.html">
                        {S.hubCtaChat || S.chatBtn}
                      </a>
                    ) : null}
                  </div>
                </section>

                <section className="pf-week pf-week-hub">
                  <div className="pf-week-hub-head">
                    <h2>{hubIsEmpty ? (S.onboardTitle || S.weekTitle) : S.weekTitle}</h2>
                    {!hubIsEmpty ? <a href={PF_HREF.pratik}>{loopLine}</a> : null}
                  </div>
                  {hubIsEmpty ? (
                    <div className="pf-onboard">
                      <p className="pf-onboard-lead">
                        {S.onboardLead || "Önce sohbet → yol oluşur"}
                      </p>
                      <ol className="pf-onboard-steps">
                        <li>{S.onboardStep1 || "Kariyer Sohbetini tamamla"}</li>
                        <li>{S.onboardStep2 || "Yol haritan ve eğitimlerin oluşur"}</li>
                        <li>{S.onboardStep3 || "Haftalık pratiklere ve check-in’e geç"}</li>
                      </ol>
                      <a className="pf-btn" href="kariyer%20sohbet.html">
                        {S.onboardCta || S.hubCtaChat || S.chatBtn}
                      </a>
                    </div>
                  ) : weekPreview.length === 0 ? (
                    <p className="pf-muted">{S.weekEmpty}</p>
                  ) : (
                    <ul className="pf-week-list">
                      {weekPreview.map((a) => (
                        <li key={a.id + a.type}>
                          <span className={"pf-week-tag " + a.type}>
                            {a.type === "continue" ? S.weekContinue : S.weekStart}
                          </span>
                          <span className="pf-week-name">{a.training.training_name}</span>
                          <div className="pf-week-actions">
                            {resolveLink(a.training) ? (
                              <button type="button" onClick={() => openLink(a.training)} disabled={busy}>{S.openTraining}</button>
                            ) : null}
                            {a.type === "start" ? (
                              <button type="button" onClick={() => onStart(a.id)} disabled={busy}>{S.markStarted}</button>
                            ) : (
                              <button type="button" onClick={() => onComplete(a.id)} disabled={busy}>{S.markCompleted}</button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!hubIsEmpty && week.actions.length > weekPreview.length ? (
                    <a className="pf-week-more" href={PF_HREF.yol}>{S.hubWeekMore || S.goRoadmap}</a>
                  ) : null}
                </section>

                <details className="pf-account">
                  <summary>{S.accountSummary || "Hesap ve tercihler"}</summary>
                  <div className="pf-account-body">
                    {planInfo ? (
                      <div className="pw-plan-row">
                        <span className={"pw-badge " + (planInfo.plan === "plus" ? "plus" : "free")}>
                          {planInfo.plan === "plus" ? (S.planPlus || "Plus") : (S.planFree || "Free")}
                        </span>
                        <span className="pw-remaining">
                          {(S.chatsLeft || "Kalan sohbet")}: {typeof planInfo.remaining === "number" ? planInfo.remaining : "—"}
                        </span>
                        {planInfo.plan === "plus" ? (
                          <button type="button" className="pw-cancel-link" onClick={onCancelPlus} disabled={busy}>
                            {S.cancelPlus || "Aboneliği iptal et"}
                          </button>
                        ) : (
                          <a className="pw-upgrade-link" href="fiyatlandirma.html">{S.upgradePlus || "Plus’a geç"}</a>
                        )}
                      </div>
                    ) : null}

                    <div className="pf-account-actions">
                      <button type="button" className="pf-btn ghost" onClick={() => setShareOpen(true)}>
                        {S.shareCardBtn}
                      </button>
                    </div>

                    <div className="pf-reminders pf-reminders-inline">
                      <div className="pf-reminders-row">
                        <div>
                          <h3>{S.remindersTitle}</h3>
                          <p className="pf-muted">{S.remindersHint}</p>
                        </div>
                        <button
                          type="button"
                          className={"pf-toggle " + (remindersOn ? "on" : "")}
                          onClick={toggleReminders}
                          disabled={busy}
                          aria-pressed={remindersOn}
                        >
                          {remindersOn ? S.remindersOn : S.remindersOff}
                        </button>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            ) : null}

            {page === "yol" ? (
              <div className="pf-tab-panel">
                <section className="pf-compare-summary">
                  <h3>{S.compareSummaryTitle}</h3>
                  {!skillSummary || skillSummary.empty || (!skillSummary.hasComparison && !skillSummary.isFirst) ? (
                    <p className="pf-muted">{S.compareSummaryNone}</p>
                  ) : skillSummary.isFirst ? (
                    <p className="pf-muted">{S.compareSummaryFirst}</p>
                  ) : (
                    <p>
                      <span className="up">{skillSummary.improved}</span>
                      {" · "}
                      <span className="down">{skillSummary.declined}</span>
                      {" — "}
                      {typeof S.compareSummaryText === "function"
                        ? S.compareSummaryText(skillSummary.improved, skillSummary.declined)
                        : ""}
                    </p>
                  )}
                </section>

                {roadmap.length > 0 ? (
                  <section className="pf-roadmap" aria-label={S.roadmapTitle}>
                    <div className="pf-roadmap-head">
                      <h2>{S.roadmapTitle}</h2>
                      {stepInfo ? (
                        <span className="pf-roadmap-badge">{S.stepProgress}: {stepInfo.label}</span>
                      ) : null}
                    </div>
                    <ol className="pf-timeline">
                      {roadmap.map((step) => {
                        const linked = trainingsByStep[step.id] || [];
                        const sc = stepStatusClass(step.status);
                        return (
                          <li key={step.id} className={"pf-timeline-step " + sc}>
                            <div className="pf-timeline-marker" aria-hidden="true">
                              <span className="pf-timeline-num">{step.step_order}</span>
                            </div>
                            <div className="pf-timeline-body">
                              <div className="pf-timeline-top">
                                <h3>{step.title}</h3>
                                <span className={"pf-badge step-" + sc}>
                                  {S.stepStatus[step.status] || step.status}
                                </span>
                              </div>
                              {step.description ? <p className="pf-timeline-desc">{step.description}</p> : null}
                              {linked.length === 0 ? (
                                <p className="pf-muted pf-no-resource">{S.noResources}</p>
                              ) : (
                                <ul className="pf-list pf-step-trainings">
                                  {linked.map((t) => (
                                    <TrainingCard key={t.id} t={t} {...cardProps} />
                                  ))}
                                </ul>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ) : (
                  <p className="pf-muted">{S.empty}</p>
                )}

                {unassigned.length > 0 ? (
                  <section className="pf-other">
                    <h3>{S.otherTrainings}</h3>
                    <ul className="pf-list">
                      {unassigned.map((t) => (
                        <TrainingCard key={t.id} t={t} {...cardProps} />
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            ) : null}

            {page === "pratik" ? (
              <div className="pf-tab-panel">
                <div className="pf-loop-banner" aria-label={S.loopAria || "Pratik döngüsü"}>
                  <strong>{loopLine}</strong>
                  {microAllDone && !weekCheckin ? (
                    <a className="pf-loop-nudge" href="#check-in" onClick={() => setCheckinEditing(true)}>
                      {S.loopNudgeCheckin || "Pratikler bitti — check-in yap"}
                    </a>
                  ) : null}
                  {weekCheckin && microTotal > 0 && !microAllDone ? (
                    <a className="pf-loop-nudge" href="#pratiker">
                      {S.loopNudgeMicro || "Kalan pratiklere geç"}
                    </a>
                  ) : null}
                </div>

                <section className="pf-checkin" id="check-in" aria-label={S.checkinTitle}>
                  <h3>{S.checkinTitle}</h3>
                  <p className="pf-muted pf-checkin-hint">{S.checkinHint}</p>

                  {!weekCheckin && !checkinEditing ? (
                    <p className="pf-muted">{S.checkinEmpty}</p>
                  ) : null}

                  {weekCheckin && !checkinEditing ? (
                    <div className="pf-checkin-card">
                      <p className="pf-checkin-q1">{weekCheckin.q1_text}</p>
                      {weekCheckin.q2_text ? (
                        <p className="pf-checkin-q2">{weekCheckin.q2_text}</p>
                      ) : null}
                      {weekCheckin.q2_choice && S.checkinChoices ? (
                        <span className="pf-checkin-tag">
                          {S.checkinChoices[weekCheckin.q2_choice] || weekCheckin.q2_choice}
                        </span>
                      ) : null}
                      {weekCheckin.reflection ? (
                        <p className="pf-checkin-reflection">{weekCheckin.reflection}</p>
                      ) : null}
                      <button type="button" className="pf-checkin-edit" onClick={startEditCheckin} disabled={busy}>
                        {S.checkinEdit}
                      </button>
                    </div>
                  ) : (
                    <div className="pf-checkin-form">
                      <label className="pf-checkin-label">
                        {S.checkinQ1}
                        <textarea
                          value={checkinQ1}
                          onChange={(e) => setCheckinQ1(e.target.value)}
                          rows={3}
                          disabled={busy}
                          maxLength={1000}
                        />
                      </label>
                      <label className="pf-checkin-label">
                        {S.checkinQ2}
                        <textarea
                          value={checkinQ2}
                          onChange={(e) => setCheckinQ2(e.target.value)}
                          rows={2}
                          disabled={busy}
                          maxLength={500}
                        />
                      </label>
                      <div className="pf-checkin-choices">
                        <span className="pf-checkin-choice-label">{S.checkinChoiceLabel}</span>
                        <div className="pf-checkin-choice-row">
                          {["egitim", "pratik", "basvuru", "belirsiz"].map((key) => (
                            <button
                              key={key}
                              type="button"
                              className={"pf-checkin-chip" + (checkinChoice === key ? " on" : "")}
                              disabled={busy}
                              onClick={() => setCheckinChoice(checkinChoice === key ? "" : key)}
                            >
                              {(S.checkinChoices && S.checkinChoices[key]) || key}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="pf-checkin-actions">
                        <button type="button" className="pf-btn" onClick={onSaveCheckin} disabled={busy}>
                          {S.checkinSave}
                        </button>
                        {weekCheckin ? (
                          <button type="button" className="pf-btn ghost" onClick={cancelEditCheckin} disabled={busy}>
                            {S.checkinCancel}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}

                  <div className="pf-checkin-history">
                    <button
                      type="button"
                      className="pf-checkin-history-toggle"
                      onClick={() => setCheckinHistoryOpen(!checkinHistoryOpen)}
                      aria-expanded={checkinHistoryOpen}
                    >
                      {S.checkinHistory}{checkinHistoryOpen ? " ▴" : " ▾"}
                    </button>
                    {checkinHistoryOpen ? (
                      checkinHistory.length === 0 ? (
                        <p className="pf-muted">{S.checkinHistoryEmpty}</p>
                      ) : (
                        <ul className="pf-checkin-history-list">
                          {checkinHistory.map((h) => (
                            <li key={h.id || h.week_start}>
                              <strong>{formatWeekStart(h.week_start)}</strong>
                              <span>{h.q1_text}</span>
                              {h.reflection ? <em>{h.reflection}</em> : null}
                            </li>
                          ))}
                        </ul>
                      )
                    ) : null}
                  </div>
                </section>

                <section className="pf-micro" id="pratiker">
                  <div className="pf-micro-head">
                    <h3>{S.microTitle}</h3>
                    {microTotal > 0 ? (
                      <span className="pf-micro-progress">
                        {typeof S.loopMicro === "function"
                          ? S.loopMicro(microDoneCount, microTotal)
                          : (microDoneCount + "/" + microTotal)}
                      </span>
                    ) : null}
                  </div>
                  <p className="pf-muted pf-micro-hint">{S.microHint}</p>
                  {!hasSnapshot ? (
                    <p className="pf-muted">
                      {S.microEmptyChat}{" "}
                      <a href="kariyer%20sohbet.html">{S.microEmptyChatCta || S.chatBtn}</a>
                    </p>
                  ) : microTasks.length === 0 ? (
                    <p className="pf-muted">{S.microEmptyWeek}</p>
                  ) : (
                    <ul className="pf-micro-list">
                      {microTasks.map((m) => {
                        const done = m.status === "yapildi";
                        return (
                          <li key={m.id} className={"pf-micro-item" + (done ? " done" : "")}>
                            <div className="pf-micro-check" aria-hidden="true">{done ? "✓" : ""}</div>
                            <div className="pf-micro-body">
                              <div className="pf-micro-title">{m.title}</div>
                              {m.description ? <p className="pf-micro-desc">{m.description}</p> : null}
                              <div className="pf-micro-meta">
                                {m.yetkinlik_adi ? <span>{m.yetkinlik_adi}</span> : null}
                                {m.due_hint ? <span>{S.microDue}: {m.due_hint}</span> : null}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="pf-micro-btn"
                              disabled={busy || done}
                              onClick={() => onMicroDone(m.id)}
                            >
                              {done ? S.microDoneLabel : S.microDone}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}

            {page === "kesfet" ? (
              <div className="pf-tab-panel">
                <section className="pf-current-role" aria-label={S.currentRoleTitle}>
                  <h3>{S.currentRoleTitle}</h3>
                  <p className="pf-muted pf-current-role-hint">{S.currentRoleHint}</p>
                  <div className="pf-current-role-row">
                    <input
                      type="text"
                      className="pf-current-role-input"
                      value={mevcutRolDraft}
                      onChange={(e) => setMevcutRolDraft(e.target.value)}
                      placeholder={S.currentRolePlaceholder}
                      disabled={busy || yatayBusy}
                      maxLength={160}
                    />
                    <button
                      type="button"
                      className="pf-btn"
                      onClick={onSaveMevcutRol}
                      disabled={busy || yatayBusy}
                    >
                      {S.currentRoleSave}
                    </button>
                  </div>
                </section>

                {yataySuggestions.length >= 2 ? (
                  <aside className="pf-explore" aria-label={S.exploreTitle}>
                    <h3>{S.exploreTitle}</h3>
                    <p className="pf-explore-hint">{S.exploreHint}</p>
                    <ul className="pf-explore-list">
                      {yataySuggestions.map((s, i) => (
                        <li key={i}>
                          <strong>{s.hedef_rol}</strong>
                          {s.gerekce ? <span>{s.gerekce}</span> : null}
                        </li>
                      ))}
                    </ul>
                    <p className="pf-explore-note">{S.exploreNote}</p>
                  </aside>
                ) : null}

                <section className="pf-sector-notes" id="sektor-notlari" aria-label={S.sectorNotesTitle}>
                  <div className="pf-sector-head">
                    <h2>{S.sectorNotesTitle}</h2>
                    {sectorPack && sectorPack.sector_key ? (
                      <span className="pf-sector-badge">
                        {typeof S.sectorNotesSector === "function"
                          ? S.sectorNotesSector(sectorPack.sector_key)
                          : sectorPack.sector_key}
                      </span>
                    ) : null}
                  </div>
                  <p className="pf-muted pf-sector-hint">{S.sectorNotesHint}</p>
                  {!sectorPack || !sectorPack.notes || sectorPack.notes.length === 0 ? (
                    <p className="pf-muted">{S.sectorNotesEmpty}</p>
                  ) : (
                    <ul className="pf-sector-list">
                      {sectorPack.notes.map((n) => {
                        const cta = n.cta_type || "chat";
                        const href = CPAuth.sectorCtaHref(cta);
                        const label = (S.sectorCta && S.sectorCta[cta]) || cta;
                        return (
                          <li key={n.id || n.slug} className="pf-sector-card">
                            <h3>{n.title}</h3>
                            <p className="pf-sector-body">{n.body}</p>
                            {n.personal_line ? (
                              <p className="pf-sector-personal">{n.personal_line}</p>
                            ) : null}
                            <a className="pf-sector-cta" href={href}>{label}</a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}
          </React.Fragment>
        )}
      </div>

      {user ? (
        <nav className="pf-bottom-tabs" aria-label={S.tabAria || "Profil sayfaları"}>
          {PF_PAGES.map((id) => (
            <a
              key={"b-" + id}
              href={PF_HREF[id]}
              className={"pf-bottom-tab" + (page === id ? " on" : "")}
              aria-current={page === id ? "page" : undefined}
            >
              {(S.tabs && S.tabs[id]) || id}
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ProfilPage />);
