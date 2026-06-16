import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-phase-issue-generation-"));

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/phase-issue-generation.md", [
    "phase_creation_approval",
    "phase_issue_generation",
    "phaseIssueDrafts",
    "githubIssuesCreated",
    "noAutomaticCodexBuildExecution"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/phase-issue-generation.md", "phase_issue_generation"]);
  assertFileIncludes("agents/context/output-contracts.md", ["phase_issue_generation"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["phase_issue_generation"]);
});

runStep("approved App Build Packet generates bounded app phase drafts", () => {
  const result = runGeneration("app-approved.json", phaseCreationApproval({
    finalPacketType: "app_build_packet",
    candidateType: "new_app_candidate",
    candidateName: "Church Care Follow Up"
  }));

  assertEqual(result.kind, "phase_issue_generation", "artifact kind");
  assertArrayIncludes(result.phaseOrder, "architecture", "architecture phase");
  assertArrayIncludes(result.phaseOrder, "provider_cost", "provider/cost phase");
  assertArrayIncludes(result.phaseOrder, "data_model", "data model phase");
  assertArrayIncludes(result.phaseOrder, "identity_auth", "identity/auth phase");
  assertArrayIncludes(result.phaseOrder, "ui_design", "ui design phase");
  assertArrayIncludes(result.phaseOrder, "build", "build phase");
  assertArrayIncludes(result.phaseOrder, "verification", "verification phase");
  assertArrayIncludes(result.phaseOrder, "release_gate", "release gate phase");
  assertArrayIncludes(result.labelsToApply, "ai:build", "build label listed for later");
  assertEqual(result.decision.githubIssuesCreated, false, "no GitHub issues created");
  assertEqual(result.decision.codexBuildTriggered, false, "no Codex build triggered");
  assertEqual(result.phaseIssueDrafts.find((draft) => draft.phase === "build").recommendedLabel, "ai:build", "primary build label");
});

runStep("approved vNext Packet generates bounded vNext phase drafts", () => {
  const result = runGeneration("vnext-approved.json", phaseCreationApproval({
    finalPacketType: "vnext_packet",
    candidateType: "existing_app_improvement",
    candidateName: "Spark Of Hope Intake Lite",
    candidateSlug: "spark-of-hope-intake-lite"
  }));

  assertArrayIncludes(result.phaseOrder, "context_refresh", "context refresh phase");
  assertArrayIncludes(result.phaseOrder, "scope", "scope phase");
  assertArrayIncludes(result.phaseOrder, "build", "vNext build phase");
  assertEqual(result.sourceFinalPacket.kind, "vnext_packet", "source final packet");
});

runStep("approved Non-App Solution Plan generates non-code phase drafts", () => {
  const result = runGeneration("non-app-approved.json", phaseCreationApproval({
    finalPacketType: "non_app_solution_plan",
    candidateType: "workflow_process_candidate",
    candidateName: "Care Follow Up Workflow"
  }));

  assertArrayIncludes(result.phaseOrder, "discovery", "discovery phase");
  assertArrayIncludes(result.phaseOrder, "solution_design", "solution design phase");
  assertArrayIncludes(result.phaseOrder, "workflow_process_design", "workflow/process phase");
  assertArrayIncludes(result.phaseOrder, "content_resource_plan", "content/resource phase");
  assertArrayIncludes(result.phaseOrder, "implementation_checklist", "implementation checklist phase");
  assertArrayIncludes(result.phaseOrder, "review_measurement", "review/measurement phase");
  assertEqual(result.labelsToApply.length, 1, "non-app labels stay planning-only");
  assertEqual(result.labelsToApply[0], "ai:plan", "non-app label");
});

runStep("non-approved statuses fail honestly", () => {
  for (const approvalStatus of ["needs_revision", "rejected", "blocked_by_security", "blocked_by_cost", "blocked_by_scope"]) {
    assertThrows(() => {
      runGeneration(`${approvalStatus}.json`, phaseCreationApproval({
        finalPacketType: "app_build_packet",
        approvalStatus
      }));
    }, `approvalStatus ${approvalStatus} is not approved_for_phase_creation`);
  }
});

