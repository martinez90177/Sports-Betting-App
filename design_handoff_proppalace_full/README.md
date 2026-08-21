# Handoff: PropPalace — full desktop + mobile redesign

## Overview

PropPalace is a sports-prop **research** tool. It sells no picks; its premise is
never overstating what the data supports. Five screens are specified here — read
this file before the HTML; it carries the rules and the reasoning that the markup
cannot tell you.

1. **Landing page** — the front door. Today the app opens straight into a filter
   rail, which suits the daily user and disorients everyone else. The landing page
   states the argument, teaches the card grammar with one worked example, and
   hands off to the board.
2. **The board** (`/games`) — the real working surface behind the landing page's
   primary CTA. Full slate for a date, filter rail, prop rows grouped by game.
3. **Prop feed** (`/feed`) — a **redesign of an existing shipped screen**, not a
   new one. The live feed works but looks unfinished next to the other two: control
   clusters floating centered down the page, and green/red badges on rate cells that
   collide with the app's color rules. Functionality is preserved; the styling is
   brought onto the same system, and one new interaction is added (see "Draggable
   line" below).

4. **Games** (`/games`) — also a **redesign of a shipped screen**. Keeps the slate
   table but folds the gamecast in as an inline row expansion instead of a separate
   destination.
5. **Mobile** (390px) — feed, refine sheet, and prop detail. A redesign of an
   earlier mobile concept whose form graphs and colour use no longer matched the
   product.

**On the two "board" screens.** Screens 2 and 4 are two takes on the same slate,
built at different times: the board (2) groups prop rows under game headers behind
a filter rail; games (4) is a game-level table that expands into a gamecast. Both
are in the bundle deliberately — 4 is the newer, preferred direction for the games
route and supersedes 2's page chrome, while 2 remains the reference for the
prop-rows-under-a-game-header pattern. **Ask which one to build before starting
that route** rather than merging them on your own.

Desktop prop detail — the full player page behind a prop row — is implied
everywhere and designed only at mobile size. Do not invent the desktop version;
ask.

## About the design files

The `.dc.html` files in this bundle are **design references authored in HTML**.
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
Desktop is fixed-width at **1280px**; mobile is **390px** and covers three screens
(see Screen 5). Sizes between the two are not designed — ask before inventing
breakpoint behaviour.

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

### Logo — the palace mark

The mark is a **five-tower palace facade that is also a hit-rate chart**, built
from flat rectangles — no SVG illustration, no arches. It replaced an earlier
three-ascending-bars mark that read as data but not as a palace.

Three devices, all lifted from the product's own charts:

1. **Symmetric facade** — five towers stepping up to a central keep: short,
   medium, tall, medium, short.
2. **Solid vs. outlined** — towers that clear the line are solid green
   `#3ecf8e`; the two short wings that fall short are red `#ef5b5b`,
   **1.5–2px outline, no fill, no bottom border** — exactly the bar treatment in
   every form graph.
3. **The dashed line** — a white `--text` dashed rule crosses the whole mark just
   above the wings, extending ~3px past the towers on each side. The keep flies a
   **triangular pennant** (`clip-path: polygon(0 0, 100% 50%, 0 100%)`) on a mast
   rising from its top.

**The mark is a deliberate exception to the accent-retint rule.** It uses the
fixed status colours, so it does NOT change hue when a user re-tints their accent.
That was chosen knowingly: green + bars is read as "hit rate" before any word is,
and the mark is the one place the green/red pair is allowed to be identity rather
than data. Everywhere else the two rules stand unchanged.

Nav-size reference implementation (24px tall, mast and pennant overflow above):

```html
<span style="position:relative; display:flex; align-items:flex-end; gap:2px;">
  <span style="width:4px; height:9px; border:1.5px solid #ef5b5b; border-bottom:none; border-radius:2px 2px 0 0; box-sizing:border-box;"></span>
  <span style="width:4px; height:16px; background:#3ecf8e; border-radius:2px 2px 0 0;"></span>
  <span style="position:relative; width:4px; height:23px; background:#3ecf8e; border-radius:2px 2px 0 0;">
    <span style="position:absolute; left:1px; bottom:23px; width:2px; height:9px; background:#3ecf8e; border-radius:1px 1px 0 0;"></span>
    <span style="position:absolute; left:3px; bottom:26px; width:9px; height:6px; background:#3ecf8e; clip-path:polygon(0 0, 100% 50%, 0 100%);"></span>
  </span>
  <span style="width:4px; height:16px; background:#3ecf8e; border-radius:2px 2px 0 0;"></span>
  <span style="width:4px; height:9px; border:1.5px solid #ef5b5b; border-bottom:none; border-radius:2px 2px 0 0; box-sizing:border-box;"></span>
  <span style="position:absolute; left:-3px; right:-3px; bottom:11px; border-top:1.5px dashed #e8ecf2;"></span>
</span>
```

Display size doubles every dimension (9px bars → 4px wide at 22/38/56px heights,
2px dashed rule, 20×14px pennant). Build it once as a `<Logo size>` component
rather than pasting the spans. `PropPalace Logo Marks.dc.html` in this bundle
carries the full exploration and every rejected variant, with each shown at nav
size — read it before altering the mark.

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
- **Pedestal, not floor.** Every bar sits on an 8px pedestal (`height = 8 + value ×
  unit`) and the line is drawn on the same pedestal, so a zero-value game is still a
  visible 8px bar while every difference between values stays exactly to scale. Do
  not instead clamp short bars to a minimum height — that lies about the value and,
  with a low line, can push a miss above the line.
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

## Screen 3 — Prop feed (redesign)

**File:** `PropPalace Prop Feed.dc.html`. Width 1280px. This screen already exists
in the product; the task is to restyle it onto this system and add the draggable
line. **Every existing function must survive the redesign:** league tabs, slate
chips, market selection, over/under, games-counted window, main/alt lines,
Filters and Screens buttons, sortable rate columns, add-to-picks, and the My Picks
tray.

### What was wrong with the current screen

Three problems drove the redesign — fixing them is the point, so do not
reintroduce any of them:

1. **Scattered controls.** Sport tabs, game chips, a market dropdown, and four
   labelled control groups each sat centered on their own row, so the eye
   zig-zagged down 300px of chrome before reaching data.
2. **Green/red rate badges.** Every rate cell was a pill tinted green for a high
   rate and red for a low one. That directly violates the color rules: green and
   red mean *cleared the line* and *fell short*, nothing else. A green 70% badge is
   green meaning "good bet."
3. **A rate could contradict its own sample.** Caption and rate cells were fed by
   different sources and disagreed on the same 10-game window.

### Structure

**Header** — same nav, `PROP FEED` active. Below it, page title `Prop feed`
(Bricolage 34px) with the subhead "HIT RATES WITH THE GAMES BEHIND THEM · EVERY ROW
STATES ITS SAMPLE" in Space Mono `--text-2`, and a search field right-aligned
(280px, `--surface-1`, 4px radius) for players or teams.

**League tabs** — a real tab strip on a `--line` bottom border: NFL / MLB / NBA /
WNBA, Space Mono 13px `0.12em` uppercase, active in `--text` over a `2px --accent`
underline, inactive `--dim`. NBA carries a small `simulated` note in `--dim`.

**Filter card** — one `--surface-1` card, `1px --line`, 6px radius, replacing all
the floating clusters. Two bands:

- *Slate* band (own `--line` bottom border): a `SLATE` micro-label, then one chip
  per game — 20px crest slot + matchup + kickoff time — multi-select, selected chips
  taking a `--surface-2` fill and `--accent` border. An `ALL OF TODAY'S GAMES` link
  in `--accent-ink` clears the selection.
- *Controls* band: **Markets** as a full-width multi-select chip row (Hits, Total
  bases, Runs + RBIs, Strikeouts, Home run, Stolen base, Walks — MLB set; drive
  from data per league), with an `ALL MARKETS` link to clear. Then three segmented
  controls sharing one style (4px radius, `1px --line`, active segment solid
  `--accent` with `--accent-on` text): **Side** (Over/Under), **Games counted**
  (L5/L10/L20/ALL), **Lines** (Main line only / Show alt lines). `Filters` and
  `Screens` buttons sit right-aligned as outlined `--text-2` buttons.

Market selection is **multi-select** — this was a single-choice dropdown and was
explicitly changed. Empty selection = all markets.

**Result bar** — `Showing 9 of 353 props` in Space Mono, an active-filter pill in
`--accent-ink` outlined `--accent` summarizing the selection (`Hits + Total bases ·
Over`, collapsing to `3 markets · Over` past two), and the three-item form-graph
legend right-aligned.

### The table

**Column grid, header and rows:** `34px 262px 250px 88px 80px 1fr`, `gap: 14px`,
`padding: 16px`. Header strip is `--surface-sunken` with `6px 6px 0 0` radius:
`(add) / PROPOSITION / FORM · LAST 10 VS. LINE / LINE / ODDS /` then a nested
`repeat(4, 1fr)` of `L5 / L10 / L20 / SEASON`, each clickable to sort (arrow `↕`,
active `▾` in `--accent-ink`).

1. **Add** — 30px square, 4px radius, `+` in `--accent-ink` on a `--line` border;
   picked flips to a solid `--accent` fill with `✓` and increments My Picks.
2. **Proposition** — 38px circular headshot with the availability dot (none when
   unknown), then player name in **Bricolage Grotesque 600, 17px** (Archivo 500 was
   tried and rejected as unattractive here), team in Space Mono `--text-2`, the prop
   in Space Mono 12.5px uppercase `--text`, and the matchup in 10.5px `--dim`.
3. **Form** — the big interactive graph, below.
4. **Line** — the live line value in Space Mono 15px. Beneath it `+0.8 avg` in
   `--dim`; when the line has been dragged off-market this becomes `market 0.5 ·
   reset` in `--accent-ink` and clicking it restores the market line.
5. **Odds** — Space Mono 14px `--text-2`, using a true minus sign (−233).
6. **Rates** — four equal cells, 4px radius. Each: the percentage in Space Mono
   15px, a 3px `--line` track filled to the rate, and the sample (`7 of 10`)
   beneath in `--dim`. The cell matching the selected *games counted* window gets a
   `--surface-2` fill and `--line` border; the rest are transparent. A player
   without enough logged games reads `too few` over an empty track.

   **Rate colour is banded, and the figure and its track always agree:**
   `≥ 60%` green `#3ecf8e`, `≤ 45%` red `#ef5b5b`, in between `--text` with an
   `--accent-ink` track. This is the one place the status pair is used for a rate
   rather than a single game's outcome — the original feed did it, users read it
   fast, and it was kept deliberately. It still respects the underlying rule
   (green = clearing the line, red = falling short); it just aggregates. Do not
   extend the banding to anything that isn't a hit rate, and never use the accent
   to say good/bad.

**Foot** — `LOAD 24 MORE PROPS` outlined accent button beside the disclaimer:
"Real 2025 regular-season game logs. Not a live odds feed. Rates under 10 games
read 'too few', not a percentage."

**My Picks** — fixed bottom-right pill, solid `--accent`, with a white counter
badge showing the pick count.

### The row form graph — scaling and the draggable line

The feed's graph is the full-size treatment (60px bar row, `gap: 5px`, 54px
right gutter for the line tag) and it is **quantitatively scaled**, not decorative.
This took two passes to get right; both failure modes are worth stating:

