# Desktop — implementation handoff

Design: `PropPalace Desktop v3.dc.html`, options 1a–1c and 2a–2i. The Board is
`PropPalace Board v4 part 2.dc.html`.

This is the counterpart to `player-detail-handoff.md`. That document covers the
graph and its controls, which are shared. This one covers what is specific to
the wide layout: the grid contract, the intent read, the full view, and the
per-screen rules.

---

## 1. The grid contract

Every desktop screen is the same shell:

    1440 × 900, position: relative, overflow: hidden, display: flex, column
      ├── nav row                    flex: 0 0 auto
      ├── control bar (some screens) flex: 0 0 auto
      └── body                       flex: 1 1 auto, min-height: 0
            display: grid
            grid-template-rows: minmax(0, 1fr)
            grid-template-columns: <rail> minmax(0, 1fr) <rail>

**Four rules, each of which caused a real defect:**

1. **`grid-template-rows: minmax(0, 1fr)` on the body.** Without it the row is
   sized by its tallest child's min-content height, the frame overflows, and
   the inner scroller never engages.
2. **A scrolling column needs `min-height: 0; overflow: hidden`**, and its
   children need `flex: 0 0 auto`. A column-flex scroller whose children can
   shrink will compress them instead of scrolling — and any child with
   `overflow: hidden` then silently clips its own content. This is what cut the
   fourth reason off the Board's hero card.
3. **A collapsed rail has no track.** When My Picks or the filter rail
   collapses, remove its column from the template rather than setting it to
   `0px`. A leftover zero track puts the next column in the wrong place.
4. **`position: relative` on every frame.** The full view and any overlay
   resolve against the frame, not the document. A static frame sends the
   overlay to the canvas.

**Table rows and their header share one template string.** Define it once and
use it in both, or the columns drift apart the moment either changes.

---

## 2. Rails

The desktop layout exists to make things that are sheets on mobile into
permanent columns. The rule for what goes where:

- **Left rail — what filters the page.** Market, season, window, splits,
  workload, minimum sample, league, status, sort. Always visible, never a
  disclosure.
- **Right rail — what contextualises it.** Roster, teammates, opposing lineup,
  conditions, injuries, the read. Also always visible.
- **Centre — the thing itself**, and the only column that scrolls
  independently of the others.

Rails are 212–268px depending on content. They scroll independently. Nothing in
a rail is behind an accordion — the width is the whole point.

**Shape carries meaning.** Rounded rectangles (6–8px) for anything clickable;
full pills (999px) only for read-only labels — `21+`, availability, `ALT`,
`MAIN LINE`, `OUT`, `QUEST`. A control drawn as a pill reads as a badge and a
badge drawn as a rectangle reads as pressable.

---

## 3. Desktop-only interactions

These exist only here because they need a hover-capable pointer or a wide
track. Do not attempt them on touch.

### Bar zoom (Player Detail)

Drag across the graph to zoom into a run of games. Escape or the RESET ZOOM
chip returns to the window.

- `preventDefault()` on pointerdown and `user-select: none` on the track and
  its columns. Without both, the browser paints its own text selection over the
  graph — the blue smear.
- A drag under two columns is a click, not a zoom.
- The zoom is a slice of the already-windowed, already-filtered series, so it
  composes with everything else rather than replacing it.

### Hover tooltip

Date, opponent, the value, and over/under against the current line. It is a
hint that a click opens the detail card; the card carries the data.

### Keyboard

`←` `→` move the line one rung. `Escape` clears the zoom.

---

## 4. My Picks — the intent read (2a)

This is the screen with the most logic behind it and the one most likely to be
implemented into something dishonest. The design is a slip beside a read.

### The contract

The reader declares what they are building. Every leg is then judged against
**that** objective, not against a general notion of quality.

    Safe            main lines, high rates, samples deep enough to believe
    Risky           long price accepted, but not a leg with no sample
    Straight parlay posted main lines only
    Alt-leg parlay  lines dragged past the posted number for price
    Matchup alts    alts aimed at the softest defences on the slate

