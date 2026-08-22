import React from "react";
import PlayerAvatar, { StatusPill } from "./PlayerAvatar.jsx";

// The matchup context row: what this opponent gives up, how that ranks, and
// what happened the last time these two met.
//
// Every cell is optional and a cell with nothing behind it is *omitted*, not
// filled with a dash or a placeholder. A row of three real facts is worth more
// than five cells two of which are furniture.
//
// `game` and `conditions` both come off the day's slate (see usePlayerSlateGame),
// joined on *both* teams -- looking one team up finds a game it plays, which is
// not the same as finding this game. Out of season, or when the log's opponent
// isn't who the slate has this team facing, there is no join and these two
// cells are simply absent: the page says nothing about kickoff or venue rather
// than saying something untrue.
//
// `allowsLabel` is passed in rather than assumed, because what the number
// measures differs by league and by how much data has loaded -- the NFL table
// is points allowed per game for every market, not a per-market split, and
// the page already knows how to say so (nflDefIsPointsAllowed). The mock
// labels this cell "6.8 rec/g", a per-market figure this app does not have
// for every sport; printing that shape would be claiming a measurement.
export function MatchupContextRow({
  oppAbbr, allows, allowsLabel, rank, teams, tier, lastMeeting, marketLabel, conditions, game,
}) {
  const cells = [];

  if (allows != null && oppAbbr) {
    cells.push({
      key: "allows",
      label: `${oppAbbr} allows`,
      value: String(allows),
      sub: allowsLabel || null,
    });
  }

  if (rank != null && teams) {
    cells.push({
      key: "matchup",
      label: "Matchup",
      // The denominator travels with the rank: "#27" means nothing until you
      // know whether the league has 32 teams or 15.
      value: `#${rank} of ${teams}`,
      // tier is computed by defTier, which reads the rank against this
      // league's own thirds and against the side being looked at.
      sub: tier ? (tier === "soft" ? "easy" : tier) : null,
    });
  }

  if (lastMeeting) {
    cells.push({
      key: "last",
      label: "Last meeting",
      value: lastMeeting.value != null ? String(lastMeeting.value) : "—",
      sub: [lastMeeting.date, marketLabel].filter(Boolean).join(" · ") || null,
    });
  }

  // When this game starts, and how the two teams have done getting to it.
  // Both come off the slate rather than the prop builders: the builders
  // describe a player's log, and a log has never carried a kickoff time or a
  // record. That is why the Board's "first kickoff" sort had nothing to sort
  // on until the same join was threaded to it.
  if (game && (game.value || game.sub)) {
    cells.push({
      key: "game",
      // "Kickoff" / "First pitch" / "Tip-off" -- the leagues do not share a
      // word for it, and the generic one belongs to none of them.
      label: game.label || "Start",
      value: game.value || "—",
      sub: game.sub || null,
    });
  }

  // Conditions, where a provider actually reports them. MLB hydrates weather
  // on its schedule and the other leagues do not, so outside MLB this cell
  // carries the venue alone rather than claiming a forecast nobody supplied.
  if (conditions && conditions.value) {
    cells.push({
      key: "conditions",
      label: "Conditions",
      value: conditions.value,
      sub: conditions.sub || null,
    });
  }

  if (!cells.length) return null;

  return (
    // Flex-wrap with the gap doing the dividing, not a fixed column count with
    // a border on each cell. Five cells at 1/5 of a phone's width is ~50px of
    // content under a 20px pad -- every value ellipsed to nothing. Wrapping
    // costs a row and keeps the numbers readable, and because the gap is the
    // container's own colour showing through, the rules land between cells in
    // both directions without a cell having to know where a row broke.
    <div
      style={{
        display: "flex", flexWrap: "wrap", gap: 1,
        background: "var(--line)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {cells.map((c) => (
        <div
          key={c.key}
          style={{
            flex: "1 1 150px", padding: "16px 20px", minWidth: 0,
            background: "var(--panel)",
          }}
        >
          <div
            className="pp-mono"
            style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {c.label}
          </div>
          <div className="pp-mono" style={{ fontSize: 19, marginTop: 6, color: "var(--text)", whiteSpace: "nowrap" }}>
            {c.value}
          </div>
          {c.sub && (
            <div
              className="pp-mono"
              style={{ fontSize: 11, marginTop: 3, color: "var(--text-2, var(--dim))", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {c.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

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
          <span className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: it.tone === "current" ? "var(--accent-text, #8fa6ff)" : "var(--amber, #3b5bdb)" }}>
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
