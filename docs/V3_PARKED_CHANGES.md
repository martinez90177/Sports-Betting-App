# Parked for the v3 rebuild — 2026-09-09

Everything asked for on 2026-09-08/09 that is **layout**, recorded here because
the v3 transcription replaces those screens rather than amending them. None of
it is lost; all of it needs re-expressing in the v3 layout once each screen is
rebuilt from its mock.

**Why this file exists.** A day of work went into player detail and the prop
feed before anyone checked it against `v3 Mocks/`. It was built from Alex's
screenshots and from Outlier and PropsMadness, which is the exact failure
`v3 Mocks/IMPLEMENTATION-README.md` opens by naming: *"an implementer reading
the mocks, understanding the ideas in them, and then rebuilding those ideas on
top of the layout that already exists."* The ideas were wanted. The layout they
were bolted onto was not the design.

Target for the rebuild is `PropPalace Desktop v3.dc.html`,
`PropPalace Mobile v3.dc.html` and `PropPalace Board v4 part 2.dc.html`. Alex,
2026-09-09: **ignore `v3 Mocks/Page redesign for uniqueness/`** — it covers one
screen and is not the target.

---

## When this gets applied

**After v3 ships everywhere, not during.** Alex, 2026-09-09: *"all changes made
today i still want to be done to the logic of the site, they can go on after v3
is fully shipped onto here to prevent issues."*

So the transcription is done straight, against the mocks, without trying to
carry today's work along inside it. Sections A and B are then re-applied on top
of the finished v3 screens. Attempting both at once is how a screen ends up
neither.

**Two exceptions, applied during transcription.** Both contradict the mock on
purpose, and a careful transcriber will undo both unless they read this first.

1. The `Last 3 games` split stays removed. Alex: *"make sure 'last 3' split is
   removed."* The v3 mock draws it — see A3.
2. **No new alt-line surface is built.** Alex, 2026-09-09: *"i do not want
   the alt line ladder, dont add it … hold off on the alt line prop feed stuff
   for now."* Frame 1a already has its ladder in the shipped component, so
   this is not a thing to remove — it is a thing to stop working on. Leave
   both alt-line surfaces exactly as they stand and raise the question at the
   end — see B15.

---

## A. Keep — re-apply on top of the finished v3 screens

Alex: *"i made those changes because i want them and didnt realize you never did
v3 so i want them on the new model too."*

These are **additions**, not layout, so they survive the rebuild and have to be
placed into the v3 player detail rather than dropped.

| What | Where it lives now | Note for the rebuild |
|---|---|---|
| **Supporting stats** | `src/v3/SupportingStats.jsx`, NFL only | Attempts / completion rate / yards per attempt / team pass rate for a QB; receptions-targets, target share, yards per reception, longest for a receiver. All counted off the same games as the graph. Target share is exact — a team's pass attempts for a game are the QB's attempts in that same game. Needs a home in the v3 centre column. |
| **Similar players** | `src/v3/SimilarPlayers.jsx`, NFL only | How comparable players have done against tonight's defence, graded against tonight's line, with an ALL-position / SIMILAR-ROLE toggle. Answers what H2H cannot, because most NFL pairs never meet. |
| **A3 — "Last 3 games" removed from SPLITS** | `src/v3/playerDetailProps.js` | **The one item applied DURING transcription, and it contradicts the mock deliberately.** The v3 SPLITS row reads `Season · Home only · Away only · Last 3 games · vs this pitcher`. Alex: *"seems like a silly split when a custom window is possible"* and, on 2026-09-09, *"make sure 'last 3' split is removed."* Build the v3 splits row **without** Last 3. A careful transcriber will otherwise put it straight back, because the mock draws it. |

---

## B. Parked — re-express these in v3 after the rebuild

Layout and control changes made on the old player detail and prop feed. They
describe what Alex wants, not how it should look; the v3 frame decides that.

**Player detail**

1. **Market control** — moved from the left rail to a horizontal strip across
   the top. The v3 rail keeps MARKET; revisit whether Alex still wants it out
   of the rail once the v3 rail exists.
2. **Market strip centred** across the top (asked for, never built).
3. **Graph taller** — 330px over a 250 span, up from 268/224.
4. **Value scale** in a left gutter on the graph (390 / 280 / 170).
5. **Alt lines collapsed** behind a disclosure so the graph gets the page.
6. **Roster tabs lead with the subject's own team.**
7. **Keyboard walk** — left/right through the roster, up/down through markets.
8. **Bench break** — split the switch-player rail after the last rotation
   player, label the rest `Bench`, collapse it behind a dropdown *(asked for,
   never built)*.
9. **Teammate filter moved to the left rail** *(asked for, never built)*.
10. **Rail rows that fit the name** — names truncate to `Amon-R…` while the row
    has spare width; taller rows are acceptable *(asked for, never built)*.
11. **LaPorta's name behind the QUEST badge** — same root cause as 10 *(asked
    for, never built)*.

**Prop feed**

12. **Market tabs boxed** like the player-detail pills, with a scroller and
    left/right arrows — everything past `Rush +` is currently unreachable
    *(asked for, never built)*.
13. **MORE FILTERS** moved from last in the rail to directly under LEAGUE.
14. **Rate cells washed by value**; the accent moved to the border so fill
    means the rate and the border means the scored window.
