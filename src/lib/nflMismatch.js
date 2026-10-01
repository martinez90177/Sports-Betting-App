import { TEAM_ESPN_IDS, fetchTeamRoster } from "./rosters.js";
import { fetchNflTeamRankings, nflSeasonNow } from "./nflTeamStats.js";
import { fetchNflStarters } from "./nflDepth.js";
import { fetchNflCurrentWeekSlate } from "./gamesData.js";
import { fetchNflAllowed, positionRanks, leagueAverage as posLeagueAverage, GROUP, STATS } from "./nflAllowed.js";

// --------------------------------------------------------------------------
// The weekly mismatch report -- which real starters face the softest real
// defenses this week, for NFL.
// --------------------------------------------------------------------------
// Nothing here is fetched, computed or invented for this feature alone.
// Every input already exists in the app for another surface:
//
//   - this week's real games       fetchNflCurrentWeekSlate  (Games/Board)
//   - real team defense ranks      fetchNflTeamRankings      (Matchup page)
//   - real current starters        fetchNflStarters          (the prop feed's
//                                                              Brosmer filter)
//   - real availability            fetchTeamRoster().byId    (Injuries page)
//
// This module only blends and sorts those four real answers. There is no
// per-position "fantasy points allowed" feed for the NFL the way MLB has a
// pitching/hitting split -- ESPN's team statistics endpoint only splits by
// pass/rush, not by opposing position -- so the label says exactly that:
// a WR/TE matchup is read off the team's *pass* defense rank, not a
// WR-specific one, the same way MLB's RBI badge says "opp runs allowed / 9"
// instead of implying a stat that was never measured.

// Which market the measured defensive stat actually speaks to, position by
// position -- the same headline-market call the prop feed's own roster rail
// already makes (NFL_RAIL_MARKET_BY_POS in PropLedger.jsx): yardage for a
// pass-catcher rather than receptions, because yardage is what a yards-allowed
// defensive rank predicts and receptions is a separate, unmeasured thing.
export const MARKET_LABEL = { QB: "Pass Yds", RB: "Rush Yds", WR: "Rec Yds", TE: "Rec Yds" };
// Same market, as PropLedger's own NFL_MARKETS ids -- what goToProp/the feed
// filter actually need, as opposed to MARKET_LABEL's display text.
export const MARKET_ID = { QB: "passYds", RB: "rushYds", WR: "recYds", TE: "recYds" };

// Every market the report grades, the positions that can be bet in it (from
// PropLedger's NFL_MARKETS), and the defensive row each position is judged
// against. The row is the number that market actually lives on -- catches
// allowed for receptions, touchdowns allowed for anytime TD -- never a yards
// rank standing in for a touchdown one. Where no position-specific split
// exists, the label on the card says which team number was used.
//
// Anytime TD splits by how the position scores: a receiver's touchdown is a
// passing touchdown allowed, a back's or quarterback's is a rushing one.
//
// `stat` is the same market read position by position from the box scores
// (lib/nflAllowed.js): what this defense has allowed to players at *this*
// card's position. It decides the grade whenever the box scores answered;
// `row`, the team-wide number, is the fallback when they didn't, and the card
// says which one it used. A quarterback's anytime TD is his rushing TDs only.
export const MARKETS = [
  { id: "passYds", label: "Pass Yds", positions: ["QB"], row: () => "passYds", stat: () => "passYds" },
  { id: "passRushYds", label: "Pass + Rush Yds", positions: ["QB"], row: () => "yards", stat: () => "passRushYds" },
  { id: "passTd", label: "Pass TD", positions: ["QB"], row: () => "passTd", stat: () => "passTd" },
  { id: "rushYds", label: "Rush Yds", positions: ["QB", "RB"], row: () => "rushYds", stat: () => "rushYds" },
  { id: "scrim", label: "Rush + Rec Yds", positions: ["RB", "WR"], row: () => "yards", stat: () => "scrim" },
  { id: "recYds", label: "Rec Yds", positions: ["RB", "WR", "TE"], row: () => "passYds", stat: () => "recYds" },
  { id: "rec", label: "Receptions", positions: ["RB", "WR", "TE"], row: () => "completions", stat: () => "rec" },
  { id: "anytimeTd", label: "Anytime TD", positions: ["QB", "RB", "WR", "TE"], row: (pos) => (pos === "WR" || pos === "TE" ? "passTd" : "rushTd"), stat: (pos) => (pos === "QB" ? "rushTd" : "anyTd") },
];

