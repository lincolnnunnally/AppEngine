import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.PHASE_ISSUE_PUBLISHER_MANUAL_INPUT || "";
const artifactOutput = process.env.PHASE_ISSUE_PUBLISHER_MANUAL_OUTPUT || "";
const markdownOutput = process.env.PHASE_ISSUE_PUBLISHER_MANUAL_MARKDOWN_OUTPUT || "";
const resultsOutput = process.env.PHASE_ISSUE_PUBLISHER_MANUAL_RESULTS_OUTPUT || "";

const input = readInput(inputPath);
const dryRun = input.phaseIssuePublisherDryRun || input.phase_issue_publisher_dry_run || input.dryRun || input;
const config = {
  requestedMode: process.env.APPENGINE_PHASE_ISSUE_PUBLISH_MODE || input.publishMode || input.publish_mode || "dry-run",
  ownerApproved: booleanFlag(process.env.APPENGINE_PHASE_ISSUE_PUBLISH_OWNER_APPROVED) || input.ownerApproved === true || input.owner_approved === true,
  mockMode: booleanFlag(process.env.APPENGINE_PHASE_ISSUE_PUBLISH_MOCK) || input.mockMode === true || input.mock_mode === true,
  repository: process.env.APPENGINE_PHASE_ISSUE_PUBLISH_REPOSITORY || process.env.GITHUB_REPOSITORY || input.repository || "",
  githubToken: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ""
};

const artifact = await buildPhaseIssuePublisherManual(dryRun, config);

validatePhaseIssuePublisherManual(artifact);

if (artifactOutput) writeJson(artifactOutput, artifact);
if (markdownOutput) writeText(markdownOutput, renderManualMarkdown(artifact));
if (resultsOutput) writeJson(resultsOutput, { publishResults: artifact.publishResults });

console.log(`phase-issue-publisher-manual ok: ${artifact.candidate.slug} -> ${artifact.decision.publishStatus}`);
console.log(`next safe action: ${artifact.decision.nextSafeAction}`);

async function buildPhaseIssuePublisherManual(dryRun, config) {
  validatePhaseIssuePublisherDryRun(dryRun);
  const normalizedMode = normalizeMode(config.requestedMode);
  const manualModeEnabled = normalizedMode === "manual";
  const publishMode = {
    requestedMode: normalizedMode,
    manualModeEnabled,
    ownerApproved: config.ownerApproved === true,
    mockMode: config.mockMode === true,
    repository: config.repository || ""
  };

  const preparedPayloads = dryRun.issuePayloadPreviews.map((payload) => prepareIssuePayload(payload));
  validatePreparedPayloads(preparedPayloads);

  let publishResults = preparedPayloads.map((payload) => resultForNoop(payload));
  let publishStatus = "manual_publish_not_enabled";
  let nextSafeAction = "request_owner_manual_publish_approval";
  let mockIssuesCreated = false;
  let githubIssuesCreated = false;

  if (manualModeEnabled && !publishMode.ownerApproved) {
    throw new Error("Cannot publish phase issues: owner approval flag is required for manual mode");
  }

  if (manualModeEnabled && !publishMode.repository) {
    throw new Error("Cannot publish phase issues: repository is required for manual mode");
  }

  if (manualModeEnabled && publishMode.mockMode) {
    publishResults = preparedPayloads.map((payload, index) => resultForMock(payload, index));
    publishStatus = "mock_publish_validated";
    nextSafeAction = "review_mock_publish_results";
    mockIssuesCreated = true;
  } else if (manualModeEnabled) {
    if (!config.githubToken) throw new Error("Cannot publish phase issues: GITHUB_TOKEN or GH_TOKEN is required for real manual mode");
    publishResults = await publishIssuesToGitHub({ repository: publishMode.repository, token: config.githubToken, payloads: preparedPayloads });
    publishStatus = "manual_publish_completed";
    nextSafeAction = "review_published_phase_issues";
    githubIssuesCreated = true;
  }

  const artifact = {
    kind: "phase_issue_publisher_manual",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "phase_issue_publisher_dry_run",
      candidateSlug: dryRun.candidate.slug,
      candidateType: dryRun.candidate.type,
      finalPacketType: dryRun.sourceFinalPacket.kind
    },
    candidate: {
      name: dryRun.candidate.name,
      slug: dryRun.candidate.slug,
      type: dryRun.candidate.type,
      summary: dryRun.candidate.summary,
      needAddressed: dryRun.candidate.needAddressed,
      desiredTransformation: dryRun.candidate.desiredTransformation
    },
    sourceFinalPacket: {
      kind: dryRun.sourceFinalPacket.kind,
      status: dryRun.sourceFinalPacket.status
    },
    publishMode,
    publishResults,
    phaseOrder: dryRun.phaseOrder,
    labelsToApply: uniqueLabels(publishResults.map((result) => ({ labels: result.appliedLabels }))),
    decision: {
      publishStatus,
      nextSafeAction,
      githubIssuesCreated,
      mockIssuesCreated,
      codexBuildTriggered: false,
      ownerApprovalRequired: true,
      reason: reasonFor({ publishStatus, manualModeEnabled, mockMode: publishMode.mockMode })
    },
    ownerReadableReport: "",
    guardrails: requiredGuardrails()
  };

  artifact.ownerReadableReport = renderOwnerReport(artifact);

  return artifact;
}

