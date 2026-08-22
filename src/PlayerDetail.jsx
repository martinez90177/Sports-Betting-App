import React from "react";
import PlayerAvatar, { StatusPill } from "./PlayerAvatar.jsx";
import { TEAM_COLORS_BY_SPORT, AVATAR_FALLBACK_COLORS } from "./lib/teamColors.js";
import { feedFormScale } from "./FormGraph.jsx";

// The v2 Player Detail furniture, built off the rendered mocks rather than
// described from them. `Player Detail MLB v2.dc.html` and
// `Player Detail NFL v2.dc.html` are structurally identical -- same seven
// centre blocks, same two rails -- so this is one layout the four sport pages
// feed, not four layouts.

const MONO = "pp-mono";
const LABEL = { fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" };

function teamColor(sport, abbr) {
  const c = (TEAM_COLORS_BY_SPORT[sport] || {})[abbr];
  return (c && c.primary) || AVATAR_FALLBACK_COLORS.primary;
}

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

  const half = (t, side, align) => (
    <div
      style={{
        flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12,
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        padding: "16px 20px", borderTop: `3px solid ${teamColor(sport, t.abbr)}`,
      }}
    >
      {align === "right" && <TeamText t={t} side={side} align={align} />}
      <span
        className={MONO}
        style={{
          flex: "none", width: 44, height: 44, borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--surface-2, var(--panel2))", border: "1px solid var(--line)",
          fontSize: 12, letterSpacing: "0.06em", color: "var(--text-2)",
        }}
      >
        {t.abbr}
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
      {half(away, "AWAY", "left")}
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
      {half(home, "HOME", "right")}
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
        border: "1px solid var(--line)", borderLeft: `3px solid ${teamColor(sport, team)}`,
        borderRadius: 6, background: "var(--panel)",
      }}
    >
      {avatar}

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span className="oswald" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>{name}</span>
          {jersey != null && (
            <span className={MONO} style={{ fontSize: 19, color: "var(--dim)" }}>{jersey}</span>
          )}
        </div>

        <div className={MONO} style={{ ...LABEL, marginTop: 5 }}>
          {[teamLabel, position, season].filter(Boolean).join(" · ")}
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

export function GameByGameChart({
  games = [], line, isBinary = false, straightRun = 0, direction = "over",
  height = 224, barWidth = 40, gap = 6,
}) {
  if (!games.length || line == null) return null;

  const recent = games.map((g) => ({ v: g.v }));
  const scale = feedFormScale(recent, line, isBinary, { height, pedestal: 0 });
  const hit = (v) => (direction === "under" ? v < line : v > line);
  const lineY = Math.max(1, Math.min(height - 1, scale.y(line)));

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
        <div style={{ minWidth: games.length * (barWidth + gap) }}>
          <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap, height }}>
            {games.map((g, i) => {
              const cleared = hit(g.v);
              const h = Math.max(3, Math.round(scale.y(g.v)));
              return (
                <div key={i} style={{ position: "relative", width: barWidth, height, flex: "none" }}>
                  {/* The band behind the column. It is what stops a short bar
                      from floating in space with nothing to read it against. */}
                  <span style={{
                    position: "absolute", inset: 0, borderRadius: "4px 4px 0 0",
                    background: "var(--surface-sunken, #101318)",
                  }} />
                  <span
                    style={{
                      position: "absolute", left: 0, right: 0, bottom: 0, height: h,
                      borderRadius: "3px 3px 0 0", boxSizing: "border-box",
                      display: "flex", alignItems: "flex-end", justifyContent: "center",
                      background: cleared ? "var(--pos-solid, var(--pos))" : "transparent",
                      border: cleared ? "none" : "1px solid var(--neg)",
                    }}
                  >
                    <span
                      className={MONO}
                      style={{
                        fontSize: 10.5, lineHeight: 1, padding: "0 0 5px",
                        fontVariantNumeric: "tabular-nums",
                        color: cleared ? "var(--accent-on, #08131c)" : "var(--neg)",
                      }}
                    >
                      {g.v}
                    </span>
                  </span>
                </div>
              );
            })}

            <span style={{
              position: "absolute", left: 0, right: 0, bottom: lineY,
              borderTop: "1px dashed var(--text)", pointerEvents: "none",
            }} />
            <span
              className={MONO}
              style={{
                position: "absolute", right: -2, bottom: lineY, transform: "translateY(50%)",
                background: "var(--amber)", color: "var(--accent-on, #fff)",
                borderRadius: 3, padding: "2px 5px", fontSize: 10, fontVariantNumeric: "tabular-nums",
              }}
            >
              {line}
            </span>
          </div>

          {/* Opponent and date under the axis, one per column. */}
          <div style={{ display: "flex", gap, marginTop: 8 }}>
            {games.map((g, i) => (
              <div key={i} style={{ width: barWidth, flex: "none", textAlign: "center", minWidth: 0 }}>
                <span style={{
                  display: "inline-block", width: 5, height: 5, borderRadius: "50%",
                  background: g.po ? "var(--text-2)" : "transparent",
                  border: g.po ? "none" : "1px solid var(--line)",
                }} />
                <div className={MONO} style={{ fontSize: 9.5, color: "var(--text-2)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {g.opp || ""}
                </div>
                <div className={MONO} style={{ fontSize: 9, color: "var(--dim)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {axisDate(g.date)}
                </div>
              </div>
            ))}
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
