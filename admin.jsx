/* global React, ReactDOM, CPAuth */
const { useState, useEffect, useCallback } = React;

/** Yeni sekme eklemek: bu diziye { id, label, soon? } ekle; TAB_PANELS'e panel koy. */
const TABS = [
  { id: "rec-quality", label: "Öneri kalitesi" },
  { id: "billing", label: "Abonelik", soon: true },
  { id: "quota", label: "Kota", soon: true },
  { id: "users", label: "Kullanıcı ara", soon: true },
  { id: "funnel", label: "Sohbet hunisi", soon: true },
];

function StatBox({ label, value, hint }) {
  return (
    <div className="adm-stat">
      <div className="adm-stat-val">{value}</div>
      <div className="adm-stat-label">{label}</div>
      {hint ? <div className="adm-stat-hint">{hint}</div> : null}
    </div>
  );
}

function SoonPanel({ title }) {
  return (
    <div className="adm-soon">
      <h2>{title}</h2>
      <p>Bu sekme ayrı bir görevde eklenecek. Kabuk hazır.</p>
    </div>
  );
}

function RecQualityPanel({ data, loading, err, days, onDays, onRefresh }) {
  if (loading) return <p className="adm-muted">Yükleniyor…</p>;
  if (err) return <p className="adm-err">{err}</p>;
  if (!data) return null;

  const empty = data.empty || {};
  const gaps = data.sectorGaps || {};
  const weak = data.weakJobMatch || {};
  const thin = data.thin || {};

  return (
    <div className="adm-sections">
      <div className="adm-toolbar">
        <label>
          Dönem
          <select value={days} onChange={(e) => onDays(Number(e.target.value))}>
            <option value={30}>30 gün</option>
            <option value={90}>90 gün</option>
            <option value={180}>180 gün</option>
          </select>
        </label>
        <button type="button" className="adm-btn" onClick={onRefresh}>Yenile</button>
      </div>

      {/* 1 — Boş öneri */}
      <section className="adm-block">
        <h2>1. Boş öneri takibi</h2>
        <p className="adm-desc">
          Sohbet sonucunda eğitim önerisi üretilmeyen turlar — sektör / hedef kırılımı (en sık üstte).
        </p>
        <div className="adm-stats">
          <StatBox label="Boş tur" value={empty.totalEmpty || 0} />
          <StatBox label="Farklı sektör×hedef" value={empty.distinctPairs || 0} />
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Sektör (ham)</th>
                <th>Hedef (ham)</th>
                <th>Kova</th>
                <th>Adet</th>
                <th>Son</th>
              </tr>
            </thead>
            <tbody>
              {(empty.rows || []).length === 0 ? (
                <tr><td colSpan={5} className="adm-muted">Kayıt yok (migration + yeni sohbet turları gerekir).</td></tr>
              ) : (empty.rows || []).map((r, i) => (
                <tr key={i}>
                  <td>{r.sektor_raw}</td>
                  <td>{r.hedef_raw}</td>
                  <td><code>{r.sektor_key}</code></td>
                  <td>{r.count}</td>
                  <td>{r.last_at ? new Date(r.last_at).toLocaleDateString("tr-TR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2 — Sektör notu boşlukları */}
      <section className="adm-block">
        <h2>2. Sektör notu boşlukları</h2>
        <p className="adm-desc">
          Çok sorulan <code>hedef_sektor</code> cevapları ile <code>sector_notes</code> anahtarları —
          genel fallback’e düşenler öne çıkar.
        </p>
        <div className="adm-stats">
          <StatBox label="Sektör cevabı" value={gaps.totalAnswers || 0} />
          <StatBox label="Not anahtarı" value={(gaps.noteKeys || []).length} />
          <StatBox label="Gap satırı" value={(gaps.gaps || []).length} />
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>sektör_key</th>
                <th>Soru adedi</th>
                <th>Not var?</th>
                <th>Örnek ham cevaplar</th>
              </tr>
            </thead>
            <tbody>
              {(gaps.gaps || []).length === 0 ? (
                <tr><td colSpan={4} className="adm-muted">Gap yok veya veri yok.</td></tr>
              ) : (gaps.gaps || []).map((r, i) => (
                <tr key={i}>
                  <td><code>{r.sektor_key}</code></td>
                  <td>{r.ask_count}</td>
                  <td>{r.has_notes ? "evet" : "hayır"}</td>
                  <td>{(r.sample_raw || []).join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(gaps.unmatchedRaw || []).length ? (
          <div className="adm-sub">
            <h3>Genel’e düşen ham cevaplar (top)</h3>
            <ul className="adm-list">
              {(gaps.unmatchedRaw || []).slice(0, 12).map((r, i) => (
                <li key={i}><strong>{r.count}×</strong> {r.raw}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* 3 — İlan uyumu */}
      <section className="adm-block">
        <h2>3. İlan uyumu — zayıf skor</h2>
        <p className="adm-desc">
          <code>fit_score</code> &lt; {weak.threshold || 55} kayıtlar ve job_match eğitimlerinde placeholder oranı.
        </p>
        <div className="adm-stats">
          <StatBox label="Zayıf eşleşme" value={weak.weakCount || 0} hint={`eşik ${weak.threshold}`} />
          <StatBox label="Toplam ilan analizi" value={weak.totalMatches || 0} />
          <StatBox
            label="Placeholder %"
            value={`${weak.placeholderRate || 0}%`}
            hint={`${weak.placeholderCount || 0} / ${weak.jobMatchTrainingCount || 0}`}
          />
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>İlan</th>
                <th>Skor</th>
                <th>Boşluk #</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {(weak.rows || []).length === 0 ? (
                <tr><td colSpan={4} className="adm-muted">Zayıf skor kaydı yok.</td></tr>
              ) : (weak.rows || []).map((r) => (
                <tr key={r.id}>
                  <td>{r.job_title}</td>
                  <td>{r.fit_score}</td>
                  <td>{r.gap_count}</td>
                  <td>{r.created_at ? new Date(r.created_at).toLocaleDateString("tr-TR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4 — Yarı boş */}
      <section className="adm-block">
        <h2>4. Yarı boş / düşük skorlu öneri</h2>
        <p className="adm-desc">
          Qdrant hit var ama az kart (1–2) veya düşük top skor — normalde 4–6 beklenir.
        </p>
        <div className="adm-stats">
          <StatBox label="Olay" value={thin.eventCount || 0} />
          <StatBox label="İnce session (training)" value={thin.thinSessionCount || 0} />
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Sektör</th>
                <th>Hedef</th>
                <th>Kart</th>
                <th>Qdrant hit</th>
                <th>Top skor</th>
                <th>Outcome</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {(thin.rows || []).length === 0 ? (
                <tr><td colSpan={7} className="adm-muted">Kayıt yok.</td></tr>
              ) : (thin.rows || []).map((r, i) => (
                <tr key={i}>
                  <td>{r.sektor_raw || "—"}</td>
                  <td>{r.hedef_raw || "—"}</td>
                  <td>{r.final_rec_count}</td>
                  <td>{r.qdrant_hit_count}</td>
                  <td>{r.top_score != null ? Number(r.top_score).toFixed(3) : "—"}</td>
                  <td><code>{r.outcome}</code></td>
                  <td>{r.created_at ? new Date(r.created_at).toLocaleDateString("tr-TR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AdminApp() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState("rec-quality");
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

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
        const p = await CPAuth.fetchProfile();
        setIsAdmin(!!(p && p.is_admin));
      }
      setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  const loadQuality = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setErr("");
    try {
      const c = await CPAuth.getClient();
      const { data: sess } = await c.auth.getSession();
      const token = sess.session && sess.session.access_token;
      if (!token) throw new Error("Oturum yok");
      const r = await fetch("/api/admin/recommendation-quality", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ days }),
      });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        throw new Error(
          (json && (json.message || json.error)) || ("HTTP " + r.status)
        );
      }
      setData(json);
    } catch (e) {
      setErr(e.message || "Yükleme hatası");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, days]);

  useEffect(() => {
    if (ready && isAdmin && tab === "rec-quality") loadQuality();
  }, [ready, isAdmin, tab, loadQuality]);

  async function login() {
    sessionStorage.setItem("cp_auth_next", "admin.html");
    await CPAuth.signInWithGoogle(location.origin + "/auth-callback.html");
  }

  async function logout() {
    await CPAuth.signOut();
    setUser(null);
    setIsAdmin(false);
    setData(null);
  }

  let body = null;
  if (!ready) {
    body = <p className="adm-muted">Oturum kontrol ediliyor…</p>;
  } else if (!user) {
    body = (
      <div className="adm-gate">
        <h2>Admin girişi</h2>
        <p>Yalnızca yetkili hesaplar. Gmail ile giriş yap.</p>
        <button type="button" className="adm-btn" onClick={login}>Gmail ile giriş</button>
      </div>
    );
  } else if (!isAdmin) {
    body = (
      <div className="adm-gate">
        <h2>Erişim yok</h2>
        <p>
          Bu hesap admin değil. <code>profiles.is_admin</code> yalnızca Supabase üzerinden
          (service role) açılır.
        </p>
        <button type="button" className="adm-btn ghost" onClick={logout}>Çıkış</button>
      </div>
    );
  } else {
    const active = TABS.find((t) => t.id === tab) || TABS[0];
    body = (
      <React.Fragment>
        <nav className="adm-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={"adm-tab" + (tab === t.id ? " active" : "") + (t.soon ? " soon" : "")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.soon ? <span className="adm-soon-badge">yakında</span> : null}
            </button>
          ))}
        </nav>
        <div className="adm-panel" role="tabpanel">
          {tab === "rec-quality" ? (
            <RecQualityPanel
              data={data}
              loading={loading}
              err={err}
              days={days}
              onDays={setDays}
              onRefresh={loadQuality}
            />
          ) : (
            <SoonPanel title={active.label} />
          )}
        </div>
      </React.Fragment>
    );
  }

  return (
    <div className="adm-page">
      <header className="adm-top">
        <a href="index.html" className="adm-brand">Career Pick</a>
        <span className="adm-title">Admin</span>
        <div className="adm-top-actions">
          {user ? (
            <React.Fragment>
              <span className="adm-user">{user.email || ""}</span>
              <button type="button" className="adm-btn ghost" onClick={logout}>Çıkış</button>
            </React.Fragment>
          ) : null}
        </div>
      </header>
      <main className="adm-main">{body}</main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AdminApp />);
