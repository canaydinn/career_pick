/* global React, CPIcon, CPLogo, CPChatbot */
const { useState: useStateS, useEffect: useEffectS, useRef: useRefS } = React;
const Ic = window.CPIcon;

/* reveal entrance is now pure-CSS (see styles.css); no JS needed */
function useReveal() {}

/* ---------- Nav ---------- */
function Nav({ c, lang, setLang, base }) {
  const [scrolled, setScrolled] = useStateS(false);
  const b = base || "";
  useEffectS(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav className={"nav" + (scrolled ? " scrolled" : "")}>
      <div className="wrap nav-in">
        <a href={b || "#"} aria-label="Career Pick" style={{ display: "inline-flex" }}><CPLogo /></a>
        <div className="nav-links">
          <a href={b + "#features"}>{c.nav.features}</a>
          <a href={b + "#how"}>{c.nav.how}</a>
          <a href={b + "#reviews"}>{c.nav.reviews}</a>
          <a href={b + "#faq"}>{c.nav.faq}</a>
        </div>
        <div className="nav-right">
          <div className="lang-toggle">
            <button className={lang === "tr" ? "on" : ""} onClick={() => setLang("tr")}>TR</button>
            <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          <a href={b ? b + "#chatbox" : "#chat"} className="btn btn-primary" style={{ padding: "11px 20px", fontSize: 14 }}>{c.nav.cta}</a>
        </div>
      </div>
    </nav>
  );
}

/* ---------- Hero ---------- */
function Hero({ c }) {
  const t = c.hero;
  return (
    <header className="hero" id="chat">
      <div className="aura" style={{ width: 620, height: 620, top: -200, left: -160, background: "radial-gradient(circle, var(--glow-1), transparent 70%)" }}></div>
      <div className="aura" style={{ width: 520, height: 520, top: -120, right: -120, background: "radial-gradient(circle, var(--glow-2), transparent 70%)" }}></div>
      <div className="aura" style={{ width: 400, height: 400, bottom: -180, left: "40%", background: "radial-gradient(circle, var(--glow-1), transparent 70%)", opacity: .5 }}></div>
      <div className="wrap hero-grid">
        <div className="hero-copy reveal">
          <div className="hero-badge"><span className="pill">AI</span>{t.badge}</div>
          <h1>
            {t.title[0]} <span className="grad">{t.title[1]}</span> {t.title[2]}
          </h1>
          <p className="hero-sub">{t.sub}</p>
          <div className="hero-cta">
            <a href="#chatbox" className="btn btn-primary">{t.ctaPrimary} <Ic name="arrow" size={17} /></a>
            <a href="#how" className="btn btn-ghost">{t.ctaSecondary}</a>
          </div>
          <div className="hero-stats">
            {t.stats.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <div className="div"></div>}
                <div>
                  <div className="s-n">{s.n}</div>
                  <div className="s-l">{s.l}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="reveal" id="chatbox" style={{ animationDelay: ".12s" }}>
          <CPChatbot c={c.chat} />
        </div>
      </div>
    </header>
  );
}

/* ---------- Features ---------- */
function Features({ c }) {
  const f = c.features;
  return (
    <section className="section" id="features">
      <div className="wrap">
        <div className="section-head reveal">
          <span className="eyebrow">{f.kicker}</span>
          <h2 className="section-title">{f.title}</h2>
          <p>{f.sub}</p>
        </div>
        <div className="feat-grid">
          {f.items.map((it, i) => (
            <div className="feat-card reveal" key={i} style={{ animationDelay: (i * 0.08) + "s" }}>
              <span className="num">0{i + 1}</span>
              <div className="ic"><Ic name={it.icon} size={26} /></div>
              <h3>{it.title}</h3>
              <p>{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- How ---------- */
function How({ c }) {
  const h = c.how;
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="section-head center reveal">
          <span className="eyebrow">{h.kicker}</span>
          <h2 className="section-title">{h.title}</h2>
        </div>
        <div className="how-grid">
          {h.steps.map((s, i) => (
            <div className="step reveal" key={i} style={{ animationDelay: (i * 0.1) + "s" }}>
              <span className="sn">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Reviews ---------- */
function Reviews({ c }) {
  const r = c.reviews;
  return (
    <section className="section" id="reviews">
      <div className="wrap">
        <div className="section-head center reveal">
          <span className="eyebrow">{r.kicker}</span>
          <h2 className="section-title">{r.title}</h2>
        </div>
        <div className="rev-grid">
          {r.items.map((it, i) => (
            <div className="rev-card reveal" key={i} style={{ animationDelay: (i * 0.08) + "s" }}>
              <div className="rev-stars">
                {[0,1,2,3,4].map((s) => (
                  <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.5 6.5L21 10l-5 4.2L17.5 21 12 17.3 6.5 21 8 14.2 3 10l6.5-.5z"/></svg>
                ))}
              </div>
              <p className="q">"{it.quote}"</p>
              <div className="rev-who">
                <span className="rev-ava">{it.name.charAt(0)}</span>
                <div>
                  <div className="rev-name">{it.name}</div>
                  <div className="rev-role">{it.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
function Faq({ c }) {
  const f = c.faq;
  const [open, setOpen] = useStateS(0);
  return (
    <section className="section" id="faq">
      <div className="wrap">
        <div className="section-head center reveal">
          <span className="eyebrow">{f.kicker}</span>
          <h2 className="section-title">{f.title}</h2>
        </div>
        <div className="faq-list reveal">
          {f.items.map((it, i) => (
            <div className={"faq-item" + (open === i ? " open" : "")} key={i}>
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                <span>{it.q}</span>
                <span className="ico"><Ic name="plus" size={22} /></span>
              </button>
              <div className="faq-a" style={{ maxHeight: open === i ? 240 : 0 }}>
                <div className="faq-a-inner">{it.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */
function Footer({ c, base }) {
  const f = c.footer;
  const b = base || "";
  return (
    <footer>
      <div className="wrap">
        <div className="cta-band reveal">
          <div className="aura" style={{ width: 380, height: 380, top: -120, left: "20%", background: "radial-gradient(circle, var(--glow-1), transparent 70%)", opacity: .6 }}></div>
          <div className="aura" style={{ width: 300, height: 300, bottom: -120, right: "15%", background: "radial-gradient(circle, var(--glow-2), transparent 70%)", opacity: .5 }}></div>
          <div style={{ position: "relative", zIndex: 2 }}>
            <h2>{f.title}</h2>
            <p>{f.sub}</p>
            <a href={b ? b + "#chatbox" : "#chatbox"} className="btn btn-mint">{f.cta} <Ic name="arrow" size={17} /></a>
          </div>
        </div>
      </div>
      <div className="wrap footer">
        <div className="foot-grid">
          <div className="foot-brand">
            <CPLogo />
            <p>{c.hero.badge}</p>
          </div>
          {f.cols.map((col, i) => (
            <div className="foot-col" key={i}>
              <h4>{col.h}</h4>
              {col.links.map((l, j) => <a href={l.h} key={j}>{l.l}</a>)}
            </div>
          ))}
        </div>
        <div className="foot-bottom">
          <span>{f.rights}</span>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Ic name="globe" size={14} /> Türkçe / English</span>
        </div>
      </div>
    </footer>
  );
}

window.CPNav = Nav;
window.CPHero = Hero;
window.CPFeatures = Features;
window.CPHow = How;
window.CPReviews = Reviews;
window.CPFaq = Faq;
window.CPFooter = Footer;
window.CPuseReveal = useReveal;
