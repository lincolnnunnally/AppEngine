import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectMemory } from "./project-memory";

export type TrialPacketType = "app_build_packet" | "vnext_packet" | "non_app_solution_plan";

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
};

const storeDir = join(process.cwd(), ".app-engine");
const storePath = join(storeDir, "real-project-trials.json");
let memoryStore: StoreShape = { trials: [] };

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

export async function saveRealProjectTrial(input: RealProjectTrialInput, projectMemory?: ProjectMemory) {
  const store = await readStore();
  const trial = createRealProjectTrial(input, projectMemory);
  store.trials = [trial, ...store.trials].slice(0, 50);
  await writeStore(store);

  return trial;
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
      trials: Array.isArray(parsed.trials) ? parsed.trials.map(normalizeTrial).filter(isRealProjectTrialSummary) : []
    };
  } catch {
    return { trials: [] };
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

function normalizeTrial(value: unknown): RealProjectTrialSummary | null {
  if (!value || typeof value !== "object") return null;
  const trial = value as RealProjectTrialSummary;
  if (trial.kind !== "real_project_trial" || !trial.id || !trial.project?.slug) return null;

  return {
    ...trial,
    guardrails: defaultGuardrails()
  };
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
