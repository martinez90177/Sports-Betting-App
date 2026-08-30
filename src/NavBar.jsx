import React from "react";
import AgeMark from "./v3/AgeMark.jsx";
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
  // Between the Board and the Feed, which is the reading order: the Board says
  // which games are worth opening, Findings says what is true inside them, the
  // Feed is the table both are built from.
  { id: "findings", label: "Findings" },
  { id: "feed", label: "Prop Feed" },
  { id: "news", label: "News" },
  // Its own destination rather than a rail on News. Sixty-nine players in a
  // 196px column is a scrollbox; the same list in its own page is readable and
  // can be filtered by league, which is what Alex asked for.
  { id: "injuries", label: "Injuries" },
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
      className="pp-nav"
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

      {/* On a phone these become four equal-width tabs on their own row --
          see .pp-nav-tabs. Deliberately at the top, not a bottom bar: the
          mobile file defines a `navItems` array for one and its template never
          renders it, so the bottom bar is a draft that was cut. */}
      <span className="pp-nav-tabs" style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
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

      <span className="pp-nav-right" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
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
        {/* Hidden on a phone (see .pp-nav-signin): the top row cannot hold
            the wordmark, the cog, this and the 21+ mark at 390px, and of the
            four this is the only one that is neither identity nor compliance
            -- and it does nothing yet. */}
        <span className="pp-mono pp-nav-signin" style={{ fontSize: 11, letterSpacing: "0.12em", color: "var(--dim)" }}>
          SIGN IN
        </span>
        <AgeMark />
      </span>
    </nav>
  );
}
