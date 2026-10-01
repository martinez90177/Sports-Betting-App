import React, { useEffect, useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { crest } from "./v3/FormPlot.jsx";
import useIsNarrow from "./lib/useIsNarrow.js";
import { fetchNflWeeklyMismatches, MARKETS } from "./lib/nflMismatch.js";
import { STATS, allowedTo, slotValues, redZoneRole, redZoneTripsAllowed, positionRanks } from "./lib/nflAllowed.js";
import { buildSheet, kickoffWindow, Headline, Glance, GameSheet } from "./MismatchGameView.jsx";
import { saveSheetImage } from "./lib/sheetImage.js";
import { capturedOddsFor, CAPTURED_AT, CAPTURED_SOURCE } from "./lib/nflCapturedOdds.js";
import { formatOdds } from "./odds.js";

// --------------------------------------------------------------------------
// This week's real NFL mismatches.
// --------------------------------------------------------------------------
// Every number here is one this app already fetches for another screen (see
// lib/nflMismatch.js for which). Nothing is written by a model and nothing is
// seeded -- a team or player this page can't get a real answer for is left
// off rather than filled in, same rule as everywhere else in the app.
//
// Laid out after the artifact this was modelled on -- a hero with stat tiles,
// a featured spotlight, compact rows that open into full cards -- but
// two things that artifact had are deliberately still missing:
//   - A moneyline/spread ticket with real book lines. NFL has no real-odds
//     feed here (see docs/PROJECT_NOTES.md "Free data only no fake edge") and
//     wiring one up would spend the same tight Odds API budget the MLB odds
//     panel already runs against.
//   - Prose explaining why a spot is good. That's a model's voice describing
//     numbers it didn't measure; every sentence here is a template filled
//     from the real rank cells, nothing composed freely.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const TIER_META = {
  SMASH: { label: "SMASH SPOT", color: "var(--pos)" },
  FAV: { label: "FAVORABLE", color: "var(--amber-ink)" },
  LEAN: { label: "LEAN", color: "var(--text-2)" },
  // Only ever shown to someone who searched for the player.
  TOUGH: { label: "TOUGH MATCHUP", color: "var(--dim)" },
};
const POS_ORDER = ["QB", "RB", "WR", "TE"];
// "Best per player": one card each, on his position's headline market -- the
// page's default. Every other button is one market across every position that
// can bet it.
const HEADLINE = "HEADLINE";

// The defensive number behind a card, as the stat cell and sentence name it.
const DEF_LABEL = {
  passYds: "pass yds allowed", rushYds: "rush yds allowed", yards: "total yds allowed",
  completions: "catches allowed", passTd: "pass TDs allowed", rushTd: "rush TDs allowed",
};
const DEF_UNIT = {
  passYds: "pass yds", rushYds: "rush yds", yards: "total yds",
  completions: "completions", passTd: "passing TDs", rushTd: "rushing TDs",
};
// The player's own number in each market, read straight off a game-log row.
const MARKET_VALUE = {
  passYds: (g) => g.passYds,
  passRushYds: (g) => (g.passYds || 0) + (g.rushYds || 0),
  passTd: (g) => g.passTd,
  rushYds: (g) => g.rushYds,
  scrim: (g) => (g.rushYds || 0) + (g.recYds || 0),
  recYds: (g) => g.recYds,
  rec: (g) => g.rec,
  anytimeTd: (g) => (g.rushTd || 0) + (g.recTd || 0),
};
const MARKET_UNIT = {
  passYds: "pass yds", passRushYds: "pass + rush yds", passTd: "passing TDs", rushYds: "rush yds",
  scrim: "rush + rec yds", recYds: "rec yds", rec: "catches", anytimeTd: "TDs",
};
const MARKET_BY_ID = Object.fromEntries(MARKETS.map((m) => [m.id, m]));
const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;
const LOG_CONCURRENCY = 6;

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const f1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");

function lastName(name) {
  const parts = String(name || "").split(" ").filter(Boolean);
  while (parts.length > 1 && SUFFIX.test(parts[parts.length - 1])) parts.pop();
  return parts[parts.length - 1] || name;
}

// Every player's real game log, this season and last, fetched a few at a time
// through PropLedger's own cached fetcher. `fetchLogs` is held in a ref because
// PropLedger passes a fresh closure on every render; depending on it would
// refetch the whole slate each time the shell re-renders.
// Keyed by player, so switching markets only fetches players not seen yet; a
// player already asked for (in flight or answered) is never asked again.
function useCardLogs(cards, fetchLogs) {
  const [logs, setLogs] = useState({});
  const fetchRef = React.useRef(fetchLogs);
  fetchRef.current = fetchLogs;
  const asked = React.useRef(new Set());
  const mounted = React.useRef(true);
  // Set true in the body too: StrictMode's dev mount-unmount-mount would
  // otherwise leave it false and stop every worker after the first player.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // A market switch doesn't cancel fetches already running: a log is the
  // player's, not the market's, so it's still wanted whichever view asked.
  useEffect(() => {
    if (!fetchRef.current || !cards.length) return;
    const ids = [...new Set(cards.map((c) => c.player.espnId))].filter((id) => !asked.current.has(id));
    ids.forEach((id) => asked.current.add(id));
    let next = 0;
    const worker = async () => {
      while (next < ids.length && mounted.current) {
        const id = ids[next++];
        let value = null;
        try { value = await fetchRef.current(id); } catch {}
        if (!mounted.current) return;
        setLogs((prev) => ({ ...prev, [id]: value || { current: [], prior: [], failed: true } }));
      }
    };
    for (let i = 0; i < Math.min(LOG_CONCURRENCY, ids.length); i++) worker();
  }, [cards]);
  return logs;
}

// The player's own numbers in the card's market, from his real log. Nothing
// here is estimated: an empty season is reported as empty, not filled in.
function playerForm(card, log) {
  if (!log) return null;
  const cur = log.current || [];
  const prior = log.prior || [];
  const all = [...prior, ...cur];
  const read = MARKET_VALUE[card.marketId];
  const val = (g) => Number(read(g)) || 0;
  const last10 = all.slice(-10);
  const vsOpp = all.filter((g) => g.opp === card.opp);
  const perGame = (games, field) => {
    const xs = games.map((g) => Number(g[field]) || 0);
    return xs.some((x) => x > 0) ? mean(xs) : null;
  };
  const rushingQb = card.pos === "QB" && ["rushYds", "anytimeTd", "passRushYds"].includes(card.marketId);
  return {
    failed: !!log.failed,
    curGames: cur.length,
    curAvg: cur.length ? mean(cur.map(val)) : null,
    priorAvg: prior.length ? mean(prior.map(val)) : null,
    priorGames: prior.length,
    l10: last10.map(val),
    l10Avg: last10.length ? mean(last10.map(val)) : null,
    last3: all.slice(-3).reverse().map((g) => ({ v: val(g), opp: g.opp, home: g.home })),
    h2h: vsOpp.length ? { v: val(vsOpp[vsOpp.length - 1]), n: vsOpp.length, avg: mean(vsOpp.map(val)), vals: vsOpp.map(val) } : null,
    tgt: card.pos !== "QB" ? perGame(cur, "tgt") : null,
    rec: card.pos !== "QB" ? perGame(cur, "rec") : null,
    carries: card.pos === "RB" || rushingQb ? perGame(cur, "rushAtt") : null,
    all: all.map(val),
    cur: cur.map(val),
    prior: prior.map(val),
    qbRun: card.pos === "QB" ? qbRunning(log) : null,
  };
}

// "Scored in N of M" for the touchdown market, where an average of 0.4 TDs a
// game says less than how often he found the end zone at all.
const scoredIn = (xs) => xs.filter((v) => v > 0).length;

// Quarterback markets that only mean something if he runs the ball. An anytime
// TD is a player carrying or catching it into the end zone -- a quarterback's
// passing touchdowns never count -- so a pocket passer facing a soft run
// defense is not a touchdown play, and his rush-yards line is a scramble
// total the run-defense rank says nothing about. Alex, 2026-09-27: "only guys
// like mahomes, allen, lamar, caleb williams, and jalen hurts do that."
//
// Decided from his own log rather than a list of names, which would go stale
// the first time a starter changed. Two rules, because the markets ask two
// different questions:
//   Anytime TD -- does he score on the ground? A rushing TD in at least
//     QB_TD_RATE of his last QB_RUN_WINDOW games. Carries alone don't qualify:
//     Justin Herbert averages 5.3 a game on scrambles and has run one in twice
//     in 19.
//   Rush Yds -- does he carry it? QB_RUN_CARRIES a game, or the TD rule.
// Either way at least QB_RUN_MIN_GAMES games of log, or there is nothing to
// judge (a two-game starter reads as whatever those two games did).
const QB_GATED = new Set(["anytimeTd", "rushYds"]);
const QB_RUN_WINDOW = 20;
const QB_RUN_MIN_GAMES = 6;
const QB_TD_RATE = 0.15;
const QB_RUN_CARRIES = 5;
const needsRunCheck = (c) => c.pos === "QB" && QB_GATED.has(c.marketId);

function qbRunning(log) {
  const games = [...(log?.prior || []), ...(log?.current || [])].slice(-QB_RUN_WINDOW);
  const tdGames = games.filter((g) => (Number(g.rushTd) || 0) > 0).length;
  const tds = games.reduce((a, g) => a + (Number(g.rushTd) || 0), 0);
  const carries = games.length ? mean(games.map((g) => Number(g.rushAtt) || 0)) : 0;
  const enough = games.length >= QB_RUN_MIN_GAMES;
  const scores = enough && tdGames / games.length >= QB_TD_RATE;
  return {
    n: games.length, tdGames, tds, carries,
    qualifies: {
      anytimeTd: scores,
      rushYds: scores || (enough && carries >= QB_RUN_CARRIES),
    },
  };
}

