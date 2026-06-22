import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("loop doctrine is adopted as source of truth", () => {
  assertFileIncludes("APPENGINE_LOOP_SYSTEM.md", [
    "Acceptance criteria are defined at intake",
    "Circuit breaker: max 3 build -> test -> review cycles per run",
    "Issue #139 is open",
    "PRs #155 through #160 are merged",
    "Do not skip stage 1"
  ]);
  assertFileIncludes("agents/manifest.yaml", ["APPENGINE_LOOP_SYSTEM.md"]);
  assertFileIncludes("agents/context/source-of-truth.md", [
    "APPENGINE_LOOP_SYSTEM.md",
    "Active Loop Run Record"
  ]);
});

runStep("manual run records are versioned in the repo", () => {
  assertFileIncludes("loop-runs/RUN_RECORD_TEMPLATE.md", [
    "acceptance_criteria",
    "cycle_count",
    "max_cycles: 3",
    "no_codex_auto_execution: true"
  ]);
  assertFileIncludes("loop-runs/2026-06-21-internal-appengine-intake-page-cycle-1.md", [
    "Create a tiny internal AppEngine intake page",
    "User can enter app idea",
    "System saves a loop run record",
    "no_pull_request_creation: true"
  ]);
});

runStep("owner-only loop intake captures scoped records", () => {
  assertFileIncludes("src/app/(cockpit)/loop-intake/page.tsx", [
    "canAccessEngineAdmin",
    "LoopIntakeForm",
    "listAppEngineLoopRunRecords"
  ]);
  assertFileIncludes("src/components/engine/loop-intake-form.tsx", [
    "data-testid=\"loop-intake-page\"",
    "App idea",
    "Problem being solved",
    "Target user",
    "Acceptance criteria",
    "Save scoped run",
    "cycle_count 0"
  ]);
  assertFileIncludes("src/app/api/engine/loop-runs/route.ts", [
    "canAccessEngineAdmin",
    "createAppEngineLoopRunRecord",
    "Cache-Control"
  ]);
});

runStep("loop store keeps automation blocked", () => {
  assertFileIncludes("src/lib/engine/loop-run-records.ts", [
    "status: \"scoped\"",
    "cycleCount: 0",
    "maxCycles: 3",
    "noPullRequestCreation",
    "noThinRouterScript",
    "noEventTriggeredAutomation",
    "ownerReviewRequiredBeforeBuild"
  ]);
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", ["loop_run_records"]);
  assertFileExcludes("src/lib/engine/loop-run-records.ts", [
    "gh issue create",
    "vercel deploy --prod",
    "ai:build",
    "ai:fix"
  ]);
});

console.log("appengine-loop-system smoke ok");

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function assertFileIncludes(relativePath, expectedValues) {
  const content = readFile(relativePath);

  for (const expected of expectedValues) {
    if (!content.includes(expected)) {
      throw new Error(`${relativePath} should include ${JSON.stringify(expected)}`);
    }
  }
}

function assertFileExcludes(relativePath, blockedValues) {
  const content = readFile(relativePath);

  for (const blocked of blockedValues) {
    if (content.includes(blocked)) {
      throw new Error(`${relativePath} should not include ${JSON.stringify(blocked)}`);
    }
  }
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}
