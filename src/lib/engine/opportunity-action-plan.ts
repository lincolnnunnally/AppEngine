import { randomUUID } from "node:crypto";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import {
  getOpportunitySolutionPath,
  opportunitySolutionPathGuardrails,
  type OpportunitySolutionPathRecord,
  type OpportunitySolutionPathRoute
} from "@/lib/engine/opportunity-solution-path";

export type OpportunityActionPlanType =
  | "app_tool_workflow_plan"
  | "content_resource_plan"
  | "community_ministry_model_plan"
  | "ecosystem_service_later_plan"
  | "needs_more_info_plan";

export type OpportunityActionPlanRecord = {
  id: string;
  solutionPathId: string;
  clarificationId: string;
  intakeId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  planType: OpportunityActionPlanType;
  opportunitySummary: string;
  recommendedSolutionPath: OpportunitySolutionPathRoute;
  firstPracticalSteps: string[];
  appEngineCanHelpWith: string[];
  ownerMustClarify: string[];
  neededResources: string[];
  risksBlockers: string[];
  suggestedTimeline: string;
  nextReviewPrompt: string;
  safetyNotes: string[];
  artifact: OpportunityActionPlanArtifact;
};

export type OpportunityActionPlanArtifact = {
  kind: "opportunity_action_plan";
  schemaVersion: 1;
  sourceArtifact: {
    kind: "opportunity_solution_path";
    solutionPathId: string;
    clarificationId: string;
    intakeId: string;
    recommendedPath: OpportunitySolutionPathRoute;
  };
  plan: {
    planType: OpportunityActionPlanType;
    opportunitySummary: string;
    recommendedSolutionPath: OpportunitySolutionPathRoute;
    firstPracticalSteps: string[];
    appEngineCanHelpWith: string[];
    ownerMustClarify: string[];
    neededResources: string[];
    risksBlockers: string[];
    suggestedTimeline: string;
  };
  routing: {
    nextSafeAction: "owner_review_before_packet_or_issue_creation";
    buildPacketsCreated: false;
    codexTriggered: false;
    ecosystemDestinationsNotAssumedBuilt: true;
  };
  sourceOfTruthFiles: string[];
  guardrails: ReturnType<typeof opportunityActionPlanGuardrails>;
  ownerReadableSummary: string;
  nextReviewPrompt: string;
};

type OpportunityActionPlanStore = {
  schemaVersion: 1;
  records: OpportunityActionPlanRecord[];
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
  "source-of-truth/problem-to-solution-intake-standard.md",
  "source-of-truth/problem-portfolio-routing-standard.md",
  "source-of-truth/app-portfolio-registry.md"
];

export function opportunityActionPlanGuardrails() {
  return {
    ...durableStateGuardrails(),
    ...opportunitySolutionPathGuardrails(),
    usesOpportunitySolutionPathAsInput: true,
    adapterBackedLocalMockPersistence: true,
    noBuildPacketsCreated: true,
    noCodexAutoExecution: true,
    noEcosystemDestinationAssumedBuilt: true,
    ownerReviewRequiredBeforeNextAction: true
  };
}

