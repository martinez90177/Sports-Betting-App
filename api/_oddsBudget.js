import { Redis } from "@upstash/redis";

// The Odds API credit ledger, for routes other than api/odds.js.
//
// The underscore keeps this file from being deployed as a route of its own
// (Vercel skips `_`-prefixed files under api/). It exists so a second route
// that spends credits -- api/book-markets.js -- counts against the *same*
// monthly counter and the same cap as the odds panel, under the same Redis
// keys, rather than keeping a tally of its own that could let the two
// together overspend the free tier. The keys and the cap below are the ones
// api/odds.js uses; change them there and here together.

export const ODDS_MONTHLY_CREDIT_CAP = 450;
const CREDIT_KEY_TTL_S = 45 * 24 * 60 * 60;

export function redisClient() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
  });
}

export function creditKey(now = new Date()) {
  return `odds-credits:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

// The month's spend, preferring the figure the API itself last reported when
// it is higher than our own count (it counts every user of the key).
export async function creditsSpent(redis) {
  const [spent, reported] = await Promise.all([
    redis.get(creditKey()).catch(() => null),
    redis.get("odds-credits:reported").catch(() => null),
  ]);
  const counted = Number(spent) || 0;
  return reported && Number.isFinite(Number(reported.used))
    ? Math.max(counted, Number(reported.used))
    : counted;
}

// Recorded after a call succeeds, never before -- a failed request does not
// spend. Bookkeeping never fails the caller.
export async function recordSpend(redis, credits, res) {
  try {
    await redis.incrby(creditKey(), credits);
    await redis.expire(creditKey(), CREDIT_KEY_TTL_S);
    const remaining = Number(res && res.headers.get("x-requests-remaining"));
    const used = Number(res && res.headers.get("x-requests-used"));
    if (Number.isFinite(used) || Number.isFinite(remaining)) {
      await redis.set("odds-credits:reported", {
        used: Number.isFinite(used) ? used : null,
        remaining: Number.isFinite(remaining) ? remaining : null,
        at: Date.now(),
      });
    }
  } catch {}
}
