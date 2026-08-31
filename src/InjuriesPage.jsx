import React, { useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import TeamLogo from "./TeamLogo.jsx";
import { TEAM_COLORS_BY_SPORT, STATUS } from "./lib/teamColors.js";
import useIsNarrow, { useIsPhone } from "./lib/useIsNarrow.js";
import InjuriesMobile from "./v3/InjuriesMobile.jsx";
import InjuriesDesktop from "./v3/InjuriesDesktop.jsx";

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
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

// "A, B and C" rather than "A and B and C". Four leagues joined with `and`
// read as a list someone forgot to punctuate.
function andList(items) {
  const list = (items || []).filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
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
  // 900 to match .pp-findings-grid's own breakpoint in index.css -- a
  // component that folded at a different width from the stylesheet would
  // collapse its rail while the grid was still two columns.
  const narrow = useIsNarrow(900);
  const isPhone = useIsPhone();
  const [railOpen, setRailOpen] = useState(false);

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

  // Same wire, same coverage rules, same sorts -- one prop set, two layouts.
  // The phone stacks its rail as a disclosure (src/v3/InjuriesMobile.jsx);
  // the desktop puts it in a 224px column beside the wire as a table
  // (InjuriesDesktop, mock frame 2e).
  {
    const kickoffLabel = (r) => {
      if (r.kickoff == null) return "No game on this slate";
      const d = new Date(r.kickoff);
      return d.toLocaleDateString([], { weekday: "short" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    };
    const v3Shared = {
      query: q,
      onSetQuery: setQ,
      sampleQuery: (list[0] && String(list[0].name || "").split(" ").slice(-1)[0]) || null,
      leagues: [{ id: "all", label: "All", count: countBySport("all") }]
        .concat(coveredSports.map((sp) => ({ id: sp.id, label: sp.label, count: countBySport(sp.id) }))),
      league: sport,
      onSetLeague: setSport,
      statuses: [
        { id: "all", label: "All", count: countByStatus("all") },
        { id: "questionable", label: "Questionable", count: countByStatus("questionable") },
        { id: "out", label: "Out", count: countByStatus("out") },
        { id: "active", label: "Active · watched", count: countByStatus("active") },
      ],
      status,
      onSetStatus: setStatus,
      sorts: (kickoffFor ? [{ id: "kickoff", label: "Playing next" }] : []).concat([{ id: "name", label: "By status" }]),
      sort,
      onSetSort: setSort,
      playingSoon,
      rows: list,
      scopeLabel: [sport === "all" ? "All leagues" : sport.toUpperCase(), status === "all" ? "All statuses" : status].join(" · "),
      // Which leagues publish a feed at all. A league showing nobody has
      // nobody designated, not nobody checked.
      coverageNote: uncoveredSports.length
        ? `${andList(coveredSports.map((sp) => sp.label))} publish an availability feed this app can read. ${andList(uncoveredSports.map((sp) => sp.label))} ${uncoveredSports.length === 1 ? "does" : "do"} not, so ${uncoveredSports.length === 1 ? "it is" : "they are"} named here rather than shown as leagues with nobody hurt.`
        : `${andList(coveredSports.map((sp) => sp.label))} all publish an availability designation this app reads. A league showing nobody here has nobody designated, not nobody checked.`,
      loading,
      onOpenProp: onOpenProp ? (r) => onOpenProp(r) : null,
      kickoffLabelFor: kickoffLabel,
    };

    if (!isPhone) {
      return (
        <InjuriesDesktop
          {...v3Shared}
          renderAvatar={(r, size) => (
            <PlayerAvatar
              name={r.name} alt={r.name} sport={r.sport} team={r.team}
              headshotSrc={r.avatar} espnId={r.espnId} status={r.status}
              size={size} inset={2} surface="var(--bg)"
            />
          )}
        />
      );
    }

    return (
      <InjuriesMobile {...v3Shared} />
    );
  }

}
