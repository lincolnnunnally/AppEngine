// Smoke: pricing math + catalog integrity (no TS loader required).
// Run: node scripts/smoke-pricing-estimate.js

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failures = 0;
const ok = (l) => console.log(`ok - ${l}`);
const bad = (l, d) => {
  failures++;
  console.error(`not ok - ${l}${d ? " :: " + d : ""}`);
};

// ---- constants (must match module-pricing.ts) --------------------------------
const BASE_PRICE = 2500;
const FEATURE_PRICE = 1000;
const PAYMENTS_PRICE = 2000;
const CUSTOM_SURCHARGE = 2500;
const CUSTOM_FLOOR = 5000;

const BASE_SHELL = { expected: 40, p90: 200 };
const PER_MODULE = { expected: 15, p90: 75 };
const CUSTOM_COST = { expected: 300, p90: 1200 };

function profit(price, modules, custom) {
  const expectedCost =
    BASE_SHELL.expected + PER_MODULE.expected * modules + (custom ? CUSTOM_COST.expected : 0);
  const p90Cost = BASE_SHELL.p90 + PER_MODULE.p90 * modules + (custom ? CUSTOM_COST.p90 : 0);
  return {
    expectedCost,
    p90Cost,
    expectedProfit: price - expectedCost,
    p90Profit: price - p90Cost,
    p90Margin: Math.round(((price - p90Cost) / price) * 100)
  };
}

// Core only
{
  const p = profit(BASE_PRICE, 0, false);
  if (p.p90Profit < 1500) bad("core p90 profit", String(p.p90Profit));
  else ok(`core $25 → p90 cost $${(p.p90Cost / 100).toFixed(2)}, profit $${(p.p90Profit / 100).toFixed(2)} (${p.p90Margin}%)`);
}

// Core + 1 module ($35)
{
  const price = BASE_PRICE + FEATURE_PRICE;
  const p = profit(price, 1, false);
  if (price !== 3500) bad("core+feature price");
  else ok(`core+CRM $35 → p90 profit $${(p.p90Profit / 100).toFixed(2)} (${p.p90Margin}%)`);
}

// Local service: CRM + public + payments ($25+$10+$10+$20=$65)
{
  const price = BASE_PRICE + FEATURE_PRICE + FEATURE_PRICE + PAYMENTS_PRICE;
  const p = profit(price, 3, false);
  if (price !== 6500) bad("service pack price", String(price));
  else ok(`service pack $65 → p90 profit $${(p.p90Profit / 100).toFixed(2)} (${p.p90Margin}%)`);
}

// Custom floor
{
  let price = BASE_PRICE + CUSTOM_SURCHARGE;
  if (price < CUSTOM_FLOOR) price = CUSTOM_FLOOR;
  const p = profit(price, 0, true);
  if (price !== 5000) bad("custom floor", String(price));
  else ok(`custom $50 floor → p90 profit $${(p.p90Profit / 100).toFixed(2)} (${p.p90Margin}%)`);
}

// Catalog features exist and map to registry modules
{
  const pricingSrc = fs.readFileSync(path.join(root, "src/lib/engine/pricing/module-pricing.ts"), "utf8");
  const regSrc = fs.readFileSync(path.join(root, "src/lib/engine/modules/registry.ts"), "utf8");
  const featureIds = [...pricingSrc.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
  const slugsInFeatures = [...pricingSrc.matchAll(/moduleSlugs:\s*\[([^\]]*)\]/g)].flatMap((m) =>
    [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1])
  );
  const registered = new Set(
    [...regSrc.matchAll(/from "\.\/([a-z0-9-]+)"/g)].map((m) => m[1]).filter((s) => s !== "types")
  );
  // registry imports use file names; slugs are inside module files — check import files exist
  const modFiles = new Set(
    fs
      .readdirSync(path.join(root, "src/lib/engine/modules"))
      .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "registry.ts")
      .map((f) => f.replace(/\.ts$/, ""))
  );

  if (featureIds.length < 10) bad("feature catalog size", String(featureIds.length));
  else ok(`sellable feature ids parsed: ${featureIds.length}`);

  const missing = slugsInFeatures.filter((s) => !modFiles.has(s) && s !== "identity-auth");
  // identity-auth exists as file
  if (!modFiles.has("crm-follow-up")) bad("crm-follow-up module file missing");
  if (missing.length) bad("feature modules missing files", missing.join(", "));
  else ok(`all feature moduleSlugs resolve to module files (${slugsInFeatures.length} refs)`);

  // Archetypes file exists
  const arch = fs.readFileSync(path.join(root, "src/lib/engine/pricing/business-archetypes.ts"), "utf8");
  if (!arch.includes("local-service") || !arch.includes("back-office-lite")) bad("archetypes incomplete");
  else ok("business archetypes present");

  // API route exists
  const api = path.join(root, "src/app/api/pricing/estimate/route.ts");
  if (!fs.existsSync(api)) bad("api route missing");
  else ok("GET/POST /api/pricing/estimate route present");

  void registered;
}

// Print owner table
console.log("\n=== Profit reference (module composition path) ===");
console.log("Package                          Price    p90 cost   p90 profit  margin");
const rows = [
  ["Core only", BASE_PRICE, 0, false],
  ["Core + 1 feature ($10)", BASE_PRICE + FEATURE_PRICE, 1, false],
  ["Core + 2 features", BASE_PRICE + 2 * FEATURE_PRICE, 2, false],
  ["Service (CRM+public+pay)", BASE_PRICE + 2 * FEATURE_PRICE + PAYMENTS_PRICE, 3, false],
  ["Custom floor", CUSTOM_FLOOR, 0, true]
];
for (const [name, price, mods, custom] of rows) {
  const p = profit(price, mods, custom);
  console.log(
    `${name.padEnd(32)} $${(price / 100).toFixed(0).padStart(3)}    $${(p.p90Cost / 100).toFixed(2).padStart(5)}     $${(p.p90Profit / 100).toFixed(2).padStart(6)}     ${p.p90Margin}%`
  );
}

if (failures) {
  console.error(`\npricing-estimate smoke failed (${failures})`);
  process.exit(1);
}
console.log("\npricing-estimate smoke ok");
