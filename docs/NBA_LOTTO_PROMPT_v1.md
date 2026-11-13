# NBA lotto prompt for a new session (v1, written Oct 28 2026)

Paste everything below the line into a new session.

---

You are building tonight's NBA LOTTO parlay for Alex. Read the memory folder first
(C:\Users\GamerX\.claude\projects\D--Apps-Sports-Betting-App\memory\MEMORY.md),
and especially these files: nba-slate-playbook-no-reminders.md, nba-pre-check-checklist.md,
same-filters-on-every-rung-and-leg.md, filter-in-key-teammates-on-propsmadness.md, nba-venue-split-every-leg.md,
nba-ladder-records-at-25-plus-minutes.md, propsmadness-chip-range-near-tonights-rank.md,
always-move-propsmadness-yellow-line.md, times-in-eastern-not-utc.md, nba-luka-without-lebron-with-reaves.md.
Check today's date and the ESPN scoreboard
(https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard). Exclude games already started. If there
are no NBA games tonight, say so and stop. Never place a bet, log in, or enter credentials.
Give every time in EASTERN (e.g. 7:00 PM ET), never UTC/Z.

## THE GOAL
A lotto is NOT a +100 parlay. Target about +500 total on DRAFTKINGS (show FanDuel as a secondary price).
- One to two legs per game, each leg priced between -500 and -100 on DK. A game can be skipped if the data isn't there.
- Overs only, one leg per player, no double-double/triple-double/TD or "longest" props.
- Lotto legs do NOT have to be as clean as ladder legs. Lower the bar enough to reach the price (roughly 75-85%+ in the
  full filter stack is acceptable), but never pick a leg with a known problem (already missed this season, role unclear,
  injured, minutes limit). Name the weakest legs and the honest miss rate.
- Lotto rungs must sit ABOVE the ladder rungs, never the same rung as a ladder leg for the same player.
- Compute every price with helper code, never hand-type odds
  (dec = a<0 ? 1+100/-a : 1+a/100; back: d>=2 ? round((d-1)*100) : -round(100/(d-1)); a decimal under 2.0 is NEGATIVE).
- ALEX'S OWN LEGS COME FIRST. If he lists legs, every one gets the full stack and a written verdict. Never silently
  drop one for missing a ladder-grade bar; lower bars apply to the lotto. If one is truly bad, keep it in the report
  with the numbers and let him decide.

## MANDATORY CHECKLIST BEFORE ANY READING (per player)
1. Team tonight and any change since last season (trades/signings). New-team games are the sample; old-team games were a
   different role. State the sample size when it is thin (e.g. 3 games).
2. His own injury/availability status and any minutes restriction.
3. This season's role: minutes, FGA, usage (not last season's role).
4. Teammates: who is IN (With), who is OUT (W/O) tonight, and who left the team (filter without them).
   PropsMadness defaults an OUT teammate's card to W/O on the first click.
5. Venue tonight (Home/Away), spread and blowout risk, opponent rank band per chip.
6. His 2026 game log: has he already missed this rung this season?
7. Write the filled checklist line per player before running anything.

## EVERY READING (identical stack on every rung and every leg)
- PropsMadness (propsmadness.com/nba): drag the yellow line to the exact rung and confirm the label; Season All +
  Games Max (denominator 100+); Minutes 25+; key teammates With/W-O; Home/Away for tonight; every Opp Rankings and
  Suggested chip, using ONLY the band that contains tonight's rank (1-10, 11-20 or 21-30). Read the pill list back and
  print it next to each number. Never apply a filter to one rung and not another.
- Outlier (app.outlier.bet/NBA/props, Saved card "NBA", Players filter): read L5/L10/L20/H2H/2026/2025 for each leg and
  both book prices. Never click price buttons.
- Prices: PM alt endpoint /api/players/<pid>/match/<mid>/bet-offers/alt/<market slug> (first price = FanDuel, later =
  DraftKings); re-pull right before sending and state the time in ET.
- Use the full sample since 2024-10-01 plus this season's games with the current team.

## TOOLS / MECHANICS
- Claude in Chrome: load tools with ToolSearch first. Open NEW tabs for propsmadness.com and Outlier; NEVER touch,
  close or navigate Alex's own tabs. JS calls time out at 45s, so run long jobs with a setTimeout and poll window vars.
  Real mouse drags can fail in a second tab; JS pointer events on the 60x44 handle rect work, and the handle label lags
  about a second, so re-read before trusting it. Tool output with cookie/query-string data is blocked.
- Take a full-size screenshot (scale 1) before any real-mouse drag.
- ESPN APIs for injuries, box scores and spreads/totals.

## DELIVERABLE (short chat message, no menus)
The one definitive lotto: each leg with DK price (FD in parentheses), the total DK and FD price computed with code,
and per leg a one-line audit showing the filter pills used, the record, venue, teammates and role note. Then the weakest
legs, anything unverified, a REJECTED list with reasons (never silent drops), a SKIPPED list, and which games tip first.
Do the whole job without stopping early; if time is short, say exactly what was not covered. Don't lecture on stakes.
