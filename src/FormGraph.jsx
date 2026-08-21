import React from "react";
import { feedIsHit } from "./lib/altLines.js";

// --------------------------------------------------------------------------
// The form graph
// --------------------------------------------------------------------------
// Lifted out of PropLedger.jsx so the prop feed, the mobile prop detail and
// the landing page's example card all plot the same player identically. The
// axis is the single most-specified thing in the handoff and the one most
// likely to be built wrong; there is exactly one copy of it, here.

// The row's last ten games as bars, oldest to newest, with the prop line
// drawn across them as a dashed rule.
//
// ---- The axis ----
//
// **Windowed, not grounded at zero.** The axis brackets the range the games
// and the line actually occupy -- `lo = min(values, line)`, `hi = max(values,
// line)` -- padded 18% on each side, and everything is drawn on a pedestal so
// the shortest bar is still 8px of visible bar rather than a sliver.
//
// This is the third scaling this component has had, and the reasoning behind
// each replacement is worth keeping so none of them gets reinstated by
// accident:
//
//   1. Height as *margin from the line*, floored at 30%. Compressed both
//      directions to magnitude, so a 12-catch game and a 0-catch game could
//      render at similar heights on opposite colours -- and it could not draw
//      a line at all, because "distance from the line" has no position *for*
//      the line.
//   2. Height as the raw stat value from a zero baseline. Correct in the
//      small-number markets it was checked against (hits, strikeouts, points)
//      and badly wrong in the large ones: on a 257.5 passing-yards prop every
//      game sits between 240 and 280, so ten bars all landed within a few
//      pixels of each other and the graph said nothing. Zero-basing spends
//      the whole plot on empty axis nobody's games occupy.
//   3. This one. The trade is real and worth stating: bar height is no longer
//      proportional to the stat, so a 3-hit game is not visibly three times a
//      1-hit game. What it buys is that *margin over and under the line* --
//      the thing the graph exists to show -- stays legible whether the line
//      is 0.5 hits or 257.5 passing yards. Alex chose this trade knowingly on
//      2026-08-21; the handoff's own note is "a zero-based axis buries the
//      variation".
//
// Because the axis is windowed, the bars alone can't be read as quantities --
// which is why every row still prints its counts underneath and the per-game
// values stay in the hover popover.
//
// ---- The drag step ----
//
// `step` widens with the magnitude of the market: 0.5 under 25, 1 under 100,
// 5 at 100 and above. Half-yard increments on a passing-yards line meant a
// forty-step drag to ask a question worth asking.
//
// Steps are anchored on the *market* line rather than on 0.5, so the posted
// line is always on the grid and a small drag can return to it exactly. (The
// mock anchors on 0.5, which for a 257.5 line puts the nearest rungs at 255.5
// and 260.5 -- the posted number itself unreachable without a reset.)
//
// Binary markets have no magnitude to scale, so their bars stay full height
// and no line is drawn.
export const FORM_PLOT_H = 58;
// Floor under every bar. A zero-value game has to remain a visible mark: an
// absent bar reads as missing data, which is the one thing it must never say.
const FORM_PEDESTAL = 8;

