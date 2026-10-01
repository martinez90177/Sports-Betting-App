import React from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { crest } from "./v3/FormPlot.jsx";
import { teamInfo } from "./lib/gamesData.js";
import { STATS, positionRanks, leagueAverage } from "./lib/nflAllowed.js";

// --------------------------------------------------------------------------
// The Mismatches page's game view: one sheet per game, each defense's softest
// spots by position, and the players on the other side to look at because of
// them. Built 2026-09-30 as a weekly cheat sheet. Each target carries his
// availability, and a tap opens his full card with the game log behind the
// grade.
// --------------------------------------------------------------------------

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const micro = (extra) => ({ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)", ...extra });

// The position-and-stat pairs a defense is read on here, each tied to the
// prop market it speaks to so every soft spot has a bettable target. A
// quarterback's rushing is left out: only a handful run enough for it to be
// a play (see QB_GATED on the page), and the sheet has no game logs to tell
// which.
export const SHEET_ROWS = [
  { grp: "QB", stat: "passYds", market: "passYds" },
  { grp: "QB", stat: "passTd", market: "passTd" },
  { grp: "RB", stat: "rushYds", market: "rushYds" },
  { grp: "RB", stat: "recYds", market: "recYds" },
  { grp: "RB", stat: "rec", market: "rec" },
  { grp: "RB", stat: "anyTd", market: "anytimeTd" },
  { grp: "WR", stat: "recYds", market: "recYds" },
  { grp: "WR", stat: "rec", market: "rec" },
  { grp: "WR", stat: "anyTd", market: "anytimeTd" },
  { grp: "TE", stat: "recYds", market: "recYds" },
  { grp: "TE", stat: "rec", market: "rec" },
  { grp: "TE", stat: "anyTd", market: "anytimeTd" },
];
const SOFT_SPOTS = 5;
const TARGETS = 3;
// A spot has to be in the softest third -- 22nd of 32 or worse -- before
// anyone is named off it. A defense with nothing that soft gets no targets, and says so.
const TARGET_MIN_RANK = 22;

export const rowLabel = (r) => `${STATS[r.stat].label} allowed to ${r.grp}s`;
const MARKET_SHORT = { passYds: "Pass Yds", passTd: "Pass TD", rushYds: "Rush Yds", recYds: "Rec Yds", rec: "Receptions", anytimeTd: "Anytime TD" };

// A team's own season total in one stat, player by player, from the same box
// scores -- who actually leads the offense in what this defense gives up.
function offenseTotals(idx, team, stat) {
  const out = new Map();
  const t = team;
  Object.values(idx.byDef).forEach((games) => games.forEach((g) => {
    if (g.offense !== t) return;
    g.lines.forEach((l) => {
      const v = STATS[stat].value(l);
      if (v == null) return;
      out.set(l.id, (out.get(l.id) || 0) + v);
    });
  }));
  return out;
}

// { games: [{ game, window, sides: [{ def, off, rows, targets }] }], glance }
export function buildSheet(data) {
  const idx = data?.allowed;
  if (!idx || !data.games?.length) return null;
  const tables = SHEET_ROWS.map((r) => ({ ...r, table: positionRanks(idx, r.grp, r.stat), avg: leagueAverage(idx, r.grp, r.stat) }));
  if (tables.every((t) => !t.table)) return null;

  const cardsBy = new Map();
  (data.cards || []).forEach((c) => {
    const k = `${c.team}|${c.pos}|${c.marketId}`;
    if (!cardsBy.has(k)) cardsBy.set(k, []);
    cardsBy.get(k).push(c);
  });

  const games = data.games.map((game) => {
    const sides = [[game.away.abbr, game.home.abbr], [game.home.abbr, game.away.abbr]].map(([def, off]) => {
      const rows = tables
        .map((t) => ({ ...t, cell: t.table?.[def] || null }))
        .filter((r) => r.cell)
        .sort((a, b) => b.cell.rank - a.cell.rank || b.cell.value - a.cell.value)
        .slice(0, SOFT_SPOTS);
      // For each soft spot in order, the starter at that position who has
      // produced the most of that stat this season -- skipping anyone listed
      // out and anyone already named, so three spots give three players.
      const used = new Set();
      const targets = [];
      rows.forEach((r) => {
        if (targets.length >= TARGETS || r.cell.rank < Math.round(TARGET_MIN_RANK * r.cell.of / 32)) return;
        const pool = (cardsBy.get(`${off}|${r.grp}|${r.market}`) || []).filter((c) => c.status !== "out" && !used.has(c.player.espnId));
        if (!pool.length) return;
        const totals = offenseTotals(idx, off, r.stat);
        const best = pool.slice().sort((a, b) => (totals.get(b.player.espnId) || 0) - (totals.get(a.player.espnId) || 0))[0];
        used.add(best.player.espnId);
        targets.push({ card: best, row: r, seasonTotal: totals.get(best.player.espnId) || 0 });
      });
      return { def, off, rows, targets };
    });
    return { game, window: kickoffWindow(game.startsAt), sides };
  });

  return { games, glance: glance(games, tables, data) };
}

// The four headline tiles and the sentence above them, all read off the same
// ranks the sheets are built from.
function glance(games, tables, data) {
  const slateDefs = new Map();
  games.forEach((g) => g.sides.forEach((s) => slateDefs.set(s.def, { game: g, side: s })));
  const lastCount = (def) => tables.filter((t) => t.table?.[def]?.last).length;
  const meanSoft = (def) => {
    const xs = tables.map((t) => t.table?.[def]).filter(Boolean).map((c) => (c.rank - 1) / Math.max(1, c.of - 1));
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  };
  const defs = [...slateDefs.keys()];
  if (!defs.length) return null;
  const overall = defs.slice().sort((a, b) => lastCount(b) - lastCount(a) || meanSoft(b) - meanSoft(a));
  const top = overall[0];
  const tiedWith = overall.filter((d) => d !== top && lastCount(d) === lastCount(top) && lastCount(top) > 0);

  const softestOn = (grp, stat) => {
    const t = tables.find((x) => x.grp === grp && x.stat === stat)?.table;
    if (!t) return null;
    const def = defs.filter((d) => t[d]).sort((a, b) => t[b].value - t[a].value)[0];
    if (!def) return null;
    const { side } = slateDefs.get(def);
    const target = side.targets.find((x) => x.row.grp === grp && x.row.stat === stat)
      || side.targets.find((x) => x.row.grp === grp)
      || null;
    return { def, cell: t[def], grp, stat, target };
  };

  const withLast = games.filter((g) => g.sides.some((s) => lastCount(s.def) > 0)).length;
  const topSide = slateDefs.get(top).side;
  return {
    week: data.allowed.weeks,
    overall: { def: top, lastCount: lastCount(top), tiedWith, target: topSide.targets[0] || null, row: topSide.rows[0] || null },
    run: softestOn("RB", "rushYds"),
    wr: softestOn("WR", "recYds"),
    te: softestOn("TE", "recYds"),
    gamesWithLast: withLast,
    games: games.length,
    throughWeek: Math.max(0, ...Object.values(data.allowed.byDef).flat().map((g) => g.wk)),
    builtAt: data.allowed.builtAt,
  };
}

// "TNF", "Sun 1:00 PM", "MNF" -- the slots a slate is read in. Primetime
// games go by the names everyone already calls them.
const PRIMETIME = { Thu: "TNF", Sun: "SNF", Mon: "MNF" };
export function kickoffWindow(iso) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  if (d.getHours() >= 19) return PRIMETIME[day] || `${day} night`;
  return `${day} ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

const nick = (abbr) => teamInfo("nfl", abbr).name;
const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

function RankBadge({ cell }) {
  const soft = (cell.rank - 1) / Math.max(1, cell.of - 1);
  const color = soft >= 0.85 ? "var(--pos)" : soft >= 0.65 ? "var(--amber-ink)" : "var(--text-2)";
  return (
    <span
      className="pp-mono"
      title={`${ordinal(cell.rank)} of ${cell.of} · ${cell.value.toFixed(1)} a game over ${cell.games} game${cell.games === 1 ? "" : "s"}`}
      style={{
        flex: "none", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", padding: "3px 7px", borderRadius: 6,
        color, border: `1px solid ${color}`, whiteSpace: "nowrap",
      }}
    >
      {cell.tied ? "T" : ""}{ordinal(cell.rank)}
    </span>
  );
}

export function Headline({ glance }) {
  if (!glance?.overall) return null;
  const o = glance.overall;
  const parts = [];
  if (o.lastCount > 0) {
    parts.push(`The ${nick(o.def)} are the softest defense of Week ${glance.week}, allowing the most in the league in ${o.lastCount} of the stats below${o.tiedWith.length ? ` (tied with the ${o.tiedWith.map(nick).join(" and ")})` : ""}.`);
  } else {
    parts.push(`The ${nick(o.def)} grade as the softest defense of Week ${glance.week} across the stats below.`);
  }
  if (glance.run && glance.run.def !== o.def) parts.push(`The ${nick(glance.run.def)} have given up the most rushing yards to running backs.`);
  parts.push(`${glance.gamesWithLast} of ${glance.games} games feature a defense that has allowed the league's most in at least one of them.`);
  return <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.6, maxWidth: "68ch", marginTop: 10 }}>{parts.join(" ")}</p>;
}

