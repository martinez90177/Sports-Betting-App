import React from "react";

// Where a player's output actually lands — one bar per distinct total that
// occurred in the log, over the whole log rather than the window.
//
// This is the one capability the v2 era had that no v3 frame draws. It lived in
// a `viewMode === "matchup"` layout whose entry button was removed when the v2
// player page shipped, so it had been unreachable for some time before the dead
// branch was deleted. Alex asked for it back on the merits.
//
// It answers a different question from the form graph above it. That one is
// chronological and margin-from-the-line: *did he clear it, and by how much*.
// This is the shape of the output: two players at 70% on a 20.5 line read
// identically there and completely differently here — one piled up at 21-23,
// where half a point of line movement is dangerous, the other bimodal at 14 and
// 28, where the 70% is riding a few big nights.
//
// No smoothing and no fitted curve. One bar per value the log actually
// produced, and nothing between them is drawn, because nothing between them
// happened.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

export default function ValuePlot({
  bins = [],
  line,
  direction = "over",
  label,
  height = 68,
  note = null,
}) {
  if (!bins.length || line == null) return null;

  const max = Math.max(1, ...bins.map((b) => b.count));
  const total = bins.reduce((a, b) => a + b.count, 0);
  // Decided here rather than read off the bin, so the fill follows the line
  // being dragged instead of the posted one it was built against.
  const clears = (v) => (direction === "under" ? v < line : v > line);
  const cleared = bins.filter((b) => clears(b.value)).reduce((a, b) => a + b.count, 0);

  // The tallest bar, named. "He lands on 2 more than any other number" is the
  // thing this chart is for, and it should not have to be counted off the axis.
  const mode = bins.reduce((best, b) => (best == null || b.count > best.count ? b : best), null);

  return (
    <div style={{ flex: "0 0 auto", border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>
          {`HOW OFTEN EACH ${String(label || "TOTAL").toUpperCase()} COMES UP`}
        </span>
        {/* The sample this is drawn over, beside it — the whole log, which is a
            different denominator from the window the graph above uses. */}
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
          {`${cleared} of ${total} games clear ${line}`}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height }}>
        {bins.map((b) => {
          const on = clears(b.value);
          return (
            <span
              key={b.value}
              title={`${b.value}: ${b.count} game${b.count === 1 ? "" : "s"}`}
              style={{
                flex: "1 1 0", minWidth: 0,
                height: Math.max(4, Math.round((b.count / max) * height)),
                background: on ? "var(--pos)" : "transparent",
                border: on ? "none" : "1.5px solid var(--neg)",
                borderRadius: 2, boxSizing: "border-box", display: "block",
              }}
            />
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 5 }}>
        {bins.map((b) => (
          <span key={b.value} style={{ flex: "1 1 0", minWidth: 0, textAlign: "center", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
            {b.value}
          </span>
        ))}
      </div>

      <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--dim)" }}>
        {note || (mode
          ? `Most often ${mode.value}, in ${mode.count} of ${total} games. Filled bars cleared ${line}, outlined bars fell short. Every game in the log, not the window above.`
          : `Filled bars cleared ${line}, outlined bars fell short.`)}
      </span>
    </div>
  );
}
