import React, { useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { seasonLabel } from "./LogScope.jsx";
import {
  NBA_GROUPS, NBA_MISMATCH_STATS, pickDefenseSeason, buildNbaDefense, softSpots, playersToLook,
} from "./lib/nbaMismatch.js";

// The NBA's Mismatches page.
//
// Defences are graded on the season the page names. Until the new season has
// ten games for nearly every team that is last season, and the banner, every
// card and the league table say so -- a 2025-26 rank must never be read as this
// season's. The label changes by itself when the grade does.

const ET = { timeZone: "America/New_York" };
const dayKey = (iso) => new Date(iso).toLocaleDateString("en-CA", ET);
const dayLabel = (iso) => new Date(iso).toLocaleDateString("en-US", { ...ET, weekday: "short", month: "short", day: "numeric" });
const timeLabel = (iso) => new Date(iso).toLocaleTimeString("en-US", { ...ET, hour: "numeric", minute: "2-digit" });
const signed = (n) => {
  const t = Math.abs(n).toFixed(1);
  return t === "0.0" ? "0.0" : `${n >= 0 ? "+" : "−"}${t}`;
};

const card = { background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 10, padding: 16 };
const chip = (on) => ({
  padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontFamily: "inherit",
  border: "1px solid var(--line)", background: on ? "var(--surface-2)" : "transparent",
  color: on ? "var(--text)" : "var(--text-2)", fontWeight: on ? 700 : 500,
});

function Side({ attack, defend, spots, picks, label, logoFor, onOpenPlayer }) {
  return (
    <div style={{ flex: "1 1 300px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <img src={logoFor(attack)} alt="" width={22} height={22} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {attack} <span style={{ color: "var(--text-2)", fontWeight: 500 }}>against {defend}'s defence</span>
        </div>
      </div>
      {spots.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--dim)" }}>
          {defend} has no soft spot on {label}: nothing in the bottom eight by a real margin above the norm.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            {spots.map((s) => (
              <div key={s.group.id + s.stat.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                <span>{s.group.label} · {s.stat.label}</span>
                <span style={{ color: "var(--text-2)", whiteSpace: "nowrap" }}>
                  <b style={{ color: "var(--text)" }}>#{s.rank} of {s.of}</b> · {signed(s.delta)} per player · {label}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {picks.map((x) => (
              <button
                key={x.player.id + x.spot.stat.id}
                type="button"
                onClick={() => onOpenPlayer(x.player, x.spot.stat.market)}
                style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "inherit", fontFamily: "inherit" }}
              >
                <PlayerAvatar name={x.player.name} alt={x.player.name} sport="nba" team={x.player.team} espnId={x.player.espnId} status={x.status} size={28} surface="var(--surface-2)" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.player.name}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-2)" }}>
                    {x.spot.stat.label}: {x.avg.toFixed(1)} a game over {x.games} games ({label}) · last 10 {x.l10.toFixed(1)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function NBAMismatchPage({ players, games, season: currentSeason, statusFor, logoFor, onOpenProp, dataVersion }) {
  const [day, setDay] = useState(null);
  const [statId, setStatId] = useState("pts");

  const pick = useMemo(() => pickDefenseSeason(players, currentSeason), [players, currentSeason, dataVersion]);
  const defense = useMemo(() => buildNbaDefense(players, pick.season), [players, pick.season, dataVersion]);
  const label = seasonLabel(pick.season, "nba");

  const days = useMemo(() => {
    const out = [];
    (games || []).forEach((g) => { const k = dayKey(g.date); if (!out.some((d) => d.key === k)) out.push({ key: k, iso: g.date }); });
    return out;
  }, [games]);
  const activeDay = day && days.some((d) => d.key === day) ? day : days[0]?.key;
  const dayGames = (games || []).filter((g) => dayKey(g.date) === activeDay);
  const stat = NBA_MISMATCH_STATS.find((s) => s.id === statId);
  const ready = defense.players > 0;
  const teams = useMemo(() => Object.keys(defense.ranks).sort(), [defense]);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 16px 80px" }}>
      <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>NBA Mismatches</h1>
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
          {label} DEFENSE RANKINGS{pick.isCurrent ? "" : " — LAST SEASON"}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
          {pick.isCurrent
            ? `Defences are ranked on the ${label} season so far.`
            : `These are the ${label} rankings, not this season's. The ${seasonLabel(currentSeason, "nba")} season has not tipped off, so nothing from it is counted. The page re-ranks on the new season once nearly every team has played ${10} games, and this label changes with it. Rosters have turned over since, so read a soft spot as a lead to check, not a verdict.`}
        </div>
        <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 8 }}>
          Each defence is graded on how far the guards, forwards or centres who faced it finished above or below their own {label} average, from {defense.playerGames.toLocaleString()} real box-score lines across {defense.players} rotation players. Rank 1 is the toughest defence.
        </div>
      </div>

      {!ready ? (
        <div style={{ ...card, color: "var(--text-2)", fontSize: 13 }}>Game logs are still loading — the rankings appear as soon as they do.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {days.length === 0 && <span style={{ fontSize: 13, color: "var(--text-2)" }}>No games on the NBA schedule we can read yet.</span>}
            {days.map((d) => (
              <button key={d.key} type="button" style={chip(d.key === activeDay)} onClick={() => setDay(d.key)}>{dayLabel(d.iso)}</button>
            ))}
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {dayGames.map((g) => {
              const away = g.teamA.abbr;
              const home = g.teamB.abbr;
              const awaySpots = softSpots(defense, home);
              const homeSpots = softSpots(defense, away);
              return (
                <div key={g.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 13 }}>
                    <b>{g.teamA.label} @ {g.teamB.label}</b>
                    <span style={{ color: "var(--text-2)" }}>{timeLabel(g.date)} ET</span>
                  </div>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    <Side attack={away} defend={home} spots={awaySpots} label={label} logoFor={logoFor}
                      picks={playersToLook(players, away, awaySpots, pick.season, statusFor)} onOpenPlayer={onOpenProp} />
                    <Side attack={home} defend={away} spots={homeSpots} label={label} logoFor={logoFor}
                      picks={playersToLook(players, home, homeSpots, pick.season, statusFor)} onOpenPlayer={onOpenProp} />
                  </div>
                </div>
              );
            })}
          </div>

          <h2 style={{ fontSize: 18, margin: "28px 0 4px" }}>Every defence, by position — {label}</h2>
          <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 10 }}>
            Rank of 30, {label} season. 1 is toughest. Bold means a soft spot: in the softest eight and a real gap above the norm.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {NBA_MISMATCH_STATS.map((s) => (
              <button key={s.id} type="button" style={chip(s.id === statId)} onClick={() => setStatId(s.id)}>{s.label}</button>
            ))}
          </div>
          <div style={{ ...card, padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "var(--text-2)", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px" }}>Defence</th>
                  {NBA_GROUPS.map((grp) => <th key={grp.id} style={{ padding: "10px 14px" }}>{grp.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                      <img src={logoFor(t)} alt="" width={18} height={18} />{t}
                    </td>
                    {NBA_GROUPS.map((grp) => {
                      const r = defense.ranks[t]?.[grp.id]?.[stat.id];
                      const soft = r && r.rank > r.of - 8 && r.delta >= stat.gap;
                      return (
                        <td key={grp.id} style={{ padding: "8px 14px", fontWeight: soft ? 800 : 400, color: r ? "var(--text)" : "var(--dim)" }}>
                          {r ? `#${r.rank} · ${signed(r.delta)}` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
