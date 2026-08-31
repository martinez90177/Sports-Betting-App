import React, { useEffect, useState } from "react";
import { fetchNews } from "./lib/newsdata.js";
import PlayerAvatar, { StatusPill } from "./PlayerAvatar.jsx";
import { useIsPhone } from "./lib/useIsNarrow.js";
import NewsMobile from "./v3/NewsMobile.jsx";
import NewsDesktop from "./v3/NewsDesktop.jsx";

// Redesigned News page. Replaces the card list in the current NewsPage.jsx with
// a two-column layout: a feed where every item can name the props it moves, and
// a rail carrying the injury wire and watchlist moves.
//
// The Newsdata feed has no player attribution, so pass `resolvePlayer` to map an
// article to a player + affected props. Items without a match still render, just
// without an avatar or AFFECTS row -- no placeholder faces.
//
//   resolvePlayer(article) -> { name, team, position, sport, espnId, headshotSrc,
//                               fallbackSrc, status, watching,
//                               affects: [{ label, line, hitRate, gamesOver, gamesCounted }] } | null
//
// `sport`/`headshotSrc`/`fallbackSrc` are on top of the original handoff shape:
// this app's PlayerAvatar resolves team colours per league (abbreviations
// collide across them) and each sport has its own photo CDN, so a bare espnId
// would give NFL colours and an NFL headshot URL to a WNBA player.

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
          {/* The rate never travels without the count behind it -- the
              reference chip shows a bare "78%", which is the one thing this
              app doesn't do. */}
          {a.gamesCounted >= 10 ? (
            <span className="pp-mono" style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: a.hitRate >= 0.7 ? "var(--pos, #3ecf8e)" : "var(--dim-strong, #aab2c0)" }}>
              {pct(a.hitRate)} <span style={{ fontWeight: 400, color: "var(--dim)" }}>{a.gamesOver} of {a.gamesCounted}</span>
            </span>
          ) : (
            <span className="pp-mono" style={{ fontSize: 12, color: "var(--dim)" }}>{a.gamesOver} of {a.gamesCounted} · too few</span>
          )}
        </span>
      ))}
      {/* "OPEN ALT LINES" in the reference. There are no alt lines in the app
          until phase 3 builds the rung data, so the link says what it actually
          does today -- opens this player's hit-rate chart. */}
      {onOpenLadder && (
        <button type="button" onClick={onOpenLadder} className="pp-mono"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 11.5, letterSpacing: "0.08em", color: "var(--accent-text, #8fa6ff)" }}>
          VIEW HIT-RATE CHART →
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
          name={player.name} team={player.team} sport={player.sport}
          espnId={player.espnId} headshotSrc={player.headshotSrc} fallbackSrc={player.fallbackSrc}
          status={player.status} size={avatarSize} alt={player.name}
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
          style={{ display: "inline-flex", alignItems: "center", minHeight: 44, marginTop: 4, fontSize: 11.5, letterSpacing: "0.08em", color: "var(--accent-text)", textDecoration: "none" }}>
          READ FULL STORY →
        </a>
      </div>
      {!lead && action}
    </div>
  );
}

function RailHeader({ title, meta }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 20px", borderBottom: "1px solid var(--line)", background: "var(--surface-sunken)" }}>
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

// "Line moves" is in the reference but not here: the app keeps no history of a
// posted line moving, so that tab could only ever be empty. A filter that can
// never match anything is worse than an absent one.
const FILTERS = ["All", "Watching", "Injuries"];

// The availability legend, in the fixed hexes CLAUDE.md rule 2 names. Not
// tokens: these must not re-tint with the accent or shift between themes, and
// writing them literally here is what stops a later refactor pointing them at
// --pos/--neg. Unknown is the fourth row and has no dot at all, which is the
// rule stated by drawing nothing.
const AVAILABILITY_LEGEND = [
  ["available", "#3ecf8e"],
  ["questionable", "#e8b13a"],
  ["out", "#ef5b5b"],
  ["no dot · unknown", null],
];

// The two-column grid below is a desktop layout (a 372px rail beside the feed).
// Mobile is explicitly a later project, but the News tab is reachable on a
// phone today, so below this width the rail stacks under the feed rather than
// pushing the page into a horizontal scroll.
const TWO_COLUMN_MIN = 900;

function useIsWide(min = TWO_COLUMN_MIN) {
  const [wide, setWide] = useState(() => (typeof window === "undefined" ? true : window.innerWidth >= min));
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= min);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [min]);
  return wide;
}

