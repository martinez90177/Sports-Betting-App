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
//
// ---- What a 121-game log did to that ----
//
// The measurement was right and the drawing was not. On a batter's hit log —
// 121 games over six distinct values — three things compounded:
//
//   * A miss was drawn hollow: a 1.5px red outline on a bar the log's own
//     width had squeezed to three pixels, so the outline *was* the bar. Fill
//     and hollow is the app's device at avatar scale; at 3px it is a smear.
//   * Every zero game is a 2px stub (the floor that keeps a real game from
//     vanishing), and forty-seven hollow 2px stubs in a row read as a broken
//     red dashed rule sitting on the axis, not as forty-seven games.
//   * Past 45 bars the label row dropped entirely, so the densest charts —
//     the ones where the plateaus matter most — carried no numbers at all.
//
// All three are drawing decisions, and all three are changed below. Nothing
// about what is measured moved: still one bar per game, still height = total,
// still the whole log rather than the window.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

// The same floor `lib/findings.js` uses. Below it a shape is not a shape.
// Marked rather than hidden — the rule everywhere else on this site is that a
// thin sample says so.
const SUPPORT = 5;

// Past this many *runs* a label under each one collides with its neighbours,
// so the row is dropped rather than thinned — a partial set of numbers under a
// sorted axis reads as if the unlabelled bars were something else.
//
// Runs, not bars, is the change. A hits log is 121 games across six values, so
// it is six labels and always fits; a passing-yards log is 121 games across
// 121 values, so it is 121 runs and still drops, exactly as before. The dense
// charts that can be labelled now are.
const LABEL_LIMIT = 45;

// Under this many pixels per bar an inter-bar gap costs more than it explains:
// it eats most of the bar and turns a plateau into a picket fence. Above it the
// hairline stays, so a short log still reads as discrete games.
const GAP_MIN_SLOT = 7;