Each intent names its own failure, so the read can be specific.

### Three flags, and a legend

`FITS` / `CHECK` / `AGAINST`. The legend is printed in the footer — never make
the reader infer what a colour means.

### The rule that matters

**No objection without a counted fact.** Every branch cites something already
true elsewhere in the app: a sample size, a split, a defence rank, an
availability row, or a logged finding. If nothing counted supports a concern,
the leg reads FITS.

Two specific traps, both of which happened during design:

- **A teammate on the injury report is not evidence about someone else's
  market.** The lineup branch fires only on a role change the app has *logged
  for this player* — a finding naming both the player and the absence. Without
  that, a pitcher's absence gets cited against a batter's plate appearances.
- **Never assert a direction nothing counted.** "He is out, so this cuts your
  way" is a claim the data does not support. State the logged fact and its
  sample; let the reader draw the arrow. Asserting direction needs the
  participation record in `participation-data-check.md`.

### The combined number

Each leg's own rate multiplied, converted with `odds.js`. It is **not a price**
and must never be presented as one. The line under it says so, and states that
multiplying assumes independence — legs in one game are not independent, so the
figure is a ceiling.

### What would change it

Two or three concrete moves, each naming the leg and the reason. "Drag two
lines up a rung" is a move; "consider your risk" is not.

---

## 5. The full view

My Picks opens full-frame from the slip. It is the same data at a larger size,
not a different screen.

- It resolves against the frame — `position: absolute; inset: 0` inside a
  `position: relative` frame.
- Escape and an explicit close control both dismiss it.
- The footer note, the flag legend and the CTA are all present in both views.
  A state that exists in one and not the other is a bug.

---

## 6. Per-screen notes

**Prop Feed (1b).** Four tracks matching the app's own `.feed-grid`:
`34px / minmax(218px, 262px) / minmax(210px, 250px) / minmax(380px, 1fr)`, 14px
gap, 16px padding. No LINE or ODDS column. Six rate cells: L5, L10, L20, H2H,
2026, 2025 — H2H blanks under five meetings. Column headers sort: first click
highest, second lowest, third neutral, and **only the sorted column is
highlighted**. The custom window builder adds its own column to the left of L5;
its slider ceiling is that league's season length (MLB 162, NBA 82, WNBA 44,
NFL 17).

**Games (2b).** Date rail with per-date counts, cards three across. State
follows the date: only today can hold a live game, only past dates a final, and
a scheduled card shows no score.

**Findings (2c).** Controls as a rail, findings two across. The
hide-near-certainties switch states how many it is holding back.

**News (2d).** Wire full width, right rail carries the availability legend and
which slip legs the wire names. An item the feed could not attribute renders
with no avatar and no affected-props line.

**Injuries (2e).** One sortable table, not team cards. League and status as
rail filters with live counts. A team with no game on a held slate sorts last
and says "No game on this slate" rather than sorting as though it played at the
epoch. The coverage sentence names the leagues that publish nothing.

**Matchup (2f) and Gamecast (2g).** Only what the provider returns. Innings not
yet played are blank, not zero. A prop on a market the boxscore does not carry
is named as unfollowable rather than estimated from something adjacent.

**Settings (2h).** Sections as a left rail, controls in a two-column grid; the
accent wheel and outcome palettes span both columns. Layout only — every
control from `SettingsSections.jsx`, nothing added, nothing renamed.

**Landing (2i).** Two-column hero with the live example row. Every claim on
this page must be one the app can keep.

---

## 7. Before you call desktop done

1. Every frame is `position: relative` and nothing escapes its bounds.
2. Every scrolling column scrolls; nothing is compressed or clipped instead.
3. A collapsed rail gives its width to the centre column.
4. Header and row templates match on every table.
5. The flag legend is present wherever flags are.
6. No objection in the read lacks a citation.
7. Nothing claims to be a book price.
8. Nothing renders under 10px.
9. Console is clean.
