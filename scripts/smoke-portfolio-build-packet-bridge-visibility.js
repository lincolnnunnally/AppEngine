import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("portfolio registry exposes build-packet bridge visibility", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "AppPortfolioBuildPacketBridgeVisibility",
    "buildPacketBridgeVisibility",
    "buildOpportunityBridgeVisibility",
    "candidateState",
    "buildPacketBridgeState",
    "recommendedPacketDraftType",
    "ownerApprovalStatus",
    "missingInformation",
    "nextSafeAppEngineAction",
    "sourceArtifactEvidence"
  ]);
});

runStep("Opportunity state uses existing candidate evidence instead of a parallel tracker", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "listOpportunityAppEngineCandidates",
    "opportunity_appengine_candidate",
    "opportunity_action_plan",
    "opportunity_solution_path",
    "opportunity_intake",
    "candidate exists, packet bridge not prepared yet",
    "candidate_packet_bridge",
    "No public production URL yet; remains inside AppEngine controlled-use flow."
  ]);
});

runStep("Opportunity fallback is honest when no packet bridge exists", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "no opportunity candidate created yet",
    "packet bridge not prepared yet",
    "not selected yet",
    "Seeded Opportunity entry; no live opportunity_build_packet_bridge state exists."
  ]);
});

runStep("Owner Portfolio Dashboard renders bridge details", () => {
  assertFileIncludes("src/components/engine/owner-portfolio-dashboard.tsx", [
    "BuildPacketBridgePanel",
    "Build-packet bridge",
    "Candidate state",
    "Recommended draft",
    "Next AppEngine action",
    "Source artifact evidence",
    "Missing information",
    "portfolio-bridge-panel"
  ]);
});

runStep("dashboard styles support the bridge panel and mobile layout", () => {
  assertFileIncludes("src/app/styles.css", [
    ".portfolio-bridge-panel",
    ".portfolio-bridge-heading",
    ".portfolio-bridge-grid",
    ".portfolio-bridge-missing",
    ".portfolio-bridge-grid,"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:portfolio-build-packet-bridge-visibility\""]);
});

console.log("portfolio-build-packet-bridge-visibility smoke ok");

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

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}
