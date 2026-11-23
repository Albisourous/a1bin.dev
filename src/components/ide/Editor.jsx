// Markdown-lite inline render: links and bold only. Everything else is
// plain text — the joke is an editor, not a renderer. Exact filenames
// ("Resume.pdf", "AGENTS.md", "game") link too — clicking opens the tab.
const fileRe = new RegExp(
  `\\b(${[...Object.keys(SITE.contents), ...Object.keys(SITE.pdfs)]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\b`,
  "g"
);

function Inline({ text, onOpen }) {
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  const out = [];
  let key = 0;
  let last = 0;
  let m;
  // Plain-text runs get a second pass: bare filenames become tab links.
  const pushText = (seg) => {
    fileRe.lastIndex = 0;
    let last2 = 0;
    let fm;
    while ((fm = fileRe.exec(seg))) {
      const name = fm[1];
      if (fm.index > last2) out.push(seg.slice(last2, fm.index));
      out.push(
        <a
          key={key++}
          href={`/${encodeURI(SITE.urls[name] ?? name)}`}
          onClick={(e) => {
            e.preventDefault();
            onOpen?.(name);
          }}
        >
          {fm[1]}
        </a>
      );
      last2 = fm.index + fm[0].length;
    }
    if (last2 < seg.length) out.push(seg.slice(last2));
  };
  while ((m = re.exec(text))) {
    if (m.index > last) pushText(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(
        <a key={key++} href={m[2]} target="_blank" rel="noreferrer">
          {m[1]}
        </a>
      );
    } else {
      out.push(<strong key={key++}>{m[3]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return out;
}

function Line({ text, onOpen }) {
  if (text.startsWith("# "))
    return (
      <h1 className="editor__line editor__h1">
        <Inline text={text.slice(2)} onOpen={onOpen} />
      </h1>
    );
  if (text.startsWith("## "))
    return (
      <h2 className="editor__line editor__h2">
        <Inline text={text.slice(3)} onOpen={onOpen} />
      </h2>
    );
  if (text.startsWith("> "))
    return (
      <div className="editor__line editor__quote">
        <Inline text={text.slice(2)} onOpen={onOpen} />
      </div>
    );
  return (
    <div className="editor__line">
      <Inline text={text} onOpen={onOpen} />
    </div>
  );
}

import { useState } from "react";
import { SITE } from "../../content/site.js";
import Graph from "./Graph.jsx";
import Snowboard from "./Snowboard.jsx";
import Leaderboard from "./Leaderboard.jsx";
import { ICONS } from "./icons.jsx";

// WIP pseudo-tabs (SITE.metricsTab, SITE.abTab) — same icon the
// activity bar uses, rendered large over an "under construction" note.
const WIP_ICONS = {
  [SITE.metricsTab]: ICONS.metrics,
  [SITE.abTab]: ICONS.ab,
};

// Editable editor: a styled <pre> shows the content, a transparent
// <textarea> on top owns the caret and input. Gutter numbers count the
// textarea's lines; everything shares doc-text metrics so rows align.
export default function Editor({ tabs, active, onSelect, onClose, onMove, text, onEdit, onOpenFile }) {
  const isGraph = active === SITE.graphTab;
  const isGame = active === SITE.gameFile;
  const isBoard = active === SITE.boardFile;
  const wip = WIP_ICONS[active];
  const pdf = SITE.pdfs[active];
  const lines = text.split("\n");
  // Tab drag state: `dragTab` is being dragged, `overTab` is the drop
  // target — dropping inserts the dragged tab before it.
  const [dragTab, setDragTab] = useState(null);
  const [overTab, setOverTab] = useState(null);
  const endDrag = () => {
    setDragTab(null);
    setOverTab(null);
  };
  return (
    <section className="editor" aria-label={`editor — ${active}`}>
      <div
        className="editor__tabbar"
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          if (dragTab) onMove(dragTab, null);
          endDrag();
        }}
      >
        {tabs.map((t) => (
          <button
            key={t}
            className={`editor__tab${t === active ? " is-open" : ""}${
              t === dragTab ? " is-drag" : ""
            }${t === overTab && t !== dragTab ? " is-drop" : ""}`}
            onClick={() => onSelect(t)}
            draggable
            onDragStart={(e) => {
              setDragTab(t);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={endDrag}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOverTab(t);
            }}
            onDragLeave={() => setOverTab((o) => (o === t ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragTab) onMove(dragTab, t);
              endDrag();
            }}
          >
            {t}
            {t !== SITE.graphTab && (
              <span
                className="editor__x"
                aria-label={`close ${t}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(t);
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
      </div>
      {isGraph ? (
        <div className="editor__graph">
          <Graph onOpen={onOpenFile} />
        </div>
      ) : isGame ? (
        <div className="editor__game">
          <Snowboard />
        </div>
      ) : isBoard ? (
        <div className="editor__game">
          <Leaderboard />
        </div>
      ) : wip ? (
        <div className="editor__wip">
          {wip}
          <span>under construction</span>
        </div>
      ) : pdf ? (
        <div className="editor__pdf">
          <iframe src={pdf} title={active} />
        </div>
      ) : active ? (
        <div className="editor__body">
          <div className="editor__gutter" aria-hidden="true">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <div className="editor__paper">
            <pre className="editor__pre" aria-hidden="true">
              {lines.map((l, i) => (
                <Line key={i} text={l} onOpen={onOpenFile} />
              ))}
            </pre>
            <textarea
              className="editor__input"
              value={text}
              onChange={(e) => onEdit(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label={`edit ${active}`}
            />
          </div>
        </div>
      ) : (
        <div className="editor__body editor__empty">{SITE.emptyEditor}</div>
      )}
    </section>
  );
}
