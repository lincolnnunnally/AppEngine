import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectMemory } from "./project-memory";

export type TrialPacketType = "app_build_packet" | "vnext_packet" | "non_app_solution_plan";

export type TrialResultReviewStatus =
  | "useful"
  | "needs_clarification"
  | "wrong_direction"
  | "missing_requirement"
  | "design_mismatch"
  | "ready_for_next_packet";

export type TrialProjectCandidate = {
  name: string;
  slug: string;
  source: "portfolio" | "manual";
  problem: string;
  targetAudience: string;
  desiredTransformation: string;
  designIntent: string;
  currentStage: string;
  nextSafeAction: string;
  risksBlockers: string[];
  recommendedPacketType: TrialPacketType;
  sourceOfTruthFiles: string[];
};

export type RealProjectTrialInput = {
  selectedCandidateSlug?: string;
  manualProject?: Partial<TrialProjectCandidate>;
};

export type RealProjectTrialSummary = {
  kind: "real_project_trial";
  schemaVersion: 1;
  id: string;
  createdAt: string;
  project: {
    name: string;
    slug: string;
    source: TrialProjectCandidate["source"];
  };
  problemBeingSolved: string;
  targetAudience: string;
  desiredTransformation: string;
  designIntent: string;
  currentStage: string;
  nextSafeAction: string;
  risksBlockers: string[];
  recommendedPacketType: TrialPacketType;
  artifactInputs: {
    problemSolutionIntake: ArtifactReference;
    problemPortfolioRouting: ArtifactReference;
    solutionCandidateReview: ArtifactReference;
    designIntentProfile: ArtifactReference;
    projectMemory: ArtifactReference;
  };
  nextPrompt: {
    prompt: string;
    reason: string;
    expectedOutcome: string;
    dependencies: string[];
  };
  ownerReadableSummary: string;
  guardrails: RealProjectTrialGuardrails;
};

export type TrialResultReviewInput = {
  trialId?: string;
  status: TrialResultReviewStatus | string;
  note?: string;
};

export type TrialResultReview = {
  kind: "trial_result_review";
  schemaVersion: 1;
  id: string;
  createdAt: string;
  trialId: string;
  project: RealProjectTrialSummary["project"];
  reviewStatus: TrialResultReviewStatus;
  ownerNote: string;
  usefulSignals: string[];
  concerns: string[];
  improvementCandidate: {
    title: string;
    summary: string;
    candidateType: "clarification" | "direction_correction" | "requirement_gap" | "design_correction" | "packet_progression";
  };
  nextPrompt: {
    prompt: string;
    reason: string;
    expectedOutcome: string;
    dependencies: string[];
  };
  ownerReadableSummary: string;
  guardrails: RealProjectTrialGuardrails;
};

type ArtifactReference = {
  kind: string;
  status: "available" | "derived" | "needed";
  summary: string;
  sourceFiles: string[];
};

type RealProjectTrialGuardrails = {
  ownerApprovalOnly: true;
  noAutomaticCodexExecution: true;
  noGitHubIssueCreation: true;
  noLabelChanges: true;
  noProductionDeploy: true;
  noPaidResources: true;
  noMigrations: true;
  noSecretsOrEnvChanges: true;
  repositoryVisibilityUnchanged: true;
  noGeneratedAppAutoMerge: true;
};

type StoreShape = {
  trials: RealProjectTrialSummary[];
  reviews: TrialResultReview[];
};

const storeDir = join(process.cwd(), ".app-engine");
const storePath = join(storeDir, "real-project-trials.json");
let memoryStore: StoreShape = { trials: [], reviews: [] };

export function listTrialProjectCandidates(): TrialProjectCandidate[] {
  return [
    {
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
    }
  ];
}

