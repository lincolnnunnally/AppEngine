import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const ownerPage = read("src/app/(cockpit)/owner-control-center/page.tsx");
assertIncludes(ownerPage, "listOrchestratorActionQueue", "owner page should load action queue");
assertIncludes(ownerPage, "initialOrchestratorActionQueue", "owner page should pass initial action queue");

const component = read("src/components/engine/handoff-relay-control-center.tsx");
assertIncludes(component, "OrchestratorActionQueueItem", "component should type action queue items");
assertIncludes(component, "orchestratorActionQueue", "component should keep action queue state");
assertIncludes(component, 'data-testid="orchestrator-action-queue"', "component should render action queue test marker");
assertIncludes(component, "prepareOrchestratorHandoff(sourceRun)", "component should prepare handoff from queued action");
assertIncludes(component, "markActionQueueItem(action, \"completed\")", "component should mark action completed");
assertIncludes(component, "markActionQueueItem(action, \"blocked\")", "component should mark action blocked");
assertIncludes(component, "decisionTrace.confidenceLevel", "component should show confidence");
assertIncludes(component, "action.prompt", "component should show next prompt");
assertIncludes(component, "No queued orchestrator actions yet.", "component should include empty state");

const apiRoute = read("src/app/api/engine/orchestrator-run/actions/[actionId]/route.ts");
assertIncludes(apiRoute, "updateOrchestratorActionStatus", "API route should update local/mock queue status");
assertIncludes(apiRoute, "updateProjectMemoryFromOrchestratorAction", "API route should update Project Memory");
assertIncludes(apiRoute, "canAccessEngineAdmin", "API route should require engine admin");
assertIncludes(apiRoute, "does not trigger Codex", "API route should preserve no-auto-execution guardrail");

const orchestratorRoute = read("src/app/api/engine/orchestrator-run/route.ts");
assertIncludes(orchestratorRoute, "actionQueue", "orchestrator route should return action queue");

const packageJson = read("package.json");
assertIncludes(packageJson, "smoke:orchestrator-action-queue-ui", "package should expose UI smoke script");

console.log("orchestrator-action-queue-ui smoke ok");

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

function assertIncludes(value, phrase, label) {
  if (!String(value || "").includes(phrase)) {
    throw new Error(`${label}: expected to include "${phrase}"`);
  }
}
