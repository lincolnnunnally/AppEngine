import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createProblemIntakeGateRecord } from "@/lib/engine/problem-intake-gate";

export type ProblemIntakeMode = "problem_first" | "vision_first" | "hybrid";

export type ProblemIntakeStatus =
  | "submitted"
  | "needs_clarification"
  | "routed_to_portfolio"
  | "ready_for_review"
  | "packet_drafted"
  | "phase_issues_drafted";

export type ProblemIntakeSolutionShape =
  | "app"
  | "website"
  | "workflow_process"
  | "automation"
  | "content_resource"
  | "community_ministry_model"
  | "multi_part_ecosystem_solution";

export type ProblemIntakeRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  mode: ProblemIntakeMode;
  status: ProblemIntakeStatus;
  title: string;
  problemSummary: string;
  affectedPeople: string;
  desiredChange: string;
  urgency: string;
  currentBarriers: string;
  possibleSolutionIdeas: string;
  likelySolutionShape: ProblemIntakeSolutionShape;
  nextRecommendedAction: string;
  safetyNotes: string[];
  gatePacketId: string;
  deprecationNotice: string;
  artifacts: {
    problemSolutionIntake: Record<string, unknown>;
    problemPortfolioRouting: Record<string, unknown>;
    solutionCandidateReview: Record<string, unknown>;
    appPortfolioRegistryEntry: Record<string, unknown>;
  };
  improvementCandidates: OwnerFeedbackImprovementCandidate[];
};

export type OwnerFeedbackImprovementCandidate = {
  kind: "owner_feedback_improvement_candidate";
  schemaVersion: 1;
  id: string;
  intakeId: string;
  createdAt: string;
  note: string;
  source: "owner_control_center";
  status: "draft";
  nextSafeAction: "review_before_issue_creation";
  guardrails: ReturnType<typeof problemIntakeGuardrails>;
};

type ProblemIntakeStore = {
  schemaVersion: 1;
  records: ProblemIntakeRecord[];
};

type CreateProblemIntakeInput = {
  mode?: unknown;
  problemSummary?: unknown;
  affectedPeople?: unknown;
  desiredChange?: unknown;
  urgency?: unknown;
  currentBarriers?: unknown;
  possibleSolutionIdeas?: unknown;
  likelySolutionShape?: unknown;
};

type OwnerFeedbackInput = {
  intakeId?: unknown;
  note?: unknown;
};

const sourceOfTruthFiles = [
  "source-of-truth/00-why-we-build.md",
  "source-of-truth/01-ecosystem-philosophy.md",
  "source-of-truth/02-global-principles.md",
  "source-of-truth/03-life-produces-life.md",
  "source-of-truth/04-app-purpose-rules.md",
  "source-of-truth/05-ecosystem-design-gates.md",
  "source-of-truth/problem-to-solution-intake-standard.md",
  "source-of-truth/problem-portfolio-routing-standard.md",
  "source-of-truth/solution-candidate-review-gate.md",
  "source-of-truth/app-portfolio-registry.md"
];

export function problemIntakeGuardrails() {
  return {
    localMockPersistence: true,
    noAutomaticCodexTrigger: true,
    noExecutionLabels: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noGeneratedCodeAutoMerge: true,
    ownerReviewRequiredBeforeBuild: true
  };
}

