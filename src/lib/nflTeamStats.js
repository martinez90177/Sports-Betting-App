import { TEAM_ESPN_IDS } from "./rosters.js";

// ---------------------------------------------------------------------------
// Team rankings -- each side's offense against the other side's defense
// ---------------------------------------------------------------------------
// Outlier's matchup page leads with this table, and it needs nothing this app
// lacks: ESPN's team statistics endpoint is free, CORS-open, and answers both
// halves per team -- `results.stats` (what the team did) and
// `results.opponent` (what was done against it).
//
// **The ranks are ours.** The opponent half ships with a `rank` field, but it
// runs past 32 on some stats ("#42" for solo tackles) and the offensive half
// has none, so neither is used. Every rank here is this module sorting the
// teams that answered on the per-game number, stated as "of N".
//
// **The season is the one asked for.** ESPN labels a `?season=2025` response
// "2026" while returning 2025's seventeen games, so the label is never read.

const TTL_MS = 6 * 60 * 60 * 1000;
const cacheKey = (season) => `pp_nfl_teamstats_v2_${season}`;
const memory = new Map();

// An NFL season is named for the year it kicks off; January belongs to the
// one before. Duplicated from PropLedger's currentNFLSeason, which this file
// cannot import.
export function nflSeasonNow(d = new Date()) {
  return d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

// ESPN's WSH is this app's WAS; both keys resolve.
const ourAbbr = (a) => (a === "WSH" ? "WAS" : a);

function stat(cats, cat, name) {
  const c = (cats || []).find((x) => x.name === cat);
  const s = c && (c.stats || []).find((x) => x.name === name);
  return s && Number.isFinite(s.value) ? s.value : null;
}
const per = (v, g) => (v == null || !g ? null : v / g);
const pctOf = (a, b) => (a == null || !b ? null : (a / b) * 100);

// Official total yards: rushing plus NET passing. ESPN's own `totalYards`
// adds gross passing, so every yard lost to a sack counted as gained -- it
// read Atlanta's 2026 as 4.6 a play when it was 4.2.
const netYards = (c) => {
  const rush = stat(c, "rushing", "rushingYards");
  const pass = stat(c, "passing", "netPassingYards");
  return rush == null || pass == null ? null : rush + pass;
};

// One row per stat. `off` reads the team's own numbers, `def` the numbers
// conceded to it; `high` says which way is better *for that side*, so rank 1
// is always the best offense in the left column and the best defense in the
// right. The two rows whose meaning flips between sides say so in `sides`.
export const NFL_TEAM_RANK_ROWS = [
  {
    id: "points", label: "Points", dp: 1,
    off: { get: (c, g) => per(stat(c, "scoring", "totalPoints"), g), high: true },
    def: { get: (c, g) => per(stat(c, "scoring", "totalPoints"), g), high: false },
  },
  {
    id: "yards", label: "Total yards", dp: 1,
    off: { get: (c, g) => per(netYards(c), g), high: true },
    def: { get: (c, g) => per(netYards(c), g), high: false },
  },
  {
    id: "passYds", label: "Passing yards", dp: 1,
    off: { get: (c, g) => per(stat(c, "passing", "netPassingYards"), g), high: true },
    def: { get: (c, g) => per(stat(c, "passing", "netPassingYards"), g), high: false },
  },
  {
    id: "rushYds", label: "Rushing yards", dp: 1,
    off: { get: (c, g) => per(stat(c, "rushing", "rushingYards"), g), high: true },
    def: { get: (c, g) => per(stat(c, "rushing", "rushingYards"), g), high: false },
  },
  {
    id: "ypp", label: "Yards per play", dp: 1,
    off: { get: (c) => per(netYards(c), stat(c, "rushing", "totalOffensivePlays")), high: true },
    def: { get: (c) => per(netYards(c), stat(c, "rushing", "totalOffensivePlays")), high: false },
  },
  {
    id: "third", label: "3rd down %", dp: 1,
    off: { get: (c) => pctOf(stat(c, "miscellaneous", "thirdDownConvs"), stat(c, "miscellaneous", "thirdDownAttempts")), high: true },
    def: { get: (c) => pctOf(stat(c, "miscellaneous", "thirdDownConvs"), stat(c, "miscellaneous", "thirdDownAttempts")), high: false },
  },
  {
    id: "redzone", label: "Red zone TD %", dp: 1,
    off: { get: (c) => stat(c, "miscellaneous", "redzoneTouchdownPct"), high: true },
    def: { get: (c) => stat(c, "miscellaneous", "redzoneTouchdownPct"), high: false },
  },
  {
    id: "turnovers", label: "Turnovers", sides: ["given", "forced"], dp: 1,
    off: { get: (c, g) => per(stat(c, "miscellaneous", "totalGiveaways"), g), high: false },
    // What opponents gave away against this defense -- its takeaways.
    def: { get: (c, g) => per(stat(c, "miscellaneous", "totalGiveaways"), g), high: true },
  },
  {
    id: "sacks", label: "Sacks", sides: ["allowed", "made"], dp: 1,
    off: { get: (c, g) => per(stat(c, "passing", "sacks"), g), high: false },
    // Opponents' quarterbacks sacked -- this defense's sacks.
    def: { get: (c, g) => per(stat(c, "passing", "sacks"), g), high: true },
  },
];

function readCache(season) {
  const hit = memory.get(season);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.data;
  try {
    const raw = sessionStorage.getItem(cacheKey(season));
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (Date.now() - rec.fetchedAt >= TTL_MS) return null;
    memory.set(season, rec);
    return rec.data;
  } catch {
    return null;
  }
}

function writeCache(season, data) {
  const rec = { fetchedAt: Date.now(), data };
  memory.set(season, rec);
  try { sessionStorage.setItem(cacheKey(season), JSON.stringify(rec)); } catch {}
}

// { season, teamsLoaded, teamsTotal, teams: { ABBR: { games, off: { rowId:
// { value, rank, of, tied } }, def: {...} } } }, or null when nothing answered.
// A team that fails to load is absent -- ranked out of fewer, and "of N" says
// so -- never filled in.
export async function fetchNflTeamRankings(season) {
  const cached = readCache(season);
  if (cached) return cached;

  const entries = Object.entries(TEAM_ESPN_IDS.nfl || {});
  const loaded = await Promise.all(entries.map(async ([abbr, id]) => {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/statistics?season=${season}`);
      if (!res.ok) return null;
      const d = await res.json();
      const off = d?.results?.stats?.categories;
      const def = d?.results?.opponent;
      const games = stat(off, "general", "gamesPlayed");
      if (!off || !def || !games) return null;
      return { abbr: ourAbbr(abbr), off, def, games };
    } catch {
      return null;
    }
  }));
  const teams = loaded.filter(Boolean);
  if (!teams.length) return null;

  const out = { season, teamsLoaded: teams.length, teamsTotal: entries.length, teams: {} };
  teams.forEach((t) => { out.teams[t.abbr] = { games: t.games, off: {}, def: {} }; });

  NFL_TEAM_RANK_ROWS.forEach((row) => {
    ["off", "def"].forEach((side) => {
      const spec = row[side];
      const vals = teams
        .map((t) => ({ abbr: t.abbr, v: spec.get(t[side], t.games) }))
        .filter((x) => Number.isFinite(x.v));
      vals.sort((a, b) => (spec.high ? b.v - a.v : a.v - b.v));
      // Equal numbers share a rank (1, 2, 2, 4), and say that they do.
      vals.forEach((x) => {
        const first = vals.findIndex((y) => y.v === x.v);
        const tied = vals.filter((y) => y.v === x.v).length > 1;
        out.teams[x.abbr][side][row.id] = { value: x.v, rank: first + 1, of: vals.length, tied };
      });
    });
  });

  // A short set is shown (as "of N") but not kept: the next visit retries the
  // teams that failed rather than inheriting a network blip for six hours.
  if (teams.length === entries.length) writeCache(season, out);
  return out;
}
