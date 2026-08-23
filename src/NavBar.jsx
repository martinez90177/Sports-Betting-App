import React from "react";
import PalaceMark from "./PalaceMark.jsx";

// The v2 nav bar, measured off the mocks rather than described from them:
// every one of PropPalace Board/Games/News/Prop Feed/Landing v2 draws the same
// row, and every measurement below comes from reading the rendered mock.
//
//   display:flex; align-items:center; gap:32px; padding:16px 32px
//   border-bottom:1px solid var(--line); content height 32px
//   logo lockup | tabs (gap 26) | right group (cog, SIGN IN, 21+)
//
// This replaces the `Page ▾` dropdown the app shipped with. The dropdown was
// never in any mock, and it hid the four sections behind a click.
//
// It does NOT appear on Player Detail. That screen's mock opens with a
// breadcrumb (`← PROP FEED | AWAY @ HOME · TIME · MARKET | + WATCH`) instead --
// it is a drill-down reached from the feed, not a nav destination. See
// NAV_PAGES in PropLedger.jsx for who gets one.
export const NAV_TABS = [
  { id: "games", label: "Games" },
  { id: "board", label: "The Board" },
  { id: "feed", label: "Prop Feed" },
  { id: "news", label: "News" },
];

// Both states share their type. Only colour and the underline differ, which is
// what keeps the row from reflowing by a pixel as the active tab changes.
const TAB_TYPE = {
  fontSize: 12,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  background: "none",
  border: "none",
  padding: "0 0 4px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

// `extraRight` leads the right-hand group. Only the Settings page passes one:
// its mock puts a "Done ×" control there, ahead of the cog.
export default function NavBar({ page, onNavigate, onOpenSettings, onHome, badge = null, extraRight = null }) {
  return (
    <nav
      style={{
        display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap",
        padding: "16px 32px", borderBottom: "1px solid var(--line)",
      }}
    >
      <span
        role="button"
        tabIndex={0}
        onClick={onHome}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onHome && onHome(); } }}
        aria-label="Go to start page"
        style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minHeight: "var(--tap, 32px)" }}
      >
        <PalaceMark />
        <span className="pp-mono" style={{ fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Prop Palace
        </span>
      </span>

      {/* Landing draws a FIRST VISIT pill here; no other screen passes one. */}
      {badge}

      <span style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
        {NAV_TABS.map((t) => {
          const active = t.id === page;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onNavigate(t.id)}
              aria-current={active ? "page" : undefined}
              className="pp-mono"
              style={{
                ...TAB_TYPE,
                // --amber-ink, not --amber: the raw accent as *text* on the
                // near-black surface is dark blue on black. The underline is
                // the raw accent, which is what the mock draws.
                color: active ? "var(--amber-ink)" : "var(--text-2)",
                borderBottom: active ? "2px solid var(--amber)" : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </span>

      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
        {extraRight}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          style={{
            width: 32, height: 32, minWidth: "var(--tap, 32px)", minHeight: "var(--tap, 32px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel2)",
            color: "var(--dim)", fontSize: 16, cursor: "pointer",
          }}
        >
          ⚙
        </button>
        <span className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.12em", color: "var(--dim)" }}>
          SIGN IN
        </span>
        <span
          className="pp-mono"
          style={{
            fontSize: 11, letterSpacing: "0.12em", color: "var(--amber-ink)",
            border: "1px solid var(--amber)", borderRadius: 999, padding: "5px 12px", whiteSpace: "nowrap",
          }}
        >
          21+
        </span>
      </span>
    </nav>
  );
}
