import { ODDS_MONTHLY_CREDIT_CAP, redisClient, creditsSpent, recordSpend } from "./_oddsBudget.js";

// Which player-prop markets each sportsbook has posted -- measured, per sport.
//
// GET /api/book-markets?sport=nfl
//   -> { sport, fetchedAt, events: [ids], books: { fanduel: ["player_pass_yds", ...], ... } }
//
// The Prop Feed greys out a market the reader's sportsbook does not offer.
// Alex, 2026-09-25: *"when people are searching the prop feed for lets say
// fanduel props, that those extra ones not even on fanduel get grayed
// out/unclickable ... but if they have it set to draftkings its usable."*
//
// Which book offers what is not written down anywhere in this app, and it
// must not be: a hand-typed list would be a claim about every book's menu
// that goes stale the first week a book adds a market. It was also wrong the
// day it was proposed -- FanDuel's own research pages list completions, pass
// attempts, interceptions, longest reception and kicking points, which the
// list would have greyed out. So it is asked for, of The Odds API's
// event-markets endpoint, which answers per bookmaker with every market key
// that book has posted for one game, for 1 credit.
//
// ---- What a book's list means ----
//
// A book's markets are counted only from a game where it has posted its
// headline market (`ANCHOR`, e.g. pass yards). Books fill a game's prop menu
// over the days before kickoff, and a game the book has barely started on
// would otherwise read as "offers almost nothing". A book with no such game
// in the sample is left out of `books` entirely -- which the client reads as
// unknown, and greys out nothing for.
//
// ---- Cost ----
//
// One credit per game asked about, the soonest game first, and a second only
// if no book had its menu up for the first. Cached per sport for a day in
// Redis and only refreshed when someone opens that sport's feed, so the
// ceiling is about two credits per sport per day -- under the same monthly
// cap and counter as api/odds.js (see _oddsBudget.js). Past the cap it serves
// the last copy it has, or nothing.

const SPORT_KEYS = {
  nfl: "americanfootball_nfl",
  nba: "basketball_nba",
  wnba: "basketball_wnba",
  mlb: "baseball_mlb",
};

// The market every book posts first for a game, per sport.
const ANCHOR = {
  nfl: "player_pass_yds",
  nba: "player_points",
  wnba: "player_points",
  mlb: "batter_hits",
};

// The Odds API's bookmaker keys for the books this app offers in Settings,
// mapped to the app's own ids (Caesars is `williamhill_us` there).
const BOOKS = {
  draftkings: "draftkings",
  fanduel: "fanduel",
  betmgm: "betmgm",
  williamhill_us: "caesars",
  espnbet: "espnbet",
  fanatics: "fanatics",
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 2;

async function upcomingEvents(apiKey, sportKey) {
  const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${apiKey}`);
  if (!res.ok) throw new Error(`Events lookup responded ${res.status}`);
  const list = await res.json();
  const now = Date.now();
  return (Array.isArray(list) ? list : [])
    .filter((e) => Date.parse(e.commence_time) > now)
    .sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time));
}

export default async function handler(req, res) {
  const sport = String(req.query.sport || "").toLowerCase();
  const sportKey = SPORT_KEYS[sport];
  if (!sportKey) return res.status(400).json({ books: null, error: "Unknown ?sport=" });

  const redis = redisClient();
  const cacheKey = `book-markets:${sportKey}`;
  try {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return res.status(200).json(cached);

    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) throw new Error("Missing ODDS_API_KEY");

    const events = await upcomingEvents(apiKey, sportKey);
    if (!events.length) {
      return res.status(200).json(cached || { sport, fetchedAt: Date.now(), events: [], books: {}, note: "No upcoming games" });
    }

    const books = {};
    const asked = [];
    for (const ev of events.slice(0, MAX_EVENTS)) {
      if (await creditsSpent(redis) + 1 > ODDS_MONTHLY_CREDIT_CAP) {
        if (cached) return res.status(200).json({ ...cached, stale: true, budgetExhausted: true });
        return res.status(200).json({ sport, fetchedAt: null, events: [], books: null, budgetExhausted: true });
      }
      const r = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${ev.id}/markets?apiKey=${apiKey}&bookmakers=${Object.keys(BOOKS).join(",")}`
      );
      if (!r.ok) throw new Error(`Event markets responded ${r.status}`);
      const data = await r.json();
      await recordSpend(redis, 1, r);
      asked.push(ev.id);
      let anyMenu = false;
      (data.bookmakers || []).forEach((b) => {
        const id = BOOKS[b.key];
        const keys = (b.markets || []).map((m) => m.key);
        if (!id || !keys.includes(ANCHOR[sport])) return;
        anyMenu = true;
        books[id] = [...new Set([...(books[id] || []), ...keys])];
      });
      // One game with a posted menu is the answer; a second is asked for
      // only when no book had started on the first.
      if (anyMenu) break;
    }

    const record = { sport, fetchedAt: Date.now(), events: asked, books };
    await redis.set(cacheKey, record);
    res.status(200).json(record);
  } catch (err) {
    const old = await redis.get(cacheKey).catch(() => null);
    if (old) return res.status(200).json({ ...old, stale: true, error: String(err) });
    res.status(200).json({ sport, fetchedAt: null, events: [], books: null, error: String(err) });
  }
}
