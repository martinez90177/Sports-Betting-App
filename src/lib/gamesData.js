// Data layer for the Games page and the Matchup Overview.
//
// This file is deliberately standalone rather than importing from
// PropLedger.jsx: every helper over there (mlbTeamLogo, MLB_TEAM_ID_ABBR,
// fetchMLBDaySlate, ...) is module-private, and PropLedger.jsx imports
// GamesPage.jsx, so reaching back into it would create an import cycle.
// Three one-line logo builders are duplicated here instead -- far cheaper
// than either refactoring a 14k-line module or debugging a circular import.
//
// Everything follows the same shape the rest of the app uses for remote
// data: render a static mock instantly, then upgrade to the live feed if
// (and only if) it answers. A failed fetch is silent -- the page keeps the
// mock rather than showing an error state for something cosmetic.

// ---------------------------------------------------------------- logos

const MLB_LOGO_SLUG = {
  ARI: "ari", ATL: "atl", BAL: "bal", BOS: "bos", CHC: "chc", CWS: "chw", CIN: "cin", CLE: "cle",
  COL: "col", DET: "det", HOU: "hou", KC: "kc", LAA: "laa", LAD: "lad", MIA: "mia", MIL: "mil",
  MIN: "min", NYM: "nym", NYY: "nyy", ATH: "ath", PHI: "phi", PIT: "pit", SD: "sd", SEA: "sea",
  SF: "sf", STL: "stl", TB: "tb", TEX: "tex", TOR: "tor", WSH: "wsh",
};
const WNBA_LOGO_SLUG = {
  ATL: "atl", CHI: "chi", CON: "conn", DAL: "dal", GS: "gs", IND: "ind", LV: "lv",
  LA: "la", MIN: "min", NY: "ny", PHX: "phx", POR: "por", SEA: "sea", TOR: "tor", WSH: "wsh",
};
const NFL_LOGO_SLUG = {
  PHI: "phi", WAS: "wsh", NYG: "nyg", DAL: "dal", GB: "gb", CHI: "chi", DET: "det",
  MIN: "min", SF: "sf", SEA: "sea", LAR: "lar", ARI: "ari", NO: "no", TB: "tb", ATL: "atl",
  CAR: "car", BUF: "buf", MIA: "mia", NYJ: "nyj", NE: "ne", BAL: "bal", CIN: "cin",
  PIT: "pit", CLE: "cle", HOU: "hou", IND: "ind", JAX: "jax", TEN: "ten", KC: "kc",
  LAC: "lac", LV: "lv", DEN: "den",
};

export const mlbTeamLogo = (abbr) => `https://a.espncdn.com/i/teamlogos/mlb/500/${MLB_LOGO_SLUG[abbr] || String(abbr).toLowerCase()}.png`;
export const wnbaTeamLogo = (abbr) => `https://a.espncdn.com/i/teamlogos/wnba/500/${WNBA_LOGO_SLUG[abbr] || String(abbr).toLowerCase()}.png`;
export const nflTeamLogo = (abbr) => `https://a.espncdn.com/i/teamlogos/nfl/500/${NFL_LOGO_SLUG[abbr] || String(abbr).toLowerCase()}.png`;

export function teamLogo(sport, abbr) {
  if (sport === "wnba") return wnbaTeamLogo(abbr);
  if (sport === "nfl") return nflTeamLogo(abbr);
  return mlbTeamLogo(abbr);
}

// ------------------------------------------------------------ team names
//
// Split into city + name because the two reference recordings disagree on
// purpose: the desktop web app renders the full "Cincinnati Reds", the iOS
// app renders just "Reds". GameCard picks whichever fits its breakpoint.