export async function listOpportunityActionPlans() {
  const store = await readOpportunityActionPlanStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createOpportunityActionPlan(input: { solutionPathId?: unknown }) {
  const solutionPathId = typeof input.solutionPathId === "string" ? input.solutionPathId.trim() : "";

  if (!solutionPathId) {
    throw new Error("Choose an opportunity solution path before drafting an action plan.");
  }

  const solutionPath = await getOpportunitySolutionPath(solutionPathId);

  if (!solutionPath) {
    throw new Error("That opportunity solution path could not be found.");
  }

  const now = new Date().toISOString();
  const planType = choosePlanType(solutionPath.recommendedPath);
  const firstPracticalSteps = chooseFirstPracticalSteps(solutionPath);
  const appEngineCanHelpWith = chooseAppEngineSupport(solutionPath, planType);
  const ownerMustClarify = chooseOwnerClarifications(solutionPath);
  const neededResources = Array.from(new Set(["owner review", ...solutionPath.neededResources]));
  const risksBlockers = chooseRisksBlockers(solutionPath);
  const suggestedTimeline = chooseTimeline(planType, solutionPath);
  const opportunitySummary = buildOpportunitySummary(solutionPath);
  const base = {
    id: randomUUID(),
    solutionPathId: solutionPath.id,
    clarificationId: solutionPath.clarificationId,
    intakeId: solutionPath.intakeId,
    createdAt: now,
    updatedAt: now,
    title: solutionPath.title,
    planType,
    opportunitySummary,
    recommendedSolutionPath: solutionPath.recommendedPath,
    firstPracticalSteps,
    appEngineCanHelpWith,
    ownerMustClarify,
    neededResources,
    risksBlockers,
    suggestedTimeline,
    safetyNotes: [
      "This action plan uses opportunity_solution_path as input and remains owner-reviewable.",
      "No build packet, Codex run, GitHub issue, label, deployment, migration, paid resource, secret, or env change is triggered.",
      "Spark, Live On Mission, Best Life, and other ecosystem services are not assumed to be fully built."
    ]
  };
  const nextReviewPrompt = buildNextReviewPrompt(base, solutionPath);
  const artifact = buildOpportunityActionPlanArtifact({ ...base, nextReviewPrompt }, solutionPath);
  const record: OpportunityActionPlanRecord = {
    ...base,
    nextReviewPrompt,
    artifact
  };
  const store = await readOpportunityActionPlanStore();
  const records = [record, ...store.records.filter((candidate) => candidate.solutionPathId !== solutionPath.id)];

  await writeOpportunityActionPlanStore({
    schemaVersion: 1,
    records
  });

  return record;
}

function buildOpportunityActionPlanArtifact(
  record: Omit<OpportunityActionPlanRecord, "artifact">,
  solutionPath: OpportunitySolutionPathRecord
): OpportunityActionPlanArtifact {
  return {
    kind: "opportunity_action_plan",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "opportunity_solution_path",
      solutionPathId: solutionPath.id,
      clarificationId: solutionPath.clarificationId,
      intakeId: solutionPath.intakeId,
      recommendedPath: solutionPath.recommendedPath
    },
    plan: {
      planType: record.planType,
      opportunitySummary: record.opportunitySummary,
      recommendedSolutionPath: record.recommendedSolutionPath,
      firstPracticalSteps: record.firstPracticalSteps,
      appEngineCanHelpWith: record.appEngineCanHelpWith,
      ownerMustClarify: record.ownerMustClarify,
      neededResources: record.neededResources,
      risksBlockers: record.risksBlockers,
      suggestedTimeline: record.suggestedTimeline
    },
    routing: {
      nextSafeAction: "owner_review_before_packet_or_issue_creation",
      buildPacketsCreated: false,
      codexTriggered: false,
      ecosystemDestinationsNotAssumedBuilt: true
    },
    sourceOfTruthFiles,
    guardrails: opportunityActionPlanGuardrails(),
    ownerReadableSummary: `${record.title}: ${record.planType.replaceAll("_", " ")} drafted for owner review.`,
    nextReviewPrompt: record.nextReviewPrompt
  };
}

function choosePlanType(recommendedPath: OpportunitySolutionPathRoute): OpportunityActionPlanType {
  if (recommendedPath === "content_resource") return "content_resource_plan";
  if (recommendedPath === "community_ministry_model") return "community_ministry_model_plan";
  if (recommendedPath === "existing_ecosystem_service_later") return "ecosystem_service_later_plan";
  if (recommendedPath === "needs_more_info" || recommendedPath === "not_safe_or_not_ready") {
    return "needs_more_info_plan";
  }
  return "app_tool_workflow_plan";
}

function chooseFirstPracticalSteps(solutionPath: OpportunitySolutionPathRecord) {
  const shared = [solutionPath.firstPracticalStep];

  const map: Record<OpportunityActionPlanType, string[]> = {
    app_tool_workflow_plan: [
      "Map the current workflow or tool need in plain language.",
      "Define the smallest useful non-production AppEngine help step.",
      "Review scope before any packet, issue, or Codex handoff exists."
    ],
    content_resource_plan: [
      "Outline the first resource for the affected audience.",
      "Check the tone, trust needs, and practical usefulness before publishing.",
      "Decide whether the resource stands alone or supports a later app/workflow."
    ],
    community_ministry_model_plan: [
      "Name the first service model and who it is meant to help.",
      "Define roles, boundaries, and support/safety expectations.",
      "Review whether a tool, resource, or human process should come first."
    ],
    ecosystem_service_later_plan: [
      "Verify the ecosystem destination exists before routing anyone there.",
      "Define what evidence proves the destination is ready.",
      "Prepare a fallback path if the destination is not ready yet."
    ],
    needs_more_info_plan: [
      "Ask the smallest clarifying question.",
      "Pause route expansion until the answer is available.",
      "Refresh clarification and solution path before further action."
    ]
  };

  return Array.from(new Set([...shared, ...map[choosePlanType(solutionPath.recommendedPath)]])).slice(0, 3);
}

