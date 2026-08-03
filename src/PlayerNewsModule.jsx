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

// Drop-in "Latest News" module for a single-player prop page. Reuses that
// page's own headshot image (already loaded there for the player selector)
// as the thumbnail instead of anything pulled from the news API -- see
// NewsPage.jsx's ArticleThumb placeholder for why we avoid scraped images.
export default function PlayerNewsModule({ playerName, headshotSrc, limit = 4 }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerName) return;
    let cancelled = false;
    setLoading(true);
    fetchNews({ q: `"${playerName}"`, category: "sports", limit }).then((res) => {
      if (cancelled) return;
      setArticles(res.articles);
      setError(res.articles.length ? null : res.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [playerName, limit]);

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden", marginTop: 16 }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
        <div className="oswald" style={{ fontSize: 13, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Latest News
        </div>
      </div>

      {loading && (
        <div style={{ padding: 20, textAlign: "center", color: "var(--dim)", fontSize: 13 }}>Loading news…</div>
      )}
      {!loading && articles.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", color: "var(--dim)", fontSize: 13 }}>
          {error ? "Couldn't load news right now." : `No recent headlines for ${playerName}.`}
        </div>
      )}
      {!loading && articles.map((a, i) => (
        <div
          key={a.id || i}
          style={{
            display: "flex", gap: 10, padding: "10px 16px", alignItems: "flex-start",
            borderBottom: i === articles.length - 1 ? "none" : "1px solid var(--line)",
          }}
        >
          {headshotSrc && (
            <img
              src={headshotSrc}
              alt=""
              width={32} height={32}
              style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid var(--line)" }}
              onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="oswald" style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.3 }}>
              {a.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 3 }}>
              {a.sourceName}{a.pubDate ? ` · ${timeAgo(a.pubDate)}` : ""}
            </div>
            <a
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--amber)", textDecoration: "none" }}
            >
              Read more →
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
