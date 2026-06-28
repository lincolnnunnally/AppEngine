import fs from "node:fs";
import path from "node:path";

// Structural smoke for the customer build orchestration spine.
// Run: node scripts/smoke-customer-build.js
const repoRoot = process.cwd();

runStep("orchestrates the real pipeline in order and bills around it", () => {
  const text = read("src/lib/engine/customer-build.ts");
  const runIdx = text.indexOf("runProjectAgents(projectId)");
  const genIdx = text.indexOf("generateProjectApp(projectId)");
  const depIdx = text.indexOf("prepareProjectDeployment(projectId)");
  if (!(runIdx > -1 && genIdx > runIdx && depIdx > genIdx)) {
    throw new Error("expected agents -> generate -> prepare-deploy in order");
  }
});

runStep("billing is dormant + charges real metered cost, not a flat fee", () => {
  const text = read("src/lib/engine/customer-build.ts");
  assertIncludes(text, "isBillingEnabled()", "billing gated off by default");
  assertIncludes(text, "canAffordBuild", "affordability checked before build");
  assertIncludes(text, "getLlmUsageTotals", "cost from the metering delta");
  assertIncludes(text, "chargeForBuild", "charges after the build");
  assertIncludes(text, "costAfterUsd - costBeforeUsd", "charge = this build's measured cost");
});

runStep("deploy stays prepare-only (no real deploy executed here)", () => {
  const text = read("src/lib/engine/customer-build.ts");
  // must not call a real deploy executor / Vercel deploy from this spine
  for (const banned of ["vercel deploy", "api.vercel.com", "deployToVercel", "executeDeploy"]) {
    if (text.includes(banned)) throw new Error(`spine must stay prepare-only; found "${banned}"`);
  }
});

console.log("customer-build smoke ok");

function read(p) {
  return fs.readFileSync(path.join(repoRoot, p), "utf8");
}
function assertIncludes(value, phrase, label) {
  if (!String(value).includes(phrase)) throw new Error(`${label}: expected to contain "${phrase}"`);
}
function runStep(label, fn) {
  try {
    fn();
    console.log(`ok - ${label}`);
  } catch (error) {
    console.error(`not ok - ${label}`);
    throw error;
  }
}
