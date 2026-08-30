import { wilsonLower } from "./support.js";

// Findings: the same logs the feed ranks, stated as sentences.
//
// Competitive brief item 6, mock 3e. This is not a third ranking of the same
// number. The Board ranks one figure per prop -- the overall rate, weighted by
// how well its sample supports it -- and by construction it can never surface a
// prop that is a coin flip overall and eight-of-eight at home. That prop is
// what this file is for: it runs the splits the Board does not, and states
// what it finds in words.
//
// Every finding carries the split that produced it and the sample it stands
// on. A run shorter than the support band is stated as a count of games and
// never as a percentage -- the same rule the feed's cells and the board's
// verdict already follow, applied to prose, where it is easier to break.

// Five, matching the H2H column and the board's own floor. Below this a rate
// is not stated at all.
const SUPPORT = 5;

// A run has to be long enough to be worth a sentence. Four straight is noise
// on a twenty-game log; the app would generate one for nearly every row and
// the screen would be a wall.
const MIN_STREAK = 5;
const MIN_SPLIT_GAMES = 5;
const SPLIT_RATE = 0.8;

const isHit = (v, line, isBinary) => (isBinary ? v === 1 : v > line);

// The current run ending at the most recent game, positive for hits and
// negative for misses.
function currentStreak(values, line, isBinary) {
  if (!values || !values.length) return 0;
  const first = isHit(values[values.length - 1], line, isBinary);
  let n = 0;
  for (let i = values.length - 1; i >= 0 && isHit(values[i], line, isBinary) === first; i--) n++;
  return first ? n : -n;
}

// Is this a property of the market rather than of the player?
//
// "Zack Wheeler has stayed under 0.5 stolen bases allowed in 31 straight
// starts" is true, is a 100% rate on a large sample, and is not news: almost
// no pitcher allows a stolen base, so the line exists to be a near-lock. The
// mock calls these structural near-certainties and hides them by default.
//
// Detected by variance, not by a market blacklist. A log that never moves off
// one value has nothing to say about the player -- and the same market can be
// structural for one player and live for another, which a blacklist could not
// express.
function isStructural(values, line, isBinary, rate) {
  if (isBinary) return false;
  if (rate < 0.95 && rate > 0.05) return false;
  if (!values || values.length < 10) return false;

  // The test that matters: a half-point line that the log never crosses.
  //
  // 0.5 is the market's minimum granularity -- it exists to turn a count into
  // a yes/no. When the answer has been the same every game, the line is a
  // property of the stat rather than a read on the player: a kicker attempts a
  // field goal, a pitcher does not allow stolen bases. "Cleared 0.5 FG
  // attempts in 18 straight games" is true and is not news.
  //
  // This replaces a standard-deviation test, which was the principled-looking
  // version and was wrong in practice: field-goal attempts run 1 to 4, so the
  // variance is large while the outcome never changes, and the kicker led the
  // NFL findings list.
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (line <= 0.5 && (lo > line || hi < line)) return true;

  // And the flat-log case the deviation test was reaching for: the same
  // number every game, with the line clear of it. Kept for lines above 0.5,
  // where the rule above does not apply.
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) < 0.34 && Math.abs(mean - line) > 0.4;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// The unit a sport's log is counted in, which is the difference between "31
// straight games" and "31 straight starts" and is the sort of thing a reader
// notices immediately when it is wrong.
function unitFor(row, sport) {
  if (sport === "mlb" && String(row.marketId).startsWith("p_")) return ["start", "starts"];
  return ["game", "games"];
}

