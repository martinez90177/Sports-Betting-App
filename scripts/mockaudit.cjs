#!/usr/bin/env node
//
// Checks that every literal string a v3 mock frame prints also appears in the
// component that transcribes it.
//
//   node scripts/mockaudit.cjs            # every mapped frame
//   node scripts/mockaudit.cjs 1a 1c      # just these
//
// What it does and does not prove
// -------------------------------
// It proves the *copy* was transcribed rather than paraphrased. That is worth
// automating because paraphrase is the failure this project keeps hitting --
// a sentence I wrote in place of the mock's reads fine and is invisible on
// review. It found "A season is a different sample, not a longer one." sitting
// where the mock says "MLB, NBA and the WNBA carry 2025 logs."
//
// It does NOT prove the layout matches: type sizes, spacing, colours and grid
// templates are not strings and are not checked here. Those are read out of
// the mock's `<script type="text/x-dc">` half and compared by eye against the
// running build at the frame's own width.
//
// Two kinds of string are excluded by design, both frame furniture rather
// than app UI:
//   - anything outside the frame's own device box (the turn headings, the
//     frame captions like "tap a row · tap REFINE · drag the bars", and the
//     rationale panels that sit between frames)
//   - the iOS status bar the phone frames draw at the top of the box
//
// Sample data is not excluded and shows up as a miss -- "Aaron Judge", "AJ",
// "126 of 1,566". Those are the mock's placeholders, replaced by real data or
// by a PlayerAvatar, so read the misses rather than trusting the count.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MOCKS = path.join(ROOT, "v3 Mocks");

// frame id -> the component that transcribes it. A frame with no entry is
// not claimed to be built yet.
const FRAMES = {
  "PropPalace Mobile v3.dc.html": {
    "1b": "PropFeedMobile", "1c": "PlayerDetailMobile", "2a": "GamesMobile",
    "2b": "FindingsMobile", "2c": "NewsMobile", "2d": "InjuriesMobile",
    "3a": "MyPicksMobile", "3b": "GamecastMobile", "3c": "MatchupMobile",
    "3d": "SettingsMobile", "3e": "LandingMobile",
  },
  "PropPalace Board v4 part 2.dc.html": {
    "1a": "BoardMobile", "1b": "BoardDesktop",
  },
  "PropPalace Desktop v3.dc.html": {
    "1a": "PlayerDetailDesktop", "1c": "PropFeedDesktop", "2a": "MyPicksDesktop", "2b": "GamesDesktop", "2c": "FindingsDesktop",
  },
};

// Shared pieces every frame may draw through, so a string living in one of
// these is still transcribed. Small files only, on purpose.
const SHARED = ["v3/FormPlot.jsx", "v3/Shell.jsx", "v3/AgeMark.jsx", "v3/boardShared.jsx"];

// Extra haystacks, per frame, for the parts of a screen that legitimately live
// outside src/v3/ -- the desktop nav row is NavBar.jsx, and the feed's table
// header and rows are still FeedTableHeader/FeedRow in PropLedger.jsx because
// those own the bar strip, the draggable line and the alt-line ladder, none of
// which would survive being retyped.
//
// Scoped per frame rather than added to SHARED, and worth saying why: adding a
// 28,000-line file to every frame's haystack makes the check much weaker,
// because any string in the app matches by accident. Doing exactly that made
// "Aaron Judge" and "AJ" stop being reported on two phone frames that do not
// import PropLedger at all. Only the frames that really draw through a file
// get to match against it.
const EXTRA = {
  "1c-desktop": ["NavBar.jsx", "PropLedger.jsx", "v3/MyPicksDesktop.jsx"],
  "2a-desktop": ["v3/intentRead.js", "v3/useMyPicks.js"],
  "2b-desktop": ["NavBar.jsx", "GamesPage.jsx"],
  "2c-desktop": ["NavBar.jsx", "FindingsPage.jsx", "lib/findings.js"],
  // The Board's tiers, reasons and cards are assembled in BoardPage.jsx.
  "1a-board": ["BoardPage.jsx"],
  "1b-board": ["NavBar.jsx", "BoardPage.jsx"],
};

// Regions of a frame that are knowingly not built yet, with the frame that
// will build them. Listed rather than silently passed: an unbuilt region and
// a botched one look identical to a string matcher, and the whole point of
// this file is that the difference gets stated.
// Strings a frame draws that this app deliberately does not, with the reason.
// Separate from DEFERRED: nothing is coming for these.
const NOT_BUILT = {
  "1a-board": { why: "mock scaffolding for a navigation the app performs", strings: ["OPENING"] },
  "1b-board": { why: "mock scaffolding for a navigation the app performs", strings: ["OPENING"] },
  // Frame 1c draws its full view as an overlay with a CLOSE control. The app
  // opens frame 2a, which is a page, so the way back is the nav rather than a
  // dismiss -- building the same screen twice to keep one glyph would be the
  // worse trade.
  "1c-desktop": { why: "the full view is a page here, not an overlay", strings: ["CLOSE ✕"] },
};

