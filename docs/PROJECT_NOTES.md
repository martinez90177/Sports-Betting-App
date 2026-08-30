# Project notes

Durable context for PropPalace that isn't derivable from the code or git history.

These began as Claude's per-machine memory on Alex's MacBook. They are committed
here so any machine — and any new session — starts with the same context, since
that memory does not travel between computers.

The companion document is [`REDESIGN_PLAN.md`](./REDESIGN_PLAN.md), which holds
the build order, the design decisions and everything still outstanding.

---

---

## Redesign 15 item build order

The redesign is a fixed 15-item build order Alex set, each item keyed to a
specific design card. The plan lives at
`~/.claude/plans/read-design-handoff-proppalace-redesign-snug-kazoo.md` and is
the working document — read it before starting an item; it is outside the repo
so it is not in git.

**Standing rule:** the design files are the target *layout*, not just
vocabulary. Where the app's structure and the design disagree, the design wins.
Sources of truth: `reference/app-screens.html` for the screens it covers,
`design_handoff_proppalace_redesign/PropPalace Concepts.dc.html` sections 2a-5c
for everything else. Sections 1a/1b/1c are rejected directions. The logo is
three ascending bars in lapis — any arch motif is dead.

**This note is a historical snapshot and goes stale fast — for current status,
read `REDESIGN_PLAN.md`'s "Status as of" line and "Shipped so far" table at the
top of that file, not this paragraph.** As of 2026-08-21: items 1-8 + 5b
shipped (`5b6ce33`, `1e3ec85`, `ee3c461`, `52954f1`, `b085e55`, `76d027a`; item
7 was found already built from earlier work). Items 9/10 (mobile) are next but
paused on purpose — see REDESIGN_PLAN.md for why.

