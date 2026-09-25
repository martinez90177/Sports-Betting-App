// The v3 mobile Player Detail draws four controls the four sport pages already
// hold state for, but hold under different names and offer through different
// widgets: Season, Window, Splits and Market. These builders turn that state
// into the option lists the mock's bottom sheet draws, in one place, so the
// four pages cannot drift apart on what "L10" or "Away only" means.
//
// Nothing here holds state or fetches. Each page passes its own values and
// setters in; the shapes out are exactly what PlayerDetailMobile renders.

import { logScopeOptions, resolveSeason, SEASON_MIN_GAMES, seasonLabel } from "../LogScope.jsx";

// What a set of season averages was counted over, so the numbers never stand
// without their sample: "2025 · 18 GP", or "2025–2026 · 20 GP" while the
// season rail is on All seasons. NBA spans read "2 seasons", because
// "2024-25–2025-26" is not something anyone should have to parse.
export function seasonScope(games, sport) {
  const list = games || [];
  const ys = [...new Set(list.map((g) => Number(g.season)).filter(Number.isFinite))].sort((a, b) => a - b);
  let label = null;
  if (ys.length === 1) label = seasonLabel(ys[0], sport);
  else if (ys.length > 1) label = sport === "nba" ? `${ys.length} seasons` : `${ys[0]}–${ys[ys.length - 1]}`;
  return { label, games: list.length };
}

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

// NFL was 5, and five of a seventeen-game season is a sample the app itself
// refuses to speak for: the feed's NFL minimum is 9, so the player page opened
// on a window the feed would decline to state a rate for. On screen that read
// as an argument with itself -- "LINE 308.5 · IMPLIED -400 · FROM 5 GAMES" above
// the words "5 games counted · too few to lean on" -- and it flattened the alt
// line ladder, where four consecutive rungs all showed 80% (4 of 5) because
// five games cannot tell them apart.
//
// Ten clears the minimum, matches every other sport, and is still well inside a
// seventeen-game season. For reference PropsMadness opens on twenty.
export const DEFAULT_WINDOW = { mlb: 10, nfl: 10, nba: 10, wnba: 10 };

// The ceiling the custom stepper counts to, per league season length.
export const SEASON_LENGTH = { mlb: 162, nfl: 17, nba: 82, wnba: 44 };

// How far the custom-window stepper counts, which is no longer the same thing
// as a season.
//
// It used to be SEASON_LENGTH, and for the NFL that meant 17 -- so the rail
// offered an L20 column the stepper could not reach, and the rolling windows
// now span the season boundary anyway (see nflFeedGames), so a window longer
// than one season is a real question with a real answer. Alex, 2026-09-09:
// *"being that L20 is a choice for sorting, 'your own window' shouldnt be
// limited to 17."*
//
// 34 is two seventeen-game regular seasons: the most the merged log holds, and
// a number that means something rather than a round one. Past it the window
// would be asking for games that cannot exist.
//
// The other three are unchanged. Their seasons are long enough that the
// ceiling was never the thing in the way, and doubling 162 would give MLB a
// stepper nobody can drive.
export const WINDOW_MAX = { ...SEASON_LENGTH, nfl: 34 };

// Frame 1a's MINIMUM SAMPLE group: 10+ / 15+ / 30+ / All.
//
// What it does is this app's decision, not the mock's -- the mock draws the
// control, defaults it to "15+" and never reads it. The handoff calls the left
// rail "what filters the page", and on a page about one player the only thing
// a sample floor can filter is which rates the page is willing to state
// plainly. So it marks every rate with fewer games behind it than the floor.
//
// It marks rather than hides, which is the app's own published rule -- the
// Findings screen prints "A THIN SAMPLE IS MARKED, NEVER HIDDEN" across its
// own header -- and hiding would leave a reader unable to tell a thin sample
// from a missing one.
//
// "All" is a floor of zero: every rate stated, none of them flagged.
export const SAMPLE_FLOORS = [10, 15, 30, "all"];

// Ten, because that is already the number this app calls thin: THIN_GAMES in
// lib/altLines.js, which the alt-line ladder has always graded itself against.
// A rail control that disagreed with the card below it would be worse than no
// control. The mock opens on 15+; matching the app's own constant matters more
// than matching a mock's placeholder state.
export const DEFAULT_MIN_SAMPLE = 10;

export const sampleFloor = (minSample) =>
  (minSample === "all" || minSample == null ? 0 : Number(minSample) || 0);

export function buildSamples({ minSample, setMinSample }) {
  return SAMPLE_FLOORS.map((v) => ({
    id: String(v),
    label: v === "all" ? "All" : `${v}+`,
    active: String(minSample) === String(v),
    onPick: () => setMinSample(v),
  }));
}

const windowLabel = (w) => (w === "all" ? "Season" : `L${w}`);

