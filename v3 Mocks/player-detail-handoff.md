# Player Detail — implementation handoff

Design: `PropPalace Desktop v3.dc.html` (1a) and `PropPalace Mobile v3.dc.html`
(frame 1c). This document names the components, the rules behind every control,
and the single source each value comes from.

Read this before the mock. Most of the review cycles on the design were spent on
one class of bug: the same fact stated in two places, computed two ways, drifting
apart. Every rule below exists to prevent one of those.

---

## 1. The one rule that matters

**One log, one line, one place.**

Every rate, count, caption, bar, ladder rung and split cell on this page
describes the same array of games graded against the same line. Nothing is
authored twice. If two elements can disagree, one of them is wrong by
construction, not by accident.

The pipeline, in order:

    full log (season, per player, per market)
      → teammate / opposing-lineup filter   (participation predicate)
      → workload filter                     (minutes / snaps / plate appearances)
      → split                               (season | home | away | last 3 | vs starter)
      → window                              (L10 | L20 | L30 | Season | custom | H2H)
      → zoom                                (desktop only, a slice of the above)
      → the plotted series

Every consumer reads the output of that pipeline. The graph, its caption, the
splits strip, the alt-line ladder, the implied price and the hero's own stat all
take the same array.

Two consequences worth stating because both were bugs during design:

- A window is a **tail slice**, never a head slice. `log.slice(-n)`. Slicing from
  the front plots the oldest games while the date labels say the newest.
- The **plotted market's** per-game average is computed. The other per-game
  figures (H/G, REB/G, 3PM/G) are published rates, not derived — points cannot
  be divided into rebounds.

---

## 2. Layout

Desktop, 1440 wide:

    ┌───────────────────────────────────────────────────────────┐
    │ nav                                                       │
    ├───────────────────────────────────────────────────────────┤
    │ breadcrumb: ← feed | subject | game ▾ (centred) | + watch │
    ├──────────┬─────────────────────────────┬──────────────────┤
    │ filter   │ hero + graph + splits +     │ context rail     │
    │ rail     │ context blocks + ladder     │                  │
    │ 236px    │ 1fr                         │ 268px            │
    └──────────┴─────────────────────────────┴──────────────────┘

Mobile, 430 wide: the rails fold. The filter rail becomes chips on a sticky
control bar, each opening only its own sheet; the context rail's roster becomes
a bottom-docked strip.

**Grid rule.** The centre column is a grid item that scrolls. It needs
`min-height: 0; overflow: hidden` with the shell on `grid-template-rows:
minmax(0, 1fr)`, and its children need `flex: 0 0 auto`. Without both, the
column's min-content height sizes the row, the frame overflows, and the last card
is clipped with nothing to scroll.

---

## 3. The graph

Geometry comes from `FormGraph.jsx`. Do not re-derive it.

    FORM_SIZES.player = { height: 224, pedestal: 30, gap: 6, gutter: 54 }
    FORM_SIZES.feed   = { height: 60,  pedestal: 10, gap: 5, gutter: 54 }
    FORM_SIZES.board  = { height: 64,  pedestal: 12, gap: 4, gutter: 44 }
    FORM_SIZES.mobile = { height: 52,  pedestal: 10, gap: 4, gutter: 42 }
    MIN_SLOTS = 10

**The container must be the height the table specifies.** Scaling against one
height inside a shorter box pushes the bars past the row — the grid rows are
auto, so nothing clamps them.

### Axis

Margin over and under the line, not a zero baseline:

    lo   = min(line, ...vals)
    hi   = max(line, ...vals)
    pad  = max((hi - lo) * 0.18, 0.6)
    axisMin = lo - pad
    span    = (hi + pad) - axisMin
    y(v)    = pedestal + round(((v - axisMin) / span) * (height - pedestal))

The line is inside both bounds on purpose: a line outside every game's range
still has to be drawable inside the plot. The 0.6 floor stops a flat row from
dividing by zero.

The trade is deliberate and worth repeating to anyone who questions it: bar
height is no longer proportional to the stat, so a 3-hit game is not visibly
three times a 1-hit game. What it buys is that margin over and under the line is
legible in every market — a 257.5 passing-yards prop and a 1.5 receptions prop
read identically. Zero-basing spends the whole plot on axis nobody's games
occupy.

### Bars

- **Hit** — solid green `#3ecf8e`, all four corners rounded.
- **Miss** — closed red outline `1.5px #ef5b5b`, transparent fill. Closed, not
  open-bottomed: an open box reads as a bar running off the frame.
