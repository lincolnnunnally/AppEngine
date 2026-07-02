import fs from "node:fs";
import path from "node:path";

// Structural smoke for the autonomous build pipeline
// (source-of-truth/autonomous-build-activation.md).
// Run: node scripts/smoke-autonomous-loop.js
const repoRoot = process.cwd();
let failures = 0;

runStep("Change 1: prompt factory reads the follow-up mode + caps from repo variables", () => {
  const text = read(".github/workflows/ai-prompt-factory.yml");
  assertIncludes(text, "vars.APPENGINE_FOLLOW_UP_MODE == 'create' && 'create' || 'dry-run'", "create mode is variable-gated with dry-run fallback");
  assertIncludes(text, "APPENGINE_MAX_FOLLOW_UP_ISSUES", "issue cap wired");
  assertIncludes(text, "APPENGINE_MAX_FOLLOW_UP_WORKFLOW_DISPATCHES", "dispatch cap wired");
});

runStep("Change 2: monitor config declares dispatch rules + safety", () => {
  const text = read("monitor.config.yaml");
  assertIncludes(text, "dispatch:", "dispatch section present");
  assertIncludes(text, "trigger: stalled_build", "stalled_build rule");
  assertIncludes(text, "trigger: failed_workflow", "failed_workflow rule");
  assertIncludes(text, "trigger: incomplete_phase", "incomplete_phase rule");
  assertIncludes(text, "skip_workflow_name_patterns", "safety name patterns");
});

runStep("Change 2: monitor script enforces both gates, retries, and audit logging", () => {
  const text = read("scripts/monitor-ai-issues.js");
  assertIncludes(text, 'config.dispatch.enabled && process.env.MONITOR_DISPATCH === "true"', "config AND env both required");
  assertIncludes(text, "appengine-monitor-dispatch", "persistent dispatch marker comments");
  assertIncludes(text, "countDispatchComments", "retry counters read from markers");
  assertIncludes(text, "recordAction", "every dispatch action recorded in the report");
  assertIncludes(text, "skipWorkflowNamePatterns", "release/production workflows never auto-rerun");
  assertIncludes(text, "--failed", "reruns only failed jobs");
  assertIncludes(text, 'process.env.APPENGINE_COST_GOVERNANCE_PAUSED === "true"', "cost-governance pause suppresses dispatch");
  assertIncludes(text, "Never create a recovery for a recovery", "recovery chains capped at one generation");
  assertIncludes(text, "rerunWorkflowNamePatterns", "reruns allowlisted to pipeline workflows");
});

runStep("Change 2: workflow threads the cost-governance kill switch", () => {
  assertIncludes(read(".github/workflows/orchestration-monitor.yml"), "APPENGINE_COST_GOVERNANCE_PAUSED", "pause variable threaded");
});

runStep("Change 2: monitor workflow grants actions:write and passes MONITOR_DISPATCH", () => {
  const text = read(".github/workflows/orchestration-monitor.yml");
  assertIncludes(text, "actions: write", "rerun permission granted");
  assertIncludes(text, "MONITOR_DISPATCH", "dispatch env threaded");
});

runStep("Change 3: preview auto-deploy is flag-gated, API-based, preview-only", () => {
  const text = read("src/lib/engine/preview-auto-deploy.ts");
  assertIncludes(text, 'process.env.APP_ENGINE_AUTO_DEPLOY_PREVIEW === "true"', "off unless the flag is exactly true");
  assertIncludes(text, "deployGeneratedAppToVercel", "reuses the proven API deploy module");
  assertIncludes(text, "APP_ENGINE_DEPLOYMENT_TIMEOUT_SECONDS", "timeout honored");
  for (const banned of ["vercel pull", "vercel build", "vercel deploy", "process.env.APP_ENGINE_AUTO_DEPLOY_PRODUCTION"]) {
    if (text.includes(banned)) throw new Error(`preview auto-deploy must not contain "${banned}"`);
  }
  assertIncludes(text, 'environment: "preview"', "records preview environment only");
});

runStep("Change 3: deployments route only auto-executes after deployment_ready", () => {
  const text = read("src/app/api/engine/projects/[projectId]/deployments/route.ts");
  assertIncludes(text, 'deploymentStatus === "deployment_ready" && autoDeployPreviewEnabled()', "ready + flag both required");
  assertIncludes(text, "executePreviewAutoDeploy", "executes via the gated module");
});

runStep("Customer-build spine untouched (stays prepare-only)", () => {
  const text = read("src/lib/engine/customer-build.ts");
  if (text.includes("executePreviewAutoDeploy")) throw new Error("customer spine must not use the engine auto-deploy path");
});

runStep("Spec is committed and in the shared context list", () => {
  read("source-of-truth/autonomous-build-activation.md");
  assertIncludes(read("agents/manifest.yaml"), "source-of-truth/autonomous-build-activation.md", "manifest lists the spec");
});

if (failures > 0) {
  console.error(`smoke-autonomous-loop: ${failures} step(s) failed`);
  process.exit(1);
}
console.log("smoke-autonomous-loop ok");

function runStep(title, fn) {
  try {
    fn();
    console.log(`ok - ${title}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL - ${title}: ${error.message}`);
  }
}

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`missing ${label} ("${needle}")`);
}
