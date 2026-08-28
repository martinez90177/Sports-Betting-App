# How to implement these designs

Read this before touching any file in the project.

---

## The one rule

**Copy the design exactly. Do not imitate it, do not reinterpret it, do not
"improve" it while transcribing.**

Every number in these mocks is deliberate — the 10px type floor, the 104px book
column, the 62px hero strip, the 20px axis floor, the 44px hit targets, the
grid templates, the exact hex values. Each one was arrived at by fixing a
specific defect. If you round 10.5px to 10px, widen a column "for balance", or
substitute your own spacing scale, you will reintroduce a bug that was already
found and fixed.

When something in the mock looks wrong to you, **do not silently correct it.**
Implement it as drawn and raise it. Several things that look like mistakes are
deliberate: innings 8 and 9 are blank rather than zero, a zero draws no bar, an
unpriced leg shows an em dash, a thin calibration band gets no verdict.

---

## The failure this document exists to prevent

The common way this goes wrong is not laziness. It is an implementer reading
the mocks, understanding the *ideas* in them, and then rebuilding those ideas
on top of the layout that already exists. The result looks like the old app
with some new features bolted on, and every specific decision in the redesign
— the spacing, the type scale, the column widths, the order of things on a
row, the words — quietly disappears.

**That is not an acceptable outcome.** The redesign is not a set of suggestions
about what the pages could contain. It is the design of those pages.

Concretely, this means:

- **Do not start from the current components and adjust them toward the mock.**
  Start from the mock's markup and wire the app's data into it. A screen that
  was rebuilt from the old layout will not match, no matter how carefully it
  was adjusted.
- **Do not keep an old screen because it "already does that".** If the mock
  redesigns Player Detail, the old Player Detail is replaced, not amended.
- **Do not carry over the old page's spacing, type sizes, borders, radii or
  copy** on the grounds that they are close enough. Take them from the mock.
- **Do not drop a screen, section or control** because it seemed minor or
  because its purpose was not obvious. If it is in a frame, it ships.
- **Do not add anything that is not in the mocks.** No extra sections, no
  helpful summaries, no filler.

If a screen cannot be built exactly as drawn — because of a real technical
constraint or missing data — **stop and say so.** Do not approximate it and
move on. An honest gap is fixable; a silent substitution is not, because
nobody knows it happened.

### How to check you actually copied it

Put the mock and your build side by side at the same width and compare, screen
by screen:

- Same elements, in the same order, on every row.
- Same type sizes, weights and colours.
- Same spacing between things, and same padding inside them.
- Same words. The copy in the mocks is written, not placeholder — including
  the explanatory sentences under controls and the empty-state text.
- Same behaviour for the states that are drawn.

If a reasonable person could look at the two and tell which is which by
anything other than the data in them, it is not done.

---

## What to keep from the live app

The mocks are a skin and a structure. **The app's real data stays exactly as
it is.** Specifically, do not replace, regenerate, or stub any of:

- **Game logs.** Every rate, sample and bar comes from the real logs the app
  already fetches. The arrays in the mock are placeholders for those.
- **Player profile pictures.** The mocks show initials in circles because the
  designer had no headshot URLs. The app has them — use the existing headshot
  helper (`mlbHeadshot`, `wnbaHeadshot`, `espnHeadshot`) in every avatar slot.
- **Team crests.** Keep the existing `teamLogo(sport, abbr)` lookup. The mock
  hardcodes ESPN CDN paths; point them at the real helper.
- **Availability and injury feeds**, and the coverage rules around them.
- **Odds conversion** (`odds.js`), **alt-line building** (`lib/altLines.js`),
  **findings** (`lib/findings.js`), **calibration** (`lib/calibration.js`).
  The mock transcribes their behaviour; the real modules are the source.
- **Settings**, its storage, and every control in `SettingsSections.jsx`. The
  redesign is layout only — no setting was added, removed or renamed.
- **The slate, schedule and live-state fetching.** Live state comes from the
  provider, never from the clock.

If the mock and the app disagree about *data*, the app wins.
If they disagree about *layout, type, colour, spacing or copy*, the mock wins.

---

## Commit as you go — every three screens

Do not build the whole thing and commit once. **Commit and push after every
three screens you finish.** A screen counts as finished when it matches its
mock, not when it renders.

Suggested order, three at a time:

1. Player Detail · Prop Feed · The Board
2. Games · Findings · News
3. Injuries · My Picks · Gamecast
4. Matchup · Settings · Landing

