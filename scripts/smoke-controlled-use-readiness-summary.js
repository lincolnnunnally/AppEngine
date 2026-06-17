import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("controlled use summary imports final readiness evidence", () => {
  assertFileIncludes("src/lib/engine/controlled-use-readiness-summary.ts", [
    "controlled_use_readiness_summary",
    "createFinalProductionClosurePlan",
    "createControlledProductionReleaseGate",
    "createProductionLaunchBlockerReport"
  ]);
});

runStep("summary includes required readiness statuses", () => {
  assertFileIncludes("src/lib/engine/controlled-use-readiness-summary.ts", [
    "ready_for_internal_controlled_use",
    "blocked_for_public_use",
    "blocked_for_autonomous_execution"
  ]);
});

runStep("summary keeps AppEngine centered as a tool, not the product", () => {
  assertFileIncludes("src/lib/engine/controlled-use-readiness-summary.ts", [
    "AppEngine is not the product",
    "Transformation and problem-solving are the product",
    "pain or problem to clarity, purpose, and useful solutions"
  ]);
});

runStep("summary covers capabilities, safety, blockers, confirmations, and next action", () => {
  assertFileIncludes("src/lib/engine/controlled-use-readiness-summary.ts", [
    "currentAppEngineCapability",
    "problemsAppEngineCanHelpSolve",
    "safeForControlledUse",
    "notYetSafe",
    "remainingBlockersBeforePublicCommunityCustomerUse",
    "requiredOwnerConfirmations",
    "nextRecommendedOperationalAction"
  ]);
});

runStep("summary guardrails prevent unsafe actions", () => {
  assertFileIncludes("src/lib/engine/controlled-use-readiness-summary.ts", [
    "summaryOnly: true",
    "noProductionDeploy: true",
    "noPaidResources: true",
    "noLiveMigrations: true",
    "noSecretsOrEnvChanges: true",
    "noCodexAutoExecution: true",
    "noGitHubIssueCreation: true",
    "noLabelChanges: true"
  ]);
});

runStep("source of truth documents the readiness summary", () => {
  assertFileIncludes("source-of-truth/controlled-use-readiness-summary.md", [
    "Controlled Use Readiness Summary",
    "controlled_use_readiness_summary",
    "AppEngine is not the product",
    "ready_for_internal_controlled_use",
    "blocked_for_public_use",
    "blocked_for_autonomous_execution"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:controlled-use-readiness-summary"]);
});

console.log("controlled-use-readiness-summary smoke ok");

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
