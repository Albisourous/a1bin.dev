// Score store — snowboard runs live in localStorage today.
//
// TODO(online): swap this module for a shared backend so the board is
// global across visitors (a tiny Worker/Supabase table is enough).
// Contract to keep when the remote lands:
//   row: { d, why, name, at }   meters, end cause, rider, epoch ms
//   loadScores() → top 5, desc by d        → GET /scores
//   postScore(row) → merge, persist, emit  → POST /scores
//   riderName()/saveName() → rider identity
//   loadBest()/saveBest()  → personal best
// The fns go async then; call sites just await and re-render on the
// "snowboard:scores" event they already listen to. Keep localStorage
// as the offline cache either way. Honor system is fine for a
// personal site — no signed runs.
const SCORES_KEY = "snowboard.scores";
const NAME_KEY = "snowboard.name";
const BEST_KEY = "snowboard.best";
const TOP = 5;

export const loadScores = () => {
  try {
    return JSON.parse(localStorage.getItem(SCORES_KEY)) || [];
  } catch {
    return [];
  }
};

export const loadBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

export const saveBest = (d) => {
  try {
    localStorage.setItem(BEST_KEY, String(d));
  } catch {}
};

export const riderName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
};

// Name gate — letters, digits and a few marks, 12 chars max, and a
// short list of words that don't get on the board. Returns null when
// the name fails; React escapes the text either way, this only keeps
// the board clean. When the board goes online, re-check on the server
// — client-side gates are advisory, not enforcement.
const BAD = /(fuck|shit|cunt|nigg|fag|whore|slut|dick|pussy|cock|bitch|ass|rape|nazi|hitler|kkk|porn|anal)/;
export const cleanName = (v) => {
  const n = v.trim().replace(/\s+/g, " ").slice(0, 12);
  if (!n) return null;
  if (!/^[a-z0-9 .'_-]+$/i.test(n)) return null;
  if (BAD.test(n.toLowerCase().replace(/[^a-z]/g, ""))) return null;
  return n;
};

// name the run — the rider key plus a name stamped onto board rows
// that don't have one yet
export const saveName = (n) => {
  if (!n) return;
  try {
    localStorage.setItem(NAME_KEY, n);
    const scores = loadScores().map((r) => (r.name ? r : { ...r, name: n }));
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  } catch {}
  window.dispatchEvent(new Event("snowboard:scores"));
};

// a finished run — top N kept; `at` (epoch ms) rides along for the
// future global board
export const postScore = (row) => {
  const scores = loadScores();
  scores.push(row);
  scores.sort((a, b) => b.d - a.d);
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores.slice(0, TOP)));
  } catch {}
  window.dispatchEvent(new Event("snowboard:scores"));
};

export const resetBoard = () => {
  try {
    localStorage.removeItem(SCORES_KEY);
    localStorage.removeItem(BEST_KEY);
  } catch {}
  window.dispatchEvent(new Event("snowboard:scores"));
};
