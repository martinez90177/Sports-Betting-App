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

// The app's NBA abbreviations are ESPN's *long* ones (NYK, SAS, GSW, NOP, UTA,
// WAS); ESPN's scoreboard reports six of them short. espnAbbr below is what
// reconciles the two -- get it wrong and a team silently loses its logo and
// its name at the same time.
const NBA_LOGO_SLUG = {
  ATL: "atl", BKN: "bkn", BOS: "bos", CHA: "cha", CHI: "chi", CLE: "cle",
  DAL: "dal", DEN: "den", DET: "det", GSW: "gs", HOU: "hou", IND: "ind",
  LAC: "lac", LAL: "lal", MEM: "mem", MIA: "mia", MIL: "mil", MIN: "min",
  NOP: "no", NYK: "ny", OKC: "okc", ORL: "orl", PHI: "phi", PHX: "phx",
  POR: "por", SAC: "sac", SAS: "sa", TOR: "tor", UTA: "utah", WAS: "wsh",
};

export const mlbTeamLogo = (abbr) => `https://a.espncdn.com/i/teamlogos/mlb/500/${MLB_LOGO_SLUG[abbr] || String(abbr).toLowerCase()}.png`;
export const nbaTeamLogo = (abbr) => `https://a.espncdn.com/i/teamlogos/nba/500/${NBA_LOGO_SLUG[abbr] || String(abbr).toLowerCase()}.png`;
export const wnbaTeamLogo = (abbr) => `https://a.espncdn.com/i/teamlogos/wnba/500/${WNBA_LOGO_SLUG[abbr] || String(abbr).toLowerCase()}.png`;
export const nflTeamLogo = (abbr) => `https://a.espncdn.com/i/teamlogos/nfl/500/${NFL_LOGO_SLUG[abbr] || String(abbr).toLowerCase()}.png`;

