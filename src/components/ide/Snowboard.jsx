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
import { trackEvent } from "../../lib/metrics.js";
import { SITE } from "../../content/site.js";

// ASCII-flavored snowboard on canvas. Hold SPACE — or press the snow —
// to drop into the downhill and build speed; release to float off the
// crest. Restart is the on-screen button only — a stray tap or a held
// space can't eat a run. The scene is drawn as vectors so it reads as a
// game; the sky specks, pines and HUD stay literal Mononoki text, and
// a dot-matrix overlay keeps the terminal texture. Land on a downslope
// transition for a "perfect slide" — flat landings bounce, upslope
// landings kill your speed, and a bad-angle landing wipes you out.
// Endless — a run ends on a slam, a stall, or a night landing. The
// sun sets as you ride: 15 seconds of daylight banked and never
// more — the buffer is the mistake budget. Ringed-dot tokens buy
// +1s; clean downslope slides pay a small bonus plus a slice of
// the flight it took to land. Perfect play refills toward 15s but
// can't hoard, rough landings and missed tokens bleed it, and at
// zero the next touchdown ends it — the last flight glides out.
// Tokens hang on jump arcs: daylight is earned by launching high
// at speed. Hold a dive in the air and it winds up a spin — one
// flip a flight, +3s and a speed kick for it, planing on lighter
// gravity. Touching snow barely into the turn slaps you back up
// still spinning — hold to spin back level and save it — but a
// catch deeper into the rotation digs the deck in for a slam.
// Hills steepen with distance.

const LEAD = 13; // rider's distance from the left edge, world units
const VIEW_W = 52; // world units visible across the canvas
const VIEW_H = 26; // world units of vertical range

// hills steepen with distance — a run has its own difficulty curve.
// ter is the run's terrain roll from fresh(): the first DIVERGE
// meters ride the shared foothills, then each octave's amplitude,
// frequency and phase blend toward the run's own params over FADE —
// every start stays learnable, no two mountains match
const DIVERGE = 300; // meters of shared terrain before runs split
const FADE = 600; // meters until the run's own params are fully in
const TER_BASE = {
  amp: [5.2, 3.0, 1.5],
  frq: [0.072, 0.027, 0.13],
  ph: [0, 1.7, 4.2],
  steep: 0.001, // distance-steepening rate
};
// each octave drifts inside a band, then amplitudes rescale to a
// slope budget — Σ amp·freq pinned near the original 0.65, so no
// seed draws flat plains or sheer walls and the landing bands keep
// the same difficulty envelope run to run
const rollTer = (seed) => {
  const r = (k) => hash(seed + k * 101) / 4294967296;
  const ter = {
    amp: [4.2 + r(1) * 2.4, 2.0 + r(2) * 2.0, 0.9 + r(3) * 1.7],
    frq: [0.05 + r(4) * 0.045, 0.018 + r(5) * 0.022, 0.08 + r(6) * 0.1],
    ph: TER_BASE.ph.map((p, i) => p + r(7 + i) * Math.PI * 2),
    steep: 0.0012 + r(10) * 0.001,
  };
  const k = ter.amp.reduce((s, a, i) => s + a * ter.frq[i], 0);
  const m = k > 0.8 ? 0.8 / k : k < 0.5 ? 0.5 / k : 1;
  if (m !== 1) ter.amp = ter.amp.map((a) => a * m);
  return ter;
};
const hill = (x, ter) => {
  const b = Math.min(1, Math.max(0, (x - DIVERGE) / FADE));
  const mix = (r, base) => base + (r - base) * b;
  let y = 0;
  for (let i = 0; i < 3; i++)
    y +=
      mix(ter.amp[i], TER_BASE.amp[i]) *
      Math.sin(
        x * mix(ter.frq[i], TER_BASE.frq[i]) + mix(ter.ph[i], TER_BASE.ph[i])
      );
  return (1 + Math.min(1, Math.max(0, x)) * mix(ter.steep, TER_BASE.steep)) * y;
};
const slope = (x, ter) => (hill(x + 0.4, ter) - hill(x - 0.4, ter)) / 0.8;
// the run starts just past the first crest — the lift drops you on
// the roll, not the flat top, so the run opens already descending
const startFor = (ter) => {
  let crest = 0;
  for (let x = 0.5; x < 200; x += 0.25)
    if (slope(x - 0.5, ter) > 0 && slope(x + 0.5, ter) <= 0) {
      crest = x;
      break;
    }
  for (let x = crest; x < crest + 30; x += 0.25)
    if (slope(x, ter) < -0.2) return x;
  return crest;
};

