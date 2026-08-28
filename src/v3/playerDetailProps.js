// The v3 mobile Player Detail draws four controls the four sport pages already
// hold state for, but hold under different names and offer through different
// widgets: Season, Window, Splits and Market. These builders turn that state
// into the option lists the mock's bottom sheet draws, in one place, so the
// four pages cannot drift apart on what "L10" or "Away only" means.
//
// Nothing here holds state or fetches. Each page passes its own values and
// setters in; the shapes out are exactly what PlayerDetailMobile renders.

import { logScopeOptions } from "../LogScope.jsx";

// A season's length decides what a window means: 162 games make "last 18"
// meaningless and 17 make "last 30" impossible. From
// `v3 Mocks/player-detail-handoff.md` section 4, which supersedes the v2
// handoff's table (that one put MLB at L20).
export const WINDOWS = {
  mlb: [10, 20, 30, "all"],
  nfl: [3, 5, 10, "all"],
  nba: [5, 10, 20, "all"],
  wnba: [5, 10, 15, "all"],
};

export const DEFAULT_WINDOW = { mlb: 10, nfl: 5, nba: 10, wnba: 10 };

// The ceiling the custom stepper counts to, per league season length.
export const SEASON_LENGTH = { mlb: 162, nfl: 17, nba: 82, wnba: 44 };

const windowLabel = (w) => (w === "all" ? "Season" : `L${w}`);

// The pill row: the sport's own four, then any window the reader saved, then
// H2H -- which plots the finished meetings with tonight's opponent and ignores
// the window entirely.
export function buildWindows({ sport, lastN, setLastN, saved = [], onSave, custom, setCustom, onReset }) {
  const base = WINDOWS[sport] || WINDOWS.nba;
  const ids = base.concat(saved.filter((w) => !base.includes(w)));
  return {
    options: ids.map((w) => ({
      id: String(w),
      label: windowLabel(w),
      active: String(lastN) === String(w),
      onPick: () => setLastN(w),
    })),
    custom: setCustom
      ? {
          value: custom,
          // 2 is the floor a window can mean anything at; the ceiling is the
          // league's own season length.
          onUp: () => setCustom(Math.min(SEASON_LENGTH[sport] || 82, custom + 1)),
          onDown: () => setCustom(Math.max(2, custom - 1)),
          // SAVE selects it *and* keeps it on the bar for later. Apply-only is
          // the sheet's DONE button, which commits whatever is showing.
          onSave: () => { setLastN(custom); onSave && onSave(custom); },
        }
      : null,
    onReset,
  };
}

// Exclusive, one at a time: two splits at once would recompute the rate over an
// intersection nobody asked for. Radio, not checkbox.
//
// `starterLabel` is the sport's own word for the last option -- "vs this
// pitcher" in baseball, "vs this defense" everywhere else. Omitted entirely
// when the page has no opponent to compare against, rather than offered as a
// control that filters to nothing.
export function buildSplits({ side, setSide, lastN, setLastN, h2h, setH2h, starterLabel, defaultWindow }) {
  const last3 = String(lastN) === "3";
  const clear = () => { if (setH2h) setH2h(false); };
  const restore = () => { if (last3) setLastN(defaultWindow); };
  const out = [
    {
      id: "season",
      label: "All games",
      active: side === "all" && !last3 && !h2h,
      onPick: () => { setSide("all"); clear(); restore(); },
    },
    {
      id: "home",
      label: "Home only",
      active: side === "home" && !h2h,
      onPick: () => { setSide("home"); clear(); restore(); },
    },
    {
      id: "away",
      label: "Away only",
      active: side === "away" && !h2h,
      onPick: () => { setSide("away"); clear(); restore(); },
    },
    {
      id: "last3",
      label: "Last 3 games",
      active: last3 && !h2h,
      onPick: () => { setSide("all"); clear(); setLastN(3); },
    },
  ];
  if (starterLabel && setH2h) {
    out.push({
      id: "vs",
      label: starterLabel,
      active: !!h2h,
      onPick: () => { setSide("all"); restore(); setH2h(true); },
    });
  }
  return out;
}

// Seasons come off the log itself, through the same options builder the
// LogScope control uses -- so the sheet and the desktop rail can never offer
// different seasons for the same player.
export function buildSeasons({ games, sport, scope, onChange }) {
  const opts = logScopeOptions(games, sport, scope);
  if (!opts.seasons.length) return null;
  return opts.seasons.map((s) => ({
    id: s.id,
    label: s.label,
    active: (scope.season ?? "current") === s.id,
    onPick: () => onChange({ ...scope, season: s.id }),
  }));
}

// The slate the header's game menu opens. Built from the same `groups` the
// four pages already assemble for GameSelect, so the menu and the dropdown it
// replaces on a phone can never list different games.
export function buildSlate({ groups, value, onChange, timeOf }) {
  const all = (groups || []).flatMap((g) => g.matchups || []);
  if (all.length < 2) return null;
  const teamsOf = (m) => {
    if (Array.isArray(m.teams) && m.teams.length === 2 && m.teams.every(Boolean)) return m.teams;
    const abbr = (side) => side && side.players && side.players[0] && side.players[0].team;
    const pair = [abbr(m.teamA), abbr(m.teamB)];
    return pair.every(Boolean) ? pair : null;
  };
  return {
    games: all
      .map((m) => {
        const pair = teamsOf(m);
        if (!pair) return null;
        return {
          id: m.id,
          away: pair[0],
          home: pair[1],
          time: m.time || (timeOf ? timeOf(m) : ""),
          active: m.id === value,
          onPick: () => onChange(m),
        };
      })
      .filter(Boolean),
  };
}
