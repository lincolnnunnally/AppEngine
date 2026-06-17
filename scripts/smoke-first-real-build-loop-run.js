import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("first real build loop run uses existing Life Core packet and build execution systems", () => {
  assertFileIncludes("src/lib/engine/first-real-build-loop-run.ts", [
    "kind: \"first_real_build_loop_run\"",
    "listFirstRealEcosystemBuildRequests",
    "runFirstRealEcosystemBuildRequest",
    "listFirstEcosystemBuildPacketDrafts",
    "createFirstEcosystemBuildPacketDraft",
    "createBuildExecutionRequest",
    "reviewBuildExecutionRequest",
    "Life Produces Life Core",
    "United Under God ecosystem foundation"
  ]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["\"first_real_build_loop_run\""]);
});

runStep("run tracks every required build-loop step", () => {
  assertFileIncludes("src/lib/engine/first-real-build-loop-run.ts", [
    "\"source_request\"",
    "\"packet_draft\"",
    "\"build_execution_request\"",
    "\"exported_builder_handoff\"",
    "\"builder_result_intake_placeholder\"",
    "\"verification_review_placeholder\"",
    "\"portfolio_update\"",
    "\"project_memory_update\"",
    "\"audit_trail_update\""
  ]);
});

runStep("run stops at builder output and exposes exact builder prompt", () => {
  assertFileIncludes("src/lib/engine/first-real-build-loop-run.ts", [
    "waiting_on_builder_output",
    "exactBuilderPrompt",
    "copy_builder_prompt_and_wait_for_builder_result",
    "Builder result intake is waiting for Lincoln to paste the builder/Codex result",
    "Verification review is waiting for builder output"
  ]);
});

runStep("owner-gated API prepares the run without unsafe actions", () => {
  assertFileIncludes("src/app/api/first-real-build-loop-run/route.ts", [
    "canAccessEngineAdmin",
    "runFirstRealBuildLoopRun",
    "listFirstRealBuildLoopRuns",
    "codexAutoExecutionBlocked",
    "githubIssueCreationBlocked",
    "labelChangesBlocked"
  ]);
});

runStep("Owner Control Center renders the first real build loop run panel", () => {
  assertFileIncludes("src/app/owner-control-center/page.tsx", [
    "FirstRealBuildLoopRunPanel",
    "listFirstRealBuildLoopRuns",
    "firstRealBuildLoopRuns"
  ]);
  assertFileIncludes("src/components/engine/first-real-build-loop-run-panel.tsx", [
    "first-real-build-loop-run",
    "Prepare first build loop run",
    "Build loop steps",
    "Exact builder prompt",
    "No Codex auto-execution"
  ]);
});

runStep("project memory and audit trail update from the run", () => {
  assertFileIncludes("src/lib/engine/project-memory.ts", [
    "updateProjectMemoryFromFirstRealBuildLoopRun",
    "First real Life Produces Life build loop run prepared",
    "waiting on builder output"
  ]);
  assertFileIncludes("src/lib/engine/audit-trail-lite.ts", ["first_real_build_loop_run_prepared"]);
  assertFileIncludes("src/lib/engine/first-real-build-loop-run.ts", [
    "updateProjectMemoryFromFirstRealBuildLoopRun",
    "first_real_build_loop_run_prepared"
  ]);
});

runStep("styles and package script are wired", () => {
  assertFileIncludes("src/app/styles.css", [
    ".first-real-build-loop-run",
    ".first-real-build-loop-step-grid",
    ".first-real-build-loop-step.waiting_on_builder_output"
  ]);
  assertFileIncludes("package.json", ["\"smoke:first-real-build-loop-run\""]);
});

runStep("guardrails block Codex execution, GitHub issues, labels, deploys, migrations, and env changes", () => {
  assertFileIncludes("src/lib/engine/first-real-build-loop-run.ts", [
    "noCodexAutoExecution",
    "noGitHubIssueCreation",
    "noLabelChanges",
    "noProductionDeploy",
    "noPaidResources",
    "noLiveMigrations",
    "noSecretsOrEnvChanges",
    "repositoryVisibilityUnchanged"
  ]);
  assertFileExcludes("src/lib/engine/first-real-build-loop-run.ts", [
    "gh issue create",
    "ai:build",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

console.log("first-real-build-loop-run smoke ok");

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
