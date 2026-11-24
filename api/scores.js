// Global snowboard leaderboard — Vercel serverless + Upstash Redis.
//
// GET  /api/scores        → all rows [{d, why, name, at}], desc by d
// POST /api/scores {row}  → one row per rider, best-only; returns the
//                           merged board either way
//
// Storage: Redis hash `snowboard:riders`, field = rider name (""
// for anonymous), value = JSON row. A stored row only updates when
// the new d beats the old. Honor system — no auth, no rate limiting.
//
// Env: set by the Vercel Marketplace integration — either
// UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN (Upstash Redis) or
// KV_REST_API_URL/KV_REST_API_TOKEN (Vercel KV).
import { Redis } from "@upstash/redis";

const HASH = "snowboard:riders";
const MAX_D = 999999;

// same rules as src/components/ide/scores.js cleanName — client-side
// gates are advisory, this is the enforcement copy. Keep in sync.
const BAD = /(fuck|shit|cunt|nigg|fag|whore|slut|dick|pussy|cock|bitch|ass|rape|nazi|hitler|kkk|porn|anal)/;
const cleanName = (v) => {
  const n = String(v).trim().replace(/\s+/g, " ").slice(0, 10);
  if (!n) return null;
  if (!/^[a-z0-9 .'_-]+$/i.test(n)) return null;
  if (BAD.test(n.toLowerCase().replace(/[^a-z]/g, ""))) return null;
  return n;
};

const board = async (redis) => {
  const all = await redis.hgetall(HASH);
  const seen = new Set();
  return Object.values(all ?? {})
    .map((v) => (typeof v === "string" ? JSON.parse(v) : v))
    // a named row outranks the anonymous "" ghost of the same run —
    // adoption writes both, and the name must win the dedup below
    .sort((a, b) => b.d - a.d || (a.at ?? 0) - (b.at ?? 0) || (a.name ? 0 : 1) - (b.name ? 0 : 1))
    // cloned runs — the same (distance, timestamp) adopted under
    // several names by an old saveName leak — collapse to one
    .filter((r) => !seen.has(`${r.d}:${r.at}`) && seen.add(`${r.d}:${r.at}`));
};

export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return res.status(500).json({
      error:
        "leaderboard not configured — set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN " +
        "or KV_REST_API_URL/KV_REST_API_TOKEN (Vercel Marketplace integration)",
    });
  }
  const redis = new Redis({ url, token });

  try {
    if (req.method === "GET") {
      return res.status(200).json(await board(redis));
    }
    if (req.method === "POST") {
      const { d, why, name, at } = req.body ?? {};
      if (typeof d !== "number" || !Number.isFinite(d) || d <= 0 || d > MAX_D) {
        return res.status(400).json({ error: `d must be a positive number ≤ ${MAX_D}` });
      }
      if (name != null && cleanName(name) !== name) {
        return res.status(400).json({ error: "bad name" });
      }
      const key = name ?? "";
      const atMs = typeof at === "number" && Number.isFinite(at) ? at : Date.now();
      const prev = await redis.hget(HASH, key);
      const old = typeof prev === "string" ? JSON.parse(prev) : prev;
      if (!old || d > old.d) {
        const row = {
          d,
          why: String(why ?? "").slice(0, 40),
          name: name ?? null,
          at: atMs,
        };
        await redis.hset(HASH, { [key]: JSON.stringify(row) });
      }
      // a named post adopting this run's anonymous row — the same run
      // sits under "" with the same stamp; drop it so the board shows
      // the name instead of a "rider" ghost
      if (name != null) {
        const anon = await redis.hget(HASH, "");
        const a = typeof anon === "string" ? JSON.parse(anon) : anon;
        if (a && a.at === atMs && a.d === d) await redis.hdel(HASH, "");
      }
      return res.status(200).json(await board(redis));
    }
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: `leaderboard store failed: ${e.message}` });
  }
}