Items **16 (landing page)** and **17 (the board)** were added later from a real
Claude Design handoff in `design_handoff_propplace_landing_board/` (read its
README first). Item 17 carries **four conflicts with already-shipped work**.
Two are now decided by Alex: **multi-select markets** (build it, uncapped, one
shared component across feed and board — a deliberate reversal of item 5's
single-market picker) and **a sport switcher on the board** (all four sports,
reusing the feed's tab row; NFL in the mock was only an example). Also decided: the board ships as an
**addition**, not a replacement — nothing existing is unpicked, and the Games
tab keeps its slate, Gamecast and Matchup page. The board is structurally a Prop Feed
variant, not a revamped Games tab (it has no live/score/matchup machinery at
all) — but **Alex's instruction is to keep feed, board and Games separate and
NOT merge them in any way**, including not migrating the board's minimum-sample
slider or split filters into the feed. The only consolidation question he left
open is whether the Games page later folds into the board. The board also does
**not** replace the prop feed: its job is discovery — "a magnified version that
helps people come up with what props to choose/research" — where the feed's job
is working through props already chosen. Use that as the test for where any new
feature belongs. One conflict remains
open: the form graph changing from margin-height to grounded-at-zero-with-a-
drawn-line.

Multi-select has a **migration trap**: `market` is a single string in
`presets.js` and `filtersEqual` compares with `!==`, so an array field there
makes every saved screen read "Modified" forever, and old share links carry the
string form and must keep working.

**Why:** the order is Alex's, not mine to resequence, and it is deliberately
front-loaded so shared primitives land before the screens that reuse them.

**How to apply:** work one item at a time and report at each item's end rather
than working silently through the list. Verify every change live in the browser
with an error listener armed — a passing `npm run build` proves nothing about
runtime here (see [[vite-builds-clean-on-undefined-identifiers]]). Walk **all
four sports**, not just the one just touched; checking only the sport being
edited is a documented past miss. Flag data-honesty tensions explicitly instead
of resolving them silently.

---

## Vite builds clean on undefined identifiers

`npm run build` passing does **not** mean the code works. Vite/esbuild only
checks that the syntax parses — it never checks that an identifier actually
exists, so a typo'd or unimported name builds perfectly and throws at runtime.

`PropLedger.jsx` imports only `{ useState, useMemo }` from React, so a bare
`useEffect(...)` instead of `React.useEffect(...)` is the classic instance: it
builds clean and then crashes the whole page through its error boundary.

**Why:** this exact class caused a real production outage (commit `4206cd2`,
a name that moved to `src/lib/mlbStatus.js` unexported with a consumer left
behind), and it recurred twice more during the Aug 2026 redesign work. Because
Vercel deploys `master` on push and a failed deploy leaves the live site
silently serving the previous version, a build-only check can look green while
production is broken or stale.

**How to apply:** after editing, always drive the app in the browser before
calling anything done — arm an error listener (`window.__errs` plus a hooked
`console.error` and an `error` event listener), then walk every screen the
change touches across all four sports. Force failure states too, not just the
happy path. Build first, but treat it as a syntax gate only.
See [[redesign-15-item-build-order]].

---

## Free data only no fake edge

Alex decided (2026-08-13) that PropPalace stays on **free data tiers only** — no
upgrading The Odds API past its 500-credit/mo free plan, no paid feeds.

This constrains what can be built. The Prop Feed's odds are *synthetic*:
`probToAmericanOdds()` derives them from the row's own hit rate, so implied
probability equals hit rate by construction. Any "EV", "edge", or "odds imply
X%" readout on the feed would be circular and misleading. Outlier's core
product (EV+, line shopping, arbitrage, middles) is therefore not reproducible
here and should not be approximated.

Real book odds exist in exactly one place: `SportsbookOddsPanel` on the MLB
player page (batter hits/HR only, behind the manual "Get Odds" button, cached
12h server-side). That is the only place an honest edge number can be shown —
see the HIT / FAIR / gap readout added there, which removes the vig via
`noVigProbability()` and carries an explicit caveat that the gap is a research
starting point, not a proven edge.

**Why:** Alex shares the live site publicly from `master`, so a fabricated
edge number would be misinformation with his name on it, not just a UI bug.

On 2026-08-14 Alex was asked directly whether the pick-grading summary should call
the Claude API, and chose **the free, no-API-key version**: the Report tab in
`MyPicksPanel` is deterministic arithmetic over the pick snapshots and graded
results, with no model of any kind. Don't re-propose an LLM call for it.

**How to apply:** Before proposing any feature involving prices, EV, implied
probability, arbitrage or closing-line value, check whether real market odds
actually back it. If they don't, either build it from the game-log data the app
already has, or say plainly that it can't be done for free — don't approximate.

Related: [[proppalace-master-deploys-live]]

---

## Nba data is real — this note used to say the opposite

**Corrected 2026-08-23.** Everything below the line was true on 2026-08-14 and
is not true now. It is kept, struck through in prose rather than deleted,
because the stale version was read and acted on as current as recently as this
correction — the failure mode is the note, not the reader.

### What is actually true

NBA game logs are **real ESPN 2025-26 box scores**. `NBA_REAL_GAME_LOGS` is
filled at runtime by `fetchNBAPlayerGameLog(espnId)`, and `getNBAGames` returns
those. Rosters are live and league-wide through `NBA_LIVE_PLAYERS`, built on
`src/lib/rosters.js`. Team defence comes from `fetchNBATeamDefense`, not a
seeded RNG. The feed carries ~6,000 NBA props across the whole league, and its
disclaimer says "Real 2025-26 regular-season game logs (ESPN Stats API)".

`genGames` still exists as a **cold-start fallback**, reached only when a
player has no `espnId` or their fetch failed, *and* they carry a `base`, *and*
they are not `liveOnly` — in practice the four hand-written teams when a fetch
misses. It is guarded where it matters: a feed row is stamped
`gradeKind: "nba"` **only** when a real log is present, so the Ledger surfaces
a fallback player as unsettleable rather than grading a pick against a
generated number. `nbaRosterNote` states partial coverage on screen while
rosters are still loading.

### Do not "fix" this by labelling NBA as simulated

The old note's suggestion — badge the NBA feed as simulated — was considered
and **deliberately removed** once the logs became real. `FEED_SPORTS` in
PropLedger carries the reasoning inline: a badge saying the numbers are
generated when they are ESPN box scores "would be its own kind of wrong
number". Adding it back is the error, not the fix.

### How to apply

Check the code before repeating a dated claim from this file. This note was
written 2026-08-14; the data track that superseded it ran on 2026-08-20 and the
plan's own summary table already said "B done for NBA". A note carrying a date
is evidence about that date, not about today.

Related: [[free-data-only-no-fake-edge]], [[outlier-benchmark-phases]],
[[data-track-live-rosters-and-real-logs]]

---

## Data track live rosters and real logs

A second track of work Alex asked for on 2026-08-20, separate from the 15-item
redesign and runnable independently. Written up in full at the end of
`~/.claude/plans/read-design-handoff-proppalace-redesign-snug-kazoo.md` under
"Data track".

**Largely done — see docs/REDESIGN_PLAN.md for the authoritative state, not this
paragraph.** As of 2026-08-23: live rosters ship for all four sports on
`src/lib/rosters.js`, and NBA/MLB/WNBA all read real game logs. What follows
describes the asks as they were framed, which is still useful for *why*; it is
not a to-do list any more.

Two asks, deliberately distinct because their scopes differ:

1. **Live rosters — all four sports, NFL included.** Every sport must reflect
   trades and free-agent signings. NFL's game logs are already real but its 32
   rosters are hand-written arrays, so it has the staleness problem too. The
   whole solution is *fetch rather than hand-author*: trade tracking is a free
   property of fetching and is lost entirely by hard-coding. `fetchWNBATeamRoster`
   is the existing pattern to generalise into `src/lib/rosters.js`.
2. **Real/deeper game logs — NBA, MLB, WNBA** (last season including playoffs).
   NBA was by far the biggest at the time of writing — no real game-log fetcher,
   4 of 30 rosters, seeded-RNG defence ranks. **All three of those are now
   done**; see [[nba-data-is-real-this-note-used-to-say-the-opposite]].

**Why:** the app's whole promise is real hit rates, and a generated number is
indistinguishable from a real one on screen — so anything synthetic is a
standing honesty risk, not just a gap. See [[free-data-only-no-fake-edge]].

**How to apply:** don't start building without settling the three questions the
plan flags — whether playoff games belong in hit-rate windows, what a traded
player's prior-team history means for team badges and splits, and whether last
season outranks the in-progress one. Size it honestly: the log backfill is ~450
NBA requests alone and the existing caches were built for a few teams on one
day's slate, not a league-wide historical pull.

---

## Mlb per market def ranks

The MLB `OPP RANK` badge ranks each market by its own defensive stat, not by
team ERA (shipped 2026-08-15). Batter markets rank the opponent's
`teams/stats?group=pitching` line, pitcher markets their `group=hitting` line —
both from `statsapi.mlb.com`, which returns 50+ fields per team, not just ERA.

Three markets have **no** real per-market source, and this is settled, not an
open gap:
- **RBIs** and **H+R+RBI** — there is no RBI-allowed stat and H+R+RBI is a
  composite. Both borrow the runs-allowed rank and the badge label says
  `opp runs allowed / 9`, so it reads as a labelled proxy.
- **Outs Recorded** — gets no badge at all. How long a starter goes is his
  manager's decision, not a property of the opposing lineup.

**Why:** Alex caught that a runs-allowed rank beside a Home Runs or Stolen Bases
prop is a category error. On 2026 data the ERA rank missed the strikeout rank by
12.1 places on average (max 27) — Colorado read as the softest strikeout matchup
in baseball when by strikeout rate they were nearly the toughest.

**How to apply:** every rank carries its own `label` describing the number it
measures; never label a badge with the market name when the number isn't that
market. Ranks are rates (per 9 IP or per game), never totals, or mid-season
games-played does the ranking. Rank 1 always means "most suppresses this stat",
which needs no inversion for strikeout markets.

These ranks are unadjusted for park and schedule strength — Coors inflates
Colorado's hits-allowed rank. Was equally true of the ERA version, but it
matters more now the badge is market-specific. Related:
[[free-data-only-no-fake-edge]], [[production-url-and-cron]].

---

## The dev server does not run `/api/*`

`npm run dev` is Vite, not Vercel. It has no serverless runtime, so it serves
the **source** of every file in `api/` as a static asset: `GET /api/news`
returns 200 with `content-type: text/javascript` and the body is the function
itself. Verified 2026-08-23 for all four — `news`, `odds`, `mlb-matchups`,
`refresh-mlb-matchups`.

The caller does `res.json()`, that throws on JavaScript source, and the screen
falls back to its empty state. Which means the empty state is the *only* thing
those three surfaces have ever shown locally:

- the News page's headline feed,
- the odds panel on every feed row ("Coming soon"),
- MLB matchups served from Redis rather than fetched live.

**Why:** "drive the app in the browser before calling it done" is the standing
rule (see [[vite-builds-clean-on-undefined-identifiers]]), and this is the hole
in it. A change to any of those three can be driven, look correct, and be
completely unexercised — the fallback renders identically whether the code
behind it is right or absent.

**How to apply:** treat the three surfaces above as untested by local driving.
Either stub the response in the browser (`window.fetch` override, or paste the
provider's real JSON into the parse path) or verify on production after the
push. Do not report them as verified off a dev-server run, and do not read
"Coming soon" or an empty News feed as a bug — that is what an unrun serverless
function looks like here.

---

## Production url and cron

PropPalace production: `https://sports-betting-app-ruddy.vercel.app/`

This is not recorded anywhere in the repo — no `.vercel/project.json`, no URL in
the README, and the Vercel CLI is not installed locally. I had to ask for it.

`/api/refresh-mlb-matchups` is the nightly cron (07:00 UTC, `vercel.json`) that
writes the MLB team defence ranking to Upstash Redis. As of 2026-08-15 it
requires `Authorization: Bearer $CRON_SECRET` and returns 401 without it, so it
can no longer be triggered by hand from here — only the Vercel cron can run it.
A successful run returns `{ok, teams: 30, markets: 13, hitting: 30}`; `markets`
is the field that proves the per-market ranking code ran. See
[[mlb-per-market-def-ranks]].

To check whether a push has finished deploying, compare the asset hash: `ls
dist/assets/index-*.js` after a local `npm run build` against the
`assets/index-*.js` in production's served HTML. Vite hashes are content-based,
so identical hashes mean identical code.

---

## Outlier benchmark phases

On 2026-08-13 Alex sent screen recordings of **Outlier** (`app.outlier.bet`) and
**PropsMadness** as benchmarks for PropPalace. The resulting plan lives at:

`/Users/alexmartinez/.claude/plans/users-alexmartinez-downloads-lbhmwan1oj-effervescent-nygaard.md`

**All phases are DONE and pushed to `master`** (commit `3b0475a`, 2026-08-14):
Phase A (feed: Over/Under toggle, form strip, cushion, popover, MLB lineup dot),
Phase B (chart context-stat overlay, MLB HIT/FAIR/gap), and Phase 2 (the auto-graded
Ledger + parlay correlation warning).

Design decisions worth not re-deriving:
- Picks settle against the game logs the app **already** fetches/caches — no new
  data source. `gradeKind`/`gradeId` on each feed row picks the log; NBA rows carry
  neither because `genGames` is a seeded RNG.
- Grading waits **6h past first pitch** (`PICK_SETTLE_DELAY_MS`): MLB's game log
  returns a split for a game still in progress, so grading at start time would
  settle off a half-finished box score.
- Pick ids include the game date, so the same player/market on a later date is a
  distinct pick and can't overwrite a graded one.
- The settle effect releases its `gradeAttempted` claims in cleanup — without that,
  StrictMode's dev double-invoke means nothing ever grades.

**Still uncommitted in the working tree (not mine, left alone):** a one-line
`src/GamesPage.jsx` change removing the `gm-tab` class, and an untracked `dev-mac.sh`
(since committed, and since renamed — see "The Mac launcher is .command" below).

Related: [[free-data-only-no-fake-edge]]

---

## The MLB feed was empty between midnight and 3am — 2026-08-24

`currentMLBDayKey()` (`src/lib/mlbStatus.js`) reports **yesterday** until 3am
ET. That is right for a cache key: a game that started at 10pm is still last
night's game at 1am, and rolling the key at midnight would drop a live game.

It was also the *only* answer to "which slate should the feed show", and those
are different questions. Between midnight and 3am the feed fetched a slate on
which every game was final, printed "NO GAMES LEFT TODAY — EVERY GAME HAS
FINISHED", and built zero rows. MLB was blank for three hours every night —
and they are not idle hours for someone reading up on a slate.

Found by accident: the Games page showed 10 MLB games with a 6:40 PM start
while the feed on the same screen said every game had finished. One of them had
to be wrong.

`fetchMLBDaySlate` now falls forward to `easternDateKey()` once every game on
the rolled-back day is `abstractGameState === "Final"`. Checked against the
games, never the clock, so a west-coast game running to 1:30am still holds the
slate on yesterday. The sessionStorage key went to `mlb_day_slate_v4`, since a
leftover v3 payload would put the feed straight back on last night.

**If MLB ever looks empty, check the hour before you check anything else.**

## Verification is hostage to the MLB slate

Three of the competitive-brief items are MLB-only, and MLB is the one sport
whose rows depend on today having games left. Between the bug above and an
ordinary off-day, "MLB shows nothing" is the normal state for a lot of the
clock, and it is not evidence of a regression.

When a change touches MLB, drive it through a **pitcher** prop specifically —
`Strikeouts Thrown`, not `Strikeouts`, which is the batter market and sits
beside it in the same pill row. The expected lineup and the percentile pair
only render for a pitcher.

## Savant gives more than the pills asked for

`src/lib/statcast.js` fetches one CSV per side for the whole league, so adding
a column costs nothing — `whiff_percent`, `oz_swing_percent` (chase) and
`xwoba` were added for the lineup table and the percentile pair and ride along
in the same request.

Two things that are easy to get wrong there:

- **Chase% is `oz_swing_percent`.** There is no `chase_percent`.
- **A percentile needs a qualifying floor or it is meaningless.** Without one
  the population includes several hundred players with a handful of plate
  appearances and 100%/0% rates, and every regular lands near the middle.
  `POPULATION_MIN` is 100 PA for batters, 20 IP for pitchers.
- A **mean** placed among **individuals** sits nearer the middle than its own
  members. A nine-batter lineup averaging 25.0% K reads as the 67th percentile
  while its hitters run to the 90th. Stated in the component's own footnote
  rather than silently.

## The prop feed only looks two days ahead — 2026-08-24

`FEED_LOOKAHEAD_MS` in `PropLedger.jsx` is 48 hours, with six hours of grace
behind now so a game already under way stays listed.

Before it, the feed showed every player in the league with a game anywhere on
the schedule: in late August that was **6,032 NBA props for a season starting in
October** and 3,089 NFL props for a Week 1 kickoff twenty days out. Alex called
it — "it leads to unnecessary info being presented when a player isn't even
playing but is taking up space" — and pointed at Outlier.

Checked against them rather than assumed: Outlier's MLB props page that same
afternoon carried only that day's fixtures, and **their NFL props page was
empty**. Empty is the right answer out of season. This app says which sport,
names the next kickoff, and offers a "show that slate" button rather than
silently backfilling.

**If a sport's feed looks empty, read the sentence before assuming a bug.** The
scope resets to `near` on every sport switch, deliberately: someone who opened
the whole NFL schedule has not asked for the same on MLB.

### …except in a weekly league — 2026-08-30

Forty-eight hours is a *daily* league's slate, and the rule above is right for
MLB, the NBA and the WNBA, which play most nights.

The NFL plays once a week, so the same window empties the page for about five
days in seven — mid-season, with a full slate four days out and the props up
everywhere else. On 2026-08-30 the opener was ten days away, the feed read "no
props to read yet", and FanDuel had been taking bets on those games for a
fortnight. Alex: *"i see stuff available on fanduel so that means it's active"*.

So `WEEKLY_LEAGUES` (currently just `nfl`) anchors its window on **the next
kickoff rather than on the clock**, and keeps `FEED_SLATE_SPAN_MS` — five days
— from it. Five covers Thursday night through Monday night, takes in the
December Saturdays and the international Sunday mornings, and stops before the
following Thursday, so it is one slate and never two.

`FEED_SLATE_HORIZON_MS` caps the reach at 28 days, which is roughly when books
begin pricing a week. Past it the anchored window would drag a September slate
onto a July screen — which is the twenty-days-out complaint the fixed window was
added to answer — so beyond the horizon it falls back to the fixed window, comes
up empty, and names the day.

This does not walk back the rule above. The complaint that set the 48 hours was
3,089 NFL props for a kickoff twenty days out: the whole 17-week season at once.
**One week is a slate. Seventeen is a database.**

The copy follows the league too (`slateWord`): the chip reads "This week's
slate" rather than "Next two days", and the empty state says "this week"
rather than "today or tomorrow".

## Where the availability designation comes from, and where it does not

`buildNewsInjuryWire` gates on WNBA and MLB. That is not an oversight — the NFL
and NBA publish nothing this app can read, which is also why the NFL player
page's rail legend says "no availability feed for this league".

`INJURY_FEED_SPORTS` and `INJURY_FEED_MISSING` sit directly above that function
so the Injuries page can *name* the missing two. A league filter that offered
NFL and returned nothing would read as "nobody in the NFL is hurt", which is a
worse failure than the missing feed.

## The rail's batting order is derived, not published

MLB publishes a lineup only once it is posted, usually an hour or two before
first pitch. Before that the rail orders batters by **plate appearances per
game** — a leadoff bat sees about 4.6 and a number nine about 3.9, so the slot
is a real derivation rather than a guess.

The obvious-looking alternative is wrong and was tried: the static roster arrays
in `MLB_MATCHUPS` *are* written in batting order, but `applyActiveRoster` filters
them and `topUpProjectedBatters` appends call-ups to the end, so what survives is
roster order with holes. It put Yandy Díaz ninth for Tampa Bay behind a backup
catcher.

Posted slots render filled, projected ones outlined, and a batter with fewer
than five logged games gets `#—` and sorts last. That last case is not a bug and
was reported as one: Corey Julks had three games and six plate appearances all
season.

## Adding a nav tab breaks the phone row — 2026-08-24

`.pp-nav-tabs > button` used `flex: 1 1 0`, dividing the row equally. That was
right for the four tabs the mobile handoff drew and broke the moment Findings
and Injuries joined them: six tabs at 54px each on a 375px screen, with "THE
BOARD" needing 63, so the labels ran into one another — Alex's phone showed
`THE BOARDINDINGSPROP FEED`.

The row scrolls now (`flex: 0 0 auto` + `overflow-x: auto` + a mask fade), so
tab count no longer has an upper bound. **If you add a seventh, nothing needs
to change.**

## A fixed window cannot meet a minimum larger than itself

`feedWindowFloor(minGames, window)` clamps the sample floor to the window's own
length: L10 can never hold more than ten games, so requiring fifteen made every
row in that column read "too few" forever.

The code already knew this and applied it to L5 alone, with the note "without
that exemption the L5 column would read 'too few' on every row in the feed". It
was never generalised, and at MLB's default of 15 the same thing had quietly
become true of L10 — invisible on desktop, where L20 and Season still print
rates, and total on the phone card, which shows only the active window's rate.
Alex's screenshot was a feed where every card said `TOO FEW · 10 games`.

Season is the window with no cap, so it is where the minimum applies in full.
That is the honest place for it: "I don't trust a rate under fifteen games" is a
claim about a season record, not about a ten-game window that announces its own
length in its title.

## Inline grid templates cannot be made responsive

Three research grids — `.board-layout`, `.pp-findings-grid` and the player
page's — declared `grid-template-columns` inline. A media query cannot override
an inline style, so on a 375px screen the board's `196px minmax(0,1fr) 196px`
computed to **196 / 0 / 196**: both rails landed on top of each other with the
games crushed to nothing between them.

The templates live in `index.css` now. **When adding a new multi-column page,
put the template in the stylesheet from the start** — the inline version looks
fine on the machine you build it on and is unfixable from CSS later.

## The phone was on the v1 player page until 2026-08-24

All four player pages ended with `if (!isNarrow) return v2Page;` — `useIsNarrow()`
defaults to **480px**, so every phone got the pre-v2 design. The reasoning at the
time was that the mobile handoff had its own design for this screen; the effect
was that a phone saw two charts, a "THE READ" block the v2 verdict row replaced,
a context row whose columns overlapped, and a graph with no line tag.

Alex, looking at it: *"the whole player detail page in general looks very v1
anyway, is this even correctly updated?"* It was not. The gate is now
unconditional and the v2 chassis folds at 560 as well (`.pp-pd-crumb`,
`.pp-pd-band`, `.pp-pd-context`, `.pp-pd-hero-id`).

The v1 branch below each `return` is unreachable now and was left in place
rather than deleted in the same pass. **It is dead code — do not "fix" bugs in
it.**

## Sizing an avatar's wrapper does nothing

`PlayerAvatar` renders at whatever `size` prop it is given. Shrinking the
wrapping span in CSS leaves the avatar at its original size and lets it overflow
— a 72px box round a 104px avatar spilled 32px down onto the player's name, and
measuring the *wrapper* said there was 16px of clearance while the screenshot
showed an overlap.

**Measure the inner element, not the box.** And if a portrait needs to be
smaller, change the `size` prop, not the CSS.

## Watching and My Picks are two lists, not one

Until 2026-08-24 they were the same thing wearing two names. Every player page
wired both controls to the same handler and read the same state:

```jsx
watching={isPagePickAdded}
onToggleWatch={() => onTogglePick(buildPagePick())}   // "+ Watch"
onAddPick={() => onTogglePick(buildPagePick())}       // "+ Add to my picks"
```

So pressing "+ Watch" silently put a leg on the betslip, pressing "Add to my
picks" silently flipped the breadcrumb to "✓ Watching", and nothing anywhere
answered *"what am I watching?"*. It only became visible once the pick button
moved up into the chart header (`7599bb4`) and the two sat inches apart.

They are now independent:

| | list | localStorage key | means |
|---|---|---|---|
| My Picks | `myPicks` | `propLedgerPicks` | I have money on this |
| Watching | `watched` | `propPalaceWatch` | tell me about this |

Both are keyed by the same `pagePickId`, so a prop can be on either, both or
neither, and every page can ask about each independently (`isPagePickAdded`,
`isPageWatched`).

**A watch item is not a pick item.** `buildPageWatch()` spreads
`buildPagePick()` and then adds what it takes to *draw* the prop somewhere else:
a `headshotSrc` (and `fallbackSrc` for MLB), because the watch list renders from
localStorage on a different page days later, with none of the originating
page's state in reach. It also rewrites `subtitle` to use the page's display
label — the slip stores the raw market id (`"Over 1.5 h"`), which reads fine
next to a betslip's market column and badly as the only line naming a prop.

**No status is stored on a watch item.** Availability is a fact about right
now; a day-old `"active"` redrawn as a green dot is exactly what rule 2 exists
to stop. The list draws the avatar (rule 1) with no dot.

**Two surfaces, one panel** (`src/WatchList.jsx`). The toggle has to be about
some particular prop, so it only exists where one is on screen; the list does
not, so it also hangs off the nav bar:

| | where | does |
|---|---|---|
| `WatchControl` | player detail breadcrumb | toggles this prop, opens the list |
| `WatchMenu` | nav bar (`extraRight`) | opens the list |

Player detail has no nav (see `NAV_PAGES`), so the two never appear together.
Settings renders its own `NavBar` and spends `extraRight` on its Done button,
so it has no watch menu; Landing draws its own nav for the same reason.

Phone gotcha: `.pp-nav-watchword` hides the word at 560px, leaving a 30px
button — and a 330px panel right-aligned to a 30px button 178px from the left
edge starts at **x:-121**, off screen, with no scrollbar to say so because
negative overflow only clips. Under 560 the panel anchors to `.pp-nav` instead
of to the button.

## Space Mono's "@" is unreadable small — there is a font-level fix

Below about 12px the ring closes up and what is left reads as a lowercase "a".
Every road fixture in the app was affected: the game-by-game axis printed
`aSD  aSTL  aMIN` down the whole strip, the venue line said `PHI a SEA`. Alex,
2026-08-24: *"the @'s are horrific"*.

The fix is **not** in any string. `src/index.css` declares a face that exists
only to supply that one character:

```css
@font-face {
  font-family: 'PP At';
  src: local('Segoe UI'), local('Helvetica Neue'), local('Arial'), …;
  unicode-range: U+0040;
}
```

**Every mono stack in the app lists `'PP At'` first** — all 27 of them, in
`index.css` and in the inline `MONO` constants. A later family is only
consulted for characters the earlier ones lack, and Space Mono *has* an "@", so
a stack that forgets the prefix silently goes back to the broken glyph. If you
add a mono stack, add the prefix.

Sources are all `local()`: no download, and a machine with none of them falls
through to Space Mono and renders as before. The failure mode is the status quo.

Separately, on the axis and in the game-log table the marker is its own span —
dim where the abbreviation is the team's colour, a size larger, with a real gap.
That is about *meaning* (a marker is not a letter of the word beside it) and
still holds now the glyph is legible.

## Dark crests need `lift`, not a bigger tint

`TeamLogo` assumed "a dark crest on near-black still reads because it sits on
the tinted disc the caller already draws". It does not. San Diego's brown
behind a 15% tint was an empty grey circle on the game-by-game axis.

`<TeamLogo … lift />` traces the mark's own edge with two stacked light
drop-shadows instead of putting a container round it. It flips with the theme
and is imperceptible on an already-bright crest. `BandHalf` and `BoardPage`
still carry their own hand-written copies of the same filter — they predate the
prop and could move onto it.

## The Mac launcher is `.command`, and must stay that way — 2026-08-25

Uploading this folder failed with:

> Couldn't upload Sports Betting App/dev-mac.sh (.sh files aren't supported).

The upload filter keys on the **extension**, so the script itself was fine and
nothing in the repo ever invoked it — `package.json`, `vercel.json`,
`vite.config.js` and `.claude/launch.json` all ignore both launchers.
`dev-mac.sh` is now **`dev-mac.command`**. Do not rename it back: `.sh` blocks
the upload, and `.command` is the better macOS idiom anyway — Finder runs a
`.command` in Terminal on double-click and merely *opens* a `.sh` in an editor.

Two things fixed in passing:

- **It was never executable.** Git had it at `100644`, so a fresh clone on the
  Mac could not run it at all — double-clicking would have done nothing. Now
  `100755`, set with `git update-index --chmod=+x` (the way to do it from
  Windows, where the filesystem has no exec bit to copy).
- **Line endings are pinned per launcher** in `.gitattributes`: `*.cmd` to CRLF
  for `cmd.exe`, `*.command` to LF for bash. The blanket `* text=auto eol=lf`
  was checking `dev.cmd` out with Unix endings, which four simple lines survive
  but a `goto` or a label would not.

Both launchers exist only to put node on `PATH` for a double-click launch.
That is why an npm script cannot replace them: without node on `PATH` there is
no `npm` to run one.

If another `.sh` ever appears in the folder it will block uploads again — the
filter looks at the working tree, not at git, so `.gitignore` is no defence.

## Who played in a past game — the participation record — 2026-08-28

`src/lib/participation.js` answers one narrow question: *did this specific
player appear in this specific finished game?* It is what turns "Davante Adams
averages 5.1 catches" into "Adams in the six games Puka Nacua missed", and it
backs both the With/Without teammate tiles and the absence split under the
chart.

**Three mechanisms, one per league family**, because the sources genuinely
differ:

| League | Source | Why |
|---|---|---|
| MLB | statsapi `game/{gamePk}/boxscore` → `batters` + `pitchers` | Already existed as `fetchMLBGameBoxscoreLineupIds`. The `players` dict is the whole active roster including the bench; those two arrays are who actually appeared. |
| NBA / WNBA | `site.api.espn.com/.../summary?event={id}` → `boxscore.players[].statistics[].athletes[]`, skipping `didNotPlay === true` | A basketball boxscore lists the entire active list, flagging DNPs with a reason. One request answers for both teams exactly. |
| NFL | `sports.core.api.espn.com/v2/.../events/{id}/competitions/{id}/competitors/{teamId}/roster` → `entries`, skipping `didNotPlay === true` | **The NFL summary boxscore cannot be used.** It lists only players who recorded a statistic — 71 names in a game where 128 dressed. A receiver who played thirty snaps and was never targeted is simply absent from it, and would be counted as a game he missed, which corrupts exactly the number the feature exists to produce. The core game roster is the dressed list with a per-player flag. Verified CORS-open (`access-control-allow-origin: *`) and serving 2024 games. It answers one team per request, which is the team we want anyway. |

The competition id equals the event id for every NFL game ESPN serves, and
`TEAM_ESPN_IDS` in `lib/rosters.js` supplies the competitor. Our `WAS` is
ESPN's `WSH`; `TO_ESPN_ABBR` handles it, the same pair `nflOurAbbr` converts the
other way.

A finished game's participation cannot change, so everything is cached with no
TTL (in-memory Map + sessionStorage, `pp_part_v1_*`). **A failed request is not
cached** — the next visit retries rather than inheriting a network blip as a
permanent hole.

Three states, never two: a Set (played / did not play), `null` (the request
failed — the game is *unchecked* and is dropped from both sides of a split),
and absent from the map (not asked yet).

### What had to be repaired to make it possible

- **The three ESPN game-log parsers grouped stats by `ev.eventId` and then threw
  the id away** in the `.map()`. Without it there is no key to join a
  teammate's participation against a player's log, which is the whole reason
  NBA/NFL/WNBA had no teammate filter while MLB had one. All three now keep it,
  and their payload cache keys were bumped (`nba_gamelog_v3_`, `nfl_gamelog_v4_`,
  `wnba_gamelog_v4_`) — a stored payload without the field makes the control
  quietly not appear, which is the failure those version bumps exist for.
- **`normalizeNFLGame` rebuilds a game from a named field list rather than
  spreading it**, so it dropped `eventId` again one layer further down. The
  symptom was every NFL player reading "generated fallback, no game ids" with a
  perfectly real log behind him. Its own comment already warned about this,
  from the time it did the same to `seasonType`/`season`/`team`. Anything a
  surface needs must be named in that object.

## Availability: all four leagues, from a fetch that was already happening — 2026-08-28

`lib/rosters.js` `fetchTeamRoster` has always parsed `athlete.injuries` into
`out` / `questionable` / `active` for **every** league — it is one ESPN
`/teams/{id}/roster` response and the status map comes back in `res.byId`.

The NBA and NFL call sites kept `res.players` and **discarded `res.byId`**. So
four surfaces said "this league publishes no player availability feed this app
can read" while the app was fetching that league's injuries thirty-two times on
mount. On 2026-08-28 the endpoint was serving 16 designations for the Chiefs,
20 for the Eagles and 1 for the Celtics.

Now stored in `NBA_ROSTER_STATUS` / `NFL_ROSTER_STATUS` and read by
`pickStatus`, which had only `wnba` and `mlb` branches. `INJURY_FEED_MISSING`
is empty and `INJURY_FEED_SPORTS` lists all four.

An id the map has never heard of returns `undefined`, not `"active"` — before
the fetch lands the map is empty, and a whole league reading available would be
a claim rather than a gap (CLAUDE.md rule 2: unknown draws no dot).

The hand-written NFL pool has **no `espnId` field** — its ids are slugs and
`NFL_ESPN_ID` maps them. `nflHeadshot` has resolved it that way since it was
written; anything else reading an ESPN id on that page must do the same or it
silently sees an empty roster.

## Every number on screen is measured — the generators are gone — 2026-08-28

Alex, after being told Davante Adams had no real log: *"every single player that
is on this site should have real data nothing mocked or generated."*

Four generators produced numbers that appeared under real players' names. All
four are deleted, not gated:

| Removed | What it produced |
|---|---|
| `genGames` (NBA) | A whole seeded season per player from a hand-written base/variance pair. |
| `genWNBAGames` | The same, for the WNBA. |
| `genSyntheticNFLGames` + `SYNTHETIC_NFL_STAT_BASE` + `syntheticOpponentPool` | A seeded season for every hand-written NFL player, against invented opponents. |
| `genOpponentHistory` (NBA) | Two prior seasons of invented meetings against a real opponent, **with scores**, plus a fabricated 5–7 game playoff series for one opponent in five. |

`getNBAGames` / `getWNBAGames` / `getNFLGames` now return the real ESPN log or
an empty array. Empty means the player is not listed — every consumer already
had that path, because `liveOnly` players have always taken it.

### The coverage was measured before the cut, not guessed

Each hand-written pool's ESPN ids were queried against the gamelog endpoint:

| Pool | Real log | None |
|---|---|---|
| NBA (4 hand-written teams) | 20 / 20 | 0 |
| WNBA (10 teams) | 50 / 50 | 0 |
| NFL | 246 / 256 | 10 |

The ten NFL misses are `adams, kelce, sea_price, no_lance, ten_tate,
pit_bernard, lv_mwashington, gb_smack, was_stevens, ari_love`. Davante Adams is
the instructive one: ESPN has him on the Rams' current roster under id 16800,
lists seasons 2014–2025 in his gamelog filters, and returns **zero events for
every one of them**. The core API agrees — his 2025 eventlog is an empty stub
where Nacua's carries 17. There is nothing to fetch; he is dropped.

Pool sizes after the cut, read off the running feed: NFL 3051 props, NBA 6019,
WNBA 1798, MLB 1199. Nothing collapsed.

**The search index now filters on having games**, for the reason the MLB branch
already documented: a hit that navigates to a page with no games is a dead end.
Searching "Davante" or "Kelce" returns nothing; "Nacua" returns him.

### The opponent history is real meetings now

`oppHistory` reads `logGames` — the merged multi-season log the Scope control
already draws on — filtered to the opponent, split on `isPlayoffGame`. Brunson's
log alone holds 177 real games across 2025 and 2026, 37 of them postseason, with
14 real meetings against Boston. The generator was inventing 2–4 per season.

### Team defence: NBA now matches MLB's rule

`getNBADefRank` returned a per-market **seeded** table (`buildDefenseCategoryFor`,
seeded off a hash of the market name) whenever ESPN's standings had not landed,
and permanently for dd/td via `TEAM_DEF`. It now returns `nbaTeamDefReal` or
`null`, which is what `getMLBDefRank` has always done. Consumers draw an em dash
rather than a rank. Verified unaffected in practice: the real table loads, and
the matchup cell still reads "PHI ALLOWS 116.1 · #19 of 30 · MID".

`TEAM_DEF` and `MLB_TEAM_DEF` still exist as objects — MLB's is overwritten in
place by the real ranking and gated behind `mlbTeamDefReal`, and both are now
unreachable as a *displayed* rank.

### Still generated, and deliberately

Nothing in the player or team data. `mulberry32` survives only for
`buildDefenseCategoryFor` (now unreachable from the NBA path) and the two
cold-start rating objects described above.
