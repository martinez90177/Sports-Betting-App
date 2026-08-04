import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell, LabelList
} from "recharts";
import NewsPage from "./NewsPage.jsx";
import PlayerNewsModule from "./PlayerNewsModule.jsx";
import ColorWheel from "./ColorWheel.jsx";

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
const NBA_TEAM_COLORS = {
  ATL: { primary: "#E03A3E", secondary: "#26282A" },
  BOS: { primary: "#007A33", secondary: "#BA9653" },
  BKN: { primary: "#000000", secondary: "#777D84" },
  CHA: { primary: "#1D1160", secondary: "#00788C" },
  CHI: { primary: "#CE1141", secondary: "#000000" },
  CLE: { primary: "#860038", secondary: "#FDBB30" },
  DAL: { primary: "#00538C", secondary: "#B8C4CA" },
  DEN: { primary: "#0E2240", secondary: "#FEC524" },
  DET: { primary: "#C8102E", secondary: "#1D42BA" },
  GSW: { primary: "#1D428A", secondary: "#FFC72C" },
  HOU: { primary: "#CE1141", secondary: "#000000" },
  IND: { primary: "#002D62", secondary: "#FDBB30" },
  LAC: { primary: "#C8102E", secondary: "#1D428A" },
  LAL: { primary: "#552583", secondary: "#FDB927" },
  MEM: { primary: "#5D76A9", secondary: "#12173F" },
  MIA: { primary: "#98002E", secondary: "#F9A01B" },
  MIL: { primary: "#00471B", secondary: "#EEE1C6" },
  MIN: { primary: "#0C2340", secondary: "#236192" },
  NOP: { primary: "#0C2340", secondary: "#C8102E" },
  NYK: { primary: "#006BB6", secondary: "#F58426" },
  OKC: { primary: "#007AC1", secondary: "#EF3B24" },
  ORL: { primary: "#0077C0", secondary: "#C4CED4" },
  PHI: { primary: "#006BB6", secondary: "#ED174C" },
  PHX: { primary: "#1D1160", secondary: "#E56020" },
  POR: { primary: "#E03A3E", secondary: "#000000" },
  SAC: { primary: "#5A2D81", secondary: "#63727A" },
  SAS: { primary: "#8A8D8F", secondary: "#000000" },
  TOR: { primary: "#CE1141", secondary: "#000000" },
  UTA: { primary: "#002B5C", secondary: "#F9A01B" },
  WAS: { primary: "#002B5C", secondary: "#E31837" },
};

// Subtle team-tinted background for a player avatar's ring: a diagonal blend
// of the team's two brand colors, darkened with a black overlay so it always
// reads as a muted frame rather than a bright disc competing with the
// headshot. Shared by every page's avatar (NBA/NFL/MLB) -- each just passes
// its own team-color map. Falls back to a neutral dark gradient for any
// team missing from that map.
const AVATAR_FALLBACK_COLORS = { primary: "#282c31", secondary: "#15171b" };

// Pushes a hex color's own saturation/lightness toward a vivid "neon" range
// instead of relying on an outer glow -- so the ring itself reads as a
// brighter, punchier version of the team color rather than the muted brand
// hex (which is often designed to work on jerseys/logos, not glow on a
// screen). Grays/near-neutrals (low saturation) are left alone so team
// colors like the Spurs' silver don't get tinted a random hue.
function neonizeColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  const d = max - min;
  if (d < 0.03) return hex; // effectively gray -- don't invent a hue
  let s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  s = Math.min(1, s * 1.35);
  const lOut = Math.min(0.62, Math.max(0.46, l * 1.08));
  const c2 = (1 - Math.abs(2 * lOut - 1)) * s;
  const x = c2 * (1 - Math.abs((h / 60) % 2 - 1));
  const m2 = lOut - c2 / 2;
  let [r2, g2, b2] = h < 60 ? [c2, x, 0] : h < 120 ? [x, c2, 0] : h < 180 ? [0, c2, x] : h < 240 ? [0, x, c2] : h < 300 ? [x, 0, c2] : [c2, 0, x];
  const toHex = (v) => Math.round((v + m2) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

// Foreground colour for text sitting on a solid --amber background. The
// accent is user-pickable from a full colour wheel (see ColorWheel.jsx), so
// it can land anywhere from near-black to near-white -- a fixed label colour
// is unreadable at one end or the other. Picks whichever of near-black or
// white has the higher WCAG contrast against the given accent.
const ACCENT_ON_DARK = "#08131c";
const ACCENT_ON_LIGHT = "#ffffff";
function accentForeground(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || "").trim());
  if (!m) return ACCENT_ON_DARK;
  const channel = (c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * channel(m[1]) + 0.7152 * channel(m[2]) + 0.0722 * channel(m[3]);
  // Relative luminance of ACCENT_ON_DARK is ~0.0057; 1.0 for white.
  const contrastWithDark = (lum + 0.05) / (0.0057 + 0.05);
  const contrastWithWhite = (1.0 + 0.05) / (lum + 0.05);
  return contrastWithDark >= contrastWithWhite ? ACCENT_ON_DARK : ACCENT_ON_LIGHT;
}

const teamAvatarBackground = (colorMap, teamAbbr) => {
  const c = colorMap[teamAbbr] || AVATAR_FALLBACK_COLORS;
  return `linear-gradient(135deg, rgba(0,0,0,var(--avatar-ring-shade1, 0.2)), rgba(0,0,0,var(--avatar-ring-shade2, 0.45))), linear-gradient(135deg, ${neonizeColor(c.primary)} 0%, ${neonizeColor(c.secondary)} 100%)`;
};

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

