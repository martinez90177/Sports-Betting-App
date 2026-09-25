import React from "react";
import FormPlot, { crest } from "./FormPlot.jsx";
import { probToAmericanOdds, formatOdds } from "../odds.js";
import { buildRungs, bookLadder } from "../lib/altLines.js";
import { useBettingSettings } from "../settings.jsx";
import { watchGameLabel, watchGameShort } from "../lib/watchGames.js";
import AgeMark from "./AgeMark.jsx";
import { STATUS } from "../lib/teamColors.js";
import ValuePlot from "./ValuePlot.jsx";
import WindowNumber from "./WindowNumber.jsx";
import SeasonNote from "./SeasonNote.jsx";

// A transcription of frame `1a` in `v3 Mocks/PropPalace Desktop v3.dc.html`,
// the largest frame in the bundle.
//
// It takes the same contract PlayerDetailV2 does, so the four sport pages feed
// it unchanged and the swap is one line in PlayerDetail.jsx.
//
// ---- The grid contract, `desktop-handoff.md` §1 ----
//
// Four rules, each of which the handoff says caused a real defect, and each
// load-bearing here:
//
//   1. `grid-template-rows: minmax(0, 1fr)` on the body. Without it the row is
//      sized by its tallest child's min-content height, the frame overflows and
//      no inner scroller ever engages.
//   2. A scrolling column needs `min-height: 0; overflow: hidden` and children
//      at `flex: 0 0 auto`. A column-flex scroller whose children can shrink
//      compresses them instead of scrolling -- and any child with its own
//      `overflow: hidden` then silently clips. This is what cut the fourth
//      reason off the Board's hero card.
//   3. A collapsed rail loses its *track*, not its width. `0px` leaves the
//      next column in the wrong place, so the template is built from the
//      columns that actually exist.
//   4. `position: relative` on the frame, so the bar-detail card resolves
//      against it rather than against the document.
//
// ---- Rails, §2 ----
//
// Left is what filters the page, right is what contextualises it, centre is
// the thing itself and the only column that scrolls independently. Nothing in
// a rail is behind an accordion -- the width is the whole point.
//
// Shape carries meaning: rounded rectangles (6-8px) for anything clickable,
// full pills (999px) only for read-only labels. A control drawn as a pill
// reads as a badge.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const railLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };

// Roster-status chips on a teammate row: IL / GTD / AAA / DFA / "Left team".
//
// Literal hexes, never `--amber`. CLAUDE.md rule 2 and the naming trap it
// names: `--amber` is the user's accent colour off the Settings wheel, so a
// health chip painted with it turns blue the moment somebody picks blue.
const BADGE_TONE = {
  out: { fg: "#ef5b5b", bg: "rgba(239,91,91,0.14)" },
  warn: { fg: "#e8b13a", bg: "rgba(232,177,58,0.16)" },
  muted: { fg: "var(--dim)", bg: "var(--surface-2)" },
};
const cellLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)" };
const railNote = { fontSize: 11.5, color: "var(--dim)", lineHeight: 1.4 };

// Rows and their header share one template string. Defined once, or the
// columns drift apart the moment either changes (`desktop-handoff.md` §1).
// The mock's own template, with every fixed column trimmed to what its
// header actually measures and the SHAPE column allowed to reach zero.
//
// It was "92px 92px 128px 1fr 96px 104px" — 512px of fixed track — and the
// 1fr column held a bar pinned to a literal `width: 190`, so the row's
// min-content was about 830px. The centre track is 696px at 1252 and 443px
// at 1000, and a grid row cannot be narrower than its min-content: the
// ladder simply ran off the end of the card, silently, because `.nsb` hides
// the scrollbar it was overflowing into.
const LADDER_COLS = "72px 74px 104px minmax(0, 1fr) 78px 88px";

// What is left when the card cannot hold six columns: SHAPE and the "+ ADD
// LEG" hint go, in that order, because they are the two that repeat something
// already on the row. SHAPE is the hit rate drawn again two columns to its
// left, and every rung is a button whether or not the words are printed.
// Losing them is a real cost and it beats a bar squeezed to twenty pixels
// with a MAIN LINE pill hanging out of its own cell.
const LADDER_COLS_TIGHT = "68px 70px 100px minmax(0, 1fr)";
// Below this the six-column row's own fixed tracks (416px) plus its padding
// no longer fit, so the grid overflows the card rather than compressing.
const LADDER_WIDE_MIN = 620;

// The rail's one control, transcribed from the mock's `railPill` -- with one
// deliberate change: the label is centred.
//
// The mock left-aligns it, and the app followed, so MARKET and WINDOW read
// hard against the left edge of pills that are much wider than their text
// while SEASON and MINIMUM SAMPLE (which used the centred variant) did not.
// One rail, two alignments, for no reason a reader could see. Alex,
// 2026-09-10: *"i would rather the market names be centered in the pill rather
// than stuck left axis like that."*
//
// Centring all of them makes it one rule instead of two, which also retires
// the variant that existed only to opt back out of the default.
function railPill(on) {
  return {
    minHeight: 34, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "0 11px", textAlign: "center",
    borderRadius: 7, fontFamily: MONO, fontSize: 12, cursor: "pointer",
    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
    background: on ? "var(--amber-dim)" : "var(--surface-1)",
    color: on ? "var(--amber-ink)" : "var(--text-2)",
  };
}

// Kept as a name because several call sites read better for saying so, but it
// is now the same pill -- centring is the default.
const railPillC = railPill;

// The workload slider's two buttons and the roster rail's team tabs. Each
// is its own style in the mock rather than a railPill variant, so each is
// written out rather than derived from one.
const roleModeStyle = {
  minHeight: 28, display: "flex", alignItems: "center", padding: "0 10px",
  borderRadius: 7, border: "1px solid var(--line)", background: "var(--surface-1)",
  color: "var(--text-2)", fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap",
};
const roleResetStyle = (clean) => ({
  minHeight: 28, display: "flex", alignItems: "center", padding: "0 10px",
  borderRadius: 7, fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em",
  cursor: "pointer", whiteSpace: "nowrap",
  border: `1px solid ${clean ? "var(--amber)" : "var(--line)"}`,
  color: clean ? "var(--amber-ink)" : "var(--text-2)",
});
const rosterTabStyle = (on) => ({
  minHeight: 28, display: "flex", alignItems: "center", padding: "0 10px",
  borderRadius: 7, fontFamily: MONO, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
  border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
  background: on ? "var(--amber-dim)" : "var(--surface-1)",
  color: on ? "var(--amber-ink)" : "var(--text-2)",
});

// Read-only label: a full pill, and only ever read-only.
const pill = (fg, bg) => ({
  fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", padding: "3px 8px",
  borderRadius: 999, flex: "0 0 auto", background: bg, color: fg, whiteSpace: "nowrap",
});

