import React from "react";

// "Why it could go over / under" for the prop on screen, drawn from counted
// facts only (see lib/propFacts.js). Rests as one line saying how many reasons
// sit on each side, and opens in place. Not a model's output and not a
// prediction: every sentence carries the number it came from.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const micro = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };

function Group({ heading, items }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{heading}</span>
      {items.map((r) => (
        <div key={r.title} style={{ display: "flex", gap: 8, fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)" }}>
          <span aria-hidden style={{ flex: "none", marginTop: 7, width: 5, height: 5, borderRadius: 3, background: "var(--text-2)" }} />
          <span><b style={{ color: "var(--text)" }}>{r.title}:</b> {r.text}</span>
        </div>
      ))}
    </div>
  );
}

export default function PropAnalysis({ facts, subtitle }) {
  const [open, setOpen] = React.useState(false);
  if (!facts) return null;
  const { over, under, check, thin } = facts;
  const summary = thin
    ? thin
    : `${over.length} ${over.length === 1 ? "reason" : "reasons"} it could go over · ${under.length} under${check.length ? ` · ${check.length} to check` : ""}`;
  const key = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } };

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", display: "flex", flexDirection: "column" }}>
      <div
        role="button" tabIndex={0} aria-expanded={open}
        onClick={() => setOpen((v) => !v)} onKeyDown={key}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer", flexWrap: "wrap" }}
      >
        <span style={micro}>THE CASE</span>
        <span style={{ fontSize: 12.5, color: "var(--text-2)", flex: 1, minWidth: 0 }}>{summary}</span>
        <span style={{ ...micro, letterSpacing: "0.08em" }}>{open ? "HIDE ▴" : "SHOW ▾"}</span>
      </div>
      {open && (
        <div style={{ borderTop: "1px solid var(--line)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
          {subtitle && <span style={{ fontSize: 12, color: "var(--dim)" }}>{subtitle}</span>}
          {thin && <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{thin}</span>}
          <Group heading="Why it could go over" items={over} />
          <Group heading="Why it could go under" items={under} />
          <Group heading="Worth checking" items={check} />
          {!thin && !over.length && !under.length && !check.length && (
            <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
              Nothing counted here leans either way — no stretch, matchup or role number clears its bar.
            </span>
          )}
          <span style={{ fontFamily: MONO, fontSize: 10, lineHeight: 1.6, color: "var(--dim)" }}>
            Counted from finished games and the availability report. Not a prediction, and no book priced it — check the numbers before you bet.
          </span>
        </div>
      )}
    </div>
  );
}