export async function listProblemIntakeRecords() {
  const store = await readProblemIntakeStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createProblemIntakeRecord(input: CreateProblemIntakeInput) {
  const now = new Date().toISOString();
  const normalized = normalizeProblemIntake(input);
  const id = randomUUID();
  const title = createTitle(normalized.problemSummary);
  const nextRecommendedAction = chooseNextRecommendedAction(normalized.mode);
  const safetyNotes = [
    "Stored in a local/mock AppEngine intake store for this first product slice.",
    "No GitHub labels, Codex runs, production deploys, paid resources, migrations, secrets, or env changes are triggered.",
    "Owner review is required before portfolio routing becomes a packet, issue, PR, or build."
  ];

  const base = {
    id,
    createdAt: now,
    updatedAt: now,
    title,
    status: "submitted" as const,
    nextRecommendedAction,
    safetyNotes,
    improvementCandidates: [] as OwnerFeedbackImprovementCandidate[],
    ...normalized
  };

  const problemSolutionIntake = buildProblemSolutionIntakeArtifact(base);
  const problemPortfolioRouting = buildProblemPortfolioRoutingArtifact(base, problemSolutionIntake);
  const solutionCandidateReview = buildSolutionCandidateReviewArtifact(base, problemPortfolioRouting);
  const appPortfolioRegistryEntry = buildAppPortfolioRegistryEntry(base);

  // Compatibility adapter: create the canonical problem_intake_gate packet and
  // reference it. The lite artifacts below remain for backward compatibility but
  // the gate packet is the single source of truth.
  const gateRecord = await createProblemIntakeGateRecord({
    rawRequest: normalized.problemSummary,
    problemBeingSolved: normalized.problemSummary,
    intendedPerson: normalized.affectedPeople,
    requestType: normalized.likelySolutionShape === "app" ? "app_idea" : undefined
  });

  const record: ProblemIntakeRecord = {
    ...base,
    gatePacketId: gateRecord.id,
    deprecationNotice:
      "Problem Intake Lite is a compatibility adapter. New work should start at the Problem Intake Gate (/problem-intake). This record references the canonical problem_intake_gate packet.",
    artifacts: {
      problemSolutionIntake,
      problemPortfolioRouting,
      solutionCandidateReview,
      appPortfolioRegistryEntry
    }
  };

  const store = await readProblemIntakeStore();
  store.records.unshift(record);
  await writeProblemIntakeStore(store);
  return record;
}

export async function addOwnerFeedbackImprovementCandidate(input: OwnerFeedbackInput) {
  const intakeId = cleanText(input.intakeId);
  const note = cleanText(input.note);

  if (!intakeId) {
    throw new Error("Choose an intake item before saving feedback.");
  }

  if (note.length < 8) {
    throw new Error("Add a little more detail about what failed or felt confusing.");
  }

  const store = await readProblemIntakeStore();
  const record = store.records.find((candidate) => candidate.id === intakeId);

  if (!record) {
    throw new Error("That intake item could not be found.");
  }

  const createdAt = new Date().toISOString();
  const improvementCandidate: OwnerFeedbackImprovementCandidate = {
    kind: "owner_feedback_improvement_candidate",
    schemaVersion: 1,
    id: randomUUID(),
    intakeId,
    createdAt,
    note,
    source: "owner_control_center",
    status: "draft",
    nextSafeAction: "review_before_issue_creation",
    guardrails: problemIntakeGuardrails()
  };

  record.updatedAt = createdAt;
  record.improvementCandidates.unshift(improvementCandidate);
  await writeProblemIntakeStore(store);
  return record;
}

function normalizeProblemIntake(input: CreateProblemIntakeInput) {
  const mode = parseMode(input.mode);
  const problemSummary = cleanText(input.problemSummary);
  const affectedPeople = cleanText(input.affectedPeople);
  const desiredChange = cleanText(input.desiredChange);
  const urgency = cleanText(input.urgency);
  const currentBarriers = cleanText(input.currentBarriers);
  const possibleSolutionIdeas = cleanText(input.possibleSolutionIdeas);
  const likelySolutionShape = parseSolutionShape(input.likelySolutionShape, mode);
  const missing = [];

  for (const [label, value] of [
    ["what was noticed", problemSummary],
    ["who is affected", affectedPeople],
    ["desired change", desiredChange],
    ["urgency", urgency],
    ["current barriers", currentBarriers]
  ]) {
    if (value.length < 3) missing.push(label);
  }

  if (problemSummary.length < 12) missing.push("a clearer problem or vision summary");

  if (missing.length) {
    throw new Error(`Please add: ${missing.join(", ")}.`);
  }

  return {
    mode,
    problemSummary,
    affectedPeople,
    desiredChange,
    urgency,
    currentBarriers,
    possibleSolutionIdeas,
    likelySolutionShape
  };
}

function buildProblemSolutionIntakeArtifact(record: Omit<ProblemIntakeRecord, "artifacts" | "gatePacketId" | "deprecationNotice">) {
  const answered = [
    "problem.summary",
    "problem.affectedPeople",
    "problem.barriers",
    "problem.needAddressed",
    "problem.desiredTransformation",
    "solutionShape.primary"
  ];
  const missing = record.possibleSolutionIdeas ? [] : ["possible solution ideas"];

  return {
    kind: "problem_solution_intake",
    schemaVersion: 1,
    mode: record.mode,
    rawRequest: record.problemSummary,
    problem: {
      summary: record.problemSummary,
      affectedPeople: splitLines(record.affectedPeople),
      currentWorkaround: "Not captured in this lite intake yet.",
      barriers: splitLines(record.currentBarriers),
      possibleRootCauses: ["Needs owner review before root causes are claimed."],
      needAddressed: record.desiredChange,
      desiredTransformation: record.desiredChange,
      movementTowardLife: record.desiredChange,
      helpsPeopleHelpOthers: "To be clarified during owner review."
    },
    vision: {
      summary: record.mode === "problem_first" ? "" : record.possibleSolutionIdeas,
      proposedSolution: record.possibleSolutionIdeas,
      firstUsefulScope: "Owner review must confirm the smallest safe next step.",
      nonGoals: ["production deploy", "paid resources", "migrations", "automatic Codex execution"]
    },
    solutionShape: {
      primary: record.likelySolutionShape,
      secondary: record.likelySolutionShape === "app" ? ["workflow_process"] : [],
      rationale: "Selected from the Problem Intake Lite form and still requires owner review.",
      existingAppFit: {
        status: "ambiguous",
        candidateApps: [],
        reason: "The lite intake does not select an existing app automatically."
      }
    },
    questions: {
      answered,
      missing
    },
    routing: {
      nextAgent: "planner",
      recommendedLabel: "ai:plan",
      nextArtifact: "problem_portfolio_routing",
      nextSafeAction: "owner_review_before_routing",
      reason: "A human-readable intake exists, but owner review is required before any issue, packet, or build work."
    },
    ownerReadableSummary: `Mode: ${record.mode}. Suggested solution shape: ${record.likelySolutionShape}. Next: owner review before portfolio routing.`,
    guardrails: problemIntakeGuardrails()
  };
}

function buildProblemPortfolioRoutingArtifact(
  record: Omit<ProblemIntakeRecord, "artifacts" | "gatePacketId" | "deprecationNotice">,
  problemSolutionIntake: Record<string, unknown>
) {
  const candidateType = toCandidateType(record.likelySolutionShape);

  return {
    kind: "problem_portfolio_routing",
    schemaVersion: 1,
    sourceArtifact: {
      kind: problemSolutionIntake.kind,
      mode: record.mode,
      rawRequest: record.problemSummary
    },
    candidate: {
      name: record.title,
      slug: slugify(record.title),
      type: candidateType,
      secondaryTypes: record.likelySolutionShape === "app" ? ["workflow_process_candidate"] : [],
      summary: record.problemSummary,
      affectedPeople: splitLines(record.affectedPeople),
      barriers: splitLines(record.currentBarriers),
      needAddressed: record.desiredChange,
      desiredTransformation: record.desiredChange,
      solutionShape: {
        primary: record.likelySolutionShape,
        secondary: record.likelySolutionShape === "app" ? ["workflow_process"] : [],
        rationale: "Problem Intake Lite captured this as the likely solution shape."
      }
    },
    portfolioDestination: {
      kind: "app_portfolio_registry",
      action: "add_candidate",
      trackingState: "candidate_review",
      requiredFields: [
        "name",
        "slug",
        "candidateType",
        "currentVersion",
        "deploymentState",
        "buildState",
        "nextSafeAction",
        "sourceOfTruthFiles",
        "linkedIssues",
        "linkedPRs"
      ]
    },
    requiredReviewGates: [
      "source_of_truth_gate",
      "problem_clarity_gate",
      "owner_review_gate",
      "portfolio_registry_gate",
      "boundary_gate",
      "cost_guardrail_gate",
      "security_privacy_gate"
    ].map((id) => ({ id, status: "required", blocksBuildPacket: true })),
    routing: {
      nextSafeAction: "owner_review_before_packet",
      recommendedLabel: "none",
      nextArtifact: "solution_candidate_review",
      ownerApprovalRequired: true
    },
    ownerReadableReport: `${record.title} is captured as ${candidateType}. Owner review is required before creating packets, phase issues, or execution labels.`,
    followUpTasks: [],
    guardrails: problemIntakeGuardrails()
  };
}

function buildSolutionCandidateReviewArtifact(
  record: Omit<ProblemIntakeRecord, "artifacts" | "gatePacketId" | "deprecationNotice">,
  problemPortfolioRouting: Record<string, unknown>
) {
  const readinessStatus =
    record.likelySolutionShape === "app"
      ? "ready_for_app_build_packet"
      : record.likelySolutionShape === "multi_part_ecosystem_solution"
        ? "needs_clarification"
        : "ready_for_non_app_solution_plan";

  return {
    kind: "solution_candidate_review",
    schemaVersion: 1,
    sourceArtifact: {
      kind: problemPortfolioRouting.kind,
      candidateSlug: slugify(record.title),
      candidateType: toCandidateType(record.likelySolutionShape)
    },
    candidate: {
      name: record.title,
      slug: slugify(record.title),
      type: toCandidateType(record.likelySolutionShape),
      summary: record.problemSummary,
      needAddressed: record.desiredChange,
      desiredTransformation: record.desiredChange
    },
    readinessStatus,
    review: {
      problemClarity: reviewFactor("pass", "The lite intake has a plain-language problem or vision summary."),
      intendedTransformation: reviewFactor("pass", "The desired change is captured for owner review."),
      audienceUser: reviewFactor("pass", "Affected people are captured in the intake."),
      solutionShape: reviewFactor("pass", "The suggested solution shape is captured but not final."),
      dataSecurityPrivacyNeeds: reviewFactor("pass", "No sensitive data workflow, secrets, or production path is authorized."),
      costProviderImpact: reviewFactor("pass", "No paid provider action is authorized."),
      buildComplexity: reviewFactor("pass", "The next step is review only."),
      appEcosystemFit: reviewFactor("needs_owner_review", "Owner review must confirm app boundaries before packet creation."),
      ownerApprovalRequirements: reviewFactor("pass", "Owner approval is required before packet creation or execution labels.")
    },
    decision: {
      ready: readinessStatus !== "needs_clarification",
      blockers: [],
      missingContext: readinessStatus === "needs_clarification" ? ["solution split and app boundary decision"] : [],
      nextSafeAction: "owner_review_before_packet",
      nextArtifact: "candidate_packet_bridge_after_approval",
      ownerApprovalRequired: true
    },
    ownerReadableReport: `${record.title}: ${readinessStatus}. Next safe action is owner review before any packet or build work.`,
    followUpTasks: [],
    guardrails: problemIntakeGuardrails()
  };
}

function buildAppPortfolioRegistryEntry(record: Omit<ProblemIntakeRecord, "artifacts" | "gatePacketId" | "deprecationNotice">) {
  return {
    kind: "app_portfolio_registry_candidate_entry",
    schemaVersion: 1,
    name: record.title,
    slug: slugify(record.title),
    candidateType: toCandidateType(record.likelySolutionShape),
    reviewUrl: "not-created-yet",
    productionUrl: "approval-gated",
    currentVersion: "candidate",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "owner_review_before_packet",
    sourceOfTruthFiles: sourceOfTruthFiles,
    linkedIssues: [],
    linkedPRs: [],
    guardrails: problemIntakeGuardrails()
  };
}

function reviewFactor(status: "pass" | "needs_owner_review", notes: string) {
  return { status, notes };
}

function chooseNextRecommendedAction(mode: ProblemIntakeMode) {
  if (mode === "problem_first") return "Review the problem, then decide whether to route it into the portfolio.";
  if (mode === "vision_first") return "Review the vision, then approve routing before any packet or build work.";
  return "Review the problem and vision together, then decide whether this should split into multiple candidates.";
}

function parseMode(value: unknown): ProblemIntakeMode {
  if (value === "problem_first" || value === "vision_first" || value === "hybrid") return value;
  return "problem_first";
}

function parseSolutionShape(value: unknown, mode: ProblemIntakeMode): ProblemIntakeSolutionShape {
  const allowed: ProblemIntakeSolutionShape[] = [
    "app",
    "website",
    "workflow_process",
    "automation",
    "content_resource",
    "community_ministry_model",
    "multi_part_ecosystem_solution"
  ];

  if (typeof value === "string" && allowed.includes(value as ProblemIntakeSolutionShape)) {
    return value as ProblemIntakeSolutionShape;
  }

  if (mode === "vision_first") return "app";
  if (mode === "hybrid") return "multi_part_ecosystem_solution";
  return "workflow_process";
}

function toCandidateType(shape: ProblemIntakeSolutionShape) {
  const map: Record<ProblemIntakeSolutionShape, string> = {
    app: "new_app_candidate",
    website: "website_candidate",
    workflow_process: "workflow_process_candidate",
    automation: "automation_candidate",
    content_resource: "content_resource_candidate",
    community_ministry_model: "ministry_community_model_candidate",
    multi_part_ecosystem_solution: "multi_part_ecosystem_solution"
  };

  return map[shape];
}

function createTitle(summary: string) {
  const firstSentence = summary.split(/[.!?]/)[0]?.trim() || "New Problem Intake";
  const words = firstSentence.split(/\s+/).slice(0, 8).join(" ");
  return words.length > 70 ? `${words.slice(0, 67)}...` : words;
}

function splitLines(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || "solution-candidate";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

async function readProblemIntakeStore(): Promise<ProblemIntakeStore> {
  const storePath = problemIntakeStorePath();

  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as ProblemIntakeStore;
    if (parsed.schemaVersion === 1 && Array.isArray(parsed.records)) return parsed;
  } catch (caught) {
    if (!isMissingFileError(caught)) throw caught;
  }

  return { schemaVersion: 1, records: [] };
}

async function writeProblemIntakeStore(store: ProblemIntakeStore) {
  const storePath = problemIntakeStorePath();
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`);
}

function problemIntakeStorePath() {
  return path.join("/tmp", "appengine-problem-intake-lite", "store.json");
}

function isMissingFileError(caught: unknown) {
  return typeof caught === "object" && caught !== null && "code" in caught && caught.code === "ENOENT";
}
