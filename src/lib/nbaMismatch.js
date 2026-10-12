// NBA defence by position, measured off the box-score lines the app already
// holds -- no model and no projection.
//
// For every rotation player, each game is compared with that player's own
// average for the season: a defence's number is how far above or below their
// own norm the guards (or forwards, or centres) who faced it finished. Judging
// against the player's own average, rather than totalling what a team
// "allowed", is what keeps the table honest about coverage -- a player who is no
// longer on a roster, and so missing from the pool, does not tilt one team's
// number and not another's.
//
// Rank 1 is the toughest defence (smallest delta) and rank N the softest, the
// same direction every other rank in the app uses.

export const NBA_GROUPS = [
  { id: "G", label: "Guards", short: "G" },
  { id: "F", label: "Forwards", short: "F" },
  { id: "C", label: "Centres", short: "C" },
];

// id, label, the market id the feed knows it by, the per-game reader, and two
// floors: `gap` is the least a defence must sit above the norm to be called
// soft at all (a rank of 25th on +0.1 threes is a tie, not a mismatch), and
// `floor` is the least a player must average to be worth naming against it.
export const NBA_MISMATCH_STATS = [
  { id: "pts", label: "Points", market: "pts", gap: 0.5, floor: 10, get: (g) => g.pts },
  { id: "reb", label: "Rebounds", market: "reb", gap: 0.3, floor: 4, get: (g) => (g.oreb || 0) + (g.dreb || 0) },
  { id: "ast", label: "Assists", market: "ast", gap: 0.3, floor: 2.5, get: (g) => g.ast },
  { id: "fg3m", label: "3-pointers", market: "3pm", gap: 0.15, floor: 1.2, get: (g) => g.fg3m },
  { id: "pra", label: "Pts + Reb + Ast", market: "pra", gap: 0.9, floor: 18, get: (g) => g.pts + (g.oreb || 0) + (g.dreb || 0) + g.ast },
];

const GROUP_OF_POS = { PG: "G", SG: "G", G: "G", SF: "F", PF: "F", F: "F", GF: "F", FC: "C", C: "C" };
export function groupOf(pos) {
  return GROUP_OF_POS[String(pos || "").toUpperCase()] || null;
}

const MIN_GAMES = 20;      // a player's season has to be a season
const MIN_MINUTES = 15;    // rotation, not garbage time
const MIN_SAMPLE = 40;     // player-games behind one rank
const SOFT_FROM_BOTTOM = 8; // 22nd of 30 or worse, as on the NFL page
const TEAMS_NEEDED = 28;
const GAMES_NEEDED = 10;

const regular = (g) => g.seasonType !== "post";

// Which season the ranks are drawn from. The new season's once nearly every
// team has played ten games of it; until then last season's, and the page says
// so. Never a blend.
export function pickDefenseSeason(players, currentSeason) {
  const perTeam = {};
  players.forEach((p) => (p.games || []).forEach((g) => {
    if (g.season !== currentSeason || !regular(g)) return;
    (perTeam[g.opp] = perTeam[g.opp] || new Set()).add(g.date);
  }));
  const ready = Object.values(perTeam).filter((s) => s.size >= GAMES_NEEDED).length;
  return ready >= TEAMS_NEEDED
    ? { season: currentSeason, isCurrent: true }
    : { season: currentSeason - 1, isCurrent: false };
}

export function buildNbaDefense(players, season) {
  const acc = {};
  let playerGames = 0;
  let used = 0;
  players.forEach((p) => {
    const grp = groupOf(p.pos);
    const games = (p.games || []).filter((g) => g.season === season && regular(g) && g.minutes >= 1);
    if (!grp || games.length < MIN_GAMES) return;
    const avgMin = games.reduce((a, g) => a + g.minutes, 0) / games.length;
    if (avgMin < MIN_MINUTES) return;
    used += 1;
    NBA_MISMATCH_STATS.forEach((s) => {
      const base = games.reduce((a, g) => a + s.get(g), 0) / games.length;
      games.forEach((g) => {
        const cell = ((acc[g.opp] = acc[g.opp] || {})[grp] = acc[g.opp][grp] || {});
        const c = (cell[s.id] = cell[s.id] || { sum: 0, n: 0 });
        c.sum += s.get(g) - base;
        c.n += 1;
      });
    });
    playerGames += games.length;
  });

  // ranks[team][group][stat] = { rank, of, delta, n }
  const ranks = {};
  NBA_GROUPS.forEach((grp) => NBA_MISMATCH_STATS.forEach((s) => {
    const list = Object.entries(acc)
      .map(([team, byGrp]) => ({ team, c: byGrp[grp.id]?.[s.id] }))
      .filter((x) => x.c && x.c.n >= MIN_SAMPLE)
      .map((x) => ({ team: x.team, delta: x.c.sum / x.c.n, n: x.c.n }))
      .sort((a, b) => a.delta - b.delta);
    list.forEach((x, i) => {
      ((ranks[x.team] = ranks[x.team] || {})[grp.id] = ranks[x.team][grp.id] || {})[s.id] =
        { rank: i + 1, of: list.length, delta: x.delta, n: x.n };
    });
  }));
  return { ranks, season, playerGames, players: used };
}

// A defence's softest spots: position + stat pairs ranked in the bottom eight.
export function softSpots(defense, team, limit = 4) {
  const out = [];
  NBA_GROUPS.forEach((grp) => NBA_MISMATCH_STATS.forEach((s) => {
    const r = defense.ranks[team]?.[grp.id]?.[s.id];
    if (r && r.rank > r.of - SOFT_FROM_BOTTOM && r.delta >= s.gap) out.push({ group: grp, stat: s, ...r });
  }));
  // Rank first, then how far the number actually sits from the norm.
  return out.sort((a, b) => (b.rank - a.rank) || (b.delta - a.delta)).slice(0, limit);
}

// The attacking team's players to look at against those spots: his own position
// group, rotation minutes, not listed out, ordered by what he averages in that
// stat this (ranked) season.
export function playersToLook(players, team, spots, season, statusFor, perSpot = 2, cap = 3) {
  const taken = new Set();
  const picks = [];
  spots.forEach((spot) => {
    const pool = players
      .filter((p) => p.team === team && groupOf(p.pos) === spot.group.id && !taken.has(p.id))
      .map((p) => {
        const games = (p.games || []).filter((g) => g.season === season && regular(g) && g.minutes >= 1);
        if (games.length < MIN_GAMES) return null;
        const min = games.reduce((a, g) => a + g.minutes, 0) / games.length;
        if (min < 20) return null;
        const status = statusFor ? statusFor(p.espnId) : undefined;
        if (status === "out") return null;
        const vals = games.map((g) => spot.stat.get(g));
        const avg = vals.reduce((a, v) => a + v, 0) / vals.length;
        if (avg < spot.stat.floor) return null;
        const last = vals.slice(-10);
        return { player: p, spot, status, games: games.length, avg, l10: last.reduce((a, v) => a + v, 0) / last.length };
      })
      .filter(Boolean)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, perSpot);
    pool.forEach((x) => {
      if (picks.length >= cap || taken.has(x.player.id)) return;
      taken.add(x.player.id);
      picks.push(x);
    });
  });
  return picks;
}
