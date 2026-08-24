import React from "react";
import { statcastFor, statcastPercentile, statcastMean, ordinal } from "./lib/statcast.js";

const MONO = "'Space Mono', ui-monospace, monospace";

// Two sides of one matchup, measure by measure. Competitive brief item 3,
// mock 3c.
//
// Bars run outward from the label rather than both from the left, which is the
// mock's device and the reason the screen works: two left-anchored bars are a
// ranking, and this is a comparison. Reading right-to-left on the left side
// takes a moment the first time and then never again.
//
// Everything here is computed off the league table lib/statcast.js already
// holds -- one request per side covers all of MLB -- so eight rows of
// percentiles cost eight passes over a Map and nothing over the network.

const MEASURES = [
  { label: "K%", field: "k_percent", decimals: 1, unit: "%" },
  { label: "Whiff%", field: "whiff_percent", decimals: 1, unit: "%" },
  { label: "Chase%", field: "oz_swing_percent", decimals: 1, unit: "%" },
  { label: "BB%", field: "bb_percent", decimals: 1, unit: "%" },
  { label: "Hard-hit%", field: "hard_hit_percent", decimals: 1, unit: "%" },
  { label: "Barrel%", field: "barrel_batted_rate", decimals: 1, unit: "%" },
  { label: "xBA", field: "xba", decimals: 3, unit: "" },
  { label: "xwOBA", field: "xwoba", decimals: 3, unit: "" },
];

const fmt = (v, m) => (v == null ? "—" : m.unit ? v.toFixed(m.decimals) + m.unit : v.toFixed(m.decimals));

export default function PercentilePair({
  leftLabel,
  rightLabel,
  // The individual: one mlbId, read against the league distribution for his
  // own side of the ball.
  leftId,
  leftKind = "pitcher",
  // The group: a set of mlbIds averaged, then placed against the same
  // distribution the individuals came from.
  rightIds = [],
  rightKind = "batter",
}) {
  const rows = React.useMemo(() => MEASURES.map((m) => {
    const rec = leftId != null ? statcastFor(leftId, leftKind) : null;
    const lv = rec && rec[m.field] != null ? rec[m.field] : null;
    const lp = lv != null ? statcastPercentile(lv, m.field, leftKind) : null;

    const mean = statcastMean(rightIds, m.field, rightKind);
    // The lineup's mean is placed against the distribution of INDIVIDUAL
    // batters, and that is worth being explicit about: a mean of nine varies
    // less than any one of them, so a lineup will sit closer to the middle
    // than its hitters do. The footnote says so. Ranking nine-man means
    // against other nine-man means would be the stricter answer and needs
    // every team's posted lineup, which does not exist before first pitch.
    const rp = mean ? statcastPercentile(mean.value, m.field, rightKind) : null;

    return { m, lv, lp, rv: mean ? mean.value : null, rp, rn: mean ? mean.n : 0 };
  }), [leftId, leftKind, rightIds, rightKind]);

  const anything = rows.some((r) => r.lv != null || r.rv != null);
  if (!anything) return null;

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase" }}>{leftLabel}</div>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase" }}>{rightLabel}</div>
      </div>

      <div style={{ marginTop: 14 }}>
        {rows.map(({ m, lv, lp, rv, rp }) => (
          <div key={m.label} style={{ display: "grid", gridTemplateColumns: "1fr 92px 1fr", gap: 14, alignItems: "center", padding: "11px 0", borderTop: "1px solid var(--line)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "flex-end" }}>
                <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>
                  {lp == null ? "" : ordinal(lp)}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 13, fontVariantNumeric: "tabular-nums", color: lv == null ? "var(--dim)" : "var(--text)" }}>
                  {fmt(lv, m)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <div style={{ height: 4, borderRadius: 2, width: "100%", background: "var(--surface-2)", display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ height: 4, borderRadius: 2, width: `${lp || 0}%`, background: "var(--amber)" }} />
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-2)" }}>
              {m.label}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontVariantNumeric: "tabular-nums", color: rv == null ? "var(--dim)" : "var(--text)" }}>
                  {fmt(rv, m)}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>
                  {rp == null ? "" : ordinal(rp)}
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, marginTop: 6, background: "var(--surface-2)" }}>
                <div style={{ height: 4, borderRadius: 2, width: `${rp || 0}%`, background: "var(--amber-ink, var(--amber))" }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: MONO, fontSize: 9.5, color: "var(--dim)", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)", lineHeight: 1.6 }}>
        Percentiles are against the league table already cached for the usage pills, among players who
        have cleared a qualifying workload — without that floor a hitter with nine plate appearances
        sets the extremes and everybody real looks average. The right column averages the lineup and
        places that average among individual batters, so it will always sit nearer the middle than its
        own hitters do.
      </div>
    </div>
  );
}
