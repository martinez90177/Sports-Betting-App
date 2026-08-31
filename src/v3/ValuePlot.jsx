import React from "react";

// Every game in the log, sorted low to high, with the line drawn across.
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
// ---- Height is the total ----
//
// It was frequency for one revision, and that was wrong. Drawn that way, Jared
// Goff's four best games — 27, 28, 31 and 34 completions, one game each — were
// four of the shortest bars on the chart, while 25 towered over them for having
// happened four times. Alex, correctly: "why are bars for lower values
// appearing higher that makes no sense."
//
// So height is the total, zero-based, and every bar is one real game. Sorting
// low to high keeps the frequency information without spending the vertical
// axis on it: a total that comes up often is a run of equal bars side by side,
// which reads as a plateau, and the line is a horizontal cut with the winners
// standing above it. Nothing is bucketed, smoothed or interpolated — 17 games
// in the log draws 17 bars.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

// The same floor `lib/findings.js` uses. Below it a shape is not a shape.
// Marked rather than hidden — the rule everywhere else on this site is that a
// thin sample says so.
const SUPPORT = 5;

// Past this many bars a label under every bar collides with its neighbours, so
// the row is dropped rather than thinned — a partial set of numbers under a
// sorted axis reads as if the unlabelled bars were something else. The bars
// themselves always draw, and every one keeps its hover title.
const LABEL_LIMIT = 45;

export default function ValuePlot({
  bins = [],
  line,
  direction = "over",
  label,
  height = 96,
  note = null,
}) {
  if (!bins.length || line == null) return null;

  // Decided here rather than read off the bin, so the fill follows the line
  // being dragged instead of the posted one it was built against.
  const clears = (v) => (direction === "under" ? v < line : v > line);

  // One entry per game, low to high. `bins` arrives as {value, count}; this is
  // the log it was counted from, put back.
  const sorted = bins.slice().sort((a, b) => a.value - b.value);
  const games = [];
  sorted.forEach((b) => { for (let i = 0; i < b.count; i += 1) games.push(b.value); });

  const total = games.length;
  const cleared = games.filter(clears).length;
  const mode = sorted.reduce((best, b) => (best == null || b.count > best.count ? b : best), null);

  // Zero-based, so twice as tall is twice the total. The line needs headroom
  // when it sits above every game, or it would be drawn off the top.
  const top = Math.max(...games, line) * 1.06 || 1;
  const y = (v) => Math.max(2, Math.round((v / top) * height));
  const linePct = Math.min(100, (line / top) * 100);

  const labelAll = total <= LABEL_LIMIT;
  const w = 100 / total;

  return (
    <div style={{ flex: "0 0 auto", border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>
          {`EVERY ${String(label || "TOTAL").toUpperCase()} IN THE LOG, LOW TO HIGH`}
        </span>
        {/* The sample this is drawn over, beside it — the whole log, which is a
            different denominator from the window the graph above uses. */}
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
          {`${cleared} of ${total} games clear ${line}`}
        </span>
        {total < SUPPORT && (
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.08em", padding: "3px 7px", borderRadius: 5, background: "rgba(232,177,58,0.16)", color: "#e8b13a", whiteSpace: "nowrap", flex: "0 0 auto" }}>
            {`THIN · ${total} GAME${total === 1 ? "" : "S"}`}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {/* The value axis, so height reads as the total and not as a count. */}
        <div style={{ flex: "0 0 auto", width: 20, height, position: "relative" }}>
          <span style={{ position: "absolute", top: 0, right: 0, fontFamily: MONO, fontSize: 9, color: "var(--dim)", lineHeight: 1 }}>{Math.max(...games)}</span>
          <span style={{ position: "absolute", bottom: 0, right: 0, fontFamily: MONO, fontSize: 9, color: "var(--dim)", lineHeight: 1 }}>0</span>
        </div>

        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ position: "relative", height, borderBottom: "1px solid var(--line)" }}>
            {/* The line, across. Games standing above it are the ones that
                cleared, which is the whole read. */}
            <span style={{ position: "absolute", left: 0, right: 0, bottom: `${linePct}%`, borderTop: "1px dashed var(--text-2)", zIndex: 2 }} />
            <span style={{ position: "absolute", right: 0, bottom: `${linePct}%`, transform: "translateY(-50%)", padding: "0 3px", background: "var(--surface-1)", fontFamily: MONO, fontSize: 9, color: "var(--text-2)", zIndex: 3 }}>
              {line}
            </span>

            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 0 }}>
              {games.map((v, i) => {
                const on = clears(v);
                return (
                  <span
                    key={`${v}-${i}`}
                    title={`Game ${i + 1} of ${total} low to high · ${v}`}
                    style={{ flex: `0 0 ${w}%`, maxWidth: `${w}%`, height: y(v), boxSizing: "border-box", padding: "0 1px", display: "block" }}
                  >
                    <span
                      style={{
                        display: "block", width: "100%", height: "100%", boxSizing: "border-box",
                        background: on ? "var(--pos)" : "transparent",
                        border: on ? "none" : "1.5px solid var(--neg)",
                        borderRadius: "2px 2px 0 0",
                      }}
                    />
                  </span>
                );
              })}
            </div>
          </div>

          {/* One label per bar, including the repeats. A single number centred
              over a plateau hid how many games were standing under it, which is
              half of what the plateau is there to show. */}
          <div style={{ position: "relative", height: 13 }}>
            {labelAll && games.map((v, i) => (
              <span
                key={`${v}-${i}`}
                style={{ position: "absolute", left: `${i * w}%`, width: `${w}%`, top: 2, textAlign: "center", fontFamily: MONO, fontSize: 9, color: "var(--dim)", lineHeight: 1 }}
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      </div>

      <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--dim)" }}>
        {total < SUPPORT
          ? `One bar per game, sorted low to high — but only ${total} in the log, too few to read a shape into. Bars ${direction === "under" ? "below" : "above"} the dashed line cleared ${line}.`
          : note || `One bar per game, sorted low to high, so taller is a bigger ${String(label || "total").toLowerCase()}. Equal bars side by side are a total he lands on often${mode && mode.count > 1 ? ` — ${mode.value} in ${mode.count} of ${total} games` : ""}. Bars ${direction === "under" ? "below" : "above"} the dashed line cleared ${line}. Every game in the log, not the window above.`}
      </span>
    </div>
  );
}
