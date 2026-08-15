// Runs the nightly cron's ranking against the live MLB Stats API without
// deploying it, and prints the payload the badge will read.
//
// `node scripts/check-mlb-def.mjs`            -- summary + sanity checks
// `node scripts/check-mlb-def.mjs --json`     -- the raw byTeam payload,
//    which can be pasted into sessionStorage under mlb_team_def_cache_v1 to
//    exercise the badge locally, where /api/mlb-matchups does not exist.
import { buildMlbTeamDef } from "../api/refresh-mlb-matchups.js";

const season = Number(process.argv.find((a) => /^\d{4}$/.test(a))) || new Date().getFullYear();

const get = async (group) => {
  const r = await fetch(
    `https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=${group}&season=${season}&sportId=1`
  );
  if (!r.ok) throw new Error(`${group}: HTTP ${r.status}`);
  return (await r.json())?.stats?.[0]?.splits || [];
};

const [pitching, hitting] = await Promise.all([get("pitching"), get("hitting")]);
const { byTeam, teams } = buildMlbTeamDef(pitching, hitting);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ date: new Date().toISOString().slice(0, 10), byTeam }));
  process.exit(0);
}

const ids = [...new Set(Object.values(byTeam).flatMap((t) => Object.keys(t.markets)))];
console.log(`season ${season} · ${teams} teams · ${ids.length} markets: ${ids.join(" ")}\n`);

// Every market must rank all 30 teams exactly once, or some team silently
// loses its badge for that market.
let bad = 0;
for (const id of ids) {
  const ranks = Object.values(byTeam).map((t) => t.markets[id]?.rank).filter((r) => r != null);
  const ok = ranks.length === teams && new Set(ranks).size === teams
    && Math.min(...ranks) === 1 && Math.max(...ranks) === teams;
  if (!ok) { console.log(`  FAIL ${id}: ${ranks.length} ranked, ${new Set(ranks).size} distinct`); bad++; }
}
console.log(bad ? `${bad} market(s) failed` : `all ${ids.length} markets rank 1..${teams} with no gaps or ties`);

// The point of the change: how far the per-market rank moves from the ERA
// rank the badge used to print against every market.
console.log("\nranks vs the old ERA-only badge:");
for (const id of ids) {
  const d = Object.values(byTeam)
    .filter((t) => t.markets[id])
    .map((t) => Math.abs(t.rank - t.markets[id].rank));
  const mean = (d.reduce((a, b) => a + b, 0) / d.length).toFixed(1);
  const label = Object.values(byTeam).find((t) => t.markets[id])?.markets[id].label;
  console.log(`  ${id.padEnd(6)} mean ${String(mean).padStart(4)}  max ${String(Math.max(...d)).padStart(2)}   ${label}`);
}
