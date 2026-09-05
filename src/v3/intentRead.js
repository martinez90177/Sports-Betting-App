// The intent read: one leg judged against a stated objective.
//
// Transcribed from `intentRead` / `intentMoves` / `INTENTS` in
// `v3 Mocks/PropPalace Mobile v3.dc.html` (frame 3a) and
// `PropPalace Desktop v3.dc.html` (frame 2a), which draw the same engine.
// Pure: no React, no fetching, no state. Every branch reads a field the pick
// already carries.
//
// The rule the whole thing exists to keep, from `desktop-handoff.md` §4:
//
//   **No objection without a counted fact.** Every branch cites something
//   already true elsewhere in the app -- a sample size, a split, a defence
//   rank, an availability row, or a logged finding. If nothing counted
//   supports a concern, the leg reads FITS.
//
// And the two traps that document records from the design:
//
//   * A teammate on the injury report is not evidence about someone else's
//     market. The lineup branch fires only on a finding the app has logged
//     *for this player* naming the absence -- see `roleNotesFor`.
//   * Never assert a direction nothing counted. "He is out, so this cuts your
//     way" is a claim the data does not support. State the logged fact and its
//     sample; let the reader draw the arrow.

// What the reader says they are building. Each intent names its own failure so
// the read can be specific rather than generically cautious.
export const INTENTS = [
  {
    id: "safe",
    label: "Safe",
    hint: "Main lines, high rates, samples deep enough to believe. Price is whatever it comes to.",
    against: "A safe build wants a deep sample and a main line.",
  },
  {
    id: "risky",
    label: "Risky",
    hint: "Long price accepted. The read still refuses a leg whose sample cannot carry it.",
    against: "Even a risky build should not lean on a leg with almost no sample behind it.",
  },
  {
    id: "straight",
    label: "Straight parlay",
    hint: "Every leg on its posted main line. No alts, so the price comes from the count of legs.",
    against: "A straight parlay wants posted main lines only.",
  },
  {
    id: "alt",
    label: "Alt-leg parlay",
    hint: "Lines dragged past the posted number for price. Each alt is counted over the same games, never modelled.",
    against: "An alt build needs the line moved off the posted number.",
  },
  {
    id: "expose",
    label: "Matchup alts",
    hint: "Alts aimed at the softest defences on the slate, where a dragged line still has room.",
    against: "This build wants a soft matchup behind every alt.",
  },
];

export const TARGETS = [100, 300, 600, 1200];

// ---- the three flags, said in one place ---------------------------------
//
// Three, and only three, and each one means the same thing on every surface
// that draws it. This block exists because it did not: the dock had no flags
// at all, the desktop legend said "a counted fact points the other way" and
// the phone said "works against this build" for the same flag, and both froze
// their chip backgrounds as `rgba(232,177,58,0.14)` -- a literal green and a
// literal amber that keep the default palette after someone has switched the
// outcome colours in Settings.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

export const FLAGS = ["FITS", "CHECK", "AGAINST"];

// Said once, in the legend, rather than left to be inferred from a colour.
export const FLAG_MEANS = {
  FITS: "nothing counted argues against it",
  CHECK: "read it before you place it",
  AGAINST: "works against this build",
};

// CHECK is `--warn`, not `--status-questionable`. The availability tokens
// carry health and nothing else (`CLAUDE.md`, avatar rule 2); a slip flag
// borrowing one would put the same amber on a leg for two unrelated reasons
// -- "he is questionable" and "you are building a safe slip and this is 64%"
// -- with no way to tell which is being said.
export const FLAG_TONE = {
  FITS: "var(--pos)",
  CHECK: "var(--warn)",
  AGAINST: "var(--neg)",
};

export const toneOf = (flag) => FLAG_TONE[flag] || FLAG_TONE.CHECK;

