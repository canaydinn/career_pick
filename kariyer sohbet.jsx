/* global React, ReactDOM, CP_SOHBET */
const { useState: useStateK, useEffect: useEffectK, useRef: useRefK } = React;
const IcK = window.CPIcon;
const LogoK = window.CPLogo;

/* ---------- Backend cagrilari (ileride degistirilebilir sekilde izole) ---------- */
async function apiDegerlendir(soru, cevap) {
  const r = await fetch("/api/sohbet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "evaluate", soru, cevap }),
  });
  if (!r.ok) throw new Error("evaluate");
  return r.json(); // { sufficient, followup }
}
async function apiOner(cevaplar) {
  const r = await fetch("/api/sohbet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "recommend", cevaplar }),
  });
  if (!r.ok) throw new Error("recommend");
  return r.json(); // { recommendations: [...] }
}

/* ---------- Profil deposu (localStorage; backend'e tasinabilir) ---------- */
const PROFILE_KEY = "cp_selected_egitimler";
const ProfileStore = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || []; }
    catch (e) { return []; }
  },
  add(item) {
    const all = ProfileStore.getAll();
    if (!all.some((x) => x.id === item.id)) {
      all.push(item);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
    }
    return all;
  },
  remove(id) {
    const all = ProfileStore.getAll().filter((x) => x.id !== id);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
    return all;
  },
  has(id) { return ProfileStore.getAll().some((x) => x.id === id); },
};

