import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-published-phase-issue-registry-"));

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/published-phase-issue-registry.md", [
    "phase_issue_publisher_manual",
    "published_phase_issue_registry",
    "manual_publish_completed",
    "published_tracking_only"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/published-phase-issue-registry.md", "published_phase_issue_registry"]);
  assertFileIncludes("agents/context/output-contracts.md", ["published_phase_issue_registry"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["published_phase_issue_registry"]);
});

runStep("completed manual publish creates registry", () => {
  const manualPublish = phaseIssuePublisherManual({
    results: [
      publishResult("discovery", 1, "Discovery", 101, ["ai:plan"]),
      publishResult("solution_design", 2, "Solution Design", 102, ["ai:plan"])
    ]
  });
  const registry = runRegistry("completed-manual-publish.json", manualPublish);

  assertEqual(registry.kind, "published_phase_issue_registry", "artifact kind");
  assertEqual(registry.sourceArtifact.kind, "phase_issue_publisher_manual", "source kind");
  assertEqual(registry.sourcePacket.kind, "non_app_solution_plan", "source packet");
  assertEqual(registry.publishedIssues.length, 2, "published issue count");
  assertEqual(registry.publishedIssues[0].issueNumber, 101, "issue number");
  assertEqual(registry.publishedIssues[0].url, "https://github.com/lincolnnunnally/AppEngine/issues/101", "issue URL");
  assertEqual(registry.publishedIssues[0].phaseOrder, 1, "phase order");
  assertEqual(registry.currentStatus, "published_tracking_only", "status");
  assertEqual(registry.nextSafeAction, "review_published_phase_issues", "next safe action");
  assertEqual(registry.decision.codexBuildTriggered, false, "no Codex build");
  assertEqual(registry.decision.githubIssuesCreatedByRegistry, false, "registry creates no issues");
  assertEqual(registry.guardrails.noLabelsAdded, true, "no labels added");
});

runStep("manual no-op output fails honestly", () => {
  const manualPublish = phaseIssuePublisherManual({
    publishStatus: "manual_publish_not_enabled",
    githubIssuesCreated: false,
    results: [publishResult("discovery", 1, "Discovery", 0, ["ai:plan"], { created: false, url: "" })]
  });

  assertThrows(() => {
    runRegistry("manual-noop.json", manualPublish);
  }, "manual_publish_completed");
});

runStep("manual mock output fails honestly", () => {
  const manualPublish = phaseIssuePublisherManual({
    publishStatus: "mock_publish_validated",
    githubIssuesCreated: false,
    mockIssuesCreated: true,
    results: [publishResult("discovery", 1, "Discovery", 0, ["ai:plan"], { created: false, mocked: true, url: "mock://issues/1" })]
  });

  assertThrows(() => {
    runRegistry("manual-mock.json", manualPublish);
  }, "manual_publish_completed");
});

runStep("missing issue URL fails honestly", () => {
  const manualPublish = phaseIssuePublisherManual({
    results: [publishResult("discovery", 1, "Discovery", 101, ["ai:plan"], { url: "" })]
  });

  assertThrows(() => {
    runRegistry("missing-url.json", manualPublish);
  }, "url");
});

runStep("missing phase order fails honestly", () => {
  const result = publishResult("discovery", 1, "Discovery", 101, ["ai:plan"]);
  delete result.phaseOrder;
  const manualPublish = phaseIssuePublisherManual({ results: [result] });

  assertThrows(() => {
    runRegistry("missing-phase-order.json", manualPublish);
  }, "phaseOrder");
});

runStep("build-triggering labels fail honestly", () => {
  const manualPublish = phaseIssuePublisherManual({
    results: [publishResult("build", 1, "Build", 101, ["ai:build"])]
  });

  assertThrows(() => {
    runRegistry("unsafe-label.json", manualPublish);
  }, "ai:build");
});

console.log(`published-phase-issue-registry smoke ok (${smokeRoot})`);

