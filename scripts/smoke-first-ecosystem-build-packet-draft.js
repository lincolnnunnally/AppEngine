import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("build packet draft uses the prepared ecosystem handoff", () => {
  assertFileIncludes("src/lib/engine/first-ecosystem-build-packet-draft.ts", [
    "first_ecosystem_build_packet_draft",
    "listFirstRealEcosystemBuildRequests",
    "sourcePreparedHandoffId",
    "Life Produces Life Core",
    "United Under God ecosystem foundation",
    "transformation is the product",
    "apps are tools"
  ]);
});

runStep("draft includes the required packet fields", () => {
  assertFileIncludes("src/lib/engine/first-ecosystem-build-packet-draft.ts", [
    "purpose",
    "userBenefit",
    "coreFeatures",
    "requiredScreensRoutes",
    "dataModelNeeds",
    "designIntent",
    "acceptanceCriteria",
    "guardrailNotes",
    "nextSafeAction"
  ]);
});

runStep("draft updates memory and audit without unsafe execution", () => {
  assertFileIncludes("src/lib/engine/first-ecosystem-build-packet-draft.ts", [
    "updateProjectMemoryFromFirstEcosystemBuildPacketDraft",
    "getAppEngineAuditTrail().append",
    "opportunity_packet_draft_prepared",
    "finalPacketCreated: false",
    "codexTriggered: false",
    "githubIssuesCreated: false",
    "deployed: false"
  ]);
  assertFileIncludes("src/lib/engine/project-memory.ts", [
    "updateProjectMemoryFromFirstEcosystemBuildPacketDraft",
    "First ecosystem build packet draft ready for owner review",
    "Life Produces Life Core"
  ]);
});

runStep("Owner Control Center shows the draft clearly", () => {
  assertFileIncludes("src/components/opportunity-intake/first-ecosystem-build-packet-draft-panel.tsx", [
    "first-ecosystem-build-packet-draft",
    "Prepare packet draft",
    "first-ecosystem-build-packet-draft-output",
    "Purpose",
    "User benefit",
    "Core features",
    "Data model needs",
    "Acceptance criteria",
    "Design intent",
    "Copyable next AppEngine prompt"
  ]);
  assertFileIncludes("src/app/(cockpit)/owner-control-center/page.tsx", [
    "FirstEcosystemBuildPacketDraftPanel",
    "listFirstEcosystemBuildPacketDrafts"
  ]);
});

runStep("Portfolio Dashboard reflects Life Core packet draft readiness", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "listFirstEcosystemBuildPacketDrafts",
    "first ecosystem build packet draft ready for owner review",
    "first_ecosystem_build_packet_draft",
    "First Ecosystem Build Packet Draft"
  ]);
});

runStep("owner-gated API creates draft safely", () => {
  assertFileIncludes("src/app/api/first-ecosystem-build-packet-draft/route.ts", [
    "canAccessEngineAdmin",
    "createFirstEcosystemBuildPacketDraft",
    "loadOwnerPortfolioRegistry",
    "loadProjectMemory",
    "codexAutoExecutionBlocked",
    "githubIssueCreationBlocked",
    "labelChangesBlocked",
    "finalPacketCreationBlocked"
  ]);
});

runStep("guardrails block automation and infrastructure changes", () => {
  assertFileIncludes("src/lib/engine/first-ecosystem-build-packet-draft.ts", [
    "noFinalPacketCreated",
    "noCodexAutoExecution",
    "noGitHubIssueCreation",
    "noLabelChanges",
    "noProductionDeploy",
    "noPaidResources",
    "noLiveMigrations",
    "noSecretsOrEnvChanges",
    "repositoryVisibilityUnchanged"
  ]);
  assertFileExcludes("src/lib/engine/first-ecosystem-build-packet-draft.ts", [
    "gh issue create",
    "ai:build",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

runStep("package script and styles are wired", () => {
  assertFileIncludes("package.json", ["\"smoke:first-ecosystem-build-packet-draft\""]);
  assertFileIncludes("src/app/styles.css", [
    ".first-ecosystem-build-packet-draft",
    ".first-packet-draft-output",
    ".first-packet-route-grid"
  ]);
});

console.log("first-ecosystem-build-packet-draft smoke ok");

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
