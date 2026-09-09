# Player Detail v3 — handoff for Claude Code

**Source of truth:** `Player Detail v3.dc.html` in this folder. Open it in a browser (needs `../support.js` next to it — copy `support.js` from the project root into this folder if you move it). It is a self-contained Design Component: the markup is between `<x-dc>…</x-dc>`, all styling is inline, and the logic class at the bottom (`class Component extends DCLogic`) holds every computed style and behaviour.

This is the v3 desktop Player Detail frame (the one `v3 Mocks/player-detail-handoff.md` specifies, section by section) with a skin pass applied. **Match this file, not the current PlayerDetailDesktop.jsx.**

## What to transcribe

Everything the handoff already lists, in this order, with this file's exact inline styles:

1. Filter rail (left, 218px): MARKET as a **dropdown** (one select-style control showing the current market, 34px tall, mono 12px, opens a list of all markets) — not the stacked list and not chips; the mock file still shows chips, the dropdown is the decision; SEASON; WINDOW with the custom-window builder (stepper + slider, APPLY / SAVE); WORKLOAD range slider (label comes from the subject: PLATE APPEARANCES / MINUTES / SNAP SHARE); OPPOSING STARTER; SPLIT; MINIMUM SAMPLE.
2. Hero: headshot + crest, name, meta line, availability chips, then the LINE / IMPLIED / MATCHUP trio, per-game strip, + WATCH.
3. Graph: bars with the value printed inside, dashed line, draggable line tab (posted = accent fill, dragged = accent-ink fill), zoom, bar-detail card on click.
4. Splits strip, alt lines **as the dropdown we already fixed in the app — keep it exactly as it is now**, do not replace it with the open ladder shown in the mock (the ladder's per-rung counting over the same series still applies to the dropdown's rows), context rail (weather, injuries, rosters with team toggle, opposing rotation).
5. Watching bar at the bottom.

## Skin (the only thing that changed from v3)

- Fonts: `TYPE-SYSTEM.md` — Geist for words (500 for headings, -0.03em on the 34px title), JetBrains Mono for numbers and uppercase labels (600, never 700).
- Colours: every hex is replaced by a token. Map: `--pp-canvas` → `--bg`, `--pp-bg` → `--surface-sunken`, `--pp-surface` → `--surface-1`, `--pp-surface2` → `--surface-2`, `--pp-line` → `--line`, `--pp-text` → `--text`, `--pp-text2` → `--text-2`, `--pp-dim` → `--dim`, `--pp-dim2` → `--dim-strong`, `--pp-acc` → `--amber`, `--pp-acc-ink` → `--amber-ink`, `--pp-acc-dim` → `--amber-dim`, `--pp-acc-on` → `--accent-on`, `--pp-pos` / `--pp-neg` → `--pos` / `--neg`, `--pp-pos-dim` / `--pp-neg-dim` → `--pos-dim` / `--neg-dim`. The literal `#e8b13a` (questionable status) stays literal, as the handoff requires.
- Dark palette defaults are your existing greys: canvas #0a0b0d, bg #0d0f12, surface #131519, surface-2 #20242b, line #2b2f36, text #e8ecf2, text-2 #aab2c0, dim #8b98ab, dim-strong #5c6b7a. Accent comes from Settings.
- Frame shadow: `0 24px 60px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04)`.

## Two things the mock gets wrong — follow this, not the file

- **Alt lines stay a dropdown.** The app's current alt-line dropdown (just fixed) is the correct control. Restyle it to the skin above; do not change its behaviour or turn it into the always-open ladder the mock draws.
- **Weather lives next to the game menu, not in the rail.** One mono line right of the game dropdown above the player name: temperature · wind speed + direction · precipitation (e.g. "61°F · WIND 12 NW · RAIN 20%"). Shown for outdoor MLB and NFL games only; hidden indoors and for NBA/WNBA.
- **Park factor is MLB-only.** The PARK FACTOR block in the context rail (home runs, extra-base, singles, runs, strikeouts boosts) appears only for baseball subjects. It must never render on NFL, NBA or WNBA pages.
- **Markets are a dropdown too.** Replace the market chips in the rail with a dropdown of all markets for the sport (same 34px rail-pill look when closed, current market as its label, chevron on the right). Selection behaviour is unchanged.

## Subjects

`SUBJECTS` in the logic class has four fully-populated examples (mlb: Judge, nba: Maxey, wnba: Atkins, nfl: Lamb). Use them as the shape for `playerDetailProps.js`; NFL is new and includes 18 markets, snap-share workload and a receiving-yards ladder.