- **Zero** — no bar at all. A red `0` numeral in its place. An outline at zero
  height reads as a value.
- **Empty slot** (fewer games than slots) — a 2px neutral stub, never a bar.
- Value printed **inside** the bar, near-black on green, red inside a miss.

### Line handle

A tab in the gutter, dragged freely, landing on rungs:

- **Half points only.** `round(v - 0.5) + 0.5`. Books post half points; a whole
  number is never a rung.
- Step is 1, or 5 when the top value is ≥ 100.
- Ceiling is `max(vals) + step` — one step of headroom, so the reader can ask
  "what if it were higher than he's ever gone" and see every bar go red.
- The dashed white rule and the handle share one origin with the bars. If the
  column has a gap between the bar and its labels, the rule's offset must
  include it or the line reads a few points low.

### Labels under each column

All-or-nothing per kind, gated on **measured** column width:

| Label | Shows at |
| --- | --- |
| value | ≥ 18px |
| opponent crest | ≥ 20px |
| opponent abbreviation | ≥ 34px |
| date | ≥ 44px |

A kind that fits for some columns and not others is the overlap the desktop
graph shows at 100 games. Compute the width, apply to all or none.

Away games read `@ BAL` — the `@` in the sans face (Archivo), accent coloured,
with its own spacing. The mono at-sign is illegible at 10px and reads as a
lowercase a. Team abbreviations stay mono so they align.

### Interactions

- **Click a bar** → detail card over the page: date, opponent crest, home/away,
  over/under pill, the stat against the line, the full box score for that game,
  and a "that night" block — days rest, lineup slot or starter status, which
  teammates and which opposing players were out. × or backdrop closes.
- **Hover** → a hint that a click opens the card. Not a data tooltip; the card
  carries the data.
- **Drag across the plot** (desktop only) → zoom to that run of games. Escape or
  a Reset chip returns to the window. Needs `user-select: none` on the track and
  `preventDefault` on pointerdown, or the browser paints its own text selection
  over the graph.
- **← →** step the line one rung. **Escape** clears the zoom.

---

## 4. Controls

### Season

`2026 | 2025`, above Window. A season is a different sample, not a longer one.
MLB, NBA and the WNBA carry a prior season; the NFL does not.

### Window

Per sport, because season length decides what a window means — 162 games make
"last 18" meaningless and 17 make "last 30" impossible:

| Sport | Windows | Default |
| --- | --- | --- |
| MLB | L10, L20, L30, Season | L10 |
| NFL | L3, L5, L10, Season | L5 |
| NBA | L5, L10, L20, Season | L10 |
| WNBA | L5, L10, L15, Season | L10 |

Plus **H2H**, which plots the finished meetings with tonight's opponent and
ignores the window entirely.

Plus a **custom** stepper (2–162) with two buttons:

- **Apply** — selects it for this session only.
- **Save** — selects it *and* adds it to the pill row for later.

Switching league re-bases the window: the old value may not exist in the new
sport's set.

### Splits

**Exclusive**, one at a time — two at once would recompute the rate over an
intersection nobody asked for. Radio, not checkbox.

Season · Home only · Away only · Last 3 games · vs this starter/defense.

A split recomputes the rate **and** its sample together. When the window is H2H,
splits do not apply: dim the rail and drop the split from the graph title rather
than claiming one is active.

The synthetic-data trap, for whoever writes fixtures: if the home/away flag
repeats on a period that divides the value array's length, one half of the split
samples the same few values forever and reads 100%. Use coprime periods.

### Teammates and opposing lineup

Two lists, same three-state card: **ANY → WITH → W/O**, cycling on click. Green
for with, red for without. Each card shows how many games survive its own filter,
counted before the window and split are applied. Under five games surviving,
warn — shown and marked thin, never hidden.

Teammates is the player's own roster. Opposing lineup is the full opposing unit —
a starting five plus the closers, or a posted batting order plus the starter — not
a sample of it. Opponent picks are marked with `*` in the graph title.

Available in every sport. It matters most in the NFL, NBA and WNBA; it is rarely
useful in baseball, but nothing blocks it there.

**This is the only control with a data prerequisite.** It needs a per-game
participation record — for each game, the set of active player ids on both sides.
See `participation-data-check.md`. Where that record does not exist, limit the
control to the seasons where it does and say so on the control. Never show a
filter whose count cannot be trusted: a wrong sample size reads as a finding.

