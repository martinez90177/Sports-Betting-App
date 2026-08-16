# Build order

Do not hand the whole redesign over in one prompt. It is five phases; each one is
independently shippable and independently reviewable. Give Claude Code one phase
at a time, in this order, and check the acceptance list before moving on.

Reference files are standalone HTML — open them in a browser next to the app:

    reference/news.html         News page (4a)
    reference/alt-lines.html    Props feed ladder + slip (4b)
    reference/app-screens.html  Games slate, matchup overview, player prop detail (2a)
    reference/mobile.html       Mobile screens (3a) + the four logo candidates (3b)
    reference/my-picks.html     My Picks drawer — slip / ledger / report (5a, 5b, 5c)

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

## Phase 3.5 — My Picks drawer: slip, ledger, report

The drawer already exists in the app with all three tabs. This phase restyles it
and adds one thing it does not have. Do it directly after phase 3, because the
slip tab depends on the rung data built there.

**Slip tab.** The existing legs gain a `PlayerAvatar`, the rung stepper from
phase 3, and the combined block that counts games where all legs landed together
— never a product of the single rates. The stepper's `−` / `+` hit areas are
44px.

**ALT means off the posted line, in either direction.** Not "the user changed
it." A leg the user never touched is ALT if the app opened it on a rung; a leg
they moved back onto the posted line is not. The badge and the accent stepper
border both key off `line !== book.mainLine`.

**Report tab.** Keep the existing copy verbatim, including the closing
disclaimer — it is the clearest statement of what the app does. Restyle only:
avatar per leg, ▲ green / ▼ red / · neutral marks. Add one mark when a leg sits
off the posted line, stating what that rung does to the rate.

**Ledger tab — the one addition.** Above the settled list, a calibration block
comparing the hit rate the app displayed against what actually happened, bucketed
by band (90–100 / 80–89 / 70–79 / under 70). Bar is the real rate, the accent tick
is what was claimed, each row carries its pick count. Buckets with fewer than 5
settled picks are labelled thin, not hidden.

The header reads wins−losses and a percentage, with a plain line stating what it
counts: every saved pick graded off the box score, not a bankroll and not profit.

**Accept when:** the drawer matches `reference/my-picks.html`, ALT keys off the
posted line rather than user interaction, the calibration bands compute from
settled picks with real counts, and the report's disclaimer is unchanged.

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

- **Mobile.** The My Picks drawer is designed at desktop width; on mobile it is a full-height sheet with the same three tabs. `reference/mobile.html` shows the intended mobile screens, but no
  components are written for them. Treat it as a separate project after phase 4.
- **The landing page.** Directions `1a` / `1b` / `1c` in the design canvas were
  explorations and are not part of this handoff.
- **A logo file.** The bars mark is three divs (heights 12 / 21 / 16 at 6px wide,
  3px gap, accent colour). Have it drawn as an SVG for `public/favicon.svg`.
- **PropLedger.jsx.** At 824KB it could not be read while designing, so phases 3
  and 4 are described in terms of intent, not diffs against your actual
  component tree. Claude Code reads it locally; expect it to propose a plan for
  that file before editing it, and ask it to.

## Rules that apply in every phase

These are not phase-specific. Any new screen, row, rail or card is checked
against them before it ships.

**1. A player's face and their availability travel together.** Anywhere a player
is named — feed rows, roster rails, player pages, mobile nav, lineup drawers,
news items, teammate chips, gamecast leaders — they get a `PlayerAvatar`, and
that avatar carries their availability dot. There is no surface where a player
appears as a bare name, and no surface where their photo appears without their
status.

**2. Exactly three availability colours, and blue is not one of them.**

    available     green    #3ecf8e
    questionable  amber    #e8b13a
    out           red      #ef5b5b
    unknown       no dot   (never a grey dot, never a default to green)

Blue is the app's accent — it means selected or interactive, never health. If a
status ever renders blue, that is a bug.

**3. The dot owns the avatar's bottom-right corner.** Nothing else goes there —
not a team logo, not a jersey number. The team is already stated in text
alongside the name; availability is not stated anywhere else.

**4. Nothing is ever silently dropped.** A game, player or row that can't be
rendered surfaces as a visible state ("N games unreadable"), never as an absent
row. This rule exists because four of seven WNBA games were invisible for
exactly this reason.

## One rule to carry through every phase

Every rate shows its sample size, and a thin sample is labelled rather than
hidden. That constraint is what separates the app from the feed it was
originally modelled on — if a change would drop it, the change is wrong.