export const MLB_TEAMS_BY_ABBR = {
  ARI: { city: "Arizona", name: "Diamondbacks" }, ATL: { city: "Atlanta", name: "Braves" },
  BAL: { city: "Baltimore", name: "Orioles" }, BOS: { city: "Boston", name: "Red Sox" },
  CHC: { city: "Chicago", name: "Cubs" }, CWS: { city: "Chicago", name: "White Sox" },
  CIN: { city: "Cincinnati", name: "Reds" }, CLE: { city: "Cleveland", name: "Guardians" },
  COL: { city: "Colorado", name: "Rockies" }, DET: { city: "Detroit", name: "Tigers" },
  HOU: { city: "Houston", name: "Astros" }, KC: { city: "Kansas City", name: "Royals" },
  LAA: { city: "Los Angeles", name: "Angels" }, LAD: { city: "Los Angeles", name: "Dodgers" },
  MIA: { city: "Miami", name: "Marlins" }, MIL: { city: "Milwaukee", name: "Brewers" },
  MIN: { city: "Minnesota", name: "Twins" }, NYM: { city: "New York", name: "Mets" },
  NYY: { city: "New York", name: "Yankees" }, ATH: { city: "", name: "Athletics" },
  PHI: { city: "Philadelphia", name: "Phillies" }, PIT: { city: "Pittsburgh", name: "Pirates" },
  SD: { city: "San Diego", name: "Padres" }, SEA: { city: "Seattle", name: "Mariners" },
  SF: { city: "San Francisco", name: "Giants" }, STL: { city: "St. Louis", name: "Cardinals" },
  TB: { city: "Tampa Bay", name: "Rays" }, TEX: { city: "Texas", name: "Rangers" },
  TOR: { city: "Toronto", name: "Blue Jays" }, WSH: { city: "Washington", name: "Nationals" },
};

export const WNBA_TEAMS_BY_ABBR = {
  ATL: { city: "Atlanta", name: "Dream" }, CHI: { city: "Chicago", name: "Sky" },
  CON: { city: "Connecticut", name: "Sun" }, DAL: { city: "Dallas", name: "Wings" },
  GS: { city: "Golden State", name: "Valkyries" }, IND: { city: "Indiana", name: "Fever" },
  LV: { city: "Las Vegas", name: "Aces" }, LA: { city: "Los Angeles", name: "Sparks" },
  MIN: { city: "Minnesota", name: "Lynx" }, NY: { city: "New York", name: "Liberty" },
  PHX: { city: "Phoenix", name: "Mercury" }, POR: { city: "Portland", name: "Fire" },
  SEA: { city: "Seattle", name: "Storm" }, TOR: { city: "Toronto", name: "Tempo" },
  WSH: { city: "Washington", name: "Mystics" },
};

export const NFL_TEAMS_BY_ABBR = {
  PHI: { city: "Philadelphia", name: "Eagles" }, WAS: { city: "Washington", name: "Commanders" },
  NYG: { city: "New York", name: "Giants" }, DAL: { city: "Dallas", name: "Cowboys" },
  GB: { city: "Green Bay", name: "Packers" }, CHI: { city: "Chicago", name: "Bears" },
  DET: { city: "Detroit", name: "Lions" }, MIN: { city: "Minnesota", name: "Vikings" },
  SF: { city: "San Francisco", name: "49ers" }, SEA: { city: "Seattle", name: "Seahawks" },
  LAR: { city: "Los Angeles", name: "Rams" }, ARI: { city: "Arizona", name: "Cardinals" },
  NO: { city: "New Orleans", name: "Saints" }, TB: { city: "Tampa Bay", name: "Buccaneers" },
  ATL: { city: "Atlanta", name: "Falcons" }, CAR: { city: "Carolina", name: "Panthers" },
  BUF: { city: "Buffalo", name: "Bills" }, MIA: { city: "Miami", name: "Dolphins" },
  NYJ: { city: "New York", name: "Jets" }, NE: { city: "New England", name: "Patriots" },
  BAL: { city: "Baltimore", name: "Ravens" }, CIN: { city: "Cincinnati", name: "Bengals" },
  PIT: { city: "Pittsburgh", name: "Steelers" }, CLE: { city: "Cleveland", name: "Browns" },
  HOU: { city: "Houston", name: "Texans" }, IND: { city: "Indianapolis", name: "Colts" },
  JAX: { city: "Jacksonville", name: "Jaguars" }, TEN: { city: "Tennessee", name: "Titans" },
  KC: { city: "Kansas City", name: "Chiefs" }, LAC: { city: "Los Angeles", name: "Chargers" },
  LV: { city: "Las Vegas", name: "Raiders" }, DEN: { city: "Denver", name: "Broncos" },
};

const TEAMS_BY_SPORT = { mlb: MLB_TEAMS_BY_ABBR, wnba: WNBA_TEAMS_BY_ABBR, nfl: NFL_TEAMS_BY_ABBR };

export function teamInfo(sport, abbr) {
  const t = (TEAMS_BY_SPORT[sport] || {})[abbr];
  if (!t) return { abbr, city: "", name: abbr, full: abbr };
  return { abbr, city: t.city, name: t.name, full: t.city ? `${t.city} ${t.name}` : t.name };
}

