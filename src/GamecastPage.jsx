import React, { useEffect, useMemo, useRef, useState } from "react";
import { useIsPhone } from "./lib/useIsNarrow.js";
import GamecastMobile from "./v3/GamecastMobile.jsx";
import {
  teamLogo, dayLabel, timeLabel, fetchGamecastDetail,
  GAME_STATUS, isActiveStatus,
} from "./lib/gamesData.js";
import PlayerAvatar from "./PlayerAvatar.jsx";

// Gamecast -- the page a GameCard opens once its game has actually started.
//
// MatchupPage is the pre-game view (probable starters, recent form, head to
// head); none of that is what you want while the ball is in play, so anything
// live/delayed/suspended/final routes here instead. What this page shows is
// deliberately limited to what MLB Stats API and ESPN actually return: the
// score, the linescore, and the statistical leaders. There is no odds feed and
// no synthesized data of any kind -- if a provider has nothing yet, the section
// says so rather than filling in a plausible-looking number.

const SECTION = {
  background: "var(--panel)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-lg)",
  overflow: "hidden",
};

// Section titles no longer carry the temporary arch motif from phase 4b.
// The permanent lockup is the three ascending bars (item #15); until then
// headings are plain text. Kept in sync with MatchupPage.
function SectionTitle({ children, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      padding: "14px 28px", borderBottom: "1px solid var(--line)",
      background: "var(--surface-sunken)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 20, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>
        {children}
      </div>
      {right}
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{ padding: 18, textAlign: "center", color: "var(--dim)", fontSize: 12.5 }}>
      {children}
    </div>
  );
}

// The one-line state under the matchup title. Mirrors the card's own center
// column so a game reads the same before and after you open it.
function statusLine(game) {
  const status = game.status || GAME_STATUS.UPCOMING;
  if (status === GAME_STATUS.FINAL) return { text: "FINAL", live: false };
  if (status === GAME_STATUS.LIVE || status === GAME_STATUS.HALFTIME || status === GAME_STATUS.INTERMISSION) {
    const head = status === GAME_STATUS.HALFTIME ? "HALFTIME"
      : status === GAME_STATUS.INTERMISSION ? "INTERMISSION"
      : "LIVE";
    // periodLabel carries a newline for NFL down-and-distance; the header has
    // one line to work with, so it collapses to a separator.
    const detail = game.periodLabel ? game.periodLabel.replace(/\n/g, " · ") : null;
    return { text: detail ? `${head} · ${detail}` : head, live: true };
  }
  if (status === GAME_STATUS.DELAYED) return { text: "DELAYED", live: false };
  if (status === GAME_STATUS.SUSPENDED) return { text: "SUSPENDED", live: false };
  if (status === GAME_STATUS.POSTPONED) return { text: "POSTPONED", live: false };
  if (status === GAME_STATUS.STARTING_SOON) return { text: `STARTING SOON · ${timeLabel(game.startsAt)}`, live: false };
  return { text: `${dayLabel(game.startsAt)} ${timeLabel(game.startsAt)}`, live: false };
}

// One side of the score header.
function ScoreSide({ game, side, isMobile, winner }) {
  const team = game[side];
  const score = team.score;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: isMobile ? 9 : 13,
      flexDirection: side === "home" ? "row-reverse" : "row",
      flex: 1, minWidth: 0,
    }}>
      <img
        src={teamLogo(game.sport, team.abbr)}
        alt=""
        width={isMobile ? 38 : 50}
        height={isMobile ? 38 : 50}
        style={{ objectFit: "contain", flexShrink: 0 }}
      />
      <div style={{ minWidth: 0, textAlign: side === "home" ? "right" : "left" }}>
        <div className="oswald" style={{
          fontSize: isMobile ? 15 : 18, fontWeight: 700, color: "var(--text)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {isMobile ? team.abbr : team.name}
        </div>
        {team.record ? (
          <div className="tnum" style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{team.record}</div>
        ) : null}
      </div>
      <div className="oswald tnum" style={{
        fontSize: isMobile ? 30 : 40, fontWeight: 700, lineHeight: 1,
        // A trailing team is dimmed on a final so the result reads at a glance;
        // while live both stay full strength.
        color: winner === null ? "var(--text)" : winner === side ? "var(--text)" : "var(--dim-strong)",
        marginLeft: side === "away" ? "auto" : 0,
        marginRight: side === "home" ? "auto" : 0,
      }}>
        {typeof score === "number" ? score : "–"}
      </div>
    </div>
  );
}

