import React from "react";
import { feedFormScale } from "./FormGraph.jsx";

// The Matchup Card, transcribed from `Player Detail v2 - Matchup Card.dc.html`.
//
// It is not a page. That file is the NFL player detail page with one extra
// block at the end, guarded by `<sc-if value="{{ cardOpen }}">` -- a modal over
// the page, opened by the "Matchup card" button the same file adds to the
// breadcrumb. This is that block and nothing else.
//
// Everything on it is derived from what the page already computed for the
// blocks below it, so the card can never disagree with the page it is sitting
// on: same games, same line, same rate, same defence rank. The only things
// passed in are the ones with no equivalent in the page's own props -- a 72px
// avatar and the availability word.

const MONO = "'Space Mono', monospace";
const DISPLAY = "'Bricolage Grotesque', sans-serif";

const label = {
  fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.16em",
  textTransform: "uppercase", color: "var(--dim)", whiteSpace: "nowrap",
};
const cellValue = {
  fontFamily: MONO, fontSize: 16, marginTop: 6,
  fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
};

// How many of the most recent games landed on the same side, uninterrupted.
// The mock prints this as "6 straight over" in the chart card's header; it is
// a fact about the tail of the sample, so it is read from the end backwards.
export function straightRunOf(games, line, direction = "over") {
  if (!games || !games.length || line == null) return 0;
  const hit = (v) => (direction === "under" ? v < line : v > line);
  const first = hit(games[games.length - 1].v);
  if (!first) return 0;
  let n = 0;
  for (let i = games.length - 1; i >= 0; i -= 1) {
    if (hit(games[i].v) !== first) break;
    n += 1;
  }
  return n;
}

