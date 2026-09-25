// Does the reader's sportsbook offer this market? -- see api/book-markets.js
// for where the answer comes from and why it is measured rather than written
// down.
//
// Three answers, and only one of them greys anything out:
//   true   the book has posted this market for the sampled game
//   false  the book has its prop menu up for that game and this market is
//          not on it
//   null   not known: the menus have not loaded, the book had nothing posted
//          yet, or this market has no key in the provider's vocabulary at all
//          (NFL targets, sacks taken, field-goal attempts). Unknown is never
//          treated as "not offered" -- hiding a market is a claim about the
//          book, and we only make it when the book's own menu says so.

// The app's market ids -> The Odds API's market keys, per sport. A market
// missing from its sport's map is one the provider does not carry.
const ODDS_KEY = {
  nfl: {
    passYds: "player_pass_yds",
    passTd: "player_pass_tds",
    passAtt: "player_pass_attempts",
    comp: "player_pass_completions",
    int: "player_pass_interceptions",
    longPass: "player_pass_longest_completion",
    passRushYds: "player_pass_rush_yds",
    rushYds: "player_rush_yds",
    rushAtt: "player_rush_attempts",
    longRush: "player_rush_longest",
    rec: "player_receptions",
    recYds: "player_reception_yds",
    longRec: "player_reception_longest",
    scrim: "player_rush_reception_yds",
    anytimeTd: "player_anytime_td",
    fgm: "player_field_goals",
    xpm: "player_pats",
    kickPts: "player_kicking_points",
  },
  nba: {
    pts: "player_points",
    reb: "player_rebounds",
    ast: "player_assists",
    "3pm": "player_threes",
    stl: "player_steals",
    blk: "player_blocks",
    stk: "player_blocks_steals",
    pra: "player_points_rebounds_assists",
    pr: "player_points_rebounds",
    pa: "player_points_assists",
    ra: "player_rebounds_assists",
    dd: "player_double_double",
    td: "player_triple_double",
  },
  mlb: {
    h: "batter_hits",
    hr: "batter_home_runs",
    tb: "batter_total_bases",
    rbi: "batter_rbis",
    r: "batter_runs_scored",
    hrrbi: "batter_hits_runs_rbis",
    bb: "batter_walks",
    so: "batter_strikeouts",
    sb: "batter_stolen_bases",
    p_k: "pitcher_strikeouts",
    p_outs: "pitcher_outs",
    p_er: "pitcher_earned_runs",
    p_h: "pitcher_hits_allowed",
    p_bb: "pitcher_walks",
  },
};
// The WNBA's props use the NBA's keys.
ODDS_KEY.wnba = ODDS_KEY.nba;

const TTL_MS = 6 * 60 * 60 * 1000;
const memory = new Map();
const inflight = new Map();

// { books: { fanduel: Set(keys), ... }, fetchedAt } for a sport, or null when
// it could not be read. Cached for the session; the server caches a day.
export async function fetchBookMarkets(sport) {
  const hit = memory.get(sport);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const storeKey = `pp_book_markets_v1_${sport}`;
  try {
    const stored = JSON.parse(sessionStorage.getItem(storeKey) || "null");
    if (stored && Date.now() - stored.at < TTL_MS) {
      const value = revive(stored.value);
      memory.set(sport, { at: stored.at, value });
      return value;
    }
  } catch {}
  if (inflight.has(sport)) return inflight.get(sport);
  const p = (async () => {
    try {
      const res = await fetch(`/api/book-markets?sport=${encodeURIComponent(sport)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.books) return null;
      const raw = { books: data.books, fetchedAt: data.fetchedAt || null };
      const at = Date.now();
      memory.set(sport, { at, value: revive(raw) });
      try { sessionStorage.setItem(storeKey, JSON.stringify({ at, value: raw })); } catch {}
      return revive(raw);
    } catch {
      return null;
    } finally {
      inflight.delete(sport);
    }
  })();
  inflight.set(sport, p);
  return p;
}

function revive(raw) {
  const books = {};
  Object.entries((raw && raw.books) || {}).forEach(([book, keys]) => { books[book] = new Set(keys || []); });
  return { books, fetchedAt: raw ? raw.fetchedAt : null };
}

// true / false / null -- see the top of this file.
export function bookOffers(menus, book, sport, marketId) {
  const key = ODDS_KEY[sport] && ODDS_KEY[sport][marketId];
  if (!key || !menus || !menus.books) return null;
  const posted = menus.books[book];
  if (!posted) return null;
  return posted.has(key);
}
