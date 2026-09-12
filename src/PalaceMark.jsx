// --------------------------------------------------------------------------
// The crown mark
// --------------------------------------------------------------------------
// PropPalace's logo: three bars on a band. Read one way it is a crown; read
// the other it is a bar chart clearing the line. The dashed line is fused
// into the top edge of the band, so the betting line *is* the crown's band:
// what sits above it counts.
//
// It replaces the five-tower palace mark (2026-09-12), which carried the same
// idea in five thin pieces and had no silhouette at 16px. The crown is one
// object, says "palace" in a word people already have, and flips cleanly
// between a green tile and a bare mark. The exploration that chose it is in
// the session's concept sheets ("PropPalace Marks", "PropPalace Crown",
// variant 2), not in a handoff folder.
//
// ---- Why this one component owns the colours ----
//
// Same rule as the palace mark before it: the mark must not re-tint with the
// user's accent. Nothing here reads --amber. It does track the *theme*, via
// --green / --bg / --text, which are fixed against the accent and only differ
// between light and dark (light mode deepens green for contrast on a pale
// ground, see index.css). The red "miss" bars of the old mark are gone; the
// crown is green only, so green-plus-bars still reads as "hit rate" before
// any word is, and there is nothing left to mistake for the accent.
//
// ---- Two variants ----
//
//   "nav"     -- the green tile, 24px square. Header lockups, mobile nav,
//                anywhere beside the wordmark. Bars and band are cut out of
//                the tile in --bg, so on a dark theme they are dark and on a
//                light theme they are pale; the tile itself is always green.
//                This is the same drawing as public/favicon.svg.
//   "display" -- the bare crown, no tile, 72x56. The landing page's hero
//                lockup and anything at that weight. Bars in --green, the
//                band's dashes in --text.
//
// One geometry, drawn in a 64-unit box and scaled; nothing overflows its box
// (the old mast and pennant did), so lockups need no extra room above.

const GEOM = {
  nav: { width: 24, height: 24, viewBox: "0 0 64 64" },
  display: { width: 72, height: 56, viewBox: "4 10 56 46" },
};

// Bars and band, shared by both variants. `fill` is whichever colour the
// variant cuts the crown from.
function Crown({ fill, dash }) {
  return (
    <>
      <rect x="12" y="26" width="11" height="20" rx="3.5" fill={fill} />
      <rect x="26.5" y="13" width="11" height="33" rx="3.5" fill={fill} />
      <rect x="41" y="26" width="11" height="20" rx="3.5" fill={fill} />
      <rect x="9" y="44" width="46" height="10" rx="3.5" fill={fill} />
      {/* The line, on the band's top edge and overhanging both ends so it
          reads as an axis the crown sits on, not a seam inside it. */}
      <line
        x1="4" y1="44" x2="60" y2="44"
        stroke={dash} strokeWidth="2.6" strokeDasharray="4.5 3.5"
      />
    </>
  );
}

export default function PalaceMark({ variant = "nav", title = "PropPalace", style }) {
  const g = GEOM[variant] || GEOM.nav;

  return (
    // `role="img"` with a title, not aria-hidden: this is the product's name
    // in every lockup it appears in, and the wordmark beside it is not always
    // rendered (mobile nav shows the mark alone).
    <svg
      role="img"
      aria-label={title}
      viewBox={g.viewBox}
      width={g.width}
      height={g.height}
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      {variant === "display" ? (
        <Crown fill="var(--green)" dash="var(--text)" />
      ) : (
        <>
          <rect width="64" height="64" rx="14" fill="var(--green)" />
          <Crown fill="var(--bg)" dash="var(--green)" />
        </>
      )}
    </svg>
  );
}
