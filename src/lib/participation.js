import { useEffect, useMemo, useRef, useState } from "react";
import { TEAM_ESPN_IDS } from "./rosters.js";

// --------------------------------------------------------------------------
// Who actually played in a finished game
// --------------------------------------------------------------------------
// This is the record behind the With/Without teammate filter. The question it
// answers is narrow and entirely factual:
//
//   "In this specific past game, did this specific player appear?"
//
// which is what turns "Davante Adams averages 5.1 catches" into "Davante Adams
// in the six games Puka Nacua missed" -- a different, much smaller, and much
// more useful sample. MLB has had this since the boxscore-lineup fetcher went
// in; the three ESPN leagues had nothing, because their game-log parsers read
// `ev.eventId` to group stats and then dropped it, leaving no key to join a
// teammate's participation against. They now keep it, and this module turns it
// into a set of ids per game.
//
// ---- Why two mechanisms ----
//
// NBA and WNBA use `summary?event=` -> `boxscore.players[].statistics[]
// .athletes[]`. A basketball boxscore lists the whole active list including
// players who dressed and did not play, flagged `didNotPlay: true` with a
// reason, so one request answers for both teams exactly.
//
// NFL cannot use that. An NFL boxscore lists only players who *recorded a
// statistic* -- 71 names across both teams in a game where 128 dressed. A
// receiver who played thirty snaps and was never targeted is simply absent
// from it, and would be counted as a game he missed. That is precisely the
// number this feature exists to get right, so the NFL reads the game roster
// from the core API instead:
//
//   sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/{id}
//     /competitions/{id}/competitors/{teamId}/roster
//
// which is the dressed list with a per-player `didNotPlay` flag. Verified
// CORS-open (`access-control-allow-origin: *`) and serving 2024 games, so a
// two-season split works. It answers for one team per request, which is the
// team we want anyway -- teammates are on the player's own side.
//
// ---- What a caller gets ----
//
// A Set of espnId strings, or `null` when the request failed. Null is not an
// empty set: `absenceSplit` counts a null as "unchecked" and leaves that game
// out of both halves rather than silently scoring it as an absence. A finished
// game's participation cannot change, so everything here is cached with no TTL.

const SITE_PATH = {
  nba: "basketball/nba",
  wnba: "basketball/wnba",
  nfl: "football/nfl",
};

// Where this app's abbreviation and ESPN's disagree. `nflOurAbbr` in
// PropLedger converts the other way for the same pair; the whole Washington
// roster once fell through four maps for want of it.
const TO_ESPN_ABBR = { nfl: { WAS: "WSH" } };

export function espnTeamId(sport, abbr) {
  if (!abbr) return null;
  const fixed = (TO_ESPN_ABBR[sport] || {})[abbr] || abbr;
  return (TEAM_ESPN_IDS[sport] || {})[fixed] || null;
}

// A finished game is immutable, so: in-memory Map + sessionStorage, no TTL.
// Sets do not survive JSON, so the stored form is an array.
const memory = new Map();

function readCache(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const stored = sessionStorage.getItem(`pp_part_v1_${key}`);
    if (stored) {
      const ids = new Set(JSON.parse(stored));
      memory.set(key, ids);
      return ids;
    }
  } catch {}
  return undefined;
}

function writeCache(key, ids) {
  memory.set(key, ids);
  try { sessionStorage.setItem(`pp_part_v1_${key}`, JSON.stringify([...ids])); } catch {}
}

// One in-flight request per key, so eight components asking about the same
// game on the same tick make one request.
const inFlight = new Map();

