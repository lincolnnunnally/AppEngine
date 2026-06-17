import { randomUUID } from "node:crypto";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import {
  getOpportunityActionPlan,
  opportunityActionPlanGuardrails,
  type OpportunityActionPlanRecord
} from "@/lib/engine/opportunity-action-plan";
import { getOpportunityClarification, type OpportunityClarificationRecord } from "@/lib/engine/opportunity-clarification";
import { getOpportunityIntakeRecord, type OpportunityIntakeRecord } from "@/lib/engine/opportunity-intake";
import {
  getOpportunitySolutionPath,
  type OpportunitySolutionPathConfidence,
  type OpportunitySolutionPathRecord,
  type OpportunitySolutionPathRoute
} from "@/lib/engine/opportunity-solution-path";

export type OpportunityAppEngineCandidateType =
  | "app_build_candidate"
  | "workflow_candidate"
  | "content_resource_candidate"
  | "community_model_candidate"
  | "ecosystem_service_later_candidate"
  | "needs_more_info";

export type OpportunityAppEngineCandidateRecord = {
  id: string;
  actionPlanId: string;
  solutionPathId: string;
  clarificationId: string;
  intakeId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  candidateType: OpportunityAppEngineCandidateType;
  sourceOpportunityIntake: OpportunityCandidateIntakeSummary;
  clarifiedProblem: OpportunityCandidateClarifiedProblem;
  solutionPath: OpportunityCandidateSolutionPath;
  actionPlanSummary: string;
  proposedAppEngineWorkType: string;
  recommendedArtifactToCreateNext: string;
  missingOwnerDecisions: string[];
  risksBlockers: string[];
  confidenceLevel: OpportunitySolutionPathConfidence;
  copyableNextAppEnginePrompt: string;
  safetyNotes: string[];
  artifact: OpportunityAppEngineCandidateArtifact;
};

export type OpportunityCandidateIntakeSummary = {
  id: string;
  title: string;
  mode: string;
  route: string;
  problemPain: string;
  affectedPeople: string;
  betterOutcome: string;
  currentBarriers: string;
  desiredImpact: string;
  possibleSolutionType: string;
};

export type OpportunityCandidateClarifiedProblem = {
  id: string;
  status: string;
  coreProblem: string;
  affectedPeople: string;
  rootBarriers: string[];
  desiredBetterFuture: string;
  opportunityStatement: string;
  missingInformation: string[];
};

export type OpportunityCandidateSolutionPath = {
  id: string;
  recommendedPath: OpportunitySolutionPathRoute;
  reasonForRouting: string;
  firstPracticalStep: string;
  confidenceLevel: OpportunitySolutionPathConfidence;
};

export type OpportunityAppEngineCandidateArtifact = {
  kind: "opportunity_appengine_candidate";
  schemaVersion: 1;
  sourceArtifact: {
    kind: "opportunity_action_plan";
    actionPlanId: string;
    solutionPathId: string;
    clarificationId: string;
    intakeId: string;
  };
  candidate: {
    candidateType: OpportunityAppEngineCandidateType;
    sourceOpportunityIntake: OpportunityCandidateIntakeSummary;
    clarifiedProblem: OpportunityCandidateClarifiedProblem;
    solutionPath: OpportunityCandidateSolutionPath;
    actionPlanSummary: string;
    proposedAppEngineWorkType: string;
    recommendedArtifactToCreateNext: string;
    missingOwnerDecisions: string[];
    risksBlockers: string[];
    confidenceLevel: OpportunitySolutionPathConfidence;
  };
  routing: {
    nextSafeAction: "owner_review_before_packet_creation";
    buildPacketsCreated: false;
    codexTriggered: false;
    ecosystemDestinationsNotAssumedBuilt: true;
  };
  sourceOfTruthFiles: string[];
  guardrails: ReturnType<typeof opportunityAppEngineCandidateGuardrails>;
  ownerReadableSummary: string;
  copyableNextAppEnginePrompt: string;
};