### Workload

One slider, labelled per sport: **MINUTES** (NBA, WNBA), **SNAP %** (NFL),
**PLATE APPEARANCES** (MLB). Two handles for a range, a "use single value" toggle
that collapses to one handle acting as a floor, and **Any** as the default so all
games show until the reader asks for fewer.

### Markets

The full list per sport, combos included. MLB: Hits, Runs, RBIs, H+R+RBI, Home
Runs, Total Bases, Walks, Strikeouts, Stolen Bases. Basketball adds Pts+Reb,
Pts+Ast, Reb+Ast, Pts+Reb+Ast, Stl+Blk, Free Throws, FG Made, Double Double.

---

## 5. Everything else on the page

### Hero

`Name #99`, team crest beside the abbreviation, then chips: availability, lineup
slot, workload rate, and the sport's own quality markers (hard-hit / barrel / K%
for baseball, usage / TS% / 3PA for basketball).

Identity holds a **330px minimum** and does not wrap. When a new block is added
to that row, the identity column must not be the flexible one — otherwise the
name and chips absorb the whole cost and the header collapses.

Per-game averages sit in their own strip: the plotted market's average computed
from the log, the rest stated per stat.

The three-cell card reads **LINE / IMPLIED / MATCHUP**. Not hit rate — the rate
appears under the graph and in the splits strip, and a third copy contradicted
both. Implied is the window's rate as American odds, the same conversion
`odds.js` uses, and it moves with the dragged line.

### Splits strip

Six cells: L5, L10, L20, Season, Home, Away. All from the same log and line. On
an H2H window the strip becomes meetings / hit rate / average instead.

### Alt-line ladder

The table from `AltLineLadder.jsx`, unchanged in structure: LINE, HIT RATE, GAMES
OVER, SHAPE, PRICE, + ADD LEG. Main line marked with the accent rail. Every rung
counted over the same games — never modelled, never interpolated from its
neighbours. Prices are each rung's own rate converted to American odds, and a
rung the sample never split shows no price at all. Say so, because the column
looks exactly like a book's and is not one.

### Conditions

Outdoor: temperature, wind with its compass direction, sky, precipitation,
humidity, then a park-and-air effect breakdown with signed bars. Wind is the
compass reading the forecast reports, not a field-relative claim — turning "220°
at 12 mph" into "blowing out to right" needs 32 hand-entered stadium bearings and
32 chances to state a tailwind as a headwind.

Indoor: say so and draw nothing.

The park-effect block is a disclosure, collapsed by default.

### Injuries

Split by team, each with its crest and a count. Availability colours are literal:
green `#3ecf8e` available, amber `#e8b13a` questionable, red `#ef5b5b` out,
unknown draws no dot. Never `--amber`, which is the user's accent.

---

## 6. Assets

Crests come from ESPN's CDN through the same lookup `lib/gamesData.js` already
uses: `teamLogo(sport, abbr)`. **The sport travels with every logo reference.**
`cle`, `bos` and `min` exist in several leagues, and a slug-only lookup put the
Cavaliers and the Celtics on a baseball page.

Draw them as `background-image`, not `<img src>`, anywhere the URL is
data-driven — a templated `src` gets fetched verbatim by the parser before values
resolve, and every load carries a failed request.

---

## 7. Type and colour

- Display: Bricolage Grotesque 600/700. Body: Archivo. Numbers and labels: Space
  Mono, tabular.
- **10px floor.** `--fs-xs` is the documented smallest legible caption; nothing
  goes under it. Data-bearing labels use `--dim #8b98ab`, not `#5c6b7a` — at 10px
  on `#0d0f12` the darker value is 3.5:1 and effectively invisible.
- Accent `#3b5bdb` means selected or interactive, never good or bad. Green and red
  mean cleared and missed, never decoration. The palace mark is the one
  documented exception, where green plus bars *is* the identity.
- 44px minimum hit target on mobile.

---

## 8. Checks worth writing

Each of these caught a real bug:

1. Every "N of M" caption matches its own percentage, on every row.
2. The plotted bar count equals the number the window names.
3. After dragging the line, every rate on screen moves — splits strip included.
4. No two elements state the same sample size differently.
5. Switching subject or sport leaves no string or logo from the previous one.
6. The tallest bar's bottom edge sits on the strip's baseline, and no bar extends
   past its row.
7. Console is clean on load — no failed asset requests.
