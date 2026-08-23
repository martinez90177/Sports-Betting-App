import React, { useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import FeedFormStrip from "./FormGraph.jsx";
import MinSampleControl, { loadSamplePresets, saveSamplePresets, MIN_SAMPLE_ALL } from "./MinSampleControl.jsx";

// --------------------------------------------------------------------------
// The board (item 17)
// --------------------------------------------------------------------------
// Spec: `design_handoff_proppalace_full/README.md`, "Screen 2 — The board",
// and `PropPalace Board.dc.html` for exact values.
//
// ---- What this is for, and what it is not ----
//
// The board and the prop feed are both filtered lists of props, and that
// resemblance is not a licence to converge them. Alex's rule, recorded in
// docs/REDESIGN_PLAN.md: keep the three surfaces separate, do not merge them
// in any way.
//
//   The feed's job:  work through props you have already chosen. Dense, fast
//                    to scan, one flat list.
//   The board's job: decide *which* props are worth working through. Roomier,
//                    grouped under the game each prop belongs to, with the
//                    controls that narrow a slate to the few worth opening.
//
// The test when unsure where something belongs: does it help someone decide
// what to research (board), or help them work through what they already
// picked (feed)? Neither surface grows toward the other.
//
// The board is also NOT the Games page. Games tracks live matches, scores and
// box scores so people don't leave for ESPN mid-session; this ranks props.
// Both ship, both keep their own route -- Alex, 2026-08-21.
//
// ---- The minimum-sample control ----
//
// Shared with the phone's refine sheet and the feed's Filters panel; see
// MinSampleControl. It is a display threshold, not a filter: a prop under the
// minimum keeps its row here too and simply shows no rate. Hiding those rows
// would make the board answer "is there anything on this game?" with "no"
// when the honest answer is "yes, but not enough games to say anything".

const GRID = "232px 176px 148px 1fr 132px";
const LABEL = { fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dim)" };

// The summary strip's two type styles, off `PropPalace Board v2.dc.html` --
// the same pair the Prop Feed and Player Detail strips use.
const BOARD_CELL_LABEL = { fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--dim)", whiteSpace: "nowrap" };
const BOARD_CELL_VALUE = { fontFamily: "'Space Mono', monospace", fontSize: 15, marginTop: 6, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

// The splits the rail offers. Each is a predicate over a row's own game log,
// so a split recomputes the rate AND its sample together -- the README calls
// this out as critical, and it is why `rateFor` below returns both numbers
// from one pass instead of reusing a precomputed percentage.
const SPLITS = [
  { id: "season", label: "Season", test: null },
  { id: "home", label: "Home only", test: (g) => g.home === true },
  { id: "last3", label: "Last 3 games", test: null, tail: 3 },
  { id: "vsOpp", label: "vs. this defense", test: (g, r) => g.opp && r.opp && g.opp === r.opp },
];

// How many samples a game card shows before handing off to the feed. The
// board's job is deciding *which* props are worth opening, and a card that
// lists forty rows has gone back to being the feed with headings on it.
const CARD_ROWS = 3;

// The verdict pill's thresholds, from the handoff: 65%+ leans to a side,
// below 45% leans to the other, 45-65% is a coin flip, and under the minimum
// sample there is no rate to lean on at all.
const LEAN_HI = 0.65;
const LEAN_LO = 0.45;

// The pill states which side the games actually favour, which is not the same
// as the row's own direction. `rateFor` counts hits *for the side the row is
// priced on*, so a row priced under with a 0.70 rate means 70% of games went
// under -- "leans under", not "leans over". Reading the rate without the
// direction inverts the verdict on every under row, and it would do it
// quietly: the number would look right and the words would be backwards.
// Exported for verification: today's slate happens to price every board row
// as an over, so the under branch cannot be exercised from the rendered page.
export function verdictFor(rate, n, minGames, direction) {
  if (rate == null || n < minGames) return { label: "Too few", thin: true };
  const priced = direction === "under" ? "under" : "over";
  const other = priced === "under" ? "over" : "under";
  if (rate >= LEAN_HI) return { label: `Leans ${priced}` };
  if (rate < LEAN_LO) return { label: `Leans ${other}` };
  return { label: "Coin flip" };
}

// Lineup state for a game card, derived from the rows it holds rather than
// stored twice. Confirmed / projected / unknown is a *confidence* signal --
// how settled the slate is -- not a good-or-bad one, so it uses no outcome
// colour at any hue. It renders in --text-2 and lets fill carry the split,
// the same device the game-state family uses:
//
//   filled  = posted        every row we can read is in a posted lineup
//   hollow  = projected     the lineup is still our projection
//   absent  = unknown       nothing to read
//
// Unknown rendering no dot is CLAUDE.md's rule for availability and the
// honest answer here too: `lineupConfirmed` is MLB batters only, so on the
// other three sports there is genuinely nothing published to report, and a
// grey "unknown" dot would be claiming to have looked.
function lineupStateFor(rows) {
  const known = (rows || []).filter((r) => typeof r.lineupConfirmed === "boolean");
  if (!known.length) return null;
  return known.every((r) => r.lineupConfirmed) ? "posted" : "projected";
}

// Kickoff as minutes past midnight, for the rail's "first kickoff" sort.
// A game whose time we don't have sorts *last* rather than first: an unknown
// time is not an early one, and putting it at the top would state a running
// order the data never gave us.
function kickoffKey(t) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(String(t || "").trim());
  if (!m) return Number.POSITIVE_INFINITY;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3] || "")) h += 12;
  return h * 60 + parseInt(m[2], 10);
}

