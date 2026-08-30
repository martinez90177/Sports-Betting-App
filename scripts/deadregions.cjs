#!/usr/bin/env node
//
// Finds regions of a v3 component that are gated on a prop no caller passes.
//
//   node scripts/deadregions.cjs
//
// Why this exists
// ---------------
// `mockaudit.cjs` proves the copy was transcribed. It cannot prove the copy is
// ever on screen, and twice it has been wrong about exactly that:
//
//   - PlayerDetailDesktop's `{workload && ...}` — the mock's whole workload
//     control, slider and reset and game count. No page passed `workload`, so
//     it had never rendered on any sport. Alex spotted it by eye.
//   - BoardDesktop's `{opened && ...}` — the OPENING banner. Same shape.
//
// Both compiled. Both audited clean, because every label they would print comes
// from a prop, so there was no literal for a string matcher to miss. A region
// whose text is all props is invisible to that check by construction.
//
// So: for each `{prop && (` in a v3 component, is `prop=` or `prop:` handed in
// anywhere? A miss here is not automatically a bug — a prop can be optional on
// purpose, and the two above were reported alongside genuinely optional ones —
// but every one should have a reason someone has thought about.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const V3 = path.join(ROOT, "src", "v3");

// Everything that could hand a prop to a v3 component.
const CALLERS = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.[jt]sx?$/.test(entry.name)) CALLERS.push(full);
  }
})(path.join(ROOT, "src"));

const HAYSTACK = CALLERS.map((f) => fs.readFileSync(f, "utf8")).join("\n");

let flagged = 0, checked = 0;

for (const file of fs.readdirSync(V3).filter((f) => f.endsWith(".jsx"))) {
  const src = fs.readFileSync(path.join(V3, file), "utf8");

  // Props the component declares, with a default — the shape a gated region
  // uses. `foo = null`, `foo = []`, `foo = false`.
  const sig = src.match(/export default function \w+\(\{([\s\S]*?)\n\}\)/);
  if (!sig) continue;
  const declared = new Set(
    [...sig[1].matchAll(/^\s*(\w+)\s*(?:=|,|$)/gm)].map((m) => m[1])
  );

  // Regions gated on one of them.
  const gates = [...new Set(
    [...src.matchAll(/\{(\w+)\s*&&\s*\(/g)].map((m) => m[1])
      .filter((n) => declared.has(n))
  )];
  if (!gates.length) continue;
  checked += 1;

  const dead = gates.filter((g) => {
    // Passed as a JSX attribute or as an object key by any file in src/.
    const asAttr = new RegExp("\\b" + g + "=\\{", "g");
    const asKey = new RegExp("^\\s*" + g + ":", "m");
    return !asAttr.test(HAYSTACK) && !asKey.test(HAYSTACK);
  });

  if (dead.length) {
    flagged += dead.length;
    console.log(file);
    dead.forEach((d) => console.log("    {" + d + " && ...} — nothing passes `" + d + "`"));
  }
}

console.log(
  "\n" + checked + " components with gated regions, " + flagged + " gated on a prop no caller passes"
);
process.exit(flagged ? 1 : 0);