export const SPORTS = [
  { id: "mlb", label: "MLB" },
  { id: "wnba", label: "WNBA" },
  { id: "nfl", label: "NFL" },
];

// ------------------------------------------------------------ date utils

// Local-day key. Deliberately not toISOString().slice(0,10) -- that is UTC,
// which rolls over mid-evening in the Americas and would file a 8:20 PM
// first pitch under tomorrow's date tab.
export function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "TODAY", "SUNDAY", or "AUG 11" -- the card's day line. Matches the two
// treatments in the references: the web app writes "TODAY", the iOS app
// writes the weekday name for anything further out.
export function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(dayKey(d)) - new Date(dayKey(today))) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
  return `${MONTH[d.getMonth()]} ${d.getDate()}`;
}

export function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ------------------------------------------------------------- mock data
//
// Records are the real 2026 standings visible in the desktop recording, so
// the mock renders as an exact match for the reference frames.

const MLB_RECORDS = {
  CIN: "56-60", WSH: "58-61", NYM: "51-67", PIT: "58-61", ATH: "46-71", BOS: "64-52",
  TOR: "56-62", PHI: "62-56", ATL: "70-47", NYY: "66-51", LAA: "45-72", MIA: "59-59",
  MIN: "58-60", MIL: "73-44", CHC: "68-50", KC: "49-69", CLE: "58-60", CWS: "60-56",
  COL: "46-71", STL: "58-59", BAL: "56-61", TEX: "59-58", DET: "57-60", SF: "49-68",
  TB: "69-46", SEA: "56-61", LAD: "69-47", ARI: "62-55", HOU: "60-58", SD: "61-57",
};

// Today's slate, transcribed game-for-game from the desktop recording.
const MLB_TODAY = [
  ["CIN", "WSH", "12:15"], ["NYM", "PIT", "13:35"], ["ATH", "BOS", "13:35"],
  ["TOR", "PHI", "13:35"], ["ATL", "NYY", "13:35"], ["LAA", "MIA", "13:40"],
  ["MIN", "MIL", "14:10"], ["CHC", "KC", "14:10"], ["CLE", "CWS", "14:10"],
  ["COL", "STL", "14:15"], ["BAL", "TEX", "14:35"], ["DET", "SF", "16:05"],
  ["TB", "SEA", "16:10"], ["LAD", "ARI", "16:10"], ["HOU", "SD", "20:20"],
];

// The other three date tabs reuse the same 30 teams in a rotated pairing so
// each day has a distinct, full slate without hand-writing 45 more matchups.
// Purely presentational -- the live fetch replaces all of it.
function rotatedSlate(offset) {
  const teams = Object.keys(MLB_RECORDS);
  const shift = offset * 7;
  const times = ["13:05", "13:10", "13:40", "16:05", "16:10", "18:40", "19:05", "19:10", "19:15", "19:40", "20:10", "21:40"];
  const out = [];
  for (let i = 0; i < 12; i++) {
    const a = teams[(i * 2 + shift) % teams.length];
    const b = teams[(i * 2 + 1 + shift) % teams.length];
    if (a === b) continue;
    out.push([a, b, times[i]]);
  }
  return out;
}

const WNBA_RECORDS = {
  ATL: "18-14", CHI: "11-21", CON: "8-24", DAL: "13-19", GS: "17-15", IND: "19-13",
  LV: "24-8", LA: "14-18", MIN: "26-6", NY: "22-10", PHX: "20-12", POR: "9-23",
  SEA: "16-16", TOR: "10-22", WSH: "12-20",
};

const WNBA_SLATES = {
  0: [["NY", "ATL", "13:00"], ["LV", "PHX", "16:00"], ["MIN", "SEA", "18:00"], ["IND", "CHI", "20:00"]],
  1: [["CON", "WSH", "13:00"], ["DAL", "LA", "16:30"], ["GS", "POR", "19:00"]],
  2: [["TOR", "NY", "12:00"], ["PHX", "MIN", "15:00"], ["CHI", "LV", "19:30"], ["SEA", "GS", "22:00"]],
  3: [["ATL", "IND", "19:00"], ["WSH", "DAL", "20:00"], ["LA", "CON", "19:30"]],
};

