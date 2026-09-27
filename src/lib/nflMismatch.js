import { TEAM_ESPN_IDS, fetchTeamRoster } from "./rosters.js";
import { fetchNflTeamRankings, nflSeasonNow } from "./nflTeamStats.js";
import { fetchNflStarters } from "./nflDepth.js";
import { fetchNflCurrentWeekSlate } from "./gamesData.js";

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

// This season is more predictive of the roster on the field now; last season
// is a bigger sample as a sanity check against small early splits. The split
// itself is a chosen weighting, not a measured one -- open to revision.
const CURRENT_WEIGHT = 0.6;
const PRIOR_WEIGHT = 0.4;

// slot -> nflDepth.js's RAIL_SLOTS key, the def-rank row it's judged against,
// and how many of the depth chart's ranked list actually start (the offensive
// formation's own count for WR/TE, one apiece otherwise).
const SLOTS = [
  { slot: "qb", pos: "QB", rowId: "passYds", count: () => 1 },
  { slot: "rb", pos: "RB", rowId: "rushYds", count: () => 1 },
  { slot: "wr", pos: "WR", rowId: "passYds", count: (depth) => depth.wrStart || 3 },
  { slot: "te", pos: "TE", rowId: "passYds", count: (depth) => depth.teStart || 1 },
];

const toEspnAbbr = (abbr) => (abbr === "WAS" ? "WSH" : abbr);

// 1 = the softest defense that answered on this stat this season, 0 = the
// toughest. Turns "#28 of 32" into something averageable with another season
// that may have answered with a different N.
function softness(defCell) {
  if (!defCell || !defCell.of || defCell.of < 2) return null;
  return (defCell.rank - 1) / (defCell.of - 1);
}

function blendedSoftness(currentTeam, priorTeam, rowId) {
  const cur = currentTeam ? softness(currentTeam.def[rowId]) : null;
  const prior = priorTeam ? softness(priorTeam.def[rowId]) : null;
  if (cur == null && prior == null) return null;
  if (cur == null) return prior;
  if (prior == null) return cur;
  return cur * CURRENT_WEIGHT + prior * PRIOR_WEIGHT;
}

// Thresholds on the blended 0-1 softness score. Chosen to read the same way
// the tiers already do elsewhere in the app (a top slice, a middle slice, a
// long tail that isn't worth a card) -- not derived from any distribution.
function tierFor(score) {
  if (score == null) return null;
  if (score >= 0.8) return "SMASH";
  if (score >= 0.6) return "FAV";
  if (score >= 0.4) return "LEAN";
  return null;
}

// { games, cards, ready, teamsLoaded, teamsTotal, season }. `cards` is empty
// and `ready` is false when any of the four real sources didn't answer -- the
// caller shows "couldn't load this week's report" rather than a partial one
// silently missing whichever source failed.
export async function fetchNflWeeklyMismatches() {
  const season = nflSeasonNow();
  const [slate, currentStats, priorStats, starters] = await Promise.all([
    fetchNflCurrentWeekSlate(),
    fetchNflTeamRankings(season),
    fetchNflTeamRankings(season - 1),
    fetchNflStarters(season),
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

      SLOTS.forEach(({ slot, pos, rowId, count }) => {
        const ids = depth[slot] || [];
        const score = blendedSoftness(currentStats.teams[defAbbr], priorStats?.teams?.[defAbbr], rowId);
        const tier = tierFor(score);
        if (!tier) return;
        ids.slice(0, count(depth)).forEach((espnId) => {
          const player = playersById.get(espnId);
          if (!player) return; // on the depth chart but not on the roster fetch -- dropped, not filled in
          cards.push({
            id: `${game.id}-${player.espnId}`,
            player,
            status: byId[espnId],
            pos,
            team: offAbbr,
            opp: defAbbr,
            game,
            rowId,
            defCurrent: currentStats.teams[defAbbr]?.def?.[rowId] || null,
            defPrior: priorStats?.teams?.[defAbbr]?.def?.[rowId] || null,
            score,
            tier,
          });
        });
      });
    }
  }

  cards.sort((a, b) => b.score - a.score);
  return {
    games: slate.games,
    cards,
    ready: true,
    teamsLoaded: currentStats.teamsLoaded,
    teamsTotal: currentStats.teamsTotal,
    season,
  };
}