const G_FLOAT = 16; // released — floaty, hangs in the air
const G_GLIDE = 6; // spinning — the tuck planes and falls slowest
const G_DIVE = 70; // held — drops hard
const PUSH = 50; // slope → speed coupling on the snow
const PITCH_MAX = 1.15; // rad — the board's steepest pitch; diving past it throws the flip
const FLIP_ALT = 7; // units of clear snow under the board before a throw is allowed
const SPIN_RAMP = 8; // wound up — spin rate climbs fast
const SPIN_MAX = 26; // rad/s — a full turn about every quarter second
const SPIN_OUT = 36; // released — the spin glides back to zero
const SPIN_GLIDE = 4; // rad/s — this much spin planes on lighter gravity
const FLIP_OK = 0.9; // rad off-level — past this a touch is a rotated slap
const SLAM_SPIN = 1.4; // rad into the turn — a deeper catch digs the deck in
const SLAM_HIT = 32; // m/s driven into an upslope face — harder face-plants
const SLIDE_AIR = 0.7; // seconds aloft before a downslope landing counts
// rider extremities in world units — while spinning the head swings
// below the board; the head touching snow is a slam, a board tip or
// an arm is still a landing
const HEAD_R = 1.4; // head tip above the board
const TIP_R = 0.9; // board tip reach
const V_MIN = 18; // glide floor — unheld rides never drop under this
const V_MAX = 55;
const RUN_LEN = 15; // seconds before the first nightfall
const INTRO = 0.55; // lift ride before the run starts

