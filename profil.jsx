/* global React, ReactDOM, CP_PROFIL, CPAuth, CPIcon, CPLogo */
const { useState, useEffect } = React;

function statusClass(status) {
  if (status === "tamamlandi") return "done";
  if (status === "devam_ediyor") return "progress";
  return "missing";
}

function ProfilPage() {
  const lang = (typeof localStorage !== "undefined" && localStorage.getItem("cp_lang")) === "en" ? "en" : "tr";
  const S = CP_PROFIL[lang];

  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [trainings, setTrainings] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = () => {};
    (async () => {
      await CPAuth.init();
      setConfigured(CPAuth.isConfigured());
      setReady(true);
      off = CPAuth.onAuthStateChange(async (u) => {
        setUser(u);
        if (u) {
          const p = await CPAuth.ensureProfile(u);
          setProfile(p || (await CPAuth.fetchProfile()));
          setTrainings(await CPAuth.fetchTrainings());
        } else {
          setProfile(null);
          setTrainings([]);
        }
      });
    })();
    return () => off();
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

  async function setStatus(id, status) {
    setBusy(true);
    await CPAuth.updateTrainingStatus(id, status);
    setTrainings(await CPAuth.fetchTrainings());
    setBusy(false);
  }

  const overall = CPAuth.overallProgress(trainings);
  const name = (profile && profile.display_name) || (user && user.email) || "";

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
              </div>
            </section>

            {trainings.length === 0 ? (
              <p className="pf-muted">{S.empty}</p>
            ) : (
              <ul className="pf-list">
                {trainings.map((t) => {
                  const pct = CPAuth.statusProgress(t.status);
                  return (
                    <li className={"pf-item " + statusClass(t.status)} key={t.id}>
                      <div className="pf-item-top">
                        <h3>{t.training_name}</h3>
                        <span className={"pf-badge " + statusClass(t.status)}>
                          {S.status[t.status] || t.status}
                        </span>
                      </div>
                      <div className="pf-bar"><div className="pf-bar-fill" style={{ width: pct + "%" }} /></div>
                      <div className="pf-item-actions">
                        <button disabled={busy || t.status === "eksik"} onClick={() => setStatus(t.id, "eksik")}>{S.markMissing}</button>
                        <button disabled={busy || t.status === "devam_ediyor"} onClick={() => setStatus(t.id, "devam_ediyor")}>{S.markProgress}</button>
                        <button disabled={busy || t.status === "tamamlandi"} onClick={() => setStatus(t.id, "tamamlandi")}>{S.markDone}</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ProfilPage />);
