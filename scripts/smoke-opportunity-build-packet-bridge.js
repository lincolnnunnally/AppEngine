import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("build packet bridge uses opportunity_appengine_candidate as input", () => {
  assertFileIncludes("src/lib/engine/opportunity-build-packet-bridge.ts", [
    "getOpportunityAppEngineCandidate",
    "kind: \"opportunity_build_packet_bridge\"",
    "kind: \"opportunity_appengine_candidate\"",
    "usesOpportunityAppEngineCandidateAsInput",
    "getAppEngineStateAdapter",
    "opportunity_build_packet_bridge"
  ]);
});

runStep("bridge produces the required draft types", () => {
  assertFileIncludes("src/lib/engine/opportunity-build-packet-bridge.ts", [
    "\"app_build_packet_draft\"",
    "\"workflow_solution_plan_draft\"",
    "\"content_resource_plan_draft\"",
    "\"community_model_plan_draft\""
  ]);
});

runStep("bridge output includes required owner-review fields", () => {
  assertFileIncludes("src/lib/engine/opportunity-build-packet-bridge.ts", [
    "sourceOpportunityReferences",
    "candidateSummary",
    "selectedSolutionType",
    "recommendedPacket",
    "missingInformation",
    "ownerApprovalStatus",
    "nextAppEngineStep",
    "copyableNextAppEnginePrompt"
  ]);
});

runStep("bridge reuses existing packet infrastructure instead of parallel standards", () => {
  assertFileIncludes("src/lib/engine/opportunity-build-packet-bridge.ts", [
    "reusesExistingPacketStandards",
    "noParallelPacketSystem",
    "source-of-truth/candidate-to-packet-bridge.md",
    "source-of-truth/packet-draft-approval-gate.md",
    "source-of-truth/final-packet-materialization.md",
    "source-of-truth/app-build-packet.md"
  ]);
});

runStep("api route and owner-visible output are wired", () => {
  assertFileIncludes("src/app/api/opportunity-build-packet-bridge/route.ts", [
    "createOpportunityBuildPacketBridge",
    "listOpportunityBuildPacketBridges",
    "Cache-Control"
  ]);
  assertFileIncludes("src/app/owner-control-center/page.tsx", [
    "listOpportunityBuildPacketBridges",
    "initialBuildPacketBridges"
  ]);
  assertFileIncludes("src/components/opportunity-intake/owner-opportunity-queue.tsx", [
    "Create packet bridge",
    "opportunity-build-packet-bridge-output",
    "Recommended packet",
    "Next AppEngine step",
    "Copyable Next AppEngine Prompt"
  ]);
});

runStep("source-of-truth and agent contracts include build packet bridge", () => {
  assertFileIncludes("source-of-truth/opportunity-build-packet-bridge.md", [
    "Opportunity Candidate to Build Packet Bridge connects the Opportunity engine",
    "`opportunity_build_packet_bridge`",
    "`app_build_packet_draft`",
    "`community_model_plan_draft`",
    "must not create a parallel planning system"
  ]);
  assertFileIncludes("agents/manifest.yaml", [
    "source-of-truth/opportunity-build-packet-bridge.md",
    "opportunity_build_packet_bridge"
  ]);
  assertFileIncludes("agents/context/output-contracts.md", [
    "`opportunity_build_packet_bridge`",
    "reuse the existing packet draft approval path"
  ]);
  assertFileIncludes("agents/prompts/planner.md", ["`opportunity_build_packet_bridge` artifact"]);
  assertFileIncludes("source-of-truth/context-checklist.md", [
    "Opportunity Candidate to Build Packet Bridge",
    "`opportunity_build_packet_bridge`"
  ]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["\"opportunity_build_packet_bridge\""]);
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", [
    "\"opportunity_build_packet_bridge\"",
    "Opportunity Build Packet Bridge"
  ]);
});

runStep("guardrails block final packets, execution, and unsafe mutations", () => {
  assertFileIncludes("src/lib/engine/opportunity-build-packet-bridge.ts", [
    "noBuildPacketsCreated",
    "noFinalPacketsCreated",
    "noCodexAutoExecution",
    "noGithubIssueCreation",
    "noLabelChanges",
    "noDeploymentsCreated",
    "Do not create build packets automatically."
  ]);
  assertFileExcludes("src/lib/engine/opportunity-build-packet-bridge.ts", [
    "ai:build",
    "ai:fix",
    "APPENGINE_FOLLOW_UP_MODE=create",
    "gh issue create",
    "vercel deploy --prod"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:opportunity-build-packet-bridge\""]);
});

console.log("opportunity-build-packet-bridge smoke ok");

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
