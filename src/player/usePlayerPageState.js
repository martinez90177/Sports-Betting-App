// The state every player-detail page holds, in one place.
//
// The four sport pages are the same screen four times -- NBA, NFL, WNBA and
// MLB each hold their own copy of the same eleven pieces of state, declared in
// the same order, doing the same job. That duplication is not a style problem,
// it is where the bugs come from, and this session alone produced three of them
// in sets of four:
//
//   * the pre-v2 page sat dead in all four and had to be deleted four times
//   * `dragLine` was never cleared on a market change in any of them, so a line
//     dragged on Pass Yds followed the reader onto a receiver's Receptions page
//     and every number on screen was graded against it
//   * the WNBA copy had drifted far enough that its `if (!player)` guard sat
//     above two hooks, and the page crashed outright
//
// So this is the first slice of pulling them back together: the state, and the
// one effect that has to run with it. A fix here lands on all four at once, and
// a twelfth piece of state cannot be added to three pages and forgotten on the
// fourth.
//
// Deliberately NOT here: anything a sport holds alone. Rebound splits and a
// minutes range are basketball, snap percentage is football, batting hand and
// the lineup cache are baseball. Those stay on their own pages -- a shared hook
// carrying every sport's private state would be four pages in a trenchcoat.

import { useState, useEffect } from "react";
import { LOG_SCOPE_DEFAULT } from "../LogScope.jsx";
import { DEFAULT_WINDOW } from "../v3/playerDetailProps.js";

export default function usePlayerPageState({ sport, initialPlayerId, initialMarket }) {
  // Which row of the log the page is about.
  const [playerId, setPlayerId] = useState(initialPlayerId);
  const [market, setMarket] = useState(initialMarket);

  // What narrows it. `lastN` is the only one whose default is per sport: a
  // window means different things across a 17-game season and a 162-game one.
  const [side, setSide] = useState("all");
  const [lastN, setLastN] = useState(DEFAULT_WINDOW[sport] ?? 10);
  const [logScope, setLogScope] = useState(LOG_SCOPE_DEFAULT);

  // The line being read. Two states, not one, and the distinction matters:
  // `line` is what the reader picked from the ladder, `dragLine` is where they
  // dragged the tag to. The chart prefers dragLine (see each page's
  // v2LiveLine), which is exactly why forgetting to clear it was so damaging.
  const [line, setLine] = useState(null);
  const [dragLine, setDragLine] = useState(null);

  // With/without teammate chips, and whether the reader has asked for the data
  // behind them -- the per-game participation fetch is expensive and opt-in.
  const [teammateChips, setTeammateChips] = useState([]);
  const [teammateDataWanted, setTeammateDataWanted] = useState(false);

  // Chrome.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showContext, setShowContext] = useState(false);

  // A dragged line belongs to one market on one player and dies with either.
  //
  // Kept on the state rather than in the pick handlers, so every route that
  // changes either -- the market strip, the roster rail, the keyboard walk, a
  // page's own position guard -- is covered by one rule instead of each
  // remembering. This is the fix that had to be written four times before.
  useEffect(() => { setDragLine(null); }, [market, playerId]);

  return {
    playerId, setPlayerId,
    market, setMarket,
    side, setSide,
    lastN, setLastN,
    logScope, setLogScope,
    line, setLine,
    dragLine, setDragLine,
    teammateChips, setTeammateChips,
    teammateDataWanted, setTeammateDataWanted,
    filtersOpen, setFiltersOpen,
    showContext, setShowContext,
  };
}
