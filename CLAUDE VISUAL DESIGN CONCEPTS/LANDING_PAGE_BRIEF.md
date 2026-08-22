# Design brief — PropPalace landing page ("Know the sample")

Mock up a **desktop landing page (1280px)** for PropPalace, a sports-prop
research tool. It is the front door: today the app opens straight into a filter
rail, which is fine for the daily user and disorienting for everyone else.

Take the **layout** of concept card `1a` and rebuild it in the **approved
visual direction (`2a`)**. `1a`'s styling is a rejected direction — do not carry
any of it over. Specifics below, because the difference is the whole job.

---

## 1. What is dead, and what replaces it

`1a` was "The Palace — oxblood and brass, arches as structure." All three of
those are out:

| `1a` (rejected) | Use instead |
|---|---|
| Brass `#c9a24a` accent | Lapis `#3b5bdb` (see tokens) |
| Oxblood ground | Near-black `#0a0b0d` |
| Arch geometry — `border-radius: 120px 120px 0 0` on cards | Flat cards, `6px` radius |
| Arch glyph as logo mark | **Three ascending bars** in lapis |

The logo is **three ascending bars**, left-to-right short → tall → medium,
lapis, with flat bottoms and slightly rounded tops. Reference implementation:

```html
<span style="display:flex; align-items:flex-end; gap:3px;">
  <span style="width:6px; height:12px; background:#3b5bdb; border-radius:3px 3px 0 0;"></span>
  <span style="width:6px; height:21px; background:#3b5bdb; border-radius:3px 3px 0 0;"></span>
  <span style="width:6px; height:16px; background:#3b5bdb; border-radius:3px 3px 0 0;"></span>
</span>
```

No arches anywhere, including as a decorative or section-divider motif.

---

## 2. Exact tokens — use these values, not approximations

These are lifted from the live stylesheet. The mock should be droppable into the
app without a colour-matching pass.

### Colour

```
--bg              #0a0b0d   page ground
--surface-1       #131519   cards, panels
--surface-2       #191c21   nested strips inside a card
--surface-sunken  #0d0f12   inset wells, table headers
--line            #2b2f36   borders
--text            #e8ecf2   primary text
--text-2          #aab2c0   secondary text
--dim             #8b98ab   muted labels, captions
--accent          #3b5bdb   lapis — THE accent
--accent-ink      #8fa6ff   accent as text on dark
--accent-on       #ffffff   text sitting on a solid accent fill
```

**Status colours — fixed, never re-tinted:**

```
green   #3ecf8e   cleared the line / hit / available
red     #ef5b5b   fell short / miss / out
amber   #e8b13a   questionable  (availability only)
```

### Two hard colour rules

1. **The accent is user-configurable.** In Settings the user can re-tint the
   entire accent to any hue. So the accent may only carry meanings that survive
   a hue change: verdict figures, confidence bars, buttons, links, active
   controls. It must **never** encode health, hit/miss, or good/bad.
2. **Green and red are semantic and fixed.** Green = cleared/hit. Red = fell
   short/miss. Never use the accent for these, and never use green/red for
   anything decorative.

### Type

```
Display / headings   Bricolage Grotesque   600
Body / UI            Archivo               400–600
Numbers, labels      Space Mono            tabular figures, letter-spacing ~0.08em
```

Every number — hit rates, counts, odds, lines, times — is **Space Mono with
tabular figures**. Micro-labels (`OPP RANK`, `SEASON`, `RECEPTIONS · OVER 5.5`)
are Space Mono uppercase, 10.5–11px, letter-spacing 0.12–0.14em, in `--dim`.

### Geometry

- Card radius `6px`. Chips/small controls `4px`. Pills `999px`.
- Spacing scale: 4 / 8 / 12 / 16 / 20 / 24 / 32.
- Borders `1px solid #2b2f36`. Cards are flat — no drop shadows, no gradients,
  no glow.

---

## 3. The one thing to redesign, not just re-skin

