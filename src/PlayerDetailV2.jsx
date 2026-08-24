import React from "react";
import { feedFormScale } from "./FormGraph.jsx";
import TeamLogo from "./TeamLogo.jsx";
import { venueAbbr } from "./lib/venue.js";
import { mutedTeamColor, matchupTones } from "./lib/teamColors.js";
import MatchupCardModal, { straightRunOf } from "./MatchupCardModal.jsx";
// Named PlayerGameLog, not GameLogTable: MatchupPlayerBlocks already
// exports a GameLogTable, and it is a different thing -- a generic
// arbitrary-column table for the matchup view, with no notion of a split
// excluding a game.
import PlayerGameLog, { SeasonSplit } from "./PlayerGameLog.jsx";
import GameConditions from "./GameConditions.jsx";

// A transcription of `design_handoff_proppalace_v2/Player Detail <SPORT> v2.dc.html`.
//
// Not an interpretation of it. Every element, order, size, weight, colour,
// padding and gap below is what that file draws; `sc-for` became `.map()`,
// `sc-if` became `&&`, and each `{{ token }}` became a real value from the
// app's own feeds. The only substitution is hex -> the token that already
// resolves to that hex, so the light theme keeps working:
//
//   #0a0b0d --bg          #131519 --surface-1     #191c21 --surface-2
//   #0d0f12 --surface-sunken                      #2b2f36 --line
//   #e8ecf2 --text        #aab2c0 --text-2        #8b98ab --dim
//   #8fa6ff --amber-ink   #3b5bdb --amber         #2faa72 --pos-solid
//   #ef5b5b --neg
//
// The four sport files are structurally identical -- same breadcrumb, same
// 196/1fr/196 grid, same seven centre blocks, same two rails -- so this is one
// component the four pages feed, which is also why a fix here reaches all four.

const MONO = "'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

// Repeated exactly as the file writes them.
const railLabel = { fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" };
const cellLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--dim)", whiteSpace: "nowrap" };
const cellValue = { fontFamily: MONO, fontSize: 15, marginTop: 6, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const metricLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" };
const metricValue = { fontFamily: MONO, fontSize: 20, marginTop: 6, fontVariantNumeric: "tabular-nums" };
const crumb = { fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase" };

function RosterRow({ p, sport, onSelect }) {
  return (
    <div
      onClick={onSelect}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } } : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 6,
        cursor: onSelect ? "pointer" : "default",
        background: p.active ? "var(--amber-dim)" : "transparent",
        border: `1px solid ${p.active ? "var(--amber)" : "var(--line)"}`,
        // The rail's own 8px gap plus this reads as a group break without
        // needing a rule: pitchers above, the batting order below.
        marginTop: p.separated ? 8 : 0,
      }}
    >
      <span style={{ position: "relative", flex: "none", width: 32, height: 32 }}>
        {/* The mock draws initials because it could not carry images. This is
            the real headshot in the same 32px disc -- the app's standard
            avatar at rail size, so the team-colour ring reads the same here as
            it does on the board, the feed and the gamecast -- and it falls
            back to those initials rather than to nothing. */}
        {p.avatar}
        {/* Availability, and the only thing in this corner (CLAUDE.md rule 3).
            Lineup state is the batting-order number on the other end. */}
        {p.dotFill && (
          <span style={{
            position: "absolute", right: -1, bottom: -1, width: 9, height: 9, borderRadius: 999,
            border: `2px solid ${p.dotRing}`, background: p.dotFill, boxSizing: "border-box",
          }} />
        )}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {p.name}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)", marginTop: 3 }}>
          {p.meta}
        </div>
      </div>
      {/* Batting order, which is also how this rail says "in the posted
          lineup" -- the two are one fact for a batter. Absent until the lineup
          posts, and absent for anyone left out of it, so an empty slot here
          never reads as a guess. */}
      {/* OUT / QUES, in the designation's own colour. Literal hexes rather
           than --amber or --accent: CLAUDE.md rule 2, and the naming trap
           behind it -- --amber is the user's accent, so a status drawn with it
           turns blue on a re-tint and health starts reading as "selected". */}
      {p.statusWord && (
        <span
          className="pp-mono"
          title={p.statusWord === "out"
            ? "Ruled out — this app hides their props while they are"
            : "Questionable — still a decision at the time this was published"}
          style={{
            flex: "none", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
            borderRadius: 3, padding: "2px 5px", whiteSpace: "nowrap",
            color: p.statusWord === "out" ? "#ef5b5b" : "#e8b13a",
            border: `1px solid ${p.statusWord === "out" ? "#ef5b5b" : "#e8b13a"}`,
          }}
        >
          {p.statusWord === "out" ? "Out" : "Ques"}
        </span>
      )}
      {(p.order != null || p.orderUnknown) && (
        <span
          title={p.orderUnknown
            ? "Too few games logged to place him in the order, so he is listed last rather than given a slot we cannot support."
            : p.orderProjected
              ? `Projected to bat ${p.order}. MLB has not posted this lineup yet, so this is read from plate appearances per game — a leadoff bat sees about 4.6, a number nine about 3.9.`
              : `Batting ${p.order} in the posted lineup`}
          style={{
            // Wider than it was: a bare "3" in a box reads as a count or a
            // rank as easily as a lineup slot, and Alex said so. "#3" cannot
            // be read as anything else.
            flex: "none", minWidth: 26, height: 18, borderRadius: 4, padding: "0 4px",
            display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box",
            fontFamily: MONO, fontSize: 10,
            fontVariantNumeric: "tabular-nums",
            // Filled once the order is real, outlined while it is ours. The
            // number is worth showing either way -- the top of the order is
            // where the most-read players are -- but a projected slot must not
            // look like a posted one.
            border: `1px solid ${p.orderProjected || p.orderUnknown ? "var(--line)" : "var(--text-2)"}`,
            background: p.orderProjected || p.orderUnknown ? "transparent" : "var(--surface-sunken)",
            color: p.orderProjected || p.orderUnknown ? "var(--dim)" : "var(--text-2)",
          }}
        >
          {p.orderUnknown ? "#—" : `#${p.order}`}
        </span>
      )}
    </div>
  );
}

