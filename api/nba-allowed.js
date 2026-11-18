import { Redis } from "@upstash/redis";

// GET /api/nba-allowed
//   -> { season, builtAt, games, partial, teams: { ABBR: { games, G|F|C|ALL: { market: { avg, rank } } } } }
//
// What each NBA defense has allowed this regular season, per game, to guards,
// forwards and centres, market by market -- counted from every finished game's
// box score. Rank 1 is the toughest (least allowed), 30 the softest, the same
// way round as every rank badge in the app.
//
// ---- Caching ----
// A finished game's box score never changes, so each is stored once, forever
// (`nba-box:v1:<id>`). A past day's game list is stored once every game on it
// is final (`nba-day:v1:<yyyymmdd>`). The response is cached at Vercel's edge
// for 30 minutes. Without Redis (local development) the same layers live in
// this instance's memory. A cold build that runs out of time answers with
// what it has, marked partial and uncached, and the next request carries on.

const SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const CORE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba";
const FETCH_BUDGET_MS = 40 * 1000;

const ESPN_TO_OURS = { GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS" };
const ours = (a) => (a ? ESPN_TO_OURS[a] || a : a);

// The app's NBA markets, each as a sum of box-score columns.
// Line layout: [min, pts, reb, ast, stl, blk, fg3m]
const MARKETS = {
  pts: (l) => l[1], reb: (l) => l[2], ast: (l) => l[3], stl: (l) => l[4], blk: (l) => l[5],
  "3pm": (l) => l[6],
  stk: (l) => l[4] + l[5],
  pra: (l) => l[1] + l[2] + l[3],
  pr: (l) => l[1] + l[2],
  pa: (l) => l[1] + l[3],
  ra: (l) => l[2] + l[3],
};
const GROUPS = ["G", "F", "C", "ALL"];

const memory = new Map();
function store() {
  const url = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
  if (url && token) {
    const redis = new Redis({ url, token });
    return {
      get: (k) => redis.get(k).catch(() => null),
      mget: (ks) => (ks.length ? redis.mget(...ks).catch(() => ks.map(() => null)) : Promise.resolve([])),
      set: (k, v) => redis.set(k, v).catch(() => null),
    };
  }
  return {
    get: async (k) => memory.get(k) ?? null,
    mget: async (ks) => ks.map((k) => memory.get(k) ?? null),
    set: async (k, v) => { memory.set(k, v); },
  };
}

async function getJson(url) {
  const res = await fetch(url, { headers: { "accept-encoding": "gzip" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// Eastern calendar day, as YYYYMMDD, offset by n days.
function etDay(offset = 0, from = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(from);
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  const d = new Date(Date.UTC(g("year"), g("month") - 1, g("day")));
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function posGroup(abbr) {
  const a = String(abbr || "").toUpperCase();
  if (a === "C" || a === "FC" || a === "C-F") return "C";
  if (a.startsWith("F") || a === "SF" || a === "PF") return "F";
  if (a.startsWith("G") || a === "PG" || a === "SG") return "G";
  return null;
}

// One box score, reduced to each team's player lines.
async function boxLines(id) {
  const j = await getJson(`${SITE}/summary?event=${id}`);
  const teams = {};
  (j.boxscore?.players || []).forEach((t) => {
    const abbr = ours(t.team?.abbreviation);
    const st = t.statistics && t.statistics[0];
    if (!abbr || !st) return;
    const keys = st.keys || [];
    const k = (name) => keys.indexOf(name);
    const iMin = k("minutes"), iPts = k("points"), iReb = k("rebounds"), iAst = k("assists"), iStl = k("steals"), iBlk = k("blocks");
    const i3 = k("threePointFieldGoalsMade-threePointFieldGoalsAttempted");
    teams[abbr] = (st.athletes || [])
      .filter((a) => !a.didNotPlay && Array.isArray(a.stats) && a.stats.length)
      .map((a) => {
        const n = (i) => { const v = Number(String(a.stats[i] ?? "").split("-")[0]); return Number.isFinite(v) ? v : 0; };
        return [posGroup(a.athlete?.position?.abbreviation), n(iMin), n(iPts), n(iReb), n(iAst), n(iStl), n(iBlk), n(i3)];
      })
      .filter((l) => l[1] > 0);
  });
  return teams;
}

export async function build(db = store()) {
  const started = Date.now();
  const now = new Date();
  const season = now.getUTCMonth() >= 7 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const info = await getJson(`${CORE}/seasons/${season}/types/2`);
  const start = new Date(info.startDate);
  const first = etDay(0, start);
  const yesterday = etDay(-1);

  // Every day from the opener to yesterday.
  const days = [];
  for (let d = first; d <= yesterday; ) {
    days.push(d);
    const dt = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)));
    dt.setUTCDate(dt.getUTCDate() + 1);
    d = dt.toISOString().slice(0, 10).replace(/-/g, "");
  }

  const lists = await pool(days, 8, async (day) => {
    const key = `nba-day:v1:${day}`;
    const hit = await db.get(key);
    if (hit) return hit;
    try {
      const sb = await getJson(`${SITE}/scoreboard?dates=${day}`);
      const evs = (sb.events || []).filter((e) => e.season?.type === 2);
      const games = evs.filter((e) => e.status?.type?.completed).map((e) => {
        const c = e.competitions[0];
        return { id: e.id, t: c.competitors.map((x) => ours(x.team?.abbreviation)) };
      });
      if (evs.length && games.length === evs.length) await db.set(key, games);
      return games;
    } catch {
      return [];
    }
  });
  const games = lists.flat();

  const keys = games.map((g) => `nba-box:v1:${g.id}`);
  const stored = await db.mget(keys);
  const boxes = await pool(games, 8, async (g, i) => {
    if (stored[i]) return stored[i];
    if (Date.now() - started > FETCH_BUDGET_MS) return null;
    try {
      const b = await boxLines(g.id);
      if (Object.keys(b).length === 2) await db.set(keys[i], b);
      return b;
    } catch {
      return null;
    }
  });

  // Sum what each defense allowed, per game, by position group.
  const acc = {}; // acc[D] = { games, G: {market: sum}, ... }
  games.forEach((g, i) => {
    const b = boxes[i];
    if (!b) return;
    const [a, h] = g.t;
    [[a, h], [h, a]].forEach(([def, off]) => {
      const lines = b[off];
      if (!def || !lines) return;
      const A = (acc[def] = acc[def] || { games: 0, sums: {} });
      A.games += 1;
      lines.forEach((l) => {
        const groups = l[0] ? [l[0], "ALL"] : ["ALL"];
        const stats = l.slice(1); // [min, pts, reb, ast, stl, blk, fg3m]
        groups.forEach((grp) => {
          const S = (A.sums[grp] = A.sums[grp] || {});
          Object.entries(MARKETS).forEach(([m, f]) => { S[m] = (S[m] || 0) + f(stats); });
        });
      });
    });
  });

  const teams = {};
  Object.entries(acc).forEach(([abbr, A]) => {
    teams[abbr] = { games: A.games };
    GROUPS.forEach((grp) => {
      teams[abbr][grp] = {};
      Object.keys(MARKETS).forEach((m) => {
        const s = A.sums[grp] ? A.sums[grp][m] || 0 : 0;
        teams[abbr][grp][m] = { avg: Math.round((s / Math.max(1, A.games)) * 10) / 10 };
      });
    });
  });
  // Rank 1 = least allowed (toughest).
  GROUPS.forEach((grp) => {
    Object.keys(MARKETS).forEach((m) => {
      const order = Object.keys(teams).sort((x, y) => teams[x][grp][m].avg - teams[y][grp][m].avg);
      order.forEach((abbr, i) => { teams[abbr][grp][m].rank = i + 1; });
    });
  });

  const missing = boxes.filter((b) => !b).length;
  return {
    season,
    builtAt: Date.now(),
    games: games.length,
    missingBox: missing,
    partial: missing > 0 && Date.now() - started > FETCH_BUDGET_MS,
    of: Object.keys(teams).length,
    teams,
  };
}

export default async function handler(req, res) {
  try {
    const data = await build();
    res.setHeader("Cache-Control", data.partial ? "no-store" : "public, s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json(data);
  } catch (err) {
    res.status(200).json({ season: null, builtAt: null, games: 0, teams: {}, error: String(err) });
  }
}
