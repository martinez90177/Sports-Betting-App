// Thin client for /api/news, which proxies Newsdata.io (free tier, 200
// requests/day). The API key used to live here behind a VITE_ prefix, which
// meant Vite inlined it into the bundle every visitor downloads -- it now
// stays server-side in api/news.js.
//
// Two cache layers, deliberately: localStorage below (instant re-render, and
// keeps this browser off the network on repeat visits) and a shared Redis
// cache in api/news.js above (so headlines fetched for one visitor serve
// everyone else too). Only the shared layer protects the daily quota; the
// local one is just latency.
const CACHE_TTL_MS = 45 * 60 * 1000; // 45 min -- free tier articles already lag ~12hr, no need to refetch often

// Relative age of an article's pubDate ("3h ago"). Lives here rather than in
// one of the two components that render headlines, so the news module and the
// player page's injury/news timeline label the same article the same way.
export function timeAgo(pubDate) {
  if (!pubDate) return "";
  const then = new Date(pubDate.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(then)) return "";
  const diffH = Math.round((Date.now() - then) / 3600000);
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

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

// Fetches sports headlines, optionally filtered by a query (player/team
// name). Returns { articles, stale, error }: `stale` is true when we had to
// fall back to a cached copy because a live fetch failed and we're serving
// the last good response instead of an empty feed.
//
// Articles arrive already normalized by api/news.js (headline, source, date,
// snippet, link -- never article bodies).
export async function fetchNews({ q, category = "sports", limit = 10 } = {}) {
  const key = cacheKey({ q, category });
  const cached = readCache(key);
  const cacheIsFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
  if (cacheIsFresh) {
    return { articles: cached.articles.slice(0, limit), stale: false, error: null };
  }

  const url = new URL("/api/news", window.location.origin);
  url.searchParams.set("category", category);
  url.searchParams.set("limit", String(limit));
  if (q) url.searchParams.set("q", q);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    if (!res.ok) throw new Error(`/api/news responded ${res.status}`);
    // The proxy answers 200 with an empty list and an `error` string when
    // upstream fails and it has nothing cached -- treat that as a failure here
    // so we can still fall back to this browser's own stale copy below.
    if (data.error && !data.articles?.length) throw new Error(data.error);

    const articles = data.articles || [];
    writeCache(key, articles);
    return { articles: articles.slice(0, limit), stale: !!data.stale, error: null };
  } catch (err) {
    // Offline, or the proxy had nothing -- serve whatever's cached (even if
    // past TTL) rather than showing an empty/broken feed. Note /api/news only
    // exists on Vercel, so this is also the path taken during `npm run dev`.
    //
    // The reader gets a sentence, not the exception. On `npm run dev` this
    // path throws a JSON parse error, because Vite serves api/news.js as a
    // module and the browser tries to read `import { Redis }` as JSON -- and
    // "Unexpected token 'i'" was appearing on the News screen as though it
    // were the news. The exception still goes to the console, where it is
    // the right audience for it.
    console.error("news fetch failed", err);
    const note = typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "The news proxy only runs on Vercel, so there is no wire in local development. This is a dev-server answer, not an empty day."
      : "The news wire could not be reached. This is a network answer, not an empty day.";
    if (cached) return { articles: cached.articles.slice(0, limit), stale: true, error: note };
    return { articles: [], stale: false, error: note };
  }
}
