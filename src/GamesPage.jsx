import React, { useEffect, useMemo, useState, useRef } from "react";
import MatchupPage from "./MatchupPage.jsx";
import GamecastPage from "./GamecastPage.jsx";
import {
  SPORTS, teamLogo, dayKey, dayLabel, timeLabel, buildDateTabs,
  mockGames, mockNflWeekOne, fetchMlbSlate, fetchWnbaSlate, fetchNflWeekOneSlate,
  GAME_STATUS, statusSortKey, isActiveStatus, opensGamecast,
} from "./lib/gamesData.js";

// Games page -- a recreation of Outlier's Games screen, minus everything
// that needs an odds feed (PropPalace has none). Two reference recordings
// drive the layout: the desktop web app and the iOS app, which compose the
// game card differently. Both are reproduced here rather than scaling one
// into the other, because they genuinely differ:
//
//   desktop  TODAY · 12:15 PM   on its own line, teams left/right, "@" between
//   mobile   teams left/right with the kickoff time stacked in the middle
//
// The odds columns were ~85% of the desktop card's width, so keeping that
// card's stacked left rail would have left a near-empty box. The left/right
// composition is the same product's own mobile layout, which stays balanced
// with no odds present.

const LEAGUE_MARK = {
  mlb: "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
  wnba: "https://a.espncdn.com/i/teamlogos/leagues/500/wnba.png",
  nfl: "https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png",
};

function useIsNarrow(px) {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${px}px)`).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${px}px)`);
    const on = (e) => setNarrow(e.matches);
    mq.addEventListener("change", on);
    setNarrow(mq.matches);
    return () => mq.removeEventListener("change", on);
  }, [px]);
  return narrow;
}

// The hero banner. The reference's is a fixed olive-green sweep; this one is
// mixed live from --amber (the accent the user picks in Settings), so the
// page re-tints with the rest of PropPalace instead of hardcoding one
// brand's green. Everything else about the banner -- the height, the bloom
// sitting off-centre, the fade into the panel -- follows the recordings.
const accent = (pct) => `color-mix(in srgb, var(--amber) ${pct}%, transparent)`;

function heroBackground(isMobile) {
  if (isMobile) {
    // Phone gets the more saturated treatment the iOS reference uses, with
    // the bloom anchored in both top corners.
    return [
      `radial-gradient(95% 120% at 12% 0%, ${accent(52)} 0%, transparent 60%)`,
      `radial-gradient(95% 120% at 90% 0%, ${accent(34)} 0%, transparent 62%)`,
      "linear-gradient(180deg, transparent 45%, var(--bg) 100%)",
      "linear-gradient(140deg, #0b0d12 0%, #11151d 55%, #0b0d12 100%)",
    ].join(", ");
  }
  return [
    `radial-gradient(72% 150% at 76% -20%, ${accent(38)} 0%, transparent 68%)`,
    `radial-gradient(58% 130% at 24% -30%, ${accent(16)} 0%, transparent 72%)`,
    "linear-gradient(180deg, transparent 42%, var(--surface-sunken) 100%)",
    "linear-gradient(120deg, #0b0d12 0%, #10131a 55%, #0b0d12 100%)",
  ].join(", ");
}

function SportTabs({ sport, onChange, isMobile }) {
  return (
    <div className="gm-scroll-x" style={{ gap: isMobile ? 10 : 8, padding: isMobile ? "0 14px 2px" : 0 }}>
      {SPORTS.map((s) => {
        const active = s.id === sport;
        return (
          <div
            key={s.id}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            onClick={() => onChange(s.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(s.id); } }}
            className="gm-tab oswald"
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: isMobile ? 9 : 7,
              padding: isMobile ? "9px 15px" : "7px 13px",
              // Squarer than the reference's full pills -- closer to the
              // .chip idiom the rest of PropPalace uses, and it reads more
              // like a research tool than a sportsbook.
              borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap",
              background: active ? "var(--amber-dim)" : (isMobile ? "rgba(255,255,255,0.045)" : "transparent"),
              border: `1px solid ${active ? "var(--amber)" : (isMobile ? "rgba(255,255,255,0.09)" : "var(--line)")}`,
              color: active ? "var(--amber)" : "var(--dim)",
              fontSize: isMobile ? 14.5 : 13, fontWeight: 700, letterSpacing: "0.02em",
            }}
          >
            <img
              src={LEAGUE_MARK[s.id]}
              alt=""
              width={isMobile ? 19 : 16}
              height={isMobile ? 19 : 16}
              style={{ objectFit: "contain", opacity: active ? 1 : 0.45 }}
            />
            {s.label}
          </div>
        );
      })}
    </div>
  );
}