export function feedFormScale(recent, line, isBinary) {
  const plot = FORM_PLOT_H - FORM_PEDESTAL;
  if (isBinary) {
    return { unit: plot, y: () => FORM_PLOT_H, step: 0.5, dragMax: 1, axisMin: 0, span: 1 };
  }
  const vals = (recent || []).map((g) => g.v);
  // `line` is included in both bounds on purpose: a line outside the range of
  // every game still has to be drawable, and its rule has to land inside the
  // plot rather than clipped against an edge.
  const lo0 = Math.min(line, ...vals);
  const hi0 = Math.max(line, ...vals);
  // The 0.6 floor keeps a flat row -- ten identical values, or a single game
  // -- from collapsing to a zero-width span and dividing by nothing.
  const pad = Math.max((hi0 - lo0) * 0.18, 0.6);
  const axisMin = lo0 - pad;
  const span = (hi0 + pad) - axisMin;
  // Whole numbers only -- a deliberate departure from the mock, which uses
  // 0.5 under 25. Every line this app posts is an X.5 and steps are taken off
  // that line, so a 0.5 step would put half the rungs on whole numbers:
  // 2.5 -> 3.0 -> 3.5 -> 4.0. A whole-number line can push, which is the whole
  // reason the half-value rule exists -- and the mock states that rule itself,
  // a few lines above its own step table. 1 keeps 0.5 -> 1.5 -> 2.5; 5 keeps
  // 257.5 -> 262.5.
  const step = hi0 >= 100 ? 5 : 1;
  return {
    axisMin, span, step,
    unit: plot / span,
    y: (v) => FORM_PEDESTAL + Math.round(((v - axisMin) / span) * plot),
    // One step of headroom above the best game, so the reader can ask "what
    // if it were higher than he's ever gone" and see every bar go red.
    dragMax: (vals.length ? Math.max(...vals) : line) + step,
  };
}

