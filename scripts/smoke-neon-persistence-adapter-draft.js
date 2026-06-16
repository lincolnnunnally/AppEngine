import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("draft module defines disabled Neon adapter using durable interface", () => {
  assertFileIncludes("src/lib/engine/neon-persistence-adapter-draft.ts", [
    "AppEngineStateAdapter",
    "neon_disabled",
    "createDisabledNeonPersistenceAdapter",
    "enabled: false",
    "durableStateGuardrails"
  ]);
});

runStep("connection validation stub never connects", () => {
  assertFileIncludes("src/lib/engine/neon-persistence-adapter-draft.ts", [
    "validateNeonPersistenceConnectionStub",
    "attemptedConnection: false",
    "canAttemptConnection: false",
    "missingEnvVarNames",
    "disabled_until_owner_approved_schema_and_migration"
  ]);
});

runStep("source of truth documents env names and no-migration safety", () => {
  assertFileIncludes("source-of-truth/neon-persistence-adapter-draft.md", [
    "Names only. Do not add or commit secret values.",
    "Local/mock storage remains the active default.",
    "open a database connection",
    "apply migrations",
    "create paid resources",
    "disabled_until_owner_approved_schema_and_migration"
  ]);
});

runStep("schema areas cover required durable domains", () => {
  assertFileIncludes("source-of-truth/neon-persistence-adapter-draft.md", [
    "project memory",
    "handoffs",
    "orchestrator queue",
    "audit trail",
    "Spark submissions and reviews"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:neon-persistence-adapter-draft"]);
});

console.log("neon-persistence-adapter-draft smoke ok");

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
