/* global React, ReactDOM, CP_CONTENT, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, CPNav, CPFooter, CPIcon */
const { useState: useStateP, useEffect: useEffectP } = React;
const IcP = window.CPIcon;
const HOME = "index.html";

function Check() { return <span className="ck"><IcP name="check" size={14} /></span>; }

/* ---- Features page ---- */
function FeaturesPage({ c }) {
  const p = c.pages.features;
  return (
    <React.Fragment>
      <section className="page-hero">
        <div className="aura" style={{ width: 560, height: 560, top: -160, left: "10%", background: "radial-gradient(circle, var(--glow-1), transparent 70%)" }}></div>
        <div className="aura" style={{ width: 460, height: 460, top: -120, right: "8%", background: "radial-gradient(circle, var(--glow-2), transparent 70%)" }}></div>
        <div className="wrap inner">
          <a href={HOME} className="crumb"><IcP name="arrow" size={15} /> Career Pick</a>
          <span className="eyebrow">{p.hero.eyebrow}</span>
          <h1>{p.hero.title[0]} <span className="grad">{p.hero.title[1]}</span></h1>
          <p className="ph-sub">{p.hero.sub}</p>
          <a href={"kariyer%20sohbet.html"} className="btn btn-primary">{p.hero.cta} <IcP name="arrow" size={17} /></a>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 30 }}>
        <div className="wrap">
          <div className="deep">
            {p.deep.map((d, i) => (
              <div className="deep-row" key={i}>
                <div className="deep-text">
                  <span className="deep-tag"><IcP name={d.icon} size={15} /> {d.tag}</span>
                  <h2>{d.title}</h2>
                  <p>{d.body}</p>
                  <ul className="deep-points">
                    {d.points.map((pt, j) => <li key={j}><Check /> {pt}</li>)}
                  </ul>
                </div>
                <div className="deep-visual">
                  <div className="dv-head"><span className="dv-ic"><IcP name={d.icon} size={20} /></span><span className="dv-title">{d.title}</span></div>
                  {i === 0 && (<React.Fragment>
                    <div className="dv-row">ATS uyum · ATS score</div>
                    <div className="dv-bar"><i style={{ width: "86%" }}></i></div>
                    <div className="dv-row">Etki · Impact</div>
                    <div className="dv-bar"><i style={{ width: "72%" }}></i></div>
                    <div className="dv-chips"><span className="dv-chip">+ React</span><span className="dv-chip">+ Liderlik</span><span className="dv-chip">+ %30 büyüme</span></div>
                  </React.Fragment>)}
                  {i === 1 && (<React.Fragment>
                    <div className="dv-row"><span className="dv-chip">Şu an · Now</span> → <span className="dv-chip">Hedef · Goal</span></div>
                    <div className="dv-bar"><i style={{ width: "40%" }}></i></div>
                    <div className="dv-row">Ara rol · Step role</div>
                    <div className="dv-chips"><span className="dv-chip">0–6 ay</span><span className="dv-chip">6–12 ay</span><span className="dv-chip">12 ay+</span></div>
                  </React.Fragment>)}
                  {i === 2 && (<React.Fragment>
                    <div className="dv-row">Hafta 1 · Week 1</div>
                    <div className="dv-bar"><i style={{ width: "100%" }}></i></div>
                    <div className="dv-row">Hafta 2 · Week 2</div>
                    <div className="dv-bar"><i style={{ width: "55%" }}></i></div>
                    <div className="dv-chips"><span className="dv-chip">SQL</span><span className="dv-chip">İstatistik</span><span className="dv-chip">Dashboard</span></div>
                  </React.Fragment>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">{p.more.eyebrow}</span>
            <h2 className="section-title">{p.more.title}</h2>
          </div>
          <div className="feat-grid">
            {p.more.items.map((it, i) => (
              <div className="feat-card" key={i}>
                <div className="ic"><IcP name={it.icon} size={24} /></div>
                <h3>{it.title}</h3>
                <p>{it.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PageCTA cta={p.cta} />
    </React.Fragment>
  );
}

/* ---- How page ---- */
function HowPage({ c }) {
  const p = c.pages.how;
  return (
    <React.Fragment>
      <PageHero hero={p.hero} cta={p.hero.cta} />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="steps-detailed">
            {p.steps.map((s, i) => (
              <div className="sd" key={i}>
                <span className="sn">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <ul>{s.detail.map((d, j) => <li key={j}><span className="d"></span>{d}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">{p.output.eyebrow}</span>
            <h2 className="section-title">{p.output.title}</h2>
            <p>{p.output.sub}</p>
          </div>
          <div className="outcome">
            {p.output.items.map((it, i) => (
              <div className="oc" key={i}>
                <span className="ck"><IcP name="check" size={18} /></span>
                <div><div className="k">{it.k}</div><div className="v">{it.v}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <PageCTA cta={p.cta} />
    </React.Fragment>
  );
}

/* ---- Pricing page ---- */
function PricingPage({ c }) {
  const p = c.pages.pricing;
  const [yearly, setYearly] = useStateP(false);
  return (
    <React.Fragment>
      <section className="page-hero">
        <div className="aura" style={{ width: 540, height: 540, top: -160, left: "30%", background: "radial-gradient(circle, var(--glow-1), transparent 70%)" }}></div>
        <div className="wrap inner">
          <a href={HOME} className="crumb"><IcP name="arrow" size={15} /> Career Pick</a>
          <span className="eyebrow">{p.hero.eyebrow}</span>
          <h1>{p.hero.title[0]} <span className="grad">{p.hero.title[1]}</span></h1>
          <p className="ph-sub">{p.hero.sub}</p>
          <div className="price-toggle">
            <button className={!yearly ? "on" : ""} onClick={() => setYearly(false)}>{p.toggle.monthly}</button>
            <button className={yearly ? "on" : ""} onClick={() => setYearly(true)}>{p.toggle.yearly}</button>
          </div>
          <div><span className="save-pill">{p.toggle.save}</span></div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <div className="plans">
            {p.plans.map((pl, i) => (
              <div className={"plan" + (pl.featured ? " featured" : "")} key={i}>
                {pl.featured && <span className="plan-badge">★ Popüler</span>}
                <div className="plan-name">{pl.name}</div>
                <div className="plan-tag">{pl.tagline}</div>
                <div className="plan-price">
                  <span className="amt">{yearly ? pl.priceY : pl.priceM}</span>
                  <span className="per">{pl.period}</span>
                </div>
                <ul className="plan-feats">
                  {pl.features.map((f, j) => <li key={j}><Check /> {f}</li>)}
                </ul>
                <a href={"kariyer%20sohbet.html"} className={"btn " + (pl.featured ? "btn-primary" : "btn-ghost")}>{pl.cta}</a>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head center"><h2 className="section-title">{p.faqTitle}</h2></div>
          <PricingFaq items={p.faq} />
        </div>
      </section>
    </React.Fragment>
  );
}

function PricingFaq({ items }) {
  const [open, setOpen] = useStateP(0);
  return (
    <div className="faq-list">
      {items.map((it, i) => (
        <div className={"faq-item" + (open === i ? " open" : "")} key={i}>
          <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{it.q}</span><span className="ico"><IcP name="plus" size={22} /></span>
          </button>
          <div className="faq-a" style={{ maxHeight: open === i ? 240 : 0 }}>
            <div className="faq-a-inner">{it.a}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Changelog page ---- */
function ChangelogPage({ c }) {
  const p = c.pages.changelog;
  return (
    <React.Fragment>
      <section className="page-hero">
        <div className="aura" style={{ width: 520, height: 520, top: -150, right: "15%", background: "radial-gradient(circle, var(--glow-2), transparent 70%)" }}></div>
        <div className="wrap inner">
          <a href={HOME} className="crumb"><IcP name="arrow" size={15} /> Career Pick</a>
          <span className="eyebrow">{p.hero.eyebrow}</span>
          <h1>{p.hero.title[0]} <span className="grad">{p.hero.title[1]}</span></h1>
          <p className="ph-sub">{p.hero.sub}</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 10 }}>
        <div className="wrap">
          <div className="timeline">
            {p.entries.map((e, i) => (
              <div className="cl-entry" key={i}>
                <div className="cl-meta">
                  <span className="cl-ver">{e.version}</span>
                  <span className="cl-date">{e.date}</span>
                  <span className="cl-tags">{e.tags.map((t, j) => <span className={"cl-tag " + t.t} key={j}>{t.l}</span>)}</span>
                </div>
                <div className="cl-card">
                  <h3>{e.title}</h3>
                  <ul>{e.items.map((it, j) => <li key={j}><span className="d"></span>{it}</li>)}</ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </React.Fragment>
  );
}

/* ---- shared bits ---- */
function PageHero({ hero, cta }) {
  return (
    <section className="page-hero">
      <div className="aura" style={{ width: 540, height: 540, top: -160, left: "12%", background: "radial-gradient(circle, var(--glow-1), transparent 70%)" }}></div>
      <div className="aura" style={{ width: 440, height: 440, top: -120, right: "10%", background: "radial-gradient(circle, var(--glow-2), transparent 70%)" }}></div>
      <div className="wrap inner">
        <a href={HOME} className="crumb"><IcP name="arrow" size={15} /> Career Pick</a>
        <span className="eyebrow">{hero.eyebrow}</span>
        <h1>{hero.title[0]} <span className="grad">{hero.title[1]}</span></h1>
        <p className="ph-sub">{hero.sub}</p>
        {cta && <a href={"kariyer%20sohbet.html"} className="btn btn-primary">{cta} <IcP name="arrow" size={17} /></a>}
      </div>
    </section>
  );
}

function PageCTA({ cta }) {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="cta-band">
          <div className="aura" style={{ width: 360, height: 360, top: -120, left: "22%", background: "radial-gradient(circle, var(--glow-1), transparent 70%)", opacity: .6 }}></div>
          <div style={{ position: "relative", zIndex: 2 }}>
            <h2>{cta.title}</h2>
            <p>{cta.sub}</p>
            <a href={"kariyer%20sohbet.html"} className="btn btn-mint">{cta.btn} <IcP name="arrow" size={17} /></a>
          </div>
        </div>
      </div>
    </section>
  );
}

const PAGE_MAP = Object.assign({ features: FeaturesPage, how: HowPage, pricing: PricingPage, changelog: ChangelogPage }, window.CP_PAGES2 || {});

const PAGE_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "electric",
  "font": "grotesk"
}/*EDITMODE-END*/;

function PageApp() {
  const [t, setTweak] = useTweaks(PAGE_DEFAULTS);
  const [lang, setLang] = useStateP(() => localStorage.getItem("cp_lang") || "tr");
  const c = CP_CONTENT[lang];
  const Page = PAGE_MAP[document.body.dataset.page] || FeaturesPage;

  useEffectP(() => { localStorage.setItem("cp_lang", lang); document.documentElement.lang = lang; }, [lang]);
  useEffectP(() => { document.body.dataset.theme = t.theme; }, [t.theme]);
  useEffectP(() => { document.body.dataset.font = t.font; }, [t.font]);
  useEffectP(() => { window.scrollTo(0, 0); }, []);

  return (
    <React.Fragment>
      <CPNav c={c} lang={lang} setLang={setLang} base={HOME} />
      <Page c={c} lang={lang} />
      <CPFooter c={c} base={HOME} />
      <TweaksPanel>
        <TweakSection label={lang === "tr" ? "Renk yönü" : "Color direction"} />
        <TweakRadio label={lang === "tr" ? "Tema" : "Theme"} value={t.theme}
          options={["electric", "aurora", "sunset", "forest"]} onChange={(v) => setTweak("theme", v)} />
        <TweakSection label={lang === "tr" ? "Tipografi" : "Typography"} />
        <TweakSelect label={lang === "tr" ? "Yazı tipi" : "Font"} value={t.font}
          options={["grotesk", "sora", "editorial"]} onChange={(v) => setTweak("font", v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<PageApp />);
