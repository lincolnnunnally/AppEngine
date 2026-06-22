import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("clarification engine uses opportunity_intake as input", () => {
  assertFileIncludes("src/lib/engine/opportunity-clarification.ts", [
    "getOpportunityIntakeRecord",
    "kind: \"opportunity_clarification\"",
    "kind: \"opportunity_intake\"",
    "usesOpportunityIntakeAsInput",
    "getAppEngineStateAdapter",
    "opportunity_clarification"
  ]);
});

runStep("clarification output covers required profile fields", () => {
  assertFileIncludes("src/lib/engine/opportunity-clarification.ts", [
    "coreProblem",
    "affectedPeople",
    "rootBarriers",
    "desiredBetterFuture",
    "opportunityStatement",
    "possibleFirstUsefulStep",
    "likelySolutionType",
    "missingInformation"
  ]);
});

runStep("statuses and routes are supported", () => {
  assertFileIncludes("src/lib/engine/opportunity-clarification.ts", [
    "\"clarified\"",
    "\"needs_more_info\"",
    "\"not_actionable_yet\"",
    "\"safety_sensitive\"",
    "\"app_tool_workflow\"",
    "\"content_resource\"",
    "\"community_ministry_model\"",
    "\"existing_ecosystem_service_later\"",
    "\"appengine_build_candidate\""
  ]);
});

runStep("api route and owner output are wired", () => {
  assertFileIncludes("src/app/api/opportunity-clarification/route.ts", [
    "createOpportunityClarification",
    "listOpportunityClarifications",
    "Cache-Control"
  ]);
  assertFileIncludes("src/app/(cockpit)/owner-control-center/page.tsx", [
    "listOpportunityClarifications",
    "initialClarifications"
  ]);
  assertFileIncludes("src/components/opportunity-intake/owner-opportunity-queue.tsx", [
    "Clarify opportunity",
    "opportunity-clarification-output",
    "Copyable Clarification Review Prompt",
    "copyableNextPrompt"
  ]);
});

runStep("source-of-truth and agent contracts include clarification", () => {
  assertFileIncludes("source-of-truth/opportunity-clarification-engine.md", [
    "Opportunity Clarification turns a submitted `opportunity_intake`",
    "`opportunity_clarification`",
    "`clarified`",
    "`needs_more_info`",
    "`not_actionable_yet`",
    "`safety_sensitive`",
    "must not assume Spark, Live On Mission, Best Life"
  ]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/opportunity-clarification-engine.md", "opportunity_clarification"]);
  assertFileIncludes("agents/context/output-contracts.md", ["`opportunity_clarification`", "appengine_build_candidate"]);
  assertFileIncludes("agents/prompts/planner.md", ["`opportunity_clarification` artifact"]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["\"opportunity_clarification\""]);
});

runStep("guardrails block execution and unsafe mutations", () => {
  assertFileIncludes("src/lib/engine/opportunity-clarification.ts", [
    "noEcosystemDestinationAssumedBuilt",
    "No Codex run, GitHub issue, label, deployment, migration, paid resource, secret, or env change is triggered.",
    "owner_review_before_problem_solution_intake"
  ]);
  assertFileExcludes("src/lib/engine/opportunity-clarification.ts", [
    "ai:build",
    "ai:fix",
    "APPENGINE_FOLLOW_UP_MODE=create",
    "gh issue create",
    "vercel deploy --prod"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:opportunity-clarification-engine\""]);
});

console.log("opportunity-clarification-engine smoke ok");

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
