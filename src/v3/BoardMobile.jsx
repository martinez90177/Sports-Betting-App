import React from "react";
import { feedFormScale } from "../FormGraph.jsx";
import { crest } from "./FormPlot.jsx";

// A transcription of frame `1a` in `v3 Mocks/PropPalace Board v4 part 2.dc.html`.
//
// That file is THE Board. The v3 mobile and desktop files contain none -- the
// superseded versions were deleted so there is nothing to confuse it with.
//
// What changes from the shipped Board: it bands games into three named tiers
// by *how many reasons the card can cite*, instead of ranking them on one
// number. The file's own title says why -- "tiers instead of a ranking" --
// and the tier subtitles say it on screen: nothing counted makes game two
// better than game three, but "four reasons" and "one" are different kinds of
// night.
//
// `lib/support.js` still decides which props lead a card. It is the ordering
// inside a card, which is a different question from which card to open.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

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

function PropRow({ p, sport, onOpen }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "12px 14px", borderBottom: "1px solid var(--surface-2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span style={{ position: "relative", flex: "0 0 auto" }}>{p.avatarNode}</span>
        <span
          onClick={onOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
          title={`Open ${p.name} — ${String(p.prop).toLowerCase()}, on Player Detail`}
          style={{
            display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 auto",
            cursor: "pointer", borderRadius: 6, margin: "-4px -6px", padding: "4px 6px",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.name}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)", whiteSpace: "nowrap" }}>{p.prop}</span>
        </span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 7, flex: "0 0 auto" }}>
          <span
            style={{
              fontFamily: MONO, fontSize: 16, fontWeight: 700,
              color: p.rate >= 0.7 ? "var(--pos)" : p.rate >= 0.6 ? "var(--status-questionable)" : "var(--text-2)",
            }}
          >
            {`${Math.round(p.rate * 100)}%`}
          </span>
          {/* Counted from the same array the strip draws, never authored
              beside it. */}
          <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{`${p.hits}/L${p.n}`}</span>
        </span>
      </div>
      <MiniStrip games={p.bars} line={p.line} isBinary={p.isBinary} direction={p.direction} />
    </div>
  );
}

export default function BoardMobile({
  sport,
  sports = [],
  onSetSport,
  tiers,
  summary,
  slateLabel,
  footNote,
  loading = false,
  emptyNote = null,
  onOpenProp,
  onOpenGameProps,
}) {
  return (
    <>
      <div
        style={{
          position: "sticky", top: 0, zIndex: 20, background: "var(--bg)",
          borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column",
          gap: 9, padding: "11px 0 12px",
        }}
      >
        <div className="nsb" style={{ display: "flex", gap: 8, padding: "0 16px", overflowX: "auto" }}>
          {sports.map((s) => {
            const on = s === sport;
            return (
              <div
                key={s}
                onClick={() => onSetSport(s)}
                style={{
                  minHeight: 40, display: "flex", alignItems: "center", padding: "0 14px", borderRadius: 8,
                  fontFamily: MONO, fontSize: 12, whiteSpace: "nowrap", cursor: "pointer", flex: "0 0 auto",
                  border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                  background: on ? "var(--amber-dim)" : "var(--surface-1)",
                  color: on ? "var(--amber-ink)" : "var(--text)",
                }}
              >
                {String(s).toUpperCase()}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "0 16px" }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)" }}>{summary}</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>{slateLabel}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "16px 16px 26px" }}>
        {loading && <div style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--dim)" }}>Loading the slate…</div>}
        {!loading && tiers.length === 0 && emptyNote && (
          <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--dim)" }}>{emptyNote}</div>
        )}

        {tiers.map((tier) => (
          <div key={tier.key} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: tier.tone, display: "block", flex: "0 0 auto" }} />
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16 }}>{tier.title}</span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>{tier.count}</span>
            </div>
            <span style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.5 }}>{tier.sub}</span>

            {tier.games.map((g) => (
              <div
                key={g.key}
                style={{
                  border: `1px solid ${g.hero ? "var(--amber)" : "var(--line)"}`, borderRadius: 12,
                  background: g.quiet ? "var(--surface-sunken)" : "var(--surface-1)", overflow: "hidden",
                  opacity: g.quiet ? 0.8 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 14px 11px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: "1 1 auto" }}>
                    <span role="img" style={crest(g.away, sport, 20)} />
                    <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--text)" }}>{g.away}</span>
                    <span style={atStyle}>@</span>
                    <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--text)" }}>{g.home}</span>
                    <span role="img" style={crest(g.home, sport, 20)} />
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", whiteSpace: "nowrap" }}>{g.time}</span>
                </div>

                <div style={{ padding: "0 14px 11px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* The same reasons as a bar, so a slate's shape is legible
                      without reading. An empty bar for a quiet game. */}
                  <span style={{ display: "flex", gap: 3, height: 5, borderRadius: 3, overflow: "hidden", background: "var(--surface-2)" }}>
                    {g.reasons.length === 0
                      ? <span style={{ flex: "1 1 auto", background: "var(--surface-3)", display: "block" }} />
                      : g.reasons.map((r, i) => (
                        <span key={`${r.label}${i}`} style={{ flex: "1 1 0", background: (TONE[r.kind] || TONE.none).fg, display: "block" }} />
                      ))}
                  </span>
                  {g.reasons.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {g.reasons.map((r, i) => {
                        const tone = TONE[r.kind] || TONE.none;
                        return (
                          <span
                            key={`${r.label}${i}`}
                            style={{
                              fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", padding: "4px 9px",
                              borderRadius: 5, whiteSpace: "nowrap", background: tone.bg, color: tone.fg,
                            }}
                          >
                            {r.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {g.hero && g.props.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--surface-2)", display: "flex", flexDirection: "column" }}>
                    {g.props.map((p) => (
                      <PropRow key={p.key} p={p} sport={sport} onOpen={() => onOpenProp(sport, p.playerId, p.marketId)} />
                    ))}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "nowrap", padding: "12px 14px", minHeight: 44 }}>
                      <span
                        style={{
                          fontFamily: MONO, fontSize: 10.5, color: "var(--dim)",
                          minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                      >
                        {g.rest}
                      </span>
                      <span
                        onClick={() => onOpenGameProps(g)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenGameProps(g); } }}
                        style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", color: "var(--amber-ink)", cursor: "pointer", whiteSpace: "nowrap", flex: "0 0 auto" }}
                      >
                        OPEN IN FEED →
                      </span>
                    </div>
                  </div>
                )}

                {/* A quiet game is shown rather than dropped, and says what it
                    was missing. */}
                {g.quiet && (
                  <div style={{ padding: "0 14px 13px" }}>
                    <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)", textWrap: "pretty" }}>{g.quietWhy}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        <span style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.7, color: "var(--dim)" }}>{footNote}</span>
      </div>
    </>
  );
}
