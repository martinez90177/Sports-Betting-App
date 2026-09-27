import React, { useEffect, useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { crest } from "./v3/FormPlot.jsx";
import useIsNarrow from "./lib/useIsNarrow.js";
import { fetchNflWeeklyMismatches } from "./lib/nflMismatch.js";

// --------------------------------------------------------------------------
// This week's real NFL mismatches.
// --------------------------------------------------------------------------
// Every number here is one this app already fetches for another screen (see
// lib/nflMismatch.js for which). Nothing is written by a model and nothing is
// seeded -- a team or player this page can't get a real answer for is left
// off rather than filled in, same rule as everywhere else in the app.
//
// Two things the source artifact this was modelled on had that this
// deliberately does not:
//   - A moneyline/spread ticket with real book lines. NFL has no real-odds
//     feed here (see lib/PROJECT_NOTES.md "Free data only no fake edge") and
//     wiring one up would spend the same tight Odds API budget the MLB odds
//     panel already runs against.
//   - Prose explaining why a spot is good. That's a model's voice describing
//     numbers it didn't measure; this reads the numbers instead.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const TIER_META = {
  SMASH: { label: "SMASH SPOT", color: "var(--pos)" },
  FAV: { label: "FAVORABLE", color: "var(--amber-ink)" },
  LEAN: { label: "LEAN", color: "var(--text-2)" },
};
const ROW_LABEL = { passYds: "pass D", rushYds: "rush D" };
const ROW_SENTENCE = { passYds: "against the pass", rushYds: "against the run" };
const POS_ORDER = ["QB", "RB", "WR", "TE"];

function ordinal(n) {
  if (n == null) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function rankText(cell) {
  if (!cell || !cell.of) return null;
  return `${cell.tied ? "T" : ""}${ordinal(cell.rank)} of ${cell.of}`;
}

function micro(extra) {
  return { fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)", ...extra };
}

function Filter({ label, on, onClick }) {
  return (
    <span
      role="button" tabIndex={0} aria-pressed={on}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="pp-mono"
      style={{
        fontSize: 11, letterSpacing: "0.06em", padding: "7px 12px", borderRadius: 8,
        cursor: "pointer", whiteSpace: "nowrap",
        border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
        background: on ? "var(--amber-dim)" : "var(--surface-1)",
        color: on ? "var(--amber-ink)" : "var(--text-2)",
      }}
    >
      {label}
    </span>
  );
}

function Card({ card, narrow }) {
  const tier = TIER_META[card.tier];
  const label = ROW_LABEL[card.rowId];
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 10, padding: narrow ? 14 : 16,
        border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <PlayerAvatar
            name={card.player.name} alt={card.player.name} sport="nfl"
            team={card.team} espnId={card.player.espnId} status={card.status}
            size={narrow ? 40 : 44} surface="var(--surface-1)"
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {card.player.name}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11.5, color: "var(--text-2)", marginTop: 2 }}>
              <span role="img" style={crest(card.team, "nfl", 14)} />
              {card.team} · {card.pos} vs {card.opp}
            </div>
          </div>
        </div>
        <span
          className="pp-mono"
          style={{
            flex: "none", fontSize: 10.5, letterSpacing: "0.06em", padding: "5px 9px", borderRadius: 7,
            color: tier.color, border: `1px solid ${tier.color}`, whiteSpace: "nowrap",
          }}
        >
          {tier.label}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--surface-2)", borderRadius: 9, padding: "10px 12px" }}>
          <div style={{ ...micro(), lineHeight: 1.5 }}>{card.opp} {label} · this season</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: "var(--pos)", flex: "none" }}>
            {rankText(card.defCurrent) || "—"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--surface-2)", borderRadius: 9, padding: "10px 12px" }}>
          <div style={{ ...micro(), lineHeight: 1.5 }}>{card.opp} {label} · last season</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, flex: "none" }}>
            {rankText(card.defPrior) || "—"}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
        {card.opp} ranks {rankText(card.defCurrent) || "unranked"} in the league {ROW_SENTENCE[card.rowId]} this season
        {card.defPrior ? ` (${rankText(card.defPrior)} last season)` : ""} — 1st is the league's best defense on that stat, so the higher the number the softer the matchup.
      </div>
    </div>
  );
}

