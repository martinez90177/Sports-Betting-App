import React, { useMemo } from "react";
import PalaceMark from "./PalaceMark.jsx";
import PlayerAvatar from "./PlayerAvatar.jsx";
import FeedFormStrip, { feedFormScale, FORM_PLOT_H } from "./FormGraph.jsx";

// --------------------------------------------------------------------------
// Landing page (item 16)
// --------------------------------------------------------------------------
// Spec: `design_handoff_proppalace_full/README.md`, "Screen 1 — Landing page",
// and `PropPalace Landing.dc.html` for exact values.
//
// The front door. The app opens straight into a filter rail today, which suits
// the daily user and disorients everyone else. This page states the argument,
// teaches the card grammar with one worked example, and hands off to the board.
//
// ---- No fabricated numbers, anywhere ----
//
// The handoff is explicit that the hero card must be a real row and that its
// own figures are "plausible placeholders, not verified logs". So every number
// on this page comes from `rows` -- the same feed rows the Prop Feed builds off
// real game logs -- and the page renders a plain empty state rather than
// inventing a hero when those rows haven't loaded. A made-up stat on the front
// page would be the worst possible place for one.
//
// One of the four teaser cards is deliberately a thin sample, so the page
// *demonstrates* the rule it spends its left column asserting rather than only
// claiming it. If no thin row exists in the data, the slot is simply filled
// with another real row -- the rule is never faked either.

const LABEL = {
  fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)",
};

// A rate is only quotable once it has ten games behind it -- the same
// threshold the feed's cells and the phone card use.
const MIN_QUOTABLE = 10;

function pct(v) {
  return `${Math.round(v * 100)}%`;
}

