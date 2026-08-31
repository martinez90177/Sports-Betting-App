import React from "react";
import { crest } from "./FormPlot.jsx";

// A transcription of frame `2b` in `v3 Mocks/PropPalace Desktop v3.dc.html`.
//
// A 212px rail of LEAGUE / DATE / SHOW beside a three-across grid of game
// cards. It takes the same props `GamesMobile` does, off the same slate, so
// the two can never describe the same day differently.
//
// ---- Two departures ----
//
// The frame's team rows carry a moneyline — `al: "−138", hl: "+118"`. There is
// no odds feed here (`docs/PROJECT_NOTES.md`, "Free data only no fake edge":
// real book odds exist in exactly one place, and it is not this page), so the
// column is not drawn. Inventing a price to fill a column is the one thing
// this app does not do.
//
// The frame's rail has no search. The page does, it works, and it filters the
// slate — so it stays, at the top of the rail. Dropping a working control to
// match a mock that never had to carry one loses the reader something.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const railLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };

function railPill(on) {
  return {
    minHeight: 34, display: "flex", alignItems: "center", padding: "0 11px",
    borderRadius: 7, fontFamily: MONO, fontSize: 12, cursor: "pointer",
    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
    background: on ? "var(--amber-dim)" : "var(--surface-1)",
    color: on ? "var(--amber-ink)" : "var(--text-2)",
  };
}

// One swatch per state, and the live one is red because that is what live is
// everywhere else in the app — not because red means bad here.
const STATE_TONE = {
  all: null,
  live: "var(--neg)",
  pre: "var(--amber)",
  final: "var(--dim)",
};

