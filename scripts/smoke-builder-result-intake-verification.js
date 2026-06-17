import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("builder result intake artifact and statuses are defined", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "builder_result_intake",
    "BuildExecutionBuilderResultIntake",
    "BuildExecutionBuilderResultStatus",
    "intakeBuilderResult",
    "result_received",
    "verification_needed",
    "completed",
    "blocked"
  ]);
});

runStep("builder result parser stores required result fields", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "parseBuilderResult",
    "extractPrNumber",
    "extractBranch",
    "extractChangedFiles",
    "extractVerificationCommandsRun",
    "extractBlockers",
    "extractReviewUrl",
    "followUpPrompt"
  ]);
});

runStep("owner-gated API accepts result intake without unsafe actions", () => {
  assertFileIncludes("src/app/api/engine/build-execution-request/route.ts", [
    "intakeBuilderResult",
    "action === \"result\"",
    "builderResult",
    "canAccessEngineAdmin"
  ]);
});

runStep("Owner Control Center exposes Builder Result Intake", () => {
  assertFileIncludes("src/components/engine/build-execution-request-panel.tsx", [
    "builder-result-intake-section",
    "Import Builder Result",
    "builder-result-intake-output",
    "changedFiles",
    "followUpPrompt",
    "reviewUrl"
  ]);
});

runStep("portfolio, memory, and audit trail update from builder result", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "latestBuilderResult",
    "builder result",
    "executionStatus"
  ]);
  assertFileIncludes("src/lib/engine/project-memory.ts", [
    "updateProjectMemoryFromBuilderResultIntake",
    "Builder result",
    "verification review"
  ]);
  assertFileIncludes("src/lib/engine/audit-trail-lite.ts", ["builder_result_intake_received"]);
});

runStep("guardrails block auto-merge, Codex, issues, labels, and deploys", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "noAutoMerge",
    "noCodexAutoExecution",
    "noGitHubIssueCreation",
    "noLabelChanges",
    "noProductionDeploy"
  ]);
  assertFileExcludes("src/lib/engine/build-execution-request.ts", [
    "gh pr merge",
    "gh issue create",
    "ai:build",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

runStep("package script is wired", () => {
  assertFileIncludes("package.json", ["\"smoke:builder-result-intake-verification\""]);
});

console.log("builder-result-intake-verification smoke ok");

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
