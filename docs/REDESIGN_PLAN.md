# PropPalace — working plan

The single source of truth for what is being built, what has shipped, and what
has been decided. Read this before starting any item. It is committed to the
repo on purpose: this project is worked on from more than one machine, and
Claude's own memory does not travel between them.

**Status as of 2026-08-24 — Items 1–18 shipped; the v2 rebuild and the
transcription pass are complete; data track sections A and C complete; the
competitive brief (all eight items) is built.** What has happened since the
transcription pass is Alex reading the built screens and calling changes on
them — see "After the transcription pass" and "The competitive brief" below.

## The five tracks

| Track | What it is | State |
|---|---|---|
| **Redesign, items 1–15** | The numbered build order against the design cards | **All shipped.** |
| **Items 16, 17 & 18** | Landing, board and the Games redesign, from the full handoff | **All shipped.** Its prop-feed screen shipped earlier, out of sequence |
| **Data track** | Live rosters (all four sports) + real game logs (NBA/MLB/WNBA) | **A and C done.** B done for NBA; MLB/WNBA logs were already real. See below |
| **Monetisation track** | Accounts, Stripe subscription, beginner tutorial | Not started. Full spec in [`ACCOUNTS_SUBSCRIPTION_TUTORIAL.md`](./ACCOUNTS_SUBSCRIPTION_TUTORIAL.md) |
| **Item 5b** | WNBA game chips + concluded-game filtering | **Shipped** (`ee3c461`, `52954f1`) |
| **v2 rebuild** | Every screen rebuilt against `design_handoff_proppalace_v2/` | **First pass complete**, `98f8579`…`c34df94`. A second, element-for-element pass is **complete, 12 of 12 screens** — see "The transcription pass" below |

The tracks are independent. Redesign items follow Alex's order and are not to be
resequenced; the data and monetisation tracks can run whenever.

**The landing/board handoff turned out to have three screens, not two.** Its
third, `PropPalace Prop Feed.dc.html`, is a redesign of the already-shipped feed
rather than a new surface, so it was built out of sequence on Alex's direct
instruction (2026-08-21) rather than waiting behind items 10–15. It is done —
`84a7182` and `7c9872c`. Conflicts 1 and 2 below were both resolved by that
work: markets are multi-select everywhere on the feed, and the form graph is
grounded at zero with a drawn line. Items 16 and 17 inherit both.

**Item 9 was a real, largely-unbuilt mobile redesign**, not the
mostly-built-already polish pass that 6–8 turned out to be — new single-column
touch cards and a REFINE bottom sheet that the app's existing `isNarrow`
responsive tweaks didn't cover. Expect 10–15 to be the same kind of work.

## Shipped so far

| Commit | What |
|---|---|
| `5b6ce33` | Items 1–4 — player detail, matchup card, matchup overview, games slate |
| `1e3ec85` | Item 5 — prop feed to card 713 |
| `ee3c461` | Item 5b — WNBA game chips, concluded games drop from the picker |
| `52954f1` | Feed drops props whose game has already been played |
| `eba554f` | Made the project portable — this plan, the notes, the design handoff |
| `b085e55` | Item 6 — Settings to card 647, Lapis as the new default accent |
| — | Item 7 (News, card 4a) — found already fully built from earlier, pre-15-item-order work (`81ded6b`/`29a5572`). Confirmed live, no changes needed |
| `76d027a` | Item 8 — alt lines and legs: safer-rung suggestions, restyled slip price/correlation block |
| `d429677` | Item 9 — mobile prop feed to card 3a: single-column touch cards, REFINE sheet, sticky picks bar |
| `84a7182` | Prop feed redesign (landing/board handoff, screen 3) — filter card, multi-select markets, grounded-at-zero graph with a draggable line |
| `b3cb9b0` | Bug — WNBA player page threw instead of rendering its own "not on today's slate" guard. Pre-existing since `c539e5c` |
| `7c9872c` | Prop feed redesign, part 2 — the table itself onto the handoff's `34/262/250/88/80/1fr` grid |
| `e0af95d` | Feed table header stops sticking; the clip/auto breakpoint it needed goes with it |
| `f8e960d` | Item 15 — the palace mark, in the header lockup and the favicon |
| `9cae0e9` | Windowed form-graph axis, scaling drag step, and Andrew Wiggins' headshot |
| `3c8714f` | Item 9 revisit — mobile feed to the new handoff, plus `MinSampleControl` |
| `dccb765` | Item 10 — mobile prop detail: verdict figure, form-graph card, The read |
| `7ba3f01` | Items 12–14 — the My Picks drawer onto cards 5a, 5b and 5c |
| `ef9b6f9` | Item 16 — the landing page, on real rows only |
| `52c7e0f` | Item 17 — the board, as its own surface |
| `2118119` | Item 18 — Games redesign: the gamecast folds in under its row |

**Item 11 ("mobile rows in 2a") was absorbed, not skipped.** Its only reference
was the old `reference/mobile.html`, which the full handoff's
`PropPalace Mobile.dc.html` redraws as three screens — feed, refine sheet, prop
detail — none of which is a separate "rows in 2a" screen. The slate rows it was
about are covered by item 18's Games redesign.


### Which two folders hold what

There are two design handoffs and they do not overlap. Items **1–15** are all in
`design_handoff_proppalace_redesign/reference/`; items **16–17** are in
`design_handoff_propplace_landing_board/`.

| Reference file | Cards | Items |
|---|---|---|
| `…_redesign/reference/app-screens.html` | 2a | 1, 2, 4, 5, 6 |
| `…_redesign/reference/news.html` | 4a | 7 |
| `…_redesign/reference/alt-lines.html` | 4b | 8 |
| `…_redesign/reference/mobile.html` | 3a mobile screens · 3b logo marks | 9, 10, 11 · 15 |
| `…_redesign/reference/my-picks.html` | 5a / 5b / 5c | 12, 13, 14 |
| `…_landing_board/PropPalace Landing.dc.html` | — | 16 |
| `…_landing_board/PropPalace Board.dc.html` | — | 17 |
| `…_landing_board/PropPalace Prop Feed.dc.html` | — | shipped out of sequence, see above |

## Data track — state as of 2026-08-21

| Sport | Rosters | Game logs | Defence ranks |
|---|---|---|---|
| **NFL** | **live** (`lib/rosters.js`) | real, ESPN, 2025 | real |
| **NBA** | **live**, all 30 (`lib/rosters.js`) | **real**, ESPN, 2025-26 | **real**, ESPN standings |
| **MLB** | live (statsapi `/roster/active`) | real, MLB Stats API | real, per-market |
| **WNBA** | live (ESPN, since item 5b) | real, ESPN, current season | real |

**Section A — live rosters: complete.** `src/lib/rosters.js` is one mechanism
for all four leagues, generalising `fetchWNBATeamRoster`. NFL went from 32
hand-written arrays to live (1,260 → 3,085 props); NBA from four teams to
thirty. MLB and WNBA already fetched their own and were left alone.

Team ids are a static map in that module and deliberately so: a roster changes
on every transaction, a team id on a relocation. It is also forced — ESPN's
league index (`/teams`) sends no CORS headers, so a browser cannot read it,
while `/teams/{id}/roster` can. That worked from a terminal and failed from the
app; found only by driving the real page.

**Section B — game logs: done for NBA, already real elsewhere.** NBA now reads
ESPN's gamelog endpoint, the same shape the WNBA code has parsed since item 5b.
The feared 450-request backfill did not need a build-time prefetch: the
existing per-player TTL + sessionStorage caching absorbed it, and the honesty
gate means an unfetched player simply doesn't appear rather than appearing on
generated numbers.

**Section C — NBA defence ranks: complete.** Real opponent points-allowed per
game from ESPN's standings, replacing `buildDefenseCategoryFor`'s seeded RNG.
The ALLOWS sentence on the NBA player page is unlocked with it, gated so it
only ever states a number that came from ESPN.

**Knock-on effects, all done:** the `simulated` qualifier is off the NBA tab,
NBA picks are gradable (`gradeKind: "nba"`, stamped only when the row came from
a real log), and the NBA disclaimers name their season and source.

**Section D — the NBA slate: done.** `NBA_MATCHUPS` was two invented pairings
on invented dates, and the feed's opponent column read `games[games.length-1]`
— who a player *last* played, so the defensive rank beside it rated a game
already in the books. Both now read ESPN's schedule (`fetchNBALiveSlate`), and
on 2026-08-21 that is opening night, 2026-10-20. The window is seven days, not
the WNBA page's three, because it also answers "who does this player face next"
for every feed row: three days covers three teams on opening night, seven
covers all thirty. An offseason near-window falls back to the season opener,
resolved from ESPN's own `/seasons/{year}/types/2` rather than a typed-in date.

**Log scoping — built, as one control.** `src/LogScope.jsx`. All three
decisions turned out to be the same primitive and are implemented as one:

- **Season type** (All / Regular season / Playoffs). Playoff games count by
  default and are marked wherever a game appears: a dashed outline on the chart
  bar, `PO` under the axis tick, a `PO` tag in the game-log table row and the
  chart tooltip, and a dot track under the feed's form strip (four pixels of bar
  has no room for a tag).
- **Team** (All / With <TEAM>…), derived from the log itself, from
  `events[].team` on ESPN's gamelog — the player's own team *that game*, which
  a roster cannot tell you. Verified: Jose Alvarado reads All 87 / With NYK 46 /
  With NOP 41, and Kyle Anderson's log carries three.
- **Season** — current season (selected), each prior season as its own choice,
  then an explicit **All seasons**. Seasons never blend unless a reader says so,
  which is decision 3 made visible rather than merely enforced: combining them
  is a deliberate third choice, not something that happens to a Last 10 because
  a second season finished loading.

Applied at one point per page — `logGames` → `scopeGames` → `allGames` — so the
chart, splits, verdict, per-game table and every sample-size label narrow
together. Option counts are computed *with the other selections applied*, so
"With NOP" reads 0 (in red) while Playoffs is active rather than promising 41.
Live on all four player pages. MLB joined once its pull became `gameType=R,P`
with the per-game team read off the split it was already fetching — Taylor Ward
reads All 121 / With SEA 10 / With BAL 111, matching statsapi exactly.

The WNBA feed carried the same last-opponent bug and is fixed with the same
shape (`wnbaNextGameForTeam`): its OPP RANK badge was rating the defence of a
game already played. Verified against the live slate — every pairing on screen
is symmetric and matches ESPN's next game for that team.

