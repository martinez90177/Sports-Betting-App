// ---------------------------------------------------------------------------
// Log scoping -- one control over the game log, not three
// ---------------------------------------------------------------------------
// Three of the data track's decisions turned out to be the same UI primitive:
//
//   1. Playoffs count, are visibly marked, and are filterable.
//   2. A traded player keeps his whole log, plus a per-team filter.
//   3. Current season always outranks previous seasons.
//
// Each one narrows the same list of games, and every number on a player page
// -- chart, splits, verdict, per-game table, sample-size labels -- is derived
// from that list. So this is built once, applied at the single point where a
// page turns "this player's log" into "the games in view", and everything
// downstream narrows together for free.
//
// ---- The trap named in the plan, and how this closes it ----
//
// `ALL` used to mean "every game in the log", which is fine while a log holds
// exactly one season and silently violates decision 3 the moment a second one
// is loaded: L5 would start reaching back into last year with nothing on
// screen changing. So `season` defaults to the newest season present, not to
// everything -- and it does so *now*, before prior seasons land, rather than
// being retrofitted after the first wrong number ships. When 2024-25 is
// backfilled the control appears on its own and the default does not move.
//
// ---- What decides whether a control is shown ----
//
// The log itself, never a config. A player who was never traded has one team
// in his log and gets no team control; a player whose team missed the playoffs
// has no postseason games and gets no season-type control. This costs nothing
// for the overwhelming majority and appears exactly where it is meaningful.

export const LOG_SCOPE_DEFAULT = { seasonType: "all", team: "all", season: "current" };

// A game with no seasonType predates the tagging (generated logs, MLB's
// gameType=R pull) and is regular season by construction -- every parser that
// can produce a postseason game sets the field.
export function isPlayoffGame(game) {
  return game?.seasonType === "post";
}

const SEASON_TYPE_LABEL = {
  all: "All games",
  regular: "Regular season",
  post: "Playoffs",
};

// ESPN numbers a season by the year it ends, so 2026 is the 2025-26 season.
// Rendered that way rather than as a bare number, which reads as a calendar
// year and is off by one for every winter league.
export function seasonLabel(season, sport) {
  const n = Number(season);
  if (!Number.isFinite(n)) return String(season);
  if (sport === "mlb" || sport === "wnba") return String(n);
  return `${n - 1}-${String(n).slice(2)}`;
}

// What this log can be scoped by. Returns only the controls that have
// something to choose between.
//
// `scope` matters for the counts, not for which controls appear. Every option
// is counted as "how many games would be left if I clicked this, given what is
// already selected" -- so with Playoffs active, a traded player's "With NOP"
// reads 1 rather than 41. Counting against the raw log instead would put a
// number on the chip that the chip does not deliver, which is the same class
// of quiet wrongness as a filter that empties the sample without saying so.
//
// Which controls appear is deliberately *not* scoped: they come from the whole
// log, so choosing one option never makes the others disappear underneath the
// cursor.
export function logScopeOptions(games, sport, scope) {
  const list = games || [];
  const typeCounts = { regular: 0, post: 0 };
  const teamOrder = [];
  const teamCounts = {};
  const seasonCounts = {};

  list.forEach((g) => {
    const t = g.seasonType === "post" ? "post" : "regular";
    typeCounts[t] += 1;
    if (g.team) {
      if (!(g.team in teamCounts)) { teamOrder.push(g.team); teamCounts[g.team] = 0; }
      teamCounts[g.team] += 1;
    }
    if (g.season != null) seasonCounts[g.season] = (seasonCounts[g.season] || 0) + 1;
  });

  const base = scope || LOG_SCOPE_DEFAULT;
  const countWith = (patch) => scopeGames(list, { ...base, ...patch }).length;

  const seasonTypes = typeCounts.post > 0 && typeCounts.regular > 0
    ? ["all", "regular", "post"].map((id) => ({
        id,
        label: SEASON_TYPE_LABEL[id],
        n: countWith({ seasonType: id }),
      }))
    : [];

  // Current team first -- the log is date-ascending, so it is the last one to
  // appear -- then prior teams most-recent-first. Someone researching a traded
  // player wants "since the trade" at the front, not his rookie year.
  const teams = teamOrder.length > 1
    ? [{ id: "all", label: "All games", n: countWith({ team: "all" }) }].concat(
        [...teamOrder].reverse().map((abbr) => ({ id: abbr, label: `With ${abbr}`, n: countWith({ team: abbr }) }))
      )
    : [];

  const seasonKeys = Object.keys(seasonCounts).sort((a, b) => Number(b) - Number(a));
  const seasons = seasonKeys.length > 1
    ? [{ id: "current", label: seasonLabel(seasonKeys[0], sport), n: countWith({ season: "current" }) }].concat(
        seasonKeys.slice(1).map((y) => ({ id: y, label: seasonLabel(y, sport), n: countWith({ season: y }) }))
      )
    : [];

  return { seasonTypes, teams, seasons, currentSeason: seasonKeys[0] ?? null };
}

