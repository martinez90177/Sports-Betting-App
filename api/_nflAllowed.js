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

// One finished game's offensive lines, positions not yet attached.
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
  return [...byId.values()];
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
