import React, { useEffect, useMemo, useState } from "react";
import { teamLogo, dayLabel, timeLabel, fetchRecentForm, fetchHeadToHead } from "./lib/gamesData.js";

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

function SectionTitle({ children, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      padding: "13px 16px", borderBottom: "1px solid var(--line)",
    }}>
      {/* Short accent bar before each heading -- a small repeated motif that
          carries the accent down the page instead of leaving it in the hero. */}
      <div className="oswald" style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>
        <span style={{ width: 3, height: 13, borderRadius: 2, background: "var(--amber)", flexShrink: 0 }} />
        {children}
      </div>
      {right}
    </div>
  );
}

// Win/Lose split, derived from the same rows the log below renders -- the
// reference shows this as a paired green/red bar above the game list.
function WinLoseBar({ label, rows, align }) {
  const wins = rows.filter((r) => r.win).length;
  const pct = rows.length ? Math.round((wins / rows.length) * 100) : 0;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontSize: 11.5, marginBottom: 6, flexDirection: align === "right" ? "row-reverse" : "row",
      }}>
        <span style={{ color: "var(--dim)" }}>{label}</span>
        <span className="tnum" style={{ color: "var(--dim)" }}>
          <span style={{ color: "var(--green)", fontWeight: 700 }}>{pct}%</span>
          {" W · "}
          <span style={{ color: "var(--red)", fontWeight: 700 }}>{100 - pct}%</span>
          {" L"}
        </span>
      </div>
      <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", background: "var(--surface-sunken)" }}>
        <div style={{ width: `${pct}%`, background: "var(--green)" }} />
        <div style={{ width: `${100 - pct}%`, background: "var(--red)" }} />
      </div>
    </div>
  );
}

function FormRow({ sport, row, isLast }) {
  return (
    <div
      className="gm-form-row"
      style={{
        display: "grid", gridTemplateColumns: "auto 1fr auto auto", alignItems: "center", gap: 10,
        padding: "8px 12px", borderBottom: isLast ? "none" : "1px solid var(--line)",
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
        <div style={{ fontSize: 12.5, color: "var(--text)", whiteSpace: "nowrap" }}>
          <span style={{ color: "var(--dim)" }}>{row.home ? "vs" : "@"}</span> {row.opp}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 1 }}>{row.date}</div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: row.win ? "var(--green)" : "var(--red)" }}>
        {row.win ? "W" : "L"}
      </div>
      <div className="mono tnum" style={{ fontSize: 12, color: "var(--dim-strong)", minWidth: 44, textAlign: "right" }}>
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
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{team.name}</div>
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
  if (!p || (!p.away && !p.home)) return null;
  const cell = (side, team) => (
    <div style={{ padding: "14px 16px", minWidth: 0 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
        color: "var(--dim)", marginBottom: 7,
      }}>
        {team.abbr}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
        {p[side]?.name || "TBD"}
      </div>
    </div>
  );
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

export default function MatchupPage({ game, isMobile, onBack, onViewProps }) {
  const [depth, setDepth] = useState(10);
  const [form, setForm] = useState({ away: [], home: [] });
  const [h2h, setH2h] = useState(null);

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
          className="gm-back"
          role="button"
          tabIndex={0}
          onClick={onBack}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack(); } }}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--dim)", marginBottom: 18 }}
        >
          ← Back to Games
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Overlapping team crests, as in the reference header. */}
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <img src={teamLogo(game.sport, game.away.abbr)} alt="" width={44} height={44} style={{ objectFit: "contain" }} />
            <img src={teamLogo(game.sport, game.home.abbr)} alt="" width={44} height={44} style={{ objectFit: "contain", marginLeft: -18 }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
              color: "var(--amber)",
            }}>
              <span className="mono tnum">{game.away.abbr} @ {game.home.abbr}</span>
              <span style={{ color: "var(--dim)" }}> · {dayLabel(game.startsAt)} {timeLabel(game.startsAt)}</span>
            </div>
            <div className="oswald" style={{ fontSize: isMobile ? 22 : 27, fontWeight: 700, color: "var(--text)", marginTop: 5, letterSpacing: "-0.01em" }}>
              {game.away.name} @ {game.home.name}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: isMobile ? "0 12px" : 0, display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        {/* Primary action -- the whole point of the page is to hand off into
            the props experience for this matchup. */}
        <div
          className="gm-cta oswald"
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
            fontSize: 14.5, fontWeight: 700, letterSpacing: "0.01em",
          }}
        >
          View Props for this Game
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
                padding: "14px 16px", minWidth: 0,
                borderLeft: i === 1 && !isMobile ? "1px solid var(--line)" : "none",
                borderTop: i === 1 && isMobile ? "1px solid var(--line)" : "none",
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--dim)" }}>
                {i === 0 ? "Away" : "Home"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 8 }}>
                <img src={teamLogo(game.sport, t.abbr)} alt="" width={24} height={24} style={{ objectFit: "contain", flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.full}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 2 }}>{t.record || "—"}</div>
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
                    className="gm-tab"
                    role="button"
                    tabIndex={0}
                    onClick={() => setDepth(n)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDepth(n); } }}
                    style={{
                      padding: "4px 12px", borderRadius: "var(--r-pill)", cursor: "pointer",
                      fontSize: 11.5, fontWeight: 700,
                      background: depth === n ? "var(--surface-3)" : "transparent",
                      color: depth === n ? "var(--text)" : "var(--dim)",
                    }}
                  >
                    L{n}
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

        {h2h && (
          <div style={SECTION}>
            <SectionTitle>Head to Head</SectionTitle>
            <div style={{ padding: "14px 16px", fontSize: 13.5, color: "var(--dim-strong)" }}>
              {h2h.awayWins === h2h.homeWins ? (
                <>
                  {"The season series is level at "}
                  <span className="tnum" style={{ color: "var(--text)", fontWeight: 700 }}>{h2h.awayWins}–{h2h.homeWins}</span>
                </>
              ) : (
                <>
                  <span style={{ color: "var(--text)", fontWeight: 700 }}>
                    {h2h.awayWins > h2h.homeWins ? game.away.name : game.home.name}
                  </span>
                  {" lead the season series "}
                  <span className="tnum" style={{ color: "var(--text)", fontWeight: 700 }}>
                    {Math.max(h2h.awayWins, h2h.homeWins)}–{Math.min(h2h.awayWins, h2h.homeWins)}
                  </span>
                </>
              )}
              {` across ${h2h.games} meeting${h2h.games === 1 ? "" : "s"}.`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
