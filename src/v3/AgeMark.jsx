import React from "react";

// The 21+ mark and the compliance panel it opens on hover or focus.
//
// Every v3 desktop frame draws this in its nav row, and the phone frames draw
// the mark alone. It lives here rather than in each frame because the copy is
// compliance text: one wording, changed in one place, or the frames drift and
// the site says different things about the same obligation on different pages.
//
// The desktop mock keys the helpline off a `userState` setting. This app has
// none, so the national line renders -- and the caption says *national*,
// rather than the mock's "Shown for NY", which would print a state's name
// beside a number that is not that state's mandated line. A helpline labelled
// with the wrong state is worse than one labelled with none.
export default function AgeMark({ radius = 999 }) {
  return (
    <span className="pp-nav-age" style={{ position: "relative", display: "inline-flex" }}>
      <span
        className="pp-mono"
        tabIndex={0}
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 11, letterSpacing: "0.12em", color: "var(--amber-ink)",
          border: "1px solid var(--amber)", borderRadius: radius, padding: "5px 12px",
          whiteSpace: "nowrap", cursor: "help",
        }}
      >
        21+
      </span>
      <span
        className="pp-nav-age-panel"
        style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, width: 320,
          padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 10,
          background: "var(--panel)", boxShadow: "0 18px 44px rgba(0,0,0,0.6)",
          textAlign: "left", zIndex: 60,
        }}
      >
        <span className="pp-mono" style={{ display: "block", fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)", marginBottom: 8 }}>
          21+ · PLEASE PLAY RESPONSIBLY
        </span>
        <span style={{ display: "block", fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)", marginBottom: 10 }}>
          Must be 21 or older and physically present in a state where sports betting is legal. This site publishes research only — it takes no wagers and holds no funds.
        </span>
        <span style={{ display: "block", fontSize: 12.5, lineHeight: 1.5, color: "var(--text)", marginBottom: 4 }}>
          If gambling stops being fun, help is free and confidential, 24/7:
        </span>
        <span className="pp-mono" style={{ display: "block", fontSize: 12, color: "var(--amber-ink)", marginBottom: 2 }}>
          1-800-GAMBLER
        </span>
        <span className="pp-mono" style={{ display: "block", fontSize: 12, color: "var(--amber-ink)", marginBottom: 8 }}>
          Text GAMBLER to 53342
        </span>
        <span style={{ display: "block", fontSize: 11, lineHeight: 1.45, color: "var(--dim)" }}>
          The national line. Several states mandate their own — check your state's if it differs.
        </span>
      </span>
    </span>
  );
}