15. **Alt lines — parked again, and the last thing to raise.** Alex,
    2026-09-09: *"i do not want the alt line ladder, dont add it, i want the
    alt lines to show like how we planned to set it up just today and similar
    to outlier's system … if needed hold off on the alt line prop feed stuff
    for now and remember to bring this up once youve finished with everything
    so we dont forget."*

    **So build no alt-line surface during the transcription — not frame 1a's
    ladder, not frame 1c's rows — and reopen this item once v3 has shipped on
    every screen.** It is the standing item to raise at the end.

    *What is wanted when it is raised.* Alt lines as **rows**, Outlier-style,
    with the side and the line inside the proposition. Frame 1c happens to draw
    exactly that (`Over 1.5 Total Bases`, `Over 0.5 Hits`; slip legs badged
    `MAIN` / `ALT` reading `74% · 8 of 10 · one rung up`), so the frame and
    Alex agree here — it is held back for sequencing, not because it conflicts.
    Outlier's own toggle takes their row set from 4,233 to 13,652 and lists
    Over and Under separately. Alex, 2026-09-08: *"draftkings for passing yards
    does increments of 10 starting with 150+ then 160+ etc, all the way to
    400+, but the odds are what separates them."*

    *Why it was not built on 2026-09-08/09, since Alex asked.* It simply never
    was. It was requested, written down as this item, and then the v3 gap was
    found the same evening and every layout-shaped change was parked. The odds
    tier did not stop it. The ladder still on the feed today
    (`FeedRowLadder`, `PropLedger.jsx:17908`, mounted at `:21764`) is the
    **old** surface, present only because its replacement was never made — last
    touched by `3bce162`, long before any of this.

    *The one thing the free tier does limit* is the column that makes a rung
    worth reading. `src/lib/altLines.js` is explicit that no book prices these
    rungs: every price it returns is the sample's own hit rate run through
    `probToAmericanOdds` (`altLines.js:102`). Real per-rung prices need an
    alt-line odds feed, which the free tier does not carry. A row set can be
    built without one, with a derived price column that says so. That trade is
    the decision to take when this item is reopened.

16. **Sort modes — CONFLICTS WITH THE FRAME, needs a decision.** What was built
    today: hit rate as its own mode and the default, the chosen mode leading
    rather than breaking ties, and an opposite on a second click. What frame 1c
    draws: **`SORT · Matchup · Trend · Cushion · Streak`**, with the caption
    *"sorted by nothing — click a column to rank by its rate"* — so the v3
    default is **no sort at all**, ranking comes from clicking a column header,
    and the four chips are a different set entirely (Cushion and Streak do not
    exist in the app; Best hit rate, Biggest role and Most consistent do not
    exist in the frame).
    Alex's intent underneath it stands and has to survive: *"i dont want this
    site to only be overs and not catered towards under research either."*
    Ask before transcribing 1c: keep the v3 chips and add direction-flipping to
    them, or keep today's set. Do not silently pick one.

---

## C. Not parked — these are data or defect fixes and stand on their own

`IMPLEMENTATION-README.md`: *"If the mock and the app disagree about data, the
app wins."* None of these are layout, and the v3 rebuild should inherit them.

- **Anytime TD counted passing touchdowns** — every QB row in that market was
  wrong, on the feed, the player page and Findings.
- **Week 1 season rollover** — rolling windows merge the prior season so a
  one-game log does not collapse every rate to "too few".
- **Live NFL slate** — the fixture lookup reads the current week instead of a
  hand-typed Week 1 snapshot that goes stale on 17 September.
- **Per-market defence ranks** — measured off the game logs. New Orleans is 5th
  against the pass and 26th against the run; one points-allowed number hid both.
- **`dragLine` never cleared on a market change** — a line dragged on Pass Yds
  followed the reader onto a Receptions page and graded every number against it.
- **Drag and keyboard step** — a step of 5 could not reach 249.5 or 259.5, the
  lines books actually post; the keyboard nudged by 0.5 onto whole numbers,
  which are pushes this app never posts.
- **Dome games** said "forecast still pending" forever on desktop.
- **Availability dots** never resolved on NFL or NBA feed rows.
- **Findings streaks** graded structurality against the season instead of the
  run, so a kicker's "0.5 FG attempts" led the page.
- **WNBA player page crashed** — its guard had drifted above two hooks.
- **~1,700 lines of dead pre-v2 page** deleted from all four sport pages.
- **`usePlayerPageState`** — the eleven pieces of state all four pages held
  separately, and the effect that runs with them. Slice one of the shared-code
  refactor; the remaining slices are still to do.

---

## D. The audit that prompted this — and its correction

**The audit that opened this file was wrong, and the plan built on it was
wrong.** Recorded here in full, because the wrong version was acted on for most
of a day and would be acted on again by anyone reading only the top of this
file.

*What was claimed on 2026-09-09:* that v3 had never been applied; that the
player detail left rail was missing four of its seven groups; and that all
~24 frames needed transcribing from the mocks.

*What the repository says.* Frame 1a was transcribed from the mock in
`12cb60b Desktop Player Detail — frame 1a's chassis, rails and graph`, then
audited twice more (`117e32c Frame 1a's last two regions, and four things the
audit found`, `988f56a The rail pill I never transcribed, and a control that
never rendered`). Every rail group is in `src/v3/PlayerDetailDesktop.jsx`
today — MARKET, SEASON, WINDOW + YOUR OWN, WORKLOAD, OPPOSING STARTER, SPLITS,
MINIMUM SAMPLE on the left; SWITCH PLAYER, TEAMMATES, OPPOSING LINEUP,
INJURIES · THIS MATCHUP on the right. And all twelve desktop v3 components are
imported and rendering: My Picks, Games, Findings, News, Injuries, Matchup,
Gamecast, Settings, Landing, Player Detail, Prop Feed, Board.

