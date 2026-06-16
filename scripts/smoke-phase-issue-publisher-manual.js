import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-phase-issue-publisher-manual-"));

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/phase-issue-publisher-manual-mode.md", [
    "phase_issue_publisher_dry_run",
    "phase_issue_publisher_manual",
    "APPENGINE_PHASE_ISSUE_PUBLISH_MODE=manual",
    "APPENGINE_PHASE_ISSUE_PUBLISH_OWNER_APPROVED=true",
    "manual_publish_not_enabled",
    "mock_publish_validated"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/phase-issue-publisher-manual-mode.md", "phase_issue_publisher_manual"]);
  assertFileIncludes("agents/context/output-contracts.md", ["phase_issue_publisher_manual"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["phase_issue_publisher_manual"]);
});

runStep("default mode validates payloads but publishes nothing", () => {
  const dryRun = phaseIssuePublisherDryRun({
    finalPacketType: "app_build_packet",
    payloads: [
      issuePayload("architecture", 1, "Architecture", ["ai:plan"], "app_build_packet"),
      issuePayload("build", 2, "MVP Build", ["ai:build"], "app_build_packet")
    ]
  });

  const result = runManual("default-noop.json", dryRun);

  assertEqual(result.kind, "phase_issue_publisher_manual", "artifact kind");
  assertEqual(result.decision.publishStatus, "manual_publish_not_enabled", "default status");
  assertEqual(result.decision.githubIssuesCreated, false, "no GitHub issues");
  assertEqual(result.decision.codexBuildTriggered, false, "no Codex build");
  assertEqual(result.publishResults[1].created, false, "build issue not created");
  assertArrayIncludes(result.publishResults[1].blockedLabels, "ai:build", "ai:build blocked");
  assertEqual(result.publishResults[1].appliedLabels[0], "ai:plan", "safe fallback label");
});

runStep("manual mode requires owner approval", () => {
  const dryRun = phaseIssuePublisherDryRun({
    finalPacketType: "app_build_packet",
    payloads: [issuePayload("architecture", 1, "Architecture", ["ai:plan"], "app_build_packet")]
  });

  assertThrows(() => {
    runManual("manual-missing-owner.json", dryRun, {
      APPENGINE_PHASE_ISSUE_PUBLISH_MODE: "manual",
      APPENGINE_PHASE_ISSUE_PUBLISH_REPOSITORY: "lincolnnunnally/AppEngine"
    });
  }, "owner approval flag is required");
});

runStep("manual mock mode validates payloads without live GitHub", () => {
  const dryRun = phaseIssuePublisherDryRun({
    finalPacketType: "app_build_packet",
    payloads: [
      issuePayload("architecture", 1, "Architecture", ["ai:plan"], "app_build_packet"),
      issuePayload("build", 2, "MVP Build", ["ai:build"], "app_build_packet")
    ]
  });

  const result = runManual("manual-mock.json", dryRun, {
    APPENGINE_PHASE_ISSUE_PUBLISH_MODE: "manual",
    APPENGINE_PHASE_ISSUE_PUBLISH_OWNER_APPROVED: "true",
    APPENGINE_PHASE_ISSUE_PUBLISH_MOCK: "true",
    APPENGINE_PHASE_ISSUE_PUBLISH_REPOSITORY: "lincolnnunnally/AppEngine"
  });

  assertEqual(result.decision.publishStatus, "mock_publish_validated", "mock status");
  assertEqual(result.decision.githubIssuesCreated, false, "no real GitHub issues");
  assertEqual(result.decision.mockIssuesCreated, true, "mock issue results");
  assertEqual(result.publishResults[0].url, "mock://issues/1", "mock URL");
  assertArrayIncludes(result.publishResults[1].blockedLabels, "ai:build", "build label blocked");
  assertEqual(result.publishResults[1].appliedLabels[0], "ai:plan", "safe label applied");
});

runStep("manual real mode requires GitHub token", () => {
  const dryRun = phaseIssuePublisherDryRun({
    finalPacketType: "app_build_packet",
    payloads: [issuePayload("architecture", 1, "Architecture", ["ai:plan"], "app_build_packet")]
  });

  assertThrows(() => {
    runManual("manual-missing-token.json", dryRun, {
      APPENGINE_PHASE_ISSUE_PUBLISH_MODE: "manual",
      APPENGINE_PHASE_ISSUE_PUBLISH_OWNER_APPROVED: "true",
      APPENGINE_PHASE_ISSUE_PUBLISH_REPOSITORY: "lincolnnunnally/AppEngine",
      GITHUB_TOKEN: "",
      GH_TOKEN: ""
    });
  }, "GITHUB_TOKEN or GH_TOKEN is required");
});

runStep("missing dry-run fields fail honestly", () => {
  const dryRun = phaseIssuePublisherDryRun({
    finalPacketType: "app_build_packet",
    payloads: [issuePayload("architecture", 1, "Architecture", ["ai:plan"], "app_build_packet")]
  });
  delete dryRun.sourceFinalPacket.status;

  assertThrows(() => {
    runManual("missing-dry-run-field.json", dryRun);
  }, "sourceFinalPacket.status");
});

