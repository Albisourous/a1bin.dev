import { useEffect, useRef, useState } from "react";
import { SITE } from "../../content/site.js";

// Deterministic layout: the hub file sits at the center, every other
// file evenly spaced on one ring around it. Fixed positions — the graph
// reads the same on every load.
const R = 44;

function build() {
  const hub = SITE.graphCenter;
  const names = [...Object.keys(SITE.contents), ...Object.keys(SITE.pdfs)];
  const pos = { [hub]: { x: 0, y: 0 } };
  const rest = names.filter((n) => n !== hub);
  rest.forEach((n, i) => {
    const a = (i / rest.length) * Math.PI * 2 - Math.PI / 2;
    pos[n] = { x: Math.cos(a) * R, y: Math.sin(a) * R };
  });

  // Directed edges — "a links to b" draws an arrow a → b. links lists
  // hold unique targets, so no dedup needed; mutual links overlap and
  // read as a two-headed line.
  const edges = [];
  for (const [a, targets] of Object.entries(SITE.links)) {
    for (const b of targets) {
      if (pos[a] && pos[b]) edges.push([a, b]);
    }
  }
  return { names, hub, pos, edges };
}

const G = build();

const radius = (n) => (n === G.hub ? 4.6 : 2.6);
// Invisible hit ring around each dot, and the per-frame ease factor for
// the magnetic pull. Sizes here are viewBox units (~5 per screen px).
const HIT = 6;
const LERP = 0.16;
// Drag bounds (viewBox is -62..62). y stops higher so labels stay
// on-screen — they hang ~8 units below the node center.
const BOUND_X = 58;
const BOUND_Y_MIN = -58;
const BOUND_Y_MAX = 50;

