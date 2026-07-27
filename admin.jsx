/* global React, ReactDOM, CPAuth */
const { useState, useEffect, useCallback } = React;

/** Yeni sekme eklemek: bu diziye { id, label } ekle; ilgili paneli render et. */
const TABS = [
  { id: "rec-quality", label: "Öneri kalitesi" },
  { id: "billing", label: "Abonelik" },
  { id: "quota", label: "Kota" },
  { id: "users", label: "Kullanıcı ara" },
  { id: "funnel", label: "Sohbet hunisi" },
  { id: "engagement", label: "Etkileşim" },
];

const OPS_TABS = new Set(["billing", "quota", "users", "funnel", "engagement"]);

function StatBox({ label, value, hint }) {
  return (
    <div className="adm-stat">
      <div className="adm-stat-val">{value}</div>
      <div className="adm-stat-label">{label}</div>
      {hint ? <div className="adm-stat-hint">{hint}</div> : null}
    </div>
  );
}

function fmtDate(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("tr-TR");
  } catch (e) {
    return String(v);
  }
}

async function getAdminToken() {
  const c = await CPAuth.getClient();
  const { data: sess } = await c.auth.getSession();
  const token = sess.session && sess.session.access_token;
  if (!token) throw new Error("Oturum yok");
  return token;
}

