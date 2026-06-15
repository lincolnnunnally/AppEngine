import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.SOLUTION_CANDIDATE_REVIEW_INPUT || "";
const artifactOutput = process.env.SOLUTION_CANDIDATE_REVIEW_OUTPUT || "";
const markdownOutput = process.env.SOLUTION_CANDIDATE_REVIEW_MARKDOWN_OUTPUT || "";
const followUpsOutput = process.env.SOLUTION_CANDIDATE_REVIEW_FOLLOWUPS_OUTPUT || "";

const input = readInput(inputPath);
const sourceArtifact = input.problemPortfolioRouting || input.problem_portfolio_routing || input;
const reviewInput = input.review || input.solutionCandidateReview || input.solution_candidate_review || sourceArtifact.review || {};
const candidateReview = buildSolutionCandidateReview(sourceArtifact, reviewInput);

validateSolutionCandidateReview(candidateReview);

if (artifactOutput) writeJson(artifactOutput, candidateReview);
if (markdownOutput) writeText(markdownOutput, renderReviewMarkdown(candidateReview));
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks: candidateReview.followUpTasks });

console.log(`solution-candidate-review ok: ${candidateReview.candidate.slug} -> ${candidateReview.readinessStatus}`);
console.log(`next safe action: ${candidateReview.decision.nextSafeAction}`);

function buildSolutionCandidateReview(routing, reviewInput) {
  const routingIssues = validateProblemPortfolioRouting(routing);
  const review = normalizeReview(reviewInput);
  const decision = decideReadiness(routing, review, routingIssues);
  const source = routing.sourceArtifact || {};
  const candidate = routing.candidate || {};

  const artifact = {
    kind: "solution_candidate_review",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "problem_portfolio_routing",
      candidateSlug: candidate.slug,
      candidateType: candidate.type,
      sourceMode: source.mode,
      rawRequest: source.rawRequest
    },
    candidate: {
      name: candidate.name,
      slug: candidate.slug,
      type: candidate.type,
      summary: candidate.summary,
      affectedPeople: normalizeArray(candidate.affectedPeople),
      barriers: normalizeArray(candidate.barriers),
      needAddressed: candidate.needAddressed,
      desiredTransformation: candidate.desiredTransformation,
      solutionShape: candidate.solutionShape || {}
    },
    readinessStatus: decision.readinessStatus,
    review,
    decision: {
      ready: decision.ready,
      blockers: decision.blockers,
      missingContext: decision.missingContext,
      nextSafeAction: decision.nextSafeAction,
      nextArtifact: decision.nextArtifact,
      ownerApprovalRequired: true,
      reason: decision.reason
    },
    ownerReadableReport: renderOwnerReport({
      routing,
      review,
      decision
    }),
    followUpTasks: buildFollowUpTasks({
      routing,
      review,
      decision
    }),
    guardrails: requiredGuardrails()
  };

  return artifact;
}

