import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("readiness artifact uses Neon recommendation and local fallback", () => {
  assertFileIncludes("src/lib/engine/persistence-activation-readiness.ts", [
    "persistence_activation_readiness",
    "Neon Postgres",
    "local_mock file storage",
    "neonPersistenceAdapterDraftConfig",
    "validateNeonPersistenceConnectionStub"
  ]);
});

runStep("readiness maps all local/mock state stores", () => {
  assertFileIncludes("src/lib/engine/persistence-activation-readiness.ts", [
    "appEngineStateStores",
    "localMockStores",
    "durableAdapterSupport",
    "browser_storage_needs_server_store",
    "needs_adapter_wrapper",
    "adapter_interface_ready"
  ]);
});

runStep("activation checklist blocks migrations and live database activation", () => {
  assertFileIncludes("src/lib/engine/persistence-activation-readiness.ts", [
    "blocked_pending_prerequisites",
    "schema_design_reviewed",
    "migration_plan_reviewed",
    "noLiveDatabaseConnection: true",
    "noMigrations: true"
  ]);
});

runStep("source of truth documents checklist and guardrails", () => {
  assertFileIncludes("source-of-truth/persistence-activation-readiness.md", [
    "Durable Persistence Activation Readiness",
    "reviewed schema design",
    "export/rollback plan",
    "Browser-local Spark review/reminder state",
    "open a live database connection"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:persistence-activation-readiness"]);
});

console.log("persistence-activation-readiness smoke ok");

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
