import { randomUUID } from "node:crypto";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";

export type OpportunityIntakeMode = "problem" | "vision" | "tools" | "help_start";

export type OpportunitySolutionType =
  | "not_sure"
  | "app_tool_workflow"
  | "content_resource"
  | "community_ministry_model"
  | "existing_ecosystem_service_later"
  | "multi_part_solution";

export type OpportunityRoute =
  | "app_tool_workflow_need"
  | "content_resource_need"
  | "community_ministry_model_need"
  | "existing_ecosystem_service_later"
  | "needs_clarification";

export type OpportunityStatus = "submitted" | "needs_clarification" | "ready_for_appengine_review";

export type OpportunityIntakeRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  mode: OpportunityIntakeMode;
  status: OpportunityStatus;
  title: string;
  problemPain: string;
  affectedPeople: string;
  betterOutcome: string;
  currentBarriers: string;
  existingIdeaVision: string;
  desiredImpact: string;
  possibleSolutionType: OpportunitySolutionType;
  route: OpportunityRoute;
  routingReason: string;
  nextRecommendedAction: string;
  copyableNextPrompt: string;
  safetyNotes: string[];
  artifact: OpportunityIntakeArtifact;
};

export type OpportunityIntakeArtifact = {
  kind: "opportunity_intake";
  schemaVersion: 1;
  source: "public_opportunity_intake";
  mode: OpportunityIntakeMode;
  route: OpportunityRoute;
  status: OpportunityStatus;
  problem: {
    pain: string;
    affectedPeople: string;
    betterOutcome: string;
    currentBarriers: string;
  };
  vision: {
    existingIdea: string;
    desiredImpact: string;
    possibleSolutionType: OpportunitySolutionType;
  };
  routing: {
    destination: OpportunityRoute;
    reason: string;
    nextSafeAction: "owner_review_before_problem_solution_intake";
    appEngineFactory: true;
    ecosystemDestinationsNotAssumedBuilt: true;
  };
  sourceOfTruthFiles: string[];
  guardrails: ReturnType<typeof opportunityIntakeGuardrails>;
  ownerReadableSummary: string;
  copyableNextPrompt: string;
};

type OpportunityIntakeStore = {
  schemaVersion: 1;
  records: OpportunityIntakeRecord[];
};

type CreateOpportunityIntakeInput = {
  mode?: unknown;
  problemPain?: unknown;
  affectedPeople?: unknown;
  betterOutcome?: unknown;
  currentBarriers?: unknown;
  existingIdeaVision?: unknown;
  desiredImpact?: unknown;
  possibleSolutionType?: unknown;
};

const sourceOfTruthFiles = [
  "source-of-truth/00-why-we-build.md",
  "source-of-truth/01-ecosystem-philosophy.md",
  "source-of-truth/02-global-principles.md",
  "source-of-truth/03-life-produces-life.md",
  "source-of-truth/04-app-purpose-rules.md",
  "source-of-truth/05-ecosystem-design-gates.md",
  "source-of-truth/opportunity-intake-foundation.md",
  "source-of-truth/problem-to-solution-intake-standard.md",
  "source-of-truth/problem-portfolio-routing-standard.md",
  "source-of-truth/app-portfolio-registry.md"
];

export function opportunityIntakeGuardrails() {
  return {
    ...durableStateGuardrails(),
    adapterBackedLocalMockPersistence: true,
    opportunityIsFrontDoorOnly: true,
    appEngineIsProductionFactory: true,
    ecosystemServicesNotAssumedBuilt: true,
    ownerReviewRequiredBeforeRouting: true
  };
}

export async function listOpportunityIntakeRecords() {
  const store = await readOpportunityIntakeStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createOpportunityIntakeRecord(input: CreateOpportunityIntakeInput) {
  const now = new Date().toISOString();
  const normalized = normalizeOpportunityIntake(input);
  const route = chooseOpportunityRoute(normalized.possibleSolutionType);
  const status: OpportunityStatus = route === "needs_clarification" ? "needs_clarification" : "ready_for_appengine_review";
  const title = createTitle(normalized.problemPain || normalized.existingIdeaVision);
  const routingReason = explainRoute(route, normalized.possibleSolutionType);
  const nextRecommendedAction = chooseNextRecommendedAction(route);
  const safetyNotes = [
    "Saved through the AppEngine state adapter with local/mock persistence as the current default.",
    "Opportunity is the guided front door; it does not claim Spark, Live On Mission, Best Life, or other ecosystem services are fully built.",
    "No Codex run, GitHub issue, label, deployment, migration, paid resource, secret, or env change is triggered.",
    "Owner review is required before this becomes a problem_solution_intake, portfolio candidate, packet, or build."
  ];
  const base = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    title,
    status,
    route,
    routingReason,
    nextRecommendedAction,
    safetyNotes,
    ...normalized
  };
  const copyableNextPrompt = buildNextPrompt(base);
  const artifact = buildOpportunityIntakeArtifact({ ...base, copyableNextPrompt });
  const record: OpportunityIntakeRecord = {
    ...base,
    copyableNextPrompt,
    artifact
  };
  const store = await readOpportunityIntakeStore();
  await writeOpportunityIntakeStore({
    schemaVersion: 1,
    records: [record, ...store.records]
  });
  return record;
}

