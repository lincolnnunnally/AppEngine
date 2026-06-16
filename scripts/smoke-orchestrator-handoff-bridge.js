import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("source standard and contracts are discoverable", () => {
  assertFileIncludes("source-of-truth/orchestrator-to-handoff-bridge.md", [
    "Orchestrator to Handoff Bridge",
    "orchestrator_run",
    "handoff_relay_summary",
    "orchestrator_prepared_handoff",
    "Prepare Codex Handoff",
    "must not send the prompt automatically"
  ]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/orchestrator-to-handoff-bridge.md"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["orchestrator_prepared_handoff", "exact prompt", "required verification"]);
  assertFileIncludes("agents/context/output-contracts.md", ["orchestrator_prepared_handoff", "prepared Handoff Inbox entry"]);
});

runStep("library bridge creates prepared handoff summaries", () => {
  assertFileIncludes("src/lib/engine/handoff-relay.ts", [
    "createPreparedHandoffFromOrchestratorRun",
    "savePreparedHandoffFromOrchestratorRun",
    "buildPreparedHandoffText",
    "source: \"orchestrator_prepared_handoff\"",
    "Current project state:",
    "Exact suggested Codex prompt:",
    "Required verification:",
    "Expected result:",
    "Guardrails preserved:"
  ]);
  assertFileIncludes("src/lib/engine/project-memory.ts", [
    "updateProjectMemoryFromPreparedHandoff",
    "Prepared Codex handoff waiting for owner review",
    "Use the Handoff Inbox as the owner-reviewed relay for Manual Orchestrator prompts"
  ]);
});

runStep("admin API route is gated and side-effect limited", () => {
  assertFileIncludes("src/app/api/engine/orchestrator-run/[runId]/handoff/route.ts", [
    "canAccessEngineAdmin",
    "listOrchestratorRuns",
    "savePreparedHandoffFromOrchestratorRun",
    "Prepared handoff saved to the Handoff Inbox",
    "does not send prompts",
    "create GitHub issues",
    "apply labels",
    "auto-merges"
  ]);
});

runStep("Owner Control Center exposes the bridge", () => {
  assertFileIncludes("src/components/engine/handoff-relay-control-center.tsx", [
    "prepareOrchestratorHandoff",
    "/api/engine/orchestrator-run/${selectedOrchestratorRun.id}/handoff",
    "Prepare Codex Handoff",
    "Prepared Codex handoff saved to inbox",
    "formatHandoffSource",
    "Prepared handoff",
    "Copy Prompt"
  ]);
});

runStep("bridge avoids execution hooks and dangerous labels", () => {
  const combined = [
    readFile("src/lib/engine/handoff-relay.ts"),
    readFile("src/app/api/engine/orchestrator-run/[runId]/handoff/route.ts"),
    readFile("src/components/engine/handoff-relay-control-center.tsx"),
    readFile("source-of-truth/orchestrator-to-handoff-bridge.md")
  ].join("\n");

  assertNotIncludes(combined, "gh issue create", "must not create live GitHub issues");
  assertNotIncludes(combined, "ai:build", "must not add build labels");
  assertNotIncludes(combined, "ai:fix", "must not add fix labels");
  assertNotIncludes(combined, "vercel deploy --prod", "must not deploy production");
  assertNotIncludes(combined, "DATABASE_URL=", "must not set database env");
});

runStep("npm script is registered", () => {
  assertFileIncludes("package.json", ["\"smoke:orchestrator-handoff-bridge\": \"node scripts/smoke-orchestrator-handoff-bridge.js\""]);
});

console.log("orchestrator-handoff-bridge smoke ok");

function assertFileIncludes(filePath, expected) {
  const source = readFile(filePath);

  for (const phrase of expected) {
    assertIncludes(source, phrase, `${filePath} includes ${phrase}`);
  }
}

function readFile(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

function assertIncludes(value, phrase, label) {
  if (!String(value || "").includes(phrase)) {
    throw new Error(`${label}: expected to include "${phrase}"`);
  }
}

function assertNotIncludes(value, phrase, label) {
  if (String(value || "").includes(phrase)) {
    throw new Error(`${label}: found forbidden phrase "${phrase}"`);
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
