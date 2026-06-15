import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.CANDIDATE_PACKET_BRIDGE_INPUT || "";
const artifactOutput = process.env.CANDIDATE_PACKET_BRIDGE_OUTPUT || "";
const markdownOutput = process.env.CANDIDATE_PACKET_BRIDGE_MARKDOWN_OUTPUT || "";
const followUpsOutput = process.env.CANDIDATE_PACKET_BRIDGE_FOLLOWUPS_OUTPUT || "";

const input = readInput(inputPath);
const sourceReview = input.solutionCandidateReview || input.solution_candidate_review || input;
const bridge = buildCandidatePacketBridge(sourceReview);

validateCandidatePacketBridge(bridge);

if (artifactOutput) writeJson(artifactOutput, bridge);
if (markdownOutput) writeText(markdownOutput, renderBridgeMarkdown(bridge));
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks: bridge.followUpTasks });

console.log(`candidate-packet-bridge ok: ${bridge.candidate.slug} -> ${bridge.selectedDraft.kind}`);
console.log(`next safe action: ${bridge.decision.nextSafeAction}`);

function buildCandidatePacketBridge(review) {
  validateSolutionCandidateReview(review);

  const selectedDraftKind = selectedDraftKindFor(review.readinessStatus);
  const selectedReason = selectedReasonFor(review);
  const packetDraft = buildPacketDraft(review, selectedDraftKind);

  return {
    kind: "candidate_packet_bridge",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "solution_candidate_review",
      candidateSlug: review.candidate.slug,
      candidateType: review.candidate.type,
      readinessStatus: review.readinessStatus
    },
    candidate: {
      name: review.candidate.name,
      slug: review.candidate.slug,
      type: review.candidate.type,
      summary: review.candidate.summary,
      needAddressed: review.candidate.needAddressed,
      desiredTransformation: review.candidate.desiredTransformation,
      solutionShape: review.candidate.solutionShape || {}
    },
    selectedDraft: {
      kind: selectedDraftKind,
      reason: selectedReason,
      ownerApprovalRequired: true
    },
    packetDraft,
    decision: {
      bridgeStatus: "draft_ready",
      nextSafeAction: "review_packet_draft",
      phaseIssuesCreated: false,
      codexBuildTriggered: false,
      ownerApprovalRequired: true,
      reason: "Approved solution candidate has been converted to a review-ready packet draft only."
    },
    ownerReadableReport: renderOwnerReport({
      review,
      selectedDraftKind,
      selectedReason
    }),
    followUpTasks: buildFollowUpTasks({
      review,
      selectedDraftKind,
      selectedReason
    }),
    guardrails: requiredGuardrails()
  };
}

