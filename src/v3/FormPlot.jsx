import React from "react";
import { feedFormScale } from "../FormGraph.jsx";

// The v3 form graph, at whichever size a screen asks for.
//
// One component, because the mocks draw one: `PropPalace Mobile v3.dc.html`
// builds the Player Detail plot and every Prop Feed row's strip from the same
// four helpers (`track`, `bars`, `rule`, `handle`) with different numbers. Two
// copies of this would be two chances for a bar and its caption to disagree.
//
// The mock's own `h(v, span)` is `round(9 + (v/5) * span)` -- a hardcoded 0-5
// scale, because its placeholder market is total bases. That is the one thing
// in here NOT transcribed: the real axis is margin-from-the-line and comes
// from `FormGraph.jsx`'s `feedFormScale`, which `player-detail-handoff.md`
// section 3 says by name not to re-derive. Passing `height = span + PEDESTAL`
// and `pedestal = PEDESTAL` reproduces the mock's pixel geometry exactly while
// the axis stays the app's.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

// The floor under a bar, shared by both sizes in the mock's `h()`.
export const PEDESTAL = 9;

// `axisW` is a left gutter for the value scale, and only the desktop plot has
// one -- the two phone sizes have no width to spend on it.
export const PLOT = {
  // Player Detail (frame 1c): a 176px box over a 146px span, 52px gutter.
  player: { plotH: 176, span: 146, gutter: 52, handleW: 46, handleH: 30, trackW: 261, axisW: 0, zones: true },
  // A Prop Feed row (frame 1b): 74px box, 52px span, 46px gutter.
  //
  // Crests only under the bars, at every width. The box is a fixed 74px and
  // was sized for the crest row the mock draws at 390; on a wider phone-layout
  // screen (a phone on its side, a small tablet) the columns crossed the abbr
  // and date thresholds, 53px of labels moved into a 74px box, and the bars
  // were pushed up through the player's name while ten full dates ran into
  // each other. The player page is where the dates are.
  feed: { plotH: 74, span: 52, gutter: 46, handleW: 42, handleH: 28, trackW: 265, axisW: 0, crestOnly: true },
  // Desktop Player Detail (`PropPalace Desktop v3.dc.html` frame 1a): the
  // frame's own 268px box over a 224px span, 58px gutter.
  //
  // This was briefly 330/250 with a 34px axis gutter, on 2026-09-09, because
  // the labels under the bars were overlapping the card above. Growing the box
  // was treating the symptom: the real fault was `layFor` guessing the label
  // stack's height instead of measuring it, and that fix (COL_GAP / CREST_PX /
  // CREST_MT / LABEL_LINE, below) is what actually stopped the overlap and is
  // kept. The size went back to the frame -- see docs/V3_PARKED_CHANGES.md B3.
  //
  // The value-scale gutter (B4) is back, by Alex's call rather than by
  // drift. 2026-09-24, pointing at Outlier's chart: *"maybe also add y axis
  // values somewhere to help make this look less plain ... it feels like my
  // charts on player detail pages are missing some life."* Same 268px box.
  desktop: { plotH: 268, span: 224, gutter: 58, handleW: 52, handleH: 32, trackW: 780, axisW: 36, dateLadder: true, zones: true },
};

export const gapFor = (n) => (n <= 10 ? 6 : n <= 20 ? 4 : n <= 30 ? 3 : 2);

// The widest a bar is ever drawn, in columns of the track.
//
// Columns are `flex: 1 1 0`, so a one-game log took the whole track: a single
// green slab the width of the card with a `3` under it, which is what a Week 1
// NFL season looks like the moment a reader scopes to it. Alex, 2026-09-18:
// *"the 2026 thing being one giant bar like that looks silly ... find a
// workaround to make sure it doesn't show like this again."*
//
// The columns still divide the track evenly -- so the bars stay in order and
// spread across it rather than bunching at one end -- but a bar inside its
// column is capped at the width a *full* window would have given it, and
// centred in whatever is left. A chart of one game is now one bar the size of
// any other bar in the app, with air around it.
//
// Ten, because that is DEFAULT_WINDOW for all four sports: the cap is "as wide
// as this bar would be on a full page", so bar width stops encoding sample size
// and every window from one game to ten draws the same bar. Past ten the
// columns are already narrower than the cap and nothing here applies.
export const BAR_COLS = 10;

