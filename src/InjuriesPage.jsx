import React, { useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import TeamLogo from "./TeamLogo.jsx";
import { TEAM_COLORS_BY_SPORT, STATUS } from "./lib/teamColors.js";

const MONO = "'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

// The injury wire, given room to be read.
//
// It was a rail module on the News page: one narrow column, 69 players, and
// the only way through it was scrolling a box the height of a phone. Alex:
// "injury wire being moved to a bigger section or its own page is a good idea,
// I also would like a way to sort injuries by sports". So: its own page, in
// columns, filterable.
//
// The thing this screen must not do is imply coverage it does not have. Two of
// the four leagues publish an availability feed we can read; the other two
// publish nothing, and a filter row listing all four with two of them silently
// empty would read as "nobody in the NFL is hurt". The leagues without a feed
// are named, as a sentence, at the bottom of the rail.

const LABEL = {
  fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em",
  textTransform: "uppercase", color: "var(--dim)",
};

const STATUS_ORDER = { questionable: 0, out: 1, active: 2 };
const STATUS_WORD = { questionable: "Quest", out: "Out", active: "Active" };

function Pill({ label, count, on, onPick, style }) {
  return (
    <span
      role="button" tabIndex={0} aria-pressed={on}
      onClick={onPick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } }}
      className="pp-mono"
      style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
        fontSize: 10.5, letterSpacing: "0.06em", borderRadius: 4, padding: "8px 10px",
        cursor: "pointer", whiteSpace: "nowrap",
        background: on ? "var(--amber)" : "transparent",
        color: on ? "var(--accent-on)" : "var(--text-2)",
        border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
        ...style,
      }}
    >
      {label}
      {count != null && <span style={{ fontSize: 9, color: on ? "inherit" : "var(--dim)", fontVariantNumeric: "tabular-nums" }}>{count}</span>}
    </span>
  );
}

