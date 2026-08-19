import React, { useEffect, useMemo, useRef, useState } from "react";
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

export default function GamecastPage({ game, isMobile, onBack, onViewProps }) {
  const [detail, setDetail] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const pollRef = useRef(null);

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
