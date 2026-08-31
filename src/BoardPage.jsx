import React, { useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import FeedFormStrip from "./FormGraph.jsx";
import MinSampleControl, { loadSamplePresets, saveSamplePresets, seedSampleValue, saveSampleValue, sampleScale, MIN_SAMPLE_ALL } from "./MinSampleControl.jsx";
import { wilsonLower, supportBand, SUPPORT_BANDS } from "./lib/support.js";
import TeamLogo from "./TeamLogo.jsx";
import { teamInfo } from "./lib/gamesData.js";
import { matchupTones as boardTones } from "./lib/teamColors.js";
import BoardMobile from "./v3/BoardMobile.jsx";
import BoardDesktop from "./v3/BoardDesktop.jsx";

// The three bands `PropPalace Board v4 part 2.dc.html` names, with its own
// subtitles. A tier is a count of the reasons on the card -- nothing is
// weighted, and no tier is a prediction.
// League sizes, for the "soft matchup" cut. feedTeamCount lives in
// PropLedger.jsx and is not exported; these are the same four numbers and
// they change on a relocation, not on a transaction.
const BOARD_TEAM_COUNT = { nfl: 32, mlb: 30, nba: 30, wnba: 15 };

const TIER_TITLES = [
  { title: "Worth ten minutes", sub: "three or more counted reasons", tone: "var(--pos)" },
  { title: "One thing each", sub: "a single reason, named on the card", tone: "var(--amber-ink)" },
  { title: "Quiet", sub: "nothing cleared a bar — shown so the slate is complete", tone: "var(--dim)" },
];

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
const BOARD_CELL_LABEL = { fontFamily: "'PP At', 'Space Mono', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--dim)", whiteSpace: "nowrap" };
const BOARD_CELL_VALUE = { fontFamily: "'PP At', 'Space Mono', monospace", fontSize: 15, marginTop: 6, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

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

// The players this game has no props for, named. Competitive brief item 8
// (mock 3g), and the other half of the "three strongest shown" line further
// down the card: that one accounts for rows that exist and are not shown,
// this one accounts for players no row was ever built for.
//
// CLAUDE.md rule 4 says nothing is ever silently dropped. A card listing three
// props off a forty-man roster obeyed the letter of that -- every row it has,
// it shows -- while leaving no way to tell a team with four props from a team
// with four props and thirty-six players whose logs we could not read.
//
// The reason is the whole point. "No game log" is a fact about our data, and
// stating it is a different claim from implying the player is not playing.
function WithoutProps({ sport, teams, lookup }) {
  const [open, setOpen] = React.useState(false);
  const teamKey = (teams || []).join(",");
  const missing = React.useMemo(() => {
    if (typeof lookup !== "function") return [];
    return (teams || []).flatMap((t) => lookup(sport, t).map((m) => ({ ...m, team: t })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup, sport, teamKey]);

  if (!missing.length) return null;

  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <div
        role="button" tabIndex={0} aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); } }}
        className="pp-mono"
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 20px",
          fontSize: 11, letterSpacing: "0.06em", color: "var(--amber-ink, var(--amber))",
          cursor: "pointer", minHeight: "var(--tap, 44px)", boxSizing: "border-box",
        }}
      >
        <span style={{ width: 12 }}>{open ? "\u2212" : "+"}</span>
        <span>
          {open
            ? "Hide the " + missing.length + " without props"
            : "+" + missing.length + " player" + (missing.length === 1 ? "" : "s") + " without props \u00b7 Show"}
        </span>
      </div>
      {open && (
        <div style={{ padding: "0 20px 14px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {missing.map((m) => (
              <span
                key={m.team + "-" + m.name}
                className="pp-mono"
                style={{
                  fontSize: 10, letterSpacing: "0.04em", color: "var(--text-2, var(--dim))",
                  border: "1px solid var(--line)", borderRadius: 4, padding: "6px 9px", whiteSpace: "nowrap",
                }}
              >
                {m.name}
                <span style={{ color: "var(--dim)" }}>{" \u00b7 " + m.team + " \u00b7 " + m.reason}</span>
              </span>
            ))}
          </div>
          {/* The last sentence is the load-bearing one. A list of absent names
              on a betting-adjacent screen reads as an injury report unless it
              says otherwise, and not one of these is an availability call. */}
          <div className="pp-mono" style={{ fontSize: 9.5, color: "var(--dim)", marginTop: 11, lineHeight: 1.65 }}>
            Listed with the reason, so an absent player is a stated fact rather than a gap.
            None of these are assumed unavailable.
          </div>
        </div>
      )}
    </div>
  );
}