// The sorts the rail offers. "Strongest sample" ranks a game by the best
// quotable rate on it -- quotable meaning it clears the minimum sample, so a
// 100%-of-3 cannot push a game to the top of a board whose whole argument is
// that three games say nothing.
const SORTS = [
  { id: "props", label: "Most props" },
  { id: "kickoff", label: "First kickoff" },
  { id: "strongest", label: "Strongest sample" },
];

const LINEUP_FILTERS = [
  { id: "all", label: "All games" },
  { id: "posted", label: "Lineups posted" },
  { id: "projected", label: "Projected only" },
];

// Rate and sample from one pass over the same games, so the two can never
// disagree. Returns null when the split leaves nothing at all -- distinct
// from leaving too little, which is a rate the caller suppresses.
function rateFor(row, activeSplits) {
  let games = row.recent || [];
  if (!games.length) return null;
  activeSplits.forEach((id) => {
    const s = SPLITS.find((x) => x.id === id);
    if (!s) return;
    if (s.tail) games = games.slice(-s.tail);
    if (s.test) games = games.filter((g) => s.test(g, row));
  });
  if (!games.length) return { games: [], n: 0, over: 0, rate: null };
  const under = row.direction === "under";
  const over = games.filter((g) => (under ? g.v < row.line : g.v > row.line)).length;
  return { games, n: games.length, over, rate: over / games.length };
}

