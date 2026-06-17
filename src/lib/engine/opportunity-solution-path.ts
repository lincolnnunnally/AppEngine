import { randomUUID } from "node:crypto";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import {
  getOpportunityClarification,
  opportunityClarificationGuardrails,
  type OpportunityClarificationRecord,
  type OpportunityClarificationStatus
} from "@/lib/engine/opportunity-clarification";

export type OpportunitySolutionPathRoute =
  | "appengine_build_candidate"
  | "app_tool_workflow"
  | "content_resource"
  | "community_ministry_model"
  | "existing_ecosystem_service_later"
  | "needs_more_info"
  | "not_safe_or_not_ready";

export type OpportunitySolutionPathConfidence = "low" | "medium" | "high";

export type OpportunitySolutionPathRecord = {
  id: string;
  clarificationId: string;
  intakeId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  recommendedPath: OpportunitySolutionPathRoute;
  reasonForRouting: string;
  firstPracticalStep: string;
  neededResources: string[];
  blockers: string[];
  confidenceLevel: OpportunitySolutionPathConfidence;
  nextAppEngineActionPrompt: string;
  safetyNotes: string[];
  artifact: OpportunitySolutionPathArtifact;
};

export type OpportunitySolutionPathArtifact = {
  kind: "opportunity_solution_path";
  schemaVersion: 1;
  sourceArtifact: {
    kind: "opportunity_clarification";
    clarificationId: string;
    intakeId: string;
    status: OpportunityClarificationStatus;
  };
  routing: {
    recommendedPath: OpportunitySolutionPathRoute;
    reasonForRouting: string;
    firstPracticalStep: string;
    neededResources: string[];
    blockers: string[];
    confidenceLevel: OpportunitySolutionPathConfidence;
    nextSafeAction: "owner_review_before_packet_or_issue_creation";
    buildPacketsCreated: false;
    codexTriggered: false;
    ecosystemDestinationsNotAssumedBuilt: true;
  };
  sourceOfTruthFiles: string[];
  guardrails: ReturnType<typeof opportunitySolutionPathGuardrails>;
  ownerReadableSummary: string;
  nextAppEngineActionPrompt: string;
};

type OpportunitySolutionPathStore = {
  schemaVersion: 1;
  records: OpportunitySolutionPathRecord[];
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
  "source-of-truth/problem-to-solution-intake-standard.md",
  "source-of-truth/problem-portfolio-routing-standard.md",
  "source-of-truth/app-portfolio-registry.md"
];

export function opportunitySolutionPathGuardrails() {
  return {
    ...durableStateGuardrails(),
    ...opportunityClarificationGuardrails(),
    usesOpportunityClarificationAsInput: true,
    adapterBackedLocalMockPersistence: true,
    noBuildPacketsCreated: true,
    noCodexAutoExecution: true,
    noEcosystemDestinationAssumedBuilt: true,
    ownerReviewRequiredBeforeNextAction: true
  };
}

