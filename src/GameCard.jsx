import React, { useEffect, useMemo, useRef, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import TeamLogo from "./TeamLogo.jsx";
import { buildPropsInPlay } from "./GamecastPage.jsx";
import { mlbHeadshot } from "./lib/mlbStatus.js";
import {
  timeLabel, dayLabel, fetchGamecastDetail,
  GAME_STATUS, isActiveStatus, opensGamecast,
} from "./lib/gamesData.js";

// The Games slate's card, transcribed from `PropPalace Games v2.dc.html`.
//
// The screen this replaces was a four-column table -- MATCHUP | KICKOFF |
// PROPS WORTH A LOOK | RESEARCH -- whose rows opened the full GamecastPage or
// MatchupPage inline underneath. The file draws neither: a game is a bordered
// card carrying both teams with their records and scores, and opening one
// unfolds a compact gamecast *inside* the card (linescore, the live situation,
// decisions, props in play, leaders).
//
// Two substitutions from the file, both already established in this project:
//   * its lettered team badges become the real crest (see TeamLogo's note --
//     the design files could not carry images),
//   * its initials circles become PlayerAvatar, which is the one avatar in the
//     app and carries availability with it (CLAUDE.md rule 1).
//
// The full-page GamecastPage and MatchupPage are still reachable, from the
// footer of an open card. Nothing this screen used to show has been dropped.

// Which state colour edges the card. The file's own palette is four fixed
// hexes; this maps onto the app's --state-* family, which says the same thing
// in the same four hues (see the --state-* block in index.css).
//
// One departure: the file edges STARTING_SOON in #3b5bdb, its accent. This app
// re-tints its accent from Settings and reserves it for "selected", so a
// starting-soon game takes --state-pre -- the same pair its swatch already
// uses -- rather than borrowing a colour that means something else here.
const STATE_EDGE = {
  [GAME_STATUS.LIVE]: "var(--state-live)",
  [GAME_STATUS.HALFTIME]: "var(--state-live)",
  [GAME_STATUS.INTERMISSION]: "var(--state-live)",
  [GAME_STATUS.STARTING_SOON]: "var(--state-pre)",
  [GAME_STATUS.UPCOMING]: "var(--line)",
  [GAME_STATUS.DELAYED]: "var(--state-delayed)",
  [GAME_STATUS.SUSPENDED]: "var(--state-delayed)",
  [GAME_STATUS.FINAL]: "var(--state-final)",
  [GAME_STATUS.POSTPONED]: "var(--line)",
};

// Where a game is in its life, as a swatch.
//
// A **square**, deliberately. The only other filled marks in this app are the
// form graph's bars, and those are green for cleared and red for fell short,
// so shape is what stops "live" reading as "this prop hit". One hue per
// *pair*, split by fill: the active half of a pair is filled, the paused or
// not-yet half is hollow.
export const STATE_STYLE = {
  [GAME_STATUS.LIVE]:          { token: "--state-live",    fill: true },
  [GAME_STATUS.HALFTIME]:      { token: "--state-live",    fill: false },
  [GAME_STATUS.INTERMISSION]:  { token: "--state-live",    fill: false },
  [GAME_STATUS.STARTING_SOON]: { token: "--state-pre",     fill: true },
  [GAME_STATUS.UPCOMING]:      { token: "--state-pre",     fill: false },
  [GAME_STATUS.DELAYED]:       { token: "--state-delayed", fill: true },
  [GAME_STATUS.SUSPENDED]:     { token: "--state-delayed", fill: false },
  [GAME_STATUS.FINAL]:         { token: "--state-final",   fill: true },
  [GAME_STATUS.POSTPONED]:     { token: "--state-final",   fill: false },
};

export function StateSwatch({ status, size = 8 }) {
  // A *missing* status is treated as UPCOMING, the same default the slate sort
  // already applies -- the fetchers leave it unset on plain scheduled games. A
  // status that is present but unrecognised is different and gets no swatch: a
  // state this app does not know is not "scheduled", and colouring it as
  // though it were would invent the one fact the swatch exists to report.
  const st = STATE_STYLE[status || GAME_STATUS.UPCOMING];
  if (!st) return null;
  const c = `var(${st.token})`;
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: 2, flexShrink: 0, boxSizing: "border-box",
        background: st.fill ? c : "transparent",
        border: `1.5px solid ${c}`,
        // Only a genuinely live game pulses. A halftime or delayed game is
        // stopped, and a pulsing marker would say otherwise.
        animation: status === GAME_STATUS.LIVE ? "gm-live-pulse 1.6s ease-out infinite" : undefined,
      }}
    />
  );
}