// The one filter. Pure, and deliberately not memoised in here -- callers hold
// it inside their own useMemo beside the log it came from.
export function scopeGames(games, scope) {
  const list = games || [];
  if (!list.length) return list;
  const s = scope || LOG_SCOPE_DEFAULT;

  // Season first, because "current" is resolved against the whole log rather
  // than against whatever the other two filters left behind: a player who
  // played only playoff games this year still has "current season" mean this
  // year, not last.
  let out = list;
  const seasons = new Set(list.map((g) => g.season).filter((v) => v != null));
  if (seasons.size > 1) {
    if (s.season === "current" || s.season == null) {
      const newest = Math.max(...[...seasons].map(Number));
      out = out.filter((g) => Number(g.season) === newest);
    } else {
      out = out.filter((g) => String(g.season) === String(s.season));
    }
  }

  if (s.seasonType === "regular") out = out.filter((g) => !isPlayoffGame(g));
  else if (s.seasonType === "post") out = out.filter((g) => isPlayoffGame(g));

  if (s.team && s.team !== "all") out = out.filter((g) => g.team === s.team);

  return out;
}

// True when the scope is doing nothing, so a caller can skip work or hide a
// "clear" affordance.
export function isDefaultScope(scope) {
  const s = scope || LOG_SCOPE_DEFAULT;
  return (s.seasonType || "all") === "all"
    && (s.team || "all") === "all"
    && (s.season || "current") === "current";
}

// How many of the page's filter-count badges this scope is worth. Season is
// excluded: it always has a value, so counting it would show "1 filter" on a
// page where nothing has been narrowed.
export function scopeFilterCount(scope) {
  const s = scope || LOG_SCOPE_DEFAULT;
  let n = 0;
  if ((s.seasonType || "all") !== "all") n += 1;
  if ((s.team || "all") !== "all") n += 1;
  if ((s.season || "current") !== "current") n += 1;
  return n;
}

// --------------------------------------------------------------------- UI

function ScopeRow({ label, options, value, onChange }) {
  if (!options.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="micro-label" style={{ fontSize: 10, marginBottom: 7 }}>{label}</div>
      <div className="fp-row">
        {options.map((o) => (
          <div
            key={o.id}
            role="button"
            className={`chip-sm ${String(value) === String(o.id) ? "active" : ""}`}
            onClick={() => onChange(o.id)}
            // The count travels with every option, because a filter that
            // silently empties the sample is the failure this whole track is
            // about. It is what you get *if you click this*, with the other
            // selections applied -- see logScopeOptions.
            title={`${o.n} game${o.n === 1 ? "" : "s"} with the current selection`}
          >
            {o.label}
            <span
              className="tnum"
              style={{ marginLeft: 6, color: o.n === 0 ? "var(--neg)" : "var(--dim)", fontWeight: 500 }}
            >
              {o.n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Whether this log offers anything to scope by. Exported so a caller can
// decide about its own section chrome without rendering the control and
// inspecting the result -- calling a component function to find out whether it
// would render anything works only for as long as it stays hook-free, which is
// not a property worth depending on.
export function hasLogScopeChoices(games, sport) {
  const o = logScopeOptions(games, sport, LOG_SCOPE_DEFAULT);
  return !!(o.seasonTypes.length || o.teams.length || o.seasons.length);
}

// Renders nothing when the log offers no choices, which is the common case.
export function LogScopeControl({ games, sport, scope, onChange }) {
  const opts = logScopeOptions(games, sport, scope);
  if (!opts.seasonTypes.length && !opts.teams.length && !opts.seasons.length) return null;
  const s = scope || LOG_SCOPE_DEFAULT;
  return (
    <>
      <ScopeRow
        label="Season"
        options={opts.seasons}
        value={s.season === "current" ? (opts.seasons[0] || {}).id : s.season}
        onChange={(id) => onChange({ ...s, season: id === (opts.seasons[0] || {}).id ? "current" : id })}
      />
      <ScopeRow
        label="Games counted"
        options={opts.seasonTypes}
        value={s.seasonType || "all"}
        onChange={(id) => onChange({ ...s, seasonType: id })}
      />
      <ScopeRow
        label="Team"
        options={opts.teams}
        value={s.team || "all"}
        onChange={(id) => onChange({ ...s, team: id })}
      />
    </>
  );
}

// The visible mark. Decision 1 says a playoff game has to *look* like one
// wherever a game appears, which is a different requirement from being
// filterable -- someone reading a Last 10 with four playoff games in it should
// see that without opening a filter panel.
//
// Deliberately neutral ink: blue is the app's accent and means selected, and
// green/amber/red are spoken for by availability and by cleared/missed. A
// playoff game is not a good or bad outcome, so it gets no colour of its own.
export function PlayoffTag({ compact = false, style }) {
  return (
    <span
      className="mono"
      title="Playoff game"
      style={{
        display: "inline-block",
        padding: compact ? "0 3px" : "1px 4px",
        borderRadius: 3,
        border: "1px solid var(--line)",
        color: "var(--dim)",
        fontSize: compact ? 8.5 : 9.5,
        fontWeight: 700,
        letterSpacing: 0.4,
        lineHeight: compact ? 1.35 : 1.4,
        verticalAlign: "middle",
        ...style,
      }}
    >
      PO
    </span>
  );
}
