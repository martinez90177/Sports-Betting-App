# Handoff: PropPalace redesign — news page, alt lines, player avatars

## Overview

A redesign pass on PropPalace (`martinez90177/Sports-Betting-App`, branch `master`) covering:

1. **A visual direction** for the app's existing screens (games slate, matchup overview, player prop detail) that stops them reading as a generic recreation of a competitor's feed.
2. **A News page** — a screen the app does not have yet.
3. **Alt lines / alt legs** — every prop becomes a ladder of alternate lines, and a slip leg can sit on any rung.
4. **Player avatars everywhere** a player is named: real ESPN headshot over a two-colour team gradient, with an availability dot.
5. **Injury + news context and missing-teammate context** on the player profile.

## About the design files

`PropPalace Concepts.dc.html` in this bundle is a **design reference written in HTML**. It is a static prototype: it shows intended layout, type, colour, copy and behaviour. It is **not production code and should not be copied into the app**.

The task is to **recreate these screens inside the existing codebase** — React 18 + Vite, plain CSS with custom properties in `src/index.css` — using its established patterns (the `--bg` / `--surface-*` / `--line` / `--text` token ramp, the existing accent mechanism, the existing page components). Where the design and the codebase disagree on a neutral or an accent, **the codebase wins**: the design deliberately derives its neutrals from `src/index.css`.

## Fidelity

**High fidelity.** Colours, type, spacing, copy and numbers are final-intent. Recreate pixel-closely, but express it through the app's existing CSS variables rather than hard-coded hexes wherever a variable already exists.

## Screens

### 1. News (new screen — `4a` in the design file)

**Purpose:** a feed of items that each state *which prop they move*, so news is research context rather than a headline reader.

**Layout:** page nav (56px tall, 1px bottom border) → page header row (title + filter chips) → two-column body, `grid-template-columns: 1fr 372px`, 1px divider between.

Left column, top to bottom:
- **Top story** — 24px 28px padding, background one step lighter than the panel (`#131519`), `grid-template-columns: 68px 1fr`, 20px gap. 68px avatar. Badge row (mono 10.5px, 0.14em tracking): a filled `TOP STORY` chip on the accent, then `TEAM · POS · TIME AGO` in dim text. Headline 28px display, line-height 1.25. Body 14.5px / 1.6, max-width 640px. Footer row: `AFFECTS` label + one bordered chip per affected prop, each chip carrying the prop name, its line, and its hit rate coloured green when ≥70%.
- **Standard items** — same structure at `grid-template-columns: 52px 1fr auto`, 20px 28px padding, 52px avatar, 21px headline, plus a right-aligned action chip (`WATCHING` on accent border when watched, `+ WATCH` / `GAMECAST` otherwise).
- **Load earlier today** — centred mono link, 16px 28px.