export default function InjuriesPage({
  rows = [],
  // Which leagues have an availability feed at all, so the page can name the
  // ones that do not instead of showing them as empty.
  coveredSports = [],
  uncoveredSports = [],
  // (sport, teamAbbr) => ISO kickoff, or null when that team is not on a
  // slate we hold. Optional: without it the page simply does not offer the
  // "playing next" sort rather than offering one that cannot work.
  kickoffFor = null,
  onOpenProp,
  loading = false,
}) {
  const [sport, setSport] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(kickoffFor ? "kickoff" : "name");

  const now = Date.now();
  const NEAR_MS = 48 * 60 * 60 * 1000;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const kickoff = (r) => {
      const iso = kickoffFor ? kickoffFor(r.sport, r.team) : null;
      const t = iso ? new Date(iso).getTime() : NaN;
      return Number.isFinite(t) ? t : null;
    };
    const decorated = rows
      .filter((r) => sport === "all" || r.sport === sport)
      .filter((r) => status === "all" || r.status === status)
      .filter((r) => !needle || r.name.toLowerCase().includes(needle) || (r.team || "").toLowerCase().includes(needle))
      .map((r) => {
        const t = kickoff(r);
        return { ...r, kickoff: t, playingSoon: t != null && t <= now + NEAR_MS && t >= now - 6 * 60 * 60 * 1000 };
      });

    if (sort === "kickoff") {
      // Playing soonest first, then by how urgent the designation is. A team
      // with no game on a slate we hold sorts last rather than being read as
      // playing at the epoch.
      return decorated.sort((a, b) =>
        (a.kickoff == null ? 1 : 0) - (b.kickoff == null ? 1 : 0)
        || (a.kickoff != null && b.kickoff != null ? a.kickoff - b.kickoff : 0)
        || (STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
        || a.name.localeCompare(b.name));
    }
    return decorated.sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || a.name.localeCompare(b.name));
  }, [rows, sport, status, q, sort, kickoffFor, now]);

  const playingSoon = list.filter((r) => r.playingSoon).length;

  const countBySport = (id) => (id === "all" ? rows.length : rows.filter((r) => r.sport === id).length);
  const countByStatus = (id) => {
    const inSport = rows.filter((r) => sport === "all" || r.sport === sport);
    return id === "all" ? inSport.length : inSport.filter((r) => r.status === id).length;
  };

  return (
    <div className="page-shell" style={{ maxWidth: 1600, margin: "0 auto", padding: "20px 22px 40px", boxSizing: "border-box" }}>
      {/* Template in index.css so the phone can collapse it -- see
          .pp-findings-grid. */}
      <div className="pp-findings-grid" style={{ display: "grid", gap: 22 }}>

        <div className="pp-findings-rail">
          <div style={LABEL}>League</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <Pill label="All" count={countBySport("all")} on={sport === "all"} onPick={() => setSport("all")} />
            {coveredSports.map((s) => (
              <Pill key={s.id} label={s.label} count={countBySport(s.id)} on={sport === s.id} onPick={() => setSport(s.id)} />
            ))}
          </div>

          <div style={{ ...LABEL, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>Status</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {[["all", "All"], ["questionable", "Questionable"], ["out", "Out"], ["active", "Active · watched"]].map(([id, label]) => (
              <Pill key={id} label={label} count={countByStatus(id)} on={status === id} onPick={() => setStatus(id)} />
            ))}
          </div>

          {/* Named, not omitted. A league filter that listed all four and
              returned nothing for two of them would read as "nobody in the NFL
              is hurt", which is the loudest possible way to be wrong. */}
          {uncoveredSports.length > 0 && (
            <div style={{
              marginTop: 20, padding: 12, border: "1px solid var(--line)", borderRadius: 6,
              background: "var(--surface-sunken)", fontFamily: MONO, fontSize: 9.5,
              color: "var(--dim)", lineHeight: 1.65,
            }}>
              {uncoveredSports.map((s) => s.label).join(" and ")} publish no availability designation this app can read,
              so {uncoveredSports.length === 1 ? "it is" : "they are"} not listed here at all rather than listed as healthy.
            </div>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 29, margin: 0, letterSpacing: "-0.02em" }}>Injury wire</h1>
              <div style={{ ...LABEL, marginTop: 6, letterSpacing: "0.1em", fontSize: 10.5 }}>
                {loading
                  ? "Reading designations…"
                  : sort === "kickoff"
                    ? `${list.length} listed · ${playingSoon} on a team playing in the next two days`
                    : `${list.length} listed · questionable first, because it is the only one still a decision`}
              </div>
            </div>
            {kickoffFor && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 2, border: "1px solid var(--line)", borderRadius: 6, padding: 2, background: "var(--surface-sunken)" }}>
                {[["kickoff", "Playing next"], ["name", "By status"]].map(([id, label]) => (
                  <span
                    key={id}
                    role="button" tabIndex={0} aria-pressed={sort === id}
                    onClick={() => setSort(id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSort(id); } }}
                    className="pp-mono"
                    style={{
                      fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 4,
                      padding: "7px 11px", cursor: "pointer", whiteSpace: "nowrap",
                      background: sort === id ? "var(--amber)" : "transparent",
                      color: sort === id ? "var(--accent-on)" : "var(--text-2)",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search players or teams…"
              aria-label="Search the injury wire"
              className="pp-mono"
              style={{
                minWidth: 210, fontSize: 12, padding: "9px 12px",
                background: "var(--surface-sunken)", border: "1px solid var(--line)",
                borderRadius: 6, color: "var(--text)", outline: "none",
              }}
            />
          </div>

          {!loading && list.length === 0 && (
            <div style={{
              marginTop: 16, padding: "22px 20px", background: "var(--surface-1)",
              border: "1px solid var(--line)", borderRadius: 6,
              fontFamily: MONO, fontSize: 11.5, color: "var(--dim)", lineHeight: 1.7,
            }}>
              Nothing matches those filters. That is an answer rather than an empty screen — clear the
              search or widen the status to see the rest of the wire.
            </div>
          )}

          {/* Columns, which is the whole point of the move: 69 players in one
              196px rail is a scrollbox, and the same 69 across three columns
              is a list you can read. */}
          <div className="pp-injury-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))",
            gap: 10, marginTop: 16,
          }}>
            {list.map((r) => {
              const tone = (STATUS[r.status] || {}).dot || null;
              return (
                <div
                  key={r.key}
                  role={onOpenProp && r.playerId ? "button" : undefined}
                  tabIndex={onOpenProp && r.playerId ? 0 : undefined}
                  onClick={onOpenProp && r.playerId ? () => onOpenProp(r.sport, r.playerId, r.marketId) : undefined}
                  onKeyDown={onOpenProp && r.playerId ? (e) => { if (e.key === "Enter") { e.preventDefault(); onOpenProp(r.sport, r.playerId, r.marketId); } } : undefined}
                  style={{
                    display: "flex", alignItems: "center", gap: 11, padding: "12px 14px",
                    background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 6,
                    cursor: onOpenProp && r.playerId ? "pointer" : "default", minWidth: 0,
                  }}
                >
                  {/* Rule 1: named player, so an avatar, and the avatar carries
                      the designation as its corner dot. The badge on the right
                      says the same thing in a word -- the dot is the app's
                      grammar, the word is for anyone who has not learnt it. */}
                  <PlayerAvatar
                    name={r.name} alt={r.name} sport={r.sport} team={r.team}
                    colorMap={TEAM_COLORS_BY_SPORT[r.sport]}
                    headshotSrc={r.headshotSrc} fallbackSrc={r.fallbackSrc}
                    status={r.status} surface="var(--surface-1)" size={34}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                      <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.name}
                      </span>
                      <TeamLogo sport={r.sport} abbr={r.team} size={13} style={{ flexShrink: 0, alignSelf: "center" }} />
                      <span className="pp-mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "var(--dim)", flexShrink: 0 }}>
                        {r.team}{r.position ? ` · ${r.position}` : ""}
                      </span>
                    </div>
                    {r.propLine && (
                      <div className="pp-mono" style={{ fontSize: 10, color: "var(--dim)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.propLine}
                      </div>
                    )}
                    {/* When his team next plays, which is what turns this list
                        from a roster of the injured into a list of who might
                        be missing tonight. */}
                    {kickoffFor && (
                      <div className="pp-mono" style={{ fontSize: 9.5, marginTop: 4, color: r.playingSoon ? "var(--amber-ink, var(--amber))" : "var(--dim)", whiteSpace: "nowrap" }}>
                        {r.kickoff == null
                          ? "no game on a slate we hold"
                          : new Date(r.kickoff).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                  <span
                    className="pp-mono"
                    title={r.status === "out" ? "Ruled out — this app hides their props while they are"
                      : r.status === "questionable" ? "Questionable — still a decision, which is why these lead the list"
                      : "Active, and listed only because you have a pick riding on them"}
                    style={{
                      flex: "none", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
                      borderRadius: 4, padding: "5px 8px",
                      color: tone || "var(--dim)", border: `1px solid ${tone || "var(--line)"}`,
                    }}
                  >
                    {STATUS_WORD[r.status] || r.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
