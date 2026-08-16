// --------------------------------------------------------------------------
// Alt lines: turning one posted line into a ladder of rungs
// --------------------------------------------------------------------------
// Every prop in the feed carries one line -- fairFeedLine(values), the
// threshold that splits a player's own sample near 50/50. This module turns
// that single line into a ladder of alternate lines, and counts each rung the
// only honest way there is: one pass over the *same finished games* per rung.
//
// What is deliberately absent, because it would make the numbers a fiction:
//
//   - No modelling. A rung's rate is never a distribution fitted to the log.
//   - No interpolation. A rung's rate is never read off a curve between two
//     other rungs.
//   - No implied probability from price. The arrow only ever points the other
//     way -- a rung's price is its measured rate converted to American odds
//     (see probToAmericanOdds), and no rate is ever recovered from a price.
//
// No sportsbook prices these rungs. The app has no alt-line odds feed; real
// posted odds exist in exactly one place in the app (the MLB sportsbook
// panel), and they cover the main line only. Every price this module returns
// is the sample's own hit rate expressed as American odds, and every surface
// that shows one has to say so.

import { probToAmericanOdds } from "../odds.js";

// True when a game's value wins the bet, for whichever side is displayed.
// Binary markets (double-double/triple-double) have no line to clear -- the
// stat is already 1/0 -- so "Under" on one of those means it didn't happen.
//
// Lives here rather than in PropLedger because the ladder counts every rung
// through it, and the feed's streak/form/grading paths count through the same
// function. One definition: a rung that disagreed with the row above it about
// what a hit is would be worse than no rung at all.
export function feedIsHit(v, line, isBinary, direction) {
  const over = isBinary ? v === 1 : v > line;
  return direction === "under" ? !over : over;
}

// A ladder is only worth reading if its rungs are spaced the way the market is
// actually priced -- one reception at a time, 25 yards at a time on passing
// yards. Derived from the main line's own scale rather than from a per-market
// table, so a market this app has never seen still gets a sane ladder.
//
// The step is never below 1, and that is a correctness constraint rather than
// a taste one. Every stat behind these markets is an integer, and every posted
// line is X.5 (fairFeedLine returns `median - 0.5`) precisely so that no logged
// value can land exactly *on* a line -- there are no pushes, and `1 - rate` is
// the exact Under rate, which is what flipFeedRowToUnder relies on. A 0.5 step
// off an X.5 line lands rungs on whole numbers, which breaks that guarantee and
// produces pairs of rungs with identical counts (a line of 4 and a line of 4.5
// cannot be told apart by an integer log). "Half-point alt lines" in a book's
// language already means consecutive X.5 lines -- that is a step of 1 here.
export function rungStep(mainLine) {
  const m = Math.abs(mainLine);
  if (m < 20) return 1;
  if (m < 60) return 5;
  if (m < 150) return 10;
  return 25;
}

// Feed sample windows are the row keys "l5"/"l10"/"l20"/"all". Rungs are
// counted over whichever one the feed is currently showing, so the main
// rung's rate is the *same number* already in that row's cell rather than a
// second, differently-scoped rate sitting under it.
export function windowSize(window) {
  if (window == null || window === "all") return "all";
  if (typeof window === "number") return window;
  const n = Number(String(window).replace(/^l/i, ""));
  return Number.isFinite(n) ? n : "all";
}

export function windowValues(values, window) {
  const n = windowSize(window);
  return n === "all" ? values : values.slice(-n);
}

// How many rungs to offer on each side of the posted line before clipping.
const MAX_RUNGS_EACH_SIDE = 3;
// Under this many games behind it, a ladder is labelled thin rather than
// hidden. Every rung shares one window, so this is a fact about the ladder,
// not about any individual rung.
export const THIN_GAMES = 10;

