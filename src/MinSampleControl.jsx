import React, { useState } from "react";

// --------------------------------------------------------------------------
// Minimum sample
// --------------------------------------------------------------------------
// "Show me only props with enough history to mean anything."
//
// Spec: `design_handoff_proppalace_full/README.md`, in the board's filter rail
// and again in the mobile refine sheet. Built once here because those are two
// surfaces asking for one control, and the rule underneath it is the app's
// single most load-bearing invariant.
//
// ---- What it does NOT do ----
//
// It does not filter rows out. A prop under the minimum **still appears; it
// just shows no rate**. That is stated in the handoff and restated in the note
// this control prints under itself, and it is the whole point: hiding thin
// rows would quietly answer "is there anything here?" with "no", when the
// honest answer is "yes, but not enough games to say anything about it". The
// app's rule 4 -- nothing is ever silently dropped -- says the same thing.
//
// So `minGames` is a *display* threshold. It raises the bar at which a rate is
// allowed to be printed at all, and the row keeps its place either way.
//
// ---- The ticks ----
//
// Seventeen of them, one NFL regular season, rendered as clickable bars rather
// than an <input type="range">. Each is its own 44px-tall touch target, which
// a range thumb is not, and the stepped heights read as "more games = more
// evidence" without a legend. Bars at or below the current value take the
// accent; the rest stay --line.

const STORAGE_KEY = "propPalaceSamplePresets";
export const MIN_SAMPLE_TICKS = 17;
// Off by default. `1` rather than `0` because "at least one finished game" is
// the weakest true statement, not "zero games is fine".
export const MIN_SAMPLE_ALL = 1;
const DEFAULT_PRESETS = [5, 9, 12];

export function loadSamplePresets() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!Array.isArray(raw)) return DEFAULT_PRESETS;
    // Validated the same way share-link filters are: this is user-writable
    // storage, and a junk value here would render as a junk chip forever.
    const clean = raw
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= MIN_SAMPLE_TICKS)
      .map((n) => Math.round(n));
    return [...new Set(clean)].sort((a, b) => a - b);
  } catch {
    return DEFAULT_PRESETS;
  }
}

export function saveSamplePresets(presets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Quota or private mode. The in-memory list still works this session.
  }
}

export default function MinSampleControl({ value, onChange, presets, onSetPresets, compact = false }) {
  const [hover, setHover] = useState(null);
  const all = value <= MIN_SAMPLE_ALL;
  const shown = hover == null ? value : hover;

  const chip = (label, active, onClick, onDelete, title) => (
    <span
      key={label}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      title={title}
      className="pp-mono"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
        fontSize: 12, borderRadius: 4, padding: compact ? "9px 12px" : "11px 14px",
        background: active ? "var(--amber)" : "transparent",
        color: active ? "var(--accent-on)" : "var(--text-2, var(--dim))",
        border: `1px solid ${active ? "var(--amber)" : "var(--line)"}`,
      }}
    >
      {label}
      {onDelete && (
        // stopPropagation, or removing a preset also selects it on the way out
        // -- the handoff calls this out by name.
        <span
          role="button"
          aria-label={`Remove the ${label} preset`}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{ opacity: 0.7, fontWeight: 700 }}
        >
          ×
        </span>
      )}
    </span>
  );

  const saved = presets.includes(value);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" }}>
          Minimum sample
        </span>
        <span className="pp-mono" style={{ fontSize: 14, color: "var(--amber-ink, var(--amber))" }}>
          {all ? "No minimum" : `${shown}+ games`}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
        {presets.map((n) =>
          chip(
            `${n}+`,
            !all && value === n,
            () => onChange(n),
            () => onSetPresets(presets.filter((p) => p !== n)),
            `Only state a rate once a prop has ${n} finished games`
          )
        )}
        {chip("All", all, () => onChange(MIN_SAMPLE_ALL), null, "State a rate on any sample, however small")}
        {/* Reads `saved` rather than offering to add a duplicate, which is the
            behaviour the handoff specifies for this link. */}
        {!all && (
          <span
            role="button"
            tabIndex={0}
            onClick={() => { if (!saved) onSetPresets([...presets, value].sort((a, b) => a - b)); }}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !saved) { e.preventDefault(); onSetPresets([...presets, value].sort((a, b) => a - b)); } }}
            className="pp-mono"
            style={{
              display: "inline-flex", alignItems: "center",
              padding: compact ? "9px 4px" : "11px 4px", fontSize: 11,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: saved ? "var(--dim)" : "var(--amber-ink, var(--amber))",
              cursor: saved ? "default" : "pointer",
            }}
          >
            {saved ? "saved" : `save ${value}+`}
          </span>
        )}
      </div>

      {/* 44px tall so each tick is a real touch target; only the coloured part
          is 26px, the rest is transparent padding inside the same hit area. */}
      <div
        role="group"
        aria-label="Minimum games"
        style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 44, marginTop: 12 }}
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: MIN_SAMPLE_TICKS }, (_, i) => i + 1).map((n) => {
          const on = !all && n <= value;
          return (
            <span
              key={n}
              role="button"
              aria-label={`${n} games`}
              aria-pressed={on}
              title={`Only state a rate once a prop has ${n} finished ${n === 1 ? "game" : "games"}`}
              onClick={() => onChange(n)}
              onMouseEnter={() => setHover(n)}
              style={{
                flex: 1, height: "100%", cursor: "pointer",
                display: "flex", alignItems: "flex-end",
              }}
            >
              <span style={{
                width: "100%",
                height: 10 + n,
                borderRadius: 1,
                background: on ? "var(--amber)" : "var(--line)",
              }} />
            </span>
          );
        })}
      </div>

      <div className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.04em", color: "var(--dim)", marginTop: 10, lineHeight: 1.5 }}>
        {all
          ? "Every prop states a rate, however few games are behind it."
          : `Props under ${value} games still appear, without a rate.`}
      </div>
    </div>
  );
}