export async function listRealProjectTrials() {
  const store = await readStore();

  return store.trials.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listTrialResultReviews() {
  const store = await readStore();

  return store.reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveRealProjectTrial(input: RealProjectTrialInput, projectMemory?: ProjectMemory) {
  const store = await readStore();
  const trial = createRealProjectTrial(input, projectMemory);
  store.trials = [trial, ...store.trials].slice(0, 50);
  await writeStore(store);

  return trial;
}

export async function saveTrialResultReview(input: TrialResultReviewInput, projectMemory?: ProjectMemory) {
  const store = await readStore();
  const review = createTrialResultReview(input, store.trials, projectMemory);
  store.reviews = [review, ...store.reviews].slice(0, 50);
  await writeStore(store);

  return review;
}

export function createRealProjectTrial(input: RealProjectTrialInput, projectMemory?: ProjectMemory, now = new Date()): RealProjectTrialSummary {
  const candidate = resolveCandidate(input);
  const createdAt = now.toISOString();
  const id = `trial_${candidate.slug}_${now.getTime().toString(36)}`;
  const memorySummary = projectMemory?.summaries?.executive || projectMemory?.latestProjectState?.recommendedNextAction || "Project memory not loaded.";
  const nextPrompt = buildNextPrompt(candidate, memorySummary);

  return {
    kind: "real_project_trial",
    schemaVersion: 1,
    id,
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
    artifactInputs: buildArtifactInputs(candidate, memorySummary),
    nextPrompt,
    ownerReadableSummary: `${candidate.name} is ready for a safe real-project trial. Recommended packet: ${formatPacketType(
      candidate.recommendedPacketType
    )}. Next: ${candidate.nextSafeAction}`,
    guardrails: defaultGuardrails()
  };
}

export function createTrialResultReview(
  input: TrialResultReviewInput,
  trials: RealProjectTrialSummary[],
  projectMemory?: ProjectMemory,
  now = new Date()
): TrialResultReview {
  const trial = resolveTrialForReview(input, trials);
  const reviewStatus = normalizeReviewStatus(input.status);
  const ownerNote = String(input.note || "").trim().slice(0, 1600);
  const createdAt = now.toISOString();
  const improvementCandidate = buildImprovementCandidate({ trial, reviewStatus, ownerNote });
  const nextPrompt = buildReviewNextPrompt({ trial, reviewStatus, ownerNote, projectMemory, improvementCandidate });

  return {
    kind: "trial_result_review",
    schemaVersion: 1,
    id: `trial_review_${trial.project.slug}_${now.getTime().toString(36)}`,
    createdAt,
    trialId: trial.id,
    project: trial.project,
    reviewStatus,
    ownerNote,
    usefulSignals: buildUsefulSignals(reviewStatus, trial),
    concerns: buildConcerns(reviewStatus, ownerNote),
    improvementCandidate,
    nextPrompt,
    ownerReadableSummary: `${trial.project.name} review marked ${formatReviewStatus(reviewStatus)}. Next: ${nextPrompt.expectedOutcome}`,
    guardrails: defaultGuardrails()
  };
}

function resolveCandidate(input: RealProjectTrialInput): TrialProjectCandidate {
  const candidates = listTrialProjectCandidates();
  const selected = input.selectedCandidateSlug
    ? candidates.find((candidate) => candidate.slug === input.selectedCandidateSlug)
    : candidates[0];

  if (selected && !input.manualProject?.name) return selected;

  const manual = input.manualProject || {};
  const name = String(manual.name || "").trim();
  const problem = String(manual.problem || "").trim();
  const targetAudience = String(manual.targetAudience || "").trim();
  const desiredTransformation = String(manual.desiredTransformation || "").trim();

  const missing = [
    ["manualProject.name", name],
    ["manualProject.problem", problem],
    ["manualProject.targetAudience", targetAudience],
    ["manualProject.desiredTransformation", desiredTransformation]
  ]
    .filter(([, value]) => !value)
    .map(([label]) => label);

  if (missing.length) {
    throw new Error(`Real project trial missing required fields: ${missing.join(", ")}`);
  }

  return {
    name,
    slug: manual.slug || slugify(name),
    source: "manual",
    problem,
    targetAudience,
    desiredTransformation,
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

function buildArtifactInputs(candidate: TrialProjectCandidate, memorySummary: string): RealProjectTrialSummary["artifactInputs"] {
  return {
    problemSolutionIntake: {
      kind: "problem_solution_intake",
      status: "derived",
      summary: `Trial starts from the known problem: ${candidate.problem}`,
      sourceFiles: ["source-of-truth/problem-to-solution-intake-standard.md"]
    },
    problemPortfolioRouting: {
      kind: "problem_portfolio_routing",
      status: candidate.source === "portfolio" ? "available" : "needed",
      summary:
        candidate.source === "portfolio"
          ? `${candidate.name} is already a known managed-app candidate.`
          : "Manual trial needs portfolio routing before packet creation.",
      sourceFiles: ["source-of-truth/problem-portfolio-routing-standard.md", "source-of-truth/app-portfolio-registry.md"]
    },
    solutionCandidateReview: {
      kind: "solution_candidate_review",
      status: "derived",
      summary: `${candidate.name} appears ready for ${formatPacketType(candidate.recommendedPacketType)} review, subject to owner approval.`,
      sourceFiles: ["source-of-truth/solution-candidate-review-gate.md"]
    },
    designIntentProfile: {
      kind: "design_intent_profile",
      status: "derived",
      summary: candidate.designIntent,
      sourceFiles: ["source-of-truth/design-intent-engine.md"]
    },
    projectMemory: {
      kind: "project_memory",
      status: memorySummary === "Project memory not loaded." ? "needed" : "available",
      summary: memorySummary,
      sourceFiles: ["source-of-truth/project-memory-engine.md"]
    }
  };
}

function buildNextPrompt(candidate: TrialProjectCandidate, memorySummary: string): RealProjectTrialSummary["nextPrompt"] {
  const packetType = formatPacketType(candidate.recommendedPacketType);
  const prompt = [
    `Proceed with a real project trial for ${candidate.name}.`,
    "",
    "Goal:",
    `Use AppEngine to move this project from owner-reviewed trial summary toward a ${packetType}, without triggering implementation automatically.`,
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
    `- Recommended packet type: ${packetType}`,
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
    `Create a reviewable ${packetType} path or explain what is missing before AppEngine may proceed.`
  ].join("\n");

  return {
    prompt,
    reason: `This turns ${candidate.name} from a known project into a bounded, owner-reviewed AppEngine trial instead of more infrastructure work.`,
    expectedOutcome: `A reviewable ${packetType} recommendation with no automatic execution.`,
    dependencies: candidate.sourceOfTruthFiles
  };
}

async function readStore(): Promise<StoreShape> {
  if (process.env.VERCEL === "1") return memoryStore;

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;

    return {
      trials: Array.isArray(parsed.trials) ? parsed.trials.map(normalizeTrial).filter(isRealProjectTrialSummary) : [],
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews.map(normalizeReview).filter(isTrialResultReview) : []
    };
  } catch {
    return { trials: [], reviews: [] };
  }
}

async function writeStore(store: StoreShape) {
  if (process.env.VERCEL === "1") {
    memoryStore = store;
    return;
  }

  await mkdir(storeDir, { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function isRealProjectTrialSummary(value: RealProjectTrialSummary | null): value is RealProjectTrialSummary {
  return Boolean(value);
}

function isTrialResultReview(value: TrialResultReview | null): value is TrialResultReview {
  return Boolean(value);
}

function normalizeTrial(value: unknown): RealProjectTrialSummary | null {
  if (!value || typeof value !== "object") return null;
  const trial = value as RealProjectTrialSummary;
  if (trial.kind !== "real_project_trial" || !trial.id || !trial.project?.slug) return null;

  return {
    ...trial,
    guardrails: defaultGuardrails()
  };
}

function normalizeReview(value: unknown): TrialResultReview | null {
  if (!value || typeof value !== "object") return null;
  const review = value as TrialResultReview;
  if (review.kind !== "trial_result_review" || !review.id || !review.trialId || !review.project?.slug) return null;

  return {
    ...review,
    reviewStatus: normalizeReviewStatus(review.reviewStatus),
    guardrails: defaultGuardrails()
  };
}

function resolveTrialForReview(input: TrialResultReviewInput, trials: RealProjectTrialSummary[]) {
  const trial = input.trialId ? trials.find((candidate) => candidate.id === input.trialId) : trials[0];

  if (!trial) {
    throw new Error("Trial result review needs a real project trial to review.");
  }

  return trial;
}

function normalizeReviewStatus(value: string): TrialResultReviewStatus {
  if (isReviewStatus(value)) return value;
  throw new Error(`Unsupported trial result review status: ${value || "missing"}`);
}

function isReviewStatus(value: string): value is TrialResultReviewStatus {
  return [
    "useful",
    "needs_clarification",
    "wrong_direction",
    "missing_requirement",
    "design_mismatch",
    "ready_for_next_packet"
  ].includes(value);
}

function buildImprovementCandidate({
  trial,
  reviewStatus,
  ownerNote
}: {
  trial: RealProjectTrialSummary;
  reviewStatus: TrialResultReviewStatus;
  ownerNote: string;
}): TrialResultReview["improvementCandidate"] {
  const byStatus: Record<TrialResultReviewStatus, TrialResultReview["improvementCandidate"]> = {
    useful: {
      title: `${trial.project.name}: preserve useful trial direction`,
      summary: ownerNote || "Owner marked the trial result useful. Preserve this direction in the next packet.",
      candidateType: "packet_progression"
    },
    needs_clarification: {
      title: `${trial.project.name}: clarify trial result before packet work`,
      summary: ownerNote || "Owner needs clearer problem, audience, scope, risks, or next action before packet work.",
      candidateType: "clarification"
    },
    wrong_direction: {
      title: `${trial.project.name}: correct trial direction`,
      summary: ownerNote || "Owner marked the trial direction wrong. Re-check source-of-truth and app boundaries before proceeding.",
      candidateType: "direction_correction"
    },
    missing_requirement: {
      title: `${trial.project.name}: add missing trial requirement`,
      summary: ownerNote || "Owner found a missing requirement that must be added before next packet work.",
      candidateType: "requirement_gap"
    },
    design_mismatch: {
      title: `${trial.project.name}: correct design intent mismatch`,
      summary: ownerNote || "Owner found a design mismatch. Update design intent before UI or packet progression.",
      candidateType: "design_correction"
    },
    ready_for_next_packet: {
      title: `${trial.project.name}: proceed to next packet`,
      summary: ownerNote || `Owner marked the trial ready for ${formatPacketType(trial.recommendedPacketType)} progression.`,
      candidateType: "packet_progression"
    }
  };

  return byStatus[reviewStatus];
}

function buildUsefulSignals(reviewStatus: TrialResultReviewStatus, trial: RealProjectTrialSummary) {
  if (["useful", "ready_for_next_packet"].includes(reviewStatus)) {
    return [
      `Problem is clear: ${trial.problemBeingSolved}`,
      `Audience is clear: ${trial.targetAudience}`,
      `Recommended packet type is ${formatPacketType(trial.recommendedPacketType)}.`
    ];
  }

  return [];
}

function buildConcerns(reviewStatus: TrialResultReviewStatus, ownerNote: string) {
  const concerns: Record<TrialResultReviewStatus, string[]> = {
    useful: [],
    ready_for_next_packet: [],
    needs_clarification: ["Owner needs clarification before packet work."],
    wrong_direction: ["Owner marked the trial direction wrong."],
    missing_requirement: ["Owner identified a missing requirement."],
    design_mismatch: ["Owner identified a design mismatch."]
  };

  return [...concerns[reviewStatus], ...(ownerNote ? [`Owner note: ${ownerNote}`] : [])];
}

function buildReviewNextPrompt({
  trial,
  reviewStatus,
  ownerNote,
  projectMemory,
  improvementCandidate
}: {
  trial: RealProjectTrialSummary;
  reviewStatus: TrialResultReviewStatus;
  ownerNote: string;
  projectMemory?: ProjectMemory;
  improvementCandidate: TrialResultReview["improvementCandidate"];
}): TrialResultReview["nextPrompt"] {
  const actionByStatus: Record<TrialResultReviewStatus, string> = {
    useful: `Preserve the useful direction and prepare the next ${formatPacketType(trial.recommendedPacketType)} checkpoint.`,
    needs_clarification: "Create a clarification-only pass before packet work.",
    wrong_direction: "Re-route the trial through source-of-truth and candidate review before packet work.",
    missing_requirement: "Update the trial requirements before packet work.",
    design_mismatch: "Update design intent before packet work or UI work.",
    ready_for_next_packet: `Prepare the next ${formatPacketType(trial.recommendedPacketType)} path for owner review.`
  };
  const memorySummary = projectMemory?.summaries?.executive || projectMemory?.latestProjectState?.recommendedNextAction || "Project memory not loaded.";

  return {
    prompt: [
      `Review the trial result for ${trial.project.name}.`,
      "",
      "Owner review:",
      `- Status: ${formatReviewStatus(reviewStatus)}`,
      `- Note: ${ownerNote || "No owner note provided."}`,
      `- Improvement candidate: ${improvementCandidate.title}`,
      `- Candidate type: ${improvementCandidate.candidateType}`,
      "",
      "Trial summary:",
      `- Problem: ${trial.problemBeingSolved}`,
      `- Audience: ${trial.targetAudience}`,
      `- Desired transformation: ${trial.desiredTransformation}`,
      `- Design intent: ${trial.designIntent}`,
      `- Current stage: ${trial.currentStage}`,
      `- Recommended packet type: ${formatPacketType(trial.recommendedPacketType)}`,
      "",
      "Next safe action:",
      actionByStatus[reviewStatus],
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
      "Update AppEngine's owner-reviewed path based on the trial feedback and explain what should happen next."
    ].join("\n"),
    reason: `Owner marked the trial as ${formatReviewStatus(reviewStatus)}, so AppEngine should convert that feedback into a bounded improvement candidate before further work.`,
    expectedOutcome: actionByStatus[reviewStatus],
    dependencies: [...trial.nextPrompt.dependencies, "source-of-truth/trial-result-review-loop.md"]
  };
}

export function formatReviewStatus(value: TrialResultReviewStatus) {
  const labels: Record<TrialResultReviewStatus, string> = {
    useful: "useful",
    needs_clarification: "needs clarification",
    wrong_direction: "wrong direction",
    missing_requirement: "missing requirement",
    design_mismatch: "design mismatch",
    ready_for_next_packet: "ready for next packet"
  };

  return labels[value];
}

function defaultGuardrails(): RealProjectTrialGuardrails {
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

function formatPacketType(value: TrialPacketType) {
  const labels: Record<TrialPacketType, string> = {
    app_build_packet: "App Build Packet",
    vnext_packet: "vNext Packet",
    non_app_solution_plan: "Non-App Solution Plan"
  };

  return labels[value];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
