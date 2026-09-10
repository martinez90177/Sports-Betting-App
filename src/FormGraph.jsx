import React from "react";
import { feedIsHit } from "./lib/altLines.js";
import { venueWord } from "./lib/venue.js";

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
// Scaling 2 has now been proposed twice. A v4 spec on 2026-09-05 asked for
// `9 + v * (52 / max)` and described it as the formula already in this file,
// which it has not been since 2026-08-21 -- it is item 2 above, word for word.
// It was declined again, on the same grounds: it is right in the markets it
// gets checked against (hits, points, strikeouts) and silently wrong in the
// ones nobody spot-checks, which is what makes it keep coming back. If it is
// ever genuinely wanted, the thing to change is this comment first.
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
  feed:   { height: 60,  pedestal: 10, gap: 6, gutter: 54 },
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
  // `line` is included in the top bound on purpose: a line dragged above every
  // game still has to be drawable, and its rule has to land inside the plot
  // rather than clipped against an edge.
  const hi0 = Math.max(line, ...vals);

  // The axis starts at zero, and that is a deliberate departure from the mock.
  //
  // The mock computes `axisMin = min(line, ...values) - pad` and the app
  // transcribed it faithfully. On a market with a high floor that truncates the
  // axis badly: Matthew Stafford's last ten passing games run 243 to 457
  // against a 253.5 line, so the axis began at 204 and a 258-yard game rendered
  // at 18% of the box while 457 rendered at 87%. Alex, 2026-09-10: *"259 and
  // 258 are high passing yards but the way its set up it looks miniscule."*
  //
  // Quite. A bar's length is how a bar chart says how big a number is, and an
  // axis that starts near the smallest value makes every ordinary game look
  // like a failure next to one outlier. Zero-based, the same ten games read
  // 49%, 52% … 92% -- the variation is still plainly there, and none of it
  // lies about the ratios.
  //
  // What is NOT lost by this: the over/under read. That comes from the bar's
  // colour and from where it sits against the dashed rule, both of which move
  // with the same scale. A game that barely cleared still barely clears.
  //
  // Headroom stays, measured off the top rather than off the range, so the
  // tallest bar is never flush against the ceiling and the drag handle has
  // somewhere to go. The 0.6 floor keeps a flat row -- ten identical values, or
  // a single game -- from collapsing to a zero-width span and dividing by
  // nothing.
  const pad = Math.max(hi0 * 0.08, 0.6);
  const axisMin = 0;
  const span = hi0 + pad;
  // The drag grid: one unit, on every market.
  //
  // It was 5 above a hundred, and that made the control unable to reach the
  // lines the market actually posts. Snapping is relative to the posted line
  // (see the drag handlers) to keep every stop a half-value, so a step of 5 off
  // 257.5 could only ever land on 252.5 or 262.5 -- while DraftKings, Outlier
  // and PropsMadness all post 249.5 and 259.5. Alex, 2026-09-09: *"if a
  // player's standard line is 257.5, the person is never able to drag it to
  // 250 on the dot."* Quite -- nor to any number a book would price.
  //
  // Neither rival has a draggable line to copy; they offer discrete alt lines
  // instead. What is copied is their convention: every line they post is a
  // half-value, and a step of 1 off an X.5 line keeps every stop on that grid,
  // which is also what preserves the no-push guarantee rungStep documents.
  const step = 1;
  // Axis labels keep the coarser grid -- a scale reading 394 / 281 / 167 is
  // harder to read than 390 / 280 / 170, and nothing snaps to it.
  const tickStep = hi0 >= 100 ? 5 : 1;
  // Headroom above the best game, so the reader can ask "what if it were higher
  // than he's ever gone" and see every bar go red. Kept off the drag step,
  // which is now too fine to be worth a whole unit of reach.
  const headroom = hi0 >= 100 ? 5 : 1;
  return {
    axisMin, span, step, tickStep,
    unit: plot / span,
    y: (v) => pedestal + Math.round(((v - axisMin) / span) * plot),
    dragMax: (vals.length ? Math.max(...vals) : line) + headroom,
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
  // Print each game's value inside its own bar. Opt-in rather than always on:
  // a numeral needs a bar wide enough to hold it, and the board card (64px
  // over eight columns) and the phone strip (48px) do not have one. The feed
  // row asks for it; nothing else does.
  values = false,
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
  const poCount = recent.reduce((n, g) => n + (g.po ? 1 : 0), 0);
  const runFill = shownRunHit ? "var(--pos-solid, var(--pos))" : "var(--neg)";
  const runInk = shownRunHit ? "var(--pos)" : "var(--neg)";

  // Values inside the bars, but only where a bar can actually hold one.
  //
  // Measured rather than assumed: at the feed's FORM track (180-250px) ten
  // columns and nine 6px gaps leave each bar 7.2px at the minimum and 14.2px
  // at the maximum, while a 9px mono numeral is 5.4px per digit. One digit
  // fits at every width; three digits need 16.3px and fit at none. Passing
  // yards, receiving yards and any other three-figure market would print
  // "241" clipped to "24" -- a wrong number, which this app does not do.
  //
  // So the numerals are dropped for the whole strip, not per bar: a column of
  // bars where some carry a value and some do not reads as missing data.
  const showValues = values && recent.every((g) => Math.abs(g.v) < 100);

  // Playoff games, as bands rather than dots.
  //
  // They were a 3px dot on a track of their own under each playoff bar, and
  // Alex: *"the dots is a little silly."* Fair — a dot is a mark you have to
  // already know the meaning of, it sat on a track that cost every affected
  // row 6px, and nothing on the screen said what it was for.
  //
  // A tinted band behind the columns instead. It is the standard chart device
  // for "this stretch is a different phase", it reads at any bar width
  // (these are 7-14px, which is why the "PO" tag used on the chart axis and
  // in the game log could not come along), it groups a run into one shape
  // rather than three unexplained specks, and it costs no vertical space at
  // all. Where a band is wide enough to hold them, the letters PO ride at its
  // top — so the thing finally says what it is.
  //
  // Built as runs, not one span: a window that reaches back across a season
  // boundary can hold two separate postseasons, and one band stretched over
  // the regular-season games between them would be a claim about games that
  // were not playoff games.
  const playoffRuns = [];
  recent.forEach((g, i) => {
    if (!g.po) return;
    const last = playoffRuns[playoffRuns.length - 1];
    if (last && last.to === i - 1) last.to = i;
    else playoffRuns.push({ from: i, to: i });
  });
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
          {recent.map((g, i) => {
            // A game with none of the stat gets no box at all. An outline at
            // pedestal height reads as a value the player did not put up; the
            // numeral standing on the pedestal says nothing but the truth.
            const zero = !r.isBinary && g.v === 0;
            return (
              <div
                key={i}
                title={`${g.opp ? `${venueWord(g.home)}${g.opp} · ` : ""}${g.v}${g.po ? " · playoff game" : ""}`}
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
                  height: zero
                    ? P
                    : r.isBinary
                      ? Math.max(4, Math.round((hits[i] ? 1 : 0.35) * H))
                      : barY(g.v),
                  borderRadius: 2,
                  boxSizing: "border-box",
                  // Fill = cleared, outline = fell short, so the two states are
                  // told apart by shape and not by hue alone -- which is what
                  // keeps the strip readable under the "No hue" palette.
                  background: zero ? "transparent" : hits[i] ? "var(--pos-solid, var(--pos))" : "transparent",
                  border: zero ? "none" : hits[i] ? "1.5px solid var(--pos)" : "1.5px solid var(--neg)",
                  // The value rides at the bottom of its own bar, centred.
                  display: "flex", alignItems: "flex-end", justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {showValues && (
                  <span
                    className="pp-mono"
                    style={{
                      fontSize: 9, fontWeight: 600, lineHeight: 1, paddingBottom: 2,
                      whiteSpace: "nowrap",
                      // Mixed off --pos rather than frozen as a hex, so the ink
                      // stays dark against whatever the outcome palette makes
                      // the fill. On an outlined or absent bar there is no fill
                      // to sit on, so the numeral takes the outline's own hue.
                      color: zero || !hits[i]
                        ? "var(--neg)"
                        : "color-mix(in srgb, var(--pos) 15%, black)",
                    }}
                  >
                    {g.v}
                  </span>
                )}
              </div>
            );
          })}

          {/* The games this window does not have. Held open, not closed up:
              an absent column is a fact about the sample, and collapsing it
              would hide the very thing the minimum-sample rule exists to make
              visible.

              It used to print "no games yet" across that space. Alex:
              *"the no games yet being on the chart like that is kinda dumb."*
              It is — the words sit inside the plot, at the same size as
              nothing else there, competing with the bars for a fact the
              caption underneath already states exactly ("3 of 4"). The
              reserved space and its dashed edge say "nothing here" on their
              own, and the count says how much of the window is missing. */}
          {shortfall > 0 && (
            <div
              title={`${shortfall} of the ${cols} games this window asks for are not in the log`}
              style={{
                gridRow: 1, gridColumn: `${n + 1} / -1`, alignSelf: "stretch",
                borderLeft: "1px dashed var(--line)",
              }}
            />
          )}

          {/* The rule the bars stand on. Without it an outlined miss reads as
              a bar continuing below the frame, and a zero -- which draws no
              box at all -- has nothing to sit on. Spans the whole plot, the
              empty columns included, because the floor is a property of the
              strip rather than of the games that happen to fill it. */}
          <div
            style={{ gridRow: 1, gridColumn: "1 / -1", alignSelf: "stretch", position: "relative", pointerEvents: "none" }}
            aria-hidden
          >
            <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderTop: "1px solid var(--line)" }} />
          </div>

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
                width: 42, height: 28, boxSizing: "border-box",
                display: "flex", alignItems: "center", justifyContent: "center",
                // Solid accent by default, per the handoff -- it re-tints
                // with the user's chosen hue and never encodes hit/miss.
                // Off-market it fills with accent *ink* instead, which is the
                // same accent at a different lightness: a moved line reads as
                // moved from across the table without inventing a colour that
                // means "adjusted". It used to go transparent, which at a
                // glance looked like no tag at all.
                background: adjusted ? "var(--amber-ink)" : "var(--amber)",
                // --accent-on is computed for text on solid --amber and is the
                // right ink there. It is not computed for --amber-ink, which
                // is light in the dark theme and dark in the light one -- so
                // the moved tag takes the page ground, which is the opposite
                // of --amber-ink in both themes by construction.
                color: adjusted ? "var(--bg)" : "var(--accent-on)",
                border: "1px solid var(--amber)",
                borderRadius: 7, fontSize: 11, fontWeight: 600,
                fontVariantNumeric: "tabular-nums", userSelect: "none",
                cursor: draggable ? "ns-resize" : "default",
              }}
            >
              {Number(lineVal).toFixed(1)}
            </span>
          )}
        </div>

        {/* Playoff games, marked as a rule under the columns they cover.

             Three attempts to get this right. A 3px dot per game was "a
             little silly" -- a mark you have to already know the meaning of.
             A tinted band behind the columns read, at a single game, as a
             giant black bar sitting behind a real one: Alex, of Trevor
             Lawrence's last game, *"what is that giant black bar"*. Anything
             drawn *in* the plot competes with the bars, because in this chart
             a rectangle already means a number.

             So it lives under the plot, where nothing else does: a 2px rule
             spanning each run of playoff games, on the same grid as the bars
             so it sits exactly under them. The caption names it in words, so
             nobody has to work out what a grey line means.

             Runs rather than one span: a window reaching across a season
             boundary can hold two postseasons, and one rule stretched over
             the regular-season games between them would be a claim about
             games that were not playoff games. */}
        {playoffRuns.length > 0 && (
          <div style={{ ...grid, marginTop: 3 }} aria-hidden>
            {playoffRuns.map((run) => (
              <span
                key={`po-${run.from}`}
                style={{
                  gridColumn: `${run.from + 1} / ${run.to + 2}`,
                  height: 2, borderRadius: 1, background: "var(--dim)",
                }}
              />
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
          {/* The rule under the bars says *which* games; this says what the
               rule means, in the same place the sample and the streak are
               already stated. A grey line nobody can name is the dot problem
               again with a different shape. */}
          {hitCount} of {recent.length}
          {showRun ? ` · ${shownRun} ${shownRunHit ? "straight" : "cold"}` : ""}
          {poCount > 0 ? ` · ${poCount} PO` : ""}
        </div>
      )}
    </div>
  );
}
