// Compares writers for The Case on the same packets, and checks every reply with
// the same number check the live function uses.
//
//   node scripts/case-eval.mjs packets.json --models haiku,sonnet      (needs ANTHROPIC_API_KEY)
//   node scripts/case-eval.mjs packets.json --replies replies.json     (check replies made elsewhere)
//
// Prints, per packet: what was counted, what each model wrote, and which
// sentences the number check would have thrown away. Writes nothing.
import { readFileSync } from "node:fs";
import { CASE_MODELS, SYSTEM, buildPacket, userMessage, validateCase, parseJsonReply } from "../api/_caseCore.js";

const args = process.argv.slice(2);
const packetsFile = args[0];
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const packets = JSON.parse(readFileSync(packetsFile, "utf8"));

function show(label, side, items) {
  if (!items.length) return;
  console.log(`  ${side}:`);
  items.forEach((b) => console.log(`    - ${b.title}: ${b.text}`));
}

function report(p, name, out, ms) {
  console.log(`\n=== ${p.label} :: ${name}${ms != null ? ` (${ms} ms)` : ""}`);
  console.log(`  counted: over ${p.facts.over.length} / under ${p.facts.under.length} / check ${p.facts.check.length}`);
  if (!out.ok) console.log("  NOTHING USABLE");
  if (out.clean.summary) console.log(`  summary: ${out.clean.summary}`);
  ["over", "under", "check"].forEach((s) => show(p.label, s, out.clean[s]));
  out.rejected.forEach((r) => console.log(`  REJECTED (${r.where || "?"}): ${r.text || r.why} -- numbers not in packet: ${(r.unknown || []).join(", ")}`));
}

const repliesFile = opt("--replies");
if (repliesFile) {
  const replies = JSON.parse(readFileSync(repliesFile, "utf8"));
  let kept = 0, thrown = 0;
  for (const r of replies) {
    const p = packets.find((x) => x.label === r.label);
    if (!p) { console.log(`no packet for ${r.label}`); continue; }
    const out = validateCase(typeof r.reply === "string" ? parseJsonReply(r.reply) : r.reply, buildPacket(p));
    kept += out.clean.over.length + out.clean.under.length + out.clean.check.length;
    thrown += out.rejected.length;
    report(p, "replies", out, null);
  }
  console.log(`\nbullets kept ${kept}, thrown away ${thrown}`);
} else {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const models = (opt("--models") || "haiku").split(",");
  for (const p of packets) {
    const packet = buildPacket(p);
    for (const key of models) {
      const t0 = Date.now();
      const reply = await client.messages.create({
        model: CASE_MODELS[key], max_tokens: 1500, system: SYSTEM,
        messages: [{ role: "user", content: userMessage(packet) }],
        output_config: { effort: "low" },
      });
      const text = (reply.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      const out = validateCase(parseJsonReply(text), packet);
      report(p, key, out, Date.now() - t0);
      console.log(`  tokens in ${reply.usage.input_tokens} out ${reply.usage.output_tokens}`);
    }
  }
}