// NFL Week 1, 2026. The season has not been played at the time of writing,
// so these pairings are placeholders in the correct Thu/Sun/Mon shape --
// fetchNflWeekOneSlate replaces them with ESPN's real bracket once the
// schedule is published. Every team is 0-0 in Week 1 by definition.
const NFL_WEEK1 = [
  ["DAL", "PHI", "2026-09-10T20:20"],
  ["KC", "BAL", "2026-09-13T13:00"], ["CIN", "CLE", "2026-09-13T13:00"],
  ["MIA", "BUF", "2026-09-13T13:00"], ["NYJ", "NE", "2026-09-13T13:00"],
  ["JAX", "IND", "2026-09-13T13:00"], ["TEN", "HOU", "2026-09-13T13:00"],
  ["CAR", "ATL", "2026-09-13T13:00"], ["TB", "NO", "2026-09-13T13:00"],
  ["ARI", "SF", "2026-09-13T16:05"], ["SEA", "LAR", "2026-09-13T16:05"],
  ["DEN", "LV", "2026-09-13T16:25"], ["LAC", "PIT", "2026-09-13T16:25"],
  ["GB", "DET", "2026-09-13T20:20"],
  ["CHI", "MIN", "2026-09-14T20:15"], ["NYG", "WAS", "2026-09-14T20:15"],
];

function makeGame(sport, awayAbbr, homeAbbr, iso, records) {
  const away = teamInfo(sport, awayAbbr);
  const home = teamInfo(sport, homeAbbr);
  return {
    id: `${sport}-${awayAbbr}-${homeAbbr}-${iso}`,
    sport,
    startsAt: iso,
    away: { ...away, record: records ? records[awayAbbr] || "" : "0-0" },
    home: { ...home, record: records ? records[homeAbbr] || "" : "0-0" },
    probables: null,
  };
}

// Local ISO for a given day + "HH:MM", kept in local time so the card time
// matches the date tab it is filed under.
function localIso(date, hhmm) {
  const [h, m] = hhmm.split(":");
  const d = new Date(date);
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toISOString();
}

export function mockGames(sport, offset) {
  const date = addDays(new Date(), offset);
  if (sport === "mlb") {
    const rows = offset === 0 ? MLB_TODAY : rotatedSlate(offset);
    return rows.map(([a, h, t]) => makeGame("mlb", a, h, localIso(date, t), MLB_RECORDS));
  }
  if (sport === "wnba") {
    const rows = WNBA_SLATES[((offset % 4) + 4) % 4] || [];
    return rows.map(([a, h, t]) => makeGame("wnba", a, h, localIso(date, t), WNBA_RECORDS));
  }
  return [];
}

export function mockNflWeekOne() {
  return NFL_WEEK1.map(([a, h, iso]) => makeGame("nfl", a, h, new Date(iso).toISOString(), null));
}

// ------------------------------------------------------------- date tabs
//
// MLB and WNBA get the reference's rolling yesterday/Today/+1/+2. NFL is a
// week competition, so its tabs are the distinct kickoff days of Week 1 --
// same component, different source list.

export function buildDateTabs(sport, nflGames) {
  if (sport === "nfl") {
    const seen = [];
    (nflGames || []).forEach((g) => {
      const k = dayKey(new Date(g.startsAt));
      if (!seen.includes(k)) seen.push(k);
    });
    return seen.sort().map((k) => {
      const d = new Date(`${k}T12:00:00`);
      return { key: k, label: `${MONTH[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`, sub: WEEKDAY[d.getDay()] };
    });
  }
  return [-1, 0, 1, 2].map((offset) => {
    const d = addDays(new Date(), offset);
    return {
      key: dayKey(d),
      offset,
      label: offset === 0 ? "Today" : `${MONTH[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`,
      sub: WEEKDAY[d.getDay()],
    };
  });
}

// ---------------------------------------------------------- live fetchers
//
// Same cache-then-TTL discipline the rest of the app uses. Each returns
// null on any failure so the caller can simply keep the mock.

const SLATE_TTL_MS = 15 * 60 * 1000;
const slateCache = new Map();

function cached(key) {
  const hit = slateCache.get(key);
  if (hit && Date.now() - hit.at < SLATE_TTL_MS) return hit.value;
  return undefined;
}
function store(key, value) {
  slateCache.set(key, { value, at: Date.now() });
  return value;
}

const MLB_ID_ABBR = {
  109: "ARI", 144: "ATL", 110: "BAL", 111: "BOS", 112: "CHC", 145: "CWS", 113: "CIN", 114: "CLE",
  115: "COL", 116: "DET", 117: "HOU", 118: "KC", 108: "LAA", 119: "LAD", 146: "MIA", 158: "MIL",
  142: "MIN", 121: "NYM", 147: "NYY", 133: "ATH", 143: "PHI", 134: "PIT", 135: "SD", 136: "SEA",
  137: "SF", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 120: "WSH",
};