// `showNav` is false when this renders inside the app shell, which already
// has the mark, the wordmark, the section nav and the search. The design draws
// its own nav because the mock is a standalone page; rendering both would put
// two PROP PALACE lockups on one screen.
export default function LandingPage({ rows = [], showNav = false, onOpenBoard, onOpenFeed, onOpenProp, onOpenNews }) {
  // Hero: the strongest row that actually has a sample worth quoting. Sorted
  // by rate, then by sample, so a 100%-of-10 beats a 100%-of-11 only when it
  // genuinely is stronger -- and never a 100%-of-3.
  const { hero, teasers } = useMemo(() => {
    const usable = rows.filter((r) => r.l10 != null && r.n10 != null && r.recent && r.recent.length);
    const quotable = usable
      .filter((r) => r.n10 >= MIN_QUOTABLE)
      .sort((a, b) => b.l10 - a.l10 || b.n10 - a.n10);
    const heroRow = quotable[0] || null;
    const thin = usable.find((r) => r.n10 < MIN_QUOTABLE && r.key !== heroRow?.key) || null;
    const rest = quotable
      .filter((r) => r.key !== heroRow?.key)
      .filter((r, i, arr) => arr.findIndex((x) => x.name === r.name) === i)
      .slice(0, thin ? 3 : 4);
    return { hero: heroRow, teasers: thin ? [...rest, thin] : rest };
  }, [rows]);

  const navLink = (label, onClick) => (
    <span
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className="pp-mono"
      style={{
        fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
        color: "var(--text-2, var(--dim))", cursor: onClick ? "pointer" : "default",
      }}
    >
      {label}
    </span>
  );

  return (
    <div style={{ background: "var(--bg, var(--page-bg))", color: "var(--text)" }}>
      {/* Top nav. No active underline here on purpose -- the landing page is
          not one of the sections those links point at. */}
      {showNav && (
      <div style={{
        display: "flex", alignItems: "center", gap: 32,
        padding: "20px 48px", borderBottom: "1px solid var(--line)", flexWrap: "wrap",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PalaceMark />
          <span className="pp-mono" style={{ fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>Prop Palace</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 26 }}>
          {navLink("Games", onOpenBoard)}
          {navLink("Prop Feed", onOpenFeed)}
          {navLink("News", onOpenNews)}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <span className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.12em", color: "var(--dim)" }}>SIGN IN</span>
          <span className="pp-mono" style={{
            fontSize: 11, letterSpacing: "0.12em", color: "var(--amber-ink, var(--amber))",
            border: "1px solid var(--amber)", borderRadius: 999, padding: "5px 12px",
          }}>21+</span>
        </span>
      </div>
      )}

      {/* Hero */}
      <div style={{
        display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 468px)",
        gap: 64, padding: "72px 48px 88px", alignItems: "start",
      }} className="landing-hero">
        <div style={{ minWidth: 0 }}>
          <div className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--amber-ink, var(--amber))" }}>
            Real season logs · no picks sold
          </div>
          <h1 className="pp-display" style={{
            fontSize: "clamp(40px, 5.5vw, 74px)", lineHeight: 1.02, letterSpacing: "-0.02em",
            fontWeight: 600, margin: "18px 0 0",
          }}>
            Know the sample<br />before you take<br />the line.
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--text-2, var(--dim))", maxWidth: "62ch", marginTop: 22 }}>
            Every hit rate here shows the games behind it. When the sample can&rsquo;t answer the
            question, we say so instead of printing a number with confidence it hasn&rsquo;t earned.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 32, flexWrap: "wrap" }}>
            <span
              role="button"
              tabIndex={0}
              onClick={onOpenBoard}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenBoard && onOpenBoard(); } }}
              className="pp-mono"
              style={{
                cursor: "pointer", background: "var(--amber)", color: "var(--accent-on)",
                fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "14px 22px", borderRadius: 4,
              }}
            >
              Open the board
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={onOpenFeed}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenFeed && onOpenFeed(); } }}
              className="pp-mono"
              style={{
                cursor: "pointer", color: "var(--amber-ink, var(--amber))",
                fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
                textDecoration: "underline", textUnderlineOffset: 4,
              }}
            >
              How we count
            </span>
          </div>

          {/* The rules strip. This replaced a "props tracked / game logs" stat
              block that was cut for being pointless -- do not reintroduce it.
              Each cell states a rule this product actually follows. */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24,
            borderTop: "1px solid var(--line)", marginTop: 56, paddingTop: 24,
          }}>
            <div>
              <div className="pp-mono" style={LABEL}>How we count</div>
              <div style={{ fontSize: 15, lineHeight: 1.55, marginTop: 10, color: "var(--text-2, var(--dim))" }}>
                A rate never appears without its sample.{" "}
                <span className="pp-mono" style={{ color: "var(--amber-ink, var(--amber))" }}>78% · 7 of 9</span>, never{" "}
                <span className="pp-mono" style={{ color: "var(--text-2, var(--dim))" }}>78%</span>.
              </div>
            </div>
            <div>
              <div className="pp-mono" style={LABEL}>Thin samples</div>
              <div style={{ fontSize: 15, lineHeight: 1.55, marginTop: 10, color: "var(--text-2, var(--dim))" }}>
                Under ten games we print a verdict instead of a percentage —{" "}
                <span className="pp-mono">too few</span>.
              </div>
            </div>
            <div>
              <div className="pp-mono" style={LABEL}>Margin, not just hits</div>
              <div style={{ fontSize: 15, lineHeight: 1.55, marginTop: 10, color: "var(--text-2, var(--dim))" }}>
                Bar height shows how far a game cleared the line, so a blowout doesn&rsquo;t read
                like a squeaker.
              </div>
            </div>
          </div>
        </div>

        {/* The worked example. A real row or nothing. */}
        {hero ? <HeroCard row={hero} onOpen={onOpenProp} /> : <HeroEmpty />}
      </div>

      {/* Board teaser */}
      <div style={{ padding: "0 48px 72px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <span className="pp-display" style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.01em" }}>Today&rsquo;s board</span>
          <span className="pp-mono" style={{ fontSize: 13, color: "var(--text-2, var(--dim))", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {teasers.length ? `${teasers.length} of today's props` : "No props loaded yet"}
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={onOpenBoard}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenBoard && onOpenBoard(); } }}
            className="pp-mono"
            style={{ marginLeft: "auto", cursor: "pointer", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber-ink, var(--amber))" }}
          >
            All games
          </span>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20, marginTop: 20,
        }}>
          {teasers.map((r) => <TeaserCard key={r.key} row={r} onOpen={onOpenProp} />)}
        </div>
      </div>

      <div style={{
        borderTop: "1px solid var(--line)", padding: "24px 48px",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <PalaceMark />
        <span className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)" }}>
          Research only · no picks sold · 21+
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={onOpenFeed}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenFeed && onOpenFeed(); } }}
          className="pp-mono"
          style={{ marginLeft: "auto", cursor: "pointer", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber-ink, var(--amber))" }}
        >
          How we count
        </span>
      </div>
    </div>
  );
}

// Rule 4 on the front page: when the rows haven't loaded there is no hero, and
// the card says that rather than showing a skeleton that looks like data or
// vanishing and leaving the hero column empty.
function HeroEmpty() {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, padding: 24 }}>
      <div className="pp-mono" style={LABEL}>The example card</div>
      <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-2, var(--dim))", marginTop: 12 }}>
        This card shows a real prop off today&rsquo;s board, with the games behind it. It fills in
        once the game logs load — nothing here is a mock-up, so there is nothing to show until
        they do.
      </div>
    </div>
  );
}