export function stateColor(status) {
  const st = STATE_STYLE[status || GAME_STATUS.UPCOMING];
  return st ? `var(${st.token})` : "var(--dim-strong)";
}

// The card's headline state, in the file's own vocabulary: a live game leads
// with its period, a scheduled one with its clock.
export function statusText(game) {
  const status = game.status || GAME_STATUS.UPCOMING;
  if (isActiveStatus(status) && game.periodLabel) return game.periodLabel;
  switch (status) {
    case GAME_STATUS.LIVE: return "Live";
    case GAME_STATUS.HALFTIME: return "Halftime";
    case GAME_STATUS.INTERMISSION: return "Intermission";
    case GAME_STATUS.FINAL: return "Final";
    case GAME_STATUS.STARTING_SOON: return `Starting soon · ${timeLabel(game.startsAt)}`;
    case GAME_STATUS.DELAYED: return "Delayed";
    case GAME_STATUS.SUSPENDED: return "Suspended";
    case GAME_STATUS.POSTPONED: return "Postponed";
    default: return timeLabel(game.startsAt);
  }
}

const MARGIN_WORD = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

// The line under the state. The file writes a human sentence there -- "Rangers
// lead by one", "American Family Field" -- so this derives one from what the
// slate actually holds: the margin once there are scores, the venue before
// then. Never a guess: a game with neither reads as its own day.
export function statusDetail(game) {
  const a = game.away.score;
  const h = game.home.score;
  if (typeof a === "number" && typeof h === "number") {
    if (a === h) return game.isFinal ? "Tied" : "Tied game";
    const lead = Math.abs(a - h);
    const front = a > h ? game.away.name : game.home.name;
    const word = MARGIN_WORD[lead] || String(lead);
    return game.isFinal ? `${front} win by ${word}` : `${front} lead by ${word}`;
  }
  if (game.venue?.name) {
    return game.venue.city ? `${game.venue.name} · ${game.venue.city}` : game.venue.name;
  }
  return game.startsAt ? dayLabel(game.startsAt) : "";
}

// ------------------------------------------------------------- team line

function TeamLine({ game, side, sport, isMobile }) {
  const t = game[side];
  const started = game.away.score != null || game.home.score != null;
  const mine = t.score;
  const theirs = side === "away" ? game.home.score : game.away.score;
  // On a final the loser dims so the result reads at a glance.
  const scoreColor = !started ? "var(--dim)"
    : game.isFinal && typeof mine === "number" && typeof theirs === "number" && mine < theirs
      ? "var(--dim-strong)"
      : "var(--text)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <span style={{
        display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
        width: 30, height: 30, borderRadius: 5,
        background: "var(--surface-2)", border: "1px solid var(--line)",
      }}>
        <TeamLogo sport={sport} abbr={t.abbr} size={22} title={t.full} />
      </span>
      <span className="pp-display" style={{
        fontWeight: 600, fontSize: isMobile ? 15 : 16, minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {t.name}
      </span>
      {/* A record the provider omitted comes back as "" -- an em dash says
          "not published" rather than leaving an invisible gap. */}
      <span className="pp-mono tnum" style={{ marginLeft: "auto", flex: "none", fontSize: 10, color: "var(--dim)" }}>
        {t.record || "—"}
      </span>
      <span className="pp-mono tnum" style={{
        flex: "none", width: 32, textAlign: "right", fontSize: 18, color: scoreColor,
      }}>
        {typeof mine === "number" ? mine : "–"}
      </span>
    </div>
  );
}

// ------------------------------------------------------------- linescore

