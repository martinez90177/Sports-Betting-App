import React from "react";
import { crest } from "./FormPlot.jsx";
import { teamSplits, teamTrends, gradeGame, fmtAmerican, fmtSpread } from "../lib/gameLines.js";

// Lines and betting records for one game, on the Matchup page.
//
// Tonight's numbers are the book's (DraftKings, as ESPN carries them). The
// records are counted here from each finished game's closing line and final
// score -- see lib/gameLines.js -- and every split names how many games it is.

const card = { border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", display: "flex", flexDirection: "column" };
const title = { fontSize: 14, fontWeight: 650, color: "var(--text)" };
const meta = { fontSize: 12, color: "var(--dim)" };
const th = { fontSize: 11, fontWeight: 600, color: "var(--dim)", textAlign: "right", padding: "6px 8px", whiteSpace: "nowrap" };
const td = { fontSize: 13, color: "var(--text)", textAlign: "right", padding: "7px 8px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

const rateTone = (r) => (r == null ? "var(--text)" : r >= 0.65 ? "var(--pos)" : r <= 0.35 ? "var(--neg)" : "var(--text)");

// One book number: the line, and its price under it when it has one. Kept to
// two short lines so the squares stay compact on a phone.
function LineCell({ main, sub, compact }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
      padding: compact ? "7px 2px" : "9px 4px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--line)",
      minWidth: 0, overflow: "hidden", fontVariantNumeric: "tabular-nums",
    }}>
      <span style={{ fontSize: compact ? 14 : 15, fontWeight: 700, lineHeight: 1.15, whiteSpace: "nowrap" }}>{main}</span>
      {sub && <span style={{ fontSize: compact ? 11 : 11.5, lineHeight: 1.2, color: "var(--dim)", whiteSpace: "nowrap" }}>{sub}</span>}
    </div>
  );
}

// What moved since the line opened, said once under the grid instead of in
// every square. Empty when nothing moved.
function movementNote(lines, away, home) {
  const parts = [];
  const mv = (open, now, fmt) => (open != null && now != null && open !== now ? `${fmt(open)} → ${fmt(now)}` : null);
  const s = mv(lines.spread.homeOpen, lines.spread.home, fmtSpread);
  if (s) parts.push(`${home.abbr} spread ${s}`);
  const ma = mv(lines.ml.awayOpen, lines.ml.away, fmtAmerican);
  const mh = mv(lines.ml.homeOpen, lines.ml.home, fmtAmerican);
  if (ma) parts.push(`${away.abbr} ML ${ma}`);
  if (mh) parts.push(`${home.abbr} ML ${mh}`);
  const t = mv(lines.total.open, lines.total.line, (v) => String(v));
  if (t) parts.push(`total ${t}`);
  return parts.length ? parts : null;
}

const chip = (tone) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "2px 7px", borderRadius: 5, fontSize: 11.5, fontWeight: 650, whiteSpace: "nowrap",
  color: tone, background: `color-mix(in srgb, ${tone} 14%, transparent)`,
  fontVariantNumeric: "tabular-nums",
});

