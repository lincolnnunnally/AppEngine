import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("Opportunity packet draft bridge reuses existing packet bridge infrastructure", () => {
  assertFileIncludes("src/lib/engine/opportunity-build-packet-bridge.ts", [
    "kind: \"opportunity_build_packet_bridge\"",
    "kind: \"candidate_packet_bridge\"",
    "source-of-truth/candidate-to-packet-bridge.md",
    "reusesCandidatePacketBridgeStandard",
    "createOpportunityBuildPacketBridge",
    "listOpportunityBuildPacketBridges"
  ]);
});

runStep("owner approval is required before preparing a packet draft", () => {
  assertFileIncludes("src/lib/engine/opportunity-build-packet-bridge.ts", [
    "ownerApproved !== true",
    "Owner approval is required before preparing a packet draft.",
    "ownerApprovalStatus: \"owner_approved_for_packet_draft\"",
    "nextSafeAction: \"review_packet_draft\""
  ]);
});

runStep("supported Opportunity candidate outputs map to allowed draft types", () => {
  assertFileIncludes("src/lib/engine/opportunity-build-packet-bridge.ts", [
    "app_build_candidate: \"app_build_packet_draft\"",
    "workflow_candidate: \"workflow_solution_plan_draft\"",
    "content_resource_candidate: \"content_resource_plan_draft\"",
    "community_model_candidate: \"community_model_plan_draft\"",
    "Candidate type ${candidate.candidateType} is not ready for a packet draft"
  ]);
});

runStep("bridge updates Project Memory and Audit Trail", () => {
  assertFileIncludes("src/lib/engine/opportunity-build-packet-bridge.ts", [
    "updateProjectMemoryFromOpportunityBuildPacketBridge",
    "getAppEngineAuditTrail().append",
    "opportunity_packet_draft_prepared"
  ]);
  assertFileIncludes("src/lib/engine/project-memory.ts", [
    "updateProjectMemoryFromOpportunityBuildPacketBridge",
    "Opportunity packet draft prepared for owner review",
    "source-of-truth/candidate-to-packet-bridge.md"
  ]);
  assertFileIncludes("src/lib/engine/audit-trail-lite.ts", ["\"opportunity_packet_draft_prepared\""]);
});

runStep("API route is owner-gated and adapter-backed", () => {
  assertFileIncludes("src/app/api/opportunity-build-packet-bridge/route.ts", [
    "canAccessEngineAdmin",
    "createOpportunityBuildPacketBridge",
    "listOpportunityBuildPacketBridges",
    "candidateId: body?.candidateId",
    "ownerApproved: body?.ownerApproved",
    "Cache-Control"
  ]);
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", [
    "\"opportunity_build_packet_bridge\"",
    "Opportunity Build Packet Bridge"
  ]);
});

runStep("Owner Control Center exposes Prepare Packet Draft action", () => {
  assertFileIncludes("src/app/owner-control-center/page.tsx", [
    "listOpportunityBuildPacketBridges",
    "initialBuildPacketBridges"
  ]);
  assertFileIncludes("src/components/opportunity-intake/owner-opportunity-queue.tsx", [
    "Prepare Packet Draft",
    "/api/opportunity-build-packet-bridge",
    "ownerApproved: true",
    "opportunity-packet-draft-output",
    "Packet draft status",
    "Packet type",
    "Source candidate",
    "Missing information",
    "Next safe action",
    "Copyable Packet Draft Review Prompt"
  ]);
});

runStep("Portfolio Dashboard reads prepared packet draft state", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "listOpportunityBuildPacketBridges",
    "opportunityBuildPacketBridges",
    "opportunity_build_packet_bridge",
    "latestBridge",
    "recommendedPacketDraftType: state.latestBridge.packetType"
  ]);
});

runStep("guardrails block unsafe automation", () => {
  assertFileIncludes("src/lib/engine/opportunity-build-packet-bridge.ts", [
    "noFinalPacketsCreated",
    "noCodexAutoExecution",
    "noGitHubIssueCreation",
    "noLabelChanges",
    "noProductionDeploy",
    "noPaidResources",
    "noMigrations",
    "noSecretsOrEnvChanges",
    "repositoryVisibilityUnchanged"
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
  assertFileIncludes("package.json", ["\"smoke:candidate-to-packet-draft-action\""]);
});

console.log("candidate-to-packet-draft-action smoke ok");

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
