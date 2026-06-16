import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.FINAL_PACKET_MATERIALIZATION_INPUT || "";
const artifactOutput = process.env.FINAL_PACKET_MATERIALIZATION_OUTPUT || "";
const markdownOutput = process.env.FINAL_PACKET_MATERIALIZATION_MARKDOWN_OUTPUT || "";
const followUpsOutput = process.env.FINAL_PACKET_MATERIALIZATION_FOLLOWUPS_OUTPUT || "";

const input = readInput(inputPath);
const approval = input.packetDraftApproval || input.packet_draft_approval || input.approval || input;
const materialization = buildFinalPacketMaterialization(approval);

validateFinalPacketMaterialization(materialization);

if (artifactOutput) writeJson(artifactOutput, materialization);
if (markdownOutput) writeText(markdownOutput, renderMaterializationMarkdown(materialization));
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks: materialization.followUpTasks });

console.log(`final-packet-materialization ok: ${materialization.candidate.slug} -> ${materialization.finalPacketType}`);
console.log(`next safe action: ${materialization.decision.nextSafeAction}`);

function buildFinalPacketMaterialization(approval) {
  validatePacketDraftApprovalInput(approval);

  const finalPacketType = approval.decision.finalPacketType || finalPacketTypeForDraft(approval.packetDraft.kind);
  const finalPacket = buildFinalPacket({ approval, finalPacketType });

  const artifact = {
    kind: "final_packet_materialization",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "packet_draft_approval",
      candidateSlug: approval.candidate.slug,
      candidateType: approval.candidate.type,
      approvalStatus: approval.approvalStatus,
      approvedDraftKind: approval.packetDraft.kind
    },
    candidate: {
      name: approval.candidate.name,
      slug: approval.candidate.slug,
      type: approval.candidate.type,
      summary: approval.candidate.summary,
      needAddressed: approval.candidate.needAddressed,
      desiredTransformation: approval.candidate.desiredTransformation
    },
    finalPacketType,
    finalPacket,
    decision: {
      materializationStatus: "final_packet_ready",
      nextSafeAction: "request_phase_creation_approval",
      finalPacketCreated: true,
      phaseIssuesCreated: false,
      codexBuildTriggered: false,
      ownerApprovalRequired: true,
      reason: `${finalPacketType} was materialized from an approved packet draft. Phase creation still requires a later explicit approval.`
    },
    ownerReadableReport: "",
    followUpTasks: [],
    guardrails: requiredGuardrails()
  };

  artifact.ownerReadableReport = renderOwnerReport(artifact);
  artifact.followUpTasks = buildFollowUpTasks(artifact);

  return artifact;
}

