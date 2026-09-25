import React from "react";

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

// The other season's rank, under a MATCHUP figure: "2026 so far: #9 of 32
// after 2 games". It printed as one more dim 10px line, the same weight as the
// captions around it, and Alex, 2026-09-25: *"the 2026 mention is a bit too
// hidden ... people might miss this with it blending in."* So the season part
// becomes a read-only pill and the rank itself prints at full strength. Split
// on the first ": ", which both of nflDefOtherText's forms have.
export default function SeasonNote({ text, size = 11 }) {
  const at = String(text).indexOf(": ");
  const tag = at > 0 ? text.slice(0, at) : null;
  const rest = at > 0 ? text.slice(at + 2) : text;
  return (
    <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
      {tag && (
        <span style={{ fontFamily: MONO, fontSize: size - 1.5, fontWeight: 700, letterSpacing: "0.08em", padding: "2px 7px", borderRadius: 999, background: "color-mix(in srgb, var(--text) 13%, transparent)", color: "var(--text)", whiteSpace: "nowrap" }}>
          {tag.toUpperCase()}
        </span>
      )}
      <span style={{ fontFamily: MONO, fontSize: size, fontWeight: 700, lineHeight: 1.35, color: "var(--text)" }}>{rest}</span>
    </span>
  );
}
