import React from "react";
import { feedIsHit } from "./lib/altLines.js";

// --------------------------------------------------------------------------
// The form graph
// --------------------------------------------------------------------------
// Lifted out of PropLedger.jsx so the prop feed, the mobile prop detail and
// the landing page's example card all plot the same player identically. The
// axis is the single most-specified thing in the handoff and the one most
// likely to be built wrong; there is exactly one copy of it, here.

// The row's last N games as bars, oldest to newest, with the prop line drawn
// across them as a dashed rule.
//
// ---- The axis ----
//
// **Windowed, not grounded at zero.** The axis brackets the range the games
// and the line actually occupy -- `lo = min(values, line)`, `hi = max(values,
// line)` -- padded 18% on each side, and everything is drawn on a pedestal so
// the shortest bar is still a visible bar rather than a sliver.
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
// ---- Two places this deliberately overrules the v2 README ----
//
// Both were raised with Alex on 2026-08-21 and both were decided in favour of
// the code. The README is the spec everywhere else; these two lines of it are
// wrong and are being corrected in the bundle itself. Noted here so the next
// reader finds a decision rather than what looks like drift:
//
//   * **Drag step.** The README's step table says 0.5 / 1 / 5 anchored on
//     half-values. A 0.5 step off an X.5 line lands half its rungs on whole
//     numbers -- 2.5 -> 3.0 -> 3.5 -- and a whole-number line can push, which
//     is the reason the README states a half-value rule two paragraphs above
//     its own table. It also puts the posted number out of reach: on a 257.5
//     line the nearest rungs become 255.5 and 260.5. Whole steps anchored on
//     the *market* line, below. `lib/altLines.js` makes the same call for the
//     same reason and states it as a correctness constraint rather than a
//     taste one: no logged integer can sit exactly on an X.5 line, so there
//     are no pushes and `1 - rate` is the exact Under rate.
//   * **Axis padding.** The README gives `span = max(hi-lo, 1) * 1.25` and
//     `axisMin = lo - max(hi-lo, 1) * 0.18`, which pads 18% below but only
//     ~7% above, and guards the degenerate case with an absolute floor of 1
//     -- too coarse for a market whose whole range is under a point. The 0.6
//     floor on the *pad* below handles the same case (ten identical values,
//     or a single game, collapsing the span to zero) at every market size.
export const FORM_PEDESTAL = 10;

// Build once, reuse at five sizes -- the handoff's table, in one place, so a
// caller asks for a context rather than re-deriving pixel pairs. `height` is
// what y() tops out at and `pedestal` is the floor under a bar; the plot the
// axis is drawn over is the difference, so the tallest bar reaches exactly
// the top of the row and the shortest is still a mark.
export const FORM_SIZES = {
  hero:   { height: 120, pedestal: 16, gap: 6, gutter: 54 },
  player: { height: 224, pedestal: 30, gap: 6, gutter: 54 },
  feed:   { height: 60,  pedestal: 10, gap: 5, gutter: 54 },
  board:  { height: 64,  pedestal: 12, gap: 4, gutter: 44 },
  mobile: { height: 52,  pedestal: 10, gap: 4, gutter: 42 },
};

// The value y() tops out at for the default (feed) size. Exported for the
// callers that draw their own miniature bars off feedFormScale's `y` and need
// to know what to scale it against.
export const FORM_PLOT_H = FORM_SIZES.feed.height;

// A short sample must not get fat bars, so the grid has a floor of ten
// columns whatever the sample is. Windows longer than ten (L20, L40) expand
// past it -- the floor exists to stop four games filling the row, not to cap
// how much log a player-detail graph can show.
//
// It is a default, not a constant: a surface drawing a different window passes
// its own `slots`. The Board slices to eight games, so a board card left at
// ten would label two columns "no games yet" about a player who has more --
// a false statement about the log rather than an honest thin sample.
const MIN_SLOTS = 10;

