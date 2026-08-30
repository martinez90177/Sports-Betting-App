import React from "react";
import { feedFormScale } from "../FormGraph.jsx";

// Tokens and the one graph both Board frames draw.
//
// `PropPalace Board v4 part 2.dc.html` holds the phone frame and the desktop
// frame in one file, and they share these: the same TONE per reason kind, the
// same three tier headings, the same strip. Kept in one module so they cannot
// drift — a desktop card tinting `out` differently from a phone card would be
// two answers to the same question.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

// One tone per reason kind, as the file writes them. These are chip
// backgrounds, not outcome colours: `rate` borrows the cleared green because
// the reason IS a count of cleared games, and `out` borrows the out red
// because it is literally the availability feed.
const TONE = {
  rate: { bg: "var(--pos-dim)", fg: "var(--pos)" },
  matchup: { bg: "var(--amber-dim)", fg: "var(--amber-ink)" },
  lineup: { bg: "rgba(232,177,58,0.16)", fg: "var(--status-questionable)" },
  out: { bg: "var(--neg-dim)", fg: "var(--neg)" },
  none: { bg: "rgba(139,152,171,0.12)", fg: "var(--dim)" },
};

const TIERS = [
  { title: "Worth ten minutes", sub: "three or more counted reasons", tone: "var(--pos)" },
  { title: "One thing each", sub: "a single reason, named on the card", tone: "var(--amber-ink)" },
  { title: "Quiet", sub: "nothing cleared a bar — shown so the slate is complete", tone: "var(--dim)" },
];

const atStyle = {
  fontFamily: "'Archivo', system-ui, sans-serif", fontWeight: 700,
  color: "var(--amber-ink)", padding: "0 5px", fontSize: 12,
};

// The strip under a prop on a hero card. Same margin-from-the-line axis as
// every other graph in the app -- `feedFormScale`, not a second derivation --
// drawn as a grid because at this size there is no gutter and no handle.
function MiniStrip({ games, line, isBinary, direction, height = 54 }) {
  const FLOOR = 20;
  const vals = games.map((g) => ({ v: g.v }));
  const scale = feedFormScale(vals, line, isBinary, { height, pedestal: FLOOR });
  const hit = (v) => (direction === "under" ? v < line : v > line);
  return (
    <span style={{ position: "relative", flex: "1 1 auto", minWidth: 0 }}>
      <span
        style={{
          display: "grid", gridTemplateColumns: `repeat(${games.length}, minmax(0, 1fr))`,
          gap: 4, alignItems: "end", height, width: "100%",
        }}
      >
        {games.map((g, i) => {
          const isHit = hit(g.v);
          return (
            <span key={i} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", minWidth: 0 }}>
              {/* A zero draws no bar -- a red numeral in its place. */}
              {g.v === 0 && (
                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "var(--neg)", lineHeight: "10px", textAlign: "center" }}>0</span>
              )}
              {g.v !== 0 && (
                <span
                  style={{
                    display: "flex", alignItems: "flex-end", justifyContent: "center",
                    width: "100%", height: scale.y(g.v), borderRadius: 2, boxSizing: "border-box",
                    alignSelf: "end", overflow: "hidden",
                    background: isHit ? "var(--pos)" : "transparent",
                    border: isHit ? "none" : "1.5px solid var(--neg)",
                  }}
                >
                  {/* The value inside the bar, as the file draws it. */}
                  <span
                    style={{
                      fontFamily: MONO, fontSize: 10, fontWeight: 700, lineHeight: "10px",
                      textAlign: "center", paddingBottom: 3,
                      color: isHit ? "#07120c" : "var(--neg)",
                    }}
                  >
                    {g.v}
                  </span>
                </span>
              )}
            </span>
          );
        })}
      </span>
      <span
        style={{
          position: "absolute", left: 0, right: 0, bottom: scale.y(line),
          borderTop: "1px dashed var(--text)", opacity: 0.75, pointerEvents: "none",
        }}
      />
    </span>
  );
}

export { TONE, TIERS, atStyle, MiniStrip };
