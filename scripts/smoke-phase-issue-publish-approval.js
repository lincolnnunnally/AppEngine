import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-phase-issue-publish-approval-"));

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/phase-issue-publish-approval-gate.md", [
    "phase_issue_generation",
    "phase_issue_publish_approval",
    "approved_for_issue_publish",
    "needs_revision",
    "blocked_by_security",
    "noGithubIssuesCreated",
    "noCodexBuildTriggered"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/phase-issue-publish-approval-gate.md", "phase_issue_publish_approval"]);
  assertFileIncludes("agents/context/output-contracts.md", ["phase_issue_publish_approval"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["phase_issue_publish_approval"]);
});

runStep("approved App Build Packet drafts can pass without issue publication", () => {
  const result = runApproval("app-approved.json", phaseIssueGeneration({
    finalPacketType: "app_build_packet",
    candidateType: "new_app_candidate",
    candidateName: "Church Care Follow Up",
    phases: [
      phaseDraft("architecture", 1, "Architecture", ["ai:plan"]),
      phaseDraft("build", 2, "MVP Build", ["ai:build"])
    ]
  }));

  assertEqual(result.kind, "phase_issue_publish_approval", "approval artifact kind");
  assertEqual(result.approvalStatus, "approved_for_issue_publish", "approval status");
  assertEqual(result.decision.approvedForIssuePublish, true, "approved for issue publish");
  assertEqual(result.decision.githubIssuesPublished, false, "GitHub issues not published");
  assertEqual(result.decision.codexBuildTriggered, false, "Codex build not triggered");
  assertEqual(result.decision.codexTriggerLabelsApproved, false, "trigger labels not approved");
  assertEqual(result.decision.nextSafeAction, "prepare_phase_issue_publish", "next safe action");
});

runStep("approved vNext Packet drafts can pass without issue publication", () => {
  const result = runApproval("vnext-approved.json", phaseIssueGeneration({
    finalPacketType: "vnext_packet",
    candidateType: "existing_app_improvement",
    candidateName: "Spark Of Hope Intake Lite",
    candidateSlug: "spark-of-hope-intake-lite",
    phases: [
      phaseDraft("context_refresh", 1, "Context Refresh", ["ai:plan"]),
      phaseDraft("verification", 2, "vNext Verification", ["ai:review"])
    ]
  }));

  assertEqual(result.approvalStatus, "approved_for_issue_publish", "approval status");
  assertEqual(result.sourceFinalPacket.kind, "vnext_packet", "source final packet");
});

runStep("approved Non-App Solution Plan drafts can pass without issue publication", () => {
  const result = runApproval("non-app-approved.json", phaseIssueGeneration({
    finalPacketType: "non_app_solution_plan",
    candidateType: "workflow_process_candidate",
    candidateName: "Care Follow Up Workflow",
    phases: [
      phaseDraft("discovery", 1, "Discovery", ["ai:plan"]),
      phaseDraft("solution_design", 2, "Solution Design", ["ai:plan"])
    ]
  }));

  assertEqual(result.approvalStatus, "approved_for_issue_publish", "approval status");
  assertEqual(result.sourceFinalPacket.kind, "non_app_solution_plan", "source final packet");
});

runStep("missing draft fields produce needs revision", () => {
  const generation = phaseIssueGeneration({
    finalPacketType: "app_build_packet",
    phases: [phaseDraft("architecture", 1, "Architecture", ["ai:plan"])]
  });
  generation.phaseIssueDrafts[0].body = generation.phaseIssueDrafts[0].body.replace("## Acceptance Criteria", "## Acceptance Notes");

  const result = runApproval("needs-revision.json", generation);

  assertEqual(result.approvalStatus, "needs_revision", "approval status");
  assertEqual(result.decision.approvedForIssuePublish, false, "not approved");
  assertIncludes(result.approvalChecks.acceptanceCriteriaCompleteness.notes, "Acceptance Criteria", "missing acceptance criteria note");
});

runStep("unsafe secret content blocks publication", () => {
  const generation = phaseIssueGeneration({
    finalPacketType: "app_build_packet",
    phases: [phaseDraft("architecture", 1, "Architecture", ["ai:plan"])]
  });
  generation.phaseIssueDrafts[0].body += "\nOPENAI_API_KEY=sk-not-real";

  const result = runApproval("blocked-secret.json", generation);

  assertEqual(result.approvalStatus, "blocked_by_security", "security block");
  assertEqual(result.decision.githubIssuesPublished, false, "issue publish guardrail");
});

