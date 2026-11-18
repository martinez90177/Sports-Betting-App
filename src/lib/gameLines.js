// Game lines -- moneyline, spread and total -- and each team's record against
// them.
//
// Source: ESPN's own feed, which carries DraftKings' numbers. Tonight's lines
// come off the scoreboard (opening and current); a finished game's closing
// line comes off ESPN's per-event odds record. Both are real book numbers, so
// nothing here is estimated: a game with no line on record is left out of the
// counts and the count says how many games it is over.
//
// Records are counted from the team's side:
//   ATS     final margin + the team's closing spread: above 0 covers, 0 pushes.
//   O/U     both teams' points against the closing total.
//   ML      straight-up wins, split by whether the team closed favourite.

const ESPN_PATH = { nba: "basketball/nba", nfl: "football/nfl", wnba: "basketball/wnba" };
const CORE_PATH = { nba: "basketball/leagues/nba", nfl: "football/leagues/nfl", wnba: "basketball/leagues/wnba" };

// App abbreviation -> ESPN's, for the team-schedule path. The inverse of the
// maps in gamesData.js.
const TO_ESPN = {
  nba: { GSW: "GS", NOP: "NO", NYK: "NY", SAS: "SA", UTA: "UTAH", WAS: "WSH" },
  nfl: { WAS: "WSH" },
  wnba: {},
};
const FROM_ESPN = {
  nba: { GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS" },
  nfl: { WSH: "WAS" },
  wnba: {},
};
const ours = (sport, a) => (a ? (FROM_ESPN[sport] || {})[a] || a : a);

const num = (v) => {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (/^pk$/i.test(s)) return 0;
  const n = Number(s.replace(/^[ou]/i, "").replace(/^EVEN$/i, "100"));
  return Number.isFinite(n) ? n : null;
};

// The season a date belongs to, in ESPN's numbering. NBA seasons are named
// for the year they end in; the NFL's for the year they start in.
export function linesSeason(sport, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (sport === "nba") return m >= 7 ? y + 1 : y;
  if (sport === "nfl") return m >= 2 ? y : y - 1;
  return y;
}

// ---- tonight's lines, off a scoreboard competition --------------------------

export function parseEspnOdds(comp) {
  const o = comp && Array.isArray(comp.odds) ? comp.odds[0] : null;
  if (!o) return null;
  const ml = o.moneyline || {};
  const ps = o.pointSpread || {};
  const tt = o.total || {};
  const out = {
    book: o.provider?.name || "Sportsbook",
    ml: {
      home: num(ml.home?.close?.odds), away: num(ml.away?.close?.odds),
      homeOpen: num(ml.home?.open?.odds), awayOpen: num(ml.away?.open?.odds),
    },
    spread: {
      home: num(ps.home?.close?.line), away: num(ps.away?.close?.line),
      homeOdds: num(ps.home?.close?.odds), awayOdds: num(ps.away?.close?.odds),
      homeOpen: num(ps.home?.open?.line), awayOpen: num(ps.away?.open?.line),
    },
    total: {
      line: num(tt.over?.close?.line) ?? (Number.isFinite(o.overUnder) ? o.overUnder : null),
      overOdds: num(tt.over?.close?.odds), underOdds: num(tt.under?.close?.odds),
      open: num(tt.over?.open?.line),
    },
  };
  // A scoreboard row with a provider but no numbers is not a line.
  if (out.spread.home == null && Number.isFinite(o.spread)) {
    out.spread.home = o.spread;
    out.spread.away = -o.spread;
  }
  const any = out.ml.home != null || out.spread.home != null || out.total.line != null;
  return any ? out : null;
}

// ---- a team's finished games, with the closing line of each ----------------

const SCHED_TTL = 30 * 60 * 1000;
const NO_LINE_RETRY = 24 * 60 * 60 * 1000;
const memo = new Map();

function readLS(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}
function writeLS(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* quota: fine */ }
}

