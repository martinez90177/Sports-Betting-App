import React from "react";
import PlayerAvatar, { StatusPill } from "./PlayerAvatar.jsx";

// Injury + news timeline for a single player's prop page.
// items: [{ when, tone: "current"|"scare", text, result: "over"|"under"|null }]
// `status` has no default on purpose. It used to default to "active", which
// meant a league with no availability feed at all (NBA, NFL) rendered a green
// ACTIVE pill -- a colour standing in for data nobody had. Unknown must render
// as nothing, which is what StatusPill already does for an unset status.
export function InjuryAndNews({ status, statusNote, items = [], summary }) {
  return (
    <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <span className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "var(--dim)" }}>INJURY AND NEWS</span>
        <StatusPill status={status} note={statusNote} />
      </div>

      {items.map((it, i) => (
        <div
          key={i}
          style={{
            display: "grid", gridTemplateColumns: "78px 1fr", gap: 12, alignItems: "start",
            padding: "11px 0", borderTop: "1px solid var(--line)",
            borderBottom: i === items.length - 1 ? "1px solid var(--line)" : "none",
          }}
        >
          <span className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: it.tone === "current" ? "var(--accent-text, #8fa6ff)" : "var(--amber, #e8b13a)" }}>
            {it.when}
          </span>
          <span style={{ fontSize: 13.5, lineHeight: 1.5, color: it.tone === "current" ? "var(--text)" : "var(--dim-strong, #aab2c0)" }}>
            {it.text}{" "}
            {it.result && (
              <span style={{ color: it.result === "over" ? "var(--pos, #3ecf8e)" : "var(--neg, #ef5b5b)" }}>
                {it.result === "over" ? "Over." : "Under."}
              </span>
            )}
          </span>
        </div>
      ))}

      {summary && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 14 }}>
          <span className="pp-mono" style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--pos, #3ecf8e)" }}>{summary.count}</span>
          <span style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.55 }}>{summary.text}</span>
        </div>
      )}
    </div>
  );
}

// Teammates (and key opposing defenders) whose absence changes this player's
// usage. Only list absences that moved target share by more than 3 points, and
// always name how many games the split came from.
//
// people: [{ name, team, position, espnId, headshotSrc, fallbackSrc, status, note, effect, count }]
//
// `sport` and `colorMap` exist because this app renders four leagues through
// one avatar: without them every teammate here would come out in NFL colours
// off the NFL headshot CDN (see the note at the top of PlayerAvatar.jsx --
// abbreviations collide across leagues, so the sport has to be part of the
// lookup). The status reaches the avatar as well as the pill, because rule 1 is
// that a face and its availability travel together.
export function MissingAround({ people = [], footnote, sport, colorMap }) {
  return (
    <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--line)" }}>
      <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "var(--dim)", marginBottom: 14 }}>
        MISSING AROUND HIM
      </div>

      {people.map((p, i) => (
        <React.Fragment key={p.name}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: i === 0 ? "0 0 11px" : "14px 0 11px" }}>
            <PlayerAvatar
              name={p.name}
              team={p.team}
              sport={sport}
              colorMap={colorMap}
              espnId={p.espnId}
              headshotSrc={p.headshotSrc}
              fallbackSrc={p.fallbackSrc}
              status={p.status}
              surface="var(--panel)"
              size={36}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14 }}>
                {p.name} <span className="pp-mono" style={{ fontSize: 11, color: "var(--dim)" }}>{p.position}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2 }}>{p.note}</div>
            </div>
            <span style={{ marginLeft: "auto" }}><StatusPill status={p.status} /></span>
          </div>
          {p.effect && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center", padding: "11px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontSize: 13, color: "var(--dim-strong, #aab2c0)", lineHeight: 1.5 }}>{p.effect}</span>
              {p.count && (
                <span style={{ textAlign: "right" }}>
                  <span className="pp-mono" style={{ display: "block", fontSize: 19, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--pos, #3ecf8e)" }}>{p.count.value}</span>
                  <span className="pp-mono" style={{ display: "block", fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{p.count.label}</span>
                </span>
              )}
            </div>
          )}
        </React.Fragment>
      ))}

      {footnote && <div style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.55, marginTop: 14 }}>{footnote}</div>}
    </div>
  );
}
