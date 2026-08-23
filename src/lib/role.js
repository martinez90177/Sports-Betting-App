// --------------------------------------------------------------------------
// How big a part does this player actually play?
// --------------------------------------------------------------------------
// The Prop Feed sorts on hit rate, and hit rate says nothing about whether a
// prop is one anyone would look at. Its lines come from `fairFeedLine`, which
// sets each one from the player's *own* average — so every prop is roughly a
// coin flip against itself by construction, and the rate measures how
// consistently a player beats his own baseline. A twelve-minute reserve who
// scores 2, 2, 3, 2, 3 is more consistent than a star, and leads the feed.
//
// Measured, not assumed: across a rendered NBA page the correlation between
// the line and the hit rate was −0.16. It is not that low lines win. It is
// that prominence is not in the ranking at all.
//
// ---- What this is not ----
//
// It is NOT betting popularity. There is no wagering-volume feed in this app,
// free or paid, so "most wagered" cannot be built and nothing here pretends
// to. This ranks by **role** — how much of the game a player is on the field
// for — which is a real, measured proxy and a different thing. A starting
// centre on a bad team logs the same minutes as a star. That is the honest
// limit, and it is why the control is called Role.
//
// Every metric below is already fetched for its sport. Nothing new is
// requested to compute this.

// One number per sport, in that sport's own units, plus the unit's name so a
// caller can label it without a second lookup.
//
//   NBA / WNBA  minutes per game       ESPN's gamelog field 0
//   MLB         plate appearances,     from the same logs the rates count;
//               or innings for an SP   a leadoff bat sees ~4.5 PA, a No. 9 ~3.9
//   NFL         touches per game       attempts / carries / targets by position
//
// NFL is per position because there is no single snap number: `snapPct` exists
// on the normalized game but estimateSnapPct derives it from a hand-written
// role profile, and lib/usagePills.js already refuses to show it for exactly
// that reason — a guess presented as a measurement. Attempts, carries and
// targets are counted.
const ROLE_UNIT = {
  nba: "min", wnba: "min", mlb: "PA", nfl: "touches",
};

const mean = (games, pick) => {
  const vals = (games || []).map(pick).filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

function nflTouches(games, position) {
  if (position === "QB") return mean(games, (g) => g.att);
  if (position === "RB") return mean(games, (g) => (g.rushAtt || 0) + (g.tgt || 0));
  if (position === "K") return mean(games, (g) => (g.fga || 0) + (g.xpa || 0));
  return mean(games, (g) => g.tgt);
}

// The role figure for one player, or null when the sport has nothing measured
// to answer with. Null is not zero: a row with no role figure is never filtered
// out by a floor, because "we did not measure it" and "he barely plays" are
// different claims and only one of them is ours to make.
export function roleValue({ sport, games, position, isPitcher }) {
  if (!games || !games.length) return null;
  if (sport === "nba" || sport === "wnba") return mean(games, (g) => g.minutes);
  if (sport === "mlb") {
    // A starter's innings and a batter's plate appearances are not comparable,
    // so pitchers are ranked among themselves by outs recorded. The tiers below
    // read the raw number for batters only; a pitcher always clears them, which
    // is right — a team has one starter and he is never the filler on a card.
    if (isPitcher) return null;
    return mean(games, (g) => g.pa);
  }
  if (sport === "nfl") return nflTouches(games, position);
  return null;
}

export const roleUnit = (sport) => ROLE_UNIT[sport] || "";

// The floors the Role control offers, per sport. Chosen against what the units
// actually mean rather than as round numbers:
//
//   Basketball  20 min is the conventional line between a rotation player and
//               a bench body; 28 is roughly a starter's night.
//   MLB         4.0 PA/g means he is batting most days and near the top half
//               of the order — a No. 9 hitter averages under 4.
//   NFL         6 touches separates a contributor from a rotational body; 12
//               is a feature back or a first-read receiver.
//
// "All" is first and is the default. Nothing is hidden unless it is asked for.
export const ROLE_TIERS = {
  nba: [
    { id: "all", label: "All", min: null },
    { id: "rotation", label: "Rotation", min: 20 },
    { id: "starters", label: "Starters", min: 28 },
  ],
  wnba: [
    { id: "all", label: "All", min: null },
    { id: "rotation", label: "Rotation", min: 20 },
    { id: "starters", label: "Starters", min: 28 },
  ],
  mlb: [
    { id: "all", label: "All", min: null },
    { id: "regulars", label: "Regulars", min: 3.6 },
    { id: "top", label: "Top of the order", min: 4.2 },
  ],
  nfl: [
    { id: "all", label: "All", min: null },
    { id: "contributors", label: "Contributors", min: 6 },
    { id: "featured", label: "Featured", min: 12 },
  ],
};

export const roleTiers = (sport) => ROLE_TIERS[sport] || ROLE_TIERS.nba;

// Does a row clear a tier? A row with no measured role always passes: see the
// note on roleValue. A pitcher passes for the same reason.
export function clearsRole(row, tierId, sport) {
  const tier = roleTiers(sport).find((t) => t.id === tierId);
  if (!tier || tier.min == null) return true;
  if (row.role == null) return true;
  return row.role >= tier.min;
}
