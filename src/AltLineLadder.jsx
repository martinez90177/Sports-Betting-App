import React from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";

// Alt-line ladder. One row per alternate line for a single player + market.
//
// rungs: [{ line, hitRate, gamesOver, gamesCounted, price, isMain, thin }]
// Every rate is derived from the same finished games as the main line -- do not
// model or interpolate rungs, and mark a rung thin when gamesCounted < 10.

const GRID = "92px 84px 128px 1fr 96px 104px";
const strong = (r) => r >= 0.7;

// A rung the sample never split carries no price -- see rungAt in
// lib/altLines.js. A dash, not a clamped number pretending to be one.
// U+2212 MINUS SIGN, matching formatOdds in odds.js -- at tabular-nums a
// hyphen is visibly shorter than the `+` it alternates with down a column.
const fmtPrice = (p) => (p == null ? "—" : p > 0 ? `+${p}` : `−${Math.abs(p)}`);
const pct = (r) => (r == null ? "—" : `${Math.round(r * 100)}%`);

function LadderRow({ rung, onAddLeg, inSlip, countLabel }) {
  // `thin` is deliberately not read here. Every rung in a ladder is counted
  // over the same window, so thinness is one fact about the whole ladder --
  // stated once on its header. Repeated down a column it reads as a
  // difference between rungs, which it never is.
  const { line, hitRate, gamesOver, gamesCounted, price, isMain } = rung;
  const rateColor = strong(hitRate) ? "var(--pos, #3ecf8e)" : "var(--dim-strong, #aab2c0)";
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: GRID, alignItems: "center",
        padding: isMain ? "15px 28px" : "13px 28px",
        borderBottom: "1px solid var(--line)",
        borderLeft: isMain ? "3px solid var(--accent, #3b5bdb)" : "3px solid transparent",
        background: isMain ? "var(--panel2)" : "transparent",
      }}
    >
      <span className="pp-mono" style={{ fontSize: isMain ? 19 : 17, fontWeight: isMain ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>{line}</span>
      <span className="pp-mono" style={{ textAlign: "right", fontSize: isMain ? 18 : 16, fontWeight: 600, color: rateColor, fontVariantNumeric: "tabular-nums" }}>{pct(hitRate)}</span>
      <span
        style={{ textAlign: "right", fontSize: 13, color: "var(--dim)" }}
        title={`${gamesOver} of the same ${gamesCounted} finished games ${countLabel === "under" ? "stayed under" : "cleared"} ${line}`}
      >
        {gamesOver} of {gamesCounted}
      </span>
      <span style={{ paddingLeft: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "flex", height: 6, width: 190, background: "var(--panel2)" }}>
          <span style={{ width: hitRate == null ? 0 : pct(hitRate), background: strong(hitRate) ? "var(--pos, #3ecf8e)" : "#6c7688" }} />
        </span>
        {isMain && <span className="pp-mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--accent-text, #8fa6ff)" }}>MAIN LINE</span>}
      </span>
      <span className="pp-mono" style={{ textAlign: "right", fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{fmtPrice(price)}</span>
      <span style={{ textAlign: "right" }}>
        {inSlip ? (
          <span className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.08em", background: "var(--accent, #3b5bdb)", color: "#fff", padding: "8px 11px" }}>IN SLIP</span>
        ) : (
          <button
            type="button"
            onClick={() => onAddLeg && onAddLeg(rung)}
            className="pp-mono"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, letterSpacing: "0.08em", color: "var(--accent-text, #8fa6ff)", padding: 0 }}
          >
            + ADD LEG
          </button>
        )}
      </span>
    </div>
  );
}

