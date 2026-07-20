/* global React, ReactDOM, CPAuth, CPShareCardVisual */
const { useState, useEffect } = React;

function OzetPage() {
  const [status, setStatus] = useState("loading"); // loading | ok | missing
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const params = new URLSearchParams(location.search || "");
      const token = (params.get("t") || "").trim();
      if (!token) {
        if (alive) setStatus("missing");
        return;
      }
      try {
        await CPAuth.init();
        const row = await CPAuth.fetchShareCardByToken(token);
        if (!alive) return;
        if (!row || !row.is_public || !row.payload_json) {
          setStatus("missing");
          return;
        }
        const p = typeof row.payload_json === "string"
          ? JSON.parse(row.payload_json)
          : row.payload_json;
        if (!p || p.empty) {
          setStatus("missing");
          return;
        }
        setPayload(p);
        setStatus("ok");
      } catch (e) {
        if (alive) setStatus("missing");
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="pf-page">
      <div className="pf-top">
        <a href="index.html" style={{ display: "inline-flex", fontWeight: 700, color: "var(--accent)" }}>Career Pick</a>
        <a className="pf-link" href="kariyer%20sohbet.html">Kariyer Sohbeti</a>
      </div>
      <div className="pf-shell" style={{ maxWidth: 640 }}>
        <header className="pf-head">
          <h1>Kariyer özeti</h1>
          <p>Paylaşılan yetkinlik ve yol özeti — yaklaşık bir gelişim sinyali.</p>
        </header>
        {status === "loading" ? (
          <p className="pf-muted">Yükleniyor…</p>
        ) : status === "missing" ? (
          <p className="pf-muted">Bu özet bulunamadı veya herkese açık değil.</p>
        ) : (
          <React.Fragment>
            {typeof CPShareCardVisual === "function" ? (
              <CPShareCardVisual payload={payload} />
            ) : null}
            <p className="pf-muted" style={{ marginTop: 18 }}>
              Yaklaşık gelişim sinyali — bilimsel ölçüm veya işe alım garantisi değil.
            </p>
            <p style={{ marginTop: 20 }}>
              <a className="pf-btn" href="kariyer%20sohbet.html" style={{ display: "inline-block", textDecoration: "none" }}>
                Career Pick’te kendi yolunu çıkar
              </a>
            </p>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<OzetPage />);
