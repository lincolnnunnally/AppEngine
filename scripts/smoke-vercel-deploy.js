import fs from "node:fs";
import path from "node:path";
import { projectNameFromSlug, vercelDeployConfigured } from "../src/lib/engine/vercel-deploy.ts";

// Smoke for the Vercel deploy module (proven end-to-end against the live API in
// development). Runtime-tests the safe pure bits + asserts the proven steps are wired.
// Run: node scripts/smoke-vercel-deploy.js
const repoRoot = process.cwd();

runStep("project names are valid Vercel slugs and unique", () => {
  const a = projectNameFromSlug("Visitor Follow-Up Tracker!!");
  const b = projectNameFromSlug("Visitor Follow-Up Tracker!!");
  if (!/^[a-z0-9-]+$/.test(a)) throw new Error(`invalid slug chars: ${a}`);
  if (a.length > 90) throw new Error("slug too long");
  if (a.startsWith("-") || a.endsWith("-")) throw new Error("slug edge hyphen");
  if (a === b) throw new Error("expected a unique suffix per call");
  if (!projectNameFromSlug("").startsWith("wesucceed-")) throw new Error("empty slug should still produce a name");
});

runStep("deploy is dormant without a token", () => {
  const had = process.env.VERCEL_TOKEN;
  delete process.env.VERCEL_TOKEN;
  if (vercelDeployConfigured() !== false) throw new Error("should be false without a token");
  if (had) process.env.VERCEL_TOKEN = had;
});

runStep("module wires the proven deploy steps + both gotchas", () => {
  const text = read("src/lib/engine/vercel-deploy.ts");
  assertIncludes(text, "x-vercel-digest", "uploads files by sha");
  assertIncludes(text, "/v13/deployments", "creates the deployment/project");
  assertIncludes(text, "nextjs", "nextjs framework");
  assertIncludes(text, "ssoProtection", "disables deployment protection (public URL)");
  assertIncludes(text, "getDeploymentState", "async status polling (builds exceed function limits)");
});

console.log("vercel-deploy smoke ok");

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
