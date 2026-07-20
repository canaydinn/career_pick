/* global React, CPAuth, CPShareCard */
/* Paylasim karti modal — profil ve sohbet ortak */
(function (global) {
  const { useState, useEffect } = React;

  function ShareCardVisual({ payload }) {
    if (!payload || payload.empty) return null;
    return (
      <div className="sc-card" aria-hidden="true">
        <div className="sc-card-brand">{payload.brand || "Career Pick"}</div>
        {payload.display_name ? <div className="sc-card-name">{payload.display_name}</div> : null}
        {payload.goal ? <h3 className="sc-card-goal">{payload.goal}</h3> : (
          <h3 className="sc-card-goal">{payload.locale === "en" ? "My career focus" : "Kariyer odağım"}</h3>
        )}
        {(payload.skills || []).length ? (
          <div className="sc-card-skills">
            {(payload.skills || []).map((s, i) => (
              <span key={i} className={"sc-chip " + (s.strong ? "strong" : "dev")}>
                {s.name} · {s.label}
              </span>
            ))}
          </div>
        ) : null}
        {(payload.steps || []).length ? (
          <div className="sc-card-path">
            {(payload.steps || []).map((s, i) => (
              <span key={i}>
                {i > 0 ? <span className="sc-arrow"> → </span> : null}
                <span>{(i + 1) + ". " + s.title}</span>
              </span>
            ))}
          </div>
        ) : null}
        <p className="sc-card-disc">{payload.disclaimer}</p>
        <div className="sc-card-url">{payload.app_url}</div>
      </div>
    );
  }

  function ShareCardModal({ open, onClose, locale, labels, skills }) {
    const L = labels || {};
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(false);
    const [includeName, setIncludeName] = useState(false);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");
    const [publicUrl, setPublicUrl] = useState("");

    useEffect(() => {
      if (!open || !window.CPAuth) return;
      let alive = true;
      setLoading(true);
      setMsg("");
      setPublicUrl("");
      CPAuth.buildShareCardPayload({
        locale: locale || "tr",
        includeName: includeName,
        skills: skills || null,
      }).then((p) => {
        if (!alive) return;
        setPayload(p);
        setLoading(false);
      }).catch(() => {
        if (!alive) return;
        setPayload({ ok: false, empty: true });
        setLoading(false);
      });
      return () => { alive = false; };
    }, [open, includeName, locale, skills]);

    if (!open) return null;

    async function onDownload() {
      if (!payload || payload.empty || !window.CPShareCard) return;
      setBusy(true);
      setMsg("");
      try {
        await CPShareCard.downloadPng(payload, "careerpick-ozet.png");
        setMsg(L.downloaded || "PNG indirildi");
      } catch (e) {
        setMsg(L.downloadError || "İndirme başarısız");
      }
      setBusy(false);
    }

    async function onCopy() {
      if (!payload || payload.empty || !window.CPShareCard) return;
      setBusy(true);
      const text = CPShareCard.linkedInText(payload);
      const ok = await CPShareCard.copyText(text);
      setMsg(ok ? (L.copied || "Metin kopyalandı") : (L.copyError || "Kopyalanamadı"));
      setBusy(false);
    }

    async function onCreateLink() {
      if (!payload || payload.empty || !window.CPAuth) return;
      setBusy(true);
      setMsg("");
      try {
        const res = await CPAuth.saveShareCard(payload, { isPublic: true });
        if (res && res.ok && res.url) {
          setPublicUrl(res.url);
          if (window.CPShareCard) await CPShareCard.copyText(res.url);
          setMsg(L.linkReady || "Link kopyalandı");
        } else {
          setMsg(L.linkError || "Link oluşturulamadı (migration gerekir)");
        }
      } catch (e) {
        setMsg(L.linkError || "Link oluşturulamadı");
      }
      setBusy(false);
    }

    return (
      <div className="sc-overlay" role="dialog" aria-modal="true" aria-label={L.title || "Özet kartı"}>
        <div className="sc-modal">
          <div className="sc-modal-head">
            <h2>{L.title || "Özet kartı"}</h2>
            <button type="button" className="sc-close" onClick={onClose} aria-label={L.close || "Kapat"}>×</button>
          </div>

          {loading ? (
            <p className="sc-muted">{L.loading || "…"}</p>
          ) : payload && payload.empty ? (
            <p className="sc-empty">{L.empty || "Önce Kariyer Sohbetini tamamla."}</p>
          ) : (
            <React.Fragment>
              <label className="sc-toggle-name">
                <input
                  type="checkbox"
                  checked={includeName}
                  onChange={(e) => setIncludeName(e.target.checked)}
                  disabled={busy}
                />
                {L.showName || "İsmimi kartta göster"}
              </label>
              <ShareCardVisual payload={payload} />
              <p className="sc-hint">{L.hint || ""}</p>
              <div className="sc-actions">
                <button type="button" className="sc-btn primary" onClick={onDownload} disabled={busy}>
                  {L.downloadPng || "PNG indir"}
                </button>
                <button type="button" className="sc-btn" onClick={onCopy} disabled={busy}>
                  {L.copyText || "Metni kopyala"}
                </button>
                <button type="button" className="sc-btn" onClick={onCreateLink} disabled={busy}>
                  {L.createLink || "Public link"}
                </button>
              </div>
              {publicUrl ? (
                <p className="sc-link"><a href={publicUrl} target="_blank" rel="noopener noreferrer">{publicUrl}</a></p>
              ) : null}
              {msg ? <p className="sc-msg">{msg}</p> : null}
            </React.Fragment>
          )}
        </div>
      </div>
    );
  }

  global.CPShareCardModal = ShareCardModal;
  global.CPShareCardVisual = ShareCardVisual;
})(typeof window !== "undefined" ? window : globalThis);
