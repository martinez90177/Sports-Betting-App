# Accounts, Subscription & Beginner Tutorial

> **Status: not started.** Planned in a session on 2026-08-21 that never landed.
> Verified 2026-08-21 — none of the files below exist on `master`, and the branch
> that session named (`claude/accounts-subscription-tutorial-34tzoh`) is on
> neither origin nor any local checkout. Committed here so the specification
> survives; see [`REDESIGN_PLAN.md`](./REDESIGN_PLAN.md) for how it collides with
> the other tracks.

## Context

PropPalace today is a purely device-local app: settings, picks and saved screens live in
`localStorage`, and `SettingsModal`'s Account section literally says "Accounts are coming".
There is no way to charge anyone.

Alex wants the site to make money through subscriptions, which requires accounts first. The
two screen recordings show the target shape:

- **PropsMadness** (`v1`) — a Settings dialog with tabs *Profile · Security · Preferences ·
  Subscription · Resources*: connected accounts, active-device list + delete account, theme /
  odds-format prefs, plan + "Billed via Stripe" + Manage, and a Resources tab with glossary,
  Discord, walkthrough, help centre, affiliate, socials.
- **Outlier** (`v2`) — an account sheet with avatar + email, *Premium / Manage subscription*,
  Refer Friends, Betting Preferences, Profile Settings, Appearance, Discord, Support, Help
  Centre, Request a Feature, Privacy, Terms, Sign Out.

Three deliverables, decided with Alex:

1. **Accounts** — email + password, own backend on the Upstash Redis already in the project.
2. **Subscription** — real Stripe Checkout + Billing Portal + webhook, running on test keys
   until live keys are added. Free tier sees a **small rotating daily set** of players —
   any tier, stars included — in the Prop Feed and charts; everything else renders locked
   behind a lock badge, so the paywall sells itself. (Revised 2026-08-21; the original
   low-profile-benchwarmer allowlist is scrapped — see §4.)
3. **Tutorial** — a video-game-style guided walkthrough with spotlight coach-marks on the
   real UI, launchable from Settings, that explains betting concepts to a total beginner and
   then releases them to explore.

## Branch note

`CLAUDE.md` says work on `master`. This session is configured to develop and push on
`claude/accounts-subscription-tutorial-34tzoh`, so that is where the work will land — a
feature this size shouldn't auto-deploy to the public site mid-build anyway. Alex merges to
`master` when he wants it live. `npm run build` must pass before every push.

---

## 1. Auth backend

New dependency: `stripe`. Redis client is already used in `api/*` — reuse the exact
`redisClient()` shape from `api/news.js:19-23` (same `UPSTASH_REDIS_REST_KV_REST_API_*` vars).

**`api/_lib/auth.js`** (shared, not an endpoint):
- `hashPassword` / `verifyPassword` — `node:crypto` `scrypt` with a random 16-byte salt,
  stored as `scrypt$N$salt$hash`; compare with `timingSafeEqual` (already imported this way
  in `api/refresh-mlb-matchups.js:2`).
- `newToken()` — `randomBytes(32).toString("base64url")`.
- Cookie helpers — `pp_session`, `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=30d`.
- `readSession(req)` → `{ user, token }` or `null`; `requireUser(req, res)` for guarded routes.
- `publicUser(u)` — strips `passwordHash`; the only user shape the client ever sees.
- `rateLimit(key, max, windowS)` — Redis `INCR` + `EXPIRE`, same pattern as the credit
  counter in `api/odds.js`.

**Redis keys**

| key | value |
|---|---|
| `user:<id>` | JSON: id, email, passwordHash, createdAt, displayName, plan, stripeCustomerId, subStatus, currentPeriodEnd, tourState |
| `user-email:<email lowercased>` | user id — claimed with `SET NX` so signup is atomic |
| `session:<token>` | JSON: userId, ua, ip, createdAt, lastSeenAt — TTL 30d |
| `user-sessions:<id>` | set of that user's tokens (device list / revoke-all) |
| `stripe-customer:<cid>` | user id — webhook lookup |