// Reasons to play it (`pro`) and reasons to hesitate (`con`), each a sentence
// built from a real number. The thresholds that decide which bucket a line
// lands in are stated in the sentence itself, so nothing reads as a verdict
// without the figure behind it.
function insightsFor(card, form, captured, season, allowed) {
  const out = [];
  const unit = MARKET_UNIT[card.marketId];
  // The defense number is the team row the market is graded on, whatever the
  // player's own market -- a receiver's card must not call it "rec yds".
  const defUnit = card.basis === "position" ? `${STATS[card.stat].label} to ${card.grp}s` : DEF_UNIT[card.rowId];
  const name = lastName(card.player.name);
  const td = card.marketId === "anytimeTd";
  const d = card.defCurrent;

  // Availability first: an out player's matchup is moot, and it must not be
  // the fourth line someone reads.
  if (card.status === "out") out.push({ tone: "con", text: `Listed OUT on the injury report — this matchup won't be his this week.` });
  if (card.status === "questionable") out.push({ tone: "con", text: `Listed questionable on the injury report — check inactives before locking this in.` });

  if (d && Number.isFinite(d.value)) {
    const diff = Number.isFinite(card.leagueAvg) ? d.value - card.leagueAvg : null;
    const games = card.defGames ? ` through ${card.defGames} game${card.defGames === 1 ? "" : "s"}` : "";
    out.push({
      tone: diff != null && diff > 0 ? "pro" : "info",
      text: `${card.opp} is allowing ${f1(d.value)} ${defUnit} a game${games} — ${rankText(d)}` +
        (diff != null ? `, ${f1(Math.abs(diff))} ${diff >= 0 ? "more" : "fewer"} than the league average of ${f1(card.leagueAvg)}.` : "."),
    });
    const p = card.defPrior;
    if (p && Number.isFinite(p.value) && Math.abs(p.rank - d.rank) >= 8) {
      const delta = d.value - p.value;
      out.push({
        tone: delta > 0 ? "pro" : "con",
        text: `That's a ${delta > 0 ? "collapse" : "turnaround"} from last season, when they allowed ${f1(p.value)} a game (${rankText(p)}) — ${f1(Math.abs(delta))} ${delta > 0 ? "more" : "fewer"} per game now.`,
      });
    }
  }

  if (!form) return out;
  if (form.failed || (!form.curGames && !form.priorGames)) {
    out.push({ tone: "info", text: `No game log could be read for ${card.player.name} — the defense numbers above are the only real data on this card.` });
    return out;
  }

  if (form.qbRun && QB_GATED.has(card.marketId)) {
    const r = form.qbRun;
    out.push({
      tone: "pro",
      text: td
        ? `A running quarterback: rushing TD in ${r.tdGames} of his last ${r.n} games (${r.tds} total), ${f1(r.carries)} carries a game. Only his rushing TDs count here — passing TDs don't cash an anytime ticket.`
        : `A running quarterback: ${f1(r.carries)} carries a game over his last ${r.n}, with a rushing TD in ${r.tdGames} of them.`,
    });
  }

  const rz = td ? redZoneFor(card, allowed) : null;
  if (rz) {
    const { role } = rz;
    out.push({
      tone: role.share >= 0.3 ? "pro" : role.share < 0.1 ? "con" : "info",
      text: `Gets ${pct(role.share)} of ${card.team}'s red-zone carries and targets (${role.looks} of ${role.teamLooks})` +
        (role.teamGl ? ` and ${role.gl} of ${role.teamGl} from the 5 in` : "") + ` this season.`,
    });
  }

  if (td) {
    const n = form.l10.length;
    const hit = scoredIn(form.l10);
    const rate = n ? hit / n : 0;
    const curHit = scoredIn(form.cur);
    const curTds = form.cur.reduce((a, b) => a + b, 0);
    if (form.curGames) {
      out.push({
        tone: curHit === 0 ? "con" : curHit / form.curGames >= 0.5 ? "pro" : "info",
        text: `Scored in ${curHit} of his ${form.curGames} game${form.curGames === 1 ? "" : "s"} this season (${curTds} ${card.pos === "QB" ? "rushing" : "rushing/receiving"} TD${curTds === 1 ? "" : "s"}).`,
      });
    } else {
      out.push({ tone: "con", text: `No ${season} games in his log yet — everything below is from ${season - 1}.` });
    }
    out.push({
      tone: rate >= 0.5 ? "pro" : rate <= 0.2 ? "con" : "info",
      text: `Found the end zone in ${hit} of his last ${n} games` +
        (form.prior.length ? ` — ${scoredIn(form.prior)} of ${form.prior.length} in ${season - 1}.` : "."),
    });
  } else if (form.curGames) {
    const vsPrior = Number.isFinite(form.priorAvg) && form.priorGames
      ? ` (${f1(form.priorAvg)} in ${season - 1})` : "";
    out.push({ tone: "info", text: `${name} is averaging ${f1(form.curAvg)} ${unit} in ${season} over ${form.curGames} game${form.curGames === 1 ? "" : "s"}${vsPrior}.` });
    if (Number.isFinite(form.priorAvg) && form.priorGames >= 4 && form.priorAvg > 0) {
      const ratio = form.curAvg / form.priorAvg;
      if (ratio >= 1.2) out.push({ tone: "pro", text: `Trending up: ${f1(form.priorAvg)} → ${f1(form.curAvg)} per game, a ${Math.round((ratio - 1) * 100)}% jump on last season.` });
      else if (ratio <= 0.8) out.push({ tone: "con", text: `Trending down: ${f1(form.priorAvg)} → ${f1(form.curAvg)} per game, ${Math.round((1 - ratio) * 100)}% below last season.` });
    }
  } else {
    out.push({ tone: "con", text: `No ${season} games in his log yet — everything below is from ${season - 1}.` });
  }

  if (card.marketId === "passYds" && form.curGames && d && Number.isFinite(d.value) && Number.isFinite(form.curAvg)) {
    const gap = d.value - form.curAvg;
    out.push({
      tone: gap > 0 ? "pro" : "info",
      text: `${card.opp} gives up ${f1(d.value)} passing yards a game; ${name} averages ${f1(form.curAvg)} — ${gap > 0 ? `the defense has been allowing ${f1(gap)} more than he usually throws for` : `he's already been out-throwing what they allow by ${f1(-gap)}`}.`,
    });
  }

  if (form.tgt != null) {
    const low = form.tgt < 4;
    out.push({
      tone: low ? "con" : form.tgt >= 7 ? "pro" : "info",
      text: `${f1(form.tgt)} targets and ${f1(form.rec)} catches a game this season${low ? " — under 4 targets, so a soft secondary has less to work with" : form.tgt >= 7 ? " — a featured role in the passing game" : ""}.`,
    });
  }
  if (form.carries != null) {
    // The lead-back / split-backfield reading is about running backs; a
    // quarterback's carries are stated without it.
    const rb = card.pos === "RB";
    out.push({
      tone: !rb ? "info" : form.carries >= 15 ? "pro" : form.carries < 10 ? "con" : "info",
      text: `${f1(form.carries)} carries a game this season${rb && form.carries >= 15 ? " — lead-back volume" : rb && form.carries < 10 ? " — under 10, a split backfield" : ""}.`,
    });
  }

  if (captured) {
    const n = form.l10.length;
    const hits = form.l10.filter((v) => v > captured.line).length;
    const curHits = form.cur.filter((v) => v > captured.line).length;
    const rate = n ? hits / n : 0;
    out.push({
      tone: rate >= 0.7 ? "pro" : rate <= 0.4 ? "con" : "info",
      text: `Went over the captured ${captured.line} line in ${hits} of his last ${n}` + (form.curGames ? ` (${curHits} of ${form.curGames} this season).` : "."),
    });
  }

  if (form.h2h) {
    out.push({
      tone: "info",
      text: td
        ? `Scored in ${scoredIn(form.h2h.vals)} of ${form.h2h.n} meeting${form.h2h.n === 1 ? "" : "s"} with ${card.opp} in his log` +
          ` (last one: ${form.h2h.v > 0 ? `${form.h2h.v} TD${form.h2h.v === 1 ? "" : "s"}` : "no TD"}).`
        : `Last time vs ${card.opp}: ${Math.round(form.h2h.v)} ${unit}` + (form.h2h.n > 1 ? ` (${f1(form.h2h.avg)} average across ${form.h2h.n} meetings in his log).` : "."),
    });
  }

  return out;
}

