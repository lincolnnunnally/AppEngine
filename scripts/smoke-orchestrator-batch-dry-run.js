import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-orchestrator-batch-dry-run-"));

process.chdir(smokeRoot);

const orchestratorModule = await import(pathToFileURL(path.join(repoRoot, "src/lib/engine/orchestrator-run.ts")).href);

const { createOrchestratorBatchDryRun, createOrchestratorRun } = orchestratorModule;

await runStep("source contracts are discoverable", () => {
  assertFileIncludes("source-of-truth/orchestrator-batch-dry-run.md", [
    "orchestrator_batch_dry_run",
    "Select at most three safe queued actions",
    "Dry-run only"
  ]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/orchestrator-batch-dry-run.md"]);
  assertFileIncludes("agents/context/output-contracts.md", ["orchestrator_batch_dry_run", "up to three queued actions"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["orchestrator_batch_dry_run", "no more than three queued actions"]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["orchestrator_batch_dry_run"]);
});

await runStep("batch dry run prepares up to three queued actions only", () => {
  const runs = [0, 1, 2, 3].map((index) =>
    createOrchestratorRun(
      {
        projectMemory: projectMemory({
          currentState: `Batch state ${index}`,
          latestProgress: `Queued action ${index}`,
          recommendedNextAction: `Prepare owner-reviewed action ${index}.`
        }),
        handoffs: [],
        trials: []
      },
      new Date(`2026-06-16T12:0${index}:00.000Z`)
    )
  );
  const queuedActions = runs.map((run) => run.actionQueue.items[0]);
  const blockedAction = {
    ...queuedActions[0],
    id: "blocked-action",
    status: "blocked"
  };
  const completedAction = {
    ...queuedActions[1],
    id: "completed-action",
    status: "completed"
  };
  const emptyPromptAction = {
    ...queuedActions[2],
    id: "empty-prompt-action",
    prompt: ""
  };
  const batch = createOrchestratorBatchDryRun(
    [...queuedActions, blockedAction, completedAction, emptyPromptAction],
    runs,
    new Date("2026-06-16T13:00:00.000Z")
  );

  assertEqual(batch.kind, "orchestrator_batch_dry_run", "artifact kind");
  assertEqual(batch.status, "prepared", "batch status");
  assertEqual(batch.storage, "local_mock", "storage");
  assertEqual(batch.dryRunOnly, true, "dry run flag");
  assertEqual(batch.selectionLimit, 3, "selection limit");
  assertEqual(batch.selectedActionIds.length, 3, "selected action count");
  assertEqual(batch.preparedHandoffDrafts.length, 3, "prepared handoff count");
  assert(batch.skippedActions.length >= 4, "skipped actions should include limit and unsafe items");
  assert(batch.skippedActions.some((item) => item.actionId === "blocked-action"), "blocked action should be skipped");
  assert(batch.skippedActions.some((item) => item.actionId === "completed-action"), "completed action should be skipped");
  assert(batch.skippedActions.some((item) => item.actionId === "empty-prompt-action"), "empty-prompt action should be skipped");
  assert(
    batch.skippedActions.some((item) => item.reason.includes("batch limit")),
    "extra queued actions should be skipped by batch limit"
  );

  for (const draft of batch.preparedHandoffDrafts) {
    assertEqual(draft.dryRunOnly, true, "draft dry run flag");
    assertIncludes(draft.prompt, "Batch dry-run wrapper", "draft prompt wrapper");
    assertIncludes(draft.prompt, "Do not trigger Codex automatically", "draft Codex guardrail");
    assertIncludes(draft.guardrails.join("\n"), "Dry-run batch only", "draft dry-run guardrail");
  }

  assertEqual(batch.execution.codexTriggered, false, "Codex not triggered");
  assertEqual(batch.execution.githubIssuesCreated, false, "issues not created");
  assertEqual(batch.execution.labelsApplied, false, "labels not applied");
  assertEqual(batch.execution.productionDeployed, false, "production not deployed");
  assertEqual(batch.execution.paidResourcesCreated, false, "paid resources not created");
  assertEqual(batch.execution.migrationsApplied, false, "migrations not applied");
  assertEqual(batch.execution.secretsOrEnvChanged, false, "secrets/env unchanged");
  assertEqual(batch.execution.repositoryVisibilityChanged, false, "repo visibility unchanged");
  assertEqual(batch.execution.autoMerged, false, "auto-merge blocked");
});

await runStep("batch dry run fails honestly when no queued prompt is available", () => {
  const batch = createOrchestratorBatchDryRun(
    [
      {
        id: "blocked-only",
        sourceRunId: "run-1",
        action: "blocked_action",
        title: "Blocked action",
        status: "blocked",
        reason: "Blocked for safety.",
        ownerApprovalRequired: true,
        prompt: "Do nothing.",
        expectedOutcome: "No-op.",
        dependencies: [],
        guardrails: [],
        createdAt: "2026-06-16T12:00:00.000Z",
        updatedAt: "2026-06-16T12:00:00.000Z",
        completedAt: null,
        storage: "local_mock"
      }
    ],
    [],
    new Date("2026-06-16T13:05:00.000Z")
  );

  assertEqual(batch.status, "no_safe_actions", "no-safe-action status");
  assertEqual(batch.preparedHandoffDrafts.length, 0, "no prepared drafts");
  assertEqual(batch.nextSafeAction, "queue_safe_actions_before_batch_dry_run", "next safe action");
  assertIncludes(batch.ownerReadableSummary, "No safe queued", "owner summary");
});

console.log(`orchestrator-batch-dry-run smoke ok (${smokeRoot})`);

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
