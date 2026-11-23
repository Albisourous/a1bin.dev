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
const DRAG_MAX = 10; // how far a node can be pulled from its slot

// Obsidian-style graph. Hover a node to light its edges; click to open
// the file as a tab. Nodes drag a little and spring back — the ring
// owns the layout.
export default function Graph({ onOpen }) {
  const [hot, setHot] = useState(null);
  const [offs, setOffs] = useState({}); // name → drag offset {x, y}
  const svgRef = useRef(null);
  const drag = useRef(null); // {name, sx, sy, ox, oy}
  const snap = useRef(null); // rAF driving the spring-back
  const moved = useRef(false); // real drag happened — swallow the click

  useEffect(() => () => cancelAnimationFrame(snap.current), []);

  const toSvg = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const loc = toSvg(e);
    let x = d.ox + loc.x - d.sx;
    let y = d.oy + loc.y - d.sy;
    const len = Math.hypot(x, y);
    if (len > DRAG_MAX) {
      x = (x / len) * DRAG_MAX;
      y = (y / len) * DRAG_MAX;
    }
    if (len > 1.5) moved.current = true;
    setOffs((o) => ({ ...o, [d.name]: { x, y } }));
  };

  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    window.removeEventListener("pointermove", onMove);
    if (!d) return;
    // spring home — shrink the offset until it's gone
    const name = d.name;
    const tick = () => {
      let done = false;
      setOffs((o) => {
        const cur = o[name];
        if (!cur) {
          done = true;
          return o;
        }
        const x = cur.x * 0.78;
        const y = cur.y * 0.78;
        if (Math.hypot(x, y) < 0.2) {
          done = true;
          const rest = { ...o };
          delete rest[name];
          return rest;
        }
        return { ...o, [name]: { x, y } };
      });
      if (!done) snap.current = requestAnimationFrame(tick);
    };
    snap.current = requestAnimationFrame(tick);
  };

  const grab = (e, n) => {
    cancelAnimationFrame(snap.current); // freeze a mid-flight return
    const loc = toSvg(e);
    moved.current = false;
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
      className="graph"
      viewBox="-62 -62 124 124"
      role="img"
      aria-label="graph of site files"
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
      {G.names.map((n) => {
        const r = radius(n);
        return (
          <g
            key={n}
            transform={`translate(${at(n).x} ${at(n).y})`}
            className={`graph__node${n === G.hub ? " is-hub" : ""}`}
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
            <circle className="graph__hit" r={r + 3} />
            <circle className="graph__dot" r={r} />
            <text className="graph__label" y={r + 4.6} textAnchor="middle">
              {n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
