// Team colours and the player-avatar background, shared by every screen that
// names a player.
//
// The four brand-colour maps, neonizeColor and teamAvatarBackground moved here
// from PropLedger.jsx so PlayerAvatar can reach them without importing an
// 824KB module. The logic is unchanged from what PropLedger produced before
// the move, so no existing avatar shifts colour.
//
// Abbreviations collide across sports (LAC, PHI, CHI, ATL and MIN each name
// two different franchises), so there is deliberately no merged lookup:
// callers pass the map for their sport, or a `sport` key that selects it.

// ---------- NBA ----------
export const NBA_TEAM_COLORS = {
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

// ---------- NFL ----------
export const NFL_TEAM_COLORS = {
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

// ---------- WNBA ----------
export const WNBA_TEAM_COLORS = {
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

// ---------- MLB ----------
export const MLB_TEAM_COLORS = {
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

// Subtle team-tinted background for a player avatar's ring: a diagonal blend
// of the team's two brand colors, darkened with a black overlay so it always
// reads as a muted frame rather than a bright disc competing with the
// headshot. Shared by every page's avatar (NBA/NFL/MLB) -- each just passes
// its own team-color map. Falls back to a neutral dark gradient for any
// team missing from that map.
export const AVATAR_FALLBACK_COLORS = { primary: "#282c31", secondary: "#15171b" };

// Pushes a hex color's own saturation/lightness toward a vivid "neon" range
// instead of relying on an outer glow -- so the ring itself reads as a
// brighter, punchier version of the team color rather than the muted brand
// hex (which is often designed to work on jerseys/logos, not glow on a
// screen). Grays/near-neutrals (low saturation) are left alone so team
// colors like the Spurs' silver don't get tinted a random hue.
export function neonizeColor(hex) {
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

export const teamAvatarBackground = (colorMap, teamAbbr) => {
  const c = colorMap[teamAbbr] || AVATAR_FALLBACK_COLORS;
  return `linear-gradient(135deg, rgba(0,0,0,var(--avatar-ring-shade1, 0.2)), rgba(0,0,0,var(--avatar-ring-shade2, 0.45))), linear-gradient(135deg, ${neonizeColor(c.primary)} 0%, ${neonizeColor(c.secondary)} 100%)`;
};

// sport key -> that sport's map, for callers that carry a sport rather than a
// map (the prop feed, and the redesign components that take a `sport` prop).
export const TEAM_COLORS_BY_SPORT = {
  nba: NBA_TEAM_COLORS,
  nfl: NFL_TEAM_COLORS,
  wnba: WNBA_TEAM_COLORS,
  mlb: MLB_TEAM_COLORS,
};

// Resolve a background from either an explicit map or a sport key. An unknown
// sport falls through to the neutral AVATAR_FALLBACK_COLORS gradient rather
// than guessing a league.
export function avatarBackgroundFor({ colorMap, sport, team }) {
  return teamAvatarBackground(colorMap || TEAM_COLORS_BY_SPORT[sport] || {}, team);
}

// Availability styling for the status dot. Only rendered when a caller passes
// a real status -- see the note in PlayerAvatar.jsx about which sports have
// player-level availability data.
export const STATUS = {
  active: { label: "ACTIVE", dot: "var(--status-available, #3ecf8e)", border: "#234a3a" },
  questionable: { label: "QUEST", dot: "var(--status-questionable, #e8b13a)", border: "#4a3d1c" },
  out: { label: "OUT", dot: "var(--status-out, #ef5b5b)", border: "#4a2323" },
};

// ---------------------------------------------------------------------------
// Muted team tones, for the places that name a team rather than score it.
//
// The v2 handoff hand-writes a small map of desaturated hexes (SEA #3f8f6a,
// ARI #a5555f, MIN #7565a8 ...) instead of using brand colour, and the reason
// is meaning rather than taste: raw brand reds like Boston's #bd3039 or
// Cincinnati's #c6011f land close enough to --neg #ef5b5b to be read as "fell
// short", and a bright brand green reads as "cleared". Naming an opponent is
// not a claim about an outcome.
//
// Measured off that map, its entries sit around S 0.27-0.39 and L 0.40-0.55.
// This pins every team to the middle of that band and keeps only the hue, so
// it covers all four leagues rather than the handful the mocks happened to
// draw, and nothing it produces can collide with --pos (S 0.60 / L 0.53) or
// --neg (S 0.80 / L 0.65).
const MUTED_S = 0.32;
const MUTED_L = 0.48;
// Below this a brand colour is a grey/silver/black rather than a hue -- the
// Yankees' #C4CED4, the White Sox's #27251F. Forcing those to MUTED_S would
// invent a colour the team does not have, so they render as a neutral slate.
//
// The test is *chroma* (max-min of the raw channels), not HSL saturation.
// Saturation is unreliable at the extremes of lightness: the Yankees' silver
// scores S 0.157 -- above any sane threshold -- purely because it sits at
// L 0.80, and would be treated as a blue. Its chroma is 0.06, which is what
// the eye actually reports. (The same trap produced a false "your accent
// clashes" warning in Settings; see the sat/chroma pair guarding paletteWarning.)
const ACHROMATIC_C = 0.12;
const NEUTRAL_S = 0.08;

export function hslOfHex(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l, c: 0 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let deg;
  if (max === r) deg = ((g - b) / d) % 6;
  else if (max === g) deg = (b - r) / d + 2;
  else deg = (r - g) / d + 4;
  deg *= 60;
  return { h: deg < 0 ? deg + 360 : deg, s, l, c: d };
}

// Shortest distance between two hues, in degrees (0-180).
export function hueGap(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function toneFrom(hsl, alpha) {
  if (!hsl) return alpha == null ? "var(--dim)" : "transparent";
  const s = hsl.c < ACHROMATIC_C ? NEUTRAL_S : MUTED_S;
  const base = `${Math.round(hsl.h)} ${Math.round(s * 100)}% ${Math.round(MUTED_L * 100)}%`;
  return alpha == null ? `hsl(${base})` : `hsl(${base} / ${alpha})`;
}

function brand(sport, abbr) {
  return (TEAM_COLORS_BY_SPORT[sport] || {})[abbr] || null;
}

// One team, on its own -- the chart axis, where every column is a different
// opponent and there is no pair to confuse.
export function mutedTeamColor(sport, abbr, alpha) {
  const c = brand(sport, abbr);
  return toneFrom(hslOfHex(c ? c.primary : null), alpha);
}

// Two teams shown side by side -- a matchup band's halves, a game card's away
// and home crests. Keeping only the hue means two same-hue clubs collapse to
// the same tone: Toronto's #134A8E and the Yankees' #0C2340 are both hue 214,
// so a TOR @ NYY band drew two identical halves and the tint stopped saying
// anything.
//
// When the two primaries land within HUE_CLASH, the *home* side falls back to
// its secondary. Home rather than away on purpose: a club then looks the same
// in every away fixture and only shifts in the one place it would otherwise
// clash, instead of changing colour depending on who it is visiting.
//
// A secondary that is itself a grey (the Yankees' silver) is still used -- it
// renders as a neutral slate, which is what that team's second colour actually
// is, and reads as clearly distinct from the away side's hue.
const HUE_CLASH = 30;

export function matchupTones(sport, awayAbbr, homeAbbr, alpha) {
  const awayHsl = hslOfHex((brand(sport, awayAbbr) || {}).primary);
  const homeBrand = brand(sport, homeAbbr) || {};
  let homeHsl = hslOfHex(homeBrand.primary);

  const clashes = (a, b) => a && b && a.c >= ACHROMATIC_C && b.c >= ACHROMATIC_C
    && hueGap(a.h, b.h) < HUE_CLASH;

  if (clashes(awayHsl, homeHsl)) {
    const alt = hslOfHex(homeBrand.secondary);
    // The secondary only helps if it actually separates the two. A club whose
    // second colour is another shade of the same hue gains nothing by
    // swapping -- Toronto's #134A8E against the Yankees' #0C2340 is hue 214
    // twice over. Where it does not separate them, the home side goes neutral,
    // which always reads as distinct from a hue.
    homeHsl = alt && !clashes(awayHsl, alt) ? alt : { h: homeHsl.h, s: 0, l: homeHsl.l, c: 0 };
  }

  return { away: toneFrom(awayHsl, alpha), home: toneFrom(homeHsl, alpha) };
}