export function teamLogo(sport, abbr) {
  if (sport === "wnba") return wnbaTeamLogo(abbr);
  if (sport === "nfl") return nflTeamLogo(abbr);
  if (sport === "nba") return nbaTeamLogo(abbr);
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

export const NBA_TEAMS_BY_ABBR = {
  ATL: { city: "Atlanta", name: "Hawks" }, BKN: { city: "Brooklyn", name: "Nets" },
  BOS: { city: "Boston", name: "Celtics" }, CHA: { city: "Charlotte", name: "Hornets" },
  CHI: { city: "Chicago", name: "Bulls" }, CLE: { city: "Cleveland", name: "Cavaliers" },
  DAL: { city: "Dallas", name: "Mavericks" }, DEN: { city: "Denver", name: "Nuggets" },
  DET: { city: "Detroit", name: "Pistons" }, GSW: { city: "Golden State", name: "Warriors" },
  HOU: { city: "Houston", name: "Rockets" }, IND: { city: "Indiana", name: "Pacers" },
  LAC: { city: "LA", name: "Clippers" }, LAL: { city: "Los Angeles", name: "Lakers" },
  MEM: { city: "Memphis", name: "Grizzlies" }, MIA: { city: "Miami", name: "Heat" },
  MIL: { city: "Milwaukee", name: "Bucks" }, MIN: { city: "Minnesota", name: "Timberwolves" },
  NOP: { city: "New Orleans", name: "Pelicans" }, NYK: { city: "New York", name: "Knicks" },
  OKC: { city: "Oklahoma City", name: "Thunder" }, ORL: { city: "Orlando", name: "Magic" },
  PHI: { city: "Philadelphia", name: "76ers" }, PHX: { city: "Phoenix", name: "Suns" },
  POR: { city: "Portland", name: "Trail Blazers" }, SAC: { city: "Sacramento", name: "Kings" },
  SAS: { city: "San Antonio", name: "Spurs" }, TOR: { city: "Toronto", name: "Raptors" },
  UTA: { city: "Utah", name: "Jazz" }, WAS: { city: "Washington", name: "Wizards" },
};

const TEAMS_BY_SPORT = { mlb: MLB_TEAMS_BY_ABBR, wnba: WNBA_TEAMS_BY_ABBR, nfl: NFL_TEAMS_BY_ABBR, nba: NBA_TEAMS_BY_ABBR };

export function teamInfo(sport, abbr) {
  const t = (TEAMS_BY_SPORT[sport] || {})[abbr];
  if (!t) return { abbr, city: "", name: abbr, full: abbr };
  return { abbr, city: t.city, name: t.name, full: t.city ? `${t.city} ${t.name}` : t.name };
}

// MLB, NFL, NBA, WNBA — the order every v3 mock offers them in, without
// exception: the Games rail, the Prop Feed rail, the Board chips and the phone
// frames all list them this way. It used to be MLB, WNBA, NFL, NBA here, which
// meant each frame either reordered at the point of use or quietly disagreed
// with the design.
export const SPORTS = [
  { id: "mlb", label: "MLB" },
  { id: "nfl", label: "NFL" },
  { id: "nba", label: "NBA" },
  { id: "wnba", label: "WNBA" },
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
// Exported so a caller building an extra date tab by hand labels it the same
// way buildDateTabs does -- two spellings of "Oct" side by side in one tab
// strip is exactly the kind of seam nobody notices until it ships.
export const MONTH_SHORT = MONTH;

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
  // Today first, then the days ahead. It used to open on yesterday, which put
  // a finished slate at the head of a page whose question is "what is on now"
  // -- and on a Monday morning the tab reading "yesterday" was Sunday's whole
  // NFL card, three tabs to the left of the games actually coming.
  return [0, 1, 2, 3].map((offset) => {
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
// The three slate fetchers below all answer with the same shape:
//
//   { games, unreadable }   loaded. `games` may be empty -- that is a real
//                           answer ("no games today"), not a failure.
//   null                    the fetch failed.
//
// `unreadable` counts games that came back but could not be built into a row,
// almost always because a team abbreviation isn't in our maps. They used to be
// dropped by `return null` + `.filter(Boolean)` and nothing said so: the slate
// simply showed fewer games than the day had. That is the exact failure rule 4
// in BUILD_ORDER.md was written about -- four of seven WNBA games invisible --
// and it was still live here. The count travels with the games so the screen
// can print it.
//
// A failure is deliberately not cached. It used to be (`store(ck, null)`),
// which meant a retry inside the TTL replayed the failure without a request
// and the retry control would look broken.
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
    let unreadable = 0;
    const games = (data?.dates || []).flatMap((d) => d.games || []).map((g) => {
      const awayAbbr = MLB_ID_ABBR[g.teams?.away?.team?.id];
      const homeAbbr = MLB_ID_ABBR[g.teams?.home?.team?.id];
      if (!awayAbbr || !homeAbbr) { unreadable += 1; return null; }
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
        // Same shape espnSlate returns, so a consumer reads game.venue
        // without knowing which provider the sport came from. MLB's schedule
        // gives the venue name; the roof state is not in this response, so
        // `indoor` is left null rather than guessed -- null means unknown
        // here, which is different from false.
        venue: g.venue?.name ? { name: g.venue.name, city: null, indoor: null } : null,
        probables: { away: pitcher("away"), home: pitcher("home") },
        status,
        // For finished games the center already says FINAL; period detail is noise.
        periodLabel: isLive ? mlbPeriodLabel(g) : null,
        isLive,
        isFinal,
      };
    }).filter(Boolean).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    return store(ck, { games, unreadable });
  } catch {
    return null;
  }
}

const ESPN_PATH = { wnba: "basketball/wnba", nfl: "football/nfl", nba: "basketball/nba" };

// ESPN's scoreboard reports six NBA teams by a short abbreviation that this
// app does not use anywhere else. Left unmapped, each one falls through
// teamInfo to `{ full: abbr }` and through NBA_LOGO_SLUG to a lowercase guess
// -- so "SA" would render as a team called SA with a broken logo rather than
// the Spurs, on a fifth of the league. Same map as PropLedger's NBA_ESPN_ABBR;
// duplicated here for the same reason the three logo builders above are.
const NBA_ESPN_ABBR = { GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS" };
// Football's Washington has the same problem, from the same provider: ESPN
// writes it WSH, every map in this file and every abbreviation the prop
// builders use is WAS. Left unreconciled it cost the same two things the note
// above warns about, plus a third: the Board could not join a Washington prop
// row to its own fixture, so WAS @ PHI drew as two cards -- one headed "WSH"
// with 101 props and one headed "WAS @ PHI" with 97, each claiming to be the
// matchup.
const NFL_ESPN_ABBR = { WSH: "WAS" };
const ESPN_ABBR_BY_SPORT = { nba: NBA_ESPN_ABBR, nfl: NFL_ESPN_ABBR };
const espnAbbr = (sport, a) => (a ? (ESPN_ABBR_BY_SPORT[sport] || {})[a] || a : a);

// Returns { games, unreadable } -- see the note on fetchMlbSlate.
function espnSlate(sport, events) {
  let unreadable = 0;
  const games = (events || []).map((ev) => {
    const comp = ev.competitions?.[0];
    const away = comp?.competitors?.find((c) => c.homeAway === "away");
    const home = comp?.competitors?.find((c) => c.homeAway === "home");
    const rawAway = away?.team?.abbreviation;
    const rawHome = home?.team?.abbreviation;
    const awayAbbr = espnAbbr(sport, rawAway);
    const homeAbbr = espnAbbr(sport, rawHome);
    if (!awayAbbr || !homeAbbr) { unreadable += 1; return null; }

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
      // Venue was being discarded even though every scoreboard response
      // carries it. `indoor` is the useful half: it is what lets a conditions
      // line say "Indoors · roof closed" without a weather feed, and without
      // it an outdoor game and a domed one look identical. ESPN sends no
      // weather block on most games, so nothing here claims any.
      venue: comp?.venue?.fullName
        ? {
            name: comp.venue.fullName,
            city: comp.venue.address?.city || null,
            indoor: comp.venue.indoor === true,
          }
        : null,
      probables: null,
      status,
      periodLabel: isLive ? espnPeriodLabel(comp, sport) : null,
      isLive,
      isFinal,
    };
  }).filter(Boolean).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  return { games, unreadable };
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
    return store(ck, espnSlate("wnba", data?.events));
  } catch {
    return null;
  }
}

