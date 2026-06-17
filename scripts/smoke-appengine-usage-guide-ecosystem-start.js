import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("usage guide and ecosystem build start artifact are defined", () => {
  assertFileIncludes("src/lib/engine/appengine-usage-guide-ecosystem-start.ts", [
    "appengine_usage_guide_ecosystem_start",
    "appEngineUsageGuide",
    "startEcosystemBuild",
    "ecosystemBuildTargets",
    "Life Produces Life Core",
    "Spark of Hope",
    "Live On Mission",
    "Best Life",
    "ChurchConnect",
    "custom_ecosystem_slice"
  ]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["\"appengine_usage_guide_ecosystem_start\""]);
});

runStep("start flow uses existing Opportunity and build execution systems", () => {
  assertFileIncludes("src/lib/engine/appengine-usage-guide-ecosystem-start.ts", [
    "runRealOpportunityExample",
    "createRealOpportunityResultReview",
    "savePreparedHandoffFromReadyOpportunityResultReview",
    "createBuildExecutionRequest",
    "reviewBuildExecutionRequest",
    "opportunity_build_packet_bridge",
    "exportedBuilderHandoff"
  ]);
});

runStep("owner-gated API exposes guide, targets, records, and refreshed state", () => {
  assertFileIncludes("src/app/api/ecosystem-build-start/route.ts", [
    "canAccessEngineAdmin",
    "appEngineUsageGuide",
    "ecosystemBuildTargets",
    "startEcosystemBuild",
    "loadOwnerPortfolioRegistry",
    "listBuildExecutionRequests",
    "listHandoffRelaySummaries"
  ]);
});

runStep("Owner Control Center shows how to use AppEngine today and start a build", () => {
  assertFileIncludes("src/app/owner-control-center/page.tsx", [
    "AppEngineUsageGuideEcosystemStartPanel",
    "listEcosystemBuildStartRecords",
    "ecosystemBuildStartRecords"
  ]);
  assertFileIncludes("src/components/engine/appengine-usage-guide-ecosystem-start-panel.tsx", [
    "How to Use AppEngine Today",
    "Start Ecosystem Build",
    "AppEngine prepares, tracks, reviews, and packages work",
    "Codex still performs build execution manually",
    "Export-ready builder handoff",
    "copy it to Codex manually"
  ]);
});

runStep("portfolio dashboard can derive state from ecosystem build starts", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "listEcosystemBuildStartRecords",
    "ecosystemBuildStarts",
    "ecosystem build start prepared",
    "review_exported_builder_handoff"
  ]);
  assertFileIncludes("src/lib/engine/build-execution-request.ts", [
    "Live On Mission / ecosystem slice",
    "Best Life / ecosystem slice",
    "ChurchConnect / ecosystem slice"
  ]);
});

runStep("guardrails prevent unsafe automation", () => {
  assertFileIncludes("src/lib/engine/appengine-usage-guide-ecosystem-start.ts", [
    "noCodexAutoExecution",
    "noGitHubIssueCreation",
    "noLabelChanges",
    "noProductionDeploy",
    "noPaidResources",
    "noLiveMigrations",
    "noSecretsOrEnvChanges",
    "repositoryVisibilityUnchanged",
    "codexTriggered: false",
    "githubIssuesCreated: false",
    "labelsApplied: false",
    "productionDeployed: false"
  ]);
  assertFileExcludes("src/lib/engine/appengine-usage-guide-ecosystem-start.ts", [
    "gh issue create",
    "ai:build",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

runStep("styles and package script are wired", () => {
  assertFileIncludes("src/app/styles.css", [
    ".appengine-usage-guide",
    ".usage-guide-grid",
    ".ecosystem-build-start-layout"
  ]);
  assertFileIncludes("package.json", ["\"smoke:appengine-usage-guide-ecosystem-start\""]);
});

console.log("appengine-usage-guide-ecosystem-start smoke ok");

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