function validateProblemPortfolioRouting(routing) {
  const missing = [];

  for (const [label, value] of [
    ["kind", routing.kind],
    ["schemaVersion", routing.schemaVersion],
    ["sourceArtifact.kind", routing.sourceArtifact?.kind],
    ["candidate.name", routing.candidate?.name],
    ["candidate.slug", routing.candidate?.slug],
    ["candidate.type", routing.candidate?.type],
    ["candidate.summary", routing.candidate?.summary],
    ["candidate.needAddressed", routing.candidate?.needAddressed],
    ["candidate.desiredTransformation", routing.candidate?.desiredTransformation],
    ["candidate.solutionShape.primary", routing.candidate?.solutionShape?.primary],
    ["portfolioDestination.kind", routing.portfolioDestination?.kind],
    ["portfolioDestination.action", routing.portfolioDestination?.action],
    ["routing.nextSafeAction", routing.routing?.nextSafeAction]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  for (const [label, value] of [
    ["candidate.affectedPeople", routing.candidate?.affectedPeople],
    ["candidate.barriers", routing.candidate?.barriers],
    ["requiredReviewGates", routing.requiredReviewGates]
  ]) {
    if (!Array.isArray(value) || value.length === 0) missing.push(label);
  }

  if (routing.kind !== "problem_portfolio_routing") missing.push("kind.problem_portfolio_routing");
  if (routing.sourceArtifact?.kind !== "problem_solution_intake") missing.push("sourceArtifact.kind.problem_solution_intake");
  if (routing.portfolioDestination?.kind !== "app_portfolio_registry") missing.push("portfolioDestination.kind.app_portfolio_registry");
  if (!allowedCandidateTypes().includes(routing.candidate?.type)) missing.push("candidate.type.allowed");
  if (routing.routing?.ownerApprovalRequired !== true) missing.push("routing.ownerApprovalRequired");
  if (routing.guardrails?.planningOnly !== true) missing.push("guardrails.planningOnly");

  return missing;
}

function normalizeReview(reviewInput) {
  return Object.fromEntries(reviewFactors().map((factor) => [factor.id, normalizeReviewFactor(factor, reviewInput[factor.id])]));
}

function normalizeReviewFactor(factor, rawValue) {
  if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
    const normalizedStatus = normalizeStatus(factor, rawValue.status || rawValue.value || rawValue.result);

    return {
      status: normalizedStatus,
      notes: rawValue.notes || rawValue.summary || rawValue.reason || defaultNotesFor(factor, normalizedStatus),
      missing: normalizeArray(rawValue.missing),
      blocker: rawValue.blocker || blockerForStatus(normalizedStatus)
    };
  }

  const normalizedStatus = normalizeStatus(factor, rawValue);

  return {
    status: normalizedStatus,
    notes: defaultNotesFor(factor, normalizedStatus),
    missing: isPresent(rawValue) ? [] : [factor.label],
    blocker: blockerForStatus(normalizedStatus)
  };
}

function normalizeStatus(factor, value) {
  if (!isPresent(value)) return "needs_clarification";

  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, "_");
  if (["pass", "passed", "clear", "sufficient", "ready", "approved", "documented", "low", "medium", "ok", "yes"].includes(normalized)) {
    return "pass";
  }

  if (["needs_clarification", "clarification", "unclear", "missing", "unknown", "incomplete", "ambiguous"].includes(normalized)) {
    return "needs_clarification";
  }

  if (["blocked_by_security", "security_blocked", "privacy_blocked", "secret_risk", "sensitive_data_blocked"].includes(normalized)) {
    return "blocked_by_security";
  }

  if (["blocked_by_cost", "cost_blocked", "provider_blocked", "budget_blocked", "paid_resource_blocked"].includes(normalized)) {
    return "blocked_by_cost";
  }

  if (["blocked_by_scope", "scope_blocked", "too_broad", "unbounded", "crosses_boundaries"].includes(normalized)) {
    return "blocked_by_scope";
  }

  if (factor.blockerStatus && normalized === "blocked") return factor.blockerStatus;
  return "needs_clarification";
}

function decideReadiness(routing, review, routingIssues) {
  const blockers = [];
  const missingContext = [...routingIssues];

  for (const factor of reviewFactors()) {
    const result = review[factor.id];
    if (result.status === "needs_clarification") {
      missingContext.push(...(result.missing.length ? result.missing : [factor.label]));
    }

    if (result.status.startsWith("blocked_by_")) {
      blockers.push({
        factor: factor.id,
        status: result.status,
        reason: result.notes
      });
    }
  }

  const blockerStatus = strongestBlocker(blockers);
  if (blockerStatus) {
    return {
      ready: false,
      readinessStatus: blockerStatus,
      blockers,
      missingContext: unique(missingContext),
      nextSafeAction: nextSafeActionFor(blockerStatus),
      nextArtifact: "focused_review_follow_up",
      reason: `Candidate is blocked by ${blockerStatus.replace("blocked_by_", "")}.`
    };
  }

  if (missingContext.length) {
    return {
      ready: false,
      readinessStatus: "needs_clarification",
      blockers: [],
      missingContext: unique(missingContext),
      nextSafeAction: "create_clarification_issue",
      nextArtifact: "candidate_clarification_request",
      reason: "Candidate review is missing required context."
    };
  }

  const readinessStatus = readyStatusFor(routing.candidate.type);

  return {
    ready: true,
    readinessStatus,
    blockers: [],
    missingContext: [],
    nextSafeAction: nextSafeActionFor(readinessStatus),
    nextArtifact: nextArtifactFor(readinessStatus),
    reason: "Candidate review passed and is ready for the next packet or plan request."
  };
}

