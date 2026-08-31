// --------------------------------------------------------------------------
// Calibration: did the rates the app displayed hold up?
// --------------------------------------------------------------------------
// Every saved pick carries the hit rate the app showed at the moment it was
// added -- `hitRate`, frozen by pickFromRung and rewritten only when the leg is
// moved to another rung. Once that pick settles off the box score, the claim
// and the outcome can finally be put side by side.
//
// One pick can't be calibrated: a single 78% claim that lost is not a wrong
// claim, it's one game. Bands can. Forty picks the app called 70-79% should
// land somewhere near 75%, and if they land at 58% that is a fact about the
// app's own numbers -- the only kind of self-check available here, because
// there is no model to score and no closing line to compare against.
//
// What this deliberately does not do:
//
//   - No calibration curve, no fitted line, no Brier score. Four counted
//     buckets, each one a plain won/(won+lost) over the picks in it.
//   - No pooling of thin bands into their neighbours to make a number look
//     sturdier than its sample. A thin band stays thin and says so.
//   - No verdict on *why* a band missed. The gap is measured; its cause isn't.

// The bands, widest claim first. `max` is exclusive, so 0.90 lands in 90-100
// and not in 80-89; the top band's 1.01 keeps a perfect 1.0 inside it.
export const CALIBRATION_BANDS = [
  { key: "90-100", label: "90–100%", min: 0.9, max: 1.01 },
  { key: "80-89", label: "80–89%", min: 0.8, max: 0.9 },
  { key: "70-79", label: "70–79%", min: 0.7, max: 0.8 },
  { key: "under-70", label: "UNDER 70%", min: 0, max: 0.7 },
];

// Fewer settled picks than this in one band and the band is labelled thin. At
// four picks a single result moves the band's rate by 25 points, which is
// wider than any miscalibration worth naming.
export const CALIBRATION_THIN = 5;

// Fewer settled *rated* picks than this across all bands and no band is read
// out at all. The block still renders -- nothing is hidden -- but it leads with
// the total and states that the sample is too small to read as calibration.
export const CALIBRATION_FLOOR = 15;

// How far under its claim a band may land and still count as having held up.
// This is an editorial threshold, not a measured one, which is exactly why the
// UI prints it: an unstated tolerance is an unstated edit to the numbers.
export const CALIBRATION_SLACK = 0.05;

function isGraded(p) {
  return p && (p.result === "won" || p.result === "lost");
}

function hasRate(p) {
  return typeof p.hitRate === "number" && Number.isFinite(p.hitRate);
}

// picks: the full saved-pick array (open and settled). Returns null only when
// no settled pick carries a rate at all -- otherwise every band comes back,
// including the empty ones, so the caller can render a complete ladder rather
// than a list that silently omits the bands nobody has picked from.
export function ledgerCalibration(picks) {
  const graded = (picks || []).filter(isGraded);
  const rated = graded.filter(hasRate);
  // Settled picks saved before the rate rode along can't be checked against a
  // claim they never made. They're excluded from the bands and counted here so
  // the UI can say so out loud rather than quietly shrinking the denominator.
  const unrated = graded.length - rated.length;
  if (!rated.length) return null;

  const bands = CALIBRATION_BANDS.map((b) => {
    const inBand = rated.filter((p) => p.hitRate >= b.min && p.hitRate < b.max);
    const count = inBand.length;
    const won = inBand.filter((p) => p.result === "won").length;
    const claimed = count ? inBand.reduce((a, p) => a + p.hitRate, 0) / count : null;
    const real = count ? won / count : null;
    return {
      key: b.key,
      label: b.label,
      count,
      won,
      lost: count - won,
      claimed,
      real,
      thin: count > 0 && count < CALIBRATION_THIN,
      // A band with no picks is neither held nor missed -- it's unanswered.
      held: count > 0 ? real >= claimed - CALIBRATION_SLACK : null,
    };
  });

  // The worst-calibrated band worth naming: it must clear the thin bar on its
  // own before its gap is quoted at all.
  const worst =
    bands
      .filter((b) => b.count >= CALIBRATION_THIN && b.real < b.claimed - CALIBRATION_SLACK)
      .sort((a, b) => b.claimed - b.real - (a.claimed - a.real))[0] || null;

  return {
    bands,
    worst,
    // How many of the four bands have enough settled picks behind them to say
    // anything at all. Three callers already read this -- the two calibration
    // sentences in useMyPicks and a colour in MyPicksMobile -- and it was never
    // returned, so it was `undefined` at all three: the "nothing to check
    // against" branch could not fire, and the sentence after it printed
    // "undefined of the four bands are readable" on screen.
    readable: bands.filter((b) => b.count >= CALIBRATION_THIN).length,
    total: rated.length,
    unrated,
    belowFloor: rated.length < CALIBRATION_FLOOR,
  };
}