export default function FeedFormStrip({
  // 60px bar row, 5px gaps, 54px right gutter for the line tag -- the
  // handoff's "full-size treatment". The axis itself is plotted over
  // FORM_PLOT_H (58), the figure the spec's arithmetic uses, so the tallest
  // bar clears the top of the row by a hair instead of touching it.
  //
  // The phone card passes the smaller set (48 / 4 / 42) and `tag` without
  // `onDragLine`: the design draws the line tag there but specifies dragging
  // only on desktop, and a 24px handle is not a touch target. `caption` is
  // off there too -- the phone card states its sample beside the rate figure
  // and its streak in the meta line, so the desktop caption would be the
  // third printing of the same two numbers.
  r, direction, streak = 0, height = 60, gap = 5, gutter = 54,
  tag = false, caption = true,
  line, onDragLine, onResetLine, adjusted,
}) {
  const recent = r.recent;
  if (!recent || !recent.length) return null;
  // `line` is the live (possibly dragged) value; r.line is what the market
  // posted. Falling back to r.line keeps every non-draggable caller working
  // unchanged.
  const lineVal = line == null ? r.line : line;
  const { y: barY } = feedFormScale(recent, lineVal, r.isBinary);

  const hits = recent.map((g) => feedIsHit(g.v, lineVal, r.isBinary, direction));
  const hitCount = hits.filter(Boolean).length;

  // The trailing run is recomputed from these bars rather than taken from
  // `streak` whenever the line has been dragged -- a streak counted against
  // the posted line would contradict the bars now on screen.
  let runLength = 1;
  for (let i = hits.length - 2; i >= 0 && hits[i] === hits[hits.length - 1]; i--) runLength++;
  const runHit = hits[hits.length - 1];
  const useLiveRun = adjusted || streak == null;
  const shownRun = useLiveRun ? runLength : Math.min(Math.abs(streak), recent.length);
  const shownRunHit = useLiveRun ? runHit : streak > 0;
  const showRun = shownRun >= 3;
  const runColor = shownRunHit ? "var(--pos)" : "var(--neg)";

  const hasPlayoff = recent.some((g) => g.po);
  const draggable = !!onDragLine && !r.isBinary;
  // The tag is what makes the gutter necessary, so both follow the same flag.
  const showTag = !r.isBinary && (draggable || tag);
  // The rule sits at the line's own position on the same windowed axis the
  // bars are drawn on, so "clears the line" is literally "taller than the
  // dashes" at every market size.
  const lineY = barY(lineVal);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ position: "relative", paddingRight: showTag ? gutter : 0 }}>
        <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap, height }}>
          {recent.map((g, i) => (
            <div
              key={i}
              title={`${g.opp ? `vs ${g.opp} · ` : ""}${g.v}${g.po ? " · playoff game" : ""}`}
              style={{
                flex: 1,
                height: r.isBinary
                  ? Math.max(4, Math.round((hits[i] ? 1 : 0.35) * height))
                  : barY(g.v),
                borderRadius: "2px 2px 0 0",
                boxSizing: "border-box",
                background: hits[i] ? "var(--pos)" : "transparent",
                border: hits[i] ? "none" : "1.5px solid var(--neg)",
              }}
            />
          ))}
          {!r.isBinary && (
            <span style={{
              position: "absolute", left: 0, right: showTag ? -gutter : 0, bottom: lineY,
              // White, not accent: at accent lightness the rule disappeared
              // against the green fills. It goes accent-ink only once the
              // reader has dragged it off the posted line.
              borderTop: `1.5px dashed ${adjusted ? "var(--amber-ink, var(--amber))" : "var(--text)"}`,
              pointerEvents: "none",
            }} />
          )}
          {showTag && (
            <span
              onMouseDown={onDragLine || undefined}
              onDoubleClick={onResetLine || undefined}
              title={draggable ? "Drag to move the line · double-click to reset" : "The prop line"}
              className="pp-mono"
              style={{
                position: "absolute", right: -gutter, bottom: lineY, transform: "translateY(50%)",
                // Solid accent by default, per the handoff -- it re-tints
                // with the user's chosen hue and never encodes hit/miss.
                // Off-market it inverts to accent-ink on the row ground, the
                // same switch the dashed rule and the Line column make, so
                // an adjusted row is legible as adjusted at a glance.
                background: adjusted ? "transparent" : "var(--amber)",
                color: adjusted ? "var(--amber-ink, var(--amber))" : "var(--accent-on)",
                border: `1px solid ${adjusted ? "var(--amber)" : "var(--amber)"}`,
                borderRadius: 3, padding: "3px 6px", fontSize: 10.5,
                fontVariantNumeric: "tabular-nums", userSelect: "none",
                cursor: draggable ? "ns-resize" : "default",
              }}
            >
              {Number(lineVal).toFixed(1)}
            </span>
          )}
        </div>
        {/* Playoff games, marked. Decision 1 says a playoff game has to look
             like one wherever a game appears, and these bars are four pixels
             wide -- there is no room for the "PO" tag the chart axis and the
             game-log table use, so it becomes a dot on its own track, on the
             same flex layout as the bars so it sits exactly under one.

             Rendered only when the window actually contains a playoff game,
             so the overwhelming majority of rows keep their current height
             and nothing shifts. */}
        {hasPlayoff && (
          <div style={{ display: "flex", gap, marginTop: 3 }} aria-hidden>
            {recent.map((g, i) => (
              <span key={i} style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                <span style={{
                  width: 3, height: 3, borderRadius: "50%",
                  // Neutral ink: green and red are already spoken for by
                  // cleared/missed on the bar directly above.
                  background: g.po ? "var(--dim)" : "transparent",
                }} />
              </span>
            ))}
          </div>
        )}
        {/* The run rule sits under the trailing bars only, so the words
             below tie to the games above. Laid out on the same flex track
             as the bars so it lines up exactly at any column width. */}
        {showRun && (
          <div style={{ display: "flex", gap, marginTop: 5 }}>
            <span style={{ flex: recent.length - shownRun }} />
            <span style={{ flex: shownRun, height: 2, borderRadius: 1, background: runColor }} />
          </div>
        )}
      </div>
      {/* Counts first: "N of M" is the sample the bars above actually draw,
           shown every time so a hit rate is never on screen without its own
           sample size next to it. */}
      {caption && (
        <div className="pp-mono" style={{ fontSize: 12, letterSpacing: "0.06em", color: showRun ? runColor : "var(--dim)", whiteSpace: "nowrap", marginTop: 9 }}>
          {hitCount} of {recent.length}{showRun ? ` · ${shownRun} ${shownRunHit ? "straight" : "cold"}` : ""}
        </div>
      )}
    </div>
  );
}
