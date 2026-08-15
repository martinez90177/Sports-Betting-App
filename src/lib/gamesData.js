// Data layer for the Games page and the Matchup Overview.
//
// This file is deliberately standalone rather than importing from
// PropLedger.jsx: every helper over there (mlbTeamLogo, MLB_TEAM_ID_ABBR,
// fetchMLBDaySlate, ...) is module-private, and PropLedger.jsx imports
// GamesPage.jsx, so reaching back into it would create an import cycle.
// Three one-line logo builders are duplicated here instead -- far cheaper
// than either refactoring a 14k-line module or debugging a circular import.
//
// Everything here is live. There used to be a static mock rendered instantly
// and upgraded in place once the feed answered, which meant the Games page
// opened on invented matchups and hardcoded team records. Callers now show a
// loading state until real data lands, and an empty state if there genuinely
// is none -- a fabricated slate on screen for half a second is still a
// fabricated slate.

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


// Local ISO for a given day + "HH:MM", kept in local time so the card time
// matches the date tab it is filed under.
function localIso(date, hhmm) {
  const [h, m] = hhmm.split(":");
  const d = new Date(date);
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toISOString();
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
// Same cache-then-TTL discipline the rest of the app uses. Each returns null
// on any failure, which the caller renders as a loading or empty state rather
// than substituting anything.

const SLATE_TTL_MS = 15 * 60 * 1000;
// Live days need much fresher data; the poller also bypasses cache.
const LIVE_TTL_MS = 18 * 1000;
const slateCache = new Map();

function cached(key, { live = false } = {}) {
  const hit = slateCache.get(key);
  if (!hit) return undefined;
  const ttl = live ? LIVE_TTL_MS : SLATE_TTL_MS;
  if (Date.now() - hit.at < ttl) return hit.value;
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

// ---------------------------------------------------------------- status
//
// Normalize provider-specific status into a small set the UI can sort and
// style against. We never invent LIVE/FINAL from wall-clock time — only
// from what the API reports.

export const GAME_STATUS = {
  UPCOMING: "UPCOMING",
  STARTING_SOON: "STARTING_SOON",
  LIVE: "LIVE",
  HALFTIME: "HALFTIME",
  INTERMISSION: "INTERMISSION",
  DELAYED: "DELAYED",
  POSTPONED: "POSTPONED",
  SUSPENDED: "SUSPENDED",
  FINAL: "FINAL",
};

const STARTING_SOON_MS = 30 * 60 * 1000; // 30 minutes before first pitch/tip

// abstractGameState is NOT a reliable live signal: MLB reports "Live" for the
// whole warmup window too (detailedState "Warmup", codedGameState "P"), which
// had games claiming to be underway ~30 minutes before first pitch while ESPN
// still showed the start time. Only codedGameState "I" / "In Progress" means
// the game has actually started; everything earlier is pre-game.
function mlbStatus(g) {
  const abs = g?.status?.abstractGameState || "";
  const coded = g?.status?.codedGameState || "";
  const detailed = (g?.status?.detailedState || "").toLowerCase();
  const inProgress = coded === "I" || detailed === "in progress";

  if (abs === "Final" || detailed.includes("final")) return GAME_STATUS.FINAL;
  if (detailed.includes("postponed")) return GAME_STATUS.POSTPONED;
  if (detailed.includes("suspended")) return GAME_STATUS.SUSPENDED;
  if (detailed.includes("delay")) return GAME_STATUS.DELAYED;
  if (inProgress) return GAME_STATUS.LIVE;

  // Warmup is the state this fix exists for: MLB reports it under
  // abstractGameState "Live", and it is always within about half an hour of
  // first pitch, so it is STARTING SOON outright. Not gated on the clock --
  // that would bounce a warming-up game back to UPCOMING the moment its
  // scheduled first pitch slipped past. Pre-Game deliberately falls through to
  // the clock check below instead: MLB can set it well over an hour out.
  if (detailed.includes("warmup")) return GAME_STATUS.STARTING_SOON;

  const start = new Date(g.gameDate).getTime();
  if (start - Date.now() <= STARTING_SOON_MS && start > Date.now()) return GAME_STATUS.STARTING_SOON;
  return GAME_STATUS.UPCOMING;
}

function mlbPeriodLabel(g) {
  const ls = g?.linescore;
  if (!ls) return null;
  const inn = ls.currentInningOrdinal || (ls.currentInning ? `${ls.currentInning}` : null);
  const half = ls.inningState || ls.inningHalf || "";
  const outs = ls.outs;
  if (!inn) return null;
  const halfPart = half ? half.toUpperCase() : "";
  const outPart = typeof outs === "number" ? ` • ${outs} OUT${outs === 1 ? "" : "S"}` : "";
  return `${halfPart} ${inn}${outPart}`.trim();
}

function espnStatus(comp) {
  const t = comp?.status?.type || {};
  const name = (t.name || "").toUpperCase();
  const state = (t.state || "").toLowerCase();
  const desc = (t.description || t.detail || "").toLowerCase();

  if (t.completed || state === "post" || name.includes("FINAL") || desc.includes("final")) {
    return GAME_STATUS.FINAL;
  }
  if (name.includes("HALFTIME") || desc.includes("halftime")) return GAME_STATUS.HALFTIME;
  if (name.includes("END OF") || name.includes("INTERMISSION") || desc.includes("intermission")) {
    return GAME_STATUS.INTERMISSION;
  }
  if (name.includes("DELAY") || desc.includes("delay")) return GAME_STATUS.DELAYED;
  if (name.includes("POSTPONED") || desc.includes("postponed")) return GAME_STATUS.POSTPONED;
  if (name.includes("SUSPENDED") || desc.includes("suspended")) return GAME_STATUS.SUSPENDED;
  if (state === "in" || name.includes("IN_PROGRESS") || name.includes("STATUS_IN_PROGRESS")) {
    return GAME_STATUS.LIVE;
  }
  // pre
  const start = new Date(comp?.date || 0).getTime();
  if (start - Date.now() <= STARTING_SOON_MS && start > Date.now()) return GAME_STATUS.STARTING_SOON;
  return GAME_STATUS.UPCOMING;
}

function espnPeriodLabel(comp, sport) {
  const st = comp?.status || {};
  const t = st.type || {};
  if (t.completed) return "FINAL";
  if ((t.name || "").toUpperCase().includes("HALFTIME")) return "HALFTIME";

  const period = st.period;
  const clock = st.displayClock || (typeof st.clock === "number" ? formatClock(st.clock) : null);

  if (sport === "nfl") {
    const situation = comp?.situation;
    const down = situation?.downDistanceText || situation?.shortDownDistanceText;
    const poss = situation?.possessionText;
    const parts = [];
    if (period) parts.push(ordinal(period));
    if (clock && clock !== "0.0") parts.push(clock);
    let label = parts.join(" • ");
    if (down) label = label ? `${label}\n${down}` : down;
    return label || t.shortDetail || null;
  }

  // WNBA / basketball
  if (period) {
    const q = period <= 4 ? `${ordinal(period)}` : `OT${period - 4}`;
    return clock && clock !== "0.0" ? `${q} • ${clock}` : q;
  }
  return t.shortDetail || t.detail || null;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatClock(seconds) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Sort priority for the Games list. Lower number = higher on the page.
export function statusSortKey(status) {
  switch (status) {
    case GAME_STATUS.LIVE:
    case GAME_STATUS.HALFTIME:
    case GAME_STATUS.INTERMISSION: return 0;
    case GAME_STATUS.STARTING_SOON: return 1;
    case GAME_STATUS.UPCOMING: return 2;
    case GAME_STATUS.DELAYED:
    case GAME_STATUS.SUSPENDED: return 3;
    case GAME_STATUS.POSTPONED: return 4;
    case GAME_STATUS.FINAL: return 5;
    default: return 6;
  }
}

export function isActiveStatus(status) {
  return status === GAME_STATUS.LIVE
    || status === GAME_STATUS.HALFTIME
    || status === GAME_STATUS.INTERMISSION
    || status === GAME_STATUS.STARTING_SOON;
}

// Which screen a GameCard opens. Once the ball is in play the pre-game
// Matchup Overview (probables, recent form, H2H) stops being the useful view,
// so anything that has started -- or finished -- gets the Gamecast instead.
// STARTING_SOON deliberately stays on the Matchup Overview: there is no
// linescore or box score to show yet.
export function opensGamecast(status) {
  return status === GAME_STATUS.LIVE
    || status === GAME_STATUS.HALFTIME
    || status === GAME_STATUS.INTERMISSION
    || status === GAME_STATUS.DELAYED
    || status === GAME_STATUS.SUSPENDED
    || status === GAME_STATUS.FINAL;
}

// One request covers both surfaces: the card list needs teams/records/time,
// and the Matchup Overview needs the probable starters -- hydrate=probablePitcher
// + linescore returns them together, so opening a matchup costs no extra round trip.
export async function fetchMlbSlate(key, { force = false } = {}) {
  const ck = `mlb:${key}`;
  if (!force) {
    const hit = cached(ck, { live: true });
    if (hit !== undefined) return hit;
  }
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${key}&hydrate=probablePitcher,linescore`
    );
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
      const status = mlbStatus(g);
      const isLive = status === GAME_STATUS.LIVE
        || status === GAME_STATUS.HALFTIME
        || status === GAME_STATUS.INTERMISSION;
      const isFinal = status === GAME_STATUS.FINAL;
      // Only surface scores once the game has actually started (or finished).
      // Preview games often come back with score:0 from the API.
      // A suspended game, or one delayed mid-innings, has a real score the
      // Gamecast needs. A *pre-game* delay ("Delayed Start: Rain") does not --
      // codedGameState still reads "P" there, so it stays scoreless.
      const started = isLive || isFinal
        || status === GAME_STATUS.SUSPENDED
        || (status === GAME_STATUS.DELAYED && g?.status?.codedGameState === "I");
      const awayScore = started && typeof g.teams?.away?.score === "number"
        ? g.teams.away.score : null;
      const homeScore = started && typeof g.teams?.home?.score === "number"
        ? g.teams.home.score : null;
      return {
        id: `mlb-${g.gamePk}`,
        gamePk: g.gamePk,
        sport: "mlb",
        startsAt: g.gameDate,
        away: {
          ...teamInfo("mlb", awayAbbr),
          record: rec("away"),
          score: awayScore,
        },
        home: {
          ...teamInfo("mlb", homeAbbr),
          record: rec("home"),
          score: homeScore,
        },
        probables: { away: pitcher("away"), home: pitcher("home") },
        status,
        // For finished games the center already says FINAL; period detail is noise.
        periodLabel: isLive ? mlbPeriodLabel(g) : null,
        isLive,
        isFinal,
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

    const status = espnStatus(comp);
    const isLive = status === GAME_STATUS.LIVE
      || status === GAME_STATUS.HALFTIME
      || status === GAME_STATUS.INTERMISSION;
    const isFinal = status === GAME_STATUS.FINAL;
    const awayScoreRaw = away?.score;
    const homeScoreRaw = home?.score;
    const awayNum = awayScoreRaw != null && awayScoreRaw !== "" ? Number(awayScoreRaw) : null;
    const homeNum = homeScoreRaw != null && homeScoreRaw !== "" ? Number(homeScoreRaw) : null;
    // Only surface scores once the game has started or finished. A delayed or
    // suspended game counts only when ESPN says play is underway -- unlike MLB,
    // ESPN also reports DELAYED for a start that has not happened yet.
    const inPlay = (comp?.status?.type?.state || "").toLowerCase() === "in";
    const started = isLive || isFinal
      || (inPlay && (status === GAME_STATUS.DELAYED || status === GAME_STATUS.SUSPENDED));
    const awayScore = started && Number.isFinite(awayNum) ? awayNum : null;
    const homeScore = started && Number.isFinite(homeNum) ? homeNum : null;

    return {
      id: `${sport}-${ev.id}`,
      // Kept explicitly rather than parsed back off `id` -- the Gamecast's
      // ESPN summary lookup needs the raw event id.
      espnEventId: ev.id,
      sport,
      startsAt: ev.date,
      away: {
        ...teamInfo(sport, awayAbbr),
        record: away?.records?.[0]?.summary || "",
        score: awayScore,
      },
      home: {
        ...teamInfo(sport, homeAbbr),
        record: home?.records?.[0]?.summary || "",
        score: homeScore,
      },
      probables: null,
      status,
      periodLabel: isLive ? espnPeriodLabel(comp, sport) : null,
      isLive,
      isFinal,
    };
  }).filter(Boolean).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

export async function fetchWnbaSlate(key, { force = false } = {}) {
  const ck = `wnba:${key}`;
  if (!force) {
    const hit = cached(ck, { live: true });
    if (hit !== undefined) return hit;
  }
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
export async function fetchNflWeekOneSlate({ force = false } = {}) {
  const ck = "nfl:week1";
  if (!force) {
    const hit = cached(ck, { live: true });
    if (hit !== undefined) return hit;
  }
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH.nfl}/scoreboard?seasontype=2&week=1&dates=2026`);
    const data = await res.json();
    const games = espnSlate("nfl", data?.events);
    return store(ck, games.length ? games : null);
  } catch {
    return store(ck, null);
  }
}

// -------------------------------------------------------------- gamecast
//
// Detail behind a live/final game: the linescore and the statistical leaders.
// There is no mock fallback anywhere in here on purpose -- a Gamecast that
// invented an inning line or a leader would be indistinguishable from a real
// one. Every value below is read straight off MLB Stats API or ESPN, and any
// gap resolves to null so the page can render an honest empty state.
//
// Both providers are normalized into one shape so GamecastPage stays generic:
//
//   columns  [{ key, label }]        innings/quarters, then the total columns
//   rows     [{ abbr, cells: [] }]   away first, aligned 1:1 with `columns`
//   leaders  [{ teamAbbr, items }]   items: { category, name, statLine, headshot }

// MLB's own headshot CDN, keyed by the same person id the boxscore returns.
const mlbHeadshot = (id) => `https://midfield.mlbstatic.com/v1/people/${id}/spots/120`;

function mlbGamecast(feed) {
  const live = feed?.liveData;
  const ls = live?.linescore;
  const innings = ls?.innings || [];
  if (!innings.length) return null;

  const columns = innings.map((inn) => ({
    key: `i${inn.num}`,
    label: inn.ordinalNum ? String(inn.num) : String(inn.num),
  }));
  columns.push({ key: "R", label: "R", total: true });
  columns.push({ key: "H", label: "H", total: true });
  columns.push({ key: "E", label: "E", total: true });

  const side = (which) => {
    const abbr = feed?.gameData?.teams?.[which]?.abbreviation;
    const cells = innings.map((inn) => {
      const r = inn?.[which]?.runs;
      // A half-inning that hasn't been played yet has no `runs` key at all --
      // that must stay blank rather than becoming a 0 the team never scored.
      return typeof r === "number" ? String(r) : "";
    });
    const t = ls?.teams?.[which] || {};
    cells.push(typeof t.runs === "number" ? String(t.runs) : "");
    cells.push(typeof t.hits === "number" ? String(t.hits) : "");
    cells.push(typeof t.errors === "number" ? String(t.errors) : "");
    return { abbr, cells };
  };

  // Leaders: the side's best bat by hits (RBI, then HR, break ties) plus the
  // starter, who is always first in `pitchers`. MLB pre-formats both stat
  // lines as `summary`, so nothing is recomputed here.
  const boxSide = (which) => {
    const team = live?.boxscore?.teams?.[which];
    if (!team) return null;
    const abbr = feed?.gameData?.teams?.[which]?.abbreviation;
    const player = (id) => team.players?.[`ID${id}`];
    const items = [];

    const bats = (team.batters || []).map(player).filter((p) => p?.stats?.batting?.summary);
    if (bats.length) {
      const best = bats.slice().sort((a, b) => {
        const s = (p, k) => p.stats.batting[k] || 0;
        return (s(b, "hits") - s(a, "hits")) || (s(b, "rbi") - s(a, "rbi"))
          || (s(b, "homeRuns") - s(a, "homeRuns"));
      })[0];
      if ((best.stats.batting.atBats || 0) > 0) {
        items.push({
          category: "Batting",
          name: best.person?.fullName,
          statLine: best.stats.batting.summary,
          headshot: best.person?.id ? mlbHeadshot(best.person.id) : null,
        });
      }
    }

    const starter = (team.pitchers || []).map(player).find((p) => p?.stats?.pitching?.summary);
    if (starter) {
      items.push({
        category: "Pitching",
        name: starter.person?.fullName,
        statLine: starter.stats.pitching.summary,
        headshot: starter.person?.id ? mlbHeadshot(starter.person.id) : null,
      });
    }
    return items.length ? { teamAbbr: abbr, items } : null;
  };

  const decisions = Object.entries(live?.decisions || {})
    .map(([role, p]) => (p?.fullName ? { role, name: p.fullName } : null))
    .filter(Boolean);

  return {
    columns,
    rows: [side("away"), side("home")],
    leaders: [boxSide("away"), boxSide("home")].filter(Boolean),
    decisions: decisions.length ? decisions : null,
  };
}

function espnGamecast(summary) {
  const comp = summary?.header?.competitions?.[0];
  const competitors = comp?.competitors || [];
  const away = competitors.find((c) => c.homeAway === "away");
  const home = competitors.find((c) => c.homeAway === "home");
  if (!away || !home) return null;

  const periodCount = Math.max(away.linescores?.length || 0, home.linescores?.length || 0);
  if (!periodCount) return null;

  const columns = [];
  for (let i = 0; i < periodCount; i += 1) {
    // Anything past regulation is overtime; WNBA and NFL both run 4 quarters.
    columns.push({ key: `p${i + 1}`, label: i < 4 ? String(i + 1) : `OT${i - 3}` });
  }
  columns.push({ key: "T", label: "T", total: true });

  const side = (c) => {
    const cells = [];
    for (let i = 0; i < periodCount; i += 1) {
      const v = c.linescores?.[i]?.displayValue;
      cells.push(v != null ? String(v) : "");
    }
    cells.push(c.score != null && c.score !== "" ? String(c.score) : "");
    return { abbr: c.team?.abbreviation, cells };
  };

  const leaders = (summary?.leaders || []).map((t) => {
    const items = (t.leaders || []).map((cat) => {
      // ESPN emits categories with an empty leader list (a game with no sacks,
      // for instance) -- those are dropped rather than rendered blank.
      const top = cat.leaders?.[0];
      if (!top?.athlete?.displayName || !top.displayValue) return null;
      return {
        category: cat.displayName || cat.name,
        name: top.athlete.displayName,
        statLine: top.displayValue,
        headshot: top.athlete.headshot?.href || null,
      };
    }).filter(Boolean);
    return items.length ? { teamAbbr: t.team?.abbreviation, items } : null;
  }).filter(Boolean);

  return { columns, rows: [side(away), side(home)], leaders, decisions: null };
}

// Detail for one opened game. Returns null whenever the provider has nothing
// usable yet (a game in a rain delay before the first pitch has no linescore),
// which the page renders as an empty state.
export async function fetchGamecastDetail(game, { force = false } = {}) {
  if (!game) return null;
  const ck = `gamecast:${game.id}`;
  if (!force) {
    const hit = cached(ck, { live: true });
    if (hit !== undefined) return hit;
  }
  try {
    if (game.sport === "mlb") {
      if (!game.gamePk) return store(ck, null);
      const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`);
      const data = await res.json();
      return store(ck, mlbGamecast(data));
    }
    const path = ESPN_PATH[game.sport];
    if (!path || !game.espnEventId) return store(ck, null);
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${game.espnEventId}`
    );
    const data = await res.json();
    return store(ck, espnGamecast(data));
  } catch {
    return store(ck, null);
  }
}

// ----------------------------------------------------------- recent form
//

const formCache = new Map();

// Real finals only -- an empty array when there are none. MLB
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

  // Empty array, not invented games. This used to fall through to
  // mockForm(), which generated plausible W/L results and final scores off a
  // seed -- and did so silently, so a failed fetch or an out-of-season team
  // showed a fabricated recent-form strip that was indistinguishable from a
  // real one. The caller renders "no recent games" instead.
  //
  // Failures are deliberately not cached, so the next visit retries rather
  // than being stuck on an empty strip for the whole TTL.
  const value = rows && rows.length ? rows : [];
  if (value.length) formCache.set(ck, { value, at: Date.now() });
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
