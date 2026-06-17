import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("readiness report is a first-class Opportunity artifact", () => {
  assertFileIncludes("src/lib/engine/opportunity-controlled-use-readiness.ts", [
    "kind: \"opportunity_controlled_use_readiness\"",
    "OpportunityControlledUseReadinessStatus",
    "loadOpportunityControlledUseReadiness",
    "opportunityControlledUseReadinessGuardrails"
  ]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["\"opportunity_controlled_use_readiness\""]);
});

runStep("report confirms the complete full-loop status stages", () => {
  assertFileIncludes("src/lib/engine/opportunity-controlled-use-readiness.ts", [
    "\"intake\"",
    "\"clarification\"",
    "\"solution_path\"",
    "\"action_plan\"",
    "\"appengine_candidate\"",
    "\"packet_draft_bridge\"",
    "\"portfolio_visibility\"",
    "\"audit_trail\"",
    "\"project_memory\""
  ]);
});

runStep("readiness statuses match controlled-use requirements", () => {
  assertFileIncludes("src/lib/engine/opportunity-controlled-use-readiness.ts", [
    "\"ready_for_internal_controlled_use\"",
    "\"blocked_for_public_use\"",
    "\"blocked_for_autonomous_execution\"",
    "Opportunity is ready for internal controlled use with owner review and local/mock persistence."
  ]);
});

runStep("exact public and autonomy blockers are listed", () => {
  assertFileIncludes("src/lib/engine/opportunity-controlled-use-readiness.ts", [
    "\"stable public review URLs\"",
    "\"durable production persistence\"",
    "\"production auth confirmation\"",
    "\"customer privacy/data retention\"",
    "\"Codex auto-execution still disabled\""
  ]);
});

runStep("next operational action is one real internal Opportunity example", () => {
  assertFileIncludes("src/lib/engine/opportunity-controlled-use-readiness.ts", [
    "run_one_real_internal_opportunity_example_through_the_full_loop",
    "Run one real internal Opportunity example through the full loop.",
    "submit one real internal Opportunity example"
  ]);
});

runStep("Owner Control Center renders the readiness panel", () => {
  assertFileIncludes("src/app/owner-control-center/page.tsx", [
    "OpportunityControlledUseReadinessPanel",
    "loadOpportunityControlledUseReadiness",
    "opportunityControlledUseReadiness"
  ]);
  assertFileIncludes("src/components/opportunity-intake/opportunity-controlled-use-readiness-panel.tsx", [
    "opportunity-controlled-use-readiness",
    "Controlled-use status for the Opportunity engine",
    "Full loop confirmation",
    "Exact blockers before public/customer/autonomous use",
    "Copyable next operational action"
  ]);
});

runStep("guardrails preserve safe controlled-use boundaries", () => {
  assertFileIncludes("src/lib/engine/opportunity-controlled-use-readiness.ts", [
    "noCodexAutoExecution",
    "noGitHubIssueCreation",
    "noLabelChanges",
    "noProductionDeploy",
    "noPaidResources",
    "noLiveMigrations",
    "noSecretsOrEnvChanges",
    "repositoryVisibilityUnchanged"
  ]);
  assertFileExcludes("src/lib/engine/opportunity-controlled-use-readiness.ts", [
    "gh issue create",
    "ai:build",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

runStep("styles and package script are wired", () => {
  assertFileIncludes("src/app/styles.css", [
    ".opportunity-controlled-use-readiness",
    ".opportunity-readiness-status-grid",
    ".opportunity-readiness-check-grid"
  ]);
  assertFileIncludes("package.json", ["\"smoke:opportunity-controlled-use-readiness\""]);
});

console.log("opportunity-controlled-use-readiness smoke ok");

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
