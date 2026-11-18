import React from "react";

// "Why it could go over / under" for the prop on screen.
//
// Two layers. The counted case (lib/propFacts.js) is always here: every
// sentence carries the number it came from. The AI analysis is an optional
// layer on top -- a button that sends those same counted numbers to
// /api/case, where a model words them and a number check throws away any
// sentence carrying a figure that was not counted. If the AI is off, over its
// limit, or fails, the counted case stays and the panel says why plainly.

const SIDE_TONE = { over: "var(--pos)", under: "var(--neg)", check: "var(--warn)" };

function Group({ heading, items, tone }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 650, color: "var(--text)" }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: tone, flex: "none" }} />
        {heading}
      </span>
      {items.map((r) => (
        <div key={r.title} style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-2)", paddingLeft: 16 }}>
          <b style={{ color: "var(--text)", fontWeight: 600 }}>{r.title}.</b> {r.text}
        </div>
      ))}
    </div>
  );
}

// The plain-language reason for each way the AI call can come back empty.
function aiFailText(error) {
  if (error === "not configured") return "AI analysis isn't switched on yet. The counted case below still covers every reason.";
  if (error === "daily limit") return "You've used today's AI analyses. They reset tomorrow; the counted case below is unchanged.";
  if (error === "site limit") return "AI analysis is busy for today. The counted case below is unchanged.";
  return "Couldn't write an AI analysis right now. The counted case below is unchanged.";
}

const AiMark = ({ size = 13 }) => (
  <span aria-hidden style={{ fontSize: size, lineHeight: 1, color: "var(--amber-ink, var(--amber))" }}>✦</span>
);

export default function PropAnalysis({ facts, subtitle, ai = null }) {
  const [open, setOpen] = React.useState(false);
  // { state: "idle" | "loading" | "done" | "failed", result, error }
  const [aiRun, setAiRun] = React.useState({ state: "idle" });

  // A different prop, line or player is a different packet: drop the old one.
  const packetKey = facts && facts.data ? `${ai && ai.player}|${ai && ai.market}|${facts.data.line}|${facts.data.games}` : "";
  React.useEffect(() => { setAiRun({ state: "idle" }); }, [packetKey]);

  if (!facts) return null;
  const { over, under, check, thin } = facts;
  const summary = thin
    ? thin
    : `${over.length} ${over.length === 1 ? "reason" : "reasons"} it could go over · ${under.length} under${check.length ? ` · ${check.length} to check` : ""}`;
  const toggle = () => setOpen((v) => !v);
  const key = (fn) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };

  // The AI is only worth asking when there is a counted case to word.
  const canAsk = !!(ai && facts.data && !thin && ["nba", "nfl"].includes(ai.sport));

  const runAi = async () => {
    if (!canAsk || aiRun.state === "loading") return;
    setOpen(true);
    setAiRun({ state: "loading" });
    try {
      const res = await fetch("/api/case", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          meta: { sport: ai.sport, player: ai.player, team: ai.team || null, market: ai.market },
          facts: { data: facts.data, over, under, check },
        }),
      });
      const json = await res.json().catch(() => null);
      if (json && json.ok && json.case) setAiRun({ state: "done", result: json.case });
      else setAiRun({ state: "failed", error: (json && json.error) || `http ${res.status}` });
    } catch {
      setAiRun({ state: "failed", error: "network" });
    }
  };

  const aiCase = aiRun.state === "done" ? aiRun.result : null;

  return (
    // flex: none -- the player pages stack these blocks in a fixed-height
    // flex column, and a shrinkable child there collapses to a sliver.
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", display: "flex", flexDirection: "column", flex: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", flexWrap: "wrap" }}>
        <div
          role="button" tabIndex={0} aria-expanded={open}
          onClick={toggle} onKeyDown={key(toggle)}
          style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 220px", minWidth: 0, cursor: "pointer" }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>The case</span>
          <span style={{ fontSize: 12.5, color: "var(--dim)" }}>{summary}</span>
        </div>
        {canAsk && (
          <span
            role="button" tabIndex={0}
            onClick={runAi} onKeyDown={key(runAi)}
            aria-label="Write an AI analysis of this prop"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 8,
              fontSize: 13, fontWeight: 650, cursor: aiRun.state === "loading" ? "progress" : "pointer",
              color: "var(--text)", whiteSpace: "nowrap",
              border: "1px solid color-mix(in srgb, var(--amber) 55%, var(--line))",
              background: "color-mix(in srgb, var(--amber) 14%, transparent)",
              opacity: aiRun.state === "loading" ? 0.75 : 1,
            }}
          >
            <AiMark />
            {aiRun.state === "loading" ? "Writing…" : "AI analysis"}
          </span>
        )}
        <span
          role="button" tabIndex={0} onClick={toggle} onKeyDown={key(toggle)}
          style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {open ? "Hide ▴" : "Show ▾"}
        </span>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid var(--line)", padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
          {subtitle && <span style={{ fontSize: 12.5, color: "var(--dim)" }}>{subtitle}</span>}

          {/* ---- the AI layer, when asked for --------------------------- */}
          {aiRun.state === "loading" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)", fontSize: 13, color: "var(--text-2)" }}>
              <AiMark /> Reading the numbers…
            </div>
          )}
          {aiRun.state === "failed" && (
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)", fontSize: 13, lineHeight: 1.5, color: "var(--text-2)" }}>
              {aiFailText(aiRun.error)}
            </div>
          )}
          {aiCase && (
            <div style={{
              display: "flex", flexDirection: "column", gap: 14, padding: "14px 16px", borderRadius: 10,
              background: "color-mix(in srgb, var(--amber) 7%, var(--surface-2))",
              border: "1px solid color-mix(in srgb, var(--amber) 40%, var(--line))",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 650, color: "var(--amber-ink, var(--amber))" }}>
                <AiMark /> AI analysis
              </span>
              {aiCase.summary && (
                <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text)", textWrap: "pretty" }}>{aiCase.summary}</span>
              )}
              <Group heading="Why it could go over" items={aiCase.over} tone={SIDE_TONE.over} />
              <Group heading="Why it could go under" items={aiCase.under} tone={SIDE_TONE.under} />
              <Group heading="Worth checking" items={aiCase.check} tone={SIDE_TONE.check} />
              <span style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--dim)" }}>
                Written by AI from the numbers counted below. Any sentence quoting a number we didn't count is removed.
              </span>
            </div>
          )}

          {/* ---- the counted case, always ------------------------------- */}
          {aiCase && <span style={{ fontSize: 12, fontWeight: 650, color: "var(--dim)" }}>Counted case</span>}
          {thin && <span style={{ fontSize: 13, color: "var(--text-2)" }}>{thin}</span>}
          <Group heading="Why it could go over" items={over} tone={SIDE_TONE.over} />
          <Group heading="Why it could go under" items={under} tone={SIDE_TONE.under} />
          <Group heading="Worth checking" items={check} tone={SIDE_TONE.check} />
          {!thin && !over.length && !under.length && !check.length && (
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>
              Nothing counted here leans either way. No stretch, matchup or role number clears its bar.
            </span>
          )}
          <span style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--dim)" }}>
            Counted from finished games and the availability report. Not a prediction, and no book priced it. Check the numbers before you bet.
          </span>
        </div>
      )}
    </div>
  );
}
