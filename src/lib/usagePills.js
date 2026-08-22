import { statcastFor, statcastTeamRank, ordinal } from "./statcast.js";

// The player header's usage pills, and the sentence under them.
//
// Each sport's own mock names its own pills, and they are not one list with
// different numbers -- what tells you whether a role supports a prop differs
// by sport. Taken from the four files rather than invented:
//
//   MLB   Bats · PA/g · Hard-hit · Barrel      (Player Detail MLB v2)
//   NFL   Snaps · Routes · Target share · aDOT (Player Detail NFL v2)
//   NBA   Minutes · Usage · Shots/g · FT rate  (Player Detail NBA v2)
//   WNBA  Minutes · Usage · Shots/g · FT rate  (Player Detail WNBA v2)
//
// Every value here is derived from the same scoped game log the chart draws,
// or from Statcast (see statcast.js). Nothing is invented: a pill whose input
// is missing is not returned, so the row shortens rather than showing a blank.

const avg = (games, pick) => {
  const vals = (games || []).map(pick).filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

const pct = (v, dp = 1) => (v == null ? null : `${v.toFixed(dp)}%`);
const one = (v) => (v == null ? null : v.toFixed(1));

// A pill only exists if it has a value.
const pill = (label, value, note) => (value == null || value === "" ? null : { label, value, note });

// ---------------------------------------------------------------------------
// MLB
// ---------------------------------------------------------------------------
function mlbBatterPills({ games, battingOrder, mlbId, teammateIds }) {
  const sc = statcastFor(mlbId, "batter");
  const hardRank = statcastTeamRank(mlbId, teammateIds, "hard_hit_percent", "batter");
  return [
    pill("Bats", battingOrder ? `${battingOrder}` : null),
    pill("PA/g", one(avg(games, (g) => g.pa))),
    pill("Hard-hit", pct(sc?.hard_hit_percent), hardRank ? `${ordinal(hardRank.rank)} on team` : null),
    pill("Barrel", pct(sc?.barrel_batted_rate)),
    pill("K%", pct(sc?.k_percent)),
  ].filter(Boolean);
}

function mlbPitcherPills({ games, mlbId }) {
  const sc = statcastFor(mlbId, "pitcher");
  // Outs are what the log stores; innings are what a pitcher is read in.
  const ip = avg(games, (g) => (Number.isFinite(g.outs) ? g.outs / 3 : null));
  return [
    pill("IP/start", one(ip)),
    pill("K%", pct(sc?.k_percent)),
    pill("Whiff", pct(sc?.whiff_percent)),
    pill("Hard-hit", pct(sc?.hard_hit_percent)),
    pill("Barrel", pct(sc?.barrel_batted_rate)),
  ].filter(Boolean);
}

// ---------------------------------------------------------------------------
// NBA / WNBA -- the mock's own four: Minutes, Usage, Shots/g, FT rate.
//
// Usage rate needs team totals (USG% is a share of team possessions while on
// the floor) and the app has no team-level box score, so that pill is returned
// only if a caller supplies it and is otherwise absent. The other three come
// straight from the scoped log.
// ---------------------------------------------------------------------------
function hoopsPills({ games, usageRate }) {
  const fga = avg(games, (g) => g.fga);
  const fta = avg(games, (g) => g.fta);
  return [
    pill('Minutes', one(avg(games, (g) => g.minutes))),
    pill('Usage', pct(usageRate)),
    pill('Shots/g', one(fga)),
    // FT rate is the conventional FTA/FGA, not free throws per game.
    pill('FT rate', fga ? (fta / fga).toFixed(2) : null),
  ].filter(Boolean);
}

// ---------------------------------------------------------------------------
// NFL -- the mock's own four: Snaps, Routes, Target share, aDOT.
//
// Only snap share is in the logs this app reads. Routes run, target share and
// average depth of target are charting data (PFF/NextGen) behind no feed here,
// so those three pills do not render rather than being approximated -- a
// target share guessed from receptions would be a number nobody measured.
// ---------------------------------------------------------------------------
function nflPills({ games, routePct, targetShare, adot }) {
  return [
    pill('Snaps', pct(avg(games, (g) => g.snapPct), 0)),
    pill('Routes', pct(routePct, 0)),
    pill('Target share', pct(targetShare, 0)),
    pill('aDOT', one(adot)),
  ].filter(Boolean);
}

export function usagePills({ sport, market, games, isPitcher, battingOrder, mlbId, teammateIds, usageRate, routePct, targetShare, adot }) {
  if (sport === "mlb") {
    return isPitcher
      ? mlbPitcherPills({ games, mlbId })
      : mlbBatterPills({ games, battingOrder, mlbId, teammateIds });
  }
  if (sport === "nfl") return nflPills({ games, routePct, targetShare, adot });
  return hoopsPills({ games, usageRate });
}

// ---------------------------------------------------------------------------
// The role sentence.
//
// The mock writes "Batting third against a right-hander. Plate appearances
// have held at four or more in every start, so the sample below isn't
// measuring a smaller role than tonight's." That is not decoration -- it says
// whether the log the chart is drawing came from the role the player is about
// to occupy, which is the single thing a sample cannot say for itself.
//
// Composed clause by clause from facts, never written around a gap: a clause
// whose input is missing is dropped, and if nothing is known the sentence does
// not render at all.
// ---------------------------------------------------------------------------
const ORDER_WORD = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];
const COUNT_WORD = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export function roleSentence({ sport, market, games, isPitcher, battingOrder, opposingHand, position }) {
  const clauses = [];
  const n = (games || []).length;

  if (sport === "mlb" && !isPitcher) {
    const orderWord = battingOrder ? ORDER_WORD[parseInt(battingOrder, 10)] : null;
    if (orderWord) {
      clauses.push(opposingHand
        ? `Batting ${orderWord} against a ${opposingHand === "L" ? "left" : "right"}-hander.`
        : `Batting ${orderWord} tonight.`);
    }
    // The floor, not the average: "four or more in every start" is a claim
    // about the worst game in the sample, which is what makes it worth saying.
    const pas = (games || []).map((g) => g.pa).filter(Number.isFinite);
    if (pas.length >= 5) {
      const floor = Math.min(...pas);
      const word = COUNT_WORD[floor] || String(floor);
      clauses.push(floor >= 3
        ? `Plate appearances have held at ${word} or more in every one of the last ${n} games, so the sample below isn't measuring a smaller role than tonight's.`
        : `Plate appearances have dropped as low as ${word} in this sample, so some of these games came from a smaller role than tonight's.`);
    }
  }

  if (sport === "mlb" && isPitcher) {
    const outs = (games || []).map((g) => g.outs).filter(Number.isFinite);
    if (outs.length >= 3) {
      const ip = (Math.min(...outs) / 3).toFixed(1);
      clauses.push(`Shortest outing in this sample is ${ip} innings, which is the floor every rate below is built on.`);
    }
  }

  if (sport === "nfl") {
    const snaps = (games || []).map((g) => g.snapPct).filter(Number.isFinite);
    if (snaps.length >= 3) {
      const low = Math.round(Math.min(...snaps));
      clauses.push(low >= 60
        ? `Snap share has not fallen below ${low}% in this sample, so the log is measuring a full-time role.`
        : `Snap share falls as low as ${low}% here, so some of these games came from a part-time role.`);
    }
  }

  if (sport === "nba" || sport === "wnba") {
    const mins = (games || []).map((g) => g.minutes).filter(Number.isFinite);
    if (mins.length >= 3) {
      const low = Math.round(Math.min(...mins));
      clauses.push(low >= 24
        ? `Floor time has not dropped below ${low} minutes in this sample, so the rate below isn't leaning on a game he barely played.`
        : `Floor time drops to ${low} minutes at the low end, so at least one game here came from a much smaller role.`);
    }
  }

  return clauses.length ? clauses.join(" ") : null;
}