**The form graph in the hero card is the weakest element in `1a` and must not be
copied.** `1a` draws ten identical brass squares, filled for a hit and outlined
for a miss. Two problems: it is monochrome, so it contradicts the app's
green/red rule; and every square is the same height, so it shows *whether* he
cleared but not *by how much* — which is the more useful fact.

The app already ships a better treatment. **Match this:**

- Ten vertical bars, `6px` wide, `3px` gap, max height `24px`.
- **Bar height encodes the margin** over/under the line — a blowout is tall, a
  near-miss is short. Floor the shortest at ~30% so it never reads as missing
  data.
- **Cleared** → solid green `#3ecf8e`.
- **Fell short** → red `#ef5b5b`, **1.5px outline, no fill**.
- Beneath the bars, a Space Mono caption: `9 of 10 · 7 straight` — the count
  first, then the streak. Colour it green when the run is hits, red when misses.
- A 2px rule beneath just the trailing run of same-coloured bars, tying the
  words to the games they describe.

If you show any legend for it, the wording is **"cleared the line"** and
**"fell short"**.

---

## 4. Layout to keep from `1a`

Structure is good; keep it. Two columns above the fold.

**Left — the argument**
- Eyebrow, Space Mono uppercase, accent: `2025 SEASON LOGS · NO PICKS SOLD`
- H1, Bricolage ~74px, line-height 1.02, three lines:
  *"Know the sample before you take the line."*
- One paragraph, ~16px `--text-2`, max-width ~62ch: every hit rate shows the
  games behind it, and when the sample can't answer the question we say so
  instead of printing a number with confidence it hasn't earned.
- Primary button: solid accent fill, `--accent-on` text, **OPEN THE BOARD**
- Secondary: text link with underline, **HOW WE COUNT**

**Right — a live example card** (`--surface-1`, 1px `--line`, 6px radius)
- `LAR · WR` micro-label
- Player name, Bricolage ~34px
- `RECEPTIONS · OVER 5.5` micro-label
- **`78%`** — the verdict figure, Space Mono, ~64px, accent
- `7 of 9 games · 2025 season` in `--dim` — counts first, always
- The form graph (section 3 above)
- Three split rows, hairline-separated: label left in `--text-2`, value right in
  Space Mono — `Home 80% (4/5)`, `vs. SEA defense 100% (1/1)`, `Last 3 67% (2/3)`
- A bordered verdict block at the foot: `FAIR SAMPLE · LEANS OVER` in accent,
  with `9 games. Treat as a lean, not a lock.` beneath in `--dim`

**Below the fold**
- `Today's board` — Bricolage ~34px — with `SUNDAY, SEPTEMBER 14 · 12 GAMES` in
  Space Mono `--dim` beside it, then a row of game cards.

**Top nav:** three-bar mark + `PROP PALACE` wordmark left; `Games / Prop feed /
News` centre-left with the active item in accent underlined 2px; a `21+` pill
outlined in accent, right.

---

## 5. Content rules — these are not stylistic

The product's entire premise is not overstating what the data supports. A mock
that breaks these can't be built.

- **Every rate states its sample.** Never `78%` alone — always `78% · 7 of 9
  games`. Counts first, percentage second; in split rows, `80% (4/5)`.
- **Thin samples get a verdict, not a number.** Under ~10 games the card says
  so — `FAIR SAMPLE`, or `too few` — rather than projecting confidence.
- **Green = over/hit, red = under/miss.** Nothing else.
- **Availability**, if an avatar appears, uses only green/amber/red as above,
  as a dot on the avatar's bottom-right corner. Unknown status = **no dot** —
  never grey, never defaulting to green.
- **One data disclaimer** at the foot of the card, e.g. *"Real 2025 regular-season
  game logs. Not a live odds feed."*
- **No fabricated hero stat.** The example card is a real row.

---

## 6. Deliverable

Single self-contained HTML file, 1280px desktop, dark ground, inline styles,
Google Fonts links for Bricolage Grotesque / Archivo / Space Mono. A 390px
mobile variant of the same page is welcome but secondary.

Match the token values exactly — this mock gets rebuilt as React against a
stylesheet that already defines every one of them.