export default function ValuePlot({
  bins = [],
  line,
  direction = "over",
  label,
  height = 110,
  width = null,     // measured slot width in px, when the caller knows it
  note = null,
}) {
  const wrapRef = React.useRef(null);
  // The plot's own width, so the gap and the label rules below are decided
  // against real pixels rather than against a guess at the container.
  const [plotW, setPlotW] = React.useState(width || 0);
  React.useLayoutEffect(() => {
    const measure = () => {
      if (wrapRef.current) setPlotW(wrapRef.current.getBoundingClientRect().width);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

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
  const maxValue = Math.max(...games);

  // Consecutive equal games, which after the sort is every game of that value.
  // The plateau the chart is built to show, named once so the bars, the gaps
  // and the labels all read it off the same array.
  const runs = [];
  games.forEach((v, i) => {
    const last = runs[runs.length - 1];
    if (last && last.value === v) last.count += 1;
    else runs.push({ value: v, count: 1, from: i });
  });

  // Zero-based, so twice as tall is twice the total. The line needs headroom
  // when it sits above every game, or it would be drawn off the top.
  const top = Math.max(maxValue, line) * 1.06 || 1;
  const y = (v) => Math.max(2, Math.round((v / top) * height));
  const linePct = Math.min(100, (line / top) * 100);

  const slot = plotW ? plotW / total : 0;
  const gap = slot >= GAP_MIN_SLOT ? 1 : 0;
  const w = 100 / total;

  // Which runs get a number, and which form of it, placed left to right
  // against real pixels.
  //
  // Share-of-axis was the first cut and it was the wrong unit: five games out
  // of 121 is 4% either way, but 4% of a 330px desktop plot is 13px and 4% of
  // the phone's is 5px. So the tail of a hits log printed "3 ×5" and "5" into
  // fourteen pixels between them and they ran together.
  //
  // Each run takes the full `value ×count` if its own width can hold it, the
  // bare value if not, and nothing at all if even that would land on the label
  // before it. A number is never clipped and never overlaps: the bars carry
  // every game regardless, and each keeps its hover title.
  const CH = 5.6;        // one mono character at 9px
  const LABEL_PAD = 5;   // clear air between two labels
  const runLabels = [];
  if (plotW && runs.length <= LABEL_LIMIT) {
    let lastRight = -Infinity;
    runs.forEach((r) => {
      const full = r.count > 1 ? `${r.value} ×${r.count}` : String(r.value);
      const short = String(r.value);
      const mid = (r.from + r.count / 2) * slot;
      const text = full.length * CH <= r.count * slot ? full : short;
      const half = (text.length * CH) / 2;
      // The first and last runs anchor inside the axis rather than centring,
      // so a one-game run at either end cannot hang off the plot.
      let left = mid - half;
      if (left < 0) left = 0;
      if (left + half * 2 > plotW) left = plotW - half * 2;
      if (left < lastRight + LABEL_PAD) return;
      lastRight = left + half * 2;
      runLabels.push({ key: `${r.value}-${r.from}`, text, left });
    });
  }

  const zeros = games.filter((v) => v === 0).length;

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
        {/* The value axis: the top of the range, the line, and nought.
            The line's own number used to be a chip pinned to the right edge
            *inside* the plot, where on any log whose big games are its last
            bars it sat on top of them. In the gutter it collides with
            nothing and reads as what it is — a value on the scale. */}
        <div style={{ flex: "0 0 auto", width: 30, height, position: "relative" }}>
          <span style={{ position: "absolute", top: 0, right: 0, fontFamily: MONO, fontSize: 9, color: "var(--dim)", lineHeight: 1 }}>{maxValue}</span>
          <span style={{ position: "absolute", bottom: 0, right: 0, fontFamily: MONO, fontSize: 9, color: "var(--dim)", lineHeight: 1 }}>0</span>
          {/* Suppressed where it would print on top of one of the two above.
              A scale reading "5 / 5 / 0" is worse than one reading "5 / 0". */}
          {linePct > 12 && linePct < 88 && (
            <span style={{
              position: "absolute", right: 0, bottom: `${linePct}%`, transform: "translateY(50%)",
              fontFamily: MONO, fontSize: 9, color: "var(--text-2)", lineHeight: 1, whiteSpace: "nowrap",
            }}>
              {line}
            </span>
          )}
        </div>

        <div ref={wrapRef} style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ position: "relative", height, borderBottom: "1px solid var(--line)" }}>
            {/* The line, across. Games standing above it are the ones that
                cleared, which is the whole read. */}
            <span style={{ position: "absolute", left: 0, right: 0, bottom: `${linePct}%`, borderTop: "1px dashed var(--text-2)", zIndex: 2 }} />

            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end" }}>
              {/* One gap per bar while there is room for one, and none at all
                  once there is not. A seventeen-game log at twenty pixels a
                  bar reads as seventeen games and should; a 121-game log at
                  under three has no pixel to spend on a divider, and forcing
                  one turns every plateau into a picket fence. Merged, the
                  plateau reads as the block it is, and its label carries the
                  count the separators would have shown. */}
              {games.map((v, i) => {
                const on = clears(v);
                return (
                  <span
                    key={`${v}-${i}`}
                    title={`${v} — game ${i + 1} of ${total} low to high`}
                    style={{
                      flex: `0 0 ${w}%`, maxWidth: `${w}%`, height: y(v), boxSizing: "border-box",
                      paddingRight: gap, display: "block",
                    }}
                  >
                    <span
                      style={{
                        display: "block", width: "100%", height: "100%",
                        // Both sides filled. The hollow miss is the app's
                        // fill/hollow device, and it works at avatar scale;
                        // on a three-pixel bar the 1.5px outline is the whole
                        // bar, and a row of them reads as a dashed rule. The
                        // miss keeps the outcome red, at the weight the
                        // neutral-value badges use, so the cleared games stay
                        // the ones that carry.
                        background: on ? "var(--pos)" : "color-mix(in srgb, var(--neg) 52%, transparent)",
                        borderRadius: v === 0 ? 0 : "2px 2px 0 0",
                      }}
                    />
                  </span>
                );
              })}
            </div>
          </div>

          {/* One label per plateau, carrying its own count.
              It was one per bar, which is right up to about forty-five of them
              and draws nothing at all past that — so the logs with the most to
              say were the ones saying nothing. Labelling the run instead keeps
              what the per-bar row was there to protect: the count under a
              plateau is printed rather than left to be eyeballed off its
              width. */}
          <div style={{ position: "relative", height: 14 }}>
            {/* "×" rather than the app's usual "·" separator: at 9px "0·37"
                reads as the decimal 0.37, which on an axis of counts is the
                one misreading worth spending a glyph to avoid. */}
            {runLabels.map((l) => (
              <span
                key={l.key}
                style={{
                  position: "absolute", left: l.left, top: 3,
                  fontFamily: MONO, fontSize: 9, color: "var(--dim)",
                  lineHeight: 1, whiteSpace: "nowrap",
                }}
              >
                {l.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--dim)" }}>
        {total < SUPPORT
          ? `One bar per game, sorted low to high — but only ${total} in the log, too few to read a shape into. Bars ${direction === "under" ? "below" : "above"} the dashed line cleared ${line}.`
          : note || [
            `One bar per game, sorted low to high — taller is a bigger ${String(label || "total").toLowerCase()} total.`,
            // The blocks sentence only when there are blocks.
            //
            // It used to key on how many labels rendered, which says nothing
            // about whether any value repeats -- so a yardage log, where every
            // game lands on its own number, described a feature of the chart
            // that was not on the chart. `mode` is the widest run, so
            // mode.count > 1 is the exact test for "does anything repeat".
            !(mode && mode.count > 1)
              ? null
              : runLabels.length > 1
                ? `A block of equal bars is a total he lands on repeatedly; the number under it reads value ×games.`
                : `A block of equal bars is a total he lands on repeatedly; the widest is ${mode.value}, in ${mode.count} of ${total} games.`,
            zeros > 0 ? `The flat run on the axis is ${zeros} game${zeros === 1 ? "" : "s"} at nought.` : null,
            `Bars ${direction === "under" ? "below" : "above"} the dashed line cleared ${line}. Every game in the log, not the window above.`,
          ].filter(Boolean).join(" ")}
      </span>
    </div>
  );
}
