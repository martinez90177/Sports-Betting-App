// MLB player availability, shared by the two surfaces that need it.
//
// This all used to live inside PropLedger.jsx. It moved down here when the
// matchup overview needed a status dot on its probable pitchers: PropLedger
// lazy-imports GamesPage, which imports MatchupPage, so the dependency runs the
// other way and MatchupPage cannot reach back up into it.
//
// The important consequence of "shared module" is `mlbRosterStatusCache` below.
// It is a module-level Map, so every importer sees the same instance: the prop
// feed warms it for tonight's slate, and the matchup screen reads what the feed
// already fetched. Two copies of this file would mean two caches and two
// surfaces quietly disagreeing about whether the same player is hurt.

// MLB Stats API numeric team id -> our abbreviation.
export const MLB_TEAM_ID_ABBR = {
  109: "ARI", 144: "ATL", 110: "BAL", 111: "BOS", 112: "CHC", 145: "CWS", 113: "CIN", 114: "CLE",
  115: "COL", 116: "DET", 117: "HOU", 118: "KC", 108: "LAA", 119: "LAD", 146: "MIA", 158: "MIL",
  142: "MIN", 121: "NYM", 147: "NYY", 133: "ATH", 143: "PHI", 134: "PIT", 135: "SD", 136: "SEA",
  137: "SF", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 120: "WSH",
};

// Reverse of the above -- needed to turn an abbreviation back into the numeric
// team id the Stats API wants.
export const MLB_ABBR_TEAM_ID = Object.fromEntries(
  Object.entries(MLB_TEAM_ID_ABBR).map(([id, abbr]) => [abbr, Number(id)])
);

// Official MLB headshot. Keyed on the same mlbId already used to fetch stats --
// no separate id table to maintain, and it resolves correctly for trades and
// call-ups automatically.
export const mlbHeadshot = (mlbId) => `https://midfield.mlbstatic.com/v1/people/${mlbId}/spots/120`;

// The MLB "day". Rolls over at 3am Eastern rather than midnight local, so a
// west-coast game finishing after midnight still belongs to the day it started.
export function currentMLBDayKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const date = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))));
  if (Number(get("hour")) < 3) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// statsapi status codes -> the short badge shown on a teammate chip. `tone`
// drives both the chip badge fill and the status dot in the with/without
// dropdowns. Anything not listed (chiefly "A", active) gets no badge at all.
export const MLB_STATUS_BADGES = {
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

// 40-man roster status for one team, keyed by mlbId.
//
// Cache shape deliberately mirrors fetchMLBTeamActiveRoster: module Map +
// sessionStorage, keyed on the MLB day so it rolls over with the slate, and a
// failed fetch is never cached so the next call retries.
const MLB_ROSTER_STATUS_TTL_MS = 15 * 60 * 1000;
export const mlbRosterStatusCache = new Map();

export async function fetchMLBTeamRosterStatus(teamId) {
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

// One 40-man status record -> the three values PlayerAvatar accepts, or
// undefined when we do not know. Extracted from mlbStatusOf in PropLedger,
// which had this body inline; both callers now read the same mapping.
//
// On "muted": that tone covers AAA (RM/MIN/OPT), DFA (DES) and
// restricted/suspended/reserve (RES/SU/RE, which the badge itself labels
// "Out"). None of those players is available tonight, so they map to `out`
// rather than to available -- a green dot on a player badged "Out" would be
// plainly wrong. Anywhere a badge is shown alongside, it still names the
// specific reason, so nothing is lost by the dot being coarser.
//
// Undefined for a player who is not on the 40-man at all: that is "unknown",
// not "available", and it must render as no dot rather than a green one.
export function mlbAvailability(statusRecord) {
  if (!statusRecord) return undefined;
  const badge = MLB_STATUS_BADGES[statusRecord.code];
  if (!badge) return "active";                       // code "A"
  return badge.tone === "warn" ? "questionable" : "out";
}