function NBAPropsPage({ jumpTo }) {
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
  const med = median(values);
  // Binary props (DD/TD) have a fixed 0.5 threshold — achieved (1) counts as a
  // hit, not achieved (0) doesn't. There's nothing to drag for these.
  const effectiveLine = isBinary ? 0.5 : (line === null ? ceilToHalfOdd(avg) : line);
  // Axis ceiling + evenly spaced tick marks: pick a "nice" step (1, 2, 5, 10, 20...)
  // so the y-axis always shows regular, evenly spaced whole numbers instead of
  // an uneven jump like 0, 9, 30.
  const topValue = Math.max(...values, effectiveLine, 1);
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

  const marketLabel = market === "reb"
    ? `${REB_SPLITS.find((r) => r.id === rebSplit)?.label ?? "Total"} Reb.`
    : MARKETS.find((m) => m.id === market)?.label ?? "";

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
      avatarBg={(p) => (NBA_TEAM_COLORS[p.team] || {}).primary || "#000"}
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
      avatarBg={(p) => (NBA_TEAM_COLORS[p.team] || {}).primary || "#000"}
    />
    <div className="roster-layout-center">
      {/* Matchup + player + market selectors */}
      <div style={{ marginBottom: 8 }}>
        {/* Date/matchup pill sits above the player photo/selector since it's
             context about the game, not the player (matches the WNBA/MLB
             page layout). */}
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

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20, marginBottom: 12, flexWrap: "wrap" }}>
          <select
            className="select"
            value={matchupId}
            onChange={(e) => {
              const next = NBA_MATCHUPS.find((m) => m.id === e.target.value);
              setMatchupId(next.id);
              setPlayerId(next.teamA.players[0].id);
              setLine(null);
              setOpponent("all");
            }}
          >
            {NBA_MATCHUPS_BY_DATE.map((group) => (
              <optgroup label={group.label} key={group.label}>
                {group.matchups.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <select className="select" value={playerId} onChange={(e) => { setPlayerId(e.target.value); setLine(null); setOpponent("all"); }}>
            <optgroup label={matchup.teamA.label}>
              {matchup.teamA.players.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.pos}</option>
              ))}
            </optgroup>
            <optgroup label={matchup.teamB.label}>
              {matchup.teamB.players.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.pos}</option>
              ))}
            </optgroup>
          </select>
          <div style={{
            position: "relative", width: 122, height: 122, borderRadius: "50%", flexShrink: 0,
            background: teamAvatarBackground(NBA_TEAM_COLORS, player.team),
            boxShadow: `0 4px 14px ${(NBA_TEAM_COLORS[player.team] || {}).primary || "#000"}40`,
          }}>
            {/* Always-visible team-colored backing, in case the headshot image can't
                 load (ad-block / privacy extensions often block sports-CDN image
                 requests) -- keeps the circle on-brand instead of going flat black.
                 Sits 6px inset from the team-colored wrapper above, so that color
                 shows only as a thin ring -- the photo itself stays 110x110, untouched. */}
            <div style={{
              position: "absolute", inset: 6, borderRadius: "50%",
              background: (NBA_TEAM_COLORS[player.team] || {}).primary || "#000",
              border: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }} />
            <img
              key={player.id}
              src={espnHeadshot(player.espnId)}
              alt={player.name}
              width={110}
              height={110}
              referrerPolicy="no-referrer"
              style={{
                position: "absolute", inset: 6,
                width: 110, height: 110,
                borderRadius: "50%",
                objectFit: "cover",
                objectPosition: "center top",
                border: "1px solid var(--line)",
                opacity: 0,
                transition: "opacity 0.15s ease",
              }}
              onLoad={(e) => { e.currentTarget.style.opacity = 1; }}
              onError={(e) => {
                if (e.currentTarget.dataset.fallback !== "1") {
                  e.currentTarget.dataset.fallback = "1";
                  e.currentTarget.src = nbaHeadshot(player.nbaId);
                } else {
                  e.currentTarget.style.opacity = 0;
                }
              }}
            />
          </div>

          {/* Player snapshot: season averages at a glance, next to the selector
               so the top of the page isn't just a dropdown floating in empty space. */}
          <div style={{
            display: "flex", alignItems: "center", gap: 18,
            background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8,
            padding: "10px 20px",
          }}>
            <div style={{ textAlign: "center", paddingRight: 14, borderRight: "1px solid var(--line)" }}>
              <div className="oswald" style={{ fontSize: 14, color: "var(--text)", whiteSpace: "nowrap" }}>{player.name}</div>
              <div style={{ fontSize: 10.5, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {player.team} · {player.pos} · Season
              </div>
            </div>
            {[
              { label: "PTS", value: seasonAvg.pts },
              { label: "REB", value: seasonAvg.reb },
              { label: "AST", value: seasonAvg.ast },
              { label: "MIN", value: seasonAvg.min },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div className="mono" style={{ fontSize: 19, color: "var(--amber)", fontWeight: 700 }}>{s.value.toFixed(1)}</div>
                <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: "var(--s-3)" }}>
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
        </div>
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

        {/* Filters live inside the center column now, directly under the
             market bar, instead of as a sibling below the whole 3-column
             row -- that row's height is set by the taller roster columns
             regardless of alignment, so anything waiting outside the row
             always waited for the rosters' full height first. */}
        <FiltersSection
          onReset={resetFilters}
          groups={[
            {
              stack: [
                {
                  label: "Opponent",
                  content: (
                    <select
                      className="select"
                      value={opponent}
                      onChange={(e) => { setOpponent(e.target.value); setOppView("season"); }}
                      style={{ width: 240 }}
                    >
                      <option value="all">Any opponent</option>
                      {opponentsForPlayer.map((o) => <option key={o} value={o}>vs {o}</option>)}
                    </select>
                  ),
                },
                opponent === "all"
                  ? {
                      label: "Game location",
                      content: (
                        <div style={{ display: "flex", gap: "var(--s-1)", flexWrap: "wrap" }}>
                          {["all", "home", "away"].map((s) => (
                            <div key={s} className={`chip ${side === s ? "active" : ""}`} onClick={() => setSide(s)}>
                              {s === "all" ? "All games" : s === "home" ? "Home" : "Away"}
                            </div>
                          ))}
                        </div>
                      ),
                    }
                  : {
                      label: "View",
                      content: (
                        <select className="select" value={oppView} onChange={(e) => setOppView(e.target.value)} style={{ width: 240 }}>
                          <option value="season">Current Season</option>
                          <option value="h2h3y">Head-to-Head (3Y)</option>
                          <option value="home">Home vs Opp</option>
                          <option value="away">Away vs Opp</option>
                          <option value="playoffs">Playoffs vs Opp</option>
                        </select>
                      ),
                    },
              ],
            },
            {
              stack: [
                opponent === "all"
                  ? {
                      label: "Sample size",
                      content: (
                        <div style={{ display: "flex", gap: "var(--s-1)", flexWrap: "wrap" }}>
                          {[5, 10, 15, 25, "all"].map((n) => (
                            <div key={n} className={`chip ${lastN === n ? "active" : ""}`} onClick={() => setLastN(n)}>
                              {n === "all" ? "All" : `Last ${n}`}
                            </div>
                          ))}
                        </div>
                      ),
                    }
                  : null,
                {
                  label: "Minutes",
                  content: (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--s-2)", width: 260 }}>
                      <div className="mono" style={{ fontSize: 13, color: "var(--amber)", fontWeight: 700 }}>
                        {!minutesRangeEnabled
                          ? (minMinutes === 0 ? "Any minutes" : `${minMinutes}+ min`)
                          : (minMinutes === 0 && maxMinutes === 40 ? "Any minutes" : `${minMinutes}-${maxMinutes} min`)}
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
                    </div>
                  ),
                },
              ].filter(Boolean),
            },
          ]}
        />
    </div>
    <TeamRosterPanel
      teamLabel={matchup.teamB.label}
      players={matchup.teamB.players}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => espnHeadshot(p.espnId)}
      headshotFallback={(p) => nbaHeadshot(p.nbaId)}
      metaLine={(p) => `${p.pos} · ${p.base.pts.toFixed(1)} PTS`}
      avatarBg={(p) => (NBA_TEAM_COLORS[p.team] || {}).primary || "#000"}
    />
    </div>

      {/* Line input + summary — the line adjuster is centered on top, with the
           three stat cards in a single row underneath it, spaced evenly left to right */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {isBinary ? `${marketLabel} rate` : `${marketLabel} line`}
          </div>
          <div className="mono" style={{ fontSize: 28, color: "var(--amber)", textAlign: "center" }}>
            {isBinary ? `${Math.round(hitRate * 100)}%` : effectiveLine}
          </div>
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
            {isBinary ? `achieved in ${hits} of ${values.length} games` : "drag the tab on the chart to adjust"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap", justifyContent: "space-between", gap: 20, width: "100%" }}>
          {[
            { label: "Hit rate", value: `${Math.round(hitRate * 100)}%`, sub: isBinary ? `${hits}/${values.length}` : `${hits}/${values.length}${pushes ? ` · ${pushes} push` : ""}` },
            { label: "Average", value: avg.toFixed(isBinary ? 2 : 1), sub: isBinary ? "per-game rate" : `median ${med}` },
            { label: isBinary ? "Edge vs 50%" : "Edge vs line", value: `${edge >= 0 ? "+" : ""}${edge.toFixed(isBinary ? 2 : 1)}`, sub: edge >= 0 ? "trending over" : "trending under", color: edge >= 0 ? "var(--green)" : "var(--red)" },
          ].map((s) => (
            <div key={s.label} style={{ flex: 1, minWidth: 0, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
              <div className="mono" style={{ fontSize: 22, color: s.color || "var(--text)" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Matchup context */}
      {opponent !== "all" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 16px", width: "fit-content", maxWidth: "100%", boxSizing: "border-box" }}>
          <span style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>vs {opponent} defense</span>
          <span className="mono" style={{ fontSize: 16, color: "var(--text)" }}>{TEAM_DEF[opponent].rating}</span>
          <span className="mono" style={{
            fontSize: 12, padding: "2px 8px", borderRadius: 3,
            color: defTier(TEAM_DEF[opponent].rank) === "soft" ? "var(--green)" : defTier(TEAM_DEF[opponent].rank) === "tough" ? "var(--red)" : "var(--dim)",
            border: `1px solid ${defTier(TEAM_DEF[opponent].rank) === "soft" ? "var(--green)" : defTier(TEAM_DEF[opponent].rank) === "tough" ? "var(--red)" : "var(--line)"}`,
          }}>
            #{TEAM_DEF[opponent].rank} defense{defTier(TEAM_DEF[opponent].rank) === "soft" ? " · favorable matchup" : defTier(TEAM_DEF[opponent].rank) === "tough" ? " · tough matchup" : ""}
          </span>
        </div>
      )}

      {opponent !== "all" && oppView === "playoffs" && filtered.length === 0 && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, padding: "16px", marginBottom: 16, textAlign: "center", color: "var(--dim)", fontSize: 13 }}>
          No playoff meetings vs {opponent} in the sample data.
        </div>
      )}

      {/* Chart — wider now that the scroller is gone. Drag the amber tab on the
           right edge to move the line, same as the +/- buttons above. */}
      <div
        ref={chartRef}
        style={{
          position: "relative",
          boxSizing: "border-box",
          height: isNarrow ? 380 : CHART_HEIGHT,
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          padding: isNarrow ? "16px 6px" : 16,
          marginBottom: 16,
        }}
      >
        <div style={{ height: "100%", width: "100%", touchAction: "pan-y" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
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
            margin={{ top: 10, right: isNarrow ? 30 : 60, bottom: manyGames ? 30 : (isNarrow ? 42 : 78), left: isNarrow ? 0 : 20 }}
            barCategoryGap={isNarrow ? "4%" : "6%"}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#343941" vertical={false} />
            <XAxis
              dataKey={manyGames ? "date" : "axisKey"}
              interval={manyGames ? Math.max(0, Math.ceil(filtered.length / (isNarrow ? 5 : 8)) - 1) : axisTickInterval(filtered.length, isNarrow, chartWidth)}
              tick={manyGames ? (props) => <DateAxisTick {...props} compact={isNarrow} /> : (props) => <TeamAxisTick {...props} logoFn={nbaTeamLogo} compact={isNarrow} />}
              axisLine={{ stroke: "#343941" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, chartMax]}
              ticks={chartTicks}
              tick={{ fill: "#8b96a5", fontSize: 11 }}
              axisLine={{ stroke: "#343941" }}
              tickLine={false}
              allowDecimals={false}
            width={isNarrow ? 24 : 60}
              label={isNarrow ? undefined : { value: marketLabel, angle: -90, position: "insideLeft", offset: 10, style: { textAnchor: "middle", fill: "#8b96a5", fontSize: 11, fontWeight: 600 } }}
            />
            <Tooltip
              content={<ChartTooltip effectiveLine={effectiveLine} isBinary={isBinary} marketLabel={marketLabel} logoFn={nbaTeamLogo} />}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
            />
            {!isBinary && <ReferenceLine y={dragLine !== null ? dragLine : effectiveLine} stroke="var(--amber)" strokeDasharray="4 4" />}
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {filtered.map((g, i) => {
                const v = statValue(g, market, rebSplit);
                const fill = isBinary ? (v === 1 ? CHART_GREEN : "transparent") : (v > effectiveLine ? CHART_GREEN : CHART_RED);
                return <Cell key={i} fill={fill} />;
              })}
              <LabelList dataKey="value" content={(props) => <BarValueLabel {...props} isBinary={isBinary} />} />
            </Bar>
          </BarChart>
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

      {/* Table */}
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
                    <div style={{ color: tier === "soft" ? "var(--green)" : tier === "tough" ? "var(--red)" : "var(--dim)" }}>#{def.rank}</div>
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

      <div style={{ marginTop: 20, fontSize: 12, color: "var(--dim)" }}>
        Sample data only — built to test the filtering and layout before wiring in a real stats/odds feed.
      </div>
      <PlayerNewsModule playerName={player.name} headshotSrc={espnHeadshot(player.espnId)} />
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
const NFL_TEAM_COLORS = {
  ARI: { primary: "#97233F", secondary: "#000000" },
  ATL: { primary: "#A71930", secondary: "#000000" },
  BAL: { primary: "#241773", secondary: "#9E7C0C" },
  BUF: { primary: "#00338D", secondary: "#C60C30" },
  CAR: { primary: "#0085CA", secondary: "#101820" },
  CHI: { primary: "#0B162A", secondary: "#C83803" },
  CIN: { primary: "#FB4F14", secondary: "#000000" },
  CLE: { primary: "#311D00", secondary: "#FF3C00" },
  DAL: { primary: "#041E42", secondary: "#869397" },
  DEN: { primary: "#FB4F14", secondary: "#002244" },
  DET: { primary: "#0076B6", secondary: "#B0B7BC" },
  GB: { primary: "#203731", secondary: "#FFB612" },
  HOU: { primary: "#03202F", secondary: "#A71930" },
  IND: { primary: "#002C5F", secondary: "#A2AAAD" },
  JAX: { primary: "#101820", secondary: "#D7A22A" },
  KC: { primary: "#E31837", secondary: "#FFB81C" },
  LV: { primary: "#000000", secondary: "#A5ACAF" },
  LAC: { primary: "#0080C6", secondary: "#FFC20E" },
  LAR: { primary: "#003594", secondary: "#FFA300" },
  MIA: { primary: "#008E97", secondary: "#FC4C02" },
  MIN: { primary: "#4F2683", secondary: "#FFC62F" },
  NE: { primary: "#002244", secondary: "#C60C30" },
  NO: { primary: "#D3BC8D", secondary: "#101820" },
  NYG: { primary: "#0B2265", secondary: "#A71930" },
  NYJ: { primary: "#125740", secondary: "#000000" },
  PHI: { primary: "#004C54", secondary: "#A5ACAF" },
  PIT: { primary: "#FFB612", secondary: "#101820" },
  SF: { primary: "#AA0000", secondary: "#B3995D" },
  SEA: { primary: "#002244", secondary: "#69BE28" },
  TB: { primary: "#D50A0A", secondary: "#34302B" },
  TEN: { primary: "#0C2340", secondary: "#4B92DB" },
  WAS: { primary: "#5A1414", secondary: "#FFB612" },
};

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

// The 2025 season is already final, so once fetched this data never changes
// -- cached to sessionStorage so it's only fetched once per tab regardless
// of how many times a player's page gets revisited.
const nflGameLogCache = new Map();
async function fetchNFLPlayerGameLog(espnId) {
  if (nflGameLogCache.has(espnId)) return nflGameLogCache.get(espnId);

  const cacheKey = `nfl_gamelog_v1_${espnId}`;
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const games = JSON.parse(stored);
      nflGameLogCache.set(espnId, games);
      return games;
    }
  } catch {}

  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${espnId}/gamelog?season=2025`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const games = parseNFLGameLogResponse(data);
    if (!games.length) return null;
    nflGameLogCache.set(espnId, games);
    try { sessionStorage.setItem(cacheKey, JSON.stringify(games)); } catch {}
    return games;
  } catch {
    return null;
  }
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

// Darker/more saturated bar colors, shared across every bar chart (NFL/MLB/NBA).
const CHART_GREEN = "#1c9a52";
const CHART_RED = "#d6392a";

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

  const valueToY = (v) => {
    const bounds = getPlotBoundsY(containerRef.current);
    const zeroY = bounds ? bounds.zeroY : PLOT_TOP_FALLBACK + PLOT_HEIGHT_FALLBACK;
    const maxY = bounds ? bounds.maxY : PLOT_TOP_FALLBACK;
    return zeroY - ((v - min) / (max - min)) * (zeroY - maxY);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current || !containerRef.current) return;
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
  };

  const startDrag = (e) => {
    draggingRef.current = true;
    setDragValue(value);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
  };
  const stopDrag = () => {
    draggingRef.current = false;
    setDragValue(null);
    onDragValue?.(null);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDrag);
  };

  const y = valueToY(dragValue !== null ? dragValue : value);

  return (
    <div
      onPointerDown={startDrag}
      style={{
        position: "absolute",
        right: 6,
        top: y - 13,
        height: 26,
        minWidth: 44,
        padding: "0 8px",
        background: "var(--amber)",
        borderRadius: 5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
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
    background: "var(--amber)", border: "2px solid #1a1206",
    boxShadow: "0 2px 6px rgba(0,0,0,0.45)", cursor: "pointer",
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

// Compact tappable teammate cards replacing the old "Add teammate..." select.
// Each card cycles neutral -> with -> without -> neutral on click; an "All"
// pill clears every chip back to neutral. `chips` is the same
// {mlbId, name, mode} shape the rest of PropLedger already threads through
// to the With/Without game-log filter, so this is purely a presentation
// swap -- it reads/writes the identical state.
// Cards are square tiles in a single horizontally-scrolling row (chevrons on
// each end, plus a visible drag-scrollbar underneath) rather than wrapping
// onto new lines -- a full roster wrapped into a grid left a lot of dead
// vertical space in the filter panel, and a fixed-height scroller reads
// closer to a real "selector" than a list that grows.
const TEAMMATE_CARD_SIZE = 96;
const TEAMMATE_CARD_GAP = 10;
const TEAMMATE_VISIBLE_COUNT = 4;
// Exactly enough width for 3 full tiles -- wide enough to stop wasting the
// empty space to the right of the old narrower track, but fixed rather than
// stretched to fill whatever room happens to be left so a tile is never
// half-cut at the edge.
const TEAMMATE_SCROLL_WIDTH = TEAMMATE_VISIBLE_COUNT * TEAMMATE_CARD_SIZE + (TEAMMATE_VISIBLE_COUNT - 1) * TEAMMATE_CARD_GAP;

function TeammateChipGrid({ roster, excludeId, chips, onChange, loading }) {
  const candidates = roster.filter((p) => p.mlbId !== excludeId && p.pos !== "SP");
  const modeFor = (mlbId) => (chips.find((c) => c.mlbId === mlbId) || {}).mode || "neutral";
  const scrollRef = React.useRef(null);
  const trackRef = React.useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  // Thumb geometry as fractions of the track (0-1) -- driven off the real
  // scroll container's metrics so the custom bar always matches it exactly.
  const [thumb, setThumb] = useState({ pos: 0, size: 1 });

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < maxScroll - 2);
    setThumb({
      pos: maxScroll > 0 ? el.scrollLeft / maxScroll : 0,
      size: Math.min(1, el.clientWidth / el.scrollWidth),
    });
  };

  React.useEffect(() => {
    updateScrollState();
  }, [candidates.length]);

  const scrollBy = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (TEAMMATE_CARD_SIZE + 10) * 2, behavior: "smooth" });
  };

  // The visible track is a plain div (not the real overflow element) so its
  // height never grows to make room for a native scrollbar -- that reserved
  // space was what threw the cards' vertical center off from "All" and the
  // arrows above. Dragging/clicking it just sets scrollLeft on the real
  // scroller directly, same pattern as ThresholdSlider's track handling.
  const scrollToRatio = (ratio) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);
  };

  const ratioFromClientX = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const handleTrackPointerDown = (e) => {
    e.preventDefault();
    scrollToRatio(ratioFromClientX(e.clientX));
    const handleMove = (ev) => scrollToRatio(ratioFromClientX(ev.clientX));
    const stop = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stop);
  };

  const cycle = (p) => {
    const current = modeFor(p.mlbId);
    if (current === "neutral") {
      onChange((prev) => [...prev, { mlbId: p.mlbId, name: p.name, mode: "with" }]);
    } else if (current === "with") {
      onChange((prev) => prev.map((c) => (c.mlbId === p.mlbId ? { ...c, mode: "without" } : c)));
    } else {
      onChange((prev) => prev.filter((c) => c.mlbId !== p.mlbId));
    }
  };

  const cardStyle = (mode) => {
    if (mode === "with") {
      return {
        background: "color-mix(in srgb, var(--green) 16%, transparent)",
        borderColor: "var(--green)",
        color: "var(--green)",
      };
    }
    if (mode === "without") {
      return {
        background: "var(--red-dim)",
        borderColor: "var(--red)",
        color: "var(--red)",
      };
    }
    return { background: "var(--panel2)", borderColor: "var(--line)", color: "var(--text)" };
  };

  const arrowStyle = (enabled) => ({
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    width: 26, height: 26, borderRadius: "50%",
    border: "1px solid var(--line)", background: "var(--panel2)",
    color: enabled ? "var(--text)" : "var(--line)",
    cursor: enabled ? "pointer" : "default",
    fontSize: 13, userSelect: "none",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
      {/* align-items: center keeps the arrow vertically centered
           on the taller card tiles instead of pinned to their top edge. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          role="button"
          aria-label="Scroll teammates left"
          onClick={() => canScrollLeft && scrollBy(-1)}
          style={arrowStyle(canScrollLeft)}
        >
          ‹
        </div>
        {/* This wrapper's own height is fixed to exactly the cards' height
             -- the track is positioned absolutely below it, so it hangs
             underneath visually without adding to the height flexbox sees,
             which is what keeps this row's cross-axis center matching the
             card center exactly, not the center of cards-plus-track. */}
        <div style={{ position: "relative", width: TEAMMATE_SCROLL_WIDTH, height: TEAMMATE_CARD_SIZE, flexShrink: 0 }}>
          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="teammate-scroll"
            style={{
              display: "flex", gap: TEAMMATE_CARD_GAP, overflowX: "auto", scrollSnapType: "x proximity",
              position: "absolute", inset: 0,
            }}
          >
            {candidates.map((p) => {
              const mode = modeFor(p.mlbId);
              const style = cardStyle(mode);
              return (
                <div
                  key={p.mlbId}
                  role="button"
                  title={mode === "neutral" ? `Tap to require ${p.name} on the field` : mode === "with" ? `Tap to require ${p.name} off the field` : `Tap to clear ${p.name}`}
                  onClick={() => cycle(p)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    width: TEAMMATE_CARD_SIZE,
                    height: TEAMMATE_CARD_SIZE,
                    padding: "10px 6px",
                    borderRadius: 18,
                    border: "1px solid",
                    cursor: "pointer",
                    userSelect: "none",
                    flexShrink: 0,
                    boxSizing: "border-box",
                    scrollSnapAlign: "start",
                    transition: "box-shadow 0.12s ease",
                    ...style,
                  }}
                >
                  <img
                    src={mlbHeadshot(p.mlbId)}
                    onError={(e) => { e.currentTarget.src = mlbEspnHeadshot(p.id); }}
                    alt=""
                    style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", background: "var(--panel)", flexShrink: 0 }}
                  />
                  <span
                    className="oswald"
                    style={{
                      fontSize: 11.5, fontWeight: 600, textAlign: "center",
                      maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}
                  >
                    {p.name}
                  </span>
                  {/* Badge is always in the layout (just invisible when
                       neutral) so a state change never changes the tile's
                       fixed height/width. */}
                  <span
                    style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1,
                      visibility: mode === "neutral" ? "hidden" : "visible",
                    }}
                  >
                    {mode === "without" ? "W/O" : "WITH"}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Custom draggable track -- click-to-jump plus drag, same
               interaction as ThresholdSlider's track handling elsewhere in
               this file. Positioned absolutely below the cards (not a
               normal-flow sibling) so it never adds to the wrapper's own
               height; scrollRef is the real overflow element it's steering. */}
          <div
            ref={trackRef}
            onPointerDown={handleTrackPointerDown}
            style={{
              position: "absolute", top: TEAMMATE_CARD_SIZE + 6, left: 0, width: "100%", height: 6,
              cursor: "pointer", touchAction: "none",
            }}
          >
            <div style={{ position: "absolute", inset: 0, borderRadius: 3, background: "var(--line)" }} />
            <div
              style={{
                position: "absolute", top: 0, height: 6, borderRadius: 3,
                left: `${thumb.pos * (1 - thumb.size) * 100}%`,
                width: `${thumb.size * 100}%`,
                background: "var(--dim)",
              }}
            />
          </div>
        </div>
        <div
          role="button"
          aria-label="Scroll teammates right"
          onClick={() => canScrollRight && scrollBy(1)}
          style={arrowStyle(canScrollRight)}
        >
          ›
        </div>
      </div>
      {loading && (
        <div className="mono" style={{ fontSize: 10.5, color: "var(--dim)" }}>Loading boxscores…</div>
      )}
    </div>
  );
}

// Collapsible wrapper for the Opponent/Game Location/Sample Size/etc. filter
// block shared by the NBA/NFL/MLB pages -- defaults open so nothing changes
// for people who don't touch it, but the whole group (which can get tall
// once a range slider is in play) can be tucked away with one click instead
// of always eating vertical space above the chart.
// `groups` is [{ label, content }] and lays the filters out on a responsive
// grid, which is the layout every page should be on. An entry can instead be
// { stack: [{ label, content }, ...] } to put several filters in one column,
// which is how related controls (the two chip rows) stay together and get a
// column wide enough not to wrap. `children` is the older free-form body
// (still used by the pages that haven't been migrated yet) and keeps its
// original centred single-column rendering, so moving a page over is a
// call-site change rather than a coordinated one.
function FiltersSection({ children, groups, onReset }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="panel" style={{ marginBottom: "var(--s-4)" }}>
      <div
        onClick={() => setOpen((v) => !v)}
        className="oswald"
        role="button"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--s-2)",
          padding: "var(--s-2) var(--s-4)", cursor: "pointer", userSelect: "none",
          fontSize: 13, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase",
          color: "var(--dim)",
          borderBottom: open ? "1px solid var(--line)" : "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
          Filters
          <span
            className="mono"
            style={{
              color: "var(--amber)", fontSize: 11,
              display: "inline-block", transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform .15s ease",
            }}
          >
            ▼
          </span>
        </span>
        {/* Sits in the header rather than its own row at the bottom of the
             panel, which saves a full row of height. stopPropagation so
             resetting doesn't also collapse the section. */}
        {onReset && open && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onReset(); }}
            style={{ fontSize: 11, letterSpacing: "0.05em", color: "var(--dim)", textDecoration: "underline", cursor: "pointer" }}
          >
            Reset
          </span>
        )}
      </div>
      {open && (
        groups ? (
          <div className="filter-grid" style={{ padding: "var(--s-3) var(--s-4)" }}>
            {groups.map((g) => {
              const cell = g.stack || [g];
              return (
                <div key={cell[0].label} style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
                  {cell.map((f) => (
                    <div key={f.label}>
                      <div className="micro-label" style={{ marginBottom: "var(--s-2)" }}>{f.label}</div>
                      {f.content}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "12px 14px", textAlign: "center" }}>
            {children}
          </div>
        )
      )}
    </div>
  );
}

// Bar value label, anchored near the bottom of each bar rather than
// recharts' default top-of-bar placement — reads as a stamped-in number
// rather than a floating annotation. Rendered bold white with a dark
// outline (stroke + paintOrder) rather than a solid fill color so it stays
// legible against both the green/red bar fills, even when the bar is
// narrow enough that the digits spill slightly past its edges.
function BarValueLabel({ x, y, width, height, value, isBinary }) {
  // Every bar's label sits at the same height (10px above the shared
  // baseline, not floating above each bar's own peak), so once bars get
  // thin -- a bigger sample size, or a narrow phone -- adjacent numbers
  // would run into each other. Scaling the font down as the bar narrows
  // (instead of one fixed size) keeps digits from overlapping their
  // neighbors on any width, and skipping the label below that keeps it
  // self-correcting instead of needing a device-specific breakpoint.
  if (value == null || height < 14 || width < 9) return null;
  if (isBinary && value !== 1) return null;
  const fontSize = width >= 26 ? 14 : width >= 18 ? 12 : 10;
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
      {isBinary ? "✓" : value}
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

// How many px each per-game logo+abbreviation+date tick needs to avoid
// overlapping its neighbors -- used to derive how many ticks actually fit
// in the measured chart width, instead of a fixed tick-count cap. Compact
// (narrow-screen) ticks are smaller text/logos, so they pack tighter.
const TICK_SLOT_WIDTH = { compact: 34, full: 56 };

// Skips ticks so only as many per-game logos render as actually fit the
// measured chart width -- "All" on a full MLB season can be 80+ games, which
// would render every single logo/abbreviation crammed on top of each other
// without this, but a wide desktop panel can still comfortably fit well
// beyond the old fixed 20-tick cap this replaces. recharts' XAxis `interval`
// is a skip-count, not a target tick count, so it's derived from gameCount
// here. Falls back to a conservative 20 before the container has been
// measured (width === 0, e.g. first paint).
function axisTickInterval(gameCount, isNarrow, containerWidth) {
  const slot = isNarrow ? TICK_SLOT_WIDTH.compact : TICK_SLOT_WIDTH.full;
  const maxTicks = containerWidth > 0 ? Math.max(1, Math.floor(containerWidth / slot)) : 20;
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
  const size = compact ? 14 : 28;
  return (
    <g transform={`translate(${x},${y})`}>
      <image href={logoFn(abbr)} x={-size / 2} y={4} width={size} height={size} />
      <text x={0} y={compact ? 24 : 50} textAnchor="middle" fill="#8b96a5" fontSize={compact ? 8 : 13} fontWeight={600}>
        {abbr}
      </text>
      <text x={0} y={compact ? 35 : 68} textAnchor="middle" fill="#5c6470" fontSize={compact ? 7 : 11} fontWeight={500}>
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
      <text x={0} y={compact ? 18 : 20} textAnchor="middle" fill="#8b96a5" fontSize={compact ? 10 : 12} fontWeight={600}>
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
        {visible.map((section, si) => (
          <React.Fragment key={section.label}>
            {si > 0 && <div className="market-divider" aria-hidden="true" />}
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
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, flexWrap: "nowrap" }}>
              {section.markets.map((m, mi) => (
                <React.Fragment key={m.id}>
                  {mi > 0 && <span style={{ color: "var(--line)", fontSize: 18 }}>|</span>}
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
              {section.markets.map((m, mi) => (
                <React.Fragment key={m.id}>
                  {mi > 0 && (
                    <span style={{ display: "flex", alignItems: "center", color: "var(--line)", fontSize: 18 }}>|</span>
                  )}
                  <div
                    className={`tab ${si === 0 ? "no-underline" : ""} ${activeMarket === m.id ? "active" : ""}`}
                    style={{ flex: "0 0 auto", width: "auto" }}
                    onClick={() => onSelect(m.id)}
                  >
                    {m.label}
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function NFLPropsPage({ jumpTo, dataVersion }) {
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
  const [minSnapPct, setMinSnapPct] = useState(50);
  const [maxSnapPct, setMaxSnapPct] = useState(100);
  const [snapRangeEnabled, setSnapRangeEnabled] = useState(false);
  const [line, setLine] = useState(null);
  const [dragLine, setDragLine] = useState(null);
  const chartRef = React.useRef(null);
  const chartWidth = useElementWidth(chartRef);
  const isNarrow = useIsNarrow();

  const resetFilters = () => {
    setSide("all");
    setLastN(10);
    setOpponent("all");
    setMinSnapPct(50);
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

  const filtered = useMemo(() => {
    let g = allGames.filter((game) => {
      if (side === "home" && !game.home) return false;
      if (side === "away" && game.home) return false;
      if (opponent !== "all" && game.opp !== opponent) return false;
      if (game.snapPct !== null && (game.snapPct < minSnapPct || game.snapPct > maxSnapPct)) return false;
      return true;
    });
    if (lastN !== "all") g = g.slice(-lastN);
    return g;
  }, [allGames, side, opponent, minSnapPct, maxSnapPct, lastN]);

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
  const med = median(values);
  const effectiveLine = isBinary ? 0.5 : (line === null ? ceilToHalfOdd(avg) : line);
  const topValue = Math.max(...values, effectiveLine, 1);
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
  const marketLabel = NFL_MARKETS.find((m) => m.id === market)?.label ?? "";
  const defCategoryLabel = nflDefCategoryLabel(market, player.pos);

  return (
    <div className="page-shell page-shell--mobile-nav" style={{ maxWidth: 1920, margin: "0 auto", boxSizing: "border-box" }}>
    <MobilePlayerNav
      teamA={teamRoster}
      teamB={oppRoster}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => NFL_HEADSHOTS[p.id]}
      metaLine={(p) => p.pos}
      avatarBg={(p) => (NFL_TEAM_COLORS[p.team] || {}).primary || "#000"}
    />
    <div className="roster-layout">
    <TeamRosterPanel
      teamLabel={teamRoster.label}
      players={teamRoster.players}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => NFL_HEADSHOTS[p.id]}
      metaLine={(p) => p.pos}
      avatarBg={(p) => (NFL_TEAM_COLORS[p.team] || {}).primary || "#000"}
    />
    <div className="roster-layout-center">
      {/* Matchup + market selectors -- picking a matchup here swaps which two
           fixed Week 1 rosters populate the left/right sidebars, the same
           "pick a matchup, see its two rosters" pattern the WNBA page uses.
           Picking an individual player happens by clicking their row in
           either roster panel. */}
      <div style={{ marginBottom: 8 }}>
        {/* Date/matchup pill sits above the player photo/selector since it's
             context about the game, not the player (matches the MLB/WNBA
             page layout). */}
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

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20, marginBottom: 12, flexWrap: "wrap" }}>
          <select
            className="select"
            value={matchupId}
            onChange={(e) => {
              const next = NFL_MATCHUPS.find((m) => m.id === e.target.value);
              setMatchupId(next.id);
              setPlayerId(next.teamA.players[0].id);
              setLine(null);
              setOpponent("all");
            }}
          >
            {NFL_MATCHUPS_BY_DATE.map((group) => (
              <optgroup label={group.label} key={group.label}>
                {group.matchups.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <div style={{
            position: "relative", width: 122, height: 122, borderRadius: "50%", flexShrink: 0,
            background: teamAvatarBackground(NFL_TEAM_COLORS, player.team),
            boxShadow: `0 4px 14px ${(NFL_TEAM_COLORS[player.team] || {}).primary || "#000"}40`,
          }}>
            {/* Always-visible team-colored backing, in case the headshot image can't
                 load (ad-block / privacy extensions often block sports-CDN image
                 requests) -- keeps the circle on-brand instead of going flat black. */}
            <div style={{
              position: "absolute", inset: 6, borderRadius: "50%",
              background: (NFL_TEAM_COLORS[player.team] || {}).primary || "#000",
              border: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }} />
            {NFL_HEADSHOTS[player.id] && (
              <img
                key={player.id}
                src={NFL_HEADSHOTS[player.id]}
                alt={player.name}
                width={110}
                height={110}
                referrerPolicy="no-referrer"
                style={{
                  position: "absolute", inset: 6,
                  width: 110, height: 110,
                  borderRadius: "50%",
                  objectFit: "cover",
                  objectPosition: "center top",
                  border: "1px solid var(--line)",
                  opacity: 0,
                  transition: "opacity 0.15s ease",
                }}
                onLoad={(e) => { e.currentTarget.style.opacity = 1; }}
                onError={(e) => { e.currentTarget.style.opacity = 0; }}
              />
            )}
          </div>

          {/* Player snapshot: season averages at a glance, next to the selector.
               The stats area is a fixed width sized for NFL_SNAPSHOT_MAX_STATS
               columns (4, QB's count) regardless of how many stats this
               position actually has, so the card is always the same width
               and the photo/selector next to it never shifts when switching
               between a QB and any other position -- but within that fixed
               width, a position with fewer stats (RB/WR/TE/K, 3) is laid out
               as a centered flex group instead of left-anchored columns with
               a stray empty slot trailing on the right. */}
          <div style={{
            display: "flex", flexDirection: isNarrow ? "column" : "row", alignItems: "center", gap: isNarrow ? 10 : 16,
            background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8,
            padding: isNarrow ? "12px 16px" : "10px 20px",
            width: isNarrow ? "100%" : undefined, boxSizing: "border-box",
          }}>
            <div style={{
              textAlign: "center",
              paddingRight: isNarrow ? 0 : 16, paddingBottom: isNarrow ? 10 : 0,
              borderRight: isNarrow ? "none" : "1px solid var(--line)",
              borderBottom: isNarrow ? "1px solid var(--line)" : "none",
              flexShrink: 0, width: isNarrow ? "100%" : undefined,
            }}>
              <div className="oswald" style={{ fontSize: 18, color: "var(--text)", whiteSpace: "nowrap" }}>{player.name}</div>
              <div style={{ fontSize: 13, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                {player.team} · {player.pos} · Season
              </div>
            </div>
            <div style={{
              display: "flex", flexWrap: isNarrow ? "wrap" : "nowrap", justifyContent: "center", alignItems: "center", gap: isNarrow ? 14 : 20,
              width: isNarrow ? "100%" : NFL_SNAPSHOT_MAX_STATS * 66 + (NFL_SNAPSHOT_MAX_STATS - 1) * 20,
            }}>
              {seasonAvg.map((s) => (
              <div key={s.label} style={{ textAlign: "center", width: 66, flexShrink: 0 }}>
                <div className="mono" style={{ fontSize: 19, color: "var(--amber)", fontWeight: 700 }}>{s.value.toFixed(s.decimals)}</div>
                <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{s.label}</div>
              </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "var(--s-3)" }}>
          <MarketSectionGrid
            singleBar
            sections={NFL_MARKET_SECTIONS.map((s) => ({ ...s, markets: playerMarkets.filter((m) => s.ids.includes(m.id)) }))}
            activeMarket={market}
            onSelect={(id) => { setMarket(id); setLine(null); }}
            isNarrow={isNarrow}
          />
        </div>

        {/* Filters live inside the center column now, directly under the
             market bar, instead of as a sibling below the whole 3-column
             row -- that row's height is set by the taller roster columns
             regardless of alignment, so anything waiting outside the row
             always waited for the rosters' full height first. */}
        <FiltersSection
          onReset={resetFilters}
          groups={[
            {
              stack: [
                {
                  label: "Opponent",
                  content: (
                    <select className="select" value={opponent} onChange={(e) => setOpponent(e.target.value)} style={{ width: 240 }}>
                      <option value="all">Any opponent</option>
                      {opponentsForPlayer.map((o) => <option key={o} value={o}>vs {o}</option>)}
                    </select>
                  ),
                },
                {
                  label: "Game location",
                  content: (
                    <div style={{ display: "flex", gap: "var(--s-1)", flexWrap: "wrap" }}>
                      {["all", "home", "away"].map((s) => (
                        <div key={s} className={`chip ${side === s ? "active" : ""}`} onClick={() => setSide(s)}>
                          {s === "all" ? "All games" : s === "home" ? "Home" : "Away"}
                        </div>
                      ))}
                    </div>
                  ),
                },
              ],
            },
            {
              stack: [
                {
                  label: "Sample size",
                  content: (
                    <div style={{ display: "flex", gap: "var(--s-1)", flexWrap: "wrap" }}>
                      {[5, 10, 15, "all"].map((n) => (
                        <div key={n} className={`chip ${lastN === n ? "active" : ""}`} onClick={() => setLastN(n)}>
                          {n === "all" ? "All" : `Last ${n}`}
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  label: "Snap %",
                  content: (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--s-2)", width: 260 }}>
                      <div className="mono" style={{ fontSize: 13, color: "var(--amber)", fontWeight: 700 }}>
                        {!snapRangeEnabled
                          ? `${minSnapPct}%+ snaps`
                          : (minSnapPct === 1 && maxSnapPct === 100 ? "Any snaps" : `${minSnapPct}-${maxSnapPct}% snaps`)}
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
                      <div style={{ display: "flex", gap: "var(--s-1)", flexWrap: "wrap" }}>
                        {[1, 50, 70, 85].map((m) => (
                          <div key={m} className={`chip ${!snapRangeEnabled && minSnapPct === m ? "active" : ""}`} style={{ whiteSpace: "nowrap" }} onClick={() => setMinSnapPct(m)}>
                            {m === 1 ? "Any snaps" : `${m}%+ snaps`}
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                },
              ],
            },
          ]}
        />
      </div>
    </div>
    <TeamRosterPanel
      teamLabel={oppRoster.label}
      players={oppRoster.players}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => NFL_HEADSHOTS[p.id]}
      metaLine={(p) => p.pos}
      avatarBg={(p) => (NFL_TEAM_COLORS[p.team] || {}).primary || "#000"}
    />
    </div>

      {/* Line input + summary */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {isBinary ? `${marketLabel} rate` : `${marketLabel} line`}
          </div>
          <div className="mono" style={{ fontSize: 28, color: "var(--amber)", textAlign: "center" }}>
            {isBinary ? `${Math.round(hitRate * 100)}%` : effectiveLine}
          </div>
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
            {isBinary ? `achieved in ${hits} of ${values.length} games` : "drag the tab on the chart to adjust"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap", justifyContent: "space-between", gap: 20, width: "100%" }}>
          {[
            { label: "Hit rate", value: `${Math.round(hitRate * 100)}%`, sub: isBinary ? `${hits}/${values.length}` : `${hits}/${values.length}${pushes ? ` · ${pushes} push` : ""}` },
            { label: "Average", value: avg.toFixed(isBinary ? 2 : 1), sub: isBinary ? "per-game rate" : `median ${med}` },
            { label: isBinary ? "Edge vs 50%" : "Edge vs line", value: `${edge >= 0 ? "+" : ""}${edge.toFixed(isBinary ? 2 : 1)}`, sub: edge >= 0 ? "trending over" : "trending under", color: edge >= 0 ? "var(--green)" : "var(--red)" },
          ].map((s) => (
            <div key={s.label} style={{ flex: 1, minWidth: 0, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
              <div className="mono" style={{ fontSize: 22, color: s.color || "var(--text)" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {opponent !== "all" && (() => {
          const oppDef = getNFLDefRank(market, player.pos, opponent);
          const oppTier = nflDefTier(oppDef.rank);
          return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 14px" }}>
              <span style={{ color: "var(--dim)", fontSize: 12 }}>vs {opponent} {defCategoryLabel}</span>
              <span className="mono" style={{ fontSize: 16, color: "var(--text)" }}>{oppDef.rating}</span>
              <span className="mono" style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                padding: "2px 8px", borderRadius: 4,
                color: oppTier === "soft" ? "var(--green)" : oppTier === "tough" ? "var(--red)" : "var(--dim)",
                border: `1px solid ${oppTier === "soft" ? "var(--green)" : oppTier === "tough" ? "var(--red)" : "var(--line)"}`,
              }}>
                #{oppDef.rank} {defCategoryLabel}{oppTier === "soft" ? " · favorable matchup" : oppTier === "tough" ? " · tough matchup" : ""}
              </span>
            </div>
          );
        })()}
      </div>

      {/* Chart */}
      <div
        ref={chartRef}
        style={{
          position: "relative", boxSizing: "border-box", height: isNarrow ? 380 : CHART_HEIGHT,
          background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6,
          padding: isNarrow ? "16px 6px" : 16, marginBottom: 16,
        }}
      >
        <div style={{ height: "100%", width: "100%", touchAction: "pan-y" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
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
            margin={{ top: 10, right: isNarrow ? 30 : 60, bottom: manyGames ? 30 : (isNarrow ? 42 : 78), left: isNarrow ? 0 : 20 }}
            barCategoryGap={isNarrow ? "4%" : "6%"}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#343941" vertical={false} />
            <XAxis
              dataKey={manyGames ? "date" : "axisKey"}
              interval={manyGames ? Math.max(0, Math.ceil(filtered.length / (isNarrow ? 5 : 8)) - 1) : axisTickInterval(filtered.length, isNarrow, chartWidth)}
              tick={manyGames ? (props) => <DateAxisTick {...props} compact={isNarrow} /> : (props) => <TeamAxisTick {...props} logoFn={nflTeamLogo} compact={isNarrow} />}
              axisLine={{ stroke: "#343941" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, chartMax]}
              ticks={chartTicks}
              tick={{ fill: "#8b96a5", fontSize: 11 }}
              axisLine={{ stroke: "#343941" }}
              tickLine={false}
              allowDecimals={false}
              width={isNarrow ? 24 : 60}
              label={isNarrow ? undefined : { value: marketLabel, angle: -90, position: "insideLeft", offset: 10, style: { textAnchor: "middle", fill: "#8b96a5", fontSize: 11, fontWeight: 600 } }}
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
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
            />
            {!isBinary && <ReferenceLine y={dragLine !== null ? dragLine : effectiveLine} stroke="var(--amber)" strokeDasharray="4 4" />}
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {filtered.map((g, i) => {
                const v = statValueNFL(g, market);
                const fill = isBinary ? (v === 1 ? CHART_GREEN : "transparent") : (v > effectiveLine ? CHART_GREEN : CHART_RED);
                return <Cell key={i} fill={fill} />;
              })}
              <LabelList dataKey="value" content={(props) => <BarValueLabel {...props} isBinary={isBinary} />} />
            </Bar>
          </BarChart>
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

      {/* Table */}
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
                    <div style={{ color: tier === "soft" ? "var(--green)" : tier === "tough" ? "var(--red)" : "var(--dim)" }}>#{def.rank}</div>
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

      <div style={{ marginTop: 20, fontSize: 12, color: "var(--dim)" }}>
        Real 2025 regular-season game logs (ESPN Stats API) for every player shown above — the 2026 season hasn't started yet, so this is last season's actual box scores, not a live odds feed.
      </div>
      <PlayerNewsModule playerName={player.name} headshotSrc={NFL_HEADSHOTS[player.id]} />
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
const WNBA_TEAM_COLORS = {
  ATL: { primary: "#E31837", secondary: "#5091CC" },
  CHI: { primary: "#5091CD", secondary: "#FFD520" },
  CON: { primary: "#F05023", secondary: "#0A2240" },
  DAL: { primary: "#002B5C", secondary: "#C4D600" },
  GS: { primary: "#B38FCF", secondary: "#000000" },
  IND: { primary: "#002D62", secondary: "#E03A3E" },
  LV: { primary: "#A7A8AA", secondary: "#000000" },
  LA: { primary: "#552583", secondary: "#FDB927" },
  MIN: { primary: "#266092", secondary: "#79BC43" },
  NY: { primary: "#86CEBC", secondary: "#000000" },
  PHX: { primary: "#3C286E", secondary: "#FA4B0A" },
  POR: { primary: "#CEE5EB", secondary: "#000000" },
  SEA: { primary: "#2C5235", secondary: "#FEE11A" },
  TOR: { primary: "#33476D", secondary: "#7B1B38" },
  WSH: { primary: "#E03A3E", secondary: "#002B5C" },
};

// Same ESPN combiner headshot proxy as the NBA/NFL pages, just pointed at
// the wnba headshot path instead.
const wnbaHeadshot = (espnId) =>
  `https://a.espncdn.com/combiner/i?img=/i/headshots/wnba/players/full/${espnId}.png&w=350&h=350&scale=crop`;

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
const WNBA_TEAM_FULL_NAME = {
  ATL: "Atlanta Dream", CHI: "Chicago Sky", CON: "Connecticut Sun", DAL: "Dallas Wings",
  GS: "Golden State Valkyries", LV: "Las Vegas Aces", MIN: "Minnesota Lynx",
  NY: "New York Liberty", PHX: "Phoenix Mercury", TOR: "Toronto Tempo",
};

const WNBA_SCHEDULE_TTL_MS = 60 * 60 * 1000;
let wnbaScheduleCache = null;
async function fetchWNBALiveSlate() {
  const cacheKey = "wnba_live_slate_v1";
  const now = Date.now();
  if (wnbaScheduleCache && now - wnbaScheduleCache.fetchedAt < WNBA_SCHEDULE_TTL_MS) {
    return wnbaScheduleCache.matchups;
  }
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (now - parsed.fetchedAt < WNBA_SCHEDULE_TTL_MS) {
        wnbaScheduleCache = parsed;
        return parsed.matchups;
      }
    }
  } catch {}

  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const today = new Date();
  const dayAfter = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
  let matchups = [];
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
        if (!WNBA_TEAM_PLAYERS_BY_ABBR[homeAbbr] || !WNBA_TEAM_PLAYERS_BY_ABBR[awayAbbr]) return null;
        const venue = comp?.venue;
        const city = venue?.address
          ? [venue.address.city, venue.address.state].filter(Boolean).join(", ")
          : "";
        return {
          id: `${awayAbbr}-${homeAbbr}-${ev.id}`,
          label: `${WNBA_TEAM_FULL_NAME[awayAbbr].split(" ").pop()} @ ${WNBA_TEAM_FULL_NAME[homeAbbr].split(" ").pop()}`,
          teamA: { label: WNBA_TEAM_FULL_NAME[awayAbbr], players: WNBA_TEAM_PLAYERS_BY_ABBR[awayAbbr] },
          teamB: { label: WNBA_TEAM_FULL_NAME[homeAbbr], players: WNBA_TEAM_PLAYERS_BY_ABBR[homeAbbr] },
          date: ev.date,
          venue: venue?.fullName || "",
          city,
        };
      })
      .filter(Boolean);
  } catch {}

  const record = { matchups, fetchedAt: now };
  wnbaScheduleCache = record;
  try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
  return matchups;
}

