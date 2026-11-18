import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { redisClient } from "./_oddsBudget.js";
import { CASE_MODELS } from "./_caseCore.js";
import { SLIP_SYSTEM, buildSlipPacket, slipShapeOk, validateSlip, parseJsonReply } from "./_slipCore.js";

// POST /api/slip -- the written review of a whole slip, for THE READ.
//
// Built the same way as /api/case: the browser sends the numbers it already
// counted for each leg, the model only words them, and every sentence is run
// through the number check before anyone sees it. Cached by a hash of the
// packet, with per-visitor and site-wide daily allowances, because the site
// is public and every fresh call costs money.
//
// Any failure answers { ok: false } and THE READ keeps the counted review it
// already draws -- the AI layer is an addition, never a dependency.

const DAILY_PER_VISITOR = Number(process.env.SLIP_DAILY_LIMIT) || 20;
const DAILY_SITE = Number(process.env.SLIP_SITE_DAILY_LIMIT) || 1500;
const CACHE_TTL_S = 6 * 60 * 60;
const MAX_BODY = 16000;

const fail = (res, status, error) => res.status(status).json({ ok: false, error });

export default async function handler(req, res) {
  if (req.method !== "POST") return fail(res, 405, "POST only");
  if (!process.env.ANTHROPIC_API_KEY) return fail(res, 503, "not configured");

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body;
  if (!body || JSON.stringify(body).length > MAX_BODY || !slipShapeOk(body)) return fail(res, 400, "bad slip");

  const modelKey = (process.env.CASE_MODEL || "haiku").toLowerCase();
  const model = CASE_MODELS[modelKey];
  if (!model) return fail(res, 500, "unknown model setting");

  const packet = buildSlipPacket(body);
  const redis = redisClient();
  const hash = createHash("sha256").update(JSON.stringify(packet)).digest("hex").slice(0, 40);
  const cacheKey = `slip:v1:${model}:${hash}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.status(200).json({ ok: true, cached: true, model, ...cached });
  } catch { /* a cold cache is not a reason to fail */ }

  // Allowances, spent only on a fresh generation.
  const day = new Date().toISOString().slice(0, 10);
  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  try {
    const [site, mine] = await Promise.all([
      redis.incr(`slip-site:${day}`),
      redis.incr(`slip-ip:${day}:${ip}`),
    ]);
    redis.expire(`slip-site:${day}`, 2 * 86400).catch(() => {});
    redis.expire(`slip-ip:${day}:${ip}`, 2 * 86400).catch(() => {});
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
      system: SLIP_SYSTEM,
      messages: [{ role: "user", content: `Slip:\n${JSON.stringify(packet)}` }],
      // Wording counted numbers is not hard reasoning; low effort keeps it fast and cheap.
      output_config: { effort: "low" },
    });
    if (reply.stop_reason === "refusal") return fail(res, 502, "declined");
    const text = (reply.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const out = validateSlip(parseJsonReply(text), packet);
    if (!out.ok) return fail(res, 502, "nothing usable");

    const record = { review: out.clean, rejected: out.rejected.length };
    redis.set(cacheKey, record, { ex: CACHE_TTL_S }).catch(() => {});
    return res.status(200).json({ ok: true, cached: false, model, ...record });
  } catch (e) {
    return fail(res, e instanceof Anthropic.RateLimitError ? 429 : 502, "model error");
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
