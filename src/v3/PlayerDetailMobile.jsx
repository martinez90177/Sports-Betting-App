import React from "react";
import FormPlot, { PLOT, crest } from "./FormPlot.jsx";
import { probToAmericanOdds, formatOdds } from "../odds.js";
import { STATUS } from "../lib/teamColors.js";

// A transcription of frame `1c` in `v3 Mocks/PropPalace Mobile v3.dc.html`.
//
// Not an interpretation of it. Every element, order, size, weight, colour,
// padding and gap below is what that file draws: `sc-for` became `.map()`,
// `sc-if` became `&&`, and each `{{ token }}` became a real value off the same
// props the four sport pages already build for PlayerDetailV2.
//
// Three substitutions, all of them established on this project rather than
// invented here:
//
//   * hex -> the token that already resolves to it, so the light theme and the
//     Settings accent wheel keep working. The mock is a static file and cannot
//     express a variable; freezing #3b5bdb would strand every accent the user
//     can pick. The map is the one PlayerDetailV2.jsx documents.
//   * the mock's lettered crests -> the real ESPN crest, drawn as a
//     background-image so no hole ever lands in an `src` attribute.
//   * its initials circles -> PlayerAvatar, via `renderAvatar`, which carries
//     availability with it.
//
// What the mock draws that is NOT built: the iOS status bar (`9:41`,
// `▮▮▮ ᯤ 82%`). That is the phone the frame is drawn inside, not the app.
//
// Two places the mock draws one state of several. Its subject is a mid-tier
// matchup and an outdoor park, so only those are on the page. The drawn state
// is reproduced exactly; the undrawn ones follow the app's existing pattern,
// per the bundle README's "what to do when the mock is silent".

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
// The plot box the mock draws on this screen. Its geometry, and the graph
// itself, live in FormPlot.jsx -- one component for this screen and the feed.
const PLOT_H = PLOT.player.plotH;
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";


// Repeated exactly as the file writes them.
const microLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)" };
const sectionLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };
const sheetNote = { fontSize: 12, color: "var(--dim)" };
const footNote = { fontSize: 12, lineHeight: 1.45, color: "var(--dim)" };

function pill(sel, extra) {
  return Object.assign({
    minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "0 12px", borderRadius: 8, fontFamily: MONO, fontSize: 13,
    letterSpacing: "0.04em", cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${sel ? "var(--amber)" : "var(--line)"}`,
    background: sel ? "var(--amber-dim)" : "var(--surface-1)",
    color: sel ? "var(--amber-ink)" : "var(--text-2)",
  }, extra || {});
}

function chip(sel) {
  return {
    minHeight: 40, display: "flex", alignItems: "center", padding: "0 14px",
    borderRadius: 8, fontFamily: MONO, fontSize: 12, whiteSpace: "nowrap",
    cursor: "pointer", border: `1px solid ${sel ? "var(--amber)" : "var(--line)"}`,
    background: sel ? "var(--amber-dim)" : "var(--surface-1)",
    color: sel ? "var(--amber-ink)" : "var(--text)",
  };
}

// Mono's at-sign is unreadable at 11px and reads as a lowercase a -- there is
// a font-level fix in the app ('PP At'), and the mock reaches for Archivo for
// the same reason. Kept as the mock draws it.
const atStyle = {
  fontFamily: "'Archivo', system-ui, sans-serif", fontSize: 12, fontWeight: 700,
  color: "var(--amber-ink)", padding: "0 5px", letterSpacing: 0,
};
const atStyleLg = { ...atStyle, fontSize: 14, padding: "0 6px" };

const resultPill = (over) => ({
  fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", padding: "4px 8px",
  borderRadius: 999, flex: "0 0 auto",
  background: over ? "var(--pos-dim)" : "var(--neg-dim)",
  color: over ? "var(--pos)" : "var(--neg)",
});

const START_WORD = { mlb: "FIRST PITCH", nfl: "KICKOFF", nba: "TIP-OFF", wnba: "TIP-OFF" };

const titleCase = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : s);

const fmtRate = (hits, n) => (n ? `${Math.round((hits / n) * 100)}%` : "—");

// The tone the mock uses on a rate figure. Its own thresholds, kept.
const rateTone = (p) => (p >= 0.7 ? "var(--pos)" : p >= 0.55 ? "var(--status-questionable)" : "var(--text-2)");

// One With/Without card, as frame 1c's `card()` builds it.
//
// Three states cycling on tap -- neutral, WITH, W/O -- and the word is
// printed as well as coloured, which is what lets the outcome green and red
// legitimately leave the graph here: they mean include and exclude, and the
// colour is never the only carrier.
//
// `games` is that card's own count, not the combined one. The mock is
// explicit about it -- "each card counts its own filter alone, so the number
// under it answers 'how many games does this one leave'" -- and the combined
// figure is the sentence under the grids.
function LineupCard({ c, renderAvatar }) {
  const on = c.state === "WITH" || c.state === "W/O";
  const fill = c.state === "WITH" ? "var(--pos)" : c.state === "W/O" ? "var(--neg)" : null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={c.onCycle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.onCycle && c.onCycle(); } }}
      title={c.state === "ANY" ? `Only the games ${c.name} played` : c.state === "WITH" ? `Only the games ${c.name} missed` : "Clear"}
      style={{
        display: "flex", flexDirection: "column", gap: 8, padding: 12,
        borderRadius: 10, cursor: "pointer", minHeight: 44, minWidth: 0,
        background: on ? fill : "var(--surface-1)",
        border: `1px solid ${on ? "transparent" : "var(--line)"}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {/* Rule 1: a named player travels with their face and their
            availability. The mock draws an initials circle; this is the
            standing substitution for one. */}
        {renderAvatar ? renderAvatar(c, 32) : (
          <span style={{ width: 32, height: 32, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 11, background: on ? "rgba(0,0,0,0.28)" : "var(--surface-2)", color: on ? "#f4f7fb" : "var(--text-2)" }}>
            {c.initials}
          </span>
        )}
        {/* The word beside the dot, for the two states that are a reason not
            to count on someone. Colour follows the status itself. */}
        {c.status === "out" || c.status === "questionable" ? (
          <span
            style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", padding: "3px 6px",
              borderRadius: 999, flex: "0 0 auto",
              background: c.status === "out" ? "rgba(239,91,91,0.22)" : "rgba(232,177,58,0.22)",
              color: c.status === "out" ? "#ffb4b4" : "#f3d79a",
            }}
          >
            {c.status === "out" ? "OUT" : "QUEST"}
          </span>
        ) : null}
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: on ? "#f4f7fb" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {c.name}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: on ? "#ffffff" : "var(--dim)" }}>
          {c.state}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: on ? "rgba(255,255,255,0.78)" : "var(--dim)" }}>
          {c.games}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------
