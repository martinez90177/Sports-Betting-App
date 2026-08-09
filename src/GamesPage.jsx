import React, { useEffect, useMemo, useState } from "react";
import MatchupPage from "./MatchupPage.jsx";
import {
  SPORTS, teamLogo, dayKey, dayLabel, timeLabel, buildDateTabs,
  mockGames, mockNflWeekOne, fetchMlbSlate, fetchWnbaSlate, fetchNflWeekOneSlate,
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
            className="gm-tab"
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

function TeamSide({ game, side, isMobile, align }) {
  const t = game[side];
  const logo = (
    <img
      src={teamLogo(game.sport, t.abbr)}
      alt=""
      width={isMobile ? 26 : 28}
      height={isMobile ? 26 : 28}
      style={{ objectFit: "contain", flexShrink: 0 }}
      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
    />
  );
  const text = (
    <div style={{ minWidth: 0, textAlign: align }}>
      <div className="oswald" style={{
        fontSize: isMobile ? 15.5 : 15, fontWeight: 700, color: "var(--text)",
        lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {/* Desktop shows the full "Cincinnati Reds"; the iOS reference shows
            just "Reds", which is also what keeps three columns fitting on a
            390px screen. */}
        {isMobile ? t.name : t.full}
      </div>
      {/* Records in the mono/tabular face the rest of PropPalace uses for
          figures -- the reference sets them in the same sans as the name. */}
      <div className="mono tnum" style={{ fontSize: isMobile ? 12 : 11.5, color: "var(--dim)", marginTop: 4, letterSpacing: "0.02em" }}>
        {t.record}
      </div>
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

function GameCard({ game, isMobile, onSelect }) {
  const open = () => onSelect(game);
  return (
    <div
      className="gm-card"
      role="button"
      tabIndex={0}
      aria-label={`${game.away.full} at ${game.home.full}, ${dayLabel(game.startsAt)} ${timeLabel(game.startsAt)}`}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      style={{
        position: "relative", overflow: "hidden",
        background: "var(--panel)", border: "1px solid var(--line)",
        borderRadius: isMobile ? 14 : "var(--r-lg)",
        padding: isMobile ? "14px 12px" : "16px 22px",
        minHeight: isMobile ? 84 : 96,
        display: "flex", flexDirection: "column", justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: isMobile ? 8 : 18 }}>
        <TeamSide game={game} side="away" isMobile={isMobile} align="left" />
        {/* Both reference layouts state the time as loose text (top-left on
            desktop, stacked in the middle on mobile). Boxing it into a
            medallion gives the row a real centre of gravity and is the most
            recognisably different thing about this card. */}
        {/* Kept narrow on phones: every px here comes straight out of the two
            team-name columns either side, and "Blue Jays" has to fit. */}
        <div style={{
          flexShrink: 0, textAlign: "center", minWidth: isMobile ? 64 : 92,
          padding: isMobile ? "6px 7px" : "7px 12px",
          background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8,
        }}>
          <div className="mono tnum" style={{
            fontSize: isMobile ? 11.5 : 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap",
          }}>
            {timeLabel(game.startsAt)}
          </div>
          <div style={{
            fontSize: isMobile ? 9.5 : 9.5, marginTop: 3, color: "var(--dim)",
            textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 600, whiteSpace: "nowrap",
          }}>
            {dayLabel(game.startsAt)}
          </div>
        </div>
        <TeamSide game={game} side="home" isMobile={isMobile} align="right" />
      </div>
    </div>
  );
}

export default function GamesPage({ onViewProps }) {
  const isMobile = useIsNarrow(720);
  const [sport, setSport] = useState("mlb");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  // NFL is a week competition, so its whole Week 1 slate is loaded once and
  // the date tabs are derived from the kickoff days it actually contains.
  const [nflWeek, setNflWeek] = useState(() => mockNflWeekOne());
  const [dayGames, setDayGames] = useState([]);
  const [pickedKey, setPickedKey] = useState(null);

  const tabs = useMemo(() => buildDateTabs(sport, nflWeek), [sport, nflWeek]);

  // Deriving the active key rather than storing it means switching sports
  // can't strand a selection on a date tab the new sport doesn't have.
  const activeKey = useMemo(() => {
    if (pickedKey && tabs.some((t) => t.key === pickedKey)) return pickedKey;
    return sport === "nfl" ? tabs[0]?.key : dayKey(new Date());
  }, [pickedKey, tabs, sport]);

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

  const games = useMemo(() => {
    const base = sport === "nfl"
      ? nflWeek.filter((g) => dayKey(new Date(g.startsAt)) === activeKey)
      : dayGames;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((g) =>
      [g.away.full, g.home.full, g.away.abbr, g.home.abbr, g.away.name, g.home.name]
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [sport, nflWeek, dayGames, activeKey, query]);

  // Slate summary shown under the title. Reads off the same list the cards
  // render, so it tracks the search filter too.
  // Declared above the early return below: a hook placed after it would go
  // unrun the moment a game is selected, which React treats as a changed
  // hook count and throws on.
  const gameCount = games.length;
  const subtitle = useMemo(() => {
    if (sport === "nfl") return "NFL Week 1";
    const d = activeKey ? new Date(`${activeKey}T12:00:00`) : new Date();
    return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  }, [sport, activeKey]);

  if (selected) {
    return (
      <MatchupPage
        game={selected}
        isMobile={isMobile}
        onBack={() => setSelected(null)}
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
          <GameCard key={g.id} game={g} isMobile={isMobile} onSelect={setSelected} />
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
