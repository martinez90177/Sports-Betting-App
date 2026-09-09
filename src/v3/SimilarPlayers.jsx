// How players like this one have done against tonight's defence.
//
// The question the H2H column cannot answer. Most NFL pairs never meet -- a
// seventeen-game schedule against thirty-one possible opponents -- so a
// receiver facing New England for the first time has an empty H2H cell and no
// history at all, when the league has played that defence forty times.
//
// **What this is graded against, precisely.** Every comparable game is scored
// against the line being read right now, not against whatever that game's own
// line was. PropsMadness grades theirs against each game's closing line, which
// needs historical odds this app does not have. So the sentence here is "if
// tonight's number had been posted for them, this is how often it cleared",
// and the card says so rather than implying a line history it cannot show.
//
// A thin set is marked, never hidden, and never averaged into a verdict: the
// same rule the rest of the app follows.

import React from "react";

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

// Under this the card states the count and refuses the rate. Ten games against
// one defence is where a share of them starts meaning anything; below it a
// single blowout moves the number ten points.
const SUPPORT = 10;
const MAX_ROWS = 12;

const shortDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? String(iso).slice(5)
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function SimilarPlayers({ rows, line, marketLabel, opp, position, mode, onMode, roleUnitLabel }) {
  if (!opp) return null;

  const cleared = rows.filter((r) => r.v > line).length;
  const rate = rows.length ? cleared / rows.length : null;
  const avg = rows.length ? rows.reduce((a, r) => a + r.v, 0) / rows.length : null;
  const diff = avg == null ? null : avg - line;
  const thin = rows.length < SUPPORT;

  const label = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: "var(--dim)" };
  const cell = { fontFamily: MONO, fontSize: 12, color: "var(--text-2)" };

  const tab = (id, text) => (
    <span
      key={id}
      role="button"
      tabIndex={0}
      onClick={() => onMode(id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMode(id); } }}
      style={{
        cursor: "pointer", fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em",
        padding: "4px 9px", borderRadius: 6,
        border: `1px solid ${mode === id ? "var(--amber)" : "var(--line)"}`,
        background: mode === id ? "var(--amber-dim)" : "transparent",
        color: mode === id ? "var(--amber-ink)" : "var(--dim)",
      }}
    >
      {text}
    </span>
  );

  return (
    <div style={{ flex: "0 0 auto", border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "14px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16 }}>
          {`Similar players vs ${opp}`}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>{marketLabel}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {tab("position", `ALL ${String(position || "").toUpperCase()}`)}
          {tab("role", "SIMILAR ROLE")}
        </span>
      </div>

      {rows.length === 0 ? (
        // Named, not blank. An empty card here means the pool holds nobody at
        // this position with a game against them -- which is a fact about the
        // schedule, not a gap in the page.
        <div style={{ padding: "16px 18px", fontFamily: MONO, fontSize: 11.5, color: "var(--dim)", lineHeight: 1.6 }}>
          {mode === "role"
            ? `No ${position} carrying a comparable workload has faced ${opp} in the logs loaded. Try ALL ${String(position || "").toUpperCase()}.`
            : `No ${position} in the pool has faced ${opp} in the logs loaded.`}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid var(--line)" }}>
            {[
              {
                k: "rate",
                head: "CLEARED TONIGHT'S LINE",
                // Under the support band the count is the whole statement --
                // the same rule the H2H column follows.
                value: thin ? `${cleared} of ${rows.length}` : `${Math.round(rate * 100)}%`,
                sub: thin ? "too few to put a rate on" : `${cleared} of ${rows.length} games`,
                tone: thin ? "var(--dim)" : rate >= 0.6 ? "var(--pos)" : rate <= 0.4 ? "var(--neg)" : "var(--text)",
              },
              {
                k: "avg",
                head: "THEIR AVERAGE",
                value: avg == null ? "—" : avg.toFixed(1),
                sub: `line is ${line}`,
                tone: "var(--text)",
              },
              {
                k: "diff",
                head: "VS THE LINE",
                value: diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`,
                sub: diff == null ? "" : diff > 0 ? "above" : "below",
                tone: diff == null ? "var(--dim)" : diff > 0 ? "var(--pos)" : "var(--neg)",
              },
            ].map((c, i) => (
              <div key={c.k} style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 3, borderRight: i < 2 ? "1px solid var(--line)" : "none" }}>
                <span style={label}>{c.head}</span>
                <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: c.tone }}>{c.value}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{c.sub}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 56px 64px 60px", padding: "9px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)", ...label }}>
            <span>DATE</span>
            <span>PLAYER</span>
            <span>TEAM</span>
            <span style={{ textAlign: "right" }}>RESULT</span>
            <span style={{ textAlign: "right" }}>VS LINE</span>
          </div>

          {rows.slice(0, MAX_ROWS).map((r) => {
            const over = r.v > line;
            return (
              <div
                key={r.key}
                style={{
                  display: "grid", gridTemplateColumns: "72px 1fr 56px 64px 60px", alignItems: "center",
                  padding: "10px 18px", borderBottom: "1px solid #20242b",
                }}
              >
                <span style={{ ...cell, color: "var(--dim)" }}>{shortDate(r.date)}</span>
                <span style={{ ...cell, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                <span style={{ ...cell, color: "var(--dim)" }}>{`${r.home === false ? "@" : ""}${r.team || ""}`}</span>
                <span style={{ ...cell, textAlign: "right", fontWeight: 700, color: "var(--text)" }}>{r.v}</span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, textAlign: "right", fontWeight: 700, color: over ? "var(--pos)" : "var(--neg)" }}>
                  {`${over ? "+" : ""}${(r.v - line).toFixed(1)}`}
                </span>
              </div>
            );
          })}

          <div style={{ padding: "10px 18px 14px", fontFamily: MONO, fontSize: 10, lineHeight: 1.6, color: "var(--dim)" }}>
            {`${rows.length > MAX_ROWS ? `Showing ${MAX_ROWS} of ${rows.length} games. ` : ""}`}
            Each game is graded against tonight's line of {line}, not against whatever line
            that game was posted at — there is no line history here to grade them by.
            {mode === "role" && roleUnitLabel ? ` Comparable means a workload within about half again this player's ${roleUnitLabel}.` : ""}
          </div>
        </>
      )}
    </div>
  );
}
