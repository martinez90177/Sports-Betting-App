// Forecast at kickoff, for outdoor NFL games.
//
// Competitive brief item 7 (mock 3f). MLB needs nothing here: the Stats API
// hydrates `weather` on the schedule request already, and it hands back the
// one thing a generic forecast cannot -- wind read against the field ("6 mph,
// In From CF"), which is the form that actually means something for a fly
// ball. NBA and the WNBA are indoors. That leaves the NFL.
//
// Open-Meteo, because it needs no key, no account and no proxy: it sends
// `access-control-allow-origin: *`, so this runs in the browser exactly like
// lib/statcast.js does, unlike api/odds.js which needs a serverless function
// to hold its key. There is no paid tier to fall off and no quota to leak.
//
// What this deliberately does NOT do is claim a field-relative wind. Turning
// "220° at 12 mph" into "blowing out to right" needs each stadium's own
// orientation, and a table of thirty-two bearings entered by hand is thirty-two
// chances to state a tailwind as a headwind. The compass direction is what the
// forecast actually knows, so the compass direction is what this reports.

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const TTL_MS = 60 * 60 * 1000;

// Where each team plays, and whether the sky is a factor there.
//
// `roof` is the question this table exists to answer, not a piece of trivia: a
// dome game has no weather, and fetching a forecast for the air above a closed
// roof and printing it beside a passing prop would be worse than printing
// nothing. "retractable" is treated as open, because whether it is shut on the
// day is a decision nobody publishes in a form we can read -- so the block
// says so rather than guessing.
//
// ENTERED 2026-08-24. Coordinates are the playing surface, not the parking
// lot; they only need to be right to within a mile for a forecast grid.
// Re-check when a team moves or a stadium is renamed.
export const NFL_STADIUMS = {
  ARI: { name: "State Farm Stadium", lat: 33.5276, lon: -112.2626, roof: "retractable" },
  ATL: { name: "Mercedes-Benz Stadium", lat: 33.7554, lon: -84.4009, roof: "retractable" },
  BAL: { name: "M&T Bank Stadium", lat: 39.2780, lon: -76.6227, roof: "open" },
  BUF: { name: "Highmark Stadium", lat: 42.7738, lon: -78.7870, roof: "open" },
  CAR: { name: "Bank of America Stadium", lat: 35.2258, lon: -80.8528, roof: "open" },
  CHI: { name: "Soldier Field", lat: 41.8623, lon: -87.6167, roof: "open" },
  CIN: { name: "Paycor Stadium", lat: 39.0955, lon: -84.5161, roof: "open" },
  CLE: { name: "Huntington Bank Field", lat: 41.5061, lon: -81.6995, roof: "open" },
  DAL: { name: "AT&T Stadium", lat: 32.7473, lon: -97.0945, roof: "retractable" },
  DEN: { name: "Empower Field at Mile High", lat: 39.7439, lon: -105.0201, roof: "open" },
  DET: { name: "Ford Field", lat: 42.3400, lon: -83.0456, roof: "dome" },
  GB: { name: "Lambeau Field", lat: 44.5013, lon: -88.0622, roof: "open" },
  HOU: { name: "NRG Stadium", lat: 29.6847, lon: -95.4107, roof: "retractable" },
  IND: { name: "Lucas Oil Stadium", lat: 39.7601, lon: -86.1639, roof: "retractable" },
  JAX: { name: "EverBank Stadium", lat: 30.3239, lon: -81.6373, roof: "open" },
  KC: { name: "Arrowhead Stadium", lat: 39.0489, lon: -94.4839, roof: "open" },
  LV: { name: "Allegiant Stadium", lat: 36.0909, lon: -115.1833, roof: "dome" },
  LAC: { name: "SoFi Stadium", lat: 33.9535, lon: -118.3392, roof: "dome" },
  LAR: { name: "SoFi Stadium", lat: 33.9535, lon: -118.3392, roof: "dome" },
  MIA: { name: "Hard Rock Stadium", lat: 25.9580, lon: -80.2389, roof: "open" },
  MIN: { name: "U.S. Bank Stadium", lat: 44.9738, lon: -93.2578, roof: "dome" },
  NE: { name: "Gillette Stadium", lat: 42.0909, lon: -71.2643, roof: "open" },
  NO: { name: "Caesars Superdome", lat: 29.9511, lon: -90.0812, roof: "dome" },
  NYG: { name: "MetLife Stadium", lat: 40.8135, lon: -74.0745, roof: "open" },
  NYJ: { name: "MetLife Stadium", lat: 40.8135, lon: -74.0745, roof: "open" },
  PHI: { name: "Lincoln Financial Field", lat: 39.9008, lon: -75.1675, roof: "open" },
  PIT: { name: "Acrisure Stadium", lat: 40.4468, lon: -80.0158, roof: "open" },
  SEA: { name: "Lumen Field", lat: 47.5952, lon: -122.3316, roof: "open" },
  SF: { name: "Levi's Stadium", lat: 37.4033, lon: -121.9694, roof: "open" },
  TB: { name: "Raymond James Stadium", lat: 27.9759, lon: -82.5033, roof: "open" },
  TEN: { name: "Nissan Stadium", lat: 36.1665, lon: -86.7713, roof: "open" },
  WAS: { name: "Northwest Stadium", lat: 38.9076, lon: -76.8645, roof: "open" },
};

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