function ordinal(n) {
  if (n == null) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function rankText(cell) {
  if (!cell || !cell.of) return null;
  return `${cell.tied ? "T" : ""}${ordinal(cell.rank)} of ${cell.of}`;
}

function kickoffText(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function capturedWhen() {
  try {
    return new Date(CAPTURED_AT).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  } catch {
    return CAPTURED_AT;
  }
}

function micro(extra) {
  return { fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)", ...extra };
}

// On a phone the filter rows swipe sideways instead of wrapping: wrapped, the
// sixteen game pills alone ran to eight rows, and the bar is sticky, so it
// covered two-thirds of the screen for the whole scroll.
function swipeRow(narrow) {
  return narrow
    ? { flexWrap: "nowrap", overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 2 }
    : { flexWrap: "wrap" };
}

function cardAnchor(id) {
  return `mm-card-${id}`;
}

// --------------------------------------------------------------------------
// Small building blocks
// --------------------------------------------------------------------------

function Tile({ n, label, color }) {
  return (
    <div style={{ flex: "1 1 120px", background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, lineHeight: 1, color: color || "var(--text)" }}>{n}</div>
      <div style={{ ...micro(), marginTop: 5 }}>{label}</div>
    </div>
  );
}

// `sm` is the quieter pill for the long game list, so sixteen matchups don't
// carry the same weight as the market choice above them.
function Filter({ label, on, onClick, tone, size }) {
  const sm = size === "sm";
  return (
    <span
      role="button" tabIndex={0} aria-pressed={on}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="pp-mono"
      style={{
        flex: "none",
        fontSize: sm ? 10 : 11, letterSpacing: "0.06em", padding: sm ? "5px 9px" : "7px 12px", borderRadius: sm ? 6 : 8,
        cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6,
        border: `1px solid ${on ? (tone || "var(--amber)") : sm ? "transparent" : "var(--line)"}`,
        background: on ? "var(--amber-dim)" : sm ? "var(--surface-2)" : "var(--bg)",
        color: on ? (tone || "var(--amber-ink)") : sm ? "var(--dim)" : "var(--text-2)",
      }}
    >
      {label}
    </span>
  );
}

// One labelled row of the filter panel. The label column and the rule between
// rows are what keep market, position, tier and game reading as four separate
// questions -- as one run of identical pills they read as a single list.
function FilterGroup({ label, hint, narrow, first, children }) {
  return (
    <div
      style={{
        display: narrow ? "block" : "grid", gridTemplateColumns: "92px minmax(0, 1fr)", alignItems: "center",
        columnGap: 14, padding: narrow ? "10px 14px" : "11px 16px",
        borderTop: first ? "none" : "1px solid var(--line)",
      }}
    >
      <div style={{ ...micro({ fontSize: 9.5, color: "var(--text-2)" }), marginBottom: narrow ? 7 : 0 }}>
        {label}
        {hint ? <div style={{ fontSize: 9, color: "var(--dim)", letterSpacing: "0.08em", marginTop: 2 }}>{hint}</div> : null}
      </div>
      <div className={narrow ? "nsb" : undefined} style={{ display: "flex", gap: 6, ...swipeRow(narrow) }}>
        {children}
      </div>
    </div>
  );
}

// 0-1 score -> a horizontal meter, same "tough -> soft" reading the artifact
// used, built off the same this-season number the tier badge is.
function Meter({ score, color }) {
  const pct = Math.round(Math.max(0, Math.min(1, score || 0)) * 100);
  return (
    <div>
      <div style={{ height: 6, borderRadius: 99, background: "var(--surface-3, var(--surface-2))", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${pct}%`, borderRadius: 99, background: color }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9.5, color: "var(--dim)", fontFamily: MONO, letterSpacing: "0.08em" }}>
        <span>TOUGH</span>
        <span style={{ color }}>{pct}</span>
        <span>SOFT</span>
      </div>
    </div>
  );
}

// A link that opens this page on one game's sheet (#mismatch-<id>; PropLedger
// routes that hash to the Mismatches page on load).
function SheetActions({ entry, glance }) {
  const [copied, setCopied] = useState(null);
  const [saving, setSaving] = useState(null);
  const save = async () => {
    if (saving === "Saving…") return;
    setSaving("Saving…");
    try {
      await saveSheetImage(entry, { week: glance?.week, throughWeek: glance?.throughWeek });
      setSaving("Saved");
    } catch {
      setSaving("Save failed");
    }
    setTimeout(() => setSaving(null), 1600);
  };
  const btn = { display: "inline-flex", alignItems: "center", lineHeight: 1.2, fontSize: 10.5, letterSpacing: "0.06em", padding: "6px 10px", borderRadius: 7, cursor: "pointer", border: "1px solid var(--line)", background: "var(--surface-2)", whiteSpace: "nowrap" };
  const link = `${window.location.origin}${window.location.pathname}#mismatch-${entry.game.id}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("Copied");
    } catch {
      setCopied("Copy failed");
    }
    setTimeout(() => setCopied(null), 1600);
  };
  return (
    <>
      <span
        role="button" tabIndex={0}
        onClick={save}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); save(); } }}
        className="pp-mono"
        style={{ ...btn, color: saving === "Save failed" ? "var(--neg)" : "var(--text-2)" }}
      >
        {saving || "Save image"}
      </span>
      <span
        role="button" tabIndex={0}
        onClick={copy}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copy(); } }}
        className="pp-mono"
        title={link}
        style={{ ...btn, color: copied === "Copy failed" ? "var(--neg)" : "var(--text-2)" }}
      >
        {copied || "Copy link"}
      </span>
    </>
  );
}

// Appears once the top of the page is out of view and takes the reader back
// to it. Sits above the My Picks dock, which owns the bottom-right corner on
// desktop and the bottom edge on a phone.
//
// On desktop the window scrolls; in the phone shell an inner panel does and
// the window never moves. So it listens to whichever of the page's ancestors
// actually scrolls, found from where the button is mounted.
const BACK_TO_TOP_AFTER = 700;
function scrollParent(el) {
  for (let p = el?.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll") return p;
  }
  return window;
}
function BackToTop({ narrow }) {
  const [show, setShow] = useState(false);
  const probe = React.useRef(null);
  const scroller = React.useRef(window);
  useEffect(() => {
    const el = scrollParent(probe.current);
    scroller.current = el;
    const y = () => (el === window ? window.scrollY : el.scrollTop);
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; setShow(y() > BACK_TO_TOP_AFTER); });
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [narrow]);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!show) return <span ref={probe} hidden />;
  return (
    <button
      ref={probe}
      type="button"
      onClick={() => scroller.current.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })}
      aria-label="Back to top"
      className="pp-mono"
      style={{
        position: "fixed", zIndex: 1999, right: narrow ? 16 : 27,
        bottom: narrow ? "calc(env(safe-area-inset-bottom, 0px) + 92px)" : 76,
        display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 999,
        fontSize: 11, letterSpacing: "0.08em", cursor: "pointer",
        background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--line)",
        boxShadow: "0 6px 18px rgba(0, 0, 0, 0.35)",
      }}
    >
      ↑ TOP
    </button>
  );
}

function ActionButton({ label, onClick }) {
  return (
    <span
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="pp-mono"
      style={{
        flex: 1, textAlign: "center", fontSize: 11, letterSpacing: "0.06em", padding: "9px 10px", borderRadius: 8,
        cursor: "pointer", border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text-2)",
      }}
    >
      {label}
    </span>
  );
}

function StatCell({ label, value, sub, tone }) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 9, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ ...micro(), fontSize: 10, letterSpacing: "0.1em", lineHeight: 1.4 }}>{label}</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, marginTop: 4, color: tone || "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </div>
      {sub ? <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 3, lineHeight: 1.35 }}>{sub}</div> : null}
    </div>
  );
}

// Where the books put their alt-line rungs in each market: 9.5, 19.5 … for
// passing yards, 4.5, 9.5 … for the other yardage markets, every half for
// counts. The floor line is the highest of these he has cleared in at least
// FLOOR_HITS of his last 10 -- the line an alt-over ladder is built from.
const RUNG_STEP = { passYds: 10, passRushYds: 10, rushYds: 5, scrim: 5, recYds: 5, rec: 1, passTd: 1 };
const FLOOR_HITS = 8;
function floorLine(vals, marketId) {
  const step = RUNG_STEP[marketId];
  if (!step || vals.length < FLOOR_HITS) return null;
  // Enough games but not even the lowest rung cleared often enough: a floor
  // of nothing, which is itself the answer.
  let best = { line: null, hits: null, n: vals.length, lowest: step - 0.5 };
  for (let line = step - 0.5; line < 1000; line += step) {
    const hits = vals.filter((v) => v > line).length;
    if (hits < FLOOR_HITS) break;
    best = { line, hits, n: vals.length };
  }
  return best;
}

const possessive = (n) => (/s$/i.test(n) ? `${n}'` : `${n}'s`);
const slotName = (card) => (card.grp === "QB" ? "starting QB" : `${card.grp}${card.slot}`);

// The same line read from both sides: how often he has cleared it, and how
// often this defense let the player in his spot on the depth chart (its WR1,
// its TE1) clear it. Both are counts of real games; neither is a projection.
function lineSummary(card, form, allowed) {
  if (!form || form.failed) return null;
  const td = card.marketId === "anytimeTd";
  const found = td ? { line: 0.5, hits: scoredIn(form.l10), n: form.l10.length } : floorLine(form.l10, card.marketId);
  const floor = found && found.line != null ? found : null;
  const slots = allowed && card.basis === "position" ? slotValues(allowed, card.opp, card.grp, card.slot, card.stat) : null;
  const defHits = floor && slots ? slots.filter((r) => r.value > floor.line).length : null;
  return { td, found, floor, slots, defHits };
}
const hitTone = (hits, n) => (hits / n >= 0.8 ? "var(--pos)" : hits / n < 0.5 ? "var(--neg)" : "var(--text)");

