import React from "react";
import PlayerAvatar from "../PlayerAvatar.jsx";
import { crest } from "./FormPlot.jsx";

// A transcription of frame `2d` in `v3 Mocks/PropPalace Mobile v3.dc.html`.
//
// The wire, its coverage rules, its sorts and its "playing soon" window are
// `InjuriesPage`'s own. This is the phone's layout: search, two counted filter
// rows, a sort row, and one flat list — not a table folded onto 430px.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

const STATUS_WORD = { questionable: "Quest", out: "Out", active: "Active" };

function countChip(on) {
  return {
    minHeight: 40, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 8,
    fontFamily: MONO, fontSize: 12, whiteSpace: "nowrap", cursor: "pointer", flex: "0 0 auto",
    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
    background: on ? "var(--amber-dim)" : "var(--surface-1)",
    color: on ? "var(--amber-ink)" : "var(--text-2)",
  };
}

function countBadge(on) {
  return {
    fontFamily: MONO, fontSize: 10, padding: "1px 6px", borderRadius: 999, marginLeft: 6,
    background: on ? "var(--amber)" : "var(--surface-2)", color: on ? "#fff" : "var(--dim)",
  };
}

function segChip(on) {
  return {
    minHeight: 34, display: "flex", alignItems: "center", padding: "0 10px", borderRadius: 7,
    fontFamily: MONO, fontSize: 11, whiteSpace: "nowrap", cursor: "pointer", flex: "0 0 auto",
    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
    background: on ? "var(--amber-dim)" : "var(--surface-1)",
    color: on ? "var(--amber-ink)" : "var(--text-2)",
  };
}

const statusPill = (status) => ({
  fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", padding: "4px 8px", borderRadius: 999,
  flex: "0 0 auto", whiteSpace: "nowrap",
  background: status === "out" ? "var(--neg-dim)"
    : status === "questionable" ? "rgba(232,177,58,0.14)" : "var(--pos-dim)",
  color: status === "out" ? "var(--neg)"
    : status === "questionable" ? "var(--status-questionable)" : "var(--pos)",
});

