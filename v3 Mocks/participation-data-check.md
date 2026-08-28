# Do you have a per-game participation record?

The teammate and opposing-lineup filters need one thing your game logs may not
carry: for every game in a player's log, **who else was active in that game**.

Answer these five questions against your own data. If all five are yes, the
filters can be implemented as designed. If any is no, that question names the
work.

## 1. Can you list every player who appeared in a given game?

Pick one game id from your MLB, NBA or WNBA logs and ask your data for the set of
players who recorded a line in it. Not the roster — the players who actually
appeared.

- **Yes** if you store box scores per game, or a per-player game log keyed by
  game id. Either gives you the set by grouping on the game.
- **No** if you only store per-player season aggregates, or logs without a game
  id you can join on.

## 2. Can you tell "did not play" from "played and recorded nothing"?

A player who was inactive and a player who played six scoreless minutes must not
look the same. A zero row is not an absence.

- **Yes** if inactive players are either missing from the game's rows entirely,
  or present with an explicit status (DNP, inactive, scratched).
- **No** if your loader writes a zero row for everyone on the roster.

## 3. Does that history go back as far as the windows you offer?

The filters slice the same log the graph plots. If participation only exists for
recent games, a "without X" filter over a season window silently counts games it
cannot describe.

- **Yes** if participation is available for every game you would plot, including
  the 2025 season you already store.
- **No** if it starts partway through, in which case the control needs a floor:
  the earliest game with participation data.

## 4. Are player identities stable across games?

The filter matches a specific teammate across many games, so it needs an id, not
a display name. Names change spelling, get suffixes, and collide.

- **Yes** if each player carries a stable id (your own, or ESPN's) in every game
  row.
- **No** if games are joined by name string. That works until two players share
  a surname on one roster.

## 5. Do you have the opponent's participation too?

The opposing-lineup filter is the same question asked of the other team. It only
works if a game's record covers both sides.

- **Yes** if a game's rows include both teams.
- **No** if you only ingest rows for the team you were querying.

## The shape the design assumes

Per game, a set of active player ids for each side:

    game_id, team_id, player_id, active

Everything the filter does is derived from that:

- **with X** — keep games where X is active
- **without X** — keep games where X is not active
- **the count on each card** — how many games survive that filter, computed
  before the window and split are applied
- **the thin-sample warning** — that count falling under five

## What to do if the answer is no

The filter degrades honestly rather than lying. In order of preference:

1. Derive participation from the box scores you already ingest (question 1
   answers this for most setups).
2. Limit the control to the seasons where you do have it, and say so on the
   control rather than returning a silent partial count.
3. Hide the control for sports or seasons without the data. Never show a filter
   whose count cannot be trusted — a wrong sample size is worse than no filter,
   because it reads as a finding.
