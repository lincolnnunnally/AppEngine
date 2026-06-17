import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("real Opportunity example runner is adapter-backed and first-class", () => {
  assertFileIncludes("src/lib/engine/real-opportunity-example-runner.ts", [
    "kind: \"real_opportunity_example_runner\"",
    "runRealOpportunityExample",
    "listRealOpportunityExamples",
    "RealOpportunityExampleInput",
    "getAppEngineStateAdapter"
  ]);
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", [
    "\"real_opportunity_example_runner\"",
    "Real Opportunity Example Runner"
  ]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["\"real_opportunity_example_runner\""]);
});

runStep("runner accepts owner-entered real problem or vision fields", () => {
  assertFileIncludes("src/lib/engine/real-opportunity-example-runner.ts", [
    "problemOrVision",
    "affectedPeople",
    "betterFuture",
    "barriers",
    "desiredImpact",
    "exampleContext",
    "lincoln_ecosystem",
    "outside_customer_community_leader"
  ]);
});

runStep("runner uses the complete Opportunity controlled-use flow", () => {
  assertFileIncludes("src/lib/engine/real-opportunity-example-runner.ts", [
    "runOpportunityFullLoopTrial",
    "fullLoopTrial",
    "packetBridgeId",
    "steps",
    "missingInformation",
    "nextSafeAction"
  ]);
  assertFileIncludes("src/lib/engine/opportunity-full-loop-trial.ts", [
    "OpportunityFullLoopTrialInput",
    "runOpportunityFullLoopTrial(input"
  ]);
});

runStep("runner writes audit trail and project memory", () => {
  assertFileIncludes("src/lib/engine/real-opportunity-example-runner.ts", [
    "updateProjectMemoryFromRealOpportunityExample",
    "getAppEngineAuditTrail().append",
    "real_opportunity_example_ran"
  ]);
  assertFileIncludes("src/lib/engine/project-memory.ts", [
    "updateProjectMemoryFromRealOpportunityExample",
    "Real Opportunity example reached packet draft readiness",
    "Run real owner-entered Opportunity examples through the existing controlled-use pipeline"
  ]);
  assertFileIncludes("src/lib/engine/audit-trail-lite.ts", ["\"real_opportunity_example_ran\""]);
});

runStep("owner-gated API exposes the runner safely", () => {
  assertFileIncludes("src/app/api/real-opportunity-example-runner/route.ts", [
    "canAccessEngineAdmin",
    "runRealOpportunityExample",
    "listRealOpportunityExamples",
    "finalPacketCreationBlocked",
    "codexAutoExecutionBlocked",
    "githubIssueCreationBlocked",
    "labelChangesBlocked"
  ]);
});

runStep("Owner Control Center exposes the real example flow", () => {
  assertFileIncludes("src/app/owner-control-center/page.tsx", [
    "listRealOpportunityExamples",
    "initialRealOpportunityExamples"
  ]);
  assertFileIncludes("src/components/opportunity-intake/owner-opportunity-queue.tsx", [
    "Run Real Opportunity Example",
    "/api/real-opportunity-example-runner",
    "real-opportunity-example-runner",
    "real-opportunity-example-output",
    "problemOrVision",
    "affectedPeople",
    "betterFuture",
    "barriers",
    "desiredImpact",
    "Step results",
    "Copyable Next Safe Action"
  ]);
});

runStep("guardrails block unsafe automation and deployment", () => {
  assertFileIncludes("src/lib/engine/real-opportunity-example-runner.ts", [
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
  assertFileExcludes("src/lib/engine/real-opportunity-example-runner.ts", [
    "ai:build",
    "gh issue create",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

runStep("styles and package script are wired", () => {
  assertFileIncludes("src/app/styles.css", [
    ".real-opportunity-example-panel",
    ".real-opportunity-form-grid",
    ".real-opportunity-example-output"
  ]);
  assertFileIncludes("package.json", ["\"smoke:real-opportunity-example-runner\""]);
});

console.log("real-opportunity-example-runner smoke ok");

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
