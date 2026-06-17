import { randomUUID } from "node:crypto";
import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import {
  listFirstEcosystemBuildPacketDrafts,
  type FirstEcosystemBuildPacketDraftRecord
} from "@/lib/engine/first-ecosystem-build-packet-draft";
import {
  listFirstRealEcosystemBuildRequests,
  type FirstRealEcosystemBuildRequestRecord
} from "@/lib/engine/first-real-ecosystem-build-request";
import {
  listHandoffRelaySummaries,
  savePreparedHandoffFromBuildExecutionExport,
  type HandoffRelaySummary
} from "@/lib/engine/handoff-relay";
import {
  updateProjectMemoryFromBuildLoopCompletion,
  updateProjectMemoryFromBuildExecutionRequest,
  updateProjectMemoryFromBuildExecutionRequestExport,
  updateProjectMemoryFromBuilderResultIntake
} from "@/lib/engine/project-memory";

export type BuildExecutionRequestStatus =
  | "draft"
  | "owner_approved"
  | "ready_for_builder"
  | "builder_running_external"
  | "result_received"
  | "verification_needed"
  | "completed"
  | "blocked";

export type BuildExecutionOwnerApprovalStatus = "owner_review_required" | "owner_approved" | "rejected";
export type BuildExecutionRequestReviewStatus = "needs_review" | "owner_approved" | "blocked" | "exported_for_builder";
export type BuildExecutionBuilderResultStatus = "passed" | "failed" | "needs_verification";
export type BuildLoopStepStatus = "not_started" | "ready" | "in_progress" | "blocked" | "completed";

export type BuildExecutionHandoffSourceKind =
  | "handoff_inbox"
  | "opportunity_ready_appengine_handoff"
  | "first_ecosystem_build_request_handoff"
  | "first_ecosystem_build_packet_draft";

export type BuildExecutionPacketDraftSource = {
  id: string;
  kind: FirstEcosystemBuildPacketDraftRecord["kind"];
  title: string;
  status: FirstEcosystemBuildPacketDraftRecord["status"];
  ownerReadableSummary: string;
  nextSafeAction: FirstEcosystemBuildPacketDraftRecord["nextSafeAction"];
  designIntent: FirstEcosystemBuildPacketDraftRecord["designIntent"] | null;
};

export type BuildExecutionBuilderHandoffExport = {
  kind: "build_execution_builder_handoff_export";
  schemaVersion: 1;
  id: string;
  createdAt: string;
  requestId: string;
  sourceHandoffId: string;
  sourceOpportunityOrEcosystemRequest: string;
  sourcePacketDraft: BuildExecutionPacketDraftSource | null;
  targetProjectSlice: string;
  requestedBuildWork: string;
  designIntent: FirstEcosystemBuildPacketDraftRecord["designIntent"] | ReturnType<typeof defaultDesignIntent>;
  guardrails: string[];
  verificationCommands: string[];
  expectedResult: string;
  exactBuilderPrompt: string;
  handoffInboxId: string | null;
  execution: {
    codexTriggered: false;
    githubIssuesCreated: false;
    labelsApplied: false;
    productionDeployed: false;
    paidResourcesCreated: false;
    migrationsApplied: false;
    secretsOrEnvChanged: false;
    repositoryVisibilityChanged: false;
  };
};

export type BuildExecutionBuilderResultIntake = {
  id: string;
  kind: "builder_result_intake";
  schemaVersion: 1;
  createdAt: string;
  rawResult: string;
  prNumber: number | null;
  branch: string | null;
  changedFiles: string[];
  verificationCommandsRun: string[];
  passFailStatus: BuildExecutionBuilderResultStatus;
  blockers: string[];
  reviewUrl: string | null;
  nextSafeAction: string;
  followUpPrompt: string | null;
  ownerReadableSummary: string;
  guardrails: {
    noAutoMerge: true;
    noCodexAutoExecution: true;
    noGitHubIssueCreation: true;
    noLabelChanges: true;
    noProductionDeploy: true;
    noPaidResources: true;
    noLiveMigrations: true;
    noSecretsOrEnvChanges: true;
    repositoryVisibilityUnchanged: true;
  };
};

export type BuildLoopCompletionStepId =
  | "source_request"
  | "packet_draft"
  | "build_execution_request"
  | "exported_builder_handoff"
  | "builder_result_received"
  | "verification_status"
  | "portfolio_update"
  | "next_safe_action";

export type BuildLoopCompletionStep = {
  id: BuildLoopCompletionStepId;
  label: string;
  status: BuildLoopStepStatus;
  summary: string;
  evidence: string[];
  blockers: string[];
  missingInformation: string[];
};

export type BuildLoopCompletionDashboard = {
  kind: "build_loop_completion_dashboard";
  schemaVersion: 1;
  generatedAt: string;
  requestId: string | null;
  targetProjectSlice: string;
  sourceProblemOrOpportunity: string;
  packetDraftTitle: string | null;
  buildExecutionStatus: BuildExecutionRequestStatus | "not_started";
  verificationStatus: BuildExecutionBuilderResultStatus | "not_started";
  reviewUrl: string | null;
  steps: BuildLoopCompletionStep[];
  blockers: string[];
  missingInformation: string[];
  nextSafeAction: string;
  copyableNextActionPrompt: string | null;
  ownerReadableSummary: string;
  guardrails: {
    derivedFromExistingStateOnly: true;
    noParallelTracker: true;
    noAutoMerge: true;
    noCodexAutoExecution: true;
    noGitHubIssueCreation: true;
    noLabelChanges: true;
    noProductionDeploy: true;
    noPaidResources: true;
    noLiveMigrations: true;
    noSecretsOrEnvChanges: true;
    repositoryVisibilityUnchanged: true;
  };
};

export type BuildExecutionHandoffSource = {
  id: string;
  sourceHandoffId: string;
  sourceKind: BuildExecutionHandoffSourceKind;
  title: string;
  receivedAt: string;
  targetProjectSlice: string;
  requestedWork: string;
  guardrails: string[];
  verificationCommands: string[];
  expectedResult: string;
  ownerReadableSummary: string;
  sourcePacketDraft: BuildExecutionPacketDraftSource | null;
};

