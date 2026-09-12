import fs from "node:fs";
import path from "node:path";

// Generated apps must not present fabricated people as real (DC-1).
// Billing stays off until a live starter is proven (DC-4).
const root = process.cwd();

const banned = ["Ada Lovelace", "Dana Cole", "Marta H.", "customer@example.com"];
const dir = path.join(root, "src/lib/engine/modules");
let hits = 0;
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".ts")) continue;
  const text = fs.readFileSync(path.join(dir, name), "utf8");
  for (const phrase of banned) {
    if (text.includes(phrase)) {
      hits += 1;
      console.error(`not ok - ${name} still ships fabricated "${phrase}"`);
    }
  }
}
if (hits) process.exit(1);
console.log("ok - no fabricated sample people in module emitters");

const billing = fs.readFileSync(path.join(root, "src/lib/engine/billing.ts"), "utf8");
if (!billing.includes('process.env.APP_ENGINE_BILLING_ENABLED === "true"')) {
  console.error("not ok - billing flag missing");
  process.exit(1);
}
console.log("ok - billing stays off unless explicitly enabled");
console.log("fulfillment-honesty smoke ok");
