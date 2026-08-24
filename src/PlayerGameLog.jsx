import React from "react";
import TeamLogo from "./TeamLogo.jsx";
import { venueAbbr } from "./lib/venue.js";
import { mutedTeamColor } from "./lib/teamColors.js";

const MONO = "'Space Mono', ui-monospace, monospace";

// The games, listed. Competitive brief item 1, mock 3a.
//
// The chart above this plots the same log; it does not list it. Those are
// different jobs: a bar answers "what is the shape of the season", a row
// answers "what happened on May 17, and against whom". Outlier and
// PropsMadness both ship the table under the chart, and the whole argument of
// this app is "we show you the games behind the number" -- which it was
// plotting and never stating.
//
// The rule that shapes it: a game the active split excludes stays in the list,
// struck through. CLAUDE.md rule 4 -- nothing is ever silently dropped -- and
// the split filters were the one place the page broke it. Turning on "Home
// only" made nine games cease to exist with no acknowledgement that they had.
// Struck through, the reader can see what the split cost them.
const HEAD = {
  fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em",
  textTransform: "uppercase", color: "var(--dim)",
};

// One grid, declared once, used by the header and every row -- the columns
// cannot drift out of alignment because there is only one of them.
const GRID = "84px minmax(0,1fr) 62px 54px 84px";

