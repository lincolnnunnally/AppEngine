import { randomUUID } from "node:crypto";
import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import { loadOwnerPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import { savePreparedHandoffFromReadyOpportunityResultReview, type HandoffRelaySummary } from "@/lib/engine/handoff-relay";
import { loadProjectMemory, updateProjectMemoryFromRealOpportunityResultReview } from "@/lib/engine/project-memory";
import { runRealOpportunityExample, type RealOpportunityExampleRunRecord } from "@/lib/engine/real-opportunity-example-runner";
import {
  createRealOpportunityResultReview,
  type RealOpportunityResultReviewRecord
} from "@/lib/engine/real-opportunity-result-review";

export type FirstRealEcosystemBuildRequestRecord = {
  id: string;
  kind: "first_real_ecosystem_build_request";
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  target: {
    appName: "Life Produces Life Core";
    ecosystem: "United Under God ecosystem foundation";
    doctrine: "transformation is the product";
    toolPositioning: "apps are tools";
  };
  seed: typeof firstRealEcosystemBuildRequestSeed;
  realExample: {
    id: string;
    status: RealOpportunityExampleRunRecord["status"];
    fullLoopTrialId: string;
    packetBridgeId: string | null;
  };
  resultReview: {
    id: string;
    status: RealOpportunityResultReviewRecord["reviewStatus"];
  };
  preparedHandoff: {
    id: string;
    source: HandoffRelaySummary["source"];
    prompt: string;
    expectedOutcome: string;
  };
  portfolioUpdate: {
    opportunityStatus: string;
    nextSafeAction: string;
    sourceArtifactKind: string;
    sourceArtifactId: string | null;
  };
  projectMemoryUpdate: {
    currentState: string;
    recommendedNextAction: string;
    lastHandoffId: string | null;
  };
  auditTrailUpdate: {
    eventCount: number;
    latestEventTypes: string[];
  };
  nextSafeAction: "owner_review_prepared_handoff";
  ownerReadableSummary: string;
  guardrails: ReturnType<typeof firstRealEcosystemBuildRequestGuardrails>;
};

type FirstRealEcosystemBuildRequestStore = {
  schemaVersion: 1;
  records: FirstRealEcosystemBuildRequestRecord[];
};

export const firstRealEcosystemBuildRequestSeed = {
  appName: "Life Produces Life Core",
  ecosystem: "United Under God ecosystem foundation",
  problemOrVision:
    "Begin the first real ecosystem build request for Life Produces Life Core as the United Under God ecosystem foundation. The goal is to help people move from pain and survival toward life, clarity, purpose, and useful next steps.",
  affectedPeople:
    "Lincoln, United Under God leaders, future ecosystem builders, and people who need a clear path from problem or pain toward hope, purpose, and practical help.",
  betterFuture:
    "Life Produces Life Core gives the ecosystem a clear foundation where transformation is the product, apps are tools, and each future app or service can point people toward life without purpose bleed.",
  barriers:
    "The ecosystem has many app slices, ideas, and workflows. The next build must avoid scattered work, generic app output, premature production launch, and confusion between AppEngine, Opportunity, Life Core, Spark, and future services.",
  desiredImpact:
    "Create a prepared AppEngine handoff for the next actual Life Produces Life Core ecosystem build slice so the system can begin building from the completed internal Opportunity flow while Lincoln remains in approval control."
} as const;

export function firstRealEcosystemBuildRequestGuardrails() {
  return {
    ...durableStateGuardrails(),
    usesExistingOpportunityFlow: true,
    noNewOpportunityArchitecture: true,
    ownerFacingGuidedRequest: true,
    noFinalPacketCreated: true,
    noCodexAutoExecution: true,
    noGitHubIssueCreation: true,
    noLabelChanges: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noLiveMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true
  };
}

export async function listFirstRealEcosystemBuildRequests() {
  const store = await readFirstRealEcosystemBuildRequestStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function runFirstRealEcosystemBuildRequest(now = new Date()) {
  const example = await runRealOpportunityExample({
    problemOrVision: firstRealEcosystemBuildRequestSeed.problemOrVision,
    affectedPeople: firstRealEcosystemBuildRequestSeed.affectedPeople,
    betterFuture: firstRealEcosystemBuildRequestSeed.betterFuture,
    barriers: firstRealEcosystemBuildRequestSeed.barriers,
    desiredImpact: firstRealEcosystemBuildRequestSeed.desiredImpact,
    exampleContext: "lincoln_ecosystem"
  });
  const review = await createRealOpportunityResultReview({
    exampleId: example.id,
    status: "ready_for_next_appengine_action",
    ownerNotes:
      "First real ecosystem build request approved for prepared AppEngine handoff only. Do not create final packets, trigger Codex, create issues, apply labels, deploy, create paid resources, run migrations, or change secrets."
  });
  await updateProjectMemoryFromRealOpportunityResultReview(review);
  const handoff = await savePreparedHandoffFromReadyOpportunityResultReview(review);
  const [portfolioRegistry, projectMemory, auditEvents] = await Promise.all([
    loadOwnerPortfolioRegistry(),
    loadProjectMemory(),
    getAppEngineAuditTrail().list()
  ]);
  const opportunityEntry = portfolioRegistry.apps.find((entry) => entry.slug === "opportunity");
  const createdAt = now.toISOString();
  const record: FirstRealEcosystemBuildRequestRecord = {
    id: `first_real_ecosystem_build_${randomUUID()}`,
    kind: "first_real_ecosystem_build_request",
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
    target: {
      appName: "Life Produces Life Core",
      ecosystem: "United Under God ecosystem foundation",
      doctrine: "transformation is the product",
      toolPositioning: "apps are tools"
    },
    seed: firstRealEcosystemBuildRequestSeed,
    realExample: {
      id: example.id,
      status: example.status,
      fullLoopTrialId: example.fullLoopTrialId,
      packetBridgeId: example.artifacts.packetBridgeId || null
    },
    resultReview: {
      id: review.id,
      status: review.reviewStatus
    },
    preparedHandoff: {
      id: handoff.id,
      source: handoff.source,
      prompt: handoff.nextPrompt.prompt,
      expectedOutcome: handoff.nextPrompt.expectedOutcome
    },
    portfolioUpdate: {
      opportunityStatus: opportunityEntry?.status || "Opportunity portfolio entry not visible yet",
      nextSafeAction: opportunityEntry?.nextSafeAction || "unknown",
      sourceArtifactKind: opportunityEntry?.sourceArtifact.kind || "unknown",
      sourceArtifactId: opportunityEntry?.sourceArtifact.id || null
    },
    projectMemoryUpdate: {
      currentState: projectMemory.latestProjectState.currentState,
      recommendedNextAction: projectMemory.latestProjectState.recommendedNextAction,
      lastHandoffId: projectMemory.latestProjectState.lastHandoffId
    },
    auditTrailUpdate: {
      eventCount: auditEvents.length,
      latestEventTypes: auditEvents.slice(-5).map((event) => event.type)
    },
    nextSafeAction: "owner_review_prepared_handoff",
    ownerReadableSummary:
      "Life Produces Life Core first real ecosystem build request ran through the existing Opportunity flow and produced a prepared AppEngine handoff for owner review.",
    guardrails: firstRealEcosystemBuildRequestGuardrails()
  };

  await writeFirstRealEcosystemBuildRequest(record);

  return record;
}

async function readFirstRealEcosystemBuildRequestStore(): Promise<FirstRealEcosystemBuildRequestStore> {
  return getAppEngineStateAdapter().readJson<FirstRealEcosystemBuildRequestStore>(
    { kind: "internal_controlled_use_trials", key: "first-real-ecosystem-build-request" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeFirstRealEcosystemBuildRequest(record: FirstRealEcosystemBuildRequestRecord) {
  const store = await readFirstRealEcosystemBuildRequestStore();
  await getAppEngineStateAdapter().writeJson(
    { kind: "internal_controlled_use_trials", key: "first-real-ecosystem-build-request" },
    {
      schemaVersion: 1,
      records: [record, ...store.records].slice(0, 20)
    }
  );
}
