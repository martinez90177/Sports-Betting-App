// The AI half of The Case -- the pieces that do not touch the network.
//
// The underscore keeps this out of Vercel's routes; api/case.js and
// scripts/case-eval.mjs both import it, so the live function and the test
// harness cannot drift apart.
//
// The rule it exists to keep (CLAUDE.md, "No generated data"): every number on
// screen is measured. A model writes the *words*; it is handed a packet of
// numbers the app counted, and anything it writes that carries a number outside
// that packet is thrown away before a reader sees it (validateCase). The model
// is never asked what it knows about a player, only to say what the packet says.

export const CASE_MODELS = {
  haiku: "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
  opus: "claude-opus-5-5",
};

export const SYSTEM = `You write "The Case" for a sports prop research site: why one player's line could go over, and why it could go under. You are given one JSON packet of numbers the site has counted from finished games and the availability report.

Rules, all of them strict:
- Use only the numbers in the packet. Never use anything you know about the player, the team, the opponent, a scheme, an injury, a trade or the season that is not in the packet. If a name is not in the packet, do not write it.
- Every number you write must appear in the packet (the "derived" block holds the differences and percentages you may use). Do not compute any other number. Do not round a packet number to a different one.
- A reason that points toward the over goes in "over"; toward the under, in "under". A fact that points neither way — a teammate on the injury report, for example — goes in "check", and you state only that it is so, never what it does to the line.
- Sides follow the numbers, not the tone. An average below the line, or a share of games over the line under half, is a reason for the under, never the over. An average above the line, or a share over half, is a reason for the over. A number equal to the line, or a share of exactly half, points neither way: put it in "check" or leave it out.
- Never predict. Say "could", never "will". Never recommend a bet or a side. No odds, no prices, no "lock", no "value".
- A thin sample says so: if the packet's games count is under ten, say how many games stand behind the number.
- Use the packet's own words for what it measured (for example "points allowed"). Do not rename a stat.
- Each bullet is a title of two to four words, then one or two plain sentences carrying the numbers that support it. At most three bullets per list. Leave a list empty if nothing in the packet supports it. Do not invent a reason to fill it.
- The "counted" block holds reasons the site already wrote from the same numbers. You may reword, combine or drop them, and you may add one the data supports. Do not contradict them.
- "summary" is one neutral sentence, at most 25 words, that says how the counted reasons balance. It must not pick a side.
- Mention no other website or service.
- The reader never sees the packet. Never write "packet", "JSON", "block" or "data"; say "the numbers we counted" if you must refer to them. Never write a bullet about something that is missing (no defence rank, no sample): leave it out.

Reply with JSON only, no code fence, in exactly this shape:
{"summary": string, "over": [{"title": string, "text": string}], "under": [{"title": string, "text": string}], "check": [{"title": string, "text": string}]}`;

const r1 = (n) => Math.round(n * 10) / 10;

// The packet the model sees: what the client counted, plus the differences and
// percentages a writer would otherwise compute itself -- computed here, so they
// are counted too and are on the allowed list.
export function buildPacket({ meta, facts }) {
  const d = facts.data || {};
  const derived = {};
  const pct = (k, n) => (n > 0 ? Math.round((k / n) * 100) : null);
  if (Number.isFinite(d.line)) {
    if (Number.isFinite(d.last10Avg)) derived.last10AvgMinusLine = r1(d.last10Avg - d.line);
    if (Number.isFinite(d.last5Avg)) derived.last5AvgMinusLine = r1(d.last5Avg - d.line);
    if (Number.isFinite(d.logAvg)) derived.logAvgMinusLine = r1(d.logAvg - d.line);
  }
  if (Number.isFinite(d.last10Over) && Array.isArray(d.last10) && d.last10.length) derived.last10OverPercent = pct(d.last10Over, d.last10.length);
  if (Number.isFinite(d.gamesOverLine) && d.games) derived.logOverPercent = pct(d.gamesOverLine, d.games);
  if (d.vsOpponent && d.vsOpponent.games) derived.vsOpponentOverPercent = pct(d.vsOpponent.over, d.vsOpponent.games);
  if (d.volume && Number.isFinite(d.volume.last5) && Number.isFinite(d.volume.log)) derived.volumeLast5MinusLog = r1(d.volume.last5 - d.volume.log);
  return {
    sport: meta.sport,
    player: meta.player,
    team: meta.team || null,
    market: meta.market,
    // 10 and 5 are the two windows every sentence names.
    windows: { lastTen: 10, lastFive: 5 },
    data: d,
    derived,
    counted: {
      over: (facts.over || []).map(({ title, text }) => ({ title, text })),
      under: (facts.under || []).map(({ title, text }) => ({ title, text })),
      check: (facts.check || []).map(({ title, text }) => ({ title, text })),
    },
  };
}

