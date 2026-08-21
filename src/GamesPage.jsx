import React, { useEffect, useMemo, useState, useRef } from "react";
import MatchupPage from "./MatchupPage.jsx";
import GamecastPage from "./GamecastPage.jsx";
import {
  SPORTS, teamLogo, dayKey, dayLabel, timeLabel, buildDateTabs,
  fetchMlbSlate, fetchWnbaSlate, fetchNflWeekOneSlate,
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
function DateTabs({ tabs, activeKey, onChange, isMobile, caption, counts }) {
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
                whiteSpace: "nowrap",
              }}>
                {/* undefined = not fetched yet, null = fetch failed -- both
                     read as the plain weekday rather than a wrong or invented
                     count. Only a real, resolved number gets appended. */}
                {counts && Number.isFinite(counts[t.key]) ? `${t.sub} · ${counts[t.key]} ${counts[t.key] === 1 ? "GAME" : "GAMES"}` : t.sub}
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

// The second line of the Matchup cell.
//
// The card layout this table replaced carried records and live scores in its
// two team columns; the row has one cell for both teams, so they move here
// rather than being dropped with the cards. A record the provider omitted comes
// back as "" (see gamesData's `rec`/`records[0].summary`), which rendered as an
// invisible gap -- an em dash says "not published" instead.
function MatchupSubline({ game, showScore }) {
  const dash = (v) => (v === "" || v == null ? "—" : v);
  const text = showScore
    ? `${dash(game.away.score)} : ${dash(game.home.score)}`
    : `${dash(game.away.record)} · ${dash(game.home.record)}`;
  return (
    <div className="pp-mono tnum" style={{
      fontSize: 12.5, color: "var(--dim-strong)", marginTop: 5, whiteSpace: "nowrap",
    }}>
      {text}
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

// Column template, shared by the header and every row so they cannot drift.
// The handoff's own template for this table. Fixed at its design widths with
// the props column taking the slack, rather than four fr weights -- the
// matchup and research columns hold fixed content and were stretching with
// the window while the sentence in the middle stayed cramped.
const SLATE_COLS = "minmax(240px, 300px) 168px minmax(0, 1fr) 128px";

// What the reader gets by opening this row. The destination is already decided
// by opensGamecast, so the label can name it without any new data.
function researchLabel(game) {
  if (game.isFinal) return "RECAP →";
  if (opensGamecast(game.status)) return "GAMECAST →";
  return "OPEN →";
}

function GameRow({ game, isMobile, onSelect, isLast, expanded, getPropsCount }) {
  const open = () => onSelect(game);
  const showScore = (game.isLive || game.isFinal) && (game.away.score != null || game.home.score != null);
  const center = statusCenterContent(game, isMobile);
  const muted = game.isFinal;
  // Sync, no fetch -- see getPropsCountForGame's own note on why this is a
  // count of props the game could offer, not a count of feed rows.
  const propsCount = getPropsCount ? getPropsCount(game.sport, game.away.abbr, game.home.abbr) : null;

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
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr auto" : SLATE_COLS,
        alignItems: "center", gap: isMobile ? 10 : 14,
        padding: isMobile ? "14px 16px" : "17px 26px",
        borderBottom: isLast ? "none" : "1px solid var(--line)",
        // Finals recede rather than disappear -- the reference dims the whole
        // row instead of restyling it.
        opacity: muted ? 0.6 : 1,
        // The open row takes --surface-2, so the panel below it reads as
        // belonging to this game rather than floating under the list.
        background: expanded ? 'var(--surface-2)' : undefined,
        boxSizing: "border-box",
        transition: "opacity 0.2s ease, background 0.2s ease",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          <span className="pp-display" style={{
            fontSize: isMobile ? 17 : 20, color: "var(--text)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {game.away.name}
          </span>
          <span className="pp-mono" style={{ fontSize: 11, color: "var(--dim)", flexShrink: 0 }}>at</span>
          <span className="pp-display" style={{
            fontSize: isMobile ? 17 : 20, color: "var(--text)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {game.home.name}
          </span>
        </div>
        <MatchupSubline game={game} showScore={showScore} />
      </div>

      <div className="pp-mono tnum" style={{
        display: "flex", alignItems: "center", gap: 7,
        fontSize: isMobile ? 12 : 13,
        color: center.live ? "var(--accent-text)" : "var(--dim-strong)",
        whiteSpace: "nowrap",
      }}>
        {center.live && (
          <span style={{
            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
            // Green, not the accent: a live dot is a state, and the accent
            // can be re-tinted to any hue including one that reads as dead.
            background: "var(--pos)",
            animation: "gm-live-pulse 1.6s ease-out infinite",
          }} />
        )}
        {center.primary}
        {center.secondary && center.live && ` · ${center.secondary}`}
      </div>

      {!isMobile && (
        <div style={{ fontSize: 13, color: "var(--dim-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {/* Absent rather than "0 props" when the count function isn't
               wired for this sport (see getPropsCountForGame -- only
               mlb/wnba/nfl are supported, matching gamesData.js's own
               SPORTS list). */}
          {Number.isFinite(propsCount) && propsCount > 0
            ? <span className="pp-mono">{propsCount} PROPS →</span>
            : null}
        </div>
      )}

      {!isMobile && (
        <div className="pp-mono" style={{
          textAlign: "right", fontSize: 11.5, letterSpacing: "0.1em",
          color: muted ? "var(--dim)" : "var(--accent-text)", whiteSpace: "nowrap",
        }}>
          {researchLabel(game)}
        </div>
      )}
    </div>
  );
}

export default function GamesPage({ onViewProps, getTopProps, getPropsCount, onOpenProp }) {
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
  // null means "not loaded yet", [] means "loaded, genuinely no games". Both
  // used to be filled with a fabricated slate first -- mockNflWeekOne() and
  // mockGames() -- so the page opened on invented matchups and hardcoded
  // team records, and only swapped to real data once the fetch answered. A
  // brief flash of invented records is still invented records on screen.
  const [nflWeek, setNflWeek] = useState(null);
  const [dayGames, setDayGames] = useState(null);
  const [pickedKey, setPickedKey] = useState(null);
  // A failed fetch is its own answer. It used to be coerced to [] , so losing
  // the network and a genuinely empty day both printed "No games scheduled for
  // this date" -- the screen stated a fact it had no way to know. Held per
  // sport+date so switching tabs clears it naturally.
  const [loadError, setLoadError] = useState(null);
  const pollRef = useRef(null);

  // `.games` -- the slate fetchers answer { games, unreadable }, and this
  // builds the NFL date tabs from the kickoff days its games actually contain.
  const tabs = useMemo(() => buildDateTabs(sport, nflWeek?.games), [sport, nflWeek]);

  // Deriving the active key rather than storing it means switching sports
  // can't strand a selection on a date tab the new sport doesn't have.
  const activeKey = useMemo(() => {
    if (pickedKey && tabs.some((t) => t.key === pickedKey)) return pickedKey;
    return sport === "nfl" ? tabs[0]?.key : dayKey(new Date());
  }, [pickedKey, tabs, sport]);

  // Per-day game counts for the date tabs (card 22's "Sun 16 / 12 GAMES").
  // NFL's whole Week 1 is already loaded in `nflWeek`, so its counts are a
  // synchronous filter -- no extra fetch. MLB/WNBA only ever load the active
  // day's slate, so their other visible tabs need their own fetch; bounded to
  // the tabs actually on screen (4), and reusing the same cached, TTL'd
  // fetchMlbSlate/fetchWnbaSlate every other part of this page already calls,
  // so a tab's count and its games can never disagree about what "today"
  // returned. `undefined` (not 0) while a count hasn't resolved yet, so a
  // slow tab reads as unknown rather than claiming zero games.
  const nflTabCounts = useMemo(() => {
    if (sport !== "nfl" || !nflWeek?.games) return {};
    const counts = {};
    tabs.forEach((t) => {
      counts[t.key] = nflWeek.games.filter((g) => dayKey(new Date(g.startsAt)) === t.key).length;
    });
    return counts;
  }, [sport, nflWeek, tabs]);

  const [liveTabCounts, setLiveTabCounts] = useState({});
  useEffect(() => {
    if (sport === "nfl") return undefined;
    let cancelled = false;
    setLiveTabCounts({});
    const fetcher = sport === "mlb" ? fetchMlbSlate : fetchWnbaSlate;
    tabs.forEach((t) => {
      fetcher(t.key).then((res) => {
        if (cancelled) return;
        setLiveTabCounts((prev) => ({ ...prev, [t.key]: res ? res.games.length : null }));
      });
    });
    return () => { cancelled = true; };
  }, [sport, tabs]);

  const tabCounts = sport === "nfl" ? nflTabCounts : liveTabCounts;

  // The one slate loader. Every path into the data -- mount, sport switch,
  // date switch, the live poller and the retry control -- goes through here,
  // so the retry cannot drift from the load it is retrying.
  //
  // Each fetcher answers { games, unreadable } or null for a failure (see the
  // note above fetchMlbSlate). `silent` is the poller: it must never blank the
  // list or raise an error banner over a slate that is already on screen, so a
  // failed poll just leaves the last good answer alone.
  const loadSlate = React.useCallback((s, key, { silent = false } = {}) => {
    const opts = { force: silent }; // polling always bypasses short TTL
    if (s === "nfl") {
      if (!silent) { setNflWeek(null); setLoadError(null); }
      return fetchNflWeekOneSlate(opts).then((res) => {
        if (res) setNflWeek(res);
        else if (!silent) setLoadError("nfl");
        return res;
      });
    }
    if (!key) return Promise.resolve(null);
    if (!silent) { setDayGames(null); setLoadError(null); }
    const load = s === "mlb" ? fetchMlbSlate(key, opts) : fetchWnbaSlate(key, opts);
    return load.then((res) => {
      if (res) setDayGames(res);
      else if (!silent) setLoadError(key);
      return res;
    });
  }, []);

  useEffect(() => {
    if (sport !== "nfl") return undefined;
    let cancelled = false;
    setNflWeek(null);
    setLoadError(null);
    fetchNflWeekOneSlate().then((res) => {
      if (cancelled) return;
      if (res) setNflWeek(res);
      else setLoadError("nfl");
    });
    return () => { cancelled = true; };
  }, [sport]);

  // Loading first, then whatever the feed actually returns. An empty games
  // array is a real answer ("no games today"); null from the fetcher is a
  // failure and gets its own state, not an empty slate.
  useEffect(() => {
    if (sport === "nfl" || !activeKey) return undefined;
    let cancelled = false;
    setDayGames(null);
    setLoadError(null);
    const load = sport === "mlb" ? fetchMlbSlate(activeKey) : fetchWnbaSlate(activeKey);
    load.then((res) => {
      if (cancelled) return;
      if (res) setDayGames(res);
      else setLoadError(activeKey);
    });
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
      ? (nflWeek?.games || []).filter((g) => dayKey(new Date(g.startsAt)) === activeKey)
      : (dayGames?.games || []);
    const needsPoll = base.some((g) => isActiveStatus(g.status));

    clearPoll();
    if (needsPoll) {
      // 20s is a reasonable balance for scoreboard data without hammering.
      pollRef.current = setInterval(tick, 20_000);
    }
    return clearPoll;
  }, [sport, activeKey, dayGames, nflWeek, loadSlate]);

  const slate = sport === "nfl" ? nflWeek : dayGames;
  const slateFailed = !!loadError;
  const slateLoading = slate === null && !slateFailed;
  // Games the feed returned that could not be built into a row. Surfaced at the
  // foot of the table rather than hidden -- see the footer below.
  const unreadable = slate?.unreadable || 0;
  const games = useMemo(() => {
    const base = sport === "nfl"
      ? (nflWeek?.games || []).filter((g) => dayKey(new Date(g.startsAt)) === activeKey)
      : (dayGames?.games || []);
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
    const base = (sport === "nfl" ? nflWeek?.games : dayGames?.games) || [];
    return base.find((g) => g.id === selectedId) || selectedSnap.current;
  }, [selectedId, sport, nflWeek, dayGames]);

  // Re-runs the same loader the effects run, so the retry cannot diverge from
  // the load it is retrying. Clearing the error first puts the screen back into
  // its loading state, which is what stops a failed retry from looking like a
  // successful empty day. Slate failures are not cached (see gamesData), so
  // this really does go back to the network.
  const retry = React.useCallback(() => {
    setLoadError(null);
    loadSlate(sport, activeKey);
  }, [loadSlate, sport, activeKey]);

  const subtitle = useMemo(() => {
    if (sport === "nfl") return "NFL Week 1";
    const d = activeKey ? new Date(`${activeKey}T12:00:00`) : new Date();
    return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  }, [sport, activeKey]);


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
      counts={tabCounts}
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

      <div style={{ padding: isMobile ? "12px 0 0" : "12px 0 0" }}>
        {games.length > 0 && !isMobile && (
          <div className="pp-mono" style={{
            display: "grid", gridTemplateColumns: SLATE_COLS, alignItems: "center",
            padding: "11px 26px", borderBottom: "1px solid var(--line)",
            fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)",
          }}>
            <span>Matchup</span>
            <span>Kickoff</span>
            <span>Props worth a look</span>
            <span style={{ textAlign: "right" }}>Research</span>
          </div>
        )}

        {games.map((g, i) => (
          <React.Fragment key={g.id}>
            <GameRow
              game={g}
              isMobile={isMobile}
              isLast={i === games.length - 1 && g.id !== selectedId}
              expanded={g.id === selectedId}
              onSelect={(picked) => {
                // Toggle, not navigate. The gamecast folds in under the row it
                // belongs to (design screen 4) instead of replacing the page,
                // so the slate stays on screen and closing is one click on the
                // same row rather than a back button and a re-scroll.
                if (picked.id === selectedId) { selectedSnap.current = null; setSelectedId(null); return; }
                selectedSnap.current = picked;
                setSelectedId(picked.id);
              }}
              getPropsCount={getPropsCount}
            />
            {g.id === selectedId && (
              <div style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line)' }}>
                {/* A game that goes live while its Matchup Overview is open
                    swaps to the Gamecast on the next poll, which is the intent
                    -- the pre-game view has nothing left to say once the first
                    pitch is thrown. */}
                {React.createElement(opensGamecast(g.status) ? GamecastPage : MatchupPage, {
                  game: selected || g,
                  isMobile,
                  embedded: true,
                  onBack: () => { selectedSnap.current = null; setSelectedId(null); },
                  onViewProps,
                  getTopProps,
                  onOpenProp,
                })}
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Four distinct states, because they mean four different things:
             still fetching, the fetch failed, fetched and genuinely empty, and
             filtered to nothing by the search box. The failure used to be
             coerced into the third, so a dropped connection claimed there were
             no games today. */}
        {games.length === 0 && (
          <div style={{ padding: 28, textAlign: "center", color: "var(--dim)", fontSize: 14 }}>
            {slateFailed ? (
              <>
                <div style={{ color: "var(--text)", marginBottom: 12 }}>
                  Couldn&rsquo;t load {sport === "nfl" ? "the Week 1 slate" : "today’s slate"}.
                </div>
                <div
                  className="gm-tab pp-mono"
                  role="button"
                  tabIndex={0}
                  onClick={retry}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); retry(); } }}
                  style={{
                    display: "inline-block", padding: "9px 18px", cursor: "pointer",
                    border: "1px solid var(--line-strong)", color: "var(--text)",
                    fontSize: 11.5, letterSpacing: "0.1em",
                  }}
                >
                  RETRY
                </div>
              </>
            ) : query ? (
              "No games match that search."
            ) : slateLoading ? (
              "Loading today’s slate…"
            ) : (
              "No games scheduled for this date."
            )}
          </div>
        )}
      </div>

      {/* One disclaimer for the screen, at the foot of the table.
           The unreadable count lives here too rather than in a banner over the
           rows: what it qualifies is the list directly above it, the same place
           a table footnote would go, and a banner would push the games down and
           read as an alert about the whole page. */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        flexWrap: "wrap",
        padding: isMobile ? "16px" : "18px 28px",
        borderTop: "1px solid var(--line)",
        background: isMobile ? "transparent" : "var(--surface-sunken)",
      }}>
        <span style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.55, maxWidth: 620 }}>
          {unreadable > 0 && (
            <span style={{ color: "var(--text)" }}>
              {unreadable} {unreadable === 1 ? "game" : "games"} couldn&rsquo;t be read and {unreadable === 1 ? "is" : "are"} not listed.{" "}
            </span>
          )}
          Hit rates count finished games only, and every rate shows how many games it came
          from. A research tool — no picks, no wagers.
        </span>
        <a
          href="https://www.ncpgambling.org/help-treatment/"
          target="_blank"
          rel="noopener noreferrer"
          className="pp-mono"
          style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--accent-text)", textDecoration: "none", whiteSpace: "nowrap" }}
        >
          RESPONSIBLE GAMBLING →
        </a>
      </div>
      </div>
    </div>
  );
}
