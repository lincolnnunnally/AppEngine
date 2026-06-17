import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("build execution request supports owner review and export statuses", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "BuildExecutionRequestReviewStatus",
    "needs_review",
    "owner_approved",
    "blocked",
    "exported_for_builder",
    "reviewBuildExecutionRequest"
  ]);
});

runStep("export artifact contains builder handoff payload", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "build_execution_builder_handoff_export",
    "sourceOpportunityOrEcosystemRequest",
    "sourcePacketDraft",
    "requestedBuildWork",
    "designIntent",
    "guardrails",
    "verificationCommands",
    "expectedResult",
    "exactBuilderPrompt"
  ]);
});

runStep("owner approval exports into Handoff Relay without auto-execution", () => {
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "savePreparedHandoffFromBuildExecutionExport",
    "updateProjectMemoryFromBuildExecutionRequestExport",
    "build_execution_request_exported",
    "codexTriggered: false",
    "githubIssuesCreated: false",
    "labelsApplied: false",
    "productionDeployed: false"
  ]);
  assertFileIncludes("src/lib/engine/handoff-relay.ts", [
    "build_execution_builder_handoff",
    "createPreparedHandoffFromBuildExecutionExport",
    "savePreparedHandoffFromBuildExecutionExport",
    "Prepared builder handoff from Build Execution Request",
    "Exact suggested Codex prompt"
  ]);
});

runStep("Owner Control Center exposes review and export action", () => {
  assertFileIncludes("src/components/engine/build-execution-request-panel.tsx", [
    "build-execution-review-section",
    "Approve + Export Builder Handoff",
    "Mark Blocked",
    "Exported builder prompt",
    "Source packet draft",
    "exportedBuilderHandoff"
  ]);
  assertFileIncludes("src/app/api/engine/build-execution-request/route.ts", [
    "reviewBuildExecutionRequest",
    "action === \"review\"",
    "exportOutput",
    "handoff"
  ]);
});

runStep("portfolio, memory, audit, package, and styles are wired", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "review_exported_builder_handoff",
    "reviewStatus",
    "exported_for_builder"
  ]);
  assertFileIncludes("src/lib/engine/project-memory.ts", [
    "updateProjectMemoryFromBuildExecutionRequestExport",
    "Build execution request exported for builder handoff",
    "Handoff Inbox"
  ]);
  assertFileIncludes("src/lib/engine/audit-trail-lite.ts", [
    "build_execution_request_reviewed",
    "build_execution_request_exported"
  ]);
  assertFileIncludes("package.json", ["\"smoke:build-execution-request-export\""]);
  assertFileIncludes("src/app/styles.css", [".build-execution-review-actions"]);
});

runStep("guardrails still block unsafe automation", () => {
  assertFileExcludes("src/lib/engine/build-execution-request.ts", [
    "gh issue create",
    "ai:build",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

console.log("build-execution-request-export smoke ok");

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
