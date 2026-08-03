import { Redis } from "@upstash/redis";

// Swap this to "americanfootball_nfl" in September once MLB season wraps up
// -- re-check the credit budget in the handler comment below when you do,
// since NFL markets/lines differ and you may want a different MARKETS list.
const SPORT_KEY = "baseball_mlb";
const REGIONS = "us";
// Cost per live fetch = MARKETS.length x regions (1 here), in credits.
// Keep this list short -- see the budget note on `handler` below.
const MARKETS = ["player_hits", "player_home_runs"];
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4hr window caps worst-case spend

function redisClient() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
  });
}

// GET /events costs 0 credits. Checking it first means an off day (no games
// scheduled) spends nothing -- doesn't matter much for MLB's daily slate,
// but this is what keeps NFL (2-3 game days/week) cheap once we switch over.
async function hasEventsToday(apiKey) {
  const url = `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/events?apiKey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return true; // fail open -- let the real odds call surface the error
  const events = await res.json();
  return Array.isArray(events) && events.length > 0;
}

async function fetchFreshOdds(apiKey) {
  const url = `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds?apiKey=${apiKey}&regions=${REGIONS}&markets=${MARKETS.join(",")}&oddsFormat=american`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Odds API responded ${res.status}`);
  return res.json();
}

// Read-through cache backed by the same Upstash Redis instance as
// refresh-mlb-matchups.js. Every visitor hits this one endpoint, but it only
// spends real Odds API credits once per CACHE_TTL_MS window -- shared across
// all visitors, not once per page load. At 2 markets x 1 region = 2 credits
// per live fetch, and at most one live fetch per 4hr window, worst case is
// 6 fetches/day x 2 credits = 12/day (~360/month), comfortably under the
// free tier's 500/month cap even under constant traffic.
export default async function handler(req, res) {
  const redis = redisClient();
  const cacheKey = `odds:${SPORT_KEY}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return res.status(200).json({ ...cached, stale: false });
    }

    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) throw new Error("Missing ODDS_API_KEY");

    const gamesToday = await hasEventsToday(apiKey);
    if (!gamesToday) {
      const empty = { odds: [], fetchedAt: Date.now(), sport: SPORT_KEY };
      await redis.set(cacheKey, empty);
      return res.status(200).json({ ...empty, stale: false });
    }

    const odds = await fetchFreshOdds(apiKey);
    const record = { odds, fetchedAt: Date.now(), sport: SPORT_KEY };
    await redis.set(cacheKey, record);
    res.status(200).json({ ...record, stale: false });
  } catch (err) {
    const stalecopy = await redis.get(cacheKey).catch(() => null);
    if (stalecopy) return res.status(200).json({ ...stalecopy, stale: true, error: String(err) });
    res.status(500).json({ odds: [], fetchedAt: null, stale: false, error: String(err) });
  }
}
