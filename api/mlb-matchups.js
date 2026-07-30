import { Redis } from "@upstash/redis";

// Read-only endpoint the frontend polls (once per day per browser tab, see
// loadRealMlbTeamDef in src/PropLedger.jsx) to pick up whatever the nightly
// refresh-mlb-matchups cron job most recently computed.
export default async function handler(req, res) {
  try {
    const redis = Redis.fromEnv();
    const data = await redis.get("mlb_team_def");
    res.status(200).json(data || { byTeam: {}, updatedAt: null });
  } catch (err) {
    res.status(500).json({ byTeam: {}, updatedAt: null, error: String(err) });
  }
}