function runRegistry(name, manualPublish) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-registry.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-registry.md"));
  const issuesPath = path.join(smokeRoot, name.replace(".json", "-issues.json"));

  writeJson(inputPath, { phase_issue_publisher_manual: manualPublish });

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-published-phase-issue-registry.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PUBLISHED_PHASE_ISSUE_REGISTRY_INPUT: inputPath,
      PUBLISHED_PHASE_ISSUE_REGISTRY_OUTPUT: outputPath,
      PUBLISHED_PHASE_ISSUE_REGISTRY_MARKDOWN_OUTPUT: markdownPath,
      PUBLISHED_PHASE_ISSUE_REGISTRY_ISSUES_OUTPUT: issuesPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const registry = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const issues = readJson(issuesPath);

  assertIncludes(markdown, "Published Phase Issue Registry", "owner report");
  assertIncludes(registry.ownerReadableReport, "Codex build triggered: no", "owner Codex guardrail");
  assertEqual(issues.publishedIssues.length, registry.publishedIssues.length, "issues output count");

  return registry;
}

function phaseIssuePublisherManual({
  results,
  publishStatus = "manual_publish_completed",
  githubIssuesCreated = true,
  mockIssuesCreated = false
}) {
  return {
    kind: "phase_issue_publisher_manual",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "phase_issue_publisher_dry_run",
      candidateSlug: "church-care-follow-up",
      candidateType: "workflow_process_candidate",
      finalPacketType: "non_app_solution_plan"
    },
    candidate: {
      name: "Church Care Follow Up",
      slug: "church-care-follow-up",
      type: "workflow_process_candidate",
      summary: "workflow process candidate for church care follow-up.",
      needAddressed: "timely care coordination",
      desiredTransformation: "people receive timely care and stay connected"
    },
    sourceFinalPacket: {
      kind: "non_app_solution_plan",
      status: "final_review_ready"
    },
    publishMode: {
      requestedMode: "manual",
      manualModeEnabled: true,
      ownerApproved: true,
      mockMode: mockIssuesCreated,
      repository: "lincolnnunnally/AppEngine"
    },
    publishResults: results,
    phaseOrder: results.map((result) => result.phase),
    labelsToApply: [...new Set(results.flatMap((result) => result.appliedLabels))],
    decision: {
      publishStatus,
      nextSafeAction: "review_published_phase_issues",
      githubIssuesCreated,
      mockIssuesCreated,
      codexBuildTriggered: false,
      ownerApprovalRequired: true,
      reason: "Manual publish output for smoke test."
    },
    ownerReadableReport: "Phase Issue Publisher Manual Mode",
    guardrails: {
      manualPublishingOnly: true,
      defaultDryRunNoop: true,
      noUi: true,
      noCodexBuildTriggered: true,
      noProductionDeploy: true,
      noPaidResources: true,
      noMigrations: true,
      noSecretsOrEnvChanges: true,
      repositoryVisibilityUnchanged: true,
      noGeneratedCodeAutoMerge: true
    }
  };
}

function publishResult(phase, phaseOrder, title, issueNumber, labels, overrides = {}) {
  return {
    title: `[church-care-follow-up] ${title}`,
    phase,
    phaseOrder,
    requestedLabels: labels,
    appliedLabels: labels,
    blockedLabels: [],
    mocked: false,
    created: true,
    url: `https://github.com/lincolnnunnally/AppEngine/issues/${issueNumber}`,
    issueNumber,
    reason: "GitHub issue created in explicit manual mode.",
    ...overrides
  };
}

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertFileIncludes(filePath, expected) {
  const content = fs.readFileSync(path.join(repoRoot, filePath), "utf8");
  for (const item of expected) assertIncludes(content, item, filePath);
}

function assertIncludes(content, expected, label) {
  if (!String(content).includes(expected)) throw new Error(`${label} missing ${expected}`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
}

function assertThrows(fn, expectedMessage) {
  try {
    fn();
  } catch (caught) {
    if (!String(caught.message).includes(expectedMessage)) {
      throw new Error(`Expected error to include "${expectedMessage}", received "${caught.message}"`);
    }
    return;
  }

  throw new Error(`Expected function to throw ${expectedMessage}`);
}
