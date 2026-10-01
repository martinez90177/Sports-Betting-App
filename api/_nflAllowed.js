// What every NFL defense has actually allowed, player by player, game by game
// -- read off ESPN's box scores for this season's finished games.
//
// The Mismatches page used to grade a tight end on his opponent's *team* pass
// defense, because ESPN's team statistics only split by pass/rush. That made
// every pass-catcher on a team read identically (Carolina's four receivers and
// its quarterback all scored 100 in Week 4) and could not see that a defense
// is soft against tight ends and stingy against wideouts. The box score can:
// every catch, target and carry is there under the player who made it.
// Summing those by the position of the player who made them is a measured
// "allowed to TEs" number, not a modelled one.
//
// ---- Shape ----
//
// { season, builtAt, weeks, games: [{ id, wk, d, h, a, L: [line] }], unknownPos }
//
//   line = { id, n, t, pos, p?: [cmp, att, yds, td, int],
//                          r?: [car, yds, td, long],
//                          c?: [rec, yds, td, long, tgt] }
//
// Team abbreviations are ESPN's own (WSH, not WAS); the client maps them.
// Only players with a passing, rushing or receiving line are kept -- the
// defensive and kicking tables are not what any prop here is graded on.
//
// ---- Position ----
//
// The box score carries no position. It comes from the 32 current rosters,
// and for anyone no longer on one (cut, retired, on a practice squad) from
// ESPN's athlete record. A player whose position still cannot be read keeps
// his line with pos "" and is counted in `unknownPos` -- never dropped, never
// guessed.
//
// ---- Cost ----
//
// A finished game's box score never changes, so each one is fetched once and
// kept. A rebuild only fetches games that finished since the last one: at most
// sixteen a week.

const SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const ATHLETE = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes";

export const TEAM_IDS = {
  ARI: "22", ATL: "1", BAL: "33", BUF: "2", CAR: "29", CHI: "3", CIN: "4",
  CLE: "5", DAL: "6", DEN: "7", DET: "8", GB: "9", HOU: "34", IND: "11",
  JAX: "30", KC: "12", LAC: "24", LAR: "14", LV: "13", MIA: "15",
  MIN: "16", NE: "17", NO: "18", NYG: "19", NYJ: "20", PHI: "21",
  PIT: "23", SEA: "26", SF: "25", TB: "27", TEN: "10", WSH: "28",
};

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.json();
}

const num = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// Which regular-season weeks have been played, from ESPN's current scoreboard.
// Before this season's Week 1 there is nothing to read and the answer is 0.
export async function playedWeeks(season) {
  const cur = await getJSON(`${SITE}/scoreboard`);
  const year = Number(cur?.season?.year);
  const type = Number(cur?.season?.type);
  const week = Number(cur?.week?.number) || 0;
  if (year > season) return 18;
  if (year < season || type === 1) return 0;
  if (type === 3) return 18;
  return week;
}

// Finished games of one week: [{ id, wk, d, h, a }].
export async function finishedGames(season, wk) {
  const sb = await getJSON(`${SITE}/scoreboard?dates=${season}&seasontype=2&week=${wk}`);
  return (sb.events || [])
    .filter((e) => e?.status?.type?.completed)
    .map((e) => {
      const comp = e.competitions?.[0];
      const side = (s) => comp?.competitors?.find((c) => c.homeAway === s)?.team?.abbreviation || "";
      return { id: String(e.id), wk, d: e.date, h: side("home"), a: side("away") };
    });
}

// ---- Red zone ----
//
// The box score has no field position, so red-zone work comes from the
// play-by-play: every rush and every target that started at the opponent's
// 20 or closer (5 or closer is "goal line"). ESPN's plays carry no player
// ids, only text -- "J.Love pass short middle to C.Watson", "Bi.Robinson up
// the middle" -- so the player is read out of the text and matched to the
// game's own box score, which lists everyone who carried or was targeted
// (a target with no catch included). A play whose player can't be matched
// to exactly one name is still counted in the team's red-zone total and in
// `unmatched`, never assigned to a guess.

export const RZ_LINE = 20;
export const GL_LINE = 5;
const SUFFIX = /^(jr|sr|ii|iii|iv|v)$/;
const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z]/g, "");

function splitName(full) {
  const parts = String(full || "").split(/\s+/).filter(Boolean);
  while (parts.length > 2 && SUFFIX.test(norm(parts[parts.length - 1]))) parts.pop();
  return { first: norm(parts[0]), last: norm(parts.slice(1).join("")) };
}