// The pill row: the sport's own four, then any window the reader saved, then
// H2H -- which plots the finished meetings with tonight's opponent and ignores
// the window entirely.
// `h2h` is the frame's last window: `WINDOWS.MLB.concat(savedWins).concat(["H2H
// vs BAL"])`. It is a window rather than a split because it replaces the
// sample outright -- every meeting with tonight's opponent, however far back --
// where a split narrows the window already chosen. Omitted when there is no
// opponent to name.
export function buildWindows({ sport, lastN, setLastN, saved = [], onSave, onRemove, custom, setCustom, onReset, h2h = null }) {
  const base = WINDOWS[sport] || WINDOWS.nba;
  const ids = base.concat(saved.filter((w) => !base.includes(w)));
  // 2 is the floor a window can mean anything at; the ceiling is the league's
  // own season length.
  const max = WINDOW_MAX[sport] || 82;
  const clamp = (n) => Math.max(2, Math.min(max, Math.round(n)));
  // Every way of choosing a window leaves H2H first, as a pill does -- H2H
  // replaces the sample outright, so a custom window applied under it
  // changed nothing on screen.
  const use = (n) => { if (h2h && h2h.active && h2h.onClear) h2h.onClear(); setLastN(n); };
  return {
    options: ids.map((w) => {
      const own = !base.includes(w);
      return {
        id: String(w),
        label: windowLabel(w),
        active: !(h2h && h2h.active) && String(lastN) === String(w),
        onPick: () => { if (h2h && h2h.onClear) h2h.onClear(); setLastN(w); },
        // Only a window the reader saved can be removed; the sport's own
        // four are the frame's. Removing the one in use drops back to the
        // default, so the row never loses sight of which window is on.
        onRemove: own && onRemove
          ? () => {
              onRemove(w);
              if (!(h2h && h2h.active) && String(lastN) === String(w)) setLastN(DEFAULT_WINDOW[sport] || 10);
            }
          : null,
      };
    }).concat(h2h && h2h.oppAbbr ? [{
      id: "h2h",
      label: `H2H vs ${h2h.oppAbbr}`,
      active: !!h2h.active,
      onPick: h2h.onPick,
    }] : []),
    custom: setCustom
      ? {
          value: custom,
          min: 2,
          max,
          onUp: () => setCustom(clamp(custom + 1)),
          onDown: () => setCustom(clamp(custom - 1)),
          // A typed number, clamped to the league's range. With `now` it is
          // also used at once -- Enter in the field is APPLY, not SAVE.
          onType: (n, now) => {
            const v = clamp(n);
            setCustom(v);
            if (now) use(v);
          },
          // APPLY tries it now and nothing more -- it does not join `saved`,
          // so it never gains a pill of its own. Without this, every value
          // stepped through on the way to the one actually wanted stuck to
          // the bar forever, because the desktop button labelled APPLY called
          // the same function SAVE did (`onApply || onSave`, with `onApply`
          // never defined). SAVE is the only path that persists, matching its
          // own caption: "keeps it on the rail."
          onApply: () => use(custom),
          onSave: () => { use(custom); onSave && onSave(custom); },
        }
      : null,
    // The window in use, named even when no pill is -- a typed or applied
    // window is not saved, so it has no pill to light up, and the phone's
    // chip read a bare "Window" over a 26-game chart.
    currentLabel: h2h && h2h.active ? `H2H vs ${h2h.oppAbbr}` : windowLabel(lastN),
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
// "Last 3 games" is gone, and it should never have been here.
//
// It was a window wearing a split's clothes: the other four narrow *which*
// games count -- home, away, against tonight's opponent -- while that one just
// set lastN to 3, which is what the WINDOW rail and the custom stepper directly
// above it already do, and do better. Alex, 2026-09-09: *"Last3 games seems
// like a silly split when a custom window is possible."*
//
// Its removal takes `restore` with it. That helper existed only to undo the
// side effect -- putting lastN back to the sport's default when the reader
// moved off Last 3 -- and keeping it would mean picking "Home only" silently
// resetting a window the reader had chosen themselves on the stepper.
export function buildSplits({ side, setSide, h2h, setH2h, starterLabel }) {
  const clear = () => { if (setH2h) setH2h(false); };
  const out = [
    {
      id: "season",
      label: "All games",
      active: side === "all" && !h2h,
      onPick: () => { setSide("all"); clear(); },
    },
    {
      id: "home",
      label: "Home only",
      active: side === "home" && !h2h,
      onPick: () => { setSide("home"); clear(); },
    },
    {
      id: "away",
      label: "Away only",
      active: side === "away" && !h2h,
      onPick: () => { setSide("away"); clear(); },
    },
  ];
  if (starterLabel && setH2h) {
    out.push({
      id: "vs",
      label: starterLabel,
      active: !!h2h,
      onPick: () => { setSide("all"); setH2h(true); },
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
  // Resolved rather than raw: a season too young to stand alone is not on the
  // list (see SEASON_MIN_GAMES), and "current" is showing All seasons until it
  // is. Comparing the stored id would leave the sheet with nothing marked and
  // the chip reading "Season".
  const active = resolveSeason(games, scope);
  return {
    options: opts.seasons.map((s) => ({
      id: s.id,
      label: s.label,
      active: active === s.id,
      onPick: () => onChange({ ...scope, season: s.id }),
    })),
    // Drawn under the row, so a season missing from it says why rather than
    // just not being there -- the year is stamped on every other surface of
    // the page, so its absence here is a question a reader will ask.
    note: opts.pendingSeason
      ? `${opts.pendingSeason.label} is ${opts.pendingSeason.n} game${opts.pendingSeason.n === 1 ? "" : "s"} old — it becomes a choice of its own at ${SEASON_MIN_GAMES}.`
      : null,
  };
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
