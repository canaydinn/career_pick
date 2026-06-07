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
    case "spark-sm": return (<svg {...p}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/></svg>);
    case "plus": return (<svg {...p}><path d="M12 5v14M5 12h14"/></svg>);
    case "check": return (<svg {...p}><path d="M5 12l4.5 4.5L19 7"/></svg>);
    case "bolt": return (<svg {...p}><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>);
    case "globe": return (<svg {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>);
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
function Chatbot({ c }) {
  const [messages, setMessages] = useState([{ role: "assistant", content: c.greeting }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showStarters, setShowStarters] = useState(true);
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  // reset greeting when language changes
  useEffect(() => {
    setMessages([{ role: "assistant", content: c.greeting }]);
    setShowStarters(true);
  }, [c.greeting]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setShowStarters(false);
    const next = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const convo = next.map((m) => `${m.role === "user" ? "Kullanıcı/User" : "Asistan/Assistant"}: ${m.content}`).join("\n");
      const reply = await window.claude.complete({
        messages: [{ role: "user", content: `${c.system}\n\nKonuşma geçmişi:\n${convo}\n\nAsistan olarak yanıtla:` }],
      });
      setMessages((m) => [...m, { role: "assistant", content: (reply || c.error).trim() }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: c.error }]);
    } finally {
      setBusy(false);
    }
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
        {showStarters && !busy && (
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
          onChange={(e) => { setInput(e.target.value); autosize(e.target); }}
          onKeyDown={onKey}
        />
        <button className="chat-send" onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send">
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