export type BuildExecutionRequestRecord = {
  id: string;
  kind: "build_execution_request";
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  sourceHandoff: {
    id: string;
    sourceKind: BuildExecutionHandoffSourceKind;
    title: string;
    receivedAt: string;
  };
  sourcePacketDraft: BuildExecutionPacketDraftSource | null;
  targetProjectSlice: string;
  requestedWork: string;
  guardrails: string[];
  verificationCommands: string[];
  expectedResult: string;
  ownerApprovalStatus: BuildExecutionOwnerApprovalStatus;
  executionStatus: BuildExecutionRequestStatus;
  reviewStatus: BuildExecutionRequestReviewStatus;
  exportedBuilderHandoffId: string | null;
  exportedBuilderHandoff: BuildExecutionBuilderHandoffExport | null;
  latestBuilderResult: BuildExecutionBuilderResultIntake | null;
  builderResults: BuildExecutionBuilderResultIntake[];
  statusHistory: {
    status: BuildExecutionRequestStatus;
    at: string;
    note: string;
  }[];
  ownerReadableSummary: string;
  nextSafeAction: "owner_review_build_execution_request";
  artifact: {
    kind: "build_execution_request";
    schemaVersion: 1;
    sourceHandoffId: string;
    sourcePacketDraftId: string | null;
    executionStatus: BuildExecutionRequestStatus;
    ownerApprovalStatus: BuildExecutionOwnerApprovalStatus;
    reviewStatus: BuildExecutionRequestReviewStatus;
    builderHandoffExported: boolean;
    builderHandoffId: string | null;
    latestBuilderResultId: string | null;
    builderResultReceived: boolean;
    codexTriggered: false;
    githubIssuesCreated: false;
    labelsApplied: false;
    productionDeployed: false;
  };
  guardrailState: ReturnType<typeof buildExecutionRequestGuardrails>;
};

type BuildExecutionRequestStore = {
  schemaVersion: 1;
  records: BuildExecutionRequestRecord[];
};

