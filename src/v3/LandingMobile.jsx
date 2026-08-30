import React from "react";
import PlayerAvatar from "../PlayerAvatar.jsx";
import PalaceMark from "../PalaceMark.jsx";
import FormPlot, { crest } from "./FormPlot.jsx";

// A transcription of frame `3e` in `v3 Mocks/PropPalace Mobile v3.dc.html`.
//
// What the app is, in the app's own terms. Three claims, one worked example,
// the four leagues, and the way in.
//
// Two departures from the frame as drawn, both because the app's data says
// otherwise and the bundle's rule is that on data the app wins:
//
//   1. The mock's example card is Aaron Judge over 1.5 total bases at 74%,
//      with a ten-bar strip of made-up numbers. A real player's name over
//      invented figures is the one thing this app must never print, and
//      `LandingPage` already refuses to: it picks a real row off the board and
//      says so plainly when the logs have not loaded. This draws that same
//      real row, through the same `FormPlot` the feed uses.
//   2. The frame's closing sentence says the NFL and NBA publish no
//      availability feed. They do — the app reads all four now (see
//      PROJECT_NOTES, "Availability: all four leagues"), so the sentence names
//      what is actually true instead.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

// The three claims are the mock's own copy, kept word for word.
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

// Season lengths, the same figures the custom-window ceilings use.
const LEAGUES = [
  { label: "MLB", meta: "162 GP" },
  { label: "NFL", meta: "17 GP" },
  { label: "NBA", meta: "82 GP" },
  { label: "WNBA", meta: "44 GP" },
];

export default function LandingMobile({ hero, onOpenBoard, onOpenSettings, onOpenProp }) {
  const games = (hero && hero.recent) || [];
  const [line, setLine] = React.useState(null);
  React.useEffect(() => { setLine(null); }, [hero && hero.key]);
  const liveLine = hero == null ? null : (line == null ? hero.line : line);

  // Every figure on the card is counted off the same array against the same
  // line, so dragging the tab moves the rate and the sample with it.
  const hit = (v) => (hero && hero.direction === "under" ? v < liveLine : v > liveLine);
  const hits = games.filter((g) => hit(g.v)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "1 1 auto" }}>
      {/* The frame draws its own 52px header rather than the six-tab nav --
          the landing page is not one of the nav destinations, and lighting one
          up would claim you are somewhere you are not. */}
      <div style={{ flex: "0 0 auto", background: "var(--bg)" }}>
        <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <PalaceMark variant="nav" />
            <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>Prop Palace</span>
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: "var(--amber-ink)", border: "1px solid var(--amber)", borderRadius: 7, padding: "6px 11px" }}>
            21+
          </span>
        </div>
      </div>

      <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
        <div style={{ padding: "26px 20px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 700, fontSize: 34, lineHeight: 1.1, letterSpacing: "-0.02em", textWrap: "pretty" }}>
            Your own hit-rate research, before you place it.
          </h2>
          <span style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--text-2)", textWrap: "pretty" }}>
            Every number here is a count of finished games. No model, no projections, no picks sold to you.
          </span>
        </div>

        <div style={{ padding: "4px 20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {CLAIMS.map((c) => (
            <div
              key={c.title}
              style={{
                display: "flex", alignItems: "flex-start", gap: 11, padding: 13,
                border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)",
              }}
            >
              <span style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: c.tone, display: "block", flex: "0 0 auto" }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{c.title}</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)", textWrap: "pretty" }}>{c.body}</span>
              </span>
            </div>
          ))}
        </div>

        <div style={{ padding: "0 20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>WHAT A ROW LOOKS LIKE</span>

          {/* Rule 4 on the front page: no hero until the logs load, and the
              card says so rather than showing a skeleton that looks like data.
              The desktop landing has refused to invent one since it was built;
              this refuses in the same words. */}
          {!hero ? (
            <div style={{ border: "1px dashed var(--line)", borderRadius: 12, background: "var(--surface-1)", padding: "20px 16px", fontSize: 12.5, lineHeight: 1.6, color: "var(--dim)", textWrap: "pretty" }}>
              This card shows a real prop off today's board, with the games behind it. It fills in
              once the game logs load — nothing here is a mock-up, so there is nothing to show
              until they do.
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpenProp && onOpenProp(hero.sport, hero.playerId, hero.marketId)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenProp && onOpenProp(hero.sport, hero.playerId, hero.marketId); } }}
              style={{
                border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)",
                padding: 13, display: "flex", flexDirection: "column", gap: 11, cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <span style={{ position: "relative", flex: "0 0 auto" }}>
                  <PlayerAvatar
                    name={hero.name} alt={hero.name} sport={hero.sport} team={hero.team}
                    headshotSrc={hero.avatar} fallbackSrc={hero.avatarFallback} status={hero.status}
                    size={36} inset={2} surface="var(--surface-1)"
                  />
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 auto" }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hero.name}</span>
                    <span role="img" style={crest(hero.team, hero.sport, 14)} />
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {`${(hero.direction === "under" ? "UNDER" : "OVER")} ${liveLine} ${String(hero.marketLabel || "").toUpperCase()}`}
                  </span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "0 0 auto" }}>
                  <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: games.length && hits / games.length >= 0.6 ? "var(--pos)" : "var(--text)" }}>
                    {games.length ? `${Math.round((hits / games.length) * 100)}%` : "—"}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{`${hits} of ${games.length}`}</span>
                </span>
              </div>

              {/* The feed's own strip, at the feed's own size -- one graph,
                  not a second drawing of it. */}
              <div onClick={(e) => e.stopPropagation()}>
                <FormPlot
                  size="feed"
                  games={games}
                  sport={hero.sport}
                  line={liveLine}
                  marketLine={hero.line}
                  isBinary={hero.isBinary}
                  direction={hero.direction || "over"}
                  onDragLine={setLine}
                  labels={false}
                />
              </div>

              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)", textWrap: "pretty" }}>
                Green cleared the line, red outline missed it, a zero draws no bar. Drag the tab and every number moves with it.
              </span>
            </div>
          )}
        </div>

        <div style={{ padding: "0 20px 26px", display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>FOUR LEAGUES</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {LEAGUES.map((l) => (
              <span
                key={l.label}
                style={{
                  minHeight: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 13px",
                  borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-1)",
                  fontFamily: MONO, fontSize: 12, color: "var(--text)", whiteSpace: "nowrap",
                }}
              >
                {l.label}
                <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{l.meta}</span>
              </span>
            ))}
          </div>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)", textWrap: "pretty" }}>
            All four publish an availability designation this app reads, so a player listed out is
            listed out here. A league showing nobody has nobody designated, not nobody checked.
          </span>
        </div>
      </div>

      <div style={{ flex: "0 0 auto", background: "var(--bg)", borderTop: "1px solid var(--line)", padding: "14px 16px 20px", display: "flex", flexDirection: "column", gap: 8, boxSizing: "border-box" }}>
        <div
          role="button"
          tabIndex={0}
          onClick={onOpenBoard}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenBoard && onOpenBoard(); } }}
          style={{
            minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 12, border: "1px solid var(--amber)", background: "var(--amber)",
            color: "var(--accent-on)", fontFamily: MONO, fontSize: 13, letterSpacing: "0.08em", cursor: "pointer",
          }}
        >
          OPEN TONIGHT'S BOARD
        </div>
        <span style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
          21+ · NO WAGERS TAKEN · 1-800-GAMBLER
        </span>
      </div>
    </div>
  );
}
