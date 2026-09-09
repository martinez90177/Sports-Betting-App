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

