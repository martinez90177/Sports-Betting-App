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

const MONO = "'Inter', system-ui, sans-serif";

const micro = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", color: "var(--dim)" };

function slipFailText(error) {
  if (error === "not configured") return "The AI take isn't switched on yet. Everything below is still counted from your legs.";
  if (error === "daily limit") return "You've used today's AI reviews. They reset tomorrow.";
  if (error === "site limit") return "AI reviews are busy for today. Everything below still applies.";
  return "Couldn't write a review right now. Everything below still applies.";
}

function AiList({ heading, items, tone }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 650, color: "var(--text)" }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: tone }} />
        {heading}
      </span>
      {items.map((b) => (
        <span key={b.title} style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)", paddingLeft: 14, textWrap: "pretty" }}>
          <b style={{ color: "var(--text)", fontWeight: 600 }}>{b.title}.</b> {b.text}
        </span>
      ))}
    </div>
  );
}

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
  moves = [],
  weakest = null,
  checks = [],
  slipPacket = null,
}) {
  // { state: "idle" | "loading" | "done" | "failed", review, error }
  const [aiRun, setAiRun] = React.useState({ state: "idle" });
  // A changed slip or build is a different review: drop the old one.
  const slipKey = slipPacket ? JSON.stringify([slipPacket.intent, slipPacket.target, slipPacket.legs.map((l) => [l.name, l.prop, l.flag])]) : "";
  React.useEffect(() => { setAiRun({ state: "idle" }); }, [slipKey]);

  const runAi = async () => {
    if (!slipPacket || aiRun.state === "loading") return;
    setAiRun({ state: "loading" });
    try {
      const res = await fetch("/api/slip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(slipPacket),
      });
      const json = await res.json().catch(() => null);
      if (json && json.ok && json.review) setAiRun({ state: "done", review: json.review });
      else setAiRun({ state: "failed", error: (json && json.error) || `http ${res.status}` });
    } catch {
      setAiRun({ state: "failed", error: "network" });
    }
  };
  const aiKey = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); runAi(); } };
  const review = aiRun.state === "done" ? aiRun.review : null;

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
                  borderRadius: 7, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.02em",
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

      {/* ---- the weakest link, named ------------------------------------ */}
      {weakest && (
        <div style={{ border: `1px solid ${flagCardBorder(weakest.flag === "FITS" ? "CHECK" : weakest.flag)}`, borderRadius: 12, background: "var(--surface-1)", padding: "11px 13px", display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={micro}>WEAKEST LEG</span>
          <span style={{ fontSize: 13.5, fontWeight: 650, color: "var(--text)" }}>
            {weakest.name}
            {weakest.prop && <span style={{ fontWeight: 500, color: "var(--dim)" }}> · {weakest.prop}</span>}
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)", textWrap: "pretty" }}>{weakest.why}</span>
        </div>
      )}

      {/* ---- what only the whole slip can see --------------------------- */}
      {checks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={micro}>SLIP CHECKS</span>
          {checks.map((c) => (
            <div key={c.title} style={{ border: `1px solid ${flagCardBorder("CHECK")}`, borderRadius: 10, background: "var(--surface-1)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={flagChipStyle("CHECK")}>CHECK</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.title}</span>
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)", textWrap: "pretty" }}>{c.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* ---- the AI take, on request -------------------------------------- */}
      {slipPacket && (
        <div style={{
          borderRadius: 12, padding: "12px 13px", display: "flex", flexDirection: "column", gap: 10,
          background: review ? "color-mix(in srgb, var(--amber) 7%, var(--surface-1))" : "var(--surface-1)",
          border: `1px solid ${review ? "color-mix(in srgb, var(--amber) 40%, var(--line))" : "var(--line)"}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden style={{ color: "var(--amber-ink, var(--amber))", fontSize: 13 }}>✦</span>
            <span style={{ fontSize: 13, fontWeight: 650, color: "var(--text)" }}>AI take</span>
            <span
              role="button" tabIndex={0} onClick={runAi} onKeyDown={aiKey}
              aria-label="Ask the AI to review this slip"
              style={{
                marginLeft: "auto", padding: "6px 11px", borderRadius: 7, fontSize: 12, fontWeight: 650, whiteSpace: "nowrap",
                cursor: aiRun.state === "loading" ? "progress" : "pointer", color: "var(--text)",
                border: "1px solid color-mix(in srgb, var(--amber) 55%, var(--line))",
                background: "color-mix(in srgb, var(--amber) 14%, transparent)",
                opacity: aiRun.state === "loading" ? 0.75 : 1,
              }}
            >
              {aiRun.state === "loading" ? "Reading…" : review ? "Ask again" : "Review my slip"}
            </span>
          </div>
          {aiRun.state === "idle" && (
            <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--dim)" }}>A written read of the whole slip, from the same counted numbers as the cards below.</span>
          )}
          {aiRun.state === "failed" && (
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)" }}>{slipFailText(aiRun.error)}</span>
          )}
          {review && (
            <>
              {review.verdict && <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--text)", textWrap: "pretty" }}>{review.verdict}</span>}
              <AiList heading="Holding it up" items={review.strengths} tone="var(--pos)" />
              <AiList heading="Could sink it" items={review.risks} tone="var(--neg)" />
              {review.weakest && (
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)" }}>
                  <b style={{ color: "var(--text)" }}>Weakest: {review.weakest.name}.</b> {review.weakest.why}
                </span>
              )}
              {review.tighten && (
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)" }}>
                  <b style={{ color: "var(--text)" }}>To tighten it:</b> {review.tighten}
                </span>
              )}
              <span style={{ fontSize: 11, lineHeight: 1.5, color: "var(--dim)" }}>Written by AI from the counted numbers. Any sentence quoting a number we didn&rsquo;t count is removed.</span>
            </>
          )}
        </div>
      )}

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

      {/* ---- what to do about it ----------------------------------------- */}
      {read.length > 0 && moves.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={micro}>NEXT MOVES</span>
          {moves.map((m) => (
            <div key={m.title} style={{ borderLeft: "2px solid var(--amber)", padding: "2px 0 2px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{m.title}</span>
              <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-2)", textWrap: "pretty" }}>{m.why}</span>
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
