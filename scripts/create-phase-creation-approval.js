import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.PHASE_CREATION_APPROVAL_INPUT || "";
const artifactOutput = process.env.PHASE_CREATION_APPROVAL_OUTPUT || "";
const markdownOutput = process.env.PHASE_CREATION_APPROVAL_MARKDOWN_OUTPUT || "";
const followUpsOutput = process.env.PHASE_CREATION_APPROVAL_FOLLOWUPS_OUTPUT || "";

const input = readInput(inputPath);
const materialization = input.finalPacketMaterialization || input.final_packet_materialization || input.materialization || input;
const approvalInput = input.phaseCreationApproval || input.phase_creation_approval || input.approval || materialization.approval || {};
const approval = buildPhaseCreationApproval(materialization, approvalInput);

validatePhaseCreationApproval(approval);

if (artifactOutput) writeJson(artifactOutput, approval);
if (markdownOutput) writeText(markdownOutput, renderApprovalMarkdown(approval));
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks: approval.followUpTasks });

console.log(`phase-creation-approval ok: ${approval.candidate.slug} -> ${approval.approvalStatus}`);
console.log(`next safe action: ${approval.decision.nextSafeAction}`);

function buildPhaseCreationApproval(materialization, approvalInput) {
  validateFinalPacketMaterialization(materialization);

  const approvalChecks = buildApprovalChecks(approvalInput);
  const approvalStatus = approvalStatusFor(approvalChecks);
  const nextSafeAction = nextSafeActionFor(approvalStatus);

  const approval = {
    kind: "phase_creation_approval",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "final_packet_materialization",
      candidateSlug: materialization.candidate.slug,
      candidateType: materialization.candidate.type,
      finalPacketType: materialization.finalPacketType
    },
    candidate: {
      name: materialization.candidate.name,
      slug: materialization.candidate.slug,
      type: materialization.candidate.type,
      summary: materialization.candidate.summary,
      needAddressed: materialization.candidate.needAddressed,
      desiredTransformation: materialization.candidate.desiredTransformation
    },
    finalPacket: {
      kind: materialization.finalPacket.kind,
      status: materialization.finalPacket.status
    },
    approvalStatus,
    approvalChecks,
    decision: {
      approvedForPhaseCreation: approvalStatus === "approved_for_phase_creation",
      nextSafeAction,
      phaseIssuesCreated: false,
      codexBuildTriggered: false,
      ownerApprovalRequired: true,
      reason: decisionReasonFor({ materialization, approvalStatus })
    },
    ownerReadableReport: "",
    followUpTasks: [],
    guardrails: requiredGuardrails()
  };

  approval.ownerReadableReport = renderOwnerReport(approval);
  approval.followUpTasks = buildFollowUpTasks(approval);

  return approval;
}