// slot -> nflDepth.js's RAIL_SLOTS key, and how many of the depth chart's
// ranked list actually start (the offensive formation's own count for WR/TE,
// one apiece otherwise).
const SLOTS = [
  { slot: "qb", pos: "QB", count: () => 1 },
  { slot: "rb", pos: "RB", count: () => 1 },
  { slot: "wr", pos: "WR", count: (depth) => depth.wrStart || 3 },
  { slot: "te", pos: "TE", count: (depth) => depth.teStart || 1 },
];

const toEspnAbbr = (abbr) => (abbr === "WAS" ? "WSH" : abbr);

// 1 = the softest defense that answered on this stat this season, 0 = the
// toughest. Turns "#28 of 32" into something averageable with another season
// that may have answered with a different N.
function softness(defCell) {
  if (!defCell || !defCell.of || defCell.of < 2) return null;
  return (defCell.rank - 1) / (defCell.of - 1);
}

// Graded on this season alone. It was a 60/40 blend with last season, which
// let a defense's 2025 reputation outvote what it is doing now: the Chargers,
// 28th against the pass through three games of 2026, read as a LEAN because
// they were 5th in 2025. Alex, 2026-09-27: "the chargers have been horrible
// this year." Last season is still on every card, as context beside the
// number that decides the tier, not inside it. Before Week 1, when this season
// has no rank at all, last season is the only answer and is used.
function matchupSoftness(currentTeam, priorTeam, rowId) {
  const cur = currentTeam ? softness(currentTeam.def[rowId]) : null;
  if (cur != null) return cur;
  return priorTeam ? softness(priorTeam.def[rowId]) : null;
}