**Prior seasons: done for all four sports, the cheap way.** The plan sized this
as a league-wide backfill and deferred it. It is instead fetched *per player
viewed* — one extra request when a player page opens, not hundreds on load —
which is the right shape given decision 3: prior seasons exist for consistency
research, role/minutes filtering and spotting an offseason jump, all of which
happen on one player's page at a time, and they may never enter a recent-form
window at all.

One hook, `usePriorSeasonLog`, on all four pages. The season it asks for comes
from the log in hand, not the calendar — which matters on the NFL page, where
"current" is often already last season because
`fetchNFLPlayerGameLogForDisplay` falls back when the new one has no games yet;
asking for `currentSeason - 1` there would have skipped a year.

It is deliberately kept out of the module-level log maps that feed the prop
feed. The feed has no scope control, so merging there would make every feed hit
rate silently multi-season. Verified both ways: Dak Prescott's page defaults to
2025 (17 games) with 2024 (8) and All seasons (25) selectable, and his feed row
still reads 9 of 17.

Verified against the source APIs, per sport:

| Player | Current | Prior | Source says |
|---|---|---|---|
| Derrick White (NBA) | 2025-26 · 84 | 2024-25 · 87 | 77+7 and 76+11, preseason dropped |
| Dak Prescott (NFL) | 2025 · 17 | 2024 · 8 | 17 and 8 |
| Tyler Stephenson (MLB) | 2026 · 100 | 2025 · 90 | 100, and 88 R + 2 F |
| Chloe Bibby (WNBA) | 2026 · 4 | 2025 · 14 | traded — team row narrows with the season |

Season numbers are derived per sport (`currentNBASeason`, `currentMLBSeason`,
the existing `currentNFLSeason`) rather than written down, so none goes stale
at a rollover. `seasonLabel` speaks each sport's own convention: the NBA is
numbered by the year it ends (2026 → "2025-26"), the NFL by the year it starts
(2025 → "2025"), MLB and the WNBA are single years. Getting that backwards
printed "2024-25" over a season played in 2025.

**Nothing is left open on this track.**


## Decisions already made — do not silently reverse these

- **Multi-select markets** on both feed and board, uncapped. A deliberate
  reversal of item 5's single-market picker. Share the pure selection/
  serialisation logic, share **zero** UI.
- **Sport switcher on the board**, all four sports. NFL in the mock was only an
  example.
- **The board is an addition.** It replaces neither the Games tab nor the prop
  feed. **Keep all three separate; do not merge them in any way.** The board's
  job is discovery — deciding *what* to research; the feed's job is working
  through props already chosen.
- **Playoffs count**, are visibly marked, and are filterable (All / Regular
  season / Playoffs).
- **Traded players keep their whole log**, plus a per-team filter.
- **Current season always outranks previous.** `L5` means five games of the
  *current* season. Watch the `ALL` trap documented in the data track.
- **NBA loads 2025-26 first**; 2024-25 deferred.
- **Free tier is a rotating daily set** of real players, any tier — not a pinned
  list of low-profile names.
- **The feed's rate cells keep their green/red tinting.** The landing/board
  handoff strips them to a neutral figure; Alex overrode that on 2026-08-21 and
  the tinting stays. The track under each figure stays `--accent`, so a
  re-tinted accent still can't be confused with a hit/miss colour.
- **The neutral band for that tinting is 45–65%**, set by Alex 2026-08-21.
  Above 65 green, below 45 red, both endpoints grey. An over at 60% is close
  enough to a coin flip after vig that green read as an endorsement the number
  hadn't earned. One helper, `feedRateColor`, so desktop and phone can't drift.
- **Thin samples print `too few`, not a percentage**, on both the desktop rate
  cells and the phone card's headline figure. L5 is exempt — five games is the
  whole sample that column claims.
- **The feed's rate samples read hits-of-games** (`8 of 10`), not
  games-available-of-games-asked-for. They are the two numbers the percentage is
  the ratio of.

### Decided 2026-08-21, on the full handoff (`design_handoff_proppalace_full/`)

- **Games and the board are two separate pages and both ship.** The full
  handoff draws them as two takes on one `/games` route and says to ask; Alex's
  answer is that they do different jobs and both stay. **Games** keeps its own
  route and its existing job — live matches, scores and box scores, so people
  don't leave for ESPN/NBA.com/MLB.com mid-session — and takes screen 4's
  redesign, including the gamecast folded in as an inline row expansion.
  **The board** gets its own route, `board`, and takes screen 2 — prop
  discovery, rows grouped under game headers behind a filter rail. Neither
  absorbs the other. This supersedes the older plan's "decide later whether the
  Games page folds into the board": it does not.
- **No renaming needed.** "Games" and "The board" already say what each does.
- **Prop detail ships on desktop and mobile.** The full handoff draws it only
  at 390px, but the desktop version is not missing and must not be invented —
  it is cards 447 and 248, built as items 1 and 2, and it is what the four
  `…Props` pages already render. So: mobile takes screen 5's prop-detail
  layout; desktop keeps 447/248 and is brought onto the same visual system.
- **The palace mark is the logo.** Confirmed by Alex looking at it in the
  mocks' top-left: five towers as a bar chart, green solid where they clear,
  red outlined where they fall short, white dashed rule across, pennant on the
  keep. Item 15 builds *this*, not the three ascending bars. It keeps the fixed
  status colours and does **not** re-tint with the user's accent — the one
  sanctioned exception to that rule.

## v2 rebuild — complete, 2026-08-22

The `design_handoff_proppalace_v2/` bundle, rebuilt screen by screen against
live data. **Read that folder's `README.md` before touching any of it — it
supersedes every earlier `design_handoff_*` folder**, and it was corrected in
place during the build wherever it contradicted itself (the corrections are
marked in the README and are the version to trust, not the original wording).

Seventeen commits, `98f8579` … `c34df94`, in build order:

| Commit | Screen / item |
|---|---|
| `98f8579` | The bundle, FormGraph, the four colour families, the fluid shell, first-run intro |
| `5d0ca0d` `a9e0450` `3372aa9` | The Board — cards, rails, and the gaps it states rather than hides |
| `d1c5d82` | Prop Feed — denominator, side, and which filter emptied it |
| `c31b8f3` | `defTier` cuts each league's own thirds |
| `0ed7811` | Games — game-state colours |
| `5d62af2` `4ebe50d` `85ec0b1` | Player detail — sport-sized windows, matchup context row, one lineup control |
| `0a91a8a` | News — filter counts |
| `06a62fb` | Settings — outcome colours are the reader's, availability is not |
| `8e157e6` | Gamecast — the boxscore it was already fetching, props in play |
| `104b5c9` | The board joins the slate |
| `6e7adac` | Mobile — touch-target floors |
| `c24ede9` | Games — the All tab |
| `c34df94` | One MLB fetch for board + feed; kickoff/records/venue on all four player pages |

### The two rules that outrank pixel accuracy

Both came from Alex at the start and both were applied everywhere, including
where the mock disagreed:

1. **Derive, never type.** Hits, sample, percentage, streak and average all
   come off the same game-log array. A number that is not derived from the
   array behind it is a bug even when it looks right.
2. **Every rate states its sample.** Counts first — "78% · 7 of 9". Under ten
   games prints a verdict instead of a rate and *keeps the row*: the minimum
   sample is a display threshold, never a filter.

### Where the build deviates from the mocks, and why

Every number in the v2 mocks is invented — game logs, ranks, usage, rosters,
records. Season lengths and league sizes are real. Everything else is wired to
live data, which is what forces most of these:

- **The form graph's axis is windowed, not grounded at zero.** The README said
  both in different places. A zero-based axis flattens every bar on a market
  whose values cluster (0.5 hits), so the axis windows to the data. The
  consequence, which is the part worth remembering: **bar heights are
  comparable within a row, never across rows.**
- **Slot count is a prop, not a constant.** `FORM_SIZES` is the source of
  truth over the README's size table, which was transcribed mid-iteration.
- **The four colour families cannot be separated by hue alone.** Six reserved
  hues plus buffers leave two usable bands in 360°. They are separated by
  shape, placement and lightness instead: availability owns the avatar's
  bottom-right corner as a dot, game state is a square swatch with one hue per
  pair split by fill, sport identity tints a divider. The README's section was
  rewritten around that.
- **`--status-available` is never `var(--pos)`.** Outcome colours are
  user-settable from Settings; availability is not. Pointing one at the other
  would let a reader recolour "healthy".
- **The mock's lineup-status colour was not matched** — it read as the accent.
- **The matchup context row omits cells rather than filling them.** The mock
  draws "6.8 rec/g" for what a defence allows; no provider gives a per-market
  figure for every sport, so the label is passed in and the cell disappears
  where the number would be a claim.
- **"Open in feed" does not filter the feed to one game.** Two id shapes would
  have to be reconciled inside `PropLedger.jsx` to save one click. Declined
  twice, deliberately.
- **The board's "All 148 props →" is phrased as a count plus a move**, because
  the feed it moves to is not filtered.
- **The feed's Markets / Side / Games counted / Lines are above the table, not
  inside the Filters panel.** The mock puts all four in the panel and the build
  followed it; Alex reversed that on 2026-08-23. They are not filters you set
  once, they are how you move around the feed, and a click in front of each
  taxed the most frequent action on the screen. The panel keeps the
  set-and-forget half — minimum sample, defence tier, role, sort, price. The
  summary strip lost its Markets and Window cells at the same time and for the
  same reason: it was restating a control sitting a centimetre below it.
  Desktop only; the phone's Refine sheet is unchanged.

### Things a future reader will not find in the code

- **The board's card grouping is directional unless a row carries `gameId`.**
  `${team}-${opp}` groups the same fixture twice — that is how MLB drew 30
  cards for a 15-game slate. NBA/NFL rows keep the fallback because their
  "games" are last-opponent pairings, not a real slate.
- **Slate joins require *both* teams to match.** Looking one team up finds *a*
  game it plays. That is not the same as finding this game, and it once hung
  Tampa Bay's record on a card headed CIN vs CLE. The player pages join the
  same way; out of season they fail to join and the cells vanish, which is the
  correct answer.
- **NBA/NFL prop rows describe 2025 fixtures** (the builders use the last
  opponent played) while the slates hold 2026. Anything joining rows to a
  slate has to survive that.