// The verdict pill states which side the games actually favour, which is not
// the same as the row's own direction. `rateFor` counts hits *for the side the
// row is priced on*, so a row priced under with a 0.70 rate means 70% of games
// went under -- "leans under", not "leans over". Reading the rate without the
// direction inverts the verdict on every under row, and it would do it
// quietly: the number would look right and the words would be backwards.
//
// The strength of the words comes from lib/support.js, not from the rate: how
// far the sample can be shown to hold, rather than how big the percentage is.
// The handoff's flat 65/45 thresholds gave 13-of-20 and 9-of-10 the same
// sentence, and the first of those establishes nothing at all.
//
// Exported for verification: today's slate happens to price every board row
// as an over, so the under branch cannot be exercised from the rendered page.
export function verdictFor(rate, n, minGames, direction) {
  if (rate == null || n < minGames) return { label: "Too few", thin: true };
  const priced = direction === "under" ? "under" : "over";
  const other = priced === "under" ? "over" : "under";
  const hits = Math.round(rate * n);

  // Both sides are tested, not just the priced one. A row priced over that
  // went under 80% of the time is a real read -- about the other side.
  const loPriced = wilsonLower(hits, n);
  const loOther = wilsonLower(n - hits, n);
  const side = loPriced >= loOther ? priced : other;
  const lower = Math.max(loPriced, loOther);

  const band = supportBand(lower);
  // Not "coin flip": 7 of 10 is not a coin flip, it is a sample too small to
  // tell one from an edge. The words say which of those is true.
  if (!band) return { label: "Not established", flat: true, lower, n };
  return { label: `${band.word} ${side}`, side, band: band.id, lower, n };
}

