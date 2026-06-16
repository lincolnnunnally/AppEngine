import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.PHASE_START_APPROVAL_INPUT || "";
const artifactOutput = process.env.PHASE_START_APPROVAL_OUTPUT || "";
const markdownOutput = process.env.PHASE_START_APPROVAL_MARKDOWN_OUTPUT || "";
const followUpsOutput = process.env.PHASE_START_APPROVAL_FOLLOWUPS_OUTPUT || "";

const input = readInput(inputPath);
const registry = input.publishedPhaseIssueRegistry || input.published_phase_issue_registry || input.registry || input;
const startRequest = input.phaseStartApproval || input.phase_start_approval || input.startRequest || input.start_request || {};
const approval = buildPhaseStartApproval(registry, startRequest);

validatePhaseStartApproval(approval);

if (artifactOutput) writeJson(artifactOutput, approval);
if (markdownOutput) writeText(markdownOutput, renderApprovalMarkdown(approval));
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks: approval.followUpTasks });

console.log(`phase-start-approval ok: ${approval.candidate.slug} -> ${approval.approvalStatus}`);
console.log(`next safe action: ${approval.decision.nextSafeAction}`);

function buildPhaseStartApproval(registry, startRequest) {
  validatePublishedPhaseIssueRegistry(registry);

  const normalizedRequest = normalizeStartRequest(startRequest, registry);
  const targetIssue = findTargetIssue(registry, normalizedRequest);
  const approvalChecks = buildApprovalChecks({ registry, targetIssue, startRequest: normalizedRequest });
  const approvalStatus = approvalStatusFor(approvalChecks);
  const nextSafeAction = nextSafeActionFor(approvalStatus);

  const approval = {
    kind: "phase_start_approval",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "published_phase_issue_registry",
      candidateSlug: registry.candidate.slug,
      candidateType: registry.candidate.type,
      finalPacketType: registry.sourceArtifact.finalPacketType,
      registryStatus: registry.currentStatus
    },
    candidate: {
      name: registry.candidate.name,
      slug: registry.candidate.slug,
      type: registry.candidate.type,
      summary: registry.candidate.summary,
      needAddressed: registry.candidate.needAddressed,
      desiredTransformation: registry.candidate.desiredTransformation
    },
    sourcePacket: {
      kind: registry.sourcePacket.kind,
      status: registry.sourcePacket.status
    },
    targetIssue: targetIssue || missingTargetIssue(normalizedRequest),
    approvalStatus,
    approvalChecks,
    phaseOrder: registry.phaseOrder,
    completedPhases: normalizedRequest.completedPhases,
    notRequiredPhases: normalizedRequest.notRequiredPhases,
    ownerApprovalNotes: normalizedRequest.ownerApprovalNotes,
    decision: {
      approvedForManualPhaseStart: approvalStatus === "approved_for_manual_phase_start",
      nextSafeAction,
      labelsAdded: false,
      executionLabelsApproved: false,
      codexBuildTriggered: false,
      ownerApprovalRequiredForLabeling: true,
      reason: decisionReasonFor({ approvalStatus, targetIssue, startRequest: normalizedRequest })
    },
    ownerReadableReport: "",
    followUpTasks: [],
    guardrails: requiredGuardrails()
  };

  approval.ownerReadableReport = renderOwnerReport(approval);
  approval.followUpTasks = buildFollowUpTasks(approval);

  return approval;
}

