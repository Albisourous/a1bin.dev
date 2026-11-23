// Site metrics — Vercel serverless + Upstash Redis. Same store as the
// leaderboard; counters only, honor system.
//
// GET  /api/metrics            → {ok, totals, days} (shape below)
// POST /api/metrics {event,id} → bump a counter. Client events:
//                                "visit" (id = browser uuid, PFADDed to
//                                the uniques HLL), "term" (a terminal
//                                command), "resume" (Resume.pdf opened),
//                                "run" (a snowboard run reaching the
//                                over screen). Chats are still counted
//                                inside api/chat.js — the only event a
//                                server endpoint sees for free.
//
//   { ok: true,
//     totals: { visits, visitors, runs, players, chats },
//     days: [{ d: "YYYY-MM-DD", visits, runs, chats }, …last 30, oldest first],
//     experiments: { <id>: { <arm>: count, … } } — live a/b assignments }
//
// POST also accepts { event: "assign", exp, arm } — one browser's draw in
// a live experiment, validated against the registry in
// src/content/experiments.js and counted in hash `metrics:exp:<id>` —
// and { event: "session", arms: {<exp>: <arm>}, ms, int } — the exit
// beacon. Per arm it accumulates `<arm>:ms` (total engaged ms),
// `<arm>:int` (total interactions) and `<arm>:sess` (beacon count), so
// avg retention = ms/sess and the fallback read is int/sess.
//
// Storage: hash `metrics:totals` (visits/runs/chats fields), HyperLogLog
// `metrics:visitors` (unique visitor ids), per-day hash
// `metrics:day:YYYY-MM-DD` (~100-day TTL, refreshed on every write).
// `players` is a live HLEN of the leaderboard's `snowboard:riders`.
// Days are read by computing the last 30 date strings — bounded, so no
// index set is needed.
//
// Env: same as api/scores.js — UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN
// or KV_REST_API_URL/KV_REST_API_TOKEN. Missing env → 200 {ok:false} so
// the client falls through to its unconfigured state, never an error.
import { Redis } from "@upstash/redis";
import { EXPERIMENTS } from "../src/content/experiments.js";

const TOTALS = "metrics:totals";
const VISITORS = "metrics:visitors";
const RIDERS = "snowboard:riders";
const DAYS = 30;
const DAY_TTL = 100 * 86400;

const dayKey = (d) => `metrics:day:${d}`;
const expKey = (id) => `metrics:exp:${id}`;
const num = (h, k) => Number(h?.[k] ?? 0) || 0;

// last N UTC date strings, oldest first
const lastDays = () => {
  const now = Date.now();
  return Array.from({ length: DAYS }, (_, i) =>
    new Date(now - (DAYS - 1 - i) * 86400e3).toISOString().slice(0, 10)
  );
};

export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(200).json({ ok: false });
  const redis = new Redis({ url, token });

  try {
    if (req.method === "GET") {
      const names = lastDays();
      const p = redis.pipeline();
      p.hgetall(TOTALS);
      p.hlen(RIDERS);
      p.pfcount(VISITORS);
      for (const d of names) p.hgetall(dayKey(d));
      for (const e of EXPERIMENTS) p.hgetall(expKey(e.id));
      const [totals, players, visitors, ...rest] = await p.exec();
      const rows = rest.slice(0, names.length);
      const expRows = rest.slice(names.length);
      return res.status(200).json({
        ok: true,
        totals: {
          visits: num(totals, "visits"),
          visitors: visitors ?? 0,
          runs: num(totals, "runs"),
          players: players ?? 0,
          chats: num(totals, "chats"),
          term: num(totals, "term"),
          resume: num(totals, "resume"),
        },
        days: names.map((d, i) => ({
          d,
          visits: num(rows[i], "visits"),
          runs: num(rows[i], "runs"),
          chats: num(rows[i], "chats"),
          term: num(rows[i], "term"),
          resume: num(rows[i], "resume"),
        })),
        experiments: Object.fromEntries(
          EXPERIMENTS.map((e, i) => [e.id, expRows[i] ?? {}])
        ),
      });
    }
    if (req.method === "POST") {
      // beacons from crawlers get a quiet ok — counted as nothing
      const BOT_UA =
        /bot|crawler|spider|headless|lighthouse|pingdom|uptime|slurp|duckduck/i;
      if (BOT_UA.test(req.headers["user-agent"] ?? "")) {
        return res.status(200).json({ ok: true });
      }
      const { event, id, exp, arm } = req.body ?? {};
      if (event === "assign") {
        // one arm of one live experiment — anything else is rejected,
        // so the registry bounds which keys a client can create
        const e = EXPERIMENTS.find((x) => x.id === exp);
        if (e?.status !== "live" || !e.variants.some((v) => v.key === arm)) {
          return res.status(400).json({ error: "bad assignment" });
        }
        await redis.hincrby(expKey(e.id), arm, 1);
        return res.status(200).json({ ok: true });
      }
      if (event === "session") {
        const { arms, ms, int } = req.body;
        const dur = Number(ms);
        const acts = Number(int);
        if (
          !arms || typeof arms !== "object" ||
          !(dur > 0 && dur <= 8 * 3600e3) ||
          !(acts >= 0 && acts <= 1e6)
        ) {
          return res.status(400).json({ error: "bad session" });
        }
        const writes = [];
        for (const [exp, key] of Object.entries(arms)) {
          const e = EXPERIMENTS.find((x) => x.id === exp);
          if (e?.status !== "live" || !e.variants.some((v) => v.key === key))
            continue;
          writes.push(
            redis.hincrby(expKey(e.id), `${key}:ms`, Math.round(dur)),
            redis.hincrby(expKey(e.id), `${key}:int`, Math.round(acts)),
            redis.hincrby(expKey(e.id), `${key}:sess`, 1)
          );
        }
        if (!writes.length)
          return res.status(400).json({ error: "bad session" });
        await Promise.all(writes);
        return res.status(200).json({ ok: true });
      }
      // client-beaconed counters — "visit" is the only one that carries
      // an id (the browser uuid for the uniques HLL)
      if (!["visit", "term", "resume", "run"].includes(event)) {
        return res.status(400).json({ error: "unknown event" });
      }
      const field = { visit: "visits", run: "runs" }[event] ?? event;
      const day = dayKey(new Date().toISOString().slice(0, 10));
      const writes = [
        redis.hincrby(TOTALS, field, 1),
        redis.hincrby(day, field, 1),
        redis.expire(day, DAY_TTL),
      ];
      // visitor uuid → uniques HLL; a malformed id just skips the PFADD
      if (
        event === "visit" &&
        typeof id === "string" &&
        id.length > 0 &&
        id.length <= 64
      ) {
        writes.push(redis.pfadd(VISITORS, id));
      }
      await Promise.all(writes);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: `metrics store failed: ${e.message}` });
  }
}
