import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("real Opportunity result review is a first-class artifact", () => {
  assertFileIncludes("src/lib/engine/real-opportunity-result-review.ts", [
    "kind: \"real_opportunity_result_review\"",
    "RealOpportunityResultReviewStatus",
    "createRealOpportunityResultReview",
    "listRealOpportunityResultReviews",
    "getAppEngineStateAdapter"
  ]);
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", [
    "\"real_opportunity_result_review\"",
    "Real Opportunity Result Review"
  ]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["\"real_opportunity_result_review\""]);
});

runStep("review supports required owner statuses and notes", () => {
  assertFileIncludes("src/lib/engine/real-opportunity-result-review.ts", [
    "\"useful\"",
    "\"needs_clarification\"",
    "\"wrong_direction\"",
    "\"missing_requirement\"",
    "\"ready_for_next_appengine_action\"",
    "ownerNotes"
  ]);
});

runStep("review snapshots the complete Opportunity result", () => {
  assertFileIncludes("src/lib/engine/real-opportunity-result-review.ts", [
    "originalProblemOrVision",
    "clarification",
    "solutionPath",
    "actionPlan",
    "appEngineCandidate",
    "packetDraftBridgeState",
    "nextSafeAction"
  ]);
});

runStep("review updates memory and writes audit trail", () => {
  assertFileIncludes("src/lib/engine/project-memory.ts", [
    "updateProjectMemoryFromRealOpportunityResultReview",
    "Real Opportunity result is ready for the next AppEngine action",
    "Owner approved a real Opportunity result as ready"
  ]);
  assertFileIncludes("src/lib/engine/audit-trail-lite.ts", ["\"real_opportunity_result_reviewed\""]);
  assertFileIncludes("src/lib/engine/real-opportunity-result-review.ts", [
    "getAppEngineAuditTrail().append",
    "real_opportunity_result_reviewed"
  ]);
});

runStep("portfolio state can reflect ready review", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "listRealOpportunityResultReviews",
    "real Opportunity result reviewed · ready for next AppEngine action",
    "real_opportunity_result_review",
    "continue_internal_trial"
  ]);
});

runStep("owner-gated API saves and lists reviews", () => {
  assertFileIncludes("src/app/api/real-opportunity-result-review/route.ts", [
    "canAccessEngineAdmin",
    "createRealOpportunityResultReview",
    "listRealOpportunityResultReviews",
    "updateProjectMemoryFromRealOpportunityResultReview",
    "finalPacketCreationBlocked"
  ]);
});

runStep("Owner Control Center shows result review step", () => {
  assertFileIncludes("src/app/owner-control-center/page.tsx", [
    "listRealOpportunityResultReviews",
    "initialRealOpportunityResultReviews"
  ]);
  assertFileIncludes("src/components/opportunity-intake/owner-opportunity-queue.tsx", [
    "real-opportunity-result-review",
    "Save Result Review",
    "Original problem/vision",
    "Clarification",
    "Solution path",
    "Action plan",
    "AppEngine candidate",
    "Packet draft bridge state",
    "Copyable Next AppEngine Prompt"
  ]);
});

runStep("guardrails block unsafe automation", () => {
  assertFileIncludes("src/lib/engine/real-opportunity-result-review.ts", [
    "noFinalPacketCreated",
    "noCodexAutoExecution",
    "noGitHubIssueCreation",
    "noLabelChanges",
    "noProductionDeploy",
    "noPaidResources",
    "noLiveMigrations",
    "noSecretsOrEnvChanges",
    "repositoryVisibilityUnchanged"
  ]);
  assertFileExcludes("src/lib/engine/real-opportunity-result-review.ts", [
    "ai:build",
    "gh issue create",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

runStep("styles and package script are wired", () => {
  assertFileIncludes("src/app/styles.css", [
    ".real-opportunity-result-review",
    ".real-opportunity-review-grid",
    ".real-opportunity-review-form",
    ".real-opportunity-review-output"
  ]);
  assertFileIncludes("package.json", ["\"smoke:real-opportunity-result-review\""]);
});

console.log("real-opportunity-result-review smoke ok");

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