export default function NewsPageRedesign({
  resolvePlayer,
  injuryWire = [],
  injuryWireMeta,
  injuryWireMore = 0,
  watchlistMoves = [],
  onOpenLadder,
  // Open legs, for the desktop rail's ON YOUR SLIP. Still context: the wire
  // naming a leg is worth surfacing and moves no rate.
  slipLegs = [],
  query = "NBA OR NFL",
  footnote,
}) {
  const wide = useIsWide();
  const isPhone = useIsPhone();
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
  // One predicate per filter, so the chips' counts and the list they produce
  // cannot disagree -- the counts below are this same function, run over the
  // same pool. The "Line moves" branch that used to sit here was unreachable:
  // FILTERS has not offered it since the app stopped pretending to keep line
  // history (see the note above FILTERS), and a dead branch is how a filter
  // that can never match gets quietly restored later.
  const matchesFilter = (player, f) => {
    if (f === "Watching") return !!player?.watching;
    if (f === "Injuries") return player?.status === "out" || player?.status === "questionable";
    return true;
  };
  const shown = withPlayers.filter(({ player }) => matchesFilter(player, filter));
  // What each filter would yield, so a chip that empties the feed says so
  // before it is clicked rather than after.
  const filterCounts = Object.fromEntries(
    FILTERS.map((f) => [f, withPlayers.filter(({ player }) => matchesFilter(player, f)).length])
  );

  // Same wire, same attribution, same counts -- one prop set, two layouts.
  // The phone stacks (src/v3/NewsMobile.jsx); the desktop puts the wire beside
  // a 336px rail (NewsDesktop, mock frame 2d).
  const v3Shared = {
    // The mock drops Injuries from this row: it has its own nav tab, and a
    // filter that duplicates a destination is a second way to ask one
    // question.
    filters: FILTERS.filter((f) => f !== "Injuries"),
    filter: filter === "Injuries" ? "All" : filter,
    counts: filterCounts,
    onSetFilter: setFilter,
    items: shown.map(({ article, player }) => ({
      key: article.link || article.title,
      headline: article.title,
      source: article.sourceName,
      age: article.pubDate ? timeAgo(article.pubDate) : "",
      player,
    })),
    loading,
    error,
    footnote,
    onOpenLadder,
  };

  if (!isPhone) {
    return (
      <NewsDesktop
        {...v3Shared}
        slipLegs={slipLegs}
        renderAvatar={(p, size) => (
          <PlayerAvatar
            name={p.name} alt={p.name} sport={p.sport} team={p.team}
            headshotSrc={p.avatar} espnId={p.espnId}
            status={p.status} size={size} inset={2} surface="var(--surface-1)"
          />
        )}
      />
    );
  }

  if (isPhone) {
    return (
      <NewsMobile {...v3Shared} />
    );
  }

  // ---- The v2 shell (PropPalace News v2.dc.html) ---------------------------
  //
  // The file draws two independent columns -- `minmax(0, 1fr) 372px`, gap 20 --
  // with the feed as one card and the rail as three stacked ones. This screen
  // was a single panel with an internal divider doing the work of the gap, so
  // the rail's three sections read as one long list under three headings
  // rather than as three separate answers.
  const CARD = {
    background: "var(--surface-1)", border: "1px solid var(--line)",
    borderRadius: 6, overflow: "hidden",
  };

}
