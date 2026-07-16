/* global React */
const { useState, useRef, useEffect } = React;

/* ---------- Icons ---------- */
function Icon({ name, size = 24, stroke = 1.7 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "doc": return (<svg {...p}><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M9 13h6M9 17h4"/></svg>);
    case "route": return (<svg {...p}><circle cx="6" cy="19" r="2.4"/><circle cx="18" cy="5" r="2.4"/><path d="M8.4 19H14a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h5.6"/></svg>);
    case "spark": return (<svg {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>);
    case "send": return (<svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>);
    case "arrow": return (<svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>);
    case "back": return (<svg {...p}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>);
    case "spark-sm": return (<svg {...p}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/></svg>);
    case "plus": return (<svg {...p}><path d="M12 5v14M5 12h14"/></svg>);
    case "check": return (<svg {...p}><path d="M5 12l4.5 4.5L19 7"/></svg>);
    case "bolt": return (<svg {...p}><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>);
    case "globe": return (<svg {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>);
    case "edit": return (<svg {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>);
    case "close": return (<svg {...p}><path d="M18 6L6 18M6 6l12 12"/></svg>);
    default: return null;
  }
}

/* ---------- Avatar mark ---------- */
function Logo({ size = 30 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, letterSpacing: "-0.02em" }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--accent)"/>
        <path d="M9 20.5l4.2-9 3 6.2 2-3.4L22.5 20.5" stroke="var(--accent-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="22.5" cy="11.5" r="2.1" fill="var(--accent-2)"/>
      </svg>
      <span>Career&nbsp;Pick</span>
    </span>
  );
}

/* ---------- Live chatbot ---------- */
// Bu sabitler api/assessment.py icindeki META_SENARYO_SAYISI / DERINLEME_SAYISI
// ile ayni degerlerdedir; sadece ilerleme cubugu icin toplam adim tahmini uretir.
const CS_META_SENARYO_SAYISI = 5;
const CS_DERINLEME_SAYISI    = 3;
const CS_STAGE1_WEIGHT       = 1; // kullanici tanima asamasi tek "soru" olarak sayilir
const CS_TOTAL_STEPS         = CS_STAGE1_WEIGHT + CS_META_SENARYO_SAYISI + CS_DERINLEME_SAYISI;

// Backend'in yanit metnine gomdugu "**Senaryo k/5**" / "**Derinleme Sorusu k/3**"
// etiketlerini okuyarak su anki soru numarasini turetir (backend'e dokunmadan).
function csProgressCurrent(asama, questionText) {
  if (asama === 2) {
    const m = /\*\*Senaryo (\d+)\/(\d+)\*\*/.exec(questionText || "");
    const k = m ? parseInt(m[1], 10) : 1;
    return CS_STAGE1_WEIGHT + Math.min(k, CS_META_SENARYO_SAYISI);
  }
  if (asama === 3) {
    const m = /\*\*Derinleme Sorusu (\d+)\/(\d+)\*\*/.exec(questionText || "");
    const k = m ? parseInt(m[1], 10) : 1;
    return CS_STAGE1_WEIGHT + CS_META_SENARYO_SAYISI + Math.min(k, CS_DERINLEME_SAYISI);
  }
  if (asama >= 4) return CS_TOTAL_STEPS;
  return CS_STAGE1_WEIGHT; // asama 1
}

function Chatbot({ c }) {
  const lang = (typeof localStorage !== "undefined" && localStorage.getItem("cp_lang")) === "en" ? "en" : "tr";
  const L = lang === "en"
    ? { back: "Back", question: (a, b) => `Question ${a} / ${b}` }
    : { back: "Geri", question: (a, b) => `Soru ${a} / ${b}` };

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showStarters, setShowStarters] = useState(true);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Su an cevap beklenen soru: { question, asama }
  const [currentStep, setCurrentStep] = useState({ question: c.greeting, asama: 1 });
  // Cevaplanmis adimlar: { question, answer, tokenBefore, tokenAfter, asama }
  // tokenBefore, bu adimdan ONCEKI sifrelenmis oturum durumudur; geri donup
  // cevabi degistirince sunucuya tam olarak bu token gonderilir ve akis o
  // noktadan itibaren (mevcut dallanma mantigi bozulmadan) yeniden hesaplanir.
  const [steps, setSteps] = useState([]);
  const [finalReport, setFinalReport] = useState(null);

  const scrollRef = useRef(null);
  const taRef = useRef(null);
  // Sunucudan donen en guncel (ileri) sifrelenmis oturum token'i
  const sessionRef = useRef(null);

  // Gorunen mesaj listesi: gecmis adimlar + su anki soru (veya final rapor) + varsa hata
  const messages = [];
  steps.forEach((s) => {
    messages.push({ role: "assistant", content: s.question });
    messages.push({ role: "user", content: s.answer });
  });
  if (done && finalReport) {
    messages.push({ role: "assistant", content: finalReport });
  } else if (currentStep) {
    messages.push({ role: "assistant", content: currentStep.question });
  }
  if (errorMsg) messages.push({ role: "assistant", content: errorMsg });

  const progressCurrent = done ? CS_TOTAL_STEPS : csProgressCurrent(currentStep ? currentStep.asama : 1, currentStep ? currentStep.question : "");
  const progressPct = Math.round((progressCurrent / CS_TOTAL_STEPS) * 100);
  const backDisabled = busy || steps.length === 0;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [steps.length, busy, done, errorMsg]);

  // reset greeting + oturum when language changes
  useEffect(() => {
    setCurrentStep({ question: c.greeting, asama: 1 });
    setSteps([]);
    setShowStarters(true);
    setDone(false);
    setFinalReport(null);
    setErrorMsg(null);
    setInput("");
    sessionRef.current = null;
  }, [c.greeting]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy || done || !currentStep) return;
    setShowStarters(false);
    setErrorMsg(null);
    setInput("");
    setBusy(true);

    const tokenBefore = sessionRef.current;
    const answeredStep = currentStep;

    try {
      const response = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, session: tokenBefore }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Sunucu hatası");
      }

      const data = await response.json();
      const replyText = data.reply || c.error;

      // Sunucudan donen guncel oturum token'ini sakla
      sessionRef.current = data.session || null;

      // Bu adimi (soru + cevap + onceki/sonraki token) gecmise ekle;
      // boylece "geri" ile buraya donulebilir.
      setSteps((prev) => [
        ...prev,
        { question: answeredStep.question, answer: q, tokenBefore, tokenAfter: sessionRef.current, asama: answeredStep.asama },
      ]);

      if (data.done) {
        setDone(true);
        setFinalReport(replyText);
        setCurrentStep(null);
      } else {
        setCurrentStep({ question: replyText, asama: data.asama });
      }
    } catch (e) {
      console.error("[CHAT ERROR]", e.message);
      setErrorMsg(c.error);
      setInput(q);
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    if (backDisabled) return;
    const last = steps[steps.length - 1];
    const next = steps.slice(0, -1);
    setSteps(next);
    // Sunucu durumunu bu adimdan ONCEKI token'a al; bir sonraki gonderim
    // sanki o soru hic cevaplanmamis gibi yeniden islenir.
    sessionRef.current = last.tokenBefore;
    setCurrentStep({ question: last.question, asama: last.asama });
    setInput(last.answer);
    setDone(false);
    setFinalReport(null);
    setErrorMsg(null);
    if (next.length === 0) setShowStarters(true);
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }
  function autosize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
  }

  return (
    <div className="chatbot">
      <div className="chat-head">
        <div className="chat-id">
          <span className="chat-avatar">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="9" fill="var(--accent)"/><path d="M9 20.5l4.2-9 3 6.2 2-3.4L22.5 20.5" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="22.5" cy="11.5" r="2.1" fill="var(--accent-2)"/></svg>
          </span>
          <div>
            <div className="chat-name">{c.title}</div>
            <div className="chat-status"><span className="dot"></span>{c.status}</div>
          </div>
        </div>
        <span className="chat-live"><Icon name="bolt" size={13} /> AI</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--line)", background: "rgba(255,255,255,0.02)" }}>
        <button
          onClick={goBack}
          disabled={backDisabled}
          aria-label={L.back}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, flex: "0 0 auto",
            background: "transparent", border: "1px solid var(--line)", color: "var(--muted)",
            borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 600,
            opacity: backDisabled ? 0.4 : 1, cursor: backDisabled ? "default" : "pointer",
          }}
        >
          <Icon name="back" size={13} /> {L.back}
        </button>

        <div style={{ flex: 1, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: progressPct + "%", background: "var(--accent)", borderRadius: 999, transition: "width .25s ease" }}></div>
        </div>

        <span style={{ fontSize: 11.5, color: "var(--faint)", fontWeight: 600, flex: "0 0 auto", whiteSpace: "nowrap" }}>
          {L.question(progressCurrent, CS_TOTAL_STEPS)}
        </span>
      </div>

      <div className="chat-body" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={"msg " + m.role}>
            {m.role === "assistant" && (
              <span className="msg-av"><Icon name="spark-sm" size={14} /></span>
            )}
            <div className="bubble">{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="msg assistant">
            <span className="msg-av"><Icon name="spark-sm" size={14} /></span>
            <div className="bubble typing"><i></i><i></i><i></i></div>
          </div>
        )}
        {showStarters && !busy && steps.length === 0 && (
          <div className="starters">
            {c.starters.map((s, i) => (
              <button key={i} className="starter" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
      </div>

      <div className="chat-input">
        <textarea
          ref={taRef}
          rows={1}
          value={input}
          placeholder={c.placeholder}
          disabled={done}
          onChange={(e) => { setInput(e.target.value); autosize(e.target); }}
          onKeyDown={onKey}
        />
        <button className="chat-send" onClick={() => send()} disabled={busy || done || !input.trim()} aria-label="Send">
          <Icon name="send" size={18} />
        </button>
      </div>
      <div className="chat-hint">{c.hint}</div>
    </div>
  );
}

window.CPIcon = Icon;
window.CPLogo = Logo;
window.CPChatbot = Chatbot;
