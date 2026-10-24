# NBA ladder prompt for a new session (v3, written Oct 24 2026)

Paste everything below the line into a new session.

---

You are building tonight's NBA ladder for Alex. Read the memory folder first
(C:\Users\GamerX\.claude\projects\C--Users-GamerX-OneDrive-Desktop-Sports-Betting-App\memory\MEMORY.md,
and these files: nba-luka-without-lebron-with-reaves.md, nba-use-full-two-season-sample.md,
no-knicks-on-ladders.md). Check today's date and the ESPN scoreboard
(https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard) first. Exclude games already started.
If there are no NBA games tonight, say so and stop. Never place a bet, log in, or enter credentials.

## THE GOAL
A 5-6 leg ladder of OVER props, priced on DRAFTKINGS (Alex bets on DK; show FanDuel as a secondary price
and flag anything past -1000 there). Target about +100 total (anywhere from -125 to +130 is fine).
"Sweat-free" means a real cushion over the rung, not just a good hit rate. One leg per player. Overs only.
No double-double/triple-double/TD or "longest" props. No Knicks players on a ladder (his favorite team).
Each DK leg must be inside -1000. Never hand-type American odds: compute with helper code
(dec = a<0 ? 1+100/-a : 1+a/100; convert back; a decimal under 2.0 is a NEGATIVE price).

## HOW ALEX WANTS LEGS CHOSEN (he has corrected me on every one of these)
1. Roles: top 2 on every team, top 3 where the lineup has 3 real threats (Philadelphia has 4: Embiid, Maxey,
   Brown, LeBron). No 4th/5th options. Check each player's role from SAME-TEAM games only, and from this
   season's opener and preseason box scores (ESPN summary endpoint), not just last season.
2. Audit EVERY rung of EVERY market (points, rebounds, assists, P+A, P+R, PRA, R+A) for each candidate, not just
   the one rung a price filter surfaces. Alex compares rungs and found a better one (Brunson 20+ points vs
   25+ P+A, Brunson PRA 25+) that I missed by auditing only one.
3. Use the FULL sample PropsMadness holds (all games since 2024-10-01), not L30. For each rung report:
   all games, 2025-26 only, tonight's venue (home/away), games with 25+ and 28+ minutes, head-to-head
   vs tonight's opponent, AND head-to-head AT tonight's venue (Brunson was 9/14 vs Boston overall but 2/7 at
   Boston), plus with/without the key teammates, and team win/loss and blowout splits.
4. Minutes and blowouts are the main risk. On Oct 23, LaMelo played 23 minutes, Bam 23, Banchero 26, Kawhi 28
   in lopsided games, and every close call was a minutes problem. For each leg also check: the stat in games
   his team wins or loses by 15+, and the stat at a 24-minute pace (per-minute rate x 24). Prefer tight
   spreads. Don't stack several legs that share one game script.
5. Rank by cushion: typical game clears the rung by ~20%+. Kawhi PRA 25+ cleared by 1 and Bam by 0 on Oct 23
   even though both were rated 90%+.
6. New-team players: use this-team games first (opener, preseason) and set the rung from those, about 10
   below, not from the old-team average (Kawhi averaged 38 PRA with the Clippers but had 31 in 24 min and
   26 in 28 min for Toronto). Giannis: judge him on games with 25+/28+ minutes (last year's minutes were
   depressed by injury; at 28+ he clears 20 points 97%).
7. Luka and the Lakers: ALWAYS use Lakers games with Luka in and LeBron out (LeBron is on Philadelphia) and
   confirm Reaves is playing. Apply to every Lakers player (Reaves too). Say the sample size.
8. Availability: re-check ESPN injuries (https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries)
   and projected minutes (PropsMadness match-statistics expectedMinutes) before naming legs, and again just
   before tip. Name who absorbs usage for anyone out.
9. Do NOT show picks until each leg has the full audit. Anything not done is written SKIPPED with the reason.
   No "first options" lists of unchecked picks. Report coverage (which games/players scanned).
10. Be honest about the real miss rate and name the weakest legs. Don't call 85-90% legs "safe".

## TOOLS (all verified)
- Claude in Chrome (load tools with ToolSearch first): open NEW tabs only for propsmadness.com/nba and
  app.outlier.bet (Alex is signed in; never log in). JS calls time out at 45s: run long jobs inside
  setTimeout(async()=>{...},50), store results on window, then poll in later calls. If a tab freezes or
  leaves the tab group, open a new tab and navigate to propsmadness.com/nba. Avoid returning strings that
  contain URLs or key=value patterns (the tool blocks them).
- PropsMadness same-origin API: board /api/offer/nba/bets/<player-points|player-rebounds|player-assists|
  player-points-rebounds-assists>; player logs /api/players/<pid>/match-statistics (statistics, opponentStatistics,
  playedForTeamIdMap per match for same-team checks, expectedMinutes); alt ladders with both books
  /api/players/<pid>/match/<matchId>/bet-offers/alt/<player-points|player-points-assists|player-points-rebounds|
  player-points-rebounds-assists|player-rebounds|player-assists|player-rebounds-assists>
  (sportsbook slugs draftkings / fanduel; odds.over). DK often posts fewer rungs than FD.
- Outlier: Props -> Saved -> the card named exactly "NBA" (real mouse click); it only lists lines near the book
  line, so use it as a consistency check (L5/L10/L20/H2H), not for deep rungs.
- ESPN APIs for box scores, injuries, preseason and spreads/totals.

## LESSONS FROM OCT 22-23 (so you don't repeat them)
- Oct 23 ladder legs: Kawhi PRA 25+ hit by 1, LaMelo points 10+ hit by 2, Giannis points 20+ hit (36),
  Durant P+R 20+ hit; Luka P+A 30+ was still live. Lotto misses: Cade, Banchero, Kawhi points 20+.
- Alex wants both the data and the reasoning; he is blunt and impatient. Answer his message first, don't
  narrate options you won't pursue, never skip a step to save time, don't give stake-size advice.
- Prices move: re-pull DK prices right before sending, and state the time. Tell him which games tip soonest.

## DELIVERABLE
A short chat message: the slip with DK price per leg (FD in parentheses), the total DK price computed with
the helper, my honest hit estimate, a one-line audit per leg (role rank, all-games %, 28+ min %, venue %,
H2H and venue H2H, cushion, blowout/24-minute check), the weakest legs, lineup flags to recheck, a REJECTED
list with reasons, and a SKIPPED list. Offer to build a card only if asked.