// One request covers both surfaces: the card list needs teams/records/time,
// and the Matchup Overview needs the probable starters -- hydrate=probablePitcher
// returns them together, so opening a matchup costs no extra round trip.
export async function fetchMlbSlate(key) {
  const ck = `mlb:${key}`;
  const hit = cached(ck);
  if (hit !== undefined) return hit;
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${key}&hydrate=probablePitcher`);
    const data = await res.json();
    const games = (data?.dates || []).flatMap((d) => d.games || []).map((g) => {
      const awayAbbr = MLB_ID_ABBR[g.teams?.away?.team?.id];
      const homeAbbr = MLB_ID_ABBR[g.teams?.home?.team?.id];
      if (!awayAbbr || !homeAbbr) return null;
      const rec = (side) => {
        const r = g.teams?.[side]?.leagueRecord;
        return r ? `${r.wins}-${r.losses}` : "";
      };
      const pitcher = (side) => {
        const p = g.teams?.[side]?.probablePitcher;
        return p ? { name: p.fullName, id: p.id } : null;
      };
      return {
        id: `mlb-${g.gamePk}`,
        sport: "mlb",
        startsAt: g.gameDate,
        away: { ...teamInfo("mlb", awayAbbr), record: rec("away") },
        home: { ...teamInfo("mlb", homeAbbr), record: rec("home") },
        probables: { away: pitcher("away"), home: pitcher("home") },
      };
    }).filter(Boolean).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    return store(ck, games.length ? games : null);
  } catch {
    return store(ck, null);
  }
}

const ESPN_PATH = { wnba: "basketball/wnba", nfl: "football/nfl" };

function espnSlate(sport, events) {
  return (events || []).map((ev) => {
    const comp = ev.competitions?.[0];
    const away = comp?.competitors?.find((c) => c.homeAway === "away");
    const home = comp?.competitors?.find((c) => c.homeAway === "home");
    const awayAbbr = away?.team?.abbreviation;
    const homeAbbr = home?.team?.abbreviation;
    if (!awayAbbr || !homeAbbr) return null;
    return {
      id: `${sport}-${ev.id}`,
      sport,
      startsAt: ev.date,
      away: { ...teamInfo(sport, awayAbbr), record: away?.records?.[0]?.summary || "" },
      home: { ...teamInfo(sport, homeAbbr), record: home?.records?.[0]?.summary || "" },
      probables: null,
    };
  }).filter(Boolean).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

export async function fetchWnbaSlate(key) {
  const ck = `wnba:${key}`;
  const hit = cached(ck);
  if (hit !== undefined) return hit;
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH.wnba}/scoreboard?dates=${key.replace(/-/g, "")}`);
    const data = await res.json();
    const games = espnSlate("wnba", data?.events);
    return store(ck, games.length ? games : null);
  } catch {
    return store(ck, null);
  }
}

