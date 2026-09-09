# PropPalace vs PropsMadness & Outlier — what to fix, what to build

Written 2026-09-08, the day before the 2026 NFL opener, from a live read of both
rivals and a driven read of our own app. Companion to
[`REDESIGN_PLAN.md`](./REDESIGN_PLAN.md), which stays the source of truth for the
numbered tracks.

**Everything in Part 1 was reproduced on screen, not inferred from code.** Where
a claim comes from reading a file rather than seeing it happen, it says so.

---

## Part 1 — Defects found. Fix these before showing anyone.

Alex's framing was "make sure it works first". These are the things that are
wrong *now*, ordered by how badly they embarrass the site.

### 1.1 Anytime TD counts passing touchdowns — a wrong number under a real name

`statValueNFL` (`PropLedger.jsx:4970`):

```js
case "anytimeTd": return g.rushTd + g.recTd + g.passTd;
```

"Anytime TD" in every sportsbook means *this player scores a touchdown* —
rushing or receiving. A quarterback who throws four TD passes has scored none.

On the Findings page right now:

> **Trevor Lawrence · Over 1.5 Anytime TD · 100% · 9 of 9** — "cleared 1.5
> Anytime TD in 9 straight games, averaging 3.0 over the run."
>
> **Justin Herbert · Over 0.5 Anytime TD · 9 of 9 home games, averaging 1.8.**

Both are passing touchdowns wearing a market name that means something else.
`NFL_MARKETS` offers `anytimeTd` to QBs (`PropLedger.jsx:4384`), so every
quarterback row in that market is wrong, on the feed, the player page and
Findings. Someone betting Lawrence anytime TD off this site loses.

Passing TDs are already their own market (`passTd`), so they are also being
double-counted across the two.

**Fix:** `return g.rushTd + g.recTd;`. A QB keeps the market — he can score on a
sneak — he just stops being credited for throwing. RB/WR/TE rows are unaffected
(their `passTd` is 0), so this changes only the rows that were wrong.

### 1.2 The NFL player page opens on five games and then disowns the number

`DEFAULT_WINDOW.nfl = 5` (`v3/playerDetailProps.js:23`) — MLB, NBA and WNBA all
default to 10.

Opening Jared Goff cold gives a page whose headline reads `LINE 308.5 ·
IMPLIED −400 · FROM 5 GAMES`, a chart of five bars out of a 17-game season, and
directly underneath: **"5 games counted · too few to lean on"**. The page argues
with itself in its own default state.

It also puts the alt-line ladder in a degenerate state — four consecutive rungs
all reading the same thing, which looks broken even though the arithmetic is
right:

| LINE | HIT RATE | GAMES OVER | PRICE |
|---|---|---|---|
| 233.5 | 80% | 4 of 5 | −400 |
| 258.5 | 80% | 4 of 5 | −400 |
| 283.5 | 80% | 4 of 5 | −400 |
| 308.5 | 80% | 4 of 5 | −400 |

And it contradicts our own rules: the feed's NFL minimum sample is **9**, so the
player page defaults to a sample the feed would refuse to state a rate for.

**Fix:** `nfl: 10`, matching every other sport and clearing the 9-game floor.
One value. PropsMadness defaults to **20**.

### 1.3 Every dome game says a forecast is coming that never will

`useNFLKickoffWeather` emits `reason: "dome"` (`PropLedger.jsx:6576`).
`PlayerDetailDesktop.jsx:991` only tests for `"indoor"`, so a dome falls through
to the generic branch and prints **"Forecast still pending for this game."**

Seen on Goff at Ford Field, which has a fixed roof. `PlayerDetailMobile.jsx:805`
tests `=== "dome" || === "indoor"` and gets it right — **the phone is correct and
the desktop is not.** `"retractable"` and `"horizon"` land in the same wrong
bucket.

**Fix:** make the desktop branch test the same set the mobile one does. Ten
stadiums are affected.

### 1.4 No availability dot on any NFL feed row

`buildNFLFeedRows` sets `logId` and `gradeId` but never `espnId`
(`PropLedger.jsx:19932`), and `resolveRowStatus` (`:20824`) needs `espnId`. So
every NFL feed row renders an avatar with no status dot, and a saved NFL pick is
persisted with `espnId: null` (`:18244`) — the slip and the Ledger can never
resolve it either. NBA has the same defect.

