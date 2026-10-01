// --------------------------------------------------------------------------
// A one-time, hand-captured snapshot of real sportsbook lines -- NOT fetched,
// NOT live, NOT kept in sync.
// --------------------------------------------------------------------------
// Read off the user's own logged-in Outlier account (app.outlier.bet), which
// aggregates real DraftKings/FanDuel/etc. lines, and transcribed by hand --
// the same method BOOK_LADDERS in lib/altLines.js already uses for the same
// reason: this app has no live, licensed feed for these numbers, and the only
// honest way to show a real one is to say plainly that it was read off a
// screen at a point in time.
//
// A player prop line moves through the week and can move fast right before
// kickoff. CAPTURED_AT is shown next to every price on the Mismatch report so
// it reads as "this was true then," never as a live quote. Do not add a new
// row here without updating CAPTURED_AT, and do not wire this into anything
// that implies freshness it doesn't have (the Prop Feed's own odds column,
// for instance) -- see the 2026-09-27 conversation that scoped this to the
// Mismatch report only.
//
// Only one line is kept per player+market: the first one read off Outlier's
// list for that player. Outlier shows a player's alt-line rungs alongside
// whichever the book calls its main line with no marker distinguishing them,
// so this is *a* real line at *a* real price, not necessarily the book's
// posted main number.
//
// Keyed by "Player Name|marketId", marketId matching lib/nflMismatch.js's
// MARKET_ID (passYds, rushYds, recYds -- the only markets a mismatch card
// ever targets, so that's all that's captured here).

export const CAPTURED_AT = "2026-09-27T08:00-04:00";
// Shown on the Mismatches cards. Names the books the prices came from, not the
// site they were read off.
export const CAPTURED_SOURCE = "DraftKings / FanDuel / BetMGM";

export const CAPTURED_ODDS = {
  "Bo Nix|passYds": { line: 124.5, odds: -1200 },
  "Matthew Stafford|passYds": { line: 149.5, odds: -1450 },
  "Patrick Mahomes|passYds": { line: 159.5, odds: -1260 },
  "Trevor Lawrence|passYds": { line: 169.5, odds: -630 },
  "Jared Goff|passYds": { line: 189.5, odds: -1180 },
  "C.J. Stroud|passYds": { line: 159.5, odds: -1240 },
  "Jacoby Brissett|passYds": { line: 199.5, odds: -225 },

  "Harold Fannin Jr.|recYds": { line: 9.5, odds: -1800 },
  "Evan Engram|recYds": { line: 4.5, odds: -1100 },
  "Rashee Rice|recYds": { line: 14.5, odds: -1450 },
  "Luther Burden III|recYds": { line: 19.5, odds: -340 },
  "Mack Hollins|recYds": { line: 9.5, odds: -900 },
  "Jakobi Meyers|recYds": { line: 9.5, odds: -1200 },
  "Tee Higgins|recYds": { line: 19.5, odds: -1000 },
  "Brian Thomas Jr.|recYds": { line: 14.5, odds: -580 },
  "Kayshon Boutte|recYds": { line: 4.5, odds: -1800 },
  "Deebo Samuel Sr.|recYds": { line: 14.5, odds: -850 },
  "Cooper Kupp|recYds": { line: 4.5, odds: -700 },
  "Sam LaPorta|recYds": { line: 14.5, odds: -1800 },
  "DeVonta Smith|recYds": { line: 24.5, odds: -1580 },
  "Brock Bowers|recYds": { line: 24.5, odds: -420 },
  "Elic Ayomanor|recYds": { line: 4.5, odds: -300 },
  "Stefon Diggs|recYds": { line: 14.5, odds: -550 },
  "Dawson Knox|recYds": { line: 4.5, odds: -205 },
  "Darius Slayton|recYds": { line: 4.5, odds: -200 },
  "Darnell Mooney|recYds": { line: 4.5, odds: -330 },
  "Michael Wilson|recYds": { line: 14.5, odds: -1100 },
  "Trey McBride|recYds": { line: 24.5, odds: -1980 },
  "Juwan Johnson|recYds": { line: 35.5, odds: -113 },
  "Jauan Jennings|recYds": { line: 14.5, odds: -113 },
};

// A snapshot belongs to the games it was read for: those kicking off within
// CAPTURED_WINDOW_MS after it. Without this the Week 3 capture kept showing
// on Week 4's cards -- last week's line, presented beside this week's game.
// Once the window passes, cards simply show no captured line until a new
// snapshot (and a new CAPTURED_AT) is written here.
const CAPTURED_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
export function capturedOddsFor(playerName, marketId, kickoffIso) {
  const gap = Date.parse(kickoffIso) - Date.parse(CAPTURED_AT);
  if (!Number.isFinite(gap) || gap < 0 || gap > CAPTURED_WINDOW_MS) return null;
  return CAPTURED_ODDS[`${playerName}|${marketId}`] || null;
}