// One row in, zero or more findings out.
//
// `over` is decided per finding rather than per row: a streak of misses is as
// much a finding as a streak of hits, and forcing everything into the over
// side is how a screen ends up claiming a player is due.
function findingsForRow(row, sport) {
  const out = [];
  const { values, line, isBinary } = row;
  if (!values || values.length < MIN_STREAK) return out;
  const [one, many] = unitFor(row, sport);
  const name = row.name;
  const prop = row.subtitle || row.marketLabel;
  // Away side first, the way every other surface writes a matchup -- `homeGame`
  // is on the row precisely so this does not have to guess.
  const fixture = row.gameLabelFull
    || (row.opp
      ? (row.homeGame === false ? `${row.team} @ ${row.opp}` : `${row.opp} @ ${row.team}`)
      : null);
  const game = [fixture, row.gameTime].filter(Boolean).join(" · ");

  const push = (f) => {
    const rate = f.hits / f.n;
    const structural = isStructural(f.pool || values, line, isBinary, rate);
    out.push({
      key: `${row.key}:${f.id}`,
      // The finding type, as its own field rather than only inside the key.
      // The v3 Findings card prints it as a chip beside the split, and
      // re-deriving it from the sentence would be reading a string back.
      id: f.id,
      rowKey: row.key,
      sport,
      name,
      team: row.team,
      avatar: row.avatar,
      espnId: row.espnId,
      playerId: row.playerId,
      marketId: row.marketId,
      status: row.status,
      sentence: f.sentence,
      split: f.split,
      streakLabel: f.streakLabel,
      game,
      prop,
      rate,
      hits: f.hits,
      n: f.n,
      // The bars the row draws: the games this finding is actually about, not
      // the last ten of the whole log. A finding about home form that drew
      // away games underneath it would be illustrating a different claim.
      bars: f.bars,
      line,
      isBinary,
      // Ranked on the sample-weighted lower bound, not the rate, for the same
      // reason the board is: 5-of-5 and 40-of-50 are not the same claim and
      // sorting on 100% puts the weaker one first.
      strength: wilsonLower(f.hits, f.n),
      streak: f.streak || 0,
      startsAt: row.date || null,
      structural,
      thin: f.n < SUPPORT,
    });
  };

  // ---- 1. The current run --------------------------------------------------
  const streak = currentStreak(values, line, isBinary);
  const runLen = Math.abs(streak);
  if (runLen >= MIN_STREAK) {
    const cleared = streak > 0;
    const run = values.slice(values.length - runLen);
    const avg = run.reduce((a, b) => a + b, 0) / run.length;
    push({
      id: "streak",
      split: "Season",
      streak: runLen,
      streakLabel: `${runLen} straight`,
      hits: cleared ? runLen : 0,
      n: runLen,
      bars: run,
      pool: values,
      sentence: cleared
        ? `${name} has cleared ${prop.replace(/^Over\s+/i, "")} in ${plural(runLen, `straight ${one}`, `straight ${many}`)}, averaging ${avg.toFixed(1)} over the run.`
        : `${name} has fallen short of ${prop.replace(/^Over\s+/i, "")} in ${plural(runLen, `straight ${one}`, `straight ${many}`)}, averaging ${avg.toFixed(1)} over the run.`,
    });
  }

  // ---- 2. Home and away ----------------------------------------------------
  const homes = row.homes || [];
  if (homes.length === values.length) {
    [["home", true, "Home only"], ["away", false, "Away only"]].forEach(([id, want, label]) => {
      const pool = values.filter((_, i) => homes[i] === want);
      if (pool.length < MIN_SPLIT_GAMES) return;
      const hits = pool.filter((v) => isHit(v, line, isBinary)).length;
      const rate = hits / pool.length;
      if (rate < SPLIT_RATE && rate > 1 - SPLIT_RATE) return;
      const cleared = rate >= SPLIT_RATE;
      const avg = pool.reduce((a, b) => a + b, 0) / pool.length;
      push({
        id,
        split: label,
        streakLabel: `${hits} of ${pool.length}`,
        hits, n: pool.length,
        bars: pool.slice(-12),
        pool,
        sentence: cleared
          ? `${name} has cleared ${prop.replace(/^Over\s+/i, "")} in ${hits} of ${plural(pool.length, `${id} ${one}`, `${id} ${many}`)}, averaging ${avg.toFixed(1)}.`
          : `${name} has cleared ${prop.replace(/^Over\s+/i, "")} in only ${hits} of ${plural(pool.length, `${id} ${one}`, `${id} ${many}`)}, averaging ${avg.toFixed(1)}.`,
      });
    });
  }

  // ---- 3. Against tonight's opponent --------------------------------------
  //
  // The one split where "too few" earns its keep. Two teams meet twice a year
  // in most leagues, so this is usually under the band -- and under it the
  // sentence counts the meetings and states no rate at all.
  if (row.nH2h >= 3 && row.opp) {
    const rate = row.h2h;
    const extreme = rate >= SPLIT_RATE || rate <= 1 - SPLIT_RATE;
    if (extreme) {
      const hits = Math.round(rate * row.nH2h);
      push({
        id: "h2h",
        split: "vs this opponent",
        streakLabel: `${hits} of ${row.nH2h}`,
        hits, n: row.nH2h,
        bars: [],
        pool: values,
        sentence: row.nH2h < SUPPORT
          ? `${name} has cleared ${prop.replace(/^Over\s+/i, "")} in ${hits} of ${plural(row.nH2h, `meeting`, `meetings`)} with ${row.opp} — too few to put a rate on.`
          : `${name} has cleared ${prop.replace(/^Over\s+/i, "")} in ${hits} of ${plural(row.nH2h, `meeting`, `meetings`)} with ${row.opp}.`,
      });
    }
  }

  return out;
}

export const FINDING_SPLITS = ["All splits", "Season", "Home only", "Away only", "vs this opponent"];
export const FINDING_SIDES = ["Both", "Over", "Under"];
export const FINDING_SORTS = [
  { id: "strength", label: "Strength" },
  { id: "streak", label: "Longest streak" },
  // Frame 2b names these three exactly, and its own comment says the controls
  // must offer what this file exports. "Sample" it is: deepest sample first,
  // strength breaking the tie, which is the ordering a reader asking "what is
  // best supported" actually wants.
  { id: "sample", label: "Sample" },
];

export function buildFindings(rows, sport) {
  const out = [];
  (rows || []).forEach((r) => {
    // Only players with a game to play. The feed builds a row for anyone with
    // a log, whether or not their team is on tonight's slate -- which is right
    // for a feed you search, and wrong for a screen whose subtitle says "on
    // this slate". Without this guard the WNBA list led with a finding about a
    // player whose own page then said, correctly, that she is not on a game we
    // can read today.
    if (!r || !r.opp) return;
    findingsForRow(r, sport).forEach((f) => out.push(f));
  });
  return out;
}

export function filterFindings(findings, { split, side, hideStructural, sort }) {
  let list = findings;
  if (hideStructural) list = list.filter((f) => !f.structural);
  if (split && split !== "All splits") list = list.filter((f) => f.split === split);
  if (side === "Over") list = list.filter((f) => f.rate >= 0.5);
  if (side === "Under") list = list.filter((f) => f.rate < 0.5);

  const sorted = [...list];
  if (sort === "streak") sorted.sort((a, b) => (b.streak - a.streak) || (b.strength - a.strength));
  else if (sort === "sample") sorted.sort((a, b) => (b.n - a.n) || (b.strength - a.strength));
  else sorted.sort((a, b) => b.strength - a.strength);
  return sorted;
}