function GlanceTile({ eyebrow, def, line, target, onJump }) {
  return (
    <div style={{ flex: "1 1 200px", minWidth: 0, background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={micro()}>{eyebrow}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: DISPLAY, fontWeight: 800, fontSize: 19 }}>
        <span role="img" style={crest(def, "nfl", 20)} />
        {nick(def).toUpperCase()}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.45 }}>{line}</div>
      {target && (
        <TargetRow target={target} onJump={onJump} compact />
      )}
    </div>
  );
}

export function Glance({ glance, onJump }) {
  if (!glance?.overall) return null;
  const o = glance.overall;
  const tile = (t, eyebrow) => t && (
    <GlanceTile
      eyebrow={eyebrow} def={t.def} onJump={onJump} target={t.target}
      line={`${t.cell.tied ? "T" : ""}${ordinal(t.cell.rank)} of ${t.cell.of} · ${t.cell.value.toFixed(1)} ${STATS[t.stat].label} a game to ${t.grp}s`}
    />
  );
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <GlanceTile
          eyebrow="Softest overall" def={o.def} onJump={onJump} target={o.target}
          line={o.lastCount > 0
            ? `Most allowed in the league in ${o.lastCount} stat${o.lastCount === 1 ? "" : "s"}${o.tiedWith.length ? ` · tied with ${o.tiedWith.join(", ")}` : ""}`
            : `Softest across all ${SHEET_ROWS.length} position stats`}
        />
        {tile(glance.run, "Softest vs the run")}
        {tile(glance.wr, "Softest vs WRs")}
        {tile(glance.te, "Softest vs TEs")}
      </div>
      <div style={{ ...micro(), marginTop: 10 }}>
        Box scores through Week {glance.throughWeek}
        {glance.builtAt ? ` · read ${new Date(glance.builtAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}` : ""}
      </div>
    </div>
  );
}

