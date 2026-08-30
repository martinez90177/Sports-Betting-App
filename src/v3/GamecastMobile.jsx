import React from "react";
import PlayerAvatar from "../PlayerAvatar.jsx";
import { crest } from "./FormPlot.jsx";

// A transcription of frame `3b` in `v3 Mocks/PropPalace Mobile v3.dc.html`.
//
// Only what the provider returns. The linescore draws the innings actually
// played and leaves the rest blank — not zero. Props in play are derived from
// the slip through `buildPropsInPlay`, so this panel and My Picks read one
// array; a market the boxscore does not carry is named as unfollowable rather
// than estimated from something adjacent.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

const sectionLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };

export default function GamecastMobile({
  onBack,
  state,
  live,
  clock,
  sides = [],
  linescore,
  linescoreNote,
  slipLegs = [],
  propsInPlay = [],
  untracked = 0,
  untrackedNames = [],
  leaders = [],
  sport,
  loading = false,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 12px 10px", minHeight: 48 }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onBack}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack && onBack(); } }}
          style={{
            minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", padding: "0 8px",
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--amber-ink)",
            whiteSpace: "nowrap", cursor: "pointer",
          }}
        >
          ← GAMES
        </span>
        <span
          style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", padding: "4px 8px", borderRadius: 5,
            flex: "0 0 auto", background: live ? "rgba(239,91,91,0.16)" : "rgba(139,152,171,0.14)",
            color: live ? "var(--neg)" : "var(--dim)",
          }}
        >
          {state}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {clock}
        </span>

      </div>

      <div style={{ margin: "0 16px 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", display: "flex", overflow: "hidden" }}>
        {sides.map((s) => (
          <div
            key={s.side}
            style={{
              flex: "1 1 0", minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: "14px 13px",
              borderRight: s.side === "away" ? "1px solid var(--line)" : "none",
              borderTop: `3px solid ${s.lead ? "var(--pos)" : "transparent"}`,
            }}
          >
            <span role="img" style={crest(s.abbr, sport, 30)} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
              <span style={{ fontSize: 15, fontWeight: s.lead ? 700 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.name}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>{s.meta}</span>
            </span>
            {/* A game with no score yet shows none. */}
            <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, flex: "0 0 auto", color: s.lead ? "var(--pos)" : "var(--text-2)" }}>
              {s.score == null ? "—" : s.score}
            </span>
          </div>
        ))}
      </div>

      <div style={{ margin: "0 16px 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", overflow: "hidden" }}>
        <div style={{ padding: "11px 13px 9px" }}>
          <span style={sectionLabel}>LINESCORE</span>
        </div>
        {loading && <div style={{ padding: "0 13px 13px", fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>Loading…</div>}
        {!loading && !linescore && (
          <div style={{ padding: "0 13px 13px", fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>No linescore available yet.</div>
        )}
        {!loading && linescore && (
          <>
            <div className="nsb" style={{ overflowX: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `46px repeat(${linescore.columns.length}, minmax(26px, 1fr))`,
                  minWidth: "max-content",
                }}
              >
                <span style={{ ...headCell(), paddingLeft: 13, textAlign: "left" }} />
                {linescore.columns.map((c) => (
                  <span key={c.key} style={headCell()}>{c.label}</span>
                ))}
                {linescore.rows.map((row) => (
                  <React.Fragment key={row.abbr}>
                    <span style={{ ...bodyCell(false), paddingLeft: 13, textAlign: "left", color: "var(--text-2)" }}>{row.abbr || "—"}</span>
                    {row.cells.map((v, i) => (
                      <span key={linescore.columns[i]?.key || i} style={bodyCell(!!linescore.columns[i]?.total)}>
                        {/* A period not yet played has no value -- it stays
                            blank instead of becoming a 0. */}
                        {v === "" ? "" : v}
                      </span>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
            {linescoreNote && (
              <div style={{ padding: "10px 13px 13px", fontFamily: MONO, fontSize: 10.5, lineHeight: 1.6, color: "var(--dim)" }}>{linescoreNote}</div>
            )}
          </>
        )}
      </div>

      <div style={{ margin: "0 16px 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "11px 13px", borderBottom: "1px solid var(--line)" }}>
          <span style={sectionLabel}>PROPS IN PLAY</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
            {`YOUR ${slipLegs.length} ${slipLegs.length === 1 ? "LEG" : "LEGS"} IN THIS GAME`}
          </span>
        </div>
        {propsInPlay.map((p) => (
          <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 13px", borderBottom: "1px solid #20242b", minHeight: 44 }}>
            <span style={{ position: "relative", flex: "0 0 auto" }}>
              <PlayerAvatar name={p.name} alt={p.name} sport={sport} team={p.teamAbbr} headshotSrc={p.headshot} size={32} inset={2} surface="var(--surface-1)" />
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                <span role="img" style={crest(p.teamAbbr, sport, 13)} />
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {`Over ${p.line} ${p.marketLabel}`}
              </span>
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flex: "0 0 auto" }}>
              <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: p.passed ? "var(--pos)" : "var(--text-2)" }}>{p.value}</span>
              {/* An unfinished prop under its line is IN PLAY, never a miss.
                  Only a final game can settle one. */}
              <span
                style={{
                  fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", padding: "3px 7px", borderRadius: 999,
                  whiteSpace: "nowrap",
                  background: p.passed ? "var(--pos-dim)" : "rgba(139,152,171,0.14)",
                  color: p.passed ? "var(--pos)" : "var(--dim)",
                }}
              >
                {p.passed ? "CLEARED" : p.settled ? "SHORT" : "IN PLAY"}
              </span>
            </span>
          </div>
        ))}
        {slipLegs.length === 0 && (
          <div style={{ padding: "14px 13px", fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)" }}>
            Nothing on your slip is in this game.
          </div>
        )}
        {slipLegs.length > 0 && (
          <div style={{ padding: "12px 13px", fontFamily: MONO, fontSize: 10.5, lineHeight: 1.6, color: "var(--dim)" }}>
            Tonight's production against the line, not a hit rate. A leg under its line while the game runs is in play, never a miss — only a final game can make it one.
          </div>
        )}
        {untracked > 0 && (
          <div style={{ padding: "0 13px 13px", fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)" }}>
            {`${untracked} ${untracked === 1 ? "leg is" : "legs are"} not here${untrackedNames.length ? `: ${untrackedNames.join(", ")}` : ""} — that market is not a column this boxscore carries, so it cannot be followed live rather than estimated from something adjacent.`}
          </div>
        )}
      </div>

      {leaders.length > 0 && (
        <div style={{ margin: "0 16px 26px", display: "flex", flexDirection: "column", gap: 9 }}>
          <span style={sectionLabel}>LEADERS</span>
          <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", overflow: "hidden" }}>
            {leaders.map((l, i) => (
              <div
                key={`-`}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", minHeight: 44,
                  borderBottom: i < leaders.length - 1 ? "1px solid #20242b" : "none",
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: "var(--dim)", flex: "0 0 88px" }}>{l.cat}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: "1 1 auto" }}>
                  <span style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
                  <span role="img" style={crest(l.team, sport, 13)} />
                </span>
                <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, flex: "0 0 auto" }}>{l.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const headCell = () => ({
  fontFamily: MONO, fontSize: 10, textAlign: "center", padding: "9px 0 7px",
  color: "var(--dim)", borderBottom: "1px solid var(--line)", background: "var(--surface-2)",
});

const bodyCell = (total) => ({
  fontFamily: MONO, fontSize: 12, textAlign: "center", padding: "10px 0",
  fontWeight: total ? 700 : 400, color: total ? "var(--text)" : "var(--text-2)",
});
