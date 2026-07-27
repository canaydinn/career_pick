/* global React */
(function (global) {
  function PaywallModal({ open, onClose, labels, reason }) {
    if (!open) return null;
    const L = labels || {};
    const isLimit = reason === "plus_limit";
    return (
      <div className="pw-overlay" role="dialog" aria-modal="true">
        <div className="pw-modal">
          <h2>{isLimit ? (L.limitTitle || "Aylık limit doldu") : (L.title || "Ücretsiz hakkını kullandın")}</h2>
          <p>
            {isLimit
              ? (L.limitBody || "Bu ay Plus sohbet limitine ulaştın. Gelecek dönemde kotan yenilenir.")
              : (L.body || "Bir ücretsiz sohbet hakkını tamamladın. Profilindeki yol haritası, eğitimler ve check-in kayıtların yerinde — kaybolmaz.")}
          </p>
          <div className="pw-actions">
            {!isLimit ? (
              <a className="pw-btn primary" href="fiyatlandirma.html">{L.cta || "Plus’a geç"}</a>
            ) : null}
            <button type="button" className="pw-btn" onClick={onClose}>{L.close || "Tamam"}</button>
            <a className="pw-link" href="profil.html">{L.profile || "Profile git"}</a>
          </div>
        </div>
      </div>
    );
  }

  global.CPPaywallModal = PaywallModal;
})(typeof window !== "undefined" ? window : globalThis);