// One finished game's closing line. Cached for good once found -- a closing
// line never changes -- and a miss is retried after a day.
async function closingLine(sport, eventId) {
  const key = `gl:close:v1:${sport}:${eventId}`;
  const hit = readLS(key);
  if (hit && (hit.ok || Date.now() - hit.at < NO_LINE_RETRY)) return hit.ok ? hit : null;
  try {
    const res = await fetch(`https://sports.core.api.espn.com/v2/sports/${CORE_PATH[sport]}/events/${eventId}/competitions/${eventId}/odds`);
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const items = Array.isArray(j.items) ? j.items : [];
    // DraftKings when present, so every game is read off the same book.
    const o = items.find((x) => /draftkings/i.test(x?.provider?.name || "")) || items[0];
    const spreadHome = o && Number.isFinite(o.spread) ? o.spread : null;
    const rec = {
      ok: !!o && (spreadHome != null || Number.isFinite(o.overUnder)),
      at: Date.now(),
      book: o?.provider?.name || null,
      sh: spreadHome,
      tot: o && Number.isFinite(o.overUnder) ? o.overUnder : null,
      mlh: num(o?.homeTeamOdds?.moneyLine),
      mla: num(o?.awayTeamOdds?.moneyLine),
    };
    writeLS(key, rec);
    return rec.ok ? rec : null;
  } catch {
    return null;
  }
}

