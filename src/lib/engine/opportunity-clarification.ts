import { randomUUID } from "node:crypto";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import {
  getOpportunityIntakeRecord,
  opportunityIntakeGuardrails,
  type OpportunityIntakeRecord,
  type OpportunityRoute
} from "@/lib/engine/opportunity-intake";
import { getProblemIntakeGateRecord, type ProblemIntakeGateRecord } from "@/lib/engine/problem-intake-gate";

export type OpportunityClarificationStatus = "clarified" | "needs_more_info" | "not_actionable_yet" | "safety_sensitive";

export type OpportunityClarificationRoute =
  | "app_tool_workflow"
  | "content_resource"
  | "community_ministry_model"
  | "existing_ecosystem_service_later"
  | "appengine_build_candidate";

export type OpportunityClarificationRecord = {
  id: string;
  intakeId: string;
  createdAt: string;
  updatedAt: string;
  status: OpportunityClarificationStatus;
  route: OpportunityClarificationRoute;
  gatePacketId?: string;
  title: string;
  coreProblem: string;
  affectedPeople: string;
  rootBarriers: string[];
  desiredBetterFuture: string;
  opportunityStatement: string;
  possibleFirstUsefulStep: string;
  likelySolutionType: OpportunityClarificationRoute;
  missingInformation: string[];
  copyableNextPrompt: string;
  safetyNotes: string[];
  artifact: OpportunityClarificationArtifact;
};

export type OpportunityClarificationArtifact = {
  kind: "opportunity_clarification";
  schemaVersion: 1;
  sourceArtifact: {
    kind: "opportunity_intake" | "problem_intake_gate";
    intakeId: string;
    gatePacketId?: string;
    route: OpportunityRoute;
  };
  status: OpportunityClarificationStatus;
  route: OpportunityClarificationRoute;
  clarification: {
    coreProblem: string;
    affectedPeople: string;
    rootBarriers: string[];
    desiredBetterFuture: string;
    opportunityStatement: string;
    possibleFirstUsefulStep: string;
    likelySolutionType: OpportunityClarificationRoute;
    missingInformation: string[];
  };
  routing: {
    destination: OpportunityClarificationRoute;
    nextSafeAction: "owner_review_before_problem_solution_intake";
    appEngineBuildCandidateAllowed: boolean;
    ecosystemDestinationsNotAssumedBuilt: true;
  };
  sourceOfTruthFiles: string[];
  guardrails: ReturnType<typeof opportunityClarificationGuardrails>;
  ownerReadableSummary: string;
  copyableNextPrompt: string;
};

type OpportunityClarificationStore = {
  schemaVersion: 1;
  records: OpportunityClarificationRecord[];
};

const sourceOfTruthFiles = [
  "source-of-truth/00-why-we-build.md",
  "source-of-truth/01-ecosystem-philosophy.md",
  "source-of-truth/02-global-principles.md",
  "source-of-truth/03-life-produces-life.md",
  "source-of-truth/04-app-purpose-rules.md",
  "source-of-truth/05-ecosystem-design-gates.md",
  "source-of-truth/opportunity-intake-foundation.md",
  "source-of-truth/opportunity-clarification-engine.md",
  "source-of-truth/problem-to-solution-intake-standard.md",
  "source-of-truth/problem-portfolio-routing-standard.md"
];

export function opportunityClarificationGuardrails() {
  return {
    ...durableStateGuardrails(),
    ...opportunityIntakeGuardrails(),
    usesOpportunityIntakeAsInput: true,
    adapterBackedLocalMockPersistence: true,
    ownerReviewRequiredBeforeProblemSolutionIntake: true,
    noEcosystemDestinationAssumedBuilt: true
  };
}

