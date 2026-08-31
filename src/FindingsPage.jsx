import React, { useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { TEAM_COLORS_BY_SPORT } from "./lib/teamColors.js";
import { buildFindings, filterFindings, FINDING_SPLITS, FINDING_SIDES, FINDING_SORTS } from "./lib/findings.js";
import useIsNarrow, { useIsPhone } from "./lib/useIsNarrow.js";
import FindingsMobile from "./v3/FindingsMobile.jsx";
import FindingsDesktop from "./v3/FindingsDesktop.jsx";

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

// Findings. Competitive brief item 6, mock 3e.
//
// The screen the Board cannot be. The Board ranks one number per prop, so a
// prop that is a coin flip on the season and eight-of-eight at home is
// invisible on it by construction. This runs the splits and states what comes
// back in sentences.
//
// The sentence is the row. Everything else -- the split that produced it, the
// run length, the sample, the bars -- sits under or beside it as support, and
// the layout is built so that reading only the sentences is a complete use of
// the page.

const LABEL = {
  fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em",
  textTransform: "uppercase", color: "var(--dim)",
};

function chip(on) {
  return {
    background: on ? "var(--amber)" : "transparent",
    color: on ? "var(--accent-on)" : "var(--text-2)",
    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
  };
}

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
        cursor: "pointer", whiteSpace: "nowrap", ...chip(on), ...style,
      }}
    >
      {label}
      {count != null && <span style={{ fontSize: 9, color: on ? "inherit" : "var(--dim)", fontVariantNumeric: "tabular-nums" }}>{count}</span>}
    </span>
  );
}

// The little chart beside a finding. Deliberately not the feed's form strip:
// this draws the games the finding is about, which may be a five-game home
// split, not a fixed last-ten window.
function MiniBars({ values, line, isBinary }) {
  if (!values || values.length < 2) return null;
  const H = 26;
  const hit = (v) => (isBinary ? v === 1 : v > line);
  const lo = Math.min(Math.min(...values), line);
  const hi = Math.max(Math.max(...values), line);
  const span = Math.max(hi - lo, 1) * 1.25;
  const axisMin = lo - Math.max(hi - lo, 1) * 0.18;
  const y = (v) => 4 + Math.round(((v - axisMin) / span) * (H - 4));
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap: 2, height: H }}>
      {values.map((v, i) => {
        const cleared = hit(v);
        return (
          <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{
              height: y(v), borderRadius: "1px 1px 0 0", boxSizing: "border-box",
              background: cleared ? "var(--pos-solid)" : "var(--neg)",
            }} />
          </div>
        );
      })}
      <span style={{ position: "absolute", left: 0, right: 0, bottom: y(line), borderTop: "1px dashed var(--text)", pointerEvents: "none" }} />
    </div>
  );
}

export default function FindingsPage({
  rows = [],
  sport,
  sports = [],
  onSetSport,
  // (sport, playerId, marketId) -- positional, matching goToProp and the way
  // BoardRow calls it. Passing an object here sent every click to the feed
  // with a console warning instead of to the player page.
  onOpenProp,
  loading = false,
  statusFor = null,
}) {
  const [split, setSplit] = useState("All splits");
  const [side, setSide] = useState("Both");
  const [sort, setSort] = useState("strength");
  // On by default, and the note beside the switch says how many it is holding
  // back and why. A screen that silently withheld two hundred true statements
  // would be the same failure as one that silently dropped a game.
  const [hideStructural, setHideStructural] = useState(true);
  const [shown, setShown] = useState(20);
  // 900 to match .pp-findings-grid's own breakpoint in index.css -- a
  // component that folded at a different width from the stylesheet would
  // collapse its rail while the grid was still two columns.
  const narrow = useIsNarrow(900);
  const isPhone = useIsPhone();
  const [railOpen, setRailOpen] = useState(false);

  const all = useMemo(() => buildFindings(rows, sport), [rows, sport]);
  const structuralCount = useMemo(() => all.filter((f) => f.structural).length, [all]);
  const list = useMemo(
    () => filterFindings(all, { split, side, hideStructural, sort }),
    [all, split, side, hideStructural, sort]
  );
  const visible = list.slice(0, shown);

  const countFor = (s) => (s === "All splits" ? all.length : all.filter((f) => f.split === s).length);

  // Same findings, same filters, same counts -- one prop set, two layouts.
  // The phone stacks its controls (src/v3/FindingsMobile.jsx); the desktop
  // puts them in a 236px rail beside a two-across grid (FindingsDesktop, mock
  // frame 2c). Neither re-ranks anything: lib/findings.js decides the order.
  const v3Shared = {
    sports,
    sport,
    onSetSport,
    splits: FINDING_SPLITS,
    split,
    onSetSplit: (s) => { setSplit(s); setShown(20); },
    sides: FINDING_SIDES,
    side,
    onSetSide: (s) => { setSide(s); setShown(20); },
    sorts: FINDING_SORTS,
    sort,
    onSetSort: (s) => { setSort(s); setShown(20); },
    hideStructural,
    onToggleStructural: () => { setHideStructural((v) => !v); setShown(20); },
    structuralHeld: structuralCount,
    findings: visible,
    total: list.length,
    hasMore: list.length > shown,
    moreCount: list.length - shown,
    onShowMore: () => setShown((n) => n + 20),
    loading,
    onOpenProp,
    renderAvatar: (fd, size) => (
      <PlayerAvatar
        name={fd.name} alt={fd.name} sport={fd.sport || sport} team={fd.team}
        headshotSrc={fd.avatar} espnId={fd.espnId}
        status={statusFor ? statusFor(fd) : fd.status} size={size} inset={2}
        surface="var(--surface-1)"
      />
    ),
  };

  if (!isPhone) return <FindingsDesktop {...v3Shared} />;

  if (isPhone) {
    return (
      <FindingsMobile {...v3Shared} />
    );
  }

}