export default function PlayerDetailMobile({
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
  // v3 additions the mock's own regions need and the existing contract has no
  // slot for. Each is optional: without one the region it feeds degrades to
  // what the app can honestly say, never to a placeholder.
  slate = null,          // { label, games: [{ id, away, home, time, active, onPick }] }
  slipCount = null,      // the PICKS chip's count -- one array, read not re-derived
  onOpenSlip = null,
  availability = null,   // "active" | "questionable" | "out"
  renderAvatar = null,   // (person, size) => node
  seasons = null,        // [{ id, label, active, onPick }]
  windows = null,        // { options: [{ id, label, active, onPick }], custom, onCustom }
  splits = null,         // [{ id, label, active, onPick }]
  injuryTeams = null,    // [{ abbr, slug, sport, players: [{ id, name, note, status, effect }] }]
  // Does this league publish an availability feed at all? All four do, off
  // ESPN's per-team roster response -- but the flag stays, because "this
  // league is not covered" and "nobody is listed tonight" are different
  // sentences and a page that confuses them says something untrue.
  availabilityCovered = false,
  news = null,           // [{ id, when, headline }]
  // The With/Without control, frame 1c's `pdShowLineups` section. Null on a
  // page that cannot answer who else played -- the chip does not appear at
  // all rather than opening a sheet with nothing in it.
  //
  // { teamLabel, oppLabel, mates: [card], opps: [card], note, noteTone,
  //   activeCount, onReset }
  // card: { key, name, initials, status, state, games, onCycle, avatarNode }
  lineups = null,
  // Frame 1c's `pdBlocks`: four { label, value, note } cells. Passed in
  // because what belongs in them is the page's own -- MLB draws SEASON /
  // VS RHP / PARK / ORDER, and a sport with no probable starter or batting
  // order names its own four. Without them the grid falls back to what the
  // v2 contract already carried, so an unwired page still renders.
  blocks = null,
}) {
  const [tab, setTab] = React.useState("Form");
  const [gameMenu, setGameMenu] = React.useState(false);
  const [sheet, setSheet] = React.useState(null);
  const [barSel, setBarSel] = React.useState(null);
  const [parkOpen, setParkOpen] = React.useState(false);
  const [rosterTeam, setRosterTeam] = React.useState("own");

  const games = (chart && chart.games) || [];
  const line = chart ? chart.line : null;

  // Every rate, caption and cell on this page describes the same array graded
  // against the same line. Nothing below is authored twice.
  const hitOf = React.useCallback(
    (v) => (chart && chart.direction === "under" ? v < line : v > line),
    [chart, line]
  );
  const hits = games.filter((g) => hitOf(g.v)).length;

  const closeSheet = () => setSheet(null);
  const pickAndClose = (fn) => () => { fn(); setSheet(null); };

  const st = availability ? STATUS[availability] : null;

  // ---- header ------------------------------------------------------------
  const awayAbbr = band && band.away ? band.away.abbr : null;
  const homeAbbr = band && band.home ? band.home.abbr : null;
  const slateGames = (slate && slate.games) || [];

  const header = (
    <div style={{ flex: "0 0 auto", zIndex: 30, background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "0 12px" }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onBack}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack && onBack(); } }}
          style={{
            minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", gap: 6, padding: "0 8px",
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--amber-ink)",
            whiteSpace: "nowrap", cursor: "pointer",
          }}
        >
          ← FEED
        </span>
        <div
          onClick={slateGames.length ? () => setGameMenu((v) => !v) : undefined}
          style={{
            flex: "1 1 auto", minWidth: 0, minHeight: 44, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 6, overflow: "hidden",
            cursor: slateGames.length ? "pointer" : "default",
          }}
        >
          <span role="img" aria-label={awayAbbr || ""} style={crest(awayAbbr, sport, 18)} />
          <span style={{ flex: "0 1 auto", minWidth: 0, display: "flex", alignItems: "baseline", whiteSpace: "nowrap", overflow: "hidden" }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text)" }}>{awayAbbr}</span>
            <span style={atStyle}>@</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text)" }}>{homeAbbr}</span>
          </span>
          <span role="img" aria-label={homeAbbr || ""} style={crest(homeAbbr, sport, 18)} />
          {/* No caret where there is no slate to open: a control that opens
              nothing is worse than no control. */}
          {slateGames.length > 0 && (
            <span style={{ color: "var(--dim)", fontSize: 12, display: "inline-block", flex: "0 0 auto" }}>▾</span>
          )}
        </div>
        {slipCount != null && (
          // The mock draws this as static type, because a static mock has
          // nowhere to route. It is the app's only way onto the slip from
          // this page (the floating pill steps aside for the roster dock --
          // see MyPicksPanel's hideTrigger), so it gets the routing the app
          // already has.
          <span
            role={onOpenSlip ? "button" : undefined}
            tabIndex={onOpenSlip ? 0 : undefined}
            onClick={onOpenSlip}
            onKeyDown={onOpenSlip ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenSlip(); } } : undefined}
            style={{
              minHeight: 44, display: "flex", alignItems: "center", gap: 6, padding: "0 11px",
              borderRadius: 8, border: "1px solid var(--amber)", color: "var(--amber-ink)",
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", whiteSpace: "nowrap",
              cursor: onOpenSlip ? "pointer" : "default",
            }}
          >
            PICKS
            <span
              style={{
                minWidth: 17, height: 17, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 4, background: "var(--amber)", color: "#ffffff", fontSize: 10, fontWeight: 700,
              }}
            >
              {slipCount}
            </span>
          </span>
        )}
        <span
          role="button"
          tabIndex={0}
          onClick={onWatch}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWatch && onWatch(); } }}
          style={{
            minHeight: 44, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 8,
            border: "1px solid var(--amber)", color: "var(--amber-ink)", fontFamily: MONO, fontSize: 11,
            letterSpacing: "0.1em", whiteSpace: "nowrap", cursor: "pointer",
          }}
        >
          {watching ? "WATCHING" : "+ WATCH"}
        </span>
      </div>
    </div>
  );

  // ---- the game menu -----------------------------------------------------
  const gameMenuNode = gameMenu && slateGames.length > 0 && (
    <>
      <div
        onClick={() => setGameMenu(false)}
        style={{ position: "absolute", top: 49, left: 0, right: 0, bottom: 0, zIndex: 34, background: "rgba(5,6,8,0.72)" }}
      />
      <div
        style={{
          position: "absolute", top: 49, left: 0, right: 0, zIndex: 35, background: "var(--surface-sunken)",
          borderBottom: "1px solid var(--line)", boxShadow: "0 14px 30px rgba(0,0,0,0.55)",
          maxHeight: "60%", overflowY: "auto",
        }}
      >
        <div style={{ padding: "11px 16px 9px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={sectionLabel}>TONIGHT'S SLATE</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
            {`${String(sport || "").toUpperCase()} · ${slateGames.length} ${slateGames.length === 1 ? "GAME" : "GAMES"}`}
          </span>
        </div>
        {slateGames.map((gm) => (
          <div
            key={gm.id}
            onClick={() => { gm.onPick && gm.onPick(); setGameMenu(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "0 16px", minHeight: 52, cursor: "pointer",
              borderTop: "1px solid #20242b",
              borderLeft: `3px solid ${gm.active ? "var(--amber)" : "transparent"}`,
              background: gm.active ? "var(--surface-2)" : "transparent",
            }}
          >
            <span role="img" aria-label="Away" style={crest(gm.away, sport, 22)} />
            <span style={{ flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "baseline", whiteSpace: "nowrap" }}>
              <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--text)" }}>{gm.away}</span>
              <span style={atStyleLg}>@</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--text)" }}>{gm.home}</span>
            </span>
            <span role="img" aria-label="Home" style={crest(gm.home, sport, 22)} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)", flex: "0 0 auto" }}>{gm.time}</span>
          </div>
        ))}
      </div>
    </>
  );

  // ---- hero --------------------------------------------------------------
  const hero = (
    <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", gap: 13 }}>
      <div style={{ position: "relative", flex: "0 0 auto" }}>
        {renderAvatar ? renderAvatar(player, 56) : player.avatar}
      </div>
      <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 24, letterSpacing: "-0.01em", overflowWrap: "break-word" }}>
            {player.name}
          </span>
          {player.jersey != null && player.jersey !== "" && (
            <span style={{ fontFamily: MONO, fontSize: 18, color: "var(--dim)" }}>#{player.jersey}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <span role="img" aria-label={player.team || ""} style={crest(player.team, sport, 20)} />
          <span
            style={{
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--dim)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {player.identity}
          </span>
        </div>
      </div>
    </div>
  );

  // ---- LINE / IMPLIED / MATCHUP -----------------------------------------
  // Implied is the window's own rate as American odds, through the same
  // conversion odds.js uses. Never a book's number -- there is no odds feed.
  const impliedText = games.length ? formatOdds(probToAmericanOdds(hits / games.length)) : "—";
  // "#22 of 30" arrives as one string; the mock splits the rank from its
  // denominator. Split rather than re-derived so the two cannot disagree.
  const rankParts = String((context && context.rank) || "").split(" of ");
  const rankWord = context && context.rankWord ? String(context.rankWord).toUpperCase() : null;

  const threeCell = (
    <div
      style={{
        margin: "0 16px 14px", border: "1px solid var(--line)", borderRadius: 12,
        background: "var(--surface-1)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      }}
    >
      <div style={{ padding: "11px 12px", display: "flex", flexDirection: "column", gap: 3, borderRight: "1px solid var(--line)" }}>
        <span style={microLabel}>LINE</span>
        <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700 }}>{verdict ? verdict.line : "—"}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{String(marketLabel || "").toUpperCase()}</span>
      </div>
      <div style={{ padding: "11px 12px", display: "flex", flexDirection: "column", gap: 3, borderRight: "1px solid var(--line)" }}>
        <span style={microLabel}>IMPLIED</span>
        <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700 }}>{impliedText}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
          {games.length ? `FROM ${games.length} GAMES` : "NO GAMES IN WINDOW"}
        </span>
      </div>
      <div style={{ padding: "11px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={microLabel}>MATCHUP</span>
        {/* One colour for every ranked matchup, as the mock draws it -- the
            tier word underneath is what says soft, mid or tough.
            Deliberately NOT the app's `rankColor`, which returns --pos for a
            soft matchup and --neg for a tough one: green and red mean cleared
            and missed on this page, and a defence tier painted green reads as
            an outcome. Raised with Alex: the mock only draws the mid state,
            so this is the drawn state applied to all three rather than two
            invented ones. An unranked matchup takes --dim, because "we could
            not rank this" must not read as a finding either. */}
        <span
          style={{
            fontFamily: MONO, fontSize: 20, fontWeight: 700,
            color: rankParts[0] ? "var(--status-questionable)" : "var(--dim)",
          }}
        >
          {rankParts[0] || "—"}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: "#5c6b7a" }}>
          {[rankParts[1] ? `OF ${rankParts[1]}` : null, rankWord].filter(Boolean).join(" · ") || "NOT RANKED"}
        </span>
      </div>
    </div>
  );

  // ---- tabs + control chips ---------------------------------------------
  const tabs = ["Form", "Matchup", "Log", "Injuries", "News"];
  const activeSeason = (seasons || []).find((s) => s.active);
  const activeWindow = ((windows && windows.options) || []).find((w) => w.active);
  const activeSplit = (splits || []).find((s) => s.active);
  const activeMarket = markets.find((m) => m.active);

  const controlBar = (
    <div
      style={{
        position: "sticky", top: 0, zIndex: 20, background: "var(--bg)",
        borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
      }}
    >
      <div className="nsb" style={{ display: "flex", overflowX: "auto" }}>
        {tabs.map((label) => (
          <div
            key={label}
            onClick={() => setTab(label)}
            style={{
              flex: "1 1 0", minWidth: 0, minHeight: 48, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer", fontFamily: MONO, fontSize: 11,
              letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
              color: tab === label ? "var(--amber-ink)" : "var(--dim)",
              borderBottom: `2px solid ${tab === label ? "var(--amber)" : "transparent"}`,
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div
        className="nsb"
        style={{ display: "flex", gap: 8, padding: "9px 16px", overflowX: "auto", borderTop: "1px solid #20242b" }}
      >
        <div onClick={() => setSheet("market")} style={chip(true)}>
          {(activeMarket && activeMarket.label) || marketLabel} ▾
        </div>
        {seasons && seasons.length > 1 && (
          <div onClick={() => setSheet("season")} style={chip(activeSeason ? !seasons[0].active : false)}>
            {(activeSeason && activeSeason.label) || "Season"} ▾
          </div>
        )}
        {windows && (
          <div onClick={() => setSheet("window")} style={chip(false)}>
            {(activeWindow && activeWindow.label) || "Window"} ▾
          </div>
        )}
        {splits && splits.length > 0 && (
          <div onClick={() => setSheet("splits")} style={chip(!!activeSplit && !splits[0].active)}>
            {(activeSplit && !splits[0].active ? activeSplit.label : "Splits")} ▾
          </div>
        )}
        {/* Only where the page can actually answer it. A chip that opens an
            empty sheet is worse than no chip. */}
        {lineups && (
          <div onClick={() => { if (lineups.onOpen) lineups.onOpen(); setSheet("lineups"); }} style={chip(lineups.activeCount > 0)}>
            {(lineups.activeCount ? `Lineups · ${lineups.activeCount}` : "Lineups")} ▾
          </div>
        )}
        <div
          onClick={() => { if (lineups && lineups.onOpen) lineups.onOpen(); setSheet("all"); }}
          style={{
            minHeight: 40, display: "flex", alignItems: "center", gap: 7, padding: "0 14px",
            borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-1)",
            color: "var(--text-2)", fontFamily: MONO, fontSize: 12, whiteSpace: "nowrap", cursor: "pointer",
          }}
        >
          ALL FILTERS
        </div>
      </div>
    </div>
  );

  // ---- Form --------------------------------------------------------------
  const picked = barSel != null && games[barSel] ? games[barSel] : null;

  // The strip reads the *season* log, not the window -- otherwise the third
  // cell restates the second whenever the window happens to be L10, which is
  // the default on three of four sports. Same array, same line, three depths.
  const seasonGames = (log && log.rows) || [];
  const splitCells = [
    { key: "l5", label: "LAST 5", games: seasonGames.slice(-5), edge: true },
    { key: "l10", label: "LAST 10", games: seasonGames.slice(-10), edge: true },
    { key: "season", label: "SEASON", games: seasonGames, edge: false },
  ].map((s) => {
    const h = s.games.filter((g) => hitOf(g.v)).length;
    const p = s.games.length ? h / s.games.length : 0;
    return { ...s, value: fmtRate(h, s.games.length), sub: `${h}/${s.games.length}`, tone: rateTone(p) };
  });

  const straight = (() => {
    let run = 0;
    for (let i = games.length - 1; i >= 0; i--) { if (hitOf(games[i].v)) run++; else break; }
    return run;
  })();

  const formBody = (
    <div style={{ padding: "16px 16px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-sunken)",
          padding: "13px 13px 12px", display: "flex", flexDirection: "column", gap: 11,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <span style={{ ...sectionLabel, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[String(marketLabel || "").toUpperCase(), activeSeason && activeSeason.label, activeWindow && String(activeWindow.label).toUpperCase()]
              .filter(Boolean).join(" · ")}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap", flex: "0 0 auto" }}>
            DRAG THE TAB TO MOVE THE LINE
          </span>
        </div>
        {games.length > 0 ? (
          <FormPlot
            games={games}
            sport={sport}
            line={line}
            marketLine={chart.marketLine}
            isBinary={chart.isBinary}
            direction={chart.direction}
            onDragLine={chart.onDragLine}
            onPickBar={(i) => setBarSel(barSel === i ? null : i)}
            picked={barSel}
          />
        ) : (
          <div
            style={{
              height: PLOT_H, display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px dashed var(--line)", borderRadius: 8, fontFamily: MONO, fontSize: 11.5,
              color: "var(--dim)", textAlign: "center", padding: "0 16px",
            }}
          >
            No finished games in this window.
          </div>
        )}
        <span
          style={{
            fontFamily: MONO, fontSize: 11,
            color: games.length && hits / games.length >= 0.6 ? "var(--pos)" : "var(--status-questionable)",
          }}
        >
          {games.length ? `${hits} of ${games.length} · ${straight} straight` : "no sample"}
        </span>

        {picked && (
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 11, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span role="img" style={crest(picked.opp, sport, 20)} />
              <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--text)" }}>
                {`${picked.date} · ${picked.home === false ? "@ " : "vs "}${String(picked.opp || "").toUpperCase()}`}
              </span>
              <span style={resultPill(hitOf(picked.v))}>{hitOf(picked.v) ? "OVER" : "UNDER"}</span>
              <span
                onClick={() => setBarSel(null)}
                style={{
                  marginLeft: "auto", width: 32, height: 32, display: "flex", alignItems: "center",
                  justifyContent: "center", color: "var(--dim)", fontSize: 16, cursor: "pointer",
                }}
              >
                ×
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {[
                { key: "v", label: String(marketLabel || "").slice(0, 4).toUpperCase(), value: String(picked.v) },
                { key: "line", label: "LINE", value: String(line) },
                { key: "margin", label: "MARGIN", value: `${picked.v - line >= 0 ? "+" : ""}${(picked.v - line).toFixed(1)}` },
                { key: "site", label: "SITE", value: picked.home === false ? "Away" : "Home" },
              ].map((c) => (
                <div
                  key={c.key}
                  style={{
                    border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-1)",
                    padding: "8px 9px", display: "flex", flexDirection: "column", gap: 2,
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "var(--dim)" }}>{c.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700 }}>{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)",
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        }}
      >
        {splitCells.map((s) => (
          <div
            key={s.key}
            style={{
              padding: "10px 11px", display: "flex", flexDirection: "column", gap: 2,
              borderRight: s.edge ? "1px solid var(--line)" : "none",
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: "var(--dim)" }}>{s.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: s.tone }}>{s.value}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "#5c6b7a" }}>{s.sub}</span>
          </div>
        ))}
      </div>

      {player.seasonStats && player.seasonStats.length > 0 && (
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            padding: "10px 4px", borderTop: "1px solid #20242b", borderBottom: "1px solid #20242b",
          }}
        >
          {player.seasonStats.map((g) => (
            <div key={g.label} style={{ flex: "1 1 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700 }}>{g.value}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "var(--dim)" }}>{g.label}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {st && (
          <span
            style={{
              minHeight: 28, display: "flex", alignItems: "center", padding: "0 10px", borderRadius: 7,
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.04em",
              border: `1px solid ${st.dot}`, color: st.dot,
              background: "color-mix(in srgb, currentColor 10%, transparent)",
            }}
          >
            {st.label}
          </span>
        )}
        {(player.pills || []).map((p) => (
          <span
            key={p.label}
            style={{
              minHeight: 28, display: "flex", alignItems: "center", padding: "0 10px", borderRadius: 7,
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.04em",
              border: "1px solid var(--line)", color: "var(--text-2)", background: "var(--surface-1)",
            }}
          >
            {`${p.label} ${p.value}${p.note ? ` · ${p.note}` : ""}`.toUpperCase()}
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {(blocks || [
          verdict && { key: "avg", label: "AVERAGE", value: verdict.average, note: `${String(marketLabel || "").toLowerCase()} per game, ${games.length} games counted` },
          verdict && { key: "margin", label: "MARGIN", value: verdict.margin, note: "average against the line on the graph" },
          context && context.lastMeeting && { key: "last", label: "LAST MEETING", value: context.lastMeeting, note: `most recent game against ${context.allowsLabel ? String(context.allowsLabel).split(" ")[0] : "this opponent"}` },
          // The note only ever adds something. MLB's `park` cell already
          // carries the venue name, so repeating it underneath would be the
          // same fact stated twice -- which is the bug class this page's
          // handoff spends most of its length on.
          context && context.park && {
            key: "park",
            label: String(context.parkLabel || "").toUpperCase(),
            value: context.park,
            note: band && band.venue && !String(context.park).includes(band.venue) ? band.venue : "",
          },
        ]).filter(Boolean).map((bl) => (
          <div
            key={bl.key}
            style={{
              border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)",
              padding: 13, display: "flex", flexDirection: "column", gap: 5,
            }}
          >
            <span style={microLabel}>{bl.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700 }}>{bl.value}</span>
            <span style={{ fontSize: 12, color: "var(--dim)", lineHeight: 1.35 }}>{bl.note}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ---- Matchup -----------------------------------------------------------
  const weather = conditions && conditions.weather ? conditions.weather : null;
  const weatherChips = weather
    ? [
        weather.temp != null ? `${weather.temp}°F` : null,
        weather.wind ? `WIND ${String(weather.wind).toUpperCase()}` : null,
        weather.sky ? String(weather.sky).toUpperCase() : null,
        weather.precipPct != null ? `PRECIP ${weather.precipPct}%` : null,
        weather.humidityPct != null ? `HUMIDITY ${weather.humidityPct}%` : null,
      ].filter(Boolean)
    : [];
  const parkRows = (conditions && conditions.park && conditions.park.rows) || [];

  const matchupBody = (
    <div style={{ padding: "16px 0 26px", display: "flex", flexDirection: "column", gap: 12 }}>
      {conditions && (
        <div style={{ margin: "0 16px 2px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-sunken)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 13px 10px" }}>
            <span style={{ ...sectionLabel, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {`CONDITIONS${band && band.venue ? ` · ${String(band.venue).toUpperCase()}` : ""}`}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", flex: "0 0 auto" }}>
              {weather ? "OPEN AIR" : "INDOORS"}
            </span>
          </div>
          {weatherChips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 13px 12px" }}>
              {weatherChips.map((label) => (
                <span
                  key={label}
                  style={{
                    minHeight: 26, display: "flex", alignItems: "center", padding: "0 9px", borderRadius: 999,
                    fontFamily: MONO, fontSize: 10, letterSpacing: "0.04em", border: "1px solid var(--line)",
                    background: "var(--surface-2)", color: "var(--text-2)",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}
          {/* Indoors: say so and draw nothing. */}
          {!weather && (
            <div style={{ padding: "0 13px 13px", ...footNote }}>
              {conditions.noForecastReason === "dome" || conditions.noForecastReason === "indoor"
                ? "Played indoors, so there is nothing to forecast."
                : "No forecast for this game yet."}
            </div>
          )}
          {parkRows.length > 0 && (
            <>
              <div
                onClick={() => setParkOpen((v) => !v)}
                style={{
                  borderTop: "1px solid var(--line)", minHeight: 48, padding: "0 13px", display: "flex",
                  alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer",
                }}
              >
                <span style={sectionLabel}>PARK + AIR EFFECT</span>
                <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>VS LEAGUE AVG</span>
                  <span
                    style={{
                      color: "var(--dim)", fontSize: 18, display: "inline-block",
                      transform: parkOpen ? "rotate(90deg)" : "none", transition: "transform 140ms",
                    }}
                  >
                    ›
                  </span>
                </span>
              </div>
              {parkOpen && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", padding: "0 13px 12px" }}>
                    {parkRows.map((br) => {
                      const up = br.pct >= 0;
                      const w = Math.min(50, Math.abs(br.pct) * 3.2);
                      return (
                        <div key={br.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--surface-2)" }}>
                          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "var(--text-2)", flex: "0 0 96px" }}>
                            {String(br.label).toUpperCase()}
                          </span>
                          <span style={{ position: "relative", flex: "1 1 auto", height: 8, background: "var(--surface-2)", borderRadius: 2, minWidth: 0 }}>
                            <span style={{ position: "absolute", left: "50%", top: -3, bottom: -3, width: 1, background: "var(--line)" }} />
                            <span
                              style={{
                                position: "absolute", top: 0, bottom: 0, borderRadius: 2,
                                left: up ? "50%" : `${50 - w}%`, width: `${w}%`,
                                background: up ? "var(--pos)" : "var(--neg)",
                              }}
                            />
                          </span>
                          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, flex: "0 0 42px", textAlign: "right", color: up ? "var(--pos)" : "var(--neg)" }}>
                            {`${up ? "+" : "−"}${Math.abs(br.pct)}%`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ padding: "0 13px 13px", ...footNote }}>
                    Wind is the compass direction the forecast reports, not a field-relative read.
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ padding: "0 18px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          context && context.allows && { key: "allows", label: String(context.allowsLabel || "").toUpperCase(), value: context.allows },
          context && context.rank && { key: "rank", label: "DEFENCE RANK, THIS MARKET", value: [context.rank, titleCase(context.rankWord)].filter(Boolean).join(" · ") },
          context && context.lastMeeting && { key: "last", label: "LAST MEETING", value: context.lastMeeting },
          context && context.park && { key: "park", label: String(context.parkLabel || "").toUpperCase(), value: context.park },
          band && band.venue && { key: "venue", label: "VENUE", value: band.venue },
          // Each sport's own word for the start. "First pitch" on a
          // basketball page is the kind of copy nobody reads twice and
          // everybody notices once.
          band && band.timeLabel && { key: "time", label: START_WORD[sport] || "START", value: [band.dateLabel, band.timeLabel].filter(Boolean).join(" · ") },
        ].filter(Boolean).map((m) => (
          <div
            key={m.key}
            style={{
              border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)", padding: 14,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44,
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--dim)" }}>{m.label}</span>
            <span style={{ fontSize: 15, fontWeight: 600, textAlign: "right" }}>{m.value}</span>
          </div>
        ))}
      </div>
      {player.role && <div style={{ padding: "0 18px 26px", ...footNote }}>{player.role}</div>}
    </div>
  );

  // ---- Log ---------------------------------------------------------------
  // Newest first, as the mock lists them. `seasonGames` is date-ascending
  // because that is the order the graph plots in, so this reverses a copy
  // rather than the array every rate above is counted from.
  const logRows = React.useMemo(() => seasonGames.slice().reverse(), [seasonGames]);
  const logBody = (
    <div style={{ padding: "0 0 26px", display: "flex", flexDirection: "column" }}>
      {logRows.length === 0 && (
        <div style={{ padding: "18px", ...footNote }}>No games logged for this player yet.</div>
      )}
      {logRows.map((l, i) => {
        const over = hitOf(l.v);
        return (
          <div
            key={`${l.date}-${i}`}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
              borderBottom: "1px solid #20242b", minHeight: 44,
              // A filtered-out game keeps its row rather than vanishing --
              // nothing is ever silently dropped.
              opacity: l.excluded ? 0.45 : 1,
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)", width: 58, flex: "0 0 auto" }}>{l.date}</span>
            <span
              style={{
                fontFamily: MONO, fontSize: 12, color: "var(--text-2)", flex: "1 1 auto", minWidth: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {`${l.home === false ? "@ " : "vs "}${String(l.opp || "").toUpperCase()}`}{l.po ? " · PO" : ""}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, flex: "0 0 auto" }}>{l.v}</span>
            <span style={resultPill(over)}>{over ? "OVER" : "UNDER"}</span>
          </div>
        );
      })}
    </div>
  );

  // ---- Injuries ----------------------------------------------------------
  const injuriesBody = (
    <div style={{ padding: "16px 16px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Two different empty states, because they are two different facts. A
          league with no availability feed is not the same as a league whose
          two reports happen to be empty tonight, and printing the first when
          the second is true says something untrue about the data. */}
      {(injuryTeams || []).length === 0 && (
        <div style={{ border: "1px dashed var(--line)", borderRadius: 12, padding: "20px 16px", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.7, color: "var(--dim)" }}>
          {availabilityCovered
            ? "Nobody on either team's report for this game."
            : "No availability feed for this league, so nothing is listed here — never assumed."}
        </div>
      )}
      {(injuryTeams || []).map((t) => (
        <div key={t.abbr} style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
            <span role="img" style={crest(t.slug || t.abbr, t.sport || sport, 22)} />
            <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.12em", color: "var(--text)" }}>{t.abbr}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", marginLeft: "auto" }}>
              {`${t.players.length} ${t.players.length === 1 ? "PLAYER" : "PLAYERS"}`}
            </span>
          </div>
          {t.players.map((p) => {
            const ps = STATUS[p.status];
            return (
              <div key={p.id || p.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 13px", borderBottom: "1px solid #20242b", minHeight: 44 }}>
                <div style={{ position: "relative", flex: "0 0 auto" }}>
                  {renderAvatar ? renderAvatar(p, 36) : null}
                </div>
                <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  {p.note && (
                    <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.note}</span>
                  )}
                  {/* Beyond the mock, and deliberately: what this player's
                      market did in the games that teammate missed is the
                      reason to care that they are on the report at all, and
                      the app now counts it for every league. Wraps rather
                      than truncating -- it is a sentence, not a label. Absent
                      where there is no counted split, never blank. */}
                  {p.effect && (
                    <span style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.55, color: "var(--text-2)" }}>{p.effect}</span>
                  )}
                </div>
                {ps && (
                  <span
                    style={{
                      fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", padding: "5px 9px",
                      borderRadius: 999, flex: "0 0 auto",
                      background: "color-mix(in srgb, currentColor 14%, transparent)", color: ps.dot,
                    }}
                  >
                    {ps.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {(injuryTeams || []).length > 0 && (
        <span style={footNote}>Anyone on a team's report appears here, whether or not they have a prop tonight.</span>
      )}
    </div>
  );

  // ---- News --------------------------------------------------------------
  const newsBody = (
    <div style={{ padding: "18px 18px 26px", display: "flex", flexDirection: "column", gap: 12 }}>
      {(news || []).length === 0 && <div style={footNote}>Nothing on the wire for this player.</div>}
      {(news || []).map((n) => (
        <div key={n.id} style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)", padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={microLabel}>{String(n.when || "").toUpperCase()}</span>
          <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, textWrap: "pretty" }}>{n.headline}</span>
        </div>
      ))}
    </div>
  );

  // ---- the filter sheet --------------------------------------------------
  const showMarket = sheet === "market" || sheet === "all";
  const showSeason = sheet === "season" || sheet === "all";
  const showWindow = sheet === "window" || sheet === "all";
  const showSplits = sheet === "splits" || sheet === "all";
  const showLineups = !!lineups && (sheet === "lineups" || sheet === "all");
  const sheetTitle = sheet === "season" ? "Season"
    : sheet === "market" ? "Market"
    : sheet === "window" ? "Window"
    : sheet === "lineups" ? "Lineups"
    : sheet === "splits" ? "Splits" : "Filters";

  const sheetNode = sheet && (
    <>
      <div onClick={closeSheet} style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(5,6,8,0.72)" }} />
      <div
        className="nsb"
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 41, background: "var(--surface-1)",
          borderTop: "1px solid var(--line)", borderRadius: "20px 20px 0 0", padding: "12px 18px 26px",
          display: "flex", flexDirection: "column", gap: 18, boxShadow: "0 -14px 34px rgba(0,0,0,0.6)",
          maxHeight: "88%", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span style={{ width: 40, height: 4, borderRadius: 999, background: "var(--line)", display: "block" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 20 }}>{sheetTitle}</span>
          <span
            onClick={closeSheet}
            style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", fontSize: 20, cursor: "pointer" }}
          >
            ×
          </span>
        </div>

        {showMarket && markets.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={sectionLabel}>MARKET</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {markets.map((m) => (
                <div key={m.id} onClick={pickAndClose(m.onPick)} style={pill(m.active)}>{m.label}</div>
              ))}
            </div>
          </div>
        )}

        {showSeason && seasons && seasons.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={sectionLabel}>SEASON</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {seasons.map((s) => (
                <div key={s.id} onClick={pickAndClose(s.onPick)} style={pill(s.active)}>{s.label}</div>
              ))}
            </div>
            <span style={sheetNote}>A season is a different sample, not a longer one.</span>
          </div>
        )}

        {showWindow && windows && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={sectionLabel}>WINDOW</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {windows.options.map((w) => (
                <div key={w.id} onClick={pickAndClose(w.onPick)} style={pill(w.active)}>{w.label}</div>
              ))}
            </div>
            {windows.custom && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  <span style={{ ...microLabel, flex: "1 1 auto" }}>YOUR OWN</span>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                    <div
                      onClick={windows.custom.onDown}
                      style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid var(--line)", color: "var(--text-2)", fontSize: 18, cursor: "pointer" }}
                    >
                      −
                    </div>
                    <span style={{ minWidth: 66, textAlign: "center", fontFamily: MONO, fontSize: 15, fontWeight: 700 }}>
                      {`L${windows.custom.value}`}
                    </span>
                    <div
                      onClick={windows.custom.onUp}
                      style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "1px solid var(--line)", color: "var(--text-2)", fontSize: 18, cursor: "pointer" }}
                    >
                      +
                    </div>
                  </div>
                  <div
                    onClick={windows.custom.onSave}
                    style={{
                      minHeight: 44, display: "flex", alignItems: "center", padding: "0 14px", borderRadius: 8,
                      border: "1px solid var(--amber)", background: "var(--amber-dim)", color: "var(--amber-ink)",
                      fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", cursor: "pointer",
                    }}
                  >
                    SAVE
                  </div>
                </div>
                <span style={sheetNote}>Saved windows stay on the bar for every player.</span>
              </>
            )}
          </div>
        )}

        {showLineups && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { label: "TEAMMATES", team: lineups.teamLabel, cards: lineups.mates },
              { label: "OPPOSING LINEUP", team: lineups.oppLabel, cards: lineups.opps },
            ].map((grp, gi) => (
              (grp.cards && grp.cards.length > 0) ? (
                <div
                  key={grp.label}
                  style={{
                    display: "flex", flexDirection: "column", gap: 10,
                    borderTop: gi === 1 ? "1px solid var(--line)" : "none",
                    paddingTop: gi === 1 ? 16 : 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                    <span style={sectionLabel}>{grp.label}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{grp.team}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {grp.cards.map((c) => <LineupCard key={c.key} c={c} renderAvatar={renderAvatar} />)}
                  </div>
                </div>
              ) : null
            ))}
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: lineups.noteTone || "var(--dim)" }}>{lineups.note}</span>
          </div>
        )}

        {showSplits && splits && splits.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={sectionLabel}>SPLITS</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {splits.map((s) => (
                <div
                  key={s.id}
                  onClick={pickAndClose(s.onPick)}
                  style={{ display: "flex", alignItems: "center", gap: 11, minHeight: 46, borderBottom: "1px solid #20242b", cursor: "pointer" }}
                >
                  {/* Radio, not checkbox: two splits at once would recompute
                      the rate over an intersection nobody asked for. */}
                  <span
                    style={{
                      width: 20, height: 20, borderRadius: 999, display: "block", flex: "0 0 auto",
                      border: s.active ? "6px solid var(--amber)" : "1px solid var(--line)",
                      background: "transparent", boxSizing: "border-box",
                    }}
                  />
                  <span style={{ fontSize: 14, color: "var(--text)" }}>{s.label}</span>
                </div>
              ))}
            </div>
            <span style={sheetNote}>A split recomputes the rate and its sample together.</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <div
            onClick={() => {
              // RESET clears what this sheet is actually showing. On the
              // Lineups sheet that is the chips, not the window -- clearing a
              // control the reader cannot see from here is the kind of thing
              // that makes a reset button untrustworthy.
              if (sheet === "lineups") { if (lineups && lineups.onReset) lineups.onReset(); }
              else if (windows && windows.onReset) windows.onReset();
              if (sheet === "all" && lineups && lineups.onReset) lineups.onReset();
              closeSheet();
            }}
            style={{
              flex: "0 0 auto", minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 20px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)",
              color: "var(--text-2)", fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", cursor: "pointer",
            }}
          >
            RESET
          </div>
          <div
            onClick={closeSheet}
            style={{
              flex: "1 1 auto", minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 12, cursor: "pointer", fontFamily: MONO, fontSize: 13, letterSpacing: "0.08em",
              border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text-2)",
            }}
          >
            DONE
          </div>
        </div>
      </div>
    </>
  );

  // ---- the roster dock ---------------------------------------------------
  const rails = [
    ownRail && { key: "own", rail: ownRail },
    oppRail && { key: "opp", rail: oppRail },
  ].filter(Boolean);
  const activeRail = (rails.find((r) => r.key === rosterTeam) || rails[0] || {}).rail;

  const dock = rails.length > 0 && (
    <div
      style={{
        flex: "0 0 auto", height: 132, zIndex: 26, background: "var(--bg)", borderTop: "1px solid var(--line)",
        boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8, padding: "10px 0 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "0 16px" }}>
        <span style={sectionLabel}>SWITCH PLAYER</span>
        <div style={{ display: "flex", gap: 6 }}>
          {rails.map((r) => {
            const on = (rosterTeam === r.key) || (!rails.some((x) => x.key === rosterTeam) && r === rails[0]);
            return (
              <div
                key={r.key}
                onClick={() => setRosterTeam(r.key)}
                style={{
                  minHeight: 32, display: "flex", alignItems: "center", padding: "0 11px", borderRadius: 999,
                  fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", cursor: "pointer", whiteSpace: "nowrap",
                  border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                  background: on ? "var(--amber-dim)" : "var(--surface-1)",
                  color: on ? "var(--amber-ink)" : "var(--text-2)",
                }}
              >
                {/* The abbreviation, as the mock draws it. Two full club
                    names ("Los Angeles Dodgers", "Detroit Tigers") do not fit
                    on one 430px row beside the section label. */}
                {`${((r.rail.players || [])[0] || {}).team || r.rail.label} · ${(r.rail.players || []).length}`}
              </div>
            );
          })}
        </div>
      </div>
      <div
        className="nsb"
        style={{ display: "flex", flex: "0 0 auto", gap: 12, padding: "0 16px", overflowX: "auto", overscrollBehaviorX: "contain" }}
      >
        {((activeRail && activeRail.players) || []).map((rp) => (
          <div
            key={rp.id}
            onClick={rp.onSelect}
            style={{ flex: "0 0 auto", width: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer" }}
          >
            <div style={{ position: "relative" }}>
              {renderAvatar ? renderAvatar(rp, 40) : rp.avatar}
            </div>
            <span
              style={{
                fontSize: 10, lineHeight: "14px", height: 14, flex: "0 0 auto",
                color: rp.active ? "var(--amber-ink)" : "var(--text-2)", textAlign: "center",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 56,
              }}
            >
              {String(rp.name || "").split(" ").slice(-1)[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "relative", display: "flex", flexDirection: "column",
        height: "100dvh", background: "var(--bg)", color: "var(--text)", overflow: "hidden",
      }}
    >
      {header}
      {gameMenuNode}

      <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
        {hero}
        {threeCell}
        {controlBar}
        {tab === "Form" && formBody}
        {tab === "Matchup" && matchupBody}
        {tab === "Log" && logBody}
        {tab === "Injuries" && injuriesBody}
        {tab === "News" && newsBody}
      </div>

      {sheetNode}
      {dock}
    </div>
  );
}
