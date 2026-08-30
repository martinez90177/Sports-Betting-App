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

export const PLOT = {
  // Player Detail (frame 1c): a 176px box over a 146px span, 52px gutter.
  player: { plotH: 176, span: 146, gutter: 52, handleW: 46, handleH: 30, trackW: 261 },
  // A Prop Feed row (frame 1b): 74px box, 52px span, 46px gutter.
  feed: { plotH: 74, span: 52, gutter: 46, handleW: 42, handleH: 28, trackW: 265 },
  // Desktop Player Detail (`PropPalace Desktop v3.dc.html` frame 1a): a
  // 268px box in a 1fr centre column, so the track measures far wider than
  // either phone size and the label thresholds pass at much longer windows.
  desktop: { plotH: 268, span: 224, gutter: 58, handleW: 52, handleH: 32, trackW: 780 },
};

export const gapFor = (n) => (n <= 10 ? 6 : n <= 20 ? 4 : n <= 30 ? 3 : 2);

// Labels are all-or-nothing per kind, gated on the column's measured width.
// A kind that fits for some columns and not others is the overlap the desktop
// graph shows at 100 games, so it is dropped for every column instead.
// Thresholds from player-detail-handoff.md section 3.
export function layFor(n, trackW) {
  const gap = gapFor(n);
  const per = n > 0 ? (trackW - gap * (n - 1)) / n : 0;
  const crest = per >= 20;
  const abbr = per >= 34;
  const date = per >= 44;
  return { crest, abbr, date, val: per >= 20, labelH: (crest ? 20 : 0) + (abbr ? 14 : 0) + (date ? 15 : 0) };
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
          position: "absolute", left: 0, right: g.gutter, top: 0, bottom: 0,
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
                    fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", whiteSpace: "nowrap",
                    color: away ? "var(--text-2)" : "var(--dim)", fontWeight: away ? 700 : 400,
                  }}
                >
                  {away ? "@ " : ""}{String(gm.opp || "").toUpperCase()}
                </span>
              )}
              {lay.date && (
                <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>{gm.date}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* The axis the bars stand on. Without it an open-bottomed miss reads as
          a bar continuing below the frame. */}
      <span
        style={{
          position: "absolute", left: 0, right: g.gutter, bottom: lay.labelH,
          borderTop: "1px solid #3a4048", pointerEvents: "none", zIndex: 1,
        }}
      />
      <span
        style={{
          position: "absolute", left: 0, right: g.gutter, bottom: scale.y(posLine) + lay.labelH,
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
            left: `calc(${((hover + 0.5) / (n || 1)) * 100}% )`,
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