// Mixed live against the token rather than frozen as an rgba, so the chip
// follows the outcome palette a reader picked in Settings. `color-mix` with a
// `var()` resolves at paint, which is the whole point -- the alternative
// needs the hex at authoring time, and the hex is the user's.
export function flagChipStyle(flag) {
  const tone = toneOf(flag);
  return {
    fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", padding: "3px 7px",
    borderRadius: 4, whiteSpace: "nowrap", lineHeight: 1.2,
    border: `1px solid ${tone}`,
    background: `color-mix(in srgb, ${tone} 14%, transparent)`,
    color: tone,
  };
}

// A leg card carries its flag in the border, at half strength so it frames
// rather than shouts. FITS gets the ordinary line: nothing to read means
// nothing to draw attention to.
export function flagCardBorder(flag) {
  return flag === "FITS" ? "var(--line)" : `color-mix(in srgb, ${toneOf(flag)} 50%, transparent)`;
}

// "a safe build" but "an alt-leg build": the article follows the word.
const articleFor = (word) =>
  ("aeiou".indexOf(String(word).charAt(0).toLowerCase()) >= 0 ? "an" : "a");

const fmtAmerican = (v) => (v == null || !Number.isFinite(v) ? "—" : v > 0 ? `+${v}` : `−${Math.abs(v)}`);

// The league's own size, so a rank is stated against the right denominator.
const TEAM_COUNT = { nfl: 32, mlb: 30, nba: 30, wnba: 15 };

// One leg against one objective.
export function intentRead(l, intent, roleNote) {
  const teams = TEAM_COUNT[l.sport] || 30;
  const base = { key: l.id, name: l.name, prop: l.prop };
  const sample = `${l.hits} of ${l.n} over the window`;
  const rank = l.defRank != null ? `opposing defence ranked #${l.defRank} of ${teams} for this market` : null;

  // A logged role change outranks the rest, because it changes what the log is
  // measuring. Only a finding that names this player AND the absence counts --
  // a teammate being out is not by itself evidence about his market, and the
  // effect's direction is not asserted, because nothing counted it.
  if (roleNote) {
    return {
      ...base,
      flag: "CHECK",
      say: `The app has logged a role change for ${l.name} with a teammate out. That changes what the games behind this rate were measuring; it does not say which way.`,
      cite: `logged: ${roleNote.split} · ${roleNote.hits} of ${roleNote.n} in that role`,
    };
  }

  if (l.avail === "questionable") {
    return {
      ...base,
      flag: "CHECK",
      say: "Listed questionable. If he is scratched the leg voids, and if he plays limited the log overstates the role.",
      cite: `availability feed: questionable · ${sample}`,
    };
  }

  if (l.avail === "out") {
    return {
      ...base,
      flag: "AGAINST",
      say: "Listed out on the availability feed. There is no game for this leg to settle in.",
      cite: `availability feed: out · ${sample}`,
    };
  }

  if (l.n != null && l.n < 10) {
    return {
      ...base,
      flag: intent.id === "safe" ? "AGAINST" : "CHECK",
      say: `Only ${l.n} games behind this rate. One result moves it several points.`,
      cite: `counted: ${sample}`,
    };
  }

  if (intent.id === "straight" && l.alt) {
    return {
      ...base,
      flag: "AGAINST",
      say: "This leg sits on a dragged line, not the posted one, so it does not belong in a straight parlay.",
      cite: `line moved off the posted number · ${sample}`,
    };
  }

  if (intent.id === "alt" && !l.alt) {
    return {
      ...base,
      flag: "CHECK",
      say: "Still on the posted line. Dragging it up a rung is what would buy the price this build is after.",
      cite: `posted line · ${sample}`,
    };
  }

  // Only fires where a rank exists. Without one there is nothing counted to
  // object with, so the leg falls through to FITS rather than being marked on
  // a rank the app does not hold.
  if (intent.id === "expose" && l.defRank != null && l.defRank <= Math.floor(teams / 2)) {
    return {
      ...base,
      flag: "CHECK",
      say: "The matchup is not soft, so an alt here is paying for price rather than for room.",
      cite: `${rank} · ${sample}`,
    };
  }

  if (intent.id === "safe" && l.rate != null && l.rate < 0.7) {
    return {
      ...base,
      flag: "CHECK",
      say: `Cleared ${Math.round(l.rate * 100)}% — under the bar a safe build usually holds to.`,
      cite: `counted: ${sample}`,
    };
  }

  // FITS is "nothing counted argues against it", not "everything is good".
  // The soft-matchup sentence is a positive claim and may only be made where
  // a rank exists to make it -- an MLB row with no per-market defence rank
  // would otherwise be told its matchup is soft on no evidence at all. The
  // rule cuts both ways: no assertion without a counted fact either.
  const softMatchup = intent.id === "expose" && l.defRank != null && l.defRank > Math.floor(teams / 2);
  return {
    ...base,
    flag: "FITS",
    say: softMatchup
      ? "Soft matchup behind it, which is what this build is looking for."
      : intent.id === "expose"
        ? "Nothing counted argues against it — but this app holds no defence rank for this market, so it cannot say the matchup is soft either."
        : "Nothing in the counted data argues against it for this build.",
    cite: [`counted: ${sample}`, rank].filter(Boolean).join(" · "),
  };
}