- **`npm run build` proves nothing about runtime.** Vite does not check that
  identifiers exist, and the FormGraph shipped rendering zero bars with a clean
  build and a clean console — an explicitly-placed rule overlay had pushed
  every auto-placed bar into implicit 0px columns. Drive the dev server.
- **Duplicated expressions are this codebase's live hazard.** `String.replace`
  hit the wrong one of four identical `const base = sport === "nfl" ? …`
  blocks in `GamesPage.jsx` and the All tab shipped rendering one league.
  Deduped in `c34df94`; the same trap exists anywhere else a block is copied.
- **Verification for logic today's slate cannot reach** (direction inversion in
  `verdictFor`, `buildPropsInPlay`, `defTier` equivalence) was done with truth
  tables, not assertions — every game on the slate the day this was built was
  an over, so the UI could not exercise the under path.

### Still open after v2

- **Feed game-id reconciliation** (would let "Open in feed" filter to one
  game). Declined twice on cost-vs-value; the current phrasing is honest.
- Everything in the monetisation track, untouched.
- ~~Player detail was desktop-only below 1100px~~ — closed 2026-08-23,
  `e84eac9`. See below.

## The transcription pass — started 2026-08-22

The first pass built each screen *inspired by* its mock. Alex's correction,
after a week of it: **transcribe the file element-for-element.** Open the mock,
write out the mock's block tree, write out the app's, make them identical.
`sc-for` → `.map()`, `sc-if` → `&&`, `{{ token }}` → real data, inline styles
kept verbatim. The only permitted substitution is a hex → the token that
already resolves to that hex.

Two substitutions are established across every screen and do not count as
deviations: the mocks' lettered team badges become the real crest (`TeamLogo`
— the design files could not carry images, see the handoff README), and their
initials circles become `PlayerAvatar`, which carries availability with it.

**One mock file per sport.** The v2 bundle has a separate player-detail file
for MLB, NBA, NFL and WNBA, and their pills and cells genuinely differ. Build
each from its own file; do not generalise one into four.

| Screen | State |
|---|---|
| Player detail — MLB, NBA, NFL, WNBA | Done, one per file |
| Matchup Card (a **modal**, not a page) | Done |
| Settings — popup + full page | Done |
| Prop Feed | Done |
| The Board | Done |
| Games | Done, `cae7c3e` |
| Landing | Done, `fc8899e` |
| News | Done, `20f3d56` — the file was drawn *from* the app, so only the chassis was missing |
| Mobile | Done, `5a6e5bb` — audit. **Do not build a bottom tab bar**: the mobile file's `navItems` array is defined and never rendered by its own template. Its real nav fold is four equal-width tabs at the *top* |

## The board's verdict, decided 2026-08-23

Alex, looking at a 9-of-10 row labelled "Leans over": *that's much more than
simply leans over, and I can't figure out what it would be useful for.* The
question behind it was whether the board earns its own route at all, given the
feed shows the same rows off the same builders.

**Both screens stay.** The reason that holds up is not the one the older note
gives ("different jobs") but the count: the NFL feed carries ~3,095 props, and
that is not a list a person triages. Something has to answer *which handful are
worth opening*, and a table with better filters is still a table. The board was
failing at that job, not doing a redundant one.

**The verdict now ranks on how far the sample backs the rate**, not on the rate.
See `src/lib/support.js`. This replaces the handoff's flat 65/45 thresholds,
deliberately: those gave 13-of-20 and 9-of-10 the same sentence, and the first
of the two establishes nothing. The bug was overclaiming at the weak end, not
underclaiming at the strong one.

| | old | new |
|---|---|---|
| 9 of 10 (90%) | Leans over | **Strong over** |
| 8 of 10 (80%) | Leans over | Leans over |
| 7 of 10 (70%) | Leans over | **Not established** |
| 13 of 20 (65%) | Leans over | **Not established** |
| 35 of 50 (70%) | Leans over | Leans over |
| 6 of 10 (60%) | Coin flip | Not established |

Three things worth knowing before touching it:

- **Wilson, not the normal approximation.** 10-of-10 is common on short seasons
  and the normal interval claims certainty there; Wilson does not.
- **z = 1.28 (90% one-sided), not 1.96.** At 95% almost nothing on a 17-game NFL
  season clears the bar and the screen stops ranking anything. This is a triage
  question, not a publication one.
- **The label weighs both sides; the ranking weighs only the priced one.** They
  are different jobs and using one function for both was a bug caught by driving
  it: every 0-of-10 is a perfectly well-supported claim, so the top of every card
  filled with backups who have never scored.

### The one element of the landing file that is not built

Its hero has a third button, **"Take the 2-minute tour"**. There is no tour:
it is specified in [`ACCOUNTS_SUBSCRIPTION_TUTORIAL.md`](./ACCOUNTS_SUBSCRIPTION_TUTORIAL.md)
and that track has not been started. `LandingPage` renders the button only when
an `onTakeTour` handler is passed and nothing passes one yet, so building the
tour is the whole of the remaining work — the button appears on its own.

The file also carries a **"Routing" note card** in the hero, explaining
`propPalaceTour.dismissed` to whoever implements it. That is handoff
documentation, not product UI, and is deliberately not rendered. The behaviour
it describes is built.

### Games, and what "resemble the mock" turned out to mean

Worth recording, because the same trap is waiting on Landing and News. Games
had already been through the first pass and the three-column shell, and still
read as v1 — because the *centre column* was untouched. It was a four-column
table whose rows unfolded the full `GamecastPage` underneath. The file draws
neither: a stack of bordered cards, each opening a compact gamecast **inside
the card**.

The lesson: a screen can have the mock's chassis, rails, strip and type and
still be the old screen. Check what the file does with its *content*, not just
its frame.

Still reachable, deliberately: the full `MatchupPage` / `GamecastPage`, from
the foot of an open card. Those two are still first-pass pages and still carry
the accent gradient wash the v2 screens dropped — if they are ever meant to
match, that is unbuilt work, not an oversight.

## After the transcription pass — 2026-08-23

Twelve screens matching their files is not the same as twelve screens being
right. Everything below came from Alex opening the finished build and reading
it, and each one turned out to sit on top of something older than the redesign.
Recorded because the pattern is the point: **the transcription pass could not
have caught any of these, because none of them is a layout question.**

| Commit | What Alex called | What was actually under it |
|---|---|---|
| `b69cdf7` | Mahomes has three different backgrounds | Nine call sites each deciding the avatar's disc colour; three said `#000` |
| `f912dfc` | Trubisky is under the wrong game; the page dies on a hot reload | Two unrelated bugs, one of them a Fast-Refresh-only crash — see below |
| `afea1c3` | MLB's minimum sample offers 5/9/12 | The control was built for a 17-game NFL season and *clamped saved values at 17* |
| `b384af4` | A receiver's rail row reads 0.0 PASS YDS | The rail rendered every row in the selected market, position be damned |
| `63590ad` | Away games should carry an @; home/away filtering looks broken | The filter worked. The feed's NFL opponent did not |
| `3768ea0` | These four controls are used constantly and are behind a click | A faithful transcription of a mock decision that was wrong for this screen |
| `e84eac9` | (mine) | The v2 page only ever rendered at 1100px and up |

Four of these are worth more than a table row.

### The minimum sample was an NFL control on every sport

`MinSampleControl` had `MIN_SAMPLE_TICKS = 17` and presets `[5, 9, 12]`, and
`loadSamplePresets` discarded any stored value `> 17`. On a 162-game MLB season
that made the control meaningless twice over: a 17-step scale, and no way to
express a minimum above 17, so every prop cleared the highest bar the control
could state. `SAMPLE_SCALE` is per sport now — NFL 17/5·9·12, WNBA 40/10·20·30,
NBA 60/10·20·40, MLB 80/15·30·50 — and the presets are stored under a per-sport
key, because one shared key meant a useful MLB minimum overwrote the NFL chips.

`max` is not the season length. It is the point past which raising the minimum
stops telling you anything, which is well short of 162.

### The NFL feed was scouting last season

`buildNFLFeedRows` took its opponent from `games[games.length - 1].opp` — the
last team the player faced. The NBA and WNBA builders had been moved off that
exact line and given a slate lookup; the NFL one was left behind, and nobody
noticed because the feed does not draw a fixture, only "vs XXX". It showed up
the moment the `@` marker made the fixture legible: Detroit's two quarterbacks
sat in the feed against different opponents, Minnesota fielded three, and the
OPP RANK chip beside each was rating a 2025 defence.

**Lesson worth keeping:** the bug had been visible on the main screen for weeks.
What made it findable was rendering *one more fact* about the same row.

### ESPN calls Washington WSH

Every map in the app keys it WAS. The live NFL roster, the slate parser and
`teamInfo` all took ESPN's spelling raw, so the whole Washington roster fell
through team colours, crests, defensive ranks and the week's fixtures at once —
and on the board it had its own card headed "WSH" with 101 props sitting beside
the real WAS @ PHI card with 97. The NBA side of `gamesData.js` already had
`NBA_ESPN_ABBR` for exactly this class of mismatch; football just never got one.
`espnAbbr(sport, abbr)` is now the single reconciliation point.

Baseball's Washington is *legitimately* WSH. The map is per sport for that
reason.

### The v2 player page was gated at 1100px

`if (!compact) return v2Page` — and `compact` is `useIsNarrow(1100)`, the
breakpoint the roster rails need. Read as the breakpoint the *page* needs, it
meant an iPad in landscape, a 13" laptop and any window under about a third of a
4K screen got the pre-v2 page: same data, old design, silently. Nothing decided
that; it was one variable doing two jobs.

The chassis folds now (`.pp-pd-grid` in `index.css`): under 1100 it is one
column, the rails drop out, and `MobilePlayerNav` — which already gates on 1100
— is handed to the v2 page so switching player stays one tap away. Only the
roster half of the right rail folds; the graph key stays. **The phone keeps its
own page**, because the mobile handoff draws one and blessed the strip this
reuses.

Folding exposed two things that were already broken above it: the axis labels
collided (a date is 37px at 10px mono, columns were 26px minimum, so neighbours
touched at any column under 31px — including on a 1150px desktop), and the
verdict sentence truncated to "cleared 268...." with the count that is the whole
point of the line inside the ellipsis.

### The HMR crash, for the record

The standing theory was `NFL_MATCHUPS[0].id`. It was wrong. The real cause:
`NFL_LIVE_PLAYERS` is a module-level `let` and `playerId` is component state, so
a Fast Refresh re-runs the module — emptying the live pool — while the selected
id survives. `player` resolves to `undefined` and the page hits the error
boundary. Guarding the leaves only moved the throw three times; the fix is a
fallback player plus a resync effect. Dev-only, but it cost hours twice.