// One NBA day, same shape as the WNBA fetcher above.
//
// Deliberately *not* given the prop feed's offseason opener fallback. This page
// answers "what is on today", and in August the honest answer is nothing --
// substituting a slate two months out would put "no games today" and a full
// card of games on the same screen. What the page does instead is offer the
// opener as a date to jump to (see GamesPage's nbaOpenerKey), which is a
// different statement: here is where the season starts.
export async function fetchNbaSlate(key, { force = false } = {}) {
  const ck = `nba:${key}`;
  if (!force) {
    const hit = cached(ck, { live: true });
    if (hit !== undefined) return hit;
  }
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH.nba}/scoreboard?dates=${key.replace(/-/g, "")}`);
    const data = await res.json();
    return store(ck, espnSlate("nba", data?.events));
  } catch {
    return null;
  }
}

// The first day of the regular season, as YYYY-MM-DD, or null.
//
// Read from ESPN's own season record rather than typed in here, so it is right
// next October without an edit. Cached for the tab: it cannot change during a
// session, and this is called on every sport switch.
let nbaOpenerCache;
export async function fetchNbaOpenerDay() {
  if (nbaOpenerCache !== undefined) return nbaOpenerCache;
  try {
    const sb = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH.nba}/scoreboard`)).json();
    const year = sb?.leagues?.[0]?.season?.year;
    if (!year) { nbaOpenerCache = null; return null; }
    const type = await (await fetch(
      `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${year}/types/2`
    )).json();
    // "2026-10-20T07:00Z" is ESPN's own ET day boundary for that date, so this
    // is a slice, not a timezone conversion.
    nbaOpenerCache = type?.startDate ? String(type.startDate).slice(0, 10) : null;
  } catch {
    // Not cached as null on failure -- a retry inside the session should be
    // able to try again rather than replay the failure.
    return null;
  }
  return nbaOpenerCache;
}

// ------------------------------------------------------------- NFL weeks
//
// The NFL is the one league here that schedules by week rather than by day,
// and this page used to answer that with `fetchNflWeekOneSlate` -- pinned to
// `seasontype=2&week=1&dates=2026`, three hardcoded facts. It was right for
// exactly as long as Week 1 was the week in progress, and there was no way to
// look at Week 2 at all.
//
// ESPN publishes its own calendar on the scoreboard route -- every week of
// every phase, with the label it prints and the dates it covers -- and says
// which one is current. Both come from here, so the picker cannot list a week
// the provider does not have and cannot disagree with it about which is on.
//
// The Pro Bowl is deliberately left out. It is on the postseason calendar, but
// it is an exhibition between two conference all-star sides whose "teams" have
// no abbreviation any map in this app knows, so it would draw as a broken card
// promising props that do not exist.
const NFL_SKIP_WEEK_LABELS = /pro bowl/i;

