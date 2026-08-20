import React from "react";

// Presentational pieces for the matchup player page (Screen #2 / card 248),
// reached from a game rather than the prop feed. Same convention as
// PlayerContextBlocks.jsx: every component here takes fully-derived primitives
// (numbers, strings, arrays already computed by the sport page) rather than
// raw player/game objects, so no component in this file needs to know which
// sport it's rendering. All four *PropsPage components feed the same shapes.

// Breadcrumb bar for this screen -- kept in its own component (not shared
// with PlayerDetailBreadcrumb, the prop-feed page's breadcrumb) because the
// two pages are reached from different places and can evolve independently;
// see the note in PlayerDetailBreadcrumb.jsx.
export function MatchupBreadcrumb({ onBack, backLabel = "Games", matchupLabel, playerName, watching, onToggleWatch }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 20px", borderBottom: "1px solid var(--line)", background: "var(--panel)",
      fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase",
    }}>
      <button
        type="button" onClick={onBack}
        style={{ background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 0", flexShrink: 0 }}
      >
        ← {backLabel}
      </button>
      <span style={{ color: "var(--dim)" }}>/</span>
      <span className="pp-mono" style={{ color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{matchupLabel}</span>
      <span style={{ color: "var(--dim)" }}>/</span>
      <span className="pp-mono" style={{ color: "var(--text)", whiteSpace: "nowrap" }}>{playerName}</span>
      <button
        type="button" onClick={onToggleWatch}
        style={{
          marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
          fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 0", flexShrink: 0,
          color: watching ? "var(--amber)" : "var(--dim)", fontWeight: watching ? 700 : 400,
        }}
      >
        {watching ? "Watching This Prop" : "+ Watch This Prop"}
      </button>
    </div>
  );
}

// The 82px hero percentage + outcome-squares strip.
//
// `outcomes`: booleans, oldest to newest, left to right -- true cleared the
// line, false did not. Capped by the caller (the reference shows 9); this
// component just renders whatever it's given.
export function MatchupVerdictBlock({ pct, verb, line, sentence, outcomes = [] }) {
  return (
    <div style={{ padding: "28px", borderBottom: "1px solid var(--line)", display: "flex", gap: 34, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, justifyContent: "center" }}>
          <span className="pp-mono" style={{ fontSize: 72, fontWeight: 600, lineHeight: 0.9, color: "var(--pos)", fontVariantNumeric: "tabular-nums" }}>{pct}</span>
          <span className="pp-mono" style={{ fontSize: 22, color: "var(--pos)" }}>%</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--dim)", marginTop: 8 }}>went {verb} {line}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 220, flex: "1 1 auto" }}>
        <div className="pp-display" style={{ fontSize: 20, lineHeight: 1.3, color: "var(--text)" }}>{sentence}</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {outcomes.map((over, i) => (
            <span
              key={i}
              title={over ? "Over" : "Under"}
              style={{
                width: 18, height: 18, flexShrink: 0,
                background: over ? "var(--pos)" : "transparent",
                border: over ? "none" : "1.5px solid var(--neg)",
                boxSizing: "border-box",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--dim)", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: "var(--pos)", display: "inline-block" }} /> over
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, border: "1.5px solid var(--neg)", boxSizing: "border-box", display: "inline-block" }} /> under
          </span>
          <span>oldest to newest, left to right</span>
        </div>
      </div>
    </div>
  );
}

// "EVERY GAME BEHIND THAT NUMBER" -- columns and rows are both handed in, so
// this stays sport-agnostic. `rows[].result` is "OVER" | "UNDER"; a per-row
// `note` is only ever real box-score context (this app has no per-play data
// to fabricate a "left injured" style annotation from, so callers that have
// nothing real to say here should pass no note rather than guessing).
export function GameLogTable({ title = "Every game behind that number", columns, rows }) {
  return (
    <div style={{ padding: "24px 28px" }}>
      <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "var(--dim)", marginBottom: 14, textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: columns.map((c) => c.width || "1fr").join(" "),
        padding: "0 0 9px", borderBottom: "1px solid var(--line)",
      }}>
        {columns.map((c) => (
          <span key={c.key} className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--dim)", textAlign: c.align || "left" }}>
            {c.label}
          </span>
        ))}
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "grid", gridTemplateColumns: columns.map((c) => c.width || "1fr").join(" "),
            padding: "11px 0", borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--line-subtle, rgba(255,255,255,0.06))",
            fontSize: 14, alignItems: "center",
          }}
        >
          {columns.map((c) => {
            if (c.key === "result") {
              return (
                <span key={c.key} className="pp-mono" style={{ fontSize: 11.5, letterSpacing: "0.08em", textAlign: c.align || "left", color: r.result === "OVER" ? "var(--pos)" : "var(--neg)" }}>
                  {r.result}{r.note ? ` · ${r.note}` : ""}
                </span>
              );
            }
            return (
              <span key={c.key} className="pp-mono tnum" style={{ textAlign: c.align || "left", color: c.key === "opponent" ? "var(--text)" : "var(--dim-strong)" }}>
                {r[c.key]}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// "THE READ" -- a plain-language summary, but every clause traces to a real
// number already computed by the caller. No modelled probability, no
// invented narrative detail: `sentence` is composed by the caller from real
// split rates and the same STRONG/FAIR/THIN sample tiering MetricRail uses
// elsewhere on this page, not from anything this component decides on its own.
export function TheRead({ lean, sentence, confidenceTier, confidenceNote }) {
  const leanLabel = lean === "over" ? "Leans over" : lean === "under" ? "Leans under" : "Even read";
  const leanColor = lean === "over" ? "var(--pos)" : lean === "under" ? "var(--neg)" : "var(--dim)";
  const dots = { THIN: 1, FAIR: 2, STRONG: 3 }[confidenceTier] || 1;
  return (
    <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--line)" }}>
      <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "var(--dim)", marginBottom: 10 }}>THE READ</div>
      <div className="pp-display" style={{ fontSize: 22, color: leanColor, marginBottom: 10 }}>{leanLabel}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--dim-strong)", marginBottom: 14 }}>{sentence}</div>
      <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 22, height: 4, background: i < dots ? "var(--amber)" : "var(--line)" }} />
        ))}
      </div>
      <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--dim)" }}>
        CONFIDENCE · {confidenceTier}
      </div>
      {confidenceNote && <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 6, lineHeight: 1.5 }}>{confidenceNote}</div>}
    </div>
  );
}

