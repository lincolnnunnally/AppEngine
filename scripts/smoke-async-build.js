import fs from "node:fs";
import path from "node:path";

// Structural smoke for the async build orchestration (kick off -> generate ->
// deploy -> poll -> live URL). Run: node scripts/smoke-async-build.js
const repoRoot = process.cwd();

runStep("build jobs are durable (DB) with an in-memory fallback for local dev", () => {
  const text = read("src/lib/engine/build-jobs.ts");
  assertIncludes(text, "CREATE TABLE IF NOT EXISTS app_build_jobs", "self-applying jobs table");
  assertIncludes(text, "new Map", "in-memory fallback for local");
  for (const s of ["building", "deploying", "live", "failed"]) assertIncludes(text, s, `status ${s}`);
  assertIncludes(text, "getConfiguredDatabaseUrl()", "DB when available");
});

runStep("start route returns a job id fast and runs the work after responding", () => {
  const text = read("src/app/api/build/start/route.ts");
  assertIncludes(text, "createBuildJob", "creates a job");
  assertIncludes(text, "after(", "heavy work runs after the response");
  assertIncludes(text, "runCustomerBuildJob", "background worker");
  assertIncludes(text, "maxDuration", "uses the function budget");
  assertIncludes(text, "canAccessEngineConsumerSurface", "sign-in gated");
});

runStep("worker generates the real app then deploys it live", () => {
  const text = read("src/lib/engine/customer-build.ts");
  assertIncludes(text, "runCustomerBuildJob", "worker exists");
  assertIncludes(text, "readGeneratedBundle", "reads the generated files");
  assertIncludes(text, "deployGeneratedAppToVercel", "deploys them live");
  assertIncludes(text, "updateBuildJob", "advances the job state");
});

runStep("status route polls the deploy and flips to live with the URL", () => {
  const text = read("src/app/api/build/status/route.ts");
  assertIncludes(text, "getDeploymentState", "checks the Vercel build");
  assertIncludes(text, '"live"', "flips to live");
  assertIncludes(text, "job.userEmail !== userKey", "owner-scoped");
});

runStep("a building experience UI polls to a live link", () => {
  const text = read("src/components/build/build-experience.tsx");
  assertIncludes(text, "/api/build/start", "starts a build");
  assertIncludes(text, "/api/build/status", "polls status");
  assertIncludes(text, "Build it", "build action");
});

console.log("async-build smoke ok");

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
