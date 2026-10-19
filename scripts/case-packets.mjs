// Builds real sample packets for The Case from ESPN's public data, so the
// writer can be tested on numbers that are not made up.
//
//   node scripts/case-packets.mjs packets.json
//
// Six opening-night players (2026-10-20), their 2025-26 logs, the real
// opponent, and ESPN's own injury list. Uses the same buildPropFacts the app
// does, so a packet here is what the page would send.
import { writeFileSync } from "node:fs";
import { buildPropFacts } from "../src/lib/propFacts.js";

const TEAMS = { BOS: 2, DET: 8, PHI: 20, NY: 18, OKC: 25, SA: 24 };
const PLAYERS = [
  { name: "Jayson Tatum", team: "BOS", opp: "DET", home: false, markets: ["pts"] },
  { name: "Cade Cunningham", team: "DET", opp: "BOS", home: true, markets: ["pts"] },
  { name: "Tyrese Maxey", team: "PHI", opp: "NY", home: false, markets: ["pts", "ast"] },
  { name: "Jalen Brunson", team: "NY", opp: "PHI", home: true, markets: ["pts"] },
  { name: "Shai Gilgeous-Alexander", team: "OKC", opp: "SA", home: false, markets: ["pts"] },
  { name: "Victor Wembanyama", team: "SA", opp: "OKC", home: true, markets: ["reb", "pts"] },
];
const MARKETS = {
  pts: { label: "Points", unit: "points", get: (s) => s.points },
  reb: { label: "Rebounds", unit: "rebounds", get: (s) => s.totalRebounds },
  ast: { label: "Assists", unit: "assists", get: (s) => s.assists },
};
const ABBR = { GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS" };
const fix = (a) => ABBR[a] || a;

const j = (u) => fetch(u).then((r) => r.json());

async function standings() {
  const d = await j("https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=2026");
  const rows = d.children.flatMap((c) => c.standings.entries).map((e) => ({
    abbr: fix(e.team.abbreviation),
    pa: e.stats.find((s) => s.name === "avgPointsAgainst").value,
  })).sort((a, b) => a.pa - b.pa);
  const m = {};
  rows.forEach((r, i) => { m[r.abbr] = i + 1; });
  return m;
}

async function log(id) {
  const d = await j(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/gamelog?season=2026`);
  const games = [];
  for (const st of d.seasonTypes || []) {
    if (/preseason/i.test(st.displayName)) continue;
    for (const cat of st.categories || []) {
      for (const ev of cat.events || []) {
        const meta = d.events[ev.eventId];
        if (!meta) continue;
        const s = {};
        ev.stats.forEach((v, i) => { s[d.names[i]] = v; });
        games.push({
          date: meta.gameDate, home: meta.atVs !== "@", opp: fix(meta.opponent.abbreviation),
          minutes: parseFloat(s.minutes) || 0, points: parseFloat(s.points) || 0,
          totalRebounds: parseFloat(s.totalRebounds) || 0, assists: parseFloat(s.assists) || 0,
        });
      }
    }
  }
  return games.sort((a, b) => a.date.localeCompare(b.date));
}

const mean = (xs) => xs.reduce((a, v) => a + v, 0) / xs.length;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const rank = await standings();
const out = [];
for (const p of PLAYERS) {
  const roster = await j(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${TEAMS[p.team]}/roster`);
  const me = roster.athletes.find((a) => a.fullName === p.name);
  if (!me) { console.error("not on roster:", p.name); continue; }
  const games = await log(me.id);
  const outs = roster.athletes
    .filter((a) => a.id !== me.id && (a.injuries || []).some((i) => i.status === "Out"))
    .map((a) => ({ name: a.fullName }));
  for (const mk of p.markets) {
    const M = MARKETS[mk];
    const series = games.map((g) => ({ v: M.get(g), home: g.home, opp: g.opp, minutes: g.minutes }));
    const line = Math.floor(median(series.map((g) => g.v))) + 0.5;
    const volume = games.length >= 10
      ? { label: "minutes", recent: mean(games.slice(-5).map((g) => g.minutes)), season: mean(games.map((g) => g.minutes)), rise: 0.08 }
      : null;
    const def = mk === "pts" && rank[fix(p.opp)]
      ? { rank: rank[fix(p.opp)], of: 30, season: "2025-26", scope: "points allowed" }
      : null;
    const base = { meta: { sport: "nba", player: p.name, team: p.team, market: M.label } };
    const args = { line, unit: M.unit, def, oppAbbr: fix(p.opp), outs, homeTonight: p.home, volume };
    out.push({ ...base, label: `${p.name} ${M.label}`, facts: buildPropFacts({ series, ...args }) });
    if (p.name === "Tyrese Maxey" && mk === "pts") {
      out.push({ ...base, label: `${p.name} ${M.label} (thin: last 6 games only)`, facts: buildPropFacts({ series: series.slice(-6), ...args, volume: null }) });
    }
  }
}
writeFileSync(process.argv[2] || "packets.json", JSON.stringify(out, null, 1));
console.log(`wrote ${out.length} packets`);