// The active date is marked by a short white bar *above* the label, not an
// underline -- see dfull/D00001 and m2/X00001, where the bar sits flush with
// the top edge of the row.
function DateTabs({ tabs, activeKey, onChange, isMobile, caption }) {
  return (
    // Opaque background matters here: this row pins while cards scroll under it.
    <div style={{ borderBottom: "1px solid var(--line)", background: isMobile ? "var(--bg)" : "var(--surface-sunken)" }}>
      {caption && (
        <div style={{
          // Bottom padding keeps the caption clear of the active tab's
          // indicator bar, which is pinned to the top of the row below it.
          padding: isMobile ? "9px 16px 7px" : "9px 12px 7px", fontSize: 10.5, fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--dim)",
        }}>
          {caption}
        </div>
      )}
      <div className="gm-scroll-x" style={{ gap: isMobile ? 6 : 4, padding: isMobile ? "0 10px" : 0 }}>
        {tabs.map((t) => {
          const active = t.key === activeKey;
          return (
            <div
              key={t.key}
              className="gm-tab"
              role="tab"
              aria-selected={active}
              tabIndex={0}
              onClick={() => onChange(t.key)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(t.key); } }}
              style={{
                flexShrink: 0, position: "relative", cursor: "pointer",
                padding: isMobile ? "11px 14px 12px" : "9px 12px 10px",
                minWidth: isMobile ? 74 : 62, textAlign: isMobile ? "center" : "left",
                color: active ? "var(--amber)" : "var(--dim)",
              }}
            >
              {/* The reference marks the active date with a white bar above
                  the label; this sits it underneath in the accent instead,
                  which is the .tab.active idiom used elsewhere in the app. */}
              <div style={{
                position: "absolute", bottom: 0, left: isMobile ? "50%" : 12,
                transform: isMobile ? "translateX(-50%)" : "none",
                width: isMobile ? 40 : 26, height: 2, borderRadius: "2px 2px 0 0",
                background: active ? "var(--amber)" : "transparent",
              }} />
              <div className="oswald" style={{ fontSize: isMobile ? 15.5 : 13.5, fontWeight: 700, whiteSpace: "nowrap" }}>{t.label}</div>
              <div style={{
                fontSize: isMobile ? 11.5 : 10, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em",
                color: active ? "var(--amber)" : "var(--dim)", opacity: active ? 0.75 : 1,
              }}>
                {t.sub}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GamesSearchBar({ value, onChange, isMobile }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 9,
      height: isMobile ? 42 : 34,
      padding: isMobile ? "0 16px" : "0 12px",
      borderRadius: isMobile ? "var(--r-pill)" : "var(--r-md)",
      background: isMobile ? "#131315" : "var(--surface-2)",
      border: `1px solid ${isMobile ? "transparent" : "var(--line)"}`,
    }}>
      <span style={{ color: "var(--dim)", fontSize: isMobile ? 15 : 13, lineHeight: 1 }}>⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search..."
        aria-label="Search games"
        style={{
          flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
          color: "var(--text)", fontSize: isMobile ? 15.5 : 13, fontFamily: "inherit",
        }}
      />
    </div>
  );
}