// The direction the wind is coming FROM, which is the meteorological
// convention Open-Meteo reports and the one a reader expects from a forecast.
export function compassOf(deg) {
  if (deg == null || Number.isNaN(deg)) return null;
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

const cache = new Map();
const inflight = new Map();

// The hour nearest kickoff, out of the hourly series.
//
// Nearest, not the hour containing it: a 1:00 PM kickoff sits exactly on an
// hour boundary and floor/ceil disagree by a whole hour of weather. Picking
// the closest timestamp is the same answer either way and needs no rounding
// rule to explain.
function atKickoff(hourly, kickoffIso) {
  if (!hourly || !hourly.time || !hourly.time.length) return null;
  const target = new Date(kickoffIso).getTime();
  if (Number.isNaN(target)) return null;
  let best = 0, bestGap = Infinity;
  hourly.time.forEach((t, i) => {
    const gap = Math.abs(new Date(t).getTime() - target);
    if (gap < bestGap) { bestGap = gap; best = i; }
  });
  // Beyond the forecast horizon the nearest hour is days away and would be
  // presented as "at kickoff", which it is not.
  if (bestGap > 12 * 60 * 60 * 1000) return null;
  return {
    temp: hourly.temperature_2m ? Math.round(hourly.temperature_2m[best]) : null,
    windMph: hourly.wind_speed_10m ? Math.round(hourly.wind_speed_10m[best]) : null,
    windDir: hourly.wind_direction_10m ? compassOf(hourly.wind_direction_10m[best]) : null,
    precipPct: hourly.precipitation_probability ? hourly.precipitation_probability[best] : null,
  };
}

// Returns null for a dome, for an unknown stadium, for a kickoff outside the
// forecast horizon, and for a failed request -- four different reasons that
// all mean the same thing to the caller: do not draw a forecast. The block
// above it says which, from `roof`, rather than this function trying to
// encode a reason in its return value.
export function fetchNFLKickoffWeather(homeAbbr, kickoffIso) {
  const park = NFL_STADIUMS[homeAbbr];
  if (!park || park.roof === "dome" || !kickoffIso) return Promise.resolve(null);

  const key = `${homeAbbr}:${String(kickoffIso).slice(0, 13)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.value);
  if (inflight.has(key)) return inflight.get(key);

  const url = `${ENDPOINT}?latitude=${park.lat}&longitude=${park.lon}`
    + "&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability"
    + "&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=8&timezone=UTC";

  const run = fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const value = j ? atKickoff(j.hourly, kickoffIso) : null;
      cache.set(key, { at: Date.now(), value });
      return value;
    })
    .catch(() => {
      // Not cached on failure: a retry later in the session should be able to
      // try again rather than replay one dropped request for an hour.
      return null;
    })
    .finally(() => { inflight.delete(key); });

  inflight.set(key, run);
  return run;
}
