import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.PROBLEM_PORTFOLIO_ROUTING_INPUT || "";
const artifactOutput = process.env.PROBLEM_PORTFOLIO_ROUTING_OUTPUT || "";
const markdownOutput = process.env.PROBLEM_PORTFOLIO_ROUTING_MARKDOWN_OUTPUT || "";
const followUpsOutput = process.env.PROBLEM_PORTFOLIO_ROUTING_FOLLOWUPS_OUTPUT || "";

const input = readInput(inputPath);
const sourceArtifact = input.problemSolutionIntake || input.problem_solution_intake || input;
const routing = buildProblemPortfolioRouting(sourceArtifact);

validateProblemPortfolioRouting(routing);

if (artifactOutput) writeJson(artifactOutput, routing);
if (markdownOutput) writeText(markdownOutput, renderRoutingMarkdown(routing));
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks: routing.followUpTasks });

console.log(`problem-portfolio-routing ok: ${routing.candidate.slug} -> ${routing.candidate.type}`);
console.log(`portfolio action: ${routing.portfolioDestination.action}`);

function buildProblemPortfolioRouting(intake) {
  validateProblemSolutionIntake(intake);

  const candidateType = classifyCandidateType(intake);
  const candidateName = inferCandidateName(intake);
  const candidateSlug = slugify(candidateName);
  const secondaryTypes = classifySecondaryTypes(intake, candidateType);
  const requiredReviewGates = buildReviewGates(candidateType);
  const portfolioAction = portfolioActionFor(intake, candidateType);
  const nextSafeAction = nextSafeActionFor(candidateType, portfolioAction);

  const routing = {
    kind: "problem_portfolio_routing",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "problem_solution_intake",
      mode: intake.mode,
      rawRequest: intake.rawRequest
    },
    candidate: {
      name: candidateName,
      slug: candidateSlug,
      type: candidateType,
      secondaryTypes,
      summary: buildCandidateSummary(intake, candidateType),
      affectedPeople: intake.problem.affectedPeople,
      barriers: intake.problem.barriers,
      needAddressed: intake.problem.needAddressed,
      desiredTransformation: intake.problem.desiredTransformation,
      movementTowardLife: intake.problem.movementTowardLife,
      solutionShape: {
        primary: intake.solutionShape.primary,
        secondary: normalizeArray(intake.solutionShape.secondary),
        rationale: intake.solutionShape.rationale
      }
    },
    portfolioDestination: {
      kind: "app_portfolio_registry",
      action: portfolioAction,
      trackingState: "candidate_review",
      requiredFields: [
        "name",
        "slug",
        "candidateType",
        "reviewUrl",
        "productionUrl",
        "currentVersion",
        "deploymentState",
        "buildState",
        "nextSafeAction",
        "sourceOfTruthFiles",
        "linkedIssues",
        "linkedPRs"
      ]
    },
    requiredReviewGates,
    routing: {
      nextSafeAction,
      recommendedLabel: "ai:plan",
      nextArtifact: nextArtifactFor(candidateType),
      ownerApprovalRequired: true,
      reason: "Track this solution candidate in the portfolio and complete review gates before any build packet."
    },
    ownerReadableReport: renderOwnerReport({
      candidateName,
      candidateType,
      secondaryTypes,
      portfolioAction,
      nextSafeAction,
      intake,
      requiredReviewGates
    }),
    followUpTasks: buildFollowUpTasks({
      candidateName,
      candidateSlug,
      candidateType,
      portfolioAction,
      nextSafeAction,
      intake,
      requiredReviewGates
    }),
    guardrails: requiredGuardrails()
  };

  return routing;
}

