import React from "react";
import { teamAvatarBackground, nflHeadshot, STATUS } from "./lib/teamColors.js";

// Circular player avatar: team-colour gradient background, ESPN headshot on
// top, availability dot bottom-right. Initials are only rendered when there
// is no headshot to show.
export default function PlayerAvatar({
  name = "",
  team,
  espnId,
  headshotSrc,
  status,             // "active" | "questionable" | "out"
  size = 52,
  ringColor,         // defaults to the team's primary
  surface = "var(--panel)",  // colour the status-dot border punches through
}) {
  const src = headshotSrc || nflHeadshot(espnId);
  const initials = name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  const dotSize = Math.max(9, Math.round(size * 0.27));
  const dotBorder = size >= 60 ? 3 : 2;
  const st = STATUS[status];

  return (
    <span style={{ position: "relative", flexShrink: 0, width: size, height: size, display: "inline-block" }}>
      <span
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: size, height: size, borderRadius: "50%", overflow: "hidden",
          position: "relative", boxSizing: "border-box",
          background: teamAvatarBackground(team),
          border: `2px solid ${ringColor || "var(--line)"}`,
          fontSize: Math.max(9, Math.round(size * 0.25)),
          color: "var(--text)", letterSpacing: "0.02em",
        }}
        className="pp-mono"
      >
        {!src && initials}
        {src && (
          <img
            src={src}
            alt=""
            style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
            onError={(e) => { e.currentTarget.remove(); }}
          />
        )}
      </span>
      {st && (
        <span
          style={{
            position: "absolute", right: -1, bottom: -1, width: dotSize, height: dotSize,
            borderRadius: "50%", background: st.dot,
            border: `${dotBorder}px solid ${surface}`, boxSizing: "border-box",
          }}
        />
      )}
    </span>
  );
}

export function StatusPill({ status, note }) {
  const st = STATUS[status];
  if (!st) return null;
  return (
    <span
      className="pp-mono"
      style={{
        fontSize: 10.5, letterSpacing: "0.1em", color: st.dot,
        border: `1px solid ${st.border}`, padding: "5px 9px", whiteSpace: "nowrap",
      }}
    >
      {note ? `${st.label} · ${note}` : st.label}
    </span>
  );
}
