import React from "react";
import { crest } from "./FormPlot.jsx";

// A transcription of frame `2a` in `v3 Mocks/PropPalace Mobile v3.dc.html`.
//
// The slate, its polling, its statuses and its scores are `GamesPage`'s own and
// are untouched. This is the phone's layout: a league row, a team filter, a
// scrolling date rail with per-date counts, a state filter, and a stack of
// cards — each two team rows between a status header and a note.
//
// Live state comes from the provider, never from the clock: `status` decides
// which of the three card states is drawn, and a scheduled card shows no score.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

// The league's own tone on the slate heading. Muted, and deliberately nowhere
// near --pos/--neg: naming a league is not a claim about an outcome.
const LEAGUE_TONE = { mlb: "#6f7f9b", nfl: "#7f8b6f", nba: "#9b7f6f", wnba: "#8b6f9b" };

function barChip(sel) {
  return {
    minHeight: 40, display: "flex", alignItems: "center", padding: "0 14px",
    borderRadius: 8, fontFamily: MONO, fontSize: 12, whiteSpace: "nowrap",
    cursor: "pointer", flex: "0 0 auto",
    border: `1px solid ${sel ? "var(--amber)" : "var(--line)"}`,
    background: sel ? "var(--amber-dim)" : "var(--surface-1)",
    color: sel ? "var(--amber-ink)" : "var(--text)",
  };
}