function validatePublishedPhaseIssueRegistry(registry) {
  const missing = [];

  for (const [label, value] of [
    ["kind", registry.kind],
    ["schemaVersion", registry.schemaVersion],
    ["sourceArtifact.kind", registry.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", registry.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", registry.sourceArtifact?.candidateType],
    ["sourceArtifact.finalPacketType", registry.sourceArtifact?.finalPacketType],
    ["sourcePacket.kind", registry.sourcePacket?.kind],
    ["sourcePacket.status", registry.sourcePacket?.status],
    ["candidate.name", registry.candidate?.name],
    ["candidate.slug", registry.candidate?.slug],
    ["candidate.type", registry.candidate?.type],
    ["currentStatus", registry.currentStatus],
    ["nextSafeAction", registry.nextSafeAction],
    ["ownerReadableReport", registry.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (registry.kind !== "published_phase_issue_registry") missing.push("kind.published_phase_issue_registry");
  if (registry.sourceArtifact?.kind !== "phase_issue_publisher_manual") missing.push("sourceArtifact.kind.phase_issue_publisher_manual");
  if (!finalPacketTypes().includes(registry.sourcePacket?.kind)) missing.push("sourcePacket.kind.allowed");
  if (!Array.isArray(registry.publishedIssues) || registry.publishedIssues.length === 0) missing.push("publishedIssues");
  if (!Array.isArray(registry.phaseOrder) || registry.phaseOrder.length === 0) missing.push("phaseOrder");
  if (!Array.isArray(registry.issueLabels) || registry.issueLabels.length === 0) missing.push("issueLabels");
  if (registry.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (registry.decision?.labelsAddedByRegistry !== false) missing.push("decision.labelsAddedByRegistry.false");
  if (registry.guardrails?.registryOnly !== true) missing.push("guardrails.registryOnly");

  for (const [label, value] of Object.entries(registryRequiredGuardrails())) {
    if (registry.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  for (const issue of registry.publishedIssues || []) {
    if (unsafeLabelFindings(issue.labels || []).length) missing.push(`publishedIssues.${issue.issueNumber || "unknown"}.labels.executionLabel`);
  }

  if (missing.length) throw new Error(`Cannot approve phase start: missing ${missing.join(", ")}`);
}

function normalizeStartRequest(startRequest, registry) {
  const targetIssueNumber = numberOrNull(startRequest.targetIssueNumber ?? startRequest.issueNumber ?? startRequest.issue_number);
  const targetPhase = firstKnown([startRequest.targetPhase, startRequest.phase, registry.publishedIssues?.[0]?.phase, ""]);

  return {
    targetIssueNumber,
    targetPhase,
    completedPhases: normalizeStrings(startRequest.completedPhases || startRequest.completed_phases || []),
    notRequiredPhases: normalizeStrings(startRequest.notRequiredPhases || startRequest.not_required_phases || []),
    acceptanceCriteriaPresent: startRequest.acceptanceCriteriaPresent === true || startRequest.acceptance_criteria_present === true,
    ownerApprovalNotes: firstKnown([startRequest.ownerApprovalNotes, startRequest.owner_approval_notes, startRequest.notes, ""]),
    riskReview: {
      noSecretsEnvRisk: startRequest.riskReview?.noSecretsEnvRisk === true || startRequest.risk_review?.no_secrets_env_risk === true,
      noMigrationRisk: startRequest.riskReview?.noMigrationRisk === true || startRequest.risk_review?.no_migration_risk === true,
      noProductionDeployRisk: startRequest.riskReview?.noProductionDeployRisk === true || startRequest.risk_review?.no_production_deploy_risk === true,
      noPaidResourceRisk: startRequest.riskReview?.noPaidResourceRisk === true || startRequest.risk_review?.no_paid_resource_risk === true
    },
    manualStatus: startRequest.status || startRequest.approvalStatus || startRequest.approval_status || ""
  };
}

function findTargetIssue(registry, startRequest) {
  if (startRequest.targetIssueNumber) {
    return registry.publishedIssues.find((issue) => Number(issue.issueNumber) === startRequest.targetIssueNumber) || null;
  }

  return registry.publishedIssues.find((issue) => issue.phase === startRequest.targetPhase) || null;
}

function missingTargetIssue(startRequest) {
  return {
    issueNumber: startRequest.targetIssueNumber || null,
    url: "",
    title: "",
    phase: startRequest.targetPhase || "",
    phaseOrder: null,
    labels: []
  };
}

function buildApprovalChecks({ registry, targetIssue, startRequest }) {
  const checks = {
    issueExistsInRegistry: checkIssueExists(targetIssue),
    phaseOrderRespected: checkPhaseOrder(registry, targetIssue, startRequest),
    previousRequiredPhasesComplete: checkPreviousPhases(registry, targetIssue, startRequest),
    guardrailsPresent: checkGuardrails(registry, targetIssue),
    acceptanceCriteriaPresent: checkAcceptanceCriteria(startRequest),
    riskSafety: checkRiskSafety(startRequest),
    ownerApprovalNotesPresent: checkOwnerNotes(startRequest)
  };

  if (startRequest.manualStatus && startRequest.manualStatus !== "approved_for_manual_phase_start") {
    checks.ownerApprovalNotesPresent = {
      status: normalizeApprovalStatus(startRequest.manualStatus),
      notes: startRequest.ownerApprovalNotes || `Owner/start request set status ${startRequest.manualStatus}.`
    };
  }

  return checks;
}

function checkIssueExists(targetIssue) {
  if (!targetIssue) {
    return {
      status: "needs_revision",
      notes: "Target issue does not exist in the published phase issue registry."
    };
  }

  return {
    status: "pass",
    notes: "Target issue exists in the published phase issue registry."
  };
}

function checkPhaseOrder(registry, targetIssue, startRequest) {
  if (!targetIssue) return { status: "needs_revision", notes: "Phase order cannot be verified until the target issue exists." };
  if (!registry.phaseOrder.includes(targetIssue.phase)) return { status: "needs_revision", notes: "Target phase is not present in registry phaseOrder." };

  const targetIndex = registry.phaseOrder.indexOf(targetIssue.phase);
  const priorPhases = registry.phaseOrder.slice(0, targetIndex);
  const satisfied = new Set([...startRequest.completedPhases, ...startRequest.notRequiredPhases]);
  const missing = priorPhases.filter((phase) => !satisfied.has(phase));

  if (missing.length) {
    return {
      status: "needs_revision",
      notes: `Previous phases must be completed or marked not required first: ${missing.join(", ")}.`
    };
  }

  return {
    status: "pass",
    notes: targetIndex === 0 ? "Target phase is first in phase order." : "Previous phases are complete or marked not required."
  };
}

function checkPreviousPhases(registry, targetIssue, startRequest) {
  return checkPhaseOrder(registry, targetIssue, startRequest);
}

function checkGuardrails(registry, targetIssue) {
  const missing = [];

  if (registry.guardrails?.registryOnly !== true) missing.push("registryOnly");
  if (registry.guardrails?.noCodexBuildTriggered !== true) missing.push("registry.noCodexBuildTriggered");
  if (targetIssue?.guardrails?.noCodexBuildTriggered !== true) missing.push("target.noCodexBuildTriggered");
  if (targetIssue?.guardrails?.noProductionDeploy !== true) missing.push("target.noProductionDeploy");
  if (targetIssue?.guardrails?.noPaidResources !== true) missing.push("target.noPaidResources");
  if (targetIssue?.guardrails?.noMigrations !== true) missing.push("target.noMigrations");

  if (missing.length) {
    return {
      status: "needs_revision",
      notes: `Missing guardrails: ${missing.join(", ")}.`
    };
  }

  return {
    status: "pass",
    notes: "Registry and target issue guardrails are present."
  };
}

function checkAcceptanceCriteria(startRequest) {
  if (!startRequest.acceptanceCriteriaPresent) {
    return {
      status: "needs_revision",
      notes: "Acceptance criteria must be confirmed before phase start approval."
    };
  }

  return {
    status: "pass",
    notes: "Acceptance criteria are confirmed present."
  };
}

function checkRiskSafety(startRequest) {
  const risks = [];
  if (!startRequest.riskReview.noSecretsEnvRisk) risks.push(["blocked_by_security", "secrets/env risk is not cleared"]);
  if (!startRequest.riskReview.noMigrationRisk) risks.push(["blocked_by_security", "migration risk is not cleared"]);
  if (!startRequest.riskReview.noProductionDeployRisk) risks.push(["blocked_by_scope", "production deploy risk is not cleared"]);
  if (!startRequest.riskReview.noPaidResourceRisk) risks.push(["blocked_by_cost", "paid-resource risk is not cleared"]);

  if (risks.length) {
    return {
      status: statusFromFindings(risks.map(([status]) => ({ status }))),
      notes: risks.map(([, note]) => note).join("; ")
    };
  }

  return {
    status: "pass",
    notes: "Secrets/env, migration, production deploy, and paid-resource risks remain blocked."
  };
}

function checkOwnerNotes(startRequest) {
  if (!isPresent(startRequest.ownerApprovalNotes)) {
    return {
      status: "needs_revision",
      notes: "Owner approval notes are required before phase start approval."
    };
  }

  return {
    status: "pass",
    notes: startRequest.ownerApprovalNotes
  };
}

function approvalStatusFor(checks) {
  return statusFromFindings(Object.values(checks));
}

function statusFromFindings(items) {
  const order = ["blocked_by_security", "blocked_by_cost", "blocked_by_scope", "rejected", "needs_revision"];
  for (const status of order) {
    if (items.some((item) => item.status === status)) return status;
  }
  return "approved_for_manual_phase_start";
}

function nextSafeActionFor(status) {
  const map = {
    approved_for_manual_phase_start: "await_manual_execution_label",
    needs_revision: "revise_phase_start_request",
    rejected: "record_phase_start_rejection",
    blocked_by_security: "create_security_review_issue",
    blocked_by_cost: "create_cost_review_issue",
    blocked_by_scope: "create_scope_review_issue"
  };

  return map[status] || "revise_phase_start_request";
}

function decisionReasonFor({ approvalStatus, targetIssue, startRequest }) {
  if (approvalStatus === "approved_for_manual_phase_start") {
    return `Issue #${targetIssue.issueNumber} may receive a manual execution label later after owner action.`;
  }
  if (!targetIssue) return "Target issue was not found in the published phase issue registry.";
  if (!startRequest.ownerApprovalNotes) return "Owner approval notes are missing.";
  return `Phase start approval returned ${approvalStatus}.`;
}

function buildFollowUpTasks(approval) {
  if (approval.approvalStatus === "approved_for_manual_phase_start") return [];

  return [
    {
      title: `[${approval.candidate.slug}] Resolve phase start approval: ${approval.targetIssue.phase || approval.targetIssue.issueNumber || "unknown phase"}`,
      labels: ["ai:plan"],
      body: [
        `Source artifact: phase_start_approval`,
        `Candidate: ${approval.candidate.name}`,
        `Target issue: ${approval.targetIssue.issueNumber ? `#${approval.targetIssue.issueNumber}` : "unknown"}`,
        `Status: ${approval.approvalStatus}`,
        "",
        "## Required Source Of Truth To Load",
        "- source-of-truth/phase-start-approval-gate.md",
        "- source-of-truth/published-phase-issue-registry.md",
        "",
        "## Guardrails",
        "- Do not add labels yet.",
        "- Do not trigger Codex build work.",
        "- Do not deploy production.",
        "- Do not create paid resources.",
        "- Do not apply migrations.",
        "- Do not change secrets or env vars."
      ].join("\n")
    }
  ];
}

function validatePhaseStartApproval(approval) {
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
    ["sourcePacket.kind", approval.sourcePacket?.kind],
    ["sourcePacket.status", approval.sourcePacket?.status],
    ["targetIssue.phase", approval.targetIssue?.phase],
    ["approvalStatus", approval.approvalStatus],
    ["decision.nextSafeAction", approval.decision?.nextSafeAction],
    ["ownerReadableReport", approval.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (approval.kind !== "phase_start_approval") missing.push("kind.phase_start_approval");
  if (approval.sourceArtifact?.kind !== "published_phase_issue_registry") missing.push("sourceArtifact.kind.published_phase_issue_registry");
  if (!approvalStatuses().includes(approval.approvalStatus)) missing.push("approvalStatus.allowed");
  if (!Array.isArray(approval.phaseOrder) || approval.phaseOrder.length === 0) missing.push("phaseOrder");
  if (!Array.isArray(approval.completedPhases)) missing.push("completedPhases");
  if (!Array.isArray(approval.notRequiredPhases)) missing.push("notRequiredPhases");
  if (approval.decision?.labelsAdded !== false) missing.push("decision.labelsAdded.false");
  if (approval.decision?.executionLabelsApproved !== false) missing.push("decision.executionLabelsApproved.false");
  if (approval.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (approval.decision?.ownerApprovalRequiredForLabeling !== true) missing.push("decision.ownerApprovalRequiredForLabeling");

  for (const factor of approvalFactors()) {
    if (!approval.approvalChecks?.[factor]?.status) missing.push(`approvalChecks.${factor}.status`);
    if (!isPresent(approval.approvalChecks?.[factor]?.notes)) missing.push(`approvalChecks.${factor}.notes`);
    if (!approvalCheckStatuses().includes(approval.approvalChecks?.[factor]?.status)) missing.push(`approvalChecks.${factor}.status.allowed`);
  }

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (approval.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (approval.targetIssue.labels?.some((label) => executionLabels().has(label))) missing.push("targetIssue.labels.executionLabelsBlocked");

  if (missing.length) throw new Error(`Phase start approval artifact missing required fields: ${missing.join(", ")}`);
}

function renderOwnerReport(approval) {
  return [
    "Phase Start Approval",
    "",
    `Candidate: ${approval.candidate.name}`,
    `Target issue: ${approval.targetIssue.issueNumber ? `#${approval.targetIssue.issueNumber}` : "not found"}`,
    `Target phase: ${approval.targetIssue.phase || "unknown"}`,
    `Status: ${approval.approvalStatus}`,
    `Next safe action: ${approval.decision.nextSafeAction}`,
    "Labels added: no",
    "Codex build triggered: no",
    "",
    "Checks:",
    ...Object.entries(approval.approvalChecks).map(([key, value]) => `- ${key}: ${value.status} - ${value.notes}`),
    "",
    "Guardrails: approval gate only, no label changes, no Codex build, no deploy"
  ].join("\n");
}

function renderApprovalMarkdown(approval) {
  return `${approval.ownerReadableReport}\n`;
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

function approvalStatuses() {
  return ["approved_for_manual_phase_start", ...approvalCheckStatuses().filter((status) => status !== "pass")];
}

function approvalCheckStatuses() {
  return ["pass", "needs_revision", "rejected", "blocked_by_security", "blocked_by_cost", "blocked_by_scope"];
}

function normalizeApprovalStatus(value) {
  const normalized = String(value || "").trim();
  if (approvalCheckStatuses().includes(normalized)) return normalized;
  return "needs_revision";
}

function registryRequiredGuardrails() {
  return {
    registryOnly: true,
    noUi: true,
    noGithubIssuesCreated: true,
    noLabelsAdded: true,
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

function unsafeLabelFindings(labels) {
  return labels.filter((label) => executionLabels().has(label));
}

function executionLabels() {
  return new Set(["ai:build", "ai:fix"]);
}

function finalPacketTypes() {
  return ["app_build_packet", "vnext_packet", "non_app_solution_plan"];
}

function normalizeStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .map((value) => String(value || "").trim())
    .filter(Boolean))];
}

function firstKnown(values) {
  for (const value of values) {
    if (isPresent(value)) return value;
  }
  return "";
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
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
