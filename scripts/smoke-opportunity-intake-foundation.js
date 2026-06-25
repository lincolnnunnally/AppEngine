import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("soft-launch Opportunity Intake route is discoverable and owner-gated", () => {
  assertFileIncludes("src/app/(cockpit)/opportunity-intake/page.tsx", [
    "OpportunityIntakeForm"
  ]);
  assertFileIncludes("src/components/opportunity-intake/opportunity-intake-form.tsx", [
    "data-testid=\"opportunity-intake-page\"",
    "useState<OpportunityIntakeMode>(\"vision\")",
    "I have a problem to solve",
    "I have something I want to build",
    "Save opportunity"
  ]);
});

runStep("adapter-backed Opportunity store and artifact exist", () => {
  assertFileIncludes("src/lib/engine/opportunity-intake.ts", [
    "kind: \"opportunity_intake\"",
    "getAppEngineStateAdapter",
    "app_tool_workflow_need",
    "content_resource_need",
    "community_ministry_model_need",
    "existing_ecosystem_service_later",
    "needs_clarification",
    "copyableNextPrompt",
    "ecosystemDestinationsNotAssumedBuilt"
  ]);
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", [
    "\"opportunity_intake\"",
    "Customer-facing problem, opportunity, and solution-path intake records."
  ]);
});

runStep("opportunity intake runs through the Problem Intake Gate", () => {
  assertFileIncludes("src/lib/engine/opportunity-intake.ts", [
    "createProblemIntakeGateRecord",
    "gatePacketId",
    "OpportunityControlGateView",
    "applicableControlGates",
    "nextSafePhase",
    "controlGates: record.gate",
    "routesThroughProblemIntakeGate",
    "noArchitectureDesignImplementationFromConversation"
  ]);
});

runStep("api route preserves no-execution guardrails", () => {
  assertFileIncludes("src/app/api/opportunity-intake/route.ts", [
    "canAccessEngineOwner",
    "Unauthorized",
    "createOpportunityIntakeRecord",
    "listOpportunityIntakeRecords",
    "Cache-Control"
  ]);
  assertFileExcludes("src/lib/engine/opportunity-intake.ts", [
    "ai:build",
    "ai:fix",
    "APPENGINE_FOLLOW_UP_MODE=create",
    "gh issue create",
    "vercel deploy --prod"
  ]);
});

runStep("owner-visible Opportunity queue is wired", () => {
  assertFileIncludes("src/app/(cockpit)/owner-control-center/page.tsx", [
    "OwnerOpportunityQueue",
    "listOpportunityIntakeRecords",
    "/opportunity-intake"
  ]);
  assertFileIncludes("src/components/opportunity-intake/owner-opportunity-queue.tsx", [
    "data-testid=\"opportunity-owner-queue\"",
    "Copyable AppEngine Review Prompt",
    "Opportunity captures the first signal",
    "copyableNextPrompt"
  ]);
});

runStep("source-of-truth explains Opportunity boundaries", () => {
  assertFileIncludes("source-of-truth/opportunity-intake-foundation.md", [
    "Opportunity Intake is the customer-facing problem-to-solution front door.",
    "Opportunity is not the ecosystem itself.",
    "AppEngine is the production tool and factory.",
    "ecosystem apps and services are possible destinations or solution components",
    "Transformation and problem-solving are the product."
  ]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/opportunity-intake-foundation.md"]);
  assertFileIncludes("source-of-truth/context-checklist.md", [
    "Opportunity Intake Foundation",
    "`opportunity_intake` artifact",
    "ecosystem apps/services are possible destinations or components"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:opportunity-intake-foundation\""]);
});

console.log("opportunity-intake-foundation smoke ok");

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