function BandHalf({ sport, team, side, align, tone }) {
  const text = (
    <div style={{ textAlign: align === "right" ? "right" : "left" }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--dim)" }}>
        {team.record ? `${side} · ${team.record}` : side}
      </div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 22, marginTop: 5 }}>{team.name || team.abbr}</div>
    </div>
  );
  // No plate. The mock draws a bordered box because it had only an
  // abbreviation to put in it; a real crest is its own shape and reads better
  // without a grey square fighting it. The 64px footprint is kept so the band
  // keeps the file's proportions.
  //
  // What the box was quietly doing was lifting dark marks off the card -- the
  // Yankees' navy on #131519 is nearly invisible. That job moves onto the mark
  // itself: a 1px light drop-shadow traces the logo's own edge, which
  // separates a dark crest from a dark ground without drawing a container, and
  // is imperceptible on a bright one. It flips with the theme, so a pale crest
  // on the light theme gets a dark trace instead.
  const badge = (
    <span style={{
      display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
      width: 64, height: 64,
    }}>
      <TeamLogo
        sport={sport}
        abbr={team.abbr}
        size={56}
        title={team.name || team.abbr}
        // Two stacked traces rather than one heavier blur: a tight 1px edge
        // does the separating, and a wider soft 3px lifts the mark off the
        // card without reading as a glow. Tuned on the Yankees' navy, which is
        // the worst case in the league on a #131519 ground; on a bright crest
        // like Toronto's it is invisible.
        style={{
          filter: "drop-shadow(0 0 1px color-mix(in srgb, var(--text) 70%, transparent))"
            + " drop-shadow(0 0 3px color-mix(in srgb, var(--text) 30%, transparent))",
        }}
      />
    </span>
  );
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: "16px 20px",
      borderTop: `3px solid ${tone}`, flex: 1,
      justifyContent: align === "right" ? "flex-end" : "flex-start",
    }}>
      {align === "right" ? <>{text}{badge}</> : <>{badge}{text}</>}
    </div>
  );
}