- ❌ Heights as `offset + value × k` (e.g. `30 + v*10`). A 1-hit and a 3-hit game
  looked nearly identical and neither related to the line's position.
- ❌ Hit/miss tested as `value > 0`. Correct only for a 0.5 line; wrong for 5.5.

**Correct model** — one linear pixel scale per row:

```
PEDESTAL = 8                                  // px, keeps a zero-value game visible
scaleMax = max(max(gameValues), ceil(marketLine + 1))
unit     = (58 - PEDESTAL) / scaleMax         // px per stat unit
barHeight(v) = PEDESTAL + round(v * unit)
lineY        = PEDESTAL + round(lineValue * unit)   // same pedestal, same scale
cleared      = v > lineValue
```

The pedestal is added to the bars *and* the line, so it cancels out: differences
between values stay exactly proportional, and a 0-hit game reads as a short red
bar sitting below the line rather than as a 4px dash or missing data.

So bar height is the actual stat value, the dashed line sits exactly at the prop
line on the same axis, and the whole thing works unchanged for a 0.5 hits line or
a 5.5 strikeouts line.

**Draggable line — the new interaction.** The line tag is a drag handle
(`cursor: ns-resize`):

- Dragging it vertically moves the line, snapped to **half-values only** (0.5,
  1.5, 2.5 … — never a whole number, since a whole-number line can push), clamped
  to `0.5 … scaleMax − 0.5`. Drive it from `mousedown` + window-level `mousemove`/`mouseup`
  so the drag survives leaving the tag.