const fresh = () => {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  const ter = rollTer(seed);
  const start = startFor(ter);
  return {
    seed,
    ter,
    start,
    x: start,
    y: hill(start, ter),
    vy: 0,
    vx: 20,
    cam: hill(start, ter),
    ground: true,
    held: false,
    combo: 0, // consecutive perfect slides
    air: 0, // st.t at launch — hangtime refunds land on a clean slide
    holdAir: 0, // seconds held airborne — the flip wants a real grab
    spin: 0, // board rotation this flight, rad — forward is a front flip
    spinV: 0, // rad/s — ramps while held, glides out on release
    flips: 0, // full turns banked this flight — each pays +2s
    stoked: 0, // hands-up celebration left after a banked turn, sec
    hitstop: 0, // brief freeze on a banked turn — the punch
    boost: 0, // seconds of flip-landing speed burst left
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
  // imul keeps the low 32 exact — plain * overflows 2^53 — and >>>
  // is required: a signed >> 13 sign-extends and the XOR clears the
  // top bit, halving the range (phases never passed PI)
  n = Math.imul(n, 2654435761) >>> 0;
  return (n ^ (n >>> 13)) >>> 0;
};

// placement (tokens, pines, specks) re-keys on the run seed from the
// first meter — the foothills stay shared, the dressing never is
const placeHash = (n, seed) => hash(n ^ seed);

// sun tokens thin out with distance until a plateau — from ~1km on
// the spacing holds, so a run that keeps speed and keeps grabbing
// tokens stays ahead of the sun. Miss a stretch and you ride in the
// dark. The pacing rolls with the seed inside bands that keep
// daylight income fair.
const sunGap = (n, seed) => {
  const h = hash(seed ^ 0x5eed);
  const base = 20 + (h % 9); // first gaps: every 20–28 candidacies
  const per = 48 + ((h >>> 4) % 17); // thins one step every 48–64 m
  const cap = 33 + ((h >>> 9) % 8); // plateau: every 33–40
  return Math.min(cap, Math.round((base + Math.floor(Math.max(0, n) / per)) / 1.25));
};
// a token at world x — candidacy is hashed per meter, and a
// candidate survives only with clear air behind it. The lookback
// runs on candidates, not survivors, so clumps collapse to their
// first member instead of flapping.
const TOKEN_MIN = 9; // meters of clear snow before a token may spawn
const isToken = (n, seed) => {
  if (placeHash(n, seed) % sunGap(n, seed) !== 0) return false;
  for (let k = n - TOKEN_MIN; k < n; k++)
    if (placeHash(k, seed) % sunGap(k, seed) === 0) return false;
  return true;
};
// token height at world x, or null where none belongs. Terrain
// decides the hang: flat and downhill ground caps a token at
// helmet level — pickable on the ride-through — while rising
// ground is a launch, and there the token may sit on the jump arc,
// capped at hop height. A rare few stay at boot level as a
// breadcrumb for runs still building speed.
const tokenY = (n, h, ter) => {
  if ((h >>> 7) % 10 === 0) return hill(n, ter) + 0.7 + ((h >>> 4) % 3) * 0.5;
  // knee-to-head jitter — some skim the boot, some need a hop
  const band = hill(n, ter) + 0.6 + ((h >>> 5) % 21) / 10;
  if (slope(n, ter) <= 0.2) return band;
  let y = -Infinity;
  for (let x0 = n - 16; x0 < n - 3; x0++) {
    const v = 55;
    const vy0 = Math.min(Math.max(0, slope(x0 - 0.6, ter)) * v * 1.25, 28);
    const t = (n - x0) / v;
    y = Math.max(y, hill(x0, ter) + vy0 * t - 0.5 * G_FLOAT * t * t);
  }
  return y > band + 0.6 ? Math.min(y, hill(n, ter) + 5) : band;
};

function step(st, dt) {
  if (st.intro > 0) {
    st.intro -= dt;
    return;
  }
  // a banked turn stops the world for a beat so the +2s lands
  if (st.hitstop > 0) {
    st.hitstop -= dt;
    return;
  }
  st.t += dt;
  st.x += st.vx * dt;
  // a live +2s keeps floating up the rider — lesser pops can't clobber it
  const say = (fx) => {
    if (st.fx?.kind !== "flip") st.fx = fx;
  };
  const s = slope(st.x, st.ter);
  const g =
    st.spinV > SPIN_GLIDE
      ? G_GLIDE
      : st.held && st.spin === 0
        ? G_DIVE
        : G_FLOAT;
  if (st.ground) {
    const y2 = hill(st.x, st.ter);
    // launch when the ballistic arc stays above the new ground —
    // i.e. the hill curved away under the board
    if (st.y + st.vy * dt - 0.5 * g * dt * dt > y2) {
      st.ground = false;
      st.air = st.t; // hangtime clock starts at launch
      st.holdAir = 0;
      st.spin = 0;
      st.spinV = 0;
      st.flips = 0; // spin state starts fresh each flight
      st.stoked = 0;
      // lip kick — a sharp crest throws extra height, like a real kicker
      st.vy = Math.min(st.vy * 1.25, 28);
      st.vy -= g * dt;
      st.y += st.vy * dt;
    } else {
      st.y = y2;
      st.vy = s * st.vx;
      // held doubles the pump — the committed tuck — while the
      // release only gets the loose pump. On snow there's no carve:
      // holding is the fast verb, the cost lives in the air
      if (s < 0) st.vx += -s * PUSH * (st.held ? 2 : 1) * dt;
      // climbs bleed at half the rate descents pay — speed carries
      // up the faces instead of dying on them
      else st.vx += -s * PUSH * 0.5 * dt;
      // the glide pull only rescues a released ride — held and already
      // slow, no assist is left: a climb stalls the run outright
      // instead of pinning it mid-slope
      if (!st.held || st.vx > V_MIN) st.vx += (18 - st.vx) * 0.5 * dt;
    }
  } else {
    st.vy -= g * dt;
    // rotation catches air — the tuck bleeds fall speed toward a
    // float, so a steep committed dive has room to come around
    if (st.spinV > SPIN_GLIDE) st.vy += (-4 - st.vy) * Math.min(1, 10 * dt);
    st.y += st.vy * dt;
    // hold to dive — a tap never throws. The flip wants the button
    // held a beat, the dive committed (pitched past the board's max
    // or falling fast), AND enough snow under the board to finish
    // the rotation. Only a real launch gets all three; the snap
    // back to level keeps the landing survivable.
    if (st.held) st.holdAir += dt;
    else st.holdAir = 0;
    const committed =
      -Math.atan2(st.vy, st.vx) > PITCH_MAX || st.vy < -24;
    const canSpin =
      (st.holdAir >= 0.3 &&
        committed &&
        st.y - hill(st.x, st.ter) > FLIP_ALT) ||
      st.spin > 0;
    if (st.held && canSpin) {
      // the throw — a held key past the gate kicks the spin up
      // instead of winding slowly from zero
      if (st.spinV < SPIN_MAX * 0.6) st.spinV = SPIN_MAX * 0.6;
      st.spinV += (SPIN_MAX - st.spinV) * Math.min(1, SPIN_RAMP * dt);
    } else {
      st.spinV += (0 - st.spinV) * Math.min(1, SPIN_OUT * dt);
      // release swings the board to the nearest level — bail before
      // halfway and the turn unwinds flat; commit past it and the
      // roll carries through to the payout
      const level = st.spin < Math.PI ? 0 : Math.PI * 2;
      const rest = level - st.spin;
      st.spin += Math.abs(rest) < 0.2 ? rest : rest * Math.min(1, SPIN_OUT * 0.6 * dt);
    }
    st.spin += st.spinV * dt;
    if (st.spin >= Math.PI * 2) {
      st.flips += 1; // count them — enough air chains into the next
      st.spin = 0;
      st.spinV = 0;
      // nth flip pays n+1 seconds — chains snowball the reward
      st.dayLen = Math.min(st.dayLen + st.flips + 1, st.t + RUN_LEN);
      st.stoked = 0.8; // hands up — the flip paid out
      st.hitstop = 0.12; // freeze a beat so the payout lands
      st.fx = {
        x: st.x,
        y: st.y,
        t: 0,
        text: `+${st.flips + 1}s`,
        kind: "flip",
        stick: true,
      };
    }
    const y2 = hill(st.x, st.ter);
    // body angle off the slope — spinning swings the head below the
    // board. Lethal touchdowns: head-first, or the deck catching
    // deep into the rotation. A shallow rotated touch just slaps
    // you back up still turning — hold space to spin level and save it.
    const tilt =
      st.spin +
      Math.max(-PITCH_MAX, Math.min(PITCH_MAX, -Math.atan2(st.vy, st.vx))) +
      Math.atan(s);
    const headLow = -HEAD_R * Math.cos(tilt); // head-tip reach below the board
    const boardTip =
      TIP_R * Math.abs(Math.sin(tilt)) + 0.1 * Math.cos(tilt);
    const limbHit = headLow > boardTip && st.y - headLow <= y2;
    if (limbHit || st.y <= y2) {
      st.spinV *= 0.5; // contact eats half the rate, not the turn
      const s2 = slope(st.x, st.ter);
      // board angle off the slope — a rotated touch is a slap, the
      // rest is the usual landing math
      const off = tilt - Math.round(tilt / (Math.PI * 2)) * Math.PI * 2;
      // rotation depth at contact — how far through the flip the deck
      // caught snow. Inside the save window a rotated touch still
      // slaps; deeper than that it catches like an edge and slams
      const soff = st.spin < Math.PI ? st.spin : Math.PI * 2 - st.spin;
      if (limbHit || soff > SLAM_SPIN) {
        // head-first or a deep edge catch — the two lethal impacts.
        // Anything shallower is survivable: slap, bounce, or ride.
        st.ground = true;
        st.crashed = true;
        st.death = limbHit ? "head-first slam" : "caught an edge";
        st.over = true;
        st.y = y2;
        say({ x: st.x, y: st.y, t: 0, text: "slam!", kind: "bad" });
      } else if (Math.abs(off) > FLIP_OK) {
        // rotated contact — popped back up still turning; a held key
        // can spin back level before the next touch. Each slap bleeds
        // speed, and running out of it mid-rotation stalls the run
        st.combo = 0;
        st.y = Math.max(st.y, y2 + 0.2); // eject above the surface
        st.vy = 7;
        st.vx *= 0.9;
        if (st.vx < 4) {
          st.ground = true;
          st.crashed = true;
          st.death = "stalled out";
          st.over = true;
          st.y = y2;
        }
        say({ x: st.x, y: st.y, t: 0, text: "sketchy", kind: "bad" });
      } else if (s2 < -0.28) {
        st.ground = true;
        st.y = y2;
        st.vy = s2 * st.vx;
        st.combo += 1;
        st.vx += -s2 * 9 + Math.min(6, 2 + st.combo);
        // daylight income only lands after a real flight — hops still
        // kick and combo, but riding the terrain's own little bumps
        // never buys time, so coasting a run out doesn't pay
        if (st.t - st.air > SLIDE_AIR) {
          // a small slide bonus (doubled in fever) plus a slice of
          // the flight it took to arrive. The bank caps at the
          // starting 15s — income is only worth what mistakes spent.
          st.dayLen = Math.min(
            st.dayLen + (st.combo >= 3 ? 0.2 : 0.1) + (st.t - st.air) * 0.1,
            st.t + RUN_LEN
          );
        }
        say({
          x: st.x,
          y: st.y,
          t: 0,
          text: st.combo > 1 ? `perfect x${st.combo}` : "perfect!",
          kind: "good",
        });
      } else if (s2 > 0.28) {
        // upslope — a soft touch still rides the rise out, just
        // scrubbed; carrying real speed into the face is a slam, not
        // a climb. Impact is the speed driven into the wall: the
        // horizontal plow plus whatever fall you brought down on it
        st.ground = true;
        st.y = y2;
        st.combo = 0;
        if (st.vx * s2 - st.vy > SLAM_HIT) {
          st.crashed = true;
          st.death = "wiped out";
          st.over = true;
          say({ x: st.x, y: st.y, t: 0, text: "slam!", kind: "bad" });
        } else {
          st.vx += -s2 * 9;
          say({ x: st.x, y: st.y, t: 0, text: "rough", kind: "bad" });
        }
        st.vy = s2 * st.vx;
      } else if (st.vy < -7) {
        // flat landing with real impact — bounce instead of sliding
        st.combo = 0;
        st.vy = 5;
        st.vx *= 0.94;
        say({ x: st.x, y: st.y, t: 0, text: "bounce", kind: "bad" });
      } else {
        st.ground = true;
        st.y = y2;
        st.vy = s2 * st.vx;
        st.combo = 0;
      }
      // riding out banked flips starts a speed boost — longer the
      // more rotations you brought down with you
      if (st.ground && !st.crashed && st.flips > 0) {
        st.boost = 2 + st.flips;
        st.flips = 0;
      }
    }
  }
  // time tokens — strung along jump arcs and the snow; the rider's
  // body has to touch one. Each buys a second of daylight, capped
  // by the 15s buffer like everything else.
  const pn = Math.round(st.x);
  const h = placeHash(pn, st.seed);
  if (isToken(pn, st.seed) && !st.collected.has(pn)) {
    const py = tokenY(pn, h, st.ter);
    if (py != null && (st.x - pn) ** 2 + (st.y + 1.2 - py) ** 2 < 1.7) {
      st.collected.add(pn);
      st.dayLen = Math.min(st.dayLen + 1, st.t + RUN_LEN);
      say({ x: pn, y: py, t: 0, text: "+1s", kind: "time" });
    }
  }
  if (st.fx && (st.fx.t += dt) > 0.9) st.fx = null;
  if (st.stoked > 0) st.stoked -= dt; // hands come back down
  // flip-landing boost — a few seconds of free acceleration and a
  // higher ceiling while it burns
  if (st.boost > 0) {
    st.boost -= dt;
    st.vx += 25 * dt;
  }
  // fever — chained slides unlock a higher top speed
  const vmax =
    (st.combo >= 3 ? V_MAX + 8 : V_MAX) + (st.boost > 0 ? 15 : 0);
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
  // rider parks high on screen — the slope below stays in view on big air
  const anchorY = H * 0.45;
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
    if (h % (17 + (hash(st.seed ^ 0x5ec) % 13)) !== 0) continue;
    ctx.fillText(h % 2 ? "'" : ".", (n - camX * 0.5) * sx, 10 + ((h >>> 5) % Math.round(anchorY * 0.5)));
  }

  // main slope — filled snow body + bright surface line
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let p = 0; p <= W; p += 2) ctx.lineTo(p, ty(hill(camX + p / sx, st.ter)));
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = C.raise;
  ctx.fill();
  ctx.beginPath();
  for (let p = 0; p <= W; p += 2) {
    const y = ty(hill(camX + p / sx, st.ter));
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
    // density rolls with the seed — one run's glade is the next's forest
    if (placeHash(n, st.seed) % (40 + (hash(st.seed ^ 0x51e) % 25)) !== 0) continue;
    const tx = (n - camX) * sx;
    const gy = ty(hill(n, st.ter));
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
    const gy = ty(hill(n, st.ter));
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
    ? -Math.atan(slope(st.x, st.ter)) + 1.35 // ragdoll flat against the slope
    : st.ground
      ? -Math.atan(slope(st.x, st.ter))
      : Math.max(-1.15, Math.min(1.15, -Math.atan2(st.vy, st.vx))) +
        st.spin; // front flip — clockwise spin rides the flight path
  // spin ghosts — the deck leaves afterimages while the flip is fast
  if (!st.ground && !st.crashed && st.spinV > 3) {
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = C.accent;
    for (let k = 1; k <= 2; k++) {
      ctx.save();
      ctx.rotate(ang - st.spinV * 0.05 * k);
      ctx.globalAlpha = 0.22 / k;
      ctx.beginPath();
      ctx.roundRect(-17, -3.5, 34, 3.5, 1.75);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
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
  const ARM = 13; // shoulder→hand reach — same in every pose
  const arm = (sx, sy, hx, hy) => {
    const d = Math.hypot(hx - sx, hy - sy) || 1;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + ((hx - sx) * ARM) / d, sy + ((hy - sy) * ARM) / d);
  };
  // ball up whenever the rider isn't level — fast spin or a tumbled
  // recovery both read better tucked than sprawled
  const tucked =
    !st.ground &&
    !st.crashed &&
    (st.spinV > 2.5 ||
      Math.abs(
        st.spin - Math.round(st.spin / (Math.PI * 2)) * Math.PI * 2
      ) > FLIP_OK);
  // held without the spin — the speed crouch: hips and chest fold
  // down like a carve, both hands come to the deck
  const diving = st.held && !st.crashed && !tucked;
  const sh = tucked ? [4.5, -16.5] : diving ? [4, -14.5] : [3, -19];
  if (tucked) {
    // balled up for the spin — knees pulled to chest
    leg(5, -13.5, 4);
    leg(-4, -13, -4);
  } else {
    leg(4, -7, 6); // front leg, knee forward
    leg(-5, -6.5, -6); // back leg
  }
  ctx.beginPath(); // torso, leaning into the ride
  ctx.moveTo(-1, -11);
  ctx.lineTo(sh[0], sh[1]);
  ctx.stroke();
  ctx.beginPath(); // head
  const hc = tucked ? [6.5, -19.5] : diving ? [5.5, -18] : [4.5, -22.5];
  ctx.arc(hc[0], hc[1], 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath(); // arms
  if ((st.stoked > 0 || tucked) && !st.crashed) {
    // hands up — through the rotation and the ride-out
    arm(sh[0], sh[1], sh[0] + 6, sh[1] - 9);
    arm(sh[0], sh[1], sh[0] - 6, sh[1] - 8);
  } else if (diving) {
    // speed crouch — only the lead hand reaches for the deck, the
    // trailing arm swings back for balance
    ctx.moveTo(sh[0], sh[1]);
    ctx.lineTo(6.5, -8.5);
    ctx.lineTo(10, -3.4);
    arm(sh[0], sh[1], -7, -18);
  } else if (!st.ground || st.crashed) {
    // airborne or sprawled on the snow — arms out
    arm(3, -19, 11, -15);
    arm(3, -19, -9, -16);
  } else {
    // cruising — relaxed tuck, trailing arm
    arm(3, -19, 8, -14);
    arm(3, -19, -7, -13);
  }
  ctx.stroke();
  ctx.restore();
  }

  // floating landing feedback — rises and fades
  if (st.fx) {
    const a = 1 - st.fx.t / 0.9;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle =
      st.fx.kind === "good"
        ? C.accent
        : st.fx.kind === "time" || st.fx.kind === "flip"
          ? C.accent2
          : C.dim;
    ctx.font = `bold ${st.fx.kind === "flip" ? 17 : 13}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(
      st.fx.text,
      st.fx.stick ? px : (st.fx.x - camX) * sx,
      st.fx.stick ? py - 34 - st.fx.t * 24 : ty(st.fx.y) - 14 - st.fx.t * 26
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

  // time tokens — ringed dots bobbing on the snow, +1s each. Drawn
  // over the night dim so they read as beacons in the dark.
  ctx.strokeStyle = C.accent2;
  ctx.fillStyle = C.accent2;
  ctx.lineWidth = 1.4;
  for (let n = Math.floor(camX); n < camX + VIEW_W + 4; n++) {
    const h = placeHash(n, st.seed);
    if (!isToken(n, st.seed) || st.collected.has(n)) continue;
    const wy = tokenY(n, h, st.ter);
    if (wy == null) continue;
    const gy = ty(wy) + Math.sin(st.t * 3 + n) * 1.5;
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
    }
    ctx.textAlign = "left";
  }
}

const commitName = (st) => {
  st.naming = false;
  saveName(cleanName(st.nameBuf));
  st.nameBuf = "";
};

export default function Snowboard({ onOpenFile }) {
  const sim = useRef(null);
  if (!sim.current) sim.current = fresh();
  // dev-only: scripts/record-game.mjs reads the live sim to play a take
  if (import.meta.env.DEV) window.__st = sim.current;
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
        // one finished run = one game played — counted when the over
        // screen shows, so 0m slams and never-posted runs count too.
        // why feeds the death-mix counter in api/metrics.js
        trackEvent("run", { why: sim.current.death });
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
      onContextMenu={(e) => e.preventDefault()}
      onSelectStart={(e) => e.preventDefault()}
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
        <div className="game__actions">
          <button
            className="game__share"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={share}
          >
            {shareMsg}
          </button>
          <a
            className="game__board"
            href={`/${encodeURI(SITE.urls[SITE.boardFile] ?? SITE.boardFile)}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              onOpenFile?.(SITE.boardFile);
            }}
          >
            leaderboard
          </a>
          <button
            className="game__restart"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={restart}
          >
            restart
          </button>
        </div>
      )}
    </div>
  );
}