function strongestBlocker(blockers) {
  const statuses = blockers.map((item) => item.status);
  if (statuses.includes("blocked_by_security")) return "blocked_by_security";
  if (statuses.includes("blocked_by_cost")) return "blocked_by_cost";
  if (statuses.includes("blocked_by_scope")) return "blocked_by_scope";
  return "";
}

function readyStatusFor(candidateType) {
  if (candidateType === "new_app_candidate") return "ready_for_app_build_packet";
  if (candidateType === "existing_app_improvement") return "ready_for_vnext_packet";
  return "ready_for_non_app_solution_plan";
}

function nextSafeActionFor(readinessStatus) {
  const actions = {
    needs_clarification: "create_clarification_issue",
    ready_for_app_build_packet: "create_app_build_packet_issue",
    ready_for_vnext_packet: "create_vnext_packet_issue",
    ready_for_non_app_solution_plan: "create_non_app_solution_plan_issue",
    blocked_by_security: "create_security_review_issue",
    blocked_by_cost: "create_cost_review_issue",
    blocked_by_scope: "create_scope_review_issue"
  };

  return actions[readinessStatus] || "create_clarification_issue";
}

function nextArtifactFor(readinessStatus) {
  const artifacts = {
    ready_for_app_build_packet: "app_build_packet_request",
    ready_for_vnext_packet: "vnext_packet_request",
    ready_for_non_app_solution_plan: "non_app_solution_plan_request"
  };

  return artifacts[readinessStatus] || "candidate_clarification_request";
}

function renderOwnerReport({ routing, decision }) {
  const candidate = routing.candidate || {};
  const blockerLine = decision.blockers.length
    ? decision.blockers.map((item) => `${item.factor}: ${item.status}`).join(", ")
    : "none";
  const missingLine = decision.missingContext.length ? decision.missingContext.join(", ") : "none";

  return [
    "Solution Candidate Review",
    "",
    `Candidate: ${candidate.name}`,
    `Type: ${candidate.type}`,
    `Status: ${decision.readinessStatus}`,
    `Recommended next step: ${decision.nextSafeAction}`,
    `Why: ${decision.reason}`,
    "Owner approval required: yes, approve the candidate direction before packet or plan creation",
    `Blockers: ${blockerLine}`,
    `Missing context: ${missingLine}`,
    "Guardrails: planning/review only, no UI, no packets created, no production, no paid resources, no migrations"
  ].join("\n");
}

function renderReviewMarkdown(artifact) {
  return `${artifact.ownerReadableReport}\n`;
}

function buildFollowUpTasks({ routing, review, decision }) {
  const candidate = routing.candidate || {};
  return [
    {
      title: `[${candidate.slug}] ${titleForStatus(decision.readinessStatus)}`,
      recommendedLabel: "ai:plan",
      body: [
        `Review the solution candidate decision for ${candidate.name}.`,
        "",
        "## Candidate",
        `- Type: ${candidate.type}`,
        `- Readiness status: ${decision.readinessStatus}`,
        `- Need addressed: ${candidate.needAddressed}`,
        `- Desired transformation: ${candidate.desiredTransformation}`,
        `- Next safe action: ${decision.nextSafeAction}`,
        "",
        "## Review Factors",
        ...reviewFactors().map((factor) => `- ${factor.id}: ${review[factor.id].status} - ${review[factor.id].notes}`),
        "",
        "## Blockers",
        ...(decision.blockers.length ? decision.blockers.map((item) => `- ${item.factor}: ${item.status} - ${item.reason}`) : ["- none"]),
        "",
        "## Missing Context",
        ...(decision.missingContext.length ? decision.missingContext.map((item) => `- ${item}`) : ["- none"]),
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
        "- source-of-truth/app-portfolio-registry.md",
        "",
        "## Guardrails",
        "- Planning/review only.",
        "- Do not build UI.",
        "- Do not create App Build Packets or vNext Packets in this step.",
        "- Do not deploy production, create paid resources, apply migrations, add secrets/env vars, change repository visibility, or auto-merge generated app code."
      ].join("\n")
    }
  ];
}