function TeamSide({ game, side, isMobile, align, showScore }) {
  const t = game[side];
  const muted = game.isFinal;
  const logo = (
    <img
      src={teamLogo(game.sport, t.abbr)}
      alt=""
      width={isMobile ? 26 : 28}
      height={isMobile ? 26 : 28}
      style={{
        objectFit: "contain", flexShrink: 0,
        opacity: muted ? 0.55 : 1,
      }}
      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
    />
  );
  const text = (
    <div style={{ minWidth: 0, textAlign: align }}>
      <div className="oswald" style={{
        fontSize: isMobile ? 15.5 : 15, fontWeight: 700,
        color: muted ? "var(--dim)" : "var(--text)",
        lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {isMobile ? t.name : t.full}
      </div>
      {showScore && t.score != null ? (
        <div className="mono tnum" style={{
          fontSize: isMobile ? 20 : 22, fontWeight: 700,
          color: muted ? "var(--dim-strong)" : "var(--text)",
          marginTop: 3, letterSpacing: "-0.02em", lineHeight: 1.1,
        }}>
          {t.score}
        </div>
      ) : (
        <div className="mono tnum" style={{
          fontSize: isMobile ? 12 : 11.5,
          color: muted ? "rgba(255,255,255,0.28)" : "var(--dim)",
          marginTop: 4, letterSpacing: "0.02em",
        }}>
          {t.record}
        </div>
      )}
    </div>
  );
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: isMobile ? 8 : 11, minWidth: 0,
      justifyContent: align === "right" ? "flex-end" : "flex-start",
    }}>
      {align === "right" ? <>{text}{logo}</> : <>{logo}{text}</>}
    </div>
  );
}

function statusCenterContent(game, isMobile) {
  const status = game.status || GAME_STATUS.UPCOMING;

  if (status === GAME_STATUS.FINAL) {
    return {
      primary: "FINAL",
      secondary: null,
      live: false,
      final: true,
    };
  }
  if (status === GAME_STATUS.LIVE || status === GAME_STATUS.HALFTIME || status === GAME_STATUS.INTERMISSION) {
    return {
      primary: status === GAME_STATUS.HALFTIME ? "HALFTIME"
        : status === GAME_STATUS.INTERMISSION ? "INTERMISSION"
        : "LIVE",
      secondary: game.periodLabel || null,
      live: true,
      final: false,
    };
  }
  if (status === GAME_STATUS.STARTING_SOON) {
    return {
      primary: timeLabel(game.startsAt),
      secondary: "STARTING SOON",
      live: false,
      final: false,
    };
  }
  if (status === GAME_STATUS.DELAYED) {
    return { primary: "DELAYED", secondary: null, live: false, final: false };
  }
  if (status === GAME_STATUS.POSTPONED) {
    return { primary: "POSTPONED", secondary: null, live: false, final: false };
  }
  if (status === GAME_STATUS.SUSPENDED) {
    return { primary: "SUSPENDED", secondary: null, live: false, final: false };
  }
  // UPCOMING
  return {
    primary: timeLabel(game.startsAt),
    secondary: dayLabel(game.startsAt),
    live: false,
    final: false,
  };
}

