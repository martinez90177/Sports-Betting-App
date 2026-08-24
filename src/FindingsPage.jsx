import React, { useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { TEAM_COLORS_BY_SPORT } from "./lib/teamColors.js";
import { buildFindings, filterFindings, FINDING_SPLITS, FINDING_SIDES, FINDING_SORTS } from "./lib/findings.js";

const MONO = "'Space Mono', ui-monospace, monospace";
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

  const all = useMemo(() => buildFindings(rows, sport), [rows, sport]);
  const structuralCount = useMemo(() => all.filter((f) => f.structural).length, [all]);
  const list = useMemo(
    () => filterFindings(all, { split, side, hideStructural, sort }),
    [all, split, side, hideStructural, sort]
  );
  const visible = list.slice(0, shown);

  const countFor = (s) => (s === "All splits" ? all.length : all.filter((f) => f.split === s).length);

  return (
    <div className="page-shell" style={{ maxWidth: 1600, margin: "0 auto", padding: "20px 22px 40px", boxSizing: "border-box" }}>
      <div className="pp-findings-grid" style={{ display: "grid", gridTemplateColumns: "196px minmax(0,1fr)", gap: 22 }}>

        <div className="pp-findings-rail">
          <div style={LABEL}>League</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {sports.map((s) => (
              <Pill key={s.id} label={s.label} on={s.id === sport} onPick={() => onSetSport(s.id)} style={{ flex: "none" }} />
            ))}
          </div>

          <div style={{ ...LABEL, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>Split</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {FINDING_SPLITS.map((s) => (
              <Pill key={s} label={s} count={countFor(s)} on={split === s} onPick={() => { setSplit(s); setShown(20); }} />
            ))}
          </div>

          <div style={{ ...LABEL, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>Side</div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {FINDING_SIDES.map((s) => (
              <Pill key={s} label={s} on={side === s} onPick={() => { setSide(s); setShown(20); }} style={{ flex: 1, justifyContent: "center" }} />
            ))}
          </div>

          <div style={{ marginTop: 20, padding: 12, border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface-sunken)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: "var(--text-2)", lineHeight: 1.6, flex: 1 }}>
                Hide structural near-certainties
              </div>
              <span
                role="button" tabIndex={0} aria-pressed={hideStructural}
                onClick={() => { setHideStructural((v) => !v); setShown(20); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHideStructural((v) => !v); } }}
                style={{
                  flex: "none", width: 36, height: 21, borderRadius: 999, cursor: "pointer",
                  display: "flex", alignItems: "center", padding: 2, boxSizing: "border-box",
                  justifyContent: hideStructural ? "flex-end" : "flex-start",
                  background: hideStructural ? "var(--amber)" : "transparent",
                  border: `1px solid ${hideStructural ? "var(--amber)" : "var(--line)"}`,
                }}
              >
                <span style={{ width: 15, height: 15, borderRadius: 999, background: "var(--text)" }} />
              </span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--dim)", marginTop: 9, lineHeight: 1.65 }}>
              {hideStructural
                ? `Hiding ${structuralCount} findings that are properties of the market rather than of the player — a log that never moves off one number. They are true and they are not news.`
                : `Showing everything, including ${structuralCount} structural near-certainties. Expect the list to fill with rows whose numbers never move.`}
            </div>
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 29, margin: 0, letterSpacing: "-0.02em" }}>Findings</h1>
              <div style={{ ...LABEL, marginTop: 6, letterSpacing: "0.1em", fontSize: 10.5 }}>
                {loading
                  ? "Reading the slate…"
                  : `${list.length} on this slate · each states its split and its sample`}
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 2, border: "1px solid var(--line)", borderRadius: 6, padding: 2, background: "var(--surface-sunken)" }}>
              {FINDING_SORTS.map((s) => (
                <span
                  key={s.id}
                  role="button" tabIndex={0} aria-pressed={sort === s.id}
                  onClick={() => setSort(s.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSort(s.id); } }}
                  className="pp-mono"
                  style={{
                    fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 4,
                    padding: "7px 11px", cursor: "pointer", whiteSpace: "nowrap",
                    background: sort === s.id ? "var(--amber)" : "transparent",
                    color: sort === s.id ? "var(--accent-on)" : "var(--text-2)",
                  }}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {!loading && list.length === 0 && (
            <div style={{
              marginTop: 16, padding: "22px 20px", background: "var(--surface-1)",
              border: "1px solid var(--line)", borderRadius: 6,
              fontFamily: MONO, fontSize: 11.5, color: "var(--dim)", lineHeight: 1.7,
            }}>
              Nothing on this slate clears the bar for a finding — a run of five or a split of five games
              at eight in ten. That is an answer, not an empty screen: no split on tonight's games is
              saying anything a rate could not.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {visible.map((f) => {
              const colorMap = TEAM_COLORS_BY_SPORT[f.sport];
              const status = statusFor ? statusFor(f) : f.status;
              return (
                <div
                  key={f.key}
                  role={onOpenProp ? "button" : undefined}
                  tabIndex={onOpenProp ? 0 : undefined}
                  onClick={onOpenProp ? () => onOpenProp(f.sport, f.playerId, f.marketId) : undefined}
                  onKeyDown={onOpenProp ? (e) => { if (e.key === "Enter") { e.preventDefault(); onOpenProp(f.sport, f.playerId, f.marketId); } } : undefined}
                  className="pp-finding"
                  style={{
                    display: "flex", alignItems: "stretch", gap: 16, padding: "15px 18px",
                    background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 6,
                    cursor: onOpenProp ? "pointer" : "default",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* Rule 1: the sentence names a player, so the row carries
                          their avatar and the avatar carries their status. */}
                      <PlayerAvatar
                        name={f.name} alt={f.name} sport={f.sport} team={f.team}
                        colorMap={colorMap} status={status}
                        surface="var(--surface-1)" size={26}
                      />
                      <div style={{ fontSize: 15.5, lineHeight: 1.5, color: "var(--text)", textWrap: "pretty", minWidth: 0 }}>
                        {f.sentence}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 11, alignItems: "center" }}>
                      <span className="pp-mono" style={{
                        fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 4,
                        padding: "5px 8px", color: "var(--amber-ink)", border: "1px solid var(--amber)",
                      }}>{f.split}</span>
                      <span className="pp-mono" style={{
                        fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 4,
                        padding: "5px 8px", color: "var(--text-2)", border: "1px solid var(--line)",
                      }}>{f.streakLabel}</span>
                      {f.structural && (
                        <span className="pp-mono" style={{
                          fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 4,
                          padding: "5px 8px", color: "var(--dim)", border: "1px solid var(--line)",
                        }}>structural</span>
                      )}
                      <span className="pp-mono" style={{ fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--dim)", padding: "5px 0" }}>
                        {f.game}
                      </span>
                    </div>
                  </div>
                  <div style={{ flex: "none", width: 118, display: "flex", flexDirection: "column", justifyContent: "center", gap: 7, paddingLeft: 16, borderLeft: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      {/* Under the support band the cell states the count and
                          no percentage -- the same rule the feed's H2H column
                          follows, and the one place prose makes it easy to
                          break. */}
                      <span className="pp-mono" style={{
                        fontSize: f.thin ? 12 : 19, fontVariantNumeric: "tabular-nums",
                        color: f.thin ? "var(--dim)" : f.rate >= 0.65 ? "var(--pos)" : f.rate < 0.45 ? "var(--neg)" : "var(--text-2)",
                      }}>
                        {f.thin ? "too few" : `${Math.round(f.rate * 100)}%`}
                      </span>
                      <span className="pp-mono" style={{ fontSize: 9, color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>
                        {f.hits} of {f.n}
                      </span>
                    </div>
                    <MiniBars values={f.bars} line={f.line} isBinary={f.isBinary} />
                  </div>
                </div>
              );
            })}
          </div>

          {list.length > visible.length && (
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
              <span
                role="button" tabIndex={0}
                onClick={() => setShown((v) => v + 20)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShown((v) => v + 20); } }}
                className="pp-mono"
                style={{
                  fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                  color: "var(--amber-ink)", border: "1px solid var(--amber)",
                  borderRadius: 4, padding: "10px 15px", cursor: "pointer",
                }}
              >
                Load {Math.min(20, list.length - visible.length)} more findings
                <span style={{ color: "var(--dim)" }}> · {visible.length} of {list.length}</span>
              </span>
              <span className="pp-mono" style={{ fontSize: 9.5, color: "var(--dim)", lineHeight: 1.7, flex: 1, minWidth: 200 }}>
                Every finding names its split and its sample. A run under five games is stated as a count,
                never as a rate.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
