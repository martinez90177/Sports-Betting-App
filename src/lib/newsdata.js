// Thin client for the Newsdata.io free tier (200 requests/day). Every call
// goes through localStorage first so repeated visits to the same feed
// (general News tab, or the same player's module re-mounting as you flip
// between props) don't burn through the daily cap -- see CACHE_TTL_MS.
const API_BASE = "https://newsdata.io/api/1/news";
const CACHE_TTL_MS = 45 * 60 * 1000; // 45 min -- free tier articles already lag ~12hr, no need to refetch often

function cacheKey(params) {
  return `newsdata_cache:${params.category || "none"}:${params.q || "general"}`;
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(key, articles) {
  try {
    localStorage.setItem(key, JSON.stringify({ articles, fetchedAt: Date.now() }));
  } catch {
    // localStorage full/unavailable (private browsing, etc.) -- caching is
    // just an optimization here, so silently skip rather than break the feed
  }
}

// Normalizes a Newsdata article down to just what we ever render: headline,
// source, date, a short snippet, and the outbound link. We deliberately drop
// `content` (the fuller body text some articles include) -- this app only
// ever shows headline + snippet + link-out, never reproduces article bodies.
function normalizeArticle(a) {
  return {
    id: a.article_id,
    title: a.title,
    link: a.link,
    sourceName: a.source_name || a.source_id || "Unknown source",
    pubDate: a.pubDate,
    snippet: a.description ? a.description.slice(0, 220) : "",
  };
}

// Fetches sports headlines, optionally filtered by a query (player/team
// name). Returns { articles, stale, error }: `stale` is true when we had to
// fall back to a cached copy (either because the cache is still fresh, or
// because a live fetch failed and we're serving the last good response
// instead of an empty feed).
export async function fetchNews({ q, category = "sports", limit = 10 } = {}) {
  const key = cacheKey({ q, category });
  const cached = readCache(key);
  const cacheIsFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
  if (cacheIsFresh) {
    return { articles: cached.articles.slice(0, limit), stale: false, error: null };
  }

  const apiKey = import.meta.env.VITE_NEWSDATA_API_KEY;
  if (!apiKey) {
    return { articles: cached ? cached.articles.slice(0, limit) : [], stale: !!cached, error: "Missing VITE_NEWSDATA_API_KEY" };
  }

  const url = new URL(API_BASE);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("category", category);
  url.searchParams.set("language", "en");
  if (q) url.searchParams.set("q", q);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    if (!res.ok || data.status !== "success") {
      throw new Error(data?.results?.message || data?.message || `Newsdata API responded ${res.status}`);
    }
    const articles = (data.results || []).map(normalizeArticle);
    writeCache(key, articles);
    return { articles: articles.slice(0, limit), stale: false, error: null };
  } catch (err) {
    // Rate-limited or offline -- serve whatever's cached (even if past TTL)
    // rather than showing an empty/broken feed.
    if (cached) return { articles: cached.articles.slice(0, limit), stale: true, error: String(err) };
    return { articles: [], stale: false, error: String(err) };
  }
}
