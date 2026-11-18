// The AI half of THE READ -- a written review of a whole slip.
//
// Same contract as api/_caseCore.js: the browser sends the numbers it already
// counted for each leg, the model only words them, and any sentence carrying a
// number that is not in the packet is thrown away before a reader sees it.

import { allowedNumbers, numbersIn, parseJsonReply } from "./_caseCore.js";

export const SLIP_SYSTEM = `You review a player-prop parlay slip for a sports research site. You are given one JSON packet: what the reader says they are building, the price target, and every leg with numbers the site counted from finished games.

Rules, all of them strict:
- Use only the numbers and names in the packet. Never use anything you know about a player, team, injury, scheme or season that is not in the packet.
- Every number you write must appear in the packet. Do not compute new numbers. Do not round a packet number to a different one.
- Be direct and useful, like a sharp friend reading the slip over the reader's shoulder. Plain words, no hype.
- Never predict a result. Say "could", never "will". No "lock", no "free money", no guarantees.
- "verdict" is one or two sentences (at most 40 words) on how the slip holds together for what the reader says they are building.
- "strengths": up to three short bullets on what is solid, each naming the leg it is about.
- "risks": up to three short bullets on what could sink it, most serious first, each naming the leg or legs. A leg with fewer than ten games behind it, a recent stretch weaker than its window, a typical result close to the line, or two legs that lean on the same game or the same team are the risks worth naming when the packet shows them.
- "weakest": the one leg most likely to break the slip, as {"name": string, "why": string}. Use the leg's name exactly as the packet spells it. Leave it null on a one-leg slip.
- "tighten": one concrete change that would make the slip safer, naming the leg, or an empty string if nothing stands out. Only moves the reader can make: drop a leg, swap it, or step its line down a rung.
- Each bullet is a title of two to five words and one or two plain sentences.
- Mention no other website or service. Never write "packet", "JSON" or "data".

Reply with JSON only, no code fence, in exactly this shape:
{"verdict": string, "strengths": [{"title": string, "text": string}], "risks": [{"title": string, "text": string}], "weakest": {"name": string, "why": string} | null, "tighten": string}`;

const r1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
const pct = (k, n) => (n > 0 ? Math.round((k / n) * 100) : null);
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : null);

// What the model sees. Only fields the slip already holds; percentages are
// computed here so they are counted too and land on the allowed list.
export function buildSlipPacket(body) {
  const legs = (Array.isArray(body.legs) ? body.legs : []).slice(0, 12).map((l) => {
    const out = {
      name: str(l.name, 60),
      team: str(l.team, 6),
      prop: str(l.prop, 60),
      line: Number.isFinite(l.line) ? l.line : null,
      opponent: str(l.opp, 40),
      gamesOver: Number.isFinite(l.hits) ? l.hits : null,
      gamesCounted: Number.isFinite(l.n) ? l.n : null,
      hitRatePercent: Number.isFinite(l.hits) && Number.isFinite(l.n) ? pct(l.hits, l.n) : null,
      lastFiveOver: Number.isFinite(l.last5Over) ? l.last5Over : null,
      lastFiveCounted: Number.isFinite(l.last5N) ? l.last5N : null,
      typicalResult: r1(l.median),
      typicalMinusLine: Number.isFinite(l.median) && Number.isFinite(l.line) ? r1(l.median - l.line) : null,
      opposingDefenseRank: Number.isFinite(l.defRank) ? l.defRank : null,
      defenseRankOutOf: Number.isFinite(l.defOf) ? l.defOf : null,
      flag: ["FITS", "CHECK", "AGAINST"].includes(l.flag) ? l.flag : null,
      flagReason: str(l.say, 220),
      altLine: !!l.alt,
      availability: str(l.avail, 20),
    };
    return out;
  });
  return {
    building: str(body.intent, 40),
    buildingMeans: str(body.intentHint, 200),
    priceTarget: Number.isFinite(body.target) ? body.target : null,
    combinedPercentFromRates: Number.isFinite(body.combinedRate) ? Math.round(body.combinedRate * 100) : null,
    combinedAmericanFromRates: Number.isFinite(body.am) ? Math.round(body.am) : null,
    legCount: legs.length,
    sameGameGroups: Number.isFinite(body.sameGame) ? body.sameGame : 0,
    sharedTeams: (Array.isArray(body.sharedTeams) ? body.sharedTeams : []).slice(0, 6).map((s) => str(s, 80)),
    legs,
  };
}

export function slipShapeOk(body) {
  if (!body || !Array.isArray(body.legs) || body.legs.length < 1 || body.legs.length > 12) return false;
  return body.legs.every((l) => l && typeof l.name === "string" && l.name.length <= 60 && typeof l.prop === "string");
}

const JARGON = /\b(packet|json)\b/i;
const LIST_CAP = 3;
const TEXT_CAP = 360;

// Keeps what is true to the packet and drops the rest.
export function validateSlip(output, packet) {
  const allowed = allowedNumbers(packet);
  const names = new Set(packet.legs.map((l) => l.name));
  const rejected = [];
  const clean = { verdict: "", strengths: [], risks: [], weakest: null, tighten: "" };
  if (!output || typeof output !== "object") return { ok: false, clean, rejected: [{ why: "not an object" }] };

  const vet = (text, where, cap = TEXT_CAP) => {
    if (typeof text !== "string" || !text.trim()) return null;
    if (text.length > cap) { rejected.push({ where, why: "too long" }); return null; }
    if (JARGON.test(text)) { rejected.push({ where, text, why: "talks about its input" }); return null; }
    const unknown = numbersIn(text).filter((n) => !allowed.has(n));
    if (unknown.length) { rejected.push({ where, text, unknown }); return null; }
    return text.trim();
  };

  clean.verdict = vet(output.verdict, "verdict") || "";
  ["strengths", "risks"].forEach((side) => {
    (Array.isArray(output[side]) ? output[side] : []).slice(0, LIST_CAP).forEach((b) => {
      const title = vet(b && b.title, `${side}.title`, 60);
      const text = vet(b && b.text, side);
      if (title && text) clean[side].push({ title, text });
    });
  });
  const w = output.weakest;
  if (w && typeof w === "object" && names.has(w.name)) {
    const why = vet(w.why, "weakest");
    if (why) clean.weakest = { name: w.name, why };
  }
  clean.tighten = vet(output.tighten, "tighten") || "";
  const ok = !!clean.verdict || clean.risks.length + clean.strengths.length > 0;
  return { ok, clean, rejected };
}

export { parseJsonReply };
