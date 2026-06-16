import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-production-readiness-"));
const inputPath = path.join(smokeRoot, "input.json");
const outputPath = path.join(smokeRoot, "snapshot.json");
const markdownPath = path.join(smokeRoot, "snapshot.md");

runStep("source docs and contracts are discoverable", () => {
  assertFileIncludes("source-of-truth/production-readiness-snapshot.md", [
    "production_readiness_snapshot",
    "auth/admin protection",
    "monitoring/logging",
    "automatic Codex execution"
  ]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/production-readiness-snapshot.md", "production_readiness_snapshot"]);
  assertFileIncludes("agents/context/output-contracts.md", ["production_readiness_snapshot", "auth/admin protection"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["production_readiness_snapshot", "production readiness"]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["production_readiness_snapshot"]);
  assertFileIncludes("package.json", ["smoke:production-readiness-snapshot", "production:readiness-snapshot"]);
});

runStep("snapshot blocks production when any readiness category is blocked", () => {
  writeJson(inputPath, {
    system: { name: "AppEngine", slug: "appengine" },
    categories: {
      authAdminProtection: { status: "ready", summary: "Admin routes are gated." },
      persistence: { status: "needs_review", summary: "Mock/local storage remains for some product slices." },
      privacySecurity: { status: "blocked", summary: "Private repo readiness still needs owner decision.", blocker: "Repo visibility has not been changed or approved." },
      deploymentReadiness: { status: "needs_review", summary: "Preview path works; production remains blocked." },
      monitoringLogging: { status: "needs_review", summary: "Owner status exists, monitoring is not complete." },
      costResourceRisk: { status: "ready", summary: "Cost governance exists." },
      userFacingUx: { status: "needs_review", summary: "Owner Control Center is improving." }
    },
    highestLeverageImprovements: ["Complete private repository readiness owner action."]
  });

  runSnapshot();
  const snapshot = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");

  assertEqual(snapshot.kind, "production_readiness_snapshot", "kind");
  assertEqual(snapshot.status, "blocked", "status");
  assertIncludes(snapshot.ownerReadableSummary, "Production readiness is blocked", "owner summary");
  assertIncludes(snapshot.nextSafeAction, "Resolve blocker", "next safe action");
  assertEqual(snapshot.guardrails.noProductionDeploy, true, "production guardrail");
  assertEqual(snapshot.guardrails.noPaidResources, true, "paid resources guardrail");
  assertEqual(snapshot.guardrails.noMigrations, true, "migration guardrail");
  assertEqual(snapshot.guardrails.noCodexAutoExecution, true, "codex guardrail");
  assertIncludes(markdown, "Production Readiness Snapshot", "markdown title");
});

console.log(`production-readiness-snapshot smoke ok (${smokeRoot})`);

function runSnapshot() {
  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-production-readiness-snapshot.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PRODUCTION_READINESS_SNAPSHOT_INPUT: inputPath,
      PRODUCTION_READINESS_SNAPSHOT_OUTPUT: outputPath,
      PRODUCTION_READINESS_SNAPSHOT_MARKDOWN_OUTPUT: markdownPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function assertFileIncludes(filePath, expected) {
  const source = fs.readFileSync(path.join(repoRoot, filePath), "utf8");
  for (const phrase of expected) assertIncludes(source, phrase, `${filePath} includes ${phrase}`);
}

function assertIncludes(value, phrase, label) {
  if (!String(value || "").includes(phrase)) {
    throw new Error(`${label}: expected to include "${phrase}"`);
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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