function HeroCard({ row, onOpen }) {
  const open = row.playerId && onOpen ? () => onOpen(row.sport, row.playerId, row.marketId, { name: row.name, team: row.team }) : null;
  const rate = row.l10;
  const n = row.n10;
  const over = Math.round(rate * n);
  const tier = n >= 25 ? "Strong" : n >= MIN_QUOTABLE ? "Fair" : "Thin";

  // The handoff leaves this open: the card's rate covered 9 games while its
  // graph showed 10. Normalised here -- both are the same L10 window, so the
  // heading can say "last N" and mean the games the percentage counted.
  const shown = (row.recent || []).slice(-n);

  // Derived from `shown`, the same array the bars plot -- not from a separate
  // average on the row. Two sources for one number is the bug this product
  // cannot ship, and an "avg" that disagreed with the graph beside it would
  // be exactly that.
  const avg = shown.length ? shown.reduce((t, g) => t + g.v, 0) / shown.length : 0;
  const margin = avg - row.line;

  return (
    <div
      role={open ? "button" : undefined}
      tabIndex={open ? 0 : undefined}
      onClick={open || undefined}
      onKeyDown={open ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } : undefined}
      style={{
        background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6,
        padding: 24, cursor: open ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div className="pp-mono" style={{ fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-2, var(--dim))" }}>
            {row.team}{row.opp ? ` · vs ${row.opp}` : ""}
          </div>
          <div className="pp-display" style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.01em", marginTop: 6 }}>{row.name}</div>
          <div className="pp-mono" style={{ fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-2, var(--dim))", marginTop: 6 }}>
            {row.subtitle}
          </div>
        </div>
        <PlayerAvatar
          name={row.name}
          alt={row.name}
          sport={row.sport}
          team={row.team}
          headshotSrc={row.avatar}
          fallbackSrc={row.avatarFallback}
          status={row.status}
          size={92}
          inset={3}
          surface="var(--panel)"
        />
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 20 }}>
        <span className="pp-mono" style={{ fontSize: 64, lineHeight: 0.9, letterSpacing: "-0.02em", color: "var(--amber-ink, var(--amber))" }}>
          {pct(rate)}
        </span>
        <span className="pp-mono" style={{ fontSize: 13, color: "var(--text-2, var(--dim))", paddingBottom: 8 }}>
          {over} of {n} games
        </span>
      </div>

      <div style={{ background: "var(--surface-2)", borderRadius: 6, padding: 16, marginTop: 18 }}>
        <div className="pp-mono" style={{ ...LABEL, color: "var(--text-2, var(--dim))" }}>
          Last {shown.length} games · margin vs. line
        </div>
        <div style={{ marginTop: 14 }}>
          <FeedFormStrip
            size="hero"
            r={{ recent: shown, line: row.line, isBinary: !!row.isBinary, subtitle: row.subtitle }}
            direction={row.direction || "over"}
            streak={null}
            tag
          />
          {/* Per-game values, on the same grid as the bars so each sits under
              its own game. The hero is the one place with room for them, and
              they are what lets a reader check the bars against the numbers
              instead of taking the shape on trust -- the windowed axis makes
              heights comparable within this row only, so the figures are how
              the row states quantity. */}
          <div
            className="pp-mono"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.max(10, shown.length)}, 1fr)`,
              gap: 6, marginTop: 8, paddingRight: 54,
              fontSize: 11, color: "var(--dim)",
            }}
          >
            {shown.map((g, i) => (
              <span key={i} style={{ textAlign: "center" }}>{g.v}</span>
            ))}
          </div>
        </div>
        {/* Average and margin, both off the same game log the bars draw, so
            they cannot disagree with the graph above them. */}
        <div className="pp-mono" style={{ fontSize: 12, color: "var(--text-2, var(--dim))", marginTop: 10 }}>
          avg {avg.toFixed(1)} · {margin >= 0 ? "+" : "−"}{Math.abs(margin).toFixed(1)} vs. line
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
          <span className="pp-mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-2, var(--dim))" }}>
            <span style={{ width: 7, height: 14, background: "var(--pos)", borderRadius: 2 }} />cleared the line
          </span>
          <span className="pp-mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-2, var(--dim))" }}>
            <span style={{ width: 7, height: 14, border: "1.5px solid var(--neg)", borderRadius: 2, boxSizing: "border-box" }} />fell short
          </span>
          <span className="pp-mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-2, var(--dim))" }}>
            <span style={{ width: 14, borderTop: "1.5px dashed var(--text)" }} />the line {row.line}
          </span>
        </div>
      </div>

      {/* Windows, each with its own sample. Only the ones this row actually
          has -- a window with no games behind it is left out rather than
          printed as a dash pretending to be a split. */}
      <div style={{ marginTop: 18 }}>
        {[
          ["Last 5", row.l5, row.n5],
          ["Last 20", row.l20, row.n20],
          ["Season", row.all, row.nAll],
        ].filter(([, v, c]) => v != null && c).map(([label, v, c], i, arr) => (
          <div
            key={label}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 0", borderTop: "1px solid var(--line)",
              borderBottom: i === arr.length - 1 ? "1px solid var(--line)" : "none",
            }}
          >
            <span style={{ fontSize: 15, color: "var(--text-2, var(--dim))" }}>{label}</span>
            <span className="pp-mono" style={{ fontSize: 15 }}>
              {c < MIN_QUOTABLE ? "too few" : `${pct(v)} (${Math.round(v * c)}/${c})`}
            </span>
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface-sunken)", padding: 16, marginTop: 18 }}>
        <div className="pp-mono" style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--amber-ink, var(--amber))" }}>
          {tier} sample · leans {rate >= 0.5 ? "over" : "under"}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-2, var(--dim))", marginTop: 8, lineHeight: 1.55 }}>
          {n} games. Treat as a lean, not a lock.
        </div>
      </div>

      <div className="pp-mono" style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 14, lineHeight: 1.5 }}>
        Real game logs, regular season and playoffs. Not a live odds feed.
      </div>
    </div>
  );
}

function TeaserCard({ row, onOpen }) {
  const open = row.playerId && onOpen ? () => onOpen(row.sport, row.playerId, row.marketId, { name: row.name, team: row.team }) : null;
  const thin = row.n10 == null || row.n10 < MIN_QUOTABLE;
  const bars = (row.recent || []).slice(-5);
  return (
    <div
      role={open ? "button" : undefined}
      tabIndex={open ? 0 : undefined}
      onClick={open || undefined}
      onKeyDown={open ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } : undefined}
      style={{
        background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6,
        padding: 16, cursor: open ? "pointer" : "default",
      }}
    >
      <div className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-2, var(--dim))" }}>
        {row.team}{row.opp ? ` @ ${row.opp}` : ""}
      </div>
      <div style={{ background: "var(--surface-2)", borderRadius: 4, padding: 12, marginTop: 12 }}>
        <div style={{ fontSize: 15, color: "var(--text)" }}>{row.name}</div>
        <div className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--dim)", marginTop: 4 }}>
          {row.subtitle}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
          {thin ? (
            <>
              <span className="pp-mono" style={{ fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-2, var(--dim))" }}>Too few</span>
              <span className="pp-mono" style={{ fontSize: 11, color: "var(--dim)" }}>{row.n10 || 0} games</span>
            </>
          ) : (
            <>
              <span className="pp-mono" style={{ fontSize: 20, color: "var(--text)" }}>{pct(row.l10)}</span>
              <span className="pp-mono" style={{ fontSize: 11, color: "var(--dim)" }}>{Math.round(row.l10 * row.n10)} of {row.n10}</span>
            </>
          )}
        </div>
      </div>
      {/* The thin card shows no graph at all, matching the phone card and the
          rule the left column states. Five bars is a glance, not a reading --
          the full graph is one click away on the prop's own page. */}
      {thin ? (
        <div className="pp-mono" style={{ fontSize: 11, color: "var(--dim)", marginTop: 12, lineHeight: 1.5 }}>
          Thin sample — no rate shown.
        </div>
      ) : bars.length > 0 && (
        // Scaled on the same windowed axis as every other graph in the app,
        // just shorter -- not five equal blocks. A teaser that flattened the
        // margins would contradict the "margin, not just hits" rule stated a
        // few hundred pixels up the same page.
        (() => {
          const { y } = feedFormScale(bars, row.line, !!row.isBinary);
          const scale = 30 / FORM_PLOT_H;
          return (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 30, marginTop: 12 }}>
              {bars.map((g, i) => {
                const hit = row.direction === "under" ? g.v < row.line : g.v > row.line;
                return (
                  <span
                    key={i}
                    title={`${g.v}`}
                    style={{
                      flex: 1, height: Math.max(4, Math.round(y(g.v) * scale)),
                      borderRadius: "2px 2px 0 0", boxSizing: "border-box",
                      background: hit ? "var(--pos)" : "transparent",
                      border: hit ? "none" : "1.5px solid var(--neg)",
                    }}
                  />
                );
              })}
            </div>
          );
        })()
      )}
    </div>
  );
}