// Same synthetic-game-log approach as genGames (NBA) -- per-player base/var
// noised out into a season's worth of games -- just drawing its random
// opponent from the WNBA's own team pool instead of the NBA's.
function genWNBAGames(player, seedOffset) {
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
    const fg3m = noise(player.base.fg3m, player.var.fg3m);
    const ftm = noise(player.base.ftm, player.var.ftm);
    games.push({
      date: d.toISOString().slice(0, 10), opp, home, minutes,
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

function getWNBAGames(player, seedOffset) {
  if (WNBA_REAL_GAME_LOGS[player.id]) return WNBA_REAL_GAME_LOGS[player.id];
  return genWNBAGames(player, seedOffset);
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
  if (WNBA_DD_PLAYERS.has(player.id)) extra.push(WNBA_MILESTONE_MARKETS[0]);
  if (WNBA_TD_PLAYERS.has(player.id)) extra.push(WNBA_MILESTONE_MARKETS[1]);
  return [...WNBA_MARKETS_CORE, ...extra];
}

function WNBAPropsPage({ jumpTo, dataVersion }) {
  // Starts from the static fallback slate, then swaps to ESPN's live
  // scoreboard once it resolves (see fetchWNBALiveSlate) -- keeps the page
  // usable immediately and offline-safe if the fetch ever fails, while still
  // showing tonight's real games instead of a frozen date.
  const [liveMatchups, setLiveMatchups] = useState(null);
  React.useEffect(() => {
    let cancelled = false;
    fetchWNBALiveSlate().then((m) => {
      if (!cancelled && m.length) setLiveMatchups(m);
    });
    return () => { cancelled = true; };
  }, []);
  const matchups = liveMatchups && liveMatchups.length ? liveMatchups : WNBA_MATCHUPS;
  const matchupsByDate = useMemo(() => groupMatchupsByDate(matchups), [matchups]);

  const [matchupId, setMatchupId] = useState(WNBA_MATCHUPS[0].id);
  const matchup = matchups.find((m) => m.id === matchupId) || matchups[0];
  const [playerId, setPlayerId] = useState(WNBA_MATCHUPS[0].teamA.players[0].id);
  const [market, setMarket] = useState("pts");
  const [rebSplit, setRebSplit] = useState("total");
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
  const chartRef = React.useRef(null);
  const chartWidth = useElementWidth(chartRef);
  const isNarrow = useIsNarrow();

  const resetFilters = () => {
    setSide("all");
    setLastN(10);
    setOpponent("all");
    setMinMinutes(0);
    setMaxMinutes(40);
    setMinutesRangeEnabled(false);
    setLine(null);
  };

  const player = ALL_WNBA_PLAYERS.find((p) => p.id === playerId);
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

  const allGames = useMemo(() => getWNBAGames(player, ALL_WNBA_PLAYERS.indexOf(player)), [player, dataVersion]);
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
  const med = median(values);
  const effectiveLine = isBinary ? 0.5 : (line === null ? ceilToHalfOdd(avg) : line);
  const topValue = Math.max(...values, effectiveLine, 1);
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
  const marketLabel = WNBA_MARKETS.find((m) => m.id === market)?.label ?? "";

  return (
    <div className="page-shell page-shell--mobile-nav" style={{ maxWidth: 1920, margin: "0 auto", boxSizing: "border-box" }}>
    <MobilePlayerNav
      teamA={matchup.teamA}
      teamB={matchup.teamB}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => wnbaHeadshot(p.espnId)}
      metaLine={(p) => p.pos}
      avatarBg={(p) => (WNBA_TEAM_COLORS[p.team] || {}).primary || "#000"}
    />
    <div className="roster-layout">
    <TeamRosterPanel
      teamLabel={matchup.teamA.label}
      players={matchup.teamA.players}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => wnbaHeadshot(p.espnId)}
      metaLine={(p) => p.pos}
      avatarBg={(p) => (WNBA_TEAM_COLORS[p.team] || {}).primary || "#000"}
    />
    <div className="roster-layout-center">
      <div style={{ marginBottom: 8 }}>
        {/* Date/matchup pill sits above the player photo/selector since it's
             context about the game, not the player (matches the MLB page's
             layout). */}
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

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20, marginBottom: 12, flexWrap: "wrap" }}>
          <select
            className="select"
            value={matchupId}
            onChange={(e) => {
              const next = matchups.find((m) => m.id === e.target.value);
              setMatchupId(next.id);
              setPlayerId(next.teamA.players[0].id);
              setLine(null);
              setOpponent("all");
            }}
          >
            {matchupsByDate.map((group) => (
              <optgroup label={group.label} key={group.label}>
                {group.matchups.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <div style={{
            position: "relative", width: 122, height: 122, borderRadius: "50%", flexShrink: 0,
            background: teamAvatarBackground(WNBA_TEAM_COLORS, player.team),
            boxShadow: `0 4px 14px ${(WNBA_TEAM_COLORS[player.team] || {}).primary || "#000"}40`,
          }}>
            <div style={{
              position: "absolute", inset: 6, borderRadius: "50%",
              background: (WNBA_TEAM_COLORS[player.team] || {}).primary || "#000",
              border: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }} />
            <img
              key={player.id}
              src={wnbaHeadshot(player.espnId)}
              alt={player.name}
              width={110}
              height={110}
              referrerPolicy="no-referrer"
              style={{
                position: "absolute", inset: 6,
                width: 110, height: 110,
                borderRadius: "50%",
                objectFit: "cover",
                objectPosition: "center top",
                border: "1px solid var(--line)",
                opacity: 0,
                transition: "opacity 0.15s ease",
              }}
              onLoad={(e) => { e.currentTarget.style.opacity = 1; }}
              onError={(e) => { e.currentTarget.style.opacity = 0; }}
            />
          </div>

          <div style={{
            display: "flex", flexDirection: isNarrow ? "column" : "row", alignItems: "center", gap: isNarrow ? 10 : 16,
            background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8,
            padding: isNarrow ? "12px 16px" : "10px 20px",
            width: isNarrow ? "100%" : undefined, boxSizing: "border-box",
          }}>
            <div style={{
              textAlign: "center",
              paddingRight: isNarrow ? 0 : 16, paddingBottom: isNarrow ? 10 : 0,
              borderRight: isNarrow ? "none" : "1px solid var(--line)",
              borderBottom: isNarrow ? "1px solid var(--line)" : "none",
              flexShrink: 0, width: isNarrow ? "100%" : undefined,
            }}>
              <div className="oswald" style={{ fontSize: 18, color: "var(--text)", whiteSpace: "nowrap" }}>{player.name}</div>
              <div style={{ fontSize: 13, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                {player.team} · {player.pos} · Season
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 20 }}>
              {[
                { label: "PTS", value: seasonAvg.pts },
                { label: "REB", value: seasonAvg.reb },
                { label: "AST", value: seasonAvg.ast },
                { label: "MIN", value: seasonAvg.min },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center", width: 66, flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: 19, color: "var(--amber)", fontWeight: 700 }}>{s.value.toFixed(1)}</div>
                  <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "var(--s-3)" }}>
          <MarketSectionGrid
            singleBar
            sections={WNBA_MARKET_SECTIONS.map((s) => ({ ...s, markets: playerMarkets.filter((m) => s.ids.includes(m.id)) }))}
            activeMarket={market}
            onSelect={(id) => { setMarket(id); setLine(null); }}
            isNarrow={isNarrow}
          />
        </div>
        {market === "reb" && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {REB_SPLITS.map((r) => (
              <div key={r.id} className={`chip ${rebSplit === r.id ? "active" : ""}`} onClick={() => setRebSplit(r.id)}>
                {r.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters live inside the center column now, directly under the
           market bar, instead of as a sibling below the whole 3-column
           row -- that row's height is set by the taller roster columns
           regardless of alignment, so anything waiting outside the row
           always waited for the rosters' full height first. */}
      <FiltersSection
        onReset={resetFilters}
        groups={[
          {
            stack: [
              {
                label: "Opponent",
                content: (
                  <select className="select" value={opponent} onChange={(e) => setOpponent(e.target.value)} style={{ width: 240 }}>
                    <option value="all">Any opponent</option>
                    {opponentsForPlayer.map((o) => <option key={o} value={o}>vs {o}</option>)}
                  </select>
                ),
              },
              {
                label: "Game location",
                content: (
                  <div style={{ display: "flex", gap: "var(--s-1)", flexWrap: "wrap" }}>
                    {["all", "home", "away"].map((s) => (
                      <div key={s} className={`chip ${side === s ? "active" : ""}`} onClick={() => setSide(s)}>
                        {s === "all" ? "All games" : s === "home" ? "Home" : "Away"}
                      </div>
                    ))}
                  </div>
                ),
              },
            ],
          },
          {
            stack: [
              {
                label: "Sample size",
                content: (
                  <div style={{ display: "flex", gap: "var(--s-1)", flexWrap: "wrap" }}>
                    {[5, 10, 15, "all"].map((n) => (
                      <div key={n} className={`chip ${lastN === n ? "active" : ""}`} onClick={() => setLastN(n)}>
                        {n === "all" ? "All" : `Last ${n}`}
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                label: "Minutes",
                content: (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--s-2)", width: 260 }}>
                    <div className="mono" style={{ fontSize: 13, color: "var(--amber)", fontWeight: 700 }}>
                      {!minutesRangeEnabled
                        ? (minMinutes === 0 ? "Any minutes" : `${minMinutes}+ min`)
                        : (minMinutes === 0 && maxMinutes === 40 ? "Any minutes" : `${minMinutes}-${maxMinutes} min`)}
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
                  </div>
                ),
              },
            ],
          },
        ]}
      />
    </div>
    <TeamRosterPanel
      teamLabel={matchup.teamB.label}
      players={matchup.teamB.players}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); }}
      headshotSrc={(p) => wnbaHeadshot(p.espnId)}
      metaLine={(p) => p.pos}
      avatarBg={(p) => (WNBA_TEAM_COLORS[p.team] || {}).primary || "#000"}
    />
    </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {isBinary ? `${marketLabel} rate` : `${marketLabel} line`}
          </div>
          <div className="mono" style={{ fontSize: 28, color: "var(--amber)", textAlign: "center" }}>
            {isBinary ? `${Math.round(hitRate * 100)}%` : effectiveLine}
          </div>
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
            {isBinary ? `achieved in ${hits} of ${values.length} games` : "drag the tab on the chart to adjust"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap", justifyContent: "space-between", gap: 20, width: "100%" }}>
          {[
            { label: "Hit rate", value: `${Math.round(hitRate * 100)}%`, sub: isBinary ? `${hits}/${values.length}` : `${hits}/${values.length}${pushes ? ` · ${pushes} push` : ""}` },
            { label: "Average", value: avg.toFixed(isBinary ? 2 : 1), sub: isBinary ? "per-game rate" : `median ${med}` },
            { label: isBinary ? "Edge vs 50%" : "Edge vs line", value: `${edge >= 0 ? "+" : ""}${edge.toFixed(isBinary ? 2 : 1)}`, sub: edge >= 0 ? "trending over" : "trending under", color: edge >= 0 ? "var(--green)" : "var(--red)" },
          ].map((s) => (
            <div key={s.label} style={{ flex: 1, minWidth: 0, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
              <div className="mono" style={{ fontSize: 22, color: s.color || "var(--text)" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {opponent !== "all" && (() => {
          const oppDef = getWNBADefRank(market, opponent);
          const tier = defTier(oppDef.rank);
          return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 14px" }}>
              <span style={{ color: "var(--dim)", fontSize: 12 }}>vs {opponent} defense</span>
              <span className="mono" style={{ fontSize: 16, color: "var(--text)" }}>{oppDef.rating}</span>
              <span className="mono" style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                padding: "2px 8px", borderRadius: 4,
                color: tier === "soft" ? "var(--green)" : tier === "tough" ? "var(--red)" : "var(--dim)",
                border: `1px solid ${tier === "soft" ? "var(--green)" : tier === "tough" ? "var(--red)" : "var(--line)"}`,
              }}>
                #{oppDef.rank} defense{tier === "soft" ? " · favorable matchup" : tier === "tough" ? " · tough matchup" : ""}
              </span>
            </div>
          );
        })()}
      </div>

      <div
        ref={chartRef}
        style={{
          position: "relative", boxSizing: "border-box", height: isNarrow ? 380 : CHART_HEIGHT,
          background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6,
          padding: isNarrow ? "16px 6px" : 16, marginBottom: 16,
        }}
      >
        <div style={{ height: "100%", width: "100%", touchAction: "pan-y" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={filtered.map((g, i) => ({
              idx: i + 1,
              opp: g.opp,
              axisKey: `${g.opp}__${g.date}`,
              value: statValue(g, market, rebSplit),
              date: g.date,
              minutes: g.minutes,
              home: g.home,
            }))}
            margin={{ top: 10, right: isNarrow ? 30 : 60, bottom: manyGames ? 30 : (isNarrow ? 42 : 78), left: isNarrow ? 0 : 20 }}
            barCategoryGap={isNarrow ? "4%" : "6%"}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#343941" vertical={false} />
            <XAxis
              dataKey={manyGames ? "date" : "axisKey"}
              interval={manyGames ? Math.max(0, Math.ceil(filtered.length / (isNarrow ? 5 : 8)) - 1) : axisTickInterval(filtered.length, isNarrow, chartWidth)}
              tick={manyGames ? (props) => <DateAxisTick {...props} compact={isNarrow} /> : (props) => <TeamAxisTick {...props} logoFn={wnbaTeamLogo} compact={isNarrow} />}
              axisLine={{ stroke: "#343941" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, chartMax]}
              ticks={chartTicks}
              tick={{ fill: "#8b96a5", fontSize: 11 }}
              axisLine={{ stroke: "#343941" }}
              tickLine={false}
              allowDecimals={false}
              width={isNarrow ? 24 : 60}
              label={isNarrow ? undefined : { value: marketLabel, angle: -90, position: "insideLeft", offset: 10, style: { textAnchor: "middle", fill: "#8b96a5", fontSize: 11, fontWeight: 600 } }}
            />
            <Tooltip
              content={<ChartTooltip effectiveLine={effectiveLine} isBinary={isBinary} marketLabel={marketLabel} logoFn={wnbaTeamLogo} />}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
            />
            {!isBinary && <ReferenceLine y={dragLine !== null ? dragLine : effectiveLine} stroke="var(--amber)" strokeDasharray="4 4" />}
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {filtered.map((g, i) => {
                const v = statValue(g, market, rebSplit);
                const fill = isBinary ? (v === 1 ? CHART_GREEN : "transparent") : (v > effectiveLine ? CHART_GREEN : CHART_RED);
                return <Cell key={i} fill={fill} />;
              })}
              <LabelList dataKey="value" content={(props) => <BarValueLabel {...props} isBinary={isBinary} />} />
            </Bar>
          </BarChart>
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
                    <div style={{ color: tier === "soft" ? "var(--green)" : tier === "tough" ? "var(--red)" : "var(--dim)" }}>#{def.rank}</div>
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

      <div style={{ marginTop: 20, fontSize: 12, color: "var(--dim)" }}>
        Live 2026 regular-season game logs (ESPN Stats API) for the players shown above, refreshed each tab. Defensive matchup ranks are real opponent points allowed per game.
      </div>
      <PlayerNewsModule playerName={player.name} headshotSrc={wnbaHeadshot(player.espnId)} />
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
const MLB_TEAM_COLORS = {
  ARI: { primary: "#A71930", secondary: "#E3D4AD" },
  ATL: { primary: "#CE1141", secondary: "#13274F" },
  BAL: { primary: "#DF4601", secondary: "#000000" },
  BOS: { primary: "#BD3039", secondary: "#0C2340" },
  CHC: { primary: "#0E3386", secondary: "#CC3433" },
  CWS: { primary: "#27251F", secondary: "#C4CED4" },
  CIN: { primary: "#C6011F", secondary: "#000000" },
  CLE: { primary: "#00385D", secondary: "#E50022" },
  COL: { primary: "#33006F", secondary: "#C4CED4" },
  DET: { primary: "#0C2340", secondary: "#FA4616" },
  HOU: { primary: "#002D62", secondary: "#EB6E1F" },
  KC: { primary: "#004687", secondary: "#BD9B60" },
  LAA: { primary: "#BA0021", secondary: "#003263" },
  LAD: { primary: "#005A9C", secondary: "#EF3E42" },
  MIA: { primary: "#00A3E0", secondary: "#EF3340" },
  MIL: { primary: "#12284B", secondary: "#FFC52F" },
  MIN: { primary: "#002B5C", secondary: "#D31145" },
  NYM: { primary: "#002D72", secondary: "#FF5910" },
  NYY: { primary: "#0C2340", secondary: "#C4CED4" },
  ATH: { primary: "#003831", secondary: "#EFB21E" },
  PHI: { primary: "#E81828", secondary: "#002D72" },
  PIT: { primary: "#FDB827", secondary: "#27251F" },
  SD: { primary: "#2F241D", secondary: "#FFC425" },
  SEA: { primary: "#0C2C56", secondary: "#005C5C" },
  SF: { primary: "#27251F", secondary: "#FD5A1E" },
  STL: { primary: "#C41E3A", secondary: "#0C2340" },
  TB: { primary: "#092C5C", secondary: "#8FBCE6" },
  TEX: { primary: "#003278", secondary: "#C0111F" },
  TOR: { primary: "#134A8E", secondary: "#1D2D5C" },
  WSH: { primary: "#AB0003", secondary: "#14225A" },
};

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

async function fetchMLBTeamNextGame(teamId) {
  const cached = mlbScheduleCache.get(teamId);
  if (cached && Date.now() - cached.fetchedAt < MLB_SCHEDULE_TTL_MS) {
    return cached.game;
  }
  // v3: now also hydrates weather and confirmed lineups (both sides) --
  // weather is only meaningful once MLB has posted it for the game, and
  // lineups are usually posted 1-2 hours before first pitch, so both are
  // simply absent/empty until MLB actually publishes them.
  const cacheKey = `mlb_next_game_${teamId}_v3`;
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Date.now() - parsed.fetchedAt < MLB_SCHEDULE_TTL_MS) {
        mlbScheduleCache.set(teamId, parsed);
        return parsed.game;
      }
    }
  } catch {}

  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${start}&endDate=${end}&hydrate=probablePitcher,venue,weather,lineups`
  );
  const data = await res.json();
  const games = (data?.dates || []).flatMap((d) => d.games || []);
  const upcoming = games.find((g) => g.status?.abstractGameState !== "Final") || games[0] || null;

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
  mlbScheduleCache.set(teamId, record);
  try { sessionStorage.setItem(cacheKey, JSON.stringify(record)); } catch {}
  return game;
}

// The team's real active (25/26-man) roster -- the official MLB Stats API
// roster endpoint, which automatically excludes anyone on the IL, DFA'd, or
// no longer with the org. Used as a live safety filter over the static
// roster arrays below (see applyActiveRoster in MLBPropsPage) so an injured
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

// Every real MLB game scheduled "today" (per currentMLBDayKey), one fetch
// for the whole league instead of one per team -- this is what lets the
// Prop Feed's MATCHUP dropdown show only the teams actually playing, sorted
// by first pitch, and why it only ever needs a single refetch a day.
async function fetchMLBDaySlate() {
  const dayKey = currentMLBDayKey();
  if (mlbSlateCache && mlbSlateCache.dayKey === dayKey && Date.now() - mlbSlateCache.fetchedAt < MLB_SLATE_TTL_MS) {
    return mlbSlateCache.games;
  }
  const cacheKey = "mlb_day_slate_v1";
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

  const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dayKey}&hydrate=probablePitcher`);
  const data = await res.json();
  const rawGames = (data?.dates || []).flatMap((d) => d.games || []);
  const games = rawGames
    .map((g) => ({
      date: g.gameDate,
      status: g.status?.detailedState || "Scheduled",
      awayAbbr: MLB_TEAM_ID_ABBR[g.teams?.away?.team?.id] || "???",
      homeAbbr: MLB_TEAM_ID_ABBR[g.teams?.home?.team?.id] || "???",
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
function GameConditionsBar({ nextGame, teamAbbr, isPitcher }) {
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

  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--s-4)" }}>
      {/* One panel, one border -- venue/weather and the HR/Runs/1B/verdict
           read sit in the same row separated by a hairline divider instead
           of living in two separately-bordered boxes. */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 16,
        padding: "10px 20px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8,
        fontSize: 12.5, color: "var(--dim)", maxWidth: "100%",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="oswald" style={{ fontWeight: 700, color: "var(--text)", letterSpacing: "0.04em", fontSize: 11.5, textTransform: "uppercase" }}>
            Game Conditions
          </span>
          <span>· {nextGame.venue}</span>
          {nextGame.weather && (
            <>
              <span>· {mlbWeatherEmoji(nextGame.weather.condition)} {nextGame.weather.temp}°F</span>
              {nextGame.weather.wind && <span>· 💨 {nextGame.weather.wind}</span>}
            </>
          )}
        </span>
        <span style={{ width: 1, alignSelf: "stretch", background: "var(--line)" }} />
        <span style={{ display: "flex", alignItems: "center", gap: 14, fontWeight: 600, flexWrap: "wrap" }}>
          <span className="mono" style={{ color: statColor(hrPct) }}>HR {signed(hrPct)}</span>
          <span className="mono" style={{ color: statColor(runsPct) }}>Runs {signed(runsPct)}</span>
          <span className="mono" style={{ color: statColor(singlePct) }}>1B {signed(singlePct)}</span>
          <span className="oswald" style={{ color: verdictColor, fontSize: 12.5 }}>{verdict}</span>
        </span>
      </div>
    </div>
  );
}

// Maps this app's internal per-stat market ids to The Odds API's market
// keys -- only markets api/odds.js actually fetches are listed here; any
// other market shows a "not tracked" note instead of a dead button.
const MLB_ODDS_MARKET_KEY = { h: "batter_hits", hr: "batter_home_runs" };

// Sportsbook odds only ever fetch on a button press, never automatically.
// The Odds API's free tier is a small shared monthly credit budget (see
// api/odds.js), so switching markets/players shouldn't silently spend
// credits in the background -- the user has to explicitly ask for a line.
function SportsbookOddsPanel({ teamAbbr, playerName, market, isPitcher }) {
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
      out.push({ book: bm.title, point: over?.point ?? under?.point, over: over?.price, under: under?.price });
    }
    return out;
  }, [state.data, oddsMarketKey, playerName]);

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

      {state.status === "loaded" && !state.data?.odds && (
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
            <span>{state.data.stale ? "cached (stale)" : "live"}</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.book}
              style={{
                display: "flex", justifyContent: "space-between", padding: "8px 16px",
                borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--line)", fontSize: 13,
              }}
            >
              <span style={{ color: "var(--text)" }}>{r.book}</span>
              <span className="mono" style={{ color: "var(--dim)" }}>
                {r.point != null ? `O/U ${r.point}` : ""}
                {r.over != null && <span style={{ marginLeft: 10, color: "var(--green)" }}>O {r.over > 0 ? "+" : ""}{r.over}</span>}
                {r.under != null && <span style={{ marginLeft: 10, color: "var(--red)" }}>U {r.under > 0 ? "+" : ""}{r.under}</span>}
              </span>
            </div>
          ))}
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
  { id: "graph", label: "Graph" },
  { id: "matchup", label: "Matchup" },
  { id: "lineup", label: "Lineup" },
  { id: "bullpen", label: "Bullpen" },
];

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

  const pitchMix = useMemo(() => pitcherPitchMix(pitcher), [pitcher.mlbId]);
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
              <div style={{
                position: "relative", width: 56, height: 56, borderRadius: "50%", margin: "0 auto 6px",
                background: (MLB_TEAM_COLORS[p.team] || {}).primary || "#000",
                boxShadow: `0 0 0 1px ${(MLB_TEAM_COLORS[p.team] || {}).primary || "#000"}`,
              }}>
                <img
                  src={mlbHeadshot(p.mlbId)}
                  alt={p.name}
                  width={52}
                  height={52}
                  referrerPolicy="no-referrer"
                  style={{ position: "absolute", inset: 2, width: 52, height: 52, borderRadius: "50%", objectFit: "cover", objectPosition: "center top" }}
                  onError={(e) => {
                    const fallback = mlbEspnHeadshot(p.id);
                    if (fallback && e.currentTarget.dataset.fallback !== "1") {
                      e.currentTarget.dataset.fallback = "1";
                      e.currentTarget.src = fallback;
                    }
                  }}
                />
              </div>
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
function ExpectedLineupPanel({ battingRoster, lineupRows, teamSplitRow, splitLabel, sample, setSample, showTeamSplits, setShowTeamSplits, selectedBatterId, onSelectBatter }) {
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
                  <td className="oswald" style={{ padding: "6px", fontWeight: 700, color: selected ? "var(--amber)" : "var(--text)", whiteSpace: "nowrap" }}>
                    {row.batter.name}
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

function MLBPropsPage({ jumpTo }) {
  const [teamAbbr, setTeamAbbr] = useState(MLB_TEAM_ID_ABBR[YANKEES_TEAM_ID]);
  const teamRoster = MLB_TEAM_ROSTERS[teamAbbr];
  const [playerId, setPlayerId] = useState(teamRoster.players[0].id);
  const [market, setMarket] = useState("h");
  // Which of the four prop-detail tabs (see MLB_DETAIL_TABS) is showing --
  // "graph" is the original chart/filters/ledger view, the other three
  // render inside MLBMatchupAnalyzer/BullpenAnalyzerPanel below.
  const [view, setView] = useState("graph");

  // Last player clicked in either roster panel, fed into
  // MLBMatchupAnalyzer so it auto-selects that batter/pitcher (nonce forces
  // the effect to re-fire even if the same id is clicked twice in a row).
  const [matchupPick, setMatchupPick] = useState(null);

  // The selected team's actual next scheduled opponent -- pulled live from
  // the MLB Stats API (see fetchMLBTeamNextGame) instead of a fixed mock
  // pairing, so switching teams always shows who they're really playing
  // next, and it rolls forward on its own once that game goes final.
  const [nextGame, setNextGame] = useState(null);
  React.useEffect(() => {
    let cancelled = false;
    const teamId = MLB_ABBR_TEAM_ID[teamAbbr];
    setNextGame(null);
    const load = () => {
      if (!teamId) return;
      fetchMLBTeamNextGame(teamId).then((g) => { if (!cancelled) setNextGame(g); });
    };
    load();
    const interval = setInterval(load, MLB_SCHEDULE_TTL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamAbbr]);
  const oppRoster = (nextGame && MLB_TEAM_ROSTERS[nextGame.opp]) || null;

  // Live active-roster safety filter (see fetchMLBTeamActiveRoster) -- keyed
  // by mlbId -> {name, pos}, refetched whenever the selected team or its real
  // opponent changes, and re-polled on MLB_ACTIVE_ROSTER_TTL_MS otherwise so
  // a same-day demotion/call-up/trade drops out of the projected lineup on
  // its own instead of only refreshing once a new calendar day starts. null
  // while loading/unavailable means "don't filter yet" (liveTeamRoster/
  // liveOppRoster below fall back to the static roster rather than showing
  // nothing); the poll's re-fetch intentionally doesn't reset back to null
  // first, so the panel doesn't flicker to the unfiltered roster every tick.
  const [teamActiveRoster, setTeamActiveRoster] = useState(null);
  React.useEffect(() => {
    let cancelled = false;
    setTeamActiveRoster(null);
    const teamId = MLB_ABBR_TEAM_ID[teamAbbr];
    if (!teamId) return;
    const load = () => { fetchMLBTeamActiveRoster(teamId).then((r) => { if (!cancelled) setTeamActiveRoster(r); }); };
    load();
    const interval = setInterval(load, MLB_ACTIVE_ROSTER_TTL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamAbbr]);

  const [oppActiveRoster, setOppActiveRoster] = useState(null);
  React.useEffect(() => {
    let cancelled = false;
    setOppActiveRoster(null);
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
      label: `${(MLB_TEAM_ROSTERS[g.awayAbbr] || {}).label || g.awayAbbr} @ ${(MLB_TEAM_ROSTERS[g.homeAbbr] || {}).label || g.homeAbbr}`,
      time: matchupTimeLabel(g.date),
    }));
  }, [mlbSlate]);
  const activeMatchupId = matchupOptions.find((m) => m.teams.includes(teamAbbr))?.id || "";

  // Once the slate loads, if the hardcoded default team (or whatever
  // jumpTo/a prior session left selected) isn't actually playing today,
  // snap the selection to the first real matchup instead of leaving the
  // dropdown showing nothing selected -- only runs once, so it never
  // overrides a team the user (or a jumpTo) has deliberately picked since.
  const initializedFromSlate = React.useRef(false);
  React.useEffect(() => {
    if (initializedFromSlate.current || !matchupOptions.length) return;
    initializedFromSlate.current = true;
    if (!matchupOptions.some((m) => m.teams.includes(teamAbbr))) {
      const nextTeam = matchupOptions[0].teams[0];
      setTeamAbbr(nextTeam);
      setPlayerId(MLB_TEAM_ROSTERS[nextTeam].players[0].id);
    }
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
    if (live) {
      setTeamAbbr(live.team);
      setJumpedPitcher({ id: jumpTo.playerId, name: jumpTo.meta?.name || "Probable Pitcher", team: live.team, mlbId: live.mlbId });
    } else {
      const jumpPlayer = ALL_MLB_PLAYERS.find((p) => p.id === jumpTo.playerId);
      if (jumpPlayer) setTeamAbbr(jumpPlayer.team);
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
  const [minPA, setMinPA] = useState(0);
  const [maxPA, setMaxPA] = useState(6);
  const [paRangeEnabled, setPaRangeEnabled] = useState(false);
  const [line, setLine] = useState(null);
  const [dragLine, setDragLine] = useState(null);
  const [showStatInfo, setShowStatInfo] = useState(false);
  const chartRef = React.useRef(null);
  const chartWidth = useElementWidth(chartRef);
  const isNarrow = useIsNarrow();

  // With/Without teammate splits -- each chip is {mlbId, name, mode}, mode
  // "with" requires that teammate to have played (per the real boxscore) in
  // a given game for it to count, "without" requires them to not have. See
  // the "Teammates" filter group below and fetchMLBGameBoxscoreLineupIds.
  const [teammateChips, setTeammateChips] = useState([]);
  const [boxscoreLineups, setBoxscoreLineups] = useState({});
  const [boxscoresLoading, setBoxscoresLoading] = useState(false);

  const resetFilters = () => {
    setSide("all");
    setLastN(10);
    setOpponent("all");
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
  //
  // Once MLB posts the day's confirmed batting order (nextGame.ourLineupIds
  // -- real mlbIds from the live schedule fetch), position players are
  // filtered down to just that list -- this is what drops someone like an
  // IL'd Bellinger out of the Yankees' static roster array below without
  // needing a separate "who's on the IL" lookup. If the confirmed list
  // hasn't posted yet, or happens to share zero mlbIds with our static
  // roster (e.g. a mid-week call-up we don't have modeled), it falls back
  // to showing the full static roster rather than an empty/wrong panel.
  const applyConfirmedLineup = (roster, lineupIds, activeRoster, abbr) => {
    if (!lineupIds || !lineupIds.length) return roster;
    const known = roster.players.filter((p) => p.pos === "SP" || lineupIds.includes(p.mlbId));
    // A confirmed starter who isn't in our static projected 9 (a call-up or
    // trade-deadline addition we don't have modeled) still needs to show --
    // pull their name/position from the active-roster fetch (which has both)
    // so the panel reflects the real confirmed lineup rather than silently
    // dropping them.
    const knownIds = new Set(known.map((p) => p.mlbId));
    const extras = (activeRoster || [])
      .filter((p) => lineupIds.includes(p.mlbId) && !knownIds.has(p.mlbId))
      .map((p) => ({ id: `mlb_live_${p.mlbId}`, name: p.name, team: abbr, pos: p.pos, mlbId: p.mlbId }));
    const filtered = [...known, ...extras];
    if (!filtered.some((p) => p.pos !== "SP")) return roster;
    return { label: roster.label, players: filtered };
  };

  // Live safety filter run before applyConfirmedLineup: drops any static
  // roster entry (see MLB_PLAYERS etc.) that isn't actually on the team's
  // real active roster right now -- an IL'd, DFA'd, or traded-away player
  // never shows up here regardless of whether MLB has posted today's exact
  // batting order yet, which is what applyConfirmedLineup alone couldn't
  // guard against. This only ever trims the static 9-man projected lineup
  // down, never adds the rest of the active/bench roster on top of it --
  // that's what kept every backup catcher/utility infielder showing up
  // alongside the real projected starters before a lineup is confirmed.
  // `activeRoster` is null while loading or if the fetch failed -- in that
  // case this is a no-op, same "never show an empty/wrong panel" fallback
  // philosophy as applyConfirmedLineup below.
  const applyActiveRoster = (roster, activeRoster) => {
    if (!activeRoster || !activeRoster.length) return roster;
    const activeIds = new Set(activeRoster.map((p) => p.mlbId));
    const kept = roster.players.filter((p) => p.pos === "SP" || activeIds.has(p.mlbId));
    if (!kept.some((p) => p.pos !== "SP")) return roster;
    return { label: roster.label, players: kept };
  };

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
    const reconciled = applyActiveRoster(base, teamActiveRoster);
    return applyConfirmedLineup(reconciled, nextGame?.ourLineupIds, teamActiveRoster, teamAbbr);
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
    const reconciled = applyActiveRoster(base, oppActiveRoster);
    return applyConfirmedLineup(reconciled, nextGame?.oppLineupIds, oppActiveRoster, nextGame.opp);
  }, [oppRoster, nextGame, oppActiveRoster]);

  const player =
    liveTeamRoster.players.find((p) => p.id === playerId) ||
    (liveOppRoster && liveOppRoster.players.find((p) => p.id === playerId)) ||
    ALL_MLB_PLAYERS.find((p) => p.id === playerId) ||
    liveTeamRoster.players[0];
  const isPitcher = player.pos === "SP";

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

  const opponentsForPlayer = useMemo(
    () => Array.from(new Set(allGames.map((g) => g.opp))).sort(),
    [allGames]
  );

  // Every gamePk within the current side/opponent/PA scope (i.e. everything
  // the teammate predicate below might need to check) -- NOT the full
  // season blind, and computed before the teammate filter itself so adding
  // a chip doesn't change what counts as "in scope." Only populated while
  // at least one teammate chip is active, since boxscore fetches are
  // otherwise unnecessary.
  const teammateScopeGamePks = useMemo(() => {
    if (isPitcher || !teammateChips.length) return [];
    const scoped = allGames.filter((game) => {
      if (side === "home" && !game.home) return false;
      if (side === "away" && game.home) return false;
      if (opponent !== "all" && game.opp !== opponent) return false;
      if (game.pa < minPA || game.pa > maxPA) return false;
      return true;
    });
    return Array.from(new Set(scoped.map((g) => g.gamePk).filter(Boolean)));
  }, [allGames, side, opponent, minPA, maxPA, teammateChips.length, isPitcher]);

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

  const filtered = useMemo(() => {
    let g = allGames.filter((game) => {
      if (side === "home" && !game.home) return false;
      if (side === "away" && game.home) return false;
      if (opponent !== "all" && game.opp !== opponent) return false;
      if (!isPitcher && (game.pa < minPA || game.pa > maxPA)) return false;
      if (!isPitcher && teammateChips.length) {
        if (!game.gamePk) return false;
        const ids = boxscoreLineups[game.gamePk];
        // Still loading that game's boxscore -- excluded rather than
        // counted as a hit until we actually know, so the sample never
        // silently over-includes while fetches are in flight.
        if (!ids) return false;
        for (const chip of teammateChips) {
          const played = ids.has(chip.mlbId);
          if (chip.mode === "with" && !played) return false;
          if (chip.mode === "without" && played) return false;
        }
      }
      return true;
    });
    if (lastN !== "all") g = g.slice(-lastN);
    return g;
  }, [allGames, side, opponent, minPA, maxPA, lastN, isPitcher, teammateChips, boxscoreLineups]);

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
  const values = filtered.map((g) => (isPitcher ? statValueMLBPitcher(g, market) : statValueMLB(g, market)));
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const med = median(values);
  const effectiveLine = isBinary ? 0.5 : (line === null ? ceilToHalfOdd(avg) : line);
  const topValue = Math.max(...values, effectiveLine, 1);
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

  return (
    <div className="page-shell page-shell--mobile-nav" style={{ maxWidth: 1920, margin: "0 auto", boxSizing: "border-box" }}>
    <MobilePlayerNav
      teamA={{ ...liveTeamRoster, bullpen: teamBullpenList }}
      teamB={liveOppRoster ? { ...liveOppRoster, bullpen: oppBullpenList } : { label: "Loading…", players: [] }}
      activeId={playerId}
      onSelect={(id) => {
        setPlayerId(id); setLine(null); setOpponent("all");
        const side = liveTeamRoster.players.some((p) => p.id === id) ? "team" : "opp";
        setMatchupPick({ side, id, nonce: Date.now() });
      }}
      headshotSrc={(p) => mlbHeadshot(p.mlbId)}
      headshotFallback={(p) => mlbEspnHeadshot(p.id)}
      metaLine={(p) => p.pos}
      avatarBg={(p) => (MLB_TEAM_COLORS[p.team] || {}).primary || "#000"}
    />
    {/* Game Conditions: rendered full-width above the 3-column roster
         layout (rather than inside its narrow center column) so it's
         genuinely centered across the whole page, not squeezed between the
         two roster panels. */}
    <GameConditionsBar nextGame={nextGame} teamAbbr={teamAbbr} isPitcher={isPitcher} />
    <div className="roster-layout">
    <TeamRosterPanel
      teamLabel={liveTeamRoster.label}
      players={liveTeamRoster.players}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); setMatchupPick({ side: "team", id, nonce: Date.now() }); }}
      headshotSrc={(p) => mlbHeadshot(p.mlbId)}
      headshotFallback={(p) => mlbEspnHeadshot(p.id)}
      metaLine={(p) => p.pos}
      avatarBg={(p) => (MLB_TEAM_COLORS[p.team] || {}).primary || "#000"}
      confirmed={(nextGame?.ourLineupIds?.length || 0) > 0}
      bullpen={teamBullpenList}
    />
    <div className="roster-layout-center">
      {/* Next-game info bar: the selected team's real next scheduled
           opponent (see fetchMLBTeamNextGame), not a fixed mock date -- so
           it always reflects the actual live schedule. Sits above the
           player photo/selector since it's context about the game, not the
           player. Renders nothing until the live fetch resolves. */}
      {nextGame && (
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
              {new Date(nextGame.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <span>·</span>
            <span className="mono" style={{ color: "var(--amber)", fontWeight: 700 }}>
              {new Date(nextGame.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      )}

      {/* Graph / Matchup / Lineup / Bullpen tabs -- swaps the section below
           between the chart+filters+ledger view and the three matchup-
           research panels. Scrolls horizontally instead of wrapping once
           narrower than four pills fit, so it stays a single row of tap
           targets on mobile rather than jumping to two rows. */}
      <div
        role="tablist"
        style={{
          display: "flex", justifyContent: isNarrow ? "flex-start" : "center", gap: 6, marginBottom: 14,
          overflowX: isNarrow ? "auto" : "visible", WebkitOverflowScrolling: "touch",
        }}
      >
        {MLB_DETAIL_TABS.map((v) => (
          <div
            key={v.id}
            onClick={() => setView(v.id)}
            role="tab"
            aria-selected={view === v.id}
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

      {/* Matchup + market selectors -- picking one of today's real games
           (see fetchMLBDaySlate) sets the "our side" team, and its real next
           scheduled opponent (see fetchMLBTeamNextGame) populates the other
           roster panel -- the same "pick a matchup, see its two rosters"
           pattern the NFL/WNBA pages use. Picking an individual player
           happens by clicking their row in either roster panel. */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20, marginBottom: 12, flexWrap: "wrap" }}>
          <select
            className="select"
            value={activeMatchupId}
            onChange={(e) => {
              const mo = matchupOptions.find((m) => m.id === e.target.value);
              if (!mo) return;
              const nextTeam = mo.teams[0];
              setTeamAbbr(nextTeam);
              setPlayerId(MLB_TEAM_ROSTERS[nextTeam].players[0].id);
              setLine(null);
              setOpponent("all");
            }}
          >
            {!matchupOptions.length && <option value="">Loading today's games…</option>}
            {matchupOptions.map((mo) => (
              <option key={mo.id} value={mo.id}>{mo.label} — {mo.time}</option>
            ))}
          </select>
          <div style={{
            position: "relative", width: 122, height: 122, borderRadius: "50%", flexShrink: 0,
            background: teamAvatarBackground(MLB_TEAM_COLORS, player.team),
            boxShadow: `0 4px 14px ${(MLB_TEAM_COLORS[player.team] || {}).primary || "#000"}40`,
          }}>
            {/* Always-visible black backing, in case the headshot image can't load
                 -- covers rookies/trades/missing photos. */}
            <div style={{
              position: "absolute", inset: 6, borderRadius: "50%",
              background: "#000",
              border: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }} />
            <img
              key={player.id}
              src={mlbHeadshot(player.mlbId)}
              alt={player.name}
              width={110}
              height={110}
              referrerPolicy="no-referrer"
              style={{
                position: "absolute", inset: 6,
                width: 110, height: 110,
                borderRadius: "50%",
                objectFit: "cover",
                objectPosition: "center top",
                border: "1px solid var(--line)",
                opacity: 0,
                transition: "opacity 0.15s ease",
              }}
              onLoad={(e) => { e.currentTarget.style.opacity = 1; }}
              onError={(e) => {
                const fallback = mlbEspnHeadshot(player.id);
                if (fallback && e.currentTarget.dataset.fallback !== "1") {
                  e.currentTarget.dataset.fallback = "1";
                  e.currentTarget.src = fallback;
                } else {
                  e.currentTarget.style.opacity = 0;
                }
              }}
            />
          </div>

          {/* Player snapshot: season averages at a glance, next to the selector. */}
          <div style={{
            display: "flex", alignItems: "center", gap: 18,
            background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8,
            padding: "10px 20px",
          }}>
            <div style={{ textAlign: "center", paddingRight: 14, borderRight: "1px solid var(--line)" }}>
              <div className="oswald" style={{ fontSize: 14, color: "var(--text)", whiteSpace: "nowrap" }}>{player.name}</div>
              <div style={{ fontSize: 10.5, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {player.team} · {player.pos} · Season
              </div>
            </div>
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
                <div className="mono" style={{ fontSize: 19, color: "var(--amber)", fontWeight: 700 }}>{s.value.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Batter rate-stat bar -- value on top is the current filtered
             sample's rate, the small line underneath is the delta against
             the full-season baseline (dim when it rounds to ~0, green/red
             depending on whether that stat trending up is good or bad for
             a batter). Only batters carry the AB/BB/HBP/SF fields needed
             for AVG/OBP/BABIP, so pitchers keep their existing K/ER/BB/H
             card above instead. */}
        {!isPitcher && battingWindow && battingSeason && (() => {
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
            <div style={{ position: "relative" }}>
              <div style={{
                display: "flex", justifyContent: "center", gap: 26, flexWrap: "wrap",
                background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8,
                padding: "10px 20px", marginTop: 10,
              }}>
                {cards.map((c) => (
                  <div key={c.key} style={{ textAlign: "center", minWidth: 52 }}>
                    <div style={{
                      fontSize: 10.5, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em",
                      marginBottom: 2,
                      textDecoration: c.key === "hits" && market === "h" ? "underline var(--amber)" : "none",
                      textUnderlineOffset: 3,
                    }}>
                      {c.label}
                    </div>
                    <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>{c.value}</div>
                    <div className="mono" style={{ fontSize: 11, fontWeight: 600, color: c.delta.color }}>{c.delta.text}</div>
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
                <div style={{
                  marginTop: 8, padding: "12px 14px",
                  background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 6,
                }}>
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
        })()}

        {/* Pitcher rate-stat bar -- same "current filtered view vs. full-
             season baseline" framing as the batter bar above, just with the
             pitching-side equivalents (IP/K/ERA/WHIP/H9/BB9) computed from
             the pitcher game log's outs/k/er/h/bb fields. */}
        {isPitcher && pitchingWindow && pitchingSeason && (() => {
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
            <div style={{ position: "relative" }}>
              <div style={{
                display: "flex", justifyContent: "center", gap: 26, flexWrap: "wrap",
                background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8,
                padding: "10px 20px", marginTop: 10,
              }}>
                {cards.map((c) => (
                  <div key={c.key} style={{ textAlign: "center", minWidth: 52 }}>
                    <div style={{
                      fontSize: 10.5, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em",
                      marginBottom: 2,
                      textDecoration: c.key === "k" && market === "p_k" ? "underline var(--amber)" : "none",
                      textUnderlineOffset: 3,
                    }}>
                      {c.label}
                    </div>
                    <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>{c.value}</div>
                    <div className="mono" style={{ fontSize: 11, fontWeight: 600, color: c.delta.color }}>{c.delta.text}</div>
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
                <div style={{
                  marginTop: 8, padding: "12px 14px",
                  background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 6,
                }}>
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
        })()}

        <div style={{ marginTop: "var(--s-3)" }}>
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
      </div>

      {/* Filters live inside the center column now, directly under the
           market bar, instead of as a sibling below the whole 3-column
           row -- that row's height is set by the taller roster columns
           regardless of alignment, so anything waiting outside the row
           always waited for the rosters' full height first. */}
      <FiltersSection
        onReset={resetFilters}
        groups={[
          {
            stack: [
              {
                label: "Opponent",
                content: (
                  <select
                    className="select"
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                    style={{ width: 240 }}
                  >
                    <option value="all">Any opponent</option>
                    {opponentsForPlayer.map((o) => <option key={o} value={o}>vs {o}</option>)}
                  </select>
                ),
              },
              {
                label: "Game location",
                content: (
                  <div style={{ display: "flex", gap: "var(--s-1)", flexWrap: "wrap" }}>
                    {["all", "home", "away"].map((s) => (
                      <div key={s} className={`chip ${side === s ? "active" : ""}`} onClick={() => setSide(s)}>
                        {s === "all" ? "All games" : s === "home" ? "Home" : "Away"}
                      </div>
                    ))}
                  </div>
                ),
              },
            ],
          },
          {
            stack: [
              {
                label: "Sample size",
                content: (
                  <div style={{ display: "flex", gap: "var(--s-1)", flexWrap: "wrap" }}>
                    {[5, 10, 15, 25, "all"].map((n) => (
                      <div key={n} className={`chip ${lastN === n ? "active" : ""}`} onClick={() => setLastN(n)}>
                        {n === "all" ? "All" : `Last ${n}`}
                      </div>
                    ))}
                  </div>
                ),
              },
              ...(isPitcher ? [] : [{
                label: "Plate appearances",
                content: (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--s-2)", width: 260 }}>
                    <div className="mono" style={{ fontSize: 13, color: "var(--amber)", fontWeight: 700 }}>
                      {!paRangeEnabled
                        ? (minPA === 0 ? "Any PA" : `${minPA}+ PA`)
                        : (minPA === 0 && maxPA === 6 ? "Any PA" : `${minPA}-${maxPA} PA`)}
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
                ),
              }]),
            ],
          },
          ...(isPitcher ? [] : [{
            stack: [
              {
                label: "Teammates",
                content: (
                  <TeammateChipGrid
                    roster={liveTeamRoster.players}
                    excludeId={player.mlbId}
                    chips={teammateChips}
                    onChange={setTeammateChips}
                    loading={boxscoresLoading}
                  />
                ),
              },
            ],
          }]),
        ]}
      />
    </div>
    <TeamRosterPanel
      teamLabel={(liveOppRoster || {}).label || "Loading…"}
      players={(liveOppRoster || {}).players || []}
      activeId={playerId}
      onSelect={(id) => { setPlayerId(id); setLine(null); setOpponent("all"); setMatchupPick({ side: "opp", id, nonce: Date.now() }); }}
      headshotSrc={(p) => mlbHeadshot(p.mlbId)}
      headshotFallback={(p) => mlbEspnHeadshot(p.id)}
      metaLine={(p) => p.pos}
      avatarBg={(p) => (MLB_TEAM_COLORS[p.team] || {}).primary || "#000"}
      confirmed={(nextGame?.oppLineupIds?.length || 0) > 0}
      bullpen={oppBullpenList}
    />
    </div>

      {(view === "matchup" || view === "lineup") && (
        <div style={{ marginTop: "var(--s-3)" }}>
          <MLBMatchupAnalyzer teamRoster={liveTeamRoster} oppRoster={liveOppRoster} nextGame={nextGame} pick={matchupPick} section={view} />
        </div>
      )}

      {view === "bullpen" && (
        <div style={{ marginTop: "var(--s-3)" }}>
          <BullpenAnalyzerPanel teamLabel={opposingBullpenLabel} bullpen={opposingBullpenList} />
        </div>
      )}

      {view === "graph" && (
      <>
      {/* Line input + summary */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {isBinary ? `${marketLabel} rate` : `${marketLabel} line`}
          </div>
          <div className="mono" style={{ fontSize: 28, color: "var(--amber)", textAlign: "center" }}>
            {isBinary ? `${Math.round(hitRate * 100)}%` : effectiveLine}
          </div>
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
            {isBinary ? `achieved in ${hits} of ${values.length} games` : "drag the tab on the chart to adjust"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap", justifyContent: "space-between", gap: 20, width: "100%" }}>
          {[
            { label: "Hit rate", value: `${Math.round(hitRate * 100)}%`, sub: isBinary ? `${hits}/${values.length}` : `${hits}/${values.length}${pushes ? ` · ${pushes} push` : ""}` },
            { label: "Average", value: avg.toFixed(isBinary ? 2 : 1), sub: isBinary ? "per-game rate" : `median ${med}` },
            { label: isBinary ? "Edge vs 50%" : "Edge vs line", value: `${edge >= 0 ? "+" : ""}${edge.toFixed(isBinary ? 2 : 1)}`, sub: edge >= 0 ? "trending over" : "trending under", color: edge >= 0 ? "var(--green)" : "var(--red)" },
          ].map((s) => (
            <div key={s.label} style={{ flex: 1, minWidth: 0, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
              <div className="mono" style={{ fontSize: 22, color: s.color || "var(--text)" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <SportsbookOddsPanel teamAbbr={teamAbbr} playerName={player.name} market={market} isPitcher={isPitcher} />

      {/* Chart */}
      <div
        ref={chartRef}
        style={{
          position: "relative", boxSizing: "border-box", height: isNarrow ? 380 : CHART_HEIGHT,
          background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, padding: isNarrow ? "16px 6px" : 16, marginBottom: 16,
        }}
      >
        <div style={{ height: "100%", width: "100%", touchAction: "pan-y" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={filtered.map((g, i) => ({
              idx: i + 1,
              opp: g.opp,
              axisKey: `${g.opp}__${g.date}`,
              value: isPitcher ? statValueMLBPitcher(g, market) : statValueMLB(g, market),
              date: g.date,
              minutes: isPitcher ? formatOuts(g.outs) : g.pa,
              home: g.home,
              defRank: MLB_TEAM_DEF[g.opp].rank,
            }))}
            margin={{ top: 10, right: isNarrow ? 30 : 60, bottom: manyGames ? 30 : (isNarrow ? 42 : 78), left: isNarrow ? 0 : 20 }}
            barCategoryGap={isNarrow ? "4%" : "6%"}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#343941" vertical={false} />
            <XAxis
              dataKey={manyGames ? "date" : "axisKey"}
              interval={manyGames ? Math.max(0, Math.ceil(filtered.length / (isNarrow ? 5 : 8)) - 1) : axisTickInterval(filtered.length, isNarrow, chartWidth)}
              tick={manyGames ? (props) => <DateAxisTick {...props} compact={isNarrow} /> : (props) => <TeamAxisTick {...props} logoFn={mlbTeamLogo} compact={isNarrow} />}
              axisLine={{ stroke: "#343941" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, chartMax]}
              ticks={chartTicks}
              tick={{ fill: "#8b96a5", fontSize: 11 }}
              axisLine={{ stroke: "#343941" }}
              tickLine={false}
              allowDecimals={false}
              width={isNarrow ? 24 : 60}
              label={isNarrow ? undefined : { value: marketLabel, angle: -90, position: "insideLeft", offset: 10, style: { textAnchor: "middle", fill: "#8b96a5", fontSize: 11, fontWeight: 600 } }}
            />
            <Tooltip
              content={<ChartTooltip effectiveLine={effectiveLine} isBinary={isBinary} marketLabel={marketLabel} footerLabel={(d) => (isPitcher ? `${d.minutes} IP` : `${d.minutes} PA`)} logoFn={mlbTeamLogo} />}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
            />
            {!isBinary && <ReferenceLine y={dragLine !== null ? dragLine : effectiveLine} stroke="var(--amber)" strokeDasharray="4 4" />}
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {filtered.map((g, i) => {
                const v = isPitcher ? statValueMLBPitcher(g, market) : statValueMLB(g, market);
                const fill = isBinary ? (v === 1 ? CHART_GREEN : "transparent") : (v > effectiveLine ? CHART_GREEN : CHART_RED);
                return <Cell key={i} fill={fill} />;
              })}
              <LabelList dataKey="value" content={(props) => <BarValueLabel {...props} isBinary={isBinary} />} />
            </Bar>
          </BarChart>
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

      {/* Table */}
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
                const tier = mlbDefTier(def.rank);
                return (
                  <div key={`${g.date}-${i}`} className="ledger-row mono" style={{ display: "grid", gridTemplateColumns: "5fr 9fr 6fr 6fr 6fr 6fr 7fr 6fr 7fr", padding: "9px 14px", fontSize: 12.5, textAlign: "center" }}>
                    <div style={{ color: "var(--dim)" }}>{filtered.length - i}</div>
                    <div>{g.date}</div>
                    <div>{g.opp}</div>
                    <div style={{ color: tier === "soft" ? "var(--green)" : tier === "tough" ? "var(--red)" : "var(--dim)" }}>#{def.rank}</div>
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
      </>
      )}
      <PlayerNewsModule playerName={player.name} headshotSrc={mlbHeadshot(player.mlbId)} />
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
  ALL_WNBA_PLAYERS.forEach((player, pi) => {
    const games = getWNBAGames(player, pi);
    const nextOpp = games[games.length - 1].opp;
    const gameDate = matchupDateForPlayer(WNBA_MATCHUPS, player.id);
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
        name: player.name,
        team: player.team,
        date: gameDate,
        subtitle: isBinary ? m.label : `Over ${line} ${m.label}`,
        opp: nextOpp,
        rank, tier, rankLabel: wnbaDefCategoryLabel(m.id),
        l5: hitRateWindow(values, 5, hit),
        l10: hitRateWindow(values, 10, hit),
        l20: hitRateWindow(values, 20, hit),
        all: hitRateWindow(values, "all", hit),
        values, line, isBinary, variance,
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
function formatOdds(o) {
  return o > 0 ? `+${o}` : String(o);
}
function americanToDecimal(o) {
  return o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o);
}
function decimalToAmerican(d) {
  return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
}
// Multiplies each leg's decimal odds together for the combined parlay price
// -- the standard way sportsbooks combine independent legs into one payout.
function combineParlayOdds(americanOddsList) {
  if (americanOddsList.length === 0) return null;
  const combinedDecimal = americanOddsList.reduce((acc, o) => acc * americanToDecimal(o), 1);
  return decimalToAmerican(combinedDecimal);
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
        name: player.name,
        team: player.team,
        subtitle: isBinary ? m.label : `Over ${line} ${m.label}`,
        opp: nextOpp,
        rank, tier, rankLabel: nbaDefCategoryLabel(m.id),
        l5: hitRateWindow(values, 5, hit),
        l10: hitRateWindow(values, 10, hit),
        l20: hitRateWindow(values, 20, hit),
        all: hitRateWindow(values, "all", hit),
        values, line, isBinary, variance,
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
        name: player.name,
        team: player.team,
        date: gameDate,
        subtitle: isBinary ? m.label : `Over ${line} ${m.label}`,
        opp: nextOpp,
        rank: def.rank, tier, rankLabel: nflDefCategoryLabel(m.id, player.pos),
        l5: hitRateWindow(values, 5, hit),
        l10: hitRateWindow(values, 10, hit),
        l20: hitRateWindow(values, 20, hit),
        all: hitRateWindow(values, "all", hit),
        values, line, isBinary, variance,
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
  teamsData.forEach(({ players, gameLogsById, nextGame }) => {
    if (!nextGame) return;
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
          key: `mlb_${player.id}_${m.id}`,
          playerId: player.id,
          marketId: m.id,
          category: MLB_MARKET_CATEGORY[m.id],
          icon: mlbTeamLogo(player.team),
          name: player.name,
          team: player.team,
          date: nextGame.date,
          subtitle: `Over ${line} ${m.label}`,
          opp: nextGame.opp,
          rank, tier, rankLabel: mlbDefCategoryLabel(m.id),
          l5: hitRateWindow(values, 5, hit),
          l10: hitRateWindow(values, 10, hit),
          l20: hitRateWindow(values, 20, hit),
          all: hitRateWindow(values, "all", hit),
          values, line, isBinary: false, variance,
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

// Pitcher props are scoped to whoever is actually announced to start each
// team's next game (see fetchMLBTeamNextGame's probablePitcher field) --
// not the full staff -- so this rolls to the new starter automatically once
// one is announced, same cadence as the rest of the feed.
// teamsData: one entry per MLB team -- { teamAbbr, pitcherGames, nextGame }.
function buildMLBPitcherFeedRows(teamsData) {
  const rows = [];
  teamsData.forEach(({ teamAbbr, pitcherGames, nextGame }) => {
    const pitcher = nextGame?.probablePitcher;
    if (!pitcher || !pitcherGames || !pitcherGames.length) return;
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
        key: `mlb_pitcher_${pitcher.mlbId}_${m.id}`,
        playerId: mlbLivePitcherId(teamAbbr, pitcher.mlbId),
        marketId: m.id,
        category: MLB_MARKET_CATEGORY[m.id],
        icon: mlbTeamLogo(teamAbbr),
        name: pitcher.name,
        team: teamAbbr,
        date: nextGame.date,
        subtitle: `Over ${line} ${m.label}`,
        opp: nextGame.opp,
        rank, tier, rankLabel: mlbDefCategoryLabel(m.id),
        l5: hitRateWindow(values, 5, hit),
        l10: hitRateWindow(values, 10, hit),
        l20: hitRateWindow(values, 20, hit),
        all: hitRateWindow(values, "all", hit),
        values, line, isBinary: false, variance,
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
    id: "matchup", label: "Easiest Matchup", metric: (r) => r.rank, defaultDir: "desc",
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
function WindowSwitcher({ value, onChange }) {
  return (
    <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
      {FEED_WINDOWS.map(([label, key], idx) => (
        <div
          key={key}
          className="mono"
          onClick={() => onChange(key)}
          title={`Show ${label} hit rate everywhere`}
          style={{
            cursor: "pointer",
            padding: "6px 16px",
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
  const [category, setCategory] = useState("All");
  const [sampleWindow, setSampleWindow] = useState("l10");
  const [sortMode, setSortMode] = useState("matchup");
  const [sortDir, setSortDir] = useState("desc");
  const [showSortInfo, setShowSortInfo] = useState(false);
  const [sortInfoHover, setSortInfoHover] = useState(false);
  const [sortDirInfoHover, setSortDirInfoHover] = useState(false);

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

  // Team filter -- "all" means no filtering. Resets to "all" whenever the
  // sport switches since the option list is sport-specific.
  const [teamFilter, setTeamFilter] = useState("all");

  const nbaRows = useMemo(() => buildNBAFeedRows(), []);
  // wnbaDataVersion/nflDataVersion bump when their real per-player game logs
  // and defense rankings finish loading (see the effects in PropLedger) --
  // without them in the dependency array, these would compute once on mount
  // against whatever fallback/mock data existed at that instant and never
  // recompute once the real data actually arrives.
  const wnbaRows = useMemo(() => buildWNBAFeedRows(), [wnbaDataVersion]);
  const nflRows = useMemo(() => buildNFLFeedRows(), [nflDataVersion]);

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
          slate.forEach((game) => {
            [
              { abbr: game.awayAbbr, isHome: false },
              { abbr: game.homeAbbr, isHome: true },
            ].forEach(({ abbr, isHome }) => {
              const roster = MLB_TEAM_ROSTERS[abbr];
              if (!roster) return;
              teamEntries.push({
                abbr,
                roster,
                nextGame: {
                  date: game.date,
                  opp: isHome ? game.awayAbbr : game.homeAbbr,
                  home: isHome,
                  status: game.status,
                  probablePitcher: isHome ? game.homeProbablePitcher : game.awayProbablePitcher,
                },
              });
            });
          });
          // Only the announced probable starter's log is fetched per team --
          // pitcher props roll to whoever that is once MLB names a new one.
          return Promise.all(
            teamEntries.map(({ abbr, roster, nextGame }) =>
              Promise.all([
                Promise.all(roster.players.map((p) => fetchMLBGameLog(p.mlbId).then((games) => [p.id, games]))),
                nextGame.probablePitcher ? fetchMLBPitcherGameLog(nextGame.probablePitcher.mlbId) : Promise.resolve([]),
              ]).then(([entries, pitcherGames]) => ({
                teamAbbr: abbr,
                players: roster.players,
                gameLogsById: Object.fromEntries(entries),
                pitcherGames,
                nextGame,
              }))
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
    return mlbSlate.map((g, i) => ({
      id: `${g.awayAbbr}-${g.homeAbbr}-${i}`,
      teams: [g.awayAbbr, g.homeAbbr],
      label: `${(MLB_TEAM_ROSTERS[g.awayAbbr] || {}).label || g.awayAbbr} @ ${(MLB_TEAM_ROSTERS[g.homeAbbr] || {}).label || g.homeAbbr}`,
      time: matchupTimeLabel(g.date),
    }));
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
    }));
  }, [nflSlate]);

  const activeMatchupOptions = sport === "mlb" ? mlbMatchupOptions : sport === "nfl" ? nflMatchupOptions : [];
  const showMatchupDropdown = sport === "mlb" || sport === "nfl";

  const rows = sport === "nba" ? nbaRows : sport === "wnba" ? wnbaRows : sport === "nfl" ? nflRows : mlbRows;
  const categories = sport === "nba" ? NBA_FEED_CATEGORIES : sport === "wnba" ? WNBA_FEED_CATEGORIES : sport === "nfl" ? NFL_FEED_CATEGORIES : MLB_FEED_CATEGORIES;

  const maxRank = feedTeamCount(sport);
  React.useEffect(() => {
    setCategory("All");
    setRankLo(1);
    setRankHi(feedTeamCount(sport));
    setTeamFilter("all");
    setMatchupFilter("all");
  }, [sport]);

  // Option list for the Team dropdown -- built off the full per-sport row
  // set (not the category-filtered one) so switching category never hides
  // a team that's still available under "All".
  const teamOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.team))).sort(), [rows]);

  const categoryRows = category === "All" ? rows : rows.filter((r) => r.category === category);

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
  const filteredRows = categoryRows.filter((r) => {
    const p = r[sampleWindow];
    if (p < oddsLoProb - 1e-9 || p > oddsHiProb + 1e-9) return false;
    if (r.rank < rankLo || r.rank > rankHi) return false;
    if (showMatchupDropdown) {
      if (matchupFilter !== "all") {
        const mo = activeMatchupOptions.find((o) => o.id === matchupFilter);
        if (mo && !mo.teams.includes(r.team)) return false;
      }
    } else if (teamFilter !== "all" && r.team !== teamFilter) {
      return false;
    }
    return true;
  });

  const activeSortMode = FEED_SORT_MODES.find((mo) => mo.id === sortMode);

  // Hit rate (for whichever sample size is selected) is always the primary
  // sort key so the list never looks "scrambled" relative to %. Picking a
  // different Sort By mode doesn't replace that -- it just breaks ties
  // among equal hit rates using that mode's metric, so e.g. "Easiest
  // Matchup" surfaces the easiest matchup among the 100% hits first, then
  // the easiest among the 90% hits, and so on, instead of ignoring % entirely.
  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const aHit = a[sampleWindow], bHit = b[sampleWindow];
      if (bHit !== aHit) return bHit - aHit;
      const av = activeSortMode.metric(a, sampleWindow);
      const bv = activeSortMode.metric(b, sampleWindow);
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return copy;
  }, [filteredRows, sampleWindow, sortMode, sortDir]);

  return (
    <div className="page-shell" style={{ maxWidth: 900, margin: "0 auto", boxSizing: "border-box" }}>
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

      {/* Category filter */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {categories.map((c) => (
          <div key={c} className={`chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
            {c}
          </div>
        ))}
      </div>

      {/* Team/matchup filter -- MLB and NFL show a MATCHUP dropdown (one
           entry per game on the current real slate/week, sorted by kickoff)
           instead of a flat team list, since picking a team only ever
           matters in relation to who they're actually playing. NBA/WNBA
           keep the plain TEAM dropdown. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 20 }}>
        {showMatchupDropdown ? (
          <div style={FEED_FILTER_ROW_STYLE}>
            <span className="oswald" style={FEED_LABEL_STYLE}>MATCHUP</span>
            <select className="select" style={{ width: 260 }} value={matchupFilter} onChange={(e) => setMatchupFilter(e.target.value)}>
              <option value="all">{sport === "mlb" ? "All of today's games" : "All of this week's games"}</option>
              {activeMatchupOptions.map((mo) => (
                <option key={mo.id} value={mo.id}>{mo.label} — {mo.time}</option>
              ))}
            </select>
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
          <span className="oswald" style={FEED_LABEL_STYLE}>SAMPLE SIZE</span>
          <WindowSwitcher value={sampleWindow} onChange={setSampleWindow} />
        </div>
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
            {formatOdds(probToAmericanOdds(oddsSliderProb(oddsMinX)))} to {formatOdds(probToAmericanOdds(oddsSliderProb(oddsMaxX)))}
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

      {/* Feed */}
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
      </div>
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
        {sortedRows.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--dim)", fontSize: 14 }}>
            {sport === "mlb" && mlbLoading ? "Loading live MLB matchup data…" : "No props in this category yet."}
          </div>
        )}
        {sortedRows.map((r, i) => {
          // Filled pill background for a clear favorable/unfavorable read at a
          // glance; "mid" stays neutral so it doesn't compete visually with
          // the amber accent used elsewhere (odds, active toggles) -- but it
          // still needs its own border, since --panel2 is only a shade off
          // from the row's --panel background and was nearly invisible
          // without one.
          const tierBg = r.tier === "soft" ? "var(--green)" : r.tier === "tough" ? "var(--red)" : "var(--neutral-badge-bg)";
          const tierFg = r.tier === "mid" ? "var(--dim-strong)" : "#08131c";
          const tierBorder = r.tier === "mid" ? "1px solid var(--line-strong)" : "none";
          const hrColor = (v) => (v >= 0.55 ? "var(--green)" : v <= 0.45 ? "var(--red)" : "var(--text)");
          const odds = probToAmericanOdds(r[sampleWindow]);
          const pickId = `${sport}-${r.key}`;
          const isAdded = pickIds.has(pickId);
          const addBtn = (
              <div
                className="oswald"
                role="button"
                onClick={() => onTogglePick({ id: pickId, sport, name: r.name, team: r.team, subtitle: r.subtitle, opp: r.opp, odds })}
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
            const chartBtn = r.playerId && (
              <div
                className="oswald cta-btn"
                onClick={() => onOpenProp(sport, r.playerId, r.marketId, { name: r.name, team: r.team })}
                title={`Open ${r.name}'s chart on the ${sport.toUpperCase()} Props page`}
                style={{
                  cursor: "pointer",
                  flexShrink: 0,
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
                  {formatOdds(odds)}
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

            // Narrow screens stack into three rows (name/team, odds+actions,
            // opp rank sits with the name block) instead of squeezing name,
            // odds, and two action buttons into a single row -- that forced
            // the player name to wrap onto 2-3 lines and left the action
            // buttons cramped/overlapping.
            if (isNarrow) {
              return (
                <div
                  key={r.key}
                  className="feed-row"
                  style={{
                    display: "flex", flexDirection: "column", gap: 10, padding: "12px 16px",
                    borderBottom: i === sortedRows.length - 1 ? "none" : "1px solid var(--line)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={r.icon} alt={r.team} width={30} height={30} style={{ objectFit: "contain", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="oswald" style={{ fontSize: 14.5, color: "var(--text)" }}>
                        {r.name} <span style={{ color: "var(--dim)", fontWeight: 400 }}>({r.team})</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--amber)", fontWeight: 600, marginTop: 1 }}>
                        {r.subtitle}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--dim-strong)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>OPP RANK</span>
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
                    <span>vs {r.opp}</span>
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

            return (
              <div
                key={r.key}
                className="feed-row"
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  borderBottom: i === sortedRows.length - 1 ? "none" : "1px solid var(--line)",
                }}
              >
                <img src={r.icon} alt={r.team} width={34} height={34} style={{ objectFit: "contain", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="oswald" style={{ fontSize: 15, color: "var(--text)" }}>
                    {r.name} <span style={{ color: "var(--dim)", fontWeight: 400 }}>({r.team})</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--amber)", fontWeight: 600, marginTop: 1 }}>
                    {r.subtitle}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--dim-strong)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>OPP RANK</span>
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
                    <span>vs {r.opp}</span>
                  </div>
                </div>
                {oddsBlock}
                {addBtn}
                {chartBtn}
              </div>
            );
          })}
      </div>

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
function TeamRosterPanel({ teamLabel, players, activeId, onSelect, headshotSrc, headshotFallback, metaLine, avatarBg, confirmed, bullpen }) {
  const compact = useIsNarrow(1100);
  // Pitchers (pos "SP") get sectioned off from the batting order rather than
  // just tacked onto the end of the list -- MLB is the only sport that
  // populates this today, so NBA/NFL rosters (no "SP" entries) render exactly
  // as before, just inside the same scrollable wrapper.
  const batters = players.filter((p) => p.pos !== "SP");
  const pitchers = players.filter((p) => p.pos === "SP");

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
             player look inconsistent with the rest of the roster. The glow
             box-shadow (a solid-color ring plus a soft blur in the same
             color) is what gives it the brighter, neon-ish pop instead of
             just a flat-colored disc peeking out from behind the photo. */}
        <div style={{
          position: "relative", width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
          background: avatarBg ? avatarBg(p) : "#000",
          boxShadow: avatarBg ? `0 0 0 1px ${avatarBg(p)}, 0 0 6px 1px ${avatarBg(p)}99` : "none",
        }}>
          <img
            src={headshotSrc(p)}
            alt={p.name}
            width={26}
            height={26}
            referrerPolicy="no-referrer"
            style={{ position: "absolute", inset: 2, width: 26, height: 26, borderRadius: "50%", objectFit: "cover", objectPosition: "center top" }}
            onError={(e) => {
              const fallback = headshotFallback && headshotFallback(p);
              if (fallback && e.currentTarget.dataset.fallback !== "1") {
                e.currentTarget.dataset.fallback = "1";
                e.currentTarget.src = fallback;
              }
            }}
          />
        </div>
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

  // Compact reliever row for the bullpen list under the batting order --
  // just name + throws, a quick-glance list rather than the fuller
  // PC/REST/K%/BB%/ERA/WHIP table teamBullpen()'s data also supports.
  const renderBullpenRow = (p) => (
    <div
      key={p.id}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--panel)",
      }}
    >
      <span className="oswald" style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {p.name}
      </span>
      <span className="mono" style={{ fontSize: 10.5, color: "var(--dim)", flexShrink: 0 }}>{p.throws}</span>
    </div>
  );

  // Below the roster-panel breakpoint, MobilePlayerNav (rendered once per
  // page) takes over player-switching entirely -- nothing to render here.
  if (compact) return null;

  return (
    <div className="roster-panel">
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
           lineup (and bullpen below it) so nothing is hidden behind an
           inner scrollbar; .roster-layout already aligns columns to the
           top (align-items: start), so a taller column just grows past its
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
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {batters.map(renderRow)}
        </div>
        {bullpen && bullpen.length > 0 && (
          <>
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em",
              textAlign: "center", margin: "12px 0 6px", paddingTop: 10, borderTop: "1px solid var(--line)",
            }}>
              Bullpen
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {bullpen.map(renderBullpenRow)}
            </div>
          </>
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
function MobilePlayerNav({ teamA, teamB, activeId, onSelect, headshotSrc, headshotFallback, metaLine, avatarBg }) {
  const compact = useIsNarrow(1100);
  const [drawerOpen, setDrawerOpen] = useState(false);
  if (!compact) return null;

  const activeInA = (teamA.players || []).some((p) => p.id === activeId);
  const stripPlayers = (activeInA ? teamA : teamB).players || [];
  // Roster panels can render before an async opposing-roster fetch resolves
  // (see MLBPropsPage's nextGame effect) -- nothing to show yet.
  if (!stripPlayers.length) return null;

  const renderChip = (p) => {
    const active = p.id === activeId;
    return (
      <div
        key={p.id}
        onClick={() => onSelect(p.id)}
        role="button"
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0,
          width: 56, padding: "6px 4px 5px", borderRadius: 10, cursor: "pointer",
          border: `1px solid ${active ? "var(--amber)" : "var(--line)"}`,
          background: active ? "var(--amber-dim)" : "var(--panel)",
        }}
      >
        <div style={{
          position: "relative", width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: avatarBg ? avatarBg(p) : "#000",
          boxShadow: avatarBg ? `0 0 0 1px ${avatarBg(p)}, 0 0 6px 1px ${avatarBg(p)}99` : "none",
        }}>
          <img
            src={headshotSrc(p)}
            alt={p.name}
            width={28}
            height={28}
            referrerPolicy="no-referrer"
            style={{ position: "absolute", inset: 2, width: 28, height: 28, borderRadius: "50%", objectFit: "cover", objectPosition: "center top" }}
            onError={(e) => {
              const fallback = headshotFallback && headshotFallback(p);
              if (fallback && e.currentTarget.dataset.fallback !== "1") {
                e.currentTarget.dataset.fallback = "1";
                e.currentTarget.src = fallback;
              }
            }}
          />
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
          {stripPlayers.map(renderChip)}
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
function LineupDrawer({ open, onClose, teamA, teamB, activeId, onSelect, headshotSrc, headshotFallback, metaLine, avatarBg }) {
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
        <div style={{
          position: "relative", width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: avatarBg ? avatarBg(p) : "#000",
          boxShadow: avatarBg ? `0 0 0 1px ${avatarBg(p)}, 0 0 6px 1px ${avatarBg(p)}99` : "none",
        }}>
          <img
            src={headshotSrc(p)}
            alt={p.name}
            width={28}
            height={28}
            referrerPolicy="no-referrer"
            style={{ position: "absolute", inset: 2, width: 28, height: 28, borderRadius: "50%", objectFit: "cover", objectPosition: "center top" }}
            onError={(e) => {
              const fallback = headshotFallback && headshotFallback(p);
              if (fallback && e.currentTarget.dataset.fallback !== "1") {
                e.currentTarget.dataset.fallback = "1";
                e.currentTarget.src = fallback;
              }
            }}
          />
        </div>
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
            {/* Optional -- only MLB's roster objects carry a `bullpen` array
                 (see MLBPropsPage), so this is a no-op for every other sport. */}
            {team.bullpen && team.bullpen.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "10px 0 6px", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  Bullpen
                </div>
                {team.bullpen.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel2)", marginBottom: 6 }}>
                    <span className="oswald" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{p.name}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--dim)" }}>{p.throws}</span>
                  </div>
                ))}
              </>
            )}
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
function SearchBar({ index, onSelect }) {
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
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
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
function MyPicksPanel({ picks, open, onToggleOpen, onRemove, onClear, sportsbook, onOpenSettings }) {
  const combined = picks.length > 0 ? combineParlayOdds(picks.map((p) => p.odds)) : null;
  const book = SPORTSBOOKS.find((b) => b.id === sportsbook) || SPORTSBOOKS[0];

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
        {picks.length > 0 && (
          <span className="mono" style={{ background: "var(--amber)", color: "var(--accent-on)", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>
            {picks.length}
          </span>
        )}
      </div>

      {open && (
        <div
          onClick={onToggleOpen}
          style={{
            position: "fixed", inset: 0, zIndex: 2090,
            background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          }}
        />
      )}
      {open && (
        <div
          style={{
            position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 2100,
            width: 340, maxWidth: "92vw",
            background: "var(--panel)", borderLeft: "1px solid var(--line)",
            boxShadow: "-6px 0 24px rgba(0,0,0,0.45)",
            display: "flex", flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
            <span className="oswald" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.03em" }}>MY PICKS</span>
            <div onClick={onToggleOpen} role="button" aria-label="Close My Picks panel" style={{ cursor: "pointer", color: "var(--dim)", fontSize: 20, lineHeight: 1 }}>×</div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px" }}>
            {picks.length === 0 ? (
              <div style={{ color: "var(--dim)", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
                Tap the + on any prop in the Prop Feed to add it here.
              </div>
            ) : (
              picks.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="oswald" style={{ fontSize: 13.5, color: "var(--text)" }}>
                      {p.name} <span style={{ color: "var(--dim)", fontWeight: 400 }}>({p.team})</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--amber)", fontWeight: 600, marginTop: 1 }}>{p.subtitle}</div>
                    <div style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 2 }}>vs {p.opp}</div>
                  </div>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", flexShrink: 0 }}>
                    {formatOdds(p.odds)}
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

          {picks.length > 0 && (
            <div style={{ borderTop: "1px solid var(--line)", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="oswald" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--dim)", letterSpacing: "0.03em" }}>
                  {picks.length > 1 ? "COMBINED PARLAY ODDS" : "ODDS"}
                </span>
                <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--amber)" }}>
                  {formatOdds(combined)}
                </span>
              </div>

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
                Clear all
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function SettingsPanel({ open, onToggleOpen, sportsbook, onSportsbookChange, theme, onThemeChange, accentColor, onAccentColorChange }) {
  const book = SPORTSBOOKS.find((b) => b.id === sportsbook) || SPORTSBOOKS[0];

  return (
    <>
      {open && (
        <div
          onClick={onToggleOpen}
          style={{
            position: "fixed", inset: 0, zIndex: 2090,
            background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          }}
        />
      )}
      {open && (
        <div
          style={{
            position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 2100,
            width: 340, maxWidth: "92vw",
            background: "var(--panel)", borderLeft: "1px solid var(--line)",
            boxShadow: "-6px 0 24px rgba(0,0,0,0.45)",
            display: "flex", flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
            <span className="oswald" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.03em" }}>SETTINGS</span>
            <div onClick={onToggleOpen} role="button" aria-label="Close Settings panel" style={{ cursor: "pointer", color: "var(--dim)", fontSize: 20, lineHeight: 1 }}>×</div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
            <div style={{ marginBottom: 20 }}>
              <div className="oswald" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--dim)", letterSpacing: "0.03em", marginBottom: 8 }}>
                THEME
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ id: "dark", label: "Dark" }, { id: "light", label: "Light" }].map((t) => (
                  <div
                    key={t.id}
                    onClick={() => onThemeChange(t.id)}
                    role="button"
                    className={`chip${theme === t.id ? " active" : ""}`}
                    style={{ flex: 1, textAlign: "center" }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div className="oswald" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--dim)", letterSpacing: "0.03em", marginBottom: 8 }}>
                DEFAULT SPORTSBOOK
              </div>
              <select
                className="select"
                value={sportsbook}
                onChange={(e) => onSportsbookChange(e.target.value)}
                style={{ width: "100%" }}
              >
                {SPORTSBOOKS.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
              <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 6, lineHeight: 1.4 }}>
                Used for the "Open in {book.label} →" button in My Picks.
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div className="oswald" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--dim)", letterSpacing: "0.03em", marginBottom: 8 }}>
                ACCENT COLOR
              </div>
              <div style={{ fontSize: 11.5, color: "var(--dim)", marginBottom: 12, lineHeight: 1.4 }}>
                Used for active tabs, buttons, and chart highlights.
              </div>
              <ColorWheel value={accentColor} onChange={onAccentColorChange} />
              {/* Passing null clears --accent-color entirely rather than
                   setting it back to the blue hex -- that's what lets each
                   theme fall back to its own tuned default again (see the
                   accentColor state in PropLedger). */}
              {accentColor && (
                <div
                  role="button"
                  onClick={() => onAccentColorChange(null)}
                  style={{
                    marginTop: 12, textAlign: "center", fontSize: 11.5,
                    color: "var(--dim)", cursor: "pointer", textDecoration: "underline",
                  }}
                >
                  Reset to default
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function PropLedger() {
  const [page, setPage] = useState("feed");
  // Lives here rather than inside PropFeedPage so it survives navigating
  // away to a single-player page and back -- PropFeedPage unmounts on every
  // such trip, which would otherwise reset the sport switcher to its
  // default every time.
  const [feedSport, setFeedSport] = useState(defaultFeedSport);

  const [myPicks, setMyPicks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("propLedgerPicks") || "[]"); } catch { return []; }
  });
  const [sportsbook, setSportsbook] = useState(() => localStorage.getItem("propLedgerSportsbook") || SPORTSBOOKS[0].id);
  const [picksOpen, setPicksOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("propLedgerTheme") || "dark";
    // Set eagerly (not just in the effect below) so the very first paint
    // already uses the saved theme instead of flashing dark-then-light.
    document.documentElement.setAttribute("data-theme", saved);
    return saved;
  });
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("propLedgerTheme", theme);
  }, [theme]);

  // Accent color: --accent-color drives --amber (and everything derived from
  // it) through a CSS fallback -- see the :root blocks in the stylesheet.
  // The property is only set once the user has actually picked a color; until
  // then it stays unset so `var(--accent-color, <default>)` falls through to
  // each theme's own tuned blue, which differ deliberately (dark mode's
  // #2f8cf5 is too light to read on light mode's near-white panels).
  const [accentColor, setAccentColor] = useState(() => {
    const saved = localStorage.getItem("propLedgerAccentColor");
    // Migration: the previous version wrote the default blue into storage on
    // first load whether or not the user ever opened the picker, so a stored
    // value identical to that default means "never chose one" -- treat it as
    // unset so light mode gets its own deeper blue back. Anyone who actually
    // wants blue lands on the same colour via the fallback anyway.
    if (!saved || saved.toLowerCase() === "#2f8cf5") return null;
    return saved;
  });
  React.useEffect(() => {
    if (accentColor) {
      document.documentElement.style.setProperty("--accent-color", accentColor);
      localStorage.setItem("propLedgerAccentColor", accentColor);
    } else {
      document.documentElement.style.removeProperty("--accent-color");
      localStorage.removeItem("propLedgerAccentColor");
    }
  }, [accentColor]);

  // Keeps --accent-on (the label colour for text on a solid accent fill)
  // matched to whatever --amber actually resolved to. Reads the resolved
  // value rather than `accentColor` so it also covers the unset case, where
  // the two themes fall back to different default blues -- hence the theme
  // dependency. Must stay after the two effects above so it observes the
  // data-theme attribute and --accent-color they've already written.
  React.useEffect(() => {
    const root = document.documentElement;
    const resolved = getComputedStyle(root).getPropertyValue("--amber");
    root.style.setProperty("--accent-on", accentForeground(resolved));
  }, [accentColor, theme]);

  React.useEffect(() => {
    localStorage.setItem("propLedgerPicks", JSON.stringify(myPicks));
  }, [myPicks]);
  React.useEffect(() => {
    localStorage.setItem("propLedgerSportsbook", sportsbook);
  }, [sportsbook]);

  const pickIds = useMemo(() => new Set(myPicks.map((p) => p.id)), [myPicks]);
  const togglePick = (pick) => {
    setMyPicks((cur) => (cur.some((p) => p.id === pick.id) ? cur.filter((p) => p.id !== pick.id) : [...cur, pick]));
  };
  const removePick = (id) => setMyPicks((cur) => cur.filter((p) => p.id !== id));
  const clearPicks = () => setMyPicks([]);

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
      fetchNFLPlayerGameLog(espnId).then((games) => {
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

    ALL_WNBA_PLAYERS.forEach((player) => {
      if (!player.espnId) return;
      fetchWNBAPlayerGameLog(player.espnId).then((games) => {
        if (cancelled || !games) return;
        WNBA_REAL_GAME_LOGS[player.id] = games;
        bumpWnbaRefresh();
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
    ALL_MLB_PLAYERS.forEach((p) => entries.push({
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
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div
        onClick={() => setSettingsOpen((v) => !v)}
        role="button"
        aria-label="Toggle Settings panel"
        title="Settings"
        style={{
          position: "fixed", top: 16, right: 16, zIndex: 2000,
          width: 36, height: 36, borderRadius: 8, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid var(--line)", background: "var(--panel2)", color: "var(--dim)", fontSize: 18,
          boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        }}
      >
        ⚙
      </div>
      <div style={{ borderBottom: "1px solid var(--line)", padding: "16px", background: "linear-gradient(to bottom, rgba(255,255,255,0.015), transparent)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <h1 className="oswald" style={{ fontSize: 26, letterSpacing: "0.03em", margin: 0, color: "var(--text)", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ color: "var(--amber)" }}>●</span> PROP LEDGER
          </h1>
          <span style={{ color: "var(--dim)", fontSize: 13 }}>your own hit-rate research, before you place it</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <PageNavDropdown
            page={page}
            setPage={setPage}
            options={[
              { id: "feed", label: "Prop Feed" },
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
          <SearchBar index={searchIndex} onSelect={(r) => goToProp(r.sport, r.playerId, r.market)} />
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
        <MLBPropsPage jumpTo={jumpTo && jumpTo.sport === "mlb" ? jumpTo : null} />
      )}

      {page === "feed" && (
        <PropFeedPage onOpenProp={goToProp} pickIds={pickIds} onTogglePick={togglePick} nflDataVersion={nflDataVersion} wnbaDataVersion={wnbaDataVersion} sport={feedSport} setSport={setFeedSport} />
      )}

      {page === "news" && <NewsPage />}

      <MyPicksPanel
        picks={myPicks}
        open={picksOpen}
        onToggleOpen={() => setPicksOpen((v) => !v)}
        onRemove={removePick}
        onClear={clearPicks}
        sportsbook={sportsbook}
        onOpenSettings={() => { setPicksOpen(false); setSettingsOpen(true); }}
      />
      <SettingsPanel
        open={settingsOpen}
        onToggleOpen={() => setSettingsOpen((v) => !v)}
        sportsbook={sportsbook}
        onSportsbookChange={setSportsbook}
        theme={theme}
        onThemeChange={setTheme}
        accentColor={accentColor}
        onAccentColorChange={setAccentColor}
      />
    </div>
  );
}