*Why the page still did not look like v3.* Because of the work done on
2026-09-08/09. `git diff f212377..HEAD -- src/v3/PlayerDetailDesktop.jsx` is
**+233 lines**: MARKET lifted out of the rail into a top strip, the graph grown
from 268 to 330, the alt lines collapsed behind a disclosure, Supporting Stats
and Similar Players inserted. Alex's observation — *"any reason you could tell
me why this isnt the v3 version"* — was correct. The diagnosis of it was not.
The page drifted off v3 on 2026-09-09; it did not fail to arrive there.

*What that changes.* There is no ground-up rebuild to sequence behind, so the
"after v3 ships everywhere" gate at the top of this file applies only to
screens that genuinely still differ. The work is:

1. **Restore fidelity** on the frames that drifted — 1a first, since every item
   in Section B that was actually built was built on it.
2. **Audit each frame's component against its own mock frame** for real gaps.
   A component being wired is not evidence that it is faithful; that is exactly
   the mistake this section records.
3. **Re-express Section B inside the v3 layout**, which is what Alex asked for:
   *"i want them applied to the way the v3 mock is."*

*Confirmed gaps so far:*

| Gap | Detail |
|---|---|
| WORKLOAD slider absent on NFL and MLB | The component renders it whenever a `workload` prop arrives. NBA (`PropLedger.jsx:2894`) and WNBA (`:10617`) pass one; the NFL and MLB call sites do not. The mock labels it `PA / MINUTES / SNAP SHARE` — MLB wants PA, NFL wants snap share. Note that snap share is the column `SNAP_PROFILE` only covers for seven hand-listed players, so NFL needs a real source before it can have this control. |
| SEASON group can vanish | It renders only when `seasons.length > 0`, and the two-season cap added on 2026-09-09 can empty it. |

`public/__mockcheck/` is gitignored and serves the mock files through the dev
server, which is how to put a frame and a screen side by side at the same
width. **Use it before declaring any frame unfaithful.**

---

## E. The real audit — every desktop frame, 2026-09-09

Done properly this time: mock frame against component, not mock frame against
a live page carrying a day of undocumented changes.

**Method, so it can be repeated.** Every human-visible literal inside a frame's
markup (text between tags, templates stripped, designer annotations like
`CARRIED OVER FROM MOBILE` excluded) checked against the component that renders
it, then against the whole of `src/` so shared chrome — the nav, the slip, the
read panel — counts as found rather than missing.

**Result: all twelve desktop frames are faithful at the label level.** Three
literals appear nowhere, and all three are explained rather than missing:
`OPPOSING LINEUP ·` and `MY PICKS · 4` are built by template (`` `OPPOSING
LINEUP · ${n}` ``), and `OVER 1.5 TOTAL BASES` is the mock's own sample row.

### E1. What that check cannot see, and what does

A label being present proves nothing about whether it ever reaches a screen.
`MINIMUM SAMPLE` is in `PlayerDetailDesktop.jsx` and has never once rendered,
because the prop that gates it is passed by no one. So: every optional prop in
every desktop component that gates a region, checked against every call site,
including the spread bags (`v3Shared` on Games and Findings, which do pass
`activeWeek`, `currentWeek`, `sampleQuery` and `hideStructural` — those are not
gaps).

**This took three passes to get right, and the two wrong ones are the lesson.**

*Pass 1* looked for `propName={` at call sites. That misses every prop handed
over in a spread bag — `{...v3Shared}` on Games, Findings, News and Matchup —
because bags use shorthand (`readScope,`) rather than JSX attributes. It
over-reported six dead regions; four were wired perfectly well.

*Pass 2* fixed that and still reported the Findings empty state as dead. It is
not: `FindingsDesktop.jsx:154` reads `{emptyCopy || "Nothing on this slate
clears a bar worth naming…"}`. The prop is an **override**, not a gate. An
unpassed override costs some specific wording; it does not lose a region.

**So the test is two questions, not one.** Is the prop passed — as a JSX
attribute (`x={`), a bag shorthand (`x,`) or a bag key (`x:`)? And if it is
not, does the region fall back (`x ||`, `x ? … : …`) or vanish (`{x && …}`)?
Only the second kind is a hole. The script is in the session scratchpad; it is
twenty lines and worth rewriting rather than trusting a grep.

**Result, across all twenty v3 components, desktop and mobile — exactly one:**

| Frame | Component | Prop | What is lost |
|---|---|---|---|
| 1a Player Detail | `PlayerDetailDesktop` | `samples` | The entire **MINIMUM SAMPLE** rail group. Frame 1a's values are `10+ · 15+ · 30+ · All`. Transcribed when the frame was built, gated behind `{samples && samples.length > 0 && …}`, and passed by no call site since — so it has never once been on screen. |

Two further gaps, found by reading rather than by sweeping:

| Where | Gap |
|---|---|
| 1a right rail, NFL | **OPPOSING LINEUP** never appears — `lineups.opps` arrives empty on the NFL page. TEAMMATES beside it is populated, so the shape works and it is the opposition side that is not being built. |
| 1a left rail, MLB | **WORKLOAD** — the mock specifies `PLATE APPEARANCES` for its MLB subject, and the MLB page passes no `workload`. NBA and WNBA both do. |

### E2. Frame 1a, on the live NFL page

After the restore in `4e5cfc9`, what is on screen and what is not:

