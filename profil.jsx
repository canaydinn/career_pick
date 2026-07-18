/* global React, ReactDOM, CP_PROFIL, CPAuth, CPIcon, CPLogo */
const { useState, useEffect } = React;

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

  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [trainings, setTrainings] = useState([]);
  const [roadmap, setRoadmap] = useState([]);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadPlan() {
    const [t, steps, g] = await Promise.all([
      CPAuth.fetchTrainings(),
      CPAuth.fetchActiveRoadmap(),
      CPAuth.fetchCareerGoal(),
    ]);
    setTrainings(t);
    setRoadmap(steps);
    setGoal(g || "");
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
        setProfile(p || (await CPAuth.fetchProfile()));
        if (!alive) return;
        await loadPlan();
      } else {
        setProfile(null);
        setTrainings([]);
        setRoadmap([]);
        setGoal("");
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

  async function login() {
    try {
      sessionStorage.setItem("cp_auth_next", "profil.html");
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

  return (
    <div className="pf-page">
      <div className="pf-top">
        <a href="index.html" aria-label={S.brand} style={{ display: "inline-flex" }}><CPLogo /></a>
        <div className="pf-top-actions">
          <a className="pf-link" href="kariyer%20sohbet.html">{S.chatBtn}</a>
          {user ? (
            <button className="pf-btn ghost" onClick={logout}>{S.logoutBtn}</button>
          ) : (
            <button className="pf-btn" onClick={login} disabled={!configured}>{S.loginBtn}</button>
          )}
        </div>
      </div>

      <div className="pf-shell">
        <header className="pf-head">
          <h1>{S.title}</h1>
          <p>{S.subtitle}</p>
          {user && name ? <div className="pf-user">{name}</div> : null}
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
            <section className="pf-overall">
              <div className="pf-overall-row">
                <span>{S.overall}</span>
                <strong>{overall}%</strong>
              </div>
              <div className="pf-bar"><div className="pf-bar-fill" style={{ width: overall + "%" }} /></div>
              <div className="pf-overall-meta">
                {trainings.filter((t) => t.status === "tamamlandi").length} / {trainings.length}
                {stepInfo ? (
                  <span className="pf-step-meta"> · {S.stepProgress}: {stepInfo.label}</span>
                ) : null}
              </div>
            </section>

            {goal ? (
              <section className="pf-goal">
                <h3>{S.goalTitle}</h3>
                <p>{goal}</p>
              </section>
            ) : null}

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
            ) : null}

            <section className="pf-week">
              <h3>{S.weekTitle}</h3>
              {week.activeStep ? (
                <div className="pf-week-step">
                  <strong>{S.weekActiveStep}</strong>{" "}
                  {week.stepInfo ? week.stepInfo.label : ""} — {week.activeStep.title}
                </div>
              ) : null}
              {week.actions.length === 0 ? (
                <p className="pf-muted">{S.weekEmpty}</p>
              ) : (
                <ul className="pf-week-list">
                  {week.actions.map((a) => (
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
              {week.next ? (
                <div className="pf-next">
                  <strong>{S.nextTitle}:</strong> {week.next.training_name}
                </div>
              ) : null}
            </section>

            <section className="pf-reminders">
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
            </section>

            {roadmap.length === 0 && trainings.length === 0 ? (
              <p className="pf-muted">{S.empty}</p>
            ) : null}

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
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ProfilPage />);
