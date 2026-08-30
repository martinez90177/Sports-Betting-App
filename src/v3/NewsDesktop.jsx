import React from "react";
import { crest } from "./FormPlot.jsx";

// A transcription of frame `2d` in `v3 Mocks/PropPalace Desktop v3.dc.html`.
//
// The wire beside a 336px rail: filters and item rows on the left, the
// availability key and what the wire says about the slip on the right.
//
// Same items, same attribution and same counts as the phone frame — this is a
// layout, and `NewsPageRedesign` still decides what an article is about.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

// Header / row share one template, defined once (`desktop-handoff.md` §1).
const ROW_COLS = "40px minmax(0, 1fr) 210px 86px";

const micro = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };

// The three availability colours and the fourth state that has none. Literal
// hexes rather than `--amber`, which is the accent: CLAUDE.md rule 2, and the
// naming trap it names.
const AVAIL = [
  ["available", "#3ecf8e"],
  ["questionable", "#e8b13a"],
  ["out", "#ef5b5b"],
  ["unknown", null],
];

export default function NewsDesktop({
  filters = [],
  filter,
  counts = {},
  onSetFilter,
  items = [],
  loading = false,
  error = null,
  footnote = null,
  onOpenLadder,
  renderAvatar,
  // Open legs, for the rail's ON YOUR SLIP. The wire naming a leg is worth
  // surfacing; it is still context, and it moves no rate.
  slipLegs = [],
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

  // Legs the wire actually names. Matched on the player the article was
  // attributed to, not on the headline text — a name appearing in a sentence
  // about someone else is not this leg being written about.
  const named = React.useMemo(() => {
    const ids = new Set(items.map((it) => it.player && it.player.id).filter(Boolean));
    const names = new Set(items.map((it) => it.player && it.player.name).filter(Boolean));
    return (slipLegs || []).filter((l) => ids.has(l.playerId) || names.has(l.name));
  }, [items, slipLegs]);

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
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)", gridTemplateColumns: "minmax(0, 1fr) 336px" }}>
        {/* ---- the wire --------------------------------------------------- */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "14px 24px", borderBottom: "1px solid var(--line)" }}>
            {filters.map((f) => {
              const on = filter === f;
              return (
                <div
                  key={f}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSetFilter && onSetFilter(f)}
                  onKeyDown={(e) => { if (e.key === "Enter") onSetFilter && onSetFilter(f); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, minHeight: 32, padding: "0 13px", borderRadius: 7,
                    fontFamily: MONO, fontSize: 11.5, cursor: "pointer",
                    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                    background: on ? "var(--amber-dim)" : "var(--surface-1)",
                    color: on ? "var(--amber-ink)" : "var(--text-2)",
                  }}
                >
                  {f}
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{counts[f] ?? 0}</span>
                </div>
              );
            })}
            {/* The screen says what it is for. Nothing in the wire is counted
                into a rate, and the sentence stops the reader looking for one. */}
            <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: "var(--dim)" }}>
              NEWS IS CONTEXT — NO ITEM MOVES A HIT RATE
            </span>
          </div>

          <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
            {loading && items.length === 0 && (
              <div style={{ padding: "22px 24px", fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>Reading the wire…</div>
            )}
            {error && (
              <div style={{ padding: "22px 24px", fontSize: 13, lineHeight: 1.6, color: "var(--dim)", maxWidth: 560 }}>{error}</div>
            )}
            {!loading && !error && items.length === 0 && (
              <div style={{ padding: "22px 24px", fontSize: 13, color: "var(--dim)" }}>Nothing on the wire for this filter.</div>
            )}

            {items.map((it) => {
              const p = it.player;
              const affects = (p && p.affects) || [];
              return (
                <div
                  key={it.key}
                  role={p && onOpenLadder ? "button" : undefined}
                  tabIndex={p && onOpenLadder ? 0 : undefined}
                  onClick={p && onOpenLadder ? () => onOpenLadder(p) : undefined}
                  onKeyDown={p && onOpenLadder ? (e) => { if (e.key === "Enter") onOpenLadder(p); } : undefined}
                  style={{
                    display: "grid", gridTemplateColumns: ROW_COLS, alignItems: "center", columnGap: 14,
                    padding: "14px 24px", borderBottom: "1px solid #20242b",
                    cursor: p && onOpenLadder ? "pointer" : "default",
                  }}
                >
                  {/* An item the feed could not attribute carries no face —
                      and, below, no affected props either. */}
                  <span style={{ position: "relative" }}>{p && renderAvatar ? renderAvatar(p, 36) : null}</span>

                  <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                      {p && p.team && <span role="img" style={crest(p.team, p.sport, 14)} />}
                      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                        {p ? `${String(p.name).toUpperCase()}${p.team ? ` · ${p.team}` : ""}` : "UNATTRIBUTED"}
                      </span>
                      {it.source && (
                        <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>{it.source}</span>
                      )}
                    </span>
                    <span style={{ fontSize: 13.5, lineHeight: 1.45, color: "var(--text)", textWrap: "pretty" }}>{it.headline}</span>
                  </span>

                  <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {affects.length
                      ? affects.map((a) => `${String(a.label).toUpperCase()} ${a.line}`).join(" · ")
                      : ""}
                  </span>

                  <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", textAlign: "right", whiteSpace: "nowrap" }}>{it.age}</span>
                </div>
              );
            })}

            {footnote && (
              <div style={{ padding: "16px 24px 26px", fontSize: 11.5, lineHeight: 1.5, color: "var(--dim)" }}>{footnote}</div>
            )}
          </div>
        </div>

        {/* ---- rail ------------------------------------------------------- */}
        <div className="nsb" style={{ borderLeft: "1px solid var(--line)", overflowY: "auto", padding: "20px 20px 30px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", padding: 15, display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={micro}>AVAILABILITY</span>
            {AVAIL.map(([label, colour]) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={colour
                  ? { width: 9, height: 9, borderRadius: 999, background: colour, display: "block", flex: "0 0 auto" }
                  : { width: 9, height: 9, borderRadius: 999, border: "1px dashed var(--line-strong, var(--line))", display: "block", flex: "0 0 auto", boxSizing: "border-box" }} />
                <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{label}</span>
              </span>
            ))}
            <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--dim)" }}>
              Unknown draws no dot. An item the feed could not attribute to a player carries no face and no affected props.
            </span>
          </div>

          <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", padding: 15, display: "flex", flexDirection: "column", gap: 9 }}>
            <span style={micro}>ON YOUR SLIP</span>
            {named.map((l) => (
              <div key={l.id} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", whiteSpace: "nowrap" }}>{l.subtitle}</span>
              </div>
            ))}
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: named.length ? "var(--text-2)" : "var(--dim)" }}>
              {named.length
                ? `${named.length} ${named.length === 1 ? "leg on your slip is" : "legs on your slip are"} named in the wire.`
                : "Nothing in the wire names a leg on your slip."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
