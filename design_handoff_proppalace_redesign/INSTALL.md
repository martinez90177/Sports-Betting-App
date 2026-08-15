# Installing this in the PropPalace codebase

These are real React files written against your conventions (React 18, inline
style objects, `var(--token)` colours from `src/index.css`, no new dependencies).
They are drop-ins, not a spec.

## 1. Copy the files

From this bundle into your repo, keeping the paths:

    src/lib/teamColors.js          → src/lib/teamColors.js
    src/PlayerAvatar.jsx           → src/PlayerAvatar.jsx
    src/AltLineLadder.jsx          → src/AltLineLadder.jsx
    src/PlayerContextBlocks.jsx    → src/PlayerContextBlocks.jsx
    src/NewsPageRedesign.jsx       → src/NewsPageRedesign.jsx

Nothing is overwritten. Your existing `NewsPage.jsx` stays until you decide to
switch over.

## 2. Add the fonts

In `index.html`, inside `<head>`:

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;600;700;800&family=Archivo:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap">

Then at the end of `src/index.css`:

    .pp-display { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 600; }
    .pp-mono    { font-family: 'Space Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
    body        { font-family: 'Archivo', system-ui, sans-serif; }

The components reference `.pp-display` and `.pp-mono`, so type comes from these
two classes — change them in one place later if you swap faces.

## 3. Check the token names

The components use `var(--panel)`, `var(--panel2)`, `var(--line)`, `var(--text)`,
`var(--dim)`, `var(--dim-strong)` — the ones already used in `NewsPage.jsx` — plus
`var(--accent)`, `var(--accent-text)`, `var(--pos)`, `var(--neg)`, `var(--amber)`,
each with a hex fallback. If your accent variable is named something else (the
settings/ColorWheel accent), either add

    :root { --accent: var(--amber); --accent-text: var(--amber); }

or find-and-replace `--accent` in the five new files. Lapis blue in the design is
`#3b5bdb` with `#8fa6ff` for accent text.

## 4. Swap in the news page

Wherever the News tab renders `<NewsPage />`, render this instead:

    import NewsPageRedesign from "./NewsPageRedesign.jsx";

    <NewsPageRedesign
      resolvePlayer={resolvePlayerFromArticle}   // optional, see below
      injuryWire={injuryWire}                    // optional
      watchlistMoves={watchlistMoves}            // optional
      onOpenLadder={(player) => goToPlayerProps(player)}
    />

With no props it renders as a clean two-column feed. The avatars, AFFECTS chips
and rail fill in as you supply data:

    // article -> player + the props this item moves, or null
    function resolvePlayerFromArticle(article) {
      const p = players.find((pl) => article.title.includes(pl.name));
      if (!p) return null;
      return {
        name: p.name, team: p.team, position: p.position, espnId: p.espnId,
        status: p.injuryStatus,          // "active" | "questionable" | "out"
        watching: watchlist.has(p.id),
        affects: p.props.map((pr) => ({
          label: pr.market, line: pr.line, hitRate: pr.hitRate,
          gamesOver: pr.gamesOver, gamesCounted: pr.gamesCounted,
        })),
      };
    }

Items with no player match still render — they just have no face and no AFFECTS
row. Do not substitute a generic avatar.

## 5. Avatars everywhere

`PlayerAvatar` replaces every place a player is named:

    import PlayerAvatar from "./PlayerAvatar.jsx";

    <PlayerAvatar name="Puka Nacua" team="LAR" espnId={4426515}
                  status="active" size={52} surface="var(--panel)" />

- Background is the team's two colours (135°, primary flat to 40%, then a
  darkened secondary) from `teamColors.js`.
- `espnId` builds an ESPN headshot URL; pass `headshotSrc` instead if you already
  have a URL (your `GamecastPage` items and `mlbHeadshot()` in `lib/gamesData.js`
  already carry one).
- A missing or 404 image falls back to the team gradient. Initials only render
  when there is no photo at all.
- `surface` must match the background behind the avatar so the status dot's
  border punches through cleanly.

## 6. Alt lines

    import AltLineLadder, { SlipLeg } from "./AltLineLadder.jsx";

    <AltLineLadder
      player={{ name, team, position, espnId, status }}
      market="Receptions"
      markets={["Receptions", "Rec yards", "Longest"]}
      rungs={rungs}                 // see shape below
      slipLines={slip.filter(l => l.playerId === id).map(l => l.line)}
      onAddLeg={(rung) => addLeg(player, market, rung)}
      onMarketChange={setMarket}
    />

    // rungs, ascending by line:
    [{ line: 3.5, hitRate: 1.00, gamesOver: 9, gamesCounted: 9, price: -400 },
     { line: 4.5, hitRate: 0.89, gamesOver: 8, gamesCounted: 9, price: -210 },
     { line: 5.5, hitRate: 0.78, gamesOver: 7, gamesCounted: 9, price: -145, isMain: true },
     { line: 6.5, hitRate: 0.44, gamesOver: 4, gamesCounted: 9, price:  135 },
     { line: 7.5, hitRate: 0.22, gamesOver: 2, gamesCounted: 9, price:  290, thin: true }]

Build each rung by counting the **same finished games** against that line — one
pass over the game log per rung. Never model or interpolate a rung, and set
`thin: true` under 10 games.

In the slip, one `<SlipLeg>` per leg:

    <SlipLeg leg={leg} rungs={laddersByProp[leg.propId]}
             onChangeLine={(rung) => updateLeg(leg.id, rung)}
             onRemove={() => removeLeg(leg.id)} />

The stepper moves the leg between rungs, tags it `ALT` off the main line, and
prints the trade-off. For the combined block, count games where **all** the legs'
players finished and all legs cleared — do not multiply the single rates.

## 7. Player profile context

    import { InjuryAndNews, MissingAround } from "./PlayerContextBlocks.jsx";

    <InjuryAndNews
      status="active" statusNote="NO DESIGNATION"
      items={[
        { when: "14 MIN", tone: "current", text: "Full participant Friday and Saturday. Cleared the injury report without a designation." },
        { when: "WEEK 8", tone: "scare", text: "Ankle. Left in the second half at Arizona on 48% of snaps.", result: "under" },
      ]}
      summary={{ count: "7 of 7", text: "over 5.5 in the games he finished. Both unders are the two games above." }}
    />

    <MissingAround
      people={[{
        name: "Davante Adams", team: "LAR", position: "WR", status: "out",
        note: "Hamstring · ruled out Friday",
        effect: "Target share with Adams out rose from 24% to 31% across three games.",
        count: { value: "3 of 3", label: "OVER 5.5" },
      }]}
      footnote="Only absences that moved his target share by more than three points are listed."
    />

Drop both into the right column of the prop page, above the splits block.

## 8. Ship it

Per your `CLAUDE.md`: work on `master`, run `npm run build` before pushing, then
push `master` to deploy.

## If you'd rather have Claude Code do the wiring

Open the repo in Claude Code and paste:

    Read design_handoff_proppalace_redesign/README.md and INSTALL.md, then do steps
    1-4: copy the five files into src/, add the fonts, reconcile the token names
    with src/index.css, and wire NewsPageRedesign into the News tab. Then wire
    AltLineLadder and SlipLeg into the props feed and slip in PropLedger.jsx, and
    the two context blocks into the player prop page. Use PropPalace
    Concepts.dc.html as the visual reference. Run npm run build when done.
