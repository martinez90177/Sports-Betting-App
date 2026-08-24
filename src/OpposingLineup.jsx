import React from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { MLB_TEAM_COLORS } from "./lib/teamColors.js";
import { statcastFor } from "./lib/statcast.js";

const MONO = "'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

// The lineup he is facing, joined to Savant. Competitive brief item 2, mock 3b.
//
// Both halves of this have been in memory for a while and were never put
// together. The confirmed batting order arrives on the schedule request
// (`oppLineupIds`, hydrated with `lineups`), and the plate-discipline rates
// arrive in one league-wide Savant request that the usage pills already
// trigger. What was missing was the join.
//
// The ordering rule is the mock's and it is the point of the screen: the
// batters that most favour the prop lead, and the rest collapse behind a
// toggle. Nine rows of near-identical percentages is a table you scan and
// forget; three named as the reason is an argument. Nothing is hidden -- the
// toggle says how many and opens them.

const HEAD = {
  fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em",
  textTransform: "uppercase", color: "var(--dim)",
};
const GRID = "26px minmax(0,1fr) 46px 52px 52px 52px 52px";

const pct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

// Which Savant field each market cares about, and which direction helps the
// prop. Only the markets where a batter-level rate genuinely bears on the
// pitcher's line -- a strikeout prop is decided by who swings and misses, and
// nothing in this table speaks to earned runs.
const MARKET_LENS = {
  p_k: { field: "k_percent", high: true, measure: "K%" },
  p_bb: { field: "bb_percent", high: true, measure: "BB%" },
  p_h: { field: "xba", high: true, measure: "xBA" },
};

// The plate appearances a batter needs before his rate is allowed to decide
// the order of this table.
//
// Not decoration. Without it a September call-up with 49 plate appearances and
// a 38.8% strikeout rate leads the lineup as the batter who "most favours the
// strikeout prop", ahead of a regular at 29% over 536 -- and the whole
// argument of this app is that a rate without a sample behind it is not a
// finding. 100 is the same floor lib/statcast.js uses for its percentile
// population, for the same reason.
//
// Batters under it keep their row and their numbers. They are simply not
// ranked, which is a different statement from being hidden.
const RANK_MIN_PA = 100;