- Every bar **recolors live** against the new line: above it → solid green fill;
  at or below it → red 1.5px outline, no fill.
- The form caption and the **L5 and L10 rate cells recompute from the same game
  log**, so a user can ask "what if this were 1.5?" and watch the hit rate move.
  (L20 and Season come from a wider log than the graph holds — recompute them
  server-side against the dragged line rather than leaving them stale.)
- While off-market, the tag and its dashed rule switch to `--accent-ink` and the
  Line column reads `market 0.5 · reset`, so an adjusted row is never mistaken for
  the real number. Double-click the tag, or click that note, to reset.
- The line value shown on the tag is `toFixed(1)`.

Beneath the bars: the 2px trailing-run rule under the run of same-colored bars,
then the caption in Space Mono 12px — `8 of 10 · 3 straight` (or `· 3 cold` for a
miss run), colored green or red to match the run.

**Derive the caption and the L5/L10 cells from the same game-log array.** They
disagreed in an earlier build, which the content rules forbid outright.

---

## Screen 4 — Games (redesign)

**File:** `PropPalace Games.dc.html`. Width 1280px. A redesign of the shipped games
page, which worked but sat visually outside the rest of the product.

### What it keeps, and from where

From the **current shipped page**: the horizontal date strip with a per-day game
count, team records under each matchup, the league switcher, and search.
From the **2a concept**: the `MATCHUP / STATUS / PROPS WORTH A LOOK / RESEARCH`
table, the three row states (scheduled, live, final), and the footer disclaimer.
New: the gamecast, folded in as an inline expansion.

