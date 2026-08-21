import React, { useEffect, useMemo, useState } from "react";
import { teamLogo, dayLabel, timeLabel, fetchRecentForm, fetchHeadToHead } from "./lib/gamesData.js";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { MLB_TEAM_COLORS } from "./lib/teamColors.js";
import { MLB_ABBR_TEAM_ID, fetchMLBTeamRosterStatus, mlbAvailability, mlbHeadshot } from "./lib/mlbStatus.js";

// Matchup Overview -- the page a GameCard opens.
//
// Deliberately a *light* version of Outlier's matchup screen. The reference
// recording (scratchpad/md) is full of things this page does not have and
// will not grow: the odds timeline rail, money line / run line / total
// blocks, public-betting split bars, and the bullpen / batter / advanced
// metric tables. What survives is the part that is useful without an odds
// feed -- who is starting, how both teams have actually been playing, and a
// route into the props the rest of the app is built around.

const SECTION = {
  background: "var(--panel)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-lg)",
  overflow: "hidden",
};

// Section titles no longer carry the temporary arch motif from phase 4b.
// The permanent lockup is the three ascending bars (item #15); until then
// headings are plain text.
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

// Win/Lose split, derived from the same rows the log below renders -- the
// reference shows this as a paired green/red bar above the game list.
function WinLoseBar({ label, rows, align }) {
  // No games, no bar. With an empty set this rendered "0% W · 100% L" and a
  // full red track -- a perfect losing record invented out of missing data.
  // FormColumn's "No recent games." already covers the empty case.
  if (!rows.length) return null;
  const wins = rows.filter((r) => r.result === "W").length;
  const ties = rows.filter((r) => r.result === "T").length;
  const losses = rows.length - wins - ties;
  const pctOf = (n) => (n / rows.length) * 100;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontSize: 12.5, marginBottom: 6, flexDirection: align === "right" ? "row-reverse" : "row",
      }}>
        <span style={{ color: "var(--dim)" }}>{label}</span>
        {/* Counts, not percentages -- "3 W · 2 L" over "60% W · 40% L". Five
            games is not a percentage worth printing, and the rest of the app
            leads with the count for the same reason. The bar underneath still
            carries the proportion for anyone reading the shape.

            The T only appears when there is one. A permanent "· 0 T" on every
            MLB row would be noise for a sport that effectively never draws. */}
        <span className="pp-mono tnum" style={{ color: "var(--dim)" }}>
          <span style={{ color: "var(--pos)", fontWeight: 700 }}>{wins} W</span>
          {" · "}
          <span style={{ color: "var(--neg)", fontWeight: 700 }}>{losses} L</span>
          {ties > 0 && (
            <>
              {" · "}
              <span style={{ color: "var(--dim)", fontWeight: 700 }}>{ties} T</span>
            </>
          )}
        </span>
      </div>
      <div style={{ display: "flex", height: 5, overflow: "hidden", background: "var(--surface-sunken)" }}>
        <div style={{ width: `${pctOf(wins)}%`, background: "var(--pos)" }} />
        {/* Ties sit between the two, in the mid-grey the app already uses for
            the neutral value between a green and a red badge. A draw is not a
            good result or a bad one, so it belongs on neither side of the
            over/under palette. */}
        {ties > 0 && <div style={{ width: `${pctOf(ties)}%`, background: "var(--neutral-badge-bg)" }} />}
        <div style={{ width: `${pctOf(losses)}%`, background: "var(--neg)" }} />
      </div>
    </div>
  );
}