function validatePacketDraftApprovalInput(approval) {
  const missing = [];

  for (const [label, value] of [
    ["kind", approval.kind],
    ["schemaVersion", approval.schemaVersion],
    ["sourceArtifact.kind", approval.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", approval.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", approval.sourceArtifact?.candidateType],
    ["sourceArtifact.selectedDraftKind", approval.sourceArtifact?.selectedDraftKind],
    ["candidate.name", approval.candidate?.name],
    ["candidate.slug", approval.candidate?.slug],
    ["candidate.type", approval.candidate?.type],
    ["candidate.summary", approval.candidate?.summary],
    ["candidate.needAddressed", approval.candidate?.needAddressed],
    ["candidate.desiredTransformation", approval.candidate?.desiredTransformation],
    ["packetDraft.kind", approval.packetDraft?.kind],
    ["packetDraft.status", approval.packetDraft?.status],
    ["packetDraft.summary", approval.packetDraft?.summary],
    ["approvalStatus", approval.approvalStatus],
    ["decision.readyForFinalPacket", approval.decision?.readyForFinalPacket],
    ["decision.finalPacketType", approval.decision?.finalPacketType],
    ["decision.nextSafeAction", approval.decision?.nextSafeAction],
    ["ownerReadableReport", approval.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (approval.kind !== "packet_draft_approval") missing.push("kind.packet_draft_approval");
  if (approval.sourceArtifact?.kind !== "candidate_packet_bridge") missing.push("sourceArtifact.kind.candidate_packet_bridge");
  if (!packetDraftKinds().includes(approval.packetDraft?.kind)) missing.push("packetDraft.kind.allowed");
  if (approval.sourceArtifact?.selectedDraftKind !== approval.packetDraft?.kind) missing.push("packetDraft.kind.matchesSourceDraftKind");
  if (!approvalStatuses().includes(approval.approvalStatus)) missing.push("approvalStatus.allowed");
  if (approval.approvalStatus !== "approved_for_final_packet") {
    throw new Error(`Cannot materialize final packet: approvalStatus ${approval.approvalStatus} is not approved_for_final_packet`);
  }
  if (approval.decision?.readyForFinalPacket !== true) missing.push("decision.readyForFinalPacket.true");
  if (approval.decision?.finalPacketCreated !== false) missing.push("decision.finalPacketCreated.false");
  if (approval.decision?.phaseIssuesCreated !== false) missing.push("decision.phaseIssuesCreated.false");
  if (approval.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
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

  if (missing.length) throw new Error(`Cannot materialize final packet: missing ${missing.join(", ")}`);
}

function buildFinalPacket({ approval, finalPacketType }) {
  if (finalPacketType === "app_build_packet") return buildAppBuildPacket(approval);
  if (finalPacketType === "vnext_packet") return buildVnextPacket(approval);
  if (finalPacketType === "non_app_solution_plan") return buildNonAppSolutionPlan(approval);

  throw new Error(`Cannot materialize final packet: unsupported finalPacketType ${finalPacketType}`);
}

function buildAppBuildPacket(approval) {
  return {
    kind: "app_build_packet",
    schemaVersion: 1,
    status: "final_review_ready",
    sourceCandidate: sourceCandidate(approval),
    app: {
      name: approval.candidate.name,
      slug: approval.candidate.slug,
      charterPath: `source-of-truth/charters/${approval.candidate.slug}.md`,
      purpose: approval.candidate.summary,
      audience: ["to be finalized before phase creation"],
      barrierRemoved: approval.candidate.needAddressed,
      needAddressed: approval.candidate.needAddressed,
      movementTowardLife: approval.candidate.desiredTransformation,
      transformationOutcome: approval.candidate.desiredTransformation,
      boundaries: ["Final packet is review-ready only until phase creation is explicitly approved."],
      successDefinition: "Phase creation can be requested without starting implementation.",
      mvpStages: ["discovery", "charter", "architecture", "provider_cost", "data_model", "identity_auth", "ui_design", "mvp_build", "review", "release_gate"],
      deploymentTarget: "Preview only until release approval."
    },
    toolClassification: "Direct Transformation Tool or Support Tool must be confirmed before phase creation.",
    identityAuthPlan: {
      status: "required_before_phase_creation",
      provider: "to be selected",
      productionAuthGates: ["no production auth changes without approval"]
    },
    superAdminIntegrationRequirements: [
      "management",
      "monitoring",
      "health",
      "logs",
      "users",
      "billing/status if needed",
      "admin actions"
    ],
    superAdminRegistryEntry: {
      status: "planned_before_phase_creation",
      appSlug: approval.candidate.slug,
      lifecycleStatus: "packet_final_review_ready"
    },
    providerCostReview: {
      status: "required_before_provider_action",
      noPaidResourcesApproved: true
    },
    deploymentEnvironmentPlan: {
      status: "required_before_preview_work",
      productionBlocked: true
    },
    designQualityGate: {
      status: "required_before_release_gate"
    },
    uxReview: {
      status: "required_before_release_gate"
    },
    compatibilityTestPlan: {
      status: "required_before_release_gate"
    },
    releaseGatePlan: {
      status: "production_blocked_until_owner_approval",
      productionDeployApproved: false
    },
    guardrails: packetGuardrails(),
    phases: ["discovery", "charter", "architecture", "provider_cost", "data_model", "identity_auth", "ui_design", "mvp_build", "testing", "review", "release_gate"],
    followUpTasks: [],
    approvedBy: approvalSummary(approval),
    phaseIssuesCreated: false,
    codexBuildTriggered: false,
    nextSafeAction: "request_phase_creation_approval"
  };
}

function buildVnextPacket(approval) {
  return {
    kind: "vnext_packet",
    schemaVersion: 1,
    status: "final_review_ready",
    sourceCandidate: sourceCandidate(approval),
    app: {
      name: approval.candidate.name,
      slug: approval.candidate.slug,
      currentVersion: "load_from_app_portfolio_registry_before_phase_creation",
      targetVersion: "vNext"
    },
    improvement: {
      summary: approval.candidate.summary,
      needAddressed: approval.candidate.needAddressed,
      movementTowardLife: approval.candidate.desiredTransformation,
      transformationOutcome: approval.candidate.desiredTransformation,
      nonGoals: ["Do not restart the whole app.", "Do not merge unrelated app goals."]
    },
    providerCostDelta: {
      status: "required_before_provider_action",
      noPaidResourcesApproved: true
    },
    phases: ["context_refresh", "scope", "design_review", "implementation_plan", "testing", "review", "release_gate"],
    releaseGate: {
      status: "production_blocked_until_owner_approval",
      productionDeployApproved: false
    },
    monitoringUpdate: {
      status: "required_before_release"
    },
    appBoundaryGuardrails: ["Do not restart the app.", "Do not import unrelated app goals.", "Load app registry before phase creation."],
    requiredContextBeforePhaseCreation: [
      "existing app charter",
      "app portfolio registry entry",
      "current version",
      "release history",
      "monitoring data",
      "known issues"
    ],
    approvedBy: approvalSummary(approval),
    guardrails: packetGuardrails(),
    followUpTasks: [],
    phaseIssuesCreated: false,
    codexBuildTriggered: false,
    nextSafeAction: "request_phase_creation_approval"
  };
}

function buildNonAppSolutionPlan(approval) {
  return {
    kind: "non_app_solution_plan",
    schemaVersion: 1,
    status: "final_review_ready",
    sourceCandidate: sourceCandidate(approval),
    plan: {
      name: approval.candidate.name,
      slug: approval.candidate.slug,
      solutionType: approval.candidate.type,
      summary: approval.candidate.summary,
      needAddressed: approval.candidate.needAddressed,
      movementTowardLife: approval.candidate.desiredTransformation,
      transformationOutcome: approval.candidate.desiredTransformation,
      reviewPath: ["owner review", "phase creation approval", "non-app plan execution issue"]
    },
    approvedBy: approvalSummary(approval),
    guardrails: packetGuardrails(),
    followUpTasks: [],
    phaseIssuesCreated: false,
    codexBuildTriggered: false,
    nextSafeAction: "request_phase_creation_approval"
  };
}

function sourceCandidate(approval) {
  return {
    name: approval.candidate.name,
    slug: approval.candidate.slug,
    type: approval.candidate.type,
    summary: approval.candidate.summary,
    needAddressed: approval.candidate.needAddressed,
    desiredTransformation: approval.candidate.desiredTransformation
  };
}

function approvalSummary(approval) {
  return {
    kind: "packet_draft_approval",
    approvalStatus: approval.approvalStatus,
    approvedDraftKind: approval.packetDraft.kind,
    nextSafeAction: approval.decision.nextSafeAction
  };
}

function packetGuardrails() {
  return {
    finalPacketReviewReadyOnly: true,
    phaseIssuesRequireLaterApproval: true,
    noCodexBuildTriggered: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    noGeneratedCodeAutoMerge: true
  };
}

function renderOwnerReport(artifact) {
  return [
    "Final Packet Materialization",
    "",
    `Candidate: ${artifact.candidate.name}`,
    `Approved packet type: ${artifact.finalPacketType}`,
    "Why ready: packet draft approval passed all required checks",
    `Next safe action: ${artifact.decision.nextSafeAction}`,
    "Guardrails: final packet only, no phase issues, no build, no deploy"
  ].join("\n");
}

function renderMaterializationMarkdown(artifact) {
  return `${artifact.ownerReadableReport}\n`;
}

function buildFollowUpTasks(artifact) {
  return [
    {
      title: `[${artifact.candidate.slug}] Request phase creation approval`,
      recommendedLabel: "ai:plan",
      body: [
        `Review the final packet materialization for ${artifact.candidate.name}.`,
        "",
        "## Candidate",
        `- Type: ${artifact.candidate.type}`,
        `- Final packet type: ${artifact.finalPacketType}`,
        `- Final packet status: ${artifact.finalPacket.status}`,
        `- Next safe action: ${artifact.decision.nextSafeAction}`,
        `- Need addressed: ${artifact.candidate.needAddressed}`,
        `- Desired transformation: ${artifact.candidate.desiredTransformation}`,
        "",
        "## Why Ready",
        "- Packet draft approval passed all required checks.",
        "- This materialization creates the final planning packet only.",
        "- Phase creation and implementation still require later explicit approval.",
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
        "- source-of-truth/app-portfolio-registry.md",
        "",
        "## Guardrails",
        "- Final packet creation only.",
        "- Do not build UI.",
        "- Do not create phase issues yet.",
        "- Do not trigger Codex build work.",
        "- Do not deploy production, create paid resources, apply migrations, add secrets/env vars, change repository visibility, or auto-merge generated app code."
      ].join("\n")
    }
  ];
}

function validateFinalPacketMaterialization(artifact) {
  const missing = [];

  for (const [label, value] of [
    ["kind", artifact.kind],
    ["schemaVersion", artifact.schemaVersion],
    ["sourceArtifact.kind", artifact.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", artifact.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", artifact.sourceArtifact?.candidateType],
    ["sourceArtifact.approvalStatus", artifact.sourceArtifact?.approvalStatus],
    ["sourceArtifact.approvedDraftKind", artifact.sourceArtifact?.approvedDraftKind],
    ["candidate.name", artifact.candidate?.name],
    ["candidate.slug", artifact.candidate?.slug],
    ["candidate.type", artifact.candidate?.type],
    ["candidate.summary", artifact.candidate?.summary],
    ["candidate.needAddressed", artifact.candidate?.needAddressed],
    ["candidate.desiredTransformation", artifact.candidate?.desiredTransformation],
    ["finalPacketType", artifact.finalPacketType],
    ["finalPacket.kind", artifact.finalPacket?.kind],
    ["finalPacket.status", artifact.finalPacket?.status],
    ["decision.materializationStatus", artifact.decision?.materializationStatus],
    ["decision.nextSafeAction", artifact.decision?.nextSafeAction],
    ["ownerReadableReport", artifact.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (artifact.kind !== "final_packet_materialization") missing.push("kind.final_packet_materialization");
  if (artifact.sourceArtifact?.kind !== "packet_draft_approval") missing.push("sourceArtifact.kind.packet_draft_approval");
  if (artifact.sourceArtifact?.approvalStatus !== "approved_for_final_packet") missing.push("sourceArtifact.approvalStatus.approved");
  if (!finalPacketTypes().includes(artifact.finalPacketType)) missing.push("finalPacketType.allowed");
  if (artifact.finalPacket?.kind !== artifact.finalPacketType) missing.push("finalPacket.kind.matchesFinalPacketType");
  if (artifact.decision?.finalPacketCreated !== true) missing.push("decision.finalPacketCreated.true");
  if (artifact.decision?.phaseIssuesCreated !== false) missing.push("decision.phaseIssuesCreated.false");
  if (artifact.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (artifact.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");
  if (artifact.decision?.nextSafeAction !== "request_phase_creation_approval") missing.push("decision.nextSafeAction.request_phase_creation_approval");

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (artifact.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Final packet materialization artifact missing required fields: ${missing.join(", ")}`);
}

function finalPacketTypeForDraft(draftKind) {
  const finalTypes = {
    app_build_packet_draft: "app_build_packet",
    vnext_packet_draft: "vnext_packet",
    non_app_solution_plan_draft: "non_app_solution_plan"
  };

  return finalTypes[draftKind] || "";
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

function finalPacketTypes() {
  return ["app_build_packet", "vnext_packet", "non_app_solution_plan"];
}

function approvalRequiredGuardrails() {
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

function requiredGuardrails() {
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