### Structure

**Header** — nav with `GAMES` active; page title `Games` (Bricolage 34px) with
`15 GAMES · FRIDAY, AUGUST 21` beneath in Space Mono `--text-2`; league chips
(MLB / WNBA / NFL) right-aligned, active chip solid `--accent`.

**Date strip** — full-width band between two `--line` rules. Each date is a
two-line cell: the date in Bricolage 17px (active in `--accent-ink` over a `2px
--accent` underline) above `FRI · 15 GAMES` in Space Mono `--dim`. Search sits
right-aligned in the same band.

**Table** — columns `300px 168px 1fr 128px`, `gap: 16px`, `padding: 16px 20px`;
`--surface-sunken` header, `--surface-1` body, 6px radius, `--line` between rows.

Row anatomy:
- **Matchup** — away and home in Bricolage 20px separated by a Space Mono `at`,
  with `75-53 · 79-49` records beneath in `--dim`.
- **Status** — scheduled shows the kickoff time in `--text-2`; **live** shows a
  green dot plus e.g. `TOP 6 · 3–4` in `--text`; **final** shows `FINAL 2–6` and
  the whole row drops to `opacity: 0.6`.
- **Props worth a look** — a plain sentence naming two or three props, `--text-2`.
- **Research** — `172 PROPS →` / `GAMECAST →` / `RECAP →` in `--accent-ink`
  (`--dim` on a final row).

Clicking any row toggles its gamecast; the live game is expanded by default and the
open row takes a `--surface-2` fill.

### The gamecast (inline expansion)

A `--surface-sunken` panel under the row, split `400px 1fr`:

**Line score** — a `--surface-1` card: innings 1–9 across the top with `R` and `H`,
one row per team, all Space Mono tabular. Innings not yet played are `·` in
`--dim`; the run total is `--accent-ink`. Beneath a `--line` rule: a green dot,
`TOP 6 · 1 OUT`, and the base state in `--dim`. Then the note *"Live game state.
Season hit rates below still count finished games only."* — this line is load-
bearing, keep it.

**Props in play** — one row per tracked prop: 30px avatar, player name in Bricolage
15px over `TEAM · POS`, the prop in Space Mono, then a **progress track**: an 8px
`--surface-2` well with a fill and a **vertical dashed `--text` marker at the
line's position** — the same device as the form graph, rotated. Fill is
`--accent` while short of the line and **green once cleared**. Under the track,
`1 of 0.5` on the left and the season rate with its sample on the right. A verdict
pill closes the row: `CLEARED` in green, or `NEEDS 1` in `--text-2` outlined
`--line`. `ALL 172 PROPS →` links to the prop feed.

