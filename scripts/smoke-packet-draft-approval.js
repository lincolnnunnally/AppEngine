import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-packet-draft-approval-"));

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/packet-draft-approval-gate.md", [
    "candidate_packet_bridge",
    "packet_draft_approval",
    "approved_for_final_packet",
    "needs_revision",
    "blocked_by_security",
    "noFinalPacketsCreated",
    "noCodexBuildTriggered"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/packet-draft-approval-gate.md", "packet_draft_approval"]);
  assertFileIncludes("agents/context/output-contracts.md", ["packet_draft_approval"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["packet_draft_approval"]);
});

runStep("app build packet draft can be approved without final packet creation", () => {
  const result = runApproval("app-approved.json", candidatePacketBridge({
    selectedDraftKind: "app_build_packet_draft",
    candidateType: "new_app_candidate",
    candidateName: "Church Care Follow Up"
  }), passApproval());

  assertEqual(result.kind, "packet_draft_approval", "approval artifact kind");
  assertEqual(result.approvalStatus, "approved_for_final_packet", "approval status");
  assertEqual(result.decision.finalPacketType, "app_build_packet", "final packet type");
  assertEqual(result.decision.readyForFinalPacket, true, "ready for final packet");
  assertEqual(result.decision.finalPacketCreated, false, "final packet not created");
  assertEqual(result.decision.phaseIssuesCreated, false, "phase issues not created");
  assertEqual(result.decision.codexBuildTriggered, false, "Codex build not triggered");
  assertEqual(result.guardrails.approvalGateOnly, true, "approval-only guardrail");
});

runStep("vNext packet draft can be approved without final packet creation", () => {
  const result = runApproval("vnext-approved.json", candidatePacketBridge({
    selectedDraftKind: "vnext_packet_draft",
    candidateType: "existing_app_improvement",
    candidateName: "Spark Of Hope Intake Lite",
    candidateSlug: "spark-of-hope-intake-lite"
  }), passApproval());

  assertEqual(result.approvalStatus, "approved_for_final_packet", "approval status");
  assertEqual(result.decision.finalPacketType, "vnext_packet", "final packet type");
});

runStep("non-app solution plan draft can be approved without final packet creation", () => {
  const result = runApproval("non-app-approved.json", candidatePacketBridge({
    selectedDraftKind: "non_app_solution_plan_draft",
    candidateType: "workflow_process_candidate",
    candidateName: "Care Follow Up Workflow"
  }), passApproval());

  assertEqual(result.approvalStatus, "approved_for_final_packet", "approval status");
  assertEqual(result.decision.finalPacketType, "non_app_solution_plan", "final packet type");
});

runStep("needs revision produces revision action", () => {
  const approval = passApproval();
  approval.approvalChecks.scopeRealism = { status: "needs_revision", notes: "Scope is still too broad for a reviewable packet." };

  const result = runApproval("needs-revision.json", candidatePacketBridge({ selectedDraftKind: "app_build_packet_draft" }), approval);

  assertEqual(result.approvalStatus, "needs_revision", "approval status");
  assertEqual(result.decision.readyForFinalPacket, false, "not ready for final packet");
  assertEqual(result.decision.nextSafeAction, "create_packet_draft_revision_issue", "revision action");
});

runStep("rejected and blocked statuses are represented honestly", () => {
  const statusExpectations = [
    ["rejected", "record_packet_draft_rejection"],
    ["blocked_by_security", "create_security_review_issue"],
    ["blocked_by_cost", "create_cost_review_issue"],
    ["blocked_by_scope", "create_scope_review_issue"]
  ];

  for (const [status, nextSafeAction] of statusExpectations) {
    const approval = passApproval();
    approval.approvalChecks.dataSecurityPrivacyReadiness = {
      status,
      notes: `${status} example for smoke coverage.`
    };

    const result = runApproval(`${status}.json`, candidatePacketBridge({ selectedDraftKind: "app_build_packet_draft" }), approval);
    assertEqual(result.approvalStatus, status, `${status} approval status`);
    assertEqual(result.decision.nextSafeAction, nextSafeAction, `${status} next action`);
    assertEqual(result.decision.finalPacketCreated, false, `${status} final packet guardrail`);
  }
});

runStep("missing approval fields fail honestly", () => {
  const approval = passApproval();
  delete approval.approvalChecks.providerCostReadiness;

  assertThrows(() => {
    runApproval("missing-approval-field.json", candidatePacketBridge({ selectedDraftKind: "app_build_packet_draft" }), approval);
  }, "approvalChecks.providerCostReadiness");
});

runStep("missing bridge fields fail honestly", () => {
  const bridge = candidatePacketBridge({ selectedDraftKind: "app_build_packet_draft" });
  delete bridge.selectedDraft.reason;

  assertThrows(() => {
    runApproval("missing-bridge-field.json", bridge, passApproval());
  }, "selectedDraft.reason");
});