function buildOpportunityIntakeArtifact(record: Omit<OpportunityIntakeRecord, "artifact">): OpportunityIntakeArtifact {
  return {
    kind: "opportunity_intake",
    schemaVersion: 1,
    source: "public_opportunity_intake",
    mode: record.mode,
    route: record.route,
    status: record.status,
    problem: {
      pain: record.problemPain,
      affectedPeople: record.affectedPeople,
      betterOutcome: record.betterOutcome,
      currentBarriers: record.currentBarriers
    },
    vision: {
      existingIdea: record.existingIdeaVision,
      desiredImpact: record.desiredImpact,
      possibleSolutionType: record.possibleSolutionType
    },
    routing: {
      destination: record.route,
      reason: record.routingReason,
      nextSafeAction: "owner_review_before_problem_solution_intake",
      appEngineFactory: true,
      ecosystemDestinationsNotAssumedBuilt: true
    },
    sourceOfTruthFiles,
    guardrails: opportunityIntakeGuardrails(),
    ownerReadableSummary: `${record.title}: ${record.route.replaceAll("_", " ")}. Next: ${record.nextRecommendedAction}`,
    copyableNextPrompt: record.copyableNextPrompt
  };
}

function normalizeOpportunityIntake(input: CreateOpportunityIntakeInput) {
  const mode = parseMode(input.mode);
  const problemPain = cleanText(input.problemPain);
  const affectedPeople = cleanText(input.affectedPeople);
  const betterOutcome = cleanText(input.betterOutcome);
  const currentBarriers = cleanText(input.currentBarriers);
  const existingIdeaVision = cleanText(input.existingIdeaVision);
  const desiredImpact = cleanText(input.desiredImpact);
  const possibleSolutionType = parseSolutionType(input.possibleSolutionType);
  const missing = [];

  for (const [label, value] of [
    ["problem or pain", problemPain],
    ["who is affected", affectedPeople],
    ["better outcome", betterOutcome],
    ["current barriers", currentBarriers],
    ["desired impact", desiredImpact]
  ]) {
    if (value.length < 3) missing.push(label);
  }

  if (problemPain.length < 12) missing.push("a clearer description of the problem or opportunity");

  if (missing.length) {
    throw new Error(`Please add: ${missing.join(", ")}.`);
  }

  return {
    mode,
    problemPain,
    affectedPeople,
    betterOutcome,
    currentBarriers,
    existingIdeaVision,
    desiredImpact,
    possibleSolutionType
  };
}

function parseMode(value: unknown): OpportunityIntakeMode {
  if (value === "problem" || value === "vision" || value === "tools" || value === "help_start") return value;
  return "problem";
}

function parseSolutionType(value: unknown): OpportunitySolutionType {
  const allowed: OpportunitySolutionType[] = [
    "not_sure",
    "app_tool_workflow",
    "content_resource",
    "community_ministry_model",
    "existing_ecosystem_service_later",
    "multi_part_solution"
  ];

  if (typeof value === "string" && allowed.includes(value as OpportunitySolutionType)) {
    return value as OpportunitySolutionType;
  }

  return "not_sure";
}

function chooseOpportunityRoute(solutionType: OpportunitySolutionType): OpportunityRoute {
  const map: Record<OpportunitySolutionType, OpportunityRoute> = {
    not_sure: "needs_clarification",
    app_tool_workflow: "app_tool_workflow_need",
    content_resource: "content_resource_need",
    community_ministry_model: "community_ministry_model_need",
    existing_ecosystem_service_later: "existing_ecosystem_service_later",
    multi_part_solution: "needs_clarification"
  };

  return map[solutionType];
}

function explainRoute(route: OpportunityRoute, solutionType: OpportunitySolutionType) {
  if (route === "needs_clarification" && solutionType === "multi_part_solution") {
    return "This may need several connected pieces, so owner review should split it before routing.";
  }

  if (route === "needs_clarification") {
    return "The best solution path is not clear enough yet for packet or build work.";
  }

  if (route === "existing_ecosystem_service_later") {
    return "This may connect to an ecosystem service later, but no destination is assumed to be fully built today.";
  }

  return "The selected solution type is specific enough for owner review before AppEngine routing.";
}

function chooseNextRecommendedAction(route: OpportunityRoute) {
  if (route === "needs_clarification") {
    return "Ask one or two clarifying questions before creating a problem_solution_intake artifact.";
  }

  return "Review the opportunity, then decide whether to convert it into a problem_solution_intake and portfolio candidate.";
}

function buildNextPrompt(record: Omit<OpportunityIntakeRecord, "artifact" | "copyableNextPrompt">) {
  return `Review this Opportunity intake for AppEngine.\n\nMode: ${record.mode}\nRoute: ${record.route}\nProblem/pain: ${record.problemPain}\nWho is affected: ${record.affectedPeople}\nBetter outcome: ${record.betterOutcome}\nCurrent barriers: ${record.currentBarriers}\nExisting idea/vision: ${record.existingIdeaVision || "None captured"}\nDesired impact: ${record.desiredImpact}\n\nGoal: Decide whether this should become a problem_solution_intake, portfolio candidate, non-app solution plan, or needs clarification.\n\nGuardrails: Do not trigger Codex, create GitHub issues, apply labels, deploy production, create paid resources, run migrations, add secrets/env vars, change repo visibility, or claim ecosystem services are already built.`;
}

function createTitle(summary: string) {
  const firstSentence = summary.split(/[.!?]/)[0]?.trim() || "New Opportunity";
  const words = firstSentence.split(/\s+/).slice(0, 9).join(" ");
  return words.length > 74 ? `${words.slice(0, 71)}...` : words;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

async function readOpportunityIntakeStore(): Promise<OpportunityIntakeStore> {
  return getAppEngineStateAdapter().readJson<OpportunityIntakeStore>(
    { kind: "opportunity_intake", key: "records" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeOpportunityIntakeStore(store: OpportunityIntakeStore) {
  return getAppEngineStateAdapter().writeJson({ kind: "opportunity_intake", key: "records" }, store);
}
