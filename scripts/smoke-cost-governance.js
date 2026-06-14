import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-cost-governance-"));
const continueArtifact = path.join(smokeRoot, "continue-cost-governance.json");
const warningArtifact = path.join(smokeRoot, "warning-cost-governance.json");
const pauseArtifact = path.join(smokeRoot, "pause-cost-governance.json");
const approvalArtifact = path.join(smokeRoot, "approval-cost-governance.json");
const packetOutput = path.join(smokeRoot, "app-build-packet.json");
const completionContinueOutput = path.join(smokeRoot, "completion-continue.json");
const completionPauseOutput = path.join(smokeRoot, "completion-pause.json");
const completionApprovalOutput = path.join(smokeRoot, "completion-approval.json");

runStep("cost governance tracks budget and continues cheap work", () => {
  runNode("scripts/create-cost-governance-standard.js", {
    COST_GOVERNANCE_ARTIFACT_OUTPUT: continueArtifact,
    APP_NAME: "Spark of Hope Intake Lite",
    APP_SLUG: "spark-of-hope-intake-lite",
    APPENGINE_TASK_TYPE: "issue_routing",
    APPENGINE_MONTHLY_AI_BUDGET: "100",
    APPENGINE_MONTHLY_AI_SPEND: "30",
    APPENGINE_PROJECT_AI_SPEND: "22",
    APPENGINE_APP_AI_SPEND: "12",
    APPENGINE_ISSUE_AI_SPEND: "1",
    APPENGINE_ESTIMATED_NEXT_AI_SPEND: "0.05"
  });

  const artifact = readJson(continueArtifact);

  assertEqual(artifact.kind, "cost_governance", "cost artifact kind");
  assertEqual(artifact.monthlyBudget, 100, "monthly budget");
  assertEqual(artifact.monthlySpend, 30, "monthly spend");
  assertEqual(artifact.projectSpend, 22, "project spend");
  assertEqual(artifact.appSpend, 12, "app spend");
  assertEqual(artifact.issueSpend, 1, "issue spend");
  assertEqual(artifact.remainingBudget, 70, "remaining budget");
  assertEqual(artifact.modelRouting.taskClass, "cheap", "cheap task classification");
  assertEqual(artifact.nextBudgetAction, "continue", "cheap work continues");
});

runStep("warning threshold routes expensive work to cheaper model", () => {
  runNode("scripts/create-cost-governance-standard.js", {
    COST_GOVERNANCE_ARTIFACT_OUTPUT: warningArtifact,
    APP_NAME: "Spark of Hope Intake Lite",
    APP_SLUG: "spark-of-hope-intake-lite",
    APPENGINE_TASK_TYPE: "architecture",
    APPENGINE_MONTHLY_AI_BUDGET: "100",
    APPENGINE_MONTHLY_AI_SPEND: "51",
    APPENGINE_ESTIMATED_NEXT_AI_SPEND: "1"
  });

  const artifact = readJson(warningArtifact);

  assertEqual(artifact.thresholdStatus, "warning", "warning threshold");
  assertEqual(artifact.modelRouting.taskClass, "expensive", "architecture is expensive");
  assertEqual(artifact.modelRouting.recommendedClass, "medium", "warning recommends cheaper class");
  assertEqual(artifact.nextBudgetAction, "continue_with_cheaper_model", "warning action");
});

runStep("pause threshold blocks automatic continuation", () => {
  runNode("scripts/create-cost-governance-standard.js", {
    COST_GOVERNANCE_ARTIFACT_OUTPUT: pauseArtifact,
    APP_NAME: "Spark of Hope Intake Lite",
    APP_SLUG: "spark-of-hope-intake-lite",
    APPENGINE_TASK_TYPE: "validation",
    APPENGINE_MONTHLY_AI_BUDGET: "100",
    APPENGINE_MONTHLY_AI_SPEND: "81",
    APPENGINE_ESTIMATED_NEXT_AI_SPEND: "1"
  });

  const artifact = readJson(pauseArtifact);

  assertEqual(artifact.thresholdStatus, "pause", "pause threshold");
  assertEqual(artifact.modelRouting.taskClass, "medium", "validation is medium");
  assertEqual(artifact.nextBudgetAction, "pause", "pause action");
});

runStep("owner approval threshold requires approval", () => {
  runNode("scripts/create-cost-governance-standard.js", {
    COST_GOVERNANCE_ARTIFACT_OUTPUT: approvalArtifact,
    APP_NAME: "Spark of Hope Intake Lite",
    APP_SLUG: "spark-of-hope-intake-lite",
    APPENGINE_TASK_TYPE: "debugging",
    APPENGINE_MONTHLY_AI_BUDGET: "100",
    APPENGINE_MONTHLY_AI_SPEND: "91",
    APPENGINE_ESTIMATED_NEXT_AI_SPEND: "1"
  });

  const artifact = readJson(approvalArtifact);

  assertEqual(artifact.thresholdStatus, "owner_approval", "approval threshold");
  assertEqual(artifact.nextBudgetAction, "request_approval", "approval action");
  assertEqual(artifact.ownerApprovalRequired, true, "owner approval required");
});

