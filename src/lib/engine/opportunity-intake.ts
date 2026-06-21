import { randomUUID } from "node:crypto";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import {
  createProblemIntakeGateRecord,
  type ProblemIntakeGateRecord,
  type ProblemIntakeLikelyApp,
  type ProblemIntakeNextPhase,
  type ProblemIntakeRequestType
} from "@/lib/engine/problem-intake-gate";

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

// The opportunity intake runs through the Problem Intake Gate so the same
// documents, control gates, and "no build before the gates" policy apply to the
// vision/problem front door — it cannot route straight to a build phase.
export type OpportunityControlGateView = {
  requestType: ProblemIntakeRequestType;
  likelyApp: ProblemIntakeLikelyApp;
  nextSafePhase: ProblemIntakeNextPhase;
  applicableControlGates: string[];
  blockedActions: string[];
  missingContext: string[];
};

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
  gate: OpportunityControlGateView;
  gatePacketId: string;
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
  controlGates: OpportunityControlGateView;
  gatePacketId: string;
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
    ownerReviewRequiredBeforeRouting: true,
    routesThroughProblemIntakeGate: true,
    noBuildBeforeControlGates: true,
    noArchitectureDesignImplementationFromConversation: true
  };
}

export async function listOpportunityIntakeRecords() {
  const store = await readOpportunityIntakeStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOpportunityIntakeRecord(intakeId: string) {
  const store = await readOpportunityIntakeStore();
  return store.records.find((record) => record.id === intakeId) || null;
}

export async function createOpportunityIntakeRecord(input: CreateOpportunityIntakeInput) {
  const now = new Date().toISOString();
  const normalized = normalizeOpportunityIntake(input);
  const route = chooseOpportunityRoute(normalized.possibleSolutionType);
  const status: OpportunityStatus = route === "needs_clarification" ? "needs_clarification" : "ready_for_appengine_review";
  const title = createTitle(normalized.problemPain || normalized.existingIdeaVision);
  const routingReason = explainRoute(route, normalized.possibleSolutionType);
  // Create the canonical problem_intake_gate packet and reference its ID. The
  // opportunity record is a rich capture view; the gate packet is the source of
  // truth for request type, control gates, and next safe phase.
  const gateRecord = await createProblemIntakeGateRecord({
    rawRequest: normalized.problemPain,
    problemBeingSolved: normalized.problemPain,
    intendedPerson: normalized.affectedPeople,
    requestType: requestTypeForOpportunity(normalized.mode, normalized.possibleSolutionType)
  });
  const gate = toControlGateView(gateRecord);
  const gatePacketId = gateRecord.id;
  const nextRecommendedAction = chooseNextRecommendedAction(route, gate);
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
    gate,
    gatePacketId,
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
    controlGates: record.gate,
    gatePacketId: record.gatePacketId,
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

function toControlGateView(gateRecord: ProblemIntakeGateRecord): OpportunityControlGateView {
  return {
    requestType: gateRecord.requestType,
    likelyApp: gateRecord.likelyApp,
    nextSafePhase: gateRecord.nextSafePhase,
    applicableControlGates: gateRecord.applicableControlGates,
    blockedActions: gateRecord.blockedActions,
    missingContext: gateRecord.missingContext
  };
}

function requestTypeForOpportunity(
  mode: OpportunityIntakeMode,
  solutionType: OpportunitySolutionType
): ProblemIntakeRequestType | undefined {
  if (solutionType === "app_tool_workflow") return "app_idea";
  if (mode === "vision") return "opportunity";
  if (mode === "problem" || mode === "help_start") return "problem";
  // "tools" without an app/tool solution type: let the gate classify from text.
  return undefined;
}

function chooseNextRecommendedAction(route: OpportunityRoute, gate: OpportunityControlGateView) {
  const gateCount = gate.applicableControlGates.length;

  if (gate.nextSafePhase === "clarify_problem" || route === "needs_clarification") {
    return `Clarify the problem first, then run the ${gateCount} control gates starting with prior_work_check. No architecture, design, or implementation until the gates pass.`;
  }

  return `Run the ${gateCount} control gates starting with prior_work_check, then decide problem_solution_intake vs portfolio candidate. No architecture, design, or implementation until the gates pass.`;
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
