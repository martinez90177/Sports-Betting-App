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

**One exception, applied during transcription:** the `Last 3 games` split stays
removed. Alex: *"make sure 'last 3' split is removed."* The v3 mock draws it, so
this is a standing deviation — see A3.

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
15. **Alt lines as rows, Outlier-style** — ~~parked~~ **build this during the 1c
    transcription; it is not a deviation.** Frame 1c's rows already read
    `Over 1.5 Total Bases` / `Over 0.5 Hits`, with the side and the line inside
    the proposition, so an alt line is simply another row. Its slip confirms it:
    legs carry `MAIN` and `ALT` badges and read `74% · 8 of 10 · one rung up`.
    Outlier's own toggle takes their row set from 4,233 to 13,652 and lists
    Over and Under separately, which is the same model. Alex, 2026-09-09:
    *"remember how we switched it from the ladder to actual alt lines on the
    prop feed? thats what i want still."*
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

## D. The audit that prompted this

Player detail, live app against the v3 mock, left rail:

| v3 rail | Live |
|---|---|
| MARKET | moved to a top strip on 2026-09-09 |
| SEASON + "2026 to date…" | gone — removed by the two-season cap |
| WINDOW + custom builder | present |
| WORKLOAD slider (PA / MINUTES / SNAP SHARE) | missing |
| OPPOSING STARTER | missing |
| SPLITS | present |
| MINIMUM SAMPLE | missing |

Also off: weather belongs on one line beside the game menu, not in the right
rail; the right rail wants OPPOSING LINEUP, and a PARK FACTOR block that is
MLB-only.

The other 23 frames have not been audited yet. `public/__mockcheck/` is
gitignored and serves the mock files through the dev server, which is how to
put a frame and a screen side by side at the same width.
