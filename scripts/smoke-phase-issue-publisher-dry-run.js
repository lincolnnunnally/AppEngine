import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-phase-issue-publisher-dry-run-"));

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/phase-issue-publisher-dry-run.md", [
    "phase_issue_publish_approval",
    "phase_issue_publisher_dry_run",
    "issuePayloadPreviews",
    "approved_for_issue_publish",
    "githubIssuesCreated",
    "codexBuildTriggered"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/phase-issue-publisher-dry-run.md", "phase_issue_publisher_dry_run"]);
  assertFileIncludes("agents/context/output-contracts.md", ["phase_issue_publisher_dry_run"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["phase_issue_publisher_dry_run"]);
});

runStep("approved App Build Packet publish approval creates payload previews only", () => {
  const drafts = [
    phaseDraft("architecture", 1, "Architecture", ["ai:plan"], "app_build_packet"),
    phaseDraft("build", 2, "MVP Build", ["ai:build"], "app_build_packet")
  ];
  const result = runDryRun("app-approved.json", phaseIssuePublishApproval({
    finalPacketType: "app_build_packet",
    candidateType: "new_app_candidate",
    candidateName: "Church Care Follow Up",
    drafts
  }), drafts);

  assertEqual(result.kind, "phase_issue_publisher_dry_run", "artifact kind");
  assertEqual(result.issuePayloadPreviews.length, 2, "payload count");
  assertEqual(result.decision.githubIssuesCreated, false, "GitHub issues not created");
  assertEqual(result.decision.codexBuildTriggered, false, "Codex build not triggered");
  assertEqual(result.decision.nextSafeAction, "review_phase_issue_payloads", "next safe action");
  assertIncludes(result.issuePayloadPreviews[0].body, "## Dry-Run Publisher Traceability", "payload traceability");
  assertEqual(result.issuePayloadPreviews[1].labels[0], "ai:build", "build label previewed but not applied");
});

runStep("approved vNext Packet publish approval creates payload previews only", () => {
  const drafts = [
    phaseDraft("context_refresh", 1, "Context Refresh", ["ai:plan"], "vnext_packet"),
    phaseDraft("verification", 2, "vNext Verification", ["ai:review"], "vnext_packet")
  ];
  const result = runDryRun("vnext-approved.json", phaseIssuePublishApproval({
    finalPacketType: "vnext_packet",
    candidateType: "existing_app_improvement",
    candidateName: "Spark Of Hope Intake Lite",
    candidateSlug: "spark-of-hope-intake-lite",
    drafts
  }), drafts);

  assertEqual(result.sourceFinalPacket.kind, "vnext_packet", "source final packet");
  assertEqual(result.issuePayloadPreviews.length, 2, "payload count");
});

runStep("approved Non-App Solution Plan publish approval creates payload previews only", () => {
  const drafts = [
    phaseDraft("discovery", 1, "Discovery", ["ai:plan"], "non_app_solution_plan"),
    phaseDraft("solution_design", 2, "Solution Design", ["ai:plan"], "non_app_solution_plan")
  ];
  const result = runDryRun("non-app-approved.json", phaseIssuePublishApproval({
    finalPacketType: "non_app_solution_plan",
    candidateType: "workflow_process_candidate",
    candidateName: "Care Follow Up Workflow",
    drafts
  }), drafts);

  assertEqual(result.sourceFinalPacket.kind, "non_app_solution_plan", "source final packet");
  assertEqual(result.labelsToApply.length, 1, "planning-only labels");
});

runStep("non-approved statuses fail honestly", () => {
  const drafts = [phaseDraft("architecture", 1, "Architecture", ["ai:plan"], "app_build_packet")];

  for (const approvalStatus of ["needs_revision", "rejected", "blocked_by_security", "blocked_by_cost", "blocked_by_scope"]) {
    assertThrows(() => {
      runDryRun(`${approvalStatus}.json`, phaseIssuePublishApproval({
        finalPacketType: "app_build_packet",
        approvalStatus,
        drafts
      }), drafts);
    }, `approvalStatus ${approvalStatus} is not approved_for_issue_publish`);
  }
});

runStep("missing approval fields fail honestly", () => {
  const drafts = [phaseDraft("architecture", 1, "Architecture", ["ai:plan"], "app_build_packet")];
  const approval = phaseIssuePublishApproval({ finalPacketType: "app_build_packet", drafts });
  delete approval.approvalChecks.secretAndEnvSafety;

  assertThrows(() => {
    runDryRun("missing-approval-field.json", approval, drafts);
  }, "approvalChecks.secretAndEnvSafety");
});

runStep("missing source drafts fail honestly", () => {
  const drafts = [phaseDraft("architecture", 1, "Architecture", ["ai:plan"], "app_build_packet")];
  const approval = phaseIssuePublishApproval({ finalPacketType: "app_build_packet", drafts });

  assertThrows(() => {
    runDryRun("missing-source-drafts.json", approval, []);
  }, "missing phaseIssueDrafts");
});

