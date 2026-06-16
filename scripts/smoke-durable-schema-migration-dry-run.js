import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("schema dry-run artifact defines tables and mappings", () => {
  assertFileIncludes("src/lib/engine/durable-schema-migration-dry-run.ts", [
    "durable_schema_migration_dry_run",
    "app_engine_state.state_records",
    "app_engine_state.audit_events",
    "app_engine_state.spark_story_submissions",
    "app_engine_state.spark_review_items",
    "storeMappings"
  ]);
});

runStep("schema covers required durable domains", () => {
  assertFileIncludes("src/lib/engine/durable-schema-migration-dry-run.ts", [
    "handoff_relay",
    "project_memory",
    "orchestrator_action_queue",
    "spark_story_submissions",
    "spark_review_queue"
  ]);
});

runStep("dry-run refuses live database behavior", () => {
  assertFileIncludes("src/lib/engine/durable-schema-migration-dry-run.ts", [
    "attemptedConnection: false",
    "appliedMigration: false",
    "productionWrites: false",
    "noLiveDatabaseConnection: true",
    "dryRunOnly: true",
    "no_destructive_sql"
  ]);
});

runStep("source of truth documents dry-run boundaries", () => {
  assertFileIncludes("source-of-truth/durable-schema-migration-dry-run.md", [
    "Durable State Schema and Migration Dry Run",
    "durable_schema_migration_dry_run",
    "no live database connection",
    "no production database writes",
    "Spark story submissions",
    "Rollback Notes"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:durable-schema-migration-dry-run"]);
});

console.log("durable-schema-migration-dry-run smoke ok");

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
