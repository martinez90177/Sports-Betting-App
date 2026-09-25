import React from "react";

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

// The custom window's number, typed rather than stepped to.
//
// Alex, 2026-09-24: *"clicking each one up and down is annoying."* It was --
// L10 to L40 on an MLB page was thirty clicks. The − / + stay beside it for a
// nudge; this is for going straight to a number.
//
// Digits only, clamped to the league's range when it lands, so a typo cannot
// ask for a 400-game window or a 0-game one. Enter uses it now (`onEnter`),
// the same as APPLY; leaving the field just keeps the number in the stepper
// for APPLY or SAVE to act on; Escape puts the old number back.
export default function WindowNumber({ value, min = 2, max = 82, onType, onEnter, fontSize = 13, style = null }) {
  const [draft, setDraft] = React.useState(null);
  const editing = draft != null;
  // Enter and Escape both blur the field, and the blur handler still holds
  // this render's draft -- so without this, Escape would land the very
  // number it was meant to throw away.
  const handled = React.useRef(false);

  const land = () => {
    const n = parseInt(draft, 10);
    setDraft(null);
    if (!Number.isFinite(n)) return null;
    return Math.max(min, Math.min(max, n));
  };

  return (
    <label
      title={`Type a window, ${min} to ${max} games`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 1,
        fontFamily: MONO, fontSize, fontWeight: 700, cursor: "text",
        ...(style || {}),
        // A ring rather than a border colour: the caller's `border` is a
        // shorthand, and React warns when a longhand is swapped in beside it.
        ...(editing ? { boxShadow: "inset 0 0 0 1px var(--amber)" } : null),
      }}
    >
      <span style={{ color: "var(--dim)", fontWeight: 400 }}>L</span>
      <input
        type="text"
        inputMode="numeric"
        enterKeyHint="go"
        aria-label={`Your own window, ${min} to ${max} games`}
        value={editing ? draft : String(value)}
        onFocus={(e) => { setDraft(String(value)); e.target.select(); }}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 3))}
        onBlur={() => {
          if (handled.current) { handled.current = false; return; }
          if (!editing) return;
          const v = land();
          if (v != null) onType(v, false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const v = land();
            if (v != null) { if (onEnter) onEnter(v); else onType(v, true); }
            handled.current = true;
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(null);
            handled.current = true;
            e.currentTarget.blur();
          }
        }}
        style={{
          // Sized to what it holds, so "L10" and "L162" both sit centred.
          width: `${Math.max(2, String(editing ? draft : value).length)}ch`,
          padding: 0, margin: 0, border: "none", outline: "none", background: "transparent",
          color: "var(--text)", font: "inherit", textAlign: "center",
        }}
      />
    </label>
  );
}
