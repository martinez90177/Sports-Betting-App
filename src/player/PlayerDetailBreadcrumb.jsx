import React from "react";

// Breadcrumb bar for the prop-feed player detail (Screen #1 / card 447).
// Left: back control. Center: matchup + time + market. Right: + WATCH toggle.
// Kept separate from the matchup-player breadcrumb (Screen #2) so the two
// pages can evolve independently.
export default function PlayerDetailBreadcrumb({ onBack, centerLabel, watching, onToggleWatch }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      padding: "12px 20px",
      borderBottom: "1px solid var(--line)",
      background: "var(--panel)",
      fontSize: 12.5,
      letterSpacing: "0.04em",
    }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "var(--dim)",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12.5,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "4px 0",
          flexShrink: 0,
        }}
      >
        ← Prop Feed
      </button>
      <div className="pp-mono" style={{
        flex: 1,
        textAlign: "center",
        color: "var(--text)",
        fontSize: 11.5,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {centerLabel}
      </div>
      <button
        type="button"
        onClick={onToggleWatch}
        style={{
          background: "none",
          border: "none",
          color: watching ? "var(--amber)" : "var(--dim)",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12.5,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "4px 0",
          flexShrink: 0,
          fontWeight: watching ? 700 : 400,
        }}
      >
        {watching ? "Watching" : "+ Watch"}
      </button>
    </div>
  );
}