// One rung: the line, how many of the counted games cleared it, the rate that
// division produces, and the price that rate converts to. `isMain` marks the
// line the app actually posted -- ALT keys off this, not off whether the user
// touched anything.
function rungAt(line, w, isBinary, direction, mainLine) {
  const gamesCounted = w.length;
  const gamesOver = w.filter((v) => feedIsHit(v, line, isBinary, direction)).length;
  const hitRate = gamesCounted ? gamesOver / gamesCounted : null;
  // No price on a rung the sample never split. 0 of 9 is a real measurement and
  // the rung keeps it, but converting 0% to a price only reaches the +/-1000
  // clamp -- a display floor dressed up as a number the games produced. A dash
  // says "the sample doesn't price this" instead of overstating it.
  const priceable = hitRate != null && hitRate > 0 && hitRate < 1;
  return {
    line,
    gamesOver,
    gamesCounted,
    hitRate,
    price: priceable ? probToAmericanOdds(hitRate) : null,
    isMain: line === mainLine,
    thin: gamesCounted < THIN_GAMES,
  };
}

// Walks outward from the posted line one step at a time, stopping after the
// first rung that lands on 0% or 100%.
//
// The stop matters. Rungs past that point are all 0% or all 100% -- they say
// nothing the last one didn't, and their prices would be the +/-1000 clamp
// rather than a measurement, which reads as a real number and isn't one. The
// clamp is a display floor, not a finding.
function walk(w, mainLine, step, dir, isBinary, direction) {
  const out = [];
  for (let k = 1; k <= MAX_RUNGS_EACH_SIDE; k++) {
    const line = mainLine + dir * k * step;
    // Below zero is not a line anyone can bet, and a line of exactly 0 has no
    // half-point offset protecting it from a push.
    if (line <= 0) break;
    const r = rungAt(line, w, isBinary, direction, mainLine);
    out.push(r);
    if (r.hitRate === 0 || r.hitRate === 1) break;
  }
  return out;
}

// The ladder for one player + market, ascending by line.
//
// Binary markets return no rungs at all: a double-double either happened or it
// didn't, and there is no line to move. Callers must render that as a visible
// state ("no alt lines for this market") rather than an absent control.
export function buildRungs({ values, mainLine, isBinary, direction = "over", window = "all" }) {
  if (!values || !values.length || isBinary || mainLine == null) return [];
  const w = windowValues(values, window);
  if (!w.length) return [];
  const step = rungStep(mainLine);
  const down = walk(w, mainLine, step, -1, isBinary, direction);
  const up = walk(w, mainLine, step, 1, isBinary, direction);
  return [
    ...down.reverse(),
    rungAt(mainLine, w, isBinary, direction, mainLine),
    ...up,
  ];
}

// How often every leg on the slip landed in the same game.
//
// This is a count, never a product. Multiplying the legs' single rates assumes
// they are independent, and slip legs routinely aren't -- two markets on one
// player, or two players in one game, move together. A multiplied number would
// be both wrong and more confident-looking than anything the data supports.
//
// Legs are aligned from each player's most recent game backwards and truncated
// to the shortest log: that truncation *is* "games where all the legs' players
// finished". A leg with five games caps the whole block at five, which is the
// honest answer rather than a reason to drop it.
//
// `tooShort` is the harder version of the thin rule. Under three overlapping
// games there is no rate worth printing at all -- one game either way swings it
// by 33 points -- so callers say the overlap is too short instead of showing a
// percentage. Between three and ten it prints, labelled thin.
export function combinedLanded(legs) {
  const usable = (legs || []).filter((l) => l && Array.isArray(l.values) && l.values.length);
  if (!usable.length || usable.length !== (legs || []).length) {
    return { landed: 0, counted: 0, hitRate: null, thin: true, tooShort: true, legsMissingLog: true };
  }
  const counted = Math.min(...usable.map((l) => l.values.length));
  let landed = 0;
  for (let i = 1; i <= counted; i++) {
    const all = usable.every((l) => {
      const v = l.values[l.values.length - i];
      return feedIsHit(v, l.line, l.isBinary, l.direction || "over");
    });
    if (all) landed++;
  }
  return {
    landed,
    counted,
    hitRate: counted ? landed / counted : null,
    thin: counted < THIN_GAMES,
    tooShort: counted < 3,
    legsMissingLog: false,
  };
}
