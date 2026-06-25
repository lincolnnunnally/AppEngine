import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("release gate artifact uses required evidence sources", () => {
  assertFileIncludes("src/lib/engine/controlled-production-release-gate.ts", [
    "controlled_production_release_gate",
    "createPersistenceActivationReadiness",
    "createRuntimeMonitoringLiteReport",
    "loadAuditTrailOwnerVisibilityReport",
    "createProductionLaunchBlockerReport"
  ]);
});

runStep("release gate requires durable state, auth, monitoring, audit, rollback, and blockers", () => {
  assertFileIncludes("src/lib/engine/controlled-production-release-gate.ts", [
    "durableSchemaMigrationDryRunPassed",
    "productionAuthOwnerConfirmed",
    "monitoringReviewed",
    "auditTrailReviewed",
    "rollbackNotesReviewed",
    "launchBlockersAcceptedForControlledUse"
  ]);
});

runStep("release gate fails honestly when evidence is missing", () => {
  assertFileIncludes("src/lib/engine/controlled-production-release-gate.ts", [
    "blocked_pending_evidence",
    "blockedReasons",
    "Missing evidence must be resolved",
    "Resolve the first blocked evidence item"
  ]);
});

runStep("release gate allows only controlled existing-provider deploys inside limits", () => {
  assertFileIncludes("src/lib/engine/controlled-production-release-gate.ts", [
    "productionAction: blockedReasons.length ? \"blocked\" : \"ready_for_controlled_deploy\"",
    "releaseGateOnly: true",
    "noUnreviewedProductionDeploy: true",
    "noNewPaidResources: true",
    "noLiveMigrations: true",
    "noSecretsOrEnvChanges: true",
    "existingProviderProjectOnly: true",
    "providerSpendMustStayWithinLimits: true",
    "noCodexAutoExecution: true",
    "noGitHubIssueCreation: true",
    "noLabelChanges: true"
  ]);
});

runStep("source of truth documents the controlled release gate", () => {
  assertFileIncludes("source-of-truth/controlled-production-release-gate.md", [
    "Controlled Production Release Gate",
    "controlled_production_release_gate",
    "durable state readiness",
    "production auth owner confirmation",
    "runtime monitoring review",
    "audit trail review",
    "rollback notes",
    "existing provider project",
    "within configured limits"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:controlled-production-release-gate"]);
});

console.log("controlled-production-release-gate smoke ok");

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