function validateSolutionCandidateReview(review) {
  const missing = [];

  for (const [label, value] of [
    ["kind", review.kind],
    ["schemaVersion", review.schemaVersion],
    ["sourceArtifact.kind", review.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", review.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", review.sourceArtifact?.candidateType],
    ["candidate.name", review.candidate?.name],
    ["candidate.slug", review.candidate?.slug],
    ["candidate.type", review.candidate?.type],
    ["candidate.summary", review.candidate?.summary],
    ["candidate.needAddressed", review.candidate?.needAddressed],
    ["candidate.desiredTransformation", review.candidate?.desiredTransformation],
    ["readinessStatus", review.readinessStatus],
    ["decision.ready", review.decision?.ready],
    ["decision.nextSafeAction", review.decision?.nextSafeAction],
    ["decision.nextArtifact", review.decision?.nextArtifact]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (review.kind !== "solution_candidate_review") missing.push("kind.solution_candidate_review");
  if (review.sourceArtifact?.kind !== "problem_portfolio_routing") missing.push("sourceArtifact.kind.problem_portfolio_routing");
  if (!allowedReadinessStatuses().includes(review.readinessStatus)) missing.push("readinessStatus.allowed");
  if (review.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");
  if (review.guardrails?.planningReviewOnly !== true) missing.push("guardrails.planningReviewOnly");

  for (const factor of reviewFactors()) {
    if (!review.review?.[factor]?.status) missing.push(`review.${factor}.status`);
  }

  if (missing.length) {
    throw new Error(`Cannot bridge solution_candidate_review to packet draft: missing ${missing.join(", ")}`);
  }

  if (!readyReadinessStatuses().includes(review.readinessStatus)) {
    throw new Error(`Cannot bridge solution_candidate_review to packet draft: readinessStatus ${review.readinessStatus} is not approved for packet draft creation`);
  }

  if (review.decision.ready !== true) {
    throw new Error("Cannot bridge solution_candidate_review to packet draft: decision.ready must be true");
  }
}

function selectedDraftKindFor(readinessStatus) {
  const draftKinds = {
    ready_for_app_build_packet: "app_build_packet_draft",
    ready_for_vnext_packet: "vnext_packet_draft",
    ready_for_non_app_solution_plan: "non_app_solution_plan_draft"
  };

  return draftKinds[readinessStatus] || "";
}

function selectedReasonFor(review) {
  const reasons = {
    ready_for_app_build_packet: "Solution candidate review approved this as a new app candidate.",
    ready_for_vnext_packet: "Solution candidate review approved this as an existing app improvement.",
    ready_for_non_app_solution_plan: "Solution candidate review approved this as a non-app solution path."
  };

  return reasons[review.readinessStatus] || "Solution candidate review selected this packet draft.";
}

function buildPacketDraft(review, selectedDraftKind) {
  if (selectedDraftKind === "app_build_packet_draft") return buildAppBuildPacketDraft(review);
  if (selectedDraftKind === "vnext_packet_draft") return buildVnextPacketDraft(review);
  return buildNonAppSolutionPlanDraft(review);
}

function buildAppBuildPacketDraft(review) {
  const candidate = review.candidate;

  return {
    kind: "app_build_packet_draft",
    schemaVersion: 1,
    status: "review_ready_draft",
    app: {
      name: candidate.name,
      slug: candidate.slug,
      charterPath: `source-of-truth/charters/${candidate.slug}.md`,
      purpose: candidate.summary,
      audience: normalizeArray(candidate.affectedPeople),
      barrierRemoved: normalizeArray(candidate.barriers).join("; "),
      needAddressed: candidate.needAddressed,
      movementTowardLife: candidate.desiredTransformation,
      transformationOutcome: candidate.desiredTransformation,
      boundaries: ["Draft only until owner reviews and approves packet creation."],
      successDefinition: "Owner-approved App Build Packet can be created without starting implementation.",
      mvpStages: ["discovery", "charter", "architecture", "provider_cost", "data_model", "identity_auth", "ui_design", "mvp_build", "review", "release_gate"],
      deploymentTarget: "Preview only until release approval."
    },
    sourceReview: sourceReviewSummary(review),
    recommendedNextStep: "review_packet_draft",
    phaseIssuesCreated: false
  };
}

function buildVnextPacketDraft(review) {
  const candidate = review.candidate;

  return {
    kind: "vnext_packet_draft",
    schemaVersion: 1,
    status: "review_ready_draft",
    app: {
      name: candidate.name,
      slug: candidate.slug,
      currentVersion: "unknown_until_registry_loaded",
      targetVersion: "vNext"
    },
    change: {
      summary: candidate.summary,
      barrierRemoved: normalizeArray(candidate.barriers).join("; "),
      needAddressed: candidate.needAddressed,
      movementTowardLife: candidate.desiredTransformation,
      transformationOutcome: candidate.desiredTransformation,
      nonGoals: ["Do not restart the whole app.", "Do not merge unrelated app goals."]
    },
    requiredContextBeforeFinalPacket: [
      "existing app charter",
      "app portfolio registry entry",
      "current version",
      "release history",
      "monitoring data",
      "known issues"
    ],
    sourceReview: sourceReviewSummary(review),
    recommendedNextStep: "review_packet_draft",
    phaseIssuesCreated: false
  };
}

function buildNonAppSolutionPlanDraft(review) {
  const candidate = review.candidate;

  return {
    kind: "non_app_solution_plan_draft",
    schemaVersion: 1,
    status: "review_ready_draft",
    candidate: {
      name: candidate.name,
      slug: candidate.slug,
      type: candidate.type,
      solutionShape: candidate.solutionShape?.primary || candidate.type
    },
    plan: {
      summary: candidate.summary,
      barrierRemoved: normalizeArray(candidate.barriers).join("; "),
      needAddressed: candidate.needAddressed,
      movementTowardLife: candidate.desiredTransformation,
      transformationOutcome: candidate.desiredTransformation,
      likelyWorkType: nonAppWorkTypeFor(candidate.type),
      reviewPath: ["owner review", "scope clarification", "non-app plan creation"]
    },
    sourceReview: sourceReviewSummary(review),
    recommendedNextStep: "review_packet_draft",
    phaseIssuesCreated: false
  };
}

function sourceReviewSummary(review) {
  return {
    kind: "solution_candidate_review",
    candidateSlug: review.candidate.slug,
    readinessStatus: review.readinessStatus,
    nextSafeAction: review.decision.nextSafeAction,
    ownerApprovalRequired: review.decision.ownerApprovalRequired
  };
}

function nonAppWorkTypeFor(candidateType) {
  const workTypes = {
    website_candidate: "website_plan",
    workflow_process_candidate: "workflow_process_plan",
    automation_candidate: "automation_plan",
    content_resource_candidate: "content_resource_plan",
    ministry_community_model_candidate: "ministry_community_model_plan",
    multi_part_ecosystem_solution: "ecosystem_solution_split_plan"
  };

  return workTypes[candidateType] || "non_app_solution_plan";
}

function renderOwnerReport({ review, selectedDraftKind, selectedReason }) {
  return [
    "Candidate To Packet Bridge",
    "",
    `Candidate: ${review.candidate.name}`,
    `Selected draft: ${selectedDraftKind}`,
    `Why: ${selectedReason}`,
    "Owner approval required: yes, review the draft before packet creation or phase expansion",
    "Next safe action: review_packet_draft",
    "Guardrails: packet draft only, no phase issues, no build, no deploy"
  ].join("\n");
}

function renderBridgeMarkdown(artifact) {
  return `${artifact.ownerReadableReport}\n`;
}

function buildFollowUpTasks({ review, selectedDraftKind, selectedReason }) {
  return [
    {
      title: `[${review.candidate.slug}] Review ${selectedDraftKind}`,
      recommendedLabel: "ai:plan",
      body: [
        `Review the packet draft bridge for ${review.candidate.name}.`,
        "",
        "## Candidate",
        `- Type: ${review.candidate.type}`,
        `- Readiness status: ${review.readinessStatus}`,
        `- Selected draft: ${selectedDraftKind}`,
        `- Reason: ${selectedReason}`,
        `- Need addressed: ${review.candidate.needAddressed}`,
        `- Desired transformation: ${review.candidate.desiredTransformation}`,
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
        "- source-of-truth/app-portfolio-registry.md",
        "",
        "## Guardrails",
        "- Planning/packet draft only.",
        "- Do not build UI.",
        "- Do not create phase issues yet.",
        "- Do not trigger Codex build work.",
        "- Do not deploy production, create paid resources, apply migrations, add secrets/env vars, change repository visibility, or auto-merge generated app code."
      ].join("\n")
    }
  ];
}

function validateCandidatePacketBridge(artifact) {
  const missing = [];

  for (const [label, value] of [
    ["kind", artifact.kind],
    ["schemaVersion", artifact.schemaVersion],
    ["sourceArtifact.kind", artifact.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", artifact.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", artifact.sourceArtifact?.candidateType],
    ["sourceArtifact.readinessStatus", artifact.sourceArtifact?.readinessStatus],
    ["candidate.name", artifact.candidate?.name],
    ["candidate.slug", artifact.candidate?.slug],
    ["candidate.type", artifact.candidate?.type],
    ["candidate.summary", artifact.candidate?.summary],
    ["candidate.needAddressed", artifact.candidate?.needAddressed],
    ["candidate.desiredTransformation", artifact.candidate?.desiredTransformation],
    ["selectedDraft.kind", artifact.selectedDraft?.kind],
    ["selectedDraft.reason", artifact.selectedDraft?.reason],
    ["packetDraft.kind", artifact.packetDraft?.kind],
    ["packetDraft.status", artifact.packetDraft?.status],
    ["decision.bridgeStatus", artifact.decision?.bridgeStatus],
    ["decision.nextSafeAction", artifact.decision?.nextSafeAction],
    ["ownerReadableReport", artifact.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (artifact.kind !== "candidate_packet_bridge") missing.push("kind.candidate_packet_bridge");
  if (artifact.sourceArtifact?.kind !== "solution_candidate_review") missing.push("sourceArtifact.kind.solution_candidate_review");
  if (!readyReadinessStatuses().includes(artifact.sourceArtifact?.readinessStatus)) missing.push("sourceArtifact.readinessStatus.ready");
  if (!packetDraftKinds().includes(artifact.selectedDraft?.kind)) missing.push("selectedDraft.kind.allowed");
  if (artifact.selectedDraft?.kind !== artifact.packetDraft?.kind) missing.push("packetDraft.kind.matchesSelectedDraft");
  if (artifact.decision?.phaseIssuesCreated !== false) missing.push("decision.phaseIssuesCreated.false");
  if (artifact.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (artifact.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (artifact.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Candidate packet bridge artifact missing required fields: ${missing.join(", ")}`);
}

function reviewFactors() {
  return [
    "problemClarity",
    "intendedTransformation",
    "audienceUser",
    "solutionShape",
    "dataSecurityPrivacyNeeds",
    "costProviderImpact",
    "buildComplexity",
    "appEcosystemFit",
    "ownerApprovalRequirements"
  ];
}

function allowedReadinessStatuses() {
  return [
    "needs_clarification",
    "ready_for_app_build_packet",
    "ready_for_vnext_packet",
    "ready_for_non_app_solution_plan",
    "blocked_by_security",
    "blocked_by_cost",
    "blocked_by_scope"
  ];
}

function readyReadinessStatuses() {
  return ["ready_for_app_build_packet", "ready_for_vnext_packet", "ready_for_non_app_solution_plan"];
}

function packetDraftKinds() {
  return ["app_build_packet_draft", "vnext_packet_draft", "non_app_solution_plan_draft"];
}

function requiredGuardrails() {
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

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null && String(item).trim() !== "") : [];
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