**Endpoints** (`api/auth/…`, all `POST` unless noted):
- `signup` — email regex + password ≥ 8 chars, `SET NX` on the email key, create user with
  `plan: "free"`, open a session.
- `login` — rate-limited per email and per IP (10 / 15 min), generic error text on failure.
- `logout` — delete session, expire cookie.
- `me` (`GET`) — `publicUser` or `{ user: null }`; refreshes `lastSeenAt`.
- `password` — requires current password; revokes every *other* session.
- `sessions` (`GET` list / `POST` revoke) — powers the Security tab's device list.
- `delete-account` — removes user, email key, all sessions; cancels the Stripe sub first.

## 2. Stripe subscription

**`api/billing/checkout.js`** — requires a session; creates/reuses a Stripe customer, returns
a Checkout Session URL (`mode: "subscription"`, `STRIPE_PRICE_ID`, `client_reference_id` =
user id, success/cancel back to the app origin with `?checkout=success|cancel`).

**`api/billing/portal.js`** — Billing Portal session for the "Manage" row.

**`api/stripe-webhook.js`** — `export const config = { api: { bodyParser: false } }`, raw body
read from the stream, `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`. Handles
`checkout.session.completed` and `customer.subscription.{updated,deleted}`, writing
`plan`/`subStatus`/`currentPeriodEnd` onto `user:<id>`. **The server is the only source of
truth for plan** — the client never sets it.

New env vars (documented in README): `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`,
`STRIPE_WEBHOOK_SECRET`, optional `APP_URL` (falls back to the request origin).

## 3. Client auth + entitlements

**`src/auth.jsx`** — `AuthProvider` mounted in `src/main.jsx` just inside `SettingsProvider`,
so nothing below has to thread props. Fetches `/api/auth/me` once on mount and exposes
`{ user, plan, isPremium, loading, error, signup, login, logout, refresh, startCheckout,
openPortal }`, plus `useAuth()` / `useIsPremium()` convenience hooks mirroring
`useSettings()`/`useOddsFormat()` in `src/settings.jsx`.

**`src/AuthModal.jsx`** — sign in / create account, built on `useOverlay()`
(`src/useOverlay.js`) and the existing `.chip` / `.select` classes, same
dialog-vs-bottom-sheet placement logic as `SettingsModal` (`isNarrow`). Opened from the
Profile tab, from any locked row, and from the header when signed out.

## 4. Free-tier gating

**`src/lib/freeTier.js`** — a small **rotating daily set**, not a hardcoded list.

> **Revised 2026-08-21 by Alex:** the original spec pinned two deliberately
> low-profile players per sport ("explicitly not Ohtani, Judge, Schwarber").
> That is scrapped. The free tier now draws from **any tier of player**, stars
> included — just a few of them.

**Why rotation rather than a fixed list of names.** Three problems die at once:

1. **A trial has to be evaluable.** Someone who can only ever see players they
   have never heard of cannot judge whether the tool is any good. They watch it
   work on an irrelevant player and leave. Showing real, recognisable names —
   sometimes a star — is what actually demonstrates the product.
2. **A hardcoded id breaks against live rosters.** The data track replaces
   hand-written rosters with live ESPN fetches. A pinned player who is traded,
   waived or retired silently disappears, and the free tier quietly empties to
   one player or zero, with no error. Deriving the set from *today's actual
   rows* cannot break that way.
3. **A fixed list goes stale.** The same two names forever gives a returning
   visitor nothing new. A daily rotation gives them a reason to come back, and
   over a week the free tier has shown off far more of the product.

```js
// How many players per sport are readable for free. One constant to retune.
export const FREE_PLAYERS_PER_SPORT = 3;

// Deterministic per (sport, day): every visitor sees the SAME free players on a
// given date, and the set rotates at the day boundary.
export function freePlayerIds(sport, rows, dayKey) { ... }
export function isPlayerUnlocked(sport, playerId, isPremium, freeIds) { ... }
```

**Rules the implementation has to hold:**