function validateFinalPacketMaterialization(materialization) {
  const missing = [];

  for (const [label, value] of [
    ["kind", materialization.kind],
    ["schemaVersion", materialization.schemaVersion],
    ["sourceArtifact.kind", materialization.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", materialization.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", materialization.sourceArtifact?.candidateType],
    ["sourceArtifact.approvalStatus", materialization.sourceArtifact?.approvalStatus],
    ["sourceArtifact.approvedDraftKind", materialization.sourceArtifact?.approvedDraftKind],
    ["candidate.name", materialization.candidate?.name],
    ["candidate.slug", materialization.candidate?.slug],
    ["candidate.type", materialization.candidate?.type],
    ["candidate.summary", materialization.candidate?.summary],
    ["candidate.needAddressed", materialization.candidate?.needAddressed],
    ["candidate.desiredTransformation", materialization.candidate?.desiredTransformation],
    ["finalPacketType", materialization.finalPacketType],
    ["finalPacket.kind", materialization.finalPacket?.kind],
    ["finalPacket.status", materialization.finalPacket?.status],
    ["decision.materializationStatus", materialization.decision?.materializationStatus],
    ["decision.nextSafeAction", materialization.decision?.nextSafeAction],
    ["ownerReadableReport", materialization.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (materialization.kind !== "final_packet_materialization") missing.push("kind.final_packet_materialization");
  if (materialization.sourceArtifact?.kind !== "packet_draft_approval") missing.push("sourceArtifact.kind.packet_draft_approval");
  if (materialization.sourceArtifact?.approvalStatus !== "approved_for_final_packet") missing.push("sourceArtifact.approvalStatus.approved");
  if (!finalPacketTypes().includes(materialization.finalPacketType)) missing.push("finalPacketType.allowed");
  if (materialization.finalPacket?.kind !== materialization.finalPacketType) missing.push("finalPacket.kind.matchesFinalPacketType");
  if (materialization.decision?.finalPacketCreated !== true) missing.push("decision.finalPacketCreated.true");
  if (materialization.decision?.phaseIssuesCreated !== false) missing.push("decision.phaseIssuesCreated.false");
  if (materialization.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (materialization.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");
  if (materialization.decision?.nextSafeAction !== "request_phase_creation_approval") missing.push("decision.nextSafeAction.request_phase_creation_approval");
  if (materialization.guardrails?.finalPacketCreationOnly !== true) missing.push("guardrails.finalPacketCreationOnly");

  for (const [label, value] of Object.entries(materializationRequiredGuardrails())) {
    if (materialization.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Cannot approve phase creation: missing ${missing.join(", ")}`);
}

function buildApprovalChecks(approvalInput) {
  const checksInput = approvalInput.approvalChecks || approvalInput.checks || approvalInput;
  const checks = {};
  const missing = [];

  for (const factor of approvalFactors()) {
    const check = checksInput[factor];
    if (!check) {
      missing.push(`approvalChecks.${factor}`);
      continue;
    }

    const status = normalizeCheckStatus(check.status);
    const notes = check.notes || check.reason || check.summary || "";

    if (!status) missing.push(`approvalChecks.${factor}.status`);
    if (!isPresent(notes)) missing.push(`approvalChecks.${factor}.notes`);

    checks[factor] = {
      status,
      notes
    };
  }

  if (missing.length) throw new Error(`Cannot approve phase creation: missing ${missing.join(", ")}`);

  return checks;
}

function approvalStatusFor(checks) {
  const statuses = Object.values(checks).map((check) => check.status);

  if (statuses.includes("blocked_by_security")) return "blocked_by_security";
  if (statuses.includes("blocked_by_cost")) return "blocked_by_cost";
  if (statuses.includes("blocked_by_scope")) return "blocked_by_scope";
  if (statuses.includes("rejected")) return "rejected";
  if (statuses.includes("needs_revision")) return "needs_revision";

  return "approved_for_phase_creation";
}

function renderOwnerReport(approval) {
  const failing = failingChecks(approval);
  const lines = [
    "Phase Creation Approval",
    "",
    `Candidate: ${approval.candidate.name}`,
    `Final packet type: ${approval.finalPacket.kind}`,
    `Status: ${approval.approvalStatus}`,
    `Next safe action: ${approval.decision.nextSafeAction}`,
    approval.decision.approvedForPhaseCreation
      ? "Owner approval recorded: yes, phase issues may be generated by a later explicit generator"
      : "Owner approval recorded: no, resolve the gate result before phase generation",
    "Guardrails: approval gate only, no phase issues, no build, no deploy"
  ];

  if (failing.length) {
    lines.push("", "Checks needing attention:");
    for (const check of failing) lines.push(`- ${check.factor}: ${check.status} - ${check.notes}`);
  }

  return lines.join("\n");
}

function renderApprovalMarkdown(artifact) {
  return `${artifact.ownerReadableReport}\n`;
}

function buildFollowUpTasks(approval) {
  const titleVerb = approval.approvalStatus === "approved_for_phase_creation" ? "Prepare phase issue generation" : "Resolve phase creation gate";
  const failing = failingChecks(approval);

  return [
    {
      title: `[${approval.candidate.slug}] ${titleVerb}`,
      recommendedLabel: "ai:plan",
      body: [
        `Review the phase creation approval gate for ${approval.candidate.name}.`,
        "",
        "## Candidate",
        `- Type: ${approval.candidate.type}`,
        `- Final packet type: ${approval.finalPacket.kind}`,
        `- Approval status: ${approval.approvalStatus}`,
        `- Next safe action: ${approval.decision.nextSafeAction}`,
        `- Need addressed: ${approval.candidate.needAddressed}`,
        `- Desired transformation: ${approval.candidate.desiredTransformation}`,
        "",
        "## Approval Checks",
        ...approvalFactors().map((factor) => `- ${factor}: ${approval.approvalChecks[factor].status} - ${approval.approvalChecks[factor].notes}`),
        "",
        "## Gate Result",
        approval.decision.approvedForPhaseCreation
          ? "- Phase creation is approved for a later explicit generator. Do not create phase issues in this gate."
          : `- Phase creation is not approved. Resolve: ${failing.map((check) => `${check.factor} (${check.status})`).join(", ") || approval.approvalStatus}.`,
        "",
        "## Required Source Of Truth To Load",
        "- source-of-truth/00-why-we-build.md",
        "- source-of-truth/01-ecosystem-philosophy.md",
        "- source-of-truth/02-global-principles.md",
        "- source-of-truth/03-life-produces-life.md",
        "- source-of-truth/04-app-purpose-rules.md",
        "- source-of-truth/05-ecosystem-design-gates.md",
        "- source-of-truth/problem-to-solution-intake-standard.md",
        "- source-of-truth/problem-portfolio-routing-standard.md",
        "- source-of-truth/solution-candidate-review-gate.md",
        "- source-of-truth/candidate-to-packet-bridge.md",
        "- source-of-truth/packet-draft-approval-gate.md",
        "- source-of-truth/final-packet-materialization.md",
        "- source-of-truth/phase-creation-approval-gate.md",
        "- source-of-truth/app-portfolio-registry.md",
        "",
        "## Guardrails",
        "- Approval gate only.",
        "- Do not build UI.",
        "- Do not create phase issues yet.",
        "- Do not trigger Codex build work.",
        "- Do not deploy production, create paid resources, apply migrations, add secrets/env vars, change repository visibility, or auto-merge generated app code."
      ].join("\n")
    }
  ];
}

function validatePhaseCreationApproval(artifact) {
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
    ["finalPacket.kind", artifact.finalPacket?.kind],
    ["finalPacket.status", artifact.finalPacket?.status],
    ["approvalStatus", artifact.approvalStatus],
    ["decision.nextSafeAction", artifact.decision?.nextSafeAction],
    ["ownerReadableReport", artifact.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (artifact.kind !== "phase_creation_approval") missing.push("kind.phase_creation_approval");
  if (artifact.sourceArtifact?.kind !== "final_packet_materialization") missing.push("sourceArtifact.kind.final_packet_materialization");
  if (!finalPacketTypes().includes(artifact.finalPacket?.kind)) missing.push("finalPacket.kind.allowed");
  if (artifact.sourceArtifact?.finalPacketType !== artifact.finalPacket?.kind) missing.push("finalPacket.kind.matchesSourceFinalPacketType");
  if (!approvalStatuses().includes(artifact.approvalStatus)) missing.push("approvalStatus.allowed");
  if (artifact.decision?.approvedForPhaseCreation !== (artifact.approvalStatus === "approved_for_phase_creation")) {
    missing.push("decision.approvedForPhaseCreation.matchesApprovalStatus");
  }
  if (artifact.decision?.phaseIssuesCreated !== false) missing.push("decision.phaseIssuesCreated.false");
  if (artifact.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (artifact.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");

  for (const factor of approvalFactors()) {
    if (!artifact.approvalChecks?.[factor]?.status) missing.push(`approvalChecks.${factor}.status`);
    if (!isPresent(artifact.approvalChecks?.[factor]?.notes)) missing.push(`approvalChecks.${factor}.notes`);
  }

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (artifact.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Phase creation approval artifact missing required fields: ${missing.join(", ")}`);
}

function failingChecks(approval) {
  return approvalFactors()
    .map((factor) => ({ factor, ...approval.approvalChecks[factor] }))
    .filter((check) => check.status !== "pass");
}

function decisionReasonFor({ materialization, approvalStatus }) {
  if (approvalStatus === "approved_for_phase_creation") {
    return `${materialization.finalPacketType} passed the phase creation approval gate, but this gate did not create phase issues.`;
  }

  return `${materialization.finalPacketType} did not pass the phase creation approval gate: ${approvalStatus}.`;
}

function nextSafeActionFor(status) {
  const actions = {
    approved_for_phase_creation: "prepare_phase_issue_generation",
    needs_revision: "create_final_packet_revision_issue",
    rejected: "record_phase_creation_rejection",
    blocked_by_security: "create_security_review_issue",
    blocked_by_cost: "create_cost_review_issue",
    blocked_by_scope: "create_scope_review_issue"
  };

  return actions[status] || "create_final_packet_revision_issue";
}

function normalizeCheckStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  const aliases = {
    approved: "pass",
    clear: "pass",
    ok: "pass",
    ready: "pass",
    yes: "pass",
    documented: "pass",
    pass: "pass",
    needs_changes: "needs_revision",
    needs_revision: "needs_revision",
    revision: "needs_revision",
    unclear: "needs_revision",
    missing: "needs_revision",
    rejected: "rejected",
    no: "rejected",
    not_approved: "rejected",
    blocked_by_security: "blocked_by_security",
    security_blocked: "blocked_by_security",
    privacy_blocked: "blocked_by_security",
    blocked_by_cost: "blocked_by_cost",
    cost_blocked: "blocked_by_cost",
    provider_blocked: "blocked_by_cost",
    paid_resource_blocked: "blocked_by_cost",
    blocked_by_scope: "blocked_by_scope",
    scope_blocked: "blocked_by_scope",
    too_broad: "blocked_by_scope"
  };

  return aliases[normalized] || "";
}

function approvalFactors() {
  return [
    "finalPacketCompleteness",
    "sourceOfTruthAlignment",
    "correctSolutionType",
    "phaseSequenceReadiness",
    "costProviderSafety",
    "securityPrivacySafety",
    "ownerApprovalNotes"
  ];
}

function approvalStatuses() {
  return ["approved_for_phase_creation", "needs_revision", "rejected", "blocked_by_security", "blocked_by_cost", "blocked_by_scope"];
}

function finalPacketTypes() {
  return ["app_build_packet", "vnext_packet", "non_app_solution_plan"];
}

function materializationRequiredGuardrails() {
  return {
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
  };
}

function requiredGuardrails() {
  return {
    approvalGateOnly: true,
    noUi: true,
    noPhaseIssuesCreated: true,
    noCodexBuildTriggered: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noGeneratedCodeAutoMerge: true
  };
}

function isPresent(value) {
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
