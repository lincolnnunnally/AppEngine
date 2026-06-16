import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.PACKET_DRAFT_APPROVAL_INPUT || "";
const artifactOutput = process.env.PACKET_DRAFT_APPROVAL_OUTPUT || "";
const markdownOutput = process.env.PACKET_DRAFT_APPROVAL_MARKDOWN_OUTPUT || "";
const followUpsOutput = process.env.PACKET_DRAFT_APPROVAL_FOLLOWUPS_OUTPUT || "";

const input = readInput(inputPath);
const bridge = input.candidatePacketBridge || input.candidate_packet_bridge || input.bridge || input;
const approvalInput = input.packetDraftApproval || input.packet_draft_approval || input.approval || bridge.approval || {};
const approval = buildPacketDraftApproval(bridge, approvalInput);

validatePacketDraftApproval(approval);

if (artifactOutput) writeJson(artifactOutput, approval);
if (markdownOutput) writeText(markdownOutput, renderApprovalMarkdown(approval));
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks: approval.followUpTasks });

console.log(`packet-draft-approval ok: ${approval.candidate.slug} -> ${approval.approvalStatus}`);
console.log(`next safe action: ${approval.decision.nextSafeAction}`);

function buildPacketDraftApproval(bridge, approvalInput) {
  validateCandidatePacketBridge(bridge);

  const approvalChecks = buildApprovalChecks(approvalInput);
  const approvalStatus = approvalStatusFor(approvalChecks);
  const finalPacketType = approvalStatus === "approved_for_final_packet" ? finalPacketTypeFor(bridge.selectedDraft.kind) : null;
  const nextSafeAction = nextSafeActionFor(approvalStatus);

  const approval = {
    kind: "packet_draft_approval",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "candidate_packet_bridge",
      candidateSlug: bridge.candidate.slug,
      candidateType: bridge.candidate.type,
      selectedDraftKind: bridge.selectedDraft.kind
    },
    candidate: {
      name: bridge.candidate.name,
      slug: bridge.candidate.slug,
      type: bridge.candidate.type,
      summary: bridge.candidate.summary,
      needAddressed: bridge.candidate.needAddressed,
      desiredTransformation: bridge.candidate.desiredTransformation
    },
    packetDraft: summarizePacketDraft(bridge.packetDraft),
    approvalStatus,
    approvalChecks,
    decision: {
      readyForFinalPacket: approvalStatus === "approved_for_final_packet",
      finalPacketType,
      nextSafeAction,
      finalPacketCreated: false,
      phaseIssuesCreated: false,
      codexBuildTriggered: false,
      ownerApprovalRequired: true,
      reason: decisionReasonFor({ bridge, approvalStatus })
    },
    ownerReadableReport: "",
    followUpTasks: [],
    guardrails: requiredGuardrails()
  };

  approval.ownerReadableReport = renderOwnerReport(approval);
  approval.followUpTasks = buildFollowUpTasks(approval);

  return approval;
}

