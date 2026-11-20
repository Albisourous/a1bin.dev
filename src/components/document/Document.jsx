import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import StringLine from "./StringLine.jsx";
import Caret from "./Caret.jsx";

// Char offset of the caret position under a point, relative to a line el.
function colFromPoint(lineEl, x, y) {
  const doc = lineEl.ownerDocument;
  let node = null;
  let offset = 0;
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) ({ offsetNode: node, offset } = pos);
  } else if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    if (r) ({ startContainer: node, startOffset: offset } = r);
  }
  if (!node || !lineEl.contains(node)) return null;

  const range = doc.createRange();
  range.selectNodeContents(lineEl);
  try {
    range.setEnd(node, offset);
  } catch {
    return null;
  }
  return { col: range.toString().length, node, offset };
}

const Document = forwardRef(function Document(
  { lines, wordWrap, onCaret },
  ref
) {
  const docEl = useRef(null);
  const [caret, setCaret] = useState(null); // {x,y,h, line,col}
  // Insertions: { [lineIdx]: [{ col, text }] } — Edit > Time/Date writes here.
  const [insertions, setInsertions] = useState({});
  const caretPos = useRef({ line: 0, col: 0 });

  const withInsertions = (text, idx) => {
    const list = insertions[idx];
    if (!list) return text;
    let out = text;
    for (const { col, text: ins } of [...list].sort((a, b) => b.col - a.col)) {
      out = out.slice(0, col) + ins + out.slice(col);
    }
    return out;
  };

  useImperativeHandle(ref, () => ({
    selectAll() {
      const el = docEl.current;
      const sel = window.getSelection();
      const r = document.createRange();
      r.selectNodeContents(el.querySelector(".document__body"));
      sel.removeAllRanges();
      sel.addRange(r);
    },
    insertAtCaret(text) {
      const { line, col } = caretPos.current;
      setInsertions((prev) => ({
        ...prev,
        [line]: [...(prev[line] || []), { col, text }],
      }));
      caretPos.current = { line, col: col + text.length };
      onCaret?.(caretPos.current.line + 1, caretPos.current.col + 1);
    },
    text() {
      return docEl.current.querySelector(".document__body").innerText;
    },
  }));

  const rendered = useMemo(
    () =>
      lines.map((l, i) => {
        if (l.type === "noise")
          return (
            <div className="document__line" data-line={i} key={i} aria-hidden="true">
              {withInsertions(l.text, i) || " "}
            </div>
          );
        if (l.type === "marker")
          return (
            <div className="document__line" data-line={i} key={i}>
              <span className="document__marker">{l.text}</span>
            </div>
          );
        return (
          <div className="document__line" data-line={i} key={i}>
            {withInsertions(l.padBefore || "", i)}
            <StringLine string={l.string} />
            {l.padAfter || ""}
          </div>
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, insertions]
  );

  function placeCaret(e) {
    const lineEl = e.target.closest?.("[data-line]");
    if (!lineEl) return;
    const hit = colFromPoint(lineEl, e.clientX, e.clientY);
    if (!hit) return;
    const line = Number(lineEl.dataset.line);

    // Caret rect: collapse a range at the hit point and measure it.
    const r = document.createRange();
    try {
      r.setStart(hit.node, hit.offset);
    } catch {
      return;
    }
    r.collapse(true);
    let rect = r.getBoundingClientRect();
    if (!rect || (!rect.height && !rect.width)) {
      rect = lineEl.getBoundingClientRect();
    }
    const docRect = docEl.current.getBoundingClientRect();
    setCaret({
      x: rect.left - docRect.left + docEl.current.scrollLeft,
      y: rect.top - docRect.top + docEl.current.scrollTop,
      h: rect.height || 20,
    });
    caretPos.current = { line, col: hit.col };
    onCaret?.(line + 1, hit.col + 1);
  }

  return (
    <div
      ref={docEl}
      className={`document${wordWrap ? " document--wrap" : ""}`}
      onMouseDown={placeCaret}
      role="document"
      aria-label="a1.bin — corrupted binary, printable strings"
      tabIndex={0}
    >
      <div className="document__body">{rendered}</div>
      <Caret {...(caret || {})} />
    </div>
  );
});

export default Document;
