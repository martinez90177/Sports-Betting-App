import React from "react";

const MONO = "'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

// Where the game is played, and what that is worth. Competitive brief item 7,
// mock 3f.
//
// The mock's own framing is the thing to keep: park factors are static and
// always present, weather is a dependency, and the block still stands when the
// forecast is missing. So the two are drawn as separate rows with separate
// failure states rather than as one "conditions" paragraph that disappears
// whole -- which is what the MLB page's old narrative strip did, and why it
// only ever appeared on one sport.
//
// Bars run either side of centre because a park factor is a deviation, not a
// quantity. A single left-anchored bar for "+4%" and one for "-3%" look like
// two amounts of the same thing; from a centre line they read as the opposite
// directions they are.

const LABEL = {
  fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em",
  textTransform: "uppercase", color: "var(--dim)",
};

function Cell({ label, value }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--dim)" }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 15, marginTop: 5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

export default function GameConditions({
  venue,
  fixture,
  time,
  // { temp, wind, precipPct } or null. Null is a state, not an omission --
  // see `noForecastReason`.
  weather = null,
  // Why there is no forecast, in the reader's terms: "dome", "indoor",
  // "unknown" (we have no coordinates for this venue), or "pending" (the
  // request has not landed yet).
  noForecastReason = null,
  // [{ label, value }] where value is a percentage deviation from league
  // average. Empty for sports that have no published park factors.
  parkFactors = [],
  parkEntered = null,
  verdict = null,
}) {
  if (!venue && !weather && !parkFactors.length) return null;

  const cells = [];
  if (weather) {
    if (weather.temp != null) cells.push({ label: "Temp", value: `${weather.temp}°F` });
    if (weather.wind) cells.push({ label: "Wind", value: weather.wind });
    if (weather.precipPct != null && weather.precipPct >= 20) {
      cells.push({ label: "Rain", value: `${weather.precipPct}%` });
    }
  }

  const reasonText = {
    dome: "Played indoors, so there is no forecast to give.",
    indoor: "Played indoors, so there is no forecast to give.",
    unknown: "No forecast for this venue yet.",
    pending: "Fetching the forecast…",
    horizon: "Kickoff is more than a week out, which is past what any forecast covers.",
    retractable: "Roof may be closed; whether it is on the day is not published, so no forecast is claimed.",
  }[noForecastReason] || "No forecast for this venue yet.";

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 17 }}>{venue || "Venue not known"}</span>
        {(fixture || time) && (
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)" }}>
            {[fixture, time].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>

      {cells.length > 0 ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 18, marginTop: 14, padding: "12px 14px",
          background: "var(--surface-sunken)", border: "1px solid var(--line)", borderRadius: 6, flexWrap: "wrap",
        }}>
          {cells.map((c, i) => (
            <div key={c.label} style={{ paddingLeft: i === 0 ? 0 : 18, borderLeft: i === 0 ? "none" : "1px solid var(--line)" }}>
              <Cell label={c.label} value={c.value} />
            </div>
          ))}
          <div style={{ marginLeft: "auto", textAlign: "right", fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)", lineHeight: 1.6 }}>
            Forecast at kickoff
          </div>
        </div>
      ) : (
        <div style={{
          marginTop: 14, padding: "12px 14px", background: "var(--surface-sunken)",
          border: "1px solid var(--line)", borderRadius: 6,
          fontFamily: MONO, fontSize: 10, color: "var(--dim)", lineHeight: 1.6,
        }}>
          {reasonText}
          {parkFactors.length > 0 && " The factors below are unaffected."}
        </div>
      )}

      {parkFactors.length > 0 && (
        <>
          <div style={{ ...LABEL, marginTop: 18 }}>
            Park factor{parkEntered ? " · published table" : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 11 }}>
            {parkFactors.map((p) => {
              // Half the track is 100% of the widest deviation this scale
              // shows. Clamped at 20 so Coors, at +18 for home runs, nearly
              // fills its side while a +2 park stays visibly close to average
              // -- an auto-scaled maximum would make every park look extreme
              // on its own strongest measure.
              const mag = Math.min(Math.abs(p.value), 20) / 20 * 50;
              const positive = p.value >= 0;
              return (
                <div key={p.label} style={{ display: "grid", gridTemplateColumns: "90px 1fr 58px", gap: 12, alignItems: "center" }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-2)" }}>{p.label}</span>
                  <div style={{ position: "relative", height: 6, borderRadius: 3, background: "var(--surface-2)" }}>
                    <span style={{ position: "absolute", left: "50%", top: -3, bottom: -3, width: 1, background: "var(--line)" }} />
                    <div style={{
                      position: "absolute", top: 0, height: 6, borderRadius: 3,
                      left: positive ? "50%" : `${50 - mag}%`,
                      width: `${mag}%`,
                      background: positive ? "var(--amber-ink, var(--amber))" : "var(--text-2)",
                    }} />
                  </div>
                  <span style={{
                    fontFamily: MONO, fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums",
                    color: positive ? "var(--amber-ink, var(--amber))" : "var(--text-2)",
                  }}>
                    {positive ? "+" : "−"}{Math.abs(p.value)}%
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {(verdict || parkFactors.length > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
          {verdict && (
            <span style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--amber-ink, var(--amber))", border: "1px solid var(--amber)",
              borderRadius: 999, padding: "5px 11px", flex: "none",
            }}>
              {verdict}
            </span>
          )}
          {/* Says what these numbers are and, just as importantly, what they
              are not. A park factor is a record of what a stadium has done,
              and reading it as a prediction for one game is the mistake this
              line exists to head off. */}
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: "var(--dim)", lineHeight: 1.6, flex: 1, minWidth: 180 }}>
            Published park factors, not a projection. Bars run either side of league average.
            {parkEntered ? ` Entered ${parkEntered}.` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