// "SPLITS · GAMES COUNTED IN EACH" -- a bar + count per row, rather than
// HitRateSplits' pill-cell layout (that component stays on the prop-feed
// page; this is the design's own shape for this screen).
//
// rows: [{ label, rate: 0..1 | null, count: { value, label } }]. `rate: null`
// means fewer than 2 games -- shown with an unfilled bar, per the design's
// own "shown but not scored" rule, rather than hidden.
export function MatchupSplits({ rows, footnote }) {
  return (
    <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--line)" }}>
      <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "var(--dim)", marginBottom: 14 }}>
        SPLITS · GAMES COUNTED IN EACH
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 14, alignItems: "center", padding: "9px 0" }}>
          <span style={{ fontSize: 13, color: "var(--dim-strong)" }}>{r.label}</span>
          <span style={{ display: "flex", height: 6, background: "var(--surface-sunken)", overflow: "hidden" }}>
            {r.rate !== null && <span style={{ width: `${Math.round(r.rate * 100)}%`, background: "var(--pos)" }} />}
          </span>
          <span className="pp-mono tnum" style={{ fontSize: 12, color: "var(--dim)", whiteSpace: "nowrap" }}>{r.count}</span>
        </div>
      ))}
      {footnote && <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 12, lineHeight: 1.5 }}>{footnote}</div>}
    </div>
  );
}

// "HOW OFTEN HE CATCHES EACH TOTAL" -- a real frequency histogram over the
// same `values` the chart/verdict use. `bins`: [{ value, count, cleared }],
// sorted ascending by value. No smoothing, no modelled distribution -- one
// bar per distinct value that actually occurred in the log.
export function ValueDistribution({ title, bins, footnote }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  return (
    <div style={{ padding: "24px 28px" }}>
      <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "var(--dim)", marginBottom: 14, textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 64 }}>
        {bins.map((b) => (
          <span
            key={b.value}
            title={`${b.count} game${b.count === 1 ? "" : "s"}`}
            style={{
              flex: "1 1 auto", height: `${Math.max(6, Math.round((b.count / max) * 64))}px`,
              background: b.cleared ? "var(--pos)" : "transparent",
              border: b.cleared ? "none" : "1.5px solid var(--neg)",
              boxSizing: "border-box",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        {bins.map((b) => (
          <span key={b.value} className="pp-mono tnum" style={{ flex: "1 1 auto", textAlign: "center", fontSize: 11, color: "var(--dim)" }}>
            {b.value}
          </span>
        ))}
      </div>
      {footnote && <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 12, lineHeight: 1.5 }}>{footnote}</div>}
    </div>
  );
}