export default function PlayerDetailDesktop({
  sport,
  player,
  markets = [],
  marketLabel,
  verdict,
  chart,
  context,
  conditions,
  log,
  band,
  ownRail,
  oppRail,
  onBack,
  onWatch,
  watching,
  watched = [],
  onOpenWatched,
  crumbFixture,
  crumbSelect,
  footerNote,
  onAddPick,
  pickAdded,
  extraBlocks,
  // Where the output lands, as a frequency histogram. Null on a market with
  // no repeat structure -- see the gates on each page.
  distribution = null,
  // v3 additions, the same ones the phone frame takes.
  seasons = null,       // { options: [{ id, label, active, onPick }], note }
  windows = null,
  splits = null,
  // Opposing-starter handedness, MLB batters only. Not a mock control --
  // see the note on the group below.
  hands = null,
  // Final result of each game, NFL only -- the same counted-option group as
  // `hands`, with its own title. Composes with SPLITS rather than joining it.
  script = null,
  injuryTeams = null,
  lineups = null,
  renderAvatar = null,
  availability = null,
  slipCount = null,
  onOpenSlip = null,
  // The frame draws the app's nav inside itself, above the crumb bar -- unlike
  // the v2 mock, which opened on the breadcrumb alone. Optional: without a
  // handler the row simply is not drawn, rather than drawing tabs that go
  // nowhere.
  navTabs = null,
  onNavigate = null,
  onHome = null,
  onOpenSettings = null,
  // (line) => void, for the ladder's + ADD LEG. The rungs themselves are
  // built here off the same series the graph draws, so a rung and a bar can
  // never describe different games.
  onAddLeg = null,
  // (game, marketId) => value. The page's own stat accessor, so the box
  // score in the bar-detail card and the bar above it are read by one
  // function. Derived markets (rebounds from oreb+dreb, stocks, PRA) do
  // not exist as fields on a logged game and cannot be read off it.
  valueOfMarket = null,
  // Minimum-sample and workload controls, where the sport has them.
  samples = null,
  // The MINIMUM SAMPLE floor, already resolved to a number ("All" is 0). The
  // ladder grades itself against this rather than against altLines' own
  // THIN_GAMES, so the rail control and the card below it cannot disagree
  // about what thin means.
  minSample = 0,
  workload = null,
}) {
  const games = (chart && chart.games) || [];
  const line = chart ? chart.line : null;

  // A slice of the already-windowed, already-filtered series -- so the zoom
  // composes with every other control rather than replacing them (§3).
  //
  // Cleared whenever the series itself changes, not just its length. Keyed on
  // the length alone, a zoom on one quarterback's L10 carried onto the next
  // quarterback opened from the rail -- same market, same ten games -- and
  // showed him a slice nobody had asked for.
  const [zoom, setZoom] = React.useState(null);
  const seriesKey = games.map((g) => `${g.iso || g.date}:${g.v}`).join("|");
  React.useEffect(() => { setZoom(null); }, [seriesKey, marketLabel]);
  const shown = zoom ? games.slice(zoom[0], zoom[1] + 1) : games;

  const [picked, setPicked] = React.useState(null);
  // `picked` is an index into `shown`, so it cannot outlive the slice it was
  // an index into.
  React.useEffect(() => { setPicked(null); }, [zoom]);
  // The saved-window pill under the pointer or focus, which is the only one
  // that shows its ×.
  const [hoverWin, setHoverWin] = React.useState(null);

  // The alt-line ladder, folded away by default so the graph owns the screen.
  //
  // Alex, 2026-09-09: *"make the alt lines section underneath it collapsable so
  // that the graph can take up more space on the page."* Seven rungs is a tall
  // card, and it answers a second question -- "what about a different number" --
  // that only gets asked after the first one. Collapsed it costs one row and
  // still says how many rungs are behind it, so it reads as folded rather than
  // missing.
  const [ladderOpen, setLadderOpen] = React.useState(false);

  // The alt-line ladder's own width, so it can drop columns it has no room
  // for rather than overflowing the card it lives in.
  const ladderRef = React.useRef(null);
  const [ladderW, setLadderW] = React.useState(0);
  React.useLayoutEffect(() => {
    const measure = () => {
      if (ladderRef.current) setLadderW(ladderRef.current.getBoundingClientRect().width);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });
  // Six columns until the card says it cannot hold them. `0` is "not measured
  // yet", which resolves before paint (useLayoutEffect) and so never flashes
  // the wrong layout.
  const ladderWide = ladderW === 0 || ladderW >= LADDER_WIDE_MIN;

  // The frame fills what is left under the nav, and its three columns scroll
  // inside it -- the same pattern every other desktop frame uses.
  //
  // This was `height: "100%"` with no parent height to resolve against, so it
  // grew with its content and the *document* scrolled instead. The rails and
  // the centre already carried `overflowY: auto; min-height: 0`; they simply
  // never had a bounded height to scroll within, so a long centre column
  // pushed the whole page down and the rails scrolled with it rather than
  // independently. Rule 1 of the grid contract, arrived at from the other end.
  const frameRef = React.useRef(null);
  const [frameH, setFrameH] = React.useState(null);
  React.useLayoutEffect(() => {
    const measure = () => {
      const el = frameRef.current;
      if (!el) return;
      setFrameH(Math.max(420, Math.round(window.innerHeight - el.getBoundingClientRect().top)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Escape clears the zoom; the arrows step the line one rung (§3).
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { if (picked != null) setPicked(null); else setZoom(null); return; }
      if (!chart || !chart.onDragLine || line == null) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); chart.onDragLine(Math.max(0, line - 0.5)); }
      if (e.key === "ArrowRight") { e.preventDefault(); chart.onDragLine(line + 0.5); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chart, line, picked]);

  const hitOf = React.useCallback(
    (v) => (chart && chart.direction === "under" ? v < line : v > line),
    [chart, line]
  );
  const hits = shown.filter((g) => hitOf(g.v)).length;

  // Built off the very series the graph draws, so the ladder and the bars
  // can never be counting different games.
  //
  // On the rungs of the book picked in Settings, the same ladder the feed's alt
  // rows use for this market (see BOOK_LADDERS), so the two pages never offer
  // different lines for one prop.
  const book = useBettingSettings().sportsbook;
  const marketId = (markets.find((m) => m.active) || {}).id;
  const rungs = React.useMemo(() => buildRungs({
    values: shown.map((g) => g.v),
    mainLine: chart && chart.marketLine != null ? chart.marketLine : line,
    isBinary: !!(chart && chart.isBinary),
    direction: (chart && chart.direction) || "over",
    ladder: bookLadder(book, sport, marketId),
  }), [shown, chart, line, book, sport, marketId]);

  // Thin by the reader's own MINIMUM SAMPLE floor when they have set one, and
  // by lib/altLines' own THIN_GAMES when they have not -- never both at once.
  //
  // Declared here rather than beside the other card state: it reads `rungs`,
  // which is the memo directly above, and a const that reaches backwards for a
  // let-bound value throws before the page paints.
  const ladderThin = rungs.length > 0 && (
    minSample > 0 ? rungs[0].gamesCounted < minSample : !!rungs[0].thin
  );

  // ---- the bar-detail card's two lower sections -------------------------
  //
  // Both are derived, never carried: the box line is the logged game's own
  // fields, and the notes are counted off the same record the teammate
  // filter uses. Anything neither can answer is left out of the list rather
  // than printed with a placeholder.
  const pickedGame = picked != null && shown[picked] ? shown[picked] : null;
  const rawGame = pickedGame && pickedGame.raw;

  const cardBox = React.useMemo(() => {
    if (!rawGame || !valueOfMarket) return [];
    return (markets || [])
      .map((m) => ({ label: String(m.label || m.id).toUpperCase(), value: valueOfMarket(rawGame, m.id) }))
      .filter((b) => b.value != null && b.value !== "" && !Number.isNaN(b.value))
      .slice(0, 10);
  }, [rawGame, markets, valueOfMarket]);

  const cardNotes = React.useMemo(() => {
    if (!pickedGame) return [];
    const rows = [];

    // Rest is the gap to the previously logged game. The first game in a
    // log has nothing before it, so it gets no row rather than a zero.
    const at = games.indexOf(pickedGame);
    const prev = at > 0 ? games[at - 1] : null;
    if (prev && pickedGame.iso && prev.iso) {
      const days = Math.round((new Date(pickedGame.iso) - new Date(prev.iso)) / 86400000) - 1;
      if (Number.isFinite(days) && days >= 0) rows.push({ label: "DAYS REST", value: String(days) });
    }

    rows.push({ label: "HOME / AWAY", value: pickedGame.home === false ? "Away" : "Home" });

    // Who was out on either side. `playedInGame` returns null for a game we
    // could not check, and an unchecked game says so instead of claiming
    // everyone was available.
    const played = lineups && lineups.playedInGame;
    if (played && rawGame) {
      const side = (people, label) => {
        if (!people || !people.length) return;
        let unknown = 0;
        const out = [];
        people.forEach((person) => {
          const v = played(rawGame, person.pid);
          if (v === null || v === undefined) unknown += 1;
          else if (!v) out.push(person.name);
        });
        if (unknown === people.length) rows.push({ label, value: "Not recorded for this game" });
        else if (!out.length) rows.push({ label, value: "None" });
        else rows.push({ label, value: out.join(", ") });
      };
      side(lineups.mates, "TEAMMATES · DID NOT PLAY");
      side(lineups.opps, "OPPONENTS · DID NOT PLAY");
    }

    rows.push({ label: "AGAINST THE LINE", value: `${hitOf(pickedGame.v) ? "Cleared" : "Under"} ${line}` });
    return rows;
  }, [pickedGame, rawGame, games, lineups, line, hitOf]);

  const st = availability ? STATUS[availability] : null;

  // ---- nav row ------------------------------------------------------------
  const nav = navTabs && navTabs.length > 0 && (
    <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 32, padding: "16px 32px", borderBottom: "1px solid var(--line)" }}>
      <span
        role={onHome ? "button" : undefined}
        tabIndex={onHome ? 0 : undefined}
        onClick={onHome || undefined}
        onKeyDown={onHome ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onHome(); } } : undefined}
        style={{ display: "flex", alignItems: "center", gap: 10, cursor: onHome ? "pointer" : "default" }}
      >
        <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>Prop Palace</span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 26 }}>
        {navTabs.map((t) => (
          <span
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => onNavigate && onNavigate(t.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate && onNavigate(t.id); } }}
            style={{
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--dim)", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </span>
        ))}
      </span>
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onOpenSettings || undefined}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenSettings && onOpenSettings(); } }}
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--dim)", fontSize: 15, cursor: "pointer" }}
        >
          ⚙
        </span>
        {/* Drawn because the frame draws it. It does nothing yet -- there is
            no account server (see docs/ACCOUNTS_SUBSCRIPTION_TUTORIAL.md), so
            it is a label, not a control, and carries no affordance saying
            otherwise. */}
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: "var(--dim)" }}>SIGN IN</span>
        <AgeMark radius={7} />
      </span>
    </div>
  );

  // ---- crumb bar ----------------------------------------------------------
  const crumb = (
    <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", padding: "12px 32px", borderBottom: "1px solid var(--line)" }}>
      <span style={{ flex: "1 1 0", display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onBack}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack && onBack(); } }}
          style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--amber-ink)", whiteSpace: "nowrap", cursor: "pointer" }}
        >
          ← PROP FEED
        </span>
        <span style={{ width: 1, height: 18, background: "var(--line)", display: "block", flex: "0 0 auto" }} />
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)", whiteSpace: "nowrap" }}>WATCHING</span>
        <span className="nsb" style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", minWidth: 0 }}>
          {watched.map((w) => (
            <div
              key={w.key || w.id || `${w.sport}:${w.playerId}:${w.marketId}`}
              role="button"
              tabIndex={0}
              title={[w.name, w.subtitle, watchGameLabel(w)].filter(Boolean).join(" — ")}
              onClick={() => onOpenWatched && onOpenWatched(w)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenWatched && onOpenWatched(w); } }}
              style={{
                display: "flex", alignItems: "center", gap: 7, flex: "0 0 auto", cursor: "pointer",
                padding: "5px 10px", borderRadius: 7, border: "1px solid var(--line)", background: "var(--surface-1)",
                fontFamily: MONO, fontSize: 11, color: "var(--text-2)",
              }}
            >
              <span role="img" style={crest(w.team, w.sport, 13)} />
              <span style={{ whiteSpace: "nowrap" }}>{w.label || w.name}</span>
              {(w.prop || w.subtitle) && <span style={{ color: "var(--dim)", whiteSpace: "nowrap" }}>{w.prop || w.subtitle}</span>}
              {/* The game the prop is on -- the same line against another
                  opponent is another prop. */}
              {watchGameShort(w) && <span style={{ color: "var(--dim)", whiteSpace: "nowrap" }}>· {watchGameShort(w)}</span>}
            </div>
          ))}
          {/* Rule 4: an empty watch list says it is empty. */}
          {watched.length === 0 && (
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)", whiteSpace: "nowrap" }}>
              Nothing watched yet.
            </span>
          )}
        </span>
      </span>
      <span style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end" }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onWatch}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWatch && onWatch(); } }}
          style={{
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", padding: "7px 13px", borderRadius: 7,
            cursor: "pointer", whiteSpace: "nowrap",
            border: `1px solid ${watching ? "var(--amber)" : "var(--line)"}`,
            background: watching ? "var(--amber-dim)" : "var(--surface-1)",
            color: watching ? "var(--amber-ink)" : "var(--text-2)",
          }}
        >
          {watching ? "✓ WATCHING" : "+ WATCH"}
        </span>
      </span>
    </div>
  );

  // ---- left rail: what filters the page -----------------------------------
  const leftRail = (
    <div className="nsb" style={{ borderRight: "1px solid var(--line)", overflowY: "auto", minHeight: 0, padding: "20px 18px 28px", display: "flex", flexDirection: "column", gap: 22 }}>
      {/* MARKET leads the rail, as frame 1a draws it.

          It spent 2026-09-09 as a horizontal strip above the chart instead --
          the reasoning being that markets are stepped through while reading
          rather than set once, and that a quarterback's eight of them pushed
          WINDOW and SPLITS below the fold. That may still be the better screen,
          but it is a change to the design rather than a reading of it, and it
          is what made the page stop looking like v3. It waits in
          docs/V3_PARKED_CHANGES.md B1/B2 for Alex to call. */}
      {markets.length > 0 && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9 }}>
          <span style={railLabel}>MARKET</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {markets.map((m) => (
              <div
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={m.onPick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); m.onPick(); } }}
                style={railPill(m.active)}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {seasons && seasons.options && seasons.options.length > 0 && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9 }}>
          <span style={railLabel}>SEASON</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {seasons.options.map((s) => (
              <div key={s.id} role="button" tabIndex={0} onClick={s.onPick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); s.onPick(); } }}
                style={railPillC(s.active)}>
                {s.label}
              </div>
            ))}
          </div>
          {/* A season young enough that it is not on the row yet says so --
              see SEASON_MIN_GAMES. */}
          {seasons.note && (
            <span style={{ fontSize: 11, lineHeight: 1.45, color: "var(--dim)" }}>{seasons.note}</span>
          )}
        </div>
      )}

      {workload && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 11, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <span style={railLabel}>{workload.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "var(--amber-ink)" }}>{workload.value}</span>
          </div>
          {workload.control}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {workload.onToggleMode && (
              <div role="button" tabIndex={0} onClick={workload.onToggleMode}
                onKeyDown={(e) => { if (e.key === "Enter") workload.onToggleMode(); }}
                style={roleModeStyle}>
                {workload.modeLabel}
              </div>
            )}
            {workload.onReset && (
              <div role="button" tabIndex={0} onClick={workload.onReset}
                onKeyDown={(e) => { if (e.key === "Enter") workload.onReset(); }}
                style={roleResetStyle(!workload.active)}>
                ANY
              </div>
            )}
            {workload.games && (
              <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{workload.games}</span>
            )}
          </div>
        </div>
      )}

      {[hands && { title: "OPPOSING STARTER", ...hands }, script]
        .filter((grp) => grp && grp.options && grp.options.length > 0)
        .map((grp) => (
        <div key={grp.title} style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <span style={railLabel}>{grp.title}</span>
            {grp.loading && <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>Loading…</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${grp.options.length}, minmax(0, 1fr))`, gap: 6 }}>
            {grp.options.map((h) => (
              <div
                key={h.id}
                role="radio"
                aria-checked={!!h.active}
                tabIndex={0}
                onClick={h.onPick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); h.onPick(); } }}
                style={{ ...railPill(h.active), justifyContent: "center", flexDirection: "column", gap: 0, minHeight: 42 }}
              >
                <span>{h.label}</span>
                {/* Each side states the games it can actually account for,
                    so the control never implies the whole log. */}
                <span style={{ fontFamily: MONO, fontSize: 9.5, color: "var(--dim)" }}>{h.count}</span>
              </div>
            ))}
          </div>
          {/* What the filter cannot see. A game it could not resolve is
              dropped from every option rather than counted as one of them,
              so the reader is told how many that is. */}
          {grp.note && <span style={railNote}>{grp.note}</span>}
        </div>
      ))}
      {splits && splits.length > 0 && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9 }}>
          <span style={railLabel}>SPLITS</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {splits.map((s) => (
              <div
                key={s.id}
                role="radio"
                aria-checked={!!s.active}
                tabIndex={0}
                onClick={s.onPick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); s.onPick(); } }}
                style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 34, cursor: "pointer" }}
              >
                {/* Exclusive, one at a time: two splits at once would recompute
                    over an intersection nobody asked for. */}
                <span
                  style={{
                    width: 15, height: 15, borderRadius: 4, flex: "0 0 auto", boxSizing: "border-box",
                    border: `1px solid ${s.active ? "var(--amber)" : "var(--line)"}`,
                    background: s.active ? "var(--amber)" : "transparent",
                  }}
                />
                <span style={{ fontSize: 13, color: "var(--text)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {samples && samples.length > 0 && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <span style={railLabel}>MINIMUM SAMPLE</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {samples.map((s) => (
              <div key={s.id} role="button" tabIndex={0} onClick={s.onPick}
                onKeyDown={(e) => { if (e.key === "Enter") s.onPick(); }}
                style={railPill(s.active)}>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ---- centre: the thing itself -------------------------------------------
  // Implied is the window's own rate as American odds, through the same
  // conversion odds.js uses -- never a book's number, because there is no
  // odds feed. Identical to the phone frame's cell, off the same array.
  const impliedText = shown.length ? formatOdds(probToAmericanOdds(hits / shown.length)) : "—";
  const rankParts = String((context && context.rank) || "").split(" of ");

  // Average and median over the same games the chart draws, each with its
  // distance from the line -- tinted by which side of it the figure lands.
  // Alex, 2026-09-25, of the three wide cells this strip used to be: *"either
  // missing some data or are so big that there's all that empty space."*
  // Outlier leads its chart with the same pair: the median is the one a
  // single 330-yard game cannot drag. No hit rate here -- "5 of 10" is under
  // the chart and in LAST 10 below it.
  const shownVals = shown.map((g) => g.v).filter(Number.isFinite);
  const avg = shownVals.length ? shownVals.reduce((a, b) => a + b, 0) / shownVals.length : null;
  const ordered = [...shownVals].sort((a, b) => a - b);
  const mid = ordered.length >> 1;
  const median = !ordered.length ? null : ordered.length % 2 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2;
  const fmtStat = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const vsLine = (v) => {
    if (v == null || line == null) return null;
    const d = v - line;
    return `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} VS LINE`;
  };
  const sideTone = (v) => (v == null || line == null ? null : hitOf(v) ? "var(--pos)" : "var(--neg)");
  const allowed = context && context.allowedOfficial;

  const strip = [
    { key: "line", label: "LINE", value: verdict ? verdict.line : "—", sub: String(marketLabel || "").toUpperCase(), tone: null },
    { key: "avg", label: "AVERAGE", value: avg == null ? "—" : avg.toFixed(1), sub: vsLine(avg) || "NO GAMES IN WINDOW", subTone: sideTone(avg) },
    { key: "median", label: "MEDIAN", value: median == null ? "—" : fmtStat(median), sub: vsLine(median) || "NO GAMES IN WINDOW", subTone: sideTone(median) },
    { key: "implied", label: "IMPLIED", value: impliedText, sub: shown.length ? `FROM ${shown.length} GAMES` : "NO GAMES IN WINDOW", tone: null },
    {
      key: "matchup",
      label: "MATCHUP",
      value: rankParts[0] || "—",
      // Amber for any ranked tier: green and red mean cleared and missed
      // everywhere else on this page, so a rank must not borrow them.
      sub: rankParts[1]
        ? `OF ${rankParts[1]}${context && context.rankWord ? ` · ${String(context.rankWord).toUpperCase()}` : ""}${context && context.rankSeason ? ` · ${context.rankSeason}` : ""}`
        : "NOT RANKED",
      // The other season's rank, when the page has one (NFL). Printed under
      // the cell rather than only in a tooltip: it is the half of the answer
      // that stops a two-game rank or a last-year rank being taken on its own.
      note: rankParts[1] && context && context.rankNote ? context.rankNote : null,
      // The official figure behind the rank, where the page has one (NFL
      // yardage markets, from ESPN's team statistics). The rank alone says
      // "#6"; this says what #6 means in yards.
      extra: allowed ? `${allowed.value} ${String(allowed.label).toUpperCase()}` : null,
      tone: rankParts[1] ? "var(--status-questionable)" : "var(--dim)",
    },
  ];

  const centre = (
    <div className="nsb" style={{ overflowY: "auto", minHeight: 0, padding: "26px 26px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
      {crumbSelect ? (
        // The fixture picker inherited the body face, which is 'PP At' -- a
        // monospace, set at heading size and centred over the page. Alex,
        // 2026-09-09: *"this font for the game dropdown is ugly."* Mono is
        // right for a number in a column and wrong for the one line of prose
        // at the top of the screen, so it takes the display face the player's
        // own name uses, in a bordered control that reads as clickable rather
        // than as a stray title. GameSelect's crumb variant is `font: inherit`,
        // so styling the wrapper is all this needs.
        <div
          style={{
            flex: "0 0 auto", alignSelf: "center", display: "inline-flex", alignItems: "center",
            padding: "7px 14px", border: "1px solid var(--line)", borderRadius: 999,
            background: "var(--surface-1)",
            fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, letterSpacing: "0.01em",
            color: "var(--text)",
          }}
        >
          {crumbSelect}
        </div>
      ) : crumbFixture ? (
        <div style={{ flex: "0 0 auto", alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 9, padding: "7px 13px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-1)", fontFamily: MONO, fontSize: 12, color: "var(--text)" }}>
          {crumbFixture}
        </div>
      ) : null}

      {/* The hero, as an ESPN profile lays one out: who he is on the left,
          his season on the right, and the prop underneath across the full
          width, directly over the chart it is about.

          It was one wrapping row -- avatar, name, then the LINE / IMPLIED /
          MATCHUP strip pushed right with `marginLeft: auto`. The matchup cell
          carries a note ("2026 so far: #9 of 32 after 2 games") that makes
          all three cells wide, so on most screens the strip wrapped, kept its
          right alignment, and left a hole under the avatar. Alex, 2026-09-25:
          *"why is there a gap here?"* -- and, of the same space: *"basic
          season stats are missing, things like yards per game, touchdowns
          per game ... the simple but useful data you see like when you pull
          up their profile on ESPN."*

          Those per-game numbers already existed: every sport page passes them
          as `seasonStats`, and the phone page shows them. This page read
          `player.stats`, a field nothing passes, so the frame's per-game row
          never once rendered. Likewise the identity line read `player.meta`
          -- a rail row's field -- where the pages pass `identity`, which is
          why "Jacksonville Jaguars · quarterback" never appeared beside the
          crest. */}
      <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", rowGap: 14 }}>
        <div style={{ position: "relative", flex: "0 0 auto" }}>
          {renderAvatar ? renderAvatar(player, 104) : null}
        </div>
        {/* No `minWidth` floor: a flex item's own minimum is its content, and
            the name line does not wrap -- so the block can never be squeezed
            narrower than the name, which a fixed 260 let happen, running
            "Trevor Lawrence #16" into the season numbers beside it. When the
            two do not fit, the season block wraps instead. */}
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 11, whiteSpace: "nowrap" }}>
            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 34, letterSpacing: "-0.015em" }}>{player && player.name}</span>
            {player && player.jersey && <span style={{ fontFamily: MONO, fontSize: 22, color: "var(--dim)" }}>{`#${player.jersey}`}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span role="img" style={crest(player && player.team, sport, 15)} />
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--dim)" }}>{player && player.identity}</span>
            {st && <span style={pill(st.dot, "color-mix(in srgb, currentColor 14%, transparent)")}>{st.label}</span>}
          </div>
          {player && player.pills && player.pills.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {player.pills.map((c) => (
                <span key={c.label} style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.06em", padding: "4px 9px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface-1)", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                  {`${c.label} ${c.value}`.toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* The season, per game, over the games the SEASON rail has in scope
            -- and it says which, because a per-game figure without its sample
            is the one thing this app does not print. Counted off the log like
            everything else; not the season *splits*, which are the six-cell
            strip under the graph. */}
        {player && player.seasonStats && player.seasonStats.length > 0 && (
          // Grows to fill its line with the numbers spread across it, beside
          // the name or -- on a narrower screen -- on a line of its own, so
          // neither case leaves the hole this block exists to fill.
          <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 9 }}>
            <span style={cellLabel}>
              {["PER GAME", player.seasonScope && player.seasonScope.label, player.seasonScope && `${player.seasonScope.games} GP`].filter(Boolean).join(" · ")}
            </span>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${player.seasonStats.length}, minmax(0, 1fr))`, columnGap: 18 }}>
              {player.seasonStats.map((g) => (
                <div key={g.label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{g.value}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: "var(--dim)" }}>{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* The prop, across the full width. `minWidth: 0` on every cell, so the
          strip compresses rather than forcing the track wider than it is --
          grid items default to `min-width: auto`, which is what once let
          three cells refuse to compress at all. */}
      {/* MATCHUP takes a wider track: it is the one cell with sentences in
          it, and at equal widths it wrapped to four lines beside four cells
          holding one number each. */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${strip.length - 1}, minmax(0, 1fr)) minmax(0, 1.7fr)`, border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)" }}>
        {strip.map((c, i) => (
          <div key={c.key} style={{ padding: "13px 14px", minWidth: 0, borderRight: i < strip.length - 1 ? "1px solid var(--line)" : "none", display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={cellLabel}>{c.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: c.tone || "var(--text)" }}>{c.value}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: c.subTone || "var(--dim)" }}>{c.sub}</span>
            {c.extra && <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-2)" }}>{c.extra}</span>}
            {c.note && <SeasonNote text={c.note} />}
          </div>
        ))}
      </div>
      </div>

      <div style={{ flex: "0 0 auto", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-2)", padding: "16px 18px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* WINDOW moved here from the left rail, 2026-09-24. Alex: "this
            window and your own might be better off being placed at the top
            of the graph section... i feel like the window and your own being
            on the side is a tiny bit weird" -- Outlier and PropsMadness both
            put their window tabs directly on the chart, and this app's own
            phone build already does the same (a chip row under the tabs)
            while desktop buried it at the bottom of a long rail, under the
            whole market list. Same options, same handlers -- only the
            surface moved. */}
        {windows && windows.options && windows.options.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, rowGap: 8 }}>
            <span style={railLabel}>WINDOW</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {windows.options.map((w) => (
                <div key={w.id} role="button" tabIndex={0} onClick={w.onPick}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); w.onPick(); }
                    else if (w.onRemove && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); w.onRemove(); }
                  }}
                  onMouseEnter={w.onRemove ? () => setHoverWin(w.id) : undefined}
                  onMouseLeave={w.onRemove ? () => setHoverWin(null) : undefined}
                  onFocus={w.onRemove ? () => setHoverWin(w.id) : undefined}
                  onBlur={w.onRemove ? () => setHoverWin(null) : undefined}
                  style={{ ...railPill(w.active), position: "relative" }}>
                  {w.label}
                  {/* Saved windows only, and only on hover or focus: the ×
                      is how a window saved by mistake leaves the bar, and
                      shown on every chip at once it would read as a row of
                      things asking to be closed. */}
                  {w.onRemove && hoverWin === w.id && (
                    <span
                      role="button"
                      aria-label={`Remove saved window ${w.label}`}
                      title={`Remove ${w.label}`}
                      onClick={(e) => { e.stopPropagation(); setHoverWin(null); w.onRemove(); }}
                      style={{
                        position: "absolute", top: -7, right: -7, width: 16, height: 16,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: 5, border: "1px solid var(--line-strong, var(--line))",
                        background: "var(--surface-2)", color: "var(--text-2)",
                        fontFamily: MONO, fontSize: 11, lineHeight: 1, cursor: "pointer",
                      }}
                    >
                      ×
                    </span>
                  )}
                </div>
              ))}
            </div>
            {windows.custom && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)" }}>YOUR OWN</span>
                <div role="button" tabIndex={0} onClick={windows.custom.onDown}
                  onKeyDown={(e) => { if (e.key === "Enter") windows.custom.onDown(); }}
                  style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text-2)", cursor: "pointer" }}>−</div>
                {/* Boxed, because a bare number between two buttons does not
                    look like somewhere to type. */}
                <WindowNumber
                  value={windows.custom.value}
                  min={windows.custom.min}
                  max={windows.custom.max}
                  onType={windows.custom.onType}
                  style={{ minWidth: 46, height: 28, padding: "0 6px", boxSizing: "border-box", border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface-1)" }}
                />

                <div role="button" tabIndex={0} onClick={windows.custom.onUp}
                  onKeyDown={(e) => { if (e.key === "Enter") windows.custom.onUp(); }}
                  style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text-2)", cursor: "pointer" }}>+</div>
                {/* Apply uses it now, Save keeps it on the bar for later --
                    two controls because they are two different intentions. */}
                <div role="button" tabIndex={0} onClick={windows.custom.onApply || windows.custom.onSave}
                  onKeyDown={(e) => { if (e.key === "Enter") (windows.custom.onApply || windows.custom.onSave)(); }}
                  style={{ height: 28, padding: "0 10px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--amber)", borderRadius: 6, background: "var(--amber)", color: "var(--accent-on)", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.06em", cursor: "pointer" }}>
                  APPLY
                </div>
                <div role="button" tabIndex={0} onClick={windows.custom.onSave}
                  onKeyDown={(e) => { if (e.key === "Enter") windows.custom.onSave(); }}
                  style={{ height: 28, padding: "0 10px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--amber)", borderRadius: 6, background: "var(--amber-dim)", color: "var(--amber-ink)", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.06em", cursor: "pointer" }}>
                  SAVE
                </div>
              </div>
            )}
          </div>
        )}
        {/* A column, not a fixed-height box: FormPlot draws the header lane,
            its own 268px plot, and under it the season row when the window
            spans two. The header rides in FormPlot's lane so the hover
            readout can take its place instead of landing on the bars. */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8 }}>
          <FormPlot
            size="desktop"
            games={shown}
            sport={sport}
            line={line}
            marketLine={chart && chart.marketLine}
            isBinary={chart && chart.isBinary}
            direction={(chart && chart.direction) || "over"}
            onDragLine={chart && chart.onDragLine}
            onPickBar={(i) => setPicked(i)}
            picked={picked}
            zoomed={!!zoom}
            onZoom={(from, to) => setZoom(zoom ? [zoom[0] + from, zoom[0] + to] : [from, to])}
            header={
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 14, whiteSpace: "nowrap" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", color: "var(--dim)" }}>
                  {`${String(marketLabel || "").toUpperCase()}`}
                </span>
                {/* Zoomed, the count says what it is a slice of and where. */}
                <span style={{ fontFamily: MONO, fontSize: 11, color: zoom ? "var(--text-2)" : "var(--dim)" }}>
                  {zoom && shown.length
                    ? `${shown.length} OF ${games.length} GAMES · ${String(shown[0].date).toUpperCase()} – ${String(shown[shown.length - 1].date).toUpperCase()}`
                    : `${shown.length} GAMES`}
                </span>
                {zoom && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => setZoom(null)}
                    onKeyDown={(e) => { if (e.key === "Enter") setZoom(null); }}
                    style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", padding: "4px 9px", borderRadius: 6, border: "1px solid var(--amber)", background: "var(--amber-dim)", color: "var(--amber-ink)", cursor: "pointer" }}
                  >
                    RESET ZOOM
                  </span>
                )}
                {/* Zoom had no hint anywhere on the page; the tab did. */}
                <span style={{ marginLeft: "auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>
                  {zoom ? "ESC ZOOMS BACK OUT · DRAG THE TAB TO MOVE THE LINE" : "DRAG ACROSS BARS TO ZOOM · DRAG THE TAB TO MOVE THE LINE"}
                </span>
              </div>
            }
            tooltipFor={(i) => {
              const g = shown[i];
              if (!g) return null;
              // Over/under against the line itself, and coloured by whether
              // it counted -- on an Under view those are different things,
              // and this used to print OVER for every game that cleared one.
              const side = g.v > line ? "OVER" : g.v < line ? "UNDER" : "PUSH";
              return (
                <>
                  {`${String(g.date).toUpperCase()} · ${g.home === false ? "@" : "VS"} ${g.opp} · `}
                  <b style={{ color: hitOf(g.v) ? "var(--pos)" : "var(--neg)" }}>{g.v}</b>
                  {` · ${side}`}
                </>
              );
            }}
            // A drag says what it has caught before it is let go -- the dates,
            // the count and the hit rate -- so the selection is worth making
            // even without the zoom that follows it.
            rangeFor={(lo, hi) => {
              const sel = shown.slice(lo, hi + 1);
              const k = sel.length;
              if (!k) return null;
              const hitN = sel.filter((g) => hitOf(g.v)).length;
              const mean = Math.round((sel.reduce((s, g) => s + g.v, 0) / k) * 10) / 10;
              const dir = chart && chart.direction === "under" ? "UNDER" : "OVER";
              return (
                <>
                  {`${String(sel[0].date).toUpperCase()} – ${String(sel[k - 1].date).toUpperCase()} · ${k} GAMES · `}
                  <b style={{ color: hitN / k >= 0.6 ? "var(--pos)" : "var(--text)" }}>{`${hitN} OF ${k} ${dir} ${line}`}</b>
                  {!(chart && chart.isBinary) && ` · AVG ${mean}`}
                </>
              );
            }}
          />
        </div>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: hits / (shown.length || 1) >= 0.6 ? "var(--pos)" : "var(--text-2)" }}>
          {`${hits} of ${shown.length}`}
        </span>
      </div>

      {/* The frame's six-cell strip. Every cell states its own sample, and
          a cell with too few games behind it says so rather than showing a
          percentage the sample cannot carry. */}
      {/* Every cell, not the first six: with the reader's own window and both
          seasons it can run to seven, and a seventh cut off would be AWAY. The
          reader's own cell is marked in the accent -- the colour of the YOUR
          OWN control it follows -- and says so on hover. */}
      {log && log.splitCells && log.splitCells.length > 0 && (
        <div style={{ flex: "0 0 auto", display: "grid", gridTemplateColumns: `repeat(${log.splitCells.length}, minmax(0, 1fr))`, border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)" }}>
          {log.splitCells.map((c, i) => (
            <div
              key={c.label}
              title={c.own ? "Your own window -- follows the number in YOUR OWN above the chart" : undefined}
              style={{ padding: "12px 14px", minWidth: 0, display: "flex", flexDirection: "column", gap: 3, borderRight: i < log.splitCells.length - 1 ? "1px solid var(--line)" : "none" }}
            >
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: c.own ? "var(--amber-ink)" : "var(--dim)", whiteSpace: "nowrap" }}>{c.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: c.tone || "var(--text)" }}>{c.value}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{c.sub}</span>
            </div>
          ))}
        </div>
      )}

      {/* The alt-line ladder. Every rung is counted over the same games the
          graph is drawing -- never interpolated between two that were -- and a
          rung the sample never split carries no price at all: converting 0% or
          100% only reaches the clamp, which is a display floor dressed as a
          number the games produced. */}
      {rungs.length > 0 && (
        <div ref={ladderRef} style={{ flex: "0 0 auto", border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)", overflow: "hidden" }}>
          <div
            role="button"
            tabIndex={0}
            aria-expanded={ladderOpen}
            onClick={() => setLadderOpen((v) => !v)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLadderOpen((v) => !v); } }}
            style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "14px 18px", background: "var(--surface-2)", borderBottom: ladderOpen ? "1px solid var(--line)" : "none", flexWrap: "wrap", cursor: "pointer" }}
          >
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)", alignSelf: "center" }}>{ladderOpen ? "▾" : "▸"}</span>
            <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16 }}>Alt lines</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>
              {/* Folded, the count of rungs is what says there is something
                  here; open, the games behind them is the caveat that matters. */}
              {ladderOpen
                ? `${rungs[0].gamesCounted} games counted${ladderThin ? " · too few to lean on" : ""}`
                : `${rungs.length} rungs · ${rungs[0].gamesCounted} games counted`}
            </span>
            {/* Read-only, so a pill. */}
            {ladderOpen && <span style={{ marginLeft: "auto", ...pill("var(--dim)", "transparent"), border: "1px solid var(--line)" }}>NO BOOK PRICED THESE</span>}
          </div>
          {ladderOpen && (
          <>
          <div style={{ display: "grid", gridTemplateColumns: ladderWide ? LADDER_COLS : LADDER_COLS_TIGHT, alignItems: "center", padding: ladderWide ? "10px 18px" : "10px 14px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", color: "var(--dim)" }}>
            <span>LINE</span>
            <span style={{ textAlign: "right" }}>HIT RATE</span>
            <span style={{ textAlign: "right" }}>GAMES OVER</span>
            {ladderWide && <span style={{ paddingLeft: 20, minWidth: 0 }}>SHAPE</span>}
            <span style={{ textAlign: "right" }}>PRICE</span>
            {ladderWide && <span />}
          </div>
          {rungs.map((r) => (
            <div
              key={r.line}
              role={onAddLeg ? "button" : undefined}
              tabIndex={onAddLeg ? 0 : undefined}
              onClick={onAddLeg ? () => onAddLeg(r.line) : undefined}
              onKeyDown={onAddLeg ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAddLeg(r.line); } } : undefined}
              style={{
                display: "grid", gridTemplateColumns: ladderWide ? LADDER_COLS : LADDER_COLS_TIGHT, alignItems: "center",
                padding: ladderWide ? "11px 18px" : "11px 14px", borderBottom: "1px solid #20242b",
                cursor: onAddLeg ? "pointer" : "default",
                background: r.isMain ? "var(--surface-2)" : "transparent",
              }}
            >
              {/* Accent-marked rather than pilled once SHAPE is gone: the
                  main line still has to be findable, and the row's own tinted
                  background is easy to miss on a short ladder. */}
              <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: r.isMain ? 700 : 400, color: !ladderWide && r.isMain ? "var(--amber-ink)" : "var(--text)" }}>{r.line}</span>
              <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13.5, fontWeight: 700, color: r.hitRate == null ? "var(--dim)" : r.hitRate >= 0.6 ? "var(--pos)" : r.hitRate <= 0.4 ? "var(--neg)" : "var(--text)" }}>
                {r.hitRate == null ? "—" : `${Math.round(r.hitRate * 100)}%`}
              </span>
              <span style={{ textAlign: "right", fontSize: 12.5, color: "var(--dim)" }}>{`${r.gamesOver} of ${r.gamesCounted}`}</span>
              {ladderWide && (
              <span style={{ paddingLeft: 20, minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                {/* The bar gives ground before the row does. A literal 190px
                    here is what pushed the whole ladder past the card. */}
                <span style={{ display: "flex", height: 6, flex: "1 1 auto", minWidth: 40, maxWidth: 190, background: "var(--surface-2)" }}>
                  <span style={{ width: `${Math.round((r.hitRate || 0) * 100)}%`, background: r.hitRate >= 0.6 ? "var(--pos)" : "var(--text-2)", display: "block" }} />
                </span>
                {r.isMain && <span style={pill("var(--amber-ink)", "var(--amber-dim)")}>MAIN LINE</span>}
              </span>
              )}
              {/* No price on a rung the sample never split -- an em dash says
                  the sample does not price it, rather than overstating it. */}
              <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13.5, color: r.price == null ? "var(--dim)" : "var(--text)" }}>
                {r.price == null ? "—" : formatOdds(r.price)}
              </span>
              {ladderWide && onAddLeg && (
                <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", color: "var(--amber-ink)" }}>+ ADD LEG</span>
              )}
            </div>
          ))}
          </>
          )}
        </div>
      )}

      {distribution && (
        <ValuePlot
          bins={distribution.bins}
          line={line}
          direction={(chart && chart.direction) || "over"}
          label={distribution.label || marketLabel}
        />
      )}

      {extraBlocks}

      {footerNote && <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 10.5, lineHeight: 1.7, color: "var(--dim)" }}>{footerNote}</span>}
    </div>
  );

  // ---- right rail: what contextualises it ---------------------------------
  // The player's own team leads, and is the tab you land on.
  //
  // `own`/`opp` name the fixture's sides, not the reader's -- ownRail is always
  // the away roster -- so opening a home player put his opponent's team first
  // and selected, and his own name was one tab away on his own page. Alex,
  // 2026-09-09: *"when viewing a player, his team should be the top team on the
  // switch player tab."*
  //
  // Found by looking for the active row rather than by comparing team
  // abbreviations, which is the same test the keyboard walk uses and needs no
  // knowledge of how either rail was built.
  const railsBySide = [
    ownRail && { key: "own", rail: ownRail },
    oppRail && { key: "opp", rail: oppRail },
  ].filter(Boolean);
  const subjectKey = (railsBySide.find((r) => ((r.rail.players || []).some((p) => p.active))) || {}).key || null;
  const rails = subjectKey
    ? [...railsBySide].sort((a, b) => (a.key === subjectKey ? -1 : b.key === subjectKey ? 1 : 0))
    : railsBySide;

  // Null means "follow the player". A click sets it, so browsing the other
  // team's roster stays put -- and picking someone from it changes the subject,
  // which clears the override and hands the lead back to his team.
  const [rosterTeam, setRosterTeam] = React.useState(null);
  const [benchOpen, setBenchOpen] = React.useState(false);
  React.useEffect(() => { setRosterTeam(null); }, [subjectKey]);
  const shownTeam = rosterTeam || subjectKey || (rails[0] || {}).key;
  const activeRail = (rails.find((r) => r.key === shownTeam) || rails[0] || {}).rail;

  // No document-level arrow-key walk here, deliberately.
  //
  // One was added on 2026-09-09 -- left/right through the roster, up/down
  // through the markets -- and it takes the arrows away from the thing frame
  // 1a gives them to. The frame's own caption reads "drag across the bars to
  // zoom · hover for a tooltip · ← → step the line", so on this screen the
  // arrows move the line, and the drag handle's onKeyDown is what serves them.
  // A walk that only defers once the handle happens to hold focus means the
  // same key does two different things depending on where you last clicked.
  //
  // The walk is worth having; it needs keys of its own. Parked as B7 in
  // docs/V3_PARKED_CHANGES.md.

  const lineupGroup = (title, scope, cards, note) => (cards && cards.length > 0) && (
    <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={railLabel}>{title}</span>
        {scope && <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{scope}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {cards.map((c) => {
          const on = c.state === "WITH" || c.state === "W/O";
          const fill = c.state === "WITH" ? "var(--pos)" : c.state === "W/O" ? "var(--neg)" : null;
          return (
            <div
              key={c.key}
              role="button"
              tabIndex={0}
              onClick={c.onCycle}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.onCycle && c.onCycle(); } }}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7,
                cursor: "pointer", minHeight: 34,
                background: on ? fill : "var(--surface-1)",
                border: `1px solid ${on ? "transparent" : "var(--line)"}`,
              }}
            >
              {/* Rule 1: a named player travels with their face and their
                  availability. The mock draws an initials circle; PlayerAvatar
                  is the standing substitution for one, and the phone frame has
                  always done this. This rail was the last place on a player
                  page still drawing a bare circle with no status on it. */}
              {renderAvatar ? renderAvatar(c, 22) : (
                <span style={{ width: 22, height: 22, borderRadius: 999, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 9, background: on ? "rgba(0,0,0,0.28)" : "var(--surface-2)", color: on ? "#f4f7fb" : "var(--text-2)" }}>
                  {c.initials}
                </span>
              )}
              <span style={{ flex: "1 1 auto", minWidth: 0, fontSize: 12.5, color: on ? "#f4f7fb" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.name}
              </span>
              {/* Why this row is not what it looks like: IL, optioned, or gone
                  from the roster entirely. Without it a traded player sat here
                  reading exactly like an available one. */}
              {c.badge && (
                <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.06em", padding: "2px 5px", borderRadius: 4, flex: "0 0 auto", whiteSpace: "nowrap", background: on ? "rgba(0,0,0,0.24)" : BADGE_TONE[c.badge.tone].bg, color: on ? "#f4f7fb" : BADGE_TONE[c.badge.tone].fg }}>
                  {c.badge.label}
                </span>
              )}
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", flex: "0 0 auto", color: on ? "#ffffff" : "var(--dim)" }}>{c.state}</span>
              <span style={{ fontFamily: MONO, fontSize: 9.5, flex: "0 0 auto", color: on ? "rgba(255,255,255,0.78)" : "var(--dim)" }}>{c.games}</span>
            </div>
          );
        })}
      </div>
      {note && <span style={railNote}>{note}</span>}
    </div>
  );

  const rightRail = (
    // 124px of floor, not 30, because two buttons float in this corner.
    //
    // "+ ADD TO MY PICKS" sits at bottom: 76 and the app's My Picks launcher
    // at bottom: 20, so between them they own the lowest 115px of this rail --
    // and the rail scrolled to its end still left rows underneath. Scrolled
    // all the way down at 1280px, Brock Rechsteiner's injury row was 77%
    // covered and Audric Estime's 64%: named players, with a status, that no
    // amount of scrolling could reveal. Nothing is silently dropped, and a row
    // parked permanently under a button is dropped.
    <div className="nsb" style={{ borderLeft: "1px solid var(--line)", overflowY: "auto", minHeight: 0, padding: "20px 18px 124px", display: "flex", flexDirection: "column", gap: 22 }}>
      {/* SWITCH PLAYER sits above its tabs, not beside them.
          Side by side with `justify-content: space-between` and a nowrap tab
          row, two full club names — "New Orleans Saints", "Detroit Lions" —
          need about 370px inside a rail whose content box is 231. The row ran
          104px past the rail's edge and the second team was cut in half.
          Stacked, each tab gets the rail's full width and the pair wraps onto
          two lines when one line will not hold them. */}
      {activeRail && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: "var(--dim)", whiteSpace: "nowrap" }}>SWITCH PLAYER</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {rails.map((r) => (
              <div key={r.key} role="button" tabIndex={0} onClick={() => setRosterTeam(r.key)}
                onKeyDown={(e) => { if (e.key === "Enter") setRosterTeam(r.key); }}
                style={{ ...rosterTabStyle(shownTeam === r.key), flex: "1 1 auto", minWidth: 0, justifyContent: "center", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.rail.label}
              </div>
            ))}
          </div>
          {/* Core players, then the rest behind a Bench disclosure.

              Alex, 2026-09-09: *"the player list on the sides for NFL needs to
              be separated by the core players and the bench … create a break
              after Bates and put Bench, and then make it a dropdown."*

              The split is measured rather than guessed, and rather than typed
              into a list that would rot: railMeta gives a player a stat line
              ("QB · 268.5 PASS YDS") only where there is a market and a number
              behind him, and everyone else carries a bare position. On Detroit
              that boundary falls exactly where Alex said it should -- Jake
              Bates is the last man with a stat, Tyler Conklin begins the rest.

              Two guards. With every player on one side of the line there is no
              boundary to draw, so the list renders flat instead of growing a
              control that separates nothing -- which is the case on any sport
              whose rail passes no railMeta. And a subject who is himself on the
              bench forces it open, because a rail that hides the player whose
              page you are reading is worse than an unsplit one. */}
          {(() => {
            const roster = activeRail.players || [];
            // A rail that marks its own rows (`tier`, the NFL depth chart)
            // is split where it says; one that does not, on the stat line.
            const marked = roster.some((p) => p.tier);
            const hasStat = (p) => (marked ? p.tier === "lead" : typeof p.meta === "string" && p.meta.includes("·"));
            const core = roster.filter(hasStat);
            const bench = roster.filter((p) => !hasStat(p));
            const split = core.length > 0 && bench.length > 0;
            const subjectOnBench = split && bench.some((p) => p.active);
            const benchShown = benchOpen || subjectOnBench;
            const rosterRow = (rp) => (
              <div
                key={rp.id}
                role="button"
                tabIndex={0}
                onClick={rp.onSelect}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); rp.onSelect && rp.onSelect(); } }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #20242b", cursor: "pointer" }}
              >
                {/* Two lines, because one could not hold them.

                    The name, the status word and the meta ("QB · 260.5 PASS
                    YDS") all shared a single 268px row, and only the name was
                    allowed to shrink -- so it lost every pixel the other two
                    wanted. Amon-Ra St. Brown rendered as "Amon-R…" beside an
                    immense empty gap, and Sam LaPorta's name disappeared
                    behind his QUEST badge entirely. Alex, 2026-09-09: *"the
                    names aren't even fitting yet there is an immense amount of
                    space to the right … and that mess with LaPorta's name
                    being lost behind questionable, fix that too"*, and
                    *"taller rows are acceptable"*.

                    So the meta drops to its own line under the name, and the
                    name shares the top line with the status pill alone. The
                    ellipsis stays as a last resort for a genuinely long name
                    rather than as the normal case. */}
                <div style={{ position: "relative", flex: "0 0 auto" }}>{rp.avatar}</div>
                <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: rp.active ? "var(--amber-ink)" : "var(--text)", flex: "0 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {rp.name}
                    </span>
                    {rp.statusWord && (
                      <span style={{ ...pill(STATUS[rp.status] ? STATUS[rp.status].dot : "var(--dim)", "color-mix(in srgb, currentColor 14%, transparent)"), flex: "0 0 auto" }}>
                        {STATUS[rp.status] ? STATUS[rp.status].label : rp.statusWord}
                      </span>
                    )}
                  </div>
                  {rp.meta && (
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {rp.meta}
                    </span>
                  )}
                </div>
              </div>
            );
            return (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {(split ? core : roster).map(rosterRow)}
                {split && (
                  <div
                    role="button"
                    tabIndex={subjectOnBench ? -1 : 0}
                    aria-expanded={benchShown}
                    onClick={subjectOnBench ? undefined : () => setBenchOpen((v) => !v)}
                    onKeyDown={(e) => {
                      if (subjectOnBench) return;
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setBenchOpen((v) => !v); }
                    }}
                    title={subjectOnBench ? "Open, because the player on screen is one of them" : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "10px 0",
                      borderBottom: "1px solid #20242b",
                      fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em",
                      color: "var(--dim)",
                      cursor: subjectOnBench ? "default" : "pointer",
                    }}
                  >
                    <span>{`BENCH · ${bench.length}`}</span>
                    <span style={{ marginLeft: "auto" }}>{benchShown ? "▴" : "▾"}</span>
                  </div>
                )}
                {split && benchShown && bench.map(rosterRow)}
              </div>
            );
          })()}
          {activeRail.legend && <span style={railNote}>{activeRail.legend}</span>}
        </div>
      )}

      {lineups && lineupGroup("TEAMMATES", lineups.teamLabel, lineups.mates, lineups.note)}
      {lineups && lineupGroup(`OPPOSING LINEUP${lineups.opps && lineups.opps.length ? ` · ${lineups.opps.length}` : ""}`, lineups.oppLabel, lineups.opps, null)}

      {conditions && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <span style={railLabel}>{`CONDITIONS${conditions.venue ? ` · ${conditions.venue}` : ""}`}</span>

          {/* Why there is no forecast, in the reader's terms -- never a blank
              chip row that reads like a calm night.

              "dome" and "indoor" are the same fact under two names: the NFL
              hook emits `dome` (useNFLKickoffWeather) and the MLB path emits
              `indoor`. This branch used to test only `indoor`, so every NFL
              dome fell through to the generic line and Ford Field sat under
              "Forecast still pending for this game" -- waiting on weather that
              is never coming. The phone has always tested both; this is the
              desktop catching up.

              `retractable` is separated out rather than folded into the dome
              case, because a roof that can open is a real unknown and saying
              "indoors" would be a claim we cannot make. */}
          {conditions.noForecastReason && (
            <span style={{ fontSize: 12, color: "var(--dim)", lineHeight: 1.45 }}>
              {conditions.noForecastReason === "dome" || conditions.noForecastReason === "indoor"
                ? "Played indoors — no weather applies."
                : conditions.noForecastReason === "retractable"
                ? "Retractable roof — no forecast, because whether it is open is not published."
                : conditions.noForecastReason === "horizon"
                ? "Too far out for a forecast — check back closer to kickoff."
                : conditions.noForecastReason === "pregame"
                ? "No forecast published for this game yet."
                : "Forecast still pending for this game."}
            </span>
          )}

          {conditions.weather && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                conditions.weather.temp != null ? `${conditions.weather.temp}°F` : null,
                conditions.weather.wind ? `WIND ${String(conditions.weather.wind).toUpperCase()}` : null,
                conditions.weather.precipPct != null ? `PRECIP ${conditions.weather.precipPct}%` : null,
              ].filter(Boolean).map((w) => (
                <span key={w} style={{ minHeight: 26, display: "flex", alignItems: "center", padding: "0 9px", borderRadius: 999, fontFamily: MONO, fontSize: 10, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text-2)" }}>{w}</span>
              ))}
            </div>
          )}

          {/* Park factors, drawn from a centre line: the bar grows right of
              centre for a park that adds and left for one that takes away,
              so the direction is legible before the number is read. */}
          {conditions.parkFactors && conditions.parkFactors.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
              {conditions.parkFactors.map((b) => {
                const w = Math.min(50, Math.abs(b.value) * 3.2);
                const up = b.value >= 0;
                return (
                  <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid #191c21" }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", color: "var(--text-2)", flex: "0 0 82px" }}>{String(b.label).toUpperCase()}</span>
                    <span style={{ position: "relative", flex: "1 1 auto", height: 7, background: "#191c21", borderRadius: 2, minWidth: 0 }}>
                      <span style={{ position: "absolute", left: "50%", top: -3, bottom: -3, width: 1, background: "var(--line)" }} />
                      <span style={{ position: "absolute", top: 0, bottom: 0, borderRadius: 2, left: up ? "50%" : `${50 - w}%`, width: `${w}%`, background: up ? "var(--pos)" : "var(--neg)" }} />
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, flex: "0 0 40px", textAlign: "right", color: up ? "var(--pos)" : "var(--neg)" }}>
                      {`${up ? "+" : "−"}${Math.abs(b.value)}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {injuryTeams && injuryTeams.length > 0 && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <span style={railLabel}>INJURIES · THIS MATCHUP</span>
          {injuryTeams.map((t) => (
            <div key={t.abbr} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span role="img" style={crest(t.slug || t.abbr, t.sport || sport, 16)} />
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--text-2)" }}>{t.abbr}</span>
                <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
                  {`${t.players.length} LISTED`}
                </span>
              </div>
              {t.players.map((p) => (
                <div key={p.id || p.name} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 30 }}>
                  <span style={{ flex: "1 1 auto", minWidth: 0, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                  {STATUS[p.status] && (
                    <span style={pill(STATUS[p.status].dot, "color-mix(in srgb, currentColor 14%, transparent)")}>{STATUS[p.status].label}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Rule 3: a rail that is not there loses its track, rather than becoming a
  // zero-width column that puts the next one in the wrong place.
  const cols = [leftRail ? "236px" : null, "minmax(0, 1fr)", rightRail ? "268px" : null].filter(Boolean).join(" ");

  return (
    <div
      ref={frameRef}
      style={{
        position: "relative", display: "flex", flexDirection: "column", minHeight: 0,
        height: frameH == null ? "100%" : frameH,
        overflow: "hidden",
        background: "var(--bg)", color: "var(--text)",
      }}
    >
      {nav}
      {crumb}

      <div style={{ flex: "1 1 auto", minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)", gridTemplateColumns: cols }}>
        {leftRail}
        {centre}
        {rightRail}
      </div>

      {/* The bar-detail card. It resolves against the frame because the frame
          is `position: relative` -- rule 4. */}
      {picked != null && shown[picked] && (
        <>
          <div onClick={() => setPicked(null)} style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(5,6,8,0.74)" }} />
          <div style={{ position: "absolute", zIndex: 61, top: 92, left: "50%", transform: "translateX(-50%)", width: 740, maxWidth: "calc(100% - 64px)", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface-1)", boxShadow: "0 24px 60px rgba(0,0,0,0.6)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
              <span role="img" style={crest(shown[picked].opp, sport, 22)} />
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18 }}>
                {`${shown[picked].home === false ? "@ " : "vs "}${shown[picked].opp} · ${shown[picked].date}`}
              </span>
              <span style={pill(hitOf(shown[picked].v) ? "var(--pos)" : "var(--neg)", hitOf(shown[picked].v) ? "var(--pos-dim)" : "var(--neg-dim)")}>
                {hitOf(shown[picked].v) ? "OVER" : "UNDER"}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={() => setPicked(null)}
                onKeyDown={(e) => { if (e.key === "Enter") setPicked(null); }}
                style={{ marginLeft: "auto", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text-2)", fontSize: 17, cursor: "pointer" }}
              >
                ×
              </span>
            </div>
            <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 22 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={cellLabel}>{String(marketLabel || "").toUpperCase()}</span>
                  <span style={{ fontFamily: MONO, fontSize: 34, fontWeight: 700, lineHeight: 1 }}>{shown[picked].v}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={cellLabel}>LINE</span>
                  <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{line}</span>
                </div>
              </div>

              {/* That night's own stat line, read straight off the logged
                  game. Only markets the log actually recorded appear -- a
                  market this sport does not carry is absent, not zero. */}
              {cardBox.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={cellLabel}>BOX SCORE</span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                    {cardBox.map((b) => (
                      <div key={b.label} style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-2)", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", color: "var(--dim)" }}>{b.label}</span>
                        <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700 }}>{b.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* The circumstances of that night. Every row is measured --
                  rest from the logged dates, the two absence rows from the
                  same participation record the teammate filter reads. A row
                  whose fact this sport does not record is not printed. */}
              {cardNotes.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                  <span style={cellLabel}>THAT NIGHT</span>
                  {cardNotes.map((n) => (
                    <div key={n.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0", borderBottom: "1px solid #20242b" }}>
                      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: "var(--dim)", flex: "0 0 150px" }}>{n.label}</span>
                      <span style={{ flex: "1 1 auto", minWidth: 0, fontSize: 12.5, color: "var(--text-2)" }}>{n.value}</span>
                    </div>
                  ))}
                  {cardNotes.some((n) => n.label.includes("DID NOT PLAY")) && (
                    <span style={{ fontSize: 11, lineHeight: 1.45, color: "var(--dim)", paddingTop: 6 }}>
                      Read against today's rosters. A name here was not in this game's box score — which can mean rested, injured, or not yet on the team.
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {onAddPick && (
        // Above the My Picks launcher, not on top of it. That button is
        // `position: fixed; bottom: 20; right: 20` at the app root (see
        // PropLedger) and stands about 44px tall, so this one at `bottom: 22`
        // was landing across it — two controls occupying the same corner,
        // with the wrong one on top. Stacked, they read as what they are: add
        // this prop, then open the slip.
        <div style={{ position: "absolute", right: 26, bottom: 76, zIndex: 30 }}>
          <span
            role="button"
            tabIndex={0}
            onClick={onAddPick}
            onKeyDown={(e) => { if (e.key === "Enter") onAddPick(); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 8,
              cursor: "pointer", fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em",
              border: `1px solid ${pickAdded ? "var(--line)" : "var(--amber)"}`,
              background: pickAdded ? "var(--surface-2)" : "var(--amber)",
              color: pickAdded ? "var(--text-2)" : "var(--accent-on)",
              boxShadow: "0 8px 22px rgba(0,0,0,0.45)",
            }}
          >
            {pickAdded ? "✓ ON MY PICKS" : "+ ADD TO MY PICKS"}
          </span>
        </div>
      )}
    </div>
  );
}
