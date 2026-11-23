// Score store — snowboard runs live in a global board backed by
// /api/scores (Upstash Redis); localStorage is the offline cache.
// Contract:
//   row: { d, why, name, at }   meters, end cause, rider, epoch ms
//   loadScores() → all rows, desc by d, from the cache     → GET /api/scores
//   refreshScores() → pull remote board into cache, emit
//   postScore(row) → merge per rider, emit                 → POST /api/scores
//   riderName()/saveName() → rider identity
//   loadBest()/saveBest()  → personal best
// Every remote call is fire-and-forget and wrapped so a network
// failure never breaks the game. Components re-render on the
// "snowboard:scores" event. Honor system — no signed runs.
const SCORES_KEY = "snowboard.scores";
const NAME_KEY = "snowboard.name";
const BEST_KEY = "snowboard.best";
const API = "/api/scores";

export const loadScores = () => {
  try {
    return JSON.parse(localStorage.getItem(SCORES_KEY)) || [];
  } catch {
    return [];
  }
};

const cacheBoard = (rows) => {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(rows));
  } catch {}
};

const emit = () => window.dispatchEvent(new Event("snowboard:scores"));

// pull the global board into the cache — silent on failure (offline,
// `npm run dev` without the api functions, bad env vars)
export const refreshScores = async () => {
  try {
    const res = await fetch(API);
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    cacheBoard(rows);
    emit();
  } catch {}
};

// push one row, then mirror the server's merged board back into the
// cache. Never awaited by the game.
const send = async (row) => {
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(row),
    });
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    cacheBoard(rows);
    emit();
  } catch {}
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
// the board clean. The same rules are re-checked in api/scores.js —
// client-side gates are advisory, not enforcement.
const BAD = /(fuck|shit|cunt|nigg|fag|whore|slut|dick|pussy|cock|bitch|ass|rape|nazi|hitler|kkk|porn|anal)/;
export const cleanName = (v) => {
  const n = v.trim().replace(/\s+/g, " ").slice(0, 12);
  if (!n) return null;
  if (!/^[a-z0-9 .'_-]+$/i.test(n)) return null;
  if (BAD.test(n.toLowerCase().replace(/[^a-z]/g, ""))) return null;
  return n;
};

// one row per rider — each person's best run only. Anonymous runs
// share one row until they get a name.
const perRider = (scores) => {
  const best = new Map();
  for (const r of scores) {
    const k = r.name ?? "";
    if (!best.has(k) || r.d > best.get(k).d) best.set(k, r);
  }
  return [...best.values()].sort((a, b) => b.d - a.d);
};

// name the run — the rider key plus a name stamped onto board rows
// that don't have one yet. Then re-post the rider's best row under
// the name so the server can merge it into the global board.
export const saveName = (n) => {
  if (!n) return;
  try {
    localStorage.setItem(NAME_KEY, n);
    const scores = loadScores().map((r) => (r.name ? r : { ...r, name: n }));
    // a stamped row can collide with a real one — collapse to one
    cacheBoard(perRider(scores));
  } catch {}
  emit();
  const mine = loadScores().find((r) => r.name === n);
  if (mine) send(mine);
};

// a finished run — the rider's row updates only when this run beats
// their best. Local write first (offline cache), remote second.
export const postScore = (row) => {
  cacheBoard(perRider([...loadScores(), row]));
  emit();
  send(row);
};

// wordle-style brag card — your row plus the riders directly above and
// below you, pinned to the edges when you're first or last. Bars scale
// to the top shown score. runD is the just-finished distance, slotted
// in when the player somehow has no board row yet.
export const shareText = (me, runD) => {
  let board = loadScores();
  let mine = board.findIndex((r) => (r.name ?? "rider") === me);
  if (mine < 0 && runD != null) {
    const row = { d: runD, name: me };
    board = [...board, row].sort((a, b) => b.d - a.d);
    mine = board.indexOf(row);
  }
  const start = Math.max(
    0,
    Math.min(mine < 0 ? 0 : mine - 1, board.length - 3)
  );
  const rows = board.slice(start, start + 3);
  if (!rows.length) return `snowboard\n\nbeat me → a1bin.dev/snowboard/game`;
  const rankW = Math.max(...rows.map((_, i) => String(start + i + 1).length)) + 2;
  const nameW = Math.max(...rows.map((r) => (r.name ?? "rider").length));
  const maxD = rows[0].d;
  const lines = rows.map((r, i) => {
    const bar = "█".repeat(Math.max(1, Math.floor((r.d / maxD) * 15)));
    const tag = i === mine - start ? " ← me" : "";
    return `${`[${start + i + 1}]`.padEnd(rankW)} ${(r.name ?? "rider").padEnd(nameW)} ${bar} ${r.d}m${tag}`;
  });
  return `snowboard\n${lines.join("\n")}\n\nbeat me → a1bin.dev/snowboard/game`;
};

// native share sheet where the platform has one (iOS/macOS → iMessage
// and friends), clipboard copy elsewhere. Resolves "shared" | "copied"
// | null (sheet dismissed or copy failed).
export const shareScore = async (me, runD) => {
  const text = shareText(me, runD);
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch {
      return null;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return null;
  }
};

refreshScores();
