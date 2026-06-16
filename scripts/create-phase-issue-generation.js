import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.PHASE_ISSUE_GENERATION_INPUT || "";
const artifactOutput = process.env.PHASE_ISSUE_GENERATION_OUTPUT || "";
const markdownOutput = process.env.PHASE_ISSUE_GENERATION_MARKDOWN_OUTPUT || "";
const followUpsOutput = process.env.PHASE_ISSUE_GENERATION_FOLLOWUPS_OUTPUT || "";

const input = readInput(inputPath);
const approval = input.phaseCreationApproval || input.phase_creation_approval || input.approval || input;
const generation = buildPhaseIssueGeneration(approval);

validatePhaseIssueGeneration(generation);

if (artifactOutput) writeJson(artifactOutput, generation);
if (markdownOutput) writeText(markdownOutput, renderGenerationMarkdown(generation));
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks: generation.phaseIssueDrafts });

console.log(`phase-issue-generation ok: ${generation.candidate.slug} -> ${generation.phaseIssueDrafts.length} drafts`);
console.log(`next safe action: ${generation.decision.nextSafeAction}`);

function buildPhaseIssueGeneration(approval) {
  validatePhaseCreationApprovalInput(approval);

  const phaseTemplates = phaseTemplatesFor(approval.finalPacket.kind);
  const phaseIssueDrafts = phaseTemplates.map((phase, index) => buildPhaseIssueDraft({
    approval,
    phase,
    order: index + 1
  }));

  const generation = {
    kind: "phase_issue_generation",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "phase_creation_approval",
      candidateSlug: approval.candidate.slug,
      candidateType: approval.candidate.type,
      finalPacketType: approval.finalPacket.kind,
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
      kind: approval.finalPacket.kind,
      status: approval.finalPacket.status
    },
    phaseOrder: phaseTemplates.map((phase) => phase.id),
    labelsToApply: uniqueLabels(phaseIssueDrafts),
    phaseIssueDrafts,
    decision: {
      generationStatus: "phase_issue_drafts_ready",
      nextSafeAction: "review_phase_issue_drafts",
      phaseIssueDraftsGenerated: true,
      githubIssuesCreated: false,
      codexBuildTriggered: false,
      ownerApprovalRequired: true,
      reason: "Approved final packet was converted into bounded phase issue drafts only."
    },
    ownerReadableReport: "",
    guardrails: requiredGuardrails()
  };

  generation.ownerReadableReport = renderOwnerReport(generation);

  return generation;
}

