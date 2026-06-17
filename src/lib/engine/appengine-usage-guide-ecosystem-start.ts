import { randomUUID } from "node:crypto";
import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import {
  createBuildExecutionRequest,
  reviewBuildExecutionRequest,
  type BuildExecutionRequestRecord
} from "@/lib/engine/build-execution-request";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import { savePreparedHandoffFromReadyOpportunityResultReview } from "@/lib/engine/handoff-relay";
import { updateProjectMemoryFromRealOpportunityResultReview } from "@/lib/engine/project-memory";
import { runRealOpportunityExample, type RealOpportunityExampleRunRecord } from "@/lib/engine/real-opportunity-example-runner";
import { createRealOpportunityResultReview } from "@/lib/engine/real-opportunity-result-review";

export type EcosystemBuildStartTarget =
  | "life_produces_life_core"
  | "spark_of_hope"
  | "live_on_mission"
  | "best_life"
  | "churchconnect"
  | "custom_ecosystem_slice";

export type EcosystemBuildStartInput = {
  target?: unknown;
  customName?: unknown;
  customProblemOrVision?: unknown;
  customAffectedPeople?: unknown;
  customBetterFuture?: unknown;
  customBarriers?: unknown;
  customDesiredImpact?: unknown;
};

export type EcosystemBuildStartRecord = {
  id: string;
  kind: "appengine_usage_guide_ecosystem_start";
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  selectedTarget: EcosystemBuildStartTarget;
  target: {
    name: string;
    slug: string;
    ecosystemRole: string;
  };
  opportunityInput: {
    problemOrVision: string;
    affectedPeople: string;
    betterFuture: string;
    barriers: string;
    desiredImpact: string;
    possibleSolutionType: "app_tool_workflow";
  };
  opportunityExample: {
    id: string;
    status: RealOpportunityExampleRunRecord["status"];
    fullLoopTrialId: string;
  };
  buildPacketDraft: {
    sourceArtifactKind: "opportunity_build_packet_bridge";
    id: string | null;
    status: string;
    packetType: string;
    summary: string;
  };
  buildExecutionRequest: {
    id: string;
    executionStatus: BuildExecutionRequestRecord["executionStatus"];
    reviewStatus: BuildExecutionRequestRecord["reviewStatus"];
  };
  exportedBuilderHandoff: {
    id: string;
    handoffInboxId: string | null;
    exactBuilderPrompt: string;
  };
  portfolioUpdate: {
    source: "app_portfolio_registry";
    targetSlug: string;
    status: string;
    nextSafeAction: string;
  };
  nextStepForLincoln: string;
  ownerReadableSummary: string;
  guardrails: ReturnType<typeof ecosystemBuildStartGuardrails>;
};

type EcosystemBuildStartStore = {
  schemaVersion: 1;
  records: EcosystemBuildStartRecord[];
};

type EcosystemBuildTargetConfig = {
  key: EcosystemBuildStartTarget;
  name: string;
  slug: string;
  ecosystemRole: string;
  problemOrVision: string;
  affectedPeople: string;
  betterFuture: string;
  barriers: string;
  desiredImpact: string;
};

