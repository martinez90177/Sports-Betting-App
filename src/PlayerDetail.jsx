import React from "react";
import PlayerAvatar, { StatusPill } from "./PlayerAvatar.jsx";
import { mutedTeamColor, matchupTones } from "./lib/teamColors.js";
import TeamLogo from "./TeamLogo.jsx";
import { feedFormScale } from "./FormGraph.jsx";

// The v2 Player Detail furniture, built off the rendered mocks rather than
// described from them. `Player Detail MLB v2.dc.html` and
// `Player Detail NFL v2.dc.html` are structurally identical -- same seven
// centre blocks, same two rails -- so this is one layout the four sport pages
// feed, not four layouts.

const MONO = "pp-mono";
const LABEL = { fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" };

// ---------------------------------------------------------------------------
// 1. The matchup band.
//
// Away half | kickoff block | home half, each half carrying a 3px top border in
// its own team's colour -- the only place team colour appears at this size, and
// the reason the card reads as "this fixture" before any text is parsed.
//
// This is where first pitch and both records live. They are slate facts, and
// the prop builders that feed the rest of the page have never carried either
// (see usePlayerSlateGame). When the slate has no row for this fixture -- out
// of season, or a log opponent the slate disagrees with -- the whole card is
// absent rather than half-filled.
// ---------------------------------------------------------------------------
export function MatchupBand({ sport, away, home, dateLabel, timeLabel, venue }) {
  if (!away?.abbr || !home?.abbr) return null;

  // Paired, not per-team: two same-hue clubs -- Toronto's #134A8E against the
  // Yankees' #0C2340, both hue 214 -- drew two identical halves and the tint
  // stopped distinguishing anything. See matchupTones.
  const tones = matchupTones(sport, away.abbr, home.abbr);

  const half = (t, side, align, tone) => (
    <div
      style={{
        flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12,
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        padding: "16px 20px", borderTop: `3px solid ${tone}`,
      }}
    >
      {align === "right" && <TeamText t={t} side={side} align={align} />}
      {/* The badge keeps its 44px box and border; only the plate changes.
          --surface-2 is #191c21, which a navy crest disappears into -- the
          Yankees' mark on it was an empty box. Mixing --text into the plate
          lifts it in whichever direction the theme needs: a white wash under
          a dark logo, a dark one under a light logo, without freezing either. */}
      <span
        style={{
          flex: "none", width: 44, height: 44, borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "color-mix(in srgb, var(--text) 12%, var(--surface-2, var(--panel2)))",
          border: "1px solid var(--line)",
        }}
      >
        <TeamLogo sport={sport} abbr={t.abbr} size={30} title={t.name || t.abbr} />
      </span>
      {align !== "right" && <TeamText t={t} side={side} align={align} />}
    </div>
  );

  return (
    <div
      style={{
        display: "flex", alignItems: "stretch",
        border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)",
      }}
    >
      {half(away, "AWAY", "left", tones.away)}
      <div
        style={{
          flex: "none", display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 2, padding: "16px 18px", textAlign: "center",
        }}
      >
        {dateLabel && <span className={MONO} style={{ ...LABEL, fontSize: 9.5 }}>{dateLabel}</span>}
        <span className={MONO} style={{ fontSize: 17, color: "var(--text)", whiteSpace: "nowrap" }}>
          {timeLabel || "—"}
        </span>
        {venue && (
          <span className={MONO} style={{ ...LABEL, fontSize: 9.5, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {venue}
          </span>
        )}
      </div>
      {half(home, "HOME", "right", tones.home)}
    </div>
  );
}

function TeamText({ t, side, align }) {
  return (
    <div style={{ minWidth: 0, textAlign: align === "right" ? "right" : "left" }}>
      <div className={MONO} style={{ ...LABEL, fontSize: 9.5 }}>
        {/* The record only prints where the provider gave one. Opening night
            has no records and the mock shows none -- an absent value shows
            nothing, never a 0-0 we invented. */}
        {t.record ? `${side} · ${t.record}` : side}
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {t.name || t.abbr}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. The player header card.
//
// Team-colour left border, name + jersey, the identity line, the availability
// pill, usage pills, the role paragraph and a 3-up season panel.
//
// Every one of those is optional. The mock draws a jersey number and a role
// sentence this app has no source for on most sports; per the handoff's own
// rule an absent value shows nothing rather than a placeholder, so the slot
// simply collapses.
// ---------------------------------------------------------------------------
export function PlayerHeaderCard({
  sport, name, jersey, team, teamLabel, position, season,
  status, statusNote, onOpenStatus,
  avatar, usage = [], role, figures = [],
}) {
  return (
    <div
      style={{
        display: "flex", gap: 20, padding: "20px 22px",
        border: "1px solid var(--line)", borderLeft: `3px solid ${mutedTeamColor(sport, team)}`,
        borderRadius: 6, background: "var(--panel)",
      }}
    >
      {avatar}

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span className="oswald" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>{name}</span>
          {jersey != null && (
            <span className={MONO} style={{ fontSize: 19, color: "var(--dim)" }}>#{jersey}</span>
          )}
        </div>

        {/* The identity line leads with the crest: [logo] NEW YORK YANKEES ·
            CF · 2026. It is the one place on the page that names the player's
            own team, and a 22px mark reads faster than the words after it. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
          <TeamLogo sport={sport} abbr={team} size={22} title={teamLabel} />
          <span className={MONO} style={LABEL}>
            {[teamLabel, position, season].filter(Boolean).join(" · ")}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 11 }}>
          {/* The pill is the whole of what "injury and news" used to be on this
              page. The headline timeline moved to News, which owns headlines
              and carries the injury wire; clicking through goes there filtered
              to this player rather than duplicating the thread here. */}
          {onOpenStatus && status ? (
            <span
              role="button"
              tabIndex={0}
              onClick={onOpenStatus}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenStatus(); } }}
              title="See this player's headlines in News"
              style={{ cursor: "pointer", display: "inline-flex" }}
            >
              <StatusPill status={status} note={statusNote} />
            </span>
          ) : (
            <StatusPill status={status} note={statusNote} />
          )}

          {usage.filter((u) => u && u.value != null).map((u) => (
            <span
              key={u.label}
              className={MONO}
              style={{
                fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                color: "var(--text-2)", border: "1px solid var(--line)", borderRadius: 4,
                padding: "5px 9px", whiteSpace: "nowrap",
              }}
            >
              {u.label} <span style={{ color: "var(--text)" }}>{u.value}</span>
            </span>
          ))}
        </div>

        {role && (
          <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--text-2)", maxWidth: 460 }}>
            {role}
          </p>
        )}
      </div>

      {figures.length > 0 && (
        <div style={{ flex: "none", display: "flex", gap: 22, alignItems: "flex-start" }}>
          {figures.map((f) => (
            <div key={f.label} style={{ textAlign: "right" }}>
              <div className={MONO} style={{ fontSize: 22, fontVariantNumeric: "tabular-nums", color: "var(--text)" }}>{f.value}</div>
              <div className={MONO} style={{ ...LABEL, fontSize: 9.5, marginTop: 4 }}>{f.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Game by game.
//
// Not recharts. The mock draws a CSS grid: a band behind every column, the
// bar's own value printed inside its foot, and the opponent + date under the
// axis. Cleared bars are filled, fell-short bars are a 1px outline with no
// fill -- the device that survives a reader re-tinting the outcome colours,
// which is why it outranks every other detail in here. The prop line is a
// white dashed rule, never the accent.
// ---------------------------------------------------------------------------
// "Aug 19", not "2026-08-19". The axis has ~40px per column; an ISO date wears
// all of it and still ellipses, and the year is the same on every bar anyway.
function axisDate(d) {
  if (!d) return "";
  const t = Date.parse(typeof d === "string" && d.length === 10 ? `${d}T12:00:00` : d);
  if (Number.isNaN(t)) return String(d).slice(5);
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Room for the line tag, which hangs off the plot's right edge.
const GUTTER = 52;
// Columns are flex:1 like the mock's, but a season log is four times the
// seventeen games it draws; below this the bars become slivers, so the plot
// scrolls inside its own box instead of collapsing.
const MIN_COL = 26;

export function GameByGameChart({
  sport, games = [], line, isBinary = false, straightRun = 0, direction = "over",
  height = 224, gap = 6,
  // The drag. `marketLine` is the posted number, `line` is what is currently
  // drawn -- they differ only while the reader is exploring.
  marketLine, onDragLine, adjusted = false, draggable = false,
}) {
  if (!games.length || line == null) return null;

  const recent = games.map((g) => ({ v: g.v }));
  const scale = feedFormScale(recent, line, isBinary, { height, pedestal: 0 });
  const hit = (v) => (direction === "under" ? v < line : v > line);
  const lineY = Math.max(1, Math.min(height - 1, scale.y(line)));

  // Ported from the Prop Feed's startLineDrag, deliberately unchanged.
  //
  // The scale is measured against the *market* line, not the live one, so the
  // axis and the step do not shift under the handle mid-drag. Both limits are
  // a whole number of steps off the market line and the clamp is applied to
  // the step count rather than to the value: clamping the value directly is
  // what once let the handle stop on a whole number at the top of a passing-
  // yards axis -- a line this app never posts, because a whole number can
  // push. Snapping to whole steps off the market line is what preserves the
  // half-value by construction.
  const canDrag = draggable && !isBinary && marketLine != null && typeof onDragLine === "function";
  const startLineDrag = (e) => {
    if (!canDrag) return;
    e.preventDefault();
    e.stopPropagation();
    const { unit, step, dragMax } = feedFormScale(recent, marketLine, isBinary, { height, pedestal: 0 });
    const startY = e.clientY;
    const startVal = line;
    const maxSteps = Math.floor((dragMax - marketLine) / step);
    const minSteps = Math.ceil((0.25 - marketLine) / step);
    const move = (ev) => {
      const raw = startVal + (startY - ev.clientY) / unit;
      const steps = Math.min(maxSteps, Math.max(minSteps, Math.round((raw - marketLine) / step)));
      onDragLine(marketLine + steps * step);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", padding: "16px 20px 14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        <span className="oswald" style={{ fontSize: 16, fontWeight: 600 }}>Game by game</span>
        <span className={MONO} style={{ ...LABEL, fontSize: 9.5 }}>oldest to newest · bar height is the number</span>
        {straightRun > 0 && (
          <span className={MONO} style={{ marginLeft: "auto", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-2)" }}>
            {straightRun} straight {direction === "under" ? "under" : "over"}
          </span>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        {/* 52px of right gutter for the line tag, which hangs outside the plot
            (`right:-52px` in the mock) rather than overlapping the last bar. */}
        <div style={{ position: "relative", paddingRight: GUTTER, minWidth: games.length * (MIN_COL + gap) + GUTTER }}>
          <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap, height }}>
            {games.map((g, i) => {
              const cleared = hit(g.v);
              const h = Math.max(3, Math.round(scale.y(g.v)));
              return (
                <div
                  key={i}
                  style={{
                    flex: 1, minWidth: MIN_COL,
                    display: "flex", flexDirection: "column", justifyContent: "flex-end",
                    // No column band. Tinted columns -- alternating or not --
                    // read as rendering artefacts rather than as a countable
                    // rhythm, so the plot sits flat on the card's own
                    // --surface-1. Removed from all five player-detail mocks
                    // too, so the design files and this agree.
                  }}
                >
                  <div
                    style={{
                      display: "flex", alignItems: "flex-end", justifyContent: "center",
                      height: h, borderRadius: "3px 3px 0 0", boxSizing: "border-box",
                      paddingBottom: 8,
                      background: cleared ? "var(--pos-solid, var(--pos))" : "transparent",
                      border: cleared ? "none" : "1.5px solid var(--neg)",
                    }}
                  >
                    <span
                      className={MONO}
                      style={{
                        fontSize: 14, lineHeight: 1, fontVariantNumeric: "tabular-nums",
                        // Rule-based, not a token: the ink on a filled bar has
                        // to survive whatever --pos is re-tinted to, and the
                        // outline bar's number is the outline's own colour.
                        color: cleared ? "var(--bg, #0a0b0d)" : "var(--neg)",
                      }}
                    >
                      {g.v}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Off-market, the rule and its tag go --amber-ink so the reader
                can never mistake an explored number for the posted one. */}
            <span style={{
              position: "absolute", left: 0, right: -GUTTER, bottom: lineY,
              borderTop: `1.5px dashed ${adjusted ? "var(--amber-ink)" : "var(--text)"}`,
              pointerEvents: "none",
            }} />
            <span
              className={MONO}
              onMouseDown={canDrag ? startLineDrag : undefined}
              onDoubleClick={canDrag && adjusted ? () => onDragLine(null) : undefined}
              title={canDrag ? "Drag to test a different line · double-click to reset" : undefined}
              style={{
                position: "absolute", right: -GUTTER, bottom: lineY, transform: "translateY(50%)",
                background: adjusted ? "transparent" : "var(--amber)",
                color: adjusted ? "var(--amber-ink)" : "#ffffff",
                border: `1px solid ${adjusted ? "var(--amber-ink)" : "var(--amber)"}`,
                borderRadius: 3, padding: "3px 7px", fontSize: 11, fontVariantNumeric: "tabular-nums",
                cursor: canDrag ? "ns-resize" : "default", userSelect: "none",
              }}
            >
              {line}
            </span>
          </div>

          {/* The axis. Each column names its opponent in that team's own colour,
              desaturated (see mutedTeamColor) so it cannot be mistaken for the
              cleared/fell-short pair the bars above are using. */}
          <div style={{ display: "flex", gap, marginTop: 10, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            {games.map((g, i) => {
              const ink = g.opp ? mutedTeamColor(sport, g.opp) : "var(--dim)";
              const tint = g.opp ? mutedTeamColor(sport, g.opp, 0.15) : "transparent";
              return (
                <div key={i} style={{ flex: 1, minWidth: MIN_COL, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  {/* The crest inside the tinted disc the design draws -- the
                      ring and tint stay, so the opponent is identifiable by
                      mark and by colour even where a logo fails to load. */}
                  <span style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 26, height: 26, borderRadius: 999,
                    background: tint, border: `1.5px solid ${ink}`, boxSizing: "border-box",
                  }}>
                    <TeamLogo sport={sport} abbr={g.opp} size={16} />
                  </span>
                  <span className={MONO} style={{ fontSize: 11, letterSpacing: "0.06em", color: ink, whiteSpace: "nowrap" }}>
                    {g.opp || ""}
                  </span>
                  <span className={MONO} style={{ fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>
                    {axisDate(g.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rails.
//
// Lineup state rides the avatar's ring (solid posted, dashed projected, none
// unknown); availability keeps the corner dot, because availability is the one
// fact all four leagues report and lineups are MLB-only. The legend below says
// so in the mock's own words -- including "never assumed", which is the clause
// that matters.
// ---------------------------------------------------------------------------
export function RosterRail({ title, players = [], sport, colorMap, legend }) {
  return (
    <div>
      <div className={MONO} style={LABEL}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {players.map((p) => (
          <div
            key={p.id || p.name}
            role={p.onSelect ? "button" : undefined}
            tabIndex={p.onSelect ? 0 : undefined}
            onClick={p.onSelect}
            onKeyDown={p.onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onSelect(); } } : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: 10,
              borderRadius: 6, border: `1px solid ${p.active ? "var(--amber)" : "var(--line)"}`,
              background: p.active ? "var(--amber-dim, transparent)" : "transparent",
              cursor: p.onSelect ? "pointer" : "default", minWidth: 0,
            }}
          >
            <PlayerAvatar
              name={p.name}
              team={p.team}
              sport={sport}
              colorMap={colorMap}
              espnId={p.espnId}
              headshotSrc={p.headshotSrc}
              fallbackSrc={p.fallbackSrc}
              status={p.status}
              lineup={p.lineup}
              size={32}
              surface="var(--bg)"
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </div>
              <div className={MONO} style={{ fontSize: 9.5, color: "var(--dim)", marginTop: 2, whiteSpace: "nowrap" }}>
                {[p.position, p.stat].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
        ))}
      </div>
      {legend && (
        <div className={MONO} style={{ fontSize: 10, lineHeight: 1.6, color: "var(--dim)", marginTop: 12 }}>
          {legend}
        </div>
      )}
    </div>
  );
}

export function ReadingTheGraph() {
  const row = (swatch, text) => (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      {swatch}
      <span className={MONO} style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-2)" }}>{text}</span>
    </div>
  );
  return (
    <div>
      <div className={MONO} style={LABEL}>Reading the graph</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
        {row(<span style={{ width: 11, height: 11, borderRadius: 2, background: "var(--pos-solid, var(--pos))" }} />, "Cleared the line")}
        {row(<span style={{ width: 11, height: 11, borderRadius: 2, border: "1px solid var(--neg)" }} />, "Fell short")}
        {row(<span style={{ width: 11, borderTop: "1px dashed var(--text)" }} />, "The line")}
      </div>
      <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--dim)", marginTop: 12 }}>
        Bar height is the actual number, so a blowout doesn&rsquo;t read like a squeaker.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The page shell: breadcrumb, then 196 | 1fr | 196.
// ---------------------------------------------------------------------------
export function PlayerDetailLayout({ breadcrumb, left, children, right }) {
  return (
    <>
      {breadcrumb}
      <div
        className="pd-grid"
        style={{
          display: "grid", gridTemplateColumns: "196px minmax(0, 1fr) 196px",
          gap: 20, alignItems: "start", padding: "20px 32px 40px",
        }}
      >
        <div style={{ minWidth: 0 }}>{left}</div>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
        <div style={{ minWidth: 0 }}>{right}</div>
      </div>
    </>
  );
}

export function PlayerDetailBreadcrumb({ onBack, fixture, actions }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 32px", borderBottom: "1px solid var(--line)" }}>
      <span
        role="button"
        tabIndex={0}
        onClick={onBack}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack(); } }}
        className={MONO}
        style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-2)", cursor: "pointer", whiteSpace: "nowrap" }}
      >
        ← Prop feed
      </span>
      <span className={MONO} style={{ flex: 1, textAlign: "center", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dim)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {fixture}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>{actions}</span>
    </div>
  );
}
