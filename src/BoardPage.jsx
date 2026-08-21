import React, { useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import FeedFormStrip from "./FormGraph.jsx";
import MinSampleControl, { loadSamplePresets, saveSamplePresets, MIN_SAMPLE_ALL } from "./MinSampleControl.jsx";

// --------------------------------------------------------------------------
// The board (item 17)
// --------------------------------------------------------------------------
// Spec: `design_handoff_proppalace_full/README.md`, "Screen 2 — The board",
// and `PropPalace Board.dc.html` for exact values.
//
// ---- What this is for, and what it is not ----
//
// The board and the prop feed are both filtered lists of props, and that
// resemblance is not a licence to converge them. Alex's rule, recorded in
// docs/REDESIGN_PLAN.md: keep the three surfaces separate, do not merge them
// in any way.
//
//   The feed's job:  work through props you have already chosen. Dense, fast
//                    to scan, one flat list.
//   The board's job: decide *which* props are worth working through. Roomier,
//                    grouped under the game each prop belongs to, with the
//                    controls that narrow a slate to the few worth opening.
//
// The test when unsure where something belongs: does it help someone decide
// what to research (board), or help them work through what they already
// picked (feed)? Neither surface grows toward the other.
//
// The board is also NOT the Games page. Games tracks live matches, scores and
// box scores so people don't leave for ESPN mid-session; this ranks props.
// Both ship, both keep their own route -- Alex, 2026-08-21.
//
// ---- The minimum-sample control ----
//
// Shared with the phone's refine sheet and the feed's Filters panel; see
// MinSampleControl. It is a display threshold, not a filter: a prop under the
// minimum keeps its row here too and simply shows no rate. Hiding those rows
// would make the board answer "is there anything on this game?" with "no"
// when the honest answer is "yes, but not enough games to say anything".

const GRID = "232px 176px 148px 1fr 132px";
const LABEL = { fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dim)" };

// The splits the rail offers. Each is a predicate over a row's own game log,
// so a split recomputes the rate AND its sample together -- the README calls
// this out as critical, and it is why `rateFor` below returns both numbers
// from one pass instead of reusing a precomputed percentage.
const SPLITS = [
  { id: "season", label: "Season", test: null },
  { id: "home", label: "Home only", test: (g) => g.home === true },
  { id: "last3", label: "Last 3 games", test: null, tail: 3 },
  { id: "vsOpp", label: "vs. this defense", test: (g, r) => g.opp && r.opp && g.opp === r.opp },
];

// Rate and sample from one pass over the same games, so the two can never
// disagree. Returns null when the split leaves nothing at all -- distinct
// from leaving too little, which is a rate the caller suppresses.
function rateFor(row, activeSplits) {
  let games = row.recent || [];
  if (!games.length) return null;
  activeSplits.forEach((id) => {
    const s = SPLITS.find((x) => x.id === id);
    if (!s) return;
    if (s.tail) games = games.slice(-s.tail);
    if (s.test) games = games.filter((g) => s.test(g, row));
  });
  if (!games.length) return { games: [], n: 0, over: 0, rate: null };
  const under = row.direction === "under";
  const over = games.filter((g) => (under ? g.v < row.line : g.v > row.line)).length;
  return { games, n: games.length, over, rate: over / games.length };
}

export default function BoardPage({ rows = [], groups = [], sport, sports = [], onSetSport, onOpenProp, marketGroups = [], disclaimer }) {
  const [selectedMarkets, setSelectedMarkets] = useState([]);
  const [minGames, setMinGames] = useState(10);
  const [samplePresets, setSamplePresets] = useState(loadSamplePresets);
  const [activeSplits, setActiveSplits] = useState(["season"]);
  const [visibleGames, setVisibleGames] = useState(10);

  const updateSamplePresets = React.useCallback((next) => {
    setSamplePresets(next);
    saveSamplePresets(next);
  }, []);

  const filtered = useMemo(
    () => (selectedMarkets.length ? rows.filter((r) => selectedMarkets.includes(r.marketId)) : rows),
    [rows, selectedMarkets]
  );

  // Grouped under the game each prop belongs to -- the board's whole reason to
  // exist as a separate surface from the flat feed.
  const grouped = useMemo(() => {
    const byGame = new Map();
    filtered.forEach((r) => {
      const key = r.gameKey || `${r.team}-${r.opp}`;
      if (!byGame.has(key)) byGame.set(key, { key, label: r.gameLabelFull || `${r.team} vs ${r.opp}`, time: r.gameTime || "", rows: [] });
      byGame.get(key).rows.push(r);
    });
    return [...byGame.values()]
      .map((g) => ({
        ...g,
        // Strongest first inside a game: the board is for finding the few
        // worth opening, so the order has to be the answer to that question.
        rows: g.rows.slice().sort((a, b) => (b.l10 ?? -1) - (a.l10 ?? -1)),
      }))
      .sort((a, b) => b.rows.length - a.rows.length);
  }, [filtered]);

  const shown = grouped.slice(0, visibleGames);
  const propCount = filtered.length;

  const toggleSplit = (id) => {
    setActiveSplits((prev) => {
      if (id === "season") return ["season"];
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.filter((x) => x !== "season"), id];
      return next.length ? next : ["season"];
    });
  };

  return (
    <div className="page-shell" style={{ maxWidth: 1600, margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <h1 className="pp-display" style={{ fontSize: 34, margin: 0, letterSpacing: "-0.01em", fontWeight: 600 }}>The board</h1>
        <span className="pp-mono" style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-2, var(--dim))" }}>
          {grouped.length} {grouped.length === 1 ? "game" : "games"} · {propCount.toLocaleString()} props
        </span>
        {/* The league switcher, reusing the feed's own set rather than
            inventing a second one. NFL in the mock was only an example. */}
        <span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {sports.map((s) => (
            <span
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => s.available && onSetSport && onSetSport(s.id)}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && s.available) { e.preventDefault(); onSetSport(s.id); } }}
              title={s.available ? (s.simulated ? "Generated sample data, not a live feed" : undefined) : "Coming soon"}
              className="pp-mono"
              style={{
                cursor: s.available ? "pointer" : "not-allowed",
                fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase",
                padding: "8px 14px", borderRadius: 4,
                background: sport === s.id ? "var(--amber)" : "transparent",
                color: sport === s.id ? "var(--accent-on)" : "var(--text-2, var(--dim))",
                border: `1px solid ${sport === s.id ? "var(--amber)" : "var(--line)"}`,
                opacity: s.available ? 1 : 0.5,
              }}
            >
              {s.label}
            </span>
          ))}
        </span>
      </div>

      <div className="board-layout" style={{ display: "grid", gridTemplateColumns: "236px minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
        {/* ---- Filter rail ---- */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span className="pp-mono" style={{ ...LABEL, fontSize: 10.5, letterSpacing: "0.14em" }}>Market</span>
            <span
              role="button"
              tabIndex={0}
              onClick={() => setSelectedMarkets([])}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedMarkets([]); } }}
              className="pp-mono"
              style={{ cursor: "pointer", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber-ink, var(--amber))" }}
            >
              Clear
            </span>
          </div>
          {/* Driven from PROP_GROUPS, not hard-coded markup -- the market list
              is expected to grow, and switching sport re-groups it for free. */}
          <div style={{ maxHeight: 296, overflowY: "auto", marginTop: 10 }}>
            {marketGroups.map((g) => (
              <div key={g.label} style={{ marginBottom: 12 }}>
                <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 7 }}>
                  {g.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {g.markets.map((m) => {
                    const on = selectedMarkets.includes(m.id);
                    return (
                      <span
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={on}
                        onClick={() => setSelectedMarkets(on ? selectedMarkets.filter((x) => x !== m.id) : [...selectedMarkets, m.id])}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedMarkets(on ? selectedMarkets.filter((x) => x !== m.id) : [...selectedMarkets, m.id]); } }}
                        className="pp-mono"
                        style={{
                          cursor: "pointer", fontSize: 11, letterSpacing: "0.05em",
                          borderRadius: 4, padding: "5px 9px",
                          background: on ? "var(--amber)" : "transparent",
                          color: on ? "var(--accent-on)" : "var(--text-2, var(--dim))",
                          border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                        }}
                      >
                        {m.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 16 }}>
            <MinSampleControl
              value={minGames}
              onChange={setMinGames}
              presets={samplePresets}
              onSetPresets={updateSamplePresets}
              compact
            />
          </div>

          <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 16 }}>
            <div className="pp-mono" style={{ ...LABEL, fontSize: 10.5, letterSpacing: "0.14em", marginBottom: 10 }}>Split</div>
            {SPLITS.map((s) => {
              const on = activeSplits.includes(s.id);
              return (
                <div
                  key={s.id}
                  role="checkbox"
                  aria-checked={on}
                  tabIndex={0}
                  onClick={() => toggleSplit(s.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSplit(s.id); } }}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0", fontSize: 14, color: "var(--text-2, var(--dim))" }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: 3, flexShrink: 0, boxSizing: "border-box",
                    background: on ? "var(--amber)" : "transparent",
                    border: on ? "1px solid var(--amber)" : "1px solid var(--line)",
                  }} />
                  {s.label}
                </div>
              );
            })}
          </div>

          {disclaimer && (
            <div className="pp-mono" style={{
              marginTop: 16, padding: 12, borderRadius: 4,
              background: "var(--surface-sunken)", border: "1px solid var(--line)",
              fontSize: 10.5, lineHeight: 1.5, color: "var(--dim)",
            }}>
              {disclaimer}
            </div>
          )}
        </div>

        {/* ---- Prop table ---- */}
        <div style={{ minWidth: 0 }}>
          <div className="board-grid" style={{
            display: "grid", gridTemplateColumns: GRID, gap: 16, padding: "14px 20px",
            background: "var(--surface-sunken)", border: "1px solid var(--line)",
            borderBottom: "none", borderRadius: "6px 6px 0 0",
          }}>
            <span className="pp-mono" style={LABEL}>Player</span>
            <span className="pp-mono" style={LABEL}>Prop</span>
            <span className="pp-mono" style={LABEL}>Hit rate · sample</span>
            <span className="pp-mono" style={LABEL}>Last 8 vs. line</span>
            <span className="pp-mono" style={{ ...LABEL, textAlign: "right" }}>Verdict</span>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "0 0 6px 6px" }}>
            {shown.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", color: "var(--dim)", fontSize: 14, lineHeight: 1.6 }}>
                {rows.length === 0
                  ? "No props have loaded for this league yet."
                  : selectedMarkets.length
                    ? "No props match the markets selected in the rail. Clear them to see the rest of the slate."
                    : "No props to show."}
              </div>
            ) : shown.map((g) => (
              <div key={g.key}>
                <div style={{
                  display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap",
                  padding: "12px 20px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)",
                }}>
                  <span className="pp-mono" style={{ fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>{g.label}</span>
                  {g.time && <span className="pp-mono" style={{ fontSize: 11.5, color: "var(--text-2, var(--dim))" }}>{g.time}</span>}
                  <span className="pp-mono" style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--amber-ink, var(--amber))" }}>
                    {g.rows.length} {g.rows.length === 1 ? "prop" : "props"}
                  </span>
                </div>
                {g.rows.map((r, i) => (
                  <BoardRow
                    key={r.key}
                    row={r}
                    minGames={minGames}
                    activeSplits={activeSplits}
                    isLast={i === g.rows.length - 1}
                    onOpen={onOpenProp}
                  />
                ))}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
            {grouped.length > shown.length && (
              <span
                role="button"
                tabIndex={0}
                onClick={() => setVisibleGames((v) => v + 10)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setVisibleGames((v) => v + 10); } }}
                className="pp-mono"
                style={{
                  cursor: "pointer", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
                  color: "var(--amber-ink, var(--amber))", border: "1px solid var(--amber)",
                  borderRadius: 4, padding: "10px 16px",
                }}
              >
                Show {Math.min(10, grouped.length - shown.length)} more games
              </span>
            )}
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              {[["cleared the line", "fill"], ["fell short", "outline"], ["the line", "dash"]].map(([label, kind]) => (
                <span key={label} className="pp-mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-2, var(--dim))" }}>
                  {kind === "fill" && <span style={{ width: 7, height: 14, background: "var(--pos)", borderRadius: 2 }} />}
                  {kind === "outline" && <span style={{ width: 7, height: 14, border: "1.5px solid var(--neg)", borderRadius: 2, boxSizing: "border-box" }} />}
                  {kind === "dash" && <span style={{ width: 14, borderTop: "1.5px dashed var(--text)" }} />}
                  {label}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardRow({ row, minGames, activeSplits, isLast, onOpen }) {
  const split = rateFor(row, activeSplits);
  const n = split ? split.n : 0;
  const rate = split ? split.rate : null;
  // The rule the README singles out as critical: a split recomputes the rate
  // and its stated sample together, so a split that drops the sample below the
  // minimum flips the row to TOO FEW rather than showing a percentage over
  // three games.
  const thin = rate == null || n < minGames;
  const open = row.playerId && onOpen ? () => onOpen(row.sport, row.playerId, row.marketId, { name: row.name, team: row.team }) : null;

  // Verdicts ride the accent, never green or red: green and red mean cleared
  // and fell short on the bars in this same row, and a green verdict pill
  // would overload the colour two inches from where it means something else.
  const verdict = thin ? "Too few" : rate >= 0.6 ? "Leans over" : rate <= 0.4 ? "Leans under" : "Coin flip";
  const verdictLeans = !thin && (rate >= 0.6 || rate <= 0.4);

  const bars = (split && split.games.length ? split.games : row.recent || []).slice(-8);

  return (
    <div
      className="board-grid feed-row"
      role={open ? "button" : undefined}
      tabIndex={open ? 0 : undefined}
      onClick={open || undefined}
      onKeyDown={open ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } : undefined}
      style={{
        display: "grid", gridTemplateColumns: GRID, gap: 16, alignItems: "center",
        padding: "14px 20px", cursor: open ? "pointer" : "default",
        borderBottom: isLast ? "none" : "1px solid var(--line)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <PlayerAvatar
          name={row.name}
          alt={row.name}
          sport={row.sport}
          team={row.team}
          headshotSrc={row.avatar}
          fallbackSrc={row.avatarFallback}
          status={row.status}
          size={38}
          inset={2}
          surface="var(--panel)"
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</div>
          <div className="pp-mono" style={{ fontSize: 11.5, color: "var(--text-2, var(--dim))", marginTop: 2 }}>
            {row.team}{row.pos ? ` · ${row.pos}` : ""}
          </div>
        </div>
      </div>

      <div className="pp-mono" style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text)" }}>
        {row.subtitle}
      </div>

      <div>
        {thin ? (
          <>
            <div className="pp-mono" style={{ fontSize: 14, color: "var(--text)" }}>Too few</div>
            <div className="pp-mono" style={{ fontSize: 11.5, color: "var(--text-2, var(--dim))", marginTop: 3 }}>{n} {n === 1 ? "game" : "games"}</div>
          </>
        ) : (
          <>
            <div className="pp-mono" style={{ fontSize: 22, color: "var(--amber-ink, var(--amber))" }}>{Math.round(rate * 100)}%</div>
            <div className="pp-mono" style={{ fontSize: 11.5, color: "var(--text-2, var(--dim))", marginTop: 3 }}>{split.over} of {n} games</div>
          </>
        )}
      </div>

      {/* The compact treatment: no tag, no caption. A short sample draws only
          the games it has and holds the rest of the width open, so bars stay
          on the same track down the column instead of stretching to fill. */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minWidth: 0 }}>
        {bars.length > 0 ? (
          <>
            <div style={{ flex: bars.length, minWidth: 0 }}>
              <FeedFormStrip
                r={{ recent: bars, line: row.line, isBinary: !!row.isBinary, subtitle: row.subtitle }}
                direction={row.direction || "over"}
                streak={null}
                height={34}
                gap={4}
                caption={false}
              />
            </div>
            {bars.length < 8 && <span style={{ flex: 8 - bars.length }} />}
          </>
        ) : (
          <span className="pp-mono" style={{ fontSize: 11.5, color: "var(--dim)" }}>no games logged</span>
        )}
      </div>

      <div style={{ textAlign: "right" }}>
        <span className="pp-mono" style={{
          display: "inline-block", borderRadius: 999, padding: "5px 10px",
          fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em",
          color: verdictLeans ? "var(--amber-ink, var(--amber))" : "var(--text-2, var(--dim))",
          border: `1px solid ${verdictLeans ? "var(--amber)" : "var(--line)"}`,
        }}>
          {verdict}
        </span>
      </div>
    </div>
  );
}
