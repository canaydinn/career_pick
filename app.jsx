/* global React, ReactDOM, CP_CONTENT, useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakSelect, CPNav, CPHero, CPFeatures, CPHow, CPReviews, CPFaq, CPFooter, CPuseReveal */
const { useState: useStateA, useEffect: useEffectA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "electric",
  "layout": "split",
  "font": "grotesk"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [lang, setLang] = useStateA(() => localStorage.getItem("cp_lang") || "tr");
  const c = CP_CONTENT[lang];

  useEffectA(() => { localStorage.setItem("cp_lang", lang); document.documentElement.lang = lang; }, [lang]);

  // apply tweak directions to <body>
  useEffectA(() => { document.body.dataset.theme = t.theme; }, [t.theme]);
  useEffectA(() => { document.body.dataset.layout = t.layout; }, [t.layout]);
  useEffectA(() => { document.body.dataset.font = t.font; }, [t.font]);

  CPuseReveal();

  return (
    <React.Fragment>
      <CPNav c={c} lang={lang} setLang={setLang} />
      <CPHero c={c} />
      <CPFeatures c={c} />
      <CPHow c={c} />
      <CPReviews c={c} />
      <CPFaq c={c} />
      <CPFooter c={c} />

      <TweaksPanel>
        <TweakSection label={lang === "tr" ? "Renk yönü" : "Color direction"} />
        <TweakRadio label={lang === "tr" ? "Tema" : "Theme"} value={t.theme}
          options={["electric", "aurora", "sunset", "forest"]}
          onChange={(v) => setTweak("theme", v)} />
        <TweakSection label={lang === "tr" ? "Hero düzeni" : "Hero layout"} />
        <TweakRadio label="Layout" value={t.layout}
          options={["split", "centered", "stage"]}
          onChange={(v) => setTweak("layout", v)} />
        <TweakSection label={lang === "tr" ? "Tipografi" : "Typography"} />
        <TweakSelect label={lang === "tr" ? "Yazı tipi" : "Font"} value={t.font}
          options={["grotesk", "sora", "editorial"]}
          onChange={(v) => setTweak("font", v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