type OpportunityAppEngineCandidateStore = {
  schemaVersion: 1;
  records: OpportunityAppEngineCandidateRecord[];
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
  "source-of-truth/opportunity-solution-path-router.md",
  "source-of-truth/opportunity-action-plan-draft.md",
  "source-of-truth/opportunity-appengine-candidate-bridge.md",
  "source-of-truth/problem-to-solution-intake-standard.md",
  "source-of-truth/problem-portfolio-routing-standard.md",
  "source-of-truth/app-portfolio-registry.md"
];

export function opportunityAppEngineCandidateGuardrails() {
  return {
    ...durableStateGuardrails(),
    ...opportunityActionPlanGuardrails(),
    usesOpportunityActionPlanAsInput: true,
    adapterBackedLocalMockPersistence: true,
    noBuildPacketsCreated: true,
    noCodexAutoExecution: true,
    noEcosystemDestinationAssumedBuilt: true,
    ownerReviewRequiredBeforePacketCreation: true
  };
}

export async function listOpportunityAppEngineCandidates() {
  const store = await readOpportunityAppEngineCandidateStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createOpportunityAppEngineCandidate(input: { actionPlanId?: unknown }) {
  const actionPlanId = typeof input.actionPlanId === "string" ? input.actionPlanId.trim() : "";

  if (!actionPlanId) {
    throw new Error("Choose an opportunity action plan before creating an AppEngine candidate.");
  }

  const actionPlan = await getOpportunityActionPlan(actionPlanId);

  if (!actionPlan) {
    throw new Error("That opportunity action plan could not be found.");
  }

  const [intake, clarification, solutionPath] = await Promise.all([
    getOpportunityIntakeRecord(actionPlan.intakeId),
    getOpportunityClarification(actionPlan.clarificationId),
    getOpportunitySolutionPath(actionPlan.solutionPathId)
  ]);

  if (!intake || !clarification || !solutionPath) {
    throw new Error("The candidate cannot be created because source intake, clarification, or solution path evidence is missing.");
  }

  const now = new Date().toISOString();
  const candidateType = chooseCandidateType(actionPlan, solutionPath);
  const proposedAppEngineWorkType = chooseProposedWorkType(candidateType);
  const recommendedArtifactToCreateNext = chooseRecommendedArtifact(candidateType);
  const missingOwnerDecisions = chooseMissingOwnerDecisions(actionPlan, candidateType);
  const risksBlockers = chooseRisksBlockers(actionPlan, solutionPath, candidateType);
  const sourceOpportunityIntake = summarizeIntake(intake);
  const clarifiedProblem = summarizeClarification(clarification);
  const solutionPathSummary = summarizeSolutionPath(solutionPath);
  const actionPlanSummary = actionPlan.opportunitySummary;
  const base = {
    id: randomUUID(),
    actionPlanId: actionPlan.id,
    solutionPathId: actionPlan.solutionPathId,
    clarificationId: actionPlan.clarificationId,
    intakeId: actionPlan.intakeId,
    createdAt: now,
    updatedAt: now,
    title: actionPlan.title,
    candidateType,
    sourceOpportunityIntake,
    clarifiedProblem,
    solutionPath: solutionPathSummary,
    actionPlanSummary,
    proposedAppEngineWorkType,
    recommendedArtifactToCreateNext,
    missingOwnerDecisions,
    risksBlockers,
    confidenceLevel: solutionPath.confidenceLevel,
    safetyNotes: [
      "This candidate uses opportunity_action_plan as input and remains owner-reviewable.",
      "No build packet, Codex run, GitHub issue, label, deployment, migration, paid resource, secret, or env change is triggered.",
      "Spark, Live On Mission, Best Life, and other ecosystem services are not assumed to be fully built."
    ]
  };
  const copyableNextAppEnginePrompt = buildNextPrompt(base, actionPlan);
  const artifact = buildOpportunityAppEngineCandidateArtifact({ ...base, copyableNextAppEnginePrompt });
  const record: OpportunityAppEngineCandidateRecord = {
    ...base,
    copyableNextAppEnginePrompt,
    artifact
  };
  const store = await readOpportunityAppEngineCandidateStore();
  const records = [record, ...store.records.filter((candidate) => candidate.actionPlanId !== actionPlan.id)];

  await writeOpportunityAppEngineCandidateStore({
    schemaVersion: 1,
    records
  });

  return record;
}

function buildOpportunityAppEngineCandidateArtifact(
  record: Omit<OpportunityAppEngineCandidateRecord, "artifact">
): OpportunityAppEngineCandidateArtifact {
  return {
    kind: "opportunity_appengine_candidate",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "opportunity_action_plan",
      actionPlanId: record.actionPlanId,
      solutionPathId: record.solutionPathId,
      clarificationId: record.clarificationId,
      intakeId: record.intakeId
    },
    candidate: {
      candidateType: record.candidateType,
      sourceOpportunityIntake: record.sourceOpportunityIntake,
      clarifiedProblem: record.clarifiedProblem,
      solutionPath: record.solutionPath,
      actionPlanSummary: record.actionPlanSummary,
      proposedAppEngineWorkType: record.proposedAppEngineWorkType,
      recommendedArtifactToCreateNext: record.recommendedArtifactToCreateNext,
      missingOwnerDecisions: record.missingOwnerDecisions,
      risksBlockers: record.risksBlockers,
      confidenceLevel: record.confidenceLevel
    },
    routing: {
      nextSafeAction: "owner_review_before_packet_creation",
      buildPacketsCreated: false,
      codexTriggered: false,
      ecosystemDestinationsNotAssumedBuilt: true
    },
    sourceOfTruthFiles,
    guardrails: opportunityAppEngineCandidateGuardrails(),
    ownerReadableSummary: `${record.title}: ${record.candidateType.replaceAll("_", " ")} is ready for owner review.`,
    copyableNextAppEnginePrompt: record.copyableNextAppEnginePrompt
  };
}

