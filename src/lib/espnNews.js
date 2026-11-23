// The News page's wire: each league's own news from ESPN, newest first.
//
// It used to be a general news search (NewsData's free tier): ten headlines,
// half a day old, most not about any player and some not about betting at all
// -- a broadcaster's obituary, a wrestling shout-out (site review,
// 2026-11-23). ESPN's league feed is the opposite on all three counts: it is
// minutes old, it is about the sport, and about half its items name the player
// they are about, by ESPN id, so attribution needs no guessing from the
// headline.
//
// Free and CORS-open. Video clips and game recaps are left out: a clip has
// no text to read, and a recap is a box score the feed already counts.

const PATH = { nfl: "football/nfl", nba: "basketball/nba", wnba: "basketball/wnba", mlb: "baseball/mlb" };
const KEEP = new Set(["HeadlineNews", "Story"]);
const TTL_MS = 10 * 60 * 1000;
const memo = new Map();

// "2026-11-23T18:24:21Z" -> "2026-11-23 18:24:21", the shape timeAgo reads.
const toPubDate = (iso) => (iso ? String(iso).replace("T", " ").replace(/Z$/, "").slice(0, 19) : "");

async function leagueNews(sport) {
  const hit = memo.get(sport);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  let value = [];
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${PATH[sport]}/news?limit=50`);
    if (res.ok) {
      const j = await res.json();
      value = (j.articles || [])
        .filter((a) => KEEP.has(a.type) && a.headline)
        .map((a) => ({
          title: a.headline,
          snippet: a.description || "",
          link: (a.links && a.links.web && a.links.web.href) || "",
          sourceName: "ESPN",
          pubDate: toPubDate(a.published),
          sport,
          // The players the story is about, as ESPN tagged them.
          athleteIds: (a.categories || [])
            .filter((c) => c.type === "athlete" && (c.athleteId || (c.athlete && c.athlete.id)))
            .map((c) => String(c.athleteId || c.athlete.id)),
        }));
    }
  } catch {
    value = [];
  }
  memo.set(sport, { at: Date.now(), value });
  return value;
}

// Every listed league's news merged newest first. The same { articles, stale,
// error } answer fetchNews gives, so the page reads either.
export async function fetchLeagueNews(sports, limit = 30) {
  const lists = await Promise.all(sports.filter((s) => PATH[s]).map(leagueNews));
  const seen = new Set();
  const articles = lists.flat()
    .filter((a) => (seen.has(a.link || a.title) ? false : seen.add(a.link || a.title)))
    .sort((a, b) => (a.pubDate < b.pubDate ? 1 : a.pubDate > b.pubDate ? -1 : 0))
    .slice(0, limit);
  return {
    articles,
    stale: false,
    error: articles.length ? null : "The league news feed could not be reached. This is a network answer, not an empty day.",
  };
}

// Leagues playing this time of year, by month (preseason and postseason
// included). Out-of-season news is free agency and draft talk, not props.
const SEASON_MONTHS = {
  nfl: [8, 9, 10, 11, 0, 1],
  nba: [9, 10, 11, 0, 1, 2, 3, 4, 5],
  wnba: [4, 5, 6, 7, 8, 9],
  mlb: [2, 3, 4, 5, 6, 7, 8, 9],
};
export function leaguesInSeason(now = new Date()) {
  const m = now.getMonth();
  return Object.keys(SEASON_MONTHS).filter((s) => SEASON_MONTHS[s].includes(m));
}