## Still open — before the v2 rebuild

> The three below were open as of 2026-08-21. The first two were answered by
> the v2 rebuild: the form graph windows its axis (it is not grounded at zero),
> and the landing page shows real rows only.


- The form graph: whether bars move from margin-height to grounded-at-zero with
  a drawn line at the prop value. Touches every feed row, so it is its own
  change — easier to judge once the landing page exists.
- Whether the landing page's hero card takes the strongest row *among the free
  set*, or the front page is exempt from gating.
- Whether the Games page later folds into the board.

## Standing rules

The design files are the target **layout**, not just vocabulary; where the app
and the design disagree, the design wins. Sections 1a/1b/1c are rejected
directions. The logo is three ascending bars in lapis — no arch motif anywhere.

Verify every change **live in the browser with an error listener armed**: a
passing `npm run build` proves nothing about runtime here, because Vite does not
check that identifiers exist. Walk **all four sports**, not just the one just
touched. Counts before percentages, always with the sample size. Availability on
`--status-*` only, never the accent. Nothing is ever silently dropped.

---

# Items 1–4 — design as the target layout

> Historical section. Items 1–4 shipped in `5b6ce33`; the notes below are the
> original working context and are kept for reference.

## The MLB fix

Already done and pushed: **`4206cd2`**, on `master`, `git log origin/master..HEAD` empty.
`MLB_ROSTER_STATUS_TTL_MS` had moved to `src/lib/mlbStatus.js` unexported while a consumer
stayed at `PropLedger.jsx:10244`; it is exported and imported, and all four player pages plus
feed, slate and matchup were re-checked with an error listener armed. Nothing outstanding.

Uncommitted: the phase 4c games-slate work, which item 4 rebuilds (its data-layer parts
survive — see item 4).

---

## Context

`app-screens.html` holds **six** cards under one `2a` label, and they map exactly onto your
first six items: 447 → **#1**, 248 → **#2**, 138 → **#3**, 22 → **#4**, 713 → #5, 647 → #6.

The correction that matters: **#1 and #2 are both real screens and I had been treating them as
one.** Phase 4a built an identity row against card 248 — that is screen **#2**'s header
(76px ring avatar, 42px name, `LOS ANGELES RAMS · WIDE RECEIVER` mono), so that work stands.
What was missing is that 248 is a *separate page* from 447, with its own two-column layout
and verdict block. Neither is a restyle of the other and they do not merge.

Second correction: **the arch is mine.** `MatchupPage.jsx:33` and `GamecastPage.jsx:27-44`
got a section-title arch in phase 4b. It is dead; it comes out before anything builds on it.
The full three-bars lockup across nav, favicon and every other lockup is item #15.

**Standing rule:** the design is the target layout. Where app structure and design disagree,
the design wins. App-only features move below the fold, never deleted. Anything the design
needs that the app cannot supply gets built.

---

## Order

**0. Remove the arch** — two files, minutes. Not item #15; this is reverting my own bug so
nothing is built on a dead motif.

**1. Screen #1, prop-feed player detail** (all four sports). First because it builds the most
shared primitives: breadcrumb bar, game strip, verdict row, the composite opponent+date chart
axis, the `AT HOME` split, and the add-to-picks wiring.

**2. Screen #2, matchup player page** (all four sports). Immediately after #1 — same four
page components, reuses #1's roster rails, chart and picks wiring, and its header already
exists. Building the two player pages adjacently avoids touching the same four components in
two separate passes.

**3. Extraction** — feed-row builders out of `PropLedger.jsx` into `src/lib/`. Sits here, not
first: items 1 and 2 do not need it, and front-loading a ~3,000-line move before any visible
progress puts the whole batch behind the riskiest step. Landing it directly before its two
consumers means the API is shaped by real callers.

**4. Screen #3, matchup overview** — needs the extraction for "Props with a read".

**5. Screen #4, games slate** — needs it for "Props worth a look" and the `18 PROPS →` counts.

---

## Item 1 — prop-feed player detail (card 447)

Four pages: `NBAPropsPage` (:786), `NFLPropsPage` (:5003), `WNBAPropsPage` (:6733),
`MLBPropsPage` (:10321).

Reuse unchanged: `TeamRosterPanel` (:15841) for both rails, `PlayerIdentityRow` (:525),
`BarValueLabel` (:4408), `LineHandle` (:3247), `GameInfoBar` (:4842) for the strip's left
half, the per-page `gameInfoBadge` (NBA :1017 / NFL :5245 / WNBA :7091) for the ranked pill,
`HitRateSplits` (:4317).

New or changed:
- **Breadcrumb bar** — back link, centred `RAMS @ SEAHAWKS · SUN 4:05 PM · RECEPTIONS`,
  `+ WATCH` right. Needs an `onBack` prop threaded at :17795-17812.
- **Market tabs revert to underlined text tabs.** Phase 4a made `.market-bar .tab`
  (`index.css:574`) a filled accent chip. That is wrong for #1 — and **right for #2**, whose
  spec is filled/outlined chips. So this stops being one global rule and becomes per-screen.