export default function PlayerDetailV2({
  // Competitive brief item 1 (mock 3a). { rows, upcoming, unit } -- rows is
  // the WHOLE log, each carrying an `excluded` flag, which is what lets the
  // table keep a filtered-out game visible instead of dropping it.
  log = null,
  // Competitive brief item 7 (mock 3f). Where the game is played and what
  // that is worth -- park factors where a sport has published ones, forecast
  // where the game is outdoors, and a stated reason where neither applies.
  conditions = null,
  // Blocks only one sport has. Baseball is the only league that publishes a
  // batting order and a public plate-discipline leaderboard, so the expected
  // lineup and the percentile pair (competitive brief items 2 and 3) exist
  // there and nowhere else. A generic slot rather than two named props, so
  // this component does not grow a baseball-shaped hole the other three
  // sports pass null into.
  extraBlocks = null,
  sport,
  // `crumbSelect` is the game switcher, rendered in place of the plain
  // fixture text. The mock prints the fixture as static type because it has
  // nowhere else to go; a real page needs a way off this game without going
  // back to the feed first, and the fixture line already names the game, so
  // it becomes the trigger rather than the page growing a region the mock
  // does not have. Falls back to the text when a page has no slate to offer.
  crumbFixture, crumbSelect, marketLabel, onBack, onWatch, watching,
  // The extra facts the Matchup Card needs and the page's other props cannot
  // supply: a 72px avatar and the availability word. Everything else on the
  // card is derived from `player`/`band`/`context`/`verdict`/`chart`, so it
  // cannot disagree with the page underneath it.
  card,
  ownRail, oppRail,
  band,
  context,
  player,
  markets = [], filtersCount = 0, filtersOpen = false, onToggleFilters, filtersPanel,
  verdict,
  chart,
  footerNote, onAddPick, pickAdded,
  // Rendered under the grid, and only ever non-null below 1100px: it is
  // MobilePlayerNav, which self-gates on that breakpoint and returns null
  // above it. The rails are what switch player on a wide screen; this is what
  // does it once they have folded away. See .pp-pd-grid in index.css.
  bottomStrip,
}) {
  const tones = band && band.away && band.home
    ? matchupTones(sport, band.away.abbr, band.home.abbr)
    : { away: "var(--dim)", home: "var(--dim)" };

  // One line of conditions for the context row at the top of the page.
  //
  // `live` distinguishes a real reading from a reason there isn't one, which
  // is the difference between "84°F · 10 mph SW" and "Indoors" -- the first is
  // data and gets --text-2, the second is a statement about our data and gets
  // --dim. Short forms only: the cell is one line, and the full sentence is
  // already on the block further down.
  const conditionsLine = React.useMemo(() => {
    if (!conditions) return null;
    const w = conditions.weather;
    if (w) {
      const parts = [w.temp != null ? `${w.temp}°F` : null, w.wind || null].filter(Boolean);
      if (w.precipPct != null && w.precipPct >= 30) parts.push(`${w.precipPct}% rain`);
      if (parts.length) return { text: parts.join(" · "), live: true };
    }
    const short = {
      dome: "Indoors",
      indoor: "Indoors",
      retractable: "Roof may be closed",
      horizon: "Forecast nearer kickoff",
      pregame: "Posted nearer first pitch",
      pending: "Checking the forecast…",
    }[conditions.noForecastReason];
    return short ? { text: short, live: false } : null;
  }, [conditions]);

  const [cardOpen, setCardOpen] = React.useState(false);
  // Open by default: the table is the answer to "where are the games",
  // and a collapsed answer is the state the page was already in.
  const [logOpen, setLogOpen] = React.useState(true);

  return (
    <div style={{ width: "100%", maxWidth: 1600, margin: "0 auto", background: "var(--bg)", color: "var(--text)" }}>

      {/* Three tracks, not a flex row with `margin: 0 auto` on the middle
          child. That is what this was, and it does not centre: auto margins
          share out the space LEFT OVER, so a 219px left group and a 59px
          right group put the fixture 89px right of the page's centre line --
          measured, at a 1600px viewport -- while the team band directly
          beneath it sat dead centre. Two things that plainly belong on one
          axis, visibly off it.

          The outer tracks are minmax(0, 1fr) so they stay equal and let their
          own contents ellipsis rather than pushing the middle off centre when
          a long team name arrives. */}
      <div style={{
        display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
        alignItems: "center", gap: 12, padding: "16px 32px", borderBottom: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
          <span
            role="button" tabIndex={0} onClick={onBack}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack(); } }}
            style={{ ...crumb, color: "var(--text-2)", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            ← Prop Feed
          </span>
          {/* The Matchup Card file adds exactly this button to the breadcrumb,
              20px after the back link, and it is the only thing that opens the
              modal. */}
          <span
            role="button" tabIndex={0} onClick={() => setCardOpen(true)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCardOpen(true); } }}
            style={{
              ...crumb, marginLeft: 20, color: "var(--text-2)", cursor: "pointer", whiteSpace: "nowrap",
              border: "1px solid var(--line)", borderRadius: 4, padding: "6px 12px",
            }}
          >
            Matchup card
          </span>
        </div>
        <span style={{ ...crumb, color: "var(--dim)", justifySelf: "center", textAlign: "center" }}>
          {crumbSelect || crumbFixture} · <span style={{ color: "var(--text)" }}>{marketLabel}</span>
        </span>
        <span
          role="button" tabIndex={0} onClick={onWatch}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWatch && onWatch(); } }}
          style={{ ...crumb, color: "var(--amber-ink)", cursor: onWatch ? "pointer" : "default", justifySelf: "end", whiteSpace: "nowrap" }}
        >
          {watching ? "✓ Watching" : "+ Watch"}
        </span>
      </div>

      <div className="pp-pd-grid">

        <div className="pp-pd-rail">
          <div style={railLabel}>{ownRail.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {ownRail.players.map((p) => (
              <RosterRow key={p.id} p={p} sport={sport} onSelect={p.onSelect} />
            ))}
          </div>
          {/* The mock's legend describes one corner dot carrying lineup state.
              What the corner actually carries here is availability -- the fact
              all four leagues report, and the corner CLAUDE.md rule 3 reserves
              -- so each page passes the legend that is true of its own league
              rather than repeating a sentence about a mark that isn't there.
              The mock's closing clause survives in all of them: never
              assumed. */}
          {ownRail.legend && (
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.04em", color: "var(--dim)", marginTop: 14, lineHeight: 1.6 }}>
              {ownRail.legend}
            </div>
          )}
        </div>

        <div>
          {band && band.away && band.home && (
            <div style={{ display: "flex", alignItems: "stretch", background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
              <BandHalf sport={sport} team={band.away} side="Away" align="left" tone={tones.away} />
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 6, padding: "16px 24px", background: "var(--surface-sunken)",
                borderLeft: "1px solid var(--line)", borderRight: "1px solid var(--line)",
              }}>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--dim)" }}>{band.dateLabel}</span>
                <span style={{ fontFamily: MONO, fontSize: 17, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{band.timeLabel || "—"}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)" }}>{band.venue}</span>
              </div>
              <BandHalf sport={sport} team={band.home} side="Home" align="right" tone={tones.home} />
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 12, background: "var(--surface-sunken)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ flex: 1.1, minWidth: 0, padding: "12px 18px" }}>
              <div style={cellLabel}>{context.allowsLabel}</div>
              <div style={cellValue}>{context.allows ?? "—"}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0, padding: "12px 18px", borderLeft: "1px solid var(--line)" }}>
              <div style={cellLabel}>Matchup</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6, whiteSpace: "nowrap" }}>
                <span style={{ fontFamily: MONO, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{context.rank ?? "—"}</span>
                {context.rankWord && (
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: context.rankColor }}>{context.rankWord}</span>
                )}
              </div>
            </div>
            <div style={{ flex: 1.3, minWidth: 0, padding: "12px 18px", borderLeft: "1px solid var(--line)" }}>
              <div style={cellLabel}>Last meeting</div>
              <div style={cellValue}>{context.lastMeeting ?? "—"}</div>
            </div>
            {/* The venue, and what the sky is doing there.
                 Alex, on the conditions block at the foot of the page: "this
                 weather info should go into this top area as it is important
                 info that should be seen upfront." It reads off the same
                 `conditions` object the full block does rather than a second
                 copy, so the two can never disagree -- this is the headline,
                 that is the detail. */}
            <div style={{ flex: 1.3, minWidth: 0, padding: "12px 18px", borderLeft: "1px solid var(--line)" }}>
              <div style={cellLabel}>{conditionsLine ? "Conditions" : context.parkLabel}</div>
              <div style={{ ...cellValue, overflow: "hidden", textOverflow: "ellipsis" }}>
                {context.park ?? (conditions && conditions.venue) ?? "—"}
              </div>
              {conditionsLine && (
                <div style={{
                  fontFamily: MONO, fontSize: 11, marginTop: 4, color: conditionsLine.live ? "var(--text-2)" : "var(--dim)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {conditionsLine.text}
                </div>
              )}
            </div>
          </div>

          <div style={{
            display: "flex", alignItems: "stretch", gap: 0, marginTop: 12,
            background: "var(--surface-1)", border: "1px solid var(--line)",
            borderLeft: `3px solid ${mutedTeamColor(sport, player.team)}`,
            borderRadius: 6, overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 24px", flex: 1, minWidth: 0 }}>
              <span style={{ position: "relative", flex: "none", width: 104, height: 104 }}>
                {player.avatar}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 46, lineHeight: 1, letterSpacing: "-0.025em" }}>{player.name}</span>
                  {player.jersey != null && (
                    <span style={{ fontFamily: MONO, fontSize: 24, color: mutedTeamColor(sport, player.team), fontVariantNumeric: "tabular-nums" }}>{player.jersey}</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <TeamLogo sport={sport} abbr={player.team} size={22} title={player.teamLabel} />
                  <span style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-2)" }}>
                    {player.identity}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
                  {player.statusPill}
                  {(player.pills || []).map((u) => (
                    <span key={u.label} style={{
                      fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase",
                      color: "var(--text-2)", border: "1px solid var(--line)", borderRadius: 999,
                      padding: "4px 10px", whiteSpace: "nowrap",
                    }}>
                      {u.label} <span style={{ color: "var(--text)" }}>{u.value}</span>{u.note ? ` · ${u.note}` : ""}
                    </span>
                  ))}
                </div>
                {player.role && (
                  <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)", marginTop: 12, maxWidth: "52ch" }}>
                    {player.role}
                  </div>
                )}
              </div>
            </div>
            {(player.seasonStats || []).length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 0, flex: "none", background: "var(--surface-sunken)", borderLeft: "1px solid var(--line)" }}>
                {player.seasonStats.map((st) => (
                  <div key={st.label} style={{ textAlign: "center", padding: "20px 14px", minWidth: 58 }}>
                    <div style={{ fontFamily: MONO, fontSize: 24, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{st.value}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dim)", marginTop: 8, whiteSpace: "nowrap" }}>{st.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabs and Filters are separate boxes so the fold can rearrange
               them: one line with Filters in the corner at 768, two lines at
               500. Wrapping them as one flex row put "Anytime TD" on its own
               line with the button beside it, which reads as a mistake rather
               than as a second row. */}
          <div className="pp-pd-tabrow" style={{ display: "flex", alignItems: "flex-end", marginTop: 20, borderBottom: "1px solid var(--line)" }}>
          <div className="pp-pd-tabs" style={{ display: "flex", alignItems: "flex-end", gap: 26, minWidth: 0 }}>
            {markets.map((m) => (
              <span
                key={m.id}
                role="button" tabIndex={0} onClick={m.onPick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); m.onPick(); } }}
                style={{
                  fontSize: 15, paddingBottom: 11, cursor: "pointer",
                  // The row wraps between tabs on a wide screen and scrolls on
                  // a narrow one; a tab label breaking across two lines is
                  // neither, and it made every tab two lines tall at 768.
                  whiteSpace: "nowrap",
                  color: m.active ? "var(--text)" : "var(--dim)",
                  borderBottom: `2px solid ${m.active ? "var(--amber)" : "transparent"}`,
                  marginBottom: -1,
                }}
              >
                {m.label}
              </span>
            ))}
          </div>
            <span
              className="pp-pd-filters"
              role="button" tabIndex={0} onClick={onToggleFilters}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleFilters(); } }}
              style={{
                marginLeft: "auto", marginBottom: 8, display: "flex", alignItems: "center", gap: 8,
                fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
                borderRadius: 4, padding: "7px 12px", cursor: "pointer",
                color: filtersCount || filtersOpen ? "var(--amber-ink)" : "var(--text-2)",
                background: filtersOpen ? "var(--surface-2)" : "transparent",
                border: `1px solid ${filtersCount || filtersOpen ? "var(--amber)" : "var(--line)"}`,
              }}
            >
              Filters
              {filtersCount > 0 && <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{filtersCount}</span>}
            </span>
          </div>

          {/* No wrap, and the row's height never changes.
              Dragging the line adds a "market 1.5 · reset" note under LINE.
              With wrap on, that pushed the 20 GAMES pill onto a second line
              and the whole chart jumped ~48px down the page mid-drag -- the
              graph moving is the one thing it must never do while you are
              reading it. The note is absolutely positioned into reserved
              padding instead, so it costs no height, and the row cannot wrap:
              the sentence shrinks first. */}
          {/* pp-pd-verdict: the no-wrap rule above holds on a wide screen and
              lifts once the chassis folds. At 768px the metric cells left the
              sentence 184px, so the ellipsis ate the sample and it read
              "cleared 268...." -- the count after the number being the entire
              point of the line. Wrapped, the sentence gets a full row and the
              cells drop under it, and it still cannot jump mid-drag: at a full
              row width the sentence is one line at every value it can take. */}
          <div className="pp-pd-verdict" style={{ display: "flex", alignItems: "center", gap: 24, padding: "20px 0 30px", position: "relative" }}>
            <div className="pp-pd-verdict-head" style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
              <span style={{ fontFamily: MONO, fontSize: 40, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: verdict.rateColor, flex: "none" }}>{verdict.rate}</span>
              <span style={{ fontSize: 15, color: "var(--text-2)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{verdict.sentence}</span>
            </div>
            <div className="pp-pd-verdict-cells" style={{ marginLeft: "auto", display: "flex", gap: 28, flex: "none" }}>
              <div style={{ textAlign: "right" }}>
                <div style={metricLabel}>Average</div>
                <div style={metricValue}>{verdict.average}</div>
              </div>
              <div style={{ textAlign: "right", position: "relative" }}>
                <div style={metricLabel}>Line</div>
                <div style={{ ...metricValue, color: verdict.adjusted ? "var(--amber-ink)" : "var(--text)" }}>{verdict.line}</div>
                {verdict.adjusted && (
                  <div
                    role="button" tabIndex={0} onClick={verdict.onResetLine}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); verdict.onResetLine(); } }}
                    // Absolute, into the row's reserved bottom padding: it must
                    // not add height, or the chart moves the moment you drag.
                    style={{ position: "absolute", top: "100%", right: 0, marginTop: 3, fontFamily: MONO, fontSize: 10, color: "var(--dim)", cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    market {verdict.marketLine} · <span style={{ color: "var(--amber-ink)" }}>reset</span>
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={metricLabel}>Clears it by</div>
                <div style={{ ...metricValue, color: verdict.marginColor }}>{verdict.margin}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={metricLabel}>Odds</div>
                {/* The cell keeps its slot so wiring a real feed later is a
                    value swap with no layout change. It says "coming soon"
                    rather than showing a dash, because a dash reads as "we
                    looked and there is none" -- and never a price derived from
                    the hit rate, which is circular.
                    TODO: a real feed fills this with { price, book, point,
                    fetchedAt } per player+market. */}
                {verdict.odds
                  ? <div style={{ ...metricValue, color: "var(--dim)" }}>{verdict.odds}</div>
                  : <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.06em", marginTop: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>Coming soon</div>}
              </div>
            </div>
            <span className="pp-pd-verdict-sample" style={{
              flex: "none", fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "var(--amber-ink)", border: "1px solid var(--amber)", borderRadius: 4, padding: "11px 14px",
            }}>
              {verdict.sampleVerdict}
            </span>
          </div>

          <GameByGame sport={sport} {...chart} />

          {filtersOpen && filtersPanel}

          {log && log.seasons && <SeasonSplit seasons={log.seasons} />}

          {extraBlocks}

          {conditions && <GameConditions {...conditions} />}

          {log && log.rows && log.rows.length > 0 && (
            <PlayerGameLog
              sport={sport}
              rows={log.rows}
              upcoming={log.upcoming}
              unit={log.unit}
              line={chart.line}
              isBinary={chart.isBinary}
              direction={chart.direction}
              open={logOpen}
              onToggle={() => setLogOpen((v) => !v)}
            />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.05em", color: "var(--dim)", lineHeight: 1.6 }}>
              {footerNote}
            </span>
            <span
              role="button" tabIndex={0} onClick={onAddPick}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAddPick(); } }}
              style={{
                marginLeft: "auto", flex: "none", fontFamily: MONO, fontSize: 12,
                letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                color: pickAdded ? "var(--amber-ink)" : "#ffffff",
                background: pickAdded ? "transparent" : "var(--amber)",
                border: `1px solid var(--amber)`,
                borderRadius: 4, padding: "14px 20px",
              }}
            >
              {pickAdded ? "✓ On my picks" : "+ Add to my picks"}
            </span>
          </div>
        </div>

        <div>
          {/* Only the roster half of this column folds away below 1100 -- the
              graph key underneath it is the one thing in either rail that is
              not a roster, and a chart whose colours are unexplained is worse
              on a small screen than on a large one. */}
          <div className="pp-pd-rail">
            <div style={railLabel}>{oppRail.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {oppRail.players.map((p) => (
                <RosterRow key={p.id} p={p} sport={sport} onSelect={p.onSelect} />
              ))}
            </div>
          </div>

          <div className="pp-pd-key" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <div style={railLabel}>Reading the graph</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-2)" }}>
                <span style={{ width: 8, height: 16, background: "var(--pos-solid)", borderRadius: 2 }} />cleared the line
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-2)" }}>
                <span style={{ width: 8, height: 16, border: "1.5px solid var(--neg)", borderRadius: 2, boxSizing: "border-box" }} />fell short
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-2)" }}>
                <span style={{ width: 16, borderTop: "1.5px dashed var(--text)" }} />the line
              </span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.04em", color: "var(--dim)", marginTop: 14, lineHeight: 1.6 }}>
              Bar height is the actual number, so a blowout doesn&rsquo;t read like a squeaker.
            </div>
          </div>
        </div>
      </div>

      {bottomStrip}

      {/* Last in the tree, exactly where the Matchup Card file puts it: after
          the grid closes, guarded by its own open state. */}
      <MatchupCardModal
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        sport={sport}
        player={player}
        card={card || {}}
        band={band}
        context={context}
        verdict={verdict}
        chart={chart}
        marketLabel={marketLabel}
        onAddPick={onAddPick}
        pickAdded={pickAdded}
      />
    </div>
  );
}