function RecentGames({ games, compact = false }) {
  const [all, setAll] = React.useState(false);
  const shown = (all ? games : games.slice(-5)).slice().reverse(); // newest first
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32 }}>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--text-2)" }}>Recent games</span>
        {games.length > 5 && (
          <span role="button" tabIndex={0} onClick={() => setAll((v) => !v)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAll((v) => !v); } }}
            style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 600, color: "var(--amber-ink, var(--amber))", cursor: "pointer" }}>
            {all ? "Show last 5" : `Show last ${games.length}`}
          </span>
        )}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left", paddingLeft: 0 }}>Game</th>
            {!compact && <th style={th}>Line</th>}
            <th style={th}>Spread</th>
            <th style={{ ...th, paddingRight: 0 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((g) => {
            const x = gradeGame(g);
            const L = g.line;
            const atsTone = x.ats === 1 ? "var(--pos)" : x.ats === -1 ? "var(--neg)" : "var(--dim)";
            // Over and under are neither good nor bad, so they share one tone.
            const ouTone = x.ou === 0 ? "var(--dim)" : "var(--text-2)";
            const by = x.atsMargin == null ? null : Math.abs(x.atsMargin);
            return (
              <tr key={g.id} style={{ borderTop: "1px solid #20242b" }}>
                <td style={{ ...td, textAlign: "left", paddingLeft: 0 }}>
                  <span style={{ color: "var(--dim)" }}>{g.home ? "vs" : "@"}</span> {g.opp}
                  <span style={{ marginLeft: 8, fontWeight: 650, color: x.win ? "var(--pos)" : "var(--neg)" }}>{x.win ? "W" : "L"}</span>
                  <span style={{ marginLeft: 5, color: "var(--text-2)" }}>{g.pf}-{g.pa}</span>
                </td>
                {!compact && <td style={{ ...td, color: "var(--text-2)" }}>{L && L.spread != null ? fmtSpread(L.spread) : "—"}</td>}
                <td style={{ ...td, padding: compact ? "7px 4px" : td.padding }}>
                  {x.ats == null ? <span style={{ color: "var(--dim)" }}>—</span>
                    : compact
                      ? <span style={chip(atsTone)}>{fmtSpread(L.spread)} {x.ats === 1 ? "✓" : x.ats === -1 ? "✗" : "P"}</span>
                      : <span style={chip(atsTone)}>{x.ats === 1 ? `Covered +${by}` : x.ats === -1 ? `Missed −${by}` : "Push"}</span>}
                </td>
                <td style={{ ...td, paddingRight: 0, padding: compact ? "7px 0 7px 4px" : td.padding }}>
                  {x.ou == null ? <span style={{ color: "var(--dim)" }}>—</span>
                    : <span style={chip(ouTone)}>{compact ? (x.ou === 1 ? "O" : x.ou === -1 ? "U" : "P") : (x.ou === 1 ? "Over" : x.ou === -1 ? "Under" : "Push")} {L.total}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TeamRecords({ sport, team, hist, home, fav, compact = false }) {
  const rows = hist && hist !== "error" ? teamSplits(hist, { home, fav }) : null;
  const games = rows ? hist.games : [];
  const last = games.slice(-10);
  return (
    <div style={{ ...card, padding: "14px 16px", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span role="img" style={crest(team.abbr, sport, 22)} />
        <span style={title}>{team.name || team.abbr}</span>
        {rows && <span style={{ ...meta, marginLeft: "auto" }}>{games.length} games</span>}
      </div>
      {hist == null && <span style={meta}>Reading this season's results and closing lines…</span>}
      {hist === "error" && <span style={meta}>The schedule could not be read right now.</span>}
      {rows && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <th style={{ ...th, textAlign: "left", paddingLeft: 0 }}>Split</th>
              <th style={th}>Win-loss</th>
              <th style={th}>Spread</th>
              <th style={th}>Over-under</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #20242b" }}>
                <td style={{ ...td, textAlign: "left", paddingLeft: 0, color: "var(--text-2)" }}>
                  {r.label} <span style={{ fontSize: 11, color: "var(--dim)" }}>({r.n})</span>
                </td>
                <td style={td}>{r.su}</td>
                <td style={{ ...td, fontWeight: 650, color: rateTone(r.atsRate) }}>{r.ats}</td>
                <td style={{ ...td, color: "var(--text)" }}>{r.ou}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* Recent games, one line each: who, the score, the closing spread,
          whether it covered and by how much, and over or under. */}
      {rows && last.length > 0 && (
        <RecentGames games={last} compact={compact} />
      )}
    </div>
  );
}

export default function GameBetting({ sport, away, home, lines, awayHist, homeHist, isPhone = false }) {
  const awayFav = lines && lines.spread.away != null ? lines.spread.away < 0 : lines && lines.ml.away != null ? lines.ml.away < 0 : null;
  const homeFav = awayFav == null ? null : !awayFav;
  const trends = [
    ...(awayHist && awayHist !== "error" ? teamTrends(away.name || away.abbr, awayHist, { home: false, fav: awayFav }) : []),
    ...(homeHist && homeHist !== "error" ? teamTrends(home.name || home.abbr, homeHist, { home: true, fav: homeFav }) : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...card, padding: "14px 16px", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={title}>Game lines</span>
          <span style={meta}>{lines ? `${lines.book} · current line` : "No line posted for this game yet."}</span>
        </div>
        {lines && (
          <div style={{ display: "grid", gridTemplateColumns: isPhone ? "auto repeat(3, minmax(0, 1fr))" : "160px repeat(3, minmax(0, 1fr))", gap: isPhone ? 6 : 8, alignItems: "stretch" }}>
            <span />
            <span style={{ ...th, textAlign: "center", padding: 0 }}>Spread</span>
            <span style={{ ...th, textAlign: "center", padding: 0 }}>Moneyline</span>
            <span style={{ ...th, textAlign: "center", padding: 0 }}>Total</span>
            {[["away", away], ["home", home]].map(([side, t]) => (
              <React.Fragment key={side}>
                <span style={{ display: "flex", alignItems: "center", gap: isPhone ? 6 : 8, minWidth: 0 }}>
                  <span role="img" style={crest(t.abbr, sport, isPhone ? 30 : 22)} />
                  <span style={{ fontSize: isPhone ? 13 : 13.5, fontWeight: 650, whiteSpace: "nowrap", overflow: isPhone ? "visible" : "hidden", textOverflow: "ellipsis" }}>{isPhone ? t.abbr : (t.name || t.abbr)}</span>
                </span>
                <LineCell
                  compact={isPhone}
                  main={fmtSpread(lines.spread[side])}
                  sub={lines.spread[`${side}Odds`] != null ? fmtAmerican(lines.spread[`${side}Odds`]) : null}
                />
                <LineCell compact={isPhone} main={fmtAmerican(lines.ml[side])} />
                <LineCell
                  compact={isPhone}
                  main={lines.total.line == null ? "—" : `${side === "away" ? "O" : "U"} ${lines.total.line}`}
                  sub={side === "away" ? (lines.total.overOdds != null ? fmtAmerican(lines.total.overOdds) : null) : (lines.total.underOdds != null ? fmtAmerican(lines.total.underOdds) : null)}
                />
              </React.Fragment>
            ))}
          </div>
        )}
        {lines && movementNote(lines, away, home) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 11.5, lineHeight: 1.4, color: "var(--dim)" }}>
            <span style={{ color: "var(--text-2)", fontWeight: 600 }}>Since open</span>
            {movementNote(lines, away, home).map((p) => (
              <span key={p} style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{p}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        <TeamRecords sport={sport} team={away} hist={awayHist} home={false} fav={awayFav} compact={isPhone} />
        <TeamRecords sport={sport} team={home} hist={homeHist} home={true} fav={homeFav} compact={isPhone} />
      </div>

      {trends.length > 0 && (
        <div style={{ ...card, padding: "14px 16px", gap: 9 }}>
          <span style={title}>Betting trends</span>
          {trends.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 9, fontSize: 13, lineHeight: 1.5, color: "var(--text-2)" }}>
              <span aria-hidden style={{ flex: "none", marginTop: 7, width: 6, height: 6, borderRadius: 3, background: t.kind === "ats" ? "var(--amber)" : t.kind === "ou" ? "var(--pos)" : "var(--text-2)" }} />
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      )}

      <span style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--dim)" }}>
        Records are this regular season, counted from each game's closing line and final score. A game with no line on record is left out of the spread and total counts.
      </span>
    </div>
  );
}
