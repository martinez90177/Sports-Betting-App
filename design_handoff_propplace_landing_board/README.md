# Handoff: PropPalace — Landing page + Board

## Overview

PropPalace is a sports-prop **research** tool. It sells no picks; its premise is
never overstating what the data supports. Two desktop screens are specified here:

1. **Landing page** — the front door. Today the app opens straight into a filter
   rail, which suits the daily user and disorients everyone else. The landing page
   states the argument, teaches the card grammar with one worked example, and
   hands off to the board.
2. **The board** (`/games`) — the real working surface behind the landing page's
   primary CTA. Full slate for a date, filter rail, prop rows grouped by game.

A third surface — **player / prop detail** — is implied by the board (clicking a
prop row) but is NOT designed yet. Do not invent it; ask before building it.

## About the design files

The two `.dc.html` files in this bundle are **design references authored in HTML**.
They are prototypes showing intended look and behavior — not production code to
copy. The task is to **recreate them in the target codebase's own environment**
(React + its existing stylesheet, per the brief) using its established patterns.
If no environment exists yet, pick the most appropriate framework and implement
there.

The brief this design was built against states the mock "gets rebuilt as React
against a stylesheet that already defines every one of these tokens" — so match
the token *names* below to that stylesheet rather than hard-coding hex values.

## Fidelity

**High-fidelity.** Colors, type, spacing, and geometry are final and exact.
Recreate pixel-for-pixel using the codebase's existing tokens and primitives.
The layout is fixed-width desktop at **1280px**. A 390px mobile variant is
desirable but was not designed — treat it as a follow-up.

---

## Design tokens

### Color

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0a0b0d` | page ground |
| `--surface-1` | `#131519` | cards, panels |
| `--surface-2` | `#191c21` | nested strips inside a card, game header rows |
| `--surface-sunken` | `#0d0f12` | inset wells, table header |
| `--line` | `#2b2f36` | all borders, hairline separators |
| `--text` | `#e8ecf2` | primary text |
| `--text-2` | `#aab2c0` | secondary text, micro-labels |
| `--dim` | `#8b98ab` | captions, disclaimers |
| `--accent` | `#3b5bdb` | lapis — solid fills, active controls |
| `--accent-ink` | `#8fa6ff` | accent as text on dark |
| `--accent-on` | `#ffffff` | text on a solid accent fill |

**Status colors — fixed, never re-tinted:**

| | Value | Meaning |
|---|---|---|
| green | `#3ecf8e` | cleared the line / hit / available |
| red | `#ef5b5b` | fell short / miss / out |
| amber | `#e8b13a` | questionable (availability only) |

### Two hard color rules — these are architectural

1. **The accent is user-configurable.** Settings lets a user re-tint the entire
   accent to any hue. The accent may therefore only carry meanings that survive a
   hue change: verdict figures, confidence bars, buttons, links, active controls.
   It must **never** encode health, hit/miss, or good/bad.
2. **Green and red are semantic and fixed.** Green = cleared/hit, red = fell
   short/miss. Never the accent for these; never green/red for decoration.

### Type

| Role | Family | Weight |
|---|---|---|
| Display / headings | Bricolage Grotesque | 600 |
| Body / UI | Archivo | 400–600 |
| Numbers, labels | Space Mono | 400, tabular figures |

- **Every** number — hit rates, counts, odds, lines, times — is Space Mono with
  `font-variant-numeric: tabular-nums`.
- Micro-labels (`OPP RANK`, `SEASON`, `RECEPTIONS · OVER 5.5`) are Space Mono
  uppercase, letter-spacing `0.12em`, in `--text-2`. **Note:** the brief's original
  10.5–11px proved too small and too dim in review; the delivered design uses
  **12.5–14px in `--text-2`** for card and row labels, reserving 10.5–11.5px +
  `--dim` for table headers, group headings, and disclaimers. Keep the delivered
  sizes.
- Google Fonts:
  `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&family=Archivo:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap`

### Geometry

- Radius: cards `6px`, chips/controls `4px`, pills `999px`.
- Spacing scale: 4 / 8 / 12 / 16 / 20 / 24 / 32.
- Borders `1px solid var(--line)`.
- Cards are **flat** — no drop shadows, no gradients, no glow. No arch geometry
  or arch motifs anywhere (a rejected earlier direction).