// The plot's own width, measured. Everything the chart draws under a bar --
// disc, abbreviation, date, the value inside the bar foot -- is decided from
// how much room one column actually has, which is not knowable without this.
//
// A callback ref, not useRef + useLayoutEffect([]), and the difference is not
// stylistic. GameByGame returns null while the log is still being fetched, so
// on first mount there is no node: the effect runs, finds `ref.current` null,
// and never runs again because its dependency list is empty. The games then
// arrive, the plot renders at its real width, and the hook still says 0 --
// which renders every label hidden at every size. A callback ref fires on
// each attach and detach, so it measures the node that actually exists.
function usePlotWidth() {
  const [w, setW] = React.useState(0);
  const roRef = React.useRef(null);
  // The node itself, for turning a pointer's clientX into a column index.
  const node = React.useRef(null);
  const ref = React.useCallback((el) => {
    node.current = el;
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0] && entries[0].contentRect && entries[0].contentRect.width;
      if (cw != null) setW(cw);
    });
    ro.observe(el);
    roRef.current = ro;
  }, []);
  return [ref, w, node];
}

// The mock's own plot: 224px tall, gap 6, flex:1 columns, the value inside the
// bar foot, a 26px opponent disc under the axis, and the line tag hanging in a
// 52px right gutter. No column band -- removed from all five mocks.
function GameByGame({
  sport, games = [], line, isBinary, direction = "over",
  marketLine, onDragLine, adjusted, draggable,
  // Drag across the bars to narrow the sample to that stretch of the season.
  // `onZoomRange` is handed the first and last game's raw date rather than
  // indices: the page re-derives its own list on every market and filter
  // change, and an index into yesterday's list points at a different game
  // today. A date still means the same game whatever else moved.
  onZoomRange, zoomed, onClearZoom,
}) {
  // Non-null only while a drag is in progress -- see startDrag.
  const [rawLine, setRawLine] = React.useState(null);
  // The live selection while a zoom drag is in progress, as two column
  // indices. Null the rest of the time.
  const [sel, setSel] = React.useState(null);
  const [plotRef, plotW, plotNode] = usePlotWidth();
  if (!games.length || line == null) return null;
  const H = 224, GUT = 52;

  // ---- The plot is a fixed box. The bars fit themselves into it. ----------
  //
  // It used to be the other way round: every column had a 32px minimum and the
  // strip scrolled sideways once they stopped fitting. That is what an
  // eighty-game MLB season did to it -- a 3,000px plot inside a 700px card.
  //
  // Alex's call (2026-08-23), and it is what both benchmarks do. Measured on
  // PropsMadness: at Games 10 the bars are ~32px, at 20 ~28px, at Max (124)
  // ~5px, and the chart is 820px wide at all three. Outlier's season view is
  // the same -- hairlines in a fixed box, no scroller anywhere. Scrolling a
  // chart is work the reader did not ask for, and it hides the shape of the
  // season, which is the one thing a season-long view is for.
  //
  // The design mock for the folded page answered this differently -- ten fixed
  // slots, the rest in the log table. Overruled deliberately: it makes the
  // window control decide what the graph can show, when the graph can simply
  // show it.
  const n = games.length;
  // The gap goes before the bar does. At 80 games a 6px gap is 480px of the
  // plot spent on nothing.
  const gap = n <= 20 ? 6 : n <= 40 ? 4 : 2;
  const colW = plotW > 0 ? Math.max(1, (plotW - gap * (n - 1)) / n) : 0;

  // What a column has room to say. Thresholds are measured, not picked: the
  // date renders 37px wide at 10px mono, the opponent 30px at 11px, and a
  // centred label overflows into its neighbour the moment the column plus the
  // gap is narrower than the text.
  //
  // 44 for the date is the design mock's own threshold, and it agrees with the
  // arithmetic (37 + a hair).
  const showDate = colW >= 44;
  const showAbbr = colW >= 30;
  const discSize = colW >= 30 ? 26 : colW >= 20 ? 18 : colW >= 11 ? 12 : 0;
  // The number inside the bar foot. Three digits at 14px is ~25px, so it needs
  // more room than the abbreviation does; below that it shrinks once and then
  // goes, because a clipped number is worse than no number.
  const valueSize = colW >= 34 ? 14 : colW >= 24 ? 11 : 0;

  // ---- Drag to zoom ------------------------------------------------------
  //
  // The plot is a row of equal columns, so a pointer's x maps to a game by
  // division -- no hit-testing, and it stays correct at 4px bars where the
  // bars themselves are far too small to click.
  //
  // Two bars minimum. A one-bar "range" is a click, and a click that silently
  // narrowed the sample to a single game would be the easiest way in the app
  // to end up reading 100% off n=1.
  const pitch = colW + gap;
  const canZoom = typeof onZoomRange === "function" && n > 2 && plotW > 0;
  const idxAt = (clientX) => {
    const el = plotNode.current;
    if (!el || pitch <= 0) return 0;
    const x = clientX - el.getBoundingClientRect().left;
    return Math.max(0, Math.min(n - 1, Math.floor(x / pitch)));
  };
  const startSelect = (e) => {
    if (!canZoom || e.button !== 0) return;
    e.preventDefault();
    const a = idxAt(e.clientX);
    setSel({ a, b: a });
    const move = (ev) => setSel({ a, b: idxAt(ev.clientX) });
    const up = (ev) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      const b = idxAt(ev.clientX);
      setSel(null);
      const lo = Math.min(a, b), hi = Math.max(a, b);
      if (hi - lo >= 1 && games[lo] && games[hi]) onZoomRange(games[lo].iso, games[hi].iso);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const selLo = sel ? Math.min(sel.a, sel.b) : 0;
  const selHi = sel ? Math.max(sel.a, sel.b) : 0;

  // When no column can carry its own date, the axis carries a few instead --
  // first, last, and as many evenly spaced between as fit. This is what both
  // benchmarks fall back to on a full season, and it keeps the one thing a
  // dense chart still needs: where in the year you are.
  const dateTicks = new Set();
  if (!showDate && plotW > 0 && n > 1) {
    const maxTicks = Math.max(2, Math.floor(plotW / 64));
    const step = Math.max(1, Math.ceil((n - 1) / (maxTicks - 1)));
    for (let i = 0; i < n; i += step) dateTicks.add(i);
    dateTicks.add(n - 1);
  }
  const recent = games.map((g) => ({ v: g.v }));
  const scale = feedFormScale(recent, line, isBinary, { height: H, pedestal: 0 });
  const hit = (v) => (direction === "under" ? v < line : v > line);
  const canDrag = draggable && !isBinary && marketLine != null && typeof onDragLine === "function";

  // The handle glides, the value snaps.
  //
  // Snapping the *position* to whole steps made the tag jump between rungs and
  // feel stuck to a ratchet. `rawLine` is the unsnapped position under the
  // cursor and is what the tag and its rule are drawn at, so the handle tracks
  // the pointer exactly; the number reported to the page is still snapped to
  // the nearest increment, so every rate on screen only ever reflects a real
  // half-value. On release rawLine clears and the tag settles onto the rung it
  // chose, with a short transition so the settle reads as a landing rather
  // than a jump.
  const posLine = rawLine != null ? rawLine : line;
  const lineY = Math.max(1, Math.min(H - 1, scale.y(posLine)));
  const straightRun = straightRunOf(games, line, direction);

  const startDrag = (e) => {
    // The tag sits inside the plot, so without this a grab of the line handle
    // would also begin a zoom selection underneath it.
    e.stopPropagation();
    if (!canDrag) return;
    e.preventDefault(); e.stopPropagation();
    const { unit, step, dragMax } = feedFormScale(recent, marketLine, isBinary, { height: H, pedestal: 0 });
    const startY = e.clientY, startVal = line;
    const maxSteps = Math.floor((dragMax - marketLine) / step);
    const minSteps = Math.ceil((0.25 - marketLine) / step);
    // The same limits the snap uses, expressed as values, so the free-moving
    // handle cannot glide past the range its snapped value is clamped to.
    const loVal = marketLine + minSteps * step;
    const hiVal = marketLine + maxSteps * step;
    const move = (ev) => {
      const raw = startVal + (startY - ev.clientY) / unit;
      setRawLine(Math.min(hiVal, Math.max(loVal, raw)));
      const steps = Math.min(maxSteps, Math.max(minSteps, Math.round((raw - marketLine) / step)));
      onDragLine(marketLine + steps * step);
    };
    const up = () => {
      setRawLine(null);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div style={{ background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 6, padding: "16px 20px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, paddingBottom: 14, marginBottom: 4, borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18 }}>Game by game</span>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)" }}>
          oldest to newest · bar height is the number{canZoom && !zoomed ? " · drag to zoom" : ""}
        </span>
        {/* Derived here rather than passed in. Every page was handing this a
            hard 0, so the mock's own caption had never once rendered -- and it
            is a fact about the games already on screen, which is exactly the
            kind of thing the chart should be reading for itself. */}
        {straightRun > 1 && (
          <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber-ink)" }}>
            {straightRun} straight {direction === "under" ? "under" : "over"}
          </span>
        )}
        {/* The way back. A zoom narrows the sample every figure on the page
             reads, so it cannot be a state you can only leave by guessing --
             it names itself and offers the exit in the same breath. */}
        {zoomed && (
          <span
            role="button" tabIndex={0} onClick={onClearZoom}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClearZoom(); } }}
            style={{
              marginLeft: straightRun > 1 ? 12 : "auto", flex: "none", cursor: "pointer",
              fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "var(--amber-ink)", border: "1px solid var(--amber)", borderRadius: 4, padding: "4px 9px",
            }}
          >
            Zoomed · {n} games · reset ×
          </span>
        )}
      </div>

      <div>
        <div style={{ position: "relative", paddingRight: GUT }}>
          <div
            ref={plotRef}
            onMouseDown={startSelect}
            style={{
              position: "relative", display: "flex", alignItems: "stretch", gap, height: H,
              cursor: canZoom ? "crosshair" : "default",
              // A drag across a chart otherwise turns into a text selection of
              // every number in it.
              userSelect: sel ? "none" : undefined,
            }}
          >
            {games.map((g, i) => {
              const cleared = hit(g.v);
              const h = Math.max(3, Math.round(scale.y(g.v)));
              return (
                <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <div style={{
                    display: "flex", alignItems: "flex-end", justifyContent: "center", height: h,
                    // 3px of radius on a 2px bar is a blob. It scales down with
                    // everything else.
                    borderRadius: colW >= 8 ? "3px 3px 0 0" : "1px 1px 0 0",
                    boxSizing: "border-box", paddingBottom: valueSize ? 8 : 0,
                    background: cleared ? "var(--pos-solid)" : "transparent",
                    // An outlined bar needs interior to be an outline. At
                    // 1.5px a side there is none left below about 10px, so a
                    // fell-short bar switches to a solid fill in the same red
                    // -- which is what both benchmarks draw at season density,
                    // and it keeps the two states as far apart at 4px as the
                    // outline keeps them at 40px. --neg, not --neg-dim: dim is
                    // 14% and disappears against the panel at this width.
                    border: cleared || colW < 10 ? "none" : "1.5px solid var(--neg)",
                    backgroundColor: cleared ? "var(--pos-solid)" : (colW < 10 ? "var(--neg)" : "transparent"),
                  }}>
                    {valueSize > 0 && (
                      <span style={{ fontFamily: MONO, fontSize: valueSize, fontVariantNumeric: "tabular-nums", color: cleared ? "var(--bg)" : "var(--neg)" }}>
                        {g.v}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {/* The live selection. Drawn over the bars rather than under them
                 -- at 4px a bar sitting on top of a tint is a bar you cannot
                 see the tint of -- and inert, so it never eats the mouseup. */}
            {sel && (
              <span style={{
                position: "absolute", top: 0, bottom: 0,
                left: selLo * pitch,
                width: (selHi - selLo + 1) * colW + (selHi - selLo) * gap,
                background: "var(--amber-dim)",
                border: "1px solid var(--amber-ring)",
                borderRadius: 3, pointerEvents: "none",
              }} />
            )}
            {/* The rule stops at the plot's right edge instead of running the
                full gutter. It used to extend under the tag, which was hidden
                only because the tag is a solid fill -- the moment the tag went
                outlined for an off-market line, the dashes crossed straight
                through the number. */}
            <span style={{
              position: "absolute", left: 0, right: 0, bottom: lineY,
              // Always white, at any line. A rule that changes colour when the
              // reader drags it reads as if the line itself now means
              // something different; the handle and the Line column already
              // say it has been moved.
              borderTop: "1.5px dashed var(--text)",
              pointerEvents: "none",
              transition: rawLine == null ? "bottom 120ms ease-out" : "none",
            }} />
            <span
              onMouseDown={canDrag ? startDrag : undefined}
              onDoubleClick={canDrag && adjusted ? () => onDragLine(null) : undefined}
              title={canDrag ? "Drag to test a different line · double-click to reset" : undefined}
              style={{
                position: "absolute", right: -GUT, bottom: lineY, transform: "translateY(50%)",
                // Opaque either way. An outlined-but-transparent tag let the
                // dashed rule show through the digits.
                background: adjusted ? "var(--surface-1)" : "var(--amber)",
                color: adjusted ? "var(--amber-ink)" : "#ffffff",
                border: `1px solid ${adjusted ? "var(--amber-ink)" : "var(--amber)"}`,
                borderRadius: 3, padding: "3px 7px", fontFamily: MONO, fontSize: 11,
                fontVariantNumeric: "tabular-nums", cursor: canDrag ? "ns-resize" : "default",
                userSelect: "none", touchAction: "none",
                // No transition mid-drag: the handle must sit exactly under the
                // cursor. It only eases on release, to settle onto the rung.
                transition: rawLine == null ? "bottom 120ms ease-out" : "none",
              }}
            >
              {line}
            </span>
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            {/* Each column says as much as it has room for, and the tiers are
                 measured (see showDate / showAbbr / discSize above). The full
                 line is always on the column's title, so nothing a dense chart
                 drops is actually gone. */}
            {games.map((g, i) => {
              const ink = g.opp ? mutedTeamColor(sport, g.opp) : "var(--dim)";
              const tint = g.opp ? mutedTeamColor(sport, g.opp, 0.15) : "transparent";
              return (
                <div key={i} title={`${venueAbbr(g.home, g.opp || "")} · ${g.date} · ${g.v}`} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: discSize ? 5 : 0 }}>
                  {discSize > 0 && (
                    <span style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: discSize, height: discSize, borderRadius: 999, background: tint,
                      border: `${discSize >= 20 ? 1.5 : 1}px solid ${ink}`, boxSizing: "border-box",
                    }}>
                      {/* The crest needs room to be a crest. Under that the
                           disc is the mark -- it is already the opponent's
                           colour, which is the half that still reads at 12px. */}
                      {discSize >= 18 && <TeamLogo sport={sport} abbr={g.opp} size={Math.round(discSize * 0.62)} />}
                    </span>
                  )}
                  {/* "@GB" for a road game, a bare "GB" at home -- see
                       lib/venue.js for why only one side is marked, and why a
                       log that never recorded a venue gets no marker at all. */}
                  {showAbbr && (
                    <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", color: ink, whiteSpace: "nowrap" }}>{venueAbbr(g.home, g.opp)}</span>
                  )}
                  {showDate && (
                    <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>{g.date}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* The thinned date axis, for the densities where no column can carry
               its own. Same flex geometry as the row above it, so a tick sits
               over the game it belongs to for free -- and the blank columns
               either side are what a centred label overflows into. Both
               benchmarks do exactly this on a full season. */}
          {dateTicks.size > 0 && (
            <div style={{ display: "flex", gap, marginTop: 7 }}>
              {games.map((g, i) => (
                <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center", overflow: "visible" }}>
                  {dateTicks.has(i) && (
                    <span style={{ fontFamily: MONO, fontSize: 9.5, color: "var(--dim)", whiteSpace: "nowrap" }}>{g.date}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