runStep("unsafe paid resource content blocks publication", () => {
  const generation = phaseIssueGeneration({
    finalPacketType: "app_build_packet",
    phases: [phaseDraft("provider_cost", 1, "Provider/Cost", ["ai:plan"])]
  });
  generation.phaseIssueDrafts[0].body += "\nCreate paid resource immediately.";

  const result = runApproval("blocked-cost.json", generation);

  assertEqual(result.approvalStatus, "blocked_by_cost", "cost block");
});

runStep("rejected and blocked statuses are represented honestly", () => {
  const statusExpectations = [
    ["rejected", "record_phase_issue_publish_rejection"],
    ["blocked_by_security", "create_security_review_issue"],
    ["blocked_by_cost", "create_cost_review_issue"],
    ["blocked_by_scope", "create_scope_review_issue"]
  ];

  for (const [status, nextSafeAction] of statusExpectations) {
    const approval = passApproval();
    approval.approvalChecks.boundedReviewability = {
      status,
      notes: `${status} example for smoke coverage.`
    };

    const result = runApproval(`${status}.json`, phaseIssueGeneration({
      finalPacketType: "app_build_packet",
      phases: [phaseDraft("architecture", 1, "Architecture", ["ai:plan"])]
    }), approval);

    assertEqual(result.approvalStatus, status, `${status} approval status`);
    assertEqual(result.decision.nextSafeAction, nextSafeAction, `${status} next action`);
    assertEqual(result.decision.githubIssuesPublished, false, `${status} issue publish guardrail`);
  }
});

runStep("missing generation fields fail honestly", () => {
  const generation = phaseIssueGeneration({
    finalPacketType: "app_build_packet",
    phases: [phaseDraft("architecture", 1, "Architecture", ["ai:plan"])]
  });
  delete generation.sourceFinalPacket.status;

  assertThrows(() => {
    runApproval("missing-generation-field.json", generation);
  }, "sourceFinalPacket.status");
});

console.log(`phase-issue-publish-approval smoke ok (${smokeRoot})`);

function runApproval(name, generation, approval = {}) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-approval.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-approval.md"));
  const followUpsPath = path.join(smokeRoot, name.replace(".json", "-followups.json"));

  writeJson(inputPath, {
    phase_issue_generation: generation,
    phase_issue_publish_approval: approval
  });

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-phase-issue-publish-approval.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PHASE_ISSUE_PUBLISH_APPROVAL_INPUT: inputPath,
      PHASE_ISSUE_PUBLISH_APPROVAL_OUTPUT: outputPath,
      PHASE_ISSUE_PUBLISH_APPROVAL_MARKDOWN_OUTPUT: markdownPath,
      PHASE_ISSUE_PUBLISH_APPROVAL_FOLLOWUPS_OUTPUT: followUpsPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const result = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const followUps = readJson(followUpsPath);

  assertIncludes(markdown, "Phase Issue Publish Approval", "markdown owner report");
  assertEqual(followUps.followUpTasks.length, 1, "approval follow-up count");
  assertIncludes(followUps.followUpTasks[0].body, "source-of-truth/phase-issue-publish-approval-gate.md", "follow-up source files");
  assertIncludes(followUps.followUpTasks[0].body, "Do not create GitHub issues yet.", "issue publish guardrail");

  return result;
}

