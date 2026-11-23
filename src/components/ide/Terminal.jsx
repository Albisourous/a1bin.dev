import { useEffect, useRef, useState } from "react";
import { SITE } from "../../content/site.js";

// Fake shell pinned to the bottom of the workbench. Always open; the log
// seeds from SITE.term and the prompt runs real commands against the site
// tree — ls, cat, open, plus the usual shell trivia.
function run(cmd, onOpen) {
  const [name, ...args] = cmd.split(/\s+/);
  const arg = args.join(" ");
  switch (name) {
    case "ls":
      return Object.keys(SITE.contents).join("  ");
    case "whoami":
      return "albin";
    case "pwd":
      return "/Users/albin/a1bin.dev";
    case "help":
      return SITE.termHelp;
    case "echo":
      return arg;
    case "cat":
    case "open": {
      if (!arg) return `${name}: missing file`;
      if (!SITE.contents[arg]) return `${name}: ${arg}: no such file`;
      if (name === "open") {
        onOpen?.(arg);
        return `opened ${arg}`;
      }
      return SITE.contents[arg];
    }
    default:
      return `command not found: ${name}`;
  }
}

export default function Terminal({ onOpen, onClose }) {
  const [lines, setLines] = useState(SITE.term);
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  function send(e) {
    e.preventDefault();
    const cmd = draft.trim();
    if (!cmd) return;
    setDraft("");
    if (cmd === "clear") {
      setLines([]);
      return;
    }
    const out = run(cmd, onOpen);
    setLines((l) => [
      ...l,
      `${SITE.termPrompt} ${cmd}`,
      ...(Array.isArray(out) ? out : [out]),
    ]);
  }

  return (
    <section className="terminal" aria-label="terminal">
      <div className="terminal__head">
        {SITE.termTitle}
        <button
          className="terminal__x"
          onClick={onClose}
          aria-label="close terminal"
        >
          ×
        </button>
      </div>
      <div className="terminal__body">
        {lines.map((l, i) => (
          <div
            key={i}
            className={`terminal__line${
              l.startsWith(SITE.termPrompt) ? " terminal__line--cmd" : ""
            }`}
          >
            {l}
          </div>
        ))}
        <form className="terminal__prompt" onSubmit={send}>
          <span className="terminal__sigil" aria-hidden="true">
            {SITE.termPrompt}
          </span>
          <input
            className="terminal__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="terminal input"
          />
        </form>
        <div ref={endRef} />
      </div>
    </section>
  );
}
