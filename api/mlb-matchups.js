import { Redis } from "@upstash/redis";

// Read-only endpoint the frontend polls (once per day per browser tab, see
// loadRealMlbTeamDef in src/PropLedger.jsx) to pick up whatever the nightly
// refresh-mlb-matchups cron job most recently computed.
export default async function handler(req, res) {
  try {
    // The Vercel/Upstash Marketplace integration combined our custom env
    // prefix with Vercel's "KV" product naming, so the REST credentials
    // ended up as UPSTASH_REDIS_REST_KV_REST_API_URL/_TOKEN rather than the
    // plain UPSTASH_REDIS_REST_URL/_TOKEN that Redis.fromEnv() looks for.
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
      token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
    });
    const data = await redis.get("mlb_team_def");
    res.status(200).json(data || { byTeam: {}, updatedAt: null });
  } catch (err) {
    res.status(500).json({ byTeam: {}, updatedAt: null, error: String(err) });
  }
}
