import { TEAM_ESPN_IDS } from "./rosters.js";

// --------------------------------------------------------------------------
// Who started a given NFL game
// --------------------------------------------------------------------------
// The depth chart (lib/nflDepth.js) says who is starting *now*. The Similar
// Players card needs who started *then* -- a game in January against the team
// on tonight's slate -- because a quarterback who started and left injured
// after two series played that game, and a backup who took a kneel did not.
// Alex, 2026-09-25, of Seattle's opener: Darnold threw for 13 before getting
// hurt and Drew Lock finished it, and both belong; Mason Rudolph's zero
// against New England does not.
//
// ---- The endpoint ----
//
//   sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/{id}
//     /competitions/{id}/competitors/{teamId}/roster
//
// One entry per player dressed, each with `starter` (the 11 and 11 ESPN lists
// as the starting lineups) and `playerId`, the athlete's ESPN id. Checked on
// NE @ SEA 2026-09-10: Darnold starter, Lock not; PIT @ NE 2026-09-20:
// Rodgers starter, Rudolph not.
//
// A finished game's lineup never changes, so answers are kept in localStorage
// with no expiry. A roster with nobody flagged is a game ESPN has not filled
// in yet and is not kept -- "not known" rather than "nobody started".

const CACHE_KEY = "pp_nfl_game_starters_v1";
const CONCURRENCY = 6;

const memory = new Map();
let restored = false;

function restore() {
  if (restored) return;
  restored = true;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) Object.entries(JSON.parse(raw)).forEach(([k, ids]) => memory.set(k, ids));
  } catch {}
}

function persist() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(memory))); } catch {}
}

// ESPN's abbreviation for our own; the ids map is keyed by ESPN's.
const espnAbbr = (abbr) => (abbr === "WAS" ? "WSH" : abbr);

async function fetchStarters(eventId, teamId) {
  const res = await fetch(
    `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${eventId}/competitions/${eventId}/competitors/${teamId}/roster`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const entries = data && data.entries;
  if (!Array.isArray(entries)) return null;
  const ids = entries.filter((e) => e.starter && e.playerId != null).map((e) => String(e.playerId));
  return ids.length ? ids : null;
}

// `games` is [{ eventId, team }] with our abbreviations. Resolves to a Map
// keyed `${eventId}|${team}` -> Set of starting ESPN ids, holding only the
// games it could answer for. A game missing from the map is unknown, and the
// caller has to treat it that way.
export async function fetchNflGameStarters(games) {
  restore();
  const out = new Map();
  const todo = [];
  const seen = new Set();
  (games || []).forEach(({ eventId, team }) => {
    const teamId = TEAM_ESPN_IDS.nfl[espnAbbr(team)];
    const key = `${eventId}|${team}`;
    if (!eventId || !teamId || seen.has(key)) return;
    seen.add(key);
    const cached = memory.get(`${eventId}:${teamId}`);
    if (cached) out.set(key, new Set(cached));
    else todo.push({ eventId, teamId, key });
  });

  let next = 0;
  let added = false;
  const worker = async () => {
    while (next < todo.length) {
      const job = todo[next++];
      try {
        const ids = await fetchStarters(job.eventId, job.teamId);
        if (ids) {
          memory.set(`${job.eventId}:${job.teamId}`, ids);
          out.set(job.key, new Set(ids));
          added = true;
        }
      } catch {}
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
  if (added) persist();
  return out;
}
