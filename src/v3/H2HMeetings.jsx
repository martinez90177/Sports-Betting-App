import React from "react";

// The meetings behind the HEAD TO HEAD cells, and the box score behind each
// meeting.
//
// The v3 frames draw the season series as three numbers and a sentence, which
// answers "who has won more" and nothing else. Three numbers is a count; the
// scorelines under them are the series -- a 3-1 edge built on a 40-point win
// and three one-score games is a different fact from four blowouts, and the
// cells cannot tell those apart.
//
// One component for both frames, so the phone and the desktop can never
// describe the same series differently. The desktop passes `compact={false}`.
//
// Nothing here is derived: every score, period and leader is read off the same
// providers the Gamecast reads, through the caller's `loadBox`. A meeting whose
// box score the provider cannot serve says so rather than drawing empty rows.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dateOf = (iso) => {
  const d = new Date(iso);
  return `${MONTH[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

// How many meetings are listed before the toggle. Five covers an NFL series
// whole and most of an NBA one; an MLB pair can meet thirteen times, and
// thirteen rows would be the tallest thing on the screen.
const VISIBLE = 5;

function Linescore({ box }) {
  if (!box || !box.columns || !box.rows) return null;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontFamily: MONO, fontSize: 11, minWidth: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "4px 8px 4px 0", color: "var(--dim)", fontWeight: 400 }} />
            {box.columns.map((c) => (
              <th
                key={c.key}
                style={{
                  padding: "4px 7px", textAlign: "center", fontWeight: c.total ? 700 : 400,
                  color: c.total ? "var(--text-2)" : "var(--dim)",
                  borderLeft: c.total ? "1px solid var(--line)" : "none",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {box.rows.map((r) => (
            <tr key={r.abbr}>
              <td style={{ padding: "4px 8px 4px 0", color: "var(--text-2)", fontWeight: 700, whiteSpace: "nowrap" }}>{r.abbr}</td>
              {r.cells.map((cell, i) => (
                <td
                  key={box.columns[i]?.key || i}
                  style={{
                    padding: "4px 7px", textAlign: "center",
                    color: box.columns[i]?.total ? "var(--text)" : "var(--text-2)",
                    fontWeight: box.columns[i]?.total ? 700 : 400,
                    borderLeft: box.columns[i]?.total ? "1px solid var(--line)" : "none",
                  }}
                >
                  {/* A period that was not played is blank, never a nought --
                      a game that ended in nine innings did not score nought in
                      the tenth. */}
                  {cell === "" ? "·" : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The top line in each of a handful of categories per side. Capped, because
// ESPN answers with nine for an NFL game and the point of this block is a
// glance rather than a second box-score page.
const LEADER_CAP = 4;

function Leaders({ box }) {
  const sides = (box?.leaders || []).filter((t) => t.items && t.items.length);
  if (!sides.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${sides.length}, minmax(0, 1fr))`, gap: 12 }}>
      {sides.map((t) => (
        <div key={t.teamAbbr} style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", color: "var(--dim)" }}>{t.teamAbbr}</span>
          {t.items.slice(0, LEADER_CAP).map((it) => (
            <div key={`${it.category}-${it.name}`} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.08em", color: "var(--dim)" }}>
                {String(it.category).toUpperCase()}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {it.name}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {it.statLine}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function H2HMeetings({
  meetings = [],
  awayAbbr,
  homeAbbr,
  loadBox,
  compact = false,
}) {
  const [openId, setOpenId] = React.useState(null);
  // id -> undefined (never asked) | null (asked, provider had nothing) | detail
  const [boxes, setBoxes] = React.useState({});
  const [loading, setLoading] = React.useState(null);
  const [showAll, setShowAll] = React.useState(false);

  // A different matchup reuses this component in the same slot, and its old
  // open row and cached box scores would otherwise ride along.
  const seriesKey = meetings.map((m) => m.id).join("|");
  React.useEffect(() => {
    setOpenId(null);
    setBoxes({});
    setLoading(null);
    setShowAll(false);
  }, [seriesKey]);

  const toggle = (m) => {
    if (openId === m.id) { setOpenId(null); return; }
    setOpenId(m.id);
    if (!loadBox || m.id in boxes) return;
    setLoading(m.id);
    loadBox(m)
      .then((detail) => {
        setBoxes((prev) => ({ ...prev, [m.id]: detail || null }));
        setLoading((cur) => (cur === m.id ? null : cur));
      })
      .catch(() => {
        setBoxes((prev) => ({ ...prev, [m.id]: null }));
        setLoading((cur) => (cur === m.id ? null : cur));
      });
  };

  if (!meetings.length) return null;
  const shown = showAll ? meetings : meetings.slice(0, VISIBLE);
  const pad = compact ? "9px 13px" : "9px 0";

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {shown.map((m, i) => {
        const open = openId === m.id;
        const box = boxes[m.id];
        // The winner's score carries the weight. Neither team is "ours" on
        // this screen, so the over/under green and red would be picking a
        // side -- the form panels are the place for those, where there is a
        // subject team to be right or wrong about.
        const awayWon = m.result === "away";
        const homeWon = m.result === "home";
        return (
          <div key={m.id} style={{ borderTop: i === 0 ? "1px solid var(--line)" : "1px solid #20242b" }}>
            <div
              role="button"
              tabIndex={0}
              aria-expanded={open}
              onClick={() => toggle(m)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(m); } }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: pad, cursor: "pointer", minHeight: compact ? 44 : 0 }}
            >
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", whiteSpace: "nowrap" }}>
                {dateOf(m.at)}
              </span>
              {/* Postseason rounds say which one. A Super Bowl listed as an
                  undated line among regular-season games is the fact most
                  worth keeping. */}
              {m.note && (
                <span style={{
                  fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", padding: "2px 6px", borderRadius: 4,
                  border: "1px solid var(--line)", color: "var(--text-2)", whiteSpace: "nowrap",
                }}>
                  {String(m.note).toUpperCase()}
                </span>
              )}
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "baseline", gap: 7, fontFamily: MONO, fontSize: 11.5, whiteSpace: "nowrap" }}>
                <span style={{ color: awayWon ? "var(--text)" : "var(--dim)", fontWeight: awayWon ? 700 : 400 }}>
                  {`${awayAbbr} ${m.awayScore}`}
                </span>
                <span style={{ color: "var(--dim)" }}>·</span>
                <span style={{ color: homeWon ? "var(--text)" : "var(--dim)", fontWeight: homeWon ? 700 : 400 }}>
                  {`${homeAbbr} ${m.homeScore}`}
                </span>
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", width: 10, textAlign: "center", flex: "0 0 auto" }}>
                {open ? "−" : "+"}
              </span>
            </div>

            {open && (
              <div style={{
                display: "flex", flexDirection: "column", gap: 11,
                padding: compact ? "0 13px 13px" : "2px 0 13px",
              }}>
                {m.venue && (
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{m.venue}</span>
                )}
                {loading === m.id && (
                  <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>Reading the box score…</span>
                )}
                {/* Three states, not two: still loading, the provider has no
                    box score for this game, and a real one. */}
                {loading !== m.id && box === null && (
                  <span style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--dim)" }}>
                    No box score on file for this game — the final score above is what the provider carries.
                  </span>
                )}
                {loading !== m.id && box && (
                  <>
                    <Linescore box={box} />
                    <Leaders box={box} />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {meetings.length > VISIBLE && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowAll((v) => !v)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowAll((v) => !v); } }}
          style={{
            padding: compact ? "11px 13px" : "10px 0 2px", cursor: "pointer",
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em",
            color: "var(--amber-ink)", borderTop: "1px solid #20242b",
          }}
        >
          {showAll ? "SHOW FEWER" : `ALL ${meetings.length} MEETINGS →`}
        </div>
      )}
    </div>
  );
}
