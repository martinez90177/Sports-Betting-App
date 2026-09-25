import React from "react";
import { feedFormScale } from "../FormGraph.jsx";
import { seasonLabel } from "../LogScope.jsx";

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
// one. The phone player plot puts its scale in the tag's right-hand gutter
// (`axisRight`); the feed strip has none.
export const PLOT = {
  // Player Detail (frame 1c): a 176px box over a 146px span, 52px gutter.
  //
  // Its value scale rides in the right-hand gutter, in the line tag's own
  // column, and costs the bars no width. Alex, 2026-09-25, of the left-hand
  // version that preceded it: *"that graph is too tight together, that y axis
  // is causing too much room to be sacrificed"* -- it took 26px off a track
  // whose L10 columns are 21px against a 20px floor, and bought them back by
  // closing the gaps between bars. The gutter under the tag was sitting empty.
  // The tag is itself a value on the scale; a mark it would cover is left off,
  // and the tag is *drawn* 24px tall (`tagH`) inside its 30px touch target so
  // that it covers fewer -- drawn at 30, a 250.5 line hid both the 200 and
  // the 300 and left "100" standing alone. The thumb still gets all 30.
  player: { plotH: 176, span: 146, gutter: 52, handleW: 46, handleH: 30, tagH: 24, trackW: 261, axisW: 0, axisRight: true, ticks: 5, zones: true, seasons: true },
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
  desktop: { plotH: 268, span: 224, gutter: 58, handleW: 52, handleH: 32, trackW: 780, axisW: 36, dateLadder: true, zones: true, seasons: true },
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

// A zoomed plot lets its bars grow to the width a six-game page would draw.
// Held to the ten-game cap, zooming an L10 in to five games drew the same five
// bars at the same width with wider gaps between them -- fewer bars, not a
// closer look -- and Alex, 2026-09-25: *"something funny about the zoom
// feature something seems a bit off."* Six rather than no cap at all, so a
// two-game zoom is still two bars and never the full-width slab BAR_COLS was
// written to stop.
export const ZOOM_BAR_COLS = 6;

export const barMaxFor = (trackW, n, cols = BAR_COLS) =>
  Math.max(0, (trackW - gapFor(n) * (cols - 1)) / cols);

// The strip above the plot that carries its header, and on hover the game
// under the pointer. 24px of readout over a 5px caret.
const LANE_H = 30;
const READOUT_H = 24;

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
  // True while the caller is showing a zoomed slice -- see ZOOM_BAR_COLS.
  zoomed = false,
  // (index) => node, the game under the pointer, drawn in the lane above the
  // plot with a hint that a click opens the detail card.
  tooltipFor = null,
  // (from, to) => node, what a drag has selected so far, in the same lane.
  rangeFor = null,
  // The row above the plot -- market, sample, hints. It gives its place to
  // the readout while one is showing.
  header = null,
}) {
  const g = PLOT[size] || PLOT.player;
  const [hover, setHover] = React.useState(null);
  const [dragSel, setDragSel] = React.useState(null);
  const dragging = React.useRef(false);
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
  const barMax = barMaxFor(trackW, n, zoomed ? ZOOM_BAR_COLS : BAR_COLS);
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
  const hasAxis = g.axisW > 0 || !!g.axisRight;
  const axisTicks = React.useMemo(() => {
    if (isBinary || !hasAxis) return [];
    const hi = scale.axisMin + scale.span;
    // Fewer on the phone's 146px span, so the marks stay ~40px apart.
    const raw = hi / (g.ticks || 8);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    const step = Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow);
    const ticks = [];
    for (let t = step; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
    return ticks;
  }, [isBinary, hasAxis, g.ticks, scale.axisMin, scale.span]);
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
  // On the right-hand scale a mark shares its column with the line tag, so
  // one the tag would cover is left off: half the tag, half a 12px label and
  // a pixel between them.
  const labelTicks = g.axisRight
    ? shownTicks.filter((t) => Math.abs(scale.y(t) + lay.labelH - lineY) >= (g.tagH || g.handleH) / 2 + 7)
    : shownTicks;

  // Where one season hands over to the next, marked on the chart. Alex,
  // 2026-09-25, of an L10 that ran from last November into this September:
  // *"there's no like header or anything stating 2026 ... I feel like there
  // should be something on the chart that indicates the change in season."*
  // Nothing on the plot said that eight bars and the last two were a summer
  // apart. Read off each game's own `season`, never its date -- January is
  // last season in the NFL -- and drawn only when every game carries one.
  const seasonRuns = React.useMemo(() => {
    if (!g.seasons) return [];
    const runs = [];
    games.forEach((gm, i) => {
      const s = gm.raw && gm.raw.season != null ? Number(gm.raw.season) : NaN;
      const last = runs[runs.length - 1];
      if (last && last.season === s) last.to = i;
      else runs.push({ season: s, from: i, to: i });
    });
    return runs.length > 1 && runs.every((r) => Number.isFinite(r.season)) ? runs : [];
  }, [g.seasons, games]);
  // Column geometry, the same arithmetic the flex track does.
  const pitch = n ? (trackW + gapFor(n)) / n : 0;
  const colX = (i) => (g.axisW || 0) + i * pitch;
  const colMid = (i) => colX(i) + (pitch - gapFor(n)) / 2;
  // The column under a pointer, with each gap split between the two bars
  // either side of it. Hover used to be per-bar enter/leave, so the readout
  // blinked off in every 6px gap; and the zoom drag counted columns as equal
  // slices of the track, ignoring the gaps, so toward the right-hand end the
  // highlight and the bar under the pointer drifted apart.
  const colAt = (clientX, box) => {
    const p = n ? (box.width + gapFor(n)) / n : 1;
    return Math.max(0, Math.min(n - 1, Math.floor((clientX - box.left + gapFor(n) / 2) / p)));
  };
  // The side of the line a game has to land on to count, washed green; the
  // other side red. Flips with the direction, so the Under view colours the
  // floor rather than the ceiling.
  const upper = direction === "under" ? "var(--neg)" : "var(--pos)";
  const lower = direction === "under" ? "var(--pos)" : "var(--neg)";
  const zoneBox = { position: "absolute", left: g.axisW || 0, right: g.gutter, pointerEvents: "none" };

  // Under the dates, a bracket per season spanning its own columns, named in
  // the middle -- a timeline's way of grouping, and it never sits on a bar.
  // A label that would run into the one before it is dropped rather than
  // overlapped, which only happens when a season has a game or two on a long
  // window.
  const seasonRow = seasonRuns.length > 1 ? (() => {
    const CH = 6.1;
    const lo = g.axisW || 0;
    const hi = lo + trackW;
    let prevRight = -Infinity;
    const marks = seasonRuns.map((r) => {
      const x0 = colX(r.from);
      const x1 = colX(r.to) + pitch - gapFor(n);
      const text = seasonLabel(r.season, sport);
      const w = text.length * CH;
      let left = Math.min(Math.max((x0 + x1) / 2 - w / 2, lo), hi - w);
      const show = left >= prevRight + 6;
      if (show) prevRight = left + w;
      return { key: r.season, x0, x1, left, text: show ? text : null };
    });
    return (
      <div style={{ position: "relative", height: 21, userSelect: "none" }} aria-label={`Seasons: ${seasonRuns.map((r) => seasonLabel(r.season, sport)).join(", ")}`}>
        {marks.map((m) => (
          <React.Fragment key={m.key}>
            <span
              style={{
                position: "absolute", top: 0, left: m.x0, width: Math.max(1, m.x1 - m.x0), height: 5,
                boxSizing: "border-box", borderLeft: "1px solid var(--line-strong, var(--line))",
                borderRight: "1px solid var(--line-strong, var(--line))", borderBottom: "1px solid var(--line-strong, var(--line))",
              }}
            />
            {m.text && (
              <span style={{ position: "absolute", top: 9, left: m.left, fontFamily: MONO, fontSize: 10, lineHeight: "12px", letterSpacing: "0.04em", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                {m.text}
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  })() : null;

  // What the lane above the plot shows: a drag's selection once it spans two
  // games, otherwise the game under the pointer.
  //
  // It used to float over the plot itself, pinned 8px inside its top edge --
  // exactly where the tallest bars end -- so hovering the best game of the
  // window covered it. Alex, 2026-09-25: *"you see how the hover info tab
  // kinda blocks the bars when looking at them?"* The lane is the header's own
  // row, which the readout borrows, so nothing on the plot is ever under it.
  const selecting = !!dragSel && dragSel[1] > dragSel[0];
  const whole = selecting && dragSel[0] === 0 && dragSel[1] === n - 1;
  const readout = selecting && rangeFor
    ? {
      at: (colX(dragSel[0]) + colX(dragSel[1]) + pitch - gapFor(n)) / 2,
      body: rangeFor(dragSel[0], dragSel[1]),
      hint: whole ? "narrow it to zoom" : "release to zoom",
    }
    : !selecting && hover != null && hover < n && tooltipFor
      ? { at: colMid(hover), body: tooltipFor(hover), hint: onPickBar ? "click for the full line" : null }
      : null;
  // Slid along its own width as it crosses the track -- left-aligned over the
  // first bar, centred over the middle one, right-aligned over the last -- so
  // it never runs off the card at either end. The caret stays on the column.
  const frac = readout ? Math.max(0, Math.min(1, (readout.at - (g.axisW || 0)) / (trackW || 1))) : 0;
  const lane = (header || tooltipFor) ? (
    <div style={{ position: "relative", height: LANE_H, userSelect: "none" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", visibility: readout ? "hidden" : "visible" }}>
        {header}
      </div>
      {readout && (
        <>
          <div
            style={{
              position: "absolute", top: 0, height: READOUT_H, left: readout.at, transform: `translateX(-${frac * 100}%)`,
              maxWidth: "100%", overflow: "hidden",
              display: "flex", alignItems: "center", gap: 12, padding: "0 10px", boxSizing: "border-box",
              borderRadius: 6, border: "1px solid var(--line-strong, var(--line))", background: "var(--surface-1)",
              fontFamily: MONO, fontSize: 11, whiteSpace: "nowrap", pointerEvents: "none",
            }}
          >
            <span style={{ color: "var(--text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{readout.body}</span>
            {readout.hint && <span style={{ color: "var(--dim)" }}>{readout.hint}</span>}
          </div>
          <span
            style={{
              position: "absolute", top: READOUT_H, left: readout.at, transform: "translateX(-50%)", width: 0, height: 0,
              borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
              borderTop: "5px solid var(--line-strong, var(--line))", pointerEvents: "none",
            }}
          />
        </>
      )}
    </div>
  ) : null;

  return (
    <>
    {lane}
    <div style={{ position: "relative", height: g.plotH, userSelect: "none" }}>
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
      {hasAxis && shownTicks.map((t) => (
        <span
          key={`grid-${t}`}
          style={{
            ...zoneBox, bottom: scale.y(t) + lay.labelH,
            borderTop: "1px solid color-mix(in srgb, var(--line) 70%, transparent)",
          }}
        />
      ))}
      {/* The season break itself, down the gap between the last game of one
          season and the first of the next, from the top of the plot to the
          rule. The row under the dates names the two sides. */}
      {seasonRuns.slice(1).map((r) => (
        <span
          key={`season-${r.season}`}
          style={{
            position: "absolute", top: 0, bottom: lay.labelH, left: colX(r.from) - gapFor(n) / 2,
            borderLeft: "1px dashed var(--dim)", pointerEvents: "none",
          }}
        />
      ))}
      {/* A drag's selection, as one band across its columns rather than a
          tint per column, so the gaps inside it read as part of it. Under
          the bars; the bars outside it dim. */}
      {selecting && (
        <span
          style={{
            position: "absolute", top: 0, bottom: 0, left: colX(dragSel[0]),
            width: colX(dragSel[1]) + pitch - gapFor(n) - colX(dragSel[0]),
            background: "color-mix(in srgb, var(--amber) 14%, transparent)",
            borderLeft: "1.5px solid var(--amber)", borderRight: "1.5px solid var(--amber)",
            borderRadius: 3, boxSizing: "border-box", pointerEvents: "none",
          }}
        />
      )}
      <div
        ref={trackRef}
        onPointerMove={tooltipFor ? (e) => setHover(colAt(e.clientX, e.currentTarget.getBoundingClientRect())) : undefined}
        onPointerLeave={tooltipFor ? () => { if (!dragging.current) setHover(null); } : undefined}
        onPointerDown={onZoom ? (e) => {
          if (e.button !== 0) return;
          // Both halves are required. preventDefault stops the browser
          // starting its own selection; userSelect below stops it painting
          // one anyway. Either alone still leaves the blue smear.
          e.preventDefault();
          const box = e.currentTarget.getBoundingClientRect();
          const startX = e.clientX;
          const start = colAt(startX, box);
          let last = start;
          let moved = false;
          dragging.current = true;
          const move = (ev) => {
            // A few pixels of wobble in a click is not a drag.
            if (!moved && Math.abs(ev.clientX - startX) < 4) return;
            moved = true;
            last = colAt(ev.clientX, box);
            setDragSel([Math.min(start, last), Math.max(start, last)]);
          };
          const up = (ev) => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
            dragging.current = false;
            setDragSel(null);
            setHover(null);
            const lo = Math.min(start, last);
            const hi = Math.max(start, last);
            // A drag under two columns is a click, not a zoom -- so a
            // mis-aimed tap on a bar opens its card instead of collapsing
            // the graph to one game. A drag across every column is not a
            // zoom either: it would redraw the same chart with a RESET
            // ZOOM button on it.
            // The hover is cleared either way: the pointer may have been
            // released off the plot, and after a zoom the columns move under
            // it. The next pointermove over the track picks the right one up.
            if (moved && ev.type === "pointerup" && hi - lo >= 1 && !(lo === 0 && hi === n - 1)) onZoom(lo, hi);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
          window.addEventListener("pointercancel", up);
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
              style={{
                flex: "1 1 0", minWidth: 0, height: "100%", display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 3,
                cursor: onPickBar ? "pointer" : "default",
                background: !selecting && (picked === i || hover === i) ? "rgba(255,255,255,0.05)" : "transparent",
                opacity: selecting && (i < dragSel[0] || i > dragSel[1]) ? 0.35 : 1,
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
      {hasAxis && labelTicks.map((t) => (
        <span
          key={t}
          style={{
            position: "absolute",
            // Right-hand: centred in the tag's own column, so the marks and
            // the tag read as one scale.
            ...(g.axisRight
              ? { right: 0, width: g.handleW, textAlign: "center" }
              : { left: 0, width: g.axisW - 6, textAlign: "right" }),
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
      {/* The touch target is handleH tall; what is drawn inside it may be
          shorter (`tagH`), centred, so the target never shrinks with it. */}
      <div
        onPointerDown={startDrag}
        style={{
          position: "absolute", right: 0, bottom: scale.y(posLine) - g.handleH / 2 + lay.labelH,
          width: g.handleW, height: g.handleH, display: "flex", alignItems: "center",
          cursor: canDrag ? "grab" : "default",
          touchAction: "none", userSelect: "none", zIndex: 3,
        }}
      >
        <span
          style={{
            width: "100%", height: g.tagH || g.handleH, display: "flex", alignItems: "center",
            justifyContent: "center", borderRadius: 7, background: "var(--amber)", color: "#ffffff",
            fontFamily: MONO, fontSize: size === "feed" ? 11 : 12, fontWeight: 700,
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {line}
        </span>
      </div>

    </div>
    {seasonRow}
    </>
  );
}
