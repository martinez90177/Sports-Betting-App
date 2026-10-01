import { Redis } from "@upstash/redis";
import { playedWeeks, finishedGames, boxLines, rosterPositions, athletePosition, pool } from "./_nflAllowed.js";

// GET /api/nfl-allowed?season=2026
//   -> { season, builtAt, weeks, games: [...], unknownPos }
//
// Every finished regular-season game's offensive box-score lines, each tagged
// with the player's position -- what the Mismatches page grades defenses on,
// position by position. See _nflAllowed.js for the shape and why.
//
// ---- Caching ----
//
// Three layers, because a finished game never changes and the whole season is
// ~270 box scores by January:
//   - each finished game's lines are stored once, forever (`nfl-box:v2:<id>`;
//     v2 added red-zone counts, so every game was read again once);
//   - a fully played week's game list is stored once (`nfl-wk:v1:<season>:<wk>`);
//   - positions are stored for a day (`nfl-pos:v1`), players move less often.
// The response itself is cached at Vercel's edge for 30 minutes, so most
// visitors never reach this code at all. Without Redis credentials (local
// development) the same layers live in this instance's memory.

const POS_TTL_MS = 24 * 60 * 60 * 1000;
// A cold build of a whole season is ~270 box scores. The function is cut off
// at 60s (vercel.json), so it stops starting new fetches at this point and
// answers with what it has, marked partial and uncached. Every box score it
// did fetch is already stored, so the next request carries on from there.
// Found on the first production load of 2025, which timed out at 60s.
const FETCH_BUDGET_MS = 40 * 1000;
const MAX_ATHLETE_LOOKUPS = 60;

const memory = new Map();
function store() {
  const url = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
  if (url && token) {
    const redis = new Redis({ url, token });
    return {
      get: (k) => redis.get(k).catch(() => null),
      mget: (ks) => (ks.length ? redis.mget(...ks).catch(() => ks.map(() => null)) : Promise.resolve([])),
      set: (k, v) => redis.set(k, v).catch(() => null),
    };
  }
  return {
    get: async (k) => memory.get(k) ?? null,
    mget: async (ks) => ks.map((k) => memory.get(k) ?? null),
    set: async (k, v) => { memory.set(k, v); },
  };
}

export async function buildSeason(season, db = store()) {
  const started = Date.now();
  const weeks = await playedWeeks(season);

  // Game lists, week by week. A week is kept once every game in it is final.
  const lists = await pool(Array.from({ length: weeks }, (_, i) => i + 1), 6, async (wk) => {
    const key = `nfl-wk:v1:${season}:${wk}`;
    const hit = await db.get(key);
    if (hit) return hit;
    const games = await finishedGames(season, wk);
    if (wk < weeks && games.length) await db.set(key, games);
    return games;
  });
  const games = lists.flat();

  // Box scores: stored ones read in one round trip, the rest fetched.
  const keys = games.map((g) => `nfl-box:v2:${g.id}`);
  const stored = await db.mget(keys);
  const lines = await pool(games, 8, async (g, i) => {
    if (stored[i]) return stored[i];
    if (Date.now() - started > FETCH_BUDGET_MS) return null;
    try {
      const box = await boxLines(g.id);
      await db.set(keys[i], box);
      return box;
    } catch {
      return null;
    }
  });

  // Positions: the rosters, then the athlete record for anyone not on one.
  let pos = await db.get("nfl-pos:v1");
  if (!pos || Date.now() - pos.at > POS_TTL_MS) {
    const map = await rosterPositions();
    pos = { at: Date.now(), map: { ...(pos?.map || {}), ...map } };
    await db.set("nfl-pos:v1", pos);
  }
  const missing = [...new Set(lines.flatMap((b) => b?.L || []).map((l) => l.id).filter((id) => !pos.map[id]))];
  if (missing.length) {
    const found = await pool(missing.slice(0, MAX_ATHLETE_LOOKUPS), 8, athletePosition);
    let changed = false;
    missing.slice(0, MAX_ATHLETE_LOOKUPS).forEach((id, i) => { if (found[i]) { pos.map[id] = found[i]; changed = true; } });
    if (changed) await db.set("nfl-pos:v1", pos);
  }

  let unknownPos = 0;
  const out = games.map((g, i) => {
    if (!lines[i]) return { ...g, L: null };
    const L = lines[i].L.map((l) => {
      const p = pos.map[l.id] || "";
      if (!p) unknownPos += 1;
      return { ...l, pos: p };
    });
    return { ...g, L, Z: lines[i].Z };
  });

  return {
    season,
    builtAt: Date.now(),
    weeks,
    games: out,
    missingBox: out.filter((g) => !g.L).length,
    partial: Date.now() - started > FETCH_BUDGET_MS && out.some((g) => !g.L),
    unknownPos,
  };
}

export default async function handler(req, res) {
  const now = new Date();
  // The NFL season is named for the year it starts in; January and February
  // games still belong to the previous year's season.
  const fallback = now.getUTCMonth() < 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const season = Number(req.query?.season) || fallback;
  try {
    const data = await buildSeason(season);
    res.setHeader("Cache-Control", data.partial ? "no-store" : "public, s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json(data);
  } catch (err) {
    res.status(200).json({ season, builtAt: null, weeks: 0, games: [], error: String(err) });
  }
}