export default function InjuriesMobile({
  query,
  onSetQuery,
  // A name off this very list, for the mock's tap-to-fill example.
  sampleQuery = null,
  leagues = [],
  league,
  onSetLeague,
  statuses = [],
  status,
  onSetStatus,
  sorts = [],
  sort,
  onSetSort,
  playingSoon = 0,
  rows = [],
  scopeLabel,
  coverageNote,
  loading = false,
  onOpenProp,
  kickoffLabelFor,
}) {
  return (
    <>
      <div
        style={{
          position: "sticky", top: 0, zIndex: 20, background: "var(--bg)",
          borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column",
          gap: 10, padding: "10px 0 12px",
        }}
      >
        <div style={{ padding: "0 16px" }}>
          <span
            style={{
              display: "flex", alignItems: "center", gap: 9, minHeight: 44, padding: "0 13px",
              border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-1)",
            }}
          >
            <span style={{ color: "var(--dim)", fontSize: 13 }}>⌕</span>
            <input
              value={query}
              onChange={(e) => onSetQuery(e.target.value)}
              placeholder="Search players or teams…"
              style={{
                flex: "1 1 auto", minWidth: 0, fontFamily: MONO, fontSize: 12,
                color: "var(--text)", background: "transparent", border: "none", outline: "none",
              }}
            />
            {/* `injQueryAction`: CLEAR once something is typed, and before
                that a name off this very list, so the example the box
                offers is one that will actually match. */}
            {(query || sampleQuery) && (
              <span
                onClick={() => onSetQuery(query ? "" : sampleQuery)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSetQuery(query ? "" : sampleQuery); } }}
                style={{ marginLeft: "auto", flex: "0 0 auto", whiteSpace: "nowrap", fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "var(--amber-ink)", cursor: "pointer" }}
              >
                {query ? "CLEAR" : `TRY \u201C${String(sampleQuery).toUpperCase()}\u201D`}
              </span>
            )}
          </span>
        </div>

        {/* Only the leagues with an availability feed appear; the others are
            named in the sentence at the foot rather than shown as leagues with
            nobody hurt. */}
        <div className="nsb" style={{ display: "flex", gap: 8, padding: "0 16px", overflowX: "auto" }}>
          {leagues.map((l) => {
            const on = l.id === league;
            return (
              <div key={l.id} onClick={() => onSetLeague(l.id)} style={countChip(on)}>
                {l.label}
                <span style={countBadge(on)}>{l.count}</span>
              </div>
            );
          })}
        </div>

        <div className="nsb" style={{ display: "flex", gap: 8, padding: "0 16px", overflowX: "auto" }}>
          {statuses.map((s) => {
            const on = s.id === status;
            return (
              <div key={s.id} onClick={() => onSetStatus(s.id)} style={countChip(on)}>
                {s.label}
                <span style={countBadge(on)}>{s.count}</span>
              </div>
            );
          })}
        </div>

        <div className="nsb" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", overflowX: "auto" }}>
          <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)" }}>SORT</span>
          {sorts.map((s) => (
            <div key={s.id} onClick={() => onSetSort(s.id)} style={segChip(s.id === sort)}>{s.label}</div>
          ))}
          {playingSoon > 0 && (
            <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, color: "var(--status-questionable)", whiteSpace: "nowrap" }}>
              {`${playingSoon} playing soon`}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "0 16px" }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-2)" }}>
            {`${rows.length} ${rows.length === 1 ? "player" : "players"}`}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>{scopeLabel}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: "0 0 30px" }}>
        {loading && <div style={{ padding: 16, fontFamily: MONO, fontSize: 11.5, color: "var(--dim)" }}>Loading the wire…</div>}
        {!loading && rows.length === 0 && (
          <div style={{ margin: 16, border: "1px dashed var(--line)", borderRadius: 12, padding: "20px 16px", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.7, color: "var(--dim)" }}>
            Nothing matches those filters. That is an answer rather than an empty screen — clear the search or widen the status to see the rest of the wire.
          </div>
        )}

        {rows.map((r) => (
          <div
            key={r.key || `${r.sport}:${r.name}`}
            onClick={onOpenProp ? () => onOpenProp(r) : undefined}
            role={onOpenProp ? "button" : undefined}
            tabIndex={onOpenProp ? 0 : undefined}
            onKeyDown={onOpenProp ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenProp(r); } } : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 11, padding: "13px 16px",
              borderBottom: "1px solid #20242b", minHeight: 44, cursor: onOpenProp ? "pointer" : "default",
            }}
          >
            <span style={{ position: "relative", flex: "0 0 auto" }}>
              <PlayerAvatar
                name={r.name} alt={r.name} sport={r.sport} team={r.team}
                headshotSrc={r.avatar} espnId={r.espnId} status={r.status}
                size={34} inset={2} surface="var(--bg)"
              />
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 auto" }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                <span role="img" style={crest(r.team, r.sport, 14)} />
                <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", whiteSpace: "nowrap" }}>
                  {String(r.team || "").toUpperCase()}
                </span>
              </span>
              {(r.position || r.propLine) && (
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {[r.position, r.propLine].filter(Boolean).join(" · ")}
                </span>
              )}
              {/* A team with no game on a slate we hold says so, rather than
                  sorting as though it played at the epoch. */}
              <span style={{ fontFamily: MONO, fontSize: 10, color: r.playingSoon ? "var(--status-questionable)" : "var(--dim)" }}>
                {kickoffLabelFor ? kickoffLabelFor(r) : ""}
              </span>
            </span>
            <span style={statusPill(r.status)}>{STATUS_WORD[r.status] || r.status}</span>
          </div>
        ))}

        <div style={{ padding: 16, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.04em", lineHeight: 1.7, color: "var(--dim)" }}>
          {coverageNote}
        </div>
      </div>
    </>
  );
}
