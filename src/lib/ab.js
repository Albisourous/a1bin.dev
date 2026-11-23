// Variant assignment — deterministic per browser. One random uid lives
// in localStorage ("ab.uid"); hash(id + uid) % variants picks the arm.
// No network, no deps — metrics can read the same key when they land.
const UID_KEY = "ab.uid";

import { analyticsOff, post } from "./metrics.js";

const uid = () => {
  try {
    let u = localStorage.getItem(UID_KEY);
    if (!u) {
      u = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
      localStorage.setItem(UID_KEY, u);
    }
    return u;
  } catch {
    return ""; // storage denied — assignment stays deterministic per id
  }
};

// fnv-1a, 32-bit — tiny stable string hash
const hash = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

// The variant this browser sees for a live experiment — else null.
export const variantFor = (exp) => {
  if (exp?.status !== "live" || !exp.variants?.length) return null;
  return exp.variants[hash(`${exp.id}:${uid()}`) % exp.variants.length];
};

// Report the draw — one "assign" POST per experiment per browser,
// guarded by an id set in localStorage. Silent on any failure (plain
// `npm run dev` has no api). Storage denied → no report at all, so the
// counts only ever come from browsers that actually persist a variant.
const SEEN_KEY = "ab.seen";

export const reportAssignment = (exp) => {
  const arm = variantFor(exp);
  if (!arm || analyticsOff()) return;
  try {
    const seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) || []);
    if (seen.has(exp.id)) return;
    seen.add(exp.id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    return;
  }
  post({ event: "assign", exp: exp.id, arm: arm.key });
};

// fire on import — the component chain loads this at boot, so every
// visitor reports their draws without opening the tab
import { EXPERIMENTS } from "../content/experiments.js";
EXPERIMENTS.forEach(reportAssignment);
