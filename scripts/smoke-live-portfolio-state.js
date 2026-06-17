import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("portfolio service reads live and derived state sources", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "listOpportunityIntakeRecords",
    "listOpportunityClarifications",
    "listOpportunitySolutionPaths",
    "listOpportunityActionPlans",
    "listOpportunityAppEngineCandidates",
    "listProblemIntakeRecords",
    "listOrchestratorActionQueue",
    "loadProjectMemory",
    "getLifeCoreOverview",
    "getStoryIntakeCapability",
    "getAppEngineStateAdapter"
  ]);
});

runStep("portfolio keeps the app_portfolio_registry structure", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "kind: \"app_portfolio_registry\"",
    "AppPortfolioRegistry",
    "buildAppPortfolioRegistry",
    "sourceArtifact",
    "byStateSource",
    "noSecretsInRegistry",
    "productionApprovalRequired"
  ]);
});

runStep("portfolio labels live, derived, and fallback state honestly", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "\"live_state\"",
    "\"derived_state\"",
    "\"seeded_fallback\"",
    "deriveAppEngineCoreEntry",
    "deriveOpportunityEntry",
    "deriveLifeCoreEntry",
    "deriveSparkEntry",
    "deriveFutureEcosystemEntry",
    "Using Life Core seed overview because no stored adapter state exists yet.",
    "Spark API reports"
  ]);
});

runStep("owner dashboard displays source labels and source artifacts", () => {
  assertFileIncludes("src/components/engine/owner-portfolio-dashboard.tsx", [
    "registry.summary.byStateSource.live_state",
    "registry.summary.byStateSource.derived_state",
    "registry.summary.byStateSource.seeded_fallback",
    "portfolio-source",
    "Source artifact",
    "app.sourceArtifact.kind",
    "app.sourceArtifact.summary"
  ]);
});

runStep("dashboard styles include source labels", () => {
  assertFileIncludes("src/app/styles.css", [
    ".portfolio-state-stack",
    ".portfolio-source",
    ".portfolio-source.live_state",
    ".portfolio-source.seeded_fallback"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:live-portfolio-state\""]);
});

console.log("live-portfolio-state smoke ok");

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

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}
