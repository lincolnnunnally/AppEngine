import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-phase-creation-approval-"));

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/phase-creation-approval-gate.md", [
    "final_packet_materialization",
    "phase_creation_approval",
    "approved_for_phase_creation",
    "needs_revision",
    "blocked_by_security",
    "noPhaseIssuesCreated",
    "noCodexBuildTriggered"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/phase-creation-approval-gate.md", "phase_creation_approval"]);
  assertFileIncludes("agents/context/output-contracts.md", ["phase_creation_approval"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["phase_creation_approval"]);
});

runStep("final App Build Packet can be approved without phase issue creation", () => {
  const result = runApproval("app-approved.json", finalPacketMaterialization({
    finalPacketType: "app_build_packet",
    candidateType: "new_app_candidate",
    candidateName: "Church Care Follow Up"
  }), passApproval());

  assertEqual(result.kind, "phase_creation_approval", "approval artifact kind");
  assertEqual(result.approvalStatus, "approved_for_phase_creation", "approval status");
  assertEqual(result.decision.approvedForPhaseCreation, true, "approved for phase creation");
  assertEqual(result.decision.phaseIssuesCreated, false, "phase issues not created");
  assertEqual(result.decision.codexBuildTriggered, false, "Codex build not triggered");
  assertEqual(result.decision.nextSafeAction, "prepare_phase_issue_generation", "next safe action");
  assertEqual(result.guardrails.approvalGateOnly, true, "approval-only guardrail");
});

runStep("final vNext Packet can be approved without phase issue creation", () => {
  const result = runApproval("vnext-approved.json", finalPacketMaterialization({
    finalPacketType: "vnext_packet",
    candidateType: "existing_app_improvement",
    candidateName: "Spark Of Hope Intake Lite",
    candidateSlug: "spark-of-hope-intake-lite"
  }), passApproval());

  assertEqual(result.approvalStatus, "approved_for_phase_creation", "approval status");
  assertEqual(result.finalPacket.kind, "vnext_packet", "final packet kind");
});

runStep("final Non-App Solution Plan can be approved without phase issue creation", () => {
  const result = runApproval("non-app-approved.json", finalPacketMaterialization({
    finalPacketType: "non_app_solution_plan",
    candidateType: "workflow_process_candidate",
    candidateName: "Care Follow Up Workflow"
  }), passApproval());

  assertEqual(result.approvalStatus, "approved_for_phase_creation", "approval status");
  assertEqual(result.finalPacket.kind, "non_app_solution_plan", "final packet kind");
});

runStep("needs revision produces revision action", () => {
  const approval = passApproval();
  approval.approvalChecks.phaseSequenceReadiness = { status: "needs_revision", notes: "Phase sequence needs one more planning pass." };

  const result = runApproval("needs-revision.json", finalPacketMaterialization({ finalPacketType: "app_build_packet" }), approval);

  assertEqual(result.approvalStatus, "needs_revision", "approval status");
  assertEqual(result.decision.approvedForPhaseCreation, false, "not approved for phase creation");
  assertEqual(result.decision.nextSafeAction, "create_final_packet_revision_issue", "revision action");
});

runStep("rejected and blocked statuses are represented honestly", () => {
  const statusExpectations = [
    ["rejected", "record_phase_creation_rejection"],
    ["blocked_by_security", "create_security_review_issue"],
    ["blocked_by_cost", "create_cost_review_issue"],
    ["blocked_by_scope", "create_scope_review_issue"]
  ];

  for (const [status, nextSafeAction] of statusExpectations) {
    const approval = passApproval();
    approval.approvalChecks.securityPrivacySafety = {
      status,
      notes: `${status} example for smoke coverage.`
    };

    const result = runApproval(`${status}.json`, finalPacketMaterialization({ finalPacketType: "app_build_packet" }), approval);
    assertEqual(result.approvalStatus, status, `${status} approval status`);
    assertEqual(result.decision.nextSafeAction, nextSafeAction, `${status} next action`);
    assertEqual(result.decision.phaseIssuesCreated, false, `${status} phase issue guardrail`);
  }
});

runStep("missing approval fields fail honestly", () => {
  const approval = passApproval();
  delete approval.approvalChecks.costProviderSafety;

  assertThrows(() => {
    runApproval("missing-approval-field.json", finalPacketMaterialization({ finalPacketType: "app_build_packet" }), approval);
  }, "approvalChecks.costProviderSafety");
});

runStep("missing materialization fields fail honestly", () => {
  const materialization = finalPacketMaterialization({ finalPacketType: "app_build_packet" });
  delete materialization.finalPacket.status;

  assertThrows(() => {
    runApproval("missing-materialization-field.json", materialization, passApproval());
  }, "finalPacket.status");
});

console.log(`phase-creation-approval smoke ok (${smokeRoot})`);

