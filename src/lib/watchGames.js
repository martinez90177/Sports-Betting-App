import React from "react";
import { fetchTeamGames } from "./gamesData.js";

// Which game a watched prop is for, and clearing it once that game is over.
//
// A prop is a line on one game: Rhyne Howard's points against Chicago on
// Saturday are not her points against New York on Monday, even when the line
// happens to match. The watch list used to store no game at all, so a prop
// watched for one matchup sat on the list indefinitely -- Alex, 2026-09-21,
// about a week-old Rhyne Howard watch: "once the game concludes that pick
// should disappear", and the list should say which game each prop is from.
//
// So every watch now carries `game: { opp, home, startsAt }`, stamped by the
// page it was watched on, and leaves the list when that game goes final.

// A game this far past its start is over whether or not its final could be
// read -- no game in any of the four sports runs a day. Only a backstop for
// when the schedule cannot be fetched; the normal exit is the provider saying
// FINAL.
const WATCH_BACKSTOP_MS = 24 * 60 * 60 * 1000;
// How far before a watch was added its game may have started and still be the
// game it was watched for -- someone watching a prop at halftime.
const WATCH_IN_PROGRESS_MS = 4 * 60 * 60 * 1000;
const WATCH_RECHECK_MS = 5 * 60 * 1000;

// The game a player page is showing, in the shape a watch stores.
//
// Prefers the slate row (a real start time, both sides named); falls back to
// the sport's own next-game lookup. A game the slate already calls final is
// not stamped: watching it would clear itself on the next check, so the item
// is left to find its next game instead (see resolveGame).
export function watchGameFromPage(team, slateGame, next) {
  if (slateGame && slateGame.startsAt && !slateGame.isFinal) {
    const home = slateGame.home?.abbr === team;
    const opp = home ? slateGame.away?.abbr : slateGame.home?.abbr;
    if (opp && (home || slateGame.away?.abbr === team)) return { opp, home, startsAt: slateGame.startsAt };
  }
  const t = next ? Date.parse(next.date) : NaN;
  if (next && next.opp && Number.isFinite(t) && Date.now() - t < WATCH_IN_PROGRESS_MS) {
    return { opp: next.opp, home: !!next.home, startsAt: next.date };
  }
  return null;
}

// "ATL vs CHI · 9/19 · 7:00 PM", read in the viewer's own time zone. `@` for
// a road game, the way the rest of the app writes fixtures. No weekday: with
// it the line overran the 330px panel and lost the time.
export function watchGameLabel(w) {
  const g = w && w.game;
  if (!g || !g.opp) return null;
  const d = new Date(g.startsAt);
  const when = Number.isFinite(d.getTime())
    ? `${d.getMonth() + 1}/${d.getDate()} · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : null;
  return [`${w.team ? `${w.team} ` : ""}${g.home ? "vs" : "@"} ${g.opp}`, when].filter(Boolean).join(" · ");
}

// "@ NY 9/21" -- the same game, short enough for a chip.
export function watchGameShort(w) {
  const g = w && w.game;
  if (!g || !g.opp) return null;
  const d = new Date(g.startsAt);
  const day = Number.isFinite(d.getTime()) ? ` ${d.getMonth() + 1}/${d.getDate()}` : "";
  return `${g.home ? "vs" : "@"} ${g.opp}${day}`;
}

// The first game on the schedule that had not finished when the prop was
// watched. For watches saved before games were stamped, and for any page that
// had no game to stamp (a bye week, a slate that had not loaded).
function resolveGame(rows, addedAt) {
  const from = (Number(addedAt) || Date.now()) - WATCH_IN_PROGRESS_MS;
  return rows.find((r) => Date.parse(r.startsAt) >= from) || null;
}

// The stamped game on a fetched schedule. Matched on opponent and start rather
// than start alone, so an MLB doubleheader's two games stay two games; a start
// that moved by up to a day (a postponement, a flexed kickoff) still matches.
function findGame(rows, game) {
  const t = Date.parse(game.startsAt);
  let best = null;
  let bestGap = Infinity;
  rows.forEach((r) => {
    if (r.opp !== game.opp) return;
    const gap = Math.abs(Date.parse(r.startsAt) - t);
    if (gap <= WATCH_BACKSTOP_MS && gap < bestGap) { best = r; bestGap = gap; }
  });
  return best;
}

// One pass over the list: the games to stamp and the watches whose game is
// over. A watch whose game has not started costs no request at all, and a
// failed fetch decides nothing -- the item stays and the next pass tries again.
async function checkWatches(watched) {
  const stamp = new Map();
  const done = new Set();
  const now = Date.now();
  for (const w of watched) {
    if (!w || !w.id || !w.sport || !w.team) continue;
    let game = w.game || null;
    if (!game) {
      // A watch saved before games were stamped. Its game is the first one the
      // team had not finished when it was added.
      const rows = await fetchTeamGames(w.sport, w.team, w.addedAt || now);
      const hit = rows && resolveGame(rows, w.addedAt);
      if (!hit) continue;
      game = { opp: hit.opp, home: hit.home, startsAt: hit.startsAt };
      stamp.set(w.id, game);
      if (hit.final) { done.add(w.id); continue; }
    }
    const start = Date.parse(game.startsAt);
    if (!Number.isFinite(start) || now < start) continue;
    if (now - start > WATCH_BACKSTOP_MS) { done.add(w.id); continue; }
    const rows = await fetchTeamGames(w.sport, w.team, start);
    const hit = rows && findGame(rows, game);
    if (hit && hit.final) done.add(w.id);
  }
  return { stamp, done };
}

// Keeps the watch list to games still to be played: stamps a game on any watch
// without one, and drops a watch once its game is final. Runs when the list
// changes and every few minutes while the app is open.
//
// Results are applied by id through a functional update, so a watch added or
// removed while a pass was out fetching is never overwritten by it. A change
// that lands mid-pass queues one more pass rather than being skipped.
export function useWatchGames(watched, setWatched) {
  const latest = React.useRef(watched);
  latest.current = watched;
  const run = React.useRef({ busy: false, again: false, alive: true });

  const pass = React.useCallback(async () => {
    const s = run.current;
    if (s.busy) { s.again = true; return; }
    s.busy = true;
    try {
      do {
        s.again = false;
        if (!latest.current.length) break;
        const { stamp, done } = await checkWatches(latest.current);
        if (!s.alive) return;
        if (stamp.size || done.size) {
          setWatched((cur) => cur
            .filter((w) => !done.has(w.id))
            .map((w) => (stamp.has(w.id) && !w.game ? { ...w, game: stamp.get(w.id) } : w)));
        }
      } while (s.again && s.alive);
    } finally {
      s.busy = false;
    }
  }, [setWatched]);

  React.useEffect(() => {
    run.current.alive = true;
    return () => { run.current.alive = false; };
  }, []);
  React.useEffect(() => { pass(); }, [watched, pass]);
  React.useEffect(() => {
    const id = setInterval(pass, WATCH_RECHECK_MS);
    return () => clearInterval(id);
  }, [pass]);
}
