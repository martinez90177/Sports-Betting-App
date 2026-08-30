// The MLB pitcher lookup: throwing hand and full name, by person id.
//
// It lives here rather than in PropLedger.jsx because two screens need it and
// one of them (MatchupPage) is imported *by* PropLedger, so reaching back up
// would be a cycle. The schedule's probablePitcher hydration answers with
// id, fullName and link only -- no pitchHand at any hydrate depth, checked --
// so the hand costs its own request, which is why it is cached hard.
// mlbId -> "R" | "L". A pitcher's throwing hand does not change, so this is
// cached with no TTL and asked in batches: one request answers for every
// starter in a whole game log, and the same pitcher is never asked twice.
const mlbPitchHandCache = new Map();
// The same lookup answers with a name, which is what frame 1c's EVERY MEETING
// rows print beside the hand. Stored separately so the hand cache keeps its
// simple id -> "R"/"L" shape.
const mlbPitcherNameCache = new Map();
const mlbStarterName = (id) => mlbPitcherNameCache.get(id) || null;
try {
  const stored = sessionStorage.getItem("mlb_pitchhand_v1");
  if (stored) Object.entries(JSON.parse(stored)).forEach(([k, v]) => mlbPitchHandCache.set(Number(k), v));
  const names = sessionStorage.getItem("mlb_pitchername_v1");
  if (names) Object.entries(JSON.parse(names)).forEach(([k, v]) => mlbPitcherNameCache.set(Number(k), v));
} catch {}

async function fetchMLBPitcherHands(ids) {
  // Missing from *either* cache. Testing only the hand cache meant a pitcher
  // whose hand was already known never got a name, so EVERY MEETING printed a
  // blank starter for every game but the few fetched since.
  const want = [...new Set((ids || []).filter((id) => id != null && !(mlbPitchHandCache.has(id) && mlbPitcherNameCache.has(id))))];
  if (!want.length) return mlbPitchHandCache;
  // The people route takes a list, so a 60-game log is one request.
  for (let i = 0; i < want.length; i += 60) {
    const batch = want.slice(i, i + 60);
    try {
      const res = await fetch(`https://statsapi.mlb.com/api/v1/people?personIds=${batch.join(",")}`);
      const data = await res.json();
      (data?.people || []).forEach((p) => {
        const code = p?.pitchHand?.code;
        if (p?.id != null && (code === "R" || code === "L")) mlbPitchHandCache.set(p.id, code);
        if (p?.id != null && p.fullName) mlbPitcherNameCache.set(p.id, p.fullName);
      });
    } catch {
      // Left unset rather than guessed: an unknown hand drops the game from
      // the split instead of being counted as the wrong one.
    }
  }
  try {
    sessionStorage.setItem("mlb_pitchhand_v1", JSON.stringify(Object.fromEntries(mlbPitchHandCache)));
    sessionStorage.setItem("mlb_pitchername_v1", JSON.stringify(Object.fromEntries(mlbPitcherNameCache)));
  } catch {}
  return mlbPitchHandCache;
}
export { mlbPitchHandCache, mlbPitcherNameCache, mlbStarterName, fetchMLBPitcherHands };
