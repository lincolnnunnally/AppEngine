import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-execution-label-dry-run-"));

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/execution-label-dry-run.md", [
    "phase_start_approval",
    "execution_label_dry_run",
    "label_changes_ready_for_owner_review",
    "noLabelChanges"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/execution-label-dry-run.md", "execution_label_dry_run"]);
  assertFileIncludes("agents/context/output-contracts.md", ["execution_label_dry_run"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["execution_label_dry_run"]);
});

runStep("approved phase start previews default execution label without applying it", () => {
  const result = runDryRun("default-build-label.json", phaseStartApproval());

  assertEqual(result.kind, "execution_label_dry_run", "artifact kind");
  assertEqual(result.sourceArtifact.kind, "phase_start_approval", "source kind");
  assertArrayIncludes(result.currentLabels, "ai:plan", "current label");
  assertArrayIncludes(result.requestedLabels, "ai:build", "requested label");
  assertArrayIncludes(result.proposedLabels, "ai:build", "proposed label");
  assertArrayIncludes(result.labelsToAdd, "ai:build", "label to add");
  assertEqual(result.labelsExplicitlyBlocked.length, 0, "blocked labels");
  assertEqual(result.decision.labelsApplied, false, "labels not applied");
  assertEqual(result.decision.codexBuildTriggered, false, "Codex not triggered");
  assertEqual(result.decision.nextSafeAction, "review_execution_label_dry_run", "next action");
});

runStep("blocked labels are reported explicitly", () => {
  const result = runDryRun("blocked-label.json", phaseStartApproval(), {
    requestedLabels: ["ai:build", "ai:fix", "unsupported:label"]
  });

  assertArrayIncludes(result.labelsToAdd, "ai:build", "safe label to add");
  assertArrayIncludes(result.labelsExplicitlyBlocked, "ai:fix", "blocked fix label");
  assertArrayIncludes(result.labelsExplicitlyBlocked, "unsupported:label", "blocked unsupported label");
  assertEqual(result.decision.labelsApplied, false, "labels not applied");
});

runStep("existing execution label is not duplicated", () => {
  const approval = phaseStartApproval();
  approval.targetIssue.labels = ["ai:plan", "ai:build"];
  const result = runDryRun("existing-label.json", approval);

  assertEqual(result.labelsToAdd.length, 0, "nothing to add");
  assertArrayIncludes(result.labelsAlreadyPresent, "ai:build", "already present label");
});

runStep("non-approved phase start fails honestly", () => {
  const approval = phaseStartApproval();
  approval.approvalStatus = "needs_revision";
  approval.decision.approvedForManualPhaseStart = false;

  assertThrows(() => {
    runDryRun("not-approved.json", approval);
  }, "approved_for_manual_phase_start");
});

runStep("missing target URL fails honestly", () => {
  const approval = phaseStartApproval();
  approval.targetIssue.url = "";

  assertThrows(() => {
    runDryRun("missing-url.json", approval);
  }, "targetIssue.url");
});

runStep("non-pass approval check fails honestly", () => {
  const approval = phaseStartApproval();
  approval.approvalChecks.riskSafety.status = "blocked_by_cost";

  assertThrows(() => {
    runDryRun("non-pass-check.json", approval);
  }, "approvalChecks.riskSafety.pass");
});

console.log(`execution-label-dry-run smoke ok (${smokeRoot})`);

function runDryRun(name, approval, request = {}) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-dry-run.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-dry-run.md"));
  const labelsPath = path.join(smokeRoot, name.replace(".json", "-labels.json"));

  writeJson(inputPath, {
    phase_start_approval: approval,
    execution_label_dry_run: request
  });

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-execution-label-dry-run.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      EXECUTION_LABEL_DRY_RUN_INPUT: inputPath,
      EXECUTION_LABEL_DRY_RUN_OUTPUT: outputPath,
      EXECUTION_LABEL_DRY_RUN_MARKDOWN_OUTPUT: markdownPath,
      EXECUTION_LABEL_DRY_RUN_LABELS_OUTPUT: labelsPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const result = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const labels = readJson(labelsPath);

  assertIncludes(markdown, "Execution Label Dry Run", "owner report");
  assertIncludes(result.ownerReadableReport, "Labels applied: no", "label guardrail");
  assertIncludes(result.ownerReadableReport, "Codex build triggered: no", "Codex guardrail");
  assertEqual(labels.proposedLabels.length, result.proposedLabels.length, "labels output count");

  return result;
}

function phaseStartApproval() {
  return {
    kind: "phase_start_approval",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "published_phase_issue_registry",
      candidateSlug: "church-care-follow-up",
      candidateType: "workflow_process_candidate",
      finalPacketType: "non_app_solution_plan",
      registryStatus: "published_tracking_only"
    },
    candidate: {
      name: "Church Care Follow Up",
      slug: "church-care-follow-up",
      type: "workflow_process_candidate",
      summary: "workflow process candidate for church care follow-up.",
      needAddressed: "timely care coordination",
      desiredTransformation: "people receive timely care and stay connected"
    },
    sourcePacket: {
      kind: "non_app_solution_plan",
      status: "final_review_ready"
    },
    targetIssue: {
      issueNumber: 101,
      url: "https://github.com/lincolnnunnally/AppEngine/issues/101",
      title: "[church-care-follow-up] Discovery",
      phase: "discovery",
      phaseOrder: 1,
      labels: ["ai:plan"]
    },
    approvalStatus: "approved_for_manual_phase_start",
    approvalChecks: passChecks(),
    phaseOrder: ["discovery", "solution_design"],
    completedPhases: [],
    notRequiredPhases: [],
    ownerApprovalNotes: "Owner approved manual phase start.",
    decision: {
      approvedForManualPhaseStart: true,
      nextSafeAction: "await_manual_execution_label",
      labelsAdded: false,
      executionLabelsApproved: false,
      codexBuildTriggered: false,
      ownerApprovalRequiredForLabeling: true,
      reason: "Issue #101 may receive a manual execution label later after owner action."
    },
    ownerReadableReport: "Phase Start Approval",
    followUpTasks: [],
    guardrails: {
      approvalGateOnly: true,
      noLabelChanges: true,
      noExecutionLabelsAdded: true,
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

function passChecks() {
  const checks = {};
  for (const factor of [
    "issueExistsInRegistry",
    "phaseOrderRespected",
    "previousRequiredPhasesComplete",
    "guardrailsPresent",
    "acceptanceCriteriaPresent",
    "riskSafety",
    "ownerApprovalNotesPresent"
  ]) {
    checks[factor] = {
      status: "pass",
      notes: `${factor} passed.`
    };
  }
  return checks;
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

function assertArrayIncludes(array, expected, label) {
  if (!Array.isArray(array) || !array.includes(expected)) throw new Error(`${label} missing ${expected}`);
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
