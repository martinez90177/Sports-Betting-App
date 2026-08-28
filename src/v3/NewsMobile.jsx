import React from "react";
import PlayerAvatar from "../PlayerAvatar.jsx";
import { crest } from "./FormPlot.jsx";

// A transcription of frame `2c` in `v3 Mocks/PropPalace Mobile v3.dc.html`.
//
// The wire, its attribution and its counts are `NewsPageRedesign`'s own. This
// is the phone's layout: one filter row with counts, a flat list of items, the
// standing note about what news is and is not, and the availability legend.
//
// The mock's filter row is All / Watching only -- "Injuries lives on its own
// tab, so it is not a filter here", and this app has exactly that tab.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

// The four availability states, in the fixed hexes CLAUDE.md rule 2 names --
// not tokens, because these must not re-tint with the accent. Unknown draws no
// dot, which states the rule by drawing nothing.
const LEGEND = [
  ["available", "#3ecf8e"],
  ["questionable", "#e8b13a"],
  ["out", "#ef5b5b"],
  ["unknown", null],
];

const STATUS_WORD = { active: "Available", questionable: "Questionable", out: "Out" };

function statusPill(status) {
  const bg = status === "out" ? "rgba(239,91,91,0.16)"
    : status === "questionable" ? "rgba(232,177,58,0.16)"
    : status === "active" ? "rgba(62,207,142,0.16)" : "rgba(139,152,171,0.14)";
  const fg = status === "out" ? "#ef5b5b"
    : status === "questionable" ? "#e8b13a"
    : status === "active" ? "#3ecf8e" : "var(--dim)";
  return {
    fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", padding: "3px 7px",
    borderRadius: 999, flex: "0 0 auto", whiteSpace: "nowrap", background: bg, color: fg,
  };
}

export default function NewsMobile({
  filters = [],
  filter,
  counts = {},
  onSetFilter,
  items = [],
  loading = false,
  error = null,
  footnote,
  onOpenLadder,
}) {
  return (
    <>
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
        <div className="nsb" style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto" }}>
          {filters.map((f) => {
            const on = f === filter;
            return (
              <div
                key={f}
                onClick={() => onSetFilter(f)}
                style={{
                  minHeight: 40, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 8,
                  fontFamily: MONO, fontSize: 12, whiteSpace: "nowrap", cursor: "pointer", flex: "0 0 auto",
                  border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                  background: on ? "var(--amber-dim)" : "var(--surface-1)",
                  color: on ? "var(--amber-ink)" : "var(--text-2)",
                }}
              >
                {f}
                <span
                  style={{
                    fontFamily: MONO, fontSize: 10, padding: "1px 6px", borderRadius: 999, marginLeft: 6,
                    background: on ? "var(--amber)" : "var(--surface-2)", color: on ? "#fff" : "var(--dim)",
                  }}
                >
                  {counts[f] ?? 0}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: "0 0 30px" }}>
        {loading && <div style={{ padding: 16, fontFamily: MONO, fontSize: 11.5, color: "var(--dim)" }}>Loading the wire…</div>}
        {!loading && items.length === 0 && (
          <div style={{ margin: 16, border: "1px dashed var(--line)", borderRadius: 12, padding: "20px 16px", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.7, color: "var(--dim)" }}>
            {/* A load failure and an empty filter are different facts. The
                error object itself is never printed -- it is a fetch's
                internals, not a sentence. Same copy as the desktop column. */}
            {error
              ? "Couldn't load news right now — try again shortly."
              : `Nothing matches ${filter}. Switch back to All to see the rest of the wire.`}
          </div>
        )}

        {items.map((it) => {
          const p = it.player;
          return (
            <div
              key={it.key}
              style={{ display: "flex", gap: 12, padding: "14px 16px", borderBottom: "1px solid #20242b", minHeight: 44 }}
            >
              {/* No placeholder face, dot or crest for an item the feed could
                  not attribute to a player. */}
              <span style={{ position: "relative", flex: "0 0 auto" }}>
                {p && (
                  <PlayerAvatar
                    name={p.name} alt={p.name} sport={p.sport} team={p.team}
                    headshotSrc={p.headshotSrc} fallbackSrc={p.fallbackSrc} espnId={p.espnId}
                    status={p.status} size={36} inset={2} surface="var(--bg)"
                  />
                )}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, flex: "1 1 auto" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  {p && p.team && <span role="img" style={crest(p.team, p.sport, 14)} />}
                  <span
                    style={{
                      fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.06em", color: "var(--dim)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}
                  >
                    {p ? [p.name, p.team, p.position].filter(Boolean).join(" · ") : it.source}
                  </span>
                  {p && p.status && <span style={statusPill(p.status)}>{STATUS_WORD[p.status] || "Unknown"}</span>}
                  <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>
                    {it.age}
                  </span>
                </span>
                <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35, textWrap: "pretty" }}>{it.headline}</span>
                {/* Only an item the feed attributed to a player carries an
                    AFFECTS row, and the rate never travels without its count. */}
                {p && p.affects && p.affects.length > 0 && (
                  <span
                    onClick={onOpenLadder ? () => onOpenLadder(p) : undefined}
                    role={onOpenLadder ? "button" : undefined}
                    tabIndex={onOpenLadder ? 0 : undefined}
                    onKeyDown={onOpenLadder ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenLadder(p); } } : undefined}
                    style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)", lineHeight: 1.4, cursor: onOpenLadder ? "pointer" : "default" }}
                  >
                    {`AFFECTS · ${p.affects.map((a) => `${a.label} ${a.line} · ${a.gamesOver} of ${a.gamesCounted}`).join(" · ")}`}
                  </span>
                )}
              </span>
            </div>
          );
        })}

        <div style={{ padding: 16, fontSize: 12.5, lineHeight: 1.6, color: "var(--dim)" }}>
          News is context for the numbers. Nothing here is a pick, and no item changes a hit rate — only finished games do that.
        </div>
        <div style={{ padding: "0 16px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>AVAILABILITY</span>
          {LEGEND.map(([label, hex]) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={hex
                  ? { width: 9, height: 9, borderRadius: 999, background: hex, display: "block", flex: "0 0 auto" }
                  : { width: 9, height: 9, display: "block", flex: "0 0 auto" }}
              />
              <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-2)" }}>
                {label}
              </span>
            </span>
          ))}
        </div>
        {footnote && (
          <div style={{ padding: "10px 16px 0", fontFamily: MONO, fontSize: 10, lineHeight: 1.6, color: "var(--dim)" }}>{footnote}</div>
        )}
      </div>
    </>
  );
}