// Regions a frame draws that another frame builds. Frame 1c is the desktop
// Prop Feed and its ⌘ FULL VIEW overlay is the desktop My Picks screen --
// frame 2a -- reached by that control rather than built twice. So 1c matches
// against MyPicksDesktop as well, and nothing is held.
const DEFERRED = {};

// The iOS status bar, which is frame furniture inside the device box.
const STATUS_BAR = /^(9:41|▮+.*|.*ᯬ.*|\d{1,3}%)$/;

const norm = (x) => x.replace(/[’']/g, "").replace(/\s+/g, " ").trim();

// A bare name is a component under src/v3/; anything carrying an extension is
// a path relative to src/.
function readSrc(rel) {
  const p = path.join(ROOT, "src", /\.[jt]sx?$/.test(rel) ? rel : path.join("v3", rel + ".jsx"));
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

const want = process.argv.slice(2);
let total = 0, missing = 0, checked = 0;

for (const [file, map] of Object.entries(FRAMES)) {
  const full = path.join(MOCKS, file);
  if (!fs.existsSync(full)) { console.log("no such mock: " + file); continue; }
  const html = fs.readFileSync(full, "utf8");
  const ids = [...html.matchAll(/<div id="([0-9a-z]+)"/g)].map((m) => ({ id: m[1], at: m.index }));
  const scriptAt = html.indexOf('<script type="text/x-dc"');

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i].id;
    if (!map[id]) continue;
    if (want.length && !want.includes(id)) continue;

    const end = ids[i + 1] ? ids[i + 1].at : (scriptAt > 0 ? scriptAt : html.length);
    let frame = html.slice(ids[i].at, end);

    // Only the device box is app UI. Everything before it is the frame's
    // caption; everything after is the next turn heading and its rationale
    // panel. The box is the one element with an explicit pixel width and
    // height, and its extent is found by matching div depth -- slicing to the
    // next framed id instead leaves the trailing captions in, which is how
    // "430 × 932 · iPhone 15 Pro Max · tappable" once read as missing app copy.
    const box = frame.search(/<div style="position: relative; width: \d+px; height: \d+px/);
    if (box > 0) {
      let depth = 0, end = frame.length;
      const tag = /<(\/?)div\b[^>]*?(\/?)>/g;
      tag.lastIndex = box;
      for (let m = tag.exec(frame); m; m = tag.exec(frame)) {
        if (m[2] === "/") continue;            // self-closing: no depth change
        depth += m[1] ? -1 : 1;
        if (depth === 0) { end = m.index + m[0].length; break; }
      }
      frame = frame.slice(box, end);
    }

    let src = readSrc(map[id]);
    if (src == null) { console.log("FAIL " + id + " -- no src/v3/" + map[id] + ".jsx"); missing += 1; continue; }
    for (const sh of SHARED) { const extra = readSrc(sh); if (extra) src += extra; }
    // Keyed by frame id plus which mock it came from -- 1c is a frame id in
    // both files, and they are different screens.
    const scope = id + (file.includes("Board") ? "-board" : file.includes("Desktop") ? "-desktop" : "-mobile");
    for (const ex of (EXTRA[scope] || [])) { const extra = readSrc(ex); if (extra) src += extra; }
    const flat = norm(src);

    const lits = [...new Set(
      [...frame.matchAll(/>([^<>{}]{2,80})</g)]
        .map((m) => m[1].replace(/&mdash;/g, "—").replace(/&amp;/g, "&").trim())
        .filter((t) => t && /[A-Za-z]/.test(t) && !STATUS_BAR.test(t))
    )];
    const all = lits.filter((t) => !flat.includes(norm(t)));
    const defer = DEFERRED[id];
    const skip = NOT_BUILT[scope];
    const held = defer ? all.filter((t) => defer.strings.includes(t)) : [];
    const notBuilt = skip ? all.filter((t) => skip.strings.includes(t)) : [];
    const miss = all.filter((t) => !held.includes(t) && !notBuilt.includes(t));

    total += lits.length; missing += miss.length; checked += 1;
    console.log(
      (miss.length ? "MISS " : "ok   ") + id + "  " + map[id].padEnd(20) +
      String(lits.length).padStart(3) + " literals" +
      (miss.length ? "  " + miss.length + " missing" : "") +
      (held.length ? "  (" + held.length + " held for " + defer.to + ")" : "") +
      (notBuilt.length ? "  (" + notBuilt.length + " not built: " + skip.why + ")" : "")
    );
    miss.forEach((m) => console.log("        " + JSON.stringify(m)));
  }
}

console.log("\n" + checked + " frames, " + total + " literals, " + missing + " missing");
process.exit(missing ? 1 : 0);