| Frame 1a rail | NFL page | Verdict |
|---|---|---|
| MARKET | present | restored |
| SEASON | absent | **correct** — it renders when the log spans more than one season, and the NFL log is 2025 only until Week 1 finishes. It will appear on its own. |
| WINDOW + YOUR OWN | present | ok |
| WORKLOAD | absent | **not a gap for the NFL.** The mock has three subjects — MLB `PLATE APPEARANCES`, NBA and WNBA `MINUTES` — and **no NFL subject at all**. "SNAP SHARE" was never in the design; it came from an earlier note of mine. MLB is a genuine gap: the frame specifies PA and the MLB page passes no `workload`. NFL cannot have this control honestly anyway while `SNAP_PROFILE` is a seven-player hand-written table. |
| OPPOSING STARTER | absent on NFL | MLB-shaped (pitcher handedness); correct to hide. |
| SPLITS | present | ok, minus Last 3 by A3 |
| MINIMUM SAMPLE | absent | **real gap — E1.** |

Right rail: SWITCH PLAYER, TEAMMATES and INJURIES · THIS MATCHUP all render.
**OPPOSING LINEUP does not** — `lineups.opps` arrives empty on the NFL page.

### E3. Still to audit

The eleven mobile frames and the two Board frames. Same method; it is cheap now
that the scripts exist.

### E4. Found by reading the frame's data, not its markup — the six-cell strip