export default function AltLineLadder({
  player, market, markets = [], rungs = [], slipLines = [], onAddLeg, onMarketChange,
  sport, colorMap, direction = "over", emptyNote,
}) {
  const counted = rungs.length ? rungs[0].gamesCounted : 0;
  // One window behind every rung, so one thinness statement for the ladder.
  const thin = rungs.length > 0 && rungs[0].thin;
  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 28px", background: "var(--panel2)" }}>
        {/* Rule 1: a player's face and their availability travel together.
            `status` is passed through unchanged -- PlayerAvatar draws no dot at
            all for an unknown status, which is the correct read here rather
            than a default to green. `sport`/`colorMap` matter because team
            abbreviations collide across leagues (see PlayerAvatar). */}
        <PlayerAvatar
          name={player.name} team={player.team} sport={sport} colorMap={colorMap}
          espnId={player.espnId} headshotSrc={player.headshotSrc} fallbackSrc={player.fallbackSrc}
          status={player.status} size={52} surface="var(--panel2)" inset={2}
        />
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <span className="pp-display" style={{ fontWeight: 600, letterSpacing: "-0.01em", fontSize: 24 }}>{player.name}</span>
            <span className="pp-mono" style={{ fontSize: 11.5, color: "var(--dim)" }}>
              {player.team}{player.position ? ` · ${player.position}` : ""}
            </span>
          </div>
          <div style={{ fontSize: 13.5, color: "var(--dim-strong, #aab2c0)", marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>{market}</span>
            {counted ? <span style={{ color: "var(--dim)" }}>· {counted} finished games counted</span> : null}
            {thin && (
              <span
                className="pp-mono"
                title={`Every rung here is counted over the same ${counted} games — fewer than 10`}
                /* Neutral on purpose. The accent means selected/interactive in
                   this app and this badge is neither, and the three
                   availability colours are reserved for health. */
                style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--dim)", border: "1px solid var(--line-strong, var(--line))", padding: "3px 7px" }}
              >
                THIN
              </span>
            )}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {markets.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMarketChange && onMarketChange(m)}
              className="pp-mono"
              style={{
                cursor: "pointer", fontSize: 11.5, padding: "8px 13px",
                background: m === market ? "var(--accent, #3b5bdb)" : "transparent",
                color: m === market ? "#fff" : "var(--dim-strong, #aab2c0)",
                border: m === market ? "1px solid var(--accent, #3b5bdb)" : "1px solid var(--line)",
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div
        className="pp-mono"
        style={{
          display: "grid", gridTemplateColumns: GRID, alignItems: "center", padding: "10px 28px",
          borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
          background: "var(--panel2)", fontSize: 10.5, letterSpacing: "0.14em", color: "var(--dim)",
        }}
      >
        <span>LINE</span><span style={{ textAlign: "right" }}>HIT RATE</span>
        {/* The count column is the number of games on *this bet's* side of the
            line, so on an Under ladder "GAMES OVER" would name the losing half
            of its own column. */}
        <span style={{ textAlign: "right" }}>{direction === "under" ? "GAMES UNDER" : "GAMES OVER"}</span>
        <span style={{ paddingLeft: 20 }}>SHAPE</span>
        <span style={{ textAlign: "right" }}>PRICE</span><span />
      </div>

      {/* Rule 4: a ladder that can't be built surfaces as a visible state, not
          as an empty space where rows should be. */}
      {rungs.length === 0 ? (
        <div style={{ padding: "18px 28px", fontSize: 13, color: "var(--dim)", lineHeight: 1.55 }}>
          {emptyNote || "No alt lines for this market."}
        </div>
      ) : (
        rungs.map((r) => (
          <LadderRow
            key={r.line}
            rung={r}
            onAddLeg={onAddLeg}
            inSlip={slipLines.includes(r.line)}
            countLabel={direction}
          />
        ))
      )}

      <div style={{ padding: "12px 28px", fontSize: 12.5, color: "var(--dim)", lineHeight: 1.55 }}>
        Every rung is counted from the same {counted || ""} finished games, not modelled — no rung is
        interpolated from the ones around it.{" "}
        {thin ? "Fewer than 10 games sit behind this ladder, so it is marked thin rather than hidden. " : ""}
        {/* Stated plainly, because the PRICE column looks exactly like a book's
            and isn't one. The app has no alt-line odds feed at all: real posted
            odds appear in one place (the MLB sportsbook panel) and cover the
            main line only. */}
        No sportsbook priced these rungs. Each price is that rung's own hit rate
        converted to American odds — what the sample implies, not what anyone is
        offering. A rung the sample never split shows no price at all.
      </div>
    </div>
  );
}

// A slip leg that can move up or down a rung. Renders the stepper, the ALT
// badge, and the plain-language trade-off against the main line.
export function SlipLeg({ leg, rungs = [], onChangeLine, onRemove, sport, colorMap, surface = "var(--panel)", note }) {
  const idx = rungs.findIndex((r) => r.line === leg.line);
  const main = rungs.find((r) => r.isMain);
  // ALT means "off the posted line", not "the user changed it". A leg the app
  // opened on a rung is ALT untouched; a leg dragged back onto the posted line
  // is not. `mainLine` rides on the leg so this still holds after a reload,
  // when there is no feed row left to compare against.
  const mainLine = main ? main.line : leg.mainLine;
  const isAlt = mainLine != null && leg.line !== mainLine;
  // A leg with no ladder behind it (saved before alt lines existed) keeps its
  // line and its numbers and simply cannot be stepped -- never dropped, and
  // never silently rendered as if the stepper were broken.
  const steppable = idx >= 0 && rungs.length > 0;
  const step = (dir) => {
    const next = rungs[idx + dir];
    if (next && onChangeLine) onChangeLine(next);
  };
  const rate = leg.hitRate;
  const accent = isAlt ? "var(--accent, #3b5bdb)" : "var(--line)";
  const mainIdx = rungs.findIndex((r) => r.isMain);
  const rungsMoved = steppable && mainIdx >= 0 ? Math.abs(idx - mainIdx) : 0;

  return (
    <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)", background: isAlt ? "var(--panel2)" : "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Rule 1 again: the slip is a surface where a player is named, so the
            avatar carries their availability. This is the same status the feed
            row showed; unknown stays dotless. */}
        <PlayerAvatar
          name={leg.player.name} team={leg.player.team} sport={sport} colorMap={colorMap}
          espnId={leg.player.espnId} headshotSrc={leg.player.headshotSrc} fallbackSrc={leg.player.fallbackSrc}
          status={leg.player.status} surface={surface} size={38} inset={2}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15 }}>{leg.player.name}</span>
            {leg.player.team && (
              <span className="pp-mono" style={{ fontSize: 11, color: "var(--dim)" }}>{leg.player.team}</span>
            )}
            {/* Outlined, not a solid accent fill. A filled badge on every
                off-market leg read as the loudest thing in the row, ahead of
                the player and the line it was describing. */}
            {isAlt && (
              <span className="pp-mono" style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em",
                color: "var(--accent-text, #8fa6ff)",
                border: "1px solid var(--accent, #3b5bdb)", padding: "2px 5px",
              }}>ALT</span>
            )}
          </div>
          {/* The rung's relationship to the posted line moved out of here and
              into the sentence beside the stepper, where the numbers behind
              the claim sit with it. */}
          <div style={{ fontSize: 13.5, color: "var(--dim-strong, #aab2c0)", marginTop: 3 }}>
            {leg.side} {leg.market}
          </div>
        </div>
        {/* Price rides the header row, next to the player it prices. It used
            to sit under the stepper beside the hit rate, which put the two
            numbers that move in opposite directions in one column and made
            them read as a pair of related figures. */}
        {leg.price != null && (
          <span className="pp-mono" style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {fmtPrice(leg.price)}
          </span>
        )}
        <button type="button" onClick={onRemove} aria-label="Remove leg" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "var(--dim)", paddingLeft: 4, flexShrink: 0 }}>×</button>
      </div>

      {/* Indented to clear the avatar, so the stepper and its sentence line up
          under the proposition they belong to rather than under the photo. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 13, paddingLeft: 51 }}>
        {/* 44px hit areas on both steppers. A leg at the end of its ladder
            disables that direction rather than hiding it, so the control
            doesn't change shape as the line moves. */}
        <span style={{ display: "flex", alignItems: "center", border: `1px solid ${accent}` }}>
          <button type="button" onClick={() => step(-1)} aria-label="Lower line" className="pp-mono"
            disabled={!steppable || idx === 0}
            style={{ width: 44, height: 44, background: "none", border: "none", borderRight: `1px solid ${accent}`, cursor: !steppable || idx === 0 ? "default" : "pointer", opacity: !steppable || idx === 0 ? 0.35 : 1, fontSize: 17, color: isAlt ? "var(--accent-text, #8fa6ff)" : "var(--dim-strong, #aab2c0)" }}>−</button>
          <span className="pp-mono" style={{ minWidth: 68, textAlign: "center", fontSize: 17, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: isAlt ? "var(--accent-text, #8fa6ff)" : "var(--text)" }}>{leg.line}</span>
          <button type="button" onClick={() => step(1)} aria-label="Raise line" className="pp-mono"
            disabled={!steppable || idx === rungs.length - 1}
            style={{ width: 44, height: 44, background: "none", border: "none", borderLeft: `1px solid ${accent}`, cursor: !steppable || idx === rungs.length - 1 ? "default" : "pointer", opacity: !steppable || idx === rungs.length - 1 ? 0.35 : 1, fontSize: 17, color: isAlt ? "var(--accent-text, #8fa6ff)" : "var(--dim-strong, #aab2c0)" }}>+</button>
        </span>
        {/* The trade-off, in words, beside the stepper that makes it -- what
            this rung is relative to the posted line, and what moving there
            did to the rate and the price. Every clause is guarded: a rung the
            sample never split has no price, so the sentence states the
            hit-rate move alone rather than differencing against a missing
            number. The posted line and its rate close the sentence in dimmer
            text, so the thing being compared against is never off-screen. */}
        <div style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.45, minWidth: 0 }}>
          {!isAlt ? (
            <>
              Posted line.
              {rate != null && leg.gamesCounted
                ? ` ${leg.gamesOver} of ${leg.gamesCounted} in this window.`
                : ""}
            </>
          ) : (
            <>
              {rungsMoved
                ? `${rungsMoved} rung${rungsMoved === 1 ? "" : "s"} ${leg.line < mainLine ? "below" : "above"} the posted ${mainLine}.`
                : `Off the posted ${mainLine}.`}
              {main && rate != null && main.hitRate != null && (
                <>
                  {" "}
                  {(() => {
                    const pts = Math.round((rate - main.hitRate) * 100);
                    const verb = pts > 0 ? "Buys" : pts < 0 ? "Gives up" : "Moves";
                    const priceBit = leg.price != null && main.price != null && leg.price !== main.price
                      ? ` and ${Math.abs(leg.price - main.price)} of price`
                      : "";
                    return `${verb} ${Math.abs(pts)} points of hit rate${priceBit}, over the same ${leg.gamesCounted} games.`;
                  })()}
                  {" "}
                  <span className="pp-mono" style={{ color: "var(--dim)", opacity: 0.75 }}>
                    POSTED {main.line} · {pct(main.hitRate)}
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {note && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--dim)", lineHeight: 1.45, fontStyle: "italic" }}>
          {note}
        </div>
      )}
    </div>
  );
}