runStep("unsafe payload content fails honestly", () => {
  const payload = issuePayload("architecture", 1, "Architecture", ["ai:plan"], "app_build_packet");
  payload.body += "\nOPENAI_API_KEY=sk-not-real";
  const dryRun = phaseIssuePublisherDryRun({
    finalPacketType: "app_build_packet",
    payloads: [payload]
  });

  assertThrows(() => {
    runManual("unsafe-payload.json", dryRun);
  }, "secret_or_env_value");
});

console.log(`phase-issue-publisher-manual smoke ok (${smokeRoot})`);

function runManual(name, dryRun, env = {}) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-manual.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-manual.md"));
  const resultsPath = path.join(smokeRoot, name.replace(".json", "-results.json"));

  writeJson(inputPath, { phase_issue_publisher_dry_run: dryRun });

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-phase-issue-publisher-manual.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      APPENGINE_PHASE_ISSUE_PUBLISH_MODE: "",
      APPENGINE_PHASE_ISSUE_PUBLISH_OWNER_APPROVED: "",
      APPENGINE_PHASE_ISSUE_PUBLISH_MOCK: "",
      APPENGINE_PHASE_ISSUE_PUBLISH_REPOSITORY: "",
      GITHUB_TOKEN: "",
      GH_TOKEN: "",
      ...env,
      PHASE_ISSUE_PUBLISHER_MANUAL_INPUT: inputPath,
      PHASE_ISSUE_PUBLISHER_MANUAL_OUTPUT: outputPath,
      PHASE_ISSUE_PUBLISHER_MANUAL_MARKDOWN_OUTPUT: markdownPath,
      PHASE_ISSUE_PUBLISHER_MANUAL_RESULTS_OUTPUT: resultsPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const result = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const results = readJson(resultsPath);

  assertIncludes(markdown, "Phase Issue Publisher Manual Mode", "markdown owner report");
  assertEqual(results.publishResults.length, result.publishResults.length, "publish result count");
  assertIncludes(result.ownerReadableReport, "Codex build triggered: no", "owner Codex guardrail");

  return result;
}

function phaseIssuePublisherDryRun({
  finalPacketType,
  candidateType = "new_app_candidate",
  candidateName = "Church Care Follow Up",
  candidateSlug = "",
  payloads
}) {
  const slug = candidateSlug || slugify(candidateName);

  return {
    kind: "phase_issue_publisher_dry_run",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "phase_issue_publish_approval",
      candidateSlug: slug,
      candidateType,
      finalPacketType,
      approvalStatus: "approved_for_issue_publish"
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
    issuePayloadPreviews: payloads,
    phaseOrder: payloads.map((payload) => payload.metadata.phase),
    labelsToApply: [...new Set(payloads.flatMap((payload) => payload.labels))],
    sourcePacketTraceability: payloads.map((payload) => ({
      phase: payload.metadata.phase,
      phaseOrder: payload.metadata.phaseOrder,
      sourceFinalPacketType: payload.metadata.sourceFinalPacketType,
      sourceApproval: "phase_issue_publish_approval",
      candidateSlug: payload.metadata.candidateSlug
    })),
    decision: {
      dryRunStatus: "payloads_ready_for_owner_review",
      nextSafeAction: "review_phase_issue_payloads",
      githubIssuesCreated: false,
      codexBuildTriggered: false,
      ownerApprovalRequired: true,
      reason: "Dry-run payload previews are ready."
    },
    ownerReadableReport: "Phase Issue Publisher Dry Run",
    guardrails: {
      dryRunOnly: true,
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

function issuePayload(phase, phaseOrder, title, labels, sourceFinalPacketType) {
  return {
    title: `[church-care-follow-up] ${title}`,
    body: [
      `# ${title}`,
      "",
      "Source candidate: Church Care Follow Up",
      `Source final packet: ${sourceFinalPacketType}`,
      `Phase order: ${phaseOrder}`,
      `Phase id: ${phase}`,
      "",
      "## Goal",
      "Create a bounded, reviewable phase result.",
      "",
      "## Acceptance Criteria",
      "- Output is owner-readable.",
      "- Output is machine-readable.",
      "- Guardrails remain active.",
      "",
      "## Labels To Apply",
      ...labels.map((label) => `- ${label}`),
      "",
      "## Required Source Of Truth To Load",
      "- source-of-truth/00-why-we-build.md",
      "- source-of-truth/01-ecosystem-philosophy.md",
      "- source-of-truth/phase-issue-publisher-dry-run.md",
      "- source-of-truth/phase-issue-publisher-manual-mode.md",
      "",
      "## Guardrails",
      "- Do not create paid resources.",
      "- Do not deploy production.",
      "- Do not apply migrations.",
      "- Do not trigger Codex build work automatically.",
      "",
      "## Non-Goals",
      "- Do not start unrelated phases.",
      "- Do not auto-merge generated app code.",
      "",
      "## Dry-Run Publisher Traceability",
      "- Source artifact: phase_issue_publisher_dry_run",
      "- GitHub issues created by this dry run: no",
      "- Codex build triggered by this dry run: no"
    ].join("\n"),
    labels,
    metadata: {
      phase,
      phaseOrder,
      candidateSlug: "church-care-follow-up",
      sourceFinalPacketType,
      sourceApproval: "phase_issue_publish_approval",
      dryRunOnly: true
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
