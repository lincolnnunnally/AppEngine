import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("build execution request artifact uses existing prepared handoffs and packet drafts", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "build_execution_request",
    "listHandoffRelaySummaries",
    "listFirstRealEcosystemBuildRequests",
    "listFirstEcosystemBuildPacketDrafts",
    "opportunity_ready_appengine_handoff",
    "first_ecosystem_build_request_handoff",
    "first_ecosystem_build_packet_draft",
    "handoff_inbox"
  ]);
});

runStep("request includes required owner-visible execution fields", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "sourceHandoff",
    "sourcePacketDraft",
    "targetProjectSlice",
    "requestedWork",
    "guardrails",
    "verificationCommands",
    "expectedResult",
    "ownerApprovalStatus",
    "executionStatus"
  ]);
});

runStep("execution status model is present", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "draft",
    "owner_approved",
    "ready_for_builder",
    "builder_running_external",
    "result_received",
    "verification_needed",
    "completed",
    "blocked"
  ]);
});

runStep("connector updates memory, audit trail, and portfolio", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "updateProjectMemoryFromBuildExecutionRequest",
    "getAppEngineAuditTrail().append",
    "build_execution_request_created"
  ]);
  assertFileIncludes("src/lib/engine/project-memory.ts", [
    "updateProjectMemoryFromBuildExecutionRequest",
    "Build execution request drafted"
  ]);
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "listBuildExecutionRequests",
    "build execution request",
    "build_execution_request"
  ]);
});

runStep("owner-gated API exposes sources and creates draft requests", () => {
  assertFileIncludes("src/app/api/engine/build-execution-request/route.ts", [
    "canAccessEngineAdmin",
    "listBuildExecutionHandoffSources",
    "listBuildExecutionRequests",
    "createBuildExecutionRequest",
    "codexAutoExecutionBlocked",
    "githubIssueCreationBlocked",
    "labelChangesBlocked"
  ]);
});

runStep("Owner Control Center shows Create Build Execution Request action", () => {
  assertFileIncludes("src/components/engine/build-execution-request-panel.tsx", [
    "build-execution-request-panel",
    "Create Build Execution Request",
    "build-execution-source-card",
    "build-execution-request-output",
    "Execution status",
    "Owner approval",
    "Source packet draft"
  ]);
  assertFileIncludes("src/app/owner-control-center/page.tsx", [
    "BuildExecutionRequestPanel",
    "listBuildExecutionHandoffSources",
    "listBuildExecutionRequests"
  ]);
});

runStep("guardrails block unsafe automation and infrastructure changes", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "noCodexAutoExecution",
    "noGitHubIssueCreation",
    "noLabelChanges",
    "noProductionDeploy",
    "noPaidResources",
    "noLiveMigrations",
    "noSecretsOrEnvChanges",
    "repositoryVisibilityUnchanged"
  ]);
  assertFileExcludes("src/lib/engine/build-execution-request.ts", [
    "gh issue create",
    "ai:build",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

runStep("state, audit type, package script, and styles are wired", () => {
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", ["build_execution_requests"]);
  assertFileIncludes("src/lib/engine/audit-trail-lite.ts", ["build_execution_request_created"]);
  assertFileIncludes("package.json", ["\"smoke:build-execution-request\""]);
  assertFileIncludes("src/app/styles.css", [
    ".build-execution-request-panel",
    ".build-execution-layout",
    ".build-execution-request-card"
  ]);
});

console.log("build-execution-request smoke ok");

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
