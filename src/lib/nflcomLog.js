import { NFL_TEAMS_BY_ABBR } from "./gamesData.js";

// --------------------------------------------------------------------------
// NFL.com game logs — the fallback for players ESPN has no log for
// --------------------------------------------------------------------------
// ESPN's gamelog endpoint is the app's NFL source and answers for 246 of the
// 256 hand-written players. For a handful it returns nothing at all: Davante
// Adams is on the Rams' current ESPN roster under id 16800, his gamelog lists
// seasons 2014–2025 in its own filter block, and every one of them comes back
// with zero events. The core API agrees — his season eventlog is an empty stub
// where a team-mate's carries 17.
//
// Alex checked and NFL.com has the season. It does: 18 regular-season rows and
// 3 postseason, with receptions, yards, longest and touchdowns per game.
//
// This is a fallback, not a replacement. ESPN's JSON is structured, carries
// targets and an event id, and works for everyone else; NFL.com is HTML, has
// no targets column and no event id. So it runs only when ESPN has answered
// with nothing.
//
// ---- Why this is fetchable at all ----
//
// www.nfl.com serves `access-control-allow-origin: *`, so the browser can read
// the page directly and no proxy is needed. Verified against the live host.
//
// ---- What it cannot supply, and does not fake ----
//
//   targets   not a column on this table. Left `null`, never 0 — `usagePills`
//             filters on Number.isFinite, so the Targets/g pill simply does
//             not render rather than reading "0.0".
//   eventId   not on the page. The With/Without teammate filter needs one to
//             look up who else played, so it stays unavailable for these
//             players and says so.
//   team      the row does not name the player's own side, and inferring it
//             from today's roster would be a claim about a player who may have
//             been traded mid-season. Left undefined, which is exactly what
//             `logScopeOptions` reads as "no team control to offer".

const NICKNAME_TO_ABBR = (() => {
  const m = {};
  Object.entries(NFL_TEAMS_BY_ABBR).forEach(([abbr, t]) => {
    if (t && t.name) m[t.name.toLowerCase()] = abbr;
  });
  return m;
})();

// "Davante Adams" -> "davante-adams". NFL.com's own slug form.
export function nflComSlug(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[.']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// The stat groups, keyed by the header sequence that opens them. Longest match
// wins, so passing's nine columns are consumed before its second column ("ATT")
// can be mistaken for the start of the rushing group.
//
// `null` in a group means a column this app does not carry (AVG, SCK, RATE,
// fumbles). It is skipped, not stored as anything.
const GROUPS = [
  { head: ["COMP", "ATT", "YDS", "AVG", "TD", "INT", "SCK", "SCKY", "RATE"],
    keys: ["comp", "att", "passYds", null, "passTd", "int", null, null, null] },
  { head: ["REC", "YDS", "AVG", "LNG", "TD"],
    keys: ["rec", "recYds", null, "long", "recTd"] },
  { head: ["ATT", "YDS", "AVG", "LNG", "TD"],
    keys: ["rushAtt", "rushYds", null, null, "rushTd"] },
  // A quarterback's rushing group has no LNG column.
  { head: ["ATT", "YDS", "AVG", "TD"],
    keys: ["rushAtt", "rushYds", null, "rushTd"] },
  { head: ["FG ATT", "FGM", "PCT"],
    keys: ["fga", "fgm", null] },
  { head: ["XP Att", "XPM", "Pct"],
    keys: ["xpa", "xpm", null] },
  { head: ["FUM", "LOST"], keys: [null, null] },
];

// header row -> { columnIndex: ourKey }. Anything unrecognised is skipped
// rather than guessed at, so a layout change drops a stat instead of
// misreading one into the wrong field.
function mapColumns(headers) {
  const out = {};
  let i = 4; // WK, Game Date, OPP, RESULT
  while (i < headers.length) {
    const g = GROUPS.find((grp) => grp.head.every((h, k) => (headers[i + k] || "").toLowerCase() === h.toLowerCase()));
    if (!g) { i += 1; continue; }
    g.keys.forEach((key, k) => { if (key) out[i + k] = key; });
    i += g.head.length;
  }
  return out;
}

const num = (v) => {
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// "12/14/2025" -> "2025-12-14"
function isoDate(us) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(us || "").trim());
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

function cells(rowHtml) {
  return [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
    .map((c) => c[1].replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim());
}

// The page carries three tables in this order, each under its own heading.
// Reading them positionally is what makes the season type certain rather than
// inferred from the month.
const SEASON_TYPES = ["pre", "regular", "post"];

export function parseNFLComLogs(html, season) {
  const tables = [...String(html).matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => m[0]);
  if (!tables.length) return null;

  const games = [];
  tables.forEach((table, ti) => {
    const seasonType = SEASON_TYPES[ti] || "regular";
    // Preseason is dropped here for the same reason parseNFLGameLogResponse
    // drops it: it is not the competition any of these props are priced on.
    if (seasonType === "pre") return;

    const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => cells(m[1]));
    const header = rows.find((r) => r[0] === "WK");
    if (!header) return;
    const cols = mapColumns(header);

    rows.forEach((r) => {
      if (r === header) return;
      const date = isoDate(r[1]);
      if (!date || !/^\d+$/.test(r[0] || "")) return;

      // A row with no figure anywhere is a game this player recorded no line
      // in. NFL.com renders those cells blank, not zero, and this app's
      // standing rule is that a blank is not a zero — so the game is left out
      // rather than counted as a nought.
      const statCells = Object.keys(cols).map((k) => r[Number(k)]);
      if (!statCells.some((v) => v !== "" && v != null)) return;

      const oppRaw = (r[2] || "").trim();
      const home = !oppRaw.startsWith("@");
      const nickname = oppRaw.replace(/^@/, "").trim().toLowerCase();
      const opp = NICKNAME_TO_ABBR[nickname];
      // An opponent this app has no abbreviation for would break every
      // downstream lookup (defence rank, crest, H2H). Dropped, as the ESPN
      // parser drops its own unknown opponents.
      if (!opp) return;

      const game = {
        date, opp, home, seasonType, season,
        // Not on the page. See the note at the top of this file.
        team: undefined,
        eventId: undefined,
        tgt: null,
        source: "nfl.com",
      };
      Object.entries(cols).forEach(([idx, key]) => {
        const raw = r[Number(idx)];
        if (raw === "" || raw == null) return;
        game[key] = num(raw);
      });
      games.push(game);
    });
  });

  if (!games.length) return null;
  return games.sort((a, b) => a.date.localeCompare(b.date));
}

// A finished season's logs do not change, so this is cached with no TTL, the
// same shape every other immutable fetch in this app uses. A failure is not
// cached: the next visit retries rather than inheriting a network blip.
const memory = new Map();

export async function fetchNFLComGameLog(name, season) {
  const slug = nflComSlug(name);
  if (!slug || !season) return null;
  const key = `${slug}:${season}`;
  if (memory.has(key)) return memory.get(key);

  const cacheKey = `pp_nflcom_v1_${key}`;
  try {
    const stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      memory.set(key, parsed);
      return parsed;
    }
  } catch {}

  let games = null;
  try {
    const res = await fetch(`https://www.nfl.com/players/${slug}/stats/logs/${season}/`);
    if (res.ok) games = parseNFLComLogs(await res.text(), season);
  } catch {
    return null;
  }

  if (games) {
    memory.set(key, games);
    try { sessionStorage.setItem(cacheKey, JSON.stringify(games)); } catch {}
  }
  return games;
}
