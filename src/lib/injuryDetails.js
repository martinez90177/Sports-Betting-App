// What each listed player is actually dealing with, off the league's own
// injury report: the body part and injury, ESPN's expected return date, and
// the one-line note that goes with the designation.
//
// The availability dots come from the roster endpoint, which says only
// "out" or "questionable". This is the same designation with its detail, so
// the Injuries page's DETAIL column -- empty on every row until now -- says
// "Hip, inflammation · expected back Nov 27" instead of nothing.
//
// Free and CORS-open, one request per league, cached fifteen minutes.

const PATH = { nba: "basketball/nba", nfl: "football/nfl", wnba: "basketball/wnba" };
const TTL_MS = 15 * 60 * 1000;
const memo = new Map();

const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
// More than ~4 months out carries its year: "Oct 1" on a season-ending injury
// in November means next October.
const returnLabelFor = (ms) => (ms - Date.now() > 120 * 86400000 ? MONTH_DAY_YEAR : MONTH_DAY).format(new Date(ms));

function cap(s) {
  const t = String(s || "").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

// "Hip, inflammation" / "Coach's decision" / "Knee" -- whatever the report
// names, without repeating a word it already said.
function injuryText(details) {
  if (!details) return "";
  const type = cap(details.type);
  // ESPN fills an unknown detail with "Not Specified", which says nothing.
  const raw = String(details.detail || "").trim();
  const detail = /^not specified$/i.test(raw) ? "" : raw;
  if (!type) return cap(detail);
  if (!detail || detail.toLowerCase() === type.toLowerCase()) return type;
  return `${type}, ${detail.toLowerCase()}`;
}

// { espnId: { detail, returnDate, returnLabel, note, date } } for one league,
// or an empty Map when the report cannot be read.
export async function fetchInjuryDetails(sport) {
  if (!PATH[sport]) return new Map();
  const hit = memo.get(sport);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const out = new Map();
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${PATH[sport]}/injuries`);
    if (res.ok) {
      const j = await res.json();
      (j.injuries || []).forEach((team) => (team.injuries || []).forEach((i) => {
        const id = i.athlete && (i.athlete.id
          || ((i.athlete.links || []).map((l) => (String(l.href || "").match(/\/id\/(\d+)/) || [])[1]).find(Boolean)));
        if (!id) return;
        const ret = i.details && i.details.returnDate;
        const retMs = ret ? Date.parse(`${ret}T12:00:00Z`) : NaN;
        out.set(String(id), {
          detail: injuryText(i.details),
          returnDate: Number.isFinite(retMs) ? ret : null,
          // A return date already behind us says nothing useful.
          returnLabel: Number.isFinite(retMs) && retMs > Date.now() - 86400000 ? returnLabelFor(retMs) : null,
          note: i.shortComment || "",
          date: i.date || null,
        });
      }));
    }
  } catch {
    // An unreadable report leaves the column blank, as it was.
  }
  memo.set(sport, { at: Date.now(), value: out });
  return out;
}

// The Detail column's text: the injury, then the expected return.
export function injuryDetailLine(info) {
  if (!info) return "";
  return [info.detail, info.returnLabel ? `expected back ${info.returnLabel}` : null].filter(Boolean).join(" · ");
}
