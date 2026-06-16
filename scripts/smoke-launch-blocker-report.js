import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("launch blocker report artifact consolidates required sources", () => {
  assertFileIncludes("src/lib/engine/production-launch-blocker-report.ts", [
    "production_launch_blocker_report",
    "createProductionAuthReadinessReport",
    "createRuntimeMonitoringLiteReport",
    "loadAuditTrailOwnerVisibilityReport",
    "validateNeonPersistenceConnectionStub",
    "appEngineStateStores"
  ]);
});

runStep("report categorizes blockers and effort honestly", () => {
  assertFileIncludes("src/lib/engine/production-launch-blocker-report.ts", [
    "criticalBlockers",
    "launchBlockers",
    "postLaunchImprovements",
    "estimatedEffort",
    "durable_persistence_not_active",
    "production_auth_not_owner_confirmed",
    "production_release_not_approved"
  ]);
});

runStep("report recommends a launch sequence without taking launch actions", () => {
  assertFileIncludes("src/lib/engine/production-launch-blocker-report.ts", [
    "launchSequence",
    "Activate durable persistence planning",
    "Configure production auth assumptions",
    "Run a limited owner-approved preview trial",
    "Use release gate approval before promoting production"
  ]);
});

runStep("guardrails block unsafe automation and production actions", () => {
  assertFileIncludes("src/lib/engine/production-launch-blocker-report.ts", [
    "noProductionDeploy: true",
    "noPaidResources: true",
    "noMigrations: true",
    "noSecretsOrEnvChanges: true",
    "noCodexAutoExecution: true",
    "noGitHubIssueCreation: true",
    "noLabelChanges: true",
    "noGeneratedAppAutoMerge: true"
  ]);
});

runStep("source of truth documents the report contract", () => {
  assertFileIncludes("source-of-truth/production-launch-blocker-report.md", [
    "Production Launch Blocker Report",
    "production_launch_blocker_report",
    "What prevents AppEngine from serving real users today?",
    "critical_blocker",
    "launch_blocker",
    "post_launch_improvement"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:launch-blocker-report"]);
});

console.log("launch-blocker-report smoke ok");

function assertFileIncludes(filePath, expected) {
  const source = fs.readFileSync(path.join(root, filePath), "utf8");
  for (const phrase of expected) {
    if (!source.includes(phrase)) {
      throw new Error(`${filePath} missing ${phrase}`);
    }
  }
}

function runStep(label, fn) {
  try {
    fn();
    console.log(`ok - ${label}`);
  } catch (error) {
    console.error(`not ok - ${label}`);
    throw error;
  }
}
