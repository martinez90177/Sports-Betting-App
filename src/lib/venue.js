// --------------------------------------------------------------------------
// Which side of the fixture a game was played on.
// --------------------------------------------------------------------------
// Every surface in this app writes a matchup away-first with an @ -- the
// slate cards, the board's card titles, the player page's breadcrumb. The
// per-game surfaces did not: a feed row said "vs NYJ" whether the player was
// at home or on the road, and the game-by-game axis printed a bare "GB" for
// all seventeen. Both halves of the season looked identical, which is also
// why the player page's Home/Away filter looked broken -- it worked, but
// nothing on screen changed enough to show it had.
//
// Unknown is its own answer here. A hand-transcribed or synthetic log never
// recorded a venue, and those rows get no marker rather than being called
// home by default -- the same rule the availability dot follows (CLAUDE.md
// rule 2: unknown is no dot, never a colour).

// "@ " on the road, "vs " at home, "" when the fixture never said. Trailing
// space included so a caller can concatenate without deciding.
export function venueWord(home) {
  return home == null ? "" : home ? "vs " : "@ ";
}

// The compact form, for an axis tick or a tooltip where the column is one
// abbreviation wide. Only road games are marked: writing "vs" on the other
// half would ragged the column of abbreviations to no benefit, since the
// absence of an @ already says home.
export function venueAbbr(home, abbr) {
  return home === false ? `@${abbr}` : abbr;
}
