import React from "react";
import { crest } from "./FormPlot.jsx";

// A transcription of frame `2f` in `v3 Mocks/PropPalace Desktop v3.dc.html`.
//
// The crumb bar, the probables, then two halves: RECENT FORM as two team
// panels side by side, and HEAD TO HEAD above PROPS WITH A READ. Same props
// `MatchupMobile` takes, off the same slate and the same logs.
//
// The frame's own closing sentence is the whole screen's premise: no money
// line, no run line, no public split. There is no odds feed here, so there is
// nothing to show rather than a number borrowed from somewhere else.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const micro = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };
const card = {
  border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)",
  display: "flex", flexDirection: "column",
};

function chip(on) {
  return {
    minHeight: 30, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 7,
    fontFamily: MONO, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
    background: on ? "var(--amber-dim)" : "var(--surface-1)",
    color: on ? "var(--amber-ink)" : "var(--text-2)",
  };
}

export default function MatchupDesktop({
  sport,
  onBack,
  onOpenBoard,
  state,
  live = false,
  venue,
  sides = [],
  probables = null,
  probableNote = null,
  depth,
  depths = [],
  onSetDepth,
  form = [],
  h2h = null,
  reads,
  readScope = null,
  onOpenRead,
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

  const away = sides[0] || {};
  const home = sides[1] || {};

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
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 14, padding: "14px 28px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
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
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span role="img" style={crest(away.abbr, sport, 26)} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22 }}>{away.abbr}</span>
          <span style={{ fontFamily: "'Archivo', system-ui, sans-serif", fontWeight: 700, color: "var(--amber-ink)", padding: "0 5px" }}>@</span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22 }}>{home.abbr}</span>
          <span role="img" style={crest(home.abbr, sport, 26)} />
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", padding: "4px 9px", borderRadius: 5,
          background: live ? "var(--neg-dim)" : "var(--amber-dim)",
          color: live ? "var(--neg)" : "var(--amber-ink)",
        }}>
          {state}
        </span>
        {venue && <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>{venue}</span>}
        {onOpenBoard && (
          <span
            role="button"
            tabIndex={0}
            onClick={onOpenBoard}
            onKeyDown={(e) => { if (e.key === "Enter") onOpenBoard(); }}
            style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", color: "var(--amber-ink)", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            OPEN BOARD →
          </span>
        )}
      </div>

      <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "20px 28px 30px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* ---- probables ------------------------------------------------- */}
        {probables && probables.length > 0 && (
          <div style={{ flex: "0 0 auto", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
            {probables.map((p) => (
              <div key={p.side} style={{ ...card, flexDirection: "row", alignItems: "center", gap: 12, padding: "14px 16px" }}>
                <span style={{ position: "relative", flex: "0 0 auto" }}>{renderAvatar ? renderAvatar(p, 40) : null}</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span style={micro}>{p.side}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>
                    {[p.hand, p.line].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
        {probableNote && (
          <span style={{ flex: "0 0 auto", fontSize: 11.5, lineHeight: 1.45, color: "var(--dim)" }}>{probableNote}</span>
        )}

        {/* ---- recent form ----------------------------------------------- */}
        {form.length > 0 && (
          <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={micro}>RECENT FORM</span>
              <div style={{ display: "flex", gap: 7 }}>
                {depths.map((d) => (
                  <div
                    key={d}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSetDepth && onSetDepth(d)}
                    onKeyDown={(e) => { if (e.key === "Enter") onSetDepth && onSetDepth(d); }}
                    style={chip(depth === d)}
                  >
                    {`L${d}`}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
              {form.map((fm) => (
                <div key={fm.abbr} style={card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 15px", borderBottom: "1px solid var(--line)" }}>
                    <span role="img" style={crest(fm.abbr, sport, 20)} />
                    <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15 }}>{fm.abbr}</span>
                    {/* The record over the window the chips name, not the
                        season's — the label above says which. */}
                    <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>{fm.record}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {(fm.games || []).map((g, i) => (
                      <div key={`${g.opp}${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 15px", borderBottom: i === (fm.games.length - 1) ? "none" : "1px solid #20242b" }}>
                        <span style={{
                          fontFamily: MONO, fontSize: 10, fontWeight: 700, width: 18, textAlign: "center",
                          color: g.res === "W" ? "var(--pos)" : g.res === "L" ? "var(--neg)" : "var(--dim)",
                        }}>
                          {g.res}
                        </span>
                        <span style={{ display: "flex", alignItems: "baseline", gap: 3, fontFamily: MONO, fontSize: 11, color: "var(--text-2)" }}>
                          {g.away && <span style={{ color: "var(--dim)" }}>@</span>}
                          <span>{g.opp}</span>
                        </span>
                        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>{g.score}</span>
                      </div>
                    ))}
                    {(!fm.games || fm.games.length === 0) && (
                      <div style={{ padding: "14px 15px", fontSize: 12, color: "var(--dim)" }}>No finished games in this window.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- head to head, and the props with a read -------------------- */}
        <div style={{ flex: "0 0 auto", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, alignItems: "start" }}>
          <div style={{ ...card, padding: "14px 16px", gap: 12 }}>
            <span style={micro}>HEAD TO HEAD</span>
            {h2h && h2h.cells ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${h2h.cells.length}, minmax(0, 1fr))`, gap: 10 }}>
                  {h2h.cells.map((c) => (
                    <div key={c.label} style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
                      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: "var(--dim)" }}>{c.label}</span>
                      <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700 }}>{c.value}</span>
                    </div>
                  ))}
                </div>
                {/* Why last year is not folded in, said rather than assumed. */}
                <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--dim)" }}>{h2h.note}</span>
              </>
            ) : (
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)" }}>
                These two have not met this season, so there is nothing to count.
              </span>
            )}
          </div>

          <div style={{ ...card, padding: "14px 16px", gap: 11 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={micro}>PROPS WITH A READ</span>
              {readScope && <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{readScope}</span>}
            </div>

            {reads === undefined && (
              <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>Reading the logs…</span>
            )}
            {reads && reads.length === 0 && (
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)" }}>
                Nothing on this game clears a bar worth naming yet.
              </span>
            )}
            {(reads || []).map((r) => (
              <div
                key={r.key}
                role={onOpenRead ? "button" : undefined}
                tabIndex={onOpenRead ? 0 : undefined}
                onClick={onOpenRead ? () => onOpenRead(r) : undefined}
                onKeyDown={onOpenRead ? (e) => { if (e.key === "Enter") onOpenRead(r); } : undefined}
                style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 0", borderBottom: "1px solid #20242b", cursor: onOpenRead ? "pointer" : "default" }}
              >
                <span style={{ position: "relative", flex: "0 0 auto" }}>{renderAvatar ? renderAvatar(r, 32) : null}</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                    {r.team && <span role="img" style={crest(r.team, r.sport, 14)} />}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.prop}</span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "0 0 auto" }}>
                  <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: r.rate >= 0.7 ? "var(--pos)" : "var(--text)" }}>
                    {`${Math.round(r.rate * 100)}%`}
                  </span>
                  {/* The sample never travels without the rate, and a thin one
                      says so instead of being quietly equal to a deep one. */}
                  <span style={{ fontFamily: MONO, fontSize: 10, color: r.thin ? "var(--status-questionable)" : "var(--dim)" }}>
                    {r.thin ? `${r.hits} of ${r.n} · thin` : `${r.hits} of ${r.n}`}
                  </span>
                </span>
              </div>
            ))}

            <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--dim)" }}>
              No money line, run line or public split here — this app reads no odds feed, so there is nothing to show rather than a number borrowed from somewhere else.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
