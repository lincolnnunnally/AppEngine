import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("first real build result intake wraps existing builder result parser", () => {
  assertFileIncludes("src/lib/engine/first-real-build-loop-run.ts", [
    "kind: \"first_real_build_result_intake\"",
    "intakeFirstRealBuildResult",
    "intakeBuilderResult",
    "BuildExecutionBuilderResultIntake",
    "summarizeFirstRealBuildResult",
    "createFirstRealBuildVerificationReview"
  ]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["\"first_real_build_result_intake\""]);
});

runStep("result intake tracks required builder result fields", () => {
  assertFileIncludes("src/lib/engine/first-real-build-loop-run.ts", [
    "prNumber",
    "branch",
    "changedFiles",
    "verificationCommandsRun",
    "passFailStatus",
    "blockers",
    "reviewUrl",
    "nextSafeAction",
    "lifeCoreSliceReviewReady"
  ]);
});

runStep("owner-gated first build loop API imports pasted results", () => {
  assertFileIncludes("src/app/api/first-real-build-loop-run/route.ts", [
    "canAccessEngineAdmin",
    "action === \"result\"",
    "intakeFirstRealBuildResult",
    "resultText",
    "records: await listFirstRealBuildLoopRuns()"
  ]);
});

runStep("Owner Control Center exposes Paste First Build Result", () => {
  assertFileIncludes("src/components/engine/first-real-build-loop-run-panel.tsx", [
    "Paste First Build Result",
    "Import first build result",
    "first-real-build-result-intake",
    "first-real-build-result-summary",
    "Life Core review-ready",
    "failedOrMissingVerification"
  ]);
});

runStep("project memory, portfolio, build loop dashboard, and audit trail are updated", () => {
  assertFileIncludes("src/lib/engine/first-real-build-loop-run.ts", [
    "loadOwnerPortfolioRegistry",
    "loadProjectMemory",
    "updateProjectMemoryFromFirstRealBuildResultIntake",
    "first_real_build_result_intake_received"
  ]);
  assertFileIncludes("src/lib/engine/project-memory.ts", [
    "updateProjectMemoryFromFirstRealBuildResultIntake",
    "First real Life Core builder output is imported",
    "Life Core review-ready"
  ]);
  assertFileIncludes("src/lib/engine/audit-trail-lite.ts", ["first_real_build_result_intake_received"]);
});

runStep("result intake keeps unsafe actions blocked", () => {
  assertFileIncludes("src/lib/engine/first-real-build-loop-run.ts", [
    "autoMerged: false",
    "codexTriggered: false",
    "githubIssuesCreated: false",
    "labelsApplied: false",
    "productionDeployed: false",
    "paidResourcesCreated: false",
    "migrationsApplied: false",
    "secretsOrEnvChanged: false"
  ]);
  assertFileExcludes("src/lib/engine/first-real-build-loop-run.ts", [
    "gh pr merge",
    "gh issue create",
    "ai:build",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

runStep("styles and package script are wired", () => {
  assertFileIncludes("src/app/styles.css", [
    ".first-real-build-result-intake",
    ".first-real-build-result-summary",
    ".first-real-build-loop-step.needs_verification"
  ]);
  assertFileIncludes("package.json", ["\"smoke:first-real-build-result-intake\""]);
});

console.log("first-real-build-result-intake smoke ok");

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