export default function OpposingLineup({
  teamLabel,
  teamAbbr,
  batters = [],
  posted = false,
  postedAt = null,
  market = "p_k",
}) {
  const [open, setOpen] = React.useState(false);
  const lens = MARKET_LENS[market] || MARKET_LENS.p_k;

  // The join. A batter with no Savant row keeps his slot and shows dashes --
  // dropping him would silently shorten the lineup, and a nine-hitter lineup
  // that renders eight rows is a lie about the game.
  const rows = React.useMemo(
    () => batters.map((b) => ({ ...b, sc: statcastFor(b.mlbId, "batter") })),
    [batters, market]
  );

  if (!rows.length) return null;

  const rated = rows.filter((r) => r.sc && r.sc[lens.field] != null);
  const rankable = rated.filter((r) => r.sc.b_total_pa != null && r.sc.b_total_pa >= RANK_MIN_PA);
  const ranked = [...rankable].sort((a, b) =>
    lens.high ? b.sc[lens.field] - a.sc[lens.field] : a.sc[lens.field] - b.sc[lens.field]
  );
  const top = ranked.slice(0, 3);
  // Each flagged row says where it actually stands rather than all three
  // repeating one sentence. "1st of 7 by K%" is a fact the reader can check
  // against the column beside it; "most favours the strikeout prop", printed
  // three times, is the same claim made three times.
  const rankLabel = new Map(top.map((r, i) => [r.mlbId, `${i + 1}${["st", "nd", "rd"][i]} of ${rankable.length} by ${lens.measure}`]));
  const flagged = new Set(top.map((r) => r.mlbId));
  const shown = open ? rows : rows.filter((r) => flagged.has(r.mlbId));
  const thin = rated.length - rankable.length;

  // The one-line summary. Counts, not an average dressed up as a verdict: how
  // many of them strike out in more than a quarter of their plate appearances
  // is a fact the reader can check against the rows underneath.
  const hard = rated.filter((r) => r.sc.k_percent != null && r.sc.k_percent >= 25).length;
  const meanK = rated.length
    ? rated.reduce((a, r) => a + (r.sc.k_percent || 0), 0) / rated.length
    : null;

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" }}>
          Expected lineup · {teamLabel || teamAbbr}
        </span>
        {/* Posted or projected, stated. The board already draws this
            distinction on its game cards and it means the same thing here:
            before the order is posted these rows are our projection, and a
            reader deciding off a leadoff spot needs to know which. */}
        <span style={{
          marginLeft: "auto", display: "flex", alignItems: "center", gap: 7,
          fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-2)",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999, flex: "none", boxSizing: "border-box",
            background: posted ? "var(--text-2)" : "transparent", border: "1.5px solid var(--text-2)",
          }} />
          {posted ? (postedAt ? `Posted ${postedAt}` : "Posted") : "Projected"}
        </span>
      </div>

      {rated.length > 0 && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", marginTop: 8, lineHeight: 1.6 }}>
          {hard} of the {rows.length} strike out in more than a quarter of plate appearances
          {meanK != null ? ` · lineup K% ${meanK.toFixed(1)}%` : ""}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, marginTop: 16, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
        <span />
        <span style={HEAD}>Batter</span>
        <span style={{ ...HEAD, textAlign: "right" }}>PA</span>
        <span style={{ ...HEAD, textAlign: "right" }}>K%</span>
        <span style={{ ...HEAD, textAlign: "right" }}>Whiff%</span>
        <span style={{ ...HEAD, textAlign: "right" }}>Chase%</span>
        <span style={{ ...HEAD, textAlign: "right" }}>BB%</span>
      </div>

      {shown.map((b) => {
        const on = flagged.has(b.mlbId);
        const k = b.sc ? b.sc.k_percent : null;
        return (
          <div
            key={b.mlbId || b.name}
            style={{
              display: "grid", gridTemplateColumns: GRID, gap: 8, alignItems: "center",
              padding: "10px 0", borderBottom: "1px solid var(--line)",
              background: on ? "var(--surface-sunken)" : "transparent",
            }}
          >
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 20, height: 20, borderRadius: 4, boxSizing: "border-box",
              fontFamily: MONO, fontSize: 9.5,
              color: on ? "var(--amber-ink)" : "var(--dim)",
              background: on ? "var(--surface-1)" : "transparent",
              border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
            }}>
              {b.order}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              {/* Rule 1: a named player carries an avatar, and the avatar
                  carries their availability. A posted lineup is itself the
                  strongest availability signal there is, but the dot is the
                  app's one way of saying so and it is not optional. */}
              <PlayerAvatar
                name={b.name}
                alt={b.name}
                sport="mlb"
                team={teamAbbr}
                colorMap={MLB_TEAM_COLORS}
                headshotSrc={b.headshot}
                status={b.status}
                surface="var(--bg)"
                size={26}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap" }}>{b.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", color: "var(--dim)", whiteSpace: "nowrap" }}>
                    {[b.hand, b.pos].filter(Boolean).join(" · ")}
                  </span>
                </div>
                {on && rankLabel.get(b.mlbId) && (
                  <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--amber-ink)", marginTop: 3 }}>
                    {rankLabel.get(b.mlbId)}
                  </div>
                )}
              </div>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 11, textAlign: "right", color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>
              {b.sc && b.sc.b_total_pa != null ? b.sc.b_total_pa : "—"}
            </span>
            <span style={{
              fontFamily: MONO, fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums",
              color: k == null ? "var(--dim)" : k >= 28 ? "var(--pos)" : k <= 20 ? "var(--neg)" : "var(--text)",
            }}>
              {pct(k)}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, textAlign: "right", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
              {pct(b.sc ? b.sc.whiff_percent : null)}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, textAlign: "right", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
              {pct(b.sc ? b.sc.oz_swing_percent : null)}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, textAlign: "right", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
              {pct(b.sc ? b.sc.bb_percent : null)}
            </span>
          </div>
        );
      })}

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0 0", flexWrap: "wrap" }}>
        <span
          role="button" tabIndex={0} aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minHeight: "var(--tap, 44px)" }}
        >
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--amber-ink)", width: 12 }}>{open ? "−" : "+"}</span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber-ink)" }}>
            {open ? `Show only the ${flagged.size} that matter` : `Show all ${rows.length} batters`}
          </span>
        </span>
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 9.5, color: "var(--dim)", lineHeight: 1.6, textAlign: "right" }}>
          Rates are season to date · Baseball Savant
          {/* Named, not silent. A reader who counts the rows and finds the
              ranking skipped somebody is owed the reason. */}
          {thin > 0 && (
            <>
              <br />
              {thin} {thin === 1 ? "batter is" : "batters are"} under {RANK_MIN_PA} plate appearances and {thin === 1 ? "is" : "are"} listed but not ranked
            </>
          )}
        </span>
      </div>
    </div>
  );
}
