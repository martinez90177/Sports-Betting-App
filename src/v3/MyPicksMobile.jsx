import React from "react";
import PlayerAvatar from "../PlayerAvatar.jsx";
import { crest } from "./FormPlot.jsx";
import {
  INTENTS, TARGETS, FLAGS, FLAG_MEANS, fmtAmerican, flagChipStyle, flagCardBorder, toneOf,
} from "./intentRead.js";
import useMyPicks from "./useMyPicks.js";

// A transcription of frame `3a` in `v3 Mocks/PropPalace Mobile v3.dc.html`.
//
// My Picks stops being a drawer. The mock draws it as a screen with three
// tabs -- SLIP, LEDGER, READ -- reached from the bottom dock every other v3
// screen carries.
//
// The slip, the ledger and their grading are the app's own (`myPicks`,
// `ledgerSummary`, `ledgerCalibration`, `odds.js`). What is new is the READ
// tab: the reader states what they are building, and every leg is judged
// against *that* objective. The engine is `src/v3/intentRead.js`; this file
// only draws it.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const sectionLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };

// One template, so the header and the rows cannot drift out of column.
const SLIP_COLS = "minmax(0, 1fr) 62px 1px 62px 30px";

// The flag chip, its card border and the three meanings come from
// `intentRead.js`. The pair of helpers that used to live here froze CHECK as
// `rgba(232,177,58,0.14)` -- a literal amber that survived a change of outcome
// palette in Settings -- and reached for the availability token for a flag
// that says nothing about health.

function countBadge(on) {
  return {
    fontFamily: MONO, fontSize: 10, marginLeft: 7, padding: "1px 6px", borderRadius: 999,
    background: on ? "var(--amber)" : "var(--surface-2)", color: on ? "#fff" : "var(--dim)",
  };
}

