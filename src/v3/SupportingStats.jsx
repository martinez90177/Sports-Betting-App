// The volume behind the prop.
//
// A hit rate says how often a player cleared a number. It does not say why, and
// the why is almost always volume: a receiver clearing 60 yards on four targets
// is a different bet from one clearing it on eleven. Outlier calls this section
// Supporting Stats and it is the most useful thing on their player page that we
// did not have.
//
// **Every figure here is counted off the same game log the chart above draws.**
// No new feed, no estimate. The one number that looks like it needs a new
// source -- target share -- does not: a team's pass attempts for a game are the
// quarterback's attempts in that same game, which sits in the same log under
// the same event id (see buildNflTeamTotals).
//
// What is deliberately NOT here, because there is no honest way to get it:
// snap counts, route participation, air yards, and anything by field zone or
// route. Those are charting products. A section that mixed them in with counted
// numbers would make the counted ones look like guesses too.

import React from "react";

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const num = (v, dp = 1) => (v == null || !Number.isFinite(v) ? null : v.toFixed(dp));
const pct = (v) => (v == null || !Number.isFinite(v) ? null : `${Math.round(v * 100)}%`);

// Mean and median are different claims about a skewed log and the reader picks
// which one they are making. Receiving yards in particular run long-tailed: one
// 120-yard game drags a mean past every typical week.
function centre(values, mode) {
  const vals = values.filter((v) => v != null && Number.isFinite(v));
  if (!vals.length) return null;
  if (mode === "median") {
    const s = [...vals].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// A rate over the whole sample, not the average of per-game rates.
//
// They are different numbers and only one of them is the catch rate: a game
// with one target and one catch is 100%, and averaging that against a
// ten-target six-catch game would weight the quiet week equally. Totals first,
// divide once.
function ratio(games, top, bottom) {
  let a = 0;
  let b = 0;
  games.forEach((g) => { a += top(g) || 0; b += bottom(g) || 0; });
  return b > 0 ? a / b : null;
}

// The stat sets, per position. Each entry is one tab.
//
//   value   -- the per-game number the bars draw
//   summary -- the headline, and a second line of context under it
//   share   -- optional: the team total this player's number is a share of,
//              which is what turns a count into a role
function statsFor(pos, teamOf) {
  const teamPass = (g) => (teamOf(g) || {}).passAtt || 0;
  const teamRush = (g) => (teamOf(g) || {}).rushAtt || 0;

  const receiving = [
    {
      id: "recTgt",
      label: "Receptions / Targets",
      value: (g) => g.rec,
      summary: (games, mode) => [
        `${num(centre(games.map((g) => g.rec), mode)) ?? "—"} rec`,
        `${num(centre(games.map((g) => g.tgt), mode)) ?? "—"} targets · ${pct(ratio(games, (g) => g.rec, (g) => g.tgt)) ?? "—"} caught`,
      ],
    },
    {
      id: "tgtShare",
      label: "Target share",
      value: (g) => (teamPass(g) > 0 ? (g.tgt || 0) / teamPass(g) : null),
      unit: "pct",
      summary: (games) => [
        pct(ratio(games, (g) => g.tgt, teamPass)) ?? "—",
        `${num(centre(games.map((g) => g.tgt), "mean"), 1) ?? "—"} of ${num(centre(games.map(teamPass), "mean"), 1) ?? "—"} team pass att`,
      ],
    },
    {
      id: "ypr",
      label: "Yards per reception",
      value: (g) => (g.rec > 0 ? g.recYds / g.rec : null),
      summary: (games) => [
        num(ratio(games, (g) => g.recYds, (g) => g.rec)) ?? "—",
        `${num(centre(games.map((g) => g.recYds), "mean")) ?? "—"} yds per game`,
      ],
    },
    {
      id: "longRec",
      label: "Longest reception",
      value: (g) => g.long,
      summary: (games, mode) => [
        num(centre(games.map((g) => g.long), mode), 1) ?? "—",
        `best ${games.reduce((m, g) => Math.max(m, g.long || 0), 0) || "—"}`,
      ],
    },
  ];

  const rushing = [
    {
      id: "carries",
      label: "Carries",
      value: (g) => g.rushAtt,
      summary: (games, mode) => [
        num(centre(games.map((g) => g.rushAtt), mode)) ?? "—",
        `${num(centre(games.map((g) => g.rushYds), mode)) ?? "—"} yds per game`,
      ],
    },
    {
      id: "rushShare",
      label: "Carry share",
      value: (g) => (teamRush(g) > 0 ? (g.rushAtt || 0) / teamRush(g) : null),
      unit: "pct",
      summary: (games) => [
        pct(ratio(games, (g) => g.rushAtt, teamRush)) ?? "—",
        `${num(centre(games.map((g) => g.rushAtt), "mean")) ?? "—"} of ${num(centre(games.map(teamRush), "mean")) ?? "—"} team carries`,
      ],
    },
    {
      id: "ypc",
      label: "Yards per carry",
      value: (g) => (g.rushAtt > 0 ? g.rushYds / g.rushAtt : null),
      summary: (games) => [num(ratio(games, (g) => g.rushYds, (g) => g.rushAtt)) ?? "—", "over the window"],
    },
  ];

  const passing = [
    {
      id: "attempts",
      label: "Attempts",
      value: (g) => g.att,
      summary: (games, mode) => [
        num(centre(games.map((g) => g.att), mode)) ?? "—",
        `${num(centre(games.map((g) => g.comp), mode)) ?? "—"} completions`,
      ],
    },
    {
      id: "cmp",
      label: "Completion rate",
      value: (g) => (g.att > 0 ? g.comp / g.att : null),
      unit: "pct",
      summary: (games) => [pct(ratio(games, (g) => g.comp, (g) => g.att)) ?? "—", "over the window"],
    },
    {
      id: "ypa",
      label: "Yards per attempt",
      value: (g) => (g.att > 0 ? g.passYds / g.att : null),
      summary: (games) => [
        num(ratio(games, (g) => g.passYds, (g) => g.att)) ?? "—",
        `${num(centre(games.map((g) => g.passYds), "mean"), 0) ?? "—"} yds per game`,
      ],
    },
    {
      id: "passRate",
      label: "Team pass rate",
      value: (g) => (teamPass(g) + teamRush(g) > 0 ? teamPass(g) / (teamPass(g) + teamRush(g)) : null),
      unit: "pct",
      summary: (games) => [
        pct(ratio(games, teamPass, (g) => teamPass(g) + teamRush(g))) ?? "—",
        `${num(centre(games.map((g) => teamPass(g) + teamRush(g)), "mean")) ?? "—"} attempts per game`,
      ],
    },
  ];

  if (pos === "QB") return passing;
  if (pos === "RB" || pos === "FB") return rushing.concat(receiving.slice(0, 2));
  if (pos === "WR" || pos === "TE") return receiving;
  return [];
}

export default function SupportingStats({ games, position, teamTotals, opp }) {
  const [mode, setMode] = React.useState("mean");
  const [tab, setTab] = React.useState(0);

  const teamOf = React.useCallback(
    (g) => (g && g.team && g.eventId ? teamTotals.get(`${g.team}|${g.eventId}`) : null),
    [teamTotals]
  );
  const stats = React.useMemo(() => statsFor(position, teamOf), [position, teamOf]);

  // A position with nothing measured draws nothing, rather than an empty card
  // with a heading on it.
  if (!games || !games.length || !stats.length) return null;
  const active = stats[Math.min(tab, stats.length - 1)];
  const perGame = games.map((g) => active.value(g));
  const top = perGame.reduce((m, v) => (v != null && v > m ? v : m), 0) || 1;
  const fmt = (v) => (active.unit === "pct" ? pct(v) : num(v, v != null && v >= 100 ? 0 : 1));

  const label = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: "var(--dim)" };

  return (
    <div style={{ flex: "0 0 auto", border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "14px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16 }}>Supporting stats</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>
          {`${games.length} games in this window`}
        </span>
        {/* Mean and median are different claims and the reader picks. */}
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {[["mean", "AVERAGE"], ["median", "MEDIAN"]].map(([id, text]) => (
            <span
              key={id}
              role="button"
              tabIndex={0}
              onClick={() => setMode(id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMode(id); } }}
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
          ))}
        </span>
      </div>

      {/* The tabs carry their own headline, so the section answers four
          questions at a glance and the chart below answers the one you pick. */}
      <div className="nsb" style={{ display: "flex", overflowX: "auto", borderBottom: "1px solid var(--line)" }}>
        {stats.map((s, i) => {
          const [head, sub] = s.summary(games, mode);
          const on = s.id === active.id;
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => setTab(i)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab(i); } }}
              style={{
                flex: "1 0 auto", minWidth: 148, padding: "12px 16px", cursor: "pointer",
                borderRight: i < stats.length - 1 ? "1px solid var(--line)" : "none",
                borderBottom: `2px solid ${on ? "var(--amber)" : "transparent"}`,
                background: on ? "var(--surface-2)" : "transparent",
                display: "flex", flexDirection: "column", gap: 3,
              }}
            >
              <span style={label}>{s.label.toUpperCase()}</span>
              <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: on ? "var(--text)" : "var(--text-2)" }}>{head}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{sub}</span>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "16px 18px 14px", display: "flex", gap: 5, alignItems: "flex-end", height: 132 }}>
        {games.map((g, i) => {
          const v = perGame[i];
          const h = v == null ? 0 : Math.max(3, Math.round((v / top) * 88));
          const away = g.home === false;
          return (
            <div
              key={`${g.eventId || g.date}-${i}`}
              title={`${g.date} · ${away ? "@" : "vs"} ${g.opp} · ${fmt(v) ?? "no data"}`}
              style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
            >
              <span style={{ fontFamily: MONO, fontSize: 9.5, color: "var(--text-2)", whiteSpace: "nowrap" }}>{fmt(v) ?? "—"}</span>
              {/* A game the stat cannot be taken from -- no targets, so no catch
                  rate -- draws nothing rather than a bar at zero, which would
                  read as a game he was targeted and caught none. */}
              <span
                style={{
                  width: "100%", height: h, borderRadius: 2,
                  background: v == null ? "transparent" : "var(--text-2)",
                  border: v == null ? "1px dashed var(--line)" : "none",
                  opacity: v == null ? 1 : 0.55,
                }}
              />
              <span style={{ fontFamily: MONO, fontSize: 9, color: opp && g.opp === opp ? "var(--amber-ink)" : "var(--dim)", whiteSpace: "nowrap" }}>
                {away ? "@" : ""}{g.opp}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "0 18px 14px", fontFamily: MONO, fontSize: 10, lineHeight: 1.6, color: "var(--dim)" }}>
        Counted off the same games as the chart above. Shares are against the team's own
        attempts in each game — a sack is neither an attempt nor a carry, so these are
        attempts, not plays.
      </div>
    </div>
  );
}