- **Verdict row** — large accent percentage, `cleared 5.5 in 7 of his last 9`, then
  `AVERAGE / LINE / CLEARS IT BY` mono-labelled, then the sample pill. `MetricRail` (:4975)
  supplies AVERAGE, the rate and CLEARS IT BY. The LINE tile contradicts an explicit decision
  at :4970-4974 ("the draggable LineHandle is the single place the line value is read from
  and set"), so LINE is display-only and `LineHandle` stays the only place it is *set*.
- **Chart axis** — opponent **and** date beneath each bar. `TeamAxisTick` (:4568) and
  `DateAxisTick` (:4594) are mutually exclusive today; this is a new composite tick.
- **Splits row** — `AT HOME` cell is new in `buildHitRateSplits` (:4282); games carry
  `isHome`. Active split underlined, `GAMES IN GRAPH · 9 OF 9` right.
- **`+ ADD TO MY PICKS`** — thread `pickIds`/`onTogglePick` into the four pages and build the
  pick through the existing `pickFromRung` (:13095) so `feedPickId` (:13057) stays the one id
  format; otherwise the same prop saved from the feed and from a player page double-enters
  the slip.
- Injury/news and missing-teammates blocks stay above the splits.
- Below the fold: filters panel, sample-size slider, teammate chips, `PlayerNewsModule`, the
  per-sport data line.

## Item 2 — matchup player page (card 248)

Same four page components, distinct route and layout. Two columns at `1.25fr / 1fr`.
Left: 76px ring avatar with lineup dot, mono team·position line, 42px name (all existing via
`PlayerIdentityRow`), then market chips — `RECEPTIONS 5.5` filled accent, others outlined.
Then the verdict block: 82px green percentage with `went over 5.5` beneath, beside a 23px
sentence and a row of 20px squares, filled green for cleared and red-outline for short, with
split figures under them. Right column carries the supporting detail.

Breadcrumb `← GAMES / RAMS AT SEAHAWKS / PUKA NACUA`, `+ WATCH THIS PROP` right.

## Item 3 (extraction) — feed-row builders into `src/lib/`

Lift `buildMLBFeedRows` (:14206), `buildMLBPitcherFeedRows` (:14308), `buildWNBAFeedRows`
(:12033), `buildNFLFeedRows` (:14148), `buildNBAFeedRows` (:14087), following the
`lib/altLines.js` / `lib/calibration.js` pattern — pure modules, no React, no fetch.

Sizing, because it drives sequencing: the builders are ~353 lines, but their transitive static
dependencies (roster arrays, market tables, stat extractors, def tables) are **~3,000–4,500
lines**, and three of four sports read mutable caches filled by fetchers
(`NFL_REAL_GAME_LOGS`, `WNBA_REAL_GAME_LOGS`, the MLB caches) with freshness signalled by the
`nflDataVersion`/`wnbaDataVersion` reducers. **One sport per commit, MLB first** — it is what
items 3 and 4 actually need. Caches and fetchers move with their sport; the React
version-counters stay in the component and are passed in.

Each sport's move ends with a grep of every moved name against the import list **and** a
page-open check of that sport. That is exactly the `4206cd2` failure mode: an unexported name
with a consumer left behind builds clean and throws at runtime.

**Game-id join:** MLB rows key on `` `${away}-${home}-${index}` `` (:14733), the slate on
`` `mlb-${gamePk}` `` (`gamesData.js:470`). `fetchMLBDaySlate` already carries `gamePk`
(:8872), so MLB rows re-key on it and the join becomes exact. NFL/WNBA/NBA carry no event id
and join on sport + team abbrs.

## Item 4 — matchup overview (card 138) and games slate (card 22)

**Matchup overview** to its reference exactly, including **"Props with a read"** — per-player
rows of `avatar · Nacua receptions 5.5 · 78% · 7 of 9 games`, `· too few` on a thin sample.
One game means two rosters: a bounded fetch, the same shape the player page already does.

**Games slate** to reference 22–137: four columns `MATCHUP | KICKOFF | PROPS WORTH A LOOK |
RESEARCH` with `18 PROPS →`, and **per-day game counts on the date tabs**, which needs a
slate fetch per visible day with a per-tab loading state.

Surviving from the uncommitted 4c work: the `{games, unreadable}` fetcher shape, the
fetch-failure state with its working `RETRY`, the unreadable count at the table foot, and the
accent-following live pulse.

---

## One definition I need to state, not defer

**`18 PROPS` counts props offered** — roster × applicable markets — not rows the feed will
render. The builders skip a player with no game log (`if (!games.length) return;` at :14152,
:14213), so the two can differ. "How many props can I open for this game" is what the chip
means and it needs no fetch. Flagging because it is a semantic choice, not a deferral; say if
you want it matched to the feed's row count instead.

Two data limits I will hit and how I will handle them, both stated rather than worked around:
`SEA ALLOWS 6.8 REC/G TO WRs` exists per-market only for MLB (`mlbDefForMarket`); NFL and
WNBA have one real number, points allowed per game, and get it labelled as that; NBA's
`TEAM_DEF` (:84) is seeded RNG so NBA shows the pill and no allows-line, because printing a
generated number as a scouting fact is the one thing these rules never allow. And `+ WATCH`
has no watchlist behind it — :17668 records that "watching" already means a saved unsettled
pick, which the News page's filter reads, so the control is a state toggle over My Picks
rather than a second competing store.

## Constraints (every item)

Counts first, percent in brackets, always with sample size · green over/hit, red under/miss ·
availability on `--status-*` only, never accent or amber, unknown = no dot · one data
disclaimer per page at the card foot · accent on verdicts, confidence bars, buttons, links and
active controls only · three ascending bars in lapis, no arch.

## Verification (each item)

`npm run build` (pushing `master` deploys) · dev server `prop-ledger-dev-direct` port 5174 at
1280px against the card · **all four sports**, since the 4a/4b miss was checking only the
sport just touched · an error listener armed while walking every screen, because undefined
identifiers build clean · forced failure states, not just happy paths · no commit without
asking.

## Committed follow-on, in order

#5 prop feed (card 713) — **done, pushed as 1e3ec85** · **#5b WNBA game chips (see below)** ·
#6 settings (card 647) — **done, `b085e55`** · #7 news (card 4a) — **found already
built from earlier work, confirmed live, nothing new to commit** · #8 alt lines
and legs (card 4b) — **done, `76d027a`** · #9 mobile prop feed (card 3a) —
**done, `d429677`** ·
**#10 mobile player page · #11 mobile rows in 2a · #12 slip · #13 ledger ·
#14 report · #15 the three-bar mark across nav, favicon and lockups · then #16
landing and #17 board — all eight commissioned as one run by Alex on
2026-08-21.**

Item 10 is **part-built**: `PlayerFormVerdict` (mobile-only form squares, a
"leans over/under" read and a confidence tier, wired into all four sport pages)
shipped inside `84a7182`, having been swept in by a `git add -A` during the feed
redesign rather than finished as its own item. Check what is actually on screen
before assuming the rest of card 3a's player page is missing.

5b is numbered rather than appended to the end: it completes card 713, which #5
left one sport short. It does not displace #6 unless you want it to.

---

## Item 5b — WNBA game chips on the prop feed

Carried out of item 5, where the chip row went to NFL and stopped. Sits here
rather than inside a later item because it finishes card 713 rather than
starting a new screen: the feed is not done while one live sport still picks
its games from a flat team dropdown.

**Correcting the scope I gave when deferring it.** The item-5 commit said this
needed "today's slate" grouping built into `buildWNBAFeedRows`. That was wrong.
The builder needs no change at all:

- `fetchWNBALiveSlate()` already exists at `PropLedger.jsx:6968` — memory- and
  sessionStorage-cached on a 1h TTL, already resolving to
  `{ matchups, unreadable, fetchFailed }` with each matchup carrying `id`,
  `label`, `teamA.abbr`, `teamB.abbr`, `date`. That is `mlbMatchupOptions`'
  shape with two renames.
- The game filter already joins on team abbreviation for any row without a
  `gameId` (`o.teams.includes(r.team)`, `PropLedger.jsx:16337`) — the path NFL
  rows take today. WNBA rows carry `r.team`, and the WNBA plays no
  doubleheaders, so that join is exact, not approximate. The `gameId` re-key
  MLB needed is not needed here.

So this is NFL-sized wiring, not new infrastructure. Four edits:

1. `wnbaMatchupOptions` — a `useMemo` over the cached slate, mapped to the
   strip's `{ id, teams, label, time, startsAt, note }`. `teams` is
   `[teamA.abbr, teamB.abbr]`.
2. Add `wnba` to `showGamesStrip` and `showMatchupDropdown`, and to
   `activeMatchupOptions`' sport dispatch.
3. `gamesStripLogoFn` gains `wnbaTeamLogo`.
4. The TEAM dropdown stops rendering for WNBA on its own — it is already gated
   on `!showGamesStrip` — but confirm rather than assume it, the way NFL's was.

**The one real decision, flagged not buried.** `fetchWNBALiveSlate` fetches a
*three-day* window (today through today+2), because the player page wants a
next-game lookup, not a slate. Feeding that to the chips unchanged would put
Thursday's games in a row the MLB strip labels "today's". Two honest options,
and I want the call made rather than defaulted:

- **Filter to today** and label it "All of today's games", matching MLB. Costs
  nothing, but on an off-day the row is empty — which is a real state and must
  render as one, per rule 4, not as an absent row.
- **Keep all three days** and label it "Next 3 days", with each chip carrying
  its own date. More useful on a light WNBA schedule; a wider claim than any
  other sport's strip makes.

Leaning to the first: same claim as MLB's strip, and a visible "no WNBA games
today" beats a row that quietly means something different per sport.

**Fetch failure is not a blank row.** `fetchWNBALiveSlate` already reports
`fetchFailed` and `unreadable[]`, and the WNBA player page already surfaces
both. The chip row must do the same rather than rendering empty — an
unreachable ESPN and a genuine off-day are not the same fact, and a bare
absence says neither.

**Verification.** Build, then live at 1280px and 390px: chips render with real
WNBA logos and tip-off times; clicking one narrows `filteredRows` to those two
teams and updates the Showing-N-of-M and its active filter chip; the TEAM
dropdown is gone; MLB and NFL chips still behave. Then force the failure path
(offline or a bad host) and confirm it states the failure. Error listener armed
throughout, and all four sports walked, not just WNBA.

---

# Data track — real rosters (all four sports) and real game logs (NBA, MLB, WNBA)

Independent of the 15 design items. It changes what the numbers *are*, not how
they look, so it can run before, after or between design items. Nothing here is
started.

Two distinct asks, deliberately kept apart because they have different scopes:
**live rosters that track trades and signings — all four sports, NFL included**
(section A), and **real/deeper game logs — NBA, MLB, WNBA** (sections B/C; NFL's
logs are already real). A sport can have one without the other, and NFL today is
exactly that case.

## State of play, verified 2026-08-20 (not assumed)

| Sport | Rosters | Game logs | Defence ranks |
|---|---|---|---|
| **NFL** | all 32, **hand-written → stale on trades** | **real**, ESPN, 2025 season | real |
| **NBA** | **4 of 30** (Knicks, Spurs, Sixers, Heat) | **none — 100% synthetic** (`genGames`, seeded `mulberry32`); load **2025-26 first**, 2024-25 deferred | **fake** (`TEAM_DEF`, seeded RNG) |
| **MLB** | 30, hand-written but thin: uniformly 1 SP + 9 batters | **real**, MLB Stats API, but `season=2026&gameType=R` only | real, per-market |
| **WNBA** | live ESPN fetch + hand-written fallback (~10 teams) | **real**, ESPN, current season | real |

NBA is not "one more sport to extend" — it is the only one with no real data at
all. `ALL_NBA_PLAYERS` is four teams; there is no NBA game-log fetcher anywhere
in the file. Everything NBA currently shows is generated.

## What the ask decomposes into

Three separable pieces. They can ship independently and should — one commit per
sport per piece, never one giant data commit.

### A. Live rosters, current as of today — ALL FOUR SPORTS (this is what handles trades)

Alex's requirement, stated explicitly: every sport must reflect trades and
free-agent signings, not just the ones getting new game logs. **That includes
NFL**, whose logs are already real but whose 32 rosters are hand-written arrays
(`GIANTS_PLAYERS`, `RAMS_PLAYERS`, … `ALL_NFL_PLAYERS` at `:2455`) and are
therefore stale the moment anyone moves. A real game log and a current roster
are two different problems; NFL has solved only the first.

**Fetch rosters, do not hand-author them.** A hand-written array is stale the
moment anyone is traded or signed; a live fetch is self-updating and needs no
code change when a roster moves. The pattern already exists in this repo —
`fetchWNBATeamRoster` (`PropLedger.jsx:6485`) hits ESPN's roster endpoint with a
day-keyed cache. Every sport is that same endpoint with a different slug:

```
site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{teamId}/roster
site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{teamId}/roster
site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/{teamId}/roster
site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/{teamId}/roster
```

So "keep track of trades/free-agent signings" is not a separate feature to
build — it is a property you get *for free* by fetching instead of hard-coding,
and lose entirely by hard-coding. That is the single most important decision in
this track. Hand-written rosters stay only as a cold-start fallback, the way
WNBA's already do.

Because it is one mechanism repeated four times, it wants **one shared roster
module** (`src/lib/rosters.js`, following the `lib/mlbStatus.js` precedent)
taking a sport slug and a team-id map, rather than four near-identical fetchers
— that duplication is already what makes the four per-sport page components
painful to change. Per-sport team-id maps are needed for NBA, NFL and MLB;
WNBA has `WNBA_TEAM_ESPN_ID` already.

MLB keeps its own wrinkle: it is the only sport with a *confirmed lineup*
concept, and `reconcileMlbLineup` already merges a fetched active roster with
the hand-written one. That reconciliation is the model to generalise, not
something to bypass.

**Where a stale roster actually surfaces** — named so the fix can be verified
rather than assumed: the prop feed's rows, the player page's roster rails, the
teammate chips, the matchup card's two line-ups, and `getTopProps` /
`getPropsCount` behind the Games slate. A traded player must stop appearing for
the old team in *all* of them. That is a cross-surface pass, not a one-screen
check.

**Cold-start honesty.** If the roster fetch fails, the app falls back to the
hand-written array — which may now be wrong. That fallback must be visible
somewhere, not silent: showing a departed player on his old team with no
indication the roster could not be refreshed is exactly the class of quiet
wrongness rule 4 exists to prevent.

### B. Last season's game logs, including playoffs

ESPN's gamelog endpoint already takes a season param — `fetchNFLPlayerGameLog`
(`PropLedger.jsx:3253`) uses `?season=${season}`. NBA is the same shape under
`basketball/nba`. MLB Stats API takes `season=` and `gameType=` (`R` regular,
`P` postseason) — the current calls hardcode `season=2026&gameType=R`
(`:9385`, `:9944`), so both need to become parameters rather than constants.

**Which seasons, per sport — NBA needs TWO, the others need one.**

ESPN numbers a season by the year it *ends*, so the 2025-26 NBA season is
`season=2026`. Today (Aug 2026) is the NBA offseason: 2025-26 is finished, and
2026-27 has not started.

| Sport | Already real | To add now | Deferred |
|---|---|---|---|
| **NBA** | **nothing** | **`season=2026` (2025-26) only** | 2024-25, later |
| MLB | 2026, in progress | 2025 (`season=2025`, `gameType=R` **and** `P`) | — |
| WNBA | 2026, in progress | 2025 | — |

**NBA scope trimmed by Alex 2026-08-21: 2025-26 only for now, 2024-25 added
later.** That is the right first cut — 2025-26 is the most recently completed
season, so NBA stops showing generated numbers and starts showing current ones,
and the backfill is halved (one season across 30 teams, not two).

Getting the *recent* season first also matters more than depth: loading only the
older 2024-25 would have left NBA showing a season-old picture as though it were
current, which is worse than the generated data it replaces — generated data at
least carries the `· SIMULATED DATA` badge, whereas stale real data just looks
correct.

One consequence to accept knowingly: decision 3 lists "seeing an offseason jump"
as a reason for prior seasons, and that specific use case needs two seasons to
work. With one season NBA gets real hit rates and real consistency data, but no
year-over-year comparison until 2024-25 lands.

**Do not hardcode the season number.** `season=2026` is already hardcoded for
MLB at `:9385` and `:9944`, and it silently becomes wrong on 1 January. Resolve
"current season" per sport from the date instead — NBA rolls in October, MLB in
spring, WNBA in May — so the board does not need a code change every year. This
matters more once two seasons are in play: "current" and "previous" have to be
derived together or they drift apart.

### C. NBA's fake defence ranks

`TEAM_DEF` (`:84`) is seeded RNG. It currently drives the OPP RANK badge on
every NBA feed row. Once real logs land this can be computed for real — and
until then it must not be presented as a scouting fact (this is why the NBA
player page deliberately shows no allows-line today).

## Decisions — answered by Alex 2026-08-20, build to these

**1. Playoffs count, and are visibly marked, and are filterable.**
Playoff games go into the hit rates rather than being thrown away, but a
playoff game must *look* like one wherever a game appears — chart bar, per-game
log table row, form strip. On top of that, a three-way control: **All games /
Regular season / Playoffs.** So the default answers "how does he do", and the
filter answers "how does he do when it matters" without either being buried.

**2. A traded player keeps his whole log, plus a per-team filter.**
Don't split or hide the prior team's games. Add a control derived from the log
itself: **All games / with <TEAM A> / with <TEAM B>** — Alex's framing was
"view all his games, just his games with the Nats, just his games with the
Yankees", to research recent team form and role change. The team list is
whatever teams actually appear in that player's log, so it costs nothing for
the overwhelming majority who were never traded (one team → no control shown).

**3. Current season always outranks previous seasons. No exceptions.**
`L5` means the last five games **of the current season**, never five games
reaching back into last year. Previous seasons are not there to pad the
recent-form windows; they exist for three specific jobs Alex named:
consistency research, filtering on minutes/role/substitution patterns, and
seeing an offseason jump — a player whose opportunity changed between years.

> **The trap this creates, name it before writing code.** `ALL` currently means
> "every game in the log". The moment prior seasons are loaded into that log,
> `ALL` silently becomes multi-season and decision 3 is violated by default,
> everywhere, with no visible change. `ALL` must therefore mean *all of the
> current season*, and prior seasons must be reachable only through an explicit
> season control. Same applies to `buildHitRateSplits`, the feed's `all` column
> and `nAll`, `railSeasonAvg`, and anything else that says "season".

**Shared shape.** All three decisions are the same UI primitive — a segmented
filter over the game log (**season type**, **team**, **season year**) that
narrows every downstream number together: chart, splits, verdict, per-game
table, and the sample-size labels. Build it once as one log-scoping control
rather than three separate ones bolted on at different times. Every hit rate
on screen must continue to state the sample it came from, so the counts have
to recompute with the filter, not just the percentage.


## Sizing, honestly

The roster work is small and mechanical. The **log backfill is the real cost**:
30 NBA teams × ~15 players ≈ 450 game-log requests, and MLB/WNBA add their own.
The existing per-player TTL + sessionStorage caches are built for a handful of
teams on today's slate, not a whole-league historical pull. Expect this piece to
need a genuine caching/batching strategy, and possibly a build-time or cron-time
prefetch rather than on-demand fetching in the browser. Do not promise this as
a quick change — see [[nba-data-is-real-this-note-used-to-say-the-opposite]].

## Knock-on effects once NBA is real

**Done, 2026-08-23.** Both of these landed with the data track; kept for the
reasoning. The badge in particular must not come back — see the note in
`FEED_SPORTS`.

- The `· SIMULATED DATA` badge on the NBA sport tab comes off (item 5 added it).
- NBA can get its allows-line, currently withheld because the numbers are RNG.
- ~~NBA can join the Games slate~~ — done. NBA is the fourth tab, on the same
  day-slate mechanism as MLB and WNBA, and `getTopPropsForMatchup` /
  `getPropsCountForGame` are wired for it. Because the page answers "what is on
  now" rather than "what can I research", the offseason is handled differently
  from the prop feed: opening night is an extra **date tab**, labelled as such,
  beside a Today tab that still honestly reads 0 games — not a substitution.
- The NBA feed's data disclaimer ("Sample data only — generated…") gets rewritten.

## Verification

Per sport, per piece: `npm run build`, then drive the app with an error listener
armed. Confirm a known real stat line by hand against ESPN/MLB for at least one
player per sport — a plausible-looking generated number and a real one are
indistinguishable on screen, which is exactly the failure this whole track
exists to remove. Check a traded player specifically. Force the fetch-failure
path: a roster or log that will not load must surface, never silently fall back
to generated data presented as real.

---

# Items 16 & 17 — landing page and the board (real design delivered)

Claude Design returned a **high-fidelity, two-screen handoff** on 2026-08-20, in
`design_handoff_propplace_landing_board/`. It supersedes the earlier item-16
sketch, which was written before any design existed.

```
design_handoff_propplace_landing_board/
  README.md                     intent + rules the markup can't express — read first
  PropPalace Landing.dc.html    screen 1, 1280px
  PropPalace Board.dc.html      screen 2, 1280px
  image-slot.js                 prototype scaffolding — DO NOT PORT
```

The tokens in it were taken from our own stylesheet, so colour/type/geometry
land as-is: `--bg #0a0b0d`, `--surface-1 #131519`, `--line #2b2f36`, accent lapis
`#3b5bdb`, status green `#3ecf8e` / red `#ef5b5b` / amber `#e8b13a`, Bricolage +
Archivo + Space Mono. Its content rules are the app's own rules restated (counts
first, thin samples get a verdict, green/red fixed and semantic, unknown
availability = no dot, accent never encodes health). **Nothing in the visual
language conflicts.** The conflicts are all structural, and they are below.