function GameCard({ game, isMobile, onSelect }) {
  const open = () => onSelect(game);
  const status = game.status || GAME_STATUS.UPCOMING;
  const showScore = (game.isLive || game.isFinal) && (game.away.score != null || game.home.score != null);
  const center = statusCenterContent(game, isMobile);
  const muted = game.isFinal;

  return (
    <div
      className="gm-card"
      role="button"
      tabIndex={0}
      aria-label={`${game.away.full} at ${game.home.full}, ${center.primary}${center.secondary ? ` ${center.secondary}` : ""}`}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      style={{
        position: "relative", overflow: "hidden",
        background: muted ? "rgba(255,255,255,0.02)" : "var(--panel)",
        border: `1px solid ${center.live ? "rgba(59, 130, 246, 0.35)" : muted ? "rgba(255,255,255,0.04)" : "var(--line)"}`,
        borderRadius: isMobile ? 14 : "var(--r-lg)",
        padding: isMobile
          ? (muted ? "11px 12px" : "14px 12px")
          : (muted ? "13px 22px" : "16px 22px"),
        minHeight: isMobile ? (muted ? 72 : 84) : (muted ? 80 : 96),
        display: "flex", flexDirection: "column", justifyContent: "center",
        boxSizing: "border-box",
        opacity: muted ? 0.72 : 1,
        transition: "opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: isMobile ? 8 : 18 }}>
        <TeamSide game={game} side="away" isMobile={isMobile} align="left" showScore={showScore} />

        <div style={{
          flexShrink: 0, textAlign: "center", minWidth: isMobile ? 68 : 96,
          padding: isMobile ? "6px 7px" : "7px 12px",
          background: center.live
            ? "rgba(59, 130, 246, 0.12)"
            : muted
              ? "rgba(255,255,255,0.03)"
              : "var(--surface-2)",
          border: `1px solid ${center.live ? "rgba(59, 130, 246, 0.3)" : muted ? "rgba(255,255,255,0.05)" : "var(--line)"}`,
          borderRadius: 8,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}>
            {center.live && (
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--amber)",
                boxShadow: "0 0 0 0 rgba(59, 130, 246, 0.5)",
                animation: "gm-live-pulse 1.6s ease-out infinite",
              }} />
            )}
            <div className="mono tnum" style={{
              fontSize: isMobile ? 11.5 : 13, fontWeight: 700,
              color: center.live ? "var(--amber)" : muted ? "var(--dim)" : "var(--text)",
              whiteSpace: "nowrap",
              letterSpacing: center.live || center.final ? "0.04em" : 0,
            }}>
              {center.primary}
            </div>
          </div>
          {center.secondary && (
            <div style={{
              fontSize: isMobile ? 9.5 : 9.5, marginTop: 3,
              color: center.live ? "rgba(147, 197, 253, 0.85)" : "var(--dim)",
              textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600,
              whiteSpace: "pre-line", lineHeight: 1.25,
            }}>
              {center.secondary}
            </div>
          )}
        </div>

        <TeamSide game={game} side="home" isMobile={isMobile} align="right" showScore={showScore} />
      </div>
    </div>
  );
}

