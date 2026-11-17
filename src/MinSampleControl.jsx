import React, { useState } from "react";

// --------------------------------------------------------------------------
// Minimum sample
// --------------------------------------------------------------------------
// "Show me only props with enough history to mean anything."
//
// Spec: `design_handoff_proppalace_full/README.md`, in the board's filter rail
// and again in the mobile refine sheet. Built once here because those are two
// surfaces asking for one control, and the rule underneath it is the app's
// single most load-bearing invariant.
//
// ---- What it does NOT do ----
//
// It does not filter rows out. A prop under the minimum **still appears; it
// just shows no rate**. That is stated in the handoff and restated in the note
// this control prints under itself, and it is the whole point: hiding thin
// rows would quietly answer "is there anything here?" with "no", when the
// honest answer is "yes, but not enough games to say anything about it". The
// app's rule 4 -- nothing is ever silently dropped -- says the same thing.
//
// So `minGames` is a *display* threshold. It raises the bar at which a rate is
// allowed to be printed at all, and the row keeps its place either way.
//
// ---- The ticks ----
//
// Seventeen of them, one NFL regular season, rendered as clickable bars rather
// than an <input type="range">. Each is its own 44px-tall touch target, which
// a range thumb is not, and the stepped heights read as "more games = more
// evidence" without a legend. Bars at or below the current value take the
// accent; the rest stay --line.

const STORAGE_KEY = "propPalaceSamplePresets";

// ---------------------------------------------------------------------------
// The scale is per sport, because a season is.
// ---------------------------------------------------------------------------
// This control was built against a 17-game NFL season and hardcoded to it: a
// 17-bar tick scale, presets of 5/9/12, and a validator that threw away any
// saved value above 17. On MLB that made the whole thing meaningless -- a
// batter plays ~150 games, so every prop cleared the highest minimum the
// control could even express, and the ticks were a 17-step scale on a
// 162-game season.
//
//   max      the top of the scale, and the ceiling a saved preset may reach.
//            Not the season length: it is the point past which raising the
//            minimum stops telling you anything new, which is well short of
//            162 for baseball.
//   presets  the chips, in that sport's own units.
//   floor    the default minimum, which has to be one of the presets or the
//            control opens with nothing selected.
//
// NFL keeps exactly what it had. It was the one sport the old numbers fitted.
//   season   the real season length, which `max` is deliberately not. The
//            control says which it is scaled to, so a chip set that changes
//            when you switch sport is explained by the thing next to it.
export const SAMPLE_SCALE = {
  nfl:  { max: 17, presets: [5, 9, 12],   floor: 9,  season: 17 },
  wnba: { max: 40, presets: [10, 20, 30], floor: 10, season: 44 },
  nba:  { max: 60, presets: [10, 20, 40], floor: 10, season: 82 },
  mlb:  { max: 80, presets: [15, 30, 50], floor: 15, season: 162 },
};
export const sampleScale = (sport) => SAMPLE_SCALE[sport] || SAMPLE_SCALE.nfl;

// The tick scale this replaced drew eighteen bars whatever the sport, so on
// MLB each bar stood for 4.4 games and no bar was a step you could land on.
// The label under the cursor was doing all the work, which is why it read as a
// lie: the scale asserted a granularity the control did not have.
// The stops the track names. The presets plus the top of the scale, which is
// what a reader actually aims at -- everything between them is still
// selectable by dragging, it just is not labelled.
export const stopValues = (sport) => {
  const { presets, max } = sampleScale(sport);
  return [...new Set([...presets, max])].sort((a, b) => a - b);
};

// Off by default. `1` rather than `0` because "at least one finished game" is
// the weakest true statement, not "zero games is fine".
export const MIN_SAMPLE_ALL = 1;

// Presets are stored per sport. One shared list meant setting a useful MLB
// minimum overwrote the NFL chips with numbers that cover most of its season.
const keyFor = (sport) => `${STORAGE_KEY}:${sport || "nfl"}`;

export function loadSamplePresets(sport) {
  const { max, presets } = sampleScale(sport);
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(sport)) || "null");
    if (!Array.isArray(raw)) return presets;
    // Validated the same way share-link filters are: this is user-writable
    // storage, and a junk value here would render as a junk chip forever.
    const clean = raw
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= max)
      .map((n) => Math.round(n));
    return clean.length ? [...new Set(clean)].sort((a, b) => a - b) : presets;
  } catch {
    return presets;
  }
}

