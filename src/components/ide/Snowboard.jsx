import { useEffect, useRef, useState } from "react";
import {
  cleanName,
  loadBest,
  postScore,
  riderName,
  saveBest,
  saveName,
  shareScore,
} from "./scores.js";

// ASCII-flavored tiny-wings on canvas. Hold SPACE — or press the snow —
// to drop into the downhill and build speed; release to float off the
// crest. Restart is the on-screen button only — a stray tap or a held
// space can't eat a run. The scene is drawn as vectors so it reads as a
// game; the sky specks, pines and HUD stay literal Mononoki text, and
// a dot-matrix overlay keeps the terminal texture. Land on a downslope
// transition for a "perfect slide" — flat landings bounce, upslope
// landings kill your speed, and a bad-angle landing wipes you out.
// Endless — a run ends on a slam, a stall, or a night landing. The
// sun sets as you ride: 15 seconds of daylight, ringed-dot tokens on
// the slope buy +1s each, and once night falls the next touchdown
// ends it — the last flight gets to glide out. Hills steepen with
// distance.

const LEAD = 13; // rider's distance from the left edge, world units
const VIEW_W = 52; // world units visible across the canvas
const VIEW_H = 26; // world units of vertical range

// hills steepen with distance — a run has its own difficulty curve.
// ph is a per-run phase triple rolled in fresh(). It fades in past
// DIVERGE: every run drops onto the same foothills, then the mountains
// slowly go their own way so wipeouts stop landing on one spot.
const DIVERGE = 300; // meters of shared terrain before runs split
const FADE = 600; // meters until the run's own phases are fully in
const hill = (x, ph) => {
  const b = Math.min(1, Math.max(0, (x - DIVERGE) / FADE));
  return (
    (1 + Math.min(1, Math.max(0, x) * 0.001)) *
    (5.2 * Math.sin(x * 0.072 + ph[0] * b) +
      3.0 * Math.sin(x * 0.027 + 1.7 + ph[1] * b) +
      1.5 * Math.sin(x * 0.13 + 4.2 + ph[2] * b))
  );
};
const slope = (x, ph) => (hill(x + 0.4, ph) - hill(x - 0.4, ph)) / 0.8;
// the run starts on the first crest — lift drops you on a hilltop
const startFor = (ph) => {
  for (let x = 0.5; x < 200; x += 0.25)
    if (slope(x - 0.5, ph) > 0 && slope(x + 0.5, ph) <= 0) return x;
  return 0;
};

const G_FLOAT = 16; // released — floaty, hangs in the air
const G_DIVE = 70; // held — drops hard
const PUSH = 50; // slope → speed coupling on the snow
const CARVE = 14; // held-on-snow friction — digging in scrubs speed
const V_MIN = 10;
const V_MAX = 55;
const RUN_LEN = 15; // seconds before the first nightfall
const DAY_CAP = 30; // pickups can only push the sun this far out
const INTRO = 0.55; // lift ride before the run starts

const fresh = () => {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  const ph = [0, 1, 2].map((i) => (hash(seed + i) / 4294967296) * Math.PI * 2);
  const start = startFor(ph);
  return {
    seed,
    ph,
    start,
    x: start,
    y: hill(start, ph),
    vy: 0,
    vx: 14,
    cam: hill(start, ph),
    ground: true,
    held: false,
    combo: 0, // consecutive perfect slides
    fx: null, // floating feedback label {x, y, t, text, kind}
    intro: INTRO, // riding the lift in — the clock hasn't started
    t: 0, // seconds ridden — night falls at dayLen
    dayLen: RUN_LEN, // sun pickups buy more daylight
    collected: new Set(), // grabbed sun tokens
    death: null, // "wiped out" on a bad-angle slam
    crashed: false, // rider lies flat on the snow
    over: false,
    recorded: false, // best already saved for this run
    naming: false, // typing a rider name on the over screen
    nameBuf: "",
  };
};

const hash = (n) => {
  n = (n * 2654435761) >>> 0;
  return (n ^ (n >> 13)) >>> 0;
};

// placement (tokens, pines, specks) re-keys on the run seed past the
// shared opening — early runs match, later runs scatter
const placeHash = (n, seed) => hash(n ^ (n > DIVERGE ? seed : 0));

