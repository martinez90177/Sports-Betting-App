repo: martinez90177/Sports-Betting-App
branch: master

## Last sync

date: 2026-08-27T04:12:00Z

### Updated in this project
- Mobile redesign complete: The Board, Prop Feed, Player Detail, Games, Findings, News, Injuries, My Picks, Gamecast, Matchup, Settings, Landing.
- My Picks is the single source for the slip — all seven docks and the Player Detail chip read one count, and Gamecast / Matchup derive their panels from the same legs.
- Desktop reskin: Player Detail (MLB / NBA / WNBA subjects, bar zoom, teammate + opposing-lineup filters, workload slider), Prop Feed, The Board.
- `player-detail-handoff.md` and `participation-data-check.md` document the graph geometry, control rules and the per-game participation record the with/without filters need.

## Sync history

- 2026-08-25T04:35:45Z — desktop pass and the mobile Player Detail filters.
- 2026-08-25T01:46:02Z — first read of the repo; three mobile mocks built.

## Screen map

| Screen | Built from |
| --- | --- |
| Mobile Board | src/BoardPage.jsx, src/GameCard.jsx, src/NavBar.jsx, src/index.css |
| Mobile Prop Feed | src/PropLedger.jsx (.feed-grid), src/FormGraph.jsx, src/FeedPresets.jsx |
| Mobile Player Detail | src/PlayerDetailV2.jsx, src/PlayerGameLog.jsx, src/FormGraph.jsx |
| Mobile Games | src/GamesPage.jsx, src/lib/gamesData.js |
| Mobile Findings | src/FindingsPage.jsx, src/lib/findings.js |
| Mobile News | src/NewsPageRedesign.jsx |
| Mobile Injuries | src/InjuriesPage.jsx, src/lib/mlbStatus.js |
| Mobile My Picks | src/PropLedger.jsx, src/lib/calibration.js, src/odds.js, src/WatchList.jsx |
| Mobile Gamecast | src/GamecastPage.jsx (LIVE_STAT_KEY, buildPropsInPlay) |
| Mobile Matchup | src/MatchupPage.jsx |
| Mobile Settings | src/SettingsPage.jsx, src/SettingsSections.jsx |
| Mobile Landing | src/index.css, src/PalaceMark.jsx |
| Desktop Player Detail | src/PlayerDetailV2.jsx, src/AltLineLadder.jsx, src/PalaceMark.jsx |
| Desktop Prop Feed | src/PropLedger.jsx, src/lib/altLines.js, src/odds.js |
| Desktop Board | src/BoardPage.jsx, src/GameCard.jsx, src/lib/gamesData.js |

## Notes

- Crests come from ESPN's CDN through the same `teamLogo(sport, abbr)` pairing as `src/lib/gamesData.js`. Slugs collide across leagues, so `crest()` refuses to build a URL without both a slug and a sport.
- Graph geometry is transcribed from `FormGraph.jsx` (`FORM_SIZES`, `MIN_SLOTS`, the margin-from-line axis) rather than re-derived.
- Synthetic fixture data must use periods coprime with its array lengths; an aliasing period makes a split sample the same few values and reads as fabrication.
