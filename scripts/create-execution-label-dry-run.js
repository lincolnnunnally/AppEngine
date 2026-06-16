import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.EXECUTION_LABEL_DRY_RUN_INPUT || "";
const artifactOutput = process.env.EXECUTION_LABEL_DRY_RUN_OUTPUT || "";
const markdownOutput = process.env.EXECUTION_LABEL_DRY_RUN_MARKDOWN_OUTPUT || "";
const labelsOutput = process.env.EXECUTION_LABEL_DRY_RUN_LABELS_OUTPUT || "";

const input = readInput(inputPath);
const approval = input.phaseStartApproval || input.phase_start_approval || input.approval || input;
const labelRequest = input.executionLabelDryRun || input.execution_label_dry_run || input.labelRequest || input.label_request || {};
const dryRun = buildExecutionLabelDryRun(approval, labelRequest);

validateExecutionLabelDryRun(dryRun);

if (artifactOutput) writeJson(artifactOutput, dryRun);
if (markdownOutput) writeText(markdownOutput, renderDryRunMarkdown(dryRun));
if (labelsOutput) writeJson(labelsOutput, { currentLabels: dryRun.currentLabels, proposedLabels: dryRun.proposedLabels, labelsToAdd: dryRun.labelsToAdd, labelsExplicitlyBlocked: dryRun.labelsExplicitlyBlocked });

console.log(`execution-label-dry-run ok: issue #${dryRun.targetIssue.issueNumber} -> ${dryRun.decision.dryRunStatus}`);
console.log(`next safe action: ${dryRun.decision.nextSafeAction}`);

function buildExecutionLabelDryRun(approval, labelRequest) {
  validatePhaseStartApprovalInput(approval);

  const currentLabels = uniqueLabels(approval.targetIssue.labels || []);
  const requestedLabels = normalizeRequestedLabels(labelRequest);
  const labelPlan = planLabelChanges({ currentLabels, requestedLabels });

  const dryRun = {
    kind: "execution_label_dry_run",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "phase_start_approval",
      candidateSlug: approval.candidate.slug,
      candidateType: approval.candidate.type,
      finalPacketType: approval.sourceArtifact.finalPacketType,
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
    targetIssue: {
      issueNumber: approval.targetIssue.issueNumber,
      url: approval.targetIssue.url,
      title: approval.targetIssue.title,
      phase: approval.targetIssue.phase,
      phaseOrder: approval.targetIssue.phaseOrder
    },
    currentLabels,
    requestedLabels,
    proposedLabels: labelPlan.proposedLabels,
    labelsToAdd: labelPlan.labelsToAdd,
    labelsAlreadyPresent: labelPlan.labelsAlreadyPresent,
    labelsExplicitlyBlocked: labelPlan.labelsExplicitlyBlocked,
    safetyReason: safetyReasonFor(labelPlan),
    decision: {
      dryRunStatus: "label_changes_ready_for_owner_review",
      nextSafeAction: "review_execution_label_dry_run",
      labelsApplied: false,
      codexBuildTriggered: false,
      ownerApprovalRequiredForLabeling: true,
      reason: "Approved phase start was converted into a label-change preview only."
    },
    ownerReadableReport: "",
    guardrails: requiredGuardrails()
  };

  dryRun.ownerReadableReport = renderOwnerReport(dryRun);

  return dryRun;
}

