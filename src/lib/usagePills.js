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
// NBA / WNBA -- the two basketball mocks name Minutes, Usage, Shots/g, FT rate.
//
// Two of those cannot be computed from what this app has, and the codebase had
// already reached that conclusion once: see hoopsRateAgg, which refuses FG%,
// TS% and usage for the same reason. The logs carry three-point and free-throw
// makes and attempts but no total field goals, so "Shots/g" has no input and
// "FT rate" -- conventionally FTA/FGA -- has only half of one. Usage rate
// additionally needs team possessions while the player is on the floor, which
// no feed here reports; it renders only when a caller can supply a real one.
//
// So rather than approximate a stat bettors read precisely, this shows the
// attempt volumes that *are* measured, ordered by what the market is about:
// a threes prop reads on three-point attempts, everything else on minutes.
// ---------------------------------------------------------------------------
const HOOPS_THREES = new Set(["3pm", "fg3a", "3pa"]);

function hoopsPills({ games, market, usageRate }) {
  const minutes = pill("Minutes", one(avg(games, (g) => g.minutes)));
  const threes = pill("3PA/g", one(avg(games, (g) => g.fg3a)));
  const fts = pill("FTA/g", one(avg(games, (g) => g.fta)));
  const usage = pill("Usage", pct(usageRate));
  const lead = HOOPS_THREES.has(market) ? [threes, minutes] : [minutes, threes];
  return [...lead, fts, usage].filter(Boolean);
}

// ---------------------------------------------------------------------------
// NFL -- the mock names Snaps, Routes, Target share, aDOT.
//
// None of the four is measured here. Routes run, target share and average
// depth of target are charting data (PFF/NextGen) behind no feed this app
// reads. Snap share looks available -- normalizeNFLGame sets `snapPct` -- but
// estimateSnapPct derives it from a hand-written role profile and that game's
// touches, so a pill labelled "Snaps" would present a guess as a measurement,
// which is the one thing this app does not do.
//
// What the box score does carry is volume, and volume is what the mock's four
// were reaching for: whether the role supports the prop. Which volume matters
// depends on the position, so the row is built per position rather than one
// list with different numbers.
// ---------------------------------------------------------------------------
function nflPills({ games, position, routePct, targetShare, adot }) {
  const per = (pick) => avg(games, pick);
  const supplied = [
    pill("Routes", pct(routePct, 0)),
    pill("Target share", pct(targetShare, 0)),
    pill("aDOT", one(adot)),
  ].filter(Boolean);

  if (position === "QB") {
    const att = per((g) => g.att);
    const comp = per((g) => g.comp);
    const yds = per((g) => g.passYds);
    return [
      pill("Att/g", one(att)),
      pill("Comp%", att ? `${((comp / att) * 100).toFixed(1)}%` : null),
      pill("Yds/att", att ? (yds / att).toFixed(1) : null),
      ...supplied,
    ].filter(Boolean);
  }

  if (position === "RB") {
    const carries = per((g) => g.rushAtt);
    const rushYds = per((g) => g.rushYds);
    return [
      pill("Carries/g", one(carries)),
      pill("Targets/g", one(per((g) => g.tgt))),
      pill("Yds/carry", carries ? (rushYds / carries).toFixed(1) : null),
      ...supplied,
    ].filter(Boolean);
  }

  if (position === "K") {
    return [
      pill("FGA/g", one(per((g) => g.fga))),
      pill("XPA/g", one(per((g) => g.xpa))),
      ...supplied,
    ].filter(Boolean);
  }

  // WR and TE.
  const rec = per((g) => g.rec);
  const recYds = per((g) => g.recYds);
  return [
    pill("Targets/g", one(per((g) => g.tgt))),
    pill("Rec/g", one(rec)),
    pill("Yds/rec", rec ? (recYds / rec).toFixed(1) : null),
    ...supplied,
  ].filter(Boolean);
}

export function usagePills({ sport, market, games, position, isPitcher, battingOrder, mlbId, teammateIds, usageRate, routePct, targetShare, adot }) {
  if (sport === "mlb") {
    return isPitcher
      ? mlbPitcherPills({ games, mlbId })
      : mlbBatterPills({ games, battingOrder, mlbId, teammateIds });
  }
  if (sport === "nfl") return nflPills({ games, position, routePct, targetShare, adot });
  return hoopsPills({ games, market, usageRate });
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
    // Deliberately not snap share: `snapPct` on an NFL game is estimated from
    // a role profile (see estimateSnapPct), and a sentence about the floor is
    // only worth writing if the floor is measured. Touches are.
    const touch = position === "QB" ? (g) => g.att
      : position === "RB" ? (g) => (g.rushAtt || 0) + (g.tgt || 0)
      : (g) => g.tgt;
    const word = position === "QB" ? "pass attempts" : position === "RB" ? "touches" : "targets";
    const touches = (games || []).map(touch).filter(Number.isFinite);
    if (touches.length >= 3) {
      const low = Math.min(...touches);
      const floor = position === "QB" ? 20 : position === "RB" ? 10 : 4;
      clauses.push(low >= floor
        ? `No game in this sample came in under ${low} ${word}, so the log isn't measuring a smaller role than this week's.`
        : `${word[0].toUpperCase()}${word.slice(1)} drop as low as ${low} here, so at least one of these games came from a smaller role.`);
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