function runApproval(name, materialization, approval) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-approval.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-approval.md"));
  const followUpsPath = path.join(smokeRoot, name.replace(".json", "-followups.json"));

  writeJson(inputPath, {
    final_packet_materialization: materialization,
    phase_creation_approval: approval
  });

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-phase-creation-approval.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PHASE_CREATION_APPROVAL_INPUT: inputPath,
      PHASE_CREATION_APPROVAL_OUTPUT: outputPath,
      PHASE_CREATION_APPROVAL_MARKDOWN_OUTPUT: markdownPath,
      PHASE_CREATION_APPROVAL_FOLLOWUPS_OUTPUT: followUpsPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const result = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const followUps = readJson(followUpsPath);

  assertIncludes(markdown, "Phase Creation Approval", "markdown owner report");
  assertEqual(followUps.followUpTasks.length, 1, "approval follow-up count");
  assertIncludes(followUps.followUpTasks[0].body, "source-of-truth/phase-creation-approval-gate.md", "follow-up source files");
  assertIncludes(followUps.followUpTasks[0].body, "Do not create phase issues yet.", "phase issue guardrail");

  return result;
}

function finalPacketMaterialization({
  finalPacketType,
  candidateType = "new_app_candidate",
  candidateName = "Church Care Follow Up",
  candidateSlug = ""
}) {
  const slug = candidateSlug || slugify(candidateName);

  return {
    kind: "final_packet_materialization",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "packet_draft_approval",
      candidateSlug: slug,
      candidateType,
      approvalStatus: "approved_for_final_packet",
      approvedDraftKind: draftKindFor(finalPacketType)
    },
    candidate: {
      name: candidateName,
      slug,
      type: candidateType,
      summary: `${candidateType.replace(/_/g, " ")} for church care follow-up.`,
      needAddressed: "timely care coordination",
      desiredTransformation: "people receive timely care and stay connected"
    },
    finalPacketType,
    finalPacket: finalPacketFor(finalPacketType, candidateName, slug),
    decision: {
      materializationStatus: "final_packet_ready",
      nextSafeAction: "request_phase_creation_approval",
      finalPacketCreated: true,
      phaseIssuesCreated: false,
      codexBuildTriggered: false,
      ownerApprovalRequired: true,
      reason: "Final packet materialized from an approved packet draft."
    },
    ownerReadableReport: "Final Packet Materialization",
    followUpTasks: [],
    guardrails: {
      finalPacketCreationOnly: true,
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

function finalPacketFor(finalPacketType, candidateName, slug) {
  if (finalPacketType === "app_build_packet") {
    return {
      kind: "app_build_packet",
      schemaVersion: 1,
      status: "final_review_ready",
      app: {
        name: candidateName,
        slug,
        purpose: "Help churches coordinate care follow-up.",
        mvpStages: ["discovery", "charter", "architecture", "mvp_build", "review"]
      },
      phases: ["discovery", "charter", "architecture", "mvp_build", "review"],
      phaseIssuesCreated: false
    };
  }

  if (finalPacketType === "vnext_packet") {
    return {
      kind: "vnext_packet",
      schemaVersion: 1,
      status: "final_review_ready",
      app: {
        name: candidateName,
        slug,
        targetVersion: "vNext"
      },
      phases: ["context_refresh", "scope", "design_review", "implementation_plan", "review"],
      phaseIssuesCreated: false
    };
  }

  return {
    kind: "non_app_solution_plan",
    schemaVersion: 1,
    status: "final_review_ready",
    plan: {
      name: candidateName,
      slug,
      reviewPath: ["owner review", "phase creation approval", "non-app plan execution issue"]
    },
    phaseIssuesCreated: false
  };
}

function passApproval() {
  return {
    approvalChecks: {
      finalPacketCompleteness: { status: "pass", notes: "Final packet has the required planning fields." },
      sourceOfTruthAlignment: { status: "pass", notes: "Source-of-truth files remain visible and aligned." },
      correctSolutionType: { status: "pass", notes: "Final packet type matches the solution candidate." },
      phaseSequenceReadiness: { status: "pass", notes: "Phase sequence is ready for a later generator." },
      costProviderSafety: { status: "pass", notes: "No paid provider action is authorized by this gate." },
      securityPrivacySafety: { status: "pass", notes: "No sensitive data or migration action is authorized by this gate." },
      ownerApprovalNotes: { status: "pass", notes: "Owner approval notes are recorded for phase creation." }
    }
  };
}

function draftKindFor(finalPacketType) {
  const kinds = {
    app_build_packet: "app_build_packet_draft",
    vnext_packet: "vnext_packet_draft",
    non_app_solution_plan: "non_app_solution_plan_draft"
  };

  return kinds[finalPacketType] || "app_build_packet_draft";
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
