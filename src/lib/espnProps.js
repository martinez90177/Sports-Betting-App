// Sportsbook player-prop prices, from ESPN's own feed of DraftKings' board.
//
// ESPN carries DraftKings' "milestone" markets -- 15+, 20+, 25+ points and the
// like -- each with an American price. A milestone is one-sided, so "23+
// points" is exactly an Over 22.5, and its price is a real book number for the
// over at that line. (ESPN's plain over/under pairs carry no side label, and
// on football no price at all, so they are not used.)
//
// Free, CORS-open, and fetched only for the game a player page is open on.

const LEAGUE_PATH = { nba: "basketball/leagues/nba", nfl: "football/leagues/nfl", wnba: "basketball/leagues/wnba" };

// ESPN market name -> the app's market id.
const MILESTONE_MARKET = {
  "Points Milestones": "pts",
  "Rebounds Milestones": "reb",
  "Assists Milestones": "ast",
  "3-Point Field Goals Milestones": "3pm",
  "Passing Yards Milestones": "passYds",
  "Rushing Yards Milestones": "rushYds",
  "Receiving Yards Milestones": "recYds",
  "Receptions Milestones": "rec",
};

const TTL_MS = 10 * 60 * 1000;
const memo = new Map();

// { [espnAthleteId]: { [market]: [{ at, american, book }] } } for one game,
// or null when the book has nothing posted for it.
export async function fetchBookMilestones(sport, eventId) {
  if (!LEAGUE_PATH[sport] || !eventId) return null;
  const key = `${sport}:${eventId}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  let value = null;
  try {
    const res = await fetch(`https://sports.core.api.espn.com/v2/sports/${LEAGUE_PATH[sport]}/events/${eventId}/competitions/${eventId}/odds/100/propBets?limit=1000`);
    if (res.ok) {
      const j = await res.json();
      value = {};
      (j.items || []).forEach((i) => {
        const market = MILESTONE_MARKET[i.type && i.type.name];
        const id = i.athlete && i.athlete.$ref && (i.athlete.$ref.match(/athletes\/(\d+)/) || [])[1];
        const at = i.current && i.current.target && Number(i.current.target.value);
        const american = i.odds && i.odds.american && Number(String(i.odds.american.value).replace("EVEN", "100"));
        if (!market || !id || !Number.isFinite(at) || !Number.isFinite(american)) return;
        const A = (value[id] = value[id] || {});
        (A[market] = A[market] || []).push({ at, american, book: "DraftKings" });
      });
      Object.values(value).forEach((A) => Object.values(A).forEach((list) => list.sort((a, b) => a.at - b.at)));
      if (!Object.keys(value).length) value = null;
    }
  } catch {
    value = null;
  }
  memo.set(key, { at: Date.now(), value });
  return value;
}

// The book's price for Over `line` in `market`, when it posts the matching
// milestone: Over 22.5 is "23+". Null when it does not.
export function bookPriceForOver(milestones, espnId, market, line) {
  if (!milestones || !espnId || !Number.isFinite(line)) return null;
  const list = (milestones[String(espnId)] || {})[market];
  if (!list) return null;
  const need = Math.floor(line) + 1;
  const m = list.find((x) => x.at === need);
  if (!m) return null;
  const a = m.american;
  const prob = a < 0 ? -a / (-a + 100) : 100 / (a + 100);
  return { american: a, prob, label: `${need}+`, book: m.book };
}
