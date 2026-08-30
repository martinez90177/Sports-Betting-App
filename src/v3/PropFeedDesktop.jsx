import React from "react";
import AgeMark from "./AgeMark.jsx";

// Desktop Prop Feed -- `v3 Mocks/PropPalace Desktop v3.dc.html`, frame 1c.
//
// The frame is the page's chassis, not its table: nav row, market tabs, then
// a three-column grid of filters rail / table / My Picks dock. The rows
// themselves stay with `FeedRow` in PropLedger.jsx and arrive here as nodes.
// That is deliberate -- FeedRow owns the bar strip, the draggable line, the
// alt-line ladder and the six rate cells, all of which are already the mock's
// and none of which would survive being retyped.
//
// Grid rules from `desktop-handoff.md` §1, all four of which are load-bearing
// here:
//   1. `grid-template-rows: minmax(0, 1fr)` -- without it the row takes its
//      content's height and the scrolling columns never scroll.
//   2. Every scrolling column is `min-height: 0; overflow: hidden` with
//      `flex: 0 0 auto` children.
//   3. A closed rail loses its *track*. A leftover `0px` column puts the
//      table in the wrong grid column and blanks the page -- the mock's own
//      comment says so, having hit it.
//   4. `position: relative` on the frame, so the full-view overlay resolves
//      against it.

const MONO = "'Space Mono', monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const railLabel = {
  fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)",
};

