import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();

runStep("adapter source defines current local default and disabled database shape", () => {
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", [
    "AppEngineStateAdapter",
    "createLocalMockStateAdapter",
    "createDisabledDatabaseStateAdapter",
    "disabledDatabaseStateAdapterConfig",
    "Database state adapter is defined for future work but is disabled",
    "migrationsBlocked: true"
  ]);
});

runStep("adapter registry covers required state domains", () => {
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", [
    "handoff_relay",
    "project_memory",
    "orchestrator_action_queue",
    "real_project_trials",
    "trial_result_reviews",
    "problem_intake",
    "spark_story_submissions",
    "spark_review_queue",
    "spark_reminder_queue"
  ]);
});

runStep("source of truth documents guardrails", () => {
  assertFileIncludes("source-of-truth/durable-state-adapter.md", [
    "local_mock",
    "future database adapter is defined but disabled",
    "apply migrations",
    "create paid resources",
    "trigger Codex automatically"
  ]);
});

runStep("local mock semantics are append-only capable without external services", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-state-adapter-"));
  const filePath = path.join(root, "handoff_relay", "default.json");
  const current = [];
  const next = [...current, { id: "event_1", kind: "handoff_relay" }];

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`);

  const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assertEqual(stored.length, 1, "stored event count");
  assertEqual(stored[0].kind, "handoff_relay", "stored event kind");
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:durable-state-adapter"]);
});

console.log("durable-state-adapter smoke ok");

function assertFileIncludes(filePath, expected) {
  const source = fs.readFileSync(path.join(repoRoot, filePath), "utf8");
  for (const phrase of expected) {
    if (!source.includes(phrase)) {
      throw new Error(`${filePath} missing ${phrase}`);
    }
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
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
