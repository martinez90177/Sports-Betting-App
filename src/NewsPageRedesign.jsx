import React, { useEffect, useState } from "react";
import { fetchNews } from "./lib/newsdata.js";
import PlayerAvatar, { StatusPill } from "./PlayerAvatar.jsx";

// Redesigned News page. Replaces the card list in the current NewsPage.jsx with
// a two-column layout: a feed where every item can name the props it moves, and
// a rail carrying the injury wire and watchlist moves.
//
// The Newsdata feed has no player attribution, so pass `resolvePlayer` to map an
// article to a player + affected props. Items without a match still render, just
// without an avatar or AFFECTS row -- no placeholder faces.
//
//   resolvePlayer(article) -> { name, team, position, espnId, status,
//                               affects: [{ label, line, hitRate, gamesOver, gamesCounted }] } | null

function timeAgo(pubDate) {
  if (!pubDate) return "";
  const then = new Date(pubDate.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(then)) return "";
  const diffH = Math.round((Date.now() - then) / 3600000);
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

const pct = (r) => `${Math.round(r * 100)}%`;

function AffectsRow({ affects, onOpenLadder }) {
  if (!affects || !affects.length) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
      <span className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--dim)" }}>AFFECTS</span>
      {affects.map((a) => (
        <span key={a.label} style={{ display: "flex", alignItems: "center", gap: 9, border: "1px solid var(--line)", padding: "7px 12px" }}>
          <span style={{ fontSize: 13 }}>{a.label} <span style={{ color: "var(--dim)" }}>{a.line}</span></span>
          {a.gamesCounted >= 10 ? (
            <span className="pp-mono" style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: a.hitRate >= 0.7 ? "var(--pos, #3ecf8e)" : "var(--dim-strong, #aab2c0)" }}>
              {pct(a.hitRate)}
            </span>
          ) : (
            <span className="pp-mono" style={{ fontSize: 12, color: "var(--dim)" }}>{a.gamesOver} of {a.gamesCounted} · too few</span>
          )}
        </span>
      ))}
      {onOpenLadder && (
        <button type="button" onClick={onOpenLadder} className="pp-mono"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 11.5, letterSpacing: "0.08em", color: "var(--accent-text, #8fa6ff)" }}>
          OPEN ALT LINES →
        </button>
      )}
    </div>
  );
}

function FeedItem({ article, player, lead, onOpenLadder, action }) {
  const avatarSize = lead ? 68 : 52;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: player ? (lead ? `${avatarSize}px 1fr` : `${avatarSize}px 1fr auto`) : "1fr auto",
        gap: lead ? 20 : 18, alignItems: lead ? "start" : "start",
        padding: lead ? "24px 28px" : "20px 28px",
        background: lead ? "var(--panel2)" : "transparent",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {player && (
        <PlayerAvatar
          name={player.name} team={player.team} espnId={player.espnId}
          status={player.status} size={avatarSize}
          surface={lead ? "var(--panel2)" : "var(--panel)"}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div className="pp-mono" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10.5, letterSpacing: "0.14em", color: "var(--dim)" }}>
          {lead && <span style={{ background: "var(--accent, #3b5bdb)", color: "#fff", padding: "3px 8px" }}>TOP STORY</span>}
          <span>
            {player ? `${player.team} · ${player.position} · ` : ""}
            {article.sourceName}{article.pubDate ? ` · ${timeAgo(article.pubDate)}` : ""}
          </span>
        </div>
        <div className="pp-display" style={{ fontSize: lead ? 28 : 21, lineHeight: lead ? 1.25 : 1.3, marginTop: lead ? 10 : 7, textWrap: "pretty" }}>
          {article.title}
        </div>
        {article.snippet && (
          <div style={{ fontSize: lead ? 14.5 : 14, lineHeight: 1.6, color: "var(--dim-strong, #aab2c0)", marginTop: lead ? 10 : 7, maxWidth: 640 }}>
            {article.snippet}
          </div>
        )}
        <AffectsRow affects={player?.affects} onOpenLadder={player && onOpenLadder ? () => onOpenLadder(player) : null} />
        <a href={article.link} target="_blank" rel="noopener noreferrer" className="pp-mono"
          style={{ display: "inline-block", marginTop: 12, fontSize: 11.5, letterSpacing: "0.08em", color: "var(--accent-text, #8fa6ff)", textDecoration: "none" }}>
          READ FULL STORY →
        </a>
      </div>
      {!lead && action}
    </div>
  );
}

function RailHeader({ title, meta }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 24px", borderBottom: "1px solid var(--line)", background: "var(--panel2)" }}>
      <span style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
        <span style={{ width: 4, height: 8, background: "var(--accent, #3b5bdb)", borderRadius: "2px 2px 0 0" }} />
        <span style={{ width: 4, height: 14, background: "var(--accent, #3b5bdb)", borderRadius: "2px 2px 0 0" }} />
        <span style={{ width: 4, height: 11, background: "var(--accent, #3b5bdb)", borderRadius: "2px 2px 0 0" }} />
      </span>
      <span className="pp-display" style={{ fontSize: 19 }}>{title}</span>
      {meta && <span className="pp-mono" style={{ marginLeft: "auto", fontSize: 10.5, letterSpacing: "0.1em", color: "var(--dim)" }}>{meta}</span>}
    </div>
  );
}

