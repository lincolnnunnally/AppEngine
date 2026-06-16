import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-orchestrator-run-"));

runStep("orchestrator source, contract, API, and UI are discoverable", () => {
  assertFileIncludes("source-of-truth/manual-orchestrator-run-button.md", ["orchestrator_run", "Run next safe step"]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/manual-orchestrator-run-button.md", "orchestrator_run"]);
  assertFileIncludes("agents/context/output-contracts.md", ["orchestrator_run", "Manual Orchestrator"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["Manual Orchestrator Run Button", "orchestrator_run"]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["orchestrator_run"]);
  assertFileIncludes("src/lib/engine/orchestrator-run.ts", ["OrchestratorRun", "createOrchestratorRun", "saveOrchestratorRun"]);
  assertFileIncludes("src/lib/engine/project-memory.ts", ["updateProjectMemoryFromOrchestratorRun"]);
  assertFileIncludes("src/app/api/engine/orchestrator-run/route.ts", ["saveOrchestratorRun", "updateProjectMemoryFromOrchestratorRun"]);
  assertFileIncludes("src/components/engine/handoff-relay-control-center.tsx", [
    "data-testid=\"manual-orchestrator-run\"",
    "Run next safe step",
    "Copy Orchestrator Prompt"
  ]);
});

runStep("real project trial path selects packet progression safely", () => {
  const { run, memory } = runOrchestrator("trial-path", {
    projectMemory: projectMemory({
      currentState: "Spark trial ready",
      latestProgress: "Spark trial generated",
      recommendedNextAction: "Review Spark trial and prepare vNext packet."
    }),
    trial: sparkTrial()
  });

  assertEqual(run.kind, "orchestrator_run", "artifact kind");
  assertEqual(run.status, "ran_successfully", "run status");
  assertEqual(run.selectedNextSafeAction, "review_latest_trial_and_prepare_next_packet", "next action");
  assertIncludes(run.nextActionPrompt.prompt, "real_project_trial", "prompt references trial");
  assertIncludes(run.nextActionPrompt.prompt, "Do not create GitHub issues", "prompt preserves issue guardrail");
  assertEqual(run.guardrails.noAutomaticCodexExecution, true, "no Codex guardrail");
  assertEqual(run.guardrails.noLabelChanges, true, "no label guardrail");
  assertIncludes(memory.latestProjectState.currentState, "Manual orchestrator ran successfully", "memory state updated");
});

runStep("active project blocker stops progression honestly", () => {
  const { run } = runOrchestrator("blocked-path", {
    projectMemory: projectMemory({
      currentState: "Blocked",
      latestProgress: "Preview route failed",
      recommendedNextAction: "Fix route-specific preview verification.",
      blocker: "Preview verification returned 404 for the expected app route."
    }),
    trial: sparkTrial()
  });

  assertEqual(run.status, "blocked", "blocked status");
  assertEqual(run.selectedNextSafeAction, "resolve_current_blocker", "blocked action");
  assertArrayTextIncludes(run.projectStateSummary.currentBlockers, "404", "blocker carried into run");
  assertIncludes(run.nextActionPrompt.expectedOutcome, "blocker-resolution", "blocker expected outcome");
});

runStep("standard safety guardrails are not mistaken for blockers", () => {
  const { run } = runOrchestrator("guardrail-only-path", {
    projectMemory: projectMemory({
      currentState: "Owner reviewed preview",
      latestProgress: "Preview verified",
      recommendedNextAction: "Prepare the next owner-reviewed packet.",
      blocker: "Production remains blocked until owner approval."
    }),
    trial: sparkTrial()
  });

  assertEqual(run.status, "ran_successfully", "guardrail-only status");
  assertEqual(run.selectedNextSafeAction, "review_latest_trial_and_prepare_next_packet", "guardrail-only next action");
  assertEqual(run.projectStateSummary.currentBlockers.length, 0, "guardrail-only blocker ignored");
});

runStep("open PR handoff requires owner approval before next work", () => {
  const { run } = runOrchestrator("owner-approval-path", {
    projectMemory: projectMemory({
      currentState: "PR open",
      latestProgress: "Feature PR created",
      recommendedNextAction: "Review PR before continuing."
    }),
    handoff: {
      kind: "handoff_relay_summary",
      receivedAt: "2026-06-16T00:00:00.000Z",
      ownerReadableSummary: "PR #97 is open and awaiting owner review.",
      extracted: {
        prNumber: 97,
        mergeStatus: "draft",
        blockers: [],
        branch: "codex/trial-result-review-loop"
      },
      projectState: {
        recommendedNextAction: "Mark PR ready only after checks finish."
      }
    }
  });

  assertEqual(run.status, "needs_owner_approval", "approval status");
  assertEqual(run.selectedNextSafeAction, "review_open_pr_before_next_work", "approval action");
  assertIncludes(run.nextActionPrompt.prompt, "PR #97", "prompt includes PR context");
});

runStep("empty state creates real-project trial prompt without side effects", () => {
  const { run } = runOrchestrator("empty-path", {
    projectMemory: projectMemory({
      currentState: "No active project",
      latestProgress: "No trial yet",
      recommendedNextAction: "Paste a handoff or add owner feedback to start project memory."
    })
  });

  assertEqual(run.selectedNextSafeAction, "create_real_project_trial", "empty next action");
  assertEqual(run.inputArtifacts.handoffRelaySummary.status, "missing", "handoff missing honestly");
  assertEqual(run.inputArtifacts.realProjectTrial.status, "missing", "trial missing honestly");
  assertEqual(run.guardrails.noGitHubIssueCreation, true, "no issue creation");
  assertEqual(run.guardrails.noProductionDeploy, true, "no production deploy");
  assertEqual(run.guardrails.noPaidResources, true, "no paid resources");
});

console.log(`orchestrator-run smoke ok (${smokeRoot})`);

function runOrchestrator(name, input) {
  const inputPath = path.join(smokeRoot, `${name}.json`);
  const runOutput = path.join(smokeRoot, `${name}-run.json`);
  const memoryOutput = path.join(smokeRoot, `${name}-memory.json`);

  writeJson(inputPath, input);
  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-orchestrator-run.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ORCHESTRATOR_RUN_INPUT: inputPath,
      ORCHESTRATOR_RUN_OUTPUT: runOutput,
      ORCHESTRATOR_RUN_MEMORY_OUTPUT: memoryOutput
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return {
    run: JSON.parse(fs.readFileSync(runOutput, "utf8")),
    memory: JSON.parse(fs.readFileSync(memoryOutput, "utf8"))
  };
}

function projectMemory({ currentState, latestProgress, recommendedNextAction, blocker = "" }) {
  return {
    kind: "project_memory",
    schemaVersion: 1,
    projectName: "AppEngine",
    latestProjectState: {
      currentState,
      latestProgress,
      recommendedNextAction,
      lastHandoffId: null
    },
    completedMilestones: [],
    currentBlockers: blocker ? [{ text: blocker }] : [],
    progressHistory: [],
    futureImprovements: [],
    summaries: {
      executive: `${currentState}. ${latestProgress}`,
      technical: "Smoke-test memory.",
      projectStatus: blocker || "No blocker."
    }
  };
}

function sparkTrial() {
  return {
    kind: "real_project_trial",
    schemaVersion: 1,
    id: "trial_spark-of-hope-intake-lite_test",
    createdAt: "2026-06-16T00:00:01.000Z",
    project: {
      name: "Spark of Hope Intake Lite",
      slug: "spark-of-hope-intake-lite",
      source: "portfolio"
    },
    problemBeingSolved: "People need a simple way to share a story and receive encouragement.",
    targetAudience: "People looking for hope and ministry reviewers.",
    desiredTransformation: "Move someone from silence toward hope and a clear next step.",
    designIntent: "warm_approachable, ministry_community, hopeful, trustworthy, mobile-first.",
    currentStage: "Trial summary generated.",
    nextSafeAction: "Prepare the next owner-reviewed vNext packet.",
    risksBlockers: ["Production remains blocked."],
    recommendedPacketType: "vnext_packet",
    ownerReadableSummary: "Spark of Hope Intake Lite is ready for a safe real-project trial."
  };
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

function assertArrayTextIncludes(items, phrase, label) {
  if (!items.some((item) => String(item).includes(phrase))) {
    throw new Error(`${label}: expected an item containing "${phrase}"`);
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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
