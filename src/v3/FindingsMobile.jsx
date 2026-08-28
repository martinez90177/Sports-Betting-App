import React from "react";
import { crest } from "./FormPlot.jsx";

// A transcription of frame `2b` in `v3 Mocks/PropPalace Mobile v3.dc.html`.
//
// The findings themselves, their splits, their sides, their sorts and the
// structural switch are all `lib/findings.js` and `FindingsPage`'s own state.
// This is the phone's layout for them: the rail becomes three scrolling chip
// rows over the list rather than a disclosure that pushes the list below the
// fold.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

// The mock's own two chip shapes: a wider one for the split row, a compact one
// for the two labelled rows under it.
function barChip(sel) {
  return {
    minHeight: 40, display: "flex", alignItems: "center", padding: "0 14px",
    borderRadius: 8, fontFamily: MONO, fontSize: 12, whiteSpace: "nowrap",
    cursor: "pointer", flex: "0 0 auto",
    border: `1px solid ${sel ? "var(--amber)" : "var(--line)"}`,
    background: sel ? "var(--amber-dim)" : "var(--surface-1)",
    color: sel ? "var(--amber-ink)" : "var(--text)",
  };
}

function segChip(sel) {
  return {
    minHeight: 34, display: "flex", alignItems: "center", padding: "0 10px",
    borderRadius: 7, fontFamily: MONO, fontSize: 11, whiteSpace: "nowrap",
    cursor: "pointer", flex: "0 0 auto",
    border: `1px solid ${sel ? "var(--amber)" : "var(--line)"}`,
    background: sel ? "var(--amber-dim)" : "var(--surface-1)",
    color: sel ? "var(--amber-ink)" : "var(--text-2)",
  };
}

const rowLabel = { flex: "0 0 auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)" };

// What kind of finding this is, beside the split it was counted over. Both are
// on the card because they answer different questions -- "a run" versus "over
// the season", "a home split" versus "home only".
const KIND_WORD = { streak: "RUN", home: "SPLIT", away: "SPLIT", h2h: "H2H" };

export default function FindingsMobile({
  splits = [],
  split,
  onSetSplit,
  sides = [],
  side,
  onSetSide,
  sorts = [],
  sort,
  onSetSort,
  hideStructural,
  onToggleStructural,
  structuralHeld = 0,
  findings = [],
  total = 0,
  hasMore = false,
  onShowMore,
  moreCount = 0,
  loading = false,
  onOpenProp,
  renderAvatar,
}) {
  return (
    <>
      <div
        style={{
          position: "sticky", top: 0, zIndex: 20, background: "var(--bg)",
          borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column",
          gap: 10, padding: "10px 0 12px",
        }}
      >
        {/* No league row. The mock's sticky bar is split / side / sort /
            structural and nothing else, and the league on this screen is the
            Board's own (`boardSport` feeds both), so it is changed there. */}
        <div className="nsb" style={{ display: "flex", gap: 8, padding: "0 16px", overflowX: "auto" }}>
          {splits.map((k) => (
            <div key={k} onClick={() => onSetSplit(k)} style={barChip(k === split)}>{k}</div>
          ))}
        </div>
        <div className="nsb" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", overflowX: "auto" }}>
          <span style={rowLabel}>SIDE</span>
          {sides.map((k) => (
            <div key={k} onClick={() => onSetSide(k)} style={segChip(k === side)}>{k}</div>
          ))}
        </div>
        <div className="nsb" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", overflowX: "auto" }}>
          <span style={rowLabel}>SORT</span>
          {sorts.map((k) => (
            <div key={k.id} onClick={() => onSetSort(k.id)} style={segChip(k.id === sort)}>{k.label}</div>
          ))}
        </div>
        <div
          onClick={onToggleStructural}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleStructural(); } }}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px", minHeight: 34, cursor: "pointer" }}
        >
          <span
            style={{
              width: 17, height: 17, borderRadius: 5, display: "block", flex: "0 0 auto",
              border: `1px solid ${hideStructural ? "var(--amber)" : "var(--line)"}`,
              background: hideStructural ? "var(--amber)" : "transparent",
            }}
          />
          <span style={{ fontSize: 12.5, color: "var(--text)" }}>Hide structural near-certainties</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "0 16px" }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)" }}>
            {`${total} ${total === 1 ? "finding" : "findings"}`}
          </span>
          {/* Says how many it is holding back and why. Withholding true
              statements silently is the same failure as dropping a game. */}
          <span
            style={{
              fontFamily: MONO, fontSize: 10.5,
              color: hideStructural && structuralHeld ? "var(--status-questionable)" : "var(--dim)",
            }}
          >
            {hideStructural ? `${structuralHeld} near-certainties held back` : "showing near-certainties"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px 30px" }}>
        {loading && <div style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--dim)" }}>Loading the slate…</div>}
        {!loading && findings.length === 0 && (
          <div style={{ border: "1px dashed var(--line)", borderRadius: 12, padding: "20px 16px", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.7, color: "var(--dim)" }}>
            Nothing on this slate clears the bar for a finding — a run of five, or a split of five games at eight in ten. That is an answer, not an empty screen: no split on tonight's games is saying anything a rate could not.
          </div>
        )}

        {findings.map((fd) => (
          <div
            key={fd.key}
            onClick={() => onOpenProp(fd.sport, fd.playerId, fd.marketId)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenProp(fd.sport, fd.playerId, fd.marketId); } }}
            style={{
              border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)",
              padding: 14, display: "flex", flexDirection: "column", gap: 11, cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", padding: "4px 9px",
                  borderRadius: 5, flex: "0 0 auto",
                  background: fd.structural ? "rgba(139,152,171,0.14)" : "var(--amber-dim)",
                  color: fd.structural ? "var(--dim)" : "var(--amber-ink)",
                }}
              >
                {KIND_WORD[fd.id] || "SPLIT"}
              </span>
              {/* A sample under the support floor is marked, never hidden. */}
              {fd.thin && (
                <span
                  style={{
                    fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", padding: "4px 8px",
                    borderRadius: 5, background: "rgba(232,177,58,0.16)",
                    color: "var(--status-questionable)", flex: "0 0 auto",
                  }}
                >
                  {`THIN · ${fd.n} G`}
                </span>
              )}
              <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", whiteSpace: "nowrap" }}>
                {fd.split}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
              <span style={{ position: "relative", flex: "0 0 auto" }}>{renderAvatar(fd, 36)}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {fd.name}
                  </span>
                  <span role="img" style={crest(fd.team, fd.sport, 15)} />
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {fd.prop}
                </span>
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "0 0 auto" }}>
                <span
                  style={{
                    fontFamily: MONO, fontSize: 17, fontWeight: 700,
                    color: fd.rate >= 0.7 ? "var(--pos)" : fd.rate >= 0.6 ? "var(--status-questionable)" : "var(--text-2)",
                  }}
                >
                  {`${Math.round(fd.rate * 100)}%`}
                </span>
                {/* Counts first, and both off the same array the sentence
                    below is written from. */}
                <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{`${fd.hits} of ${fd.n}`}</span>
              </span>
            </div>

            <span style={{ fontSize: 13, lineHeight: 1.45, color: "var(--text-2)", textWrap: "pretty" }}>{fd.sentence}</span>
          </div>
        ))}

        {hasMore && (
          <div
            onClick={onShowMore}
            style={{
              minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)",
              color: "var(--amber-ink)", fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", cursor: "pointer",
            }}
          >
            {`SHOW ${moreCount} MORE`}
          </div>
        )}
      </div>
    </>
  );
}