### Logo

Three ascending bars, left-to-right short → tall → medium, in `--accent`, flat
bottoms and rounded tops:

```html
<span style="display:flex; align-items:flex-end; gap:3px;">
  <span style="width:6px; height:12px; background:#3b5bdb; border-radius:3px 3px 0 0;"></span>
  <span style="width:6px; height:21px; background:#3b5bdb; border-radius:3px 3px 0 0;"></span>
  <span style="width:6px; height:16px; background:#3b5bdb; border-radius:3px 3px 0 0;"></span>
</span>
```

Wordmark: `PROP PALACE`, Space Mono 13px, letter-spacing `0.14em`, uppercase.

---

## Content rules — not stylistic, structural

A build that breaks these is wrong even if it matches pixel-for-pixel.

- **Every rate states its sample.** Never `78%` alone — always `78% · 7 of 9 games`.
  Counts first, percentage second. In split rows: `80% (4/5)`.
- **Thin samples get a verdict, not a number.** Under ~10 games the UI prints
  `TOO FEW` / `FAIR SAMPLE` in place of a percentage. Never project confidence
  the sample hasn't earned.
- **Green = over/hit, red = under/miss.** Nothing else.
- **Availability** is a dot on the avatar's bottom-right, green/amber/red only.
  **Unknown status = no dot** — never grey, never defaulting to green.
- **One data disclaimer** per card/rail: "Real 2025 regular-season game logs. Not
  a live odds feed."
- **No fabricated hero stat.** The example card must be a real row. ⚠️ The player
  names and figures in these mocks are **plausible placeholders, not verified 2025
  logs** — substitute real data before shipping.

---

## The form graph — the signature component

This is the most specified element in the design and the one most likely to be
built wrong. Build it once, reuse it at three sizes.

### What it encodes

Ten (or eight, or N) vertical bars, one per recent game, **grounded at zero** so
bar height is the player's actual stat value for that game. A **dashed horizontal
rule** crosses the chart at the prop line, so height reads as distance from the
line — a blowout is tall, a near-miss barely clears. This replaces an earlier
treatment of uniform-height squares, which showed *whether* he cleared but not
*by how much*.

### Spec

- Bars `flex: 1` within a flex row, `gap: 5–6px`, `border-radius: 2px 2px 0 0`,
  aligned `flex-end`.
- **Cleared the line** → solid fill green `#3ecf8e`.
- **Fell short** → red `#ef5b5b`, **1.5px outline, no fill**, `border-bottom: none`
  (the bar opens into the baseline).
- **The line** → `border-top: 1.5px dashed #e8ecf2` (`--text`), absolutely
  positioned across the bars row at the line's height. It is deliberately white,
  not accent: at accent lightness it disappeared against the green fills in review.
- **Line value tag** — solid `--accent` fill, `--accent-on` text, 4px radius, sat
  in a right-hand gutter (`padding-right` on the wrapper) so it never overlaps a
  bar. It uses the accent token, so it re-tints with the user's chosen hue.
- **Per-game values** under each bar in Space Mono 11px, `--text-2` for hits and
  red for misses, above a `--line` hairline.
- **Trailing-run rule** — a 2px bar in the run's color beneath just the trailing
  run of same-colored bars, tying the caption's streak claim to the games it
  describes.
- **Caption** — Space Mono, `9 of 10 · 7 straight`: count first, then streak,
  colored green when the run is hits, red when misses. Paired right-aligned with a
  margin figure (`avg +2.1 rec`) in `--text-2`.
- **Floor** the shortest bar at ~30% of max so it never reads as missing data.
- **Legend** wording is fixed: "cleared the line", "fell short", "the line".

### Three sizes in use

| Context | Bar row height | Gap | Extras |
|---|---|---|---|
| Hero example card (landing) | 120px | 6px | line tag, per-game values, run rule, caption, legend |
| Board row, last 8 vs. line | 34px | 5px | dashed line only |
| Landing board teaser card | 30px | 5px | bars only |

---

## Screen 1 — Landing page

**File:** `PropPalace Landing.dc.html`. Width 1280px, ground `--bg`.

### Top nav

`20px 48px` padding, `1px solid --line` bottom border, flex row `gap: 32px`.

