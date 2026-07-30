/**
 * CV şablonları — önizleme + HTML indirme
 * window.CP_CV_TEMPLATES.build / preview / download
 */
(function (global) {
  const PERSON = {
    tr: {
      name: "Ayşe Yılmaz",
      title: "Ürün Analisti",
      contact: "Istanbul · ayse@ornek.com · linkedin.com/in/ayse",
      summary:
        "Veri odaklı ürün analisti. Kullanıcı araştırması, SQL ve deney tasarımı ile büyüme ekiplerine katkı sağlarım.",
      experienceTitle: "Deneyim",
      educationTitle: "Eğitim",
      skillsTitle: "Beceriler",
      projectsTitle: "Projeler",
      experience: [
        {
          role: "Ürün Analisti",
          company: "NovaTech",
          dates: "2023 — Günümüz",
          bullets: [
            "Aktivasyon hunisini yeniden tasarlayarak 2. hafta elde tutmayı %18 artırdım.",
            "Haftalık metrik panosu kurdum; karar döngüsünü 5 günden 2 güne indirdim.",
          ],
        },
        {
          role: "İş Analisti",
          company: "DataLab",
          dates: "2021 — 2023",
          bullets: [
            "Paydaş gereksinimlerini kullanıcı hikâyelerine çevirdim; sprint tahmin sapmasını azalttım.",
            "SQL ile churn segmentasyonu yaptım; hedef kampanya ROI’sini yükselttik.",
          ],
        },
      ],
      education: [
        { school: "Boğaziçi Üniversitesi", detail: "İşletme, Lisans · 2021" },
      ],
      skills: ["SQL", "Excel / Sheets", "Figma", "A/B test", "Kullanıcı görüşmesi", "Notion"],
      projects: [
        { name: "Onboarding yeniden tasarımı", detail: "Araştırma → prototip → ölçüm; deneme grubunda +12% tamamlanma." },
      ],
    },
    en: {
      name: "Ayse Yilmaz",
      title: "Product Analyst",
      contact: "Istanbul · ayse@example.com · linkedin.com/in/ayse",
      summary:
        "Data-driven product analyst. I help growth teams with user research, SQL and experiment design.",
      experienceTitle: "Experience",
      educationTitle: "Education",
      skillsTitle: "Skills",
      projectsTitle: "Projects",
      experience: [
        {
          role: "Product Analyst",
          company: "NovaTech",
          dates: "2023 — Present",
          bullets: [
            "Redesigned the activation funnel and lifted week-2 retention by 18%.",
            "Built a weekly metrics board; shortened decision cycles from 5 days to 2.",
          ],
        },
        {
          role: "Business Analyst",
          company: "DataLab",
          dates: "2021 — 2023",
          bullets: [
            "Turned stakeholder needs into user stories; reduced sprint estimate drift.",
            "Ran churn segmentation in SQL to improve campaign ROI.",
          ],
        },
      ],
      education: [
        { school: "Bogazici University", detail: "B.A. Business · 2021" },
      ],
      skills: ["SQL", "Excel / Sheets", "Figma", "A/B testing", "User interviews", "Notion"],
      projects: [
        { name: "Onboarding redesign", detail: "Research → prototype → measure; +12% completion in experiment." },
      ],
    },
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function expHtml(p) {
    return (p.experience || [])
      .map(
        (e) =>
          `<div class="job"><div class="job-h"><strong>${esc(e.role)}</strong> · ${esc(e.company)}<span>${esc(e.dates)}</span></div>` +
          `<ul>${(e.bullets || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>`
      )
      .join("");
  }

  function eduHtml(p) {
    return (p.education || [])
      .map((e) => `<div class="edu"><strong>${esc(e.school)}</strong><div>${esc(e.detail)}</div></div>`)
      .join("");
  }

  function skillsHtml(p) {
    return `<div class="skills">${(p.skills || []).map((s) => `<span>${esc(s)}</span>`).join("")}</div>`;
  }

  function projectsHtml(p) {
    return (p.projects || [])
      .map((x) => `<div class="proj"><strong>${esc(x.name)}</strong><div>${esc(x.detail)}</div></div>`)
      .join("");
  }

  const STYLES = {
    aurora: {
      css: `
        body{font-family:Segoe UI,system-ui,sans-serif;color:#1a2332;margin:0;background:#eef2f7}
        .page{max-width:820px;margin:24px auto;background:#fff;display:grid;grid-template-columns:240px 1fr;min-height:1000px;box-shadow:0 12px 40px rgba(0,0,0,.12)}
        .side{background:#0f2744;color:#e8eef7;padding:36px 24px}
        .side h1{font-size:26px;margin:0 0 6px}
        .side .role{color:#7ce3c4;font-weight:600;margin-bottom:18px}
        .side .meta{font-size:12px;line-height:1.5;opacity:.85;margin-bottom:28px}
        .side h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7ce3c4;margin:22px 0 10px}
        .skills span{display:inline-block;border:1px solid rgba(124,227,196,.35);padding:4px 8px;border-radius:999px;font-size:11px;margin:0 6px 6px 0}
        .main{padding:40px 36px}
        .main h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#2a6f9f;border-bottom:2px solid #d7e6f4;padding-bottom:6px;margin:0 0 14px}
        .sum{font-size:14px;line-height:1.55;margin:0 0 26px;color:#334}
        .job{margin-bottom:16px}.job-h{display:flex;justify-content:space-between;gap:12px;font-size:14px;margin-bottom:6px}
        .job-h span{color:#678;font-size:12px;white-space:nowrap} ul{margin:0;padding-left:18px;font-size:13px;line-height:1.45;color:#445}
        .edu,.proj{font-size:13px;margin-bottom:10px;line-height:1.45}
        @media print{body{background:#fff}.page{margin:0;box-shadow:none}}
      `,
      body: (p) => `
        <div class="page">
          <aside class="side">
            <h1>${esc(p.name)}</h1>
            <div class="role">${esc(p.title)}</div>
            <div class="meta">${esc(p.contact)}</div>
            <h2>${esc(p.skillsTitle)}</h2>${skillsHtml(p)}
            <h2>${esc(p.educationTitle)}</h2>${eduHtml(p)}
          </aside>
          <main class="main">
            <p class="sum">${esc(p.summary)}</p>
            <h2>${esc(p.experienceTitle)}</h2>${expHtml(p)}
            <h2>${esc(p.projectsTitle)}</h2>${projectsHtml(p)}
          </main>
        </div>`,
    },
    "klasik-pro": {
      css: `
        body{font-family:Georgia,"Times New Roman",serif;color:#222;margin:0;background:#f4f4f4}
        .page{max-width:760px;margin:24px auto;background:#fff;padding:48px 52px;box-shadow:0 8px 28px rgba(0,0,0,.1)}
        h1{font-size:30px;margin:0;letter-spacing:.02em;text-align:center}
        .role{text-align:center;font-size:14px;color:#555;margin:6px 0 4px;font-family:Segoe UI,sans-serif}
        .meta{text-align:center;font-size:12px;color:#666;margin-bottom:22px;font-family:Segoe UI,sans-serif}
        hr{border:none;border-top:1px solid #bbb;margin:0 0 18px}
        h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;margin:20px 0 8px;font-family:Segoe UI,sans-serif}
        .sum{font-size:14px;line-height:1.55;margin:0 0 8px}
        .job{margin-bottom:14px}.job-h{display:flex;justify-content:space-between;font-size:14px;font-family:Segoe UI,sans-serif}
        .job-h span{color:#666;font-size:12px} ul{margin:4px 0 0;padding-left:18px;font-size:13px;line-height:1.45}
        .skills span{font-family:Segoe UI,sans-serif;font-size:12px;margin-right:10px}
        .edu,.proj{font-size:13px;margin-bottom:8px;font-family:Segoe UI,sans-serif}
        @media print{body{background:#fff}.page{margin:0;box-shadow:none}}
      `,
      body: (p) => `
        <div class="page">
          <h1>${esc(p.name)}</h1>
          <div class="role">${esc(p.title)}</div>
          <div class="meta">${esc(p.contact)}</div><hr>
          <p class="sum">${esc(p.summary)}</p>
          <h2>${esc(p.experienceTitle)}</h2>${expHtml(p)}
          <h2>${esc(p.educationTitle)}</h2>${eduHtml(p)}
          <h2>${esc(p.skillsTitle)}</h2>${skillsHtml(p)}
          <h2>${esc(p.projectsTitle)}</h2>${projectsHtml(p)}
        </div>`,
    },
    spektrum: {
      css: `
        body{font-family:"Trebuchet MS",Segoe UI,sans-serif;color:#1d1a2a;margin:0;background:#f3eef8}
        .page{max-width:800px;margin:24px auto;background:#fff;overflow:hidden;box-shadow:0 12px 36px rgba(80,40,120,.15)}
        .band{height:14px;background:linear-gradient(90deg,#7c5cff,#ff6bcb,#ffc857)}
        .inner{padding:36px 40px 44px}
        h1{font-size:28px;margin:0}
        .role{color:#7c5cff;font-weight:700;margin:4px 0 8px}
        .meta{font-size:12px;color:#666;margin-bottom:18px}
        h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#7c5cff;margin:22px 0 10px;border-left:4px solid #ff6bcb;padding-left:10px}
        .sum{font-size:14px;line-height:1.55}
        .job-h{display:flex;justify-content:space-between;font-size:14px}.job-h span{color:#888;font-size:12px}
        ul{margin:6px 0 14px;padding-left:18px;font-size:13px;line-height:1.45}
        .skills span{display:inline-block;background:#f0e9ff;color:#5a3db8;padding:5px 10px;border-radius:8px;font-size:11px;margin:0 6px 6px 0}
        @media print{body{background:#fff}.page{margin:0;box-shadow:none}}
      `,
      body: (p) => `
        <div class="page"><div class="band"></div><div class="inner">
          <h1>${esc(p.name)}</h1><div class="role">${esc(p.title)}</div>
          <div class="meta">${esc(p.contact)}</div>
          <p class="sum">${esc(p.summary)}</p>
          <h2>${esc(p.experienceTitle)}</h2>${expHtml(p)}
          <h2>${esc(p.skillsTitle)}</h2>${skillsHtml(p)}
          <h2>${esc(p.projectsTitle)}</h2>${projectsHtml(p)}
          <h2>${esc(p.educationTitle)}</h2>${eduHtml(p)}
        </div></div>`,
    },
    "ilk-adim": {
      css: `
        body{font-family:Segoe UI,system-ui,sans-serif;color:#243044;margin:0;background:#eef6f2}
        .page{max-width:780px;margin:24px auto;background:#fff;padding:40px;box-shadow:0 10px 32px rgba(0,0,0,.08)}
        h1{font-size:26px;margin:0}.role{color:#1f8a6a;font-weight:600;margin:4px 0 10px}
        .meta{font-size:12px;color:#678;margin-bottom:16px}
        .grid{display:grid;grid-template-columns:1.2fr .8fr;gap:28px}
        h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#1f8a6a;margin:0 0 10px}
        .sum{font-size:14px;line-height:1.55;margin:0 0 18px}
        .job{margin-bottom:14px}.job-h{font-size:14px;display:flex;justify-content:space-between}.job-h span{font-size:12px;color:#789}
        ul{margin:4px 0 0;padding-left:18px;font-size:13px;line-height:1.45}
        .skills span{display:block;padding:6px 0;border-bottom:1px solid #e5eee9;font-size:13px}
        .hint{font-size:12px;color:#1f8a6a;background:#e8f7f1;padding:10px 12px;border-radius:8px;margin-bottom:16px}
        @media print{body{background:#fff}.page{box-shadow:none;margin:0}}
      `,
      body: (p) => `
        <div class="page">
          <h1>${esc(p.name)}</h1><div class="role">${esc(p.title)}</div>
          <div class="meta">${esc(p.contact)}</div>
          <div class="hint">Yeni mezun / erken kariyer odaklı şablon — projeler ve beceriler önde.</div>
          <div class="grid">
            <div>
              <p class="sum">${esc(p.summary)}</p>
              <h2>${esc(p.projectsTitle)}</h2>${projectsHtml(p)}
              <h2>${esc(p.experienceTitle)}</h2>${expHtml(p)}
            </div>
            <div>
              <h2>${esc(p.skillsTitle)}</h2>${skillsHtml(p)}
              <h2 style="margin-top:22px">${esc(p.educationTitle)}</h2>${eduHtml(p)}
            </div>
          </div>
        </div>`,
    },
    devlog: {
      css: `
        body{font-family:ui-monospace,Consolas,monospace;color:#d6e2f0;margin:0;background:#0b1220}
        .page{max-width:820px;margin:24px auto;background:#111a2b;border:1px solid #243552;padding:36px 40px;box-shadow:0 16px 40px rgba(0,0,0,.45)}
        h1{font-size:24px;margin:0;color:#7ce3c4}
        .role{color:#8eb6ff;margin:6px 0 8px;font-size:13px}
        .meta{font-size:11px;color:#8090a8;margin-bottom:18px}
        h2{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8eb6ff;margin:22px 0 10px;border-bottom:1px dashed #2c405e;padding-bottom:6px}
        .sum{font-size:13px;line-height:1.55;color:#c5d3e6}
        .job-h{display:flex;justify-content:space-between;font-size:13px;color:#e8eef7}.job-h span{color:#8090a8;font-size:11px}
        ul{margin:6px 0 14px;padding-left:18px;font-size:12px;line-height:1.5;color:#a9bbd4}
        .skills span{display:inline-block;border:1px solid #2f4a6e;color:#7ce3c4;padding:3px 8px;margin:0 6px 6px 0;font-size:11px}
        .edu,.proj{font-size:12px;color:#a9bbd4;margin-bottom:8px}
        @media print{body{background:#fff;color:#111}.page{background:#fff;color:#111;border:none;box-shadow:none;margin:0}
          h1,.skills span{color:#0a7} .role,h2{color:#246} .sum,ul,.edu,.proj,.job-h{color:#222}}
      `,
      body: (p) => `
        <div class="page">
          <h1>${esc(p.name)}</h1><div class="role">// ${esc(p.title)}</div>
          <div class="meta">${esc(p.contact)}</div>
          <p class="sum">${esc(p.summary)}</p>
          <h2>${esc(p.skillsTitle)}</h2>${skillsHtml(p)}
          <h2>${esc(p.experienceTitle)}</h2>${expHtml(p)}
          <h2>${esc(p.projectsTitle)}</h2>${projectsHtml(p)}
          <h2>${esc(p.educationTitle)}</h2>${eduHtml(p)}
        </div>`,
    },
    minimal: {
      css: `
        body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#111;margin:0;background:#f7f7f7}
        .page{max-width:700px;margin:32px auto;background:#fff;padding:56px 48px;box-shadow:0 6px 24px rgba(0,0,0,.06)}
        h1{font-size:34px;font-weight:500;margin:0;letter-spacing:-.02em}
        .role{font-size:14px;color:#666;margin:10px 0 6px}
        .meta{font-size:12px;color:#888;margin-bottom:36px}
        h2{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#999;margin:28px 0 12px;font-weight:600}
        .sum{font-size:15px;line-height:1.6;max-width:36em}
        .job{margin-bottom:18px}.job-h{font-size:14px;display:flex;justify-content:space-between}.job-h span{color:#999;font-size:12px}
        ul{margin:8px 0 0;padding-left:16px;font-size:13px;line-height:1.5;color:#444}
        .skills span{font-size:13px;margin-right:14px;color:#333}
        @media print{body{background:#fff}.page{margin:0;box-shadow:none}}
      `,
      body: (p) => `
        <div class="page">
          <h1>${esc(p.name)}</h1><div class="role">${esc(p.title)}</div>
          <div class="meta">${esc(p.contact)}</div>
          <p class="sum">${esc(p.summary)}</p>
          <h2>${esc(p.experienceTitle)}</h2>${expHtml(p)}
          <h2>${esc(p.educationTitle)}</h2>${eduHtml(p)}
          <h2>${esc(p.skillsTitle)}</h2>${skillsHtml(p)}
        </div>`,
    },
    eskiz: {
      css: `
        body{font-family:"Segoe UI",system-ui,sans-serif;color:#1a1a1a;margin:0;background:#ebe7df}
        .page{max-width:820px;margin:24px auto;background:#faf8f4;display:grid;grid-template-columns:1fr 220px;box-shadow:0 14px 40px rgba(0,0,0,.12)}
        .main{padding:40px 36px;border-right:3px solid #1a1a1a}
        .rail{background:#1a1a1a;color:#faf8f4;padding:36px 20px}
        h1{font-size:32px;margin:0;line-height:1.05;text-transform:uppercase;letter-spacing:.04em}
        .role{font-size:14px;margin:12px 0;font-weight:700}
        .meta{font-size:11px;opacity:.75;margin-bottom:20px}
        h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin:24px 0 10px;border-bottom:2px solid #1a1a1a;padding-bottom:4px}
        .rail h2{border-color:#faf8f4;color:#faf8f4}
        .sum{font-size:14px;line-height:1.5}
        .job-h{display:flex;justify-content:space-between;font-size:13px;font-weight:700}.job-h span{font-weight:500;font-size:11px}
        ul{margin:6px 0 12px;padding-left:16px;font-size:13px;line-height:1.4}
        .skills span{display:block;font-size:12px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.2)}
        @media print{body{background:#fff}.page{margin:0;box-shadow:none}}
      `,
      body: (p) => `
        <div class="page">
          <main class="main">
            <h1>${esc(p.name)}</h1><div class="role">${esc(p.title)}</div>
            <p class="sum">${esc(p.summary)}</p>
            <h2>${esc(p.experienceTitle)}</h2>${expHtml(p)}
            <h2>${esc(p.projectsTitle)}</h2>${projectsHtml(p)}
          </main>
          <aside class="rail">
            <div class="meta">${esc(p.contact)}</div>
            <h2>${esc(p.skillsTitle)}</h2>${skillsHtml(p)}
            <h2>${esc(p.educationTitle)}</h2>${eduHtml(p)}
          </aside>
        </div>`,
    },
    akademi: {
      css: `
        body{font-family:Georgia,"Times New Roman",serif;color:#222;margin:0;background:#f0eee8}
        .page{max-width:760px;margin:24px auto;background:#fffef9;padding:44px 48px;border:1px solid #d8d2c4;box-shadow:0 8px 28px rgba(0,0,0,.08)}
        h1{font-size:28px;margin:0;text-align:center}
        .role{text-align:center;font-style:italic;font-size:14px;margin:8px 0;color:#444}
        .meta{text-align:center;font-size:12px;font-family:Segoe UI,sans-serif;color:#666;margin-bottom:20px}
        h2{font-size:14px;margin:22px 0 8px;border-bottom:1px solid #bbb;padding-bottom:4px;font-variant:small-caps;letter-spacing:.04em}
        .sum{font-size:14px;line-height:1.55;text-align:justify}
        .job-h{font-size:14px;display:flex;justify-content:space-between;font-family:Segoe UI,sans-serif}.job-h span{font-size:12px;color:#666}
        ul{margin:6px 0 12px;padding-left:18px;font-size:13px;line-height:1.45}
        .edu{font-size:13px;margin-bottom:8px}.skills span{font-family:Segoe UI,sans-serif;font-size:12px;margin-right:8px}
        @media print{body{background:#fff}.page{margin:0;box-shadow:none;border:none}}
      `,
      body: (p) => `
        <div class="page">
          <h1>${esc(p.name)}</h1><div class="role">${esc(p.title)}</div>
          <div class="meta">${esc(p.contact)}</div>
          <p class="sum">${esc(p.summary)}</p>
          <h2>${esc(p.educationTitle)}</h2>${eduHtml(p)}
          <h2>${esc(p.experienceTitle)}</h2>${expHtml(p)}
          <h2>${esc(p.projectsTitle)}</h2>${projectsHtml(p)}
          <h2>${esc(p.skillsTitle)}</h2>${skillsHtml(p)}
        </div>`,
    },
  };

  /** Kart kapakları — şablon stiline uygun SVG */
  const COVERS = {
    aurora:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><rect fill="#0f2744" width="120" height="480"/><rect fill="#f5f7fb" x="120" width="240" height="480"/><rect fill="#7ce3c4" x="16" y="36" width="88" height="10" rx="2"/><rect fill="#d0d7e2" x="16" y="60" width="70" height="6" rx="2"/><rect fill="#2a6f9f" x="140" y="40" width="90" height="8" rx="2"/><rect fill="#c5cedb" x="140" y="64" width="180" height="6" rx="2"/><rect fill="#c5cedb" x="140" y="78" width="160" height="6" rx="2"/><rect fill="#c5cedb" x="140" y="110" width="190" height="6" rx="2"/><rect fill="#c5cedb" x="140" y="124" width="170" height="6" rx="2"/></svg>`
      ),
    "klasik-pro":
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><rect fill="#ffffff" width="360" height="480"/><rect fill="#222" x="110" y="40" width="140" height="12" rx="2"/><rect fill="#999" x="130" y="62" width="100" height="6" rx="2"/><line x1="40" y1="90" x2="320" y2="90" stroke="#bbb"/><rect fill="#444" x="40" y="110" width="70" height="8" rx="2"/><rect fill="#ccc" x="40" y="130" width="280" height="6" rx="2"/><rect fill="#ccc" x="40" y="144" width="260" height="6" rx="2"/><rect fill="#444" x="40" y="180" width="90" height="8" rx="2"/><rect fill="#ccc" x="40" y="200" width="280" height="6" rx="2"/></svg>`
      ),
    spektrum:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#7c5cff"/><stop offset=".5" stop-color="#ff6bcb"/><stop offset="1" stop-color="#ffc857"/></linearGradient></defs><rect fill="#fff" width="360" height="480"/><rect fill="url(#g)" height="16" width="360"/><rect fill="#7c5cff" x="28" y="48" width="120" height="12" rx="2"/><rect fill="#e8e0ff" x="28" y="80" width="64" height="18" rx="6"/><rect fill="#e8e0ff" x="100" y="80" width="72" height="18" rx="6"/><rect fill="#ddd" x="28" y="120" width="300" height="6" rx="2"/><rect fill="#ddd" x="28" y="136" width="270" height="6" rx="2"/></svg>`
      ),
    "ilk-adim":
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><rect fill="#f4fbf8" width="360" height="480"/><rect fill="#1f8a6a" x="28" y="36" width="140" height="12" rx="2"/><rect fill="#d7efe6" x="28" y="60" width="304" height="36" rx="8"/><rect fill="#1f8a6a" x="28" y="120" width="80" height="8" rx="2"/><rect fill="#cfe8de" x="28" y="140" width="180" height="6" rx="2"/><rect fill="#1f8a6a" x="230" y="120" width="70" height="8" rx="2"/><rect fill="#cfe8de" x="230" y="140" width="100" height="6" rx="2"/><rect fill="#cfe8de" x="230" y="154" width="100" height="6" rx="2"/></svg>`
      ),
    devlog:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><rect fill="#111a2b" width="360" height="480"/><rect fill="#7ce3c4" x="28" y="40" width="130" height="10" rx="2"/><rect fill="#8eb6ff" x="28" y="62" width="90" height="6" rx="2"/><rect fill="#2f4a6e" x="28" y="100" width="58" height="16" rx="3"/><rect fill="#2f4a6e" x="94" y="100" width="48" height="16" rx="3"/><rect fill="#3a516e" x="28" y="140" width="300" height="5" rx="2"/><rect fill="#3a516e" x="28" y="154" width="260" height="5" rx="2"/></svg>`
      ),
    minimal:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><rect fill="#fff" width="360" height="480"/><rect fill="#111" x="40" y="56" width="160" height="14" rx="2"/><rect fill="#bbb" x="40" y="86" width="100" height="6" rx="2"/><rect fill="#ddd" x="40" y="140" width="280" height="5" rx="2"/><rect fill="#ddd" x="40" y="156" width="240" height="5" rx="2"/><rect fill="#ddd" x="40" y="200" width="280" height="5" rx="2"/></svg>`
      ),
    eskiz:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><rect fill="#faf8f4" width="240" height="480"/><rect fill="#1a1a1a" x="240" width="120" height="480"/><rect fill="#1a1a1a" x="24" y="36" width="150" height="16"/><rect fill="#1a1a1a" x="24" y="100" width="90" height="8"/><rect fill="#ccc" x="24" y="120" width="190" height="5"/><rect fill="#faf8f4" x="256" y="40" width="88" height="6"/><rect fill="#444" x="256" y="60" width="88" height="5"/></svg>`
      ),
    akademi:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><rect fill="#fffef9" width="360" height="480"/><rect fill="#222" x="100" y="40" width="160" height="12" rx="1"/><rect fill="#666" x="120" y="64" width="120" height="6" rx="1"/><line x1="40" y1="96" x2="320" y2="96" stroke="#bbb"/><rect fill="#333" x="40" y="116" width="100" height="8"/><rect fill="#ccc" x="40" y="136" width="280" height="5"/><rect fill="#ccc" x="40" y="150" width="260" height="5"/><rect fill="#333" x="40" y="186" width="80" height="8"/><rect fill="#ccc" x="40" y="206" width="280" height="5"/></svg>`
      ),
  };

  function lang() {
    return (typeof localStorage !== "undefined" && localStorage.getItem("cp_lang") === "en") ? "en" : "tr";
  }

  function build(id) {
    const style = STYLES[id];
    if (!style) return null;
    const p = PERSON[lang()] || PERSON.tr;
    return `<!DOCTYPE html><html lang="${lang()}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>` +
      `<title>${esc(p.name)} — Career Pick CV</title><style>${style.css}</style></head><body>${style.body(p)}</body></html>`;
  }

  function preview(id) {
    const html = build(id);
    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) {
      alert(lang() === "en" ? "Please allow pop-ups to preview." : "Önizleme için pop-up’a izin ver.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function download(id) {
    const html = build(id);
    if (!html) return;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "careerpick-" + id + "-cv.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function cover(id) {
    return COVERS[id] || COVERS.aurora;
  }

  global.CP_CV_TEMPLATES = { build, preview, download, cover, STYLES, COVERS };
})(typeof window !== "undefined" ? window : globalThis);
