# Handoff: PropPalace — complete v2 redesign

**This folder supersedes every earlier `design_handoff_*` folder in the repo.**
Delete `design_handoff_proppalace_full/`, `design_handoff_proppalace_redesign/`
and `design_handoff_propplace_landing_board/`. Their contents are either
superseded by the v2 files here or preserved in this README. Nothing in them is
still authoritative.

---

## ⛔ Stop-and-ask contract

Four decisions in this bundle are **not yours to make** — they are listed under
"Open questions" at the end of this README.

When you reach any of them: **stop, ask Alex, and wait for an answer before
writing a line of code for it.** Do not pick a default. Do not implement the
version described here and flag it afterwards. Do not skip the item and carry on
with the rest of the redesign as though it were done.

Everything else in this README is decided and you should build it without
checking in. These four are the exceptions, and they are exceptions because each
one either changes product surface that does not exist yet or edits a shipped
constant. Guessing on them costs more to unwind than asking costs to resolve.

---

## Overview

PropPalace is a sports-prop **research** tool. It sells no picks. Its premise is
never overstating what the data supports, and most of the rules below exist to
protect that.

This bundle is the **v2 design system applied to every screen in the product**.
v1 mocks are gone; there is exactly one current design per screen.

| Screen | File | Repo files it replaces the design of |
|---|---|---|
| Landing | `PropPalace Landing v2.dc.html` | `src/LandingPage.jsx` |
| Games | `PropPalace Games v2.dc.html` | `src/GamesPage.jsx`, `src/GamecastPage.jsx` |
| The Board | `PropPalace Board v2.dc.html` | `src/BoardPage.jsx` |
| Prop Feed | `PropPalace Prop Feed v2.dc.html` | `src/PropLedger.jsx` (feed), `src/FeedPresets.jsx` |
| News | `PropPalace News v2.dc.html` | `src/NewsPageRedesign.jsx` |
| Settings | `PropPalace Settings v2.dc.html` | `src/SettingsModal.jsx`, `src/ColorWheel.jsx` |
| Player detail — NFL | `Player Detail NFL v2.dc.html` | `src/MatchupPage.jsx` |
| Player detail — MLB | `Player Detail MLB v2.dc.html` | same, MLB config |
| Player detail — NBA | `Player Detail NBA v2.dc.html` | same, NBA config |
| Player detail — WNBA | `Player Detail WNBA v2.dc.html` | same, WNBA config |
| Matchup card (variant) | `Player Detail v2 - Matchup Card.dc.html` | optional overlay, not a route |
| Mobile — 390px | `PropPalace Mobile v2.dc.html` | `src/index.css` narrow blocks |

**Games and The Board are two different screens.** Games is the live slate —
scores, linescores, gamecast state. The Board is research by matchup — form
graphs and verdicts, no live state. They were nearly identical in v1; that was
the bug, and the split is deliberate.

---

## About the design files

The `.dc.html` files are **design references authored in HTML** — prototypes
showing intended look and behaviour, not production code to copy. The task is to
**recreate them in this codebase's own environment**: React with its existing
stylesheet, tokens and component patterns.

Do not port the HTML. Do not port `image-slot.js` or `support.js` — prototype
scaffolding only.

**Every number in these mocks is invented** — game logs, defensive ranks, usage
figures, rosters, records. Season lengths and league sizes are real. Replace all
values from live data.

## Fidelity

**High-fidelity.** Colours, type, spacing and geometry are final. Recreate them
using the codebase's existing tokens (`src/index.css`), not by copying hexes —
the mocks use literal hexes only because they can't read the stylesheet.

---

## Design tokens

Read from `src/index.css`. The mocks' literals map as follows:

| Mock hex | Token |
|---|---|
| `#0a0b0d` | `--bg` |
| `#131519` | `--surface-1` / `--panel` |
| `#191c21` | `--surface-2` / `--panel2` |
| `#0d0f12` | `--surface-sunken` |
| `#2b2f36` | `--line` |
| `#e8ecf2` | `--text` |
| `#aab2c0` | `--text-2` |
| `#8b98ab` | `--dim` |
| `#3b5bdb` | `--amber` (the accent; user-settable) |
| `#8fa6ff` | `--amber-ink` |
| `#ffffff` on accent | `--accent-on` |

