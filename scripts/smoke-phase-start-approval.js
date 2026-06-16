import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-phase-start-approval-"));

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/phase-start-approval-gate.md", [
    "published_phase_issue_registry",
    "phase_start_approval",
    "approved_for_manual_phase_start",
    "noExecutionLabelsAdded"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/phase-start-approval-gate.md", "phase_start_approval"]);
  assertFileIncludes("agents/context/output-contracts.md", ["phase_start_approval"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["phase_start_approval"]);
});

runStep("first published phase can be approved without adding labels", () => {
  const result = runApproval("approved-first-phase.json", registry(), startRequest({
    targetIssueNumber: 101,
    ownerApprovalNotes: "Owner reviewed the discovery issue and approved manual phase start.",
    acceptanceCriteriaPresent: true
  }));

  assertEqual(result.kind, "phase_start_approval", "artifact kind");
  assertEqual(result.approvalStatus, "approved_for_manual_phase_start", "approval status");
  assertEqual(result.decision.approvedForManualPhaseStart, true, "approved");
  assertEqual(result.decision.labelsAdded, false, "labels not added");
  assertEqual(result.decision.executionLabelsApproved, false, "execution labels not approved");
  assertEqual(result.decision.codexBuildTriggered, false, "Codex not triggered");
  assertEqual(result.decision.nextSafeAction, "await_manual_execution_label", "next action");
});

runStep("later phase requires previous phases complete or not required", () => {
  const result = runApproval("missing-previous-phase.json", registry(), startRequest({
    targetIssueNumber: 102,
    ownerApprovalNotes: "Owner wants to start solution design.",
    acceptanceCriteriaPresent: true
  }));

  assertEqual(result.approvalStatus, "needs_revision", "approval status");
  assertIncludes(result.approvalChecks.phaseOrderRespected.notes, "discovery", "missing previous phase note");
});

runStep("later phase passes when previous phase is complete", () => {
  const result = runApproval("previous-phase-complete.json", registry(), startRequest({
    targetIssueNumber: 102,
    completedPhases: ["discovery"],
    ownerApprovalNotes: "Discovery is complete and owner approved solution design start.",
    acceptanceCriteriaPresent: true
  }));

  assertEqual(result.approvalStatus, "approved_for_manual_phase_start", "approval status");
  assertEqual(result.completedPhases[0], "discovery", "completed phase recorded");
});

runStep("missing target issue produces needs revision", () => {
  const result = runApproval("missing-target.json", registry(), startRequest({
    targetIssueNumber: 999,
    ownerApprovalNotes: "Owner approved a missing issue by mistake.",
    acceptanceCriteriaPresent: true
  }));

  assertEqual(result.approvalStatus, "needs_revision", "approval status");
  assertEqual(result.approvalChecks.issueExistsInRegistry.status, "needs_revision", "missing issue check");
});

runStep("missing acceptance criteria produces needs revision", () => {
  const result = runApproval("missing-acceptance.json", registry(), startRequest({
    targetIssueNumber: 101,
    ownerApprovalNotes: "Owner notes are present.",
    acceptanceCriteriaPresent: false
  }));

  assertEqual(result.approvalStatus, "needs_revision", "approval status");
  assertEqual(result.approvalChecks.acceptanceCriteriaPresent.status, "needs_revision", "acceptance check");
});

runStep("security, cost, and scope risks block approval", () => {
  const expectations = [
    ["blocked_by_security", { noSecretsEnvRisk: false }],
    ["blocked_by_security", { noMigrationRisk: false }],
    ["blocked_by_scope", { noProductionDeployRisk: false }],
    ["blocked_by_cost", { noPaidResourceRisk: false }]
  ];

  for (const [status, riskOverrides] of expectations) {
    const result = runApproval(`${status}-${Object.keys(riskOverrides)[0]}.json`, registry(), startRequest({
      targetIssueNumber: 101,
      ownerApprovalNotes: `${status} smoke coverage.`,
      acceptanceCriteriaPresent: true,
      riskReview: {
        noSecretsEnvRisk: true,
        noMigrationRisk: true,
        noProductionDeployRisk: true,
        noPaidResourceRisk: true,
        ...riskOverrides
      }
    }));

    assertEqual(result.approvalStatus, status, `${status} approval status`);
    assertEqual(result.decision.codexBuildTriggered, false, `${status} Codex guardrail`);
  }
});

runStep("manual rejection is represented honestly", () => {
  const result = runApproval("rejected.json", registry(), startRequest({
    targetIssueNumber: 101,
    status: "rejected",
    ownerApprovalNotes: "Owner rejected this phase start for now.",
    acceptanceCriteriaPresent: true
  }));

  assertEqual(result.approvalStatus, "rejected", "approval status");
  assertEqual(result.decision.nextSafeAction, "record_phase_start_rejection", "next action");
});