This breaks **CLAUDE.md avatar rules 1 and 2** outright. The data is already
fetched and sitting in `NFL_ROSTER_STATUS`; only the row field is missing.
(Found by code reading last session; the missing dots are visible on the feed.)

### 1.5 Findings leads with trivia

Top of the page, sorted by Strength:

- Jake Elliott · Over 0.5 **FG Attempts** · 15 of 15
- Van Jefferson · Over 0.5 **Receptions** · 11 of 11
- Jake Bates · Over 0.5 **FG Made** · 12 of 12

A kicker attempting at least one field goal is not a finding. The
"Hide near-certainties" control already held **213** rows back, so the mechanism
exists — its threshold just isn't catching `0.5` lines on high-frequency
markets. First impression of the page is noise, and the genuinely interesting
rows (Gainwell over 37.5 rush+rec in 9 straight) sit below them.

**Fix:** make near-certainty suppression default-on, or raise it to catch a line
the log clears in essentially every game regardless of streak length.

**The structure is not the problem — the selection is.** Outlier's Insights page
is the same idea and its sentences are built the same way:

> "Travis Kelce has exceeded 3.5 receptions in 4 of his last 5 games at home
> (4.6 receptions/game average)."
>
> "RJ Harvey has exceeded 3.0 receiving targets in 5 straight games on the road
> (5.0 receiving targets/game average)."

Compare ours: *"Kenny Gainwell has cleared 37.5 Rush + Rec Yds in 9 straight
games, averaging 80.7 over the run."* Identical quality — and it is sitting
eighth, under five kicker-and-one-reception rows. Their counts are comparable
too (1,062 insights to our 1,275), so this is purely a ranking problem.

Two things theirs has that ours doesn't: **every insight carries a real price**
(−119, +135), and **team insights sit alongside player ones** — "The Denver
Broncos are 6-0 in their last 6 games on the road" → DEN Money Line; "The under
hit in 7 of the Kansas City Chiefs last 7 games at home" → Under 43.5. Team form
is computable from the schedule and results we already fetch; only the price
needs an odds feed.

### 1.6 The teammates rail says nothing

Every teammate on Goff's page reads identically: `ANY · 17 G`. Twenty-two rows
of the same two tokens. The control underneath is good — "one tap for with, two
for without" — but nothing on the row tells you which teammate is worth tapping.

PropsMadness's equivalent shows **the stat difference with and without that
teammate**, and for injured or questionable players shows the difference
*without* them, which is the number that matters this week.

### 1.7 The switch-player rail admits it isn't ordered

Footnote on the rail: *"Rail order is the roster's, not a depth chart."* That was
true when written. `lib/nflDepth.js` now reads all 32 published depth charts. The
rail can be ordered by it, and the caveat deleted.

---

## Part 2 — What they have that we don't

### 2.1 Real odds, and the one line that makes a research site worth using

Both rivals put a book line next to the hit rate. PropsMadness pairs them
explicitly:

> **HIT RATE 60% (12/20)** · *Odds imply 53.3% Over*

That single pairing is the product. It says "the market thinks 53%, the log says
60%, the gap is your edge". Outlier does the same with an `IP` column beside
`L5 / L10 / H2H / 2026 / 2025`.

