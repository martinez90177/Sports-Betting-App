import React from "react";
import FormPlot from "./FormPlot.jsx";
import { probToAmericanOdds, formatOdds } from "../odds.js";

// A transcription of frame `1b` in `v3 Mocks/PropPalace Mobile v3.dc.html`.
//
// The rows, the filtering, the sorting and every number in them stay exactly
// where they are: this renders the list `PropFeedPage` already computes. What
// changes is the layout -- a stack of touch cards, each with the app's own
// form strip and a draggable line, and a REFINE bottom sheet -- in place of a
// ten-column table folded onto a phone.
//
// The mock's chip row draws five controls above the list and puts the rest
// behind REFINE. That split is the mock's, not the app's, and it is the same
// call Alex already made once on desktop (see docs/REDESIGN_PLAN.md, "The
// feed's Markets / Side / Games counted / Lines are above the table"): the
// things you move around with stay out, the set-and-forget half goes in.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const sectionLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };

function chip(sel, extra) {
  return Object.assign({
    minHeight: 40, display: "flex", alignItems: "center", padding: "0 14px",
    borderRadius: 8, fontFamily: MONO, fontSize: 12, whiteSpace: "nowrap", cursor: "pointer",
    flex: "0 0 auto",
    border: `1px solid ${sel ? "var(--amber)" : "var(--line)"}`,
    background: sel ? "var(--amber-dim)" : "var(--surface-1)",
    color: sel ? "var(--amber-ink)" : "var(--text)",
  }, extra || {});
}