runStep("build-triggering labels in registry fail honestly", () => {
  const badRegistry = registry();
  badRegistry.publishedIssues[0].labels = ["ai:build"];
  badRegistry.issueLabels = ["ai:build"];

  assertThrows(() => {
    runApproval("unsafe-registry-label.json", badRegistry, startRequest({
      targetIssueNumber: 101,
      ownerApprovalNotes: "Owner notes are present.",
      acceptanceCriteriaPresent: true
    }));
  }, "executionLabel");
});

console.log(`phase-start-approval smoke ok (${smokeRoot})`);

function runApproval(name, registryArtifact, approvalInput) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-approval.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-approval.md"));
  const followUpsPath = path.join(smokeRoot, name.replace(".json", "-followups.json"));

  writeJson(inputPath, {
    published_phase_issue_registry: registryArtifact,
    phase_start_approval: approvalInput
  });

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-phase-start-approval.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PHASE_START_APPROVAL_INPUT: inputPath,
      PHASE_START_APPROVAL_OUTPUT: outputPath,
      PHASE_START_APPROVAL_MARKDOWN_OUTPUT: markdownPath,
      PHASE_START_APPROVAL_FOLLOWUPS_OUTPUT: followUpsPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const result = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const followUps = readJson(followUpsPath);

  assertIncludes(markdown, "Phase Start Approval", "owner report");
  assertIncludes(result.ownerReadableReport, "Labels added: no", "label guardrail");
  assertIncludes(result.ownerReadableReport, "Codex build triggered: no", "Codex guardrail");
  if (result.approvalStatus === "approved_for_manual_phase_start") {
    assertEqual(followUps.followUpTasks.length, 0, "approved follow-up count");
  } else {
    assertEqual(followUps.followUpTasks.length, 1, "blocked follow-up count");
  }

  return result;
}

function registry() {
  return {
    kind: "published_phase_issue_registry",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "phase_issue_publisher_manual",
      candidateSlug: "church-care-follow-up",
      candidateType: "workflow_process_candidate",
      finalPacketType: "non_app_solution_plan",
      publishStatus: "manual_publish_completed"
    },
    sourcePacket: {
      kind: "non_app_solution_plan",
      status: "final_review_ready"
    },
    candidate: {
      name: "Church Care Follow Up",
      slug: "church-care-follow-up",
      type: "workflow_process_candidate",
      summary: "workflow process candidate for church care follow-up.",
      needAddressed: "timely care coordination",
      desiredTransformation: "people receive timely care and stay connected"
    },
    publishedIssues: [
      issue(101, "discovery", 1, "Discovery"),
      issue(102, "solution_design", 2, "Solution Design")
    ],
    phaseOrder: ["discovery", "solution_design"],
    issueLabels: ["ai:plan"],
    currentStatus: "published_tracking_only",
    nextSafeAction: "review_published_phase_issues",
    decision: {
      registryStatus: "published_phase_issues_tracked",
      githubIssuesCreatedByRegistry: false,
      labelsAddedByRegistry: false,
      codexBuildTriggered: false,
      ownerApprovalRequiredBeforeExecution: true,
      reason: "Completed manual publish output was recorded for tracking only."
    },
    ownerReadableReport: "Published Phase Issue Registry",
    guardrails: {
      registryOnly: true,
      noUi: true,
      noGithubIssuesCreated: true,
      noLabelsAdded: true,
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

function issue(issueNumber, phase, phaseOrder, title) {
  return {
    issueNumber,
    url: `https://github.com/lincolnnunnally/AppEngine/issues/${issueNumber}`,
    title: `[church-care-follow-up] ${title}`,
    phase,
    phaseOrder,
    labels: ["ai:plan"],
    sourceDryRunPayload: {
      sourceArtifact: "phase_issue_publisher_dry_run",
      sourceCandidateSlug: "church-care-follow-up",
      sourceFinalPacketType: "non_app_solution_plan",
      requestedLabels: ["ai:plan"],
      appliedLabels: ["ai:plan"],
      blockedLabels: []
    },
    sourcePacket: {
      kind: "non_app_solution_plan",
      status: "final_review_ready"
    },
    guardrails: {
      noCodexBuildTriggered: true,
      noProductionDeploy: true,
      noPaidResources: true,
      noMigrations: true
    },
    currentStatus: "published_tracking_only",
    nextSafeAction: "review_published_phase_issue"
  };
}

function startRequest({
  targetIssueNumber,
  targetPhase = "",
  completedPhases = [],
  notRequiredPhases = [],
  ownerApprovalNotes,
  acceptanceCriteriaPresent,
  status = "",
  riskReview = {
    noSecretsEnvRisk: true,
    noMigrationRisk: true,
    noProductionDeployRisk: true,
    noPaidResourceRisk: true
  }
}) {
  return {
    targetIssueNumber,
    targetPhase,
    completedPhases,
    notRequiredPhases,
    ownerApprovalNotes,
    acceptanceCriteriaPresent,
    status,
    riskReview
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
