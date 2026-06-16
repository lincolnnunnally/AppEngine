import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.PHASE_ISSUE_PUBLISHER_DRY_RUN_INPUT || "";
const artifactOutput = process.env.PHASE_ISSUE_PUBLISHER_DRY_RUN_OUTPUT || "";
const markdownOutput = process.env.PHASE_ISSUE_PUBLISHER_DRY_RUN_MARKDOWN_OUTPUT || "";
const payloadsOutput = process.env.PHASE_ISSUE_PUBLISHER_DRY_RUN_PAYLOADS_OUTPUT || "";

const input = readInput(inputPath);
const approval = input.phaseIssuePublishApproval || input.phase_issue_publish_approval || input.approval || input;
const sourceDrafts =
  input.phaseIssueDrafts ||
  input.phase_issue_drafts ||
  input.phaseIssueGeneration?.phaseIssueDrafts ||
  input.phase_issue_generation?.phaseIssueDrafts ||
  approval.phaseIssueDrafts ||
  [];
const dryRun = buildPhaseIssuePublisherDryRun(approval, sourceDrafts);

validatePhaseIssuePublisherDryRun(dryRun);

if (artifactOutput) writeJson(artifactOutput, dryRun);
if (markdownOutput) writeText(markdownOutput, renderDryRunMarkdown(dryRun));
if (payloadsOutput) writeJson(payloadsOutput, { issuePayloadPreviews: dryRun.issuePayloadPreviews });

console.log(`phase-issue-publisher-dry-run ok: ${dryRun.candidate.slug} -> ${dryRun.issuePayloadPreviews.length} payload previews`);
console.log(`next safe action: ${dryRun.decision.nextSafeAction}`);

