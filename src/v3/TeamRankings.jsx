import React from "react";
import { crest } from "./FormPlot.jsx";
import { NFL_TEAM_RANK_ROWS } from "../lib/nflTeamStats.js";

// One side's offense against the other side's defense, stat by stat, each
// with its rank across the league. Outlier's matchup page leads with the same
// table; the numbers here are ESPN's team statistics and the ranks are ours
// (see lib/nflTeamStats.js for why).
//
// Rank tone is in thirds of however many teams were ranked: the top third
// reads green and the bottom third red *for the side it sits on*, so a green
// offense beside a red defense is the mismatch the table exists to show.
// These are not availability colours and are never drawn as a dot.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const micro = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };

const toneFor = (cell) => {
  if (!cell || !cell.of) return "var(--text-2)";
  if (cell.rank <= cell.of / 3) return "var(--pos)";
  if (cell.rank > (cell.of * 2) / 3) return "var(--neg)";
  return "var(--text-2)";
};
const rankText = (cell) => (cell ? `${cell.tied ? "T" : "#"}${cell.rank}` : "—");
const valueText = (cell, dp) => (cell && Number.isFinite(cell.value) ? cell.value.toFixed(dp) : "—");

function chip(on) {
  return {
    minHeight: 28, display: "flex", alignItems: "center", padding: "0 10px", borderRadius: 7,
    fontFamily: MONO, fontSize: 10.5, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
    background: on ? "var(--amber-dim)" : "var(--surface-1)",
    color: on ? "var(--amber-ink)" : "var(--text-2)",
  };
}

export default function TeamRankings({ sport, data, compact = false }) {
  // Which side is on offense. Starts with the visitors, as the page reads.
  const [flip, setFlip] = React.useState(false);
  if (!data) return null;

  const { away, home, seasons = [], loading, error, teamsLoaded, teamsTotal, season } = data;
  const offense = flip ? home : away;
  const defense = flip ? away : home;
  const pad = compact ? "12px 14px" : "14px 16px";
  const key = (fn) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };

  const head = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={micro}>TEAM RANKINGS</span>
      <span style={{ display: "flex", gap: 6, marginLeft: compact ? 0 : "auto", flexWrap: "wrap" }}>
        {seasons.map((s) => (
          <span key={s.id} role="button" tabIndex={0} onClick={s.onPick} onKeyDown={key(s.onPick)} style={chip(s.active)}>
            {s.label}
          </span>
        ))}
        <span
          role="button" tabIndex={0}
          onClick={() => setFlip((v) => !v)} onKeyDown={key(() => setFlip((v) => !v))}
          title="Swap which side is on offense"
          style={chip(false)}
        >
          {`${defense.abbr} OFFENSE ⇄`}
        </span>
      </span>
    </div>
  );

  if (loading || error || !offense.off) {
    return (
      <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", padding: pad, display: "flex", flexDirection: "column", gap: 10 }}>
        {head}
        <span style={{ fontSize: 12.5, color: "var(--dim)" }}>
          {loading ? "Reading both teams' season statistics…" : "Couldn't load team statistics for this matchup right now."}
        </span>
      </div>
    );
  }

  const cols = compact ? "minmax(0, 1fr) minmax(88px, auto) minmax(0, 1fr)" : "minmax(0, 1fr) 150px minmax(0, 1fr)";

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: pad, borderBottom: "1px solid var(--line)" }}>{head}</div>

      <div style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", gap: 10, padding: compact ? "10px 14px" : "10px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <span role="img" style={crest(offense.abbr, sport, 18)} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 13 }}>{offense.abbr}</span>
          <span style={micro}>OFFENSE</span>
        </span>
        <span style={{ ...micro, textAlign: "center" }}>PER GAME</span>
        <span style={{ display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-end", minWidth: 0 }}>
          <span style={micro}>DEFENSE</span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 13 }}>{defense.abbr}</span>
          <span role="img" style={crest(defense.abbr, sport, 18)} />
        </span>
      </div>

      {NFL_TEAM_RANK_ROWS.map((row) => {
        const o = offense.off[row.id];
        const d = defense.def[row.id];
        return (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", gap: 10, padding: compact ? "9px 14px" : "9px 16px", borderBottom: "1px solid #20242b" }}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700 }}>{valueText(o, row.dp)}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: toneFor(o) }}>{rankText(o)}</span>
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 1 }}>
              <span style={{ fontSize: 12.5, color: "var(--text)" }}>{row.label}</span>
              {row.sides && (
                <span style={{ fontFamily: MONO, fontSize: 9.5, color: "var(--dim)" }}>{`${row.sides[0]} · ${row.sides[1]}`}</span>
              )}
            </span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "flex-end", minWidth: 0 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: toneFor(d) }}>{rankText(d)}</span>
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700 }}>{valueText(d, row.dp)}</span>
            </span>
          </div>
        );
      })}

      <div style={{ padding: compact ? "10px 14px 12px" : "10px 16px 14px", fontFamily: MONO, fontSize: 10, lineHeight: 1.6, color: "var(--dim)" }}>
        {`${season} regular season, per game. ${offense.abbr} ${offense.games} game${offense.games === 1 ? "" : "s"}, ${defense.abbr} ${defense.games}. `}
        {`Ranked across ${teamsLoaded < teamsTotal ? `the ${teamsLoaded} of ${teamsTotal} teams that loaded` : `all ${teamsTotal} teams`}; #1 is the best offense on the left and the best defense on the right. `}
        {Math.min(offense.games, defense.games) < 4 ? "Under four games a rank moves a lot — the other season is one tap away." : ""}
      </div>
    </div>
  );
}