function chooseCandidateType(
  actionPlan: OpportunityActionPlanRecord,
  solutionPath: OpportunitySolutionPathRecord
): OpportunityAppEngineCandidateType {
  if (actionPlan.planType === "content_resource_plan") return "content_resource_candidate";
  if (actionPlan.planType === "community_ministry_model_plan") return "community_model_candidate";
  if (actionPlan.planType === "ecosystem_service_later_plan") return "ecosystem_service_later_candidate";
  if (actionPlan.planType === "needs_more_info_plan" || solutionPath.recommendedPath === "needs_more_info") {
    return "needs_more_info";
  }
  if (solutionPath.recommendedPath === "appengine_build_candidate") return "app_build_candidate";
  return "workflow_candidate";
}

function chooseProposedWorkType(candidateType: OpportunityAppEngineCandidateType) {
  const map: Record<OpportunityAppEngineCandidateType, string> = {
    app_build_candidate: "App Build Packet candidate",
    workflow_candidate: "workflow or tool planning candidate",
    content_resource_candidate: "content/resource planning candidate",
    community_model_candidate: "community/ministry model planning candidate",
    ecosystem_service_later_candidate: "ecosystem destination readiness candidate",
    needs_more_info: "clarification candidate"
  };

  return map[candidateType];
}

function chooseRecommendedArtifact(candidateType: OpportunityAppEngineCandidateType) {
  const map: Record<OpportunityAppEngineCandidateType, string> = {
    app_build_candidate: "problem_solution_intake",
    workflow_candidate: "problem_solution_intake",
    content_resource_candidate: "problem_solution_intake",
    community_model_candidate: "problem_solution_intake",
    ecosystem_service_later_candidate: "destination_readiness_review",
    needs_more_info: "opportunity_clarification"
  };

  return map[candidateType];
}

function chooseMissingOwnerDecisions(
  actionPlan: OpportunityActionPlanRecord,
  candidateType: OpportunityAppEngineCandidateType
) {
  const decisions = [...actionPlan.ownerMustClarify];

  if (candidateType === "app_build_candidate") {
    decisions.push("whether this should become a problem_solution_intake before any App Build Packet draft exists");
  }

  if (candidateType === "ecosystem_service_later_candidate") {
    decisions.push("which ecosystem destination is verified enough to reference");
  }

  if (candidateType === "needs_more_info") {
    decisions.push("what missing context must be answered before AppEngine routing continues");
  }

  if (!decisions.length) {
    decisions.push("whether the candidate is useful enough to advance");
  }

  return Array.from(new Set(decisions));
}

