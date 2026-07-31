import { Redis } from "@upstash/redis";

// Maps MLB Stats API team IDs to the 3-letter abbreviations used throughout
// the app (kept in sync with MLB_TEAM_ID_ABBR in src/PropLedger.jsx).
const TEAM_ID_ABBR = {
  109: "ARI", 144: "ATL", 110: "BAL", 111: "BOS", 112: "CHC", 145: "CWS", 113: "CIN", 114: "CLE",
  115: "COL", 116: "DET", 117: "HOU", 118: "KC", 108: "LAA", 119: "LAD", 146: "MIA", 158: "MIL",
  142: "MIN", 121: "NYM", 147: "NYY", 133: "ATH", 143: "PHI", 134: "PIT", 135: "SD", 136: "SEA",
  137: "SF", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 120: "WSH",
};

// Triggered nightly by the Vercel Cron Job defined in vercel.json. Pulls
// each team's real season pitching ERA from the MLB Stats API and ranks
// teams by it (lower ERA = tougher on hitters = rank 1), replacing the
// mock defense ranking the app falls back to. Result is stored in Redis
// (Upstash, via the Vercel Marketplace integration) so every visitor reads
// the same precomputed ranking instead of each browser recomputing it.
export default async function handler(req, res) {
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
      token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
    });
    const season = new Date().getFullYear();
    const r = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=pitching&season=${season}&sportId=1`
    );
    if (!r.ok) throw new Error(`MLB API responded ${r.status}`);
    const data = await r.json();
    const splits = data?.stats?.[0]?.splits || [];

    const ratings = splits
      .map((s) => ({ abbr: TEAM_ID_ABBR[s.team?.id], era: parseFloat(s.stat?.era) }))
      .filter((t) => t.abbr && !Number.isNaN(t.era));

    if (!ratings.length) throw new Error("No team pitching stats returned");

    ratings.sort((a, b) => a.era - b.era);
    ratings.forEach((t, i) => { t.rank = i + 1; });

    const byTeam = {};
    ratings.forEach((t) => { byTeam[t.abbr] = { rank: t.rank, era: t.era }; });

    const record = { byTeam, season, updatedAt: Date.now() };
    await redis.set("mlb_team_def", record);

    res.status(200).json({ ok: true, teams: ratings.length, updatedAt: record.updatedAt });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
