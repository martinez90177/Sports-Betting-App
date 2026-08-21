// --------------------------------------------------------------------------
// Live rosters — one mechanism, four sports
// --------------------------------------------------------------------------
// Data track, section A. The requirement is that every sport reflects trades
// and free-agent signings. That is not a feature to build: it is a property
// you get for free by fetching rosters instead of hard-coding them, and lose
// entirely by hard-coding them.
//
// This generalises `fetchWNBATeamRoster`, which already did exactly this for
// one sport, rather than adding three more near-identical copies of it beside
// it. Every league is the same two ESPN endpoints with a different slug:
//
//   .../apis/site/v2/sports/{path}/teams/{id}/roster -> athletes
//
// Team ids are a static map rather than a second fetch -- see the note above
// TEAM_ESPN_IDS for why that is a different compromise, and why it is forced.
//
// ---- What this deliberately does not do ----
//
// It never invents a roster. Every failure path returns null, and callers are
// expected to fall back to their hand-written pool *and know that they did* --
// a generated roster presented as a live one is exactly the failure this
// module exists to remove.
//
// It also carries no projections or stat lines. A roster says who is on the
// team; what they do is the game-log track's problem (sections B and C).

const LEAGUE_PATH = {
  nfl: "football/nfl",
  nba: "basketball/nba",
  wnba: "basketball/wnba",
  mlb: "baseball/mlb",
};

// Rosters move on transaction days, not on the hour. A day-keyed cache with a
// TTL inside it means at most one fetch per team per session per day, and a
// same-day redeploy doesn't re-pull thirty teams.
const ROSTER_TTL_MS = 6 * 60 * 60 * 1000;

// The slate day in ET, rolling at 3am -- so a roster fetched at 1am still
// belongs to "last night", the same boundary the MLB and WNBA caches use.
export function rosterDayKey(now = new Date()) {
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  if (et.getHours() < 3) et.setDate(et.getDate() - 1);
  return `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
}

const memory = new Map();

function readCache(key, ttl) {
  const dayKey = rosterDayKey();
  const hit = memory.get(key);
  if (hit && hit.dayKey === dayKey && Date.now() - hit.fetchedAt < ttl) return hit.data;
  try {
    const stored = sessionStorage.getItem(`pp_roster_${key}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.dayKey === dayKey && Date.now() - parsed.fetchedAt < ttl) {
        memory.set(key, parsed);
        return parsed.data;
      }
    }
  } catch {
    // Private mode, quota, or a stored value from an older shape. Falling
    // through to a fetch is always safe; failing to parse a cache is not an
    // error worth surfacing.
  }
  return undefined;
}

function writeCache(key, data) {
  const entry = { dayKey: rosterDayKey(), fetchedAt: Date.now(), data };
  memory.set(key, entry);
  try {
    sessionStorage.setItem(`pp_roster_${key}`, JSON.stringify(entry));
  } catch {
    // In-memory still works for this session.
  }
}