function LineCheck({ card, form, allowed }) {
  const sum = lineSummary(card, form, allowed);
  if (!sum) return null;
  const { td, found, floor, slots } = sum;
  if (!floor && !slots?.length) return null;
  const name = lastName(card.player.name);
  const unit = MARKET_UNIT[card.marketId];
  const { defHits } = sum;
  const tone = hitTone;

  // One side of the check: what it is on the left, the count on the right,
  // and what the count is made of underneath.
  const row = (label, value, valueTone, detail) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", minWidth: 0 }}>{label}</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 19, color: valueTone, whiteSpace: "nowrap" }}>{value}</span>
      </div>
      {detail}
    </div>
  );
  const note = (text) => <span style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.45 }}>{text}</span>;

  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={micro()}>Line check</span>
        {floor && (
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 16, color: "var(--amber-ink)" }}>
            {td ? "Anytime TD" : `Over ${floor.line} ${unit}`}
          </span>
        )}
      </div>

      {floor
        ? row(
          td ? `${name} scored` : `${name} cleared it`,
          `${floor.hits} of ${floor.n}`,
          tone(floor.hits, floor.n),
          note(td
            ? `His last ${floor.n} games, both seasons`
            : `His last ${floor.n} games · the highest line he's cleared in ${FLOOR_HITS} or more`)
        )
        : row(`${possessive(name)} floor`, "None", "var(--text-2)", note(found
          ? `Hasn't cleared even ${found.lowest} ${unit} in ${FLOOR_HITS} of his last ${found.n}`
          : `Fewer than ${FLOOR_HITS} games of log to set one`))}

      {slots?.length
        ? row(
          floor ? `${card.opp} let the ${slotName(card)} clear it` : `${card.opp} vs the ${slotName(card)}`,
          floor ? `${defHits} of ${slots.length}` : "—",
          floor ? tone(defHits, slots.length) : "var(--text-2)",
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {slots.map((r) => {
              const over = floor ? r.value > floor.line : null;
              const c = over == null ? "var(--text-2)" : over ? "var(--pos)" : "var(--neg)";
              return (
                <span
                  key={`${r.wk}-${r.name}`}
                  title={`Week ${r.wk} vs ${r.offense}`}
                  style={{
                    display: "inline-flex", gap: 6, alignItems: "baseline", fontSize: 12, padding: "4px 9px", borderRadius: 7,
                    border: `1px solid color-mix(in srgb, ${c} 45%, transparent)`,
                    background: `color-mix(in srgb, ${c} 10%, transparent)`,
                  }}
                >
                  <span style={{ color: "var(--text)" }}>{lastName(r.name)}</span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 700, color: c }}>{Math.round(r.value)}</span>
                </span>
              );
            })}
          </div>
        )
        : null}
    </div>
  );
}

// Every player at this card's position who faced the defense this season,
// and what each put up in the card's market -- the list behind the rank.
function AllowedList({ card, allowed, narrow }) {
  const [open, setOpen] = useState(false);
  if (!allowed || card.basis !== "position") return null;
  const games = allowedTo(allowed, card.opp, card.grp, card.stat);
  if (!games?.length) return null;
  const unit = STATS[card.stat].label;
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 9 }}>
      <div
        role="button" tabIndex={0} aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer" }}
      >
        <span style={micro()}>{card.grp}s vs {card.opp} this season · {unit}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>{open ? "–" : "+"}</span>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--line)" }}>
          {games.map((g) => (
            <div
              key={g.wk}
              style={{
                display: "grid", gridTemplateColumns: narrow ? "56px minmax(0, 1fr) 40px" : "70px minmax(0, 1fr) 48px",
                gap: 8, alignItems: "baseline", padding: "7px 12px", borderTop: "1px solid var(--line)", fontSize: 12,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>WK {g.wk} {g.home ? "vs" : "@"} {g.offense}</span>
              <span style={{ color: "var(--text-2)", minWidth: 0 }}>
                {g.players.length
                  ? g.players.slice(0, 4).map((p) => `${p.name} ${Math.round(p.value)}`).join(" · ")
                  : `no ${card.grp} involved`}
              </span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, textAlign: "right" }}>{Math.round(g.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Who gets the ball near the goal line -- what an anytime TD actually rides
// on. Counted from the play-by-play: every carry and target from the
// opponent's 20 in, as a share of the team's, and the same inside the 5;
// then how often this defense lets offenses in there and how many of those
// looks go to his position. All this season.
const pct = (x) => `${Math.round(x * 100)}%`;
function redZoneFor(card, allowed) {
  if (!allowed || card.marketId !== "anytimeTd") return null;
  const role = redZoneRole(allowed, card.team, card.player.espnId);
  if (!role || !role.teamLooks) return null;
  return {
    role,
    trips: redZoneTripsAllowed(allowed, card.opp),
    looksAllowed: positionRanks(allowed, card.grp, "rzLooks")?.[card.opp] || null,
  };
}

function RedZone({ card, allowed }) {
  const rz = redZoneFor(card, allowed);
  if (!rz) return null;
  const { role, trips, looksAllowed } = rz;
  const name = lastName(card.player.name);
  const shareTone = role.share >= 0.3 ? "var(--pos)" : role.share < 0.1 ? "var(--neg)" : "var(--text)";
  const row = (label, value, tone, detail) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", minWidth: 0 }}>{label}</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 19, color: tone, whiteSpace: "nowrap" }}>{value}</span>
      </div>
      {detail ? <span style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.45 }}>{detail}</span> : null}
    </div>
  );
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={micro()}>Red zone · {role.games} game{role.games === 1 ? "" : "s"}</span>
        <span style={{ fontSize: 12, color: "var(--text-2)" }}>inside the 20</span>
      </div>
      {row(
        `${possessive(name)} share of ${card.team}'s plays`,
        pct(role.share),
        shareTone,
        `${role.looks} of ${role.teamLooks} carries and targets · ${role.carries} carr${role.carries === 1 ? "y" : "ies"}, ${role.targets} target${role.targets === 1 ? "" : "s"}`
      )}
      {role.teamGl > 0 && row(
        "Inside the 5",
        `${role.gl} of ${role.teamGl}`,
        role.glShare >= 0.3 ? "var(--pos)" : "var(--text)",
        `${card.team} has run ${role.teamGl} play${role.teamGl === 1 ? "" : "s"} from the 5 in`
      )}
      {(trips || looksAllowed) && row(
        `${card.opp} lets offenses in`,
        trips ? `${f1(trips.value)} trips/g` : "—",
        trips && trips.rank >= 22 ? "var(--pos)" : trips && trips.rank <= 11 ? "var(--neg)" : "var(--text)",
        [
          trips ? `${rankText(trips)} in red-zone trips allowed` : null,
          looksAllowed ? `${f1(looksAllowed.value)} red-zone looks a game to ${card.grp}s (${rankText(looksAllowed)})` : null,
        ].filter(Boolean).join(" · ")
      )}
      {role.unmatched > 0 && (
        <span style={{ fontSize: 11.5, color: "var(--dim)" }}>
          {role.unmatched} of {card.team}'s red-zone plays couldn't be tied to a player from the play-by-play and count only in the team total.
        </span>
      )}
    </div>
  );
}

// The injury designation, spelled out beside the name. The avatar's dot says
// the same thing, but a dot is easy to miss on a row someone is skimming to
// pick a bet. Colours are the availability tokens only (CLAUDE.md rule 2);
// an active player gets no tag.
const STATUS_TAG = {
  questionable: { label: "QUESTIONABLE", color: "var(--status-questionable, #e8b13a)" },
  out: { label: "OUT", color: "var(--status-out, #ef5b5b)" },
};
function StatusTag({ status }) {
  const t = STATUS_TAG[status];
  if (!t) return null;
  return (
    <span
      className="pp-mono"
      style={{
        flex: "none", display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
        padding: "3px 7px", borderRadius: 6, lineHeight: 1.2, color: t.color,
        background: `color-mix(in srgb, ${t.color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${t.color} 55%, transparent)`,
      }}
    >
      {t.label}
    </span>
  );
}

// One player in one slim row -- the list's resting state. Everything a scan
// needs to decide whether to open him: who, the market, how soft the defense
// is at his position, and his line check in two counts. A tap opens the full
// card in its place.
function CompactRow({ card, form, allowed, narrow, onOpen }) {
  const tier = TIER_META[card.tier];
  const sum = lineSummary(card, form, allowed);
  const floor = sum?.floor;
  const d = card.defCurrent;
  const open = () => onOpen(card.id);
  const rzRole = sum?.td ? redZoneFor(card, allowed)?.role : null;
  const lineText = form === undefined ? "…" : floor
    ? (sum.td ? (rzRole ? `${pct(rzRole.share)} of RZ plays` : "Anytime TD") : `o${floor.line}`)
    : "—";
  const counts = floor ? (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "baseline", whiteSpace: "nowrap" }}>
      <span style={{ color: hitTone(floor.hits, floor.n), fontWeight: 700 }}>{floor.hits}/{floor.n}</span>
      {sum.slots?.length ? (
        <span style={{ color: "var(--dim)" }}>
          {card.opp} <span style={{ color: hitTone(sum.defHits, sum.slots.length), fontWeight: 700 }}>{sum.defHits}/{sum.slots.length}</span>
        </span>
      ) : null}
    </span>
  ) : null;
  const defText = d ? `${rankText(d)}` : "unranked";
  return (
    <div
      id={cardAnchor(card.id)}
      role="button" tabIndex={0} aria-expanded={false}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      style={{
        display: "grid", alignItems: "center", gap: narrow ? 12 : 18, cursor: "pointer",
        gridTemplateColumns: narrow ? "minmax(0, 1fr) auto" : "minmax(0, 1.7fr) 124px minmax(0, 1.2fr) minmax(0, 1.3fr) 128px 16px",
        padding: narrow ? "13px 14px" : "14px 18px", borderRadius: 12, background: "var(--surface-1)",
        borderTop: "1px solid var(--line)", borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
        borderLeft: `4px solid ${tier.color}`, scrollMarginTop: 90,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <PlayerAvatar
          name={card.player.name} alt={card.player.name} sport="nfl" team={card.team} espnId={card.player.espnId}
          status={card.status} size={narrow ? 40 : 44} surface="var(--surface-1)" dimmed={card.status === "out"}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: narrow ? 15.5 : 16.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
              {card.player.name}
            </span>
            <StatusTag status={card.status} />
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {narrow
              ? <><span style={{ color: "var(--amber-ink)" }}>{card.market}</span> · vs {card.opp} {d ? rankText(d).replace(" of 32", "") : ""}</>
              : <>{card.team} · {card.pos} vs {card.opp}</>}
          </div>
        </div>
      </div>
      {narrow ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right", fontSize: 13.5 }}>
            <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", color: tier.color }}>{tier.label}</div>
            <div style={{ marginTop: 4 }}>{counts || <span style={{ color: "var(--dim)" }}>{lineText}</span>}</div>
          </div>
          <span aria-hidden style={{ color: "var(--text-2)", fontSize: 14 }}>▾</span>
        </div>
      ) : (
        <>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: "var(--amber-ink)", whiteSpace: "nowrap" }}>{card.market}</span>
          <div style={{ minWidth: 0, fontSize: 14 }}>
            <div style={{ fontWeight: 700, color: "var(--pos)", whiteSpace: "nowrap" }}>{card.opp} {defText}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {d && Number.isFinite(d.value) ? `${f1(d.value)}/g ${card.basis === "position" ? `to ${card.grp}s` : "allowed"}` : ""}
            </div>
          </div>
          <div style={{ minWidth: 0, fontSize: 14 }}>
            <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{lineText}{floor && !sum.td ? <span style={{ fontWeight: 400, color: "var(--dim)" }}> {MARKET_UNIT[card.marketId]}</span> : null}</div>
            <div style={{ fontSize: 13.5, marginTop: 2 }}>{counts || <span style={{ color: "var(--dim)" }}>{form === undefined ? "reading log" : "no floor line"}</span>}</div>
          </div>
          <span
            className="pp-mono"
            style={{
              justifySelf: "start", fontSize: 10.5, letterSpacing: "0.06em", padding: "5px 9px", borderRadius: 7,
              color: tier.color, border: `1px solid ${tier.color}`, whiteSpace: "nowrap",
            }}
          >
            {tier.label}
          </span>
          <span aria-hidden style={{ color: "var(--text-2)", fontSize: 14, textAlign: "right" }}>▾</span>
        </>
      )}
    </div>
  );
}