function chooseRisksBlockers(
  actionPlan: OpportunityActionPlanRecord,
  solutionPath: OpportunitySolutionPathRecord,
  candidateType: OpportunityAppEngineCandidateType
) {
  const risks = [...actionPlan.risksBlockers, ...solutionPath.blockers];

  if (candidateType === "app_build_candidate") {
    risks.push("risk of starting build packet work before owner review");
  }

  if (candidateType === "ecosystem_service_later_candidate") {
    risks.push("risk of implying an ecosystem service is built before it is verified");
  }

  risks.push("candidate is not a build packet and does not start implementation");
  return Array.from(new Set(risks));
}

function summarizeIntake(intake: OpportunityIntakeRecord): OpportunityCandidateIntakeSummary {
  return {
    id: intake.id,
    title: intake.title,
    mode: intake.mode,
    route: intake.route,
    problemPain: intake.problemPain,
    affectedPeople: intake.affectedPeople,
    betterOutcome: intake.betterOutcome,
    currentBarriers: intake.currentBarriers,
    desiredImpact: intake.desiredImpact,
    possibleSolutionType: intake.possibleSolutionType
  };
}

function summarizeClarification(clarification: OpportunityClarificationRecord): OpportunityCandidateClarifiedProblem {
  return {
    id: clarification.id,
    status: clarification.status,
    coreProblem: clarification.coreProblem,
    affectedPeople: clarification.affectedPeople,
    rootBarriers: clarification.rootBarriers,
    desiredBetterFuture: clarification.desiredBetterFuture,
    opportunityStatement: clarification.opportunityStatement,
    missingInformation: clarification.missingInformation
  };
}

function summarizeSolutionPath(solutionPath: OpportunitySolutionPathRecord): OpportunityCandidateSolutionPath {
  return {
    id: solutionPath.id,
    recommendedPath: solutionPath.recommendedPath,
    reasonForRouting: solutionPath.reasonForRouting,
    firstPracticalStep: solutionPath.firstPracticalStep,
    confidenceLevel: solutionPath.confidenceLevel
  };
}

function buildNextPrompt(
  record: Omit<OpportunityAppEngineCandidateRecord, "artifact" | "copyableNextAppEnginePrompt">,
  actionPlan: OpportunityActionPlanRecord
) {
  return `Review this opportunity_appengine_candidate for AppEngine.\n\nSource artifact: opportunity_action_plan ${actionPlan.id}\nCandidate type: ${record.candidateType}\nSource opportunity intake: ${record.sourceOpportunityIntake.title} (${record.intakeId})\nClarified problem: ${record.clarifiedProblem.coreProblem}\nSolution path: ${record.solutionPath.recommendedPath}\nAction plan summary: ${record.actionPlanSummary}\nProposed AppEngine work type: ${record.proposedAppEngineWorkType}\nRecommended artifact to create next: ${record.recommendedArtifactToCreateNext}\nMissing owner decisions: ${record.missingOwnerDecisions.join(", ")}\nRisks/blockers: ${record.risksBlockers.join(", ")}\nConfidence: ${record.confidenceLevel}\n\nGoal: Decide whether this should become the recommended next artifact for owner review, needs more information, or should pause. Do not create build packets yet.\n\nGuardrails: Do not trigger Codex, create GitHub issues, apply labels, deploy production, create paid resources, run migrations, add secrets/env vars, change repo visibility, or assume Spark, Live On Mission, Best Life, or any ecosystem app is fully built.`;
}

async function readOpportunityAppEngineCandidateStore(): Promise<OpportunityAppEngineCandidateStore> {
  return getAppEngineStateAdapter().readJson<OpportunityAppEngineCandidateStore>(
    { kind: "opportunity_appengine_candidate", key: "records" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeOpportunityAppEngineCandidateStore(store: OpportunityAppEngineCandidateStore) {
  return getAppEngineStateAdapter().writeJson({ kind: "opportunity_appengine_candidate", key: "records" }, store);
}
