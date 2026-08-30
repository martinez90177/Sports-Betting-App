import React from "react";
import FormPlot, { PLOT, crest } from "./FormPlot.jsx";
import { probToAmericanOdds, formatOdds } from "../odds.js";
import { STATUS } from "../lib/teamColors.js";

// A transcription of frame `1a` in `v3 Mocks/PropPalace Desktop v3.dc.html`,
// the largest frame in the bundle.
//
// It takes the same contract PlayerDetailV2 does, so the four sport pages feed
// it unchanged and the swap is one line in PlayerDetail.jsx.
//
// ---- The grid contract, `desktop-handoff.md` §1 ----
//
// Four rules, each of which the handoff says caused a real defect, and each
// load-bearing here:
//
//   1. `grid-template-rows: minmax(0, 1fr)` on the body. Without it the row is
//      sized by its tallest child's min-content height, the frame overflows and
//      no inner scroller ever engages.
//   2. A scrolling column needs `min-height: 0; overflow: hidden` and children
//      at `flex: 0 0 auto`. A column-flex scroller whose children can shrink
//      compresses them instead of scrolling -- and any child with its own
//      `overflow: hidden` then silently clips. This is what cut the fourth
//      reason off the Board's hero card.
//   3. A collapsed rail loses its *track*, not its width. `0px` leaves the
//      next column in the wrong place, so the template is built from the
//      columns that actually exist.
//   4. `position: relative` on the frame, so the bar-detail card resolves
//      against it rather than against the document.
//
// ---- Rails, §2 ----
//
// Left is what filters the page, right is what contextualises it, centre is
// the thing itself and the only column that scrolls independently. Nothing in
// a rail is behind an accordion -- the width is the whole point.
//
// Shape carries meaning: rounded rectangles (6-8px) for anything clickable,
// full pills (999px) only for read-only labels. A control drawn as a pill
// reads as a badge.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const railLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };
const cellLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)" };
const railNote = { fontSize: 11.5, color: "var(--dim)", lineHeight: 1.4 };

// Rounded rectangle: clickable. Never a pill.
function option(on) {
  return {
    minHeight: 34, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "0 10px", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap",
    fontFamily: MONO, fontSize: 11.5,
    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
    background: on ? "var(--amber-dim)" : "var(--surface-1)",
    color: on ? "var(--amber-ink)" : "var(--text-2)",
  };
}

function marketRow(on) {
  return { ...option(on), justifyContent: "flex-start", minHeight: 32, fontSize: 12.5, fontFamily: "inherit" };
}

// Read-only label: a full pill, and only ever read-only.
const pill = (fg, bg) => ({
  fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", padding: "3px 8px",
  borderRadius: 999, flex: "0 0 auto", background: bg, color: fg, whiteSpace: "nowrap",
});