function FormRow({ sport, row, isLast }) {
  return (
    <div
      className="gm-form-row"
      style={{
        display: "grid", gridTemplateColumns: "auto 1fr auto auto", alignItems: "center", gap: 14,
        padding: "9px 12px", borderBottom: isLast ? "none" : "1px solid var(--line)",
      }}
    >
      <img
        src={teamLogo(sport, row.opp)}
        alt=""
        width={18}
        height={18}
        style={{ objectFit: "contain" }}
        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: "var(--text)", whiteSpace: "nowrap" }}>
          <span style={{ color: "var(--dim)" }}>{row.home ? "vs" : "@"}</span> {row.opp}
          <span style={{ color: "var(--dim)", fontSize: 11.5 }}> {row.date}</span>
        </div>
      </div>
      {/* Grey for a draw, for the same reason as the bar above: it is neither
          the green outcome nor the red one. --dim rather than the bar's fill
          token because this is a glyph on a dark panel and has to stay legible. */}
      <div className="pp-mono" style={{
        fontWeight: 700,
        color: row.result === "W" ? "var(--pos)" : row.result === "L" ? "var(--neg)" : "var(--dim)",
      }}>
        {row.result}
      </div>
      <div className="pp-mono tnum" style={{ fontSize: 12.5, color: "var(--dim-strong)", minWidth: 52, textAlign: "right" }}>
        {row.us} : {row.them}
      </div>
    </div>
  );
}

function FormColumn({ sport, team, rows }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "0 12px 10px",
      }}>
        <img src={teamLogo(sport, team.abbr)} alt="" width={20} height={20} style={{ objectFit: "contain" }} />
        <div className="pp-mono" style={{ fontSize: 12.5, color: "var(--text)" }}>{team.name}</div>
      </div>
      <div style={{ padding: "0 12px 12px" }}>
        <WinLoseBar label={`Last ${rows.length}`} rows={rows} />
      </div>
      <div style={{ borderTop: "1px solid var(--line)" }}>
        {rows.map((r, i) => (
          <FormRow key={`${r.date}-${r.opp}-${i}`} sport={sport} row={r} isLast={i === rows.length - 1} />
        ))}
        {rows.length === 0 && (
          <div style={{ padding: 18, textAlign: "center", color: "var(--dim)", fontSize: 12.5 }}>No recent games.</div>
        )}
      </div>
    </div>
  );
}

