import React from "react";
import {
  INTENTS, FLAGS, FLAG_MEANS, fmtAmerican, flagChipStyle, flagCardBorder,
} from "./intentRead.js";

// THE READ at dock width.
//
// Frame 1c of `v3 Mocks/PropPalace Desktop v3.dc.html` draws the read as a
// 404px column beside the full slip, and frame 3a stacks it as a phone tab.
// Both already exist (`MyPicksDesktop`, `MyPicksMobile`). This is the third
// width: the 296px dock on Prop Feed, where the read has to answer "does this
// slip fit what I said I was building" without the reader leaving the table
// they are picking from.
//
// It draws only. Every flag, sentence, citation and count comes from
// `useMyPicks` -> `intentRead.js`, which is the one place that decides whether
// a leg is AGAINST -- three frames agreeing by construction rather than three
// copies of the rule agreeing by luck.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

const micro = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };

export default function ReadPanel({
  read = [],
  rs,
  intent,
  intentId,
  setIntentId,
  combinedRate = null,
  am = null,
  short = true,
  target = 300,
  calLine = null,
}) {
  // The combined number is these rates multiplied and is labelled as exactly
  // that. No book priced it, and one leg with no counted rate behind it means
  // there is no combined number to state -- not a zero, and not a guess.
  const priceLine = combinedRate == null
    ? "No combined number — a leg on the slip has no counted rate behind it."
    : `${Math.round(combinedRate * 100)}% together from these rates · ${fmtAmerican(am)}`
      + (short ? ` · under your +${target} target` : ` · at or past your +${target} target`)
      + " · no book priced this";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ---- what the reader says they are building --------------------- */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={micro}>BUILDING</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {INTENTS.map((it) => {
            const on = intentId === it.id;
            return (
              <span
                key={it.id}
                role="button"
                tabIndex={0}
                title={it.hint}
                onClick={() => setIntentId && setIntentId(it.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIntentId && setIntentId(it.id); }
                }}
                style={{
                  minHeight: 30, display: "flex", alignItems: "center", padding: "0 9px",
                  borderRadius: 7, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.04em",
                  whiteSpace: "nowrap", cursor: "pointer",
                  border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                  background: on ? "var(--amber-dim)" : "var(--surface-1)",
                  color: on ? "var(--amber-ink)" : "var(--text-2)",
                }}
              >
                {it.label}
              </span>
            );
          })}
        </div>
        {/* Changing the intent re-grades every leg on the spot, so the hint
            has to say what was just selected, not what it does. */}
        <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--dim)" }}>{intent.hint}</span>
      </div>

      {/* ---- the verdict ------------------------------------------------ */}
      <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", padding: 13, display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, display: "block", flex: "0 0 auto", background: rs.tone }} />
          <span style={micro}>THE READ</span>
          {/* "all 0 fit" beside "nothing on the slip yet" is two answers to
              the same question. An empty slip gets the sentence only. */}
          {read.length > 0 && (
            <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{rs.count}</span>
          )}
        </div>
        <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--text)", textWrap: "pretty" }}>
          {read.length === 0
            ? "Nothing on the slip yet. The read fills in as legs are added."
            : rs.headline}
        </span>
        {read.length > 0 && (
          <span style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.5, color: "var(--amber-ink)" }}>{priceLine}</span>
        )}
      </div>

      {/* ---- one card per leg ------------------------------------------- */}
      {read.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <span style={micro}>WHAT THE FLAGS REST ON</span>
          {read.map((r) => (
            <div
              key={r.key}
              style={{
                display: "flex", flexDirection: "column", gap: 6, padding: "11px 12px",
                borderRadius: 10, background: "var(--surface-1)",
                border: `1px solid ${flagCardBorder(r.flag)}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={flagChipStyle(r.flag)}>{r.flag}</span>
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "1 1 auto" }}>
                  {r.name}
                </span>
              </div>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)", textWrap: "pretty" }}>{r.say}</span>
              {/* No objection without a counted fact -- every sentence above
                  carries the thing it rests on, directly under it. */}
              <span style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.5, color: "var(--dim)" }}>{r.cite}</span>
            </div>
          ))}
        </div>
      )}

      {/* ---- did the rates hold ----------------------------------------- */}
      {calLine && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-2)", padding: "12px 13px", display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={micro}>DID YOUR RATES HOLD</span>
          <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-2)", textWrap: "pretty" }}>{calLine}</span>
        </div>
      )}

      {/* ---- the legend, said rather than inferred ----------------------- */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 2, borderTop: "1px solid var(--line)" }}>
        {FLAGS.map((f) => (
          // Stacked rather than laid across, and the meaning is allowed to
          // wrap: at 296px the three of them do not fit on one line, and a
          // legend that gets clipped is worse than no legend.
          <span key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingTop: 6 }}>
            <span style={{ ...flagChipStyle(f), flex: "0 0 auto" }}>{f}</span>
            <span style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.4, color: "var(--dim)" }}>{FLAG_MEANS[f]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
