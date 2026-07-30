/* global React, CP_CONTENT, CPIcon */
const { useState: useState2, useMemo: useMemo2 } = React;
const Ic2 = window.CPIcon;
const HOME2 = "Career Pick.html";

function Crumb() {
  return <a href={HOME2} className="crumb"><Ic2 name="arrow" size={15} /> Career Pick</a>;
}
function Check2() { return <span className="ck"><Ic2 name="check" size={14} /></span>; }

function SecHero({ hero, children }) {
  return (
    <section className="page-hero">
      <div className="aura" style={{ width: 540, height: 540, top: -160, left: "12%", background: "radial-gradient(circle, var(--glow-1), transparent 70%)" }}></div>
      <div className="aura" style={{ width: 440, height: 440, top: -120, right: "10%", background: "radial-gradient(circle, var(--glow-2), transparent 70%)" }}></div>
      <div className="wrap inner">
        <Crumb />
        <span className="eyebrow">{hero.eyebrow}</span>
        <h1>{hero.title[0]} <span className="grad">{hero.title[1]}</span></h1>
        <p className="ph-sub">{hero.sub}</p>
        {children}
      </div>
    </section>
  );
}

function SecCTA({ cta }) {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="cta-band">
          <div className="aura" style={{ width: 360, height: 360, top: -120, left: "22%", background: "radial-gradient(circle, var(--glow-1), transparent 70%)", opacity: .6 }}></div>
          <div style={{ position: "relative", zIndex: 2 }}>
            <h2>{cta.title}</h2>
            <p>{cta.sub}</p>
            <a href={"kariyer%20sohbet.html"} className="btn btn-mint">{cta.btn} <Ic2 name="arrow" size={17} /></a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- About ---- */
function AboutPage({ c }) {
  const p = c.pages.about;
  return (
    <React.Fragment>
      <SecHero hero={p.hero} />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="mission">
            <div>
              <span className="eyebrow">{p.mission.eyebrow}</span>
              <h2 className="section-title" style={{ marginTop: 16 }}>{p.mission.title}</h2>
            </div>
            <p className="mission-body">{p.mission.body}</p>
          </div>
          <div className="stat-band">
            {p.stats.map((s, i) => (
              <div className="sb" key={i}><div className="sb-n">{s.n}</div><div className="sb-l">{s.l}</div></div>
            ))}
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head center"><h2 className="section-title">{p.valuesTitle}</h2></div>
          <div className="feat-grid val-grid">
            {p.values.map((v, i) => (
              <div className="feat-card" key={i}>
                <div className="ic"><Ic2 name={v.icon} size={24} /></div>
                <h3>{v.title}</h3><p>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head center"><h2 className="section-title">{p.teamTitle}</h2><p>{p.teamSub}</p></div>
          <div className="team-grid">
            {p.team.map((m, i) => (
              <div className="team-card" key={i}>
                <span className="team-ava">{m.init}</span>
                <div className="team-name">{m.name}</div>
                <div className="team-role">{m.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <SecCTA cta={p.cta} />
    </React.Fragment>
  );
}

/* ---- Contact ---- */
function ContactPage({ c }) {
  const p = c.pages.contact;
  const [sent, setSent] = useState2(false);
  return (
    <React.Fragment>
      <SecHero hero={p.hero} />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="contact-grid">
            <div className="contact-aside">
              {p.cards.map((cd, i) => (
                <div className="contact-card" key={i}>
                  <span className="cc-ic"><Ic2 name={cd.icon} size={20} /></span>
                  <div><div className="cc-t">{cd.title}</div><a className="cc-v" href={"mailto:" + cd.v}>{cd.v}</a></div>
                </div>
              ))}
              <div className="contact-hours">{p.hours}</div>
            </div>
            <form className="contact-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              <h3>{p.formTitle}</h3>
              <div className="cf-row">
                <label>{p.fields.name}<input type="text" required /></label>
                <label>{p.fields.email}<input type="email" required /></label>
              </div>
              <label>{p.fields.subject}<input type="text" /></label>
              <label>{p.fields.message}<textarea rows="5" required></textarea></label>
              <button type="submit" className="btn btn-primary">{p.fields.send} <Ic2 name="arrow" size={16} /></button>
              {sent && <div className="cf-sent"><Ic2 name="check" size={16} /> {p.fields.sent}</div>}
            </form>
          </div>
        </div>
      </section>
    </React.Fragment>
  );
}

/* ---- Careers ---- */
function CareersPage({ c }) {
  const p = c.pages.careers;
  return (
    <React.Fragment>
      <SecHero hero={p.hero} />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="section-head center"><h2 className="section-title">{p.perksTitle}</h2></div>
          <div className="feat-grid val-grid">
            {p.perks.map((v, i) => (
              <div className="feat-card" key={i}><div className="ic"><Ic2 name={v.icon} size={24} /></div><h3>{v.title}</h3><p>{v.body}</p></div>
            ))}
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head center"><h2 className="section-title">{p.openTitle}</h2></div>
          <div className="jobs">
            {p.jobs.map((j, i) => (
              <div className="job" key={i}>
                <div className="job-main">
                  <div className="job-title">{j.title}</div>
                  <div className="job-meta"><span className="job-team">{j.team}</span><span className="job-dot">·</span><span>{j.loc}</span></div>
                </div>
                <a href={"kariyer%20sohbet.html"} className="btn btn-ghost job-btn">{p.apply} <Ic2 name="arrow" size={15} /></a>
              </div>
            ))}
          </div>
        </div>
      </section>
      <SecCTA cta={p.cta} />
    </React.Fragment>
  );
}

/* ---- Privacy ---- */
function PrivacyPage({ c }) {
  const p = c.pages.privacy;
  return (
    <React.Fragment>
      <SecHero hero={p.hero} />
      <section className="section" style={{ paddingTop: 10 }}>
        <div className="wrap">
          <div className="legal">
            <div className="legal-updated">{p.updated}</div>
            {p.sections.map((s, i) => (
              <div className="legal-sec" key={i}>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </React.Fragment>
  );
}

/* ---- Blog ---- */
function BlogPage({ c }) {
  const p = c.pages.blog;
  const featured = p.posts.find((x) => x.featured) || p.posts[0];
  const rest = p.posts.filter((x) => x !== featured);
  return (
    <React.Fragment>
      <SecHero hero={p.hero} />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <a href={"kariyer%20sohbet.html"} className="blog-feature">
            <div className={"bf-media" + (featured.image ? " has-img" : "")} data-tone="a">
              {featured.image ? (
                <img src={featured.image} alt={featured.title} loading="eager" width="960" height="640" />
              ) : null}
              <span className="bf-flag">{p.featuredTag}</span>
            </div>
            <div className="bf-body">
              <span className="post-tag">{featured.tag}</span>
              <h2>{featured.title}</h2>
              <p>{featured.excerpt}</p>
              <div className="post-meta">{featured.date} · {featured.read}</div>
            </div>
          </a>
          <div className="blog-grid">
            {rest.map((post, i) => (
              <a href={"kariyer%20sohbet.html"} className="post-card" key={i}>
                <div className={"post-media" + (post.image ? " has-img" : "")} data-tone={["b", "c", "d", "a", "b"][i % 5]}>
                  {post.image ? (
                    <img src={post.image} alt={post.title} loading="lazy" width="800" height="520" />
                  ) : null}
                </div>
                <div className="post-body">
                  <span className="post-tag">{post.tag}</span>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                  <div className="post-meta">{post.date} · {post.read}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    </React.Fragment>
  );
}

/* ---- Career guide ---- */
function GuidePage({ c }) {
  const p = c.pages.guide;
  return (
    <React.Fragment>
      <SecHero hero={p.hero} />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="section-head center"><h2 className="section-title">{p.catsTitle}</h2></div>
          <div className="guide-grid">
            {p.categories.map((cat, i) => (
              <a href={"kariyer%20sohbet.html"} className="guide-card" key={i}>
                <span className="ic"><Ic2 name={cat.icon} size={24} /></span>
                <div className="guide-head"><h3>{cat.title}</h3><span className="guide-count">{cat.count}</span></div>
                <p>{cat.body}</p>
                <span className="guide-arrow"><Ic2 name="arrow" size={18} /></span>
              </a>
            ))}
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head center"><h2 className="section-title">{p.stepsTitle}</h2></div>
          <div className="steps-detailed g4">
            {p.steps.map((s, i) => (
              <div className="sd" key={i}><span className="sn">{s.n}</span><h3>{s.title}</h3><p style={{ margin: 0 }}>{s.body}</p></div>
            ))}
          </div>
        </div>
      </section>
      <SecCTA cta={p.cta} />
    </React.Fragment>
  );
}

/* ---- Templates ---- */
function TemplatesPage({ c }) {
  const p = c.pages.templates;
  const [filter, setFilter] = useState2(p.filters[0]);
  const all = p.filters[0];
  const items = useMemo2(() => filter === all ? p.items : p.items.filter((x) => x.cat === filter), [filter, p.items]);
  return (
    <React.Fragment>
      <SecHero hero={p.hero} />
      <section className="section" style={{ paddingTop: 16 }}>
        <div className="wrap">
          <div className="tpl-filters">
            {p.filters.map((f, i) => (
              <button key={i} className={"tpl-chip" + (filter === f ? " on" : "")} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          <div className="tpl-grid">
            {items.map((it, i) => (
              <div className="tpl-card" key={it.name}>
                <div className="tpl-thumb" data-tone={it.tone}>
                  <div className="tpl-paper">
                    <span className="tp-band"></span>
                    <span className="tp-line w70"></span>
                    <span className="tp-line w40"></span>
                    <span className="tp-gap"></span>
                    <span className="tp-line w90"></span>
                    <span className="tp-line w80"></span>
                    <span className="tp-line w60"></span>
                  </div>
                  <div className="tpl-hover">
                    <a href={"kariyer%20sohbet.html"} className="btn btn-primary">{p.use}</a>
                    <a href={"kariyer%20sohbet.html"} className="btn btn-ghost">{p.preview}</a>
                  </div>
                </div>
                <div className="tpl-info">
                  <div><div className="tpl-name">{it.name}</div><div className="tpl-desc">{it.desc}</div></div>
                  <span className="tpl-cat">{it.cat}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <SecCTA cta={p.cta} />
    </React.Fragment>
  );
}

window.CP_PAGES2 = { about: AboutPage, contact: ContactPage, careers: CareersPage, privacy: PrivacyPage, blog: BlogPage, guide: GuidePage, templates: TemplatesPage };