export default function MatchupCardModal({
  open, onClose,
  sport, player, card = {}, band, context, verdict, chart, marketLabel,
  onAddPick, pickAdded,
}) {
  // Escape closes it, and the page behind it stops scrolling while it is up.
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const [copied, setCopied] = React.useState(null);
  React.useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  if (!open) return null;

  const games = (chart && chart.games) || [];
  const line = chart ? chart.line : null;
  const direction = (chart && chart.direction) || "over";
  const isBinary = !!(chart && chart.isBinary);
  const hit = (v) => (direction === "under" ? v < line : v > line);

  // `card.teamAbbr` is the side of the fixture this player is on, taken from
  // the matchup rather than from `player.team`. The two disagree whenever a
  // roster carries a player whose own team field is stale -- Mitchell Trubisky
  // sits in the Giants' rail with `team: "TEN"` -- and the card prints the
  // team twice, so it has to be the one the page is actually showing.
  const teamAbbr = card.teamAbbr || player.team;
  const oppAbbr = band && band.away && band.home
    ? (band.away.abbr === teamAbbr ? band.home.abbr : band.away.abbr)
    : null;
  const h2h = oppAbbr ? games.filter((g) => g.opp === oppAbbr) : [];
  const h2hCleared = h2h.filter((g) => hit(g.v)).length;

  const fixtureLine = band && band.away && band.home
    ? [`${band.away.abbr} at ${band.home.abbr}`, band.dateLabel, band.timeLabel].filter(Boolean).join(" · ")
    : null;

  // "OVER 5.5 RECEPTIONS" -- the proposition this card is about, in the same
  // words the feed row uses.
  const propLine = line == null
    ? marketLabel
    : `${direction === "under" ? "Under" : "Over"} ${Number(line).toFixed(1)} ${marketLabel}`;

  const run = straightRunOf(games, line, direction);
  const streakCaption = run > 1
    ? `${run} straight ${direction === "under" ? "under" : "over"}`
    : `${games.filter((g) => hit(g.v)).length} of ${games.length} cleared`;

  const identity = [teamAbbr, card.positionShort || null, player.jersey ? `#${player.jersey}` : null]
    .filter(Boolean).join(" · ");

  // "The read", composed from facts rather than written around them. The mock
  // hard-codes a sentence claiming usage has held all season and that the
  // margin is thin; neither is knowable in general, so each clause here is
  // dropped when its input is missing and the paragraph shortens.
  const marginNum = Number(String(verdict.margin || "").replace("+", ""));
  const readClauses = [
    verdict.sentence ? `${verdict.sentence[0].toUpperCase()}${verdict.sentence.slice(1)}.` : null,
    context && context.rankWord ? `The defence rates ${context.rankWord} for this market.` : null,
    Number.isFinite(marginNum) && !isBinary
      ? (Math.abs(marginNum) < 0.5
        ? "The margin is thin enough that this is a lean, not a lock."
        : `The average sits ${Math.abs(marginNum).toFixed(1)} ${marginNum >= 0 ? "above" : "below"} the line.`)
      : null,
    player.role || null,
  ].filter(Boolean);

  // Copy image, honestly.
  //
  // Rendering this card to a PNG needs the headshots and crests drawn into a
  // canvas, and those come from CDNs that taint it -- the export would throw at
  // the moment of writing, after the user had already clicked. So the button
  // copies the card as text, which is the part that carries the claim, and says
  // so on itself rather than reporting a success it did not have.
  const copyText = () => {
    const text = [
      `${player.name} — ${identity}`,
      fixtureLine,
      propLine,
      `${verdict.rate} · ${verdict.sentence}`,
      `avg ${verdict.average} · line ${verdict.line} · clears by ${verdict.margin}`,
      context && context.rank ? `${context.allowsLabel} ${context.allows || "—"} · ${context.rank} ${context.rankWord || ""}`.trim() : null,
      oppAbbr && h2h.length ? `H2H vs ${oppAbbr}: ${h2hCleared} of ${h2h.length}` : null,
      "Prop Palace · finished games only · research only · 21+",
    ].filter(Boolean).join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => setCopied("Copied as text"),
        () => window.prompt("Copy this card:", text)
      );
    } else {
      window.prompt("Copy this card:", text);
    }
  };

  const H = 96, GUT = 46;
  const scale = games.length && line != null
    ? feedFormScale(games.map((g) => ({ v: g.v })), line, isBinary, { height: H, pedestal: 0 })
    : null;
  const lineY = scale ? Math.max(1, Math.min(H - 1, scale.y(line))) : 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(6,7,9,0.82)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "56px 0", zIndex: 40, overflow: "auto",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Matchup card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 620, maxWidth: "calc(100vw - 32px)", background: "var(--surface-sunken)",
          border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden",
        }}
      >

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid var(--line)", background: "var(--surface-1)" }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--amber-ink)" }}>
            Matchup card
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)" }}>
            Prop Palace · research only
          </span>
          <span
            role="button" tabIndex={0} onClick={onClose}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); } }}
            title="Close"
            style={{
              marginLeft: "auto", fontFamily: MONO, fontSize: 14, color: "var(--text-2)",
              cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ×
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 20 }}>
          <span style={{ position: "relative", flex: "none", width: 72, height: 72 }}>
            {card.avatar}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 30, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {player.name}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-2)", marginTop: 8 }}>
              {identity}
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            {fixtureLine && (
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" }}>
                {fixtureLine}
              </div>
            )}
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-2)", marginTop: 7 }}>
              {propLine}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <span style={{ fontFamily: MONO, fontSize: 38, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: verdict.rateColor }}>
                {verdict.rate}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>
                {games.length} games
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: "0 20px 18px" }}>
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 6, padding: 16 }}>
            {/* The same plot as the page's, at 96px and without the value
                labels or the opponent axis -- this is the glanceable version,
                and the numbers it would print are already in the row below. */}
            <div style={{ position: "relative", paddingRight: GUT }}>
              <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 5, height: H }}>
                {games.map((g, i) => {
                  const cleared = hit(g.v);
                  const h = Math.max(2, Math.round(scale.y(g.v)));
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                      <div style={{
                        height: h, borderRadius: "2px 2px 0 0", boxSizing: "border-box",
                        background: cleared ? "var(--pos-solid)" : "transparent",
                        border: cleared ? "none" : "1.5px solid var(--neg)",
                      }} />
                    </div>
                  );
                })}
                {scale && (
                  <>
                    <span style={{
                      position: "absolute", left: 0, right: 0, bottom: lineY,
                      // Always white -- see the note on the page chart it mirrors.
                      borderTop: "1.5px dashed var(--text)",
                      pointerEvents: "none",
                    }} />
                    <span style={{
                      position: "absolute", right: -GUT, bottom: lineY, transform: "translateY(50%)",
                      background: chart.adjusted ? "var(--surface-1)" : "var(--amber)",
                      color: chart.adjusted ? "var(--amber-ink)" : "#ffffff",
                      border: `1px solid ${chart.adjusted ? "var(--amber-ink)" : "var(--amber)"}`,
                      borderRadius: 3, padding: "2px 6px", fontFamily: MONO, fontSize: 10.5,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {verdict.line}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <span style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.06em", color: "var(--text-2)" }}>{streakCaption}</span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>
                avg {verdict.average} · line {verdict.line}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", marginTop: 14, background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ flex: 1, padding: "12px 14px" }}>
              <div style={label}>Clears by</div>
              <div style={{ ...cellValue, color: verdict.marginColor }}>{verdict.margin}</div>
            </div>
            <div style={{ flex: 1, padding: "12px 14px", borderLeft: "1px solid var(--line)" }}>
              <div style={label}>Defence</div>
              <div style={cellValue}>{(context && context.rank) || "—"}</div>
              {context && context.rankWord && (
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4, whiteSpace: "nowrap", color: context.rankColor }}>
                  {context.rankWord}
                </div>
              )}
            </div>
            <div style={{ flex: 1, padding: "12px 14px", borderLeft: "1px solid var(--line)" }}>
              <div style={label}>H2H{oppAbbr ? ` · ${oppAbbr}` : ""}</div>
              {/* No meetings in this window is a real answer, and a different
                  one from "0 of 3". It prints as an em dash, not as a zero. */}
              <div style={cellValue}>{h2h.length ? `${h2hCleared} of ${h2h.length}` : "—"}</div>
            </div>
            <div style={{ flex: 1, padding: "12px 14px", borderLeft: "1px solid var(--line)" }}>
              <div style={label}>Status</div>
              <div style={{
                fontFamily: MONO, fontSize: 12, marginTop: 8, letterSpacing: "0.06em",
                textTransform: "uppercase", whiteSpace: "nowrap",
                color: card.status ? card.status.color : "var(--dim)",
              }}>
                {card.status ? card.status.word : "—"}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, padding: 16, background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 6 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--amber-ink)" }}>
                The read
              </span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 20 }}>{verdict.sampleVerdict}</span>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-2)", marginTop: 10, textWrap: "pretty" }}>
              {readClauses.join(" ")}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderTop: "1px solid var(--line)", background: "var(--surface-1)" }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.05em", color: "var(--dim)", lineHeight: 1.5 }}>
            {new Date().getFullYear()} box scores, finished games only. No picks, no wagers. 21+
          </span>
          <span
            role="button" tabIndex={0} onClick={copyText}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copyText(); } }}
            style={{
              marginLeft: "auto", flex: "none", fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--text-2)", border: "1px solid var(--line)",
              borderRadius: 4, padding: "9px 13px", cursor: "pointer",
            }}
          >
            {copied || "Copy card"}
          </span>
          <span
            role="button" tabIndex={0} onClick={onAddPick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAddPick && onAddPick(); } }}
            style={{
              flex: "none", fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#ffffff", background: "var(--amber)",
              borderRadius: 4, padding: "9px 13px", cursor: "pointer",
            }}
          >
            {pickAdded ? "✓ In my picks" : "Add to my picks"}
          </span>
        </div>
      </div>
    </div>
  );
}