// sun tokens thin out with distance until a plateau — from ~700m on
// the spacing holds, so a run that keeps speed and keeps grabbing
// tokens stays ahead of the sun. Miss a stretch and you ride in the dark.
const sunGap = (n) => Math.min(36, Math.round((29 + Math.floor(Math.max(0, n) / 45)) / 1.25));
// token height at world x. Five of six sit on a jump arc: trace
// the float ballistic off every crest in the run-up at a good rider
// speed and keep the highest reach at x=n — grabbing one means
// leaving the snow. The rest stay at boot-to-torso level.
const tokenY = (n, h, ph) => {
  if ((h >> 7) % 6 === 0) return hill(n, ph) + 0.7 + ((h >> 4) % 3) * 0.5;
  let y = hill(n, ph) + 2.2;
  for (let x0 = n - 16; x0 < n - 3; x0++) {
    const v = 36;
    const vy0 = Math.min(Math.max(0, slope(x0 - 0.6, ph)) * v * 1.25, 28);
    const t = (n - x0) / v;
    y = Math.max(y, hill(x0, ph) + vy0 * t - 0.5 * G_FLOAT * t * t);
  }
  return y;
};

function step(st, dt) {
  if (st.intro > 0) {
    st.intro -= dt;
    return;
  }
  st.t += dt;
  st.x += st.vx * dt;
  const s = slope(st.x, st.ph);
  const g = st.held ? G_DIVE : G_FLOAT;
  if (st.ground) {
    const y2 = hill(st.x, st.ph);
    // launch when the ballistic arc stays above the new ground —
    // i.e. the hill curved away under the board
    if (st.y + st.vy * dt - 0.5 * g * dt * dt > y2) {
      st.ground = false;
      // lip kick — a sharp crest throws extra height, like a real kicker
      st.vy = Math.min(st.vy * 1.25, 28);
      st.vy -= g * dt;
      st.y += st.vy * dt;
    } else {
      st.y = y2;
      st.vy = s * st.vx;
      if (s < 0) st.vx += -s * PUSH * (st.held ? 2 : 1) * dt;
      else st.vx += -s * PUSH * dt;
      st.vx += (13 - st.vx) * 0.5 * dt;
      // held on the snow — a carve, not a dive: friction bleeds speed
      // so an always-held run stalls out. Only a descent steep enough
      // to out-pump the carve still gains; timing is the skill.
      if (st.held) st.vx -= CARVE * dt;
    }
  } else {
    st.vy -= g * dt;
    st.y += st.vy * dt;
    const y2 = hill(st.x, st.ph);
    if (st.y <= y2) {
      const s2 = slope(st.x, st.ph);
      // wipeout — land badly mismatched to the slope and you slam.
      // steep dives are fine mid-air; it's the landing angle that kills.
      if (Math.abs(Math.atan2(st.vy, st.vx) - Math.atan(s2)) > 1.15) {
        st.ground = true;
        st.crashed = true;
        st.death = "wiped out";
        st.over = true;
        st.y = y2;
        st.fx = { x: st.x, y: st.y, t: 0, text: "slam!", kind: "bad" };
      } else if (s2 < -0.28) {
        st.ground = true;
        st.y = y2;
        st.vy = s2 * st.vx;
        st.combo += 1;
        st.vx += -s2 * 9 + Math.min(6, 2 + st.combo);
        st.fx = {
          x: st.x,
          y: st.y,
          t: 0,
          text: st.combo > 1 ? `perfect x${st.combo}` : "perfect!",
          kind: "good",
        };
      } else if (s2 > 0.28) {
        st.ground = true;
        st.y = y2;
        st.vy = s2 * st.vx;
        st.combo = 0;
        st.vx += -s2 * 9;
        st.fx = { x: st.x, y: st.y, t: 0, text: "rough", kind: "bad" };
      } else if (st.vy < -7) {
        // flat landing with real impact — bounce instead of sliding
        st.combo = 0;
        st.vy = 5;
        st.vx *= 0.94;
        st.fx = { x: st.x, y: st.y, t: 0, text: "bounce", kind: "bad" };
      } else {
        st.ground = true;
        st.y = y2;
        st.vy = s2 * st.vx;
        st.combo = 0;
      }
    }
  }
  // time tokens — strung along jump arcs and the snow; the rider's
  // body has to touch one. Each buys a second of daylight.
  const pn = Math.round(st.x);
  const ph = placeHash(pn, st.seed);
  if (ph % sunGap(pn) === 0 && !st.collected.has(pn)) {
    const py = tokenY(pn, ph, st.ph);
    if ((st.x - pn) ** 2 + (st.y + 1.2 - py) ** 2 < 1.7) {
      st.collected.add(pn);
      st.dayLen = Math.min(DAY_CAP, st.dayLen + 1);
      st.fx = { x: pn, y: py, t: 0, text: "+1s", kind: "time" };
    }
  }
  if (st.fx && (st.fx.t += dt) > 0.9) st.fx = null;
  // fever — chained slides unlock a higher top speed
  const vmax = st.combo >= 3 ? V_MAX + 8 : V_MAX;
  // carving can pull speed under the glide floor — that's the stall.
  // Release before it hits zero and the snow hands the glide back.
  const vmin = st.ground && st.held ? 0 : V_MIN;
  st.vx = Math.min(vmax, Math.max(vmin, st.vx));
  if (st.ground && st.vx <= 0.3 && !st.over) {
    st.vx = 0;
    st.death = "stalled out";
    st.over = true;
  }
  // out of time — past dayLen, the next touchdown ends the run. Riders
  // still in the air get the rest of the flight for free distance.
  if (st.t >= st.dayLen && st.ground && !st.over) {
    st.death = "out of time";
    st.over = true;
  }
  st.cam += (st.y - st.cam) * Math.min(1, 8 * dt);
}