// The last value each sport was left on.
//
// Design's spec, and it is better than clamping blind: leave MLB at 50+, go to
// NFL and come back, and 50+ is still there. Only a *first* visit to a sport
// inherits anything, and when the inherited number cannot stand there it is
// clamped and the control says why -- which is two different sentences,
// because they are two different problems. 50+ on a 17-game season is out of
// reach; 17+ on a 44-game season is merely not one of its stops.
const VALUE_KEY = "propPalaceMinSample";
const valueKeyFor = (sport) => `${VALUE_KEY}:${sport || "nfl"}`;

export function loadSampleValue(sport) {
  const { max, floor } = sampleScale(sport);
  try {
    const raw = Number(localStorage.getItem(valueKeyFor(sport)));
    if (!Number.isFinite(raw) || raw < 1) return null;
    return Math.min(max, Math.round(raw));
  } catch {
    return null;
  }
}

export function saveSampleValue(sport, value) {
  try {
    localStorage.setItem(valueKeyFor(sport), String(value));
  } catch {
    // Quota or private mode. The session still works.
  }
}

// What this sport should open on, and what to say about it. `carried` is the
// value being inherited from the sport just left -- null on a cold start.
export function seedSampleValue(sport, carried) {
  const { max, floor, season } = sampleScale(sport);
  const remembered = loadSampleValue(sport);
  if (remembered != null) return { value: remembered, note: null };
  if (carried == null || carried === floor) return { value: floor, note: null };
  // Two different problems, so two different sentences.
  if (carried > max) {
    return {
      value: max,
      note: `${carried}+ is out of reach on a ${season}-game season — set to ${max}+.`,
    };
  }
  const stops = stopValues(sport);
  if (!stops.includes(carried)) {
    // Falls back to this sport's own floor rather than keeping the number.
    //
    // It used to carry it, and the number it carried was a different sport's
    // idea of a sample. MLB's floor is 15 of 162; football's season is 17, so
    // 15 arrives *legal* (under NFL's max of 17) and lands above every chip on
    // the scale — nothing lights up, and the feed quietly demands 15 of a
    // 17-game season. Every NFL row with a normal starter's log then read
    // "too few", which is what Alex was looking at: 3 of 4 and 5 of 7 with no
    // rate and no visible reason.
    //
    // A value that is not a stop on this scale is not a choice anybody made
    // *for this sport*, so it is not honoured as one. The note says what
    // happened instead of moving silently.
    return {
      value: floor,
      note: `${carried}+ does not sit on a ${season}-game season — set to this sport's ${floor}+.`,
    };
  }
  return { value: carried, note: null };
}

export function saveSamplePresets(sport, presets) {
  try {
    localStorage.setItem(keyFor(sport), JSON.stringify(presets));
  } catch {
    // Quota or private mode. The in-memory list still works this session.
  }
}