function validateCandidatePacketBridge(bridge) {
  const missing = [];

  for (const [label, value] of [
    ["kind", bridge.kind],
    ["schemaVersion", bridge.schemaVersion],
    ["sourceArtifact.kind", bridge.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", bridge.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", bridge.sourceArtifact?.candidateType],
    ["sourceArtifact.readinessStatus", bridge.sourceArtifact?.readinessStatus],
    ["candidate.name", bridge.candidate?.name],
    ["candidate.slug", bridge.candidate?.slug],
    ["candidate.type", bridge.candidate?.type],
    ["candidate.summary", bridge.candidate?.summary],
    ["candidate.needAddressed", bridge.candidate?.needAddressed],
    ["candidate.desiredTransformation", bridge.candidate?.desiredTransformation],
    ["selectedDraft.kind", bridge.selectedDraft?.kind],
    ["selectedDraft.reason", bridge.selectedDraft?.reason],
    ["packetDraft.kind", bridge.packetDraft?.kind],
    ["packetDraft.status", bridge.packetDraft?.status],
    ["decision.bridgeStatus", bridge.decision?.bridgeStatus],
    ["decision.nextSafeAction", bridge.decision?.nextSafeAction],
    ["ownerReadableReport", bridge.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (bridge.kind !== "candidate_packet_bridge") missing.push("kind.candidate_packet_bridge");
  if (bridge.sourceArtifact?.kind !== "solution_candidate_review") missing.push("sourceArtifact.kind.solution_candidate_review");
  if (!packetDraftKinds().includes(bridge.selectedDraft?.kind)) missing.push("selectedDraft.kind.allowed");
  if (bridge.selectedDraft?.kind !== bridge.packetDraft?.kind) missing.push("packetDraft.kind.matchesSelectedDraft");
  if (bridge.selectedDraft?.ownerApprovalRequired !== true) missing.push("selectedDraft.ownerApprovalRequired");
  if (bridge.decision?.phaseIssuesCreated !== false) missing.push("decision.phaseIssuesCreated.false");
  if (bridge.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (bridge.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");
  if (bridge.guardrails?.planningPacketDraftOnly !== true) missing.push("guardrails.planningPacketDraftOnly");

  for (const [label, value] of Object.entries(candidateBridgeRequiredGuardrails())) {
    if (bridge.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) {
    throw new Error(`Cannot approve candidate_packet_bridge: missing ${missing.join(", ")}`);
  }
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

  if (missing.length) {
    throw new Error(`Cannot approve candidate_packet_bridge: missing ${missing.join(", ")}`);
  }

  return checks;
}

function approvalStatusFor(checks) {
  const statuses = Object.values(checks).map((check) => check.status);

  if (statuses.includes("blocked_by_security")) return "blocked_by_security";
  if (statuses.includes("blocked_by_cost")) return "blocked_by_cost";
  if (statuses.includes("blocked_by_scope")) return "blocked_by_scope";
  if (statuses.includes("rejected")) return "rejected";
  if (statuses.includes("needs_revision")) return "needs_revision";

  return "approved_for_final_packet";
}

function summarizePacketDraft(packetDraft) {
  const summary =
    packetDraft.summary ||
    packetDraft.app?.purpose ||
    packetDraft.change?.summary ||
    packetDraft.plan?.summary ||
    packetDraft.candidate?.name ||
    "Review-ready packet draft.";

  return {
    kind: packetDraft.kind,
    status: packetDraft.status,
    summary
  };
}

function renderOwnerReport(approval) {
  const failing = failingChecks(approval);
  const lines = [
    "Packet Draft Approval",
    "",
    `Candidate: ${approval.candidate.name}`,
    `Draft type: ${approval.packetDraft.kind}`,
    `Status: ${approval.approvalStatus}`,
    `Next safe action: ${approval.decision.nextSafeAction}`,
    "Owner approval required: yes, before final packet creation",
    "Guardrails: approval gate only, no final packet, no phase issues, no build, no deploy"
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
  const titleVerb = approval.approvalStatus === "approved_for_final_packet" ? "Prepare final packet request" : "Resolve packet draft gate";
  const failing = failingChecks(approval);

  return [
    {
      title: `[${approval.candidate.slug}] ${titleVerb}`,
      recommendedLabel: "ai:plan",
      body: [
        `Review the packet draft approval gate for ${approval.candidate.name}.`,
        "",
        "## Candidate",
        `- Type: ${approval.candidate.type}`,
        `- Selected draft: ${approval.packetDraft.kind}`,
        `- Approval status: ${approval.approvalStatus}`,
        `- Next safe action: ${approval.decision.nextSafeAction}`,
        `- Need addressed: ${approval.candidate.needAddressed}`,
        `- Desired transformation: ${approval.candidate.desiredTransformation}`,
        "",
        "## Approval Checks",
        ...approvalFactors().map((factor) => `- ${factor}: ${approval.approvalChecks[factor].status} - ${approval.approvalChecks[factor].notes}`),
        "",
        "## Gate Result",
        approval.decision.readyForFinalPacket
          ? "- Draft is approved for a later final packet creation request. Do not create the final packet in this gate."
          : `- Draft is not approved. Resolve: ${failing.map((check) => `${check.factor} (${check.status})`).join(", ") || approval.approvalStatus}.`,
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
        "- source-of-truth/app-portfolio-registry.md",
        "",
        "## Guardrails",
        "- Approval gate only.",
        "- Do not build UI.",
        "- Do not create final packets yet.",
        "- Do not create phase issues.",
        "- Do not trigger Codex build work.",
        "- Do not deploy production, create paid resources, apply migrations, add secrets/env vars, change repository visibility, or auto-merge generated app code."
      ].join("\n")
    }
  ];
}

function validatePacketDraftApproval(artifact) {
  const missing = [];

  for (const [label, value] of [
    ["kind", artifact.kind],
    ["schemaVersion", artifact.schemaVersion],
    ["sourceArtifact.kind", artifact.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", artifact.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", artifact.sourceArtifact?.candidateType],
    ["sourceArtifact.selectedDraftKind", artifact.sourceArtifact?.selectedDraftKind],
    ["candidate.name", artifact.candidate?.name],
    ["candidate.slug", artifact.candidate?.slug],
    ["candidate.type", artifact.candidate?.type],
    ["candidate.summary", artifact.candidate?.summary],
    ["candidate.needAddressed", artifact.candidate?.needAddressed],
    ["candidate.desiredTransformation", artifact.candidate?.desiredTransformation],
    ["packetDraft.kind", artifact.packetDraft?.kind],
    ["packetDraft.status", artifact.packetDraft?.status],
    ["packetDraft.summary", artifact.packetDraft?.summary],
    ["approvalStatus", artifact.approvalStatus],
    ["decision.nextSafeAction", artifact.decision?.nextSafeAction],
    ["ownerReadableReport", artifact.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (artifact.kind !== "packet_draft_approval") missing.push("kind.packet_draft_approval");
  if (artifact.sourceArtifact?.kind !== "candidate_packet_bridge") missing.push("sourceArtifact.kind.candidate_packet_bridge");
  if (!packetDraftKinds().includes(artifact.packetDraft?.kind)) missing.push("packetDraft.kind.allowed");
  if (!approvalStatuses().includes(artifact.approvalStatus)) missing.push("approvalStatus.allowed");
  if (artifact.sourceArtifact?.selectedDraftKind !== artifact.packetDraft?.kind) missing.push("packetDraft.kind.matchesSourceDraftKind");
  if (artifact.decision?.readyForFinalPacket !== (artifact.approvalStatus === "approved_for_final_packet")) missing.push("decision.readyForFinalPacket.matchesApprovalStatus");
  if (artifact.decision?.finalPacketCreated !== false) missing.push("decision.finalPacketCreated.false");
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

  if (missing.length) throw new Error(`Packet draft approval artifact missing required fields: ${missing.join(", ")}`);
}

function failingChecks(approval) {
  return approvalFactors()
    .map((factor) => ({ factor, ...approval.approvalChecks[factor] }))
    .filter((check) => check.status !== "pass");
}

function decisionReasonFor({ bridge, approvalStatus }) {
  if (approvalStatus === "approved_for_final_packet") {
    return `${bridge.selectedDraft.kind} passed the packet draft approval gate, but final packet creation still requires a later explicit step.`;
  }

  return `${bridge.selectedDraft.kind} did not pass the packet draft approval gate: ${approvalStatus}.`;
}

function finalPacketTypeFor(draftKind) {
  const finalTypes = {
    app_build_packet_draft: "app_build_packet",
    vnext_packet_draft: "vnext_packet",
    non_app_solution_plan_draft: "non_app_solution_plan"
  };

  return finalTypes[draftKind] || null;
}

function nextSafeActionFor(status) {
  const actions = {
    approved_for_final_packet: "prepare_final_packet_request",
    needs_revision: "create_packet_draft_revision_issue",
    rejected: "record_packet_draft_rejection",
    blocked_by_security: "create_security_review_issue",
    blocked_by_cost: "create_cost_review_issue",
    blocked_by_scope: "create_scope_review_issue"
  };

  return actions[status] || "create_packet_draft_revision_issue";
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
    "problemTransformationClarity",
    "correctPacketType",
    "solutionShapeFit",
    "audienceUserClarity",
    "dataSecurityPrivacyReadiness",
    "providerCostReadiness",
    "scopeRealism",
    "reviewability",
    "ownerApprovalNotes"
  ];
}

function approvalStatuses() {
  return ["approved_for_final_packet", "needs_revision", "rejected", "blocked_by_security", "blocked_by_cost", "blocked_by_scope"];
}

function packetDraftKinds() {
  return ["app_build_packet_draft", "vnext_packet_draft", "non_app_solution_plan_draft"];
}

function candidateBridgeRequiredGuardrails() {
  return {
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
  };
}

function requiredGuardrails() {
  return {
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
