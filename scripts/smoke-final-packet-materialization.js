import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPriorWorkCheck, buildNewExampleRequest, selfExtendExampleRequest } from "./lib/prior-work-check.js";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-final-packet-materialization-"));
const buildNewVerdict = runPriorWorkCheck(buildNewExampleRequest());
const extendExistingVerdict = runPriorWorkCheck(selfExtendExampleRequest());

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/final-packet-materialization.md", [
    "packet_draft_approval",
    "final_packet_materialization",
    "app_build_packet",
    "vnext_packet",
    "non_app_solution_plan",
    "request_phase_creation_approval",
    "noPhaseIssuesCreated",
    "noCodexBuildTriggered"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/final-packet-materialization.md", "final_packet_materialization"]);
  assertFileIncludes("agents/context/output-contracts.md", ["final_packet_materialization"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["final_packet_materialization"]);
});

runStep("approved app build packet draft materializes final App Build Packet", () => {
  const result = runMaterialization("app-approved.json", packetDraftApproval({
    draftKind: "app_build_packet_draft",
    finalPacketType: "app_build_packet",
    candidateType: "new_app_candidate",
    candidateName: "Church Care Follow Up"
  }), buildNewVerdict);

  assertEqual(result.kind, "final_packet_materialization", "artifact kind");
  assertEqual(result.finalPacketType, "app_build_packet", "final packet type");
  assertEqual(result.finalPacket.kind, "app_build_packet", "final packet kind");
  assertEqual(result.finalPacket.status, "final_review_ready", "final packet status");
  assertEqual(result.decision.finalPacketCreated, true, "final packet created");
  assertEqual(result.decision.phaseIssuesCreated, false, "phase issues not created");
  assertEqual(result.decision.codexBuildTriggered, false, "Codex build not triggered");
  assertEqual(result.decision.nextSafeAction, "request_phase_creation_approval", "next safe action");
  assertEqual(result.guardrails.finalPacketCreationOnly, true, "final packet only guardrail");
});

runStep("approved vNext packet draft materializes final vNext Packet", () => {
  const result = runMaterialization("vnext-approved.json", packetDraftApproval({
    draftKind: "vnext_packet_draft",
    finalPacketType: "vnext_packet",
    candidateType: "existing_app_improvement",
    candidateName: "Spark Of Hope Intake Lite",
    candidateSlug: "spark-of-hope-intake-lite"
  }), extendExistingVerdict);

  assertEqual(result.finalPacketType, "vnext_packet", "final packet type");
  assertEqual(result.finalPacket.kind, "vnext_packet", "final packet kind");
  assertArrayIncludes(result.finalPacket.requiredContextBeforePhaseCreation, "release history", "release history still required before phase creation");
});

runStep("approved non-app solution plan draft materializes final Non-App Solution Plan", () => {
  const result = runMaterialization("non-app-approved.json", packetDraftApproval({
    draftKind: "non_app_solution_plan_draft",
    finalPacketType: "non_app_solution_plan",
    candidateType: "workflow_process_candidate",
    candidateName: "Care Follow Up Workflow"
  }));

  assertEqual(result.finalPacketType, "non_app_solution_plan", "final packet type");
  assertEqual(result.finalPacket.kind, "non_app_solution_plan", "final packet kind");
  assertEqual(result.finalPacket.plan.reviewPath.includes("phase creation approval"), true, "phase creation still gated");
});

runStep("app build packet materialization is blocked without a prior-work verdict", () => {
  assertThrows(() => {
    runMaterialization("app-no-verdict.json", packetDraftApproval({
      draftKind: "app_build_packet_draft",
      finalPacketType: "app_build_packet",
      candidateType: "new_app_candidate",
      candidateName: "Church Care Follow Up"
    }));
  }, "passing Prior-Work Check verdict is required");
});

runStep("non-approved statuses fail honestly", () => {
  for (const approvalStatus of ["needs_revision", "rejected", "blocked_by_security", "blocked_by_cost", "blocked_by_scope"]) {
    assertThrows(() => {
      runMaterialization(`${approvalStatus}.json`, packetDraftApproval({
        draftKind: "app_build_packet_draft",
        finalPacketType: "app_build_packet",
        approvalStatus
      }));
    }, `approvalStatus ${approvalStatus} is not approved_for_final_packet`);
  }
});

