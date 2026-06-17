import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("candidate bridge uses opportunity_action_plan as input", () => {
  assertFileIncludes("src/lib/engine/opportunity-appengine-candidate.ts", [
    "getOpportunityActionPlan",
    "kind: \"opportunity_appengine_candidate\"",
    "kind: \"opportunity_action_plan\"",
    "usesOpportunityActionPlanAsInput",
    "getOpportunityIntakeRecord",
    "getOpportunityClarification",
    "getOpportunitySolutionPath",
    "getAppEngineStateAdapter",
    "opportunity_appengine_candidate"
  ]);
});

runStep("candidate bridge supports every required candidate type", () => {
  assertFileIncludes("src/lib/engine/opportunity-appengine-candidate.ts", [
    "\"app_build_candidate\"",
    "\"workflow_candidate\"",
    "\"content_resource_candidate\"",
    "\"community_model_candidate\"",
    "\"ecosystem_service_later_candidate\"",
    "\"needs_more_info\""
  ]);
});

runStep("candidate output includes required review fields", () => {
  assertFileIncludes("src/lib/engine/opportunity-appengine-candidate.ts", [
    "sourceOpportunityIntake",
    "clarifiedProblem",
    "solutionPath",
    "actionPlanSummary",
    "proposedAppEngineWorkType",
    "recommendedArtifactToCreateNext",
    "missingOwnerDecisions",
    "risksBlockers",
    "confidenceLevel",
    "copyableNextAppEnginePrompt"
  ]);
});

runStep("api route and owner-visible output are wired", () => {
  assertFileIncludes("src/app/api/opportunity-appengine-candidate/route.ts", [
    "createOpportunityAppEngineCandidate",
    "listOpportunityAppEngineCandidates",
    "Cache-Control"
  ]);
  assertFileIncludes("src/app/owner-control-center/page.tsx", [
    "listOpportunityAppEngineCandidates",
    "initialAppEngineCandidates"
  ]);
  assertFileIncludes("src/components/opportunity-intake/owner-opportunity-queue.tsx", [
    "Create AppEngine candidate",
    "opportunity-appengine-candidate-output",
    "Proposed AppEngine work type",
    "Recommended artifact to create next",
    "Copyable Next AppEngine Prompt"
  ]);
});

runStep("source-of-truth and agent contracts include candidate bridge", () => {
  assertFileIncludes("source-of-truth/opportunity-appengine-candidate-bridge.md", [
    "Opportunity to AppEngine Candidate Bridge turns an owner-reviewable `opportunity_action_plan`",
    "`opportunity_appengine_candidate`",
    "`app_build_candidate`",
    "`needs_more_info`",
    "must not"
  ]);
  assertFileIncludes("agents/manifest.yaml", [
    "source-of-truth/opportunity-appengine-candidate-bridge.md",
    "opportunity_appengine_candidate"
  ]);
  assertFileIncludes("agents/context/output-contracts.md", [
    "`opportunity_appengine_candidate`",
    "recommended artifact to create next"
  ]);
  assertFileIncludes("agents/prompts/planner.md", ["`opportunity_appengine_candidate` artifact"]);
  assertFileIncludes("source-of-truth/context-checklist.md", [
    "Opportunity to AppEngine Candidate Bridge",
    "`opportunity_appengine_candidate`"
  ]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["\"opportunity_appengine_candidate\""]);
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", [
    "\"opportunity_appengine_candidate\"",
    "Opportunity AppEngine Candidate"
  ]);
});

runStep("guardrails block packets, execution, and unsafe mutations", () => {
  assertFileIncludes("src/lib/engine/opportunity-appengine-candidate.ts", [
    "noBuildPacketsCreated",
    "noCodexAutoExecution",
    "No build packet, Codex run, GitHub issue, label, deployment, migration, paid resource, secret, or env change is triggered.",
    "Do not create build packets yet."
  ]);
  assertFileExcludes("src/lib/engine/opportunity-appengine-candidate.ts", [
    "ai:build",
    "ai:fix",
    "APPENGINE_FOLLOW_UP_MODE=create",
    "gh issue create",
    "vercel deploy --prod"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:opportunity-appengine-candidate-bridge\""]);
});

console.log("opportunity-appengine-candidate-bridge smoke ok");

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