function validatePhaseStartApprovalInput(approval) {
  const missing = [];

  for (const [label, value] of [
    ["kind", approval.kind],
    ["schemaVersion", approval.schemaVersion],
    ["sourceArtifact.kind", approval.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", approval.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", approval.sourceArtifact?.candidateType],
    ["sourceArtifact.finalPacketType", approval.sourceArtifact?.finalPacketType],
    ["candidate.name", approval.candidate?.name],
    ["candidate.slug", approval.candidate?.slug],
    ["candidate.type", approval.candidate?.type],
    ["targetIssue.issueNumber", approval.targetIssue?.issueNumber],
    ["targetIssue.url", approval.targetIssue?.url],
    ["targetIssue.phase", approval.targetIssue?.phase],
    ["targetIssue.phaseOrder", approval.targetIssue?.phaseOrder],
    ["approvalStatus", approval.approvalStatus],
    ["decision.nextSafeAction", approval.decision?.nextSafeAction],
    ["ownerReadableReport", approval.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (approval.kind !== "phase_start_approval") missing.push("kind.phase_start_approval");
  if (approval.sourceArtifact?.kind !== "published_phase_issue_registry") missing.push("sourceArtifact.kind.published_phase_issue_registry");
  if (approval.approvalStatus !== "approved_for_manual_phase_start") {
    throw new Error(`Cannot dry-run execution labels: approvalStatus ${approval.approvalStatus || "missing"} is not approved_for_manual_phase_start`);
  }
  if (approval.decision?.approvedForManualPhaseStart !== true) missing.push("decision.approvedForManualPhaseStart.true");
  if (approval.decision?.labelsAdded !== false) missing.push("decision.labelsAdded.false");
  if (approval.decision?.executionLabelsApproved !== false) missing.push("decision.executionLabelsApproved.false");
  if (approval.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (!Array.isArray(approval.targetIssue?.labels) || approval.targetIssue.labels.length === 0) missing.push("targetIssue.labels");
  if (!isGithubIssueUrl(approval.targetIssue?.url)) missing.push("targetIssue.url.githubIssue");
  if (approval.guardrails?.approvalGateOnly !== true) missing.push("guardrails.approvalGateOnly");

  for (const factor of approvalFactors()) {
    if (!approval.approvalChecks?.[factor]?.status) missing.push(`approvalChecks.${factor}.status`);
    if (!isPresent(approval.approvalChecks?.[factor]?.notes)) missing.push(`approvalChecks.${factor}.notes`);
    if (approval.approvalChecks?.[factor]?.status !== "pass") missing.push(`approvalChecks.${factor}.pass`);
  }

  for (const [label, value] of Object.entries(approvalRequiredGuardrails())) {
    if (approval.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Cannot dry-run execution labels: missing ${missing.join(", ")}`);
}

function normalizeRequestedLabels(labelRequest) {
  const requested =
    labelRequest.requestedLabels ||
    labelRequest.requested_labels ||
    labelRequest.proposedLabels ||
    labelRequest.proposed_labels ||
    labelRequest.labelsToAdd ||
    labelRequest.labels_to_add ||
    ["ai:build"];

  return uniqueLabels(Array.isArray(requested) ? requested : [requested]);
}

function planLabelChanges({ currentLabels, requestedLabels }) {
  const allowed = allowedExecutionLabels();
  const blocked = blockedExecutionLabels();
  const labelsExplicitlyBlocked = [];
  const labelsToAdd = [];
  const labelsAlreadyPresent = [];

  for (const label of requestedLabels) {
    if (blocked.has(label) || !allowed.has(label)) {
      labelsExplicitlyBlocked.push(label);
      continue;
    }

    if (currentLabels.includes(label)) {
      labelsAlreadyPresent.push(label);
      continue;
    }

    labelsToAdd.push(label);
  }

  return {
    proposedLabels: uniqueLabels([...currentLabels, ...labelsToAdd]),
    labelsToAdd,
    labelsAlreadyPresent,
    labelsExplicitlyBlocked: uniqueLabels(labelsExplicitlyBlocked)
  };
}

function validateExecutionLabelDryRun(dryRun) {
  const missing = [];

  for (const [label, value] of [
    ["kind", dryRun.kind],
    ["schemaVersion", dryRun.schemaVersion],
    ["sourceArtifact.kind", dryRun.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", dryRun.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", dryRun.sourceArtifact?.candidateType],
    ["sourceArtifact.finalPacketType", dryRun.sourceArtifact?.finalPacketType],
    ["targetIssue.issueNumber", dryRun.targetIssue?.issueNumber],
    ["targetIssue.url", dryRun.targetIssue?.url],
    ["targetIssue.phase", dryRun.targetIssue?.phase],
    ["targetIssue.phaseOrder", dryRun.targetIssue?.phaseOrder],
    ["safetyReason", dryRun.safetyReason],
    ["decision.dryRunStatus", dryRun.decision?.dryRunStatus],
    ["decision.nextSafeAction", dryRun.decision?.nextSafeAction],
    ["ownerReadableReport", dryRun.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (dryRun.kind !== "execution_label_dry_run") missing.push("kind.execution_label_dry_run");
  if (dryRun.sourceArtifact?.kind !== "phase_start_approval") missing.push("sourceArtifact.kind.phase_start_approval");
  if (dryRun.sourceArtifact?.approvalStatus !== "approved_for_manual_phase_start") missing.push("sourceArtifact.approvalStatus.approved");
  if (!Array.isArray(dryRun.currentLabels) || dryRun.currentLabels.length === 0) missing.push("currentLabels");
  if (!Array.isArray(dryRun.requestedLabels) || dryRun.requestedLabels.length === 0) missing.push("requestedLabels");
  if (!Array.isArray(dryRun.proposedLabels) || dryRun.proposedLabels.length === 0) missing.push("proposedLabels");
  if (!Array.isArray(dryRun.labelsToAdd)) missing.push("labelsToAdd");
  if (!Array.isArray(dryRun.labelsExplicitlyBlocked)) missing.push("labelsExplicitlyBlocked");
  if (dryRun.decision?.labelsApplied !== false) missing.push("decision.labelsApplied.false");
  if (dryRun.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (dryRun.decision?.ownerApprovalRequiredForLabeling !== true) missing.push("decision.ownerApprovalRequiredForLabeling");
  if (!isGithubIssueUrl(dryRun.targetIssue?.url)) missing.push("targetIssue.url.githubIssue");

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (dryRun.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Execution label dry-run artifact missing required fields: ${missing.join(", ")}`);
}

function renderOwnerReport(dryRun) {
  return [
    "Execution Label Dry Run",
    "",
    `Target issue: #${dryRun.targetIssue.issueNumber}`,
    `URL: ${dryRun.targetIssue.url}`,
    `Current labels: ${dryRun.currentLabels.join(", ")}`,
    `Requested labels: ${dryRun.requestedLabels.join(", ")}`,
    `Proposed labels: ${dryRun.proposedLabels.join(", ")}`,
    `Labels to add later: ${dryRun.labelsToAdd.length ? dryRun.labelsToAdd.join(", ") : "none"}`,
    `Labels explicitly blocked: ${dryRun.labelsExplicitlyBlocked.length ? dryRun.labelsExplicitlyBlocked.join(", ") : "none"}`,
    `Safety reason: ${dryRun.safetyReason}`,
    `Next safe action: ${dryRun.decision.nextSafeAction}`,
    "Labels applied: no",
    "Codex build triggered: no",
    "",
    "Guardrails: dry-run only, no label changes, no Codex build, no deploy"
  ].join("\n");
}

function renderDryRunMarkdown(dryRun) {
  return `${dryRun.ownerReadableReport}\n`;
}

function safetyReasonFor(labelPlan) {
  const base = "Dry-run only. No labels were applied and Codex was not triggered.";
  if (labelPlan.labelsExplicitlyBlocked.length) {
    return `${base} Blocked labels were reported for owner review.`;
  }
  return base;
}

function approvalFactors() {
  return [
    "issueExistsInRegistry",
    "phaseOrderRespected",
    "previousRequiredPhasesComplete",
    "guardrailsPresent",
    "acceptanceCriteriaPresent",
    "riskSafety",
    "ownerApprovalNotesPresent"
  ];
}

function allowedExecutionLabels() {
  return new Set((process.env.APPENGINE_EXECUTION_LABEL_DRY_RUN_ALLOWED_LABELS || "ai:build")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean));
}

function blockedExecutionLabels() {
  return new Set(["ai:fix"]);
}

function approvalRequiredGuardrails() {
  return {
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
  };
}

function requiredGuardrails() {
  return {
    dryRunOnly: true,
    noLabelChanges: true,
    noCodexBuildTriggered: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noGeneratedCodeAutoMerge: true
  };
}

function isGithubIssueUrl(value) {
  return /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/\d+$/i.test(String(value || ""));
}

function uniqueLabels(values) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .map((value) => String(value || "").trim())
    .filter(Boolean))];
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