function Linescore({ detail, isMobile }) {
  const cell = {
    padding: isMobile ? "8px 7px" : "9px 11px",
    textAlign: "center",
    fontSize: 12.5,
    whiteSpace: "nowrap",
  };
  return (
    // Extra innings and overtime widen this past a phone screen, so the table
    // scrolls inside its own box rather than pushing the page sideways.
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "min-content" }}>
        <thead>
          <tr>
            <th style={{ ...cell, textAlign: "left", color: "var(--dim)", fontWeight: 600, position: "sticky", left: 0, background: "var(--panel)" }} />
            {detail.columns.map((c) => (
              <th
                key={c.key}
                className="mono"
                style={{
                  ...cell,
                  color: c.total ? "var(--text)" : "var(--dim)",
                  fontWeight: 700,
                  fontSize: 11,
                  borderLeft: c.total && c.key === detail.columns.find((x) => x.total)?.key
                    ? "1px solid var(--line)" : "none",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {detail.rows.map((row, ri) => (
            <tr key={row.abbr || ri} style={{ borderTop: "1px solid var(--line)" }}>
              <td
                className="oswald"
                style={{
                  ...cell, textAlign: "left", fontWeight: 700, color: "var(--text)",
                  position: "sticky", left: 0, background: "var(--panel)",
                }}
              >
                {row.abbr || "—"}
              </td>
              {row.cells.map((v, i) => {
                const col = detail.columns[i];
                return (
                  <td
                    key={col?.key || i}
                    className="mono tnum"
                    style={{
                      ...cell,
                      color: col?.total ? "var(--text)" : "var(--dim-strong)",
                      fontWeight: col?.total ? 700 : 400,
                      borderLeft: col?.total && col.key === detail.columns.find((x) => x.total)?.key
                        ? "1px solid var(--line)" : "none",
                    }}
                  >
                    {/* A half-inning that has not been played has no value --
                        it stays blank instead of becoming a 0. */}
                    {v === "" ? "" : v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaderRow({ item, isLast, sport, team }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 11,
      padding: "10px 16px",
      borderBottom: isLast ? "none" : "1px solid var(--line)",
    }}>
      <PlayerAvatar
        name={item.name}
        sport={sport}
        team={team}
        headshotSrc={item.headshot}
        size={34}
        inset={2}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          color: "var(--dim)",
        }}>
          {item.category}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: "var(--text)", marginTop: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {item.name}
        </div>
      </div>
      <div className="mono tnum" style={{ fontSize: 12, color: "var(--dim-strong)", textAlign: "right", whiteSpace: "nowrap" }}>
        {item.statLine}
      </div>
    </div>
  );
}

// Prop market -> the boxscore column that measures it.
//
// Only markets a boxscore actually reports are listed. Composites (H+R+RBI)
// and markets ESPN's boxscore does not carry (total bases, stolen bases) are
// deliberately absent: a prop this panel cannot follow live is left out of the
// panel and said so beneath it, rather than being shown with a number derived
// from something adjacent.
const LIVE_STAT_KEY = {
  mlb: { h: "hits", r: "runs", rbi: "RBIs", hr: "homeRuns", bb: "walks", so: "strikeouts" },
  nfl: { passYds: "passingYards", rushYds: "rushingYards", recYds: "receivingYards", rec: "receptions" },
  nba: { pts: "points", reb: "rebounds", ast: "assists" },
  wnba: { pts: "points", reb: "rebounds", ast: "assists" },
};

function liveNumber(v) {
  if (v == null) return null;
  const m = String(v).match(/^-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

// Tonight's production for a set of props, read off the boxscore.
//
// The one rule that makes this panel legitimate: a live figure is *what has
// happened so far*, not a rate. A player sitting under his line in the third
// inning has not missed it -- he has four at-bats left -- so an unfinished
// prop reads neutral, never as a miss. Only a final game turns a shortfall
// red, because only then is it one.
// Exported for verification: the neutral-while-live branch only renders while
// a game is actually in progress, so on a slate that has finished there is no
// way to exercise it from the page.
export function buildPropsInPlay(props, boxscore, sport, isFinal) {
  const keyMap = LIVE_STAT_KEY[sport] || {};
  const byName = new Map();
  (boxscore || []).forEach((t) => {
    t.groups.forEach((g) => {
      g.players.forEach((p) => {
        // A player can appear in two groups (a two-way player, a pitcher who
        // bats). Merge rather than overwrite, so whichever group holds the
        // market's column is the one that answers.
        const prev = byName.get(p.name);
        byName.set(p.name, prev ? { ...prev, stats: { ...prev.stats, ...p.stats } } : { ...p, teamAbbr: t.teamAbbr });
      });
    });
  });

  const rows = [];
  let untracked = 0;
  (props || []).forEach((pr) => {
    const key = keyMap[pr.market];
    const player = byName.get(pr.name);
    if (!key || !player) { untracked += 1; return; }
    const value = liveNumber(player.stats[key]);
    if (value == null) { untracked += 1; return; }
    const passed = value > pr.line;
    rows.push({
      key: `${pr.name}-${pr.market}`,
      name: pr.name,
      teamAbbr: player.teamAbbr,
      marketLabel: pr.marketLabel,
      line: pr.line,
      value,
      passed,
      // Settled only at final. Until then "short" is a running total, not an
      // outcome, and nothing here counts toward a hit rate.
      settled: !!isFinal,
      headshot: player.headshot,
      // The season read this prop arrived with, kept separate from tonight so
      // the two can never be mistaken for each other.
      seasonRate: pr.thin ? null : pr.hitRate,
      seasonSample: pr.gamesCounted,
      seasonOver: pr.gamesOver,
    });
  });
  rows.sort((a, b) => (b.passed ? 1 : 0) - (a.passed ? 1 : 0) || b.value - a.value);
  return { rows, untracked };
}

export default function GamecastPage({ game, isMobile, embedded, onBack, onViewProps, getTopProps, slipLegs = [] }) {
  const isPhone = useIsPhone();
  const [detail, setDetail] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [topProps, setTopProps] = useState(undefined); // undefined = loading, null = unsupported
  const pollRef = useRef(null);

  // The props worth following in this game, from the same source the pre-game
  // Matchup Overview uses -- handed down as a callback because this file
  // cannot import PropLedger (it would close an import cycle).
  useEffect(() => {
    if (!getTopProps) { setTopProps(null); return undefined; }
    let cancelled = false;
    setTopProps(undefined);
    getTopProps(game.sport, game.away.abbr, game.home.abbr)
      .then((reads) => { if (!cancelled) setTopProps(reads || []); })
      .catch(() => { if (!cancelled) setTopProps([]); });
    return () => { cancelled = true; };
  }, [getTopProps, game.sport, game.away.abbr, game.home.abbr]);

  const active = isActiveStatus(game.status) || game.status === GAME_STATUS.DELAYED;

  // Initial load. Keyed on the game id so switching games refetches, while the
  // slate poller re-rendering this page with a fresh score does not.
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setDetail(null);
    fetchGamecastDetail(game).then((d) => {
      if (cancelled) return;
      setDetail(d);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [game.id]);

  // Keep the detail fresh while the game is going, on the same 20s cadence and
  // the same hidden-tab pause the Games list uses. A final game never polls.
  useEffect(() => {
    const clear = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    clear();
    if (!active) return clear;
    pollRef.current = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      fetchGamecastDetail(game, { force: true }).then((d) => {
        // Only replace on a real answer: a transient fetch failure should not
        // blank a linescore that is already on screen.
        if (d) setDetail(d);
      });
    }, 20_000);
    return clear;
  }, [game.id, active]);

  const hero = useMemo(() => [
    "radial-gradient(72% 150% at 76% -20%, color-mix(in srgb, var(--amber) 38%, transparent) 0%, transparent 68%)",
    "radial-gradient(58% 130% at 24% -30%, color-mix(in srgb, var(--amber) 16%, transparent) 0%, transparent 72%)",
    `linear-gradient(180deg, transparent 42%, ${isMobile ? "var(--bg)" : "var(--surface-sunken)"} 100%)`,
    "linear-gradient(120deg, #0b0d12 0%, #10131a 55%, #0b0d12 100%)",
  ].join(", "), [isMobile]);

  const status = statusLine(game);

  // Only a finished game has a winner to emphasize.
  const winner = useMemo(() => {
    if (game.status !== GAME_STATUS.FINAL) return null;
    const a = game.away.score;
    const h = game.home.score;
    if (typeof a !== "number" || typeof h !== "number" || a === h) return null;
    return a > h ? "away" : "home";
  }, [game.status, game.away.score, game.home.score]);

  // Same provider payload, same buildPropsInPlay, same statuses -- the phone's
  // own layout. See src/v3/GamecastMobile.jsx. Declared after every hook above
  // so the branch cannot change the hook order. `embedded` is the compact
  // gamecast that folds inside a Games card, which keeps its own layout.
  if (isPhone && !embedded) {
    const isFinal = game.status === GAME_STATUS.FINAL;
    // The mock's panel is the reader's OWN slip, filtered to this game -- "its
    // counts and its note cannot disagree with 3a because they read the same
    // legs". `topProps` is the board's suggestions for this matchup, which is
    // a different list; labelling those "your legs" would be a false
    // statement. Both teams must match, per the app's own slate-join rule:
    // looking one team up finds *a* game it plays, not this one.
    const here = (slipLegs || []).filter((p) => {
      if (p.sport !== game.sport) return false;
      const sides = [game.away && game.away.abbr, game.home && game.home.abbr];
      return sides.includes(p.team) && (p.oppAbbr ? sides.includes(p.oppAbbr) : true);
    }).map((p) => ({
      name: p.name,
      market: p.marketId,
      marketLabel: p.marketLabel,
      line: p.line,
      hitRate: p.hitRate,
      gamesCounted: p.gamesCounted,
      gamesOver: p.gamesOver,
      thin: false,
    }));
    const inPlay = detail && detail.boxscore && detail.boxscore.length && here.length
      ? buildPropsInPlay(here, detail.boxscore, game.sport, isFinal)
      : { rows: [], untracked: 0 };
    const scoreOf = (side) => (game[side] && game[side].score != null ? game[side].score : null);
    const lead = winner || (isActiveStatus(game.status) && scoreOf("away") != null && scoreOf("home") != null
      ? (scoreOf("away") > scoreOf("home") ? "away" : scoreOf("home") > scoreOf("away") ? "home" : null)
      : null);
    return (
      <GamecastMobile
        onBack={onBack}
        sport={game.sport}
        state={isFinal ? "FINAL" : isActiveStatus(game.status) ? "LIVE" : "SCHEDULED"}
        live={isActiveStatus(game.status)}
        clock={[status.text, game.venue && game.venue.name].filter(Boolean).join(" · ")}
        sides={["away", "home"].map((side) => ({
          side,
          abbr: game[side] && game[side].abbr,
          name: (game[side] && (game[side].name || game[side].full)) || "",
          meta: [game[side] && game[side].record, side.toUpperCase()].filter(Boolean).join(" · "),
          score: scoreOf(side),
          lead: lead === side,
        }))}
        linescore={detail && detail.columns && detail.rows ? { columns: detail.columns, rows: detail.rows } : null}
        // Only said when it is true: the note names blank periods, so it must
        // not appear over a linescore that has none.
        linescoreNote={detail && detail.rows && detail.rows.some((r) => r.cells.some((c) => c === ""))
          ? "Periods with no value have not been played. They are blank rather than zero."
          : null}
        slipLegs={here}
        propsInPlay={inPlay.rows}
        untracked={inPlay.untracked}
        // `leaders` arrives grouped by team ({ teamAbbr, items }); the mock
        // draws one flat list of category / player / value.
        leaders={((detail && detail.leaders) || []).flatMap((t) =>
          (t.items || []).map((it) => ({
            cat: String(it.category || "").toUpperCase(),
            name: it.name,
            team: t.teamAbbr,
            value: it.statLine,
          })))}
        loading={!loaded}
      />
    );
  }

  return (
    <div style={{
      maxWidth: isMobile ? "none" : 960,
      margin: "0 auto",
      padding: isMobile ? "0 0 32px" : "0 16px 32px",
      boxSizing: "border-box",
    }}>
      <div style={{
        background: hero,
        borderRadius: isMobile ? 0 : "var(--r-xl) var(--r-xl) 0 0",
        padding: isMobile ? "14px 16px 18px" : "18px 22px 22px",
      }}>
        <div
          className="gm-back"
          role="button"
          tabIndex={0}
          onClick={onBack}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack(); } }}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--dim)", marginBottom: 16 }}
        >
          ← Back to Games
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
          color: status.live ? "var(--red)" : "var(--dim)",
          marginBottom: 12,
        }}>
          {status.live ? (
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--red)", flexShrink: 0 }} />
          ) : null}
          <span className="tnum">{status.text}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 18 }}>
          <ScoreSide game={game} side="away" isMobile={isMobile} winner={winner} />
          <div style={{ color: "var(--dim)", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>–</div>
          <ScoreSide game={game} side="home" isMobile={isMobile} winner={winner} />
        </div>
      </div>

      <div style={{ padding: isMobile ? "0 12px" : 0, display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        <div
          className="gm-cta oswald"
          role="button"
          tabIndex={0}
          onClick={() => onViewProps && onViewProps(game)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewProps && onViewProps(game); } }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: 46, borderRadius: "var(--r-md)",
            background: "var(--amber)", color: "var(--accent-on)",
            fontSize: 14.5, fontWeight: 700, letterSpacing: "0.01em",
          }}
        >
          View Props for this Game
        </div>

        <div style={SECTION}>
          <SectionTitle>Linescore</SectionTitle>
          {!loaded ? <Empty>Loading…</Empty>
            : detail ? <Linescore detail={detail} isMobile={isMobile} />
            : <Empty>No linescore available yet.</Empty>}
        </div>

        {/* MLB only, and only once the game is decided. */}
        {detail?.decisions ? (
          <div style={SECTION}>
            <SectionTitle>Decisions</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 10 : 24, padding: "12px 16px" }}>
              {detail.decisions.map((d) => (
                <div key={d.role} style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                    color: "var(--dim)",
                  }}>
                    {d.role === "winner" ? "Win" : d.role === "loser" ? "Loss" : "Save"}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{d.name}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Props in play. Tonight's production against the line -- explicitly
            not a hit rate, which is why the caption says so and why an
            unfinished prop under its line stays neutral. */}
        {(() => {
          if (!detail?.boxscore?.length || topProps === undefined || topProps === null) return null;
          const isFinal = game.status === GAME_STATUS.FINAL;
          const { rows, untracked } = buildPropsInPlay(topProps, detail.boxscore, game.sport, isFinal);
          if (!rows.length) return null;
          return (
            <div style={SECTION}>
              <SectionTitle right={
                <span className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: "var(--dim)" }}>
                  {isFinal ? "FINAL" : "SO FAR TONIGHT"}
                </span>
              }>
                Props in play
              </SectionTitle>
              <div>
                {rows.map((r, i) => {
                  // Filled once past the line. Before that it is an outline in
                  // neutral ink, not in --neg: the prop has not missed, it
                  // simply has not got there yet.
                  const ink = r.passed ? "var(--pos)" : r.settled ? "var(--neg)" : "var(--text-2, var(--dim))";
                  return (
                    <div
                      key={r.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr auto" : "minmax(0,1fr) 96px 108px",
                        gap: 12, alignItems: "center", padding: "11px 16px",
                        borderTop: i === 0 ? "none" : "1px solid var(--line)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.name}
                        </div>
                        <div className="pp-mono" style={{ fontSize: 11, color: "var(--dim)", marginTop: 2, whiteSpace: "nowrap" }}>
                          {r.teamAbbr} · over {r.line} {r.marketLabel}
                        </div>
                      </div>
                      <div className="pp-mono tnum" style={{ fontSize: 17, color: ink, textAlign: isMobile ? "right" : "center", whiteSpace: "nowrap" }}>
                        {r.value}
                        <span style={{ fontSize: 11, color: "var(--dim)" }}> / {r.line}</span>
                      </div>
                      {!isMobile && (
                        <div className="pp-mono" style={{ fontSize: 11, color: "var(--dim)", textAlign: "right", whiteSpace: "nowrap" }}>
                          {/* The season read, kept visibly apart from tonight.
                              A thin season sample states that rather than
                              printing a rate under the minimum. */}
                          {r.seasonRate == null
                            ? "too few"
                            : `${Math.round(r.seasonRate * 100)}% · ${r.seasonOver} of ${r.seasonSample}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="pp-mono" style={{ fontSize: 11, color: "var(--dim)", padding: "10px 16px", borderTop: "1px solid var(--line)", lineHeight: 1.5 }}>
                {isFinal
                  ? "Final figures. These games now count toward the hit rates on the right."
                  : "What has happened so far tonight, not a hit rate — a prop under its line has not missed, it has not got there yet. Nothing here counts toward a hit rate until the game is final."}
                {untracked > 0 && ` ${untracked} more prop${untracked === 1 ? "" : "s"} on this game can't be followed live — the boxscore doesn't report ${untracked === 1 ? "that market" : "those markets"}.`}
              </div>
            </div>
          );
        })()}

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 14,
        }}>
          {!loaded || !detail?.leaders?.length ? (
            <div style={{ ...SECTION, gridColumn: isMobile ? "auto" : "1 / -1" }}>
              <SectionTitle>Leaders</SectionTitle>
              {!loaded ? <Empty>Loading…</Empty> : <Empty>No leaders available yet.</Empty>}
            </div>
          ) : detail.leaders.map((t) => (
            <div key={t.teamAbbr} style={SECTION}>
              <SectionTitle
                right={
                  <img src={teamLogo(game.sport, t.teamAbbr)} alt="" width={20} height={20} style={{ objectFit: "contain" }} />
                }
              >
                {t.teamAbbr} Leaders
              </SectionTitle>
              <div>
                {t.items.map((item, i) => (
                  <LeaderRow
                    key={`${item.category}-${item.name}`}
                    item={item}
                    isLast={i === t.items.length - 1}
                    sport={game.sport}
                    team={t.teamAbbr}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