// "Bi.Robinson" -> the one player on this team whose first name starts "Bi"
// and whose last name is (or starts with) "Robinson". Null when none or more
// than one fit.
export function matchAbbrev(abbr, candidates) {
  const m = /^([A-Za-z']+)\.\s?(.+)$/.exec(String(abbr || "").trim());
  if (!m) return null;
  const pre = norm(m[1]);
  const last = norm(m[2]);
  if (!pre || !last) return null;
  const fits = (exact) => candidates.filter((c) => {
    const n = splitName(c.n);
    return n.first.startsWith(pre) && (exact ? n.last === last : n.last.startsWith(last));
  });
  const exact = fits(true);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) return null;
  const loose = fits(false);
  if (loose.length === 1) return loose[0].id;
  if (loose.length > 1) return null;
  // The play text abbreviates the legal first name; the box score can carry
  // the one he goes by -- "M.Brown" is Hollywood Brown, "Z.Knight" is Bam
  // Knight. With no first-name fit at all, the surname decides, and only if
  // exactly one player on this team in this game has it.
  const bySurname = candidates.filter((c) => splitName(c.n).last === last);
  return bySurname.length === 1 ? bySurname[0].id : null;
}

// One abbreviated name: initial(s), a dot, the surname. A two-word surname
// ("A.St. Brown") is read as its first word and matched as a prefix.
const NAME = "([A-Z][A-Za-z']*\\.\\s?[A-Z][A-Za-z'\\-]*)";
const PASS_TARGET = new RegExp(`\\bpass\\b.*?\\b(?:to|intended for)\\s+${NAME}`);
const LEADING = new RegExp(`^${NAME}`);

// Strip what ESPN prefixes a play with: formation notes in parentheses and
// "X reported in as eligible." sentences.
function playBody(text) {
  let t = String(text || "").trim();
  for (let i = 0; i < 4; i++) {
    const before = t;
    t = t.replace(/^\([^)]*\)\s*/, "")
      .replace(/^.*?reported in as eligible\.\s*/i, "")
      .replace(/^Direct snap to [A-Z][A-Za-z']*\.\s?[A-Z][A-Za-z'-]*\.\s*/, "")
      .trim();
    if (t === before) break;
  }
  return t;
}

// { kind: "rush" | "target", name } or null for anything that isn't a real
// offensive snap with a ball-carrier or target (sacks, kneels, spikes,
// penalties that wiped the play out).
//
// A pass with no receiver named (a throwaway) targeted nobody and is not
// counted; nor is a spike, or a sack ESPN filed as an incompletion. Some
// scoring plays are written as a summary line in full names ("Dontayvion
// Wicks 9 Yd pass from Jalen Hurts"), flagged `full` so they are matched on
// the whole name.
export function readPlay(play) {
  const type = String(play?.type?.text || "");
  const text = playBody(play?.text);
  if (/no play/i.test(text) || /\bkneels\b|\bspiked?\b|\bsacked\b/i.test(text)) return null;
  const pass = /^(Pass Reception|Pass Incompletion|Passing Touchdown|Pass Interception Return)$/.test(type);
  const rush = /^(Rush|Rushing Touchdown)$/.test(type);
  if (pass) {
    const full = /^(.+?) \d+ Yd pass from /i.exec(text);
    if (full) return { kind: "target", name: full[1].trim(), full: true };
    const m = PASS_TARGET.exec(text);
    return m ? { kind: "target", name: m[1].trim() } : null;
  }
  if (rush) {
    const full = /^(.+?) \d+ Yd (?:Run|Rush)\b/i.exec(text);
    if (full) return { kind: "rush", name: full[1].trim(), full: true };
    const m = LEADING.exec(text);
    return { kind: "rush", name: m ? m[1].trim() : null };
  }
  return null;
}

export function matchPlayer(read, candidates) {
  if (!read.name) return null;
  if (!read.full) return matchAbbrev(read.name, candidates);
  // Whole-name match with suffixes dropped on both sides ("Deebo Samuel" is
  // "Deebo Samuel Sr." in the box score).
  const want = splitName(read.name);
  const hits = candidates.filter((c) => { const n = splitName(c.n); return n.first === want.first && n.last === want.last; });
  return hits.length === 1 ? hits[0].id : null;
}

// Entries in a drive that are not a snap: stoppages, period ends, kicks.
const ADMIN_PLAY = /timeout|end period|end of|two-minute|kickoff|punt|extra point|two-point/i;

