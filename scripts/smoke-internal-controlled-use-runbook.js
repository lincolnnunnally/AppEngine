import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-controlled-use-runbook-"));
const adapterRoot = path.join(smokeRoot, "adapter-state");

process.env.APPENGINE_STATE_ROOT = adapterRoot;
delete process.env.APPENGINE_STATE_ADAPTER;
process.chdir(smokeRoot);

const runbookModule = await import(pathToFileURL(path.join(repoRoot, "src/lib/engine/internal-controlled-use-runbook.ts")).href);

runStep("source and UI are discoverable", () => {
  assertFileIncludes("src/lib/engine/internal-controlled-use-runbook.ts", [
    "internal_controlled_use_runbook",
    "submit_spark_test_story",
    "review_spark_story",
    "approve_spark_preview",
    "prepare_export_handoff",
    "review_audit_trail",
    "Submit test story",
    "Prepare/export"
  ]);
  assertFileIncludes("src/components/engine/handoff-relay-control-center.tsx", [
    'data-testid="internal-controlled-use-runbook"',
    "First Spark trial flow",
    "internalControlledUse.runbook.steps",
    "runInternalControlledUseStep(step.id)"
  ]);
  assertFileIncludes("src/app/api/engine/internal-controlled-use/route.ts", ["canAccessEngineAdmin", "runInternalControlledUseStep"]);
});

let payload = await runbookModule.loadInternalControlledUseRunbook(new Date("2026-06-17T10:00:00.000Z"));

runStep("initial runbook starts at Spark test story", () => {
  assertEqual(payload.runbook.kind, "internal_controlled_use_runbook", "runbook kind");
  assertEqual(payload.runbook.internalTrialCompleted, false, "initial completion");
  assertEqual(payload.runbook.nextStep.id, "submit_spark_test_story", "first step");
  assertEqual(payload.runbook.trial.status, "not_started", "initial trial status");
});

const steps = [
  "submit_spark_test_story",
  "review_spark_story",
  "approve_spark_preview",
  "run_orchestrator_next_safe_step",
  "prepare_export_handoff",
  "update_project_memory",
  "review_audit_trail"
];

for (let index = 0; index < steps.length; index += 1) {
  const stepId = steps[index];
  payload = await runbookModule.runInternalControlledUseStep(stepId, new Date(`2026-06-17T10:0${index + 1}:00.000Z`));
  runStep(`runs step ${stepId}`, () => {
    const completedStep = payload.runbook.steps.find((step) => step.id === stepId);
    assertEqual(completedStep.status, "complete", `${stepId} status`);
  });
}

runStep("completed trial records every required state", () => {
  const trial = payload.runbook.trial;
  assertEqual(payload.runbook.internalTrialCompleted, true, "trial completed");
  assertEqual(trial.status, "completed", "trial status");
  assertEqual(trial.sparkReviewItem.status, "approved_for_preview", "Spark preview approval");
  assert(trial.orchestratorRunId, "orchestrator run id exists");
  assert(trial.preparedHandoffId, "prepared handoff id exists");
  assert(trial.exportedHandoffId, "exported handoff id exists");
  assert(trial.projectMemoryUpdatedAt, "project memory timestamp exists");
  assert(trial.auditReviewedAt, "audit reviewed timestamp exists");
  assertEqual(payload.handoffs.length > 0, true, "handoffs exist");
  assertEqual(payload.orchestratorRuns.length > 0, true, "orchestrator runs exist");
  assertEqual(payload.orchestratorActionQueue.length > 0, true, "orchestrator queue exists");
});

runStep("adapter-backed state and audit evidence are durable locally", () => {
  assertAdapterFile("internal_controlled_use_trials/default.json");
  assertAdapterFile("project_memory/default.json");
  assertAdapterFile("handoff_relay/default.json");
  assertAdapterFile("orchestrator_runs/default.json");
  assertAdapterFile("orchestrator_action_queue/default.json");

  const auditPath = path.join(smokeRoot, ".app-engine", "audit-trail", "events.jsonl");
  const auditEvents = fs
    .readFileSync(auditPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const auditTypes = auditEvents.map((event) => event.type);

  ["intake_submitted", "spark_item_reviewed", "orchestrator_action_queued", "handoff_prepared", "orchestrator_action_exported"].forEach((type) =>
    assertIncludes(auditTypes.join("|"), type, `audit includes ${type}`)
  );
  assertEqual(payload.auditTrailReport.events.length > 0, true, "owner-visible audit events");
});

runStep("guardrails stay explicit", () => {
  const guardrails = payload.runbook.guardrails;
  assertEqual(guardrails.noProductionDeploy, true, "no production deploy");
  assertEqual(guardrails.noPaidResources, true, "no paid resources");
  assertEqual(guardrails.noLiveMigrations, true, "no live migrations");
  assertEqual(guardrails.noCodexAutoExecution, true, "no Codex auto-execution");
  assertEqual(guardrails.noGitHubIssueCreation, true, "no GitHub issue creation");
  assertEqual(guardrails.noLabelChanges, true, "no label changes");
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:internal-controlled-use-runbook"]);
});

console.log(`internal-controlled-use-runbook smoke ok (${smokeRoot})`);

function assertAdapterFile(relativePath) {
  const filePath = path.join(adapterRoot, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`missing adapter file ${relativePath}`);
}

function assertFileIncludes(filePath, expected) {
  const source = fs.readFileSync(path.join(repoRoot, filePath), "utf8");
  for (const phrase of expected) {
    assertIncludes(source, phrase, `${filePath} includes ${phrase}`);
  }
}

function assert(value, label) {
  if (!value) throw new Error(label);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(value, expected, label) {
  if (!String(value).includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(value)} to include ${JSON.stringify(expected)}`);
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