runStep("missing approval fields fail honestly", () => {
  const approval = phaseCreationApproval({ finalPacketType: "app_build_packet" });
  delete approval.approvalChecks.costProviderSafety;

  assertThrows(() => {
    runGeneration("missing-approval-field.json", approval);
  }, "approvalChecks.costProviderSafety");
});

console.log(`phase-issue-generation smoke ok (${smokeRoot})`);

function runGeneration(name, approval) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-generation.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-generation.md"));
  const followUpsPath = path.join(smokeRoot, name.replace(".json", "-followups.json"));

  writeJson(inputPath, { phase_creation_approval: approval });

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-phase-issue-generation.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PHASE_ISSUE_GENERATION_INPUT: inputPath,
      PHASE_ISSUE_GENERATION_OUTPUT: outputPath,
      PHASE_ISSUE_GENERATION_MARKDOWN_OUTPUT: markdownPath,
      PHASE_ISSUE_GENERATION_FOLLOWUPS_OUTPUT: followUpsPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const result = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const followUps = readJson(followUpsPath);

  assertIncludes(markdown, "Phase Issue Generation", "markdown owner report");
  assertEqual(followUps.followUpTasks.length, result.phaseIssueDrafts.length, "follow-up draft count");
  assertEqual(followUps.followUpTasks[0].recommendedLabel, result.phaseIssueDrafts[0].recommendedLabel, "follow-up primary label");
  assertIncludes(result.phaseIssueDrafts[0].body, "## Required Source Of Truth To Load", "required source section");
  assertIncludes(result.phaseIssueDrafts[0].body, "source-of-truth/phase-issue-generation.md", "phase issue source file");
  assertIncludes(result.phaseIssueDrafts[0].body, "Do not trigger Codex build work automatically", "Codex trigger guardrail");

  return result;
}

function phaseCreationApproval({
  finalPacketType,
  candidateType = "new_app_candidate",
  candidateName = "Church Care Follow Up",
  candidateSlug = "",
  approvalStatus = "approved_for_phase_creation"
}) {
  const slug = candidateSlug || slugify(candidateName);
  const approved = approvalStatus === "approved_for_phase_creation";

  return {
    kind: "phase_creation_approval",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "final_packet_materialization",
      candidateSlug: slug,
      candidateType,
      finalPacketType
    },
    candidate: {
      name: candidateName,
      slug,
      type: candidateType,
      summary: `${candidateType.replace(/_/g, " ")} for church care follow-up.`,
      needAddressed: "timely care coordination",
      desiredTransformation: "people receive timely care and stay connected"
    },
    finalPacket: {
      kind: finalPacketType,
      status: "final_review_ready"
    },
    approvalStatus,
    approvalChecks: approvalChecks(approvalStatus),
    decision: {
      approvedForPhaseCreation: approved,
      nextSafeAction: approved ? "prepare_phase_issue_generation" : "create_final_packet_revision_issue",
      phaseIssuesCreated: false,
      codexBuildTriggered: false,
      ownerApprovalRequired: true,
      reason: approved ? "Phase creation approval passed." : "Phase creation approval did not pass."
    },
    ownerReadableReport: "Phase Creation Approval",
    followUpTasks: [],
    guardrails: {
      approvalGateOnly: true,
      noUi: true,
      noPhaseIssuesCreated: true,
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

function approvalChecks(approvalStatus) {
  const failingStatus = approvalStatus === "approved_for_phase_creation" ? "pass" : approvalStatus;

  return {
    finalPacketCompleteness: { status: failingStatus, notes: "Final packet has the required planning fields." },
    sourceOfTruthAlignment: { status: "pass", notes: "Source-of-truth files remain visible and aligned." },
    correctSolutionType: { status: "pass", notes: "Final packet type matches the solution candidate." },
    phaseSequenceReadiness: { status: "pass", notes: "Phase sequence is ready for draft generation." },
    costProviderSafety: { status: "pass", notes: "No paid provider action is authorized by this generator." },
    securityPrivacySafety: { status: "pass", notes: "No sensitive data or migration action is authorized by this generator." },
    ownerApprovalNotes: { status: "pass", notes: "Owner approval notes are recorded for phase issue draft generation." }
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
  if (!content.includes(expected)) throw new Error(`${label} missing ${expected}`);
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

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
