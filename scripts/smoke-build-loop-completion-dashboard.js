import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("build loop completion artifact is derived from existing build execution state", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "build_loop_completion_dashboard",
    "BuildLoopCompletionDashboard",
    "BuildLoopStepStatus",
    "loadBuildLoopCompletionDashboard",
    "createBuildLoopCompletionDashboard",
    "source_request",
    "packet_draft",
    "build_execution_request",
    "exported_builder_handoff",
    "builder_result_received",
    "verification_status",
    "portfolio_update",
    "next_safe_action"
  ]);
});

runStep("build loop uses required step statuses and safe next action logic", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "\"not_started\"",
    "\"ready\"",
    "\"in_progress\"",
    "\"blocked\"",
    "\"completed\"",
    "determineBuildLoopNextSafeAction",
    "buildLoopCopyableNextActionPrompt",
    "derivedFromExistingStateOnly",
    "noParallelTracker"
  ]);
});

runStep("terminal build loop state updates memory and audit trail", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "updateProjectMemoryFromBuildLoopCompletion",
    "build_loop_completion_recorded",
    "updated.executionStatus === \"completed\" || updated.executionStatus === \"blocked\""
  ]);
  assertFileIncludes("src/lib/engine/project-memory.ts", [
    "updateProjectMemoryFromBuildLoopCompletion",
    "Build loop completed",
    "Build loop blocked",
    "build-loop-completion"
  ]);
  assertFileIncludes("src/lib/engine/audit-trail-lite.ts", ["build_loop_completion_recorded"]);
});

runStep("Owner Control Center renders the build loop dashboard", () => {
  assertFileIncludes("src/app/(cockpit)/owner-control-center/page.tsx", [
    "BuildLoopCompletionDashboardPanel",
    "loadBuildLoopCompletionDashboard",
    "buildLoopCompletionDashboard"
  ]);
  assertFileIncludes("src/components/engine/build-loop-completion-dashboard-panel.tsx", [
    "data-testid=\"build-loop-completion-dashboard\"",
    "Project / slice",
    "Source request",
    "Packet draft",
    "Review URL",
    "Verification",
    "Next safe action",
    "data-testid=\"build-loop-copyable-next-action\"",
    "Safety state"
  ]);
});

runStep("styles keep the dashboard owner-readable and phone-friendly", () => {
  assertFileIncludes("src/app/styles.css", [
    "build-loop-completion-dashboard",
    "build-loop-summary-grid",
    "build-loop-step-grid",
    "build-loop-status-completed",
    "build-loop-status-blocked",
    "guardrail-list.warning"
  ]);
});

runStep("guardrails avoid external execution, issue creation, labels, deploys, and merges", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "noAutoMerge",
    "noCodexAutoExecution",
    "noGitHubIssueCreation",
    "noLabelChanges",
    "noProductionDeploy",
    "noPaidResources",
    "noLiveMigrations",
    "noSecretsOrEnvChanges"
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
  assertFileIncludes("package.json", ["\"smoke:build-loop-completion-dashboard\""]);
});

console.log("build-loop-completion-dashboard smoke ok");

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
