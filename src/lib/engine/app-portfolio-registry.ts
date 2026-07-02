import { getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import { listOwnerRegisteredApps } from "./portfolio-registrations";
import { listRegisteredAppProjects, type RegisteredAppProject } from "@/lib/engine/app-portfolio-registry-store";
import { listBuildExecutionRequests } from "@/lib/engine/build-execution-request";
import { listFirstEcosystemBuildPacketDrafts } from "@/lib/engine/first-ecosystem-build-packet-draft";
import { listHandoffRelaySummaries } from "@/lib/engine/handoff-relay";
import { getLifeCoreOverview } from "@/lib/engine/life-core";
import { listOpportunityActionPlans } from "@/lib/engine/opportunity-action-plan";
import { listOpportunityAppEngineCandidates } from "@/lib/engine/opportunity-appengine-candidate";
import { listOpportunityBuildPacketBridges } from "@/lib/engine/opportunity-build-packet-bridge";
import { listOpportunityClarifications } from "@/lib/engine/opportunity-clarification";
import { listOpportunityIntakeRecords } from "@/lib/engine/opportunity-intake";
import { listOpportunitySolutionPaths } from "@/lib/engine/opportunity-solution-path";
import { listOrchestratorActionQueue } from "@/lib/engine/orchestrator-run";
import { listProblemIntakeRecords } from "@/lib/engine/problem-intake-lite";
import { loadProjectMemory } from "@/lib/engine/project-memory";
import { listRealOpportunityResultReviews } from "@/lib/engine/real-opportunity-result-review";
import { getStoryIntakeCapability } from "@/lib/spark-of-hope-intake-lite/intake";

export type AppPortfolioEntryType =
  | "appengine_core"
  | "opportunity_front_door"
  | "ecosystem_core"
  | "app_slice"
  | "future_ecosystem_service";

export type AppPortfolioDeploymentState =
  | "build_preview"
  | "review_ready"
  | "review_blocked"
  | "approved_for_release"
  | "production_live"
  | "production_blocked"
  | "failed_needs_fix"
  | "unknown";

export type AppPortfolioBuildState =
  | "planned"
  | "ready_for_build"
  | "draft_pr_open"
  | "preview_pending"
  | "preview_verified"
  | "review_blocked"
  | "release_blocked"
  | "owner_approval_required"
  | "ready_for_vnext"
  | "failed_needs_fix"
  | "unknown";

export type AppPortfolioNextSafeAction =
  | "create_planning_issue"
  | "create_implementation_issue"
  | "create_draft_pr"
  | "wait_for_preview"
  | "verify_preview"
  | "verify_review_url"
  | "run_review_gates"
  | "create_fix_issue"
  | "await_owner_review"
  | "stop_for_owner_approval"
  | "pause_for_budget"
  | "request_budget_approval"
  | "prepare_release_gate"
  | "create_vnext_packet"
  | "continue_internal_trial"
  | "review_exported_builder_handoff"
  | "unknown";

export type AppPortfolioLink = {
  label: string;
  url: string;
};

export type AppPortfolioIssueLink = {
  number: number;
  title: string;
  url: string;
};

export type AppPortfolioPullRequestLink = AppPortfolioIssueLink & {
  state: "open" | "merged" | "draft" | "unknown";
  branch?: string;
};

export type AppPortfolioStateSource = "live_state" | "derived_state" | "seeded_fallback";

export type AppPortfolioSourceArtifact = {
  kind: string;
  id?: string;
  summary: string;
};

export type AppPortfolioBuildPacketBridgeVisibility = {
  candidateState: string;
  buildPacketBridgeState: string;
  recommendedPacketDraftType: string;
  ownerApprovalStatus: string;
  missingInformation: string[];
  nextSafeAppEngineAction: string;
  sourceArtifactEvidence: AppPortfolioSourceArtifact[];
};

export type AppPortfolioEntry = {
  name: string;
  slug: string;
  type: AppPortfolioEntryType;
  status: string;
  reviewUrl: string;
  productionUrl: string;
  currentVersion: string;
  deploymentState: AppPortfolioDeploymentState;
  buildState: AppPortfolioBuildState;
  nextSafeAction: AppPortfolioNextSafeAction;
  sourceOfTruthFiles: string[];
  linkedIssues: AppPortfolioIssueLink[];
  linkedPRs: AppPortfolioPullRequestLink[];
  blockers: string[];
  evidenceLinks: AppPortfolioLink[];
  stateSource: AppPortfolioStateSource;
  sourceArtifact: AppPortfolioSourceArtifact;
  buildPacketBridgeVisibility?: AppPortfolioBuildPacketBridgeVisibility;
  lastUpdated: string;
};

export type AppPortfolioRegistry = {
  kind: "app_portfolio_registry";
  schemaVersion: 1;
  generatedAt: string;
  owner: "Lincoln";
  summary: {
    totalApps: number;
    reviewReadyApps: number;
    productionLiveApps: number;
    blockedApps: number;
    unknownReviewUrls: number;
    nextSafeActions: Record<string, number>;
    byStateSource: Record<AppPortfolioStateSource, number>;
  };
  apps: AppPortfolioEntry[];
  // Canonical durable registrations + completed-loop evidence (the single source
  // of truth for what AppEngine has built or is building). Merged in from the
  // app_portfolio_registry store on top of the derived/assembled apps above.
  registeredAppProjects: RegisteredAppProject[];
  guardrails: {
    noSecretsInRegistry: true;
    noPrivateUserData: true;
    productionApprovalRequired: true;
    protectedPreviewBypassLinksBlocked: true;
    appBoundariesRequired: true;
  };
  ownerReadableSummary: string;
};

const generatedAt = "2026-06-17T00:00:00.000Z";

export async function loadOwnerPortfolioRegistry(): Promise<AppPortfolioRegistry> {
  const seedEntries = getSeedPortfolioEntries();
  const [
    projectMemory,
    orchestratorActionQueue,
    buildExecutionRequests,
    opportunityIntakes,
    opportunityClarifications,
    opportunitySolutionPaths,
    opportunityActionPlans,
    opportunityCandidates,
    opportunityBuildPacketBridges,
    realOpportunityResultReviews,
    handoffs,
    firstEcosystemBuildPacketDrafts,
    problemIntakes,
    lifeCoreOverview,
    rawLifeCoreStore
  ] = await Promise.all([
    loadProjectMemory(),
    listOrchestratorActionQueue(),
    listBuildExecutionRequests(),
    listOpportunityIntakeRecords(),
    listOpportunityClarifications(),
    listOpportunitySolutionPaths(),
    listOpportunityActionPlans(),
    listOpportunityAppEngineCandidates(),
    listOpportunityBuildPacketBridges(),
    listRealOpportunityResultReviews(),
    listHandoffRelaySummaries(),
    listFirstEcosystemBuildPacketDrafts(),
    listProblemIntakeRecords(),
    getLifeCoreOverview(),
    readRawLifeCoreStore()
  ]);
  const sparkCapability = getStoryIntakeCapability();

  // Owner-registered apps (the "Add an app" button) override imported seeds
  // with the same slug — the owner's own record wins.
  const ownerRegistered = await listOwnerRegisteredApps();
  const importedSlugTaken = new Set(ownerRegistered.map((app) => app.slug));

  const registry = buildAppPortfolioRegistry([
    deriveAppEngineCoreEntry(seedEntries[0], projectMemory, orchestratorActionQueue, buildExecutionRequests),
    deriveOpportunityEntry(seedEntries[1], {
      opportunityIntakes,
      opportunityClarifications,
      opportunitySolutionPaths,
      opportunityActionPlans,
      opportunityCandidates,
      opportunityBuildPacketBridges,
      realOpportunityResultReviews,
      handoffs
    }),
    deriveLifeCoreEntry(
      seedEntries[2],
      lifeCoreOverview,
      Boolean(rawLifeCoreStore),
      firstEcosystemBuildPacketDrafts,
      buildExecutionRequests
    ),
    deriveSparkEntry(seedEntries[3], sparkCapability),
    deriveFutureEcosystemEntry(seedEntries[4], { problemIntakes, opportunityCandidates }),
    ...(await getOwnerRegisteredEntries(importedSlugTaken)),
    ...getImportedEcosystemPortfolioEntries().filter((entry) => !importedSlugTaken.has(entry.slug))
  ]);

  // Canonical durable registrations + completed-loop evidence are merged on top
  // of the derived view so app_portfolio_registry is the single source of truth.
  registry.registeredAppProjects = await listRegisteredAppProjects();
  return registry;
}

export function buildAppPortfolioRegistry(apps: AppPortfolioEntry[]): AppPortfolioRegistry {
  const nextSafeActions = apps.reduce<Record<string, number>>((counts, app) => {
    counts[app.nextSafeAction] = (counts[app.nextSafeAction] || 0) + 1;
    return counts;
  }, {});
  const byStateSource = apps.reduce<Record<AppPortfolioStateSource, number>>(
    (counts, app) => {
      counts[app.stateSource] = (counts[app.stateSource] || 0) + 1;
      return counts;
    },
    { live_state: 0, derived_state: 0, seeded_fallback: 0 }
  );
  const blockedApps = apps.filter(
    (app) =>
      app.blockers.length > 0 ||
      app.deploymentState === "production_blocked" ||
      app.deploymentState === "review_blocked" ||
      app.buildState === "release_blocked" ||
      app.buildState === "review_blocked"
  ).length;
  const unknownReviewUrls = apps.filter((app) => isUnknownUrl(app.reviewUrl)).length;

  return {
    kind: "app_portfolio_registry",
    schemaVersion: 1,
    generatedAt,
    owner: "Lincoln",
    summary: {
      totalApps: apps.length,
      reviewReadyApps: apps.filter((app) => app.deploymentState === "review_ready").length,
      productionLiveApps: apps.filter((app) => app.deploymentState === "production_live").length,
      blockedApps,
      unknownReviewUrls,
      nextSafeActions,
      byStateSource
    },
    apps,
    registeredAppProjects: [],
    guardrails: {
      noSecretsInRegistry: true,
      noPrivateUserData: true,
      productionApprovalRequired: true,
      protectedPreviewBypassLinksBlocked: true,
      appBoundariesRequired: true
    },
    ownerReadableSummary:
      "Owner Portfolio Dashboard indexes AppEngine-created apps, ecosystem slices, review paths, production status, source artifacts, and next safe actions from the app_portfolio_registry standard."
  };
}

function deriveAppEngineCoreEntry(
  seed: AppPortfolioEntry,
  projectMemory: Awaited<ReturnType<typeof loadProjectMemory>>,
  actionQueue: Awaited<ReturnType<typeof listOrchestratorActionQueue>>,
  buildExecutionRequests: Awaited<ReturnType<typeof listBuildExecutionRequests>>
): AppPortfolioEntry {
  const memoryItemCount =
    projectMemory.majorDecisions.length +
    projectMemory.acceptedApproaches.length +
    projectMemory.rejectedApproaches.length +
    projectMemory.completedMilestones.length +
    projectMemory.currentBlockers.length +
    projectMemory.openQuestions.length +
    projectMemory.progressHistory.length +
    actionQueue.length +
    buildExecutionRequests.length;

  if (!memoryItemCount) return seed;

  const blockers = projectMemory.currentBlockers.map((item) => item.text);
  const queuedActions = actionQueue.filter((action) => action.status === "queued").length;
  const preparedActions = actionQueue.filter((action) => action.status === "prepared_handoff").length;
  const latestBuildExecutionRequest = buildExecutionRequests[0] || null;

  return {
    ...seed,
    status: latestBuildExecutionRequest?.latestBuilderResult
      ? `builder result ${latestBuildExecutionRequest.executionStatus.replaceAll("_", " ")}`
      : latestBuildExecutionRequest
      ? `build execution request ${latestBuildExecutionRequest.reviewStatus.replaceAll("_", " ")}`
      : projectMemory.latestProjectState.currentState || seed.status,
    buildState: queuedActions || preparedActions || latestBuildExecutionRequest ? "owner_approval_required" : seed.buildState,
    nextSafeAction: latestBuildExecutionRequest?.latestBuilderResult
      ? normalizeNextSafeAction(latestBuildExecutionRequest.latestBuilderResult.nextSafeAction, "await_owner_review")
      : latestBuildExecutionRequest?.reviewStatus === "exported_for_builder"
      ? "review_exported_builder_handoff"
      : normalizeNextSafeAction(projectMemory.latestProjectState.recommendedNextAction, seed.nextSafeAction),
    blockers: blockers.length ? blockers : seed.blockers,
    evidenceLinks: [
      ...seed.evidenceLinks,
      { label: "Project Memory", url: "/owner-control-center" },
      { label: "Orchestrator Queue", url: "/owner-control-center" },
      ...(latestBuildExecutionRequest ? [{ label: "Build Execution Request", url: "/owner-control-center" }] : [])
    ],
    stateSource: "live_state",
    sourceArtifact: latestBuildExecutionRequest
      ? {
          kind: "build_execution_request",
          id: latestBuildExecutionRequest.id,
          summary: latestBuildExecutionRequest.latestBuilderResult?.ownerReadableSummary || latestBuildExecutionRequest.ownerReadableSummary
        }
      : {
          kind: "project_memory",
          summary: `${memoryItemCount} memory/queue item${memoryItemCount === 1 ? "" : "s"} loaded from AppEngine state.`
        },
    lastUpdated: latestBuildExecutionRequest?.updatedAt || projectMemory.updatedAt || generatedAt
  };
}

function deriveOpportunityEntry(
  seed: AppPortfolioEntry,
  state: {
    opportunityIntakes: Awaited<ReturnType<typeof listOpportunityIntakeRecords>>;
    opportunityClarifications: Awaited<ReturnType<typeof listOpportunityClarifications>>;
    opportunitySolutionPaths: Awaited<ReturnType<typeof listOpportunitySolutionPaths>>;
    opportunityActionPlans: Awaited<ReturnType<typeof listOpportunityActionPlans>>;
    opportunityCandidates: Awaited<ReturnType<typeof listOpportunityAppEngineCandidates>>;
    opportunityBuildPacketBridges: Awaited<ReturnType<typeof listOpportunityBuildPacketBridges>>;
    realOpportunityResultReviews: Awaited<ReturnType<typeof listRealOpportunityResultReviews>>;
    handoffs: Awaited<ReturnType<typeof listHandoffRelaySummaries>>;
  }
): AppPortfolioEntry {
  const liveCount =
    state.opportunityIntakes.length +
    state.opportunityClarifications.length +
    state.opportunitySolutionPaths.length +
    state.opportunityActionPlans.length +
    state.opportunityCandidates.length +
    state.opportunityBuildPacketBridges.length +
    state.realOpportunityResultReviews.length +
    state.handoffs.filter((handoff) => handoff.source === "opportunity_prepared_handoff").length;

  if (!liveCount) return seed;

  const latestCandidate = state.opportunityCandidates[0] || null;
  const latestPlan = state.opportunityActionPlans[0] || null;
  const latestPath = state.opportunitySolutionPaths[0] || null;
  const latestIntake = state.opportunityIntakes[0] || null;
  const latestBridge = state.opportunityBuildPacketBridges[0] || null;
  const latestReview = state.realOpportunityResultReviews[0] || null;
  const reviewReady = latestReview?.reviewStatus === "ready_for_next_appengine_action";
  const latestPreparedHandoff =
    state.handoffs.find((handoff) => handoff.source === "opportunity_prepared_handoff") || null;
  const buildPacketBridgeVisibility = buildOpportunityBridgeVisibility({
    latestBridge,
    latestCandidate,
    latestPlan,
    latestPath,
    latestIntake
  });
  const blockers = [
    ...(latestBridge?.missingInformation || []),
    ...(latestCandidate?.risksBlockers || []),
    ...(latestPlan?.risksBlockers || []),
    ...(latestPath?.blockers || []),
    latestCandidate && !latestBridge ? "Candidate exists, packet bridge not prepared yet." : "",
    latestReview?.portfolioStateUpdate.blocker || "",
    latestPreparedHandoff ? "Prepared AppEngine handoff is waiting in the Handoff Inbox for owner review/copy." : "",
    "No public production URL yet; remains inside AppEngine controlled-use flow."
  ];

  return {
    ...seed,
    status: latestPreparedHandoff
      ? "prepared AppEngine handoff waiting in Handoff Inbox"
      : reviewReady
      ? "real Opportunity result reviewed · ready for next AppEngine action"
      : `${state.opportunityIntakes.length} intake${state.opportunityIntakes.length === 1 ? "" : "s"} · ${state.opportunityCandidates.length} candidate${state.opportunityCandidates.length === 1 ? "" : "s"}`,
    buildState: latestPreparedHandoff || reviewReady
      ? "owner_approval_required"
      : latestBridge
        ? "owner_approval_required"
        : latestCandidate
          ? "owner_approval_required"
          : latestPlan || latestPath
            ? "planned"
            : "ready_for_build",
    nextSafeAction: latestPreparedHandoff
      ? "await_owner_review"
      : reviewReady
        ? "continue_internal_trial"
      : latestBridge
        ? "await_owner_review"
        : latestCandidate
          ? "stop_for_owner_approval"
          : latestPlan || latestPath
            ? "await_owner_review"
            : "create_planning_issue",
    blockers: uniqueStrings(blockers),
    stateSource: "live_state",
    buildPacketBridgeVisibility,
    sourceArtifact: latestPreparedHandoff
      ? { kind: "handoff_relay_summary", id: latestPreparedHandoff.id, summary: latestPreparedHandoff.ownerReadableSummary }
      : latestReview
      ? { kind: "real_opportunity_result_review", id: latestReview.id, summary: latestReview.ownerReadableSummary }
      : latestBridge
      ? { kind: "opportunity_build_packet_bridge", id: latestBridge.id, summary: latestBridge.title }
      : latestCandidate
      ? { kind: "opportunity_appengine_candidate", id: latestCandidate.id, summary: latestCandidate.title }
      : latestPlan
        ? { kind: "opportunity_action_plan", id: latestPlan.id, summary: latestPlan.title }
        : latestPath
          ? { kind: "opportunity_solution_path", id: latestPath.id, summary: latestPath.title }
          : { kind: "opportunity_intake", id: latestIntake?.id, summary: latestIntake?.title || "Opportunity intake state" },
    lastUpdated:
      latestPreparedHandoff?.receivedAt ||
      latestReview?.updatedAt ||
      latestBridge?.updatedAt ||
      latestCandidate?.updatedAt ||
      latestPlan?.updatedAt ||
      latestPath?.updatedAt ||
      latestIntake?.updatedAt ||
      generatedAt
  };
}

function deriveLifeCoreEntry(
  seed: AppPortfolioEntry,
  overview: Awaited<ReturnType<typeof getLifeCoreOverview>>,
  hasStoredOverview: boolean,
  firstEcosystemBuildPacketDrafts: Awaited<ReturnType<typeof listFirstEcosystemBuildPacketDrafts>>,
  buildExecutionRequests: Awaited<ReturnType<typeof listBuildExecutionRequests>>
): AppPortfolioEntry {
  const latestDraft = firstEcosystemBuildPacketDrafts[0] || null;
  const latestLifeCoreBuildRequest =
    buildExecutionRequests.find((request) => request.targetProjectSlice.toLowerCase().includes("life produces life core")) || null;

  if (latestLifeCoreBuildRequest) {
    return {
      ...seed,
      status: latestLifeCoreBuildRequest.latestBuilderResult
        ? `builder result ${latestLifeCoreBuildRequest.executionStatus.replaceAll("_", " ")}`
        : `build execution request ${latestLifeCoreBuildRequest.reviewStatus.replaceAll("_", " ")}`,
      buildState: "owner_approval_required",
      nextSafeAction: latestLifeCoreBuildRequest.latestBuilderResult
        ? normalizeNextSafeAction(latestLifeCoreBuildRequest.latestBuilderResult.nextSafeAction, "await_owner_review")
        : latestLifeCoreBuildRequest.reviewStatus === "exported_for_builder"
          ? "review_exported_builder_handoff"
          : "await_owner_review",
      blockers: uniqueStrings([
        latestLifeCoreBuildRequest.latestBuilderResult?.blockers[0] ||
        (latestLifeCoreBuildRequest.reviewStatus === "exported_for_builder"
          ? "Builder handoff is exported, but Lincoln must still manually review and send it."
          : "Owner review is required before builder execution."),
        "Codex auto-execution, GitHub issue creation, labels, deploys, paid resources, migrations, and secrets/env changes remain blocked.",
        ...seed.blockers
      ]),
      evidenceLinks: [...seed.evidenceLinks, { label: "Build Execution Request", url: "/owner-control-center" }],
      stateSource: "live_state",
      sourceArtifact: {
        kind: "build_execution_request",
        id: latestLifeCoreBuildRequest.id,
        summary: latestLifeCoreBuildRequest.latestBuilderResult?.ownerReadableSummary || latestLifeCoreBuildRequest.ownerReadableSummary
      },
      lastUpdated: latestLifeCoreBuildRequest.updatedAt
    };
  }

  if (latestDraft) {
    return {
      ...seed,
      status: "first ecosystem build packet draft ready for owner review",
      buildState: "owner_approval_required",
      nextSafeAction: "await_owner_review",
      blockers: uniqueStrings([
        "Owner review is required before this draft becomes a final packet.",
        "Codex execution, GitHub issues, labels, deploys, paid resources, migrations, and secrets/env changes remain blocked.",
        ...seed.blockers
      ]),
      evidenceLinks: [...seed.evidenceLinks, { label: "First Ecosystem Build Packet Draft", url: "/owner-control-center" }],
      stateSource: "live_state",
      sourceArtifact: {
        kind: "first_ecosystem_build_packet_draft",
        id: latestDraft.id,
        summary: latestDraft.ownerReadableSummary
      },
      lastUpdated: latestDraft.updatedAt
    };
  }

  return {
    ...seed,
    status: `${overview.experiences.length} experiences · ${overview.opportunities.length} opportunities · ${overview.feed.length} feed items`,
    stateSource: hasStoredOverview ? "live_state" : "seeded_fallback",
    sourceArtifact: {
      kind: "life_core_overview",
      summary: hasStoredOverview
        ? "Loaded from adapter-backed Life Core state."
        : "Using Life Core seed overview because no stored adapter state exists yet."
    },
    lastUpdated: generatedAt
  };
}

function deriveSparkEntry(seed: AppPortfolioEntry, capability: ReturnType<typeof getStoryIntakeCapability>): AppPortfolioEntry {
  const storageBlocked = capability.storage === "preview_controlled_persistence_blocked";
  const blockers = [
    ...seed.blockers,
    "Spark review statuses still depend on browser-local review queue state until durable review persistence is activated.",
    storageBlocked ? "Controlled preview persistence is configured as blocked in the current environment." : ""
  ];

  return {
    ...seed,
    status: `${capability.mode.replaceAll("_", " ")} · ${capability.storage.replaceAll("_", " ")}`,
    buildState: capability.storage === "disabled" ? "ready_for_vnext" : storageBlocked ? "review_blocked" : "preview_verified",
    nextSafeAction: storageBlocked ? "create_fix_issue" : seed.nextSafeAction,
    blockers: uniqueStrings(blockers),
    stateSource: "derived_state",
    sourceArtifact: {
      kind: "spark_story_intake_capability",
      summary: `Spark API reports ${capability.mode} with ${capability.storage}.`
    },
    lastUpdated: generatedAt
  };
}

function deriveFutureEcosystemEntry(
  seed: AppPortfolioEntry,
  state: {
    problemIntakes: Awaited<ReturnType<typeof listProblemIntakeRecords>>;
    opportunityCandidates: Awaited<ReturnType<typeof listOpportunityAppEngineCandidates>>;
  }
): AppPortfolioEntry {
  const liveCount = state.problemIntakes.length + state.opportunityCandidates.length;

  if (!liveCount) return seed;

  const latestProblem = state.problemIntakes[0] || null;
  const latestCandidate = state.opportunityCandidates[0] || null;

  return {
    ...seed,
    status: `${state.problemIntakes.length} problem intake${state.problemIntakes.length === 1 ? "" : "s"} · ${state.opportunityCandidates.length} opportunity candidate${state.opportunityCandidates.length === 1 ? "" : "s"}`,
    buildState: "planned",
    nextSafeAction: "await_owner_review",
    blockers: uniqueStrings([
      "Owner review is required before any candidate becomes a packet, issue, PR, or build.",
      ...seed.blockers
    ]),
    stateSource: "live_state",
    sourceArtifact: latestCandidate
      ? { kind: "opportunity_appengine_candidate", id: latestCandidate.id, summary: latestCandidate.title }
      : { kind: "problem_intake", id: latestProblem?.id, summary: latestProblem?.title || "Problem intake state" },
    lastUpdated: latestCandidate?.updatedAt || latestProblem?.updatedAt || generatedAt
  };
}

async function getOwnerRegisteredEntries(_taken: Set<string>): Promise<AppPortfolioEntry[]> {
  const registered = await listOwnerRegisteredApps();
  return registered.map((app) => ({
    name: app.name,
    slug: app.slug,
    type: "ecosystem_core",
    status:
      app.appStatus === "live"
        ? `live${app.builtWith ? ` — built with ${app.builtWith}` : ""}${app.notes ? ` — ${app.notes}` : ""}`
        : app.appStatus === "idea"
          ? `idea${app.notes ? ` — ${app.notes}` : ""}`
          : `in progress${app.builtWith ? ` — built with ${app.builtWith}` : ""}${app.notes ? ` — ${app.notes}` : ""}`,
    reviewUrl: app.liveUrl || app.repoUrl || "unknown",
    productionUrl: app.liveUrl || "approval-gated",
    currentVersion: "owner-registered",
    deploymentState: app.appStatus === "live" ? "production_live" : "production_blocked",
    buildState: app.appStatus === "live" ? "ready_for_vnext" : app.appStatus === "idea" ? "planned" : "ready_for_build",
    nextSafeAction:
      app.appStatus === "live" ? "create_vnext_packet" : app.appStatus === "idea" ? "create_planning_issue" : "create_implementation_issue",
    sourceOfTruthFiles: [],
    linkedIssues: [],
    linkedPRs: [],
    blockers: [],
    evidenceLinks: [
      ...(app.liveUrl ? [{ label: "Live site", url: app.liveUrl }] : []),
      ...(app.repoUrl ? [{ label: "Repository", url: app.repoUrl }] : [])
    ],
    stateSource: "derived_state",
    sourceArtifact: {
      kind: "owner_registration",
      summary: "Registered by the owner from the portfolio dashboard (Add an app)."
    },
    lastUpdated: app.createdAt || generatedAt
  }));
}

// The owner's EXISTING ecosystem apps, imported into the portfolio so the one
// dashboard shows everything — apps built elsewhere (Emergent, other builders)
// included. Data source: the 2026-06-27 full-repo audit
// (.app-engine/state/app_portfolio_registry/ecosystem-portfolio-registry.json +
// source-of-truth/ecosystem-deployment-queue.md), with live URLs refreshed
// 2026-07-02 for the two apps that are already serving traffic. These are
// seeded imports; completing any of them runs through the normal intake ->
// prior-work-check (extend_existing) -> build loop, and its entry then picks up
// live state.
type ImportedAppRecord = {
  name: string;
  slug: string;
  status: string;
  productionUrl: string;
  deploymentState: AppPortfolioDeploymentState;
  buildState: AppPortfolioBuildState;
  nextSafeAction: AppPortfolioNextSafeAction;
  blockers: string[];
};

const IMPORTED_ECOSYSTEM_APPS: ImportedAppRecord[] = [
  {
    name: "ChurchConnect",
    slug: "churchconnect",
    status: "live — migration off Emergent finishing (compute on Vercel + Render; data move pending)",
    productionUrl: "https://www.churchconnect.cloud",
    deploymentState: "production_live",
    buildState: "ready_for_vnext",
    nextSafeAction: "create_vnext_packet",
    blockers: ["Data still on Emergent-managed Atlas; finish the gated migration before deep changes."]
  },
  {
    name: "Easy Peasy Website (EasyPeazy)",
    slug: "easy-peasy-website",
    status: "live — Codex building Spaceship domain search/buy/manage",
    productionUrl: "https://easypeazy.site",
    deploymentState: "production_live",
    buildState: "ready_for_vnext",
    nextSafeAction: "create_vnext_packet",
    blockers: ["Provider credentials and provisioning safety per Launch Pack before backend changes."]
  },
  {
    name: "Kindred Connections",
    slug: "kindred-connections",
    status: "mined as canonical Connection Engine source; app not relaunched",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["App-local Launch Pack missing; build not rerun in the audit pass."]
  },
  {
    name: "Best Life",
    slug: "best-life",
    status: "planned; growth-dashboard template identified (Kindred-derived)",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: []
  },
  {
    name: "Live On Mission",
    slug: "live-on-mission",
    status: "planned; connection + events templates identified",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: []
  },
  {
    name: "Kids Need Dads",
    slug: "kids-need-dads",
    status: "planned; mutual-aid + community templates identified",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: []
  },
  {
    name: "ChildFirst Solutions",
    slug: "childfirst-solutions",
    status: "source mined (case management + mediated communication); ready to build",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "ready_for_build",
    nextSafeAction: "create_implementation_issue",
    blockers: []
  },
  {
    name: "Snip.Show",
    slug: "snip-show",
    status: "canonical-source decision pending (Snip.Show vs emergent repo)",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Choose the canonical repo before any deploy."]
  },
  {
    name: "Toner Management",
    slug: "toner-management",
    status: "canonical-source decision pending across toner repos",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Canonical source not chosen across toner repos."]
  },
  {
    name: "Laser Engrave Market",
    slug: "laser-engrave-market",
    status: "source mined (marketplace + proof approval); ready to build",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "ready_for_build",
    nextSafeAction: "create_implementation_issue",
    blockers: ["Launch Pack and proof artifact contract missing."]
  },
  {
    name: "Iconium",
    slug: "iconium",
    status: "brand-kit generator source; database placement decision pending",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Prisma-vs-Supabase decision before deploy."]
  },
  {
    name: "Association",
    slug: "association",
    status: "decision: fold association-tier features into ChurchConnect (not a separate app)",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Queue verdict: merge unique association features into ChurchConnect rather than deploy separately."]
  },
  {
    name: "JeepFix",
    slug: "jeepfix",
    status: "decision: becomes a config of the shared troubleshooting engine",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Convert to config after the shared knowledge/troubleshooting engine exists."]
  },
  {
    name: "RacketPro",
    slug: "racketpro",
    status: "decision: becomes a sports config of the shared connection/growth engine",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Convert to config after the shared connection/growth engines are ready."]
  },
  {
    name: "Honestly",
    slug: "honestly",
    status: "decision: ChurchConnect module or standalone care/media app",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Standalone boundary unclear — decide module-vs-app before any build."]
  },
  {
    name: "Ideas / Idea Capture",
    slug: "ideas-idea-capture",
    status: "idea capture + content forge source mined",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: []
  }
];

function getImportedEcosystemPortfolioEntries(): AppPortfolioEntry[] {
  return IMPORTED_ECOSYSTEM_APPS.map((app) => ({
    name: app.name,
    slug: app.slug,
    type: "ecosystem_core",
    status: app.status,
    reviewUrl: app.productionUrl.startsWith("https://") ? app.productionUrl : "unknown",
    productionUrl: app.productionUrl,
    currentVersion: "imported-2026-07-02",
    deploymentState: app.deploymentState,
    buildState: app.buildState,
    nextSafeAction: app.nextSafeAction,
    sourceOfTruthFiles: ["source-of-truth/ecosystem-deployment-queue.md", "source-of-truth/module-catalog.md"],
    linkedIssues: [],
    linkedPRs: [],
    blockers: app.blockers,
    evidenceLinks: app.productionUrl.startsWith("https://")
      ? [{ label: "Live site", url: app.productionUrl }]
      : [],
    stateSource: "seeded_fallback",
    sourceArtifact: {
      kind: "ecosystem_portfolio_import",
      summary: "Imported from the 2026-06-27 ecosystem portfolio audit so every existing app is managed in one place."
    },
    lastUpdated: generatedAt
  }));
}

function getSeedPortfolioEntries(): AppPortfolioEntry[] {
  return [
    {
      name: "AppEngine Core",
      slug: "appengine-core",
      type: "appengine_core",
      status: "internal controlled use",
      reviewUrl: "/owner-control-center",
      productionUrl: "production blocked until owner-approved release gate",
      currentVersion: "controlled-use",
      deploymentState: "review_ready",
      buildState: "ready_for_vnext",
      nextSafeAction: "continue_internal_trial",
      sourceOfTruthFiles: [
        "source-of-truth/app-portfolio-registry.md",
        "source-of-truth/controlled-production-release-gate.md",
        "source-of-truth/internal-controlled-use-runbook.md"
      ],
      linkedIssues: [],
      linkedPRs: [
        {
          number: 130,
          title: "Internal controlled state adapter",
          url: "https://github.com/lincolnnunnally/AppEngine/pull/130",
          state: "merged",
          branch: "main"
        }
      ],
      blockers: ["Production launch still requires explicit owner approval and durable provider activation."],
      evidenceLinks: [{ label: "Owner Control Center", url: "/owner-control-center" }],
      stateSource: "seeded_fallback",
      sourceArtifact: {
        kind: "app_portfolio_registry_seed",
        summary: "Seeded AppEngine Core entry used until project memory or orchestrator queue state exists."
      },
      lastUpdated: generatedAt
    },
    {
      name: "Opportunity",
      slug: "opportunity",
      type: "opportunity_front_door",
      status: "guided intake and routing active",
      reviewUrl: "/opportunity-intake",
      productionUrl: "production blocked until owner-approved release gate",
      currentVersion: "foundation",
      deploymentState: "review_ready",
      buildState: "preview_verified",
      nextSafeAction: "await_owner_review",
      sourceOfTruthFiles: [
        "source-of-truth/opportunity-intake-foundation.md",
        "source-of-truth/opportunity-clarification-engine.md",
        "source-of-truth/opportunity-solution-path-router.md",
        "source-of-truth/opportunity-action-plan-draft.md",
        "source-of-truth/opportunity-appengine-candidate-bridge.md"
      ],
      linkedIssues: [],
      linkedPRs: [
        {
          number: 138,
          title: "Opportunity to AppEngine candidate bridge",
          url: "https://github.com/lincolnnunnally/AppEngine/pull/138",
          state: "merged",
          branch: "main"
        }
      ],
      blockers: ["No public production URL yet; remains inside AppEngine controlled-use flow."],
      evidenceLinks: [{ label: "Opportunity Intake", url: "/opportunity-intake" }],
      stateSource: "seeded_fallback",
      sourceArtifact: {
        kind: "app_portfolio_registry_seed",
        summary: "Seeded Opportunity entry used until opportunity intake or routing records exist."
      },
      buildPacketBridgeVisibility: {
        candidateState: "no opportunity candidate created yet",
        buildPacketBridgeState: "packet bridge not prepared yet",
        recommendedPacketDraftType: "not selected yet",
        ownerApprovalStatus: "owner review required before packet bridge",
        missingInformation: ["Submit or select an Opportunity candidate before packet draft routing."],
        nextSafeAppEngineAction: "Use Opportunity intake and candidate bridge before preparing a packet draft.",
        sourceArtifactEvidence: [
          {
            kind: "app_portfolio_registry_seed",
            summary: "Seeded Opportunity entry; no live opportunity_build_packet_bridge state exists."
          }
        ]
      },
      lastUpdated: generatedAt
    },
    {
      name: "Life Produces Life Core",
      slug: "life-core",
      type: "ecosystem_core",
      status: "foundation preview merged",
      reviewUrl: "/life-core",
      productionUrl: "production blocked until owner-approved release gate",
      currentVersion: "mvp-foundation",
      deploymentState: "review_ready",
      buildState: "preview_verified",
      nextSafeAction: "await_owner_review",
      sourceOfTruthFiles: [
        "source-of-truth/01-ecosystem-philosophy.md",
        "source-of-truth/03-life-produces-life.md",
        "source-of-truth/app-portfolio-registry.md"
      ],
      linkedIssues: [],
      linkedPRs: [
        {
          number: 145,
          title: "Life Produces Life Core MVP Foundation Slice",
          url: "https://github.com/lincolnnunnally/AppEngine/pull/145",
          state: "merged",
          branch: "codex/builder-27661620756-1"
        }
      ],
      blockers: ["Needs stable public review URL before owner should have to leave AppEngine to inspect it."],
      evidenceLinks: [{ label: "Life Core Preview", url: "/life-core" }],
      stateSource: "seeded_fallback",
      sourceArtifact: {
        kind: "life_core_overview",
        summary: "Seeded Life Core overview used until adapter-backed Life Core state exists."
      },
      lastUpdated: generatedAt
    },
    {
      name: "Spark of Hope Slices",
      slug: "spark-of-hope-intake-lite",
      type: "app_slice",
      status: "safe preview slices available",
      reviewUrl: "/spark-of-hope-intake-lite",
      productionUrl: "production blocked until owner-approved release gate",
      currentVersion: "vNext preview slices",
      deploymentState: "review_ready",
      buildState: "ready_for_vnext",
      nextSafeAction: "run_review_gates",
      sourceOfTruthFiles: [
        "source-of-truth/app-portfolio-registry.md",
        "source-of-truth/super-admin-registry.md"
      ],
      linkedIssues: [
        {
          number: 63,
          title: "Spark of Hope Intake Lite vNext 1",
          url: "https://github.com/lincolnnunnally/AppEngine/issues/63"
        }
      ],
      linkedPRs: [
        {
          number: 74,
          title: "Spark of Hope Intake Lite vNext 1: Controlled Preview Persistence",
          url: "https://github.com/lincolnnunnally/AppEngine/pull/74",
          state: "merged",
          branch: "main"
        }
      ],
      blockers: ["Real persistence, public trial approval, and production launch remain blocked by review gates."],
      evidenceLinks: [{ label: "Spark Intake Lite", url: "/spark-of-hope-intake-lite" }],
      stateSource: "seeded_fallback",
      sourceArtifact: {
        kind: "app_portfolio_registry_seed",
        summary: "Seeded Spark entry used with runtime capability checks until durable review state is available."
      },
      lastUpdated: generatedAt
    },
    {
      name: "Future Ecosystem Apps and Services",
      slug: "future-ecosystem-apps-services",
      type: "future_ecosystem_service",
      status: "planned placeholders",
      reviewUrl: "unknown",
      productionUrl: "not live",
      currentVersion: "not started",
      deploymentState: "unknown",
      buildState: "planned",
      nextSafeAction: "create_planning_issue",
      sourceOfTruthFiles: [
        "source-of-truth/app-purpose-rules.md",
        "source-of-truth/app-portfolio-registry.md",
        "source-of-truth/opportunity-intake-foundation.md"
      ],
      linkedIssues: [],
      linkedPRs: [],
      blockers: ["Each future app or service needs an approved intake, candidate review, packet, and owner-approved phase path."],
      evidenceLinks: [],
      stateSource: "seeded_fallback",
      sourceArtifact: {
        kind: "app_portfolio_registry_seed",
        summary: "Seeded future ecosystem placeholder used until intake/candidate records exist."
      },
      lastUpdated: generatedAt
    }
  ];
}

async function readRawLifeCoreStore() {
  return getAppEngineStateAdapter().readJson<{ schemaVersion: 1 } | null>({ kind: "life_core" }, null);
}

function buildOpportunityBridgeVisibility(state: {
  latestBridge: Awaited<ReturnType<typeof listOpportunityBuildPacketBridges>>[number] | null;
  latestCandidate: Awaited<ReturnType<typeof listOpportunityAppEngineCandidates>>[number] | null;
  latestPlan: Awaited<ReturnType<typeof listOpportunityActionPlans>>[number] | null;
  latestPath: Awaited<ReturnType<typeof listOpportunitySolutionPaths>>[number] | null;
  latestIntake: Awaited<ReturnType<typeof listOpportunityIntakeRecords>>[number] | null;
}): AppPortfolioBuildPacketBridgeVisibility {
  const evidence = [
    state.latestBridge
      ? {
          kind: "opportunity_build_packet_bridge",
          id: state.latestBridge.id,
          summary: state.latestBridge.title
        }
      : null,
    state.latestCandidate
      ? {
          kind: "opportunity_appengine_candidate",
          id: state.latestCandidate.id,
          summary: state.latestCandidate.title
        }
      : null,
    state.latestPlan
      ? {
          kind: "opportunity_action_plan",
          id: state.latestPlan.id,
          summary: state.latestPlan.title
        }
      : null,
    state.latestPath
      ? {
          kind: "opportunity_solution_path",
          id: state.latestPath.id,
          summary: state.latestPath.title
        }
      : null,
    state.latestIntake
      ? {
          kind: "opportunity_intake",
          id: state.latestIntake.id,
          summary: state.latestIntake.title
        }
      : null
  ].filter(Boolean) as AppPortfolioSourceArtifact[];

  if (state.latestBridge) {
    return {
      candidateState: `${state.latestBridge.sourceCandidate.candidateType.replaceAll("_", " ")} approved for packet draft`,
      buildPacketBridgeState: state.latestBridge.status.replaceAll("_", " "),
      recommendedPacketDraftType: state.latestBridge.packetType,
      ownerApprovalStatus: state.latestBridge.ownerApprovalStatus.replaceAll("_", " "),
      missingInformation: state.latestBridge.missingInformation,
      nextSafeAppEngineAction: state.latestBridge.nextSafeAction.replaceAll("_", " "),
      sourceArtifactEvidence: evidence
    };
  }

  if (state.latestCandidate) {
    const missingInformation = uniqueStrings([
      ...state.latestCandidate.missingOwnerDecisions,
      ...state.latestCandidate.risksBlockers,
      "Owner approval is required before candidate_packet_bridge or packet draft preparation."
    ]);

    return {
      candidateState: `${state.latestCandidate.candidateType.replaceAll("_", " ")} exists`,
      buildPacketBridgeState: "candidate exists, packet bridge not prepared yet",
      recommendedPacketDraftType: state.latestCandidate.recommendedArtifactToCreateNext,
      ownerApprovalStatus: "owner approval required before packet bridge",
      missingInformation,
      nextSafeAppEngineAction: state.latestCandidate.copyableNextAppEnginePrompt,
      sourceArtifactEvidence: evidence
    };
  }

  if (state.latestPlan) {
    return {
      candidateState: "action plan exists, AppEngine candidate not created yet",
      buildPacketBridgeState: "packet bridge not prepared yet",
      recommendedPacketDraftType: state.latestPlan.planType,
      ownerApprovalStatus: "owner review required before candidate creation",
      missingInformation: uniqueStrings([
        ...state.latestPlan.ownerMustClarify,
        ...state.latestPlan.risksBlockers,
        "Create or approve an Opportunity AppEngine candidate before packet bridge visibility can advance."
      ]),
      nextSafeAppEngineAction: state.latestPlan.nextReviewPrompt,
      sourceArtifactEvidence: evidence
    };
  }

  return {
    candidateState: state.latestPath ? "solution path exists, action plan not drafted yet" : "intake exists, candidate not created yet",
    buildPacketBridgeState: "packet bridge not prepared yet",
    recommendedPacketDraftType: "not selected yet",
    ownerApprovalStatus: "owner review required before packet bridge",
    missingInformation: ["Opportunity must reach action plan and AppEngine candidate before packet draft routing."],
    nextSafeAppEngineAction: "Continue Opportunity clarification, solution path, action plan, and candidate review before packet bridge work.",
    sourceArtifactEvidence: evidence
  };
}

function normalizeNextSafeAction(value: string, fallback: AppPortfolioNextSafeAction): AppPortfolioNextSafeAction {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const allowed: AppPortfolioNextSafeAction[] = [
    "create_planning_issue",
    "create_implementation_issue",
    "create_draft_pr",
    "wait_for_preview",
    "verify_preview",
    "verify_review_url",
    "run_review_gates",
    "create_fix_issue",
    "await_owner_review",
    "stop_for_owner_approval",
    "pause_for_budget",
    "request_budget_approval",
    "prepare_release_gate",
    "create_vnext_packet",
    "continue_internal_trial",
    "review_exported_builder_handoff",
    "unknown"
  ];

  return allowed.includes(normalized as AppPortfolioNextSafeAction)
    ? (normalized as AppPortfolioNextSafeAction)
    : fallback;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isUnknownUrl(value: string) {
  return !value || ["unknown", "not live"].includes(value.toLowerCase());
}
