import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("first real ecosystem build request uses existing internal Opportunity flow", () => {
  assertFileIncludes("src/lib/engine/first-real-ecosystem-build-request.ts", [
    "first_real_ecosystem_build_request",
    "runRealOpportunityExample",
    "createRealOpportunityResultReview",
    "savePreparedHandoffFromReadyOpportunityResultReview",
    "loadOwnerPortfolioRegistry",
    "loadProjectMemory",
    "getAppEngineAuditTrail"
  ]);
});

runStep("Life Core seed is specific to the real ecosystem build request", () => {
  assertFileIncludes("src/lib/engine/first-real-ecosystem-build-request.ts", [
    "Life Produces Life Core",
    "United Under God ecosystem foundation",
    "transformation is the product",
    "apps are tools",
    "Create a prepared AppEngine handoff for the next actual Life Produces Life Core ecosystem build slice"
  ]);
});

runStep("runner creates ready review and prepared handoff without final packets or Codex", () => {
  assertFileIncludes("src/lib/engine/first-real-ecosystem-build-request.ts", [
    "ready_for_next_appengine_action",
    "preparedHandoff",
    "owner_review_prepared_handoff",
    "noFinalPacketCreated",
    "noCodexAutoExecution",
    "noGitHubIssueCreation",
    "noLabelChanges"
  ]);
});

runStep("owner-gated API exposes the action safely", () => {
  assertFileIncludes("src/app/api/first-real-ecosystem-build-request/route.ts", [
    "canAccessEngineAdmin",
    "runFirstRealEcosystemBuildRequest",
    "listFirstRealEcosystemBuildRequests",
    "codexAutoExecutionBlocked",
    "githubIssueCreationBlocked",
    "labelChangesBlocked",
    "finalPacketCreationBlocked"
  ]);
});

runStep("Owner Control Center shows guided request and copyable prepared handoff", () => {
  assertFileIncludes("src/components/opportunity-intake/first-real-ecosystem-build-request-panel.tsx", [
    "first-real-ecosystem-build-request",
    "Run Life Core build request",
    "first-real-ecosystem-build-request-output",
    "Prepared AppEngine handoff",
    "copyable-prompt-box"
  ]);
  assertFileIncludes("src/app/(cockpit)/owner-control-center/page.tsx", [
    "FirstRealEcosystemBuildRequestPanel",
    "listFirstRealEcosystemBuildRequests",
    "firstRealEcosystemBuildRequestSeed"
  ]);
});

runStep("guardrails block unsafe automation and infrastructure changes", () => {
  assertFileIncludes("src/lib/engine/first-real-ecosystem-build-request.ts", [
    "noProductionDeploy",
    "noPaidResources",
    "noLiveMigrations",
    "noSecretsOrEnvChanges",
    "repositoryVisibilityUnchanged"
  ]);
  assertFileExcludes("src/lib/engine/first-real-ecosystem-build-request.ts", [
    "gh issue create",
    "ai:build",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

runStep("package script and styles are wired", () => {
  assertFileIncludes("package.json", ["\"smoke:first-real-ecosystem-build-request\""]);
  assertFileIncludes("src/app/styles.css", [
    ".first-real-ecosystem-build-request",
    ".first-real-build-seed-grid",
    ".first-real-build-output"
  ]);
});

console.log("first-real-ecosystem-build-request smoke ok");

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