// The file draws the linescore as one flat cell list inside a single grid, so
// the columns of the three rows cannot drift apart. Same here, off the
// normalized { columns, rows } shape lib/gamesData.js returns for both
// providers.
function Linescore({ detail, sportLabel, sportTone, periodLabel }) {
  const periods = detail.columns.filter((c) => !c.total);
  const totals = detail.columns.filter((c) => c.total);
  const cols = `56px repeat(${periods.length}, minmax(30px, 1fr)) ${totals.map(() => "38px").join(" ")}`;

  const cells = [];
  const push = (v, o) => cells.push({
    v: v === null || v === undefined ? "" : String(v),
    align: "center", size: 12.5, weight: 400, fg: "var(--text)", top: "none", left: "none",
    ...(o || {}),
  });

  push("", { align: "left", size: 11 });
  periods.forEach((c) => push(c.label, { size: 11, weight: 700, fg: "var(--dim)" }));
  totals.forEach((c, i) => push(c.label, {
    size: 11, weight: 700, fg: "var(--text)",
    left: i === 0 ? "1px solid var(--line)" : "none",
  }));
  detail.rows.forEach((row) => {
    push(row.abbr || "—", { align: "left", weight: 700, top: "1px solid var(--line)" });
    periods.forEach((c, i) => {
      const v = row.cells[i];
      // A period not yet played has no value at all -- it stays blank rather
      // than becoming a zero the team never scored.
      push(v, { fg: v === "" || v == null ? "var(--dim)" : "var(--text-2)", top: "1px solid var(--line)" });
    });
    totals.forEach((c, i) => push(row.cells[periods.length + i], {
      weight: 700, fg: "var(--text)", top: "1px solid var(--line)",
      left: i === 0 ? "1px solid var(--line)" : "none",
    }));
  });

  return (
    <div style={{ background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
        background: "var(--surface-sunken)", borderBottom: "1px solid var(--line)",
      }}>
        <span className="pp-display" style={{ fontWeight: 600, fontSize: 16 }}>Linescore</span>
        <span className="pp-mono" style={{ fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: sportTone }}>
          {sportLabel}
        </span>
        <span className="pp-mono" style={{ marginLeft: "auto", fontSize: 10, letterSpacing: "0.06em", color: "var(--dim)", whiteSpace: "nowrap" }}>
          {periodLabel}
        </span>
      </div>
      {/* Extra innings and overtime widen this past a phone screen, so the
          grid scrolls inside its own box rather than pushing the card
          sideways. */}
      <div style={{ overflowX: "auto", padding: "14px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: 0, minWidth: "min-content" }}>
          {cells.map((c, i) => (
            <span
              key={i}
              className="pp-mono tnum"
              style={{
                padding: "8px 9px", textAlign: c.align, fontSize: c.size, fontWeight: c.weight,
                whiteSpace: "nowrap", color: c.fg, borderTop: c.top, borderLeft: c.left,
              }}
            >
              {c.v}
            </span>
          ))}
        </div>
      </div>
      <Diamond situation={detail.situation} />
      <Decisions decisions={detail.decisions} />
    </div>
  );
}

// MLB live only. A diamond on a scheduled or finished game would assert a base
// state the provider is not reporting -- see the `situation` note in
// lib/gamesData.js, which is why this is null rather than empty off a final.
function Diamond({ situation }) {
  if (!situation) return null;
  const base = (on) => ({
    position: "absolute", width: 14, height: 14, transform: "rotate(45deg)", boxSizing: "border-box",
    background: on ? "var(--state-live)" : "transparent",
    border: `1.5px solid ${on ? "var(--state-live)" : "var(--line)"}`,
  });
  const on = [];
  if (situation.first) on.push("1st");
  if (situation.second) on.push("2nd");
  if (situation.third) on.push("3rd");
  const label = { fontFamily: "'Space Mono', monospace", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" };
  const count = situation.balls == null || situation.strikes == null
    ? null : `${situation.balls}–${situation.strikes}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", padding: "12px 16px", borderTop: "1px solid var(--line)" }}>
      <div>
        <div style={label}>On base</div>
        <span aria-hidden style={{ position: "relative", display: "block", width: 50, height: 50, marginTop: 8 }}>
          <span style={{ ...base(situation.second), left: 18, top: 0 }} />
          <span style={{ ...base(situation.first), right: 0, top: 18 }} />
          <span style={{ ...base(situation.third), left: 0, top: 18 }} />
          {/* Home plate is never "occupied" -- it is drawn hollow always, as
              the anchor that tells you which way round the diamond is. */}
          <span style={{ ...base(false), left: 18, bottom: 0 }} />
        </span>
      </div>
      {/* Between half-innings MLB drops the count while the runners stay put,
          so this says so instead of printing a stale 0-0. */}
      <div>
        <div style={label}>Count</div>
        <div className="pp-mono tnum" style={{ fontSize: 15, marginTop: 7 }}>{count || "—"}</div>
      </div>
      {/* No Outs cell, deliberately. The period label above already carries
          the outs ("TOP 9TH • 1 OUT"), and the two are fetched a moment apart
          -- the slate poller and the gamecast poller -- so a second copy on
          the same card contradicted the first mid-inning. One source. */}
      {situation.atBat && (
        <div>
          <div style={label}>At bat</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginTop: 6, whiteSpace: "nowrap" }}>{situation.atBat}</div>
        </div>
      )}
      <div className="pp-mono" style={{ marginLeft: "auto", fontSize: 10, letterSpacing: "0.06em", color: "var(--dim)", lineHeight: 1.5, maxWidth: 190 }}>
        {on.length ? `Runners on ${on.join(", ")}.` : "Bases empty."}
      </div>
    </div>
  );
}

function Decisions({ decisions }) {
  if (!decisions?.length) return null;
  const role = (r) => (r === "winner" ? "Win" : r === "loser" ? "Loss" : r === "save" ? "Save" : r);
  return (
    <div style={{ display: "flex", gap: 26, flexWrap: "wrap", padding: "12px 16px", borderTop: "1px solid var(--line)" }}>
      {decisions.map((d) => (
        <div key={d.role}>
          <div className="pp-mono" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" }}>
            {role(d.role)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, marginTop: 3, whiteSpace: "nowrap" }}>{d.name}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------- props in play

// The bar's top end. The file hardcodes one per prop; this derives it, so that
// whatever line and total arrive the fill and the dashed line share an axis.
// Roughly twice the line, raised to clear tonight's figure and rounded up to a
// readable step.
function barTop(line, value) {
  const need = Math.max(line * 2, (value || 0) * 1.15, line + 1);
  const step = need <= 6 ? 1 : need <= 20 ? 2 : need <= 60 ? 10 : 20;
  return Math.max(step, Math.ceil(need / step) * step);
}

function PropsInPlay({ game, sport, reads, detail, propsCount, onViewProps, onOpenProp, isMobile }) {
  const started = game.away.score != null || game.home.score != null;
  const isFinal = game.status === GAME_STATUS.FINAL;

  const rows = useMemo(() => {
    if (!reads?.length) return [];
    // Tonight's figures come from the same builder the full Gamecast uses, so
    // the two can never disagree. It is joined back onto the reads by name
    // rather than replacing them, because a market the boxscore cannot follow
    // still belongs on this list -- it just has nothing to report yet.
    const live = detail?.boxscore?.length
      ? buildPropsInPlay(reads, detail.boxscore, sport, isFinal)
      : { rows: [], untracked: 0 };
    const byName = new Map(live.rows.map((r) => [r.name, r]));
    // Two different silences, and they were reading as one: a player the
    // boxscore has never heard of tonight (rested, optioned, not yet in the
    // game) against a player who is playing but whose market the boxscore
    // does not carry a column for. Saying "not reported live" for the first
    // claims a market gap that isn't the reason.
    const inBox = new Set();
    (detail?.boxscore || []).forEach((t) => (t.groups || []).forEach(
      (g) => (g.players || []).forEach((pl) => inBox.add(pl.name))
    ));
    return reads.map((rd) => {
      const l = byName.get(rd.name);
      const value = l ? l.value : null;
      return {
        inBox: inBox.has(rd.name),
        key: `${rd.name}-${rd.market}`,
        name: rd.name,
        playerId: rd.playerId,
        market: rd.market,
        team: l?.teamAbbr || rd.team,
        // The boxscore's headshot once the game is under way, the roster's own
        // provider id before that -- otherwise every pre-game card was a row
        // of initials.
        headshot: l?.headshot || (rd.mlbId ? mlbHeadshot(rd.mlbId) : null),
        espnId: rd.espnId,
        marketLabel: rd.marketLabel,
        line: rd.line,
        value,
        tracked: value != null,
        passed: value != null && value > rd.line,
        seasonRate: rd.thin ? null : rd.hitRate,
        seasonOver: rd.gamesOver,
        seasonSample: rd.gamesCounted,
      };
    });
  }, [reads, detail, sport, isFinal]);

  if (!rows.length) return null;

  return (
    <div style={{ background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 6, marginTop: 14, overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px",
        background: "var(--surface-sunken)", borderBottom: "1px solid var(--line)",
      }}>
        <span className="pp-display" style={{ fontWeight: 600, fontSize: 16 }}>Props in play</span>
        <span className="pp-mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)", whiteSpace: "nowrap" }}>
          {isFinal ? "how they finished against the line"
            : started ? "tonight against the line"
            : "season history"}
        </span>
        {onViewProps && (
          <span
            role="button"
            tabIndex={0}
            onClick={() => onViewProps(game)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewProps(game); } }}
            className="pp-mono"
            style={{ marginLeft: "auto", cursor: "pointer", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent-text)", whiteSpace: "nowrap" }}
          >
            {/* Not "All N props →" as the file writes it: the feed does not
                open filtered to one game (see goToGameProps in PropLedger),
                so that label would promise a narrowing that never happens.
                The count is stated in the footnote below instead. */}
            Open in feed →
          </span>
        )}
      </div>
      <div style={{ padding: "4px 16px 14px" }}>
        {rows.map((r, i) => {
          const top = barTop(r.line, r.value);
          const pct = r.value == null ? 0 : Math.min(100, Math.round((r.value / top) * 100));
          const lineAt = Math.min(100, Math.round((r.line / top) * 100));
          // Filled once past the line; neutral until then. A prop under its
          // line in the third inning has not missed -- it has four at-bats
          // left -- so only a final turns a shortfall red.
          const verdict = !started || !r.tracked ? "Pending"
            : r.passed ? "Cleared"
            : isFinal ? "Short" : "Live";
          const verdictFg = r.passed ? "var(--pos)" : isFinal && r.tracked ? "var(--neg)" : "var(--text-2)";
          const verdictBorder = r.passed
            ? "color-mix(in srgb, var(--pos) 45%, transparent)"
            : isFinal && r.tracked ? "color-mix(in srgb, var(--neg) 45%, transparent)" : "var(--line)";
          const open = () => onOpenProp && onOpenProp(sport, r.playerId, r.market, { name: r.name, team: r.team });
          return (
            <div
              key={r.key}
              role={onOpenProp ? "button" : undefined}
              tabIndex={onOpenProp ? 0 : undefined}
              onClick={onOpenProp ? open : undefined}
              onKeyDown={onOpenProp ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } : undefined}
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "minmax(0, 1fr) 92px"
                  : "minmax(150px, 1.5fr) minmax(120px, 1.1fr) minmax(170px, 2fr) 112px",
                gap: isMobile ? 10 : 16, alignItems: "center", padding: "12px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--line)",
                cursor: onOpenProp ? "pointer" : "default",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <PlayerAvatar
                  name={r.name}
                  sport={sport}
                  team={r.team}
                  headshotSrc={r.headshot}
                  espnId={r.espnId}
                  size={30}
                  inset={2}
                  surface="var(--surface-1)"
                  fadeIn
                />
                <div style={{ minWidth: 0 }}>
                  <div className="pp-display" style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.name}
                  </div>
                  <div className="pp-mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)", marginTop: 3, whiteSpace: "nowrap" }}>
                    {r.team}
                  </div>
                </div>
              </div>

              {!isMobile && (
                <span className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Over {r.line} {r.marketLabel}
                </span>
              )}

              {!isMobile && (
                <div style={{ minWidth: 0 }}>
                  <div style={{ position: "relative", height: 9, borderRadius: 2, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                    <div style={{
                      height: "100%", borderRadius: 2, width: `${pct}%`,
                      background: r.passed ? "var(--pos-solid)" : "var(--dim)",
                    }} />
                    {/* Tonight's line, always white -- it is the reference the
                        bar is read against, not an outcome. */}
                    <span style={{ position: "absolute", top: -4, bottom: -4, left: `${lineAt}%`, borderLeft: "1.5px dashed var(--text)" }} />
                  </div>
                  <div className="pp-mono tnum" style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6, fontSize: 10, color: "var(--dim)" }}>
                    <span style={{ whiteSpace: "nowrap" }}>
                      {!started ? "not started"
                        : r.tracked ? `${r.value}${isFinal ? " final" : " so far"}`
                        : r.inBox ? "not reported live"
                        : "not in the box score"}
                    </span>
                    <span style={{ whiteSpace: "nowrap" }}>
                      {r.seasonRate == null
                        ? `too few · ${r.seasonSample} games`
                        : `${Math.round(r.seasonRate * 100)}% · ${r.seasonOver} of ${r.seasonSample}`}
                    </span>
                  </div>
                </div>
              )}

              <span className="pp-mono" style={{
                justifySelf: "end", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                borderRadius: 999, padding: "5px 10px", whiteSpace: "nowrap",
                color: verdictFg, border: `1px solid ${verdictBorder}`,
              }}>
                {verdict}
              </span>
            </div>
          );
        })}
      </div>
      <div className="pp-mono" style={{ fontSize: 10, letterSpacing: "0.04em", color: "var(--dim)", padding: "0 16px 14px", lineHeight: 1.6 }}>
        {Number.isFinite(propsCount) && propsCount > 0
          ? `This game can build ${propsCount} props; the ${rows.length} with the deepest samples are shown. `
          : ""}
        {isFinal
          ? "Final figures. These now count toward the season rates on the right of every row."
          : started
            ? "A live bar is what has happened so far tonight, not a rate — it counts toward a hit rate only once the game is final."
            : "Lines are this app’s own, set from each player’s season log. Nothing has happened yet, so every bar is empty."}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- leaders

function Leaders({ detail, sport, isMobile }) {
  if (!detail?.leaders?.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginTop: 14 }}>
      {detail.leaders.map((t) => (
        <div key={t.teamAbbr} style={{ background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "11px 16px",
            background: "var(--surface-sunken)", borderBottom: "1px solid var(--line)",
          }}>
            <TeamLogo sport={sport} abbr={t.teamAbbr} size={18} />
            <span className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--text-2)" }}>{t.teamAbbr}</span>
            <span className="pp-mono" style={{ fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" }}>Leaders</span>
          </div>
          {t.items.map((it) => (
            <div key={`${it.category}-${it.name}`} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 16px", borderTop: "1px solid var(--line)" }}>
              <PlayerAvatar
                name={it.name}
                sport={sport}
                team={t.teamAbbr}
                headshotSrc={it.headshot}
                size={32}
                inset={2}
                surface="var(--surface-1)"
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                {/* ESPN gives basketball boxscore groups no `type`, so the
                    category falls through to the literal "Leaders" -- which
                    is already the heading two lines above. Printed only when
                    it says something the heading does not. */}
                {it.category && it.category !== "Leaders" && (
                  <div className="pp-mono" style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dim)" }}>
                    {it.category}
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {it.name}
                </div>
              </div>
              <span className="pp-mono tnum" style={{ flex: "none", fontSize: 11.5, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                {it.statLine}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ card

export default function GameCard({
  game, sport, sportLabel, sportTone, isMobile, open, onToggle,
  propsCount, getTopProps, onViewProps, onOpenProp, onOpenFull,
}) {
  const [detail, setDetail] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [reads, setReads] = useState(null);
  const pollRef = useRef(null);

  const showsGamecast = opensGamecast(game.status);
  const active = isActiveStatus(game.status) || game.status === GAME_STATUS.DELAYED;

  // Both loads are deferred until the card is actually opened. The old table
  // fetched nothing per row; a slate of fifteen cards each pulling a boxscore
  // and a set of game logs on mount would be fifteen fanouts nobody asked for.
  useEffect(() => {
    if (!open || !showsGamecast) { setDetail(null); setLoaded(false); return undefined; }
    let cancelled = false;
    setLoaded(false);
    setDetail(null);
    fetchGamecastDetail(game).then((d) => {
      if (cancelled) return;
      setDetail(d);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [open, showsGamecast, game.id]);

  useEffect(() => {
    if (!open || !getTopProps) { setReads(null); return undefined; }
    let cancelled = false;
    getTopProps(game.sport, game.away.abbr, game.home.abbr)
      .then((r) => { if (!cancelled) setReads(r || []); })
      .catch(() => { if (!cancelled) setReads([]); });
    return () => { cancelled = true; };
  }, [open, getTopProps, game.sport, game.away.abbr, game.home.abbr]);

  // Keep an open, running game fresh on the same 20s cadence and the same
  // hidden-tab pause the slate itself uses. A closed or finished card polls
  // nothing.
  useEffect(() => {
    const clear = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    clear();
    if (!open || !active) return clear;
    pollRef.current = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      fetchGamecastDetail(game, { force: true }).then((d) => {
        // Only replace on a real answer: a transient fetch failure should not
        // blank a linescore that is already on screen.
        if (d) setDetail(d);
      });
    }, 20_000);
    return clear;
  }, [open, active, game.id]);

  const hasLine = !!detail?.columns?.length;
  const periodLabel = game.periodLabel || (game.isFinal ? "Final" : timeLabel(game.startsAt));

  const scoreNote = game.isFinal
    ? "Final. This game now counts toward the season rates."
    : isActiveStatus(game.status)
      ? "Live game state. Season rates count finished games only."
      : "Not started. Everything above is season history.";

  return (
    <div style={{
      background: "var(--surface-1)",
      border: "1px solid var(--line)",
      borderLeft: `3px solid ${STATE_EDGE[game.status || GAME_STATUS.UPCOMING] || "var(--line)"}`,
      borderRadius: 6, overflow: "hidden",
    }}>
      <div
        className="gm-card"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${game.away.full} at ${game.home.full}, ${statusText(game)}`}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) 176px 128px",
          gap: isMobile ? 10 : 16, alignItems: "center", padding: "12px 18px", cursor: "pointer",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <TeamLine game={game} side="away" sport={sport} isMobile={isMobile} />
          <div style={{ marginTop: 7 }}>
            <TeamLine game={game} side="home" sport={sport} isMobile={isMobile} />
          </div>
        </div>

        <div style={{ minWidth: 0, display: isMobile ? "flex" : "block", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StateSwatch status={game.status} />
            <span className="pp-mono tnum" style={{
              fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              whiteSpace: "nowrap", color: stateColor(game.status),
            }}>
              {statusText(game)}
            </span>
          </div>
          <div className="pp-mono" style={{
            fontSize: 10, letterSpacing: "0.06em", color: "var(--dim)",
            marginTop: isMobile ? 0 : 6, marginLeft: isMobile ? "auto" : 0,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {statusDetail(game)}
          </div>
        </div>

        {!isMobile && (
          <span className="pp-mono" style={{
            justifySelf: "end", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase",
            whiteSpace: "nowrap", color: showsGamecast ? "var(--accent-text)" : "var(--text-2)",
          }}>
            {showsGamecast ? "Gamecast" : "Preview"} {open ? "↑" : "↓"}
          </span>
        )}
      </div>

      {open && (
        <div style={{ background: "var(--surface-sunken)", borderTop: "1px solid var(--line)", padding: 18 }}>
          {hasLine ? (
            <Linescore detail={detail} sportLabel={sportLabel} sportTone={sportTone} periodLabel={periodLabel} />
          ) : (
            <div style={{
              background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 6,
              padding: 18, textAlign: "center", fontSize: 12.5, color: "var(--dim)",
            }}>
              {!showsGamecast
                ? "Not started — there is no linescore to show. Season history is below."
                : !loaded ? "Loading the linescore…"
                : "No linescore available yet."}
            </div>
          )}

          {reads === null ? (
            <div style={{
              background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 6,
              marginTop: 14, padding: 18, textAlign: "center", fontSize: 12.5, color: "var(--dim)",
            }}>
              Reading this game&rsquo;s props…
            </div>
          ) : reads.length === 0 ? (
            <div style={{
              background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 6,
              marginTop: 14, padding: 18, textAlign: "center", fontSize: 12.5, color: "var(--dim)",
            }}>
              No prop has a deep enough sample in this matchup yet.
            </div>
          ) : (
            <PropsInPlay
              game={game}
              sport={sport}
              reads={reads}
              detail={detail}
              propsCount={propsCount}
              onViewProps={onViewProps}
              onOpenProp={onOpenProp}
              isMobile={isMobile}
            />
          )}

          <Leaders detail={detail} sport={sport} isMobile={isMobile} />

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
            <span className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.04em", color: "var(--dim)", lineHeight: 1.6 }}>
              {scoreNote}
            </span>
            {onOpenFull && (
              <span
                role="button"
                tabIndex={0}
                onClick={() => onOpenFull(game)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenFull(game); } }}
                className="pp-mono"
                style={{
                  marginLeft: "auto", cursor: "pointer", fontSize: 10.5, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "var(--accent-text)", whiteSpace: "nowrap",
                }}
              >
                {/* The full page is still here: probable starters, recent form
                    and head to head before a game, the wide gamecast after. */}
                Full {showsGamecast ? "gamecast" : "matchup"} →
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
