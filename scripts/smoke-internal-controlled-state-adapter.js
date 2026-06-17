import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-internal-state-adapter-"));
const adapterRoot = path.join(smokeRoot, "adapter-state");

process.env.APPENGINE_STATE_ROOT = adapterRoot;
delete process.env.APPENGINE_STATE_ADAPTER;
process.chdir(smokeRoot);

const handoffModule = await import(pathToFileURL(path.join(repoRoot, "src/lib/engine/handoff-relay.ts")).href);
const projectMemoryModule = await import(pathToFileURL(path.join(repoRoot, "src/lib/engine/project-memory.ts")).href);
const orchestratorModule = await import(pathToFileURL(path.join(repoRoot, "src/lib/engine/orchestrator-run.ts")).href);

await runStep("handoff and project memory use adapter-backed local state", async () => {
  const summary = await handoffModule.saveHandoffRelaySummary(
    [
      "PR #129 merged: Controlled Use Readiness Summary.",
      "Verification: source:check passed, controlled-use smoke passed, typecheck passed, build passed.",
      "What changed: AppEngine is ready for internal controlled use, but durable state activation remains the first blocker.",
      "Guardrails: no production deploy, no paid resources, no migrations, no secrets/env changes.",
      "Next action: activate adapter-backed internal state stores."
    ].join("\n")
  );

  const handoffs = await handoffModule.listHandoffRelaySummaries();
  const memory = await projectMemoryModule.loadProjectMemory();

  assertEqual(summary.kind, "handoff_relay_summary", "handoff kind");
  assertEqual(handoffs.length, 1, "stored handoff count");
  assertIncludes(memory.latestProjectState.latestProgress, "Controlled Use Readiness Summary", "memory progress");
  assertAdapterFile("handoff_relay/default.json", "handoffs");
  assertAdapterFile("project_memory/default.json", "memory");
});

await runStep("orchestrator runs and action queue use separate adapter scopes", async () => {
  const memory = await projectMemoryModule.loadProjectMemory();
  const run = await orchestratorModule.saveOrchestratorRun({
    projectMemory: {
      ...memory,
      currentBlockers: [],
      latestProjectState: {
        ...memory.latestProjectState,
        currentState: "Internal controlled use activation",
        latestProgress: "Adapter-backed memory and handoffs are active.",
        recommendedNextAction: "Prepare the next owner-reviewed controlled-use action."
      },
      summaries: {
        ...memory.summaries,
        executive: "Internal controlled use activation is underway."
      }
    },
    handoffs: await handoffModule.listHandoffRelaySummaries(),
    trials: []
  });

  const runs = await orchestratorModule.listOrchestratorRuns();
  const queue = await orchestratorModule.listOrchestratorActionQueue();

  assertEqual(run.kind, "orchestrator_run", "run kind");
  assertEqual(runs.length, 1, "stored run count");
  assertEqual(queue.length, 1, "stored action queue count");
  assertEqual(queue[0].storage, "local_mock", "queue storage mode");
  assertAdapterArray("orchestrator_runs/default.json", 1);
  assertAdapterArray("orchestrator_action_queue/default.json", 1);
});

await runStep("legacy store files are read-compatible but no longer written", async () => {
  assertMissingLegacyFile("project-memory.json");
  assertMissingLegacyFile("handoff-relay.json");
  assertMissingLegacyFile("orchestrator-runs.json");
});

console.log(`internal-controlled-state-adapter smoke ok (${smokeRoot})`);

function assertAdapterFile(relativePath, expectedKey) {
  const value = readAdapterJson(relativePath);
  if (!Object.hasOwn(value, expectedKey)) {
    throw new Error(`${relativePath} missing ${expectedKey}`);
  }
}

function assertAdapterArray(relativePath, expectedLength) {
  const value = readAdapterJson(relativePath);
  if (!Array.isArray(value)) {
    throw new Error(`${relativePath} should contain an array`);
  }
  assertEqual(value.length, expectedLength, `${relativePath} length`);
}

function readAdapterJson(relativePath) {
  const filePath = path.join(adapterRoot, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`missing adapter file ${relativePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertMissingLegacyFile(fileName) {
  const filePath = path.join(smokeRoot, ".app-engine", fileName);
  if (fs.existsSync(filePath)) throw new Error(`legacy file should not be written: ${fileName}`);
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

async function runStep(label, fn) {
  try {
    await fn();
    console.log(`ok - ${label}`);
  } catch (error) {
    console.error(`not ok - ${label}`);
    throw error;
  }
}