// Three arrangements of the same blocks. "wide" is one long card per player
// in three columns -- who and what / the numbers / the reasons -- read left
// to right instead of scrolled; "mid" folds the numbers under the player;
// "stack" is the phone's single column.
function Card({ card, layout, flashed, onOpenProp, onViewGameProps, form, season, allowed, onCollapse }) {
  const narrow = layout === "stack";
  const wide = layout === "wide";
  const tier = TIER_META[card.tier];
  const label = card.defLabel || DEF_LABEL[card.rowId];
  const captured = capturedOddsFor(card.player.name, card.marketId, card.game?.startsAt);
  const td = card.marketId === "anytimeTd";
  // Yardage and counts read as a per-game average; touchdowns as how many
  // games he scored in, which is what an anytime ticket actually needs.
  const statValue = (xs, avg) => (td ? `${scoredIn(xs)} of ${xs.length}` : `${f1(avg)}/g`);

  const tierBadge = (
    <span
      className="pp-mono"
      style={{
        flex: "none", alignSelf: "flex-start", fontSize: 10.5, letterSpacing: "0.06em",
        padding: "5px 9px", borderRadius: 7, color: tier.color, border: `1px solid ${tier.color}`, whiteSpace: "nowrap",
      }}
    >
      {tier.label}
    </span>
  );

  // On a phone the header spans the card, so it keeps clear of the close control.
  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, paddingRight: narrow && onCollapse ? 92 : 0 }}>
      <div style={{ display: "flex", gap: 11, alignItems: "center", minWidth: 0 }}>
        <PlayerAvatar
          name={card.player.name} alt={card.player.name} sport="nfl"
          team={card.team} espnId={card.player.espnId} status={card.status}
          size={narrow ? 40 : 48} surface="var(--surface-1)" dimmed={card.status === "out"}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: narrow ? 14.5 : 16, lineHeight: 1.25 }}>{card.player.name}</span>
            <StatusTag status={card.status} />
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--text-2)", marginTop: 3 }}>
            <span role="img" style={crest(card.team, "nfl", 14)} />
            {card.team} · {card.pos} vs {card.opp}
          </div>
        </div>
      </div>
    </div>
  );

  const target = (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        background: "var(--amber-dim)", border: "1px solid var(--amber-line, var(--line))",
        borderRadius: 9, padding: "9px 12px",
      }}
    >
      <div style={micro({ color: "var(--amber-ink)" })}>Target</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 15.5, color: "var(--amber-ink)" }}>{card.market}</div>
    </div>
  );

  const capturedBox = captured && (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={micro()}>Captured line · {CAPTURED_SOURCE}</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 14 }}>
          Over {captured.line} <span style={{ color: "var(--pos)" }}>{formatOdds(captured.odds)}</span>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 4 }}>
        Read by hand at {capturedWhen()} — a snapshot, not a live price. It will have moved.
      </div>
    </div>
  );

  const stats = (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <StatCell
        label={`${card.opp} ${label}`}
        value={card.defCurrent && Number.isFinite(card.defCurrent.value) ? `${f1(card.defCurrent.value)}/g` : "—"}
        sub={`${rankText(card.defCurrent) || "unranked"}${card.defPrior ? ` · ${ordinal(card.defPrior.rank)} last yr` : ""}`}
        tone="var(--pos)"
      />
      <StatCell
        label={`${lastName(card.player.name)} · ${season}`}
        value={form === undefined ? "…" : form && form.curGames ? statValue(form.cur, form.curAvg) : "—"}
        sub={form === undefined ? "reading log" : form && form.curGames
          ? (td ? "games with a TD" : `${form.curGames} game${form.curGames === 1 ? "" : "s"} · ${MARKET_UNIT[card.marketId]}`)
          : "no games yet"}
      />
      <StatCell
        label="Last 10"
        value={form === undefined ? "…" : form && form.l10.length ? statValue(form.l10, form.l10Avg) : "—"}
        sub={form && form.l10.length ? (td ? "games with a TD, both seasons" : `${form.l10.length} games, both seasons`) : ""}
      />
      <StatCell
        label="Last 3"
        value={form === undefined ? "…" : form && form.last3.length ? form.last3.map((g) => Math.round(g.v)).join(" · ") : "—"}
        sub={form && form.last3.length ? form.last3.map((g) => `${g.home ? "vs " : "@"}${g.opp}`).join(" · ") : ""}
      />
    </div>
  );

  const why = (
    <div>
      {/* Tall enough that the reasons start below the Close button in the card's corner. */}
      <div style={{ ...micro({ marginBottom: 8 }), minHeight: onCollapse && !narrow ? 30 : undefined, display: "flex", alignItems: "center" }}>Why it's on the board</div>
      {form === undefined ? (
        <div style={{ fontSize: 13, color: "var(--dim)" }}>Reading {card.player.name}'s game log…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {insightsFor(card, form, captured, season, allowed).map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", fontSize: 13, lineHeight: 1.55, color: "var(--text-2)" }}>
              <span
                aria-hidden
                style={{
                  flex: "none", fontFamily: MONO, fontSize: 10, width: 12, textAlign: "center",
                  color: it.tone === "pro" ? "var(--pos)" : it.tone === "con" ? "var(--neg)" : "var(--dim)",
                }}
              >
                {it.tone === "pro" ? "▲" : it.tone === "con" ? "▼" : "•"}
              </span>
              <span style={{ color: it.tone === "info" ? "var(--text-2)" : "var(--text)" }}>{it.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const actions = (onOpenProp || onViewGameProps) && (
    <div style={{ display: "flex", flexDirection: wide ? "column" : "row", gap: 8 }}>
      {onOpenProp && <ActionButton label="Open player page →" onClick={() => onOpenProp(card)} />}
      {onViewGameProps && <ActionButton label={`${card.team} vs ${card.opp} in Prop Feed →`} onClick={() => onViewGameProps(card.game)} />}
    </div>
  );

  const meter = <Meter score={card.score} color={tier.color} />;
  const lineCheck = <><LineCheck card={card} form={form} allowed={allowed} /><RedZone card={card} allowed={allowed} /></>;
  const allowedList = <AllowedList card={card} allowed={allowed} narrow={narrow} />;
  const col = (children, extra) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, ...extra }}>{children}</div>
  );

  let body;
  if (wide) {
    body = (
      <div style={{ display: "grid", gridTemplateColumns: "236px minmax(0, 1fr) minmax(0, 1.2fr)", gap: 22, alignItems: "start" }}>
        {col(<>{header}{tierBadge}{target}{meter}{capturedBox}<div style={{ marginTop: "auto" }}>{actions}</div></>, { alignSelf: "stretch" })}
        {col(<>{stats}{lineCheck}</>)}
        {col(<>{why}{allowedList}</>)}
      </div>
    );
  } else if (layout === "mid") {
    body = (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)", gap: 20, alignItems: "start" }}>
        {col(<>{header}{tierBadge}{target}{meter}{capturedBox}{stats}{lineCheck}</>)}
        {col(<>{why}{allowedList}{actions}</>)}
      </div>
    );
  } else {
    body = col(<>{header}{tierBadge}{target}{capturedBox}{meter}{stats}{lineCheck}{allowedList}{why}{actions}</>, { gap: 10 });
  }

  return (
    <div
      id={cardAnchor(card.id)}
      style={{
        padding: narrow ? 14 : 18,
        // Longhands only: `border` beside `borderLeft` makes React warn on the
        // flash re-render, since changing the shorthand would clobber the left.
        borderTop: `1px solid ${flashed ? tier.color : "var(--line)"}`,
        borderRight: `1px solid ${flashed ? tier.color : "var(--line)"}`,
        borderBottom: `1px solid ${flashed ? tier.color : "var(--line)"}`,
        borderLeft: `4px solid ${tier.color}`,
        borderRadius: 12, background: flashed ? "var(--surface-2)" : "var(--surface-1)",
        boxShadow: flashed ? `0 0 0 3px color-mix(in srgb, ${tier.color} 22%, transparent)` : "none",
        transition: "background 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease",
        scrollMarginTop: 90, position: "relative",
      }}
    >
      {onCollapse && (
        <button
          type="button"
          onClick={() => onCollapse(card.id)}
          aria-label={`Close ${card.player.name}'s card`}
          className="pp-mono"
          style={{
            position: "absolute", top: narrow ? 12 : 14, right: narrow ? 12 : 14, zIndex: 1,
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: "0.06em",
            padding: "6px 11px", borderRadius: 8, cursor: "pointer",
            border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text-2)",
          }}
        >
          Close <span aria-hidden>✕</span>
        </button>
      )}
      {body}
    </div>
  );
}

