import { useEffect, useRef, useState } from "react";
import { SITE } from "../../content/site.js";

// The agent panel: opening conversation from SITE.chat, real replies
// from /api/chat (Groq, server-side). When the API isn't there — plain
// `vite dev`, no key, or an error — it falls back to canned replies.
export default function Chat({ onClose }) {
  const [msgs, setMsgs] = useState(SITE.chat);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const replyIdx = useRef(0);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs]);

  async function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    const next = [...msgs, { role: "user", text }];
    setMsgs([...next, { role: "agent", text: "…" }]);
    setBusy(true);
    let reply;
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!r.ok) throw new Error(await r.text());
      reply = (await r.json()).reply;
    } catch {
      reply =
        SITE.cannedReplies[replyIdx.current++ % SITE.cannedReplies.length];
    }
    setMsgs((m) => [...m.slice(0, -1), { role: "agent", text: reply }]);
    setBusy(false);
  }

  return (
    <aside className="chat" aria-label="agent chat">
      <div className="chat__head">
        {SITE.chatTitle}
        <button className="chat__x" onClick={onClose} aria-label="close chat">
          ×
        </button>
      </div>
      <div className="chat__msgs">
        {msgs.map((m, i) => (
          <div key={i} className={`chat__msg chat__msg--${m.role}`}>
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="chat__form" onSubmit={send}>
        <input
          className="chat__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="ask anything…"
          aria-label={`message ${SITE.chatTitle}`}
        />
      </form>
    </aside>
  );
}
