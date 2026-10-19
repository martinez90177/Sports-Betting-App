import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { redisClient } from "./_oddsBudget.js";
import { CASE_MODELS, SYSTEM, buildPacket, userMessage, validateCase, parseJsonReply } from "./_caseCore.js";

// POST /api/case -- the written Case for one prop.
//
// The browser sends the numbers it counted ({ meta, facts }), never a question:
// the model can only ever be asked to say what a packet of counted numbers says.
// Nothing here reaches the model that the page did not already show.
//
// Three things keep the bill bounded, because the site is public and every call
// costs money:
//   * the result is cached by a hash of the packet itself, so a prop opened by
//     five hundred people is generated once -- and a forged packet can only fill
//     a cache slot that its own contents address, never one a real packet uses;
//   * each visitor gets a daily allowance of fresh generations (cache hits are
//     free and uncounted);
//   * the whole site has a daily ceiling.
// The model is a setting (CASE_MODEL: haiku | sonnet | opus), not code.
//
// Any failure answers { ok: false } and the page keeps the counted Case it
// already drew -- the AI layer is an addition, never a dependency.

const DAILY_PER_VISITOR = Number(process.env.CASE_DAILY_LIMIT) || 20;
const DAILY_SITE = Number(process.env.CASE_SITE_DAILY_LIMIT) || 1500;
const CACHE_TTL_S = 24 * 60 * 60;
const MAX_BODY = 12000;

const fail = (res, status, error) => res.status(status).json({ ok: false, error });

function shapeOk(body) {
  const m = body && body.meta;
  const f = body && body.facts;
  if (!m || !f || typeof f !== "object") return false;
  if (!["nba", "nfl"].includes(m.sport)) return false;
  if (typeof m.player !== "string" || m.player.length > 60) return false;
  if (typeof m.market !== "string" || m.market.length > 40) return false;
  if (!f.data || typeof f.data !== "object" || !Number.isFinite(f.data.line)) return false;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return fail(res, 405, "POST only");
  if (!process.env.ANTHROPIC_API_KEY) return fail(res, 503, "not configured");

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body;
  if (!body || JSON.stringify(body).length > MAX_BODY || !shapeOk(body)) return fail(res, 400, "bad packet");

  const modelKey = (process.env.CASE_MODEL || "haiku").toLowerCase();
  const model = CASE_MODELS[modelKey];
  if (!model) return fail(res, 500, "unknown model setting");

  const packet = buildPacket(body);
  const redis = redisClient();
  const hash = createHash("sha256").update(JSON.stringify(packet)).digest("hex").slice(0, 40);
  const cacheKey = `case:v1:${model}:${hash}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.status(200).json({ ok: true, cached: true, model, ...cached });
  } catch { /* a cold cache is not a reason to fail */ }

  // Allowances, spent only on a fresh generation.
  const day = new Date().toISOString().slice(0, 10);
  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  try {
    const [site, mine] = await Promise.all([
      redis.incr(`case-site:${day}`),
      redis.incr(`case-ip:${day}:${ip}`),
    ]);
    redis.expire(`case-site:${day}`, 2 * 86400).catch(() => {});
    redis.expire(`case-ip:${day}:${ip}`, 2 * 86400).catch(() => {});
    if (site > DAILY_SITE) return fail(res, 429, "site limit");
    if (mine > DAILY_PER_VISITOR) return fail(res, 429, "daily limit");
  } catch {
    // If the counters are down the limits cannot be enforced: refuse rather
    // than run unmetered.
    return fail(res, 503, "limits unavailable");
  }

  try {
    const client = new Anthropic();
    const reply = await client.messages.create({
      model,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: userMessage(packet) }],
      // Wording a packet is not hard reasoning; low effort keeps it fast and cheap.
      output_config: { effort: "low" },
    });
    if (reply.stop_reason === "refusal") return fail(res, 502, "declined");
    const text = (reply.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const out = validateCase(parseJsonReply(text), packet);
    if (!out.ok) return fail(res, 502, "nothing usable");

    const record = { case: out.clean, rejected: out.rejected.length };
    redis.set(cacheKey, record, { ex: CACHE_TTL_S }).catch(() => {});
    return res.status(200).json({ ok: true, cached: false, model, ...record });
  } catch (e) {
    return fail(res, e instanceof Anthropic.RateLimitError ? 429 : 502, "model error");
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
