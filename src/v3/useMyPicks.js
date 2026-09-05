import React from "react";
import { useSettings } from "../settings.jsx";
import { INTENTS, TARGETS, intentRead, intentMoves, readSummary } from "./intentRead.js";

// Everything both My Picks frames derive from the slip.
//
// The phone (frame 3a) and the desktop (frame 2a) draw the same screen at two
// widths: the same five intents, the same target ladder, the same per-leg
// flags, the same combined number, the same ledger filters. Two copies of this
// would be two answers to "is this leg AGAINST", which is exactly the kind of
// disagreement `CLAUDE.md` rule 9 exists to stop — one source per fact, and
// the slip's leg count, the docks, the Gamecast panel and the Player Detail
// chip all already read one array.
//
// State lives here too, not in the frames: which intent is selected and what
// the target is are the reader's, and they should not reset because a window
// was resized across the breakpoint.
export default function useMyPicks({
  legs = [],
  settled = [],
  correlationGroups = [],
  combinedOdds = null,
  calibration = null,
}) {
  const [tab, setTab] = React.useState("Slip");
  const [ledgerFilter, setLedgerFilter] = React.useState("All");

  // Which tab is showing is this frame's business and dies with it. What the
  // reader is *building*, and what price they are building toward, are not --
  // those are preferences, and they used to reset to "safe" every time the
  // slip was reopened or the window crossed the phone/desktop breakpoint,
  // silently re-flagging every leg against an objective nobody chose.
  const settings = useSettings();
  const stored = settings.picks || {};

  // A stored id that no longer exists (an intent renamed in a later release)
  // resolves to the default rather than leaving `intent` undefined and taking
  // every read down with it.
  const intent = INTENTS.find((i) => i.id === stored.intent) || INTENTS[0];
  const intentId = intent.id;
  const setIntentId = React.useCallback((id) => settings.set("picks", "intent", id), [settings]);

  const target = TARGETS.includes(stored.target) ? stored.target : 300;
  const setTarget = React.useCallback((v) => settings.set("picks", "target", v), [settings]);

  // Every rate on this screen is the leg's own, counted when it was added --
  // `hitRate`, `gamesOver` and `gamesCounted` were written together by
  // pickFromRung, so the percentage and its sample cannot disagree.
  const view = legs.map((p) => ({
    id: p.id,
    sport: p.sport,
    name: p.name,
    team: p.team,
    prop: p.subtitle,
    rate: p.hitRate,
    hits: p.gamesOver,
    n: p.gamesCounted,
    alt: p.mainLine != null && p.line != null && p.line !== p.mainLine,
    avail: p.status || null,
    defRank: (p.snap && p.snap.rank) != null ? p.snap.rank : null,
    odds: p.odds,
    opp: p.opp,
    avatar: p.avatar,
    avatarFallback: p.avatarFallback,
    espnId: p.espnId,
    playerId: p.playerId,
    marketId: p.marketId,
  }));

  // Their own rates multiplied. Not a price, and never presented as one.
  const combinedRate = view.length && view.every((l) => l.rate != null)
    ? view.reduce((a, l) => a * l.rate, 1)
    : null;

  const read = view.map((l) => intentRead(l, intent, null));
  const rs = readSummary(read, intent);
  const am = combinedOdds;
  const short = am == null || am < target;
  const sameGame = correlationGroups.length;
  const moves = intentMoves(read, intent, { short, target, am, sameGame });

  const matches = (p, label) =>
    label === "All"
    || (label === "Won" && p.result === "won")
    || (label === "Lost" && p.result === "lost")
    || (label === "Open" && p.result && p.result !== "won" && p.result !== "lost");

  const ledgerRows = settled.filter((p) => matches(p, ledgerFilter));
  const ledgerCount = (label) => settled.filter((p) => matches(p, label)).length;

  // Whether the rates this slip claims have held up. Four states and none of
  // them is a silent blank: no settled pick carries a claimed rate, no band
  // has enough behind it, one band missed, or every readable band landed.
  const calLine = (() => {
    if (!calibration) return "Not yet — no settled pick carries the rate it claimed, so there is nothing to check against.";
    if (calibration.readable === 0) return "Not yet — no claimed band has enough settled picks behind it, so there is nothing to check against.";
    if (calibration.worst) {
      return `The ${calibration.worst.label} band claimed ${Math.round(calibration.worst.claimed * 100)}% and returned ${Math.round(calibration.worst.real * 100)}% over ${calibration.worst.count} picks.`;
    }
    return `${calibration.readable} of the four bands are readable, and each landed within what it claimed.`;
  })();

  return {
    calLine,
    tab, setTab,
    intent, intentId, setIntentId,
    target, setTarget,
    ledgerFilter, setLedgerFilter,
    view, combinedRate, read, rs, moves, short, am, sameGame,
    ledgerRows, ledgerCount,
  };
}
