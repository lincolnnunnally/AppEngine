import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("completion check artifact reads the existing Opportunity evidence chain", () => {
  assertFileIncludes("src/lib/engine/opportunity-internal-use-completion-check.ts", [
    "opportunity_internal_use_completion_check",
    "listRealOpportunityExamples",
    "listRealOpportunityResultReviews",
    "listHandoffRelaySummaries",
    "loadOwnerPortfolioRegistry",
    "loadProjectMemory",
    "getAppEngineAuditTrail"
  ]);
});

runStep("completion check verifies the full internal-use path", () => {
  assertFileIncludes("src/lib/engine/opportunity-internal-use-completion-check.ts", [
    "real_opportunity_example",
    "result_review",
    "ready_for_next_appengine_action",
    "prepared_handoff_in_handoff_inbox",
    "portfolio_updated",
    "project_memory_updated",
    "audit_trail_updated"
  ]);
});

runStep("completion statuses and exact blockers are present", () => {
  assertFileIncludes("src/lib/engine/opportunity-internal-use-completion-check.ts", [
    "usable_for_internal_controlled_use",
    "blocked_for_public_customer_use",
    "blocked_for_autonomous_execution",
    "stable review URLs/public deployment",
    "durable production persistence",
    "production auth/env confirmation",
    "privacy/data retention",
    "Codex auto-execution permissions"
  ]);
});

runStep("next operational instruction is explicit and owner-facing", () => {
  assertFileIncludes("src/lib/engine/opportunity-internal-use-completion-check.ts", [
    "Run one real ecosystem build request through Opportunity, then use prepared handoff to begin AppEngine build work."
  ]);
  assertFileIncludes("src/components/opportunity-intake/opportunity-internal-use-completion-check-panel.tsx", [
    "opportunity-internal-use-completion-check",
    "opportunity-internal-use-completion-status",
    "Full internal-use path",
    "Remaining blockers before wider use",
    "Next operational instruction"
  ]);
});

runStep("Owner Control Center renders the completion check", () => {
  assertFileIncludes("src/app/owner-control-center/page.tsx", [
    "OpportunityInternalUseCompletionCheckPanel",
    "loadOpportunityInternalUseCompletionCheck",
    "opportunityInternalUseCompletionCheck"
  ]);
});

runStep("guardrails block automation and infrastructure changes", () => {
  assertFileIncludes("src/lib/engine/opportunity-internal-use-completion-check.ts", [
    "completionCheckOnly",
    "noCodexAutoExecution",
    "noGitHubIssueCreation",
    "noLabelChanges",
    "noProductionDeploy",
    "noPaidResources",
    "noLiveMigrations",
    "noSecretsOrEnvChanges",
    "repositoryVisibilityUnchanged"
  ]);
  assertFileExcludes("src/lib/engine/opportunity-internal-use-completion-check.ts", [
    "gh issue create",
    "ai:build",
    "vercel deploy --prod",
    "APPENGINE_FOLLOW_UP_MODE=create"
  ]);
});

runStep("package script and styles are wired", () => {
  assertFileIncludes("package.json", ["\"smoke:opportunity-internal-use-completion-check\""]);
  assertFileIncludes("src/app/styles.css", [
    ".opportunity-internal-use-completion",
    ".readiness-status-card.usable_for_internal_controlled_use",
    ".readiness-status-card.blocked_for_public_customer_use"
  ]);
});

console.log("opportunity-internal-use-completion-check smoke ok");

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