// Obsidian-style graph. Hover a node to light its edges; click to open
// the file as a tab. Nodes drag freely and stay where dropped.
export default function Graph({ onOpen }) {
  const [hot, setHot] = useState(null);
  const [dragging, setDragging] = useState(null); // name being dragged
  const [offs, setOffs] = useState({}); // name → drag offset {x, y}
  const svgRef = useRef(null);
  const drag = useRef(null); // {name, sx, sy, ox, oy}
  const moved = useRef(false); // real drag happened — swallow the click
  const cursor = useRef(null); // last pointer pos, svg units
  const feel = useRef({}); // name → lerped magnet offset {x, y}
  const popRefs = useRef({}); // name → inner <g> the rAF loop writes to
  // Mirrors so the rAF loop sees current values without re-subscribing.
  const hotRef = useRef(hot);
  hotRef.current = hot;
  const offsRef = useRef(offs);
  offsRef.current = offs;

  // Ambient drift + magnetic pull. One loop mutates transform attributes
  // directly so React never re-renders for it. Skipped entirely when the
  // user prefers reduced motion — the entrance CSS handles itself.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf;
    const tick = (t) => {
      const c = cursor.current;
      const h = hotRef.current;
      G.names.forEach((n, i) => {
        const el = popRefs.current[n];
        if (!el) return;
        const f = feel.current[n] || (feel.current[n] = { x: 0, y: 0 });
        let tx = 0;
        let ty = 0;
        // Hovered node leans ~1.5px toward the cursor; the node under
        // the drag already tracks the pointer, so skip it.
        if (n === h && c && drag.current?.name !== n) {
          const o = offsRef.current[n] || { x: 0, y: 0 };
          const dx = c.x - G.pos[n].x - o.x;
          const dy = c.y - G.pos[n].y - o.y;
          const d = Math.hypot(dx, dy);
          if (d > 0.01) {
            const m = Math.min(0.3, d * 0.12);
            tx = (dx / d) * m;
            ty = (dy / d) * m;
          }
        }
        f.x += (tx - f.x) * LERP;
        f.y += (ty - f.y) * LERP;
        // Ambient breathing: slow, low-amplitude sine per node. Golden-angle
        // phases keep the ring from pulsing in sync.
        const ax = Math.sin(t * 0.00045 + i * 2.4) * 0.24;
        const ay = Math.cos(t * 0.00035 + i * 1.7) * 0.2;
        el.setAttribute("transform", `translate(${f.x + ax} ${f.y + ay})`);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toSvg = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  const track = (e) => {
    cursor.current = toSvg(e);
  };

  const onMove = (e) => {
    track(e);
    const d = drag.current;
    if (!d) return;
    const loc = cursor.current;
    // Clamp the absolute position, not the offset, so nodes can't be
    // pushed off-canvas.
    const px = G.pos[d.name].x + d.ox + loc.x - d.sx;
    const py = G.pos[d.name].y + d.oy + loc.y - d.sy;
    const x = Math.min(BOUND_X, Math.max(-BOUND_X, px)) - G.pos[d.name].x;
    const y = Math.min(BOUND_Y_MAX, Math.max(BOUND_Y_MIN, py)) - G.pos[d.name].y;
    if (Math.hypot(x - d.ox, y - d.oy) > 1.5) moved.current = true;
    setOffs((o) => ({ ...o, [d.name]: { x, y } }));
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(null);
    window.removeEventListener("pointermove", onMove);
  };

  const grab = (e, n) => {
    const loc = toSvg(e);
    moved.current = false;
    setDragging(n);
    drag.current = {
      name: n,
      sx: loc.x,
      sy: loc.y,
      ox: offs[n]?.x ?? 0,
      oy: offs[n]?.y ?? 0,
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag, { once: true });
  };

  const at = (n) => {
    const o = offs[n];
    return o ? { x: G.pos[n].x + o.x, y: G.pos[n].y + o.y } : G.pos[n];
  };

  return (
    <svg
      ref={svgRef}
      className={`graph${hot ? " graph--has-hot" : ""}`}
      viewBox="-62 -62 124 124"
      role="img"
      aria-label="graph of site files"
      onPointerMove={track}
      onPointerLeave={() => (cursor.current = null)}
    >
      <defs>
        <marker
          id="graph-arrow"
          viewBox="0 0 6 6"
          refX="5.5"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path className="graph__arrow" d="M0 0 L6 3 L0 6 z" />
        </marker>
        <marker
          id="graph-arrow-hot"
          viewBox="0 0 6 6"
          refX="5.5"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path className="graph__arrow graph__arrow--hot" d="M0 0 L6 3 L0 6 z" />
        </marker>
      </defs>
      {G.edges.map(([a, b]) => {
        // Line stops short of the target so the arrow tip lands on the
        // node's edge, not under its dot.
        const p = at(a);
        const q = at(b);
        const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        const t = (len - radius(b) - 1) / len;
        return (
          <line
            key={a + b}
            className={`graph__edge${
              hot && (a === hot || b === hot) ? " is-hot" : ""
            }`}
            x1={p.x}
            y1={p.y}
            x2={p.x + (q.x - p.x) * t}
            y2={p.y + (q.y - p.y) * t}
          />
        );
      })}
      {G.names.map((n, i) => {
        const r = radius(n);
        return (
          <g
            key={n}
            transform={`translate(${at(n).x} ${at(n).y})`}
            className={`graph__node${n === G.hub ? " is-hub" : ""}${
              n === hot ? " is-hot" : ""
            }${n === dragging ? " is-drag" : ""}`}
            // --r drives the CSS hover-grow; --d staggers the entrance.
            style={{ "--r": `${r}px`, "--d": `${i * 38}ms` }}
            onMouseEnter={() => setHot(n)}
            onMouseLeave={() => setHot(null)}
            onPointerDown={(e) => grab(e, n)}
            onClick={() => {
              if (moved.current) {
                moved.current = false;
                return;
              }
              onOpen(n);
            }}
          >
            <g
              className="graph__pop"
              ref={(el) => {
                popRefs.current[n] = el;
              }}
            >
              <circle className="graph__hit" r={r + HIT} />
              <circle className="graph__dot" r={r} />
              <text className="graph__label" y={r + 4.6} textAnchor="middle">
                {n}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