// Pinned to week=1 on purpose -- PropLedger's own fetchNFLWeekSlate derives
// the *current* week, but this page was asked for Week 1 specifically.
export async function fetchNflWeekOneSlate() {
  const ck = "nfl:week1";
  const hit = cached(ck);
  if (hit !== undefined) return hit;
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH.nfl}/scoreboard?seasontype=2&week=1&dates=2026`);
    const data = await res.json();
    const games = espnSlate("nfl", data?.events);
    return store(ck, games.length ? games : null);
  } catch {
    return store(ck, null);
  }
}

// ----------------------------------------------------------- recent form
//
// Last N finals for one team, for the Matchup Overview's two-sided game log.
// Mock is seeded off the team abbreviation so a given team's form is stable
// across re-renders and across the two halves of the log.

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

function mockForm(sport, abbr, n) {
  const rng = mulberry32(seedFrom(`${sport}:${abbr}`));
  const pool = Object.keys(TEAMS_BY_SPORT[sport] || {}).filter((t) => t !== abbr);
  const out = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const opp = pool[Math.floor(rng() * pool.length)] || abbr;
    const home = rng() > 0.5;
    let us;
    let them;
    if (sport === "mlb") { us = Math.floor(rng() * 10); them = Math.floor(rng() * 10); }
    else if (sport === "wnba") { us = 68 + Math.floor(rng() * 26); them = 68 + Math.floor(rng() * 26); }
    else { us = 13 + Math.floor(rng() * 24); them = 13 + Math.floor(rng() * 24); }
    if (us === them) them = us + 1;
    const d = addDays(today, -(i + 1) * (sport === "nfl" ? 7 : 1));
    out.push({ date: `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}`, opp, home, us, them, win: us > them });
  }
  return out;
}

const formCache = new Map();

// Real finals where they are one cheap request away, mock otherwise. MLB
// goes through StatsAPI; WNBA/NFL use ESPN's team schedule, which accepts
// the team abbreviation directly in the path (no id map needed).
export async function fetchRecentForm(sport, abbr, n) {
  const ck = `${sport}:${abbr}:${n}`;
  const hit = formCache.get(ck);
  if (hit && Date.now() - hit.at < SLATE_TTL_MS) return hit.value;

  let rows = null;
  try {
    if (sport === "mlb") {
      const id = Object.keys(MLB_ID_ABBR).find((k) => MLB_ID_ABBR[k] === abbr);
      const end = dayKey(new Date());
      const start = dayKey(addDays(new Date(), -45));
      const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${id}&startDate=${start}&endDate=${end}`);
      const data = await res.json();
      const finals = (data?.dates || []).flatMap((d) => d.games || [])
        .filter((g) => g.status?.abstractGameState === "Final")
        .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate))
        .slice(0, n);
      rows = finals.map((g) => {
        const isHome = MLB_ID_ABBR[g.teams?.home?.team?.id] === abbr;
        const mine = isHome ? g.teams.home : g.teams.away;
        const theirs = isHome ? g.teams.away : g.teams.home;
        const d = new Date(g.gameDate);
        return {
          date: `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}`,
          opp: MLB_ID_ABBR[theirs?.team?.id] || "",
          home: isHome,
          us: mine?.score ?? 0,
          them: theirs?.score ?? 0,
          win: (mine?.score ?? 0) > (theirs?.score ?? 0),
        };
      });
    } else {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams/${abbr}/schedule`);
      const data = await res.json();
      const finals = (data?.events || [])
        .filter((e) => e.competitions?.[0]?.status?.type?.completed)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, n);
      rows = finals.map((e) => {
        const comp = e.competitions[0];
        const mine = comp.competitors.find((c) => c.team?.abbreviation === abbr);
        const theirs = comp.competitors.find((c) => c.team?.abbreviation !== abbr);
        const d = new Date(e.date);
        return {
          date: `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}`,
          opp: theirs?.team?.abbreviation || "",
          home: mine?.homeAway === "home",
          us: Number(mine?.score?.value ?? mine?.score ?? 0),
          them: Number(theirs?.score?.value ?? theirs?.score ?? 0),
          win: !!mine?.winner,
        };
      });
    }
  } catch {
    rows = null;
  }

  const value = rows && rows.length ? rows : mockForm(sport, abbr, n);
  formCache.set(ck, { value, at: Date.now() });
  return value;
}

// Season series between two teams, shown on the Matchup Overview when it is
// available. MLB only -- ESPN's scoreboard has no equally cheap H2H view.
export async function fetchHeadToHead(sport, awayAbbr, homeAbbr) {
  if (sport !== "mlb") return null;
  const ck = `h2h:${awayAbbr}:${homeAbbr}`;
  const hit = formCache.get(ck);
  if (hit && Date.now() - hit.at < SLATE_TTL_MS) return hit.value;
  try {
    const awayId = Object.keys(MLB_ID_ABBR).find((k) => MLB_ID_ABBR[k] === awayAbbr);
    const homeId = Object.keys(MLB_ID_ABBR).find((k) => MLB_ID_ABBR[k] === homeAbbr);
    const year = new Date().getFullYear();
    const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${awayId}&opponentId=${homeId}&startDate=${year}-03-01&endDate=${dayKey(new Date())}`);
    const data = await res.json();
    const finals = (data?.dates || []).flatMap((d) => d.games || []).filter((g) => g.status?.abstractGameState === "Final");
    if (!finals.length) return null;
    let awayWins = 0;
    finals.forEach((g) => {
      const aIsHome = MLB_ID_ABBR[g.teams?.home?.team?.id] === awayAbbr;
      const a = aIsHome ? g.teams.home : g.teams.away;
      const b = aIsHome ? g.teams.away : g.teams.home;
      if ((a?.score ?? 0) > (b?.score ?? 0)) awayWins++;
    });
    const value = { games: finals.length, awayWins, homeWins: finals.length - awayWins };
    formCache.set(ck, { value, at: Date.now() });
    return value;
  } catch {
    return null;
  }
}
