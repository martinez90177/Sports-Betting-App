// --------------------------------------------------------------------------
// The palace mark
// --------------------------------------------------------------------------
// PropPalace's logo: a five-tower palace facade that is also a hit-rate chart.
// Spec and rationale in `design_handoff_proppalace_full/README.md` ("Logo --
// the palace mark"); the full exploration, including every rejected variant,
// is in that bundle's `PropPalace Logo Marks.dc.html`. The chosen mark is the
// one labelled **F1 - Full status**.
//
// It replaces the three ascending lapis bars. Those read as data but not as a
// palace, and they carried none of the product's own vocabulary.
//
// Three devices, all lifted straight from the form graph every feed row draws:
//
//   1. Five towers stepping up to a central keep -- short, medium, tall,
//      medium, short. Symmetric, so it reads as a facade rather than a trend.
//   2. Towers that clear the line are solid green; the two short wings that
//      fall short are red, 1.5-2px outline, no fill and no bottom border, so
//      they open into the baseline. That is exactly how a missed game renders
//      in FeedFormStrip.
//   3. A white dashed rule crosses the whole mark just above the wings,
//      overhanging the towers on both sides, and the keep flies a triangular
//      pennant on a mast.
//
// ---- Why this one component owns the colours ----
//
// The mark is a deliberate, documented exception to the app's accent rule.
// Everywhere else, `--amber` (which is the *accent*, whatever hue the user
// picked in Settings) may never encode good/bad, and green/red may never
// decorate. Here the green/red pair IS the identity: green plus bars is read
// as "hit rate" before any word is. The handoff calls this out explicitly and
// it is the only place in the app where that trade is allowed.
//
// So the mark must not re-tint with the user's accent -- but it does still
// track the *theme*, via --green/--red/--text rather than literal hexes.
// Those three tokens are fixed against the accent and only differ between
// light and dark, where light mode deepens green and red for contrast on a
// white ground (see index.css). A literal #3ecf8e would be the wrong call:
// it would hold the brand hue exactly and fail the contrast it was chosen
// for. Nothing here reads --amber, which is the property that matters.
//
// ---- Sizes ----
//
// The handoff publishes exactly two geometries and they are hand-tuned, not a
// clean multiple of each other (the display keep is 56px against nav's 23px,
// but its bars are 9px against nav's 4px). So both are transcribed literally
// rather than derived from one scale factor, which would round the mast to
// nearly twice its drawn width at display size.
//
//   "nav"     -- 24px tall, mast and pennant overflowing above. Header
//                lockups, mobile nav, anywhere beside the wordmark.
//   "display" -- the landing page's hero lockup and anything at that weight.

const GEOM = {
  nav: {
    gap: 2, barW: 4, radius: 2, stroke: 1.5,
    wingH: 9, midH: 16, keepH: 23,
    mastW: 2, mastH: 9, mastLeft: 1,
    pennantW: 9, pennantH: 6, pennantLeft: 3, pennantBottom: 26,
    ruleBottom: 11, ruleOverhang: 3,
  },
  display: {
    gap: 4, barW: 9, radius: 4, stroke: 2,
    wingH: 22, midH: 38, keepH: 56,
    mastW: 3, mastH: 22, mastLeft: 3,
    pennantW: 20, pennantH: 14, pennantLeft: 6, pennantBottom: 64,
    ruleBottom: 28, ruleOverhang: 5,
  },
};

export default function PalaceMark({ variant = "nav", title = "PropPalace", style }) {
  const g = GEOM[variant] || GEOM.nav;

  // A wing: outlined red, open at the bottom. `border-bottom: none` is what
  // makes it read as a bar that fell short rather than an empty box -- same
  // treatment as a missed game in the form graph.
  const wing = (key) => (
    <span
      key={key}
      style={{
        width: g.barW, height: g.wingH,
        border: `${g.stroke}px solid var(--red)`,
        borderBottom: "none",
        borderRadius: `${g.radius}px ${g.radius}px 0 0`,
        boxSizing: "border-box",
      }}
    />
  );

  const mid = (key) => (
    <span
      key={key}
      style={{
        width: g.barW, height: g.midH,
        background: "var(--green)",
        borderRadius: `${g.radius}px ${g.radius}px 0 0`,
      }}
    />
  );

  return (
    // `role="img"` with a title, not an empty aria-hidden span: this is the
    // product's name in every lockup it appears in, and the wordmark beside it
    // is not always rendered (mobile nav shows the mark alone).
    <span
      role="img"
      aria-label={title}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        gap: g.gap,
        flexShrink: 0,
        ...style,
      }}
    >
      {wing("wL")}
      {mid("mL")}
      {/* The keep. Positioned so the mast and pennant can hang off its top
          edge -- they overflow the flex row's height on purpose, which is why
          any lockup around this needs room above it rather than a clip. */}
      <span
        style={{
          position: "relative",
          width: g.barW, height: g.keepH,
          background: "var(--green)",
          borderRadius: `${g.radius}px ${g.radius}px 0 0`,
        }}
      >
        <span style={{
          position: "absolute", left: g.mastLeft, bottom: g.keepH,
          width: g.mastW, height: g.mastH,
          background: "var(--green)",
          borderRadius: `${Math.round(g.radius / 2)}px ${Math.round(g.radius / 2)}px 0 0`,
        }} />
        {/* A true triangle, not a rectangle: the rectangular flag the earlier
            rounds used read as a bar poking sideways out of the keep. */}
        <span style={{
          position: "absolute", left: g.pennantLeft, bottom: g.pennantBottom,
          width: g.pennantW, height: g.pennantH,
          background: "var(--green)",
          clipPath: "polygon(0 0, 100% 50%, 0 100%)",
        }} />
      </span>
      {mid("mR")}
      {wing("wR")}
      {/* The line, overhanging both ends so it reads as an axis crossing the
          facade rather than a lid sitting on it. */}
      <span style={{
        position: "absolute",
        left: -g.ruleOverhang, right: -g.ruleOverhang,
        bottom: g.ruleBottom,
        borderTop: `${g.stroke}px dashed var(--text)`,
      }} />
    </span>
  );
}
