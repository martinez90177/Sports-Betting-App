import React from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";

// Alt-line ladder. One row per alternate line for a single player + market.
//
// rungs: [{ line, hitRate, gamesOver, gamesCounted, price, isMain, thin }]
// Every rate is derived from the same finished games as the main line -- do not
// model or interpolate rungs, and mark a rung thin when gamesCounted < 10.

const GRID = "92px 84px 128px 1fr 96px 104px";
const strong = (r) => r >= 0.7;

const fmtPrice = (p) => (p > 0 ? `+${p}` : String(p));
const pct = (r) => `${Math.round(r * 100)}%`;

function LadderRow({ rung, onAddLeg, inSlip }) {
  const { line, hitRate, gamesOver, gamesCounted, price, isMain, thin } = rung;
  const rateColor = strong(hitRate) ? "var(--pos, #3ecf8e)" : "var(--dim-strong, #aab2c0)";
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: GRID, alignItems: "center",
        padding: isMain ? "15px 28px" : "13px 28px",
        borderBottom: "1px solid var(--line)",
        borderLeft: isMain ? "3px solid var(--accent, #3b5bdb)" : "3px solid transparent",
        background: isMain ? "var(--panel2)" : "transparent",
        color: thin ? "var(--dim)" : "inherit",
      }}
    >
      <span className="pp-mono" style={{ fontSize: isMain ? 19 : 17, fontWeight: isMain ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>{line}</span>
      <span className="pp-mono" style={{ textAlign: "right", fontSize: isMain ? 18 : 16, fontWeight: 600, color: rateColor, fontVariantNumeric: "tabular-nums" }}>{pct(hitRate)}</span>
      <span style={{ textAlign: "right", fontSize: 13, color: "var(--dim)" }}>{gamesOver} of {gamesCounted}</span>
      <span style={{ paddingLeft: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "flex", height: 6, width: 190, background: "var(--panel2)" }}>
          <span style={{ width: pct(hitRate), background: strong(hitRate) ? "var(--pos, #3ecf8e)" : "#6c7688" }} />
        </span>
        {isMain && <span className="pp-mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--accent-text, #8fa6ff)" }}>MAIN LINE</span>}
        {thin && <span className="pp-mono" style={{ fontSize: 10, letterSpacing: "0.1em" }}>THIN</span>}
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

export default function AltLineLadder({ player, market, markets = [], rungs = [], slipLines = [], onAddLeg, onMarketChange }) {
  const counted = rungs.find((r) => r.isMain)?.gamesCounted;
  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 28px", background: "var(--panel2)" }}>
        <PlayerAvatar name={player.name} team={player.team} espnId={player.espnId} headshotSrc={player.headshotSrc} status={player.status} size={52} surface="var(--panel2)" />
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <span className="pp-display" style={{ fontWeight: 600, letterSpacing: "-0.01em", fontSize: 24 }}>{player.name}</span>
            <span className="pp-mono" style={{ fontSize: 11.5, color: "var(--dim)" }}>{player.team} · {player.position}</span>
          </div>
          <div style={{ fontSize: 13.5, color: "var(--dim-strong, #aab2c0)", marginTop: 3 }}>
            {market}{counted ? <span style={{ color: "var(--dim)" }}> · {counted} finished games counted</span> : null}
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
        <span style={{ textAlign: "right" }}>GAMES OVER</span><span style={{ paddingLeft: 20 }}>SHAPE</span>
        <span style={{ textAlign: "right" }}>PRICE</span><span />
      </div>

      {rungs.map((r) => (
        <LadderRow key={r.line} rung={r} onAddLeg={onAddLeg} inSlip={slipLines.includes(r.line)} />
      ))}

      <div style={{ padding: "12px 28px", fontSize: 12.5, color: "var(--dim)", lineHeight: 1.55 }}>
        Alt rungs are counted from the same finished games, not modelled. A rung with fewer than 10 games behind it is marked thin.
      </div>
    </div>
  );
}

// A slip leg that can move up or down a rung. Renders the stepper, the ALT
// badge, and the plain-language trade-off against the main line.
export function SlipLeg({ leg, rungs = [], onChangeLine, onRemove }) {
  const idx = rungs.findIndex((r) => r.line === leg.line);
  const main = rungs.find((r) => r.isMain);
  const isAlt = main && leg.line !== main.line;
  const step = (dir) => {
    const next = rungs[idx + dir];
    if (next && onChangeLine) onChangeLine(next);
  };
  const rate = leg.hitRate;
  const accent = isAlt ? "var(--accent, #3b5bdb)" : "var(--line)";
  const rungsMoved = main ? Math.abs(idx - rungs.findIndex((r) => r.isMain)) : 0;

  return (
    <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)", background: isAlt ? "var(--panel2)" : "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <PlayerAvatar name={leg.player.name} team={leg.player.team} espnId={leg.player.espnId} headshotSrc={leg.player.headshotSrc} size={38} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 14.5 }}>{leg.player.name}</span>
            {isAlt && (
              <span className="pp-mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", background: "var(--accent, #3b5bdb)", color: "#fff", padding: "3px 6px" }}>ALT</span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 2 }}>
            {leg.side} {leg.market}{isAlt ? ` · moved ${rungsMoved} rung${rungsMoved === 1 ? "" : "s"} ${leg.line < main.line ? "down" : "up"}` : " · main line"}
          </div>
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove leg" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "var(--dim)" }}>×</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 13 }}>
        <span style={{ display: "flex", alignItems: "center", border: `1px solid ${accent}` }}>
          <button type="button" onClick={() => step(-1)} aria-label="Lower line" className="pp-mono"
            style={{ width: 44, height: 44, background: "none", border: "none", borderRight: `1px solid ${accent}`, cursor: "pointer", fontSize: 17, color: isAlt ? "var(--accent-text, #8fa6ff)" : "var(--dim-strong, #aab2c0)" }}>−</button>
          <span className="pp-mono" style={{ minWidth: 68, textAlign: "center", fontSize: 17, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: isAlt ? "var(--accent-text, #8fa6ff)" : "var(--text)" }}>{leg.line}</span>
          <button type="button" onClick={() => step(1)} aria-label="Raise line" className="pp-mono"
            style={{ width: 44, height: 44, background: "none", border: "none", borderLeft: `1px solid ${accent}`, cursor: "pointer", fontSize: 17, color: isAlt ? "var(--accent-text, #8fa6ff)" : "var(--dim-strong, #aab2c0)" }}>+</button>
        </span>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div className="pp-mono" style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: rate >= 0.7 ? "var(--pos, #3ecf8e)" : "var(--dim-strong, #aab2c0)" }}>{pct(rate)}</div>
          <div className="pp-mono" style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{fmtPrice(leg.price)} · {leg.gamesOver} of {leg.gamesCounted}</div>
        </div>
      </div>

      {isAlt && main && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12, fontSize: 12.5, lineHeight: 1.5 }}>
          <span className="pp-mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--accent-text, #8fa6ff)" }}>
            WAS {main.line} · {pct(main.hitRate)}
          </span>
          <span style={{ color: "var(--dim)" }}>
            {rungsMoved} rung{rungsMoved === 1 ? "" : "s"} {leg.line < main.line ? "down" : "up"} moves the hit rate by {Math.round((rate - main.hitRate) * 100)} points and the price by {Math.abs(leg.price - main.price)}.
          </span>
        </div>
      )}
    </div>
  );
}
