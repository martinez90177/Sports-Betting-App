import React from "react";
import { crest } from "./FormPlot.jsx";
import { TONE, TIERS, atStyle, BoardBrief } from "./boardShared.jsx";

// A transcription of frame `1b` in `v3 Mocks/PropPalace Board v4 part 2.dc.html`
// — the desktop Board. That file is THE Board; the v3 mobile and desktop
// bundles contain none.
//
// The shape the frame's own caption gives: "the hero across the top, the rest
// as tiers below". One game gets a full-width card with its reasons written
// out and its leading props drawn, and every other game is a compact card in a
// three-column grid under its tier heading.
//
// ---- One deliberate departure ----
//
// The mock computes `hero = byBand[0][0]` and then draws `tiersD: [1, 2]` —
// the top band's *other* games are not rendered on desktop at all. That is
// fine in a mock whose top band holds exactly one game and wrong the moment it
// holds two: a game with three counted reasons would vanish from the widest
// screen while showing up on the phone.
//
// So the hero is band 0's leader and band 0 still draws as a tier with its
// remaining games. CLAUDE.md: "Nothing is ever silently dropped. A game,
// player or row that can't render surfaces as a visible state, never as an
// absent row."
//
// The frame's OPENING banner is not built. It is the mock standing in for a
// navigation it cannot perform: clicking a prop sets `opened` to "<player> ·
// <prop>" because a static frame has nowhere to go. This app opens Player
// Detail, so a banner announcing that it is about to would be narrating a
// thing that already happened. Same category as the file's BOOK_MARKS.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const railMicro = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };

function leagueChip(on) {
  return {
    minHeight: 30, display: "flex", alignItems: "center", padding: "0 13px",
    borderRadius: 7, fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em",
    cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
    background: on ? "var(--amber-dim)" : "var(--surface-1)",
    color: on ? "var(--amber-ink)" : "var(--text-2)",
  };
}

