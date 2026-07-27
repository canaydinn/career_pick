/* global React, ReactDOM, CPAuth */
const { useState, useEffect } = React;

function FiyatlandirmaPage() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [plan, setPlan] = useState("free");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", surname: "", gsmNumber: "" });
  const [checkoutHtml, setCheckoutHtml] = useState("");
  const params = new URLSearchParams(location.search || "");
  const billingStatus = params.get("billing") || "";

  useEffect(() => {
    let alive = true;
    (async () => {
      await CPAuth.init();
      if (!alive) return;
      const u = await CPAuth.getUser();
      if (!alive) return;
      setUser(u);
      if (u) {
        await CPAuth.ensureProfile(u);
        const p = await CPAuth.fetchPlan();
        if (!alive) return;
        setPlan((p && p.plan) || "free");
        const dn = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || "";
        const parts = String(dn).trim().split(/\s+/);
        if (parts.length >= 2) {
          setForm((f) => Object.assign({}, f, {
            name: f.name || parts[0],
            surname: f.surname || parts.slice(1).join(" "),
          }));
        }
      }
      setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!checkoutHtml) return;
    // iyzico script inject
    const host = document.getElementById("iyzipay-checkout-form");
    if (!host) return;
    host.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.innerHTML = checkoutHtml;
    // Scripts in innerHTML don't run — re-exec
    Array.prototype.slice.call(wrap.querySelectorAll("script")).forEach((old) => {
      const s = document.createElement("script");
      if (old.src) s.src = old.src;
      else s.text = old.textContent || "";
      document.body.appendChild(s);
      old.remove();
    });
    while (wrap.firstChild) host.appendChild(wrap.firstChild);
  }, [checkoutHtml]);

  async function login() {
    sessionStorage.setItem("cp_auth_next", "fiyatlandirma.html");
    await CPAuth.signInWithGoogle(location.origin + "/auth-callback.html");
  }

  async function startCheckout(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const res = await CPAuth.createIyzicoCheckout({
      name: form.name,
      surname: form.surname,
      gsmNumber: form.gsmNumber,
    });
    setBusy(false);
    if (!res || !res.ok) {
      setErr((res && (res.message || res.error)) || "Ödeme formu başlatılamadı. iyzico ayarlarını kontrol et.");
      return;
    }
    setCheckoutHtml(res.checkoutFormContent || "");
  }

  return (
    <div className="pf-page">
      <div className="pf-top">
        <a href="index.html" style={{ fontWeight: 700, color: "var(--accent)" }}>Career Pick</a>
        <div className="pf-top-actions">
          <a className="pf-link" href="profil.html">Profil</a>
          <a className="pf-link" href="kariyer%20sohbet.html">Sohbet</a>
        </div>
      </div>
      <div className="pf-shell" style={{ maxWidth: 560 }}>
        <header className="pf-head">
          <h1>Career Pick Plus</h1>
          <p>Ekstra sohbet turları için aylık abonelik. Troy kart ve TL desteklenir (iyzico).</p>
        </header>

        {billingStatus === "failed" ? (
          <p className="pf-muted" style={{ color: "#e8a860" }}>Ödeme tamamlanamadı. Tekrar deneyebilirsin.</p>
        ) : null}

        {!ready ? (
          <p className="pf-muted">Yükleniyor…</p>
        ) : !user ? (
          <div className="pf-login-card">
            <p>Plus’a geçmek için Gmail ile giriş yap.</p>
            <button className="pf-btn" type="button" onClick={login}>Gmail ile giriş</button>
          </div>
        ) : plan === "plus" ? (
          <div className="pw-plan-card">
            <span className="pw-badge plus">Plus</span>
            <p>Aboneliğin aktif. İptal için profil sayfasını kullan.</p>
            <a className="pf-link" href="profil.html">Profile git</a>
          </div>
        ) : (
          <React.Fragment>
            <div className="pw-plan-card">
              <h3>Free</h3>
              <ul>
                <li>1 tamamlanmış Kariyer Sohbeti</li>
                <li>Kayıtlı profil, yol haritası, pratikler</li>
              </ul>
              <h3>Plus <span className="pw-price">Aylık</span></h3>
              <ul>
                <li>Ayda 5 ekstra sohbet turu</li>
                <li>Önceki vs şimdi karşılaştırmaları</li>
                <li>Profil ve check-in aynı şekilde kalır</li>
              </ul>
              <p className="pf-muted" style={{ fontSize: 13 }}>
                Kart bilgisi CareerPick’e gelmez; yalnızca iyzico ödeme formunda işlenir.
                Fiyat iyzico panelindeki plana göre tahsil edilir.
              </p>
            </div>

            {!checkoutHtml ? (
              <form className="pw-form" onSubmit={startCheckout}>
                <label>
                  Ad
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm(Object.assign({}, form, { name: e.target.value }))}
                    disabled={busy}
                  />
                </label>
                <label>
                  Soyad
                  <input
                    required
                    value={form.surname}
                    onChange={(e) => setForm(Object.assign({}, form, { surname: e.target.value }))}
                    disabled={busy}
                  />
                </label>
                <label>
                  Telefon (+90…)
                  <input
                    required
                    placeholder="+90555…"
                    value={form.gsmNumber}
                    onChange={(e) => setForm(Object.assign({}, form, { gsmNumber: e.target.value }))}
                    disabled={busy}
                  />
                </label>
                {err ? <p className="pw-err">{err}</p> : null}
                <button className="pf-btn" type="submit" disabled={busy}>
                  {busy ? "Hazırlanıyor…" : "iyzico ile öde"}
                </button>
              </form>
            ) : (
              <div>
                <p className="pf-muted">Ödeme formu yükleniyor…</p>
                <div id="iyzipay-checkout-form" className="responsive" />
              </div>
            )}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<FiyatlandirmaPage />);