> The mocks' player names and figures are **plausible placeholders, not real
> logs** — the README says so explicitly. Every number must come from real data
> before this ships. A fabricated stat on the front page would be the worst
> possible place for one.

---

## ⚠️ Four conflicts with already-shipped work

Each contradicts a decision already made, built and pushed. All four are now
settled: **1 and 3 decided by Alex (2026-08-20); 4 decided the same day; 2
resolved by building it.** 1 and 2 are additionally **already built on the prop
feed** (`84a7182`, `7c9872c`) — items 16 and 17 inherit both rather than
re-deciding them.

Multi-select markets (1) is worth calling out as a deliberate reversal of item
5's single-market picker: not a mistake being corrected, a product call being
changed by the person entitled to change it. Say so in the commit.

### 1. Multi-select markets — DECIDED 2026-08-20 · **BUILT on the feed, `84a7182`**

Shipped on the prop feed: `selectedMarkets` is an array, empty means all, and
the saved-screen/share-link format stores it as a sorted comma-join so a
single-market screen serialises to exactly the old value and the legacy `"all"`
sentinel still decodes. The board (item 17) reuses the selection and
serialisation logic and shares no UI with it, per the rule below.

Alex's call: **multi-select wins, with no cap on how many.** The example he gave
is the use case — select Pass + rush yds, Rush + rec yds *and* Receptions and see
them as one pool. His words: "rather than being locked to just viewing a bunch of
lines for only one prop type at a time."

This reverses item 5's single-market `PropTypePicker` decision. That is fine —
it was a reasoned call and it is being overturned deliberately, by the person
whose product it is. Note it in the commit rather than pretending the earlier
decision never existed.

**Where it lives — DECIDED (Alex delegated the call, 2026-08-20):
share the pure data logic, share zero UI.**

Multi-select exists on **both** surfaces — the board has it by design, and the
feed is where Alex's "locked to one prop type at a time" complaint actually
lives. But "keep them separate" is a standing instruction, so the split is drawn
deliberately tight:

**Shared — one pure module, `src/lib/marketSelection.js`.** No React, following
the `lib/altLines.js` / `lib/calibration.js` / `lib/mlbStatus.js` precedent:
normalising a selection, validating ids against the current sport, toggling,
clearing, and — the important part — **serialisation and the legacy migration**.

**Not shared — everything visible.** The feed keeps `PropTypePicker` (its
dropdown, its search, its pinned quick picks), converted to multi-select in
place. The board gets its own grouped rail chips per the mock. No shared
components, no shared styling, no shared interaction model. Either surface can
be redesigned without touching the other.

**Why serialisation specifically has to be shared, and is not a style question:**
saved screens and `#screen=` share links encode the market field, and those links
are **public and cannot be recalled**. Two independent copies of the
string→array migration will drift, and the day they disagree is the day someone's
shared link decodes to the wrong board. One implementation, both surfaces, and
the old string form keeps decoding forever.

Worth knowing: the feed **already** has an all-markets mode ("All Props", 1,352
of 1,566 on MLB), so today it is binary — one market or all. Multi-select is the
missing middle, not a new axis.

Drive the groups from `PROP_GROUPS` (per-sport groups for all four sports
already exist), never from the mock's football-only markup.

**The small calls, made rather than left dangling:**
- **Empty selection means all markets** — on both surfaces, matching the board's
  `Clear`. No "you must pick at least one" state.
- **Feed trigger text:** none selected → `All Props`; one → that market's label
  (unchanged from today); two or more → `N props`, with the full list in a
  `title` tooltip. Naming them stops fitting past two.
- **Active filter chip** (item 5) reads the same text, and its `✕` clears the
  whole selection back to all.
- **`PROP_QUICK_PICKS`** — the four pinned markets per sport become toggles
  rather than jumps.
- **Sport change resets the selection**, matching today's behaviour (`recYds`
  is meaningless in MLB).

**Details worth deciding while building, not after:**
- What the feed's trigger reads with 3 selected — `3 props` vs. naming them.
  Naming stops working past ~2; a count plus a tooltip is probably right.
- `PROP_QUICK_PICKS` (4 pinned one-tap markets per sport) become toggles.
- The active-filter chip (item 5) currently reads `HITS · OVER`. With several
  markets it needs a count form, and its `✕` should clear the whole selection.