export default function GamesMobile({
  leagues = [],
  league,
  onSetLeague,
  query,
  onSetQuery,
  // A real team on the slate, for the mock's tap-to-fill example.
  sampleQuery = null,
  dates = [],
  activeDate,
  onSetDate,
  states = [],
  state,
  onSetState,
  slateHeading,
  games = [],
  moreCount = 0,
  showAll,
  onToggleShowAll,
  emptyCopy = null,
  loading = false,
  onOpenGame,
  propsCountFor,
}) {
  return (
    <>
      <div
        style={{
          position: "sticky", top: 0, zIndex: 20, background: "var(--bg)",
          borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column",
        }}
      >
        <div className="nsb" style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto" }}>
          {leagues.map((l) => (
            <div key={l.id} onClick={() => onSetLeague(l.id)} style={barChip(l.id === league)}>{l.label}</div>
          ))}
        </div>

        <div style={{ padding: "0 16px 10px" }}>
          <span
            style={{
              display: "flex", alignItems: "center", gap: 9, minHeight: 44, padding: "0 13px",
              border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-1)",
            }}
          >
            <span style={{ color: "var(--dim)", fontSize: 13 }}>⌕</span>
            <input
              value={query}
              onChange={(e) => onSetQuery(e.target.value)}
              placeholder="Filter teams"
              style={{
                flex: "1 1 auto", minWidth: 0, fontFamily: MONO, fontSize: 12,
                color: "var(--text)", background: "transparent", border: "none", outline: "none",
              }}
            />
            {/* The mock's `gQueryAction`: CLEAR once something is typed, and
                before that a worked example you can tap. A search box whose
                only affordance is a placeholder does not tell you what it
                will match. */}
            <span
              onClick={() => onSetQuery(query ? "" : sampleQuery || "")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSetQuery(query ? "" : sampleQuery || ""); } }}
              style={{ marginLeft: "auto", flex: "0 0 auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "var(--amber-ink)", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {query ? "CLEAR" : `TRY \u201C${(sampleQuery || "").toUpperCase()}\u201D`}
            </span>
          </span>
        </div>

        <div className="nsb" style={{ display: "flex", gap: 8, padding: "0 16px 10px", overflowX: "auto" }}>
          {dates.map((d) => {
            const on = d.key === activeDate;
            return (
              <div
                key={d.key}
                onClick={() => onSetDate(d.key)}
                style={{
                  flex: "0 0 auto", minWidth: 62, minHeight: 58, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                  background: on ? "var(--amber-dim)" : "var(--surface-1)",
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: on ? "var(--amber-ink)" : "var(--dim)" }}>{d.dow}</span>
                <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: on ? "var(--text)" : "var(--text-2)" }}>{d.day}</span>
                {/* The count is only drawn for a date whose slate has actually
                    been loaded -- a "0 GP" on an unfetched day would be a
                    statement about the schedule we cannot make. */}
                <span style={{ fontFamily: MONO, fontSize: 10, color: on ? "var(--amber-ink)" : "var(--dim)" }}>
                  {d.count == null ? "" : `${d.count} GP`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="nsb" style={{ display: "flex", gap: 6, padding: "0 16px 10px", overflowX: "auto" }}>
          {states.map((s) => {
            const on = s.id === state;
            return (
              <div
                key={s.id}
                onClick={() => onSetState(s.id)}
                style={{
                  minHeight: 34, display: "flex", alignItems: "center", padding: "0 11px", borderRadius: 7,
                  fontFamily: MONO, fontSize: 11, whiteSpace: "nowrap", cursor: "pointer", flex: "0 0 auto",
                  border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                  background: on ? "var(--amber-dim)" : "var(--surface-1)",
                  color: on ? "var(--amber-ink)" : "var(--text-2)",
                }}
              >
                {/* "All games" carries no swatch: it is the absence of a
                    filter, not a state. */}
                {s.tone && (
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: s.tone, display: "block", flex: "0 0 auto", marginRight: 7 }} />
                )}
                {s.label}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px 30px" }}>
        {loading && <div style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--dim)" }}>Loading the slate…</div>}
        {!loading && games.length === 0 && emptyCopy && (
          <div style={{ border: "1px dashed var(--line)", borderRadius: 12, padding: "20px 16px", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.7, color: "var(--dim)" }}>
            {emptyCopy}
          </div>
        )}

        {games.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                width: 3, height: 13, borderRadius: 2, display: "block", flex: "0 0 auto",
                background: LEAGUE_TONE[league] || "var(--dim)",
              }}
            />
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>{slateHeading}</span>
            <span style={{ flex: "1 1 auto", borderTop: "1px solid #20242b" }} />
          </div>
        )}

        {games.map((g) => {
          const n = propsCountFor ? propsCountFor(g) : null;
          return (
            <div key={g.id} style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
                <span
                  style={{
                    fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", padding: "4px 8px", borderRadius: 5,
                    flex: "0 0 auto", whiteSpace: "nowrap",
                    background: g.live ? "rgba(239,91,91,0.16)" : g.done ? "rgba(139,152,171,0.14)" : "var(--amber-dim)",
                    color: g.live ? "var(--neg)" : g.done ? "var(--dim)" : "var(--amber-ink)",
                  }}
                >
                  {g.statusLabel}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {g.meta}
                </span>
                <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, color: "var(--amber-ink)", whiteSpace: "nowrap" }}>
                  {g.done ? "SETTLED" : n == null ? "" : `${n} PROPS`}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                {g.teams.map((tm) => (
                  <div
                    key={tm.side}
                    style={{
                      display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", minHeight: 44,
                      borderBottom: tm.side === "away" ? "1px solid #20242b" : "none",
                    }}
                  >
                    <span role="img" style={crest(tm.abbr, g.sport, 30)} />
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
                      <span
                        style={{
                          fontSize: 15, fontWeight: tm.winning ? 700 : 600, whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis",
                          color: tm.winning ? "var(--text)" : g.done ? "var(--text-2)" : "var(--text)",
                        }}
                      >
                        {tm.name}
                      </span>
                      {tm.record && <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>{tm.record}</span>}
                    </span>
                    {/* A scheduled card shows no score -- an em dash in the
                        grey the mock uses for "nothing here yet", not a 0. */}
                    <span
                      style={{
                        fontFamily: MONO, fontSize: 20, fontWeight: 700, flex: "0 0 auto",
                        minWidth: 26, textAlign: "right",
                        color: tm.score == null ? "#3a4048" : tm.winning ? "var(--pos)" : "var(--text-2)",
                      }}
                    >
                      {tm.score == null ? "—" : tm.score}
                    </span>
                  </div>
                ))}
              </div>

              <div
                onClick={() => onOpenGame(g)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenGame(g); } }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                  borderTop: "1px solid #20242b", cursor: "pointer", minHeight: 44,
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {g.note}
                </span>
                <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", color: "var(--amber-ink)", whiteSpace: "nowrap" }}>
                  {g.cta}
                </span>
              </div>
            </div>
          );
        })}

        {moreCount > 0 && (
          <div
            onClick={onToggleShowAll}
            style={{
              minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)",
              color: "var(--amber-ink)", fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", cursor: "pointer",
            }}
          >
            {showAll ? "SHOW FEWER GAMES" : `SHOW ${moreCount} MORE ${moreCount === 1 ? "GAME" : "GAMES"}`}
          </div>
        )}

        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.04em", lineHeight: 1.6, color: "var(--dim)" }}>
          Live state comes from the provider, never from the clock. Hit rates count finished games only.
        </span>
      </div>
    </>
  );
}