export default function PlayerDetailDesktop({
  sport,
  player,
  markets = [],
  marketLabel,
  verdict,
  chart,
  context,
  conditions,
  log,
  band,
  ownRail,
  oppRail,
  onBack,
  onWatch,
  watching,
  watched = [],
  onOpenWatched,
  crumbFixture,
  crumbSelect,
  footerNote,
  onAddPick,
  pickAdded,
  extraBlocks,
  // v3 additions, the same ones the phone frame takes.
  seasons = null,
  windows = null,
  splits = null,
  injuryTeams = null,
  lineups = null,
  renderAvatar = null,
  availability = null,
  slipCount = null,
  onOpenSlip = null,
  // The frame draws the app's nav inside itself, above the crumb bar -- unlike
  // the v2 mock, which opened on the breadcrumb alone. Optional: without a
  // handler the row simply is not drawn, rather than drawing tabs that go
  // nowhere.
  navTabs = null,
  onNavigate = null,
  onHome = null,
  onOpenSettings = null,
  // The alt-line ladder. Rungs are counted over the same games, never
  // interpolated, and a rung the sample never split shows no price.
  ladder = null,
  // Minimum-sample and workload controls, where the sport has them.
  samples = null,
  workload = null,
}) {
  const games = (chart && chart.games) || [];
  const line = chart ? chart.line : null;

  // A slice of the already-windowed, already-filtered series -- so the zoom
  // composes with every other control rather than replacing them (§3).
  const [zoom, setZoom] = React.useState(null);
  React.useEffect(() => { setZoom(null); }, [chart && chart.games && chart.games.length, marketLabel]);
  const shown = zoom ? games.slice(zoom[0], zoom[1] + 1) : games;

  const [picked, setPicked] = React.useState(null);

  // Escape clears the zoom; the arrows step the line one rung (§3).
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { if (picked != null) setPicked(null); else setZoom(null); return; }
      if (!chart || !chart.onDragLine || line == null) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); chart.onDragLine(Math.max(0, line - 0.5)); }
      if (e.key === "ArrowRight") { e.preventDefault(); chart.onDragLine(line + 0.5); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chart, line, picked]);

  const hitOf = React.useCallback(
    (v) => (chart && chart.direction === "under" ? v < line : v > line),
    [chart, line]
  );
  const hits = shown.filter((g) => hitOf(g.v)).length;

  const st = availability ? STATUS[availability] : null;

  // ---- nav row ------------------------------------------------------------
  const nav = navTabs && navTabs.length > 0 && (
    <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 32, padding: "16px 32px", borderBottom: "1px solid var(--line)" }}>
      <span
        role={onHome ? "button" : undefined}
        tabIndex={onHome ? 0 : undefined}
        onClick={onHome || undefined}
        onKeyDown={onHome ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onHome(); } } : undefined}
        style={{ display: "flex", alignItems: "center", gap: 10, cursor: onHome ? "pointer" : "default" }}
      >
        <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>Prop Palace</span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 26 }}>
        {navTabs.map((t) => (
          <span
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => onNavigate && onNavigate(t.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate && onNavigate(t.id); } }}
            style={{
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--dim)", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </span>
        ))}
      </span>
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onOpenSettings || undefined}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenSettings && onOpenSettings(); } }}
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--dim)", fontSize: 15, cursor: "pointer" }}
        >
          ⚙
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: "var(--amber-ink)", border: "1px solid var(--amber)", borderRadius: 7, padding: "5px 12px" }}>21+</span>
      </span>
    </div>
  );

  // ---- crumb bar ----------------------------------------------------------
  const crumb = (
    <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", padding: "12px 32px", borderBottom: "1px solid var(--line)" }}>
      <span style={{ flex: "1 1 0", display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onBack}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack && onBack(); } }}
          style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--amber-ink)", whiteSpace: "nowrap", cursor: "pointer" }}
        >
          ← PROP FEED
        </span>
        <span style={{ width: 1, height: 18, background: "var(--line)", display: "block", flex: "0 0 auto" }} />
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)", whiteSpace: "nowrap" }}>WATCHING</span>
        <span className="nsb" style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", minWidth: 0 }}>
          {watched.map((w) => (
            <div
              key={w.key || `${w.sport}:${w.playerId}:${w.marketId}`}
              role="button"
              tabIndex={0}
              onClick={() => onOpenWatched && onOpenWatched(w)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenWatched && onOpenWatched(w); } }}
              style={{
                display: "flex", alignItems: "center", gap: 7, flex: "0 0 auto", cursor: "pointer",
                padding: "5px 10px", borderRadius: 7, border: "1px solid var(--line)", background: "var(--surface-1)",
                fontFamily: MONO, fontSize: 11, color: "var(--text-2)",
              }}
            >
              <span role="img" style={crest(w.team, w.sport, 13)} />
              <span style={{ whiteSpace: "nowrap" }}>{w.label || w.name}</span>
              {w.prop && <span style={{ color: "var(--dim)", whiteSpace: "nowrap" }}>{w.prop}</span>}
            </div>
          ))}
          {/* Rule 4: an empty watch list says it is empty. */}
          {watched.length === 0 && (
            <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)", whiteSpace: "nowrap" }}>
              Nothing watched yet.
            </span>
          )}
        </span>
      </span>
      <span style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end" }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onWatch}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWatch && onWatch(); } }}
          style={{
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", padding: "7px 13px", borderRadius: 7,
            cursor: "pointer", whiteSpace: "nowrap",
            border: `1px solid ${watching ? "var(--amber)" : "var(--line)"}`,
            background: watching ? "var(--amber-dim)" : "var(--surface-1)",
            color: watching ? "var(--amber-ink)" : "var(--text-2)",
          }}
        >
          {watching ? "✓ WATCHING" : "+ WATCH"}
        </span>
      </span>
    </div>
  );

  // ---- left rail: what filters the page -----------------------------------
  const leftRail = (
    <div className="nsb" style={{ borderRight: "1px solid var(--line)", overflowY: "auto", minHeight: 0, padding: "20px 18px 28px", display: "flex", flexDirection: "column", gap: 22 }}>
      {markets.length > 0 && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9 }}>
          <span style={railLabel}>MARKET</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {markets.map((m) => (
              <div
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={m.onPick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); m.onPick(); } }}
                style={marketRow(m.active)}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {seasons && seasons.length > 0 && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9 }}>
          <span style={railLabel}>SEASON</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {seasons.map((s) => (
              <div key={s.id} role="button" tabIndex={0} onClick={s.onPick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); s.onPick(); } }}
                style={option(s.active)}>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {windows && windows.options && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9 }}>
          <span style={railLabel}>WINDOW</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {windows.options.filter((w) => w.id !== "h2h").map((w) => (
              <div key={w.id} role="button" tabIndex={0} onClick={w.onPick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); w.onPick(); } }}
                style={option(w.active)}>
                {w.label}
              </div>
            ))}
          </div>
          {/* The frame gives H2H its own full-width row under the grid. */}
          {windows.options.filter((w) => w.id === "h2h").map((w) => (
            <div key={w.id} role="button" tabIndex={0} onClick={w.onPick}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); w.onPick(); } }}
              style={option(w.active)}>
              {w.label}
            </div>
          ))}
          {windows.custom && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)" }}>YOUR OWN</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div role="button" tabIndex={0} onClick={windows.custom.onDown}
                  onKeyDown={(e) => { if (e.key === "Enter") windows.custom.onDown(); }}
                  style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text-2)", cursor: "pointer" }}>−</div>
                <span style={{ flex: "1 1 auto", textAlign: "center", fontFamily: MONO, fontSize: 14, fontWeight: 700 }}>
                  {`L${windows.custom.value}`}
                </span>
                <div role="button" tabIndex={0} onClick={windows.custom.onUp}
                  onKeyDown={(e) => { if (e.key === "Enter") windows.custom.onUp(); }}
                  style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text-2)", cursor: "pointer" }}>+</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {/* Apply uses it now, Save keeps it on the rail -- two controls
                    because they are two different intentions. */}
                <div role="button" tabIndex={0} onClick={windows.custom.onApply || windows.custom.onSave}
                  onKeyDown={(e) => { if (e.key === "Enter") (windows.custom.onApply || windows.custom.onSave)(); }}
                  style={{ flex: "1 1 0", height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--amber)", borderRadius: 6, background: "var(--amber)", color: "var(--accent-on)", fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", cursor: "pointer" }}>
                  APPLY
                </div>
                <div role="button" tabIndex={0} onClick={windows.custom.onSave}
                  onKeyDown={(e) => { if (e.key === "Enter") windows.custom.onSave(); }}
                  style={{ flex: "1 1 0", height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--amber)", borderRadius: 6, background: "var(--amber-dim)", color: "var(--amber-ink)", fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", cursor: "pointer" }}>
                  SAVE
                </div>
              </div>
              <span style={railNote}>Apply uses it now. Save keeps it on the rail.</span>
            </div>
          )}
        </div>
      )}

      {workload && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 11, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <span style={railLabel}>{workload.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "var(--amber-ink)" }}>{workload.value}</span>
          </div>
          {workload.control}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {workload.onToggleMode && (
              <div role="button" tabIndex={0} onClick={workload.onToggleMode}
                onKeyDown={(e) => { if (e.key === "Enter") workload.onToggleMode(); }}
                style={{ ...option(!!workload.rangeMode), minHeight: 28, fontSize: 10.5 }}>
                {workload.modeLabel}
              </div>
            )}
            {workload.onReset && (
              <div role="button" tabIndex={0} onClick={workload.onReset}
                onKeyDown={(e) => { if (e.key === "Enter") workload.onReset(); }}
                style={{ ...option(false), minHeight: 28, fontSize: 10.5 }}>
                ANY
              </div>
            )}
            {workload.games && (
              <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{workload.games}</span>
            )}
          </div>
        </div>
      )}

      {splits && splits.length > 0 && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9 }}>
          <span style={railLabel}>SPLITS</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {splits.map((s) => (
              <div
                key={s.id}
                role="radio"
                aria-checked={!!s.active}
                tabIndex={0}
                onClick={s.onPick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); s.onPick(); } }}
                style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 34, cursor: "pointer" }}
              >
                {/* Exclusive, one at a time: two splits at once would recompute
                    over an intersection nobody asked for. */}
                <span
                  style={{
                    width: 15, height: 15, borderRadius: 4, flex: "0 0 auto", boxSizing: "border-box",
                    border: `1px solid ${s.active ? "var(--amber)" : "var(--line)"}`,
                    background: s.active ? "var(--amber)" : "transparent",
                  }}
                />
                <span style={{ fontSize: 13, color: "var(--text)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {samples && samples.length > 0 && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <span style={railLabel}>MINIMUM SAMPLE</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {samples.map((s) => (
              <div key={s.id} role="button" tabIndex={0} onClick={s.onPick}
                onKeyDown={(e) => { if (e.key === "Enter") s.onPick(); }}
                style={option(s.active)}>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ---- centre: the thing itself -------------------------------------------
  // Implied is the window's own rate as American odds, through the same
  // conversion odds.js uses -- never a book's number, because there is no
  // odds feed. Identical to the phone frame's cell, off the same array.
  const impliedText = shown.length ? formatOdds(probToAmericanOdds(hits / shown.length)) : "—";
  const rankParts = String((context && context.rank) || "").split(" of ");
  const three = [
    { key: "line", label: "LINE", value: verdict ? verdict.line : "—", sub: String(marketLabel || "").toUpperCase(), tone: null },
    { key: "implied", label: "IMPLIED", value: impliedText, sub: shown.length ? `FROM ${shown.length} GAMES` : "NO GAMES IN WINDOW", tone: null },
    {
      key: "matchup",
      label: "MATCHUP",
      value: rankParts[0] || "—",
      // Amber for any ranked tier: green and red mean cleared and missed
      // everywhere else on this page, so a rank must not borrow them.
      sub: rankParts[1] ? `OF ${rankParts[1]}${context && context.rankWord ? ` · ${String(context.rankWord).toUpperCase()}` : ""}` : "NOT RANKED",
      tone: rankParts[1] ? "var(--status-questionable)" : "var(--dim)",
    },
  ];

  const centre = (
    <div className="nsb" style={{ overflowY: "auto", minHeight: 0, padding: "26px 26px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
      {crumbSelect ? (
        <div style={{ flex: "0 0 auto", alignSelf: "center" }}>{crumbSelect}</div>
      ) : crumbFixture ? (
        <div style={{ flex: "0 0 auto", alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 9, padding: "7px 13px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-1)", fontFamily: MONO, fontSize: 12, color: "var(--text)" }}>
          {crumbFixture}
        </div>
      ) : null}

      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ position: "relative", flex: "0 0 auto" }}>
          {renderAvatar ? renderAvatar(player, 68) : null}
        </div>
        <div style={{ flex: "1 1 auto", minWidth: 330, display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 11, whiteSpace: "nowrap" }}>
            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 34, letterSpacing: "-0.015em" }}>{player && player.name}</span>
            {player && player.jersey && <span style={{ fontFamily: MONO, fontSize: 22, color: "var(--dim)" }}>{`#${player.jersey}`}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span role="img" style={crest(player && player.team, sport, 15)} />
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--dim)" }}>{player && player.meta}</span>
            {st && <span style={pill(st.dot, "color-mix(in srgb, currentColor 14%, transparent)")}>{st.label}</span>}
          </div>
          {player && player.pills && player.pills.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {player.pills.map((c) => (
                <span key={c.label} style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.06em", padding: "4px 9px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface-1)", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                  {`${c.label} ${c.value}`.toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginLeft: "auto", flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)" }}>
            {three.map((c, i) => (
              <div key={c.key} style={{ padding: "13px 18px", borderRight: i < 2 ? "1px solid var(--line)" : "none", display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={cellLabel}>{c.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: c.tone || "var(--text)" }}>{c.value}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{c.sub}</span>
              </div>
            ))}
          </div>
          {/* The frame's `perGame` row: the season's per-game snapshot, which
              is what `player.stats` already carries -- not the season *splits*,
              which are the six-cell strip under the graph. */}
          {player && player.stats && player.stats.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-2)", padding: "8px 18px" }}>
              {player.stats.slice(0, 4).map((g) => (
                <div key={g.label} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700 }}>{g.value}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "var(--dim)" }}>{g.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: "0 0 auto", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-2)", padding: "16px 18px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", color: "var(--dim)" }}>
            {`${String(marketLabel || "").toUpperCase()}`}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>{`${shown.length} GAMES`}</span>
          {zoom && (
            <span
              role="button"
              tabIndex={0}
              onClick={() => setZoom(null)}
              onKeyDown={(e) => { if (e.key === "Enter") setZoom(null); }}
              style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", padding: "4px 9px", borderRadius: 6, border: "1px solid var(--amber)", background: "var(--amber-dim)", color: "var(--amber-ink)", cursor: "pointer" }}
            >
              RESET ZOOM
            </span>
          )}
          <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>DRAG THE TAB TO MOVE THE LINE</span>
        </div>
        <div style={{ position: "relative", height: PLOT.desktop.plotH }}>
          <FormPlot
            size="desktop"
            games={shown}
            sport={sport}
            line={line}
            marketLine={chart && chart.marketLine}
            isBinary={chart && chart.isBinary}
            direction={(chart && chart.direction) || "over"}
            onDragLine={chart && chart.onDragLine}
            onPickBar={(i) => setPicked(i)}
            picked={picked}
            onZoom={(from, to) => setZoom(zoom ? [zoom[0] + from, zoom[0] + to] : [from, to])}
            tooltipFor={(i) => {
              const g = shown[i];
              if (!g) return "";
              return `${g.date} · ${g.home === false ? "@" : "vs"} ${g.opp} · ${g.v} · ${hitOf(g.v) ? "OVER" : "UNDER"}`;
            }}
          />
        </div>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: hits / (shown.length || 1) >= 0.6 ? "var(--pos)" : "var(--text-2)" }}>
          {`${hits} of ${shown.length}`}
        </span>
      </div>

      {/* The frame's six-cell strip. Every cell states its own sample, and
          a cell with too few games behind it says so rather than showing a
          percentage the sample cannot carry. */}
      {log && log.seasons && log.seasons.length > 0 && (
        <div style={{ flex: "0 0 auto", display: "grid", gridTemplateColumns: `repeat(${Math.min(6, log.seasons.length)}, 1fr)`, border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)" }}>
          {log.seasons.slice(0, 6).map((c, i) => (
            <div key={c.label} style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 3, borderRight: i < Math.min(6, log.seasons.length) - 1 ? "1px solid var(--line)" : "none" }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: "var(--dim)" }}>{c.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: c.tone || "var(--text)" }}>{c.value}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{c.sub}</span>
            </div>
          ))}
        </div>
      )}

      {ladder}
      {extraBlocks}

      {footerNote && <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 10.5, lineHeight: 1.7, color: "var(--dim)" }}>{footerNote}</span>}
    </div>
  );

  // ---- right rail: what contextualises it ---------------------------------
  const rails = [ownRail && { key: "own", rail: ownRail }, oppRail && { key: "opp", rail: oppRail }].filter(Boolean);
  const [rosterTeam, setRosterTeam] = React.useState("own");
  const activeRail = (rails.find((r) => r.key === rosterTeam) || rails[0] || {}).rail;

  const lineupGroup = (title, scope, cards, note) => (cards && cards.length > 0) && (
    <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={railLabel}>{title}</span>
        {scope && <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{scope}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {cards.map((c) => {
          const on = c.state === "WITH" || c.state === "W/O";
          const fill = c.state === "WITH" ? "var(--pos)" : c.state === "W/O" ? "var(--neg)" : null;
          return (
            <div
              key={c.key}
              role="button"
              tabIndex={0}
              onClick={c.onCycle}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.onCycle && c.onCycle(); } }}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7,
                cursor: "pointer", minHeight: 34,
                background: on ? fill : "var(--surface-1)",
                border: `1px solid ${on ? "transparent" : "var(--line)"}`,
              }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 999, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 9, background: on ? "rgba(0,0,0,0.28)" : "var(--surface-2)", color: on ? "#f4f7fb" : "var(--text-2)" }}>
                {c.initials}
              </span>
              <span style={{ flex: "1 1 auto", minWidth: 0, fontSize: 12.5, color: on ? "#f4f7fb" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.name}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", flex: "0 0 auto", color: on ? "#ffffff" : "var(--dim)" }}>{c.state}</span>
              <span style={{ fontFamily: MONO, fontSize: 9.5, flex: "0 0 auto", color: on ? "rgba(255,255,255,0.78)" : "var(--dim)" }}>{c.games}</span>
            </div>
          );
        })}
      </div>
      {note && <span style={railNote}>{note}</span>}
    </div>
  );

  const rightRail = (
    <div className="nsb" style={{ borderLeft: "1px solid var(--line)", overflowY: "auto", minHeight: 0, padding: "20px 18px 30px", display: "flex", flexDirection: "column", gap: 22 }}>
      {activeRail && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: "var(--dim)", whiteSpace: "nowrap" }}>SWITCH PLAYER</span>
            <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
              {rails.map((r) => (
                <div key={r.key} role="button" tabIndex={0} onClick={() => setRosterTeam(r.key)}
                  onKeyDown={(e) => { if (e.key === "Enter") setRosterTeam(r.key); }}
                  style={{ ...option(rosterTeam === r.key), minHeight: 26, fontSize: 10.5, padding: "0 8px" }}>
                  {r.rail.label}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {(activeRail.players || []).map((rp) => (
              <div
                key={rp.id}
                role="button"
                tabIndex={0}
                onClick={rp.onSelect}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); rp.onSelect && rp.onSelect(); } }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #20242b", cursor: "pointer" }}
              >
                <div style={{ position: "relative", flex: "0 0 auto" }}>{rp.avatar}</div>
                <span style={{ fontSize: 13, color: rp.active ? "var(--amber-ink)" : "var(--text)", flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {rp.name}
                </span>
                {rp.statusWord && <span style={pill(STATUS[rp.status] ? STATUS[rp.status].dot : "var(--dim)", "color-mix(in srgb, currentColor 14%, transparent)")}>{STATUS[rp.status] ? STATUS[rp.status].label : rp.statusWord}</span>}
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)", flex: "0 0 auto" }}>{rp.meta}</span>
              </div>
            ))}
          </div>
          {activeRail.legend && <span style={railNote}>{activeRail.legend}</span>}
        </div>
      )}

      {lineups && lineupGroup("TEAMMATES", lineups.teamLabel, lineups.mates, lineups.note)}
      {lineups && lineupGroup(`OPPOSING LINEUP${lineups.opps && lineups.opps.length ? ` · ${lineups.opps.length}` : ""}`, lineups.oppLabel, lineups.opps, null)}

      {conditions && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <span style={railLabel}>{String(conditions.label || "CONDITIONS").toUpperCase()}</span>
          {conditions.body}
        </div>
      )}

      {injuryTeams && injuryTeams.length > 0 && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 9, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <span style={railLabel}>INJURIES</span>
          {injuryTeams.map((t) => (
            <div key={t.abbr} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span role="img" style={crest(t.slug || t.abbr, t.sport || sport, 16)} />
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--text-2)" }}>{t.abbr}</span>
                <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
                  {`${t.players.length} ${t.players.length === 1 ? "PLAYER" : "PLAYERS"}`}
                </span>
              </div>
              {t.players.map((p) => (
                <div key={p.id || p.name} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 30 }}>
                  <span style={{ flex: "1 1 auto", minWidth: 0, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                  {STATUS[p.status] && (
                    <span style={pill(STATUS[p.status].dot, "color-mix(in srgb, currentColor 14%, transparent)")}>{STATUS[p.status].label}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Rule 3: a rail that is not there loses its track, rather than becoming a
  // zero-width column that puts the next one in the wrong place.
  const cols = [leftRail ? "236px" : null, "minmax(0, 1fr)", rightRail ? "268px" : null].filter(Boolean).join(" ");

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: 0, height: "100%", background: "var(--bg)", color: "var(--text)" }}>
      {nav}
      {crumb}

      <div style={{ flex: "1 1 auto", minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)", gridTemplateColumns: cols }}>
        {leftRail}
        {centre}
        {rightRail}
      </div>

      {/* The bar-detail card. It resolves against the frame because the frame
          is `position: relative` -- rule 4. */}
      {picked != null && shown[picked] && (
        <>
          <div onClick={() => setPicked(null)} style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(5,6,8,0.74)" }} />
          <div style={{ position: "absolute", zIndex: 61, top: 92, left: "50%", transform: "translateX(-50%)", width: 740, maxWidth: "calc(100% - 64px)", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface-1)", boxShadow: "0 24px 60px rgba(0,0,0,0.6)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
              <span role="img" style={crest(shown[picked].opp, sport, 22)} />
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18 }}>
                {`${shown[picked].home === false ? "@ " : "vs "}${shown[picked].opp} · ${shown[picked].date}`}
              </span>
              <span style={pill(hitOf(shown[picked].v) ? "var(--pos)" : "var(--neg)", hitOf(shown[picked].v) ? "var(--pos-dim)" : "var(--neg-dim)")}>
                {hitOf(shown[picked].v) ? "OVER" : "UNDER"}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={() => setPicked(null)}
                onKeyDown={(e) => { if (e.key === "Enter") setPicked(null); }}
                style={{ marginLeft: "auto", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text-2)", fontSize: 17, cursor: "pointer" }}
              >
                ×
              </span>
            </div>
            <div style={{ padding: "18px 20px 20px", display: "flex", alignItems: "flex-end", gap: 22 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={cellLabel}>{String(marketLabel || "").toUpperCase()}</span>
                <span style={{ fontFamily: MONO, fontSize: 34, fontWeight: 700, lineHeight: 1 }}>{shown[picked].v}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={cellLabel}>LINE</span>
                <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{line}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {onAddPick && (
        <div style={{ position: "absolute", right: 26, bottom: 22, zIndex: 30 }}>
          <span
            role="button"
            tabIndex={0}
            onClick={onAddPick}
            onKeyDown={(e) => { if (e.key === "Enter") onAddPick(); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 8,
              cursor: "pointer", fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em",
              border: `1px solid ${pickAdded ? "var(--line)" : "var(--amber)"}`,
              background: pickAdded ? "var(--surface-2)" : "var(--amber)",
              color: pickAdded ? "var(--text-2)" : "var(--accent-on)",
              boxShadow: "0 8px 22px rgba(0,0,0,0.45)",
            }}
          >
            {pickAdded ? "✓ ON MY PICKS" : "+ ADD TO MY PICKS"}
          </span>
        </div>
      )}
    </div>
  );
}
