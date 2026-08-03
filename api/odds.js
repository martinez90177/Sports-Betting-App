import { Redis } from "@upstash/redis";

// Swap this to "americanfootball_nfl" in September once MLB season wraps up
// -- re-check the credit budget in the handler comment below when you do,
// since NFL markets use "player_*" key names, not MLB's "batter_*"/"pitcher_*".
const SPORT_KEY = "baseball_mlb";
const REGIONS = "us";
const MARKETS = ["batter_hits", "batter_home_runs"];
const ODDS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // per-game odds refresh window
const EVENTS_CACHE_TTL_MS = 60 * 60 * 1000; // events list is free, but cache anyway to cut round-trips

// The Odds API's event.home_team/away_team are full names ("New York
// Yankees"), but the frontend only knows team abbreviations -- match on each
// team's nickname (unique enough across all 30 clubs) rather than requiring
// the frontend to send full names.
const MLB_TEAM_NICKNAME = {
  ARI: "Diamondbacks", ATL: "Braves", BAL: "Orioles", BOS: "Red Sox", CHC: "Cubs",
  CWS: "White Sox", CIN: "Reds", CLE: "Guardians", COL: "Rockies", DET: "Tigers",
  HOU: "Astros", KC: "Royals", LAA: "Angels", LAD: "Dodgers", MIA: "Marlins",
  MIL: "Brewers", MIN: "Twins", NYM: "Mets", NYY: "Yankees", ATH: "Athletics",
  PHI: "Phillies", PIT: "Pirates", SD: "Padres", SEA: "Mariners", SF: "Giants",
  STL: "Cardinals", TB: "Rays", TEX: "Rangers", TOR: "Blue Jays", WSH: "Nationals",
};

function redisClient() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
  });
}

// GET /events costs 0 credits regardless of how often it's called.
async function fetchEventsToday(apiKey) {
  const url = `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/events?apiKey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Events lookup responded ${res.status}`);
  return res.json();
}

// Player props (player_hits, player_home_runs, etc.) are NOT "featured
// markets" -- the bulk /sports/{sport}/odds endpoint 422s on them
// (INVALID_MARKET). They only exist on the per-event endpoint, so we have to
// look up the specific event first and fetch odds one game at a time.
async function fetchEventOdds(apiKey, eventId) {
  const url = `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/events/${eventId}/odds?apiKey=${apiKey}&regions=${REGIONS}&markets=${MARKETS.join(",")}&oddsFormat=american`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Odds API responded ${res.status}`);
  return res.json();
}

// Cost per live event fetch = MARKETS.length x regions = 2 credits. Unlike
// the bulk endpoint, player props are priced per game, so pre-fetching the
// whole day's slate (~15 MLB games) a few times a day would burn through the
// 500/month free tier in days. Instead this only spends credits on games a
// visitor actually asks about (?team=NYY), cached per-event for
// ODDS_CACHE_TTL_MS -- cost scales with games people actually look at, not
// the size of the day's schedule.
export default async function handler(req, res) {
  const team = String(req.query.team || "").trim().toUpperCase();
  if (!team) {
    return res.status(400).json({ odds: null, error: "Missing required ?team= query param" });
  }

  const redis = redisClient();
  const eventsKey = `odds-events:${SPORT_KEY}`;
  let cacheKey = null;
  try {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) throw new Error("Missing ODDS_API_KEY");

    let events = await redis.get(eventsKey);
    if (!events || Date.now() - events.fetchedAt > EVENTS_CACHE_TTL_MS) {
      const list = await fetchEventsToday(apiKey);
      events = { list, fetchedAt: Date.now() };
      await redis.set(eventsKey, events);
    }

    const nickname = (MLB_TEAM_NICKNAME[team] || team).toUpperCase();
    const match = (events.list || []).find(
      (e) => e.home_team?.toUpperCase().includes(nickname) || e.away_team?.toUpperCase().includes(nickname)
    );
    if (!match) {
      return res.status(200).json({ odds: null, fetchedAt: Date.now(), stale: false, note: "No game found today for that team" });
    }

    cacheKey = `odds:${SPORT_KEY}:${match.id}`;
    const cached = await redis.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < ODDS_CACHE_TTL_MS) {
      return res.status(200).json({ ...cached, stale: false });
    }

    const odds = await fetchEventOdds(apiKey, match.id);
    const record = { odds, fetchedAt: Date.now(), sport: SPORT_KEY, eventId: match.id };
    await redis.set(cacheKey, record);
    res.status(200).json({ ...record, stale: false });
  } catch (err) {
    const staleCopy = cacheKey ? await redis.get(cacheKey).catch(() => null) : null;
    if (staleCopy) return res.status(200).json({ ...staleCopy, stale: true, error: String(err) });
    res.status(500).json({ odds: null, fetchedAt: null, stale: false, error: String(err) });
  }
}
