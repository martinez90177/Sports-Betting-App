import { TEAM_ESPN_IDS, rosterDayKey } from "./rosters.js";

// --------------------------------------------------------------------------
// Who is actually starting — NFL depth charts
// --------------------------------------------------------------------------
// Alex, 2026-09-07: *"only have prop feed players appear if they are starting.
// for example, get brosmer's bum ass off my prop feed."* Max Brosmer is
// Minnesota's third quarterback. Nobody prices his passing yards, and a feed
// that ranks him beside starters is ranking something that will not be played.
//
// The feed already had a participation filter and it could not see this. It
// worked backwards from the logs it happened to hold: a team's game count was
// taken as *the largest log among that team's own rows*, so on a team whose
// starters are thin in the pool the bar sank to the backup's own total and he
// cleared it. Self-referential, and it fails exactly where it is needed.
//
// A depth chart is the direct statement, published by the provider, so this
// asks for it instead of inferring it.
//
// ---- The endpoint ----
//
//   sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/{season}
//     /teams/{espnId}/depthcharts
//
// Three groups per team -- a defensive formation, Special Teams, and an
// offensive formation whose *name* is the thing that makes this readable:
// "3WR 1TE". That is the count of each position on the field, so it says how
// far down each slot the starters run. Checked on all 32 teams for 2026: every
// one answers, and every one names its offence "3WR 1TE".
//
// ---- What counts as starting ----
//
// Rank 1 at every slot, except that the slots the formation names take as many
// as it names: three wide receivers, one tight end. Rank 1 alone would drop
// WR2 and WR3, who are on the field for most snaps and carry real props.
//
// The number is parsed from the group's own name rather than hardcoded, so a
// team listed "2WR 2TE" is read as what it says.
//
// ---- What it never does ----
//
// It never guesses. A team whose chart cannot be read is absent from the
// answer, and the caller is told how many teams loaded so it can leave that
// team's players alone rather than silently emptying a roster. Dropping a
// player is a claim about him; failing to fetch is a claim about us.

const DEPTH_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_KEY = "pp_nfl_depth_v1";

let memory = null;

function readCache() {
  const dayKey = rosterDayKey();
  if (memory && memory.dayKey === dayKey && Date.now() - memory.fetchedAt < DEPTH_TTL_MS) return memory.data;
  try {
    const stored = sessionStorage.getItem(CACHE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed.dayKey !== dayKey || Date.now() - parsed.fetchedAt >= DEPTH_TTL_MS) return null;
    memory = parsed;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  const rec = { dayKey: rosterDayKey(), fetchedAt: Date.now(), data };
  memory = rec;
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(rec)); } catch {}
}

// "3WR 1TE" -> how deep this slot's starters run. Anything the name does not
// mention starts one player.
function startersAt(slot, groupName) {
  const name = String(groupName || "");
  const asked = (token) => {
    const m = new RegExp(`(\\d+)\\s*${token}\\b`, "i").exec(name);
    return m ? Number(m[1]) : null;
  };
  if (slot === "wr") return asked("WR") ?? 3;
  if (slot === "te") return asked("TE") ?? 1;
  if (slot === "rb") return asked("RB") ?? 1;
  return 1;
}

// The athlete id off the `$ref` URL, which is the only place it appears.
function refId(athlete) {
  const ref = athlete && athlete.athlete && athlete.athlete.$ref;
  if (!ref) return null;
  const tail = String(ref).split("/").pop();
  const id = String(tail).split("?")[0];
  return /^\d+$/.test(id) ? id : null;
}

async function fetchTeamStarters(espnTeamId, season) {
  const res = await fetch(
    `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${season}/teams/${espnTeamId}/depthcharts`
  );
  const data = await res.json();
  const items = data && data.items;
  if (!Array.isArray(items) || !items.length) return null;
  const ids = [];
  items.forEach((group) => {
    Object.entries(group.positions || {}).forEach(([slot, pos]) => {
      const depth = startersAt(slot, group.name);
      (pos.athletes || []).forEach((a) => {
        if (Number(a.rank) > depth) return;
        const id = refId(a);
        if (id) ids.push(id);
      });
    });
  });
  return ids.length ? ids : null;
}

// Every starting ESPN id in the league, plus the coverage behind it.
//
// `teamsLoaded < teamsTotal` is not a footnote: the caller must not filter a
// team it could not read, and it has no other way to know which those were --
// so `byTeam` carries the teams that answered, and a player whose team is not
// in it is left alone.
export async function fetchNflStarters(season) {
  const cached = readCache();
  if (cached) return { ...cached, starters: new Set(cached.ids), teams: new Set(cached.teams) };

  const map = TEAM_ESPN_IDS.nfl || {};
  const entries = Object.entries(map);
  const results = await Promise.all(
    entries.map(async ([abbr, id]) => {
      try {
        const ids = await fetchTeamStarters(id, season);
        return ids ? { abbr, ids } : null;
      } catch {
        return null;
      }
    })
  );
  const good = results.filter(Boolean);
  if (!good.length) return null;

  const data = {
    ids: good.flatMap((r) => r.ids),
    teams: good.map((r) => r.abbr),
    teamsLoaded: good.length,
    teamsTotal: entries.length,
  };
  writeCache(data);
  return { ...data, starters: new Set(data.ids), teams: new Set(data.teams) };
}