**Type:** Bricolage Grotesque 600 (`.pp-display`) for headings; Archivo 400–600
for body; Space Mono with tabular figures (`.pp-mono`) for every number and
micro-label. Micro-labels are 10–13px uppercase at 0.10–0.16em tracking.

**Geometry:** cards 6px, chips 4px, pills 999px, 1px `--line` borders, flat — no
shadows or gradients except `--shadow-3` on fixed mobile furniture.

### The four colour families — keep them disjoint

This is the constraint most easily broken, and it took several passes to get
right. Four families, no shared hexes:

1. **Outcome** — `--pos #3ecf8e` cleared, `--neg #ef5b5b` fell short. In v2 the
   solid green renders `#2faa72` for contrast on dark. Fill = cleared, 1.5px
   outline = fell short. Never anything else.
2. **Availability** — literal hexes by design, never the accent:
   `--status-available #3ecf8e`, `--status-questionable #e8b13a`,
   `--status-out #ef5b5b`. A player is not more out in light mode.
3. **Game state** (Games, Mobile) — cyan `#22c9d6` live/halftime, lapis
   `#8fa6ff` starting soon, hollow lapis scheduled, violet `#9b8cf0`
   delayed/suspended, white `#e8ecf2` final. Rendered as **squares**, so shape
   also separates them from outcomes. Amber is deliberately *not* used here.
4. **Sport identity** — low-chroma neutrals: MLB `#8a8f7a`, NFL `#9a8072`,
   NBA `#7f8a9a`, WNBA `#93808f`. These collide with no state hex and no accent
   preset. Team crest tones are similarly desaturated so a club's red or green is
   never mistaken for an outcome.

**Accent presets** (`src/ColorWheel.jsx` `ACCENT_PRESETS`) need updating: Green
`#22c55e` and Red `#ef4444` sat within ~10° of the outcome pair. The mocks use
Lapis `#3b5bdb`, Teal `#14b8a6`, Gold `#c9a24a`, Rust `#c2622d`, Violet
`#8b5cf6`, Magenta `#d6409f` — six distinct hue families, none near an outcome.

---

## The form graph — the signature component

Build once, reuse at five sizes. `src/FormGraph.jsx` already owns this; the
changes below are what v2 adds.

### The model

One bar per game, **grounded at zero**, so bar height is the actual stat value.
A **dashed rule** crosses at the prop line, so height reads as distance from it.

**Windowed axis** — the important part:

```
lo      = min(min(values), line)
hi      = max(max(values), line)
span    = max(hi - lo, 1) * 1.25
axisMin = lo - max(hi - lo, 1) * 0.18
y(v)    = PEDESTAL + round(((v - axisMin) / span) * (H - PEDESTAL))
cleared = v > line            // never v > 0
```

Without the window, a 104.5-yard line sits at the top of a 0–164 axis and every
bar looks identical. Two failure modes to avoid, both shipped and fixed:

- ❌ `offset + value * k` heights — a 1-hit and a 3-hit game look the same.
- ❌ testing `value > 0` — correct only for a 0.5 line.

### Fixed slots

The bar row is a **fixed-column grid** (`repeat(10, 1fr)`), not `flex: 1` per
bar. With flex, a four-game sample renders bars 2.5× wider than a ten-game one,
making the thinnest sample the loudest thing on screen. The shortfall stays
visibly empty with a `no games yet` label and a dashed divider, and the line
stops at the last real game.

### Sizes

| Context | Height | Pedestal | Extras |
|---|---|---|---|
| Landing hero | 120px | 16 | line tag, per-game values, run rule, caption, legend |
| Player detail | 224px | 30 | values in bar feet, opponent dots + dates, column bands |
| Prop feed row | 52–60px | 10 | draggable line tag |
| Board card | 64px | 12 | dashed line only |
| Mobile feed | 52px | 10 | line tag |

Beneath the bars: a 2px **trailing-run rule** under the run of same-coloured
bars, then a caption — `7 of 9 · 1 straight` — count first, coloured to the run.