export function feedFormScale(recent, line, isBinary, opts = {}) {
  const height = opts.height ?? FORM_SIZES.feed.height;
  const pedestal = opts.pedestal ?? FORM_SIZES.feed.pedestal;
  const plot = height - pedestal;
  if (isBinary) {
    return { unit: plot, y: () => height, step: 0.5, dragMax: 1, axisMin: 0, span: 1 };
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
  // Whole numbers only, anchored on the market line -- see the note above.
  const step = hi0 >= 100 ? 5 : 1;
  return {
    axisMin, span, step,
    unit: plot / span,
    y: (v) => pedestal + Math.round(((v - axisMin) / span) * plot),
    // One step of headroom above the best game, so the reader can ask "what
    // if it were higher than he's ever gone" and see every bar go red.
    dragMax: (vals.length ? Math.max(...vals) : line) + step,
  };
}

export default function FeedFormStrip({
  // `size` names one of the five contexts above. Explicit height/gap/gutter
  // still win, so the call sites that predate the size table keep rendering
  // exactly as they did until their own screen is rebuilt.
  size = "feed",
  r, direction, streak = 0,
  height, pedestal, gap, gutter, slots,
  tag = false, caption = true,
  line, onDragLine, onResetLine, adjusted,
}) {
  const preset = FORM_SIZES[size] || FORM_SIZES.feed;
  const H = height ?? preset.height;
  const P = pedestal ?? preset.pedestal;
  const G = gap ?? preset.gap;
  const GUT = gutter ?? preset.gutter;

  const recent = r.recent;
  if (!recent || !recent.length) return null;
  // `line` is the live (possibly dragged) value; r.line is what the market
  // posted. Falling back to r.line keeps every non-draggable caller working
  // unchanged.
  const lineVal = line == null ? r.line : line;
  const { y: barY } = feedFormScale(recent, lineVal, r.isBinary, { height: H, pedestal: P });

  const hits = recent.map((g) => feedIsHit(g.v, lineVal, r.isBinary, direction));
  const hitCount = hits.filter(Boolean).length;

  const n = recent.length;
  // Fixed columns, never `flex: 1` per bar. With flex, a four-game sample
  // renders bars two and a half times wider than a ten-game one, which makes
  // the *thinnest* sample the loudest thing on the screen -- the exact
  // opposite of what this product says about small samples. The shortfall
  // stays visibly empty instead.
  const cols = Math.max(slots ?? MIN_SLOTS, n);
  const shortfall = cols - n;

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
  const runFill = shownRunHit ? "var(--pos-solid, var(--pos))" : "var(--neg)";
  const runInk = shownRunHit ? "var(--pos)" : "var(--neg)";

  const hasPlayoff = recent.some((g) => g.po);
  const draggable = !!onDragLine && !r.isBinary;
  // The tag is what makes the gutter necessary, so both follow the same flag.
  const showTag = !r.isBinary && (draggable || tag);
  // The rule sits at the line's own position on the same windowed axis the
  // bars are drawn on, so "clears the line" is literally "taller than the
  // dashes" at every market size.
  const lineY = barY(lineVal);
  const grid = { display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: G };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ position: "relative", paddingRight: showTag ? GUT : 0 }}>
        <div style={{ ...grid, position: "relative", alignItems: "end", height: H }}>
          {recent.map((g, i) => (
            <div
              key={i}
              title={`${g.opp ? `vs ${g.opp} · ` : ""}${g.v}${g.po ? " · playoff game" : ""}`}
              style={{
                // Explicit column, not auto-placement. The dashed-rule
                // overlay below is explicitly placed across columns 1..n, and
                // an *auto*-placed item is never allowed to overlap one that
                // is explicitly placed -- so with `auto` here the bars get
                // pushed out into implicit columns past the end of the grid,
                // where they have no width and the graph draws nothing at
                // all. Overlap is legal once both sides are explicit, which
                // is what lets the rule cross the bars.
                gridRow: 1, gridColumn: i + 1,
                height: r.isBinary
                  ? Math.max(4, Math.round((hits[i] ? 1 : 0.35) * H))
                  : barY(g.v),
                borderRadius: "2px 2px 0 0",
                boxSizing: "border-box",
                // Fill = cleared, outline = fell short, so the two states are
                // told apart by shape and not by hue alone.
                background: hits[i] ? "var(--pos-solid, var(--pos))" : "transparent",
                border: hits[i] ? "none" : "1.5px solid var(--neg)",
              }}
            />
          ))}

          {/* The games this window does not have. Held open and labelled
              rather than closed up: an absent column is a fact about the
              sample, and collapsing it would hide the very thing the minimum
              sample rule exists to make visible. The label needs two columns
              of room to sit in; under that the dashed divider carries it
              alone rather than spilling across the bars. */}
          {shortfall > 0 && (
            <div
              style={{
                gridRow: 1, gridColumn: `${n + 1} / -1`, alignSelf: "stretch",
                borderLeft: "1px dashed var(--line)",
                display: "flex", alignItems: "center", justifyContent: "center",
                minWidth: 0, overflow: "hidden",
              }}
            >
              {shortfall >= 2 && (
                <span
                  className="pp-mono"
                  style={{
                    fontSize: 9.5, letterSpacing: "0.08em", color: "var(--dim)",
                    whiteSpace: "nowrap", textAlign: "center", padding: "0 2px",
                  }}
                >
                  no games yet
                </span>
              )}
            </div>
          )}

          {!r.isBinary && (
            <div
              style={{ gridRow: 1, gridColumn: `1 / ${n + 1}`, alignSelf: "stretch", position: "relative", pointerEvents: "none" }}
              aria-hidden
            >
              <span style={{
                // Stops at the plot's right edge, never in the gutter. It used
                // to run the full gutter width, which put the dashes straight
                // through the drag handle's digits -- and the handle is
                // transparent once the line is off-market, so there was
                // nothing masking them.
                position: "absolute", left: 0, right: 0, bottom: lineY,
                // Always white. Not accent, at any line: at accent lightness
                // the rule disappears against the green fills, and a rule that
                // changes colour when the reader drags it reads as if the
                // *line* means something different, which it does not -- the
                // handle and the Line column already say it has been moved.
                borderTop: "1.5px dashed var(--text)",
              }} />
            </div>
          )}

          {showTag && (
            <span
              onMouseDown={onDragLine || undefined}
              onDoubleClick={onResetLine || undefined}
              title={draggable ? "Drag to move the line · double-click to reset" : "The prop line"}
              className="pp-mono"
              style={{
                position: "absolute", right: -GUT, bottom: lineY, transform: "translateY(50%)",
                // Solid accent by default, per the handoff -- it re-tints
                // with the user's chosen hue and never encodes hit/miss.
                // Off-market it inverts to accent-ink on the row ground, the
                // same switch the dashed rule and the Line column make, so
                // an adjusted row is legible as adjusted at a glance.
                background: adjusted ? "transparent" : "var(--amber)",
                color: adjusted ? "var(--amber-ink, var(--amber))" : "var(--accent-on)",
                border: "1px solid var(--amber)",
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
             like one wherever a game appears, and these bars are a few pixels
             wide -- there is no room for the "PO" tag the chart axis and the
             game-log table use, so it becomes a dot on its own track, on the
             same grid as the bars so it sits exactly under one.

             Rendered only when the window actually contains a playoff game,
             so the overwhelming majority of rows keep their current height
             and nothing shifts. */}
        {hasPlayoff && (
          <div style={{ ...grid, marginTop: 3 }} aria-hidden>
            {recent.map((g, i) => (
              <span key={i} style={{ gridColumn: i + 1, display: "flex", justifyContent: "center" }}>
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
             below tie to the games above. Laid out on the same grid as the
             bars so it lines up exactly at any column width.

             The track is always present, empty when there is no run. It used
             to be mounted only when there was one, which cost 7px of height --
             and the run appears and disappears *while the line is being
             dragged*, so the row grew and shrank under the cursor. A fixed
             2px track that is sometimes blank costs the same 7px on every row
             and never moves. */}
        <div style={{ ...grid, marginTop: 5 }} aria-hidden={!showRun}>
          <span style={{
            gridColumn: showRun ? `${n - shownRun + 1} / ${n + 1}` : "1 / 2",
            height: 2, borderRadius: 1,
            background: showRun ? runFill : "transparent",
          }} />
        </div>
      </div>

      {/* Counts first: "N of M" is the sample the bars above actually draw,
           shown every time so a hit rate is never on screen without its own
           sample size next to it. */}
      {caption && (
        <div className="pp-mono" style={{ fontSize: 12, letterSpacing: "0.06em", color: showRun ? runInk : "var(--dim)", whiteSpace: "nowrap", marginTop: 9 }}>
          {hitCount} of {recent.length}{showRun ? ` · ${shownRun} ${shownRunHit ? "straight" : "cold"}` : ""}
        </div>
      )}
    </div>
  );
}
