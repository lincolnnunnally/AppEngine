import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-orchestrator-action-queue-"));

process.chdir(smokeRoot);

const orchestratorModule = await import(pathToFileURL(path.join(repoRoot, "src/lib/engine/orchestrator-run.ts")).href);
const projectMemoryModule = await import(pathToFileURL(path.join(repoRoot, "src/lib/engine/project-memory.ts")).href);

const {
  createOrchestratorRun,
  listOrchestratorActionQueue,
  markOrchestratorActionPreparedHandoff,
  saveOrchestratorRun,
  updateOrchestratorActionStatus
} = orchestratorModule;
const { loadProjectMemory, updateProjectMemoryFromOrchestratorAction, updateProjectMemoryFromOrchestratorRun } =
  projectMemoryModule;

await runStep("source contracts are discoverable", () => {
  assertFileIncludes("source-of-truth/orchestrator-decision-trace-action-queue.md", [
    "Orchestrator Decision Trace + Action Queue",
    "orchestrator_action_queue",
    "queued",
    "prepared_handoff",
    "completed"
  ]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/orchestrator-decision-trace-action-queue.md"]);
  assertFileIncludes("agents/context/output-contracts.md", ["orchestrator_action_queue", "decision trace"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["record a decision trace", "queue the recommended next safe action locally/mock"]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["orchestrator_action_queue"]);
});

await runStep("manual orchestrator creates decision trace and local action queue", () => {
  const run = createOrchestratorRun(
    {
      projectMemory: projectMemory({
        currentState: "Ready for next safe action",
        latestProgress: "Owner reviewed the last PR",
        recommendedNextAction: "Prepare the next owner-reviewed orchestrator handoff."
      }),
      handoffs: [],
      trials: []
    },
    new Date("2026-06-16T12:00:00.000Z")
  );

  assertEqual(run.kind, "orchestrator_run", "run kind");
  assertEqual(run.decisionTrace.selectedAction, "follow_project_memory_next_action", "decision trace action");
  assertEqual(run.decisionTrace.confidenceLevel, "high", "confidence level");
  assertIncludes(run.decisionTrace.selectionReason, "Project Memory", "selection reason");
  assertEqual(run.actionQueue.kind, "orchestrator_action_queue", "queue kind");
  assertEqual(run.actionQueue.storage, "local_mock", "queue storage");
  assertEqual(run.actionQueue.items.length, 1, "queued action count");
  assertEqual(run.actionQueue.items[0].status, "queued", "queued status");
  assertEqual(run.actionQueue.items[0].sourceRunId, run.id, "queue source run");
  assertIncludes(run.actionQueue.items[0].prompt, "Do not create GitHub issues", "queue prompt guardrail");
  assertEqual(run.guardrails.noAutomaticCodexExecution, true, "run no Codex guardrail");
  assertEqual(run.actionQueue.guardrails.noGitHubIssueCreation, true, "queue no issue guardrail");
});

await runStep("saved runs persist queue locally and can move to prepared handoff", async () => {
  const run = await saveOrchestratorRun({
    projectMemory: projectMemory({
      currentState: "Ready for handoff",
      latestProgress: "Orchestrator can prepare a handoff",
      recommendedNextAction: "Prepare Codex handoff for owner copy."
    }),
    handoffs: [],
    trials: []
  });

  const queued = await listOrchestratorActionQueue();
  assertEqual(queued.length, 1, "stored queue count");
  assertEqual(queued[0].sourceRunId, run.id, "stored queue source");

  const prepared = await markOrchestratorActionPreparedHandoff(run.id, new Date("2026-06-16T12:05:00.000Z"));
  assert(prepared, "prepared handoff action should be returned");
  assertEqual(prepared.status, "prepared_handoff", "prepared status");

  const afterPrepare = await listOrchestratorActionQueue();
  assertEqual(afterPrepare[0].status, "prepared_handoff", "queue status after prepare");
});

await runStep("Project Memory records queued and completed actions", async () => {
  const run = createOrchestratorRun(
    {
      projectMemory: projectMemory({
        currentState: "Action queue test",
        latestProgress: "Testing memory updates",
        recommendedNextAction: "Queue a safe owner-reviewed action."
      }),
      handoffs: [],
      trials: []
    },
    new Date("2026-06-16T12:10:00.000Z")
  );

  await updateProjectMemoryFromOrchestratorRun(run);
  const afterQueue = await loadProjectMemory();
  assertArrayTextIncludes(afterQueue.futureImprovements, "Queued orchestrator action", "queued action memory");
  assertArrayTextIncludes(afterQueue.progressHistory, "Decision trace considered", "decision trace memory");

  await saveOrchestratorRun({
    projectMemory: projectMemory({
      currentState: "Complete action",
      latestProgress: "Queue item exists",
      recommendedNextAction: "Complete the queued action."
    }),
    handoffs: [],
    trials: []
  });
  const [queuedAction] = await listOrchestratorActionQueue();
  const completed = await updateOrchestratorActionStatus(queuedAction.id, "completed", new Date("2026-06-16T12:15:00.000Z"));
  assert(completed, "completed action should be returned");
  assertEqual(completed.status, "completed", "completed status");
  assert(completed.completedAt, "completed action should have completedAt");

  await updateProjectMemoryFromOrchestratorAction(completed);
  const afterComplete = await loadProjectMemory();
  assertIncludes(afterComplete.latestProjectState.currentState, "completed", "completed state memory");
  assertArrayTextIncludes(afterComplete.completedMilestones, "Completed queued orchestrator action", "completed milestone memory");
});

console.log(`orchestrator-action-queue smoke ok (${smokeRoot})`);

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

function assertArrayTextIncludes(items, phrase, label) {
  if (!items.some((item) => String(item.text || item).includes(phrase))) {
    throw new Error(`${label}: expected an item containing "${phrase}"`);
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