### Draggable line (Prop Feed)

The line tag is a drag handle (`cursor: ns-resize`). Dragging snaps to
**half-values only** — never a whole number, since a whole line can push —
stepping 0.5 / 1 / 5 by market magnitude, clamped to the axis. Every bar
recolours live, and the caption plus L5/L10 recompute **from the same game log**.
While off-market the tag and rule turn `--amber-ink` and the Line column reads
`market 5.5 · reset`; double-click resets.

---

## Content rules — not stylistic

A build that breaks these is wrong even if it matches pixel-for-pixel. These are
CLAUDE.md's rules restated with what v2 adds.

1. **Every rate states its sample.** Never `78%` alone — always `78% · 7 of 9`.
   Counts first. Splits read `80% (4/5)`.
2. **One source of truth per fact.** Hits, sample, percentage, streak and average
   all derive from the same game-log array. This was violated twice in mocks —
   a hero reading `7 of 9` above a ten-bar graph reading `9 of 10`, and board
   rows with hard-coded `hit`/`of` beside derived bars. Both were the same bug:
   two sources for one number. **Derive, never type.**
3. **Thin samples get a verdict, not a number.** Under ten games print `too few`
   or `TOO FEW`. The row keeps its place — a minimum sample is a *display*
   threshold, never a filter. Nothing is silently dropped.
4. **Availability: unknown = no dot.** Never grey, never defaulting to green.
   The dot renders only where a real feed exists — today MLB.
5. **Live production is not a rate.** A Games "props in play" bar is tonight's
   production; it stays neutral until it passes the line and counts toward a hit
   rate only when the game is final.
6. **Per-league denominators.** Defensive rank is `#N of TEAMS` where TEAMS is
   32 NFL, 30 MLB, 30 NBA, **15 WNBA** — and rank is per **market**, not per
   team: Seattle can be #27 against receptions and #6 against rush yards.
7. **One data disclaimer per surface.** "Real game logs, regular season and
   playoffs. Not a live odds feed."

---

## Layout system

**Desktop is fluid, not fixed:**

```css
width: 100%; min-width: 1280px; max-width: 1600px; margin: 0 auto;
```

Body grid `196px minmax(0, 1fr) 196px`, gap 20px — **rails fixed, centre column
absorbs extra width**, so a wide monitor buys wider bars rather than margin.
News uses `minmax(0, 1fr) 372px` per its own source.

**Grid tracks need real floors.** `minmax(0, Nfr)` lets a track collapse below
min-content, and `nowrap` children then spill into the next column. Every table
track carries a px minimum, and wide tables scroll inside their own wrapper.

**Every value in a compact row is `white-space: nowrap`**, cells get
`min-width: 0`, and cells holding dates or long labels get a wider `flex` basis.
Omitting any one of the three re-breaks the row.

**Touch targets declare their height.** Padding alone leaves height line-box
driven with `min-height: auto`, which produced 28–43px controls repeatedly. Use
`min-height: 44px` + `display: flex` + `align-items: center` +
`box-sizing: border-box`.

---

## Screens

### Landing — `PropPalace Landing v2.dc.html`

