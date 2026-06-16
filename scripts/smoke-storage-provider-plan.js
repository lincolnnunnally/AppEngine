import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const source = fs.readFileSync(path.join(repoRoot, "source-of-truth/storage-provider-selection-plan.md"), "utf8");
const packageJson = fs.readFileSync(path.join(repoRoot, "package.json"), "utf8");

runStep("provider comparison covers required options", () => {
  ["Neon", "Supabase", "Local file fallback"].forEach((phrase) => assertIncludes(source, phrase, phrase));
});

runStep("plan recommends primary and fallback", () => {
  assertIncludes(source, "Primary durable provider", "primary provider heading");
  assertIncludes(source, "Neon Postgres", "Neon recommendation");
  assertIncludes(source, "local_mock file storage", "fallback recommendation");
});

runStep("plan names env vars without secret values", () => {
  ["DATABASE_URL", "APPENGINE_STATE_ADAPTER", "APPENGINE_STATE_DATABASE_SCHEMA", "APPENGINE_STATE_MIGRATIONS_ENABLED"].forEach((phrase) =>
    assertIncludes(source, phrase, phrase)
  );
  assertIncludes(source, "Names only. Do not add or commit secret values.", "secret guardrail");
});

runStep("schema areas cover first durable state needs", () => {
  ["project memory", "handoffs", "orchestrator queue", "audit trail", "Spark submissions and reviews"].forEach((phrase) =>
    assertIncludes(source, phrase, phrase)
  );
});

runStep("no-migration safety path is explicit", () => {
  ["no_migration", "Blocked now", "applying migrations", "creating Neon/Supabase resources", "schema_design_pr"].forEach((phrase) =>
    assertIncludes(source, phrase, phrase)
  );
});

runStep("package exposes smoke script", () => {
  assertIncludes(packageJson, "smoke:storage-provider-plan", "package script");
});

console.log("storage-provider-plan smoke ok");

function assertIncludes(value, phrase, label) {
  if (!value.includes(phrase)) {
    throw new Error(`${label}: expected source to include ${phrase}`);
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
