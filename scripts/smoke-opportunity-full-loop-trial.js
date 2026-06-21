import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("full-loop trial uses existing Opportunity pipeline artifacts", () => {
  assertFileIncludes("src/lib/engine/opportunity-full-loop-trial.ts", [
    "createOpportunityIntakeRecord",
    "createOpportunityClarification",
    "createOpportunitySolutionPath",
    "createOpportunityActionPlan",
    "createOpportunityAppEngineCandidate",
    "createOpportunityBuildPacketBridge",
    "opportunity_full_loop_trial"
  ]);
});

runStep("full-loop trial records every required stage", () => {
  assertFileIncludes("src/lib/engine/opportunity-full-loop-trial.ts", [
    "\"submit_opportunity_intake\"",
    "\"generate_clarification\"",
    "\"route_solution_path\"",
    "\"draft_action_plan\"",
    "\"create_appengine_candidate\"",
    "\"owner_approve_candidate\"",
    "\"prepare_packet_draft\"",
    "\"show_portfolio_readiness\"",
    "\"update_project_memory\"",
    "\"write_audit_trail\"",
    "\"show_next_safe_action\""
  ]);
});

runStep("trial writes Project Memory and Audit Trail events", () => {
  assertFileIncludes("src/lib/engine/opportunity-full-loop-trial.ts", [
    "updateProjectMemoryFromOpportunityFullLoopTrial",
    "getAppEngineAuditTrail().append",
    "opportunity_full_loop_trial_ran"
  ]);
  assertFileIncludes("src/lib/engine/project-memory.ts", [
    "updateProjectMemoryFromOpportunityFullLoopTrial",
    "Opportunity full loop reached packet draft readiness",
    "Opportunity Full Loop Trial writes one adapter-backed trial record"
  ]);
  assertFileIncludes("src/lib/engine/audit-trail-lite.ts", ["\"opportunity_full_loop_trial_ran\""]);
});

runStep("trial is adapter-backed and visible as a first-class artifact", () => {
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", [
    "\"opportunity_full_loop_trial\"",
    "Opportunity Full Loop Trial"
  ]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["\"opportunity_full_loop_trial\""]);
});

runStep("owner-gated API exposes the trial without unsafe automation", () => {
  assertFileIncludes("src/app/api/opportunity-full-loop-trial/route.ts", [
    "canAccessEngineAdmin",
    "runOpportunityFullLoopTrial",
    "listOpportunityFullLoopTrials",
    "finalPacketCreationBlocked",
    "codexAutoExecutionBlocked",
    "githubIssueCreationBlocked",
    "labelChangesBlocked"
  ]);
});

runStep("Owner Control Center exposes the guided full-loop panel", () => {
  assertFileIncludes("src/app/(cockpit)/owner-control-center/page.tsx", [
    "listOpportunityFullLoopTrials",
    "initialFullLoopTrials"
  ]);
  assertFileIncludes("src/components/opportunity-intake/owner-opportunity-queue.tsx", [
    "Run Opportunity Full Loop Trial",
    "/api/opportunity-full-loop-trial",
    "opportunity-full-loop-trial",
    "opportunity-full-loop-output",
    "Completed / blocked steps",
    "Copyable Next Action",
    "Portfolio Dashboard"
  ]);
});

runStep("guardrails block execution and deployment side effects", () => {
  assertFileIncludes("src/lib/engine/opportunity-full-loop-trial.ts", [
    "noFinalPacketCreated",
    "noCodexAutoExecution",
    "noGitHubIssueCreation",
    "noLabelChanges",
    "noDeployment",
    "Do not create final packets, trigger Codex, create GitHub issues, apply labels, deploy production, create paid resources, run migrations, add secrets/env vars, change repo visibility, or auto-merge generated code."
  ]);
  assertFileExcludes("src/lib/engine/opportunity-full-loop-trial.ts", [
    "ai:build",
    "gh issue create",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:opportunity-full-loop-trial\""]);
});

console.log("opportunity-full-loop-trial smoke ok");

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function assertFileIncludes(relativePath, expectedValues) {
  const content = readFile(relativePath);

  for (const expected of expectedValues) {
    if (!content.includes(expected)) {
      throw new Error(`${relativePath} should include ${JSON.stringify(expected)}`);
    }
  }
}

function assertFileExcludes(relativePath, blockedValues) {
  const content = readFile(relativePath);

  for (const blocked of blockedValues) {
    if (content.includes(blocked)) {
      throw new Error(`${relativePath} should not include ${JSON.stringify(blocked)}`);
    }
  }
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}