Then the desktop set in the same rhythm.

Each commit message should name the screens and the platform, so the history
reads as progress rather than as a wall:

    redesign: mobile Player Detail, Prop Feed, Board
    redesign: mobile Games, Findings, News

Why it matters here: if a screen drifts from its mock, a three-screen commit is
a small, readable diff to correct. One large commit at the end hides which
decision went wrong and makes it expensive to fix. It also means the work is
never at risk of being lost, and progress is visible without asking.

---

## Files

| Mock | Covers |
| --- | --- |
| `PropPalace Mobile v3.dc.html` | All twelve mobile screens |
| `PropPalace Desktop v3.dc.html` | All desktop screens |
| `PropPalace Board v4 part 2.dc.html` | The Board — the only Board in this folder |
| `player-detail-handoff.md` | The rules behind Player Detail: geometry, axis, controls |
| `desktop-handoff.md` | The rules behind the desktop screens: grids, the intent read, the full view |
| `participation-data-check.md` | The data prerequisite for the with/without filters |

### The Board — read this carefully

The Board lives in its own file. Nothing else in this folder contains one.

- **`PropPalace Board v4 part 2.dc.html` is THE BOARD.** Build both the mobile
  and desktop Board from this file, and only this file. It holds the tier bands
  (Worth ten minutes / One thing each / Quiet), the hero card, the reason bar,
  the form strips with values inside the bars, and the identity block that
  routes to Player Detail.
- **The v3 files no longer contain a Board.** The superseded versions were
  deleted so there is nothing to confuse it with. If you find a Board anywhere
  other than part 2, it is not the design.

Everything else in the two v3 files IS the design. The Board is the one screen
that lives in its own file, and part 2 is that file.

---

## Reading a mock

Each file is a canvas of framed screens. A frame is one screen at one size —
430 × 932 for mobile, 1440 × 900 for desktop. Everything inside a frame is the
design. Things outside frames are notes for you and are not part of the app:

- The turn headings and option captions ("1a Player Detail", "2c Findings").
- The diagnosis and rationale panels.
- Any card explaining what changed and why.

The mocks are **static** — separate frames on one canvas, not a linked
prototype. A control that appears interactive in the mock is showing you its
states, not its routing. Wire the routing per the app's existing navigation.

---

## Rules that are easy to lose in translation

These caused real defects during design. Each is load-bearing.

1. **A logo is never identified by a slug alone.** `cle`, `bos` and `min` exist
   in several leagues. The sport travels with every crest reference, and a
   missing sport draws nothing rather than defaulting.
2. **Nothing renders below 10px.** Where a glyph could not fit at 10px, the
   glyph was removed rather than shrunk — see the sportsbook marks under 22px.
3. **A bar is margin from the line, not a zero-based value.** Use
   `FormGraph.jsx`'s own geometry; do not re-derive it.
4. **A zero draws no bar** — a red `0` in its place. A miss is a closed red
   outline. A cleared game is a solid green bar with its value inside it.
5. **Every rate is stated with its sample**, and the two are computed from the
   same array. Never author a rate and a sample separately.
6. **A thin sample says so and gets no verdict.** Below the floor there is a
   number but no finding.
7. **No book prices anything.** There is no odds feed. Where a price would go,
   show the app's own rate converted, and say no book priced it. The sportsbook
   is a destination, not a source.
8. **No objection without a counted fact.** The intent read may only raise a
   concern it can cite — a sample, a split, a logged role change, a defence
   rank, an availability row. It must never assert a direction nothing counted.
9. **One source per fact.** The slip's leg count, the docks, the Gamecast
   panel, the Matchup reads and the Player Detail chip all read one array. Do
   not re-author any of them as a literal.
10. **Live state comes from the provider.** An unfinished prop under its line is
    in play, never a miss.

---

## What to do when the mock is silent

The mocks cover the screens and their states. They do not cover:

- Error, offline and loading states beyond the ones drawn.
- Routing and history.
- Anything behind a control that opens something not in the mock.

For these, follow the app's existing patterns rather than inventing new ones,
and match the mock's voice: plain, specific, and never claiming more than the
data supports.

---

## Before you call it done

1. Every "N of M" caption matches its own percentage, on every row.
2. The plotted bar count equals the number the window names.
3. No two elements state the same sample differently.
4. Nothing renders under 10px.
5. No crest is requested without a sport.
6. Console is clean — no failed asset requests.
7. Every screen in the mocks exists, at both sizes, with nothing dropped.