Reconciled against `src/LandingPage.jsx`. Eyebrow is season-agnostic ("Real
season logs · no picks sold"). H1 in three explicit lines. A rules strip of three
cells — how we count / thin samples / margin not just hits — replacing a cut
stat block; **do not reintroduce the stat block**.

Hero card is a real row or an empty state, never a mock. Its split rows are
**windows with their own samples** (Last 5 / Last 20 / Season), and a window
under ten games prints `too few`. Verdict tier derives: 25+ games Strong, 10+
Fair, else Thin. Board teaser is four cards, **one deliberately a thin sample**
so the page demonstrates the rule it asserts.

**Intro routing.** The wordmark always goes to `display.startPage`, never back
here. `/` renders the intro only while
`propPalaceTour.dismissed` is false — the **existing** first-run state from
`docs/ACCOUNTS_SUBSCRIPTION_TUTORIAL.md`, not a new flag. It flips when someone
opens the board, not when the page renders. Reachable afterwards from
`How we count` and Settings → Tutorial.

### Games — `PropPalace Games v2.dc.html`

Built on `src/lib/gamesData.js`: `GAME_STATUS`, `statusSortKey`,
`isActiveStatus`, `opensGamecast`, and the normalized linescore shape
`{ columns[{key,label,total}], rows[{abbr,cells}] }`.

Games group under **labelled sport dividers** with a ball glyph and count —
an MLB card and an NFL card in one stack is a real misread. Sorted live-first
within each group. Each card is a two-line score block with state, then an
expandable gamecast.

**Linescore is per sport, not one shape relabelled.** MLB: innings + R/H/E, base
diamond, count, at-bat. NFL: quarters + T, possession, down and distance. NBA/
WNBA: quarters + T. Overtime adds OT1. **A period not yet played renders blank,
never 0.** Then Decisions (MLB, final only) and Leaders, in
`GamecastPage.jsx`'s order. Nothing is synthesized — if a provider has nothing,
the section says so.

### The Board — `PropPalace Board v2.dc.html`

Slate-first. Each game card shows its **three strongest samples** with rate,
sample, form graph and verdict pill; `All N props →` hands off to the feed. Rails
do slate work only: league counts, sort by kickoff / most props / strongest
sample, filter by lineup state. Verdict pills — Leans over / Leans under / Coin
flip / Too few — ride the accent, never green or red.

### Prop Feed — `PropPalace Prop Feed v2.dc.html`

Seeds from `src/settings.jsx` `DEFAULTS`: `betting.sampleWindow` sets the
window, `betting.lean` the side, `display.oddsFormat` the prices. The Filters
button counts controls away from **the store's defaults**, not page-local ones.

Odds via `src/odds.js` `formatOdds` — American internally, converted only at
display, U+2212 minus. Minimum sample matches `src/MinSampleControl.jsx`: 17
ticks, `MIN_SAMPLE_ALL = 1`, `DEFAULT_PRESETS = [5, 9, 12]`, save/remove with
`stopPropagation` on the ×, and its exact copy.

Rate cells band at **65% / 45%** — green / neutral / red — with the sample under
every figure. Thin cells read an em dash over `too few`. Each row states the
defence's per-market rank and a one-word read: easy / mid / tough.

### News — `PropPalace News v2.dc.html`

Built on `src/NewsPageRedesign.jsx`. Feed + 372px rail, breakpoint
`TWO_COLUMN_MIN = 900`. Lead item on `--surface-2` with a TOP STORY tag and a
68px avatar; the action column is `{!lead && action}` — **the lead's grid has
only two tracks**, so a badge there wraps. Filters are All / Watching /
Injuries; **no "Line moves"** — the app keeps no line history and a filter that
can never match is worse than an absent one.

AFFECTS chips never show a rate without its count. Items without player
attribution still render, minus avatar and AFFECTS. Rail carries the injury wire
and watchlist-moved cards.

Avatars use `src/PlayerAvatar.jsx` + `src/lib/teamColors.js`: the ring is
`teamAvatarBackground` — a darkening overlay over a diagonal blend of two
`neonizeColor`-ed brand hexes, resolved **per sport** because abbreviations
collide across leagues. Dot is `max(9, round(size * 0.27))` with a 2px border
(3px at size ≥ 60) punching through the `surface` prop. `StatusPill` is square-
cornered, 10.5px, `5px 9px`, `st.dot` over `st.border`, labels ACTIVE / QUEST /
OUT.

### Settings — `PropPalace Settings v2.dc.html`

Built on `src/SettingsModal.jsx`: 220px rail with a 3px accent border on the
active item, four sections — Display, Betting, Account, About.

Display is the two-up grid: theme, reduce-motion, accent explainer left; the
220px colour wheel, lightness slider, six `ACCENT_PRESETS` as 26px circles, hex
readout and "· LAPIS, THE DEFAULT" caption right. Then odds format with a live
"+150 and −180" sample, display size, and the eight `TIME_ZONES`.

**New in v2 — outcome colours are user-settable, independently of the accent.**
`display.statusPalette` plus optional `display.posColor` / `negColor`. Five
preset pairs (green/red, blue/orange, teal/magenta, high contrast, no-hue) and
two colour wheels. Offered as **pairs** because two independent pickers let
someone choose two hues 15° apart and break every chart. A collision warning
fires when the accent lands near an outcome, or the two outcomes near each
other — it names the problem rather than blocking the choice. Fill-versus-outline
still carries the meaning at any hue.

About holds Community, the 15-term glossary in four collapsible groups, the
Tutorial section (guided-walkthrough restart, start page, the intro entry), and
the two reset buttons.

### Player detail — four league files

Fluid `196px minmax(0,1fr) 196px`. Matchup band with crests, records and
kickoff; a four-cell context row (`{OPP} ALLOWS`, `MATCHUP` rank + word,
`LAST MEETING`, conditions); player header with 72px headshot, name in Bricolage
46px, jersey number in team colour, status pill, usage pills and a role
paragraph; market tabs + a FILTERS button; verdict row; the 224px graph; rosters
in the rails.

**Filters panel** holds the window row (each selector showing its own rate and
sample from the **full** log, so buttons can't move each other), a **notched**
sample-size slider — named stops, because one game in 162 is an invisible step —
and the **lineup filter**: roster tiles, four per page with paging, cycling
neutral → require (green, WITH) → exclude (red, W/O). A neutral tile shows that
player's effect on the market average. Tiles are tagged TEAM or OPP —
**opponent absences matter as much as teammates'**.

| League | Season | Stops | Default | Teams |
|---|---|---|---|---|
| NFL | 17 | L5 / L10 / All | Season | 32 |
| WNBA | 44 | L5 / L10 / L20 / All | L20 | 15 |
| NBA | 82 | L5 / L10 / L20 / L40 / All | L20 | 30 |
| MLB | 162 | L5 / L10 / L20 / L40 / L80 / All | L20 | 30 |

Split buttons derive from the same stop list, so no page offers a window longer
than its season. Market sets, usage vocabulary and context facts are per league —
snaps/routes/target share/aDOT for NFL, minutes/usage/shots/FT-rate for
basketball, batting order/PA/hard-hit/barrel for MLB.

Also from `src/LogScope.jsx`: season / games-counted / team scoping, with each
option carrying the count it would yield, `season` defaulting to the newest
present, and playoff games marked with a neutral `PO` tag.

### Mobile — `PropPalace Mobile v2.dc.html`

Four 390px screens: games slate, prop feed, filters sheet, player detail.

The **sheet** follows `src/FeedPresets.jsx` exactly: saved-screen cards with
DEFAULT badge and Share / Set default / Rename / Delete, a "Save this screen"
field with the live filter set as k/v chips, and a pinned `SHOW N PROPS` footer —
placed `16px 16px 0 0`, `max-height: 92vh`,
`padding-bottom: max(12px, env(safe-area-inset-bottom))`.

The player screen pins `.mobile-player-strip` from `src/index.css`:
`position: fixed`, z-2500, `padding: 8px 10px` +
`max(8px, env(safe-area-inset-bottom))`, `--panel` ground, 1px `--line` top
border, `--shadow-3`, a 52×52 Lineup button (10px radius, accent border,
`--amber-dim` fill, 9.5px uppercase) and a scrolling switcher with 1px dividers.
**There is no bottom tab bar and no My Picks FAB in `index.css`** — do not add
one. `.page-shell--mobile-nav` reserves 84px.

Market tabs follow `.market-bar--underlined .tab`: Space Mono, 11px at ≤480px,
0.04em, uppercase, `padding: 12px 6px 10px`.

**Three narrow breakpoints upstream, not one** — `useIsNarrow(560)` Prop Feed,
`720` Games, `1100` MobilePlayerNav, `900` News. These mocks show the fully
collapsed end; nothing between 390 and 1280 is designed.

---

## Interactions

Implemented in the mocks: market/league/state filters, sortable rate columns,
draggable prop lines with market reset, add-to-picks, expandable gamecasts,
date stepping, lineup include/exclude, notched sliders, accent and outcome
pickers, settings tabs, glossary groups.

Specified, not built: hover states (rows fill `--surface-2`), row click → player
detail, real `<input type="range">` behind the slider visuals, live polling on
20s with a hidden-tab pause (per `GamecastPage.jsx`), skeleton rows that never
render a rate before its sample, and empty states that name the responsible
filter.

## State

```
display:  theme, accentColor, oddsFormat, uiScale, timeZone, reduceMotion,
          statusPalette, posColor, negColor, startPage
betting:  defaultSport, sportsbook, bankroll, unitSize, unitMode, unitPercent,
          defaultStake, sampleWindow, lean
feed:     selectedMarkets[], minGames, samplePresets[], side, lineMode, sort,
          adjustedLines{}, picks[]
player:   market, window, scope, lineupState{name: 'with'|'without'}, rosterPage
games:    date, league, stateFilter, openGameId
```

`display.*` and `betting.*` live in the versioned `propPalaceSettings` object,
which back-fills new keys for existing users. Sample presets persist under
`propPalaceSamplePresets`. First-run state is `propPalaceTour`.

## Assets

- **Fonts** — Bricolage Grotesque, Archivo, Space Mono (Google Fonts).
- **Crests and headshots** are monogram placeholders in the mocks. Wire to
  `teamLogo(sport, abbr)` and `PlayerAvatar`'s source chain.
- **No icon set.** The only mark is `PalaceMark` — three ascending bars with a
  pennant, already shipped in `src/PalaceMark.jsx` and matching `GEOM.nav`
  value-for-value in these mocks. Its green is `#3ecf8e` and must not vary per
  page. No change needed.

## Files

| File | What it is |
|---|---|
| `PropPalace Landing v2.dc.html` | Landing / intro |
| `PropPalace Games v2.dc.html` | Live slate + gamecast |
| `PropPalace Board v2.dc.html` | Research board |
| `PropPalace Prop Feed v2.dc.html` | Prop feed |
| `PropPalace News v2.dc.html` | News |
| `PropPalace Settings v2.dc.html` | Settings |
| `Player Detail NFL v2.dc.html` | Player detail — NFL (reference build) |
| `Player Detail MLB v2.dc.html` | Player detail — MLB |
| `Player Detail NBA v2.dc.html` | Player detail — NBA |
| `Player Detail WNBA v2.dc.html` | Player detail — WNBA |
| `Player Detail v2 - Matchup Card.dc.html` | Optional shareable-card overlay |
| `PropPalace Mobile v2.dc.html` | Mobile, 390px, four screens |
| `support.js`, `image-slot.js` | Prototype runtime — **do not port** |

All open directly in a browser. Read them for exact values; read this README for
intent and for the rules the markup alone can't tell you.

## Open questions — STOP HERE AND ASK

**Do not advance past any of these without an answer from Alex.** See the
stop-and-ask contract at the top of this file.

1. **Matchup card.** `Player Detail v2 - Matchup Card.dc.html` is an optional
   shareable-card overlay, not a route, and it was paused mid-design. Ask
   whether to build it at all before wiring anything to it.

2. **Accent presets.** The mocks replace two of the six `ACCENT_PRESETS` in
   `src/ColorWheel.jsx` — Green `#22c55e` and Red `#ef4444` sat within ~10° of
   the outcome pair, so an accent could be mistaken for a hit or a miss. The
   proposed six are Lapis, Teal, Gold, Rust, Violet, Magenta. This edits a
   shipped constant that existing users have already picked from, so ask before
   changing it.

3. **Outcome-colour setting.** `display.statusPalette` plus optional
   `display.posColor` / `negColor` is **new product surface**, not part of a
   redesign — it makes cleared/fell-short user-configurable for accessibility.
   Ask whether it is wanted before adding keys to `DEFAULTS.display`.

4. **Intro routing.** The landing page assumes `propPalaceTour` first-run state
   and a `display.startPage` preference. Both are specified in
   `docs/ACCOUNTS_SUBSCRIPTION_TUTORIAL.md`, which is marked **"Status: not
   started"** — neither exists on master. Ask how to sequence this: build the
   landing page without gating, or wait for the tutorial track.
