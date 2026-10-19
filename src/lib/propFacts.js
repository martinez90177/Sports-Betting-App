// Why a prop could go over, and why it could go under -- written only from
// counted facts.
//
// Pure: no React, no fetching. Every sentence is composed from a number the
// caller passes in, and a reason whose numbers are missing or too thin is not
// written at all (the same rule as roleSentence and the intent read: no
// objection without a counted fact). Nothing here is a prediction and nothing
// is estimated; "could" is the strongest word the page earns.
//
// A reason whose direction nothing counted lands in `check`, not in over or
// under. A teammate on the injury report is not evidence about this player's
// market -- the page says who is out and lets the reader draw the arrow.

const MIN_GAMES = 8;          // under this a rate is not a reason
const HOT = 0.7;
const COLD = 0.4;
const SOFT_FROM_BOTTOM = 8;   // bottom eight of the league, as the Mismatch pages

const pctOf = (k, n) => Math.round((k / n) * 100);
const avg = (xs) => xs.reduce((a, v) => a + v, 0) / xs.length;
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const plural = (n, one, many) => (n === 1 ? one : many);

// series:   [{ v, home, opp, minutes }] oldest first -- the scoped log, not the
//           reader's window, so the page does not change its mind when a chip
//           moves.
// line:     the number the reader is looking at.
// def:      { rank, of, season, scope } or null. `scope` names what the rank is
//           measured in ("scoring defence", "receiving yards allowed to TEs").
// outs:     [{ name }] -- rotation teammates listed out, already filtered.
// homeTonight: true | false | null
export function buildPropFacts({ series, line, unit, def, oppAbbr, outs = [], homeTonight = null, volume = null }) {
  const over = [];
  const under = [];
  const check = [];
  const n = series.length;
  if (!Number.isFinite(line) || n < MIN_GAMES) {
    return {
      over, under, check, n,
      thin: `Only ${n} ${plural(n, "game", "games")} behind this line — too few to give a reason either way.`,
    };
  }

  const vals = series.map((g) => g.v);
  const hit = (v) => v > line;

  // ---- form: the last ten against the line ---------------------------------
  const last = vals.slice(-10);
  const k = last.filter(hit).length;
  const rate = k / last.length;
  if (rate >= HOT) {
    over.push({ title: "Clears it often", text: `Went over ${line} in ${k} of his last ${last.length} games, averaging ${f1(avg(last))} ${unit}.` });
  } else if (rate <= COLD) {
    under.push({ title: "Rarely clears it", text: `Went over ${line} in only ${k} of his last ${last.length} games, averaging ${f1(avg(last))} ${unit}.` });
  }

  // ---- trend: the last five against the rest of the log --------------------
  if (n >= 10) {
    const l5 = avg(vals.slice(-5));
    const rest = avg(vals.slice(0, -5));
    if (rest > 0) {
      const move = (l5 - rest) / rest;
      if (move >= 0.15) over.push({ title: "Trending up", text: `Averaging ${f1(l5)} ${unit} over his last five, against ${f1(rest)} in the ${n - 5} games before.` });
      else if (move <= -0.15) under.push({ title: "Trending down", text: `Averaging ${f1(l5)} ${unit} over his last five, against ${f1(rest)} in the ${n - 5} games before.` });
    }
  }

  // ---- role: volume now against volume over the log ------------------------
  if (volume && Number.isFinite(volume.recent) && Number.isFinite(volume.season) && volume.season > 0) {
    const diff = volume.recent - volume.season;
    const rel = diff / volume.season;
    if (rel >= volume.rise) {
      over.push({ title: `${volume.label[0].toUpperCase()}${volume.label.slice(1)} are up`, text: `${volume.label[0].toUpperCase()}${volume.label.slice(1)} last five: ${f1(volume.recent)} a game, against ${f1(volume.season)} over the log.` });
    } else if (rel <= -volume.rise) {
      under.push({ title: `${volume.label[0].toUpperCase()}${volume.label.slice(1)} are down`, text: `${volume.label[0].toUpperCase()}${volume.label.slice(1)} last five: ${f1(volume.recent)} a game, against ${f1(volume.season)} over the log.` });
    }
  }

  // ---- the opponent --------------------------------------------------------
  if (def && def.rank && def.of && oppAbbr) {
    const where = `${oppAbbr} ranks #${def.rank} of ${def.of} in ${def.scope}${def.season ? ` (${def.season})` : ""}`;
    if (def.rank > def.of - SOFT_FROM_BOTTOM) over.push({ title: "Soft matchup", text: `${where}, one of the softest in the league.` });
    else if (def.rank <= SOFT_FROM_BOTTOM) under.push({ title: "Tough matchup", text: `${where}, one of the toughest in the league.` });
  }

  // ---- this opponent, from his own log -------------------------------------
  const vs = oppAbbr ? series.filter((g) => g.opp === oppAbbr) : [];
  if (vs.length >= 3) {
    const kv = vs.filter((g) => hit(g.v)).length;
    if (kv / vs.length >= 0.75) over.push({ title: `Has done it against ${oppAbbr}`, text: `Over ${line} in ${kv} of ${vs.length} games against ${oppAbbr}.` });
    else if (kv / vs.length <= 0.25) under.push({ title: `Has not done it against ${oppAbbr}`, text: `Over ${line} in ${kv} of ${vs.length} games against ${oppAbbr}.` });
  }

  // ---- tonight's venue -----------------------------------------------------
  if (homeTonight === true || homeTonight === false) {
    const here = series.filter((g) => g.home === homeTonight);
    const there = series.filter((g) => g.home !== homeTonight);
    if (here.length >= MIN_GAMES && there.length >= MIN_GAMES) {
      const rh = here.filter((g) => hit(g.v)).length / here.length;
      const rt = there.filter((g) => hit(g.v)).length / there.length;
      const word = homeTonight ? "at home" : "on the road";
      if (rh - rt >= 0.2) over.push({ title: `Better ${word}`, text: `Over ${line} in ${pctOf(here.filter((g) => hit(g.v)).length, here.length)}% of his games ${word} (${here.length}), against ${pctOf(there.filter((g) => hit(g.v)).length, there.length)}% elsewhere.` });
      else if (rt - rh >= 0.2) under.push({ title: `Worse ${word}`, text: `Over ${line} in ${pctOf(here.filter((g) => hit(g.v)).length, here.length)}% of his games ${word} (${here.length}), against ${pctOf(there.filter((g) => hit(g.v)).length, there.length)}% elsewhere.` });
    }
  }

  // ---- worth checking: counted as present, direction not counted ----------
  if (outs.length) {
    const names = outs.slice(0, 3).map((o) => o.name);
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    check.push({ title: "Teammates listed out", text: `${list} ${plural(names.length, "is", "are")} on the injury report. Nothing here counts what that does to this line, so check his games without them.` });
  }

  return { over, under, check, n, thin: null };
}
