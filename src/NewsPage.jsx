import React, { useEffect, useState } from "react";
import { fetchNews } from "./lib/newsdata.js";

function timeAgo(pubDate) {
  if (!pubDate) return "";
  const then = new Date(pubDate.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(then)) return "";
  const diffH = Math.round((Date.now() - then) / 3600000);
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

// Generic placeholder used in place of a scraped article image (see
// src/lib/newsdata.js -- we deliberately never pull images from the news
// API, licensing on AP/Getty-sourced photos redistributed through it is
// murky). Just a plain panel-colored square with a newspaper glyph; a real
// Wikimedia Commons lookup can replace this slot later.
function ArticleThumb({ size = 64 }) {
  return (
    <div
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: 6,
        background: "var(--panel2)", border: "1px solid var(--line)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.4, color: "var(--dim)",
      }}
    >
      📰
    </div>
  );
}

function ArticleCard({ article, isLast }) {
  return (
    <div
      style={{
        display: "flex", gap: 12, padding: "14px 16px",
        borderBottom: isLast ? "none" : "1px solid var(--line)",
      }}
    >
      <ArticleThumb />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="oswald" style={{ fontSize: 14.5, color: "var(--text)", lineHeight: 1.35 }}>
          {article.title}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {article.sourceName}{article.pubDate ? ` · ${timeAgo(article.pubDate)}` : ""}
        </div>
        {article.snippet && (
          <div style={{ fontSize: 13, color: "var(--dim-strong)", marginTop: 6, lineHeight: 1.4 }}>
            {article.snippet}{article.snippet.length >= 220 ? "…" : ""}
          </div>
        )}
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="oswald"
          style={{ display: "inline-block", marginTop: 8, fontSize: 12.5, fontWeight: 600, color: "var(--amber)", textDecoration: "none" }}
        >
          Read full story →
        </a>
      </div>
    </div>
  );
}

// General News tab: latest NBA/NFL headlines, unfiltered beyond the sports
// category. See PlayerNewsModule.jsx for the player-specific variant used
// on individual prop pages.
export default function NewsPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchNews({ q: "NBA OR NFL", category: "sports", limit: 20 }).then((res) => {
      if (cancelled) return;
      setArticles(res.articles);
      setError(res.articles.length ? null : res.error);
      setStale(res.stale);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page-shell" style={{ maxWidth: 900, margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 className="oswald" style={{ fontSize: 20, color: "var(--text)", margin: 0 }}>Latest News</h2>
        <div style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 4 }}>
          NBA &amp; NFL headlines, via Newsdata.io — snippet + source only, tap through for the full story.
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
        {loading && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--dim)", fontSize: 14 }}>Loading headlines…</div>
        )}
        {!loading && articles.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--dim)", fontSize: 14 }}>
            {error ? "Couldn't load news right now — try again shortly." : "No recent headlines."}
          </div>
        )}
        {!loading && articles.map((a, i) => (
          <ArticleCard key={a.id || i} article={a} isLast={i === articles.length - 1} />
        ))}
      </div>

      {stale && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--dim)" }}>
          Showing cached headlines from earlier — live refresh is temporarily unavailable.
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 12, color: "var(--dim)" }}>
        Headlines cache for ~45 minutes to stay within Newsdata's free-tier request limit.
      </div>
    </div>
  );
}