function phaseIssueGeneration({
  finalPacketType,
  candidateType = "new_app_candidate",
  candidateName = "Church Care Follow Up",
  candidateSlug = "",
  phases
}) {
  const slug = candidateSlug || slugify(candidateName);
  const phaseIssueDrafts = phases.map((phase) => ({
    ...phase,
    title: `[${slug}] ${phase.title}`
  }));

  return {
    kind: "phase_issue_generation",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "phase_creation_approval",
      candidateSlug: slug,
      candidateType,
      finalPacketType,
      approvalStatus: "approved_for_phase_creation"
    },
    candidate: {
      name: candidateName,
      slug,
      type: candidateType,
      summary: `${candidateType.replace(/_/g, " ")} for church care follow-up.`,
      needAddressed: "timely care coordination",
      desiredTransformation: "people receive timely care and stay connected"
    },
    sourceFinalPacket: {
      kind: finalPacketType,
      status: "final_review_ready"
    },
    phaseOrder: phaseIssueDrafts.map((draft) => draft.phase),
    labelsToApply: [...new Set(phaseIssueDrafts.flatMap((draft) => draft.recommendedLabels))],
    phaseIssueDrafts,
    decision: {
      generationStatus: "phase_issue_drafts_ready",
      nextSafeAction: "review_phase_issue_drafts",
      phaseIssueDraftsGenerated: true,
      githubIssuesCreated: false,
      codexBuildTriggered: false,
      ownerApprovalRequired: true,
      reason: "Approved final packet was converted into bounded phase issue drafts only."
    },
    ownerReadableReport: "Phase Issue Generation",
    guardrails: {
      phaseIssueDraftGenerationOnly: true,
      noUi: true,
      noGithubIssuesCreated: true,
      noAutomaticCodexBuildExecution: true,
      noProductionDeploy: true,
      noPaidResources: true,
      noMigrations: true,
      noSecretsOrEnvChanges: true,
      repositoryVisibilityUnchanged: true,
      noGeneratedCodeAutoMerge: true
    }
  };
}

function phaseDraft(phase, order, title, recommendedLabels) {
  return {
    phase,
    order,
    title,
    recommendedLabel: recommendedLabels[0],
    recommendedLabels,
    guardrails: [
      "Keep this phase bounded and reviewable.",
      "Do not create paid resources.",
      "Do not deploy production.",
      "Do not trigger Codex build work automatically."
    ],
    body: [
      `# ${title}`,
      "",
      "Source candidate: Church Care Follow Up",
      "Source final packet: app_build_packet",
      `Phase order: ${order}`,
      `Phase id: ${phase}`,
      "",
      "## Goal",
      "Create a bounded, reviewable phase result.",
      "",
      "## Scope",
      "- Produce the phase artifact only.",
      "- Keep source-of-truth files visible.",
      "",
      "## Acceptance Criteria",
      "- Output is owner-readable.",
      "- Output is machine-readable.",
      "- Guardrails remain active.",
      "",
      "## Labels To Apply",
      ...recommendedLabels.map((label) => `- ${label}`),
      "",
      "## Required Source Of Truth To Load",
      "- source-of-truth/00-why-we-build.md",
      "- source-of-truth/01-ecosystem-philosophy.md",
      "- source-of-truth/02-global-principles.md",
      "- source-of-truth/03-life-produces-life.md",
      "- source-of-truth/04-app-purpose-rules.md",
      "- source-of-truth/05-ecosystem-design-gates.md",
      "- source-of-truth/phase-issue-generation.md",
      "- source-of-truth/phase-issue-publish-approval-gate.md",
      "",
      "## Guardrails",
      "- Do not create paid resources.",
      "- Do not deploy production.",
      "- Do not apply migrations.",
      "- Do not trigger Codex build work automatically.",
      "",
      "## Non-Goals",
      "- Do not start unrelated phases.",
      "- Do not create GitHub issues from this approval gate.",
      "- Do not auto-merge generated app code."
    ].join("\n")
  };
}

function passApproval() {
  return {
    approvalChecks: {
      phaseIssueCompleteness: { status: "pass", notes: "Every phase issue draft has required issue fields." },
      sourcePacketTraceability: { status: "pass", notes: "Every draft references source packet context." },
      phaseOrderClarity: { status: "pass", notes: "Draft order matches phase order." },
      labelSafety: { status: "pass", notes: "Labels are supported and remain recommendations until publication." },
      guardrailCompleteness: { status: "pass", notes: "Every draft includes guardrails." },
      acceptanceCriteriaCompleteness: { status: "pass", notes: "Every draft includes acceptance criteria." },
      automaticCodexBuildSafety: { status: "pass", notes: "Automatic Codex build remains blocked." },
      secretAndEnvSafety: { status: "pass", notes: "No secrets or env values are included." },
      resourceAndReleaseSafety: { status: "pass", notes: "No paid resources, migrations, or production deploys are authorized." },
      boundedReviewability: { status: "pass", notes: "Phase list is bounded and reviewable." }
    }
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
