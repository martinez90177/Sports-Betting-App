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
//
// `lift` is for the cases where that last claim is wrong. The Padres' brown
// and the Yankees' navy on a #131519 ground are all but invisible, and a 15%
// tint behind them is not enough contrast to rescue them -- on the game-by-game
// axis the San Diego column read as an empty grey disc. Alex: "the SD is almost
// impossible to see".
//
// The fix traces the mark's own edge instead of putting a container round it:
// a tight 1px light shadow does the separating and a wider soft one lifts it
// off the surface. It flips with the theme, so a pale crest on the light theme
// gets a dark trace, and on an already-bright crest it is imperceptible.
const LIFT = "drop-shadow(0 0 1px color-mix(in srgb, var(--text) 70%, transparent))"
  + " drop-shadow(0 0 2px color-mix(in srgb, var(--text) 28%, transparent))";

export default function TeamLogo({ sport, abbr, size = 24, title, style, lift = false }) {
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
      style={{
        display: "block", width: size, height: size, objectFit: "contain", flexShrink: 0,
        ...(lift ? { filter: LIFT } : null),
        ...style,
      }}
    />
  );
}
