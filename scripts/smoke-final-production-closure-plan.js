import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("final closure plan imports the three closure inputs", () => {
  assertFileIncludes("src/lib/engine/final-production-closure-plan.ts", [
    "createPersistenceActivationReadiness",
    "createOrchestratorAutonomyRoadmap",
    "createProductionLaunchBlockerReport",
    "final_production_closure_plan"
  ]);
});

runStep("plan defines first controlled-use standards", () => {
  assertFileIncludes("src/lib/engine/final-production-closure-plan.ts", [
    "productionReadyEnoughForFirstControlledUse",
    "autonomousEnoughForFirstControlledUse",
    "controlled_production_use",
    "real_customer_user_use",
    "post_launch"
  ]);
});

runStep("plan separates required work from post-launch work", () => {
  assertFileIncludes("src/lib/engine/final-production-closure-plan.ts", [
    "requiredBeforeControlledProductionUse",
    "requiredBeforeRealCustomerUserUse",
    "postLaunchImprovements",
    "risksOfStoppingTooEarly",
    "risksOfOverbuildingTooLong"
  ]);
});

runStep("plan recommends the next three PRs", () => {
  assertFileIncludes("src/lib/engine/final-production-closure-plan.ts", [
    "Durable State Schema and Migration Dry Run",
    "Production Auth Owner Confirmation",
    "Controlled Production Release Gate"
  ]);
});

runStep("guardrails keep the plan non-mutating", () => {
  assertFileIncludes("src/lib/engine/final-production-closure-plan.ts", [
    "planningOnly: true",
    "noProductionDeploy: true",
    "noPaidResources: true",
    "noMigrations: true",
    "noSecretsOrEnvChanges: true",
    "noCodexAutoExecution: true",
    "noGitHubIssueCreation: true",
    "noLabelChanges: true"
  ]);
});

runStep("source of truth documents final closure contract", () => {
  assertFileIncludes("source-of-truth/final-production-closure-plan.md", [
    "Final Production Closure Plan",
    "final_production_closure_plan",
    "first controlled use",
    "Recommended Next Three PRs",
    "risks come from overbuilding too long"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:final-production-closure-plan"]);
});

console.log("final-production-closure-plan smoke ok");

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
