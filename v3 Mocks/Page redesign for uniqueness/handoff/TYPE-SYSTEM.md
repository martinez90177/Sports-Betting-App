# Prop Palace — type system (v4 reskin)

Replaces Bricolage Grotesque (display) and Space Mono (numbers/labels). Two families only.

## Families

- **Geist** — everything that is a sentence, a name, a heading, or a control label. Weights 300–700 (variable).
- **JetBrains Mono** — every number, every uppercase micro-label, every stat, every odds/line/rate figure. Weights 400–700. Always with tabular figures.

Google Fonts:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

CSS stacks (drop-in for `.oswald` / `.mono` / `MONO` / `--font-*`):
```css
--font-sans: 'Geist', system-ui, -apple-system, sans-serif;
--font-mono: 'PP At', 'JetBrains Mono', ui-monospace, monospace;  /* keep the PP At "@" fix first */
.mono, .stat-value { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
body, .oswald { font-family: var(--font-sans); }
```
Remove the `Bricolage Grotesque`, `Space Mono` and `Archivo` links. JetBrains Mono's "@" is fine, so the `PP At` face is optional now — keep it if you want zero risk.

## Roles → face, size, weight, tracking

Sans (Geist)
- Page title (e.g. "Findings", "Tonight") — 34–40px / 500 / -0.03em / line-height 1
- Section title ("My Picks", "Game log") — 15–16px / 500 / normal
- Player / team name — 14–15px / 500 (600 in the slip)
- Body / sentence copy ("Cleared 1.5 total bases in 9 straight…") — 13px / 400 / line-height 1.4–1.5, `text-wrap: pretty`
- Control labels in segmented controls (MLB, Over, Strength) — 12.5px / 500 active, 400 inactive
- Helper notes under a control — 11.5px / 400 / dim colour / line-height 1.4
- Primary button — 13–13.5px / 600 / 0.02em

Mono (JetBrains Mono, tabular-nums)
- Micro-labels (SAMPLE WINDOW, PLAYER · PROP, STRENGTH) — 10px / 400 / 0.14–0.16em / uppercase / dim colour
- Wordmark PROP PALACE — 12px / 400 / 0.18em / uppercase
- Nav tab labels on mobile, chips, FILTERS, SORT items — 11px / 400 / 0.08em
- Table meta (team · pos · market, "8 of 10", times) — 10–10.5px / 400
- Prop line under a name ("Over 1.5 Total Bases") — 11.5–12px / 400
- Rate cell value (71%) — 13px / 600
- Line tag on the form strip (1.5) — 11px / 600
- Odds (-142) — 12px / 400; large odds/line in header — 15–16px / 600
- Hero rate (71%) — 38–42px / 500 / -0.03em, use Geist here instead if it sits next to a Geist title
- Strength score (.79) — 20–22px / 600
- Rank number (01, 02) — 22px / 300 / -0.02em / dim

## Rules

1. If it's a number that has to line up in a column, it's mono. No exceptions — a figure in Geist is a bug.
2. Uppercase only in mono, always with letter-spacing ≥ 0.08em. Geist is never all-caps.
3. Two weights per face on any one screen: Geist 400 + 500 (600 only for buttons/slip names), Mono 400 + 600.
4. Floors: 10px mono, 11.5px sans, nothing smaller.
5. Light (300) Geist is only for hero-scale titles ≥ 34px and rank numerals.