export async function listOpportunitySolutionPaths() {
  const store = await readOpportunitySolutionPathStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOpportunitySolutionPath(pathId: string) {
  const store = await readOpportunitySolutionPathStore();
  return store.records.find((record) => record.id === pathId) || null;
}

export async function createOpportunitySolutionPath(input: { clarificationId?: unknown }) {
  const clarificationId = typeof input.clarificationId === "string" ? input.clarificationId.trim() : "";

  if (!clarificationId) {
    throw new Error("Choose an opportunity clarification before routing a solution path.");
  }

  const clarification = await getOpportunityClarification(clarificationId);

  if (!clarification) {
    throw new Error("That opportunity clarification could not be found.");
  }

  const now = new Date().toISOString();
  const recommendedPath = chooseRecommendedPath(clarification);
  const blockers = chooseBlockers(clarification, recommendedPath);
  const neededResources = chooseNeededResources(clarification, recommendedPath);
  const firstPracticalStep = chooseFirstPracticalStep(clarification, recommendedPath);
  const confidenceLevel = chooseConfidence(clarification, blockers);
  const reasonForRouting = explainRouting(clarification, recommendedPath);
  const base = {
    id: randomUUID(),
    clarificationId: clarification.id,
    intakeId: clarification.intakeId,
    createdAt: now,
    updatedAt: now,
    title: clarification.title,
    recommendedPath,
    reasonForRouting,
    firstPracticalStep,
    neededResources,
    blockers,
    confidenceLevel,
    safetyNotes: [
      "This route uses opportunity_clarification as input and remains owner-reviewable.",
      "No build packet, Codex run, GitHub issue, label, deployment, migration, paid resource, secret, or env change is triggered.",
      "Spark, Live On Mission, Best Life, and other ecosystem services are not assumed to be fully built."
    ]
  };
  const nextAppEngineActionPrompt = buildNextActionPrompt(base, clarification);
  const artifact = buildOpportunitySolutionPathArtifact({ ...base, nextAppEngineActionPrompt }, clarification);
  const record: OpportunitySolutionPathRecord = {
    ...base,
    nextAppEngineActionPrompt,
    artifact
  };
  const store = await readOpportunitySolutionPathStore();
  const records = [record, ...store.records.filter((candidate) => candidate.clarificationId !== clarification.id)];

  await writeOpportunitySolutionPathStore({
    schemaVersion: 1,
    records
  });

  return record;
}

function buildOpportunitySolutionPathArtifact(
  record: Omit<OpportunitySolutionPathRecord, "artifact">,
  clarification: OpportunityClarificationRecord
): OpportunitySolutionPathArtifact {
  return {
    kind: "opportunity_solution_path",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "opportunity_clarification",
      clarificationId: clarification.id,
      intakeId: clarification.intakeId,
      status: clarification.status
    },
    routing: {
      recommendedPath: record.recommendedPath,
      reasonForRouting: record.reasonForRouting,
      firstPracticalStep: record.firstPracticalStep,
      neededResources: record.neededResources,
      blockers: record.blockers,
      confidenceLevel: record.confidenceLevel,
      nextSafeAction: "owner_review_before_packet_or_issue_creation",
      buildPacketsCreated: false,
      codexTriggered: false,
      ecosystemDestinationsNotAssumedBuilt: true
    },
    sourceOfTruthFiles,
    guardrails: opportunitySolutionPathGuardrails(),
    ownerReadableSummary: `${record.title}: route toward ${record.recommendedPath.replaceAll("_", " ")} with ${record.confidenceLevel} confidence.`,
    nextAppEngineActionPrompt: record.nextAppEngineActionPrompt
  };
}

function chooseRecommendedPath(clarification: OpportunityClarificationRecord): OpportunitySolutionPathRoute {
  if (clarification.status === "safety_sensitive" || clarification.status === "not_actionable_yet") {
    return "not_safe_or_not_ready";
  }

  if (clarification.status === "needs_more_info" || clarification.missingInformation.length > 0) {
    return "needs_more_info";
  }

  if (clarification.route === "appengine_build_candidate") return "appengine_build_candidate";
  if (clarification.route === "content_resource") return "content_resource";
  if (clarification.route === "community_ministry_model") return "community_ministry_model";
  if (clarification.route === "existing_ecosystem_service_later") return "existing_ecosystem_service_later";
  return "app_tool_workflow";
}

function chooseBlockers(
  clarification: OpportunityClarificationRecord,
  recommendedPath: OpportunitySolutionPathRoute
) {
  const blockers = [...clarification.missingInformation];

  if (recommendedPath === "not_safe_or_not_ready") {
    blockers.push(
      clarification.status === "safety_sensitive"
        ? "safety-sensitive owner review required"
        : "opportunity is not actionable enough yet"
    );
  }

  if (recommendedPath === "existing_ecosystem_service_later") {
    blockers.push("ecosystem destination must be verified before routing a person there");
  }

  if (recommendedPath === "appengine_build_candidate") {
    blockers.push("owner approval required before creating a problem_solution_intake or packet");
  }

  return Array.from(new Set(blockers));
}