// The single defense on the slate that is softest against the pass and the run
// together -- the mean of its two this-season ranks. Judged from the ranks
// themselves, not from its cards: averaging card scores let a defense with one
// card (CAR, 32nd against the run and nothing else) outrank one that is bottom
// three at both.
function useFeatured(cards, defenses) {
  return useMemo(() => {
    if (!cards.length || !defenses) return null;
    const byOpp = {};
    cards.forEach((c) => { (byOpp[c.opp] = byOpp[c.opp] || []).push(c); });
    let best = null;
    Object.keys(byOpp).forEach((opp) => {
      const d = defenses[opp];
      if (!d || !d.softness.length) return;
      // Divided by two either way, so a defense with only one row ranked can't
      // win on half the evidence.
      const avg = d.softness.reduce((a, b) => a + b, 0) / 2;
      if (!best || avg > best.avg) best = { opp, avg, d };
    });
    if (!best) return null;
    const list = byOpp[best.opp];
    return {
      opp: best.opp,
      list,
      team: list[0].team,
      game: list[0].game,
      passCell: best.d.passYds ? { defCurrent: best.d.passYds, defPrior: best.d.passYdsPrior } : null,
      rushCell: best.d.rushYds ? { defCurrent: best.d.rushYds, defPrior: best.d.rushYdsPrior } : null,
    };
  }, [cards, defenses]);
}

function Featured({ featured, narrow, onJump }) {
  if (!featured) return null;
  // The spotlight is "play these", so an OUT starter is left off the chips --
  // his full card is still in the list below, marked out.
  const playing = featured.list.filter((c) => c.status !== "out");
  const smashes = playing.filter((c) => c.tier === "SMASH");
  const spotlight = (smashes.length ? smashes : playing).slice(0, narrow ? 3 : 5);
  return (
    <div
      style={{
        marginTop: 22, padding: narrow ? 16 : 20, borderRadius: 16,
        border: "1px solid var(--amber-line, var(--line))",
        background: "linear-gradient(160deg, var(--amber-dim), var(--surface-1) 65%)",
      }}
    >
      <div style={{ ...micro(), color: "var(--amber-ink)" }}>SOFTEST DEFENSE ON THE SLATE</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: narrow ? 22 : 28, display: "flex", alignItems: "center", gap: 8 }}>
          <span role="img" style={crest(featured.opp, "nfl", narrow ? 22 : 26)} />
          {featured.opp}
        </span>
        <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
          vs {featured.team} · {kickoffText(featured.game?.startsAt)}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(2, 1fr)", gap: 10, marginTop: 14 }}>
        {featured.passCell && (
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ ...micro(), lineHeight: 1.5 }}>{featured.opp} vs pass · this / last</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, marginTop: 5 }}>
              {rankText(featured.passCell.defCurrent) || "—"} <span style={{ color: "var(--dim)", fontWeight: 400, fontSize: 12.5 }}>/ {rankText(featured.passCell.defPrior) || "—"}</span>
            </div>
          </div>
        )}
        {featured.rushCell && (
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ ...micro(), lineHeight: 1.5 }}>{featured.opp} vs run · this / last</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, marginTop: 5 }}>
              {rankText(featured.rushCell.defCurrent) || "—"} <span style={{ color: "var(--dim)", fontWeight: 400, fontSize: 12.5 }}>/ {rankText(featured.rushCell.defPrior) || "—"}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {spotlight.map((c) => (
          <span
            key={c.id}
            role="button" tabIndex={0}
            onClick={() => onJump(c.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onJump(c.id); } }}
            className="pp-mono"
            style={{
              display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, cursor: "pointer",
              padding: "7px 11px", borderRadius: 9, background: "var(--surface-1)", border: "1px solid var(--amber-line, var(--line))",
            }}
          >
            <PlayerAvatar name={c.player.name} sport="nfl" team={c.team} espnId={c.player.espnId} status={c.status} size={20} surface="var(--surface-1)" />
            {c.player.name} · {c.pos} · {c.market} →
          </span>
        ))}
      </div>
    </div>
  );
}