export function ecosystemBuildStartGuardrails() {
  return {
    ...durableStateGuardrails(),
    internalControlledUseOnly: true,
    usesExistingOpportunityFlow: true,
    usesExistingBuildExecutionConnector: true,
    createsOpportunityInput: true,
    createsBuildPacketDraftBridge: true,
    createsBuildExecutionRequest: true,
    exportsBuilderHandoffForOwnerCopy: true,
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

export function appEngineUsageGuide() {
  return {
    headline: "How to use AppEngine today",
    currentCapability: [
      "AppEngine helps clarify ecosystem work, prepare packets, create build execution requests, export builder handoffs, track results, update memory, and preserve audit evidence.",
      "Codex still performs build execution manually until owner-approved auto-execution is enabled.",
      "The owner chooses the ecosystem slice, reviews the generated handoff, copies it to Codex, and pastes the result back into AppEngine."
    ],
    steps: [
      "Choose an ecosystem slice.",
      "Start the controlled build workflow.",
      "Review the generated Opportunity input, packet draft bridge, build execution request, and exported builder handoff.",
      "Copy the builder prompt only if it is right.",
      "Paste the builder result back into AppEngine for verification and state updates."
    ],
    guardrails: ecosystemBuildStartGuardrails()
  };
}

export async function listEcosystemBuildStartRecords() {
  const store = await readEcosystemBuildStartStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function startEcosystemBuild(input: EcosystemBuildStartInput = {}, now = new Date()) {
  const target = resolveTarget(input);
  const example = await runRealOpportunityExample({
    problemOrVision: target.problemOrVision,
    affectedPeople: target.affectedPeople,
    betterFuture: target.betterFuture,
    barriers: target.barriers,
    desiredImpact: target.desiredImpact,
    exampleContext: "lincoln_ecosystem"
  });
  const review = await createRealOpportunityResultReview({
    exampleId: example.id,
    status: "ready_for_next_appengine_action",
    ownerNotes: `Owner selected ${target.name} from the Start Ecosystem Build panel for internal controlled use. Prepare a builder handoff only; do not trigger Codex automatically.`
  });

  await updateProjectMemoryFromRealOpportunityResultReview(review);
  const preparedHandoff = await savePreparedHandoffFromReadyOpportunityResultReview(review);
  const buildRequest = await createBuildExecutionRequest({ sourceId: preparedHandoff.id }, now);
  const { record: exportedBuildRequest, handoff: exportedHandoff, exportOutput } = await reviewBuildExecutionRequest(
    {
      requestId: buildRequest.id,
      reviewStatus: "owner_approved",
      note: `Start Ecosystem Build exported a manual builder handoff for ${target.name}. Codex is not triggered automatically.`
    },
    now
  );
  const packetBridge = getPacketBridgeSummary(example);
  const createdAt = now.toISOString();
  const record: EcosystemBuildStartRecord = {
    id: `ecosystem_build_start_${randomUUID()}`,
    kind: "appengine_usage_guide_ecosystem_start",
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
    selectedTarget: target.key,
    target: {
      name: target.name,
      slug: target.slug,
      ecosystemRole: target.ecosystemRole
    },
    opportunityInput: {
      problemOrVision: target.problemOrVision,
      affectedPeople: target.affectedPeople,
      betterFuture: target.betterFuture,
      barriers: target.barriers,
      desiredImpact: target.desiredImpact,
      possibleSolutionType: "app_tool_workflow"
    },
    opportunityExample: {
      id: example.id,
      status: example.status,
      fullLoopTrialId: example.fullLoopTrialId
    },
    buildPacketDraft: packetBridge,
    buildExecutionRequest: {
      id: exportedBuildRequest.id,
      executionStatus: exportedBuildRequest.executionStatus,
      reviewStatus: exportedBuildRequest.reviewStatus
    },
    exportedBuilderHandoff: {
      id: exportedBuildRequest.exportedBuilderHandoffId || exportedHandoff?.id || "not_exported",
      handoffInboxId: exportedHandoff?.id || exportOutput?.handoffInboxId || null,
      exactBuilderPrompt:
        exportedBuildRequest.exportedBuilderHandoff?.exactBuilderPrompt ||
        exportOutput?.exactBuilderPrompt ||
        preparedHandoff.nextPrompt.prompt
    },
    portfolioUpdate: {
      source: "app_portfolio_registry",
      targetSlug: target.slug,
      status: `${target.name} has a packet draft bridge and exported builder handoff waiting for owner copy.`,
      nextSafeAction: "review_exported_builder_handoff"
    },
    nextStepForLincoln: `Review the exported builder handoff for ${target.name}, then copy it to Codex manually only if it is right.`,
    ownerReadableSummary: `${target.name} ecosystem build start is prepared. AppEngine generated Opportunity input, a packet draft bridge, a build execution request, and an export-ready builder handoff, then stopped for owner-controlled manual Codex execution.`,
    guardrails: ecosystemBuildStartGuardrails()
  };

  await writeEcosystemBuildStartRecord(record);
  await getAppEngineAuditTrail().append({
    type: "ecosystem_build_start_prepared",
    actor: { type: "owner", id: "Lincoln" },
    summary: record.ownerReadableSummary,
    subjectId: record.id,
    metadata: {
      selectedTarget: record.selectedTarget,
      targetSlug: record.target.slug,
      opportunityExampleId: record.opportunityExample.id,
      packetBridgeId: record.buildPacketDraft.id,
      buildExecutionRequestId: record.buildExecutionRequest.id,
      exportedBuilderHandoffId: record.exportedBuilderHandoff.id,
      codexTriggered: false,
      githubIssuesCreated: false,
      labelsApplied: false,
      productionDeployed: false,
      paidResourcesCreated: false,
      migrationsApplied: false,
      secretsOrEnvChanged: false
    }
  });

  return {
    record,
    opportunityExample: example,
    resultReview: review,
    preparedHandoff,
    buildExecutionRequest: exportedBuildRequest
  };
}

export function ecosystemBuildTargets() {
  return [
    targetConfigs.life_produces_life_core,
    targetConfigs.spark_of_hope,
    targetConfigs.live_on_mission,
    targetConfigs.best_life,
    targetConfigs.churchconnect,
    targetConfigs.custom_ecosystem_slice
  ];
}

const targetConfigs: Record<EcosystemBuildStartTarget, EcosystemBuildTargetConfig> = {
  life_produces_life_core: {
    key: "life_produces_life_core",
    name: "Life Produces Life Core",
    slug: "life-core",
    ecosystemRole: "Shared ecosystem foundation",
    problemOrVision:
      "Build the Life Produces Life Core foundation so the United Under God ecosystem can explain that transformation is the product and apps are tools.",
    affectedPeople: "Lincoln, United Under God leaders, future builders, and people moving from survival toward life.",
    betterFuture:
      "The ecosystem has a clear foundation, shared language, visible next steps, and boundaries that prevent purpose bleed between apps.",
    barriers:
      "The ecosystem includes many ideas and slices, and Lincoln needs AppEngine to turn the right next slice into clear, reviewable build work without overbuilding.",
    desiredImpact:
      "Create the next controlled Life Core build handoff so Codex can improve the ecosystem foundation while AppEngine tracks the work."
  },
  spark_of_hope: {
    key: "spark_of_hope",
    name: "Spark of Hope",
    slug: "spark-of-hope",
    ecosystemRole: "Hope and testimony intake",
    problemOrVision:
      "Help people share a safe hope story or intake request and receive encouragement without exposing private information or launching unsupported crisis features.",
    affectedPeople: "People in pain, ministry leaders reviewing stories, and future encouragers who need a safe first step.",
    betterFuture:
      "Spark can collect and review hope stories safely, show approved preview content only, and prepare the next persistence/review slice.",
    barriers:
      "Private data, safety language, moderation, persistence, and public sharing all need review gates before real launch.",
    desiredImpact:
      "Prepare the next Spark of Hope build handoff for a safe preview improvement while keeping production, public publishing, and real-user data blocked."
  },
  live_on_mission: {
    key: "live_on_mission",
    name: "Live On Mission",
    slug: "live-on-mission",
    ecosystemRole: "Action and service activation",
    problemOrVision:
      "Help people move from wanting to help toward a simple mission action they can take, track, and repeat.",
    affectedPeople: "People who want to serve, churches, community leaders, and people who need practical help.",
    betterFuture:
      "A person can find a clear action step, understand who it helps, and begin participating before they have every answer.",
    barriers:
      "Mission ideas can become abstract, too large, or disconnected from real next actions and local needs.",
    desiredImpact:
      "Prepare a bounded Live On Mission build handoff for a first action-oriented slice without claiming the full service exists."
  },
  best_life: {
    key: "best_life",
    name: "Best Life",
    slug: "best-life",
    ecosystemRole: "Flourishing and growth pathway",
    problemOrVision:
      "Help people move toward a fuller life through practical growth steps, reflection, stewardship, relationships, and purpose.",
    affectedPeople: "People seeking direction, growth, confidence, health, stewardship, and abundant life.",
    betterFuture:
      "A person can identify a life area, choose a small growth step, and see how it connects to purpose and flourishing.",
    barriers:
      "Growth tools can become generic, overwhelming, or disconnected from transformation and community support.",
    desiredImpact:
      "Prepare a bounded Best Life build handoff for a first growth-path slice while keeping scope clear and reviewable."
  },
  churchconnect: {
    key: "churchconnect",
    name: "ChurchConnect",
    slug: "churchconnect",
    ecosystemRole: "Church coordination and service workflow",
    problemOrVision:
      "Help churches coordinate people, needs, communication, and service work without creating confusing admin overhead.",
    affectedPeople: "Church leaders, volunteers, ministry teams, and people who need timely care or coordination.",
    betterFuture:
      "Church teams can see what needs attention, coordinate next actions, and reduce dropped handoffs.",
    barriers:
      "Church workflows can scatter across texts, spreadsheets, announcements, and disconnected tools.",
    desiredImpact:
      "Prepare a bounded ChurchConnect build handoff for a coordination slice while avoiding production claims or real data migration."
  },
  custom_ecosystem_slice: {
    key: "custom_ecosystem_slice",
    name: "Custom ecosystem slice",
    slug: "custom-ecosystem-slice",
    ecosystemRole: "Owner-defined ecosystem work",
    problemOrVision:
      "Clarify a custom ecosystem problem or vision and turn it into a safe AppEngine build handoff.",
    affectedPeople: "The people or leaders Lincoln identifies for this custom ecosystem slice.",
    betterFuture: "The custom slice has a clear first useful step and can be reviewed before any build execution.",
    barriers: "The custom slice needs owner-provided details before the work can be safely bounded.",
    desiredImpact: "Prepare a controlled AppEngine handoff for this custom ecosystem slice without automatic execution."
  }
};

function resolveTarget(input: EcosystemBuildStartInput): EcosystemBuildTargetConfig {
  const targetKey = parseTarget(input.target);
  const base = targetConfigs[targetKey];

  if (targetKey !== "custom_ecosystem_slice") return base;

  return {
    ...base,
    name: cleanOptional(input.customName, base.name, 80),
    slug: slugify(cleanOptional(input.customName, base.name, 80)),
    problemOrVision: cleanOptional(input.customProblemOrVision, base.problemOrVision, 800),
    affectedPeople: cleanOptional(input.customAffectedPeople, base.affectedPeople, 600),
    betterFuture: cleanOptional(input.customBetterFuture, base.betterFuture, 600),
    barriers: cleanOptional(input.customBarriers, base.barriers, 600),
    desiredImpact: cleanOptional(input.customDesiredImpact, base.desiredImpact, 600)
  };
}

function parseTarget(value: unknown): EcosystemBuildStartTarget {
  if (typeof value === "string" && value in targetConfigs) return value as EcosystemBuildStartTarget;
  return "life_produces_life_core";
}

function cleanOptional(value: unknown, fallback: string, limit: number) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return (text || fallback).slice(0, limit);
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "custom-ecosystem-slice"
  );
}

function getPacketBridgeSummary(example: RealOpportunityExampleRunRecord): EcosystemBuildStartRecord["buildPacketDraft"] {
  const bridgeSummary =
    example.fullLoopTrial.sourceArtifacts.find((artifact) => artifact.kind === "opportunity_build_packet_bridge")?.summary ||
    example.fullLoopTrial.packetDraftReadiness.status;

  return {
    sourceArtifactKind: "opportunity_build_packet_bridge",
    id: example.artifacts.packetBridgeId,
    status: example.fullLoopTrial.packetDraftReadiness.status,
    packetType: example.fullLoopTrial.packetDraftReadiness.packetType,
    summary: bridgeSummary
  };
}

async function readEcosystemBuildStartStore(): Promise<EcosystemBuildStartStore> {
  return getAppEngineStateAdapter().readJson<EcosystemBuildStartStore>(
    { kind: "internal_controlled_use_trials", key: "ecosystem-build-start" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeEcosystemBuildStartRecord(record: EcosystemBuildStartRecord) {
  const store = await readEcosystemBuildStartStore();
  await getAppEngineStateAdapter().writeJson(
    { kind: "internal_controlled_use_trials", key: "ecosystem-build-start" },
    {
      schemaVersion: 1,
      records: [record, ...store.records].slice(0, 20)
    }
  );
}
