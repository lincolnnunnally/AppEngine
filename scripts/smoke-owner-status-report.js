import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-owner-status-"));
const agentRunDir = path.join(smokeRoot, "agent-run");
const buildCompletionPath = path.join(smokeRoot, "build-completion-plan.json");
const lifecyclePath = path.join(smokeRoot, "deployment-lifecycle.json");
const previewPath = path.join(smokeRoot, "preview-verification.json");
const costPath = path.join(smokeRoot, "cost-governance.json");
const reportPath = path.join(agentRunDir, "owner-status-report.json");
const markdownPath = path.join(agentRunDir, "owner-status-report.md");

fs.mkdirSync(agentRunDir, { recursive: true });

writeJson(lifecyclePath, {
  kind: "deployment_lifecycle",
  schemaVersion: 1,
  app: {
    name: "Spark of Hope Intake Lite",
    slug: "spark-of-hope-intake-lite"
  },
  reviewUrl: "https://review.spark-of-hope.example.test",
  productionUrl: "approval-gated",
  deploymentUrl: "https://spark-build-preview.example.test",
  deploymentState: "review_ready",
  currentVersion: "v1",
  reviewVersion: "v1",
  productionVersion: "not_released",
  approvalRequired: true,
  lastDeploymentTimestamp: "2026-06-15T00:00:00.000Z",
  discovery: {
    reviewUrlKnown: true,
    productionUrlKnown: false,
    deploymentUrlKnown: true
  },
  guardrails: {
    productionDeployBlockedUntilApproval: true,
    paidResourcesBlockedUntilApproval: true,
    migrationsBlockedUntilApproval: true,
    generatedCodeAutoMergeBlocked: true,
    protectedPreviewBypassLinksPubliclyBlocked: true
  }
});

writeJson(previewPath, {
  kind: "preview_verification",
  schemaVersion: 1,
  status: "passed",
  summary: "Preview route /spark-of-hope-intake-lite passed route-specific verification.",
  previewRootUrl: "https://spark-build-preview.example.test",
  reviewUrl: "https://review.spark-of-hope.example.test",
  productionUrl: "approval-gated",
  expectedRoute: "/spark-of-hope-intake-lite",
  checkedUrl: "https://review.spark-of-hope.example.test/spark-of-hope-intake-lite",
  commitSha: "abc1234",
  deploymentState: "READY",
  checkedAt: "2026-06-15T00:00:00.000Z",
  checks: []
});

writeJson(costPath, {
  kind: "cost_governance",
  schemaVersion: 1,
  app: {
    name: "Spark of Hope Intake Lite",
    slug: "spark-of-hope-intake-lite"
  },
  monthlyBudget: 25,
  monthlySpend: 4,
  projectSpend: 4,
  appSpend: 2,
  issueSpend: 0.25,
  remainingBudget: 21,
  estimatedNextSpend: 0.5,
  thresholdStatus: "within_budget",
  modelRouting: {
    taskClass: "medium",
    recommendedClass: "medium"
  },
  nextBudgetAction: "continue",
  ownerApprovalRequired: false,
  guardrails: {}
});

writeJson(buildCompletionPath, {
  kind: "build_completion_plan",
  schemaVersion: 1,
  app: {
    name: "Spark of Hope Intake Lite",
    slug: "spark-of-hope-intake-lite"
  },
  sourceIssue: {
    number: "55",
    title: "Spark of Hope Intake Lite MVP",
    url: "https://github.com/lincolnnunnally/AppEngine/issues/55"
  },
  currentPhase: "review",
  currentState: "review_ready",
  nextSafeAction: "await_owner_review",
  blockedReason: "Owner review is required before release approval.",
  ownerApprovalRequired: true,
  relatedPr: "https://github.com/lincolnnunnally/AppEngine/pull/55",
  relatedPreviewUrl: "https://spark-build-preview.example.test",
  reviewUrl: "https://review.spark-of-hope.example.test/spark-of-hope-intake-lite",
  productionUrl: "approval-gated",
  deploymentState: "review_ready",
  currentVersion: "v1",
  deploymentLifecycle: readJson(lifecyclePath),
  requiredGates: [],
  passedGates: [],
  failedGates: [],
  followUpTasks: [],
  evidenceLinks: [
    {
      label: "PR",
      url: "https://github.com/lincolnnunnally/AppEngine/pull/55"
    }
  ],
  safety: {},
  costGovernance: readJson(costPath),
  budgetAwareNextSafeAction: "continue",
  guardrails: {
    productionDeployBlocked: true,
    paidResourcesBlocked: true,
    migrationsBlocked: true,
    autoMergeBlocked: true
  }
});

runStep("owner status report summarizes build state", () => {
  runNode("scripts/create-owner-status-report.js", {
    AGENT_RUN_DIR: agentRunDir,
    BUILD_COMPLETION_PLAN_INPUT: buildCompletionPath,
    DEPLOYMENT_LIFECYCLE_INPUT: lifecyclePath,
    PREVIEW_VERIFICATION_INPUT: previewPath,
    COST_GOVERNANCE_INPUT: costPath,
    OWNER_STATUS_REPORT_OUTPUT: reportPath,
    OWNER_STATUS_REPORT_MARKDOWN_OUTPUT: markdownPath
  });

  const report = readJson(reportPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");

  assertEqual(report.kind, "owner_status_report", "report kind");
  assertEqual(report.app.slug, "spark-of-hope-intake-lite", "report app slug");
  assertEqual(report.reviewUrl, "https://review.spark-of-hope.example.test/spark-of-hope-intake-lite", "report review URL");
  assertEqual(report.productionUrl, "approval-gated", "report production URL");
  assertEqual(report.currentState, "review_ready", "report current state");
  assertEqual(report.deploymentState, "review_ready", "report deployment state");
  assertEqual(report.currentVersion, "v1", "report current version");
  assertEqual(report.nextSafeAction, "await_owner_review", "report next safe action");
  assertIncludes(report.ownerReadable.whereIsTheApp, "Review here:", "report tells owner where to look");
  assertIncludes(report.ownerReadable.blockingProgress, "Owner review is required", "report names blocker");
  assertEqual(report.guardrails.productionDeployBlocked, true, "production stays blocked");
  assertIncludes(markdown, "## Owner Status Report", "markdown report has title");
  assertIncludes(markdown, "Review here:", "markdown report names review URL");
  assertIncludes(markdown, "Production: blocked/not live yet", "markdown report blocks production");
});

console.log(`owner-status smoke ok (${smokeRoot})`);

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function runNode(scriptPath, env) {
  return execFileSync(process.execPath, [path.join(repoRoot, scriptPath)], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(value, expected, message) {
  if (!String(value).includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(value)} to include ${JSON.stringify(expected)}`);
  }
}