/* ---------- Sayfa ---------- */
function KariyerSohbet() {
  const lang = (typeof localStorage !== "undefined" && localStorage.getItem("cp_lang")) === "en" ? "en" : "tr";
  const S = CP_SOHBET[lang];
  const N = S.questions.length;

  const initMsgs = () => [
    { role: "assistant", content: S.greeting },
    { role: "assistant", content: S.questions[0].q, qIndex: 0 },
  ];

  const [msgs, setMsgs] = useStateK(initMsgs);
  const [answers, setAnswers] = useStateK([]);
  const [step, setStep] = useStateK(0);            // su an sorulan soru indeksi
  const [input, setInput] = useStateK("");
  const [busy, setBusy] = useStateK(false);
  const [phase, setPhase] = useStateK("asking");    // "asking" | "result"
  const [recs, setRecs] = useStateK([]);
  const [selected, setSelected] = useStateK(() => ProfileStore.getAll());

  const bodyRef = useRefK(null);
  const taRef = useRefK(null);

  useEffectK(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, busy, phase]);

  const questionText = (i) => (S.questions[i] ? S.questions[i].q : "");

  function buildCevaplar(arr) {
    return S.questions.map((qq, i) => ({ soru: qq.q, key: qq.key, cevap: arr[i] || "" }));
  }

  async function runRecommend(finalAnswers) {
    try {
      const data = await apiOner(buildCevaplar(finalAnswers));
      setRecs(Array.isArray(data.recommendations) ? data.recommendations : []);
    } catch (e) {
      console.error("[SOHBET] recommend:", e.message);
      setRecs([]);
    } finally {
      setPhase("result");
    }
  }

  async function submit(text) {
    const q = (text ?? input).trim();
    if (!q || busy || phase === "result") return;
    const cur = step;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setBusy(true);

    try {
      const ev = await apiDegerlendir(questionText(cur), q);
      if (ev && ev.sufficient === false) {
        setMsgs((m) => [...m, { role: "assistant", content: ev.followup || questionText(cur), qIndex: cur, followup: true }]);
      } else {
        const newAnswers = answers.slice(0, cur);
        newAnswers[cur] = q;
        setAnswers(newAnswers);
        const nextStep = cur + 1;
        setStep(nextStep);
        if (nextStep >= N) {
          setMsgs((m) => [...m, { role: "assistant", content: S.thinking }]);
          await runRecommend(newAnswers);
        } else {
          setMsgs((m) => [...m, { role: "assistant", content: questionText(nextStep), qIndex: nextStep }]);
        }
      }
    } catch (e) {
      console.error("[SOHBET] evaluate:", e.message);
      setMsgs((m) => [...m, { role: "assistant", content: S.error }]);
    } finally {
      setBusy(false);
    }
  }

  function reaskTo(target) {
    setMsgs((prev) => {
      const idx = prev.findIndex((m) => m.qIndex === target);
      const cut = idx >= 0 ? prev.slice(0, idx) : prev;
      return [...cut, { role: "assistant", content: questionText(target), qIndex: target }];
    });
    setAnswers((a) => a.slice(0, target));
    setStep(target);
  }

  function goBack() {
    if (busy) return;
    if (phase === "result") {
      setRecs([]);
      setPhase("asking");
      reaskTo(N - 1);
      return;
    }
    if (step <= 0) return;
    reaskTo(step - 1);
  }

  function onAdd(rec) {
    const id = rec.link || rec.ad;
    ProfileStore.add({ id, ad: rec.ad, kurum: rec.kurum, link: rec.link, sure: rec.sure });
    setSelected(ProfileStore.getAll());
  }
  function onRemove(id) {
    ProfileStore.remove(id);
    setSelected(ProfileStore.getAll());
  }

  function restart() {
    setMsgs(initMsgs());
    setAnswers([]);
    setStep(0);
    setRecs([]);
    setPhase("asking");
    setInput("");
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }
  function autosize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

  const backDisabled = busy || (phase === "asking" && step === 0);

  return (
    <div className="cs-page">
      <div className="cs-top">
        <a href="index.html" aria-label={S.brand} style={{ display: "inline-flex" }}><LogoK /></a>
      </div>

      <div className="cs-shell">
        <div className="cs-head">
          <button className="cs-back" onClick={goBack} disabled={backDisabled}>
            <IcK name="back" size={16} /> {S.back}
          </button>
          <div className="cs-title">{S.headerTitle}</div>
          <div className="cs-progress">
            {phase === "asking" ? S.progress(Math.min(step + 1, N), N) : `${N} / ${N}`}
          </div>
        </div>

        {phase === "asking" ? (
          <React.Fragment>
            <div className="cs-body" ref={bodyRef}>
              {msgs.map((m, i) => (
                <div className={"cs-msg " + m.role} key={i}>
                  <div className="cs-bubble">{m.content}</div>
                </div>
              ))}
              {busy && (
                <div className="cs-msg assistant">
                  <div className="cs-bubble"><span className="cs-typing"><i></i><i></i><i></i></span></div>
                </div>
              )}
            </div>

            <div className="cs-inputbar">
              <div className="cs-inputrow">
                <textarea
                  ref={taRef}
                  rows={1}
                  value={input}
                  placeholder={S.placeholder}
                  disabled={busy}
                  onChange={(e) => { setInput(e.target.value); autosize(e.target); }}
                  onKeyDown={onKey}
                />
                <button className="cs-send" onClick={() => submit()} disabled={busy || !input.trim()} aria-label="Send">
                  <IcK name="send" size={18} />
                </button>
              </div>
            </div>
          </React.Fragment>
        ) : (
          <div className="cs-result">
            <div className="cs-result-head">
              <h2>{S.result.title}</h2>
              <p>{S.result.sub}</p>
            </div>

            {recs.length === 0 ? (
              <p className="cs-profile-empty" style={{ textAlign: "center" }}>{S.result.empty}</p>
            ) : (
              <div className="cs-cards">
                {recs.map((r, i) => {
                  const id = r.link || r.ad;
                  const added = selected.some((x) => x.id === id);
                  return (
                    <div className="cs-card" key={i}>
                      <h3>{r.ad}</h3>
                      {r.kurum ? <div className="cs-card-kurum">{r.kurum}</div> : null}
                      {r.aciklama ? <p className="cs-card-desc">{r.aciklama}</p> : null}
                      {r.sure ? <div className="cs-card-meta"><span>{S.result.duration}: {r.sure}</span></div> : null}
                      {r.gerekce ? <div className="cs-card-reason"><strong>{S.result.reason}:</strong> {r.gerekce}</div> : null}
                      <button className="cs-add" disabled={added} onClick={() => onAdd(r)}>
                        <IcK name={added ? "check" : "plus"} size={15} /> {added ? S.result.added : S.result.add}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="cs-actions">
              <button className="cs-restart" onClick={restart}>{S.result.restart}</button>
            </div>

            <div className="cs-profile">
              <h3>{S.result.profileTitle}</h3>
              {selected.length === 0 ? (
                <p className="cs-profile-empty">{S.result.profileEmpty}</p>
              ) : (
                <ul className="cs-profile-list">
                  {selected.map((s) => (
                    <li className="cs-profile-item" key={s.id}>
                      <span>{s.link ? <a href={s.link} target="_blank" rel="noopener noreferrer">{s.ad}</a> : s.ad}</span>
                      <button onClick={() => onRemove(s.id)}>{S.result.remove}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<KariyerSohbet />);