// What to do about it. Only moves the app can actually carry out, each naming
// the leg and the reason -- "drag two lines up a rung" is a move, "consider
// your risk" is not.
export function intentMoves(read, intent, { short, target, am, sameGame }) {
  const out = [];
  const worst = read.find((r) => r.flag === "AGAINST") || read.find((r) => r.flag === "CHECK");
  if (worst) {
    out.push({ title: `Drop or replace ${worst.name}`, why: worst.say, action: "OPEN LEG", key: worst.key });
  }
  if (short && am != null) {
    // "Drag two lines" is the mock's copy for its four-leg slip. On a
    // one-leg slip there is no second line to drag, so the move names what
    // is actually there.
    out.push({
      title: read.length > 1 ? "Drag two lines up a rung" : "Drag the line up a rung",
      why: `You are at ${fmtAmerican(am)} against a +${target} target. Moving a rung recounts that leg over the same games rather than pricing it up.`,
      action: "OPEN LADDER",
    });
  } else if (intent.id === "safe") {
    out.push({
      title: "You are past the target already",
      why: "Nothing needs adding for price, and a safe build is the one place where adding legs only costs you.",
      action: "LEAVE IT",
    });
  }
  // Only when there actually are two legs in one game. The mock prints this
  // unconditionally; stating a correlation that does not exist would be an
  // objection with nothing counted behind it.
  if (sameGame > 0) {
    out.push({
      title: `Check the ${sameGame === 1 ? "two legs" : `${sameGame} groups of legs`} in one game`,
      why: "Legs in the same game are not independent, so the combined number on the slip is a ceiling rather than a price.",
      action: "OPEN GAME",
    });
  }
  return out;
}

// The headline over the leg cards, and the counts beside it.
export function readSummary(read, intent) {
  const bad = read.filter((r) => r.flag === "AGAINST").length;
  const check = read.filter((r) => r.flag === "CHECK").length;
  const kind = intent.label.toLowerCase();
  const art = articleFor(kind);
  const headline = bad
    ? `${bad}${bad === 1 ? " leg works against " : " legs work against "}${art} ${kind} build. ${intent.against}`
    : check
      ? `Nothing here contradicts ${art} ${kind} build, but ${check}${check === 1 ? " leg has" : " legs have"} something worth reading before you place it.`
      : `Every leg fits ${art} ${kind} build on the numbers this app holds.`;
  return {
    bad,
    check,
    headline,
    count: bad || check
      ? `${bad ? `${bad} against` : ""}${bad && check ? " · " : ""}${check ? `${check} to check` : ""}`
      : `all ${read.length} fit`,
    tone: bad ? FLAG_TONE.AGAINST : check ? FLAG_TONE.CHECK : FLAG_TONE.FITS,
  };
}

export { fmtAmerican, articleFor };
