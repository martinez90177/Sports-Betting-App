import React from "react";
import { crest } from "./FormPlot.jsx";

// A transcription of frame `2e` in `v3 Mocks/PropPalace Desktop v3.dc.html`.
//
// A 224px rail of LEAGUE / STATUS / SORT beside the wire as a table. Same props
// `InjuriesMobile` takes, off the same feed and the same coverage rules.
//
// The frame's rail has no search. The page has one and it filters the wire, so
// it stays at the top of the rail — the same call as the Games frame.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

// Header and rows share one template (`desktop-handoff.md` §1).
const ROW_COLS = "40px minmax(0, 1fr) 250px 120px 96px";

const railLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };

function railPill(on) {
  return {
    minHeight: 34, display: "flex", alignItems: "center", padding: "0 11px",
    borderRadius: 7, fontFamily: MONO, fontSize: 12, cursor: "pointer",
    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
    background: on ? "var(--amber-dim)" : "var(--surface-1)",
    color: on ? "var(--amber-ink)" : "var(--text-2)",
  };
}

// Exactly three availability colours, as literal hexes. `--amber` is the
// accent, not amber — CLAUDE.md rule 2 and the naming trap it names.
const STATUS_TONE = {
  out: { fg: "#ef5b5b", bg: "rgba(239,91,91,0.14)" },
  questionable: { fg: "#e8b13a", bg: "rgba(232,177,58,0.16)" },
  active: { fg: "#3ecf8e", bg: "rgba(62,207,142,0.14)" },
};

export default function InjuriesDesktop({
  query = "",
  onSetQuery,
  sampleQuery = null,
  leagues = [],
  league,
  onSetLeague,
  statuses = [],
  status,
  onSetStatus,
  sorts = [],
  sort,
  onSetSort,
  playingSoon = 0,
  rows = [],
  scopeLabel,
  coverageNote,
  loading = false,
  onOpenProp,
  kickoffLabelFor,
  renderAvatar,
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

  const group = (label, items, current, onPick) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <span style={railLabel}>{label}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it) => (
          <div
            key={it.id}
            role="button"
            tabIndex={0}
            onClick={() => onPick && onPick(it.id)}
            onKeyDown={(e) => { if (e.key === "Enter") onPick && onPick(it.id); }}
            style={{ ...railPill(current === it.id), justifyContent: "space-between", gap: 8 }}
          >
            <span>{it.label}</span>
            {/* The count is this filter's own, so a chip cannot promise rows
                the table does not have. */}
            {it.count != null && (
              <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{it.count}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

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
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)", gridTemplateColumns: "224px minmax(0, 1fr)" }}>
        {/* ---- rail ------------------------------------------------------ */}
        <div className="nsb" style={{ borderRight: "1px solid var(--line)", overflowY: "auto", padding: "18px 16px 26px", display: "flex", flexDirection: "column", gap: 20 }}>
          {onSetQuery && (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <span style={railLabel}>SEARCH</span>
              <input
                value={query}
                onChange={(e) => onSetQuery(e.target.value)}
                // A placeholder is not a label: it disappears on the first
                // keystroke and screen readers may not announce it at all.
                aria-label="Search the injury wire"
                placeholder={sampleQuery ? `e.g. ${sampleQuery}` : "Player or team"}
                style={{
                  minHeight: 34, padding: "0 11px", borderRadius: 7,
                  border: "1px solid var(--line)", background: "var(--surface-1)",
                  color: "var(--text)", fontFamily: MONO, fontSize: 12, width: "100%", boxSizing: "border-box",
                }}
              />
            </div>
          )}
          {group("LEAGUE", leagues, league, onSetLeague)}
          {group("STATUS", statuses, status, onSetStatus)}
          {group("SORT", sorts, sort, onSetSort)}

          {/* Which leagues publish a feed at all. A league with nobody here
              has nobody designated, not nobody checked — and the ones that
              publish nothing are named rather than shown as healthy. */}
          {coverageNote && (
            <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--dim)", borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              {coverageNote}
            </span>
          )}
        </div>

        {/* ---- the wire --------------------------------------------------- */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "baseline", gap: 14, padding: "14px 24px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)" }}>
              {`${rows.length} ${rows.length === 1 ? "player" : "players"}`}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>{scopeLabel}</span>
            {playingSoon > 0 && (
              <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "var(--amber-ink)" }}>
                {`${playingSoon} PLAYING IN THE NEXT 24 HOURS`}
              </span>
            )}
          </div>

          <div style={{ flex: "0 0 auto", display: "grid", gridTemplateColumns: ROW_COLS, alignItems: "center", columnGap: 14, padding: "10px 24px", background: "var(--surface-1)", borderBottom: "1px solid var(--line)", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", color: "var(--dim)" }}>
            <span />
            <span>PLAYER</span>
            <span>DETAIL</span>
            <span>PLAYING NEXT</span>
            <span style={{ textAlign: "right" }}>STATUS</span>
          </div>

          <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
            {loading && rows.length === 0 && (
              <div style={{ padding: "22px 24px", fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>Reading the wire…</div>
            )}
            {!loading && rows.length === 0 && (
              <div style={{ padding: "22px 24px", fontSize: 13, lineHeight: 1.6, color: "var(--dim)", maxWidth: 560 }}>
                Nothing matches those filters. Widen the status to see the rest of the wire.
              </div>
            )}

            {rows.map((p) => {
              const tone = STATUS_TONE[p.status];
              return (
                <div
                  key={p.id || `${p.name}${p.team}`}
                  role={onOpenProp ? "button" : undefined}
                  tabIndex={onOpenProp ? 0 : undefined}
                  onClick={onOpenProp ? () => onOpenProp(p) : undefined}
                  onKeyDown={onOpenProp ? (e) => { if (e.key === "Enter") onOpenProp(p); } : undefined}
                  style={{
                    display: "grid", gridTemplateColumns: ROW_COLS, alignItems: "center", columnGap: 14,
                    padding: "12px 24px", borderBottom: "1px solid #20242b",
                    cursor: onOpenProp ? "pointer" : "default",
                  }}
                >
                  <span style={{ position: "relative" }}>{renderAvatar ? renderAvatar(p, 34) : null}</span>

                  <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                    {p.team && <span role="img" style={crest(p.team, p.sport, 15)} />}
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", whiteSpace: "nowrap" }}>{p.team}</span>
                  </span>

                  <span style={{ fontSize: 12, color: "var(--dim)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.detail || ""}
                  </span>

                  {/* "No game on this slate" rather than a blank: not playing
                      and not scheduled are different answers. */}
                  <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", whiteSpace: "nowrap" }}>
                    {kickoffLabelFor ? kickoffLabelFor(p) : ""}
                  </span>

                  <span style={{ display: "flex", justifyContent: "flex-end" }}>
                    {tone ? (
                      <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 5, background: tone.bg, color: tone.fg, whiteSpace: "nowrap" }}>
                        {String(p.status).toUpperCase()}
                      </span>
                    ) : (
                      // Unknown draws nothing at all, never a grey chip and
                      // never a default to available.
                      <span style={{ fontFamily: MONO, fontSize: 9.5, color: "var(--dim)" }}>—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
