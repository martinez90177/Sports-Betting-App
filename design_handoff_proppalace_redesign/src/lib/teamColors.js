// Team colour pairs + avatar background, per the redesign.
// Primary holds flat to 40% then ramps into a darkened secondary, which reads
// as roughly a 65/35 split at avatar sizes.

const TEAMS = {
  ARI: ["#97233F", "#FFB612"], ATL: ["#A71930", "#000000"], BAL: ["#241773", "#9E7C0C"],
  BUF: ["#00338D", "#C60C30"], CAR: ["#0085CA", "#101820"], CHI: ["#0B162A", "#C83803"],
  CIN: ["#1A1A1A", "#FB4F14"], CLE: ["#311D00", "#FF3C00"], DAL: ["#003594", "#869397"],
  DEN: ["#FB4F14", "#002244"], DET: ["#0076B6", "#B0B7BC"], GB:  ["#203731", "#FFB612"],
  HOU: ["#03202F", "#A71930"], IND: ["#002C5F", "#A2AAAD"], JAX: ["#101820", "#D7A22A"],
  KC:  ["#E31837", "#FFB81C"], LV:  ["#000000", "#A5ACAF"], LAC: ["#0080C6", "#FFC20E"],
  LAR: ["#003594", "#FFA300"], MIA: ["#008E97", "#FC4C02"], MIN: ["#4F2683", "#FFC62F"],
  NE:  ["#002244", "#C60C30"], NO:  ["#101820", "#D3BC8D"], NYG: ["#0B2265", "#A71930"],
  NYJ: ["#125740", "#000000"], PHI: ["#004C54", "#A5ACAF"], PIT: ["#101820", "#FFB612"],
  SF:  ["#AA0000", "#B3995D"], SEA: ["#002244", "#69BE28"], TB:  ["#D50A0A", "#34302B"],
  TEN: ["#0C2340", "#4B92DB"], WSH: ["#5A1414", "#FFB612"],
};

// Darken toward black by `amount` (0-1). Mirrors the intent of the
// --avatar-ring-shade* variables already in index.css.
function shade(hex, amount = 0.35) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function teamPair(abbr) {
  return TEAMS[String(abbr || "").toUpperCase()] || ["#1c2027", "#3b5bdb"];
}

export function teamAvatarBackground(abbr) {
  const [primary, secondary] = teamPair(abbr);
  return `linear-gradient(135deg, ${primary} 0%, ${primary} 40%, ${shade(secondary, 0.35)} 100%)`;
}

// ESPN headshot. Falls back to the team gradient when id is missing or 404s.
export function nflHeadshot(espnId) {
  return espnId ? `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png` : null;
}

export const STATUS = {
  active: { label: "ACTIVE", dot: "var(--pos, #3ecf8e)", border: "#234a3a" },
  questionable: { label: "QUEST", dot: "var(--amber, #e8b13a)", border: "#4a3d1c" },
  out: { label: "OUT", dot: "var(--neg, #ef5b5b)", border: "#4a2323" },
};