function pill(sel) {
  return {
    minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "0 12px", borderRadius: 8, fontFamily: MONO, fontSize: 13,
    letterSpacing: "0.04em", cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${sel ? "var(--amber)" : "var(--line)"}`,
    background: sel ? "var(--amber-dim)" : "var(--surface-1)",
    color: sel ? "var(--amber-ink)" : "var(--text-2)",
  };
}

// The feed's own rate tinting, unchanged: above 65 green, below 45 red, both
// endpoints grey. An over at 60% is close enough to a coin flip after vig that
// green reads as an endorsement the number has not earned. Set by Alex
// 2026-08-21; `feedRateColor` is the one helper so desktop and phone cannot
// drift, and this reads it rather than restating the band.
export default function PropFeedMobile({
  sport,
  sports = [],
  onSetSport,
  rows,
  totalRows,
  loadedCount,
  onLoadMore,
  hasMore,
  marketLabel,
  onOpenMarkets,
  direction,
  onToggleDirection,
  sampleWindow,
  windows = [],
  onSetWindow,
  sortLabel,
  onCycleSort,
  refineCount = 0,
  minSample,
  minSampleOptions = [],
  onSetMinSample,
  hitFloor,
  hitFloorOptions = [],
  onSetHitFloor,
  advanced = [],
  onReset,
  rateColor,
  rowsEmptyNote = null,
  loading = false,
  expandedKey,
  onToggleExpanded,
  hitsIn,
  onOpenProp,
  onTogglePick,
  isAdded,
}) {
  const [refineOpen, setRefineOpen] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const closeRefine = () => setRefineOpen(false);

  const controlBar = (
    <div
      style={{
        position: "sticky", top: 0, zIndex: 20, background: "var(--bg)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div className="nsb" style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto" }}>
        <div onClick={() => setRefineOpen(true)} style={chip(true)}>{String(sport).toUpperCase()} ▾</div>
        <div onClick={onOpenMarkets} style={chip(false)}>{marketLabel} ▾</div>
        <div onClick={onToggleDirection} style={chip(true)}>{direction === "under" ? "Under" : "Over"} ▾</div>
        <div onClick={() => setRefineOpen(true)} style={chip(false)}>
          {(windows.find((w) => w.id === sampleWindow) || {}).label || "L10"} ▾
        </div>
        <div onClick={() => setRefineOpen(true)} style={chip(false, { gap: 7, color: "var(--text-2)" })}>
          REFINE
          {refineCount > 0 && (
            <span style={{ background: "var(--amber)", color: "#fff", borderRadius: 999, fontSize: 10, padding: "2px 6px" }}>
              {refineCount}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px 10px" }}>
        <span
          onClick={onCycleSort}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCycleSort && onCycleSort(); } }}
          style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.06em", color: "var(--amber-ink)", cursor: "pointer" }}
        >
          Sort: {sortLabel} ↓
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>
          {`${loadedCount.toLocaleString()} of ${totalRows.toLocaleString()}`}
        </span>
      </div>
    </div>
  );

  const refineSheet = refineOpen && (
    <>
      <div onClick={closeRefine} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(5,6,8,0.72)" }} />
      <div
        className="nsb"
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 41, background: "var(--surface-1)",
          borderTop: "1px solid var(--line)", borderRadius: "20px 20px 0 0", padding: "12px 18px 26px",
          display: "flex", flexDirection: "column", gap: 18, boxShadow: "0 -14px 34px rgba(0,0,0,0.6)",
          maxHeight: "88%", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span style={{ width: 40, height: 4, borderRadius: 999, background: "var(--line)", display: "block" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 20 }}>Refine</span>
          <span
            onClick={closeRefine}
            style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", fontSize: 20, cursor: "pointer" }}
          >
            ×
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={sectionLabel}>LEAGUE</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {sports.map((s) => (
              <div key={s} onClick={() => { onSetSport(s); closeRefine(); }} style={pill(s === sport)}>
                {String(s).toUpperCase()}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={sectionLabel}>WINDOW</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {windows.map((w) => (
              <div key={w.id} onClick={() => onSetWindow(w.id)} style={pill(w.id === sampleWindow)}>{w.label}</div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={sectionLabel}>MINIMUM SAMPLE</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--amber-ink)" }}>
              {minSample === 0 ? "Any" : `${minSample}+ games`}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {minSampleOptions.map((o) => (
              <div key={o.id} onClick={() => onSetMinSample(o.value)} style={pill(o.value === minSample)}>{o.label}</div>
            ))}
          </div>
          {/* The mock's own sentence. It is also the app's rule: the minimum
              sample is a display threshold, never a filter -- a row under it
              keeps its place and shows no rate. */}
          <span style={{ fontSize: 12, color: "var(--dim)" }}>Below this, props show without a rate.</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={sectionLabel}>HIT RATE AT LEAST</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--amber-ink)" }}>
              {hitFloor == null ? "Any" : `${Math.round(hitFloor * 100)}%`}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {hitFloorOptions.map((h) => (
              // Tapping the active one clears it. The mock offers four floors
              // and no way back off them; without this the reader can narrow
              // the feed and never widen it again.
              <div
                key={h}
                onClick={() => onSetHitFloor(hitFloor === h / 100 ? null : h / 100)}
                style={pill(hitFloor === h / 100)}
              >
                {h}%
              </div>
            ))}
          </div>
        </div>

        <div
          onClick={() => setAdvancedOpen((v) => !v)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 48,
            borderTop: "1px solid var(--line)", paddingTop: 12, cursor: "pointer",
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.1em", color: "var(--text-2)" }}>
            {`ADVANCED · ${advanced.length} MORE`}
          </span>
          <span
            style={{
              color: "var(--dim)", fontSize: 20,
              transform: advancedOpen ? "rotate(90deg)" : "none", transition: "transform 140ms",
            }}
          >
            ›
          </span>
        </div>
        {advancedOpen && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {advanced.map((a) => (
              // The mock draws these inert, because a static file has nowhere
              // to route them. Each one is a control the app already has, so
              // each opens the panel that owns it rather than being a chip
              // that does nothing.
              <div
                key={a.id}
                onClick={a.onOpen}
                style={{
                  minHeight: 40, display: "flex", alignItems: "center", padding: "0 13px", borderRadius: 8,
                  border: `1px solid ${a.active ? "var(--amber)" : "var(--line)"}`,
                  background: "var(--surface-2)",
                  color: a.active ? "var(--amber-ink)" : "var(--text-2)",
                  fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em",
                  cursor: a.onOpen ? "pointer" : "default",
                }}
              >
                {a.label} ▾
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <div
            onClick={() => { onReset && onReset(); closeRefine(); }}
            style={{
              flex: "0 0 auto", minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 20px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)",
              color: "var(--text-2)", fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", cursor: "pointer",
            }}
          >
            RESET
          </div>
          <div
            onClick={closeRefine}
            style={{
              flex: "1 1 auto", minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 12, border: "1px solid var(--amber)", background: "var(--amber)", color: "#ffffff",
              fontFamily: MONO, fontSize: 13, letterSpacing: "0.08em", cursor: "pointer",
            }}
          >
            {/* The count it will actually show, not a flat "SHOW PROPS". */}
            {totalRows === 0 ? "NO PROPS MATCH" : `SHOW ${totalRows.toLocaleString()} PROP${totalRows === 1 ? "" : "S"}`}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {controlBar}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {loading && rows.length === 0 && (
          <div style={{ padding: "24px 16px", fontFamily: MONO, fontSize: 11.5, color: "var(--dim)" }}>Loading the slate…</div>
        )}
        {!loading && rows.length === 0 && rowsEmptyNote && (
          <div style={{ padding: "24px 16px", fontSize: 13, lineHeight: 1.6, color: "var(--dim)" }}>{rowsEmptyNote}</div>
        )}
        {rows.map((r) => (
          <FeedCard
            key={r.key}
            r={r}
            sport={sport}
            sampleWindow={sampleWindow}
            open={expandedKey === r.key}
            onToggle={() => onToggleExpanded(r.key)}
            rateColor={rateColor}
            onOpenProp={onOpenProp}
            onTogglePick={onTogglePick}
            added={isAdded(r)}
            hitsIn={hitsIn}
          />
        ))}
        {hasMore && (
          <div
            onClick={onLoadMore}
            style={{
              margin: "14px 16px", minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)",
              color: "var(--amber-ink)", fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", cursor: "pointer",
            }}
          >
            {`LOAD MORE · ${loadedCount.toLocaleString()} OF ${totalRows.toLocaleString()}`}
          </div>
        )}
        {/* The mock's own tail spacer, so the last row clears the dock. */}
        <div style={{ height: 90 }} />
      </div>
      {refineSheet}
    </>
  );
}

// One row. The mock draws the identity line, the form strip and the run
// caption always, and two cells plus two actions once it is opened.
function FeedCard({ r, sport, sampleWindow, open, onToggle, rateColor, onOpenProp, onTogglePick, added, hitsIn }) {
  const rate = r[sampleWindow];
  const nKey = sampleWindow === "l5" ? "n5" : sampleWindow === "l20" ? "n20" : sampleWindow === "all" ? "nAll" : "n10";
  const n = r[nKey];
  const games = r.recent || [];
  const [line, setLine] = React.useState(null);
  React.useEffect(() => { setLine(null); }, [r.key, r.line]);
  const liveLine = line == null ? r.line : line;

  // Every figure on the card is counted off `recent` against `liveLine`, so a
  // dragged line moves the caption with it rather than leaving a rate that
  // describes the posted number.
  const hit = (v) => (r.direction === "under" ? v < liveLine : v > liveLine);
  const dragged = line != null && line !== r.line;
  const liveHits = games.filter((g) => hit(g.v)).length;
  const shownRate = dragged ? (games.length ? liveHits / games.length : null) : rate;
  const shownN = dragged ? games.length : n;
  // The hit count behind the percentage, counted rather than recovered from
  // it. `hitsIn` is the page's own windowValues + feedIsHit pair, so this and
  // the rate above are the same two numbers the desktop cells print.
  const windowHits = dragged ? liveHits : hitsIn(r, sampleWindow, r.line);
  const straight = (() => {
    let run = 0;
    for (let i = games.length - 1; i >= 0; i--) { if (hit(games[i].v)) run++; else break; }
    return run;
  })();

  return (
    <div style={{ borderBottom: "1px solid #20242b" }}>
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", minHeight: 44, cursor: "pointer" }}
      >
        <div style={{ position: "relative", flex: "0 0 auto" }}>{r.avatarNode}</div>
        <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.name}
          </span>
          <span
            style={{
              fontFamily: MONO, fontSize: 11, color: "var(--text-2)", letterSpacing: "0.03em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {`${r.direction === "under" ? "UNDER" : "OVER"} ${liveLine} ${String(r.marketLabel || "").toUpperCase()}`}
          </span>
        </div>
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, width: 62 }}>
          {/* A thin sample prints `too few`, not a percentage -- the number
              would be a claim the sample cannot carry. */}
          <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: shownRate == null ? "var(--dim)" : rateColor(shownRate) }}>
            {shownRate == null ? "too few" : `${Math.round(shownRate * 100)}%`}
          </span>
          {/* `TEAM · hits/games`, as the mock writes it. Counts first, and the
              two numbers the percentage above is the ratio of -- not
              games-available-of-games-asked-for. Both come off the row's own
              values array through the app's own predicate, so the caption and
              the percentage cannot be authored separately. */}
          <span style={{ fontFamily: MONO, fontSize: 10, color: "#5c6b7a", whiteSpace: "nowrap" }}>
            {shownRate == null ? `${r.team} · ${shownN}` : `${r.team} · ${windowHits}/${shownN}`}
          </span>
        </div>
      </div>

      <div style={{ padding: "0 14px 10px" }}>
        {games.length > 0 ? (
          <FormPlot
            size="feed"
            games={games}
            sport={sport}
            line={liveLine}
            marketLine={r.line}
            isBinary={r.isBinary}
            direction={r.direction}
            onDragLine={(v) => setLine(v)}
          />
        ) : (
          <div style={{ height: 74, display: "flex", alignItems: "center", fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>
            No finished games on this log yet.
          </div>
        )}
      </div>
      <div style={{ padding: "0 14px 12px" }}>
        <span
          style={{
            fontFamily: MONO, fontSize: 11,
            color: games.length && liveHits / games.length >= 0.6 ? "var(--pos)" : "var(--status-questionable)",
          }}
        >
          {games.length ? `${liveHits} of ${games.length} · ${straight} straight` : "no sample"}
        </span>
      </div>

      {open && (
        <div style={{ background: "var(--surface-sunken)", borderTop: "1px solid #20242b", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={sectionLabel}>DRAG THE TAB TO MOVE THE LINE</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)" }}>
              {dragged ? `line ${liveLine} · market ${r.line}` : `line ${liveLine}`}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-1)", padding: "11px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)" }}>MATCHUP</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {r.rank != null ? `#${r.rank}${r.rankLabel ? ` · ${r.rankLabel}` : ""}` : "Not ranked"}
              </span>
            </div>
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-1)", padding: "11px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)" }}>IMPLIED</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: MONO }}>
                {shownRate == null ? "—" : formatOdds(probToAmericanOdds(shownRate))}
              </span>
            </div>
          </div>
          {/* No book prices anything -- there is no odds feed. The cell above
              is this app's own rate converted, and this line says so. */}
          <span style={{ fontFamily: MONO, fontSize: 10, lineHeight: 1.6, color: "var(--dim)" }}>
            Implied from this window's rate. No book priced this.
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <div
              onClick={() => onOpenProp(sport, r.playerId, r.marketId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenProp(sport, r.playerId, r.marketId); } }}
              style={{
                flex: "1 1 0", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-1)",
                color: "var(--text)", fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", cursor: "pointer",
              }}
            >
              PLAYER PAGE →
            </div>
            <div
              onClick={() => onTogglePick(r, liveLine)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTogglePick(r, liveLine); } }}
              style={{
                flex: "1 1 0", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 10, border: "1px solid var(--amber)", background: "var(--amber-dim)",
                color: "var(--amber-ink)", fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", cursor: "pointer",
              }}
            >
              {added ? "✓ ON THE SLIP" : "+ MY PICKS"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