export default function MyPicksMobile({
  legs = [],
  settled = [],
  summary,
  calibration,
  correlationGroups = [],
  bookLabel = "DraftKings",
  bookHref = null,
  onRemove,
  onClear,
  onOpenProp,
  oddsFormat = "american",
  combinedOdds = null,
  formatOdds,
}) {
  // The whole derivation moved to useMyPicks when the desktop frame started
  // needing the same one. Same intents, same flags, same combined number --
  // two copies would be two answers to "is this leg AGAINST".
  const {
    tab, setTab, intent, intentId, setIntentId, target, setTarget,
    ledgerFilter, setLedgerFilter,
    view, combinedRate, read, rs, moves, short, am, sameGame,
    ledgerRows, ledgerCount,
    calLine,
  } = useMyPicks({ legs, settled, correlationGroups, combinedOdds, calibration });

  const avatarFor = (l, size) => (
    <PlayerAvatar
      name={l.name} alt={l.name} sport={l.sport} team={l.team}
      headshotSrc={l.avatar} fallbackSrc={l.avatarFallback} espnId={l.espnId}
      status={l.avail || undefined} size={size} inset={2} surface="var(--bg)"
    />
  );

  // ---- tabs ---------------------------------------------------------------
  const tabs = (
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex" }}>
        {[["Slip", legs.length], ["Ledger", settled.length], ["Read", legs.length]].map(([label, n]) => {
          const on = tab === label;
          return (
            <div
              key={label}
              onClick={() => setTab(label)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab(label); } }}
              style={{
                flex: "1 1 0", minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", whiteSpace: "nowrap",
                color: on ? "var(--amber-ink)" : "var(--dim)",
                borderBottom: `2px solid ${on ? "var(--amber)" : "transparent"}`,
              }}
            >
              {label.toUpperCase()}
              <span style={countBadge(on)}>{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ---- SLIP ---------------------------------------------------------------
  const slip = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "grid", gridTemplateColumns: SLIP_COLS, alignItems: "center", columnGap: 10,
          padding: "10px 16px", background: "var(--surface-1)", borderBottom: "1px solid var(--line)",
        }}
      >
        <span style={sectionLabel}>LEG</span>
        <span style={{ ...sectionLabel, textAlign: "right" }}>YOUR RATE</span>
        <span />
        <span style={{ ...sectionLabel, textAlign: "right" }}>IMPLIED</span>
        <span />
      </div>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
        {/* Where a book price would go, this shows the app's own rate
            converted -- and says no book priced it. There is no odds feed. */}
        <span style={{ fontFamily: MONO, fontSize: 10, lineHeight: 1.6, color: "var(--dim)" }}>
          {`IMPLIED is each leg's own hit rate converted to odds — not a sportsbook price. ${bookLabel} is only where the slip opens.`}
        </span>
      </div>

      {view.map((l) => (
        <div
          key={l.id}
          style={{
            display: "grid", gridTemplateColumns: SLIP_COLS, alignItems: "center", columnGap: 10,
            padding: "13px 16px", borderBottom: "1px solid #20242b", minHeight: 44,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <span style={{ position: "relative", flex: "0 0 auto" }}>{avatarFor(l, 34)}</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
                <span role="img" style={crest(l.team, l.sport, 14)} />
                {/* ALT is "off the posted line", read from mainLine rather
                    than from anything the reader did. */}
                {l.alt && (
                  <span
                    style={{
                      fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", padding: "2px 6px",
                      borderRadius: 4, background: "var(--amber-dim)", color: "var(--amber-ink)", flex: "0 0 auto",
                    }}
                  >
                    ALT
                  </span>
                )}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {l.prop}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {l.opp}
              </span>
            </span>
          </span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span
              style={{
                fontFamily: MONO, fontSize: 16, fontWeight: 700,
                color: l.rate == null ? "var(--dim)" : l.rate >= 0.7 ? "var(--pos)" : l.rate >= 0.6 ? "var(--status-questionable)" : "var(--text-2)",
              }}
            >
              {l.rate == null ? "—" : `${Math.round(l.rate * 100)}%`}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
              {l.n == null ? "" : `${l.hits} of ${l.n}`}
            </span>
          </span>
          <span style={{ height: 26, background: "var(--line)" }} />
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: "var(--text-2)" }}>
              {l.odds == null ? "—" : formatOdds(l.odds, oddsFormat)}
            </span>
          </span>
          <span
            onClick={() => onRemove(l.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRemove(l.id); } }}
            style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--dim)", fontSize: 16, cursor: "pointer" }}
          >
            ×
          </span>
        </div>
      ))}

      {view.length === 0 && (
        <div style={{ margin: 16, border: "1px dashed var(--line)", borderRadius: 12, padding: "20px 16px", fontSize: 13, lineHeight: 1.6, color: "var(--dim)" }}>
          Nothing on the slip. Add a leg from the feed's + button or a player page. Watching a prop does not put it here — those are two lists on purpose.
        </div>
      )}

      {view.length > 0 && (
        <>
          <div style={{ margin: "16px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "11px 13px", borderBottom: "1px solid var(--line)" }}>
              <span style={sectionLabel}>{`ALL ${view.length} ${view.length === 1 ? "LEG" : "LEGS"} TOGETHER`}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>FROM THESE RATES</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <div style={{ padding: "12px 13px", display: "flex", flexDirection: "column", gap: 3, borderRight: "1px solid var(--line)" }}>
                <span style={sectionLabel}>COMBINED RATE</span>
                <span
                  style={{
                    fontFamily: MONO, fontSize: 20, fontWeight: 700,
                    color: combinedRate == null ? "var(--dim)"
                      : combinedRate >= 0.5 ? "var(--pos)" : combinedRate >= 0.25 ? "var(--status-questionable)" : "var(--text-2)",
                  }}
                >
                  {combinedRate == null ? "—" : `${Math.round(combinedRate * 100)}%`}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
                  {combinedRate == null ? "a leg has no rate" : "each leg's own rate, multiplied"}
                </span>
              </div>
              <div style={{ padding: "12px 13px", display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={sectionLabel}>AS ODDS</span>
                <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700 }}>
                  {am == null ? "—" : formatOdds(am, oddsFormat)}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>NO BOOK PRICED THIS</span>
              </div>
            </div>
            <div style={{ padding: "0 13px 13px", fontSize: 12, lineHeight: 1.5, color: "var(--dim)" }}>
              Implied odds, not sportsbook odds. Multiplying rates also assumes the legs are independent, and teammates in one game are not, so treat this as a ceiling.
            </div>
          </div>

          {bookHref && (
            <div style={{ padding: "0 16px 12px" }}>
              <a
                href={bookHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                  borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)",
                  color: "var(--text)", fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", textDecoration: "none",
                }}
              >
                {`OPEN IN ${bookLabel.toUpperCase()} →`}
              </a>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, padding: "0 16px 26px" }}>
            <div
              onClick={onClear}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClear(); } }}
              style={{
                flex: "0 0 auto", minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 20px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)",
                color: "var(--text-2)", fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", cursor: "pointer",
              }}
            >
              CLEAR
            </div>
            {/* `trackSlip: () => this.set("mpTab", "Ledger")`. This button was
                "READ THE SLIP" in accent -- a word the frame does not use and a
                colour it does not give this control. */}
            <div
              onClick={() => setTab("Ledger")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab("Ledger"); } }}
              style={{
                flex: "1 1 auto", minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)",
                color: "var(--text)", fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", cursor: "pointer",
              }}
            >
              TRACK IN LEDGER
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ---- LEDGER -------------------------------------------------------------
  const ledger = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div className="nsb" style={{ display: "flex", gap: 8, padding: "12px 16px", overflowX: "auto" }}>
        {["All", "Won", "Lost", "Open"].map((label) => {
          const on = ledgerFilter === label;
          return (
            <div
              key={label}
              onClick={() => setLedgerFilter(label)}
              style={{
                minHeight: 40, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 8,
                fontFamily: MONO, fontSize: 12, whiteSpace: "nowrap", cursor: "pointer", flex: "0 0 auto",
                border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                background: on ? "var(--amber-dim)" : "var(--surface-1)",
                color: on ? "var(--amber-ink)" : "var(--text-2)",
              }}
            >
              {label}
              <span style={countBadge(on)}>{ledgerCount(label)}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "0 16px 12px" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)" }}>
          {summary && summary.settled
            ? `${summary.won} of ${summary.settled} settled · ${summary.units >= 0 ? "+" : ""}${summary.units.toFixed(2)}u`
            : "Nothing settled yet"}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>{ledgerFilter}</span>
      </div>

      {ledgerRows.map((p) => (
        <div
          key={p.id}
          style={{
            display: "flex", alignItems: "center", gap: 11, padding: "13px 16px",
            borderBottom: "1px solid #20242b", minHeight: 44,
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", flex: "0 0 52px" }}>
            {p.gameDate ? new Date(p.gameDate).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
              <span role="img" style={crest(p.team, p.sport, 13)} />
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {p.subtitle}
            </span>
          </span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flex: "0 0 auto" }}>
            <span
              style={{
                fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", padding: "4px 8px", borderRadius: 999,
                whiteSpace: "nowrap",
                background: p.result === "won" ? "var(--pos-dim)" : p.result === "lost" ? "var(--neg-dim)" : "rgba(139,152,171,0.14)",
                color: p.result === "won" ? "var(--pos)" : p.result === "lost" ? "var(--neg)" : "var(--dim)",
              }}
            >
              {String(p.result || "open").toUpperCase()}
            </span>
            {/* A pick saved before the rate rode along cannot be checked
                against a claim it never made, and says so. */}
            <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
              {p.hitRate == null ? "unrated" : `claimed ${Math.round(p.hitRate * 100)}%`}
            </span>
          </span>
        </div>
      ))}

      {ledgerRows.length === 0 && (
        <div style={{ margin: 16, border: "1px dashed var(--line)", borderRadius: 12, padding: "20px 16px", fontSize: 13, lineHeight: 1.6, color: "var(--dim)" }}>
          {settled.length === 0
            ? "Nothing has settled yet. A pick moves here on its own once its game finishes."
            : `No ${ledgerFilter.toLowerCase()} picks. Switch back to All to see the rest.`}
        </div>
      )}

      <div style={{ padding: 16, fontSize: 12.5, lineHeight: 1.6, color: "var(--dim)" }}>
        A pick settles when its game finishes. Nothing here is graded by hand, and an open pick is never counted as a win.
      </div>
    </div>
  );

  // ---- READ ---------------------------------------------------------------
  const report = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 16px 30px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <span style={sectionLabel}>WHAT ARE YOU BUILDING</span>
        <div className="nsb" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {INTENTS.map((it) => (
            <div
              key={it.id}
              onClick={() => setIntentId(it.id)}
              style={{
                minHeight: 40, display: "flex", alignItems: "center", padding: "0 13px", borderRadius: 8,
                fontSize: 13, whiteSpace: "nowrap", cursor: "pointer",
                border: `1px solid ${intentId === it.id ? "var(--amber)" : "var(--line)"}`,
                background: intentId === it.id ? "var(--amber-dim)" : "var(--surface-1)",
                color: intentId === it.id ? "var(--amber-ink)" : "var(--text-2)",
              }}
            >
              {it.label}
            </div>
          ))}
        </div>
        <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)" }}>{intent.hint}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={sectionLabel}>TARGET PRICE</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--amber-ink)" }}>{`AIMING FOR +${target}`}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {TARGETS.map((v) => (
            <div
              key={v}
              onClick={() => setTarget(v)}
              style={{
                flex: "1 1 0", minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 8, fontFamily: MONO, fontSize: 12, cursor: "pointer",
                border: `1px solid ${target === v ? "var(--amber)" : "var(--line)"}`,
                background: target === v ? "var(--amber-dim)" : "var(--surface-1)",
                color: target === v ? "var(--amber-ink)" : "var(--text-2)",
              }}
            >
              {`+${v}`}
            </div>
          ))}
        </div>
      </div>

      {view.length === 0 ? (
        <div style={{ border: "1px dashed var(--line)", borderRadius: 12, padding: "20px 16px", fontSize: 13, lineHeight: 1.6, color: "var(--dim)" }}>
          Nothing to read yet. The read judges the legs on the slip against the objective above.
        </div>
      ) : (
        <>
          <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", padding: 14, display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: rs.tone, display: "block", flex: "0 0 auto" }} />
              <span style={sectionLabel}>THE READ</span>
              <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>{rs.count}</span>
            </div>
            <span style={{ fontSize: 14, lineHeight: 1.45, textWrap: "pretty" }}>{rs.headline}</span>
            <span style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.6, color: "var(--dim)" }}>
              {`${combinedRate == null ? "—" : `${Math.round(combinedRate * 100)}%`} together from these rates · ${fmtAmerican(am)}${short ? ` · under your +${target} target` : ` · at or past your +${target} target`} · no book priced this`}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <span style={sectionLabel}>LEG BY LEG</span>
            {read.map((r) => (
              <div
                key={r.key}
                style={{
                  display: "flex", flexDirection: "column", gap: 6, padding: "12px 13px", borderRadius: 10,
                  background: "var(--surface-1)",
                  border: `1px solid ${flagCardBorder(r.flag)}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ ...flagChipStyle(r.flag), flex: "0 0 auto" }}>{r.flag}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)" }}>{r.prop}</span>
                <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text)", textWrap: "pretty" }}>{r.say}</span>
                {/* No objection without a counted fact -- the citation is the
                    fact, and every branch carries one. */}
                <span style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.5, color: "var(--dim)" }}>{r.cite}</span>
              </div>
            ))}
          </div>

          {moves.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <span style={sectionLabel}>WHAT WOULD CHANGE IT</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {moves.map((m) => (
                  <div
                    key={m.title}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", borderRadius: 10,
                      border: "1px solid var(--line)", background: "var(--surface-1)", minHeight: 44,
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 auto" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.title}</span>
                      <span style={{ fontSize: 12, lineHeight: 1.45, color: "var(--dim)" }}>{m.why}</span>
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "var(--amber-ink)", whiteSpace: "nowrap", flex: "0 0 auto" }}>
                      {m.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", padding: 14 }}>
        <span style={sectionLabel}>DID YOUR RATES HOLD</span>
        <span
          style={{
            fontSize: 12.5, lineHeight: 1.55,
            color: !calibration || calibration.readable === 0
              ? "var(--dim)"
              : calibration.worst ? "var(--status-questionable)" : "var(--pos)",
          }}
        >
          {calLine}
        </span>
      </div>

      {/* The legend, printed rather than left to be inferred. */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {FLAGS.map((f) => (
          <span key={f} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: toneOf(f), display: "block", flex: "0 0 auto" }} />
            <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.06em", color: "var(--text-2)" }}>
              {`${f} · ${FLAG_MEANS[f]}`}
            </span>
          </span>
        ))}
      </div>

      <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--dim)" }}>
        Every line above cites something counted — a sample, a split, a lineup, a defence rank. Nothing here predicts a game, and no objection is raised without a fact behind it.
      </span>
    </div>
  );

  return (
    <>
      {tabs}
      {tab === "Slip" && slip}
      {tab === "Ledger" && ledger}
      {tab === "Read" && report}
    </>
  );
}