function ProbablePitchers({ game }) {
  const p = game.probables;

  // Availability for both starters, from the same 40-man feed the prop feed
  // reads (one shared cache -- see lib/mlbStatus.js). Null until it resolves,
  // and null forever if it fails, both of which render as no dot rather than a
  // green one.
  const [status, setStatus] = useState({});
  const awayAbbr = game.away.abbr;
  const homeAbbr = game.home.abbr;
  useEffect(() => {
    if (!p || (!p.away && !p.home)) return undefined;
    let cancelled = false;
    Promise.all(
      [awayAbbr, homeAbbr]
        .map((abbr) => MLB_ABBR_TEAM_ID[abbr])
        .filter(Boolean)
        .map((teamId) => fetchMLBTeamRosterStatus(teamId).catch(() => null))
    ).then((maps) => {
      if (cancelled) return;
      const merged = {};
      maps.forEach((m) => { if (m) Object.assign(merged, m); });
      setStatus(merged);
    });
    return () => { cancelled = true; };
  }, [p, awayAbbr, homeAbbr]);

  if (!p || (!p.away && !p.home)) return null;

  const cell = (side, team) => {
    const pitcher = p[side];
    return (
      <div style={{ padding: "16px 28px", minWidth: 0 }}>
        <div className="pp-mono" style={{
          fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase",
          color: "var(--dim)", marginBottom: 10,
        }}>
          {team.abbr}
        </div>
        {/* Rule 1: a named player travels with their face and their
            availability. This row used to be a bare string. */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          {pitcher && (
            <PlayerAvatar
              name={pitcher.name}
              alt={pitcher.name}
              sport="mlb"
              team={team.abbr}
              colorMap={MLB_TEAM_COLORS}
              headshotSrc={mlbHeadshot(pitcher.id)}
              status={mlbAvailability(status[pitcher.id])}
              surface="var(--panel)"
              size={40}
              fadeIn
            />
          )}
          <div style={{ fontSize: 14, fontWeight: 600, color: pitcher ? "var(--text)" : "var(--dim)", minWidth: 0 }}>
            {pitcher?.name || "Not announced yet"}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={SECTION}>
      <SectionTitle>Probable Pitchers</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {cell("away", game.away)}
        <div style={{ borderLeft: "1px solid var(--line)" }}>{cell("home", game.home)}</div>
      </div>
    </div>
  );
}

export default function MatchupPage({ game, isMobile, embedded, onBack, onViewProps, getTopProps, onOpenProp }) {
  const [depth, setDepth] = useState(10);
  const [form, setForm] = useState({ away: [], home: [] });
  const [h2h, setH2h] = useState(null);
  // "Props with a read" (card 138) -- a handful of notable props for this
  // game, computed by PropLedger (see getTopPropsForMatchup) and handed down
  // as a prop rather than fetched here: this file cannot import PropLedger.jsx
  // (PropLedger lazy-imports GamesPage, which imports this file -- importing
  // back would be circular), so the data arrives the same way onViewProps
  // already does, as a callback.
  const [topProps, setTopProps] = useState(undefined); // undefined = loading, null = unsupported, [] = none

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchRecentForm(game.sport, game.away.abbr, depth),
      fetchRecentForm(game.sport, game.home.abbr, depth),
    ]).then(([away, home]) => {
      if (!cancelled) setForm({ away, home });
    });
    return () => { cancelled = true; };
  }, [game.sport, game.away.abbr, game.home.abbr, depth]);

  useEffect(() => {
    let cancelled = false;
    fetchHeadToHead(game.sport, game.away.abbr, game.home.abbr).then((r) => {
      if (!cancelled) setH2h(r);
    });
    return () => { cancelled = true; };
  }, [game.sport, game.away.abbr, game.home.abbr]);

  useEffect(() => {
    if (!getTopProps) { setTopProps(null); return undefined; }
    let cancelled = false;
    setTopProps(undefined);
    getTopProps(game.sport, game.away.abbr, game.home.abbr).then((reads) => {
      if (!cancelled) setTopProps(reads || []);
    }).catch(() => { if (!cancelled) setTopProps([]); });
    return () => { cancelled = true; };
  }, [getTopProps, game.sport, game.away.abbr, game.home.abbr]);

  // Matches the Games hero: accent-mixed rather than the reference's fixed
  // green, so both screens re-tint with the user's chosen accent.
  const hero = useMemo(() => [
    "radial-gradient(72% 150% at 76% -20%, color-mix(in srgb, var(--amber) 38%, transparent) 0%, transparent 68%)",
    "radial-gradient(58% 130% at 24% -30%, color-mix(in srgb, var(--amber) 16%, transparent) 0%, transparent 72%)",
    `linear-gradient(180deg, transparent 42%, ${isMobile ? "var(--bg)" : "var(--surface-sunken)"} 100%)`,
    "linear-gradient(120deg, #0b0d12 0%, #10131a 55%, #0b0d12 100%)",
  ].join(", "), [isMobile]);

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
        padding: isMobile ? "14px 16px 20px" : "18px 22px 22px",
      }}>
        <div
          className="gm-back pp-mono"
          role="button"
          tabIndex={0}
          onClick={onBack}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack(); } }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            fontSize: 11.5, letterSpacing: "0.1em", color: "var(--dim)", marginBottom: 18,
          }}
        >
          {embedded ? "× CLOSE" : "← BACK TO GAMES"}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Overlapping team crests, as in the reference header. */}
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <img src={teamLogo(game.sport, game.away.abbr)} alt="" width={44} height={44} style={{ objectFit: "contain" }} />
            <img src={teamLogo(game.sport, game.home.abbr)} alt="" width={44} height={44} style={{ objectFit: "contain", marginLeft: -18 }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="pp-mono" style={{
              fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "var(--accent-text)",
            }}>
              <span className="tnum">{game.away.abbr} @ {game.home.abbr}</span>
              <span style={{ color: "var(--dim)" }}> · {dayLabel(game.startsAt)} {timeLabel(game.startsAt)}</span>
            </div>
            {/* "at" rather than "@" here: the abbreviated form is already in the
                mono line above, and at this size the word reads better. */}
            <div className="pp-display" style={{
              fontSize: isMobile ? 26 : 38, color: "var(--text)", marginTop: 8,
              letterSpacing: "-0.01em", lineHeight: 1.1,
            }}>
              {game.away.name} <span style={{ color: "var(--dim)", fontSize: isMobile ? 18 : 26 }}>at</span> {game.home.name}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: isMobile ? "0 12px" : 0, display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        {/* Primary action -- the whole point of the page is to hand off into
            the props experience for this matchup. */}
        {/* Copy is "all props", not "props for this game", because that is what
            it does: goToGameProps switches sport and page without narrowing to
            this matchup (see the comment on it in PropLedger). Promising the
            game and delivering the slate is the same silent overpromise as a
            row that quietly renders a different player. Narrowing the feed is
            real work and belongs with the props-panel pass. */}
        <div
          className="gm-cta pp-mono"
          role="button"
          tabIndex={0}
          onClick={() => onViewProps && onViewProps(game)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewProps && onViewProps(game); } }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: 46, borderRadius: "var(--r-md)",
            /* --accent-on is the label colour for text on a solid --amber
               fill; --amber-ink is accent-coloured text *on a dark surface*,
               which on this button would be accent-on-accent. */
            background: "var(--amber)", color: "var(--accent-on)",
            fontSize: 12.5, letterSpacing: "0.08em", textTransform: "uppercase",
          }}
        >
          View all props
        </div>

        {/* Team strip: full names + records, the detail the card only had room
            to abbreviate. */}
        {/* Stacks on mobile: side by side, a full club name like
            "Washington Nationals" has ~150px to work with and ellipsises. */}
        <div style={{ ...SECTION, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
          {[game.away, game.home].map((t, i) => (
            <div
              key={t.abbr}
              style={{
                padding: "18px 28px", minWidth: 0,
                borderLeft: i === 1 && !isMobile ? "1px solid var(--line)" : "none",
                borderTop: i === 1 && isMobile ? "1px solid var(--line)" : "none",
              }}
            >
              <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" }}>
                {i === 0 ? "Away" : "Home"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <img src={teamLogo(game.sport, t.abbr)} alt="" width={24} height={24} style={{ objectFit: "contain", flexShrink: 0 }} />
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
                  <div className="pp-display" style={{ fontSize: 22, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.full}
                  </div>
                  <div className="pp-mono tnum" style={{ fontSize: 13, color: "var(--dim-strong)", flexShrink: 0 }}>{t.record || "—"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {game.sport === "mlb" && <ProbablePitchers game={game} />}

        <div style={SECTION}>
          <SectionTitle
            right={
              <div style={{ display: "flex", gap: 4 }}>
                {[5, 10].map((n) => (
                  <div
                    key={n}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDepth(n)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDepth(n); } }}
                    className="gm-tab pp-mono"
                    style={{
                      padding: "6px 14px", cursor: "pointer",
                      fontSize: 11.5, letterSpacing: "0.08em",
                      background: depth === n ? "var(--surface-3)" : "transparent",
                      color: depth === n ? "var(--text)" : "var(--dim)",
                    }}
                  >
                    LAST {n}
                  </div>
                ))}
              </div>
            }
          >
            Recent Form
          </SectionTitle>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            paddingTop: 12,
          }}>
            <FormColumn sport={game.sport} team={game.away} rows={form.away} />
            <div style={{
              borderLeft: isMobile ? "none" : "1px solid var(--line)",
              borderTop: isMobile ? "1px solid var(--line)" : "none",
              paddingTop: isMobile ? 12 : 0,
            }}>
              <FormColumn sport={game.sport} team={game.home} rows={form.home} />
            </div>
          </div>
        </div>

        {/* Three states, and a fourth that renders nothing at all.

            `h2h === null` means this sport has no season series to show (see
            fetchHeadToHead) -- no panel, because nothing was promised. A sport
            without head-to-head should read as a finished page, not a page with
            a hole in it, so the section is dropped entirely and the flex gap
            above closes the space.

            When the sport *does* have one, every outcome gets a line: a real
            record, "they haven't met", or "we couldn't check". An empty shell
            with a heading and no sentence would be the worst of both. */}
        {h2h && (
          <div style={SECTION}>
            <SectionTitle>Head to Head</SectionTitle>
            <div style={{ padding: "16px 28px", fontSize: 13.5, color: "var(--dim-strong)", lineHeight: 1.5 }}>
              {h2h.error ? (
                "Couldn't load the season series for these two right now."
              ) : h2h.games === 0 ? (
                `${game.away.name} and ${game.home.name} haven't met yet this season.`
              ) : (
                <>
                  {h2h.awayWins === h2h.homeWins ? (
                    <>
                      {"The season series is level at "}
                      <span className="pp-mono tnum" style={{ color: "var(--text)" }}>{h2h.awayWins}–{h2h.homeWins}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "var(--text)" }}>
                        {h2h.awayWins > h2h.homeWins ? game.away.name : game.home.name}
                      </span>
                      {" lead the season series "}
                      <span className="pp-mono tnum" style={{ color: "var(--text)" }}>
                        {Math.max(h2h.awayWins, h2h.homeWins)}–{Math.min(h2h.awayWins, h2h.homeWins)}
                      </span>
                    </>
                  )}
                  {` across ${h2h.games} meeting${h2h.games === 1 ? "" : "s"}.`}
                  {h2h.games === 1 && " One game is a result, not a pattern."}
                </>
              )}
            </div>
          </div>
        )}

        {/* "Props with a read" (card 138). Same three-state discipline as
             Head to Head just above: `null` (no callback wired -- shouldn't
             happen in the real app, but a defensive default) or an empty
             array both mean nothing to show, so the whole section drops
             rather than rendering a heading over blank space. Loading gets
             its own line instead of a flash of nothing while the per-player
             game logs resolve. */}
        {topProps === undefined ? (
          <div style={SECTION}>
            <SectionTitle>Props with a read</SectionTitle>
            <div style={{ padding: "16px 28px", fontSize: 13, color: "var(--dim)" }}>Working out this game's props…</div>
          </div>
        ) : topProps && topProps.length > 0 ? (
          <div style={SECTION}>
            <SectionTitle>Props with a read</SectionTitle>
            <div>
              {topProps.map((r, i) => (
                <div
                  key={r.playerId}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenProp && onOpenProp(r.sport, r.playerId, r.market, { name: r.name, team: r.team })}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenProp && onOpenProp(r.sport, r.playerId, r.market, { name: r.name, team: r.team }); } }}
                  className="gm-card"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
                    padding: "12px 28px", cursor: "pointer",
                    borderTop: i === 0 ? "none" : "1px solid var(--line)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                    <PlayerAvatar name={r.name} team={r.team} sport={r.sport} size={30} surface="var(--panel)" />
                    <span style={{ fontSize: 13.5, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.name} <span style={{ color: "var(--dim)" }}>{r.marketLabel.toLowerCase()} {r.line}</span>
                    </span>
                  </div>
                  <span className="pp-mono tnum" style={{ fontSize: 12.5, color: "var(--dim)", whiteSpace: "nowrap", flexShrink: 0 }}>
                    <span style={{ color: r.hitRate >= 0.6 ? "var(--pos)" : r.hitRate <= 0.4 ? "var(--neg)" : "var(--text)", fontWeight: 600 }}>
                      {Math.round(r.hitRate * 100)}%
                    </span>
                    {" · "}{r.gamesOver} of {r.gamesCounted}{r.thin ? " · too few" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