export default function PropFeedDesktop({
  // ---- nav row ----
  navTabs = [],
  activeTab = "feed",
  onNavigate,
  onHome,
  onOpenSettings,

  // ---- market tabs and the direction pair ----
  marketTabs = [],
  directions = [],
  filterCount = 0,
  filtersOpen = true,
  onToggleFilters,

  // ---- the filters rail ----
  railGroups = [],
  customWindow = null,
  toggles = [],
  toggleNote = null,

  // ---- the count / sort bar ----
  countLabel = null,
  benchedLabel = null,
  sortNote = null,
  sorts = [],

  // ---- the table itself ----
  header = null,
  rows = null,

  // ---- the My Picks dock ----
  picks = null,

  // ---- anything the page draws over the frame (banners, sheets) ----
  overlays = null,
}) {
  // Rule 3. The rail and the dock each contribute a track only while they are
  // drawn; the dock's collapsed state is a 56px rail, not a missing one.
  const cols = [
    filtersOpen ? "218px" : null,
    "minmax(0, 1fr)",
    picks ? (picks.open ? "296px" : "56px") : null,
  ].filter(Boolean).join(" ");

  const tab = (t) => {
    const on = t.id === activeTab;
    return (
      <span
        key={t.id}
        role="button"
        tabIndex={0}
        onClick={() => onNavigate && onNavigate(t.id)}
        onKeyDown={(e) => { if (e.key === "Enter") onNavigate && onNavigate(t.id); }}
        style={{
          fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.1em", cursor: "pointer",
          color: on ? "var(--text)" : "var(--dim)",
          borderBottom: on ? "2px solid var(--amber)" : "2px solid transparent",
          paddingBottom: 3,
        }}
      >
        {t.label}
      </span>
    );
  };

  return (
    <div
      style={{
        position: "relative",
        height: "100%", minHeight: 0,
        display: "flex", flexDirection: "column",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* ---- nav row ---------------------------------------------------- */}
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 32, padding: "16px 32px", borderBottom: "1px solid var(--line)" }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onHome}
          onKeyDown={(e) => { if (e.key === "Enter") onHome && onHome(); }}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
        >
          <PalaceMark />
          <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>Prop Palace</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 26 }}>{navTabs.map(tab)}</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <span
            role="button"
            tabIndex={0}
            onClick={onOpenSettings}
            onKeyDown={(e) => { if (e.key === "Enter") onOpenSettings && onOpenSettings(); }}
            style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--dim)", fontSize: 15, cursor: "pointer" }}
          >
            ⚙
          </span>
          {/* Drawn because the frame draws it. There is no account server yet
              (docs/ACCOUNTS_SUBSCRIPTION_TUTORIAL.md), so it is a label, not a
              control, and carries no affordance saying otherwise. */}
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: "var(--dim)" }}>SIGN IN</span>
          <AgeMark radius={7} />
        </span>
      </div>

      {/* ---- market tabs, direction pair, filters button ----------------- */}
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 26, padding: "0 32px", borderBottom: "1px solid var(--line)" }}>
        {marketTabs.map((m) => (
          <div
            key={m.id}
            role="button"
            tabIndex={0}
            onClick={m.onPick}
            onKeyDown={(e) => { if (e.key === "Enter") m.onPick && m.onPick(); }}
            style={{
              padding: "13px 0", fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.08em",
              whiteSpace: "nowrap", cursor: "pointer",
              color: m.active ? "var(--text)" : "var(--dim)",
              borderBottom: m.active ? "2px solid var(--amber)" : "2px solid transparent",
            }}
          >
            {m.label}
          </div>
        ))}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {directions.map((d) => (
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              onClick={d.onPick}
              onKeyDown={(e) => { if (e.key === "Enter") d.onPick && d.onPick(); }}
              style={{
                minHeight: 30, display: "flex", alignItems: "center", padding: "0 13px", borderRadius: 7,
                fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", cursor: "pointer",
                border: `1px solid ${d.active ? "var(--amber)" : "var(--line)"}`,
                background: d.active ? "var(--amber-dim)" : "transparent",
                color: d.active ? "var(--amber-ink)" : "var(--dim)",
              }}
            >
              {d.label}
            </div>
          ))}
          <div
            role="button"
            tabIndex={0}
            onClick={onToggleFilters}
            onKeyDown={(e) => { if (e.key === "Enter") onToggleFilters && onToggleFilters(); }}
            style={{
              minHeight: 30, display: "flex", alignItems: "center", gap: 7, padding: "0 13px", borderRadius: 7,
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", cursor: "pointer",
              border: `1px solid ${filtersOpen ? "var(--amber)" : "var(--line)"}`,
              background: filtersOpen ? "var(--amber-dim)" : "transparent",
              color: filtersOpen ? "var(--amber-ink)" : "var(--dim)",
            }}
          >
            FILTERS
            {filterCount > 0 && (
              <span style={{ minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "var(--amber)", color: "#fff", fontSize: 9.5 }}>
                {filterCount}
              </span>
            )}
          </div>
        </span>
      </div>

      {/* ---- the three columns ------------------------------------------ */}
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)", gridTemplateColumns: cols }}>
        {filtersOpen && (
          <div className="nsb" style={{ borderRight: "1px solid var(--line)", overflowY: "auto", padding: "18px 18px 26px", display: "flex", flexDirection: "column", gap: 20 }}>
            {railGroups.map((fg) => (
              <div key={fg.key || fg.label} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span style={railLabel}>{fg.label}</span>
                  {fg.value != null && <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{fg.value}</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${fg.cols || 2}, minmax(0, 1fr))`, gap: 6 }}>
                  {fg.items.map((it) => (
                    <div key={it.id || it.label} style={{ position: "relative" }}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={it.onPick}
                        onKeyDown={(e) => { if (e.key === "Enter") it.onPick && it.onPick(); }}
                        style={{
                          minHeight: 32, display: "flex", alignItems: "center", justifyContent: "center",
                          borderRadius: 7, fontFamily: MONO, fontSize: 11, cursor: "pointer",
                          border: `1px solid ${it.active ? "var(--amber)" : "var(--line)"}`,
                          background: it.active ? "var(--amber-dim)" : "transparent",
                          color: it.active ? "var(--amber-ink)" : "var(--text-2)",
                        }}
                      >
                        {it.label}
                      </div>
                      {it.onRemove && (
                        <div
                          role="button"
                          tabIndex={0}
                          title="Remove this saved window"
                          onClick={(e) => { e.stopPropagation(); it.onRemove(); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); it.onRemove(); } }}
                          style={{
                            position: "absolute", top: -6, right: -6, width: 18, height: 18,
                            display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999,
                            border: "1px solid var(--line)", background: "var(--surface-2)",
                            color: "var(--dim)", fontSize: 11, cursor: "pointer",
                          }}
                        >
                          ×
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {fg.note && (
                  <span style={{ fontSize: 11.5, lineHeight: 1.4, color: fg.noteTone || "var(--dim)" }}>{fg.note}</span>
                )}

                {/* The custom-window builder, drawn inside the group it
                    belongs to rather than as a panel of its own. */}
                {fg.custom && customWindow && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Step onClick={customWindow.onDown} label="−" />
                      <span style={{ flex: "1 1 auto", textAlign: "center", fontFamily: MONO, fontSize: 14, fontWeight: 700 }}>{customWindow.label}</span>
                      <Step onClick={customWindow.onUp} label="+" />
                    </div>
                    <Slider fillPct={customWindow.fillPct} onDragTo={customWindow.onDragTo} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
                      {(customWindow.ticks || []).map((tk) => <span key={tk}>{tk}</span>)}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn onClick={customWindow.onApply} label="APPLY" primary />
                      <Btn onClick={customWindow.onSave} label="SAVE" />
                    </div>
                    <span style={{ fontSize: 11.5, color: "var(--dim)", lineHeight: 1.4 }}>Apply adds a column · Save keeps it here</span>
                    {customWindow.canClear && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={customWindow.onClear}
                        onKeyDown={(e) => { if (e.key === "Enter") customWindow.onClear(); }}
                        style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", color: "var(--dim)", cursor: "pointer" }}
                      >
                        REMOVE COLUMN
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {toggles.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                {toggles.map((tg) => (
                  <div
                    key={tg.id || tg.label}
                    role="button"
                    tabIndex={0}
                    onClick={tg.onToggle}
                    onKeyDown={(e) => { if (e.key === "Enter") tg.onToggle && tg.onToggle(); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 34, cursor: "pointer" }}
                  >
                    <span style={{ width: 17, height: 17, borderRadius: 5, display: "block", flex: "0 0 auto", border: `1px solid ${tg.on ? "var(--amber)" : "var(--line)"}`, background: tg.on ? "var(--amber)" : "transparent" }} />
                    <span style={{ fontSize: 12.5, color: "var(--text)" }}>{tg.label}</span>
                  </div>
                ))}
                {toggleNote && <span style={{ fontSize: 11.5, color: "var(--dim)", lineHeight: 1.4 }}>{toggleNote}</span>}
              </div>
            )}
          </div>
        )}

        {/* ---- the table column ----------------------------------------- */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 8, padding: "12px 20px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              {countLabel && <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 11, color: "var(--text-2)", whiteSpace: "nowrap" }}>{countLabel}</span>}
              {benchedLabel && <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 11, color: "var(--dim)", whiteSpace: "nowrap" }}>{benchedLabel}</span>}
              <span style={{ marginLeft: "auto", flex: "1 1 auto", textAlign: "right", fontFamily: MONO, fontSize: 10, color: "var(--amber-ink)", minWidth: 0 }}>
                {`sorted by ${sortNote}`}
              </span>
            </div>
            {sorts.length > 0 && (
              <div className="nsb" style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto" }}>
                <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)" }}>SORT</span>
                {sorts.map((s) => (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    title={s.description}
                    onClick={s.onPick}
                    onKeyDown={(e) => { if (e.key === "Enter") s.onPick && s.onPick(); }}
                    style={{
                      flex: "0 0 auto", minHeight: 28, display: "flex", alignItems: "center", padding: "0 11px",
                      borderRadius: 7, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.06em",
                      whiteSpace: "nowrap", cursor: "pointer",
                      border: `1px solid ${s.active ? "var(--amber)" : "var(--line)"}`,
                      background: s.active ? "var(--amber-dim)" : "transparent",
                      color: s.active ? "var(--amber-ink)" : "var(--dim)",
                    }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {header}

          <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
            {rows}
          </div>
        </div>

        {/* ---- the My Picks dock ---------------------------------------- */}
        {picks && (
          <div style={{ borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0 }}>
            {!picks.open && (
              <div
                role="button"
                tabIndex={0}
                onClick={picks.onToggle}
                onKeyDown={(e) => { if (e.key === "Enter") picks.onToggle(); }}
                style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "18px 0", cursor: "pointer" }}
              >
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--amber-ink)" }}>‹</span>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", color: "var(--text-2)", writingMode: "vertical-rl", textOrientation: "mixed" }}>
                  {`MY PICKS · ${picks.count || 0}`}
                </span>
              </div>
            )}
            {picks.open && (
              <>
                <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={picks.onToggle}
                    onKeyDown={(e) => { if (e.key === "Enter") picks.onToggle(); }}
                    style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, border: "1px solid var(--line)", background: "var(--surface-1)", color: "var(--amber-ink)", fontSize: 12, cursor: "pointer" }}
                  >
                    ›
                  </span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16 }}>My Picks</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{picks.note}</span>
                  {picks.onOpenFull && (
                    <span
                      role="button"
                      tabIndex={0}
                      title="Open the full slip and its read"
                      onClick={picks.onOpenFull}
                      onKeyDown={(e) => { if (e.key === "Enter") picks.onOpenFull(); }}
                      style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, minHeight: 30, padding: "0 10px", borderRadius: 7, border: "1px solid var(--line)", background: "var(--surface-1)", color: "var(--amber-ink)", fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", cursor: "pointer" }}
                    >
                      ⤢ FULL VIEW
                    </span>
                  )}
                </div>
                {picks.tabs && picks.tabs.length > 0 && (
                  <div style={{ flex: "0 0 auto", display: "flex", borderBottom: "1px solid var(--line)" }}>
                    {picks.tabs.map((t) => (
                      <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={t.onPick}
                        onKeyDown={(e) => { if (e.key === "Enter") t.onPick && t.onPick(); }}
                        style={{
                          flex: "1 1 0", minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.1em", cursor: "pointer",
                          color: t.active ? "var(--text)" : "var(--dim)",
                          borderBottom: t.active ? "2px solid var(--amber)" : "2px solid transparent",
                        }}
                      >
                        {t.label}
                      </div>
                    ))}
                  </div>
                )}
                <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "14px 16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {picks.body}
                  {picks.foot && <span style={{ fontSize: 12, lineHeight: 1.45, color: "var(--dim)" }}>{picks.foot}</span>}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {overlays}
    </div>
  );
}

// ---- small pieces the rail uses -------------------------------------------

function Step({ onClick, label }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter") onClick && onClick(); }}
      style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text-2)", cursor: "pointer" }}
    >
      {label}
    </div>
  );
}

function Btn({ onClick, label, primary }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter") onClick && onClick(); }}
      style={{
        flex: "1 1 0", height: 34, display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid var(--amber)", borderRadius: 6,
        background: primary ? "var(--amber)" : "var(--amber-dim)",
        color: primary ? "#ffffff" : "var(--amber-ink)",
        fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", cursor: "pointer",
      }}
    >
      {label}
    </div>
  );
}

// The window slider. A pointer drag anywhere on the track moves the knob, and
// the track is the hit target rather than the 14px knob -- the same reason the
// Player Detail line tag is dragged by its whole strip.
function Slider({ fillPct = 0, onDragTo }) {
  const ref = React.useRef(null);
  const at = (clientX) => {
    const box = ref.current && ref.current.getBoundingClientRect();
    if (!box || !box.width) return 0;
    return Math.max(0, Math.min(1, (clientX - box.left) / box.width));
  };
  const start = (e) => {
    if (!onDragTo) return;
    // Stops the browser starting a text selection across the rail mid-drag.
    e.preventDefault();
    onDragTo(at(e.clientX));
    const move = (ev) => onDragTo(at(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div ref={ref} onPointerDown={start} style={{ position: "relative", height: 20, cursor: "pointer", userSelect: "none" }}>
      <span style={{ position: "absolute", left: 0, right: 0, top: 8, height: 4, borderRadius: 999, background: "var(--line)" }} />
      <span style={{ position: "absolute", left: 0, top: 8, height: 4, borderRadius: 999, width: `${fillPct * 100}%`, background: "var(--amber)" }} />
      <span style={{ position: "absolute", top: 3, left: `calc(${fillPct * 100}% - 7px)`, width: 14, height: 14, borderRadius: 999, background: "var(--amber)", border: "2px solid var(--bg)" }} />
    </div>
  );
}

// The palace mark. Five bars behind a dashed line -- two misses outlined in
// red, three clears filled green, the tallest carrying the pennant. Identical
// to the one NavBar draws; it is here so the frame can draw its own nav row
// without importing the phone chassis.
function PalaceMark() {
  return (
    <span style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
      <span style={{ width: 4, height: 9, border: "1.5px solid var(--neg)", borderBottom: "none", borderRadius: "2px 2px 0 0", boxSizing: "border-box" }} />
      <span style={{ width: 4, height: 16, background: "var(--pos)", borderRadius: "2px 2px 0 0" }} />
      <span style={{ position: "relative", width: 4, height: 23, background: "var(--pos)", borderRadius: "2px 2px 0 0" }}>
        <span style={{ position: "absolute", left: 1, bottom: 23, width: 2, height: 9, background: "var(--pos)", borderRadius: "1px 1px 0 0" }} />
        <span style={{ position: "absolute", left: 3, bottom: 26, width: 9, height: 6, background: "var(--pos)", clipPath: "polygon(0 0, 100% 50%, 0 100%)" }} />
      </span>
      <span style={{ width: 4, height: 16, background: "var(--pos)", borderRadius: "2px 2px 0 0" }} />
      <span style={{ width: 4, height: 9, border: "1.5px solid var(--neg)", borderBottom: "none", borderRadius: "2px 2px 0 0", boxSizing: "border-box" }} />
      <span style={{ position: "absolute", left: -3, right: -3, bottom: 11, borderTop: "1.5px dashed var(--text)" }} />
    </span>
  );
}
