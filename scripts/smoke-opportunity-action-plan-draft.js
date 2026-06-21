import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("action plan uses opportunity_solution_path as input", () => {
  assertFileIncludes("src/lib/engine/opportunity-action-plan.ts", [
    "getOpportunitySolutionPath",
    "kind: \"opportunity_action_plan\"",
    "kind: \"opportunity_solution_path\"",
    "usesOpportunitySolutionPathAsInput",
    "getAppEngineStateAdapter",
    "opportunity_action_plan"
  ]);
});

runStep("action plan supports every required plan type", () => {
  assertFileIncludes("src/lib/engine/opportunity-action-plan.ts", [
    "\"app_tool_workflow_plan\"",
    "\"content_resource_plan\"",
    "\"community_ministry_model_plan\"",
    "\"ecosystem_service_later_plan\"",
    "\"needs_more_info_plan\""
  ]);
});

runStep("action plan output includes required practical fields", () => {
  assertFileIncludes("src/lib/engine/opportunity-action-plan.ts", [
    "opportunitySummary",
    "recommendedSolutionPath",
    "firstPracticalSteps",
    "appEngineCanHelpWith",
    "ownerMustClarify",
    "neededResources",
    "risksBlockers",
    "suggestedTimeline",
    "nextReviewPrompt"
  ]);
});

runStep("api route and owner-visible output are wired", () => {
  assertFileIncludes("src/app/api/opportunity-action-plan/route.ts", [
    "createOpportunityActionPlan",
    "listOpportunityActionPlans",
    "Cache-Control"
  ]);
  assertFileIncludes("src/app/(cockpit)/owner-control-center/page.tsx", [
    "listOpportunityActionPlans",
    "initialActionPlans"
  ]);
  assertFileIncludes("src/components/opportunity-intake/owner-opportunity-queue.tsx", [
    "Draft action plan",
    "opportunity-action-plan-output",
    "First 3 practical steps",
    "What AppEngine can help with",
    "Next Review Prompt"
  ]);
});

runStep("source-of-truth and agent contracts include action plan", () => {
  assertFileIncludes("source-of-truth/opportunity-action-plan-draft.md", [
    "Opportunity Action Plan Draft turns a routed `opportunity_solution_path`",
    "`opportunity_action_plan`",
    "`app_tool_workflow_plan`",
    "`needs_more_info_plan`",
    "must not"
  ]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/opportunity-action-plan-draft.md", "opportunity_action_plan"]);
  assertFileIncludes("agents/context/output-contracts.md", ["`opportunity_action_plan`", "first 3 practical steps"]);
  assertFileIncludes("agents/prompts/planner.md", ["`opportunity_action_plan` artifact"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["Opportunity Action Plan Draft", "`opportunity_action_plan`"]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["\"opportunity_action_plan\""]);
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", ["\"opportunity_action_plan\"", "Opportunity Action Plan"]);
});

runStep("guardrails block packets, execution, and unsafe mutations", () => {
  assertFileIncludes("src/lib/engine/opportunity-action-plan.ts", [
    "noBuildPacketsCreated",
    "noCodexAutoExecution",
    "No build packet, Codex run, GitHub issue, label, deployment, migration, paid resource, secret, or env change is triggered.",
    "Do not create build packets yet."
  ]);
  assertFileExcludes("src/lib/engine/opportunity-action-plan.ts", [
    "ai:build",
    "ai:fix",
    "APPENGINE_FOLLOW_UP_MODE=create",
    "gh issue create",
    "vercel deploy --prod"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:opportunity-action-plan-draft\""]);
});

console.log("opportunity-action-plan-draft smoke ok");

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
