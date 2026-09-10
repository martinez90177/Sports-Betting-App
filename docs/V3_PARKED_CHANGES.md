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

**Regions the design draws that the app never renders:**

| Frame | Component | Prop | What is lost |
|---|---|---|---|
| 1a Player Detail | `PlayerDetailDesktop` | `samples` | The entire **MINIMUM SAMPLE** rail group. Frame 1a's own values are `10+ · 15+ · 30+ · All`. |
| 2f Matchup | `MatchupDesktop` | `probables`, `probableNote`, `readScope` | The **probables** region — the starting pitcher / quarterback block the frame puts under the crumb bar. |
| 2e Injuries | `InjuriesDesktop` | `sampleQuery` | The search box's worked example; it falls back to a generic placeholder. |
| 2b Games | `GamesDesktop` | `emptyCopy` | The empty state. A day with no games renders **nothing**. |
| 2c Findings | `FindingsDesktop` | `emptyCopy` | Same. |
| 2d News | `NewsDesktop` | `error` | A failed news fetch renders **nothing at all**. |

The last three are not only fidelity gaps, they break CLAUDE.md's fourth avatar
rule directly — *"Nothing is ever silently dropped. A game, player or row that
can't render surfaces as a visible state, never as an absent row."* The visible
state was built. Nobody wired it.

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
