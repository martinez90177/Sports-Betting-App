# Build order

Do not hand the whole redesign over in one prompt. It is four phases; each one is
independently shippable and independently reviewable. Give Claude Code one phase
at a time, in this order, and check the acceptance list before moving on.

Reference files are standalone HTML — open them in a browser next to the app:

    reference/news.html         News page (4a)
    reference/alt-lines.html    Props feed ladder + slip (4b)
    reference/app-screens.html  Games slate, matchup overview, player prop detail (2a)
    reference/mobile.html       Mobile screens (3a) + the four logo candidates (3b)

`INSTALL.md` has the file-by-file mechanics. `README.md` has the measured spec
(hexes, grid columns, type scale, state shape). This file is only the order.

---

## Phase 1 — Foundations (low risk, touches everything)

Prompt Claude Code with:

    Read design_handoff_proppalace_redesign/INSTALL.md steps 1-3 and do them:
    copy the five files into src/, add the fonts to index.html and the .pp-display
    / .pp-mono classes to index.css, and reconcile the --accent / --accent-text /
    --pos / --neg token names with what src/index.css already defines. Change
    nothing else. Run npm run build.

Then, separately: replace every player avatar in the app with `<PlayerAvatar>`,
and rename the wordmark to "PROP PALACE" with the three-bar mark.

**Accept when:** the app looks unchanged apart from type, the wordmark, and
avatars that now carry a team-colour gradient behind the headshot with an
availability dot. No layout has moved.

---

## Phase 2 — News page (isolated, no existing behaviour at risk)

    Wire NewsPageRedesign into the News tab per INSTALL.md step 4, replacing
    NewsPage.jsx's card list. Start with no optional props, then add
    resolvePlayer, injuryWire and watchlistMoves once the layout matches
    design_handoff_proppalace_redesign/reference/news.html.

**Accept when:** two-column layout, lead story with a 68px avatar, AFFECTS chips
showing hit rate with its sample size, injury wire with ACTIVE / QUEST / OUT
pills, and articles with no player match still rendering cleanly.

---

## Phase 3 — Alt lines (the real work)

This is the only phase that needs new data. It has two halves; do them in order.

**3a. Data.** For a given player + market, produce the rung array from the game
log by counting the same finished games against each candidate line:

    rungs = candidateLines.map(line => ({
      line,
      gamesOver:     log.filter(g => g.finished && g.value > line).length,
      gamesCounted:  log.filter(g => g.finished).length,
      hitRate:       gamesOver / gamesCounted,
      price:         priceFor(line),
      isMain:        line === book.mainLine,
      thin:          gamesCounted < 10,
    }));

No modelling, no interpolation, no implied probability from price.

**3b. UI.** Wire `AltLineLadder` into the props feed and `SlipLeg` into the slip,
plus the `Main line only` / `Show alt lines` toggle and the combined block —
which counts games where **all** legs' players finished and all legs cleared,
never a product of the single rates.

**Accept when:** a ladder expands inline, `+ ADD LEG` adds that exact rung, the
stepper moves a leg between rungs and updates line / rate / count / price / the
trade-off sentence, and the `ALT` badge appears the moment a leg leaves the main
line.

---

## Phase 4 — Screen restyle (largest diff, no new behaviour)

The games slate, matchup overview and player prop detail in
`reference/app-screens.html`. Give Claude Code one screen per prompt, in this
order: player prop detail (it already changes in phase 3), then matchup, then
games. Add the two context blocks from `PlayerContextBlocks.jsx` to the player
page in the same pass.

**Accept when:** each screen matches its reference at 1280px wide, and every hit
rate on screen is still paired with the number of games behind it.

---

## What is NOT in this bundle

- **Mobile.** `reference/mobile.html` shows the intended mobile screens, but no
  components are written for them. Treat it as a separate project after phase 4.
- **The landing page.** Directions `1a` / `1b` / `1c` in the design canvas were
  explorations and are not part of this handoff.
- **A logo file.** The bars mark is three divs (heights 12 / 21 / 16 at 6px wide,
  3px gap, accent colour). Have it drawn as an SVG for `public/favicon.svg`.
- **PropLedger.jsx.** At 824KB it could not be read while designing, so phases 3
  and 4 are described in terms of intent, not diffs against your actual
  component tree. Claude Code reads it locally; expect it to propose a plan for
  that file before editing it, and ask it to.

## One rule to carry through every phase

Every rate shows its sample size, and a thin sample is labelled rather than
hidden. That constraint is what separates the app from the feed it was
originally modelled on — if a change would drop it, the change is wrong.
