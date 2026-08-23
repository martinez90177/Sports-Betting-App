// --------------------------------------------------------------------------
// How much does a sample actually support its rate?
// --------------------------------------------------------------------------
// The board's verdict used to be three buckets on the raw percentage: 65%+
// leans a side, under 45% leans the other, everything between is a coin flip.
// Sample size gated the minimum and then stopped mattering, which meant these
// three rows carried the same words:
//
//     9 of 10   90%   genuinely better than a coin flip
//    13 of 20   65%   indistinguishable from a coin flip
//     7 of 10   70%   establishes nothing
//
// "Leans" is a claim about confidence, so confidence has to be in the
// arithmetic. It was not. On a product whose whole argument is that a rate
// never appears without its sample, the verdict was the one place the sample
// did no work.
//
// What replaces it is the lower bound of a Wilson score interval: given k hits
// in n games, how high can the underlying rate be shown to be? A rate is only
// called a lean when that bound clears 50%, so a big percentage over few games
// and a modest one over many are compared on the same scale.

// Wilson, not the textbook normal approximation, for two reasons that both
// bite here: at 100% (10 of 10 happens constantly on short seasons) the normal
// interval collapses to zero width and claims certainty, and at small n it
// runs below 0 and above 1. Wilson does neither.
//
// z is one-sided. 1.28 is 90%, which is the right question for a research
// triage tool -- "is this worth opening?" -- rather than the 95% you would
// want before publishing a finding. At 95% almost nothing on a 17-game NFL
// season clears the bar, and a screen that says "not established" to
// everything has stopped ranking anything.
export const SUPPORT_Z = 1.28;

export function wilsonLower(hits, n, z = SUPPORT_Z) {
  if (!n || hits == null || n <= 0) return 0;
  const p = hits / n;
  const d = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  const lo = (centre - spread) / d;
  return lo < 0 ? 0 : lo > 1 ? 1 : lo;
}

// The bands, strongest first. These are bounds on the *lower bound*, so they
// read as "the sample supports at least this much".
//
// Where they land, for the record -- this is the table the thresholds were
// picked against, not a guess:
//
//     n      60%        70%        80%        90%       100%
//     10     --         --         Leans      Strong    Strong
//     17     --         Slight     Strong     Strong    Strong
//     20     --         Slight     Strong     Strong    Strong
//     40     --         Leans      Strong     Strong    Strong
//     82     Slight     Leans      Strong     Strong    Strong
//
// 60% never establishes a side at any sample size a season can produce, which
// agrees with the 45-65% neutral band already set for the feed's rate cells:
// after vig, 60% is close enough to a coin flip that calling it an edge would
// be an endorsement the number has not earned.
//
// The lowest band's floor is 52.5%, not 50%. A bound sitting on 50 means only
// that a coin flip can *just* be ruled out, which is not a finding worth a
// directional word: 13 of 20 lands at 50.7% and would otherwise read "Slight
// over" off a sample that says almost nothing. Raising it moves that case and
// leaves every other one where it was.
export const SUPPORT_BANDS = [
  { id: "strong", min: 0.65, word: "Strong" },
  { id: "leans", min: 0.575, word: "Leans" },
  { id: "slight", min: 0.525, word: "Slight" },
];

// The word for a lower bound, or null when it does not clear a coin flip.
export function supportBand(lower) {
  return SUPPORT_BANDS.find((b) => lower >= b.min) || null;
}

// The strongest support either side of a prop can claim.
//
// This is the right question for a *label* -- a row that goes under 80% of the
// time has said something, and the pill should say it. It is the wrong one for
// a *ranking*, which is why the board does not sort on it: a backup tight end
// who has never scored is a perfectly well-supported claim and the least
// interesting row on the slate, and every 0-of-10 floats to the top. See the
// ranking note in BoardPage.
export function supportScore(hits, n) {
  if (!n) return -1;
  return Math.max(wilsonLower(hits, n), wilsonLower(n - hits, n));
}