// One row per player the search found: his matchup, then a chip for every
// market his position can be bet in with the grade it got. A chip jumps to
// that market's card. TOUGH is shown, not hidden -- "is Kelce a play anywhere
// this week?" needs the no's as much as the yes's.
function SearchSummary({ hits, query, onJump, narrow, runCheck }) {
  if (!hits.length) {
    return (
      <div style={{ marginTop: 18, fontSize: 13, color: "var(--dim)", lineHeight: 1.6 }}>
        No starter on this week's slate matches “{query}”. The report covers each team's depth-chart starters —
        one QB, one RB, the formation's receivers and tight end — so a backup won't appear here.
      </div>
    );
  }
  return (
    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      {hits.map((list) => {
        const c0 = list[0];
        return (
          <div key={c0.player.espnId} style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", padding: narrow ? 12 : 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <PlayerAvatar
                name={c0.player.name} alt={c0.player.name} sport="nfl" team={c0.team} espnId={c0.player.espnId}
                status={c0.status} size={34} surface="var(--surface-1)" dimmed={c0.status === "out"}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 14 }}>{c0.player.name}</span>
                  <StatusTag status={c0.status} />
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                  {c0.team} · {c0.pos} vs {c0.opp} · {kickoffText(c0.game?.startsAt)}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {list.map((c) => {
                const t = TIER_META[c.tier];
                const run = runCheck ? runCheck(c) : true;
                // A quarterback who doesn't run isn't graded for anytime TD or
                // rush yards at all -- say so rather than hand him a tier.
                if (run !== true) {
                  return (
                    <span
                      key={c.id}
                      className="pp-mono"
                      style={{
                        display: "inline-flex", gap: 6, alignItems: "center", fontSize: 10.5, letterSpacing: "0.04em",
                        padding: "6px 9px", borderRadius: 8, whiteSpace: "nowrap",
                        border: "1px dashed var(--line)", color: "var(--dim)",
                      }}
                    >
                      {c.market}
                      <span>{run === false ? "doesn't run — not graded" : "checking…"}</span>
                    </span>
                  );
                }
                return (
                  <span
                    key={c.id}
                    role="button" tabIndex={0}
                    onClick={() => onJump(c.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onJump(c.id); } }}
                    className="pp-mono"
                    style={{
                      display: "inline-flex", gap: 6, alignItems: "center", fontSize: 10.5, letterSpacing: "0.04em",
                      padding: "6px 9px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap",
                      border: `1px solid ${c.tier === "TOUGH" ? "var(--line)" : t.color}`, color: "var(--text-2)",
                    }}
                  >
                    {c.market}
                    <span style={{ color: t.color }}>{c.tier === "TOUGH" ? "TOUGH" : t.label}</span>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MismatchReportPage({ onOpenProp, onViewGameProps, fetchLogs }) {
  const narrow = useIsNarrow(760);
  // Below this the three-column card has no room for its reasons column.
  const midWidth = useIsNarrow(1120);
  const cardLayout = narrow ? "stack" : midWidth ? "mid" : "wide";
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [market, setMarket] = useState(HEADLINE);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("ALL");
  const [tier, setTier] = useState(null);
  const [game, setGame] = useState(null);
  const [flashId, setFlashId] = useState(null);
  // Cards rest as compact rows. `openAll` is the Expand all switch; `openIds`
  // holds the exceptions to it (opened while it's off, closed while it's on).
  const [openAll, setOpenAll] = useState(false);
  const [openIds, setOpenIds] = useState(() => new Set());
  const isOpen = (id) => openAll !== openIds.has(id);
  const setOpen = (id, want) => setOpenIds((prev) => {
    const next = new Set(prev);
    if (want !== openAll) next.add(id); else next.delete(id);
    return next;
  });
  const openCard = (id) => {
    setOpen(id, true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById(cardAnchor(id))?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }));
  };
  const closeCard = (id) => {
    setOpen(id, false);
    requestAnimationFrame(() => document.getElementById(cardAnchor(id))?.scrollIntoView({ block: "nearest" }));
  };
  const toggleAll = () => { setOpenAll((v) => !v); setOpenIds(new Set()); };
  const [howOpen, setHowOpen] = useState(false);
  // Game view is the weekly cheat sheet; player view is the cards. A shared
  // link to one game (#mismatch-<id>) opens on that game's sheet.
  const [view, setView] = useState(() => (/^#mismatch-/.test(window.location.hash) ? "game" : "player"));
  const [win, setWin] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchNflWeeklyMismatches()
      .then((res) => { if (alive) setData(res); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  const allCards = data?.cards || [];
  const games = data?.games || [];
  const sheet = useMemo(() => buildSheet(data), [data]);
  const windows = useMemo(() => [...new Set(games.map((g) => kickoffWindow(g.startsAt)))], [games]);
  const inWindow = (g) => !win || kickoffWindow(g.startsAt) === win;

  // A shared game link scrolls to its sheet once the sheets exist.
  useEffect(() => {
    const m = /^#mismatch-(.+)$/.exec(window.location.hash);
    if (!m || !sheet) return;
    requestAnimationFrame(() => document.getElementById(`mismatch-${m[1]}`)?.scrollIntoView({ block: "start" }));
  }, [sheet]);
  const season = data?.season;

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const matchesQuery = (c) => c.player.name.toLowerCase().includes(q)
    || c.team.toLowerCase() === q || c.opp.toLowerCase() === q;

  // The chosen market's cards, every grade included -- a search has to be
  // able to say "tough matchup" about the player it finds.
  const marketCards = useMemo(
    () => allCards.filter((c) => (market === HEADLINE ? c.headline : c.marketId === market)),
    [allCards, market]
  );
  // What the page shows unsearched: the soft matchups only.
  const boardCards = useMemo(() => marketCards.filter((c) => c.tier !== "TOUGH"), [marketCards]);

  const posOptions = market === HEADLINE ? POS_ORDER : MARKET_BY_ID[market].positions;
  const visibleRaw = useMemo(
    () => (searching ? marketCards.filter(matchesQuery) : boardCards)
      .filter((c) => (pos === "ALL" || c.pos === pos) && (!tier || c.tier === tier) && (!game || c.game.id === game) && inWindow(c.game)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searching, q, marketCards, boardCards, pos, tier, game, win]
  );
  const searchRunChecks = useMemo(
    () => (searching ? allCards.filter((c) => matchesQuery(c) && needsRunCheck(c)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searching, q, allCards]
  );
  // Every QB the run check needs is fetched even when he's filtered out of
  // view, so the tiles and spotlight count the right quarterbacks.
  const logTargets = useMemo(
    () => [...visibleRaw, ...boardCards.filter(needsRunCheck), ...searchRunChecks],
    [visibleRaw, boardCards, searchRunChecks]
  );
  const logs = useCardLogs(logTargets, fetchLogs);

  // true = shown; false = a QB who doesn't run, not graded in this market;
  // undefined = his log hasn't answered yet, so he isn't shown until it does.
  const runCheck = (c) => {
    if (!needsRunCheck(c) || !fetchLogs) return true;
    const log = logs[c.player.espnId];
    if (log === undefined) return undefined;
    return qbRunning(log).qualifies[c.marketId];
  };
  const visible = useMemo(
    () => visibleRaw.filter((c) => runCheck(c) === true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleRaw, logs, fetchLogs]
  );
  const boardGated = useMemo(
    () => boardCards.filter((c) => runCheck(c) === true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardCards, logs, fetchLogs]
  );
  const featured = useFeatured(boardGated, data?.defenses);
  // undefined = still loading; null = no fetcher wired; otherwise the form.
  const forms = useMemo(() => {
    const out = {};
    visible.forEach((c) => {
      const log = logs[c.player.espnId];
      out[c.id] = !fetchLogs ? null : log === undefined ? undefined : playerForm(c, log);
    });
    return out;
  }, [visible, logs, fetchLogs]);

  // Same defense means the same score for every starter on that team, so ties
  // are everywhere -- HOU's three receivers all read 97. Within a tie the
  // player actually producing in the market this season goes first.
  const filtered = useMemo(() => {
    const byForm = (c) => {
      const f = forms[c.id];
      if (!f) return -1;
      if (c.marketId === "anytimeTd") return f.l10.length ? scoredIn(f.l10) / f.l10.length : -1;
      return Number.isFinite(f.curAvg) ? f.curAvg : Number.isFinite(f.l10Avg) ? f.l10Avg : -1;
    };
    // An OUT starter stays on the page (nothing is silently dropped) but sinks
    // below everyone who is actually playing.
    const isOut = (c) => (c.status === "out" ? 1 : 0);
    return visible.slice().sort((a, b) => (isOut(a) - isOut(b)) || (b.score - a.score) || (byForm(b) - byForm(a)));
  }, [visible, forms]);
  const grouped = useMemo(() => {
    const by = {};
    filtered.forEach((c) => { (by[c.pos] = by[c.pos] || []).push(c); });
    return POS_ORDER.map((p) => [p, by[p] || []]).filter(([, list]) => list.length);
  }, [filtered]);

  // Search, across every market: each player found, with his grade in every
  // market his position can bet -- "is he a smash for anything this week?"
  const searchHits = useMemo(() => {
    if (!searching) return [];
    const byPlayer = new Map();
    allCards.filter(matchesQuery).forEach((c) => {
      const k = c.player.espnId;
      if (!byPlayer.has(k)) byPlayer.set(k, []);
      byPlayer.get(k).push(c);
    });
    const order = Object.fromEntries(MARKETS.map((m, i) => [m.id, i]));
    return [...byPlayer.values()].slice(0, 8)
      .map((list) => list.slice().sort((a, b) => order[a.marketId] - order[b.marketId]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, q, allCards]);

  const pickMarket = (m) => {
    setMarket(m);
    const allowed = m === HEADLINE ? POS_ORDER : MARKET_BY_ID[m].positions;
    if (pos !== "ALL" && !allowed.includes(pos)) setPos("ALL");
  };

  const gameCount = games.length;
  const smashCount = boardGated.filter((c) => c.tier === "SMASH").length;
  const favCount = boardGated.filter((c) => c.tier === "FAV").length;

  const jumpTo = (id) => {
    setView("player");
    setOpen(id, true);
    const card = allCards.find((c) => c.id === id);
    if (card && !filtered.some((c) => c.id === id)) {
      setPos("ALL"); setTier(null); setGame(null); setWin(null);
      const inMarket = market === HEADLINE ? card.headline : card.marketId === market;
      if (!inMarket) setMarket(card.marketId);
    }
    // Wait a frame for the filter reset to re-render the card back into the
    // DOM before scrolling to it -- jumping first would target a node that
    // doesn't exist yet whenever the click came from outside the current filter.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(cardAnchor(id));
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
    setFlashId(id);
    setTimeout(() => setFlashId((v) => (v === id ? null : v)), 1600);
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: narrow ? "16px 16px 40px" : "28px 24px 60px" }}>
      <div style={micro({ marginBottom: 8 })}>NFL · WEEKLY MISMATCH REPORT</div>
      <h1 style={{ fontFamily: DISPLAY, fontSize: narrow ? 26 : 34, fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
        This week's softest matchups
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, maxWidth: "60ch", marginTop: 10 }}>
        Every starter on this week's real depth charts, graded against what the opposing defense actually allows
        in each prop market. Pick a market below — Anytime TD, Receptions, Pass Yds — or search a player to see
        where he lands in all of them.
      </p>

      {data?.ready && (
        <>
          {sheet ? (
            <>
              <Headline glance={sheet.glance} />
              <Glance glance={sheet.glance} onJump={jumpTo} />
            </>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
              <Tile n={gameCount} label="games this week" />
              <Tile n={boardGated.length} label={market === HEADLINE ? "soft matchups" : `${MARKET_BY_ID[market].label} spots`} />
              <Tile n={smashCount} label="smash spots" color="var(--pos)" />
              <Tile n={favCount} label="favorable" color="var(--amber-ink)" />
            </div>
          )}

          <details
            open={howOpen}
            onToggle={(e) => setHowOpen(e.target.open)}
            style={{ marginTop: 14, border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)" }}
          >
            <summary
              className="pp-mono"
              style={{ cursor: "pointer", listStyle: "none", padding: "11px 14px", fontSize: 12, color: "var(--text-2)", display: "flex", justifyContent: "space-between" }}
            >
              How the mismatch score works
              <span style={{ color: "var(--dim)" }}>{howOpen ? "–" : "+"}</span>
            </summary>
            <div style={{ padding: "0 14px 14px", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>
              The tier is this season's defense, nothing else, read position by position from every finished game's
              ESPN box score: what the opponent has allowed per game to players at the card's own position, in the
              card's own market (rec yds allowed to TEs for a tight end's Rec Yds), ranked among the 32 and turned into
              a 0–100 softness score — 32nd of 32 is 100. The line check under each card takes the highest alt line
              the player has cleared in 8 of his last 10 and counts how often this defense let the same spot on the
              depth chart (its WR1, its TE1 — whoever drew the most targets or touches that game) clear it. If the box
              scores can't be read, the card falls back to the opponent's team-wide ESPN rank and names it. Anytime TD means carrying or
              catching it in — a quarterback's passing TDs never count — so quarterbacks only appear in Anytime TD and
              Rush Yds if their own log shows they run — for Anytime TD, a rushing TD in {Math.round(QB_TD_RATE * 100)}%+ of
              their last {QB_RUN_WINDOW} games; for Rush Yds, that or {QB_RUN_CARRIES}+ carries a game; at least
              {" "}{QB_RUN_MIN_GAMES} games of log either way. Last season is shown
              for context but never moves the tier. The insights under each card come from the player's own game log.
            </div>
          </details>

          {data.teamsLoaded < data.teamsTotal && (
            <div style={{ ...micro(), color: "var(--amber-ink)", marginTop: 10 }}>
              {data.teamsLoaded} of {data.teamsTotal} teams' defense stats loaded — the rest are left off, not guessed
            </div>
          )}

          {sheet && (
            <div role="tablist" aria-label="View" style={{ display: "inline-flex", gap: 4, marginTop: 20, padding: 4, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-1)" }}>
              {[["game", "Game view"], ["player", "Player view"]].map(([id, label]) => (
                <span
                  key={id} role="tab" tabIndex={0} aria-selected={view === id}
                  onClick={() => setView(id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setView(id); } }}
                  className="pp-mono"
                  style={{
                    fontSize: 11, letterSpacing: "0.06em", padding: "7px 14px", borderRadius: 7, cursor: "pointer",
                    background: view === id ? "var(--amber-dim)" : "transparent",
                    color: view === id ? "var(--amber-ink)" : "var(--text-2)",
                    border: `1px solid ${view === id ? "var(--amber)" : "transparent"}`,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Without the box scores there are no game sheets, and the old
              spotlight stands in for the tiles. */}
          {!sheet && <Featured featured={featured} narrow={narrow} onJump={jumpTo} />}
        </>
      )}

      {data?.ready && sheet && view === "game" && (
        <div style={{ marginTop: 18 }}>
          <div className={narrow ? "nsb" : undefined} style={{ display: "flex", gap: 6, ...swipeRow(narrow), marginBottom: 14 }}>
            <Filter label="All games" on={!win} onClick={() => setWin(null)} />
            {windows.map((w) => <Filter key={w} label={w} on={win === w} onClick={() => setWin((v) => (v === w ? null : w))} />)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {sheet.games.filter((e) => inWindow(e.game)).map((e) => (
              <GameSheet key={e.game.id} entry={e} narrow={narrow} onJump={jumpTo} actions={<SheetActions entry={e} glance={sheet.glance} />} />
            ))}
          </div>
        </div>
      )}

      {!data && !error && (
        <div style={{ marginTop: 30, fontSize: 13, color: "var(--dim)" }}>Reading this week's real slate, defense ranks and depth charts…</div>
      )}
      {(error || (data && !data.ready)) && (
        <div style={{ marginTop: 30, fontSize: 13, color: "var(--dim)" }}>
          Couldn't load this week's report — one of the real data sources it needs (this week's slate, team defense
          stats or depth charts) didn't answer. Try again shortly.
        </div>
      )}

      {data?.ready && view === "player" && (
        <>
          {/* Search and market stay pinned while the cards scroll -- they're
              what the page is showing. Position, tier and game refine it and
              scroll away with the top of the page. The two halves are drawn
              as one bordered panel until the top one sticks. */}
          <div
            style={{
              position: "sticky", top: 0, zIndex: 5, marginTop: 24,
              background: "var(--bg)", paddingTop: 8,
            }}
          >
            <div style={{ border: "1px solid var(--line)", borderRadius: "12px 12px 0 0", background: "var(--surface-1)" }}>
              <div style={{ padding: narrow ? "12px 14px 4px" : "14px 16px 6px" }}>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={narrow ? "Search a player or team" : "Search a player or team — see where he grades in every market"}
                  aria-label="Search players"
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 9,
                    border: `1px solid ${searching ? "var(--amber)" : "var(--line)"}`, background: "var(--bg)",
                    color: "var(--text)", fontSize: 13, outline: "none",
                  }}
                />
              </div>
              <FilterGroup label="Market" hint="prop type" narrow={narrow} first>
                <Filter label="Best per player" on={market === HEADLINE} onClick={() => pickMarket(HEADLINE)} />
                {MARKETS.map((m) => (
                  <Filter key={m.id} label={m.label} on={market === m.id} onClick={() => pickMarket(m.id)} />
                ))}
              </FilterGroup>
            </div>
          </div>

          <div style={{ border: "1px solid var(--line)", borderTop: "none", borderRadius: "0 0 12px 12px", background: "var(--surface-1)" }}>
            <FilterGroup label="Position" narrow={narrow} first>
              {["ALL", ...posOptions].map((p) => (
                <Filter key={p} label={p} on={pos === p} onClick={() => setPos(p)} />
              ))}
            </FilterGroup>
            <FilterGroup label="Tier" hint="how soft" narrow={narrow}>
              <Filter label="All tiers" on={!tier} onClick={() => setTier(null)} />
              {(searching ? ["SMASH", "FAV", "LEAN", "TOUGH"] : ["SMASH", "FAV", "LEAN"]).map((t) => (
                <Filter key={t} label={TIER_META[t].label} on={tier === t} onClick={() => setTier((v) => (v === t ? null : t))} tone={TIER_META[t].color} />
              ))}
            </FilterGroup>
            {windows.length > 1 && (
              <FilterGroup label="Kickoff" narrow={narrow}>
                <Filter label="All" on={!win} onClick={() => { setWin(null); setGame(null); }} />
                {windows.map((w) => (
                  <Filter key={w} label={w} on={win === w} onClick={() => { setWin((v) => (v === w ? null : w)); setGame(null); }} />
                ))}
              </FilterGroup>
            )}
            {games.length > 0 && (
              <FilterGroup label="Game" narrow={narrow}>
                <Filter size="sm" label="All games" on={!game} onClick={() => setGame(null)} />
                {games.filter(inWindow).map((g) => (
                  <Filter
                    key={g.id}
                    size="sm"
                    label={`${g.away.abbr} @ ${g.home.abbr}`}
                    on={game === g.id}
                    onClick={() => setGame((v) => (v === g.id ? null : g.id))}
                  />
                ))}
              </FilterGroup>
            )}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                padding: narrow ? "9px 14px" : "10px 16px", borderTop: "1px solid var(--line)",
              }}
            >
              <span style={{ ...micro(), color: "var(--text-2)" }}>
                {searching
                  ? `${filtered.length} result${filtered.length === 1 ? "" : "s"} for “${query.trim()}” in ${market === HEADLINE ? "best-per-player" : MARKET_BY_ID[market].label}`
                  : `${filtered.length} of ${boardGated.length} soft matchups`}
              </span>
              <span
                role="button" tabIndex={0}
                onClick={toggleAll}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleAll(); } }}
                style={{ ...micro(), color: "var(--text-2)", cursor: "pointer" }}
              >
                {openAll ? "Collapse all ▴" : "Expand all ▾"}
              </span>
              {(pos !== "ALL" || tier || game || win || searching) && (
                <span
                  role="button" tabIndex={0}
                  onClick={() => { setPos("ALL"); setTier(null); setGame(null); setWin(null); setQuery(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPos("ALL"); setTier(null); setGame(null); setWin(null); setQuery(""); } }}
                  style={{ ...micro(), color: "var(--amber-ink)", cursor: "pointer", marginLeft: "auto" }}
                >
                  Clear filters ×
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {searching && data?.ready && view === "player" && (
        <SearchSummary hits={searchHits} query={query.trim()} onJump={jumpTo} narrow={narrow} runCheck={runCheck} />
      )}

      {data?.ready && view === "player" && !filtered.length && !searching && boardGated.length > 0 && (
        <div style={{ marginTop: 20, fontSize: 13, color: "var(--dim)" }}>Nothing matches these filters.</div>
      )}
      {data?.ready && view === "player" && !boardGated.length && !searching && (
        <div style={{ marginTop: 30, fontSize: 13, color: "var(--dim)" }}>
          Nothing cleared the LEAN threshold in this market this week — every matchup graded closer to average than soft.
        </div>
      )}

      {view === "player" && grouped.map(([p, list]) => (
        <div key={p} style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ ...micro(), fontSize: 11 }}>
              {p} · {list.length} · {market === HEADLINE ? `target ${list[0].market}` : MARKET_BY_ID[market].label}
            </span>
            <span style={{ fontSize: 10.5, color: "var(--dim)" }}>
              graded on the opponent's {list[0].defLabel || DEF_LABEL[list[0].rowId]} per game
              {p === "QB" && QB_GATED.has(list[0].marketId)
                ? list[0].marketId === "anytimeTd"
                  ? ` · QBs who score on the ground only — a rushing TD in ${Math.round(QB_TD_RATE * 100)}%+ of his last ${QB_RUN_WINDOW} games`
                  : ` · running QBs only — ${QB_RUN_CARRIES}+ carries a game or a rushing TD in ${Math.round(QB_TD_RATE * 100)}%+ of his last ${QB_RUN_WINDOW}`
                : ""}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((c) => (isOpen(c.id) ? (
              <div key={c.id} style={{ margin: "6px 0" }}>
                <Card card={c} layout={cardLayout} flashed={flashId === c.id} onOpenProp={onOpenProp} onViewGameProps={onViewGameProps} form={forms[c.id]} season={season} allowed={data?.allowed} onCollapse={closeCard} />
              </div>
            ) : (
              <CompactRow key={c.id} card={c} form={forms[c.id]} allowed={data?.allowed} narrow={narrow} onOpen={openCard} />
            )))}
          </div>
        </div>
      ))}

      <BackToTop narrow={narrow} />

      <div style={{ marginTop: 40, paddingTop: 18, borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--dim)", lineHeight: 1.6 }}>
No moneyline or spread appears here — this app's only live, licensed sportsbook odds feed runs against a small
        monthly budget already committed to the MLB odds panel. Where a card shows a "Captured line," that price was
        read by hand off a sportsbook aggregator at a single point in time ({capturedWhen()}) and is frozen, not
        live — treat it as a reference from when this page's data was last refreshed, not a current quote. Availability
        dots come from each team's live ESPN roster; a player with no dot has no status on record, not a clean bill
        of health.
      </div>
    </div>
  );
}
