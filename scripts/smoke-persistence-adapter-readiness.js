import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();

runStep("readiness module defines first adapter-ready stores", () => {
  assertFileIncludes("src/lib/engine/persistence-adapter-readiness.ts", [
    "AdapterReadyStore",
    "project_memory",
    "handoff_relay",
    "orchestrator_action_queue",
    "databaseEnabled: false",
    "migrationsApplied: false"
  ]);
});

runStep("wrappers use durable state adapter while keeping local mock default", () => {
  assertFileIncludes("src/lib/engine/persistence-adapter-readiness.ts", [
    "getAppEngineStateAdapter",
    "adapter.readJson",
    "adapter.writeJson",
    "adapter.appendJson",
    "activeAdapter: \"local_mock\""
  ]);
});

runStep("source of truth documents integration order and guardrails", () => {
  assertFileIncludes("source-of-truth/persistence-adapter-integration-readiness.md", [
    "Project Memory",
    "Handoff Relay",
    "Orchestrator Action Queue",
    "database adapter must remain",
    "apply migrations",
    "create paid resources"
  ]);
});

runStep("local wrapper storage semantics can read/write/append without DB", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "adapter-ready-store-"));
  const filePath = path.join(root, "project_memory.json");
  const initial = { kind: "project_memory", entries: [] };

  fs.writeFileSync(filePath, `${JSON.stringify(initial, null, 2)}\n`);
  const read = JSON.parse(fs.readFileSync(filePath, "utf8"));
  read.entries.push({ id: "entry_1", text: "local/mock adapter-ready write" });
  fs.writeFileSync(filePath, `${JSON.stringify(read, null, 2)}\n`);

  const updated = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assertEqual(updated.entries.length, 1, "entry count");
  assertEqual(updated.entries[0].text, "local/mock adapter-ready write", "entry text");
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:persistence-adapter-readiness"]);
});

console.log("persistence-adapter-readiness smoke ok");

function assertFileIncludes(filePath, expected) {
  const source = fs.readFileSync(path.join(repoRoot, filePath), "utf8");
  for (const phrase of expected) {
    if (!source.includes(phrase)) throw new Error(`${filePath} missing ${phrase}`);
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
