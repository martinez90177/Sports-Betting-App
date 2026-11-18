import React from "react";

// Team opportunity share (NFL): who on this offense gets the targets and the
// carries, over the team's last 3, last 6 or every game this season. Counted
// from the box-score logs of everyone on the roster; a player's share is his
// total over the team's total for those same games.

const card = { border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", display: "flex", flexDirection: "column", padding: "14px 16px", gap: 12 };
const th = { fontSize: 11, fontWeight: 600, color: "var(--dim)", textAlign: "right", padding: "6px 8px", whiteSpace: "nowrap" };
const td = { fontSize: 13, color: "var(--text)", textAlign: "right", padding: "7px 8px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

function seg(on) {
  return {
    padding: "6px 12px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
    background: on ? "var(--amber)" : "transparent", color: on ? "var(--accent-on, #fff)" : "var(--text-2)",
  };
}
const Seg = ({ options, value, onPick }) => (
  <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 9, background: "var(--bg)", border: "1px solid var(--line)" }}>
    {options.map((o) => (
      <span key={o.id} role="button" tabIndex={0} onClick={() => onPick(o.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(o.id); } }}
        style={seg(value === o.id)}>{o.label}</span>
    ))}
  </div>
);

// games: [{ date, players: { [id]: { tgt, rushAtt } } }] oldest first
// roster: [{ id, name, pos }]
export function buildOpportunity(teamGames, roster, kind, windowId) {
  const n = windowId === "l3" ? 3 : windowId === "l6" ? 6 : teamGames.length;
  const games = teamGames.slice(-n);
  const key = kind === "carries" ? "rushAtt" : "tgt";
  let teamTotal = 0;
  const per = {};
  games.forEach((g) => {
    Object.entries(g.players).forEach(([id, s]) => {
      const v = Number.isFinite(s[key]) ? s[key] : 0;
      teamTotal += v;
      const p = (per[id] = per[id] || { gp: 0, total: 0 });
      p.gp += 1;
      p.total += v;
    });
  });
  const rows = roster
    .map((r) => {
      const p = per[r.id];
      if (!p || p.total <= 0) return null;
      return { ...r, gp: p.gp, total: p.total, avg: p.total / p.gp, share: teamTotal > 0 ? p.total / teamTotal : 0 };
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total);
  return { rows, games: games.length, teamTotal };
}

export default function OpportunityShare({ team, teamGames = [], roster = [], subjectId = null, defaultKind = "targets", isPhone = false }) {
  const [kind, setKind] = React.useState(defaultKind);
  const [win, setWin] = React.useState("szn");
  React.useEffect(() => { setKind(defaultKind); }, [defaultKind]);
  if (!teamGames.length) return null;
  const { rows, games } = buildOpportunity(teamGames, roster, kind, win);
  const top = rows.length ? rows[0].share : 0;
  const unit = kind === "carries" ? "Carries" : "Targets";

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 650 }}>{team} opportunity share</span>
        <span style={{ fontSize: 12, color: "var(--dim)" }}>{games} {games === 1 ? "game" : "games"}</span>
        <div style={{ marginLeft: isPhone ? 0 : "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Seg options={[{ id: "targets", label: "Targets" }, { id: "carries", label: "Carries" }]} value={kind} onPick={setKind} />
          <Seg options={[{ id: "l3", label: "L3" }, { id: "l6", label: "L6" }, { id: "szn", label: "Season" }]} value={win} onPick={setWin} />
        </div>
      </div>
      {rows.length === 0 ? (
        <span style={{ fontSize: 12.5, color: "var(--dim)" }}>No {unit.toLowerCase()} logged for this team over these games.</span>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", paddingLeft: 0 }}>Player</th>
              {!isPhone && <th style={th}>GP</th>}
              <th style={th}>{unit}/g</th>
              {!isPhone && <th style={th}>Total</th>}
              <th style={{ ...th, paddingRight: 0, width: isPhone ? 96 : 170 }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((r) => {
              const me = r.id === subjectId;
              return (
                <tr key={r.id} style={{ borderTop: "1px solid #20242b", background: me ? "color-mix(in srgb, var(--amber) 10%, transparent)" : "transparent" }}>
                  <td style={{ ...td, textAlign: "left", paddingLeft: me ? 6 : 0 }}>
                    <span style={{ fontWeight: me ? 700 : 600 }}>{r.name}</span>
                    <span style={{ marginLeft: 6, fontSize: 11, color: "var(--dim)" }}>{r.pos}</span>
                  </td>
                  {!isPhone && <td style={{ ...td, color: "var(--text-2)" }}>{r.gp}</td>}
                  <td style={td}>{(Math.round(r.avg * 10) / 10).toFixed(1)}</td>
                  {!isPhone && <td style={{ ...td, color: "var(--text-2)" }}>{r.total}</td>}
                  <td style={{ ...td, paddingRight: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                      <span style={{ flex: "1 1 auto", maxWidth: isPhone ? 44 : 110, height: 6, borderRadius: 3, background: "var(--surface-2)", overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: `${top > 0 ? Math.round((r.share / top) * 100) : 0}%`, background: me ? "var(--amber)" : "var(--text-2)", opacity: me ? 1 : 0.55 }} />
                      </span>
                      <span style={{ fontWeight: 650, minWidth: 40 }}>{Math.round(r.share * 1000) / 10}%</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <span style={{ fontSize: 11.5, color: "var(--dim)", lineHeight: 1.45 }}>
        Share of the team's {unit.toLowerCase()} to players on the current roster, over the team's own games in the window.
      </span>
    </div>
  );
}
