repo: martinez90177/Sports-Betting-App
branch: master

## Last sync

date: 2026-08-15T03:45:07Z
commit: 00e717b9af4b

### Updated in this project

- Turn 4 adds 4a (News page) and 4b (alt lines / alt legs), both in 2a's language.
- Bars logo mark locked; applied to 2a nav and the 3a mobile header. Lapis kept as accent.
- Player avatar slots (striped placeholder + team ring + status dot) added anywhere a player is named: news items, injury wire, watchlist, prop feed rows, slip legs, 2a prop detail header, 2a "Props with a read".
- Avatars now load real headshots from the same ESPN CDN pattern the repo uses (`a.espncdn.com/i/headshots/nfl/players/full/{id}.png`), layered over the striped circle so a missing id degrades to the placeholder.
- Wordmark is now "PROP PALACE" / "Prop Palace"; avatar backgrounds are a muted blend of each team's two primary colours (the repo's teamAvatarBackground idea) instead of the striped placeholder.
- Player profile gained an "Injury and news" timeline (designations, past scares, hit rate excluding games he left early) and a "Missing around him" block that ties absent teammates to his target share.
- Alt lines are a per-prop ladder (line / hit rate / games over / price) with a main-line marker; slip legs carry a line stepper and an ALT badge, plus a combined "all three landed together" count instead of multiplied rates.

## Sync history

- 2026-08-14T20:04:57Z — 2a restyle of the app's own screens; neutrals derived from index.css; noted GamesPage/MatchupPage are self-described Outlier recreations.
- 2026-08-14T19:50:32Z — first read: repo structure, `main.jsx` boots straight into `PropLedger` with no landing page; three original directions (Palace / Terminal / Broadsheet) built.

## Screen map

| Project screen | Repo files |
| --- | --- |
| PropPalace Concepts.dc.html — 1a/1b/1c in-app board | src/GamesPage.jsx, src/PropLedger.jsx, src/index.css |
| PropPalace Concepts.dc.html — landing pages | index.html (meta, fonts), src/index.css |
| PropPalace Concepts.dc.html — 4a News | new screen (no repo equivalent yet), src/index.css |
| PropPalace Concepts.dc.html — 4b Alt lines / slip | src/PropLedger.jsx (not readable, 824KB), src/index.css |
| PropPalace Concepts.dc.html — 2a Games slate | src/GamesPage.jsx, src/lib/gamesData.js, src/index.css |
| PropPalace Concepts.dc.html — 2a Matchup Overview | src/MatchupPage.jsx, src/index.css |
| Palette / theme constraints | src/index.css, src/settings.jsx, src/ColorWheel.jsx, src/SettingsModal.jsx |

Note: `src/PropLedger.jsx` (824KB) exceeds the readable size cap — not read or searched.
