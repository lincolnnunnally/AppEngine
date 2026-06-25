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

runStep("missing evidence keeps deployment blocked", () => {
  assertFileIncludes("src/lib/engine/controlled-production-release-gate.ts", [
    "status: blockedReasons.length ? \"blocked_pending_evidence\" : \"approved_for_first_controlled_use\"",
    "productionAction: blockedReasons.length ? \"blocked\" : \"ready_for_controlled_deploy\"",
    "Controlled production release remains blocked. Missing evidence must be resolved before AppEngine serves controlled real use.",
    "Resolve the first blocked evidence item before requesting controlled production approval.",
    "Launch blocker status has not been accepted for controlled use."
  ]);
});

runStep("complete evidence allows controlled deployment inside limits", () => {
  assertFileIncludes("src/lib/engine/controlled-production-release-gate.ts", [
    "approved_for_first_controlled_use",
    "ready_for_controlled_deploy",
    "Controlled production release evidence is complete for the Step 4 deploy path.",
    "Run the existing controlled deploy path, then verify we-succeed.org, both doors, owner login, and /api/health.",
    "Known critical blockers accepted for controlled soft launch",
    "providerSpendMustStayWithinLimits: true"
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