async function fetchBasketball(sport, eventId) {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${SITE_PATH[sport]}/summary?event=${eventId}`);
  if (!res.ok) return null;
  const json = await res.json();
  const teams = json?.boxscore?.players;
  // No boxscore at all means the game has not been played or ESPN has not
  // filed one. That is not "nobody played" -- it is unknown, and returns null.
  if (!Array.isArray(teams) || !teams.length) return null;
  const ids = new Set();
  teams.forEach((t) => {
    (t?.statistics || []).forEach((st) => {
      (st?.athletes || []).forEach((a) => {
        if (a?.didNotPlay === true) return;
        const id = a?.athlete?.id;
        if (id) ids.add(String(id));
      });
    });
  });
  return ids.size ? ids : null;
}

async function fetchNFLRoster(eventId, teamId) {
  // The competition id equals the event id for every NFL game ESPN serves.
  const res = await fetch(
    `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${eventId}` +
    `/competitions/${eventId}/competitors/${teamId}/roster?limit=200`
  );
  if (!res.ok) return null;
  const json = await res.json();
  const entries = json?.entries;
  if (!Array.isArray(entries) || !entries.length) return null;
  const ids = new Set();
  entries.forEach((e) => {
    if (e?.didNotPlay === true) return;
    if (e?.playerId != null) ids.add(String(e.playerId));
  });
  return ids.size ? ids : null;
}

// sport + game -> the cache key and the request. NFL is per-team, so its key
// carries the team; basketball answers for both sides at once and does not.
function keyFor(sport, eventId, teamAbbr) {
  return sport === "nfl" ? `${sport}_${eventId}_${teamAbbr || "?"}` : `${sport}_${eventId}`;
}

export async function fetchGameParticipants(sport, eventId, teamAbbr) {
  if (!eventId || !SITE_PATH[sport]) return null;
  const key = keyFor(sport, eventId, teamAbbr);

  const cached = readCache(key);
  if (cached !== undefined) return cached;
  if (inFlight.has(key)) return inFlight.get(key);

  const run = (async () => {
    let ids = null;
    try {
      if (sport === "nfl") {
        const teamId = espnTeamId("nfl", teamAbbr);
        // Without the team there is no request to make. Returning null rather
        // than guessing a side keeps the game "unchecked".
        ids = teamId ? await fetchNFLRoster(eventId, teamId) : null;
      } else {
        ids = await fetchBasketball(sport, eventId);
      }
    } catch {
      ids = null;
    }
    // A failure is not cached: the next visit should retry rather than inherit
    // a network blip as a permanent gap in the record.
    if (ids) writeCache(key, ids);
    inFlight.delete(key);
    return ids;
  })();

  inFlight.set(key, run);
  return run;
}

// Bounded concurrency. A player with two seasons of NBA logs is 160 games, and
// firing 160 parallel requests at ESPN is how a browser starts dropping them.
const POOL = 8;
async function runPooled(items, worker) {
  const out = [];
  let i = 0;
  const lanes = Array.from({ length: Math.min(POOL, items.length) }, async () => {
    while (i < items.length) {
      const mine = i++;
      out[mine] = await worker(items[mine]);
    }
  });
  await Promise.all(lanes);
  return out;
}

// --------------------------------------------------------------------------
// The hook the player pages use
// --------------------------------------------------------------------------
// Two tiers, the shape MLB's teammate filter already proved:
//
//   `enabled` alone -- the panel is open and the per-teammate differentials
//   need numbers, so the most recent `recent` games are enough.
//
//   `exact` -- a chip is actually filtering the chart, so every game in view
//   has to be answered before the filter may be applied. `ready` is what gates
//   that; without it the chart collapses to a handful of bars and grows back
//   as requests land, which reads as data rather than as loading.
//
// Returns `byEvent`: eventId -> Set of espnId strings, or null where the
// request failed. A game absent from the map has not been asked about yet.
export function useParticipation(sport, games, { enabled = false, exact = false, recent = 40 } = {}) {
  const [byEvent, setByEvent] = useState({});
  const [loading, setLoading] = useState(false);
  const requested = useRef(new Set());

  const wanted = useMemo(() => {
    if (!enabled || !SITE_PATH[sport]) return [];
    const list = (games || [])
      .filter((g) => g && g.eventId)
      .map((g) => ({ eventId: String(g.eventId), team: g.team || null }));
    return exact ? list : list.slice(-recent);
  }, [sport, games, enabled, exact, recent]);

  // The identity of the request set, not the array. `wanted` is rebuilt on
  // every render that touches `games`; without this the effect below would
  // re-run forever.
  const wantedKey = useMemo(
    () => wanted.map((w) => keyFor(sport, w.eventId, w.team)).join(","),
    [wanted, sport]
  );

  // A different player is a different set of games. Drop what was answered for
  // the last one so `ready` cannot be satisfied by his log.
  useEffect(() => {
    requested.current = new Set();
    setByEvent({});
  }, [sport]);

  useEffect(() => {
    const todo = wanted.filter((w) => !requested.current.has(keyFor(sport, w.eventId, w.team)));
    if (!todo.length) return undefined;
    todo.forEach((w) => requested.current.add(keyFor(sport, w.eventId, w.team)));

    let cancelled = false;
    setLoading(true);
    runPooled(todo, (w) =>
      fetchGameParticipants(sport, w.eventId, w.team).then((ids) => [w.eventId, ids])
    )
      .then((pairs) => {
        if (cancelled) return;
        setByEvent((prev) => {
          const next = { ...prev };
          pairs.forEach(([id, ids]) => { next[id] = ids; });
          return next;
        });
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, sport]);

  const ready = useMemo(
    () => !exact || wanted.every((w) => byEvent[w.eventId] !== undefined),
    [exact, wanted, byEvent]
  );

  return { byEvent, ready, loading };
}

// Did `espnId` play in `game`? true / false / null for "we cannot tell".
//
// Null is load-bearing everywhere this is used. A game whose record failed to
// load is not a game the teammate missed, and counting it as one would inflate
// the without-side with exactly the games the reader is trying to isolate.
export function playedIn(byEvent, game, espnId) {
  if (!game || !game.eventId || !espnId) return null;
  const ids = byEvent[String(game.eventId)];
  if (ids === undefined || ids === null) return null;
  return ids.has(String(espnId));
}
