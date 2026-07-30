/* global React, ReactDOM, CP_CVGAP, CPAuth, CPLogo */
const { useState, useEffect } = React;

function statusClass(status) {
  if (status === "tamamlandi") return "done";
  if (status === "devam_ediyor") return "progress";
  return "missing";
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = () => reject(reader.error || new Error("read"));
    reader.readAsDataURL(file);
  });
}

function CvBoslukPage() {
  const lang = (typeof localStorage !== "undefined" && localStorage.getItem("cp_lang")) === "en" ? "en" : "tr";
  const S = CP_CVGAP[lang];

  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [user, setUser] = useState(null);
  const [targetRole, setTargetRole] = useState("");
  const [cvText, setCvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileB64, setFileB64] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [trainings, setTrainings] = useState([]);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    let alive = true;
    let off = () => {};
    (async () => {
      if (!window.CPAuth) {
        setConfigured(false);
        setReady(true);
        return;
      }
      await CPAuth.init();
      if (!alive) return;
      setConfigured(CPAuth.isConfigured());
      const u = await CPAuth.getUser();
      if (!alive) return;
      setUser(u);
      if (u) {
        setTrainings(await CPAuth.fetchTrainings());
        const goal = await CPAuth.fetchCareerGoal();
        if (goal) setTargetRole(goal);
      }
      setReady(true);
      off = CPAuth.onAuthStateChange(async (nu) => {
        if (!alive) return;
        setUser(nu);
        if (nu) {
          setTrainings(await CPAuth.fetchTrainings());
          const goal = await CPAuth.fetchCareerGoal();
          if (goal) setTargetRole(goal);
        } else {
          setTrainings([]);
          setResult(null);
        }
      });
    })();
    return () => { alive = false; off(); };
  }, []);

  async function login() {
    try {
      sessionStorage.setItem("cp_auth_next", "cv-bosluk.html");
      await CPAuth.signInWithGoogle(location.origin + "/auth-callback.html");
    } catch (e) {
      alert(e.message || S.notConfigured);
    }
  }

  async function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setError("");
    setFileName(f.name || "");
    setFileB64("");
    try {
      if (f.size > 1.2 * 1024 * 1024) {
        setError(S.fileFail);
        return;
      }
      const name = (f.name || "").toLowerCase();
      if (name.endsWith(".txt") || name.endsWith(".md") || (f.type || "").startsWith("text/")) {
        const text = await f.text();
        setCvText(text);
        setFileB64("");
      } else {
        const b64 = await fileToBase64(f);
        setFileB64(b64);
      }
    } catch (err) {
      setError(S.fileFail);
    }
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
    if (!href) return;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function onAnalyze(e) {
    e.preventDefault();
    if (!user || busy) return;
    setError("");
    setSavedMsg("");
    if (!cvText.trim() && !fileB64) {
      setError(S.needCv);
      return;
    }
    if (!targetRole.trim() || targetRole.trim().length < 2) {
      setError(S.needRole);
      return;
    }
    setBusy(true);
    try {
      const data = await CPAuth.analyzeCvGap({
        cvText: fileB64 ? "" : cvText.trim(),
        cvBase64: fileB64 || "",
        cvFilename: fileName || "",
        targetRole: targetRole.trim(),
      });
      if (!data.ok) {
        setResult(null);
        if (data.error === "plus_required") {
          setError(S.plusRequired);
        } else {
          setError(data.error || S.fileFail);
        }
        return;
      }
      setResult(data);
      const saved = await CPAuth.saveCvGap(data);
      if (saved.ok) {
        setSavedMsg(S.saved);
        setTrainings(await CPAuth.fetchTrainings());
      }
    } catch (err) {
      setError(err.message || S.fileFail);
    } finally {
      setBusy(false);
    }
  }

  async function onStart(id) {
    setBusy(true);
    await CPAuth.markTrainingStarted(id);
    setTrainings(await CPAuth.fetchTrainings());
    setBusy(false);
  }

  async function onComplete(id) {
    setBusy(true);
    await CPAuth.markTrainingCompleted(id);
    setTrainings(await CPAuth.fetchTrainings());
    setBusy(false);
  }

  const recCards = (result && result.recommendations) || [];
  const fit = result ? Math.round(Number(result.fit_score) || 0) : 0;
  const canSubmit = !busy && (!!cvText.trim() || !!fileB64) && targetRole.trim().length >= 2;

  return (
    <div className="pf-page ju-page">
      <div className="pf-top">
        <a href="index.html" aria-label={S.brand} style={{ display: "inline-flex" }}><CPLogo /></a>
        <div className="pf-top-actions">
          <a className="pf-link" href="profil.html">{S.profileBtn}</a>
          <a className="pf-link" href="ilan-uyumu.html">{S.jobFitBtn}</a>
          <a className="pf-link" href="kariyer%20sohbet.html">{S.chatBtn}</a>
          {user ? (
            <button className="pf-btn ghost" onClick={() => CPAuth.signOut()}>{S.logoutBtn}</button>
          ) : (
            <button className="pf-btn" onClick={login} disabled={!configured}>{S.loginBtn}</button>
          )}
        </div>
      </div>

      <div className="pf-shell ju-shell">
        <header className="pf-head">
          <h1>{S.title}</h1>
          <p>{S.subtitle}</p>
          <p className="ju-disclaimer">{S.disclaimer}</p>
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
            <form className="ju-form" onSubmit={onAnalyze}>
              <label className="ju-label">
                {S.roleLabel}
                <input
                  type="text"
                  className="ju-input"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder={S.rolePlaceholder}
                  disabled={busy}
                  maxLength={160}
                />
                <span className="pf-muted" style={{ fontWeight: 500 }}>{S.roleHint}</span>
              </label>

              <label className="ju-label">
                {S.fileLabel}
                <input
                  type="file"
                  className="ju-input"
                  accept=".pdf,.txt,.md,text/plain,application/pdf"
                  onChange={onFile}
                  disabled={busy}
                />
                <span className="pf-muted" style={{ fontWeight: 500 }}>
                  {fileName ? fileName : S.fileHint}
                </span>
              </label>

              <label className="ju-label">
                {S.pasteLabel}
                <textarea
                  className="ju-textarea"
                  rows={10}
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  placeholder={S.pastePlaceholder}
                  disabled={busy}
                />
              </label>

              <button type="submit" className="pf-btn ju-submit" disabled={!canSubmit}>
                {busy ? S.analyzing : S.analyzeBtn}
              </button>
            </form>

            {error ? (
              <p className="ju-error">
                {error}
                {error === S.plusRequired ? (
                  <React.Fragment>
                    {" "}
                    <a className="pw-upgrade-link" href="fiyatlandirma.html">{S.upgradePlus}</a>
                  </React.Fragment>
                ) : null}
              </p>
            ) : null}
            {savedMsg ? <p className="ju-saved">{savedMsg}</p> : null}

            {result && result.ok ? (
              <section className="ju-result">
                <div className="ju-score-block">
                  <h2>{S.scoreTitle}</h2>
                  <p className="ju-job-title">{result.target_role}</p>
                  <div className="ju-score-ring" style={{ "--pct": fit }}>
                    <strong>{fit}%</strong>
                  </div>
                  <p className="pf-muted ju-score-note">{result.disclaimer || S.disclaimer}</p>
                </div>

                {result.cv && result.cv.summary ? (
                  <div className="ju-tags">
                    <h3>{S.cvSummaryTitle}</h3>
                    <p className="pf-muted" style={{ margin: 0, lineHeight: 1.45 }}>{result.cv.summary}</p>
                  </div>
                ) : null}

                <div className="ju-tags-row">
                  <div className="ju-tags">
                    <h3>{S.strongTitle}</h3>
                    <div className="ju-chip-wrap">
                      {(result.strong || []).length ? (
                        result.strong.map((t, i) => (
                          <span className="ju-chip strong" key={i}>{t}</span>
                        ))
                      ) : (
                        <span className="pf-muted">—</span>
                      )}
                    </div>
                  </div>
                  <div className="ju-tags">
                    <h3>{S.gapsTitle}</h3>
                    <div className="ju-chip-wrap">
                      {(result.gaps || []).length ? (
                        result.gaps.map((t, i) => (
                          <span className="ju-chip gap" key={i}>{t}</span>
                        ))
                      ) : (
                        <span className="pf-muted">—</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="ju-recs">
                  <h3>{S.recsTitle}</h3>
                  {recCards.length === 0 ? (
                    <p className="pf-muted">{S.emptyRecs}</p>
                  ) : (
                    <ul className="pf-list">
                      {recCards.map((r, i) => {
                        const linked = trainings.find((t) =>
                          (t.training_name || "") === r.ad || (t.link || "") === (r.link || "")
                        );
                        const st = linked ? linked.status : "eksik";
                        return (
                          <li key={i} className={"pf-item " + statusClass(st)}>
                            <div className="pf-item-top">
                              <h3>{r.ad}</h3>
                              <span className={"pf-badge " + statusClass(st)}>
                                {S.status[st] || st}
                              </span>
                            </div>
                            {r.gerekce ? <p className="ju-gerekce">{r.gerekce}</p> : null}
                            <div className="pf-item-actions">
                              {resolveLink(linked || { link: r.link }) ? (
                                <button type="button" className="primary" onClick={() => openLink(linked || { link: r.link })}>
                                  {S.openTraining}
                                </button>
                              ) : null}
                              {linked ? (
                                <React.Fragment>
                                  <button type="button" disabled={busy || st === "devam_ediyor"} onClick={() => onStart(linked.id)}>
                                    {S.markStarted}
                                  </button>
                                  <button type="button" disabled={busy || st === "tamamlandi"} onClick={() => onComplete(linked.id)}>
                                    {S.markCompleted}
                                  </button>
                                </React.Fragment>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
            ) : null}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<CvBoslukPage />);
