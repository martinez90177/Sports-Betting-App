import React, { useState, useEffect } from "react";
import { teamLogo } from "./lib/gamesData.js";

// A team's real crest, for every place the v2 mocks draw a lettered badge.
//
// The mocks use monograms and empty circles because the design files could not
// carry images (see Assets in the handoff README) -- every one of them is meant
// to be the real asset. This renders only the mark: the caller keeps its own
// shape, so the ring, tint, border and size the design specifies all survive,
// and a dark crest on near-black still reads because it sits on the tinted
// disc the caller already draws.
//
// Falls back to the abbreviation, never to nothing. ESPN's logo CDN 404s on a
// slug it doesn't recognise (relocations and rebrands do this every few
// seasons), and a blank badge is worse than a lettered one.
//
// Source is the same teamLogo(sport, abbr) the Games slate, gamecast and
// matchup pages already call -- abbreviations collide across leagues, so the
// sport is always part of the lookup.
export default function TeamLogo({ sport, abbr, size = 24, title, style }) {
  const [failed, setFailed] = useState(false);
  // A new team in the same slot has to try its own asset rather than inherit
  // the previous one's failure -- these sit in rails and rows that recycle.
  useEffect(() => { setFailed(false); }, [sport, abbr]);

  if (!abbr) return null;

  if (failed) {
    return (
      <span
        className="pp-mono"
        title={title || abbr}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.34)),
          letterSpacing: "0.04em", color: "var(--text-2)", ...style,
        }}
      >
        {abbr}
      </span>
    );
  }

  return (
    <img
      src={teamLogo(sport, abbr)}
      alt={title || abbr}
      title={title || abbr}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{ display: "block", width: size, height: size, objectFit: "contain", flexShrink: 0, ...style }}
    />
  );
}
