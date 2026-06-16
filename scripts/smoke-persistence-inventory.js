import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const source = fs.readFileSync(path.join(repoRoot, "source-of-truth/persistence-inventory-migration-plan.md"), "utf8");
const packageJson = fs.readFileSync(path.join(repoRoot, "package.json"), "utf8");

runStep("inventory covers every required local/mock state domain", () => {
  [
    "Handoff Relay",
    "Project Memory",
    "Orchestrator Runs",
    "Orchestrator Action Queue",
    "Real Project Trial",
    "Trial Result Review",
    "Problem Intake Lite",
    "Problem Intake Feedback",
    "Spark Story Submissions",
    "Spark Review Queue",
    "Spark Reminder Queue",
    "Development Projects"
  ].forEach((phrase) => assertIncludes(source, phrase, `inventory includes ${phrase}`));
});

runStep("inventory classifies privacy and sensitivity", () => {
  ["Internal", "Private", "Sensitive", "Privacy And Sensitivity Classes"].forEach((phrase) => assertIncludes(source, phrase, phrase));
});

runStep("migration plan preserves dry-run and rollback safety", () => {
  [
    "Migration Order",
    "Rollback And Safety Plan",
    "dry-run mode only",
    "export current local/mock JSON stores",
    "keep production blocked",
    "keep migrations blocked"
  ].forEach((phrase) => assertIncludes(source, phrase, phrase));
});

runStep("guardrails forbid production/resource/migration side effects", () => {
  [
    "deploy production",
    "create paid resources",
    "apply migrations",
    "add secrets or environment variables",
    "trigger Codex automatically",
    "create GitHub issues",
    "apply labels"
  ].forEach((phrase) => assertIncludes(source, phrase, phrase));
});

runStep("package exposes smoke script", () => {
  assertIncludes(packageJson, "smoke:persistence-inventory", "package smoke script");
});

console.log("persistence-inventory smoke ok");

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