export const barMaxFor = (trackW, n) =>
  Math.max(0, (trackW - gapFor(n) * (BAR_COLS - 1)) / BAR_COLS);

// Labels are all-or-nothing per kind, gated on the column's measured width.
// A kind that fits for some columns and not others is the overlap the desktop
// graph shows at 100 games, so it is dropped for every column instead.
// Thresholds from player-detail-handoff.md section 3.
// What each label actually occupies, so labelH can be the real height rather
// than an estimate of it.
//
// It was an estimate -- 20 + 14 + 15 = 49 -- and the column it was measuring
// renders 3px of flex gap between every child plus a 2px offset over the crest,
// which comes to 53. The axis line is positioned at `bottom: labelH`, so those
// four missing pixels put the rule straight through the top of the team logos.
// Alex, 2026-09-09: *"there's a gray line separating the bottom of the bars and
// the logos/abbreviations, but its actually colliding."*
const COL_GAP = 3;
const CREST_PX = 16;
const CREST_MT = 2;
const LABEL_LINE = 13;

// The desktop plot's date ladder, after PropsMadness: a date under every bar
// for as long as one fits, and past that a date on every Nth bar rather than
// none at all. Alex, 2026-09-24: *"it's a little weird that it only becomes
// logos and not anything to do with dates."* The old single-line "Sep 15"
// needed a 44px column, so at 1920 wide L20 (43.6px) lost its dates by less
// than half a pixel, and at 1100 wide L20 (18.6px) lost every label.
//
//   40px+   crest, "@ CHC", "Sep 15"  -- "@ CHC" is the widest label, 37px
//   20px+   crest, "Sep" over "15"    -- stacked, 18px wide
//   below   "Sep" over "15" on every Nth bar, no crest, N set so the labels
//           sit at least DATE_PITCH apart
//
// All three tiers cost the same 53px or less, which is the room the frame's
// 268px box leaves under its tallest bar -- so the bars never lose height to
// the labels. Opt-in per size: the phone plot's 176px box has no such room.
const DATE_PITCH = 44;

export function layFor(n, trackW, g = {}) {
  const gap = gapFor(n);
  const per = n > 0 ? (trackW - gap * (n - 1)) / n : 0;
  const crest = per >= 20;
  if (g.dateLadder && n > 0) {
    const wide = per >= 40;
    const every = per >= 20 ? 1 : Math.max(2, Math.ceil(DATE_PITCH / (per + gap)));
    // Two text lines either way: "@ CHC" over "Sep 15", or "Sep" over "15".
    // Each line's COL_GAP is the gap above it, so without a crest the first
    // line's already covers the gap under the bar -- adding the trailing one
    // as well dropped every bar 3px below the rule.
    const stack = (crest ? CREST_MT + CREST_PX : 0) + 2 * (COL_GAP + LABEL_LINE);
    return { crest, abbr: wide, date: true, stacked: !wide, every, val: per >= 20, labelH: stack + (crest ? COL_GAP : 0) };
  }
  const abbr = per >= 34;
  const date = per >= 44;
  // The leading COL_GAP is the gap between the bar and the first label, so the
  // rule lands on the bars' own baseline and everything below it clears.
  const stack = (crest ? CREST_MT + CREST_PX : 0)
    + (abbr ? COL_GAP + LABEL_LINE : 0)
    + (date ? COL_GAP + LABEL_LINE : 0);
  return { crest, abbr, date, stacked: false, every: 1, val: per >= 20, labelH: stack ? stack + COL_GAP : 0 };
}