- Left: three-bar mark + `PROP PALACE` wordmark, `gap: 10px`.
- Then: `Games / Prop Feed / News`, Space Mono 12px, `0.12em`, uppercase, all in
  `--text-2`, `gap: 26px`. **No active underline on the landing page** — the
  landing page is not one of those sections. (The board page *does* underline
  `GAMES`: `--accent-ink` text, `2px solid --accent` bottom border, 4px padding.)
- Right (`margin-left: auto`): `SIGN IN` in `--dim`, then a `21+` pill —
  `--accent-ink` text, `1px solid --accent`, `999px` radius, `5px 12px`.

### Hero — two columns

`display: grid; grid-template-columns: 1fr 468px; gap: 64px; padding: 72px 48px 88px; align-items: start`.

**Left — the argument**

1. Eyebrow, Space Mono 11px `0.14em` uppercase, `--accent-ink`:
   `2025 SEASON LOGS · NO PICKS SOLD`
2. H1, Bricolage 74px / `line-height: 1.02` / `letter-spacing: -0.02em`, three
   explicit lines: "Know the sample / before you take / the line."
3. Paragraph, Archivo 16px / 1.6, `--text-2`, `max-width: 62ch`: "Every hit rate
   here shows the games behind it. When the sample can't answer the question, we
   say so instead of printing a number with confidence it hasn't earned."
4. Buttons, `gap: 24px`, `margin-top: 32px`:
   - Primary — solid `--accent` fill, `--accent-on` text, Space Mono 12px `0.12em`
     uppercase, `14px 22px`, 4px radius: **OPEN THE BOARD** → links to the board.
   - Secondary — `--accent-ink` text link, underlined, `text-underline-offset: 4px`:
     **HOW WE COUNT**
5. A three-column strip above a `--line` top border (`margin-top: 56px`), each
   with a Space Mono micro-label and one 15px sentence — these state the product's
   rules rather than vanity metrics (an earlier "props tracked / game logs" stat
   strip was cut for being pointless):
   - **HOW WE COUNT** — "A rate never appears without its sample. `78% · 7 of 9`,
     never `78%`." (the good example in `--accent-ink`, the bad one in `--text-2`)
   - **THIN SAMPLES** — "Under ten games we print a verdict instead of a
     percentage — `too few`."
   - **MARGIN, NOT JUST HITS** — "Bar height shows how far a game cleared the line,
     so a blowout doesn't read like a squeaker."

**Right — the live example card**

`--surface-1`, `1px solid --line`, 6px radius, 24px padding.

1. Header row, `space-between`, `align-items: flex-start`:
   - Left: 26px team-crest slot (4px radius) + `LAR · WR` (Space Mono 14px `0.12em`
     uppercase, `--text-2`), `gap: 9px`; then player name, Bricolage 34px; then
     `RECEPTIONS · OVER 5.5`, same label style.
   - Right: **92px circular player headshot** with a 14px availability dot at
     bottom-right, `2px solid --surface-1` ring.
2. Verdict figure — `78%`, Space Mono 64px, `--accent-ink`, tabular, beside
   `7 of 9 games · 2025 season` in Space Mono 13px `--text-2`.
3. Form graph in a `--surface-2` well, 6px radius, 16px padding, headed
   `LAST 10 GAMES · MARGIN VS. LINE`. Full treatment per the section above, with
   the three-item legend beneath a `--line` divider.
4. Three split rows, hairline-separated (`border-top`, last also `border-bottom`),
   `12px 0`: label left in Archivo 15px `--text-2`, value right in Space Mono 15px
   tabular — `Home 80% (4/5)`, `vs. SEA defense 100% (1/1)`, `Last 3 67% (2/3)`.
5. Verdict block — `1px solid --line`, 6px radius, `--surface-sunken` fill, 16px
   padding: `FAIR SAMPLE · LEANS OVER` in Space Mono 13px `--accent-ink`, with
   "9 games. Treat as a lean, not a lock." beneath in `--text-2`.
6. Disclaimer, Space Mono 11.5px `--dim`: "Real 2025 regular-season game logs. Not
   a live odds feed."

**Note on the 9/10 mismatch:** the card's rate is over 9 games while the graph
shows 10, both per brief — hence the graph's explicit `LAST 10 GAMES` heading.
Decide in implementation whether to normalize both to the same window.

### Below the fold — board teaser