// How full the verdict pill is drawn, 0 to 4.
//
// Five states used to be five identical pills with different words, so a
// genuine "Strong over" and a "Not established" looked the same until you read
// them. Hue cannot separate them: green and red already mean cleared and fell
// short on the bars in the same row. Weight was the other obvious reach and is
// the wrong one -- heavier type on Strong makes it *louder*, which is a
// different claim from *better supported*, and this product has no editorial
// voice to be loud in.
//
// So the pill grades by quantity of fill, which is what the bands actually
// measure. Design's own reading (mock 7a): a five-step accent ramp, empty at
// the bottom and solid at the top, read like a meter that happens to be pill
// shaped. Same hue, same weight, same size at every step.
//
// Mixed from --amber rather than pinned to the hexes the mock drew, because
// --amber is the user's accent and re-tints from Settings; the percentages are
// the design, the colour is theirs. Mixing against --surface-1 keeps each step
// sitting on the card it is drawn on rather than glowing over it.
const VERDICT_STEP = { strong: 4, leans: 3, slight: 2 };
export function verdictFill(v) {
  const step = v.thin ? 0 : v.flat ? 1 : (VERDICT_STEP[v.band] ?? 1);
  const mix = (pct) => `color-mix(in srgb, var(--amber) ${pct}%, var(--surface-1))`;
  return {
    step,
    background: step === 0 ? "transparent" : step === 4 ? "var(--amber)" : mix([0, 18, 42, 70][step]),
    // The border carries the step too, so the empty end still reads as a pill
    // rather than as a gap where a pill should be.
    border: step === 0 ? "var(--line)" : step >= 3 ? "var(--amber)" : mix(70),
    // White only once the fill is dark enough to carry it. --dim at the empty
    // end, accent ink in between.
    color: step >= 3 ? "var(--accent-on)" : step === 0 ? "var(--dim)" : "var(--amber-ink, var(--amber))",
  };
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
export default function BoardPage({ rows = [], groups = [], sport, sports = [], onSetSport, onOpenProp, onOpenGameProps, marketGroups = [], disclaimer, loading = false, slateByTeam = null, timeLabel = null, playersWithoutProps = null, injuryRows = null, isPhone = false }) {
  const [selectedMarkets, setSelectedMarkets] = useState([]);
  // See the note in PropLedger: the scale is the sport's, not a fixed 10.
  // The value each sport was last left on, remembered per sport.
  //
  // It used to snap back to the sport's floor on every switch, which threw
  // away a setting the reader had chosen. seedSampleValue restores what
  // this sport was left on; only a first visit inherits the value being
  // carried in, and when that cannot stand here it is clamped and says so
  // rather than moving silently.
  const [minGames, setMinGames] = useState(() => seedSampleValue(sport, null).value);
  const [samplePresets, setSamplePresets] = useState(() => loadSamplePresets(sport));
  const [carriedNote, setCarriedNote] = useState(null);
  // Ref, not state: reading it must not itself cause a render, and it is
  // only ever consulted at the moment the sport changes.
  const lastSample = React.useRef({ sport, value: null });
  React.useEffect(() => {
    const carried = lastSample.current.sport === sport ? null : lastSample.current.value;
    const seeded = seedSampleValue(sport, carried);
    setMinGames(seeded.value);
    setCarriedNote(seeded.note);
    setSamplePresets(loadSamplePresets(sport));
    lastSample.current = { sport, value: seeded.value };
  }, [sport]);
  // Every change is remembered against the sport it was made on.
  const changeMinGames = React.useCallback((n) => {
    setMinGames(n);
    setCarriedNote(null);
    lastSample.current = { sport, value: n };
    saveSampleValue(sport, n);
  }, [sport]);
  const [activeSplits, setActiveSplits] = useState(["season"]);
  const [visibleGames, setVisibleGames] = useState(10);
  // Slate work, which is what the rail is for: which games, in what order.
  const [sortBy, setSortBy] = useState("props");
  const [lineupFilter, setLineupFilter] = useState("all");

  const updateSamplePresets = React.useCallback((next) => {
    setSamplePresets(next);
    saveSamplePresets(sport, next);
  }, []);

  const filtered = useMemo(
    () => (selectedMarkets.length ? rows.filter((r) => selectedMarkets.includes(r.marketId)) : rows),
    [rows, selectedMarkets]
  );

  // Grouped under the game each prop belongs to -- the board's whole reason to
  // exist as a separate surface from the flat feed.
  const grouped = useMemo(() => {
    const byGame = new Map();
    // Away first with an @, which is how the slate and the player page write
    // a fixture. Falls back to "vs" only when the row could not say which
    // side it was on -- the rows carry `homeGame` from the feed builders.
    const gameTitleFor = (r) => {
      if (!r.team || !r.opp) return [r.team, r.opp].filter(Boolean).join(" ") || "Unknown fixture";
      if (r.homeGame == null) return `${r.team} vs ${r.opp}`;
      return r.homeGame ? `${r.opp} @ ${r.team}` : `${r.team} @ ${r.opp}`;
    };
    filtered.forEach((r) => {
      // gameId first, for the builders that carry one.
      //
      // The fallback is the team pair, sorted rather than directional. It used
      // to be `${team}-${opp}`, which reaches this loop twice for one pairing
      // -- DAL-NYG from the Cowboys' rows and NYG-DAL from the Giants' -- and
      // the board drew both: two cards under the same Cowboys @ Giants band,
      // one holding 66 props and the other 58, each claiming to be the whole
      // matchup. Sorting makes the two orders one key.
      //
      // Every builder does know its home side now (`homeGame`, added with the
      // @ marker), so the key could be directional again. It stays sorted
      // because it does not need to be: the direction is carried on the rows,
      // gameTitleFor reads it there, and a key that encodes a fact it does not
      // need is a key that can disagree with it.
      const key = r.gameKey || r.gameId || [r.team, r.opp].filter(Boolean).sort().join("-");
      if (!byGame.has(key)) byGame.set(key, { key, label: r.gameLabelFull || gameTitleFor(r), time: r.gameTime || "", rows: [] });
      byGame.get(key).rows.push(r);
    });
    return [...byGame.values()].map((g) => {
      // Strongest first inside a game: the board is for finding the few worth
      // opening, so the order has to be the answer to that question.
      //
      // Ranked on how well the sample supports the rate, not on the rate. The
      // old key was the raw `l10`, which put 7-of-10 -- a figure that
      // establishes nothing -- above 35-of-50, so a card's "three strongest
      // samples" were regularly its three flimsiest. Scored through the same
      // rateFor the rows render from, and once per row, so the order and the
      // pill beside it cannot come from two different numbers.
      const scored = g.rows.map((r) => {
        const s = rateFor(r, activeSplits);
        // The *priced* side only, deliberately, where the pill weighs both.
        // Ranking on the better of the two put every 0-of-10 at the top of
        // its card: a backup tight end who has never scored is a perfectly
        // well-supported claim and the least interesting row on the slate.
        // The rows are all built priced-over, so "does the over hold up" is
        // the question the order should answer; the pill still says "Strong
        // under" when the games say so, it just does not get promoted for it.
        const support = s && s.rate != null && s.n >= minGames
          ? wilsonLower(Math.round(s.rate * s.n), s.n)
          : -1;
        return { r, support };
      }).sort((a, b) => b.support - a.support);
      const rows = scored.map((x) => x.r);
      const strongest = scored.length ? scored[0].support : -1;
      // The slate row for this game -- and only if it is genuinely the same
      // fixture. Looking a team up finds *a* game it plays, which is not the
      // same thing, and joining on one team alone once hung TB's record and
      // Cincinnati's stadium on a card headed CIN vs CLE. Both sides must
      // match, or there is no join and the card says nothing about records,
      // kickoff or venue rather than saying something untrue.
      //
      // The original reason for the mismatch is gone -- the NFL builder used
      // to describe last season's opponent while the slate held this week's,
      // and all sixteen NFL cards join cleanly now. The check stays: it costs
      // one comparison, and it is the difference between an empty band and a
      // wrong one.
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

  // ---- the v3 tiers (see src/v3/BoardMobile.jsx) --------------------------
  //
  // `PropPalace Board v4 part 2.dc.html` bands games by how many reasons the
  // card can cite, not by a rank. Every reason below is a counted fact this
  // app already holds; a kind with nothing behind it does not fire, which is
  // why a card can sit in a lower tier than the mock's own example does.
  //
  // The mock's fourth kind, `lineup` -- "RICE BATTING SECOND", cited as a
  // logged role change naming both the player and the absence -- has no
  // source here. `lib/findings.js` produces season/home/away/vs-opponent
  // splits and no role-change finding, and `lineupStateFor` says only whether
  // a batting order is posted, which is a different claim. Left unfired
  // rather than approximated: the tier is a count of reasons, so a made-up
  // one would promote a game.
  // The slate's own day, off the first game that carries a start time.
  // Empty when nothing on screen has one -- never a guess at today.
  const slateDateLabel = useMemo(() => {
    const first = visible.map((g) => g.slate && g.slate.startsAt).find(Boolean);
    if (!first) return "";
    const d = new Date(first);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  }, [visible]);

  const v3Tiers = useMemo(() => {
    // Keyed by sport AND team, never by the abbreviation alone. DAL, WAS, PHX,
    // CLE, BOS and MIN all exist in more than one league, and keying on the
    // slug put the Dallas Wings' five absences on an NFL card headed DAL @ NYG
    // -- promoting that game a whole tier on a fact from another sport. Same
    // rule as CLAUDE.md's for crests, and it bites the same way.
    const outByTeam = new Map();
    (injuryRows || []).forEach((p) => {
      if (p.status !== "out" || !p.team || !p.sport) return;
      const k = `${p.sport}:${p.team}`;
      outByTeam.set(k, (outByTeam.get(k) || 0) + 1);
    });

    const withReasons = visible.map((g) => {
      const teamA = g.rows[0]?.team;
      const teamB = g.rows[0]?.opp;
      const reasons = [];

      // 1. How many props clear 70% on a sample deep enough to say so.
      //
      //    "Deep enough" is the sample-weighted lower bound, not the raw
      //    count -- the same wilsonLower this page already ranks a card's own
      //    rows on. That matters here more than anywhere: the mock's example
      //    game carries a handful of props and reads "4 PROPS AT 70%+", while
      //    an NFL slate here carries ~190 props per game, so counting every
      //    row whose raw rate touches 70% fires on all sixteen games and the
      //    tiers collapse into one. 7-of-10 is 70% and establishes nothing;
      //    the bound is what separates it from 35-of-50.
      const strong = g.rows.filter((r) => {
        const s = rateFor(r, activeSplits);
        if (!s || s.rate == null || s.n < minGames) return false;
        return wilsonLower(s.over, s.n) >= 0.7;
      }).length;
      if (strong > 0) reasons.push({
        kind: "rate",
        label: `${strong} PROP${strong === 1 ? "" : "S"} AT 70%+`,
        // title/cite are the hero card WHY IT LEADS list. Every cite names
        // the count behind the reason rather than restating the chip.
        title: `${strong} prop${strong === 1 ? "" : "s"} at 70%+`,
        cite: `Wilson lower bound over ${minGames}+ games, so 7 of 10 does not qualify and 35 of 50 does.`,
      });

      // 2. The availability feed, both sides. Only MLB and the WNBA publish
      //    one; the other two leagues simply never fire this reason rather
      //    than reporting zero, which would read as "nobody is hurt".
      const outCount = (outByTeam.get(`${sport}:${teamA}`) || 0) + (outByTeam.get(`${sport}:${teamB}`) || 0);
      if (outCount > 0) reasons.push({
        kind: "out",
        label: `${outCount} OUT`,
        title: `${outCount} listed out`,
        cite: `From the availability report for ${teamA || "both sides"} and ${teamB || "their opponent"} — counted, not inferred from a news item.`,
      });

      // 3. The softest opposing defence any prop on this card faces, in that
      //    prop's own market. A rank is only a reason when it is genuinely
      //    soft -- the last third of the league, which is where defTier cuts.
      // The card holds both teams' players, so the softest rank on it does
      // not necessarily belong to `rows[0]`'s opponent -- the defence being
      // named has to come off the row that carries the rank, or the chip
      // credits the wrong team.
      const softest = g.rows.reduce((best, r) => (r.rank != null && (!best || r.rank > best.rank) ? r : best), null);
      const teamCount = BOARD_TEAM_COUNT[sport] || null;
      // The last third of the league -- the same cut defTier makes, so the
      // chip and the word printed on a row cannot disagree about "soft".
      const softCut = teamCount ? Math.floor(teamCount - teamCount / 3) + 1 : null;
      if (softest && softCut && softest.rank >= softCut) {
        reasons.push({
          kind: "matchup",
          label: `${softest.opp || "OPP"} #${softest.rank} OF ${teamCount}`,
          title: `${softest.opp || "Opponent"} ranks #${softest.rank} of ${teamCount}`,
          cite: `Softest defence any prop on this card faces, measured in ${softest.marketLabel || "that prop’s own market"} rather than overall.`,
        });
      }

      return { g, reasons };
    });

    const bandOf = (n) => (n >= 3 ? 0 : n >= 1 ? 1 : 2);
    const ranked = withReasons.slice().sort((a, b) => b.reasons.length - a.reasons.length);
    const byBand = [0, 1, 2].map((i) => ranked.filter((x) => bandOf(x.reasons.length) === i));

    const cardOf = ({ g, reasons }, hero) => {
      const away = g.rows[0]?.homeGame ? g.rows[0]?.opp : g.rows[0]?.team;
      const home = g.rows[0]?.homeGame ? g.rows[0]?.team : g.rows[0]?.opp;
      const props = hero
        ? g.rows.slice(0, 3).map((r) => {
          const s = rateFor(r, activeSplits);
          return {
            key: r.key,
            playerId: r.playerId,
            marketId: r.marketId,
            name: r.name,
            prop: `${r.direction === "under" ? "UNDER" : "OVER"} ${r.line} ${String(r.marketLabel || "").toUpperCase()}`,
            // Rate, hits and the bars all come off the same filtered array.
            rate: s && s.rate != null ? s.rate : 0,
            hits: s ? s.over : 0,
            n: s ? s.n : 0,
            bars: s ? s.games : [],
            line: r.line,
            isBinary: r.isBinary,
            direction: r.direction,
            avatarNode: (
              <PlayerAvatar
                name={r.name} alt={r.name} sport={sport} team={r.team}
                headshotSrc={r.avatar} fallbackSrc={r.avatarFallback}
                size={32} inset={2} surface="var(--surface-1)"
              />
            ),
          };
        })
        : [];
      return {
        key: g.key,
        away: away || "", home: home || "",
        time: g.time || "",
        // The hero states its venue beside the time. Off the slate the card
        // is already drawn from, so the two cannot describe different games,
        // and absent rather than guessed when the feed never gave one.
        venue: (g.slate && g.slate.venue && g.slate.venue.name) || null,
        reasons,
        hero,
        quiet: reasons.length === 0,
        // What the card was missing, named rather than left blank.
        quietWhy: reasons.length === 0
          ? `Nothing on this card cleared a bar: no prop at 70% on ${minGames}+ games, no soft matchup, and nothing on either availability report.`
          : "",
        props,
        rest: `${Math.max(0, g.rows.length - props.length)} more props in this game`,
        rows: g.rows,
      };
    };

    return [0, 1, 2].filter((i) => byBand[i].length).map((i) => ({
      key: TIER_TITLES[i].title,
      title: TIER_TITLES[i].title,
      sub: TIER_TITLES[i].sub,
      tone: TIER_TITLES[i].tone,
      count: `${byBand[i].length} game${byBand[i].length === 1 ? "" : "s"}`,
      games: byBand[i].map((x, k) => cardOf(x, i === 0 && k === 0)),
    }));
  }, [visible, activeSplits, minGames, injuryRows, sport]);

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
        {/* Stated as what the sample supports, because that is what the words
            measure now. A percentage on its own cannot separate 9 of 10 from
            13 of 20, and those two deserve different sentences. */}
        <span>These read <b style={{ color: "var(--amber-ink, var(--amber))" }}>how far the games back the rate</b>, not the rate itself &mdash; so a big percentage over few games and a modest one over many are weighed on the same scale.</span>
        {SUPPORT_BANDS.map((b) => (
          <span key={b.id}>
            <b style={{ color: "var(--amber-ink, var(--amber))" }}>{b.word} over/under</b> &mdash; the sample holds up at {Math.round(b.min * 100)}% or better.
          </span>
        ))}
        <span><b style={{ color: "var(--amber-ink, var(--amber))" }}>Not established</b> &mdash; {minGames} games or more, but not enough of them to tell an edge from a coin flip.</span>
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

  // Same rows, same splits, same minimum sample -- banded instead of ranked.
  if (isPhone) {
    return (
      <BoardMobile
        sport={sport}
        sports={sports.filter((s) => s.available !== false).map((s) => (typeof s === "string" ? s : s.id))}
        onSetSport={onSetSport}
        tiers={v3Tiers}
        summary={`${visible.length - (v3Tiers.find((t) => t.title === "Quiet")?.games.length || 0)} of ${visible.length} games have something counted`}
        // The mock puts a date here ("MON, AUG 24"), not a time. This used to
        // pass `timeLabel` itself -- a *formatter function*, which React
        // rendered as the "Functions are not valid as a React child" warning
        // and an empty slot. The date comes off the slate the cards are
        // already drawn from, so it cannot describe a different day.
        slateLabel={slateDateLabel}
        footNote="A tier is a count of the reasons on the card — nothing is weighted, and no tier is a prediction. A quiet game is shown rather than dropped, and says what it was missing."
        loading={loading}
        emptyNote={loading ? null : "No games on this slate yet."}
        onOpenProp={onOpenProp}
        onOpenGameProps={(g) => onOpenGameProps && onOpenGameProps(g)}
      />
    );
  }

  // ---- the desktop frame (see src/v3/BoardDesktop.jsx) --------------------
  //
  // `PropPalace Board v4 part 2.dc.html` frame 1b. Same tiers, same cards,
  // same reasons as the phone — the frame promotes the leading game to a
  // full-width hero and lays the rest out three across.
  //
  // The hero is band 0's leader. The mock then draws only bands 1 and 2,
  // which would drop band 0's other games from the widest screen while
  // keeping them on the phone; here band 0 keeps its tier and simply loses
  // its leader to the hero.
  const heroTier = v3Tiers.find((t) => t.games.some((g) => g.hero)) || null;
  const heroCard = heroTier ? heroTier.games.find((g) => g.hero) : null;
  const desktopHero = heroCard
    ? {
        ...heroCard,
        meta: [heroCard.time, heroCard.venue].filter(Boolean).join(" · "),
        // The reasons carry their own citation (see v3Tiers). Nothing is
        // written here that the card did not already count.
        why: heroCard.reasons.filter((r) => r.title),
      }
    : null;
  // The count is recomputed after the hero is pulled out, not carried. It read
  // "2 games" over a grid holding one, because v3Tiers counted the band
  // before the hero was lifted from it.
  const desktopTiers = v3Tiers
    .map((t) => {
      const games = t.games.filter((g) => !g.hero);
      return { ...t, games, count: `${games.length} game${games.length === 1 ? "" : "s"}` };
    })
    .filter((t) => t.games.length);

  if (!isPhone) {
    return (
      <BoardDesktop
        sport={sport}
        sports={sports.filter((sp) => sp.available !== false).map((sp) => (typeof sp === "string" ? { id: sp, label: sp.toUpperCase() } : { id: sp.id, label: sp.label || String(sp.id).toUpperCase() }))}
        onSetSport={onSetSport}
        hero={desktopHero}
        tiers={desktopTiers}
        summary={`${visible.length - (v3Tiers.find((t) => t.title === "Quiet")?.games.length || 0)} of ${visible.length} games have something counted`}
        slateLabel={slateDateLabel}
        footNote="A tier is a count of the reasons on the card — nothing is weighted, and no tier is a prediction. A quiet game is shown rather than dropped, and says what it was missing."
        loading={loading}
        emptyNote={loading ? null : "No games on this slate yet."}
        onOpenProp={onOpenProp}
        onOpenGameProps={(g) => onOpenGameProps && onOpenGameProps(g)}
      />
    );
  }

}

// One side of a game card's band. Same shape as the matchup band on Player
// Detail -- crest, side and record above the team name, with a 3px rule in the
// team's own muted tone across the top.
function BoardBandHalf({ sport, side, abbr, record, tone, align }) {
  const info = teamInfo(sport, abbr);
  const text = (
    <div style={{ minWidth: 0, textAlign: align === "right" ? "right" : "left" }}>
      <div className="pp-mono" style={{ fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--dim)", whiteSpace: "nowrap" }}>
        {record ? `${side} \u00b7 ${record}` : side}
      </div>
      <div className="pp-display" style={{ fontWeight: 600, fontSize: 17, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {info.name || abbr}
      </div>
    </div>
  );
  // The crest, not a lettered box. Same treatment the player page's band uses:
  // a light trace so a dark mark still separates from a dark card.
  const badge = (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: "none", width: 44, height: 44 }}>
      <TeamLogo
        sport={sport}
        abbr={abbr}
        size={38}
        title={info.full || abbr}
        style={{ filter: "drop-shadow(0 0 1px color-mix(in srgb, var(--text) 70%, transparent))" }}
      />
    </span>
  );
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
      borderTop: `3px solid ${tone}`, flex: 1, minWidth: 0,
      justifyContent: align === "right" ? "flex-end" : "flex-start",
    }}>
      {align === "right" ? <>{text}{badge}</> : <>{badge}{text}</>}
    </div>
  );
}

function BoardRow({ row, minGames, activeSplits, isLast, onOpen, sport }) {
  const split = rateFor(row, activeSplits);
  const n = split ? split.n : 0;
  const rate = split ? split.rate : null;
  // The rule the README singles out as critical: a split recomputes the rate
  // and its stated sample together, so a split that drops the sample below the
  // minimum flips the row to TOO FEW rather than showing a percentage over
  // three games.
  const thin = rate == null || n < minGames;
  // `sport` comes from the page, not from the row. It used to read
  // `row.sport` -- a field none of the four feed-row builders has ever
  // written -- so every click here called onOpen(undefined, ...), the shell
  // set its page to undefined, and the whole app rendered blank. The feed's
  // own rows never hit it because FeedRow passes the page's sport too.
  const open = row.playerId && onOpen ? () => onOpen(sport, row.playerId, row.marketId, { name: row.name, team: row.team }) : null;

  // Verdicts ride the accent, never green or red: green and red mean cleared
  // and fell short on the bars in this same row, and a green verdict pill
  // would overload the colour two inches from where it means something else.
  //
  // The side comes from `row.direction` rather than being assumed to be over
  // -- see verdictFor. An under-priced row with a strong rate was reading
  // "Leans over", which is the exact opposite of what its own games say.
  const v = verdictFor(rate, n, minGames, row.direction);
  const verdict = v.label;
  const verdictStyle = verdictFill(v);

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
        <span
          className="pp-mono"
          title={v.n != null && v.lower != null
            ? `${Math.round(v.lower * 100)}% is the most this sample supports, over ${v.n} games`
            : undefined}
          style={{
            display: "inline-block", borderRadius: 999, padding: "5px 10px",
            fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em",
            background: verdictStyle.background,
            color: verdictStyle.color,
            border: `1px solid ${verdictStyle.border}`,
          }}
        >
          {verdict}
        </span>
      </div>
    </div>
  );
}