We cannot say it. `fairFeedLine` is the player's own median − 0.5
(`PropLedger.jsx:19413`) and `IMPLIED −400` on the player page is converted from
our own hit rate — so the "market" number and the "our data" number are the same
number. The alt-line ladder is honest about it on screen ("NO BOOK PRICED
THESE"), which is the right call, but it means the headline comparison the whole
category is built on is unavailable to us.

**This is the single biggest gap and everything else is downstream of it.**
Costing and the credit-safety analysis are in `REDESIGN_PLAN`'s Track B work —
short version: `api/odds.js` already exists, caches per-event in shared Redis so
cost is independent of user count, has a hard pre-spend cap, and the $30/mo tier
covers a full NFL slate with ~78% headroom.

### 2.2 Per-market opponent rank — theirs is 13 dimensions, ours is one number

PropsMadness's filter panel, **Opp Rankings → Team Defense**, carries thirteen
separately ranked dimensions, each 1–32 and colour-coded by whether it pushes
the current prop toward the Over or the Under:

`Pass Yds #9` · `Pass Att #12` · `DTZ` · `Man %` · `Zone %` · `Man D-Rank` ·
`Zone D-Rank` · `Press Rate #20` · `Position #15` · `Yds/Att #12` · `Cmp% #24` ·
`Sack Rate #23` · `Pace #25`

Ours is `getNFLDefRank`, which **ignores the market and the position entirely**
and returns points allowed per game (`PropLedger.jsx:3353`), from a hardcoded
`season=2025` standings pull cached with no TTL (`:3375`). One number does the
work of seventeen markets, and after Week 1 it is a frozen prior-season table.

We label it honestly (`nflDefIsPointsAllowed` gates any claim of a per-market
split), which is better than faking it. But "MID #16/32" beside a passing prop
is close to information-free.

**What's reachable without a paid feed:** opponent yards allowed by *category*
(pass yds, rush yds, receptions) is derivable from the same ESPN game logs we
already fetch for every player — sum what each defence conceded. That gets us
from one dimension to three or four real, per-market ones. Man/Zone, Press Rate
and DTZ are charting data (PFF/NextGen) and are not reachable.

### 2.3 Historical closing lines — verified real, and we have nothing like it

I toggled it and watched it work. With `CLOSING LINES` on, PropsMadness draws a
tick on each bar at **that game's own closing line**, and the hit rate changes
from **55% (11/20)** to **60% (12/20)** — because it regrades every game against
the line that was actually available, not today's line.

Ours grades every past game against today's line, same as their default view. So
we match their default and lack their toggle. The Odds API sells historical odds
on every tier, so this is buyable rather than impossible, but it is one credit
per game per market historically — expensive, and firmly a later item.

### 2.4 Market depth: 17 vs ~34 and ~40

PropsMadness's NFL market list (34) and Outlier's (~40) both carry things we
don't:

| Missing | Reachable? |
|---|---|
| Longest Rush | **Yes** — ESPN returns `longRushing` |
| Longest Pass Completion | **Yes** — ESPN returns `longPassing` |
| Receiving Targets | **Yes** — we already capture `tgt` and don't price it |
| 1Q / 1H splits (12 markets) | No — needs play-by-play |
| Tackles, Sacks, Assists, Tckl+Ast | No — needs defensive box scores we don't fetch |
| First TD Scorer | No — needs play order |
| Passing Completion % | **Yes** — `comp / att`, both already captured |

Three or four of those are free: the data is already in `normalizeNFLGame`.

### 2.5 Snap %

PropsMadness shows `SNAPS 60.6` in the player header and offers `Snap %` and
`Off Snaps` as filters. Ours is `estimateSnapPct` off `SNAP_PROFILE` — a
**hand-written table of seven players** (`PropLedger.jsx:4621`) — while
`NFL_RATE_COLUMNS` shows a SNAP% column for every RB/WR/TE. For all but seven
players that column is an em dash. `lib/role.js` and `lib/usagePills.js` both
already refuse to use it.

**Either source it or drop the column.** A column that is blank for 99% of the
pool reads as broken.

### 2.6 Outlier's market-detail page, read in full

Their player page (`Props` → any row) carries, top to bottom:

- **Line movement** — a timestamped history of the line with per-move deltas:
  `1:47 PM Sep 07 · 145.5 · −1`, back to `12:57 AM Sep 02 · 142.5 · Open`.
  Shows where the number opened and every step since.
- Hit-rate header across the same windows we use — `Last 10 100% (10 of 10)`,
  with `L5 · H2H · 2026 · 2025` beside it — plus **Average 147.2 · Median 136**.
  We show mean only.
- The bar chart, dated and opponent-labelled, same as ours.
- **Supporting Stats** — the volume context behind the prop: Passing Plays
  (40.4, 63% of 63.9 team plays), Completions, Longest Completion, Passer
  Rating, INTs — with a per-game stacked chart. Toggleable Average / Median.
- **Insights** inline: the same generated sentence their Insights page uses,
  scoped to this player and market.
- **Passing Chart** — a 3×3 field-zone heatmap (left/middle/right ×
  0–10/10–20/20+ yds), circle size = attempts, colour = how the defence grades
  there, plus a **route mix** breakdown (In 77%, Post 42%, Slant 71%, "show all
  8 routes").
- **DET Pass vs Run Rate** — 58% / 42% against a league-average marker.
- **Target and Rush Share** — donut + table (Amon-Ra St. Brown 172 targets,
  31.3%), with **RZ Targets** and **RZ Rush Att** tabs.
- Right rail: **Matchup / Injuries / Insights** tabs, a key defensive stat with
  rank and a favorable/neutral/unfavorable colour, a **Matchup Summary** field
  diagram comparing both teams' season totals, and **Record vs common
  opponent**.

### 2.7 Three of those are free to us

Worth separating from the rest, because they need no new data source:

- **Target share and rush share.** We already capture `tgt` and `rushAtt` per
  player per game. A team's per-game total is the sum across that team's rows,
  and the share falls out. `lib/usagePills.js:99` **already accepts
  `targetShare`** and no call site has ever supplied it — the pill is built and
  waiting.
- **Team pass vs run rate.** The same arithmetic over team logs.
- **Median beside mean.** We compute the mean everywhere; the median is one line
  and is the more honest centre for a skewed distribution like receiving yards.

### 2.8 Things needing data we can't get

Listed so the gap is a known choice, not an oversight: **field-zone and route
charting** (both rivals have it — PropsMadness's Target Zones, Outlier's Passing
Chart), **red-zone shares**, **man vs zone**, **similar players**. All need
PFF/NextGen-class charting we have no feed for.

**Line movement is the interesting exception.** We cannot buy the history
cheaply — but the day an odds feed is switched on, we can start *recording*
snapshots in the Redis we already run, and own a growing line-movement history
from that day forward. It costs nothing beyond storage, because the snapshots
are the odds calls we are already making and caching.

---

## Part 3 — What we have that they don't

Worth knowing, and worth saying out loud on the landing page.

| | Us | PropsMadness | Outlier |
|---|---|---|---|
| Seasons available | 2025 + 2024 + All | 24/25 · 25/26 · 26/27 · All | 2026 + 2025 |
| Rolling windows crossing the season boundary | **yes** (shipped today) | — | yes |
| Depth-chart "Starters only" filter | **yes** | no | no |
| Draggable line on the chart | **yes** | no | no |
| Alt-line ladder, hit rate per rung | **yes** | no | shows alt lines, no ladder |
| Injuries for this matchup on the player page | **yes** | no | no |
| Weather at kickoff | **yes** (once 1.3 is fixed) | no | no |
| Named empty states, nothing silently dropped | **yes** | no | no |
| Free, no login | **yes** | free preview, then paywall | login required |

The last one matters tomorrow, and the shape of it is now precise. **Outlier's
free tier is Insights + Props (with real odds); EV+, Boosts, Arbitrage and
Middle Bets are all "Outlier Pro" only** — I hit the upgrade wall on all four.
PropsMadness runs a "FREE PREVIEW" badge with padlocks on most of the player
rail. Anyone Alex sends a link to can use all of ours immediately.

**Correction to an earlier draft of this document:** I had claimed our
two-season history was ahead of both. It isn't. Outlier carries 2026 + 2025
columns, and PropsMadness's player page has a season selector offering 24/25,
25/26, 26/27 and All. We match Outlier and trail PropsMadness. The genuine
season-related edge is narrower and still real: our *rolling* windows now span
the boundary while the season columns stay separate, which is what stops the
Week 1 collapse.

The honesty rule is a genuine differentiator too, and it is currently invisible.
The landing page says "Counted, not modelled" — but the feed's own line *is*
modelled, which undercuts it. Fixing that means either real odds (2.1) or
relabelling the derived line as ours rather than the market's.

---

## Part 4 — The plan

### Tier 0 — tonight, before anyone sees it

All five are small, safe and independently verifiable.

| # | Change | File |
|---|---|---|
| 1.1 | `anytimeTd` drops `passTd` | `PropLedger.jsx:4970` |
| 1.2 | `DEFAULT_WINDOW.nfl` 5 → 10 | `v3/playerDetailProps.js:23` |
| 1.3 | Desktop conditions test `"dome"`/`"retractable"` like mobile does | `v3/PlayerDetailDesktop.jsx:991` |
| 1.4 | `espnId` onto NFL feed rows (and NBA) | `PropLedger.jsx:19932` |
| 1.5 | Near-certainty suppression catches `0.5` lines | `lib/findings.js` |

**Verify:** Findings no longer shows a QB averaging 3.0 anytime TDs; Goff opens
on 10 games with a non-degenerate alt-line ladder; Ford Field says "Indoors";
every NFL feed row shows a status dot; Findings opens on real findings.
`npm run build`, then push.

### Tier 1 — this week, in this order

1. **Order the switch-player rail by depth chart** (1.7) — data already loaded,
   deletes a caveat.
2. **Price the four free markets** (2.4) — Longest Rush, Longest Pass
   Completion, Receiving Targets, Completion %. 17 → 21 markets from data
   already in hand.
3. **Per-market defence ranks from our own logs** (2.2) — pass yds / rush yds /
   receptions allowed, aggregated from the game logs already fetched. Takes the
   weakest column on the feed from one dimension to four, with no new feed and
   no new cost.
4. **Teammate rows show the with/without difference** (1.6) — the log data is
   already there; this is arithmetic on games already loaded.
5. **Target share and rush share** (2.7) — from `tgt` / `rushAtt` we already
   store. `usagePills.js` has accepted `targetShare` since it was written and
   nothing has ever passed it. Outlier puts this front and centre; it is free
   to us.
6. **Median beside mean** (2.7) — one line, and the better centre for skewed
   markets.
7. **Team insights on Findings** (1.5) — "X are 6-0 in their last 6 on the
   road", from the schedule and results already fetched. Broadens the page
   beyond player props without a new source.
8. **Decide snap %** (2.5) — source it or drop the column.

### Tier 2 — once the odds decision is made

9. **Real odds on the NFL feed** — `Line`, `Odds`, `IP%` columns; the header
   slots at `PropLedger.jsx:17840` were designed for them and deliberately left
   empty. Retire `fairFeedLine` for rows that have a real line, keep it labelled
   as ours for rows that don't.
10. **"Hit rate 60% · odds imply 53%"** on the player page — the one line that
    makes the whole site make sense.
11. **Start recording line snapshots** the same day (2.8). Every odds call
    already lands in Redis; writing each one to a per-market history list buys a
    line-movement panel that gets better every week, at no extra API cost. This
    is the one Outlier feature we can match by starting early rather than by
    buying data.
12. Game-script filters (closing spread / total), then historical closing lines
    if the credit cost proves bearable.

### Explicitly not doing

Field-zone and route charting (Target Zones, Passing Chart), man-vs-zone,
similar players, red-zone shares, EV+/arbitrage/middles. Each needs a data
source we don't have and can't fake, and faking any of them would break the one
rule the project is built on. Worth noting the last three are **Outlier Pro**
features anyway — not part of what a free user is comparing us against.

### Not a gap, checked

**Settings.** Ours already carries theme, motion, odds format
(American/Decimal/Fractional), display size and time zone. Outlier splits the
same ground across "Appearance" and "Betting preferences" and adds only Kelly
staking, which is a Pro feature tied to EV+. No action needed.

---

## Part 5 — Alex's three asks (2026-09-08)

> "remove the 2024 slot for stats, that's too far out"
> "put the more popular starting QBs towards the top of the prop feed default
> view … no reason for malik willis, max brosmer and sheduer sanders to be atop
> the list" — extended to **all offensive positions**

### 5.0 First: half of ask 2 is already fixed and simply isn't deployed

`origin/master` is at **`04558ff`**. Commit **`a150c64` is unpushed**, and it
carries yesterday's "Starters only" depth-chart work (`lib/nflDepth.js`, which
was untracked until today) plus the per-sport minimum-sample fix.

`PROJECT_NOTES` records the verification of exactly this complaint on
2026-09-07: *"Verified on the NFL feed: Brosmer gone, 37 props hidden as 'not on
the depth chart's starting side'"*, and thin-sample rows demoted below rows with
a real sample — which was written up in answer to Alex's *"these too few guys
should not be popping up at the top."*

**Max Brosmer is on the live site because the fix has never been deployed.**
Driving the current code today, the default Pass Yds top is Dart, Goff,
Lawrence, Prescott, Cousins — no Brosmer, no Willis, no Sanders.

So: **push first, then judge.** The remaining structural issue below is real,
but it is smaller than the live site suggests.

### 5.1 Remove the 2024 column

**The rule, stated so it survives the season starting:** never show a season
older than *last* season, measured against the real calendar
(`currentNFLSeason()`), not against whatever season our log happens to hold.

`seasonLabels` (`PropLedger.jsx:21592`) takes the most common `logSeason` among
visible rows as `current` and `current − 1` as `prior`. Today the newest log is
2025 (2026 being empty), so `prior` renders as **2024** — the column Alex wants
gone.

| | today | from Week 1 |
|---|---|---|
| season column | 2025 | 2026 |
| prior column | ~~2024~~ **hidden** | **2025** |

This is deliberately not "delete the prior column". Deleting it outright would
leave the feed showing a lone `2026 · 1 of 1` after Thursday, throwing away the
2025 season exactly when it is most needed. Capping the reach at one year back
removes 2024 now *and* restores a useful 2025 column once the season starts —
which is what "we don't need stuff from that far out" actually asks for.

**Changes:**
- `seasonLabels` returns `prior: null` when `best − 1 < currentNFLSeason() − 1`;
  `FeedTableHeader` (`:17900`) omits the column when `prior` is null, and the
  row cell omits it to match.
- Skip the lazy prior-season fetch (`PRIOR_SEASON_CACHE`, `:19040`) when there
  is no column to fill — saves a request per visible player.
- Player page `SEASON` rail (`2025 / 2024 / All seasons`) gets the same cap, so
  the two screens agree.
- **Leave the Week-1 merge alone.** `NFL_PRIOR_GAME_LOGS` is a different
  mechanism, gated on the current season being in progress, and after Week 1 the
  season it merges *is* 2025. It never reaches back to 2024.

### 5.2 Rank by role, across every offensive position

**Why backups reach the top.** The default sort is hit rate first, with the Sort
By mode breaking ties (`sortedRows`, `:21484`). `fairFeedLine` sets each line
from *the player's own median*, so a low-volume player gets a low line he clears
constantly. Volume and hit rate are therefore inversely related, and the feed's
own code already says so (`FEED_SORT_MODES`, `:20296`): *"reserves reach 100%
more easily than starters, so they hold the top of the list before any tiebreak
is consulted."*

Visible on the current build: **J.K. Dobbins · Over 0.5 Receptions · 90%** sits
seventh on Receptions, on a line his log averages 1.1 against.

**The signal is already computed.** `roleValue` (`lib/role.js:72`) is
position-aware and lands on every row as `r.role`:

| position | role metric |
|---|---|
| QB | pass attempts / game |
| RB | carries + targets / game |
| WR, TE | targets / game |
| K | FG + XP attempts / game |

That covers every offensive position Alex named, without a new data source.

**The change:** add a **role tier** as a sort term *ahead of* hit rate, keeping
hit rate primary *within* each tier.

- For each row, compute the player's percentile of `r.role` **among rows at the
  same position in the same market**, so a WR is compared to WRs and a QB to QBs.
- Bucket into three tiers — featured / rotation / fringe.
- Default order becomes: `thin-sample → role tier → hit rate → matchup`.

A WR1 having a good week leads the list; a WR3 at 100% on a 1.5 line still
appears, under every featured player. Nothing is dropped — this is ordering, not
filtering, per the project's standing rule.

**This reverses a recorded decision and should be recorded as such.** On
2026-08-23 role was deliberately left off the default because *"it reorders the
feed away from hit rate, which is the ordering the screen is built to argue
for."* Tiering is the middle path: the screen still argues by hit rate, but only
among players who actually play. If the tiering reads wrong on the real feed,
the fallback is to keep hit rate primary and use role as the tiebreak instead of
matchup — weaker, but a one-line change.

**Verify:** on Pass Yds the top should stay recognisable starters; on Receptions
and Rec Yds the featured pass-catchers should displace the low-line rows; and
Dobbins' 0.5-reception row should fall well below the fold. Check Rush Att and
Anytime TD too, since RB role blends carries and targets.

### 5.3 Related, not asked for

The Dobbins row points at the same root cause as the Findings trivia problem in
1.5 — a line low enough that clearing it says nothing. Suppressing near-certain
lines on the feed the way Findings already does would fix both from one place.
**Not doing it unless Alex asks** — it changes what the feed shows, not just how
it is ordered.

---

## Sources

Both products were read logged-in on 2026-09-08: PropsMadness's NFL page,
player detail, filter panel (Suggested / Opp Rankings / Splits / Stats) and
closing-lines toggle; Outlier's Insights, Props table, market-detail page,
account and betting preferences, and the Pro upgrade wall on
EV+/Boosts/Arbitrage/Middle Bets. Our own app was driven at the same time —
prop feed, player detail, Findings and Settings.

PropsMadness's pricing page did not render for me, so their price point is
unknown; Outlier's tiering is confirmed (free vs Pro) but not its price.
