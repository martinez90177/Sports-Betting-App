import { Redis } from "@upstash/redis";

// Newsdata.io free tier is 200 requests/day. This used to be called straight
// from the browser with a VITE_-prefixed key, which (a) shipped the key to
// every visitor in the bundle and (b) cached only in each visitor's own
// localStorage -- so N people reading the same headlines cost N requests.
// Proxying it here fixes both: the key stays server-side, and the Redis cache
// is shared, so the 51st person to open the News tab costs 0 upstream calls.
const API_BASE = "https://newsdata.io/api/1/news";
const CACHE_TTL_MS = 45 * 60 * 1000; // matches the old client TTL -- free-tier articles already lag ~12hr

// `q` is caller-controlled (player names from the frontend), and every distinct
// value is a distinct cache key = a distinct upstream request. Cap the length so
// a hostile caller can't mint unlimited cache-missing queries and drain the day's
// quota; real queries are player names, comfortably under this.
const MAX_Q_LENGTH = 60;

function redisClient() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
  });
}

// Normalizes a Newsdata article down to just what the app ever renders:
// headline, source, date, a short snippet, and the outbound link. We
// deliberately drop `content` (the fuller body text some articles include) --
// this app only ever shows headline + snippet + link-out, never reproduces
// article bodies.
function normalizeArticle(a) {
  return {
    id: a.article_id || a.link,
    title: a.title,
    link: a.link,
    sourceName: a.source_name || a.source_id || "Unknown source",
    pubDate: a.pubDate,
    snippet: a.description ? a.description.slice(0, 220) : "",
  };
}

export default async function handler(req, res) {
  const q = String(req.query.q || "").trim().slice(0, MAX_Q_LENGTH);
  const category = String(req.query.category || "sports").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

  const redis = redisClient();
  const cacheKey = `news:${category}:${q || "general"}`;

  try {
    const apiKey = process.env.NEWSDATA_API_KEY;
    if (!apiKey) throw new Error("Missing NEWSDATA_API_KEY");

    const cached = await redis.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return res.status(200).json({ articles: cached.articles.slice(0, limit), fetchedAt: cached.fetchedAt, stale: false, error: null });
    }

    const url = new URL(API_BASE);
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("category", category);
    url.searchParams.set("language", "en");
    if (q) url.searchParams.set("q", q);

    const upstream = await fetch(url.toString());
    const data = await upstream.json();
    if (!upstream.ok || data.status !== "success") {
      throw new Error(data?.results?.message || data?.message || `Newsdata API responded ${upstream.status}`);
    }

    const articles = (data.results || []).map(normalizeArticle);
    const record = { articles, fetchedAt: Date.now() };
    await redis.set(cacheKey, record);
    res.status(200).json({ articles: articles.slice(0, limit), fetchedAt: record.fetchedAt, stale: false, error: null });
  } catch (err) {
    // Rate-limited or upstream down -- serve whatever's cached (even past TTL)
    // rather than showing an empty/broken feed.
    const staleCopy = await redis.get(cacheKey).catch(() => null);
    if (staleCopy) {
      return res.status(200).json({ articles: staleCopy.articles.slice(0, limit), fetchedAt: staleCopy.fetchedAt, stale: true, error: String(err) });
    }
    res.status(200).json({ articles: [], fetchedAt: null, stale: false, error: String(err) });
  }
}
