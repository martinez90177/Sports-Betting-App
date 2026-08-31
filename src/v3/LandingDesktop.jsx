import React from "react";
import { crest } from "./FormPlot.jsx";
import { MiniStrip } from "./boardShared.jsx";
import AgeMark from "./AgeMark.jsx";

// A transcription of frame `2i` in `v3 Mocks/PropPalace Desktop v3.dc.html`.
//
// The pitch on the left, a live example row on the right, three claims across
// the bottom, and the compliance line under them.
//
// ---- No fabricated numbers, anywhere ----
//
// The mock's example row is Aaron Judge with `vals = [3, 1, 2, 4, 0, 2, 3, 2,
// 1, 4]` — a hand-written series, which is exactly what this app does not put
// under a real player's name. The row here is a **real prop off tonight's
// board**, the same `hero` the phone frame draws, so the two front doors quote
// the same one. Drag the tab and the rate and the sample move with it, because
// both are counted off that array.
//
// The strip is `MiniStrip` from boardShared — the Board's own graph, so the
// example on the front page is drawn by the code the product uses.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const micro = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };

// Season lengths, as the frame prints them beside each league.
const LEAGUES = [
  ["MLB", "162 GP"],
  ["NFL", "17 GP"],
  ["NBA", "82 GP"],
  ["WNBA", "44 GP"],
];

const CLAIMS = [
  {
    title: "Counted, not modelled",
    body: "A rate is games cleared over games played. Nothing is projected, smoothed or weighted.",
    tone: "var(--pos)",
  },
  {
    title: "Every sample stated",
    body: "No figure appears without the number of games behind it, and a thin sample says so instead of hiding.",
    tone: "var(--amber-ink)",
  },
  {
    title: "No odds feed, no prices",
    body: "Where a book price would go, this shows your own rate converted to odds — and says no book priced it.",
    tone: "var(--status-questionable)",
  },
];

