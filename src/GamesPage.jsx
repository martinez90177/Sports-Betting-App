import React, { useEffect, useMemo, useState, useRef } from "react";
import MatchupPage from "./MatchupPage.jsx";
import GamecastPage from "./GamecastPage.jsx";
import GameCard, { StateSwatch } from "./GameCard.jsx";
import { useIsPhone } from "./lib/useIsNarrow.js";
import GamesMobile from "./v3/GamesMobile.jsx";
import {
  SPORTS, dayKey, timeLabel, buildDateTabs,
  fetchMlbSlate, fetchWnbaSlate, fetchNflWeekOneSlate, fetchNbaSlate, fetchNbaOpenerDay,
  MONTH_SHORT,
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

// The All tab: one calendar day across every league.
//
// Deliberately NOT "every league's own model at once". A week means something
// in football and nothing in baseball, and an opening-night tab is an NBA
// idea, so there is no shared control that could drive all four. A calendar
// day is the one thing that means the same in every sport, so All is a plain
// date stepper and each league tab keeps its own native model untouched --
// NFL weeks, the NBA opener tab, MLB and WNBA days.
//
// The cost is that "week 11 across all sports" cannot be asked from here,
// which is the right trade: week 11 does not exist in baseball.
const ALL_SPORT = { id: "all", label: "All" };
const ALL_SPORTS_TABS = [ALL_SPORT, ...SPORTS];

// The sport identity family (see index.css). Low-chroma neutrals that collide
// with no game-state or outcome colour, so a divider can carry a league's
// identity without reading as a status.
const SPORT_TONE = {
  mlb: "var(--sport-mlb)",
  nfl: "var(--sport-nfl)",
  nba: "var(--sport-nba)",
  wnba: "var(--sport-wnba)",
};

const LEAGUE_MARK = {
  mlb: "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
  wnba: "https://a.espncdn.com/i/teamlogos/leagues/500/wnba.png",
  nfl: "https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png",
  nba: "https://a.espncdn.com/i/teamlogos/leagues/500/nba.png",
};

// The day-slate sports: one fetch per date, same shape, differing only in
// endpoint. NFL is absent because it is a week competition and loads its whole
// slate at once. A lookup rather than the chain of ternaries this replaced --
// there were three of them, and adding a fourth sport meant finding all three.
const DAY_SLATE = {
  mlb: fetchMlbSlate,
  wnba: fetchWnbaSlate,
  nba: fetchNbaSlate,
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

function SportTabs({ sport, onChange, isMobile, options = SPORTS }) {
  return (
    <div className="gm-scroll-x" style={{ gap: isMobile ? 10 : 8, padding: isMobile ? "0 14px 2px" : 0 }}>
      {options.map((s) => {
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
            {LEAGUE_MARK[s.id] && (
              <img
                src={LEAGUE_MARK[s.id]}
                alt=""
                width={isMobile ? 19 : 16}
                height={isMobile ? 19 : 16}
                style={{ objectFit: "contain", opacity: active ? 1 : 0.45 }}
              />
            )}
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
      {/* Not "Search players or teams" as the file writes it. The file's nav
          carries no search of its own; this app's does, and it searches
          players app-wide -- two boxes one above the other both promising
          players would be the same control twice. This one filters the slate
          on screen, and says so. */}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter teams"
        aria-label="Filter the slate by team"
        style={{
          flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
          color: "var(--text)", fontSize: isMobile ? 15.5 : 13, fontFamily: "inherit",
        }}
      />
    </div>
  );
}

// Strip and rail type, off `PropPalace Games v2.dc.html` -- the same pair the
// Board and Prop Feed strips use.
const GM_CELL_LABEL = { fontFamily: "'PP At', 'Space Mono', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--dim)", whiteSpace: "nowrap" };
const GM_CELL_VALUE = { fontFamily: "'PP At', 'Space Mono', monospace", fontSize: 15, marginTop: 6, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const GM_RAIL_LABEL = { fontFamily: "'PP At', 'Space Mono', monospace", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" };
const LEGEND_ROW = { display: "flex", alignItems: "center", gap: 9, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-2)" };

// How many cards the slate opens with, the rest behind one button.
const VISIBLE_GAMES = 5;

// The left rail's Show filter. The third entry is the status whose swatch
// stands for the whole group -- one square per filter, not one per status.
const STATE_FILTERS = [
  ["all", "All games", null],
  ["live", "Live", GAME_STATUS.LIVE],
  ["pre", "Scheduled", GAME_STATUS.UPCOMING],
  ["final", "Final", GAME_STATUS.FINAL],
];

// The right rail's legend: four hues over nine states, told apart by fill.
const STATE_LEGEND = [
  ["Live · halftime", GAME_STATUS.LIVE],
  ["Starting soon", GAME_STATUS.STARTING_SOON],
  ["Scheduled", GAME_STATUS.UPCOMING],
  ["Delayed · suspended", GAME_STATUS.DELAYED],
  ["Final", GAME_STATUS.FINAL],
];

export default function GamesPage({ onViewProps, getTopProps, getPropsCount, onOpenProp, onOpenBoard, slipLegs = [] }) {
  const isMobile = useIsNarrow(720);
  const isPhone = useIsPhone();
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
  // The merged slate for the All tab: every league's games for one calendar
  // day. Held separately from dayGames so switching between All and a league
  // never shows one's slate under the other's heading.
  const [allDayGames, setAllDayGames] = useState(null);
  const [pickedKey, setPickedKey] = useState(null);
  // A failed fetch is its own answer. It used to be coerced to [] , so losing
  // the network and a genuinely empty day both printed "No games scheduled for
  // this date" -- the screen stated a fact it had no way to know. Held per
  // sport+date so switching tabs clears it naturally.
  const [loadError, setLoadError] = useState(null);
  const pollRef = useRef(null);

  // Opening night, when the NBA season has not started yet. Null the rest of
  // the year, and null for every other sport.
  //
  // This is the offseason problem the prop feed also has, answered differently
  // because the page is different: the feed researches props and can honestly
  // lead with a slate two months out, while this page answers "what is on now"
  // and must not put "no games today" and a full card on the same screen. So
  // the opener becomes an extra date *tab* -- labelled with its own date, next
  // to a Today tab that still says nothing is on -- rather than a substitution.
  const [nbaOpenerKey, setNbaOpenerKey] = useState(null);
  useEffect(() => {
    if (sport !== "nba") { setNbaOpenerKey(null); return undefined; }
    let cancelled = false;
    fetchNbaOpenerDay().then((day) => {
      if (cancelled || !day) return;
      // Only ahead of us. Mid-season this resolves to a date already played,
      // and a tab pointing back at October would be worse than no tab.
      if (day > dayKey(new Date())) setNbaOpenerKey(day);
    });
    return () => { cancelled = true; };
  }, [sport]);

  // `.games` -- the slate fetchers answer { games, unreadable }, and this
  // builds the NFL date tabs from the kickoff days its games actually contain.
  const tabs = useMemo(() => {
    // All is a plain date stepper: yesterday, today, and the next three days.
    // No week tabs, no opening-night tab -- those are league-specific ideas
    // and this view spans four leagues, so the only honest axis is the date.
    if (sport === ALL_SPORT.id) {
      const out = [];
      for (let i = -1; i <= 3; i += 1) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const key = dayKey(d);
        out.push({
          key,
          label: i === 0 ? "Today" : `${MONTH_SHORT[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`,
          // The weekday under every tab, the way the single-league tabs
          // already read. This was dayLabel, which answers relative to today
          // -- so the row ran "AUG 21 · TODAY · TOMORROW · MONDAY · TUESDAY",
          // repeating the label above it on two of the five and switching
          // vocabulary halfway along.
          sub: d.toLocaleDateString([], { weekday: "long" }),
        });
      }
      return out;
    }
    const base = buildDateTabs(sport, nflWeek?.games);
    if (!nbaOpenerKey || base.some((t) => t.key === nbaOpenerKey)) return base;
    const d = new Date(`${nbaOpenerKey}T12:00:00`);
    return [...base, {
      key: nbaOpenerKey,
      label: `${MONTH_SHORT[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`,
      sub: "Opening night",
    }];
  }, [sport, nflWeek, nbaOpenerKey]);

  // Deriving the active key rather than storing it means switching sports
  // can't strand a selection on a date tab the new sport doesn't have.
  const activeKey = useMemo(() => {
    if (pickedKey && tabs.some((t) => t.key === pickedKey)) return pickedKey;
    if (sport === ALL_SPORT.id) return dayKey(new Date());
    if (sport === "nfl") return tabs[0]?.key;
    // Offseason: open on the date that has games rather than on an empty
    // today. The tab is labelled with its own date, so this reads as a
    // selection the reader can see and change, not as a claim about today.
    if (nbaOpenerKey) return nbaOpenerKey;
    return dayKey(new Date());
  }, [pickedKey, tabs, sport, nbaOpenerKey]);

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
    // No per-tab counts on All. There is no single fetcher for it, and
    // filling five date tabs would mean twenty requests across four leagues
    // to label a row of tabs -- the day's own count under the title already
    // says how many games there are once a day is chosen.
    if (sport === "nfl" || sport === ALL_SPORT.id) return undefined;
    let cancelled = false;
    setLiveTabCounts({});
    const fetcher = DAY_SLATE[sport];
    tabs.forEach((t) => {
      fetcher(t.key).then((res) => {
        if (cancelled) return;
        setLiveTabCounts((prev) => ({ ...prev, [t.key]: res ? res.games.length : null }));
      });
    });
    return () => { cancelled = true; };
  }, [sport, tabs]);

  // No counts on All, and explicitly empty rather than whatever the previous
  // league left behind: liveTabCounts still holds MLB's numbers after a switch
  // to All, and a date tab reading "15 GAMES" there would be counting one
  // league under a heading that means four.
  const tabCounts = sport === ALL_SPORT.id ? {} : sport === "nfl" ? nflTabCounts : liveTabCounts;

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
    // The poller and the retry control both come through here. Neither has
    // a single fetcher to call on All, whose own effect owns that slate.
    if (s === ALL_SPORT.id || !key || !DAY_SLATE[s]) return Promise.resolve(null);
    if (!silent) { setDayGames(null); setLoadError(null); }
    const load = DAY_SLATE[s](key, opts);
    return load.then((res) => {
      if (res) setDayGames(res);
      else if (!silent) setLoadError(key);
      return res;
    });
  }, []);

  // All: one day, four leagues, fetched together. NFL is a week competition
  // so its whole slate is loaded and filtered to the day, the same thing the
  // NFL tab's own games memo does -- there is no per-day NFL endpoint to call.
  //
  // A league that fails to load is left out rather than being reported as
  // having no games: those are different claims, and unreadable counts the
  // ones that could not be read so the summary can say so.
  useEffect(() => {
    if (sport !== ALL_SPORT.id || !activeKey) return undefined;
    let cancelled = false;
    setAllDayGames(null);
    setLoadError(null);
    Promise.all([
      fetchMlbSlate(activeKey).catch(() => null),
      fetchWnbaSlate(activeKey).catch(() => null),
      fetchNbaSlate(activeKey).catch(() => null),
      fetchNflWeekOneSlate().catch(() => null),
    ]).then(([mlb, wnba, nba, nfl]) => {
      if (cancelled) return;
      const nflToday = (nfl?.games || []).filter((g) => dayKey(new Date(g.startsAt)) === activeKey);
      const merged = [
        ...(mlb?.games || []),
        ...(wnba?.games || []),
        ...(nba?.games || []),
        ...nflToday,
      ];
      const failed = [mlb, wnba, nba, nfl].filter((r) => !r).length;
      setAllDayGames({ games: merged, unreadable: failed });
    });
    return () => { cancelled = true; };
  }, [sport, activeKey]);

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
    // All has its own merged loader above; this one is the single-league path.
    if (sport === "nfl" || sport === ALL_SPORT.id || !activeKey) return undefined;
    let cancelled = false;
    setDayGames(null);
    setLoadError(null);
    const load = DAY_SLATE[sport](activeKey);
    load.then((res) => {
      if (cancelled) return;
      if (res) setDayGames(res);
      else setLoadError(activeKey);
    });
    return () => { cancelled = true; };
  }, [sport, activeKey]);

  // The one place the viewed slate is resolved, and the one place that knows
  // each sport answers a different question: All merges four leagues for one
  // calendar day, NFL loads a whole week and filters it down to the open date
  // tab, everything else is already a single day's fetch.
  //
  // Four call sites below used to re-derive this themselves from an identical
  // `const base = sport === "nfl" ? ...` expression, and identical twins are
  // exactly how the All tab shipped broken: an edit meant for the `games`
  // memo matched the poller's copy of the same text instead, so the poller
  // learned about All and the list didn't, and the view kept rendering
  // whichever single league had been visited last. Two of the other twins
  // never learned about All at all -- `slate` still read the previous
  // league's `dayGames` for its loading and unreadable counts, and `selected`
  // resolved against it too, so a game opened from the All tab stopped
  // tracking the live poller. Keep this the only definition.
  const slate = sport === ALL_SPORT.id ? allDayGames : sport === "nfl" ? nflWeek : dayGames;
  const slateGames = useMemo(() => {
    if (sport === ALL_SPORT.id) return allDayGames?.games || [];
    if (sport === "nfl") {
      return (nflWeek?.games || []).filter((g) => dayKey(new Date(g.startsAt)) === activeKey);
    }
    return dayGames?.games || [];
  }, [sport, nflWeek, dayGames, allDayGames, activeKey]);

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

    const needsPoll = slateGames.some((g) => isActiveStatus(g.status));

    clearPoll();
    if (needsPoll) {
      // 20s is a reasonable balance for scoreboard data without hammering.
      pollRef.current = setInterval(tick, 20_000);
    }
    return clearPoll;
  }, [sport, activeKey, slateGames, loadSlate]);

  const slateFailed = !!loadError;
  const slateLoading = slate === null && !slateFailed;
  // Games the feed returned that could not be built into a row. Surfaced at the
  // foot of the table rather than hidden -- see the footer below.
  const unreadable = slate?.unreadable || 0;
  const games = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = slateGames;
    if (q) {
      list = slateGames.filter((g) =>
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
  }, [slateGames, query]);

  // Re-resolved from the slate on every render, so the open page tracks the
  // poller's fresh status/score/periodLabel with no extra fetch of its own.
  // Searched against `slateGames`, which the search box does not filter:
  // typing must not pull the game out from under an open page. The snapshot
  // still backs it up for a game that leaves the slate entirely.
  const selected = useMemo(() => {
    if (!selectedId) return null;
    return slateGames.find((g) => g.id === selectedId) || selectedSnap.current;
  }, [selectedId, slateGames]);

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
    if (nbaOpenerKey && activeKey === nbaOpenerKey) {
      const d = new Date(`${activeKey}T12:00:00`);
      return `Opening night · ${d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}`;
    }
    const d = activeKey ? new Date(`${activeKey}T12:00:00`) : new Date();
    return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  }, [sport, activeKey]);


  // ---- The v2 shell (PropPalace Games v2.dc.html) --------------------------
  //
  // 196px | 1fr | 196px, the same three columns the Board and the Prop Feed
  // use. The centre is a stack of game cards grouped by sport, not the
  // four-column table this screen used to be, and a card opens its own compact
  // gamecast in place rather than unfolding the full page underneath.

  // The left rail's second control, which the table had no equivalent of:
  // where a game is in its life. Independent of the league picker, because
  // "every live game today" is a real question and used to be unaskable.
  const [stateFilter, setStateFilter] = useState("all");
  // The file lists five and puts the rest behind a button.
  const [showAll, setShowAll] = useState(false);
  // One card open at a time, tracked by id rather than by the object captured
  // at click time -- the poller replaces the slate objects every 20s.
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => games.filter((g) => {
    const st = g.status || GAME_STATUS.UPCOMING;
    if (stateFilter === "live") return isActiveStatus(st);
    if (stateFilter === "pre") return st === GAME_STATUS.UPCOMING || st === GAME_STATUS.STARTING_SOON;
    if (stateFilter === "final") return st === GAME_STATUS.FINAL;
    return true;
  }), [games, stateFilter]);

  const shown = showAll ? filtered : filtered.slice(0, VISIBLE_GAMES);

  // Grouped by sport with a labelled divider, on every league not just All --
  // an MLB card and an NFL card in one undifferentiated stack is a real
  // misread, since their linescores, markets and state vocabulary all differ.
  // On a single-league slate that is one heading over the whole list, which is
  // what the file draws there too.
  const groups = useMemo(() => SPORTS
    .map((sp) => ({ ...sp, games: shown.filter((g) => g.sport === sp.id) }))
    .filter((grp) => grp.games.length), [shown]);

  const liveCount = filtered.filter((g) => isActiveStatus(g.status)).length;
  const finalCount = filtered.filter((g) => g.status === GAME_STATUS.FINAL).length;
  const nextStart = filtered
    .filter((g) => g.startsAt && !isActiveStatus(g.status) && g.status !== GAME_STATUS.FINAL)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];

  const v2Strip = (
    <div style={{
      display: "flex", alignItems: "center", gap: 0, marginTop: 14,
      background: "var(--surface-sunken)", border: "1px solid var(--line)",
      borderRadius: 6, overflow: "hidden",
    }}>
      <div style={{ flex: 1, minWidth: 0, padding: "11px 16px" }}>
        <div style={GM_CELL_LABEL}>Showing</div>
        <div style={GM_CELL_VALUE}>
          {filtered.length === games.length
            ? `${games.length} ${games.length === 1 ? "game" : "games"}`
            : `${filtered.length} of ${games.length}`}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: "11px 16px", borderLeft: "1px solid var(--line)" }}>
        <div style={GM_CELL_LABEL}>In progress</div>
        <div style={{ ...GM_CELL_VALUE, color: liveCount ? "var(--state-live)" : "var(--text-2)" }}>{liveCount}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: "11px 16px", borderLeft: "1px solid var(--line)" }}>
        <div style={GM_CELL_LABEL}>Final</div>
        <div style={GM_CELL_VALUE}>{finalCount}</div>
      </div>
      <div style={{ flex: 1.3, minWidth: 0, padding: "11px 16px", borderLeft: "1px solid var(--line)" }}>
        <div style={GM_CELL_LABEL}>Next start</div>
        {/* The next one that has not started, by its own clock. Nothing left
            to start is an em dash, not a blank. */}
        <div style={GM_CELL_VALUE}>{nextStart ? timeLabel(nextStart.startsAt) : "—"}</div>
      </div>
    </div>
  );

  const stateChips = (
    <div style={{ display: "flex", flexDirection: isMobile ? "row" : "column", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
      {STATE_FILTERS.map(([id, label, st]) => {
        const on = stateFilter === id;
        return (
          <span
            key={id}
            role="button"
            tabIndex={0}
            onClick={() => { setStateFilter(id); setShowAll(false); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setStateFilter(id); setShowAll(false); } }}
            className="pp-mono"
            style={{
              display: "flex", alignItems: "center", gap: 9, fontSize: 11, letterSpacing: "0.08em",
              textTransform: "uppercase", padding: "8px 11px", borderRadius: 6, cursor: "pointer",
              background: on ? "var(--amber-dim)" : "transparent",
              color: on ? "var(--amber-ink)" : "var(--text-2)",
              border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
            }}
          >
            {/* "All games" carries no state swatch -- it is the absence of a
                filter, not a state, and giving it one made the four read
                alike. */}
            {st && <StateSwatch status={st} />}
            {label}
          </span>
        );
      })}
    </div>
  );

  const v2LeftRail = (
    <div>
      <div style={GM_RAIL_LABEL}>League</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
        {ALL_SPORTS_TABS.map((o) => {
          const on = sport === o.id;
          // A count only where there is one to give. Switching league refetches
          // an entirely different slate, so while MLB is loaded this page knows
          // nothing about tonight's NFL card -- and a "0" there would state
          // that there are none, which is exactly what it cannot know.
          const known = sport === ALL_SPORT.id || o.id === sport || o.id === ALL_SPORT.id;
          const n = o.id === ALL_SPORT.id ? games.length : games.filter((g) => g.sport === o.id).length;
          return (
            <div
              key={o.id}
              role="button"
              tabIndex={0}
              onClick={() => { setSport(o.id); setPickedKey(null); setShowAll(false); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSport(o.id); setPickedKey(null); setShowAll(false); } }}
              style={{
                display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
                padding: "9px 11px", borderRadius: 6, cursor: "pointer",
                background: on ? "var(--amber-dim)" : "transparent",
                border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
              }}
            >
              <span className="pp-mono" style={{ fontSize: 11.5, letterSpacing: "0.1em", color: on ? "var(--amber-ink)" : "var(--text-2)" }}>{o.label}</span>
              <span className="pp-mono tnum" style={{ fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>
                {known ? (n === 0 ? "none" : `${n} ${n === 1 ? "game" : "games"}`) : ""}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ ...GM_RAIL_LABEL, marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)" }}>Show</div>
      {stateChips}

      <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.04em", color: "var(--dim)", marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)", lineHeight: 1.6 }}>
        Live state comes from the provider, never from the clock. Hit rates count
        finished games only.
      </div>
    </div>
  );

  const v2RightRail = (
    <div>
      <div style={GM_RAIL_LABEL}>Game state</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {STATE_LEGEND.map(([label, st]) => (
          <span key={label} className="pp-mono" style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-2)" }}>
            <StateSwatch status={st} />
            {label}
          </span>
        ))}
      </div>
      <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.04em", color: "var(--dim)", marginTop: 14, lineHeight: 1.6 }}>
        A game is only live when the provider says so &mdash; never inferred from the clock.
      </div>

      <div style={{ ...GM_RAIL_LABEL, marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)" }}>Props in play</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
        <span className="pp-mono" style={LEGEND_ROW}>
          <span style={{ width: 16, height: 9, borderRadius: 2, background: "var(--pos-solid)", flex: "none" }} />
          past the line
        </span>
        <span className="pp-mono" style={LEGEND_ROW}>
          <span style={{ width: 16, height: 9, borderRadius: 2, background: "var(--dim)", flex: "none" }} />
          still short
        </span>
        <span className="pp-mono" style={LEGEND_ROW}>
          <span style={{ width: 16, borderTop: "1.5px dashed var(--text)", flex: "none" }} />
          tonight&rsquo;s line
        </span>
      </div>
      <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.04em", color: "var(--dim)", marginTop: 14, lineHeight: 1.6 }}>
        A live bar is what has happened so far tonight, not a rate. It counts toward a
        hit rate only once the game is final.
      </div>

      <div style={{ ...GM_RAIL_LABEL, marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)" }}>Linescores</div>
      <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.04em", color: "var(--dim)", marginTop: 12, lineHeight: 1.7 }}>
        <div>MLB &mdash; innings, then R H E.</div>
        <div style={{ marginTop: 7 }}>NFL &middot; NBA &middot; WNBA &mdash; quarters, then T. Overtime adds OT1.</div>
        <div style={{ marginTop: 7 }}>A period not yet played stays blank, never a zero.</div>
      </div>
    </div>
  );

  // The full page is still reachable, from the foot of an open card: probable
  // starters, recent form and head to head before a game, the wide gamecast
  // after. Declared below every hook above, so opening one cannot change the
  // hook order.
  if (selectedId && selected) {
    return React.createElement(opensGamecast(selected.status) ? GamecastPage : MatchupPage, {
      game: selected,
      isMobile,
      onBack: () => { selectedSnap.current = null; setSelectedId(null); },
      onViewProps,
      getTopProps,
      onOpenProp,
      slipLegs,
    });
  }

  // Same slate, same poller, same statuses -- the phone's own layout.
  // See src/v3/GamesMobile.jsx. Declared after the full-page branch above so
  // opening a gamecast cannot change the hook order.
  if (isPhone) {
    const dow = (key) => {
      const d = new Date(`${key}T12:00:00`);
      return {
        dow: d.toLocaleDateString([], { weekday: "short" }).toUpperCase(),
        day: String(d.getDate()).padStart(2, "0"),
      };
    };
    return (
      <GamesMobile
        leagues={ALL_SPORTS_TABS}
        league={sport}
        onSetLeague={(id) => { setSport(id); setPickedKey(null); setShowAll(false); }}
        query={query}
        onSetQuery={(q) => { setQuery(q); setShowAll(false); }}
        dates={tabs.map((t) => ({ key: t.key, ...dow(t.key), count: tabCounts[t.key] ?? null }))}
        activeDate={activeKey}
        onSetDate={(k) => { setPickedKey(k); setShowAll(false); }}
        states={[
          { id: "all", label: "All games", tone: null },
          { id: "live", label: "Live", tone: "#ef5b5b" },
          { id: "pre", label: "Scheduled", tone: "var(--amber)" },
          { id: "final", label: "Final", tone: "var(--dim)" },
        ]}
        state={stateFilter}
        onSetState={(id) => { setStateFilter(id); setShowAll(false); }}
        slateHeading={`${sport === ALL_SPORT.id ? "ALL" : sport.toUpperCase()} · ${subtitle.toUpperCase()}`}
        games={shown.map((g) => {
          const live = isActiveStatus(g.status);
          const done = g.status === GAME_STATUS.FINAL;
          const aw = g.away || {}, hm = g.home || {};
          const lead = (live || done) && aw.score != null && hm.score != null
            ? (aw.score > hm.score ? "away" : hm.score > aw.score ? "home" : null)
            : null;
          return {
            id: g.id, sport: g.sport, live, done,
            statusLabel: live ? "LIVE" : done ? "FINAL" : "SCHEDULED",
            // The provider's own period label while live, the venue before it.
            // `venue` is an object here ({ name, city, indoor }), not a
            // string -- see espnSlate. Reading it as text put a React child
            // error on the whole page.
            meta: live ? (g.periodLabel || "In progress")
              : done ? (g.periodLabel || "Final")
                : ((g.venue && g.venue.name)
                  || (g.startsAt ? new Date(g.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "")),
            note: live ? "Live scoring from the provider."
              : done ? "Finished — props on this game are settled."
                : `${aw.full || aw.abbr} at ${hm.full || hm.abbr}`,
            cta: live ? "GAMECAST →" : done ? "SEE RESULTS →" : "MATCHUP →",
            teams: [
              { side: "away", abbr: aw.abbr, name: aw.name || aw.full, record: aw.record, score: live || done ? aw.score : null, winning: lead === "away" },
              { side: "home", abbr: hm.abbr, name: hm.name || hm.full, record: hm.record, score: live || done ? hm.score : null, winning: lead === "home" },
            ],
            raw: g,
          };
        })}
        moreCount={showAll ? filtered.length - VISIBLE_GAMES : Math.max(0, filtered.length - VISIBLE_GAMES)}
        showAll={showAll}
        onToggleShowAll={() => setShowAll((v) => !v)}
        loading={slateLoading}
        // Five states, because they mean five different things.
        emptyCopy={slateFailed
          ? "That slate could not be loaded. This is a network answer, not an empty day."
          : query
            ? "No games match that search."
            : slateGames.length === 0
              ? "No games scheduled for this date."
              : `No ${stateFilter === "live" ? "live" : stateFilter === "pre" ? "scheduled" : "finished"} games on this slate.`}
        onOpenGame={(g) => { selectedSnap.current = g.raw; setSelectedId(g.id); }}
        // Positional, matching the desktop card below: the helper takes
        // (sport, away, home), not a game.
        propsCountFor={(g) => (getPropsCount ? getPropsCount(g.sport, g.teams[0].abbr, g.teams[1].abbr) : null)}
      />
    );
  }

  const header = (
    <div style={{
      display: "flex", alignItems: "flex-end", gap: 20, flexWrap: isMobile ? "wrap" : "nowrap",
      padding: isMobile ? "14px 16px 0" : 0,
    }}>
      <div style={{ minWidth: 0 }}>
        <h1 className="pp-display" style={{
          margin: 0, fontWeight: 600, fontSize: isMobile ? 27 : 34, letterSpacing: "-0.02em", color: "var(--text)",
        }}>
          Games
        </h1>
        <div className="pp-mono" style={{
          fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)", marginTop: 7,
        }}>
          <span className="tnum">{filtered.length}</span>
          {` shown · ${subtitle}`}
          {onOpenBoard && (
            <>
              {" · "}
              <span
                role="button"
                tabIndex={0}
                onClick={onOpenBoard}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenBoard(); } }}
                style={{ color: "var(--accent-text)", cursor: "pointer" }}
              >
                The Board
              </span>
              {" has the research view"}
            </>
          )}
        </div>
      </div>
      <div style={{ marginLeft: isMobile ? 0 : "auto", flex: "none", width: isMobile ? "100%" : 240 }}>
        <GamesSearchBar value={query} onChange={setQuery} isMobile={isMobile} />
      </div>
    </div>
  );

  // Five distinct states, because they mean five different things: still
  // fetching, the fetch failed, fetched and genuinely empty, filtered to
  // nothing by the search box, and filtered to nothing by Show.
  const emptyState = (
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
      ) : query ? "No games match that search."
        : slateLoading ? "Loading today’s slate…"
        : games.length ? `No ${stateFilter === "live" ? "live" : stateFilter === "pre" ? "scheduled" : "finished"} games on this slate.`
        : "No games scheduled for this date."}
    </div>
  );

  return (
    <div style={isMobile ? { margin: "0 auto", padding: 0, boxSizing: "border-box" } : {
      display: "grid", gridTemplateColumns: "196px minmax(0, 1fr) 196px",
      gap: 20, padding: "20px 0 40px", alignItems: "start", boxSizing: "border-box",
    }}>
      {!isMobile && <div>{v2LeftRail}</div>}

      <div style={{ minWidth: 0 }}>
        {isMobile ? (
          <div className="gm-sticky">
            {header}
            <div style={{ padding: "12px 0 2px" }}>
              <SportTabs
                sport={sport}
                onChange={(s) => { setSport(s); setPickedKey(null); setShowAll(false); }}
                isMobile={isMobile}
                options={ALL_SPORTS_TABS}
              />
            </div>
            <DateTabs
              tabs={tabs}
              activeKey={activeKey}
              onChange={setPickedKey}
              isMobile={isMobile}
              caption={sport === "nfl" ? "Week 1" : null}
              counts={tabCounts}
            />
          </div>
        ) : (
          <>
            {header}
            <div className="gm-sticky">
              <DateTabs
                tabs={tabs}
                activeKey={activeKey}
                onChange={setPickedKey}
                isMobile={isMobile}
                caption={sport === "nfl" ? "Week 1" : null}
                counts={tabCounts}
              />
            </div>
            {v2Strip}
          </>
        )}

        {/* The rails are desktop only, so the phone keeps the Show filter as a
            chip row under the date tabs rather than losing the control. */}
        {isMobile && <div style={{ padding: "0 16px" }}>{stateChips}</div>}

        {shown.length === 0 ? emptyState : groups.map((grp) => {
          const live = grp.games.filter((g) => isActiveStatus(g.status)).length;
          return (
            <div key={grp.id} style={{ marginTop: 22, padding: isMobile ? "0 16px" : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, color: SPORT_TONE[grp.id] || "var(--text-2)" }}>
                  {/* The file draws a ball glyph here -- a circle for the
                      round-ball sports, an ellipse for the prolate one. The
                      real league mark says the same thing and the app already
                      holds it: the same substitution TeamLogo makes for the
                      file's lettered badges. */}
                  {LEAGUE_MARK[grp.id] && (
                    <img src={LEAGUE_MARK[grp.id]} alt="" width={15} height={15} style={{ objectFit: "contain", opacity: 0.75 }} />
                  )}
                  <span className="pp-mono" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    {grp.label}
                  </span>
                </span>
                <span className="pp-mono tnum" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                  {grp.games.length} {grp.games.length === 1 ? "game" : "games"}
                </span>
                <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
                <span className="pp-mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)", whiteSpace: "nowrap" }}>
                  {live ? `${live} in progress` : "none in progress"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                {grp.games.map((g) => (
                  <GameCard
                    key={g.id}
                    game={g}
                    sport={g.sport}
                    sportLabel={grp.label}
                    sportTone={SPORT_TONE[grp.id] || "var(--text-2)"}
                    isMobile={isMobile}
                    open={openId === g.id}
                    onToggle={() => setOpenId((cur) => (cur === g.id ? null : g.id))}
                    propsCount={getPropsCount ? getPropsCount(g.sport, g.away.abbr, g.home.abbr) : null}
                    getTopProps={getTopProps}
                    onViewProps={onViewProps}
                    onOpenProp={onOpenProp}
                    onOpenFull={(picked) => { selectedSnap.current = picked; setSelectedId(picked.id); }}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <div style={{
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          marginTop: 20, padding: isMobile ? "0 16px 24px" : 0,
        }}>
          {filtered.length > VISIBLE_GAMES && (
            <span
              role="button"
              tabIndex={0}
              onClick={() => setShowAll((v) => !v)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowAll((v) => !v); } }}
              className="pp-mono"
              style={{
                flex: "none", cursor: "pointer", fontSize: 11.5, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "var(--accent-text)",
                border: "1px solid var(--amber)", borderRadius: 4, padding: "11px 16px",
              }}
            >
              {showAll
                ? "Show fewer games"
                : `Show ${filtered.length - VISIBLE_GAMES} more ${filtered.length - VISIBLE_GAMES === 1 ? "game" : "games"}`}
            </span>
          )}
          {/* The unreadable count lives with the disclaimer rather than in a
              banner over the cards: what it qualifies is the list above it. */}
          <span className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.04em", color: "var(--dim)", lineHeight: 1.6, maxWidth: 560 }}>
            {unreadable > 0 && (
              <span style={{ color: "var(--text)" }}>
                {unreadable} {unreadable === 1 ? "game" : "games"} couldn&rsquo;t be read and {unreadable === 1 ? "is" : "are"} not listed.{" "}
              </span>
            )}
            Nothing here is synthesized &mdash; if a provider has nothing yet, the section
            says so. Research tool, no picks, no wagers.
          </span>
          <a
            href="https://www.ncpgambling.org/help-treatment/"
            target="_blank"
            rel="noopener noreferrer"
            className="pp-mono"
            style={{
              display: "inline-flex", alignItems: "center", minHeight: 44,
              marginLeft: "auto", fontSize: 11, letterSpacing: "0.1em",
              color: "var(--accent-text)", textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            RESPONSIBLE GAMBLING &rarr;
          </a>
        </div>
      </div>

      {!isMobile && v2RightRail}
    </div>
  );
}