// Mean per-game value across every team that answered -- what "soft" is
// measured against in the card's own sentence.
function leagueAverage(stats, rowId) {
  const vals = Object.values(stats?.teams || {})
    .map((t) => t.def?.[rowId]?.value)
    .filter(Number.isFinite);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// Thresholds on the 0-1 softness score. Chosen to read the same way
// the tiers already do elsewhere in the app (a top slice, a middle slice, a
// long tail that isn't worth a card) -- not derived from any distribution.
// Below LEAN is TOUGH rather than absent: the page hides those by default,
// but a reader searching for one player needs to be told his matchup graded
// tough, not left wondering whether he was checked at all.
function tierFor(score) {
  if (score == null) return null;
  if (score >= 0.8) return "SMASH";
  if (score >= 0.6) return "FAV";
  if (score >= 0.4) return "LEAN";
  return "TOUGH";
}

const DEF_ROWS = ["passYds", "rushYds", "yards", "completions", "passTd", "rushTd"];

// { games, cards, ready, teamsLoaded, teamsTotal, season }. `cards` is empty
// and `ready` is false when any of the four real sources didn't answer -- the
// caller shows "couldn't load this week's report" rather than a partial one
// silently missing whichever source failed.
export async function fetchNflWeeklyMismatches() {
  const season = nflSeasonNow();
  const [slate, currentStats, priorStats, starters, allowed, allowedPrior] = await Promise.all([
    fetchNflCurrentWeekSlate(),
    fetchNflTeamRankings(season),
    fetchNflTeamRankings(season - 1),
    fetchNflStarters(season),
    fetchNflAllowed(season),
    fetchNflAllowed(season - 1, { timeoutMs: 6000 }),
  ]);

  if (!slate?.games?.length || !currentStats || !starters) {
    return { games: [], cards: [], ready: false, season };
  }

  const rosterPromises = new Map();
  const rosterFor = (abbr) => {
    if (!rosterPromises.has(abbr)) {
      const espnId = TEAM_ESPN_IDS.nfl[toEspnAbbr(abbr)];
      rosterPromises.set(abbr, fetchTeamRoster("nfl", abbr, espnId));
    }
    return rosterPromises.get(abbr);
  };

  const cards = [];
  const leagueAvg = Object.fromEntries(DEF_ROWS.map((r) => [r, leagueAverage(currentStats, r)]));
  const leagueAvgPrior = Object.fromEntries(DEF_ROWS.map((r) => [r, leagueAverage(priorStats, r)]));

  for (const game of slate.games) {
    const sides = [
      { team: game.home, opp: game.away },
      { team: game.away, opp: game.home },
    ];
    for (const side of sides) {
      const offAbbr = side.team.abbr;
      const defAbbr = side.opp.abbr;
      const depth = starters.depth[toEspnAbbr(offAbbr)];
      if (!depth) continue; // that team's depth chart didn't load -- leave it alone, don't guess starters

      const roster = await rosterFor(offAbbr);
      if (!roster) continue; // same rule: no real roster, no cards for this team
      const playersById = new Map(roster.players.map((p) => [p.espnId, p]));
      const byId = roster.byId || {};

      SLOTS.forEach(({ slot, pos, count }) => {
        const ids = depth[slot] || [];
        ids.slice(0, count(depth)).forEach((espnId, slotIndex) => {
          const player = playersById.get(espnId);
          if (!player) return; // on the depth chart but not on the roster fetch -- dropped, not filled in
          MARKETS.forEach((m) => {
            if (!m.positions.includes(pos)) return;
            const rowId = m.row(pos);
            const grp = GROUP[pos];
            const stat = m.stat(pos);
            const posCur = positionRanks(allowed, grp, stat)?.[defAbbr] || null;
            // Before this season's first game there is no position table yet;
            // last season's full sample stands in, the same rule as the team rows.
            const posPrior = positionRanks(allowedPrior, grp, stat)?.[defAbbr] || null;
            const byPosition = !!(posCur || (!allowed && posPrior));
            const score = byPosition
              ? softness(posCur || posPrior)
              : matchupSoftness(currentStats.teams[defAbbr], priorStats?.teams?.[defAbbr], rowId);
            const tier = tierFor(score);
            if (!tier) return; // defense unranked on this row -- no grade to give
            const position = byPosition ? {
              basis: "position",
              defLabel: `${STATS[stat].label} allowed to ${grp}s`,
              defCurrent: posCur,
              defPrior: posPrior,
              defGames: posCur?.games ?? null,
              leagueAvg: posLeagueAverage(allowed, grp, stat),
              leagueAvgPrior: posLeagueAverage(allowedPrior, grp, stat),
            } : { basis: "team" };
            cards.push({
              id: `${game.id}-${player.espnId}-${m.id}`,
              player,
              status: byId[espnId],
              pos,
              market: m.label,
              marketId: m.id,
              headline: MARKET_ID[pos] === m.id,
              team: offAbbr,
              opp: defAbbr,
              game,
              rowId,
              defCurrent: currentStats.teams[defAbbr]?.def?.[rowId] || null,
              defPrior: priorStats?.teams?.[defAbbr]?.def?.[rowId] || null,
              defGames: currentStats.teams[defAbbr]?.games ?? null,
              leagueAvg: leagueAvg[rowId],
              leagueAvgPrior: leagueAvgPrior[rowId],
              score,
              tier,
              grp,
              stat,
              // 1 = the depth chart's first at his position (WR1, TE1).
              slot: slotIndex + 1,
              ...position,
            });
          });
        });
      });
    }
  }

  cards.sort((a, b) => b.score - a.score);

  // Every defense on this week's slate, both rows, this season and last -- so
  // the page can judge "softest overall" from the ranks themselves rather than
  // from however many cards a defense happened to generate.
  const defenses = {};
  slate.games.forEach((g) => {
    [g.home.abbr, g.away.abbr].forEach((abbr) => {
      const cur = currentStats.teams[abbr];
      if (!cur) return;
      defenses[abbr] = {
        passYds: cur.def.passYds || null,
        rushYds: cur.def.rushYds || null,
        passYdsPrior: priorStats?.teams?.[abbr]?.def?.passYds || null,
        rushYdsPrior: priorStats?.teams?.[abbr]?.def?.rushYds || null,
        softness: [softness(cur.def.passYds), softness(cur.def.rushYds)].filter((x) => x != null),
      };
    });
  });

  return {
    games: slate.games,
    cards,
    defenses,
    allowed,
    allowedPrior,
    ready: true,
    teamsLoaded: currentStats.teamsLoaded,
    teamsTotal: currentStats.teamsTotal,
    season,
  };
}