// Red-zone counts for one game, from the summary's drives.
//   byPlayer: id -> [rzCarries, rzTargets, glCarries, glTargets]
//   byTeam:   abbr -> [rzCarries, rzTargets, glCarries, glTargets, trips, unmatched]
// A trip is a drive with at least one snap from the 20 in.
export function redZone(summary, lines) {
  const byPlayer = {};
  const byTeam = {};
  (summary?.drives?.previous || []).forEach((drive) => {
    const team = drive?.team?.abbreviation;
    if (!team) return;
    const cands = lines.filter((l) => l.t === team);
    let inside = false;
    const T = (byTeam[team] = byTeam[team] || [0, 0, 0, 0, 0, 0]);
    (drive.plays || []).forEach((p) => {
      const ytg = Number(p?.start?.yardsToEndzone);
      if (!Number.isFinite(ytg) || ytg <= 0 || ytg > RZ_LINE) return;
      // Any real snap from the 20 in makes the drive a trip -- a sack or a
      // field-goal try included -- not only the plays credited to a player.
      if (!ADMIN_PLAY.test(String(p?.type?.text || ""))) inside = true;
      const read = readPlay(p);
      if (!read) return;
      const k = read.kind === "rush" ? 0 : 1;
      T[k] += 1;
      if (ytg <= GL_LINE) T[k + 2] += 1;
      const id = matchPlayer(read, cands);
      if (!id) { T[5] += 1; return; }
      const P = (byPlayer[id] = byPlayer[id] || [0, 0, 0, 0]);
      P[k] += 1;
      if (ytg <= GL_LINE) P[k + 2] += 1;
    });
    if (inside) T[4] += 1;
  });
  return { byPlayer, byTeam };
}

// One finished game's offensive lines, positions not yet attached, with each
// player's red-zone counts (`z`) and the teams' (`Z`, on the returned array).
export async function boxLines(eventId) {
  const s = await getJSON(`${SITE}/summary?event=${eventId}`);
  const byId = new Map();
  const line = (athlete, team) => {
    const id = String(athlete?.id || "");
    if (!id) return null;
    if (!byId.has(id)) byId.set(id, { id, n: athlete.displayName || "", t: team });
    return byId.get(id);
  };
  (s?.boxscore?.players || []).forEach((tm) => {
    const team = tm?.team?.abbreviation || "";
    (tm.statistics || []).forEach((grp) => {
      const at = (label) => (grp.labels || []).indexOf(label);
      (grp.athletes || []).forEach((a) => {
        const st = a.stats || [];
        const v = (label) => { const i = at(label); return i < 0 ? 0 : num(st[i]); };
        if (grp.name === "passing") {
          const L = line(a.athlete, team); if (!L) return;
          const [cmp, att] = String(st[at("C/ATT")] || "0/0").split("/").map(num);
          L.p = [cmp, att, v("YDS"), v("TD"), v("INT")];
        } else if (grp.name === "rushing") {
          const L = line(a.athlete, team); if (!L) return;
          L.r = [v("CAR"), v("YDS"), v("TD"), v("LONG")];
        } else if (grp.name === "receiving") {
          const L = line(a.athlete, team); if (!L) return;
          L.c = [v("REC"), v("YDS"), v("TD"), v("LONG"), v("TGTS")];
        }
      });
    });
  });
  const L = [...byId.values()];
  const rz = redZone(s, L);
  L.forEach((l) => { if (rz.byPlayer[l.id]) l.z = rz.byPlayer[l.id]; });
  return { L, Z: rz.byTeam };
}

// espnId -> position abbreviation, from the 32 current rosters.
export async function rosterPositions() {
  const out = {};
  await Promise.all(Object.values(TEAM_IDS).map(async (tid) => {
    try {
      const json = await getJSON(`${SITE}/teams/${tid}/roster`);
      (json.athletes || []).flatMap((g) => g.items || []).forEach((a) => {
        const pos = a?.position?.abbreviation;
        if (a?.id && pos) out[String(a.id)] = pos;
      });
    } catch {
      // A roster that doesn't answer leaves its players to the athlete lookup.
    }
  }));
  return out;
}

export async function athletePosition(id) {
  try {
    const json = await getJSON(`${ATHLETE}/${id}`);
    return json?.athlete?.position?.abbreviation || "";
  } catch {
    return "";
  }
}

// Runs `fn` over `items` with at most `n` in flight.
export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}