export function buildExecutionRequestGuardrails() {
  return {
    ...durableStateGuardrails(),
    draftConnectorOnly: true,
    ownerApprovalRequired: true,
    reviewAndExportOwnerControlled: true,
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

export async function listBuildExecutionRequests() {
  const store = await readBuildExecutionRequestStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function loadBuildLoopCompletionDashboard(now = new Date()) {
  const requests = await listBuildExecutionRequests();
  return createBuildLoopCompletionDashboard(requests[0] || null, now);
}

export function createBuildLoopCompletionDashboard(
  request: BuildExecutionRequestRecord | null,
  now = new Date()
): BuildLoopCompletionDashboard {
  const generatedAt = now.toISOString();

  if (!request) {
    const steps: BuildLoopCompletionStep[] = [
      buildLoopStep(
        "source_request",
        "Source problem or opportunity",
        "not_started",
        "No build execution request exists yet.",
        [],
        [],
        ["Prepared handoff or packet draft"]
      ),
      buildLoopStep("packet_draft", "Packet draft", "not_started", "No packet draft is attached yet.", [], [], ["Packet draft"]),
      buildLoopStep(
        "build_execution_request",
        "Build execution request",
        "not_started",
        "No build execution request has been created.",
        [],
        [],
        ["Build execution request"]
      ),
      buildLoopStep(
        "exported_builder_handoff",
        "Exported builder handoff",
        "not_started",
        "No owner-approved builder handoff has been exported.",
        [],
        [],
        ["Owner-approved builder handoff"]
      ),
      buildLoopStep(
        "builder_result_received",
        "Builder result received",
        "not_started",
        "No builder result has been imported.",
        [],
        [],
        ["Builder/Codex result"]
      ),
      buildLoopStep(
        "verification_status",
        "Verification status",
        "not_started",
        "Verification cannot begin until a builder result is imported.",
        [],
        [],
        ["Builder result verification"]
      ),
      buildLoopStep(
        "portfolio_update",
        "Portfolio update",
        "not_started",
        "Portfolio state will update after build execution state exists.",
        [],
        [],
        ["Build execution state"]
      ),
      buildLoopStep(
        "next_safe_action",
        "Next safe action",
        "ready",
        "Prepare a handoff or packet draft, then create a build execution request.",
        [],
        [],
        []
      )
    ];

    return {
      kind: "build_loop_completion_dashboard",
      schemaVersion: 1,
      generatedAt,
      requestId: null,
      targetProjectSlice: "No active build loop",
      sourceProblemOrOpportunity: "No build execution request has been created yet.",
      packetDraftTitle: null,
      buildExecutionStatus: "not_started",
      verificationStatus: "not_started",
      reviewUrl: null,
      steps,
      blockers: [],
      missingInformation: uniqueValues(steps.flatMap((step) => step.missingInformation)),
      nextSafeAction: "Prepare a handoff or packet draft, then create a build execution request.",
      copyableNextActionPrompt:
        "Prepare an AppEngine handoff or packet draft, then create a build execution request from the Owner Control Center. Do not trigger Codex automatically.",
      ownerReadableSummary: "No build loop is active yet. AppEngine is waiting for a prepared handoff or packet draft.",
      guardrails: buildLoopCompletionGuardrails()
    };
  }

  const latestResult = request.latestBuilderResult;
  const steps: BuildLoopCompletionStep[] = [
    buildLoopStep(
      "source_request",
      "Source problem or opportunity",
      "completed",
      request.sourceHandoff.title,
      [request.sourceHandoff.id, request.sourceHandoff.sourceKind],
      [],
      []
    ),
    buildLoopStep(
      "packet_draft",
      "Packet draft",
      request.sourcePacketDraft ? "completed" : "blocked",
      request.sourcePacketDraft
        ? `${request.sourcePacketDraft.title} is attached to this build loop.`
        : "No packet draft is attached to this build loop.",
      request.sourcePacketDraft ? [request.sourcePacketDraft.id, request.sourcePacketDraft.status] : [],
      [],
      request.sourcePacketDraft ? [] : ["Packet draft"]
    ),
    buildLoopStep(
      "build_execution_request",
      "Build execution request",
      request.executionStatus === "draft" ? "ready" : "completed",
      request.ownerReadableSummary,
      [request.id, request.executionStatus],
      [],
      []
    ),
    buildLoopStep(
      "exported_builder_handoff",
      "Exported builder handoff",
      request.exportedBuilderHandoffId ? "completed" : request.reviewStatus === "blocked" ? "blocked" : "ready",
      request.exportedBuilderHandoffId
        ? `Builder handoff exported to Handoff Inbox as ${request.exportedBuilderHandoffId}.`
        : "Builder handoff is not exported yet.",
      request.exportedBuilderHandoffId ? [request.exportedBuilderHandoffId] : [],
      request.reviewStatus === "blocked" ? ["Owner blocked the build execution request."] : [],
      request.exportedBuilderHandoffId ? [] : ["Owner-approved exported builder handoff"]
    ),
    buildLoopStep(
      "builder_result_received",
      "Builder result received",
      latestResult ? "completed" : request.exportedBuilderHandoffId ? "ready" : "not_started",
      latestResult ? latestResult.ownerReadableSummary : "No builder result has been imported yet.",
      latestResult ? [latestResult.id, latestResult.prNumber ? `PR #${latestResult.prNumber}` : latestResult.branch || "builder result"] : [],
      [],
      latestResult ? [] : ["Builder result handoff"]
    ),
    buildLoopStep(
      "verification_status",
      "Verification status",
      verificationStepStatus(request, latestResult),
      latestResult
        ? `${latestResult.passFailStatus.replaceAll("_", " ")}. ${latestResult.nextSafeAction}`
        : "Verification is waiting on a builder result.",
      latestResult ? latestResult.verificationCommandsRun : [],
      latestResult?.blockers || [],
      latestResult ? [] : ["Verification evidence"]
    ),
    buildLoopStep(
      "portfolio_update",
      "Portfolio update",
      request.executionStatus === "completed" || request.executionStatus === "blocked" || latestResult ? "completed" : "ready",
      latestResult
        ? "Portfolio Dashboard can derive status from this build execution request and latest builder result."
        : "Portfolio Dashboard can show this build execution request while result evidence is pending.",
      ["app_portfolio_registry", request.id],
      [],
      []
    ),
    buildLoopStep(
      "next_safe_action",
      "Next safe action",
      request.executionStatus === "blocked" ? "blocked" : request.executionStatus === "completed" ? "completed" : "ready",
      determineBuildLoopNextSafeAction(request),
      [],
      request.executionStatus === "blocked" ? latestResult?.blockers || ["Build loop is blocked."] : [],
      []
    )
  ];

  const blockers = uniqueValues(steps.flatMap((step) => step.blockers));
  const missingInformation = uniqueValues(steps.flatMap((step) => step.missingInformation));
  const nextSafeAction = determineBuildLoopNextSafeAction(request);

  return {
    kind: "build_loop_completion_dashboard",
    schemaVersion: 1,
    generatedAt,
    requestId: request.id,
    targetProjectSlice: request.targetProjectSlice,
    sourceProblemOrOpportunity: request.sourceHandoff.title,
    packetDraftTitle: request.sourcePacketDraft?.title || null,
    buildExecutionStatus: request.executionStatus,
    verificationStatus: latestResult?.passFailStatus || "not_started",
    reviewUrl: latestResult?.reviewUrl || null,
    steps,
    blockers,
    missingInformation,
    nextSafeAction,
    copyableNextActionPrompt: buildLoopCopyableNextActionPrompt(request, blockers, missingInformation),
    ownerReadableSummary: `Build loop for ${request.targetProjectSlice}: ${request.executionStatus.replaceAll("_", " ")}. ${nextSafeAction}`,
    guardrails: buildLoopCompletionGuardrails()
  };
}

export async function listBuildExecutionHandoffSources() {
  const [handoffs, firstBuildRequests, firstPacketDrafts] = await Promise.all([
    listHandoffRelaySummaries(),
    listFirstRealEcosystemBuildRequests(),
    listFirstEcosystemBuildPacketDrafts()
  ]);
  const firstBuildRequestByHandoffId = new Map(firstBuildRequests.map((request) => [request.preparedHandoff.id, request]));
  const firstPacketDraftByHandoffId = new Map<string, FirstEcosystemBuildPacketDraftRecord>();
  for (const draft of firstPacketDrafts) {
    if (!firstPacketDraftByHandoffId.has(draft.sourcePreparedHandoffId)) {
      firstPacketDraftByHandoffId.set(draft.sourcePreparedHandoffId, draft);
    }
  }
  const handoffSources = handoffs.map((handoff) =>
    buildSourceFromHandoff(
      handoff,
      firstBuildRequestByHandoffId.get(handoff.id) || null,
      firstPacketDraftByHandoffId.get(handoff.id) || null
    )
  );
  const syntheticFirstBuildSources = firstBuildRequests
    .filter((request) => !handoffs.some((handoff) => handoff.id === request.preparedHandoff.id))
    .map((request) => buildSourceFromFirstBuildRequest(request, firstPacketDraftByHandoffId.get(request.preparedHandoff.id) || null));
  const syntheticPacketDraftSources = firstPacketDrafts
    .filter((draft) => !handoffs.some((handoff) => handoff.id === draft.sourcePreparedHandoffId))
    .filter((draft) => !firstBuildRequests.some((request) => request.preparedHandoff.id === draft.sourcePreparedHandoffId))
    .map(buildSourceFromPacketDraft);

  return uniqueSources([...handoffSources, ...syntheticFirstBuildSources, ...syntheticPacketDraftSources]).sort((a, b) =>
    b.receivedAt.localeCompare(a.receivedAt)
  );
}

export async function createBuildExecutionRequest(input: { sourceId?: unknown } = {}, now = new Date()) {
  const sources = await listBuildExecutionHandoffSources();
  const sourceId = typeof input.sourceId === "string" ? input.sourceId.trim() : "";
  const source = sourceId ? sources.find((candidate) => candidate.id === sourceId || candidate.sourceHandoffId === sourceId) : sources[0];

  if (!source) {
    throw new Error("Prepare a handoff before creating a build execution request.");
  }

  const createdAt = now.toISOString();
  const record: BuildExecutionRequestRecord = {
    id: `build_execution_${randomUUID()}`,
    kind: "build_execution_request",
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
    sourceHandoff: {
      id: source.sourceHandoffId,
      sourceKind: source.sourceKind,
      title: source.title,
      receivedAt: source.receivedAt
    },
    sourcePacketDraft: source.sourcePacketDraft,
    targetProjectSlice: source.targetProjectSlice,
    requestedWork: source.requestedWork,
    guardrails: source.guardrails,
    verificationCommands: source.verificationCommands,
    expectedResult: source.expectedResult,
    ownerApprovalStatus: "owner_review_required",
    executionStatus: "draft",
    reviewStatus: "needs_review",
    exportedBuilderHandoffId: null,
    exportedBuilderHandoff: null,
    latestBuilderResult: null,
    builderResults: [],
    statusHistory: [
      {
        status: "draft",
        at: createdAt,
        note: "Build execution request drafted from prepared handoff. Codex is not triggered automatically."
      }
    ],
    ownerReadableSummary: `Build execution request drafted for ${source.targetProjectSlice}. It is waiting for owner review before any builder execution.`,
    nextSafeAction: "owner_review_build_execution_request",
    artifact: {
      kind: "build_execution_request",
      schemaVersion: 1,
      sourceHandoffId: source.sourceHandoffId,
      sourcePacketDraftId: source.sourcePacketDraft?.id || null,
      executionStatus: "draft",
      ownerApprovalStatus: "owner_review_required",
      reviewStatus: "needs_review",
      builderHandoffExported: false,
      builderHandoffId: null,
      latestBuilderResultId: null,
      builderResultReceived: false,
      codexTriggered: false,
      githubIssuesCreated: false,
      labelsApplied: false,
      productionDeployed: false
    },
    guardrailState: buildExecutionRequestGuardrails()
  };
  const store = await readBuildExecutionRequestStore();

  await writeBuildExecutionRequestStore({
    schemaVersion: 1,
    records: [record, ...store.records.filter((item) => item.sourceHandoff.id !== record.sourceHandoff.id)].slice(0, 50)
  });
  await updateProjectMemoryFromBuildExecutionRequest(record);
  await getAppEngineAuditTrail().append({
    type: "build_execution_request_created",
    actor: { type: "owner", id: "Lincoln" },
    summary: record.ownerReadableSummary,
    subjectId: record.id,
    metadata: {
      sourceHandoffId: record.sourceHandoff.id,
      sourcePacketDraftId: record.sourcePacketDraft?.id || null,
      targetProjectSlice: record.targetProjectSlice,
      ownerApprovalStatus: record.ownerApprovalStatus,
      executionStatus: record.executionStatus,
      codexTriggered: false,
      githubIssuesCreated: false,
      labelsApplied: false,
      productionDeployed: false
    }
  });

  return record;
}

export async function reviewBuildExecutionRequest(
  input: { requestId?: unknown; reviewStatus?: unknown; note?: unknown } = {},
  now = new Date()
) {
  const requestId = typeof input.requestId === "string" ? input.requestId.trim() : "";
  const reviewStatus = parseReviewStatus(input.reviewStatus);
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 600) : "";

  if (!requestId) {
    throw new Error("Choose a build execution request to review.");
  }

  if (!reviewStatus) {
    throw new Error("Choose a valid build execution review status.");
  }

  const store = await readBuildExecutionRequestStore();
  const index = store.records.findIndex((record) => record.id === requestId);

  if (index === -1) {
    throw new Error("Build execution request not found.");
  }

  const existing = store.records[index];

  if (reviewStatus === "blocked") {
    const reviewedAt = now.toISOString();
    const blocked = {
      ...existing,
      updatedAt: reviewedAt,
      ownerApprovalStatus: "rejected" as const,
      executionStatus: "blocked" as const,
      reviewStatus: "blocked" as const,
      ownerReadableSummary: `Build execution request for ${existing.targetProjectSlice} is blocked pending owner review.`,
      statusHistory: [
        {
          status: "blocked" as const,
          at: reviewedAt,
          note: note || "Owner marked this build execution request blocked. No builder handoff was exported."
        },
        ...existing.statusHistory
      ],
      artifact: {
        ...existing.artifact,
        executionStatus: "blocked" as const,
        ownerApprovalStatus: "rejected" as const,
        reviewStatus: "blocked" as const
      }
    } satisfies BuildExecutionRequestRecord;

    store.records[index] = blocked;
    await writeBuildExecutionRequestStore(store);
    await updateProjectMemoryFromBuildExecutionRequest(blocked);
    await getAppEngineAuditTrail().append({
      type: "build_execution_request_reviewed",
      actor: { type: "owner", id: "Lincoln" },
      summary: blocked.ownerReadableSummary,
      subjectId: blocked.id,
      metadata: {
        reviewStatus: blocked.reviewStatus,
        executionStatus: blocked.executionStatus,
        codexTriggered: false,
        githubIssuesCreated: false,
        labelsApplied: false,
        productionDeployed: false
      }
    });

    return { record: blocked, handoff: null, exportOutput: null };
  }

  if (reviewStatus === "needs_review") {
    const reviewedAt = now.toISOString();
    const reviewed = {
      ...existing,
      updatedAt: reviewedAt,
      reviewStatus: "needs_review" as const,
      ownerReadableSummary: `Build execution request for ${existing.targetProjectSlice} still needs owner review.`,
      statusHistory: [
        {
          status: existing.executionStatus,
          at: reviewedAt,
          note: note || "Owner kept this build execution request in review."
        },
        ...existing.statusHistory
      ],
      artifact: {
        ...existing.artifact,
        reviewStatus: "needs_review" as const
      }
    } satisfies BuildExecutionRequestRecord;

    store.records[index] = reviewed;
    await writeBuildExecutionRequestStore(store);
    return { record: reviewed, handoff: null, exportOutput: null };
  }

  const exportOutput = createBuilderHandoffExport(existing, now);
  const handoff = await savePreparedHandoffFromBuildExecutionExport(exportOutput, now);
  const exportedAt = now.toISOString();
  const exported = {
    ...existing,
    updatedAt: exportedAt,
    ownerApprovalStatus: "owner_approved" as const,
    executionStatus: "ready_for_builder" as const,
    reviewStatus: "exported_for_builder" as const,
    exportedBuilderHandoffId: handoff.id,
    exportedBuilderHandoff: {
      ...exportOutput,
      handoffInboxId: handoff.id
    },
    statusHistory: [
      {
        status: "ready_for_builder" as const,
        at: exportedAt,
        note:
          note ||
          `Owner approved this request and exported builder handoff ${handoff.id}. Codex was not triggered automatically.`
      },
      {
        status: "owner_approved" as const,
        at: exportedAt,
        note: "Owner approved this build execution request for manual builder handoff export."
      },
      ...existing.statusHistory
    ],
    ownerReadableSummary: `Build execution request for ${existing.targetProjectSlice} is owner-approved and exported to the Handoff Inbox as ${handoff.id}.`,
    artifact: {
      ...existing.artifact,
      executionStatus: "ready_for_builder" as const,
      ownerApprovalStatus: "owner_approved" as const,
      reviewStatus: "exported_for_builder" as const,
      builderHandoffExported: true,
      builderHandoffId: handoff.id
    }
  } satisfies BuildExecutionRequestRecord;

  store.records[index] = exported;
  await writeBuildExecutionRequestStore(store);
  await updateProjectMemoryFromBuildExecutionRequestExport(exported, exported.exportedBuilderHandoff);
  await getAppEngineAuditTrail().append({
    type: "build_execution_request_exported",
    actor: { type: "owner", id: "Lincoln" },
    summary: exported.ownerReadableSummary,
    subjectId: exported.id,
    metadata: {
      sourceHandoffId: exported.sourceHandoff.id,
      sourcePacketDraftId: exported.sourcePacketDraft?.id || null,
      exportedHandoffId: handoff.id,
      reviewStatus: exported.reviewStatus,
      executionStatus: exported.executionStatus,
      codexTriggered: false,
      githubIssuesCreated: false,
      labelsApplied: false,
      productionDeployed: false,
      paidResourcesCreated: false,
      migrationsApplied: false,
      secretsOrEnvChanged: false,
      repositoryVisibilityChanged: false
    }
  });

  return { record: exported, handoff, exportOutput: exported.exportedBuilderHandoff };
}

export async function intakeBuilderResult(
  input: { requestId?: unknown; resultText?: unknown } = {},
  now = new Date()
) {
  const requestId = typeof input.requestId === "string" ? input.requestId.trim() : "";
  const resultText = typeof input.resultText === "string" ? input.resultText.trim() : "";

  if (!requestId) {
    throw new Error("Choose a build execution request before importing a builder result.");
  }

  if (resultText.length < 20) {
    throw new Error("Paste a builder result with enough detail to parse.");
  }

  const store = await readBuildExecutionRequestStore();
  const index = store.records.findIndex((record) => record.id === requestId);

  if (index === -1) {
    throw new Error("Build execution request not found.");
  }

  const existing = store.records[index];
  const createdAt = now.toISOString();
  const parsed = parseBuilderResult(resultText, existing, createdAt);
  const executionStatus = deriveExecutionStatusFromBuilderResult(parsed);
  const updated = {
    ...existing,
    updatedAt: createdAt,
    executionStatus,
    latestBuilderResult: parsed,
    builderResults: [parsed, ...existing.builderResults].slice(0, 12),
    ownerReadableSummary: `Builder result received for ${existing.targetProjectSlice}: ${parsed.passFailStatus.replaceAll("_", " ")}.`,
    statusHistory: [
      {
        status: executionStatus,
        at: createdAt,
        note: parsed.ownerReadableSummary
      },
      {
        status: "result_received" as const,
        at: createdAt,
        note: "Builder/Codex result was pasted into AppEngine for owner verification review."
      },
      ...existing.statusHistory
    ],
    artifact: {
      ...existing.artifact,
      executionStatus,
      latestBuilderResultId: parsed.id,
      builderResultReceived: true
    }
  } satisfies BuildExecutionRequestRecord;

  store.records[index] = updated;
  await writeBuildExecutionRequestStore(store);
  await updateProjectMemoryFromBuilderResultIntake(updated, parsed);
  const buildLoopDashboard = createBuildLoopCompletionDashboard(updated, now);
  if (updated.executionStatus === "completed" || updated.executionStatus === "blocked") {
    await updateProjectMemoryFromBuildLoopCompletion(updated, buildLoopDashboard);
  }
  await getAppEngineAuditTrail().append({
    type: "builder_result_intake_received",
    actor: { type: "owner", id: "Lincoln" },
    summary: parsed.ownerReadableSummary,
    subjectId: parsed.id,
    metadata: {
      requestId: updated.id,
      prNumber: parsed.prNumber,
      branch: parsed.branch,
      passFailStatus: parsed.passFailStatus,
      executionStatus: updated.executionStatus,
      reviewUrl: parsed.reviewUrl,
      autoMerged: false,
      codexTriggered: false,
      githubIssuesCreated: false,
      labelsApplied: false,
      productionDeployed: false
    }
  });
  if (updated.executionStatus === "completed" || updated.executionStatus === "blocked") {
    await getAppEngineAuditTrail().append({
      type: "build_loop_completion_recorded",
      actor: { type: "system", id: "AppEngine" },
      summary: buildLoopDashboard.ownerReadableSummary,
      subjectId: updated.id,
      metadata: {
        requestId: updated.id,
        executionStatus: updated.executionStatus,
        verificationStatus: parsed.passFailStatus,
        blockerCount: buildLoopDashboard.blockers.length,
        missingInformationCount: buildLoopDashboard.missingInformation.length,
        noAutoMerge: true,
        codexTriggered: false,
        githubIssuesCreated: false,
        labelsApplied: false,
        productionDeployed: false
      }
    });
  }

  return { record: updated, builderResult: parsed };
}

function buildLoopCompletionGuardrails(): BuildLoopCompletionDashboard["guardrails"] {
  return {
    derivedFromExistingStateOnly: true,
    noParallelTracker: true,
    noAutoMerge: true,
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

function buildLoopStep(
  id: BuildLoopCompletionStepId,
  label: string,
  status: BuildLoopStepStatus,
  summary: string,
  evidence: string[],
  blockers: string[],
  missingInformation: string[]
): BuildLoopCompletionStep {
  return {
    id,
    label,
    status,
    summary,
    evidence: uniqueValues(evidence).slice(0, 8),
    blockers: uniqueValues(blockers).slice(0, 8),
    missingInformation: uniqueValues(missingInformation).slice(0, 8)
  };
}

function verificationStepStatus(
  request: BuildExecutionRequestRecord,
  result: BuildExecutionBuilderResultIntake | null
): BuildLoopStepStatus {
  if (!result) return request.exportedBuilderHandoffId ? "ready" : "not_started";
  if (request.executionStatus === "blocked" || result.passFailStatus === "failed") return "blocked";
  if (request.executionStatus === "completed" && result.passFailStatus === "passed") return "completed";
  return "in_progress";
}

function determineBuildLoopNextSafeAction(request: BuildExecutionRequestRecord) {
  if (request.executionStatus === "blocked") {
    return request.latestBuilderResult?.followUpPrompt
      ? "Review the focused follow-up prompt before asking Codex for another fix."
      : "Review blockers and decide whether to revise, abandon, or create a focused follow-up.";
  }

  if (request.executionStatus === "completed") {
    return "Owner review can decide whether to merge, keep watching, or start the next safe AppEngine action.";
  }

  if (!request.sourcePacketDraft) {
    return "Attach or prepare a packet draft before treating this build loop as complete.";
  }

  if (!request.exportedBuilderHandoffId) {
    return "Owner should review the build execution request and export the builder handoff when ready.";
  }

  if (!request.latestBuilderResult) {
    return "Paste the builder/Codex result into Builder Result Intake when it comes back.";
  }

  if (request.executionStatus === "verification_needed") {
    return "Run or review verification evidence before deciding whether this build loop is complete.";
  }

  return request.latestBuilderResult.nextSafeAction;
}

function buildLoopCopyableNextActionPrompt(
  request: BuildExecutionRequestRecord,
  blockers: string[],
  missingInformation: string[]
) {
  if (request.executionStatus === "completed") return null;

  const needs = [...blockers, ...missingInformation];
  const target = request.targetProjectSlice;

  if (request.latestBuilderResult?.followUpPrompt) {
    return request.latestBuilderResult.followUpPrompt;
  }

  return [
    `Continue the AppEngine build loop for ${target}.`,
    "",
    `Current state: ${request.executionStatus.replaceAll("_", " ")}`,
    `Next safe action: ${determineBuildLoopNextSafeAction(request)}`,
    needs.length ? `Blockers or missing information: ${needs.join("; ")}` : "Blockers or missing information: none recorded.",
    "",
    "Guardrails:",
    "- Do not deploy production.",
    "- Do not create paid resources.",
    "- Do not apply migrations.",
    "- Do not change secrets or env vars.",
    "- Do not create GitHub issues or labels.",
    "- Do not auto-merge generated app code.",
    "",
    "Verification:",
    ...request.verificationCommands.map((command) => `- ${command}`)
  ].join("\n");
}

function buildSourceFromHandoff(
  handoff: HandoffRelaySummary,
  firstBuildRequest: FirstRealEcosystemBuildRequestRecord | null,
  firstPacketDraft: FirstEcosystemBuildPacketDraftRecord | null
): BuildExecutionHandoffSource {
  const sourceKind: BuildExecutionHandoffSourceKind = firstPacketDraft
    ? "first_ecosystem_build_packet_draft"
    : firstBuildRequest
      ? "first_ecosystem_build_request_handoff"
      : handoff.source === "opportunity_prepared_handoff"
        ? "opportunity_ready_appengine_handoff"
        : "handoff_inbox";
  const targetProjectSlice = firstPacketDraft || firstBuildRequest
    ? "Life Produces Life Core / first ecosystem build slice"
    : deriveTargetProjectSlice(handoff);

  return {
    id: handoff.id,
    sourceHandoffId: handoff.id,
    sourceKind,
    title: handoff.extracted.prTitle || "Prepared AppEngine handoff",
    receivedAt: handoff.receivedAt,
    targetProjectSlice,
    requestedWork: firstPacketDraft?.copyableNextAppEnginePrompt || handoff.nextPrompt.prompt,
    guardrails: normalizeGuardrails(handoff.extracted.guardrailsPreserved),
    verificationCommands: normalizeVerification(handoff.extracted.verificationResults),
    expectedResult:
      firstPacketDraft?.ownerReadableSummary ||
      handoff.nextPrompt.expectedOutcome,
    ownerReadableSummary: firstPacketDraft
      ? `${firstPacketDraft.ownerReadableSummary} Source handoff: ${handoff.ownerReadableSummary}`
      : handoff.ownerReadableSummary,
    sourcePacketDraft: firstPacketDraft ? packetDraftSource(firstPacketDraft) : null
  };
}

function buildSourceFromFirstBuildRequest(
  request: FirstRealEcosystemBuildRequestRecord,
  firstPacketDraft: FirstEcosystemBuildPacketDraftRecord | null
): BuildExecutionHandoffSource {
  return {
    id: request.preparedHandoff.id,
    sourceHandoffId: request.preparedHandoff.id,
    sourceKind: firstPacketDraft ? "first_ecosystem_build_packet_draft" : "first_ecosystem_build_request_handoff",
    title: firstPacketDraft?.title || "Prepared AppEngine handoff: Life Produces Life Core",
    receivedAt: request.createdAt,
    targetProjectSlice: "Life Produces Life Core / first ecosystem build slice",
    requestedWork: firstPacketDraft?.copyableNextAppEnginePrompt || request.preparedHandoff.prompt,
    guardrails: defaultGuardrailText(),
    verificationCommands: defaultVerificationCommands(),
    expectedResult: firstPacketDraft?.ownerReadableSummary || request.preparedHandoff.expectedOutcome,
    ownerReadableSummary: firstPacketDraft
      ? `${firstPacketDraft.ownerReadableSummary} Source build request: ${request.ownerReadableSummary}`
      : request.ownerReadableSummary,
    sourcePacketDraft: firstPacketDraft ? packetDraftSource(firstPacketDraft) : null
  };
}

function buildSourceFromPacketDraft(draft: FirstEcosystemBuildPacketDraftRecord): BuildExecutionHandoffSource {
  return {
    id: draft.id,
    sourceHandoffId: draft.sourcePreparedHandoffId,
    sourceKind: "first_ecosystem_build_packet_draft",
    title: draft.title,
    receivedAt: draft.createdAt,
    targetProjectSlice: "Life Produces Life Core / first ecosystem build slice",
    requestedWork: draft.copyableNextAppEnginePrompt,
    guardrails: normalizeGuardrails(draft.guardrailNotes),
    verificationCommands: defaultVerificationCommands(),
    expectedResult: draft.ownerReadableSummary,
    ownerReadableSummary: draft.ownerReadableSummary,
    sourcePacketDraft: packetDraftSource(draft)
  };
}

function packetDraftSource(draft: FirstEcosystemBuildPacketDraftRecord): BuildExecutionPacketDraftSource {
  return {
    id: draft.id,
    kind: draft.kind,
    title: draft.title,
    status: draft.status,
    ownerReadableSummary: draft.ownerReadableSummary,
    nextSafeAction: draft.nextSafeAction,
    designIntent: draft.designIntent
  };
}

function parseBuilderResult(
  rawResult: string,
  request: BuildExecutionRequestRecord,
  createdAt: string
): BuildExecutionBuilderResultIntake {
  const blockers = extractBlockers(rawResult);
  const passFailStatus = derivePassFailStatus(rawResult, blockers);
  const reviewUrl = extractReviewUrl(rawResult);
  const changedFiles = extractChangedFiles(rawResult);
  const verificationCommandsRun = extractVerificationCommandsRun(rawResult);
  const prNumber = extractPrNumber(rawResult);
  const branch = extractBranch(rawResult);
  const nextSafeAction = deriveBuilderResultNextSafeAction({ passFailStatus, blockers, reviewUrl });
  const ownerReadableSummary = buildBuilderResultSummary({
    targetProjectSlice: request.targetProjectSlice,
    prNumber,
    branch,
    passFailStatus,
    blockers,
    reviewUrl
  });
  const baseResult = {
    id: `builder_result_${randomUUID()}`,
    kind: "builder_result_intake" as const,
    schemaVersion: 1 as const,
    createdAt,
    rawResult: rawResult.slice(0, 12000),
    prNumber,
    branch,
    changedFiles,
    verificationCommandsRun,
    passFailStatus,
    blockers,
    reviewUrl,
    nextSafeAction,
    ownerReadableSummary,
    guardrails: builderResultGuardrails()
  };

  return {
    ...baseResult,
    followUpPrompt: passFailStatus === "passed" && !blockers.length ? null : buildBuilderResultFollowUpPrompt(request, baseResult)
  };
}

function deriveExecutionStatusFromBuilderResult(result: BuildExecutionBuilderResultIntake): BuildExecutionRequestStatus {
  if (result.passFailStatus === "failed" || result.blockers.length) return "blocked";
  if (result.passFailStatus === "needs_verification") return "verification_needed";
  return "completed";
}

function extractPrNumber(text: string) {
  const match = text.match(/\bPR\s*#?(\d+)\b/i) || text.match(/\/pull\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

function extractBranch(text: string) {
  const match =
    text.match(/\bbranch\s*[:=]\s*([A-Za-z0-9._/-]+)/i) ||
    text.match(/\bhead\s*[:=]\s*([A-Za-z0-9._/-]+)/i) ||
    text.match(/\b(codex\/[A-Za-z0-9._/-]+)/i);
  return match ? match[1].replace(/[),.]+$/, "") : null;
}

function extractReviewUrl(text: string) {
  const urls = text.match(/https?:\/\/[^\s)]+/gi) || [];
  return urls.find((url) => /vercel\.app|review\.|\/life-core|\/spark-of-hope|\/opportunity/i.test(url)) || urls[0] || null;
}

function extractChangedFiles(text: string) {
  const lines = text.split(/\r?\n/).map(cleanResultLine).filter(Boolean);
  const fileLike = lines.filter((line) =>
    /(^|[\s`])(?:src|scripts|source-of-truth|agents|public|app|components|lib|docs|\.github)\/[A-Za-z0-9._/-]+\.[A-Za-z0-9]+/.test(line)
  );
  const explicit = lines.filter((line) => /changed file|modified|created|updated|added/i.test(line) && /[A-Za-z0-9._/-]+\.[A-Za-z0-9]+/.test(line));
  return uniqueStrings([...fileLike, ...explicit].map((line) => line.replace(/^[-*]\s*/, "").slice(0, 180))).slice(0, 20);
}

function extractVerificationCommandsRun(text: string) {
  const commandMatches = text.match(/npm run [A-Za-z0-9:_-]+/g) || [];
  const lines = text
    .split(/\r?\n/)
    .map(cleanResultLine)
    .filter((line) => /(verification|check|typecheck|build|smoke|passed|failed)/i.test(line));
  return uniqueStrings([...commandMatches, ...lines].map((line) => line.slice(0, 180))).slice(0, 16);
}

function extractBlockers(text: string) {
  const lower = text.toLowerCase();
  const lines = text.split(/\r?\n/).map(cleanResultLine).filter(Boolean);
  const blockers = lines.filter((line) => /(blocker|blocked|fail|failed|error|conflict|cannot|needs fix|not passing|404|unauthorized)/i.test(line));

  if (!blockers.length && /\bfailed\b|\berror\b|\bblocked\b/.test(lower)) {
    return ["Builder result indicates a failure or blocker but did not provide a specific blocker line."];
  }

  return uniqueStrings(blockers.map((line) => line.replace(/^[-*]\s*/, "").slice(0, 220))).slice(0, 10);
}

function derivePassFailStatus(text: string, blockers: string[]): BuildExecutionBuilderResultStatus {
  const lower = text.toLowerCase();

  if (blockers.length || /\b(failed|failure|error|blocked|not passing|cannot merge)\b/.test(lower)) {
    return "failed";
  }

  if (/\b(passed|passes|success|successful|verification passed|checks green|build passed)\b/.test(lower)) {
    return "passed";
  }

  return "needs_verification";
}

function deriveBuilderResultNextSafeAction({
  passFailStatus,
  blockers,
  reviewUrl
}: {
  passFailStatus: BuildExecutionBuilderResultStatus;
  blockers: string[];
  reviewUrl: string | null;
}) {
  if (passFailStatus === "failed" || blockers.length) return "create focused fix handoff after owner review";
  if (passFailStatus === "needs_verification") return "run verification review before merge decision";
  if (reviewUrl) return "owner review of verified result before merge decision";
  return "owner review of passing result before merge decision";
}

function buildBuilderResultSummary({
  targetProjectSlice,
  prNumber,
  branch,
  passFailStatus,
  blockers,
  reviewUrl
}: {
  targetProjectSlice: string;
  prNumber: number | null;
  branch: string | null;
  passFailStatus: BuildExecutionBuilderResultStatus;
  blockers: string[];
  reviewUrl: string | null;
}) {
  const source = prNumber ? `PR #${prNumber}` : branch ? `branch ${branch}` : "builder result";
  const blockerText = blockers.length ? ` Blockers: ${blockers.slice(0, 2).join(" | ")}` : "";
  const reviewText = reviewUrl ? ` Review URL: ${reviewUrl}` : "";
  return `${source} received for ${targetProjectSlice}. Status: ${passFailStatus.replaceAll("_", " ")}.${blockerText}${reviewText}`;
}

function buildBuilderResultFollowUpPrompt(
  request: BuildExecutionRequestRecord,
  result: Omit<BuildExecutionBuilderResultIntake, "followUpPrompt">
) {
  return [
    "Review this builder result and create one focused follow-up only if needed.",
    "",
    `Source build execution request: ${request.id}`,
    `Target project/slice: ${request.targetProjectSlice}`,
    result.prNumber ? `PR: #${result.prNumber}` : "",
    result.branch ? `Branch: ${result.branch}` : "",
    result.reviewUrl ? `Review URL: ${result.reviewUrl}` : "",
    "",
    "Builder result status:",
    result.passFailStatus.replaceAll("_", " "),
    "",
    "Blockers:",
    ...(result.blockers.length ? result.blockers.map((blocker) => `- ${blocker}`) : ["- No explicit blocker lines found."]),
    "",
    "Verification commands reported:",
    ...(result.verificationCommandsRun.length ? result.verificationCommandsRun.map((command) => `- ${command}`) : ["- Verification not clearly reported."]),
    "",
    "Next safe action:",
    result.nextSafeAction,
    "",
    "Guardrails:",
    "- Do not auto-merge.",
    "- Do not trigger Codex automatically.",
    "- Do not create GitHub issues.",
    "- Do not apply labels.",
    "- Do not deploy production.",
    "- Do not create paid resources.",
    "- Do not apply live migrations.",
    "- Do not change secrets/env vars.",
    "- Do not change repo visibility."
  ]
    .filter(Boolean)
    .join("\n");
}

function builderResultGuardrails() {
  return {
    noAutoMerge: true,
    noCodexAutoExecution: true,
    noGitHubIssueCreation: true,
    noLabelChanges: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noLiveMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true
  } as const;
}

function cleanResultLine(line: string) {
  return line.replace(/^>\s*/, "").replace(/^[-*]\s*/, "").trim();
}

function createBuilderHandoffExport(request: BuildExecutionRequestRecord, now = new Date()): BuildExecutionBuilderHandoffExport {
  const designIntent = request.sourcePacketDraft?.designIntent || defaultDesignIntent();
  const createdAt = now.toISOString();
  const exportOutput: Omit<BuildExecutionBuilderHandoffExport, "exactBuilderPrompt"> = {
    kind: "build_execution_builder_handoff_export",
    schemaVersion: 1,
    id: `build_execution_export_${randomUUID()}`,
    createdAt,
    requestId: request.id,
    sourceHandoffId: request.sourceHandoff.id,
    sourceOpportunityOrEcosystemRequest: `${request.sourceHandoff.title} (${request.sourceHandoff.sourceKind.replaceAll("_", " ")})`,
    sourcePacketDraft: request.sourcePacketDraft,
    targetProjectSlice: request.targetProjectSlice,
    requestedBuildWork: request.requestedWork,
    designIntent,
    guardrails: request.guardrails,
    verificationCommands: request.verificationCommands,
    expectedResult: request.expectedResult,
    handoffInboxId: null,
    execution: {
      codexTriggered: false,
      githubIssuesCreated: false,
      labelsApplied: false,
      productionDeployed: false,
      paidResourcesCreated: false,
      migrationsApplied: false,
      secretsOrEnvChanged: false,
      repositoryVisibilityChanged: false
    }
  };

  return {
    ...exportOutput,
    exactBuilderPrompt: buildExactBuilderPrompt(exportOutput)
  };
}

function buildExactBuilderPrompt(exportOutput: Omit<BuildExecutionBuilderHandoffExport, "exactBuilderPrompt">) {
  return [
    "# AppEngine Builder Handoff",
    "",
    "Use this owner-approved build execution request as the source of truth.",
    "",
    `Target project/slice: ${exportOutput.targetProjectSlice}`,
    `Source Opportunity / ecosystem request: ${exportOutput.sourceOpportunityOrEcosystemRequest}`,
    `Source packet draft: ${exportOutput.sourcePacketDraft?.title || "No packet draft attached"}`,
    "",
    "## Requested Build Work",
    exportOutput.requestedBuildWork,
    "",
    "## Design Intent",
    `Profile: ${exportOutput.designIntent.profile}`,
    `Emotional experience: ${exportOutput.designIntent.emotionalExperience.join(", ")}`,
    `Style notes: ${exportOutput.designIntent.styleNotes.join(" | ")}`,
    `Avoid: ${exportOutput.designIntent.avoid.join(" | ")}`,
    "",
    "## Guardrails",
    ...exportOutput.guardrails.map((guardrail) => `- ${guardrail}`),
    "",
    "## Verification",
    ...exportOutput.verificationCommands.map((command) => `- ${command}`),
    "",
    "## Expected Result",
    exportOutput.expectedResult,
    "",
    "Do not trigger Codex automatically from AppEngine, create GitHub issues, apply labels, deploy production, create paid resources, apply live migrations, change secrets/env vars, change repository visibility, or auto-merge generated app code."
  ].join("\n");
}

function parseReviewStatus(value: unknown): BuildExecutionRequestReviewStatus | null {
  if (
    value === "needs_review" ||
    value === "owner_approved" ||
    value === "blocked" ||
    value === "exported_for_builder"
  ) {
    return value;
  }

  return null;
}

function defaultDesignIntent() {
  return {
    profile: "ministry_community" as const,
    emotionalExperience: ["warm", "hopeful", "clear", "trustworthy"],
    styleNotes: ["Use plain language.", "Make the next step obvious.", "Keep phone review comfortable."],
    avoid: ["cold technical tone", "generic dashboard feel", "claims that unfinished ecosystem services are live"]
  };
}

function deriveTargetProjectSlice(handoff: HandoffRelaySummary) {
  const text = `${handoff.rawText}\n${handoff.nextPrompt.prompt}\n${handoff.projectState.currentStatus}`.toLowerCase();

  if (text.includes("life produces life") || text.includes("life core")) {
    return "Life Produces Life Core / ecosystem slice";
  }

  if (text.includes("spark of hope")) {
    return "Spark of Hope / app slice";
  }

  if (handoff.source === "opportunity_prepared_handoff") {
    return "Opportunity / next AppEngine action";
  }

  return handoff.extracted.prTitle || "AppEngine / prepared handoff";
}

function normalizeVerification(values: string[]) {
  const commands = [...values, ...defaultVerificationCommands()]
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(commands)).slice(0, 10);
}

function normalizeGuardrails(values: string[]) {
  const guardrails = values.length ? values : defaultGuardrailText();
  return Array.from(new Set([...guardrails, ...defaultGuardrailText()])).slice(0, 12);
}

function defaultVerificationCommands() {
  return [
    "npm run source:check",
    "npm run smoke:build-execution-request",
    "npm run smoke:first-ecosystem-build-packet-draft",
    "npm run typecheck",
    "npm run build"
  ];
}

function defaultGuardrailText() {
  return [
    "No Codex auto-execution.",
    "No GitHub issue creation.",
    "No label changes.",
    "No production deploy.",
    "No paid resources.",
    "No live migrations.",
    "No secrets/env changes.",
    "No repository visibility changes."
  ];
}

function uniqueSources(sources: BuildExecutionHandoffSource[]) {
  const seen = new Set<string>();

  return sources.filter((source) => {
    if (seen.has(source.sourceHandoffId)) return false;
    seen.add(source.sourceHandoffId);
    return true;
  });
}

function uniqueValues(values: string[]) {
  return uniqueStrings(values.map((value) => value.trim()).filter(Boolean));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function readBuildExecutionRequestStore(): Promise<BuildExecutionRequestStore> {
  const store = await getAppEngineStateAdapter().readJson<BuildExecutionRequestStore>(
    { kind: "build_execution_requests", key: "records" },
    { schemaVersion: 1, records: [] }
  );

  return {
    schemaVersion: 1,
    records: store.records.map(normalizeBuildExecutionRequest)
  };
}

async function writeBuildExecutionRequestStore(store: BuildExecutionRequestStore) {
  await getAppEngineStateAdapter().writeJson(
    { kind: "build_execution_requests", key: "records" },
    { schemaVersion: 1, records: store.records.map(normalizeBuildExecutionRequest) }
  );
}

function normalizeBuildExecutionRequest(record: BuildExecutionRequestRecord): BuildExecutionRequestRecord {
  return {
    ...record,
    latestBuilderResult: record.latestBuilderResult || null,
    builderResults: record.builderResults || [],
    artifact: {
      ...record.artifact,
      latestBuilderResultId: record.artifact.latestBuilderResultId || record.latestBuilderResult?.id || null,
      builderResultReceived: record.artifact.builderResultReceived || Boolean(record.latestBuilderResult)
    }
  };
}