export default function BoardDesktop({
  sport,
  sports = [],
  onSetSport,
  hero = null,
  tiers = [],
  summary,
  slateLabel,
  footNote,
  loading = false,
  emptyNote = null,
  onOpenProp,
  onOpenGameProps,
}) {
  // The frame is 900px tall with one scrolling body. In the app it fills what
  // is left under the nav, measured rather than assumed — see the same note in
  // PropFeedDesktop.
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

  // One card open at a time: a second click on the same card closes it, a
  // click on another moves the brief there. Reset when the league changes --
  // a key from the NFL slate means nothing on the WNBA one.
  const [openKey, setOpenKey] = React.useState(null);
  const toggle = (k) => setOpenKey((cur) => (cur === k ? null : k));
  React.useEffect(() => { setOpenKey(null); }, [sport]);

  const tierMark = (tone) => ({
    width: 8, height: 8, borderRadius: 2, background: tone, display: "block", flex: "0 0 auto",
  });

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
      {/* ---- league chips, summary, slate ------------------------------- */}
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 16, padding: "14px 32px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", gap: 7 }}>
          {sports.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => onSetSport && onSetSport(s.id)}
              onKeyDown={(e) => { if (e.key === "Enter") onSetSport && onSetSport(s.id); }}
              style={leagueChip(sport === s.id)}
            >
              {s.label}
            </div>
          ))}
        </div>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)" }}>{summary}</span>
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{slateLabel}</span>
      </div>

      {/* ---- the one scrolling body ------------------------------------- */}
      <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "22px 32px var(--fab-clear)", display: "flex", flexDirection: "column", gap: 22 }}>
        {loading && (
          <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>Loading the slate…</span>
        )}
        {!loading && emptyNote && tiers.length === 0 && (
          <span style={{ flex: "0 0 auto", fontSize: 13, color: "var(--dim)" }}>{emptyNote}</span>
        )}

        {/* ---- the hero -------------------------------------------------- */}
        {hero && (
          <div style={{ flex: "0 0 auto", border: "1px solid var(--amber)", borderRadius: 14, background: "var(--surface-1)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", background: "var(--amber-dim)", borderBottom: "1px solid var(--line)" }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: "var(--pos)", display: "block", flex: "0 0 auto" }} />
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--amber-ink)" }}>
                {String(TIERS[0].title).toUpperCase()}
              </span>
              <span role="img" style={crest(hero.away, sport, 28)} />
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 24, letterSpacing: "-0.01em" }}>{String(hero.away).toUpperCase()}</span>
              <span style={atStyle}>@</span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 24, letterSpacing: "-0.01em" }}>{String(hero.home).toUpperCase()}</span>
              <span role="img" style={crest(hero.home, sport, 28)} />
              <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>{hero.meta}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={() => onOpenGameProps && onOpenGameProps(hero)}
                onKeyDown={(e) => { if (e.key === "Enter") onOpenGameProps && onOpenGameProps(hero); }}
                style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", color: "var(--amber-ink)", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {/* Read "OPEN MATCHUP →" and went to the Prop Feed, which is
                    the same mislabel the Matchup page's own button carried in
                    the other direction. It goes to the feed, filtered to this
                    game, and now says so. */}
                THIS GAME’S PROPS →
              </span>
            </div>

            {/* The brief every card now opens into (see BoardBrief), which is
                the hero’s own layout lifted out so the two cannot drift. It
                also fixed the hero’s prop links: they called onOpenProp(p)
                with one object where the handler takes (sport, player,
                market), so no prop on the hero could open its player. */}
            <BoardBrief card={hero} sport={sport} whyLabel="WHY IT LEADS" onOpenProp={onOpenProp} onOpenGameProps={onOpenGameProps} />
          </div>
        )}

        {/* ---- the tiers ------------------------------------------------- */}
        {tiers.map((t) => (
          <div key={t.key} style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 11 }}>
              <span style={tierMark(t.tone)} />
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 17 }}>{t.title}</span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>{t.count}</span>
              <span style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.5 }}>{t.sub}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
              {t.games.map((g) => (
                <div
                  key={g.key}
                  style={{
                    border: `1px solid ${openKey === g.key ? "var(--amber)" : g.quiet ? "var(--line)" : "var(--line-strong, var(--line))"}`,
                    borderRadius: 12, background: g.quiet && openKey !== g.key ? "transparent" : "var(--surface-1)",
                    display: "flex", flexDirection: "column", overflow: "hidden",
                    // An open card takes the whole row, so its brief has the
                    // hero’s width to lay out in rather than a third of it.
                    gridColumn: openKey === g.key ? "1 / -1" : "auto",
                  }}
                >
                  {/* The card opens in place into its brief. It used to go
                      straight to the Prop Feed, which answered "what is behind
                      this chip" with 190 unsorted-for-that-question rows. The
                      feed is still one click away, inside the brief. */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={openKey === g.key}
                    onClick={() => toggle(g.key)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(g.key); } }}
                    style={{ cursor: "pointer", display: "flex", flexDirection: "column" }}
                  >
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 15px 11px" }}>
                    <span role="img" style={crest(g.away, sport, 18)} />
                    <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 14 }}>{String(g.away).toUpperCase()}</span>
                    <span style={atStyle}>@</span>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 14 }}>{String(g.home).toUpperCase()}</span>
                    <span role="img" style={crest(g.home, sport, 18)} />
                    <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", whiteSpace: "nowrap" }}>{g.time}</span>
                  </div>
                  <div style={{ padding: "0 15px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
                    {/* The reason bar: one segment per reason, so the count is
                        legible before a single chip is read. A quiet card gets
                        one dim segment rather than an empty rule. */}
                    <span style={{ display: "flex", gap: 3, height: 4, borderRadius: 2, overflow: "hidden" }}>
                      {(g.reasons.length ? g.reasons : [{ kind: "none" }]).map((r, i) => (
                        <span key={`${r.kind}${i}`} style={{ flex: "1 1 0", background: (TONE[r.kind] || TONE.none).fg, display: "block" }} />
                      ))}
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {g.reasons.map((r, i) => {
                        const tone = TONE[r.kind] || TONE.none;
                        return (
                          <span
                            key={`${r.label}${i}`}
                            style={{
                              fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", padding: "4px 8px",
                              borderRadius: 6, background: tone.bg, color: tone.fg, whiteSpace: "nowrap",
                            }}
                          >
                            {r.label}
                          </span>
                        );
                      })}
                    </div>
                    {g.quiet && openKey !== g.key && (
                      <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--dim)" }}>{g.quietWhy}</span>
                    )}
                    {/* Says the card opens, and into what -- a card that did
                        something different on click from what it used to has
                        to say so rather than surprise. */}
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: "var(--amber-ink)" }}>
                      {openKey === g.key ? "▴ CLOSE" : g.quiet ? "▾ CLOSEST PROPS" : "▾ WHAT’S BEHIND IT"}
                    </span>
                  </div>
                  </div>
                  {openKey === g.key && (
                    <BoardBrief card={g} sport={sport} onOpenProp={onOpenProp} onOpenGameProps={onOpenGameProps} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 10.5, lineHeight: 1.7, color: "var(--dim)" }}>{footNote}</span>
      </div>
    </div>
  );
}
