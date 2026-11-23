import { useEffect, useRef, useState } from "react";
import { SITE } from "../../content/site.js";

// The agent panel: scripted opening conversation + canned replies for
// whatever the user types. Pure client, nothing sent anywhere.
export default function Chat({ onClose }) {
  const [msgs, setMsgs] = useState(SITE.chat);
  const [draft, setDraft] = useState("");
  const replyIdx = useRef(0);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs]);

  function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setMsgs((m) => [...m, { role: "user", text }]);
    const reply =
      SITE.cannedReplies[replyIdx.current++ % SITE.cannedReplies.length];
    setTimeout(() => {
      setMsgs((m) => [...m, { role: "agent", text: reply }]);
    }, 600);
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
          aria-label="message devin"
        />
      </form>
    </aside>
  );
}