- **Deterministic, not random.** Seed `mulberry32` (already in `PropLedger.jsx`)
  from a hash of `` `${sport}-${dayKey}` ``. Same day, same set, for everyone.
  Never `Math.random()` — a set that reshuffles on refresh lets someone reroll
  until they get the player they wanted, and makes the free tier undiscussable.
- **Pick from the sport's full unfiltered row set for the day**, before any
  market/team/game filter. Otherwise the free players change as the user filters,
  which reads as a bug.
- **Sort candidates by player id before picking**, so the choice does not depend
  on the order rows happened to be built in.
- **Prefer players with a real sample** (say `gamesCounted >= 10`). The free
  preview is the sales pitch; it should show the product working, not a
  `TOO FEW` card. Fall back to any player if too few qualify.
- **Unlock the player, not the prop.** A free player is readable across all of
  their markets, so their whole card works and the tour can spotlight it.
- **`dayKey` comes from the existing ET day helper** (`currentMLBDayKey`, which
  the WNBA slate already reuses), so the rotation flips on the same boundary as
  the slates.
- **Empty-slate fallback.** In an offseason, or if the day's rows are empty, the
  set is simply empty — the paywall must render that as "nothing on today's
  board" rather than an app that looks broken.

Sizing: with three free players and ~1,500 MLB props, roughly 30 props are
readable and the rest are visibly locked. Plenty behind the wall.

**`src/Paywall.jsx`** — `LockedOverlay` (blur + lock glyph + "Premium") and `UpgradeModal`
(what Premium unlocks, price, Upgrade → Checkout, "Already subscribed? Sign in").

Gate points, all in `src/PropLedger.jsx` unless noted:
- `FeedRow` (`:13462`) — locked rows still render, with the avatar, name and availability dot
  intact (CLAUDE.md rules 1 and 4: no bare names, nothing silently dropped). The hit-rate
  cells, Form strip and odds are blurred behind `LockedOverlay`; the pick button is replaced
  by a lock chip. Clicking anywhere on a locked row opens `UpgradeModal`.
- `FeedRowLadder` (`:13844`) — same treatment for alt lines.
- `goToProp` (`:17881`) and the search results that call it — a locked player opens the
  upgrade modal instead of navigating, so search isn't a bypass.
- The four sport chart pages — a locked player selected from a roster rail shows the paywall
  panel over the chart rather than the numbers.
- `togglePick` — refuses locked players (defence in depth; the row already blocks it).

Row counts and filters keep counting locked rows, so "showing 42" never silently shrinks.

## 5. Settings, rebuilt

`SECTIONS` in `src/SettingsModal.jsx:23` becomes:

| Tab | Contents |
|---|---|
| **Profile** | Signed-in email + display name + avatar initial, edit name, Sign out. Signed out → a sign-in / create-account CTA. |
| **Security** | Change password; active devices list (device label parsed from UA, IP, last seen, "This device" chip) with revoke and revoke-all; Delete account with a typed confirmation. |
| **Preferences** | Existing Display section (theme, odds format, display size, time zone, motion, accent wheel) plus two new prefs: **Start page** (which page the app opens on) and **Compact rows** (feed density). Both added to `DEFAULTS.display` in `src/settings.jsx:22` — the versioned store already back-fills new keys for existing users. |
| **Betting** | Unchanged (`BettingSection`). |
| **Subscription** | Plan, status, renewal/cancel date, what Premium unlocks, Upgrade (Checkout) or Manage (Portal), "Billed via Stripe". |
| **Tutorial** | Start / resume / restart the walkthrough, chapter list with completion ticks. |
| **Resources** | Existing glossary + Discord + Request a feature, plus Help/FAQ, Privacy, Terms. |

Signed-out users see Preferences, Betting, Tutorial and Resources normally; Profile, Security
and Subscription show a sign-in prompt rather than disappearing.

## 6. The tutorial

**`src/tutorial/tourSteps.js`** — ordered steps, each
`{ id, chapter, page, anchor, title, body, advance: "next" | "click" }`.