function validatePhaseIssuePublisherDryRun(dryRun) {
  const missing = [];

  for (const [label, value] of [
    ["kind", dryRun.kind],
    ["schemaVersion", dryRun.schemaVersion],
    ["sourceArtifact.kind", dryRun.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", dryRun.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", dryRun.sourceArtifact?.candidateType],
    ["sourceArtifact.finalPacketType", dryRun.sourceArtifact?.finalPacketType],
    ["sourceArtifact.approvalStatus", dryRun.sourceArtifact?.approvalStatus],
    ["candidate.name", dryRun.candidate?.name],
    ["candidate.slug", dryRun.candidate?.slug],
    ["candidate.type", dryRun.candidate?.type],
    ["candidate.summary", dryRun.candidate?.summary],
    ["candidate.needAddressed", dryRun.candidate?.needAddressed],
    ["candidate.desiredTransformation", dryRun.candidate?.desiredTransformation],
    ["sourceFinalPacket.kind", dryRun.sourceFinalPacket?.kind],
    ["sourceFinalPacket.status", dryRun.sourceFinalPacket?.status],
    ["decision.dryRunStatus", dryRun.decision?.dryRunStatus],
    ["decision.nextSafeAction", dryRun.decision?.nextSafeAction],
    ["ownerReadableReport", dryRun.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (dryRun.kind !== "phase_issue_publisher_dry_run") missing.push("kind.phase_issue_publisher_dry_run");
  if (dryRun.sourceArtifact?.kind !== "phase_issue_publish_approval") missing.push("sourceArtifact.kind.phase_issue_publish_approval");
  if (dryRun.sourceArtifact?.approvalStatus !== "approved_for_issue_publish") missing.push("sourceArtifact.approvalStatus.approved");
  if (!finalPacketTypes().includes(dryRun.sourceFinalPacket?.kind)) missing.push("sourceFinalPacket.kind.allowed");
  if (!Array.isArray(dryRun.issuePayloadPreviews) || dryRun.issuePayloadPreviews.length === 0) missing.push("issuePayloadPreviews");
  if (!Array.isArray(dryRun.phaseOrder) || dryRun.phaseOrder.length === 0) missing.push("phaseOrder");
  if (!Array.isArray(dryRun.labelsToApply) || dryRun.labelsToApply.length === 0) missing.push("labelsToApply");
  if (!Array.isArray(dryRun.sourcePacketTraceability) || dryRun.sourcePacketTraceability.length === 0) missing.push("sourcePacketTraceability");
  if (dryRun.decision?.githubIssuesCreated !== false) missing.push("decision.githubIssuesCreated.false");
  if (dryRun.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (dryRun.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");
  if (dryRun.guardrails?.dryRunOnly !== true) missing.push("guardrails.dryRunOnly");

  for (const [label, value] of Object.entries(dryRunRequiredGuardrails())) {
    if (dryRun.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Cannot publish phase issues: missing ${missing.join(", ")}`);
}

function prepareIssuePayload(payload) {
  validatePayloadPreview(payload);
  const labelResult = sanitizeLabels(payload.labels);

  return {
    title: payload.title,
    body: appendManualTraceability(payload),
    labels: labelResult.appliedLabels,
    metadata: payload.metadata,
    requestedLabels: payload.labels,
    blockedLabels: labelResult.blockedLabels
  };
}

function validatePayloadPreview(payload) {
  const missing = [];

  for (const [label, value] of [
    ["title", payload.title],
    ["body", payload.body],
    ["metadata.phase", payload.metadata?.phase],
    ["metadata.phaseOrder", payload.metadata?.phaseOrder],
    ["metadata.candidateSlug", payload.metadata?.candidateSlug],
    ["metadata.sourceFinalPacketType", payload.metadata?.sourceFinalPacketType],
    ["metadata.sourceApproval", payload.metadata?.sourceApproval]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (!Array.isArray(payload.labels) || payload.labels.length === 0) missing.push("labels");

  const body = String(payload.body || "");
  for (const section of requiredBodySections()) {
    if (!body.includes(section)) missing.push(`body.${section}`);
  }
  if (!body.includes("## Dry-Run Publisher Traceability")) missing.push("body.dryRunTraceability");

  const unsafe = unsafeContentFindings(body);
  if (unsafe.length) missing.push(...unsafe.map((item) => `body.${item.code}`));

  if (missing.length) throw new Error(`Cannot publish phase issues: payload ${payload.title || "unknown"} missing ${missing.join(", ")}`);
}

function appendManualTraceability(payload) {
  return [
    payload.body.trim(),
    "",
    "## Manual Publisher Traceability",
    `- Source artifact: phase_issue_publisher_dry_run`,
    `- Candidate slug: ${payload.metadata.candidateSlug}`,
    `- Source final packet: ${payload.metadata.sourceFinalPacketType}`,
    `- Phase: ${payload.metadata.phase}`,
    `- Phase order: ${payload.metadata.phaseOrder}`,
    "- Codex build triggered by manual publisher: no",
    "- Production deploy triggered by manual publisher: no"
  ].join("\n");
}

function sanitizeLabels(labels) {
  const requested = Array.isArray(labels) ? labels : [];
  const blockedSet = new Set(["ai:build", "ai:fix"]);
  const allowedSet = new Set((process.env.APPENGINE_PHASE_ISSUE_SAFE_LABELS || "ai:plan")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean));
  const blockedLabels = requested.filter((label) => blockedSet.has(label));
  const appliedLabels = requested.filter((label) => allowedSet.has(label) && !blockedSet.has(label));

  if (appliedLabels.length === 0) appliedLabels.push("ai:plan");

  return {
    appliedLabels: [...new Set(appliedLabels)],
    blockedLabels: [...new Set(blockedLabels)]
  };
}

function validatePreparedPayloads(payloads) {
  const missing = [];

  payloads.forEach((payload, index) => {
    if (!isPresent(payload.title)) missing.push(`publishResults.${index}.title`);
    if (!isPresent(payload.body)) missing.push(`publishResults.${index}.body`);
    if (!Array.isArray(payload.labels) || payload.labels.length === 0) missing.push(`publishResults.${index}.labels`);
    if (payload.labels.includes("ai:build")) missing.push(`publishResults.${index}.labels.aiBuildBlocked`);
    if (payload.labels.includes("ai:fix")) missing.push(`publishResults.${index}.labels.aiFixBlocked`);
    if (!payload.body.includes("## Manual Publisher Traceability")) missing.push(`publishResults.${index}.body.manualTraceability`);
    if (!payload.body.includes("## Acceptance Criteria")) missing.push(`publishResults.${index}.body.acceptanceCriteria`);
    if (!payload.body.includes("## Guardrails")) missing.push(`publishResults.${index}.body.guardrails`);
  });

  if (missing.length) throw new Error(`Cannot publish phase issues: missing ${missing.join(", ")}`);
}

function resultForNoop(payload) {
  return {
    title: payload.title,
    phase: payload.metadata.phase,
    phaseOrder: payload.metadata.phaseOrder,
    requestedLabels: payload.requestedLabels,
    appliedLabels: payload.labels,
    blockedLabels: payload.blockedLabels,
    mocked: false,
    created: false,
    url: "",
    reason: "Manual publish mode is not enabled."
  };
}

function resultForMock(payload, index) {
  return {
    title: payload.title,
    phase: payload.metadata.phase,
    phaseOrder: payload.metadata.phaseOrder,
    requestedLabels: payload.requestedLabels,
    appliedLabels: payload.labels,
    blockedLabels: payload.blockedLabels,
    mocked: true,
    created: false,
    url: `mock://issues/${index + 1}`,
    reason: "Mock manual publish validated without calling GitHub."
  };
}

async function publishIssuesToGitHub({ repository, token, payloads }) {
  const results = [];

  for (const payload of payloads) {
    const response = await fetch(`https://api.github.com/repos/${repository}/issues`, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        labels: payload.labels
      })
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`GitHub issue creation failed for ${payload.title}: ${response.status} ${json.message || response.statusText}`);
    }

    results.push({
      title: payload.title,
      phase: payload.metadata.phase,
      phaseOrder: payload.metadata.phaseOrder,
      requestedLabels: payload.requestedLabels,
      appliedLabels: payload.labels,
      blockedLabels: payload.blockedLabels,
      mocked: false,
      created: true,
      url: json.html_url || "",
      issueNumber: json.number || null,
      reason: "GitHub issue created in explicit manual mode."
    });
  }

  return results;
}

function renderOwnerReport(artifact) {
  const lines = [
    "Phase Issue Publisher Manual Mode",
    "",
    `Candidate: ${artifact.candidate.name}`,
    `Mode: ${artifact.publishMode.manualModeEnabled ? "manual" : "noop"}`,
    `Owner approved: ${artifact.publishMode.ownerApproved ? "yes" : "no"}`,
    `Mock mode: ${artifact.publishMode.mockMode ? "yes" : "no"}`,
    `Issues requested: ${artifact.publishResults.length}`,
    `Issues created: ${artifact.publishResults.filter((result) => result.created).length}`,
    `Next safe action: ${artifact.decision.nextSafeAction}`,
    `GitHub issues created: ${artifact.decision.githubIssuesCreated ? "yes" : "no"}`,
    "Codex build triggered: no",
    "",
    "Publish results:"
  ];

  artifact.publishResults.forEach((result, index) => {
    lines.push(`${index + 1}. ${result.title}`);
    lines.push(`   Applied labels: ${result.appliedLabels.join(", ")}`);
    if (result.blockedLabels.length) lines.push(`   Blocked labels: ${result.blockedLabels.join(", ")}`);
    lines.push(`   Created: ${result.created ? "yes" : "no"}`);
    if (result.url) lines.push(`   URL: ${result.url}`);
  });

  lines.push("", "Guardrails: manual publishing only, default no-op, no Codex build, no deploy");

  return lines.join("\n");
}

function renderManualMarkdown(artifact) {
  return `${artifact.ownerReadableReport}\n`;
}

function validatePhaseIssuePublisherManual(artifact) {
  const missing = [];

  for (const [label, value] of [
    ["kind", artifact.kind],
    ["schemaVersion", artifact.schemaVersion],
    ["sourceArtifact.kind", artifact.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", artifact.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", artifact.sourceArtifact?.candidateType],
    ["sourceArtifact.finalPacketType", artifact.sourceArtifact?.finalPacketType],
    ["candidate.name", artifact.candidate?.name],
    ["candidate.slug", artifact.candidate?.slug],
    ["candidate.type", artifact.candidate?.type],
    ["candidate.summary", artifact.candidate?.summary],
    ["candidate.needAddressed", artifact.candidate?.needAddressed],
    ["candidate.desiredTransformation", artifact.candidate?.desiredTransformation],
    ["sourceFinalPacket.kind", artifact.sourceFinalPacket?.kind],
    ["sourceFinalPacket.status", artifact.sourceFinalPacket?.status],
    ["decision.publishStatus", artifact.decision?.publishStatus],
    ["decision.nextSafeAction", artifact.decision?.nextSafeAction],
    ["ownerReadableReport", artifact.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (artifact.kind !== "phase_issue_publisher_manual") missing.push("kind.phase_issue_publisher_manual");
  if (artifact.sourceArtifact?.kind !== "phase_issue_publisher_dry_run") missing.push("sourceArtifact.kind.phase_issue_publisher_dry_run");
  if (!finalPacketTypes().includes(artifact.sourceFinalPacket?.kind)) missing.push("sourceFinalPacket.kind.allowed");
  if (!Array.isArray(artifact.publishResults) || artifact.publishResults.length === 0) missing.push("publishResults");
  if (!Array.isArray(artifact.phaseOrder) || artifact.phaseOrder.length === 0) missing.push("phaseOrder");
  if (!Array.isArray(artifact.labelsToApply) || artifact.labelsToApply.length === 0) missing.push("labelsToApply");
  if (artifact.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (artifact.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");

  for (const result of artifact.publishResults || []) {
    if (result.appliedLabels?.includes("ai:build")) missing.push(`publishResults.${result.title}.aiBuildBlocked`);
    if (result.appliedLabels?.includes("ai:fix")) missing.push(`publishResults.${result.title}.aiFixBlocked`);
  }

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (artifact.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Phase issue publisher manual artifact missing required fields: ${missing.join(", ")}`);
}

function reasonFor({ publishStatus, manualModeEnabled, mockMode }) {
  if (!manualModeEnabled) return "Manual publish mode was not enabled, so the publisher returned a no-op result.";
  if (mockMode) return "Manual publish mode was enabled in mock mode, so payloads were validated without calling GitHub.";
  if (publishStatus === "manual_publish_completed") return "Manual publish mode created GitHub issues after explicit owner approval.";
  return "Manual publish result recorded.";
}

function normalizeMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["manual", "publish", "create"].includes(normalized)) return "manual";
  return "dry-run";
}

function booleanFlag(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function finalPacketTypes() {
  return ["app_build_packet", "vnext_packet", "non_app_solution_plan"];
}

function requiredBodySections() {
  return [
    "## Goal",
    "## Acceptance Criteria",
    "## Labels To Apply",
    "## Required Source Of Truth To Load",
    "## Guardrails",
    "## Non-Goals"
  ];
}

function unsafeContentFindings(body) {
  const findings = [];
  const checks = [
    [/OPENAI_API_KEY\s*=/i, "secret_or_env_value"],
    [/AUTH_SECRET\s*=/i, "secret_or_env_value"],
    [/VERCEL_TOKEN\s*=/i, "secret_or_env_value"],
    [/x-vercel-protection-bypass/i, "protected_bypass_url"],
    [/apply migrations now/i, "migration_instruction"],
    [/run migrations now/i, "migration_instruction"],
    [/(^|\n)\s*create paid resource/i, "paid_resource_instruction"],
    [/(^|\n)\s*provision paid/i, "paid_resource_instruction"],
    [/production deploy approved/i, "production_deploy_instruction"],
    [/deploy production now/i, "production_deploy_instruction"],
    [/(^|\n)\s*auto-merge generated app code/i, "auto_merge_instruction"]
  ];

  for (const [pattern, code] of checks) {
    if (pattern.test(body)) findings.push({ code });
  }

  return findings;
}

function dryRunRequiredGuardrails() {
  return {
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
  };
}

function requiredGuardrails() {
  return {
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
  };
}

function uniqueLabels(items) {
  return [...new Set(items.flatMap((item) => item.labels || []))];
}

function isPresent(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function readInput(filePath) {
  if (!filePath) return {};
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return {};
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, value);
}
