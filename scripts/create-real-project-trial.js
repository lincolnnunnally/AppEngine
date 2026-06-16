import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.REAL_PROJECT_TRIAL_INPUT || "";
const outputPath = process.env.REAL_PROJECT_TRIAL_OUTPUT || "";

const input = inputPath && fs.existsSync(path.resolve(inputPath)) ? JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8")) : {};
const projectMemory = input.projectMemory || input.project_memory || null;
const trial = createRealProjectTrial(input.realProjectTrial || input.real_project_trial || input, projectMemory);

if (outputPath) {
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(trial, null, 2)}\n`);
}

console.log(`real-project-trial ok: ${trial.project.slug} -> ${trial.recommendedPacketType}`);

function createRealProjectTrial(input = {}, projectMemory = null) {
  const candidate = resolveCandidate(input);
  const createdAt = new Date().toISOString();
  const memorySummary = projectMemory?.summaries?.executive || projectMemory?.latestProjectState?.recommendedNextAction || "Project memory not loaded.";

  return {
    kind: "real_project_trial",
    schemaVersion: 1,
    id: `trial_${candidate.slug}_${Date.now().toString(36)}`,
    createdAt,
    project: {
      name: candidate.name,
      slug: candidate.slug,
      source: candidate.source
    },
    problemBeingSolved: candidate.problem,
    targetAudience: candidate.targetAudience,
    desiredTransformation: candidate.desiredTransformation,
    designIntent: candidate.designIntent,
    currentStage: candidate.currentStage,
    nextSafeAction: candidate.nextSafeAction,
    risksBlockers: candidate.risksBlockers,
    recommendedPacketType: candidate.recommendedPacketType,
    artifactInputs: {
      problemSolutionIntake: artifact("problem_solution_intake", "derived", `Trial starts from: ${candidate.problem}`, [
        "source-of-truth/problem-to-solution-intake-standard.md"
      ]),
      problemPortfolioRouting: artifact(
        "problem_portfolio_routing",
        candidate.source === "portfolio" ? "available" : "needed",
        candidate.source === "portfolio" ? `${candidate.name} is already a managed-app candidate.` : "Manual trial needs portfolio routing.",
        ["source-of-truth/problem-portfolio-routing-standard.md", "source-of-truth/app-portfolio-registry.md"]
      ),
      solutionCandidateReview: artifact(
        "solution_candidate_review",
        "derived",
        `${candidate.name} appears ready for ${formatPacketType(candidate.recommendedPacketType)} review, subject to owner approval.`,
        ["source-of-truth/solution-candidate-review-gate.md"]
      ),
      designIntentProfile: artifact("design_intent_profile", "derived", candidate.designIntent, ["source-of-truth/design-intent-engine.md"]),
      projectMemory: artifact(
        "project_memory",
        memorySummary === "Project memory not loaded." ? "needed" : "available",
        memorySummary,
        ["source-of-truth/project-memory-engine.md"]
      )
    },
    nextPrompt: buildNextPrompt(candidate, memorySummary),
    ownerReadableSummary: `${candidate.name} is ready for a safe real-project trial. Recommended packet: ${formatPacketType(
      candidate.recommendedPacketType
    )}. Next: ${candidate.nextSafeAction}`,
    guardrails: defaultGuardrails()
  };
}

function resolveCandidate(input) {
  const candidates = [sparkCandidate()];
  const selected = input.selectedCandidateSlug ? candidates.find((candidate) => candidate.slug === input.selectedCandidateSlug) : candidates[0];

  if (selected && !input.manualProject?.name) return selected;

  const manual = input.manualProject || {};
  const missing = [
    ["manualProject.name", manual.name],
    ["manualProject.problem", manual.problem],
    ["manualProject.targetAudience", manual.targetAudience],
    ["manualProject.desiredTransformation", manual.desiredTransformation]
  ]
    .filter(([, value]) => !String(value || "").trim())
    .map(([label]) => label);

  if (missing.length) throw new Error(`Real project trial missing required fields: ${missing.join(", ")}`);

  return {
    name: String(manual.name).trim(),
    slug: manual.slug || slugify(manual.name),
    source: "manual",
    problem: String(manual.problem).trim(),
    targetAudience: String(manual.targetAudience).trim(),
    desiredTransformation: String(manual.desiredTransformation).trim(),
    designIntent: manual.designIntent || "warm_approachable, practical, trustworthy, mobile-first, and owner-reviewable.",
    currentStage: manual.currentStage || "Manual trial candidate captured for owner review.",
    nextSafeAction: manual.nextSafeAction || "Route through problem-to-solution intake before any packet or build work.",
    risksBlockers: manual.risksBlockers?.length
      ? manual.risksBlockers
      : ["Source-of-truth files must be created or linked before packet creation.", "Owner approval is required before any phase work."],
    recommendedPacketType: manual.recommendedPacketType || "app_build_packet",
    sourceOfTruthFiles: manual.sourceOfTruthFiles?.length
      ? manual.sourceOfTruthFiles
      : [
          "source-of-truth/problem-to-solution-intake-standard.md",
          "source-of-truth/problem-portfolio-routing-standard.md",
          "source-of-truth/solution-candidate-review-gate.md",
          "source-of-truth/design-intent-engine.md"
        ]
  };
}

function sparkCandidate() {
  return {
    name: "Spark of Hope Intake Lite",
    slug: "spark-of-hope-intake-lite",
    source: "portfolio",
    problem: "People need a simple, safe way to share a story and receive encouragement without a confusing or intimidating intake process.",
    targetAudience: "People looking for hope and encouragement, plus ministry reviewers who need a safe first-pass preview workflow.",
    desiredTransformation: "Move someone from isolation, uncertainty, or silence toward hope, support, and a clear next step.",
    designIntent: "ministry_community, warm_approachable, hopeful, calm, trustworthy, mobile-first, plain-English, and not generic.",
    currentStage: "Verified preview MVP slice with controlled preview persistence planning available.",
    nextSafeAction: "Create a vNext packet for the next owner-reviewed Spark of Hope persistence or review slice.",
    risksBlockers: [
      "Production remains blocked until owner approval.",
      "Real migrations remain review-gated.",
      "Paid resources remain blocked.",
      "Private story content must stay out of mock artifacts and public comments."
    ],
    recommendedPacketType: "vnext_packet",
    sourceOfTruthFiles: [
      "source-of-truth/charters/spark-of-hope-intake-lite.md",
      "source-of-truth/architecture/spark-of-hope-intake-lite.md",
      "source-of-truth/data-model/spark-of-hope-intake-lite.md",
      "source-of-truth/design-intent-engine.md",
      "source-of-truth/app-improvement-vnext-packet.md",
      "source-of-truth/build-completion-orchestrator.md"
    ]
  };
}

function artifact(kind, status, summary, sourceFiles) {
  return {
    kind,
    status,
    summary,
    sourceFiles
  };
}

function buildNextPrompt(candidate, memorySummary) {
  return {
    prompt: [
      `Proceed with a real project trial for ${candidate.name}.`,
      "",
      "Goal:",
      `Use AppEngine to move this project from owner-reviewed trial summary toward a ${formatPacketType(
        candidate.recommendedPacketType
      )}, without triggering implementation automatically.`,
      "",
      "Project:",
      `- Name: ${candidate.name}`,
      `- Slug: ${candidate.slug}`,
      `- Problem: ${candidate.problem}`,
      `- Audience: ${candidate.targetAudience}`,
      `- Desired transformation: ${candidate.desiredTransformation}`,
      `- Design intent: ${candidate.designIntent}`,
      `- Current stage: ${candidate.currentStage}`,
      `- Next safe action: ${candidate.nextSafeAction}`,
      `- Recommended packet type: ${formatPacketType(candidate.recommendedPacketType)}`,
      "",
      "Required source of truth to load:",
      ...candidate.sourceOfTruthFiles.map((filePath) => `- ${filePath}`),
      "",
      "Use these existing AppEngine artifacts where possible:",
      "- problem_solution_intake",
      "- problem_portfolio_routing",
      "- solution_candidate_review",
      "- design_intent_profile",
      "- project_memory",
      "",
      "Project memory snapshot:",
      memorySummary,
      "",
      "Guardrails:",
      "- Do not trigger Codex automatically.",
      "- Do not create GitHub issues.",
      "- Do not apply labels.",
      "- Do not deploy production.",
      "- Do not create paid resources.",
      "- Do not apply migrations.",
      "- Do not add secrets or env vars.",
      "- Do not change repository visibility.",
      "- Do not auto-merge generated app code.",
      "",
      "Expected outcome:",
      `Create a reviewable ${formatPacketType(candidate.recommendedPacketType)} path or explain what is missing before AppEngine may proceed.`
    ].join("\n"),
    reason: `This turns ${candidate.name} from a known project into a bounded, owner-reviewed AppEngine trial instead of more infrastructure work.`,
    expectedOutcome: `A reviewable ${formatPacketType(candidate.recommendedPacketType)} recommendation with no automatic execution.`,
    dependencies: candidate.sourceOfTruthFiles
  };
}

function formatPacketType(value) {
  return (
    {
      app_build_packet: "App Build Packet",
      vnext_packet: "vNext Packet",
      non_app_solution_plan: "Non-App Solution Plan"
    }[value] || value
  );
}

function defaultGuardrails() {
  return {
    ownerApprovalOnly: true,
    noAutomaticCodexExecution: true,
    noGitHubIssueCreation: true,
    noLabelChanges: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noGeneratedAppAutoMerge: true
  };
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
