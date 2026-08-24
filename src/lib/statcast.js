// Statcast batted-ball and plate-discipline rates, from Baseball Savant.
//
// The v2 player-header mock draws "Hard-hit 54.1% · 1st on team" and "Barrel
// 19.8%" as usage pills. Neither is in statsapi -- they are Statcast measures,
// and this is where they come from.
//
// One request per side (batter / pitcher) covers the whole league, keyed by
// `player_id`, which is the same id space as statsapi's `people/{id}` and
// therefore the same `mlbId` the rosters already carry. Savant sends
// `access-control-allow-origin: *`, so this runs in the browser with no
// serverless proxy -- unlike api/odds.js, which needs one for its key.
//
// Cached for six hours: these are season-to-date rates that move by hundredths
// of a point after a single game, so re-fetching per player page would be a
// megabyte of CSV to change a number nobody would see move.

const SAVANT = "https://baseballsavant.mlb.com/leaderboard/custom";
const TTL_MS = 6 * 60 * 60 * 1000;

// Season-to-date rates, so anyone with a plate appearance is included: an
// absent value renders as nothing, which is the honest answer for a callup
// with four at-bats, and is better than excluding him from the lookup and
// making the page unable to tell "no data" from "not fetched".
const SELECTIONS = {
  // whiff_percent, oz_swing_percent (chase) and xwoba joined the batter list
  // for the expected-lineup table and the percentile pair -- competitive brief
  // items 2 and 3, mocks 3b and 3c. They cost nothing extra: this is one
  // request for the whole league either way, and the columns ride along in the
  // same CSV.
  batter: [
    "b_total_pa", "barrel_batted_rate", "hard_hit_percent",
    "k_percent", "bb_percent", "sweet_spot_percent", "xba", "xslg",
    "whiff_percent", "oz_swing_percent", "xwoba",
  ],
  pitcher: [
    "p_formatted_ip", "barrel_batted_rate", "hard_hit_percent",
    "k_percent", "bb_percent", "whiff_percent", "xba",
    "oz_swing_percent", "xwoba", "in_zone_percent",
  ],
};

function url(kind, year) {
  const sel = SELECTIONS[kind].join(",");
  const x = kind === "pitcher" ? "k_percent" : "barrel_batted_rate";
  return `${SAVANT}?year=${year}&type=${kind}&filter=&min=1&selections=${sel}`
    + `&chart=false&x=${x}&y=${x}&r=no&chartType=beeswarm&csv=true`;
}

// Savant's first column is `"last_name, first_name"` -- a comma inside quotes
// -- so this cannot be a split(","). Small quoted-CSV reader rather than a
// dependency: one file, one shape, and the shape is stable.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/^\./, "0."));
  return Number.isFinite(n) ? n : null;
};

const cache = { batter: null, pitcher: null };
const inflight = { batter: null, pitcher: null };

function seasonYear() {
  const now = new Date();
  // Before late March there is no current-season Statcast, so the most recent
  // complete season is the honest one to read.
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

export function fetchStatcast(kind = "batter") {
  const hit = cache[kind];
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return Promise.resolve(hit.byId);
  if (inflight[kind]) return inflight[kind];

  const run = (async () => {
    for (const year of [seasonYear(), seasonYear() - 1]) {
      try {
        const res = await fetch(url(kind, year));
        if (!res.ok) continue;
        const rows = parseCsv(await res.text());
        if (rows.length < 2) continue;
        const head = rows[0].map((h) => h.trim());
        const idIdx = head.indexOf("player_id");
        if (idIdx < 0) continue;
        const byId = new Map();
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r[idIdx]) continue;
          const rec = {};
          head.forEach((h, j) => { rec[h] = num(r[j]); });
          byId.set(String(r[idIdx]), rec);
        }
        if (!byId.size) continue;
        cache[kind] = { fetchedAt: Date.now(), byId, year };
        return byId;
      } catch {
        // fall through to the previous season, then give up
      }
    }
    // Not cached on failure: a retry inside the session should be able to try
    // again rather than replay the failure for six hours.
    return new Map();
  })();

  inflight[kind] = run.finally(() => { inflight[kind] = null; });
  return inflight[kind];
}

// Synchronous read for render. Returns null until the fetch above has landed,
// which is what makes an unfetched pill absent rather than zero.
export function statcastFor(mlbId, kind = "batter") {
  const c = cache[kind];
  if (!c || mlbId == null) return null;
  return c.byId.get(String(mlbId)) || null;
}

// "1st on team" in the mock. Rank within a set of team-mates on one measure,
// computed from the same league table already in memory -- no second request.
// Returns null unless every input is real, so a partial roster cannot produce
// a confident-looking rank.
export function statcastTeamRank(mlbId, teammateIds, field, kind = "batter") {
  const me = statcastFor(mlbId, kind);
  if (!me || me[field] == null) return null;
  const vals = (teammateIds || [])
    .map((id) => statcastFor(id, kind))
    .filter((r) => r && r[field] != null)
    .map((r) => r[field]);
  if (vals.length < 3) return null;
  const better = vals.filter((v) => v > me[field]).length;
  return { rank: better + 1, of: vals.length };
}

export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Where a value sits in the league's own distribution for one measure.
//
// Competitive brief item 3 (mock 3c). The league table is already in memory --
// one request per side covers every player -- so a percentile is a pass over a
// Map rather than anything fetched, which is what makes it cheap enough to
// draw eight of them on a page.
//
// `min` filters the population, and it matters more than it looks: without it
// the denominator is every player who took one plate appearance, several
// hundred of whom have a 100% or 0% rate on a handful of pitches. That makes
// every regular look average. 100 PA for a batter and 20 innings for a pitcher
// are the usual qualifying-ish floors and are what this defaults to.
const POPULATION_MIN = {
  batter: { field: "b_total_pa", min: 100 },
  pitcher: { field: "p_formatted_ip", min: 20 },
};

function leagueValues(field, kind) {
  const c = cache[kind];
  if (!c) return null;
  const gate = POPULATION_MIN[kind];
  const out = [];
  c.byId.forEach((rec) => {
    if (!rec || rec[field] == null) return;
    if (gate && rec[gate.field] != null && rec[gate.field] < gate.min) return;
    out.push(rec[field]);
  });
  return out.length >= 30 ? out : null;
}

// 0-100. Null until the league table has landed, or when the qualifying
// population is too small to rank against -- never a default of 50, which
// would read as "exactly average" for a player we simply cannot place.
export function statcastPercentile(value, field, kind = "batter") {
  if (value == null) return null;
  const vals = leagueValues(field, kind);
  if (!vals) return null;
  const below = vals.filter((v) => v < value).length;
  const equal = vals.filter((v) => v === value).length;
  // Midpoint of the tied block, so a common round value does not land at the
  // top or bottom of everyone who shares it.
  return Math.round(((below + equal / 2) / vals.length) * 100);
}

export function statcastPercentileFor(mlbId, field, kind = "batter") {
  const rec = statcastFor(mlbId, kind);
  if (!rec || rec[field] == null) return null;
  return { value: rec[field], pct: statcastPercentile(rec[field], field, kind) };
}

// The mean of one measure across a set of players -- a lineup, or a team.
//
// Returns the count it was taken over as well as the value, because a mean of
// four batters and a mean of nine are different claims and the caller has to
// be able to say which it is showing.
export function statcastMean(mlbIds, field, kind = "batter") {
  const vals = (mlbIds || [])
    .map((id) => statcastFor(id, kind))
    .filter((r) => r && r[field] != null)
    .map((r) => r[field]);
  if (!vals.length) return null;
  return { value: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length };
}
