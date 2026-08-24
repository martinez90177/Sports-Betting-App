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
`src/GamesPage.jsx` change removing the `gm-tab` class, and an untracked `dev-mac.sh`.

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