export default function GamesPage({ onViewProps }) {
  const isMobile = useIsNarrow(720);
  const [sport, setSport] = useState("mlb");
  const [query, setQuery] = useState("");
  // The open game is tracked by id, not by the object captured at click time:
  // the live poller replaces the slate objects every 20s, and holding a
  // snapshot meant an open Gamecast kept showing the score from the moment it
  // was opened. `selectedSnap` is the fallback for the case where the game is
  // no longer in the loaded slate at all (a poll returning a short list, or a
  // date switch), so the page can never blank out mid-view.
  const [selectedId, setSelectedId] = useState(null);
  const selectedSnap = useRef(null);

  // NFL is a week competition, so its whole Week 1 slate is loaded once and
  // the date tabs are derived from the kickoff days it actually contains.
  const [nflWeek, setNflWeek] = useState(() => mockNflWeekOne());
  const [dayGames, setDayGames] = useState([]);
  const [pickedKey, setPickedKey] = useState(null);
  const pollRef = useRef(null);

  const tabs = useMemo(() => buildDateTabs(sport, nflWeek), [sport, nflWeek]);

  // Deriving the active key rather than storing it means switching sports
  // can't strand a selection on a date tab the new sport doesn't have.
  const activeKey = useMemo(() => {
    if (pickedKey && tabs.some((t) => t.key === pickedKey)) return pickedKey;
    return sport === "nfl" ? tabs[0]?.key : dayKey(new Date());
  }, [pickedKey, tabs, sport]);

  // Centralized slate loader. Used on mount/date change and by the live poller.
  const loadSlate = React.useCallback((s, key, { silent = false } = {}) => {
    const opts = { force: silent }; // polling always bypasses short TTL
    if (s === "nfl") {
      return fetchNflWeekOneSlate(opts).then((live) => {
        if (live) setNflWeek(live);
        return live;
      });
    }
    if (!key) return Promise.resolve(null);
    if (!silent) {
      const offset = Math.round(
        (new Date(`${key}T12:00:00`) - new Date(`${dayKey(new Date())}T12:00:00`)) / 86400000
      );
      setDayGames(mockGames(s, offset));
    }
    const load = s === "mlb" ? fetchMlbSlate(key, opts) : fetchWnbaSlate(key, opts);
    return load.then((live) => {
      if (live) setDayGames(live);
      return live;
    });
  }, []);

  useEffect(() => {
    if (sport !== "nfl") return undefined;
    let cancelled = false;
    fetchNflWeekOneSlate().then((live) => { if (!cancelled && live) setNflWeek(live); });
    return () => { cancelled = true; };
  }, [sport]);

  // Mock first so the list never flashes empty, then upgrade in place if the
  // live feed answers -- the pattern the rest of the app uses for remote data.
  useEffect(() => {
    if (sport === "nfl" || !activeKey) return undefined;
    let cancelled = false;
    const offset = Math.round((new Date(`${activeKey}T12:00:00`) - new Date(`${dayKey(new Date())}T12:00:00`)) / 86400000);
    setDayGames(mockGames(sport, offset));
    const load = sport === "mlb" ? fetchMlbSlate(activeKey) : fetchWnbaSlate(activeKey);
    load.then((live) => { if (!cancelled && live) setDayGames(live); });
    return () => { cancelled = true; };
  }, [sport, activeKey]);

  // Light live polling only for the currently viewed day when any game is
  // still active. Pauses when the tab is hidden. Stops once everything is FINAL.
  useEffect(() => {
    const clearPoll = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      loadSlate(sport, activeKey, { silent: true });
    };

    const base = sport === "nfl"
      ? nflWeek.filter((g) => dayKey(new Date(g.startsAt)) === activeKey)
      : dayGames;
    const needsPoll = base.some((g) => isActiveStatus(g.status));

    clearPoll();
    if (needsPoll) {
      // 20s is a reasonable balance for scoreboard data without hammering.
      pollRef.current = setInterval(tick, 20_000);
    }
    return clearPoll;
  }, [sport, activeKey, dayGames, nflWeek, loadSlate]);

  const games = useMemo(() => {
    const base = sport === "nfl"
      ? nflWeek.filter((g) => dayKey(new Date(g.startsAt)) === activeKey)
      : dayGames;
    const q = query.trim().toLowerCase();
    let list = base;
    if (q) {
      list = base.filter((g) =>
        [g.away.full, g.home.full, g.away.abbr, g.home.abbr, g.away.name, g.home.name]
          .some((s) => String(s).toLowerCase().includes(q))
      );
    }
    // Phase B: dynamic ordering by live state, then start time within each group.
    return [...list].sort((a, b) => {
      const sa = statusSortKey(a.status || GAME_STATUS.UPCOMING);
      const sb = statusSortKey(b.status || GAME_STATUS.UPCOMING);
      if (sa !== sb) return sa - sb;
      return new Date(a.startsAt) - new Date(b.startsAt);
    });
  }, [sport, nflWeek, dayGames, activeKey, query]);

  // Slate summary shown under the title. Reads off the same list the cards
  // render, so it tracks the search filter too.
  // Declared above the early return below: a hook placed after it would go
  // unrun the moment a game is selected, which React treats as a changed
  // hook count and throws on.
  const gameCount = games.length;

  // Re-resolved from the slate on every render, so the open page tracks the
  // poller's fresh status/score/periodLabel with no extra fetch of its own.
  // Searched against the unfiltered slate: typing in the search box must not
  // pull the game out from under an open page.
  const selected = useMemo(() => {
    if (!selectedId) return null;
    const base = sport === "nfl" ? nflWeek : dayGames;
    return base.find((g) => g.id === selectedId) || selectedSnap.current;
  }, [selectedId, sport, nflWeek, dayGames]);

  const subtitle = useMemo(() => {
    if (sport === "nfl") return "NFL Week 1";
    const d = activeKey ? new Date(`${activeKey}T12:00:00`) : new Date();
    return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  }, [sport, activeKey]);

  if (selected) {
    // A game that goes live while its Matchup Overview is open swaps to the
    // Gamecast on the next poll, which is the intent -- the pre-game view has
    // nothing left to say once the first pitch is thrown.
    const Page = opensGamecast(selected.status) ? GamecastPage : MatchupPage;
    return (
      <Page
        game={selected}
        isMobile={isMobile}
        onBack={() => { selectedSnap.current = null; setSelectedId(null); }}
        onViewProps={onViewProps}
      />
    );
  }

  const hero = (
    <div style={{
      background: heroBackground(isMobile),
      borderRadius: isMobile ? 0 : "var(--r-xl) var(--r-xl) 0 0",
      padding: isMobile ? "14px 0 12px" : "22px 22px 14px",
    }}>
      {/* The accent dot ties the page back to the ● PropPalace wordmark, and
          the slate summary underneath is a line the reference doesn't carry
          at all -- it answers "how big is today?" before you scroll. */}
      <div style={{ padding: isMobile ? "0 16px" : 0, marginBottom: isMobile ? 15 : 17 }}>
        <h1
          className="oswald"
          style={{
            margin: 0, display: "flex", alignItems: "baseline", gap: 10,
            fontSize: isMobile ? 29 : 33, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)",
          }}
        >
          <span style={{ color: "var(--amber)", fontSize: isMobile ? 15 : 17 }}>●</span>
          Games
        </h1>
        <div style={{
          marginTop: 6, fontSize: isMobile ? 12 : 12, color: "var(--dim)",
          textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 600,
        }}>
          <span className="tnum" style={{ color: "var(--amber)" }}>{gameCount}</span>
          {` ${gameCount === 1 ? "game" : "games"} · ${subtitle}`}
        </div>
      </div>
      <SportTabs sport={sport} onChange={(s) => { setSport(s); setPickedKey(null); }} isMobile={isMobile} />
    </div>
  );

  const dates = (
    <DateTabs
      tabs={tabs}
      activeKey={activeKey}
      onChange={setPickedKey}
      isMobile={isMobile}
      caption={sport === "nfl" ? "Week 1" : null}
    />
  );

  return (
    <div style={{
      maxWidth: isMobile ? "none" : 992,
      margin: "0 auto",
      padding: isMobile ? 0 : "0 16px 32px",
      boxSizing: "border-box",
    }}>
      {/* The reference's whole content column is a raised panel a shade above
          the page black, with the cards a further shade above that -- keeping
          that three-step ramp is most of why the list reads as grouped. */}
      <div style={{
        background: isMobile ? "transparent" : "var(--surface-sunken)",
        borderRadius: isMobile ? 0 : "var(--r-xl)",
        border: isMobile ? "none" : "1px solid var(--line-subtle)",
        overflow: "visible",
      }}>
      {/* Desktop pins only the date row (the hero and search scroll away, per
          dfull/D00121); the iOS reference pins the entire header, so on mobile
          the whole block gets the sticky treatment instead. */}
      {isMobile ? (
        <div className="gm-sticky">{hero}{dates}</div>
      ) : (
        <>
          {hero}
          <div className="gm-sticky">{dates}</div>
        </>
      )}

      <div style={{ padding: isMobile ? "12px 8px 0" : "14px 12px 0" }}>
        <GamesSearchBar value={query} onChange={setQuery} isMobile={isMobile} />
      </div>

      <div style={{
        display: "flex", flexDirection: "column", gap: 10,
        padding: isMobile ? "12px 8px 28px" : "12px 12px 14px",
      }}>
        {games.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            isMobile={isMobile}
            onSelect={(picked) => { selectedSnap.current = picked; setSelectedId(picked.id); }}
          />
        ))}
        {games.length === 0 && (
          <div style={{ padding: 28, textAlign: "center", color: "var(--dim)", fontSize: 14 }}>
            {query ? "No games match that search." : "No games scheduled for this date."}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
