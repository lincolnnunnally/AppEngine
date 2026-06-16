import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.PHASE_ISSUE_PUBLISH_APPROVAL_INPUT || "";
const artifactOutput = process.env.PHASE_ISSUE_PUBLISH_APPROVAL_OUTPUT || "";
const markdownOutput = process.env.PHASE_ISSUE_PUBLISH_APPROVAL_MARKDOWN_OUTPUT || "";
const followUpsOutput = process.env.PHASE_ISSUE_PUBLISH_APPROVAL_FOLLOWUPS_OUTPUT || "";

const input = readInput(inputPath);
const generation = input.phaseIssueGeneration || input.phase_issue_generation || input.generation || input;
const approvalInput = input.phaseIssuePublishApproval || input.phase_issue_publish_approval || input.approval || generation.approval || {};
const approval = buildPhaseIssuePublishApproval(generation, approvalInput);

validatePhaseIssuePublishApproval(approval);

if (artifactOutput) writeJson(artifactOutput, approval);
if (markdownOutput) writeText(markdownOutput, renderApprovalMarkdown(approval));
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks: approval.followUpTasks });

console.log(`phase-issue-publish-approval ok: ${approval.candidate.slug} -> ${approval.approvalStatus}`);
console.log(`next safe action: ${approval.decision.nextSafeAction}`);

function buildPhaseIssuePublishApproval(generation, approvalInput) {
  validatePhaseIssueGeneration(generation);

  const draftFindings = analyzePhaseIssueDrafts(generation);
  const approvalChecks = buildApprovalChecks(approvalInput, draftFindings);
  const approvalStatus = approvalStatusFor(approvalChecks);
  const nextSafeAction = nextSafeActionFor(approvalStatus);

  const approval = {
    kind: "phase_issue_publish_approval",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "phase_issue_generation",
      candidateSlug: generation.candidate.slug,
      candidateType: generation.candidate.type,
      finalPacketType: generation.sourceFinalPacket.kind,
      generationStatus: generation.decision.generationStatus
    },
    candidate: {
      name: generation.candidate.name,
      slug: generation.candidate.slug,
      type: generation.candidate.type,
      summary: generation.candidate.summary,
      needAddressed: generation.candidate.needAddressed,
      desiredTransformation: generation.candidate.desiredTransformation
    },
    sourceFinalPacket: {
      kind: generation.sourceFinalPacket.kind,
      status: generation.sourceFinalPacket.status
    },
    approvalStatus,
    approvalChecks,
    phaseIssueSummary: {
      phaseCount: generation.phaseIssueDrafts.length,
      phaseOrder: generation.phaseOrder,
      labelsToApply: generation.labelsToApply,
      draftTitles: generation.phaseIssueDrafts.map((draft) => draft.title)
    },
    draftFindings,
    decision: {
      approvedForIssuePublish: approvalStatus === "approved_for_issue_publish",
      nextSafeAction,
      githubIssuesPublished: false,
      codexBuildTriggered: false,
      codexTriggerLabelsApproved: false,
      ownerApprovalRequired: true,
      reason: decisionReasonFor({ generation, approvalStatus })
    },
    ownerReadableReport: "",
    followUpTasks: [],
    guardrails: requiredGuardrails()
  };

  approval.ownerReadableReport = renderOwnerReport(approval);
  approval.followUpTasks = buildFollowUpTasks(approval);

  return approval;
}

