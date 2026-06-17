import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("solution path router uses opportunity_clarification as input", () => {
  assertFileIncludes("src/lib/engine/opportunity-solution-path.ts", [
    "getOpportunityClarification",
    "kind: \"opportunity_solution_path\"",
    "kind: \"opportunity_clarification\"",
    "usesOpportunityClarificationAsInput",
    "getAppEngineStateAdapter",
    "opportunity_solution_path"
  ]);
});

runStep("router supports every required destination", () => {
  assertFileIncludes("src/lib/engine/opportunity-solution-path.ts", [
    "\"appengine_build_candidate\"",
    "\"app_tool_workflow\"",
    "\"content_resource\"",
    "\"community_ministry_model\"",
    "\"existing_ecosystem_service_later\"",
    "\"needs_more_info\"",
    "\"not_safe_or_not_ready\""
  ]);
});

runStep("router output includes required decision fields", () => {
  assertFileIncludes("src/lib/engine/opportunity-solution-path.ts", [
    "recommendedPath",
    "reasonForRouting",
    "firstPracticalStep",
    "neededResources",
    "blockers",
    "confidenceLevel",
    "nextAppEngineActionPrompt"
  ]);
});

runStep("api route and owner-visible output are wired", () => {
  assertFileIncludes("src/app/api/opportunity-solution-path/route.ts", [
    "createOpportunitySolutionPath",
    "listOpportunitySolutionPaths",
    "Cache-Control"
  ]);
  assertFileIncludes("src/app/owner-control-center/page.tsx", [
    "listOpportunitySolutionPaths",
    "initialSolutionPaths"
  ]);
  assertFileIncludes("src/components/opportunity-intake/owner-opportunity-queue.tsx", [
    "Route solution path",
    "opportunity-solution-path-output",
    "Next AppEngine Action Prompt",
    "nextAppEngineActionPrompt"
  ]);
});

runStep("source-of-truth and agent contracts include solution path", () => {
  assertFileIncludes("source-of-truth/opportunity-solution-path-router.md", [
    "Opportunity Solution Path Router turns a clarified opportunity",
    "`opportunity_solution_path`",
    "`appengine_build_candidate`",
    "`needs_more_info`",
    "`not_safe_or_not_ready`",
    "must not assume Spark, Live On Mission, Best Life"
  ]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/opportunity-solution-path-router.md", "opportunity_solution_path"]);
  assertFileIncludes("agents/context/output-contracts.md", ["`opportunity_solution_path`", "first practical step"]);
  assertFileIncludes("agents/prompts/planner.md", ["`opportunity_solution_path` artifact"]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["\"opportunity_solution_path\""]);
});

runStep("guardrails block packets, execution, and unsafe mutations", () => {
  assertFileIncludes("src/lib/engine/opportunity-solution-path.ts", [
    "noBuildPacketsCreated",
    "noCodexAutoExecution",
    "No build packet, Codex run, GitHub issue, label, deployment, migration, paid resource, secret, or env change is triggered.",
    "Do not create build packets yet."
  ]);
  assertFileExcludes("src/lib/engine/opportunity-solution-path.ts", [
    "ai:build",
    "ai:fix",
    "APPENGINE_FOLLOW_UP_MODE=create",
    "gh issue create",
    "vercel deploy --prod"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:opportunity-solution-path-router\""]);
});

console.log("opportunity-solution-path-router smoke ok");

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
