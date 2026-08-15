import { Redis } from "@upstash/redis";
import { timingSafeEqual } from "node:crypto";

// Maps MLB Stats API team IDs to the 3-letter abbreviations used throughout
// the app (kept in sync with MLB_TEAM_ID_ABBR in src/PropLedger.jsx).
const TEAM_ID_ABBR = {
  109: "ARI", 144: "ATL", 110: "BAL", 111: "BOS", 112: "CHC", 145: "CWS", 113: "CIN", 114: "CLE",
  115: "COL", 116: "DET", 117: "HOU", 118: "KC", 108: "LAA", 119: "LAD", 146: "MIA", 158: "MIL",
  142: "MIN", 121: "NYM", 147: "NYY", 133: "ATH", 143: "PHI", 134: "PIT", 135: "SD", 136: "SEA",
  137: "SF", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 120: "WSH",
};

// Per-market defensive metrics.
//
// A team's ERA is a run-prevention number. Ranking a Home Runs or a Stolen
// Bases prop by it is a category error -- the badge ends up describing runs
// while sitting next to a market that isn't runs. The same endpoint already
// returns the per-category totals, so each market gets ranked by the thing it
// actually measures.
//
// Batter markets read the opponent's PITCHING line (what that staff allows).
// Pitcher markets read the opponent's HITTING line (what that lineup does).
//
// Rate, never total: a team that has played 150 games has allowed fewer of
// everything than one that has played 162, and ranking raw totals in-season
// would mostly rank games played. Batter markets use per-9-innings so extra
// innings don't inflate them; the per-9 fields the API already publishes are
// preferred over recomputing.
//
// `label` is what the badge prints. It must describe the number, not the
// market -- that mismatch is the bug this replaces.
//
// Direction is uniform: ascending, so rank 1 is always the opponent that most
// suppresses the stat. That holds for strikeout markets without inverting --
// a low-strikeout staff suppresses a batter's strikeout prop the same way a
// low-homer staff suppresses their home run prop.
const IP = (s) => (Number(s.outs) || 0) / 3;
const per9 = (v, s) => (IP(s) > 0 ? (Number(v) || 0) / IP(s) * 9 : null);
const perGame = (v, s) => (Number(s.gamesPlayed) > 0 ? (Number(v) || 0) / Number(s.gamesPlayed) : null);

const BATTER_METRICS = {
  h:     { label: "opp hits allowed / 9",       value: (s) => Number(s.hitsPer9Inn) },
  r:     { label: "opp runs allowed / 9",       value: (s) => Number(s.runsScoredPer9) },
  hr:    { label: "opp HR allowed / 9",         value: (s) => Number(s.homeRunsPer9) },
  bb:    { label: "opp walks allowed / 9",      value: (s) => Number(s.walksPer9Inn) },
  so:    { label: "opp strikeouts / 9",         value: (s) => Number(s.strikeoutsPer9Inn) },
  tb:    { label: "opp total bases allowed / 9", value: (s) => per9(s.totalBases, s) },
  sb:    { label: "opp steals allowed / g",     value: (s) => perGame(s.stolenBases, s) },
  // No "RBI allowed" stat exists, and H+R+RBI is a composite with no single
  // source. Both are run-driven, so they borrow the runs-allowed ranking --
  // and say so in the label rather than claiming to measure RBI.
  rbi:   { label: "opp runs allowed / 9",       value: (s) => Number(s.runsScoredPer9) },
  hrrbi: { label: "opp runs allowed / 9",       value: (s) => Number(s.runsScoredPer9) },
};

// p_outs has no entry on purpose: how many outs a starter records is a
// function of his own leash and his manager, not of the lineup he faces.
// There is nothing real to rank it by, so it gets no badge.
const PITCHER_METRICS = {
  p_k:  { label: "opp strikeouts / g",   value: (s) => perGame(s.strikeOuts, s) },
  p_h:  { label: "opp hits / g",         value: (s) => perGame(s.hits, s) },
  p_bb: { label: "opp walks / g",        value: (s) => perGame(s.baseOnBalls, s) },
  // The market is Earned Runs but the team hitting line only carries total
  // runs scored. Close, not identical -- so the label says runs scored.
  p_er: { label: "opp runs scored / g",  value: (s) => perGame(s.runs, s) },
};

