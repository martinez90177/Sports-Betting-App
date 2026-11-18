import React from "react";
import { crest } from "./FormPlot.jsx";

// "This stat vs <opponent>": every player who has faced tonight's defense this
// season, at the subject's position by default, with what they put up against
// it and how that compares with their own season average.
//
// There is no historical line for most of these players, so the honest
// comparison is each player against himself: a defense that keeps handing
// guards more than their usual is soft on guards, whatever its overall rank.
// Tonight's line is shown beside it as a second read.

const card = { border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", display: "flex", flexDirection: "column", padding: "14px 16px", gap: 12 };
const th = { fontSize: 11, fontWeight: 600, color: "var(--dim)", textAlign: "right", padding: "6px 8px", whiteSpace: "nowrap" };
const td = { fontSize: 13, color: "var(--text)", textAlign: "right", padding: "7px 8px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

function tabStyle(on) {
  return {
    padding: "6px 12px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
    background: on ? "var(--amber)" : "transparent", color: on ? "var(--accent-on, #fff)" : "var(--text-2)",
  };
}

export default function VsDefense({ sport, opp, marketShort, line = null, rows = [], groups = [], defaultGroup = null, isPhone = false }) {
  const [group, setGroup] = React.useState(defaultGroup || "ALL");
  const [all, setAll] = React.useState(false);
  React.useEffect(() => { setGroup(defaultGroup || "ALL"); }, [defaultGroup, opp, marketShort]);

  const list = rows.filter((r) => group === "ALL" || r.group === group);
  const shown = all ? list : list.slice(0, 8);
  const beat = list.filter((r) => r.diff > 0).length;
  const overLine = line != null ? list.filter((r) => r.value > line).length : null;
  const avgDiff = list.length ? list.reduce((a, r) => a + r.diff, 0) / list.length : null;
  const groupWord = (groups.find((g) => g.id === group) || {}).label || "players";

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 650 }}>{marketShort} vs</span>
        {opp && <span role="img" style={crest(opp, sport, 20)} />}
        <span style={{ fontSize: 14, fontWeight: 650 }}>{opp}</span>
        <span style={{ fontSize: 12, color: "var(--dim)" }}>this season</span>
        {groups.length > 1 && (
          <div style={{ marginLeft: "auto", display: "inline-flex", gap: 2, padding: 3, borderRadius: 9, background: "var(--bg)", border: "1px solid var(--line)" }}>
            {groups.map((g) => (
              <span key={g.id} role="button" tabIndex={0} onClick={() => { setGroup(g.id); setAll(false); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setGroup(g.id); setAll(false); } }}
                style={tabStyle(group === g.id)}>
                {g.short}
              </span>
            ))}
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <span style={{ fontSize: 12.5, color: "var(--dim)" }}>
          No {groupWord} with a logged game against {opp} this season yet.
        </span>
      ) : (
        <>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: beat / list.length >= 0.6 ? "var(--pos)" : beat / list.length <= 0.4 ? "var(--neg)" : "var(--text)" }}>
                {beat} of {list.length}
              </span>
              <span style={{ fontSize: 12, color: "var(--dim)" }}>beat their own average</span>
            </div>
            {avgDiff != null && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: avgDiff > 0 ? "var(--pos)" : avgDiff < 0 ? "var(--neg)" : "var(--text)" }}>
                  {avgDiff > 0 ? "+" : avgDiff < 0 ? "−" : ""}{fmt(Math.round(Math.abs(avgDiff) * 10) / 10)}
                </span>
                <span style={{ fontSize: 12, color: "var(--dim)" }}>vs their average, per game</span>
              </div>
            )}
            {overLine != null && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{overLine} of {list.length}</span>
                <span style={{ fontSize: 12, color: "var(--dim)" }}>went over {line} (tonight's line)</span>
              </div>
            )}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left", paddingLeft: 0 }}>Player</th>
                <th style={th}>{marketShort}</th>
                {!isPhone && <th style={th}>Their avg</th>}
                <th style={{ ...th, paddingRight: 0 }}>vs avg</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const tone = r.diff > 0 ? "var(--pos)" : r.diff < 0 ? "var(--neg)" : "var(--dim)";
                return (
                  <tr key={r.key} style={{ borderTop: "1px solid #20242b" }}>
                    <td style={{ ...td, textAlign: "left", paddingLeft: 0, whiteSpace: "normal" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span role="img" style={crest(r.team, sport, 16)} />
                        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                          <span style={{ fontSize: 11, color: "var(--dim)" }}>{r.pos} · {r.date}</span>
                        </span>
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 700, color: line != null ? (r.value > line ? "var(--pos)" : "var(--text)") : "var(--text)" }}>{fmt(r.value)}</td>
                    {!isPhone && <td style={{ ...td, color: "var(--text-2)" }}>{fmt(Math.round(r.avg * 10) / 10)}</td>}
                    <td style={{ ...td, paddingRight: 0 }}>
                      <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 5, fontSize: 11.5, fontWeight: 650, color: tone, background: `color-mix(in srgb, ${tone} 14%, transparent)` }}>
                        {r.diff > 0 ? "+" : r.diff < 0 ? "−" : ""}{fmt(Math.round(Math.abs(r.diff) * 10) / 10)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length > 8 && (
            <span role="button" tabIndex={0} onClick={() => setAll((v) => !v)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAll((v) => !v); } }}
              style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", fontSize: 12.5, fontWeight: 600, color: "var(--amber-ink, var(--amber))", cursor: "pointer" }}>
              {all ? "Show fewer" : `Show all ${list.length}`}
            </span>
          )}
        </>
      )}
    </div>
  );
}