export async function listOpportunityClarifications() {
  const store = await readOpportunityClarificationStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOpportunityClarification(clarificationId: string) {
  const store = await readOpportunityClarificationStore();
  return store.records.find((record) => record.id === clarificationId) || null;
}

export async function createOpportunityClarification(input: { intakeId?: unknown; gatePacketId?: unknown }) {
  const gatePacketId = typeof input.gatePacketId === "string" ? input.gatePacketId.trim() : "";
  const intakeId = typeof input.intakeId === "string" ? input.intakeId.trim() : "";

  let intake: OpportunityIntakeRecord;
  let sourceArtifact: OpportunityClarificationArtifact["sourceArtifact"];
  let recordGatePacketId: string | undefined;
  let dedupeKey: string;

  if (gatePacketId) {
    // Clarify an existing canonical gate packet directly. Does not require an
    // opportunity_intake and does not create a second gate packet.
    const gate = await getProblemIntakeGateRecord(gatePacketId);
    if (!gate) {
      throw new Error("That gate packet could not be found.");
    }
    intake = gateRecordToIntakeLike(gate);
    sourceArtifact = { kind: "problem_intake_gate", intakeId: gate.id, gatePacketId: gate.id, route: intake.route };
    recordGatePacketId = gate.id;
    dedupeKey = gate.id;
  } else {
    if (!intakeId) {
      throw new Error("Provide a gatePacketId or an Opportunity intake before creating a clarification.");
    }
    const found = await getOpportunityIntakeRecord(intakeId);
    if (!found) {
      throw new Error("That Opportunity intake could not be found.");
    }
    intake = found;
    sourceArtifact = { kind: "opportunity_intake", intakeId: found.id, route: found.route };
    recordGatePacketId = found.gatePacketId;
    dedupeKey = found.id;
  }

  const now = new Date().toISOString();
  const missingInformation = findMissingInformation(intake);
  const status = chooseStatus(intake, missingInformation);
  const route = chooseClarificationRoute(intake, status);
  const rootBarriers = splitList(intake.currentBarriers);
  const coreProblem = intake.problemPain;
  const affectedPeople = intake.affectedPeople;
  const desiredBetterFuture = intake.betterOutcome;
  const possibleFirstUsefulStep = chooseFirstUsefulStep(route, status);
  const opportunityStatement = createOpportunityStatement(intake, rootBarriers);
  const base = {
    id: randomUUID(),
    intakeId: intake.id,
    gatePacketId: recordGatePacketId,
    createdAt: now,
    updatedAt: now,
    status,
    route,
    title: intake.title,
    coreProblem,
    affectedPeople,
    rootBarriers,
    desiredBetterFuture,
    opportunityStatement,
    possibleFirstUsefulStep,
    likelySolutionType: route,
    missingInformation,
    safetyNotes: [
      "This clarification uses opportunity_intake as input and stays owner-reviewable.",
      "It does not assume Spark, Live On Mission, Best Life, or other ecosystem apps are fully built.",
      "No Codex run, GitHub issue, label, deployment, migration, paid resource, secret, or env change is triggered."
    ]
  };
  const copyableNextPrompt = buildClarificationPrompt(base, intake);
  const artifact = buildOpportunityClarificationArtifact({ ...base, copyableNextPrompt }, intake, sourceArtifact);
  const record: OpportunityClarificationRecord = {
    ...base,
    copyableNextPrompt,
    artifact
  };
  const store = await readOpportunityClarificationStore();
  const records = [
    record,
    ...store.records.filter(
      (candidate) => candidate.intakeId !== dedupeKey && (!recordGatePacketId || candidate.gatePacketId !== recordGatePacketId)
    )
  ];

  await writeOpportunityClarificationStore({
    schemaVersion: 1,
    records
  });

  return record;
}

function gateRecordToIntakeLike(gate: ProblemIntakeGateRecord): OpportunityIntakeRecord {
  const route: OpportunityRoute = gate.likelyApp.status === "unknown" ? "needs_clarification" : "app_tool_workflow_need";
  const problem = gate.problemBeingSolved && gate.problemBeingSolved !== "not_provided_yet" ? gate.problemBeingSolved : gate.rawRequest;
  const person = gate.intendedPerson && gate.intendedPerson !== "not_provided_yet" ? gate.intendedPerson : "Not captured yet";
  const title = gate.likelyApp.name && gate.likelyApp.name !== "unknown" ? gate.likelyApp.name : gate.rawRequest.slice(0, 60);

  return {
    id: gate.id,
    createdAt: gate.createdAt,
    updatedAt: gate.updatedAt,
    mode: "problem",
    status: "ready_for_appengine_review",
    title,
    problemPain: problem,
    affectedPeople: person,
    betterOutcome: gate.rawRequest,
    currentBarriers: "",
    existingIdeaVision: gate.rawRequest,
    desiredImpact: gate.rawRequest,
    possibleSolutionType: "app_tool_workflow",
    route,
    routingReason: "Derived from problem_intake_gate.",
    nextRecommendedAction: "",
    copyableNextPrompt: "",
    safetyNotes: [],
    gatePacketId: gate.id
  } as unknown as OpportunityIntakeRecord;
}

function buildOpportunityClarificationArtifact(
  record: Omit<OpportunityClarificationRecord, "artifact">,
  intake: OpportunityIntakeRecord,
  sourceArtifact: OpportunityClarificationArtifact["sourceArtifact"]
): OpportunityClarificationArtifact {
  return {
    kind: "opportunity_clarification",
    schemaVersion: 1,
    sourceArtifact,
    status: record.status,
    route: record.route,
    clarification: {
      coreProblem: record.coreProblem,
      affectedPeople: record.affectedPeople,
      rootBarriers: record.rootBarriers,
      desiredBetterFuture: record.desiredBetterFuture,
      opportunityStatement: record.opportunityStatement,
      possibleFirstUsefulStep: record.possibleFirstUsefulStep,
      likelySolutionType: record.likelySolutionType,
      missingInformation: record.missingInformation
    },
    routing: {
      destination: record.route,
      nextSafeAction: "owner_review_before_problem_solution_intake",
      appEngineBuildCandidateAllowed: record.route === "appengine_build_candidate" && record.status === "clarified",
      ecosystemDestinationsNotAssumedBuilt: true
    },
    sourceOfTruthFiles,
    guardrails: opportunityClarificationGuardrails(),
    ownerReadableSummary: `${record.title}: ${record.status.replaceAll("_", " ")} and routed toward ${record.route.replaceAll("_", " ")}.`,
    copyableNextPrompt: record.copyableNextPrompt
  };
}

function chooseStatus(intake: OpportunityIntakeRecord, missingInformation: string[]): OpportunityClarificationStatus {
  if (hasSafetySensitiveSignal(intake)) return "safety_sensitive";
  if (intake.problemPain.length < 20 || intake.affectedPeople.length < 8) return "not_actionable_yet";
  if (missingInformation.length || intake.route === "needs_clarification") return "needs_more_info";
  return "clarified";
}

function chooseClarificationRoute(
  intake: OpportunityIntakeRecord,
  status: OpportunityClarificationStatus
): OpportunityClarificationRoute {
  if (intake.route === "content_resource_need") return "content_resource";
  if (intake.route === "community_ministry_model_need") return "community_ministry_model";
  if (intake.route === "existing_ecosystem_service_later") return "existing_ecosystem_service_later";
  if (intake.route === "app_tool_workflow_need" && status === "clarified") return "appengine_build_candidate";
  return "app_tool_workflow";
}

function findMissingInformation(intake: OpportunityIntakeRecord) {
  const missing = [];

  if (!intake.existingIdeaVision) missing.push("existing idea or vision if one exists");
  if (intake.possibleSolutionType === "not_sure") missing.push("likely solution type");
  if (intake.possibleSolutionType === "multi_part_solution") missing.push("which part should be first");
  if (intake.route === "needs_clarification") missing.push("routing decision");

  return missing;
}

function chooseFirstUsefulStep(route: OpportunityClarificationRoute, status: OpportunityClarificationStatus) {
  if (status === "safety_sensitive") {
    return "Pause for owner review and safety-sensitive handling before creating any solution plan.";
  }

  if (status === "not_actionable_yet" || status === "needs_more_info") {
    return "Ask the smallest clarifying question that would make the next route safe.";
  }

  const steps: Record<OpportunityClarificationRoute, string> = {
    app_tool_workflow: "Map the workflow and identify the smallest useful tool or process improvement.",
    appengine_build_candidate: "Convert this into a problem_solution_intake for owner review before any packet or build work.",
    content_resource: "Draft the first resource outline and audience-specific trust needs.",
    community_ministry_model: "Define the first safe service model, roles, boundaries, and support flow.",
    existing_ecosystem_service_later: "Identify which ecosystem destination might fit later and what proof is required first."
  };

  return steps[route];
}

function createOpportunityStatement(intake: OpportunityIntakeRecord, rootBarriers: string[]) {
  const firstBarrier = rootBarriers[0] || "the current barrier";
  return `Help ${intake.affectedPeople} move from ${intake.problemPain} toward ${intake.betterOutcome} by addressing ${firstBarrier}.`;
}

function buildClarificationPrompt(
  record: Omit<OpportunityClarificationRecord, "artifact" | "copyableNextPrompt">,
  intake: OpportunityIntakeRecord
) {
  return `Review this opportunity_clarification for AppEngine.\n\nSource artifact: opportunity_intake ${intake.id}\nStatus: ${record.status}\nRoute: ${record.route}\nCore problem: ${record.coreProblem}\nAffected people: ${record.affectedPeople}\nRoot barriers: ${record.rootBarriers.join(", ") || "Not clear yet"}\nDesired better future: ${record.desiredBetterFuture}\nOpportunity statement: ${record.opportunityStatement}\nPossible first useful step: ${record.possibleFirstUsefulStep}\nMissing information: ${record.missingInformation.join(", ") || "None"}\n\nGoal: Decide whether this should become a problem_solution_intake, needs one clarifying question, or should pause for safety-sensitive owner review.\n\nGuardrails: Do not trigger Codex, create GitHub issues, apply labels, deploy production, create paid resources, run migrations, add secrets/env vars, change repo visibility, or assume Spark, Live On Mission, Best Life, or any ecosystem app is fully built.`;
}

function splitList(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasSafetySensitiveSignal(intake: OpportunityIntakeRecord) {
  const text = [
    intake.problemPain,
    intake.affectedPeople,
    intake.betterOutcome,
    intake.currentBarriers,
    intake.existingIdeaVision,
    intake.desiredImpact
  ]
    .join(" ")
    .toLowerCase();
  return /\b(suicide|self-harm|abuse|violence|emergency|crisis|immediate danger)\b/.test(text);
}

async function readOpportunityClarificationStore(): Promise<OpportunityClarificationStore> {
  return getAppEngineStateAdapter().readJson<OpportunityClarificationStore>(
    { kind: "opportunity_clarification", key: "records" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeOpportunityClarificationStore(store: OpportunityClarificationStore) {
  return getAppEngineStateAdapter().writeJson({ kind: "opportunity_clarification", key: "records" }, store);
}