// `loading` is a separate claim from an empty board. MLB's rows arrive over the
// network (see useMlbFeedData), so an empty array there means "not back yet",
// while for the synchronous leagues it means the builders really found nothing.
// Reading the difference off rows.length alone is what makes a slow fetch look
// like an empty slate.
export default function BoardPage({ rows = [], groups = [], sport, sports = [], onSetSport, onOpenProp, onOpenGameProps, marketGroups = [], disclaimer, loading = false, slateByTeam = null, timeLabel = null }) {
  const [selectedMarkets, setSelectedMarkets] = useState([]);
  const [minGames, setMinGames] = useState(10);
  const [samplePresets, setSamplePresets] = useState(loadSamplePresets);
  const [activeSplits, setActiveSplits] = useState(["season"]);
  const [visibleGames, setVisibleGames] = useState(10);
  // Slate work, which is what the rail is for: which games, in what order.
  const [sortBy, setSortBy] = useState("props");
  const [lineupFilter, setLineupFilter] = useState("all");

  const updateSamplePresets = React.useCallback((next) => {
    setSamplePresets(next);
    saveSamplePresets(next);
  }, []);

  const filtered = useMemo(
    () => (selectedMarkets.length ? rows.filter((r) => selectedMarkets.includes(r.marketId)) : rows),
    [rows, selectedMarkets]
  );

  // Grouped under the game each prop belongs to -- the board's whole reason to
  // exist as a separate surface from the flat feed.
  const grouped = useMemo(() => {
    const byGame = new Map();
    filtered.forEach((r) => {
      // gameId before the team-opp fallback, because that fallback is
      // *directional*: the same fixture reaches this loop once as TB-BAL and
      // once as BAL-TB, and the board drew both -- two cards for one game, a
      // slate of 15 counted as 30, each card holding half the props and each
      // claiming to be the whole matchup. Only the builders that know which
      // side is home can settle that, so a row that carries a canonical game
      // id gets grouped by it. The fallback stays for the builders that have
      // no fixture behind them at all (see the NFL/NBA rows, whose "games"
      // are last-opponent pairings rather than a real slate).
      const key = r.gameKey || r.gameId || `${r.team}-${r.opp}`;
      if (!byGame.has(key)) byGame.set(key, { key, label: r.gameLabelFull || `${r.team} vs ${r.opp}`, time: r.gameTime || "", rows: [] });
      byGame.get(key).rows.push(r);
    });
    return [...byGame.values()].map((g) => {
      // Strongest first inside a game: the board is for finding the few
      // worth opening, so the order has to be the answer to that question.
      const rows = g.rows.slice().sort((a, b) => (b.l10 ?? -1) - (a.l10 ?? -1));
      // The card's own headline number, computed through the same rateFor
      // the rows render from -- so the sort agrees with what the card shows
      // rather than ranking on a second, quietly different figure. Only
      // samples that clear the minimum count toward it.
      let strongest = -1;
      rows.forEach((r) => {
        const s = rateFor(r, activeSplits);
        if (s && s.rate != null && s.n >= minGames) strongest = Math.max(strongest, s.rate);
      });
      // The slate row for this game -- and only if it is genuinely the same
      // fixture. Looking a team up finds *a* game it plays, which is not the
      // same thing: the NFL board's rows describe 2025 matchups (that season
      // is final, so the builders use the last opponent played) while the
      // slate holds 2026 week 1. Joining on one team alone hung TB's record
      // and Cincinnati's stadium on a card headed CIN vs CLE. Both sides must
      // match, or there is no join and the card says nothing about records,
      // kickoff or venue rather than saying something untrue.
      const teamA = rows[0]?.team;
      const teamB = rows[0]?.opp;
      const candidate = slateByTeam ? (slateByTeam.get(teamA) || slateByTeam.get(teamB) || null) : null;
      const sides = candidate ? [candidate.away?.abbr, candidate.home?.abbr] : [];
      const slate = candidate && teamA && teamB && sides.includes(teamA) && sides.includes(teamB) ? candidate : null;
      const kickoffMs = slate?.startsAt ? Date.parse(slate.startsAt) : NaN;
      return {
        ...g, rows, strongest, lineup: lineupStateFor(rows), slate,
        kickoff: Number.isFinite(kickoffMs) ? kickoffMs : kickoffKey(g.time),
      };
    });
  }, [filtered, activeSplits, minGames, slateByTeam]);

  // How many games we actually have a kickoff time for. Drives whether the
  // kickoff sort is offered at all, and guards against it silently degrading
  // to insertion order.
  const kickoffKnown = useMemo(
    () => grouped.filter((g) => Number.isFinite(g.kickoff) && g.kickoff !== Number.POSITIVE_INFINITY).length,
    [grouped]
  );

  // Filter, then sort. Both are rail state, so both name themselves in the
  // empty state below when they are the reason nothing is showing.
  const visible = useMemo(() => {
    const kept = lineupFilter === "all"
      ? grouped
      : grouped.filter((g) => g.lineup === lineupFilter);
    const out = kept.slice();
    // Falls through to the props sort when no kickoff is known, so the list
    // is never ordered by a value nothing has.
    if (sortBy === "kickoff" && kickoffKnown > 0) out.sort((a, b) => a.kickoff - b.kickoff);
    else if (sortBy === "strongest") out.sort((a, b) => b.strongest - a.strongest);
    else out.sort((a, b) => b.rows.length - a.rows.length);
    return out;
  }, [grouped, lineupFilter, sortBy, kickoffKnown]);

  const shown = visible.slice(0, visibleGames);
  const propCount = visible.reduce((t, g) => t + g.rows.length, 0);

  const toggleSplit = (id) => {
    setActiveSplits((prev) => {
      if (id === "season") return ["season"];
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.filter((x) => x !== "season"), id];
      return next.length ? next : ["season"];
    });
  };


  const v2RightRail = (
    <div>
      <div className="pp-mono" style={{ ...LABEL, fontSize: 10.5, letterSpacing: "0.14em" }}>Reading a card</div>
      <div style={{ margin: "12px 0 20px", display: "grid", gap: 9 }}>
        {[
          { mark: <span style={{ width: 8, height: 17, background: "var(--pos-solid, var(--pos))", borderRadius: 2, flex: "0 0 auto" }} />, text: "cleared the line" },
          { mark: <span style={{ width: 8, height: 17, border: "1.5px solid var(--neg)", borderRadius: 2, boxSizing: "border-box", flex: "0 0 auto" }} />, text: "fell short" },
          { mark: <span style={{ width: 16, borderTop: "1.5px dashed var(--text)", flex: "0 0 auto" }} />, text: "the line" },
        ].map((it, i) => (
          <span key={i} className="pp-mono" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-2, var(--dim))" }}>
            {it.mark}{it.text}
          </span>
        ))}
      </div>

      <div className="pp-mono" style={{ ...LABEL, fontSize: 10.5, letterSpacing: "0.14em" }}>Lineups</div>
      <div style={{ margin: "12px 0 20px", display: "grid", gap: 9 }}>
        {[
          { mark: <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-2, var(--dim))", border: "1.5px solid var(--text-2, var(--dim))", boxSizing: "border-box", flex: "0 0 auto" }} />, text: "posted" },
          { mark: <span style={{ width: 8, height: 8, borderRadius: "50%", background: "transparent", border: "1.5px solid var(--text-2, var(--dim))", boxSizing: "border-box", flex: "0 0 auto" }} />, text: "projected" },
          { mark: <span style={{ width: 8, flex: "0 0 auto" }} />, text: "no dot \u00b7 unknown" },
        ].map((it, i) => (
          <span key={i} className="pp-mono" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-2, var(--dim))" }}>
            {it.mark}{it.text}
          </span>
        ))}
        <span style={{ fontSize: 11.5, color: "var(--dim)", lineHeight: 1.5 }}>
          Unknown is never assumed to be available.
        </span>
      </div>

      <div className="pp-mono" style={{ ...LABEL, fontSize: 10.5, letterSpacing: "0.14em" }}>Verdicts</div>
      <div style={{ margin: "12px 0 0", display: "grid", gap: 7, fontSize: 11.5, color: "var(--text-2, var(--dim))", lineHeight: 1.5 }}>
        <span><b style={{ color: "var(--amber-ink, var(--amber))" }}>Leans over/under</b> &mdash; {Math.round(LEAN_HI * 100)}%+ on {minGames} or more games, or below {Math.round(LEAN_LO * 100)}% the other way.</span>
        <span><b style={{ color: "var(--amber-ink, var(--amber))" }}>Coin flip</b> &mdash; inside {Math.round(LEAN_LO * 100)}&ndash;{Math.round(LEAN_HI * 100)}%.</span>
        <span><b style={{ color: "var(--amber-ink, var(--amber))" }}>Too few</b> &mdash; under {minGames} games, no rate stated.</span>
      </div>
    </div>
  );

  // The mock's four-cell strip under the title.
  const v2Posted = visible.filter((g) => g.lineup === "posted").length;
  const v2FirstKick = (() => {
    // Earliest by the same kickoff key the rail already sorts on, then that
    // game's own printed time -- no second time formatter in the file, and an
    // em dash when the slate carries no start rather than a made-up one.
    const withKick = visible.filter((g) => Number.isFinite(g.kickoff));
    if (!withKick.length) return "\u2014";
    const first = withKick.reduce((a, b) => (a.kickoff <= b.kickoff ? a : b));
    return first.time || "\u2014";
  })();

  const v2SummaryStrip = (
    <div style={{
      display: "flex", alignItems: "center", gap: 0, marginTop: 14,
      background: "var(--surface-sunken)", border: "1px solid var(--line)",
      borderRadius: 6, overflow: "hidden",
    }}>
      <div style={{ flex: 1, minWidth: 0, padding: "11px 16px" }}>
        <div style={BOARD_CELL_LABEL}>Games</div>
        <div style={BOARD_CELL_VALUE}>{visible.length}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: "11px 16px", borderLeft: "1px solid var(--line)" }}>
        <div style={BOARD_CELL_LABEL}>Props</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 6 }}>
          <span className="pp-mono" style={{ fontSize: 15, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{propCount.toLocaleString()}</span>
          <span className="pp-mono" style={{ fontSize: 9.5, color: "var(--dim)", whiteSpace: "nowrap" }}>on this slate</span>
        </div>
      </div>
      <div style={{ flex: 1.2, minWidth: 0, padding: "11px 16px", borderLeft: "1px solid var(--line)" }}>
        <div style={BOARD_CELL_LABEL}>Lineups posted</div>
        {/* Lineup state is published for MLB batters and nothing else, so on
            the other three leagues this is 0 of N rather than a blank -- the
            zero is the real answer, not a missing one. */}
        <div style={BOARD_CELL_VALUE}>{v2Posted} of {visible.length}</div>
      </div>
      <div style={{ flex: 1.4, minWidth: 0, padding: "11px 16px", borderLeft: "1px solid var(--line)" }}>
        <div style={BOARD_CELL_LABEL}>First {sport === "nfl" ? "kickoff" : "start"}</div>
        <div style={BOARD_CELL_VALUE}>{v2FirstKick}</div>
      </div>
    </div>
  );

  return (
    <div className="page-shell" style={{ maxWidth: 1600, margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginBottom: 4 }}>
        <div>
          <h1 className="pp-display" style={{ fontSize: 34, margin: 0, letterSpacing: "-0.02em", fontWeight: 600 }}>The Board</h1>
          <div className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)", marginTop: 7 }}>
            Research by matchup &middot; <span style={{ color: "var(--amber-ink, var(--amber))" }}>Games</span> has scores and live state
          </div>
        </div>
        {/* The date. The mock steps through days with ‹ ›; this slate is
            always today's -- fetchMlbSlate and the rest take no date -- so the
            label states which day it is and the arrows are not drawn rather
            than drawn dead. */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface-1)", padding: "8px 14px" }}>
          <span className="pp-mono" style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text)", whiteSpace: "nowrap" }}>
            {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </div>
      </div>

      <div className="board-layout" style={{ display: "grid", gridTemplateColumns: "196px minmax(0, 1fr) 196px", gap: 20, alignItems: "start", paddingTop: 20 }}>
        {/* ---- Filter rail ---- */}
        <div>
          {/* League leads the rail, which is where the mock puts it -- it was
              a row of pills up beside the title. */}
          <div className="pp-mono" style={{ ...LABEL, fontSize: 10.5, letterSpacing: "0.14em" }}>League</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "12px 0 22px" }}>
            {sports.map((sp) => {
              const on = sport === sp.id;
              return (
                <div
                  key={sp.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => sp.available && onSetSport && onSetSport(sp.id)}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && sp.available) { e.preventDefault(); onSetSport(sp.id); } }}
                  title={sp.available ? (sp.simulated ? "Generated sample data, not a live feed" : undefined) : "Coming soon"}
                  style={{
                    display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
                    padding: "9px 11px", borderRadius: 6,
                    cursor: sp.available ? "pointer" : "not-allowed",
                    background: on ? "var(--amber-dim)" : "transparent",
                    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                    opacity: sp.available ? 1 : 0.5,
                  }}
                >
                  <span className="pp-mono" style={{ fontSize: 11.5, letterSpacing: "0.1em", color: on ? "var(--amber-ink, var(--amber))" : "var(--text-2, var(--dim))" }}>{sp.label}</span>
                  {on && <span className="pp-mono" style={{ fontSize: 10, color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>{visible.length}</span>}
                </div>
              );
            })}
          </div>


          {/* Slate work: which games, in what order. The market chips
              below narrow what is *on* a card; these two decide which cards
              there are at all, which is the rail's job on this screen. */}
          <div className="pp-mono" style={{ ...LABEL, fontSize: 10.5, letterSpacing: "0.14em" }}>Sort games by</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 18px" }}>
            {SORTS.map((s) => {
              const on = sortBy === s.id;
              // A sort with nothing to sort on says so instead of returning
              // an arbitrary order that looks sorted. Kickoff times are not
              // on the feed rows the board is built from today, so on those
              // leagues this control would silently fall back to whatever
              // order the games were grouped in -- which reads exactly like
              // a working sort and is the more dangerous failure.
              const usable = s.id !== "kickoff" || kickoffKnown > 0;
              return (
                <span
                  key={s.id}
                  role={usable ? "button" : undefined}
                  tabIndex={usable ? 0 : undefined}
                  aria-pressed={usable ? on : undefined}
                  aria-disabled={usable ? undefined : true}
                  title={usable ? undefined : "No kickoff times on this league's props yet"}
                  onClick={usable ? () => setSortBy(s.id) : undefined}
                  onKeyDown={usable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSortBy(s.id); } } : undefined}
                  className="pp-mono"
                  style={{
                    cursor: usable ? "pointer" : "not-allowed",
                    fontSize: 11, letterSpacing: "0.05em",
                    borderRadius: 4, padding: "5px 9px",
                    background: on && usable ? "var(--amber)" : "transparent",
                    color: !usable ? "var(--dim)" : on ? "var(--accent-on)" : "var(--text-2, var(--dim))",
                    border: `1px solid ${on && usable ? "var(--amber)" : "var(--line)"}`,
                    opacity: usable ? 1 : 0.55,
                  }}
                >
                  {s.label}{s.id === "kickoff" && !usable ? " · no times" : ""}
                </span>
              );
            })}
          </div>

          <div className="pp-mono" style={{ ...LABEL, fontSize: 10.5, letterSpacing: "0.14em" }}>Show</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 18px" }}>
            {LINEUP_FILTERS.map((f) => {
              const on = lineupFilter === f.id;
              // Count what each option would actually yield, so nobody picks
              // a filter that empties the board without warning -- and so a
              // league that publishes no lineups reads as "0" rather than
              // looking like a control that silently does nothing.
              const yield_ = f.id === "all" ? grouped.length : grouped.filter((g) => g.lineup === f.id).length;
              return (
                <span
                  key={f.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={on}
                  onClick={() => setLineupFilter(f.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLineupFilter(f.id); } }}
                  className="pp-mono"
                  style={{
                    cursor: "pointer", fontSize: 11, letterSpacing: "0.05em",
                    borderRadius: 4, padding: "5px 9px",
                    background: on ? "var(--amber)" : "transparent",
                    color: on ? "var(--accent-on)" : "var(--text-2, var(--dim))",
                    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                  }}
                >
                  {f.label} · {yield_}
                </span>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span className="pp-mono" style={{ ...LABEL, fontSize: 10.5, letterSpacing: "0.14em" }}>Market</span>
            <span
              role="button"
              tabIndex={0}
              onClick={() => setSelectedMarkets([])}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedMarkets([]); } }}
              className="pp-mono"
              style={{ cursor: "pointer", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber-ink, var(--amber))" }}
            >
              Clear
            </span>
          </div>
          {/* Driven from PROP_GROUPS, not hard-coded markup -- the market list
              is expected to grow, and switching sport re-groups it for free. */}
          <div style={{ maxHeight: 296, overflowY: "auto", marginTop: 10 }}>
            {marketGroups.map((g) => (
              <div key={g.label} style={{ marginBottom: 12 }}>
                <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 7 }}>
                  {g.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {g.markets.map((m) => {
                    const on = selectedMarkets.includes(m.id);
                    return (
                      <span
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={on}
                        onClick={() => setSelectedMarkets(on ? selectedMarkets.filter((x) => x !== m.id) : [...selectedMarkets, m.id])}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedMarkets(on ? selectedMarkets.filter((x) => x !== m.id) : [...selectedMarkets, m.id]); } }}
                        className="pp-mono"
                        style={{
                          cursor: "pointer", fontSize: 11, letterSpacing: "0.05em",
                          borderRadius: 4, padding: "5px 9px",
                          background: on ? "var(--amber)" : "transparent",
                          color: on ? "var(--accent-on)" : "var(--text-2, var(--dim))",
                          border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                        }}
                      >
                        {m.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 16 }}>
            <MinSampleControl
              value={minGames}
              onChange={setMinGames}
              presets={samplePresets}
              onSetPresets={updateSamplePresets}
              compact
            />
          </div>

          <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 16 }}>
            <div className="pp-mono" style={{ ...LABEL, fontSize: 10.5, letterSpacing: "0.14em", marginBottom: 10 }}>Split</div>
            {SPLITS.map((s) => {
              const on = activeSplits.includes(s.id);
              return (
                <div
                  key={s.id}
                  role="checkbox"
                  aria-checked={on}
                  tabIndex={0}
                  onClick={() => toggleSplit(s.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSplit(s.id); } }}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0", fontSize: 14, color: "var(--text-2, var(--dim))" }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: 3, flexShrink: 0, boxSizing: "border-box",
                    background: on ? "var(--amber)" : "transparent",
                    border: on ? "1px solid var(--amber)" : "1px solid var(--line)",
                  }} />
                  {s.label}
                </div>
              );
            })}
          </div>

          {disclaimer && (
            <div className="pp-mono" style={{
              marginTop: 16, padding: 12, borderRadius: 4,
              background: "var(--surface-sunken)", border: "1px solid var(--line)",
              fontSize: 10.5, lineHeight: 1.5, color: "var(--dim)",
            }}>
              {disclaimer}
            </div>
          )}
        </div>

        {/* ---- Centre column ---- */}
        <div style={{ minWidth: 0 }}>
          {v2SummaryStrip}
          <div style={{ height: 16 }} />
          <div className="board-grid" style={{
            display: "grid", gridTemplateColumns: GRID, gap: 16, padding: "14px 20px",
            background: "var(--surface-sunken)", border: "1px solid var(--line)",
            borderBottom: "none", borderRadius: "6px 6px 0 0",
          }}>
            <span className="pp-mono" style={LABEL}>Player</span>
            <span className="pp-mono" style={LABEL}>Prop</span>
            <span className="pp-mono" style={LABEL}>Hit rate · sample</span>
            <span className="pp-mono" style={LABEL}>Last 8 vs. line</span>
            <span className="pp-mono" style={{ ...LABEL, textAlign: "right" }}>Verdict</span>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "0 0 6px 6px" }}>
            {shown.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", color: "var(--dim)", fontSize: 14, lineHeight: 1.6 }}>
                {/* An empty state names the control responsible for it. The
                    lineup filter is checked before the market chips because
                    it can empty the board on three of the four sports --
                    lineupConfirmed is MLB batters only -- and "no props
                    match your markets" would be the wrong thing to fix. */}
                {loading
                  ? "Loading today’s slate…"
                  : rows.length === 0
                  ? "No props have loaded for this league yet."
                  : lineupFilter !== "all" && grouped.length > 0
                    ? `No games on this slate have ${lineupFilter === "posted" ? "posted lineups" : "projected-only lineups"}. Lineup state is published for MLB batters; the other leagues report none, so this filter finds nothing there. Set Show back to All games.`
                    : selectedMarkets.length
                      ? "No props match the markets selected in the rail. Clear them to see the rest of the slate."
                      : "No props to show."}
              </div>
            ) : shown.map((g) => (
              <div key={g.key}>
                <div style={{
                  display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap",
                  padding: "12px 20px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)",
                }}>
                  <span className="pp-mono" style={{ fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>{g.label}</span>
                  {/* Records, kickoff and venue come from the slate row this
                      card joined to. Each is rendered only where the provider
                      actually supplied it -- a game with no venue simply has
                      no venue, rather than an empty slot. */}
                  {g.slate?.away?.record && g.slate?.home?.record && (
                    <span className="pp-mono" style={{ fontSize: 11.5, color: "var(--dim)", whiteSpace: "nowrap" }}>
                      {g.slate.away.abbr} {g.slate.away.record} · {g.slate.home.abbr} {g.slate.home.record}
                    </span>
                  )}
                  {g.slate?.startsAt && timeLabel && (
                    <span className="pp-mono" style={{ fontSize: 11.5, color: "var(--text-2, var(--dim))", whiteSpace: "nowrap" }}>
                      {timeLabel(g.slate.startsAt)}
                    </span>
                  )}
                  {g.slate?.venue?.name && (
                    <span className="pp-mono" style={{ fontSize: 11.5, color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                      {g.slate.venue.name}{g.slate.venue.indoor ? " · indoors" : ""}
                    </span>
                  )}
                  {/* The row's own kickoff label, and only when the slate join
                      didn't already supply one -- both were printing, so an
                      MLB card read "2:10 PM ... 2:10 PM". The slate's time is
                      preferred because it is the one that keeps updating. */}
                  {g.time && !(g.slate?.startsAt && timeLabel) && (
                    <span className="pp-mono" style={{ fontSize: 11.5, color: "var(--text-2, var(--dim))" }}>{g.time}</span>
                  )}
                  {/* The count is what the card knows about this game; the
                      action is a move to the feed. Deliberately not phrased
                      "All 148 props ->" the way the mock draws it: the feed
                      does not open filtered to one game (see goToGameProps in
                      PropLedger, which documents why), so that label would
                      promise a narrowing that does not happen. */}
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                    {(() => {
                      const lineup = lineupStateFor(g.rows);
                      if (!lineup) return null;
                      return (
                        <span
                          className="pp-mono"
                          title={lineup === "posted"
                            ? "Every prop on this card is from a posted lineup"
                            : "Lineups not posted yet — these are projections"}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            fontSize: 11.5, letterSpacing: "0.06em",
                            textTransform: "uppercase", color: "var(--text-2, var(--dim))",
                          }}
                        >
                          <span style={{
                            width: 8, height: 8, borderRadius: "50%", boxSizing: "border-box",
                            background: lineup === "posted" ? "var(--text-2, var(--dim))" : "transparent",
                            border: "1.5px solid var(--text-2, var(--dim))",
                          }} />
                          {lineup === "posted" ? "Lineup posted" : "Projected"}
                        </span>
                      );
                    })()}
                    <span className="pp-mono" style={{ fontSize: 11.5, color: "var(--text-2, var(--dim))" }}>
                      {g.rows.length} {g.rows.length === 1 ? "prop" : "props"}
                    </span>
                    {onOpenGameProps && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onOpenGameProps(g); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onOpenGameProps(g); } }}
                        className="pp-mono"
                        style={{
                          cursor: "pointer", fontSize: 11.5, letterSpacing: "0.08em",
                          textTransform: "uppercase", color: "var(--amber-ink, var(--amber))",
                        }}
                      >
                        Open in feed →
                      </span>
                    )}
                  </span>
                </div>
                {g.rows.slice(0, CARD_ROWS).map((r, i, arr) => (
                  <BoardRow
                    key={r.key}
                    row={r}
                    minGames={minGames}
                    activeSplits={activeSplits}
                    isLast={i === arr.length - 1 && g.rows.length <= CARD_ROWS}
                    onOpen={onOpenProp}
                  />
                ))}
                {/* The rest are not hidden, they are located. A card that
                    silently stopped at three would be dropping rows; saying
                    how many are left and where they live is the same rule
                    the thin-sample verdict follows. */}
                {g.rows.length > CARD_ROWS && (
                  <div
                    className="pp-mono"
                    style={{
                      padding: "10px 20px", borderBottom: "1px solid var(--line)",
                      fontSize: 11.5, color: "var(--dim)", letterSpacing: "0.06em",
                    }}
                  >
                    Three strongest shown · {g.rows.length - CARD_ROWS} more in the feed
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
            {visible.length > shown.length && (
              <span
                role="button"
                tabIndex={0}
                onClick={() => setVisibleGames((v) => v + 10)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setVisibleGames((v) => v + 10); } }}
                className="pp-mono"
                style={{
                  cursor: "pointer", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
                  color: "var(--amber-ink, var(--amber))", border: "1px solid var(--amber)",
                  borderRadius: 4, padding: "10px 16px",
                }}
              >
                Show {Math.min(10, visible.length - shown.length)} more games
              </span>
            )}
          </div>
        </div>
        {v2RightRail}
      </div>
    </div>
  );
}

