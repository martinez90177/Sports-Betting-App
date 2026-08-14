import { Redis } from "@upstash/redis";

// Swap this to "americanfootball_nfl" in September once MLB season wraps up
// -- re-check the credit budget in the handler comment below when you do,
// since NFL markets use "player_*" key names, not MLB's "batter_*"/"pitcher_*".
const SPORT_KEY = "baseball_mlb";
const REGIONS = "us";
const MARKETS = ["batter_hits", "batter_home_runs"];
const ODDS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // per-game odds refresh window
const EVENTS_CACHE_TTL_MS = 60 * 60 * 1000; // events list is free, but cache anyway to cut round-trips

// The free tier is 500 credits/month and there was previously nothing stopping
// this endpoint from spending all of them. The budget note further down works
// out that a fully-used day costs ~60 credits -- about eight days of the
// month's entire allowance -- so the ceiling is genuinely reachable, and
// hitting it means the Odds API starts refusing calls and the only real-odds
// feature in the app breaks silently on the live site.
//
// The cap is set below 500 on purpose: the remainder is headroom to notice and
// react before the account is actually dry.
const ODDS_MONTHLY_CREDIT_CAP = 450;
const CREDITS_PER_EVENT_FETCH = MARKETS.length; // x1 region ("us")

// Counter resets by rolling the month into the key rather than by scheduling
// anything -- a new month is simply a key that doesn't exist yet. UTC so the
// rollover can't happen twice in different deployment regions.
function creditKey(now = new Date()) {
  return `odds-credits:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
const CREDIT_KEY_TTL_S = 45 * 24 * 60 * 60; // outlives its month, then self-cleans

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
  // The API reports the account's real usage on every response. That's the
  // authoritative number -- our own counter can drift (a failed request that
  // still counted upstream, or spending from another deployment sharing the
  // key) -- so when the header is present we trust it over our tally.
  const remaining = Number(res.headers.get("x-requests-remaining"));
  const used = Number(res.headers.get("x-requests-used"));
  return {
    data: await res.json(),
    remaining: Number.isFinite(remaining) ? remaining : null,
    used: Number.isFinite(used) ? used : null,
  };
}

// Reads the month's spend, preferring the figure the API itself last reported.
async function readCreditState(redis) {
  const [spent, reported] = await Promise.all([
    redis.get(creditKey()).catch(() => null),
    redis.get("odds-credits:reported").catch(() => null),
  ]);
  const counted = Number(spent) || 0;
  // `used` from the API counts the whole billing month across every key user,
  // so it's the safer of the two whenever it's higher than our own tally.
  const authoritative = reported && Number.isFinite(Number(reported.used))
    ? Math.max(counted, Number(reported.used))
    : counted;
  return { counted, authoritative, reported };
}

// Cost per live event fetch = MARKETS.length x regions = 2 credits. Unlike
// the bulk endpoint, player props are priced per game, so pre-fetching the
// whole day's slate (~15 MLB games) a few times a day would burn through the
// 500/month free tier in days. Instead this only spends credits on games a
// visitor actually asks about (?team=NYY), cached per-event for
// ODDS_CACHE_TTL_MS -- cost scales with games people actually look at, not
// the size of the day's schedule.
//
// Nothing here runs on page load: the frontend only calls this from the
// "Get Odds" button's onClick (see the OddsPanel in src/PropLedger.jsx), so a
// visitor who never presses it costs nothing. At a 12h TTL a game refreshes at
// most twice a day = 4 credits/game/day, so even the full ~15-game slate being
// opened daily lands near 60 credits/day against the 500/month tier.
//
// `stale` means one specific thing: the upstream call FAILED and this is a
// fallback copy. It is deliberately NOT a freshness signal -- a plain cache hit
// is a successful response that happens to be up to ODDS_CACHE_TTL_MS old. Age
// is carried by `fetchedAt` instead, and the UI reads that to say how old the
// price is rather than calling everything "live" (see SportsbookOddsPanel).
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

    // Everything above this line is free. Past here we spend, so the budget is
    // checked first -- refusing to spend is the whole point, and checking
    // afterwards would be checking after the damage.
    const credits = await readCreditState(redis);
    if (credits.authoritative + CREDITS_PER_EVENT_FETCH > ODDS_MONTHLY_CREDIT_CAP) {
      const budget = {
        budgetExhausted: true,
        creditsUsed: credits.authoritative,
        creditCap: ODDS_MONTHLY_CREDIT_CAP,
      };
      // An expired cache copy still beats nothing here: the alternative is an
      // empty panel, and old odds clearly labelled as old are more useful than
      // no odds at all.
      const old = await redis.get(cacheKey).catch(() => null);
      if (old) return res.status(200).json({ ...old, stale: true, ...budget });
      return res.status(200).json({
        odds: null, fetchedAt: null, stale: false, ...budget,
        note: "Monthly odds budget reached — resets on the 1st",
      });
    }

    const { data: odds, remaining, used } = await fetchEventOdds(apiKey, match.id);
    // Recorded after the call succeeds, so a failed request doesn't count
    // against a budget it never actually spent.
    try {
      await redis.incrby(creditKey(), CREDITS_PER_EVENT_FETCH);
      await redis.expire(creditKey(), CREDIT_KEY_TTL_S);
      if (used != null || remaining != null) {
        await redis.set("odds-credits:reported", { used, remaining, at: Date.now() });
      }
    } catch {
      // Never fail the request over bookkeeping -- the odds were fetched and
      // paid for either way, so the caller should still get them.
    }
    const record = {
      odds, fetchedAt: Date.now(), sport: SPORT_KEY, eventId: match.id,
      creditsUsed: used ?? credits.authoritative + CREDITS_PER_EVENT_FETCH,
      creditsRemaining: remaining,
      creditCap: ODDS_MONTHLY_CREDIT_CAP,
    };
    await redis.set(cacheKey, record);
    res.status(200).json({ ...record, stale: false });
  } catch (err) {
    const staleCopy = cacheKey ? await redis.get(cacheKey).catch(() => null) : null;
    if (staleCopy) return res.status(200).json({ ...staleCopy, stale: true, error: String(err) });
    res.status(500).json({ odds: null, fetchedAt: null, stale: false, error: String(err) });
  }
}
