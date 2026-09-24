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

// What is behind a card's chips, written out.
//
// The hero always drew this; every other card was a row of chips whose only
// click went to the Prop Feed, filtered to the game -- 190 rows to find the one
// the chip was counting. Alex, 2026-09-21: *"this page makes the board seem
// useless, because just clicking it brings you to prop feed."* So a card now
// opens into the same brief the hero carries: each reason with what it counted
// (the players listed out, the props facing the soft defence), and the props
// that cleared the bar -- or, on a quiet game, the ones that came closest.
//
// Not in `PropPalace Board v4 part 2.dc.html`, whose tier cards are static.
// The layout is the hero's own (WHY on the left, prop rows on the right), so
// the opened card is the mock's hero vocabulary rather than a new one.
//
// `wide` is the desktop two-column form; without it the two halves stack, for
// the phone.
function BoardBrief({ card, sport, wide = true, whyLabel = "WHAT'S BEHIND IT", onOpenProp, onOpenGameProps }) {
  const microLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };
  const open = (p) => onOpenProp && onOpenProp(sport, p.playerId, p.marketId);
  const key = (fn) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
  const reasons = (card.reasons || []).filter((r) => r.title);

  const why = (
    <div style={{ borderRight: wide ? "1px solid var(--line)" : "none", borderBottom: wide ? "none" : "1px solid var(--line)", padding: wide ? "18px 20px" : "14px 14px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <span style={microLabel}>{whyLabel}</span>
      {reasons.length === 0 && (
        <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)" }}>{card.quietWhy}</span>
      )}
      {reasons.map((w) => (
        <div key={w.title} style={{ display: "flex", alignItems: "flex-start", gap: 11, minWidth: 0 }}>
          <span style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: (TONE[w.kind] || TONE.none).fg, display: "block", flex: "0 0 auto" }} />
          <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{w.title}</span>
            <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--dim)", textWrap: "pretty" }}>{w.cite}</span>
            {/* Who the availability report lists out, with their dot. */}
            {w.players && w.players.length > 0 && (
              <span style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                {w.players.map((p) => (
                  <span key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ flex: "0 0 auto", display: "flex" }}>{p.avatarNode}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, minWidth: 0 }}>{p.name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>{[p.team, p.position].filter(Boolean).join(" · ")}</span>
                  </span>
                ))}
              </span>
            )}
            {/* The props that face the soft defence, each one a way in. */}
            {w.props && w.props.length > 0 && (
              <span style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                {w.props.map((p) => (
                  <span
                    key={p.key}
                    role="button" tabIndex={0}
                    onClick={() => open(p)} onKeyDown={key(() => open(p))}
                    title={`Open ${p.name} — ${String(p.prop).toLowerCase()}, on Player Detail`}
                    style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)", cursor: "pointer" }}
                  >
                    {p.name} <span style={{ color: "var(--dim)" }}>· {p.prop}</span> <span style={{ color: "var(--amber-ink)" }}>→</span>
                  </span>
                ))}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );

  const propsLabel = card.propsKind === "strong"
    ? `CLEARED THE BAR · ${card.strongCount} ON ${card.minGames}+ GAMES`
    : "CLOSEST TO THE BAR";

  const props = (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <span style={{ ...microLabel, padding: wide ? "18px 20px 6px" : "14px 14px 6px" }}>{propsLabel}</span>
      {(card.props || []).length === 0 && (
        <span style={{ padding: wide ? "6px 20px 14px" : "6px 14px 12px", fontSize: 12.5, color: "var(--dim)" }}>No prop on this game has enough games behind it to read.</span>
      )}
      {(card.props || []).map((p) => {
        const who = (
          <span
            role="button" tabIndex={0}
            onClick={() => open(p)} onKeyDown={key(() => open(p))}
            title={`Open ${p.name} — ${String(p.prop).toLowerCase()}, on Player Detail`}
            style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: wide ? "0 0 150px" : "1 1 auto", cursor: "pointer" }}
          >
            <span style={{ fontSize: wide ? 14.5 : 13.5, fontWeight: 600, overflowWrap: "anywhere" }}>{p.name}</span>
            <span style={{ fontFamily: MONO, fontSize: wide ? 11 : 10, color: "var(--text-2)", overflowWrap: "anywhere" }}>{p.prop}</span>
          </span>
        );
        const rate = (
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "0 0 auto" }}>
            <span style={{ fontFamily: MONO, fontSize: wide ? 16 : 14, fontWeight: 700, color: p.rate >= 0.7 ? "var(--pos)" : p.rate >= 0.6 ? "var(--status-questionable)" : "var(--text-2)" }}>
              {`${Math.round(p.rate * 100)}%`}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{`${p.hits} of ${p.n}`}</span>
          </span>
        );
        // One line on desktop. On the phone the strip takes its own
        // full-width line under the name: squeezed beside it, ten bars got
        // about 11px each and their printed values ran into each other.
        return wide ? (
          <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 20px", borderBottom: "1px solid var(--line)", minHeight: 44 }}>
            <span style={{ position: "relative", flex: "0 0 auto" }}>{p.avatarNode}</span>
            {who}
            <MiniStrip games={p.bars} line={p.line} isBinary={p.isBinary} direction={p.direction} height={60} />
            {rate}
          </div>
        ) : (
          <div key={p.key} style={{ display: "flex", flexDirection: "column", gap: 9, padding: "11px 14px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
              <span style={{ position: "relative", flex: "0 0 auto" }}>{p.avatarNode}</span>
              {who}
              {rate}
            </div>
            <span style={{ display: "flex" }}>
              <MiniStrip games={p.bars} line={p.line} isBinary={p.isBinary} direction={p.direction} height={48} />
            </span>
          </div>
        );
      })}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px 10px", padding: wide ? "12px 20px" : "12px 14px", minHeight: 44 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", minWidth: 0 }}>{card.rest}</span>
        <span
          role="button" tabIndex={0}
          onClick={() => onOpenGameProps && onOpenGameProps(card)} onKeyDown={key(() => onOpenGameProps && onOpenGameProps(card))}
          style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", color: "var(--amber-ink)", cursor: "pointer", whiteSpace: "nowrap", flex: "0 0 auto" }}
        >
          THIS GAME’S PROPS →
        </span>
      </div>
    </div>
  );

  return wide ? (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 380px) minmax(0, 1fr)", borderTop: "1px solid var(--line)" }}>
      {why}
      {props}
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--line)" }}>
      {why}
      {props}
    </div>
  );
}

export { TONE, TIERS, atStyle, MiniStrip, BoardBrief };