// A small pool so thirty requests go out six at a time.
async function pool(items, n, fn) {
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

// Every finished regular-season game this season for one team, oldest first,
// each with its closing line where one is on record.
export async function fetchTeamLineHistory(sport, abbr, { season = linesSeason(sport) } = {}) {
  if (!ESPN_PATH[sport] || !abbr) return null;
  const mk = `${sport}:${abbr}:${season}`;
  const m = memo.get(mk);
  if (m && Date.now() - m.at < SCHED_TTL) return m.value;
  const espn = (TO_ESPN[sport] || {})[abbr] || abbr;
  let events;
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams/${espn.toLowerCase()}/schedule?season=${season}&seasontype=2`);
    if (!res.ok) throw new Error(String(res.status));
    events = (await res.json()).events || [];
  } catch {
    return null;
  }
  const done = events
    .map((e) => {
      const c = e.competitions && e.competitions[0];
      if (!c || !c.status?.type?.completed) return null;
      const me = c.competitors.find((t) => ours(sport, t.team?.abbreviation) === abbr);
      const them = c.competitors.find((t) => t !== me);
      if (!me || !them) return null;
      const pts = (t) => num(t.score && typeof t.score === "object" ? t.score.value : t.score);
      const a = pts(me), b = pts(them);
      if (a == null || b == null) return null;
      return { id: e.id, date: e.date, home: me.homeAway === "home", opp: ours(sport, them.team?.abbreviation), pf: a, pa: b };
    })
    .filter(Boolean)
    .sort((x, y) => new Date(x.date) - new Date(y.date));

  const lines = await pool(done, 6, (g) => closingLine(sport, g.id));
  const games = done.map((g, i) => {
    const L = lines[i];
    if (!L) return { ...g, line: null };
    const spread = L.sh == null ? null : (g.home ? L.sh : -L.sh);
    const ml = g.home ? L.mlh : L.mla;
    return { ...g, line: { spread, total: L.tot, ml, book: L.book } };
  });
  const value = { sport, abbr, season, games };
  memo.set(mk, { value, at: Date.now() });
  return value;
}

// ---- counting -------------------------------------------------------------

export function gradeGame(g) {
  const margin = g.pf - g.pa;
  const L = g.line;
  const ats = L && L.spread != null ? Math.sign(margin + L.spread) : null; // 1 cover, 0 push, -1 miss
  const ou = L && L.total != null ? Math.sign(g.pf + g.pa - L.total) : null; // 1 over, 0 push, -1 under
  const fav = L ? (L.spread != null ? L.spread < 0 : L.ml != null ? L.ml < 0 : null) : null;
  return { margin, ats, ou, win: margin > 0, fav, atsMargin: L && L.spread != null ? margin + L.spread : null };
}

function tally(list) {
  const r = { atsW: 0, atsL: 0, atsP: 0, over: 0, under: 0, ouP: 0, w: 0, l: 0, n: list.length };
  list.forEach((g) => {
    const x = gradeGame(g);
    if (x.ats === 1) r.atsW += 1; else if (x.ats === -1) r.atsL += 1; else if (x.ats === 0) r.atsP += 1;
    if (x.ou === 1) r.over += 1; else if (x.ou === -1) r.under += 1; else if (x.ou === 0) r.ouP += 1;
    if (x.win) r.w += 1; else r.l += 1;
  });
  return r;
}

const fmtRec = (a, b, p) => `${a}-${b}${p ? `-${p}` : ""}`;

// The splits a reader asks about tonight: the season, tonight's venue, tonight's
// role (favourite or underdog), and the last ten.
export function teamSplits(history, { home = null, fav = null } = {}) {
  if (!history) return null;
  const all = history.games;
  const lined = all.filter((g) => g.line);
  const rows = [
    { id: "season", label: "Season", games: all },
    home != null ? { id: "venue", label: home ? "At home" : "On the road", games: all.filter((g) => g.home === home) } : null,
    fav != null ? { id: "role", label: fav ? "As favorite" : "As underdog", games: lined.filter((g) => gradeGame(g).fav === fav) } : null,
    { id: "last10", label: "Last 10", games: all.slice(-10) },
  ].filter(Boolean);
  return rows.map((r) => {
    const t = tally(r.games);
    return {
      ...r,
      n: t.n,
      su: fmtRec(t.w, t.l),
      ats: t.atsW + t.atsL + t.atsP ? fmtRec(t.atsW, t.atsL, t.atsP) : "—",
      atsRate: t.atsW + t.atsL ? t.atsW / (t.atsW + t.atsL) : null,
      ou: t.over + t.under + t.ouP ? fmtRec(t.over, t.under, t.ouP) : "—",
      overRate: t.over + t.under ? t.over / (t.over + t.under) : null,
      tally: t,
    };
  });
}

// Sentences, only where a split clears a bar and has enough games behind it.
export function teamTrends(name, history, { home = null, fav = null } = {}) {
  const rows = teamSplits(history, { home, fav }) || [];
  const out = [];
  rows.forEach((r) => {
    const t = r.tally;
    const atsN = t.atsW + t.atsL;
    const ouN = t.over + t.under;
    const scope = r.id === "season" ? "this season" : r.id === "last10" ? "in their last 10" : r.label.toLowerCase();
    if (atsN >= 5 && (t.atsW / atsN >= 0.7 || t.atsW / atsN <= 0.3)) {
      out.push({ kind: "ats", strength: Math.abs(t.atsW / atsN - 0.5), text: `${name} are ${r.ats} against the spread ${scope}.` });
    }
    if (ouN >= 5 && (t.over / ouN >= 0.7 || t.over / ouN <= 0.3)) {
      const side = t.over >= t.under ? "over" : "under";
      out.push({ kind: "ou", strength: Math.abs(t.over / ouN - 0.5), text: `The ${side} is ${side === "over" ? t.over : t.under}-${side === "over" ? t.under : t.over} in ${name} games ${scope}.` });
    }
    if (r.id === "role" && t.n >= 5 && (t.w / t.n >= 0.75 || t.w / t.n <= 0.25)) {
      out.push({ kind: "su", strength: Math.abs(t.w / t.n - 0.5), text: `${name} are ${r.su} straight up ${scope}.` });
    }
  });
  return out.sort((a, b) => b.strength - a.strength).slice(0, 4);
}

export function fmtAmerican(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v > 0 ? `+${v}` : `−${Math.abs(v)}`;
}
export function fmtSpread(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v === 0) return "PK";
  return v > 0 ? `+${v}` : `−${Math.abs(v)}`;
}
