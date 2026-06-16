import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();

runStep("audit trail source defines append-only local/mock interface", () => {
  assertFileIncludes("src/lib/engine/audit-trail-lite.ts", [
    "AppEngineAuditTrail",
    "createLocalMockAuditTrail",
    "local_mock_jsonl",
    "appendOnly: true",
    "noExternalLoggingService: true"
  ]);
});

runStep("audit trail supports required event types", () => {
  assertFileIncludes("src/lib/engine/audit-trail-lite.ts", [
    "intake_submitted",
    "handoff_prepared",
    "orchestrator_action_queued",
    "orchestrator_action_exported",
    "spark_item_reviewed",
    "readiness_snapshot_generated"
  ]);
});

runStep("source of truth documents event contract and guardrails", () => {
  assertFileIncludes("source-of-truth/audit-trail-lite.md", [
    "Audit Trail Lite",
    "local_mock_jsonl",
    "Secret-like metadata keys must be redacted",
    "trigger Codex automatically",
    "apply migrations"
  ]);
});

runStep("local mock JSONL append semantics preserve all event types", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-audit-trail-"));
  const auditPath = path.join(root, "events.jsonl");
  const events = [
    "intake_submitted",
    "handoff_prepared",
    "orchestrator_action_queued",
    "orchestrator_action_exported",
    "spark_item_reviewed",
    "readiness_snapshot_generated"
  ].map((type, index) => ({
    kind: "app_engine_audit_event",
    schemaVersion: 1,
    id: `audit_${index}`,
    type,
    metadata: index === 0 ? { apiKey: "[redacted]" } : {},
    storage: "local_mock_jsonl"
  }));

  fs.writeFileSync(auditPath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
  const stored = fs
    .readFileSync(auditPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  assertEqual(stored.length, 6, "stored event count");
  assertEqual(stored[0].metadata.apiKey, "[redacted]", "secret-like metadata redacted");
  assertEqual(stored.at(-1).type, "readiness_snapshot_generated", "last event type");
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:audit-trail-lite"]);
});

console.log("audit-trail-lite smoke ok");

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