- Empty selection must mean **all markets**, matching the board's `Clear`.

> **⚠️ The migration trap — this will silently break saved screens.**
> `market` is a **single string** across `presets.js`: it is in `COMPARED`
> (`:67`), and `filtersEqual` compares with `a[k] !== b[k]` (`:74`). Add a
> `markets` **array** to that list and the comparison is reference equality —
> `["h"] !== ["h"]` is always true — so **every saved screen would show a
> permanent "Modified" badge** and no preset would ever match again. It would
> look like a UI bug with no obvious cause.
>
> Also: `decodeShareLink` decodes `market: str(f.market, 60)` (`:132`), and
> existing share links and everything already in localStorage carry the string
> form. So the change needs: array-aware comparison in `filtersEqual`, a
> read-time migration (`market: "h"` → `markets: ["h"]`), and a decoder that
> still accepts the old key. Old links must keep working — they are shared
> publicly and cannot be recalled.


### 2. The form graph changes meaning — **RESOLVED, built `84a7182`**

Built as the design specifies. `FeedFormStrip` is now grounded at zero on one
linear pixel scale shared with the line (`scaleMax = max(maxValue,
ceil(line + 1))`, `unit = 58 / scaleMax`, 4px floor), with the dashed rule at
the line's true position — white by default, accent-ink once dragged. The
line tag is a drag handle: half-value snapping, live bar recolouring, and the
caption, trailing-run rule and L5/L10 cells all recomputed from the same game
log. L20 and Season are deliberately **not** recomputed on a drag; the handoff
says do that server-side and there is no such endpoint, and doing it from the
row's shorter saved log would make them claim a sample they aren't using.

The original statement of the conflict is kept below for context.

#### Original note (superseded)

The design's graph is **grounded at zero** — bar height is the player's actual
stat that game — with a **dashed white rule** drawn across at the prop line, so
distance from the line is read against a visible baseline.

The shipped `FeedFormStrip` does something different: height encodes the
**margin** from the line (`0.3 + 0.7 * (margins[i] / maxMargin)`), floored at
30%, with no line drawn. Both directions compress to magnitude, so a 12-catch
game and a 0-catch game can render at similar heights on opposite colours.

The design's version is **better** — it shows the raw value *and* the line — but
it is a genuine behaviour change to a component on every feed row, every player
page and the ladder. Treat it as its own change with its own verification, not a
detail of the landing page. The dashed line is deliberately **white, not accent**
(it vanished against green fills at accent lightness in their review) — keep that.

### 3. Sport switcher — DECIDED 2026-08-20: add one, all four sports

Alex: "NFL was supposed to just be an example not the only sport on there." So
the board gets a sport switcher and per-sport market groups; it is not an
NFL-only surface.

Reuse the feed's existing tab row rather than inventing a second switcher —
including its two shipped behaviours: NBA carries the `· SIMULATED DATA`
qualifier (its rows come from a seeded generator, not a live feed), and the
strip of game chips drops any game that has already finished, per the
concluded-game rule in `52954f1`.

Market groups come from `PROP_GROUPS[sport]`, so switching sport re-groups the
multi-select chips automatically. The mock's Passing/Rushing/Receiving/Combos/
Scoring/Team & game grouping is simply what football looks like — MLB, WNBA and
NBA already have their own groupings in the same structure.

Consequence to handle: **the market selection cannot survive a sport change** —
`recYds` means nothing in MLB. The feed already resets its market on sport
switch (`setSelectedMarket(PROP_QUICK_PICKS[sport]?.[0] ...)`); the multi-select
version needs the same reset, and the saved-screen format already stores `sport`
alongside the markets so a preset stays coherent.


### 4. Board vs. games slate — DECIDED 2026-08-20: ship it as an addition

Alex's call: **build it alongside, decide later.** "Maybe have it be an addition
at first so I could determine which direction to go in, or whether to merge
certain aspects of them." Nothing is replaced or deleted until the two can be
compared side by side on real data.

That is the right call, and checking the two surfaces says why.

**The board is not a revamped Games tab.** The current Games tab is a
*game-tracking* surface. It handles nine distinct game states (`LIVE`,
`HALFTIME`, `INTERMISSION`, `STARTING`, `DELAYED`, `SUSPENDED`, `POSTPONED`,
`FINAL`, `UPCOMING`), carries the Gamecast with its linescore and statistical
leaders, and the Matchup page with Head to Head and Props with a read. The board
mock contains a single passing mention of "live" and no score, status, linescore
or matchup machinery at all.

So replacing the Games tab with the board would delete live game tracking, the
Gamecast and the matchup research page, and replace them with a prop table. That
is a straight loss, not a revamp.

**Structurally it resembles the Prop Feed** — both are filtered lists of props;
the board groups under game headers and the feed is flat. That resemblance is
worth knowing, but it is **not** a licence to converge them.

> **Explicit instruction from Alex, 2026-08-20: keep the three surfaces
> separate. Do not merge them in any way.**
>
> That overrides an earlier suggestion of mine in this plan that the board's
> minimum-sample slider and split filters might later migrate into the feed.
> They should not. The board's controls stay on the board; the feed keeps its
> own. No cross-pollination of controls between surfaces, in either direction,
> unless Alex asks for it by name.
>
> The one consolidation question left open, and it is his to answer later, is
> whether **the Games page gets folded into the board** — not whether the board
> and feed converge. Build so that stays possible: the board's game-group
> headers are the natural place game-level detail would eventually attach.

**What the board is *for* — Alex, 2026-08-20.** It does not replace the prop
feed either. It is "a magnified version of it that maybe can help people come up
with what props to choose/research."

That is the product distinction, and it should decide every later question about
what belongs on which surface:

| | Prop feed | The board |
|---|---|---|
| Job | work through props | decide *which* props are worth working through |
| User already knows what they want? | yes | no — they are still choosing |
| Density | dense, fast to scan | roomier, more context per prop |
| Reads like | a working list | a briefing |

So the board earns its keep by being *discovery*: the minimum-sample slider
("show me only props with enough history to mean anything"), the split filters
("only ones that hold up at home / against this defence"), the verdict pills,
and the game grouping that puts a prop in the context of the matchup it belongs
to. None of that is about scanning more props faster — it is about narrowing to
the few worth a closer look, then opening those.

**The test to apply when unsure where a feature goes:** does it help someone
decide *what* to research (board), or help them work through props they have
already chosen (feed)? Neither surface should grow toward the other, and
neither replaces the other.

**Build order consequence:** the board is additive, so nothing shipped needs
unpicking first. Route it at its own path and link it from nav. Items 1–5b stay
exactly as they are, and the Games tab keeps its slate, Gamecast and Matchup
page untouched.


## Item 16 — landing page

`PropPalace Landing.dc.html`. New route; **the feed stays the default for
returning users** unless Alex says otherwise (a marketing page in front of a
daily tool is a real cost).

Structure: top nav (three-bar mark + wordmark, `Games / Prop Feed / News` with
no active underline here, `SIGN IN` + `21+` pill right) · hero at
`grid-template-columns: 1fr 468px, gap 64px` · below-fold board teaser ·
footer.

**Left column** — eyebrow `2025 SEASON LOGS · NO PICKS SOLD`; H1 Bricolage 74px
in three explicit lines ("Know the sample / before you take / the line."); one
62ch paragraph; `OPEN THE BOARD` (solid accent) + `HOW WE COUNT` (underlined
accent-ink link); then a three-column rules strip — **HOW WE COUNT**, **THIN
SAMPLES**, **MARGIN, NOT JUST HITS**. That strip replaced a vanity
"props tracked / game logs" stat block, which they cut. Don't reintroduce it.

**Right column — the example card.** Nearly all of it already exists in the app
and should be composed, not rewritten:

| Card element | Already built |
|---|---|
| `78%` verdict figure | verdict block, item 1 |
| `7 of 9 games · 2025 season` | counts-first sample label, item 1 |
| form graph | `FeedFormStrip` — but see conflict 2 |
| Home / vs. SEA defense / Last 3 | `buildHitRateSplits`, item 1 |
| `FAIR SAMPLE · LEANS OVER` | STRONG/FAIR/THIN tiering, already in codebase |
| 92px headshot + availability dot | `PlayerAvatar` |
| board teaser cards | the Games slate, item 4 |

The genuinely new part is **choosing the hero player**: it must be a real row off
the live feed (e.g. highest hit rate with a fair-or-better sample), never
hardcoded. One of the four teaser cards must demonstrate the thin-sample rule —
`TOO FEW` / `3 games` / "Thin sample — no rate shown." — so the front page
teaches the rule rather than only asserting it.

**Their open question, ours to close:** the card's rate covers 9 games while the
graph shows 10, which is why the graph carries an explicit `LAST 10 GAMES`
heading. Normalising both to one window is cleaner and avoids a number that
looks like an error.

---

## Item 17 — the board

`PropPalace Board.dc.html`. Header: nav with `GAMES` active (accent + 2px accent
underline), `The board`, a date stepper `‹ SUN, SEP 14 ›`, `12 GAMES · 1,840
PROPS`, and a right-aligned sort control.

Body is `grid-template-columns: 236px 1fr`.

**Filter rail (236px), left.** Four blocks, and two of them are new capability
rather than restyling:

- **Market** — grouped multi-select chips (conflict 1), with `Clear`, in a
  296px-max scrolling region.
- **Minimum sample** — *new*. A slider over **1–17 games** (one NFL regular
  season) rendered as 17 clickable ticks, plus **user-defined presets** (`5+`,
  `9+`, `12+` by default) that can be added from the current slider value and
  deleted via `×` (must `stopPropagation`), **persisted per user**, sorted
  ascending, plus an `All` chip that bypasses the minimum. Note beneath restates
  the rule: props under the minimum still appear, without a rate.
  The existing `FeedPresets`/`presets.js` "Screens" feature is the precedent for
  persistence — reuse its storage approach rather than inventing a second one.
- **Split** — *new as a filter*. Checkboxes: Season / Home only / Last 3 games /
  vs. this defense. The app computes these splits today (`buildHitRateSplits`)
  but does not let them **drive** the board. Critical rule from the README:
  a split must recompute **the rate and its stated sample together** — if a split
  drops the sample below the minimum the row flips to `TOO FEW`, it never shows a
  percentage over three games.
- Rail foot: the data disclaimer in a sunken well.

