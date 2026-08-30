import React from "react";
import { crest } from "./FormPlot.jsx";

// A transcription of frame `2c` in `v3 Mocks/PropPalace Desktop v3.dc.html`.
//
// A 236px rail of SPLIT / SIDE / SORT and the near-certainty switch, beside a
// two-across grid of finding cards. Same props `FindingsMobile` takes, off the
// same `lib/findings.js` output — this is a layout, not a second ranking.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

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

export default function FindingsDesktop({
  // Frame 2c's rail draws SPLIT / SIDE / SORT and no league. This page is
  // per-sport -- buildFindings takes one -- so without a league control three
  // of the four are unreachable at this width. The mock never had to carry it
  // because its own findings were one sport; dropping a working control to
  // match that would strand the reader.
  sports = [],
  sport,
  onSetSport,
  splits = [],
  split,
  onSetSplit,
  sides = [],
  side,
  onSetSide,
  sorts = [],
  sort,
  onSetSort,
  hideStructural = false,
  onToggleStructural,
  structuralHeld = 0,
  findings = [],
  total = 0,
  hasMore = false,
  moreCount = 0,
  onShowMore,
  loading = false,
  emptyCopy = null,
  onOpenProp,
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

  const group = (label, items, current, onPick, cols) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <span style={railLabel}>{label}</span>
      <div style={cols === 1
        ? { display: "flex", flexDirection: "column", gap: 6 }
        : { display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 6 }}
      >
        {items.map((it) => {
          const id = typeof it === "string" ? it : it.id;
          const text = typeof it === "string" ? it : it.label;
          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              onClick={() => onPick && onPick(id)}
              onKeyDown={(e) => { if (e.key === "Enter") onPick && onPick(id); }}
              style={railPill(current === id)}
            >
              {text}
            </div>
          );
        })}
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
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)", gridTemplateColumns: "236px minmax(0, 1fr)" }}>
        {/* ---- rail ------------------------------------------------------ */}
        <div className="nsb" style={{ borderRight: "1px solid var(--line)", overflowY: "auto", padding: "18px 18px 26px", display: "flex", flexDirection: "column", gap: 20 }}>
          {sports.length > 1 && group("LEAGUE", sports, sport, onSetSport, 2)}
          {group("SPLIT", splits, split, onSetSplit, 1)}
          {group("SIDE", sides, side, onSetSide, 3)}
          {group("SORT", sorts, sort, onSetSort, 1)}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <div
              role="button"
              tabIndex={0}
              onClick={onToggleStructural}
              onKeyDown={(e) => { if (e.key === "Enter") onToggleStructural && onToggleStructural(); }}
              style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 34, cursor: "pointer" }}
            >
              <span style={{ width: 17, height: 17, borderRadius: 5, display: "block", flex: "0 0 auto", border: `1px solid ${hideStructural ? "var(--amber)" : "var(--line)"}`, background: hideStructural ? "var(--amber)" : "transparent" }} />
              <span style={{ fontSize: 12.5, color: "var(--text)" }}>Hide near-certainties</span>
            </div>
            {/* The count is what the switch is currently holding back, so
                turning it off has a stated size rather than being a leap. */}
            <span style={{ fontSize: 11.5, lineHeight: 1.4, color: "var(--dim)" }}>
              {hideStructural
                ? `${structuralHeld} held back — a line so low the log almost never misses it says little.`
                : "Near-certainties are in. A line the log almost never misses is a fact about the line, not the player."}
            </span>
          </div>
        </div>

        {/* ---- the cards -------------------------------------------------- */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "baseline", gap: 14, padding: "14px 24px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)" }}>
              {`${total} ${total === 1 ? "finding" : "findings"}`}
            </span>
            {/* Stated on screen: a thin sample is marked and still shown. It
                is not quietly dropped, and it is not silently trusted. */}
            <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: "var(--dim)" }}>
              A THIN SAMPLE IS MARKED, NEVER HIDDEN
            </span>
          </div>

          <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "18px 24px 28px" }}>
            {loading && findings.length === 0 && (
              <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>Reading the logs…</div>
            )}
            {!loading && findings.length === 0 && (
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--dim)", maxWidth: 560 }}>
                {emptyCopy || "Nothing on this slate clears a bar worth naming. That is an answer about tonight, not a broken screen."}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
              {findings.map((fd) => (
                <div
                  key={fd.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenProp && onOpenProp(fd)}
                  onKeyDown={(e) => { if (e.key === "Enter") onOpenProp && onOpenProp(fd); }}
                  style={{
                    border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)",
                    padding: "14px 15px", display: "flex", flexDirection: "column", gap: 11, cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", padding: "4px 9px", borderRadius: 5, flex: "0 0 auto",
                      background: fd.structural ? "rgba(139,152,171,0.14)" : "var(--amber-dim)",
                      color: fd.structural ? "var(--dim)" : "var(--amber-ink)",
                    }}>
                      {fd.kind}
                    </span>
                    {/* Amber, and it names the sample it is thin on. */}
                    {fd.thin && (
                      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", padding: "4px 8px", borderRadius: 5, background: "rgba(232,177,58,0.16)", color: "var(--status-questionable)" }}>
                        {`THIN · ${fd.n} G`}
                      </span>
                    )}
                    <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>{fd.split}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span style={{ position: "relative", flex: "0 0 auto" }}>
                      {renderAvatar ? renderAvatar(fd, 36) : null}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 auto" }}>
                      <span style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fd.name}</span>
                        {fd.team && <span role="img" style={crest(fd.team, fd.sport, 15)} />}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fd.prop}</span>
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "0 0 auto" }}>
                      <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: fd.rate >= 0.7 ? "var(--pos)" : "var(--text)" }}>
                        {`${Math.round(fd.rate * 100)}%`}
                      </span>
                      {/* Counted off the same array the rate is. */}
                      <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{`${fd.hits} of ${fd.n}`}</span>
                    </span>
                  </div>

                  <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)", textWrap: "pretty" }}>{fd.sentence}</span>
                </div>
              ))}
            </div>

            {hasMore && (
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 20 }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={onShowMore}
                  onKeyDown={(e) => { if (e.key === "Enter") onShowMore && onShowMore(); }}
                  style={{ minHeight: 38, display: "flex", alignItems: "center", padding: "0 20px", borderRadius: 8, border: "1px solid var(--amber)", color: "var(--amber-ink)", fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.08em", cursor: "pointer" }}
                >
                  {`SHOW ${moreCount} MORE`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