Right column:
- **Injury wire** — section header (14px 24px, `--surface-sunken` background, bars glyph + 19px display title + `WEEK N` on the right), then rows of 38px avatar + name/prop + a status pill: `ACTIVE` green (#3ecf8e on #234a3a border), `QUEST` amber (#e8b13a on #4a3d1c), `OUT` red (#ef5b5b on #4a2323). An `OUT` player's row is dimmed and reads "Props hidden while out".
- **Your watchlist moved** — 34px avatar + one-line description of the move, then the hit rate at the new number in 26px mono with "4 of 9 games" beside it, then a filled accent button.
- **Disclaimer** — 12.5px dim: news never changes a hit rate, only finished games do.

### 2. Props feed with alt lines (`4b`)

**Purpose:** browse a game's props where each prop is a **ladder of lines**, not one line.

**Layout:** breadcrumb → header (title + `Main line only` / `Show alt lines` segmented pair + a filter chip) → two columns, `1fr 396px`.

**Expanded prop (the ladder):**
- Player header: 52px avatar, 24px name, `TEAM · POS`, prop name + "9 finished games counted", and a right-aligned market switcher (`RECEPTIONS` filled / `REC YARDS` / `LONGEST` bordered).
- Ladder table, `grid-template-columns: 92px 84px 128px 1fr 96px 104px`, columns `LINE · HIT RATE · GAMES OVER · SHAPE · PRICE · action`, header row mono 10.5px on `--surface-sunken`.
- One row per rung: 17px mono line, 16px hit rate (green ≥70%, neutral below), "8 of 9" count, a 190px bar, American price, and `+ ADD LEG`.
- The **main line** row is emphasised: 3px accent left border, `#101319` background, 19px line, 18px rate, a `MAIN LINE` mono tag next to the bar, and its action becomes a filled `IN SLIP` chip.
- Footer: alt rungs come from the same finished games, and a rung with fewer than 10 games is marked thin.

**Collapsed props:** one 18px 28px row each — avatar, name, prop with a summary of its rungs, hit rate, and an `OPEN LADDER ▾` chip (accent border when the rate is strong, neutral otherwise). Ends with "13 more props, 4 hidden by the 70% filter" + `SHOW ALL`.

**Slip rail:**
- Section header, then one block per leg: 38px avatar, name, prop description, a remove `×`.
- Each leg has a **line stepper**: bordered `− value +` control, every hit area 44px, value in 17px mono. A leg moved off the main line gets an accent-bordered stepper, an accent `ALT` badge next to the name, and a note reading e.g. "Two rungs down buys 22 points of hit rate and costs 85 of price" plus `WAS 62.5 · 56%`.
- Per-leg rate (20px, green when strong) with price and count beneath.
- **Combined block:** combined price 28px mono, then "ALL THREE HAVE LANDED TOGETHER — 2 of 5" with a bar, and the caveat that legs are not independent so multiplying single rates would overstate it. Do not ship a multiplied parlay probability.
- **Safer rungs for this slip:** suggestion rows ("Nacua down to 4.5 · 89% · SWAP", "Drop the thin leg · 3 of 5 · REMOVE").

### 3. Player prop detail additions (inside `2a`)

Right column, above the existing splits block:

- **Injury and news** — header row with a status pill (`ACTIVE · NO DESIGNATION`), then a timeline: `grid-template-columns: 78px 1fr`, mono timestamp/week on the left (accent for current, amber for a past scare), 13.5px sentence on the right naming the snap share and whether the prop went under. Closes with "7 of 7 over 5.5 in the games he finished. Both unders are the two games above."
- **Missing around him** — per absent teammate: 36px avatar, name + position, injury + when, and an `OUT` / `QUEST` pill; underneath, a `1fr auto` row explaining the usage change ("target share rose from 24% to 31% across three games") with the resulting count ("3 of 3 OVER 5.5") in 19px green mono. Includes an opposing-defender entry (`SEA · CB` questionable). Footnote: only absences that moved target share by more than three points are listed, and each names how many games it came from.

**Header:** the player header is now 76px avatar + `TEAM · POSITION` mono line + 42px name in a horizontal flex, 18px gap.

## Interactions

- Nav items switch pages; `News` is the third item.
- Filter chips (All / Watching / Injuries / Line moves) filter the feed; `Main line only` ⇄ `Show alt lines` collapses every ladder to its main row.
- `OPEN LADDER ▾` expands one prop's ladder inline; only one expanded at a time is what the design shows.
- `+ ADD LEG` adds that exact rung to the slip; the rung's action becomes `IN SLIP`.
- Leg stepper `−` / `+` moves the leg to the adjacent rung: line, hit rate, count, price and the trade-off sentence all update, and the `ALT` badge appears as soon as the leg is off the main line.
- `SWAP` / `REMOVE` in "safer rungs" applies that change to the slip.
- Every tap target is at least 44px on mobile.
- Hover: rows lift to the next surface step; chips gain the accent border. No transitions longer than 150ms.

## State

- `view`: games | matchup | props | player | news
- `league`, `slateDate`, `season`
- `showAltLines`: boolean
- `expandedPropId`: id | null
- `slip`: `[{ playerId, market, line, side, price, hitRate, gamesOver, gamesCounted, isAlt, mainLine }]`
- `watchlist`: prop ids
- `newsFilter`: all | watching | injuries | lineMoves
- Data needed: per-prop **ladder** — for each rung, hit rate, games over, games counted, price; per-player injury timeline with per-game snap share and over/under result; teammate-absence splits (target share with and without, games counted); combined "all legs landed together" count over games where all legs' players finished.

## Design tokens

Neutrals (already in `src/index.css` — use the variables, not these hexes):
- panel `#0a0b0d` · raised `#131519` · sunken `#0d0f12` · emphasis `#101319` · bar track `#191c21`
- strong line `#2b2f36` · hairline `#1e2228`
- text `#e8ecf2` · secondary `#aab2c0` · dim `#8b98ab`

Accent and status:
- accent `#3b5bdb`, accent text `#8fa6ff`
- positive `#3ecf8e` · negative `#ef5b5b` · caution `#e8b13a`
- muted bar fill `#6c7688`

Avatar gradients (135°, primary holds to 40% then ramps to a darkened secondary):
- LAR `#003594 0%, #003594 40%, #a86d05 100%`
- SEA `#002d5c 0%, #002d5c 40%, #3d7519 100%`
- CIN `#1a1a1a 0%, #1a1a1a 40%, #a83b0c 100%`
- MIN `#4f2683 0%, #4f2683 40%, #a37c19 100%`

Generate these from the team colour pair rather than hard-coding per team:
```js
const teamAvatarBg = (primary, secondary) =>
  `linear-gradient(135deg, ${primary} 0%, ${primary} 40%, ${shade(secondary, 0.35)} 100%)`;
```
`src/index.css` already carries `--avatar-ring-shade1` / `--avatar-ring-shade2` for exactly this darkening — reuse them.

Type (Google Fonts):
- Display / headlines / wordmark: **Bricolage Grotesque** 600–800
- UI text and player names: **Archivo** 400–700
- Numbers, odds, labels, tabular data: **Space Mono** 400/700, always with `font-variant-numeric: tabular-nums`
- Sizes in use: 42 / 34 / 30 / 28 / 24 / 21 / 19 display; 14.5 / 14 / 13.5 / 13 body; 12 / 11.5 / 11 / 10.5 mono labels with 0.08–0.16em tracking, uppercase.

Wordmark is **PROP PALACE** (with the space), paired with the three-bar mark: three rounded-top bars, heights 12 / 21 / 16 at 6px wide, 3px gap, in the accent.

Spacing: 28px page gutter, 24px rail gutter, 18–22px row padding, 13–16px inner gaps. Radius: 0 everywhere except avatars (50%) and pills (999px). No shadows.

## Assets

- **Headshots:** `https://a.espncdn.com/i/headshots/nfl/players/full/{espnAthleteId}.png`, `object-fit: cover`, `object-position: top center`, filling a circular container. The team gradient sits behind, so a missing id degrades to a coloured circle. The app's own headshot source (already used in `GamecastPage.jsx` / `PlayerNewsModule.jsx`, and `mlbHeadshot()` in `src/lib/gamesData.js` for MLB) should be the real source of truth — the ESPN ids in the prototype are placeholders for a handful of players.
- **Availability dot:** 25–30% of the avatar diameter, bottom-right, 2–3px border in the surrounding surface colour; green active, amber questionable, red out.
- **Team logos:** the existing `nflTeamLogo` / `mlbTeamLogo` / `wnbaTeamLogo` helpers in `src/lib/gamesData.js`.
- No icon set: the only glyphs are the three-bar mark, arrows, `×` and `▾`.

## Files

- `PropPalace Concepts.dc.html` — the full design canvas. Sections are labelled by id:
  - `4a` News · `4b` Alt lines and slip
  - `3a` Mobile screens · `3b` Four logo mark candidates (the **bars** mark is the chosen one)
  - `2a` Games slate, matchup overview, player prop detail (with the new injury / missing-teammate blocks)
  - `1a` / `1b` / `1c` earlier landing-page directions — historical, not part of this handoff
- `github.md` (project root) — repo association, last sync, and the screen → repo file map.

Repo files each screen maps to:

| Design | Repo |
| --- | --- |
| 4a News | new screen; follow `PlayerNewsModule.jsx` for news item shape |
| 4b Alt lines / slip | `src/PropLedger.jsx` |
| 2a Games slate | `src/GamesPage.jsx`, `src/lib/gamesData.js` |
| 2a Matchup overview | `src/MatchupPage.jsx` |
| 2a Player prop detail | `src/PropLedger.jsx` |
| Tokens / theming | `src/index.css`, `src/settings.jsx`, `src/ColorWheel.jsx` |

## Two notes worth carrying into the code

1. `GamesPage.jsx` and `MatchupPage.jsx` currently describe themselves in comments as recreations of a competitor's screens. That is the root of the "it looks generic" feedback. The layouts above are deliberately different: a serif-free display face, a dense ladder table, and hit rates that always show their sample size.
2. Every rate in the design is paired with the number of games behind it, and thin samples are labelled rather than hidden. Keep that rule — it is the product's argument.