function buildPhaseIssuePublisherDryRun(approval, sourceDrafts) {
  validatePhaseIssuePublishApprovalInput(approval);
  validateSourceDrafts(approval, sourceDrafts);

  const issuePayloadPreviews = sourceDrafts.map((draft) => buildIssuePayloadPreview(approval, draft));
  validateIssuePayloadPreviews(issuePayloadPreviews);

  const dryRun = {
    kind: "phase_issue_publisher_dry_run",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "phase_issue_publish_approval",
      candidateSlug: approval.candidate.slug,
      candidateType: approval.candidate.type,
      finalPacketType: approval.sourceFinalPacket.kind,
      approvalStatus: approval.approvalStatus
    },
    candidate: {
      name: approval.candidate.name,
      slug: approval.candidate.slug,
      type: approval.candidate.type,
      summary: approval.candidate.summary,
      needAddressed: approval.candidate.needAddressed,
      desiredTransformation: approval.candidate.desiredTransformation
    },
    sourceFinalPacket: {
      kind: approval.sourceFinalPacket.kind,
      status: approval.sourceFinalPacket.status
    },
    issuePayloadPreviews,
    phaseOrder: issuePayloadPreviews.map((payload) => payload.metadata.phase),
    labelsToApply: uniqueLabels(issuePayloadPreviews),
    sourcePacketTraceability: issuePayloadPreviews.map((payload) => ({
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
      reason: "Approved phase issue publish approval was converted into exact GitHub issue payload previews only."
    },
    ownerReadableReport: "",
    guardrails: requiredGuardrails()
  };

  dryRun.ownerReadableReport = renderOwnerReport(dryRun);

  return dryRun;
}

function validatePhaseIssuePublishApprovalInput(approval) {
  const missing = [];

  for (const [label, value] of [
    ["kind", approval.kind],
    ["schemaVersion", approval.schemaVersion],
    ["sourceArtifact.kind", approval.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", approval.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", approval.sourceArtifact?.candidateType],
    ["sourceArtifact.finalPacketType", approval.sourceArtifact?.finalPacketType],
    ["sourceArtifact.generationStatus", approval.sourceArtifact?.generationStatus],
    ["candidate.name", approval.candidate?.name],
    ["candidate.slug", approval.candidate?.slug],
    ["candidate.type", approval.candidate?.type],
    ["candidate.summary", approval.candidate?.summary],
    ["candidate.needAddressed", approval.candidate?.needAddressed],
    ["candidate.desiredTransformation", approval.candidate?.desiredTransformation],
    ["sourceFinalPacket.kind", approval.sourceFinalPacket?.kind],
    ["sourceFinalPacket.status", approval.sourceFinalPacket?.status],
    ["approvalStatus", approval.approvalStatus],
    ["phaseIssueSummary.phaseCount", approval.phaseIssueSummary?.phaseCount],
    ["phaseIssueSummary.phaseOrder", approval.phaseIssueSummary?.phaseOrder],
    ["phaseIssueSummary.labelsToApply", approval.phaseIssueSummary?.labelsToApply],
    ["phaseIssueSummary.draftTitles", approval.phaseIssueSummary?.draftTitles],
    ["decision.nextSafeAction", approval.decision?.nextSafeAction],
    ["ownerReadableReport", approval.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (approval.kind !== "phase_issue_publish_approval") missing.push("kind.phase_issue_publish_approval");
  if (approval.sourceArtifact?.kind !== "phase_issue_generation") missing.push("sourceArtifact.kind.phase_issue_generation");
  if (!finalPacketTypes().includes(approval.sourceFinalPacket?.kind)) missing.push("sourceFinalPacket.kind.allowed");
  if (!approvalStatuses().includes(approval.approvalStatus)) missing.push("approvalStatus.allowed");
  if (approval.approvalStatus !== "approved_for_issue_publish") {
    throw new Error(`Cannot dry-run phase issue publish: approvalStatus ${approval.approvalStatus} is not approved_for_issue_publish`);
  }
  if (approval.decision?.approvedForIssuePublish !== true) missing.push("decision.approvedForIssuePublish.true");
  if (approval.decision?.githubIssuesPublished !== false) missing.push("decision.githubIssuesPublished.false");
  if (approval.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (approval.decision?.codexTriggerLabelsApproved !== false) missing.push("decision.codexTriggerLabelsApproved.false");
  if (approval.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");
  if (approval.guardrails?.approvalGateOnly !== true) missing.push("guardrails.approvalGateOnly");

  for (const factor of approvalFactors()) {
    if (!approval.approvalChecks?.[factor]?.status) missing.push(`approvalChecks.${factor}.status`);
    if (!isPresent(approval.approvalChecks?.[factor]?.notes)) missing.push(`approvalChecks.${factor}.notes`);
    if (approval.approvalChecks?.[factor]?.status !== "pass") missing.push(`approvalChecks.${factor}.pass`);
  }

  for (const [label, value] of Object.entries(approvalRequiredGuardrails())) {
    if (approval.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Cannot dry-run phase issue publish: missing ${missing.join(", ")}`);
}

function validateSourceDrafts(approval, sourceDrafts) {
  const missing = [];

  if (!Array.isArray(sourceDrafts) || sourceDrafts.length === 0) {
    throw new Error("Cannot dry-run phase issue publish: missing phaseIssueDrafts");
  }

  if (approval.phaseIssueSummary.phaseCount !== sourceDrafts.length) {
    missing.push("phaseIssueSummary.phaseCount.matchesSourceDrafts");
  }

  sourceDrafts.forEach((draft, index) => {
    for (const [label, value] of [
      ["phase", draft.phase],
      ["order", draft.order],
      ["title", draft.title],
      ["recommendedLabel", draft.recommendedLabel],
      ["body", draft.body]
    ]) {
      if (!isPresent(value)) missing.push(`phaseIssueDrafts.${index}.${label}`);
    }

    if (!Array.isArray(draft.recommendedLabels) || draft.recommendedLabels.length === 0) missing.push(`phaseIssueDrafts.${index}.recommendedLabels`);
    if (!Array.isArray(draft.guardrails) || draft.guardrails.length === 0) missing.push(`phaseIssueDrafts.${index}.guardrails`);
    if (approval.phaseIssueSummary.phaseOrder[index] !== draft.phase) missing.push(`phaseIssueDrafts.${index}.phaseOrder.matchesApproval`);
    if (approval.phaseIssueSummary.draftTitles[index] !== draft.title) missing.push(`phaseIssueDrafts.${index}.title.matchesApproval`);

    const body = String(draft.body || "");
    for (const section of requiredBodySections()) {
      if (!body.includes(section)) missing.push(`phaseIssueDrafts.${index}.body.${section}`);
    }
    if (!body.includes("Source final packet:")) missing.push(`phaseIssueDrafts.${index}.body.sourceFinalPacket`);
    if (!body.includes("## Required Source Of Truth To Load")) missing.push(`phaseIssueDrafts.${index}.body.requiredSourceOfTruth`);
    if (!body.includes("Do not trigger Codex build work automatically")) missing.push(`phaseIssueDrafts.${index}.body.codexGuardrail`);
  });

  if (missing.length) throw new Error(`Cannot dry-run phase issue publish: missing ${missing.join(", ")}`);
}

function buildIssuePayloadPreview(approval, draft) {
  return {
    title: draft.title,
    body: appendDryRunTraceability(approval, draft),
    labels: draft.recommendedLabels,
    metadata: {
      phase: draft.phase,
      phaseOrder: draft.order,
      candidateSlug: approval.candidate.slug,
      candidateType: approval.candidate.type,
      sourceFinalPacketType: approval.sourceFinalPacket.kind,
      sourceApproval: "phase_issue_publish_approval",
      dryRunOnly: true
    }
  };
}

function appendDryRunTraceability(approval, draft) {
  return [
    draft.body.trim(),
    "",
    "## Dry-Run Publisher Traceability",
    `- Candidate: ${approval.candidate.name}`,
    `- Candidate slug: ${approval.candidate.slug}`,
    `- Source approval: phase_issue_publish_approval`,
    `- Source final packet: ${approval.sourceFinalPacket.kind}`,
    `- Phase: ${draft.phase}`,
    `- Phase order: ${draft.order}`,
    "- GitHub issues created by this dry run: no",
    "- Codex build triggered by this dry run: no"
  ].join("\n");
}

function validateIssuePayloadPreviews(payloads) {
  const missing = [];

  payloads.forEach((payload, index) => {
    for (const [label, value] of [
      ["title", payload.title],
      ["body", payload.body],
      ["metadata.phase", payload.metadata?.phase],
      ["metadata.phaseOrder", payload.metadata?.phaseOrder],
      ["metadata.candidateSlug", payload.metadata?.candidateSlug],
      ["metadata.sourceFinalPacketType", payload.metadata?.sourceFinalPacketType],
      ["metadata.sourceApproval", payload.metadata?.sourceApproval]
    ]) {
      if (!isPresent(value)) missing.push(`issuePayloadPreviews.${index}.${label}`);
    }

    if (!Array.isArray(payload.labels) || payload.labels.length === 0) missing.push(`issuePayloadPreviews.${index}.labels`);

    const body = String(payload.body || "");
    for (const section of requiredBodySections()) {
      if (!body.includes(section)) missing.push(`issuePayloadPreviews.${index}.body.${section}`);
    }
    for (const unsafe of unsafeContentFindings(body)) {
      missing.push(`issuePayloadPreviews.${index}.body.${unsafe.code}`);
    }
  });

  if (missing.length) throw new Error(`Phase issue publisher dry-run artifact missing required fields: ${missing.join(", ")}`);
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

function renderOwnerReport(dryRun) {
  const lines = [
    "Phase Issue Publisher Dry Run",
    "",
    `Candidate: ${dryRun.candidate.name}`,
    `Source final packet: ${dryRun.sourceFinalPacket.kind}`,
    `Issues previewed: ${dryRun.issuePayloadPreviews.length}`,
    `Phase order: ${dryRun.phaseOrder.join(", ")}`,
    `Labels to apply: ${dryRun.labelsToApply.join(", ")}`,
    `Next safe action: ${dryRun.decision.nextSafeAction}`,
    "GitHub issues created: no",
    "Codex build triggered: no",
    "",
    "Issue payload previews:"
  ];

  dryRun.issuePayloadPreviews.forEach((payload, index) => {
    lines.push(`${index + 1}. ${payload.title}`);
    lines.push(`   Labels: ${payload.labels.join(", ")}`);
    lines.push(`   Phase: ${payload.metadata.phase}`);
    lines.push(`   Source packet: ${payload.metadata.sourceFinalPacketType}`);
  });

  lines.push("", "Guardrails: dry-run only, no GitHub issues created, no Codex build, no deploy");

  return lines.join("\n");
}

function renderDryRunMarkdown(artifact) {
  return `${artifact.ownerReadableReport}\n`;
}

function validatePhaseIssuePublisherDryRun(artifact) {
  const missing = [];

  for (const [label, value] of [
    ["kind", artifact.kind],
    ["schemaVersion", artifact.schemaVersion],
    ["sourceArtifact.kind", artifact.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", artifact.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", artifact.sourceArtifact?.candidateType],
    ["sourceArtifact.finalPacketType", artifact.sourceArtifact?.finalPacketType],
    ["sourceArtifact.approvalStatus", artifact.sourceArtifact?.approvalStatus],
    ["candidate.name", artifact.candidate?.name],
    ["candidate.slug", artifact.candidate?.slug],
    ["candidate.type", artifact.candidate?.type],
    ["candidate.summary", artifact.candidate?.summary],
    ["candidate.needAddressed", artifact.candidate?.needAddressed],
    ["candidate.desiredTransformation", artifact.candidate?.desiredTransformation],
    ["sourceFinalPacket.kind", artifact.sourceFinalPacket?.kind],
    ["sourceFinalPacket.status", artifact.sourceFinalPacket?.status],
    ["decision.dryRunStatus", artifact.decision?.dryRunStatus],
    ["decision.nextSafeAction", artifact.decision?.nextSafeAction],
    ["ownerReadableReport", artifact.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (artifact.kind !== "phase_issue_publisher_dry_run") missing.push("kind.phase_issue_publisher_dry_run");
  if (artifact.sourceArtifact?.kind !== "phase_issue_publish_approval") missing.push("sourceArtifact.kind.phase_issue_publish_approval");
  if (artifact.sourceArtifact?.approvalStatus !== "approved_for_issue_publish") missing.push("sourceArtifact.approvalStatus.approved");
  if (!finalPacketTypes().includes(artifact.sourceFinalPacket?.kind)) missing.push("sourceFinalPacket.kind.allowed");
  if (!Array.isArray(artifact.issuePayloadPreviews) || artifact.issuePayloadPreviews.length === 0) missing.push("issuePayloadPreviews");
  if (!Array.isArray(artifact.phaseOrder) || artifact.phaseOrder.length === 0) missing.push("phaseOrder");
  if (!Array.isArray(artifact.labelsToApply) || artifact.labelsToApply.length === 0) missing.push("labelsToApply");
  if (!Array.isArray(artifact.sourcePacketTraceability) || artifact.sourcePacketTraceability.length === 0) missing.push("sourcePacketTraceability");
  if (artifact.decision?.githubIssuesCreated !== false) missing.push("decision.githubIssuesCreated.false");
  if (artifact.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (artifact.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (artifact.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Phase issue publisher dry-run artifact missing required fields: ${missing.join(", ")}`);
}

function approvalFactors() {
  return [
    "phaseIssueCompleteness",
    "sourcePacketTraceability",
    "phaseOrderClarity",
    "labelSafety",
    "guardrailCompleteness",
    "acceptanceCriteriaCompleteness",
    "automaticCodexBuildSafety",
    "secretAndEnvSafety",
    "resourceAndReleaseSafety",
    "boundedReviewability"
  ];
}

function approvalStatuses() {
  return ["approved_for_issue_publish", "needs_revision", "rejected", "blocked_by_security", "blocked_by_cost", "blocked_by_scope"];
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

function approvalRequiredGuardrails() {
  return {
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
  };
}

function requiredGuardrails() {
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

function uniqueLabels(payloads) {
  return [...new Set(payloads.flatMap((payload) => payload.labels))];
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
