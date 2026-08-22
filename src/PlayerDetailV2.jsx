import React from "react";
import { feedFormScale } from "./FormGraph.jsx";
import TeamLogo from "./TeamLogo.jsx";
import { mutedTeamColor, matchupTones } from "./lib/teamColors.js";

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
      {p.order != null && (
        <span
          title={`Batting ${p.order} in the posted lineup`}
          style={{
            flex: "none", width: 18, height: 18, borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid var(--line)", background: "var(--surface-sunken)",
            fontFamily: MONO, fontSize: 10, color: "var(--text-2)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {p.order}
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
  sport,
  // `crumbSelect` is the game switcher, rendered in place of the plain
  // fixture text. The mock prints the fixture as static type because it has
  // nowhere else to go; a real page needs a way off this game without going
  // back to the feed first, and the fixture line already names the game, so
  // it becomes the trigger rather than the page growing a region the mock
  // does not have. Falls back to the text when a page has no slate to offer.
  crumbFixture, crumbSelect, marketLabel, onBack, onWatch, watching,
  ownRail, oppRail,
  band,
  context,
  player,
  markets = [], filtersCount = 0, filtersOpen = false, onToggleFilters, filtersPanel,
  verdict,
  chart,
  footerNote, onAddPick, pickAdded,
}) {
  const tones = band && band.away && band.home
    ? matchupTones(sport, band.away.abbr, band.home.abbr)
    : { away: "var(--dim)", home: "var(--dim)" };

  return (
    <div style={{ width: "100%", maxWidth: 1600, margin: "0 auto", background: "var(--bg)", color: "var(--text)" }}>

      <div style={{ display: "flex", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid var(--line)" }}>
        <span
          role="button" tabIndex={0} onClick={onBack}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack(); } }}
          style={{ ...crumb, color: "var(--text-2)", cursor: "pointer" }}
        >
          ← Prop feed
        </span>
        <span style={{ ...crumb, margin: "0 auto", color: "var(--dim)" }}>
          {crumbSelect || crumbFixture} · <span style={{ color: "var(--text)" }}>{marketLabel}</span>
        </span>
        <span
          role="button" tabIndex={0} onClick={onWatch}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWatch && onWatch(); } }}
          style={{ ...crumb, color: "var(--amber-ink)", cursor: onWatch ? "pointer" : "default" }}
        >
          {watching ? "✓ Watching" : "+ Watch"}
        </span>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "196px minmax(0, 1fr) 196px",
        gap: 20, padding: "20px 32px 40px", alignItems: "start",
      }}>

        <div>
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
            <div style={{ flex: 1.3, minWidth: 0, padding: "12px 18px", borderLeft: "1px solid var(--line)" }}>
              <div style={cellLabel}>{context.parkLabel}</div>
              <div style={{ ...cellValue, overflow: "hidden", textOverflow: "ellipsis" }}>{context.park ?? "—"}</div>
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

          <div style={{ display: "flex", alignItems: "flex-end", gap: 26, marginTop: 20, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            {markets.map((m) => (
              <span
                key={m.id}
                role="button" tabIndex={0} onClick={m.onPick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); m.onPick(); } }}
                style={{
                  fontSize: 15, paddingBottom: 11, cursor: "pointer",
                  color: m.active ? "var(--text)" : "var(--dim)",
                  borderBottom: `2px solid ${m.active ? "var(--amber)" : "transparent"}`,
                  marginBottom: -1,
                }}
              >
                {m.label}
              </span>
            ))}
            <span
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
          <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "20px 0 30px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
              <span style={{ fontFamily: MONO, fontSize: 40, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: verdict.rateColor, flex: "none" }}>{verdict.rate}</span>
              <span style={{ fontSize: 15, color: "var(--text-2)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{verdict.sentence}</span>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 28, flex: "none" }}>
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
                <div style={{ ...metricLabel, display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                  Odds
                  {!verdict.odds && (
                    <span style={{ fontSize: 8.5, letterSpacing: "0.1em", color: "var(--dim)", border: "1px solid var(--line)", borderRadius: 3, padding: "1px 4px" }}>SOON</span>
                  )}
                </div>
                {/* TODO: a real feed fills this with { price, book, point,
                    fetchedAt } per player+market. Until then the cell is empty
                    -- never a price derived from the hit rate. */}
                <div style={{ ...metricValue, color: "var(--dim)" }}>{verdict.odds || "—"}</div>
              </div>
            </div>
            <span style={{
              flex: "none", fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "var(--amber-ink)", border: "1px solid var(--amber)", borderRadius: 4, padding: "11px 14px",
            }}>
              {verdict.sampleVerdict}
            </span>
          </div>

          <GameByGame sport={sport} {...chart} />

          {filtersOpen && filtersPanel}

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
          <div style={railLabel}>{oppRail.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {oppRail.players.map((p) => (
              <RosterRow key={p.id} p={p} sport={sport} onSelect={p.onSelect} />
            ))}
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
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
    </div>
  );
}

// The mock's own plot: 224px tall, gap 6, flex:1 columns, the value inside the
// bar foot, a 26px opponent disc under the axis, and the line tag hanging in a
// 52px right gutter. No column band -- removed from all five mocks.
function GameByGame({
  sport, games = [], line, isBinary, direction = "over", straightRun = 0,
  marketLine, onDragLine, adjusted, draggable,
}) {
  // Non-null only while a drag is in progress -- see startDrag.
  const [rawLine, setRawLine] = React.useState(null);
  if (!games.length || line == null) return null;
  const H = 224, GUT = 52, MIN_COL = 26;
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

  const startDrag = (e) => {
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
          oldest to newest · bar height is the number
        </span>
        {straightRun > 0 && (
          <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber-ink)" }}>
            {straightRun} straight {direction === "under" ? "under" : "over"}
          </span>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ position: "relative", paddingRight: GUT, minWidth: games.length * (MIN_COL + 6) + GUT }}>
          <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap: 6, height: H }}>
            {games.map((g, i) => {
              const cleared = hit(g.v);
              const h = Math.max(3, Math.round(scale.y(g.v)));
              return (
                <div key={i} style={{ flex: 1, minWidth: MIN_COL, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <div style={{
                    display: "flex", alignItems: "flex-end", justifyContent: "center", height: h,
                    borderRadius: "3px 3px 0 0", boxSizing: "border-box", paddingBottom: 8,
                    background: cleared ? "var(--pos-solid)" : "transparent",
                    border: cleared ? "none" : "1.5px solid var(--neg)",
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: 14, fontVariantNumeric: "tabular-nums", color: cleared ? "var(--bg)" : "var(--neg)" }}>
                      {g.v}
                    </span>
                  </div>
                </div>
              );
            })}
            {/* The rule stops at the plot's right edge instead of running the
                full gutter. It used to extend under the tag, which was hidden
                only because the tag is a solid fill -- the moment the tag went
                outlined for an off-market line, the dashes crossed straight
                through the number. */}
            <span style={{
              position: "absolute", left: 0, right: 0, bottom: lineY,
              borderTop: `1.5px dashed ${adjusted ? "var(--amber-ink)" : "var(--text)"}`,
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
            {games.map((g, i) => {
              const ink = g.opp ? mutedTeamColor(sport, g.opp) : "var(--dim)";
              const tint = g.opp ? mutedTeamColor(sport, g.opp, 0.15) : "transparent";
              return (
                <div key={i} style={{ flex: 1, minWidth: MIN_COL, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <span style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 26, height: 26, borderRadius: 999, background: tint,
                    border: `1.5px solid ${ink}`, boxSizing: "border-box",
                  }}>
                    <TeamLogo sport={sport} abbr={g.opp} size={16} />
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", color: ink, whiteSpace: "nowrap" }}>{g.opp}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>{g.date}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
