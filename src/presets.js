// --------------------------------------------------------------------------
// Saved screens
// --------------------------------------------------------------------------
// A "screen" is a snapshot of every Prop Feed filter, named and saved so it
// can be reapplied later. The snapshot itself is built in PropFeedPage (see
// feedFilters there) -- this module only owns storing, comparing, describing
// and sharing them.
//
// Everything here is device-local, like the rest of the app's state.

const STORAGE_KEY = "propPalacePresets";

export function loadPresets() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((p) => p && typeof p === "object" && p.id) : [];
  } catch {
    return [];
  }
}

export function savePresets(presets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Quota or private mode. The in-memory list still works this session.
  }
}

export function newPresetId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---------- describing a preset ----------

const SPORT_LABEL = { nfl: "NFL", mlb: "MLB", nba: "NBA", wnba: "WNBA" };
const WINDOW_LABEL = { l5: "L5", l10: "L10", l20: "L20", all: "All" };

// The chip summary on a preset card. Only non-default criteria earn a chip --
// a card listing every filter at its default value says nothing about what
// makes that screen different from any other.
export function describePreset(f, { maxRank, marketLabel, sortLabel } = {}) {
  const chips = [];
  if (f.sport) chips.push({ k: "League", v: SPORT_LABEL[f.sport] || f.sport.toUpperCase() });
  if (marketLabel) chips.push({ k: "Prop", v: marketLabel });
  chips.push({ k: "Side", v: f.direction === "under" ? "Under" : "Over" });
  chips.push({ k: "Window", v: WINDOW_LABEL[f.sampleWindow] || f.sampleWindow });
  if (f.oddsMinX !== 4 || f.oddsMaxX !== 96) chips.push({ k: "Odds", v: "Narrowed" });
  if (f.rankLo !== 1 || (maxRank && f.rankHi !== maxRank)) {
    chips.push({ k: "Opp rank", v: `#${f.rankLo}–#${f.rankHi}` });
  }
  if (f.teamFilter && f.teamFilter !== "all") chips.push({ k: "Team", v: f.teamFilter });
  if (f.gameTeams?.length) {
    chips.push({
      k: "Games",
      v: f.gameTeams.length <= 3 ? f.gameTeams.join(", ") : `${f.gameTeams.length} teams`,
    });
  }
  if (sortLabel && f.sortMode !== "matchup") chips.push({ k: "Sort", v: sortLabel });
  return chips;
}

// Which fields count as "the screen". Compared field-by-field so applying a
// preset and then nudging one control shows a Modified badge rather than
// silently pretending the saved screen is still what's on the page.
const COMPARED = [
  "sport", "market", "sampleWindow", "direction", "sortMode", "sortDir",
  "oddsMinX", "oddsMaxX", "rankLo", "rankHi", "teamFilter",
];

export function filtersEqual(a, b) {
  if (!a || !b) return false;
  for (const k of COMPARED) {
    if (a[k] !== b[k]) return false;
  }
  const ta = [...(a.gameTeams || [])].sort();
  const tb = [...(b.gameTeams || [])].sort();
  return ta.length === tb.length && ta.every((v, i) => v === tb[i]);
}

// ---------- share links ----------

// base64url so the payload survives a URL without escaping, and the hash
// rather than the query string: a hash is never sent to the server, so a
// shared screen leaks nothing to Vercel's logs and needs no routing change.
function toBase64Url(s) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(s) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(pad + "=".repeat((4 - (pad.length % 4)) % 4))));
}

export function encodeShareLink(preset) {
  const payload = { n: preset.name, f: preset.filters };
  return `${location.origin}${location.pathname}#screen=${toBase64Url(JSON.stringify(payload))}`;
}

// A share link is untrusted input -- it arrives from whatever someone pasted
// into a group chat. Every field is validated against the values this app
// actually accepts and anything unrecognised is dropped, rather than the
// decoded object being spread into component state.
const SPORTS = new Set(["nfl", "mlb", "nba", "wnba"]);
const WINDOWS = new Set(["l5", "l10", "l20", "all"]);
const DIRECTIONS = new Set(["over", "under"]);
const SORT_DIRS = new Set(["asc", "desc"]);

const clampInt = (v, lo, hi, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

const str = (v, max = 40) => (typeof v === "string" ? v.slice(0, max) : null);

export function decodeShareLink(hash) {
  const m = /(?:^|[#&])screen=([A-Za-z0-9\-_]+)/.exec(hash || "");
  if (!m) return null;
  let payload;
  try {
    payload = JSON.parse(fromBase64Url(m[1]));
  } catch {
    return null;
  }
  const f = payload?.f;
  if (!f || typeof f !== "object" || !SPORTS.has(f.sport)) return null;

  return {
    name: str(payload.n) || "Shared screen",
    filters: {
      sport: f.sport,
      market: str(f.market, 60),
      sampleWindow: WINDOWS.has(f.sampleWindow) ? f.sampleWindow : "l10",
      direction: DIRECTIONS.has(f.direction) ? f.direction : "over",
      sortMode: str(f.sortMode, 40) || "matchup",
      sortDir: SORT_DIRS.has(f.sortDir) ? f.sortDir : "desc",
      oddsMinX: clampInt(f.oddsMinX, 4, 96, 4),
      oddsMaxX: clampInt(f.oddsMaxX, 4, 96, 96),
      rankLo: clampInt(f.rankLo, 1, 40, 1),
      rankHi: clampInt(f.rankHi, 1, 40, 40),
      teamFilter: str(f.teamFilter, 8) || "all",
      gameTeams: Array.isArray(f.gameTeams)
        ? f.gameTeams.map((t) => str(t, 8)).filter(Boolean).slice(0, 40)
        : [],
    },
  };
}