runStep("unsafe payload content fails honestly", () => {
  const drafts = [phaseDraft("architecture", 1, "Architecture", ["ai:plan"], "app_build_packet")];
  drafts[0].body += "\nAUTH_SECRET=not-real";

  const approval = phaseIssuePublishApproval({ finalPacketType: "app_build_packet", drafts });

  assertThrows(() => {
    runDryRun("unsafe-payload.json", approval, drafts);
  }, "secret_or_env_value");
});

console.log(`phase-issue-publisher-dry-run smoke ok (${smokeRoot})`);

function runDryRun(name, approval, drafts) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-dry-run.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-dry-run.md"));
  const payloadsPath = path.join(smokeRoot, name.replace(".json", "-payloads.json"));

  writeJson(inputPath, {
    phase_issue_publish_approval: approval,
    phaseIssueDrafts: drafts
  });

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-phase-issue-publisher-dry-run.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PHASE_ISSUE_PUBLISHER_DRY_RUN_INPUT: inputPath,
      PHASE_ISSUE_PUBLISHER_DRY_RUN_OUTPUT: outputPath,
      PHASE_ISSUE_PUBLISHER_DRY_RUN_MARKDOWN_OUTPUT: markdownPath,
      PHASE_ISSUE_PUBLISHER_DRY_RUN_PAYLOADS_OUTPUT: payloadsPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const result = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const payloads = readJson(payloadsPath);

  assertIncludes(markdown, "Phase Issue Publisher Dry Run", "markdown owner report");
  assertEqual(payloads.issuePayloadPreviews.length, result.issuePayloadPreviews.length, "payload preview count");
  assertIncludes(result.ownerReadableReport, "GitHub issues created: no", "owner issue guardrail");
  assertIncludes(result.ownerReadableReport, "Codex build triggered: no", "owner Codex guardrail");
  assertEqual(result.guardrails.dryRunOnly, true, "dry-run guardrail");

  return result;
}

function phaseIssuePublishApproval({
  finalPacketType,
  candidateType = "new_app_candidate",
  candidateName = "Church Care Follow Up",
  candidateSlug = "",
  approvalStatus = "approved_for_issue_publish",
  drafts
}) {
  const slug = candidateSlug || slugify(candidateName);
  const approved = approvalStatus === "approved_for_issue_publish";

  return {
    kind: "phase_issue_publish_approval",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "phase_issue_generation",
      candidateSlug: slug,
      candidateType,
      finalPacketType,
      generationStatus: "phase_issue_drafts_ready"
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
    approvalStatus,
    approvalChecks: approvalChecks(approvalStatus),
    phaseIssueSummary: {
      phaseCount: drafts.length,
      phaseOrder: drafts.map((draft) => draft.phase),
      labelsToApply: [...new Set(drafts.flatMap((draft) => draft.recommendedLabels))],
      draftTitles: drafts.map((draft) => draft.title)
    },
    decision: {
      approvedForIssuePublish: approved,
      nextSafeAction: approved ? "prepare_phase_issue_publish" : "revise_phase_issue_drafts",
      githubIssuesPublished: false,
      codexBuildTriggered: false,
      codexTriggerLabelsApproved: false,
      ownerApprovalRequired: true,
      reason: approved ? "Phase issue drafts passed publish approval." : "Phase issue drafts did not pass publish approval."
    },
    ownerReadableReport: "Phase Issue Publish Approval",
    followUpTasks: [],
    guardrails: {
      approvalGateOnly: true,
      noUi: true,
      noGithubIssuesCreated: true,
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

function phaseDraft(phase, order, title, recommendedLabels, sourceFinalPacketType) {
  const issueTitle = `[church-care-follow-up] ${title}`;

  return {
    phase,
    order,
    title: issueTitle,
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
      `Source final packet: ${sourceFinalPacketType}`,
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
      "- source-of-truth/phase-issue-publisher-dry-run.md",
      "",
      "## Guardrails",
      "- Do not create paid resources.",
      "- Do not deploy production.",
      "- Do not apply migrations.",
      "- Do not trigger Codex build work automatically.",
      "",
      "## Non-Goals",
      "- Do not start unrelated phases.",
      "- Do not create GitHub issues from this dry run.",
      "- Do not auto-merge generated app code."
    ].join("\n")
  };
}

function approvalChecks(approvalStatus) {
  const status = approvalStatus === "approved_for_issue_publish" ? "pass" : approvalStatus;

  return {
    phaseIssueCompleteness: { status, notes: "Every draft has required issue fields." },
    sourcePacketTraceability: { status: "pass", notes: "Every draft references source packet context." },
    phaseOrderClarity: { status: "pass", notes: "Draft order matches phase order." },
    labelSafety: { status: "pass", notes: "Labels are supported and remain recommendations until publication." },
    guardrailCompleteness: { status: "pass", notes: "Every draft includes guardrails." },
    acceptanceCriteriaCompleteness: { status: "pass", notes: "Every draft includes acceptance criteria." },
    automaticCodexBuildSafety: { status: "pass", notes: "Automatic Codex build remains blocked." },
    secretAndEnvSafety: { status: "pass", notes: "No secrets or env values are included." },
    resourceAndReleaseSafety: { status: "pass", notes: "No paid resources, migrations, or production deploys are authorized." },
    boundedReviewability: { status: "pass", notes: "Phase list is bounded and reviewable." }
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