console.log(`packet-draft-approval smoke ok (${smokeRoot})`);

function runApproval(name, bridge, approval) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-approval.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-approval.md"));
  const followUpsPath = path.join(smokeRoot, name.replace(".json", "-followups.json"));

  writeJson(inputPath, {
    candidate_packet_bridge: bridge,
    packet_draft_approval: approval
  });

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-packet-draft-approval.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PACKET_DRAFT_APPROVAL_INPUT: inputPath,
      PACKET_DRAFT_APPROVAL_OUTPUT: outputPath,
      PACKET_DRAFT_APPROVAL_MARKDOWN_OUTPUT: markdownPath,
      PACKET_DRAFT_APPROVAL_FOLLOWUPS_OUTPUT: followUpsPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const result = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const followUps = readJson(followUpsPath);

  assertIncludes(markdown, "Packet Draft Approval", "markdown owner report");
  assertEqual(followUps.followUpTasks.length, 1, "approval follow-up count");
  assertIncludes(followUps.followUpTasks[0].body, "source-of-truth/packet-draft-approval-gate.md", "follow-up source files");
  assertIncludes(followUps.followUpTasks[0].body, "Do not create final packets yet.", "final packet guardrail");

  return result;
}

function candidatePacketBridge({
  selectedDraftKind,
  candidateType = "new_app_candidate",
  candidateName = "Church Care Follow Up",
  candidateSlug = ""
}) {
  const slug = candidateSlug || slugify(candidateName);

  return {
    kind: "candidate_packet_bridge",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "solution_candidate_review",
      candidateSlug: slug,
      candidateType,
      readinessStatus: readinessStatusFor(selectedDraftKind)
    },
    candidate: {
      name: candidateName,
      slug,
      type: candidateType,
      summary: `${candidateType.replace(/_/g, " ")} for church care follow-up.`,
      needAddressed: "timely care coordination",
      desiredTransformation: "people receive timely care and stay connected"
    },
    selectedDraft: {
      kind: selectedDraftKind,
      reason: "Solution candidate review approved this packet draft type.",
      ownerApprovalRequired: true
    },
    packetDraft: packetDraftFor(selectedDraftKind, candidateName, slug),
    decision: {
      bridgeStatus: "draft_ready",
      nextSafeAction: "review_packet_draft",
      phaseIssuesCreated: false,
      codexBuildTriggered: false,
      ownerApprovalRequired: true,
      reason: "Approved solution candidate has been converted to a review-ready packet draft only."
    },
    ownerReadableReport: "Candidate To Packet Bridge",
    followUpTasks: [],
    guardrails: {
      planningPacketDraftOnly: true,
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

function packetDraftFor(kind, candidateName, slug) {
  if (kind === "app_build_packet_draft") {
    return {
      kind,
      schemaVersion: 1,
      status: "review_ready_draft",
      app: {
        name: candidateName,
        slug,
        purpose: "Help churches coordinate care follow-up.",
        needAddressed: "timely care coordination"
      },
      phaseIssuesCreated: false
    };
  }

  if (kind === "vnext_packet_draft") {
    return {
      kind,
      schemaVersion: 1,
      status: "review_ready_draft",
      app: {
        name: candidateName,
        slug,
        targetVersion: "vNext"
      },
      change: {
        summary: "Improve controlled preview persistence."
      },
      phaseIssuesCreated: false
    };
  }

  return {
    kind,
    schemaVersion: 1,
    status: "review_ready_draft",
    candidate: {
      name: candidateName,
      slug
    },
    plan: {
      summary: "Draft workflow/process plan for owner review."
    },
    phaseIssuesCreated: false
  };
}

function passApproval() {
  return {
    approvalChecks: {
      problemTransformationClarity: { status: "pass", notes: "Problem and desired transformation are clear." },
      correctPacketType: { status: "pass", notes: "Selected draft kind matches the approved solution candidate." },
      solutionShapeFit: { status: "pass", notes: "Solution shape fits the need without forcing an app too early." },
      audienceUserClarity: { status: "pass", notes: "Audience and users are specific enough for the next packet step." },
      dataSecurityPrivacyReadiness: { status: "pass", notes: "No sensitive data path or secret is authorized by this gate." },
      providerCostReadiness: { status: "pass", notes: "No paid provider action is authorized by this gate." },
      scopeRealism: { status: "pass", notes: "Scope is bounded and reviewable." },
      reviewability: { status: "pass", notes: "The owner can review what will become a final packet." },
      ownerApprovalNotes: { status: "pass", notes: "Owner approval remains required before final packet creation." }
    }
  };
}

function readinessStatusFor(selectedDraftKind) {
  const statuses = {
    app_build_packet_draft: "ready_for_app_build_packet",
    vnext_packet_draft: "ready_for_vnext_packet",
    non_app_solution_plan_draft: "ready_for_non_app_solution_plan"
  };

  return statuses[selectedDraftKind] || "ready_for_app_build_packet";
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
