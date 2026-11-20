import { useEffect, useMemo, useRef, useState } from "react";
import { SITE } from "../content/site.js";
import { mulberry32 } from "../lib/rng.js";
import { noiseLine } from "../lib/charset.js";

// Lily Chou-Chou boot frame: flat field, ghost text typed in, hard cut.
// Click anywhere to skip.
export default function Intertitle({ onDone }) {
  // Ghost layout: the caption lines interleaved with pale noise blocks.
  const blocks = useMemo(() => {
    const rng = mulberry32(0x11c4);
    const out = [];
    for (const line of SITE.intertitle) {
      out.push({ kind: "caption", text: line });
      const n = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        out.push({ kind: "ghost", text: noiseLine(rng, 72) });
      }
    }
    return out;
  }, []);

  const [shown, setShown] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (shown >= blocks.length) {
      const t = setTimeout(finish, 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setShown((s) => s + 1),
      blocks[shown].kind === "caption" ? 420 : 60
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  function finish() {
    if (done.current) return;
    done.current = true;
    onDone();
  }

  return (
    <div className="intertitle" onClick={finish} role="presentation">
      {blocks.slice(0, shown).map((b, i) => (
        <div
          key={i}
          className="intertitle__line"
          style={b.kind === "ghost" ? { opacity: 0.35 } : undefined}
          aria-hidden={b.kind === "ghost"}
        >
          {b.text}
        </div>
      ))}
    </div>
  );
}