async function adminFetch(action, { days, q } = {}) {
  const token = await getAdminToken();
  const body = { action };
  if (days != null) body.days = days;
  if (q != null) body.q = q;
  const r = await fetch("/api/admin/ops", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  if (!r.ok || !json.ok) {
    throw new Error((json && json.error) || ("HTTP " + r.status));
  }
  return json;
}

function UnavailableNote({ reason }) {
  return (
    <p className="adm-err">
      Veri yok — migration gerekir.
      {reason ? <span className="adm-muted"> ({reason})</span> : null}
    </p>
  );
}

function DaysToolbar({ days, onDays, onRefresh, loading }) {
  return (
    <div className="adm-toolbar">
      <label>
        Dönem
        <select value={days} onChange={(e) => onDays(Number(e.target.value))}>
          <option value={30}>30 gün</option>
          <option value={90}>90 gün</option>
          <option value={180}>180 gün</option>
          <option value={365}>365 gün</option>
        </select>
      </label>
      <button type="button" className="adm-btn" onClick={onRefresh} disabled={loading}>
        Yenile
      </button>
    </div>
  );
}

function BillingPanel({ data, loading, err, onRefresh }) {
  if (loading) return <p className="adm-muted">Yükleniyor…</p>;
  if (err) return <p className="adm-err">{err}</p>;
  if (!data) return null;
  if (data.available === false) return <UnavailableNote reason={data.reason} />;

  const statuses = data.subscriptionStatuses || {};
  const statusRows = Object.keys(statuses).filter((k) => k !== "note").map((k) => ({
    status: k,
    count: statuses[k],
  }));

  return (
    <div className="adm-sections">
      <div className="adm-toolbar">
        <button type="button" className="adm-btn" onClick={onRefresh}>Yenile</button>
      </div>
      <section className="adm-section">
        <h2>Plan dağılımı</h2>
        <div className="adm-stats">
          <StatBox label="Free" value={data.free || 0} />
          <StatBox label="Plus" value={data.plus || 0} />
          <StatBox label="Toplam profil" value={data.total || 0} />
        </div>
      </section>
      {statusRows.length ? (
        <section className="adm-section">
          <h2>Abonelik durumu</h2>
          <table className="adm-table">
            <thead><tr><th>Status</th><th>Adet</th></tr></thead>
            <tbody>
              {statusRows.map((r) => (
                <tr key={r.status}><td>{r.status}</td><td>{r.count}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      <section className="adm-section">
        <h2>Son Plus kullanıcılar</h2>
        <table className="adm-table">
          <thead>
            <tr><th>E-posta</th><th>Ad</th><th>Bitiş</th></tr>
          </thead>
          <tbody>
            {(data.recentPlus || []).length === 0 ? (
              <tr><td colSpan={3} className="adm-muted">Plus yok</td></tr>
            ) : (data.recentPlus || []).map((r, i) => (
              <tr key={r.email + i}>
                <td>{r.email}</td>
                <td>{r.display_name || "—"}</td>
                <td>{fmtDate(r.plan_expires_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {(data.recentSubscriptions || []).length ? (
        <section className="adm-section">
          <h2>Son abonelik kayıtları</h2>
          <table className="adm-table">
            <thead>
              <tr><th>E-posta</th><th>Status</th><th>Dönem sonu</th><th>Oluşturulma</th></tr>
            </thead>
            <tbody>
              {(data.recentSubscriptions || []).map((r, i) => (
                <tr key={i}>
                  <td>{r.email}</td>
                  <td>{r.status}</td>
                  <td>{fmtDate(r.current_period_end)}</td>
                  <td>{fmtDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

function QuotaPanel({ data, loading, err, days, onDays, onRefresh }) {
  if (loading) return <p className="adm-muted">Yükleniyor…</p>;
  if (err) return <p className="adm-err">{err}</p>;
  if (!data) return null;
  if (data.available === false) return <UnavailableNote reason={data.reason} />;

  return (
    <div className="adm-sections">
      <DaysToolbar days={days} onDays={onDays} onRefresh={onRefresh} loading={loading} />
      <section className="adm-section">
        <h2>Kota özeti</h2>
        <div className="adm-stats">
          <StatBox label="Free kullanılan (toplam)" value={data.freeUsedSum || 0} />
          <StatBox label="Plus kullanılan (toplam)" value={data.plusUsedSum || 0} />
          <StatBox label="Limiti dolu free" value={data.exhaustedFreeCount || 0} hint={`limit ${data.freeChatLimit}`} />
          <StatBox label="Dönem chat_completions" value={data.completionsInPeriod || 0} />
        </div>
      </section>
      <section className="adm-section">
        <h2>Free limiti dolu</h2>
        <table className="adm-table">
          <thead>
            <tr><th>E-posta</th><th>Plan</th><th>Free</th><th>Plus</th><th>Dönem</th></tr>
          </thead>
          <tbody>
            {(data.exhaustedRows || []).length === 0 ? (
              <tr><td colSpan={5} className="adm-muted">Yok</td></tr>
            ) : (data.exhaustedRows || []).map((r, i) => (
              <tr key={r.email + i}>
                <td>{r.email}</td>
                <td>{r.plan}</td>
                <td>{r.free_chats_used}</td>
                <td>{r.plus_chats_used}</td>
                <td>{fmtDate(r.period_start)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function UsersPanel({ data, loading, err, q, onQ, onSearch }) {
  return (
    <div className="adm-sections">
      <div className="adm-toolbar">
        <label>
          Ara
          <input
            type="search"
            value={q}
            onChange={(e) => onQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
            placeholder="e-posta veya ad"
            style={{ minWidth: "14rem" }}
          />
        </label>
        <button type="button" className="adm-btn" onClick={onSearch} disabled={loading}>
          Ara
        </button>
      </div>
      {loading ? <p className="adm-muted">Yükleniyor…</p> : null}
      {err ? <p className="adm-err">{err}</p> : null}
      {data && data.available === false ? <UnavailableNote reason={data.reason} /> : null}
      {data && data.needQuery ? (
        <p className="adm-muted">En az 2 karakter yazıp ara.</p>
      ) : null}
      {data && data.available !== false && !data.needQuery ? (
        <section className="adm-section">
          <h2>Sonuçlar ({data.total || 0})</h2>
          <table className="adm-table">
            <thead>
              <tr>
                <th>E-posta</th>
                <th>Ad</th>
                <th>Plan</th>
                <th>Free chat</th>
                <th>Kayıt</th>
                <th>Son snapshot</th>
              </tr>
            </thead>
            <tbody>
              {(data.rows || []).length === 0 ? (
                <tr><td colSpan={6} className="adm-muted">Eşleşme yok</td></tr>
              ) : (data.rows || []).map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>{r.display_name || "—"}</td>
                  <td>{r.plan}</td>
                  <td>{r.free_chats_used == null ? "—" : r.free_chats_used}</td>
                  <td>{fmtDate(r.created_at)}</td>
                  <td>{fmtDate(r.last_snapshot_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

function FunnelPanel({ data, loading, err, days, onDays, onRefresh }) {
  if (loading) return <p className="adm-muted">Yükleniyor…</p>;
  if (err) return <p className="adm-err">{err}</p>;
  if (!data) return null;
  if (data.available === false) return <UnavailableNote reason={data.reason} />;

  const steps = data.steps || [];
  const max = Math.max(1, ...steps.map((s) => s.count || 0));

  return (
    <div className="adm-sections">
      <DaysToolbar days={days} onDays={onDays} onRefresh={onRefresh} loading={loading} />
      <section className="adm-section">
        <h2>Sohbet hunisi</h2>
        <div className="adm-stats">
          <StatBox label="Draft" value={data.draftsTotal || 0} />
          <StatBox label="Tamamlanan" value={data.draftsCompleted || 0} />
          <StatBox label="Terk" value={data.draftsAbandoned || 0} />
          <StatBox label="Snapshot" value={data.snapshots || 0} />
        </div>
        <ul className="adm-funnel-list" style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}>
          {steps.map((s) => (
            <li key={s.id} style={{ marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                <span>{s.label}</span>
                <strong>{s.count}</strong>
              </div>
              <div style={{ height: 8, background: "rgba(0,0,0,0.08)", borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    width: ((s.count || 0) / max) * 100 + "%",
                    height: "100%",
                    background: "var(--adm-accent, #2a6f5f)",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function EngagementPanel({ data, loading, err, days, onDays, onRefresh }) {
  if (loading) return <p className="adm-muted">Yükleniyor…</p>;
  if (err) return <p className="adm-err">{err}</p>;
  if (!data) return null;
  if (data.available === false) return <UnavailableNote reason={data.reason} />;

  return (
    <div className="adm-sections">
      <DaysToolbar days={days} onDays={onDays} onRefresh={onRefresh} loading={loading} />
      <section className="adm-section">
        <h2>Etkileşim</h2>
        <div className="adm-stats">
          <StatBox
            label="Hatırlatma opt-in"
            value={(data.remindersRate || 0) + "%"}
            hint={data.remindersOn + " / " + data.profilesTotal}
          />
          <StatBox label="Check-in kullanıcı" value={data.checkinUsers || 0} hint={data.checkinRows + " kayıt"} />
          <StatBox
            label="Mikro pratik yapıldı"
            value={(data.microDoneRate || 0) + "%"}
            hint={data.microDone + " / " + data.microTotal}
          />
          <StatBox label="CV gap analizi" value={data.cvGapCount || 0} />
        </div>
      </section>
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

      {/* 5 — Profil sayfa trafiği */}
      <section className="adm-block">
        <h2>5. Profil sayfa görüntüleme</h2>
        <p className="adm-desc">
          Hub ailesi (<code>product_events</code>) — Bugün / Yolum / Pratikler / Keşif açılışları.
        </p>
        {!(data.pageViews && data.pageViews.available) ? (
          <p className="adm-muted">
            {(data.pageViews && data.pageViews.reason) || "Tablo yok — product_events migration gerekir."}
          </p>
        ) : (
          <React.Fragment>
            <div className="adm-stats">
              <StatBox label="Toplam görüntüleme" value={data.pageViews.total || 0} />
              <StatBox label="Benzersiz kullanıcı" value={data.pageViews.uniqueUsers || 0} />
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Sayfa</th>
                    <th>page_id</th>
                    <th>Adet</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.pageViews.rows || []).map((r) => (
                    <tr key={r.page_id}>
                      <td>{r.label}</td>
                      <td><code>{r.page_id}</code></td>
                      <td>{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </React.Fragment>
        )}
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
  const [opsData, setOpsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [userQ, setUserQ] = useState("");

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
      const token = await getAdminToken();
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
        throw new Error((json && json.error) || ("HTTP " + r.status));
      }
      setData(json);
    } catch (e) {
      setErr(e.message || "Yükleme hatası");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, days]);

  const loadOps = useCallback(async (action, q) => {
    if (!isAdmin) return;
    setLoading(true);
    setErr("");
    try {
      const json = await adminFetch(action, {
        days,
        q: action === "users" ? (q || "") : undefined,
      });
      setOpsData(json.data || null);
    } catch (e) {
      setErr(e.message || "Yükleme hatası");
      setOpsData(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, days]);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    setErr("");
    setOpsData(null);
    if (tab === "rec-quality") {
      loadQuality();
    } else if (OPS_TABS.has(tab) && tab !== "users") {
      loadOps(tab);
    } else if (tab === "users") {
      setOpsData({ available: true, needQuery: true, rows: [], total: 0 });
      setLoading(false);
    }
  }, [ready, isAdmin, tab, days, loadQuality, loadOps]);

  async function login() {
    sessionStorage.setItem("cp_auth_next", "admin.html");
    await CPAuth.signInWithGoogle(location.origin + "/auth-callback.html");
  }

  async function logout() {
    await CPAuth.signOut();
    setUser(null);
    setIsAdmin(false);
    setData(null);
    setOpsData(null);
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
    body = (
      <React.Fragment>
        <nav className="adm-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={"adm-tab" + (tab === t.id ? " active" : "")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
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
          ) : null}
          {tab === "billing" ? (
            <BillingPanel
              data={opsData}
              loading={loading}
              err={err}
              onRefresh={() => loadOps("billing")}
            />
          ) : null}
          {tab === "quota" ? (
            <QuotaPanel
              data={opsData}
              loading={loading}
              err={err}
              days={days}
              onDays={setDays}
              onRefresh={() => loadOps("quota")}
            />
          ) : null}
          {tab === "users" ? (
            <UsersPanel
              data={opsData}
              loading={loading}
              err={err}
              q={userQ}
              onQ={setUserQ}
              onSearch={() => loadOps("users", userQ)}
            />
          ) : null}
          {tab === "funnel" ? (
            <FunnelPanel
              data={opsData}
              loading={loading}
              err={err}
              days={days}
              onDays={setDays}
              onRefresh={() => loadOps("funnel")}
            />
          ) : null}
          {tab === "engagement" ? (
            <EngagementPanel
              data={opsData}
              loading={loading}
              err={err}
              days={days}
              onDays={setDays}
              onRefresh={() => loadOps("engagement")}
            />
          ) : null}
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