export default function MinSampleControl({ value, onChange, presets, onSetPresets, sport = "nfl", compact = false, carriedNote = null }) {
  const { max: scaleMax, season } = sampleScale(sport);
  const stops = stopValues(sport);
  const [hover, setHover] = useState(null);
  const all = value <= MIN_SAMPLE_ALL;
  const shown = hover == null ? value : hover;

  const chip = (label, active, onClick, onDelete, title) => (
    <span
      key={label}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none",
        fontSize: 13, fontWeight: 600, borderRadius: 6, padding: compact ? "7px 12px" : "10px 14px",
        background: active ? "var(--amber)" : "transparent",
        color: active ? "var(--accent-on, #fff)" : "var(--text-2, var(--dim))",
        transition: "background 120ms ease, color 120ms ease",
      }}
    >
      {label}
      {onDelete && (
        // stopPropagation, or removing a preset also selects it on the way out
        // -- the handoff calls this out by name.
        <span
          role="button"
          aria-label={`Remove the ${label} preset`}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{ opacity: 0.6, fontWeight: 500, fontSize: 14, lineHeight: 1 }}
        >
          ×
        </span>
      )}
    </span>
  );

  const saved = presets.includes(value);
  // Where a value sits on the 1..max track, in percent. The fill, the thumb
  // and the stop labels all read this, so they line up.
  const pct = (n) => Math.max(0, Math.min(100, ((n - 1) / Math.max(1, scaleMax - 1)) * 100));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 650, color: "var(--text)" }}>
          Minimum sample
          {/* Names the season the scale is cut against, so a chip row that
              changes when you switch sport is explained by the thing beside
              it rather than being a surprise. */}
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: "var(--dim)" }}>
            of a {season}-game season
          </span>
        </span>
        <span className="tnum" style={{ fontSize: 15, fontWeight: 700, color: "var(--amber-ink, var(--amber))" }}>
          {all ? "No minimum" : `${shown}+ games`}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 10 }}>
      <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 2, padding: 3, borderRadius: 9, background: "var(--bg)", border: "1px solid var(--line)" }}>
        {presets.map((n) =>
          chip(
            `${n}+`,
            !all && value === n,
            () => onChange(n),
            () => onSetPresets(presets.filter((p) => p !== n)),
            `Only state a rate once a prop has ${n} finished games`
          )
        )}
        {chip("All", all, () => onChange(MIN_SAMPLE_ALL), null, "State a rate on any sample, however small")}
      </div>
        {/* Reads `saved` rather than offering to add a duplicate, which is the
            behaviour the handoff specifies for this link. */}
        {!all && (
          <span
            role="button"
            tabIndex={0}
            onClick={() => { if (!saved) onSetPresets([...presets, value].sort((a, b) => a - b)); }}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !saved) { e.preventDefault(); onSetPresets([...presets, value].sort((a, b) => a - b)); } }}
            style={{
              display: "inline-flex", alignItems: "center",
              padding: "4px 2px", fontSize: 12.5, fontWeight: 600,
              color: saved ? "var(--dim)" : "var(--amber-ink, var(--amber))",
              cursor: saved ? "default" : "pointer",
            }}
          >
            {saved ? "✓ Saved preset" : `+ Save ${value}+ as a preset`}
          </span>
        )}
      </div>

      {/* A continuous track with named stops, not a row of ticks.
           Every value between 1 and the top of the scale is selectable by
           dragging; the stops underneath are the ones worth aiming at, and
           they are the sport's own presets plus its ceiling. The old bar row
           could only offer eighteen positions whatever the season length,
           which on MLB meant no bar was a number you could actually land on.

           44px of height for the same reason it had it before: the track is a
           touch target, and only the 4px rail is painted. */}
      <div style={{ position: "relative", height: compact ? 36 : 44, marginTop: compact ? 6 : 12, display: "flex", alignItems: "center" }}>
        <span style={{
          position: "absolute", left: 0, right: 0, height: 4, borderRadius: 999,
          background: "var(--line)", pointerEvents: "none",
        }} />
        <span style={{
          position: "absolute", left: 0, height: 4, borderRadius: 999,
          width: all ? 0 : `calc(9px + (100% - 18px) * ${pct(shown) / 100})`,
          background: "var(--amber)", pointerEvents: "none",
        }} />
        <input
          className="pp-range"
          type="range"
          min={1}
          max={scaleMax}
          step={1}
          value={all ? 1 : value}
          aria-label="Minimum games"
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseMove={(e) => setHover(Number(e.target.value))}
          onMouseLeave={() => setHover(null)}
          style={{ position: "relative", width: "100%", margin: 0, height: compact ? 36 : 44, cursor: "pointer" }}
        />
      </div>

      {/* The stops, clickable in their own right -- a labelled number you can
           read but not press is a worse control than one you can. Each sits
           under the point on the track it names; spacing them evenly put the
           9 label nowhere near the 9 on the slider. */}
      <div style={{ position: "relative", height: 16, marginTop: 2 }}>
        {stops.map((n) => (
          <span
            key={n}
            role="button"
            tabIndex={0}
            onClick={() => onChange(n)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(n); } }}
            title={`Only state a rate once a prop has ${n} finished games`}
            style={{
              position: "absolute", top: 0, left: `calc(9px + (100% - 18px) * ${pct(n) / 100})`,
              transform: "translateX(-50%)",
              fontSize: 12, fontWeight: !all && value === n ? 700 : 500, cursor: "pointer",
              fontVariantNumeric: "tabular-nums",
              color: !all && value === n ? "var(--amber-ink, var(--amber))" : "var(--dim)",
            }}
          >
            {n}
          </span>
        ))}
      </div>

      {/* Why the number moved, when it moved. Never silent: a value that
           changed itself between sports and said nothing is the same class of
           problem as a rate with no sample. */}
      {carriedNote && (
        <div style={{ fontSize: 12, color: "var(--amber-ink, var(--amber))", marginTop: 10, lineHeight: 1.5 }}>
          {carriedNote}
        </div>
      )}

      <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 10, lineHeight: 1.5 }}>
        {all
          ? "Every prop states a rate, however few games are behind it."
          : `Props under ${value} games still appear, without a rate.`}
      </div>
    </div>
  );
}