runStep("build completion continues with budget awareness", () => {
  createPacket();

  runNode("scripts/create-build-completion-plan.js", {
    BUILD_COMPLETION_PACKET: packetOutput,
    BUILD_COMPLETION_PLAN_OUTPUT: completionContinueOutput,
    BUILD_CURRENT_STATE: "ready_for_build",
    BUILD_CURRENT_PHASE: "mvp_build",
    APPENGINE_TASK_TYPE: "issue_routing",
    APPENGINE_MONTHLY_AI_BUDGET: "100",
    APPENGINE_MONTHLY_AI_SPEND: "10",
    APPENGINE_ESTIMATED_NEXT_AI_SPEND: "0.05"
  });

  const plan = readJson(completionContinueOutput);

  assertEqual(plan.kind, "build_completion_plan", "plan kind");
  assertEqual(plan.costGovernance.kind, "cost_governance", "plan embeds cost governance");
  assertEqual(plan.budgetAwareNextSafeAction, "continue", "budget action continues");
  assertEqual(plan.nextSafeAction, "create_implementation_issue", "normal build action preserved");
  assertEqual(plan.guardrails.productionDeployBlocked, true, "production still blocked");
  assertEqual(plan.guardrails.paidResourcesBlocked, true, "paid resources still blocked");
  assertEqual(plan.guardrails.migrationsBlocked, true, "migrations still blocked");
  assertEqual(plan.guardrails.autoMergeBlocked, true, "auto merge still blocked");
});

runStep("build completion pauses when budget threshold is reached", () => {
  runNode("scripts/create-build-completion-plan.js", {
    BUILD_COMPLETION_PACKET: packetOutput,
    BUILD_COMPLETION_PLAN_OUTPUT: completionPauseOutput,
    BUILD_CURRENT_STATE: "ready_for_build",
    BUILD_CURRENT_PHASE: "mvp_build",
    APPENGINE_TASK_TYPE: "implementation",
    APPENGINE_MONTHLY_AI_BUDGET: "100",
    APPENGINE_MONTHLY_AI_SPEND: "82",
    APPENGINE_ESTIMATED_NEXT_AI_SPEND: "1"
  });

  const plan = readJson(completionPauseOutput);

  assertEqual(plan.currentState, "owner_approval_required", "pause moves to owner approval state");
  assertEqual(plan.nextSafeAction, "pause_for_budget", "pause action");
  assertEqual(plan.ownerApprovalRequired, true, "pause requires approval");
  assertArrayIncludes(plan.failedGates.map((gate) => gate.id), "cost_governance", "cost gate failed");
});

runStep("build completion requests approval when threshold is exceeded", () => {
  runNode("scripts/create-build-completion-plan.js", {
    BUILD_COMPLETION_PACKET: packetOutput,
    BUILD_COMPLETION_PLAN_OUTPUT: completionApprovalOutput,
    BUILD_CURRENT_STATE: "ready_for_build",
    BUILD_CURRENT_PHASE: "mvp_build",
    APPENGINE_TASK_TYPE: "debugging",
    APPENGINE_MONTHLY_AI_BUDGET: "100",
    APPENGINE_MONTHLY_AI_SPEND: "92",
    APPENGINE_ESTIMATED_NEXT_AI_SPEND: "1"
  });

  const plan = readJson(completionApprovalOutput);

  assertEqual(plan.currentState, "owner_approval_required", "approval moves to owner approval state");
  assertEqual(plan.nextSafeAction, "request_budget_approval", "request approval action");
  assertEqual(plan.ownerApprovalRequired, true, "owner approval required");
  assertArrayIncludes(plan.failedGates.map((gate) => gate.id), "cost_governance", "cost gate failed");
});

console.log(`cost-governance smoke ok (${smokeRoot})`);

function createPacket() {
  runNode("scripts/create-app-build-packet.js", {
    APP_BUILD_PACKET_OUTPUT: packetOutput,
    APP_NAME: "Spark of Hope Intake Lite",
    APP_SLUG: "spark-of-hope-intake-lite",
    APP_PURPOSE: "Help people share one hopeful story privately so care can be prepared.",
    APP_AUDIENCE: "story sharers|care team",
    APP_SUCCESS_DEFINITION: "A person can submit one private preview story and understand what happens next.",
    APP_PREVIEW_URL: "https://spark-preview.example.test",
    APP_PRODUCTION_URL: "approval-gated"
  });
}

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function runNode(scriptPath, env) {
  return execFileSync(process.execPath, [path.join(repoRoot, scriptPath)], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertArrayIncludes(values, expected, message) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(values)} to include ${JSON.stringify(expected)}`);
  }
}
