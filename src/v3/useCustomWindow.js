import { useCallback, useState } from "react";
import { SEASON_LENGTH, DEFAULT_WINDOW } from "./playerDetailProps.js";

// The custom-window stepper's own state, and the windows the reader has saved.
//
// "Saved windows stay on the bar for every player" -- the mock's own sentence
// under the control -- so they outlive the page and are stored, not held in
// component state. Per sport, because a window means a different thing in a
// 162-game season than a 17-game one, and one shared key meant a useful MLB
// window overwrote the NFL row (the same trap MinSampleControl hit once
// already: see docs/REDESIGN_PLAN.md, "The minimum sample was an NFL control
// on every sport").
const KEY = (sport) => `pp.v3.savedWindows.${sport}`;

function load(sport) {
  try {
    const raw = localStorage.getItem(KEY(sport));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const max = SEASON_LENGTH[sport] || 82;
    // A stored value past this league's season length cannot mean anything --
    // dropped on read rather than offered as a window nobody can fill.
    return parsed.map(Number).filter((n) => Number.isFinite(n) && n >= 2 && n <= max);
  } catch {
    return [];
  }
}

export default function useCustomWindow(sport) {
  const [custom, setCustom] = useState(() => DEFAULT_WINDOW[sport] || 10);
  const [saved, setSaved] = useState(() => load(sport));

  const onSave = useCallback((n) => {
    setSaved((prev) => {
      if (prev.includes(n)) return prev;
      const next = prev.concat(n).sort((a, b) => a - b);
      try { localStorage.setItem(KEY(sport), JSON.stringify(next)); } catch {}
      return next;
    });
  }, [sport]);

  return { custom, setCustom, saved, onSave };
}
