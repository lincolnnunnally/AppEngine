import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("readiness report is a first-class build-loop artifact", () => {
  assertFileIncludes("src/lib/engine/build-loop-controlled-use-readiness.ts", [
    "kind: \"build_loop_controlled_use_readiness\"",
    "BuildLoopControlledUseReadinessStatus",
    "loadBuildLoopControlledUseReadiness",
    "buildLoopControlledUseReadinessGuardrails"
  ]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["\"build_loop_controlled_use_readiness\""]);
});

runStep("report verifies the complete build-loop evidence path", () => {
  assertFileIncludes("src/lib/engine/build-loop-controlled-use-readiness.ts", [
    "\"source_request\"",
    "\"packet_draft\"",
    "\"build_execution_request\"",
    "\"exported_builder_handoff\"",
    "\"builder_result_intake\"",
    "\"verification_review\"",
    "\"portfolio_update\"",
    "\"project_memory_update\"",
    "\"audit_trail_update\""
  ]);
});

runStep("readiness statuses match controlled build-use requirements", () => {
  assertFileIncludes("src/lib/engine/build-loop-controlled-use-readiness.ts", [
    "\"ready_for_internal_controlled_build_use\"",
    "\"blocked_for_autonomous_build_execution\"",
    "\"blocked_for_public_customer_use\"",
    "Build workflow evidence is complete enough for internal controlled use with owner review."
  ]);
});

runStep("exact remaining blockers are listed", () => {
  assertFileIncludes("src/lib/engine/build-loop-controlled-use-readiness.ts", [
    "\"Codex/GitHub execution still manual\"",
    "\"stable public review URLs missing\"",
    "\"durable production persistence not activated\"",
    "\"production auth/env confirmation needed\"",
    "\"privacy/data retention not finalized\""
  ]);
});

runStep("next operational action is one real Life Produces Life build request", () => {
  assertFileIncludes("src/lib/engine/build-loop-controlled-use-readiness.ts", [
    "run_one_real_life_produces_life_build_request_through_completed_build_loop",
    "Run one real Life Produces Life build request through the completed AppEngine build loop.",
    "source request through packet draft, build execution request, exported builder handoff"
  ]);
});

runStep("Owner Control Center renders the readiness panel", () => {
  assertFileIncludes("src/app/owner-control-center/page.tsx", [
    "BuildLoopControlledUseReadinessPanel",
    "loadBuildLoopControlledUseReadiness",
    "buildLoopControlledUseReadiness"
  ]);
  assertFileIncludes("src/components/engine/build-loop-controlled-use-readiness-panel.tsx", [
    "build-loop-controlled-use-readiness",
    "Controlled-use status for AppEngine build workflow",
    "Build loop confirmation",
    "Exact blockers before autonomous/public use",
    "Copyable next operational action"
  ]);
});

runStep("readiness derives from existing build-loop, portfolio, memory, and audit state", () => {
  assertFileIncludes("src/lib/engine/build-loop-controlled-use-readiness.ts", [
    "loadBuildLoopCompletionDashboard",
    "listBuildExecutionRequests",
    "loadOwnerPortfolioRegistry",
    "loadProjectMemory",
    "getAppEngineAuditTrail().list()"
  ]);
});

runStep("guardrails preserve controlled-use boundaries", () => {
  assertFileIncludes("src/lib/engine/build-loop-controlled-use-readiness.ts", [
    "noCodexAutoExecution",
    "noGitHubIssueCreation",
    "noLabelChanges",
    "noProductionDeploy",
    "noPaidResources",
    "noLiveMigrations",
    "noSecretsOrEnvChanges",
    "repositoryVisibilityUnchanged"
  ]);
  assertFileExcludes("src/lib/engine/build-loop-controlled-use-readiness.ts", [
    "gh issue create",
    "ai:build",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

runStep("styles and package script are wired", () => {
  assertFileIncludes("src/app/styles.css", [
    ".build-loop-controlled-use-readiness",
    ".readiness-status-card.ready_for_internal_controlled_build_use"
  ]);
  assertFileIncludes("package.json", ["\"smoke:build-loop-controlled-use-readiness\""]);
});

console.log("build-loop-controlled-use-readiness smoke ok");

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