// Exported (and kept free of Redis, fetch and `res`) so the ranking can be
// run against the live API without a deploy -- see scripts/check-mlb-def.mjs.
// The badge is only correct if this function is, and it is otherwise
// reachable exclusively through a nightly cron on production.
export function buildMlbTeamDef(pitching, hitting) {
  const byTeam = {};

  // The overall ERA ranking stays as `rank`/`era`. It is what the player
  // page's general "run prevention" read uses, and keeping it means a
  // client running older code still gets a sane number rather than a blank.
  const ratings = pitching
    .map((s) => ({ abbr: TEAM_ID_ABBR[s.team?.id], era: parseFloat(s.stat?.era) }))
    .filter((t) => t.abbr && !Number.isNaN(t.era));
  if (!ratings.length) throw new Error("No team ERA returned");
  ratings.sort((a, b) => a.era - b.era);
  ratings.forEach((t, i) => {
    byTeam[t.abbr] = { rank: i + 1, era: t.era, markets: {} };
  });

  Object.entries(BATTER_METRICS).forEach(([id, m]) => rankMetric(pitching, id, m, byTeam));
  if (hitting?.length) {
    Object.entries(PITCHER_METRICS).forEach(([id, m]) => rankMetric(hitting, id, m, byTeam));
  }
  return { byTeam, teams: ratings.length };
}

async function teamStats(group, season) {
  const r = await fetch(
    `https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=${group}&season=${season}&sportId=1`
  );
  if (!r.ok) throw new Error(`MLB API responded ${r.status} for ${group}`);
  const data = await r.json();
  return data?.stats?.[0]?.splits || [];
}

// Ranks every team by one metric, ascending, and writes {rank, value, label}
// onto that team's `markets` bucket. Teams whose value doesn't compute are
// left out entirely rather than sorted to one end, where they'd read as
// either the toughest or the softest matchup in the league.
function rankMetric(splits, marketId, metric, out) {
  const rows = splits
    .map((sp) => ({ abbr: TEAM_ID_ABBR[sp.team?.id], value: metric.value(sp.stat || {}) }))
    .filter((t) => t.abbr && Number.isFinite(t.value));
  if (!rows.length) return;
  rows.sort((a, b) => a.value - b.value);
  rows.forEach((t, i) => {
    if (!out[t.abbr]) out[t.abbr] = {};
    if (!out[t.abbr].markets) out[t.abbr].markets = {};
    out[t.abbr].markets[marketId] = {
      rank: i + 1,
      value: Math.round(t.value * 100) / 100,
      label: metric.label,
      of: rows.length,
    };
  });
}

// Vercel sends `Authorization: Bearer $CRON_SECRET` on cron-triggered
// invocations once that env var is set on the project, and sends nothing on
// an ordinary request -- so checking for it is what separates the cron from
// the open internet. Without it this route was callable by anyone who knew
// the path.
//
// The check is unconditional rather than "only enforce when CRON_SECRET is
// set". The conditional form is the more forgiving default, but it fails
// open: if the variable is ever missing -- unset on a new environment,
// dropped in a project migration, typo'd -- the endpoint silently goes back
// to being public and nothing anywhere says so. Better that a missing
// secret breaks the refresh loudly.
//
// Constant-time compare so a caller can't recover the secret byte by byte
// from response timings. timingSafeEqual throws on a length mismatch, hence
// the explicit length check first.
function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers?.authorization || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Triggered nightly by the Vercel Cron Job defined in vercel.json. Pulls both
// team stat groups from the MLB Stats API and ranks all 30 teams by each
// market's own defensive metric, replacing the single ERA ranking the badge
// used to show against every market. Result is stored in Redis (Upstash, via
// the Vercel Marketplace integration) so every visitor reads the same
// precomputed ranking instead of each browser recomputing it.
export default async function handler(req, res) {
  // Deliberately vague to an unauthorized caller: confirming whether the
  // secret is merely missing from the project or wrong in this request tells
  // them something they shouldn't learn from probing.
  if (!authorized(req)) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
      token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
    });
    const season = new Date().getFullYear();
    const [pitching, hitting] = await Promise.all([
      teamStats("pitching", season),
      teamStats("hitting", season),
    ]);
    if (!pitching.length) throw new Error("No team pitching stats returned");

    const { byTeam, teams } = buildMlbTeamDef(pitching, hitting);

    const record = { byTeam, season, updatedAt: Date.now() };
    await redis.set("mlb_team_def", record);

    res.status(200).json({
      ok: true,
      teams,
      markets: Object.keys(Object.values(byTeam)[0]?.markets || {}).length,
      hitting: hitting.length,
      updatedAt: record.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