runStep("missing approval fields fail honestly", () => {
  const approval = packetDraftApproval({
    draftKind: "app_build_packet_draft",
    finalPacketType: "app_build_packet"
  });
  delete approval.approvalChecks.providerCostReadiness;

  assertThrows(() => {
    runMaterialization("missing-approval-field.json", approval);
  }, "approvalChecks.providerCostReadiness");
});

console.log(`final-packet-materialization smoke ok (${smokeRoot})`);

function runMaterialization(name, approval, priorWorkVerdict) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-materialization.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-materialization.md"));
  const followUpsPath = path.join(smokeRoot, name.replace(".json", "-followups.json"));

  if (priorWorkVerdict) approval.priorWorkCheck = priorWorkVerdict;
  writeJson(inputPath, { packet_draft_approval: approval });

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-final-packet-materialization.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FINAL_PACKET_MATERIALIZATION_INPUT: inputPath,
      FINAL_PACKET_MATERIALIZATION_OUTPUT: outputPath,
      FINAL_PACKET_MATERIALIZATION_MARKDOWN_OUTPUT: markdownPath,
      FINAL_PACKET_MATERIALIZATION_FOLLOWUPS_OUTPUT: followUpsPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const result = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const followUps = readJson(followUpsPath);

  assertIncludes(markdown, "Final Packet Materialization", "markdown owner report");
  assertEqual(followUps.followUpTasks.length, 1, "materialization follow-up count");
  assertIncludes(followUps.followUpTasks[0].body, "source-of-truth/final-packet-materialization.md", "follow-up source files");
  assertIncludes(followUps.followUpTasks[0].body, "Do not create phase issues yet.", "phase issue guardrail");

  return result;
}

function packetDraftApproval({
  draftKind,
  finalPacketType,
  candidateType = "new_app_candidate",
  candidateName = "Church Care Follow Up",
  candidateSlug = "",
  approvalStatus = "approved_for_final_packet"
}) {
  const slug = candidateSlug || slugify(candidateName);
  const approved = approvalStatus === "approved_for_final_packet";

  return {
    kind: "packet_draft_approval",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "candidate_packet_bridge",
      candidateSlug: slug,
      candidateType,
      selectedDraftKind: draftKind
    },
    candidate: {
      name: candidateName,
      slug,
      type: candidateType,
      summary: `${candidateType.replace(/_/g, " ")} for church care follow-up.`,
      needAddressed: "timely care coordination",
      desiredTransformation: "people receive timely care and stay connected"
    },
    packetDraft: {
      kind: draftKind,
      status: "review_ready_draft",
      summary: `${draftKind.replace(/_/g, " ")} ready for final packet materialization.`
    },
    approvalStatus,
    approvalChecks: approvalChecks(approvalStatus),
    decision: {
      readyForFinalPacket: approved,
      finalPacketType: approved ? finalPacketType : null,
      nextSafeAction: approved ? "prepare_final_packet_request" : "create_packet_draft_revision_issue",
      finalPacketCreated: false,
      phaseIssuesCreated: false,
      codexBuildTriggered: false,
      ownerApprovalRequired: true,
      reason: approved ? "Packet draft approval passed." : "Packet draft approval did not pass."
    },
    ownerReadableReport: "Packet Draft Approval",
    followUpTasks: [],
    guardrails: {
      approvalGateOnly: true,
      noUi: true,
      noFinalPacketsCreated: true,
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
  const failingStatus = approvalStatus === "approved_for_final_packet" ? "pass" : approvalStatus;

  return {
    problemTransformationClarity: { status: failingStatus, notes: "Problem and transformation clarity checked." },
    correctPacketType: { status: "pass", notes: "Packet type matches the approved draft." },
    solutionShapeFit: { status: "pass", notes: "Solution shape fits the candidate." },
    audienceUserClarity: { status: "pass", notes: "Audience and user are clear enough." },
    dataSecurityPrivacyReadiness: { status: "pass", notes: "No sensitive data path is authorized." },
    providerCostReadiness: { status: "pass", notes: "No paid provider action is authorized." },
    scopeRealism: { status: "pass", notes: "Scope remains bounded." },
    reviewability: { status: "pass", notes: "Packet is owner-reviewable." },
    ownerApprovalNotes: { status: "pass", notes: "Owner approval remains required before phase creation." }
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