// In-flight de-duplication. Four pages can ask for the same team's roster in
// the same tick on a cold start; without this that is four identical requests.
const inflight = new Map();
function once(key, run) {
  if (inflight.has(key)) return inflight.get(key);
  const p = run().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ---------------------------------------------------------------------------
// Team ids
// ---------------------------------------------------------------------------
// Hard-coded, and that is not the same compromise as hard-coding rosters.
//
// A roster changes every time anyone is traded or signed, which is why it must
// be fetched. A team id changes when a franchise relocates or renames -- twice
// a decade, with a year of notice. The two are not the same problem.
//
// It is also forced: ESPN's league index (`/teams`) does not send CORS headers,
// so a browser cannot read it, while `/teams/{id}/roster` does and can. Fetching
// the index worked from a terminal and failed from the app, which is exactly
// the kind of difference that has to be found by driving the real page.
//
// Generated from that index on 2026-08-21. WNBA keeps its own map in
// PropLedger.jsx (WNBA_TEAM_ESPN_ID), which predates this module.
export const TEAM_ESPN_IDS = {
  nfl: {
    ARI: "22", ATL: "1", BAL: "33", BUF: "2", CAR: "29", CHI: "3", CIN: "4",
    CLE: "5", DAL: "6", DEN: "7", DET: "8", GB: "9", HOU: "34", IND: "11",
    JAX: "30", KC: "12", LAC: "24", LAR: "14", LV: "13", MIA: "15",
    MIN: "16", NE: "17", NO: "18", NYG: "19", NYJ: "20", PHI: "21",
    PIT: "23", SEA: "26", SF: "25", TB: "27", TEN: "10", WSH: "28",
  },
  nba: {
    ATL: "1", BKN: "17", BOS: "2", CHA: "30", CHI: "4", CLE: "5", DAL: "6",
    DEN: "7", DET: "8", GS: "9", HOU: "10", IND: "11", LAC: "12", LAL: "13",
    MEM: "29", MIA: "14", MIL: "15", MIN: "16", NO: "3", NY: "18",
    OKC: "25", ORL: "19", PHI: "20", PHX: "21", POR: "22", SA: "24",
    SAC: "23", TOR: "28", UTAH: "26", WSH: "27",
  },
  mlb: {
    ARI: "29", ATH: "11", ATL: "15", BAL: "1", BOS: "2", CHC: "16",
    CHW: "4", CIN: "17", CLE: "5", COL: "27", DET: "6", HOU: "18", KC: "7",
    LAA: "3", LAD: "19", MIA: "28", MIL: "8", MIN: "9", NYM: "21",
    NYY: "10", PHI: "22", PIT: "23", SD: "25", SEA: "12", SF: "26",
    STL: "24", TB: "30", TEX: "13", TOR: "14", WSH: "20",
  },
};

export function leagueTeams(sport) {
  const map = TEAM_ESPN_IDS[sport];
  if (!map) return null;
  return Object.entries(map).map(([abbr, espnId]) => ({ abbr, espnId }));
}

// Kept async so callers read the same either way if this ever moves back to a
// live index. Never returns null for a league we have a map for.
export async function fetchLeagueTeams(sport) {
  return leagueTeams(sport);
}


// ---------------------------------------------------------------------------
// Rosters
// ---------------------------------------------------------------------------

// ESPN's injury vocabulary -> this app's three availability states. Anything
// unrecognised maps to nothing, which renders as no dot: rule 2 says unknown
// is never grey and never a default to green.
const INJURY_STATUS = {
  out: "out",
  "injury-reserve": "out",
  ir: "out",
  suspension: "out",
  suspended: "out",
  doubtful: "questionable",
  questionable: "questionable",
  "day-to-day": "questionable",
  probable: "questionable",
  active: "active",
};

function statusFor(athlete) {
  const listed = (athlete?.injuries || [])
    .map((inj) => String(inj?.status || inj?.details?.type || "").toLowerCase().trim())
    .map((raw) => INJURY_STATUS[raw])
    .filter(Boolean);
  // An athlete can carry more than one entry; the worst wins, so a player
  // listed both day-to-day and out doesn't read as merely doubtful.
  if (listed.includes("out")) return "out";
  if (listed.includes("questionable")) return "questionable";
  const active = String(athlete?.status?.type || athlete?.status?.name || "").toLowerCase();
  if (active === "active") return "active";
  return undefined;
}

// One team's roster. Returns { players, byId } or null.
//
// `players`: [{ espnId, name, team, pos, jersey, status }]
// `byId`:    { espnId: "out" | "questionable" | "active" }
//
// `slugFor` lets a caller keep the id its hand-written pool already used for a
// player it recognises, so feed pick ids -- and therefore picks already saved
// to a user's device -- survive the switch from hard-coded to live rosters.
// Without it, every open pick would orphan the first time this shipped.
export async function fetchTeamRoster(sport, abbr, teamEspnId, { slugFor } = {}) {
  const path = LEAGUE_PATH[sport];
  if (!path || !teamEspnId) return null;
  const key = `${sport}_${abbr}`;
  const cached = readCache(key, ROSTER_TTL_MS);
  if (cached !== undefined) return applySlugs(cached, slugFor);

  const data = await once(key, async () => {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${teamEspnId}/roster`);
      if (!res.ok) return null;
      const json = await res.json();
      // NFL and MLB group athletes by position ("offense"/"defense", or
      // "pitchers"/"catchers"/…); NBA and WNBA return a flat list. Both shapes
      // arrive under `athletes`, so flatten rather than branching per sport.
      const raw = json?.athletes || [];
      const flat = raw.some((g) => Array.isArray(g?.items))
        ? raw.flatMap((g) => g.items || [])
        : raw;

      const players = [];
      const byId = {};
      flat.forEach((a) => {
        const espnId = a?.id && String(a.id);
        if (!espnId) return;
        const status = statusFor(a);
        if (status) byId[espnId] = status;
        players.push({
          espnId,
          name: a?.displayName || a?.fullName || "",
          team: abbr,
          pos: a?.position?.abbreviation || a?.position?.name || "",
          jersey: a?.jersey ? String(a.jersey) : null,
          status,
        });
      });
      return players.length ? { players, byId } : null;
    } catch {
      return null;
    }
  });

  if (data) writeCache(key, data);
  return applySlugs(data, slugFor);
}

// Applied on read rather than baked into the cache, so the same cached payload
// serves callers that map slugs differently.
function applySlugs(data, slugFor) {
  if (!data || !slugFor) return data;
  return {
    byId: data.byId,
    players: data.players.map((p) => {
      const slug = slugFor(p);
      return slug ? { ...p, id: slug } : p;
    }),
  };
}

// Every team in a league, in one call. Resolves to
// { players, byId, teamsLoaded, teamsTotal } -- the two counts are what lets a
// caller say "28 of 32 teams loaded" instead of silently showing a short
// league, which rule 4 forbids.
export async function fetchLeagueRosters(sport, { slugFor, teams } = {}) {
  const list = teams || (await fetchLeagueTeams(sport));
  if (!list || !list.length) return null;

  const results = await Promise.all(
    list.map((t) => fetchTeamRoster(sport, t.abbr, t.espnId, { slugFor }).catch(() => null))
  );

  const players = [];
  const byId = {};
  let loaded = 0;
  results.forEach((r) => {
    if (!r) return;
    loaded += 1;
    players.push(...r.players);
    Object.assign(byId, r.byId);
  });

  if (!loaded) return null;
  return { players, byId, teamsLoaded: loaded, teamsTotal: list.length };
}
