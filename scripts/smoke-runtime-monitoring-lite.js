import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("runtime monitoring artifact covers required components", () => {
  assertFileIncludes("src/lib/engine/runtime-monitoring-lite.ts", [
    "runtime_monitoring_lite",
    "persistence_adapter",
    "orchestrator",
    "handoff_relay",
    "audit_trail",
    "spark_review_flow"
  ]);
});

runStep("runtime report stays local/mock and owner-readable", () => {
  assertFileIncludes("src/lib/engine/runtime-monitoring-lite.ts", [
    "ownerReadableSummary",
    "localMockOnly: true",
    "noExternalMonitoringService: true",
    "browser_local_storage",
    "database_disabled"
  ]);
});

runStep("runtime monitoring reads existing safe stores", () => {
  assertFileIncludes("src/lib/engine/runtime-monitoring-lite.ts", [
    "getAppEngineStateAdapter",
    "listOrchestratorRuns",
    "listOrchestratorActionQueue",
    "listHandoffRelaySummaries",
    "getAppEngineAuditTrail",
    "sparkReviewStatuses"
  ]);
});

runStep("source of truth documents components and guardrails", () => {
  assertFileIncludes("source-of-truth/runtime-monitoring-lite.md", [
    "Runtime Monitoring Lite",
    "persistence adapter",
    "orchestrator",
    "handoff relay",
    "audit trail",
    "Spark review flow",
    "connect to external monitoring/logging services"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:runtime-monitoring-lite"]);
});

console.log("runtime-monitoring-lite smoke ok");

function assertFileIncludes(filePath, expected) {
  const source = fs.readFileSync(path.join(root, filePath), "utf8");
  for (const phrase of expected) {
    if (!source.includes(phrase)) {
      throw new Error(`${filePath} missing ${phrase}`);
    }
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