function chooseAppEngineSupport(solutionPath: OpportunitySolutionPathRecord, planType: OpportunityActionPlanType) {
  const base = ["keep source-of-truth context visible", "preserve safety and cost guardrails"];

  const map: Record<OpportunityActionPlanType, string[]> = {
    app_tool_workflow_plan: [
      "draft a future problem_solution_intake or workflow plan after owner approval",
      "prepare a packet only after review"
    ],
    content_resource_plan: ["turn the idea into a resource outline", "prepare review notes before publishing"],
    community_ministry_model_plan: ["draft a service model", "clarify roles, boundaries, and measurement needs"],
    ecosystem_service_later_plan: ["record destination readiness requirements", "avoid routing to unbuilt services"],
    needs_more_info_plan: ["generate clarifying questions", "pause until the opportunity becomes actionable"]
  };

  return Array.from(new Set([...base, ...map[planType], ...solutionPath.neededResources.slice(0, 2)]));
}

function chooseOwnerClarifications(solutionPath: OpportunitySolutionPathRecord) {
  const clarifications = [...solutionPath.blockers];

  if (solutionPath.recommendedPath === "appengine_build_candidate") {
    clarifications.push("whether to approve a later AppEngine packet draft");
  }

  if (solutionPath.recommendedPath === "existing_ecosystem_service_later") {
    clarifications.push("which destination is actually ready for review or use");
  }

  if (!clarifications.length) {
    clarifications.push("whether this first action is useful enough to continue");
  }

  return Array.from(new Set(clarifications));
}

function chooseRisksBlockers(solutionPath: OpportunitySolutionPathRecord) {
  const risks = [...solutionPath.blockers];

  if (solutionPath.recommendedPath === "existing_ecosystem_service_later") {
    risks.push("risk of implying an ecosystem service is built before it is verified");
  }

  if (solutionPath.recommendedPath === "appengine_build_candidate") {
    risks.push("risk of turning the opportunity into code before owner approval");
  }

  if (solutionPath.recommendedPath === "not_safe_or_not_ready") {
    risks.push("risk of acting before safety-sensitive review");
  }

  risks.push("action plan is not a build packet and does not start implementation");
  return Array.from(new Set(risks));
}

function chooseTimeline(planType: OpportunityActionPlanType, solutionPath: OpportunitySolutionPathRecord) {
  if (planType === "needs_more_info_plan") {
    return "Clarify before moving forward; no packet or build work should start until the missing context is answered.";
  }

  if (solutionPath.confidenceLevel === "high") {
    return "Owner review now; if approved, prepare the next planning packet or non-app plan in a later explicit step.";
  }

  return "Owner review now; resolve blockers before packet, issue, or Codex handoff creation.";
}

function buildOpportunitySummary(solutionPath: OpportunitySolutionPathRecord) {
  return `${solutionPath.title}: ${solutionPath.reasonForRouting}`;
}

function buildNextReviewPrompt(
  record: Omit<OpportunityActionPlanRecord, "artifact" | "nextReviewPrompt">,
  solutionPath: OpportunitySolutionPathRecord
) {
  return `Review this opportunity_action_plan for AppEngine.\n\nSource artifact: opportunity_solution_path ${solutionPath.id}\nPlan type: ${record.planType}\nRecommended path: ${record.recommendedSolutionPath}\nOpportunity summary: ${record.opportunitySummary}\nFirst 3 practical steps:\n1. ${record.firstPracticalSteps[0] || "Not defined"}\n2. ${record.firstPracticalSteps[1] || "Not defined"}\n3. ${record.firstPracticalSteps[2] || "Not defined"}\nWhat AppEngine can help with: ${record.appEngineCanHelpWith.join(", ")}\nWhat owner/community leader must clarify: ${record.ownerMustClarify.join(", ")}\nNeeded resources: ${record.neededResources.join(", ")}\nRisks/blockers: ${record.risksBlockers.join(", ")}\nSuggested timeline: ${record.suggestedTimeline}\n\nGoal: Decide whether this practical first action is useful, needs more clarification, or should pause. Do not create build packets yet.\n\nGuardrails: Do not trigger Codex, create GitHub issues, apply labels, deploy production, create paid resources, run migrations, add secrets/env vars, change repo visibility, or assume Spark, Live On Mission, Best Life, or any ecosystem app is fully built.`;
}

async function readOpportunityActionPlanStore(): Promise<OpportunityActionPlanStore> {
  return getAppEngineStateAdapter().readJson<OpportunityActionPlanStore>(
    { kind: "opportunity_action_plan", key: "records" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeOpportunityActionPlanStore(store: OpportunityActionPlanStore) {
  return getAppEngineStateAdapter().writeJson({ kind: "opportunity_action_plan", key: "records" }, store);
}
