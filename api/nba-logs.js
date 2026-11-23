// Every rostered NBA player's ESPN game log for one season, in one response.
//
// GET /api/nba-logs?season=2027[&part=0&parts=3]
//   -> { season, fetchedAt, names, types, players: { [espnId]: [row, ...] } }
//
// The browser used to ask ESPN for each player's log itself: hundreds of
// requests on every first visit, which on a phone is the slowest thing the
// site does (site review, 2026-11-23). This asks once, here, and Vercel's edge
// cache hands the same answer to every visitor for half an hour -- so a
// visitor makes one request, and ESPN sees one fetch per half hour rather than
// one per visit.
//
// Packed, not parsed: each game is one row holding exactly the fields the
// app's own parser reads (parseNBAGameLogResponse in src/PropLedger.jsx), and
// the browser rebuilds ESPN's shape from it before parsing -- so the numbers on
// screen come out of the same code whether they arrived here or directly.
// Packed because a full season of every player as ESPN sends it is ~13 MB,
// over a function's 4.5 MB response limit; `part`/`parts` split the players
// further for a finished season.
//
// A player whose log cannot be read is simply absent, and the app fetches him
// itself as before. Free: ESPN's public endpoints, no credits.

const LEAGUE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const GAMELOG = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes";
const CONCURRENCY = 24;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function pooled(items, limit, fn) {
  const out = [];
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const k = i++;
      try { out[k] = await fn(items[k]); } catch { out[k] = null; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

// Row layout -- the browser's unpackNbaLog reads it in this order.
// [eventId, gameDate, atVs, gameResult, homeTeamId, homeTeamScore,
//  awayTeamScore, opponentAbbr, teamAbbr, teamId, seasonTypeIndex, ...stats]
function pack(log, types) {
  const rows = [];
  (log.seasonTypes || []).forEach((st) => {
    let t = types.indexOf(st.displayName);
    if (t < 0) { types.push(st.displayName); t = types.length - 1; }
    (st.categories || []).forEach((c) => (c.events || []).forEach((ev) => {
      const e = (log.events || {})[ev.eventId];
      if (!e) return;
      rows.push([
        ev.eventId, e.gameDate, e.atVs, e.gameResult, e.homeTeamId, e.homeTeamScore, e.awayTeamScore,
        e.opponent && e.opponent.abbreviation, e.team && e.team.abbreviation, e.team && e.team.id, t,
        ...(ev.stats || []),
      ]);
    }));
  });
  return rows;
}

export default async function handler(req, res) {
  const q = req.query || {};
  const season = Number(q.season);
  const parts = Math.max(1, Math.min(8, Number(q.parts) || 1));
  const part = Math.max(0, Math.min(parts - 1, Number(q.part) || 0));
  if (!Number.isInteger(season) || season < 2020 || season > 2100) {
    res.status(400).json({ error: "season must be a year, e.g. 2027" });
    return;
  }
  try {
    const teams = await getJson(`${LEAGUE}/teams`);
    const teamIds = (((teams.sports || [])[0] || {}).leagues || [])[0]?.teams?.map((t) => t.team.id) || [];
    const rosters = await pooled(teamIds, 10, (id) => getJson(`${LEAGUE}/teams/${id}/roster`));
    const ids = [...new Set(rosters.flatMap((r) => (r && r.athletes ? r.athletes.map((a) => String(a.id)) : [])))]
      .sort()
      .filter((_, k) => k % parts === part);

    const logs = await pooled(ids, CONCURRENCY, (id) => getJson(`${GAMELOG}/${id}/gamelog?season=${season}`));
    const types = [];
    const players = {};
    let names = null;
    const namesFor = {};
    ids.forEach((id, k) => {
      const log = logs[k];
      if (!log || !log.events || !Object.keys(log.events).length) return;
      const rows = pack(log, types);
      if (!rows.length) return;
      players[id] = rows;
      const n = log.names || [];
      if (!names) names = n;
      else if (n.join("|") !== names.join("|")) namesFor[id] = n;
    });

    // A finished season cannot change; the one being played changes nightly.
    const now = new Date();
    const current = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
    const fresh = season >= current ? 1800 : 86400;
    res.setHeader("Cache-Control", `public, max-age=0, s-maxage=${fresh}, stale-while-revalidate=86400`);
    res.status(200).json({ season, part, parts, fetchedAt: new Date().toISOString(), names: names || [], namesFor, types, players });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: String((err && err.message) || err) });
  }
}
