import React from "react";
import PlayerAvatar from "../PlayerAvatar.jsx";
import { crest } from "./FormPlot.jsx";

// A transcription of frame `3c` in `v3 Mocks/PropPalace Mobile v3.dc.html`.
//
// Pre-game, and only what exists without an odds feed. The frame's own closing
// sentence is the whole brief: no money line, no run line, no public split,
// because this app reads no odds feed and a number borrowed from somewhere
// else is worse than an absent one.
//
// Two sections drop rather than render empty, which is what the desktop page
// already does and for the same reasons:
//
//   PROBABLE PITCHERS  only MLB publishes them, and only `game.probables`
//                      carries them. A sport without them is a finished page,
//                      not a page with a hole in it.
//   HEAD TO HEAD       `fetchHeadToHead` answers for MLB alone. Where it does
//                      answer, every outcome gets a line -- a real record,
//                      "they have not met", or "we could not check".
//
// The mock's own form rows are seeded arithmetic (`us = 1 + ((i * 5 + seed) %
// 9)`), a placeholder for real results. They come from `fetchRecentForm` here.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

const sectionLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };
const footNote = { fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)", textWrap: "pretty" };
const card = { border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", overflow: "hidden" };

export default function MatchupMobile({
  onBack,
  onOpenBoard,
  state,
  live = false,
  venue,
  sides = [],
  sport,
  probables = null,        // { away: {...}, home: {...} } or null where the sport has none
  probableNote = null,
  depth,
  depths = [],
  onSetDepth,
  form = [],               // [{ abbr, record, wonPct, loading, error, games: [...] }]
  h2h = null,              // { cells: [{label, value}], note } or null
  reads = null,            // undefined = loading, null = unsupported, [] = none
  readScope,
  onOpenRead,
  slipDock = null,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px 8px", minHeight: 48 }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onBack}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack && onBack(); } }}
          style={{
            flex: "0 0 auto", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", padding: "0 8px",
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--amber-ink)",
            whiteSpace: "nowrap", cursor: "pointer",
          }}
        >
          ← GAMES
        </span>
        <span style={{ flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, overflow: "hidden" }}>
          <span
            style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", padding: "4px 8px", borderRadius: 5,
              flex: "0 0 auto",
              background: live ? "rgba(239,91,91,0.16)" : "var(--amber-dim)",
              color: live ? "var(--neg)" : "var(--amber-ink)",
            }}
          >
            {state}
          </span>
          {venue && (
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {venue}
            </span>
          )}
        </span>
        {onOpenBoard && (
          <span
            role="button"
            tabIndex={0}
            onClick={onOpenBoard}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenBoard(); } }}
            style={{
              flex: "0 0 auto", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "flex-end",
              padding: "0 8px", fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em",
              color: "var(--amber-ink)", whiteSpace: "nowrap", cursor: "pointer",
            }}
          >
            BOARD →
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "stretch", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        {sides.map((s, i) => (
          <div
            key={s.abbr || i}
            style={{
              flex: "1 1 0", minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: "14px 13px",
              borderRight: i === 0 ? "1px solid var(--line)" : "none",
            }}
          >
            <span role="img" style={crest(s.abbr, sport, 30)} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>{s.meta}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Only MLB publishes probable starters, and only where the slate row
          actually carries them. Dropped rather than drawn empty. */}
      {probables && (
        <div style={{ padding: "14px 16px 0", display: "flex", flexDirection: "column", gap: 9 }}>
          <span style={sectionLabel}>PROBABLE PITCHERS</span>
          <div style={{ ...card, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            {probables.map((p, i) => (
              <div
                key={p.key}
                style={{
                  display: "flex", flexDirection: "column", gap: 7, padding: 13, minWidth: 0,
                  borderRight: i === 0 ? "1px solid var(--line)" : "none",
                }}
              >
                <span style={{ alignSelf: "flex-start" }}>
                  {/* Rule 1: a named player travels with their face and their
                      availability. A pending or failed read draws no dot. */}
                  <PlayerAvatar
                    name={p.name} alt={p.name} sport={sport} team={p.team}
                    headshotSrc={p.headshotSrc} status={p.status}
                    size={40} inset={2} surface="var(--surface-1)"
                  />
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, textWrap: "pretty" }}>{p.name}</span>
                {p.hand && <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--text-2)" }}>{p.hand}</span>}
                {p.line && <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>{p.line}</span>}
              </div>
            ))}
          </div>
          {probableNote && <span style={footNote}>{probableNote}</span>}
        </div>
      )}

      <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <span style={sectionLabel}>RECENT FORM</span>
          <div style={{ display: "flex", gap: 6 }}>
            {depths.map((n) => {
              const on = depth === n;
              return (
                <div
                  key={n}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSetDepth && onSetDepth(n)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSetDepth && onSetDepth(n); } }}
                  style={{
                    minHeight: 32, display: "flex", alignItems: "center", padding: "0 10px",
                    borderRadius: 7, fontFamily: MONO, fontSize: 11, cursor: "pointer",
                    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                    background: on ? "var(--amber-dim)" : "var(--surface-1)",
                    color: on ? "var(--amber-ink)" : "var(--text-2)",
                  }}
                >
                  {`L${n}`}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {form.map((t) => (
            <div key={t.abbr} style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span role="img" style={crest(t.abbr, sport, 16)} />
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)" }}>{t.abbr}</span>
                <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>{t.record}</span>
              </div>
              {/* The bar and the log under it are the same rows counted twice,
                  so they can never disagree. No rows means no bar -- an empty
                  track would read as nought wins from nought games.

                  Three segments, not the mock's two: the NFL has ties, and a
                  drawn game is neither the green outcome nor the red one. It
                  takes the neutral fill rather than being folded into a loss. */}
              {t.games.length > 0 && (
                <div style={{ display: "flex", height: 8, borderRadius: 2, overflow: "hidden", background: "var(--surface-2)" }}>
                  <span style={{ width: `${t.wonPct}%`, background: "var(--pos)", display: "block" }} />
                  {t.tiedPct > 0 && <span style={{ width: `${t.tiedPct}%`, background: "var(--dim)", display: "block" }} />}
                  <span style={{ width: `${100 - t.wonPct - t.tiedPct}%`, background: "var(--neg)", display: "block" }} />
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {t.games.length === 0 && (
                  <span style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.6, color: "var(--dim)" }}>
                    {t.loading ? "Loading…" : t.error ? "Couldn't load recent results." : "No finished games yet."}
                  </span>
                )}
                {t.games.map((g, i) => (
                  <div key={`${g.date}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--surface-2)" }}>
                    <span
                      style={{
                        fontFamily: MONO, fontSize: 10.5, fontWeight: 700, flex: "0 0 12px",
                        color: g.res === "W" ? "var(--pos)" : g.res === "L" ? "var(--neg)" : "var(--dim)",
                      }}
                    >
                      {g.res}
                    </span>
                    <span style={{ display: "flex", alignItems: "baseline", fontFamily: MONO, fontSize: 10.5, color: "var(--text-2)", whiteSpace: "nowrap", flex: "1 1 auto", minWidth: 0 }}>
                      {/* The @ is the away marker and only appears on away
                          games -- accent-coloured, because it is a mark, not
                          an outcome. */}
                      {!g.home && (
                        <span style={{ fontFamily: "'Archivo', system-ui, sans-serif", fontSize: 11, fontWeight: 700, color: "var(--amber-ink)", paddingRight: 4, letterSpacing: 0 }}>@</span>
                      )}
                      <span>{g.opp}</span>
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", flex: "0 0 auto" }}>{g.score}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MLB alone has a season series this app can read. A sport without one
          drops the section rather than heading blank space. */}
      {h2h && (
        <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 9 }}>
          <span style={sectionLabel}>HEAD TO HEAD</span>
          <div style={card}>
            {h2h.cells && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                {h2h.cells.map((c, i) => (
                  <div
                    key={c.label}
                    style={{
                      padding: 13, display: "flex", flexDirection: "column", gap: 3, minWidth: 0,
                      borderRight: i < 2 ? "1px solid var(--line)" : "none",
                    }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: "var(--dim)" }}>{c.label}</span>
                    <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700 }}>{c.value}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ padding: "12px 13px", borderTop: h2h.cells ? "1px solid var(--line)" : "none", fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)" }}>
              {h2h.note}
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "16px 16px 26px", display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <span style={sectionLabel}>PROPS WITH A READ</span>
          {readScope && <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{readScope}</span>}
        </div>
        <div style={card}>
          {reads === undefined && (
            <div style={{ padding: "14px 13px", fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>Working out this game's props…</div>
          )}
          {reads !== undefined && (!reads || reads.length === 0) && (
            <div style={{ padding: "14px 13px", fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)" }}>
              Nothing in this game clears the sample floor yet.
            </div>
          )}
          {(reads || []).map((r) => (
            <div
              key={r.key}
              role="button"
              tabIndex={0}
              onClick={() => onOpenRead && onOpenRead(r)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenRead && onOpenRead(r); } }}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 13px", borderBottom: "1px solid #20242b", minHeight: 44, cursor: "pointer" }}
            >
              <span style={{ position: "relative", flex: "0 0 auto" }}>
                <PlayerAvatar
                  name={r.name} alt={r.name} sport={r.sport || sport} team={r.team}
                  headshotSrc={r.headshotSrc} status={r.status}
                  size={34} inset={2} surface="var(--surface-1)"
                />
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 auto" }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                  <span role="img" style={crest(r.team, r.sport || sport, 13)} />
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.prop}
                </span>
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "0 0 auto" }}>
                <span
                  style={{
                    fontFamily: MONO, fontSize: 15, fontWeight: 700,
                    color: r.rate >= 0.7 ? "var(--pos)" : r.rate >= 0.6 ? "var(--status-questionable)" : "var(--text-2)",
                  }}
                >
                  {`${Math.round(r.rate * 100)}%`}
                </span>
                {/* Every rate with its sample, both off the same array. A thin
                    one says so rather than being dressed as settled. */}
                <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
                  {`${r.hits} of ${r.n}${r.thin ? " · too few" : ""}`}
                </span>
              </span>
            </div>
          ))}
        </div>
        <span style={footNote}>
          No money line, run line or public split here — this app reads no odds feed, so there is nothing to show rather than a number borrowed from somewhere else.
        </span>
      </div>

      {slipDock}
    </div>
  );
}