function validatePhaseCreationApprovalInput(approval) {
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
    ["candidate.summary", approval.candidate?.summary],
    ["candidate.needAddressed", approval.candidate?.needAddressed],
    ["candidate.desiredTransformation", approval.candidate?.desiredTransformation],
    ["finalPacket.kind", approval.finalPacket?.kind],
    ["finalPacket.status", approval.finalPacket?.status],
    ["approvalStatus", approval.approvalStatus],
    ["decision.nextSafeAction", approval.decision?.nextSafeAction],
    ["ownerReadableReport", approval.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (approval.kind !== "phase_creation_approval") missing.push("kind.phase_creation_approval");
  if (approval.sourceArtifact?.kind !== "final_packet_materialization") missing.push("sourceArtifact.kind.final_packet_materialization");
  if (!finalPacketTypes().includes(approval.finalPacket?.kind)) missing.push("finalPacket.kind.allowed");
  if (approval.sourceArtifact?.finalPacketType !== approval.finalPacket?.kind) missing.push("finalPacket.kind.matchesSourceFinalPacketType");
  if (!approvalStatuses().includes(approval.approvalStatus)) missing.push("approvalStatus.allowed");
  if (approval.approvalStatus !== "approved_for_phase_creation") {
    throw new Error(`Cannot generate phase issues: approvalStatus ${approval.approvalStatus} is not approved_for_phase_creation`);
  }
  if (approval.decision?.approvedForPhaseCreation !== true) missing.push("decision.approvedForPhaseCreation.true");
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

  if (missing.length) throw new Error(`Cannot generate phase issues: missing ${missing.join(", ")}`);
}

function buildPhaseIssueDraft({ approval, phase, order }) {
  const title = `[${approval.candidate.slug}] ${phase.title}`;
  const recommendedLabels = phase.labels;
  const guardrails = [
    "Keep this phase bounded and reviewable.",
    "Do not create paid resources.",
    "Do not deploy production.",
    "Do not apply migrations unless a later review-gated task explicitly approves it.",
    "Do not add secrets or env vars.",
    "Do not auto-merge generated app code.",
    ...phase.guardrails
  ];

  return {
    phase: phase.id,
    order,
    title,
    recommendedLabel: recommendedLabels[0],
    recommendedLabels,
    guardrails,
    body: renderPhaseBody({ approval, phase, order, guardrails })
  };
}

function renderPhaseBody({ approval, phase, order, guardrails }) {
  return [
    `# ${phase.title}`,
    "",
    `Source candidate: ${approval.candidate.name}`,
    `Source final packet: ${approval.finalPacket.kind}`,
    `Phase order: ${order}`,
    `Phase id: ${phase.id}`,
    "",
    "## Goal",
    phase.goal,
    "",
    "## Scope",
    ...phase.scope.map((item) => `- ${item}`),
    "",
    "## Acceptance Criteria",
    ...phase.acceptanceCriteria.map((item) => `- ${item}`),
    "",
    "## Labels To Apply",
    ...phase.labels.map((label) => `- ${label}`),
    "",
    "## Required Source Of Truth To Load",
    ...requiredSourceFilesFor(approval.finalPacket.kind, phase.id).map((file) => `- ${file}`),
    "",
    "## Guardrails",
    ...guardrails.map((item) => `- ${item}`),
    "",
    "## Non-Goals",
    "- Do not start unrelated phases.",
    "- Do not trigger Codex build work automatically from this draft.",
    "- Do not deploy production.",
    "- Do not create paid resources.",
    "- Do not apply migrations without later explicit approval."
  ].join("\n");
}

function phaseTemplatesFor(finalPacketType) {
  if (finalPacketType === "non_app_solution_plan") return nonAppPhaseTemplates();
  if (finalPacketType === "vnext_packet") return vnextPhaseTemplates();
  return appBuildPhaseTemplates();
}

function appBuildPhaseTemplates() {
  return [
    planPhase("architecture", "Architecture", "Define routes, data boundaries, auth surfaces, Super Admin touchpoints, preview assumptions, and follow-up risks.", [
      "Architecture plan only.",
      "No implementation or provider provisioning."
    ]),
    planPhase("provider_cost", "Provider/Cost", "Confirm free or approved low-cost provider path before any resource creation.", [
      "Planning only.",
      "No paid resources."
    ]),
    planPhase("data_model", "Data Model", "Draft schema and storage boundaries without applying migrations.", [
      "Schema planning only.",
      "No migrations or database changes."
    ]),
    planPhase("identity_auth", "Identity/Auth", "Plan identity, roles, sessions, protected routes, and owner/admin boundaries.", [
      "No secrets or OAuth credential changes."
    ]),
    planPhase("ui_design", "UI Design", "Create design direction, user flow, screen list, states, and review criteria.", [
      "No production UI deployment."
    ]),
    buildPhase("build", "MVP Build", "Create the first bounded implementation slice only after planning phases are reviewable.", [
      "No auto-merge.",
      "Keep production blocked."
    ]),
    reviewPhase("verification", "Verification", "Verify build, typecheck, route-specific preview behavior, owner status, and guardrails.", [
      "Do not claim success without evidence."
    ]),
    planPhase("release_gate", "Release Gate", "Record release status, blockers, production approval requirements, rollback notes, and monitoring plan.", [
      "Production remains blocked unless owner approval is explicit."
    ])
  ];
}

function vnextPhaseTemplates() {
  return [
    planPhase("context_refresh", "Context Refresh", "Load app charter, portfolio registry, current version, release history, monitoring data, and open issues.", [
      "Do not restart the whole app."
    ]),
    planPhase("scope", "vNext Scope", "Define bounded improvement scope, non-goals, risk, and owner review path.", [
      "Prevent app-goal bleed."
    ]),
    planPhase("ui_design", "UI/UX Review", "Plan user-facing changes, empty/error states, mobile behavior, and review criteria.", [
      "No production UI deployment."
    ]),
    buildPhase("build", "vNext Build", "Create the approved bounded improvement slice only after context and scope are reviewable.", [
      "No auto-merge.",
      "Keep production blocked."
    ]),
    reviewPhase("verification", "vNext Verification", "Verify route behavior, regression risk, owner status, and compatibility evidence.", [
      "Do not claim success without route-specific evidence."
    ]),
    planPhase("release_gate", "vNext Release Gate", "Record release status, owner approval requirements, rollback notes, monitoring update, and production block.", [
      "Production remains blocked unless owner approval is explicit."
    ])
  ];
}

function nonAppPhaseTemplates() {
  return [
    planPhase("discovery", "Discovery", "Clarify affected people, barriers, context, alternatives, and what movement toward life looks like.", [
      "No software implementation."
    ]),
    planPhase("solution_design", "Solution Design", "Design the non-app solution path and explain why this shape fits better than a full app.", [
      "Do not force the problem into app form."
    ]),
    planPhase("workflow_process_design", "Workflow/Process Design", "Define process steps, handoffs, owner responsibilities, review points, and failure states.", [
      "No automation until process is clear."
    ]),
    planPhase("content_resource_plan", "Content/Resource Plan", "Plan any guide, checklist, template, communication, or resource needed for the solution.", [
      "No public launch."
    ]),
    planPhase("implementation_checklist", "Implementation Checklist", "Create a practical checklist for executing the non-app solution safely.", [
      "No production deployment."
    ]),
    planPhase("review_measurement", "Review/Measurement", "Define how the solution will be reviewed, measured, improved, or retired.", [
      "Do not claim impact without evidence."
    ])
  ];
}

function planPhase(id, title, goal, guardrails) {
  return {
    id,
    title,
    goal,
    labels: ["ai:plan"],
    guardrails,
    scope: [
      "Produce planning artifacts and bounded follow-up recommendations only.",
      "Keep source-of-truth files visible in the output.",
      "Record blockers and missing context honestly."
    ],
    acceptanceCriteria: [
      "Output is owner-readable.",
      "Output is machine-readable enough for the next gate.",
      "Guardrails remain active."
    ]
  };
}

function buildPhase(id, title, goal, guardrails) {
  return {
    id,
    title,
    goal,
    labels: ["ai:build"],
    guardrails,
    scope: [
      "Build only the approved bounded slice.",
      "Keep preview/review path explicit.",
      "Preserve production, migration, provider, and auto-merge blocks."
    ],
    acceptanceCriteria: [
      "Implementation stays inside approved scope.",
      "Verification commands and evidence are recorded.",
      "Owner approval is required before merge or release."
    ]
  };
}

function reviewPhase(id, title, goal, guardrails) {
  return {
    id,
    title,
    goal,
    labels: ["ai:review"],
    guardrails,
    scope: [
      "Review evidence and identify focused fixes.",
      "Do not broaden scope into implementation.",
      "Keep owner status clear."
    ],
    acceptanceCriteria: [
      "Review result is explicit.",
      "Failures produce focused follow-up tasks.",
      "No production action is taken."
    ]
  };
}

function requiredSourceFilesFor(finalPacketType, phaseId) {
  const base = [
    "source-of-truth/00-why-we-build.md",
    "source-of-truth/01-ecosystem-philosophy.md",
    "source-of-truth/02-global-principles.md",
    "source-of-truth/03-life-produces-life.md",
    "source-of-truth/04-app-purpose-rules.md",
    "source-of-truth/05-ecosystem-design-gates.md",
    "source-of-truth/problem-to-solution-intake-standard.md",
    "source-of-truth/problem-portfolio-routing-standard.md",
    "source-of-truth/solution-candidate-review-gate.md",
    "source-of-truth/candidate-to-packet-bridge.md",
    "source-of-truth/packet-draft-approval-gate.md",
    "source-of-truth/final-packet-materialization.md",
    "source-of-truth/phase-creation-approval-gate.md",
    "source-of-truth/phase-issue-generation.md",
    "source-of-truth/app-portfolio-registry.md"
  ];

  if (finalPacketType === "app_build_packet") base.push("source-of-truth/app-build-packet.md");
  if (finalPacketType === "vnext_packet") base.push("source-of-truth/app-improvement-vnext-packet.md");
  if (phaseId === "provider_cost") base.push("source-of-truth/operations-cost-provider-strategy.md");
  if (phaseId === "identity_auth") base.push("source-of-truth/identity-auth-standard.md");
  if (phaseId === "ui_design") {
    base.push("source-of-truth/design-quality-gate.md");
    base.push("source-of-truth/ux-review-standard.md");
  }
  if (phaseId === "verification") base.push("source-of-truth/compatibility-standard.md");
  if (phaseId === "release_gate") base.push("source-of-truth/release-gate-standard.md");

  return base;
}

function renderOwnerReport(generation) {
  return [
    "Phase Issue Generation",
    "",
    `Candidate: ${generation.candidate.name}`,
    `Source final packet: ${generation.sourceFinalPacket.kind}`,
    `Generated phase drafts: ${generation.phaseOrder.join(", ")}`,
    `Labels to apply later: ${generation.labelsToApply.join(", ")}`,
    `Next safe action: ${generation.decision.nextSafeAction}`,
    "Guardrails: draft issues only, no GitHub issues created, no Codex build, no deploy"
  ].join("\n");
}

function renderGenerationMarkdown(artifact) {
  return `${artifact.ownerReadableReport}\n`;
}

function validatePhaseIssueGeneration(artifact) {
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
    ["decision.generationStatus", artifact.decision?.generationStatus],
    ["decision.nextSafeAction", artifact.decision?.nextSafeAction],
    ["ownerReadableReport", artifact.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (artifact.kind !== "phase_issue_generation") missing.push("kind.phase_issue_generation");
  if (artifact.sourceArtifact?.kind !== "phase_creation_approval") missing.push("sourceArtifact.kind.phase_creation_approval");
  if (artifact.sourceArtifact?.approvalStatus !== "approved_for_phase_creation") missing.push("sourceArtifact.approvalStatus.approved");
  if (!finalPacketTypes().includes(artifact.sourceFinalPacket?.kind)) missing.push("sourceFinalPacket.kind.allowed");
  if (!Array.isArray(artifact.phaseOrder) || artifact.phaseOrder.length === 0) missing.push("phaseOrder");
  if (!Array.isArray(artifact.labelsToApply) || artifact.labelsToApply.length === 0) missing.push("labelsToApply");
  if (!Array.isArray(artifact.phaseIssueDrafts) || artifact.phaseIssueDrafts.length === 0) missing.push("phaseIssueDrafts");
  if (artifact.decision?.phaseIssueDraftsGenerated !== true) missing.push("decision.phaseIssueDraftsGenerated.true");
  if (artifact.decision?.githubIssuesCreated !== false) missing.push("decision.githubIssuesCreated.false");
  if (artifact.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (artifact.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (artifact.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  artifact.phaseIssueDrafts?.forEach((draft, index) => {
    for (const [label, value] of [
      ["phase", draft.phase],
      ["order", draft.order],
      ["title", draft.title],
      ["recommendedLabel", draft.recommendedLabel],
      ["body", draft.body]
    ]) {
      if (!isPresent(value)) missing.push(`phaseIssueDrafts.${index}.${label}`);
    }

    if (!Array.isArray(draft.recommendedLabels) || draft.recommendedLabels.length === 0) {
      missing.push(`phaseIssueDrafts.${index}.recommendedLabels`);
    }
    if (!Array.isArray(draft.guardrails) || draft.guardrails.length === 0) {
      missing.push(`phaseIssueDrafts.${index}.guardrails`);
    }
    if (!String(draft.body || "").includes("## Required Source Of Truth To Load")) {
      missing.push(`phaseIssueDrafts.${index}.body.requiredSourceOfTruth`);
    }
  });

  if (missing.length) throw new Error(`Phase issue generation artifact missing required fields: ${missing.join(", ")}`);
}

function uniqueLabels(phaseIssueDrafts) {
  return [...new Set(phaseIssueDrafts.flatMap((draft) => draft.recommendedLabels))];
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

function approvalRequiredGuardrails() {
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

function requiredGuardrails() {
  return {
    phaseIssueDraftGenerationOnly: true,
    noUi: true,
    noGithubIssuesCreated: true,
    noAutomaticCodexBuildExecution: true,
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