export default function GamesDesktop({
  leagues = [],
  league,
  onSetLeague,
  query = "",
  onSetQuery,
  sampleQuery = null,
  dates = [],
  activeDate,
  onSetDate,
  states = [],
  state,
  onSetState,
  slateHeading,
  games = [],
  loading = false,
  emptyCopy = null,
  onOpenGame,
  propsCountFor,
}) {
  const frameRef = React.useRef(null);
  const [height, setHeight] = React.useState(null);
  React.useLayoutEffect(() => {
    const measure = () => {
      const el = frameRef.current;
      if (!el) return;
      setHeight(Math.max(420, Math.round(window.innerHeight - el.getBoundingClientRect().top)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const statusTone = (g) => (g.live
    ? { bg: "var(--neg-dim)", fg: "var(--neg)" }
    : g.done
      ? { bg: "rgba(139,152,171,0.14)", fg: "var(--dim)" }
      : { bg: "var(--amber-dim)", fg: "var(--amber-ink)" });

  return (
    <div
      ref={frameRef}
      style={{
        position: "relative",
        height: height == null ? "70vh" : height, minHeight: 0,
        display: "flex", flexDirection: "column",
        background: "var(--bg)", overflow: "hidden",
        borderTop: "1px solid var(--line)",
      }}
    >
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)", gridTemplateColumns: "212px minmax(0, 1fr)" }}>
        {/* ---- rail ------------------------------------------------------ */}
        <div className="nsb" style={{ borderRight: "1px solid var(--line)", overflowY: "auto", padding: "18px 16px 26px", display: "flex", flexDirection: "column", gap: 20 }}>
          {onSetQuery && (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <span style={railLabel}>SEARCH</span>
              <input
                value={query}
                onChange={(e) => onSetQuery(e.target.value)}
                // A placeholder is not a label: it disappears on the first
                // keystroke and screen readers may not announce it at all.
                aria-label="Search the slate"
                placeholder={sampleQuery ? `e.g. ${sampleQuery}` : "Team or city"}
                style={{
                  minHeight: 34, padding: "0 11px", borderRadius: 7,
                  border: "1px solid var(--line)", background: "var(--surface-1)",
                  color: "var(--text)", fontFamily: MONO, fontSize: 12, width: "100%", boxSizing: "border-box",
                }}
              />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <span style={railLabel}>LEAGUE</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {leagues.map((l) => (
                <div
                  key={l.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSetLeague && onSetLeague(l.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") onSetLeague && onSetLeague(l.id); }}
                  style={railPill(league === l.id)}
                >
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <span style={railLabel}>DATE</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {dates.map((d) => (
                <div
                  key={d.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSetDate && onSetDate(d.key)}
                  onKeyDown={(e) => { if (e.key === "Enter") onSetDate && onSetDate(d.key); }}
                  style={{ ...railPill(activeDate === d.key), justifyContent: "space-between", gap: 8 }}
                >
                  <span>{`${d.dow} ${d.day}`}</span>
                  {/* The count is this date's own slate, off the same array the
                      grid draws — a rail that promised games the grid then did
                      not have would be two answers to one question. Absent,
                      not zero, while the day is still loading. */}
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
                    {d.count == null ? "" : d.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <span style={railLabel}>SHOW</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {states.map((s) => {
                const tone = s.tone || STATE_TONE[s.id];
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSetState && onSetState(s.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") onSetState && onSetState(s.id); }}
                    style={railPill(state === s.id)}
                  >
                    {tone && <span style={{ width: 8, height: 8, borderRadius: 2, background: tone, display: "block", flex: "0 0 auto", marginRight: 9 }} />}
                    {s.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ---- the grid --------------------------------------------------- */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "baseline", gap: 11, padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ width: 3, height: 14, borderRadius: 2, background: "var(--amber)", display: "block", flex: "0 0 auto", alignSelf: "center" }} />
            <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 17 }}>{slateHeading}</span>
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>
              {`${games.length} ${games.length === 1 ? "game" : "games"}`}
            </span>
            {/* Said on the screen, not only in a comment: a game is live
                because the provider says so, never because the clock passed
                its start time. */}
            <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: "var(--dim)" }}>
              LIVE STATE COMES FROM THE PROVIDER, NEVER THE CLOCK
            </span>
          </div>

          <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "18px 24px 28px" }}>
            {loading && games.length === 0 && (
              <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>Loading the slate…</div>
            )}
            {!loading && games.length === 0 && emptyCopy && (
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--dim)", maxWidth: 520 }}>{emptyCopy}</div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
              {games.map((g) => {
                const tone = statusTone(g);
                const props = propsCountFor ? propsCountFor(g) : null;
                return (
                  <div
                    key={g.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenGame && onOpenGame(g)}
                    onKeyDown={(e) => { if (e.key === "Enter") onOpenGame && onOpenGame(g); }}
                    style={{
                      border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)",
                      overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px" }}>
                      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", padding: "4px 8px", borderRadius: 5, flex: "0 0 auto", whiteSpace: "nowrap", background: tone.bg, color: tone.fg }}>
                        {g.statusLabel}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {g.meta}
                      </span>
                      {props != null && (
                        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", whiteSpace: "nowrap" }}>
                          {`${props} props`}
                        </span>
                      )}
                    </div>

                    {g.teams.map((tm, i) => (
                      <div key={tm.side} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: i === 0 ? "1px solid #20242b" : "none" }}>
                        <span role="img" style={crest(tm.abbr, g.sport, 26)} />
                        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
                          <span style={{ fontSize: 14, fontWeight: tm.winning ? 700 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {tm.name || tm.abbr}
                          </span>
                          {/* Absent rather than "0-0" when the provider gave
                              no record. */}
                          {tm.record && (
                            <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{tm.record}</span>
                          )}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, flex: "0 0 auto", color: tm.score == null ? "var(--dim)" : tm.winning ? "var(--text)" : "var(--text-2)" }}>
                          {tm.score == null ? "—" : tm.score}
                        </span>
                      </div>
                    ))}

                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderTop: "1px solid #20242b" }}>
                      <span style={{ fontSize: 11.5, color: "var(--dim)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.note}</span>
                      <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "var(--amber-ink)", whiteSpace: "nowrap" }}>{g.cta}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
