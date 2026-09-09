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
  player: { plotH: 176, span: 146, gutter: 52, handleW: 46, handleH: 30, trackW: 261, axisW: 0 },
  // A Prop Feed row (frame 1b): 74px box, 52px span, 46px gutter.
  feed: { plotH: 74, span: 52, gutter: 46, handleW: 42, handleH: 28, trackW: 265, axisW: 0 },
  // Desktop Player Detail (`PropPalace Desktop v3.dc.html` frame 1a).
  //
  // Taller than the handoff's 268/224 on Alex's read (2026-09-09): the labels
  // underneath cost ~53px, which left the bars a short box for the one thing
  // the page is about. 330 over a 250 span gives the graph the room and still
  // leaves headroom above the tallest bar for the hover card.
  desktop: { plotH: 330, span: 250, gutter: 58, handleW: 52, handleH: 32, trackW: 780, axisW: 34 },
};

export const gapFor = (n) => (n <= 10 ? 6 : n <= 20 ? 4 : n <= 30 ? 3 : 2);

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

export function layFor(n, trackW) {
  const gap = gapFor(n);
  const per = n > 0 ? (trackW - gap * (n - 1)) / n : 0;
  const crest = per >= 20;
  const abbr = per >= 34;
  const date = per >= 44;
  // The leading COL_GAP is the gap between the bar and the first label, so the
  // rule lands on the bars' own baseline and everything below it clears.
  const stack = (crest ? CREST_MT + CREST_PX : 0)
    + (abbr ? COL_GAP + LABEL_LINE : 0)
    + (date ? COL_GAP + LABEL_LINE : 0);
  return { crest, abbr, date, val: per >= 20, labelH: stack ? stack + COL_GAP : 0 };
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

  const lay = labels ? layFor(n, trackW) : { crest: false, abbr: false, date: false, val: layFor(n, trackW).val, labelH: 0 };
  const recent = React.useMemo(() => games.map((x) => ({ v: x.v })), [games]);
  const scale = feedFormScale(recent, line, isBinary, { height: g.span + PEDESTAL, pedestal: PEDESTAL });
  const hit = (v) => (direction === "under" ? v < line : v > line);

  // Three marks on the value scale: the axis top, its middle and its floor.
  //
  // Read off the same `scale` the bars are drawn with rather than off the raw
  // games, so a tick always sits where a bar of that value would end. Snapped
  // to the axis's own step (5 above 100, 1 below), and de-duplicated -- a flat
  // log with a 0.6 pad can land all three on the same number, and printing it
  // three times reads as a broken axis rather than a short one.
  //
  // The outer two round INWARD -- floor the top, ceil the floor -- because
  // nearest-rounding pushes them off the end of a padded axis and they then get
  // filtered away. Measured: Goff's window runs 166.9 to 394.1, where nearest-5
  // gives 395 and 165, both outside, leaving a scale with one mark on it.
  const axisTicks = React.useMemo(() => {
    if (isBinary || !(g.axisW > 0)) return [];
    const lo = scale.axisMin;
    const hi = scale.axisMin + scale.span;
    const s = scale.step >= 5 ? 5 : 1;
    const ticks = [
      Math.floor(hi / s) * s,
      Math.round((lo + (hi - lo) / 2) / s) * s,
      Math.ceil(lo / s) * s,
    ];
    return [...new Set(ticks)].filter((t) => t >= lo && t <= hi);
  }, [isBinary, g.axisW, scale.axisMin, scale.span, scale.step]);
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

  return (
    <div style={{ position: "relative", height: g.plotH }}>
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
                    display: "flex", width: "100%", height: scale.y(v), borderRadius: 2, boxSizing: "border-box",
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
              {lay.date && (
                <span style={{ fontFamily: MONO, fontSize: 10, lineHeight: `${LABEL_LINE}px`, color: "var(--dim)", whiteSpace: "nowrap" }}>{gm.date}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* The value scale, where there is a gutter to put it in.
          Three marks: the top of the axis, its midpoint and its floor -- enough
          to read a bar's height without counting, which is all a scale on a
          ten-column plot needs to do. Rounded to the axis's own step so the
          numbers are the ones the bars are drawn against, and the whole thing
          is skipped on a binary market, where the only values are 0 and 1. */}
      {g.axisW > 0 && !isBinary && axisTicks.map((t) => (
        <span
          key={t}
          style={{
            position: "absolute", left: 0, width: g.axisW - 6, textAlign: "right",
            bottom: scale.y(t) + lay.labelH - 6,
            fontFamily: MONO, fontSize: 9.5, lineHeight: "12px", color: "var(--dim)",
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