function BoardRow({ row, minGames, activeSplits, isLast, onOpen }) {
  const split = rateFor(row, activeSplits);
  const n = split ? split.n : 0;
  const rate = split ? split.rate : null;
  // The rule the README singles out as critical: a split recomputes the rate
  // and its stated sample together, so a split that drops the sample below the
  // minimum flips the row to TOO FEW rather than showing a percentage over
  // three games.
  const thin = rate == null || n < minGames;
  const open = row.playerId && onOpen ? () => onOpen(row.sport, row.playerId, row.marketId, { name: row.name, team: row.team }) : null;

  // Verdicts ride the accent, never green or red: green and red mean cleared
  // and fell short on the bars in this same row, and a green verdict pill
  // would overload the colour two inches from where it means something else.
  //
  // Thresholds are the handoff's 65/45, not the 60/40 this shipped with, and
  // the side comes from `row.direction` rather than being assumed to be over
  // -- see verdictFor. An under-priced row with a strong rate was reading
  // "Leans over", which is the exact opposite of what its own games say.
  const v = verdictFor(rate, n, minGames, row.direction);
  const verdict = v.label;
  const verdictLeans = !v.thin && v.label !== "Coin flip";

  const bars = (split && split.games.length ? split.games : row.recent || []).slice(-8);

  return (
    <div
      className="board-grid feed-row"
      role={open ? "button" : undefined}
      tabIndex={open ? 0 : undefined}
      onClick={open || undefined}
      onKeyDown={open ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } : undefined}
      style={{
        display: "grid", gridTemplateColumns: GRID, gap: 16, alignItems: "center",
        padding: "14px 20px", cursor: open ? "pointer" : "default",
        borderBottom: isLast ? "none" : "1px solid var(--line)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <PlayerAvatar
          name={row.name}
          alt={row.name}
          sport={row.sport}
          team={row.team}
          headshotSrc={row.avatar}
          fallbackSrc={row.avatarFallback}
          status={row.status}
          size={38}
          inset={2}
          surface="var(--panel)"
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</div>
          <div className="pp-mono" style={{ fontSize: 11.5, color: "var(--text-2, var(--dim))", marginTop: 2 }}>
            {row.team}{row.pos ? ` · ${row.pos}` : ""}
          </div>
        </div>
      </div>

      <div className="pp-mono" style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text)" }}>
        {row.subtitle}
      </div>

      <div>
        {thin ? (
          <>
            <div className="pp-mono" style={{ fontSize: 14, color: "var(--text)" }}>Too few</div>
            <div className="pp-mono" style={{ fontSize: 11.5, color: "var(--text-2, var(--dim))", marginTop: 3 }}>{n} {n === 1 ? "game" : "games"}</div>
          </>
        ) : (
          <>
            <div className="pp-mono" style={{ fontSize: 22, color: "var(--amber-ink, var(--amber))" }}>{Math.round(rate * 100)}%</div>
            <div className="pp-mono" style={{ fontSize: 11.5, color: "var(--text-2, var(--dim))", marginTop: 3 }}>{split.over} of {n} games</div>
          </>
        )}
      </div>

      {/* The compact treatment: no tag, no caption. Holding a short sample's
          unused columns open used to be done here, with an outer flex spacer
          counting to eight; the graph owns its own fixed grid now, so doing
          it out here as well would reserve the gap twice and squeeze the bars
          into the left third of the card. */}
      <div style={{ minWidth: 0 }}>
        {bars.length > 0 ? (
          /* Eight slots, matching the slice above rather than taking the
             ten-slot default. The empty columns say "no games yet", and on a
             card that deliberately shows the last eight of a longer log that
             would be untrue -- those games exist, this card just isn't the
             surface for them. The grid has to describe the window the card
             actually draws. */
          <FeedFormStrip
            size="board"
            slots={8}
            r={{ recent: bars, line: row.line, isBinary: !!row.isBinary, subtitle: row.subtitle }}
            direction={row.direction || "over"}
            streak={null}
            caption={false}
          />
        ) : (
          <span className="pp-mono" style={{ fontSize: 11.5, color: "var(--dim)" }}>no games logged</span>
        )}
      </div>

      <div style={{ textAlign: "right" }}>
        <span className="pp-mono" style={{
          display: "inline-block", borderRadius: 999, padding: "5px 10px",
          fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em",
          color: verdictLeans ? "var(--amber-ink, var(--amber))" : "var(--text-2, var(--dim))",
          border: `1px solid ${verdictLeans ? "var(--amber)" : "var(--line)"}`,
        }}>
          {verdict}
        </span>
      </div>
    </div>
  );
}