Live progress and season hit rate sit side by side on purpose, and must stay
visually distinct — the live fill can be green because it is a settled outcome for
tonight; the season rate is banded separately (see Screen 3).

---

## Screen 5 — Mobile (390px)

**File:** `PropPalace Mobile.dc.html`. Three screens: **feed**, **refine sheet**,
**prop detail**. A redesign of an earlier mobile concept — two of its decisions were
wrong and must not come back:

- ❌ Ten **equal-height** squares as the form graph. Shows whether a game cleared,
  never by how much. Use the windowed graph at phone scale.
- ❌ A **green opponent-rank chip** (`#28` on a green fill). That makes green mean
  "favourable matchup" when green means *cleared the line*. The chip is now a
  neutral outlined box.

Every interactive target is **44px or larger**; phone shells are 390×844.

**Feed** — compact nav (mark + wordmark, 44px search, `21+`); league chips; a
filter-summary band on `--surface-sunken` showing `SHOWING 248 OF 2,421` over the
active filter sentence with a solid-accent `REFINE` button. Then prop cards, each:
38px avatar with availability dot, name in Bricolage 18px + team, the prop and its
odds, a right-aligned rate (banded, per Screen 3) over its sample, the form graph
with dashed line and line tag, and a meta row of `OPP RANK · matchup · streak`
with a 44px `+ ADD`. **One card must show the thin-sample state** — `TOO FEW` over
`4 games` with a one-line reason and no graph. A `MY PICKS` bar closes the screen.

**Refine sheet** — a bottom sheet over the dimmed feed (drag handle, `Refine`
title, `RESET`). Carries the desktop controls at touch size: multi-select market
chips, Side and Games-counted segmented rows, then minimum sample as **presets +
a 17-tick slider** with the live value in `--accent-ink` and the "props under N
still appear, without a rate" note. A full-width `SHOW 248 PROPS` button commits.
The sheet is `position: absolute; bottom: 0` — the phone shell needs an explicit
height or the sheet clips off the top.

**Prop detail** — back/watch bar; 56px headshot with availability dot beside
`LAR · WR · VS SEA 4:05 PM` and the name in Bricolage 30px; a row of market chips
(active solid accent). Then the verdict figure (Space Mono 60px `--accent-ink`)
beside `7 of 9 games / 2025 season`; the full form graph in a `--surface-1` card
with caption, average margin, and legend; a **The read** block on
`--surface-sunken` (`FAIR SAMPLE · LEANS OVER`, a three-segment confidence meter,
and one sentence of plain-language caveat); splits as label + bar + value rows
where a one-game split reads `TOO FEW` with an empty track and an explanatory
line; then `ADD TO MY PICKS` and the data disclaimer.

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
- **Player headshots and team crests** are placeholders in the mock, not real
  assets. Only the landing page's 92px hero headshot uses the `image-slot` drop
  component (prototype-only scaffolding — do not port it); every smaller avatar and
  crest is a plain `--surface-2` circle/square with a `--line` border, because the
  drop component's own placeholder chrome does not fit under ~64px. Wire all of
  them to the real asset source. Respect the availability rule: unknown → no dot.
- **No icon set** is used. The only mark is the three-bar logo, which is three
  `<span>`s — no SVG needed.

## Files

| File | What it is |
|---|---|
| `PropPalace Landing.dc.html` | Landing page design reference |
| `PropPalace Board.dc.html` | Board page design reference |
| `PropPalace Prop Feed.dc.html` | Prop feed redesign reference (incl. draggable line) |
| `PropPalace Games.dc.html` | Games redesign reference (incl. inline gamecast) |
| `PropPalace Mobile.dc.html` | Mobile: feed, refine sheet, prop detail (390px) |
| `PropPalace Logo Marks.dc.html` | Logo exploration — chosen mark plus rejected variants |
| `image-slot.js` | Prototype-only image drop scaffolding — do not port |

Every HTML file opens directly in a browser. Read them for exact values; read this
README for intent and for the rules that the markup alone can't tell you.