const FILTERS = ["All", "Watching", "Injuries", "Line moves"];

export default function NewsPageRedesign({
  resolvePlayer,
  injuryWire = [],
  watchlistMoves = [],
  onOpenLadder,
  query = "NBA OR NFL",
}) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchNews({ q: query, category: "sports", limit: 20 }).then((res) => {
      if (cancelled) return;
      setArticles(res.articles);
      setError(res.articles.length ? null : res.error);
      setStale(res.stale);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [query]);

  const withPlayers = articles.map((a) => ({ article: a, player: resolvePlayer ? resolvePlayer(a) : null }));
  const shown = withPlayers.filter(({ player }) => {
    if (filter === "All") return true;
    if (filter === "Watching") return player?.watching;
    if (filter === "Injuries") return player?.status === "out" || player?.status === "questionable";
    if (filter === "Line moves") return player?.lineMoved;
    return true;
  });

  return (
    <div className="page-shell" style={{ boxSizing: "border-box" }}>
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "22px 28px 16px", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <h2 className="pp-display" style={{ fontSize: 34, margin: 0, letterSpacing: "-0.01em" }}>News</h2>
            <span className="pp-mono" style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)" }}>
              {loading ? "Loading…" : `${shown.length} items`}
            </span>
          </div>
          <div style={{ display: "flex", gap: 2, fontSize: 13, letterSpacing: "0.06em" }}>
            {FILTERS.map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                style={{
                  cursor: "pointer", padding: "8px 16px",
                  background: f === filter ? "var(--accent, #3b5bdb)" : "transparent",
                  color: f === filter ? "#fff" : "var(--dim-strong, #aab2c0)",
                  border: f === filter ? "1px solid var(--accent, #3b5bdb)" : "1px solid var(--line)",
                }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 372px", borderTop: "1px solid var(--line)" }}>
          <div style={{ borderRight: "1px solid var(--line)" }}>
            {loading && <div style={{ padding: 24, textAlign: "center", color: "var(--dim)", fontSize: 14 }}>Loading headlines…</div>}
            {!loading && shown.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "var(--dim)", fontSize: 14 }}>
                {error ? "Couldn't load news right now — try again shortly." : "Nothing matches this filter."}
              </div>
            )}
            {!loading && shown.map(({ article, player }, i) => (
              <FeedItem
                key={article.id || i}
                article={article}
                player={player}
                lead={i === 0}
                onOpenLadder={onOpenLadder}
                action={player?.watching ? (
                  <span className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--accent-text, #8fa6ff)", border: "1px solid var(--accent, #3b5bdb)", padding: "8px 12px" }}>WATCHING</span>
                ) : null}
              />
            ))}
          </div>

          <div>
            {injuryWire.length > 0 && (
              <>
                <RailHeader title="Injury wire" meta={injuryWire.meta} />
                {injuryWire.map((p) => (
                  <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 24px", borderBottom: "1px solid var(--line)", opacity: p.status === "out" ? 0.75 : 1 }}>
                    <PlayerAvatar name={p.name} team={p.team} espnId={p.espnId} size={38} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14 }}>{p.name} <span className="pp-mono" style={{ fontSize: 11.5, color: "var(--dim)" }}>{p.team} · {p.position}</span></div>
                      <div style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 2 }}>{p.propLine}</div>
                    </div>
                    <span style={{ marginLeft: "auto" }}><StatusPill status={p.status} /></span>
                  </div>
                ))}
              </>
            )}

            {watchlistMoves.length > 0 && (
              <>
                <RailHeader title="Your watchlist moved" />
                {watchlistMoves.map((m) => (
                  <div key={m.player.name + m.from} style={{ padding: "18px 24px", borderBottom: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <PlayerAvatar name={m.player.name} team={m.player.team} espnId={m.player.espnId} size={34} />
                      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                        {m.player.name} {m.market} <span style={{ color: "var(--dim)" }}>{m.from}</span> → <span style={{ color: "var(--accent-text, #8fa6ff)" }}>{m.to}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 12 }}>
                      <span className="pp-mono" style={{ fontSize: 26, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--dim-strong, #aab2c0)" }}>{pct(m.hitRateAtNewLine)}</span>
                      <span style={{ fontSize: 12.5, color: "var(--dim)" }}>at the new number · {m.gamesOver} of {m.gamesCounted} games</span>
                    </div>
                    {onOpenLadder && (
                      <button type="button" onClick={() => onOpenLadder(m.player)} className="pp-mono"
                        style={{ marginTop: 14, cursor: "pointer", border: "none", fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", background: "var(--accent, #3b5bdb)", color: "#fff", padding: "11px 16px" }}>
                        See the ladder
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}

            <div style={{ padding: "18px 24px", fontSize: 12.5, lineHeight: 1.6, color: "var(--dim)" }}>
              News is context for the numbers. Nothing here is a pick, and no item changes a hit rate — only finished games do that.
            </div>
          </div>
        </div>
      </div>

      {stale && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--dim)" }}>
          Showing cached headlines from earlier — live refresh is temporarily unavailable.
        </div>
      )}
    </div>
  );
}