`Today's board` (Bricolage 34px) beside `SUNDAY, SEPTEMBER 14 · 12 GAMES` (Space
Mono 13px `--text-2`), with an `All games` link right-aligned → board page. Then a
`repeat(4, 1fr)` grid, `gap: 20px`, of game cards:

matchup + kickoff time; a `--surface-2` inner strip (4px radius) with player name,
market label, and the rate + sample; then a 5-bar mini graph. **One of the four
cards must demonstrate the thin-sample rule** — `TOO FEW` / `3 games` and the note
"Thin sample — no rate shown." in place of a percentage and graph.

### Footer

`--line` top border, three-bar mark, `RESEARCH ONLY · NO PICKS SOLD · 21+` in
`--dim`, `HOW WE COUNT` right-aligned.

---

## Screen 2 — The board

**File:** `PropPalace Board.dc.html`. Width 1280px.

### Header

Same nav, with `GAMES` active (accent, 2px accent underline). Below it:
`The board` (Bricolage 34px), a date stepper (`‹ SUN, SEP 14 ›` in a bordered
4px-radius box), `12 GAMES · 1,840 PROPS` in `--text-2`, and `Sort: Hit rate`
right-aligned with the value in `--accent-ink`.

### Body

`display: grid; grid-template-columns: 236px 1fr; gap: 24px; padding: 0 48px 64px; align-items: start`.

### Filter rail (left, 236px) — interactive

`--surface-1` card, `1px solid --line`, 6px radius, 20px padding.

**Market** — heading with a `Clear` link in `--accent-ink`. Below, a scrolling
region (`max-height: 296px`) of grouped multi-select chips: Space Mono 11px,
`0.05em`, 4px radius, `5px 9px`; selected = solid `--accent` / `--accent-on`,
unselected = transparent with `1px solid --line` and `--text-2` text. Group
headings are Space Mono 10.5px `0.14em` uppercase `--dim`. Groups:

- **Passing** — Pass yds, Pass TD, Pass attempts, Completions, INT, Longest completion
- **Rushing** — Rush yds, Rush attempts, Rush TD, Longest rush
- **Receiving** — Receptions, Rec yds, Rec TD, Targets, Longest reception
- **Combos** — Pass + rush yds, Rush + rec yds
- **Scoring** — Anytime TD, First TD, 2+ TD, Kicking points, FG made, XP made
- **Team & game** — Team total, Game total, Spread

(A Defense group and several combo/scoring markets were explicitly cut in review —
do not reintroduce them without asking. The market list is otherwise expected to
grow; drive it from data, not hard-coded markup.)

**Minimum sample** — two coupled controls:

1. **User-defined presets.** A row of chips (`5+`, `9+`, `12+` by default), each
   with an `×` to delete it (must `stopPropagation` so removing doesn't also
   select). Beside the heading, a link reading `+ save 11+` when the current slider
   value isn't yet a preset, and `saved` when it is. Presets sort ascending. Plus
   an `All` chip that bypasses the minimum entirely. **Persist presets per user.**
2. **Exact minimum slider.** 17 clickable ticks (1–17 games, one NFL regular
   season) rendered as a small ascending bar row, `gap: 3px`, `height: 26px`:
   ticks at or below the value are `--accent`, the rest `--line`. Labeled `1 / 9 / 17`
   beneath. Current value shown beside the heading in Space Mono 14px `--accent-ink`
   as `9+ games` (or `any`). Implement as a real `<input type="range">` (or an
   accessible custom slider) — the tick row is a visual stand-in for it.

A note beneath restates the rule: "Props under 9 games still appear, without a
rate." — and when `All` is active: "Every prop shown. Under 10 games still reads
'too few' instead of a rate."

**Split** — checkbox list, 14px Archivo: Season (checked), Home only, Last 3
games, vs. this defense. Checked box = 14px `--accent` square, 3px radius;
unchecked = `1px solid --line`.

Rail foot: the data disclaimer in a `--surface-sunken` bordered well.

### Prop table (right)

**Column grid, shared by header and every row:**
`232px 176px 148px 1fr 132px`, `gap: 16px`, `padding: 14px 20px`.

