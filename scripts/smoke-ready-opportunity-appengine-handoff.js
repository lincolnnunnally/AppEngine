import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("ready Opportunity handoff uses result review input", () => {
  assertFileIncludes("src/lib/engine/handoff-relay.ts", [
    "RealOpportunityResultReviewRecord",
    "createPreparedHandoffFromReadyOpportunityResultReview",
    "savePreparedHandoffFromReadyOpportunityResultReview",
    "ready_for_next_appengine_action"
  ]);
});

runStep("handoff fails honestly unless review is ready", () => {
  assertFileIncludes("src/lib/engine/handoff-relay.ts", [
    "Only real Opportunity result reviews marked ready_for_next_appengine_action",
    "throw new Error"
  ]);
  assertFileIncludes("src/app/api/ready-opportunity-appengine-handoff/route.ts", [
    "Only reviews marked ready_for_next_appengine_action",
    "reviewStatus"
  ]);
});

runStep("prepared handoff contains required Opportunity context", () => {
  assertFileIncludes("src/lib/engine/handoff-relay.ts", [
    "Original problem/vision",
    "Clarified opportunity",
    "Selected solution path",
    "Action plan",
    "Candidate type",
    "Packet draft bridge state",
    "Next safe AppEngine action",
    "Required verification",
    "Expected result",
    "Guardrails preserved"
  ]);
});

runStep("prepared handoff is saved to existing Handoff Relay system", () => {
  assertFileIncludes("src/lib/engine/handoff-relay.ts", [
    "opportunity_prepared_handoff",
    "store.handoffs",
    "Handoff Inbox",
    "updateProjectMemoryFromHandoff"
  ]);
  assertFileIncludes("src/components/engine/handoff-relay-control-center.tsx", [
    "opportunity_prepared_handoff",
    "Prepared Opportunity handoff"
  ]);
});

runStep("memory, audit, and portfolio are updated", () => {
  assertFileIncludes("src/lib/engine/handoff-relay.ts", [
    "getAppEngineAuditTrail().append",
    "handoff_prepared",
    "sourceReviewId"
  ]);
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "listHandoffRelaySummaries",
    "prepared AppEngine handoff waiting in Handoff Inbox",
    "handoff_relay_summary"
  ]);
});

runStep("owner-gated API prepares the handoff safely", () => {
  assertFileIncludes("src/app/api/ready-opportunity-appengine-handoff/route.ts", [
    "canAccessEngineAdmin",
    "savePreparedHandoffFromReadyOpportunityResultReview",
    "loadOwnerPortfolioRegistry",
    "codexAutoExecutionBlocked",
    "githubIssueCreationBlocked",
    "finalPacketCreationBlocked"
  ]);
});

runStep("Owner Control Center exposes confirmation and copyable handoff", () => {
  assertFileIncludes("src/components/opportunity-intake/owner-opportunity-queue.tsx", [
    "Prepare AppEngine Handoff",
    "/api/ready-opportunity-appengine-handoff",
    "ready-opportunity-appengine-handoff",
    "ready-opportunity-appengine-handoff-output",
    "Saved to Handoff Inbox",
    "copyable-prompt-box"
  ]);
});

runStep("guardrails block unsafe automation and infrastructure changes", () => {
  assertFileIncludes("src/lib/engine/handoff-relay.ts", [
    "No automatic Codex execution.",
    "No GitHub issue creation.",
    "No label changes.",
    "No production deploy.",
    "No paid resources.",
    "No live migrations.",
    "No secrets/env changes.",
    "No repository visibility changes.",
    "No final packet created automatically."
  ]);
  assertFileExcludes("src/lib/engine/handoff-relay.ts", [
    "ai:build",
    "gh issue create",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

runStep("styles and package script are wired", () => {
  assertFileIncludes("src/app/styles.css", [
    ".ready-opportunity-handoff-panel",
    ".real-opportunity-handoff-output"
  ]);
  assertFileIncludes("package.json", ["\"smoke:ready-opportunity-appengine-handoff\""]);
});

console.log("ready-opportunity-appengine-handoff smoke ok");

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
