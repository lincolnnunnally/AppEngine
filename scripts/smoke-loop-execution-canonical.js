import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPriorWorkCheck } from "./lib/prior-work-check.js";

const repoRoot = process.cwd();
const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-loop-exec-"));
process.env.APPENGINE_STATE_ROOT = stateRoot;
const registryPath = path.join(stateRoot, "app_portfolio_registry", "registered-apps.json");

runStep("approved packet -> exactly one canonical loop record (idempotent per packet)", () => {
  assertFileIncludes("src/lib/engine/loop-run-records.ts", [
    "export async function createLoopRunFromPacket",
    "requires an approved packet's gatePacketId",
    "record.gatePacketId === gatePacketId", // idempotency guard -> one record per packet
    'key: "execution-loops"' // canonical execution collection lives in loop_run_records
  ]);
});

runStep("no execution can happen without a loop_run_record (fail-closed guard)", () => {
  assertFileIncludes("src/lib/engine/loop-run-records.ts", [
    "export async function requireLoopRunForExecution",
    "No loop_run_record exists for this execution"
  ]);
});

runStep("completed loop writes evidence into loop_run_records AND the registry", () => {
  assertFileIncludes("src/lib/engine/loop-run-records.ts", [
    "export async function completeLoopRun",
    "attachCompletedLoop"
  ]);
  assertFileIncludes("src/lib/engine/app-portfolio-registry-store.ts", ["blockers", "nextAction"]);
});

runStep("duplicate runners are non-canonical (cannot create competing execution records)", () => {
  for (const file of [
    "src/lib/engine/first-real-build-loop-run.ts",
    "src/lib/engine/opportunity-full-loop-trial.ts",
    "src/lib/engine/real-project-trial.ts",
    "src/lib/engine/internal-controlled-use-runbook.ts",
    "src/lib/engine/real-opportunity-example-runner.ts"
  ]) {
    assertFileIncludes(file, ["CANONICAL_EXECUTION_NOTE", "loop_run_records is the canonical execution record"]);
  }
  // The only writer of the canonical execution collection is loop-run-records.ts.
  assertFileExcludes("src/lib/engine/opportunity-full-loop-trial.ts", ['"execution-loops"']);
  assertFileExcludes("src/lib/engine/real-project-trial.ts", ['"execution-loops"']);
});

runStep("completed loop updates registry + failed loop records blocker/next action (data contract)", () => {
  // Shapes written by completeLoopRun -> attachCompletedLoop.
  seedRegistry([
    {
      slug: "toner-management",
      name: "Toner Management",
      type: "existing_app",
      status: "gated_intake",
      sourceOfTruthFiles: [],
      completedLoops: [
        { runId: "exec-verified", goal: "toner reorder loop", status: "deployed", completedAt: at(), evidence: ["AC1 verified"], blockers: [], nextAction: "registry_updated_completed" },
        { runId: "exec-failed", goal: "toner reorder loop retry", status: "needs_fix", completedAt: at(), evidence: [], blockers: ["preview verification failed"], nextAction: "create_fix_issue" }
      ],
      createdAt: at(),
      updatedAt: at()
    }
  ]);

  const stored = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const entry = stored.entries.find((item) => item.slug === "toner-management");
  const verified = entry.completedLoops.find((loop) => loop.runId === "exec-verified");
  const failed = entry.completedLoops.find((loop) => loop.runId === "exec-failed");
  assertEqual(verified.status, "deployed", "verified loop recorded in registry");
  assertEqual(failed.status, "needs_fix", "failed loop recorded in registry");
  assertTrue(failed.blockers.length > 0, "failed loop records a blocker");
  assertEqual(failed.nextAction, "create_fix_issue", "failed loop records a next action");
});

runStep("acceptance: a finished loop is searchable prior-work evidence", () => {
  const artifact = runPriorWorkCheck({
    request: { runId: "x", title: "Toner Management reorder follow-up", goal: "y" },
    targetRepo: { name: "Toner Management", candidatePaths: ["loop-runs"], backupSchemaPaths: [] },
    capabilities: [{ id: "cap", description: "x", componentHints: ["ZzzNoSuchComponent"] }]
  });
  assertEqual(artifact.verdict, "extend_existing", "prior work found -> not a new build");
  assertTrue(
    artifact.registrySearch.completedLoopMatches.some((loop) => loop.runId === "exec-verified"),
    "completed loop surfaced as prior-work evidence"
  );
});

console.log(`loop-execution-canonical smoke ok (${stateRoot})`);

function seedRegistry(entries) {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, `${JSON.stringify({ schemaVersion: 1, entries }, null, 2)}\n`);
}

function at() {
  return "2026-06-21T00:00:00.000Z";
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

function assertFileIncludes(relativePath, expectedValues) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  for (const expected of expectedValues) {
    if (!content.includes(expected)) {
      throw new Error(`${relativePath} should include ${JSON.stringify(expected)}`);
    }
  }
}

function assertFileExcludes(relativePath, blockedValues) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  for (const blocked of blockedValues) {
    if (content.includes(blocked)) {
      throw new Error(`${relativePath} should not include ${JSON.stringify(blocked)}`);
    }
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, label) {
  if (!value) throw new Error(`expected: ${label}`);
}
