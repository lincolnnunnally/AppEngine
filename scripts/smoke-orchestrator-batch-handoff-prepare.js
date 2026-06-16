import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-orchestrator-batch-handoff-prepare-"));

process.chdir(smokeRoot);

const orchestratorModule = await import(pathToFileURL(path.join(repoRoot, "src/lib/engine/orchestrator-run.ts")).href);

const { createStoredOrchestratorBatchDryRun, listOrchestratorActionQueue, saveOrchestratorRun } = orchestratorModule;

await runStep("source contracts are discoverable", () => {
  assertFileIncludes("source-of-truth/orchestrator-batch-handoff-prepare.md", [
    "orchestrator_batch_handoff_prepare",
    "Prepare at most three handoffs per batch",
    "No automatic Codex execution"
  ]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/orchestrator-batch-handoff-prepare.md", "orchestrator_batch_handoff_prepare"]);
  assertFileIncludes("agents/context/output-contracts.md", [
    "orchestrator_batch_handoff_prepare",
    "converts at most three still-queued dry-run drafts"
  ]);
  assertFileIncludes("source-of-truth/context-checklist.md", [
    "orchestrator_batch_handoff_prepare",
    "convert at most three still-queued actions"
  ]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["orchestrator_batch_handoff_prepare"]);
  assertFileIncludes("src/lib/engine/handoff-relay.ts", [
    "createPreparedHandoffFromOrchestratorBatchDraft",
    "savePreparedHandoffFromOrchestratorBatchDraft",
    "Prepared batch Codex handoff"
  ]);
  assertFileIncludes("src/lib/engine/orchestrator-batch-handoff.ts", [
    "prepareOrchestratorBatchHandoffs",
    "orchestrator_batch_handoff_prepare",
    "savePreparedHandoffFromOrchestratorBatchDraft",
    "updateProjectMemoryFromOrchestratorAction",
    "prepared_handoff"
  ]);
});

await runStep("batch dry run provides prepare-ready drafts without side effects", async () => {
  for (let index = 0; index < 4; index += 1) {
    await saveOrchestratorRun({
      projectMemory: projectMemory({
        currentState: `Batch handoff state ${index}`,
        latestProgress: `Queued handoff action ${index}`,
        recommendedNextAction: `Prepare batch handoff action ${index}.`
      }),
      handoffs: [],
      trials: []
    });
    await sleep(5);
  }

  const beforeQueue = await listOrchestratorActionQueue();
  assertEqual(beforeQueue.length, 4, "stored queue count before prepare");
  assert(beforeQueue.every((action) => action.status === "queued"), "all actions should start queued");

  const dryRun = await createStoredOrchestratorBatchDryRun(new Date("2026-06-16T14:00:00.000Z"));
  assertEqual(dryRun.kind, "orchestrator_batch_dry_run", "source artifact kind");
  assertEqual(dryRun.status, "prepared", "dry-run status");
  assertEqual(dryRun.selectedActionIds.length, 3, "dry-run selected action count");
  assertEqual(dryRun.preparedHandoffDrafts.length, 3, "prepare-ready draft count");
  assert(dryRun.preparedHandoffDrafts.every((draft) => draft.dryRunOnly === true), "drafts remain dry-run only before preparation");
  assert(dryRun.preparedHandoffDrafts.every((draft) => draft.prompt.includes("Batch dry-run wrapper")), "drafts include batch wrapper");
  assertEqual(dryRun.execution.codexTriggered, false, "Codex not triggered");
  assertEqual(dryRun.execution.githubIssuesCreated, false, "issues not created");
  assertEqual(dryRun.execution.labelsApplied, false, "labels not applied");
  assertEqual(dryRun.execution.productionDeployed, false, "production not deployed");
  assertEqual(dryRun.execution.paidResourcesCreated, false, "paid resources not created");
  assertEqual(dryRun.execution.migrationsApplied, false, "migrations not applied");
  assertEqual(dryRun.execution.secretsOrEnvChanged, false, "secrets/env unchanged");
  assertEqual(dryRun.execution.repositoryVisibilityChanged, false, "repo visibility unchanged");
  assertEqual(dryRun.execution.autoMerged, false, "auto-merge blocked");
});

console.log(`orchestrator-batch-handoff-prepare smoke ok (${smokeRoot})`);

function projectMemory({ currentState, latestProgress, recommendedNextAction }) {
  return {
    kind: "project_memory",
    schemaVersion: 1,
    projectName: "AppEngine",
    updatedAt: "2026-06-16T00:00:00.000Z",
    latestProjectState: {
      currentState,
      latestProgress,
      recommendedNextAction,
      lastHandoffId: null
    },
    majorDecisions: [],
    acceptedApproaches: [],
    rejectedApproaches: [],
    completedMilestones: [],
    currentBlockers: [],
    openQuestions: [],
    architectureDecisions: [],
    designPreferences: [],
    lessonsLearned: [],
    futureImprovements: [],
    progressHistory: [],
    ownerFeedback: [],
    summaries: {
      executive: `${currentState}. ${latestProgress}`,
      technical: "Smoke-test memory.",
      projectStatus: "No blocker."
    },
    guardrails: {
      ownerApprovalOnly: true,
      noAutomaticCodexExecution: true,
      noGitHubIssueCreation: true,
      noLabelChanges: true,
      noProductionDeploy: true,
      noPaidResources: true,
      noMigrations: true,
      noSecretsOrEnvChanges: true,
      repositoryVisibilityUnchanged: true,
      noGeneratedAppAutoMerge: true
    }
  };
}

function runStep(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result.catch((caught) => {
        throw new Error(`${name}: ${caught instanceof Error ? caught.message : String(caught)}`);
      });
    }
  } catch (caught) {
    throw new Error(`${name}: ${caught instanceof Error ? caught.message : String(caught)}`);
  }

  return undefined;
}

function assertFileIncludes(filePath, expected) {
  const source = fs.readFileSync(path.join(repoRoot, filePath), "utf8");

  for (const phrase of expected) {
    assertIncludes(source, phrase, `${filePath} includes ${phrase}`);
  }
}

function assertIncludes(value, phrase, label) {
  if (!String(value || "").includes(phrase)) {
    throw new Error(`${label}: expected to include "${phrase}"`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
