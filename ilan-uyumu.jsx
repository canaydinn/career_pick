/* global React, ReactDOM, CP_ILAN, CPAuth, CPLogo */
const { useState, useEffect } = React;

function statusClass(status) {
  if (status === "tamamlandi") return "done";
  if (status === "devam_ediyor") return "progress";
  return "missing";
}

function IlanUyumuPage() {
  const lang = (typeof localStorage !== "undefined" && localStorage.getItem("cp_lang")) === "en" ? "en" : "tr";
  const S = CP_ILAN[lang];

  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [user, setUser] = useState(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [showPaste, setShowPaste] = useState(true);
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
      if (u) setTrainings(await CPAuth.fetchTrainings());
      setReady(true);
      off = CPAuth.onAuthStateChange(async (nu) => {
        if (!alive) return;
        setUser(nu);
        if (nu) setTrainings(await CPAuth.fetchTrainings());
        else {
          setTrainings([]);
          setResult(null);
        }
      });
    })();
    return () => { alive = false; off(); };
  }, []);

  async function login() {
    try {
      sessionStorage.setItem("cp_auth_next", "ilan-uyumu.html");
      await CPAuth.signInWithGoogle(location.origin + "/auth-callback.html");
    } catch (e) {
      alert(e.message || S.notConfigured);
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
    setBusy(true);
    try {
      const data = await CPAuth.analyzeJobMatch({ url: url.trim(), text: text.trim() });
      if (!data.ok) {
        setResult(null);
        if (data.error === "plus_required") {
          setError(S.plusRequired);
        } else {
          setError(data.error || S.scrapeFail);
          if (data.need_paste || data.scrape_ok === false) setShowPaste(true);
        }
        return;
      }
      if (data.scrape_ok === false && data.scrape_error) {
        setShowPaste(true);
      }
      setResult(data);
      const saved = await CPAuth.saveJobMatch(data);
      if (saved.ok) {
        setSavedMsg(S.saved);
        setTrainings(await CPAuth.fetchTrainings());
      }
    } catch (err) {
      setError(err.message || S.scrapeFail);
      setShowPaste(true);
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

  return (
    <div className="pf-page ju-page">
      <div className="pf-top">
        <a href="index.html" aria-label={S.brand} style={{ display: "inline-flex" }}><CPLogo /></a>
        <div className="pf-top-actions">
          <a className="pf-link" href="profil.html">{S.profileBtn}</a>
          <a className="pf-link" href="cv-bosluk.html">{S.cvGapBtn || "CV analizi"}</a>
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
                {S.urlLabel}
                <input
                  type="url"
                  className="ju-input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={S.urlPlaceholder}
                  disabled={busy}
                />
              </label>

              <button
                type="button"
                className="ju-paste-toggle"
                onClick={() => setShowPaste((v) => !v)}
              >
                {S.pasteToggle}
              </button>

              {showPaste ? (
                <label className="ju-label">
                  {S.pasteLabel}
                  <textarea
                    className="ju-textarea"
                    rows={8}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={S.pastePlaceholder}
                    disabled={busy}
                  />
                </label>
              ) : null}

              <button type="submit" className="pf-btn ju-submit" disabled={busy || (!url.trim() && !text.trim())}>
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
                  {result.job && result.job.title ? (
                    <p className="ju-job-title">{result.job.title}</p>
                  ) : null}
                  <div className="ju-score-ring" style={{ "--pct": fit }}>
                    <strong>{fit}%</strong>
                  </div>
                  <p className="pf-muted ju-score-note">{result.disclaimer || S.disclaimer}</p>
                </div>

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

                {result.kariyer_haritasi
                  && Array.isArray(result.kariyer_haritasi.oncul_roller)
                  && result.kariyer_haritasi.oncul_roller.length ? (
                  <aside className="ju-path-hint" aria-label={S.pathHintTitle}>
                    <h3>{S.pathHintTitle}</h3>
                    <p className="ju-path-hint-note">{S.pathHintNote}</p>
                    {result.kariyer_haritasi.meslek_adi ? (
                      <p className="ju-path-hint-meslek">{result.kariyer_haritasi.meslek_adi}</p>
                    ) : null}
                    <ul className="ju-path-hint-list">
                      {result.kariyer_haritasi.oncul_roller.map((r, i) => (
                        <li key={i}>
                          <strong>{r.rol_adi}</strong>
                          {r.gerekce ? <span>{r.gerekce}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </aside>
                ) : null}

                <div className="ju-recs">
                  <h3>{S.recsTitle}</h3>
                  {recCards.length === 0 ? (
                    <p className="pf-muted">{S.emptyRecs}</p>
                  ) : (
                    <ul className="pf-list">
                      {recCards.map((r, i) => {
                        const tid = r.link || r.ad;
                        const row = trainings.find((t) => t.training_id === tid || t.training_name === r.ad);
                        const st = row ? row.status : "eksik";
                        return (
                          <li className={"pf-item " + statusClass(st)} key={i}>
                            <div className="pf-item-top">
                              <h3>{r.ad}</h3>
                              <span className={"pf-badge " + statusClass(st)}>
                                {S.status[st] || st}
                              </span>
                            </div>
                            {r.kurum ? <div className="pf-item-meta">{r.kurum}</div> : null}
                            {r.gerekce ? <p className="ju-gerekce">{r.gerekce}</p> : null}
                            <div className="pf-item-actions">
                              <button
                                type="button"
                                className="primary"
                                disabled={busy || !resolveLink({ link: r.link, training_id: tid })}
                                onClick={() => openLink({ link: r.link, training_id: tid })}
                              >
                                {S.openTraining}
                              </button>
                              <button
                                type="button"
                                disabled={busy || !row || st === "devam_ediyor"}
                                onClick={() => row && onStart(row.id)}
                              >
                                {S.markStarted}
                              </button>
                              <button
                                type="button"
                                disabled={busy || !row || st === "tamamlandi"}
                                onClick={() => row && onComplete(row.id)}
                              >
                                {S.markCompleted}
                              </button>
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

ReactDOM.createRoot(document.getElementById("root")).render(<IlanUyumuPage />);