export default function MismatchReportPage() {
  const narrow = useIsNarrow(760);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [pos, setPos] = useState("ALL");
  const [tier, setTier] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchNflWeeklyMismatches()
      .then((res) => { if (alive) setData(res); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  const cards = data?.cards || [];
  const filtered = useMemo(
    () => cards.filter((c) => (pos === "ALL" || c.pos === pos) && (!tier || c.tier === tier)),
    [cards, pos, tier]
  );
  const grouped = useMemo(() => {
    const by = {};
    filtered.forEach((c) => { (by[c.pos] = by[c.pos] || []).push(c); });
    return POS_ORDER.map((p) => [p, by[p] || []]).filter(([, list]) => list.length);
  }, [filtered]);

  const gameCount = data?.games?.length || 0;
  const smashCount = cards.filter((c) => c.tier === "SMASH").length;

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: narrow ? "16px 16px 40px" : "28px 24px 60px" }}>
      <div style={micro({ marginBottom: 8 })}>NFL · WEEKLY MISMATCH REPORT</div>
      <h1 style={{ fontFamily: DISPLAY, fontSize: narrow ? 26 : 34, fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
        This week's softest matchups
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, maxWidth: "60ch", marginTop: 10 }}>
        Every starter below is read off this week's real depth charts against the opposing defense's real
        pass/rush yards-allowed rank, blended 60% this season and 40% last season. There is no sportsbook line
        or win probability here — see the note at the bottom for why.
      </p>

      {data?.ready && (
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <div style={{ ...micro(), color: "var(--text-2)" }}>
            {gameCount} game{gameCount === 1 ? "" : "s"} · {cards.length} starters · {smashCount} smash spots
          </div>
          {data.teamsLoaded < data.teamsTotal && (
            <div style={{ ...micro(), color: "var(--amber-ink)" }}>
              {data.teamsLoaded} of {data.teamsTotal} teams' defense stats loaded — the rest are left off, not guessed
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 20 }}>
        {["ALL", "QB", "RB", "WR", "TE"].map((p) => (
          <Filter key={p} label={p} on={pos === p} onClick={() => setPos(p)} />
        ))}
        <span style={{ width: 1, background: "var(--line)", margin: "2px 4px" }} />
        {["SMASH", "FAV", "LEAN"].map((t) => (
          <Filter key={t} label={TIER_META[t].label} on={tier === t} onClick={() => setTier((v) => (v === t ? null : t))} />
        ))}
      </div>

      {!data && !error && (
        <div style={{ marginTop: 30, fontSize: 13, color: "var(--dim)" }}>Reading this week's real slate, defense ranks and depth charts…</div>
      )}
      {(error || (data && !data.ready)) && (
        <div style={{ marginTop: 30, fontSize: 13, color: "var(--dim)" }}>
          Couldn't load this week's report — one of the real data sources it needs (this week's slate, team defense
          stats or depth charts) didn't answer. Try again shortly.
        </div>
      )}
      {data?.ready && !cards.length && (
        <div style={{ marginTop: 30, fontSize: 13, color: "var(--dim)" }}>
          Nothing cleared the LEAN threshold on this slate — every matchup graded closer to average than soft.
        </div>
      )}

      {grouped.map(([p, list]) => (
        <div key={p} style={{ marginTop: 28 }}>
          <div style={{ ...micro(), fontSize: 11, marginBottom: 10 }}>{p} · {list.length}</div>
          <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 12 }}>
            {list.map((c) => <Card key={c.id} card={c} narrow={narrow} />)}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 40, paddingTop: 18, borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--dim)", lineHeight: 1.6 }}>
        No moneyline, spread or win-probability numbers appear here — this app's only real sportsbook odds run
        against a small monthly budget already committed to the MLB odds panel, and a made-up line would be worse
        than none. Availability dots come from each team's live ESPN roster; a player with no dot has no status on
        record, not a clean bill of health.
      </div>
    </div>
  );
}