function titleForStatus(readinessStatus) {
  const labels = {
    needs_clarification: "Clarify solution candidate",
    ready_for_app_build_packet: "Prepare App Build Packet request",
    ready_for_vnext_packet: "Prepare vNext Packet request",
    ready_for_non_app_solution_plan: "Prepare non-app solution plan request",
    blocked_by_security: "Resolve security/privacy blocker",
    blocked_by_cost: "Resolve cost/provider blocker",
    blocked_by_scope: "Resolve scope blocker"
  };

  return labels[readinessStatus] || "Review solution candidate";
}

function validateSolutionCandidateReview(artifact) {
  const missing = [];

  for (const [label, value] of [
    ["kind", artifact.kind],
    ["schemaVersion", artifact.schemaVersion],
    ["sourceArtifact.kind", artifact.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", artifact.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", artifact.sourceArtifact?.candidateType],
    ["candidate.name", artifact.candidate?.name],
    ["candidate.slug", artifact.candidate?.slug],
    ["candidate.type", artifact.candidate?.type],
    ["candidate.summary", artifact.candidate?.summary],
    ["candidate.needAddressed", artifact.candidate?.needAddressed],
    ["candidate.desiredTransformation", artifact.candidate?.desiredTransformation],
    ["readinessStatus", artifact.readinessStatus],
    ["decision.nextSafeAction", artifact.decision?.nextSafeAction],
    ["decision.nextArtifact", artifact.decision?.nextArtifact],
    ["ownerReadableReport", artifact.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (artifact.kind !== "solution_candidate_review") missing.push("kind.solution_candidate_review");
  if (artifact.sourceArtifact?.kind !== "problem_portfolio_routing") missing.push("sourceArtifact.kind.problem_portfolio_routing");
  if (!allowedReadinessStatuses().includes(artifact.readinessStatus)) missing.push("readinessStatus.allowed");
  if (artifact.decision?.ownerApprovalRequired !== true) missing.push("decision.ownerApprovalRequired");

  for (const factor of reviewFactors()) {
    if (!artifact.review?.[factor.id]?.status) missing.push(`review.${factor.id}.status`);
  }

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (artifact.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Solution candidate review artifact missing required fields: ${missing.join(", ")}`);
}

function reviewFactors() {
  return [
    { id: "problemClarity", label: "problem clarity", blockerStatus: "blocked_by_scope" },
    { id: "intendedTransformation", label: "intended transformation", blockerStatus: "blocked_by_scope" },
    { id: "audienceUser", label: "audience/user", blockerStatus: "blocked_by_scope" },
    { id: "solutionShape", label: "solution shape", blockerStatus: "blocked_by_scope" },
    { id: "dataSecurityPrivacyNeeds", label: "data/security/privacy needs", blockerStatus: "blocked_by_security" },
    { id: "costProviderImpact", label: "cost/provider impact", blockerStatus: "blocked_by_cost" },
    { id: "buildComplexity", label: "build complexity", blockerStatus: "blocked_by_scope" },
    { id: "appEcosystemFit", label: "app/ecosystem fit", blockerStatus: "blocked_by_scope" },
    { id: "ownerApprovalRequirements", label: "owner approval requirements", blockerStatus: "blocked_by_scope" }
  ];
}

function defaultNotesFor(factor, status) {
  if (status === "pass") return `${factor.label} reviewed and acceptable for the next planning step.`;
  if (status === "needs_clarification") return `${factor.label} needs clarification before the next planning step.`;
  return `${factor.label} blocks the next planning step.`;
}

function blockerForStatus(status) {
  return status.startsWith("blocked_by_") ? status : "";
}

function requiredGuardrails() {
  return {
    planningReviewOnly: true,
    noUi: true,
    noAppBuildPacketsCreated: true,
    noVnextPacketsCreated: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noGeneratedCodeAutoMerge: true
  };
}

function allowedCandidateTypes() {
  return [
    "new_app_candidate",
    "existing_app_improvement",
    "website_candidate",
    "workflow_process_candidate",
    "automation_candidate",
    "content_resource_candidate",
    "ministry_community_model_candidate",
    "multi_part_ecosystem_solution"
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

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null && String(item).trim() !== "") : [];
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => isPresent(value))));
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
