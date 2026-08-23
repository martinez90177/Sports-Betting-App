# Design brief — changes drawn from Outlier and PropsMadness

Scanned 2026-08-23, both signed in. Outlier: Insights, Props (MLB + WNBA),
Games, and the Pro nav. PropsMadness: the MLB prop board and a full pitcher
page (Shane Baz, K 4.5).

**Read the constraint first.** `PROJECT_NOTES.md` → "Free data only no fake
edge". PropPalace has no real odds feed, and its feed odds are derived from the
hit rate, so implied probability equals hit rate by construction. Roughly a
third of what both competitors do is priced off a real odds feed and **cannot be
built here**. Those are listed at the bottom so nobody commissions a mock for
them.

Everything in the build list below is derivable from data the app already
fetches, or from a free source it already talks to.

---

## 1. Game-by-game table under every form chart

**Where:** player detail, under the existing bar chart. Also the Matchup Card.

**What:** PropsMadness prints a plain table beneath each chart —
`Date | Opponent | Result | Line | Over or under` — one row per game, ~25 rows,
with the upcoming game as the last row marked "Upcoming".

**Why this is first:** the product's entire argument is "we show the games
behind the number." Right now the app *plots* them and never *lists* them. This
is the argument made literally. It is also the only way to check a windowed axis
by eye, and it makes the chart readable to a screen reader for the first time.

**Data:** already in `row.recent`. Nothing new to fetch.

**Design notes for the mock:** it should read as a records table, not a second
chart — mono, tabular numerals, hairline rows. Needs a collapsed state (the
chart alone) and an expanded one. Consider marking the games the current split
excludes rather than hiding them.

---

## 2. Expected opposing lineup, with each batter's rates

**Where:** MLB pitcher pages, and the Matchup Card for pitcher props.

**What:** PropsMadness lists the opponent's projected 1–9 with handedness and,
per batter, `PA · K% · Chase% · BB% · Whiff% · Contact% · Zone% · CSW% · SwStr%`.
For a strikeout prop this is the single most predictive block on the page.

**Why:** it turns "he averages 5.3 K" into "he is facing four batters who
strike out over 20% of the time." That is the research the app claims to do.

**Data:** the app **already has both halves** and has never joined them. Posted
MLB lineups are fetched (`lib/mlbStatus.js`, the lineup rules in CLAUDE.md);
per-batter K%/BB%/whiff%/xBA come from Baseball Savant via `lib/statcast.js`,
already cached 6h and CORS-open. This is assembly, not acquisition.

**Design notes:** nine rows is a lot of table. Consider the batting-order number
as the left rail (the app already renders order chips), highlight the two or
three batters that most favour the prop, and let the rest collapse.

---

## 3. Percentile rankings, player against opponent

**Where:** player detail, replacing or feeding the existing usage pills.

**What:** PropsMadness shows a two-column comparison — this pitcher's rate, its
percentile, then the opposing team's rate and *its* percentile — across BA, BB%,
Chase%, Whiff%, K%, Contact%, Zone%, SwStr%, xBA, xwOBA. With split selectors
(L3/L6/L10/All on one side, L10/L20/L30/All on the other).

**Why:** a raw rate means nothing without the league behind it. "21.2% K rate"
is meaningless; "21.2%, 48th percentile" is a fact.

**Data:** `lib/statcast.js` already downloads the **whole league table** per
side and caches it. Percentile is arithmetic over an array already in memory —
`statcastTeamRank` and `ordinal` already exist and do the same job at team
scope. Widening them to league scope is small.

**Design notes:** the app already has a percentile-ish device in the usage
pills. Whatever this becomes should reuse it rather than invent a second bar.
Two-sided comparison is the valuable part — one column of percentiles is much
less useful than the pair.

---

## 4. Head-to-head as a first-class figure

**Where:** the Prop Feed as a column; the player page as a stat block.

**What:** Outlier carries `H2H` as a **column in the props table**, beside L5/L10/
L20. PropsMadness shows H2H over the last three seasons as a totals line
(`51 PA · 9 H · 13 TB · 1 HR · 15 K · 5 BB`).

**Why:** PropPalace has this data and buries it — "vs. this defense" exists only
as a Board split, so it is invisible unless you go looking. It is the split
people actually ask for by name.

**Data:** already in the game logs. The Board's `SPLITS` array already computes
it.

**Design notes:** the H2H sample is usually tiny, so this is the place the
"too few" rule matters most. It must never print a bare percentage off three
meetings — the new support bands in `lib/support.js` should govern it.

---

## 5. Two seasons side by side

**Where:** Prop Feed columns.

**What:** Outlier's table ends `… L20 | H2H | 2026 | 2025`. PropPalace shows one
"Season" column.

