// --------------------------------------------------------------------------
// Odds conversion and display
// --------------------------------------------------------------------------
// American odds are the app's internal representation everywhere -- saved
// picks store them, the feed generates them (probToAmericanOdds), and the
// parlay combiner works in decimal only as an intermediate step. The display
// format is a user preference, so only formatOdds() is format-aware; every
// calculation stays in American and converts internally.
//
// Lives in its own module because SettingsModal needs formatOdds to render a
// live sample next to the format picker, and importing it from PropLedger
// would mean pulling the whole app into the settings dialog's module graph.

// The Prop Feed's odds range is hard-capped to American odds of -1000/+1000
// -- anything outside that band (extreme favorites/longshots, e.g. a
// Triple-Double prop that hits 0% or 100% of the time) is excluded from the
// feed entirely rather than just hidden behind an untouched slider. These
// are the hit-rate probabilities that correspond exactly to -1000 and +1000.
export const ODDS_PROB_LOW = 1 / 11; // +1000
export const ODDS_PROB_HIGH = 10 / 11; // -1000

// Converts a hit-rate probability into an American odds price, the same
// vig-free implied-probability relationship real sportsbooks approximate.
// Clamped to the +/-1000 band the Prop Feed enforces as its max odds range
// so a displayed number never exceeds what the feed actually allows through.
//
// This runs one way only. A price is derived from a measured hit rate; no hit
// rate anywhere in the app is ever derived back out of a price. The alt-line
// ladder depends on that -- every rung's rate is a count of finished games,
// never an implied probability.
export function probToAmericanOdds(p) {
  const prob = Math.min(ODDS_PROB_HIGH, Math.max(ODDS_PROB_LOW, p));
  return prob >= 0.5
    ? Math.round((-100 * prob) / (1 - prob))
    : Math.round((100 * (1 - prob)) / prob);
}

export function americanToDecimal(o) {
  return o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o);
}

export function decimalToAmerican(d) {
  return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// American -> fractional, reduced. +150 is 3/2 (win 150 on a 100 stake);
// -180 is 5/9 (win 100 on a 180 stake). Denominators are rounded before
// reducing because a price like -110 gives 100/110, which reduces cleanly,
// but odd prices can land on a non-integer numerator.
function toFractional(o) {
  const [num, den] = o > 0 ? [Math.round(o), 100] : [100, Math.round(Math.abs(o))];
  const g = gcd(num, den) || 1;
  return `${num / g}/${den / g}`;
}

// `fmt` is the user's Settings > Display > Odds format value. Defaults to
// American so the many call sites that predate the setting keep working
// unchanged if one is ever missed.
export function formatOdds(o, fmt = "american") {
  if (o == null || !Number.isFinite(o)) return "—";
  if (fmt === "decimal") return americanToDecimal(o).toFixed(2);
  if (fmt === "fractional") return toFractional(o);
  return o > 0 ? `+${o}` : String(o);
}