**Header strip** — `--surface-sunken`, `1px solid --line` with no bottom border,
`6px 6px 0 0` radius. Labels in Space Mono 11.5px `0.12em` uppercase `--dim`:
`PLAYER / PROP / HIT RATE · SAMPLE / LAST 8 VS. LINE / VERDICT` (last right-aligned).

**Body** — `--surface-1`, `1px solid --line`, `0 0 6px 6px` radius.

**Game group header** — `--surface-2` strip, `--line` bottom border: matchup in
Space Mono 14px `0.1em`, then kickoff + venue in `--text-2`, then prop count in
`--accent-ink`, right-aligned.

**Prop row** — `--line` bottom border (none on the last):

1. **Player** — 38px circular headshot with a 10px availability dot (or none when
   status is unknown), then name in Archivo 15px/500 and `TEAM · POS` in Space Mono
   11.5px `--text-2`.
2. **Prop** — Space Mono 12.5px uppercase, e.g. `RECEPTIONS O5.5`.
3. **Hit rate · sample** — rate in Space Mono 22px `--accent-ink` above the sample
   in 11.5px `--text-2` (`7 of 9 games`). For a thin sample, `TOO FEW` in 14px
   `--text` above `4 games` — no percentage.
4. **Last 8 vs. line** — the compact form graph: 34px bars with the dashed white
   line, no tag or values. A thin sample shows only the games it has, with the
   remaining width held open by a `flex: 4` spacer so bars stay aligned across rows.
5. **Verdict** — pill, 999px radius, `5px 10px`, Space Mono 11.5px uppercase:
   `LEANS OVER` in `--accent-ink` with `1px solid --accent`; `COIN FLIP` and
   `TOO FEW` in `--text-2` with `1px solid --line`. Never green or red — verdicts
   ride the accent, which the user may re-tint.

**Below the table** — a `SHOW 10 MORE GAMES` outlined accent button and the
three-item form-graph legend.

Row click should route to the (undesigned) player/prop detail view.

---

## Interactions & behavior

Implemented in the mocks:

- **Market chips** toggle multi-select; `Clear` empties the selection.
- **Sample presets** select on click, delete via `×` (stop propagation); the save
  link adds the current slider value if absent and reads `saved` if present.
- **Slider ticks** set the exact minimum and clear the `All` state.
- **Nav / CTA links** — landing `OPEN THE BOARD` and `All games` → board; board
  logo and footer `HOW WE COUNT` → landing.

Specified but not built — implement these:

- Hover states on rows (suggest `--surface-2` fill), chips, and buttons.
- Row click → player/prop detail.
- Date stepper ‹ › advancing the slate; sort control opening a menu.
- Split checkboxes recomputing every visible rate **and its stated sample**
  together — a split that drops the sample below the minimum must flip the row to
  `TOO FEW`, not show a percentage over three games.
- Loading: skeleton rows at the same grid; never render a rate before its sample.
- Empty: when filters exclude everything, say which filter is responsible.
- Responsive: 390px mobile variant is a follow-up; nothing below 1280px is designed.

## State

```
selectedMarkets: string[]        // multi-select, empty = all
minGames: number                 // 1–17
allSamples: boolean              // bypass the minimum
samplePresets: number[]          // user-defined, persisted per user
splits: { season, homeOnly, last3, vsThisDefense }
date: ISO date                   // drives the slate
sort: 'hitRate' | …
```

Data per prop row: player (name, team, position, headshot, availability status
including *unknown*), market + line, game log for the window (value per game),
derived hit count / sample size / streak / average margin, and a verdict bucket.
Derive the rate and the sample from the same query so they can never disagree.

## Assets

- **Fonts** — Bricolage Grotesque, Archivo, Space Mono via Google Fonts (link above).
- **Player headshots and team crests** are **drop slots in the mock**, not real
  assets (`image-slot.js` is prototype-only scaffolding — do not port it). Wire
  these to the real asset source. Respect the availability rule: unknown → no dot.
- **No icon set** is used. The only mark is the three-bar logo, which is three
  `<span>`s — no SVG needed.

## Files

| File | What it is |
|---|---|
| `PropPalace Landing.dc.html` | Landing page design reference |
| `PropPalace Board.dc.html` | Board page design reference |
| `image-slot.js` | Prototype-only image drop scaffolding — do not port |

Both HTML files open directly in a browser. Read them for exact values; read this
README for intent and for the rules that the markup alone can't tell you.
