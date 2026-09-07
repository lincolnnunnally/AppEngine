import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("Step 4 readiness artifact is AppEngine-specific", () => {
  assertFileIncludes("src/lib/engine/we-succeed-soft-launch-readiness.ts", [
    "we_succeed_soft_launch_readiness",
    "createWeSucceedSoftLaunchReadiness",
    "APP_ENGINE_STEP4_SOFT_LAUNCH_ORIGIN",
    "https://appengine.unitedundergod.org",
    "/api/health",
    "/problem-intake-lite",
    "/opportunity-intake",
    "/owner-control-center"
  ]);
  assertFileDoesNotInclude("src/lib/engine/we-succeed-soft-launch-readiness.ts", [
    'productionOrigin: "https://we-succeed.org"',
    'productionOrigin === "https://we-succeed.org"',
    'value || "https://we-succeed.org"',
    "Target URL is we-succeed.org"
  ]);
});

runStep("Step 4 readiness uses existing guardrail artifacts", () => {
  assertFileIncludes("src/lib/engine/we-succeed-soft-launch-readiness.ts", [
    "createControlledProductionReleaseGate",
    "createProductionAuthReadinessReport",
    "controlled_production_release_gate",
    "production_auth_readiness"
  ]);
});

runStep("Step 4 readiness requires live door and health evidence", () => {
  assertFileIncludes("src/lib/engine/we-succeed-soft-launch-readiness.ts", [
    "ownerLoginVerified",
    "healthCheckObservedOk",
    "problemDoorEndToEndVerified",
    "buildDoorEndToEndVerified",
    "providerSpendGuardrailVerified",
    "rollbackNotesReviewed",
    "ownerApprovalNotes"
  ]);
});

runStep("Step 4 readiness blocks until evidence exists", () => {
  assertFileIncludes("src/lib/engine/we-succeed-soft-launch-readiness.ts", [
    "blocked_pending_evidence",
    "ready_for_controlled_deploy",
    "blocked_until_all_checks_pass",
    "Resolve Step 4 blocker"
  ]);
});

runStep("Step 4 readiness preserves the scope fence", () => {
  assertFileIncludes("src/lib/engine/we-succeed-soft-launch-readiness.ts", [
    "noNewPaidResources: true",
    "noEcosystemAppWork: true",
    "noChurchConnectWork: true",
    "noDatabaseMigrations: true",
    "providerSpendMustStayWithinLimits: true",
    "healthCheckPublicReadOnly: true",
    "ownerLoginRequiredForIntake: true"
  ]);
});

runStep("source of truth documents the Step 4 readiness contract", () => {
  assertFileIncludes("source-of-truth/we-succeed-soft-launch-readiness.md", [
    "App Engine Soft-Launch Readiness",
    "we_succeed_soft_launch_readiness",
    "historical Continuity identifier",
    "https://appengine.unitedundergod.org",
    "/api/health",
    "provider/spend guardrail",
    "blocked_pending_evidence",
    "ready_for_controlled_deploy",
    "HOLD MERGE until CoS leftover-preview PASS"
  ]);
  assertFileDoesNotInclude("source-of-truth/we-succeed-soft-launch-readiness.md", [
    "We Succeed Soft-Launch Readiness"
  ]);
});

runStep("shared context and package expose the Step 4 smoke", () => {
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/we-succeed-soft-launch-readiness.md"]);
  assertFileIncludes("agents/context/output-contracts.md", [
    "we_succeed_soft_launch_readiness",
    "https://appengine.unitedundergod.org"
  ]);
  assertFileIncludes("source-of-truth/context-checklist.md", [
    "we_succeed_soft_launch_readiness",
    "https://appengine.unitedundergod.org"
  ]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["we_succeed_soft_launch_readiness"]);
  assertFileIncludes("package.json", ["smoke:we-succeed-soft-launch-readiness"]);
  assertFileIncludes("src/lib/auth/hosts.ts", ['export const FACTORY_HOST = "appengine.unitedundergod.org"']);
});

console.log("we-succeed-soft-launch-readiness smoke ok");

function assertFileIncludes(filePath, expected) {
  const source = fs.readFileSync(path.join(root, filePath), "utf8");
  for (const phrase of expected) {
    if (!source.includes(phrase)) {
      throw new Error(`${filePath} missing ${phrase}`);
    }
  }
}

function assertFileDoesNotInclude(filePath, forbidden) {
  const source = fs.readFileSync(path.join(root, filePath), "utf8");
  for (const phrase of forbidden) {
    if (source.includes(phrase)) {
      throw new Error(`${filePath} still contains ${phrase}`);
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
