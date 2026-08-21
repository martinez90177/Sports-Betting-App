# PropPalace

## Start here

Two committed documents carry the context that isn't in the code:

- **[`docs/REDESIGN_PLAN.md`](docs/REDESIGN_PLAN.md)** — the working plan. The
  numbered build order, which items have shipped, what is next, the decisions
  already made (and the few still open), plus the separate data track for live
  rosters and real game logs. **Read it before starting any redesign item.**
- **[`docs/PROJECT_NOTES.md`](docs/PROJECT_NOTES.md)** — durable facts about the
  project that the repo and git history don't record.
- **[`docs/ACCOUNTS_SUBSCRIPTION_TUTORIAL.md`](docs/ACCOUNTS_SUBSCRIPTION_TUTORIAL.md)**
  — the full spec for accounts, Stripe subscriptions and the beginner tutorial.
  Not started; summarised as its own track in the plan.

These are committed on purpose: this project is worked on from more than one
computer, and Claude's own memory does not travel between machines.

Design sources of truth live in `design_handoff_proppalace_redesign/` (the
original concepts) and `design_handoff_propplace_landing_board/` (the later
landing-page and board handoff — read its `README.md` first).

## Git workflow

This is a solo project deployed from Vercel, which builds **production from `master`**.
Work directly on `master`.

When Alex says "commit", "push", or "commit and push", commit to `master` and push to
`origin master` — do not create a feature branch first, and do not ask which branch.
Pushing `master` triggers a live production deploy that Alex shares publicly, so run
`npm run build` before pushing: a build failure means Vercel's deploy fails and the
live site silently keeps serving the previous version.

Background: in Aug 2026 four commits (including the Prop Ledger → PropPalace rebrand)
sat on a feature branch while the shared link kept serving stale code from `master`.

## Avatar and availability rules

1. Anywhere a player is named — feed rows, roster rails, player pages, mobile nav,
   lineup drawers, news items, teammate chips, gamecast leaders — they get a
   `PlayerAvatar`, and that avatar carries their availability dot. No surface shows a
   bare player name; no avatar appears without its status.
2. Exactly three availability colours: available = green `#3ecf8e`, questionable =
   amber `#e8b13a`, out = red `#ef5b5b`. Unknown = no dot (never grey, never
   defaulting to green). Blue is the app's accent — it means selected, never health.
   A status rendering blue is a bug.
3. The dot owns the avatar's bottom-right corner. Nothing else goes there — not a team
   logo, not a jersey number.
4. Nothing is ever silently dropped. A game, player or row that can't render surfaces
   as a visible state, never as an absent row.

Naming trap behind rule 2: the CSS variable `--amber` is **not** amber. It is the
user's accent colour (`--accent-color`, default blue `#2f8cf5`), re-tinted from the
Settings colour wheel. Availability colours must be literal hexes or their own tokens
(`--status-*`), never `--amber`/`--accent`, or health reads as the accent.
