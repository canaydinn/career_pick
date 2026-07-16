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

  const [answers, setAnswers] = useStateK([]);      // answers[i] = i. soruya verilen kesinlesmis cevap
  const [step, setStep] = useStateK(0);             // kac soru kesinlesti (siradaki soru = step)
  const [input, setInput] = useStateK("");
  const [busy, setBusy] = useStateK(false);
  const [phase, setPhase] = useStateK("asking");    // "asking" | "result"
  const [editingIndex, setEditingIndex] = useStateK(null); // duzenlenmekte olan gecmis soru indeksi
  const [followup, setFollowup] = useStateK(null);  // { forIndex, text } - yetersiz cevap sonrasi derinleme sorusu
  const [recomputing, setRecomputing] = useStateK(false); // sonuc ekranindayken bir cevap duzenlendiginde onerileri yeniden hesaplama
  const [recs, setRecs] = useStateK([]);
  const [selected, setSelected] = useStateK(() => ProfileStore.getAll());

  const bodyRef = useRefK(null);
  const taRef = useRefK(null);

  const questionText = (i) => (S.questions[i] ? S.questions[i].q : "");

  // Gorunen mesaj listesi her zaman answers/step/editingIndex durumundan turetilir;
  // boylece "geri" veya "duzenle" hicbir zaman gecmis cevaplari silmez.
  function buildMessages() {
    const arr = [{ key: "greeting", role: "assistant", content: S.greeting }];
    for (let i = 0; i < step; i++) {
      if (editingIndex === i) {
        arr.push({
          key: "editq" + i,
          role: "assistant",
          content: (followup && followup.forIndex === i) ? followup.text : questionText(i),
          isEditing: true,
        });
      } else {
        arr.push({ key: "q" + i, role: "assistant", content: questionText(i) });
        arr.push({ key: "a" + i, role: "user", content: answers[i], editableIndex: i });
      }
    }
    if (editingIndex === null) {
      if (recomputing) {
        arr.push({ key: "thinking2", role: "assistant", content: S.thinking });
      } else if (phase === "asking") {
        if (step < N) {
          arr.push({
            key: "curq",
            role: "assistant",
            content: (followup && followup.forIndex === step) ? followup.text : questionText(step),
          });
        } else {
          arr.push({ key: "thinking", role: "assistant", content: S.thinking });
        }
      }
    }
    return arr;
  }
  const msgs = buildMessages();
  const showChatUI = phase === "asking" || editingIndex !== null || recomputing;

  useEffectK(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs.length, busy, showChatUI]);

  // Input, gecmis bir cevabi duzenlemek uzere geri doldururken de otomatik boyutlansin
  useEffectK(() => {
    if (taRef.current) autosize(taRef.current);
  }, [input]);

  // Tamamlanan soru sayisina gore ilerleme yuzdesi (sonuc ekraninda %100)
  const progressPct = (phase === "result" && editingIndex === null && !recomputing) ? 100 : Math.round((step / N) * 100);

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
    if (!q || busy) return;
    const idx = editingIndex !== null ? editingIndex : step;
    if (idx >= N) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    setBusy(true);

    try {
      const ev = await apiDegerlendir(questionText(idx), q);
      if (ev && ev.sufficient === false) {
        setFollowup({ forIndex: idx, text: ev.followup || questionText(idx) });
      } else {
        const newAnswers = answers.slice();
        newAnswers[idx] = q;
        setAnswers(newAnswers);
        setFollowup(null);
        if (editingIndex !== null) {
          // Gecmis bir cevap duzenlendi; sonraki cevaplar hic dokunulmadan kalir.
          setEditingIndex(null);
          if (phase === "result") {
            setRecomputing(true);
            await runRecommend(newAnswers);
            setRecomputing(false);
          }
        } else {
          const nextStep = idx + 1;
          setStep(nextStep);
          if (nextStep >= N) {
            await runRecommend(newAnswers);
          }
        }
      }
    } catch (e) {
      console.error("[SOHBET] evaluate:", e.message);
      setFollowup({ forIndex: idx, text: S.error });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(i) {
    if (busy || i < 0 || i >= step) return;
    setEditingIndex(i);
    setFollowup(null);
    setInput(answers[i] || "");
  }

  function cancelEdit() {
    if (busy) return;
    setEditingIndex(null);
    setFollowup(null);
    setInput("");
  }

  // Ust bardaki "Geri" kisayolu: en son cevaplanan soruyu duzenlemeye ac.
  // Herhangi bir onceki soruyu duzenlemek icin o cevabin yanindaki kalem ikonu kullanilabilir.
  function goBack() {
    if (busy || step <= 0) return;
    startEdit(step - 1);
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
    setAnswers([]);
    setStep(0);
    setEditingIndex(null);
    setFollowup(null);
    setRecomputing(false);
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

  const isEditing = editingIndex !== null;
  const backDisabled = busy || (isEditing ? false : step === 0);

  return (
    <div className="cs-page">
      <div className="cs-top">
        <a href="index.html" aria-label={S.brand} style={{ display: "inline-flex" }}><LogoK /></a>
      </div>

      <div className="cs-shell">
        <div className="cs-head">
          {isEditing ? (
            <button className="cs-back" onClick={cancelEdit} disabled={busy}>
              <IcK name="close" size={16} /> {S.cancelEdit}
            </button>
          ) : (
            <button className="cs-back" onClick={goBack} disabled={backDisabled}>
              <IcK name="back" size={16} /> {S.back}
            </button>
          )}
          <div className="cs-title">{S.headerTitle}</div>
          <div className="cs-progress">
            {isEditing ? S.editingBadge(editingIndex + 1, N) : (showChatUI ? S.progress(Math.min(step + 1, N), N) : `${N} / ${N}`)}
          </div>
        </div>

        <div className="cs-progress-track">
          <div className="cs-progress-fill" style={{ width: progressPct + "%" }}></div>
        </div>

        {showChatUI ? (
          <React.Fragment>
            <div className="cs-body" ref={bodyRef}>
              {msgs.map((m) => (
                <div className={"cs-msg " + m.role + (m.isEditing ? " cs-editing" : "")} key={m.key}>
                  <div className="cs-bubble">{m.content}</div>
                  {m.role === "user" && typeof m.editableIndex === "number" && !isEditing && !busy && (
                    <button
                      type="button"
                      className="cs-edit-btn"
                      onClick={() => startEdit(m.editableIndex)}
                      aria-label={S.editAnswer}
                      title={S.editAnswer}
                    >
                      <IcK name="edit" size={13} />
                    </button>
                  )}
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

            <div className="cs-answers-review">
              <h3>{S.result.answersTitle}</h3>
              <p className="cs-answers-hint">{S.result.answersHint}</p>
              <ul className="cs-answers-list">
                {S.questions.map((qq, i) => (
                  <li className="cs-answer-item" key={i}>
                    <div className="cs-answer-text">
                      <div className="cs-answer-q">{qq.q}</div>
                      <div className="cs-answer-a">{answers[i]}</div>
                    </div>
                    <button
                      type="button"
                      className="cs-edit-btn cs-edit-btn-inline"
                      onClick={() => startEdit(i)}
                      disabled={busy}
                      aria-label={S.editAnswer}
                      title={S.editAnswer}
                    >
                      <IcK name="edit" size={13} /> {S.editAnswer}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

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
