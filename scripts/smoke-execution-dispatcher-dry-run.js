import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("dispatcher is a dry run that never dispatches and stays owner-gated", () => {
  assertFileIncludes("src/lib/engine/execution-dispatcher-dry-run.ts", [
    'kind: "execution_dispatcher_dry_run"',
    "export function createExecutionDispatcherDryRun",
    "dispatched: false",
    "executionEnabled: false",
    "dryRunNeverDispatches: true",
    "ownerApprovalRequiredToDispatch: true",
    "noAutomaticCodexExecution: true"
  ]);
});

runStep("dispatcher composes the existing prerequisites (no parallel system)", () => {
  assertFileIncludes("src/lib/engine/execution-dispatcher-dry-run.ts", [
    "createPersistenceActivationReadiness",
    "durable_persistence_ready",
    "prepared_handoff_present",
    "owner_approved_dispatch",
    ".github/workflows/ai-prompt-factory.yml"
  ]);
});

runStep("dispatcher fails closed (blocked until persistence + handoff + owner approval)", () => {
  assertFileIncludes("src/lib/engine/execution-dispatcher-dry-run.ts", [
    "blocked_pending_prerequisites",
    "ready_for_owner_approved_dispatch",
    "blockedReasons.length"
  ]);
});

runStep("owner orchestrator page renders the roadmap + dispatcher, owner-gated", () => {
  assertFileIncludes("src/app/(cockpit)/orchestrator/page.tsx", [
    "canAccessEngineOwner",
    "/soft-launch",
    "createOrchestratorAutonomyRoadmap",
    "createExecutionDispatcherDryRun",
    'data-testid="orchestrator-page"',
    'data-testid="dispatcher-dry-run"'
  ]);
  assertFileIncludes("src/components/engine/app-shell.tsx", ['label: "Orchestrator"', 'href: "/orchestrator"']);
});

runStep("source of truth documents the dispatcher", () => {
  assertFileIncludes("source-of-truth/execution-dispatcher-dry-run.md", [
    "Execution Dispatcher",
    "execution_dispatcher_dry_run",
    "dry run",
    "owner"
  ]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/execution-dispatcher-dry-run.md"]);
  assertFileIncludes("package.json", ["smoke:execution-dispatcher-dry-run"]);
});

console.log("execution-dispatcher-dry-run smoke ok");

function assertFileIncludes(filePath, expected) {
  const source = fs.readFileSync(path.join(root, filePath), "utf8");
  for (const phrase of expected) {
    if (!source.includes(phrase)) {
      throw new Error(`${filePath} missing ${JSON.stringify(phrase)}`);
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