Chapters:
1. **Betting 101** — anchorless cards: what a line is, over/under, what odds mean, implied
   probability, what a unit is. Written for someone who has never placed a bet.
2. **Reading the board** — spotlights a *free-tier* feed row (so it works signed out):
   hit rate and the L5/L10/L20 window switch, the line and average beneath it, the Form bars,
   the streak underline.
3. **Matchup context** — Opp rank badge and the soft/average/tough colours.
4. **Building a slip** — "Add to My Picks" (waits for the real click), then the My Picks panel
   and the "Open in <book>" hand-off.
5. **Tracking results** — the Ledger, units, ROI, thin-sample warning.
6. **Free to explore** — names the sport switcher, search and Games/News nav, then exits.

**`src/tutorial/TourProvider.jsx` + `TourOverlay.jsx`** — a portal above everything
(`SettingsModal` sits at 3590/3600, so the tour uses 4200/4210). Spotlight is an SVG mask cut
to the target's `getBoundingClientRect()`; the tooltip card flips side to stay on-screen and
degrades to a bottom sheet on phones. Targets are found by `data-tour="…"` attributes added
to existing elements (attribute-only diffs in `PropLedger.jsx`, `FeedRow`, `MyPicksPanel`,
the header gear). Rect recomputed on scroll/resize via rAF + `ResizeObserver`; target scrolled
into view; respects the app's existing `data-reduce-motion`; `Esc` exits and offers resume.

Steps that need a specific page set it through the existing `setPage`, so the tour drives the
real app rather than a mock. If an anchor is missing, that step degrades to an anchorless card
instead of breaking the tour.

Progress persists to `propPalaceTour` in `localStorage` (`{ step, completed, dismissed }`),
and mirrors onto the user record when signed in so a second device doesn't re-prompt. A
first-visit "New here? Take the 2-minute tour" prompt appears once, dismissible forever.

## Files

**New:** `api/_lib/auth.js`, `api/auth/{signup,login,logout,me,password,sessions,delete-account}.js`,
`api/billing/{checkout,portal}.js`, `api/stripe-webhook.js`, `src/auth.jsx`, `src/AuthModal.jsx`,
`src/Paywall.jsx`, `src/lib/freeTier.js`, `src/tutorial/{tourSteps.js,TourProvider.jsx,TourOverlay.jsx}`.

**Modified:** `src/main.jsx` (providers), `src/settings.jsx` (two new display defaults),
`src/SettingsModal.jsx` (tab restructure + four new sections), `src/PropLedger.jsx` (gating in
`FeedRow`/`FeedRowLadder`/`goToProp`/`togglePick`, `data-tour` anchors, tour + auth modal
mounting), `src/index.css` (lock/blur + spotlight styles), `package.json`, `README.md` (env vars).

## Verification

1. `npm run build` — must pass before any push (Vercel deploys `master` from this repo).
2. `npx vercel dev` for the API routes, then end-to-end by hand:
   sign up → `/api/auth/me` returns the user → sign out → sign in → wrong password is
   rate-limited after 10 tries → change password kicks the other session → device list shows
   "This device" → delete account removes the email key (checked in Upstash).
3. Stripe test mode: `stripe listen --forward-to localhost:3000/api/stripe-webhook`, run
   Checkout with card `4242…`, confirm `plan` flips to `premium` on the user record and the
   Prop Feed unlocks without a reload (after `refresh()`); cancel in the Portal and confirm it
   flips back at period end.
4. Paywall: signed out and on a free account, confirm only the two allowlisted players per
   sport are readable, that every locked row still shows avatar + availability dot, that
   search and "View Chart" both route to the upgrade modal, and that no row vanishes.
5. Tutorial: run it start to finish signed out on desktop and at 390px wide; confirm the
   click-gated steps really wait for the click, that `Esc` → resume works, that a completed
   tour doesn't re-prompt, and that restarting from Settings resets it.
6. Re-check CLAUDE.md's avatar/availability rules across every new surface: no bare player
   names, dots only in the avatar's bottom-right corner, literal status hexes (never
   `--amber`, which is the accent).
