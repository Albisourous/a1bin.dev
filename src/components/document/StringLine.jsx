import { useEffect, useRef, useState } from "react";
import { SCRAMBLE_POOL } from "../../lib/charset.js";
import { mulberry32 } from "../../lib/rng.js";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Text that resolves out of the mojibake pool, left to right.
// Re-scrambles on hover. ~400ms total.
export default function StringLine({ string }) {
  const { text, href } = string;
  const [display, setDisplay] = useState(() => (reduced() ? text : scramble(text, 0)));
  const frame = useRef(0);
  const timer = useRef(null);

  function scramble(t, f) {
    const rng = mulberry32(0xbeef + f * 7919);
    return t
      .split("")
      .map((ch, i) => {
        if (ch === " ") return " ";
        const settle = i * 1.5 + 8 + (i % 7); // staggered resolve
        return f >= settle ? ch : SCRAMBLE_POOL[Math.floor(rng() * SCRAMBLE_POOL.length)];
      })
      .join("");
  }

  function play() {
    if (reduced()) {
      setDisplay(text);
      return;
    }
    clearInterval(timer.current);
    frame.current = 0;
    timer.current = setInterval(() => {
      frame.current += 1;
      const next = scramble(text, frame.current);
      setDisplay(next);
      if (next === text) clearInterval(timer.current);
    }, 28);
  }

  useEffect(() => {
    play();
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const Tag = href ? "a" : "span";
  const props = href
    ? { href, target: "_blank", rel: "noreferrer" }
    : {};

  return (
    <Tag
      className="document__string"
      onMouseEnter={play}
      {...props}
    >
      {display}
    </Tag>
  );
}