export async function fetchNflCalendar({ force = false } = {}) {
  const ck = "nfl:calendar";
  if (!force) {
    const hit = cached(ck);
    if (hit !== undefined) return hit;
  }
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH.nfl}/scoreboard`);
    const data = await res.json();
    const phases = data?.leagues?.[0]?.calendar || [];
    const weeks = [];
    // Regular season then postseason, in that order. Preseason is not offered:
    // its games carry no props and this page's whole purpose is the route into
    // them.
    ["2", "3"].forEach((seasonType) => {
      const phase = phases.find((p) => String(p.value) === seasonType);
      (phase?.entries || []).forEach((e) => {
        if (NFL_SKIP_WEEK_LABELS.test(e.label || "")) return;
        weeks.push({
          id: `${seasonType}-${e.value}`,
          seasonType: Number(seasonType),
          week: Number(e.value),
          // ESPN's own label ("Week 7", "Divisional Round"), never one built
          // here: a postseason round numbered "Week 2" would name the wrong
          // thing entirely.
          label: e.label || `Week ${e.value}`,
          detail: e.detail || null,
          startDate: e.startDate || null,
          endDate: e.endDate || null,
        });
      });
    });
    if (!weeks.length) return store(ck, null);
    const season = Number(data?.season?.year) || new Date().getFullYear();
    const currentType = Number(data?.season?.type) || 2;
    const currentWeek = Number(data?.week?.number) || 1;
    const currentId = `${currentType}-${currentWeek}`;
    return store(ck, {
      season,
      weeks,
      // Falls back to the first week the calendar lists rather than to a
      // hardcoded 1: in the postseason `currentId` is a type-3 id, and in the
      // off-season it is a phase this list does not carry at all.
      currentId: weeks.some((w) => w.id === currentId) ? currentId : weeks[0].id,
    });
  } catch {
    return null;
  }
}

// Whatever week is on now. The one call for every surface that wants "the
// NFL slate" without choosing a week itself -- the Board's fixture join and
// the player pages' next-game lookup. Both used to call a fetcher pinned to
// week 1, so from week 2 onward they were joining to games already played.
export async function fetchNflCurrentWeekSlate({ force = false } = {}) {
  const cal = await fetchNflCalendar({ force });
  if (!cal) return null;
  return fetchNflWeekSlate(cal.currentId, cal.season, { force });
}

// One week's games. `id` is a calendar id from fetchNflCalendar
// ("2-7" = regular season week 7); season is the year that calendar answered
// with, so this route can never ask for a week of one season under the
// calendar of another.
export async function fetchNflWeekSlate(id, season, { force = false } = {}) {
  if (!id) return null;
  const ck = `nfl:week:${season}:${id}`;
  if (!force) {
    const hit = cached(ck, { live: true });
    if (hit !== undefined) return hit;
  }
  const [seasonType, week] = String(id).split("-");
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH.nfl}/scoreboard?seasontype=${seasonType}&week=${week}&dates=${season}`
    );
    const data = await res.json();
    return store(ck, espnSlate("nfl", data?.events));
  } catch {
    return null;
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
  const abbrOf = (which) => MLB_ID_ABBR[feed?.gameData?.teams?.[which]?.id]
    || feed?.gameData?.teams?.[which]?.abbreviation;
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
    const abbr = abbrOf(which);
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

  // Per-player lines, in the same shape espnGamecast returns, so a consumer
  // can read tonight's production without caring which provider a sport came
  // from. MLB's feed already carries every batter's and pitcher's counting
  // stats; this side of the app was reducing them to one leader per category
  // and discarding the rest.
  //
  // Keys are named to match ESPN's (`RBIs`, `homeRuns`) rather than MLB's own
  // (`rbi`, `homeRuns`), so LIVE_STAT_KEY in GamecastPage needs one mapping
  // and not one per provider.
  const boxPlayers = (which) => {
    const team = live?.boxscore?.teams?.[which];
    if (!team) return null;
    const abbr = abbrOf(which);
    if (!abbr) return null;
    const player = (id) => team.players?.[`ID${id}`];
    const mk = (ids, kind, pick) => {
      const players = (ids || []).map(player).filter((p) => p?.stats?.[kind]).map((p) => ({
        name: p.person?.fullName,
        headshot: p.person?.id ? mlbHeadshot(p.person.id) : null,
        stats: pick(p.stats[kind]),
      })).filter((p) => p.name);
      return players.length ? { type: kind, keys: Object.keys(players[0].stats), labels: [], players } : null;
    };
    const groups = [
      mk(team.batters, "batting", (s) => ({
        hits: s.hits, runs: s.runs, RBIs: s.rbi, homeRuns: s.homeRuns,
        walks: s.baseOnBalls, strikeouts: s.strikeOuts, atBats: s.atBats,
      })),
      mk(team.pitchers, "pitching", (s) => ({
        strikeouts: s.strikeOuts, hits: s.hits, earnedRuns: s.earnedRuns,
        walks: s.baseOnBalls, outs: s.outs,
      })),
    ].filter(Boolean);
    return groups.length ? { teamAbbr: abbr, groups } : null;
  };

  // Leaders: the side's best bat by hits (RBI, then HR, break ties) plus the
  // starter, who is always first in `pitchers`. MLB pre-formats both stat
  // lines as `summary`, so nothing is recomputed here.
  const boxSide = (which) => {
    const team = live?.boxscore?.teams?.[which];
    if (!team) return null;
    const abbr = abbrOf(which);
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

  // The live situation: who is on, the count, and who is at the plate.
  //
  // Gated on the abstract state rather than on the field being present.
  // `offense` stays populated after a game ends, holding whoever was on when
  // the last out was recorded, and a diamond drawn from that would assert a
  // base state nobody is reporting. Each field resolves to null on its own
  // rather than as a group: MLB drops balls/strikes between half-innings
  // while the runners are still there.
  const off = ls?.offense;
  const inProgress = (feed?.gameData?.status?.abstractGameState || "") === "Live";
  const situation = inProgress && off ? {
    first: !!off.first, second: !!off.second, third: !!off.third,
    balls: typeof ls?.balls === "number" ? ls.balls : null,
    strikes: typeof ls?.strikes === "number" ? ls.strikes : null,
    outs: typeof ls?.outs === "number" ? ls.outs : null,
    atBat: live?.plays?.currentPlay?.matchup?.batter?.fullName || off.batter?.fullName || null,
  } : null;

  return {
    columns,
    rows: [side("away"), side("home")],
    leaders: [boxSide("away"), boxSide("home")].filter(Boolean),
    boxscore: [boxPlayers("away"), boxPlayers("home")].filter(Boolean),
    decisions: decisions.length ? decisions : null,
    situation,
  };
}

// Which stat picks the leader of a boxscore group, and which stats make up
// the line printed beside their name. Keyed by ESPN's own group `type`.
//
// Every entry is a *preference*, not a requirement: a group whose type is not
// listed, or whose keys have changed, falls through to the first numeric
// column rather than rendering nothing. The old leaders parse had no such
// fallback -- it read summary.leaders and printed nothing at all when ESPN
// omitted the array, which it does on plenty of live games even while the
// boxscore beside it is fully populated.
const BOX_LEADER_PREF = {
  batting: { by: "hits", line: ["hits-atBats", "runs", "RBIs", "homeRuns"] },
  pitching: { by: "strikeouts", line: ["fullInnings.partInnings", "hits", "earnedRuns", "strikeouts"] },
  passing: { by: "passingYards", line: ["completions-passingAttempts", "passingYards", "passingTouchdowns", "interceptions"] },
  rushing: { by: "rushingYards", line: ["rushingAttempts", "rushingYards", "rushingTouchdowns"] },
  receiving: { by: "receivingYards", line: ["receptions", "receivingYards", "receivingTouchdowns"] },
};

// ESPN stats arrive as display strings ("0-4", "6.0", ".234", "94-68"). Only
// the leading number is comparable, and a hyphenated pair like "0-4" must not
// be read as negative four.
function boxNumber(v) {
  if (v == null) return null;
  const m = String(v).match(/^-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

// Per-player stat lines out of a boxscore, as { keys, labels, players[] }.
// Returned alongside the leaders so callers that need the raw numbers -- a
// live "props in play" read, for instance -- do not have to re-parse the
// response or settle for the one leader per category the old shape kept.
function boxscoreSides(summary) {
  return (summary?.boxscore?.players || []).map((t) => {
    const groups = (t.statistics || []).map((g) => {
      const keys = g.keys || [];
      const labels = g.labels || [];
      const players = (g.athletes || [])
        .filter((a) => a?.athlete?.displayName && Array.isArray(a.stats) && a.stats.length)
        .map((a) => ({
          name: a.athlete.displayName,
          headshot: a.athlete.headshot?.href || null,
          // Keyed by ESPN's machine name so a consumer asks for "hits", not
          // for column 3, which would silently shift if ESPN reorders.
          stats: Object.fromEntries(keys.map((k, i) => [k, a.stats[i]])),
        }));
      return { type: g.type || g.name || "", keys, labels, players };
    }).filter((g) => g.players.length);
    return { teamAbbr: t.team?.abbreviation, groups };
  }).filter((t) => t.teamAbbr && t.groups.length);
}

// The Leaders section, derived from the boxscore rather than summary.leaders.
function boxscoreLeaders(sides) {
  return sides.map((t) => {
    const items = t.groups.map((g) => {
      const pref = BOX_LEADER_PREF[g.type] || {};
      // The column to rank by: the preferred one when present, otherwise the
      // first column that actually holds numbers.
      const byKey = (pref.by && g.keys.includes(pref.by))
        ? pref.by
        : g.keys.find((k) => g.players.some((p) => boxNumber(p.stats[k]) != null));
      if (!byKey) return null;
      let best = null;
      g.players.forEach((p) => {
        const n = boxNumber(p.stats[byKey]);
        if (n == null) return;
        if (!best || n > best.n) best = { p, n };
      });
      // Nobody has done anything in this category yet -- a game where no one
      // has a hit. Dropped rather than printed as a leader with nothing.
      if (!best || best.n <= 0) return null;
      const lineKeys = (pref.line || g.keys).filter((k) => g.keys.includes(k)).slice(0, 4);
      const statLine = lineKeys
        .map((k) => {
          const label = g.labels[g.keys.indexOf(k)] || k;
          return `${best.p.stats[k]} ${label}`;
        })
        .join(" · ");
      return {
        category: g.type ? g.type.replace(/^\w/, (c) => c.toUpperCase()) : "Leaders",
        name: best.p.name,
        statLine,
        headshot: best.p.headshot,
      };
    }).filter(Boolean);
    return items.length ? { teamAbbr: t.teamAbbr, items } : null;
  }).filter(Boolean);
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

  // Boxscore first, summary.leaders only as a fallback. ESPN omits the
  // leaders array on plenty of games whose boxscore is fully populated, and
  // the section used to go blank for exactly those.
  const sides = boxscoreSides(summary);
  const fromBox = boxscoreLeaders(sides);

  const legacyLeaders = (summary?.leaders || []).map((t) => {
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

  return {
    columns,
    rows: [side(away), side(home)],
    leaders: fromBox.length ? fromBox : legacyLeaders,
    // The raw per-player lines, for consumers that need the numbers rather
    // than one leader per category.
    boxscore: sides,
    decisions: null,
    // Bases, count and at-bat are a baseball shape. ESPN's summary carries no
    // equivalent for the other three sports, so this is null rather than an
    // empty object -- the caller then draws nothing at all.
    situation: null,
  };
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

// ESPN's team-schedule route is addressed by *ESPN's* abbreviation, not ours,
// and three of them differ: football's Washington is WSH, basketball's New
// Orleans is NO and Utah is UTAH. Asked for WAS / NOP / UTA the route answers
// `{"code":400}` under a 200 status, which read here exactly like "no games" --
// so those three teams' recent-form panels sat permanently empty and their
// season series never resolved. All 77 abbreviations across the three ESPN
// leagues were checked against the route; only these three are rejected.
const ESPN_TEAM_ROUTE = {
  nfl: { WAS: "WSH" },
  nba: { NOP: "NO", UTA: "UTAH" },
};
const espnTeamRoute = (sport, abbr) => (ESPN_TEAM_ROUTE[sport] || {})[abbr] || abbr;

// One team's schedule. Omitting `season` asks for whatever ESPN considers
// current, and the answer says which that is (`season.year` / `season.type`) --
// which is how the two callers below find the season to fall back to without
// hardcoding a calendar anywhere.
async function espnTeamSchedule(sport, abbr, { season, seasonType } = {}) {
  const qs = [
    season ? `season=${season}` : null,
    seasonType ? `seasontype=${seasonType}` : null,
  ].filter(Boolean).join("&");
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams/${espnTeamRoute(sport, abbr)}/schedule${qs ? `?${qs}` : ""}`
  );
  const data = await res.json();
  return data && !data.code ? data : null;
}

const espnFinished = (events) => (events || []).filter((e) => e?.competitions?.[0]?.status?.type?.completed);

// The label ESPN itself prints for a season: "2025" for the NFL, "2025-26" for
// the NBA. Never assembled from the year here -- a hyphenated basketball
// season written as a single year names a different season.
const espnSeasonLabel = (data, year) =>
  data?.requestedSeason?.displayName || data?.season?.displayName || String(year);

// Both halves of one named season, merged. The route serves one seasontype
// per request, and asking for the wrong half loses whole games: NE and SEA
// met in Super Bowl LX, which is seasontype 3, so a regular-season-only
// lookup has the two never having played.
async function espnSeasonEvents(sport, abbr, year) {
  const [reg, post] = await Promise.all([
    espnTeamSchedule(sport, abbr, { season: year, seasonType: 2 }),
    espnTeamSchedule(sport, abbr, { season: year, seasonType: 3 }),
  ]);
  return {
    events: [...(reg?.events || []), ...(post?.events || [])],
    label: espnSeasonLabel(reg || post, year),
  };
}

// Everything played so far in the season now in progress, and the label for
// it. Empty when the season has not started: ESPN answers an out-of-season
// request with the preseason (type 1), whose games are real but are neither
// form nor a season series -- the same overstatement as counting spring
// training, which is what MLB_COUNTED_TYPES above exists to avoid.
//
// The extra pair of requests fires only in the postseason. Asked during the
// regular season the probe already *is* the whole of the season so far;
// asked in January it is the playoff bracket alone, and the eleven regular-
// season games behind it would have gone missing from a Last 10.
async function espnSeasonSoFar(sport, abbr) {
  const probe = await espnTeamSchedule(sport, abbr);
  if (!probe) return null;
  const year = Number(probe.season?.year) || new Date().getFullYear();
  const type = Number(probe.season?.type);
  if (type === 2) return { events: probe.events || [], label: espnSeasonLabel(probe, year), year };
  if (type === 3) return { ...(await espnSeasonEvents(sport, abbr, year)), year };
  return { events: [], label: espnSeasonLabel(probe, year), year };
}

// Regular season plus the four postseason rounds. Without it the StatsAPI
// schedule route hands back spring training as well, and the Reds/Cubs season
// series read 12 meetings when the two had played 10 that counted.
const MLB_COUNTED_TYPES = "R,F,D,L,W";

const mlbTeamId = (abbr) => Object.keys(MLB_ID_ABBR).find((k) => MLB_ID_ABBR[k] === abbr) || null;

async function mlbFinals(query) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameType=${MLB_COUNTED_TYPES}&${query}`);
  const data = await res.json();
  return (data?.dates || []).flatMap((d) => d.games || [])
    .filter((g) => g.status?.abstractGameState === "Final");
}

// W / L / T for one finished game.
//
// Ties are real -- the NFL allows them -- and this used to have no way to say
// so. Every row carried a boolean `win`, derived from `!!mine.winner`, which is
// false for *both* teams in a drawn game: a 13-13 final rendered as an L and
// was counted as a loss in the recent-form bar. A wrong number on screen.
//
// ESPN marks the winner explicitly, so "completed, and neither side is flagged
// the winner" is a draw. Score comparison is the fallback for when those flags
// are missing entirely, and it is also the only signal the MLB path has.
function resultOf({ mineWon, theirsWon, us, them }) {
  if (mineWon === true) return "W";
  if (theirsWon === true) return "L";
  if (mineWon === false && theirsWon === false) return "T";
  if (us > them) return "W";
  if (us < them) return "L";
  return "T";
}

const shortDate = (d) => `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}`;

// One finished ESPN game, read from `abbr`'s side of it.
function espnFormRow(sport, abbr, e) {
  const norm = (a) => espnAbbr(sport, a);
  const comp = e.competitions[0];
  // ESPN answers this route with its own abbreviations even when asked by
  // ours, so a raw `=== abbr` comparison finds nobody for the three teams
  // ESPN_TEAM_ROUTE covers or for the six NBA sides the scoreboard shortens --
  // and `mine` being undefined renders every row as an 0-0 loss rather than as
  // an error. Normalised on both sides.
  const mine = comp.competitors.find((c) => norm(c.team?.abbreviation) === abbr);
  const theirs = comp.competitors.find((c) => norm(c.team?.abbreviation) !== abbr);
  const d = new Date(e.date);
  const us = Number(mine?.score?.value ?? mine?.score ?? 0);
  const them = Number(theirs?.score?.value ?? theirs?.score ?? 0);
  return {
    date: shortDate(d),
    at: e.date,
    opp: norm(theirs?.team?.abbreviation) || "",
    home: mine?.homeAway === "home",
    us,
    them,
    result: resultOf({ mineWon: mine?.winner, theirsWon: theirs?.winner, us, them }),
  };
}

const newestFirst = (rows, n) => rows.slice().sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, n);

// Rows for the last `n` finished games, newest first.
//
// Every row from a season other than the one in progress carries `season` --
// the label ESPN or StatsAPI prints for it -- and the panels above put that on
// screen. That marker is the whole licence for the fallback: without it a
// Week 1 form panel showing last January's games would be claiming them as
// this season's form, which is the one thing this app does not do.
export async function fetchRecentForm(sport, abbr, n) {
  const ck = `${sport}:${abbr}:${n}`;
  const hit = formCache.get(ck);
  if (hit && Date.now() - hit.at < SLATE_TTL_MS) return hit.value;

  let rows = null;
  try {
    if (sport === "mlb") {
      const id = mlbTeamId(abbr);
      const end = dayKey(new Date());
      const start = dayKey(addDays(new Date(), -45));
      const mlbRow = (g) => {
        const isHome = MLB_ID_ABBR[g.teams?.home?.team?.id] === abbr;
        const mine = isHome ? g.teams.home : g.teams.away;
        const theirs = isHome ? g.teams.away : g.teams.home;
        return {
          date: shortDate(new Date(g.gameDate)),
          at: g.gameDate,
          opp: MLB_ID_ABBR[theirs?.team?.id] || "",
          home: isHome,
          us: mine?.score ?? 0,
          them: theirs?.score ?? 0,
          // No winner flags on this feed, so the score is the only signal.
          result: resultOf({ us: mine?.score ?? 0, them: theirs?.score ?? 0 }),
        };
      };
      rows = newestFirst((await mlbFinals(`teamId=${id}&startDate=${start}&endDate=${end}`)).map(mlbRow), n);
      // Out of season the trailing 45 days hold nothing, and "no finished
      // games" was then an answer about the calendar rather than about the
      // team. The last season that was actually played is the honest one.
      if (!rows.length) {
        const year = new Date().getFullYear();
        for (const y of [year, year - 1]) {
          const prior = newestFirst((await mlbFinals(`teamId=${id}&season=${y}`)).map(mlbRow), n);
          if (prior.length) {
            rows = prior.map((r) => ({ ...r, season: String(y) }));
            break;
          }
        }
      }
    } else {
      const current = await espnSeasonSoFar(sport, abbr);
      rows = newestFirst(espnFinished(current?.events).map((e) => espnFormRow(sport, abbr, e)), n);
      // Between seasons -- an NFL Week 1, an NBA October, the WNBA in May --
      // the current schedule has nothing finished on it, and the panel's "no
      // finished games in this window" was true of the window and silent
      // about the team. Last season's closing stretch is the honest answer,
      // and it travels labelled with the season it came from.
      if (!rows.length) {
        const prior = (current?.year || new Date().getFullYear()) - 1;
        const { events, label } = await espnSeasonEvents(sport, abbr, prior);
        rows = newestFirst(espnFinished(events).map((e) => espnFormRow(sport, abbr, e)), n)
          .map((r) => ({ ...r, season: label }));
      }
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

// ---------------------------------------------------------- head to head
//
// The season series between the two teams on screen.
//
// This answered for MLB alone until now, which meant three quarters of the
// app's sports drew the panel's "they have not met this season" line without
// ever having looked -- a claim, not a finding. All four are read now: MLB
// through StatsAPI, the rest through the same ESPN team-schedule route the
// form panel uses.
//
// It also walks back. Two teams from opposite NFL conferences meet once every
// four years, so "this season only" returns nothing for most pairings for most
// of a season, and nothing for *every* pairing in Week 1. When the season in
// progress has no meeting the search steps back a season at a time, and what
// it finds is labelled with the season it came from so the panel can say which
// year it is showing. Rosters turn over -- that was the original argument for
// this-season-only, and it survives as a sentence on screen rather than as an
// empty card.
//
// Five different answers, deliberately distinguishable, because collapsing
// them is how a screen ends up silently missing a panel:
//
//   null                     -> a sport with no schedule route here at all.
//   { error: true }          -> the lookup failed. "We could not check" is not
//                               the same claim as "they never played".
//   { games: 0, searched }   -> checked, and these two have not met in any of
//                               the seasons named in `searched`.
//   { games, current: true } -> a series from the season in progress.
//   { games, current: false }-> the most recent season they did meet, named in
//                               `season`, with `last` carrying that meeting so
//                               the panel can print the result.
const H2H_LOOKBACK_SEASONS = 3;

function seasonSeries(meetings, meta) {
  let awayWins = 0;
  let homeWins = 0;
  meetings.forEach((m) => {
    if (m.result === "away") awayWins += 1;
    else if (m.result === "home") homeWins += 1;
  });
  return {
    games: meetings.length,
    awayWins,
    homeWins,
    // Drawn meetings belong in neither column, and without this the three
    // cells would not add up to the meeting count above them. The panel says
    // so when it is non-zero rather than leaving the arithmetic broken.
    ties: meetings.length - awayWins - homeWins,
    last: meetings[0] || null,
    // Every meeting, newest first, each carrying the provider id its own box
    // score lives behind. Three cells summarising a series is a count; the
    // scorelines under them are the series.
    meetings,
    ...meta,
  };
}

// One meeting, always described from the perspective of the two teams the page
// names -- `awayAbbr` is the visitor *tonight*, whoever hosted back then.
const meetingResult = (awayScore, homeScore, awayWon, homeWon) => {
  if (awayWon === true) return "away";
  if (homeWon === true) return "home";
  if (awayScore > homeScore) return "away";
  if (homeScore > awayScore) return "home";
  return "tie";
};

function espnMeetings(sport, awayAbbr, homeAbbr, events) {
  const norm = (a) => espnAbbr(sport, a);
  return espnFinished(events)
    .map((e) => {
      const comp = e.competitions[0];
      const a = comp.competitors.find((c) => norm(c.team?.abbreviation) === awayAbbr);
      const h = comp.competitors.find((c) => norm(c.team?.abbreviation) === homeAbbr);
      if (!a || !h) return null;
      const awayScore = Number(a.score?.value ?? a.score ?? 0);
      const homeScore = Number(h.score?.value ?? h.score ?? 0);
      return {
        at: e.date,
        awayScore,
        homeScore,
        result: meetingResult(awayScore, homeScore, a.winner, h.winner),
        // Which side hosted *that* night, which is not who is hosting
        // tonight -- a series read as four straight wins looks different once
        // three of them were at home.
        awayWasHome: a.homeAway === "home",
        venue: comp.venue?.fullName || null,
        // What the box score hangs off. `id` doubles as the gamecast cache
        // key, so two meetings can never share one cached box score.
        sport,
        id: `h2h-${sport}-${e.id}`,
        espnEventId: e.id,
        note: e.seasonType?.type === 3 ? (e.week?.text || "Postseason") : null,
      };
    })
    .filter(Boolean)
    .sort((x, y) => new Date(y.at) - new Date(x.at));
}

async function espnHeadToHead(sport, awayAbbr, homeAbbr) {
  const current = await espnSeasonSoFar(sport, awayAbbr);
  if (!current) return { error: true };

  const met = espnMeetings(sport, awayAbbr, homeAbbr, current.events);
  if (met.length) return seasonSeries(met, { season: current.label, current: true });

  const searched = [current.label];
  for (let y = current.year - 1; y >= current.year - H2H_LOOKBACK_SEASONS; y -= 1) {
    // eslint-disable-next-line no-await-in-loop
    const { events, label } = await espnSeasonEvents(sport, awayAbbr, y);
    searched.push(label);
    const older = espnMeetings(sport, awayAbbr, homeAbbr, events);
    if (older.length) return seasonSeries(older, { season: label, current: false });
  }
  return {
    games: 0, awayWins: 0, homeWins: 0, ties: 0, last: null,
    season: current.label, current: true, searched,
  };
}

async function mlbHeadToHead(awayAbbr, homeAbbr) {
  const awayId = mlbTeamId(awayAbbr);
  const homeId = mlbTeamId(homeAbbr);
  if (!awayId || !homeId) return null;
  const year = new Date().getFullYear();
  const searched = [];
  for (let y = year; y >= year - H2H_LOOKBACK_SEASONS; y -= 1) {
    searched.push(String(y));
    // eslint-disable-next-line no-await-in-loop
    const finals = await mlbFinals(`teamId=${awayId}&opponentId=${homeId}&season=${y}`);
    if (!finals.length) continue;
    const met = finals.map((g) => {
      const aIsHome = MLB_ID_ABBR[g.teams?.home?.team?.id] === awayAbbr;
      const a = aIsHome ? g.teams.home : g.teams.away;
      const h = aIsHome ? g.teams.away : g.teams.home;
      const awayScore = a?.score ?? 0;
      const homeScore = h?.score ?? 0;
      return {
        at: g.gameDate,
        awayScore,
        homeScore,
        result: meetingResult(awayScore, homeScore),
        awayWasHome: aIsHome,
        venue: g.venue?.name || null,
        sport: "mlb",
        id: `h2h-mlb-${g.gamePk}`,
        gamePk: g.gamePk,
        note: g.gameType && g.gameType !== "R" ? "Postseason" : null,
      };
    }).sort((x, z) => new Date(z.at) - new Date(x.at));
    return seasonSeries(met, { season: String(y), current: y === year });
  }
  return { games: 0, awayWins: 0, homeWins: 0, ties: 0, last: null, season: String(year), current: true, searched };
}

export async function fetchHeadToHead(sport, awayAbbr, homeAbbr) {
  const ck = `h2h:${sport}:${awayAbbr}:${homeAbbr}`;
  const hit = formCache.get(ck);
  if (hit && Date.now() - hit.at < SLATE_TTL_MS) return hit.value;
  try {
    const value = sport === "mlb"
      ? await mlbHeadToHead(awayAbbr, homeAbbr)
      : ESPN_PATH[sport]
        ? await espnHeadToHead(sport, awayAbbr, homeAbbr)
        : null;
    // A failure is deliberately not cached: it should retry on the next visit
    // rather than pin "couldn't check" to this matchup for the whole TTL.
    if (value && !value.error) formCache.set(ck, { value, at: Date.now() });
    return value;
  } catch {
    return { error: true };
  }
}
