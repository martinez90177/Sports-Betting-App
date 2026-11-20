// The address bar. Every screen gets a path of its own, so a screen can be
// linked to, reloaded, bookmarked, and stepped back out of with the browser's
// Back button -- before this, the app never left "/", so Back left the site
// and a link could only ever open the front page.
//
//   /feed/nba                 Prop Feed on a league
//   /board/nfl                The Board on a league
//   /mismatches/nba           Mismatches on a league
//   /games /findings /injuries /news /settings /picks
//   /nba/<playerId>/<market>/<name-slug>?line=12.5
//                             a player page, on one market, at one line
//
// The name slug is for the reader of the link only; it is never read back.
// Player ids stay the lookup key because names are not unique and ids are
// what every page already resolves.
//
// The shell owns history; this module only translates between a path and the
// route object { page, sport, playerId, market, line }.

import { createContext } from "react";

export const ROUTE_SPORTS = new Set(["nfl", "mlb", "nba", "wnba"]);

// Pages that sit at a plain path. "landing" is deliberately absent: the intro
// is first-run state at "/", never a destination of its own.
const PLAIN_PAGES = new Set(["feed", "board", "games", "findings", "injuries", "news", "mismatches", "settings", "picks"]);
// Which of those carry a league in the path.
const SPORT_PAGES = new Set(["feed", "board", "mismatches"]);

function seg(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

export function slugify(name) {
  return String(name || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Path -> route. Null for "/" and for anything this app has no screen for,
// which the shell treats as "open wherever you normally open".
export function parseRoute(pathname, search = "") {
  const parts = String(pathname || "/").split("/").filter(Boolean).map(seg);
  if (!parts.length) return null;
  const [head, a, b] = parts;

  if (ROUTE_SPORTS.has(head)) {
    if (!a) return null;
    const route = { page: head, sport: head, playerId: a, market: b || null, line: null };
    const raw = new URLSearchParams(search).get("line");
    const n = raw === null || raw === "" ? NaN : Number(raw);
    if (Number.isFinite(n)) route.line = n;
    return route;
  }
  if (PLAIN_PAGES.has(head)) {
    const route = { page: head };
    if (SPORT_PAGES.has(head) && a && ROUTE_SPORTS.has(a)) route.sport = a;
    return route;
  }
  return null;
}

// Route -> path (with query). Unknown pages fall back to "/".
export function buildPath(route) {
  if (!route || !route.page || route.page === "landing") return "/";
  const { page } = route;
  if (ROUTE_SPORTS.has(page)) {
    if (!route.playerId) return `/${page}`;
    let p = `/${page}/${encodeURIComponent(route.playerId)}`;
    if (route.market) p += `/${encodeURIComponent(route.market)}`;
    const slug = route.market ? slugify(route.name) : "";
    if (slug) p += `/${slug}`;
    if (Number.isFinite(route.line)) p += `?line=${route.line}`;
    return p;
  }
  if (!PLAIN_PAGES.has(page)) return "/";
  if (SPORT_PAGES.has(page) && route.sport && ROUTE_SPORTS.has(route.sport)) return `/${page}/${route.sport}`;
  return `/${page}`;
}

// The line a jump asks a player page to open on, or null for the page's own
// default. A feed row clicked at 12.5 used to open the page at its
// average-based line (17.5 for the same player), so the rate flipped from
// 80% to 30% between two screens about the same prop.
export function jumpLine(jumpTo) {
  const n = jumpTo && jumpTo.line;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

// How a player page tells the shell what it is showing, so the address
// follows the reader as they switch market, player or line on the page itself.
// Provided by the shell, read by usePlayerPageState -- one place for all four
// sports, the same reason that hook exists.
export const PlayerRouteReport = createContext(null);
