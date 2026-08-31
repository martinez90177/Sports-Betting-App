import React from "react";
import PalaceMark from "../PalaceMark.jsx";
import { NAV_TABS } from "../NavBar.jsx";

// The mobile chassis every v3 screen except Player Detail is drawn inside.
//
// Transcribed from the header/nav/dock block that is identical across frames
// 1b, 2a-2d and 3a-3e of `v3 Mocks/PropPalace Mobile v3.dc.html`:
//
//   46px status bar        <- the phone the frame is drawn inside. NOT built.
//   46px app header        palace mark + wordmark | cog | 21+
//   nav row                six equal tabs, the active one underlined
//   body                   scroller, top 136 / bottom 82 in the mock
//   82px slip dock         one full-width control
//
// The mock positions those absolutely against a fixed 932px frame. A real
// phone is not 932px tall, so the same geometry is expressed as a column flex
// with a `min-height: 0` scroller between two `flex: 0 0 auto` bands -- which
// is what those insets encode and what the desktop handoff's rule 2 requires
// anyway. At 430x932 the two are pixel-identical.
//
// The dock is the one band that does not keep the mock's figure. 82px was
// 14 + a 48px control + 20, and the mock could afford it because its 932px
// frame has no browser chrome under it. A real phone does: Safari and Chrome
// both park a toolbar below the viewport, so the dock read as a second bar
// stacked on the browser's own and ate a finding-and-a-half of the scroller.
// It is now 8 + a 44px control + 8 (or the home-indicator inset, whichever is
// larger), which is 60px on a notchless phone -- still a 44px tap target,
// which is the floor the size is actually constrained by. Alex, 2026-08-31.
//
// The nav is the app's own NAV_TABS, which already matches the mock's list
// exactly: Games, The Board, Findings, Prop Feed, News, Injuries. The mock
// shortens two of them to fit six tabs across 430px.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

const SHORT = { board: "Board", feed: "Feed" };

export default function Shell({ page, onNavigate, onOpenSettings, onHome, slipDock = null, children }) {
  return (
    <div
      style={{
        position: "relative", display: "flex", flexDirection: "column",
        height: "100dvh", background: "var(--bg)", color: "var(--text)", overflow: "hidden",
      }}
    >
      <div style={{ flex: "0 0 auto", zIndex: 30, background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
          <div
            role="button"
            tabIndex={0}
            onClick={onHome}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onHome && onHome(); } }}
            style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
          >
            <PalaceMark variant="nav" />
            <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Prop Palace
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              role="button"
              tabIndex={0}
              onClick={onOpenSettings}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenSettings && onOpenSettings(); } }}
              aria-label="Settings"
              style={{
                width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)",
                color: "var(--dim)", fontSize: 16, cursor: "pointer",
              }}
            >
              ⚙
            </span>
            <span
              style={{
                fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: "var(--amber-ink)",
                border: "1px solid var(--amber)", borderRadius: 999, padding: "6px 11px",
              }}
            >
              21+
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, padding: "0 12px" }}>
          {NAV_TABS.map((t) => {
            const on = t.id === page;
            return (
              <span
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => onNavigate && onNavigate(t.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate && onNavigate(t.id); } }}
                style={{
                  flex: "1 1 auto", display: "flex", justifyContent: "center",
                  fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
                  padding: on ? "10px 0" : "10px 0 12px", whiteSpace: "nowrap", cursor: "pointer",
                  color: on ? "var(--amber-ink)" : "var(--dim)",
                  borderBottom: on ? "2px solid var(--amber)" : "none",
                }}
              >
                {SHORT[t.id] || t.label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", position: "relative" }}>
        {children}
      </div>

      {slipDock && (
        <div
          style={{
            flex: "0 0 auto", zIndex: 26, background: "var(--bg)",
            borderTop: "1px solid var(--line)", padding: "8px 16px",
            paddingBottom: "max(8px, env(safe-area-inset-bottom))",
            display: "flex", justifyContent: "center", boxSizing: "border-box",
          }}
        >
          {slipDock}
        </div>
      )}
    </div>
  );
}

// The dock's single control, drawn identically on every screen that has one.
export function SlipDock({ label, onClick }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick && onClick(); } }}
      style={{
        minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        width: "100%", borderRadius: 12, border: "1px solid var(--amber)",
        background: "var(--amber-dim)", color: "var(--amber-ink)",
        fontFamily: MONO, fontSize: 13, letterSpacing: "0.1em", cursor: "pointer",
      }}
    >
      {label}
    </div>
  );
}