const FONT = '"Mononoki", monospace';
const TOUCH = window.matchMedia?.("(pointer: coarse)").matches;

// the sky sun — circle + 8 rays. Pickups are drawn by drawToken so the
// two never get confused.
function drawSun(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2));
    ctx.lineTo(x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5));
    ctx.stroke();
  }
}

// a time token — ringed dot, reads like a coin. Each is worth +1s.
function drawToken(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function draw(ctx, st, C, W, H, best) {
  const sx = W / VIEW_W;
  const sy = H / VIEW_H;
  const anchorY = H * 0.62;
  const camX = st.x - LEAD;
  const ty = (h) => anchorY - (h - st.cam) * sy;
  ctx.clearRect(0, 0, W, H);

  // sun — sinks toward the horizon as daylight runs out; a token can
  // pull it back up
  const day = Math.min(1, st.t / st.dayLen);
  ctx.strokeStyle = C.accent2;
  ctx.lineWidth = 2;
  drawSun(ctx, W * 0.82, 30 + day * anchorY * 0.7, 7);

  // sky specks — faint ' and . drifting at half speed. Small and plain
  // on purpose: nothing in the sky should read as a pickup.
  ctx.fillStyle = C.noise;
  ctx.font = `10px ${FONT}`;
  const n0 = Math.floor(camX * 0.5);
  for (let n = n0; n < n0 + VIEW_W * 2 + 4; n++) {
    const h = placeHash(n, st.seed);
    if (h % 23 !== 0) continue;
    ctx.fillText(h % 2 ? "'" : ".", (n - camX * 0.5) * sx, 10 + ((h >> 5) % Math.round(anchorY * 0.5)));
  }

  // main slope — filled snow body + bright surface line
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let p = 0; p <= W; p += 2) ctx.lineTo(p, ty(hill(camX + p / sx, st.ph)));
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = C.raise;
  ctx.fill();
  ctx.beginPath();
  for (let p = 0; p <= W; p += 2) {
    const y = ty(hill(camX + p / sx, st.ph));
    p === 0 ? ctx.moveTo(p, y) : ctx.lineTo(p, y);
  }
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // pines planted on the slope — landmarks sell the speed
  ctx.fillStyle = C.dim;
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = "center";
  for (let n = Math.floor(camX); n < camX + VIEW_W + 4; n++) {
    if (placeHash(n, st.seed) % 53 !== 0) continue;
    const tx = (n - camX) * sx;
    const gy = ty(hill(n, st.ph));
    if (gy < 30 || gy > H - 8) continue;
    ctx.fillText("/\\", tx, gy - 24);
    ctx.fillText("/||\\", tx, gy - 14);
    ctx.fillText("||", tx, gy - 5);
  }

  // distance flags — a milestone planted on the slope every 200 m
  ctx.fillStyle = C.noise;
  for (let n = Math.ceil((camX - st.start) / 200) * 200 + st.start; n <= camX + VIEW_W; n += 200) {
    if (n <= st.start) continue;
    const tx = (n - camX) * sx;
    const gy = ty(hill(n, st.ph));
    if (gy < 44 || gy > H - 8) continue;
    ctx.fillText("|", tx, gy - 6);
    ctx.fillText(`${n - st.start}m`, tx, gy - 32);
  }

  // rider — snowboarder + board, rotated with the slope / flight path.
  // The intro rides a lift chair in from the upper left first.
  const px = LEAD * sx;
  const py = ty(st.y);
  const intro = st.intro > 0 ? 1 - st.intro / INTRO : 1;
  if (st.intro > 0) {
    // unload point just above the start knoll
    const ux = px - 4;
    const uy = py - 34;
    // cable rising to the unload bullwheel
    ctx.strokeStyle = C.dim;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-20, uy + 36);
    ctx.lineTo(ux + 24, uy - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ux + 24, uy - 6, 4, 0, Math.PI * 2);
    ctx.stroke();
    // chair rides the cable in, then keeps past the wheel once the
    // rider hopped off
    const q = Math.min(1.35, intro / 0.8);
    const cx = -20 + q * (ux + 44);
    const cy = uy + 36 - q * 42;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + 7);
    ctx.moveTo(cx - 5, cy + 13);
    ctx.lineTo(cx + 6, cy + 13);
    ctx.lineTo(cx + 6, cy + 7);
    ctx.stroke();
    if (intro < 0.8) {
      // seated rider — hunched forward, board dangling
      ctx.strokeStyle = C.accent;
      ctx.fillStyle = C.accent;
      ctx.beginPath();
      ctx.arc(cx - 1, cy + 4.5, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 1, cy + 7);
      ctx.lineTo(cx - 1, cy + 12);
      ctx.lineTo(cx + 3, cy + 12.5);
      ctx.lineTo(cx + 3.5, cy + 17);
      ctx.stroke();
      ctx.fillRect(cx - 3, cy + 17, 10, 2.4);
    }
  }
  if (intro >= 0.8) {
  const ang = st.crashed
    ? -Math.atan(slope(st.x, st.ph)) + 1.35 // ragdoll flat against the slope
    : st.ground
      ? -Math.atan(slope(st.x, st.ph))
      : Math.max(-1.15, Math.min(1.15, -Math.atan2(st.vy, st.vx)));
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);

  // snowboard — long rounded deck
  ctx.fillStyle = C.accent;
  ctx.beginPath();
  ctx.roundRect(-17, -3.5, 34, 3.5, 1.75);
  ctx.fill();

  // snowboarder — vector stick figure in a riding stance. Arms out for
  // balance in the air; one hand grabs the nose when diving.
  ctx.strokeStyle = C.accent;
  ctx.fillStyle = C.accent;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  const leg = (kx, ky, bx) => {
    ctx.beginPath();
    ctx.moveTo(-1, -11); // hip
    ctx.lineTo(kx, ky);
    ctx.lineTo(bx, -4);
    ctx.stroke();
  };
  leg(4, -7, 6); // front leg, knee forward
  leg(-5, -6.5, -6); // back leg
  ctx.beginPath(); // torso, leaning into the ride
  ctx.moveTo(-1, -11);
  ctx.lineTo(3, -19);
  ctx.stroke();
  ctx.beginPath(); // head
  ctx.arc(4.5, -22.5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath(); // arms
  if (!st.ground && st.held && !st.crashed) {
    // dive — reach down and grab the nose
    ctx.moveTo(3, -19);
    ctx.lineTo(9, -4.5);
    ctx.moveTo(3, -19);
    ctx.lineTo(-8, -15);
  } else if (!st.ground || st.crashed) {
    // airborne or sprawled on the snow — arms out
    ctx.moveTo(3, -19);
    ctx.lineTo(11, -15);
    ctx.moveTo(3, -19);
    ctx.lineTo(-9, -16);
  } else {
    // cruising — relaxed tuck, trailing arm
    ctx.moveTo(3, -19);
    ctx.lineTo(8, -14);
    ctx.moveTo(3, -19);
    ctx.lineTo(-7, -13);
  }
  ctx.stroke();
  ctx.restore();
  }

  // floating landing feedback — rises and fades
  if (st.fx) {
    const a = 1 - st.fx.t / 0.9;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle =
      st.fx.kind === "good" ? C.accent : st.fx.kind === "time" ? C.accent2 : C.dim;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(
      st.fx.text,
      (st.fx.x - camX) * sx,
      ty(st.fx.y) - 14 - st.fx.t * 26
    );
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  // dusk → night — the scene dims toward the page background as daylight
  // runs out, and stays dark past dayLen until a token pushes it back
  const dusk = Math.max(
    st.over ? 0.6 : 0,
    Math.min(0.68, ((st.t - (st.dayLen - 18)) / 18) * 0.68)
  );
  if (dusk > 0) {
    ctx.globalAlpha = dusk;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // time tokens — ringed dots bobbing on the snow, +1s each. Drawn over
  // the night dim so they read as beacons in the dark.
  ctx.strokeStyle = C.accent2;
  ctx.fillStyle = C.accent2;
  ctx.lineWidth = 1.4;
  for (let n = Math.floor(camX); n < camX + VIEW_W + 4; n++) {
    const h = placeHash(n, st.seed);
    if (h % sunGap(n) !== 0 || st.collected.has(n)) continue;
    const gy = ty(tokenY(n, h, st.ph)) + Math.sin(st.t * 3 + n) * 1.5;
    drawToken(ctx, (n - camX) * sx, gy);
  }

  // HUD — monospace text, same voice as the rest of the IDE
  ctx.textAlign = "left";
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = C.dim;
  const left = Math.ceil(st.dayLen - st.t);
  const hud = `${st.vx.toFixed(0)} m/s   ${Math.floor(st.x - st.start)} m   ${left > 0 ? `${left}s` : "night"}`;
  ctx.fillText(hud, 12, 22);
  if (st.combo > 1) {
    ctx.fillStyle = st.combo >= 3 ? C.accent : C.dim;
    ctx.fillText(
      `   ${st.combo >= 3 ? "fever" : "slide"} x${st.combo}`,
      12 + ctx.measureText(hud).width,
      22
    );
    ctx.fillStyle = C.dim;
  }
  ctx.textAlign = "right";
  ctx.fillStyle = st.held ? C.accent : C.dim;
  ctx.fillText(
    TOUCH
      ? `${st.held ? "dropping" : "hold — drop"}`
      : `${st.held ? "dropping" : "hold space — drop"}`,
    W - 12,
    22
  );
  ctx.textAlign = "left";

  // control hint — up during the lift ride, lingers into the first
  // stretch of the run
  if (st.intro > 0 || st.t < 1.2) {
    ctx.textAlign = "center";
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillStyle = C.ink;
    ctx.fillText(
      TOUCH ? "press + hold — drop" : "hold space — drop",
      W / 2,
      H * 0.42
    );
    ctx.textAlign = "left";
  }

  // run over — show the distance and the restart hint
  if (st.over) {
    ctx.textAlign = "center";
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = C.accent2;
    ctx.fillText(st.death, W / 2, H * 0.4);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = C.ink;
    ctx.fillText(`${Math.floor(st.x - st.start)} m   best ${best} m`, W / 2, H * 0.4 + 22);
    if (st.naming) {
      ctx.fillStyle = C.accent;
      ctx.fillText(
        `name: ${st.nameBuf}${Math.floor(Date.now() / 500) % 2 ? "_" : ""}`,
        W / 2,
        H * 0.4 + 64
      );
      ctx.fillStyle = C.dim;
      ctx.fillText("enter — save", W / 2, H * 0.4 + 82);
    } else {
      const who = riderName();
      ctx.fillText(
        who ? `riding as ${who}` : "name your runs → leaderboard.txt",
        W / 2,
        H * 0.4 + 64
      );
      ctx.fillText("scores → snowboard/leaderboard.txt", W / 2, H * 0.4 + 82);
    }
    ctx.textAlign = "left";
  }
}

const commitName = (st) => {
  st.naming = false;
  saveName(cleanName(st.nameBuf));
  st.nameBuf = "";
};

export default function Snowboard() {
  const sim = useRef(null);
  if (!sim.current) sim.current = fresh();
  const best = useRef(loadBest());
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  // Touch can't type on a canvas — the name prompt is a real input.
  const [touchNaming, setTouchNaming] = useState(false);
  const [touchBuf, setTouchBuf] = useState("");
  const [over, setOver] = useState(false);
  const [shareMsg, setShareMsg] = useState("share");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const v = (n) => cs.getPropertyValue(n).trim();
      return {
        ink: v("--ink"),
        dim: v("--ink-dim"),
        noise: v("--noise"),
        accent: v("--accent"),
        accent2: v("--accent-2"),
        raise: v("--bg-raise"),
        bg: v("--bg"),
      };
    };
    let colors = read();
    const mo = new MutationObserver(() => (colors = read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const size = () => {
      const r = wrapRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(wrapRef.current);

    let raf;
    let last = performance.now();
    const tick = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!sim.current.over) step(sim.current, dt);
      if (sim.current.over && !sim.current.recorded) {
        sim.current.recorded = true;
        setOver(true);
        const d = Math.floor(sim.current.x - sim.current.start);
        if (d > best.current) {
          best.current = d;
          saveBest(d);
        }
        // leaderboard — one row per player, best run wins
        postScore({
          d,
          why: sim.current.death,
          name: riderName() || null,
          at: Date.now(),
        });
        // name prompt — only while there's no rider name saved. Once
        // given, it sticks in localStorage until storage is cleared;
        // later runs never ask again.
        if (!riderName()) {
          if (!TOUCH) {
            sim.current.naming = true;
            sim.current.nameBuf = "";
          } else {
            setTouchNaming(true);
            setTouchBuf("");
          }
        }
      }
      const r = wrapRef.current.getBoundingClientRect();
      draw(ctx, sim.current, colors, r.width, r.height, best.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  useEffect(() => {
    const editable = (t) =>
      t instanceof Element && t.closest("input, textarea, [contenteditable]");
    const down = (e) => {
      if (editable(e.target)) return;
      const st = sim.current;
      if (st.naming) {
        if (e.code === "Enter") commitName(st);
        else if (e.code === "Escape") {
          st.naming = false;
          st.nameBuf = "";
        } else if (e.code === "Backspace") st.nameBuf = st.nameBuf.slice(0, -1);
        else if (
          e.key.length === 1 &&
          e.code !== "Space" &&
          st.nameBuf.length < 12 &&
          /^[a-z0-9 .'_-]$/i.test(e.key)
        ) {
          st.nameBuf += e.key;
        }
        e.preventDefault();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!st.over) st.held = true;
      }
    };
    const up = (e) => {
      if (e.code === "Space") sim.current.held = false;
    };
    const blur = () => (sim.current.held = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const commitTouch = () => {
    saveName(cleanName(touchBuf));
    setTouchBuf("");
    setTouchNaming(false);
  };

  const restart = () => {
    setTouchNaming(false);
    setShareMsg("share");
    Object.assign(sim.current, fresh());
    setOver(false);
  };

  // native share sheet where it exists (iMessage etc.), clipboard
  // otherwise — the brag card itself is built in scores.js
  const share = async () => {
    const done = await shareScore(
      riderName() || "rider",
      Math.floor(sim.current.x - sim.current.start)
    );
    if (done) {
      setShareMsg(done);
      setTimeout(() => setShareMsg("share"), 1500);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="game"
      onPointerDown={(e) => {
        // a run's ending is inert — only the restart button rides again
        if (sim.current.over) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        sim.current.held = true;
      }}
      onPointerUp={() => (sim.current.held = false)}
      onPointerCancel={() => (sim.current.held = false)}
    >
      <canvas ref={canvasRef} className="game__canvas" aria-label="ascii snowboard game" />
      {touchNaming && (
        <div className="game__name" onPointerDown={(e) => e.stopPropagation()}>
          <input
            className="game__input"
            value={touchBuf}
            onChange={(e) => setTouchBuf(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitTouch()}
            placeholder="name your run"
            maxLength={10}
            enterKeyHint="done"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoFocus
          />
          <button className="game__save" onClick={commitTouch}>
            save
          </button>
        </div>
      )}
      {over && (
        <>
          <button
            className="game__share"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={share}
          >
            {shareMsg}
          </button>
          <button
            className="game__restart"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={restart}
          >
            restart
          </button>
        </>
      )}
    </div>
  );
}