// The logged games arrive with their dates already shortened by the page.
// The upcoming one does not: it comes straight off a slate row, where the
// date is a full ISO timestamp, and it printed as
// "2026-09-13T17:00:00Z" in a column of "Sep 8"s. Normalised here rather than
// at the four call sites, because it is the table that decided the column is
// six characters wide.
function shortDate(v) {
  if (!v) return "";
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// This season and last, side by side. Item 5 of the competitive brief.
//
// The current season leads by position and by weight -- larger type, full
// ink -- because the app's standing rule is that the current season outranks
// every prior one (see LOG_SCOPE_DEFAULT, which scopes every number on the
// page to it). Showing them side by side is not a reversal of that rule; it
// is the rule made visible instead of silent.
//
// Early in a season the current cell is a handful of games, and it says so
// with its own count rather than being quietly blended into one "Season"
// figure that is mostly last year. That blending is the failure this exists
// to prevent, and it is why the two are never summed.
export function SeasonSplit({ seasons = [] }) {
  if (seasons.length < 2) return null;
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      {seasons.map((s, i) => (
        <div
          key={s.label}
          style={{
            flex: 1, minWidth: 0,
            paddingLeft: i === 0 ? 0 : 18,
            marginLeft: i === 0 ? 0 : 18,
            borderLeft: i === 0 ? "none" : "1px solid var(--line)",
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: s.current ? "var(--text-2)" : "var(--dim)" }}>
            {s.label}{s.current ? " · this season" : " · last season"}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 6 }}>
            <span style={{
              fontFamily: MONO,
              fontSize: s.current ? 22 : 16,
              fontVariantNumeric: "tabular-nums",
              color: s.rate == null ? "var(--dim)" : s.current ? "var(--text)" : "var(--text-2)",
            }}>
              {s.rate == null ? "—" : `${Math.round(s.rate * 100)}%`}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>
              {s.n ? `${s.hits} of ${s.n}` : "no games"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PlayerGameLog({
  sport,
  rows = [],
  line,
  isBinary = false,
  direction = "over",
  upcoming = null,
  open,
  onToggle,
  unit = "games",
}) {
  if (!rows.length) return null;

  const counted = rows.filter((r) => !r.excluded);
  const glyph = open ? "−" : "+";

  // Newest first. The chart runs oldest-to-newest because a season reads
  // left-to-right; a list reads top-down and the most recent game is the one
  // being asked about, so it leads. The footnote says so rather than leaving
  // the reader to infer which way round it is.
  const ordered = rows.slice().reverse();

  return (
    <div style={{ marginTop: 18 }}>
      <div
        role="button" tabIndex={0} aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "11px 0",
          borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
          cursor: "pointer", minHeight: "var(--tap, 44px)", boxSizing: "border-box",
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--amber-ink)", width: 12 }}>{glyph}</span>
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text)" }}>
          Game by game
        </span>
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)" }}>
          {counted.length} {unit}
          {counted.length !== rows.length ? ` · ${rows.length - counted.length} excluded` : ""}
          {upcoming ? " · 1 upcoming" : ""}
        </span>
      </div>

      {open && (
        <div className="pp-log-scroll" style={{ maxHeight: 340, overflowY: "auto" }}>
          <div style={{
            display: "grid", gridTemplateColumns: GRID, gap: 10, padding: "10px 2px",
            position: "sticky", top: 0, background: "var(--bg)", borderBottom: "1px solid var(--line)", zIndex: 1,
          }}>
            <span style={HEAD}>Date</span>
            <span style={HEAD}>Opponent</span>
            <span style={{ ...HEAD, textAlign: "right" }}>Result</span>
            <span style={{ ...HEAD, textAlign: "right" }}>Line</span>
            <span style={{ ...HEAD, textAlign: "right" }}>{isBinary ? "Hit" : "Over / under"}</span>
          </div>

          {ordered.map((r, i) => {
            const cleared = isBinary
              ? r.v === 1
              : (direction === "under" ? r.v < line : r.v > line);
            const ink = r.opp ? mutedTeamColor(sport, r.opp) : "var(--dim)";
            return (
              <div
                key={`${r.date}-${i}`}
                style={{
                  display: "grid", gridTemplateColumns: GRID, gap: 10, alignItems: "center",
                  padding: "9px 2px", borderBottom: "1px solid var(--line)",
                  opacity: r.excluded ? 0.45 : 1,
                }}
                title={r.excluded ? "Excluded by the filters above — listed, not counted" : undefined}
              >
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim-strong)", fontVariantNumeric: "tabular-nums" }}>
                  {r.date}{r.po ? " · PO" : ""}
                </span>
                <span style={{
                  display: "flex", alignItems: "center", gap: 7, minWidth: 0,
                  textDecoration: r.excluded ? "line-through" : "none",
                }}>
                  {r.opp && <TeamLogo sport={sport} abbr={r.opp} size={16} />}
                  <span style={{ fontFamily: MONO, fontSize: 11, color: ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.opp ? venueAbbr(r.home, r.opp) : "—"}
                  </span>
                </span>
                <span style={{
                  fontFamily: MONO, fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums",
                  color: cleared ? "var(--pos)" : "var(--neg)",
                }}>
                  {isBinary ? (r.v === 1 ? "Yes" : "No") : r.v}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11, textAlign: "right", color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>
                  {isBinary ? "—" : Number(line).toFixed(1)}
                </span>
                <span style={{
                  fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
                  textAlign: "right", color: cleared ? "var(--pos)" : "var(--neg)",
                }}>
                  {isBinary ? (r.v === 1 ? "Hit" : "Miss") : (cleared ? "Over" : "Under")}
                </span>
              </div>
            );
          })}

          {/* The next game, if the slate knows one. It has no result and says
              so with an em dash rather than a zero -- a zero here would be a
              finished game in which he did nothing. */}
          {upcoming && (
            <div style={{
              display: "grid", gridTemplateColumns: GRID, gap: 10, alignItems: "center",
              padding: "9px 2px", borderBottom: "1px solid var(--line)",
            }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim-strong)", fontVariantNumeric: "tabular-nums" }}>{shortDate(upcoming.date)}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                {upcoming.opp && <TeamLogo sport={sport} abbr={upcoming.opp} size={16} />}
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text)", whiteSpace: "nowrap" }}>
                  {upcoming.opp ? venueAbbr(upcoming.home, upcoming.opp) : "—"}
                </span>
              </span>
              <span style={{ fontFamily: MONO, fontSize: 12, textAlign: "right", color: "var(--dim)" }}>{"—"}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, textAlign: "right", color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>
                {isBinary ? "—" : Number(line).toFixed(1)}
              </span>
              <span style={{
                fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
                textAlign: "right", color: "var(--amber-ink)",
              }}>
                Upcoming
              </span>
            </div>
          )}

          <div style={{ fontFamily: MONO, fontSize: 9.5, color: "var(--dim)", padding: "11px 2px 0", lineHeight: 1.6 }}>
            One row per game, newest at the top.
            {counted.length !== rows.length
              ? " Games the active filters exclude stay listed and struck through rather than disappearing."
              : " Turn on a filter above and the games it excludes stay here, struck through."}
          </div>
        </div>
      )}
    </div>
  );
}