**Prop table, right.** Shared grid `232px 176px 148px 1fr 132px`, gap 16px.
Header strip in `--surface-sunken`; game-group headers in `--surface-2` carrying
matchup, kickoff, venue and prop count; then prop rows:

`PLAYER` (38px headshot + availability dot, or none when unknown) · `PROP`
(`RECEPTIONS O5.5`) · `HIT RATE · SAMPLE` (22px rate above `7 of 9 games`; thin
sample shows `TOO FEW` + `4 games` and **no** percentage) · `LAST 8 VS. LINE`
(compact 34px graph, dashed line, no tag — a thin sample shows only the games it
has, with a `flex: 4` spacer holding the width so bars stay aligned across rows)
· `VERDICT` pill.

**Verdict pills ride the accent, never green/red** — `LEANS OVER` in accent,
`COIN FLIP` and `TOO FEW` in `--text-2`. That is correct and deliberate: green
and red mean cleared/fell-short on the bars in the same row, so a green verdict
pill would overload the colour two inches from where it means something else.

Row click routes to the **existing** player detail (items 1/2, cards 447/248).
The README says that screen "is not designed — do not invent it"; it does not
need to be, it is already built.

**Not built in the mock, listed as ours to implement:** hover states on rows,
chips and buttons; the date stepper actually advancing the slate; the sort menu;
loading skeletons at the same grid ("never render a rate before its sample");
and an empty state that says *which filter* is responsible.

**State the board needs** (from the README, matched to what exists):

```
selectedMarkets: string[]   // empty = all          -> drive from PROP_GROUPS
minGames: number            // 1..17                -> new
allSamples: boolean         // bypass the minimum   -> new
samplePresets: number[]     // persisted per user   -> reuse presets.js approach
splits: { season, homeOnly, last3, vsThisDefense }  -> buildHitRateSplits exists
date: ISO                   // drives the slate     -> gamesData fetchers exist
sort: 'hitRate' | ...       -> FEED_SORT_MODES exists
```

Derive the rate and its sample **from the same query** so they can never
disagree — that is the one invariant the whole product rests on.

---

## Sequencing note

Item 17 is the larger of the two and carries all four conflicts; item 16 is
mostly composition of existing parts. Landing first is the cheaper, lower-risk
start and it exercises the form-graph change (conflict 2) on **one** card before
that change has to hold across every feed row.

`image-slot.js` is prototype-only scaffolding for dropping images into the mock.
Do not port it. Headshots and crests wire to the real asset source, and the
availability rule holds: unknown status renders **no dot**.

---

# Monetisation track — accounts, subscription, beginner tutorial

Third track, independent of the redesign items and the data track. **Not
started:** planned in a session on 2026-08-21 that never landed. Verified
2026-08-21 — none of the files below exist, and the branch that session named
(`claude/accounts-subscription-tutorial-34tzoh`) is on neither origin nor this
machine. Treat the whole thing as unbuilt.

The full specification as written is reproduced in
[`ACCOUNTS_SUBSCRIPTION_TUTORIAL.md`](./ACCOUNTS_SUBSCRIPTION_TUTORIAL.md).
This section records what it is and what it collides with; that file is the
detail.

## What it covers

1. **Accounts** — email + password on the Upstash Redis already in the project.
   `api/_lib/auth.js` (scrypt + `timingSafeEqual`, `pp_session` HttpOnly cookie,
   Redis-backed sessions and rate limiting), endpoints under `api/auth/…`.
2. **Subscription** — real Stripe Checkout + Billing Portal + webhook, on test
   keys until live ones are added. **The server is the only source of truth for
   plan; the client never sets it.**
3. **Free tier** — a curated allowlist (`src/lib/freeTier.js`) of two deliberately
   low-profile players per sport. Everything else renders **locked, not hidden**.
4. **Tutorial** — a spotlight coach-mark tour over the real UI, driven by
   `data-tour` attributes, teaching betting concepts from zero.
5. **Settings rebuild** — Profile · Security · Preferences · Betting ·
   Subscription · Tutorial · Resources.

## Why it is a separate branch

`CLAUDE.md` says work on `master`, and that stands for everything else. This is
the one deliberate exception: `master` auto-deploys to the public site, and a
half-built paywall must never be live mid-build. Merge to `master` when it is
ready to charge people.

## What it collides with — check these before building

### 1. Free tier vs. live rosters — RESOLVED by rotation

The original spec pinned two low-profile players per sport, which would have
broken against the data track: live ESPN rosters mean a pinned player can be
traded or waived and silently vanish, emptying the free tier to one player or
zero with no error.

**Alex scrapped that on 2026-08-21.** The free tier is now a small rotating
daily set drawn from *today's actual rows*, any tier of player, stars included.
Because nothing is pinned, there is no id that can go stale — the collision
disappears rather than needing a workaround. Detail in
[`ACCOUNTS_SUBSCRIPTION_TUTORIAL.md`](./ACCOUNTS_SUBSCRIPTION_TUTORIAL.md) §4.

The one rule to keep: the set must be **deterministic per (sport, day)**, seeded
from the date, never `Math.random()`. A set that reshuffles on refresh lets
someone reroll until they get the player they wanted, and makes the free tier
impossible to talk about publicly.

### 2. The landing page's hero card vs. the paywall (item 16) — mostly resolved

Item 16 puts one **real** player card on the front page, seen by signed-out
visitors, for whom almost everything is locked.

Rotation largely solves this too: the hero draws from the day's free set, which
now contains real, recognisable players rather than deliberate nobodies. The
front page demonstrates the product on someone worth seeing, and it changes
daily.

Still to settle: whether the hero picks the **strongest row among the free set**
(consistent with the paywall, and it rotates) or the front page is exempt from
gating entirely (best possible shop window, but then the first thing a visitor
clicks after signing up is locked). Lean to the former — a front page that
advertises what it then withholds is the worse trade.

### 3. Rule 4 — already handled, keep it that way

The plan is careful here and it must stay careful: locked rows still render with
avatar, name and availability dot; only the numbers blur. Row counts keep
counting locked rows so "showing 42" never silently shrinks. That is exactly
right per CLAUDE.md rules 1 and 4 — a paywall is not a licence to drop rows.

### 4. Secrets

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` are env vars and
must never be committed — same discipline as the existing `CRON_SECRET`. The
repo currently contains no secret values and should stay that way.

## Sequencing

Auth first (nothing else works without it), then the paywall, then Stripe, then
the tutorial — the tutorial spotlights real UI and wants that UI settled. Worth
weighing against the redesign items: items 16/17 change the surfaces this would
gate, so building the paywall first means gating screens that are about to be
rebuilt.

---

# The competitive brief — built 2026-08-24

Design mocked the Outlier/PropsMadness brief as `3a`–`3g` in
`NEW CLAUDE MOCKS V3/3 - PropPalace Brief Mocks.dc.html` (turn 3). Alex: *"I
want everything from turn 3 implemented."* All eight items are built.

| Item | Mock | Where it lives |
|---|---|---|
| 1 — the games, listed | 3a | `src/PlayerGameLog.jsx`, under the chart on all four player pages |
| 2 — opposing lineup joined to Savant | 3b | `src/OpposingLineup.jsx`, MLB pitcher pages |
| 3 — percentiles, both sides | 3c | `src/PercentilePair.jsx`, MLB pitcher pages |
| 4 — H2H | 3d | A feed column, from `h2hSplit` |
| 5 — both seasons | 3d | A feed column (lazy) **and** `SeasonSplit` on the player page |
| 6 — findings as sentences | 3e | `src/FindingsPage.jsx` + `src/lib/findings.js`, its own nav tab |
| 7 — game conditions | 3f | `src/GameConditions.jsx` + `src/lib/weather.js` |
| 8 — who has no props | 3g | `WithoutProps` in `BoardPage.jsx`, fed by `FEED_SKIPS` |

Pitch mix and the bullpen block are not built and were not mocked, per the
brief's own ordering.

## Decisions taken while building it — do not silently reverse

**The prop feed lost its ODDS and LINE columns.** ODDS printed "Coming soon" on
every row of every sport. LINE printed a number the row already states twice —
in the proposition and on the chart's draggable tag — and what it alone carried
(the average cushion, and the way back from a dragged line) moved under the
proposition as `lineNote`. Together they were 198px of a table that was
*already* overflowing its card by 164px before H2H was added. Player Detail's
verdict block still keeps an Odds slot; that is where a real feed lands first.

**Last season is lazy on the feed, eager on the player page.** Prior seasons
load one player at a time (`usePriorSeasonLog`) and the NFL feed carries ~3,000
rows, so the column fills only for rows currently on screen — a page of rows is
a much smaller set of *players*. On the player page both seasons come off the
merged log that was already in memory. Do not make the feed column eager.

**Findings and the Board both stay.** Asked directly whether one replaces the
other: no. The Board ranks one number per prop, so a prop that is a coin flip
on the season and 8-of-8 at home cannot appear on it. Findings runs the splits.
One is a ranker, the other a search.

**Structural near-certainties are detected by the half-point line, not by
variance.** The variance test is the principled-looking one and is wrong: FG
attempts run 1–4, so variance is large while the outcome never changes, and a
kicker clearing 0.5 attempts 18 straight times led the NFL findings list. 0.5
is the market's minimum granularity; when the log never crosses it, the line is
a property of the stat.

**The opposing-lineup ranking has a 100-PA floor.** Without it the Pirates
lineup led with a call-up at 38.8% K over 49 plate appearances, flagged as the
batter who most favours the strikeout prop, ahead of a regular at 29% over 536.
Under the floor a batter keeps his row and his numbers and is simply not
ranked; the count of who that applies to is stated.

**No API key was added.** MLB weather already arrives on the schedule request
and reads wind against the field ("6 mph, In From CF"), which a lat/lon
forecast cannot. NFL weather is Open-Meteo — no key, no account, CORS-open —
and deliberately reports compass wind only, because turning "220° at 12 mph"
into "blowing out to right" needs 32 stadium bearings entered by hand.

## Still open on this track

- **3b and 3c are MLB pitcher pages only.** They need a published batting order
  and a public plate-discipline leaderboard; no other league has both.
- **The `vs this opponent` finding is thin in the NFL** (teams meet once or
  twice a year), rich in the WNBA/NBA. Working as intended, worth knowing.
- **Indoor sports render no conditions block when the slate row has no venue.**
  There is genuinely nothing to say about conditions for an indoor game, but
  the venue name would still be worth showing when it is known.
