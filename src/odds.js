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
