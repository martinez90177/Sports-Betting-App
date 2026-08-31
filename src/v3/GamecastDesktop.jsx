import React from "react";
import { crest } from "./FormPlot.jsx";

// A transcription of frame `2g` in `v3 Mocks/PropPalace Desktop v3.dc.html`.
//
// Score, linescore and leaders on the left; PROPS IN PLAY as a 392px rail on
// the right. Same props `GamecastMobile` takes, off the same poller.
//
// Two rules this screen exists to keep, both the provider's and not the
// clock's:
//
//   - A period that has not been played is blank, never a zero. `linescoreNote`
//     says so on screen whenever the grid contains one.
//   - A market the boxscore does not carry is named unfollowable rather than
//     estimated from something adjacent — that is `untracked` below, and the
//     names travel with the count.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

const micro = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };
const card = {
  border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)",
  display: "flex", flexDirection: "column",
};

export default function GamecastDesktop({
  onBack,
  state,
  live,
  clock,
  sides = [],
  linescore = null,
  linescoreNote = null,
  propsInPlay = [],
  untracked = 0,
  untrackedNames = [],
  leaders = [],
  sport,
  loading = false,
  renderAvatar,
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

  const cols = linescore && linescore.columns ? linescore.columns : [];

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
      {/* ---- crumb bar --------------------------------------------------- */}
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 14, padding: "14px 28px", borderBottom: "1px solid var(--line)" }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onBack}
          onKeyDown={(e) => { if (e.key === "Enter") onBack && onBack(); }}
          style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 34, padding: "0 13px 0 11px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-1)", color: "var(--amber-ink)", fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", cursor: "pointer" }}
        >
          ← GAMES
        </span>
        <span style={{ width: 1, height: 22, background: "var(--line)", display: "block" }} />
        <span style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", padding: "4px 9px", borderRadius: 5,
          background: live ? "var(--neg-dim)" : "rgba(139,152,171,0.14)",
          color: live ? "var(--neg)" : "var(--dim)",
        }}>
          {state}
        </span>
        {clock && <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>{clock}</span>}
        {/* Where the state comes from, said rather than implied by a spinner. */}
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: "var(--dim)" }}>
          {loading ? "REFRESHING…" : "FROM THE PROVIDER, NOT THE CLOCK"}
        </span>
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)", gridTemplateColumns: "minmax(0, 1fr) 392px" }}>
        {/* ---- score, linescore, leaders --------------------------------- */}
        <div className="nsb" style={{ overflowY: "auto", padding: "20px 24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...card, flex: "0 0 auto" }}>
            {sides.map((s, i) => (
              <div key={s.side || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: i === 0 ? "1px solid var(--line)" : "none" }}>
                <span role="img" style={crest(s.abbr, sport, 30)} />
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
                  <span style={{ fontSize: 17, fontWeight: s.lead ? 700 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                  {s.meta && <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>{s.meta}</span>}
                </span>
                {/* An em dash before first pitch — not a zero, which is a
                    score somebody made. */}
                <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: s.score == null ? "var(--dim)" : s.lead ? "var(--text)" : "var(--text-2)" }}>
                  {s.score == null ? "—" : s.score}
                </span>
              </div>
            ))}
          </div>

          {linescore && linescore.rows && linescore.rows.length > 0 && (
            <div style={{ ...card, flex: "0 0 auto", padding: "14px 16px", gap: 10 }}>
              <span style={micro}>LINESCORE</span>
              <div className="nsb" style={{ overflowX: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: `120px repeat(${cols.length}, minmax(28px, 1fr))`, rowGap: 6, columnGap: 4, minWidth: "min-content" }}>
                  <span />
                  {/* A column is { key, label, total } -- rendering the object
                      itself threw "Objects are not valid as a React child" and
                      took the whole page to its boundary. The total columns (R,
                      H, E) are marked so they read apart from the innings. */}
                  {cols.map((c) => (
                    <span key={c.key} style={{ fontFamily: MONO, fontSize: 10, color: c.total ? "var(--text-2)" : "var(--dim)", textAlign: "center" }}>{c.label}</span>
                  ))}
                  {linescore.rows.map((r) => (
                    <React.Fragment key={r.abbr}>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)" }}>{r.abbr}</span>
                      {r.cells.map((v, i) => (
                        // A blank cell is a period not played. It stays blank.
                        <span
                          key={cols[i] ? cols[i].key : i}
                          style={{ fontFamily: MONO, fontSize: 12, textAlign: "center", fontWeight: cols[i] && cols[i].total ? 700 : 400, color: "var(--text)" }}
                        >
                          {v}
                        </span>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              {linescoreNote && <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--dim)" }}>{linescoreNote}</span>}
            </div>
          )}

          {leaders.length > 0 && (
            <div style={{ ...card, flex: "0 0 auto", padding: "14px 16px", gap: 10 }}>
              <span style={micro}>LEADERS</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                {leaders.map((l) => (
                  <div key={l.cat} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: "var(--dim)" }}>{l.cat}</span>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
                      {l.team && <span role="img" style={crest(l.team, sport, 14)} />}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700 }}>{l.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ---- props in play --------------------------------------------- */}
        <div className="nsb" style={{ borderLeft: "1px solid var(--line)", overflowY: "auto", padding: "20px 20px 30px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={micro}>PROPS IN PLAY</span>
            <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
              {propsInPlay.length ? "FROM YOUR SLIP" : ""}
            </span>
          </div>

          {propsInPlay.length === 0 && (
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)" }}>
              Nothing on your slip is in this game.
            </span>
          )}

          {propsInPlay.map((p) => (
            <div key={p.id} style={{ ...card, padding: "12px 13px", flexDirection: "row", alignItems: "center", gap: 11 }}>
              <span style={{ position: "relative", flex: "0 0 auto" }}>{renderAvatar ? renderAvatar(p, 34) : null}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 auto" }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.prop}</span>
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "0 0 auto" }}>
                {/* What the boxscore says so far, against the line. Not a
                    projection of where it lands. */}
                <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700 }}>{p.soFar}</span>
                <span style={{
                  fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.06em",
                  color: p.state === "CLEARED" ? "var(--pos)" : p.state === "MISSED" ? "var(--neg)" : "var(--dim)",
                }}>
                  {p.state}
                </span>
              </span>
            </div>
          ))}

          {/* Named, not silently absent. A market the boxscore does not carry
              cannot be followed live, and estimating it from something
              adjacent would be inventing the number. */}
          {untracked > 0 && (
            <span style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--dim)", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              {`${untracked} ${untracked === 1 ? "leg" : "legs"} in this game cannot be followed live${untrackedNames.length ? ` — ${untrackedNames.join(", ")}` : ""}. The boxscore does not carry that market, and nothing here is estimated from a market that is adjacent to it.`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