function validateProblemSolutionIntake(intake) {
  const missing = [];

  for (const [label, value] of [
    ["kind", intake.kind],
    ["mode", intake.mode],
    ["rawRequest", intake.rawRequest],
    ["problem.summary", intake.problem?.summary],
    ["problem.needAddressed", intake.problem?.needAddressed],
    ["problem.desiredTransformation", intake.problem?.desiredTransformation],
    ["problem.movementTowardLife", intake.problem?.movementTowardLife],
    ["solutionShape.primary", intake.solutionShape?.primary],
    ["solutionShape.rationale", intake.solutionShape?.rationale],
    ["routing.nextSafeAction", intake.routing?.nextSafeAction]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  for (const [label, value] of [
    ["problem.affectedPeople", intake.problem?.affectedPeople],
    ["problem.barriers", intake.problem?.barriers]
  ]) {
    if (!Array.isArray(value) || value.length === 0) missing.push(label);
  }

  if (intake.kind !== "problem_solution_intake") missing.push("kind.problem_solution_intake");
  if (!["problem_first", "vision_first", "hybrid"].includes(intake.mode)) missing.push("mode.allowed");
  if (!allowedSolutionShapes().includes(intake.solutionShape?.primary)) missing.push("solutionShape.primary.allowed");
  if (intake.guardrails?.planningOnly !== true) missing.push("guardrails.planningOnly");

  if (missing.length) throw new Error(`Cannot route problem_solution_intake to portfolio: missing ${missing.join(", ")}`);
}

function validateProblemPortfolioRouting(artifact) {
  const missing = [];

  for (const [label, value] of [
    ["kind", artifact.kind],
    ["schemaVersion", artifact.schemaVersion],
    ["sourceArtifact.kind", artifact.sourceArtifact?.kind],
    ["sourceArtifact.mode", artifact.sourceArtifact?.mode],
    ["sourceArtifact.rawRequest", artifact.sourceArtifact?.rawRequest],
    ["candidate.name", artifact.candidate?.name],
    ["candidate.slug", artifact.candidate?.slug],
    ["candidate.type", artifact.candidate?.type],
    ["candidate.summary", artifact.candidate?.summary],
    ["candidate.needAddressed", artifact.candidate?.needAddressed],
    ["candidate.desiredTransformation", artifact.candidate?.desiredTransformation],
    ["candidate.solutionShape.primary", artifact.candidate?.solutionShape?.primary],
    ["portfolioDestination.kind", artifact.portfolioDestination?.kind],
    ["portfolioDestination.action", artifact.portfolioDestination?.action],
    ["portfolioDestination.trackingState", artifact.portfolioDestination?.trackingState],
    ["routing.nextSafeAction", artifact.routing?.nextSafeAction],
    ["routing.recommendedLabel", artifact.routing?.recommendedLabel],
    ["ownerReadableReport", artifact.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  for (const [label, value] of [
    ["candidate.affectedPeople", artifact.candidate?.affectedPeople],
    ["candidate.barriers", artifact.candidate?.barriers],
    ["requiredReviewGates", artifact.requiredReviewGates]
  ]) {
    if (!Array.isArray(value) || value.length === 0) missing.push(label);
  }

  if (artifact.kind !== "problem_portfolio_routing") missing.push("kind.problem_portfolio_routing");
  if (artifact.sourceArtifact?.kind !== "problem_solution_intake") missing.push("sourceArtifact.kind.problem_solution_intake");
  if (artifact.portfolioDestination?.kind !== "app_portfolio_registry") missing.push("portfolioDestination.kind.app_portfolio_registry");
  if (!allowedCandidateTypes().includes(artifact.candidate?.type)) missing.push("candidate.type.allowed");
  if (artifact.routing?.ownerApprovalRequired !== true) missing.push("routing.ownerApprovalRequired");

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (artifact.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Problem portfolio routing artifact missing required fields: ${missing.join(", ")}`);
}

function classifyCandidateType(intake) {
  const primary = intake.solutionShape.primary;
  const existingStatus = intake.solutionShape.existingAppFit?.status || "";

  if (primary === "app") return existingStatus === "existing" ? "existing_app_improvement" : "new_app_candidate";
  if (primary === "website") return "website_candidate";
  if (primary === "workflow_process") return "workflow_process_candidate";
  if (primary === "automation") return "automation_candidate";
  if (primary === "content_resource") return "content_resource_candidate";
  if (primary === "community_ministry_model") return "ministry_community_model_candidate";
  if (primary === "multi_part_ecosystem_solution") return "multi_part_ecosystem_solution";
  return "new_app_candidate";
}

function classifySecondaryTypes(intake, primaryType) {
  const values = normalizeArray(intake.solutionShape.secondary)
    .map((shape) => {
      if (shape === "app") return intake.solutionShape.existingAppFit?.status === "existing" ? "existing_app_improvement" : "new_app_candidate";
      if (shape === "website") return "website_candidate";
      if (shape === "workflow_process") return "workflow_process_candidate";
      if (shape === "automation") return "automation_candidate";
      if (shape === "content_resource") return "content_resource_candidate";
      if (shape === "community_ministry_model") return "ministry_community_model_candidate";
      if (shape === "multi_part_ecosystem_solution") return "multi_part_ecosystem_solution";
      return "";
    })
    .filter(Boolean)
    .filter((value) => value !== primaryType);

  return Array.from(new Set(values));
}

function buildReviewGates(candidateType) {
  const common = [
    gate("source_of_truth_gate"),
    gate("problem_clarity_gate"),
    gate("owner_review_gate"),
    gate("portfolio_registry_gate"),
    gate("boundary_gate"),
    gate("cost_guardrail_gate"),
    gate("security_privacy_gate")
  ];

  const byType = {
    new_app_candidate: ["app_selection_gate", "app_build_packet_gate", "identity_auth_gate", "super_admin_gate", "provider_cost_gate", "release_gate"],
    existing_app_improvement: ["existing_app_context_gate", "vnext_packet_gate", "release_history_gate", "provider_cost_gate", "release_gate"],
    website_candidate: ["domain_hosting_gate", "content_ownership_gate", "preview_review_gate"],
    workflow_process_candidate: ["process_owner_gate", "manual_workflow_test_gate"],
    automation_candidate: ["integration_permission_gate", "runtime_cost_gate", "failure_mode_gate"],
    content_resource_candidate: ["content_source_gate", "editorial_review_gate"],
    ministry_community_model_candidate: ["care_safety_gate", "leadership_owner_gate", "relational_boundaries_gate"],
    multi_part_ecosystem_solution: ["solution_split_gate", "connection_review_gate", "systems_review_gate"]
  };

  return [...common, ...(byType[candidateType] || []).map(gate)];
}

function gate(id) {
  return {
    id,
    status: "required",
    blocksBuildPacket: true
  };
}

function portfolioActionFor(intake, candidateType) {
  if (candidateType === "existing_app_improvement") return "link_existing_app";
  if (candidateType === "multi_part_ecosystem_solution") return "split_candidate";
  if ((intake.questions?.missing || []).length > 4) return "block_until_review";
  return "add_candidate";
}

function nextSafeActionFor(candidateType, portfolioAction) {
  if (portfolioAction === "block_until_review") return "create_planning_issue";
  if (candidateType === "existing_app_improvement") return "create_vnext_packet";
  if (candidateType === "new_app_candidate") return "create_planning_issue";
  return "create_planning_issue";
}

function nextArtifactFor(candidateType) {
  if (candidateType === "existing_app_improvement") return "vnext_candidate_review";
  if (candidateType === "new_app_candidate") return "app_candidate_review";
  if (candidateType === "multi_part_ecosystem_solution") return "ecosystem_solution_options";
  return "portfolio_candidate_review";
}

function buildCandidateSummary(intake, candidateType) {
  return `${candidateType.replace(/_/g, " ")} for ${intake.problem.summary}`;
}

function renderOwnerReport({ candidateName, candidateType, secondaryTypes, portfolioAction, nextSafeAction, intake, requiredReviewGates }) {
  const typeLine = secondaryTypes.length ? `${candidateType} + ${secondaryTypes.join(", ")}` : candidateType;

  return [
    "Problem Intake To Portfolio Routing",
    "",
    `Candidate: ${candidateName}`,
    `Type: ${typeLine}`,
    `Portfolio action: ${portfolioAction}`,
    `Why: ${intake.solutionShape.rationale}`,
    `Review gates before build: ${requiredReviewGates.map((item) => item.id).join(", ")}`,
    `Next safe action: ${nextSafeAction}`,
    "Owner decision needed: approve candidate direction before packet creation",
    "Guardrails: planning only, no production, no paid resources, no migrations"
  ].join("\n");
}

function renderRoutingMarkdown(artifact) {
  return `${artifact.ownerReadableReport}\n`;
}

function buildFollowUpTasks({ candidateName, candidateSlug, candidateType, portfolioAction, nextSafeAction, intake, requiredReviewGates }) {
  return [
    {
      title: `[${candidateSlug}] Portfolio candidate review`,
      recommendedLabel: "ai:plan",
      body: [
        `Review the portfolio candidate routing for ${candidateName}.`,
        "",
        "## Candidate",
        `- Type: ${candidateType}`,
        `- Portfolio action: ${portfolioAction}`,
        `- Problem: ${intake.problem.summary}`,
        `- Need addressed: ${intake.problem.needAddressed}`,
        `- Desired transformation: ${intake.problem.desiredTransformation}`,
        `- Next safe action: ${nextSafeAction}`,
        "",
        "## Required Review Gates",
        ...requiredReviewGates.map((item) => `- ${item.id}`),
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
        "- source-of-truth/app-selection-standard.md",
        "- source-of-truth/app-portfolio-registry.md when available",
        "",
        "## Guardrails",
        "- Planning/routing only.",
        "- Do not build intake UI.",
        "- Do not deploy production, create paid resources, apply migrations, add secrets/env vars, change repository visibility, or auto-merge generated app code."
      ].join("\n")
    }
  ];
}

function inferCandidateName(intake) {
  const proposed = intake.vision?.proposedSolution || intake.vision?.summary || "";
  const existingCandidates = normalizeArray(intake.solutionShape.existingAppFit?.candidateApps);
  if (intake.solutionShape.existingAppFit?.status === "existing" && existingCandidates[0]) return titleFromSlug(existingCandidates[0]);
  if (proposed) return titleFromText(proposed);
  return titleFromText(intake.problem.summary);
}

function titleFromText(value) {
  const cleaned = String(value || "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ");
  return cleaned || "Solution Candidate";
}

function titleFromSlug(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ") || "Solution Candidate";
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "solution-candidate";
}

function requiredGuardrails() {
  return {
    planningOnly: true,
    noPublicIntakeUi: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noGeneratedCodeAutoMerge: true,
    requiresReviewBeforeBuildPacket: true
  };
}

function allowedSolutionShapes() {
  return ["app", "website", "workflow_process", "automation", "content_resource", "community_ministry_model", "multi_part_ecosystem_solution"];
}

function allowedCandidateTypes() {
  return ["new_app_candidate", "existing_app_improvement", "website_candidate", "workflow_process_candidate", "automation_candidate", "content_resource_candidate", "ministry_community_model_candidate", "multi_part_ecosystem_solution"];
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null) : [];
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