**Why:** cheap, and it answers "is this year different?" — which is the first
question a season-long rate provokes. It also makes early-season thin samples
obvious rather than hidden.

**Data:** already fetched for MLB and NFL. Watch the `ALL` trap documented in
the data track: current season must outrank previous.

---

## 6. Findings as sentences — a new surface

**Where:** a new view, or a mode on The Board.

**What:** Outlier's primary screen is not a table. It is a feed of written
findings:

> *Ozzie Albies has failed to exceed 0.5 home runs in 11 straight games on the
> road (0.0 home runs/game average).*

Each carries the prop, the hit rate, and a link to the game. Filters are
Insight Type (Games / Players / Teams), Hit Rate, Splits, Over/Under. ~1,950 of
them on one MLB slate.

**Why it is worth considering:** it is a genuinely different answer to the
question we discussed — *what is the Board for*. A table of 3,095 rows is not
triage. A ranked list of **sentences**, each stating the split that makes it
interesting, is. It is also the format that best suits this product's voice.

**Data:** every ingredient exists. Streaks come from `straightRunOf`, splits
from the Board's `SPLITS`, averages from the same log. Nothing is fetched. The
work is composition and ranking, not data.

**Design notes for the mock:** the sentence is the row. Show what makes it
qualify (the split, the streak, the sample) without turning it back into a
table. This should be mocked as its own screen — it is the largest idea here.

**Caveat worth designing against:** Outlier's own board is swamped by
near-certainties — "Under 0.5 Home Runs" at 96%, dozens of them. A findings
list needs a rule that stops structurally-obvious props from filling it.

---

## 7. Game conditions block

**Where:** the Games card and the Matchup Card.

**What:** PropsMadness prints, per game:
`Oriole Park at Camden Yards · 84°F · 10 mph left to right field ·
HR +4% | Runs +9% | 1B +11% · Hitter Friendly`

**Why:** the app's Games card currently carries venue and an "Indoors" flag and
nothing else. Park factor is a real, publishable, free number.

**Data:** park factors are static published tables (no feed needed). Weather
needs a free API — **flag this as a dependency, not a given.** Design it so the
weather half can be absent without the block collapsing, which is this app's
existing rule anyway.

---

## 8. "+19 players without lines · Show"

**Where:** any roster or game prop list.

**What:** PropsMadness lists the players it has lines for, then states the count
it does not, behind a disclosure.

**Why:** it is exactly CLAUDE.md rule 4 — nothing silently dropped — expressed
as a control. PropPalace currently omits players with no game log and says
nothing about it.

**Data:** a count. Trivial.

---

## Lower priority, larger jobs

- **Pitch mix.** PropsMadness breaks a pitcher into fastball/curveball/cutter/
  changeup with usage%, velocity, and the opponent's performance against each.
  Savant has this free but it is a heavier pull than the current leaderboard
  call. Mock it only if the above are done.
- **Bullpen block** on pitcher pages.
- **Deep-link to a sportsbook** ("Add to Betslip"). Outlier's monetisation is
  affiliate links with a referral code. Product/business decision, not design.

---

## Do NOT commission mocks for these

All of these are priced off a real odds feed. `PROJECT_NOTES.md` records the
decision to stay on free data, and that a fabricated edge number on a publicly
shared site would be misinformation with Alex's name on it.

| Seen on | What | Why not |
|---|---|---|
| Both | Odds columns, multi-book line shopping | No paid feed |
| Outlier | **IP** (implied probability) column | Equals hit rate by construction here — circular |
| PropsMadness | "Odds imply 50.0% Over" beside the hit rate | Same |
| PropsMadness | Closing-line movement overlaid on the chart | Needs historical odds |
| Outlier | `/pro/ev`, `/pro/arbitrage`, `/pro/middle-bets`, `/pro/boosts` | The whole Pro tier is odds arbitrage |
| Outlier | Public betting % | Not free |
| Outlier | Games page as a money-line / spread / total board | Odds |

The one place real odds already exist is `SportsbookOddsPanel` on the MLB player
page (batter hits/HR, behind a manual "Get Odds" button, cached 12h). If any
odds-derived design is wanted, that panel is the only honest home for it.

---

## Two things PropPalace already does better

Worth stating so the mocks do not regress them.

1. **Stating the sample.** Neither competitor consistently pairs a rate with its
   denominator. Outlier prints bare "100%" cells constantly — several are 100%
   off tiny samples. PropPalace's "78% · 7 of 9" and its `too few` rule are a
   real differentiator, and the new support bands in `lib/support.js` go further
   than either.
2. **The Games page.** Outlier's is a pre-game odds board. PropPalace's tracks
   live scores, state and gamecasts, which is a different and more useful job —
   it is the reason not to leave for ESPN mid-session.
