import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const component = read("src/components/engine/handoff-relay-control-center.tsx");
assertIncludes(component, 'data-testid="owner-control-center-status"', "component should expose quick status test marker");
assertIncludes(component, "Current Project State", "component should show current project state");
assertIncludes(component, "Next Safe Action", "component should show next safe action");
assertIncludes(component, "Blockers", "component should show blockers");
assertIncludes(component, "Open Drafts/Handoffs", "component should show open drafts and handoffs");
assertIncludes(component, "openDraftSummary", "component should summarize open handoffs and queued actions");
assertIncludes(component, "projectMemory.latestProjectState.currentState", "component should derive state from Project Memory");
assertIncludes(component, "selectedOrchestratorRun?.selectedNextSafeAction", "component should surface orchestrator next action when available");

const styles = read("src/app/styles.css");
assertIncludes(styles, ".owner-quick-status-grid", "styles should define quick status grid");
assertIncludes(styles, "grid-template-columns: repeat(4, minmax(0, 1fr))", "status cards should use four columns on desktop");
assertIncludes(styles, ".owner-quick-status-grid .handoff-state-block", "status cards should have scoped styling");
assertIncludes(styles, ".owner-quick-status-grid,", "mobile rule should collapse status grid");

const packageJson = read("package.json");
assertIncludes(packageJson, "smoke:owner-control-center-status", "package should expose owner status smoke script");

const statusSnippet = component.slice(component.indexOf("owner-quick-status-grid"), component.indexOf("pending-check-resolution-policy"));

for (const forbidden of ["ai:build", "create GitHub issue", "apply labels", "deploy production"]) {
  if (statusSnippet.includes(forbidden)) {
    throw new Error(`quick status UI should not introduce automation action text: ${forbidden}`);
  }
}

console.log("owner-control-center-status smoke ok");

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

function assertIncludes(value, phrase, label) {
  if (!String(value || "").includes(phrase)) {
    throw new Error(`${label}: expected to include "${phrase}"`);
  }
}
