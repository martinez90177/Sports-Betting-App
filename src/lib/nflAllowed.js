// What each NFL defense has allowed to each position -- read from the box
// scores /api/nfl-allowed serves (see api/_nflAllowed.js).
//
// Three questions, all answered from the same lines:
//
//   rank      where a defense sits among the 32 on one stat to one position
//             ("TE rec yds allowed / game: 31st of 32") -- what the Mismatches
//             page grades on.
//   allowed   who, game by game, actually put up that stat against it
//             ("TEs vs PIT: Gesicki 37, Henry 40, Pitts 0").
//   slot      what the defense gave the offense's top player at a position
//             in each game -- its WR1, TE1, RB1 -- so a defense can be read
//             against the same line a player is being bet at.
//
// Rank 32 is the most allowed, the softest, matching nflTeamStats and the
// Mismatches page's softness score. Every number here is a sum of box-score
// lines; nothing is estimated.

const cache = new Map();

// ESPN writes Washington WSH; the app's slate writes WAS.
export const espnAbbr = (a) => (a === "WAS" ? "WSH" : a);
export const appAbbr = (a) => (a === "WSH" ? "WAS" : a);

// Fullbacks count with the backs: a fullback's catch out of the backfield is
// what "receptions allowed to RBs" is asking about.
export const GROUP = { QB: "QB", RB: "RB", FB: "RB", WR: "WR", TE: "TE" };

const sum2 = (a, b) => (a ?? 0) + (b ?? 0);

// Per-player values, read off one box-score line. `max` stats take the best
// single line in the game rather than the sum -- a longest reception allowed
// is one play, not five added together.
export const STATS = {
  passYds: { label: "pass yds", value: (l) => l.p?.[1] ? l.p[2] : null },
  passTd: { label: "pass TDs", value: (l) => l.p?.[1] ? l.p[3] : null },
  cmp: { label: "completions", value: (l) => l.p?.[1] ? l.p[0] : null },
  passRushYds: { label: "pass + rush yds", value: (l) => (l.p?.[1] || l.r?.[0] ? sum2(l.p?.[2], l.r?.[1]) : null) },
  rushYds: { label: "rush yds", value: (l) => l.r ? l.r[1] : null },
  rushAtt: { label: "carries", value: (l) => l.r ? l.r[0] : null },
  rushTd: { label: "rush TDs", value: (l) => l.r ? l.r[2] : null },
  recYds: { label: "rec yds", value: (l) => l.c ? l.c[1] : null },
  rec: { label: "receptions", value: (l) => l.c ? l.c[0] : null },
  tgt: { label: "targets", value: (l) => l.c ? l.c[4] : null },
  recTd: { label: "rec TDs", value: (l) => l.c ? l.c[2] : null },
  longRec: { label: "longest rec", value: (l) => l.c ? l.c[3] : null, max: true },
  scrim: { label: "rush + rec yds", value: (l) => (l.r || l.c ? sum2(l.r?.[1], l.c?.[1]) : null) },
  anyTd: { label: "TDs", value: (l) => (l.r || l.c ? sum2(l.r?.[2], l.c?.[2]) : null) },
};

// Who a game's "1" at a position is: most targets for pass-catchers, most
// touches for backs, most attempts for quarterbacks. Yards break ties.
const SLOT_KEY = {
  QB: (l) => (l.p?.[1] || 0) * 1000 + (l.p?.[2] || 0),
  RB: (l) => ((l.r?.[0] || 0) + (l.c?.[4] || 0)) * 1000 + (l.r?.[1] || 0) + (l.c?.[1] || 0),
  WR: (l) => (l.c?.[4] || 0) * 1000 + (l.c?.[1] || 0),
  TE: (l) => (l.c?.[4] || 0) * 1000 + (l.c?.[1] || 0),
};

// `timeoutMs` lets a caller stop waiting: last season is context only, and
// the page must not sit on "Reading…" while a cold server build finishes. A
// partial build (the server ran out of time mid-season) is treated as no
// answer -- ranking 32 defenses on half their games would mislead.
export async function fetchNflAllowed(season, { timeoutMs } = {}) {
  if (cache.has(season)) return cache.get(season);
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = timeoutMs && ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  const p = fetch(`/api/nfl-allowed?season=${season}`, ctrl ? { signal: ctrl.signal } : undefined)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d && !d.partial && Array.isArray(d.games) && d.games.length ? index(d) : null))
    .catch(() => null)
    .finally(() => { if (timer) clearTimeout(timer); });
  cache.set(season, p);
  const out = await p;
  if (!out) cache.delete(season); // a failure is retried next visit, not remembered
  return out;
}