export default function LandingDesktop({ hero, onOpenBoard, onOpenSettings, onOpenProp, onNavigate }) {
  const games = (hero && hero.recent) || [];
  const [line, setLine] = React.useState(null);
  React.useEffect(() => { setLine(null); }, [hero && hero.key]);
  const liveLine = hero == null ? null : (line == null ? hero.line : line);

  // Every figure on the card is counted off the same array against the same
  // line, so dragging the tab moves the rate and the sample with it.
  const hit = (v) => (hero && hero.direction === "under" ? v < liveLine : v > liveLine);
  const hits = games.filter((g) => hit(g.v)).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", display: "flex", flexDirection: "column" }}>
      {/* The frame draws its own header rather than the six-tab nav: the
          landing page is not one of the nav destinations, and lighting one up
          would claim you are somewhere you are not. */}
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 16, padding: "18px 32px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>Prop Palace</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <span
            role="button"
            tabIndex={0}
            onClick={onOpenSettings}
            onKeyDown={(e) => { if (e.key === "Enter") onOpenSettings && onOpenSettings(); }}
            style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--dim)", fontSize: 15, cursor: "pointer" }}
          >
            ⚙
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: "var(--dim)" }}>SIGN IN</span>
          <AgeMark radius={7} />
        </span>
      </div>

      <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "36px 32px 40px", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 560px", gap: 32, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 40, lineHeight: 1.12, letterSpacing: "-0.02em", margin: 0, textWrap: "balance" }}>
              Your own hit-rate research, before you place it.
            </h2>
            <span style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-2)", maxWidth: 560, textWrap: "pretty" }}>
              Every number here is a count of finished games. No model, no projections, no picks sold to you — and no odds feed, so nothing borrows a price from somewhere else.
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {LEAGUES.map(([label, meta]) => (
                <span key={label} style={{ display: "flex", alignItems: "baseline", gap: 7, minHeight: 32, padding: "0 12px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface-1)", fontFamily: MONO, fontSize: 11.5 }}>
                  {label}
                  <span style={{ fontSize: 10, color: "var(--dim)" }}>{meta}</span>
                </span>
              ))}
            </div>
            {onOpenBoard && (
              <span
                role="button"
                tabIndex={0}
                onClick={onOpenBoard}
                onKeyDown={(e) => { if (e.key === "Enter") onOpenBoard(); }}
                style={{ alignSelf: "flex-start", minHeight: 46, display: "flex", alignItems: "center", padding: "0 22px", borderRadius: 10, background: "var(--amber)", color: "var(--accent-on)", fontFamily: MONO, fontSize: 12.5, letterSpacing: "0.08em", cursor: "pointer", marginTop: 4 }}
              >
                OPEN TONIGHT’S BOARD →
              </span>
            )}
          </div>

          {/* ---- the example row, which is a real one --------------------- */}
          <div style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface-1)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={micro}>WHAT A ROW LOOKS LIKE</span>

            {hero ? (
              <>
                <div
                  role={onOpenProp ? "button" : undefined}
                  tabIndex={onOpenProp ? 0 : undefined}
                  onClick={onOpenProp ? () => onOpenProp(hero) : undefined}
                  onKeyDown={onOpenProp ? (e) => { if (e.key === "Enter") onOpenProp(hero); } : undefined}
                  style={{ display: "flex", alignItems: "center", gap: 12, cursor: onOpenProp ? "pointer" : "default" }}
                >
                  <span style={{ position: "relative", flex: "0 0 auto" }}>{hero.avatarNode}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 auto" }}>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                      <span style={{ fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hero.name}</span>
                      {hero.team && <span role="img" style={crest(hero.team, hero.sport, 15)} />}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--text-2)" }}>{hero.prop}</span>
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "0 0 auto" }}>
                    <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: games.length && hits / games.length >= 0.7 ? "var(--pos)" : "var(--text)" }}>
                      {games.length ? `${Math.round((hits / games.length) * 100)}%` : "—"}
                    </span>
                    {/* The sample never travels without the rate; both are
                        counted off the same array against the same line. */}
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>{`${hits} of ${games.length}`}</span>
                  </span>
                </div>

                <MiniStrip games={games} line={liveLine} isBinary={hero.isBinary} direction={hero.direction} height={92} />

                {/* The tab is draggable on the phone frame; here the arrows
                    step it, which is what a keyboard has. */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: "var(--dim)" }}>LINE</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => setLine(Math.max(0, liveLine - 0.5))}
                    onKeyDown={(e) => { if (e.key === "Enter") setLine(Math.max(0, liveLine - 0.5)); }}
                    style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "1px solid var(--line)", color: "var(--text-2)", cursor: "pointer" }}
                  >
                    −
                  </span>
                  <span style={{ minWidth: 52, textAlign: "center", fontFamily: MONO, fontSize: 15, fontWeight: 700, padding: "4px 10px", borderRadius: 8, background: "var(--amber)", color: "var(--accent-on)" }}>{liveLine}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => setLine(liveLine + 0.5)}
                    onKeyDown={(e) => { if (e.key === "Enter") setLine(liveLine + 0.5); }}
                    style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "1px solid var(--line)", color: "var(--text-2)", cursor: "pointer" }}
                  >
                    +
                  </span>
                  {line != null && line !== hero.line && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setLine(null)}
                      onKeyDown={(e) => { if (e.key === "Enter") setLine(null); }}
                      style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "var(--amber-ink)", cursor: "pointer" }}
                    >
                      {`RESET TO ${hero.line}`}
                    </span>
                  )}
                </div>

                <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--dim)" }}>
                  Green cleared the line, a red outline missed it, a zero draws no bar. Move the line and every number moves with it.
                </span>
              </>
            ) : (
              // Nothing is drawn until a real row exists. There is no mock-up
              // to show in the meantime.
              <span style={{ fontSize: 13, lineHeight: 1.6, color: "var(--dim)" }}>
                An example fills in once the game logs load — nothing here is a mock-up, so there is nothing to show until then.
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
          {CLAIMS.map((c) => (
            <div key={c.title} style={{ display: "flex", alignItems: "flex-start", gap: 12, border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", padding: "16px 16px" }}>
              <span style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: c.tone, display: "block", flex: "0 0 auto" }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600 }}>{c.title}</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)", textWrap: "pretty" }}>{c.body}</span>
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 20 }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", color: "var(--dim)" }}>
            21+ · NO WAGERS TAKEN · 1-800-GAMBLER
          </span>
          {/* Which leagues publish a feed, said on the front page rather than
              discovered on the Injuries screen. */}
          <span style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--dim)", maxWidth: 720 }}>
            MLB and the WNBA publish an availability feed we read. The NFL and NBA do not, so those pages say so rather than showing a league with nobody hurt.
          </span>
        </div>
      </div>
    </div>
  );
}
