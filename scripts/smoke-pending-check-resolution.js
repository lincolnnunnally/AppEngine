import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-pending-check-resolution-"));

runStep("pending check policy, artifact, orchestrator, and UI are discoverable", () => {
  assertFileIncludes("source-of-truth/pending-check-resolution-policy.md", [
    "pending_check_resolution",
    "Required Checks",
    "Advisory Checks",
    "Blocking Checks",
    "APPENGINE_PENDING_CHECK_TIMEOUT_MINUTES"
  ]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/pending-check-resolution-policy.md", "pending_check_resolution"]);
  assertFileIncludes("agents/context/output-contracts.md", ["pending_check_resolution", "Pending Check Resolution"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["Pending Check Resolution Policy", "pending_check_resolution"]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["pending_check_resolution"]);
  assertFileIncludes("src/lib/engine/pending-check-resolution.ts", ["PendingCheckResolution", "createPendingCheckResolution"]);
  assertFileIncludes("src/lib/engine/orchestrator-run.ts", ["pendingCheckResolution", "owner_review_with_advisory_pending_check"]);
  assertFileIncludes("src/components/engine/handoff-relay-control-center.tsx", [
    "data-testid=\"pending-check-resolution-policy\"",
    "Pending Check Resolution"
  ]);
});

runStep("stale advisory pending check becomes owner-reviewable without merge approval", () => {
  const artifact = resolvePendingChecks("stale-advisory", {
    timeoutMinutes: 45,
    checks: [...passedRequiredChecks(), check("Vercel", "advisory", "pending", "vercel", 63)]
  });

  assertEqual(artifact.status, "review_ready_with_advisory_pending", "status");
  assertEqual(artifact.reviewReady, true, "review ready");
  assertEqual(artifact.guardrails.noAutomaticMerge, true, "no automatic merge");
  assertEqual(artifact.guardrails.noBypassFailingChecks, true, "no bypass failing checks");
  assertIncludes(artifact.ownerReadableSummary, "not merge approval", "owner summary keeps merge blocked");
});

runStep("failed checks block instead of becoming advisory", () => {
  const artifact = resolvePendingChecks("failed-check", {
    timeoutMinutes: 45,
    checks: [...passedRequiredChecks(), check("Vercel", "advisory", "failed", "vercel", 63)]
  });

  assertEqual(artifact.status, "blocked_by_failed_check", "status");
  assertEqual(artifact.reviewReady, false, "review ready");
  assertIncludes(artifact.nextSafeAction, "fix_failed_check", "next action");
});

runStep("required pending check blocks review readiness", () => {
  const artifact = resolvePendingChecks("required-pending", {
    timeoutMinutes: 45,
    checks: [
      check("source:check", "required", "passed", "local"),
      check("typecheck", "required", "pending", "local", 12),
      check("build", "required", "passed", "local"),
      check("smoke tests", "required", "passed", "local"),
      check("GitHub PR Verification", "required", "passed", "github")
    ]
  });

  assertEqual(artifact.status, "blocked_by_required_pending", "status");
  assertEqual(artifact.reviewReady, false, "review ready");
  assertIncludes(artifact.ownerReadableSummary, "required or blocking checks", "owner summary");
});

runStep("young advisory pending check waits for timeout", () => {
  const artifact = resolvePendingChecks("young-advisory", {
    timeoutMinutes: 45,
    checks: [...passedRequiredChecks(), check("Vercel", "advisory", "pending", "vercel", 20)]
  });

  assertEqual(artifact.status, "waiting_for_timeout", "status");
  assertEqual(artifact.reviewReady, false, "review ready");
  assertIncludes(artifact.nextSafeAction, "wait_for_external_pending_timeout", "next action");
});

runStep("manual orchestrator can route stale advisory pending status to owner review", () => {
  const pendingCheckResolution = resolvePendingChecks("orchestrator-stale-advisory", {
    timeoutMinutes: 45,
    checks: [...passedRequiredChecks(), check("Vercel", "advisory", "pending", "vercel", 63)]
  });
  const { run } = runOrchestrator("orchestrator-with-pending-resolution", {
    projectMemory: projectMemory(),
    pendingCheckResolution
  });

  assertEqual(run.status, "needs_owner_approval", "orchestrator status");
  assertEqual(run.selectedNextSafeAction, "owner_review_with_advisory_pending_check", "orchestrator action");
  assertEqual(run.inputArtifacts.pendingCheckResolution.status, "available", "artifact available");
  assertIncludes(run.nextActionPrompt.prompt, "pending_check_resolution", "prompt references artifact");
});

console.log(`pending-check-resolution smoke ok (${smokeRoot})`);

function resolvePendingChecks(name, input) {
  const inputPath = path.join(smokeRoot, `${name}.json`);
  const outputPath = path.join(smokeRoot, `${name}-output.json`);

  writeJson(inputPath, input);
  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-pending-check-resolution.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PENDING_CHECK_RESOLUTION_INPUT: inputPath,
      PENDING_CHECK_RESOLUTION_OUTPUT: outputPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return JSON.parse(fs.readFileSync(outputPath, "utf8"));
}

function runOrchestrator(name, input) {
  const inputPath = path.join(smokeRoot, `${name}.json`);
  const runOutput = path.join(smokeRoot, `${name}-run.json`);

  writeJson(inputPath, input);
  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-orchestrator-run.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ORCHESTRATOR_RUN_INPUT: inputPath,
      ORCHESTRATOR_RUN_OUTPUT: runOutput
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return {
    run: JSON.parse(fs.readFileSync(runOutput, "utf8"))
  };
}

function passedRequiredChecks() {
  return [
    check("source:check", "required", "passed", "local"),
    check("typecheck", "required", "passed", "local"),
    check("build", "required", "passed", "local"),
    check("smoke tests", "required", "passed", "local"),
    check("GitHub PR Verification", "required", "passed", "github")
  ];
}

function check(name, category, state, provider, ageMinutes = 0) {
  return { name, category, state, provider, ageMinutes };
}

function projectMemory() {
  return {
    kind: "project_memory",
    schemaVersion: 1,
    projectName: "AppEngine",
    latestProjectState: {
      currentState: "PR verification complete",
      latestProgress: "Required checks passed; external status may be stale.",
      recommendedNextAction: "Use pending_check_resolution before deciding owner review status.",
      lastHandoffId: null
    },
    completedMilestones: [],
    currentBlockers: [],
    progressHistory: [],
    futureImprovements: [],
    summaries: {
      executive: "Required checks passed; external status may be stale.",
      technical: "Smoke-test memory.",
      projectStatus: "No blocker."
    }
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