export function userMessage(packet) {
  return `Packet:\n${JSON.stringify(packet)}`;
}

// ---- the number check ------------------------------------------------------

const NUM = /\d+(?:\.\d+)?/g;
const norm = (s) => String(Number(s));

// Every number in the packet, and each of them rounded to a whole number --
// "averaging 36" for a packet's 35.6 is the same count, said shorter.
export function allowedNumbers(packet) {
  const out = new Set();
  // By size: a packet's -0.2 is how "0.2 below the line" is written, and the
  // sentence's own words carry the sign.
  const add = (n) => { if (Number.isFinite(n)) { const a = Math.abs(n); out.add(norm(a)); out.add(norm(Math.round(a))); } };
  const walk = (v) => {
    if (typeof v === "number") add(v);
    else if (typeof v === "string") (v.match(NUM) || []).forEach((m) => add(Number(m)));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(packet);
  return out;
}

// Digits inside a word -- "Q4", "3PM", "D2" -- are part of the word, not a stat.
// Ordinals ("5th") are the exception: that is a rank, and a rank is checked.
const numbersIn = (text) => (String(text).replace(/\b[A-Za-z]+\d+[A-Za-z]*\b|\b\d+(?!(?:st|nd|rd|th)\b)[A-Za-z]+\b/g, " ").match(NUM) || []).map(norm);

// Words that mean the writer is talking about its own input, not the prop.
const JARGON = /\b(packet|json|block|data)\b/i;
const LIST_CAP = 3;
const TEXT_CAP = 320;

// Keeps what is true to the packet and drops the rest. Returns the cleaned case
// and what it threw away, so the caller can log or fall back.
export function validateCase(output, packet) {
  const allowed = allowedNumbers(packet);
  const rejected = [];
  const clean = { summary: "", over: [], under: [], check: [] };
  if (!output || typeof output !== "object") return { ok: false, clean, rejected: [{ why: "not an object" }] };

  const bad = (text) => numbersIn(text).filter((n) => !allowed.has(n));
  const vet = (text, where) => {
    if (typeof text !== "string" || !text.trim()) return null;
    if (text.length > TEXT_CAP) { rejected.push({ where, why: "too long" }); return null; }
    if (JARGON.test(text)) { rejected.push({ where, text, why: "talks about its input" }); return null; }
    const unknown = bad(text);
    if (unknown.length) { rejected.push({ where, text, unknown }); return null; }
    return text.trim();
  };

  const sum = vet(output.summary, "summary");
  if (sum && sum.split(/\s+/).length <= 30) clean.summary = sum;
  ["over", "under", "check"].forEach((side) => {
    (Array.isArray(output[side]) ? output[side] : []).slice(0, LIST_CAP).forEach((b) => {
      const title = vet(b && b.title, `${side}.title`);
      const text = vet(b && b.text, side);
      if (title && text) clean[side].push({ title, text });
    });
  });
  const ok = clean.over.length + clean.under.length + clean.check.length > 0;
  return { ok, clean, rejected };
}

// The model may wrap JSON in a fence or a sentence despite being told not to.
export function parseJsonReply(text) {
  const s = String(text || "").trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* fall through */ } }
  return null;
}