function chooseNeededResources(
  clarification: OpportunityClarificationRecord,
  recommendedPath: OpportunitySolutionPathRoute
) {
  const base = ["owner review", "source-of-truth alignment", "privacy and safety check"];

  const map: Record<OpportunitySolutionPathRoute, string[]> = {
    appengine_build_candidate: ["problem_solution_intake draft", "portfolio routing review", "AppEngine packet approval gate"],
    app_tool_workflow: ["workflow sketch", "smallest tool boundary", "manual process fallback"],
    content_resource: ["resource outline", "audience-specific copy", "trust and clarity review"],
    community_ministry_model: ["service model outline", "roles and boundaries", "support/safety expectations"],
    existing_ecosystem_service_later: ["destination readiness check", "handoff criteria", "verified review URL or service evidence"],
    needs_more_info: ["clarifying question", "owner context", "route decision"],
    not_safe_or_not_ready: ["owner review", "safety-sensitive handling plan", "do-not-route decision"]
  };

  return Array.from(new Set([...base, ...map[recommendedPath], ...clarification.rootBarriers.slice(0, 2)]));
}

function chooseFirstPracticalStep(
  clarification: OpportunityClarificationRecord,
  recommendedPath: OpportunitySolutionPathRoute
) {
  if (recommendedPath === "needs_more_info") {
    return `Ask for: ${clarification.missingInformation[0] || "the missing decision that clarifies the route"}.`;
  }

  const steps: Record<OpportunitySolutionPathRoute, string> = {
    appengine_build_candidate: "Prepare a problem_solution_intake draft for owner review before any packet or build work.",
    app_tool_workflow: "Map the current workflow and define the smallest non-production tool or process improvement.",
    content_resource: "Draft a one-page resource outline for the affected audience.",
    community_ministry_model: "Draft the first service model with roles, boundaries, and review needs.",
    existing_ecosystem_service_later: "Verify whether the destination service exists and what review evidence is required before routing.",
    needs_more_info: "Ask the smallest clarifying question.",
    not_safe_or_not_ready: "Pause and require owner review before any routing."
  };

  return steps[recommendedPath];
}

function chooseConfidence(
  clarification: OpportunityClarificationRecord,
  blockers: string[]
): OpportunitySolutionPathConfidence {
  if (clarification.status !== "clarified" || blockers.length > 1) return "low";
  if (blockers.length === 1) return "medium";
  return "high";
}

function explainRouting(clarification: OpportunityClarificationRecord, recommendedPath: OpportunitySolutionPathRoute) {
  if (recommendedPath === "not_safe_or_not_ready") {
    return "The clarification is safety-sensitive or not actionable enough for a solution path.";
  }

  if (recommendedPath === "needs_more_info") {
    return "The clarification still has missing information, so the next path should gather context before creating packets.";
  }

  if (recommendedPath === "existing_ecosystem_service_later") {
    return "The opportunity may fit an ecosystem destination later, but the destination must be verified before routing.";
  }

  return `The clarified opportunity points most directly toward ${recommendedPath.replaceAll("_", " ")}.`;
}

function buildNextActionPrompt(
  record: Omit<OpportunitySolutionPathRecord, "artifact" | "nextAppEngineActionPrompt">,
  clarification: OpportunityClarificationRecord
) {
  return `Review this opportunity_solution_path for AppEngine.\n\nSource artifact: opportunity_clarification ${clarification.id}\nRecommended path: ${record.recommendedPath}\nReason: ${record.reasonForRouting}\nFirst practical step: ${record.firstPracticalStep}\nNeeded resources: ${record.neededResources.join(", ")}\nBlockers: ${record.blockers.join(", ") || "None"}\nConfidence: ${record.confidenceLevel}\n\nGoal: Decide whether to approve the next owner-reviewed AppEngine action, ask for more info, or pause. Do not create build packets yet.\n\nGuardrails: Do not trigger Codex, create GitHub issues, apply labels, deploy production, create paid resources, run migrations, add secrets/env vars, change repo visibility, or assume Spark, Live On Mission, Best Life, or any ecosystem app is fully built.`;
}

async function readOpportunitySolutionPathStore(): Promise<OpportunitySolutionPathStore> {
  return getAppEngineStateAdapter().readJson<OpportunitySolutionPathStore>(
    { kind: "opportunity_solution_path", key: "records" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeOpportunitySolutionPathStore(store: OpportunitySolutionPathStore) {
  return getAppEngineStateAdapter().writeJson({ kind: "opportunity_solution_path", key: "records" }, store);
}