function validatePhaseIssueGeneration(generation) {
  const missing = [];

  for (const [label, value] of [
    ["kind", generation.kind],
    ["schemaVersion", generation.schemaVersion],
    ["sourceArtifact.kind", generation.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", generation.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", generation.sourceArtifact?.candidateType],
    ["sourceArtifact.finalPacketType", generation.sourceArtifact?.finalPacketType],
    ["sourceArtifact.approvalStatus", generation.sourceArtifact?.approvalStatus],
    ["candidate.name", generation.candidate?.name],
    ["candidate.slug", generation.candidate?.slug],
    ["candidate.type", generation.candidate?.type],
    ["candidate.summary", generation.candidate?.summary],
    ["candidate.needAddressed", generation.candidate?.needAddressed],
    ["candidate.desiredTransformation", generation.candidate?.desiredTransformation],
    ["sourceFinalPacket.kind", generation.sourceFinalPacket?.kind],
    ["sourceFinalPacket.status", generation.sourceFinalPacket?.status],
    ["decision.generationStatus", generation.decision?.generationStatus],
    ["decision.nextSafeAction", generation.decision?.nextSafeAction],
    ["ownerReadableReport", generation.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (generation.kind !== "phase_issue_generation") missing.push("kind.phase_issue_generation");
  if (generation.sourceArtifact?.kind !== "phase_creation_approval") missing.push("sourceArtifact.kind.phase_creation_approval");
  if (generation.sourceArtifact?.approvalStatus !== "approved_for_phase_creation") missing.push("sourceArtifact.approvalStatus.approved");
  if (!finalPacketTypes().includes(generation.sourceFinalPacket?.kind)) missing.push("sourceFinalPacket.kind.allowed");
  if (!Array.isArray(generation.phaseOrder) || generation.phaseOrder.length === 0) missing.push("phaseOrder");
  if (!Array.isArray(generation.labelsToApply) || generation.labelsToApply.length === 0) missing.push("labelsToApply");
  if (!Array.isArray(generation.phaseIssueDrafts) || generation.phaseIssueDrafts.length === 0) missing.push("phaseIssueDrafts");
  if (generation.decision?.phaseIssueDraftsGenerated !== true) missing.push("decision.phaseIssueDraftsGenerated.true");
  if (generation.decision?.githubIssuesCreated !== false) missing.push("decision.githubIssuesCreated.false");
  if (generation.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (generation.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");
  if (generation.guardrails?.phaseIssueDraftGenerationOnly !== true) missing.push("guardrails.phaseIssueDraftGenerationOnly");

  for (const [label, value] of Object.entries(generationRequiredGuardrails())) {
    if (generation.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Cannot approve phase issue publish: missing ${missing.join(", ")}`);
}

function analyzePhaseIssueDrafts(generation) {
  const findings = [];
  const allowedLabels = new Set(["ai:plan", "ai:review", "ai:build", "ai:fix", "ai:growth", "ai:monitor"]);

  generation.phaseIssueDrafts.forEach((draft, index) => {
    const prefix = `phaseIssueDrafts.${index}`;

    if (!isPresent(draft.phase)) findings.push(finding(prefix, "missing_phase", "needs_revision", "Phase id is missing."));
    if (!isPresent(draft.order)) findings.push(finding(prefix, "missing_order", "needs_revision", "Phase order is missing."));
    if (!isPresent(draft.title)) findings.push(finding(prefix, "missing_title", "needs_revision", "Title is missing."));
    if (!isPresent(draft.body)) findings.push(finding(prefix, "missing_body", "needs_revision", "Body is missing."));
    if (!isPresent(draft.recommendedLabel)) findings.push(finding(prefix, "missing_recommended_label", "needs_revision", "Primary recommended label is missing."));
    if (!Array.isArray(draft.recommendedLabels) || draft.recommendedLabels.length === 0) {
      findings.push(finding(prefix, "missing_recommended_labels", "needs_revision", "Recommended labels are missing."));
    }
    if (!Array.isArray(draft.guardrails) || draft.guardrails.length === 0) {
      findings.push(finding(prefix, "missing_guardrails", "needs_revision", "Guardrails are missing."));
    }

    if (generation.phaseOrder[index] !== draft.phase) {
      findings.push(finding(prefix, "phase_order_mismatch", "needs_revision", "Draft order does not match phaseOrder."));
    }

    for (const label of draft.recommendedLabels || []) {
      if (!allowedLabels.has(label)) {
        findings.push(finding(prefix, "unsafe_label", "blocked_by_scope", `Unsupported label: ${label}`));
      }
    }

    if (draft.recommendedLabel && !(draft.recommendedLabels || []).includes(draft.recommendedLabel)) {
      findings.push(finding(prefix, "primary_label_not_in_label_list", "needs_revision", "Primary label is not included in recommendedLabels."));
    }

    const body = String(draft.body || "");
    const requiredBodySections = [
      "## Goal",
      "## Acceptance Criteria",
      "## Labels To Apply",
      "## Required Source Of Truth To Load",
      "## Guardrails",
      "## Non-Goals"
    ];

    for (const section of requiredBodySections) {
      if (!body.includes(section)) findings.push(finding(prefix, "missing_body_section", "needs_revision", `Body is missing ${section}.`));
    }

    if (!body.includes("Source final packet:")) {
      findings.push(finding(prefix, "missing_source_packet_reference", "needs_revision", "Body must reference the source final packet."));
    }
    if (!body.includes("Phase order:")) {
      findings.push(finding(prefix, "missing_phase_order_reference", "needs_revision", "Body must reference phase order."));
    }
    if (!body.includes("Do not trigger Codex build work automatically")) {
      findings.push(finding(prefix, "missing_codex_trigger_guardrail", "needs_revision", "Body must block automatic Codex build work."));
    }

    for (const unsafe of unsafeContentFindings(body)) {
      findings.push(finding(prefix, unsafe.code, unsafe.status, unsafe.message));
    }
  });

  return findings;
}

function unsafeContentFindings(body) {
  const findings = [];
  const checks = [
    [/OPENAI_API_KEY\s*=/i, "secret_or_env_value", "blocked_by_security", "Draft appears to include an OPENAI_API_KEY value."],
    [/AUTH_SECRET\s*=/i, "secret_or_env_value", "blocked_by_security", "Draft appears to include an AUTH_SECRET value."],
    [/VERCEL_TOKEN\s*=/i, "secret_or_env_value", "blocked_by_security", "Draft appears to include a Vercel token value."],
    [/x-vercel-protection-bypass/i, "protected_bypass_url", "blocked_by_security", "Draft appears to include a protected Vercel bypass URL."],
    [/apply migrations now/i, "migration_instruction", "blocked_by_security", "Draft instructs migrations to be applied now."],
    [/run migrations now/i, "migration_instruction", "blocked_by_security", "Draft instructs migrations to run now."],
    [/(^|\n)\s*create paid resource/i, "paid_resource_instruction", "blocked_by_cost", "Draft instructs paid resource creation."],
    [/(^|\n)\s*provision paid/i, "paid_resource_instruction", "blocked_by_cost", "Draft instructs paid provisioning."],
    [/production deploy approved/i, "production_deploy_instruction", "blocked_by_scope", "Draft implies production deploy approval."],
    [/deploy production now/i, "production_deploy_instruction", "blocked_by_scope", "Draft instructs production deploy now."],
    [/(^|\n)\s*auto-merge generated app code/i, "auto_merge_instruction", "blocked_by_scope", "Draft appears to authorize auto-merge."]
  ];

  for (const [pattern, code, status, message] of checks) {
    if (pattern.test(body)) findings.push({ code, status, message });
  }

  return findings;
}

function buildApprovalChecks(approvalInput, draftFindings) {
  const checksInput = approvalInput.approvalChecks || approvalInput.checks || approvalInput;
  const checks = {};
  const missing = [];

  for (const factor of approvalFactors()) {
    const inputCheck = checksInput[factor];
    const derived = derivedCheckFor(factor, draftFindings);
    const status = normalizeCheckStatus(inputCheck?.status || derived.status);
    const notes = inputCheck?.notes || inputCheck?.reason || inputCheck?.summary || derived.notes;

    if (!status) missing.push(`approvalChecks.${factor}.status`);
    if (!isPresent(notes)) missing.push(`approvalChecks.${factor}.notes`);

    checks[factor] = { status, notes };
  }

  if (missing.length) throw new Error(`Cannot approve phase issue publish: missing ${missing.join(", ")}`);

  return checks;
}

function derivedCheckFor(factor, draftFindings) {
  const relevant = draftFindings.filter((item) => factorForFinding(item.code) === factor);
  if (!relevant.length) {
    return {
      status: "pass",
      notes: defaultPassNotes()[factor]
    };
  }

  return {
    status: statusFromFindings(relevant),
    notes: relevant.map((item) => `${item.path}: ${item.message}`).join(" ")
  };
}

function factorForFinding(code) {
  const map = {
    missing_phase: "phaseIssueCompleteness",
    missing_order: "phaseIssueCompleteness",
    missing_title: "phaseIssueCompleteness",
    missing_body: "phaseIssueCompleteness",
    missing_recommended_label: "labelSafety",
    missing_recommended_labels: "labelSafety",
    missing_guardrails: "guardrailCompleteness",
    phase_order_mismatch: "phaseOrderClarity",
    unsafe_label: "labelSafety",
    primary_label_not_in_label_list: "labelSafety",
    missing_body_section: "acceptanceCriteriaCompleteness",
    missing_source_packet_reference: "sourcePacketTraceability",
    missing_phase_order_reference: "phaseOrderClarity",
    missing_codex_trigger_guardrail: "automaticCodexBuildSafety",
    secret_or_env_value: "secretAndEnvSafety",
    protected_bypass_url: "secretAndEnvSafety",
    migration_instruction: "resourceAndReleaseSafety",
    paid_resource_instruction: "resourceAndReleaseSafety",
    production_deploy_instruction: "resourceAndReleaseSafety",
    auto_merge_instruction: "boundedReviewability"
  };

  return map[code] || "boundedReviewability";
}

function approvalStatusFor(checks) {
  const statuses = Object.values(checks).map((check) => check.status);

  if (statuses.includes("blocked_by_security")) return "blocked_by_security";
  if (statuses.includes("blocked_by_cost")) return "blocked_by_cost";
  if (statuses.includes("blocked_by_scope")) return "blocked_by_scope";
  if (statuses.includes("rejected")) return "rejected";
  if (statuses.includes("needs_revision")) return "needs_revision";

  return "approved_for_issue_publish";
}

function statusFromFindings(findings) {
  const statuses = findings.map((item) => item.status);

  if (statuses.includes("blocked_by_security")) return "blocked_by_security";
  if (statuses.includes("blocked_by_cost")) return "blocked_by_cost";
  if (statuses.includes("blocked_by_scope")) return "blocked_by_scope";
  if (statuses.includes("rejected")) return "rejected";
  return "needs_revision";
}

function renderOwnerReport(approval) {
  const failing = failingChecks(approval);
  const lines = [
    "Phase Issue Publish Approval",
    "",
    `Candidate: ${approval.candidate.name}`,
    `Source final packet: ${approval.sourceFinalPacket.kind}`,
    `Status: ${approval.approvalStatus}`,
    `Phase drafts reviewed: ${approval.phaseIssueSummary.phaseOrder.join(", ")}`,
    `Next safe action: ${approval.decision.nextSafeAction}`,
    "Owner approval required: yes",
    "Guardrails: approval gate only, no GitHub issues created, no Codex build, no deploy"
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
  const titleVerb = approval.approvalStatus === "approved_for_issue_publish" ? "Prepare phase issue publish" : "Resolve phase issue publish gate";
  const failing = failingChecks(approval);

  return [
    {
      title: `[${approval.candidate.slug}] ${titleVerb}`,
      recommendedLabel: "ai:plan",
      body: [
        `Review the phase issue publish approval gate for ${approval.candidate.name}.`,
        "",
        "## Candidate",
        `- Type: ${approval.candidate.type}`,
        `- Source final packet: ${approval.sourceFinalPacket.kind}`,
        `- Approval status: ${approval.approvalStatus}`,
        `- Next safe action: ${approval.decision.nextSafeAction}`,
        `- Need addressed: ${approval.candidate.needAddressed}`,
        `- Desired transformation: ${approval.candidate.desiredTransformation}`,
        "",
        "## Phase Issue Summary",
        `- Phase count: ${approval.phaseIssueSummary.phaseCount}`,
        `- Phase order: ${approval.phaseIssueSummary.phaseOrder.join(", ")}`,
        `- Labels to apply later: ${approval.phaseIssueSummary.labelsToApply.join(", ")}`,
        "",
        "## Approval Checks",
        ...approvalFactors().map((factor) => `- ${factor}: ${approval.approvalChecks[factor].status} - ${approval.approvalChecks[factor].notes}`),
        "",
        "## Gate Result",
        approval.decision.approvedForIssuePublish
          ? "- Phase issue drafts are approved for a later explicit publish step. Do not publish GitHub issues in this gate."
          : `- Phase issue publication is not approved. Resolve: ${failing.map((check) => `${check.factor} (${check.status})`).join(", ") || approval.approvalStatus}.`,
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
        "- source-of-truth/phase-issue-generation.md",
        "- source-of-truth/phase-issue-publish-approval-gate.md",
        "- source-of-truth/app-portfolio-registry.md",
        "",
        "## Guardrails",
        "- Approval gate only.",
        "- Do not build UI.",
        "- Do not create GitHub issues yet.",
        "- Do not trigger Codex build work.",
        "- Do not deploy production, create paid resources, apply migrations, add secrets/env vars, change repository visibility, or auto-merge generated app code."
      ].join("\n")
    }
  ];
}

function validatePhaseIssuePublishApproval(artifact) {
  const missing = [];

  for (const [label, value] of [
    ["kind", artifact.kind],
    ["schemaVersion", artifact.schemaVersion],
    ["sourceArtifact.kind", artifact.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", artifact.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", artifact.sourceArtifact?.candidateType],
    ["sourceArtifact.finalPacketType", artifact.sourceArtifact?.finalPacketType],
    ["sourceArtifact.generationStatus", artifact.sourceArtifact?.generationStatus],
    ["candidate.name", artifact.candidate?.name],
    ["candidate.slug", artifact.candidate?.slug],
    ["candidate.type", artifact.candidate?.type],
    ["candidate.summary", artifact.candidate?.summary],
    ["candidate.needAddressed", artifact.candidate?.needAddressed],
    ["candidate.desiredTransformation", artifact.candidate?.desiredTransformation],
    ["sourceFinalPacket.kind", artifact.sourceFinalPacket?.kind],
    ["sourceFinalPacket.status", artifact.sourceFinalPacket?.status],
    ["approvalStatus", artifact.approvalStatus],
    ["decision.nextSafeAction", artifact.decision?.nextSafeAction],
    ["ownerReadableReport", artifact.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (artifact.kind !== "phase_issue_publish_approval") missing.push("kind.phase_issue_publish_approval");
  if (artifact.sourceArtifact?.kind !== "phase_issue_generation") missing.push("sourceArtifact.kind.phase_issue_generation");
  if (!finalPacketTypes().includes(artifact.sourceFinalPacket?.kind)) missing.push("sourceFinalPacket.kind.allowed");
  if (!approvalStatuses().includes(artifact.approvalStatus)) missing.push("approvalStatus.allowed");
  if (artifact.decision?.approvedForIssuePublish !== (artifact.approvalStatus === "approved_for_issue_publish")) {
    missing.push("decision.approvedForIssuePublish.matchesApprovalStatus");
  }
  if (artifact.decision?.githubIssuesPublished !== false) missing.push("decision.githubIssuesPublished.false");
  if (artifact.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (artifact.decision?.codexTriggerLabelsApproved !== false) missing.push("decision.codexTriggerLabelsApproved.false");
  if (artifact.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");
  if (!Array.isArray(artifact.phaseIssueSummary?.phaseOrder) || artifact.phaseIssueSummary.phaseOrder.length === 0) missing.push("phaseIssueSummary.phaseOrder");
  if (!Array.isArray(artifact.phaseIssueSummary?.labelsToApply) || artifact.phaseIssueSummary.labelsToApply.length === 0) missing.push("phaseIssueSummary.labelsToApply");
  if (!Array.isArray(artifact.phaseIssueSummary?.draftTitles) || artifact.phaseIssueSummary.draftTitles.length === 0) missing.push("phaseIssueSummary.draftTitles");

  for (const factor of approvalFactors()) {
    if (!artifact.approvalChecks?.[factor]?.status) missing.push(`approvalChecks.${factor}.status`);
    if (!isPresent(artifact.approvalChecks?.[factor]?.notes)) missing.push(`approvalChecks.${factor}.notes`);
  }

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (artifact.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Phase issue publish approval artifact missing required fields: ${missing.join(", ")}`);
}

function failingChecks(approval) {
  return approvalFactors()
    .map((factor) => ({ factor, ...approval.approvalChecks[factor] }))
    .filter((check) => check.status !== "pass");
}

function decisionReasonFor({ generation, approvalStatus }) {
  if (approvalStatus === "approved_for_issue_publish") {
    return `${generation.sourceFinalPacket.kind} phase issue drafts passed publish approval, but this gate did not create GitHub issues.`;
  }

  return `${generation.sourceFinalPacket.kind} phase issue drafts did not pass publish approval: ${approvalStatus}.`;
}

function nextSafeActionFor(status) {
  const actions = {
    approved_for_issue_publish: "prepare_phase_issue_publish",
    needs_revision: "revise_phase_issue_drafts",
    rejected: "record_phase_issue_publish_rejection",
    blocked_by_security: "create_security_review_issue",
    blocked_by_cost: "create_cost_review_issue",
    blocked_by_scope: "create_scope_review_issue"
  };

  return actions[status] || "revise_phase_issue_drafts";
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

function defaultPassNotes() {
  return {
    phaseIssueCompleteness: "Every draft has the required title, body, phase, order, labels, guardrails, and issue-ready shape.",
    sourcePacketTraceability: "Every draft references the source final packet.",
    phaseOrderClarity: "Draft order matches phase order.",
    labelSafety: "Labels are present, supported, and remain recommendations until a later publish step.",
    guardrailCompleteness: "Every draft includes guardrails.",
    acceptanceCriteriaCompleteness: "Every draft includes acceptance criteria.",
    automaticCodexBuildSafety: "Drafts block automatic Codex build work.",
    secretAndEnvSafety: "Drafts do not expose secrets, env values, or protected bypass links.",
    resourceAndReleaseSafety: "Drafts do not authorize production deploys, paid resources, or migrations.",
    boundedReviewability: "The phase list is bounded and reviewable."
  };
}

function generationRequiredGuardrails() {
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

function requiredGuardrails() {
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

function finding(pathLabel, code, status, message) {
  return {
    path: pathLabel,
    code,
    status,
    message
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