function TargetRow({ target, onJump, compact }) {
  const c = target.card;
  const r = target.row;
  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onJump(c.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onJump(c.id); } }}
      style={{
        display: "flex", alignItems: "center", gap: 9, cursor: "pointer", minWidth: 0,
        padding: compact ? "6px 8px" : "8px 10px", borderRadius: 9, background: "var(--surface-2)",
      }}
    >
      <PlayerAvatar name={c.player.name} alt={c.player.name} sport="nfl" team={c.team} espnId={c.player.espnId} status={c.status} size={compact ? 26 : 30} surface="var(--surface-2)" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {c.player.name} <span style={{ fontWeight: 400, color: "var(--dim)" }}>{c.pos}</span>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--amber-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {MARKET_SHORT[r.market]}{c.status === "questionable" ? " · questionable" : ""}
        </div>
      </div>
      <RankBadge cell={r.cell} />
    </div>
  );
}

// One soft spot: what it is, then the number itself -- what this defense
// gives up a game, large -- with how far that sits from the league average,
// and its rank. The per-game figure is the evidence; the rank only orders it.
function SoftSpot({ r }) {
  const diff = Number.isFinite(r.avg) ? r.cell.value - r.avg : null;
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", alignItems: "center", gap: 14,
        padding: "10px 12px", borderTop: "1px solid var(--line)", marginTop: -1,
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1.35, minWidth: 0 }}>
        {rowLabel(r)}
      </span>
      <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18, color: "var(--text)" }}>{r.cell.value.toFixed(1)}</span>
        <span style={{ fontSize: 11.5, color: "var(--text-2)", marginLeft: 2 }}>/g</span>
        {diff != null && (
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, marginTop: 1, color: diff > 0 ? "var(--pos)" : "var(--text-2)" }}>
            {diff > 0 ? "+" : diff < 0 ? "−" : "±"}{Math.abs(diff).toFixed(1)} vs avg
          </span>
        )}
      </span>
      <RankBadge cell={r.cell} />
    </div>
  );
}

// One defense's column: its softest spots, then who on the other side to look at.
function SideColumn({ side, onJump }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={micro({ color: "var(--text-2)" })}>{nick(side.def)} defense · softest spots</div>
      <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--line)", borderRadius: 9, overflow: "hidden" }}>
        {side.rows.length ? side.rows.map((r) => <SoftSpot key={`${r.grp}${r.stat}`} r={r} />) : (
          <div style={{ padding: 10, fontSize: 12, color: "var(--dim)" }}>No ranked stats for this defense yet.</div>
        )}
      </div>
      <div style={micro({ color: "var(--text-2)", marginTop: 4 })}>{nick(side.off)} to look at</div>
      {side.targets.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {side.targets.map((t) => <TargetRow key={t.card.id} target={t} onJump={onJump} />)}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--dim)", lineHeight: 1.5 }}>
          {side.rows.some((r) => r.cell.rank >= Math.round(TARGET_MIN_RANK * r.cell.of / 32))
            ? "No available starter at these positions on the depth chart."
            : `Nothing this defense allows ranks in the league's softest third (${ordinal(TARGET_MIN_RANK)} or worse) yet.`}
        </div>
      )}
    </div>
  );
}

export function GameSheet({ entry, narrow, onJump, actions }) {
  const g = entry.game;
  return (
    <section
      id={`mismatch-${g.id}`}
      style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface-1)", padding: narrow ? 14 : 18, scrollMarginTop: 90 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span role="img" style={crest(g.away.abbr, "nfl", 26)} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: narrow ? 17 : 20 }}>
            {nick(g.away.abbr).toUpperCase()} @ {nick(g.home.abbr).toUpperCase()}
          </span>
          <span role="img" style={crest(g.home.abbr, "nfl", 26)} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={micro()}>{entry.window}</span>
          {actions}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: narrow ? 18 : 20 }}>
        {entry.sides.map((s) => <SideColumn key={s.def} side={s} onJump={onJump} />)}
      </div>
    </section>
  );
}