Frame 1a's strip under the graph is six rate cells: `LAST 5 · LAST 10 ·
LAST 20 · 2026 · HOME · AWAY`, each a percentage over the sample behind it
(`cellsOf` in the mock returns `{label, value: "62%", sub: "8/13"}`).

The app was feeding it `seasonSplits()`, which returns `{label, rate, hits, n}`
for **this season and last**. The strip reads `value` and `sub`. Neither exists
on that shape, so every cell rendered its heading over two blanks — live, on
any player with two seasons of log. An MLB page showed a box containing the
words "2026" and "2025" and nothing else, and the frame's six cells were never
more than two.

Replaced by `frameSplitCells`, and `seasonSplits` deleted with it. Two
deliberate departures from the mock, both recorded in the function's own
comment: the rolling windows come from `WINDOWS[sport]` rather than the mock's
literal 5/10/20 (that trio is its MLB subject's, and a `LAST 20` cell on a
seventeen-game season is the season wearing a wrong label), and there are two
colour tiers rather than three, because the mock's middle tier is amber and
amber in this app means *questionable*.

**The label sweep in E1 could never have found this.** Every string it looks
for — `LAST 5`, `HOME`, `AWAY` — is generated at runtime from data, so there is
nothing in the component to match against. Frames have to be read for what
feeds them, not only for what they say.

**And a build passing proves nothing here.** Deleting `seasonSplits` took
`frameSplitCells` with it, `npm run build` passed clean, and the MLB page threw
`frameSplitCells is not defined` into its error boundary. JavaScript has no
compile-time check for an undefined identifier. Drive the page.

### E5. Both remaining 1a gaps closed — 2026-09-09

**MINIMUM SAMPLE now exists, and it marks rather than hides.**

The mock draws the control, defaults it to `15+` and never reads it, so what it
*does* was this app's decision. The handoff calls the left rail "what filters
the page", and on a page about one player the only thing a sample floor can
filter is which rates the page will state plainly. So it flags every rate with
fewer games behind it than the floor — in the six-cell strip (`4/5 · thin`) and
in the alt-line ladder's header, which now grades itself against the reader's
floor instead of `THIN_GAMES`, so the rail and the card cannot disagree.

It marks and never hides, because that is the app's own published rule: the
Findings header prints `A THIN SAMPLE IS MARKED, NEVER HIDDEN` across itself,
and a blanked cell would leave a reader unable to tell a thin sample from a
missing one — CLAUDE.md's fourth rule.

Default is **10**, not the mock's 15, because 10 is already what this app calls
thin (`THIN_GAMES`, `lib/altLines.js`). The state lives in
`usePlayerPageState`, which is what that hook exists for.

Verified on Goff: at `10+` the strip reads `LAST 3 2/3 · thin`, `LAST 5 4/5 ·
thin`, `LAST 10 5/10` clean; at `30+` every cell is thin and the ladder says
`10 games counted · too few to lean on`; at `All` every mark clears.

**The MLB workload slider was already built.** `minPA` / `maxPA` existed on the
page and already filtered the log (`PropLedger.jsx:14056`) — the control was
just stranded in the old filters drawer, off the v3 rail. So the rail group the
frame draws sat empty while the filter behind it worked. Wiring the existing
state to `workload` is the whole fix; no second copy of a filter to keep in
step. Scaled 0–6 because that is the scale already in use — the mock says 7,
but seven plate appearances is an extra-innings game and changing the ceiling
would silently redefine the existing "Any" in three other places.

Withheld on pitchers, because a starter's plate appearances are not his
workload — innings are — which is the call `lib/role.js` already makes.
Verified: Bichette shows it, Robert Stock (SP) does not.

**Frame 1a's left rail is now complete on MLB** — MARKET, SEASON, WINDOW,
PLATE APPEARANCES, OPPOSING STARTER, SPLITS, MINIMUM SAMPLE, all seven.

*Two mistakes worth keeping.* Both were caught by driving the page, neither by
the build. `ladderThin` was first declared beside the other card state, 70
lines above the `rungs` memo it reads — a clean build and
`Cannot access 'rungs' before initialization` on load. And the MLB workload was
first written with fresh `minPa`/`maxPa` state and a second copy of the filter,
before finding that the page already had both. **Search for the state before
adding it.**

---

## F. The mobile and Board frames — 2026-09-09

Same method as E, run over the eleven mobile frames and the two Board frames.

**All thirteen are faithful at the label level.** Every literal that came back
"absent" resolves to one of three things, and none is a gap:

| Label | What it actually is |
|---|---|
| `ADVANCED · 7 MORE` | template — `` `ADVANCED · ${advanced.length} MORE` `` |
| `CONDITIONS · CAMDEN YARDS` | template |
| `ALL  TOGETHER` | template — `` `ALL ${view.length} LEGS TOGETHER` `` |
| `MLB · 15 GAMES`, `OF 30 · MID` | templates |
| `MY PICKS · 7` | template, and rendered on the Board by `MaybeV3Shell` rather than by `BoardMobile` itself |
| `OVER 1.5 TOTAL BASES` | the mock's own sample row |
| `DIAGNOSIS` | a designer's panel *about* the mocks — its heading reads "What the screenshots show" |

The gate sweep in E1 already covered all twenty components, mobile included, and
found nothing dead on mobile.

### F1. Found by driving it: the roster dock led with the wrong team

`PlayerDetailMobile` still had the pre-fix desktop code —
`React.useState("own")` and rails in fixture order. `ownRail` is always the
**away** roster, so a Detroit player's page opened on `NO · 29`, selected,
listing Saints. On a Lions page. The desktop frame took this fix on
2026-09-09 (B6); mobile was never touched.

Same shape as the desktop fix: find the rail holding the active row, lead with
it, and treat `rosterTeam: null` as "follow the player" so a tap is an override
that clears when the subject changes.

The effect is the **last hook in the component**, and it is only safe there
because there is no conditional return above or below it — checked before
adding, because that is precisely what the WNBA page got wrong when its guard
drifted above two hooks.

Verified: Goff's page now reads `DET · 23` then `NO · 29`, with the dock
listing Goff, Brown, Williams, TeSlaa, Gibbs.

### F2. A method note that cost real time

**This browser pane's console buffer accumulates across navigations.** A
`NaN is an invalid value for height` warning from `FormPlot` on the MLB player
page looked live and was not — it came from an intermediate HMR state while
`PropLedger.jsx` was mid-save and `frameSplitCells` was briefly undefined.

Do not read fidelity or defects off `read_console_messages`. Install a trap and
read what it catches on a clean load:

```js
window.__nan = [];
const o = console.error;
console.error = function (...a) {
  const s = String(a[0]);
  if (s.includes("NaN") || s.includes("invalid value") || s.includes("hooks")) window.__nan.push(s.slice(0, 140));
  return o.apply(this, a);
};
```

A clean load of the MLB player page catches zero.

Also: clicks through the pane's `computer` tool time out after 30s on this app,
because it never reaches the idle state the tool waits for — a known rAF
quirk of this project. Driving the DOM with `javascript_tool` (`el.click()`)
works and costs nothing.

---

## G. Both open decisions taken — 2026-09-09

### G1. B16 sorts — **keep today's set**. Deliberate deviation from frame 1c.

Alex, 2026-09-09: *"for sorts keep today's set."*

Frame 1c draws `SORT · Matchup · Trend · Cushion · Streak` with the caption
*"sorted by nothing — click a column to rank by its rate"*. The app keeps
**Best hit rate · Biggest role · Easiest matchup · Most consistent · Trending
up**, each with an opposite on a second click, and hit rate as the default.

This is now a standing deviation, third alongside the removed Last 3 split and
the un-built ladder. Do not "restore" the frame's chips. The reason the app's
set wins: Cushion and Streak have no builder behind them, the flip covers
Alex's *"i dont want this site to only be overs"* directly, and column-click
ranking already exists beside the chips (`columnSort`), so the frame's
interaction is present as well as the chips.

### G2. B15 alt lines — **built, as rows, with a derived price column**

Alex chose option 1: ship the rows now, price column derived and labelled,
upgrading in place the day a real alt-line odds feed lands.

**An alt line is another row.** `feedRowsWithAlts` expands each prop into its
posted line plus its rungs, and every rate is recounted over the same games
against the new line — nothing modelled, nothing interpolated. Rung lines come
from `buildRungs`, the same walk the ladder used, so the feed and the player
page can never offer different rungs for one prop. The NFL feed goes from
**~2,100 props to 12,918**; Outlier's own toggle takes theirs from 4,233 to
13,652.

Expansion happens **before** the Over/Under flip, so the Under feed stays the
single inversion it has always been rather than a second, separately counted
set. `opps` joins `homes` on every row so an alt row can recount H2H against
its own line instead of inheriting the main line's number under a different
label.

**The feed's ladder is gone** — `FeedRowLadder`, the `OPEN LADDER` control and
the `AltLineLadder` default import with them. The player page keeps its own,
folded, because frame 1a draws it there and Alex's instruction was about the
feed.

Pick ids stay aligned across surfaces: an alt row carries `altOf` and
`mainLine`, so `feedPickId` writes the parent's key with a rung suffix — the
same id the player page writes for that rung. One leg, one slip slot, whichever
surface added it.

**The problem this created, and the rule that fixes it.** With alt lines on,
the low rungs clear every time: `Over 136.5 Pass Yds · 10 of 10` is true,
useless, and outranked every real spot in the league — the toggle replaced the
whole top of the feed with them.

It is the same fact `rungAt` already refuses to convert: a rate of 0 or 1 has
no price, only the ±1000 clamp, *"a display floor dressed up as a number the
games produced"*. So a row the app declines to **price** now sinks, exactly as
a row it declines to state a **rate** for already did. Nothing is filtered — a
100% rung keeps its row and its number, below the rows carrying a real one, and
a 90% rung still leads because 90% is a price.

Two limits on it: only while alt lines are on, and never when the reader has
asked for the *worst* hit rates, where the 0% rows are the answer rather than
noise in front of it.

Verified: 32 rows become 12,918 props; the visible list descends 90% → 40% with
**zero rows at 100%** in the sort window; two alt rows add to the slip as
separate legs reading `Over 247.5 Pass Yds · 9 of 10`.

**Still open, and the only thing left on alt lines:** the price column is this
app's own hit rate through `probToAmericanOdds`, not a book's number. The feed
says so under the table and the slip says so under the legs. The Odds API's
$30/mo tier would make it real; the free 500/mo will not.

---

## H. Section B, the never-built four — 2026-09-09

Alex: *"yes do the four open ones."* Three shipped; the fourth is a conflict
with the design rather than a gap in it.

### H1. B10 / B11 — rail names now fit ✅

The name, the status word and the meta (`QB · 268.5 PASS YDS`) shared one
268px row, and only the name could shrink — so it lost every pixel the other
two wanted. `Amon-Ra St. Brown` rendered as `Amon-R…` beside an immense empty
gap, and Sam LaPorta's name vanished behind his QUEST badge entirely.

The meta drops to its own line under the name; the name shares the top line
with the status pill alone. Alex sanctioned the height: *"taller rows are
acceptable."* The ellipsis is now a last resort for a genuinely long name
rather than the normal case.

### H2. B8 — bench break ✅

`BENCH · 15 ▾` after the last core player, collapsed, expanding in place.

**The split is measured, not typed.** `railMeta` gives a player a stat line
only where there is a market and a number behind him; everyone else carries a
bare position. On Detroit that boundary lands exactly where Alex said it
should — *"create a break after Bates"* — because Jake Bates is the last man
with a stat and Tyler Conklin begins the rest. No hand-written roster list to
rot, and it works on any sport whose rail passes a meta.

Two guards: with everyone on one side of the line the list renders flat rather
than growing a control that separates nothing, and a subject who is himself on
the bench forces it open — a rail that hides the player whose page you are
reading is worse than an unsplit one.

### H3. B12 — the market strip says it scrolls ✅

Frame 1c has nine baseball markets and they fit 1440px with room over. Football
has seventeen and they do not: **668px sat past the right edge** with nothing
on screen suggesting more existed.

`‹` and `›` at either end, always rendered so the strip does not reflow, dimmed
and inert at their edge. Selecting a market from the filters rail scrolls it
back into view.

**Not a deviation** — the frame simply never had a sport with enough markets to
overflow, so the tabs keep its underline styling. Alex's *"box the markets on
prop feed page like they are on player detail page"* was pinned to the
player-detail top strip, which has since gone back into the rail (B1), so the
comparison no longer holds. Offered back to Alex rather than taken silently.

*One bug this introduced and driving it caught:* the scroll-into-view effect
first depended on `marketTabs`, which is rebuilt every render — so it re-ran
continuously and snapped the strip back the instant anyone scrolled, and the
arrows appeared to do nothing. Keyed on the active market's **id** instead.

### H4. B9 — teammate filter to the left rail — **conflicts with the design**

Not done, and not silently either way. Alex asked for this on 2026-09-09, when
the layout was the pre-v3 one.

`desktop-handoff.md` §2 states the rule the whole desktop layout is built on:

> **Left rail — what filters the page.** Market, season, window, splits,
> workload, minimum sample, league, status, sort.
> **Right rail — what contextualises it.** Roster, **teammates**, opposing
> lineup, conditions, injuries, the read.

So the design puts teammates on the right *by name*, and frame 1a draws it
there. It is already where v3 wants it.

There is a real argument for Alex's side — the teammate chips genuinely filter
the sample, which is the left rail's stated job, so the handoff's own
categories are arguably inconsistent here. That makes this a design decision
rather than a bug, and it is Alex's to take. **Ask before moving it.**

---

## I. The value plot was hidden on the market most people open first

Alex, 2026-09-10, on seeing the sorted-distribution chart on a receiver's
Receptions page: *"how come this type of thing is missing from QB's?"*

**It was not missing from QBs.** On Jared Goff, Pass TD, Pass Attempts,
Completions and INT all drew it. Only **yardage** markets did not — on every
position, so a receiver lost it on Rec Yds too. Pass Yds is simply the market a
quarterback's page opens on, which is what made it look positional.

Three per-sport whitelists gated it (`NFL_COUNTABLE_MARKETS`,
`NBA_COUNTABLE_MARKETS`, `WNBA_COUNTABLE_MARKETS`), on this reasoning:

> a yardage market's values are near-continuous, so a bar per distinct yardage
> total would be one bar per game, not a real distribution

**That describes what `ValuePlot` does for every market.** It expands bins back
out to one bar per game (`ValuePlot.jsx:104`) and always has — the chart's own
caption says "One bar per game, sorted low to high". A yardage market draws
seventeen bars each occurring once instead of blocks of repeats: still the
spread, still the line rule, still *"6 of 17 games clear 293.5"*.

Nor do the labels crowd. `ValuePlot` drops any label that would collide with
the one before it, falls back to the bare value where `value ×count` will not
fit, and gives up past `LABEL_LIMIT` runs — whose own comment is written about
passing yards specifically. The component was hardened for this case; the gate
in front of it was never updated.

**And the whitelists had rotted, which is the real argument against them.**
Football's omitted `fga` and `kickPts` — small integers, exactly what it
claimed to be for. The WNBA's omitted all four combo markets (`pra`, `ra`,
`pr`, `pa`). **MLB never had one at all**, and has shown the plot on every
market the whole time, which is the proof the ungated path is fine.

All three are gone. A gate that must be updated by hand whenever a market is
added is a gate that will be forgotten, and it was, twice.

Two fixes went with it:

- **A non-finite value now produces no bar** rather than a `NaN`-keyed bin that
  reaches the plot as a bar with no height. The whitelist hid that case by
  accident; nothing hides it now.
- **The "blocks" sentence only appears when there are blocks.** It keyed on how
  many axis labels rendered, which says nothing about whether any value
  repeats, so a yardage log explained a feature that was not on its chart. It
  now keys on `mode.count > 1`, the exact test.

Verified on Goff: Pass Yds, Pass TD, Rush Yds and Pass + Rush Yds all draw it;
Anytime TD correctly does not, because his rushing and receiving touchdowns are
zero in all seventeen games and the call site's `bins.length > 1` guard
withholds a chart from a log with one distinct value.

---

## J. The alt-lines switch, and centred rail pills — 2026-09-10

### J1. One switch, in the header

Alex: *"i would like for my alt line button to work like outlier's and also be
in a similar position rather than bottom left rail … I would rather main lines
show unless alt lines is clicked, which then alt lines including the main lines
will show, but i would rather it be a one click button."*

**The behaviour was already right.** `feedRowsWithAlts` returns the posted line
first and its rungs after it, so "alt lines including the main lines" is what
the toggle has always produced. What was wrong was the control: a two-pill
radio (`Main only` / `Show alt lines`) at the **bottom of the filters rail** —
the least visible corner of the page, and two decisions for what is one
boolean.

Now a single `ALT LINES` switch in the feed header, beside the OVER / UNDER
pills, `role="switch"` with `aria-checked`. Off shows posted lines; on adds
the rungs.

**The duplicate went too.** MORE FILTERS carried its own copy of the same
control. One switch, always on screen, is better than two that can disagree.

Verified: `30 of 2639 props` → `185 of 12115 props` on one click.

*Position note:* Outlier puts theirs at the extreme right of its filter bar;
this sits just inside the side pills, which keeps OVER / UNDER where it has
always been. Say if it should go further right.

### J2. Rail pills centre their labels

Alex: *"i would rather the market names be centered in the pill rather than
stuck left axis like that."*

**A deviation from the mock, taken deliberately.** The mock's `railPill` is
left-aligned (`PropPalace Desktop v3.dc.html:2450`, no `justifyContent`), and
the app followed it — so MARKET and WINDOW read hard against the left edge of
pills far wider than their text, while SEASON and MINIMUM SAMPLE used a centred
variant and did not. One rail, two alignments, for no reason visible to a
reader.

Centring all of them makes it one rule instead of two, and retires the variant
that existed only to opt back out of the default.

### J3. Noted in passing

`v2ControlBar` (`PropLedger.jsx:21220`) is dead — assembled in full and never
rendered. Left alone rather than cut alongside a behaviour change; it is worth
its own pass.

---

## K. The form chart's axis starts at zero — 2026-09-10

Alex, on Matthew Stafford's Pass Yds page: *"the player detail chart should be
scaled better, 259 and 258 are high passing yards but the way its set up it
looks miniscule, please fix."*

**A flaw in the mock, faithfully transcribed.** `PropPalace Desktop
v3.dc.html:3023` computes

```js
const lo0 = Math.min(line, ...vals);
const pad  = Math.max((hi0 - lo0) * 0.18, 0.6);
const axisMin = lo0 - pad;
```

and `feedFormScale` matched it line for line. On a market with a high floor
that truncates the axis badly. Stafford's last ten passing games run 243–457
against a 253.5 line, so the axis began at **204** — and a 258-yard game
rendered at **18%** of the box while 457 rendered at 87%.

A bar's length is how a bar chart says how big a number is. An axis starting
just under the smallest value makes every ordinary game look like a failure
beside one outlier.

**Now `axisMin = 0`**, with headroom measured off the top (`hi0 * 0.08`) so the
tallest bar is never flush against the ceiling and the drag handle has
somewhere to go. Measured after: 243 → 44%, 269 → 49%, 281 → 51%, 368 → 66%,
457 → 80%. Proportional, and the variation is still plainly readable.

**What this does not cost.** The over/under read comes from the bar's colour
and from where it sits against the dashed rule, both of which move with the
same scale — a game that barely cleared still barely clears. And the feed's
mini-strip shares `feedFormScale`, so it changed too: checked, and its shape,
its red/green split and its rule all still read at 74px. One scale, both
surfaces, which is the point.

### J1b. The switch became a pill, and moved down a row — 2026-09-10

Alex: *"can you change the style of the alt line switch? just to be different
from outlier? i also feel like it's kind of in a spot that makes it hard to
detect with the naked eye."*

Both fair. J1 put a track-and-knob switch in the header between the market
strip and the side pills — which is Outlier's own control, borrowed, and
sandwiched there in dim grey it was easy to miss.

**Style: the app's own vocabulary instead of a borrowed one.** `+` and `✓` are
already what this product says for "add this" and "added" — the slip's button
reads `+ MY PICKS`, then `✓ ON THE SLIP`. Adding alt lines to the list is the
same kind of act, so the control reads `+ ALT LINES` and becomes `✓ ALT LINES`,
picking up the accent border and tint when on.

**Position: the right of the SORT row.** That row holds the controls that
change *what is in the list*, which is exactly what this does, and it sits one
line under the count it moves — `29 of 1589 props` becomes `178 of 8607` as it
is pressed.

**Legible off as well as on**, which the switch was not: a real
`--line-strong` border and a `--surface-2` ground rather than dim text on the
page background.

---

## L. The formatting sweep — every screen, phone and desktop — 2026-09-10

Alex, 2026-09-10: *"make sure all of this stuff formats and fits on mobile, no
overlapping stuff or things running off the rails, make sure it is perfectly
formatted for mobile"*, and *"is everything from the v3 folder i sent before
completed? across the whole site and not just player detail?"*

Twelve screens, four widths — 375, 430, 1024, 1280, 1440. Driven mechanically
rather than by eye: an injected scanner reports `pageOverflowPx`, text needing
more width than it has with no ellipsis and no scroller, anything painted past
the viewport, and any two leaf texts sharing more than 40% of the smaller one's
area.

**The scanner needed three exclusions before it stopped crying wolf**, and each
is worth keeping if this is ever run again:

1. An element covered by an overlay is not on screen. Without this, opening
   Settings over the Board reported every text pair on both layers.
2. An element scrolled out of its own scroller is not on screen either — and
   `elementFromPoint` alone will not tell you, because the point lands on an
   ancestor and an ancestor *contains* the element, so a naive hit test calls
   it visible. This one produced a phantom collision between the feed's market
   strip and its OVER pill at 1280 that does not exist.
3. Fixed, sticky, or absolutely-placed-with-a-z-index elements are overlays by
   construction. Content passing behind an opaque floating button while you
   scroll is the design, not a collision.

Exclusion 3 hides a real question it cannot answer — *is content hidden
permanently?* — so that is checked separately, by scrolling each container to
its end and re-measuring. That check is what found L6 below.

### What it found

| # | Screen | Defect |
|---|---|---|
| L1 | Injuries, phone | Status row scrolled; its 4th chip sat off-screen with nothing to say it was there — a filter the page offers that nobody could find. Both chip rows now wrap. |
| L2 | Injuries, phone | `All 91` on two stacked rows, and five control rows above the first player. Reset renamed `Any`; count and sort share a line; the scope caption went. |
| L3 | News wire | A hardcoded `>= 10` disagreed with the feed's own floor, so an 8-game player got a percentage in one place and "too few" in the other, same prop, same afternoon. |
| L4 | Player hero, phone | `Detroit Lions · quarterback · 2026` truncated away the season. Wraps. |
| L5 | My Picks, phone | The slip grid is the mock's exactly — and the mock is drawn at **430px**. At 375 the five columns leave the leg 103px: "Trevor La…" over "Over 228.5 Pas…". The numbers have no slack ("17 of 17" is 49px in a 62px column), so name and prop wrap instead. Above 430 nothing wraps and the frame is the mock again. |
| L6 | Player page, 1280 | The right rail ended 30px above its floor with two buttons floating in that corner, which between them own the lowest 115px. Scrolled fully down, Brock Rechsteiner's injury row was still 77% covered, Audric Estime's 64% — named players, carrying a status, unreachable. Rail floor is now 124px. |
| L7 | Gamecast, phone | The leaders' stat line was `flex: "0 0 auto"`, so a pitching line took the whole row and left the name block at **literally zero width**. Nick Martinez and Martín Pérez were in the DOM, measured 0px, unreadable. |
| L8 | Gamecast | Every leaders row was keyed to the literal string `"-"`. React was warning it might duplicate or omit them. |
| L9 | Gamecast + Matchup | The header said LIVE twice — once in the pill, once at the head of the clock line — and the ballpark fell off the end paying for it. `statusLine` now returns `head` and `detail` separately. |
| L10 | MLB leaders | MLB's own `summary` string drops any count of one: Cristian Javier's 5.0 IP, 2 H, 1 ER, 1 BB, 2 K arrived as `"5.0 IP, ER, 2 K, BB"`. Built from the counting stats in the same object instead. |
| L11 | NBA + WNBA player page | The unresolvable-player guard returns a bare panel — no header, no nav, no back link. One card, one button offering somebody else's page. |
| L12 | Empty feed, all sports | Announced its "next **kickoff**" — football's word, on basketball, in the one sentence a reader sees when the screen is otherwise empty. |

### Two findings that are not layout, and are not closed

**The WNBA player page is unreachable from the feed.** There are no WNBA games
on 2026-09-10 — the next five are the 17th and 18th — and four of four players
opened from the feed landed on L11's card. The message is accurate and the
back button (L11) means the reader is no longer stranded, but until the 17th
that card *is* the WNBA player page. Whether a player with no game today should
get a season-log view instead is a product decision, not a formatting one.

**A duplicate-key warning seen twice, never reproduced.** It appeared mid-session
on two occasions, both after a run of hot reloads, and never once on a clean
load across a full crawl — six pages, four sports, Settings, My Picks. L8 was a
real instance of the same warning and is fixed; whether these two were a second
site or stale HMR renders is unresolved. Recorded rather than claimed either
way.

### Still open

- **The feed's form strip: L5 or L10.** Alex asked for an opinion and said
  *"dont change it yet."* Recommendation: keep 10. The duplicated caption is
  already cut; making the strip follow the chosen window is the remaining half
  and needs verifying before it ships.
- **The alt-line price column**, which needs the Odds API $30/mo decision.
- **Nav order** — deferred by Alex until the sweep finished. It has.
