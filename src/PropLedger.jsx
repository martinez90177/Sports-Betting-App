import React, { useState, useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell, LabelList
} from "recharts";
import PlayerNewsModule from "./PlayerNewsModule.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { useSettings, useBettingSettings, useOddsFormat, useUnitValue, formatUnits } from "./settings.jsx";
import { useOverlay } from "./useOverlay.js";
import { formatOdds, americanToDecimal, decimalToAmerican } from "./odds.js";
import SettingsModal from "./SettingsModal.jsx";
import FeedPresets, { SharedScreenBanner } from "./FeedPresets.jsx";
import { loadPresets, savePresets, filtersEqual, decodeShareLink } from "./presets.js";
import PlayerAvatar from "./PlayerAvatar.jsx";
import {
  NBA_TEAM_COLORS, NFL_TEAM_COLORS, WNBA_TEAM_COLORS, MLB_TEAM_COLORS,
  teamAvatarBackground,
} from "./lib/teamColors.js";

// Loaded on demand rather than up front. The app opens on the Prop Feed, and
// these three are never on screen until the user navigates to them -- but
// statically imported they still had to download and parse before the feed
// could render. GamesPage is the big one: it pulls in MatchupPage and
// GamecastPage behind it, so all three leave the initial bundle together.
// ColorWheel only ever appears inside the Settings drawer.
const GamesPage = React.lazy(() => import("./GamesPage.jsx"));
const NewsPage = React.lazy(() => import("./NewsPage.jsx"));
const ColorWheel = React.lazy(() => import("./ColorWheel.jsx"));

// Every lazy component needs a Suspense boundary above it. These chunks are
// small and same-origin, so the gap is usually a frame or two -- a spinner
// would flash more than it would inform, and a fixed-height placeholder stops
// the layout jumping when the real thing lands.
function LazyPane({ minHeight = 240, children }) {
  return (
    <React.Suspense fallback={<div style={{ minHeight }} />}>
      {children}
    </React.Suspense>
  );
}

// ---------- Seeded RNG so the mock data is stable across renders ----------
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a string hash -> a mulberry32-seeded RNG. Lets mock stats be keyed
// off a player id + split/sample key so the same selection always renders
// the same numbers instead of reshuffling on every re-render.
function strHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededRng(...parts) {
  return mulberry32(strHash(parts.join("|")));
}

const TEAMS = ["BOS","MIA","PHI","NYK","MIL","CLE","ORL","ATL","IND","CHI","BKN","TOR","DET","CHA","WAS","SAS","LAL","DEN","OKC","DAL","MIN","GSW","PHX","MEM","NOP","SAC","POR","UTA","HOU","LAC"];

// Mock defensive ratings (lower = tougher defense). Ranks derived by sorting.
const defRatingRng = mulberry32(777);
const TEAM_DEF = (() => {
  const raw = TEAMS.map((t) => ({ team: t, rating: Math.round((106 + defRatingRng() * 14) * 10) / 10 }));
  raw.sort((a, b) => a.rating - b.rating); // rank 1 = best (lowest) defensive rating
  raw.forEach((r, i) => (r.rank = i + 1));
  const byTeam = {};
  raw.forEach((r) => (byTeam[r.team] = r));
  return byTeam;
})();

const defTier = (rank) => (rank <= 10 ? "tough" : rank >= 21 ? "soft" : "mid");

// Team abbreviation -> ESPN team-logo CDN slug (mostly lowercase of the
// abbreviation itself; only a handful of teams use a different slug).
const NBA_LOGO_SLUG = {
  BOS: "bos", MIA: "mia", PHI: "phi", NYK: "ny", MIL: "mil", CLE: "cle", ORL: "orl",
  ATL: "atl", IND: "ind", CHI: "chi", BKN: "bkn", TOR: "tor", DET: "det",
  CHA: "cha", WAS: "wsh", SAS: "sa", LAL: "lal", DEN: "den", OKC: "okc",
  DAL: "dal", MIN: "min", GSW: "gs", PHX: "phx", MEM: "mem", NOP: "no",
  SAC: "sac", POR: "por", UTA: "utah", HOU: "hou", LAC: "lac",
};
const nbaTeamLogo = (abbr) => `https://a.espncdn.com/i/teamlogos/nba/500/${NBA_LOGO_SLUG[abbr] || abbr.toLowerCase()}.png`;

// Official-ish NBA brand colors (primary/secondary), used only to tint the
// player avatar's background ring -- not for logos, charts, or anything else.


// Groups a sport's matchup list by calendar date for its matchup dropdown,
// sorted chronologically both across days (earliest date first) and within
// a single day (earliest kickoff/first pitch first) -- shared by every
// sport's selector so "which game is this" sorts the same way everywhere,
// regardless of the order matchups were added to the source array.
function groupMatchupsByDate(matchups) {
  const sorted = [...matchups].sort((a, b) => new Date(a.date) - new Date(b.date));
  const groups = [];
  const byLabel = new Map();
  sorted.forEach((m) => {
    const label = new Date(m.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    if (!byLabel.has(label)) {
      const group = { label, matchups: [] };
      byLabel.set(label, group);
      groups.push(group);
    }
    byLabel.get(label).matchups.push(m);
  });
  return groups;
}

// Formats a matchup's kickoff/first-pitch time for the dropdown option text
// (e.g. "7:35 PM") so each game is identifiable by time without leaving the
// select closed.
function matchupTimeLabel(dateStr) {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Every slate time on this page is rendered in the *viewer's* local zone, not
// Eastern -- so a bare "7:10 PM" is already correct for whoever is reading it,
// and a hardcoded "ET" would be an outright lie on the west coast. The zone
// suffix is therefore only worth the pixels when the viewer isn't on Eastern
// (where baseball schedules are quoted), which is the one case where the local
// time won't match the time they saw quoted somewhere else.
//
// Read from the browser rather than an IP lookup: this is the OS setting, so it
// stays right behind a VPN and while travelling, costs no network round trip,
// and sends nothing to a third party.
const VIEWER_ZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
})();
const VIEWER_IS_EASTERN = VIEWER_ZONE === "America/New_York";

function slateTimeLabel(dateStr) {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(VIEWER_IS_EASTERN ? {} : { timeZoneName: "short" }),
  });
}

// New York Knicks starting five from the 2026 NBA Finals, so matchups can be
// researched the way they would have looked during that series.
const KNICKS_PLAYERS = [
  { id: "brunson", name: "Jalen Brunson", team: "NYK", pos: "PG", espnId: "3934672", nbaId: "1628973",
    base: { pts: 26, oreb: 0.5, dreb: 2.9, ast: 7.2, stl: 0.9, blk: 0.2, fg3m: 3.0, fg3a: 7.5, ftm: 5.5, fta: 6.3, tov: 2.5 },
    var:  { pts: 7,  oreb: 0.5, dreb: 1.5, ast: 2.6, stl: 0.7, blk: 0.3, fg3m: 1.6, fg3a: 2.2, ftm: 2.0, fta: 2.2, tov: 1.2 } },
  { id: "bridges", name: "Mikal Bridges", team: "NYK", pos: "SG", espnId: "3147657", nbaId: "1628969",
    base: { pts: 14.6, oreb: 0.6, dreb: 3.6, ast: 3.0, stl: 1.0, blk: 0.4, fg3m: 2.4, fg3a: 6.2, ftm: 1.8, fta: 2.1, tov: 1.3 },
    var:  { pts: 5,    oreb: 0.5, dreb: 1.4, ast: 1.4, stl: 0.6, blk: 0.4, fg3m: 1.3, fg3a: 1.9, ftm: 1.1, fta: 1.2, tov: 0.8 } },
  { id: "hart", name: "Josh Hart", team: "NYK", pos: "SF", espnId: "3062679", nbaId: "1628404",
    base: { pts: 10.2, oreb: 2.4, dreb: 5.9, ast: 4.6, stl: 1.1, blk: 0.3, fg3m: 1.0, fg3a: 2.8, ftm: 1.5, fta: 2.0, tov: 1.6 },
    var:  { pts: 4,    oreb: 1.2, dreb: 2.0, ast: 1.9, stl: 0.6, blk: 0.3, fg3m: 0.9, fg3a: 1.4, ftm: 1.0, fta: 1.2, tov: 0.9 } },
  { id: "ogA", name: "OG Anunoby", team: "NYK", pos: "PF", espnId: "3934719", nbaId: "1628384",
    base: { pts: 19.3, oreb: 0.8, dreb: 3.3, ast: 2.0, stl: 1.3, blk: 0.6, fg3m: 2.6, fg3a: 6.0, ftm: 2.0, fta: 2.3, tov: 1.1 },
    var:  { pts: 5,    oreb: 0.6, dreb: 1.5, ast: 1.2, stl: 0.7, blk: 0.5, fg3m: 1.3, fg3a: 1.8, ftm: 1.2, fta: 1.3, tov: 0.7 } },
  { id: "kat", name: "Karl-Anthony Towns", team: "NYK", pos: "C", espnId: "3136195", nbaId: "1626157",
    base: { pts: 22, oreb: 2.6, dreb: 9.2, ast: 3.1, stl: 0.8, blk: 1.1, fg3m: 2.0, fg3a: 5.0, ftm: 4.5, fta: 5.2, tov: 2.6 },
    var:  { pts: 6,  oreb: 1.3, dreb: 2.6, ast: 1.6, stl: 0.6, blk: 0.7, fg3m: 1.2, fg3a: 1.7, ftm: 1.8, fta: 2.0, tov: 1.1 } },
];
// San Antonio Spurs starting five from the same 2026 Finals matchup.
const SPURS_PLAYERS = [
  { id: "fox", name: "De'Aaron Fox", team: "SAS", pos: "PG", espnId: "4066259", nbaId: "1628368",
    base: { pts: 22.5, oreb: 0.4, dreb: 3.1, ast: 5.8, stl: 1.3, blk: 0.3, fg3m: 1.8, fg3a: 4.8, ftm: 4.8, fta: 5.8, tov: 2.8 },
    var:  { pts: 6.5,  oreb: 0.4, dreb: 1.4, ast: 2.2, stl: 0.7, blk: 0.3, fg3m: 1.2, fg3a: 1.7, ftm: 1.8, fta: 2.1, tov: 1.2 } },
  { id: "castle", name: "Stephon Castle", team: "SAS", pos: "SG", espnId: "4845367", nbaId: "1642264",
    base: { pts: 15.8, oreb: 0.7, dreb: 4.1, ast: 4.5, stl: 1.1, blk: 0.4, fg3m: 1.5, fg3a: 4.0, ftm: 3.0, fta: 3.6, tov: 2.0 },
    var:  { pts: 5,    oreb: 0.6, dreb: 1.6, ast: 1.8, stl: 0.6, blk: 0.4, fg3m: 1.0, fg3a: 1.5, ftm: 1.4, fta: 1.6, tov: 0.9 } },
  { id: "vassell", name: "Devin Vassell", team: "SAS", pos: "SF", espnId: "4395630", nbaId: "1630170",
    base: { pts: 17.4, oreb: 0.6, dreb: 3.4, ast: 2.4, stl: 1.0, blk: 0.5, fg3m: 2.2, fg3a: 5.5, ftm: 2.0, fta: 2.4, tov: 1.2 },
    var:  { pts: 5.5,  oreb: 0.5, dreb: 1.4, ast: 1.2, stl: 0.6, blk: 0.4, fg3m: 1.2, fg3a: 1.7, ftm: 1.2, fta: 1.4, tov: 0.7 } },
  { id: "champagnie", name: "Julian Champagnie", team: "SAS", pos: "PF", espnId: "4592479", nbaId: "1630577",
    base: { pts: 11.9, oreb: 1.2, dreb: 3.9, ast: 1.5, stl: 0.8, blk: 0.4, fg3m: 1.8, fg3a: 4.5, ftm: 1.5, fta: 1.8, tov: 0.9 },
    var:  { pts: 4,    oreb: 0.9, dreb: 1.6, ast: 0.9, stl: 0.5, blk: 0.4, fg3m: 1.1, fg3a: 1.5, ftm: 1.0, fta: 1.2, tov: 0.6 } },
  { id: "wemby", name: "Victor Wembanyama", team: "SAS", pos: "C", espnId: "5104157", nbaId: "1641705",
    base: { pts: 24.3, oreb: 2.2, dreb: 9.6, ast: 3.7, stl: 1.1, blk: 3.5, fg3m: 2.3, fg3a: 6.0, ftm: 5.5, fta: 7.0, tov: 3.0 },
    var:  { pts: 6.5,  oreb: 1.2, dreb: 2.8, ast: 1.6, stl: 0.6, blk: 1.4, fg3m: 1.3, fg3a: 1.9, ftm: 2.0, fta: 2.4, tov: 1.3 } },
];
// Philadelphia 76ers projected 2026-27 starting five, updated for the
// roster as it actually stands today -- LeBron James and Jaylen Brown both
// landed in Philadelphia alongside Embiid/Maxey this offseason. Stat lines
// (base/var) are still mock, not live, since the season doesn't open until
// October.
const SIXERS_PLAYERS = [
  { id: "maxey", name: "Tyrese Maxey", team: "PHI", pos: "PG", espnId: "4431678", nbaId: "1630178",
    base: { pts: 24, oreb: 0.4, dreb: 3.0, ast: 6.0, stl: 1.0, blk: 0.3, fg3m: 2.8, fg3a: 7.2, ftm: 4.0, fta: 4.6, tov: 2.2 },
    var:  { pts: 6.5, oreb: 0.4, dreb: 1.4, ast: 2.2, stl: 0.6, blk: 0.3, fg3m: 1.5, fg3a: 2.1, ftm: 1.6, fta: 1.8, tov: 1.1 } },
  { id: "jbrown", name: "Jaylen Brown", team: "PHI", pos: "SG", espnId: "3917376", nbaId: "1627759",
    base: { pts: 23, oreb: 0.8, dreb: 5.0, ast: 3.5, stl: 1.1, blk: 0.4, fg3m: 2.4, fg3a: 6.5, ftm: 4.0, fta: 4.8, tov: 2.4 },
    var:  { pts: 6.5, oreb: 0.6, dreb: 1.8, ast: 1.5, stl: 0.6, blk: 0.4, fg3m: 1.3, fg3a: 1.9, ftm: 1.7, fta: 1.9, tov: 1.1 } },
  { id: "lebron", name: "LeBron James", team: "PHI", pos: "SF", espnId: "1966", nbaId: "2544",
    base: { pts: 24, oreb: 0.6, dreb: 6.5, ast: 7.5, stl: 1.0, blk: 0.5, fg3m: 2.0, fg3a: 5.5, ftm: 4.5, fta: 5.8, tov: 3.3 },
    var:  { pts: 6,   oreb: 0.5, dreb: 2.2, ast: 2.6, stl: 0.6, blk: 0.4, fg3m: 1.1, fg3a: 1.8, ftm: 1.8, fta: 2.0, tov: 1.3 } },
  { id: "watford", name: "Trendon Watford", team: "PHI", pos: "PF", espnId: "4431675", nbaId: "1630217",
    base: { pts: 10, oreb: 1.8, dreb: 4.5, ast: 1.8, stl: 0.6, blk: 0.4, fg3m: 0.8, fg3a: 2.2, ftm: 1.4, fta: 1.8, tov: 1.0 },
    var:  { pts: 4,   oreb: 1.1, dreb: 1.8, ast: 1.0, stl: 0.4, blk: 0.3, fg3m: 0.6, fg3a: 1.1, ftm: 0.9, fta: 1.1, tov: 0.7 } },
  { id: "embiid", name: "Joel Embiid", team: "PHI", pos: "C", espnId: "3059318", nbaId: "203954",
    base: { pts: 23, oreb: 1.0, dreb: 7.0, ast: 4.0, stl: 0.8, blk: 1.3, fg3m: 1.0, fg3a: 3.0, ftm: 6.5, fta: 7.5, tov: 3.2 },
    var:  { pts: 7,   oreb: 0.7, dreb: 2.4, ast: 1.8, stl: 0.5, blk: 0.7, fg3m: 0.8, fg3a: 1.5, ftm: 2.4, fta: 2.6, tov: 1.4 } },
];
// Miami Heat projected 2026-27 starting five, updated for the roster as it
// actually stands today -- Giannis Antetokounmpo is now in Miami alongside
// Bam Adebayo. Same mock-stats scope as SIXERS_PLAYERS above.
const HEAT_PLAYERS = [
  { id: "dmitchell", name: "Davion Mitchell", team: "MIA", pos: "PG", espnId: "4278053", nbaId: "1630703",
    base: { pts: 11, oreb: 0.5, dreb: 2.6, ast: 4.8, stl: 1.3, blk: 0.3, fg3m: 1.0, fg3a: 3.0, ftm: 1.4, fta: 1.8, tov: 1.6 },
    var:  { pts: 4,   oreb: 0.4, dreb: 1.2, ast: 1.9, stl: 0.7, blk: 0.3, fg3m: 0.8, fg3a: 1.4, ftm: 0.9, fta: 1.1, tov: 0.9 } },
  { id: "thardaway", name: "Tim Hardaway Jr.", team: "MIA", pos: "SG", espnId: "2528210", nbaId: "203501",
    base: { pts: 15, oreb: 0.4, dreb: 2.6, ast: 1.8, stl: 0.7, blk: 0.2, fg3m: 2.8, fg3a: 7.0, ftm: 1.8, fta: 2.1, tov: 1.1 },
    var:  { pts: 5,   oreb: 0.4, dreb: 1.2, ast: 0.9, stl: 0.5, blk: 0.2, fg3m: 1.5, fg3a: 2.1, ftm: 1.1, fta: 1.3, tov: 0.7 } },
  { id: "wiggins", name: "Andrew Wiggins", team: "MIA", pos: "SF", espnId: "3064514", nbaId: "203952",
    base: { pts: 15, oreb: 0.6, dreb: 3.6, ast: 2.0, stl: 0.9, blk: 0.5, fg3m: 1.6, fg3a: 4.2, ftm: 2.0, fta: 2.4, tov: 1.2 },
    var:  { pts: 5,   oreb: 0.5, dreb: 1.5, ast: 1.1, stl: 0.6, blk: 0.4, fg3m: 1.0, fg3a: 1.6, ftm: 1.2, fta: 1.4, tov: 0.7 } },
  { id: "giannis", name: "Giannis Antetokounmpo", team: "MIA", pos: "PF", espnId: "3032977", nbaId: "203507",
    base: { pts: 30, oreb: 2.2, dreb: 9.0, ast: 6.0, stl: 1.1, blk: 1.0, fg3m: 0.5, fg3a: 1.8, ftm: 7.5, fta: 11.0, tov: 3.4 },
    var:  { pts: 7,   oreb: 1.3, dreb: 2.8, ast: 2.2, stl: 0.7, blk: 0.6, fg3m: 0.4, fg3a: 1.1, ftm: 2.6, fta: 3.4, tov: 1.4 } },
  { id: "adebayo", name: "Bam Adebayo", team: "MIA", pos: "C", espnId: "4066261", nbaId: "1628389",
    base: { pts: 19, oreb: 2.2, dreb: 6.8, ast: 4.0, stl: 1.2, blk: 0.9, fg3m: 0.3, fg3a: 1.0, ftm: 3.5, fta: 4.5, tov: 2.6 },
    var:  { pts: 6,   oreb: 1.3, dreb: 2.4, ast: 1.8, stl: 0.7, blk: 0.6, fg3m: 0.3, fg3a: 0.8, ftm: 1.6, fta: 2.0, tov: 1.3 } },
];

const ALL_NBA_PLAYERS = [...KNICKS_PLAYERS, ...SPURS_PLAYERS, ...SIXERS_PLAYERS, ...HEAT_PLAYERS];

// NBA matchup switcher (same "pick a matchup, see its two rosters" pattern
// as the NFL/MLB/WNBA pages) -- starts with the 2026 Finals rematchup, plus
// a second matchup (76ers/Heat) stubbed in early with mock rosters ahead of
// the real 2026-27 season tipping off in October.
const NBA_MATCHUPS = [
  {
    id: "nyk-sas",
    label: "Knicks @ Spurs",
    teamA: { label: "New York Knicks", players: KNICKS_PLAYERS },
    teamB: { label: "San Antonio Spurs", players: SPURS_PLAYERS },
    date: "2026-10-04T23:00:00Z",
    venue: "Frost Bank Center",
    city: "San Antonio, TX",
  },
  {
    id: "mia-phi",
    label: "Heat @ 76ers",
    teamA: { label: "Miami Heat", players: HEAT_PLAYERS },
    teamB: { label: "Philadelphia 76ers", players: SIXERS_PLAYERS },
    date: "2026-10-22T23:00:00Z",
    venue: "Wells Fargo Center",
    city: "Philadelphia, PA",
  },
];
const NBA_MATCHUPS_BY_DATE = groupMatchupsByDate(NBA_MATCHUPS);

// Primary: ESPN's combiner image proxy, requested at 350x350 with a server-
// side crop -- the same source and approach the NFL page uses, and it frames
// every player consistently as a head-and-shoulders circle. Fallback:
// NBA.com's official headshot CDN, a raw 1040x760 landscape photo -- used
// to be the primary source, but forcing that wide, inconsistently-framed
// image into a circle made some players look oddly cropped/zoomed compared
// to the ESPN version, so it's now only used if ESPN's is missing.
const nbaHeadshot = (nbaId) => `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`;
const espnHeadshot = (espnId) =>
  `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${espnId}.png&w=350&h=350&scale=crop`;

// Row 1 = core box-score stats.
// Row 2 = defense + hustle counting stats (Turnovers grouped here since it has
// no natural "attempt" pair, same as steals/blocks/stocks).
// Row 3 = combo props.
// Row 4 = shooting/FT makes+attempts pairs.
// Row 5 = binary milestone props (Yes/No), not a numeric line.
const MARKETS_ROW_1 = [
  { id: "pts", label: "Points" },
  { id: "reb", label: "Rebounds" },
  { id: "ast", label: "Assists" },
];
const MARKETS_ROW_2 = [
  { id: "stl", label: "Steals" },
  { id: "blk", label: "Blocks" },
  { id: "stk", label: "Stocks" },
];
const MARKETS_ROW_3 = [
  { id: "pra", label: "PRA" },
  { id: "ra", label: "RA" },
  { id: "pr", label: "PR" },
  { id: "pa", label: "PA" },
];
const MARKETS_ROW_4 = [
  { id: "3pm", label: "3PM" },
  { id: "3pa", label: "3PA" },
  { id: "ftm", label: "FTM" },
  { id: "fta", label: "FTA" },
];
const MARKETS_ROW_5 = [
  { id: "td", label: "Triple-Double", binary: true },
  { id: "dd", label: "Double-Double", binary: true },
];
const MARKETS = [...MARKETS_ROW_1, ...MARKETS_ROW_2, ...MARKETS_ROW_3, ...MARKETS_ROW_4, ...MARKETS_ROW_5];

// When market === "reb", this controls whether we're looking at total boards,
// offensive boards only, or defensive boards only.
const REB_SPLITS = [
  { id: "total", label: "Total" },
  { id: "off", label: "Offensive" },
  { id: "def", label: "Defensive" },
];

function genGames(player, seedOffset) {
  const rng = mulberry32(1000 + seedOffset);
  const games = [];
  const startDate = new Date("2026-04-01T00:00:00Z");
  for (let i = 0; i < 20; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() - (19 - i) * 3);
    const home = rng() > 0.48;
    const opp = TEAMS[Math.floor(rng() * TEAMS.length)];
    const minutes = Math.round(26 + rng() * 12);
    const noise = (mean, spread) => Math.max(0, Math.round(mean + (rng() - 0.5) * 2 * spread));
    const pts = noise(player.base.pts, player.var.pts);
    const oreb = noise(player.base.oreb, player.var.oreb);
    const dreb = noise(player.base.dreb, player.var.dreb);
    const ast = noise(player.base.ast, player.var.ast);
    const stl = noise(player.base.stl, player.var.stl);
    const blk = noise(player.base.blk, player.var.blk);
    const fg3m = noise(player.base.fg3m, player.var.fg3m);
    const fg3a = Math.max(fg3m, noise(player.base.fg3a, player.var.fg3a));
    const ftm = noise(player.base.ftm, player.var.ftm);
    const fta = Math.max(ftm, noise(player.base.fta, player.var.fta));
    const tov = noise(player.base.tov, player.var.tov);
    games.push({ date: d.toISOString().slice(0, 10), opp, home, minutes, pts, oreb, dreb, ast, stl, blk, fg3m, fg3a, ftm, fta, tov });
  }
  return games;
}

// Simple string hash used to deterministically decide things like "did these
// two teams meet in the playoffs" without needing a real schedule.
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Builds out multi-season head-to-head history for a player against one
// specific opponent: two prior regular seasons (a few meetings each, since
// teams in the same conference play 3-4x/season and cross-conference 2x) plus
// an optional playoff series. Everything is seeded off the player+opponent
// pairing so it's stable across renders but varies matchup to matchup.
function genOpponentHistory(player, seedOffset, opp) {
  const rng = mulberry32(5000 + seedOffset + (hashStr(opp) % 997));
  const mkGame = (dateStr, home, tag) => {
    const noise = (mean, spread) => Math.max(0, Math.round(mean + (rng() - 0.5) * 2 * spread));
    const minutes = Math.round(26 + rng() * 12);
    const fg3m = noise(player.base.fg3m, player.var.fg3m);
    const ftm = noise(player.base.ftm, player.var.ftm);
    return {
      date: dateStr, opp, home, minutes, tag,
      pts: noise(player.base.pts, player.var.pts),
      oreb: noise(player.base.oreb, player.var.oreb),
      dreb: noise(player.base.dreb, player.var.dreb),
      ast: noise(player.base.ast, player.var.ast),
      stl: noise(player.base.stl, player.var.stl),
      blk: noise(player.base.blk, player.var.blk),
      fg3m,
      fg3a: Math.max(fg3m, noise(player.base.fg3a, player.var.fg3a)),
      ftm,
      fta: Math.max(ftm, noise(player.base.fta, player.var.fta)),
      tov: noise(player.base.tov, player.var.tov),
    };
  };

  const priorSeasons = [];
  // Two prior regular seasons, ~2-4 meetings each.
  [2025, 2024].forEach((year) => {
    const meetings = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < meetings; i++) {
      const d = new Date(Date.UTC(year, (10 + i) % 12, 3 + i * 6));
      priorSeasons.push(mkGame(d.toISOString().slice(0, 10), rng() > 0.5, `${year}-${year + 1}`));
    }
  });
  priorSeasons.sort((a, b) => a.date.localeCompare(b.date));

  // ~1 in 5 opponents get a mock playoff series in the history (kept
  // deterministic per player+opponent so it doesn't flicker between renders).
  const playoffs = [];
  if (hashStr(player.id + opp) % 5 === 0) {
    const games = 5 + Math.floor(rng() * 3); // 5-7 game series
    for (let i = 0; i < games; i++) {
      const d = new Date(Date.UTC(2025, 3, 18 + i * 2));
      playoffs.push(mkGame(d.toISOString().slice(0, 10), i % 2 === 0, "PO"));
    }
  }

  return { priorSeasons, playoffs };
}

// ---------- chart context-stat overlay ----------
// The bars answer "did he clear the line". They can't answer "did he get the
// chances to" -- a 12-point night on 14 minutes of foul trouble looks
// identical to a 12-point night on 34 minutes, and only one of those is a
// reason to fade the next game. Overlaying the volume stat on its own right-
// hand axis separates them. (PropsMadness draws the same minutes line over
// its bars; the data was already in every chart's row here, just never drawn.)
//
// Off by default -- the bars are the point, this is context on demand.
const CONTEXT_STAT_COLOR = "#4c8dff";

// Each sport's volume stat -- the one already carried in that chart's data
// rows, so switching it on costs no new field and no new fetch.
//
// NFL uses snap share rather than a per-position attempt count (dropbacks for
// a QB, carries for a back, targets for a receiver): snap% is the one number
// that means the same thing for every position, and the tooltip already
// reports it. MLB's chart rows reuse the `minutes` key for plate appearances
// (batters) and innings pitched (pitchers) -- see its ChartTooltip
// footerLabel -- so that page builds its stat inline to get the right label.
const NBA_CONTEXT_STAT = { key: "minutes", label: "MIN" };
const NFL_CONTEXT_STAT = { key: "snapPct", label: "SNAP%" };
const MLB_BATTER_CONTEXT_STAT = { key: "minutes", label: "PA" };
const MLB_PITCHER_CONTEXT_STAT = { key: "minutes", label: "IP", decimals: true };

// Small toggle chip, anchored to the chart container's top-left (the filter
// launcher owns the top-right corner on every page).
function ContextStatToggle({ stat, value, onChange, compact }) {
  if (!stat) return null;
  return (
    <div
      role="button"
      className="mono"
      onClick={() => onChange(!value)}
      title={value ? `Hide the ${stat.label} overlay` : `Overlay ${stat.label} per game on its own axis`}
      style={{
        position: "absolute", top: compact ? 8 : 10, left: compact ? 8 : 12, zIndex: 4,
        cursor: "pointer", userSelect: "none",
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: compact ? "3px 7px" : "4px 9px", borderRadius: "var(--r-pill)",
        fontSize: compact ? 9.5 : 10.5, fontWeight: 700, letterSpacing: "0.03em",
        border: `1px solid ${value ? CONTEXT_STAT_COLOR : "var(--line)"}`,
        background: value ? `color-mix(in srgb, ${CONTEXT_STAT_COLOR} 18%, transparent)` : "var(--surface-1)",
        color: value ? CONTEXT_STAT_COLOR : "var(--dim)",
        transition: "background .15s ease, color .15s ease, border-color .15s ease",
      }}
    >
      <span style={{
        width: 10, height: 2, borderRadius: 1,
        background: value ? CONTEXT_STAT_COLOR : "var(--line-strong)",
      }} />
      {stat.label}
    </div>
  );
}

// The overlay's own axis and line. Returned as an array rather than a
// fragment because Recharts reads its children's component types directly to
// decide what to render -- a Fragment wrapper makes both elements invisible
// to it. `key`s are only here to satisfy React's array-child warning.
function contextStatChartParts(stat, show, isNarrow) {
  if (!stat || !show) return null;
  return [
    <YAxis
      key="ctx-axis"
      yAxisId="ctx"
      orientation="right"
      dataKey={stat.key}
      tick={{ fill: CONTEXT_STAT_COLOR, fontSize: 10 }}
      axisLine={false}
      tickLine={false}
      width={isNarrow ? 26 : 34}
      allowDecimals={!!stat.decimals}
    />,
    // Callers place this array *after* <Bar>: later JSX paints later in
    // Recharts, so the line stays legible where it crosses a tall bar
    // instead of disappearing behind it.
    <Line
      key="ctx-line"
      yAxisId="ctx"
      type="monotone"
      dataKey={stat.key}
      stroke={CONTEXT_STAT_COLOR}
      strokeWidth={2}
      dot={{ r: 2.5, fill: CONTEXT_STAT_COLOR, strokeWidth: 0 }}
      isAnimationActive={false}
      // The threshold handle reads bar values, not this -- keeping the line
      // out of the tooltip's payload would drop it from the hover card, so
      // it stays in and ChartTooltip filters on dataKey instead.
      connectNulls
    />,
  ];
}

function NBAPropsPage({ jumpTo }) {
  const [showContext, setShowContext] = useState(false);
  const [matchupId, setMatchupId] = useState(NBA_MATCHUPS[0].id);
  const matchup = NBA_MATCHUPS.find((m) => m.id === matchupId);
  const [playerId, setPlayerId] = useState(NBA_MATCHUPS[0].teamA.players[0].id);
  const [market, setMarket] = useState("pts");
  const [rebSplit, setRebSplit] = useState("total");
  const [side, setSide] = useState("all");
  const [lastN, setLastN] = useState(10);
  const [opponent, setOpponent] = useState("all");
  const [oppView, setOppView] = useState("season");
  const [minMinutes, setMinMinutes] = useState(0);
  const [maxMinutes, setMaxMinutes] = useState(40);
  const [minutesRangeEnabled, setMinutesRangeEnabled] = useState(false);
  const [line, setLine] = useState(null);
  const [dragLine, setDragLine] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const chartRef = React.useRef(null);
  const chartWidth = useElementWidth(chartRef);
  const isNarrow = useIsNarrow();

  React.useEffect(() => {
    if (!jumpTo) return;
    setPlayerId(jumpTo.playerId);
    setMarket(jumpTo.market);
    setLine(null);
    setOpponent("all");
    setTimeout(() => chartRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo && jumpTo.nonce]);

  // Same breakpoint the roster columns collapse at (see .roster-layout in
  // index.css). Above it the graph card sits in the narrow center column with
  // room in its top-right corner for the anchored Filters button and a
  // full-width Game Info strip; below it the card is the whole page width,
  // the roster panels have handed over to MobilePlayerNav, and both of those
  // drop back into normal flow. Distinct from `isNarrow` (480px), which is
  // about how much room the *chart* has for per-bar labels.
  const compact = useIsNarrow(1100);

  const resetFilters = () => {
    setSide("all");
    setLastN(10);
    setOpponent("all");
    setOppView("season");
    setMinMinutes(0);
    setMaxMinutes(40);
    setMinutesRangeEnabled(false);
    setLine(null);
  };

  const player = ALL_NBA_PLAYERS.find((p) => p.id === playerId);
  const allGames = useMemo(() => genGames(player, ALL_NBA_PLAYERS.indexOf(player)), [player]);
  const seasonAvg = useMemo(() => {
    const n = allGames.length || 1;
    const sum = (key) => allGames.reduce((a, g) => a + g[key], 0);
    return {
      pts: sum("pts") / n,
      reb: (sum("oreb") + sum("dreb")) / n,
      ast: sum("ast") / n,
      min: sum("minutes") / n,
    };
  }, [allGames]);

  const opponentsForPlayer = useMemo(
    () => Array.from(new Set(allGames.map((g) => g.opp))).sort(),
    [allGames]
  );

  // Multi-season history vs the selected opponent (prior 2 seasons + any mock
  // playoff series), only computed once a specific opponent is chosen.
  const oppHistory = useMemo(
    () => (opponent === "all" ? { priorSeasons: [], playoffs: [] } : genOpponentHistory(player, ALL_NBA_PLAYERS.indexOf(player), opponent)),
    [player, opponent]
  );
  const currentSeasonVsOpp = useMemo(
    () => allGames.filter((g) => g.opp === opponent),
    [allGames, opponent]
  );
  const h2h3yGames = useMemo(
    () => [...oppHistory.priorSeasons, ...currentSeasonVsOpp].sort((a, b) => a.date.localeCompare(b.date)),
    [oppHistory, currentSeasonVsOpp]
  );

  const filtered = useMemo(() => {
    if (opponent !== "all") {
      let g;
      switch (oppView) {
        case "h2h3y": g = h2h3yGames; break;
        case "home": g = h2h3yGames.filter((x) => x.home); break;
        case "away": g = h2h3yGames.filter((x) => !x.home); break;
        case "playoffs": g = oppHistory.playoffs; break;
        case "season":
        default: g = currentSeasonVsOpp; break;
      }
      return g.filter((game) => game.minutes >= minMinutes && game.minutes <= maxMinutes);
    }
    let g = allGames.filter((game) => {
      if (side === "home" && !game.home) return false;
      if (side === "away" && game.home) return false;
      if (game.minutes < minMinutes || game.minutes > maxMinutes) return false;
      return true;
    });
    if (lastN !== "all") g = g.slice(-lastN);
    return g;
  }, [allGames, side, opponent, oppView, minMinutes, maxMinutes, lastN, h2h3yGames, oppHistory, currentSeasonVsOpp]);

  // On narrow (phone-width) screens, beyond a Last-10 sample per-bar team
  // logos/abbreviations can't stay legible, so the x-axis switches to sparse
  // date labels instead (see DateAxisTick). Desktop has enough width for
  // logo+abbr+date per bar at any sample size -- axisTickInterval already
  // caps the number of ticks actually drawn, so it never needs this fallback.
  const manyGames = isNarrow && filtered.length > 10;

  const isBinary = market === "dd" || market === "td";
  const values = filtered.map((g) => statValue(g, market, rebSplit));
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  // Binary props (DD/TD) have a fixed 0.5 threshold — achieved (1) counts as a
  // hit, not achieved (0) doesn't. There's nothing to drag for these.
  const effectiveLine = isBinary ? 0.5 : (line === null ? ceilToHalfOdd(avg) : line);
  // Axis ceiling + evenly spaced tick marks: pick a "nice" step (1, 2, 5, 10, 20...)
  // so the y-axis always shows regular, evenly spaced whole numbers instead of
  // an uneven jump like 0, 9, 30.
  // Deliberately keyed off `line` (only non-null once the user has actually
  // dragged the handle to a custom value), not `effectiveLine` -- including
  // the live drag position here made the axis grow a step every time the
  // handle crossed a half-point while dragging, since a taller axis raised
  // topValue, which raised the handle's own `max`, letting it drag higher
  // still. The *default* suggested line (ceilToHalfOdd(avg), used only while
  // line is null) can still nudge the axis up if it rounds just past the
  // tallest bar, but once a real line is set the axis stays put and the
  // handle simply can't be dragged above it.
  const topValue = Math.max(...values, line === null ? ceilToHalfOdd(avg) : 0, 1);
  const rawMax = isBinary ? 1 : topValue + Math.max(1, Math.ceil(topValue * 0.05));
  const niceStep = (() => {
    if (isBinary) return 1;
    const targetTicks = 5;
    const roughStep = rawMax / targetTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(roughStep || 1)));
    const norm = roughStep / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 3 ? 3 : norm <= 5 ? 5 : 10) * mag;
    return Math.max(1, step);
  })();
  const chartMax = isBinary ? 1 : Math.ceil(rawMax / niceStep) * niceStep;
  const chartTicks = isBinary
    ? [0, 1]
    : Array.from({ length: chartMax / niceStep + 1 }, (_, i) => i * niceStep);

  // Filters-panel wiring. Picking an opponent here switches the page into a
  // different mode (see the oppView switch in the `filtered` memo), where Game
  // location and Sample size stop applying entirely -- so the count below
  // only ever tallies the controls that are actually live in the current
  // mode, rather than reporting filters that aren't doing anything.
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (opponent !== 'all') {
      n += 1;
      if (oppView !== 'season') n += 1;
    } else {
      if (side !== 'all') n += 1;
      if (lastN !== 10) n += 1;
    }
    if (minMinutes !== 0 || maxMinutes !== 40) n += 1;
    return n;
  }, [opponent, oppView, side, lastN, minMinutes, maxMinutes]);

  const splitCells = buildHitRateSplits({
    allGames,
    statValue: (g) => statValue(g, market, rebSplit),
    effectiveLine,
    lastN,
    onSetLastN: setLastN,
    h2h: false,
    onSetH2h: () => {},
    opponentAbbr: null,
    shortLabels: true,
    includeH2h: false,
  });

  const hits = values.filter((v) => v > effectiveLine).length;
  const hitRate = values.length ? hits / values.length : 0;
  const edge = avg - effectiveLine;

  const marketLabel = market === "reb"
    ? `${REB_SPLITS.find((r) => r.id === rebSplit)?.label ?? "Total"} Reb.`
    : MARKETS.find((m) => m.id === market)?.label ?? "";

  // Season-wide average for the *currently selected market*, distinct from
  // `avg` (which is scoped to `filtered`, i.e. whatever the location/opponent/
  // minutes/sample-size filters have narrowed the chart down to). This is what
  // lets the metric rail show "Season Avg" and "Graph Avg" as two genuinely
  // different numbers instead of the same value twice.
  const seasonValuesForMarket = allGames.map((g) => statValue(g, market, rebSplit));
  const seasonAvgForMarket = seasonValuesForMarket.length
    ? seasonValuesForMarket.reduce((a, b) => a + b, 0) / seasonValuesForMarket.length
    : 0;

  // Who this player actually lines up against in the selected matchup -- read
  // off the *other* roster, not the `opponent` filter, so the Game Info badge
  // always describes tonight's game rather than whatever historical opponent
  // the filters happen to be zoomed into. Which roster is "other" depends on
  // which side the selected player is on: clicking a name in the right-hand
  // panel flips the sides.
  const playerOnTeamA = matchup.teamA.players.some((p) => p.id === playerId);
  const gameOppRoster = playerOnTeamA ? matchup.teamB : matchup.teamA;
  const gameOppAbbr = gameOppRoster.players[0]?.team;
  const gameOppDef = gameOppAbbr ? getNBADefRank(market, gameOppAbbr) : null;
  const gameOppTier = gameOppDef ? defTier(gameOppDef.rank) : null;
  const defCategoryLabel = nbaDefCategoryLabel(market);
  const tierColor = (t) => (t === "soft" ? "var(--green)" : t === "tough" ? "var(--red)" : "var(--dim)");

  // Detailed rate-stat row: the same columns computed twice, once over the
  // filtered sample the chart is showing and once over the full season, so
  // every cell can carry a "how is he trending" delta underneath it.
  const rateWindow = useMemo(() => hoopsRateAgg(filtered), [filtered]);
  const rateSeason = useMemo(() => hoopsRateAgg(allGames), [allGames]);
  const rateCards = HOOPS_RATE_COLUMNS.map((c) => ({
    key: c.key,
    label: c.label,
    value: `${rateWindow[c.key].toFixed(c.decimals)}${c.suffix || ""}`,
    delta: fmtStatDelta(rateWindow[c.key] - rateSeason[c.key], c.decimals, c.better, c.suffix || ""),
  }));
  const rateGlossary = HOOPS_RATE_COLUMNS.map((c) => ({ key: c.key, ...HOOPS_RATE_GLOSSARY[c.key] }));

  // Game Info's right-hand context slot. MLB fills this with a live forecast
  // and park-factor swings; there is no weather or venue-effect data for an
  // indoor sport, so the equivalent pre-game read here is how the opponent
  // ranks defensively in whichever market is selected -- the same numbers the
  // game-log table's Def# column already shows, applied to tonight's opponent.
  const gameInfoBadge = gameOppDef && (
    <>
      <span style={{ fontSize: 11.5, color: "var(--dim)", whiteSpace: "nowrap" }}>
        vs {gameOppAbbr} {defCategoryLabel}
      </span>
      <span className="mono tnum" style={{ fontWeight: 600, fontSize: 11, color: "var(--text)", whiteSpace: "nowrap" }}>
        {gameOppDef.rating}
      </span>
      <span className="status-pill" style={{ color: tierColor(gameOppTier), whiteSpace: "nowrap" }}>
        #{gameOppDef.rank} {gameOppTier === "soft" ? "Favorable" : gameOppTier === "tough" ? "Tough" : "Neutral"}
      </span>
    </>
  );

  const gameInfoDetails = gameOppDef && (
    <>
      <div style={{ marginBottom: 4 }}>
        {gameOppRoster.label} rank #{gameOppDef.rank} of {TEAMS.length} in {defCategoryLabel} ({gameOppDef.rating}) —
        {gameOppTier === "soft"
          ? " one of the softer matchups in the league for this market, which nudges toward the over."
          : gameOppTier === "tough"
            ? " one of the tougher matchups in the league for this market, which nudges toward the under."
            : " a middle-of-the-pack matchup, so the defense isn't the deciding factor here."}
      </div>
      <div>{matchup.venue}{matchup.city ? ` — ${matchup.city}` : ""}</div>
    </>
  );

  // Player identity: avatar + name/team/pos + season snapshot. Now the top of
  // the graph card rather than its own bordered panel beside the matchup
  // selector, so it carries only a bottom divider against the detailed stat
  // row underneath. paddingRight reserves room for the Filters button, which
  // floats in the card's absolute top-right corner on desktop.
  const playerIdentityRow = (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: compact ? 10 : 20,
      flexWrap: "wrap", borderBottom: "1px solid var(--line)",
      padding: compact ? "8px 12px" : "12px 20px",
      paddingRight: compact ? 12 : 110,
    }}>
      <PlayerAvatar
        key={player.id}
        name={player.name}
        alt={player.name}
        sport="nba"
        team={player.team}
        colorMap={NBA_TEAM_COLORS}
        headshotSrc={espnHeadshot(player.espnId)}
        fallbackSrc={nbaHeadshot(player.nbaId)}
        size={compact ? 56 : 84}
        inset={compact ? 3 : 5}
        backing={(NBA_TEAM_COLORS[player.team] || {}).primary || "#000"}
        imgBorder="1px solid var(--line)"
        fadeIn
        shadow={`0 4px 14px ${(NBA_TEAM_COLORS[player.team] || {}).primary || "#000"}40`}
      />

      <div style={{ textAlign: "center", paddingRight: compact ? 8 : 16 }}>
        <div className="oswald" style={{ fontSize: compact ? 13 : 16, color: "var(--text)", whiteSpace: "nowrap" }}>{player.name}</div>
        <div style={{ fontSize: compact ? 9 : 10.5, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {player.team} · {player.pos} · Season
        </div>
      </div>

      <div style={{ display: "flex", gap: compact ? 12 : 20, flexWrap: "wrap" }}>
        {[
          { label: "PTS", value: seasonAvg.pts },
          { label: "REB", value: seasonAvg.reb },
          { label: "AST", value: seasonAvg.ast },
          { label: "MIN", value: seasonAvg.min },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div className="mono" style={{ fontSize: compact ? 14 : 18, color: "var(--amber)", fontWeight: 700 }}>{s.value.toFixed(1)}</div>
            <div style={{ fontSize: compact ? 9 : 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const filtersBody = (
    <FilterPanel activeCount={activeFilterCount} onReset={resetFilters}>
      {/* Sample size only exists in "any opponent" mode -- once a specific
           opponent is picked the predicate switches to the oppView branch,
           which ignores lastN entirely. Rendering it anyway would be a
           control that visibly does nothing. */}
      {opponent === "all" && (
        <FilterSection title="Sample size">
          <SampleSizeGrid cells={splitCells} />
          <SampleSizeSlider total={allGames.length} lastN={lastN} onSetLastN={setLastN} />
        </FilterSection>
      )}

      <FilterSection shaded>
        <div className={opponent === "all" ? "fp-grid-2" : ""}>
          {opponent === "all" && (
            <div>
              <div className="micro-label" style={{ fontSize: 10, marginBottom: 7 }}>Game location</div>
              <div className="fp-row">
                {["all", "home", "away"].map((s) => (
                  <div key={s} role="button" className={`chip-sm ${side === s ? "active" : ""}`} onClick={() => setSide(s)}>
                    {s === "all" ? "All games" : s === "home" ? "Home" : "Away"}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="micro-label" style={{ fontSize: 10, marginBottom: 7 }}>Opponent</div>
            <select
              className="select-sm"
              value={opponent}
              onChange={(e) => {
                const next = e.target.value;
                setOpponent(next);
                setOppView("season");
                // Picking a specific opponent drops Game location and Sample
                // size out of the predicate *and* hides their controls, so any
                // selection made beforehand would sit there invisibly and
                // silently reapply the moment you switched back to "Any
                // opponent". Reset on the way in so hidden state is never
                // stale.
                if (next !== "all") { setSide("all"); setLastN(10); }
              }}
            >
              <option value="all">Any opponent</option>
              {opponentsForPlayer.map((o) => <option key={o} value={o}>vs {o}</option>)}
            </select>
          </div>
        </div>
      </FilterSection>

      {/* Opponent mode gets its own section rather than swapping itself into
           Game location's slot. Head-to-Head (3Y) and Playoffs read from
           multi-season arrays that only exist once an opponent is chosen (see
           oppHistory), so this genuinely is a different view of a different
           dataset -- not another predicate over the same game log. */}
      {opponent !== "all" && (
        <FilterSection shaded title={`View vs ${opponent}`}>
          <select className="select-sm" value={oppView} onChange={(e) => setOppView(e.target.value)}>
            <option value="season">Current Season</option>
            <option value="h2h3y">Head-to-Head (3Y)</option>
            <option value="home">Home vs Opp</option>
            <option value="away">Away vs Opp</option>
            <option value="playoffs">Playoffs vs Opp</option>
          </select>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 8, lineHeight: 1.5 }}>
            Game location and sample size don’t apply while an opponent is selected — this view sets the sample.
          </div>
        </FilterSection>
      )}

      <FilterSection shaded>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
          <span className="micro-label" style={{ fontSize: 10 }}>Minutes</span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--amber)" }}>
            {!minutesRangeEnabled
              ? (minMinutes === 0 ? "Any" : `${minMinutes}+`)
              : (minMinutes === 0 && maxMinutes === 40 ? "Any" : `${minMinutes}–${maxMinutes}`)}
          </span>
        </div>
        <ThresholdSlider
          min={0}
          max={40}
          step={1}
          lo={minMinutes}
          hi={maxMinutes}
          onChangeLo={setMinMinutes}
          onChangeHi={setMaxMinutes}
          rangeEnabled={minutesRangeEnabled}
          onToggleRange={() => setMinutesRangeEnabled((v) => !v)}
        />
      </FilterSection>
    </FilterPanel>
  );

  // Local chart height, matching the MLB card's rather than the taller shared
  // CHART_HEIGHT: the card now carries the game-info, identity, market,
  // detail-stat and metric rows above the plot, so a shorter chart keeps the
  // whole stack visible together instead of pushing the bars off-screen.
  const NBA_GRAPH_CHART_HEIGHT = isNarrow ? 340 : 600;

  const chartBlock = (
    <div
      ref={chartRef}
      style={{
        position: "relative", boxSizing: "border-box", height: NBA_GRAPH_CHART_HEIGHT,
        // A nested strip, not a second card: the graph card's own wrapper
        // already supplies the border/shadow, so this only needs a subtle
        // background to read as its own section without a competing outline.
        background: "var(--surface-2)", borderRadius: "var(--r-md)",
        padding: isNarrow ? "16px 6px 10px" : "16px 16px 8px",
      }}
    >
      {/* The launcher owns the popover, bottom sheet, click-outside and
           Escape handling (shared with the other sports pages). Lives inside
           the chart's own container (not the identity/header card) so it
           reads as part of the chart -- anchored to this div's top-right
           corner, in the empty space above the bars, on both mobile and
           desktop alike. */}
      <FilterPanelLauncher
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        activeCount={activeFilterCount}
        compact={compact}
        anchored
      >
        {filtersBody}
      </FilterPanelLauncher>
      <ContextStatToggle stat={NBA_CONTEXT_STAT} value={showContext} onChange={setShowContext} compact={isNarrow} />
      <div style={{ height: "100%", width: "100%", touchAction: "pan-y" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={filtered.map((g, i) => ({
            idx: i + 1,
            opp: g.opp,
            axisKey: `${g.opp}__${g.date}`,
            value: statValue(g, market, rebSplit),
            date: g.date,
            minutes: g.minutes,
            home: g.home,
            defRank: TEAM_DEF[g.opp].rank,
          }))}
          // right clears LineHandle, which anchors to the container's right
          // edge: it needs right:8 + its 52px minimum, less the 6px the
          // narrow chart wrapper already pads, so 54 is the floor. 30 left
          // the pill sitting on top of the last bar.
          margin={{ top: 10, right: isNarrow ? 64 : 60, bottom: manyGames ? 30 : (isNarrow ? 42 : 78), left: isNarrow ? 0 : 20 }}
          barCategoryGap={isNarrow ? "4%" : "6%"}
        >
          {/* Invisible (stroke="transparent"), not removed: rendered fully
               open per the PropsMadness reference (no grid lines, just
               floating y-tick labels), but LineHandle's drag math
               (getPlotBoundsY, above) measures the plot's top/bottom by
               querying this component's own rendered .recharts-cartesian-
               grid-horizontal line elements -- removing the component
               entirely would silently break the drag handle instead of
               just hiding a visual grid. */}
          <CartesianGrid stroke="transparent" vertical={false} />
          <XAxis
            dataKey={manyGames ? "date" : "axisKey"}
            interval={manyGames ? Math.max(0, Math.ceil(filtered.length / (isNarrow ? 5 : 8)) - 1) : axisTickInterval(filtered.length, isNarrow, chartWidth)}
            tick={manyGames ? (props) => <DateAxisTick {...props} compact={isNarrow} /> : (props) => <TeamAxisTick {...props} logoFn={nbaTeamLogo} compact={isNarrow} />}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, chartMax]}
            ticks={chartTicks}
            tick={{ fill: "var(--chart-ink)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={isNarrow ? 32 : 60}
            label={isNarrow ? undefined : { value: marketLabel, angle: -90, position: "insideLeft", offset: 10, style: { textAnchor: "middle", fill: "var(--chart-ink)", fontSize: 11, fontWeight: 600 } }}
          />
          <Tooltip
            content={<ChartTooltip effectiveLine={effectiveLine} isBinary={isBinary} marketLabel={marketLabel} logoFn={nbaTeamLogo} />}
            cursor={{ fill: "var(--surface-3)", opacity: 0.5 }}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} minPointSize={(v) => (v === 0 ? 3 : 0)}>
            {filtered.map((g, i) => {
              const v = statValue(g, market, rebSplit);
              const fill = isBinary ? (v === 1 ? CHART_GREEN : "transparent") : (v > effectiveLine ? CHART_GREEN : CHART_RED);
              return <Cell key={i} fill={fill} />;
            })}
            <LabelList dataKey="value" content={(props) => <BarValueLabel {...props} isBinary={isBinary} />} />
          </Bar>
          {contextStatChartParts(NBA_CONTEXT_STAT, showContext, isNarrow)}
          {/* Rendered after Bar (not before) so the dashed threshold line
               draws on top of the bars instead of being clipped underneath
               them -- later JSX = higher SVG paint order in Recharts. */}
          {!isBinary && <ReferenceLine y={dragLine !== null ? dragLine : effectiveLine} stroke="var(--amber)" strokeDasharray="4 4" />}
        </ComposedChart>
      </ResponsiveContainer>
      </div>
      {!isBinary && (
        <LineHandle
          value={effectiveLine}
          onChange={(v) => setLine(v)}
          onDragValue={setDragLine}
          min={0}
          max={chartMax}
          containerRef={chartRef}
        />
      )}
    </div>
  );

  // Game-log ledger table -- behind the same "▸ Game Logs (n)" disclosure the
  // MLB and NFL pages use. Its own storageKey, so collapsing it here doesn't
  // also collapse theirs.
  const ledgerTable = (
    <CollapsibleSection title={`Game Logs (${filtered.length})`} storageKey="nba_game_logs_open">
      <div style={{ border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ minWidth: 580 }}>
            <div className="mono" style={{ display: "grid", gridTemplateColumns: "5fr 9fr 6fr 6fr 6fr 6fr 7fr 6fr 7fr", padding: "10px 14px", fontSize: 11, color: "var(--dim)", borderBottom: "1px solid var(--line)", textTransform: "uppercase", textAlign: "center" }}>
              <div>#</div><div>Date</div><div>Opp</div><div>Def#</div><div>Loc</div><div>Min</div><div>{marketLabel}</div><div>Line</div><div>Result</div>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto", overflowX: "hidden" }}>
              {filtered.slice().reverse().map((g, i) => {
                const v = statValue(g, market, rebSplit);
                const over = v > effectiveLine;
                const push = !isBinary && v === effectiveLine;
                const def = TEAM_DEF[g.opp];
                const tier = defTier(def.rank);
                return (
                  <div key={g.date} className="ledger-row mono" style={{ display: "grid", gridTemplateColumns: "5fr 9fr 6fr 6fr 6fr 6fr 7fr 6fr 7fr", padding: "9px 14px", fontSize: 12.5, textAlign: "center" }}>
                    <div style={{ color: "var(--dim)" }}>{filtered.length - i}</div>
                    <div>{g.date}</div>
                    <div>{g.opp}</div>
                    <div style={{ color: tierColor(tier) }}>#{def.rank}</div>
                    <div style={{ color: "var(--dim)" }}>{g.home ? "Home" : "Away"}</div>
                    <div>{g.minutes}</div>
                    <div style={{ color: "var(--text)" }}>{isBinary ? (v === 1 ? "Yes" : "No") : v}</div>
                    <div style={{ color: "var(--dim)" }}>{isBinary ? "—" : effectiveLine}</div>
                    <div style={{ color: push ? "var(--dim)" : over ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                      {isBinary ? (v === 1 ? "YES" : "NO") : (push ? "PUSH" : over ? "OVER" : "UNDER")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );

  return (
    <div className="page-shell page-shell--mobile-nav" style={{ maxWidth: 1920, margin: "0 auto", boxSizing: "border-box" }}>
    <MobilePlayerNav
      teamA={matchup.teamA}
      teamB={matchup.teamB}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => espnHeadshot(p.espnId)}
      headshotFallback={(p) => nbaHeadshot(p.nbaId)}
      metaLine={(p) => `${p.pos} · ${p.base.pts.toFixed(1)} PTS`}
      avatarBg={(p) => teamAvatarBackground(NBA_TEAM_COLORS, p.team)}
    />
    <div className="roster-layout">
    <TeamRosterPanel
      teamLabel={matchup.teamA.label}
      players={matchup.teamA.players}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => espnHeadshot(p.espnId)}
      headshotFallback={(p) => nbaHeadshot(p.nbaId)}
      metaLine={(p) => `${p.pos} · ${p.base.pts.toFixed(1)} PTS`}
      avatarBg={(p) => teamAvatarBackground(NBA_TEAM_COLORS, p.team)}
    />
    <div className="roster-layout-center">
      {/* Below the roster breakpoint the graph card is the full page width
           and its top-right corner is no longer a safe place to float things,
           so the game info falls back to the original date/venue pill above
           the card -- the same split the MLB page makes between its
           GameConditionsBar (desktop, inside the card) and nextGamePill
           (mobile, above it). */}
      {compact && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center", gap: 14, flexWrap: "wrap",
          width: "fit-content", margin: "0 auto 12px", padding: "9px 20px",
          background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 999,
          fontSize: 12.5, color: "var(--dim)",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>
              {new Date(matchup.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <span>·</span>
            <span className="mono" style={{ color: "var(--amber)", fontWeight: 700 }}>
              {new Date(matchup.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{matchup.venue}</span>
            <span>— {matchup.city}</span>
          </span>
        </div>
      )}

      {/* Matchup selector, alone in its own centered row above the card. The
           separate player dropdown that used to sit beside it is gone: every
           sport page now picks the matchup here and the player by clicking
           their row in either roster panel, which this page already supported
           -- the dropdown was a second way to do the same thing. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, marginTop: compact ? 14 : 20, width: compact ? "100%" : "auto" }}>
        <GameSelect
          groups={NBA_MATCHUPS_BY_DATE}
          value={matchupId}
          logoFn={nbaTeamLogo}
          compact={compact}
          onChange={(next) => {
            setMatchupId(next.id);
            setPlayerId(next.teamA.players[0].id);
            setLine(null);
            setOpponent("all");
          }}
        />
      </div>

      {/* The graph card: game info, player identity, market tabs, both stat
           tiers and the chart blended into one bordered container instead of
           the separately-bordered boxes this page used to stack. Mirrors the
           MLB page's graphCard(). */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", marginBottom: 16, overflow: "hidden", position: "relative" }}>
        {!compact && (
          <GameInfoBar
            dateISO={matchup.date}
            isHome={!playerOnTeamA}
            opponentLabel={gameOppRoster.label}
            venue={matchup.venue}
            city={matchup.city}
            detailsStorageKey="nba_game_info_details_open"
            badge={gameInfoBadge}
            details={gameInfoDetails}
          />
        )}

        {playerIdentityRow}

        <div style={{ padding: compact ? "10px 12px 14px" : "12px 20px 18px" }}>
          <MarketSectionGrid
            singleBar
            sections={[
              { label: "Core", markets: MARKETS_ROW_1 },
              { label: "Combos", markets: MARKETS_ROW_3 },
              { label: "Shooting / FT", markets: MARKETS_ROW_4 },
              { label: "Defense & hustle", markets: MARKETS_ROW_2 },
              { label: "Milestones", markets: MARKETS_ROW_5, pills: true },
            ]}
            activeMarket={market}
            onSelect={(id) => { setMarket(id); setLine(null); }}
            isNarrow={isNarrow}
          />
          {/* Rebound split: only shown once Rebounds is the active market */}
          {market === "reb" && (
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {REB_SPLITS.map((r) => (
                <div key={r.id} className={`chip ${rebSplit === r.id ? "active" : ""}`} onClick={() => { setRebSplit(r.id); setLine(null); }}>
                  {r.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <SampleStatsRow
          cards={rateCards}
          glossary={rateGlossary}
          compact={compact}
          intro="A quick guide to these stats, if you're newer to basketball props. One thing that trips people up: the PTS/REB/AST/MIN card above is always the full season average, while the numbers below are for whatever your filters are currently showing — so the same stat can read differently in the two rows at the same time."
        />
        <MetricRail
          seasonAvg={seasonAvgForMarket}
          graphAvg={avg}
          hitRate={hitRate}
          hits={hits}
          total={values.length}
          edge={edge}
          compact={compact}
        />

        {/* Playoffs is the one view that can legitimately come back empty --
             say so rather than leaving an axis with no bars under it. */}
        {opponent !== "all" && oppView === "playoffs" && filtered.length === 0 && (
          <div style={{ padding: "0 20px 16px", textAlign: "center", color: "var(--dim)", fontSize: 13 }}>
            No playoff meetings vs {opponent} in the sample data.
          </div>
        )}

        {chartBlock}

        <HitRateSplits
          allGames={allGames}
          statValue={(g) => statValue(g, market, rebSplit)}
          effectiveLine={effectiveLine}
          lastN={lastN}
          onSetLastN={setLastN}
          h2h={false}
          onSetH2h={() => {}}
          opponentAbbr={null}
          isNarrow={isNarrow}
          max={allGames.length}
          includeH2h={false}
        />
      </div>

      {ledgerTable}
    </div>
    <TeamRosterPanel
      teamLabel={matchup.teamB.label}
      players={matchup.teamB.players}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => espnHeadshot(p.espnId)}
      headshotFallback={(p) => nbaHeadshot(p.nbaId)}
      metaLine={(p) => `${p.pos} · ${p.base.pts.toFixed(1)} PTS`}
      avatarBg={(p) => teamAvatarBackground(NBA_TEAM_COLORS, p.team)}
    />
    </div>

      <div style={{ marginTop: 20, fontSize: 12, color: "var(--dim)" }}>
        Sample data only — built to test the filtering and layout before wiring in a real stats/odds feed.
      </div>
      <PlayerNewsModule playerName={player.name} headshotSrc={espnHeadshot(player.espnId)} sport="nba" team={player.team} />
    </div>
  );
}

// ---------- NFL (Dallas Cowboys offense) mock data ----------
const NFL_TEAMS = [
  "PHI","WAS","NYG","DAL","GB","CHI","DET","MIN","SF","SEA","LAR","ARI","NO","TB","ATL","CAR",
  "BUF","MIA","NYJ","NE","BAL","CIN","PIT","CLE","HOU","IND","JAX","TEN","KC","LAC","LV","DEN",
];

// Builds one category's team-by-team defensive ranking (lower rating =
// tougher defense in that specific category, e.g. pass yards allowed/game).
// Shared across sports: each category gets its own seed so a team's rank
// varies realistically across categories (a strong run defense can still be
// a weak pass defense; a good hits-allowed pitching staff can still be
// homer-prone).
function buildDefenseCategoryFor(teams, seed, base, spread) {
  const rng = mulberry32(seed);
  const raw = teams.map((t) => ({ team: t, rating: Math.round((base + rng() * spread) * 10) / 10 }));
  raw.sort((a, b) => a.rating - b.rating);
  raw.forEach((r, i) => (r.rank = i + 1));
  const byTeam = {};
  raw.forEach((r) => (byTeam[r.team] = r));
  return byTeam;
}

function buildNFLDefenseCategory(seed, base, spread) {
  return buildDefenseCategoryFor(NFL_TEAMS, seed, base, spread);
}

// Overall total-yards defense — used only as the Def# fallback for markets
// with no defensive-matchup concept (kicking).
const NFL_TEAM_DEF = buildNFLDefenseCategory(4200, 300, 120);

// Every individual prop type gets its own independent defensive ranking —
// a team's defense vs. receptions, vs. receiving yards, and vs. receiving
// TDs are three different numbers in reality (and against real teams,
// vs. WR / vs. TE / vs. RB differ too), so none of them may share a bucket.
// [base, spread] is a rough plausible per-game range for that stat, just
// used to seed a believable rating; the rank ordering is what matters.
const NFL_MARKET_DEF_RANGE = {
  passYds: [180, 100],
  passTd: [1.2, 1.6],
  comp: [16, 10],
  int: [0.5, 1.2],
  rushYds: [80, 80],
  passRushYds: [260, 110],
  rushAtt: [16, 12],
  rec: [3.5, 3],
  recYds: [50, 80],
  longRec: [22, 14],
  passAtt: [32, 12],
  scrim: [90, 90],
  anytimeTd: [0.5, 1.0],
};
const NFL_MARKET_DEF_BASE_LABEL = {
  passYds: "pass yards defense",
  passTd: "pass TD defense",
  comp: "completions allowed",
  int: "interception rate",
  rushYds: "rush yards defense",
  passRushYds: "total yards defense",
  rushAtt: "rush volume allowed",
  rec: "receptions allowed",
  recYds: "receiving yards allowed",
  longRec: "explosive-play defense",
  passAtt: "pass volume allowed",
  scrim: "scrimmage yards defense",
  anytimeTd: "TD defense",
};
const NFL_POS_QUALIFIER = { WR: "vs WR", TE: "vs TE", RB: "vs RB", QB: "" };

// Real per-category "defense vs pass/rush/receptions" splits aren't part of
// any free public API (that's what makes DVOA-style data proprietary), so
// there's no honest way to give every market its own real ranking. Instead,
// once loaded, nflTeamDefReal holds ONE real ranking per team -- points
// allowed per game, from the actual 2025 standings (see fetchNFLTeamDefense)
// -- applied across every market as the closest available real signal.
// Until it loads (or if the fetch ever fails), the old per-category mock
// ranking below is used as an instant fallback so nothing shows a blank state.
let nflTeamDefReal = null;

// Lazily-built, memoized per (market, position) so each prop type's ranking
// is computed once and reused, instead of re-sorting 31 teams every render.
const nflDefCategoryCache = {};
const NFL_DEF_RANK_FALLBACK = { rank: 16, rating: 0 };
function getNFLDefRank(market, pos, opp) {
  if (nflTeamDefReal && nflTeamDefReal[opp]) return nflTeamDefReal[opp];
  const range = NFL_MARKET_DEF_RANGE[market];
  if (!range) return NFL_TEAM_DEF[opp] || NFL_DEF_RANK_FALLBACK; // kicking markets — no defensive-matchup concept
  const key = `${market}_${pos}`;
  if (!nflDefCategoryCache[key]) {
    const seed = 4300 + (hashStr(key) % 5000);
    nflDefCategoryCache[key] = buildNFLDefenseCategory(seed, range[0], range[1]);
  }
  return nflDefCategoryCache[key][opp] || NFL_DEF_RANK_FALLBACK;
}

// ESPN abbreviates Washington as WSH; every other team's abbreviation in the
// standings response already matches NFL_TEAMS.
const NFL_ESPN_ABBR_FIX = { WSH: "WAS" };

// Fetches real 2025 final standings and ranks all 32 teams by points allowed
// per game (lower = tougher defense = rank 1), mirroring the same "one real
// number, sorted" approach used for MLB's defense ranking. Cached to
// sessionStorage since the 2025 season is already final -- this data will
// never change, so there's no need to refetch it more than once per tab.
async function fetchNFLTeamDefense() {
  const cacheKey = "nfl_team_def_v1";
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) return JSON.parse(stored);
  } catch {}

  try {
    const res = await fetch("https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=2025");
    if (!res.ok) return null;
    const data = await res.json();
    const rows = [];
    (data?.children || []).forEach((conf) => {
      (conf?.standings?.entries || []).forEach((entry) => {
        const abbr = NFL_ESPN_ABBR_FIX[entry.team?.abbreviation] || entry.team?.abbreviation;
        const pointsAgainst = entry.stats?.find((s) => s.name === "pointsAgainst")?.value;
        const wins = entry.stats?.find((s) => s.name === "wins")?.value || 0;
        const losses = entry.stats?.find((s) => s.name === "losses")?.value || 0;
        const ties = entry.stats?.find((s) => s.name === "ties")?.value || 0;
        const games = wins + losses + ties;
        if (abbr && pointsAgainst != null && games > 0) {
          rows.push({ abbr, ptsPerGame: pointsAgainst / games });
        }
      });
    });
    if (!rows.length) return null;

    rows.sort((a, b) => a.ptsPerGame - b.ptsPerGame);
    rows.forEach((r, i) => { r.rank = i + 1; });
    const byTeam = {};
    rows.forEach((r) => { byTeam[r.abbr] = { rank: r.rank, rating: Math.round(r.ptsPerGame * 10) / 10 }; });

    try { sessionStorage.setItem(cacheKey, JSON.stringify(byTeam)); } catch {}
    return byTeam;
  } catch {
    return null;
  }
}

// True once the real table above has loaded for this team. At that point
// getNFLDefRank returns the same points-allowed figure whatever the market is,
// so anything that puts a label next to that number has to say what it
// actually is rather than claiming a per-market split the data doesn't have.
function nflDefIsPointsAllowed(opp) {
  return !!(nflTeamDefReal && nflTeamDefReal[opp]);
}

function nflDefCategoryLabel(market, pos) {
  const base = NFL_MARKET_DEF_BASE_LABEL[market];
  if (!base) return "total defense";
  const qualifier = NFL_POS_QUALIFIER[pos];
  return qualifier ? `${base} ${qualifier}` : base;
}

const nflDefTier = (rank) => (rank <= 10 ? "tough" : rank >= 22 ? "soft" : "mid");

// Team abbreviation -> ESPN team-logo CDN slug (mostly lowercase of the
// abbreviation itself; only a handful of teams use a different slug).
const NFL_LOGO_SLUG = {
  PHI: "phi", WAS: "wsh", NYG: "nyg", DAL: "dal", GB: "gb", CHI: "chi", DET: "det",
  MIN: "min", SF: "sf", SEA: "sea", LAR: "lar", ARI: "ari", NO: "no",
  TB: "tb", ATL: "atl", CAR: "car", BUF: "buf", MIA: "mia", NYJ: "nyj",
  NE: "ne", BAL: "bal", CIN: "cin", PIT: "pit", CLE: "cle", HOU: "hou",
  IND: "ind", JAX: "jax", TEN: "ten", KC: "kc", LAC: "lac", LV: "lv", DEN: "den",
};
const nflTeamLogo = (abbr) => `https://a.espncdn.com/i/teamlogos/nfl/500/${NFL_LOGO_SLUG[abbr] || abbr.toLowerCase()}.png`;

// Official-ish NFL brand colors (primary/secondary), used only to tint the
// player avatar's background ring -- see teamAvatarBackground above.

// ESPN player IDs (from espn.com/nfl/team/roster) -> combiner-image headshot URLs.
const NFL_ESPN_ID = {
  dak: "2577417",
  lamb: "4241389",
  pickens: "4426354",
  javonte: "4361579",
  ferguson: "4242355",
  tolbert: "4249417",
  dowdle: "4045163",
  aubrey: "3953687",
  dart: "4689114",
  nabers: "4595348",
  slayton: "3916945",
  hyatt: "4692590",
  skattebo: "4696981",
  tracy: "4360516",
  theojohnson: "4429148",
  sauls: "4566158",
  purdy: "4361741",
  mccaffrey: "3117251",
  guerendo: "4372561",
  evans: "16737",
  pearsall: "4428209",
  cowing: "4575665",
  mclachlan: "4384171",
  pineiro: "4034949",
  stafford: "12483",
  kyren: "4430737",
  corum: "4429096",
  nacua: "4426515",
  adams: "16800",
  whittington: "4569382",
  higbee: "2573401",
  mevis: "4574716",
  nix: "4426338",
  sutton: "3128429",
  waddle: "4372016",
  mims: "4686472",
  jdobbins: "4241985",
  harveyrj: "4568490",
  engram: "3051876",
  lutz: "2985659",
  mahomes: "3139477",
  rice: "4428331",
  worthy: "4683062",
  thornton: "4362921",
  kwalker: "4567048",
  bsmith: "4596602",
  kelce: "15847",
  butker: "3055899",

  // Remaining 13 Week 1 2026 games (26 teams) added below -- same treatment
  // as the six teams above: real starters/positions/ESPN IDs per team,
  // cross-checked against multiple depth-chart sources rather than taken
  // from a single fetch (several teams' skill rosters turned over hard in
  // 2026 free agency/trades -- e.g. A.J. Brown to NE, Tua to ATL, DK Metcalf
  // to PIT -- so names that look surprising here are real, not typos).
  ne_maye: "4431452", ne_brown: "4047646", ne_hollins: "2991662", ne_doubs: "4361432",
  ne_stevenson: "4569173", ne_henderson: "4432710", ne_henry: "3046439", ne_borregales: "4569923",
  sea_darnold: "3912547", sea_jsn: "4430878", sea_kupp: "2977187", sea_horton: "4597703",
  sea_charbonnet: "4426385", sea_price: "4685512", sea_barner: "4576297", sea_myers: "2473037",
  tb_mayfield: "3052587", tb_egbuka: "4567750", tb_godwin: "3116165", tb_mcmillanj: "4430834",
  tb_irving: "4596448", tb_gainwell: "4371733", tb_otton: "4243331", tb_mclaughlin: "3150744",
  cin_burrow: "3915511", cin_chase: "4362628", cin_higgins: "4239993", cin_iosivas: "4368003",
  cin_cbrown: "4362238", cin_perine: "3116389", cin_gesicki: "3116164", cin_mcpherson: "4360234",
  no_shough: "4360689", no_olave: "4361370", no_lance: "4879276", no_tipton: "4573697",
  no_kamara: "3054850", no_miller: "4599739", no_juwan: "3929645", no_smyth: "5208518",
  det_goff: "3046779", det_stbrown: "4374302", det_jwilliams: "4426388", det_teslaa: "5123663",
  det_gibbs: "4429795", det_pacheco: "4361529", det_laporta: "4430027", det_bates: "4689936",
  nyj_geno: "15864", nyj_wilson: "4569618", nyj_mitchell: "4597500", nyj_iwilliams: "4569371",
  nyj_hall: "4427366", nyj_allen: "4685247", nyj_taylor: "4808766", nyj_york: "4428963",
  ten_ward: "4688380", ten_tate: "4871023", ten_ridley: "3925357", ten_osborn: "3916566",
  ten_pollard: "3916148", ten_spears: "4428557", ten_helm: "4686728", ten_slye: "3124084",
  bal_ljackson: "3916387", bal_flowers: "4429615", bal_bateman: "4360939", bal_moore: "2576581",
  bal_henry: "3043078", bal_hill: "4038441", bal_andrews: "3116365", bal_loop: "4697745",
  ind_djones: "3917792", ind_pierce: "4360078", ind_downs: "4688813", ind_dulin: "4061956",
  ind_taylor: "4242335", ind_giddens: "4874509", ind_warren: "4431459", ind_shrader: "4571557",
  atl_tua: "4241479", atl_london: "4426502", atl_dotson: "4361409", atl_zaccheaus: "3917914",
  atl_bijan: "4430807", atl_brobinson: "4241474", atl_pitts: "4360248", atl_romo: "4051167",
  pit_rodgers: "8439", pit_metcalf: "4047650", pit_pittman: "4035687", pit_bernard: "4685261",
  pit_warren: "4569987", pit_dowdle: "4038815", pit_freiermuth: "4361411", pit_boswell: "17372",
  chi_cwilliams: "4431611", chi_odunze: "4431299", chi_burden: "4685278", chi_raymond: "2973405",
  chi_swift: "4259545", chi_monangai: "4608686", chi_kmet: "4258595", chi_santos: "17427",
  car_byoung: "4685720", car_mcmillant: "4685472", car_legette: "4430034", car_coker: "4695883",
  car_hubbard: "4241416", car_brooks: "4678008", car_tremble: "4372780", car_fitzgerald: "4568263",
  cle_watson: "3122840", cle_jeudy: "4241463", cle_tillman: "4369863", cle_corley: "4613104",
  cle_judkins: "4685702", cle_sampson: "5081397", cle_fannin: "5083076", cle_szmyt: "4258620",
  jax_lawrence: "4360310", jax_thomasjr: "4432773", jax_meyers: "3916433", jax_pwashington: "4432620",
  jax_etienne: "4239996", jax_tuten: "4882093", jax_strange: "4430539", jax_little: "4686361",
  buf_allen: "3918298", buf_moore: "3915416", buf_coleman: "4635008", buf_shavers: "4241476",
  buf_cook: "4379399", buf_davis: "4429501", buf_kincaid: "4385690", buf_bass: "3917232",
  hou_stroud: "4432577", hou_collins: "4258173", hou_dell: "4366031", hou_hutchinson: "4686422",
  hou_montgomery: "4035538", hou_marks: "4429059", hou_schultz: "3117256", hou_fairbairn: "2971573",
  mia_willis: "4242512", mia_waddle: "4372016", mia_mwashington: "4569603", mia_marshall: "4362630",
  mia_achane: "4429160", mia_wright: "4682745", mia_dulcich: "4367209", mia_patterson: "4243371",
  lv_cousins: "14880", lv_tucker: "4428718", lv_thornton: "4432775", lv_sjackson: "4361332",
  lv_jeanty: "4890973", lv_mwashington: "4686658", lv_bowers: "4432665", lv_gay: "4249087",
  gb_love: "4036378", gb_watson: "4248528", gb_reed: "4362249", gb_melton: "4259305",
  gb_jacobs: "4047365", gb_lloyd: "4429023", gb_kraft: "4572680", gb_smack: "4869461",
  min_murray: "3917315", min_jefferson: "4262921", min_addison: "4429205", min_jennings: "3886598",
  min_ajones: "3042519", min_mason: "4360569", min_hockenson: "4036133", min_reichard: "4567104",
  was_daniels: "4426348", was_mclaurin: "3121422", was_samuel: "3126486", was_nbrown: "3121409",
  was_croskeymerritt: "4575131", was_white: "4697815", was_okonkwo: "4360635", was_stevens: "5081335",
  phi_hurts: "4040715", phi_dsmith: "4241478", phi_hbrown: "4241372", phi_cooper: "4715355",
  phi_barkley: "3929630", phi_bigsby: "4429013", phi_goedert: "3121023", phi_elliott: "3050478",
  ari_brissett: "2578570", ari_harrisonjr: "4432708", ari_weaver: "4428811", ari_fehoko: "4360739",
  ari_love: "4870808", ari_allgeier: "4373626", ari_mcbride: "4361307", ari_ryland: "4363538",
  lac_herbert: "4038941", lac_mcconkey: "4612826", lac_johnston: "4429025", lac_lambertsmith: "4430870",
  lac_hampton: "4685382", lac_vidal: "4430968", lac_gadsden: "4595342", lac_dicker: "4362081",
};
// Direct full-resolution asset (not the low-res 200x200 combiner crop) — the
// browser's own object-fit: cover crop looks sharper than ESPN's server-side one.
// The raw "full" asset isn't a tight headshot crop (lots of jersey/background,
// odd framing) — the combiner endpoint's scale=crop does a proper face-focused
// crop; requesting it at 350x350 (vs. the earlier 200x200) keeps that framing
// while giving the browser a much sharper source to scale down from.
const NFL_HEADSHOTS = Object.fromEntries(
  Object.entries(NFL_ESPN_ID).map(([id, espnId]) => [
    id,
    `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${espnId}.png&w=350&h=350&scale=crop`,
  ])
);

const NFL_PLAYERS = [
  { id: "dak", name: "Dak Prescott", team: "DAL", pos: "QB" },
  { id: "lamb", name: "CeeDee Lamb", team: "DAL", pos: "WR" },
  { id: "pickens", name: "George Pickens", team: "DAL", pos: "WR" },
  { id: "javonte", name: "Javonte Williams", team: "DAL", pos: "RB" },
  { id: "ferguson", name: "Jake Ferguson", team: "DAL", pos: "TE" },
  { id: "tolbert", name: "Jalen Tolbert", team: "DAL", pos: "WR" },
  { id: "dowdle", name: "Miles Sanders", team: "DAL", pos: "RB" },
  { id: "aubrey", name: "Brandon Aubrey", team: "DAL", pos: "K" },
];

// New York Giants -- the Cowboys' real Week 1 2026 opponent (Sunday Night
// Football, per the NFL's released 2026 schedule) -- added so the NFL page
// can show both teams' rosters side by side the same way the NBA page shows
// both Finals teams, rather than just a one-line "next matchup" summary.
// Real players/positions/ids; game logs are seeded synthetic data around
// realistic season-average baselines (see SYNTHETIC_NFL_STAT_BASE/
// genSyntheticNFLGames below) rather than hand-transcribed box scores, since
// there's no live NFL stats feed wired in yet -- same "sample data" caveat
// already called out for the Cowboys logs in the footer below.
const GIANTS_PLAYERS = [
  { id: "dart", name: "Jaxson Dart", team: "NYG", pos: "QB" },
  { id: "nabers", name: "Malik Nabers", team: "NYG", pos: "WR" },
  { id: "slayton", name: "Darius Slayton", team: "NYG", pos: "WR" },
  { id: "hyatt", name: "Jalin Hyatt", team: "NYG", pos: "WR" },
  { id: "skattebo", name: "Cam Skattebo", team: "NYG", pos: "RB" },
  { id: "tracy", name: "Tyrone Tracy Jr.", team: "NYG", pos: "RB" },
  { id: "theojohnson", name: "Theo Johnson", team: "NYG", pos: "TE" },
  { id: "sauls", name: "Ben Sauls", team: "NYG", pos: "K" },
];

// San Francisco 49ers -- real Week 1 2026 opponent for the Rams. Same
// treatment as the Giants above: real players/positions/ids, seeded
// synthetic game logs (see SYNTHETIC_NFL_STAT_BASE/genSyntheticNFLGames
// below) since there's no live NFL stats feed wired in yet.
const SF_PLAYERS = [
  { id: "purdy", name: "Brock Purdy", team: "SF", pos: "QB" },
  { id: "evans", name: "Mike Evans", team: "SF", pos: "WR" },
  { id: "pearsall", name: "Ricky Pearsall", team: "SF", pos: "WR" },
  { id: "cowing", name: "Jacob Cowing", team: "SF", pos: "WR" },
  { id: "mccaffrey", name: "Christian McCaffrey", team: "SF", pos: "RB" },
  { id: "guerendo", name: "Isaac Guerendo", team: "SF", pos: "RB" },
  { id: "mclachlan", name: "Tanner McLachlan", team: "SF", pos: "TE" },
  { id: "pineiro", name: "Eddy Pineiro", team: "SF", pos: "K" },
];

// Los Angeles Rams -- the 49ers' real Week 1 2026 opponent.
const RAMS_PLAYERS = [
  { id: "stafford", name: "Matthew Stafford", team: "LAR", pos: "QB" },
  { id: "nacua", name: "Puka Nacua", team: "LAR", pos: "WR" },
  { id: "adams", name: "Davante Adams", team: "LAR", pos: "WR" },
  { id: "whittington", name: "Jordan Whittington", team: "LAR", pos: "WR" },
  { id: "kyren", name: "Kyren Williams", team: "LAR", pos: "RB" },
  { id: "corum", name: "Blake Corum", team: "LAR", pos: "RB" },
  { id: "higbee", name: "Tyler Higbee", team: "LAR", pos: "TE" },
  { id: "mevis", name: "Harrison Mevis", team: "LAR", pos: "K" },
];

// Denver Broncos -- real Week 1 2026 opponent for the Chiefs on Monday
// Night Football, the marquee national-TV opener of the week.
const BRONCOS_PLAYERS = [
  { id: "nix", name: "Bo Nix", team: "DEN", pos: "QB" },
  { id: "sutton", name: "Courtland Sutton", team: "DEN", pos: "WR" },
  { id: "waddle", name: "Jaylen Waddle", team: "DEN", pos: "WR" },
  { id: "mims", name: "Marvin Mims Jr.", team: "DEN", pos: "WR" },
  { id: "jdobbins", name: "J.K. Dobbins", team: "DEN", pos: "RB" },
  { id: "harveyrj", name: "RJ Harvey", team: "DEN", pos: "RB" },
  { id: "engram", name: "Evan Engram", team: "DEN", pos: "TE" },
  { id: "lutz", name: "Wil Lutz", team: "DEN", pos: "K" },
];

// Kansas City Chiefs -- the Broncos' real Week 1 2026 opponent, hosting on
// Monday Night Football.
const CHIEFS_PLAYERS = [
  { id: "mahomes", name: "Patrick Mahomes", team: "KC", pos: "QB" },
  { id: "rice", name: "Rashee Rice", team: "KC", pos: "WR" },
  { id: "worthy", name: "Xavier Worthy", team: "KC", pos: "WR" },
  { id: "thornton", name: "Tyquan Thornton", team: "KC", pos: "WR" },
  { id: "kwalker", name: "Kenneth Walker III", team: "KC", pos: "RB" },
  { id: "bsmith", name: "Brashard Smith", team: "KC", pos: "RB" },
  { id: "kelce", name: "Travis Kelce", team: "KC", pos: "TE" },
  { id: "butker", name: "Harrison Butker", team: "KC", pos: "K" },
];

// Remaining 13 Week 1 2026 games -- same real-roster treatment as the six
// teams above, rounding the Prop Feed/NFL page out to the full 16-game slate.
const PATRIOTS_PLAYERS = [
  { id: "ne_maye", name: "Drake Maye", team: "NE", pos: "QB" },
  { id: "ne_brown", name: "A.J. Brown", team: "NE", pos: "WR" },
  { id: "ne_doubs", name: "Romeo Doubs", team: "NE", pos: "WR" },
  { id: "ne_hollins", name: "Mack Hollins", team: "NE", pos: "WR" },
  { id: "ne_stevenson", name: "Rhamondre Stevenson", team: "NE", pos: "RB" },
  { id: "ne_henderson", name: "TreVeyon Henderson", team: "NE", pos: "RB" },
  { id: "ne_henry", name: "Hunter Henry", team: "NE", pos: "TE" },
  { id: "ne_borregales", name: "Andy Borregales", team: "NE", pos: "K" },
];
const SEAHAWKS_PLAYERS = [
  { id: "sea_darnold", name: "Sam Darnold", team: "SEA", pos: "QB" },
  { id: "sea_jsn", name: "Jaxon Smith-Njigba", team: "SEA", pos: "WR" },
  { id: "sea_kupp", name: "Cooper Kupp", team: "SEA", pos: "WR" },
  { id: "sea_horton", name: "Tory Horton", team: "SEA", pos: "WR" },
  { id: "sea_charbonnet", name: "Zach Charbonnet", team: "SEA", pos: "RB" },
  { id: "sea_price", name: "Jadarian Price", team: "SEA", pos: "RB" },
  { id: "sea_barner", name: "AJ Barner", team: "SEA", pos: "TE" },
  { id: "sea_myers", name: "Jason Myers", team: "SEA", pos: "K" },
];
const BUCCANEERS_PLAYERS = [
  { id: "tb_mayfield", name: "Baker Mayfield", team: "TB", pos: "QB" },
  { id: "tb_egbuka", name: "Emeka Egbuka", team: "TB", pos: "WR" },
  { id: "tb_godwin", name: "Chris Godwin", team: "TB", pos: "WR" },
  { id: "tb_mcmillanj", name: "Jalen McMillan", team: "TB", pos: "WR" },
  { id: "tb_irving", name: "Bucky Irving", team: "TB", pos: "RB" },
  { id: "tb_gainwell", name: "Kenny Gainwell", team: "TB", pos: "RB" },
  { id: "tb_otton", name: "Cade Otton", team: "TB", pos: "TE" },
  { id: "tb_mclaughlin", name: "Chase McLaughlin", team: "TB", pos: "K" },
];
const BENGALS_PLAYERS = [
  { id: "cin_burrow", name: "Joe Burrow", team: "CIN", pos: "QB" },
  { id: "cin_chase", name: "Ja'Marr Chase", team: "CIN", pos: "WR" },
  { id: "cin_higgins", name: "Tee Higgins", team: "CIN", pos: "WR" },
  { id: "cin_iosivas", name: "Andrei Iosivas", team: "CIN", pos: "WR" },
  { id: "cin_cbrown", name: "Chase Brown", team: "CIN", pos: "RB" },
  { id: "cin_perine", name: "Samaje Perine", team: "CIN", pos: "RB" },
  { id: "cin_gesicki", name: "Mike Gesicki", team: "CIN", pos: "TE" },
  { id: "cin_mcpherson", name: "Evan McPherson", team: "CIN", pos: "K" },
];
const SAINTS_PLAYERS = [
  { id: "no_shough", name: "Tyler Shough", team: "NO", pos: "QB" },
  { id: "no_olave", name: "Chris Olave", team: "NO", pos: "WR" },
  { id: "no_lance", name: "Bryce Lance", team: "NO", pos: "WR" },
  { id: "no_tipton", name: "Mason Tipton", team: "NO", pos: "WR" },
  { id: "no_kamara", name: "Alvin Kamara", team: "NO", pos: "RB" },
  { id: "no_miller", name: "Kendre Miller", team: "NO", pos: "RB" },
  { id: "no_juwan", name: "Juwan Johnson", team: "NO", pos: "TE" },
  { id: "no_smyth", name: "Charlie Smyth", team: "NO", pos: "K" },
];
const LIONS_PLAYERS = [
  { id: "det_goff", name: "Jared Goff", team: "DET", pos: "QB" },
  { id: "det_stbrown", name: "Amon-Ra St. Brown", team: "DET", pos: "WR" },
  { id: "det_jwilliams", name: "Jameson Williams", team: "DET", pos: "WR" },
  { id: "det_teslaa", name: "Isaac TeSlaa", team: "DET", pos: "WR" },
  { id: "det_gibbs", name: "Jahmyr Gibbs", team: "DET", pos: "RB" },
  { id: "det_pacheco", name: "Isiah Pacheco", team: "DET", pos: "RB" },
  { id: "det_laporta", name: "Sam LaPorta", team: "DET", pos: "TE" },
  { id: "det_bates", name: "Jake Bates", team: "DET", pos: "K" },
];
const JETS_PLAYERS = [
  { id: "nyj_geno", name: "Geno Smith", team: "NYJ", pos: "QB" },
  { id: "nyj_wilson", name: "Garrett Wilson", team: "NYJ", pos: "WR" },
  { id: "nyj_mitchell", name: "Adonai Mitchell", team: "NYJ", pos: "WR" },
  { id: "nyj_iwilliams", name: "Isaiah Williams", team: "NYJ", pos: "WR" },
  { id: "nyj_hall", name: "Breece Hall", team: "NYJ", pos: "RB" },
  { id: "nyj_allen", name: "Braelon Allen", team: "NYJ", pos: "RB" },
  { id: "nyj_taylor", name: "Mason Taylor", team: "NYJ", pos: "TE" },
  { id: "nyj_york", name: "Cade York", team: "NYJ", pos: "K" },
];
const TITANS_PLAYERS = [
  { id: "ten_ward", name: "Cam Ward", team: "TEN", pos: "QB" },
  { id: "ten_tate", name: "Carnell Tate", team: "TEN", pos: "WR" },
  { id: "ten_ridley", name: "Calvin Ridley", team: "TEN", pos: "WR" },
  { id: "ten_osborn", name: "K.J. Osborn", team: "TEN", pos: "WR" },
  { id: "ten_pollard", name: "Tony Pollard", team: "TEN", pos: "RB" },
  { id: "ten_spears", name: "Tyjae Spears", team: "TEN", pos: "RB" },
  { id: "ten_helm", name: "Gunnar Helm", team: "TEN", pos: "TE" },
  { id: "ten_slye", name: "Joey Slye", team: "TEN", pos: "K" },
];
const RAVENS_PLAYERS = [
  { id: "bal_ljackson", name: "Lamar Jackson", team: "BAL", pos: "QB" },
  { id: "bal_flowers", name: "Zay Flowers", team: "BAL", pos: "WR" },
  { id: "bal_bateman", name: "Rashod Bateman", team: "BAL", pos: "WR" },
  { id: "bal_moore", name: "Chris Moore", team: "BAL", pos: "WR" },
  { id: "bal_henry", name: "Derrick Henry", team: "BAL", pos: "RB" },
  { id: "bal_hill", name: "Justice Hill", team: "BAL", pos: "RB" },
  { id: "bal_andrews", name: "Mark Andrews", team: "BAL", pos: "TE" },
  { id: "bal_loop", name: "Tyler Loop", team: "BAL", pos: "K" },
];
const COLTS_PLAYERS = [
  { id: "ind_djones", name: "Daniel Jones", team: "IND", pos: "QB" },
  { id: "ind_pierce", name: "Alec Pierce", team: "IND", pos: "WR" },
  { id: "ind_downs", name: "Josh Downs", team: "IND", pos: "WR" },
  { id: "ind_dulin", name: "Ashton Dulin", team: "IND", pos: "WR" },
  { id: "ind_taylor", name: "Jonathan Taylor", team: "IND", pos: "RB" },
  { id: "ind_giddens", name: "DJ Giddens", team: "IND", pos: "RB" },
  { id: "ind_warren", name: "Tyler Warren", team: "IND", pos: "TE" },
  { id: "ind_shrader", name: "Spencer Shrader", team: "IND", pos: "K" },
];
const FALCONS_PLAYERS = [
  { id: "atl_tua", name: "Tua Tagovailoa", team: "ATL", pos: "QB" },
  { id: "atl_london", name: "Drake London", team: "ATL", pos: "WR" },
  { id: "atl_dotson", name: "Jahan Dotson", team: "ATL", pos: "WR" },
  { id: "atl_zaccheaus", name: "Olamide Zaccheaus", team: "ATL", pos: "WR" },
  { id: "atl_bijan", name: "Bijan Robinson", team: "ATL", pos: "RB" },
  { id: "atl_brobinson", name: "Brian Robinson Jr.", team: "ATL", pos: "RB" },
  { id: "atl_pitts", name: "Kyle Pitts Sr.", team: "ATL", pos: "TE" },
  { id: "atl_romo", name: "Parker Romo", team: "ATL", pos: "K" },
];
const STEELERS_PLAYERS = [
  { id: "pit_rodgers", name: "Aaron Rodgers", team: "PIT", pos: "QB" },
  { id: "pit_metcalf", name: "DK Metcalf", team: "PIT", pos: "WR" },
  { id: "pit_pittman", name: "Michael Pittman Jr.", team: "PIT", pos: "WR" },
  { id: "pit_bernard", name: "Germie Bernard", team: "PIT", pos: "WR" },
  { id: "pit_warren", name: "Jaylen Warren", team: "PIT", pos: "RB" },
  { id: "pit_dowdle", name: "Rico Dowdle", team: "PIT", pos: "RB" },
  { id: "pit_freiermuth", name: "Pat Freiermuth", team: "PIT", pos: "TE" },
  { id: "pit_boswell", name: "Chris Boswell", team: "PIT", pos: "K" },
];
const BEARS_PLAYERS = [
  { id: "chi_cwilliams", name: "Caleb Williams", team: "CHI", pos: "QB" },
  { id: "chi_odunze", name: "Rome Odunze", team: "CHI", pos: "WR" },
  { id: "chi_burden", name: "Luther Burden III", team: "CHI", pos: "WR" },
  { id: "chi_raymond", name: "Kalif Raymond", team: "CHI", pos: "WR" },
  { id: "chi_swift", name: "D'Andre Swift", team: "CHI", pos: "RB" },
  { id: "chi_monangai", name: "Kyle Monangai", team: "CHI", pos: "RB" },
  { id: "chi_kmet", name: "Cole Kmet", team: "CHI", pos: "TE" },
  { id: "chi_santos", name: "Cairo Santos", team: "CHI", pos: "K" },
];
const PANTHERS_PLAYERS = [
  { id: "car_byoung", name: "Bryce Young", team: "CAR", pos: "QB" },
  { id: "car_mcmillant", name: "Tetairoa McMillan", team: "CAR", pos: "WR" },
  { id: "car_legette", name: "Xavier Legette", team: "CAR", pos: "WR" },
  { id: "car_coker", name: "Jalen Coker", team: "CAR", pos: "WR" },
  { id: "car_hubbard", name: "Chuba Hubbard", team: "CAR", pos: "RB" },
  { id: "car_brooks", name: "Jonathon Brooks", team: "CAR", pos: "RB" },
  { id: "car_tremble", name: "Tommy Tremble", team: "CAR", pos: "TE" },
  { id: "car_fitzgerald", name: "Ryan Fitzgerald", team: "CAR", pos: "K" },
];
const BROWNS_PLAYERS = [
  { id: "cle_watson", name: "Deshaun Watson", team: "CLE", pos: "QB" },
  { id: "cle_jeudy", name: "Jerry Jeudy", team: "CLE", pos: "WR" },
  { id: "cle_tillman", name: "Cedric Tillman", team: "CLE", pos: "WR" },
  { id: "cle_corley", name: "Malachi Corley", team: "CLE", pos: "WR" },
  { id: "cle_judkins", name: "Quinshon Judkins", team: "CLE", pos: "RB" },
  { id: "cle_sampson", name: "Dylan Sampson", team: "CLE", pos: "RB" },
  { id: "cle_fannin", name: "Harold Fannin Jr.", team: "CLE", pos: "TE" },
  { id: "cle_szmyt", name: "Andre Szmyt", team: "CLE", pos: "K" },
];
const JAGUARS_PLAYERS = [
  { id: "jax_lawrence", name: "Trevor Lawrence", team: "JAX", pos: "QB" },
  { id: "jax_thomasjr", name: "Brian Thomas Jr.", team: "JAX", pos: "WR" },
  { id: "jax_meyers", name: "Jakobi Meyers", team: "JAX", pos: "WR" },
  { id: "jax_pwashington", name: "Parker Washington", team: "JAX", pos: "WR" },
  { id: "jax_etienne", name: "Travis Etienne Jr.", team: "JAX", pos: "RB" },
  { id: "jax_tuten", name: "Bhayshul Tuten", team: "JAX", pos: "RB" },
  { id: "jax_strange", name: "Brenton Strange", team: "JAX", pos: "TE" },
  { id: "jax_little", name: "Cam Little", team: "JAX", pos: "K" },
];
const BILLS_PLAYERS = [
  { id: "buf_allen", name: "Josh Allen", team: "BUF", pos: "QB" },
  { id: "buf_moore", name: "DJ Moore", team: "BUF", pos: "WR" },
  { id: "buf_coleman", name: "Keon Coleman", team: "BUF", pos: "WR" },
  { id: "buf_shavers", name: "Tyrell Shavers", team: "BUF", pos: "WR" },
  { id: "buf_cook", name: "James Cook III", team: "BUF", pos: "RB" },
  { id: "buf_davis", name: "Ray Davis", team: "BUF", pos: "RB" },
  { id: "buf_kincaid", name: "Dalton Kincaid", team: "BUF", pos: "TE" },
  { id: "buf_bass", name: "Tyler Bass", team: "BUF", pos: "K" },
];
const TEXANS_PLAYERS = [
  { id: "hou_stroud", name: "C.J. Stroud", team: "HOU", pos: "QB" },
  { id: "hou_collins", name: "Nico Collins", team: "HOU", pos: "WR" },
  { id: "hou_dell", name: "Tank Dell", team: "HOU", pos: "WR" },
  { id: "hou_hutchinson", name: "Xavier Hutchinson", team: "HOU", pos: "WR" },
  { id: "hou_montgomery", name: "David Montgomery", team: "HOU", pos: "RB" },
  { id: "hou_marks", name: "Woody Marks", team: "HOU", pos: "RB" },
  { id: "hou_schultz", name: "Dalton Schultz", team: "HOU", pos: "TE" },
  { id: "hou_fairbairn", name: "Ka'imi Fairbairn", team: "HOU", pos: "K" },
];
const DOLPHINS_PLAYERS = [
  { id: "mia_willis", name: "Malik Willis", team: "MIA", pos: "QB" },
  { id: "mia_waddle", name: "Jaylen Waddle", team: "MIA", pos: "WR" },
  { id: "mia_mwashington", name: "Malik Washington", team: "MIA", pos: "WR" },
  { id: "mia_marshall", name: "Terrace Marshall Jr.", team: "MIA", pos: "WR" },
  { id: "mia_achane", name: "De'Von Achane", team: "MIA", pos: "RB" },
  { id: "mia_wright", name: "Jaylen Wright", team: "MIA", pos: "RB" },
  { id: "mia_dulcich", name: "Greg Dulcich", team: "MIA", pos: "TE" },
  { id: "mia_patterson", name: "Riley Patterson", team: "MIA", pos: "K" },
];
const RAIDERS_PLAYERS = [
  { id: "lv_cousins", name: "Kirk Cousins", team: "LV", pos: "QB" },
  { id: "lv_tucker", name: "Tre Tucker", team: "LV", pos: "WR" },
  { id: "lv_thornton", name: "Dont'e Thornton Jr.", team: "LV", pos: "WR" },
  { id: "lv_sjackson", name: "Shedrick Jackson", team: "LV", pos: "WR" },
  { id: "lv_jeanty", name: "Ashton Jeanty", team: "LV", pos: "RB" },
  { id: "lv_mwashington", name: "Mike Washington Jr.", team: "LV", pos: "RB" },
  { id: "lv_bowers", name: "Brock Bowers", team: "LV", pos: "TE" },
  { id: "lv_gay", name: "Matt Gay", team: "LV", pos: "K" },
];
const PACKERS_PLAYERS = [
  { id: "gb_love", name: "Jordan Love", team: "GB", pos: "QB" },
  { id: "gb_watson", name: "Christian Watson", team: "GB", pos: "WR" },
  { id: "gb_reed", name: "Jayden Reed", team: "GB", pos: "WR" },
  { id: "gb_melton", name: "Bo Melton", team: "GB", pos: "WR" },
  { id: "gb_jacobs", name: "Josh Jacobs", team: "GB", pos: "RB" },
  { id: "gb_lloyd", name: "MarShawn Lloyd", team: "GB", pos: "RB" },
  { id: "gb_kraft", name: "Tucker Kraft", team: "GB", pos: "TE" },
  { id: "gb_smack", name: "Trey Smack", team: "GB", pos: "K" },
];
const VIKINGS_PLAYERS = [
  { id: "min_murray", name: "Kyler Murray", team: "MIN", pos: "QB" },
  { id: "min_jefferson", name: "Justin Jefferson", team: "MIN", pos: "WR" },
  { id: "min_addison", name: "Jordan Addison", team: "MIN", pos: "WR" },
  { id: "min_jennings", name: "Jauan Jennings", team: "MIN", pos: "WR" },
  { id: "min_ajones", name: "Aaron Jones Sr.", team: "MIN", pos: "RB" },
  { id: "min_mason", name: "Jordan Mason", team: "MIN", pos: "RB" },
  { id: "min_hockenson", name: "T.J. Hockenson", team: "MIN", pos: "TE" },
  { id: "min_reichard", name: "Will Reichard", team: "MIN", pos: "K" },
];
const COMMANDERS_PLAYERS = [
  { id: "was_daniels", name: "Jayden Daniels", team: "WAS", pos: "QB" },
  { id: "was_mclaurin", name: "Terry McLaurin", team: "WAS", pos: "WR" },
  { id: "was_samuel", name: "Deebo Samuel", team: "WAS", pos: "WR" },
  { id: "was_nbrown", name: "Noah Brown", team: "WAS", pos: "WR" },
  { id: "was_croskeymerritt", name: "Jacory Croskey-Merritt", team: "WAS", pos: "RB" },
  { id: "was_white", name: "Rachaad White", team: "WAS", pos: "RB" },
  { id: "was_okonkwo", name: "Chig Okonkwo", team: "WAS", pos: "TE" },
  { id: "was_stevens", name: "Drew Stevens", team: "WAS", pos: "K" },
];
const EAGLES_PLAYERS = [
  { id: "phi_hurts", name: "Jalen Hurts", team: "PHI", pos: "QB" },
  { id: "phi_dsmith", name: "DeVonta Smith", team: "PHI", pos: "WR" },
  { id: "phi_hbrown", name: "Hollywood Brown", team: "PHI", pos: "WR" },
  { id: "phi_cooper", name: "Darius Cooper", team: "PHI", pos: "WR" },
  { id: "phi_barkley", name: "Saquon Barkley", team: "PHI", pos: "RB" },
  { id: "phi_bigsby", name: "Tank Bigsby", team: "PHI", pos: "RB" },
  { id: "phi_goedert", name: "Dallas Goedert", team: "PHI", pos: "TE" },
  { id: "phi_elliott", name: "Jake Elliott", team: "PHI", pos: "K" },
];
const NFL_CARDINALS_PLAYERS = [
  { id: "ari_brissett", name: "Jacoby Brissett", team: "ARI", pos: "QB" },
  { id: "ari_harrisonjr", name: "Marvin Harrison Jr.", team: "ARI", pos: "WR" },
  { id: "ari_weaver", name: "Xavier Weaver", team: "ARI", pos: "WR" },
  { id: "ari_fehoko", name: "Simi Fehoko", team: "ARI", pos: "WR" },
  { id: "ari_love", name: "Jeremiyah Love", team: "ARI", pos: "RB" },
  { id: "ari_allgeier", name: "Tyler Allgeier", team: "ARI", pos: "RB" },
  { id: "ari_mcbride", name: "Trey McBride", team: "ARI", pos: "TE" },
  { id: "ari_ryland", name: "Chad Ryland", team: "ARI", pos: "K" },
];
const CHARGERS_PLAYERS = [
  { id: "lac_herbert", name: "Justin Herbert", team: "LAC", pos: "QB" },
  { id: "lac_mcconkey", name: "Ladd McConkey", team: "LAC", pos: "WR" },
  { id: "lac_johnston", name: "Quentin Johnston", team: "LAC", pos: "WR" },
  { id: "lac_lambertsmith", name: "KeAndre Lambert-Smith", team: "LAC", pos: "WR" },
  { id: "lac_hampton", name: "Omarion Hampton", team: "LAC", pos: "RB" },
  { id: "lac_vidal", name: "Kimani Vidal", team: "LAC", pos: "RB" },
  { id: "lac_gadsden", name: "Oronde Gadsden II", team: "LAC", pos: "TE" },
  { id: "lac_dicker", name: "Cameron Dicker", team: "LAC", pos: "K" },
];

const ALL_NFL_PLAYERS = [
  ...NFL_PLAYERS, ...GIANTS_PLAYERS, ...SF_PLAYERS, ...RAMS_PLAYERS,
  ...BRONCOS_PLAYERS, ...CHIEFS_PLAYERS,
  ...PATRIOTS_PLAYERS, ...SEAHAWKS_PLAYERS, ...BUCCANEERS_PLAYERS, ...BENGALS_PLAYERS,
  ...SAINTS_PLAYERS, ...LIONS_PLAYERS, ...JETS_PLAYERS, ...TITANS_PLAYERS,
  ...RAVENS_PLAYERS, ...COLTS_PLAYERS, ...FALCONS_PLAYERS, ...STEELERS_PLAYERS,
  ...BEARS_PLAYERS, ...PANTHERS_PLAYERS, ...BROWNS_PLAYERS, ...JAGUARS_PLAYERS,
  ...BILLS_PLAYERS, ...TEXANS_PLAYERS, ...DOLPHINS_PLAYERS, ...RAIDERS_PLAYERS,
  ...PACKERS_PLAYERS, ...VIKINGS_PLAYERS, ...COMMANDERS_PLAYERS, ...EAGLES_PLAYERS,
  ...NFL_CARDINALS_PLAYERS, ...CHARGERS_PLAYERS,
];

// Each entry is one week's matchup the Prop Ledger can scout -- the "matchup
// selector" dropdown on the NFL page switches between these, swapping which
// two rosters populate the left/right sidebars. More weeks/games get added
// here over time; for now it's just the two real Week 1 2026 games modeled.
const NFL_MATCHUPS = [
  {
    id: "dal-nyg",
    label: "Cowboys @ Giants",
    teamA: { label: "Dallas Cowboys", players: NFL_PLAYERS },
    teamB: { label: "New York Giants", players: GIANTS_PLAYERS },
    date: "2026-09-14T00:20:00Z",
    venue: "MetLife Stadium",
    city: "East Rutherford, NJ",
  },
  {
    id: "sf-lar",
    label: "49ers @ Rams",
    teamA: { label: "San Francisco 49ers", players: SF_PLAYERS },
    teamB: { label: "Los Angeles Rams", players: RAMS_PLAYERS },
    // Real 2026 schedule quirk -- this is the Rams' "home" game, but the NFL
    // played it at Melbourne Cricket Ground as part of its international
    // series, not at SoFi Stadium.
    date: "2026-09-11T00:35:00Z",
    venue: "Melbourne Cricket Ground",
    city: "Melbourne, Australia",
  },
  {
    id: "den-kc",
    label: "Broncos @ Chiefs",
    teamA: { label: "Denver Broncos", players: BRONCOS_PLAYERS },
    teamB: { label: "Kansas City Chiefs", players: CHIEFS_PLAYERS },
    // Week 1's Monday Night Football opener -- the marquee national-TV slot,
    // per the NFL's released 2026 schedule.
    date: "2026-09-15T00:15:00Z",
    venue: "GEHA Field at Arrowhead Stadium",
    city: "Kansas City, MO",
  },
  {
    id: "ne-sea",
    label: "Patriots @ Seahawks",
    teamA: { label: "New England Patriots", players: PATRIOTS_PLAYERS },
    teamB: { label: "Seattle Seahawks", players: SEAHAWKS_PLAYERS },
    // Week 1's Wednesday-night opener (NBC), per the NFL's released 2026
    // schedule -- the league's first-ever Wednesday season opener.
    date: "2026-09-10T00:20:00Z",
    venue: "Lumen Field",
    city: "Seattle, WA",
  },
  {
    id: "tb-cin",
    label: "Buccaneers @ Bengals",
    teamA: { label: "Tampa Bay Buccaneers", players: BUCCANEERS_PLAYERS },
    teamB: { label: "Cincinnati Bengals", players: BENGALS_PLAYERS },
    date: "2026-09-13T17:00:00Z",
    venue: "Paycor Stadium",
    city: "Cincinnati, OH",
  },
  {
    id: "no-det",
    label: "Saints @ Lions",
    teamA: { label: "New Orleans Saints", players: SAINTS_PLAYERS },
    teamB: { label: "Detroit Lions", players: LIONS_PLAYERS },
    date: "2026-09-13T17:00:00Z",
    venue: "Ford Field",
    city: "Detroit, MI",
  },
  {
    id: "nyj-ten",
    label: "Jets @ Titans",
    teamA: { label: "New York Jets", players: JETS_PLAYERS },
    teamB: { label: "Tennessee Titans", players: TITANS_PLAYERS },
    date: "2026-09-13T17:00:00Z",
    venue: "Nissan Stadium",
    city: "Nashville, TN",
  },
  {
    id: "bal-ind",
    label: "Ravens @ Colts",
    teamA: { label: "Baltimore Ravens", players: RAVENS_PLAYERS },
    teamB: { label: "Indianapolis Colts", players: COLTS_PLAYERS },
    date: "2026-09-13T17:00:00Z",
    venue: "Lucas Oil Stadium",
    city: "Indianapolis, IN",
  },
  {
    id: "atl-pit",
    label: "Falcons @ Steelers",
    teamA: { label: "Atlanta Falcons", players: FALCONS_PLAYERS },
    teamB: { label: "Pittsburgh Steelers", players: STEELERS_PLAYERS },
    date: "2026-09-13T17:00:00Z",
    venue: "Acrisure Stadium",
    city: "Pittsburgh, PA",
  },
  {
    id: "chi-car",
    label: "Bears @ Panthers",
    teamA: { label: "Chicago Bears", players: BEARS_PLAYERS },
    teamB: { label: "Carolina Panthers", players: PANTHERS_PLAYERS },
    date: "2026-09-13T17:00:00Z",
    venue: "Bank of America Stadium",
    city: "Charlotte, NC",
  },
  {
    id: "cle-jax",
    label: "Browns @ Jaguars",
    teamA: { label: "Cleveland Browns", players: BROWNS_PLAYERS },
    teamB: { label: "Jacksonville Jaguars", players: JAGUARS_PLAYERS },
    date: "2026-09-13T17:00:00Z",
    venue: "EverBank Stadium",
    city: "Jacksonville, FL",
  },
  {
    id: "buf-hou",
    label: "Bills @ Texans",
    teamA: { label: "Buffalo Bills", players: BILLS_PLAYERS },
    teamB: { label: "Houston Texans", players: TEXANS_PLAYERS },
    date: "2026-09-13T17:00:00Z",
    venue: "NRG Stadium",
    city: "Houston, TX",
  },
  {
    id: "mia-lv",
    label: "Dolphins @ Raiders",
    teamA: { label: "Miami Dolphins", players: DOLPHINS_PLAYERS },
    teamB: { label: "Las Vegas Raiders", players: RAIDERS_PLAYERS },
    date: "2026-09-13T20:05:00Z",
    venue: "Allegiant Stadium",
    city: "Las Vegas, NV",
  },
  {
    id: "gb-min",
    label: "Packers @ Vikings",
    teamA: { label: "Green Bay Packers", players: PACKERS_PLAYERS },
    teamB: { label: "Minnesota Vikings", players: VIKINGS_PLAYERS },
    date: "2026-09-13T17:00:00Z",
    venue: "U.S. Bank Stadium",
    city: "Minneapolis, MN",
  },
  {
    id: "was-phi",
    label: "Commanders @ Eagles",
    teamA: { label: "Washington Commanders", players: COMMANDERS_PLAYERS },
    teamB: { label: "Philadelphia Eagles", players: EAGLES_PLAYERS },
    date: "2026-09-13T17:00:00Z",
    venue: "Lincoln Financial Field",
    city: "Philadelphia, PA",
  },
  {
    id: "ari-lac",
    label: "Cardinals @ Chargers",
    teamA: { label: "Arizona Cardinals", players: NFL_CARDINALS_PLAYERS },
    teamB: { label: "Los Angeles Chargers", players: CHARGERS_PLAYERS },
    date: "2026-09-13T20:25:00Z",
    venue: "SoFi Stadium",
    city: "Inglewood, CA",
  },
];
const NFL_MATCHUPS_BY_DATE = groupMatchupsByDate(NFL_MATCHUPS);
// Flat team -> {label, players} lookup built from NFL_MATCHUPS' two sides,
// so any of the 32 real rosters can be selected directly by team instead of
// only ever appearing paired into one fixed Week 1 matchup.
const NFL_TEAM_ROSTERS = {};
NFL_MATCHUPS.forEach((m) => {
  NFL_TEAM_ROSTERS[m.teamA.players[0].team] = m.teamA;
  NFL_TEAM_ROSTERS[m.teamB.players[0].team] = m.teamB;
});
// ESPN's schedule endpoint takes each team's slug in the URL -- identical to
// our own abbreviations lowercased, except Washington (we use "WAS", ESPN's
// URL slug and response abbreviation are both "WSH").
function nflEspnSlug(abbr) {
  return abbr === "WAS" ? "wsh" : abbr.toLowerCase();
}
function nflOurAbbr(espnAbbr) {
  return espnAbbr === "WSH" ? "WAS" : espnAbbr;
}

const NFL_SCHEDULE_TTL_MS = 60 * 60 * 1000;
const nflScheduleCache = new Map();

// Each team's actual next/current-week scheduled opponent, pulled live from
// ESPN's real season schedule -- replaces the old fixed Week 1 mock pairing
// so the page always reflects whichever week is actually live, rolling
// forward on its own once that week's games finish (no separate "refresh
// every Tuesday" job needed -- the schedule itself is the source of truth,
// refetched live on a TTL same as the MLB schedule lookup).
async function fetchNFLTeamNextGame(abbr) {
  const cached = nflScheduleCache.get(abbr);
  if (cached && Date.now() - cached.fetchedAt < NFL_SCHEDULE_TTL_MS) {
    return cached.game;
  }
  const cacheKey = `nfl_next_game_${abbr}_v1`;
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Date.now() - parsed.fetchedAt < NFL_SCHEDULE_TTL_MS) {
        nflScheduleCache.set(abbr, parsed);
        return parsed.game;
      }
    }
  } catch {}

  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${nflEspnSlug(abbr)}/schedule?season=2026`
  );
  const data = await res.json();
  const events = data?.events || [];
  const upcoming =
    events.find((e) => e.competitions?.[0]?.status?.type?.completed === false) ||
    events[events.length - 1] ||
    null;

  let game = null;
  if (upcoming) {
    const comp = upcoming.competitions?.[0];
    const espnAbbr = nflEspnSlug(abbr).toUpperCase() === "WSH" ? "WSH" : abbr;
    const us = comp?.competitors?.find((c) => c.team?.abbreviation === espnAbbr);
    const oppComp = comp?.competitors?.find((c) => c !== us);
    if (us && oppComp) {
      game = {
        date: upcoming.date,
        opp: nflOurAbbr(oppComp.team?.abbreviation),
        home: us.homeAway === "home",
        venue: comp.venue?.fullName || "",
        status: comp.status?.type?.description || "Scheduled",
        week: upcoming.week?.number,
      };
    }
  }

  const record = { game, fetchedAt: Date.now() };
  nflScheduleCache.set(abbr, record);
  try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
  return game;
}

const NFL_SLATE_TTL_MS = 60 * 60 * 1000;
let nflSlateCache = null;

// Every real NFL game in the current week, one fetch for the whole league --
// this is what lets the Prop Feed's MATCHUP dropdown show only that week's
// games, sorted by kickoff. "Current week" is determined by asking any one
// team's own schedule which of their games hasn't finished yet (same check
// fetchNFLTeamNextGame uses), rather than guessing at the Tuesday-to-Tuesday
// rollover from a hardcoded date -- that delegates the judgment call
// entirely to ESPN's own completed-game tracking, so it advances correctly
// once each week's Monday (or international-game) finale finishes.
async function fetchNFLWeekSlate() {
  if (nflSlateCache && Date.now() - nflSlateCache.fetchedAt < NFL_SLATE_TTL_MS) {
    return nflSlateCache.games;
  }
  const cacheKey = "nfl_week_slate_v1";
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Date.now() - parsed.fetchedAt < NFL_SLATE_TTL_MS) {
        nflSlateCache = parsed;
        return parsed.games;
      }
    }
  } catch {}

  const anchorGame = await fetchNFLTeamNextGame(NFL_PLAYERS[0].team);
  const weekNumber = anchorGame?.week || 1;

  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${weekNumber}&dates=2026`
  );
  const data = await res.json();
  const games = (data?.events || [])
    .map((e) => {
      const comp = e.competitions?.[0];
      const away = comp?.competitors?.find((c) => c.homeAway === "away");
      const home = comp?.competitors?.find((c) => c.homeAway === "home");
      return {
        date: e.date,
        status: comp?.status?.type?.description || "Scheduled",
        awayAbbr: nflOurAbbr(away?.team?.abbreviation),
        homeAbbr: nflOurAbbr(home?.team?.abbreviation),
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const record = { weekNumber, games, fetchedAt: Date.now() };
  nflSlateCache = record;
  try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
  return games;
}

// pos: which positions can bet this market. binary markets get a fixed 0.5 threshold.
const NFL_MARKETS = [
  { id: "passYds", label: "Pass Yds", pos: ["QB"] },
  { id: "passTd", label: "Pass TD", pos: ["QB"] },
  { id: "passAtt", label: "Pass Attempts", pos: ["QB"] },
  { id: "comp", label: "Completions", pos: ["QB"] },
  { id: "int", label: "INT", pos: ["QB"] },
  { id: "rushYds", label: "Rush Yds", pos: ["QB", "RB"] },
  { id: "passRushYds", label: "Pass + Rush Yds", pos: ["QB"] },
  { id: "rushAtt", label: "Rush Att", pos: ["RB"] },
  { id: "rec", label: "Receptions", pos: ["RB", "WR", "TE"] },
  { id: "recYds", label: "Rec Yds", pos: ["RB", "WR", "TE"] },
  { id: "longRec", label: "Longest Reception", pos: ["WR"] },
  { id: "scrim", label: "Rush + Rec Yds", pos: ["RB", "WR"] },
  { id: "anytimeTd", label: "Anytime TD", pos: ["QB", "RB", "WR", "TE"] },
  { id: "fgm", label: "FG Made", pos: ["K"] },
  { id: "fga", label: "FG Attempts", pos: ["K"] },
  { id: "xpm", label: "XP Made", pos: ["K"] },
  { id: "kickPts", label: "Kicking Points", pos: ["K"] },
];
// Groups NFL_MARKETS into the same "section header + tab row" layout the NBA
// page uses (Core/Combos/etc.) instead of one flat "Markets" list -- each
// group's `ids` gets filtered down to whatever's applicable to the selected
// player's position at render time, and empty groups (e.g. Kicking for a QB)
// are skipped by MarketSectionGrid.
const NFL_MARKET_SECTIONS = [
  { label: "Passing", ids: ["passYds", "comp", "passAtt", "passTd", "int"] },
  { label: "Rushing", ids: ["rushYds", "rushAtt"] },
  { label: "Receiving", ids: ["rec", "recYds", "longRec"] },
  { label: "Combos", ids: ["passRushYds", "scrim"] },
  { label: "Milestones", ids: ["anytimeTd"], pills: true },
  { label: "Kicking", ids: ["fgm", "fga", "xpm", "kickPts"] },
];

// Position-appropriate stat set for the player snapshot card — a QB's
// season-at-a-glance looks nothing like a kicker's, so each position gets
// its own small, relevant set rather than one generic stat line.
const NFL_SNAPSHOT_STATS = {
  QB: [
    { label: "PASS YDS", key: "passYds", decimals: 1 },
    { label: "PASS TD", key: "passTd", decimals: 1 },
    { label: "COMP", key: "comp", decimals: 1 },
    { label: "INT", key: "int", decimals: 1 },
  ],
  RB: [
    { label: "RUSH YDS", key: "rushYds", decimals: 1 },
    { label: "RUSH ATT", key: "rushAtt", decimals: 1 },
    { label: "REC", key: "rec", decimals: 1 },
    { label: "TD", key: "anytimeTd", decimals: 2 },
  ],
  WR: [
    { label: "REC", key: "rec", decimals: 1 },
    { label: "REC YDS", key: "recYds", decimals: 1 },
    { label: "TD", key: "anytimeTd", decimals: 2 },
  ],
  TE: [
    { label: "REC", key: "rec", decimals: 1 },
    { label: "REC YDS", key: "recYds", decimals: 1 },
    { label: "TD", key: "anytimeTd", decimals: 2 },
  ],
  K: [
    { label: "FG MADE", key: "fgm", decimals: 1 },
    { label: "XP MADE", key: "xpm", decimals: 1 },
    { label: "KICK PTS", key: "kickPts", decimals: 1 },
  ],
};
// QB has 4 snapshot stats, every other position has 3 -- the card always
// reserves this many column slots (see the snapshot grid below) so
// switching between a QB and any other position doesn't change the card's
// width and shift the photo/selector next to it.
const NFL_SNAPSHOT_MAX_STATS = Math.max(...Object.values(NFL_SNAPSHOT_STATS).map((s) => s.length));

// Real 2025 Dallas Cowboys regular-season game logs (Week 1 through each
// player's final game), sourced from ESPN/CBS Sports box scores. Official
// snap counts aren't part of these box scores, so each game's snap % (shown
// in the "Snap %" column and filter) is estimated from the player's role —
// see SNAP_PROFILE / estimateSnapPct below.
const NFL_GAME_LOGS = {
  dak: [
    { date: "2025-09-04", opp: "PHI", home: false, comp: 21, att: 34, passYds: 188, passTd: 0, int: 0, rushAtt: 1, rushYds: 3, rushTd: 0 },
    { date: "2025-09-14", opp: "NYG", home: true, comp: 38, att: 52, passYds: 361, passTd: 2, int: 1, rushAtt: 3, rushYds: 17, rushTd: 0 },
    { date: "2025-09-21", opp: "CHI", home: false, comp: 31, att: 40, passYds: 251, passTd: 1, int: 2, rushAtt: 0, rushYds: 0, rushTd: 0 },
    { date: "2025-09-28", opp: "GB", home: true, comp: 31, att: 40, passYds: 319, passTd: 3, int: 0, rushAtt: 1, rushYds: 2, rushTd: 1 },
    { date: "2025-10-05", opp: "NYJ", home: false, comp: 18, att: 29, passYds: 237, passTd: 4, int: 0, rushAtt: 7, rushYds: 28, rushTd: 0 },
    { date: "2025-10-12", opp: "CAR", home: false, comp: 25, att: 34, passYds: 261, passTd: 3, int: 0, rushAtt: 2, rushYds: -1, rushTd: 0 },
    { date: "2025-10-19", opp: "WAS", home: true, comp: 21, att: 30, passYds: 264, passTd: 3, int: 0, rushAtt: 5, rushYds: 7, rushTd: 0 },
    { date: "2025-10-26", opp: "DEN", home: false, comp: 19, att: 31, passYds: 188, passTd: 0, int: 2, rushAtt: 6, rushYds: 31, rushTd: 0 },
    { date: "2025-11-03", opp: "ARI", home: true, comp: 24, att: 39, passYds: 250, passTd: 1, int: 1, rushAtt: 4, rushYds: 34, rushTd: 0 },
    { date: "2025-11-17", opp: "LV", home: false, comp: 25, att: 33, passYds: 268, passTd: 4, int: 0, rushAtt: 4, rushYds: -4, rushTd: 0 },
    { date: "2025-11-23", opp: "PHI", home: true, comp: 23, att: 36, passYds: 354, passTd: 2, int: 1, rushAtt: 5, rushYds: 9, rushTd: 1 },
    { date: "2025-11-27", opp: "KC", home: true, comp: 27, att: 39, passYds: 320, passTd: 2, int: 1, rushAtt: 3, rushYds: -2, rushTd: 0 },
    { date: "2025-12-04", opp: "DET", home: false, comp: 31, att: 47, passYds: 376, passTd: 1, int: 2, rushAtt: 3, rushYds: 14, rushTd: 0 },
    { date: "2025-12-14", opp: "MIN", home: true, comp: 23, att: 38, passYds: 294, passTd: 0, int: 0, rushAtt: 1, rushYds: 2, rushTd: 0 },
    { date: "2025-12-21", opp: "LAC", home: true, comp: 21, att: 30, passYds: 244, passTd: 2, int: 0, rushAtt: 2, rushYds: 14, rushTd: 0 },
    { date: "2025-12-25", opp: "WAS", home: false, comp: 19, att: 37, passYds: 307, passTd: 2, int: 0, rushAtt: 4, rushYds: 24, rushTd: 0 },
    { date: "2026-01-04", opp: "NYG", home: false, comp: 7, att: 11, passYds: 70, passTd: 0, int: 0, rushAtt: 2, rushYds: -1, rushTd: 0 },
  ],
  lamb: [
    { date: "2025-09-04", opp: "PHI", home: false, rec: 7, tgt: 13, recYds: 110, recTd: 0 },
    { date: "2025-09-14", opp: "NYG", home: true, rec: 9, tgt: 11, recYds: 112, recTd: 0 },
    { date: "2025-09-21", opp: "CHI", home: false, rec: 0, tgt: 0, recYds: 0, recTd: 0 },
    { date: "2025-10-19", opp: "WAS", home: true, rec: 5, tgt: 8, recYds: 110, recTd: 1 },
    { date: "2025-10-26", opp: "DEN", home: false, rec: 7, tgt: 10, recYds: 74, recTd: 0 },
    { date: "2025-11-03", opp: "ARI", home: true, rec: 7, tgt: 12, recYds: 85, recTd: 0 },
    { date: "2025-11-17", opp: "LV", home: false, rec: 5, tgt: 7, recYds: 66, recTd: 1 },
    { date: "2025-11-23", opp: "PHI", home: true, rec: 4, tgt: 11, recYds: 75, recTd: 0 },
    { date: "2025-11-27", opp: "KC", home: true, rec: 7, tgt: 9, recYds: 112, recTd: 1 },
    { date: "2025-12-04", opp: "DET", home: false, rec: 6, tgt: 8, recYds: 121, recTd: 0 },
    { date: "2025-12-14", opp: "MIN", home: true, rec: 6, tgt: 10, recYds: 111, recTd: 0 },
    { date: "2025-12-21", opp: "LAC", home: true, rec: 6, tgt: 7, recYds: 51, recTd: 0 },
    { date: "2025-12-25", opp: "WAS", home: false, rec: 5, tgt: 10, recYds: 46, recTd: 0 },
    { date: "2026-01-04", opp: "NYG", home: false, rec: 1, tgt: 1, recYds: 4, recTd: 0 },
  ],
  pickens: [
    { date: "2025-09-04", opp: "PHI", home: false, rec: 3, tgt: 4, recYds: 30, recTd: 0 },
    { date: "2025-09-14", opp: "NYG", home: true, rec: 5, tgt: 9, recYds: 68, recTd: 1 },
    { date: "2025-09-21", opp: "CHI", home: false, rec: 5, tgt: 9, recYds: 68, recTd: 1 },
    { date: "2025-09-28", opp: "GB", home: true, rec: 8, tgt: 11, recYds: 134, recTd: 2 },
    { date: "2025-10-05", opp: "NYJ", home: false, rec: 2, tgt: 4, recYds: 57, recTd: 1 },
    { date: "2025-10-12", opp: "CAR", home: false, rec: 9, tgt: 11, recYds: 168, recTd: 1 },
    { date: "2025-10-19", opp: "WAS", home: true, rec: 4, tgt: 6, recYds: 82, recTd: 0 },
    { date: "2025-10-26", opp: "DEN", home: false, rec: 7, tgt: 9, recYds: 78, recTd: 0 },
    { date: "2025-11-03", opp: "ARI", home: true, rec: 6, tgt: 9, recYds: 79, recTd: 0 },
    { date: "2025-11-17", opp: "LV", home: false, rec: 9, tgt: 11, recYds: 144, recTd: 1 },
    { date: "2025-11-23", opp: "PHI", home: true, rec: 9, tgt: 9, recYds: 146, recTd: 1 },
    { date: "2025-11-27", opp: "KC", home: true, rec: 6, tgt: 13, recYds: 88, recTd: 0 },
    { date: "2025-12-04", opp: "DET", home: false, rec: 5, tgt: 9, recYds: 37, recTd: 0 },
    { date: "2025-12-14", opp: "MIN", home: true, rec: 3, tgt: 6, recYds: 33, recTd: 0 },
    { date: "2025-12-21", opp: "LAC", home: true, rec: 7, tgt: 9, recYds: 130, recTd: 1 },
    { date: "2025-12-25", opp: "WAS", home: false, rec: 4, tgt: 5, recYds: 78, recTd: 0 },
    { date: "2026-01-04", opp: "NYG", home: false, rec: 1, tgt: 3, recYds: 9, recTd: 0 },
  ],
  javonte: [
    { date: "2025-09-04", opp: "PHI", home: false, rushAtt: 15, rushYds: 54, rushTd: 2, rec: 2, tgt: 3, recYds: 10, recTd: 0 },
    { date: "2025-09-14", opp: "NYG", home: true, rushAtt: 18, rushYds: 97, rushTd: 1, rec: 6, tgt: 7, recYds: 33, recTd: 0 },
    { date: "2025-09-21", opp: "CHI", home: false, rushAtt: 10, rushYds: 76, rushTd: 0, rec: 5, tgt: 5, recYds: 16, recTd: 0 },
    { date: "2025-09-28", opp: "GB", home: true, rushAtt: 20, rushYds: 85, rushTd: 1, rec: 3, tgt: 3, recYds: 15, recTd: 0 },
    { date: "2025-10-05", opp: "NYJ", home: false, rushAtt: 16, rushYds: 135, rushTd: 1, rec: 1, tgt: 2, recYds: 4, recTd: 1 },
    { date: "2025-10-12", opp: "CAR", home: false, rushAtt: 13, rushYds: 29, rushTd: 0, rec: 5, tgt: 8, recYds: 5, recTd: 0 },
    { date: "2025-10-19", opp: "WAS", home: true, rushAtt: 19, rushYds: 116, rushTd: 1, rec: 1, tgt: 4, recYds: 2, recTd: 0 },
    { date: "2025-10-26", opp: "DEN", home: false, rushAtt: 13, rushYds: 41, rushTd: 2, rec: 1, tgt: 2, recYds: 8, recTd: 0 },
    { date: "2025-11-03", opp: "ARI", home: true, rushAtt: 15, rushYds: 83, rushTd: 0, rec: 1, tgt: 1, recYds: 0, recTd: 0 },
    { date: "2025-11-17", opp: "LV", home: false, rushAtt: 22, rushYds: 93, rushTd: 0, rec: 1, tgt: 1, recYds: 0, recTd: 0 },
    { date: "2025-11-23", opp: "PHI", home: true, rushAtt: 20, rushYds: 87, rushTd: 0, rec: 2, tgt: 3, recYds: 14, recTd: 0 },
    { date: "2025-11-27", opp: "KC", home: true, rushAtt: 17, rushYds: 59, rushTd: 0, rec: 3, tgt: 3, recYds: 21, recTd: 1 },
    { date: "2025-12-04", opp: "DET", home: false, rushAtt: 17, rushYds: 67, rushTd: 1, rec: 2, tgt: 4, recYds: 0, recTd: 0 },
    { date: "2025-12-14", opp: "MIN", home: true, rushAtt: 15, rushYds: 91, rushTd: 1, rec: 0, tgt: 0, recYds: 0, recTd: 0 },
    { date: "2025-12-21", opp: "LAC", home: true, rushAtt: 9, rushYds: 34, rushTd: 0, rec: 2, tgt: 3, recYds: 9, recTd: 0 },
    { date: "2025-12-25", opp: "WAS", home: false, rushAtt: 13, rushYds: 54, rushTd: 1, rec: 0, tgt: 2, recYds: 0, recTd: 0 },
  ],
  ferguson: [
    { date: "2025-09-04", opp: "PHI", home: false, rec: 5, recYds: 23, recTd: 0 },
    { date: "2025-09-14", opp: "NYG", home: true, rec: 9, recYds: 78, recTd: 0 },
    { date: "2025-09-21", opp: "CHI", home: false, rec: 13, recYds: 82, recTd: 0 },
    { date: "2025-09-28", opp: "GB", home: true, rec: 7, recYds: 40, recTd: 1 },
    { date: "2025-10-05", opp: "NYJ", home: false, rec: 7, recYds: 49, recTd: 2 },
    { date: "2025-10-12", opp: "CAR", home: false, rec: 3, recYds: 33, recTd: 1 },
    { date: "2025-10-19", opp: "WAS", home: true, rec: 7, recYds: 29, recTd: 2 },
    { date: "2025-10-26", opp: "DEN", home: false, rec: 0, recYds: 0, recTd: 0 },
    { date: "2025-11-03", opp: "ARI", home: true, rec: 5, recYds: 50, recTd: 0 },
    { date: "2025-11-17", opp: "LV", home: false, rec: 4, recYds: 16, recTd: 1 },
    { date: "2025-11-23", opp: "PHI", home: true, rec: 5, recYds: 60, recTd: 0 },
    { date: "2025-11-27", opp: "KC", home: true, rec: 5, recYds: 36, recTd: 0 },
    { date: "2025-12-04", opp: "DET", home: false, rec: 5, recYds: 58, recTd: 0 },
    { date: "2025-12-14", opp: "MIN", home: true, rec: 2, recYds: 16, recTd: 0 },
    { date: "2025-12-21", opp: "LAC", home: true, rec: 3, recYds: 19, recTd: 0 },
    { date: "2025-12-25", opp: "WAS", home: false, rec: 1, recYds: 6, recTd: 1 },
    { date: "2026-01-04", opp: "NYG", home: false, rec: 1, recYds: 5, recTd: 0 },
  ],
  tolbert: [
    { date: "2025-09-04", opp: "PHI", home: false, rec: 1, recYds: 0, recTd: 0 },
    { date: "2025-09-14", opp: "NYG", home: true, rec: 2, recYds: 16, recTd: 0 },
    { date: "2025-09-21", opp: "CHI", home: false, rec: 3, recYds: 24, recTd: 0 },
    { date: "2025-09-28", opp: "GB", home: true, rec: 4, recYds: 61, recTd: 0 },
    { date: "2025-10-05", opp: "NYJ", home: false, rec: 0, recYds: 0, recTd: 0 },
    { date: "2025-10-12", opp: "CAR", home: false, rec: 1, recYds: 8, recTd: 0 },
    { date: "2025-10-19", opp: "WAS", home: true, rec: 1, recYds: 16, recTd: 0 },
    { date: "2025-10-26", opp: "DEN", home: false, rec: 2, recYds: 47, recTd: 1 },
    { date: "2025-11-03", opp: "ARI", home: true, rec: 0, recYds: 0, recTd: 0 },
    { date: "2025-11-17", opp: "LV", home: false, rec: 0, recYds: 0, recTd: 0 },
    { date: "2025-11-23", opp: "PHI", home: true, rec: 0, recYds: 0, recTd: 0 },
    { date: "2025-11-27", opp: "KC", home: true, rec: 0, recYds: 0, recTd: 0 },
    { date: "2025-12-04", opp: "DET", home: false, rec: 0, recYds: 0, recTd: 0 },
    { date: "2025-12-14", opp: "MIN", home: true, rec: 0, recYds: 0, recTd: 0 },
    { date: "2025-12-21", opp: "LAC", home: true, rec: 0, recYds: 0, recTd: 0 },
    { date: "2025-12-25", opp: "WAS", home: false, rec: 4, recYds: 31, recTd: 0 },
    { date: "2026-01-04", opp: "NYG", home: false, rec: 0, recYds: 0, recTd: 0 },
  ],
  dowdle: [
    { date: "2025-09-04", opp: "PHI", home: false, rushAtt: 4, rushYds: 53, rushTd: 0, rec: 1, recYds: -3, recTd: 0 },
    { date: "2025-09-14", opp: "NYG", home: true, rushAtt: 5, rushYds: 15, rushTd: 1, rec: 2, recYds: 4, recTd: 0 },
    { date: "2025-09-21", opp: "CHI", home: false, rushAtt: 9, rushYds: 41, rushTd: 0, rec: 3, recYds: 12, recTd: 0 },
    { date: "2025-09-28", opp: "GB", home: true, rushAtt: 2, rushYds: 8, rushTd: 0, rec: 2, recYds: 17, recTd: 0 },
    { date: "2025-10-05", opp: "NYJ", home: false, rushAtt: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0 },
  ],
  aubrey: [
    { date: "2025-09-04", opp: "PHI", home: false, fgm: 2, fga: 2, xpm: 2, xpa: 2 },
    { date: "2025-09-14", opp: "NYG", home: true, fgm: 4, fga: 4, xpm: 4, xpa: 4 },
    { date: "2025-09-21", opp: "CHI", home: false, fgm: 2, fga: 2, xpm: 0, xpa: 0 },
    { date: "2025-09-28", opp: "GB", home: true, fgm: 1, fga: 1, xpm: 5, xpa: 5 },
    { date: "2025-10-05", opp: "NYJ", home: false, fgm: 1, fga: 1, xpm: 4, xpa: 5 },
    { date: "2025-10-12", opp: "CAR", home: false, fgm: 2, fga: 2, xpm: 3, xpa: 3 },
    { date: "2025-10-19", opp: "WAS", home: true, fgm: 3, fga: 3, xpm: 5, xpa: 5 },
    { date: "2025-10-26", opp: "DEN", home: false, fgm: 1, fga: 1, xpm: 3, xpa: 3 },
    { date: "2025-11-03", opp: "ARI", home: true, fgm: 1, fga: 2, xpm: 2, xpa: 2 },
    { date: "2025-11-17", opp: "LV", home: false, fgm: 1, fga: 1, xpm: 4, xpa: 4 },
    { date: "2025-11-23", opp: "PHI", home: true, fgm: 1, fga: 2, xpm: 3, xpa: 3 },
    { date: "2025-11-27", opp: "KC", home: true, fgm: 3, fga: 3, xpm: 2, xpa: 2 },
    { date: "2025-12-04", opp: "DET", home: false, fgm: 5, fga: 5, xpm: 1, xpa: 1 },
    { date: "2025-12-14", opp: "MIN", home: true, fgm: 4, fga: 6, xpm: 2, xpa: 2 },
    { date: "2025-12-21", opp: "LAC", home: true, fgm: 1, fga: 1, xpm: 2, xpa: 2 },
    { date: "2025-12-25", opp: "WAS", home: false, fgm: 3, fga: 4, xpm: 3, xpa: 3 },
    { date: "2026-01-04", opp: "NYG", home: false, fgm: 1, fga: 2, xpm: 2, xpa: 2 },
  ],
};

// Per-player offensive-snap-share profile: a realistic baseline (their
// typical role — every-down starter vs. committee back vs. rotational
// depth piece) plus how many points that snap share moves per unit of
// that game's usage stat, so a workhorse's floor stays high even in a
// low-target game while a rotational piece's snap share swings more.
// Kickers have no offensive snap % (they're a special-teams-only stat).
const SNAP_PROFILE = {
  dak: { statKey: "att", base: 65, slope: 1.0, floor: 76, ceil: 100 },
  lamb: { statKey: "recProxy", base: 75, slope: 1.5, floor: 75, ceil: 97 },
  pickens: { statKey: "recProxy", base: 68, slope: 1.6, floor: 68, ceil: 92 },
  javonte: { statKey: "rbUsage", base: 35, slope: 1.8, floor: 35, ceil: 85 },
  ferguson: { statKey: "recProxy", base: 62, slope: 2.2, floor: 62, ceil: 92 },
  tolbert: { statKey: "recProxy", base: 45, slope: 3.0, floor: 45, ceil: 65 },
  dowdle: { statKey: "rbUsage", base: 20, slope: 2.5, floor: 20, ceil: 55 },
};

// Longest single reception in a game isn't part of these box scores (or any
// live feed yet), so it's estimated from that game's rec/recYds -- a game's
// biggest play tends to run well above the per-catch average, capped so it
// never exceeds the total receiving yards for the game.
function estimateLongReception(rec, recYds) {
  if (!rec) return 0;
  const perCatch = recYds / rec;
  return Math.max(Math.round(perCatch), Math.min(recYds, Math.round(perCatch * 1.7 + 4)));
}

function estimateSnapPct(player, full) {
  const profile = SNAP_PROFILE[player.id];
  if (!profile) return null; // kicker
  const recProxy = Math.max(full.tgt, full.rec);
  const statValue = profile.statKey === "att" ? full.att
    : profile.statKey === "rbUsage" ? full.rushAtt + recProxy
    : recProxy;
  const pct = profile.base + statValue * profile.slope;
  return Math.max(profile.floor, Math.min(profile.ceil, Math.round(pct)));
}

// Normalizes a raw log entry (which only sets the fields relevant to that
// player) into the full shape statValueNFL expects, plus an estimated
// offensive snap % (real per-game snap counts aren't part of these box
// scores, so it's derived from the player's role and that game's usage).
function normalizeNFLGame(g, player) {
  const full = {
    date: g.date, opp: g.opp, home: g.home,
    comp: g.comp || 0, att: g.att || 0, passYds: g.passYds || 0, passTd: g.passTd || 0, int: g.int || 0,
    rushAtt: g.rushAtt || 0, rushYds: g.rushYds || 0, rushTd: g.rushTd || 0,
    rec: g.rec || 0, tgt: g.tgt || 0, recYds: g.recYds || 0, recTd: g.recTd || 0,
    fgm: g.fgm || 0, fga: g.fga || 0, xpm: g.xpm || 0, xpa: g.xpa || 0,
  };
  // g.long comes through as a real value on rows parsed from ESPN's gamelog
  // (see parseNFLGameLogResponse) -- only estimate it when that's absent,
  // i.e. for the synthetic/hand-transcribed logs that never tracked it.
  const long = g.long != null ? g.long : estimateLongReception(full.rec, full.recYds);
  return { ...full, snapPct: estimateSnapPct(player, full), long };
}

// Season-average baselines for every non-Cowboys team's seeded synthetic
// game logs (see genSyntheticNFLGames below) -- no live NFL stats feed is
// wired in, so unlike the Cowboys' real box-score logs above, these games
// are generated noise around a realistic per-player average rather than
// transcribed play-by-play.
const SYNTHETIC_NFL_STAT_BASE = {
  // New York Giants
  dart: { comp: 19, att: 29, passYds: 190, passTd: 1.1, int: 0.7, rushAtt: 6, rushYds: 32, rushTd: 0.3, snap: 98 },
  nabers: { rec: 6.5, tgt: 10, recYds: 85, recTd: 0.5, snap: 90 },
  slayton: { rec: 3.5, tgt: 6, recYds: 58, recTd: 0.4, snap: 70 },
  hyatt: { rec: 2, tgt: 3.5, recYds: 26, recTd: 0.15, snap: 40 },
  skattebo: { rushAtt: 14, rushYds: 60, rushTd: 0.45, rec: 3, tgt: 3.5, recYds: 20, recTd: 0.1, snap: 62 },
  tracy: { rushAtt: 8, rushYds: 32, rushTd: 0.2, rec: 2.5, tgt: 3, recYds: 17, recTd: 0.05, snap: 42 },
  theojohnson: { rec: 3.5, tgt: 5, recYds: 40, recTd: 0.3, snap: 78 },
  sauls: { fgm: 1.5, fga: 1.8, xpm: 2, xpa: 2.1, snap: null },
  // San Francisco 49ers
  purdy: { comp: 22, att: 32, passYds: 245, passTd: 1.6, int: 0.6, rushAtt: 3, rushYds: 12, rushTd: 0.2, snap: 99 },
  evans: { rec: 5.5, tgt: 8.5, recYds: 78, recTd: 0.55, snap: 85 },
  pearsall: { rec: 4, tgt: 6.5, recYds: 55, recTd: 0.35, snap: 75 },
  cowing: { rec: 2.5, tgt: 4, recYds: 30, recTd: 0.15, snap: 45 },
  mccaffrey: { rushAtt: 16, rushYds: 75, rushTd: 0.6, rec: 4.5, tgt: 5.5, recYds: 35, recTd: 0.2, snap: 75 },
  guerendo: { rushAtt: 8, rushYds: 35, rushTd: 0.2, rec: 1.5, tgt: 2, recYds: 12, recTd: 0.05, snap: 30 },
  mclachlan: { rec: 3, tgt: 4.5, recYds: 34, recTd: 0.2, snap: 55 },
  pineiro: { fgm: 1.6, fga: 1.9, xpm: 2.3, xpa: 2.4, snap: null },
  // Los Angeles Rams
  stafford: { comp: 23, att: 33, passYds: 260, passTd: 1.7, int: 0.6, rushAtt: 2, rushYds: 3, rushTd: 0.05, snap: 99 },
  nacua: { rec: 7, tgt: 10, recYds: 90, recTd: 0.45, snap: 88 },
  adams: { rec: 5, tgt: 8, recYds: 65, recTd: 0.4, snap: 80 },
  whittington: { rec: 2.5, tgt: 4, recYds: 28, recTd: 0.1, snap: 40 },
  kyren: { rushAtt: 15, rushYds: 65, rushTd: 0.5, rec: 3, tgt: 3.5, recYds: 22, recTd: 0.15, snap: 70 },
  corum: { rushAtt: 7, rushYds: 30, rushTd: 0.2, rec: 1, tgt: 1.3, recYds: 7, recTd: 0.03, snap: 25 },
  higbee: { rec: 3.5, tgt: 5, recYds: 38, recTd: 0.25, snap: 75 },
  mevis: { fgm: 1.5, fga: 1.8, xpm: 2.2, xpa: 2.3, snap: null },
  // Denver Broncos
  nix: { comp: 22, att: 33, passYds: 235, passTd: 1.4, int: 0.6, rushAtt: 4, rushYds: 20, rushTd: 0.2, snap: 99 },
  sutton: { rec: 4.5, tgt: 7.5, recYds: 65, recTd: 0.4, snap: 85 },
  waddle: { rec: 5, tgt: 8, recYds: 68, recTd: 0.35, snap: 82 },
  mims: { rec: 3, tgt: 5, recYds: 42, recTd: 0.25, snap: 55 },
  jdobbins: { rushAtt: 14, rushYds: 62, rushTd: 0.5, rec: 2, tgt: 2.5, recYds: 14, recTd: 0.05, snap: 55 },
  harveyrj: { rushAtt: 7, rushYds: 30, rushTd: 0.25, rec: 1.5, tgt: 2, recYds: 10, recTd: 0.03, snap: 30 },
  engram: { rec: 4.5, tgt: 6, recYds: 45, recTd: 0.3, snap: 78 },
  lutz: { fgm: 1.6, fga: 1.9, xpm: 2.4, xpa: 2.5, snap: null },
  // Kansas City Chiefs
  mahomes: { comp: 24, att: 34, passYds: 275, passTd: 2.0, int: 0.5, rushAtt: 3.5, rushYds: 18, rushTd: 0.25, snap: 99 },
  rice: { rec: 6, tgt: 9, recYds: 78, recTd: 0.5, snap: 85 },
  worthy: { rec: 4.5, tgt: 7, recYds: 62, recTd: 0.35, snap: 78 },
  thornton: { rec: 2, tgt: 3.5, recYds: 28, recTd: 0.1, snap: 40 },
  kwalker: { rushAtt: 15, rushYds: 68, rushTd: 0.55, rec: 2.5, tgt: 3, recYds: 18, recTd: 0.08, snap: 60 },
  bsmith: { rushAtt: 6, rushYds: 26, rushTd: 0.15, rec: 1.5, tgt: 2, recYds: 12, recTd: 0.03, snap: 25 },
  kelce: { rec: 5.5, tgt: 7.5, recYds: 62, recTd: 0.4, snap: 82 },
  butker: { fgm: 1.7, fga: 2.0, xpm: 2.6, xpa: 2.7, snap: null },
};
// All 32 real NFL teams (see NFL_TEAMS above), minus whichever one the
// player is actually on -- so a game is never generated against yourself,
// but every other team (Dallas included) is a valid synthetic opponent.
function syntheticOpponentPool(team) {
  return NFL_TEAMS.filter((t) => t !== team);
}

function genSyntheticNFLGames(player) {
  const base = SYNTHETIC_NFL_STAT_BASE[player.id];
  if (!base) return [];
  const opponents = syntheticOpponentPool(player.team);
  const rng = mulberry32(hashStr(player.id) + 4200);
  const noise = (mean, spread) => Math.max(0, Math.round(mean + (rng() - 0.5) * 2 * spread));
  const games = [];
  const startDate = new Date("2025-09-08T00:00:00Z");
  for (let i = 0; i < 14; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * 7);
    const home = rng() > 0.5;
    const opp = opponents[Math.floor(rng() * opponents.length)];
    const rec = base.rec != null ? noise(base.rec, base.rec * 0.5) : 0;
    const recYds = base.recYds != null ? noise(base.recYds, base.recYds * 0.5) : 0;
    games.push({
      date: d.toISOString().slice(0, 10), opp, home,
      comp: base.comp != null ? noise(base.comp, base.comp * 0.2) : 0,
      att: base.att != null ? noise(base.att, base.att * 0.15) : 0,
      passYds: base.passYds != null ? noise(base.passYds, base.passYds * 0.35) : 0,
      passTd: base.passTd != null ? noise(base.passTd, 1) : 0,
      int: base.int != null ? noise(base.int, 1) : 0,
      rushAtt: base.rushAtt != null ? noise(base.rushAtt, base.rushAtt * 0.4) : 0,
      rushYds: base.rushYds != null ? noise(base.rushYds, base.rushYds * 0.5) : 0,
      rushTd: base.rushTd != null ? noise(base.rushTd, 1) : 0,
      rec, tgt: base.tgt != null ? noise(base.tgt, base.tgt * 0.4) : 0,
      recYds,
      long: estimateLongReception(rec, recYds),
      recTd: base.recTd != null ? noise(base.recTd, 1) : 0,
      fgm: base.fgm != null ? noise(base.fgm, 1.2) : 0,
      fga: base.fga != null ? noise(base.fga, 1.2) : 0,
      xpm: base.xpm != null ? noise(base.xpm, 1.5) : 0,
      xpa: base.xpa != null ? noise(base.xpa, 1.5) : 0,
      snapPct: base.snap != null ? Math.max(0, Math.min(100, noise(base.snap, 10))) : null,
    });
  }
  return games;
}

// Populated in place by fetchNFLPlayerGameLog once each player's real 2025
// game log resolves (see the loading effect in PropLedger). Takes priority
// over both the hand-transcribed NFL_GAME_LOGS (Cowboys only) and the
// synthetic generator (everyone else) the moment it's available -- until
// then, getNFLGames falls back exactly as it did before this existed, so the
// page never has to show a loading state.
const NFL_REAL_GAME_LOGS = {};

// Maps the flat "names" keys ESPN's gamelog endpoint returns to the field
// names statValueNFL/normalizeNFLGame already expect.
const NFL_STAT_NAME_MAP = {
  completions: "comp",
  passingAttempts: "att",
  passingYards: "passYds",
  passingTouchdowns: "passTd",
  interceptions: "int",
  rushingAttempts: "rushAtt",
  rushingYards: "rushYds",
  rushingTouchdowns: "rushTd",
  receptions: "rec",
  receivingTargets: "tgt",
  receivingYards: "recYds",
  receivingTouchdowns: "recTd",
  longReception: "long",
};

// "2-3" (made-attempts, as ESPN formats kicking stats) -> [2, 3]
function parseMadeAttempts(s) {
  if (!s || typeof s !== "string") return [0, 0];
  const [made, att] = s.split("-").map((n) => parseFloat(n));
  return [Number.isFinite(made) ? made : 0, Number.isFinite(att) ? att : 0];
}

// Turns ESPN's raw gamelog response (see fetchNFLPlayerGameLog) into the
// same { date, opp, home, comp, att, passYds, ... } shape genSyntheticNFLGames
// produces, oldest game first.
function parseNFLGameLogResponse(data) {
  const names = data?.names || [];
  const events = data?.events || {};
  const byEvent = {};

  (data?.seasonTypes || []).forEach((st) => {
    (st.categories || []).forEach((cat) => {
      (cat.events || []).forEach((ev) => {
        const meta = events[ev.eventId];
        if (!meta) return;
        if (!byEvent[ev.eventId]) byEvent[ev.eventId] = { meta, stats: {} };
        (ev.stats || []).forEach((val, i) => {
          const key = names[i];
          if (key) byEvent[ev.eventId].stats[key] = val;
        });
      });
    });
  });

  return Object.values(byEvent)
    .map(({ meta, stats }) => {
      const oppAbbr = meta.opponent?.abbreviation;
      const opp = NFL_ESPN_ABBR_FIX[oppAbbr] || oppAbbr || "???";
      const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
      const game = {
        date: (meta.gameDate || "").slice(0, 10),
        opp,
        home: meta.atVs !== "@",
      };
      Object.entries(NFL_STAT_NAME_MAP).forEach(([espnKey, ourKey]) => {
        game[ourKey] = num(stats[espnKey]);
      });
      const [fgm, fga] = parseMadeAttempts(stats["fieldGoalsMade-fieldGoalAttempts"]);
      const [xpm, xpa] = parseMadeAttempts(stats["extraPointsMade-extraPointAttempts"]);
      game.fgm = fgm; game.fga = fga; game.xpm = xpm; game.xpa = xpa;
      return game;
    })
    .filter((g) => g.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// An NFL season is labelled by the year it kicks off in, but it runs into
// February -- so a January game belongs to the previous year's season. August
// counts as the new season because that's when ESPN starts serving it.
function nflSeasonForDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getUTCMonth() >= 7 ? dt.getUTCFullYear() : dt.getUTCFullYear() - 1;
}
function currentNFLSeason() {
  return nflSeasonForDate(new Date());
}

// A finished season is immutable, so it's cached with no TTL. The season
// currently being played is not, so it gets a short one -- without this, a
// Sunday's results would be stuck behind whatever the tab fetched on
// Saturday, which is exactly when the Ledger is trying to settle picks.
const NFL_LIVE_GAMELOG_TTL_MS = 6 * 60 * 60 * 1000;
const nflGameLogCache = new Map();
async function fetchNFLPlayerGameLog(espnId, season = currentNFLSeason()) {
  // Keyed by season, not just by player: the same athlete has a different
  // log per year, and the grader deliberately asks for the season its pick
  // was played in rather than today's.
  const key = `${espnId}:${season}`;
  const isFinished = season < currentNFLSeason();
  const fresh = (rec) => rec && (isFinished || Date.now() - rec.fetchedAt < NFL_LIVE_GAMELOG_TTL_MS);

  // `games: []` is cached deliberately, and is the reason this returns null
  // through a stored record rather than short-circuiting on a falsy cache
  // hit. Before Week 1 the current season is empty for every player, and the
  // display path asks for it first -- without remembering the empty answer,
  // every page load would re-request an empty season once per player, which
  // for the full NFL roster is a couple of hundred pointless requests a load.
  const cached = nflGameLogCache.get(key);
  if (fresh(cached)) return cached.games.length ? cached.games : null;

  const cacheKey = `nfl_gamelog_v2_${key}`;
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (fresh(parsed)) {
        nflGameLogCache.set(key, parsed);
        return parsed.games.length ? parsed.games : null;
      }
    }
  } catch {}

  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${espnId}/gamelog?season=${season}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const games = parseNFLGameLogResponse(data);
    const record = { games, fetchedAt: Date.now() };
    nflGameLogCache.set(key, record);
    try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
    return games.length ? games : null;
  } catch {
    // A network failure is not evidence that the season is empty, so it is
    // not cached -- the next load should try again.
    return null;
  }
}

// What the feed and the charts should show. Before Week 1 the new season has
// no games in it, and hit rates built on nothing are worse than hit rates
// built on last year -- so this prefers the current season and falls back to
// the one before it. That also means the rollover happens on its own: the
// first week real 2026 games exist, they're what gets used, with no date
// hardcoded anywhere to go stale.
async function fetchNFLPlayerGameLogForDisplay(espnId) {
  const season = currentNFLSeason();
  const current = await fetchNFLPlayerGameLog(espnId, season);
  if (current && current.length) return current;
  return fetchNFLPlayerGameLog(espnId, season - 1);
}

function getNFLGames(player) {
  if (NFL_REAL_GAME_LOGS[player.id]) return NFL_REAL_GAME_LOGS[player.id].map((g) => normalizeNFLGame(g, player));
  if (NFL_GAME_LOGS[player.id]) return NFL_GAME_LOGS[player.id].map((g) => normalizeNFLGame(g, player));
  return genSyntheticNFLGames(player);
}

const statValueNFL = (g, market) => {
  switch (market) {
    case "passYds": return g.passYds;
    case "passTd": return g.passTd;
    case "comp": return g.comp;
    case "int": return g.int;
    case "rushYds": return g.rushYds;
    case "passRushYds": return g.passYds + g.rushYds;
    case "rushAtt": return g.rushAtt;
    case "rec": return g.rec;
    case "recYds": return g.recYds;
    case "scrim": return g.rushYds + g.recYds;
    case "longRec": return g.long;
    case "passAtt": return g.att;
    // Not a milestone/binary market -- a player can score more than once in a
    // game, so this is the actual total (rush + rec + pass TDs that game),
    // rendered as a normal counting bar chart like every other market.
    case "anytimeTd": return g.rushTd + g.recTd + g.passTd;
    case "fgm": return g.fgm;
    case "fga": return g.fga;
    case "xpm": return g.xpm;
    case "kickPts": return g.fgm * 3 + g.xpm;
    default: return 0;
  }
};

// NFL equivalent of battingRateAgg -- rolls a set of game logs up into the
// rate stats shown on the detailed stat row above the chart. Every rate is
// computed from summed raw counting stats (Σcomp/Σatt, not the mean of each
// game's own completion %), so a 2-for-4 game doesn't get the same weight as
// a 30-for-45 one. The same math applies whether `games` is the full season
// or whatever the active filters have narrowed it down to.
//
// Every key is computed regardless of position -- it's a handful of sums over
// at most ~20 games, and NFL_RATE_COLUMNS below decides which ones a given
// position actually shows.
function nflRateAgg(games) {
  const n = games.length || 1;
  const sum = (k) => games.reduce((a, g) => a + (g[k] || 0), 0);
  const att = sum("att"), comp = sum("comp"), passYds = sum("passYds");
  const rushAtt = sum("rushAtt"), rushYds = sum("rushYds");
  const tgt = sum("tgt"), rec = sum("rec"), recYds = sum("recYds");
  const fgm = sum("fgm"), fga = sum("fga"), xpm = sum("xpm"), xpa = sum("xpa");
  // Snap share is already a percentage per game, so it averages rather than
  // sums -- and games with no recorded share are left out of the denominator
  // instead of counting as zero.
  const snaps = games.map((g) => g.snapPct).filter((s) => s != null);
  return {
    att: att / n,
    comp: comp / n,
    compPct: att ? (comp / att) * 100 : 0,
    passYds: passYds / n,
    ypa: att ? passYds / att : 0,
    passTd: sum("passTd") / n,
    int: sum("int") / n,
    car: rushAtt / n,
    rushYds: rushYds / n,
    ypc: rushAtt ? rushYds / rushAtt : 0,
    tgt: tgt / n,
    rec: rec / n,
    catchPct: tgt ? (rec / tgt) * 100 : 0,
    recYds: recYds / n,
    ypr: rec ? recYds / rec : 0,
    snapPct: snaps.length ? snaps.reduce((a, b) => a + b, 0) / snaps.length : 0,
    fga: fga / n,
    fgPct: fga ? (fgm / fga) * 100 : 0,
    xpa: xpa / n,
    xpPct: xpa ? (xpm / xpa) * 100 : 0,
    kickPts: (fgm * 3 + xpm) / n,
  };
}

// Which nflRateAgg keys the detailed stat row shows for each position, and how
// each one is formatted and colored. `better: null` marks pure volume stats
// (attempts, carries, targets) where a move in either direction is neither
// good nor bad on its own -- those render their delta dim rather than
// green/red. Six columns per position, matching the MLB row's density.
const NFL_RATE_COLUMNS = {
  QB: [
    { key: "att", label: "ATT", decimals: 1, better: null },
    { key: "compPct", label: "COMP%", decimals: 1, better: true, suffix: "%" },
    { key: "passYds", label: "YDS", decimals: 1, better: true },
    { key: "ypa", label: "Y/A", decimals: 2, better: true },
    { key: "passTd", label: "TD", decimals: 2, better: true },
    { key: "int", label: "INT", decimals: 2, better: false },
  ],
  RB: [
    { key: "car", label: "CAR", decimals: 1, better: null },
    { key: "rushYds", label: "RUSH YDS", decimals: 1, better: true },
    { key: "ypc", label: "YPC", decimals: 2, better: true },
    { key: "tgt", label: "TGT", decimals: 1, better: null },
    { key: "rec", label: "REC", decimals: 1, better: true },
    { key: "snapPct", label: "SNAP%", decimals: 1, better: true, suffix: "%" },
  ],
  WR: [
    { key: "tgt", label: "TGT", decimals: 1, better: null },
    { key: "rec", label: "REC", decimals: 1, better: true },
    { key: "catchPct", label: "CATCH%", decimals: 1, better: true, suffix: "%" },
    { key: "recYds", label: "YDS", decimals: 1, better: true },
    { key: "ypr", label: "Y/REC", decimals: 2, better: true },
    { key: "snapPct", label: "SNAP%", decimals: 1, better: true, suffix: "%" },
  ],
  K: [
    { key: "fga", label: "FGA", decimals: 1, better: null },
    { key: "fgPct", label: "FG%", decimals: 1, better: true, suffix: "%" },
    { key: "xpa", label: "XPA", decimals: 1, better: null },
    { key: "xpPct", label: "XP%", decimals: 1, better: true, suffix: "%" },
    { key: "kickPts", label: "PTS", decimals: 1, better: true },
  ],
};
// A tight end's usage reads the same way a receiver's does, so it shares the
// WR column set rather than duplicating it.
NFL_RATE_COLUMNS.TE = NFL_RATE_COLUMNS.WR;

// Plain-spoken guide to the rate stats above, in the same voice as the MLB
// page's -- written for someone who bets props but doesn't necessarily read
// box scores. Keyed by column id; only the entries for the columns actually
// on screen get shown.
const NFL_RATE_GLOSSARY = {
  att: { label: "ATT — Pass Attempts", body: "How many passes the quarterback threw per game, on average. It's a volume stat: more attempts means more chances at yards and touchdowns, and it usually goes up when a team is playing from behind." },
  compPct: { label: "COMP% — Completion Percentage", body: "The share of pass attempts that were caught. Around 65% is roughly average for a modern NFL starter. Higher usually means short, safe throws or a quarterback playing well; a sharp drop often shows up alongside a bad yardage game." },
  passYds: { label: "YDS — Passing Yards", body: "Passing yards per game in the sample shown. This is the raw number the Pass Yds market is priced off." },
  ypa: { label: "Y/A — Yards per Attempt", body: "Passing yards divided by attempts. Separates efficiency from volume: 300 yards on 50 attempts (6.0) is a very different game from 300 on 30 (10.0), even though both say \"300 yards\"." },
  passTd: { label: "TD — Passing Touchdowns", body: "Passing touchdowns per game. Touchdowns are noisy game to game, so a small sample can swing this number a lot more than yardage." },
  int: { label: "INT — Interceptions", body: "Interceptions thrown per game. Lower is better here — this is the one column where a green delta means the number went down." },
  car: { label: "CAR — Carries", body: "Rushing attempts per game. A volume stat: workload usually matters more than efficiency for rushing props, since a back who gets 20 carries has far more paths to a big number than one who gets 8." },
  rushYds: { label: "RUSH YDS — Rushing Yards", body: "Rushing yards per game in the sample shown." },
  ypc: { label: "YPC — Yards per Carry", body: "Rushing yards divided by carries. The efficiency half of the picture — a back can post the same yardage on a heavy, inefficient day or a light, explosive one, and those tend to repeat differently." },
  tgt: { label: "TGT — Targets", body: "How many passes were thrown their way per game, caught or not. Often a better read on a receiver's role than catches, since targets are about how much the offense is looking for them." },
  rec: { label: "REC — Receptions", body: "Catches per game in the sample shown." },
  catchPct: { label: "CATCH% — Catch Rate", body: "The share of targets that were actually caught. Running backs and tight ends usually run higher (short, easy throws) than deep receivers, so compare a player to their own baseline rather than across positions." },
  recYds: { label: "YDS — Receiving Yards", body: "Receiving yards per game in the sample shown." },
  ypr: { label: "Y/REC — Yards per Reception", body: "Receiving yards divided by catches — how far the average catch goes. A high number points to a downfield role, a low one to short-area or screen work." },
  snapPct: { label: "SNAP% — Snap Share", body: "The share of the offense's plays the player was on the field for. This is the single best early warning for props: a receiver whose snap share is trending down is losing his role, and the yardage usually follows." },
  fga: { label: "FGA — Field Goal Attempts", body: "Field goals attempted per game. Volume for a kicker is mostly a function of how often his offense stalls in field goal range, which is why kicker props swing with the offense's form." },
  fgPct: { label: "FG% — Field Goal Percentage", body: "The share of field goal attempts that were made. Higher is better, but be aware it's also distance-dependent — a kicker attempting a lot of long ones will look worse here." },
  xpa: { label: "XPA — Extra Point Attempts", body: "Extra points attempted per game, which is really a count of how many touchdowns the offense scored." },
  xpPct: { label: "XP% — Extra Point Percentage", body: "The share of extra points made. Usually very close to 100% — a number meaningfully below that is a real signal." },
  kickPts: { label: "PTS — Kicking Points", body: "Total points scored by the kicker per game (3 per field goal, 1 per extra point) — the number the Kicking Points market is priced off." },
};

const statValue = (g, market, rebSplit = "total") => {
  const reb = g.oreb + g.dreb;
  const rebForSplit = rebSplit === "off" ? g.oreb : rebSplit === "def" ? g.dreb : reb;
  // Count of core categories (pts, reb, ast, stl, blk) that hit double digits,
  // used to derive the double-double / triple-double binary props.
  const doubleDigitCount = [g.pts, reb, g.ast, g.stl, g.blk].filter((v) => v >= 10).length;
  switch (market) {
    case "pts": return g.pts;
    case "reb": return rebForSplit;
    case "ast": return g.ast;
    case "stl": return g.stl;
    case "blk": return g.blk;
    case "fg3a": return g.fg3a;
    case "ftm": return g.ftm;
    case "fta": return g.fta;
    case "tov": return g.tov;
    case "dd": return doubleDigitCount >= 2 ? 1 : 0;
    case "td": return doubleDigitCount >= 3 ? 1 : 0;
    case "pra": return g.pts + reb + g.ast;
    case "pa": return g.pts + g.ast;
    case "pr": return g.pts + reb;
    case "ra": return reb + g.ast;
    case "stk": return g.stl + g.blk;
    case "3pm": return g.fg3m;
    default: return g.pts;
  }
};

// Basketball equivalent of battingRateAgg/nflRateAgg, shared by the NBA and
// WNBA pages -- their game logs carry the same fields (see genGames and
// genWNBAGames), so one aggregator covers both. Shooting percentages come from
// summed makes over summed attempts, not the mean of each game's own
// percentage, so a 1-for-2 night doesn't outweigh a 5-for-12 one.
//
// Note what is *not* here: FG%, TS% and usage rate. None of them can be
// computed from this data -- the logs record 3-point and free-throw makes and
// attempts but no total field goals (fgm/fga), and usage additionally needs
// team-level possessions. Showing an approximation of a stat bettors read
// precisely would be worse than showing the real ones, so the row sticks to
// what the numbers actually support.
function hoopsRateAgg(games) {
  const n = games.length || 1;
  const sum = (k) => games.reduce((a, g) => a + (g[k] || 0), 0);
  const fg3m = sum("fg3m"), fg3a = sum("fg3a"), ftm = sum("ftm"), fta = sum("fta");
  return {
    min: sum("minutes") / n,
    pts: sum("pts") / n,
    reb: (sum("oreb") + sum("dreb")) / n,
    ast: sum("ast") / n,
    fg3pct: fg3a ? (fg3m / fg3a) * 100 : 0,
    ftpct: fta ? (ftm / fta) * 100 : 0,
    tov: sum("tov") / n,
  };
}

// Six columns, matching the density of the MLB and NFL rows. Turnovers are the
// one stat where down is good; minutes are volume, so neither direction is
// good or bad on its own and the delta renders dim.
const HOOPS_RATE_COLUMNS = [
  { key: "min", label: "MIN", decimals: 1, better: null },
  { key: "pts", label: "PTS", decimals: 1, better: true },
  { key: "reb", label: "REB", decimals: 1, better: true },
  { key: "ast", label: "AST", decimals: 1, better: true },
  { key: "fg3pct", label: "3P%", decimals: 1, better: true, suffix: "%" },
  { key: "ftpct", label: "FT%", decimals: 1, better: true, suffix: "%" },
];

const HOOPS_RATE_GLOSSARY = {
  min: { label: "MIN — Minutes Played", body: "Minutes per game in the sample shown. The single most important number for basketball props: almost every other stat scales with floor time, so a player whose minutes are trending down is a warning sign no matter how good the per-game averages look." },
  pts: { label: "PTS — Points", body: "Points per game in the sample shown." },
  reb: { label: "REB — Rebounds", body: "Total rebounds per game, offensive and defensive combined. The Rebounds market can be split into offensive-only or defensive-only on the chart above; this column is always the total." },
  ast: { label: "AST — Assists", body: "Assists per game. Tends to be the noisiest of the core three — it depends on teammates actually making the shot, so it swings more game to game than points or rebounds." },
  fg3pct: { label: "3P% — Three-Point Percentage", body: "The share of three-point attempts that went in, computed over the whole sample rather than averaged per game. Around 36% is roughly league average. Worth reading next to the attempts themselves: a hot percentage on low volume usually says less about form than a steady one on high volume." },
  ftpct: { label: "FT% — Free Throw Percentage", body: "The share of free throws made. It's the most stable skill in basketball, so a player well below their own career norm here is usually a small sample rather than a real decline." },
  tov: { label: "TOV — Turnovers", body: "Turnovers per game. Lower is better — this is the one column where a green delta means the number went down." },
};

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// Draggable line-value tab that sits on the right edge of the chart, at the
// pixel height matching its value on the y-axis (PropsMadness-style handle).
const CHART_HEIGHT = 680;
// Fallback plot bounds, only used for the one frame before the chart's real
// gridlines can be measured (see getPlotBoundsY) -- the axis's custom tick
// renderer (logo + abbreviation, or just a date label) takes up more height
// than the chart's configured margin accounts for, and that extra amount
// differs per chart, so a fixed constant here would drift out of sync with
// the actual rendered axis the moment either tick renderer changes.
const PLOT_TOP_FALLBACK = 27;
const PLOT_HEIGHT_FALLBACK = 550;

// Reads the real pixel Y (relative to containerEl) of the y-axis's 0 and max
// gridlines straight off the rendered chart, so the handle/reference-line
// always line up with the actual bars no matter how much space the axis's
// tick labels end up taking.
function getPlotBoundsY(containerEl) {
  if (!containerEl) return null;
  const lines = containerEl.querySelectorAll(".recharts-cartesian-grid-horizontal line");
  if (lines.length < 2) return null;
  const containerRect = containerEl.getBoundingClientRect();
  const zeroY = lines[0].getBoundingClientRect().top - containerRect.top;
  const maxY = lines[lines.length - 1].getBoundingClientRect().top - containerRect.top;
  return { zeroY, maxY };
}

// Bar colors, shared across every bar chart (NFL/MLB/NBA/WNBA) -- themed
// tokens rather than fixed hex so bars stay legible in both themes
// instead of the old dark-mode-only hardcoded pair.
const CHART_GREEN = "var(--pos)";
const CHART_RED = "var(--neg)";

// Snap any value to the nearest "X.5" — real prop lines are almost never whole numbers
const snapToHalfOdd = (v) => Math.round(v - 0.5) + 0.5;
// Smallest "X.5" at or above v — used for the default line so it starts just above the average
const ceilToHalfOdd = (v) => Math.ceil(v - 0.5) + 0.5;

// Approximates the actual sportsbook line for each NFL game as it would
// have looked at kickoff: the player's trailing average in that market up
// to (not including) that game, snapped to the nearest half-point. The
// first tracked game falls back to the full-season average, standing in
// for a preseason-set expectation. Games are chronological (oldest first),
// matching the order NFL_GAME_LOGS is stored in.
function computeNFLHistoricalLines(games, market) {
  if (!games.length) return [];
  const values = games.map((g) => statValueNFL(g, market));
  const seasonAvg = values.reduce((a, b) => a + b, 0) / values.length;
  return values.map((_, i) => {
    if (i === 0) return snapToHalfOdd(seasonAvg);
    const priorAvg = values.slice(0, i).reduce((a, b) => a + b, 0) / i;
    return snapToHalfOdd(priorAvg);
  });
}

function LineHandle({ value, onChange, min, max, containerRef, onDragValue }) {
  const draggingRef = React.useRef(false);
  // Tracks the handle's continuous, unsnapped position while dragging --
  // rendering position from this (rather than from `value`, which only ever
  // holds a snapped .5 increment) is what makes the drag itself feel free-
  // moving. `value` -- and the onChange below that updates it -- still only
  // change at each half-point threshold, so the actual line still snaps
  // forward/back at those crossings; it just no longer drags the handle's
  // visible position in lockstep with that snap.
  const [dragValue, setDragValue] = useState(null);

  // handlePointerMove/stopDrag are subscribed to `window` for the life of a
  // single drag (pointerdown -> pointerup/cancel), which can span several
  // re-renders. Reading props/value through this ref (kept current every
  // render) instead of closing over them directly means the two callbacks
  // below can have stable identities -- required so the unmount-cleanup
  // effect further down removes the exact listeners that are actually
  // attached, rather than a same-render-but-different-instance closure that
  // was never registered.
  const latestRef = React.useRef({ value, min, max, onChange, onDragValue });
  latestRef.current = { value, min, max, onChange, onDragValue };

  const valueToY = (v) => {
    const bounds = getPlotBoundsY(containerRef.current);
    const zeroY = bounds ? bounds.zeroY : PLOT_TOP_FALLBACK + PLOT_HEIGHT_FALLBACK;
    const maxY = bounds ? bounds.maxY : PLOT_TOP_FALLBACK;
    return zeroY - ((v - min) / (max - min)) * (zeroY - maxY);
  };

  const handlePointerMove = React.useCallback((e) => {
    if (!draggingRef.current || !containerRef.current) return;
    const { min, max, onChange, onDragValue } = latestRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const bounds = getPlotBoundsY(containerRef.current);
    const zeroY = bounds ? bounds.zeroY : PLOT_TOP_FALLBACK + PLOT_HEIGHT_FALLBACK;
    const maxY = bounds ? bounds.maxY : PLOT_TOP_FALLBACK;
    const ratio = (zeroY - relY) / (zeroY - maxY);
    const raw = Math.min(max, Math.max(min, min + ratio * (max - min)));
    setDragValue(raw);
    onDragValue?.(raw);
    onChange(Math.min(max, Math.max(min, snapToHalfOdd(raw))));
  }, [containerRef]);

  const stopDrag = React.useCallback(() => {
    draggingRef.current = false;
    setDragValue(null);
    latestRef.current.onDragValue?.(null);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDrag);
    window.removeEventListener("pointercancel", stopDrag);
  }, [handlePointerMove]);

  const startDrag = (e) => {
    // Stops the chart wrapper's touchAction:"pan-y" from still letting iOS
    // treat a mostly-vertical drag as a page scroll gesture part-way through,
    // which previously fired pointercancel and left draggingRef stuck true.
    e.preventDefault();
    draggingRef.current = true;
    setDragValue(latestRef.current.value);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
  };

  // Belt-and-suspenders cleanup: if the handle unmounts mid-drag (player or
  // market switched while dragging) neither pointerup nor pointercancel ever
  // fires on this instance, which would otherwise leak the window listeners.
  React.useEffect(() => () => stopDrag(), [stopDrag]);

  const handleKeyDown = (e) => {
    const { value, min, max, onChange } = latestRef.current;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      onChange(Math.min(max, value + 0.5));
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(Math.max(min, value - 0.5));
    }
  };

  const y = valueToY(dragValue !== null ? dragValue : value);

  return (
    <div
      onPointerDown={startDrag}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      style={{
        position: "absolute",
        right: 8,
        top: y - 15,
        height: 30,
        minWidth: 52,
        padding: "0 10px",
        background: "var(--amber)",
        borderRadius: 5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "var(--shadow-2)",
        cursor: "ns-resize",
        userSelect: "none",
        touchAction: "none",
        zIndex: 5,
      }}
      title="Drag to adjust the line"
    >
      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-on)" }}>{value}</span>
    </div>
  );
}

// Shared threshold slider used by every page's Minutes/Snap%/PA filter.
// Defaults to today's single-thumb "25+" behavior; a "Use range" toggle
// reveals a second thumb for capping the max or picking a min-max band,
// e.g. 20-30.
//
// Built from custom pointer-driven thumbs (same window pointermove/pointerup
// drag pattern as LineHandle above) rather than two overlapping native
// <input type="range"> elements -- the overlay trick (transparent track,
// pointer-events re-enabled only on ::-webkit-slider-thumb/::-moz-range-thumb)
// depends on browsers hit-testing those pseudo-elements independently of
// their parent's pointer-events, which doesn't hold up reliably everywhere
// and left both thumbs undraggable.
function ThresholdSlider({ min, max, step = 1, lo, hi, onChangeLo, onChangeHi, rangeEnabled, onToggleRange, showToggle = true }) {
  const trackRef = React.useRef(null);
  const draggingRef = React.useRef(null); // "lo" | "hi" | "single" | null
  const pct = (v) => ((v - min) / (max - min)) * 100;

  const valueFromClientX = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (max - min);
    return Math.min(max, Math.max(min, Math.round(raw / step) * step));
  };

  const handleMove = (e) => {
    if (!draggingRef.current) return;
    const v = valueFromClientX(e.clientX);
    if (draggingRef.current === "lo") onChangeLo(Math.min(v, hi));
    else if (draggingRef.current === "hi") onChangeHi(Math.max(v, lo));
    else onChangeLo(v);
  };
  const stopDrag = () => {
    draggingRef.current = null;
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", stopDrag);
  };
  const startDrag = (which, e) => {
    e.preventDefault();
    draggingRef.current = which;
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopDrag);
  };

  React.useEffect(() => stopDrag, []);

  // Clicking/tapping anywhere on the track jumps the nearest thumb there
  // and continues the drag from that point, matching a native range
  // input's click-to-jump behavior.
  const handleTrackPointerDown = (e) => {
    const v = valueFromClientX(e.clientX);
    if (!rangeEnabled) {
      onChangeLo(v);
      startDrag("single", e);
      return;
    }
    const which = Math.abs(v - lo) <= Math.abs(v - hi) ? "lo" : "hi";
    if (which === "lo") onChangeLo(Math.min(v, hi));
    else onChangeHi(Math.max(v, lo));
    startDrag(which, e);
  };

  const thumbStyle = (value) => ({
    position: "absolute", left: `${pct(value)}%`, top: "50%",
    transform: "translate(-50%, -50%)",
    width: 18, height: 18, borderRadius: "50%",
    background: "var(--amber)", border: "2px solid var(--accent-on)",
    boxShadow: "var(--shadow-2)", cursor: "pointer",
    touchAction: "none",
  });

  return (
    <div style={{ width: "100%" }}>
      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        style={{ position: "relative", height: 24, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}
      >
        <div
          style={{
            position: "absolute", left: 0, right: 0, height: 6, borderRadius: 3,
            background: rangeEnabled
              ? `linear-gradient(to right, var(--line) ${pct(lo)}%, var(--amber) ${pct(lo)}%, var(--amber) ${pct(hi)}%, var(--line) ${pct(hi)}%)`
              : `linear-gradient(to right, var(--amber) ${pct(lo)}%, var(--line) ${pct(lo)}%)`,
          }}
        />
        {rangeEnabled ? (
          <>
            <div onPointerDown={(e) => { e.stopPropagation(); startDrag("lo", e); }} style={thumbStyle(lo)} />
            <div onPointerDown={(e) => { e.stopPropagation(); startDrag("hi", e); }} style={thumbStyle(hi)} />
          </>
        ) : (
          <div onPointerDown={(e) => { e.stopPropagation(); startDrag("single", e); }} style={thumbStyle(lo)} />
        )}
      </div>
      {showToggle && (
        <div style={{ marginTop: 6 }}>
          <span className="chip" style={{ fontSize: 11, padding: "3px 10px" }} onClick={onToggleRange}>
            {rangeEnabled ? "Use single value" : "Use range"}
          </span>
        </div>
      )}
    </div>
  );
}

// Teammate chips: a horizontally scrolling row of compact tiles, each
// carrying a headshot, an availability badge, the player's name, and the
// difference this player's presence makes to the market being viewed.
//
// The row deliberately bleeds past its section's padding (negative inline
// margin, see TEAMMATE_ROW_BLEED) so the next chip is always clipped
// mid-tile at the right edge. That half-visible chip *is* the scroll
// affordance, which is what lets the arrows become floating overlays rather
// than two more boxes competing for the panel's width -- the previous
// version reserved ~72px of flow for a pair of chevrons plus a custom drag
// track, on a panel that had no width to spare.
//
// Selection reads as a solid fill across the whole tile rather than a border
// and a tint: at this size a 1px outline in a row of four is genuinely hard
// to spot, and "this one is excluded" should be legible at a glance.
//
// `chips` is the same {mlbId, name, mode} shape the rest of PropLedger
// already threads through to the with/without game-log filter.
// "Gunnar Henderson" -> "G. Henderson". A 92px tile fits roughly one word, so
// truncating the *first* name keeps the part that actually identifies someone
// on a roster, rather than ellipsising the surname away.
function shortenName(name) {
  const parts = String(name || "").trim().split(/\s+/);
  if (parts.length < 2) return name || "";
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

// Sized so roughly four chips sit in the panel's ~598px bleeding row with the
// fifth clipped, rather than to match the reference's own pixel dimensions --
// that panel is 235px wide, so copying its 60px tiles into a 620px popover
// would fit six and lose the "there's more, scroll" read entirely. The count
// on screen is the thing worth matching, not the tile size.
const TEAMMATE_CHIP_W = 132;
const TEAMMATE_CHIP_W_COMPACT = 104;
const TEAMMATE_CHIP_H = 112;
const TEAMMATE_CHIP_GAP = 8;
const TEAMMATE_ROW_BLEED = 16;

// Badge/dot palette by tone, shared by the chip badges and the status dots
// in the with/without dropdowns so an IL'd player looks the same in both.
const TEAMMATE_TONES = {
  out: { bg: "var(--red)", fg: "#ffffff", dot: "var(--red)" },
  warn: { bg: "#f0a92e", fg: "#1a1205", dot: "#f0a92e" },
  muted: { bg: "var(--surface-3)", fg: "var(--dim)", dot: "var(--dim)" },
};

function TeammateChipRow({ candidates, diffs, chips, onChange, loading, compact, onHover, statusFor }) {
  const scrollRef = React.useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const chipW = compact ? TEAMMATE_CHIP_W_COMPACT : TEAMMATE_CHIP_W;

  const modeFor = (mlbId) => (chips.find((c) => c.mlbId === mlbId) || {}).mode || "neutral";

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < maxScroll - 2);
  };

  // Measuring straight away reports scrollWidth === clientWidth, because the
  // chips' headshots haven't laid out yet -- which left the right-hand arrow
  // permanently hidden on a row that very much did scroll. A rAF catches the
  // settled layout, and the observer keeps the arrows honest when the panel
  // is resized or the popover swaps to the bottom sheet.
  React.useEffect(() => {
    // Measuring synchronously reports scrollWidth === clientWidth, because the
    // chips' headshots haven't laid out yet -- which left the right-hand arrow
    // permanently hidden on a row that very much did scroll. rAF catches the
    // settled layout in a visible tab; the timer is the fallback for when the
    // render loop isn't running (a backgrounded or non-compositing tab never
    // fires rAF or ResizeObserver at all). The observer then keeps the arrows
    // honest across resizes and the popover/bottom-sheet swap.
    const raf = requestAnimationFrame(updateScrollState);
    const timer = setTimeout(updateScrollState, 80);
    const el = scrollRef.current;
    const ro = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollState) : null;
    if (ro) ro.observe(el);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); if (ro) ro.disconnect(); };
  }, [candidates.length, chipW]);

  const scrollBy = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (chipW + TEAMMATE_CHIP_GAP) * 2, behavior: "smooth" });
  };

  // The current mode is read from `prev` inside the updater, not from the
  // `chips` prop outside it. Reading the prop meant two clicks landing in one
  // render both saw "neutral" and both appended, so a quick double-tap added
  // the same player to the filter twice.
  const cycle = (p) => {
    onChange((prev) => {
      const current = (prev.find((c) => c.mlbId === p.mlbId) || {}).mode || "neutral";
      if (current === "neutral") return [...prev, { mlbId: p.mlbId, name: p.name, mode: "with" }];
      if (current === "with") return prev.map((c) => (c.mlbId === p.mlbId ? { ...c, mode: "without" } : c));
      return prev.filter((c) => c.mlbId !== p.mlbId);
    });
  };

  // Solid fill when selected, no border at all -- the fill is the signal.
  // Neutral tiles are transparent rather than panel-coloured so the section
  // shading behind them shows through and does the grouping work.
  // Longhand backgroundColor/borderColor rather than the `background` and
  // `border` shorthands: React diffs inline styles per property, and swapping
  // a shorthand for a different shorthand between renders leaves the previous
  // one's expanded longhands behind instead of replacing them cleanly.
  const chipStyle = (mode) => {
    if (mode === "with") return { backgroundColor: "var(--green)", color: "#08131c", borderColor: "transparent" };
    if (mode === "without") return { backgroundColor: "var(--red)", color: "#ffffff", borderColor: "transparent" };
    return { backgroundColor: "transparent", color: "var(--text)", borderColor: "var(--line)" };
  };

  const arrowStyle = (side, visible) => ({
    position: "absolute", top: "50%", [side]: 0,
    transform: "translateY(-50%)",
    width: 26, height: 26, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "color-mix(in srgb, var(--surface-1) 82%, transparent)",
    backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
    border: "1px solid var(--line)", color: "var(--text)",
    fontSize: 13, lineHeight: 1, userSelect: "none", cursor: "pointer",
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    transition: "opacity .15s ease",
    zIndex: 2,
  });

  const fmtDiff = (d) => `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)}`;

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="teammate-scroll"
        style={{
          display: "flex", gap: TEAMMATE_CHIP_GAP, overflowX: "auto",
          overscrollBehaviorX: "contain",
          scrollSnapType: "x proximity",
          scrollPaddingLeft: TEAMMATE_ROW_BLEED,
          WebkitOverflowScrolling: "touch",
          paddingInline: TEAMMATE_ROW_BLEED,
          marginInline: -TEAMMATE_ROW_BLEED,
        }}
      >
        {candidates.map((p) => {
          const mode = modeFor(p.mlbId);
          const selected = mode !== "neutral";
          const diff = diffs[p.mlbId];
          const tone = p.badge ? TEAMMATE_TONES[p.badge.tone] : null;
          return (
            <div
              key={p.mlbId}
              role="button"
              aria-pressed={selected}
              title={
                mode === "neutral" ? `Only games ${p.name} played in`
                  : mode === "with" ? `Only games ${p.name} sat out`
                  : `Clear ${p.name}`
              }
              onClick={() => cycle(p)}
              onMouseEnter={() => onHover && onHover(p.mlbId)}
              onMouseLeave={() => onHover && onHover(null)}
              style={{
                flex: `0 0 ${chipW}px`, height: TEAMMATE_CHIP_H,
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "10px 6px 8px", borderRadius: 12,
                cursor: "pointer", userSelect: "none", boxSizing: "border-box",
                scrollSnapAlign: "start",
                borderWidth: 1, borderStyle: "solid",
                transition: "background-color .14s ease, border-color .14s ease",
                ...chipStyle(mode),
              }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                {/* An unavailable player is still worth showing (you can ask
                     "how did he do without this guy?"), just visibly demoted --
                     that is what `dimmed` does. No status dot here: the badge
                     just below already names the lineup state in words, and a
                     dot would say the same thing less precisely. */}
                <PlayerAvatar
                  name={p.name}
                  sport="mlb"
                  team={p.team}
                  colorMap={MLB_TEAM_COLORS}
                  headshotSrc={mlbHeadshot(p.mlbId)}
                  fallbackSrc={mlbEspnHeadshot(p.id)}
                  size={44}
                  inset={2}
                  status={statusFor && statusFor(p)}
                  surface="var(--surface-2)"
                  dimmed={!p.available}
                />
                {/* Overlaps the headshot's lower-right rather than sitting in
                     its own row -- positioned against the image wrapper so it
                     can't shift the tile's fixed internal rhythm. */}
                {tone && (
                  <span
                    style={{
                      position: "absolute", bottom: -5, right: -8,
                      padding: "1px 5px", borderRadius: 4,
                      fontSize: 8.5, fontWeight: 800, letterSpacing: "0.04em",
                      lineHeight: 1.45, whiteSpace: "nowrap",
                      background: tone.bg, color: tone.fg,
                      boxShadow: "0 0 0 1.5px var(--surface-2)",
                    }}
                  >
                    {p.badge.label}
                  </span>
                )}
              </div>
              <span
                className="oswald"
                style={{
                  marginTop: 7, fontSize: 12, fontWeight: 700, textAlign: "center",
                  maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {shortenName(p.name)}
              </span>
              <span
                className="mono"
                style={{
                  marginTop: 3, fontSize: selected ? 10.5 : 14, fontWeight: 800, lineHeight: 1.2,
                  letterSpacing: selected ? "0.06em" : 0,
                  color: selected
                    ? "inherit"
                    : diff === undefined ? "var(--dim)" : diff > 0 ? "var(--green)" : diff < 0 ? "var(--red)" : "var(--dim)",
                }}
              >
                {selected
                  ? (mode === "without" ? "W/O" : "WITH")
                  : loading ? "···" : diff === undefined ? "—" : fmtDiff(diff)}
              </span>
            </div>
          );
        })}
      </div>
      <div role="button" aria-label="Scroll teammates left" onClick={() => scrollBy(-1)} style={arrowStyle("left", canScrollLeft)}>‹</div>
      <div role="button" aria-label="Scroll teammates right" onClick={() => scrollBy(1)} style={arrowStyle("right", canScrollRight)}>›</div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Filters panel shell.
//
// Used by all four sports pages. It replaced an earlier component that laid
// every control out as a label-above-control column in one wrapped flex row,
// which had exactly one spacing value, one type level and one active state --
// so a new filter could only ever be another column in the same
// undifferentiated row. This is a vertical stack of sections whose grouping
// comes from surface shading and an intentionally uneven spacing rhythm (see
// the --fp-* scale in index.css), with a sticky header and footer so the
// count and the reset stay reachable while the body scrolls.
// ---------------------------------------------------------------------------
function FilterPanel({ activeCount = 0, onReset, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div
        style={{
          position: "sticky", top: 0, zIndex: 2,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "var(--s-2)", height: 48, padding: "0 var(--fp-pad-x)",
          background: "var(--surface-1)",
          // A shadow, not a border -- one less hard line in a panel whose
          // whole grouping story is soft.
          boxShadow: "0 1px 0 var(--line-subtle)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="oswald"
            style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text)" }}
          >
            Filters
          </span>
          {activeCount > 0 && <FilterCountBadge count={activeCount} />}
        </span>
        {activeCount > 0 && (
          <span
            role="button"
            onClick={onReset}
            className="oswald"
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              color: "var(--dim)", cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--amber)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--dim)"; }}
          >
            Reset all
          </span>
        )}
      </div>

      <div style={{ paddingTop: 4, paddingBottom: 6 }}>{children}</div>

      <div
        style={{
          position: "sticky", bottom: 0, zIndex: 2,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 44, padding: "0 var(--fp-pad-x)",
          background: "var(--surface-1)",
          boxShadow: "0 -1px 0 var(--line-subtle)",
        }}
      >
        <span className="micro-label" style={{ fontSize: 10 }}>
          {activeCount > 0 ? `${activeCount} active` : "No filters"}
        </span>
        <span
          role="button"
          onClick={onReset}
          className="oswald"
          style={{
            fontSize: 11, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase",
            color: activeCount > 0 ? "var(--text-2)" : "var(--dim)",
            opacity: activeCount > 0 ? 1 : 0.5,
            cursor: activeCount > 0 ? "pointer" : "default",
          }}
        >
          Reset all
        </span>
      </div>
    </div>
  );
}

// Trigger button plus the popover (desktop) / bottom sheet (mobile) it opens,
// with click-outside, Escape and body-scroll-lock handling. Extracted from
// the MLB page so all four sports pages get the same chrome and the same
// dismissal behaviour instead of each hand-rolling it.
//
// `anchored` positions the trigger absolutely in the top-right of whatever
// relatively-positioned card wraps it (MLB's graph card); pages that place
// the launcher in normal flow pass it false.
function FilterPanelLauncher({ open, onOpenChange, activeCount = 0, compact, anchored = true, children }) {
  const panelRef = React.useRef(null);
  // Tracks whether we're the one who pushed the dummy history entry below,
  // so requestClose() and the cleanup in the history effect never both try
  // to consume it.
  const pushedHistoryRef = React.useRef(false);

  // Every explicit close path (button re-tap, backdrop tap, outside click,
  // Escape) routes through here instead of calling onOpenChange(false)
  // directly, so it also consumes the history entry the effect below pushed
  // -- keeping the browser's back stack and filtersOpen in sync no matter
  // which path closed it. See that effect for why this exists at all.
  const requestClose = () => {
    if (pushedHistoryRef.current) window.history.back();
    else onOpenChange(false);
  };

  React.useEffect(() => {
    if (!open) return;
    // The mobile sheet covers the viewport -- stop the page underneath from
    // scrolling along with it.
    if (compact) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prevOverflow; };
    }
    const handlePointerDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) requestClose();
    };
    const handleKeyDown = (e) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, compact]);

  // Claims one same-document history entry for as long as the panel is
  // open, so a native back gesture (hardware back button, edge-swipe) closes
  // just the panel instead of falling through to the browser/webview --
  // which, since this app never otherwise touches history, would navigate
  // away from the whole SPA and reload it back to its default ("Prop Feed")
  // state, losing whatever player/tab the user had open.
  React.useEffect(() => {
    if (!open) return;
    // Idempotent on purpose: React (StrictMode in dev) can run this setup,
    // its cleanup, and this setup again for a single logical open, and
    // pushing twice would leave an orphaned entry neither requestClose nor a
    // real back gesture would ever consume. Skipping the push when we're
    // already sitting on our own dummy entry keeps exactly one on the stack
    // no matter how many times setup re-runs.
    if (!(window.history.state && window.history.state.filterPanel)) {
      window.history.pushState({ filterPanel: true }, "");
    }
    pushedHistoryRef.current = true;
    const handlePopState = () => {
      pushedHistoryRef.current = false;
      onOpenChange(false);
    };
    window.addEventListener("popstate", handlePopState);
    // Deliberately does NOT call history.back() here: cleanup must stay a
    // pure "undo the listener" step. Calling back() (an async, real
    // navigation) from a cleanup breaks under StrictMode's double-invoke --
    // the practice teardown would fire a real popstate that closes the panel
    // right after it opens. Consuming the dummy entry only happens through
    // requestClose (explicit close) or an actual user back gesture.
    return () => {
      window.removeEventListener("popstate", handlePopState);
      pushedHistoryRef.current = false;
    };
  }, [open, onOpenChange]);

  const wrapperStyle = anchored
    ? { position: "absolute", top: compact ? 10 : 14, right: compact ? 10 : 14, zIndex: 6 }
    : { position: "relative", display: "flex", justifyContent: "flex-end", marginBottom: "var(--s-3)" };

  return (
    <>
      <div ref={panelRef} style={wrapperStyle}>
        <button
          type="button"
          className="oswald"
          onClick={() => (open ? requestClose() : onOpenChange(true))}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            cursor: "pointer", padding: "6px 10px 6px 12px", borderRadius: 999,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
            // Border goes accent whenever filters are on, open or not -- the
            // panel being closed is exactly when you need to be told.
            border: `1px solid ${open || activeCount ? "var(--amber)" : "var(--line)"}`,
            background: open ? "var(--amber-dim)" : "var(--panel2)",
            color: open || activeCount ? "var(--amber)" : "var(--dim)",
          }}
        >
          Filters
          {activeCount > 0 && <FilterCountBadge count={activeCount} size={16} />}
        </button>
        {open && !compact && (
          <div
            style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 6,
              width: "min(620px, 92vw)", maxHeight: "min(78vh, 620px)", overflowY: "auto",
              background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 14,
              boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
              textAlign: "left",
            }}
          >
            {children}
          </div>
        )}
      </div>
      {open && compact && (
        <>
          <div
            onClick={requestClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 3500 }}
          />
          {/* Bottom sheet -- capped and internally scrollable so every filter
               stays reachable no matter how tall the content gets. */}
          <div
            style={{
              position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 3501,
              maxHeight: "85vh", overflowY: "auto",
              background: "var(--surface-1)", border: "1px solid var(--line)", borderBottom: "none",
              borderRadius: "16px 16px 0 0", boxShadow: "0 -12px 32px rgba(0,0,0,0.5)",
              paddingBottom: "max(12px, env(safe-area-inset-bottom))",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--line-strong)" }} />
            </div>
            {children}
          </div>
        </>
      )}
    </>
  );
}

function FilterCountBadge({ count, size = 18 }) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: size, height: size, padding: "0 5px", borderRadius: 999,
        background: "var(--amber)", color: "var(--accent-on)",
        fontSize: 10, fontWeight: 800, lineHeight: 1,
      }}
    >
      {count}
    </span>
  );
}

// The sample-size selector: one equal-width cell per window, each showing its
// own hit rate. Takes the array from buildHitRateSplits so every page's cells
// come from the same computation.
function SampleSizeGrid({ cells }) {
  return (
    <div className={`fp-splits${cells.length === 6 ? " fp-splits--6" : ""}`}>
      {cells.map((s) => (
        <div
          key={s.key}
          role="button"
          aria-disabled={s.disabled || undefined}
          title={s.disabled ? "No scheduled game to compare against yet" : undefined}
          onClick={s.disabled ? undefined : s.onClick}
          className={`fp-split-cell ${s.active ? "active" : ""}`}
        >
          <div
            className="oswald"
            style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
              color: s.active ? "var(--accent-on)" : "var(--dim)",
            }}
          >
            {s.label}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 14, fontWeight: 700, lineHeight: 1.25, marginTop: 1,
              color: s.active ? "var(--accent-on)" : hitRateColor(s.rate),
            }}
          >
            {s.rate === null ? "—" : `${Math.round(s.rate * 100)}%`}
          </div>
        </div>
      ))}
    </div>
  );
}

// The games-count slider that sits under the sample-size grid.
function SampleSizeSlider({ total, lastN, onSetLastN }) {
  const cap = Math.max(total, 1);
  const value = lastN === "all" ? cap : Math.min(lastN, cap);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ThresholdSlider
          min={1}
          max={cap}
          step={1}
          lo={value}
          hi={value}
          onChangeLo={onSetLastN}
          rangeEnabled={false}
          showToggle={false}
        />
      </div>
      <span className="mono" style={{ fontSize: 11.5, color: "var(--dim)", flexShrink: 0 }}>
        {lastN === "all" ? `All (${cap})` : `${value} games`}
      </span>
    </div>
  );
}

function FilterSection({ title, action, shaded, children }) {
  return (
    <div className={shaded ? "fp-section fp-section--shaded" : "fp-section"}>
      {(title || action) && (
        <div className="fp-section-head">
          {title ? <span className="fp-section-title">{title}</span> : <span />}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// Searchable "Games with player" / "Games without player" list, grouped by
// teammates vs opponents with a status dot per row (Outlier's pattern). It
// reads and writes the same teammateChips array the chip row above does, so
// the two controls are alternate front ends onto one filter rather than two
// filters that have to agree.
function PlayerScopeSelect({ teammates, opponents, chips, onChange, oppLabel, statusFor }) {
  const [tab, setTab] = useState("with");
  const [query, setQuery] = useState("");

  const modeFor = (mlbId) => (chips.find((c) => c.mlbId === mlbId) || {}).mode || "neutral";

  // Same functional-update discipline as TeammateChipRow's cycle: derive the
  // current mode from `prev` so rapid clicks can't both act on a stale read.
  const toggle = (p) => {
    onChange((prev) => {
      const current = (prev.find((c) => c.mlbId === p.mlbId) || {}).mode || "neutral";
      if (current === tab) return prev.filter((c) => c.mlbId !== p.mlbId);
      if (current === "neutral") return [...prev, { mlbId: p.mlbId, name: p.name, mode: tab }];
      return prev.map((c) => (c.mlbId === p.mlbId ? { ...c, mode: tab } : c));
    });
  };

  const q = query.trim().toLowerCase();
  const match = (list) => (q ? list.filter((p) => p.name.toLowerCase().includes(q)) : list);
  const groups = [
    { key: "teammates", label: "Teammates", players: match(teammates) },
    { key: "opponents", label: oppLabel ? `${oppLabel} / Opponents` : "Opponents", players: match(opponents) },
  ].filter((g) => g.players.length);

  const tabStyle = (key) => ({
    fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    color: tab === key ? "var(--text)" : "var(--dim)",
    paddingBottom: 7, cursor: "pointer", userSelect: "none",
    boxShadow: tab === key ? "inset 0 -2px 0 var(--amber)" : "none",
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 18, borderBottom: "1px solid var(--line-subtle)", marginBottom: 12 }}>
        <span role="button" onClick={() => setTab("with")} style={tabStyle("with")}>With player</span>
        <span role="button" onClick={() => setTab("without")} style={tabStyle("without")}>Without player</span>
      </div>

      <div style={{ position: "relative" }}>
        <span
          aria-hidden
          style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            fontSize: 12, color: "var(--dim)", pointerEvents: "none", lineHeight: 1,
          }}
        >
          ⌕
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players…"
          style={{
            width: "100%", height: 32, boxSizing: "border-box",
            borderRadius: 8, border: "1px solid var(--line)",
            background: "var(--surface-sunken)", color: "var(--text)",
            paddingLeft: 30, paddingRight: 10, fontSize: 12, outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>

      <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 10 }}>
        {!groups.length && (
          <div className="mono" style={{ fontSize: 11, color: "var(--dim)", padding: "10px 4px" }}>
            No players match “{query}”.
          </div>
        )}
        {groups.map((g) => (
          <div key={g.key}>
            {/* Group header runs a hairline out to the right edge rather than
                 boxing the group -- same job as Outlier's hatched rule. */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0 4px" }}>
              <span
                className="oswald"
                style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--dim)" }}
              >
                {g.label}
              </span>
              <span style={{ flex: 1, height: 1, background: "var(--line-subtle)" }} />
            </div>
            {g.players.map((p) => {
              const mode = modeFor(p.mlbId);
              const checked = mode === tab;
              const tone = p.badge ? TEAMMATE_TONES[p.badge.tone] : null;
              return (
                <div key={p.mlbId} role="button" aria-pressed={checked} onClick={() => toggle(p)} className="fp-player-row">
                  <PlayerAvatar
                    name={p.name}
                    sport="mlb"
                    team={p.team}
                    colorMap={MLB_TEAM_COLORS}
                    headshotSrc={mlbHeadshot(p.mlbId)}
                    fallbackSrc={mlbEspnHeadshot(p.id)}
                    size={22}
                    inset={1}
                    status={statusFor && statusFor(p)}
                    surface="var(--panel)"
                  />
                  <span style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span
                      style={{
                        fontSize: 12, fontWeight: 600, color: "var(--text)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}
                    >
                      {p.name}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--dim)", flexShrink: 0 }}>{p.pos}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {tone && (
                      <>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--dim)", whiteSpace: "nowrap" }}>
                          {p.badge.label}
                        </span>
                      </>
                    )}
                  </span>
                  <span
                    style={{
                      width: 16, height: 16, borderRadius: 4, boxSizing: "border-box",
                      border: `1.5px solid ${checked ? "transparent" : "var(--line)"}`,
                      background: checked ? "var(--amber)" : "transparent",
                      color: "var(--accent-on)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 900, lineHeight: 1,
                    }}
                  >
                    {checked ? "✓" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}


// Generic disclosure used to hide long-but-secondary content (the game log
// table today) behind a "▸ Title" header instead of it always taking up
// space. Open/closed state is persisted to sessionStorage per storageKey so
// it survives re-renders (player/market switches) but resets on a fresh tab,
// matching the other session-scoped caches in this file (mlb_day_slate_v1
// etc.).
function CollapsibleSection({ title, storageKey, defaultOpen = false, children }) {
  const [open, setOpen] = useState(() => {
    if (!storageKey) return defaultOpen;
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored === null ? defaultOpen : stored === "1";
    } catch {
      return defaultOpen;
    }
  });

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (storageKey) {
        try { sessionStorage.setItem(storageKey, next ? "1" : "0"); } catch {}
      }
      return next;
    });
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div
        onClick={toggle}
        className="oswald"
        role="button"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: "var(--s-2)", cursor: "pointer", userSelect: "none",
          fontSize: 13, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--dim)",
          padding: "4px 0",
        }}
      >
        <span
          className="mono"
          style={{
            color: "var(--amber)", fontSize: 11, display: "inline-block",
            transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .15s ease",
          }}
        >
          ▸
        </span>
        {title}
      </div>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

// L5/L10/L15/L20/L25/season/H2H hit-rate splits, doubling as the sample-size
// selector -- originally two separate controls (a read-only splits
// scoreboard, plus a plain chip row + slider that actually set the window).
// Merged into one: every pill already showed a real hit-rate percentage, so
// there was no reason the *selector* itself couldn't just be that same pill
// style, extended to cover the two windows (L15/L25) that used to only exist
// on the plain chip row. Splits are always computed off the player's full
// game log (not the graph's own side/PA/teammate-filtered `filtered` array),
// so they read as a fixed, independent scoreboard no matter what the chart
// above is currently zoomed into. `max` is the largest sample actually
// available, so the slider (and "All"'s real count) always tracks the
// player's real game log instead of an arbitrary fixed ceiling.
// The L5..L25/Season/H2H split math, extracted so the always-visible splits
// row under the chart and the compact selector inside the Filters panel are
// two presentations of one computation rather than two mounted copies of the
// same component (which is what the panel used to do -- a second full
// HitRateSplits, own slider and all, duplicating the one below the chart).
// `includeH2h` is opt-out for pages that have no single "next opponent" to
// compare against -- WNBA picks an opponent from a dropdown instead, so a H2H
// cell there would be permanently disabled rather than merely unavailable.
function buildHitRateSplits({ allGames, statValue, effectiveLine, lastN, onSetLastN, h2h, onSetH2h, opponentAbbr, shortLabels, includeH2h = true }) {
  const rate = (games) => {
    if (!games.length) return null;
    const vals = games.map(statValue);
    return vals.filter((v) => v > effectiveLine).length / vals.length;
  };
  const h2hGames = opponentAbbr ? allGames.filter((g) => g.opp === opponentAbbr) : [];
  return [
    ...[5, 10, 15, 20, 25].map((n) => ({
      key: `l${n}`, label: `L${n}`, active: !h2h && lastN === n,
      rate: rate(allGames.slice(-n)),
      onClick: () => { onSetH2h(false); onSetLastN(n); },
    })),
    { key: "season", label: shortLabels ? "SZN" : "Season", active: !h2h && lastN === "all", rate: rate(allGames), onClick: () => { onSetH2h(false); onSetLastN("all"); } },
    ...(includeH2h ? [{
      key: "h2h",
      label: !shortLabels && opponentAbbr ? `H2H vs ${opponentAbbr}` : "H2H",
      active: h2h, rate: rate(h2hGames),
      onClick: () => opponentAbbr && onSetH2h(true), disabled: !opponentAbbr,
    }] : []),
  ];
}

function hitRateColor(r) {
  if (r === null) return "var(--dim)";
  if (r >= 0.6) return "var(--green)";
  if (r <= 0.4) return "var(--red)";
  return "var(--text)";
}

// `includeH2h` is passed straight through to buildHitRateSplits: pages with no
// head-to-head filter of their own opt out so the cell isn't rendered
// permanently disabled. Defaults to true, so existing callers are unaffected.
function HitRateSplits({ allGames, statValue, effectiveLine, lastN, onSetLastN, h2h, onSetH2h, opponentAbbr, isNarrow, max, includeH2h = true }) {
  const splits = buildHitRateSplits({ allGames, statValue, effectiveLine, lastN, onSetLastN, h2h, onSetH2h, opponentAbbr, shortLabels: isNarrow, includeH2h });
  const rateColor = hitRateColor;
  const cappedMax = Math.max(max, 1);
  const sliderValue = lastN === "all" ? cappedMax : Math.min(lastN, cappedMax);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", gap: isNarrow ? 8 : 14, flexWrap: "wrap", padding: isNarrow ? "0 12px 10px" : "0 20px 10px" }}>
        {splits.map((s) => (
          <div
            key={s.key}
            onClick={s.disabled ? undefined : s.onClick}
            role="button"
            title={s.disabled ? "No scheduled game to compare against yet" : undefined}
            style={{
              textAlign: "center", cursor: s.disabled ? "not-allowed" : "pointer",
              opacity: s.disabled ? 0.4 : 1,
              padding: "2px 6px", borderRadius: 6,
              border: `1px solid ${s.active ? "var(--amber)" : "transparent"}`,
              background: s.active ? "var(--amber-dim)" : "transparent",
            }}
          >
            <div className="micro-label" style={{ fontSize: isNarrow ? 9.5 : 10.5, color: s.active ? "var(--amber-ink)" : "var(--dim)" }}>
              {s.label}
            </div>
            <div className="mono stat-value" style={{ fontSize: isNarrow ? 13 : 14.5, color: rateColor(s.rate) }}>
              {s.rate === null ? "—" : `${Math.round(s.rate * 100)}%`}
            </div>
          </div>
        ))}
      </div>
      {/* Labelled and width-contained rather than an edge-to-edge bare
           track: this slider and the L5/L10/... cells above are two faces of
           the same `lastN` state (dragging to 15 lights up L15; clicking L20
           moves the thumb), which a full-width unlabelled bar sitting under
           the pills gave no way to guess. "Sample size" is the term the
           Filters panel already uses for this exact control -- see
           FilterSection title="Sample size" / SampleSizeGrid /
           SampleSizeSlider. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: isNarrow ? "0 12px 14px" : "0 20px 16px" }}>
        <span className="micro-label" style={{ fontSize: 10, flexShrink: 0 }}>
          Sample size
        </span>
        {/* Grows to fill what the label and value leave, but capped so it
             stays a contained control rather than the old edge-to-edge bar.
             The cap (not a fixed width) is what keeps it from overflowing on
             a 320px phone, where there isn't room for the full 150. */}
        <div style={{ flex: "1 1 auto", maxWidth: isNarrow ? 150 : 220, minWidth: 80 }}>
          <ThresholdSlider
            min={1}
            max={cappedMax}
            step={1}
            lo={sliderValue}
            hi={sliderValue}
            onChangeLo={(v) => { onSetH2h(false); onSetLastN(v); }}
            rangeEnabled={false}
            showToggle={false}
          />
        </div>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--dim)", flexShrink: 0 }}>
          {lastN === "all" ? `All (${cappedMax})` : `${sliderValue} games`}
        </span>
      </div>
      {/* The percentages above are deliberately computed off the full game
           log, not the chart's filtered view (see this component's header
           comment) -- without saying so, an L10 pill reading 60% next to a
           chart showing three teammate-filtered games looks like a bug. */}
      <div style={{ textAlign: "center", padding: isNarrow ? "0 12px 10px" : "0 20px 12px" }}>
        <span className="micro-label" style={{ fontSize: 9, letterSpacing: "0.07em" }}>
          Sample size sets the games in the graph · hit rates vs full log
        </span>
      </div>
    </div>
  );
}

// Bar value label, anchored near the bottom of each bar rather than
// recharts' default top-of-bar placement — reads as a stamped-in number
// rather than a floating annotation. Rendered bold white with a dark
// outline (stroke + paintOrder) rather than a solid fill color so it stays
// legible against both the green/red bar fills, even when the bar is
// narrow enough that the digits spill slightly past its edges.
function BarValueLabel({ x, y, width, height, value, isBinary, payload }) {
  // Every bar's label sits at the same height (10px above the shared
  // baseline, not floating above each bar's own peak), so once bars get
  // thin -- a bigger sample size, or a narrow phone -- adjacent numbers
  // would run into each other. Sizing off bar width alone wasn't enough:
  // a 17-game NFL season on a phone leaves ~16px bars, which cleared the
  // old 10px floor even though three monospace digits need ~18px there,
  // so the numbers ran together. Measuring the actual text instead --
  // digit count against available width -- picks the largest size that
  // genuinely fits and drops the label when even the smallest won't,
  // which stays correct at any sample size or screen width. Hidden values
  // are still readable by tapping the bar (see ChartTooltip).
  if (value == null || height < 14 || width < 9) return null;
  if (isBinary && value !== 1) return null;
  const text = payload?.isPlaceholder ? "?" : (isBinary ? "✓" : String(value));
  // JetBrains Mono advances ~0.6em per glyph; the 2px slack keeps adjacent
  // labels from touching rather than merely not overlapping.
  const fits = (size) => text.length * size * 0.6 <= width - 2;
  const fontSize = [14, 12, 10, 9].find(fits);
  if (fontSize === undefined) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height - 10}
      textAnchor="middle"
      className="mono"
      fontSize={fontSize}
      fontWeight={800}
      fill="#ffffff"
      stroke="rgba(0,0,0,0.55)"
      strokeWidth={2.5}
      paintOrder="stroke"
    >
      {text}
    </text>
  );
}

// True on narrow (phone-width) viewports, kept in sync via matchMedia so
// charts can thin out their x-axis (fewer ticks, smaller team logos)
// instead of the fixed-size ticks overlapping each other once there's only
// ~20-30px of bar width to work with.
function useIsNarrow(breakpoint = 480) {
  const [isNarrow, setIsNarrow] = React.useState(
    typeof window !== "undefined" && window.innerWidth <= breakpoint
  );
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsNarrow(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isNarrow;
}

// Measures a DOM element's width live via ResizeObserver, so charts can size
// their tick count to how much horizontal room they actually have rather
// than a fixed guess -- a wide desktop panel can fit far more than 20
// per-game logos before they'd overlap, and shrinking the browser (or a
// tablet-width layout) needs fewer than that.
function useElementWidth(ref) {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

// Same idea for height, for stacking one sticky element beneath another:
// the Prop Feed's table header pins below its filter rail, and the rail's
// height isn't a constant to hardcode -- it wraps onto a second (or third)
// line as the window narrows, and grows once a sport's Games multi-select
// has real games in it.
//
// Belt and braces on purpose, because being stale here isn't cosmetic: too
// small a value tucks the pinned header underneath the opaque rail. The
// ResizeObserver catches content-driven growth, but its callbacks are
// delivered in the frame loop, so a window that isn't compositing can sit
// on one indefinitely; the resize listener is a plain event and fires
// regardless. Math.ceil because a fractional height would round down into
// a 1px overlap.
function useElementHeight(ref) {
  const [height, setHeight] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setHeight(Math.ceil(el.getBoundingClientRect().height));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    // Web fonts landing after first paint reflow the rail's controls.
    if (document.fonts?.ready) document.fonts.ready.then(update).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [ref]);
  return height;
}

// How many px each per-game logo+abbreviation+date tick needs to avoid
// overlapping its neighbors -- used to derive how many ticks actually fit
// in the measured chart width, instead of a fixed tick-count cap. Compact
// (narrow-screen) ticks are smaller text/logos, so they pack tighter.
// `full` is tuned to TeamAxisTick's 18px desktop logo (see there).
const TICK_SLOT_WIDTH = { compact: 34, full: 46 };

// Skips ticks so only as many per-game logos render as actually fit the
// measured chart width -- "All" on a full MLB season can be 80+ games, which
// would render every single logo/abbreviation crammed on top of each other
// without this, but a wide desktop panel can still comfortably fit well
// beyond the old fixed 20-tick cap this replaces. recharts' XAxis `interval`
// is a skip-count, not a target tick count, so it's derived from gameCount
// here. Falls back to a conservative 20 before the container has been
// measured (width === 0, e.g. first paint).
//
// `containerWidth` is the whole chart box's measured width (its clientWidth,
// which -- per the CSS box model -- includes that box's own left/right
// padding), but ticks only ever render across the plot area: the box minus
// its own horizontal padding, minus the YAxis's own width, minus the
// chart's left/right margins (see the `padding`/`margin`/`YAxis width`
// props at each call site, mirrored here). Feeding the raw container width
// in used to over-count available room by up to ~170px on desktop, which is
// what let ticks get packed tighter than they actually fit.
function axisTickInterval(gameCount, isNarrow, containerWidth) {
  const slot = isNarrow ? TICK_SLOT_WIDTH.compact : TICK_SLOT_WIDTH.full;
  const containerPaddingLR = isNarrow ? 12 : 32; // left+right padding of the chart box itself
  const yAxisWidth = isNarrow ? 24 : 60;
  const chartMarginLR = isNarrow ? 30 : 80; // right(30/60) + left(0/20)
  const plotWidth = containerWidth > 0 ? Math.max(0, containerWidth - containerPaddingLR - yAxisWidth - chartMarginLR) : 0;
  const maxTicks = plotWidth > 0 ? Math.max(1, Math.floor(plotWidth / slot)) : 20;
  return Math.max(0, Math.ceil(gameCount / maxTicks) - 1);
}

// Shared "Jul 16" style formatter for axis date labels.
function formatAxisDate(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Custom chart tooltip — replaces recharts' plain default box with a small
// card that matches the app's own styling and surfaces the info that
// actually matters for a prop-research read: result vs. the line, date,
// minutes played, and the opponent's defensive rank/tier.
// Custom x-axis tick: team logo, abbreviation, and date stacked in place of
// the plain game-index number recharts would otherwise render. `compact`
// shrinks everything for narrow screens (see useIsNarrow) so a full sample
// of per-game logos still fits across the width without overlapping. Reads
// both the abbreviation and date off a single combined dataKey ("opp__date")
// rather than indexing a separate games array by `index` -- recharts' tick
// `index` isn't reliably the original data index once ticks are skipped, so
// packing both values into the one value recharts already hands back is
// the only lookup that stays correct under any interval.
function TeamAxisTick({ x, y, payload, logoFn, compact }) {
  const [abbr, dateStr] = payload.value.split("__");
  // Desktop logo shrunk from 28 -> 18px (PropsMadness reference uses a
  // small ~16px mark): smaller footprint per tick means more ticks fit
  // before axisTickInterval has to start skipping, and it relieves the
  // logo/abbreviation/date collision that showed up once the graph's
  // measured width was smaller than expected (see the ResizeObserver
  // fix above).
  const size = compact ? 14 : 18;
  return (
    <g transform={`translate(${x},${y})`}>
      <image href={logoFn(abbr)} x={-size / 2} y={4} width={size} height={size} />
      <text x={0} y={compact ? 24 : 34} textAnchor="middle" fill="var(--chart-ink)" fontSize={compact ? 8 : 11} fontWeight={600}>
        {abbr}
      </text>
      <text x={0} y={compact ? 35 : 47} textAnchor="middle" fill="var(--chart-ink-dim)" fontSize={compact ? 7 : 10} fontWeight={500}>
        {formatAxisDate(dateStr)}
      </text>
    </g>
  );
}

// Plain date label, no logo -- used in place of TeamAxisTick once a sample
// has too many games for a per-game logo/abbreviation to stay legible on a
// narrow (phone-width) screen. Reads the date straight off `payload.value`
// (the chart's dataKey must be "date" for this tick).
function DateAxisTick({ x, y, payload, compact }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={compact ? 18 : 20} textAnchor="middle" fill="var(--chart-ink)" fontSize={compact ? 10 : 12} fontWeight={600}>
        {formatAxisDate(payload.value)}
      </text>
    </g>
  );
}

function ChartTooltip({ active, payload, effectiveLine, isBinary, marketLabel, footerLabel = (d) => `${d.minutes} min played`, logoFn }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const over = isBinary ? d.value === 1 : d.value > effectiveLine;
  const push = !isBinary && d.value === effectiveLine;
  const tier = defTier(d.defRank);
  const resultLabel = isBinary ? (d.value === 1 ? "YES" : "NO") : push ? "PUSH" : over ? "OVER" : "UNDER";
  const resultColor = push ? "var(--dim)" : over ? "var(--green)" : "var(--red)";
  const tierColor = tier === "soft" ? "var(--green)" : tier === "tough" ? "var(--red)" : "var(--dim)";

  return (
    <div
      style={{
        background: "var(--panel2)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        minWidth: 230,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        overflow: "hidden",
      }}
    >
      {/* Header: opponent + game meta */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", borderBottom: "1px solid var(--line)", background: "rgba(255,255,255,0.02)",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {logoFn && <img src={logoFn(d.opp)} alt={d.opp} width={18} height={18} style={{ objectFit: "contain" }} />}
          <span className="oswald" style={{ fontSize: 13, letterSpacing: "0.03em", color: "var(--text)" }}>
            {d.home ? "vs" : "@"} {d.opp}
          </span>
        </span>
        <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: "0.02em" }}>
          {new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
        </span>
      </div>

      {/* Body: big value + result badge */}
      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {marketLabel}
          </div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: resultColor, lineHeight: 1.2 }}>
            {isBinary ? d.value : d.value}
            {!isBinary && (
              <span style={{ fontSize: 12, color: "var(--dim)", fontWeight: 500 }}> / {effectiveLine}</span>
            )}
          </div>
        </div>
        <span className="mono" style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
          padding: "4px 9px", borderRadius: 4,
          color: resultColor, border: `1px solid ${resultColor}`, background: `${resultColor}1a`,
        }}>
          {resultLabel}
        </span>
      </div>

      {/* Footer: minutes + opponent defense context */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        padding: "7px 12px", borderTop: "1px solid var(--line)", fontSize: 10.5,
      }}>
        <span style={{ color: "var(--dim)", whiteSpace: "nowrap" }}>{footerLabel(d)}</span>
        <span className="mono" style={{ color: tierColor, fontWeight: 600, whiteSpace: "nowrap" }}>
          #{d.defRank} def{tier === "soft" ? " · soft" : tier === "tough" ? " · tough" : ""}
        </span>
      </div>
    </div>
  );
}

// Renders a wrapping row of market pills separated by "|" -- but only
// between two pills that land on the same visual line. Grouping separator+
// pill into one flex unit (see NFLPropsPage) stops a lone "|" from floating
// at a mismatched height, but it can still open a wrapped line with nothing
// to its left to separate from, which reads as a stray mark next to a
// single word. This measures each pill's actual offsetTop after layout (and
// re-measures on resize/content change) so a separator only renders when
// the previous pill really is its same-line neighbor.
function MarketPillRow({ markets, activeMarket, onSelect }) {
  const containerRef = React.useRef(null);
  const itemRefs = React.useRef([]);
  const [sameLineAsPrev, setSameLineAsPrev] = React.useState([]);

  const measure = React.useCallback(() => {
    const tops = itemRefs.current.map((el) => (el ? el.offsetTop : null));
    setSameLineAsPrev(tops.map((t, i) => i > 0 && t != null && t === tops[i - 1]));
  }, []);

  React.useLayoutEffect(() => {
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure, markets]);

  return (
    <div ref={containerRef} style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      {markets.map((m, mi) => (
        <div key={m.id} ref={(el) => (itemRefs.current[mi] = el)} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {mi > 0 && (
            <span style={{ color: "var(--line)", fontSize: 20, visibility: sameLineAsPrev[mi] ? "visible" : "hidden" }}>|</span>
          )}
          <div
            className={`tab no-underline ${activeMarket === m.id ? "active" : ""}`}
            style={{ flex: "0 0 auto", width: "auto", padding: "10px 16px", fontSize: 20 }}
            onClick={() => onSelect(m.id)}
          >
            {m.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// Shared "NBA-style" categorized market picker -- a row of section labels
// (Core / Combos / Shooting / etc.), each with its own group of tabs, instead
// of one flat "Markets" list. `sections` is [{ label, markets, pills? }];
// sections with no markets (e.g. a Kicking section for a non-kicker) are
// skipped entirely rather than rendered empty.
//
// `singleBar` collapses every section into one wrapping row separated by
// hairline rules rather than a heading and its own row per section, which
// saves the height of each heading. Pills sections (milestone markets like
// Double-Double/Anytime TD) render as plain tabs in the bar too, same as
// every other market -- the point of this mode is one consistent row, not
// a mix of tab styles.
function MarketSectionGrid({ sections, activeMarket, onSelect, isNarrow, singleBar }) {
  const visible = sections.filter((s) => s.markets.length > 0);

  if (singleBar) {
    return (
      <div className="market-bar">
        {visible.map((section) => (
          <React.Fragment key={section.label}>
            {/* No section divider here on purpose. A divider is just another
                 flex item, so in this wrapping row it wrapped like one --
                 landing at the end of a line, or leading one, with no tab
                 beside it to separate. The grouping it signalled isn't worth
                 the arbitrary marks; `title` below still carries it. */}
            {section.markets.map((m) => (
              <div
                key={m.id}
                className={`tab ${activeMarket === m.id ? "active" : ""}`}
                // The category name is no longer on screen, so keep it as a
                // tooltip -- the grouping is still discoverable on hover.
                title={section.label}
                onClick={() => onSelect(m.id)}
              >
                {m.label}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <>
      {visible.map((section, si) => (
        <div key={section.label} style={{ marginTop: si === 0 ? 0 : 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, textAlign: "center" }}>
            {section.label}
          </div>
          {section.pills ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, flexWrap: "nowrap" }}>
              {section.markets.map((m) => (
                <React.Fragment key={m.id}>
                  <div
                    className="oswald"
                    style={{
                      fontSize: isNarrow ? 15.5 : 18, fontWeight: 600, letterSpacing: "0.03em", padding: "6px 4px",
                      color: activeMarket === m.id ? "var(--amber)" : "var(--dim)", cursor: "pointer", whiteSpace: "nowrap",
                    }}
                    onClick={() => onSelect(m.id)}
                  >
                    {m.label}
                  </div>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 28 }}>
              {section.markets.map((m) => (
                <div
                  key={m.id}
                  className={`tab ${si === 0 ? "no-underline" : ""} ${activeMarket === m.id ? "active" : ""}`}
                  style={{ flex: "0 0 auto", width: "auto" }}
                  onClick={() => onSelect(m.id)}
                >
                  {m.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// Signed, colored delta between a filtered-window stat and its season
// baseline, for the two-line cells in SampleStatsRow. `higherIsBetter` is
// null for pure volume stats (attempts, targets) where neither direction is
// good or bad on its own -- those render dim rather than green/red.
// The rounding matters: a +0.004 diff displayed as "+0.00" must not be
// colored green, so the color reads from the value at display precision.
function fmtStatDelta(diff, decimals, higherIsBetter, suffix = "") {
  const sign = diff < 0 ? "-" : "+";
  const text = `${sign}${Math.abs(diff).toFixed(decimals)}${suffix}`;
  const rounded = parseFloat(diff.toFixed(decimals));
  const color = rounded === 0 || higherIsBetter === null
    ? "var(--dim)"
    : (rounded > 0) === higherIsBetter ? "var(--green)" : "var(--red)";
  return { text, color };
}

// Full-width single-line game-info strip at the top of a page's graph card:
// date/time/opponent/venue on the left, a sport-specific context badge on
// the right, and an optional "Details" disclosure underneath.
//
// This is the generic sibling of GameConditionsBar's `variant="compact"`
// branch, not a refactor of it. MLB is the reference layout and is
// deliberately left untouched, so the ~40 lines of shared markup are
// duplicated rather than hoisted -- the repo has no test suite, and putting
// the reference page at risk to save duplication is the wrong trade. If MLB
// ever comes back into scope, GameConditionsBar should collapse into this.
//
// `badge` and `details` are nodes, not data: what counts as game context is
// entirely sport-specific (weather and park factors for baseball, opponent
// defense rank for everything else), so this component only owns the layout.
// paddingRight clears the Filters button, which floats in the card's own
// absolute top-right corner on desktop.
function GameInfoBar({ dateISO, isHome, opponentLabel, venue, city, badge, details, detailsStorageKey }) {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  const venueTitle = [venue, city].filter(Boolean).join(" — ");
  return (
    <div style={{ padding: "12px 110px 12px 20px", borderBottom: "1px solid var(--line)" }}>
      {/* Column gap is wider than the row gap: the segments need air between
           them, but a wrapped second line shouldn't open a matching vertical
           hole. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 16px", minWidth: 0 }}>
          <span className="micro-label">Game Info</span>
          <span style={{ color: "var(--text)", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>
            {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            {" · "}
            <span className="mono tnum" style={{ color: "var(--amber-ink)", fontWeight: 700 }}>
              {d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
            </span>
          </span>
          {opponentLabel && (
            <>
              {/* --dim, not --line-strong: the latter is a border token tuned
                   to draw a 1px rule, which leaves a glyph almost invisible
                   in dark mode. */}
              <span style={{ color: "var(--dim)" }}>·</span>
              <span style={{ fontSize: 12.5, color: "var(--text)", whiteSpace: "nowrap" }}>
                {isHome ? "vs" : "@"} <strong>{opponentLabel}</strong>
              </span>
            </>
          )}
          {venue && (
            <>
              <span style={{ color: "var(--dim)" }}>·</span>
              <span
                style={{ fontSize: 12.5, color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}
                title={venueTitle}
              >
                {venue}
              </span>
            </>
          )}
        </div>
        {badge && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, flexShrink: 0 }}>
            {badge}
          </div>
        )}
      </div>
      {/* Per-sport storageKey, like the MLB bar's own
           mlb_game_conditions_details_open -- without one, opening Details on
           the NFL page would also open it on NBA and WNBA. */}
      {details && (
        <CollapsibleSection title="Details" storageKey={detailsStorageKey || "game_info_details_open"}>
          <div style={{ fontSize: 11, color: "var(--dim)", lineHeight: 1.5 }}>{details}</div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// Detailed rate-stat row recessed into a graph card's header, directly above
// the summary MetricRail. Each cell is a stat over the *filtered* sample with
// its delta against the player's season baseline underneath, so the row
// answers "how is this player trending in the games I'm actually looking at".
//
// Takes fully-computed cells rather than raw games: what a rate stat even is
// differs per sport (AVG/OBP/BABIP for a hitter, COMP%/Y-A for a QB, 3P%/FT%
// for a shooter), so the caller does the math and this owns the presentation
// plus the `i` glossary disclosure.
function SampleStatsRow({ cards, glossary, compact, intro }) {
  const [showInfo, setShowInfo] = useState(false);
  if (!cards || !cards.length) return null;
  return (
    <div style={{ position: "relative", background: "rgba(0,0,0,0.16)", borderBottom: "1px solid var(--line)" }}>
      <div style={{
        display: "flex", justifyContent: "center", gap: compact ? 14 : 26, flexWrap: "wrap",
        padding: compact ? "6px 10px" : "8px 20px",
      }}>
        {cards.map((c) => (
          <div key={c.key} style={{ textAlign: "center", minWidth: compact ? 42 : 52 }}>
            <div className="micro-label" style={{ fontSize: compact ? 9.5 : 10.5, marginBottom: 2 }}>{c.label}</div>
            <div className="mono stat-value" style={{ fontSize: compact ? 14 : 17, color: "var(--text)" }}>{c.value}</div>
            {c.delta && (
              <div className="mono tnum" style={{ fontSize: compact ? 10 : 11, fontWeight: 600, color: c.delta.color }}>{c.delta.text}</div>
            )}
          </div>
        ))}
        {glossary && glossary.length > 0 && (
          <div
            onClick={() => setShowInfo((v) => !v)}
            title="What do these stats mean?"
            role="button"
            aria-expanded={showInfo}
            className="mono"
            style={{
              position: "absolute", top: 8, right: 10,
              cursor: "pointer",
              width: 18, height: 18, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
              border: `1px solid ${showInfo ? "var(--amber)" : "var(--line)"}`,
              color: showInfo ? "var(--amber)" : "var(--dim)",
              background: showInfo ? "var(--amber-dim)" : "transparent",
            }}
          >
            i
          </div>
        )}
      </div>
      {showInfo && glossary && (
        <div style={{ padding: "12px 14px", background: "var(--panel2)", borderTop: "1px solid var(--line)" }}>
          {intro && (
            <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 10, fontStyle: "italic" }}>{intro}</div>
          )}
          {glossary.map((g) => (
            <div key={g.key} style={{ marginBottom: 10 }}>
              <div className="oswald" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{g.label}</div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2, lineHeight: 1.4 }}>{g.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Summary rail sitting flush on the chart's top edge: the player's season-wide
// average for the active market vs. the graph's own filtered-sample average,
// the hit rate against the current line, and the edge between them.
//
// Deliberately has no hero line number or "drag the tab" caption -- the
// draggable LineHandle on the chart itself is the single place the line value
// is read from and set.
function MetricRail({ seasonAvg, graphAvg, hitRate, hits, total, edge, compact, decimals = 1 }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap",
      gap: compact ? 20 : 32, padding: compact ? "10px 12px 6px" : "12px 20px 8px",
    }}>
      <div style={{ textAlign: "center" }}>
        <div className="micro-label" style={{ fontSize: compact ? 9.5 : 10.5 }}>Season Avg</div>
        <div className="mono stat-value" style={{ fontSize: compact ? 16 : 19, color: "var(--text)" }}>{seasonAvg.toFixed(decimals)}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="micro-label" style={{ fontSize: compact ? 9.5 : 10.5 }}>Graph Avg</div>
        <div className="mono stat-value" style={{ fontSize: compact ? 16 : 19, color: "var(--text)" }}>{graphAvg.toFixed(decimals)}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="micro-label" style={{ fontSize: compact ? 9.5 : 10.5 }}>Hit Rate</div>
        <div className="mono stat-value" style={{ fontSize: compact ? 16 : 19, color: "var(--text)" }}>
          {Math.round(hitRate * 100)}%{" "}
          <span className="tnum" style={{ fontSize: compact ? 10 : 11, color: "var(--dim)", fontWeight: 600 }}>({hits}/{total})</span>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="micro-label" style={{ fontSize: compact ? 9.5 : 10.5 }}>Edge</div>
        <div className="mono stat-value" style={{ fontSize: compact ? 16 : 19, color: edge >= 0 ? "var(--green)" : "var(--red)" }}>
          {`${edge >= 0 ? "+" : ""}${edge.toFixed(decimals)}`}
        </div>
      </div>
    </div>
  );
}

function NFLPropsPage({ jumpTo, dataVersion }) {
  const [showContext, setShowContext] = useState(false);
  const [matchupId, setMatchupId] = useState(NFL_MATCHUPS[0].id);
  const matchup = NFL_MATCHUPS.find((m) => m.id === matchupId);
  const teamRoster = matchup.teamA;
  const oppRoster = matchup.teamB;
  const [playerId, setPlayerId] = useState(teamRoster.players[0].id);
  const [market, setMarket] = useState("passYds");

  React.useEffect(() => {
    if (!jumpTo) return;
    const jumpPlayer = ALL_NFL_PLAYERS.find((p) => p.id === jumpTo.playerId);
    if (jumpPlayer) {
      const jumpMatchup = NFL_MATCHUPS.find(
        (m) => m.teamA.players.some((p) => p.id === jumpPlayer.id) || m.teamB.players.some((p) => p.id === jumpPlayer.id)
      );
      if (jumpMatchup) setMatchupId(jumpMatchup.id);
    }
    setPlayerId(jumpTo.playerId);
    setMarket(jumpTo.market);
    setLine(null);
    setOpponent("all");
    setTimeout(() => chartRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo && jumpTo.nonce]);
  const [side, setSide] = useState("all");
  const [lastN, setLastN] = useState(10);
  const [opponent, setOpponent] = useState("all");
  // 1 (not 0) is this control's neutral value -- the slider bottoms out at 1
  // and the preset row below labels 1 as "Any snaps". Defaulting to 50 meant
  // the page loaded with a real filter already narrowing the sample and
  // nothing on screen saying so.
  const [minSnapPct, setMinSnapPct] = useState(1);
  const [maxSnapPct, setMaxSnapPct] = useState(100);
  const [snapRangeEnabled, setSnapRangeEnabled] = useState(false);
  const [line, setLine] = useState(null);
  const [dragLine, setDragLine] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const chartRef = React.useRef(null);
  const chartWidth = useElementWidth(chartRef);
  const isNarrow = useIsNarrow();

  // Same breakpoint the roster columns collapse at (see .roster-layout in
  // index.css). Above it the graph card sits in the narrow center column with
  // room in its top-right corner for the anchored Filters button and a
  // full-width Game Info strip; below it the card is the whole page width,
  // the roster panels have handed over to MobilePlayerNav, and both of those
  // drop back into normal flow. Distinct from `isNarrow` (480px), which is
  // about how much room the *chart* has for per-bar labels.
  const compact = useIsNarrow(1100);

  const resetFilters = () => {
    setSide("all");
    setLastN(10);
    setOpponent("all");
    setMinSnapPct(1);
    setMaxSnapPct(100);
    setSnapRangeEnabled(false);
    setLine(null);
  };

  const player = ALL_NFL_PLAYERS.find((p) => p.id === playerId);
  const allGames = useMemo(() => getNFLGames(player), [player, dataVersion]);
  const playerMarkets = useMemo(() => NFL_MARKETS.filter((m) => m.pos.includes(player.pos)), [player]);
  const seasonAvg = useMemo(() => {
    const stats = NFL_SNAPSHOT_STATS[player.pos] || [];
    const n = allGames.length || 1;
    return stats.map((s) => ({
      ...s,
      value: allGames.reduce((a, g) => a + statValueNFL(g, s.key), 0) / n,
    }));
  }, [allGames, player.pos]);
  // Per-game historical line for the ledger table's Line/Result columns —
  // computed off the full unfiltered game log so it stays anchored to
  // chronological order regardless of the active filters.
  const historicalLines = useMemo(() => computeNFLHistoricalLines(allGames, market), [allGames, market]);

  // Whenever the selected player (and thus position) changes, make sure the
  // active market is still one that applies to them.
  React.useEffect(() => {
    if (!playerMarkets.some((m) => m.id === market)) {
      setMarket(playerMarkets[0].id);
      setLine(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  const opponentsForPlayer = useMemo(
    () => Array.from(new Set(allGames.map((g) => g.opp))).sort(),
    [allGames]
  );

  // Whether the snap-share control is actually asking anything of the field.
  // 1-100 is its full range, i.e. "any snap share", so at those bounds the
  // filter is inert and games with an unknown share shouldn't be penalised.
  const snapFilterActive = minSnapPct > 1 || maxSnapPct < 100;

  const filtered = useMemo(() => {
    let g = allGames.filter((game) => {
      if (side === "home" && !game.home) return false;
      if (side === "away" && game.home) return false;
      if (opponent !== "all" && game.opp !== opponent) return false;
      // A game with no recorded snap share can't be shown to satisfy a
      // non-default snap filter, so it's excluded rather than waved through.
      // Previously the `snapPct !== null` guard exempted those games
      // entirely, so "70%+ snaps" quietly kept games whose snap share was
      // unknown -- inflating the sample with exactly the games least likely
      // to qualify. While the filter is at its default (1-100) nothing is
      // being asked of the field, so unknowns still pass.
      if (snapFilterActive) {
        if (game.snapPct === null) return false;
        if (game.snapPct < minSnapPct || game.snapPct > maxSnapPct) return false;
      }
      return true;
    });
    if (lastN !== "all") g = g.slice(-lastN);
    return g;
  }, [allGames, side, opponent, minSnapPct, maxSnapPct, snapFilterActive, lastN]);

  // On narrow (phone-width) screens, beyond a Last-10 sample per-bar team
  // logos/abbreviations can't stay legible, so the x-axis switches to sparse
  // date labels instead (see DateAxisTick). Desktop has enough width for
  // logo+abbr+date per bar at any sample size -- axisTickInterval already
  // caps the number of ticks actually drawn, so it never needs this fallback.
  const manyGames = isNarrow && filtered.length > 10;

  // Anytime TD is a normal counting stat (a player can score more than once
  // in a game), not a milestone/binary market -- unlike NBA's dd/td props.
  const isBinary = false;
  const values = filtered.map((g) => statValueNFL(g, market));
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const effectiveLine = isBinary ? 0.5 : (line === null ? ceilToHalfOdd(avg) : line);
  // Deliberately keyed off `line` (only non-null once the user has actually
  // dragged the handle to a custom value), not `effectiveLine` -- including
  // the live drag position here made the axis grow a step every time the
  // handle crossed a half-point while dragging, since a taller axis raised
  // topValue, which raised the handle's own `max`, letting it drag higher
  // still. The *default* suggested line (ceilToHalfOdd(avg), used only while
  // line is null) can still nudge the axis up if it rounds just past the
  // tallest bar, but once a real line is set the axis stays put and the
  // handle simply can't be dragged above it.
  const topValue = Math.max(...values, line === null ? ceilToHalfOdd(avg) : 0, 1);
  const rawMax = isBinary ? 1 : topValue + Math.max(1, Math.ceil(topValue * 0.05));
  const niceStep = (() => {
    if (isBinary) return 1;
    const targetTicks = 5;
    const roughStep = rawMax / targetTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(roughStep || 1)));
    const norm = roughStep / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 3 ? 3 : norm <= 5 ? 5 : 10) * mag;
    return Math.max(1, step);
  })();
  const chartMax = isBinary ? 1 : Math.ceil(rawMax / niceStep) * niceStep;
  const chartTicks = isBinary
    ? [0, 1]
    : Array.from({ length: chartMax / niceStep + 1 }, (_, i) => i * niceStep);

  // Filters-panel wiring, mirroring the MLB/WNBA pages. Opponent is a
  // dropdown here rather than a single scheduled matchup, so the H2H cell is
  // dropped and the grid renders six sample-size windows instead of seven.
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (side !== 'all') n += 1;
    if (opponent !== 'all') n += 1;
    if (lastN !== 10) n += 1;
    if (snapFilterActive) n += 1;
    return n;
  }, [side, opponent, lastN, snapFilterActive]);

  const splitCells = buildHitRateSplits({
    allGames,
    statValue: (g) => statValueNFL(g, market),
    effectiveLine,
    lastN,
    onSetLastN: setLastN,
    h2h: false,
    onSetH2h: () => {},
    opponentAbbr: null,
    shortLabels: true,
    includeH2h: false,
  });

  const hits = values.filter((v) => v > effectiveLine).length;
  const hitRate = values.length ? hits / values.length : 0;
  const edge = avg - effectiveLine;
  const marketLabel = NFL_MARKETS.find((m) => m.id === market)?.label ?? "";
  const defCategoryLabel = nflDefCategoryLabel(market, player.pos);

  // Season-wide average for the *currently selected market*, distinct from
  // `avg` (which is scoped to `filtered`, i.e. whatever the location/opponent/
  // snap-share/sample-size filters have narrowed the chart down to). This is
  // what lets the metric rail show "Season Avg" and "Graph Avg" as two
  // genuinely different numbers instead of the same value twice.
  const seasonValuesForMarket = allGames.map((g) => statValueNFL(g, market));
  const seasonAvgForMarket = seasonValuesForMarket.length
    ? seasonValuesForMarket.reduce((a, b) => a + b, 0) / seasonValuesForMarket.length
    : 0;

  // Who this player actually lines up against in the selected matchup --
  // read off the *other* roster, not the `opponent` filter, so the Game Info
  // badge always describes tonight's game rather than whatever historical
  // opponent the filters happen to be zoomed into. Which roster is "other"
  // depends on which side the selected player is on: clicking a name in the
  // right-hand panel flips the sides.
  const playerOnTeamA = teamRoster.players.some((p) => p.id === playerId);
  const gameOppRoster = playerOnTeamA ? oppRoster : teamRoster;
  const gameOppAbbr = gameOppRoster.players[0]?.team;
  const gameOppDef = gameOppAbbr ? getNFLDefRank(market, player.pos, gameOppAbbr) : null;
  const gameOppTier = gameOppDef ? nflDefTier(gameOppDef.rank) : null;
  // Once the real defense table has loaded, the rank/rating is points allowed
  // per game for every market, not a per-market split -- so the Game Info
  // badge has to be labelled for what the number actually is. Only while the
  // mock per-category fallback is in play does a market-specific label
  // ("pass yards defense vs WR") describe the figure next to it.
  const gameDefLabel = nflDefIsPointsAllowed(gameOppAbbr) ? "points allowed" : defCategoryLabel;
  const tierColor = (t) => (t === "soft" ? "var(--green)" : t === "tough" ? "var(--red)" : "var(--dim)");

  // Detailed rate-stat row: the same columns computed twice, once over the
  // filtered sample the chart is showing and once over the full season, so
  // every cell can carry a "how is he trending" delta underneath it.
  const rateColumns = NFL_RATE_COLUMNS[player.pos] || [];
  const rateWindow = useMemo(() => nflRateAgg(filtered), [filtered]);
  const rateSeason = useMemo(() => nflRateAgg(allGames), [allGames]);
  const rateCards = rateColumns.map((c) => ({
    key: c.key,
    label: c.label,
    value: `${rateWindow[c.key].toFixed(c.decimals)}${c.suffix || ""}`,
    delta: fmtStatDelta(rateWindow[c.key] - rateSeason[c.key], c.decimals, c.better, c.suffix || ""),
  }));
  const rateGlossary = rateColumns
    .map((c) => ({ key: c.key, ...NFL_RATE_GLOSSARY[c.key] }))
    .filter((g) => g.label);

  // Game Info's right-hand context slot. MLB fills this with a live forecast
  // and park-factor swings; there is no weather or venue-effect data for the
  // NFL slate, so the equivalent pre-game read here is how the opponent's
  // defense ranks against this exact market and position -- the same
  // getNFLDefRank numbers the game-log table's Def# column already shows,
  // just applied to tonight's opponent instead of past ones.
  const gameInfoBadge = gameOppDef && (
    <>
      <span style={{ fontSize: 11.5, color: "var(--dim)", whiteSpace: "nowrap" }}>
        vs {gameOppAbbr} {gameDefLabel}
      </span>
      <span className="mono tnum" style={{ fontWeight: 600, fontSize: 11, color: "var(--text)", whiteSpace: "nowrap" }}>
        {gameOppDef.rating}
      </span>
      <span className="status-pill" style={{ color: tierColor(gameOppTier), whiteSpace: "nowrap" }}>
        #{gameOppDef.rank} {gameOppTier === "soft" ? "Favorable" : gameOppTier === "tough" ? "Tough" : "Neutral"}
      </span>
    </>
  );

  const gameInfoDetails = gameOppDef && (
    <>
      <div style={{ marginBottom: 4 }}>
        {gameOppRoster.label} rank #{gameOppDef.rank} of {NFL_TEAMS.length} in {gameDefLabel} ({gameOppDef.rating}) —
        {gameOppTier === "soft"
          ? " one of the softer matchups in the league for this market, which nudges toward the over."
          : gameOppTier === "tough"
            ? " one of the tougher matchups in the league for this market, which nudges toward the under."
            : " a middle-of-the-pack matchup, so the defense isn't the deciding factor here."}
      </div>
      <div>{matchup.venue}{matchup.city ? ` — ${matchup.city}` : ""}</div>
    </>
  );

  // Player identity: avatar + name/team/pos + season snapshot. Now the top of
  // the graph card rather than its own bordered panel beside the matchup
  // selector, so it carries only a bottom divider against the detailed stat
  // row underneath. paddingRight reserves room for the Filters button, which
  // floats in the card's absolute top-right corner on desktop.
  const playerIdentityRow = (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: compact ? 10 : 20,
      flexWrap: "wrap", borderBottom: "1px solid var(--line)",
      padding: compact ? "8px 12px" : "12px 20px",
      paddingRight: compact ? 12 : 110,
    }}>
      <PlayerAvatar
        key={player.id}
        name={player.name}
        alt={player.name}
        sport="nfl"
        team={player.team}
        colorMap={NFL_TEAM_COLORS}
        headshotSrc={NFL_HEADSHOTS[player.id]}
        size={compact ? 56 : 84}
        inset={compact ? 3 : 5}
        backing={(NFL_TEAM_COLORS[player.team] || {}).primary || "#000"}
        imgBorder="1px solid var(--line)"
        fadeIn
        shadow={`0 4px 14px ${(NFL_TEAM_COLORS[player.team] || {}).primary || "#000"}40`}
      />

      <div style={{ textAlign: "center", paddingRight: compact ? 8 : 16 }}>
        <div className="oswald" style={{ fontSize: compact ? 13 : 16, color: "var(--text)", whiteSpace: "nowrap" }}>{player.name}</div>
        <div style={{ fontSize: compact ? 9 : 10.5, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {player.team} · {player.pos} · Season
        </div>
      </div>

      {/* Fixed width sized for NFL_SNAPSHOT_MAX_STATS columns (4, a QB's
           count) no matter how many stats this position actually has, so the
           row doesn't reflow when switching between a QB and anyone else --
           but within that width a position with fewer stats centers its
           group rather than leaving a stray empty slot on the right. */}
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: compact ? 12 : 20,
        width: compact ? undefined : NFL_SNAPSHOT_MAX_STATS * 62 + (NFL_SNAPSHOT_MAX_STATS - 1) * 20,
      }}>
        {seasonAvg.map((s) => (
          <div key={s.label} style={{ textAlign: "center", width: compact ? undefined : 62, flexShrink: 0 }}>
            <div className="mono" style={{ fontSize: compact ? 14 : 18, color: "var(--amber)", fontWeight: 700 }}>{s.value.toFixed(s.decimals)}</div>
            <div style={{ fontSize: compact ? 9 : 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const filtersBody = (
    <FilterPanel activeCount={activeFilterCount} onReset={resetFilters}>
      <FilterSection title="Sample size">
        <SampleSizeGrid cells={splitCells} />
        <SampleSizeSlider total={allGames.length} lastN={lastN} onSetLastN={setLastN} />
      </FilterSection>

      <FilterSection shaded>
        <div className="fp-grid-2">
          <div>
            <div className="micro-label" style={{ fontSize: 10, marginBottom: 7 }}>Game location</div>
            <div className="fp-row">
              {["all", "home", "away"].map((s) => (
                <div key={s} role="button" className={`chip-sm ${side === s ? "active" : ""}`} onClick={() => setSide(s)}>
                  {s === "all" ? "All games" : s === "home" ? "Home" : "Away"}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="micro-label" style={{ fontSize: 10, marginBottom: 7 }}>Opponent</div>
            <select className="select-sm" value={opponent} onChange={(e) => setOpponent(e.target.value)}>
              <option value="all">Any opponent</option>
              {opponentsForPlayer.map((o) => <option key={o} value={o}>vs {o}</option>)}
            </select>
          </div>
        </div>
      </FilterSection>

      <FilterSection shaded>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
          <span className="micro-label" style={{ fontSize: 10 }}>Snap share</span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--amber)" }}>
            {!snapRangeEnabled
              ? (minSnapPct === 1 ? "Any" : `${minSnapPct}%+`)
              : (minSnapPct === 1 && maxSnapPct === 100 ? "Any" : `${minSnapPct}–${maxSnapPct}%`)}
          </span>
        </div>
        <ThresholdSlider
          min={1}
          max={100}
          step={1}
          lo={minSnapPct}
          hi={maxSnapPct}
          onChangeLo={setMinSnapPct}
          onChangeHi={setMaxSnapPct}
          rangeEnabled={snapRangeEnabled}
          onToggleRange={() => setSnapRangeEnabled((v) => !v)}
        />
        <div className="fp-row" style={{ marginTop: 10 }}>
          {[1, 50, 70, 85].map((m) => (
            <div
              key={m}
              role="button"
              className={`chip-sm ${!snapRangeEnabled && minSnapPct === m ? "active" : ""}`}
              onClick={() => setMinSnapPct(m)}
            >
              {m === 1 ? "Any snaps" : `${m}%+`}
            </div>
          ))}
        </div>
      </FilterSection>
    </FilterPanel>
  );

  // Local chart height, matching the MLB card's rather than the taller shared
  // CHART_HEIGHT: the card now carries the game-info, identity, market,
  // detail-stat and metric rows above the plot, so a shorter chart keeps the
  // whole stack visible together instead of pushing the bars off-screen.
  const NFL_GRAPH_CHART_HEIGHT = isNarrow ? 340 : 600;

  const chartBlock = (
    <div
      ref={chartRef}
      style={{
        position: "relative", boxSizing: "border-box", height: NFL_GRAPH_CHART_HEIGHT,
        // A nested strip, not a second card: the graph card's own wrapper
        // already supplies the border/shadow, so this only needs a subtle
        // background to read as its own section without a competing outline.
        background: "var(--surface-2)", borderRadius: "var(--r-md)",
        padding: isNarrow ? "16px 6px 10px" : "16px 16px 8px",
      }}
    >
      {/* The launcher owns the popover, bottom sheet, click-outside and
           Escape handling (shared with the other sports pages). Lives inside
           the chart's own container (not the identity/header card) so it
           reads as part of the chart -- anchored to this div's top-right
           corner, in the empty space above the bars, on both mobile and
           desktop alike. */}
      <FilterPanelLauncher
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        activeCount={activeFilterCount}
        compact={compact}
        anchored
      >
        {filtersBody}
      </FilterPanelLauncher>
      <ContextStatToggle stat={NFL_CONTEXT_STAT} value={showContext} onChange={setShowContext} compact={isNarrow} />
      <div style={{ height: "100%", width: "100%", touchAction: "pan-y" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={filtered.map((g, i) => ({
            idx: i + 1,
            opp: g.opp,
            axisKey: `${g.opp}__${g.date}`,
            value: statValueNFL(g, market),
            date: g.date,
            snapPct: g.snapPct,
            home: g.home,
            defRank: getNFLDefRank(market, player.pos, g.opp).rank,
          }))}
          // right clears LineHandle, which anchors to the container's right
          // edge: it needs right:8 + its 52px minimum, less the 6px the
          // narrow chart wrapper already pads, so 54 is the floor. 30 left
          // the pill sitting on top of the last bar.
          margin={{ top: 10, right: isNarrow ? 64 : 60, bottom: manyGames ? 30 : (isNarrow ? 42 : 78), left: isNarrow ? 0 : 20 }}
          barCategoryGap={isNarrow ? "4%" : "6%"}
        >
          {/* Invisible (stroke="transparent"), not removed: rendered fully
               open per the PropsMadness reference (no grid lines, just
               floating y-tick labels), but LineHandle's drag math
               (getPlotBoundsY, above) measures the plot's top/bottom by
               querying this component's own rendered .recharts-cartesian-
               grid-horizontal line elements -- removing the component
               entirely would silently break the drag handle instead of
               just hiding a visual grid. */}
          <CartesianGrid stroke="transparent" vertical={false} />
          <XAxis
            dataKey={manyGames ? "date" : "axisKey"}
            interval={manyGames ? Math.max(0, Math.ceil(filtered.length / (isNarrow ? 5 : 8)) - 1) : axisTickInterval(filtered.length, isNarrow, chartWidth)}
            tick={manyGames ? (props) => <DateAxisTick {...props} compact={isNarrow} /> : (props) => <TeamAxisTick {...props} logoFn={nflTeamLogo} compact={isNarrow} />}
            axisLine={false}
            tickLine={false}
          />
          {/* The narrow width is 32 rather than 24 because a 3-digit tick
               ("400") at fontSize 11 plus recharts' default 5px tickMargin
               needs ~30px -- at 24 the axis band clipped the leading digit,
               so passing yardage totals rendered as "!00" on a phone. */}
          <YAxis
            domain={[0, chartMax]}
            ticks={chartTicks}
            tick={{ fill: "var(--chart-ink)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={isNarrow ? 32 : 60}
            label={isNarrow ? undefined : { value: marketLabel, angle: -90, position: "insideLeft", offset: 10, style: { textAnchor: "middle", fill: "var(--chart-ink)", fontSize: 11, fontWeight: 600 } }}
          />
          <Tooltip
            content={
              <ChartTooltip
                effectiveLine={effectiveLine}
                isBinary={isBinary}
                marketLabel={marketLabel}
                footerLabel={(d) => (d.snapPct == null ? "no offensive snaps" : `${d.snapPct}% offensive snaps`)}
                logoFn={nflTeamLogo}
              />
            }
            cursor={{ fill: "var(--surface-3)", opacity: 0.5 }}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} minPointSize={(v) => (v === 0 ? 3 : 0)}>
            {filtered.map((g, i) => {
              const v = statValueNFL(g, market);
              const fill = isBinary ? (v === 1 ? CHART_GREEN : "transparent") : (v > effectiveLine ? CHART_GREEN : CHART_RED);
              return <Cell key={i} fill={fill} />;
            })}
            <LabelList dataKey="value" content={(props) => <BarValueLabel {...props} isBinary={isBinary} />} />
          </Bar>
          {contextStatChartParts(NFL_CONTEXT_STAT, showContext, isNarrow)}
          {/* Rendered after Bar (not before) so the dashed threshold line
               draws on top of the bars instead of being clipped underneath
               them -- later JSX = higher SVG paint order in Recharts. */}
          {!isBinary && <ReferenceLine y={dragLine !== null ? dragLine : effectiveLine} stroke="var(--amber)" strokeDasharray="4 4" />}
        </ComposedChart>
      </ResponsiveContainer>
      </div>
      {!isBinary && (
        <LineHandle
          value={effectiveLine}
          onChange={(v) => setLine(v)}
          onDragValue={setDragLine}
          min={0}
          max={chartMax}
          containerRef={chartRef}
        />
      )}
    </div>
  );

  // Game-log ledger table -- behind the same "▸ Game Logs (n)" disclosure the
  // MLB page uses, so the long table doesn't push the news module and the rest
  // of the page down by default. Its own storageKey, so collapsing it here
  // doesn't also collapse MLB's.
  const ledgerTable = (
    <CollapsibleSection title={`Game Logs (${filtered.length})`} storageKey="nfl_game_logs_open">
      <div style={{ border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ minWidth: 580 }}>
            <div className="mono" style={{ display: "grid", gridTemplateColumns: "5fr 9fr 6fr 6fr 6fr 6fr 7fr 6fr 7fr", padding: "10px 14px", fontSize: 11, color: "var(--dim)", borderBottom: "1px solid var(--line)", textTransform: "uppercase", textAlign: "center" }}>
              <div>#</div><div>Date</div><div>Opp</div><div>Def#</div><div>Loc</div><div>Snap %</div><div>{marketLabel}</div><div>Line</div><div>Result</div>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto", overflowX: "hidden" }}>
              {filtered.slice().reverse().map((g, i) => {
                const v = statValueNFL(g, market);
                const rowLine = isBinary ? 0.5 : historicalLines[allGames.indexOf(g)];
                const over = v > rowLine;
                const push = !isBinary && v === rowLine;
                const def = getNFLDefRank(market, player.pos, g.opp);
                const tier = nflDefTier(def.rank);
                return (
                  <div key={g.date} className="ledger-row mono" style={{ display: "grid", gridTemplateColumns: "5fr 9fr 6fr 6fr 6fr 6fr 7fr 6fr 7fr", padding: "9px 14px", fontSize: 12.5, textAlign: "center" }}>
                    <div style={{ color: "var(--dim)" }}>{filtered.length - i}</div>
                    <div>{g.date}</div>
                    <div>{g.opp}</div>
                    <div style={{ color: tierColor(tier) }}>#{def.rank}</div>
                    <div style={{ color: "var(--dim)" }}>{g.home ? "Home" : "Away"}</div>
                    <div>{g.snapPct == null ? "—" : `${g.snapPct}%`}</div>
                    <div style={{ color: "var(--text)" }}>{isBinary ? (v === 1 ? "Yes" : "No") : v}</div>
                    <div style={{ color: "var(--dim)" }}>{isBinary ? "—" : rowLine}</div>
                    <div style={{ color: push ? "var(--dim)" : over ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                      {isBinary ? (v === 1 ? "YES" : "NO") : (push ? "PUSH" : over ? "OVER" : "UNDER")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );

  return (
    <div className="page-shell page-shell--mobile-nav" style={{ maxWidth: 1920, margin: "0 auto", boxSizing: "border-box" }}>
    <MobilePlayerNav
      teamA={teamRoster}
      teamB={oppRoster}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => NFL_HEADSHOTS[p.id]}
      metaLine={(p) => p.pos}
      avatarBg={(p) => teamAvatarBackground(NFL_TEAM_COLORS, p.team)}
    />
    <div className="roster-layout">
    <TeamRosterPanel
      teamLabel={teamRoster.label}
      players={teamRoster.players}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => NFL_HEADSHOTS[p.id]}
      metaLine={(p) => p.pos}
      avatarBg={(p) => teamAvatarBackground(NFL_TEAM_COLORS, p.team)}
    />
    <div className="roster-layout-center">
      {/* Below the roster breakpoint the graph card is the full page width
           and its top-right corner is no longer a safe place to float things,
           so the game info falls back to the original date/venue pill above
           the card -- the same split the MLB page makes between its
           GameConditionsBar (desktop, inside the card) and nextGamePill
           (mobile, above it). */}
      {compact && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center", gap: 14, flexWrap: "wrap",
          width: "fit-content", margin: "0 auto 12px", padding: "9px 20px",
          background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 999,
          fontSize: 12.5, color: "var(--dim)",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>
              {new Date(matchup.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <span>·</span>
            <span className="mono" style={{ color: "var(--amber)", fontWeight: 700 }}>
              {new Date(matchup.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{matchup.venue}</span>
            <span>— {matchup.city}</span>
          </span>
        </div>
      )}

      {/* Matchup selector, alone in its own centered row above the card --
           picking a matchup here swaps which two rosters populate the
           left/right sidebars. Picking an individual player happens by
           clicking their row in either roster panel, which is the one-dropdown
           pattern every sport page now uses. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, marginTop: compact ? 14 : 20, width: compact ? "100%" : "auto" }}>
        <GameSelect
          groups={NFL_MATCHUPS_BY_DATE}
          value={matchupId}
          logoFn={nflTeamLogo}
          compact={compact}
          onChange={(next) => {
            setMatchupId(next.id);
            setPlayerId(next.teamA.players[0].id);
            setLine(null);
            setOpponent("all");
          }}
        />
      </div>

      {/* The graph card: game info, player identity, market tabs, both stat
           tiers and the chart blended into one bordered container instead of
           the separately-bordered boxes this page used to stack. Mirrors the
           MLB page's graphCard(). */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", marginBottom: 16, overflow: "hidden", position: "relative" }}>
        {!compact && (
          <GameInfoBar
            dateISO={matchup.date}
            isHome={!playerOnTeamA}
            opponentLabel={gameOppRoster.label}
            venue={matchup.venue}
            city={matchup.city}
            detailsStorageKey="nfl_game_info_details_open"
            badge={gameInfoBadge}
            details={gameInfoDetails}
          />
        )}

        {playerIdentityRow}

        <div style={{ padding: compact ? "10px 12px 14px" : "12px 20px 18px" }}>
          <MarketSectionGrid
            singleBar
            sections={NFL_MARKET_SECTIONS.map((s) => ({ ...s, markets: playerMarkets.filter((m) => s.ids.includes(m.id)) }))}
            activeMarket={market}
            onSelect={(id) => { setMarket(id); setLine(null); }}
            isNarrow={isNarrow}
          />
        </div>

        <SampleStatsRow
          cards={rateCards}
          glossary={rateGlossary}
          compact={compact}
          intro={`A quick guide to these stats, if you're newer to football props. One thing that trips people up: the ${player.pos} card above is always the full season average, while the numbers below are for whatever your filters are currently showing — so the same stat can read differently in the two rows at the same time.`}
        />
        <MetricRail
          seasonAvg={seasonAvgForMarket}
          graphAvg={avg}
          hitRate={hitRate}
          hits={hits}
          total={values.length}
          edge={edge}
          compact={compact}
        />

        {chartBlock}

        <HitRateSplits
          allGames={allGames}
          statValue={(g) => statValueNFL(g, market)}
          effectiveLine={effectiveLine}
          lastN={lastN}
          onSetLastN={setLastN}
          h2h={false}
          onSetH2h={() => {}}
          opponentAbbr={null}
          isNarrow={isNarrow}
          max={allGames.length}
          includeH2h={false}
        />
      </div>

      {ledgerTable}
    </div>
    <TeamRosterPanel
      teamLabel={oppRoster.label}
      players={oppRoster.players}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => NFL_HEADSHOTS[p.id]}
      metaLine={(p) => p.pos}
      avatarBg={(p) => teamAvatarBackground(NFL_TEAM_COLORS, p.team)}
    />
    </div>

      <div style={{ marginTop: 20, fontSize: 12, color: "var(--dim)" }}>
        Real 2025 regular-season game logs (ESPN Stats API) for every player shown above — the 2026 season hasn't started yet, so this is last season's actual box scores, not a live odds feed.
      </div>
      <PlayerNewsModule playerName={player.name} headshotSrc={NFL_HEADSHOTS[player.id]} sport="nfl" team={player.team} />
    </div>
  );
}

// ---------- WNBA (2 real matchups for tonight's slate) ----------
const WNBA_TEAMS = ["ATL","CHI","CON","DAL","GS","IND","LV","LA","MIN","NY","PHX","POR","SEA","TOR","WSH"];

// Placeholder defensive ratings, same approach as the NBA's TEAM_DEF above
// (mock ratings, ranked lowest-to-highest) -- a real WNBA opponent-stats feed
// would replace this the same way it would replace TEAM_DEF.
const wnbaDefRatingRng = mulberry32(4242);
const WNBA_TEAM_DEF = (() => {
  const raw = WNBA_TEAMS.map((t) => ({ team: t, rating: Math.round((98 + wnbaDefRatingRng() * 14) * 10) / 10 }));
  raw.sort((a, b) => a.rating - b.rating);
  raw.forEach((r, i) => (r.rank = i + 1));
  const byTeam = {};
  raw.forEach((r) => (byTeam[r.team] = r));
  return byTeam;
})();

const WNBA_LOGO_SLUG = {
  ATL: "atl", CHI: "chi", CON: "conn", DAL: "dal", GS: "gs", IND: "ind", LV: "lv",
  LA: "la", MIN: "min", NY: "ny", PHX: "phx", POR: "por", SEA: "sea", TOR: "tor", WSH: "wsh",
};
const wnbaTeamLogo = (abbr) => `https://a.espncdn.com/i/teamlogos/wnba/500/${WNBA_LOGO_SLUG[abbr] || abbr.toLowerCase()}.png`;

// Official-ish WNBA brand colors (primary/secondary), used only to tint the
// player avatar's background ring -- see teamAvatarBackground above.

// Same ESPN combiner headshot proxy as the NBA/NFL pages, just pointed at
// the wnba headshot path instead.
const wnbaHeadshot = (espnId) =>
  `https://a.espncdn.com/combiner/i?img=/i/headshots/wnba/players/full/${espnId}.png&w=350&h=350&scale=crop`;

// ---------- WNBA availability ----------
//
// ESPN's team roster route is the only WNBA availability feed the app has, and
// it is the good one: every athlete carries a numeric `id` that is exactly the
// `espnId` already stored on our player objects, so the join needs no name
// matching, plus an `injuries` array per athlete.
//
// The league-wide `/wnba/injuries` route carries the same information but with
// `athlete.id` null on every entry -- the id is only recoverable by regexing it
// out of a headshot URL. That is why this uses the per-team route despite
// costing one request per team on the slate rather than one for the league.
//
// Caveat worth knowing before reading a green dot as "confirmed to play": this
// route only ever returns players who are on the active roster, so `status.type`
// is "active" for all 168 athletes across the league. Absence of an injury here
// means "no injury reported", not "confirmed starter" -- the stronger claim MLB
// can make from a posted batting order has no WNBA equivalent in this feed.
const WNBA_TEAM_ESPN_ID = {
  ATL: "20", CHI: "19", CON: "18", DAL: "3", GS: "129689", IND: "5", LA: "6",
  LV: "17", MIN: "8", NY: "9", PHX: "11", POR: "132052", SEA: "14",
  TOR: "131935", WSH: "16",
};

// Injury vocabulary -> the avatar's three states. Two vocabularies are folded
// in on purpose: the roster route reports `status` as "Out"/"Day-To-Day", while
// the league injuries route reports the same fact as a fantasyStatus
// abbreviation ("OUT"/"OFS"/"GTD"). Only the first pair actually occurs on the
// route used here; the rest are mapped so a future switch of source, or a value
// ESPN adds later, lands somewhere deliberate instead of silently reading as
// available. Anything unrecognised returns undefined and renders no dot.
const WNBA_INJURY_STATUS = {
  "out": "out",
  "ofs": "out",
  "injured reserve": "out",
  "suspension": "out",
  "day-to-day": "questionable",
  "gtd": "questionable",
  "questionable": "questionable",
  "doubtful": "questionable",
  "probable": "questionable",
};

const WNBA_ROSTER_STATUS_TTL_MS = 15 * 60 * 1000;
const wnbaRosterStatusCache = new Map();

// Cache shape mirrors fetchMLBTeamRosterStatus: module Map + sessionStorage,
// keyed on the slate day so it rolls over, and a failed or empty fetch is never
// cached so the next call retries. 15 minutes because injury reports move on
// gameday, often within hours of tip.
// One roster fetch per team, serving both products the route carries: the
// team's current players (identity) and their availability. They were two
// concerns but they are one request, and splitting them would double the
// traffic for no gain.
//
// Returns { players, byId } or null. `players` is already merged with any
// hand-written projections we have for that espnId; `byId` is the espnId ->
// status map the avatars read.
async function fetchWNBATeamRoster(abbr) {
  const teamId = WNBA_TEAM_ESPN_ID[abbr];
  if (!teamId) return null;

  // currentMLBDayKey is just "the slate day in ET, rolling over at 3am" -- not
  // actually MLB-specific, and correct for a WNBA slate too. Reused rather than
  // cloned so both sports roll their caches on the same boundary.
  const dayKey = currentMLBDayKey();
  const cached = wnbaRosterStatusCache.get(abbr);
  if (cached && cached.dayKey === dayKey && Date.now() - cached.fetchedAt < WNBA_ROSTER_STATUS_TTL_MS) return cached.data;

  const cacheKey = `wnba_roster_v2_${abbr}`;
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.dayKey === dayKey && Date.now() - parsed.fetchedAt < WNBA_ROSTER_STATUS_TTL_MS) {
        wnbaRosterStatusCache.set(abbr, parsed);
        return parsed.data;
      }
    }
  } catch {}

  let data = null;
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/${teamId}/roster`);
    if (!res.ok) return null;
    const json = await res.json();
    const byId = {};
    const players = [];
    (json?.athletes || []).forEach((a) => {
      const espnId = a?.id && String(a.id);
      if (!espnId) return;

      const mapped = (a?.injuries || [])
        .map((inj) => String(inj?.status || inj?.details?.fantasyStatus?.abbreviation || "").toLowerCase().trim())
        .map((raw) => WNBA_INJURY_STATUS[raw])
        .filter(Boolean);
      // An athlete can carry more than one entry; the worst one wins, so a
      // player listed both day-to-day and out doesn't read as merely doubtful.
      const onActiveRoster = String(a?.status?.type || "").toLowerCase() === "active";
      const status = mapped.includes("out") ? "out"
        : mapped.includes("questionable") ? "questionable"
        : onActiveRoster ? "active"
        : undefined;
      if (status) byId[espnId] = status;

      const proj = WNBA_PROJECTIONS_BY_ESPN_ID[espnId];
      players.push({
        // Keep the hand-written slug when we have one so feed pick ids -- and
        // therefore already-saved picks -- survive the switch to live rosters.
        id: (proj && proj.id) || `wnba_${espnId}`,
        espnId,
        name: a?.displayName || a?.fullName || "",
        team: abbr,
        pos: a?.position?.abbreviation || a?.position?.name || "",
        base: proj && proj.base,
        var: proj && proj.var,
      });
    });
    if (players.length) data = { players, byId };
  } catch {
    data = null;
  }
  if (!data) return null;

  const record = { dayKey, data, fetchedAt: Date.now() };
  wnbaRosterStatusCache.set(abbr, record);
  try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
  return data;
}

// Back-compat shim for the availability-only callers.
async function fetchWNBATeamAvailability(abbr) {
  const data = await fetchWNBATeamRoster(abbr);
  return data ? data.byId : null;
}

// A player's next game date, resolved from the live slate by team rather than
// from the static matchup list by slug. The slug lookup only ever worked for
// the 50 hand-written players; every live-roster player came back null, and a
// pick with no gameDate is permanently unsettleable (see gradePick). Falls
// back to the static list so the offline slate still dates its picks.
function wnbaGameDateForTeam(abbr, playerId) {
  const live = (wnbaScheduleCache && wnbaScheduleCache.matchups) || [];
  const game = live.find((m) => m.teamA?.abbr === abbr || m.teamB?.abbr === abbr);
  if (game && game.date) return game.date;
  return matchupDateForPlayer(WNBA_MATCHUPS, playerId);
}

// ---------- WNBA starters ----------
//
// Real starter flags, never a minutes threshold dressed up as one. ESPN's
// roster route has no starter field and no depth chart; the box score does --
// `starter: true` on exactly five athletes per team, keyed by the same espnId
// we already carry.
//
// The wrinkle: an upcoming game has no box score at all (boxscore.players is
// empty until tip), so tonight's starters do not exist as data anywhere. What
// does exist is who started each team's last completed game, which the
// matchup summary hands us directly via lastFiveGames. That is what this
// returns, and it is labelled as such in the UI -- "STARTERS · LAST GAME" --
// so a real fact from a prior game is never presented as tonight's lineup.
// A live or finished game uses its own box score instead.
//
// Returns { byTeam: { ABBR: Set<espnId> }, dateByTeam: { ABBR: "YYYY-MM-DD" } }
// or null. Null means no divider: the rails fall back to a flat MPG-sorted
// list rather than inventing a split.
const WNBA_STARTERS_TTL_MS = 15 * 60 * 1000;
const wnbaStartersCache = new Map();

function readStartersFromSummary(summary) {
  const out = {};
  ((summary && summary.boxscore && summary.boxscore.players) || []).forEach((g) => {
    const abbr = g?.team?.abbreviation;
    const athletes = (g?.statistics || [])[0]?.athletes || [];
    const ids = athletes.filter((a) => a?.starter && a?.athlete?.id).map((a) => String(a.athlete.id));
    if (abbr && ids.length) out[abbr] = new Set(ids);
  });
  return Object.keys(out).length ? out : null;
}

async function fetchWNBAStarters(eventId) {
  if (!eventId) return null;
  const cached = wnbaStartersCache.get(eventId);
  if (cached && Date.now() - cached.fetchedAt < WNBA_STARTERS_TTL_MS) return cached.data;

  const SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/summary?event=";
  let data = null;
  try {
    const res = await fetch(SUMMARY + eventId);
    if (!res.ok) return null;
    const summary = await res.json();

    // Live or final: this game's own box score is the truth.
    const own = readStartersFromSummary(summary);
    if (own) {
      const date = (summary?.header?.competitions || [])[0]?.date || "";
      const dateByTeam = {};
      Object.keys(own).forEach((a) => { dateByTeam[a] = date.slice(0, 10); });
      data = { byTeam: own, dateByTeam, fromThisGame: true };
    } else {
      // Upcoming: fall back to each team's most recent completed game.
      const byTeam = {};
      const dateByTeam = {};
      await Promise.all((summary?.lastFiveGames || []).map(async (t) => {
        const abbr = t?.team?.abbreviation;
        const events = [...(t?.events || [])].sort((a, b) => String(a.gameDate).localeCompare(String(b.gameDate)));
        const last = events[events.length - 1];
        if (!abbr || !last?.id) return;
        try {
          const r2 = await fetch(SUMMARY + last.id);
          if (!r2.ok) return;
          const prev = await r2.json();
          const st = readStartersFromSummary(prev);
          if (st && st[abbr]) {
            byTeam[abbr] = st[abbr];
            dateByTeam[abbr] = String(last.gameDate || "").slice(0, 10);
          }
        } catch {}
      }));
      if (Object.keys(byTeam).length) data = { byTeam, dateByTeam, fromThisGame: false };
    }
  } catch {
    data = null;
  }
  if (!data) return null;

  // Sets do not survive sessionStorage, and this is cheap to refetch, so it is
  // deliberately memory-only for the tab.
  wnbaStartersCache.set(eventId, { data, fetchedAt: Date.now() });
  return data;
}

// Live rosters for every franchise, memoised for the tab. Individual team
// failures are tolerated -- that team simply falls back to its static roster
// (or to no players, which excludes its players without excluding its game).
let wnbaLiveRosters = null;
async function fetchWNBAAllRosters() {
  if (wnbaLiveRosters) return wnbaLiveRosters;
  const abbrs = Object.keys(WNBA_TEAM_ESPN_ID);
  const results = await Promise.all(abbrs.map((a) => fetchWNBATeamRoster(a).catch(() => null)));
  const byAbbr = {};
  results.forEach((r, i) => { if (r && r.players.length) byAbbr[abbrs[i]] = r.players; });
  wnbaLiveRosters = { byAbbr, all: Object.values(byAbbr).flat() };
  return wnbaLiveRosters.all;
}

// The roster a screen should use for a team: live if we have it, the
// hand-written array if not. Never throws and never returns undefined, so a
// caller can always render a game even when it has nobody to list under it.
function wnbaRosterFor(abbr) {
  const live = wnbaLiveRosters && wnbaLiveRosters.byAbbr[abbr];
  if (live && live.length) return live;
  return WNBA_TEAM_PLAYERS_BY_ABBR[abbr] || [];
}

// Availability for a set of teams, merged into one espnId -> status map.
// Unknown players are simply absent, which is what leaves their avatar dotless.
async function fetchWNBAAvailability(abbrs) {
  const unique = [...new Set(abbrs.filter(Boolean))];
  const maps = await Promise.all(unique.map((a) => fetchWNBATeamAvailability(a).catch(() => null)));
  const merged = {};
  maps.forEach((m) => { if (m) Object.assign(merged, m); });
  return Object.keys(merged).length ? merged : null;
}

// Real players from the two games on tonight's WNBA slate (see WNBA_MATCHUPS
// below) -- a handful of rotation players per team rather than a full roster,
// same "starting lineup" scope the MLB/NFL pages use.
const DALLAS_WINGS_PLAYERS = [
  { id: "bueckers", name: "Paige Bueckers", team: "DAL", pos: "G", espnId: "4433730",
    base: { pts: 18, oreb: 0.6, dreb: 3.8, ast: 5.5, stl: 1.3, blk: 0.4, fg3m: 1.6, fg3a: 4.5, ftm: 3.0, fta: 3.5, tov: 2.6 },
    var:  { pts: 6,  oreb: 0.6, dreb: 1.8, ast: 2.4, stl: 0.9, blk: 0.4, fg3m: 1.2, fg3a: 1.8, ftm: 1.6, fta: 1.8, tov: 1.3 } },
  { id: "ogunbowale", name: "Arike Ogunbowale", team: "DAL", pos: "G", espnId: "3904577",
    base: { pts: 20, oreb: 0.4, dreb: 3.0, ast: 3.8, stl: 1.0, blk: 0.2, fg3m: 2.6, fg3a: 7.0, ftm: 3.5, fta: 4.0, tov: 2.8 },
    var:  { pts: 7,  oreb: 0.4, dreb: 1.4, ast: 1.8, stl: 0.7, blk: 0.2, fg3m: 1.4, fg3a: 2.2, ftm: 1.8, fta: 2.0, tov: 1.4 } },
  { id: "asmith", name: "Alanna Smith", team: "DAL", pos: "F", espnId: "3913881",
    base: { pts: 9, oreb: 1.6, dreb: 4.5, ast: 1.6, stl: 1.0, blk: 1.1, fg3m: 0.9, fg3a: 2.6, ftm: 1.0, fta: 1.3, tov: 1.2 },
    var:  { pts: 4, oreb: 1.0, dreb: 1.8, ast: 1.0, stl: 0.6, blk: 0.7, fg3m: 0.7, fg3a: 1.2, ftm: 0.8, fta: 1.0, tov: 0.8 } },
  { id: "liyueru", name: "Li Yueru", team: "DAL", pos: "C", espnId: "4336633",
    base: { pts: 8, oreb: 1.8, dreb: 4.0, ast: 1.0, stl: 0.5, blk: 0.7, fg3m: 0.3, fg3a: 1.0, ftm: 1.2, fta: 1.6, tov: 1.1 },
    var:  { pts: 4, oreb: 1.1, dreb: 1.8, ast: 0.7, stl: 0.4, blk: 0.5, fg3m: 0.4, fg3a: 0.7, ftm: 0.8, fta: 1.0, tov: 0.7 } },
  { id: "ajames", name: "Aziaha James", team: "DAL", pos: "G", espnId: "4433807",
    base: { pts: 7, oreb: 0.5, dreb: 1.8, ast: 2.2, stl: 0.7, blk: 0.2, fg3m: 0.8, fg3a: 2.4, ftm: 0.8, fta: 1.0, tov: 1.0 },
    var:  { pts: 3.5, oreb: 0.4, dreb: 1.0, ast: 1.2, stl: 0.5, blk: 0.2, fg3m: 0.7, fg3a: 1.2, ftm: 0.6, fta: 0.8, tov: 0.7 } },
];
const ATLANTA_DREAM_PLAYERS = [
  { id: "agray", name: "Allisha Gray", team: "ATL", pos: "G", espnId: "3058901",
    base: { pts: 17, oreb: 0.7, dreb: 3.5, ast: 3.0, stl: 1.4, blk: 0.4, fg3m: 2.0, fg3a: 5.2, ftm: 2.6, fta: 3.0, tov: 1.8 },
    var:  { pts: 6, oreb: 0.5, dreb: 1.6, ast: 1.6, blk: 0.3, stl: 0.8, fg3m: 1.2, fg3a: 1.8, ftm: 1.4, fta: 1.6, tov: 1.0 } },
  { id: "rhowarD", name: "Rhyne Howard", team: "ATL", pos: "G", espnId: "4398674",
    base: { pts: 16, oreb: 0.5, dreb: 3.2, ast: 2.8, stl: 1.1, blk: 0.3, fg3m: 2.4, fg3a: 6.5, ftm: 2.2, fta: 2.6, tov: 1.9 },
    var:  { pts: 6, oreb: 0.4, dreb: 1.5, ast: 1.4, stl: 0.7, blk: 0.3, fg3m: 1.3, fg3a: 2.0, ftm: 1.2, fta: 1.4, tov: 1.1 } },
  { id: "areese", name: "Angel Reese", team: "ATL", pos: "F", espnId: "4433402",
    base: { pts: 14, oreb: 4.0, dreb: 8.0, ast: 2.0, stl: 1.3, blk: 0.9, fg3m: 0.1, fg3a: 0.4, ftm: 2.0, fta: 3.2, tov: 2.2 },
    var:  { pts: 5, oreb: 1.8, dreb: 2.6, ast: 1.1, stl: 0.7, blk: 0.6, fg3m: 0.2, fg3a: 0.4, ftm: 1.2, fta: 1.8, tov: 1.2 } },
  { id: "bjones", name: "Brionna Jones", team: "ATL", pos: "F", espnId: "3058895",
    base: { pts: 11, oreb: 2.6, dreb: 5.0, ast: 1.4, stl: 0.7, blk: 0.6, fg3m: 0.0, fg3a: 0.1, ftm: 2.4, fta: 3.0, tov: 1.5 },
    var:  { pts: 4, oreb: 1.4, dreb: 2.0, ast: 0.9, stl: 0.5, blk: 0.4, fg3m: 0.1, fg3a: 0.2, ftm: 1.3, fta: 1.6, tov: 0.9 } },
  { id: "jcanada", name: "Jordin Canada", team: "ATL", pos: "G", espnId: "3142250",
    base: { pts: 8, oreb: 0.4, dreb: 2.2, ast: 5.0, stl: 1.2, blk: 0.2, fg3m: 0.6, fg3a: 1.8, ftm: 0.8, fta: 1.0, tov: 1.6 },
    var:  { pts: 3.5, oreb: 0.4, dreb: 1.1, ast: 2.0, stl: 0.7, blk: 0.2, fg3m: 0.6, fg3a: 1.1, ftm: 0.6, fta: 0.8, tov: 1.0 } },
];
const PHOENIX_MERCURY_PLAYERS = [
  { id: "kcopper", name: "Kahleah Copper", team: "PHX", pos: "G", espnId: "2998938",
    base: { pts: 19, oreb: 0.7, dreb: 3.6, ast: 2.6, stl: 1.2, blk: 0.3, fg3m: 1.6, fg3a: 4.5, ftm: 3.8, fta: 4.4, tov: 2.0 },
    var:  { pts: 6, oreb: 0.5, dreb: 1.6, ast: 1.4, stl: 0.7, blk: 0.3, fg3m: 1.1, fg3a: 1.8, ftm: 1.6, fta: 1.8, tov: 1.1 } },
  { id: "athomas", name: "Alyssa Thomas", team: "PHX", pos: "F", espnId: "2529140",
    base: { pts: 13, oreb: 2.0, dreb: 6.5, ast: 7.5, stl: 1.6, blk: 0.5, fg3m: 0.1, fg3a: 0.3, ftm: 2.6, fta: 3.6, tov: 3.2 },
    var:  { pts: 5, oreb: 1.1, dreb: 2.2, ast: 2.6, stl: 0.8, blk: 0.4, fg3m: 0.2, fg3a: 0.3, ftm: 1.4, fta: 1.8, tov: 1.4 } },
  { id: "dbonner", name: "DeWanna Bonner", team: "PHX", pos: "F", espnId: "869",
    base: { pts: 12, oreb: 0.9, dreb: 4.2, ast: 2.0, stl: 0.9, blk: 0.5, fg3m: 1.8, fg3a: 4.8, ftm: 2.0, fta: 2.3, tov: 1.5 },
    var:  { pts: 5, oreb: 0.6, dreb: 1.7, ast: 1.1, stl: 0.6, blk: 0.4, fg3m: 1.1, fg3a: 1.8, ftm: 1.1, fta: 1.2, tov: 0.9 } },
  { id: "swhitcomb", name: "Sami Whitcomb", team: "PHX", pos: "G", espnId: "887",
    base: { pts: 7, oreb: 0.4, dreb: 2.0, ast: 2.2, stl: 0.7, blk: 0.2, fg3m: 1.4, fg3a: 3.6, ftm: 0.5, fta: 0.6, tov: 0.9 },
    var:  { pts: 3.5, oreb: 0.4, dreb: 1.0, ast: 1.2, stl: 0.5, blk: 0.2, fg3m: 1.0, fg3a: 1.5, ftm: 0.4, fta: 0.5, tov: 0.7 } },
  { id: "klinskens", name: "Kyara Linskens", team: "PHX", pos: "C", espnId: "4873359",
    base: { pts: 6, oreb: 1.6, dreb: 3.2, ast: 1.0, stl: 0.5, blk: 0.6, fg3m: 0.0, fg3a: 0.1, ftm: 0.8, fta: 1.1, tov: 0.9 },
    var:  { pts: 3, oreb: 1.0, dreb: 1.5, ast: 0.7, stl: 0.4, blk: 0.4, fg3m: 0.1, fg3a: 0.2, ftm: 0.6, fta: 0.8, tov: 0.6 } },
];
const GOLDEN_STATE_VALKYRIES_PLAYERS = [
  { id: "kthornton", name: "Kayla Thornton", team: "GS", pos: "F", espnId: "2529622",
    base: { pts: 13, oreb: 1.2, dreb: 3.8, ast: 1.6, stl: 1.0, blk: 0.7, fg3m: 1.2, fg3a: 3.2, ftm: 1.8, fta: 2.2, tov: 1.4 },
    var:  { pts: 5, oreb: 0.8, dreb: 1.6, ast: 1.0, stl: 0.6, blk: 0.5, fg3m: 0.9, fg3a: 1.4, ftm: 1.1, fta: 1.3, tov: 0.9 } },
  { id: "vburton", name: "Veronica Burton", team: "GS", pos: "G", espnId: "4398935",
    base: { pts: 9, oreb: 0.4, dreb: 2.4, ast: 4.6, stl: 1.7, blk: 0.2, fg3m: 0.7, fg3a: 2.0, ftm: 1.0, fta: 1.2, tov: 1.6 },
    var:  { pts: 4, oreb: 0.4, dreb: 1.2, ast: 1.9, stl: 0.9, blk: 0.2, fg3m: 0.6, fg3a: 1.1, ftm: 0.7, fta: 0.8, tov: 1.0 } },
  { id: "thayes", name: "Tiffany Hayes", team: "GS", pos: "G", espnId: "1054",
    base: { pts: 12, oreb: 0.6, dreb: 2.6, ast: 2.4, stl: 1.0, blk: 0.3, fg3m: 1.6, fg3a: 4.2, ftm: 1.6, fta: 1.9, tov: 1.3 },
    var:  { pts: 5, oreb: 0.5, dreb: 1.3, ast: 1.3, stl: 0.6, blk: 0.3, fg3m: 1.0, fg3a: 1.6, ftm: 1.0, fta: 1.1, tov: 0.9 } },
  { id: "gwilliams", name: "Gabby Williams", team: "GS", pos: "F", espnId: "3142328",
    base: { pts: 11, oreb: 1.2, dreb: 3.6, ast: 3.2, stl: 1.8, blk: 0.5, fg3m: 0.4, fg3a: 1.4, ftm: 1.4, fta: 1.9, tov: 1.7 },
    var:  { pts: 4.5, oreb: 0.8, dreb: 1.6, ast: 1.5, stl: 0.9, blk: 0.4, fg3m: 0.4, fg3a: 0.9, ftm: 1.0, fta: 1.2, tov: 1.0 } },
  { id: "kstokes", name: "Kiah Stokes", team: "GS", pos: "C", espnId: "2590093",
    base: { pts: 5, oreb: 1.8, dreb: 3.4, ast: 0.6, stl: 0.4, blk: 1.0, fg3m: 0.0, fg3a: 0.0, ftm: 0.6, fta: 0.9, tov: 0.6 },
    var:  { pts: 2.5, oreb: 1.1, dreb: 1.6, ast: 0.5, stl: 0.3, blk: 0.7, fg3m: 0.0, fg3a: 0.0, ftm: 0.5, fta: 0.7, tov: 0.5 } },
];

// Tomorrow's slate (see WNBA_MATCHUPS below): 6 more real rosters.
const MINNESOTA_LYNX_PLAYERS = [
  { id: "ncollier", name: "Napheesa Collier", team: "MIN", pos: "F", espnId: "3917450",
    base: { pts: 22, oreb: 1.8, dreb: 6.8, ast: 3.4, stl: 1.8, blk: 1.1, fg3m: 1.2, fg3a: 3.2, ftm: 4.5, fta: 5.2, tov: 2.2 },
    var:  { pts: 7, oreb: 1.1, dreb: 2.4, ast: 1.8, stl: 1.0, blk: 0.7, fg3m: 0.9, fg3a: 1.6, ftm: 2.0, fta: 2.2, tov: 1.2 } },
  { id: "kmcbride", name: "Kayla McBride", team: "MIN", pos: "G", espnId: "2529205",
    base: { pts: 14, oreb: 0.4, dreb: 2.6, ast: 2.4, stl: 0.9, blk: 0.2, fg3m: 2.2, fg3a: 5.5, ftm: 1.6, fta: 1.9, tov: 1.3 },
    var:  { pts: 5, oreb: 0.4, dreb: 1.2, ast: 1.3, stl: 0.6, blk: 0.2, fg3m: 1.2, fg3a: 1.9, ftm: 1.0, fta: 1.2, tov: 0.8 } },
  { id: "cwilliams", name: "Courtney Williams", team: "MIN", pos: "G", espnId: "2987891",
    base: { pts: 12, oreb: 0.8, dreb: 3.4, ast: 4.8, stl: 1.2, blk: 0.3, fg3m: 0.8, fg3a: 2.4, ftm: 1.6, fta: 2.0, tov: 2.0 },
    var:  { pts: 5, oreb: 0.6, dreb: 1.5, ast: 2.0, stl: 0.7, blk: 0.3, fg3m: 0.7, fg3a: 1.3, ftm: 1.0, fta: 1.2, tov: 1.1 } },
  { id: "nhoward", name: "Natasha Howard", team: "MIN", pos: "F", espnId: "2529130",
    base: { pts: 11, oreb: 1.6, dreb: 4.6, ast: 1.6, stl: 1.1, blk: 0.9, fg3m: 0.4, fg3a: 1.2, ftm: 1.6, fta: 2.0, tov: 1.4 },
    var:  { pts: 4.5, oreb: 1.0, dreb: 1.9, ast: 1.0, stl: 0.7, blk: 0.6, fg3m: 0.4, fg3a: 0.8, ftm: 1.0, fta: 1.2, tov: 0.9 } },
  { id: "djuhasz", name: "Dorka Juhasz", team: "MIN", pos: "F", espnId: "4398938",
    base: { pts: 6, oreb: 1.4, dreb: 3.8, ast: 1.4, stl: 0.6, blk: 0.5, fg3m: 0.3, fg3a: 1.0, ftm: 0.6, fta: 0.8, tov: 1.0 },
    var:  { pts: 3, oreb: 0.9, dreb: 1.7, ast: 0.9, stl: 0.4, blk: 0.4, fg3m: 0.3, fg3a: 0.6, ftm: 0.5, fta: 0.6, tov: 0.7 } },
];
const TORONTO_TEMPO_PLAYERS = [
  { id: "mmabrey", name: "Marina Mabrey", team: "TOR", pos: "G", espnId: "3904576",
    base: { pts: 15, oreb: 0.4, dreb: 2.6, ast: 3.4, stl: 0.9, blk: 0.2, fg3m: 2.4, fg3a: 6.4, ftm: 2.0, fta: 2.4, tov: 2.0 },
    var:  { pts: 5.5, oreb: 0.4, dreb: 1.2, ast: 1.6, stl: 0.6, blk: 0.2, fg3m: 1.3, fg3a: 2.0, ftm: 1.2, fta: 1.4, tov: 1.1 } },
  { id: "bsykes", name: "Brittney Sykes", team: "TOR", pos: "G", espnId: "2988756",
    base: { pts: 13, oreb: 0.6, dreb: 3.0, ast: 2.6, stl: 1.6, blk: 0.3, fg3m: 1.2, fg3a: 3.4, ftm: 2.0, fta: 2.5, tov: 1.7 },
    var:  { pts: 5, oreb: 0.5, dreb: 1.4, ast: 1.4, stl: 0.9, blk: 0.3, fg3m: 0.9, fg3a: 1.5, ftm: 1.1, fta: 1.3, tov: 1.0 } },
  { id: "knurse", name: "Kia Nurse", team: "TOR", pos: "G", espnId: "3142327",
    base: { pts: 10, oreb: 0.4, dreb: 2.4, ast: 1.8, stl: 0.7, blk: 0.2, fg3m: 1.6, fg3a: 4.2, ftm: 1.2, fta: 1.4, tov: 1.1 },
    var:  { pts: 4.5, oreb: 0.4, dreb: 1.1, ast: 1.0, stl: 0.5, blk: 0.2, fg3m: 1.0, fg3a: 1.7, ftm: 0.8, fta: 0.9, tov: 0.7 } },
  { id: "iharrison", name: "Isabelle Harrison", team: "TOR", pos: "F", espnId: "2566453",
    base: { pts: 8, oreb: 1.8, dreb: 4.4, ast: 1.2, stl: 0.6, blk: 0.6, fg3m: 0.1, fg3a: 0.4, ftm: 1.4, fta: 1.9, tov: 1.1 },
    var:  { pts: 3.5, oreb: 1.1, dreb: 1.8, ast: 0.8, stl: 0.4, blk: 0.4, fg3m: 0.1, fg3a: 0.3, ftm: 0.9, fta: 1.2, tov: 0.7 } },
  { id: "nsabally", name: "Nyara Sabally", team: "TOR", pos: "F", espnId: "4398768",
    base: { pts: 7, oreb: 1.4, dreb: 3.6, ast: 1.0, stl: 0.5, blk: 0.7, fg3m: 0.2, fg3a: 0.7, ftm: 0.8, fta: 1.1, tov: 0.9 },
    var:  { pts: 3, oreb: 0.9, dreb: 1.6, ast: 0.6, stl: 0.4, blk: 0.5, fg3m: 0.2, fg3a: 0.5, ftm: 0.6, fta: 0.8, tov: 0.6 } },
];
const CONNECTICUT_SUN_PLAYERS = [
  { id: "bgriner", name: "Brittney Griner", team: "CON", pos: "C", espnId: "2490553",
    base: { pts: 16, oreb: 1.6, dreb: 5.4, ast: 1.0, stl: 0.5, blk: 1.8, fg3m: 0.0, fg3a: 0.1, ftm: 3.0, fta: 3.8, tov: 2.0 },
    var:  { pts: 6, oreb: 1.0, dreb: 2.2, ast: 0.7, stl: 0.4, blk: 1.1, fg3m: 0.0, fg3a: 0.1, ftm: 1.6, fta: 2.0, tov: 1.1 } },
  { id: "amorrow", name: "Aneesah Morrow", team: "CON", pos: "F", espnId: "4684384",
    base: { pts: 12, oreb: 3.4, dreb: 6.8, ast: 1.2, stl: 1.0, blk: 0.5, fg3m: 0.1, fg3a: 0.3, ftm: 2.0, fta: 2.8, tov: 1.6 },
    var:  { pts: 5, oreb: 1.7, dreb: 2.4, ast: 0.8, stl: 0.6, blk: 0.4, fg3m: 0.1, fg3a: 0.2, ftm: 1.2, fta: 1.6, tov: 1.0 } },
  { id: "aedwards", name: "Aaliyah Edwards", team: "CON", pos: "F", espnId: "4433408",
    base: { pts: 9, oreb: 1.8, dreb: 4.0, ast: 1.0, stl: 0.6, blk: 0.5, fg3m: 0.1, fg3a: 0.3, ftm: 1.2, fta: 1.6, tov: 1.1 },
    var:  { pts: 4, oreb: 1.1, dreb: 1.7, ast: 0.7, stl: 0.4, blk: 0.4, fg3m: 0.1, fg3a: 0.2, ftm: 0.8, fta: 1.0, tov: 0.7 } },
  { id: "hvanlith", name: "Hailey Van Lith", team: "CON", pos: "G", espnId: "4433412",
    base: { pts: 10, oreb: 0.5, dreb: 2.4, ast: 2.8, stl: 1.0, blk: 0.2, fg3m: 1.0, fg3a: 2.8, ftm: 1.4, fta: 1.7, tov: 1.6 },
    var:  { pts: 4.5, oreb: 0.4, dreb: 1.2, ast: 1.4, stl: 0.6, blk: 0.2, fg3m: 0.8, fg3a: 1.4, ftm: 0.9, fta: 1.1, tov: 1.0 } },
  { id: "dmiller", name: "Diamond Miller", team: "CON", pos: "F", espnId: "4433635",
    base: { pts: 8, oreb: 0.9, dreb: 2.8, ast: 1.6, stl: 0.8, blk: 0.4, fg3m: 0.7, fg3a: 2.0, ftm: 1.0, fta: 1.3, tov: 1.2 },
    var:  { pts: 3.5, oreb: 0.6, dreb: 1.3, ast: 1.0, stl: 0.5, blk: 0.3, fg3m: 0.6, fg3a: 1.1, ftm: 0.7, fta: 0.9, tov: 0.8 } },
];
const CHICAGO_SKY_PLAYERS = [
  { id: "kcardoso", name: "Kamilla Cardoso", team: "CHI", pos: "C", espnId: "4433405",
    base: { pts: 13, oreb: 2.6, dreb: 6.4, ast: 1.4, stl: 0.6, blk: 1.2, fg3m: 0.0, fg3a: 0.1, ftm: 2.0, fta: 2.8, tov: 1.8 },
    var:  { pts: 5, oreb: 1.4, dreb: 2.3, ast: 0.9, stl: 0.4, blk: 0.8, fg3m: 0.0, fg3a: 0.1, ftm: 1.2, fta: 1.6, tov: 1.0 } },
  { id: "dcarrington", name: "DiJonai Carrington", team: "CHI", pos: "G", espnId: "4066548",
    base: { pts: 12, oreb: 0.9, dreb: 3.6, ast: 2.8, stl: 1.6, blk: 0.4, fg3m: 0.8, fg3a: 2.4, ftm: 2.4, fta: 3.0, tov: 1.8 },
    var:  { pts: 5, oreb: 0.6, dreb: 1.6, ast: 1.4, stl: 0.9, blk: 0.3, fg3m: 0.6, fg3a: 1.3, ftm: 1.3, fta: 1.6, tov: 1.0 } },
  { id: "rjackson", name: "Rickea Jackson", team: "CHI", pos: "F", espnId: "4433630",
    base: { pts: 13, oreb: 0.6, dreb: 2.8, ast: 1.4, stl: 0.7, blk: 0.3, fg3m: 1.4, fg3a: 3.8, ftm: 1.8, fta: 2.1, tov: 1.3 },
    var:  { pts: 5, oreb: 0.5, dreb: 1.3, ast: 0.8, stl: 0.5, blk: 0.3, fg3m: 1.0, fg3a: 1.6, ftm: 1.0, fta: 1.2, tov: 0.8 } },
  { id: "cvandersloot", name: "Courtney Vandersloot", team: "CHI", pos: "G", espnId: "981",
    base: { pts: 8, oreb: 0.4, dreb: 2.4, ast: 6.5, stl: 1.0, blk: 0.1, fg3m: 0.8, fg3a: 2.2, ftm: 0.8, fta: 1.0, tov: 2.0 },
    var:  { pts: 3.5, oreb: 0.4, dreb: 1.1, ast: 2.4, stl: 0.6, blk: 0.1, fg3m: 0.6, fg3a: 1.2, ftm: 0.6, fta: 0.8, tov: 1.1 } },
  { id: "astevens", name: "Azura Stevens", team: "CHI", pos: "F", espnId: "3142010",
    base: { pts: 9, oreb: 1.2, dreb: 3.8, ast: 1.2, stl: 0.7, blk: 0.9, fg3m: 0.8, fg3a: 2.2, ftm: 1.0, fta: 1.3, tov: 1.0 },
    var:  { pts: 4, oreb: 0.8, dreb: 1.6, ast: 0.7, stl: 0.5, blk: 0.6, fg3m: 0.6, fg3a: 1.2, ftm: 0.7, fta: 0.9, tov: 0.7 } },
];
const NEW_YORK_LIBERTY_PLAYERS = [
  { id: "bstewart", name: "Breanna Stewart", team: "NY", pos: "F", espnId: "2998928",
    base: { pts: 21, oreb: 1.6, dreb: 7.4, ast: 3.6, stl: 1.2, blk: 1.6, fg3m: 2.0, fg3a: 5.4, ftm: 4.6, fta: 5.4, tov: 2.6 },
    var:  { pts: 7, oreb: 1.0, dreb: 2.5, ast: 1.8, stl: 0.7, blk: 1.0, fg3m: 1.2, fg3a: 2.0, ftm: 2.0, fta: 2.2, tov: 1.3 } },
  { id: "sionescu", name: "Sabrina Ionescu", team: "NY", pos: "G", espnId: "4066533",
    base: { pts: 17, oreb: 0.5, dreb: 3.6, ast: 5.0, stl: 1.0, blk: 0.2, fg3m: 3.0, fg3a: 7.6, ftm: 2.4, fta: 2.7, tov: 2.2 },
    var:  { pts: 6, oreb: 0.4, dreb: 1.5, ast: 2.0, stl: 0.6, blk: 0.2, fg3m: 1.5, fg3a: 2.4, ftm: 1.3, fta: 1.5, tov: 1.1 } },
  { id: "jjones", name: "Jonquel Jones", team: "NY", pos: "C", espnId: "2999101",
    base: { pts: 12, oreb: 1.8, dreb: 5.6, ast: 2.4, stl: 0.7, blk: 0.7, fg3m: 1.0, fg3a: 2.8, ftm: 1.4, fta: 1.7, tov: 1.4 },
    var:  { pts: 5, oreb: 1.1, dreb: 2.1, ast: 1.2, stl: 0.5, blk: 0.5, fg3m: 0.7, fg3a: 1.4, ftm: 0.9, fta: 1.1, tov: 0.9 } },
  { id: "ssabally", name: "Satou Sabally", team: "NY", pos: "F", espnId: "4281929",
    base: { pts: 14, oreb: 1.2, dreb: 4.4, ast: 2.6, stl: 0.9, blk: 0.6, fg3m: 1.2, fg3a: 3.4, ftm: 3.0, fta: 3.6, tov: 2.0 },
    var:  { pts: 5.5, oreb: 0.8, dreb: 1.8, ast: 1.4, stl: 0.6, blk: 0.4, fg3m: 0.9, fg3a: 1.6, ftm: 1.6, fta: 1.9, tov: 1.1 } },
  { id: "blaney", name: "Betnijah Laney-Hamilton", team: "NY", pos: "G", espnId: "2593770",
    base: { pts: 9, oreb: 0.7, dreb: 2.6, ast: 1.6, stl: 1.0, blk: 0.3, fg3m: 1.0, fg3a: 2.8, ftm: 1.4, fta: 1.7, tov: 1.0 },
    var:  { pts: 4, oreb: 0.5, dreb: 1.2, ast: 0.9, stl: 0.6, blk: 0.3, fg3m: 0.7, fg3a: 1.4, ftm: 0.9, fta: 1.1, tov: 0.7 } },
];
const LAS_VEGAS_ACES_PLAYERS = [
  { id: "ajwilson", name: "A'ja Wilson", team: "LV", pos: "C", espnId: "3149391",
    base: { pts: 24, oreb: 2.4, dreb: 7.4, ast: 2.4, stl: 1.4, blk: 2.2, fg3m: 0.6, fg3a: 1.6, ftm: 5.0, fta: 6.0, tov: 2.4 },
    var:  { pts: 7, oreb: 1.3, dreb: 2.5, ast: 1.3, stl: 0.8, blk: 1.2, fg3m: 0.5, fg3a: 1.0, ftm: 2.2, fta: 2.5, tov: 1.2 } },
  { id: "jyoung", name: "Jackie Young", team: "LV", pos: "G", espnId: "4065870",
    base: { pts: 15, oreb: 0.6, dreb: 3.4, ast: 4.6, stl: 1.1, blk: 0.3, fg3m: 1.4, fg3a: 3.6, ftm: 2.4, fta: 2.8, tov: 1.8 },
    var:  { pts: 5.5, oreb: 0.5, dreb: 1.5, ast: 2.0, stl: 0.6, blk: 0.3, fg3m: 1.0, fg3a: 1.7, ftm: 1.3, fta: 1.5, tov: 1.0 } },
  { id: "cgray", name: "Chelsea Gray", team: "LV", pos: "G", espnId: "2529122",
    base: { pts: 12, oreb: 0.4, dreb: 2.6, ast: 6.8, stl: 0.9, blk: 0.2, fg3m: 1.2, fg3a: 3.0, ftm: 1.4, fta: 1.6, tov: 2.0 },
    var:  { pts: 5, oreb: 0.4, dreb: 1.2, ast: 2.4, stl: 0.6, blk: 0.2, fg3m: 0.8, fg3a: 1.5, ftm: 0.9, fta: 1.1, tov: 1.1 } },
  { id: "jloyd", name: "Jewell Loyd", team: "LV", pos: "G", espnId: "2987869",
    base: { pts: 16, oreb: 0.6, dreb: 2.8, ast: 2.4, stl: 0.9, blk: 0.3, fg3m: 2.4, fg3a: 6.4, ftm: 2.4, fta: 2.8, tov: 1.7 },
    var:  { pts: 6, oreb: 0.5, dreb: 1.3, ast: 1.3, stl: 0.6, blk: 0.3, fg3m: 1.3, fg3a: 2.1, ftm: 1.3, fta: 1.5, tov: 1.0 } },
  { id: "nsmith", name: "NaLyssa Smith", team: "LV", pos: "F", espnId: "4398776",
    base: { pts: 10, oreb: 2.2, dreb: 5.4, ast: 1.2, stl: 0.7, blk: 0.6, fg3m: 0.2, fg3a: 0.6, ftm: 1.4, fta: 1.9, tov: 1.2 },
    var:  { pts: 4.5, oreb: 1.3, dreb: 2.1, ast: 0.8, stl: 0.5, blk: 0.4, fg3m: 0.2, fg3a: 0.5, ftm: 0.9, fta: 1.2, tov: 0.8 } },
];

const ALL_WNBA_PLAYERS = [
  ...DALLAS_WINGS_PLAYERS, ...ATLANTA_DREAM_PLAYERS, ...PHOENIX_MERCURY_PLAYERS, ...GOLDEN_STATE_VALKYRIES_PLAYERS,
  ...MINNESOTA_LYNX_PLAYERS, ...TORONTO_TEMPO_PLAYERS, ...CONNECTICUT_SUN_PLAYERS, ...CHICAGO_SKY_PLAYERS,
  ...NEW_YORK_LIBERTY_PLAYERS, ...LAS_VEGAS_ACES_PLAYERS,
];

// Real WNBA slate across tonight and tomorrow (per ESPN's scoreboard), same
// "pick a matchup, see its two rosters" pattern as the NFL/MLB pages.
const WNBA_MATCHUPS = [
  {
    id: "atl-dal",
    label: "Dream @ Wings",
    teamA: { label: "Atlanta Dream", players: ATLANTA_DREAM_PLAYERS },
    teamB: { label: "Dallas Wings", players: DALLAS_WINGS_PLAYERS },
    date: "2026-07-30T00:00:00Z",
    venue: "College Park Center",
    city: "Arlington, TX",
  },
  {
    id: "gs-phx",
    label: "Valkyries @ Mercury",
    teamA: { label: "Golden State Valkyries", players: GOLDEN_STATE_VALKYRIES_PLAYERS },
    teamB: { label: "Phoenix Mercury", players: PHOENIX_MERCURY_PLAYERS },
    date: "2026-07-30T02:00:00Z",
    venue: "Mortgage Matchup Center",
    city: "Phoenix, AZ",
  },
  {
    id: "min-tor",
    label: "Lynx @ Tempo",
    teamA: { label: "Minnesota Lynx", players: MINNESOTA_LYNX_PLAYERS },
    teamB: { label: "Toronto Tempo", players: TORONTO_TEMPO_PLAYERS },
    date: "2026-07-31T00:00:00Z",
    venue: "Scotiabank Arena",
    city: "Toronto, ON",
  },
  {
    id: "con-chi",
    label: "Sun @ Sky",
    teamA: { label: "Connecticut Sun", players: CONNECTICUT_SUN_PLAYERS },
    teamB: { label: "Chicago Sky", players: CHICAGO_SKY_PLAYERS },
    date: "2026-07-31T00:00:00Z",
    venue: "Wintrust Arena",
    city: "Chicago, IL",
  },
  {
    id: "ny-lv",
    label: "Liberty @ Aces",
    teamA: { label: "New York Liberty", players: NEW_YORK_LIBERTY_PLAYERS },
    teamB: { label: "Las Vegas Aces", players: LAS_VEGAS_ACES_PLAYERS },
    date: "2026-07-31T02:00:00Z",
    venue: "Michelob ULTRA Arena",
    city: "Las Vegas, NV",
  },
];
const WNBA_MATCHUPS_BY_DATE = groupMatchupsByDate(WNBA_MATCHUPS);

// Live slate -- ESPN's free, keyless scoreboard endpoint (no API key, no
// paid tier; same host already used by fetchWNBAPlayerGameLog/
// fetchWNBATeamDefense elsewhere in this file) replaces the static
// WNBA_MATCHUPS dates/pairings above with tonight's & tomorrow's real
// games, the same way fetchMLBTeamNextGame keeps the MLB page off a frozen
// snapshot. Only games between the 10 teams we have full rosters for are
// usable; everyone else's games are filtered out rather than shown with an
// empty roster panel.
const WNBA_ESPN_TEAM_IDS = {
  ATL: 20, CHI: 19, CON: 18, DAL: 3, GS: 129689,
  LV: 17, MIN: 8, NY: 9, PHX: 11, TOR: 131935,
};
const WNBA_TEAM_PLAYERS_BY_ABBR = {
  ATL: ATLANTA_DREAM_PLAYERS, CHI: CHICAGO_SKY_PLAYERS, CON: CONNECTICUT_SUN_PLAYERS,
  DAL: DALLAS_WINGS_PLAYERS, GS: GOLDEN_STATE_VALKYRIES_PLAYERS, LV: LAS_VEGAS_ACES_PLAYERS,
  MIN: MINNESOTA_LYNX_PLAYERS, NY: NEW_YORK_LIBERTY_PLAYERS, PHX: PHOENIX_MERCURY_PLAYERS,
  TOR: TORONTO_TEMPO_PLAYERS,
};
// All 15 franchises, not just the ten with hand-written rosters. The slate
// builder reads this for every game it renders, so a missing entry here is a
// dropped game -- which is exactly the bug this map used to cause.
const WNBA_TEAM_FULL_NAME = {
  ATL: "Atlanta Dream", CHI: "Chicago Sky", CON: "Connecticut Sun", DAL: "Dallas Wings",
  GS: "Golden State Valkyries", IND: "Indiana Fever", LA: "Los Angeles Sparks",
  LV: "Las Vegas Aces", MIN: "Minnesota Lynx", NY: "New York Liberty",
  PHX: "Phoenix Mercury", POR: "Portland Fire", SEA: "Seattle Storm",
  TOR: "Toronto Tempo", WSH: "Washington Mystics",
};

// Projections keyed by espnId rather than by our slug, so a player who arrives
// from the live roster can pick up hand-tuned base/var if we happen to have
// written them, and simply go without if we haven't. The slug is carried along
// so an existing player keeps the same feed pick id and saved picks still match.
const WNBA_PROJECTIONS_BY_ESPN_ID = {};
ALL_WNBA_PLAYERS.forEach((p) => {
  if (p.espnId) WNBA_PROJECTIONS_BY_ESPN_ID[String(p.espnId)] = { id: p.id, base: p.base, var: p.var };
});

const WNBA_SCHEDULE_TTL_MS = 60 * 60 * 1000;
let wnbaScheduleCache = null;
// Resolves to { matchups, unreadable, fetchFailed } -- the diagnostics travel
// with the data so the page can distinguish "quiet slate" from "we failed to
// read four games", which a bare array cannot express.
async function fetchWNBALiveSlate() {
  const cacheKey = "wnba_live_slate_v1";
  const now = Date.now();
  if (wnbaScheduleCache && now - wnbaScheduleCache.fetchedAt < WNBA_SCHEDULE_TTL_MS) {
    return wnbaScheduleCache;
  }
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (now - parsed.fetchedAt < WNBA_SCHEDULE_TTL_MS) {
        wnbaScheduleCache = parsed;
        return parsed;
      }
    }
  } catch {}

  // Rosters first: the parser attaches each team's players as it builds the
  // matchup, so without this the five teams we never hand-wrote would render
  // their game with an empty player list on the very first load.
  try { await fetchWNBAAllRosters(); } catch {}

  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const today = new Date();
  const dayAfter = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
  let matchups = [];
  // Events the parser could not read at all. Collected rather than swallowed so
  // the page can say "3 games could not be loaded" instead of quietly showing a
  // short slate -- a missing row is indistinguishable from a light schedule.
  const unreadable = [];
  let fetchFailed = false;
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=${fmt(today)}-${fmt(dayAfter)}`
    );
    const data = await res.json();
    matchups = (data?.events || [])
      .map((ev) => {
        const comp = ev.competitions?.[0];
        const competitors = comp?.competitors || [];
        const home = competitors.find((c) => c.homeAway === "home");
        const away = competitors.find((c) => c.homeAway === "away");
        const homeAbbr = home?.team?.abbreviation;
        const awayAbbr = away?.team?.abbreviation;
        // Deliberately NOT gated on having a roster for both teams. That
        // guard used to drop the whole matchup when either side was one of
        // the five franchises without a hand-written roster, which silently
        // removed four of the seven games on a typical three-day window. A
        // game with partial player data is still a game: it appears on the
        // slate with whichever players do have data. Only a genuinely
        // unreadable event -- no abbreviations at all -- is skipped, and that
        // is surfaced as a visible error rather than a missing row.
        if (!homeAbbr || !awayAbbr) {
          unreadable.push(ev?.id || ev?.name || "unknown event");
          return null;
        }
        const venue = comp?.venue;
        const city = venue?.address
          ? [venue.address.city, venue.address.state].filter(Boolean).join(", ")
          : "";
        return {
          id: `${awayAbbr}-${homeAbbr}-${ev.id}`,
          espnEventId: ev.id,
          label: `${(WNBA_TEAM_FULL_NAME[awayAbbr] || awayAbbr).split(" ").pop()} @ ${(WNBA_TEAM_FULL_NAME[homeAbbr] || homeAbbr).split(" ").pop()}`,
          teamA: { abbr: awayAbbr, label: WNBA_TEAM_FULL_NAME[awayAbbr] || awayAbbr, players: wnbaRosterFor(awayAbbr) },
          teamB: { abbr: homeAbbr, label: WNBA_TEAM_FULL_NAME[homeAbbr] || homeAbbr, players: wnbaRosterFor(homeAbbr) },
          date: ev.date,
          venue: venue?.fullName || "",
          city,
        };
      })
      .filter(Boolean);
  } catch {
    fetchFailed = true;
  }

  const record = { matchups, unreadable, fetchFailed, fetchedAt: now };
  wnbaScheduleCache = record;
  try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
  return record;
}

// Same synthetic-game-log approach as genGames (NBA) -- per-player base/var
// noised out into a season's worth of games -- just drawing its random
// opponent from the WNBA's own team pool instead of the NBA's.
// Synthetic fallback for players we hand-wrote projections for. Returns null
// rather than throwing when a player has none -- every base/var read below is
// guarded, because an unguarded `base.pts` on a live-roster call-up used
// to take the whole page tree down through the ErrorBoundary.
function genWNBAGames(player, seedOffset) {
  const base = player && player.base;
  const varr = player && player.var;
  if (!base || !varr) return null;
  const rng = mulberry32(2000 + seedOffset);
  const opponents = WNBA_TEAMS.filter((t) => t !== player.team);
  const games = [];
  const startDate = new Date("2026-05-16T00:00:00Z");
  for (let i = 0; i < 20; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * 3);
    const home = rng() > 0.48;
    const opp = opponents[Math.floor(rng() * opponents.length)];
    const minutes = Math.round(24 + rng() * 12);
    const noise = (mean, spread) => Math.max(0, Math.round(mean + (rng() - 0.5) * 2 * spread));
    const fg3m = noise(base.fg3m, varr.fg3m);
    const ftm = noise(base.ftm, varr.ftm);
    games.push({
      date: d.toISOString().slice(0, 10), opp, home, minutes,
      pts: noise(base.pts, varr.pts),
      oreb: noise(base.oreb, varr.oreb),
      dreb: noise(base.dreb, varr.dreb),
      ast: noise(base.ast, varr.ast),
      stl: noise(base.stl, varr.stl),
      blk: noise(base.blk, varr.blk),
      fg3m,
      fg3a: Math.max(fg3m, noise(base.fg3a, varr.fg3a)),
      ftm,
      fta: Math.max(ftm, noise(base.fta, varr.fta)),
      tov: noise(base.tov, varr.tov),
    });
  }
  return games;
}

// Populated in place by fetchWNBAPlayerGameLog once each player's real
// current-season log resolves -- same instant-fallback-then-upgrade pattern
// as NFL_REAL_GAME_LOGS above. Takes priority over genWNBAGames the moment
// it's available.
const WNBA_REAL_GAME_LOGS = {};

// ESPN's WNBA gamelog only reports combined "totalRebounds", not an
// offensive/defensive split -- there's no real number to put in oreb, so the
// full real total goes to dreb (oreb: 0) rather than fabricate a split.
// This keeps the "Total" rebounds view (the default, and by far the more
// commonly used one) fully real; only the Off/Def toggle loses precision.
function parseWNBAGameLogResponse(data) {
  const names = data?.names || [];
  const events = data?.events || {};
  const byEvent = {};

  (data?.seasonTypes || []).forEach((st) => {
    (st.categories || []).forEach((cat) => {
      (cat.events || []).forEach((ev) => {
        const meta = events[ev.eventId];
        if (!meta) return;
        if (!byEvent[ev.eventId]) byEvent[ev.eventId] = { meta, stats: {} };
        (ev.stats || []).forEach((val, i) => {
          const key = names[i];
          if (key) byEvent[ev.eventId].stats[key] = val;
        });
      });
    });
  });

  const knownTeams = new Set(WNBA_TEAMS);
  return Object.values(byEvent)
    // ESPN's gamelog includes preseason/exhibition games against opponents
    // outside the 15 real WNBA teams (e.g. "SPO") -- those aren't in
    // WNBA_TEAM_DEF/the defense-rank tables at all, so they're dropped here
    // rather than crashing every lookup that expects a real team abbreviation.
    .filter(({ meta }) => knownTeams.has(meta.opponent?.abbreviation))
    .map(({ meta, stats }) => {
      const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
      const [fg3m, fg3a] = parseMadeAttempts(stats["threePointFieldGoalsMade-threePointFieldGoalsAttempted"]);
      const [ftm, fta] = parseMadeAttempts(stats["freeThrowsMade-freeThrowsAttempted"]);
      return {
        date: (meta.gameDate || "").slice(0, 10),
        opp: meta.opponent.abbreviation,
        home: meta.atVs !== "@",
        minutes: num(stats.minutes),
        pts: num(stats.points),
        oreb: 0,
        dreb: num(stats.totalRebounds),
        ast: num(stats.assists),
        stl: num(stats.steals),
        blk: num(stats.blocks),
        fg3m, fg3a, ftm, fta,
        tov: num(stats.turnovers),
      };
    })
    .filter((g) => g.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// The WNBA season is in progress -- short TTL, refetched periodically
// (same pattern as fetchMLBGameLog) so a finished game shows up without
// needing a full page reload.
const WNBA_GAMELOG_TTL_MS = 15 * 60 * 1000;
const wnbaGameLogCache = new Map();
async function fetchWNBAPlayerGameLog(espnId) {
  const cached = wnbaGameLogCache.get(espnId);
  if (cached && Date.now() - cached.fetchedAt < WNBA_GAMELOG_TTL_MS) return cached.games;

  const cacheKey = `wnba_gamelog_v2_${espnId}`;
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Date.now() - parsed.fetchedAt < WNBA_GAMELOG_TTL_MS) {
        wnbaGameLogCache.set(espnId, parsed);
        return parsed.games;
      }
    }
  } catch {}

  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba/athletes/${espnId}/gamelog?season=2026`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const games = parseWNBAGameLogResponse(data);
    if (!games.length) return null;
    const record = { games, fetchedAt: Date.now() };
    wnbaGameLogCache.set(espnId, record);
    try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
    return games;
  } catch {
    return null;
  }
}

// Real ESPN game log first, hand-tuned synthetic second, nothing third.
// Null means "we have no games for this player" -- callers exclude them rather
// than invent a line for them. Keyed on espnId so a live-roster player resolves
// the same way a hand-written one does.
function getWNBAGames(player, seedOffset) {
  const real = player && player.espnId && WNBA_REAL_GAME_LOGS[String(player.espnId)];
  if (real && real.length) return real;
  return genWNBAGames(player, seedOffset);
}

// The one predicate for "can this player be shown at all". Used by both the
// player list and the feed so the two can never disagree about who exists.
function wnbaPlayerHasData(player, seedOffset = 0) {
  const g = getWNBAGames(player, seedOffset);
  return !!(g && g.length);
}

// Minutes per game, averaged over the player's real game log. This is measured
// data, not an estimate: ESPN's gamelog carries `minutes` per event and
// parseWNBAGameLogResponse already reads it.
//
// Note what this is NOT: a starter flag. ESPN's roster route carries no such
// field (see the roster-rail sort below), so nothing here should be labelled
// "starters" -- minutes are minutes.
function wnbaMinutesPerGame(player) {
  const games = getWNBAGames(player, 0);
  if (!games || !games.length) return null;
  const withMin = games.filter((g) => Number.isFinite(g.minutes) && g.minutes > 0);
  if (!withMin.length) return null;
  return withMin.reduce((a, g) => a + g.minutes, 0) / withMin.length;
}

// Roster rails read top-to-bottom by workload. Players whose minutes we cannot
// compute sort last rather than being treated as zero-minute players, which
// would bury a genuine starter whose log has not loaded yet.
function wnbaSortByMinutes(players) {
  return [...players].sort((a, b) => {
    const ma = wnbaMinutesPerGame(a);
    const mb = wnbaMinutesPerGame(b);
    if (ma === null && mb === null) return 0;
    if (ma === null) return 1;
    if (mb === null) return -1;
    return mb - ma;
  });
}

// Curated market list for the WNBA page -- the core box-score stats plus
// the NBA page's same combo props (PRA/RA/PR/PA).
const WNBA_MARKETS_CORE = [
  { id: "pts", label: "Points" },
  { id: "reb", label: "Rebounds" },
  { id: "ast", label: "Assists" },
  { id: "pra", label: "PRA" },
  { id: "ra", label: "RA" },
  { id: "pr", label: "PR" },
  { id: "pa", label: "PA" },
  { id: "3pm", label: "3PM" },
  { id: "stl", label: "Steals" },
  { id: "blk", label: "Blocks" },
];
// Double-double/triple-double are only offered for real players who
// actually complete that feat often -- bigs/stat-stuffers for DD, and just
// the handful of true triple-double threats (Thomas especially -- she leads
// the WNBA in career triple-doubles) for TD -- rather than showing a
// milestone market on every player that would basically never hit it.
const WNBA_MILESTONE_MARKETS = [
  { id: "dd", label: "Double-Double", binary: true },
  { id: "td", label: "Triple-Double", binary: true },
];
const WNBA_MARKETS = [...WNBA_MARKETS_CORE, ...WNBA_MILESTONE_MARKETS];
// Same grouping the NBA page uses, since the WNBA page shares its combo
// props (PRA/RA/PR/PA) -- see MarketSectionGrid.
const WNBA_MARKET_SECTIONS = [
  { label: "Core", ids: ["pts", "reb", "ast"] },
  { label: "Combos", ids: ["pra", "ra", "pr", "pa"] },
  { label: "Shooting", ids: ["3pm"] },
  { label: "Defense & hustle", ids: ["stl", "blk"] },
  { label: "Milestones", ids: ["dd", "td"], pills: true },
];
const WNBA_DD_PLAYERS = new Set(["ncollier", "areese", "athomas", "bstewart", "ajwilson", "amorrow", "bgriner", "kcardoso"]);
const WNBA_TD_PLAYERS = new Set(["athomas", "bstewart", "ajwilson"]);
function wnbaPlayerMarkets(player) {
  const extra = [];
  if (!player) return WNBA_MARKETS_CORE;
  if (WNBA_DD_PLAYERS.has(player.id)) extra.push(WNBA_MILESTONE_MARKETS[0]);
  if (WNBA_TD_PLAYERS.has(player.id)) extra.push(WNBA_MILESTONE_MARKETS[1]);
  return [...WNBA_MARKETS_CORE, ...extra];
}

function WNBAPropsPage({ jumpTo, dataVersion }) {
  // Same volume stat as the NBA page -- minutes are the input almost every
  // basketball prop scales with, so the two pages share NBA_CONTEXT_STAT.
  const [showContext, setShowContext] = useState(false);
  // Starts from the static fallback slate, then swaps to ESPN's live
  // scoreboard once it resolves (see fetchWNBALiveSlate) -- keeps the page
  // usable immediately and offline-safe if the fetch ever fails, while still
  // showing tonight's real games instead of a frozen date.
  const [liveMatchups, setLiveMatchups] = useState(null);
  // Non-null when the slate is known to be incomplete. Surfaced in the UI --
  // a game we could not read must never just be absent from the list.
  const [slateIssue, setSlateIssue] = useState(null);
  React.useEffect(() => {
    let cancelled = false;
    fetchWNBALiveSlate().then((res) => {
      if (cancelled || !res) return;
      if (res.matchups && res.matchups.length) setLiveMatchups(res.matchups);
      setSlateIssue(
        res.fetchFailed ? "fetch"
          : (res.unreadable && res.unreadable.length) ? `unreadable:${res.unreadable.length}`
          : null
      );
    });
    return () => { cancelled = true; };
  }, []);
  // Players without a game log are dropped here, once, so the selector, the
  // roster rails and the chart all agree on who exists. Dropping a player never
  // drops the game: a matchup whose roster filters down to nobody still appears
  // on the slate, it just has no players to list.
  const rawMatchups = liveMatchups && liveMatchups.length ? liveMatchups : WNBA_MATCHUPS;
  const matchups = useMemo(() => rawMatchups.map((m) => ({
    ...m,
    teamA: { ...m.teamA, players: wnbaSortByMinutes((m.teamA.players || []).filter((p) => wnbaPlayerHasData(p))) },
    teamB: { ...m.teamB, players: wnbaSortByMinutes((m.teamB.players || []).filter((p) => wnbaPlayerHasData(p))) },
  })), [rawMatchups, dataVersion]);
  const matchupsByDate = useMemo(() => groupMatchupsByDate(matchups), [matchups]);

  // Games on the slate that ended up with nobody to show. Reported rather than
  // hidden -- "this game is here but we have no player data for it" is a
  // different statement from "this game does not exist".
  const emptyMatchups = useMemo(
    () => matchups.filter((m) => !m.teamA.players.length && !m.teamB.players.length).length,
    [matchups]
  );

  const [matchupId, setMatchupId] = useState(WNBA_MATCHUPS[0].id);
  const matchup = matchups.find((m) => m.id === matchupId) || matchups[0];
  const [playerId, setPlayerId] = useState(WNBA_MATCHUPS[0].teamA.players[0].id);
  const [market, setMarket] = useState("pts");
  const [rebSplit, setRebSplit] = useState("total");

  // Availability for the two teams in view, refetched when the matchup changes.
  // Null while loading or if the fetch failed, which every consumer below reads
  // as "no dot" rather than "available" -- an unknown status must never render
  // as active.
  const [availability, setAvailability] = useState(null);
  const matchupTeams = [
    matchup?.teamA?.abbr || (matchup?.teamA?.players || [])[0]?.team,
    matchup?.teamB?.abbr || (matchup?.teamB?.players || [])[0]?.team,
  ].filter(Boolean).join(",");
  React.useEffect(() => {
    let cancelled = false;
    setAvailability(null);
    if (!matchupTeams) return undefined;
    fetchWNBAAvailability(matchupTeams.split(","))
      .then((m) => { if (!cancelled) setAvailability(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [matchupTeams]);
  const statusOf = React.useCallback(
    (p) => (availability && p && p.espnId ? availability[String(p.espnId)] : undefined),
    [availability]
  );

  // Real starter flags for the selected game (see fetchWNBAStarters). Null
  // until they resolve, and null forever if the box score has none -- both of
  // which mean "no divider", never a guessed split.
  const [starters, setStarters] = useState(null);
  // The matchup id is `AWAY-HOME-<espnEventId>`, so the id is recoverable even
  // from a slate cached by a build that predates the espnEventId field -- the
  // schedule cache has a one-hour TTL and outlives a deploy.
  const espnEventId = matchup?.espnEventId || String(matchup?.id || "").split("-").pop();
  React.useEffect(() => {
    let cancelled = false;
    setStarters(null);
    if (!espnEventId) return undefined;
    fetchWNBAStarters(espnEventId)
      .then((d) => { if (!cancelled) setStarters(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [espnEventId]);

  // Split a team's rail into STARTERS / BENCH, each already MPG-sorted by the
  // matchup memo. Returns a single unlabelled section when there is no starter
  // data, which is what makes the fallback a plain list rather than a guess.
  const sectionsFor = React.useCallback((players, abbr) => {
    const ids = starters && starters.byTeam && starters.byTeam[abbr];
    if (!ids || !ids.size) return [{ label: null, players }];
    const isStarter = (p) => p.espnId && ids.has(String(p.espnId));
    const a = players.filter(isStarter);
    const b = players.filter((p) => !isStarter(p));
    if (!a.length) return [{ label: null, players }];
    const when = starters.fromThisGame ? "THIS GAME" : "LAST GAME";
    const date = (starters.dateByTeam || {})[abbr];
    return [
      { label: "STARTERS", note: date ? `${when} · ${date}` : when, players: a },
      { label: "BENCH", note: null, players: b },
    ];
  }, [starters]);
  // Once the live slate lands, jump off the static default matchup/player
  // onto the real first game of the day (its id won't exist in WNBA_MATCHUPS).
  React.useEffect(() => {
    if (!liveMatchups || !liveMatchups.length) return;
    if (!liveMatchups.some((m) => m.id === matchupId)) {
      setMatchupId(liveMatchups[0].id);
      setPlayerId(liveMatchups[0].teamA.players[0].id);
      setLine(null);
      setOpponent("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMatchups]);
  React.useEffect(() => {
    if (!jumpTo) return;
    setPlayerId(jumpTo.playerId);
    setMarket(jumpTo.market);
    setLine(null);
    setOpponent("all");
    setTimeout(() => chartRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo && jumpTo.nonce]);
  const [side, setSide] = useState("all");
  const [lastN, setLastN] = useState(10);
  const [opponent, setOpponent] = useState("all");
  const [minMinutes, setMinMinutes] = useState(0);
  const [maxMinutes, setMaxMinutes] = useState(40);
  const [minutesRangeEnabled, setMinutesRangeEnabled] = useState(false);
  const [line, setLine] = useState(null);
  const [dragLine, setDragLine] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const chartRef = React.useRef(null);
  const chartWidth = useElementWidth(chartRef);
  const isNarrow = useIsNarrow();

  // Same breakpoint the roster columns collapse at (see .roster-layout in
  // index.css). Above it the graph card sits in the narrow center column with
  // room in its top-right corner for the anchored Filters button and a
  // full-width Game Info strip; below it the card is the whole page width,
  // the roster panels have handed over to MobilePlayerNav, and both of those
  // drop back into normal flow. Distinct from `isNarrow` (480px), which is
  // about how much room the *chart* has for per-bar labels.
  const compact = useIsNarrow(1100);

  const resetFilters = () => {
    setSide("all");
    setLastN(10);
    setOpponent("all");
    setMinMinutes(0);
    setMaxMinutes(40);
    setMinutesRangeEnabled(false);
    setLine(null);
  };

  // Resolved from the matchup's own rosters first: those are live, so a player
  // who exists only on ESPN's roster still resolves. ALL_WNBA_PLAYERS remains
  // the fallback for the static/offline slate. Undefined when the roster
  // filtered down to nobody, which the guard below turns into a message rather
  // than a crash.
  const player = useMemo(() => {
    const pool = [...(matchup?.teamA?.players || []), ...(matchup?.teamB?.players || [])];
    const fromSlate = pool.find((p) => p.id === playerId);
    if (fromSlate) return fromSlate;
    // The static fallback has to clear the same data bar as the rails, or a
    // player the rails deliberately excluded can still be selected by id.
    const stat = ALL_WNBA_PLAYERS.find((p) => p.id === playerId);
    return stat && wnbaPlayerHasData(stat) ? stat : undefined;
  }, [matchup, playerId]);
  // If the selected id is no longer in the slate (rosters loaded, a player was
  // filtered out, the matchup changed), fall to the first player that is.
  React.useEffect(() => {
    if (player) return;
    const first = (matchup?.teamA?.players || [])[0] || (matchup?.teamB?.players || [])[0];
    if (first && first.id !== playerId) setPlayerId(first.id);
  }, [player, matchup, playerId]);

  const playerMarkets = useMemo(() => wnbaPlayerMarkets(player), [player]);

  // Whenever the selected player changes, make sure the active market is
  // still one that applies to them (DD/TD only show up for a handful of
  // players -- see WNBA_DD_PLAYERS/WNBA_TD_PLAYERS).
  React.useEffect(() => {
    if (!playerMarkets.some((m) => m.id === market)) {
      setMarket(playerMarkets[0].id);
      setLine(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  // `|| []` because getWNBAGames returns null for a player with no game log
  // at all. Such a player is normally filtered out of the rails before they
  // can be selected, but the static fallback in the resolver above can still
  // surface one, and an empty array renders an empty chart instead of throwing.
  const allGames = useMemo(() => getWNBAGames(player, ALL_WNBA_PLAYERS.indexOf(player)) || [], [player, dataVersion]);
  const seasonAvg = useMemo(() => {
    const n = allGames.length || 1;
    const sum = (key) => allGames.reduce((a, g) => a + g[key], 0);
    return {
      pts: sum("pts") / n,
      reb: (sum("oreb") + sum("dreb")) / n,
      ast: sum("ast") / n,
      min: sum("minutes") / n,
    };
  }, [allGames]);

  const opponentsForPlayer = useMemo(
    () => Array.from(new Set(allGames.map((g) => g.opp))).sort(),
    [allGames]
  );

  const filtered = useMemo(() => {
    let g = allGames.filter((game) => {
      if (side === "home" && !game.home) return false;
      if (side === "away" && game.home) return false;
      if (opponent !== "all" && game.opp !== opponent) return false;
      if (game.minutes < minMinutes || game.minutes > maxMinutes) return false;
      return true;
    });
    if (lastN !== "all") g = g.slice(-lastN);
    return g;
  }, [allGames, side, opponent, minMinutes, maxMinutes, lastN]);

  // On narrow (phone-width) screens, beyond a Last-10 sample per-bar team
  // logos/abbreviations can't stay legible, so the x-axis switches to sparse
  // date labels instead (see DateAxisTick). Desktop has enough width for
  // logo+abbr+date per bar at any sample size -- axisTickInterval already
  // caps the number of ticks actually drawn, so it never needs this fallback.
  const manyGames = isNarrow && filtered.length > 10;

  const isBinary = market === "dd" || market === "td";
  const values = filtered.map((g) => statValue(g, market, rebSplit));
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const effectiveLine = isBinary ? 0.5 : (line === null ? ceilToHalfOdd(avg) : line);
  // Deliberately keyed off `line` (only non-null once the user has actually
  // dragged the handle to a custom value), not `effectiveLine` -- including
  // the live drag position here made the axis grow a step every time the
  // handle crossed a half-point while dragging, since a taller axis raised
  // topValue, which raised the handle's own `max`, letting it drag higher
  // still. The *default* suggested line (ceilToHalfOdd(avg), used only while
  // line is null) can still nudge the axis up if it rounds just past the
  // tallest bar, but once a real line is set the axis stays put and the
  // handle simply can't be dragged above it.
  const topValue = Math.max(...values, line === null ? ceilToHalfOdd(avg) : 0, 1);
  const rawMax = isBinary ? 1 : topValue + Math.max(1, Math.ceil(topValue * 0.05));
  const niceStep = (() => {
    if (isBinary) return 1;
    const targetTicks = 5;
    const roughStep = rawMax / targetTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(roughStep || 1)));
    const norm = roughStep / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 3 ? 3 : norm <= 5 ? 5 : 10) * mag;
    return Math.max(1, step);
  })();
  const chartMax = isBinary ? 1 : Math.ceil(rawMax / niceStep) * niceStep;
  const chartTicks = isBinary
    ? [0, 1]
    : Array.from({ length: chartMax / niceStep + 1 }, (_, i) => i * niceStep);

  // Filters-panel wiring, mirroring the MLB page. There's no single "next
  // opponent" here -- the opponent is picked from a dropdown -- so the H2H
  // cell is dropped rather than rendered permanently disabled, leaving six
  // sample-size cells instead of seven.
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (side !== 'all') n += 1;
    if (opponent !== 'all') n += 1;
    if (lastN !== 10) n += 1;
    if (minMinutes !== 0 || maxMinutes !== 40) n += 1;
    return n;
  }, [side, opponent, lastN, minMinutes, maxMinutes]);

  const splitCells = buildHitRateSplits({
    allGames,
    statValue: (g) => statValue(g, market, rebSplit),
    effectiveLine,
    lastN,
    onSetLastN: setLastN,
    h2h: false,
    onSetH2h: () => {},
    opponentAbbr: null,
    shortLabels: true,
    includeH2h: false,
  });

  const hits = values.filter((v) => v > effectiveLine).length;
  const hitRate = values.length ? hits / values.length : 0;
  const edge = avg - effectiveLine;
  const marketLabel = WNBA_MARKETS.find((m) => m.id === market)?.label ?? "";

  // Season-wide average for the *currently selected market*, distinct from
  // `avg` (which is scoped to `filtered`, i.e. whatever the location/opponent/
  // minutes/sample-size filters have narrowed the chart down to). This is what
  // lets the metric rail show "Season Avg" and "Graph Avg" as two genuinely
  // different numbers instead of the same value twice.
  const seasonValuesForMarket = allGames.map((g) => statValue(g, market, rebSplit));
  const seasonAvgForMarket = seasonValuesForMarket.length
    ? seasonValuesForMarket.reduce((a, b) => a + b, 0) / seasonValuesForMarket.length
    : 0;

  // Who this player actually lines up against in the selected matchup -- read
  // off the *other* roster, not the `opponent` filter, so the Game Info badge
  // always describes tonight's game rather than whatever historical opponent
  // the filters happen to be zoomed into. Which roster is "other" depends on
  // which side the selected player is on: clicking a name in the right-hand
  // panel flips the sides.
  const playerOnTeamA = matchup.teamA.players.some((p) => p.id === playerId);
  const gameOppRoster = playerOnTeamA ? matchup.teamB : matchup.teamA;
  const gameOppAbbr = gameOppRoster.players[0]?.team;
  const gameOppDef = gameOppAbbr ? getWNBADefRank(market, gameOppAbbr) : null;
  const gameOppTier = gameOppDef ? defTier(gameOppDef.rank) : null;
  // Once the real defense table has loaded, the rank/rating is points allowed
  // per game for every market, not a per-market split -- so the Game Info
  // badge has to be labelled for what the number actually is. Only while the
  // mock per-category fallback is in play does "rebounds allowed" describe the
  // figure sitting next to it.
  const defCategoryLabel = wnbaDefIsPointsAllowed(gameOppAbbr) ? "points allowed" : wnbaDefCategoryLabel(market);
  const tierColor = (t) => (t === "soft" ? "var(--green)" : t === "tough" ? "var(--red)" : "var(--dim)");

  // Detailed rate-stat row: the same columns computed twice, once over the
  // filtered sample the chart is showing and once over the full season, so
  // every cell can carry a "how is she trending" delta underneath it. Shares
  // hoopsRateAgg with the NBA page -- the two leagues' game logs carry the
  // same fields.
  const rateWindow = useMemo(() => hoopsRateAgg(filtered), [filtered]);
  const rateSeason = useMemo(() => hoopsRateAgg(allGames), [allGames]);
  const rateCards = HOOPS_RATE_COLUMNS.map((c) => ({
    key: c.key,
    label: c.label,
    value: `${rateWindow[c.key].toFixed(c.decimals)}${c.suffix || ""}`,
    delta: fmtStatDelta(rateWindow[c.key] - rateSeason[c.key], c.decimals, c.better, c.suffix || ""),
  }));
  const rateGlossary = HOOPS_RATE_COLUMNS.map((c) => ({ key: c.key, ...HOOPS_RATE_GLOSSARY[c.key] }));

  // Game Info's right-hand context slot. MLB fills this with a live forecast
  // and park-factor swings; there is no weather or venue-effect data for an
  // indoor sport, so the equivalent pre-game read here is how the opponent
  // ranks defensively in whichever market is selected -- the same numbers the
  // game-log table's Def# column already shows, applied to tonight's opponent.
  const gameInfoBadge = gameOppDef && (
    <>
      <span style={{ fontSize: 11.5, color: "var(--dim)", whiteSpace: "nowrap" }}>
        vs {gameOppAbbr} {defCategoryLabel}
      </span>
      <span className="mono tnum" style={{ fontWeight: 600, fontSize: 11, color: "var(--text)", whiteSpace: "nowrap" }}>
        {gameOppDef.rating}
      </span>
      <span className="status-pill" style={{ color: tierColor(gameOppTier), whiteSpace: "nowrap" }}>
        #{gameOppDef.rank} {gameOppTier === "soft" ? "Favorable" : gameOppTier === "tough" ? "Tough" : "Neutral"}
      </span>
    </>
  );

  const gameInfoDetails = gameOppDef && (
    <>
      <div style={{ marginBottom: 4 }}>
        {gameOppRoster.label} rank #{gameOppDef.rank} of {WNBA_TEAMS.length} in {defCategoryLabel} ({gameOppDef.rating}) —
        {gameOppTier === "soft"
          ? " one of the softer matchups in the league for this market, which nudges toward the over."
          : gameOppTier === "tough"
            ? " one of the tougher matchups in the league for this market, which nudges toward the under."
            : " a middle-of-the-pack matchup, so the defense isn't the deciding factor here."}
      </div>
      {matchup.venue && <div>{matchup.venue}{matchup.city ? ` — ${matchup.city}` : ""}</div>}
    </>
  );

  // Player identity: avatar + name/team/pos + season snapshot. Now the top of
  // the graph card rather than its own bordered panel beside the matchup
  // selector, so it carries only a bottom divider against the detailed stat
  // row underneath. paddingRight reserves room for the Filters button, which
  // floats in the card's absolute top-right corner on desktop.
  const playerIdentityRow = (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: compact ? 10 : 20,
      flexWrap: "wrap", borderBottom: "1px solid var(--line)",
      padding: compact ? "8px 12px" : "12px 20px",
      paddingRight: compact ? 12 : 110,
    }}>
      <PlayerAvatar
        key={player.id}
        name={player.name}
        alt={player.name}
        sport="wnba"
        team={player.team}
        colorMap={WNBA_TEAM_COLORS}
        headshotSrc={wnbaHeadshot(player.espnId)}
        status={statusOf(player)}
        surface="var(--panel)"
        size={compact ? 56 : 84}
        inset={compact ? 3 : 5}
        backing={(WNBA_TEAM_COLORS[player.team] || {}).primary || "#000"}
        imgBorder="1px solid var(--line)"
        fadeIn
        shadow={`0 4px 14px ${(WNBA_TEAM_COLORS[player.team] || {}).primary || "#000"}40`}
      />

      <div style={{ textAlign: "center", paddingRight: compact ? 8 : 16 }}>
        <div className="oswald" style={{ fontSize: compact ? 13 : 16, color: "var(--text)", whiteSpace: "nowrap" }}>{player.name}</div>
        <div style={{ fontSize: compact ? 9 : 10.5, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {player.team} · {player.pos} · Season
        </div>
      </div>

      <div style={{ display: "flex", gap: compact ? 12 : 20, flexWrap: "wrap" }}>
        {[
          { label: "PTS", value: seasonAvg.pts },
          { label: "REB", value: seasonAvg.reb },
          { label: "AST", value: seasonAvg.ast },
          { label: "MIN", value: seasonAvg.min },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div className="mono" style={{ fontSize: compact ? 14 : 18, color: "var(--amber)", fontWeight: 700 }}>{s.value.toFixed(1)}</div>
            <div style={{ fontSize: compact ? 9 : 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const filtersBody = (
    <FilterPanel activeCount={activeFilterCount} onReset={resetFilters}>
      {/* Same section order and rhythm as the MLB panel: sample size leads
           unshaded, then the paired controls in a shaded 2-up. */}
      <FilterSection title="Sample size">
        <SampleSizeGrid cells={splitCells} />
        <SampleSizeSlider total={allGames.length} lastN={lastN} onSetLastN={setLastN} />
      </FilterSection>

      <FilterSection shaded>
        <div className="fp-grid-2">
          <div>
            <div className="micro-label" style={{ fontSize: 10, marginBottom: 7 }}>Game location</div>
            <div className="fp-row">
              {["all", "home", "away"].map((s) => (
                <div key={s} role="button" className={`chip-sm ${side === s ? "active" : ""}`} onClick={() => setSide(s)}>
                  {s === "all" ? "All games" : s === "home" ? "Home" : "Away"}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="micro-label" style={{ fontSize: 10, marginBottom: 7 }}>Opponent</div>
            <select className="select-sm" value={opponent} onChange={(e) => setOpponent(e.target.value)}>
              <option value="all">Any opponent</option>
              {opponentsForPlayer.map((o) => <option key={o} value={o}>vs {o}</option>)}
            </select>
          </div>
        </div>
      </FilterSection>

      <FilterSection shaded>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
          <span className="micro-label" style={{ fontSize: 10 }}>Minutes</span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--amber)" }}>
            {!minutesRangeEnabled
              ? (minMinutes === 0 ? "Any" : `${minMinutes}+`)
              : (minMinutes === 0 && maxMinutes === 40 ? "Any" : `${minMinutes}–${maxMinutes}`)}
          </span>
        </div>
        <ThresholdSlider
          min={0}
          max={40}
          step={1}
          lo={minMinutes}
          hi={maxMinutes}
          onChangeLo={setMinMinutes}
          onChangeHi={setMaxMinutes}
          rangeEnabled={minutesRangeEnabled}
          onToggleRange={() => setMinutesRangeEnabled((v) => !v)}
        />
      </FilterSection>
    </FilterPanel>
  );

  // Local chart height, matching the MLB card's rather than the taller shared
  // CHART_HEIGHT: the card now carries the game-info, identity, market,
  // detail-stat and metric rows above the plot, so a shorter chart keeps the
  // whole stack visible together instead of pushing the bars off-screen.
  const WNBA_GRAPH_CHART_HEIGHT = isNarrow ? 340 : 600;

  const chartBlock = (
    <div
      ref={chartRef}
      style={{
        position: "relative", boxSizing: "border-box", height: WNBA_GRAPH_CHART_HEIGHT,
        // A nested strip, not a second card: the graph card's own wrapper
        // already supplies the border/shadow, so this only needs a subtle
        // background to read as its own section without a competing outline.
        background: "var(--surface-2)", borderRadius: "var(--r-md)",
        padding: isNarrow ? "16px 6px 10px" : "16px 16px 8px",
      }}
    >
      {/* The launcher owns the popover, bottom sheet, click-outside and
           Escape handling (shared with the other sports pages). Lives inside
           the chart's own container (not the identity/header card) so it
           reads as part of the chart -- anchored to this div's top-right
           corner, in the empty space above the bars, on both mobile and
           desktop alike. */}
      <FilterPanelLauncher
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        activeCount={activeFilterCount}
        compact={compact}
        anchored
      >
        {filtersBody}
      </FilterPanelLauncher>
      <ContextStatToggle stat={NBA_CONTEXT_STAT} value={showContext} onChange={setShowContext} compact={isNarrow} />
      <div style={{ height: "100%", width: "100%", touchAction: "pan-y" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={filtered.map((g, i) => ({
            idx: i + 1,
            opp: g.opp,
            axisKey: `${g.opp}__${g.date}`,
            value: statValue(g, market, rebSplit),
            date: g.date,
            minutes: g.minutes,
            home: g.home,
          }))}
          // right clears LineHandle, which anchors to the container's right
          // edge: it needs right:8 + its 52px minimum, less the 6px the
          // narrow chart wrapper already pads, so 54 is the floor. 30 left
          // the pill sitting on top of the last bar.
          margin={{ top: 10, right: isNarrow ? 64 : 60, bottom: manyGames ? 30 : (isNarrow ? 42 : 78), left: isNarrow ? 0 : 20 }}
          barCategoryGap={isNarrow ? "4%" : "6%"}
        >
          {/* Invisible (stroke="transparent"), not removed: rendered fully
               open per the PropsMadness reference (no grid lines, just
               floating y-tick labels), but LineHandle's drag math
               (getPlotBoundsY, above) measures the plot's top/bottom by
               querying this component's own rendered .recharts-cartesian-
               grid-horizontal line elements -- removing the component
               entirely would silently break the drag handle instead of
               just hiding a visual grid. */}
          <CartesianGrid stroke="transparent" vertical={false} />
          <XAxis
            dataKey={manyGames ? "date" : "axisKey"}
            interval={manyGames ? Math.max(0, Math.ceil(filtered.length / (isNarrow ? 5 : 8)) - 1) : axisTickInterval(filtered.length, isNarrow, chartWidth)}
            tick={manyGames ? (props) => <DateAxisTick {...props} compact={isNarrow} /> : (props) => <TeamAxisTick {...props} logoFn={wnbaTeamLogo} compact={isNarrow} />}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, chartMax]}
            ticks={chartTicks}
            tick={{ fill: "var(--chart-ink)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={isNarrow ? 32 : 60}
            label={isNarrow ? undefined : { value: marketLabel, angle: -90, position: "insideLeft", offset: 10, style: { textAnchor: "middle", fill: "var(--chart-ink)", fontSize: 11, fontWeight: 600 } }}
          />
          <Tooltip
            content={<ChartTooltip effectiveLine={effectiveLine} isBinary={isBinary} marketLabel={marketLabel} logoFn={wnbaTeamLogo} />}
            cursor={{ fill: "var(--surface-3)", opacity: 0.5 }}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} minPointSize={(v) => (v === 0 ? 3 : 0)}>
            {filtered.map((g, i) => {
              const v = statValue(g, market, rebSplit);
              const fill = isBinary ? (v === 1 ? CHART_GREEN : "transparent") : (v > effectiveLine ? CHART_GREEN : CHART_RED);
              return <Cell key={i} fill={fill} />;
            })}
            <LabelList dataKey="value" content={(props) => <BarValueLabel {...props} isBinary={isBinary} />} />
          </Bar>
          {contextStatChartParts(NBA_CONTEXT_STAT, showContext, isNarrow)}
          {/* Rendered after Bar (not before) so the dashed threshold line
               draws on top of the bars instead of being clipped underneath
               them -- later JSX = higher SVG paint order in Recharts. */}
          {!isBinary && <ReferenceLine y={dragLine !== null ? dragLine : effectiveLine} stroke="var(--amber)" strokeDasharray="4 4" />}
        </ComposedChart>
      </ResponsiveContainer>
      </div>
      {!isBinary && (
        <LineHandle
          value={effectiveLine}
          onChange={(v) => setLine(v)}
          onDragValue={setDragLine}
          min={0}
          max={chartMax}
          containerRef={chartRef}
        />
      )}
    </div>
  );

  // Game-log ledger table -- behind the same "▸ Game Logs (n)" disclosure the
  // MLB, NFL and NBA pages use. Its own storageKey, so collapsing it here
  // doesn't also collapse theirs.
  const ledgerTable = (
    <CollapsibleSection title={`Game Logs (${filtered.length})`} storageKey="wnba_game_logs_open">
      <div style={{ border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ minWidth: 580 }}>
            <div className="mono" style={{ display: "grid", gridTemplateColumns: "5fr 9fr 6fr 6fr 6fr 6fr 7fr 6fr 7fr", padding: "10px 14px", fontSize: 11, color: "var(--dim)", borderBottom: "1px solid var(--line)", textTransform: "uppercase", textAlign: "center" }}>
              <div>#</div><div>Date</div><div>Opp</div><div>Def#</div><div>Loc</div><div>Min</div><div>{marketLabel}</div><div>Line</div><div>Result</div>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto", overflowX: "hidden" }}>
              {filtered.slice().reverse().map((g, i) => {
                const v = statValue(g, market, rebSplit);
                const over = v > effectiveLine;
                const push = !isBinary && v === effectiveLine;
                const def = getWNBADefRank(market, g.opp);
                const tier = defTier(def.rank);
                return (
                  <div key={g.date} className="ledger-row mono" style={{ display: "grid", gridTemplateColumns: "5fr 9fr 6fr 6fr 6fr 6fr 7fr 6fr 7fr", padding: "9px 14px", fontSize: 12.5, textAlign: "center" }}>
                    <div style={{ color: "var(--dim)" }}>{filtered.length - i}</div>
                    <div>{g.date}</div>
                    <div>{g.opp}</div>
                    <div style={{ color: tierColor(tier) }}>#{def.rank}</div>
                    <div style={{ color: "var(--dim)" }}>{g.home ? "Home" : "Away"}</div>
                    <div>{g.minutes}</div>
                    <div style={{ color: "var(--text)" }}>{isBinary ? (v === 1 ? "Yes" : "No") : v}</div>
                    <div style={{ color: "var(--dim)" }}>{isBinary ? "—" : effectiveLine}</div>
                    <div style={{ color: push ? "var(--dim)" : over ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                      {isBinary ? (v === 1 ? "YES" : "NO") : (push ? "PUSH" : over ? "OVER" : "UNDER")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );

  // A slate item we cannot render has to say so. Returning null here, or
  // quietly omitting the game from the list, is the failure mode this page
  // used to have: four of seven games vanished with no indication anything
  // was missing.
  const slateBanner = (slateIssue || emptyMatchups > 0) ? (
    <div
      role="status"
      className="mono"
      style={{
        margin: "0 0 12px", padding: "9px 12px", borderRadius: 6,
        border: "1px solid var(--neg)", background: "var(--neg-dim)",
        color: "var(--text)", fontSize: 12, lineHeight: 1.45,
      }}
    >
      {slateIssue === "fetch"
        ? "Could not load today's WNBA schedule \u2014 showing the last known slate."
        : slateIssue && slateIssue.startsWith("unreadable:")
        ? `${slateIssue.split(":")[1]} game(s) on today's schedule could not be read and are not listed.`
        : `${emptyMatchups} game(s) on the slate have no player game logs yet \u2014 they are listed but have no props.`}
    </div>
  ) : null;

  if (!player) {
    return (
      <div className="page-shell" style={{ maxWidth: 1920, margin: "0 auto", boxSizing: "border-box" }}>
        {slateBanner}
        <div className="panel" style={{ padding: 20, textAlign: "center", color: "var(--dim)", fontSize: 13 }}>
          No WNBA player game logs have loaded yet.
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--mobile-nav" style={{ maxWidth: 1920, margin: "0 auto", boxSizing: "border-box" }}>
    {slateBanner}
    <MobilePlayerNav
      teamA={matchup.teamA}
      teamB={matchup.teamB}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => wnbaHeadshot(p.espnId)}
      statusFor={statusOf}
      metaLine={(p) => { const m = wnbaMinutesPerGame(p); return m === null ? p.pos : `${p.pos} · ${m.toFixed(1)} MPG`; }}
      avatarBg={(p) => teamAvatarBackground(WNBA_TEAM_COLORS, p.team)}
    />
    <div className="roster-layout">
    <TeamRosterPanel
      teamLabel={matchup.teamA.label}
      players={matchup.teamA.players}
      sections={sectionsFor(matchup.teamA.players, matchup.teamA.abbr)}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => wnbaHeadshot(p.espnId)}
      statusFor={statusOf}
      metaLine={(p) => { const m = wnbaMinutesPerGame(p); return m === null ? p.pos : `${p.pos} · ${m.toFixed(1)} MPG`; }}
      avatarBg={(p) => teamAvatarBackground(WNBA_TEAM_COLORS, p.team)}
    />
    <div className="roster-layout-center">
      {/* Below the roster breakpoint the graph card is the full page width
           and its top-right corner is no longer a safe place to float things,
           so the game info falls back to the original date/venue pill above
           the card -- the same split the MLB page makes between its
           GameConditionsBar (desktop, inside the card) and nextGamePill
           (mobile, above it). */}
      {compact && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center", gap: 14, flexWrap: "wrap",
          width: "fit-content", margin: "0 auto 12px", padding: "9px 20px",
          background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 999,
          fontSize: 12.5, color: "var(--dim)",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>
              {new Date(matchup.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <span>·</span>
            <span className="mono" style={{ color: "var(--amber)", fontWeight: 700 }}>
              {new Date(matchup.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
            </span>
          </span>
          {matchup.venue && (
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{matchup.venue}</span>
              {matchup.city && <span>— {matchup.city}</span>}
            </span>
          )}
        </div>
      )}

      {/* Matchup selector, alone in its own centered row above the card --
           picking a matchup here swaps which two rosters populate the
           left/right sidebars. Picking an individual player happens by
           clicking their row in either roster panel, which is the one-dropdown
           pattern every sport page now uses. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, marginTop: compact ? 14 : 20, width: compact ? "100%" : "auto" }}>
        <GameSelect
          groups={matchupsByDate}
          value={matchupId}
          logoFn={wnbaTeamLogo}
          compact={compact}
          onChange={(next) => {
            setMatchupId(next.id);
            setPlayerId(next.teamA.players[0].id);
            setLine(null);
            setOpponent("all");
          }}
        />
      </div>

      {/* The graph card: game info, player identity, market tabs, both stat
           tiers and the chart blended into one bordered container instead of
           the separately-bordered boxes this page used to stack. Mirrors the
           MLB page's graphCard(). */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", marginBottom: 16, overflow: "hidden", position: "relative" }}>
        {!compact && (
          <GameInfoBar
            dateISO={matchup.date}
            isHome={!playerOnTeamA}
            opponentLabel={gameOppRoster.label}
            venue={matchup.venue}
            city={matchup.city}
            detailsStorageKey="wnba_game_info_details_open"
            badge={gameInfoBadge}
            details={gameInfoDetails}
          />
        )}

        {playerIdentityRow}

        <div style={{ padding: compact ? "10px 12px 14px" : "12px 20px 18px" }}>
          <MarketSectionGrid
            singleBar
            sections={WNBA_MARKET_SECTIONS.map((s) => ({ ...s, markets: playerMarkets.filter((m) => s.ids.includes(m.id)) }))}
            activeMarket={market}
            onSelect={(id) => { setMarket(id); setLine(null); }}
            isNarrow={isNarrow}
          />
          {/* Rebound split: only shown once Rebounds is the active market */}
          {market === "reb" && (
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {REB_SPLITS.map((r) => (
                <div key={r.id} className={`chip ${rebSplit === r.id ? "active" : ""}`} onClick={() => setRebSplit(r.id)}>
                  {r.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <SampleStatsRow
          cards={rateCards}
          glossary={rateGlossary}
          compact={compact}
          intro="A quick guide to these stats, if you're newer to basketball props. One thing that trips people up: the PTS/REB/AST/MIN card above is always the full season average, while the numbers below are for whatever your filters are currently showing — so the same stat can read differently in the two rows at the same time."
        />
        <MetricRail
          seasonAvg={seasonAvgForMarket}
          graphAvg={avg}
          hitRate={hitRate}
          hits={hits}
          total={values.length}
          edge={edge}
          compact={compact}
        />

        {chartBlock}

        <HitRateSplits
          allGames={allGames}
          statValue={(g) => statValue(g, market, rebSplit)}
          effectiveLine={effectiveLine}
          lastN={lastN}
          onSetLastN={setLastN}
          h2h={false}
          onSetH2h={() => {}}
          opponentAbbr={null}
          isNarrow={isNarrow}
          max={allGames.length}
          includeH2h={false}
        />
      </div>

      {ledgerTable}
    </div>
    <TeamRosterPanel
      teamLabel={matchup.teamB.label}
      players={matchup.teamB.players}
      sections={sectionsFor(matchup.teamB.players, matchup.teamB.abbr)}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => wnbaHeadshot(p.espnId)}
      statusFor={statusOf}
      metaLine={(p) => { const m = wnbaMinutesPerGame(p); return m === null ? p.pos : `${p.pos} · ${m.toFixed(1)} MPG`; }}
      avatarBg={(p) => teamAvatarBackground(WNBA_TEAM_COLORS, p.team)}
    />
    </div>

      <div style={{ marginTop: 20, fontSize: 12, color: "var(--dim)" }}>
        Live 2026 regular-season game logs (ESPN Stats API) for the players shown above, refreshed each tab. Defensive matchup ranks are real opponent points allowed per game.
      </div>
      <PlayerNewsModule playerName={player.name} headshotSrc={wnbaHeadshot(player.espnId)} sport="wnba" team={player.team} status={statusOf(player)} />
    </div>
  );
}

// ---------- MLB (New York Yankees lineup) mock data ----------
const MLB_TEAMS = [
  "ARI","ATL","BAL","BOS","CHC","CWS","CIN","CLE","COL","DET","HOU","KC","LAA","LAD","MIA","MIL",
  "MIN","NYM","NYY","ATH","PHI","PIT","SD","SEA","SF","STL","TB","TEX","TOR","WSH",
];

const MLB_LOGO_SLUG = {
  ARI: "ari", ATL: "atl", BAL: "bal", BOS: "bos", CHC: "chc", CWS: "chw", CIN: "cin", CLE: "cle",
  COL: "col", DET: "det", HOU: "hou", KC: "kc", LAA: "laa", LAD: "lad", MIA: "mia", MIL: "mil",
  MIN: "min", NYM: "nym", NYY: "nyy", ATH: "ath", PHI: "phi", PIT: "pit", SD: "sd", SEA: "sea",
  SF: "sf", STL: "stl", TB: "tb", TEX: "tex", TOR: "tor", WSH: "wsh",
};
const mlbTeamLogo = (abbr) => `https://a.espncdn.com/i/teamlogos/mlb/500/${MLB_LOGO_SLUG[abbr] || abbr.toLowerCase()}.png`;

// Official-ish MLB brand colors (primary/secondary), used only to tint the
// player avatar's background ring -- see teamAvatarBackground above.

// Mock run-prevention rating (lower = tougher pitching/defense), used as an
// instant fallback so the page never has to show a loading state for this.
// Overwritten in place with real team ERA-based ranks once /api/mlb-matchups
// resolves (see applyMlbTeamDef + the effect in PropLedger) -- that endpoint
// is populated nightly by the Vercel cron job in api/refresh-mlb-matchups.js.
const mlbDefRatingRng = mulberry32(9100);
const MLB_TEAM_DEF = (() => {
  const raw = MLB_TEAMS.map((t) => ({ team: t, rating: Math.round((3.8 + mlbDefRatingRng() * 2.0) * 100) / 100 }));
  raw.sort((a, b) => a.rating - b.rating);
  raw.forEach((r, i) => (r.rank = i + 1));
  const byTeam = {};
  raw.forEach((r) => (byTeam[r.team] = r));
  return byTeam;
})();
const mlbDefTier = (rank) => (rank <= 10 ? "tough" : rank >= 21 ? "soft" : "mid");

// Mutates MLB_TEAM_DEF's existing entries in place (rather than replacing
// the object) so every place in this file that already read MLB_TEAM_DEF[abbr]
// synchronously just sees the fresher numbers once the caller re-renders.
function applyMlbTeamDef(byTeam) {
  Object.keys(byTeam || {}).forEach((abbr) => {
    if (MLB_TEAM_DEF[abbr] && byTeam[abbr]) {
      MLB_TEAM_DEF[abbr].rank = byTeam[abbr].rank;
      MLB_TEAM_DEF[abbr].rating = byTeam[abbr].era;
    }
  });
}

// Fetches the nightly-refreshed real defense ranking from /api/mlb-matchups
// (falls back to the mock ranking above if the endpoint isn't deployed, e.g.
// during local `vite dev`, or if the fetch fails for any reason). Cached to
// sessionStorage per calendar day so it's only fetched once per day per tab.
async function loadRealMlbTeamDef() {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = "mlb_team_def_cache_v1";
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === today && parsed.byTeam) return parsed.byTeam;
    }
  } catch {}

  try {
    const res = await fetch("/api/mlb-matchups");
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.byTeam || !Object.keys(data.byTeam).length) return null;
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ date: today, byTeam: data.byTeam })); } catch {}
    return data.byTeam;
  } catch {
    return null;
  }
}

// Primary headshot source: MLB's own official photo CDN, keyed by the same
// mlbId already used to fetch live stats -- no separate id table to maintain,
// and it resolves correctly for trades/rookies/new players automatically.
const mlbHeadshot = (mlbId) => `https://midfield.mlbstatic.com/v1/people/${mlbId}/spots/120`;

// ESPN player IDs (from espn.com/mlb/team/roster) -> combiner-image headshot
// URLs, kept only as a secondary fallback if the MLB CDN doesn't have a photo.
const MLB_ESPN_ID = {
  grisham: "34995",
  rice: "5016968",
  goldschmidt: "31027",
  bellinger: "33912",
  chisholm: "41433",
  dominguez: "42401",
  volpe: "42547",
  mcmahon: "33247",
  wells: "4683349",
  turner: "33710",
  harper: "30951",
  schwarber: "33712",
  bohm: "41169",
  stott: "42417",
  realmuto: "32177",
  marsh: "40803",
  crawford: "5080642",
  delacruz: "40787",
};
const mlbEspnHeadshot = (id) =>
  MLB_ESPN_ID[id]
    ? `https://a.espncdn.com/combiner/i?img=/i/headshots/mlb/players/full/${MLB_ESPN_ID[id]}.png&w=350&h=350&scale=crop`
    : null;

// New York Yankees 2026 starting lineup (batting order). mlbId is the
// official MLB Stats API person id -- shared key for both the live game-log
// fetch and the headshot CDN, so a trade/roster change only needs one edit.
const MLB_PLAYERS = [
  { id: "grisham", name: "Trent Grisham", team: "NYY", pos: "CF", mlbId: 663757 },
  { id: "rice", name: "Ben Rice", team: "NYY", pos: "DH", mlbId: 700250 },
  // Acquired from Washington at the 2026 trade deadline -- primary 1B/DH
  // option, alternating with Goldschmidt while Stanton is out.
  { id: "lgarcia", name: "Luis García Jr.", team: "NYY", pos: "1B", mlbId: 671277 },
  { id: "bellinger", name: "Cody Bellinger", team: "NYY", pos: "LF", mlbId: 641355 },
  { id: "chisholm", name: "Jazz Chisholm Jr.", team: "NYY", pos: "2B", mlbId: 665862 },
  { id: "dominguez", name: "Jasson Dominguez", team: "NYY", pos: "RF", mlbId: 691176 },
  { id: "volpe", name: "Anthony Volpe", team: "NYY", pos: "SS", mlbId: 683011 },
  { id: "mcmahon", name: "Ryan McMahon", team: "NYY", pos: "3B", mlbId: 641857 },
  { id: "wells", name: "Austin Wells", team: "NYY", pos: "C", mlbId: 669224 },
  // Live probable starter for the 2026-07-26 Phillies game (see MLB_MATCHUPS)
  // -- pos "SP" is what tells TeamRosterPanel to section it off from the
  // batting order, and MLBPropsPage to switch into pitcher-market mode.
  { id: "warren", name: "Will Warren", team: "NYY", pos: "SP", mlbId: 701542 },
];

// Philadelphia Phillies 2026 starting lineup -- one of the 30 real rosters
// selectable on the MLB page (see MLB_TEAM_ROSTERS/fetchMLBTeamNextGame),
// so a team's actual next opponent's roster can show side by side the same
// way the NBA page shows both Finals teams, rather than just a one-line
// "next matchup" summary.
const PHILLIES_PLAYERS = [
  { id: "turner", name: "Trea Turner", team: "PHI", pos: "SS", mlbId: 607208 },
  { id: "schwarber", name: "Kyle Schwarber", team: "PHI", pos: "DH", mlbId: 656941 },
  // Deadline-trade domino from the Luis Arraez deal: Bohm shifts to 1B,
  // Stott to 3B, and Harper -- back from his elbow injury -- to RF.
  { id: "bohm", name: "Alec Bohm", team: "PHI", pos: "1B", mlbId: 664761 },
  { id: "stott", name: "Bryson Stott", team: "PHI", pos: "3B", mlbId: 681082 },
  { id: "arraez", name: "Luis Arraez", team: "PHI", pos: "2B", mlbId: 650333 },
  { id: "realmuto", name: "J.T. Realmuto", team: "PHI", pos: "C", mlbId: 592663 },
  { id: "marsh", name: "Brandon Marsh", team: "PHI", pos: "LF", mlbId: 669016 },
  { id: "crawford", name: "Justin Crawford", team: "PHI", pos: "CF", mlbId: 702222 },
  { id: "harper", name: "Bryce Harper", team: "PHI", pos: "RF", mlbId: 547180 },
  { id: "sanchez", name: "Cristopher Sánchez", team: "PHI", pos: "SP", mlbId: 650911 },
];

// Los Angeles Dodgers -- real starting lineup for their 2026-07-26 game
// at the Mets (see MLB_MATCHUPS below).
const DODGERS_PLAYERS = [
  { id: "betts", name: "Mookie Betts", team: "LAD", pos: "SS", mlbId: 605141 },
  { id: "ohtani", name: "Shohei Ohtani", team: "LAD", pos: "DH", mlbId: 660271 },
  { id: "freeman", name: "Freddie Freeman", team: "LAD", pos: "1B", mlbId: 518692 },
  { id: "tucker", name: "Kyle Tucker", team: "LAD", pos: "RF", mlbId: 663656 },
  { id: "hernandez", name: "Teoscar Hernández", team: "LAD", pos: "LF", mlbId: 606192 },
  { id: "muncy", name: "Max Muncy", team: "LAD", pos: "3B", mlbId: 571970 },
  { id: "pages", name: "Andy Pages", team: "LAD", pos: "CF", mlbId: 681624 },
  { id: "rushing", name: "Dalton Rushing", team: "LAD", pos: "C", mlbId: 687221 },
  { id: "rojas", name: "Miguel Rojas", team: "LAD", pos: "2B", mlbId: 500743 },
  { id: "sheehan", name: "Emmet Sheehan", team: "LAD", pos: "SP", mlbId: 686218 },
];

// New York Mets -- the Dodgers' real 2026-07-26 opponent.
const METS_PLAYERS = [
  { id: "lindor", name: "Francisco Lindor", team: "NYM", pos: "SS", mlbId: 596019 },
  { id: "semien", name: "Marcus Semien", team: "NYM", pos: "2B", mlbId: 543760 },
  { id: "bichette", name: "Bo Bichette", team: "NYM", pos: "3B", mlbId: 666182 },
  { id: "alvarez", name: "Francisco Alvarez", team: "NYM", pos: "C", mlbId: 682626 },
  { id: "polanco", name: "Jorge Polanco", team: "NYM", pos: "DH", mlbId: 593871 },
  { id: "robert", name: "Luis Robert Jr.", team: "NYM", pos: "CF", mlbId: 673357 },
  { id: "benge", name: "Carson Benge", team: "NYM", pos: "RF", mlbId: 701807 },
  { id: "taylor", name: "Tyrone Taylor", team: "NYM", pos: "LF", mlbId: 621438 },
  { id: "wagaman", name: "Eric Wagaman", team: "NYM", pos: "1B", mlbId: 676572 },
  { id: "peralta", name: "Freddy Peralta", team: "NYM", pos: "SP", mlbId: 642547 },
];

// Atlanta Braves -- real starting lineup for their 2026-07-26 game at the
// Orioles (see MLB_MATCHUPS below). One of several games being added toward
// eventually covering the whole day's slate.
const BRAVES_PLAYERS = [
  { id: "albies", name: "Ozzie Albies", team: "ATL", pos: "2B", mlbId: 645277 },
  { id: "riley", name: "Austin Riley", team: "ATL", pos: "3B", mlbId: 663586 },
  { id: "olson", name: "Matt Olson", team: "ATL", pos: "1B", mlbId: 621566 },
  { id: "harris", name: "Michael Harris II", team: "ATL", pos: "CF", mlbId: 671739 },
  { id: "smith", name: "Dominic Smith", team: "ATL", pos: "DH", mlbId: 642086 },
  { id: "baldwin", name: "Drake Baldwin", team: "ATL", pos: "C", mlbId: 686948 },
  { id: "yastrzemski", name: "Mike Yastrzemski", team: "ATL", pos: "LF", mlbId: 573262 },
  // Acquired from Kansas City at the deadline (White went back the other way).
  { id: "lthomas", name: "Lane Thomas", team: "ATL", pos: "RF", mlbId: 657041 },
  { id: "mateo", name: "Jorge Mateo", team: "ATL", pos: "SS", mlbId: 622761 },
  { id: "lopez", name: "Reynaldo López", team: "ATL", pos: "SP", mlbId: 625643 },
];

// Baltimore Orioles -- the Braves' real 2026-07-26 opponent.
const ORIOLES_PLAYERS = [
  { id: "henderson", name: "Gunnar Henderson", team: "BAL", pos: "SS", mlbId: 683002 },
  { id: "holliday", name: "Jackson Holliday", team: "BAL", pos: "2B", mlbId: 702616 },
  { id: "alonso", name: "Pete Alonso", team: "BAL", pos: "1B", mlbId: 624413 },
  { id: "mayo", name: "Coby Mayo", team: "BAL", pos: "3B", mlbId: 691723 },
  { id: "encarnacion", name: "Christian Encarnacion-Strand", team: "BAL", pos: "DH", mlbId: 687952 },
  // Ward was flipped to Seattle days after arriving (see MARINERS_PLAYERS);
  // Beavers gets the everyday look in left as a result.
  { id: "beavers", name: "Dylan Beavers", team: "BAL", pos: "LF", mlbId: 687637 },
  { id: "cowser", name: "Colton Cowser", team: "BAL", pos: "CF", mlbId: 681297 },
  { id: "oneill", name: "Tyler O'Neill", team: "BAL", pos: "RF", mlbId: 641933 },
  // Came back from Boston in the Rutschman trade, taking over behind the plate.
  { id: "narvaez", name: "Carlos Narváez", team: "BAL", pos: "C", mlbId: 665966 },
  { id: "baz", name: "Shane Baz", team: "BAL", pos: "SP", mlbId: 669358 },
];
const BLUEJAYS_PLAYERS = [
  { id: "kirk", name: "Alejandro Kirk", team: "TOR", pos: "C", mlbId: 672386 },
  { id: "guerrero", name: "Vladimir Guerrero Jr.", team: "TOR", pos: "1B", mlbId: 665489 },
  { id: "clement", name: "Ernie Clement", team: "TOR", pos: "2B", mlbId: 676391 },
  { id: "okamoto", name: "Kazuma Okamoto", team: "TOR", pos: "3B", mlbId: 672960 },
  { id: "gimenez", name: "Andrés Giménez", team: "TOR", pos: "SS", mlbId: 665926 },
  { id: "schneider", name: "Davis Schneider", team: "TOR", pos: "LF", mlbId: 676914 },
  { id: "varsho", name: "Daulton Varsho", team: "TOR", pos: "CF", mlbId: 662139 },
  { id: "lukes", name: "Nathan Lukes", team: "TOR", pos: "RF", mlbId: 664770 },
  { id: "springer", name: "George Springer", team: "TOR", pos: "DH", mlbId: 543807 },
  // Acquired from the Angels at the deadline (Gausman went to the Cubs).
  { id: "soriano", name: "José Soriano", team: "TOR", pos: "SP", mlbId: 667755 },
];
const REDSOX_PLAYERS = [
  // Acquired from Baltimore at the deadline; Narváez went back to the
  // Orioles as part of the return (see ORIOLES_PLAYERS below).
  { id: "rutschman", name: "Adley Rutschman", team: "BOS", pos: "C", mlbId: 668939 },
  { id: "contreras", name: "Willson Contreras", team: "BOS", pos: "1B", mlbId: 575929 },
  { id: "seigler", name: "Anthony Seigler", team: "BOS", pos: "2B", mlbId: 678011 },
  { id: "durbin", name: "Caleb Durbin", team: "BOS", pos: "3B", mlbId: 702332 },
  { id: "monasterio", name: "Andruw Monasterio", team: "BOS", pos: "SS", mlbId: 655316 },
  { id: "duran", name: "Jarren Duran", team: "BOS", pos: "LF", mlbId: 680776 },
  { id: "rafaela", name: "Ceddanne Rafaela", team: "BOS", pos: "CF", mlbId: 678882 },
  { id: "abreu", name: "Wilyer Abreu", team: "BOS", pos: "RF", mlbId: 677800 },
  { id: "yoshida", name: "Masataka Yoshida", team: "BOS", pos: "DH", mlbId: 807799 },
  { id: "suarez", name: "Ranger Suárez", team: "BOS", pos: "SP", mlbId: 624133 },
];
const CUBS_PLAYERS = [
  { id: "amaya", name: "Miguel Amaya", team: "CHC", pos: "C", mlbId: 665804 },
  { id: "busch", name: "Michael Busch", team: "CHC", pos: "1B", mlbId: 683737 },
  { id: "hoerner", name: "Nico Hoerner", team: "CHC", pos: "2B", mlbId: 663538 },
  { id: "bregman", name: "Alex Bregman", team: "CHC", pos: "3B", mlbId: 608324 },
  { id: "swanson", name: "Dansby Swanson", team: "CHC", pos: "SS", mlbId: 621020 },
  { id: "happ", name: "Ian Happ", team: "CHC", pos: "LF", mlbId: 664023 },
  { id: "pca", name: "Pete Crow-Armstrong", team: "CHC", pos: "CF", mlbId: 691718 },
  { id: "suzuki", name: "Seiya Suzuki", team: "CHC", pos: "RF", mlbId: 673548 },
  { id: "conforto", name: "Michael Conforto", team: "CHC", pos: "DH", mlbId: 624424 },
  // Acquired from Toronto at the deadline; Taillon (DFA'd, 5.92 ERA) went
  // back to the Blue Jays as the headline return piece.
  { id: "gausman", name: "Kevin Gausman", team: "CHC", pos: "SP", mlbId: 592332 },
];
const PIRATES_PLAYERS = [
  { id: "hdavis", name: "Henry Davis", team: "PIT", pos: "C", mlbId: 680779 },
  { id: "jgonzalez", name: "Jacob Gonzalez", team: "PIT", pos: "1B", mlbId: 694378 },
  { id: "lowe", name: "Brandon Lowe", team: "PIT", pos: "2B", mlbId: 664040 },
  { id: "ngonzales", name: "Nick Gonzales", team: "PIT", pos: "3B", mlbId: 693304 },
  { id: "triolo", name: "Jared Triolo", team: "PIT", pos: "SS", mlbId: 669707 },
  { id: "reynolds", name: "Bryan Reynolds", team: "PIT", pos: "LF", mlbId: 668804 },
  { id: "cook", name: "Billy Cook", team: "PIT", pos: "CF", mlbId: 695257 },
  { id: "ohearn", name: "Ryan O'Hearn", team: "PIT", pos: "RF", mlbId: 656811 },
  { id: "ozuna", name: "Marcell Ozuna", team: "PIT", pos: "DH", mlbId: 542303 },
  { id: "ashcraft", name: "Braxton Ashcraft", team: "PIT", pos: "SP", mlbId: 677952 },
];
const MARINERS_PLAYERS = [
  { id: "raleigh", name: "Cal Raleigh", team: "SEA", pos: "C", mlbId: 663728 },
  { id: "naylor", name: "Josh Naylor", team: "SEA", pos: "1B", mlbId: 647304 },
  { id: "young", name: "Cole Young", team: "SEA", pos: "2B", mlbId: 702284 },
  { id: "wilson", name: "Weston Wilson", team: "SEA", pos: "3B", mlbId: 642215 },
  { id: "crawfordjp", name: "J.P. Crawford", team: "SEA", pos: "SS", mlbId: 641487 },
  { id: "arozarena", name: "Randy Arozarena", team: "SEA", pos: "LF", mlbId: 668227 },
  { id: "rodriguez", name: "Julio Rodríguez", team: "SEA", pos: "CF", mlbId: 677594 },
  // Acquired from Baltimore at the deadline; Raley (elbow) was on the IL
  // when Ward stepped into the RF picture alongside Arozarena.
  { id: "ward", name: "Taylor Ward", team: "SEA", pos: "RF", mlbId: 621493 },
  { id: "canzone", name: "Dominic Canzone", team: "SEA", pos: "DH", mlbId: 686527 },
  { id: "gilbert", name: "Logan Gilbert", team: "SEA", pos: "SP", mlbId: 669302 },
];
const RANGERS_PLAYERS = [
  { id: "diaz", name: "Elias Díaz", team: "TEX", pos: "C", mlbId: 553869 },
  { id: "burger", name: "Jake Burger", team: "TEX", pos: "1B", mlbId: 669394 },
  // Smith was traded to Toronto at the deadline; Duran has taken over
  // everyday second base duties, with Jung back at third.
  { id: "duranez", name: "Ezequiel Duran", team: "TEX", pos: "2B", mlbId: 677649 },
  { id: "jung", name: "Josh Jung", team: "TEX", pos: "3B", mlbId: 673962 },
  { id: "cauley", name: "Cam Cauley", team: "TEX", pos: "SS", mlbId: 695508 },
  { id: "langford", name: "Wyatt Langford", team: "TEX", pos: "LF", mlbId: 694671 },
  { id: "carter", name: "Evan Carter", team: "TEX", pos: "CF", mlbId: 694497 },
  { id: "nimmo", name: "Brandon Nimmo", team: "TEX", pos: "RF", mlbId: 607043 },
  { id: "pederson", name: "Joc Pederson", team: "TEX", pos: "DH", mlbId: 592626 },
  { id: "degrom", name: "Jacob deGrom", team: "TEX", pos: "SP", mlbId: 594798 },
];
const GUARDIANS_PLAYERS = [
  { id: "hedges", name: "Austin Hedges", team: "CLE", pos: "C", mlbId: 595978 },
  { id: "manzardo", name: "Kyle Manzardo", team: "CLE", pos: "1B", mlbId: 700932 },
  { id: "bazzana", name: "Travis Bazzana", team: "CLE", pos: "2B", mlbId: 683953 },
  { id: "jramirez", name: "José Ramírez", team: "CLE", pos: "3B", mlbId: 608070 },
  { id: "rocchio", name: "Brayan Rocchio", team: "CLE", pos: "SS", mlbId: 677587 },
  { id: "amartinez", name: "Angel Martínez", team: "CLE", pos: "LF", mlbId: 682657 },
  { id: "kwan", name: "Steven Kwan", team: "CLE", pos: "CF", mlbId: 680757 },
  { id: "fry", name: "David Fry", team: "CLE", pos: "RF", mlbId: 681807 },
  { id: "hoskins", name: "Rhys Hoskins", team: "CLE", pos: "DH", mlbId: 656555 },
  { id: "messick", name: "Parker Messick", team: "CLE", pos: "SP", mlbId: 800048 },
];
const RAYS_PLAYERS = [
  { id: "fortes", name: "Nick Fortes", team: "TB", pos: "C", mlbId: 663743 },
  { id: "aranda", name: "Jonathan Aranda", team: "TB", pos: "1B", mlbId: 666018 },
  { id: "palacios", name: "Richie Palacios", team: "TB", pos: "2B", mlbId: 680700 },
  { id: "caminero", name: "Junior Caminero", team: "TB", pos: "3B", mlbId: 691406 },
  { id: "walls", name: "Taylor Walls", team: "TB", pos: "SS", mlbId: 670764 },
  { id: "csimpson", name: "Chandler Simpson", team: "TB", pos: "LF", mlbId: 802415 },
  { id: "mullins", name: "Cedric Mullins", team: "TB", pos: "CF", mlbId: 656775 },
  { id: "deluca", name: "Jonny DeLuca", team: "TB", pos: "RF", mlbId: 676356 },
  { id: "yandydiaz", name: "Yandy Díaz", team: "TB", pos: "DH", mlbId: 650490 },
  { id: "rasmussen", name: "Drew Rasmussen", team: "TB", pos: "SP", mlbId: 656876 },
];
const ROYALS_PLAYERS = [
  { id: "maile", name: "Luke Maile", team: "KC", pos: "C", mlbId: 571912 },
  { id: "pasquantino", name: "Vinnie Pasquantino", team: "KC", pos: "1B", mlbId: 686469 },
  { id: "massey", name: "Michael Massey", team: "KC", pos: "2B", mlbId: 686681 },
  { id: "jrojas", name: "Josh Rojas", team: "KC", pos: "3B", mlbId: 668942 },
  { id: "velazquez", name: "Andrew Velazquez", team: "KC", pos: "SS", mlbId: 623205 },
  { id: "icollins", name: "Isaac Collins", team: "KC", pos: "LF", mlbId: 686555 },
  // Thomas was traded to Atlanta at the deadline (see BRAVES_PLAYERS);
  // Misner gets the everyday look in center with Isbel (foot) out for the year.
  { id: "misner", name: "Kameron Misner", team: "KC", pos: "CF", mlbId: 670224 },
  { id: "caglianone", name: "Jac Caglianone", team: "KC", pos: "RF", mlbId: 695506 },
  { id: "sperez", name: "Salvador Perez", team: "KC", pos: "DH", mlbId: 521692 },
  { id: "avila", name: "Luinder Avila", team: "KC", pos: "SP", mlbId: 679883 },
];
const TIGERS_PLAYERS = [
  { id: "dingler", name: "Dillon Dingler", team: "DET", pos: "C", mlbId: 693307 },
  { id: "torkelson", name: "Spencer Torkelson", team: "DET", pos: "1B", mlbId: 679529 },
  { id: "gtorres", name: "Gleyber Torres", team: "DET", pos: "2B", mlbId: 650402 },
  { id: "keith", name: "Colt Keith", team: "DET", pos: "3B", mlbId: 690993 },
  { id: "mcgonigle", name: "Kevin McGonigle", team: "DET", pos: "SS", mlbId: 805808 },
  { id: "greene", name: "Riley Greene", team: "DET", pos: "LF", mlbId: 682985 },
  { id: "vierling", name: "Matt Vierling", team: "DET", pos: "CF", mlbId: 663837 },
  { id: "carpenter", name: "Kerry Carpenter", team: "DET", pos: "RF", mlbId: 681481 },
  { id: "outman", name: "James Outman", team: "DET", pos: "DH", mlbId: 681546 },
  { id: "valdez", name: "Framber Valdez", team: "DET", pos: "SP", mlbId: 664285 },
];
const ASTROS_PLAYERS = [
  { id: "yainerdiaz", name: "Yainer Diaz", team: "HOU", pos: "C", mlbId: 673237 },
  { id: "cwalker", name: "Christian Walker", team: "HOU", pos: "1B", mlbId: 572233 },
  { id: "altuve", name: "Jose Altuve", team: "HOU", pos: "2B", mlbId: 514888 },
  { id: "paredes", name: "Isaac Paredes", team: "HOU", pos: "3B", mlbId: 670623 },
  { id: "pena", name: "Jeremy Peña", team: "HOU", pos: "SS", mlbId: 665161 },
  { id: "wade", name: "LaMonte Wade Jr.", team: "HOU", pos: "LF", mlbId: 664774 },
  { id: "trammell", name: "Taylor Trammell", team: "HOU", pos: "CF", mlbId: 666211 },
  { id: "csmith", name: "Cam Smith", team: "HOU", pos: "RF", mlbId: 701358 },
  { id: "yalvarez", name: "Yordan Alvarez", team: "HOU", pos: "DH", mlbId: 670541 },
  { id: "blanco", name: "Ronel Blanco", team: "HOU", pos: "SP", mlbId: 669854 },
];
const WHITESOX_PLAYERS = [
  { id: "quero", name: "Edgar Quero", team: "CWS", pos: "C", mlbId: 700337 },
  { id: "murakami", name: "Munetaka Murakami", team: "CWS", pos: "1B", mlbId: 808959 },
  { id: "meidroth", name: "Chase Meidroth", team: "CWS", pos: "2B", mlbId: 805367 },
  { id: "vargas", name: "Miguel Vargas", team: "CWS", pos: "3B", mlbId: 678246 },
  { id: "montgomeryc", name: "Colson Montgomery", team: "CWS", pos: "SS", mlbId: 695657 },
  { id: "antonacci", name: "Sam Antonacci", team: "CWS", pos: "LF", mlbId: 803011 },
  { id: "perezj", name: "Junior Perez", team: "CWS", pos: "CF", mlbId: 678577 },
  { id: "montgomeryb", name: "Braden Montgomery", team: "CWS", pos: "RF", mlbId: 695731 },
  { id: "benintendi", name: "Andrew Benintendi", team: "CWS", pos: "DH", mlbId: 643217 },
  { id: "fedde", name: "Erick Fedde", team: "CWS", pos: "SP", mlbId: 607200 },
];
const ANGELS_PLAYERS = [
  // O'Hoppe was traded to Texas at the deadline; d'Arnaud (activated off
  // the 60-day IL) takes over behind the plate.
  { id: "darnaud", name: "Travis d'Arnaud", team: "LAA", pos: "C", mlbId: 518595 },
  { id: "schanuel", name: "Nolan Schanuel", team: "LAA", pos: "1B", mlbId: 694384 },
  { id: "peraza", name: "Oswald Peraza", team: "LAA", pos: "2B", mlbId: 672724 },
  { id: "guzman", name: "Denzer Guzman", team: "LAA", pos: "3B", mlbId: 694203 },
  { id: "neto", name: "Zach Neto", team: "LAA", pos: "SS", mlbId: 687263 },
  { id: "jlowe", name: "Josh Lowe", team: "LAA", pos: "LF", mlbId: 666139 },
  { id: "trout", name: "Mike Trout", team: "LAA", pos: "CF", mlbId: 545361 },
  { id: "adell", name: "Jo Adell", team: "LAA", pos: "RF", mlbId: 666176 },
  { id: "soler", name: "Jorge Soler", team: "LAA", pos: "DH", mlbId: 624585 },
  // Soriano was traded to Toronto at the deadline; Kikuchi slots back in
  // as the rotation's veteran arm.
  { id: "kikuchi", name: "Yusei Kikuchi", team: "LAA", pos: "SP", mlbId: 579328 },
];
const GIANTS_PLAYERS_MLB = [
  { id: "susac", name: "Daniel Susac", team: "SF", pos: "C", mlbId: 691740 },
  { id: "devers", name: "Rafael Devers", team: "SF", pos: "1B", mlbId: 646240 },
  // Arraez was traded to Philadelphia at the deadline; Basabe takes over
  // at second in the Giants' post-selloff infield.
  { id: "basabe", name: "Osleivis Basabe", team: "SF", pos: "2B", mlbId: 678545 },
  { id: "koss", name: "Christian Koss", team: "SF", pos: "3B", mlbId: 683766 },
  { id: "adames", name: "Willy Adames", team: "SF", pos: "SS", mlbId: 642715 },
  // Ramos was traded to the Yankees at the deadline; Luciano gets first
  // crack at left field while the Giants look for a longer-term answer.
  { id: "luciano", name: "Marco Luciano", team: "SF", pos: "LF", mlbId: 682617 },
  { id: "mccray", name: "Grant McCray", team: "SF", pos: "CF", mlbId: 687529 },
  { id: "jhlee", name: "Jung Hoo Lee", team: "SF", pos: "RF", mlbId: 808982 },
  { id: "eldridge", name: "Bryce Eldridge", team: "SF", pos: "DH", mlbId: 805811 },
  { id: "whisenhunt", name: "Carson Whisenhunt", team: "SF", pos: "SP", mlbId: 687931 },
];
const DBACKS_PLAYERS = [
  { id: "moreno", name: "Gabriel Moreno", team: "ARI", pos: "C", mlbId: 672515 },
  { id: "locklear", name: "Tyler Locklear", team: "ARI", pos: "1B", mlbId: 682988 },
  { id: "marte", name: "Ketel Marte", team: "ARI", pos: "2B", mlbId: 606466 },
  { id: "arenado", name: "Nolan Arenado", team: "ARI", pos: "3B", mlbId: 571448 },
  { id: "perdomo", name: "Geraldo Perdomo", team: "ARI", pos: "SS", mlbId: 672695 },
  { id: "kepler", name: "Max Kepler", team: "ARI", pos: "LF", mlbId: 596146 },
  { id: "barrosa", name: "Jorge Barrosa", team: "ARI", pos: "CF", mlbId: 678489 },
  { id: "carroll", name: "Corbin Carroll", team: "ARI", pos: "RF", mlbId: 682998 },
  { id: "delcastillo", name: "Adrian Del Castillo", team: "ARI", pos: "DH", mlbId: 680728 },
  { id: "drake", name: "Kohl Drake", team: "ARI", pos: "SP", mlbId: 684442 },
];
const NATIONALS_PLAYERS = [
  { id: "keibertruiz", name: "Keibert Ruiz", team: "WSH", pos: "C", mlbId: 660688 },
  // García Jr. was traded to the Yankees at the deadline; Ortiz was
  // recalled from Triple-A Rochester to replace him at first.
  { id: "aortiz", name: "Abimelec Ortiz", team: "WSH", pos: "1B", mlbId: 694673 },
  { id: "nunez", name: "Nasim Nuñez", team: "WSH", pos: "2B", mlbId: 683083 },
  { id: "vivas", name: "Jorbit Vivas", team: "WSH", pos: "3B", mlbId: 678391 },
  { id: "abrams", name: "CJ Abrams", team: "WSH", pos: "SS", mlbId: 682928 },
  { id: "lile", name: "Daylen Lile", team: "WSH", pos: "LF", mlbId: 695734 },
  { id: "jyoung", name: "Jacob Young", team: "WSH", pos: "CF", mlbId: 696285 },
  { id: "wood", name: "James Wood", team: "WSH", pos: "RF", mlbId: 695578 },
  { id: "tena", name: "José Tena", team: "WSH", pos: "DH", mlbId: 677588 },
  { id: "mikolas", name: "Miles Mikolas", team: "WSH", pos: "SP", mlbId: 571945 },
];
const PADRES_PLAYERS = [
  { id: "campusano", name: "Luis Campusano", team: "SD", pos: "C", mlbId: 669134 },
  { id: "tfrance", name: "Ty France", team: "SD", pos: "1B", mlbId: 664034 },
  { id: "cronenworth", name: "Jake Cronenworth", team: "SD", pos: "2B", mlbId: 630105 },
  { id: "machado", name: "Manny Machado", team: "SD", pos: "3B", mlbId: 592518 },
  { id: "bogaerts", name: "Xander Bogaerts", team: "SD", pos: "SS", mlbId: 593428 },
  { id: "sheets", name: "Gavin Sheets", team: "SD", pos: "LF", mlbId: 657757 },
  { id: "merrill", name: "Jackson Merrill", team: "SD", pos: "CF", mlbId: 701538 },
  { id: "tatis", name: "Fernando Tatis Jr.", team: "SD", pos: "RF", mlbId: 665487 },
  { id: "rengifo", name: "Luis Rengifo", team: "SD", pos: "DH", mlbId: 650859 },
  { id: "buehler", name: "Walker Buehler", team: "SD", pos: "SP", mlbId: 621111 },
];
const MARLINS_PLAYERS = [
  { id: "mack", name: "Joe Mack", team: "MIA", pos: "C", mlbId: 691788 },
  { id: "pauley", name: "Graham Pauley", team: "MIA", pos: "1B", mlbId: 688363 },
  { id: "xedwards", name: "Xavier Edwards", team: "MIA", pos: "2B", mlbId: 669364 },
  { id: "sanoja", name: "Javier Sanoja", team: "MIA", pos: "3B", mlbId: 691594 },
  { id: "olopez", name: "Otto Lopez", team: "MIA", pos: "SS", mlbId: 672640 },
  { id: "stowers", name: "Kyle Stowers", team: "MIA", pos: "LF", mlbId: 669065 },
  { id: "marsee", name: "Jakob Marsee", team: "MIA", pos: "CF", mlbId: 805300 },
  { id: "eruiz", name: "Esteury Ruiz", team: "MIA", pos: "RF", mlbId: 665923 },
  { id: "conine", name: "Griffin Conine", team: "MIA", pos: "DH", mlbId: 665052 },
  { id: "junk", name: "Janson Junk", team: "MIA", pos: "SP", mlbId: 676083 },
];
const ATHLETICS_PLAYERS = [
  { id: "langeliers", name: "Shea Langeliers", team: "ATH", pos: "C", mlbId: 669127 },
  { id: "kurtz", name: "Nick Kurtz", team: "ATH", pos: "1B", mlbId: 701762 },
  { id: "mcneil", name: "Jeff McNeil", team: "ATH", pos: "2B", mlbId: 643446 },
  { id: "twhite", name: "Tommy White", team: "ATH", pos: "3B", mlbId: 695720 },
  { id: "jwilson", name: "Jacob Wilson", team: "ATH", pos: "SS", mlbId: 805779 },
  { id: "soderstrom", name: "Tyler Soderstrom", team: "ATH", pos: "LF", mlbId: 691016 },
  { id: "bolte", name: "Henry Bolte", team: "ATH", pos: "CF", mlbId: 703607 },
  { id: "butler", name: "Lawrence Butler", team: "ATH", pos: "RF", mlbId: 671732 },
  { id: "cortes", name: "Carlos Cortes", team: "ATH", pos: "DH", mlbId: 666126 },
  { id: "springs", name: "Jeffrey Springs", team: "ATH", pos: "SP", mlbId: 605488 },
];
const TWINS_PLAYERS = [
  { id: "jeffers", name: "Ryan Jeffers", team: "MIN", pos: "C", mlbId: 680777 },
  { id: "kclemens", name: "Kody Clemens", team: "MIN", pos: "1B", mlbId: 665019 },
  { id: "keaschall", name: "Luke Keaschall", team: "MIN", pos: "2B", mlbId: 807712 },
  { id: "rlewis", name: "Royce Lewis", team: "MIN", pos: "3B", mlbId: 668904 },
  { id: "kreidler", name: "Ryan Kreidler", team: "MIN", pos: "SS", mlbId: 668952 },
  { id: "larnach", name: "Trevor Larnach", team: "MIN", pos: "LF", mlbId: 663616 },
  { id: "buxton", name: "Byron Buxton", team: "MIN", pos: "CF", mlbId: 621439 },
  { id: "amartin", name: "Austin Martin", team: "MIN", pos: "RF", mlbId: 668885 },
  { id: "bell", name: "Josh Bell", team: "MIN", pos: "DH", mlbId: 605137 },
  { id: "prielipp", name: "Connor Prielipp", team: "MIN", pos: "SP", mlbId: 687570 },
];
const ROCKIES_PLAYERS = [
  { id: "goodman", name: "Hunter Goodman", team: "COL", pos: "C", mlbId: 696100 },
  { id: "rumfield", name: "TJ Rumfield", team: "COL", pos: "1B", mlbId: 681198 },
  { id: "julien", name: "Edouard Julien", team: "COL", pos: "2B", mlbId: 666397 },
  { id: "karros", name: "Kyle Karros", team: "COL", pos: "3B", mlbId: 691720 },
  { id: "tovar", name: "Ezequiel Tovar", team: "COL", pos: "SS", mlbId: 678662 },
  { id: "moniak", name: "Mickey Moniak", team: "COL", pos: "LF", mlbId: 666160 },
  { id: "jmccarthy", name: "Jake McCarthy", team: "COL", pos: "CF", mlbId: 664983 },
  { id: "tfreeman", name: "Tyler Freeman", team: "COL", pos: "RF", mlbId: 671289 },
  { id: "fulford", name: "Braxton Fulford", team: "COL", pos: "DH", mlbId: 690924 },
  { id: "freeland", name: "Kyle Freeland", team: "COL", pos: "SP", mlbId: 607536 },
];
const BREWERS_PLAYERS = [
  { id: "wcontreras", name: "William Contreras", team: "MIL", pos: "C", mlbId: 661388 },
  { id: "vaughn", name: "Andrew Vaughn", team: "MIL", pos: "1B", mlbId: 683734 },
  { id: "turang", name: "Brice Turang", team: "MIL", pos: "2B", mlbId: 668930 },
  { id: "hamilton", name: "David Hamilton", team: "MIL", pos: "3B", mlbId: 666152 },
  { id: "ortiz", name: "Joey Ortiz", team: "MIL", pos: "SS", mlbId: 687401 },
  { id: "chourio", name: "Jackson Chourio", team: "MIL", pos: "LF", mlbId: 694192 },
  { id: "gmitchell", name: "Garrett Mitchell", team: "MIL", pos: "CF", mlbId: 669003 },
  { id: "llara", name: "Luis Lara", team: "MIL", pos: "RF", mlbId: 800325 },
  { id: "yelich", name: "Christian Yelich", team: "MIL", pos: "DH", mlbId: 592885 },
  { id: "misiorowski", name: "Jacob Misiorowski", team: "MIL", pos: "SP", mlbId: 694819 },
];
const REDS_PLAYERS = [
  { id: "stephenson", name: "Tyler Stephenson", team: "CIN", pos: "C", mlbId: 663886 },
  { id: "steer", name: "Spencer Steer", team: "CIN", pos: "1B", mlbId: 668715 },
  { id: "earroyo", name: "Edwin Arroyo", team: "CIN", pos: "2B", mlbId: 695490 },
  { id: "khayes", name: "Ke'Bryan Hayes", team: "CIN", pos: "3B", mlbId: 663647 },
  { id: "edelacruz", name: "Elly De La Cruz", team: "CIN", pos: "SS", mlbId: 682829 },
  { id: "bleday", name: "JJ Bleday", team: "CIN", pos: "LF", mlbId: 668709 },
  { id: "friedl", name: "TJ Friedl", team: "CIN", pos: "CF", mlbId: 670770 },
  { id: "nmarte", name: "Noelvi Marte", team: "CIN", pos: "RF", mlbId: 682622 },
  { id: "esuarez", name: "Eugenio Suárez", team: "CIN", pos: "DH", mlbId: 553993 },
  { id: "abbott", name: "Andrew Abbott", team: "CIN", pos: "SP", mlbId: 671096 },
];
const CARDINALS_PLAYERS = [
  { id: "ppages", name: "Pedro Pagés", team: "STL", pos: "C", mlbId: 686780 },
  { id: "burleson", name: "Alec Burleson", team: "STL", pos: "1B", mlbId: 676475 },
  { id: "wetherholt", name: "JJ Wetherholt", team: "STL", pos: "2B", mlbId: 802139 },
  { id: "bjordan", name: "Blaze Jordan", team: "STL", pos: "3B", mlbId: 691458 },
  { id: "winn", name: "Masyn Winn", team: "STL", pos: "SS", mlbId: 691026 },
  { id: "nootbaar", name: "Lars Nootbaar", team: "STL", pos: "LF", mlbId: 663457 },
  { id: "nchurch", name: "Nathan Church", team: "STL", pos: "CF", mlbId: 701675 },
  { id: "jwalker", name: "Jordan Walker", team: "STL", pos: "RF", mlbId: 691023 },
  { id: "herrera", name: "Iván Herrera", team: "STL", pos: "DH", mlbId: 671056 },
  { id: "leahy", name: "Kyle Leahy", team: "STL", pos: "SP", mlbId: 681517 },
];

// Combined roster used for lookup by playerId -- ids don't collide across
// teams, so a flat find() works the same way PLAYERS.find() does on the
// NBA page for its two Finals rosters.
const ALL_MLB_PLAYERS = [
  ...MLB_PLAYERS, ...PHILLIES_PLAYERS, ...DODGERS_PLAYERS, ...METS_PLAYERS,
  ...BRAVES_PLAYERS, ...ORIOLES_PLAYERS, ...BLUEJAYS_PLAYERS, ...REDSOX_PLAYERS,
  ...CUBS_PLAYERS, ...PIRATES_PLAYERS, ...MARINERS_PLAYERS, ...RANGERS_PLAYERS,
  ...GUARDIANS_PLAYERS, ...RAYS_PLAYERS, ...ROYALS_PLAYERS, ...TIGERS_PLAYERS,
  ...ASTROS_PLAYERS, ...WHITESOX_PLAYERS, ...ANGELS_PLAYERS, ...GIANTS_PLAYERS_MLB,
  ...DBACKS_PLAYERS, ...NATIONALS_PLAYERS, ...PADRES_PLAYERS, ...MARLINS_PLAYERS,
  ...ATHLETICS_PLAYERS, ...TWINS_PLAYERS, ...ROCKIES_PLAYERS, ...BREWERS_PLAYERS,
  ...REDS_PLAYERS, ...CARDINALS_PLAYERS,
];

// Each entry is one matchup the Prop Ledger can scout -- the "matchup
// selector" dropdown on the MLB page switches between these, swapping which
// two rosters populate the left/right sidebars, same pattern as the NFL page.
const MLB_MATCHUPS = [
  {
    id: "cle-cin-1",
    label: "Guardians @ Reds (Game 1)",
    teamA: { label: "Cleveland Guardians", players: GUARDIANS_PLAYERS },
    teamB: { label: "Cincinnati Reds", players: REDS_PLAYERS },
    date: "2026-07-28T17:40:00Z",
    venue: "Great American Ball Park",
    city: "Cincinnati, OH",
  },
  {
    id: "cle-cin-2",
    label: "Guardians @ Reds (Game 2)",
    teamA: { label: "Cleveland Guardians", players: GUARDIANS_PLAYERS },
    teamB: { label: "Cincinnati Reds", players: REDS_PLAYERS },
    date: "2026-07-28T23:10:00Z",
    venue: "Great American Ball Park",
    city: "Cincinnati, OH",
  },
  {
    id: "bal-det",
    label: "Orioles @ Tigers",
    teamA: { label: "Baltimore Orioles", players: ORIOLES_PLAYERS },
    teamB: { label: "Detroit Tigers", players: TIGERS_PLAYERS },
    date: "2026-07-28T22:40:00Z",
    venue: "Comerica Park",
    city: "Detroit, MI",
  },
  {
    id: "ari-pit",
    label: "Diamondbacks @ Pirates",
    teamA: { label: "Arizona Diamondbacks", players: DBACKS_PLAYERS },
    teamB: { label: "Pittsburgh Pirates", players: PIRATES_PLAYERS },
    date: "2026-07-28T22:40:00Z",
    venue: "PNC Park",
    city: "Pittsburgh, PA",
  },
  {
    id: "tex-tb",
    label: "Rangers @ Rays",
    teamA: { label: "Texas Rangers", players: RANGERS_PLAYERS },
    teamB: { label: "Tampa Bay Rays", players: RAYS_PLAYERS },
    date: "2026-07-28T22:40:00Z",
    venue: "Tropicana Field",
    city: "St. Petersburg, FL",
  },
  {
    id: "phi-mia",
    label: "Phillies @ Marlins",
    teamA: { label: "Philadelphia Phillies", players: PHILLIES_PLAYERS },
    teamB: { label: "Miami Marlins", players: MARLINS_PLAYERS },
    date: "2026-07-28T22:40:00Z",
    venue: "loanDepot park",
    city: "Miami, FL",
  },
  {
    id: "tor-wsh",
    label: "Blue Jays @ Nationals",
    teamA: { label: "Toronto Blue Jays", players: BLUEJAYS_PLAYERS },
    teamB: { label: "Washington Nationals", players: NATIONALS_PLAYERS },
    date: "2026-07-28T22:45:00Z",
    venue: "Nationals Park",
    city: "Washington, DC",
  },
  {
    id: "atl-nym",
    label: "Braves @ Mets",
    teamA: { label: "Atlanta Braves", players: BRAVES_PLAYERS },
    teamB: { label: "New York Mets", players: METS_PLAYERS },
    date: "2026-07-28T23:10:00Z",
    venue: "Citi Field",
    city: "New York, NY",
  },
  {
    id: "kc-min",
    label: "Royals @ Twins",
    teamA: { label: "Kansas City Royals", players: ROYALS_PLAYERS },
    teamB: { label: "Minnesota Twins", players: TWINS_PLAYERS },
    date: "2026-07-28T23:40:00Z",
    venue: "Target Field",
    city: "Minneapolis, MN",
  },
  {
    id: "nyy-cws",
    label: "Yankees @ White Sox",
    teamA: { label: "New York Yankees", players: MLB_PLAYERS },
    teamB: { label: "Chicago White Sox", players: WHITESOX_PLAYERS },
    date: "2026-07-28T23:40:00Z",
    venue: "Rate Field",
    city: "Chicago, IL",
  },
  {
    id: "chc-stl",
    label: "Cubs @ Cardinals",
    teamA: { label: "Chicago Cubs", players: CUBS_PLAYERS },
    teamB: { label: "St. Louis Cardinals", players: CARDINALS_PLAYERS },
    date: "2026-07-28T23:45:00Z",
    venue: "Busch Stadium",
    city: "St. Louis, MO",
  },
  {
    id: "hou-laa",
    label: "Astros @ Angels",
    teamA: { label: "Houston Astros", players: ASTROS_PLAYERS },
    teamB: { label: "Los Angeles Angels", players: ANGELS_PLAYERS },
    date: "2026-07-29T01:38:00Z",
    venue: "Angel Stadium",
    city: "Anaheim, CA",
  },
  {
    id: "bos-ath",
    label: "Red Sox @ Athletics",
    teamA: { label: "Boston Red Sox", players: REDSOX_PLAYERS },
    teamB: { label: "Athletics", players: ATHLETICS_PLAYERS },
    date: "2026-07-29T01:40:00Z",
    venue: "Sutter Health Park",
    city: "West Sacramento, CA",
  },
  {
    id: "col-sd",
    label: "Rockies @ Padres",
    teamA: { label: "Colorado Rockies", players: ROCKIES_PLAYERS },
    teamB: { label: "San Diego Padres", players: PADRES_PLAYERS },
    date: "2026-07-29T01:40:00Z",
    venue: "Petco Park",
    city: "San Diego, CA",
  },
  {
    id: "mil-sf",
    label: "Brewers @ Giants",
    teamA: { label: "Milwaukee Brewers", players: BREWERS_PLAYERS },
    teamB: { label: "San Francisco Giants", players: GIANTS_PLAYERS_MLB },
    date: "2026-07-29T01:45:00Z",
    venue: "Oracle Park",
    city: "San Francisco, CA",
  },
  {
    id: "sea-lad",
    label: "Mariners @ Dodgers",
    teamA: { label: "Seattle Mariners", players: MARINERS_PLAYERS },
    teamB: { label: "Los Angeles Dodgers", players: DODGERS_PLAYERS },
    date: "2026-07-29T02:10:00Z",
    venue: "Dodger Stadium",
    city: "Los Angeles, CA",
  },
];

// Flat team -> {label, players} lookup built from MLB_MATCHUPS' two sides,
// so any of the 30 real rosters can be selected directly by team instead of
// only ever appearing paired into one fixed mock matchup.
const MLB_TEAM_ROSTERS = {};
MLB_MATCHUPS.forEach((m) => {
  MLB_TEAM_ROSTERS[m.teamA.players[0].team] = m.teamA;
  MLB_TEAM_ROSTERS[m.teamB.players[0].team] = m.teamB;
});

// Live game logs, fetched directly from the official MLB Stats API (see
// fetchMLBGameLog below) instead of a static snapshot -- this is what keeps
// the props page from drifting stale once games are played.
const MLB_TEAM_ID_ABBR = {
  109: "ARI", 144: "ATL", 110: "BAL", 111: "BOS", 112: "CHC", 145: "CWS", 113: "CIN", 114: "CLE",
  115: "COL", 116: "DET", 117: "HOU", 118: "KC", 108: "LAA", 119: "LAD", 146: "MIA", 158: "MIL",
  142: "MIN", 121: "NYM", 147: "NYY", 133: "ATH", 143: "PHI", 134: "PIT", 135: "SD", 136: "SEA",
  137: "SF", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 120: "WSH",
};

// How long a fetched game log is considered fresh before we hit the API
// again. Refetched on every page mount/player switch plus on this interval
// while the page stays open, so a finished game shows up automatically
// without requiring unnecessary calls between games.
const MLB_GAMELOG_TTL_MS = 15 * 60 * 1000;
const mlbGameLogCache = new Map();

async function fetchMLBGameLog(mlbId) {
  const cached = mlbGameLogCache.get(mlbId);
  if (cached && Date.now() - cached.fetchedAt < MLB_GAMELOG_TTL_MS) return cached.games;

  // v4 adds gamePk (see fetchMLBGameBoxscoreLineupIds) -- bumped so any
  // cache written before that field existed gets refetched instead of
  // silently missing it.
  const cacheKey = `mlb_gamelog_v4_${mlbId}`;
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Date.now() - parsed.fetchedAt < MLB_GAMELOG_TTL_MS) {
        mlbGameLogCache.set(mlbId, parsed);
        return parsed.games;
      }
    }
  } catch {}

  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/people/${mlbId}/stats?stats=gameLog&group=hitting&season=2026&gameType=R`
  );
  const data = await res.json();
  const splits = data?.stats?.[0]?.splits || [];
  const games = splits.map((s) => {
    const st = s.stat;
    return {
      date: s.date,
      opp: MLB_TEAM_ID_ABBR[s.opponent?.id] || s.opponent?.name || "???",
      home: !!s.isHome,
      pa: st.plateAppearances || 0,
      h: st.hits || 0,
      hr: st.homeRuns || 0,
      tb: st.totalBases || 0,
      rbi: st.rbi || 0,
      r: st.runs || 0,
      bb: st.baseOnBalls || 0,
      so: st.strikeOuts || 0,
      sb: st.stolenBases || 0,
      ab: st.atBats || 0,
      hbp: st.hitByPitch || 0,
      sf: st.sacFlies || 0,
      gamePk: s.game?.gamePk || null,
    };
  });

  const record = { games, fetchedAt: Date.now() };
  mlbGameLogCache.set(mlbId, record);
  try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
  return games;
}

// Set of every mlbId who appeared (either team) in one historical game --
// used by the "Teammates" With/Without filter (see MLBPropsPage) to check
// whether a given teammate played in each of a batter's logged games.
// Historical boxscores are immutable once the game is final, so this is
// cached with no TTL (in-memory Map + sessionStorage) rather than refetched
// on any schedule.
const mlbBoxscoreLineupCache = new Map();
async function fetchMLBGameBoxscoreLineupIds(gamePk) {
  if (!gamePk) return new Set();
  const cached = mlbBoxscoreLineupCache.get(gamePk);
  if (cached) return cached;

  const cacheKey = `mlb_boxscore_lineup_v1_${gamePk}`;
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const ids = new Set(JSON.parse(stored));
      mlbBoxscoreLineupCache.set(gamePk, ids);
      return ids;
    }
  } catch {}

  let ids = new Set();
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`);
    const data = await res.json();
    // `batters`/`pitchers` are id arrays of who actually appeared -- the
    // boxscore's `players` dict lists the whole active roster present that
    // day (including bench players who never got in), so those two arrays
    // are the correct "did they play" signal, not presence in `players`.
    [data?.teams?.home, data?.teams?.away].forEach((side) => {
      (side?.batters || []).forEach((id) => ids.add(id));
      (side?.pitchers || []).forEach((id) => ids.add(id));
    });
  } catch {
    return new Set();
  }

  mlbBoxscoreLineupCache.set(gamePk, ids);
  try { sessionStorage.setItem(cacheKey, JSON.stringify([...ids])); } catch {}
  return ids;
}

// Rolls a set of batter game logs up into the rate stats shown on the
// player card (see MLBPropsPage) -- AVG/OBP/BABIP/K% are computed from the
// raw counting stats rather than trusting the API's own cumulative rate
// fields, so the same math applies whether "games" is the full season or
// whatever the active filters have narrowed it down to.
function battingRateAgg(games) {
  const n = games.length || 1;
  const sum = (k) => games.reduce((a, g) => a + (g[k] || 0), 0);
  const ab = sum("ab"), h = sum("h"), bb = sum("bb"), hbp = sum("hbp"), sf = sum("sf"), so = sum("so"), hr = sum("hr"), pa = sum("pa");
  const obDen = ab + bb + hbp + sf;
  const babipDen = ab - so - hr + sf;
  return {
    pa: pa / n,
    hits: h / n,
    avg: ab ? h / ab : 0,
    obp: obDen ? (h + bb + hbp) / obDen : 0,
    babip: babipDen ? (h - hr) / babipDen : 0,
    kpct: pa ? (so / pa) * 100 : 0,
  };
}

// Pitching equivalent of battingRateAgg -- rolls a set of pitcher game logs
// (see fetchMLBPitcherGameLog) up into the rate stats shown on the
// pitcher's rate-stat bar. IP is derived from the outs-recorded field
// rather than trusting a separately-formatted innings-pitched string, so
// the same division works whether "games" is the full season or whatever
// the active filters have narrowed it down to.
function pitchingRateAgg(games) {
  const n = games.length || 1;
  const sum = (k) => games.reduce((a, g) => a + (g[k] || 0), 0);
  const outs = sum("outs"), k = sum("k"), er = sum("er"), h = sum("h"), bb = sum("bb");
  const ip = outs / 3;
  return {
    ip: ip / n,
    k: k / n,
    era: outs ? (er * 27) / outs : 0,
    whip: outs ? ((bb + h) * 3) / outs : 0,
    h9: outs ? (h * 27) / outs : 0,
    bb9: outs ? (bb * 27) / outs : 0,
  };
}

// Reverse of MLB_TEAM_ID_ABBR -- needed to turn a selected roster's team
// abbreviation back into the MLB Stats API's numeric team id for the
// schedule fetch below.
const MLB_ABBR_TEAM_ID = Object.fromEntries(
  Object.entries(MLB_TEAM_ID_ABBR).map(([id, abbr]) => [abbr, Number(id)])
);

// Next scheduled/live game for any MLB team (opponent + home/away), used by
// both the Prop Feed (Yankees) and the MLB Props page (whichever team is
// selected) to show the actual upcoming matchup instead of a mock "next
// opp." Same cache-then-refetch TTL pattern as fetchMLBGameLog above, so
// once a game goes final the following poll picks up the new day's opponent
// -- this is what keeps a selected team's matchup "renewed" day to day
// without any separate refresh step.
const YANKEES_TEAM_ID = 147;
const MLB_SCHEDULE_TTL_MS = 60 * 60 * 1000;
const mlbScheduleCache = new Map();

// `gamePk` pins the result to one specific game instead of "the team's next
// non-final one". It only ever matters for a doubleheader, where those two
// answers differ: without it, picking Gm 2 in the matchup dropdown would
// still show Gm 1's probable starter and first pitch, since Gm 1 is the next
// non-final game right up until it ends. Cached per (team, game) for the
// same reason -- one team can now have two live answers on the same day.
async function fetchMLBTeamNextGame(teamId, gamePk) {
  const cacheId = gamePk ? `${teamId}_${gamePk}` : teamId;
  const cached = mlbScheduleCache.get(cacheId);
  if (cached && Date.now() - cached.fetchedAt < MLB_SCHEDULE_TTL_MS) {
    return cached.game;
  }
  // v3: now also hydrates weather and confirmed lineups (both sides) --
  // weather is only meaningful once MLB has posted it for the game, and
  // lineups are usually posted 1-2 hours before first pitch, so both are
  // simply absent/empty until MLB actually publishes them.
  const cacheKey = `mlb_next_game_${cacheId}_v3`;
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Date.now() - parsed.fetchedAt < MLB_SCHEDULE_TTL_MS) {
        mlbScheduleCache.set(cacheId, parsed);
        return parsed.game;
      }
    }
  } catch {}

  const today = new Date();
  // Start the search a day early rather than at today's UTC date: for any
  // US team, the UTC calendar date rolls over to "tomorrow" 4-5 hours
  // before local midnight (e.g. 8pm ET), so a plain toISOString() cutoff
  // starts missing a game that's still live -- the schedule request would
  // only find the following day's later game, which has no confirmed
  // lineup posted yet, and the panel would show just the static roster's
  // handful of hardcoded batters instead of tonight's real, fully-posted
  // lineup. Casting a day wider and letting the "not Final" filter below
  // pick the right game handles every timezone without needing to know
  // the team's actual local offset.
  const start = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${start}&endDate=${end}&hydrate=probablePitcher,venue,weather,lineups`
  );
  const data = await res.json();
  const games = (data?.dates || []).flatMap((d) => d.games || []);
  const upcoming =
    (gamePk && games.find((g) => g.gamePk === gamePk)) ||
    games.find((g) => g.status?.abstractGameState !== "Final") ||
    games[0] ||
    null;

  let game = null;
  if (upcoming) {
    const isHome = upcoming.teams?.home?.team?.id === teamId;
    const oppTeam = isHome ? upcoming.teams?.away?.team : upcoming.teams?.home?.team;
    const ourSide = isHome ? upcoming.teams?.home : upcoming.teams?.away;
    const oppSide = isHome ? upcoming.teams?.away : upcoming.teams?.home;
    const probable = ourSide?.probablePitcher;
    const oppProbable = oppSide?.probablePitcher;
    const ourLineup = isHome ? upcoming.lineups?.homePlayers : upcoming.lineups?.awayPlayers;
    const oppLineup = isHome ? upcoming.lineups?.awayPlayers : upcoming.lineups?.homePlayers;
    game = {
      date: upcoming.gameDate,
      opp: MLB_TEAM_ID_ABBR[oppTeam?.id] || oppTeam?.abbreviation || "???",
      home: isHome,
      venue: upcoming.venue?.name || "",
      status: upcoming.status?.detailedState || "Scheduled",
      probablePitcher: probable ? { mlbId: probable.id, name: probable.fullName } : null,
      oppProbablePitcher: oppProbable ? { mlbId: oppProbable.id, name: oppProbable.fullName } : null,
      weather: upcoming.weather?.condition
        ? { condition: upcoming.weather.condition, temp: upcoming.weather.temp, wind: upcoming.weather.wind }
        : null,
      ourLineupIds: (ourLineup || []).map((p) => p.id),
      oppLineupIds: (oppLineup || []).map((p) => p.id),
    };
  }

  const record = { game, fetchedAt: Date.now() };
  mlbScheduleCache.set(cacheId, record);
  try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
  return game;
}

// The team's real active (25/26-man) roster -- the official MLB Stats API
// roster endpoint, which automatically excludes anyone on the IL, DFA'd, or
// no longer with the org. Used as a live safety filter over the static
// roster arrays below (see applyActiveRoster / reconcileMlbLineup) so an injured
// or traded player never lingers in a lineup panel just because the day's
// confirmed batting order (fetchMLBTeamNextGame) hasn't posted yet -- that's
// what let an IL'd Cody Bellinger keep showing for the Yankees. Also cached
// with a short TTL (not just per calendar day) and re-polled on an interval
// -- see the teamActiveRoster/oppActiveRoster effects in MLBPropsPage -- so
// a same-day roster move (a demotion/call-up/trade) drops or adds a player
// within minutes instead of waiting for the next calendar day's refetch.
const MLB_ACTIVE_ROSTER_TTL_MS = 15 * 60 * 1000;
const mlbActiveRosterCache = new Map();
async function fetchMLBTeamActiveRoster(teamId) {
  const dayKey = currentMLBDayKey();
  const cached = mlbActiveRosterCache.get(teamId);
  if (cached && cached.dayKey === dayKey && Date.now() - cached.fetchedAt < MLB_ACTIVE_ROSTER_TTL_MS) return cached.roster;

  const cacheKey = `mlb_active_roster_v1_${teamId}`;
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.dayKey === dayKey && Date.now() - parsed.fetchedAt < MLB_ACTIVE_ROSTER_TTL_MS) {
        mlbActiveRosterCache.set(teamId, parsed);
        return parsed.roster;
      }
    }
  } catch {}

  let roster = null;
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/roster/active`);
    const data = await res.json();
    roster = (data?.roster || []).map((r) => ({
      mlbId: r.person?.id,
      name: r.person?.fullName,
      pos: r.position?.abbreviation,
    })).filter((p) => p.mlbId && p.name);
  } catch {
    roster = null;
  }
  // A failed/empty fetch isn't cached (dayKey stays unset) so the next call
  // -- same page load or a later one -- retries instead of permanently
  // trusting the static roster for the rest of the day.
  if (!roster) return null;

  const record = { dayKey, roster, fetchedAt: Date.now() };
  mlbActiveRosterCache.set(teamId, record);
  try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
  return roster;
}

// Live safety filter: drops any static roster entry (see MLB_PLAYERS etc.)
// that isn't actually on the team's real active roster right now -- an IL'd,
// DFA'd, or traded-away player never shows up regardless of whether MLB has
// posted today's exact batting order yet, which is what applyConfirmedLineup
// alone couldn't guard against. This only ever trims the static 9-man
// projected lineup down, never adds the rest of the active/bench roster on
// top of it -- that's what kept every backup catcher/utility infielder
// showing up alongside the real projected starters before a lineup is
// confirmed. `activeRoster` is null while loading or if the fetch failed --
// in that case this is a no-op, same "never show an empty/wrong panel"
// fallback philosophy as applyConfirmedLineup below.
function applyActiveRoster(roster, activeRoster) {
  if (!activeRoster || !activeRoster.length) return roster;
  const activeIds = new Set(activeRoster.map((p) => p.mlbId));
  const kept = roster.players.filter((p) => p.pos === "SP" || activeIds.has(p.mlbId));
  if (!kept.some((p) => p.pos !== "SP")) return roster;
  return { label: roster.label, players: kept };
}

// Once MLB posts the day's confirmed batting order (real mlbIds from the
// live schedule fetch), position players are narrowed to just that list --
// this is what drops someone like an IL'd Bellinger out of a static roster
// array without needing a separate "who's on the IL" lookup. If the
// confirmed list hasn't posted yet, or happens to share zero mlbIds with our
// static roster (e.g. a mid-week call-up we don't have modeled), it falls
// back to the full static roster rather than an empty/wrong lineup.
function applyConfirmedLineup(roster, lineupIds, activeRoster, abbr) {
  if (!lineupIds || !lineupIds.length) return roster;
  const known = roster.players.filter((p) => p.pos === "SP" || lineupIds.includes(p.mlbId));
  // A confirmed starter who isn't in our static projected 9 (a call-up or
  // trade-deadline addition we don't have modeled) still needs to show --
  // pull their name/position from the active-roster fetch (which has both)
  // so the lineup reflects the real confirmed one rather than silently
  // dropping them.
  const knownIds = new Set(known.map((p) => p.mlbId));
  const extras = (activeRoster || [])
    .filter((p) => lineupIds.includes(p.mlbId) && !knownIds.has(p.mlbId))
    .map((p) => ({ id: mlbLiveBatterId(abbr, p.mlbId), name: p.name, team: abbr, pos: p.pos, mlbId: p.mlbId }));
  const filtered = [...known, ...extras];
  if (!filtered.some((p) => p.pos !== "SP")) return roster;
  return { label: roster.label, players: filtered };
}

// Last-resort fill for whenever MLB hasn't posted a confirmed lineup yet
// (applyConfirmedLineup is then a no-op) and our own static roster array --
// which was only ever meant as a rough projected 9, not a full 26-man model
// -- happens to be short a recent call-up/trade addition it doesn't have
// modeled, or was just trimmed by applyActiveRoster. Rather than showing
// whatever handful of hardcoded batters is left, top the lineup back up to a
// believable 9 using real active-roster players (favoring ones at a position
// not already covered, so it reads like a real defensive lineup rather than
// three extra first basemen) until it either hits 9 or runs out of
// active-roster batters to add. A no-op once a real confirmed lineup already
// filled all 9 spots.
function topUpProjectedBatters(roster, activeRoster, abbr, targetCount = 9) {
  const batters = roster.players.filter((p) => p.pos !== "SP");
  if (batters.length >= targetCount || !activeRoster || !activeRoster.length) return roster;
  const haveIds = new Set(roster.players.map((p) => p.mlbId));
  const havePositions = new Set(batters.map((p) => p.pos));
  const candidates = activeRoster.filter((p) => p.mlbId && p.pos && p.pos !== "P" && p.pos !== "SP" && !haveIds.has(p.mlbId));
  const preferred = candidates.filter((p) => !havePositions.has(p.pos));
  const rest = candidates.filter((p) => havePositions.has(p.pos));
  const additions = [...preferred, ...rest]
    .slice(0, targetCount - batters.length)
    .map((p) => ({ id: mlbLiveBatterId(abbr, p.mlbId), name: p.name, team: abbr, pos: p.pos, mlbId: p.mlbId }));
  if (!additions.length) return roster;
  return { label: roster.label, players: [...roster.players, ...additions] };
}

// Every mlbId on *any* team's real active roster, as one Set. The per-team
// fetches underneath are the same cached ones the feed and player page use
// (module Map + sessionStorage, 15-minute TTL), so on an MLB page these are
// already warm and this costs nothing extra. Returns null if every team's
// fetch failed, which callers treat as "don't filter" -- never as "nobody is
// active". Teams that individually fail are simply absent from the Set,
// which is why callers must only ever use this to *rank* or *annotate*
// leaguewide, and to filter only where a false negative is cheap.
async function fetchAllMLBActiveMlbIds() {
  const rosters = await Promise.all(
    Object.values(MLB_ABBR_TEAM_ID).map((teamId) => fetchMLBTeamActiveRoster(teamId))
  );
  if (!rosters.some(Boolean)) return null;
  const ids = new Set();
  rosters.forEach((roster) => (roster || []).forEach((p) => ids.add(p.mlbId)));
  return ids;
}

// The one reconciliation pipeline that turns a hand-maintained static
// projected lineup into who is really available today, shared by the MLB
// player page (liveTeamRoster/liveOppRoster) and the Prop Feed. Order
// matters: trim to the real active roster first (removes IL'd/DFA'd/traded
// players), then narrow to the confirmed batting order if one has posted,
// then backfill up to nine from the active roster so trade-deadline
// additions we never hardcoded still get props built for them.
function reconcileMlbLineup(roster, { activeRoster, lineupIds, abbr }) {
  const reconciled = applyActiveRoster(roster, activeRoster);
  const withConfirmed = applyConfirmedLineup(reconciled, lineupIds, activeRoster, abbr);
  return topUpProjectedBatters(withConfirmed, activeRoster, abbr);
}

// Roster status (IL / day-to-day / optioned / DFA'd) for every player on a
// team's 40-man. /roster/active -- the fetch above -- can't answer this by
// construction: it only ever returns players who are active, so everyone in
// it reads the same. The 40-man variant carries a `status` per entry, which
// is what lets a teammate chip say *why* someone isn't available rather than
// just quietly vanishing from the roster.
// Cache shape deliberately mirrors fetchMLBTeamActiveRoster: module Map +
// sessionStorage, keyed on the MLB "day" so it rolls over with the slate, and
// a failed fetch is never cached so the next call retries.
const MLB_ROSTER_STATUS_TTL_MS = 15 * 60 * 1000;
const mlbRosterStatusCache = new Map();

// statsapi status codes -> the short badge shown on a teammate chip. `tone`
// drives both the chip badge fill and the status dot in the with/without
// dropdowns. Anything not listed (chiefly "A", active) gets no badge at all.
const MLB_STATUS_BADGES = {
  D7: { label: "IL", tone: "out" },
  D10: { label: "IL", tone: "out" },
  D15: { label: "IL", tone: "out" },
  D60: { label: "IL", tone: "out" },
  DL: { label: "IL", tone: "out" },
  BRV: { label: "IL", tone: "out" },
  DTD: { label: "GTD", tone: "warn" },
  RM: { label: "AAA", tone: "muted" },
  MIN: { label: "AAA", tone: "muted" },
  OPT: { label: "AAA", tone: "muted" },
  DES: { label: "DFA", tone: "muted" },
  RES: { label: "Out", tone: "muted" },
  SU: { label: "Out", tone: "muted" },
  RE: { label: "Out", tone: "muted" },
};

async function fetchMLBTeamRosterStatus(teamId) {
  const dayKey = currentMLBDayKey();
  const cached = mlbRosterStatusCache.get(teamId);
  if (cached && cached.dayKey === dayKey && Date.now() - cached.fetchedAt < MLB_ROSTER_STATUS_TTL_MS) return cached.byId;

  const cacheKey = `mlb_roster_status_v1_${teamId}`;
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.dayKey === dayKey && Date.now() - parsed.fetchedAt < MLB_ROSTER_STATUS_TTL_MS) {
        mlbRosterStatusCache.set(teamId, parsed);
        return parsed.byId;
      }
    }
  } catch {}

  let byId = null;
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=40Man`);
    const data = await res.json();
    byId = {};
    (data?.roster || []).forEach((r) => {
      const id = r.person?.id;
      if (!id) return;
      byId[id] = { code: r.status?.code || "A", description: r.status?.description || "" };
    });
  } catch {
    byId = null;
  }
  if (!byId || !Object.keys(byId).length) return null;

  const record = { dayKey, byId, fetchedAt: Date.now() };
  mlbRosterStatusCache.set(teamId, record);
  try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
  return byId;
}

// Real pitcher-vs-batter head-to-head splits for the Matchup Analyzer, from
// the MLB Stats API's (undocumented but public) "vsPlayer" stat group --
// same person/game IDs as everywhere else in this file, so no new ID
// mapping is needed. The endpoint returns one split per season the two have
// ever faced off in (not just the last 3), so this sums whichever 3 most
// recent season entries are actually present rather than assuming a fixed
// date range -- a pair that last met in, say, 2019/2021/2022 still gets a
// real "last 3 seasons they've faced" total instead of a false zero.
const MLB_H2H_TTL_MS = 6 * 60 * 60 * 1000;
const mlbH2HCache = new Map();
async function fetchMLBH2H(batterMlbId, pitcherMlbId) {
  const key = `${batterMlbId}_${pitcherMlbId}`;
  const cached = mlbH2HCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < MLB_H2H_TTL_MS) return cached.data;
  let result = null;
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${batterMlbId}/stats?stats=vsPlayer&opposingPlayerId=${pitcherMlbId}&group=hitting`
    );
    const data = await res.json();
    const splits = data?.stats?.[0]?.splits || [];
    const recent = [...splits].sort((a, b) => Number(b.season) - Number(a.season)).slice(0, 3);
    if (recent.length) {
      const sum = (field) => recent.reduce((acc, s) => acc + (Number(s.stat?.[field]) || 0), 0);
      result = {
        pa: sum("plateAppearances"), h: sum("hits"), tb: sum("totalBases"),
        hr: sum("homeRuns"), k: sum("strikeOuts"), bb: sum("baseOnBalls"),
        seasons: recent.map((s) => s.season),
      };
    }
  } catch {}
  mlbH2HCache.set(key, { data: result, fetchedAt: Date.now() });
  return result;
}

// MLB's schedule day rolls over at 3am Eastern (not midnight) -- a game that
// runs past midnight still belongs to the day it started. Used to key the
// day-slate cache below so it naturally refetches once a new day's games
// take over, without needing a separate cron job.
function currentMLBDayKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const date = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))));
  if (Number(get("hour")) < 3) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

const MLB_SLATE_TTL_MS = 15 * 60 * 1000;
let mlbSlateCache = null;

// MLB schedules a doubleheader as two separate games between the same two
// teams on the same day, so a team legitimately appears twice on one slate.
// Both are kept -- each half has its own probable starter, its own first
// pitch and its own separately-bettable props -- and this is what tells them
// apart: it returns 1 or 2 for a game that shares its pairing with another
// on the slate, and null for every game on an ordinary single-game day.
//
// That null matters beyond cosmetics. Feed row keys only get a game suffix
// when this returns a number, so on a normal day they stay byte-identical to
// what they were before doubleheaders were handled -- and since a row key
// becomes a My Picks id (`${sport}-${r.key}`, persisted to localStorage),
// suffixing unconditionally would have orphaned every already-saved pick.
//
// The pairing is keyed on the sorted abbr pair rather than away/home as
// listed, so the grouping survives a split doubleheader that swaps which
// side is nominally home. Falls back to slate order (already sorted by first
// pitch) if the API ever omits gameNumber.
function mlbGameNumber(slate, game) {
  const pairKey = (g) => [g.awayAbbr, g.homeAbbr].slice().sort().join("@");
  const key = pairKey(game);
  const siblings = slate.filter((g) => pairKey(g) === key);
  if (siblings.length < 2) return null;
  return game.gameNumber || siblings.indexOf(game) + 1;
}

// "Gm 2" for the second half of a doubleheader, "" otherwise -- so callers
// can append it unconditionally without a ternary at every site.
function mlbGameSuffix(slate, game) {
  const n = mlbGameNumber(slate, game);
  return n ? ` · Gm ${n}` : "";
}

// Every real MLB game scheduled "today" (per currentMLBDayKey), one fetch
// for the whole league instead of one per team -- this is what lets the
// Prop Feed's MATCHUP dropdown show only the teams actually playing, sorted
// by first pitch, and why it only ever needs a single refetch a day.

async function fetchMLBDaySlate() {
  const dayKey = currentMLBDayKey();
  if (mlbSlateCache && mlbSlateCache.dayKey === dayKey && Date.now() - mlbSlateCache.fetchedAt < MLB_SLATE_TTL_MS) {
    return mlbSlateCache.games;
  }
  // v2: the cached shape gained home/awayLineupIds below, so a v1 payload
  // left over in sessionStorage would silently skip the confirmed-lineup
  // narrowing for the rest of the day.
  // v3: gained gamePk/gameNumber for doubleheaders (see mlbGameNumber) --
  // a leftover v2 payload would leave both halves of a doubleheader
  // indistinguishable, which is the exact case that used to collide.
  const cacheKey = "mlb_day_slate_v3";
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.dayKey === dayKey && Date.now() - parsed.fetchedAt < MLB_SLATE_TTL_MS) {
        mlbSlateCache = parsed;
        return parsed.games;
      }
    }
  } catch {}

  // `lineups` is hydrated here too (not just in the per-team schedule fetch)
  // so the Prop Feed can narrow each team to its confirmed batting order off
  // the same single league-wide request -- see reconcileMlbLineup.
  const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dayKey}&hydrate=probablePitcher,lineups`);
  const data = await res.json();
  const rawGames = (data?.dates || []).flatMap((d) => d.games || []);
  const games = rawGames
    .map((g) => ({
      date: g.gameDate,
      status: g.status?.detailedState || "Scheduled",
      // Both halves of a doubleheader are kept (see mlbGameNumber) -- gamePk
      // is the only field guaranteed to differ between them, and gameNumber
      // is MLB's own 1/2 rather than one inferred from slate order.
      gamePk: g.gamePk,
      gameNumber: g.gameNumber,
      awayAbbr: MLB_TEAM_ID_ABBR[g.teams?.away?.team?.id] || "???",
      homeAbbr: MLB_TEAM_ID_ABBR[g.teams?.home?.team?.id] || "???",
      awayLineupIds: (g.lineups?.awayPlayers || []).map((p) => p.id),
      homeLineupIds: (g.lineups?.homePlayers || []).map((p) => p.id),
      awayProbablePitcher: g.teams?.away?.probablePitcher
        ? { mlbId: g.teams.away.probablePitcher.id, name: g.teams.away.probablePitcher.fullName }
        : null,
      homeProbablePitcher: g.teams?.home?.probablePitcher
        ? { mlbId: g.teams.home.probablePitcher.id, name: g.teams.home.probablePitcher.fullName }
        : null,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const record = { dayKey, games, fetchedAt: Date.now() };
  mlbSlateCache = record;
  try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
  return games;
}

// Trailing pitching game log for whoever is currently a team's probable
// starter (see fetchMLBTeamNextGame) -- only ever fetched for that one
// pitcher, so the feed shows props for the actual next starter, not the
// whole staff, and rolls to the new starter automatically once MLB
// announces one.
const mlbPitcherGameLogCache = new Map();

function parseInningsPitchedToOuts(ip) {
  if (!ip) return 0;
  const [wholeStr, thirdStr] = String(ip).split(".");
  const whole = parseInt(wholeStr, 10) || 0;
  const third = parseInt(thirdStr, 10) || 0;
  return whole * 3 + third;
}

// Reverses parseInningsPitchedToOuts for display -- standard box-score
// innings-pitched notation (e.g. 18 outs -> "6.0", 19 outs -> "6.1").
function formatOuts(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

async function fetchMLBPitcherGameLog(mlbId) {
  const cached = mlbPitcherGameLogCache.get(mlbId);
  if (cached && Date.now() - cached.fetchedAt < MLB_GAMELOG_TTL_MS) return cached.games;

  const cacheKey = `mlb_pitcher_gamelog_v1_${mlbId}`;
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Date.now() - parsed.fetchedAt < MLB_GAMELOG_TTL_MS) {
        mlbPitcherGameLogCache.set(mlbId, parsed);
        return parsed.games;
      }
    }
  } catch {}

  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/people/${mlbId}/stats?stats=gameLog&group=pitching&season=2026&gameType=R`
  );
  const data = await res.json();
  const splits = data?.stats?.[0]?.splits || [];
  const games = splits.map((s) => {
    const st = s.stat;
    return {
      date: s.date,
      opp: MLB_TEAM_ID_ABBR[s.opponent?.id] || s.opponent?.name || "???",
      home: !!s.isHome,
      k: st.strikeOuts || 0,
      er: st.earnedRuns || 0,
      h: st.hits || 0,
      bb: st.baseOnBalls || 0,
      outs: parseInningsPitchedToOuts(st.inningsPitched),
    };
  });

  const record = { games, fetchedAt: Date.now() };
  mlbPitcherGameLogCache.set(mlbId, record);
  try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
  return games;
}

// Row 1 = core box-score + combo stats (the most commonly booked batter
// props). Row 2 = power (extra-base outcomes). Row 3 = plate-discipline/speed
// counting stats.
const MLB_MARKETS_ROW_1 = [
  { id: "h", label: "Hits" },
  { id: "r", label: "Runs" },
  { id: "rbi", label: "RBIs" },
  { id: "hrrbi", label: "H+R+RBI" },
];
const MLB_MARKETS_ROW_2 = [
  { id: "hr", label: "Home Runs" },
  { id: "tb", label: "Total Bases" },
];
const MLB_MARKETS_ROW_3 = [
  { id: "bb", label: "Walks" },
  { id: "so", label: "Strikeouts" },
  { id: "sb", label: "Stolen Bases" },
];
const MLB_MARKETS = [...MLB_MARKETS_ROW_1, ...MLB_MARKETS_ROW_2, ...MLB_MARKETS_ROW_3];

const statValueMLB = (g, market) => {
  switch (market) {
    case "h": return g.h;
    case "r": return g.r;
    case "rbi": return g.rbi;
    case "hr": return g.hr;
    case "tb": return g.tb;
    case "hrrbi": return g.h + g.r + g.rbi;
    case "bb": return g.bb;
    case "so": return g.so;
    case "sb": return g.sb;
    default: return g.h;
  }
};

// Pitcher markets are prefixed (p_*) so their ids can't collide with the
// batter market ids above (both have "h"/"bb", but they mean hits allowed
// vs. hits recorded).
const MLB_PITCHER_MARKETS = [
  { id: "p_k", label: "Strikeouts" },
  { id: "p_outs", label: "Outs Recorded" },
  { id: "p_er", label: "Earned Runs" },
  { id: "p_h", label: "Hits Allowed" },
  { id: "p_bb", label: "Walks Allowed" },
];

const statValueMLBPitcher = (g, market) => {
  switch (market) {
    case "p_k": return g.k;
    case "p_outs": return g.outs;
    case "p_er": return g.er;
    case "p_h": return g.h;
    case "p_bb": return g.bb;
    default: return g.k;
  }
};

// ---------- Game Conditions (park factor + weather) ----------
// Rough, widely-known park tendencies (100 = league average) for how much
// each home park inflates/suppresses HR, runs, and singles -- these are
// general public knowledge about park dimensions/altitude/etc, not live
// Statcast park factors, so treat the resulting % swings as a directional
// research signal rather than a precise model.
const MLB_PARK_FACTORS = {
  ARI: { hr: 102, runs: 100, single: 100 }, ATL: { hr: 104, runs: 102, single: 99 },
  BAL: { hr: 88, runs: 95, single: 102 }, BOS: { hr: 95, runs: 104, single: 108 },
  CHC: { hr: 100, runs: 100, single: 100 }, CWS: { hr: 108, runs: 103, single: 97 },
  CIN: { hr: 115, runs: 106, single: 96 }, CLE: { hr: 98, runs: 98, single: 101 },
  COL: { hr: 118, runs: 122, single: 112 }, DET: { hr: 88, runs: 94, single: 103 },
  HOU: { hr: 105, runs: 102, single: 98 }, KC: { hr: 85, runs: 93, single: 105 },
  LAA: { hr: 98, runs: 99, single: 100 }, LAD: { hr: 100, runs: 96, single: 97 },
  MIA: { hr: 86, runs: 92, single: 101 }, MIL: { hr: 104, runs: 101, single: 99 },
  MIN: { hr: 98, runs: 98, single: 100 }, NYM: { hr: 92, runs: 96, single: 101 },
  NYY: { hr: 112, runs: 103, single: 96 }, ATH: { hr: 95, runs: 97, single: 100 },
  PHI: { hr: 110, runs: 104, single: 98 }, PIT: { hr: 90, runs: 95, single: 102 },
  SD: { hr: 90, runs: 94, single: 101 }, SEA: { hr: 88, runs: 92, single: 102 },
  SF: { hr: 78, runs: 90, single: 104 }, STL: { hr: 92, runs: 96, single: 101 },
  TB: { hr: 90, runs: 94, single: 100 }, TEX: { hr: 100, runs: 99, single: 99 },
  TOR: { hr: 102, runs: 100, single: 99 }, WSH: { hr: 98, runs: 98, single: 100 },
};

function mlbWeatherEmoji(condition) {
  const c = (condition || "").toLowerCase();
  if (c.includes("rain") || c.includes("shower")) return "🌧️";
  if (c.includes("snow")) return "❄️";
  if (c.includes("dome") || c.includes("roof")) return "🏟️";
  if (c.includes("overcast") || c.includes("cloudy")) return "☁️";
  if (c.includes("partly")) return "⛅";
  if (c.includes("clear") || c.includes("sunny")) return "☀️";
  return "🌤️";
}

// MLB Stats API packs speed+direction into one string e.g. "6 mph, In From
// CF" or "8 mph, L To R" -- pull the mph out for the magnitude and read the
// direction keyword for which way it pushes offense.
function mlbWindEffect(windStr) {
  const w = (windStr || "").toLowerCase();
  const mphMatch = /(\d+)\s*mph/.exec(w);
  const mph = mphMatch ? parseInt(mphMatch[1], 10) : 0;
  if (!mph) return 0;
  if (w.includes("out")) return mph;
  if (w.includes("in")) return -mph;
  if (w.includes(" l to r") || w.includes(" r to l") || w.includes("cross")) return mph * 0.15;
  return 0;
}

// Plain-English read of the same raw wind string, so the bar says something
// a bettor actually cares about ("carries fly balls a bit further") instead
// of just echoing the API's "6 mph, R To L" back at them.
function mlbWindNarrative(windStr) {
  const w = (windStr || "").toLowerCase();
  const mphMatch = /(\d+)\s*mph/.exec(w);
  const mph = mphMatch ? parseInt(mphMatch[1], 10) : 0;
  if (!mph) return "Calm — no real effect on fly balls";
  if (w.includes("out")) return mph >= 12 ? "Blowing out hard — fly balls carry noticeably further" : "Blowing out — a little extra carry on fly balls";
  if (w.includes("in")) return mph >= 12 ? "Blowing in hard — knocks fly balls down significantly" : "Blowing in — holds fly balls up a bit";
  if (w.includes("cross") || w.includes(" l to r") || w.includes(" r to l")) {
    return mph >= 12 ? "Strong crosswind — can push balls off line" : "Light crosswind — minor effect on ball flight";
  }
  return `${mph} mph — minimal impact on ball flight`;
}

// Same idea for temperature -- colder/denser air holds the ball back,
// warmer air lets it carry, which is exactly the intuition a bettor wants
// spelled out rather than just a bare °F reading.
function mlbTempNarrative(temp) {
  const t = parseInt(temp, 10);
  if (Number.isNaN(t)) return null;
  if (t >= 85) return "Hot — thin air helps the ball carry";
  if (t >= 70) return "Warm — small lift for hitters";
  if (t >= 55) return "Mild — roughly neutral";
  return "Cool — dense air holds the ball back";
}

// One-line read of the home park's power tendency, from the same
// MLB_PARK_FACTORS numbers already driving the HR/Runs/1B swings below --
// gives the raw "+12%" a sentence a bettor can actually reason about.
function mlbParkNarrative(homeAbbr) {
  const park = MLB_PARK_FACTORS[homeAbbr];
  if (!park) return null;
  if (park.hr >= 112) return "one of MLB's best home run parks";
  if (park.hr >= 103) return "plays a little short for power";
  if (park.hr <= 85) return "a tough park for home runs";
  if (park.hr <= 95) return "leans pitcher-friendly";
  return "roughly average for power";
}

// Combines the home park's baseline tendency with today's forecast (warmer
// air + wind blowing out both carry the ball further) into directional %
// swings for HR/Runs/1B, plus an overall Hitter/Pitcher Friendly read.
function computeMLBGameConditions({ weather, homeAbbr }) {
  const park = MLB_PARK_FACTORS[homeAbbr] || { hr: 100, runs: 100, single: 100 };
  let hrPct = park.hr - 100;
  let runsPct = park.runs - 100;
  let singlePct = park.single - 100;

  const temp = parseInt(weather?.temp, 10);
  if (!Number.isNaN(temp)) {
    const tempEffect = (temp - 70) * 0.4;
    hrPct += tempEffect;
    runsPct += tempEffect * 0.5;
  }
  const windEffect = mlbWindEffect(weather?.wind);
  hrPct += windEffect;
  runsPct += windEffect * 0.5;
  singlePct += windEffect * 0.1;

  hrPct = Math.round(hrPct);
  runsPct = Math.round(runsPct);
  singlePct = Math.round(singlePct);

  const composite = hrPct * 0.6 + runsPct * 0.4;
  const verdict = composite > 4 ? "Hitter Friendly" : composite < -4 ? "Pitcher Friendly" : "Neutral";
  return { hrPct, runsPct, singlePct, verdict };
}

// Single centered conditions strip, rendered full-width above the page's
// 3-column roster layout (see MLBPropsPage) rather than squeezed into the
// narrow center column between the two roster panels. Colors read from
// whichever side of the ball the current props page is on: a Hitter
// Friendly reading is green on batter props (favors overs) but red on
// pitcher props (bad for the pitcher's unders), and vice versa for Pitcher
// Friendly -- same underlying numbers, flipped framing per the `isPitcher`
// page you're viewing.
// `variant="compact"` renders a narrow, left-aligned card meant for the
// desktop left gutter (see MLBPropsPage's .roster-layout) instead of the
// original full-width centered bar -- the park narrative/temp/wind
// sentences collapse behind a "details" disclosure so the card reads as a
// handful of scannable lines rather than three paragraphs stacked above the
// lineups. The default (no variant) full-width bar is unchanged, still used
// on mobile above the graph card.
function GameConditionsBar({ nextGame, teamAbbr, isPitcher, variant, opponentLabel }) {
  // Mobile-only "move it out of the way" toggle -- collapses the compact bar
  // down to a slim pill. Persisted the same way CollapsibleSection persists
  // its own "Details" toggle (storageKey="mlb_game_conditions_details_open"),
  // under a distinct key so the two don't clobber each other. Must run
  // unconditionally, before the early-return below, since hooks can't be
  // called conditionally (see SportsbookOddsPanel for the same pattern).
  const [minimized, setMinimized] = useState(() => {
    try { return sessionStorage.getItem("mlb_game_conditions_bar_open") === "0"; } catch { return false; }
  });
  const toggleMinimized = () => {
    setMinimized((v) => {
      const next = !v;
      try { sessionStorage.setItem("mlb_game_conditions_bar_open", next ? "0" : "1"); } catch {}
      return next;
    });
  };

  if (!nextGame?.venue) return null;
  const homeAbbr = nextGame.home ? teamAbbr : nextGame.opp;
  const { hrPct, runsPct, singlePct, verdict } = computeMLBGameConditions({ weather: nextGame.weather, homeAbbr });

  const favors = isPitcher ? verdict === "Pitcher Friendly" : verdict === "Hitter Friendly";
  const opposes = isPitcher ? verdict === "Hitter Friendly" : verdict === "Pitcher Friendly";
  const verdictColor = favors ? "var(--green)" : opposes ? "var(--red)" : "var(--dim)";
  const statColor = (pct) => {
    if (pct === 0) return "var(--dim)";
    const good = isPitcher ? pct < 0 : pct > 0;
    return good ? "var(--green)" : "var(--red)";
  };
  const signed = (pct) => `${pct > 0 ? "+" : ""}${pct}%`;
  const parkNarrative = mlbParkNarrative(homeAbbr);
  const tempNarrative = nextGame.weather ? mlbTempNarrative(nextGame.weather.temp) : null;
  const windNarrative = nextGame.weather?.wind ? mlbWindNarrative(nextGame.weather.wind) : null;

  if (variant === "compact") {
    const venueTitle = `${nextGame.venue}${parkNarrative ? ` — ${parkNarrative}` : ""}`;
    return (
      // Full-width single-line strip (PropsMadness reference) instead of a
      // narrow corner box: date/time/opponent/venue on the left, forecast +
      // HR/Runs/1B splits + verdict on the right. Sits in normal document
      // flow at the top of the card (the caller no longer absolutely
      // positions this), so it can never overlap playerIdentityRow below it
      // -- it just pushes that row down, which a fixed-width corner overlay
      // structurally couldn't do. paddingRight clears the Filters button,
      // which still floats in the card's absolute top-right corner.
      <div style={{ padding: "12px 110px 12px 20px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px 16px" }}>
          {/* Column gap is wider than the row gap: the segments needed air
               between them, but a wrapped second line shouldn't open a
               matching vertical hole. */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 16px", minWidth: 0 }}>
            <span className="micro-label">Game Info</span>
            <span style={{ color: "var(--text)", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>
              {new Date(nextGame.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              {" · "}
              <span className="mono tnum" style={{ color: "var(--amber-ink)", fontWeight: 700 }}>
                {new Date(nextGame.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
              </span>
            </span>
            {/* --dim, not --line-strong: the latter is a border token, tuned
                 to draw a 1px rule against a dark surface, which leaves a
                 glyph almost invisible in dark mode (it read fine in light,
                 which is why it survived this long). */}
            <span style={{ color: "var(--dim)" }}>·</span>
            <span style={{ fontSize: 12.5, color: "var(--text)", whiteSpace: "nowrap" }}>
              {nextGame.home ? "vs" : "@"} <strong>{opponentLabel || nextGame.opp}</strong>
            </span>
            <span style={{ color: "var(--dim)" }}>·</span>
            <span
              style={{ fontSize: 12.5, color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}
              title={venueTitle}
            >
              {nextGame.venue}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, flexShrink: 0 }}>
            {nextGame.weather ? (
              <span style={{ fontSize: 11.5, color: "var(--dim)", whiteSpace: "nowrap" }}>
                {mlbWeatherEmoji(nextGame.weather.condition)} {nextGame.weather.temp}°F{windNarrative ? ` · 💨 ${nextGame.weather.wind}` : ""}
              </span>
            ) : (
              <span style={{ fontSize: 10.5, color: "var(--dim)", fontStyle: "italic", whiteSpace: "nowrap" }}>Forecast not posted yet</span>
            )}
            <span className="mono tnum" style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>
              <span style={{ color: statColor(hrPct) }}>HR {signed(hrPct)}</span>
              <span style={{ color: statColor(runsPct) }}>Runs {signed(runsPct)}</span>
              <span style={{ color: statColor(singlePct) }}>1B {signed(singlePct)}</span>
            </span>
            <span className="status-pill" style={{ color: verdictColor, whiteSpace: "nowrap" }}>{verdict}</span>
          </div>
        </div>
        {(parkNarrative || tempNarrative) && (
          <CollapsibleSection title="Details" storageKey="mlb_game_conditions_details_open">
            <div style={{ fontSize: 11, color: "var(--dim)", lineHeight: 1.5 }}>
              {parkNarrative && <div style={{ marginBottom: 4 }}>{MLB_TEAM_ROSTERS[homeAbbr]?.label || homeAbbr} home park — {parkNarrative}</div>}
              {tempNarrative && <div>{tempNarrative}{windNarrative ? ` — ${windNarrative}` : ""}</div>}
            </div>
          </CollapsibleSection>
        )}
      </div>
    );
  }

  // This is the branch actually used for the mobile standalone bar (the
  // `compact`-named variant above is, confusingly, the one embedded in the
  // desktop card) -- so the "move it out of the way" minimize toggle lives
  // here. Tapping the title row collapses everything below it down to just
  // the venue line, using the same `minimized` state as the other branch
  // (same sessionStorage key either way, since only one branch renders per
  // viewport at a time).
  if (minimized) {
    return (
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--s-4)" }}>
        <div
          onClick={toggleMinimized}
          role="button"
          aria-expanded={false}
          title="Show game conditions"
          style={{
            display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            padding: "8px 16px", background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)",
            boxShadow: "var(--panel-shadow)", fontSize: 12, color: "var(--dim)", maxWidth: "100%",
          }}
        >
          <span className="micro-label" style={{ color: "var(--text)", fontSize: 11 }}>Game Conditions</span>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nextGame.venue}</span>
          <span className="mono" style={{ color: "var(--amber)", fontSize: 10, flexShrink: 0 }}>▸</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--s-4)" }}>
      {/* Everything below stacks in a centered column (rather than a single
           wrapping row) so it reads the same whether it's one line on a wide
           screen or four on a phone -- a flex row's wrapped lines default to
           flex-start, which is what previously pinned the wind/weather text
           to the panel's left edge on mobile instead of centering it under
           the venue line above it. */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        padding: "12px 20px", background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)",
        boxShadow: "var(--panel-shadow)",
        fontSize: 12.5, color: "var(--dim)", maxWidth: "100%", textAlign: "center",
      }}>
        <div
          onClick={toggleMinimized}
          role="button"
          aria-expanded={true}
          title="Minimize game conditions"
          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
        >
          <span className="micro-label" style={{ color: "var(--text)", fontSize: 11.5 }}>
            Game Conditions · {nextGame.venue}
          </span>
          <span className="mono" style={{ color: "var(--dim)", fontSize: 10 }}>▾</span>
        </div>
        {parkNarrative && <span>{MLB_TEAM_ROSTERS[homeAbbr]?.label || homeAbbr} home park — {parkNarrative}</span>}
        {nextGame.weather ? (
          <>
            <span>
              {mlbWeatherEmoji(nextGame.weather.condition)} {nextGame.weather.condition ? `${nextGame.weather.condition}, ` : ""}{nextGame.weather.temp}°F
              {tempNarrative ? ` — ${tempNarrative}` : ""}
            </span>
            {windNarrative && <span>💨 {nextGame.weather.wind} — {windNarrative}</span>}
          </>
        ) : (
          // MLB only posts a forecast within roughly a day of first pitch --
          // for anything further out this says so explicitly instead of just
          // quietly dropping the weather/wind lines, which otherwise reads
          // like the feature is broken rather than just not available yet.
          <span style={{ fontStyle: "italic" }}>Forecast not posted yet — check back closer to first pitch</span>
        )}
        <span style={{ width: "60%", maxWidth: 220, height: 1, background: "var(--line-subtle)", margin: "2px 0" }} />
        <span className="tnum" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontWeight: 600, flexWrap: "wrap" }}>
          <span className="mono" style={{ color: statColor(hrPct) }}>HR {signed(hrPct)}</span>
          <span className="mono" style={{ color: statColor(runsPct) }}>Runs {signed(runsPct)}</span>
          <span className="mono" style={{ color: statColor(singlePct) }}>1B {signed(singlePct)}</span>
          <span className="status-pill" style={{ color: verdictColor }}>{verdict}</span>
        </span>
      </div>
    </div>
  );
}

// Maps this app's internal per-stat market ids to The Odds API's market
// keys -- only markets api/odds.js actually fetches are listed here; any
// other market shows a "not tracked" note instead of a dead button.
const MLB_ODDS_MARKET_KEY = { h: "batter_hits", hr: "batter_home_runs" };

// api/odds.js caches each game's lines for up to 12h, and its `stale` flag is
// only set when the upstream call FAILED -- an ordinary cache hit comes back
// stale:false. Labelling that "live" meant an 11-hour-old line could read as
// current, which on a props app is the kind of thing someone acts on. Show the
// actual age instead of a live/cached binary.
function oddsAgeLabel(fetchedAt, stale) {
  if (!fetchedAt) return { text: "age unknown", color: "var(--amber)" };
  const mins = Math.max(0, Math.round((Date.now() - fetchedAt) / 60000));
  const text =
    mins < 2 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
  // --warn past 3h: loaded fine, but old enough that a line may have moved.
  // --red when this is only on screen because the fetch failed -- then it
  // isn't merely old, it's all we have. Deliberately not --amber: that is the
  // user-picked accent, so it carries no warning meaning and is blue by
  // default.
  const color = stale ? "var(--red)" : mins >= 180 ? "var(--warn)" : "var(--dim)";
  return { text: stale ? `cached · ${text}` : text, color };
}

// Sportsbook odds only ever fetch on a button press, never automatically.
// The Odds API's free tier is a small shared monthly credit budget (see
// api/odds.js), so switching markets/players shouldn't silently spend
// credits in the background -- the user has to explicitly ask for a line.
// Strips the bookmaker's margin out of a two-sided price. A book prices Over
// and Under so their implied probabilities sum to more than 100% -- that
// excess is the vig, and it's their fee, not an opinion about the player.
// Normalising the pair back to 100% leaves the book's actual estimate of how
// often this hits, which is the only number worth comparing a hit rate to.
//
// Returns null unless both sides are posted: with one price alone there's no
// way to separate the opinion from the fee, and quoting the raw implied
// probability as though it were the book's estimate would overstate it by
// several points in the app's own favour.
function noVigProbability(overOdds, underOdds) {
  if (overOdds == null || underOdds == null) return null;
  const pOver = 1 / americanToDecimal(overOdds);
  const pUnder = 1 / americanToDecimal(underOdds);
  const total = pOver + pUnder;
  if (!total) return null;
  return pOver / total;
}

function SportsbookOddsPanel({ teamAbbr, playerName, market, isPitcher, values }) {
  const [state, setState] = useState({ status: "idle", data: null });
  const oddsMarketKey = isPitcher ? null : MLB_ODDS_MARKET_KEY[market];

  // A stale odds card from a different player/market should never linger
  // on screen after the user switches -- drop back to idle so the button
  // reappears and a fresh fetch is required.
  React.useEffect(() => {
    setState({ status: "idle", data: null });
  }, [teamAbbr, playerName, market]);

  // Hooks must run unconditionally on every render (the market can change
  // out from under this component right after mount -- see MLBPropsPage's
  // jump-to-player effect, which sets player then market in the same tick),
  // so the "not tracked" bail-out below only affects what JSX renders, never
  // whether this useMemo itself runs.
  const rows = useMemo(() => {
    if (!oddsMarketKey || !state.data?.odds?.bookmakers) return [];
    const out = [];
    for (const bm of state.data.odds.bookmakers) {
      const marketObj = bm.markets?.find((m) => m.key === oddsMarketKey);
      const playerOutcomes = marketObj?.outcomes?.filter(
        (o) => o.description?.toLowerCase() === playerName.toLowerCase()
      );
      if (!playerOutcomes?.length) continue;
      const over = playerOutcomes.find((o) => o.name === "Over");
      const under = playerOutcomes.find((o) => o.name === "Under");
      const point = over?.point ?? under?.point;
      // This is the one place in the app where an "edge" number is honest.
      // The Prop Feed's odds are derived from its own hit rates, so comparing
      // the two there is circular by construction -- here the price comes
      // from a real book and the hit rate from the player's real game log,
      // so the gap between them means something.
      const fair = noVigProbability(over?.price, under?.price);
      const hitRate = point != null && values && values.length
        ? values.filter((v) => v > point).length / values.length
        : null;
      out.push({
        book: bm.title, point, over: over?.price, under: under?.price,
        fair, hitRate,
        edge: fair != null && hitRate != null ? hitRate - fair : null,
      });
    }
    return out;
  }, [state.data, oddsMarketKey, playerName, values]);

  // Re-render once a minute while a card is on screen so the age label keeps
  // counting up -- otherwise a line fetched 40 minutes ago still reads "just
  // now" until some unrelated interaction re-renders. setInterval rather than
  // requestAnimationFrame: rAF never fires in a backgrounded tab, which is
  // precisely when a left-open card would drift furthest from the truth. Must
  // sit above the early return below, like the hooks it follows.
  const [, tickAgeLabel] = useState(0);
  React.useEffect(() => {
    if (state.status !== "loaded") return undefined;
    const id = setInterval(() => tickAgeLabel((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, [state.status]);

  if (!oddsMarketKey) {
    return (
      <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--dim)", marginBottom: 16 }}>
        Sportsbook odds aren't tracked for this market yet.
      </div>
    );
  }

  const fetchOdds = async () => {
    setState({ status: "loading", data: null });
    try {
      const res = await fetch(`/api/odds?team=${encodeURIComponent(teamAbbr)}`);
      const json = await res.json();
      setState({ status: "loaded", data: json });
    } catch (err) {
      setState({ status: "error", data: { error: String(err) } });
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {state.status === "idle" && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={fetchOdds}
            className="oswald"
            style={{
              padding: "8px 20px", borderRadius: 999, border: "1px solid var(--line)",
              background: "var(--panel)", color: "var(--text)", fontSize: 12.5, fontWeight: 700,
              letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            Get Odds
          </button>
        </div>
      )}

      {state.status === "loading" && (
        <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--dim)" }}>Loading sportsbook odds…</div>
      )}

      {state.status === "error" && (
        <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--red)" }}>
          Couldn't load odds right now.
          <span style={{ marginLeft: 8, color: "var(--amber)", cursor: "pointer", textDecoration: "underline" }} onClick={fetchOdds}>Retry</span>
        </div>
      )}

      {/* Budget exhausted is a different situation from a failure, and it
          gets its own message: retrying can't help, nothing is broken, and
          the odds come back on their own next month. Offering a Retry link
          here would invite someone to hammer an endpoint that is deliberately
          refusing to spend. */}
      {state.status === "loaded" && !state.data?.odds && state.data?.budgetExhausted && (
        <div style={{
          textAlign: "center", fontSize: 12.5, color: "var(--dim)", lineHeight: 1.5,
          border: "1px solid var(--line)", borderRadius: 6, padding: "12px 14px",
        }}>
          <div style={{ color: "var(--warn)", fontWeight: 700, marginBottom: 4 }}>
            Monthly odds budget reached
          </div>
          Live sportsbook odds run on a free tier of {state.data.creditCap} lookups
          a month, and this month's are used up. Everything else on this page —
          the hit rates and game logs — is unaffected. Resets on the 1st.
        </div>
      )}

      {state.status === "loaded" && !state.data?.odds && !state.data?.budgetExhausted && (
        <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--dim)" }}>
          {state.data?.note || state.data?.error || "No sportsbook odds found for this game."}
          <span style={{ marginLeft: 8, color: "var(--amber)", cursor: "pointer", textDecoration: "underline" }} onClick={fetchOdds}>Retry</span>
        </div>
      )}

      {state.status === "loaded" && state.data?.odds && rows.length === 0 && (
        <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--dim)" }}>
          No {playerName} lines posted for this market yet.
        </div>
      )}

      {state.status === "loaded" && rows.length > 0 && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{
            padding: "8px 16px", borderBottom: "1px solid var(--line)", fontSize: 11, color: "var(--dim)",
            textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", justifyContent: "space-between",
          }}>
            <span>Sportsbook Odds</span>
            {(() => {
              const age = oddsAgeLabel(state.data.fetchedAt, state.data.stale);
              // Out of budget but with an old copy to show: say why it can't
              // refresh, rather than letting it read as an ordinary stale card.
              const text = state.data.budgetExhausted ? `${age.text} · budget reached` : age.text;
              return <span style={{ color: age.color }}>{text}</span>;
            })()}
          </div>
          {rows.map((r, i) => (
            <div
              key={r.book}
              style={{
                padding: "8px 16px",
                borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--line)", fontSize: 13,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text)" }}>{r.book}</span>
                <span className="mono" style={{ color: "var(--dim)" }}>
                  {r.point != null ? `O/U ${r.point}` : ""}
                  {r.over != null && <span style={{ marginLeft: 10, color: "var(--green)" }}>O {r.over > 0 ? "+" : ""}{r.over}</span>}
                  {r.under != null && <span style={{ marginLeft: 10, color: "var(--red)" }}>U {r.under > 0 ? "+" : ""}{r.under}</span>}
                </span>
              </div>
              {/* The comparison, not just the price: how often he has actually
                   cleared *this book's* line, against what this book's own
                   two-sided price implies once the vig is taken back out.
                   Only rendered when both sides are posted -- see
                   noVigProbability. */}
              {r.edge != null && (
                <div
                  className="mono"
                  title={`Cleared ${r.point} in ${Math.round(r.hitRate * values.length)} of the ${values.length} games shown; this book's two-sided price implies ${(r.fair * 100).toFixed(1)}% once the vig is removed`}
                  style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4, fontSize: 10.5 }}
                >
                  <span style={{ color: "var(--dim)" }}>
                    HIT <b style={{ color: "var(--text)" }}>{Math.round(r.hitRate * 100)}%</b>
                    <span style={{ opacity: 0.7 }}> ({values.length})</span>
                  </span>
                  <span style={{ color: "var(--dim)" }}>
                    FAIR <b style={{ color: "var(--text)" }}>{Math.round(r.fair * 100)}%</b>
                  </span>
                  <span style={{ color: r.edge >= 0 ? "var(--pos)" : "var(--neg)", fontWeight: 800 }}>
                    {r.edge >= 0 ? "+" : "−"}{Math.abs(Math.round(r.edge * 100))}%
                  </span>
                </div>
              )}
            </div>
          ))}
          {/* Said plainly rather than left implied. A hit rate over a couple
               dozen games is a small, noisy sample, and the book is pricing
               things this page has no data for at all -- today's pitcher,
               park, weather, whether he's even in the lineup. A gap here is a
               reason to go look, not a proven edge, and labelling it that way
               is the difference between a research tool and a tout. */}
          {rows.some((r) => r.edge != null) && (
            <div style={{
              padding: "7px 16px", borderTop: "1px solid var(--line)",
              fontSize: 10.5, color: "var(--dim)", lineHeight: 1.5,
            }}>
              FAIR is this book’s own price with the vig removed. A gap against HIT is a
              starting point for research, not an edge — {values.length} games is a small
              sample, and the book is also pricing today’s matchup, park and lineup.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Matchup Analyzer mock advanced metrics ----------
// The MLB Stats API (used everywhere else on this page) has no public
// Statcast-style percentile/pitch-mix endpoint, so these sections are
// deterministic mock data seeded off mlbId/team + a split/sample key --
// same player+split always renders the same numbers (no reshuffling on
// re-render), same pattern as TEAM_DEF's seeded mock defensive ratings
// near the top of this file.

const PITCHER_PCT_STATS = [
  { key: "ba", label: "BA", range: [0.18, 0.32], fmt: (v) => v.toFixed(3).replace(/^0/, "") },
  { key: "bbPct", label: "BB%", range: [4, 13], fmt: (v) => `${v.toFixed(1)}%` },
  { key: "chasePct", label: "Chase%", range: [22, 38], fmt: (v) => `${v.toFixed(1)}%` },
  { key: "whiffPct", label: "Whiff%", range: [17, 34], fmt: (v) => `${v.toFixed(1)}%` },
  { key: "kPct", label: "K%", range: [14, 32], fmt: (v) => `${v.toFixed(1)}%` },
  { key: "contactPct", label: "Contact%", range: [64, 84], fmt: (v) => `${v.toFixed(1)}%` },
  { key: "zonePct", label: "Zone%", range: [40, 52], fmt: (v) => `${v.toFixed(1)}%` },
  { key: "swstrPct", label: "SwStr%", range: [7, 17], fmt: (v) => `${v.toFixed(1)}%` },
  { key: "xba", label: "xBA", range: [0.2, 0.29], fmt: (v) => v.toFixed(3).replace(/^0/, "") },
  { key: "xwoba", label: "xwOBA", range: [0.27, 0.36], fmt: (v) => v.toFixed(3).replace(/^0/, "") },
];

function pitcherPercentileRow(pitcher, sideKey, statDef) {
  const rng = seededRng(pitcher.mlbId, sideKey, statDef.key);
  const pct = Math.max(1, Math.min(99, Math.round(rng() * 98) + 1));
  const [lo, hi] = statDef.range;
  const value = lo + (hi - lo) * rng();
  return { value, pct };
}

function pitcherSampleCount(pitcher, sideKey) {
  const rng = seededRng(pitcher.mlbId, sideKey, "sample_count");
  return Math.round(400 + rng() * 3000);
}

const PITCH_TYPES = [
  { key: "FF", name: "Fastball", velo: [91, 97] },
  { key: "SI", name: "Sinker", velo: [90, 96] },
  { key: "FC", name: "Cutter", velo: [85, 91] },
  { key: "SL", name: "Slider", velo: [80, 87] },
  { key: "CU", name: "Curveball", velo: [74, 81] },
  { key: "CH", name: "Changeup", velo: [82, 88] },
  { key: "FS", name: "Splitter", velo: [83, 89] },
  { key: "EP", name: "Eephus", velo: [55, 65] },
];

// A deterministic 4-6 pitch subset per pitcher, with usage% summing to
// ~100 and Overall + vs-RHP whiff/BA/SLG/wOBA (+ percentile) per pitch.
function pitcherPitchMix(pitcher) {
  const rng = seededRng(pitcher.mlbId, "pitch_mix");
  const shuffled = PITCH_TYPES.map((pt) => ({ pt, r: rng() })).sort((a, b) => a.r - b.r).map((x) => x.pt);
  const n = 4 + Math.floor(rng() * 3);
  const chosen = shuffled.slice(0, n);
  const weights = chosen.map(() => 0.15 + rng() * 0.85);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const totalPC = Math.round(900 + rng() * 2500);

  const mkSide = (pt, sideKey) => {
    const r2 = seededRng(pitcher.mlbId, "pitch", pt.key, sideKey);
    const whiff = 8 + r2() * 35;
    const whiffPct = Math.max(1, Math.min(99, Math.round(r2() * 98) + 1));
    const ba = 0.15 + r2() * 0.22;
    const baPct = Math.max(1, Math.min(99, Math.round(r2() * 98) + 1));
    const slg = ba + r2() * 0.35;
    const slgPct = Math.max(1, Math.min(99, Math.round(r2() * 98) + 1));
    const woba = 0.22 + r2() * 0.22;
    const wobaPct = Math.max(1, Math.min(99, Math.round(r2() * 98) + 1));
    return { whiff, whiffPct, ba, baPct, slg, slgPct, woba, wobaPct };
  };

  return chosen
    .map((pt, i) => {
      const usage = weights[i] / totalW;
      const pc = Math.round(totalPC * usage);
      const pf = Math.round(pc * (2.2 + rng() * 1.6));
      const velo = pt.velo[0] + rng() * (pt.velo[1] - pt.velo[0]);
      return {
        key: pt.key,
        name: pt.name,
        velo,
        pc,
        pf,
        usage,
        overall: mkSide(pt, "overall"),
        vsRHP: mkSide(pt, "vsRHP"),
      };
    })
    .sort((a, b) => b.usage - a.usage);
}

// Per-batter plate-discipline mock stats for the Expected Opposing Lineup
// grid, keyed by batter mlbId + a hand-split/sample key so switching the
// split filter changes the numbers but re-selecting the same split/batter
// doesn't reshuffle them.
function expectedLineupRow(batter, splitKey) {
  const rng = seededRng(batter.mlbId, splitKey);
  return {
    pa: Math.round(120 + rng() * 280),
    kPct: 12 + rng() * 22,
    chasePct: 18 + rng() * 24,
    bbPct: 4 + rng() * 12,
    whiffPct: 10 + rng() * 26,
    contPct: 62 + rng() * 26,
    zonePct: 40 + rng() * 16,
    cswPct: 20 + rng() * 18,
    swstrPct: 6 + rng() * 16,
  };
}

// Simple average of the same per-batter rows -- used when the "Show
// pitcher vs team splits" toggle collapses the lineup grid to one row.
function teamAggregateSplit(battingRoster, splitKey) {
  const batters = (battingRoster?.players || []).filter((p) => p.pos !== "SP");
  if (!batters.length) return null;
  const rows = batters.map((b) => expectedLineupRow(b, splitKey));
  const avg = (key) => rows.reduce((a, r) => a + r[key], 0) / rows.length;
  return {
    pa: Math.round(avg("pa")),
    kPct: avg("kPct"),
    chasePct: avg("chasePct"),
    bbPct: avg("bbPct"),
    whiffPct: avg("whiffPct"),
    contPct: avg("contPct"),
    zonePct: avg("zonePct"),
    cswPct: avg("cswPct"),
    swstrPct: avg("swstrPct"),
  };
}

const RELIEVER_FIRST = ["K.", "C.", "J.", "T.", "O.", "S.", "M.", "D.", "R.", "A.", "B.", "L.", "N.", "G.", "W."];
const RELIEVER_LAST = [
  "Backhus", "Shugart", "Bowlan", "Duran", "Mayza", "Kerkering", "Alvarado", "Johnson", "Reyes", "Foster",
  "Kimbrel", "Hicks", "Diekman", "Santos", "Walker", "Cruz", "Rivera", "Holmes", "Bednar", "Pagan",
];

// Mock bullpen roster for a team -- MLB_TEAM_ROSTERS only models the
// starting 9 + SP, so relievers are generated deterministically per team
// abbreviation rather than tied to real mlbIds.
function teamBullpen(teamAbbr) {
  const rng = seededRng(teamAbbr, "bullpen");
  const n = 7 + Math.floor(rng() * 2);
  const usedLast = new Set();
  const relievers = [];
  for (let i = 0; i < n; i++) {
    let last;
    do { last = RELIEVER_LAST[Math.floor(rng() * RELIEVER_LAST.length)]; } while (usedLast.has(last) && usedLast.size < RELIEVER_LAST.length);
    usedLast.add(last);
    const first = RELIEVER_FIRST[Math.floor(rng() * RELIEVER_FIRST.length)];
    const throws = rng() < 0.32 ? "LHP" : "RHP";
    relievers.push({
      id: `${teamAbbr}_bp_${i}`,
      name: `${first}${last}`,
      throws,
      pcL3: Math.round(rng() * 75),
      restDays: Math.floor(rng() * 5),
      kPct: 16 + rng() * 24,
      bbPct: 4 + rng() * 15,
      era: 1.4 + rng() * 5.2,
      whip: 0.85 + rng() * 1.05,
    });
  }
  return relievers.sort((a, b) => b.pcL3 - a.pcL3);
}

// Green/amber/red badge convention shared with the rest of the page (e.g.
// the def-rank tiers above) -- >=70th percentile is good, <=30th is bad.
function pctBadgeColor(pct) {
  return pct >= 70 ? "var(--green)" : pct <= 30 ? "var(--red)" : "var(--neutral-badge-bg)";
}

// Prop detail tabs shown above the chart/table for an individual MLB
// player -- Graph is the existing chart+ledger, the other three all draw on
// MLBMatchupAnalyzer's shared pitcher/batter selection (Matchup, Lineup) or
// the bullpen lists already built in MLBPropsPage (Bullpen).
const MLB_DETAIL_TABS = [
  { id: "matchup", label: "Matchup" },
  { id: "lineup", label: "Lineup" },
  { id: "bullpen", label: "Bullpen" },
];

// The overlay those tabs open into. These panels used to render inline at the
// bottom of the center column -- a full screen below the tab row that controls
// them, under the whole graph card and the game logs -- so clicking a tab
// looked like it did nothing until you scrolled way down to find the result.
// As a fixed overlay the panel lands in view immediately and the page
// underneath keeps its scroll position, so closing it puts you back exactly
// where you were instead of stranded at the bottom of the page.
//
// Dismissal (Escape / backdrop / body scroll lock / back-gesture history entry)
// deliberately mirrors FilterPanelLauncher above -- see the long comments there
// for why the history effect is shaped the way it is. It's a separate copy
// rather than a shared hook because FilterPanelLauncher is wired into all four
// sport pages and applies these behaviours per-breakpoint (scroll lock only on
// mobile, outside-click/Escape only on desktop) where this applies all of them
// unconditionally; factoring the two together is worth doing on its own, not as
// a side effect of an MLB layout fix.
function MLBDetailModal({ open, onClose, title, isNarrow, children }) {
  const panelRef = React.useRef(null);
  const restoreFocusRef = React.useRef(null);
  // Tracks whether we're the one who pushed the dummy history entry below, so
  // requestClose() and the history effect's cleanup never both try to consume it.
  const pushedHistoryRef = React.useRef(false);

  // Every explicit close path (tab re-tap, backdrop tap, × button, Escape)
  // routes through here rather than calling onClose() directly, so it also
  // consumes the history entry the effect below pushed.
  const requestClose = () => {
    if (pushedHistoryRef.current) window.history.back();
    else onClose();
  };

  // Escape + body scroll lock. The overlay covers the viewport at every width,
  // so unlike FilterPanelLauncher both of these apply at every breakpoint.
  React.useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Move focus into the dialog on open and hand it back to whatever opened it
  // (the tab pill) on close, so keyboard users aren't dropped back at the top
  // of the document every time they look at a panel.
  React.useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement;
    panelRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [open]);

  // Claims one same-document history entry for as long as the panel is open, so
  // a native back gesture (hardware back button, edge-swipe) closes just the
  // panel instead of falling through to the browser/webview -- which, since
  // this app never otherwise touches history, would navigate away from the
  // whole SPA and reload it back to its default ("Prop Feed") state.
  React.useEffect(() => {
    if (!open) return;
    // Idempotent on purpose: React (StrictMode in dev) can run this setup, its
    // cleanup, and this setup again for a single logical open, and pushing
    // twice would leave an orphaned entry neither requestClose nor a real back
    // gesture would ever consume.
    if (!(window.history.state && window.history.state.mlbDetailPanel)) {
      window.history.pushState({ mlbDetailPanel: true }, "");
    }
    pushedHistoryRef.current = true;
    const handlePopState = () => {
      pushedHistoryRef.current = false;
      onClose();
    };
    window.addEventListener("popstate", handlePopState);
    // Deliberately does NOT call history.back() here: cleanup must stay a pure
    // "undo the listener" step. Calling back() (an async, real navigation) from
    // a cleanup breaks under StrictMode's double-invoke -- the practice
    // teardown would fire a real popstate that closes the panel right after it
    // opens. Consuming the dummy entry only happens through requestClose (an
    // explicit close) or an actual user back gesture.
    return () => {
      window.removeEventListener("popstate", handlePopState);
      pushedHistoryRef.current = false;
    };
  }, [open, onClose]);

  if (!open) return null;

  // Centered dialog on anything with room for it; bottom sheet on phones, same
  // shape as FilterPanelLauncher's mobile sheet.
  const placement = isNarrow
    ? {
        left: 0, right: 0, bottom: 0,
        maxHeight: "92vh", borderRadius: "16px 16px 0 0",
        // Flush against the bottom edge, so no hairline along it.
        borderBottom: "none",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      }
    : {
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(1040px, 94vw)", maxHeight: "88vh", borderRadius: 16,
        borderBottom: "1px solid var(--line)",
      };

  return (
    <>
      {/* 3400/3401 rather than the My Picks drawer's 2090/2100: the mobile
           player strip is z-index 2500 (.mobile-player-strip), so at the
           drawer's level it painted over the bottom of the sheet *and* stayed
           tappable through the backdrop -- you could switch players behind an
           open panel. Same reason FilterPanelLauncher's mobile sheet sits at
           3500/3501; this stays just under that. */}
      <div
        onClick={requestClose}
        style={{
          position: "fixed", inset: 0, zIndex: 3400,
          background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          position: "fixed", zIndex: 3401,
          display: "flex", flexDirection: "column", textAlign: "left", outline: "none",
          background: "var(--surface-1)",
          // Sides spelled out rather than the `border` shorthand: the bottom
          // sheet drops its bottom edge, and React warns (and can mis-apply
          // the style) when a shorthand and a longhand for the same property
          // fight over one element across re-renders. Both branches of
          // `placement` therefore always set borderBottom explicitly.
          borderTop: "1px solid var(--line)",
          borderLeft: "1px solid var(--line)",
          borderRight: "1px solid var(--line)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          ...placement,
        }}
      >
        {isNarrow && (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--line-strong)" }} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px", borderBottom: "1px solid var(--line)" }}>
          <span className="oswald" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>{title}</span>
          <div onClick={requestClose} role="button" aria-label={`Close ${title} panel`} style={{ cursor: "pointer", color: "var(--dim)", fontSize: 20, lineHeight: 1 }}>×</div>
        </div>
        {/* minHeight:0 so this flex child is allowed to shrink below its content
             height -- without it the panel grows past maxHeight instead of
             scrolling, and the analyzer is tall enough to hit that every time. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 18px" }}>
          {children}
        </div>
      </div>
    </>
  );
}

// Simple pitcher-vs-batter H2H card -- pitcher defaults to the selected
// team's day starter, batter defaults to the first bat in whichever roster
// is on the other side of that pitcher (so switching pitchers between the
// two live rosters swaps the batter list to the actual opposing lineup).
// Reuses the same headshot/team-color helpers as the rest of the MLB page;
// the only real data fetch is fetchMLBH2H (real MLB Stats API vsPlayer
// splits) -- the percentile/pitch-mix/lineup sections below use the seeded
// mock generators above (see comment at the top of this section). `section`
// picks which half renders -- "matchup" for the H2H/percentile/pitch-mix
// content, "lineup" for the expected-lineup grid -- so both tabs share one
// pitcher/batter selection instead of keeping two copies of it in sync.
function MLBMatchupAnalyzer({ teamRoster, oppRoster, nextGame, pick, section }) {
  const pitcherOptions = useMemo(() => [
    ...teamRoster.players.filter((p) => p.pos === "SP").map((p) => ({ ...p, oppSide: "team" })),
    ...(oppRoster ? oppRoster.players.filter((p) => p.pos === "SP").map((p) => ({ ...p, oppSide: "opp" })) : []),
  ], [teamRoster, oppRoster]);

  const [pitcherId, setPitcherId] = useState(pitcherOptions[0]?.id);
  React.useEffect(() => {
    if (pitcherOptions.length && !pitcherOptions.some((p) => p.id === pitcherId)) {
      setPitcherId(pitcherOptions[0].id);
    }
  }, [pitcherOptions]);
  const pitcher = pitcherOptions.find((p) => p.id === pitcherId) || pitcherOptions[0];

  // Batter list is whichever roster the selected pitcher is NOT on.
  const battingRoster = !pitcher ? null : pitcher.oppSide === "opp" ? teamRoster : oppRoster;
  const batterOptions = battingRoster ? battingRoster.players.filter((p) => p.pos !== "SP") : [];

  // Availability for the batting side. The Expected Opposing Lineup asserts
  // who is hitting tonight, so an IL'd or day-to-day batter appearing in it
  // unmarked is the most consequential silent omission on the page -- this is
  // the same 40-man status feed the player page reads, keyed by mlbId.
  const battingAbbr = (batterOptions[0] || {}).team;
  const [lineupStatus, setLineupStatus] = useState(null);
  React.useEffect(() => {
    let cancelled = false;
    setLineupStatus(null);
    const teamId = MLB_ABBR_TEAM_ID[battingAbbr];
    if (!teamId) return undefined;
    fetchMLBTeamRosterStatus(teamId)
      .then((byId) => { if (!cancelled) setLineupStatus(byId); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [battingAbbr]);

  // Same three states as the avatar dot, resolved the same way -- undefined
  // when the feed has not loaded or the player is not on the 40-man, so an
  // unknown player is never styled.
  const batterStatusOf = React.useCallback((b) => {
    if (!lineupStatus || !b || !b.mlbId) return undefined;
    const s = lineupStatus[b.mlbId];
    if (!s) return undefined;
    const badge = MLB_STATUS_BADGES[s.code];
    if (!badge) return "active";
    return badge.tone === "warn" ? "questionable" : "out";
  }, [lineupStatus]);

  const [batterId, setBatterId] = useState(batterOptions[0]?.id);
  React.useEffect(() => {
    if (batterOptions.length && !batterOptions.some((p) => p.id === batterId)) {
      setBatterId(batterOptions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitcher?.id, battingRoster]);
  const batter = batterOptions.find((p) => p.id === batterId) || batterOptions[0];

  // External selection from clicking a player in either roster panel (see
  // MLBPropsPage's matchupPick/onSelect) -- SP picks just switch the
  // pitcher; batter picks switch the batter *and* the pitcher to that
  // batter's actual opposing starter, so the two stay a real matchup. Both
  // setState calls land in the same commit, so pitcherOptions/batterOptions
  // recompute consistently before the safety effects above re-run.
  React.useEffect(() => {
    if (!pick) return;
    const roster = pick.side === "team" ? teamRoster : oppRoster;
    const player = roster?.players.find((p) => p.id === pick.id);
    if (!player) return;
    if (player.pos === "SP") {
      if (pitcherOptions.some((p) => p.id === player.id)) setPitcherId(player.id);
    } else {
      const otherRoster = pick.side === "team" ? oppRoster : teamRoster;
      const oppSP = otherRoster?.players.find((p) => p.pos === "SP");
      if (oppSP && pitcherOptions.some((p) => p.id === oppSP.id)) setPitcherId(oppSP.id);
      setBatterId(player.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick?.nonce]);

  // Hand-split / sample-size toggle state for the two Percentile Rankings
  // columns and the Expected Opposing Lineup grid -- purely UI filters that
  // key into the seeded mock generators above, so changing them changes
  // the numbers shown without needing new state elsewhere.
  const [leftSplit, setLeftSplit] = useState("Overall");
  const [leftSample, setLeftSample] = useState("All");
  const [rightSplit, setRightSplit] = useState("vs RHP");
  const [rightSample, setRightSample] = useState("All");
  const [lineupSample, setLineupSample] = useState("All");
  const [showTeamSplits, setShowTeamSplits] = useState(false);

  // `pitcher` is undefined whenever neither roster has a starter yet -- the
  // bail-out below renders a friendly message for exactly that case, but this
  // memo runs first, so reading .mlbId eagerly threw before the guard could
  // ever fire and took the whole tab down instead.
  const pitchMix = useMemo(() => (pitcher ? pitcherPitchMix(pitcher) : []), [pitcher?.mlbId]);
  const lineupSplitKey = `${rightSplit}_${lineupSample}`;
  const lineupRows = useMemo(
    () => batterOptions.map((b) => ({ batter: b, ...expectedLineupRow(b, lineupSplitKey) })),
    [batterOptions, lineupSplitKey]
  );
  const teamSplitRow = useMemo(
    () => teamAggregateSplit(battingRoster, lineupSplitKey),
    [battingRoster, lineupSplitKey]
  );
  const [h2h, setH2h] = useState(undefined);
  React.useEffect(() => {
    if (!pitcher || !batter) { setH2h(null); return; }
    let cancelled = false;
    setH2h(undefined);
    fetchMLBH2H(batter.mlbId, pitcher.mlbId).then((res) => { if (!cancelled) setH2h(res); });
    return () => { cancelled = true; };
  }, [pitcher?.mlbId, batter?.mlbId]);

  if (!pitcher || !batter) {
    return (
      <div className="roster-panel" style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", color: "var(--dim)", fontSize: 13, padding: "24px 16px" }}>
        Matchup Analyzer needs a starting pitcher and an opposing lineup — the opponent's roster hasn't loaded yet, or this
        team doesn't have a starter modeled. Try again once the next-game info above has populated.
      </div>
    );
  }

  const statCols = h2h ? [
    ["PA", h2h.pa], ["H", h2h.h], ["TB", h2h.tb], ["HR", h2h.hr], ["K", h2h.k], ["BB", h2h.bb],
  ] : [];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
    <div className="roster-panel" style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {section === "lineup" ? "Lineup vs" : "Matchup Analyzer"}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--dim)", marginBottom: 14 }}>
        {section === "lineup"
          ? "Pick a different starter to see the opposing lineup against them"
          : (h2h && h2h.seasons ? `H2H · Last ${h2h.seasons.length} season${h2h.seasons.length === 1 ? "" : "s"} faced (${h2h.seasons.slice().reverse().join(", ")})` : "H2H · Last 3 seasons faced")}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", marginBottom: section === "lineup" ? 0 : 18 }}>
        <select className="select" value={pitcher.id} onChange={(e) => setPitcherId(e.target.value)} style={{ minWidth: 170 }}>
          {pitcherOptions.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.team}</option>)}
        </select>
        {section !== "lineup" && (
          <select className="select" value={batter.id} onChange={(e) => setBatterId(e.target.value)} style={{ minWidth: 170 }}>
            {batterOptions.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.team} · {p.pos}</option>)}
          </select>
        )}
      </div>

      {section !== "lineup" && (
      <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 18 }}>
        {[pitcher, batter].map((p, i) => (
          <React.Fragment key={p.id}>
            {i === 1 && <div className="oswald" style={{ fontSize: 13, color: "var(--dim)" }}>vs</div>}
            <div style={{ textAlign: "center", width: 96 }}>
              <PlayerAvatar
                name={p.name}
                alt={p.name}
                sport="mlb"
                team={p.team}
                colorMap={MLB_TEAM_COLORS}
                headshotSrc={mlbHeadshot(p.mlbId)}
                fallbackSrc={mlbEspnHeadshot(p.id)}
                size={56}
                inset={2}
                backing={(MLB_TEAM_COLORS[p.team] || {}).primary || "#000"}
                shadow={`0 0 0 1px ${(MLB_TEAM_COLORS[p.team] || {}).primary || "#000"}`}
                style={{ display: "block", margin: "0 auto 6px" }}
              />
              <div className="oswald" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--dim)" }}>{p.team} · {p.pos}</div>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, textAlign: "center" }}>
        {h2h === undefined && <div style={{ color: "var(--dim)", fontSize: 12.5 }}>Loading head-to-head history…</div>}
        {h2h === null && (
          <div style={{ color: "var(--dim)", fontSize: 12.5 }}>
            No recorded head-to-head at-bats between these two (MLB Stats API has no "vsPlayer" splits for this pairing).
          </div>
        )}
        {h2h && (
          <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
            {statCols.map(([label, val]) => (
              <div key={label} style={{ minWidth: 34 }}>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--amber)" }}>{val}</div>
                <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </div>

    {section === "matchup" && (
      <>
        <PercentileRankingsPanel
          pitcher={pitcher}
          leftSplit={leftSplit} setLeftSplit={setLeftSplit}
          leftSample={leftSample} setLeftSample={setLeftSample}
          rightSplit={rightSplit} setRightSplit={setRightSplit}
          rightSample={rightSample} setRightSample={setRightSample}
        />

        <PitchTypePanel pitcher={pitcher} pitchMix={pitchMix} />
      </>
    )}

    {section === "lineup" && (
      <ExpectedLineupPanel
        battingRoster={battingRoster}
        lineupRows={lineupRows}
        statusOf={batterStatusOf}
        teamSplitRow={teamSplitRow}
        splitLabel={rightSplit}
        sample={lineupSample} setSample={setLineupSample}
        showTeamSplits={showTeamSplits} setShowTeamSplits={setShowTeamSplits}
        selectedBatterId={batter.id}
        onSelectBatter={setBatterId}
      />
    )}

    </div>
  );
}

// ---------- Opposing Bullpen ----------
// Workload + K%/BB% for the bullpen on the other side of the ball from
// whichever player's props are being viewed -- teamBullpen()'s seeded mock
// data (see comment where it's defined above) sorted by recent workload,
// same "most relevant reliever first" ordering the batting-order/roster
// panels use for their own bullpen lists.
function BullpenAnalyzerPanel({ teamLabel, bullpen }) {
  if (!bullpen || !bullpen.length) {
    return (
      <div className="roster-panel" style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", color: "var(--dim)", fontSize: 13, padding: "24px 16px" }}>
        Opposing bullpen isn't available yet — the opponent's roster hasn't loaded, or this team doesn't have relievers modeled.
      </div>
    );
  }
  const kColor = (v) => (v >= 25 ? "var(--green)" : v <= 17 ? "var(--red)" : "var(--text)");
  const bbColor = (v) => (v <= 7 ? "var(--green)" : v >= 11 ? "var(--red)" : "var(--text)");
  const restColor = (v) => (v >= 2 ? "var(--green)" : v === 0 ? "var(--red)" : "var(--text)");

  return (
    <div className="roster-panel" style={{ maxWidth: 720, margin: "0 auto", overflowX: "auto" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        Opposing Bullpen
      </div>
      <div style={{ fontSize: 10.5, color: "var(--dim)", marginBottom: 14 }}>
        {teamLabel || "Bullpen"} · sorted by recent workload
      </div>
      <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 560 }}>
        <thead>
          <tr style={{ color: "var(--dim)", fontSize: 10 }}>
            <th style={{ textAlign: "left", padding: "4px 6px" }}>RELIEVER</th>
            <th style={{ textAlign: "center", padding: "4px 6px" }}>THROWS</th>
            <th style={{ textAlign: "center", padding: "4px 6px" }}>REST</th>
            <th style={{ textAlign: "center", padding: "4px 6px" }}>PC L3</th>
            <th style={{ textAlign: "center", padding: "4px 6px" }}>K%</th>
            <th style={{ textAlign: "center", padding: "4px 6px" }}>BB%</th>
            <th style={{ textAlign: "center", padding: "4px 6px" }}>ERA</th>
            <th style={{ textAlign: "center", padding: "4px 6px" }}>WHIP</th>
          </tr>
        </thead>
        <tbody>
          {bullpen.map((p) => (
            <tr key={p.id} style={{ borderTop: "1px solid var(--line)" }}>
              <td className="oswald" style={{ padding: "7px 6px", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>{p.name}</td>
              <td style={{ textAlign: "center", padding: "7px 6px", color: "var(--dim)" }}>{p.throws}</td>
              <td style={{ textAlign: "center", padding: "7px 6px", fontWeight: 700, color: restColor(p.restDays) }}>{p.restDays}d</td>
              <td style={{ textAlign: "center", padding: "7px 6px", color: "var(--dim)" }}>{p.pcL3}</td>
              <td style={{ textAlign: "center", padding: "7px 6px", fontWeight: 700, color: kColor(p.kPct) }}>{p.kPct.toFixed(1)}%</td>
              <td style={{ textAlign: "center", padding: "7px 6px", fontWeight: 700, color: bbColor(p.bbPct) }}>{p.bbPct.toFixed(1)}%</td>
              <td style={{ textAlign: "center", padding: "7px 6px", color: "var(--text)" }}>{p.era.toFixed(2)}</td>
              <td style={{ textAlign: "center", padding: "7px 6px", color: "var(--text)" }}>{p.whip.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Percentile Rankings ----------
// Two columns of the same 10 stats under different hand-split/sample
// filters (mirrors the reference screenshot's "Overall" vs "vs RHP"
// layout) -- both are about the selected pitcher only.
function PercentileRankingsPanel({ pitcher, leftSplit, setLeftSplit, leftSample, setLeftSample, rightSplit, setRightSplit, rightSample, setRightSample }) {
  const leftPC = useMemo(() => pitcherSampleCount(pitcher, `${leftSplit}_${leftSample}`), [pitcher.mlbId, leftSplit, leftSample]);
  const rightPF = useMemo(() => pitcherSampleCount(pitcher, `${rightSplit}_${rightSample}`) * 5, [pitcher.mlbId, rightSplit, rightSample]);

  const HandSelect = ({ value, onChange }) => (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} style={{ fontSize: 11, padding: "3px 8px" }}>
      {["Overall", "vs LHP", "vs RHP"].map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  const SamplePills = ({ options, value, onChange }) => (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map((o) => (
        <div key={o} role="button" onClick={() => onChange(o)} className="mono" style={{
          cursor: "pointer", padding: "2px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 700,
          border: `1px solid ${value === o ? "var(--amber)" : "var(--line)"}`,
          background: value === o ? "var(--amber-dim)" : "var(--panel2)",
          color: value === o ? "var(--amber)" : "var(--dim)",
        }}>
          {o}
        </div>
      ))}
    </div>
  );

  return (
    <div className="roster-panel">
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
        Percentile rankings
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--dim)" }}>Hand split</span>
          <HandSelect value={leftSplit} onChange={setLeftSplit} />
          <SamplePills options={["L3", "L6", "L10", "All"]} value={leftSample} onChange={setLeftSample} />
          <span className="mono" style={{ fontSize: 10.5, color: "var(--dim)" }}>{leftPC} PC</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--dim)" }}>{rightPF} PF</span>
          <SamplePills options={["L10", "L20", "L30", "All"]} value={rightSample} onChange={setRightSample} />
          <HandSelect value={rightSplit} onChange={setRightSplit} />
          <span style={{ fontSize: 11, color: "var(--dim)" }}>Hand split</span>
        </div>
      </div>

      {PITCHER_PCT_STATS.map((statDef) => {
        const left = pitcherPercentileRow(pitcher, `${leftSplit}_${leftSample}`, statDef);
        const right = pitcherPercentileRow(pitcher, `${rightSplit}_${rightSample}`, statDef);
        const highlight = statDef.key === "xba" || statDef.key === "xwoba";
        const bubbleColor = highlight ? "var(--amber)" : "var(--neutral-badge-bg)";
        return (
          <div key={statDef.key} style={{ display: "grid", gridTemplateColumns: "1fr 110px 1fr", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <PercentileTrack pct={left.pct} color={bubbleColor} valueLabel={statDef.fmt(left.value)} align="left" />
            <div style={{ textAlign: "center", fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{statDef.label}</div>
            <PercentileTrack pct={right.pct} color={bubbleColor} valueLabel={statDef.fmt(right.value)} align="right" />
          </div>
        );
      })}
    </div>
  );
}

// One horizontal track + percentile bubble, mirrored for the left/right
// columns (value label sits on the outer edge, bubble position = pct%).
function PercentileTrack({ pct, color, valueLabel, align }) {
  const bubbleLeft = align === "left" ? `${pct}%` : `${100 - pct}%`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: align === "left" ? "row" : "row-reverse" }}>
      <span className="mono" style={{ fontSize: 12, color: "var(--text)", width: 52, textAlign: align === "left" ? "left" : "right" }}>{valueLabel}</span>
      <div style={{ position: "relative", flex: 1, height: 4, background: "var(--line)", borderRadius: 2 }}>
        <div
          className="mono"
          style={{
            position: "absolute", top: "50%", [align === "left" ? "left" : "right"]: bubbleLeft,
            transform: "translate(50%, -50%)",
            width: 22, height: 22, borderRadius: "50%", background: color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800, color: "#08131c",
          }}
        >
          {pct}
        </div>
      </div>
    </div>
  );
}

// ---------- By pitch type ----------
function PitchTypePanel({ pitcher, pitchMix }) {
  const cell = (val, fmt, pct) => (
    <div>
      <div className="mono" style={{
        display: "inline-block", minWidth: 44, padding: "2px 6px", borderRadius: 5, fontSize: 11.5, fontWeight: 700,
        background: pctBadgeColor(pct), color: "#08131c",
      }}>
        {fmt(val)}
      </div>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--dim)", marginTop: 1 }}>{pct}</div>
    </div>
  );
  const pctFmt = (v) => `${v.toFixed(1)}%`;
  const rateFmt = (v) => v.toFixed(3).replace(/^0/, "");

  return (
    <div className="roster-panel" style={{ overflowX: "auto" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
        By pitch type
      </div>
      <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 780 }}>
        <thead>
          <tr style={{ color: "var(--dim)", fontSize: 10 }}>
            {["WHIFF", "BA", "SLG", "WOBA", "PC(%)", "PITCH (MPH)", "PF(%)", "WOBA ", "SLG ", "BA ", "WHIFF "].map((h, i) => (
              <th key={i} style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700 }}>{h.trim()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pitchMix.map((row) => (
            <tr key={row.key} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ textAlign: "center", padding: "6px" }}>{cell(row.overall.whiff, pctFmt, row.overall.whiffPct)}</td>
              <td style={{ textAlign: "center", padding: "6px" }}>{cell(row.overall.ba, rateFmt, row.overall.baPct)}</td>
              <td style={{ textAlign: "center", padding: "6px" }}>{cell(row.overall.slg, rateFmt, row.overall.slgPct)}</td>
              <td style={{ textAlign: "center", padding: "6px" }}>{cell(row.overall.woba, rateFmt, row.overall.wobaPct)}</td>
              <td style={{ textAlign: "center", padding: "6px", color: "var(--text)" }}>{row.pc} ({Math.round(row.usage * 100)}%)</td>
              <td className="oswald" style={{ textAlign: "center", padding: "6px", fontWeight: 700, color: "var(--text)" }}>
                {row.name} <span style={{ color: "var(--dim)", fontWeight: 400 }}>{row.velo.toFixed(0)}</span>
              </td>
              <td style={{ textAlign: "center", padding: "6px", color: "var(--text)" }}>{row.pf} ({Math.round((row.pf / (pitchMix.reduce((a, r) => a + r.pf, 0) || 1)) * 100)}%)</td>
              <td style={{ textAlign: "center", padding: "6px" }}>{cell(row.vsRHP.woba, rateFmt, row.vsRHP.wobaPct)}</td>
              <td style={{ textAlign: "center", padding: "6px" }}>{cell(row.vsRHP.slg, rateFmt, row.vsRHP.slgPct)}</td>
              <td style={{ textAlign: "center", padding: "6px" }}>{cell(row.vsRHP.ba, rateFmt, row.vsRHP.baPct)}</td>
              <td style={{ textAlign: "center", padding: "6px" }}>{cell(row.vsRHP.whiff, pctFmt, row.vsRHP.whiffPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Expected Opposing Lineup ----------
function ExpectedLineupPanel({ battingRoster, lineupRows, teamSplitRow, splitLabel, sample, setSample, showTeamSplits, setShowTeamSplits, selectedBatterId, onSelectBatter, statusOf }) {
  const cols = [
    ["pa", "PA", (v) => v],
    ["kPct", "K%", (v) => `${v.toFixed(1)}%`],
    ["chasePct", "CHASE%", (v) => `${v.toFixed(1)}%`],
    ["bbPct", "BB%", (v) => `${v.toFixed(1)}%`],
    ["whiffPct", "WHIFF%", (v) => `${v.toFixed(1)}%`],
    ["contPct", "CONT%", (v) => `${v.toFixed(1)}%`],
    ["zonePct", "ZONE%", (v) => `${v.toFixed(1)}%`],
    ["cswPct", "CSW%", (v) => `${v.toFixed(1)}%`],
    ["swstrPct", "SWSTR%", (v) => `${v.toFixed(1)}%`],
  ];
  const pctColor = (key, v) => {
    if (key === "pa") return "var(--text)";
    const higherIsGoodForPitcher = key === "kPct" || key === "chasePct" || key === "whiffPct" || key === "cswPct" || key === "swstrPct";
    const good = higherIsGoodForPitcher ? v >= 24 : v <= 8;
    const bad = higherIsGoodForPitcher ? v <= 14 : v >= 12;
    return good ? "var(--green)" : bad ? "var(--red)" : "var(--text)";
  };

  return (
    <div className="roster-panel" style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Expected Opposing Lineup
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--dim)", cursor: "pointer" }}>
            <input type="checkbox" checked={showTeamSplits} onChange={(e) => setShowTeamSplits(e.target.checked)} />
            Show pitcher vs team splits
          </label>
          <span style={{ fontSize: 11, color: "var(--dim)" }}>Hand split {splitLabel}</span>
          <div style={{ display: "flex", gap: 4 }}>
            {["L10", "L20", "L30", "All"].map((o) => (
              <div key={o} role="button" onClick={() => setSample(o)} className="mono" style={{
                cursor: "pointer", padding: "2px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 700,
                border: `1px solid ${sample === o ? "var(--amber)" : "var(--line)"}`,
                background: sample === o ? "var(--amber-dim)" : "var(--panel2)",
                color: sample === o ? "var(--amber)" : "var(--dim)",
              }}>
                {o}
              </div>
            ))}
          </div>
        </div>
      </div>

      <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 640 }}>
        <thead>
          <tr style={{ color: "var(--dim)", fontSize: 10 }}>
            <th style={{ textAlign: "left", padding: "4px 6px" }}>{showTeamSplits ? "TEAM" : "#"}</th>
            {!showTeamSplits && <th style={{ textAlign: "left", padding: "4px 6px" }}>BATTER</th>}
            {cols.map(([key, label]) => <th key={key} style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700 }}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {showTeamSplits ? (
            teamSplitRow && (
              <tr style={{ borderTop: "1px solid var(--line)" }}>
                <td className="oswald" style={{ padding: "8px 6px", fontWeight: 700, color: "var(--text)" }}>{battingRoster?.label || "Team"}</td>
                {cols.map(([key, , fmt]) => (
                  <td key={key} style={{ textAlign: "center", padding: "8px 6px", color: pctColor(key, teamSplitRow[key]), fontWeight: 700 }}>
                    {fmt(teamSplitRow[key])}
                  </td>
                ))}
              </tr>
            )
          ) : (
            lineupRows.map((row, i) => {
              const selected = row.batter.id === selectedBatterId;
              const batterStatus = statusOf && statusOf(row.batter);
              const nameColor = batterStatus === "out" ? "var(--status-out, #ef5b5b)"
                : batterStatus === "questionable" ? "var(--status-questionable, #e8b13a)"
                : "var(--text)";
              return (
                <tr
                  key={row.batter.id}
                  role="button"
                  onClick={() => onSelectBatter(row.batter.id)}
                  style={{
                    borderTop: "1px solid var(--line)", cursor: "pointer",
                    background: selected ? "var(--amber-dim)" : "transparent",
                  }}
                >
                  <td className="mono" style={{ padding: "6px", color: "var(--dim)" }}>{i + 1}</td>
                  {/* Availability lives in the name itself here rather than on
                       an avatar: this is a dense scan table and a row of faces
                       would compete with the numbers. Same three states as the
                       dot, same three colours. A selected row keeps the accent
                       so selection stays legible, and an unknown player is left
                       unstyled -- never coloured as available. */}
                  <td className="oswald" style={{ padding: "6px", fontWeight: 700, whiteSpace: "nowrap", color: selected ? "var(--amber)" : nameColor }}>
                    {row.batter.name}
                    {batterStatus === "out" && (
                      <span
                        className="mono"
                        title="Out — not available for this game"
                        style={{
                          marginLeft: 6, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em",
                          padding: "1px 4px", borderRadius: 3, verticalAlign: "middle",
                          color: "var(--status-out, #ef5b5b)", border: "1px solid var(--status-out, #ef5b5b)",
                        }}
                      >
                        OUT
                      </span>
                    )}
                  </td>
                  {cols.map(([key, , fmt]) => (
                    <td key={key} style={{ textAlign: "center", padding: "6px", color: pctColor(key, row[key]), fontWeight: key === "pa" ? 400 : 700 }}>
                      {fmt(row[key])}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// Catches a render-time crash anywhere in MLBPropsPage (e.g. a player object
// shape the graph/ledger code doesn't expect) and shows a recoverable message
// instead of letting the whole page go blank. Only a class component can be
// an error boundary -- React has no hook equivalent.
class MLBPageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center", padding: "24px 16px" }}>
          <div className="oswald" style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
            Something went wrong loading this player
          </div>
          <div style={{ fontSize: 12.5, color: "var(--dim)", marginBottom: 16 }}>
            Try selecting a different player from the roster or the strip below.
          </div>
          <div
            onClick={() => this.setState({ error: null })}
            role="button"
            className="oswald"
            style={{
              display: "inline-block", cursor: "pointer", padding: "8px 18px", borderRadius: 8,
              border: "1px solid var(--amber)", color: "var(--amber)", background: "var(--amber-dim)",
              fontSize: 12.5, fontWeight: 700,
            }}
          >
            Try Again
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MLBPropsPage({ jumpTo }) {
  const [showContext, setShowContext] = useState(false);
  const [teamAbbr, setTeamAbbr] = useState(MLB_TEAM_ID_ABBR[YANKEES_TEAM_ID]);
  const teamRoster = MLB_TEAM_ROSTERS[teamAbbr];
  const [playerId, setPlayerId] = useState(teamRoster.players[0].id);
  const [market, setMarket] = useState("h");
  // Which of the three side-panel tabs (see MLB_DETAIL_TABS) is showing
  // underneath the always-visible graph card -- null means none are open.
  // Clicking the already-active tab again closes it (see tabsBar below).
  const [view, setView] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Last player clicked in either roster panel, fed into
  // MLBMatchupAnalyzer so it auto-selects that batter/pitcher (nonce forces
  // the effect to re-fire even if the same id is clicked twice in a row).
  // Seeded to the initial default player (not null) so the Matchup tab opens
  // already synced to them on first load -- leaving this null until the user
  // clicks a roster row meant MLBMatchupAnalyzer's sync effect never fired,
  // so it fell back to its own defaults (the team's first SP vs. the
  // opponent's first batter) instead of the actual player being viewed.
  const [matchupPick, setMatchupPick] = useState(() => ({ side: "team", id: playerId, nonce: Date.now() }));

  // The selected team's actual next scheduled opponent -- pulled live from
  // the MLB Stats API (see fetchMLBTeamNextGame) instead of a fixed mock
  // pairing, so switching teams always shows who they're really playing
  // next, and it rolls forward on its own once that game goes final.
  // Deliberately does NOT reset to null when `teamAbbr` changes (it used to,
  // via a `setNextGame(null)` at the top of this effect) -- that blanked the
  // opponent roster panel and the date/time pill on every team switch, then
  // popped them back in once the fetch resolved, which is what read as a
  // stutter/glitch when flipping through matchups. The previous team's
  // nextGame now stays on screen until the new one actually lands; the
  // `cancelled` guard below still makes sure only the *latest* team's fetch
  // is ever allowed to win that race, so a slow response from a team the
  // user has already switched away from can't clobber newer data.
  // Which half of a doubleheader the matchup dropdown is pinned to, as a
  // gamePk. Null (the normal case, and the state after any jump in from the
  // Prop Feed) means "whatever this team's next non-final game is", which is
  // the only sensible answer when the team plays once that day. A pk left
  // over from a different team is harmless: that team's schedule won't
  // contain it, so fetchMLBTeamNextGame falls back to the same default.
  const [pickedGamePk, setPickedGamePk] = useState(null);
  const [nextGame, setNextGame] = useState(null);
  React.useEffect(() => {
    let cancelled = false;
    const teamId = MLB_ABBR_TEAM_ID[teamAbbr];
    const load = () => {
      if (!teamId) return;
      fetchMLBTeamNextGame(teamId, pickedGamePk).then((g) => { if (!cancelled) setNextGame(g); });
    };
    load();
    const interval = setInterval(load, MLB_SCHEDULE_TTL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamAbbr, pickedGamePk]);
  const oppRoster = (nextGame && MLB_TEAM_ROSTERS[nextGame.opp]) || null;

  // Live active-roster safety filter (see fetchMLBTeamActiveRoster) -- keyed
  // by mlbId -> {name, pos}, refetched whenever the selected team or its real
  // opponent changes, and re-polled on MLB_ACTIVE_ROSTER_TTL_MS otherwise so
  // a same-day demotion/call-up/trade drops out of the projected lineup on
  // its own instead of only refreshing once a new calendar day starts. null
  // while loading/unavailable means "don't filter yet" (liveTeamRoster/
  // liveOppRoster below fall back to the static roster rather than showing
  // nothing). Neither the poll's re-fetch NOR a team switch resets this back
  // to null first (see the nextGame effect above for why) -- applyActiveRoster
  // already falls back to the unfiltered static roster whenever the active-
  // roster ids on hand don't match anyone on the roster being filtered
  // (exactly what happens for the render or two where this is still the
  // *previous* team's active roster), so it's safe to just let the stale
  // value ride out the fetch instead of blanking the panel in the meantime.
  const [teamActiveRoster, setTeamActiveRoster] = useState(null);
  React.useEffect(() => {
    let cancelled = false;
    const teamId = MLB_ABBR_TEAM_ID[teamAbbr];
    if (!teamId) return;
    const load = () => { fetchMLBTeamActiveRoster(teamId).then((r) => { if (!cancelled) setTeamActiveRoster(r); }); };
    load();
    const interval = setInterval(load, MLB_ACTIVE_ROSTER_TTL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamAbbr]);

  // mlbId -> {code, description} for the team's whole 40-man, used to badge
  // teammate chips. Same polling cadence as the active roster above; null
  // while loading or unavailable, which every consumer treats as "no badge".
  const [teamRosterStatus, setTeamRosterStatus] = useState(null);
  React.useEffect(() => {
    let cancelled = false;
    const teamId = MLB_ABBR_TEAM_ID[teamAbbr];
    if (!teamId) return;
    const load = () => { fetchMLBTeamRosterStatus(teamId).then((r) => { if (!cancelled) setTeamRosterStatus(r); }); };
    load();
    const interval = setInterval(load, MLB_ROSTER_STATUS_TTL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamAbbr]);

  const [oppActiveRoster, setOppActiveRoster] = useState(null);
  React.useEffect(() => {
    let cancelled = false;
    const oppTeamId = nextGame && MLB_ABBR_TEAM_ID[nextGame.opp];
    if (!oppTeamId) return;
    const load = () => { fetchMLBTeamActiveRoster(oppTeamId).then((r) => { if (!cancelled) setOppActiveRoster(r); }); };
    load();
    const interval = setInterval(load, MLB_ACTIVE_ROSTER_TTL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [nextGame && nextGame.opp]);

  // Today's real MLB slate (see fetchMLBDaySlate, same fetch the Prop Feed's
  // MATCHUP dropdown uses) -- this is what lets the team selector below show
  // "Away @ Home" matchups instead of a flat A-Z team list, so picking one
  // row populates both roster panels at once like the NFL/WNBA pages.
  const [mlbSlate, setMlbSlate] = useState(null);
  React.useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchMLBDaySlate().then((slate) => { if (!cancelled) setMlbSlate(slate); });
    };
    load();
    const interval = setInterval(load, MLB_SLATE_TTL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const matchupOptions = useMemo(() => {
    if (!mlbSlate) return [];
    return mlbSlate.map((g, i) => ({
      id: `${g.awayAbbr}-${g.homeAbbr}-${i}`,
      teams: [g.awayAbbr, g.homeAbbr],
      gamePk: g.gamePk,
      label: `${(MLB_TEAM_ROSTERS[g.awayAbbr] || {}).label || g.awayAbbr} @ ${(MLB_TEAM_ROSTERS[g.homeAbbr] || {}).label || g.homeAbbr}`,
      time: `${matchupTimeLabel(g.date)}${mlbGameSuffix(mlbSlate, g)}`,
      date: g.date,
    }));
  }, [mlbSlate]);

  // Heading for the dropdown's single group, in the same format
  // groupMatchupsByDate produces for the other sports ("Friday, August 14")
  // so the two look identical. Taken from the slate's own first game rather
  // than from today's date: the day rolls over at midnight UTC upstream, and
  // the games are what the heading is actually describing.
  const mlbSlateDayLabel = useMemo(() => {
    const first = mlbSlate && mlbSlate[0];
    if (!first) return "Today's games";
    return new Date(first.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }, [mlbSlate]);
  // An explicit doubleheader pick wins, but only while it still belongs to
  // the team on screen -- otherwise the team lookup, which is the only thing
  // that can answer this after a jump in from the Prop Feed (that sets the
  // team, never the game). Both halves share a team, so without the first
  // clause the select would snap back to Gm 1 the moment you chose Gm 2.
  const activeMatchupId =
    matchupOptions.find((m) => m.gamePk === pickedGamePk && m.teams.includes(teamAbbr))?.id ||
    matchupOptions.find((m) => m.teams.includes(teamAbbr))?.id ||
    "";

  // Once the slate loads, snap the selection to the day's first scheduled
  // game (matchupOptions is already sorted by start time -- see
  // fetchMLBDaySlate) instead of leaving whatever hardcoded team the state
  // was seeded with -- that's what let a fixed Yankees default linger all
  // day even on days they aren't the first game. Only runs once (skips
  // entirely if a jumpTo already requested a specific player/team on this
  // same first load), so it never overrides a deliberate pick made since,
  // and re-fires fresh each calendar day since matchupOptions is rebuilt
  // from fetchMLBDaySlate's own day-keyed cache.
  const initializedFromSlate = React.useRef(false);
  React.useEffect(() => {
    if (initializedFromSlate.current || !matchupOptions.length) return;
    initializedFromSlate.current = true;
    if (jumpTo) return;
    const nextTeam = matchupOptions[0].teams[1];
    setTeamAbbr(nextTeam);
    setPlayerId(MLB_TEAM_ROSTERS[nextTeam].players[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchupOptions]);

  // Bridges a jump to a live-pitcher id (see mlbLivePitcherId) for the
  // render or two before nextGame has refetched for the newly-selected
  // team -- without this, liveTeamRoster below wouldn't yet know about the
  // pitcher the user just clicked through to from the Prop Feed.
  const [jumpedPitcher, setJumpedPitcher] = useState(null);

  React.useEffect(() => {
    if (!jumpTo) return;
    const live = parseMlbLivePitcherId(jumpTo.playerId);
    const liveBatter = live ? null : parseMlbLiveBatterId(jumpTo.playerId);
    if (live) {
      setTeamAbbr(live.team);
      setJumpedPitcher({ id: jumpTo.playerId, name: jumpTo.meta?.name || "Probable Pitcher", team: live.team, mlbId: live.mlbId });
    } else if (liveBatter) {
      // A batter the static rosters don't model (confirmed-lineup or
      // deadline addition). Only the team needs setting -- reconcileMlbLineup
      // rebuilds this exact id for that team's roster, so the playerId set
      // below then resolves against liveTeamRoster on its own.
      setTeamAbbr(liveBatter.team);
    } else {
      const jumpPlayer = ALL_MLB_PLAYERS.find((p) => p.id === jumpTo.playerId);
      if (jumpPlayer) setTeamAbbr(jumpPlayer.team);
    }
    setPlayerId(jumpTo.playerId);
    setMarket(jumpTo.market);
    setLine(null);
    setH2h(false);
    // A jump names a player, not a game -- drop any doubleheader pin so the
    // page lands on that team's next game rather than a half of someone
    // else's the dropdown happened to be pinned to.
    setPickedGamePk(null);
    setTimeout(() => chartRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo && jumpTo.nonce]);
  const [side, setSide] = useState("all");
  const [lastN, setLastN] = useState(10);
  // Replaces the old "Any opponent" dropdown -- restricts the sample to
  // games against the selected team's actual next scheduled opponent
  // (nextGame.opp) instead of letting the user pick any team from history.
  const [h2h, setH2h] = useState(false);
  const [minPA, setMinPA] = useState(0);
  const [maxPA, setMaxPA] = useState(6);
  const [paRangeEnabled, setPaRangeEnabled] = useState(false);
  const [line, setLine] = useState(null);
  const [dragLine, setDragLine] = useState(null);
  const [showStatInfo, setShowStatInfo] = useState(false);
  const chartRef = React.useRef(null);
  const chartWidth = useElementWidth(chartRef);
  const isNarrow = useIsNarrow();
  // Same breakpoint the roster columns collapse to a single stack at (see
  // .roster-layout in index.css) -- once that happens, everything used to
  // render in one long column with the tab content at the very bottom, so
  // this also gates moving the tabs + their content up to the top of that
  // column instead.
  const compact = useIsNarrow(1100);

  // User-resizable chart -- the container below gets CSS `resize: both`
  // (a native browser drag handle, bottom-right corner) instead of a custom
  // pointer-drag control, so there's no new hand-rolled drag code to get
  // wrong. The catch: React re-applies its own `style.height`/`width` on
  // every render, which would otherwise snap the box back to
  // MLB_GRAPH_CHART_HEIGHT the instant anything else causes a re-render
  // (switching market, toggling H2H, etc.), undoing the resize. This
  // ResizeObserver captures whatever size the user actually dragged it to
  // and feeds that back in as the height/width React then renders with, so
  // a resize sticks across re-renders instead of only lasting until the
  // next one.
  const [chartSize, setChartSize] = useState(null);
  React.useEffect(() => {
    // Reset first so a breakpoint change (mobile <-> desktop, which moves
    // MLB_GRAPH_CHART_HEIGHT's own default) starts from that new default
    // rather than carrying over a manually-resized size from the other
    // breakpoint's layout.
    setChartSize(null);
    const el = chartRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      // Read the border box, not contentRect (the content box, padding
      // excluded) -- the outer resizable element below has zero padding
      // of its own so the two are numerically equal today, but reading
      // borderBoxSize keeps that true even if padding is ever added back
      // to this element, instead of quietly reintroducing the shrink
      // loop this replaced (writing a content-box read back as this
      // element's own border-box style shrinks it by the padding every
      // cycle, which re-fires the observer, which shrinks it again).
      const box = entries[0].borderBoxSize?.[0];
      const width = box ? box.inlineSize : entries[0].contentRect.width;
      const height = box ? box.blockSize : entries[0].contentRect.height;
      setChartSize((prev) => {
        const w = Math.round(width), h = Math.round(height);
        if (prev && prev.w === w && prev.h === h) return prev;
        return { w, h };
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
    // Both breakpoints matter here: `isNarrow` drives MLB_GRAPH_CHART_HEIGHT's
    // own default, and `compact` (a different threshold) is what actually
    // swaps which graphCard() call site mounts the DOM node chartRef points
    // to -- without it, crossing 1100px while staying above/below 480px
    // would leave this observing an already-unmounted node.
  }, [isNarrow, compact]);

  // With/Without teammate splits -- each chip is {mlbId, name, mode}, mode
  // "with" requires that teammate to have played (per the real boxscore) in
  // a given game for it to count, "without" requires them to not have. See
  // the "Teammates" filter group below and fetchMLBGameBoxscoreLineupIds.
  const [teammateChips, setTeammateChips] = useState([]);
  const [boxscoreLineups, setBoxscoreLineups] = useState({});
  const [boxscoresLoading, setBoxscoresLoading] = useState(false);
  // Boxscores used to be fetched only once a chip was already active, which
  // is fine for filtering but leaves every chip's with/without differential
  // blank on first open -- the number is the whole point of the chip. Flipped
  // true the first time the Filters panel is opened (and stays true) so the
  // fetch is still demand-driven rather than firing on every page load.
  const [teammateDataWanted, setTeammateDataWanted] = useState(false);
  // mlbId of the teammate chip currently under the cursor, used to preview
  // that filter's effect on the chart before it's committed.
  const [hoverTeammate, setHoverTeammate] = useState(null);

  const resetFilters = () => {
    setSide("all");
    setLastN(10);
    setH2h(false);
    setMinPA(0);
    setMaxPA(6);
    setPaRangeEnabled(false);
    setLine(null);
    setTeammateChips([]);
  };

  // Swaps each roster's static "SP" placeholder for the actual live probable
  // starter (see fetchMLBTeamNextGame) once known, so the page shows and can
  // link to whoever is really starting instead of a hardcoded stand-in.
  // teamRoster falls back to a pending jumped-to pitcher (see the jumpTo
  // effect above) for the render or two before nextGame catches up.
  // Everything after that -- dropping IL'd/traded players, honoring the day's
  // confirmed batting order, topping the nine back up -- is reconcileMlbLineup
  // (module scope, shared with the Prop Feed).
  const liveTeamRoster = useMemo(() => {
    const live =
      (nextGame?.probablePitcher && { name: nextGame.probablePitcher.name, mlbId: nextGame.probablePitcher.mlbId }) ||
      (jumpedPitcher && jumpedPitcher.team === teamAbbr && { name: jumpedPitcher.name, mlbId: jumpedPitcher.mlbId }) ||
      null;
    const base = !live
      ? teamRoster
      : {
          label: teamRoster.label,
          players: [...teamRoster.players.filter((p) => p.pos !== "SP"), { id: mlbLivePitcherId(teamAbbr, live.mlbId), name: live.name, team: teamAbbr, pos: "SP", mlbId: live.mlbId }],
        };
    return reconcileMlbLineup(base, { activeRoster: teamActiveRoster, lineupIds: nextGame?.ourLineupIds, abbr: teamAbbr });
  }, [teamRoster, teamAbbr, nextGame, jumpedPitcher, teamActiveRoster]);

  const liveOppRoster = useMemo(() => {
    if (!oppRoster) return oppRoster;
    const live = nextGame?.oppProbablePitcher;
    const base = !live
      ? oppRoster
      : {
          label: oppRoster.label,
          players: [...oppRoster.players.filter((p) => p.pos !== "SP"), { id: mlbLivePitcherId(nextGame.opp, live.mlbId), name: live.name, team: nextGame.opp, pos: "SP", mlbId: live.mlbId }],
        };
    return reconcileMlbLineup(base, { activeRoster: oppActiveRoster, lineupIds: nextGame?.oppLineupIds, abbr: nextGame.opp });
  }, [oppRoster, nextGame, oppActiveRoster]);

  const player =
    liveTeamRoster.players.find((p) => p.id === playerId) ||
    (liveOppRoster && liveOppRoster.players.find((p) => p.id === playerId)) ||
    ALL_MLB_PLAYERS.find((p) => p.id === playerId) ||
    liveTeamRoster.players[0];
  const isPitcher = player.pos === "SP";
  // Same chart field either way (see the MLB chartData mapper), but it means
  // plate appearances for a batter and innings for a starter, so the axis
  // label and its decimal handling follow whoever is mounted.
  const mlbContextStat = isPitcher ? MLB_PITCHER_CONTEXT_STAT : MLB_BATTER_CONTEXT_STAT;

  // Which side of the matchup the currently selected player is on -- lets
  // the Bullpen tab below pick the correct "opposing" bullpen regardless of
  // whether the player came from the home roster or its live opponent's.
  const playerOnOppSide = !!(liveOppRoster && liveOppRoster.players.some((p) => p.id === playerId));

  // Keeps the Matchup/Lineup/Bullpen tabs pointed at whichever pitcher's
  // props are being viewed on the Graph tab, instead of always defaulting
  // back to the team's first starter when a tab is opened.
  React.useEffect(() => {
    if (!isPitcher) return;
    setMatchupPick({ side: playerOnOppSide ? "opp" : "team", id: playerId, nonce: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, isPitcher]);

  const [allGames, setAllGames] = useState([]);
  const [gameLogUpdatedAt, setGameLogUpdatedAt] = useState(null);

  // Load the player's live game log on mount/player switch, then keep
  // polling on the same cache TTL so a game that finishes while this page
  // is open shows up without needing a manual refresh. Starting pitchers
  // pull from the pitching game log/endpoint instead of the batting one.
  React.useEffect(() => {
    let cancelled = false;
    const load = () => {
      (isPitcher ? fetchMLBPitcherGameLog(player.mlbId) : fetchMLBGameLog(player.mlbId))
        .then((games) => {
          if (cancelled) return;
          setAllGames(games);
          setGameLogUpdatedAt(Date.now());
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, MLB_GAMELOG_TTL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [player.mlbId, isPitcher]);

  // Whenever the selected player switches between a batter and the starting
  // pitcher, make sure the active market still applies to them.
  React.useEffect(() => {
    const validMarkets = isPitcher ? MLB_PITCHER_MARKETS : MLB_MARKETS;
    if (!validMarkets.some((m) => m.id === market)) {
      setMarket(validMarkets[0].id);
      setLine(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  const seasonAvg = useMemo(() => {
    const n = allGames.length || 1;
    const sum = (key) => allGames.reduce((a, g) => a + g[key], 0);
    return isPitcher
      ? {
          k: sum("k") / n,
          er: sum("er") / n,
          bb: sum("bb") / n,
          h: sum("h") / n,
        }
      : {
          h: sum("h") / n,
          hr: sum("hr") / n,
          rbi: sum("rbi") / n,
          r: sum("r") / n,
        };
  }, [allGames, isPitcher]);

  // Every gamePk within the current side/H2H/PA scope (i.e. everything
  // the teammate predicate below might need to check) -- NOT the full
  // season blind, and computed before the teammate filter itself so adding
  // a chip doesn't change what counts as "in scope." Only populated while
  // at least one teammate chip is active, since boxscore fetches are
  // otherwise unnecessary.
  // The side/H2H/PA half of the filter predicate, factored out so the
  // boxscore prefetch below and `filtered` further down can't drift apart --
  // they were two hand-maintained copies of the same four conditions, and a
  // change to one silently desynced the prefetch scope from the filter it
  // exists to serve.
  const matchesScope = React.useCallback((game) => {
    if (side === "home" && !game.home) return false;
    if (side === "away" && game.home) return false;
    if (h2h && (!nextGame || game.opp !== nextGame.opp)) return false;
    if (!isPitcher && (game.pa < minPA || game.pa > maxPA)) return false;
    return true;
  }, [side, h2h, nextGame && nextGame.opp, minPA, maxPA, isPitcher]);

  const scopeGames = useMemo(() => allGames.filter(matchesScope), [allGames, matchesScope]);

  const teammateScopeGamePks = useMemo(() => {
    if (isPitcher) return [];
    if (!teammateChips.length && !teammateDataWanted) return [];
    const pks = Array.from(new Set(scopeGames.map((g) => g.gamePk).filter(Boolean)));
    // Two tiers. With nothing committed yet these boxscores exist only to
    // compute the differentials printed on the chips, so the most recent 40
    // is plenty and keeps merely *opening* the panel cheap. Once a chip is
    // actually filtering the chart, the sample has to be exact -- so every
    // in-scope game gets fetched, and the readiness gate below waits for all
    // of them. (Capping both tiers at 40 was a bug: the gate could never be
    // satisfied for a player with a longer log, so the filter silently never
    // applied.) Each response is sessionStorage-cached per gamePk.
    return teammateChips.length ? pks : pks.slice(-40);
  }, [scopeGames, teammateChips.length, teammateDataWanted, isPitcher]);

  React.useEffect(() => {
    if (!teammateScopeGamePks.length) return;
    let cancelled = false;
    setBoxscoresLoading(true);
    Promise.all(teammateScopeGamePks.map((pk) => fetchMLBGameBoxscoreLineupIds(pk).then((ids) => [pk, ids])))
      .then((pairs) => {
        if (cancelled) return;
        setBoxscoreLineups((prev) => {
          const next = { ...prev };
          pairs.forEach(([pk, ids]) => { next[pk] = ids; });
          return next;
        });
      })
      .finally(() => { if (!cancelled) setBoxscoresLoading(false); });
    return () => { cancelled = true; };
  }, [teammateScopeGamePks]);

  // True once every in-scope game has a boxscore to check chips against.
  // Until then the teammate predicate can only produce a partial answer.
  const teammateDataReady = useMemo(
    () => !teammateChips.length || scopeGames.every((g) => !g.gamePk || boxscoreLineups[g.gamePk]),
    [teammateChips.length, scopeGames, boxscoreLineups]
  );

  const filtered = useMemo(() => {
    // Applying the teammate predicate against a half-loaded boxscore map
    // dropped every not-yet-fetched game, so the chart visibly collapsed to a
    // couple of bars and then grew back as requests landed. Hold the
    // pre-teammate result until the data is complete instead -- the chip row
    // shows its own loading state meanwhile, so nothing is misrepresented as
    // a finished sample.
    const applyTeammates = !isPitcher && teammateChips.length > 0 && teammateDataReady;
    let g = scopeGames.filter((game) => {
      if (!applyTeammates) return true;
      if (!game.gamePk) return false;
      const ids = boxscoreLineups[game.gamePk];
      if (!ids) return false;
      for (const chip of teammateChips) {
        const played = ids.has(chip.mlbId);
        if (chip.mode === "with" && !played) return false;
        if (chip.mode === "without" && played) return false;
      }
      return true;
    });
    if (lastN !== "all") g = g.slice(-lastN);
    return g;
  }, [scopeGames, lastN, isPitcher, teammateChips, boxscoreLineups, teammateDataReady]);

  // Batter rate-stat card (PA/Hits/AVG/OBP/BABIP/K%) -- the top value is the
  // rate over whatever the filters above have narrowed "filtered" down to,
  // and the line underneath is that same rate stat's full-season baseline
  // for comparison, the same "your current view vs. the season" framing the
  // line/edge numbers below already use.
  const battingWindow = useMemo(() => (isPitcher ? null : battingRateAgg(filtered)), [filtered, isPitcher]);
  const battingSeason = useMemo(() => (isPitcher ? null : battingRateAgg(allGames)), [allGames, isPitcher]);

  // Pitcher rate-stat bar equivalent (IP/K/ERA/WHIP/H9/BB9) -- same "current
  // filtered view vs. full-season baseline" framing as the batter bar above.
  const pitchingWindow = useMemo(() => (isPitcher ? pitchingRateAgg(filtered) : null), [filtered, isPitcher]);
  const pitchingSeason = useMemo(() => (isPitcher ? pitchingRateAgg(allGames) : null), [allGames, isPitcher]);

  // On narrow (phone-width) screens, beyond a Last-10 sample per-bar team
  // logos/abbreviations can't stay legible, so the x-axis switches to sparse
  // date labels instead (see DateAxisTick). Desktop has enough width for
  // logo+abbr+date per bar at any sample size -- axisTickInterval already
  // caps the number of ticks actually drawn, so it never needs this fallback.
  const manyGames = isNarrow && filtered.length > 10;

  const isBinary = false;
  // Filtered to finite numbers -- for one render right after switching
  // between a batter and the starting pitcher, `allGames`/`market` can still
  // be the previous player's (the game-log fetch and the market-reset effect
  // below both resolve a render after playerId changes), so statValueMLB/
  // statValueMLBPitcher can momentarily be asked for a field the other
  // player's game-log shape doesn't have. Letting an undefined value reach
  // `avg`/`topValue` below turned them into NaN, which crashed Recharts'
  // <Bar minPointSize> invariant and blanked the whole page.
  const values = filtered
    .map((g) => (isPitcher ? statValueMLBPitcher(g, market) : statValueMLB(g, market)))
    .filter((v) => Number.isFinite(v));
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const med = median(values);
  const effectiveLine = isBinary ? 0.5 : (line === null ? ceilToHalfOdd(avg) : line);
  // Deliberately keyed off `line` (only non-null once the user has actually
  // dragged the handle to a custom value), not `effectiveLine` -- including
  // the live drag position here made the axis grow a step every time the
  // handle crossed a half-point while dragging, since a taller axis raised
  // topValue, which raised the handle's own `max`, letting it drag higher
  // still. The *default* suggested line (ceilToHalfOdd(avg), used only while
  // line is null) can still nudge the axis up if it rounds just past the
  // tallest bar, but once a real line is set the axis stays put and the
  // handle simply can't be dragged above it.
  const topValue = Math.max(...values, line === null ? ceilToHalfOdd(avg) : 0, 1);
  const rawMax = isBinary ? 1 : topValue + Math.max(1, Math.ceil(topValue * 0.05));
  const niceStep = (() => {
    if (isBinary) return 1;
    const targetTicks = 5;
    const roughStep = rawMax / targetTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(roughStep || 1)));
    const norm = roughStep / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 3 ? 3 : norm <= 5 ? 5 : 10) * mag;
    return Math.max(1, step);
  })();
  const chartMax = isBinary ? 1 : Math.ceil(rawMax / niceStep) * niceStep;
  const chartTicks = isBinary
    ? [0, 1]
    : Array.from({ length: chartMax / niceStep + 1 }, (_, i) => i * niceStep);
  const hits = values.filter((v) => v > effectiveLine).length;
  const pushes = isBinary ? 0 : values.filter((v) => v === effectiveLine).length;
  const hitRate = values.length ? hits / values.length : 0;
  const edge = avg - effectiveLine;
  const marketLabel = (isPitcher ? MLB_PITCHER_MARKETS : MLB_MARKETS).find((m) => m.id === market)?.label ?? "";

  // Single place both the metric rail and the hit-rate splits pull the
  // per-game market value from -- keeps the "same stat, different sample"
  // framing (season vs. graph vs. L5/L10/L20/H2H) reading off one function
  // instead of each spot re-picking statValueMLB vs. statValueMLBPitcher.
  // useCallback so the teammate-differential memo below keeps a stable
  // identity between renders -- recomputing a with/without split for every
  // player on the roster on each render would be wasteful.
  const statValueFn = React.useCallback(
    (g) => (isPitcher ? statValueMLBPitcher(g, market) : statValueMLB(g, market)),
    [isPitcher, market]
  );

  // Who can appear as a teammate chip, and what badge (if any) each carries.
  //
  // liveTeamRoster deliberately drops anyone off the active roster so the
  // lineup panel only ever shows players who could actually start tonight.
  // A chip row asks a different question -- "did this guy play in the games
  // I'm looking at?" is exactly what you want to ask about someone who just
  // landed on the IL -- so flagged players are added back here, and here
  // only, sorted behind the available ones.
  const teammateCandidates = useMemo(() => {
    if (isPitcher) return [];
    const statusFor = (mlbId, available) => {
      if (!teamRosterStatus) return null;
      const s = teamRosterStatus[mlbId];
      // On our static roster but no longer on the 40-man at all: traded,
      // released, or a free agent since that array was last written.
      if (!s) return available ? null : { label: "Left team", tone: "muted" };
      return MLB_STATUS_BADGES[s.code] || null;
    };
    const lineupIds = new Set((nextGame && nextGame.ourLineupIds) || []);
    const seen = new Set();
    const out = [];
    const push = (p, available) => {
      if (!p.mlbId || p.mlbId === player.mlbId || p.pos === "SP" || seen.has(p.mlbId)) return;
      seen.add(p.mlbId);
      out.push({ ...p, available, badge: statusFor(p.mlbId, available), inLineup: lineupIds.has(p.mlbId) });
    };
    liveTeamRoster.players.forEach((p) => push(p, true));
    teamRoster.players.forEach((p) => push(p, false));
    return out.sort((a, b) => (a.available === b.available ? 0 : a.available ? -1 : 1));
  }, [liveTeamRoster, teamRoster, player.mlbId, teamRosterStatus, nextGame, isPitcher]);

  // Availability for an MLB player, from the 40-man roster status already
  // fetched for the badges. Distinct from `badge`, which is null both when a
  // player is active and when the status feed has not loaded -- a dot must not
  // read those two as the same thing.
  //
  // On "muted": that tone covers AAA (RM/MIN/OPT), DFA (DES) and
  // restricted/suspended/reserve (RES/SU/RE, which the badge itself labels
  // "Out"). None of those players is available for tonight, so they map to
  // `out`, not to available -- a green dot on a player badged "Out" would be
  // plainly wrong. The badge beside the avatar still names the specific
  // reason, so nothing is lost by the dot being coarser.
  const mlbStatusOf = React.useCallback((p) => {
    if (!teamRosterStatus || !p || !p.mlbId) return undefined;
    const s = teamRosterStatus[p.mlbId];
    if (!s) return undefined;                       // not on the 40-man: unknown
    const badge = MLB_STATUS_BADGES[s.code];
    if (!badge) return "active";                    // code "A"
    return badge.tone === "warn" ? "questionable" : "out";
  }, [teamRosterStatus]);

  // mlbId -> the player's average in this market when that teammate played,
  // minus their average when he didn't. Computed over the in-scope games we
  // actually have boxscores for (see teammateScopeGamePks), so it narrows
  // with the location/H2H/PA filters the same way the chart does.
  const teammateDiffs = useMemo(() => {
    const out = {};
    if (isPitcher) return out;
    const known = scopeGames.filter((g) => g.gamePk && boxscoreLineups[g.gamePk]);
    if (known.length < 6) return out;
    teammateCandidates.forEach((p) => {
      let onSum = 0, onN = 0, offSum = 0, offN = 0;
      known.forEach((g) => {
        const v = statValueFn(g);
        if (boxscoreLineups[g.gamePk].has(p.mlbId)) { onSum += v; onN++; }
        else { offSum += v; offN++; }
      });
      // A differential drawn off a one- or two-game split is noise wearing a
      // decimal point. Withheld entirely rather than shown with a caveat --
      // the chip renders an em dash and means it.
      if (onN < 3 || offN < 3) return;
      out[p.mlbId] = onSum / onN - offSum / offN;
    });
    return out;
  }, [scopeGames, boxscoreLineups, teammateCandidates, statValueFn, isPitcher]);

  // Season-wide average for the *currently selected market* -- distinct from
  // `avg` above (which is scoped to `filtered`, i.e. whatever the side/PA/
  // teammate/sample-size filters have narrowed the chart down to) and from
  // `seasonAvg` (a fixed H/HR/RBI/R or K/ER/BB/H card, not keyed to market).
  // This is what lets the metric rail show "SEASON AVG" vs. "GRAPH AVG" as
  // two genuinely different numbers instead of the same value twice.
  const seasonValues = allGames.map(statValueFn);
  const seasonAvgForMarket = seasonValues.length ? seasonValues.reduce((a, b) => a + b, 0) / seasonValues.length : 0;

  // Chart data -- the played games in `filtered`, plus (when there's a real
  // scheduled game to show) one trailing placeholder entry for tonight's
  // matchup so the chart visibly ends on the game actually being researched
  // instead of trailing off after the last played one. Its `value` is set to
  // `effectiveLine` purely so the bar reaches the reference line for the
  // dashed-outline treatment below (see the Cell/BarValueLabel handling of
  // `isPlaceholder`) -- it is never treated as a real result.
  // Hovering a teammate chip previews that filter against the bars currently
  // on screen: games the player was in the lineup for keep full opacity, the
  // rest wash out. Once a chip is *committed* the non-matching games are gone
  // from `filtered` entirely, so highlighting after the click would just mark
  // every remaining bar -- the useful moment to show the split is before it.
  const chartData = filtered.map((g, i) => ({
    idx: i + 1,
    opp: g.opp,
    axisKey: `${g.opp}__${g.date}`,
    value: statValueFn(g),
    date: g.date,
    minutes: isPitcher ? formatOuts(g.outs) : g.pa,
    home: g.home,
    defRank: MLB_TEAM_DEF[g.opp]?.rank ?? null,
    // undefined (not false) when there's nothing to preview or no boxscore
    // for the game, so an unknown lineup is never rendered as "sat out".
    previewOut:
      hoverTeammate && g.gamePk && boxscoreLineups[g.gamePk]
        ? !boxscoreLineups[g.gamePk].has(hoverTeammate)
        : undefined,
  }));
  if (nextGame && MLB_TEAM_DEF[nextGame.opp]) {
    const nextDate = (nextGame.date || "").slice(0, 10);
    chartData.push({
      idx: chartData.length + 1,
      opp: nextGame.opp,
      axisKey: `${nextGame.opp}__${nextDate}`,
      value: effectiveLine,
      date: nextDate,
      minutes: null,
      home: nextGame.home,
      defRank: MLB_TEAM_DEF[nextGame.opp].rank,
      isPlaceholder: true,
    });
  }

  // Bullpen lists shown under each team's lineup (see TeamRosterPanel /
  // LineupDrawer's `bullpen` prop) -- teamBullpen() itself is still the
  // seeded mock generator described where it's defined above; only where
  // it renders has moved.
  const teamBullpenList = useMemo(() => teamBullpen(teamAbbr), [teamAbbr]);
  const oppBullpenList = useMemo(() => (nextGame ? teamBullpen(nextGame.opp) : []), [nextGame && nextGame.opp]);

  // Bullpen tab always shows the reliever corps on the *other* side of the
  // ball from the selected player, whichever roster that turns out to be.
  const opposingBullpenList = playerOnOppSide ? teamBullpenList : oppBullpenList;
  const opposingBullpenLabel = playerOnOppSide ? liveTeamRoster.label : ((liveOppRoster || {}).label || "");

  // Next-game info bar: the selected team's real next scheduled opponent
  // (see fetchMLBTeamNextGame), not a fixed mock date -- so it always
  // reflects the actual live schedule. Renders nothing until the live fetch
  // resolves. Below the `compact` breakpoint this renders full-width above
  // the tabs instead of squeezed into the roster-layout center column,
  // which is what was clipping the "vs Team — Venue" line against the tabs
  // underneath it.
  const nextGamePill = nextGame && (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center", gap: 14,
      flexWrap: "wrap", textAlign: "center",
      width: compact ? "100%" : "fit-content", margin: "0 auto 12px", padding: "9px 16px",
      background: "var(--panel)", border: "1px solid var(--line)", borderRadius: compact ? 14 : 999,
      fontSize: 12.5, color: "var(--dim)",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span style={{ color: "var(--text)", fontWeight: 600 }}>
          {new Date(nextGame.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </span>
        <span>·</span>
        <span className="mono" style={{ color: "var(--amber)", fontWeight: 700 }}>
          {new Date(nextGame.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
        </span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span style={{ color: "var(--text)", fontWeight: 600 }}>
          {nextGame.home ? "vs" : "@"} {(oppRoster || {}).label || nextGame.opp}
        </span>
        {nextGame.venue && <span>— {nextGame.venue}</span>}
      </span>
      {/* Weather already shows in the Game Conditions bar directly
           above this pill -- repeating it here just duplicated the
           same temp/wind reading twice on screen. */}
    </div>
  );

  // Matchup / Lineup / Bullpen -- an optional single panel, opened as an
  // overlay over the page by the tab row (see tabsBar). At most one of the
  // three is open at a time; view is null when none are. It used to render
  // inline at the bottom of the center column, which put it a screenful below
  // the tabs that control it -- see MLBDetailModal for that story.
  const activeTabContent = (
    <MLBDetailModal
      open={view !== null}
      onClose={() => setView(null)}
      title={(MLB_DETAIL_TABS.find((t) => t.id === view) || {}).label || ""}
      isNarrow={isNarrow}
    >
      {(view === "matchup" || view === "lineup") && (
        <MLBMatchupAnalyzer teamRoster={liveTeamRoster} oppRoster={liveOppRoster} nextGame={nextGame} pick={matchupPick} section={view} />
      )}

      {view === "bullpen" && (
        <BullpenAnalyzerPanel teamLabel={opposingBullpenLabel} bullpen={opposingBullpenList} />
      )}
    </MLBDetailModal>
  );

  // Sample-window rate-stat bar (batter PA/Hits/AVG/OBP/BABIP/K%, or pitcher
  // IP/K/ERA/WHIP/H9/BB9) + its info-glossary toggle -- same data/markup as
  // before, just recessed into the graph card's header instead of standing
  // as its own bordered panel below the chart.
  const sampleStatsRow = !isPitcher
    ? (battingWindow && battingSeason && (() => {
        const fmtDelta = (diff, decimals, higherIsBetter, suffix = "") => {
          const sign = diff < 0 ? "-" : "+";
          const text = `${sign}${Math.abs(diff).toFixed(decimals)}${suffix}`;
          const rounded = parseFloat(diff.toFixed(decimals));
          const color = rounded === 0 || higherIsBetter === null
            ? "var(--dim)"
            : (rounded > 0) === higherIsBetter ? "var(--green)" : "var(--red)";
          return { text, color };
        };
        const cards = [
          { key: "pa", label: "PA", value: battingWindow.pa.toFixed(1), delta: fmtDelta(battingWindow.pa - battingSeason.pa, 1, null) },
          { key: "hits", label: "Hits", value: battingWindow.hits.toFixed(1), delta: fmtDelta(battingWindow.hits - battingSeason.hits, 1, true) },
          { key: "avg", label: "AVG", value: battingWindow.avg.toFixed(3), delta: fmtDelta(battingWindow.avg - battingSeason.avg, 3, true) },
          { key: "obp", label: "OBP", value: battingWindow.obp.toFixed(3), delta: fmtDelta(battingWindow.obp - battingSeason.obp, 3, true) },
          { key: "babip", label: "BABIP", value: battingWindow.babip.toFixed(3), delta: fmtDelta(battingWindow.babip - battingSeason.babip, 3, true) },
          { key: "kpct", label: "K%", value: `${battingWindow.kpct.toFixed(1)}%`, delta: fmtDelta(battingWindow.kpct - battingSeason.kpct, 1, false, "%") },
        ];
        const glossary = [
          { key: "pa", label: "PA — Plate Appearances", body: "Every time a player completes a turn at bat — including walks and getting hit by a pitch, not just official at-bats. It's basically \"how many chances did they get.\" More PA usually means more opportunities to rack up hits, RBIs, etc." },
          { key: "hits", label: "Hits", body: "How many times the player got a hit (single, double, triple, or home run) per game in the sample shown." },
          { key: "avg", label: "AVG — Batting Average", body: "Hits divided by at-bats. The classic \"batting average\" you've probably heard on a broadcast — shown here as 0.300 instead of the usual \".300\". Around 0.250 is roughly average for MLB, 0.300+ is very good." },
          { key: "obp", label: "OBP — On-Base Percentage", body: "How often a player reaches base by any means — hit, walk, or hit-by-pitch — not just hits. Many bettors and analysts consider it a better gauge of a hitter's value than AVG, since it also credits players who draw a lot of walks." },
          { key: "babip", label: "BABIP — Batting Average on Balls In Play", body: "Batting average counting only balls the player actually put in play (strikeouts and home runs don't count). It's a useful \"regression\" signal — if it's way above or below a player's normal range, their recent hot or cold streak may not last much longer." },
          { key: "kpct", label: "K% — Strikeout Rate", body: "The percentage of plate appearances that end in a strikeout. Lower is better for a hitter — a high K% means they're missing a lot, which can make Over bets on contact-based props (hits, total bases) riskier." },
        ];
        return (
          <div style={{ position: "relative", background: "rgba(0,0,0,0.16)", borderBottom: "1px solid var(--line)" }}>
            <div style={{
              display: "flex", justifyContent: "center", gap: compact ? 14 : 26, flexWrap: "wrap",
              padding: compact ? "6px 10px" : "8px 20px",
            }}>
              {cards.map((c) => (
                <div key={c.key} style={{ textAlign: "center", minWidth: compact ? 42 : 52 }}>
                  <div className="micro-label" style={{ fontSize: compact ? 9.5 : 10.5, marginBottom: 2 }}>
                    {c.label}
                  </div>
                  <div className="mono stat-value" style={{ fontSize: compact ? 14 : 17, color: "var(--text)" }}>{c.value}</div>
                  <div className="mono tnum" style={{ fontSize: compact ? 10 : 11, fontWeight: 600, color: c.delta.color }}>{c.delta.text}</div>
                </div>
              ))}
              <div
                onClick={() => setShowStatInfo((v) => !v)}
                title="What do these stats mean?"
                role="button"
                aria-expanded={showStatInfo}
                className="mono"
                style={{
                  position: "absolute", top: 8, right: 10,
                  cursor: "pointer",
                  width: 18, height: 18, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  border: `1px solid ${showStatInfo ? "var(--amber)" : "var(--line)"}`,
                  color: showStatInfo ? "var(--amber)" : "var(--dim)",
                  background: showStatInfo ? "var(--amber-dim)" : "transparent",
                }}
              >
                i
              </div>
            </div>
            {showStatInfo && (
              <div style={{ padding: "12px 14px", background: "var(--panel2)", borderTop: "1px solid var(--line)" }}>
                <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 10, fontStyle: "italic" }}>
                  A quick guide to these stats, if you're newer to baseball props. One thing that trips people up:
                  the small card above (H/HR/RBI/R) is always the <strong>full season</strong> average, while the
                  numbers below are for whatever your filters are currently showing — so "Hits" here and "H" up
                  there can show different values for the same player at the same time.
                </div>
                {glossary.map((g) => (
                  <div key={g.key} style={{ marginBottom: 10 }}>
                    <div className="oswald" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>
                      {g.label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2, lineHeight: 1.4 }}>
                      {g.body}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })())
    : (pitchingWindow && pitchingSeason && (() => {
        const fmtDelta = (diff, decimals, higherIsBetter, suffix = "") => {
          const sign = diff < 0 ? "-" : "+";
          const text = `${sign}${Math.abs(diff).toFixed(decimals)}${suffix}`;
          const rounded = parseFloat(diff.toFixed(decimals));
          const color = rounded === 0 || higherIsBetter === null
            ? "var(--dim)"
            : (rounded > 0) === higherIsBetter ? "var(--green)" : "var(--red)";
          return { text, color };
        };
        const cards = [
          { key: "ip", label: "IP", value: pitchingWindow.ip.toFixed(1), delta: fmtDelta(pitchingWindow.ip - pitchingSeason.ip, 1, null) },
          { key: "k", label: "K", value: pitchingWindow.k.toFixed(1), delta: fmtDelta(pitchingWindow.k - pitchingSeason.k, 1, true) },
          { key: "era", label: "ERA", value: pitchingWindow.era.toFixed(2), delta: fmtDelta(pitchingWindow.era - pitchingSeason.era, 2, false) },
          { key: "whip", label: "WHIP", value: pitchingWindow.whip.toFixed(2), delta: fmtDelta(pitchingWindow.whip - pitchingSeason.whip, 2, false) },
          { key: "h9", label: "H/9", value: pitchingWindow.h9.toFixed(1), delta: fmtDelta(pitchingWindow.h9 - pitchingSeason.h9, 1, false) },
          { key: "bb9", label: "BB/9", value: pitchingWindow.bb9.toFixed(1), delta: fmtDelta(pitchingWindow.bb9 - pitchingSeason.bb9, 1, false) },
        ];
        const glossary = [
          { key: "ip", label: "IP — Innings Pitched", body: "How many innings the pitcher worked, on average, in the games shown. More innings usually means a start went deep and went well; a short outing usually means they got pulled early (hit hard, high pitch count, etc.)." },
          { key: "k", label: "K — Strikeouts", body: "Strikeouts recorded per game in the sample shown. Higher is generally better for a pitcher — more swings and misses, less contact for the opposing lineup." },
          { key: "er", label: "ER — Earned Runs (in the card above)", body: "A raw count of earned runs allowed per game — runs that scored without help from a fielding error. It's not adjusted for how long the pitcher was out there, which is exactly what ERA (below) fixes." },
          { key: "era", label: "ERA — Earned Run Average", body: "Earned runs allowed per 9 innings pitched — ER × 9 ÷ IP. This is the standardized version of ER above: 3 earned runs in a 3-inning start (bad) and 3 earned runs in a 7-inning start (fine) both just say \"ER: 3\", but they produce very different ERAs. Lower is better; under ~4.00 is solid, under 3.00 is excellent." },
          { key: "whip", label: "WHIP — Walks + Hits per Inning Pitched", body: "How many baserunners (via walk or hit) a pitcher allows per inning, on average. Lower is better — a quick read on how often they're letting hitters reach base, independent of whether those runners actually score." },
          { key: "h9", label: "H/9 — Hits Allowed per 9", body: "Hits allowed per 9 innings pitched. Lower is better — a good gauge of how hittable a pitcher has been lately, useful context for Over/Under bets on the opposing lineup's hits props too." },
          { key: "bb9", label: "BB/9 — Walks Allowed per 9", body: "Walks allowed per 9 innings pitched. Lower is better — a pitcher walking a lot of batters is giving up free baserunners, and it's often a sign their command is off that night." },
        ];
        return (
          <div style={{ position: "relative", background: "rgba(0,0,0,0.16)", borderBottom: "1px solid var(--line)" }}>
            <div style={{
              display: "flex", justifyContent: "center", gap: compact ? 14 : 26, flexWrap: "wrap",
              padding: compact ? "6px 10px" : "8px 20px",
            }}>
              {cards.map((c) => (
                <div key={c.key} style={{ textAlign: "center", minWidth: compact ? 42 : 52 }}>
                  <div className="micro-label" style={{
                    fontSize: compact ? 9.5 : 10.5, marginBottom: 2,
                    textDecoration: c.key === "k" && market === "p_k" ? "underline var(--amber)" : "none",
                    textUnderlineOffset: 3,
                  }}>
                    {c.label}
                  </div>
                  <div className="mono stat-value" style={{ fontSize: compact ? 14 : 17, color: "var(--text)" }}>{c.value}</div>
                  <div className="mono tnum" style={{ fontSize: compact ? 10 : 11, fontWeight: 600, color: c.delta.color }}>{c.delta.text}</div>
                </div>
              ))}
              <div
                onClick={() => setShowStatInfo((v) => !v)}
                title="What do these stats mean?"
                role="button"
                aria-expanded={showStatInfo}
                className="mono"
                style={{
                  position: "absolute", top: 8, right: 10,
                  cursor: "pointer",
                  width: 18, height: 18, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  border: `1px solid ${showStatInfo ? "var(--amber)" : "var(--line)"}`,
                  color: showStatInfo ? "var(--amber)" : "var(--dim)",
                  background: showStatInfo ? "var(--amber-dim)" : "transparent",
                }}
              >
                i
              </div>
            </div>
            {showStatInfo && (
              <div style={{ padding: "12px 14px", background: "var(--panel2)", borderTop: "1px solid var(--line)" }}>
                <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 10, fontStyle: "italic" }}>
                  A quick guide to these stats, if you're newer to baseball props. Two things that trip people up:
                  the small card above (K/ER/BB/H) is always the <strong>full season</strong> average, while the
                  numbers below are for whatever your filters are currently showing — and "ER" up there is a
                  different kind of stat than "ERA" below (see those two entries first if that's what brought you here).
                </div>
                {glossary.map((g) => (
                  <div key={g.key} style={{ marginBottom: 10 }}>
                    <div className="oswald" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>
                      {g.label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2, lineHeight: 1.4 }}>
                      {g.body}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })());

  // Line hero row -- replaces the old stacked "line value" block plus its
  // separate 3-box Hit Rate / Average / Edge grid with one inline strip:
  // Hit Rate on the left, the draggable line value centered and large,
  // Average + Edge on the right.
  // Metric rail -- replaces the old lineHeroRow's separate 34px hero number
  // and "drag the tab" caption (dropped entirely: the draggable handle on
  // the chart itself, now anchored at the plot's left edge, is the only
  // place the line value reads from). Sits flush on the chart's top edge:
  // season-wide average for this market vs. the graph's own filtered-sample
  // average, hit rate against the current line, and edge.
  const metricRail = (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap",
      gap: compact ? 20 : 32, padding: compact ? "10px 12px 6px" : "12px 20px 8px",
    }}>
      <div style={{ textAlign: "center" }}>
        <div className="micro-label" style={{ fontSize: compact ? 9.5 : 10.5 }}>Season Avg</div>
        <div className="mono stat-value" style={{ fontSize: compact ? 16 : 19, color: "var(--text)" }}>{seasonAvgForMarket.toFixed(1)}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="micro-label" style={{ fontSize: compact ? 9.5 : 10.5 }}>Graph Avg</div>
        <div className="mono stat-value" style={{ fontSize: compact ? 16 : 19, color: "var(--text)" }}>{avg.toFixed(1)}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="micro-label" style={{ fontSize: compact ? 9.5 : 10.5 }}>Hit Rate</div>
        <div className="mono stat-value" style={{ fontSize: compact ? 16 : 19, color: "var(--text)" }}>
          {Math.round(hitRate * 100)}%{" "}
          <span className="tnum" style={{ fontSize: compact ? 10 : 11, color: "var(--dim)", fontWeight: 600 }}>({hits}/{values.length})</span>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="micro-label" style={{ fontSize: compact ? 9.5 : 10.5 }}>Edge</div>
        <div className="mono stat-value" style={{ fontSize: compact ? 16 : 19, color: edge >= 0 ? "var(--green)" : "var(--red)" }}>
          {`${edge >= 0 ? "+" : ""}${edge.toFixed(1)}`}
        </div>
      </div>
    </div>
  );

  // Local chart height for the blended graph card -- deliberately its own
  // constant rather than the shared CHART_HEIGHT (which other sports' pages
  // also use). Sized to leave room for the identity/sample-stat/metric-rail
  // rows above the plot and the splits/sample-size rows below it, while
  // still keeping bars legible -- shorter than the original 440/760 now that
  // the card carries more rows overall, so avatar + rail + chart stay
  // visible together without scrolling on a phone-height viewport.
  const MLB_GRAPH_CHART_HEIGHT = isNarrow ? 340 : 600;

  // The always-visible graph card: player identity, sample-window stats,
  // and the line-hero row blended into one header directly on top of the
  // chart, plus a small Filters/Get Odds action row underneath -- replaces
  // the old separately-bordered line-summary card + Get Odds panel + bare
  // chart box that used to stack above/around the chart.
  // A function (not a plain JSX const) so it can reference playerIdentityRow
  // and filterGroups, which are only defined further down this component --
  // it's invoked once at the bottom, by which point everything it closes
  // over already exists.
  const graphCard = () => (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", marginBottom: 16, overflow: "hidden", position: "relative" }}>
      {/* Game Conditions -- desktop only, a full-width strip across the top
           of the card (PropsMadness reference) instead of sitting above the
           left TeamRosterPanel, which pushed that lineup panel down out of
           alignment with the right one. Sits in normal flow, not absolutely
           positioned, so it pushes playerIdentityRow down rather than ever
           overlapping it. Mobile still gets its own full-width
           GameConditionsBar above the card (see the
           {compact && <GameConditionsBar/>} render above). */}
      {!compact && (
        <GameConditionsBar
          nextGame={nextGame}
          teamAbbr={teamAbbr}
          isPitcher={isPitcher}
          variant="compact"
          opponentLabel={(liveOppRoster || {}).label}
        />
      )}

      {playerIdentityRow}

      {/* Market selector lives at the top of the card, directly under player
           identity and above the chart -- previously stranded below the
           chart in the desktop-only .roster-layout-center column (and not
           rendered on mobile at all, since the compact block never included
           it). graphCard() is called from both the compact and desktop
           render paths, so putting it here covers both at once. */}
      <div style={{ padding: compact ? "10px 12px 14px" : "12px 20px 18px" }}>
        <MarketSectionGrid
          singleBar
          sections={
            isPitcher
              ? [{ label: "Pitching", markets: MLB_PITCHER_MARKETS }]
              : [
                  { label: "Core", markets: [...MLB_MARKETS_ROW_1, ...MLB_MARKETS_ROW_2] },
                  { label: "Discipline & Speed", markets: MLB_MARKETS_ROW_3 },
                ]
          }
          activeMarket={market}
          onSelect={(id) => { setMarket(id); setLine(null); }}
          isNarrow={isNarrow}
        />
      </div>

      {sampleStatsRow}
      {metricRail}

      {/* Teammate filter summary. The Filters panel is closed by default, so
           without this the only trace of an active With/Without filter is the
           count badge on the trigger -- the chart silently shows a different
           sample with nothing on screen saying whose presence is being
           required. Sits directly above the chart it qualifies.

           Full names here, not the chips' abbreviated "T. Grisham": the chip
           is 132px and has a headshot to disambiguate it, this is a sentence
           about what you're looking at.

           Tint plus a 1px border rather than the solid fill the panel's
           controls use -- solid means "this is a selected control" in the new
           design, and this is a readout. The x is the exception: it clears
           that whole group, so the pill is also the fastest way to undo the
           filter it's describing. */}
      {!isPitcher && teammateChips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, padding: "0 16px 12px" }}>
          {[
            { mode: "with", label: "Including", color: "var(--green)", bg: "color-mix(in srgb, var(--green) 14%, transparent)" },
            { mode: "without", label: "Excluding", color: "var(--red)", bg: "var(--red-dim)" },
          ].map(({ mode, label, color, bg }) => {
            const names = teammateChips.filter((c) => c.mode === mode).map((c) => c.name);
            if (!names.length) return null;
            return (
              <div
                key={mode}
                style={{
                  display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap",
                  padding: "5px 8px 5px 11px", borderRadius: 999, fontSize: 12,
                  background: bg, border: `1px solid ${color}`, color,
                }}
              >
                <span className="oswald" style={{ fontWeight: 800, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {label}
                </span>
                <span style={{ color: "var(--text)" }}>{names.join(", ")}</span>
                <span
                  role="button"
                  aria-label={`Clear ${label.toLowerCase()} filter`}
                  title={`Clear ${label.toLowerCase()} filter`}
                  onClick={() => setTeammateChips((prev) => prev.filter((c) => c.mode !== mode))}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 15, height: 15, borderRadius: "50%", flexShrink: 0,
                    fontSize: 11, lineHeight: 1, cursor: "pointer",
                    background: "color-mix(in srgb, currentColor 18%, transparent)",
                  }}
                >
                  ×
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Chart -- user-resizable via the native browser drag handle (CSS
           `resize`, bottom-right corner) rather than a custom pointer-drag
           control; see chartSize/the ResizeObserver above for how a resize
           survives the next re-render instead of snapping back. Minimum
           size is enforced by min-height/min-width, which `resize` itself
           respects, and maxWidth keeps it from being dragged past the
           card's own edge.

           Split into an unpadded outer (the actual resizable/observed
           element) and a padded inner: the ResizeObserver above reads this
           outer element's own border-box size and writes it straight back
           as this same element's width/height style. With padding on this
           element, that read (content box, padding excluded) written back
           as the border-box size shrinks the element every cycle, which
           re-fires the observer -- a feedback loop that converges on the
           min-width/min-height floor (this is what collapsed the graph to
           a ~280x240 stub). Zero padding here makes content-box and
           border-box equal, so the loop can't start; the padding that
           gives the chart its breathing room moves to the inner div. */}
      <div
        ref={chartRef}
        style={{
          position: "relative", boxSizing: "border-box",
          height: chartSize?.h || MLB_GRAPH_CHART_HEIGHT,
          width: chartSize?.w || "100%",
          resize: "both", overflow: "hidden",
          minHeight: 240, minWidth: 280, maxWidth: "100%",
          // A nested strip, not a second card: graphCard()'s own wrapper
          // already supplies the border/shadow for the whole card, so this
          // only needs a subtle background to read as its own section
          // without a competing outline.
          background: "var(--surface-2)", borderRadius: "var(--r-md)",
        }}
      >
        {/* The launcher owns the popover, bottom sheet, click-outside and
             Escape handling (shared with the other sports pages). Opening it
             is also what kicks off the teammate boxscore prefetch that backs
             the chip differentials.

             Lives inside the chart's own container (not the identity/header
             card) so it reads as part of the chart -- anchored to this div's
             top-right corner, in the empty space above the bars, on both
             mobile and desktop alike. */}
        <FilterPanelLauncher
          open={filtersOpen}
          onOpenChange={(v) => { setFiltersOpen(v); if (v) setTeammateDataWanted(true); }}
          activeCount={activeFilterCount}
          compact={compact}
          anchored
        >
          {filtersBody}
        </FilterPanelLauncher>
        <ContextStatToggle stat={mlbContextStat} value={showContext} onChange={setShowContext} compact={isNarrow} />
        <div style={{
          height: "100%", width: "100%", boxSizing: "border-box",
          padding: isNarrow ? "16px 6px 10px" : "16px 16px 8px",
          touchAction: "pan-y",
        }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            // right clears LineHandle, which anchors to the container's right
            // edge: it needs right:8 + its 52px minimum, less the 6px the
            // narrow chart wrapper already pads, so 54 is the floor. 30 left
            // the pill sitting on top of the last bar.
            margin={{ top: 10, right: isNarrow ? 64 : 60, bottom: manyGames ? 30 : (isNarrow ? 42 : 78), left: isNarrow ? 0 : 20 }}
            barCategoryGap={isNarrow ? "4%" : "6%"}
          >
            {/* Invisible (stroke="transparent"), not removed: rendered fully
                 open per the PropsMadness reference (no grid lines, just
                 floating y-tick labels), but LineHandle's drag math
                 (getPlotBoundsY, above) measures the plot's top/bottom by
                 querying this component's own rendered .recharts-cartesian-
                 grid-horizontal line elements -- removing the component
                 entirely would silently break the drag handle instead of
                 just hiding a visual grid. */}
            <CartesianGrid stroke="transparent" vertical={false} />
            <XAxis
              dataKey={manyGames ? "date" : "axisKey"}
              interval={manyGames ? Math.max(0, Math.ceil(chartData.length / (isNarrow ? 5 : 8)) - 1) : axisTickInterval(chartData.length, isNarrow, chartWidth)}
              tick={manyGames ? (props) => <DateAxisTick {...props} compact={isNarrow} /> : (props) => <TeamAxisTick {...props} logoFn={mlbTeamLogo} compact={isNarrow} />}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, chartMax]}
              ticks={chartTicks}
              tick={{ fill: "var(--chart-ink)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={isNarrow ? 32 : 60}
              label={isNarrow ? undefined : { value: marketLabel, angle: -90, position: "insideLeft", offset: 10, style: { textAnchor: "middle", fill: "var(--chart-ink)", fontSize: 11, fontWeight: 600 } }}
            />
            <Tooltip
              content={<ChartTooltip effectiveLine={effectiveLine} isBinary={isBinary} marketLabel={marketLabel} footerLabel={(d) => (isPitcher ? `${d.minutes} IP` : `${d.minutes} PA`)} logoFn={mlbTeamLogo} />}
              cursor={{ fill: "var(--surface-3)", opacity: 0.5 }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} minPointSize={(v) => (v === 0 ? 3 : 0)}>
              {chartData.map((d, i) => {
                if (d.isPlaceholder) {
                  return <Cell key={i} fill="transparent" stroke="var(--amber)" strokeWidth={1.5} strokeDasharray="4 3" />;
                }
                const fill = isBinary ? (d.value === 1 ? CHART_GREEN : "transparent") : (d.value > effectiveLine ? CHART_GREEN : CHART_RED);
                // Teammate-chip hover preview: games he sat out wash out,
                // games he played get an accent outline.
                if (d.previewOut === true) return <Cell key={i} fill={fill} fillOpacity={0.22} />;
                if (d.previewOut === false) return <Cell key={i} fill={fill} stroke="var(--amber)" strokeWidth={1.5} />;
                return <Cell key={i} fill={fill} />;
              })}
              <LabelList dataKey="value" content={(props) => <BarValueLabel {...props} isBinary={isBinary} />} />
            </Bar>
            {contextStatChartParts(mlbContextStat, showContext, isNarrow)}
            {/* Rendered after Bar (not before) so the dashed threshold line
                 draws on top of the bars instead of being clipped underneath
                 them -- later JSX = higher SVG paint order in Recharts. */}
            {!isBinary && <ReferenceLine y={dragLine !== null ? dragLine : effectiveLine} stroke="var(--amber)" strokeDasharray="4 4" />}
          </ComposedChart>
        </ResponsiveContainer>
        </div>
        {!isBinary && (
          <LineHandle
            value={effectiveLine}
            onChange={(v) => setLine(v)}
            onDragValue={setDragLine}
            min={0}
            max={chartMax}
            containerRef={chartRef}
          />
        )}
      </div>

      <HitRateSplits
        allGames={allGames}
        statValue={statValueFn}
        effectiveLine={effectiveLine}
        lastN={lastN}
        onSetLastN={setLastN}
        h2h={h2h}
        onSetH2h={setH2h}
        opponentAbbr={nextGame?.opp}
        isNarrow={isNarrow}
        max={allGames.length}
      />

      {/* Action row -- Get Odds only now; Filters moved to the card's
           top-right corner (see above) so its panel has room to open
           downward instead of upward off the top of the screen. */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px 16px" }}>
        {/* Values from the same sample the chart is drawing (placeholder bar
             for tonight's unplayed game excluded), so the hit rate this panel
             compares against the book's price is the one already on screen
             rather than a second, differently-filtered number. */}
        <SportsbookOddsPanel
          teamAbbr={teamAbbr}
          playerName={player.name}
          market={market}
          isPitcher={isPitcher}
          values={chartData.filter((d) => !d.isPlaceholder).map((d) => d.value)}
        />
      </div>
    </div>
  );

  // Game-log ledger table -- unchanged, still directly under the graph card.
  const ledgerTable = (
    <CollapsibleSection title={`Game Logs (${filtered.length})`} storageKey="mlb_game_logs_open">
      <div style={{ border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ minWidth: 580 }}>
            <div className="mono" style={{ display: "grid", gridTemplateColumns: "5fr 9fr 6fr 6fr 6fr 6fr 7fr 6fr 7fr", padding: "10px 14px", fontSize: 11, color: "var(--dim)", borderBottom: "1px solid var(--line)", textTransform: "uppercase", textAlign: "center" }}>
              <div>#</div><div>Date</div><div>Opp</div><div>Def#</div><div>Loc</div><div>{isPitcher ? "IP" : "PA"}</div><div>{marketLabel}</div><div>Line</div><div>Result</div>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto", overflowX: "hidden" }}>
              {filtered.slice().reverse().map((g, i) => {
                const v = isPitcher ? statValueMLBPitcher(g, market) : statValueMLB(g, market);
                const over = v > effectiveLine;
                const push = !isBinary && v === effectiveLine;
                const def = MLB_TEAM_DEF[g.opp];
                const tier = mlbDefTier(def?.rank);
                return (
                  <div key={`${g.date}-${i}`} className="ledger-row mono" style={{ display: "grid", gridTemplateColumns: "5fr 9fr 6fr 6fr 6fr 6fr 7fr 6fr 7fr", padding: "9px 14px", fontSize: 12.5, textAlign: "center" }}>
                    <div style={{ color: "var(--dim)" }}>{filtered.length - i}</div>
                    <div>{g.date}</div>
                    <div>{g.opp}</div>
                    <div style={{ color: tier === "soft" ? "var(--green)" : tier === "tough" ? "var(--red)" : "var(--dim)" }}>{def ? `#${def.rank}` : "—"}</div>
                    <div style={{ color: "var(--dim)" }}>{g.home ? "Home" : "Away"}</div>
                    <div>{isPitcher ? formatOuts(g.outs) : g.pa}</div>
                    <div style={{ color: "var(--text)" }}>{isBinary ? (v === 1 ? "Yes" : "No") : v}</div>
                    <div style={{ color: "var(--dim)" }}>{isBinary ? "—" : effectiveLine}</div>
                    <div style={{ color: push ? "var(--dim)" : over ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                      {isBinary ? (v === 1 ? "YES" : "NO") : (push ? "PUSH" : over ? "OVER" : "UNDER")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: "var(--dim)" }}>
        Live 2026 regular-season game logs (MLB Stats API) for the {teamRoster.label}{oppRoster ? ` and ${oppRoster.label}` : ""} lineups shown above, refreshed on load and every 15 minutes
        {gameLogUpdatedAt ? ` — data as of ${new Date(gameLogUpdatedAt).toLocaleTimeString()}` : ""}.
        Defensive matchup ranks are real team ERA, refreshed nightly.
      </div>
    </CollapsibleSection>
  );

  // Matchup + market selectors -- picking one of today's real games
  // (see fetchMLBDaySlate) sets the "our side" team, and its real next
  // scheduled opponent (see fetchMLBTeamNextGame) populates the other
  // roster panel -- the same "pick a matchup, see its two rosters"
  // pattern the NFL/WNBA pages use. Picking an individual player
  // happens by clicking their row in either roster panel. Pulled into a
  // variable (same pattern as nextGamePill/tabsBar/activeTabContent above)
  // so it can render as a compact top header on mobile instead of after
  // the whole tab content, where it used to land at the bottom of the page.
  const matchupSelectorBlock = (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, marginTop: compact ? 14 : 20, width: compact ? "100%" : "auto" }}>
      {/* GameSelect rather than a native <select>: this was the only sport
          page still on the plain control, so it was the only one whose game
          dropdown showed no team logos. Grouped under a single day heading
          because this slate is always exactly one day (fetchMLBDaySlate), as
          opposed to NFL/WNBA which span a week. */}
      <GameSelect
        groups={matchupOptions.length ? [{ label: mlbSlateDayLabel, matchups: matchupOptions }] : []}
        value={activeMatchupId}
        logoFn={mlbTeamLogo}
        compact={compact}
        emptyLabel={mlbSlate ? "No games today" : "Loading today's games…"}
        onChange={(mo) => {
          // Always the home team (teams[1], not the away team at teams[0])
          // -- picking a *different* matchup only fires this once, but
          // selecting this same option again later (e.g. after clicking away
          // to another game and back) re-fires it too, and defaulting to
          // teams[0] every time meant that second pick flipped left/right
          // from whichever side you'd actually been viewing, since it always
          // landed on the away team regardless. A fixed side for a given
          // matchup is stable across re-selections.
          const nextTeam = mo.teams[1];
          // startTransition marks this whole batch of state (which cascades
          // into re-fetching nextGame/teamActiveRoster/oppActiveRoster and
          // re-deriving both roster columns, the chart, and the game log)
          // as lower priority than the dropdown's own click response -- lets
          // React keep the UI responsive through the switch instead of the
          // whole cascade blocking one big paint.
          React.startTransition(() => {
            setTeamAbbr(nextTeam);
            setPickedGamePk(mo.gamePk);
            setPlayerId(MLB_TEAM_ROSTERS[nextTeam].players[0].id);
            setLine(null);
            setH2h(false);
          });
        }}
      />
    </div>
  );

  // Player identity row: avatar + name/team/pos + season snapshot
  // (H/HR/RBI/R, or K/ER/BB/H for pitchers) -- now the top of the blended
  // graph card (see graphCard) instead of its own bordered panel next to
  // the matchup selector, so it no longer carries its own background/
  // border, just a bottom divider against the sample-stats row below it.
  const playerIdentityRow = (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: compact ? 10 : 20,
      flexWrap: "wrap", borderBottom: "1px solid var(--line)",
      // Game Info now renders as its own full-width row above this one (see
      // the GameConditionsBar render in graphCard()) instead of an
      // absolutely-positioned corner overlay, so this row no longer needs
      // left/right clearance to avoid running underneath it -- only the
      // Filters button (still an absolute top-right overlay) needs a
      // right-side reservation, and only while this row is short enough to
      // reach that corner.
      padding: compact ? "8px 12px" : "12px 20px",
      paddingRight: compact ? 12 : 110,
    }}>
      <PlayerAvatar
        key={player.id}
        name={player.name}
        alt={player.name}
        sport="mlb"
        team={player.team}
        colorMap={MLB_TEAM_COLORS}
        headshotSrc={mlbHeadshot(player.mlbId)}
        fallbackSrc={mlbEspnHeadshot(player.id)}
        status={mlbStatusOf(player)}
        surface="var(--panel)"
        size={compact ? 56 : 84}
        inset={compact ? 3 : 5}
        backing={"#000"}
        imgBorder="1px solid var(--line)"
        fadeIn
        shadow={`0 4px 14px ${(MLB_TEAM_COLORS[player.team] || {}).primary || "#000"}40`}
      />

      <div style={{ textAlign: "center", paddingRight: compact ? 8 : 16 }}>
        <div className="oswald" style={{ fontSize: compact ? 13 : 16, color: "var(--text)", whiteSpace: "nowrap" }}>{player.name}</div>
        <div style={{ fontSize: compact ? 9 : 10.5, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {player.team} · {player.pos} · Season
        </div>
      </div>

      <div style={{ display: "flex", gap: compact ? 12 : 20, flexWrap: "wrap" }}>
        {(isPitcher
          ? [
              { label: "K", value: seasonAvg.k },
              { label: "ER", value: seasonAvg.er },
              { label: "BB", value: seasonAvg.bb },
              { label: "H", value: seasonAvg.h },
            ]
          : [
              { label: "H", value: seasonAvg.h },
              { label: "HR", value: seasonAvg.hr },
              { label: "RBI", value: seasonAvg.rbi },
              { label: "R", value: seasonAvg.r },
            ]
        ).map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div className="mono" style={{ fontSize: compact ? 14 : 18, color: "var(--amber)", fontWeight: 700 }}>{s.value.toFixed(2)}</div>
            <div style={{ fontSize: compact ? 9 : 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // How many filters are actually narrowing the sample right now. Drives the
  // badge on the trigger and in the panel header -- previously nothing on
  // screen distinguished "no filters" from "four filters", which is how the
  // NFL page shipped with a 50%-snap default nobody noticed.
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (side !== "all") n += 1;
    if (h2h) n += 1;
    if (lastN !== 10) n += 1;
    if (!isPitcher && (minPA !== 0 || maxPA !== 6)) n += 1;
    n += teammateChips.length;
    return n;
  }, [side, h2h, lastN, minPA, maxPA, teammateChips.length, isPitcher]);

  const splitCells = buildHitRateSplits({
    allGames,
    statValue: statValueFn,
    effectiveLine,
    lastN,
    onSetLastN: setLastN,
    h2h,
    onSetH2h: setH2h,
    opponentAbbr: nextGame?.opp,
    shortLabels: true,
  });

  // Opposing-side players for the with/without dropdowns. Same shape the chip
  // row consumes so PlayerScopeSelect doesn't need to care which side a row
  // came from.
  const opponentCandidates = useMemo(() => {
    if (isPitcher || !liveOppRoster) return [];
    return liveOppRoster.players
      .filter((p) => p.mlbId && p.pos !== "SP")
      .map((p) => ({ ...p, available: true, badge: null }));
  }, [liveOppRoster, isPitcher]);

  const teammateModeSummary = teammateChips.length
    ? `${teammateChips.filter((c) => c.mode === "with").length} with · ${teammateChips.filter((c) => c.mode === "without").length} without`
    : "Tap to cycle";

  const filtersBody = (
    <FilterPanel activeCount={activeFilterCount} onReset={resetFilters}>
      {/* Sample size leads and stays unshaded -- it's the filter you reach for
           first, and letting it sit on the panel's own surface makes the
           shaded blocks below read as secondary without a heading saying so. */}
      <FilterSection title="Sample size">
        <SampleSizeGrid cells={splitCells} />
        <SampleSizeSlider
          total={allGames.length}
          lastN={lastN}
          onSetLastN={(v) => { setH2h(false); setLastN(v); }}
        />
      </FilterSection>

      {/* Location and plate appearances share a row instead of stacking --
           two short controls that each used to claim a full-width column. */}
      <FilterSection shaded>
        <div className="fp-grid-2">
          <div>
            <div className="micro-label" style={{ fontSize: 10, marginBottom: 7 }}>Game location</div>
            <div className="fp-row">
              {["all", "home", "away"].map((s) => (
                <div key={s} className={`chip-sm ${side === s ? "active" : ""}`} role="button" onClick={() => setSide(s)}>
                  {s === "all" ? "All games" : s === "home" ? "Home" : "Away"}
                </div>
              ))}
            </div>
          </div>
          {!isPitcher && (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
                <span className="micro-label" style={{ fontSize: 10 }}>Plate appearances</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--amber)" }}>
                  {!paRangeEnabled
                    ? (minPA === 0 ? "Any" : `${minPA}+`)
                    : (minPA === 0 && maxPA === 6 ? "Any" : `${minPA}–${maxPA}`)}
                </span>
              </div>
              <ThresholdSlider
                min={0}
                max={6}
                step={1}
                lo={minPA}
                hi={maxPA}
                onChangeLo={setMinPA}
                onChangeHi={setMaxPA}
                rangeEnabled={paRangeEnabled}
                onToggleRange={() => setPaRangeEnabled((v) => !v)}
              />
            </div>
          )}
        </div>
      </FilterSection>

      {!isPitcher && (
        <FilterSection
          shaded
          title="Teammates"
          action={
            <span className="mono" style={{ fontSize: 10, color: "var(--dim)" }}>
              {boxscoresLoading ? "Loading…" : teammateModeSummary}
            </span>
          }
        >
          <TeammateChipRow
            candidates={teammateCandidates}
            diffs={teammateDiffs}
            chips={teammateChips}
            onChange={setTeammateChips}
            loading={boxscoresLoading}
            compact={compact}
            onHover={setHoverTeammate}
            statusFor={mlbStatusOf}
          />
        </FilterSection>
      )}

      {!isPitcher && (
        <FilterSection shaded title="Precision">
          <PlayerScopeSelect
            teammates={teammateCandidates}
            opponents={opponentCandidates}
            chips={teammateChips}
            onChange={setTeammateChips}
            oppLabel={nextGame?.opp}
            statusFor={mlbStatusOf}
          />
        </FilterSection>
      )}
    </FilterPanel>
  );

  // Styled as tabs, but each one opens the same overlay dialog rather than
  // swapping an inline panel, so they carry button/dialog semantics instead of
  // tab/tablist ones.
  const tabsBar = (
    <div
      style={{
        display: "flex", justifyContent: "center", gap: 6, marginBottom: 14,
        overflowX: isNarrow ? "auto" : "visible", WebkitOverflowScrolling: "touch",
      }}
    >
      {MLB_DETAIL_TABS.map((v) => (
        <div
          key={v.id}
          onClick={() => setView((cur) => (cur === v.id ? null : v.id))}
          role="button"
          aria-haspopup="dialog"
          aria-expanded={view === v.id}
          className="oswald"
          style={{
            cursor: "pointer", padding: "6px 16px", borderRadius: 999, fontSize: 12, fontWeight: 700,
            letterSpacing: "0.03em", flexShrink: 0, whiteSpace: "nowrap",
            border: `1px solid ${view === v.id ? "var(--amber)" : "var(--line)"}`,
            background: view === v.id ? "var(--amber-dim)" : "var(--panel)",
            color: view === v.id ? "var(--amber)" : "var(--dim)",
          }}
        >
          {v.label}
        </div>
      ))}
    </div>
  );

  return (
    <div className="page-shell page-shell--mobile-nav" style={{ maxWidth: 1920, margin: "0 auto", boxSizing: "border-box" }}>
    {/* Bullpen no longer passed to MobilePlayerNav below -- it doesn't
         belong in the Lineup drawer (see LineupDrawer) since it already has
         its own Bullpen tab (BullpenAnalyzerPanel, fed by
         teamBullpenList/oppBullpenList directly further down). */}
    <MobilePlayerNav
      teamA={liveTeamRoster}
      teamB={liveOppRoster || { label: "Loading…", players: [] }}
      activeId={playerId}
      onSelect={(id) => {
        setPlayerId(id); setLine(null); setH2h(false);
        const side = liveTeamRoster.players.some((p) => p.id === id) ? "team" : "opp";
        setMatchupPick({ side, id, nonce: Date.now() });
      }}
      headshotSrc={(p) => mlbHeadshot(p.mlbId)}
      headshotFallback={(p) => mlbEspnHeadshot(p.id)}
      metaLine={(p) => p.pos}
      avatarBg={(p) => teamAvatarBackground(MLB_TEAM_COLORS, p.team)}
      chipRole={(p) => p.pos === "SP"}
      chipRoleLabel={() => "P"}
    />
    {/* Game Conditions: full-width, mobile only. Desktop (!compact) instead
         gets the compact variant inside the left roster gutter below -- a
         full-width bar above the 3-column layout used to leave a tall dead
         band above the lineups on desktop; folding it into the gutter
         reclaims that space and lets the lineups/chart start higher. */}
    {compact && <GameConditionsBar nextGame={nextGame} teamAbbr={teamAbbr} isPitcher={isPitcher} />}
    {/* Date/time + matchup pill sits directly under Game Conditions (both
         are pre-game info about the matchup itself) rather than after the
         player avatar/stat header below -- reads as "here's the game, here's
         its conditions" before the page turns to the selected player. */}
    {compact && nextGamePill}

    {/* Below the `compact` breakpoint (roster columns already stacked into
         one column -- see .roster-layout in index.css), the tabs render here,
         full-width and immediately under the game info, instead of waiting at
         the bottom of the matchup selector/stat card/market grid/filters
         column below. Above that breakpoint the 3-column layout has room for
         all of it, so this stays out of the way and the tabs render in their
         original spot inside the center column instead (see further down).
         The tabs' panel is no longer part of either branch -- it's an overlay
         now, mounted once at the end of the shell below. */}
    {compact && (
      <>
        {matchupSelectorBlock}
        {tabsBar}
        {graphCard()}
        {ledgerTable}
      </>
    )}

    <div className="roster-layout">
    {/* Compact Game Conditions used to render here, above the left
         TeamRosterPanel -- but that pushed the left lineup panel down while
         the right one (with nothing above it) started higher, leaving the
         two starting lineups visibly misaligned. It now renders inside
         graphCard's top-left corner instead (see the "compact" corner
         placement below, in the !compact branch of the card header), so
         both TeamRosterPanels start at the same height again. */}
      <TeamRosterPanel
        teamLabel={liveTeamRoster.label}
        players={liveTeamRoster.players}
        activeId={playerId}
        onSelect={(id) => { setPlayerId(id); setLine(null); setH2h(false); setMatchupPick({ side: "team", id, nonce: Date.now() }); }}
        headshotSrc={(p) => mlbHeadshot(p.mlbId)}
        headshotFallback={(p) => mlbEspnHeadshot(p.id)}
        metaLine={(p) => p.pos}
        avatarBg={(p) => teamAvatarBackground(MLB_TEAM_COLORS, p.team)}
        confirmed={(nextGame?.ourLineupIds?.length || 0) > 0}
      />
    <div className="roster-layout-center">
      {!compact && tabsBar}
      {!compact && matchupSelectorBlock}

      {/* Guarded by !compact -- the compact (<1100px) equivalent of this
           graph/ledger stack already renders above in the {compact && (...)}
           block. Without this guard both blocks mount at once below 1100px:
           two charts sharing the single chartRef ref below, which breaks
           LineHandle's gridline measurement (it reads whichever chart
           mounted last) and produces the mobile line-drag jump bug on top of
           the visibly duplicated chart/ledger. The market selector used to
           render here too; it's now inside graphCard() itself (see above),
           which is called from both this block and the compact one. */}
      {!compact && (
        <div style={{ marginTop: "var(--s-3)" }}>
          {graphCard()}
          {ledgerTable}
        </div>
      )}
    </div>
    <TeamRosterPanel
      teamLabel={(liveOppRoster || {}).label || "Loading…"}
      players={(liveOppRoster || {}).players || []}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setH2h(false); setMatchupPick({ side: "opp", id, nonce: Date.now() }); }}
      headshotSrc={(p) => mlbHeadshot(p.mlbId)}
      headshotFallback={(p) => mlbEspnHeadshot(p.id)}
      metaLine={(p) => p.pos}
      avatarBg={(p) => teamAvatarBackground(MLB_TEAM_COLORS, p.team)}
      confirmed={(nextGame?.oppLineupIds?.length || 0) > 0}
    />
    </div>

      <PlayerNewsModule playerName={player.name} headshotSrc={mlbHeadshot(player.mlbId)} sport="mlb" team={player.team} />

      {/* Mounted once, unguarded, and last: it's a position:fixed overlay, so
           where it sits in the tree doesn't affect where it paints, but two
           copies (the old compact/!compact pair) would stack two backdrops. */}
      {activeTabContent}
    </div>
  );
}

// ---------- Prop Feed (multi-player, multi-prop research list) ----------
// Category buckets a market rolls up into for the feed's secondary filter row.
const NBA_MARKET_CATEGORY = {
  pts: "Points", reb: "Rebounds", ast: "Assists", stl: "Steals", blk: "Blocks", stk: "Stocks",
  pra: "Combos", ra: "Combos", pr: "Combos", pa: "Combos",
  "3pm": "Shooting", "3pa": "Shooting", ftm: "Shooting", fta: "Shooting",
  dd: "Double-Doubles", td: "Triple-Doubles",
};
const NBA_FEED_CATEGORIES = ["All", "Points", "Rebounds", "Assists", "Steals", "Blocks", "Stocks", "Combos", "Shooting", "Double-Doubles", "Triple-Doubles"];

// Same idea as the NFL feed's per-(market) defensive ranking: a team's
// points defense, rebounding, and 3PM defense are three different numbers
// in reality, so the feed's OPP RANK badge shouldn't reuse one overall
// rating for every market. [base, spread] is a rough plausible per-game
// range for that stat, just used to seed a believable rating.
const NBA_MARKET_DEF_RANGE = {
  pts: [113, 14], reb: [44, 8], ast: [26, 8], stl: [7.5, 3], blk: [4.8, 2.5], stk: [12, 4],
  pra: [183, 20], ra: [70, 12], pr: [157, 18], pa: [139, 16],
  "3pm": [12.5, 4], "3pa": [34, 8], ftm: [17, 6], fta: [22, 7],
};
const NBA_MARKET_DEF_LABEL = {
  pts: "scoring defense", reb: "rebounds allowed", ast: "assists allowed",
  stl: "steals forced", blk: "shots blocked", stk: "stocks allowed",
  pra: "PRA allowed", ra: "RA allowed", pr: "PR allowed", pa: "PA allowed",
  "3pm": "3PM allowed", "3pa": "3PA allowed", ftm: "FTM allowed", fta: "FTA allowed",
};

const nbaDefCategoryCache = {};
function getNBADefRank(market, opp) {
  const range = NBA_MARKET_DEF_RANGE[market];
  if (!range) return TEAM_DEF[opp]; // dd/td -- no single-stat defensive concept
  if (!nbaDefCategoryCache[market]) {
    const seed = 5300 + (hashStr(market) % 5000);
    nbaDefCategoryCache[market] = buildDefenseCategoryFor(TEAMS, seed, range[0], range[1]);
  }
  return nbaDefCategoryCache[market][opp];
}
function nbaDefCategoryLabel(market) {
  return NBA_MARKET_DEF_LABEL[market] || "overall defense";
}

const WNBA_MARKET_CATEGORY = {
  pts: "Points", reb: "Rebounds", ast: "Assists", pra: "Combos", ra: "Combos", pr: "Combos", pa: "Combos",
  "3pm": "Shooting", stl: "Steals", blk: "Blocks", dd: "Double-Doubles", td: "Double-Doubles",
};
const WNBA_FEED_CATEGORIES = ["All", "Points", "Rebounds", "Assists", "Combos", "Shooting", "Steals", "Blocks", "Double-Doubles"];

// Same per-market defensive-ranking idea as the NBA feed above, just seeded
// off the WNBA's own team pool and scaled down to WNBA-realistic per-game
// ranges (lower scoring/pace than the NBA).
const WNBA_MARKET_DEF_RANGE = {
  pts: [78, 10], reb: [33, 6], ast: [19, 6], pra: [128, 14], ra: [50, 10], pr: [110, 12], pa: [96, 12],
  "3pm": [8, 3], stl: [6, 2.5], blk: [3.5, 2],
};
const WNBA_MARKET_DEF_LABEL = {
  pts: "scoring defense", reb: "rebounds allowed", ast: "assists allowed",
  pra: "PRA allowed", ra: "RA allowed", pr: "PR allowed", pa: "PA allowed",
  "3pm": "3PM allowed", stl: "steals forced", blk: "shots blocked",
};
// Same "one real number, applied to every market" approach as the NFL fix
// (see nflTeamDefReal above) -- real per-category WNBA defensive splits
// aren't available from any free public source, so once loaded this holds
// real opponent points allowed per game, ranked, used across every market.
let wnbaTeamDefReal = null;

const wnbaDefCategoryCache = {};
const WNBA_DEF_RANK_FALLBACK = { rank: 8, rating: 0 };
function getWNBADefRank(market, opp) {
  if (wnbaTeamDefReal && wnbaTeamDefReal[opp]) return wnbaTeamDefReal[opp];
  const range = WNBA_MARKET_DEF_RANGE[market];
  if (!range) return WNBA_TEAM_DEF[opp] || WNBA_DEF_RANK_FALLBACK;
  if (!wnbaDefCategoryCache[market]) {
    const seed = 7300 + (hashStr(market) % 5000);
    wnbaDefCategoryCache[market] = buildDefenseCategoryFor(WNBA_TEAMS, seed, range[0], range[1]);
  }
  return wnbaDefCategoryCache[market][opp] || WNBA_DEF_RANK_FALLBACK;
}
function wnbaDefCategoryLabel(market) {
  return WNBA_MARKET_DEF_LABEL[market] || "overall defense";
}
// Same caveat as nflDefIsPointsAllowed: once the real table has loaded,
// getWNBADefRank ignores the market entirely and returns points allowed per
// game, so a market-specific label next to that number would be a lie.
function wnbaDefIsPointsAllowed(opp) {
  return !!(wnbaTeamDefReal && wnbaTeamDefReal[opp]);
}

// The WNBA season is live (unlike NFL/2025), so this uses a short TTL and
// refetches periodically -- same reasoning as fetchMLBGameLog's TTL.
const WNBA_TEAM_DEF_TTL_MS = 30 * 60 * 1000;
async function fetchWNBATeamDefense() {
  const cacheKey = "wnba_team_def_v1";
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Date.now() - parsed.fetchedAt < WNBA_TEAM_DEF_TTL_MS) return parsed.byTeam;
    }
  } catch {}

  try {
    const res = await fetch("https://site.api.espn.com/apis/v2/sports/basketball/wnba/standings?season=2026");
    if (!res.ok) return null;
    const data = await res.json();
    const rows = [];
    (data?.children || []).forEach((conf) => {
      (conf?.standings?.entries || []).forEach((entry) => {
        const abbr = entry.team?.abbreviation;
        const avgPA = entry.stats?.find((s) => s.name === "avgPointsAgainst")?.value;
        if (abbr && avgPA != null) rows.push({ abbr, avgPA });
      });
    });
    if (!rows.length) return null;

    rows.sort((a, b) => a.avgPA - b.avgPA);
    rows.forEach((r, i) => { r.rank = i + 1; });
    const byTeam = {};
    rows.forEach((r) => { byTeam[r.abbr] = { rank: r.rank, rating: Math.round(r.avgPA * 10) / 10 }; });

    try { sessionStorage.setItem(cacheKey, JSON.stringify({ byTeam, fetchedAt: Date.now() })); } catch {}
    return byTeam;
  } catch {
    return null;
  }
}

// Same row-building approach as buildNBAFeedRows, over the WNBA's real
// tonight/tomorrow rosters and its own curated market list.
function buildWNBAFeedRows() {
  const rows = [];
  // Live rosters when they have loaded, the hand-written arrays otherwise, and
  // de-duped by espnId so a player who appears in both is only built once.
  // Players without a game log are skipped -- the same wnbaPlayerHasData
  // predicate the player page uses, so the feed and the page can never disagree
  // about who exists.
  const pool = [];
  const seen = new Set();
  const push = (p) => {
    const key = p && p.espnId ? String(p.espnId) : p && p.id;
    if (!key || seen.has(key)) return;
    seen.add(key);
    pool.push(p);
  };
  Object.keys(WNBA_TEAM_ESPN_ID).forEach((abbr) => wnbaRosterFor(abbr).forEach(push));
  ALL_WNBA_PLAYERS.forEach(push);

  pool.forEach((player, pi) => {
    const games = getWNBAGames(player, pi);
    if (!games || !games.length) return;
    const nextOpp = games[games.length - 1].opp;
    const gameDate = wnbaGameDateForTeam(player.team, player.id);
    wnbaPlayerMarkets(player).forEach((m) => {
      const isBinary = m.id === "dd" || m.id === "td";
      const def = getWNBADefRank(m.id, nextOpp);
      const rank = def.rank;
      const tier = defTier(rank);
      const values = games.map((g) => statValue(g, m.id));
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const line = isBinary ? 0.5 : fairFeedLine(values);
      const hit = isBinary ? (v) => v === 1 : (v) => v > line;
      const variance = values.reduce((a, v) => a + (v - avg) ** 2, 0) / values.length;
      rows.push({
        key: `wnba_${player.id}_${m.id}`,
        playerId: player.id,
        marketId: m.id,
        category: WNBA_MARKET_CATEGORY[m.id],
        icon: wnbaTeamLogo(player.team),
        avatar: wnbaHeadshot(player.espnId),
        espnId: player.espnId,
        name: player.name,
        team: player.team,
        date: gameDate,
        marketLabel: m.label,
        subtitle: isBinary ? m.label : `Over ${line} ${m.label}`,
        opp: nextOpp,
        rank, tier, rankLabel: wnbaDefCategoryLabel(m.id),
        l5: hitRateWindow(values, 5, hit),
        l10: hitRateWindow(values, 10, hit),
        l20: hitRateWindow(values, 20, hit),
        all: hitRateWindow(values, "all", hit),
        values, line, isBinary, variance,
        direction: "over", matchupScore: rank,
        recent: feedRecentGames(games, values),
        // How a saved pick off this row gets settled later -- see gradePick.
        // Real ESPN game logs on the live 2026 season, so these are gradable.
        gradeKind: "wnba", gradeId: player.espnId,
      });
    });
  });
  return rows;
}

const NFL_MARKET_CATEGORY = {
  passYds: "Passing", passTd: "Passing", passAtt: "Passing", passRushYds: "Passing", comp: "Passing", int: "Passing",
  rushYds: "Rushing", rushAtt: "Rushing",
  rec: "Receiving", recYds: "Receiving", longRec: "Receiving", scrim: "Receiving",
  anytimeTd: "Touchdowns",
  fgm: "Kicking", fga: "Kicking", xpm: "Kicking", kickPts: "Kicking",
};
const NFL_FEED_CATEGORIES = ["All", "Passing", "Rushing", "Receiving", "Touchdowns", "Kicking"];

const MLB_MARKET_CATEGORY = {
  h: "Core", r: "Core", rbi: "Core", hrrbi: "Core",
  hr: "Power", tb: "Power",
  bb: "Discipline", so: "Discipline", sb: "Discipline",
  p_k: "Pitching", p_outs: "Pitching", p_er: "Pitching", p_h: "Pitching", p_bb: "Pitching",
};
const MLB_FEED_CATEGORIES = ["All", "Core", "Power", "Discipline", "Pitching"];

// Groups a sport's full market list under its existing *_FEED_CATEGORIES
// labels ("All" dropped -- it's not a real group) using the matching
// *_MARKET_CATEGORY map, so the prop picker's grouped list is derived from
// data that already exists rather than a second, easy-to-drift copy of it.
function buildPropGroups(markets, categoryMap, categoryOrder) {
  return categoryOrder
    .filter((label) => label !== "All")
    .map((label) => ({ label, markets: markets.filter((m) => categoryMap[m.id] === label) }))
    .filter((g) => g.markets.length > 0);
}

// The prop-type picker's grouped list (see PropTypePicker) for each sport --
// built once at module load, not per-render. NFL/WNBA rows already filter
// their applicable markets per-player (position for NFL, DD/TD eligibility
// for WNBA), so the *unfiltered* full market list here just determines what
// the picker offers to search/browse; buildNFLFeedRows/buildWNBAFeedRows
// naturally return zero rows for a market a given player doesn't have.
const PROP_GROUPS = {
  nba: buildPropGroups(MARKETS, NBA_MARKET_CATEGORY, NBA_FEED_CATEGORIES),
  wnba: buildPropGroups(WNBA_MARKETS, WNBA_MARKET_CATEGORY, WNBA_FEED_CATEGORIES),
  nfl: buildPropGroups(NFL_MARKETS, NFL_MARKET_CATEGORY, NFL_FEED_CATEGORIES),
  mlb: buildPropGroups([...MLB_MARKETS, ...MLB_PITCHER_MARKETS], MLB_MARKET_CATEGORY, MLB_FEED_CATEGORIES),
};

// A handful of the most-searched props per sport, pinned as one-tap chips
// below the picker's trigger so the common case never needs the dropdown.
const PROP_QUICK_PICKS = {
  mlb: ["h", "hr", "tb", "r"],
  nba: ["pts", "reb", "ast", "pra"],
  wnba: ["pts", "reb", "ast", "pra"],
  nfl: ["passYds", "rushYds", "recYds", "anytimeTd"],
};

// Searchable grouped dropdown of every real market for the active sport,
// plus pinned quick-pick chips underneath -- replaces the old flat category
// chip row (All/Core/Power/...), which filtered down to a *bucket* of
// markets rather than letting the user land on one real prop directly.
// `fill` makes the trigger span its container instead of hugging its label --
// used by the phone control block, where it shares one line with the Filters
// button and needs to take whatever space is left over.
function PropTypePicker({ groups, value, onChange, fill = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = React.useDeferredValue(search);
  const panelRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const allMarkets = useMemo(() => groups.flatMap((g) => g.markets), [groups]);
  const activeMarket = allMarkets.find((m) => m.id === value);
  const q = deferredSearch.trim().toLowerCase();
  const visibleGroups = q
    ? groups
        .map((g) => ({ ...g, markets: g.markets.filter((m) => m.label.toLowerCase().includes(q)) }))
        .filter((g) => g.markets.length > 0)
    : groups;
  // "All" only makes sense against an empty search -- filtering to "props
  // matching my search" and also offering "show every prop" in the same
  // list would be a contradiction.
  const showAllOption = !q;

  return (
    <div ref={panelRef} style={{ position: "relative", display: fill ? "block" : "inline-block" }}>
      <button
        type="button"
        className="oswald"
        onClick={() => setOpen((v) => !v)}
        style={{
          cursor: "pointer", padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700,
          border: `1px solid ${open ? "var(--amber)" : "var(--line)"}`,
          background: open ? "var(--amber-dim)" : "var(--panel)",
          color: open ? "var(--amber)" : "var(--text)",
          display: "flex", alignItems: "center", gap: 8,
          ...(fill ? { width: "100%", boxSizing: "border-box", justifyContent: "space-between" } : null),
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value === "all" ? "All Props" : activeMarket ? activeMarket.label : "Choose a prop"}
        </span>
        <span className="mono" style={{ fontSize: 10, color: "var(--dim)" }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20,
            width: "min(300px, 88vw)", maxHeight: 360, overflowY: "auto",
            background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ padding: 8, position: "sticky", top: 0, background: "var(--panel2)", borderBottom: "1px solid var(--line)" }}>
            <input
              className="select"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search props…"
              autoFocus
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
          {showAllOption && (
            <div
              role="button"
              onClick={() => { onChange("all"); setOpen(false); }}
              style={{
                padding: "9px 12px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                color: value === "all" ? "var(--amber)" : "var(--text)",
                background: value === "all" ? "var(--amber-dim)" : "transparent",
                borderBottom: "1px solid var(--line)",
              }}
            >
              All Props
            </div>
          )}
          {visibleGroups.map((g) => (
            <div key={g.label}>
              <div style={{ padding: "8px 12px 3px", fontSize: 10.5, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {g.label}
              </div>
              {g.markets.map((m) => (
                <div
                  key={m.id}
                  role="button"
                  onClick={() => { onChange(m.id); setOpen(false); setSearch(""); }}
                  style={{
                    padding: "8px 12px", cursor: "pointer", fontSize: 13,
                    color: m.id === value ? "var(--amber)" : "var(--text)",
                    background: m.id === value ? "var(--amber-dim)" : "transparent",
                  }}
                >
                  {m.label}
                </div>
              ))}
            </div>
          ))}
          {!showAllOption && !visibleGroups.length && (
            <div style={{ padding: 14, fontSize: 12, color: "var(--dim)", textAlign: "center" }}>No matching props.</div>
          )}
        </div>
      )}
    </div>
  );
}

// Shared chrome for the app's floating game pickers. Both the single-select
// (GameSelect) and the multi-select (GamesMultiSelect) render into it, so the
// two controls can't drift into looking like unrelated widgets.
const DROPDOWN_PANEL_STYLE = {
  position: "absolute", top: "calc(100% + 6px)", zIndex: 20,
  width: "min(320px, 88vw)", maxHeight: 400, overflowY: "auto",
  background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 10,
  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
};

// Sticky group heading inside a picker panel ("Sunday, September 13"), so the
// date a game belongs to stays on screen while its group is scrolled through.
const DROPDOWN_GROUP_STYLE = {
  position: "sticky", top: 0, zIndex: 1,
  padding: "8px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
  textTransform: "uppercase", color: "var(--dim)", background: "var(--panel2)",
  borderBottom: "1px solid var(--line)",
};

// Centers a dropdown panel under its trigger, then nudges it back inside the
// viewport when centering alone would push an edge off-screen. These panels
// used to anchor at `left: 0`, which is fine under a left-aligned trigger but
// not under the centered ones these pages use -- a 320px panel hanging off a
// mid-screen trigger ran past the right edge of a phone, clipping the
// checkmarks off every row.
function useCenteredPanel(open) {
  const floatRef = React.useRef(null);
  const [shift, setShift] = useState(0);

  React.useLayoutEffect(() => {
    if (!open) {
      setShift(0);
      return;
    }
    const measure = () => {
      const el = floatRef.current;
      if (!el) return;
      // Measured with any previous nudge removed, so each correction is
      // computed from the true centered position rather than compounding on
      // top of the last one as the viewport changes.
      const prev = el.style.transform;
      el.style.transform = "translateX(-50%)";
      const rect = el.getBoundingClientRect();
      el.style.transform = prev;
      const gutter = 8;
      if (rect.left < gutter) setShift(gutter - rect.left);
      else if (rect.right > window.innerWidth - gutter) setShift(window.innerWidth - gutter - rect.right);
      else setShift(0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  return { floatRef, anchorStyle: { left: "50%", transform: `translateX(calc(-50% + ${shift}px))` } };
}

// The green circled tick marking a chosen row.
function SelectedCheck() {
  return (
    <span style={{
      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
      background: "var(--green)", color: "#08131c",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900,
    }}>
      ✓
    </span>
  );
}

// One game in a picker panel: both teams' logos overlapped into a single mark,
// the start time, and the matchup name. Shared so the single- and multi-select
// panels list a game identically.
function GameOptionRow({ logoFn, teams, time, label, onClick, indicator, highlight }) {
  return (
    <div
      role="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer",
        background: highlight ? "var(--amber-dim)" : "transparent",
      }}
    >
      {logoFn && teams && (
        <div style={{ display: "flex", flexShrink: 0 }}>
          <img src={logoFn(teams[0])} alt="" width={20} height={20} style={{ objectFit: "contain", borderRadius: "50%", background: "var(--panel)" }} />
          <img src={logoFn(teams[1])} alt="" width={20} height={20} style={{ objectFit: "contain", borderRadius: "50%", background: "var(--panel)", marginLeft: -6, border: "1.5px solid var(--panel2)" }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {time && <div className="mono" style={{ fontSize: 10.5, color: "var(--dim)" }}>{time}</div>}
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</div>
      </div>
      {indicator}
    </div>
  );
}

// Single-game picker for the sport pages, in place of the native <select> with
// <optgroup>s they used to render. A native select can't show logos or kickoff
// times -- mobile Safari draws it as a plain text list -- so the same slate that
// reads clearly in the Prop Feed's GAMES popover was reduced to bare matchup
// names here. Takes the grouped shape groupMatchupsByDate returns, so the
// date headings survive the switch.
// `emptyLabel` covers the case where the slate hasn't arrived yet -- MLB's
// games are fetched live, so its dropdown has a real loading state that the
// static NFL/WNBA/NBA slates don't.
function GameSelect({ groups, value, onChange, logoFn, compact, emptyLabel }) {
  const [open, setOpen] = useState(false);
  const wrapRef = React.useRef(null);
  const { floatRef, anchorStyle } = useCenteredPanel(open);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Each side's abbreviation lives on its roster's first player, the same way
  // NFL_TEAM_ROSTERS is keyed. Guarded because the WNBA slate is built live
  // from ESPN and looks its rosters up by abbreviation
  // (WNBA_TEAM_PLAYERS_BY_ABBR), so a team we have no roster for yields an
  // empty side. That used to surface only when you picked that game; here it
  // runs for every row, so an unguarded read would take the whole panel down
  // rather than just dropping one row's logos.
  //
  // MLB is the exception and gets the first branch: its slate is built live
  // from the day's schedule (see matchupOptions in MLBPropsPage) and already
  // carries the [away, home] pair directly, with no teamA/teamB rosters to
  // read through. Supporting that shape here is what lets MLB use this
  // component instead of the plain <select> it had, which was the only sport
  // page without team logos in its dropdown.
  const teamsOf = (m) => {
    if (Array.isArray(m.teams) && m.teams.length === 2 && m.teams.every(Boolean)) return m.teams;
    const abbr = (side) => side?.players?.[0]?.team;
    const pair = [abbr(m.teamA), abbr(m.teamB)];
    return pair.every(Boolean) ? pair : null;
  };
  // Same idea for the start time: MLB pre-formats it (it has to, because a
  // doubleheader needs a "Gm 1"/"Gm 2" suffix that a raw date can't express),
  // while the other sports carry a date for this to format.
  const timeOf = (m) => m.time || matchupTimeLabel(m.date);
  const current = groups.flatMap((g) => g.matchups).find((m) => m.id === value);
  const currentTeams = current ? teamsOf(current) : null;

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", display: compact ? "block" : "inline-block", width: compact ? "100%" : "auto" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          cursor: "pointer", padding: "7px 12px", borderRadius: 6, fontSize: 15, width: "100%",
          fontFamily: "inherit",
          border: `1px solid ${open ? "var(--amber)" : "var(--line)"}`,
          background: open ? "var(--amber-dim)" : "var(--panel)",
          color: "var(--text)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {currentTeams && logoFn && (
          <span style={{ display: "flex", flexShrink: 0 }}>
            <img src={logoFn(currentTeams[0])} alt="" width={18} height={18} style={{ objectFit: "contain", borderRadius: "50%", background: "var(--panel)" }} />
            <img src={logoFn(currentTeams[1])} alt="" width={18} height={18} style={{ objectFit: "contain", borderRadius: "50%", background: "var(--panel)", marginLeft: -5, border: "1.5px solid var(--panel)" }} />
          </span>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {current ? current.label : emptyLabel || "Select a game"}
        </span>
        <span className="mono" style={{ fontSize: 10, color: "var(--dim)", flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div ref={floatRef} style={{ ...DROPDOWN_PANEL_STYLE, ...anchorStyle }}>
          {groups.map((group) => (
            <div key={group.label}>
              <div className="oswald" style={DROPDOWN_GROUP_STYLE}>{group.label}</div>
              {group.matchups.map((m) => (
                <GameOptionRow
                  key={m.id}
                  logoFn={logoFn}
                  teams={teamsOf(m)}
                  time={timeOf(m)}
                  label={m.label}
                  highlight={m.id === value}
                  indicator={m.id === value ? <SelectedCheck /> : null}
                  onClick={() => {
                    onChange(m);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Multi-select popover for the day's/week's games -- replaces the old single
// MATCHUP <select> so a user researching "everyone playing tonight except
// the early games" isn't limited to one game at a time. An empty `selected`
// set means "all games", matching the old dropdown's "all" option.
function GamesMultiSelect({ options, selected, onChange, allLabel, logoFn, fill = false }) {
  const [open, setOpen] = useState(false);
  const panelRef = React.useRef(null);
  const { floatRef, anchorStyle } = useCenteredPanel(open);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const label = selected.size === 0 ? allLabel : `${selected.size} game${selected.size > 1 ? "s" : ""}`;

  return (
    <div ref={panelRef} style={{ position: "relative", display: fill ? "block" : "inline-block" }}>
      <button
        type="button"
        className="oswald"
        onClick={() => setOpen((v) => !v)}
        style={{
          cursor: "pointer", padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700,
          border: `1px solid ${open ? "var(--amber)" : "var(--line)"}`,
          background: open ? "var(--amber-dim)" : "var(--panel)",
          color: open ? "var(--amber)" : "var(--text)",
          display: "flex", alignItems: "center", gap: 8,
          ...(fill ? { width: "100%", boxSizing: "border-box", justifyContent: "space-between" } : null),
        }}
      >
        {label}
        <span className="mono" style={{ fontSize: 10, color: "var(--dim)" }}>▾</span>
      </button>
      {open && (
        <div ref={floatRef} style={{ ...DROPDOWN_PANEL_STYLE, ...anchorStyle }}>
          <div className="oswald" style={{ padding: "10px 12px 8px", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            Games
          </div>
          <div
            role="button"
            onClick={() => onChange(new Set())}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              padding: "10px 12px", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--text)",
              borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
            }}
          >
            {allLabel}
            {selected.size === 0 && <SelectedCheck />}
          </div>
          {options.map((o) => {
            const checked = selected.has(o.id);
            return (
              <GameOptionRow
                key={o.id}
                logoFn={logoFn}
                teams={o.teams}
                time={o.time}
                label={o.label}
                highlight={checked}
                onClick={() => {
                  const next = new Set(selected);
                  if (checked) next.delete(o.id); else next.add(o.id);
                  onChange(next);
                }}
                indicator={
                  <span style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: `1.5px solid ${checked ? "var(--amber)" : "var(--line-strong)"}`,
                    background: checked ? "var(--amber)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {checked && <span style={{ fontSize: 11, color: "var(--accent-on)", fontWeight: 900 }}>✓</span>}
                  </span>
                }
              />
            );
          })}
          <div style={{ padding: "8px 12px", borderTop: "1px solid var(--line)" }}>
            <div className="chip" style={{ textAlign: "center" }} onClick={() => setOpen(false)}>Close</div>
          </div>
        </div>
      )}
    </div>
  );
}

// The slate, spelled out. Without this the only way to see which games the feed
// is drawn from is to open the GAMES dropdown, which means the answer to "what's
// on today" costs a click and hides the table while you read it.
//
// Takes the same `options` array the dropdown does (see mlbMatchupOptions) and
// writes back through the same setSelectedGameIds -- there is deliberately no
// second slate source and no second filtering path, so the two controls can't
// drift apart. Sport-agnostic on purpose: NFL/NBA/WNBA only need another call
// site with a different logoFn.
function TodaysGamesStrip({ options, selected, onChange, logoFn }) {
  const scrollRef = React.useRef(null);
  const activeRef = React.useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < maxScroll - 2);
  };

  // Same rAF-plus-timer dance as TeammateChipRow: measuring synchronously
  // reports scrollWidth === clientWidth because the team logos haven't laid out
  // yet, which would leave the right arrow hidden on a row that very much does
  // scroll. The timer covers tabs that aren't compositing (no rAF fires there
  // at all), and the observer keeps the arrows honest across resizes.
  React.useEffect(() => {
    const raf = requestAnimationFrame(updateScrollState);
    const timer = setTimeout(updateScrollState, 80);
    const el = scrollRef.current;
    const ro = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollState) : null;
    if (ro) ro.observe(el);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); if (ro) ro.disconnect(); };
  }, [options.length]);

  // Where a smooth scroll is currently headed, so a second click chains onto the
  // first instead of re-measuring a scrollLeft that is still mid-animation --
  // otherwise an impatient double-click computes the same destination twice and
  // the rail moves one step for two clicks. Cleared once the animation lands (or
  // shortly after, if it was interrupted by a drag or the wheel).
  const pendingScrollRef = React.useRef(null);
  const pendingTimerRef = React.useRef(null);

  React.useEffect(() => () => clearTimeout(pendingTimerRef.current), []);

  // Roughly two cards a click -- far enough to feel like progress, short enough
  // that you can still see where you came from. Anything landing within a card's
  // width of either end goes the whole way instead: stopping a few pixels short
  // leaves the arrow lit for one more click that visibly does nothing.
  const scrollBy = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const from = pendingScrollRef.current == null ? el.scrollLeft : pendingScrollRef.current;
    let target = from + dir * Math.max(240, el.clientWidth * 0.6);
    if (target > maxScroll - 48) target = maxScroll;
    if (target < 48) target = 0;
    pendingScrollRef.current = target;
    clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => { pendingScrollRef.current = null; }, 500);
    el.scrollTo({ left: target, behavior: "smooth" });
  };

  // Only one game selected means the user narrowed to it -- probably from the
  // dropdown, where the card in question can easily be off-screen. Two or more
  // is a multi-game view with no single card to favour, so leave the scroll
  // position alone. block:"nearest" keeps this from yanking the page vertically.
  const soleSelectedId = selected.size === 1 ? [...selected][0] : null;
  React.useEffect(() => {
    if (!soleSelectedId || !activeRef.current || !scrollRef.current) return;
    activeRef.current.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [soleSelectedId]);

  if (options.length === 0) return null;

  // Arrows sit in their own gutters beside the rail rather than floating over
  // the cards -- an arrow parked on top of a game card both hides the matchup
  // and steals the click that was meant for it.
  //
  // Both gutters stay mounted whatever the scroll position, fading rather than
  // unmounting. Two reasons: the cards don't reflow out from under the cursor
  // mid-scroll, and the scroller's clientWidth stays constant, so the overflow
  // measurement can't feed back into its own result (mounting an arrow narrows
  // the rail, which can create the very overflow that mounted the arrow).
  // Box, colours and layout live on .slate-arrow in index.css -- only the
  // enabled/disabled state is inline. Keeping `display` out of here is what lets
  // the phone media query drop the arrows at all; an inline display would
  // outrank the class and the gutters would survive on a 375px screen.
  const arrowStyle = (enabled) => ({
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0,
    pointerEvents: enabled ? "auto" : "none",
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
    <div className="slate-arrow" role="button" aria-label="Scroll games left" aria-hidden={!canScrollLeft} onClick={() => scrollBy(-1)} style={arrowStyle(canScrollLeft)}>‹</div>
    <div
      ref={scrollRef}
      onScroll={updateScrollState}
      className="slate-scroll"
      style={{ flex: 1, minWidth: 0, gap: 8, paddingBottom: 6 }}
    >
      {options.map((o) => {
        const isSelected = selected.has(o.id);
        // Exclusive jump rather than the dropdown's additive toggle: a one-tap
        // strip reads as "show me this game", and clicking the game you're
        // already on is the obvious way back to the full slate. Stacking games
        // is still available in the dropdown.
        const activate = () => onChange(isSelected && selected.size === 1 ? new Set() : new Set([o.id]));
        return (
          <div
            key={o.id}
            ref={isSelected && o.id === soleSelectedId ? activeRef : null}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`${o.label}${o.note ? `, ${o.note}` : ""}, ${slateTimeLabel(o.startsAt)}`}
            onClick={activate}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                activate();
              }
            }}
            style={{
              display: "flex", alignItems: "center", gap: 8, flexShrink: 0, cursor: "pointer",
              padding: "7px 12px", borderRadius: "var(--r-md)",
              transition: "background 0.12s ease, border-color 0.12s ease",
              border: `1px solid ${isSelected ? "var(--amber)" : "var(--line)"}`,
              background: isSelected ? "var(--amber-dim)" : "var(--panel)",
            }}
          >
            {logoFn && (
              <div style={{ display: "flex", flexShrink: 0 }}>
                <img src={logoFn(o.teams[0])} alt="" width={20} height={20} style={{ objectFit: "contain", borderRadius: "50%", background: "var(--panel)" }} />
                <img src={logoFn(o.teams[1])} alt="" width={20} height={20} style={{ objectFit: "contain", borderRadius: "50%", background: "var(--panel)", marginLeft: -6, border: "1.5px solid var(--panel2)" }} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
              <div className="oswald" style={{
                fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
                color: isSelected ? "var(--amber)" : "var(--text)",
              }}>
                {o.teams[0]} @ {o.teams[1]}
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--dim)", whiteSpace: "nowrap" }}>
                {slateTimeLabel(o.startsAt)}
                {o.note && ` · ${o.note}`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
    <div className="slate-arrow" role="button" aria-label="Scroll games right" aria-hidden={!canScrollRight} onClick={() => scrollBy(1)} style={arrowStyle(canScrollRight)}>›</div>
    </div>
  );
}

// L5/L10/L20/season hit rate, graded green (favorable) to red (unfavorable) --
// every row already computes all four (see hitRateWindow in each build*FeedRows),
// this just puts all of them on screen together instead of only whichever one
// the global sample-size switcher happens to be set to. The currently-selected
// window is called out in amber so it's still obvious which one is driving the
// row's displayed odds/hit-rate figure and the list's sort order.
const FEED_ROW_SPLITS = [["L5", "l5"], ["L10", "l10"], ["L20", "l20"], ["SZN", "all"]];
function FeedSplitsStrip({ r, sampleWindow, size }) {
  const hrColor = (v) => (v >= 0.55 ? "var(--green)" : v <= 0.45 ? "var(--red)" : "var(--dim)");
  return (
    <div style={{ display: "flex", gap: size === "sm" ? 8 : 10, flexWrap: "wrap" }}>
      {FEED_ROW_SPLITS.map(([label, key]) => {
        const active = key === sampleWindow;
        return (
          <span key={key} className="mono" style={{ fontSize: size === "sm" ? 10 : 10.5, display: "inline-flex", alignItems: "center", gap: 3 }}>
            <span style={{ color: active ? "var(--amber)" : "var(--dim)", fontWeight: active ? 700 : 500 }}>{label}</span>
            <b style={{ color: hrColor(r[key]), fontWeight: 700 }}>{Math.round(r[key] * 100)}%</b>
          </span>
        );
      })}
    </div>
  );
}

// The desktop table's column template is the `.feed-grid` class in
// index.css -- header and every row carry it so cells line up exactly:
// add-button / avatar / proposition / line / odds / L5 / L10 / L20 /
// season / view-chart. It's CSS rather than a template string here
// because the tracks and gaps widen with the viewport (see the media
// query tiers there). All six numeric columns are centered so the gaps
// between them stay even at every width -- see the .feed-grid comment.

// Desktop table header -- Line/Odds/L5/L10/L20/Season are all real sortable
// columns (see PropFeedPage's columnSort state); Outlier's reference layout
// this was modeled on also shows IP%/H2H/prior-season columns, which are
// left out here rather than faked -- there's no real implied-probability
// price or per-row prior-season game log behind this feed's data today.
// `stickyTop` is the measured height of PropFeedPage's sticky filter rail.
// The header pins directly under it rather than at top:0 -- the rail is
// opaque and sits at a higher z-index, so a header pinned to 0 would spend
// the whole scroll hidden behind it.
function FeedTableHeader({ columnSort, onSort, stickyTop = 0 }) {
  const col = (label, key, align = "center") => {
    const active = columnSort?.key === key;
    const justify = align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start";
    return (
      <div
        role="button"
        onClick={() => onSort(key)}
        className="mono"
        style={{
          cursor: "pointer", textAlign: align, color: active ? "var(--amber)" : "var(--dim)",
          fontWeight: active ? 700 : 600, fontSize: 11, display: "flex", alignItems: "center",
          justifyContent: justify, gap: 3, userSelect: "none",
        }}
      >
        {label}
        <span style={{ fontSize: 9 }}>{active ? (columnSort.dir === "desc" ? "↓" : "↑") : "↕"}</span>
      </div>
    );
  };
  return (
    <div
      className="feed-grid feed-thead"
      style={{
        paddingTop: 10, paddingBottom: 10, borderBottom: "1px solid var(--line)",
        textTransform: "uppercase", letterSpacing: "0.04em",
        // `position` is deliberately not set here -- see .feed-thead in
        // index.css. It has to come from a media query, and an inline style
        // would win over one.
        top: stickyTop, zIndex: 3, background: "var(--surface-sunken)",
      }}
    >
      <div /><div />
      <div className="mono" style={{ fontSize: 11, color: "var(--dim)", fontWeight: 600 }}>Proposition</div>
      {/* Not sortable: the strip is ten discrete results, not one value to
           order by -- L5/L10 already sort the same information. */}
      <div className="mono" style={{ fontSize: 11, color: "var(--dim)", fontWeight: 600, textAlign: "center" }}>Form</div>
      {col("Line", "line", "center")}
      {col("Odds", "odds", "center")}
      {col("L5", "l5", "center")}
      {col("L10", "l10", "center")}
      {col("L20", "l20", "center")}
      {col("Season", "all", "center")}
      <div />
    </div>
  );
}

// The row's last ten games as a strip of slim bars, oldest to newest --
// Outlier's reference table puts a flat tick under each percentage for the
// same purpose. This encodes one thing more than a tick does: bar height is
// the game's distance from the line, normalised against the row's own biggest
// margin. So "hit 7 of 10" and "hit 7 of 10, but three of them by a mile"
// stop looking identical, which is exactly what a raw percentage hides.
// Binary markets have no distance to measure, so their bars are full height.
function FeedFormStrip({ r, direction, streak = 0, height = 22, barWidth = 4, gap = 2 }) {
  const recent = r.recent;
  if (!recent || !recent.length) return null;
  const margins = recent.map((g) => Math.abs(g.v - r.line));
  const maxMargin = Math.max(...margins, 1e-6);

  // A streak isn't separate information from this strip -- it *is* the
  // trailing run of same-colored bars. It used to be restated beside the
  // player's name as an "H6" pill, which meant a second chip to decode and a
  // number with no visible connection to the bars it came from. Underlining
  // the run in place and labelling it in words says the same thing where the
  // evidence already is. Clamped to the strip's width: the streak is counted
  // over the full log, so a 14-game run can exceed the ten bars drawn.
  const runLength = Math.min(Math.abs(streak), recent.length);
  const showRun = Math.abs(streak) >= 3;
  const runColor = streak > 0 ? "var(--pos)" : "var(--neg)";
  const stripWidth = recent.length * barWidth + (recent.length - 1) * gap;
  const runWidth = runLength * barWidth + Math.max(0, runLength - 1) * gap;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap, height }}>
        {recent.map((g, i) => {
          const isHit = feedIsHit(g.v, r.line, r.isBinary, direction);
          // Floor of 30% so a game that only just missed the line is still a
          // visible bar rather than a hairline that reads as missing data.
          const frac = r.isBinary ? 1 : 0.3 + 0.7 * (margins[i] / maxMargin);
          return (
            <div
              key={i}
              style={{
                width: barWidth,
                height: Math.max(3, Math.round(height * frac)),
                borderRadius: 1.5,
                background: isHit ? "var(--pos)" : "var(--neg)",
                opacity: 0.45 + 0.55 * ((i + 1) / recent.length),
              }}
            />
          );
        })}
      </div>
      {showRun && (
        <>
          {/* Sits under the trailing bars only, right-aligned like the run
               itself -- the rule is what ties the words below to the games
               above, so it has to line up with them exactly. */}
          <div style={{ width: stripWidth, display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: runWidth, height: 2, borderRadius: 1, background: runColor }} />
          </div>
          {/* Words, not a code. "6 straight" needs no key; the green/red is
               already taught by the bars directly above it. */}
          <div className="mono" style={{ fontSize: 9, fontWeight: 700, color: runColor, whiteSpace: "nowrap", lineHeight: 1 }}>
            {Math.abs(streak)} straight
          </div>
        </>
      )}
    </div>
  );
}

// Hover/tap breakdown behind the form strip -- the ten games it draws, with
// the opponent and date the bars alone can't carry.
//
// Positioned `fixed` against a measured anchor rect rather than `absolute`
// inside the row. Below 900px .feed-table-wrap is `overflow-x: auto`, and
// `auto` on one axis forces the other to `auto` too -- an absolutely
// positioned popover would be clipped by the wrapper at exactly the widths
// where the table layout is most cramped. (Above 900px the wrapper switches
// to `overflow-x: clip`, which doesn't have that side effect.)
function FeedFormPopover({ r, direction, anchor }) {
  const recent = r.recent || [];
  const width = 190;
  // Clamped so a strip near either edge of the viewport doesn't push the
  // panel half off-screen.
  const left = anchor
    ? Math.min(Math.max(8, anchor.left + anchor.width / 2 - width / 2), Math.max(8, window.innerWidth - width - 8))
    : 0;
  // Flips above the strip when there isn't room below it.
  const estHeight = 30 + recent.length * 16;
  const below = !anchor || anchor.bottom + 6 + estHeight < window.innerHeight;
  return (
    <div
      className="panel"
      style={{
        position: "fixed", zIndex: 60,
        left, width,
        ...(below ? { top: (anchor?.bottom || 0) + 6 } : { bottom: window.innerHeight - (anchor?.top || 0) + 6 }),
        padding: "8px 10px",
        boxShadow: "var(--shadow-2)", pointerEvents: "none",
      }}
    >
      <div className="mono" style={{ fontSize: 9.5, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        Last {recent.length} · {r.subtitle}
      </div>
      {recent.slice().reverse().map((g, i) => {
        const isHit = feedIsHit(g.v, r.line, r.isBinary, direction);
        return (
          <div key={i} className="mono" style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 10.5, padding: "2px 0" }}>
            <span style={{ color: "var(--dim)" }}>{feedShortDate(g.date)}</span>
            <span style={{ color: "var(--dim-strong)", flex: 1 }}>{g.opp ? `vs ${g.opp}` : ""}</span>
            <span style={{ color: isHit ? "var(--pos)" : "var(--neg)", fontWeight: 800 }}>{g.v}</span>
          </div>
        );
      })}
    </div>
  );
}

// "2026-08-11" -> "Aug 11". Parsed as a plain date rather than through the
// Date constructor's UTC handling of bare ISO dates, which would shift the
// label back a day for anyone west of UTC.
const FEED_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function feedShortDate(date) {
  if (!date) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date));
  if (!m) return String(date).slice(0, 6);
  return `${FEED_MONTHS[Number(m[2]) - 1] || ""} ${Number(m[3])}`;
}

function FeedPctCell({ v }) {
  const good = v >= 0.55, bad = v <= 0.45;
  // Tint strength scales with distance from 50% (a 95% hit rate reads
  // stronger than a 56% one) instead of one fixed alpha for every
  // "good" cell -- hierarchy comes from the tint itself, not just a
  // threshold. Mixed off --pos/--neg rather than a fixed rgba() so it
  // reads correctly on both a near-black and a white row.
  const strength = Math.min(1, Math.abs(v - 0.5) * 2);
  const alpha = Math.round(10 + strength * 20);
  return (
    <div style={{ textAlign: "center" }}>
      <span className="mono tnum" style={{
        display: "inline-block", padding: "3px 7px", borderRadius: "var(--r-sm)", fontSize: 11.5, fontWeight: 800,
        background: good
          ? `color-mix(in srgb, var(--pos) ${alpha}%, transparent)`
          : bad
          ? `color-mix(in srgb, var(--neg) ${alpha}%, transparent)`
          : "var(--surface-2)",
        color: good ? "var(--pos)" : bad ? "var(--neg)" : "var(--dim-strong)",
      }}>
        {Math.round(v * 100)}%
      </span>
    </div>
  );
}

// Resolves the right team-colors map for teamAvatarBackground() from a
// FeedRow's `sport` prop, so the prop-feed avatar ring uses the same
// gradient treatment as the lineup panel across all four sports.
const FEED_TEAM_COLORS = { nba: NBA_TEAM_COLORS, wnba: WNBA_TEAM_COLORS, nfl: NFL_TEAM_COLORS, mlb: MLB_TEAM_COLORS };

// Availability for a saved pick, read out of whatever the app has already
// fetched this session. Synchronous on purpose: the slip and Ledger are a
// drawer over the current page, not a place to start network requests.
//
// WNBA and MLB are the two sports with a player availability feed, so they are
// the only ones that can return anything here. NBA and NFL return undefined,
// which renders no dot -- deliberately not a green one.
//
// Both caches are only warm once the user has visited that sport's pages this
// session. A cold cache returns undefined, i.e. no dot, which is the correct
// reading: we do not know yet.
function pickStatus(p) {
  if (!p) return undefined;
  if (p.sport === "wnba" && p.espnId) {
    for (const rec of wnbaRosterStatusCache.values()) {
      const st = rec && rec.data && rec.data.byId && rec.data.byId[String(p.espnId)];
      if (st) return st;
    }
    return undefined;
  }
  if (p.sport === "mlb" && p.gradeId) {
    for (const rec of mlbRosterStatusCache.values()) {
      const s = rec && rec.byId && rec.byId[p.gradeId];
      if (!s) continue;
      const badge = MLB_STATUS_BADGES[s.code];
      if (!badge) return "active";
      return badge.tone === "warn" ? "questionable" : "out";
    }
    return undefined;
  }
  return undefined;
}

// One feed row -- player avatar (team logo demoted to a corner badge on it,
// instead of being the only image in the row), name/subtitle/matchup, the
// L5/L10/L20/season splits strip, odds, and the add-to-picks/view-chart
// actions. Memoized since sortedRows re-slices/re-sorts on every filter
// change but most individual row *props* don't change between those
// re-renders -- skips re-rendering rows whose own data is untouched.
// The one definition of a saved pick's identity. It has to be shared, because
// FeedRow uses it to build the pick it writes while PropFeedPage uses it to
// decide whether that pick is already saved (the + vs the ✓) -- when those two
// were built from separate string templates the button silently stopped
// reflecting the slip.
//
// Direction is in the id because an Over and an Under on the same line are
// different bets. The game date is in it so the same player/market on a later
// date is a new pick rather than a collision with a graded one -- without it,
// yesterday's settled Judge Over 0.5 Hits would make today's identical row
// read as already added.
function feedPickId(sport, r) {
  const dir = r.direction === "under" ? "-u" : "";
  const date = r.date ? `@${String(r.date).slice(0, 10)}` : "";
  return `${sport}-${r.key}${dir}${date}`;
}

const FeedRow = React.memo(function FeedRow({ r, sport, status, sampleWindow, isNarrow, isAdded, onTogglePick, onOpenProp, isLast }) {
  // Read from context rather than passed down: this component is memo'd, and
  // a context read still re-renders it when the format changes (memo only
  // short-circuits prop changes), so the whole feed reformats without adding
  // a prop to every row.
  const oddsFormat = useOddsFormat();
  // Filled pill background for a clear favorable/unfavorable read at a
  // glance; "mid" stays neutral so it doesn't compete visually with the
  // amber accent used elsewhere (odds, active toggles) -- but it still
  // needs its own border, since --panel2 is only a shade off from the
  // row's --panel background and was nearly invisible without one.
  const tierBg = r.tier === "soft" ? "var(--green)" : r.tier === "tough" ? "var(--red)" : "var(--neutral-badge-bg)";
  const tierFg = r.tier === "mid" ? "var(--dim-strong)" : "#08131c";
  const tierBorder = r.tier === "mid" ? "1px solid var(--line-strong)" : "none";
  const hrColor = (v) => (v >= 0.55 ? "var(--green)" : v <= 0.45 ? "var(--red)" : "var(--text)");
  const odds = probToAmericanOdds(r[sampleWindow]);
  // Overs keep the original `${sport}-${key}` id so picks saved to
  // localStorage before the Over/Under switcher existed still match; Unders
  // get their own suffix so both sides of the same prop can sit on the slip
  // at once without one masking the other's added state.
  const pickId = feedPickId(sport, r);
  const direction = r.direction || "over";
  const streak = feedStreak(r.values, r.line, r.isBinary, direction);
  const cushion = feedCushion(r.values, r.line, r.isBinary, sampleWindow, direction);
  const [formAnchor, setFormAnchor] = useState(null);
  const avatarSize = isNarrow ? 34 : 40;
  const dotSize = Math.round(avatarSize * 0.3);

  const avatarEl = (
    <div style={{ position: "relative", width: avatarSize, height: avatarSize, flexShrink: 0 }}>
      {/* `backing` is a flat team-color disc behind the photo, inset to the
           same depth as the photo -- it keeps the gradient confined to the
           thin outer ring instead of showing through wherever a headshot has
           transparent padding (common on NFL/NBA/WNBA cutout photos), which
           otherwise reads as a big flat blob instead of a crisp ring. Same
           two-layer treatment as the player-card header avatar. A player with
           no usable photo keeps the ring alone, which still identifies the
           team. */}
      <PlayerAvatar
        name={r.name}
        alt={r.name}
        sport={sport}
        team={r.team}
        colorMap={FEED_TEAM_COLORS[sport]}
        headshotSrc={r.avatar}
        fallbackSrc={r.avatarFallback}
        size={avatarSize}
        inset={2}
        backing={(FEED_TEAM_COLORS[sport] && (FEED_TEAM_COLORS[sport][r.team] || {}).primary) || "#000"}
        shadow="0 2px 8px rgba(0,0,0,0.35)"
        status={status}
        surface="var(--panel)"
        style={{ position: "absolute", inset: 0 }}
      />
      {/* The team logo badge used to sit here, bottom-right. It has been
           removed rather than moved: the avatar's bottom-right corner belongs
           to the availability dot, and the team is already spelled out in text
           beside the player's name, so the logo was the third statement of the
           same fact and the only one competing for the dot's corner. */}
      {/* Lineup status, attached to the player it describes rather than
           spelled out as a "LINEUP"/"PROJ" chip beside his name. It's a
           binary state on one person -- a presence dot on the avatar is the
           conventional way to show that, and it costs the row no horizontal
           space next to OPP RANK. Filled = in the posted batting order,
           hollow = still our projection; both are keyed in the legend above
           the table so neither has to be guessed at.

           MLB batters only: `lineupConfirmed` is undefined on the other
           three sports and on pitcher rows (a *probable* starter is a weaker
           claim), and those render no dot at all. */}
      {typeof r.lineupConfirmed === "boolean" && (
        <span
          title={r.lineupConfirmed
            ? "In today's posted batting order"
            : "Batting order not posted yet — projected lineup"}
          style={{
            position: "absolute", right: -1, top: -1,
            width: dotSize, height: dotSize, borderRadius: "50%",
            boxSizing: "border-box",
            background: r.lineupConfirmed ? "var(--pos)" : "var(--panel)",
            border: r.lineupConfirmed
              ? "1.5px solid var(--panel)"
              : "1.5px solid var(--line-strong)",
            boxShadow: r.lineupConfirmed ? "0 0 0 1px var(--panel)" : "none",
          }}
        />
      )}
    </div>
  );

  const addBtn = (
    <div
      className="oswald"
      role="button"
      onClick={() => onTogglePick({
        id: pickId, sport, name: r.name, team: r.team, subtitle: r.subtitle,
        opp: r.gameLabel ? `${r.opp} · ${r.gameLabel}` : r.opp, odds,
        // Everything below is what the Ledger needs to settle this pick
        // later against the player's own game log (see gradePick). None of
        // it is recoverable from `subtitle`, so it has to be written here
        // -- this is the only place a pick is ever created.
        playerId: r.playerId || null,
        marketId: r.marketId || null,
        line: r.line, isBinary: !!r.isBinary, direction,
        gameDate: r.date || null,
        gameId: r.gameId || null,
        gradeKind: r.gradeKind || null,
        gradeId: r.gradeId || null,
        // Identity for the slip/Ledger avatar. The photo URL is snapshotted
        // rather than rebuilt later because each sport resolves it from a
        // different id (mlbId / nbaId / espnId / a static NFL map) and the
        // Ledger has no sport-specific code. Picks saved before this existed
        // simply have no photo and fall back to the team gradient, which is
        // the correct read rather than a wrong face.
        espnId: r.espnId || null,
        avatar: r.avatar || null,
        avatarFallback: r.avatarFallback || null,
        addedAt: Date.now(),
        marketLabel: r.marketLabel || null,
        // A snapshot of what the row actually said at the moment it was
        // added, so the Report can explain a pick without re-deriving it from
        // a feed that has since moved on (lines move, form changes, and MLB
        // rebuilds these rows every day). Deliberately just the scalars the
        // Report reads -- not `values`, which would put a full game log per
        // pick into localStorage.
        snap: {
          l5: r.l5, l10: r.l10, l20: r.l20, all: r.all,
          rank: r.rank, tier: r.tier, streak, cushion,
          cushionWindow: sampleWindow,
          lineupConfirmed: typeof r.lineupConfirmed === "boolean" ? r.lineupConfirmed : null,
        },
      })}
      title={isAdded ? "Remove from My Picks" : "Add to My Picks slip"}
      style={{
        cursor: "pointer",
        flexShrink: 0,
        width: 36, height: 36,
        borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 17, fontWeight: 700,
        border: `1.5px solid ${isAdded ? "var(--green)" : "var(--amber)"}`,
        color: isAdded ? "var(--green)" : "var(--amber)",
        background: isAdded ? "rgba(76,175,125,0.16)" : "var(--amber-dim)",
        boxShadow: isAdded ? "0 0 0 3px rgba(76,175,125,0.12)" : "0 2px 8px rgba(0,0,0,0.25), 0 0 0 3px var(--amber-dim)",
        transition: "all .15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px) scale(1.06)";
        if (!isAdded) e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3), 0 0 0 4px var(--amber-dim)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        if (!isAdded) e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25), 0 0 0 3px var(--amber-dim)";
      }}
    >
      {isAdded ? "✓" : "+"}
    </div>
  );
  // Name + proposition as a secondary way into the chart. "View Chart" stays
  // the primary, obvious control -- this is the shortcut people reach for
  // without being told, because the player's name is the thing they're
  // actually thinking about. Kept visually quiet for that reason: no link
  // colouring, just an underline on hover/focus, so it never competes with
  // the button for attention.
  //
  // Guarded on playerId for the same reason chartBtn is: a row with no player
  // page behind it must not look clickable.
  const openChart = r.playerId
    ? () => onOpenProp(sport, r.playerId, r.marketId, { name: r.name, team: r.team })
    : null;

  const propositionBlock = (
    <div
      className={openChart ? "feed-prop-link" : undefined}
      onClick={openChart || undefined}
      // Enter/Space and a real tab stop, so this shortcut is reachable
      // without a mouse -- a div with role="button" that can't be focused
      // announces itself as a button to a screen reader and then refuses to
      // behave like one.
      onKeyDown={openChart ? (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openChart(); }
      } : undefined}
      role={openChart ? "button" : undefined}
      tabIndex={openChart ? 0 : undefined}
      title={openChart ? `Open ${r.name}'s chart on the ${sport.toUpperCase()} Props page` : undefined}
      style={{ minWidth: 0, cursor: openChart ? "pointer" : "default" }}
    >
      <div className="oswald feed-prop-link-name" style={{ fontSize: isNarrow ? 14.5 : 14, color: "var(--text)" }}>
        {r.name} <span style={{ color: "var(--dim)", fontWeight: 400 }}>({r.team})</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--amber)", fontWeight: 600, marginTop: 1 }}>
        {r.subtitle}
      </div>
    </div>
  );

  const chartBtn = r.playerId && (
    <div
      className="oswald cta-btn"
      onClick={() => onOpenProp(sport, r.playerId, r.marketId, { name: r.name, team: r.team })}
      title={`Open ${r.name}'s chart on the ${sport.toUpperCase()} Props page`}
      style={{
        cursor: "pointer",
        flexShrink: 0,
        // Hugs its own text instead of stretching to fill the grid track,
        // so the button stays a consistent size as the column widens and
        // the row still ends on a clean right edge. (No effect in the
        // narrow layout, where this sits in a flex row.)
        justifySelf: "end",
        textAlign: "center",
        padding: "8px 12px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.02em",
        border: "1px solid var(--amber)",
        color: "var(--amber)",
        background: "var(--amber-dim)",
        whiteSpace: "nowrap",
      }}
    >
      View Chart →
    </div>
  );
  const oddsBlock = (
    <div style={{ textAlign: isNarrow ? "left" : "right", flexShrink: 0 }}>
      <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
        {formatOdds(odds, oddsFormat)}
      </div>
      <div
        className="mono"
        title={`Hit rate over the trailing ${sampleWindow.slice(1)} games`}
        style={{ fontSize: 13, marginTop: 6, fontWeight: 700, color: hrColor(r[sampleWindow]) }}
      >
        {Math.round(r[sampleWindow] * 100)}%
        <span style={{ color: "var(--dim)", fontWeight: 600, fontSize: 11 }}> ({sampleWindow.toUpperCase()})</span>
      </div>
    </div>
  );
  const oppRankLine = (
    // Wraps as whole chips rather than mid-label: the Form column narrowed
    // the Proposition track enough that "OPP RANK" itself was breaking across
    // two lines once the streak and lineup badges joined the row.
    <div style={{ fontSize: 10.5, color: "var(--dim-strong)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "3px 6px" }}>
      <span style={{ whiteSpace: "nowrap" }}>OPP RANK</span>
      <span
        className="mono"
        title={`#${r.rank} in ${r.rankLabel}`}
        style={{
          display: "inline-block", padding: "1px 6px", borderRadius: 4,
          fontSize: 10.5, fontWeight: 800, letterSpacing: 0,
          background: tierBg, color: tierFg, border: tierBorder,
        }}
      >
        #{r.rank}
      </span>
      {/* "Gm 1"/"Gm 2" only on a doubleheader, where the same two teams
           otherwise produce two visually identical rows per prop. */}
      <span style={{ whiteSpace: "nowrap" }}>vs {r.opp}{r.gameLabel ? ` · ${r.gameLabel}` : ""}</span>
    </div>
  );

  // The popover is `fixed`, so it needs the strip's viewport rect rather than
  // a positioned ancestor -- measured on open (and cleared on close) instead
  // of tracked continuously, since it only lives as long as the hover does.
  const openForm = (e) => setFormAnchor(e.currentTarget.getBoundingClientRect());
  const formCell = r.recent && r.recent.length > 0 && (
    <div
      style={{ display: "flex", justifyContent: "center" }}
      onMouseEnter={openForm}
      onMouseLeave={() => setFormAnchor(null)}
      onClick={(e) => setFormAnchor((a) => (a ? null : e.currentTarget.getBoundingClientRect()))}
      title={`Last ${r.recent.length} games — bar height is the margin against the line`}
    >
      <FeedFormStrip r={r} direction={direction} streak={streak} />
      {formAnchor && <FeedFormPopover r={r} direction={direction} anchor={formAnchor} />}
    </div>
  );

  // Narrow screens stack into rows (name/team, opp rank, splits, odds+actions)
  // instead of squeezing everything into one row -- that forced the player
  // name to wrap onto 2-3 lines and left the action buttons cramped/overlapping.
  if (isNarrow) {
    return (
      <div
        className="feed-row"
        style={{
          display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px",
          borderBottom: isLast ? "none" : "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {avatarEl}
          <div style={{ flex: 1, minWidth: 0 }}>
            {propositionBlock}
          </div>
        </div>
        {oppRankLine}
        {/* No Form column to slot into on a phone, so the strip rides
             alongside the splits instead of getting its own stacked row. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <FeedSplitsStrip r={r} sampleWindow={sampleWindow} size="sm" />
          {formCell}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          {oddsBlock}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {addBtn}
            {chartBtn}
          </div>
        </div>
      </div>
    );
  }

  // Desktop: a real table row, grid-aligned against FeedTableHeader's exact
  // column template -- replaces the old flex card (name block + a single
  // combined odds/hit-rate block) so Line/Odds/L5/L10/L20/Season each get
  // their own aligned, independently sortable column.
  return (
    <div
      className="feed-row feed-grid"
      style={{
        paddingTop: 10, paddingBottom: 10,
        borderBottom: isLast ? "none" : "1px solid var(--line)",
      }}
    >
      {addBtn}
      {avatarEl}
      <div style={{ minWidth: 0 }}>
        {propositionBlock}
        {/* Outside the clickable block on purpose -- the opponent rank is
            reference information, not part of the proposition, and including
            it would make the click target sprawl over most of the row. */}
        <div style={{ marginTop: 3 }}>{oppRankLine}</div>
      </div>
      {formCell || <div />}
      {/* Centered, like the four percentage cells that follow -- see
           FeedTableHeader for why mixing center and right alignment across
           these six columns is what made the gaps read as uneven. */}
      <div style={{ textAlign: "center" }}>
        <div className="mono" style={{ fontSize: 13, color: "var(--text)" }}>{r.line}</div>
        {cushion !== null && (
          <div
            className="mono"
            title={`Averages ${cushion >= 0 ? "clear" : "short of"} the line by ${Math.abs(cushion).toFixed(1)} over the ${sampleWindow.toUpperCase()} sample`}
            style={{ fontSize: 10, fontWeight: 700, marginTop: 2, color: cushion >= 0 ? "var(--pos)" : "var(--neg)" }}
          >
            {cushion >= 0 ? "+" : "−"}{Math.abs(cushion).toFixed(1)}
          </div>
        )}
      </div>
      <div className="mono" style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{formatOdds(odds, oddsFormat)}</div>
      <FeedPctCell v={r.l5} />
      <FeedPctCell v={r.l10} />
      <FeedPctCell v={r.l20} />
      <FeedPctCell v={r.all} />
      {chartBtn}
    </div>
  );
});

// Same idea as the NFL feed's per-market defensive ranking, applied to both
// sides of the ball: for batter props this is the opponent pitching staff's
// rate allowed in that category; for pitcher props (p_*) it's the opposing
// lineup's rate produced against that category. Either way, one team's
// hits-allowed and home-runs-allowed are different numbers in reality, so
// the OPP RANK badge shouldn't reuse one overall run-prevention rating for
// every market.
const MLB_MARKET_DEF_RANGE = {
  h: [8.6, 2.0], r: [4.3, 1.6], rbi: [4.1, 1.6], hrrbi: [8.0, 2.4],
  hr: [1.1, 0.7], tb: [14.5, 3.5],
  bb: [3.1, 1.4], so: [8.4, 2.6], sb: [0.5, 0.5],
  p_k: [8.0, 2.6], p_outs: [16.5, 3.5], p_er: [3.6, 1.6], p_h: [7.8, 2.2], p_bb: [2.9, 1.3],
};
const MLB_MARKET_DEF_LABEL = {
  h: "hits allowed", r: "runs allowed", rbi: "RBI allowed", hrrbi: "H+R+RBI allowed",
  hr: "home runs allowed", tb: "total bases allowed",
  bb: "walks allowed", so: "strikeout rate forced", sb: "steals allowed",
  p_k: "opponent strikeout rate", p_outs: "opponent at-bat efficiency",
  p_er: "opponent run production", p_h: "opponent contact rate", p_bb: "opponent plate discipline",
};

const mlbDefCategoryCache = {};
function getMLBDefRank(market, opp) {
  const range = MLB_MARKET_DEF_RANGE[market];
  if (!range) return MLB_TEAM_DEF[opp];
  if (!mlbDefCategoryCache[market]) {
    const seed = 6300 + (hashStr(market) % 5000);
    mlbDefCategoryCache[market] = buildDefenseCategoryFor(MLB_TEAMS, seed, range[0], range[1]);
  }
  return mlbDefCategoryCache[market][opp];
}
function mlbDefCategoryLabel(market) {
  return MLB_MARKET_DEF_LABEL[market] || "run prevention";
}

// Hit rate over the trailing n games (or the whole sample for n === "all"),
// falling back gracefully when a player has fewer than n games logged.
function hitRateWindow(values, n, hit) {
  const w = n === "all" ? values : values.slice(-n);
  if (!w.length) return 0;
  return w.filter(hit).length / w.length;
}

// The last n games as {v, opp, date}, for the row's recent-form strip and its
// hover breakdown. Deliberately capped rather than carrying the whole log:
// MLB builds a row per player x market (thousands of rows), and the strip only
// ever draws ten. `values` is index-aligned with `games` in every builder.
const FEED_FORM_GAMES = 10;
function feedRecentGames(games, values, n = FEED_FORM_GAMES) {
  const start = Math.max(0, values.length - n);
  return values.slice(start).map((v, i) => {
    const g = games[start + i] || {};
    return { v, opp: g.opp, date: g.date };
  });
}

// True when a game's value wins the bet, for whichever side is displayed.
// Binary markets (double-double/triple-double) have no line to clear -- the
// stat is already 1/0 -- so "Under" on one of those means it didn't happen.
function feedIsHit(v, line, isBinary, direction) {
  const over = isBinary ? v === 1 : v > line;
  return direction === "under" ? !over : over;
}

// The current run of consecutive hits (positive) or misses (negative) ending
// at the most recent game. Computed off the row's full `values`, not the
// ten-game `recent` strip, so a 14-game run reports 14 rather than capping
// silently at the strip's width.
function feedStreak(values, line, isBinary, direction) {
  if (!values || !values.length) return 0;
  const first = feedIsHit(values[values.length - 1], line, isBinary, direction);
  let n = 0;
  for (let i = values.length - 1; i >= 0 && feedIsHit(values[i], line, isBinary, direction) === first; i--) n++;
  return first ? n : -n;
}

// Signed average margin against the line over the active sample window --
// "cushion". Two rows can share a 60% hit rate while one clears the line by
// 0.2 and the other by 4; only this separates them. Negative for the losing
// side of the line, and sign-flipped for Unders so positive always means
// "the sample is on this bet's side". Meaningless for binary markets, which
// have no distance-to-line to measure.
function feedCushion(values, line, isBinary, window, direction) {
  if (isBinary || !values || !values.length) return null;
  const n = window === "all" ? values.length : Math.min(values.length, Number(window.slice(1)) || values.length);
  const w = values.slice(-n);
  const avg = w.reduce((a, v) => a + v, 0) / w.length;
  return direction === "under" ? line - avg : avg - line;
}

// Rewrites a feed row to price the *other* side of its line. Rows are built
// Over-only, which hides half the feed: a prop that goes Over 22% of the time
// is an 78% Under, and there was no way to see it.
//
// Flipping the four hit rates is exact rather than approximate. fairFeedLine
// returns `median - 0.5` and binary markets sit at 0.5, so no logged value can
// ever land exactly *on* a line -- there are no pushes, and every game falls
// on one side or the other. That makes `1 - rate` the true Under rate.
//
// Two fields need more than an arithmetic flip:
//  - `tier` drives the OPP RANK badge's green/red. It's inverted here so the
//    color keeps meaning "favorable for the side you're looking at" -- a
//    soft defense is good news for an Over and bad news for an Under.
//  - `rank` itself is left alone: it's a fact about the opponent, and the
//    Defense Rank Range filter reads it. Sorting instead goes through
//    `matchupScore`, negated so "Easiest Matchup" surfaces the toughest
//    defenses first when you're betting Unders.
function flipFeedRowToUnder(r) {
  return {
    ...r,
    direction: "under",
    l5: 1 - r.l5,
    l10: 1 - r.l10,
    l20: 1 - r.l20,
    all: 1 - r.all,
    tier: r.tier === "soft" ? "tough" : r.tier === "tough" ? "soft" : "mid",
    matchupScore: -r.rank,
    subtitle: r.isBinary ? `No ${r.marketLabel}` : `Under ${r.line} ${r.marketLabel}`,
  };
}

// A fair line for the feed's odds column, distinct from the single-player
// pages' default line (ceilToHalfOdd(avg), which rounds up to/above the mean
// on purpose so a dragged-in-place threshold starts just above a player's
// typical output). Using that same ceil-of-average line here meant "Over"
// hit less than half the time on almost every row, so every odds price came
// out positive/underdog. This instead picks the threshold that splits the
// player's own sample close to 50/50 (their median, minus a half step so
// ties count as hits), so a real hot streak still prices as a favorite
// (negative) and a cold one as an underdog (positive), the way a book's line
// actually behaves, instead of every row skewing to the same side.
function fairFeedLine(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted[Math.floor((sorted.length - 1) / 2)];
  return Math.max(0.5, mid - 0.5);
}

// Converts a hit-rate probability into an American odds price, the same
// vig-free implied-probability relationship real sportsbooks approximate.
// Clamped to the +/-1000 band the Prop Feed now enforces as its max odds
// range (see ODDS_PROB_LOW/ODDS_PROB_HIGH) so a displayed number never
// exceeds what the feed actually allows through.
function probToAmericanOdds(p) {
  const prob = Math.min(ODDS_PROB_HIGH, Math.max(ODDS_PROB_LOW, p));
  return prob >= 0.5
    ? Math.round((-100 * prob) / (1 - prob))
    : Math.round((100 * (1 - prob)) / prob);
}
// formatOdds/americanToDecimal/decimalToAmerican now live in odds.js -- see
// the imports at the top of this file. Only formatOdds is format-aware; the
// two converters stay pure American<->decimal maths and are unaffected by the
// display preference.

// Multiplies each leg's decimal odds together for the combined parlay price
// -- the standard way sportsbooks combine independent legs into one payout.
function combineParlayOdds(americanOddsList) {
  if (americanOddsList.length === 0) return null;
  const combinedDecimal = americanOddsList.reduce((acc, o) => acc * americanToDecimal(o), 1);
  return decimalToAmerican(combinedDecimal);
}

// --------------------------------------------------------------------------
// The Ledger: settling saved picks
// --------------------------------------------------------------------------
// Grading needs no new data source. Every pick names a player, a market, a
// line and a direction, so the day after the game its result is a lookup in
// that player's own game log -- the same logs the charts already fetch and
// cache, run through the same statValue* functions the charts already use.
//
// A pick's `gradeKind` decides which log to read; rows that have no real log
// behind them (synthetic NBA, an NFL player with no ESPN id) carry no
// gradeKind at all and are reported as unsettleable rather than guessed at.
// fetchLog receives the pick as well as the id, because NFL logs are fetched
// one season at a time and the season that matters is the one the pick's game
// was played in -- not whatever season is current when the Ledger opens.
const PICK_GRADE_SOURCES = {
  mlb_batter: { fetchLog: (id) => fetchMLBGameLog(id), value: statValueMLB },
  mlb_pitcher: { fetchLog: (id) => fetchMLBPitcherGameLog(id), value: statValueMLBPitcher },
  nfl: { fetchLog: (id, p) => fetchNFLPlayerGameLog(id, nflSeasonForDate(p.gameDate) ?? currentNFLSeason()), value: statValueNFL },
  wnba: { fetchLog: (id) => fetchWNBAPlayerGameLog(id), value: statValue },
};

// Picks saved before the Ledger existed carry only {id, sport, name, team,
// subtitle, opp, odds} -- no marketId, no line, no direction. None of that is
// reliably recoverable from `subtitle`, so rather than drop those picks (or,
// worse, guess a result for them) they're kept and shown as legacy.
function pickIsLegacy(p) {
  return !p || !p.marketId || p.line == null || !p.direction;
}

// MLB's game log carries a split for a game that is still *in progress*, so
// grading the moment first pitch is in the past would settle a pick off a
// half-finished box score -- a 1-for-2 night graded as a loss in the third
// inning. No sport here runs anywhere near six hours, so waiting that long
// after the scheduled start means the line being read is a final one.
const PICK_SETTLE_DELAY_MS = 6 * 60 * 60 * 1000;
function pickGameIsFinal(p) {
  const start = Date.parse(p?.gameDate);
  return Number.isFinite(start) && Date.now() - start > PICK_SETTLE_DELAY_MS;
}

// Game logs date a game by its *local* start, while a pick stores the
// schedule's UTC timestamp -- a 10pm ET first pitch is already tomorrow in
// UTC. So the match is "same calendar day give or take one", taking the
// closest candidate, rather than a string equality that would silently miss
// every late West-coast game.
function findLoggedGame(games, isoDate) {
  if (!games || !games.length || !isoDate) return null;
  const target = Date.parse(isoDate.slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(target)) return null;
  let best = null;
  let bestGap = Infinity;
  games.forEach((g) => {
    const t = Date.parse(String(g.date || "").slice(0, 10) + "T00:00:00Z");
    if (!Number.isFinite(t)) return;
    const gap = Math.abs(t - target);
    if (gap <= 36 * 3600 * 1000 && gap < bestGap) { best = g; bestGap = gap; }
  });
  return best;
}

// Resolves one pick to { status, value } where status is:
//   "won" / "lost"     -- settled against a real logged game
//   "pending"          -- game hasn't been played, or its log hasn't posted
//   "unsettleable"     -- no real game log exists for this sport/player
//   "legacy"           -- saved before picks carried enough data to grade
// Never throws and never invents a result; a failed fetch reads as pending.
async function gradePick(p) {
  if (pickIsLegacy(p)) return { status: "legacy" };
  const source = p.gradeKind ? PICK_GRADE_SOURCES[p.gradeKind] : null;
  if (!source || !p.gradeId) return { status: "unsettleable" };
  if (!p.gameDate) return { status: "unsettleable" };
  if (!pickGameIsFinal(p)) return { status: "pending" };

  let games = null;
  try {
    games = await source.fetchLog(p.gradeId, p);
  } catch {
    return { status: "pending" };
  }
  const game = findLoggedGame(games, p.gameDate);
  if (!game) return { status: "pending" };

  const value = source.value(game, p.marketId);
  if (!Number.isFinite(value)) return { status: "pending" };
  return {
    status: feedIsHit(value, p.line, p.isBinary, p.direction) ? "won" : "lost",
    value,
  };
}

// A flat 1 unit per pick, so the record reads the same for everyone and
// nobody has to enter a bankroll. Profit on a win is the American odds'
// decimal payout minus the stake; a loss is -1u.
function pickUnitProfit(p) {
  if (p.result === "won") return americanToDecimal(p.odds) - 1;
  if (p.result === "lost") return -1;
  return 0;
}

function ledgerSummary(picks) {
  const settled = picks.filter((p) => p.result === "won" || p.result === "lost");
  const won = settled.filter((p) => p.result === "won").length;
  const lost = settled.length - won;
  const units = settled.reduce((a, p) => a + pickUnitProfit(p), 0);
  return {
    settled: settled.length,
    won, lost,
    hitRate: settled.length ? won / settled.length : null,
    units,
    // Flat staking, so risk is exactly one unit per settled pick.
    roi: settled.length ? units / settled.length : null,
  };
}

// --------------------------------------------------------------------------
// Parlay correlation
// --------------------------------------------------------------------------
// combineParlayOdds multiplies legs as if they were independent, which is how
// books quote a parlay -- but two markets on the same player, or two players
// in the same game, move together. The combined price shown is therefore
// optimistic for those slips. This flags the overlap so the panel can say so
// plainly; it is a heuristic and is labelled as one, not a corrected price.
function parlayCorrelationGroups(picks) {
  const groups = [];
  const byPlayer = new Map();
  const byGame = new Map();
  picks.forEach((p) => {
    if (p.playerId) {
      const k = `${p.sport}:${p.playerId}`;
      byPlayer.set(k, [...(byPlayer.get(k) || []), p]);
    }
  });
  const playerLegIds = new Set();
  byPlayer.forEach((ps) => {
    if (ps.length < 2) return;
    ps.forEach((p) => playerLegIds.add(p.id));
    groups.push({ kind: "player", label: ps[0].name, picks: ps });
  });
  picks.forEach((p) => {
    // A same-player group already says everything a same-game group would,
    // so those legs don't get counted twice.
    if (!p.gameId || playerLegIds.has(p.id)) return;
    const k = `${p.sport}:${p.gameId}`;
    byGame.set(k, [...(byGame.get(k) || []), p]);
  });
  byGame.forEach((ps) => {
    if (ps.length < 2) return;
    groups.push({ kind: "game", label: `${ps[0].team} vs ${String(ps[0].opp || "").split(" · ")[0]}`, picks: ps });
  });
  return groups;
}

// --------------------------------------------------------------------------
// The Report: reading the slip and the record back to you
// --------------------------------------------------------------------------
// Everything here is arithmetic over data the app already holds -- the row
// snapshot saved with each pick, and the graded results in the Ledger. There
// is no model and no language model: a sentence only appears when a specific
// numeric condition is true, so the Report can't tell you something the
// numbers don't say. That also means it costs nothing to run and works with
// no API key, no network and no account.
//
// Severity drives both ordering and colour: "warn" is something working
// against the pick, "good" is something for it, "note" is context.
const REPORT_TONE = {
  good: { color: "var(--pos)", mark: "▲" },
  warn: { color: "var(--neg)", mark: "▼" },
  note: { color: "var(--dim)", mark: "•" },
};

// Thresholds are deliberately conservative and named, so the text can quote
// the same number it tested against.
const REPORT_STRONG_RATE = 0.7;
const REPORT_WEAK_RATE = 0.55;
// A gap this wide between the 5-game and 20-game rate means the pick is being
// carried by recent form rather than by an established level.
const REPORT_FORM_GAP = 0.2;
// Within this much of the line, the average result is close enough to the
// number that the hit rate is nearly a coin flip on the night.
const REPORT_THIN_CUSHION = 0.3;

function reportSlipFindings(picks) {
  const findings = [];
  picks.forEach((p) => {
    const s = p.snap;
    if (!s) return;
    const who = `${p.name} ${p.subtitle}`;

    if (s.l10 >= REPORT_STRONG_RATE && s.l20 != null && Math.abs(s.l10 - s.l20) <= 0.1) {
      findings.push({ tone: "good", who, text:
        `hits ${Math.round(s.l10 * 100)}% over 10 games and ${Math.round(s.l20 * 100)}% over 20 — the level is established, not a hot streak.` });
    } else if (s.l5 != null && s.l20 != null && s.l5 - s.l20 >= REPORT_FORM_GAP) {
      findings.push({ tone: "warn", who, text:
        `is ${Math.round(s.l5 * 100)}% in its last 5 but only ${Math.round(s.l20 * 100)}% over 20. You're buying recent form, and that's the number most likely to fall back.` });
    } else if (s.l10 != null && s.l10 < REPORT_WEAK_RATE) {
      findings.push({ tone: "warn", who, text:
        `has only hit ${Math.round(s.l10 * 100)}% of its last 10. Nothing in the sample supports this one.` });
    }

    if (s.cushion != null && Math.abs(s.cushion) < REPORT_THIN_CUSHION) {
      findings.push({ tone: "warn", who, text:
        `clears the line by just ${Math.abs(s.cushion).toFixed(2)} on average — close enough that one quiet night flips it.` });
    } else if (s.cushion != null && s.cushion >= 1) {
      findings.push({ tone: "good", who, text:
        `clears the line by ${s.cushion.toFixed(1)} on average, so it doesn't need a perfect night.` });
    }

    if (s.streak <= -3) {
      findings.push({ tone: "warn", who, text: `has missed ${Math.abs(s.streak)} in a row.` });
    } else if (s.streak >= 5) {
      findings.push({ tone: "good", who, text: `has hit ${s.streak} straight.` });
    }

    if (s.tier === "tough") {
      findings.push({ tone: "warn", who, text: `draws a top-tier matchup (opponent rank #${s.rank}), the hardest kind for this stat.` });
    } else if (s.tier === "soft") {
      findings.push({ tone: "good", who, text: `draws a soft matchup (opponent rank #${s.rank}).` });
    }

    if (s.lineupConfirmed === false) {
      findings.push({ tone: "note", who, text: `is on a projected lineup — the batting order isn't posted yet, so the plate appearances aren't guaranteed.` });
    }
  });
  return findings;
}

// One plain sentence over the whole slip. Counts legs by whether anything
// argued against them, which is the thing a list of findings makes hard to see.
function reportSlipVerdict(picks, findings, correlations) {
  const withSnap = picks.filter((p) => p.snap);
  if (!withSnap.length) return null;
  const flagged = new Set(findings.filter((f) => f.tone === "warn").map((f) => f.who));
  const clean = withSnap.length - flagged.size;
  const parts = [];
  if (withSnap.length === 1) {
    // A one-leg slip isn't a parlay, and "every leg" / "3 of 4" both read
    // strangely for it.
    parts.push(clean ? `Nothing in the data argues against this one.` : `There's something working against this one.`);
  } else if (clean === withSnap.length) {
    parts.push(`Nothing in the data argues against any of these ${withSnap.length} legs.`);
  } else if (clean === 0) {
    parts.push(`Every leg here has something working against it.`);
  } else {
    parts.push(`${clean} of ${withSnap.length} legs look clean; ${flagged.size} ${flagged.size === 1 ? "has" : "have"} a mark against ${flagged.size === 1 ? "it" : "them"}.`);
  }
  if (correlations.length && withSnap.length > 1) {
    parts.push(`The legs also overlap, so the parlay price is more optimistic than it looks.`);
  }
  return parts.join(" ");
}

// Splits the settled record along one dimension (sport, market, side, price
// band) and returns only buckets with enough picks to be worth printing.
function reportBreakdown(settled, keyFn, minPicks = 3) {
  const buckets = new Map();
  settled.forEach((p) => {
    const k = keyFn(p);
    if (!k) return;
    const b = buckets.get(k) || { label: k, won: 0, lost: 0, units: 0 };
    if (p.result === "won") b.won++; else b.lost++;
    b.units += pickUnitProfit(p);
    buckets.set(k, b);
  });
  return [...buckets.values()]
    .filter((b) => b.won + b.lost >= minPicks)
    .sort((a, b) => b.units - a.units);
}

// The number of settled picks below which a record is noise. Well-known rule
// of thumb rather than anything derived -- the point is only to stop the
// Report from reading a 3-1 start as a discovered edge.
const REPORT_MIN_SAMPLE = 20;

function reportHistory(settled) {
  const summary = ledgerSummary(settled);
  if (!summary.settled) return null;
  return {
    summary,
    thin: summary.settled < REPORT_MIN_SAMPLE,
    bySport: reportBreakdown(settled, (p) => (p.sport || "").toUpperCase()),
    byMarket: reportBreakdown(settled, (p) => p.marketLabel || null),
    bySide: reportBreakdown(settled, (p) => (p.direction === "under" ? "Unders" : "Overs")),
    byPrice: reportBreakdown(settled, (p) =>
      p.odds == null ? null : p.odds <= -150 ? "Heavy favourites" : p.odds < 100 ? "Short favourites" : "Underdogs"),
  };
}

// Deep-links go to each book's sportsbook landing page rather than a
// prefilled bet slip -- none of these books expose a public API for
// injecting picks into a slip, so "add to sportsbook" means "open the
// book with your picks in hand," not an automatic add.
const SPORTSBOOKS = [
  { id: "draftkings", label: "DraftKings", url: "https://sportsbook.draftkings.com/" },
  { id: "fanduel", label: "FanDuel", url: "https://sportsbook.fanduel.com/" },
  { id: "betmgm", label: "BetMGM", url: "https://sports.betmgm.com/" },
  { id: "caesars", label: "Caesars", url: "https://www.caesars.com/sportsbook-and-casino" },
  { id: "espnbet", label: "ESPN BET", url: "https://espnbet.com/" },
  { id: "fanatics", label: "Fanatics", url: "https://sportsbook.fanatics.com/" },
];
// The Prop Feed's odds range is hard-capped to American odds of -1000/+1000
// -- anything outside that band (extreme favorites/longshots, e.g. a
// Triple-Double prop that hits 0% or 100% of the time) is excluded from the
// feed entirely rather than just hidden behind an untouched slider. These
// are the hit-rate probabilities that correspond exactly to -1000 and +1000.
const ODDS_PROB_LOW = 1 / 11; // +1000
const ODDS_PROB_HIGH = 10 / 11; // -1000
// Converts the odds slider's uniform 4-96 encoded position into a hit-rate
// probability, linearly spanning [ODDS_PROB_HIGH, ODDS_PROB_LOW] (highest
// probability/most-favorite at x=4, lowest/most-underdog at x=96) -- see the
// oddsMinX/oddsMaxX comment in PropFeedPage. Because the full 4-96 range
// itself now maps exactly onto -1000..+1000, there's no separate "beyond the
// slider" filter needed -- the slider's own extremes are the hard cutoff.
function oddsSliderProb(x) {
  return ODDS_PROB_HIGH - ((x - 4) / 92) * (ODDS_PROB_HIGH - ODDS_PROB_LOW);
}

// Builds one feed row per player/market combo, reusing the exact same mock
// game logs and statValue/statValueNFL math as the single-player pages so
// the numbers stay consistent between the two views.
function buildNBAFeedRows() {
  const rows = [];
  ALL_NBA_PLAYERS.forEach((player, pi) => {
    const games = genGames(player, pi);
    const nextOpp = games[games.length - 1].opp;
    MARKETS.forEach((m) => {
      const isBinary = m.id === "dd" || m.id === "td";
      const def = getNBADefRank(m.id, nextOpp);
      const rank = def.rank;
      const tier = defTier(rank);
      const values = games.map((g) => statValue(g, m.id));
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const line = isBinary ? 0.5 : fairFeedLine(values);
      const hit = isBinary ? (v) => v === 1 : (v) => v > line;
      const variance = values.reduce((a, v) => a + (v - avg) ** 2, 0) / values.length;
      rows.push({
        key: `nba_${player.id}_${m.id}`,
        playerId: player.id,
        marketId: m.id,
        category: NBA_MARKET_CATEGORY[m.id],
        icon: nbaTeamLogo(player.team),
        avatar: espnHeadshot(player.espnId),
        avatarFallback: nbaHeadshot(player.nbaId),
        name: player.name,
        team: player.team,
        marketLabel: m.label,
        subtitle: isBinary ? m.label : `Over ${line} ${m.label}`,
        opp: nextOpp,
        rank, tier, rankLabel: nbaDefCategoryLabel(m.id),
        l5: hitRateWindow(values, 5, hit),
        l10: hitRateWindow(values, 10, hit),
        l20: hitRateWindow(values, 20, hit),
        all: hitRateWindow(values, "all", hit),
        values, line, isBinary, variance,
        direction: "over", matchupScore: rank,
        recent: feedRecentGames(games, values),
        // Deliberately no gradeKind/gradeId: these games come from genGames,
        // a seeded RNG, so there is no real result to settle a pick against.
        // The Ledger surfaces NBA picks as unsettleable rather than inventing
        // one -- see gradePick.
      });
    });
  });
  return rows;
}

// Looks up which matchup a player belongs to (searching both rosters) and
// returns its game date, so feed rows can be filtered by "which day is this
// player's game on" -- independent of the synthetic historical opponent
// used for the hit-rate math.
function matchupDateForPlayer(matchups, playerId) {
  const m = matchups.find((mu) => mu.teamA.players.some((p) => p.id === playerId) || mu.teamB.players.some((p) => p.id === playerId));
  return m ? m.date : null;
}

function buildNFLFeedRows() {
  const rows = [];
  ALL_NFL_PLAYERS.forEach((player) => {
    const games = getNFLGames(player);
    if (!games.length) return;
    const nextOpp = games[games.length - 1].opp;
    const gameDate = matchupDateForPlayer(NFL_MATCHUPS, player.id);
    const applicableMarkets = NFL_MARKETS.filter((m) => m.pos.includes(player.pos));
    applicableMarkets.forEach((m) => {
      const isBinary = false;
      const values = games.map((g) => statValueNFL(g, m.id));
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const line = isBinary ? 0.5 : fairFeedLine(values);
      const hit = isBinary ? (v) => v === 1 : (v) => v > line;
      const def = getNFLDefRank(m.id, player.pos, nextOpp);
      const tier = nflDefTier(def.rank);
      const variance = values.reduce((a, v) => a + (v - avg) ** 2, 0) / values.length;
      rows.push({
        key: `nfl_${player.id}_${m.id}`,
        playerId: player.id,
        marketId: m.id,
        category: NFL_MARKET_CATEGORY[m.id],
        icon: nflTeamLogo(player.team),
        avatar: NFL_HEADSHOTS[player.id],
        name: player.name,
        team: player.team,
        date: gameDate,
        marketLabel: m.label,
        subtitle: isBinary ? m.label : `Over ${line} ${m.label}`,
        opp: nextOpp,
        rank: def.rank, tier, rankLabel: nflDefCategoryLabel(m.id, player.pos),
        l5: hitRateWindow(values, 5, hit),
        l10: hitRateWindow(values, 10, hit),
        l20: hitRateWindow(values, 20, hit),
        all: hitRateWindow(values, "all", hit),
        values, line, isBinary, variance,
        direction: "over", matchupScore: def.rank,
        recent: feedRecentGames(games, values),
        // See gradePick. Null for anyone with no ESPN id mapped -- those
        // rows fall back to synthetic logs, which must never be graded.
        gradeKind: "nfl", gradeId: NFL_ESPN_ID[player.id] || null,
      });
    });
  });
  return rows;
}

// Builds MLB feed rows from live-fetched per-player game logs plus each
// team's actual next opponent (see fetchMLBTeamNextGame) -- unlike the NBA/
// NFL builders above, this one takes data in rather than generating it, so
// fetching stays in the page effect and this stays a pure function.
// teamsData: one entry per MLB team -- { players, gameLogsById, nextGame }.
function buildMLBFeedRows(teamsData) {
  const rows = [];
  teamsData.forEach(({ players, gameLogsById, gameId, nextGame, lineupConfirmed }) => {
    if (!nextGame) return;
    // Empty on an ordinary day, so both the row key (and therefore the
    // persisted My Picks id built from it) and the displayed opponent stay
    // exactly as they were -- see mlbGameNumber.
    const gameKeySuffix = nextGame.gameNumber ? `_g${nextGame.gameNumber}` : "";
    const gameLabel = nextGame.gameNumber ? `Gm ${nextGame.gameNumber}` : null;
    players.forEach((player) => {
      const games = gameLogsById[player.id] || [];
      if (!games.length) return;
      MLB_MARKETS.forEach((m) => {
        const def = getMLBDefRank(m.id, nextGame.opp);
        const rank = def.rank;
        const tier = mlbDefTier(rank);
        const values = games.map((g) => statValueMLB(g, m.id));
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const line = fairFeedLine(values);
        const hit = (v) => v > line;
        const variance = values.reduce((a, v) => a + (v - avg) ** 2, 0) / values.length;
        rows.push({
          key: `mlb_${player.id}_${m.id}${gameKeySuffix}`,
          gameId,
          gameLabel,
          playerId: player.id,
          marketId: m.id,
          category: MLB_MARKET_CATEGORY[m.id],
          icon: mlbTeamLogo(player.team),
          avatar: mlbHeadshot(player.mlbId),
          avatarFallback: mlbEspnHeadshot(player.id),
          name: player.name,
          team: player.team,
          date: nextGame.date,
          marketLabel: m.label,
          subtitle: `Over ${line} ${m.label}`,
          opp: nextGame.opp,
          rank, tier, rankLabel: mlbDefCategoryLabel(m.id),
          l5: hitRateWindow(values, 5, hit),
          l10: hitRateWindow(values, 10, hit),
          l20: hitRateWindow(values, 20, hit),
          all: hitRateWindow(values, "all", hit),
          values, line, isBinary: false, variance,
          direction: "over", matchupScore: rank,
          recent: feedRecentGames(games, values),
          // Whether MLB has actually posted this team's batting order yet, so
          // the row can say "LINEUP" instead of "PROJ". Already fetched (see
          // fetchMLBDaySlate's lineups hydration) -- no extra request.
          lineupConfirmed: !!lineupConfirmed,
          // See gradePick -- fetchMLBGameLog is keyed by mlbId, not by our
          // own roster id, so the pick has to carry it.
          gradeKind: "mlb_batter", gradeId: player.mlbId,
        });
      });
    });
  });
  return rows;
}

// Encodes/decodes the synthetic id used for a team's live probable pitcher.
// MLB_TEAM_ROSTERS is a static snapshot with one hardcoded "SP" placeholder
// per team, but the actual announced starter is frequently a different
// person -- so feed rows for a pitcher who isn't that placeholder used to
// have no playerId at all (and no "View Chart" link) since there was
// nothing in the static roster to link to. Embedding the team abbreviation
// in the id itself means MLBPropsPage can select the right team on a jump
// without needing a roster lookup that would fail for exactly this reason.
function mlbLivePitcherId(teamAbbr, mlbId) {
  return `mlb_live_${teamAbbr}_${mlbId}`;
}
function parseMlbLivePitcherId(id) {
  const m = /^mlb_live_([A-Z]+)_(\d+)$/.exec(id || "");
  return m ? { team: m[1], mlbId: Number(m[2]) } : null;
}

// Same idea for batters who aren't in a static roster array -- a confirmed
// starter or trade-deadline addition pulled in off the live active roster
// (see applyConfirmedLineup/topUpProjectedBatters). Kept a distinct prefix
// from the pitcher id above rather than reusing it, because MLBPropsPage's
// jump handler treats a parsed pitcher id as "mount this person as the SP",
// which would be wrong for a position player. Without the team abbreviation
// baked in, a "View Chart" jump to one of these had nothing to look the
// player's team up from and silently landed on the roster's first batter.
function mlbLiveBatterId(teamAbbr, mlbId) {
  return `mlb_livebat_${teamAbbr}_${mlbId}`;
}
function parseMlbLiveBatterId(id) {
  const m = /^mlb_livebat_([A-Z]+)_(\d+)$/.exec(id || "");
  return m ? { team: m[1], mlbId: Number(m[2]) } : null;
}

// Pitcher props are scoped to whoever is actually announced to start each
// team's next game (see fetchMLBTeamNextGame's probablePitcher field) --
// not the full staff -- so this rolls to the new starter automatically once
// one is announced, same cadence as the rest of the feed.
// teamsData: one entry per MLB team -- { teamAbbr, pitcherGames, nextGame }.
function buildMLBPitcherFeedRows(teamsData) {
  const rows = [];
  teamsData.forEach(({ teamAbbr, pitcherGames, gameId, nextGame }) => {
    const pitcher = nextGame?.probablePitcher;
    if (!pitcher || !pitcherGames || !pitcherGames.length) return;
    // A doubleheader's two halves normally have different starters, so these
    // keys wouldn't collide on mlbId alone -- but they do before MLB names
    // the second starter, when both halves can still report the same one.
    const gameKeySuffix = nextGame.gameNumber ? `_g${nextGame.gameNumber}` : "";
    const gameLabel = nextGame.gameNumber ? `Gm ${nextGame.gameNumber}` : null;
    MLB_PITCHER_MARKETS.forEach((m) => {
      const def = getMLBDefRank(m.id, nextGame.opp);
      const rank = def.rank;
      const tier = mlbDefTier(rank);
      const values = pitcherGames.map((g) => statValueMLBPitcher(g, m.id));
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const line = fairFeedLine(values);
      const hit = (v) => v > line;
      const variance = values.reduce((a, v) => a + (v - avg) ** 2, 0) / values.length;
      rows.push({
        key: `mlb_pitcher_${pitcher.mlbId}_${m.id}${gameKeySuffix}`,
        gameId,
        gameLabel,
        playerId: mlbLivePitcherId(teamAbbr, pitcher.mlbId),
        marketId: m.id,
        category: MLB_MARKET_CATEGORY[m.id],
        icon: mlbTeamLogo(teamAbbr),
        // No avatarFallback here -- mlbEspnHeadshot's MLB_ESPN_ID map is
        // keyed by the static roster's own player id, which a live-announced
        // probable pitcher (identified only by mlbId) was never assigned.
        // The primary source (mlbHeadshot, keyed by mlbId directly) doesn't
        // have that limitation, so it's the only one that applies here.
        avatar: mlbHeadshot(pitcher.mlbId),
        name: pitcher.name,
        team: teamAbbr,
        date: nextGame.date,
        marketLabel: m.label,
        subtitle: `Over ${line} ${m.label}`,
        opp: nextGame.opp,
        rank, tier, rankLabel: mlbDefCategoryLabel(m.id),
        l5: hitRateWindow(values, 5, hit),
        l10: hitRateWindow(values, 10, hit),
        l20: hitRateWindow(values, 20, hit),
        all: hitRateWindow(values, "all", hit),
        values, line, isBinary: false, variance,
        direction: "over", matchupScore: rank,
        recent: feedRecentGames(pitcherGames, values),
        // Intentionally no `lineupConfirmed`: these rows are built off MLB's
        // *probable* starter, which is a weaker claim than a posted batting
        // order. Leaving it undefined means FeedRow renders no chip at all,
        // rather than a "LINEUP" badge overstating what's actually known.

        // See gradePick.
        gradeKind: "mlb_pitcher", gradeId: pitcher.mlbId,
      });
    });
  });
  return rows;
}

const FEED_SPORTS = [
  { id: "nfl", label: "NFL", available: true },
  { id: "mlb", label: "MLB", available: true },
  { id: "nba", label: "NBA", available: true },
  { id: "wnba", label: "WNBA", available: true },
];

// Prop Feed opens on MLB until the real NFL Week 1 opener kicks off (the
// earliest date in NFL_MATCHUPS), then flips to NFL by default -- there's no
// NFL slate worth landing on before the season actually starts. Only used
// for the very first load; once the user picks a sport that choice sticks
// for the rest of the session (see feedSport/setFeedSport in PropLedger).
function defaultFeedSport() {
  const week1Kickoff = Math.min(...NFL_MATCHUPS.map((m) => new Date(m.date).getTime()));
  return Date.now() >= week1Kickoff ? "nfl" : "mlb";
}

// How many teams' worth of defensive ranks exist for each sport -- sets the
// upper bound of the Defense Rank Range slider (rank 1 = toughest matchup,
// rank N = easiest, same convention as every OPP RANK badge in the feed).
function feedTeamCount(sport) {
  return sport === "nba" ? TEAMS.length : sport === "wnba" ? WNBA_TEAMS.length : sport === "nfl" ? NFL_TEAMS.length : MLB_TEAMS.length;
}

// Sort options for the feed list. Hit rate (for whichever L5/L10/L20
// window is selected) is always the primary sort now -- these modes only
// break ties among equal hit rates, so they're framed as secondary
// research axes (opponent matchup, consistency, momentum) rather than
// full replacements for the hit-rate ordering. defaultDir is applied
// whenever the user switches modes, then the direction chip can flip it.
const FEED_SORT_MODES = [
  {
    // matchupScore, not rank: it's negated on Under rows (see
    // flipFeedRowToUnder) so "easiest" keeps meaning "best for the side
    // you're looking at" -- a soft defense helps an Over and hurts an Under.
    id: "matchup", label: "Easiest Matchup", metric: (r) => (r.matchupScore ?? r.rank), defaultDir: "desc",
    description: "Ranks by how vulnerable the opponent is in that specific stat (not their overall record) -- e.g. a team can be a bottom-5 defense vs. 3PM but still be tough against rebounds. #1 is the toughest matchup for this stat, higher numbers are easier.",
  },
  {
    id: "variance", label: "Most Consistent", metric: (r) => r.variance, defaultDir: "asc",
    description: "Ranks by how little a player's results swing game to game. Low variance means steady, predictable output -- useful if you want to avoid boom-or-bust props even if the average hit rate is similar.",
  },
  {
    id: "trend", label: "Trending Up", metric: (r) => r.l5 - r.l20, defaultDir: "desc",
    description: "Ranks by recent form (L5) compared to season-long form (L20) -- surfaces players heating up right now relative to their own baseline, not just whoever has the highest raw hit rate.",
  },
];

// L5/L10/L20 sample-size window -- a single global switcher (not per row)
// that drives every row's displayed hit rate, its odds, and the "Highest
// Hit Rate" sort mode -- shared across all three sports' feeds since they
// all carry the same l5/l10/l20 fields.
const FEED_WINDOWS = [["L5", "l5"], ["L10", "l10"], ["L20", "l20"], ["ALL", "all"]];

// One global segmented control for the L5/L10/L20 sample-size window --
// previously this was three separate buttons repeated on every row, which
// made it look like a per-player toggle even though picking one actually
// changed the whole feed's odds/sort. Pulling it out to a single control
// above the list makes the "this affects everything" behavior obvious.
// Label is rendered by the caller (see the FEED_LABEL_STYLE row layout in
// PropFeedPage) so this lines up in the same label/control column as the
// other feed filter rows instead of carrying its own separately-styled label.
// Shared chrome for the filter rail's segmented controls (sample size, and
// the Over/Under side switcher below), so the two read as the same control
// type rather than two separately-styled lookalikes.
// `fill` stretches the control to its container and gives every cell an equal
// share of it -- that's what lets the phone layout put two of these side by
// side on one line and have both land on a predictable width, instead of each
// sizing to its own label text.
function FeedSegmented({ options, value, onChange, titleFor, padding = "6px 16px", fill = false }) {
  return (
    <div style={{
      display: "flex", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden",
      ...(fill ? { width: "100%" } : null),
    }}>
      {options.map(([label, key], idx) => (
        <div
          key={key}
          className="mono"
          role="button"
          onClick={() => onChange(key)}
          title={titleFor ? titleFor(label, key) : undefined}
          style={{
            cursor: "pointer",
            padding,
            ...(fill ? { flex: 1, textAlign: "center", minWidth: 0 } : null),
            fontSize: 12.5,
            fontWeight: 700,
            borderLeft: idx === 0 ? "none" : "1px solid var(--line)",
            background: value === key ? "var(--amber-dim)" : "var(--panel)",
            color: value === key ? "var(--amber)" : "var(--dim)",
            boxShadow: value === key ? "0 0 0 1px var(--amber) inset" : "none",
            transition: "background .15s ease, color .15s ease",
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function WindowSwitcher({ value, onChange, fill }) {
  return (
    <FeedSegmented
      options={FEED_WINDOWS}
      value={value}
      onChange={onChange}
      fill={fill}
      padding={fill ? "7px 6px" : "6px 16px"}
      titleFor={(label) => `Show ${label} hit rate everywhere`}
    />
  );
}

// Over/Under side switcher. Every row is built as an Over, which quietly hid
// half the feed -- a prop that only goes Over 20% of the time is an 80%
// Under, and there was no way to look at it that way. See flipFeedRowToUnder.
const FEED_DIRECTIONS = [["OVER", "over"], ["UNDER", "under"]];
function DirectionSwitcher({ value, onChange, fill }) {
  return (
    <FeedSegmented
      options={FEED_DIRECTIONS}
      value={value}
      onChange={onChange}
      fill={fill}
      padding={fill ? "7px 6px" : "6px 20px"}
      titleFor={(label) =>
        label === "OVER"
          ? "Price every prop as an Over"
          : "Price every prop as an Under -- hit rates, odds and matchup colors all flip to that side"
      }
    />
  );
}

// Shared label style for the feed's filter-row form (TEAM / SAMPLE SIZE /
// SORT BY) -- a fixed width + right-aligned text means every row's
// control starts at the same x position, so the whole block reads as one
// neatly aligned form instead of each row centering independently at
// whatever width its own label+control happen to add up to.
// Label sits on its own centered line above the control, rather than beside
// it -- putting label+control side by side means the control's own midpoint
// is offset from center by however wide the label happens to be (a longer
// label like "SAMPLE SIZE" pushes its control further right than a short one
// like "TEAM"), so no single fixed layout keeps every control's actual
// midpoint on the true page center. Stacking removes that coupling: each
// control centers independently of its label's width.
const FEED_LABEL_STYLE = { fontSize: 12, fontWeight: 600, color: "var(--dim)", letterSpacing: "0.04em" };
const FEED_FILTER_ROW_STYLE = { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 };
const FEED_CONTROL_WIDTH = 190;

function PropFeedPage({ onOpenProp, pickIds, onTogglePick, nflDataVersion, wnbaDataVersion, sport, setSport }) {
  const isNarrow = useIsNarrow(560);
  // Settings > Betting seeds the two controls below. Read once as an initial
  // value, for the same reason feedSport is: changing a default should decide
  // where the next visit starts, not move the controls under someone who is
  // already reading the board.
  const bettingDefaults = useBettingSettings();
  // Replaces the old flat category chip row (All/Core/Power/...), which
  // filtered down to a *bucket* of markets -- this lands on one real prop
  // directly, matching how Outlier's feed always shows a single market at a
  // time. See PropTypePicker/PROP_GROUPS/PROP_QUICK_PICKS above.
  const [selectedMarket, setSelectedMarket] = useState(() => PROP_QUICK_PICKS[sport]?.[0] || PROP_GROUPS[sport]?.[0]?.markets[0]?.id || null);
  const [sampleWindow, setSampleWindow] = useState(() => bettingDefaults.sampleWindow);
  // Which side of the line the whole feed is priced from. Rows are built
  // Over-only; "under" runs them through flipFeedRowToUnder so the hit rates,
  // odds, sorting and filtering all describe the side actually on screen.
  const [direction, setDirection] = useState(() => bettingDefaults.lean);
  const [sortMode, setSortMode] = useState("matchup");
  const [sortDir, setSortDir] = useState("desc");
  const [showSortInfo, setShowSortInfo] = useState(false);
  const [sortInfoHover, setSortInfoHover] = useState(false);
  const [sortDirInfoHover, setSortDirInfoHover] = useState(false);
  const oddsFormat = useOddsFormat();
  // Secondary filters (Sort By, Odds Range, Defense Rank Range) collapse
  // behind this Filters disclosure instead of always sitting open in the
  // page flow -- see feedActiveFilterCount below for the badge shown on its
  // trigger.
  const [feedFiltersOpen, setFeedFiltersOpen] = useState(false);
  // Desktop table column sort -- clicking a FeedTableHeader column overrides
  // the Sort By dropdown's mode until cleared. null means "use the Sort By/
  // primary-hit-rate behavior below" (see sortedRows).
  const [columnSort, setColumnSort] = useState(null);
  // Three-state cycle per column: neutral -> strongest-first -> weakest-first
  // -> neutral. There's a branch back to null because otherwise, once you'd
  // sorted a column, there was no way to get the list back to its default
  // order short of a reload; the sortedRows memo below already falls through
  // to the Sort By dropdown's ordering whenever columnSort is null, so
  // neutral doesn't require snapshotting the pre-sort array.
  //
  // The *first* click used to always sort ascending, which on a hit-rate
  // column meant it opened on the worst props on the board -- a screen of
  // red, when the reason to click L10 is to see who hits it most. First click
  // now surfaces the strongest end of whichever column it is, and that
  // direction is per-column rather than a blanket "desc": these odds are
  // derived from the hit rate itself (see probToAmericanOdds), so the biggest
  // *number* (+1000) is the least likely prop. Sorting odds ascending puts
  // -1000 first, which is the same props the hit-rate columns lead with --
  // clicking Odds and clicking Season now agree instead of contradicting.
  const FEED_COLUMN_STRONGEST_DIR = { odds: "asc" };
  const onSortColumn = (key) => {
    setColumnSort((prev) => {
      const strongest = FEED_COLUMN_STRONGEST_DIR[key] || "desc";
      if (prev?.key !== key) return { key, dir: strongest };
      if (prev.dir === strongest) return { key, dir: strongest === "desc" ? "asc" : "desc" };
      return null;
    });
  };

  // Odds range filter. The slider itself drags a uniform 4-96 "encoded"
  // position (so dragging feels smooth), which is converted to a hit-rate
  // probability via oddsSliderProb -- probability falls as the encoded
  // value rises, so the left handle lands on the most negative/favorite
  // odds and the right handle on the most positive/underdog odds, matching
  // how odds read left-to-right on a real sportsbook board.
  const [oddsMinX, setOddsMinX] = useState(4);
  const [oddsMaxX, setOddsMaxX] = useState(96);

  // Defense rank range filter -- rank 1 (toughest) to rank N (easiest),
  // N depends on how many teams that sport has. Resets to the full range
  // whenever the sport switches since the scale (15/30/31/30 teams) changes.
  const [rankLo, setRankLo] = useState(1);
  const [rankHi, setRankHi] = useState(feedTeamCount("nba"));

  // Team filter (NBA/WNBA) -- "all" means no filtering. Resets to "all"
  // whenever the sport switches since the option list is sport-specific.
  const [teamFilter, setTeamFilter] = useState("all");
  // Games filter (MLB/NFL) -- a multi-select set of matchup ids (see
  // GamesMultiSelect); empty means "all games", same as the old single
  // dropdown's "all" option. Resets whenever the sport switches since the
  // option list is sport-specific.
  const [selectedGameIds, setSelectedGameIds] = useState(() => new Set());

  // Each sport's rows only build while it's the *active* sport -- these used
  // to build unconditionally on mount (and NBA/WNBA/NFL never rebuilt after
  // that regardless of which sport was showing), which meant switching to
  // MLB still paid the cost of generating three other sports' full row sets
  // no one was looking at. Falling back to [] while inactive means flipping
  // back to a sport rebuilds it fresh rather than caching across switches --
  // a reasonable trade given these are synchronous, already-in-memory
  // computations (no network fetch), not the MLB fetch below.
  const nbaRows = useMemo(() => (sport === "nba" ? buildNBAFeedRows() : []), [sport]);
  // wnbaDataVersion/nflDataVersion bump when their real per-player game logs
  // and defense rankings finish loading (see the effects in PropLedger) --
  // without them in the dependency array, these would compute once on mount
  // against whatever fallback/mock data existed at that instant and never
  // recompute once the real data actually arrives.
  const wnbaRows = useMemo(() => (sport === "wnba" ? buildWNBAFeedRows() : []), [sport, wnbaDataVersion]);

  // Availability for every WNBA team with a row on the slate. Null while
  // loading or on failure, which FeedRow reads as "no dot" -- never as
  // available. Keyed off the team list rather than the rows themselves so it
  // doesn't refetch every time a filter re-slices the same players.
  const wnbaTeamsOnSlate = useMemo(
    () => (sport === "wnba" ? [...new Set(wnbaRows.map((r) => r.team).filter(Boolean))].sort().join(",") : ""),
    [sport, wnbaRows]
  );
  const [wnbaAvailability, setWnbaAvailability] = useState(null);
  React.useEffect(() => {
    let cancelled = false;
    setWnbaAvailability(null);
    if (!wnbaTeamsOnSlate) return undefined;
    fetchWNBAAvailability(wnbaTeamsOnSlate.split(","))
      .then((m) => { if (!cancelled) setWnbaAvailability(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [wnbaTeamsOnSlate]);
  const nflRows = useMemo(() => (sport === "nfl" ? buildNFLFeedRows() : []), [sport, nflDataVersion]);

  // This week's real NFL slate (see fetchNFLWeekSlate, one fetch for the
  // whole league) -- used only to build the MATCHUP dropdown/filter below;
  // nflRows above already has its own live per-player data independent of
  // this.
  const [nflSlate, setNflSlate] = useState(null);
  React.useEffect(() => {
    if (sport !== "nfl") return;
    let cancelled = false;
    const load = () => {
      fetchNFLWeekSlate().then((slate) => { if (!cancelled) setNflSlate(slate); });
    };
    load();
    const interval = setInterval(load, NFL_SLATE_TTL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [sport]);

  // MLB rows depend on live data -- today's real MLB slate (see
  // fetchMLBDaySlate, one fetch for the whole league) plus each playing
  // team's per-player game logs and probable pitcher, handed to the pure
  // buildMLBFeedRows/buildMLBPitcherFeedRows builders rather than generated
  // synchronously like NBA/NFL. Only teams actually on today's slate get
  // fetched/shown -- a team with an off day just doesn't appear.
  const [mlbSlate, setMlbSlate] = useState(null);
  const [mlbTeamsData, setMlbTeamsData] = useState(null);
  const [mlbLoading, setMlbLoading] = useState(false);
  const [matchupFilter, setMatchupFilter] = useState("all");

  React.useEffect(() => {
    if (sport !== "mlb") return;
    let cancelled = false;
    const load = () => {
      setMlbLoading((prev) => (mlbTeamsData ? prev : true));
      fetchMLBDaySlate()
        .then((slate) => {
          if (cancelled) return null;
          setMlbSlate(slate);
          const teamEntries = [];
          slate.forEach((game, gameIndex) => {
            // A doubleheader puts the same team on the slate twice, so this
            // pushes two entries for it -- one per game, each with that
            // game's own probable starter and first pitch. gameNumber is what
            // keeps the two sets of rows distinct downstream; it's null on an
            // ordinary day (see mlbGameNumber).
            const gameNumber = mlbGameNumber(slate, game);
            [
              { abbr: game.awayAbbr, isHome: false },
              { abbr: game.homeAbbr, isHome: true },
            ].forEach(({ abbr, isHome }) => {
              const roster = MLB_TEAM_ROSTERS[abbr];
              if (!roster) return;
              teamEntries.push({
                abbr,
                roster,
                lineupIds: isHome ? game.homeLineupIds : game.awayLineupIds,
                // Same id the MATCHUP dropdown builds its options with (see
                // mlbMatchupOptions), so the game filter can narrow to one
                // half of a doubleheader instead of matching on team alone
                // and catching both.
                gameId: `${game.awayAbbr}-${game.homeAbbr}-${gameIndex}`,
                nextGame: {
                  date: game.date,
                  opp: isHome ? game.awayAbbr : game.homeAbbr,
                  home: isHome,
                  status: game.status,
                  gameNumber,
                  probablePitcher: isHome ? game.homeProbablePitcher : game.awayProbablePitcher,
                },
              });
            });
          });
          // Only the announced probable starter's log is fetched per team --
          // pitcher props roll to whoever that is once MLB names a new one.
          //
          // The active-roster fetch is awaited *before* the game logs, not
          // alongside them: the feed used to build its rows straight off the
          // static MLB_TEAM_ROSTERS arrays, which is why an IL'd player (or
          // one traded away at the deadline) kept getting props built for
          // him here long after the MLB player page had already stopped
          // showing him. Running the same reconcileMlbLineup pipeline first
          // means only players really available today are fetched at all --
          // fewer game-log requests, not more, since a trimmed nine is never
          // larger than the static one.
          return Promise.all(
            teamEntries.map(({ abbr, roster, lineupIds, gameId, nextGame }) =>
              fetchMLBTeamActiveRoster(MLB_ABBR_TEAM_ID[abbr])
                .then((activeRoster) => reconcileMlbLineup(roster, { activeRoster, lineupIds, abbr }))
                .then((liveRoster) =>
                  Promise.all([
                    Promise.all(liveRoster.players.map((p) => fetchMLBGameLog(p.mlbId).then((games) => [p.id, games]))),
                    nextGame.probablePitcher ? fetchMLBPitcherGameLog(nextGame.probablePitcher.mlbId) : Promise.resolve([]),
                  ]).then(([entries, pitcherGames]) => ({
                    teamAbbr: abbr,
                    players: liveRoster.players,
                    gameLogsById: Object.fromEntries(entries),
                    pitcherGames,
                    gameId,
                    nextGame,
                    // Already hydrated by fetchMLBDaySlate -- carried through
                    // so feed rows can distinguish a posted batting order from
                    // our projected one without any additional request.
                    lineupConfirmed: (lineupIds?.length || 0) > 0,
                  }))
                )
            )
          );
        })
        .then((results) => {
          if (cancelled || !results) return;
          setMlbTeamsData(results);
          setMlbLoading(false);
        })
        .catch(() => { if (!cancelled) setMlbLoading(false); });
    };
    load();
    const interval = setInterval(load, MLB_SLATE_TTL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [sport]);

  const mlbRows = useMemo(() => {
    if (!mlbTeamsData) return [];
    const batterRows = buildMLBFeedRows(mlbTeamsData);
    const pitcherRows = buildMLBPitcherFeedRows(mlbTeamsData);
    return [...batterRows, ...pitcherRows];
  }, [mlbTeamsData]);

  // Matchup dropdown options for MLB -- one per game on today's slate,
  // sorted by first pitch (fetchMLBDaySlate already returns them in that
  // order), labeled "Away @ Home" so picking one shows just those two teams.
  const mlbMatchupOptions = useMemo(() => {
    if (!mlbSlate) return [];
    return mlbSlate.map((g, i) => {
      const gameNumber = mlbGameNumber(mlbSlate, g);
      return {
        id: `${g.awayAbbr}-${g.homeAbbr}-${i}`,
        teams: [g.awayAbbr, g.homeAbbr],
        label: `${(MLB_TEAM_ROSTERS[g.awayAbbr] || {}).label || g.awayAbbr} @ ${(MLB_TEAM_ROSTERS[g.homeAbbr] || {}).label || g.homeAbbr}`,
        time: `${matchupTimeLabel(g.date)}${mlbGameSuffix(mlbSlate, g)}`,
        // `time` bakes the doubleheader suffix into one string, which is right
        // for the dropdown but leaves nowhere to hang a timezone on. The strip
        // formats its own label, so it gets the raw ISO and the tag separately.
        startsAt: g.date,
        note: gameNumber ? `Gm ${gameNumber}` : "",
      };
    });
  }, [mlbSlate]);

  // Matchup dropdown options for NFL -- one per game in the current week's
  // slate (see fetchNFLWeekSlate), sorted by kickoff, labeled "Away @ Home"
  // so picking one shows just those two teams.
  const nflMatchupOptions = useMemo(() => {
    if (!nflSlate) return [];
    return nflSlate.map((g, i) => ({
      id: `${g.awayAbbr}-${g.homeAbbr}-${i}`,
      teams: [g.awayAbbr, g.homeAbbr],
      label: `${(NFL_TEAM_ROSTERS[g.awayAbbr] || {}).label || g.awayAbbr} @ ${(NFL_TEAM_ROSTERS[g.homeAbbr] || {}).label || g.homeAbbr}`,
      time: matchupTimeLabel(g.date),
      startsAt: g.date,
      note: "",
    }));
  }, [nflSlate]);

  const activeMatchupOptions = sport === "mlb" ? mlbMatchupOptions : sport === "nfl" ? nflMatchupOptions : [];
  const showMatchupDropdown = sport === "mlb" || sport === "nfl";

  const baseRows = sport === "nba" ? nbaRows : sport === "wnba" ? wnbaRows : sport === "nfl" ? nflRows : mlbRows;
  // Flipping here rather than at each display site means every downstream
  // consumer -- the odds-range filter, the sort comparators, FeedPctCell,
  // the splits strip, the odds column, the My Picks payload -- keeps reading
  // plain r.l5/r.l10/r.all and is automatically direction-correct.
  const rows = useMemo(
    () => (direction === "under" ? baseRows.map(flipFeedRowToUnder) : baseRows),
    [baseRows, direction]
  );
  const propGroups = PROP_GROUPS[sport] || [];
  // Display name of the selected prop, for the preset chip summary -- the
  // stored value is a market id ("pts_reb_ast"), which is not what someone
  // wants to read on a saved-screen card.
  const activeMarketLabel = useMemo(
    () => propGroups.flatMap((g) => g.markets).find((m) => m.id === selectedMarket)?.label || null,
    [propGroups, selectedMarket]
  );

  const maxRank = feedTeamCount(sport);
  React.useEffect(() => {
    setSelectedMarket(PROP_QUICK_PICKS[sport]?.[0] || PROP_GROUPS[sport]?.[0]?.markets[0]?.id || null);
    setRankLo(1);
    setRankHi(feedTeamCount(sport));
    setTeamFilter("all");
    setSelectedGameIds(new Set());
    setColumnSort(null);
  }, [sport]);

  // ---- saved screens (see FeedPresets.jsx) ----

  // The snapshot a preset stores. Game selections are converted to the *teams*
  // playing in those games rather than kept as matchup ids: ids identify one
  // specific scheduled game, so a preset saved today would match nothing
  // tomorrow. Teams are what someone naming a screen "Yankees" actually
  // means, and they still resolve to whatever those teams are playing next.
  const feedFilters = useMemo(
    () => ({
      sport,
      market: selectedMarket,
      sampleWindow,
      direction,
      sortMode,
      sortDir,
      oddsMinX,
      oddsMaxX,
      rankLo,
      rankHi,
      teamFilter,
      gameTeams: [
        ...new Set(
          activeMatchupOptions.filter((o) => selectedGameIds.has(o.id)).flatMap((o) => o.teams)
        ),
      ],
    }),
    [sport, selectedMarket, sampleWindow, direction, sortMode, sortDir, oddsMinX, oddsMaxX,
     rankLo, rankHi, teamFilter, activeMatchupOptions, selectedGameIds]
  );

  const applyFeedFiltersNow = React.useCallback((f) => {
    if (f.market !== undefined) setSelectedMarket(f.market);
    if (f.sampleWindow) setSampleWindow(f.sampleWindow);
    if (f.direction) setDirection(f.direction);
    if (f.sortMode) setSortMode(f.sortMode);
    if (f.sortDir) setSortDir(f.sortDir);
    if (Number.isFinite(f.oddsMinX)) setOddsMinX(f.oddsMinX);
    if (Number.isFinite(f.oddsMaxX)) setOddsMaxX(f.oddsMaxX);
    // Clamped to the sport actually being applied. The decoder can only bound
    // these generously (it doesn't know the sport's team count), and a shared
    // link carrying rankHi=40 would otherwise put the Defense Rank slider
    // past the end of its own track on a 30-team board.
    const rankCeil = feedTeamCount(f.sport || sport);
    if (Number.isFinite(f.rankLo)) setRankLo(Math.min(Math.max(1, f.rankLo), rankCeil));
    if (Number.isFinite(f.rankHi)) setRankHi(Math.min(Math.max(1, f.rankHi), rankCeil));
    if (f.teamFilter) setTeamFilter(f.teamFilter);
    setColumnSort(null);
    // Teams back to whatever matchup ids those teams appear in today.
    const teams = f.gameTeams || [];
    setSelectedGameIds(
      teams.length
        ? new Set(activeMatchupOptions.filter((o) => o.teams.some((t) => teams.includes(t))).map((o) => o.id))
        : new Set()
    );
  }, [activeMatchupOptions, sport]);

  // Applying a preset for a *different* sport can't happen in one pass: the
  // effect above resets every filter whenever the sport changes, so anything
  // set in the same tick is immediately overwritten. The preset is parked
  // here instead and applied once the new sport's rows and matchup options
  // are the live ones. This effect must stay declared *after* that reset
  // effect -- React runs effects in declaration order, and the reverse order
  // would apply the preset and then wipe it.
  const [pendingPreset, setPendingPreset] = useState(null);
  React.useEffect(() => {
    if (!pendingPreset || pendingPreset.sport !== sport) return;
    applyFeedFiltersNow(pendingPreset);
    setPendingPreset(null);
  }, [sport, pendingPreset, applyFeedFiltersNow]);

  const applyFeedFilters = React.useCallback((f) => {
    if (f.sport && f.sport !== sport) {
      setSport(f.sport);
      setPendingPreset(f);
      return;
    }
    applyFeedFiltersNow(f);
  }, [sport, setSport, applyFeedFiltersNow]);

  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presets, setPresets] = useState(loadPresets);
  const [defaultPresetId, setDefaultPresetId] = useState(
    () => localStorage.getItem("propPalaceDefaultPreset") || null
  );
  React.useEffect(() => { savePresets(presets); }, [presets]);
  React.useEffect(() => {
    if (defaultPresetId) localStorage.setItem("propPalaceDefaultPreset", defaultPresetId);
    else localStorage.removeItem("propPalaceDefaultPreset");
  }, [defaultPresetId]);

  // A screen shared via a #screen= link. Parked in state and offered through
  // a banner rather than applied on arrival -- see SharedScreenBanner.
  const [sharedScreen, setSharedScreen] = useState(() => decodeShareLink(window.location.hash));

  // A share link doesn't always arrive as a cold load. Following one while
  // the app is already open is a same-document navigation -- the page never
  // reloads, so the initial read above never re-runs and the link would
  // silently do nothing. replaceState (used below to clear the hash) does not
  // fire hashchange, so this can't loop.
  React.useEffect(() => {
    const onHashChange = () => {
      const s = decodeShareLink(window.location.hash);
      if (s) setSharedScreen(s);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  React.useEffect(() => {
    if (!sharedScreen) return;
    // Clear the hash once it's been read so a reload (or a bookmark) doesn't
    // re-offer the same screen forever.
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [sharedScreen]);

  // The default screen, applied once on the first mount. A shared link takes
  // precedence by suppressing this -- someone who followed a link is here for
  // that board, not their own default.
  const appliedDefault = React.useRef(false);
  React.useEffect(() => {
    if (appliedDefault.current) return;
    appliedDefault.current = true;
    if (sharedScreen || !defaultPresetId) return;
    const p = presets.find((x) => x.id === defaultPresetId);
    if (p) applyFeedFilters(p.filters);
  }, [defaultPresetId, presets, sharedScreen, applyFeedFilters]);

  const appliedPresetName = useMemo(
    () => presets.find((p) => filtersEqual(p.filters, feedFilters))?.name ?? null,
    [presets, feedFilters]
  );

  // Option list for the Team dropdown -- built off the full per-sport row
  // set (not the market-filtered one) so switching prop type never hides a
  // team that's still available under a different market.
  const teamOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.team))).sort(), [rows]);

  // Memoized (rather than a bare .filter recomputed inline in the render
  // body) so its identity is stable across unrelated re-renders -- sortedRows
  // below depends on this array, and without a stable reference it would
  // re-run its own sort on *every* render (a keystroke, a hover, an
  // unrelated state change) regardless of whether the actual row set changed.
  const marketRows = useMemo(
    () => (selectedMarket && selectedMarket !== "all" ? rows.filter((r) => r.marketId === selectedMarket) : rows),
    [rows, selectedMarket]
  );

  // Odds range: the left handle (oddsMinX) maps to the highest probability
  // in range (most negative/favorite odds bound) and the right handle
  // (oddsMaxX) maps to the lowest probability in range (most positive/
  // underdog odds bound) -- see oddsSliderProb. The slider's own extremes
  // (x=4/x=96) now line up exactly with -1000/+1000 odds, so props more
  // extreme than that (e.g. a Triple-Double at 0%/100% hit rate) are always
  // excluded from the feed, even with the slider untouched. That's an
  // intentional cutoff, not a bug -- can be loosened again in the future.
  const oddsLoProb = oddsSliderProb(oddsMaxX);
  const oddsHiProb = oddsSliderProb(oddsMinX);
  const filteredRows = useMemo(() => marketRows.filter((r) => {
    const p = r[sampleWindow];
    if (p < oddsLoProb - 1e-9 || p > oddsHiProb + 1e-9) return false;
    if (r.rank < rankLo || r.rank > rankHi) return false;
    if (showMatchupDropdown) {
      if (selectedGameIds.size > 0) {
        // MLB rows carry the id of the exact game they were built from, so
        // picking one half of a doubleheader narrows to that half. Matching
        // on team alone (still the path for NFL, whose rows have no gameId)
        // would catch both halves, since they share both teams.
        const inSelectedGame = activeMatchupOptions.some((o) =>
          selectedGameIds.has(o.id) && (r.gameId ? r.gameId === o.id : o.teams.includes(r.team))
        );
        if (!inSelectedGame) return false;
      }
    } else if (teamFilter !== "all" && r.team !== teamFilter) {
      return false;
    }
    return true;
  }), [marketRows, sampleWindow, oddsLoProb, oddsHiProb, rankLo, rankHi, showMatchupDropdown, selectedGameIds, activeMatchupOptions, teamFilter]);

  // Badge shown on the Filters trigger -- counts only the controls tucked
  // behind it (Sort By/Odds Range/Defense Rank Range) that are away from
  // their default, so the trigger itself communicates whether there's
  // anything non-default hiding back there before the user opens it.
  const feedActiveFilterCount =
    (sortMode !== "matchup" ? 1 : 0) +
    (oddsMinX !== 4 || oddsMaxX !== 96 ? 1 : 0) +
    (rankLo !== 1 || rankHi !== maxRank ? 1 : 0);

  const activeSortMode = FEED_SORT_MODES.find((mo) => mo.id === sortMode);

  // Hit rate (for whichever sample size is selected) is always the primary
  // sort key so the list never looks "scrambled" relative to %. Picking a
  // different Sort By mode doesn't replace that -- it just breaks ties
  // among equal hit rates using that mode's metric, so e.g. "Easiest
  // Matchup" surfaces the easiest matchup among the 100% hits first, then
  // the easiest among the 90% hits, and so on, instead of ignoring % entirely.
  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    // A clicked table-column header (see FeedTableHeader/onSortColumn)
    // overrides the Sort By dropdown entirely -- sorts by exactly that
    // column's own value, independent of whatever sampleWindow is active,
    // since l5/l10/l20/all each have their own real number on every row.
    if (columnSort) {
      const { key, dir } = columnSort;
      const val = (r) => (key === "line" ? r.line : key === "odds" ? probToAmericanOdds(r[sampleWindow]) : r[key]);
      copy.sort((a, b) => {
        const av = val(a), bv = val(b);
        return dir === "desc" ? bv - av : av - bv;
      });
      return copy;
    }
    copy.sort((a, b) => {
      const aHit = a[sampleWindow], bHit = b[sampleWindow];
      if (bHit !== aHit) return bHit - aHit;
      const av = activeSortMode.metric(a, sampleWindow);
      const bv = activeSortMode.metric(b, sampleWindow);
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return copy;
  }, [filteredRows, sampleWindow, sortMode, sortDir, columnSort]);

  // Renders a growing slice rather than the full (sometimes 2,000+ row) list
  // at once -- MLB in particular mounts a DOM row per player x market, and
  // React.memo on FeedRow only helps re-renders, not the cost of the initial
  // mount. Resets to the first page whenever the visible set's composition
  // changes (any filter, or a switch away and back) rather than whenever
  // sortedRows changes identity, which would also reset it on every sort-only
  // change and undo "load more" each time.
  const FEED_PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);
  React.useEffect(() => {
    setVisibleCount(FEED_PAGE_SIZE);
  }, [sport, selectedMarket, sampleWindow, direction, oddsLoProb, oddsHiProb, rankLo, rankHi, selectedGameIds, teamFilter]);
  const visibleRows = sortedRows.slice(0, visibleCount);

  // Measured live rather than hardcoded -- the rail wraps onto more lines
  // as the window narrows, and the table header pins directly beneath it.
  const filterRailRef = React.useRef(null);
  const filterRailHeight = useElementHeight(filterRailRef);

  // Phone-only: the legend and the "+ adds a prop" explainer are one-time
  // reading, but they were sitting between the controls and the data on every
  // visit -- ~250px of instructions above the first row. Collapsed behind a
  // disclosure they cost one line until asked for.
  const [showFeedKey, setShowFeedKey] = useState(false);

  // Hoisted out of the desktop filter rail so the phone control block can put
  // the same button on the same line as the prop picker.
  const filtersButton = (
    <button
      type="button"
      className="oswald"
      onClick={() => setFeedFiltersOpen((v) => !v)}
      style={{
        cursor: "pointer", padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700,
        border: `1px solid ${feedFiltersOpen ? "var(--amber)" : "var(--line)"}`,
        background: feedFiltersOpen ? "var(--amber-dim)" : "var(--panel)",
        color: feedFiltersOpen ? "var(--amber)" : "var(--text)",
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0, whiteSpace: "nowrap",
      }}
    >
      Filters
      {feedActiveFilterCount > 0 && (
        <span className="mono" style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8,
          fontSize: 10, fontWeight: 800, background: "var(--amber)", color: "var(--accent-on)",
        }}>
          {feedActiveFilterCount}
        </span>
      )}
    </button>
  );

  // Sits beside Filters rather than in Settings: a saved screen is a property
  // of the board you're looking at, and the point is to save what's on screen
  // without leaving it.
  const screensButton = (
    <button
      type="button"
      className="oswald"
      onClick={() => setPresetsOpen(true)}
      title="Saved screens"
      style={{
        cursor: "pointer", padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700,
        border: `1px solid ${appliedPresetName ? "var(--amber)" : "var(--line)"}`,
        background: appliedPresetName ? "var(--amber-dim)" : "var(--panel)",
        color: appliedPresetName ? "var(--amber)" : "var(--text)",
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0, whiteSpace: "nowrap",
        maxWidth: 200,
      }}
    >
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
        {appliedPresetName || "Screens"}
      </span>
      {presets.length > 0 && !appliedPresetName && (
        <span className="mono" style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8,
          fontSize: 10, fontWeight: 800, background: "var(--surface-3, var(--panel2))", color: "var(--dim)",
        }}>
          {presets.length}
        </span>
      )}
    </button>
  );

  // The games strip is itself a game picker, so on a phone the Games dropdown
  // beside it would be a second control for the same job -- MLB gets the strip
  // and drops the dropdown.
  const showGamesStrip = sport === "mlb";

  const resultCount = (
    <>
      Showing <span className="mono" style={{ color: "var(--text)", fontWeight: 700 }}>{filteredRows.length}</span> of{" "}
      <span className="mono" style={{ color: "var(--text)", fontWeight: 700 }}>{rows.length}</span> props
    </>
  );

  return (
    // 900px left ~270px of dead gutter either side of a 1440px window while
    // the table itself overflowed its container -- the feed is a ten-column
    // table, not a reading column, so it gets the same generous ceiling as
    // the single-player pages (1920 there; 1600 here keeps the rows from
    // stretching past the point where scanning a row is comfortable).
    <div className="page-shell" style={{ maxWidth: 1600, margin: "0 auto", boxSizing: "border-box" }}>
      <SharedScreenBanner
        shared={sharedScreen}
        onApply={() => { applyFeedFilters(sharedScreen.filters); setSharedScreen(null); }}
        onDismiss={() => setSharedScreen(null)}
      />
      <FeedPresets
        open={presetsOpen}
        onClose={() => setPresetsOpen(false)}
        isNarrow={isNarrow}
        currentFilters={feedFilters}
        onApply={applyFeedFilters}
        resultCount={filteredRows.length}
        describeArgs={{
          maxRank,
          marketLabel: activeMarketLabel,
          sortLabel: activeSortMode?.label,
        }}
        presets={presets}
        setPresets={setPresets}
        defaultPresetId={defaultPresetId}
        setDefaultPresetId={setDefaultPresetId}
      />
      {/* Phone control block. The desktop layout below stacks each control
          under its own centered uppercase label, which on a 375px screen came
          to roughly 600px of filters -- you scrolled past a screen and a half
          of chrome before the first prop. Here the same controls sit on four
          full-width lines with no labels (a segmented OVER|UNDER needs no
          caption saying SIDE), and the legend moves behind a disclosure. */}
      {isNarrow ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <FeedSegmented
            options={FEED_SPORTS.filter((s) => s.available).map((s) => [s.label, s.id])}
            value={sport}
            onChange={setSport}
            fill
            padding="9px 6px"
          />
          {/* Today's games, moved up here right under the sport switcher so
              it's one of the first things visible instead of sitting below
              the whole filter stack. MLB only for now -- see the note by
              showGamesStrip's definition. */}
          {showGamesStrip && (
            <TodaysGamesStrip
              options={activeMatchupOptions}
              selected={selectedGameIds}
              onChange={setSelectedGameIds}
              logoFn={mlbTeamLogo}
            />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <PropTypePicker groups={propGroups} value={selectedMarket} onChange={setSelectedMarket} fill />
            </div>
            {filtersButton}
          </div>
          <div style={{ display: "flex", gap: 8 }}>{screensButton}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DirectionSwitcher value={direction} onChange={setDirection} fill />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <WindowSwitcher value={sampleWindow} onChange={setSampleWindow} fill />
            </div>
          </div>
          {!showGamesStrip && (
            showMatchupDropdown ? (
              <GamesMultiSelect
                options={activeMatchupOptions}
                selected={selectedGameIds}
                onChange={setSelectedGameIds}
                allLabel={sport === "mlb" ? "All of today's games" : "All of this week's games"}
                logoFn={sport === "mlb" ? mlbTeamLogo : nflTeamLogo}
                fill
              />
            ) : (
              <select className="select" style={{ width: "100%", boxSizing: "border-box" }} value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
                <option value="all">All teams</option>
                {teamOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11.5, color: "var(--dim)" }}>
            <span>{resultCount}</span>
            <span
              role="button"
              onClick={() => setShowFeedKey((v) => !v)}
              style={{ cursor: "pointer", color: "var(--amber)", fontWeight: 600, flexShrink: 0 }}
            >
              {showFeedKey ? "Hide key ▴" : "What am I looking at? ▾"}
            </span>
          </div>
        </div>
      ) : (
      <>
      {/* Sport switcher */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {FEED_SPORTS.map((s) => (
          <div
            key={s.id}
            className="oswald"
            onClick={() => s.available && setSport(s.id)}
            title={s.available ? undefined : "Coming soon"}
            style={{
              cursor: s.available ? "pointer" : "not-allowed",
              padding: "8px 20px",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.03em",
              border: `1px solid ${sport === s.id ? "var(--amber)" : "var(--line)"}`,
              background: sport === s.id ? "var(--amber-dim)" : "var(--panel)",
              color: !s.available ? "#4a5361" : sport === s.id ? "var(--amber)" : "var(--dim)",
              opacity: s.available ? 1 : 0.6,
            }}
          >
            {s.label}
          </div>
        ))}
      </div>

      {/* Today's games, moved up here right under the sport switcher so
          it's one of the first things visible instead of sitting below the
          whole filter stack. MLB only for now -- see the note by
          showGamesStrip's definition. */}
      {showGamesStrip && (
        <TodaysGamesStrip
          options={activeMatchupOptions}
          selected={selectedGameIds}
          onChange={setSelectedGameIds}
          logoFn={mlbTeamLogo}
        />
      )}

      {/* Prop-type picker -- searchable grouped dropdown of every real
           market for this sport, plus pinned quick-pick chips. Replaces the
           old flat category chip row (All/Core/Power/...), which filtered
           down to a bucket of markets rather than landing on one real prop. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <PropTypePicker groups={propGroups} value={selectedMarket} onChange={setSelectedMarket} />
      </div>

      {/* Sticky filter rail -- Games/Team, Sample Size always visible;
           Sort By/Odds Range/Defense Rank Range collapse behind Filters
           (see feedActiveFilterCount below) since they're reached for less
           often. MLB and NFL show a multi-select Games popover (any number
           of today's/this week's games at once) instead of a flat team
           list, since picking a team only ever matters in relation to who
           they're actually playing. NBA/WNBA keep the plain TEAM dropdown. */}
      {/* Sticky only in the table layout. This rail has always been styled
          sticky but never actually stuck (see the overflow-x note in
          index.css); now that it does, pinning it on a phone would cost
          ~18% of the viewport -- it wraps to three lines at 375px -- and
          buy nothing, since the card layout has no column header to keep
          it company. */}
      <div ref={filterRailRef} style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-end", gap: 16,
        marginBottom: 10, position: isNarrow ? "static" : "sticky", top: 0, zIndex: 15, background: "var(--bg)",
        paddingTop: 8, paddingBottom: 12,
      }}>
        {showMatchupDropdown ? (
          <div style={FEED_FILTER_ROW_STYLE}>
            <span className="oswald" style={FEED_LABEL_STYLE}>GAMES</span>
            <GamesMultiSelect
              options={activeMatchupOptions}
              selected={selectedGameIds}
              onChange={setSelectedGameIds}
              allLabel={sport === "mlb" ? "All of today's games" : "All of this week's games"}
              logoFn={sport === "mlb" ? mlbTeamLogo : nflTeamLogo}
            />
          </div>
        ) : (
          <div style={FEED_FILTER_ROW_STYLE}>
            <span className="oswald" style={FEED_LABEL_STYLE}>TEAM</span>
            <select className="select" style={{ width: FEED_CONTROL_WIDTH }} value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="all">All teams</option>
              {teamOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
        <div style={FEED_FILTER_ROW_STYLE}>
          <span className="oswald" style={FEED_LABEL_STYLE}>SIDE</span>
          <DirectionSwitcher value={direction} onChange={setDirection} />
        </div>
        <div style={FEED_FILTER_ROW_STYLE}>
          <span className="oswald" style={FEED_LABEL_STYLE}>SAMPLE SIZE</span>
          <WindowSwitcher value={sampleWindow} onChange={setSampleWindow} />
        </div>
        <div style={FEED_FILTER_ROW_STYLE}>
          <span className="oswald" style={{ ...FEED_LABEL_STYLE, opacity: 0 }}>·</span>
          {filtersButton}
        </div>
        <div style={FEED_FILTER_ROW_STYLE}>
          <span className="oswald" style={{ ...FEED_LABEL_STYLE, opacity: 0 }}>·</span>
          {screensButton}
        </div>
      </div>
      {/* Live result count -- tells the user how much the filters above are
           actually costing them, Outlier-style ("showing N of M props")
           instead of leaving them to count the list. */}
      <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--dim)", marginBottom: 16 }}>
        Showing <span className="mono" style={{ color: "var(--text)", fontWeight: 700 }}>{filteredRows.length}</span> of{" "}
        <span className="mono" style={{ color: "var(--text)", fontWeight: 700 }}>{rows.length}</span> props
      </div>
      </>
      )}

      {feedFiltersOpen && (
      <div style={{
        maxWidth: 480, margin: "0 auto 20px", padding: "16px", background: "var(--panel)",
        border: "1px solid var(--line)", borderRadius: 8,
      }}>
        <div style={FEED_FILTER_ROW_STYLE}>
          <span className="oswald" style={FEED_LABEL_STYLE}>SORT BY</span>
          {/* The "i" info button sits absolutely positioned just outside the
              select's right edge rather than as a normal flex sibling -- as a
              sibling it widens the row and pulls the select's own center left
              of true page-center; positioned this way the select alone
              determines centering and the icon just rides along beside it. */}
          <div style={{ position: "relative", display: "flex" }}>
            <select
              className="select"
              style={{ width: FEED_CONTROL_WIDTH }}
              value={sortMode}
              onChange={(e) => {
                const mode = FEED_SORT_MODES.find((mo) => mo.id === e.target.value);
                setSortMode(mode.id);
                setSortDir(mode.defaultDir);
              }}
            >
              {FEED_SORT_MODES.map((mo) => (
                <option key={mo.id} value={mo.id}>{mo.label}</option>
              ))}
            </select>
            <div style={{ position: "absolute", left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: 8 }}>
              <div
                onClick={() => setShowSortInfo((v) => !v)}
                onMouseEnter={() => setSortInfoHover(true)}
                onMouseLeave={() => setSortInfoHover(false)}
                role="button"
                aria-expanded={showSortInfo}
                className="mono"
                style={{
                  cursor: "pointer",
                  width: 20, height: 20, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                  border: `1px solid ${showSortInfo ? "var(--amber)" : "var(--line-strong)"}`,
                  color: showSortInfo ? "var(--amber)" : "var(--dim)",
                  background: showSortInfo ? "var(--amber-dim)" : "var(--info-btn-bg)",
                }}
              >
                i
              </div>
              {sortInfoHover && (
                // Opens upward (bottom-anchored) rather than downward -- a
                // downward tooltip's height depends on how much room the rows
                // below happen to leave, which varies as filters are added/
                // removed. Anchoring to the icon's own bottom edge means it
                // never depends on that and can't overlap the Odds Range
                // slider beneath it.
                <div
                  className="mono"
                  style={{
                    position: "absolute", bottom: 26, right: 0, zIndex: 10,
                    width: 200, padding: "8px 10px",
                    background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 6,
                    fontSize: 11.5, color: "var(--text)", lineHeight: 1.4,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
                  }}
                >
                  Click to see what each sort option means and how to use it.
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Sort mode explainer -- collapsed by default so it doesn't add
          visual noise for users who already know what each option does.
          Sits here (before the High to low chip, Odds Range, and Defense
          Rank) so expanding it pushes all three down the page together
          instead of shoving just the feed list underneath them. */}
      {showSortInfo && (
        <div
          style={{
            marginBottom: 20, padding: "12px 14px",
            background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 6,
          }}
        >
          {FEED_SORT_MODES.map((mo) => (
            <div key={mo.id} style={{ marginBottom: 10 }}>
              <div
                className="oswald"
                style={{ fontSize: 12.5, fontWeight: 700, color: mo.id === sortMode ? "var(--amber)" : "var(--text)" }}
              >
                {mo.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2, lineHeight: 1.4 }}>
                {mo.description}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 2, fontStyle: "italic" }}>
            Use the ↓/↑ chip to flip any of these (e.g. "Most Consistent" ascending vs. descending).
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        {/* Same technique as the SORT BY select's "i" button above -- the icon
            sits absolutely positioned outside the chip's right edge instead
            of as a normal flex sibling, so the chip alone determines this
            row's centering and lines up with the controls above/below it
            instead of being dragged left by the icon's own width+gap. */}
        <div style={{ position: "relative", display: "flex" }}>
          <div
            className="chip"
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            title="Toggle sort direction"
          >
            {sortDir === "desc" ? "↓ High to low" : "↑ Low to high"}
          </div>
          <div style={{ position: "absolute", left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: 8 }}>
            <div
              onMouseEnter={() => setSortDirInfoHover(true)}
              onMouseLeave={() => setSortDirInfoHover(false)}
              role="button"
              className="mono"
              style={{
                cursor: "default",
                width: 20, height: 20, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                border: "1px solid var(--line-strong)",
                color: "var(--dim)",
                background: "var(--info-btn-bg)",
              }}
            >
              i
            </div>
            {sortDirInfoHover && (
              <div
                className="mono"
                style={{
                  position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 8, zIndex: 10,
                  width: 220, padding: "8px 10px",
                  background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 6,
                  fontSize: 11.5, color: "var(--text)", lineHeight: 1.4,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
                }}
              >
                This chip flips the sort direction for whatever "Sort By" mode is selected above. Click it to switch between "↓ High to low" and "↑ Low to high".
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Odds range filter -- lets you exclude extreme heavy favorites
          and/or extreme longshots so the feed only shows the odds band
          you'd actually consider betting. */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <span className="oswald" style={{ fontSize: 12, fontWeight: 600, color: "var(--dim)", letterSpacing: "0.04em" }}>
            ODDS RANGE
          </span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--amber)" }}>
            {formatOdds(probToAmericanOdds(oddsSliderProb(oddsMinX)), oddsFormat)} to {formatOdds(probToAmericanOdds(oddsSliderProb(oddsMaxX)), oddsFormat)}
          </span>
          {(oddsMinX !== 4 || oddsMaxX !== 96) && (
            <span className="chip" style={{ fontSize: 11, padding: "3px 10px" }} onClick={() => { setOddsMinX(4); setOddsMaxX(96); }}>
              Reset
            </span>
          )}
        </div>
        <div style={{ maxWidth: 420, margin: "0 auto" }}>
          <ThresholdSlider
            min={4}
            max={96}
            step={1}
            lo={oddsMinX}
            hi={oddsMaxX}
            onChangeLo={setOddsMinX}
            onChangeHi={setOddsMaxX}
            rangeEnabled={true}
            onToggleRange={() => {}}
            showToggle={false}
          />
        </div>
      </div>

      {/* Defense rank range filter -- pick exactly which opponent-toughness
          band to look at (#1 = toughest matchup, #N = easiest), instead of
          relying on the Easiest Matchup sort to surface it indirectly. */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <span className="oswald" style={{ fontSize: 12, fontWeight: 600, color: "var(--dim)", letterSpacing: "0.04em" }}>
            DEFENSE RANK RANGE
          </span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--amber)" }}>
            #{rankLo} to #{rankHi}
          </span>
          <span style={{ fontSize: 11, color: "var(--dim)" }}>(1 = toughest, {maxRank} = easiest)</span>
          {(rankLo !== 1 || rankHi !== maxRank) && (
            <span className="chip" style={{ fontSize: 11, padding: "3px 10px" }} onClick={() => { setRankLo(1); setRankHi(maxRank); }}>
              Reset
            </span>
          )}
        </div>
        <div style={{ maxWidth: 420, margin: "0 auto" }}>
          <ThresholdSlider
            min={1}
            max={maxRank}
            step={1}
            lo={rankLo}
            hi={rankHi}
            onChangeLo={setRankLo}
            onChangeHi={setRankHi}
            rangeEnabled={true}
            onToggleRange={() => {}}
            showToggle={false}
          />
        </div>
      </div>
      </div>
      )}

      {/* Feed */}
      {/* On a phone this pair -- the "+" explainer and the matchup/lineup key
          below it -- is ~250px of one-time reading sitting between the
          controls and the data, so it hides behind the "What am I looking
          at?" disclosure. On desktop there's room for it to stay put. */}
      {(!isNarrow || showFeedKey) && (
      <>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10,
        fontSize: 12, color: "var(--dim)", textAlign: "center",
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
          border: "1px solid var(--line)", fontSize: 12, fontWeight: 700, color: "var(--dim)",
        }}>+</span>
        <span>adds a prop to your <b style={{ color: "var(--text)" }}>My Picks</b> slip (bottom right) — stack multiple picks to see the combined parlay odds.</span>
      </div>
      {/* OPP RANK key -- the badge color is the only thing that distinguishes
          a favorable matchup from a tough one at a glance, so it needs its
          own legend rather than relying on the reader to infer it from the
          numbers alone. */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap",
        marginBottom: 10, fontSize: 11.5, color: "var(--dim)",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="mono" style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, fontSize: 10.5, fontWeight: 800, background: "var(--green)", color: "#08131c" }}>#</span>
          Soft matchup
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="mono" style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, fontSize: 10.5, fontWeight: 800, background: "var(--neutral-badge-bg)", color: "var(--dim-strong)", border: "1px solid var(--line-strong)" }}>#</span>
          Average matchup
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="mono" style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, fontSize: 10.5, fontWeight: 800, background: "var(--red)", color: "#08131c" }}>#</span>
          Tough matchup
        </span>
        {/* Key for the avatar's lineup dot. A bare dot is only better than
             the "LINEUP"/"PROJ" chip it replaced if its meaning is stated
             somewhere other than a tooltip -- a hover is not discoverable on
             a phone, and this is the row's one piece of same-day news.
             MLB only, since it's the only sport whose rows carry the flag. */}
        {sport === "mlb" && (
          <>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--pos)", boxSizing: "border-box" }} />
              In posted lineup
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--panel)", border: "1.5px solid var(--line-strong)", boxSizing: "border-box" }} />
              Projected lineup
            </span>
          </>
        )}
      </div>
      </>
      )}
      {/* .feed-table-wrap replaces the old inline overflow:hidden -- see
          index.css for why the horizontal overflow mode has to change with
          the viewport (it decides whether the sticky header below can pin
          to the viewport at all). */}
      <div className="feed-table-wrap">
        {!isNarrow && <FeedTableHeader columnSort={columnSort} onSort={onSortColumn} stickyTop={filterRailHeight} />}
        {sortedRows.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--dim)", fontSize: 14 }}>
            {sport === "mlb" && mlbLoading ? "Loading live MLB matchup data…" : "No props match these filters yet."}
          </div>
        )}
        {/* Per-row rather than only at the app root: these rows are built from
            live-fetched logs for hundreds of players, so one player's odd
            payload is the likeliest single cause of a render throw here. A
            boundary around each row turns that into one greyed-out line
            instead of an empty feed. */}
        {visibleRows.map((r, i) => (
          <ErrorBoundary key={r.key} compact label={`${r.name || "This row"} couldn't be displayed.`}>
          <FeedRow
            r={r}
            sport={sport}
            status={wnbaAvailability && r.espnId ? wnbaAvailability[String(r.espnId)] : undefined}
            sampleWindow={sampleWindow}
            isNarrow={isNarrow}
            isAdded={pickIds.has(feedPickId(sport, r))}
            onTogglePick={onTogglePick}
            onOpenProp={onOpenProp}
            isLast={i === visibleRows.length - 1}
          />
          </ErrorBoundary>
        ))}
      </div>
      {sortedRows.length > visibleRows.length && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
          <button
            type="button"
            className="oswald cta-btn"
            onClick={() => setVisibleCount((v) => v + FEED_PAGE_SIZE)}
            style={{ cursor: "pointer", padding: "9px 22px", borderRadius: 6, fontSize: 13, fontWeight: 700 }}
          >
            Show {Math.min(FEED_PAGE_SIZE, sortedRows.length - visibleRows.length)} more ({visibleRows.length} of {sortedRows.length})
          </button>
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 12, color: "var(--dim)" }}>
        {sport === "mlb"
          ? "Live 2026 regular-season game logs (MLB Stats API) for every team on today's real MLB slate."
          : sport === "nfl"
          ? "Real 2025 regular-season game logs (ESPN Stats API) — the 2026 season hasn't started yet, so this is last season's actual box scores, not a live odds feed."
          : sport === "wnba"
          ? "Live 2026 regular-season game logs (ESPN Stats API), refreshed each session."
          : "Sample data only — generated from the same mock game logs as the single-player pages, not a live odds feed."}
      </div>
    </div>
  );
}

// Fills the wide left/right gutters beside the player selector and market
// grid on desktop (the NYK/SAS Finals matchup means there's a natural
// "other roster" to show) and doubles as a quick-switch so you don't have
// to go back to the dropdown to compare teammates or the opposing five.
// Below the .roster-layout breakpoint, the desktop vertical list is replaced
// entirely by MobilePlayerNav (persistent bottom chip strip + Lineup side
// drawer, rendered once per page rather than once per TeamRosterPanel) --
// see below. TeamRosterPanel itself renders nothing in that range.
function TeamRosterPanel({ teamLabel, players, activeId, onSelect, headshotSrc, headshotFallback, metaLine, avatarBg, statusFor, sections, confirmed }) {
  const compact = useIsNarrow(1100);
  // Pitchers (pos "SP") get sectioned off from the batting order rather than
  // just tacked onto the end of the list -- MLB is the only sport that
  // populates this today, so NBA/NFL rosters (no "SP" entries) render exactly
  // as before, just inside the same scrollable wrapper.
  const batters = players.filter((p) => p.pos !== "SP");
  const pitchers = players.filter((p) => p.pos === "SP");
  // Only treat sections as real when at least one carries a label and some
  // players -- a single unlabelled section means "no split available".
  const labelledSections = sections && sections.some((sec) => sec.label && sec.players.length)
    ? sections.filter((sec) => sec.players.length)
    : null;

  const renderRow = (p) => {
    const active = p.id === activeId;
    return (
      <div
        key={p.id}
        onClick={() => onSelect(p.id)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 6, cursor: "pointer",
          border: `1px solid ${active ? "var(--amber)" : "var(--line)"}`,
          background: active ? "var(--amber-dim)" : "var(--panel)",
        }}
      >
        {/* A 2px inset ring around the photo, filled with the team color,
             instead of a background color the photo could just cover edge-
             to-edge -- some players' official photos are a plain white-
             backdrop studio shot rather than an action shot, which would
             otherwise hide the team color entirely and make that one
             player look inconsistent with the rest of the roster.

             avatarBg is teamAvatarBackground()'s primary->secondary
             gradient, the same treatment the big player-card header avatar
             uses, so every avatar in the app now reads as one component at
             different sizes. It replaced a flat primary-hex fill plus a
             hard 1px ring and a 6px same-color blur, which made these small
             avatars glow far harder than anything else on screen. The
             drop shadow below is deliberately neutral rather than team-
             tinted: avatarBg now returns a linear-gradient() string, which
             cannot be interpolated into a box-shadow color. */}
        <PlayerAvatar
          name={p.name}
          alt={p.name}
          background={avatarBg ? avatarBg(p) : "#000"}
          headshotSrc={headshotSrc(p)}
          fallbackSrc={headshotFallback && headshotFallback(p)}
          status={statusFor && statusFor(p)}
          surface={active ? "var(--amber-dim)" : "var(--panel)"}
          size={30}
          inset={2}
          shadow="0 2px 8px rgba(0,0,0,0.35)"
        />
        <div style={{ minWidth: 0 }}>
          <div
            className="oswald"
            style={{
              fontSize: 12.5, fontWeight: 600, color: active ? "var(--amber)" : "var(--text)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {p.name}
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--dim)" }}>
            {metaLine(p)}
          </div>
        </div>
      </div>
    );
  };

  // Below the roster-panel breakpoint, MobilePlayerNav (rendered once per
  // page) takes over player-switching entirely -- nothing to render here.
  if (compact) return null;

  return (
    // min-height holds this column's height steady across a team switch --
    // the live active-roster/confirmed-lineup fetches that reshape `players`
    // now deliberately keep showing the previous team's roster while they're
    // in flight (see MLBPropsPage's nextGame/teamActiveRoster effects), so
    // without this the column could still visibly shrink for a moment
    // between the old roster clearing and the new one's players arriving.
    <div className="roster-panel" style={{ minHeight: 360 }}>
      <div
        className="oswald"
        style={{ fontSize: 12, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        {teamLabel}
        {confirmed && (
          <span title="Confirmed starting lineup" style={{ color: "var(--green)", fontSize: 13, fontWeight: 900 }}>✓</span>
        )}
      </div>
      {/* No capped height/scroll here -- the column grows to fit the whole
           lineup so nothing is hidden behind an inner scrollbar;
           .roster-layout already aligns columns to the top
           (align-items: start), so a taller column just grows past its
           neighbors instead of stretching them. */}
      <div style={{ paddingRight: 4 }}>
        {pitchers.length > 0 && (
          <>
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em",
              textAlign: "center", marginBottom: 6,
            }}>
              Starting Pitcher
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid var(--line)" }}>
              {pitchers.map(renderRow)}
            </div>
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em",
              textAlign: "center", marginBottom: 6,
            }}>
              Starting Lineup
            </div>
          </>
        )}
        {/* `sections` is only ever set when something real backs the split --
             today, actual starter flags off a box score. Absent (or a single
             unlabelled section) renders the flat list exactly as before, which
             is what a missing/failed starters fetch falls back to. */}
        {labelledSections ? labelledSections.map((sec, i) => (
          <div key={sec.label || i} style={{ marginBottom: i < labelledSections.length - 1 ? 10 : 0 }}>
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6,
              paddingTop: i > 0 ? 10 : 0,
              borderTop: i > 0 ? "1px solid var(--line)" : "none",
              marginBottom: 6,
            }}>
              <span style={{
                fontSize: 10.5, fontWeight: 700, color: "var(--dim)",
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                {sec.label}
              </span>
              {sec.note && (
                <span className="mono" style={{ fontSize: 9, color: "var(--dim)", opacity: 0.8 }}>{sec.note}</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sec.players.map(renderRow)}
            </div>
          </div>
        )) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {batters.map(renderRow)}
          </div>
        )}
      </div>
    </div>
  );
}

// Mobile-only player switcher, rendered once per page (not once per side)
// below the TeamRosterPanel pair -- a persistent bottom strip showing chips
// for the active player's own team only (so switching teams is a deliberate
// action via the drawer, not something you scroll or swipe into by
// accident), plus a "Lineup" entry point into LineupDrawer for the full
// two-team matchup. Replaces TeamRosterPanel's old per-side bottom sheet.
function MobilePlayerNav({ teamA, teamB, activeId, onSelect, headshotSrc, headshotFallback, metaLine, avatarBg, statusFor, chipRole, chipRoleLabel }) {
  const compact = useIsNarrow(1100);
  const [drawerOpen, setDrawerOpen] = useState(false);
  if (!compact) return null;

  const activeInA = (teamA.players || []).some((p) => p.id === activeId);
  const stripPlayers = (activeInA ? teamA : teamB).players || [];
  // Roster panels can render before an async opposing-roster fetch resolves
  // (see MLBPropsPage's nextGame effect) -- nothing to show yet.
  if (!stripPlayers.length) return null;

  // chipRole is optional (only MLB passes it, to flag the starting pitcher) --
  // when present, pull those players to the front of the strip so they read
  // as a distinct group, the same "pitcher first" ordering TeamRosterPanel
  // already uses for the desktop Starting Pitcher / Starting Lineup split.
  const orderedPlayers = chipRole
    ? [...stripPlayers.filter(chipRole), ...stripPlayers.filter((p) => !chipRole(p))]
    : stripPlayers;
  const firstNonRoleIdx = chipRole ? orderedPlayers.findIndex((p) => !chipRole(p)) : -1;

  const renderChip = (p) => {
    const active = p.id === activeId;
    const isRole = chipRole && chipRole(p);
    return (
      <div
        key={p.id}
        onClick={() => onSelect(p.id)}
        role="button"
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0,
          width: 56, padding: "6px 4px 5px", borderRadius: 10, cursor: "pointer",
          border: `1px solid ${active ? "var(--amber)" : isRole ? "var(--amber-dim)" : "var(--line)"}`,
          background: active ? "var(--amber-dim)" : "var(--panel)",
        }}
      >
        <div style={{ position: "relative", width: 32, height: 32, flexShrink: 0 }}>
          <PlayerAvatar
            name={p.name}
            alt={p.name}
            background={avatarBg ? avatarBg(p) : "#000"}
            headshotSrc={headshotSrc(p)}
            fallbackSrc={headshotFallback && headshotFallback(p)}
            status={statusFor && statusFor(p)}
            surface={active ? "var(--amber-dim)" : "var(--panel)"}
            size={32}
            inset={2}
            shadow="0 2px 8px rgba(0,0,0,0.35)"
          />
          {isRole && (
            <span
              className="mono"
              style={{
                position: "absolute", top: -4, right: -4, width: 15, height: 15, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700, lineHeight: 1,
                color: "#000", background: "var(--amber)", border: "1.5px solid var(--panel)",
              }}
            >
              {(chipRoleLabel && chipRoleLabel(p)) || "P"}
            </span>
          )}
        </div>
        <div
          className="oswald"
          style={{
            fontSize: 9.5, fontWeight: 600, color: active ? "var(--amber)" : "var(--dim)",
            textAlign: "center", lineHeight: 1.15, width: "100%",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {p.name.split(" ").slice(-1)[0]}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="mobile-player-strip">
        <div
          onClick={() => setDrawerOpen(true)}
          role="button"
          aria-haspopup="dialog"
          className="mobile-player-strip-lineup-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
          </svg>
          Lineup
        </div>
        <div className="mobile-player-strip-scroll">
          {orderedPlayers.map((p, i) => (
            <React.Fragment key={p.id}>
              {i === firstNonRoleIdx && firstNonRoleIdx > 0 && <div className="mobile-player-strip-divider" />}
              {renderChip(p)}
            </React.Fragment>
          ))}
        </div>
      </div>
      <LineupDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        teamA={teamA}
        teamB={teamB}
        activeId={activeId}
        onSelect={(id) => { onSelect(id); setDrawerOpen(false); }}
        headshotSrc={headshotSrc}
        headshotFallback={headshotFallback}
        statusFor={statusFor}
        metaLine={metaLine}
        avatarBg={avatarBg}
      />
    </>
  );
}

// Slide-in side drawer opened from MobilePlayerNav's "Lineup" button -- the
// full matchup roster for both teams, grouped under team-name headers, so
// switching to a player on the other side doesn't require backing out to
// the market/matchup selector above the chart.
function LineupDrawer({ open, onClose, teamA, teamB, activeId, onSelect, headshotSrc, headshotFallback, metaLine, avatarBg, statusFor }) {
  const renderPlayerRow = (p) => {
    const active = p.id === activeId;
    return (
      <div
        key={p.id}
        onClick={() => onSelect(p.id)}
        role="button"
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
          border: `1px solid ${active ? "var(--amber)" : "var(--line)"}`,
          background: active ? "var(--amber-dim)" : "var(--panel2)",
          marginBottom: 6,
        }}
      >
        <PlayerAvatar
          name={p.name}
          alt={p.name}
          background={avatarBg ? avatarBg(p) : "#000"}
          headshotSrc={headshotSrc(p)}
          fallbackSrc={headshotFallback && headshotFallback(p)}
          status={statusFor && statusFor(p)}
          surface={active ? "var(--amber-dim)" : "var(--panel2)"}
          size={32}
          inset={2}
          shadow="0 2px 8px rgba(0,0,0,0.35)"
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="oswald" style={{ fontSize: 13, fontWeight: 600, color: active ? "var(--amber)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.name}
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--dim)" }}>{metaLine(p)}</div>
        </div>
      </div>
    );
  };

  return (
    <div className={`lineup-drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} role="presentation" aria-hidden={!open}>
      <div className="lineup-drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="oswald" style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Lineup
          </div>
          <div
            onClick={onClose}
            role="button"
            aria-label="Close"
            style={{ cursor: "pointer", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", color: "var(--dim)", fontSize: 15, flexShrink: 0 }}
          >
            ✕
          </div>
        </div>
        {[teamA, teamB].map((team) => (
          <div key={team.label} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              {team.label}
            </div>
            {(team.players || []).map(renderPlayerRow)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Fills the same wide left/right gutters as TeamRosterPanel, but for pages
// where only one real roster is modeled -- instead of an opposing roster to
// switch to, this shows the team's actual next real-world matchup so the
// space still does something useful rather than sitting empty.
function MatchupPanel({ title, opponentAbbr, opponentLogo, lines, loading }) {
  return (
    <div className="roster-panel">
      <div
        className="oswald"
        style={{ fontSize: 12, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center", marginBottom: 8 }}
      >
        {title}
      </div>
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: "16px 12px", textAlign: "center" }}>
        {loading ? (
          <div className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>Loading…</div>
        ) : (
          <>
            {opponentAbbr && (
              <img
                src={opponentLogo}
                alt={opponentAbbr}
                width={56}
                height={56}
                style={{ objectFit: "contain", marginBottom: 10 }}
                onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
              />
            )}
            {lines.map((line, i) => (
              <div
                key={i}
                className={i === 0 ? "oswald" : "mono"}
                style={{
                  fontSize: i === 0 ? 14 : 10.5,
                  fontWeight: i === 0 ? 600 : 500,
                  color: i === 0 ? "var(--text)" : "var(--dim)",
                  marginTop: i === 0 ? 0 : 4,
                  textTransform: i === 0 ? "none" : "uppercase",
                  letterSpacing: i === 0 ? "normal" : "0.04em",
                }}
              >
                {line}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// Single lightweight dropdown for the top-level page nav (Prop Feed / NFL /
// MLB / NBA / WNBA / News) -- replaces the old horizontal-scroll tab strip
// so the header stays a fixed, light-weight control on mobile regardless of
// how many pages exist, instead of growing a longer scrollable row. Routing
// stays exactly the same: it's just `page`/`setPage` behind a closed menu.
function PageNavDropdown({ page, setPage, options }) {
  const [open, setOpen] = useState(false);
  const rootRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [open]);

  const active = options.find((p) => p.id === page) || options[0];

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <div
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="oswald cta-btn"
        style={{
          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 14px", borderRadius: 4, fontSize: 13, fontWeight: 600,
          letterSpacing: "0.03em",
          border: "1px solid var(--amber)",
          background: "var(--amber-dim)", color: "var(--amber)",
        }}
      >
        {active.label}
        <span style={{ fontSize: 9, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>▾</span>
      </div>
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
            minWidth: 180, background: "var(--panel)", border: "1px solid var(--line)",
            borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", overflow: "hidden",
          }}
        >
          {options.map((p) => (
            <div
              key={p.id}
              role="option"
              aria-selected={p.id === page}
              onClick={() => { setPage(p.id); setOpen(false); }}
              className="oswald"
              style={{
                cursor: "pointer", padding: "10px 14px", fontSize: 13, fontWeight: 600,
                letterSpacing: "0.03em", whiteSpace: "nowrap",
                background: p.id === page ? "var(--amber-dim)" : "transparent",
                color: p.id === page ? "var(--amber)" : "var(--dim)",
              }}
            >
              {p.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Global player/team search, rendered once in the header (next to
// PageNavDropdown) so it's identical on every page instead of duplicated
// per sport. `index` is the flat [{key, sport, sportLabel, label, playerId,
// market, searchText}] list built once in PropLedger (see searchIndex) --
// this component only filters/renders it. Picking a result reuses the same
// goToProp(sport, playerId, market) cross-sport jump the Prop Feed's "View
// Chart" buttons already use, so there's no second navigation concept.
// `onOpen` fires the first time the box is focused -- PropLedger uses it to
// kick off the live roster fetch that filters unavailable players out of
// `index`, so that fan-out only happens for sessions that actually search.
function SearchBar({ index, onSelect, onOpen }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return index.filter((item) => item.searchText.includes(q)).slice(0, 8);
  }, [index, q]);

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: 0 }}>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); onOpen?.(); }}
        onFocus={() => { setOpen(true); onOpen?.(); }}
        placeholder="Search players or teams…"
        aria-label="Search players or teams"
        className="select"
        style={{ width: "min(260px, 46vw)", cursor: "text" }}
      />
      {open && q && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
            width: "max(260px, min(320px, 90vw))", maxHeight: 320, overflowY: "auto",
            background: "var(--panel)", border: "1px solid var(--line)",
            borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          {results.length === 0 ? (
            <div className="mono" style={{ padding: "12px 14px", fontSize: 12, color: "var(--dim)" }}>No matches</div>
          ) : (
            results.map((r) => (
              <div
                key={r.key}
                role="option"
                aria-selected={false}
                onClick={() => { onSelect(r); setQuery(""); setOpen(false); }}
                className="oswald"
                style={{
                  cursor: "pointer", padding: "9px 14px", fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  color: "var(--text)",
                }}
              >
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>
                  {r.sportLabel}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Floating "My Picks" launcher + slide-in betslip panel. Lives at the root
// level (rendered by PropLedger, not any one page) so picks persist and stay
// visible while switching between Prop Feed / NBA / NFL / MLB / WNBA tabs.
// Result badge shared by the Ledger's settled rows and the slip's status
// notes. `unsettleable` and `legacy` are deliberately neutral-coloured: they
// are not a bad outcome, they are "this one never had a real result behind
// it," and colouring them red would read as a loss in the record.
const PICK_RESULT_STYLES = {
  won: { label: "WON", color: "var(--pos)", bg: "rgba(76,175,125,0.16)" },
  lost: { label: "LOST", color: "var(--neg)", bg: "rgba(214,84,84,0.16)" },
  unsettleable: { label: "NO RESULT", color: "var(--dim)", bg: "transparent" },
  legacy: { label: "NOT TRACKED", color: "var(--dim)", bg: "transparent" },
};

function PickResultBadge({ result }) {
  const s = PICK_RESULT_STYLES[result];
  if (!s) return null;
  return (
    <span
      className="oswald"
      style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
        padding: "2px 7px", borderRadius: 3, whiteSpace: "nowrap",
        color: s.color, background: s.bg,
        border: s.bg === "transparent" ? "1px solid var(--line-strong)" : "none",
      }}
    >
      {s.label}
    </span>
  );
}

function LedgerStat({ label, value, color, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="oswald" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--dim)", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: color || "var(--text)", marginTop: 2 }}>
        {value}
      </div>
      {/* Dollars go on their own line rather than inline with the units
          figure: these four tiles share one row at 340px wide, and appending
          "($123.45)" to the value wrapped the tile at any realistic total. */}
      {sub && (
        <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: "var(--dim)", marginTop: 1 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function ReportSection({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="oswald" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--dim)", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// One split of the settled record (by sport, market, side, price). Units are
// the headline rather than win-loss, because a 5-5 record at long odds and a
// 5-5 record at heavy favourites are not the same result.
function ReportBreakdownRows({ rows }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {rows.map((b) => (
        <div key={b.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
          <span style={{ color: "var(--text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.label}</span>
          <span className="mono" style={{ flexShrink: 0, color: "var(--dim)" }}>
            {b.won}-{b.lost}{" "}
            <span style={{ color: b.units >= 0 ? "var(--pos)" : "var(--neg)", fontWeight: 700 }}>
              {b.units >= 0 ? "+" : "−"}{Math.abs(b.units).toFixed(2)}u
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

// Reads the slip and the record back in plain sentences. Every line is
// generated from a numeric test over data already on the device -- see the
// Report section above for why there's no model behind it.
function PickReportTab({ openPicks, settledPicks, correlations }) {
  const dollarsPerUnit = useUnitValue();
  const findings = useMemo(() => reportSlipFindings(openPicks), [openPicks]);
  const verdict = useMemo(() => reportSlipVerdict(openPicks, findings, correlations), [openPicks, findings, correlations]);
  const history = useMemo(() => reportHistory(settledPicks), [settledPicks]);
  const snapless = openPicks.filter((p) => !p.snap).length;

  const grouped = useMemo(() => {
    const order = { warn: 0, good: 1, note: 2 };
    const by = new Map();
    [...findings].sort((a, b) => order[a.tone] - order[b.tone]).forEach((f) => {
      by.set(f.who, [...(by.get(f.who) || []), f]);
    });
    return [...by.entries()];
  }, [findings]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
      {openPicks.length === 0 && !history && (
        <div style={{ color: "var(--dim)", fontSize: 12.5, padding: "20px 0", textAlign: "center", lineHeight: 1.5 }}>
          Add some picks and this reads them back to you — what's holding each
          one up, what's working against it, and once you have results, which
          sports and markets you're actually good at.
        </div>
      )}

      {verdict && (
        <ReportSection title="THE SLIP">
          <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, marginBottom: 12 }}>
            {verdict}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {grouped.map(([who, fs]) => (
              <div key={who}>
                <div className="oswald" style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 3 }}>{who}</div>
                {fs.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, fontSize: 11.5, lineHeight: 1.45, marginTop: 2 }}>
                    <span style={{ color: REPORT_TONE[f.tone].color, flexShrink: 0 }}>{REPORT_TONE[f.tone].mark}</span>
                    <span style={{ color: "var(--dim)" }}>{f.text}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {snapless > 0 && (
            <div style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 10, fontStyle: "italic" }}>
              {snapless} older {snapless === 1 ? "pick isn't" : "picks aren't"} covered — they were saved before the Report existed.
            </div>
          )}
        </ReportSection>
      )}

      {history && (
        <>
          <ReportSection title="YOUR RECORD">
            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
              {history.summary.won}-{history.summary.lost} on settled picks,{" "}
              <span style={{ color: history.summary.units >= 0 ? "var(--pos)" : "var(--neg)", fontWeight: 700 }}>
                {formatUnits(history.summary.units, dollarsPerUnit)}
              </span>{" "}
              at a flat 1u a pick.
            </div>
            {/* Stated before any of the breakdowns below, because at these
                sample sizes the breakdowns are the most tempting thing in the
                panel to over-read. */}
            {history.thin && (
              <div style={{ fontSize: 11.5, color: "var(--dim)", lineHeight: 1.45, marginTop: 8 }}>
                That's {history.summary.settled} picks. Anything under {REPORT_MIN_SAMPLE} is
                too small to separate skill from luck, so read the splits below
                as description, not as an edge you've found.
              </div>
            )}
          </ReportSection>

          {history.bySport.length > 1 && (
            <ReportSection title="BY SPORT"><ReportBreakdownRows rows={history.bySport} /></ReportSection>
          )}
          {history.byMarket.length > 1 && (
            <ReportSection title="BY MARKET"><ReportBreakdownRows rows={history.byMarket} /></ReportSection>
          )}
          {history.bySide.length > 1 && (
            <ReportSection title="OVERS VS UNDERS"><ReportBreakdownRows rows={history.bySide} /></ReportSection>
          )}
          {history.byPrice.length > 1 && (
            <ReportSection title="BY PRICE"><ReportBreakdownRows rows={history.byPrice} /></ReportSection>
          )}
        </>
      )}

      <div style={{ fontSize: 10.5, color: "var(--dim)", lineHeight: 1.45, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        Written from your own picks and the game logs on this device — no
        account, no model, no prediction. Each line above is a fact about the
        sample, which is not the same thing as a fact about tonight.
      </div>
    </div>
  );
}

function MyPicksPanel({ picks, open, onToggleOpen, onRemove, onClear, onClearSettled, sportsbook, onOpenSettings }) {
  const [tab, setTab] = useState("slip");
  const oddsFormat = useOddsFormat();
  const dollarsPerUnit = useUnitValue();
  // Escape, scroll lock, focus restore and the back-gesture history entry --
  // none of which this drawer had before. The FAB below still calls
  // onToggleOpen directly to *open*; every close path goes through
  // requestClose so the pushed history entry is consumed rather than orphaned.
  const { panelRef, requestClose } = useOverlay({ open, onClose: onToggleOpen, historyKey: "myPicksPanel" });

  // A pick moves from the slip to the Ledger the moment it has any resolved
  // status -- including "no result", which is still a finished story for that
  // pick and shouldn't sit in the slip pretending to be live.
  const openPicks = picks.filter((p) => !p.result);
  const settledPicks = picks.filter((p) => p.result);
  const summary = ledgerSummary(settledPicks);
  const correlations = parlayCorrelationGroups(openPicks);

  const combined = openPicks.length > 0 ? combineParlayOdds(openPicks.map((p) => p.odds)) : null;
  const book = SPORTSBOOKS.find((b) => b.id === sportsbook) || SPORTSBOOKS[0];

  const tabBtn = (id, label, count) => (
    <div
      onClick={() => setTab(id)}
      role="button"
      className="oswald"
      style={{
        flex: 1, textAlign: "center", cursor: "pointer",
        padding: "9px 0", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em",
        color: tab === id ? "var(--amber)" : "var(--dim)",
        borderBottom: `2px solid ${tab === id ? "var(--amber)" : "transparent"}`,
      }}
    >
      {label}{count > 0 ? ` (${count})` : ""}
    </div>
  );

  return (
    <>
      <div
        onClick={onToggleOpen}
        role="button"
        aria-label="Toggle My Picks panel"
        className="oswald cta-btn"
        style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 2000,
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 18px", borderRadius: 999,
          // A solid --panel fill (not the translucent --amber-dim used by
          // in-flow chips) -- this button floats fixed over whatever's
          // scrolled beneath it, and a semi-transparent background would let
          // that content's color bleed through and shift the button's tone
          // as the page scrolls. --panel is fully opaque so it always reads
          // the same regardless of what's underneath.
          background: "var(--panel)", color: "var(--amber)", border: "1.5px solid var(--amber)",
          fontSize: 14, fontWeight: 700, letterSpacing: "0.02em",
          cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        }}
      >
        My Picks
        {openPicks.length > 0 && (
          <span className="mono" style={{ background: "var(--amber)", color: "var(--accent-on)", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>
            {openPicks.length}
          </span>
        )}
      </div>

      {open && (
        <div
          onClick={requestClose}
          style={{
            position: "fixed", inset: 0, zIndex: 2090,
            background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          }}
        />
      )}
      {open && (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="My Picks"
          style={{
            position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 2100,
            width: 340, maxWidth: "92vw",
            background: "var(--panel)", borderLeft: "1px solid var(--line)",
            boxShadow: "-6px 0 24px rgba(0,0,0,0.45)",
            display: "flex", flexDirection: "column",
            outline: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px", borderBottom: "1px solid var(--line)" }}>
            <span className="oswald" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.03em" }}>MY PICKS</span>
            <div onClick={requestClose} role="button" aria-label="Close My Picks panel" style={{ cursor: "pointer", color: "var(--dim)", fontSize: 20, lineHeight: 1 }}>×</div>
          </div>

          <div style={{ display: "flex", borderBottom: "1px solid var(--line)" }}>
            {tabBtn("slip", "SLIP", openPicks.length)}
            {tabBtn("ledger", "LEDGER", settledPicks.length)}
            {tabBtn("report", "REPORT", 0)}
          </div>

          {tab === "report" ? (
            <PickReportTab openPicks={openPicks} settledPicks={settledPicks} correlations={correlations} />
          ) : tab === "slip" ? (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px" }}>
                {openPicks.length === 0 ? (
                  <div style={{ color: "var(--dim)", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
                    Tap the + on any prop in the Prop Feed to add it here.
                  </div>
                ) : (
                  openPicks.map((p) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                      <PlayerAvatar
                        name={p.name}
                        sport={p.sport}
                        team={p.team}
                        colorMap={FEED_TEAM_COLORS[p.sport]}
                        headshotSrc={p.avatar}
                        fallbackSrc={p.avatarFallback}
                        status={pickStatus(p)}
                        surface="var(--panel)"
                        size={34}
                        inset={2}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="oswald" style={{ fontSize: 13.5, color: "var(--text)" }}>
                          {p.name} <span style={{ color: "var(--dim)", fontWeight: 400 }}>({p.team})</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--amber)", fontWeight: 600, marginTop: 1 }}>{p.subtitle}</div>
                        <div style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 2 }}>vs {p.opp}</div>
                        {/* Says up front which picks will never reach the
                            Ledger, rather than letting them sit in the slip
                            looking live forever. */}
                        {pickIsLegacy(p) ? (
                          <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 3, fontStyle: "italic" }}>
                            Saved before results were tracked — won't be graded.
                          </div>
                        ) : !p.gradeKind || !p.gradeId ? (
                          <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 3, fontStyle: "italic" }}>
                            {p.sport === "nba"
                              ? "NBA data here is simulated — can't be graded."
                              : "No real game log for this player — can't be graded."}
                          </div>
                        ) : pickGameIsFinal(p) ? (
                          <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 3, fontStyle: "italic" }}>
                            Waiting on the box score.
                          </div>
                        ) : null}
                      </div>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", flexShrink: 0 }}>
                        {formatOdds(p.odds, oddsFormat)}
                      </div>
                      <div
                        onClick={() => onRemove(p.id)}
                        role="button"
                        aria-label={`Remove ${p.name} from My Picks`}
                        style={{ cursor: "pointer", color: "var(--dim)", fontSize: 16, flexShrink: 0, padding: "0 2px" }}
                      >
                        ×
                      </div>
                    </div>
                  ))
                )}
              </div>

              {openPicks.length > 0 && (
                <div style={{ borderTop: "1px solid var(--line)", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="oswald" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--dim)", letterSpacing: "0.03em" }}>
                      {openPicks.length > 1 ? "COMBINED PARLAY ODDS" : "ODDS"}
                    </span>
                    <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--amber)" }}>
                      {formatOdds(combined, oddsFormat)}
                    </span>
                  </div>

                  {/* Correlation warning. The combined price above is the legs
                      multiplied together, which is only right if the legs are
                      independent -- and two markets on one player, or two
                      players in one game, plainly aren't. Rather than quote a
                      "corrected" number the app has no way to compute, this
                      names the overlapping legs and says which way the error
                      runs. See parlayCorrelationGroups. */}
                  {correlations.length > 0 && (
                    <div style={{ border: "1px solid var(--line-strong)", borderRadius: 4, padding: "9px 10px" }}>
                      <div className="oswald" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "var(--amber)", marginBottom: 4 }}>
                        ⚠ CORRELATED LEGS
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--dim)", lineHeight: 1.45 }}>
                        {correlations.map((g, i) => (
                          <div key={i} style={{ color: "var(--text)", marginBottom: 2 }}>
                            {g.picks.length} legs on {g.kind === "player" ? g.label : `${g.label}`}
                          </div>
                        ))}
                        These move together, so the price above — which assumes
                        every leg is independent — is optimistic. Treat it as a
                        ceiling, not the real number.
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--dim)" }}>Sportsbook: <span style={{ color: "var(--text)", fontWeight: 600 }}>{book.label}</span></span>
                    <span
                      onClick={onOpenSettings}
                      role="button"
                      style={{ color: "var(--amber)", cursor: "pointer", fontWeight: 600 }}
                    >
                      Change in Settings ⚙
                    </span>
                  </div>

                  <div
                    onClick={() => window.open(book.url, "_blank", "noopener,noreferrer")}
                    role="button"
                    className="oswald cta-btn"
                    style={{
                      cursor: "pointer", textAlign: "center", padding: "10px 0", borderRadius: 4,
                      background: "var(--amber)", color: "var(--accent-on)", fontSize: 13.5, fontWeight: 700, letterSpacing: "0.02em",
                      boxShadow: "0 2px 10px color-mix(in srgb, var(--amber) 18%, transparent)",
                    }}
                  >
                    Open in {book.label} →
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--dim)", lineHeight: 1.4 }}>
                    Opens {book.label} in a new tab -- sportsbooks don't offer a public way to prefill a bet slip, so you'll still need to search and add these picks there yourself.
                  </div>

                  <div
                    onClick={onClear}
                    role="button"
                    className="oswald danger-btn"
                    style={{
                      cursor: "pointer", textAlign: "center", padding: "8px 0", borderRadius: 4,
                      fontSize: 12, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase",
                    }}
                  >
                    Clear slip
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {summary.settled > 0 && (
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", gap: 10 }}>
                  <LedgerStat label="RECORD" value={`${summary.won}-${summary.lost}`} />
                  <LedgerStat label="HIT RATE" value={`${Math.round(summary.hitRate * 100)}%`} />
                  <LedgerStat
                    label={dollarsPerUnit ? "PROFIT" : "UNITS"}
                    value={formatUnits(summary.units, null)}
                    sub={dollarsPerUnit ? formatUnits(summary.units, dollarsPerUnit, { parens: false }) : null}
                    color={summary.units >= 0 ? "var(--pos)" : "var(--neg)"}
                  />
                  <LedgerStat
                    label="ROI"
                    value={`${summary.roi >= 0 ? "+" : "−"}${Math.abs(summary.roi * 100).toFixed(1)}%`}
                    color={summary.roi >= 0 ? "var(--pos)" : "var(--neg)"}
                  />
                </div>
              )}

              <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px" }}>
                {settledPicks.length === 0 ? (
                  <div style={{ color: "var(--dim)", fontSize: 12.5, padding: "24px 0", textAlign: "center", lineHeight: 1.5 }}>
                    Nothing settled yet. Picks land here automatically once the
                    game is played and the box score posts — no need to grade
                    anything yourself.
                  </div>
                ) : (
                  settledPicks.map((p) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                      <PlayerAvatar
                        name={p.name}
                        sport={p.sport}
                        team={p.team}
                        colorMap={FEED_TEAM_COLORS[p.sport]}
                        headshotSrc={p.avatar}
                        fallbackSrc={p.avatarFallback}
                        status={pickStatus(p)}
                        surface="var(--panel)"
                        size={34}
                        inset={2}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="oswald" style={{ fontSize: 13.5, color: "var(--text)" }}>
                          {p.name} <span style={{ color: "var(--dim)", fontWeight: 400 }}>({p.team})</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--dim)", fontWeight: 600, marginTop: 1 }}>{p.subtitle}</div>
                        <div className="mono" style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 3 }}>
                          {p.resultValue != null
                            ? `Actual ${p.resultValue} · ${formatOdds(p.odds, oddsFormat)}`
                            : p.result === "unsettleable"
                              ? "No real game log for this player"
                              : formatOdds(p.odds, oddsFormat)}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <PickResultBadge result={p.result} />
                        {(p.result === "won" || p.result === "lost") && (
                          <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: p.result === "won" ? "var(--pos)" : "var(--neg)" }}>
                            {formatUnits(pickUnitProfit(p), dollarsPerUnit)}
                          </span>
                        )}
                      </div>
                      <div
                        onClick={() => onRemove(p.id)}
                        role="button"
                        aria-label={`Remove ${p.name} from the Ledger`}
                        style={{ cursor: "pointer", color: "var(--dim)", fontSize: 16, flexShrink: 0, padding: "0 2px" }}
                      >
                        ×
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ borderTop: "1px solid var(--line)", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 10.5, color: "var(--dim)", lineHeight: 1.45 }}>
                  Graded from each player's own game log, at a flat 1 unit per
                  pick.{" "}
                  {dollarsPerUnit
                    ? `Dollar figures use the unit size in Settings (1u = $${dollarsPerUnit.toFixed(2)}) and are worked out from the units on the fly, so changing it never rewrites a settled result.`
                    : "Set a bankroll in Settings to see this in dollars as well."}{" "}
                  Picks with no real log behind them (NBA is simulated data)
                  stay in the slip marked as ungradable and never enter this
                  record.
                </div>
                {settledPicks.length > 0 && (
                  <div
                    onClick={onClearSettled}
                    role="button"
                    className="oswald danger-btn"
                    style={{
                      cursor: "pointer", textAlign: "center", padding: "8px 0", borderRadius: 4,
                      fontSize: 12, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase",
                    }}
                  >
                    Clear history
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default function PropLedger() {
  const [page, setPage] = useState("feed");

  // Theme, accent colour and the default sportsbook used to be three pieces
  // of state here, each with its own localStorage key and persistence effect.
  // They now live in the settings store (src/settings.jsx), which also owns
  // applying data-theme/--accent-color/--accent-on to the document -- see the
  // effects in SettingsProvider, which are the ones that used to be here.
  const settings = useSettings();
  const { sportsbook } = settings.betting;

  // Lives here rather than inside PropFeedPage so it survives navigating
  // away to a single-player page and back -- PropFeedPage unmounts on every
  // such trip, which would otherwise reset the sport switcher to its
  // default every time.
  //
  // Seeded once, from Settings > Betting > Default sport. "auto" falls
  // through to defaultFeedSport(), the seasonal MLB->NFL pick this had before
  // the setting existed. Deliberately only an initial value: changing the
  // setting shouldn't yank the board out from under someone mid-session, it
  // should decide where the next visit opens.
  const [feedSport, setFeedSport] = useState(() => {
    const pref = settings.betting.defaultSport;
    return pref && pref !== "auto" ? pref : defaultFeedSport();
  });

  const [myPicks, setMyPicks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("propLedgerPicks") || "[]"); } catch { return []; }
  });
  const [picksOpen, setPicksOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Drives the Settings dialog's centered-vs-bottom-sheet placement. 560 is
  // the same breakpoint the header tagline drops at (.hide-narrow).
  const isNarrowShell = useIsNarrow(560);

  React.useEffect(() => {
    localStorage.setItem("propLedgerPicks", JSON.stringify(myPicks));
  }, [myPicks]);

  const pickIds = useMemo(() => new Set(myPicks.map((p) => p.id)), [myPicks]);
  const togglePick = (pick) => {
    setMyPicks((cur) => (cur.some((p) => p.id === pick.id) ? cur.filter((p) => p.id !== pick.id) : [...cur, pick]));
  };
  const removePick = (id) => setMyPicks((cur) => cur.filter((p) => p.id !== id));
  // "Clear slip" and "Clear history" are separate on purpose -- emptying the
  // slip must not wipe a settled record, and vice versa.
  const clearPicks = () => setMyPicks((cur) => cur.filter((p) => p.result));
  const clearSettledPicks = () => setMyPicks((cur) => cur.filter((p) => !p.result));

  // Settles saved picks against the game logs the app already fetches and
  // caches. Runs when the app mounts and whenever the panel is opened, only
  // for picks that are still ungraded and whose game has already started --
  // so on the common path it costs no network requests at all, just cache
  // reads. `gradeAttempted` stops a pick whose box score hasn't posted yet
  // from being re-requested every time the picks array changes; it clears
  // itself on reload, which is when it's worth trying again.
  const gradeAttempted = React.useRef(new Set());
  React.useEffect(() => {
    const todo = myPicks.filter(
      (p) => !p.result && !gradeAttempted.current.has(p.id) && !pickIsLegacy(p) && pickGameIsFinal(p)
    );
    if (!todo.length) return;
    todo.forEach((p) => gradeAttempted.current.add(p.id));

    let cancelled = false;
    Promise.all(todo.map((p) => gradePick(p).then((g) => [p.id, g]).catch(() => [p.id, { status: "pending" }])))
      .then((entries) => {
        if (cancelled) return;
        const settled = entries.filter(([, g]) => g.status !== "pending");
        if (!settled.length) return;
        const byId = new Map(settled);
        setMyPicks((cur) => cur.map((p) => {
          const g = byId.get(p.id);
          // Never re-grade a pick that already has a result -- a settled
          // record shouldn't move under the user.
          if (!g || p.result) return p;
          return { ...p, result: g.status, resultValue: g.value ?? null, gradedAt: Date.now() };
        }));
      });
    // Releasing the claim on cancel matters: a cancelled pass throws its
    // results away, so leaving those ids marked as attempted would mean
    // nothing ever grades them. StrictMode's dev double-invoke hits exactly
    // this path -- the first pass claims every id and is then cancelled, and
    // without the release the second pass finds nothing to do.
    return () => {
      cancelled = true;
      todo.forEach((p) => gradeAttempted.current.delete(p.id));
    };
  }, [myPicks, picksOpen]);

  // MLB_TEAM_DEF starts out as mock data (see its definition above) so the
  // page never has to show a loading state -- this swaps in the real,
  // nightly-refreshed ranking from /api/mlb-matchups once it's available.
  // No-ops harmlessly if that endpoint isn't deployed (e.g. local `vite dev`).
  const [, bumpMlbDefRefresh] = React.useReducer((c) => c + 1, 0);
  React.useEffect(() => {
    let cancelled = false;
    loadRealMlbTeamDef().then((byTeam) => {
      if (cancelled || !byTeam) return;
      applyMlbTeamDef(byTeam);
      bumpMlbDefRefresh();
    });
    return () => { cancelled = true; };
  }, []);

  // Same instant-fallback-then-upgrade pattern as the MLB matchup effect
  // above, but for the NFL page: real per-player 2025 game logs and a real
  // points-allowed-based defense ranking both fetch from ESPN's public API
  // once on mount, replacing the synthetic/mock data the page starts with as
  // each player's log resolves. Nothing here is nightly-refreshed like the
  // MLB matchup data -- the 2025 NFL season is already final, so this data
  // is fixed and only needs to be fetched once per browser tab.
  //
  // nflDataVersion is threaded down to NFLPropsPage as a prop and added to
  // its own game-log useMemo's dependency array -- without it, a player
  // selected before the fetch resolves would keep showing whatever it
  // started with forever, since the player object's identity never changes
  // (only switching to a *different* player would otherwise pick up real
  // data, by accident of that useMemo recomputing for a new key).
  const [nflDataVersion, bumpNflRefresh] = React.useReducer((c) => c + 1, 0);
  React.useEffect(() => {
    let cancelled = false;

    fetchNFLTeamDefense().then((byTeam) => {
      if (cancelled || !byTeam) return;
      nflTeamDefReal = byTeam;
      bumpNflRefresh();
    });

    ALL_NFL_PLAYERS.forEach((player) => {
      const espnId = NFL_ESPN_ID[player.id];
      if (!espnId) return;
      fetchNFLPlayerGameLogForDisplay(espnId).then((games) => {
        if (cancelled || !games) return;
        NFL_REAL_GAME_LOGS[player.id] = games;
        bumpNflRefresh();
      });
    });

    return () => { cancelled = true; };
  }, []);

  // Same pattern again for WNBA -- live season, so both the game logs and
  // the defense ranking use short TTLs and can refresh more than once per
  // tab (see fetchWNBAPlayerGameLog/fetchWNBATeamDefense).
  const [wnbaDataVersion, bumpWnbaRefresh] = React.useReducer((c) => c + 1, 0);
  React.useEffect(() => {
    let cancelled = false;

    fetchWNBATeamDefense().then((byTeam) => {
      if (cancelled || !byTeam) return;
      wnbaTeamDefReal = byTeam;
      bumpWnbaRefresh();
    });

    // Keyed by espnId, not by our slug, so a player who only exists on the
    // live roster resolves the same way a hand-written one does. Driven off
    // every rostered player across the league rather than ALL_WNBA_PLAYERS,
    // which covered only the ten teams we had written out by hand.
    // The feed needs the slate too -- it dates every pick off it -- and the
    // feed can be the first thing a user opens, before the WNBA props page has
    // ever mounted.
    fetchWNBALiveSlate().then(() => { if (!cancelled) bumpWnbaRefresh(); });

    fetchWNBAAllRosters().then((players) => {
      if (cancelled || !players) return;
      players.forEach((player) => {
        if (!player.espnId) return;
        fetchWNBAPlayerGameLog(player.espnId).then((games) => {
          if (cancelled || !games || !games.length) return;
          WNBA_REAL_GAME_LOGS[String(player.espnId)] = games;
          bumpWnbaRefresh();
        });
      });
    });

    return () => { cancelled = true; };
  }, []);

  // "View Chart" jump from the Prop Feed -- every sport page owns its own
  // player/market state internally (see e.g. NBAPropsPage/WNBAPropsPage),
  // so this just hands each page a jumpTo object (nonce forces the effect
  // to fire even if the same prop is clicked twice in a row).
  const [jumpTo, setJumpTo] = useState(null);
  const goToProp = (targetSport, targetPlayerId, targetMarket, meta) => {
    setJumpTo({ sport: targetSport, playerId: targetPlayerId, market: targetMarket, nonce: Date.now(), meta });
    setPage(targetSport);
  };

  // "View Props for this Game" on the Matchup Overview. The Prop Feed's own
  // matchup filter (see GamesMultiSelect) is internal state keyed off the
  // feed's own matchup list, so this lands on the right sport's feed rather
  // than pre-filtering to the one game -- narrowing further would mean
  // threading initial-filter state through PropFeedPage and reconciling two
  // different game-id shapes.
  const goToGameProps = (game) => {
    setFeedSport(game.sport);
    setPage("feed");
  };

  // Live availability filter for the MLB half of the search index below.
  // Loaded lazily the first time the search box is focused rather than on
  // mount -- it fans out to 30 team-roster requests, and a session that never
  // opens search shouldn't pay for them (on an MLB page they're already
  // cached anyway). Re-polled on the same TTL as everywhere else so a
  // same-day IL move or call-up reaches search without a reload.
  const [searchOpened, setSearchOpened] = useState(false);
  const [mlbActiveIds, setMlbActiveIds] = useState(null);
  React.useEffect(() => {
    if (!searchOpened) return;
    let cancelled = false;
    const load = () => { fetchAllMLBActiveMlbIds().then((ids) => { if (!cancelled) setMlbActiveIds(ids); }); };
    load();
    const interval = setInterval(load, MLB_ACTIVE_ROSTER_TTL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [searchOpened]);

  // Flat player/team index for the header's global SearchBar -- built once
  // from the same static player pools each sport page already draws from,
  // plus one entry per real MLB team (MLB_TEAM_ROSTERS is the only one of
  // the four sports modeling all 30 league teams rather than a fixed
  // matchup). Each entry's `market` is just that sport's default -- the
  // destination page's own player-switch effect (see e.g. MLBPropsPage's
  // "market still applies to them" effect) reconciles it if the picked
  // player/team needs a different one (e.g. a pitcher).
  const searchIndex = useMemo(() => {
    const entries = [];
    ALL_NFL_PLAYERS.forEach((p) => entries.push({
      key: `nfl_${p.id}`, sport: "nfl", sportLabel: "NFL", label: p.name, playerId: p.id, market: "passYds",
      searchText: `${p.name} ${p.team}`.toLowerCase(),
    }));
    ALL_NBA_PLAYERS.forEach((p) => entries.push({
      key: `nba_${p.id}`, sport: "nba", sportLabel: "NBA", label: p.name, playerId: p.id, market: "pts",
      searchText: `${p.name} ${p.team}`.toLowerCase(),
    }));
    ALL_WNBA_PLAYERS.forEach((p) => entries.push({
      key: `wnba_${p.id}`, sport: "wnba", sportLabel: "WNBA", label: p.name, playerId: p.id, market: "pts",
      searchText: `${p.name} ${p.team}`.toLowerCase(),
    }));
    // Hidden while a player isn't on anyone's active roster. This isn't
    // cosmetic: the roster panels already drop IL'd/traded players
    // (reconcileMlbLineup), so a search hit for one used to navigate to a
    // page that couldn't find them and silently rendered a *different*
    // player's chart instead. Until mlbActiveIds resolves it's null and
    // nothing is filtered, same fallback rule as everywhere else.
    ALL_MLB_PLAYERS.filter((p) => !mlbActiveIds || mlbActiveIds.has(p.mlbId)).forEach((p) => entries.push({
      key: `mlb_${p.id}`, sport: "mlb", sportLabel: "MLB", label: p.name, playerId: p.id, market: "h",
      searchText: `${p.name} ${p.team}`.toLowerCase(),
    }));
    Object.entries(MLB_TEAM_ROSTERS).forEach(([abbr, roster]) => {
      if (!roster.players.length) return;
      entries.push({
        key: `mlb_team_${abbr}`, sport: "mlb", sportLabel: "MLB Team", label: roster.label,
        playerId: roster.players[0].id, market: "h", searchText: `${roster.label} ${abbr}`.toLowerCase(),
      });
    });
    return entries;
  }, [mlbActiveIds]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "inherit" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--line)", padding: "16px", background: "linear-gradient(to bottom, rgba(255,255,255,0.015), transparent)" }}>
        {/* Wordmark + tagline on the left, Settings gear pinned to the right
             edge of the same row. The gear used to be position:fixed at
             z-index 4000 so it floated over the player cards for the whole
             scroll; it's now an ordinary header control that scrolls away
             with everything else. Nothing else relied on that top layer --
             every drawer/sheet (2100/3000/3501) simply covers it now, which
             is the correct reading for a header button. */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", minWidth: 0 }}>
            {/* The three-bar mark takes var(--amber) rather than a fixed brand
                 hex so the wordmark tracks whatever accent the user picks in
                 the color wheel -- it can't clash with their accent because it
                 is their accent. clamp() covers phone through desktop in one
                 declaration instead of a breakpoint ternary. */}
            <h1
              className="pp-display"
              onClick={() => setPage("feed")}
              role="button"
              tabIndex={0}
              aria-label="Go to feed"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPage("feed"); } }}
              style={{
                fontSize: "clamp(18px, 4vw, 24px)", fontWeight: 600, letterSpacing: "0.06em",
                margin: 0, color: "var(--text)", display: "flex", alignItems: "center", gap: 10,
                whiteSpace: "nowrap", cursor: "pointer",
              }}
            >
              {/* Bars sit on a shared baseline (align-items: flex-end) at the
                  handoff's 12 / 21 / 16 heights, rounded on the top edge only
                  so they read as a rising bar chart rather than three pills. */}
              <span style={{ display: "flex", alignItems: "flex-end", gap: 3 }} aria-hidden="true">
                {[12, 21, 16].map((h) => (
                  <span key={h} style={{ width: 6, height: h, background: "var(--amber)", borderRadius: "3px 3px 0 0" }} />
                ))}
              </span>
              <span>PROP PALACE</span>
            </h1>
            {/* Hidden on a phone: it wrapped to two lines directly under the
                wordmark, and a tagline is not worth 45px of a 812px screen
                above the controls. */}
            <span className="hide-narrow" style={{ color: "var(--dim)", fontSize: 13 }}>your own hit-rate research, before you place it</span>
          </div>
          <div
            onClick={() => setSettingsOpen((v) => !v)}
            role="button"
            aria-label="Toggle Settings panel"
            title="Settings"
            style={{
              flexShrink: 0,
              width: 36, height: 36, borderRadius: 8, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid var(--line)", background: "var(--panel2)", color: "var(--dim)", fontSize: 18,
            }}
          >
            ⚙
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <PageNavDropdown
            page={page}
            setPage={setPage}
            options={[
              { id: "feed", label: "Prop Feed" },
              { id: "games", label: "Games" },
              { id: "nfl", label: "NFL Props" },
              { id: "mlb", label: "MLB Props" },
              { id: "nba", label: "NBA Props" },
              { id: "wnba", label: "WNBA Props" },
              { id: "news", label: "News" },
            ]}
          />
          {/* Global search -- same on every page (see SearchBar), reuses
               goToProp for navigation so picking a result works exactly like
               clicking "View Chart" on a Prop Feed row. */}
          <SearchBar index={searchIndex} onOpen={() => setSearchOpened(true)} onSelect={(r) => goToProp(r.sport, r.playerId, r.market)} />
        </div>
      </div>

      {page === "nba" && (
        <NBAPropsPage jumpTo={jumpTo && jumpTo.sport === "nba" ? jumpTo : null} />
      )}

      {page === "wnba" && (
        <WNBAPropsPage jumpTo={jumpTo && jumpTo.sport === "wnba" ? jumpTo : null} dataVersion={wnbaDataVersion} />
      )}

      {page === "nfl" && (
        <NFLPropsPage jumpTo={jumpTo && jumpTo.sport === "nfl" ? jumpTo : null} dataVersion={nflDataVersion} />
      )}

      {page === "mlb" && (
        <MLBPageErrorBoundary>
          <MLBPropsPage jumpTo={jumpTo && jumpTo.sport === "mlb" ? jumpTo : null} />
        </MLBPageErrorBoundary>
      )}

      {page === "feed" && (
        <PropFeedPage onOpenProp={goToProp} pickIds={pickIds} onTogglePick={togglePick} nflDataVersion={nflDataVersion} wnbaDataVersion={wnbaDataVersion} sport={feedSport} setSport={setFeedSport} />
      )}

      {page === "games" && <LazyPane minHeight={400}><GamesPage onViewProps={goToGameProps} /></LazyPane>}

      {page === "news" && <LazyPane minHeight={400}><NewsPage /></LazyPane>}

      <MyPicksPanel
        picks={myPicks}
        open={picksOpen}
        onToggleOpen={() => setPicksOpen((v) => !v)}
        onRemove={removePick}
        onClear={clearPicks}
        onClearSettled={clearSettledPicks}
        sportsbook={sportsbook}
        onOpenSettings={() => { setPicksOpen(false); setSettingsOpen(true); }}
      />
      {/* Reads and writes every preference through the settings context, so
          the only thing it needs from here is the sportsbook list (which
          lives in this module) and the breakpoint. */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isNarrow={isNarrowShell}
        sportsbooks={SPORTSBOOKS}
      />
    </div>
  );
}