// defense (app abbr) -> [{ game, wk, date, offense, lines: [line] }] where
// `lines` are the offense's players in that game.
function index(data) {
  const byDef = {};
  data.games.forEach((g) => {
    if (!g.L) return;
    [[g.h, g.a], [g.a, g.h]].forEach(([def, off]) => {
      const d = appAbbr(def);
      (byDef[d] = byDef[d] || []).push({
        id: g.id,
        wk: g.wk,
        date: g.d,
        offense: appAbbr(off),
        home: def === g.h,
        lines: g.L.filter((l) => l.t === off),
      });
    });
  });
  Object.values(byDef).forEach((list) => list.sort((a, b) => a.wk - b.wk));
  return { season: data.season, builtAt: data.builtAt, weeks: data.weeks, unknownPos: data.unknownPos || 0, byDef, rankCache: new Map() };
}

const inGroup = (l, grp) => GROUP[l.pos] === grp;

// One game's total (or best, for `max` stats) to one position group.
function gameValue(game, grp, stat) {
  const s = STATS[stat];
  const vals = game.lines.filter((l) => inGroup(l, grp)).map(s.value).filter((v) => v != null);
  if (!vals.length) return 0;
  return s.max ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0);
}

// { DEF: { rank, of, value (per game), games } } for one position and stat.
export function positionRanks(idx, grp, stat) {
  if (!idx) return null;
  const key = `${grp}:${stat}`;
  if (idx.rankCache.has(key)) return idx.rankCache.get(key);
  const rows = Object.entries(idx.byDef).map(([abbr, games]) => {
    const total = games.reduce((a, g) => a + gameValue(g, grp, stat), 0);
    return { abbr, value: games.length ? total / games.length : null, games: games.length };
  }).filter((r) => r.value != null);
  // Fewer than 24 measured defenses cannot honestly be ranked "of 32".
  const out = {};
  if (rows.length >= 24) {
    rows.forEach((r) => {
      const below = rows.filter((o) => o.value < r.value - 1e-9).length;
      const same = rows.filter((o) => Math.abs(o.value - r.value) <= 1e-9).length;
      // Ties share the higher rank, so two defenses tied for the most allowed
      // both read 32nd (T32nd) rather than 31st.
      out[r.abbr] = {
        rank: below + same, of: rows.length, value: r.value, games: r.games,
        tied: same > 1, last: below + same === rows.length,
      };
    });
  }
  idx.rankCache.set(key, rows.length >= 24 ? out : null);
  return idx.rankCache.get(key);
}

export function leagueAverage(idx, grp, stat) {
  const t = positionRanks(idx, grp, stat);
  if (!t) return null;
  const v = Object.values(t).map((r) => r.value);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// Every player at one position who faced this defense, game by game, with
// what he put up in the stat -- sorted within each game, best first. A
// player who was targeted or handed the ball and got nothing is listed at 0;
// one who was never involved (a blocking TE with no target) is not listed,
// though the game's total already counted him as the zero he was.
const touched = (l) => (l.c?.[4] || 0) + (l.c?.[0] || 0) + (l.r?.[0] || 0) + (l.p?.[1] || 0) > 0;
export function allowedTo(idx, def, grp, stat) {
  const games = idx?.byDef?.[def];
  if (!games) return null;
  const s = STATS[stat];
  return games.map((g) => ({
    wk: g.wk,
    offense: g.offense,
    home: g.home,
    total: gameValue(g, grp, stat),
    players: g.lines
      .filter((l) => inGroup(l, grp) && touched(l))
      .map((l) => ({ id: l.id, name: l.n, value: s.value(l) ?? 0 }))
      .sort((a, b) => b.value - a.value),
  }));
}

// What the offense's `slot`-th player at a position (1 = the top target or
// touch-getter that game) did against this defense, game by game.
export function slotValues(idx, def, grp, slot, stat) {
  const games = idx?.byDef?.[def];
  if (!games) return null;
  const s = STATS[stat];
  const key = SLOT_KEY[grp];
  return games.map((g) => {
    const ranked = g.lines.filter((l) => inGroup(l, grp) && key(l) > 0).sort((a, b) => key(b) - key(a));
    const l = ranked[slot - 1];
    return { wk: g.wk, offense: g.offense, name: l?.n || null, value: l ? (s.value(l) ?? 0) : null };
  }).filter((r) => r.value != null);
}