// "Sep" and "15" for the stacked label, read off the ISO date rather than
// split out of the display string, whose order is the reader's locale's.
function dateParts(iso) {
  if (!iso) return null;
  const t = Date.parse(typeof iso === "string" && iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return { mon: d.toLocaleDateString(undefined, { month: "short" }), day: String(d.getDate()) };
}

// Same URL pattern as lib/gamesData.js teamLogo(), drawn as a background so no
// hole ever lands in an src attribute. A logo is never identified by slug
// alone: cle, bos and min exist in several leagues, so a missing sport draws
// nothing rather than defaulting to one.
export function crest(slug, sport, size) {
  if (!slug || !sport) return { display: "none" };
  const px = `${size || 28}px`;
  return {
    display: "block", flex: "0 0 auto", width: px, height: px,
    backgroundImage: `url(https://a.espncdn.com/i/teamlogos/${sport}/500/${String(slug).toLowerCase()}.png)`,
    backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center",
  };
}

export default function FormPlot({
  size = "player",
  games,
  sport,
  line,
  marketLine,
  isBinary = false,
  direction = "over",
  onDragLine = null,
  onPickBar = null,
  picked = null,
  // Labels below the axis are the Player Detail plot's; a feed row draws the
  // same strip without them when it has no room. Passing `false` skips the
  // measurement entirely rather than measuring and then discarding.
  labels = true,
  // Desktop only, and deliberately: both need a hover-capable pointer or a
  // wide track (`desktop-handoff.md` §3, "Do not attempt them on touch").
  //
  // onZoom(from, to) receives an index range into `games`; the caller slices
  // its own already-windowed, already-filtered series, so the zoom composes
  // with every other control rather than replacing them.
  onZoom = null,
  // (index | null) => node, drawn as a hint that a click opens the detail
  // card. The card carries the data; this is a hint.
  tooltipFor = null,
}) {
  const g = PLOT[size] || PLOT.player;
  const [hover, setHover] = React.useState(null);
  const [dragSel, setDragSel] = React.useState(null);
  const [rawLine, setRawLine] = React.useState(null);
  const n = games.length;

  // Measured, not assumed. TRACK_W is only the first-paint estimate; the
  // scroller's own scrollbar alone moves the real track by ~18px, which is
  // enough to cross the 20px crest threshold on a long window.
  const trackRef = React.useRef(null);
  const [trackW, setTrackW] = React.useState(g.trackW);
  React.useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setTrackW((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Measured off the same track the columns are, so the cap is a real width
  // rather than a guess at one -- see BAR_COLS.
  const barMax = barMaxFor(trackW, n);
  const full = layFor(n, trackW, g);
  const lay = !labels
    ? { crest: false, abbr: false, date: false, stacked: false, every: 1, val: full.val, labelH: 0 }
    : g.crestOnly
      ? { ...full, abbr: false, date: false, labelH: full.crest ? CREST_MT + CREST_PX + COL_GAP : 0 }
      : full;
  const recent = React.useMemo(() => games.map((x) => ({ v: x.v })), [games]);
  const scale = feedFormScale(recent, line, isBinary, { height: g.span + PEDESTAL, pedestal: PEDESTAL });
  const hit = (v) => (direction === "under" ? v < line : v > line);

  // Gridlines on round numbers, the way a reader expects a scale to count:
  // 50 / 100 / 150 on passing yards, 1 / 2 / 3 on hits. Up to about eight, on
  // a step of 1, 2 or 5 times a power of ten -- five left a passing-yards
  // chart with three lines on it -- and never below 1, because a "0.5 hits"
  // gridline is a value no game can have.
  //
  // It used to be three marks -- top, middle, floor -- snapped to the axis's
  // own step, which printed numbers like 394 / 281 / 167 that a reader has to
  // do arithmetic with. Read off the same `scale` the bars are drawn with, so
  // a line always sits exactly where a bar of that value ends.
  //
  // Zero is left to the axis rule: the bars stand on a 9px pedestal, so value
  // zero is not the rule's own height and a "0" line would float above it.
  const axisTicks = React.useMemo(() => {
    if (isBinary || !(g.axisW > 0)) return [];
    const hi = scale.axisMin + scale.span;
    const raw = hi / 8;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    const step = Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow);
    const ticks = [];
    for (let t = step; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
    return ticks;
  }, [isBinary, g.axisW, scale.axisMin, scale.span]);
  const canDrag = !isBinary && marketLine != null && typeof onDragLine === "function";

  const posLine = rawLine != null ? rawLine : line;

  // The handle glides, the value snaps -- the same split PlayerDetailV2 makes,
  // and for the same reason: snapping the position makes the tag feel stuck to
  // a ratchet. Pointer events rather than mouse, because this one is dragged
  // with a thumb; `touchAction: none` is what stops the page scrolling under
  // it, and `preventDefault` stops the browser painting a text selection over
  // the plot.
  const startDrag = (e) => {
    e.stopPropagation();
    if (!canDrag) return;
    e.preventDefault();
    const { unit, step, dragMax } = feedFormScale(recent, marketLine, isBinary, { height: g.span, pedestal: 0 });
    const startY = e.clientY;
    const startVal = line;
    const maxSteps = Math.floor((dragMax - marketLine) / step);
    const minSteps = Math.ceil((0.25 - marketLine) / step);
    const loVal = marketLine + minSteps * step;
    const hiVal = marketLine + maxSteps * step;
    const move = (ev) => {
      const raw = startVal + (startY - ev.clientY) / unit;
      setRawLine(Math.min(hiVal, Math.max(loVal, raw)));
      const steps = Math.min(maxSteps, Math.max(minSteps, Math.round((raw - marketLine) / step)));
      onDragLine(marketLine + steps * step);
    };
    const up = () => {
      setRawLine(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // Ticks whose line would land above the box, or crowd the top edge.
  const shownTicks = axisTicks.filter((t) => scale.y(t) + lay.labelH <= g.plotH - 8);
  const lineY = scale.y(posLine) + lay.labelH;
  // The side of the line a game has to land on to count, washed green; the
  // other side red. Flips with the direction, so the Under view colours the
  // floor rather than the ceiling.
  const upper = direction === "under" ? "var(--neg)" : "var(--pos)";
  const lower = direction === "under" ? "var(--pos)" : "var(--neg)";
  const zoneBox = { position: "absolute", left: g.axisW || 0, right: g.gutter, pointerEvents: "none" };

  return (
    <div style={{ position: "relative", height: g.plotH }}>
      {/* Drawn first, so the bars paint over them. Strongest at the line and
          fading away from it, after Outlier: the reader sees at a glance which
          side of the line a bar has to reach, and the wash moves as the line
          is dragged. Alex, 2026-09-24: *"you see how the background on
          outlier has a green/red faded background depending on where the bar
          falls? Can you do something like this to spice up the chart?"* Not on
          a binary market, whose line is not a height. */}
      {g.zones && !isBinary && (
        <>
          <span
            style={{
              ...zoneBox, top: 0, bottom: lineY,
              background: `linear-gradient(to top, color-mix(in srgb, ${upper} 16%, transparent), color-mix(in srgb, ${upper} 2%, transparent))`,
            }}
          />
          <span
            style={{
              ...zoneBox, bottom: lay.labelH, height: Math.max(0, lineY - lay.labelH),
              background: `linear-gradient(to bottom, color-mix(in srgb, ${lower} 14%, transparent), color-mix(in srgb, ${lower} 3%, transparent))`,
            }}
          />
        </>
      )}
      {g.axisW > 0 && shownTicks.map((t) => (
        <span
          key={`grid-${t}`}
          style={{
            ...zoneBox, bottom: scale.y(t) + lay.labelH,
            borderTop: "1px solid color-mix(in srgb, var(--line) 70%, transparent)",
          }}
        />
      ))}
      <div
        ref={trackRef}
        onPointerDown={onZoom ? (e) => {
          // Both halves are required. preventDefault stops the browser
          // starting its own selection; userSelect below stops it painting
          // one anyway. Either alone still leaves the blue smear.
          e.preventDefault();
          const box = e.currentTarget.getBoundingClientRect();
          const at = (x) => {
            const frac = (x - box.left) / (box.width || 1);
            return Math.max(0, Math.min(n - 1, Math.floor(frac * n)));
          };
          const start = at(e.clientX);
          let last = start;
          const move = (ev) => { last = at(ev.clientX); setDragSel([Math.min(start, last), Math.max(start, last)]); };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            setDragSel(null);
            const lo = Math.min(start, last);
            const hi = Math.max(start, last);
            // A drag under two columns is a click, not a zoom -- so a
            // mis-aimed tap on a bar opens its card instead of collapsing
            // the graph to one game.
            if (hi - lo >= 1) onZoom(lo, hi);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        } : undefined}
        style={{
          position: "absolute", left: g.axisW || 0, right: g.gutter, top: 0, bottom: 0,
          display: "flex", gap: gapFor(n), alignItems: "flex-end", overflow: "hidden",
          // Without this the browser paints its own text selection over the
          // plot the moment a drag starts -- the blue smear.
          userSelect: "none",
          cursor: onZoom ? "crosshair" : undefined,
        }}
      >
        {games.map((gm, i) => {
          const v = gm.v;
          const isHit = hit(v);
          const away = gm.home === false;
          return (
            <div
              key={`${gm.iso || gm.date || i}-${i}`}
              onClick={onPickBar ? () => onPickBar(i) : undefined}
              onPointerEnter={tooltipFor ? () => setHover(i) : undefined}
              onPointerLeave={tooltipFor ? () => setHover(null) : undefined}
              style={{
                flex: "1 1 0", minWidth: 0, height: "100%", display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 3,
                cursor: onPickBar ? "pointer" : "default",
                background: (dragSel && i >= dragSel[0] && i <= dragSel[1])
                  ? "rgba(143,164,240,0.16)"
                  : picked === i || hover === i ? "rgba(255,255,255,0.05)" : "transparent",
                borderRadius: 3,
                userSelect: "none",
              }}
            >
              {/* A game with none of the stat gets no bar at all -- an outline
                  at zero height reads as a value. The numeral stands in. */}
              {lay.val && v === 0 && (
                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "var(--neg)", whiteSpace: "nowrap" }}>0</span>
              )}
              {v !== 0 && (
                <span
                  style={{
                    // Capped and centred in the column rather than filling it
                    // -- see BAR_COLS. Above ten games the column is narrower
                    // than the cap and this changes nothing.
                    display: "flex", width: "100%", maxWidth: barMax,
                    height: scale.y(v), borderRadius: 2, boxSizing: "border-box",
                    alignItems: "flex-end", justifyContent: "center",
                    // A cleared game is a solid fill; a miss is a *closed* red
                    // outline. Closed, not open-bottomed: an open box reads as
                    // a bar running off the frame.
                    ...(isHit
                      ? { background: "var(--pos)" }
                      : { background: "transparent", border: "1.5px solid var(--neg)" }),
                  }}
                >
                  {lay.val && (
                    <span
                      style={{
                        fontFamily: MONO, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                        paddingBottom: 3, color: isHit ? "#07120c" : "var(--neg)",
                      }}
                    >
                      {v}
                    </span>
                  )}
                </span>
              )}
              {lay.crest && <span role="img" style={{ ...crest(gm.opp, sport, 16), marginTop: 2 }} />}
              {lay.abbr && (
                <span
                  style={{
                    fontFamily: MONO, fontSize: 10, lineHeight: `${LABEL_LINE}px`, letterSpacing: "0.06em", whiteSpace: "nowrap",
                    color: away ? "var(--text-2)" : "var(--dim)", fontWeight: away ? 700 : 400,
                  }}
                >
                  {away ? "@ " : ""}{String(gm.opp || "").toUpperCase()}
                </span>
              )}
              {/* Explicit line boxes, because layFor above budgets for them.
                  Left to the font's own metrics these drift a pixel or two per
                  face and the axis rule stops meeting the bars. */}
              {lay.date && !lay.stacked && (
                <span style={{ fontFamily: MONO, fontSize: 10, lineHeight: `${LABEL_LINE}px`, color: "var(--dim)", whiteSpace: "nowrap" }}>{gm.date}</span>
              )}
              {lay.date && lay.stacked && (() => {
                // Thinned from the newest game back, so the last bar -- the
                // one a reader looks at first -- always carries its date. A
                // bar without one still gets the empty box, or its bar would
                // drop below the others' baseline.
                const parts = (n - 1 - i) % lay.every === 0 ? dateParts(gm.iso) : null;
                const line = { fontFamily: MONO, fontSize: 10, lineHeight: `${LABEL_LINE}px`, height: LABEL_LINE, color: "var(--dim)", whiteSpace: "nowrap" };
                return (
                  <span
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: COL_GAP,
                      // A thinned label is wider than its column and would be
                      // clipped by the track at either end, so the two end
                      // bars hold theirs inside the plot.
                      alignSelf: lay.every > 1 && i === n - 1 ? "flex-end" : lay.every > 1 && i === 0 ? "flex-start" : undefined,
                    }}
                  >
                    <span style={line}>{parts ? parts.mon : ""}</span>
                    <span style={line}>{parts ? parts.day : ""}</span>
                  </span>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* The value scale, where there is a gutter to put it in, level with
          its gridline. Skipped on a binary market, where the only values are
          0 and 1. */}
      {g.axisW > 0 && shownTicks.map((t) => (
        <span
          key={t}
          style={{
            position: "absolute", left: 0, width: g.axisW - 8, textAlign: "right",
            bottom: scale.y(t) + lay.labelH - 6,
            fontFamily: MONO, fontSize: 10, lineHeight: "12px", color: "var(--dim)",
            pointerEvents: "none", zIndex: 1, whiteSpace: "nowrap",
          }}
        >
          {t}
        </span>
      ))}

      {/* The axis the bars stand on. Without it an open-bottomed miss reads as
          a bar continuing below the frame. */}
      <span
        style={{
          position: "absolute", left: g.axisW || 0, right: g.gutter, bottom: lay.labelH,
          borderTop: "1px solid #3a4048", pointerEvents: "none", zIndex: 1,
        }}
      />
      <span
        style={{
          position: "absolute", left: g.axisW || 0, right: g.gutter, bottom: scale.y(posLine) + lay.labelH,
          borderTop: "1.5px dashed var(--text)", pointerEvents: "none", zIndex: 2,
        }}
      />
      <div
        onPointerDown={startDrag}
        style={{
          position: "absolute", right: 0, bottom: scale.y(posLine) - g.handleH / 2 + lay.labelH,
          width: g.handleW, height: g.handleH, display: "flex", alignItems: "center",
          justifyContent: "center", borderRadius: 7, background: "var(--amber)", color: "#ffffff",
          fontFamily: MONO, fontSize: size === "feed" ? 11 : 12, fontWeight: 700,
          cursor: canDrag ? "grab" : "default",
          touchAction: "none", userSelect: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.5)", zIndex: 3,
        }}
      >
        {line}
      </div>

      {/* The hover hint. Date, opponent, value and over/under against the
          current line -- and it says outright that a click opens the card,
          because the card is what carries the data. */}
      {tooltipFor && hover != null && (
        <div
          style={{
            position: "absolute", zIndex: 4, pointerEvents: "none",
            // Measured across the track, not the box: the axis gutter and the
            // handle gutter are both outside the columns, so a plain percentage
            // of the container drifts the hint off its own bar.
            left: `calc(${g.axisW || 0}px + ${((hover + 0.5) / (n || 1))} * (100% - ${(g.axisW || 0) + g.gutter}px))`,
            transform: "translateX(-50%)", bottom: g.plotH - 8,
            display: "flex", flexDirection: "column", gap: 3, whiteSpace: "nowrap",
            padding: "8px 11px", borderRadius: 8, border: "1px solid var(--line)",
            background: "var(--surface-2)", boxShadow: "0 10px 26px rgba(0,0,0,0.55)",
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text)" }}>{tooltipFor(hover)}</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>click for the full line</span>
        </div>
      )}
    </div>
  );
}
