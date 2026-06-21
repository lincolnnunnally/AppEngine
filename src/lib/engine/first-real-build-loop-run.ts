import { randomUUID } from "node:crypto";
import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import { loadOwnerPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";

// NON-CANONICAL: first-run build proof / test fixture. The canonical execution
// record is loop_run_records (createLoopRunFromPacket / completeLoopRun). This
// runner is read-only evidence and must not create competing execution records.
export const CANONICAL_EXECUTION_NOTE =
  "loop_run_records is the canonical execution record; first_real_build_loop_run is a read-only proof/fixture.";
import {
  createBuildExecutionRequest,
  intakeBuilderResult,
  reviewBuildExecutionRequest,
  type BuildExecutionBuilderResultIntake,
  type BuildExecutionRequestRecord
} from "@/lib/engine/build-execution-request";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import {
  createFirstEcosystemBuildPacketDraft,
  listFirstEcosystemBuildPacketDrafts,
  type FirstEcosystemBuildPacketDraftRecord
} from "@/lib/engine/first-ecosystem-build-packet-draft";
import {
  listFirstRealEcosystemBuildRequests,
  runFirstRealEcosystemBuildRequest,
  type FirstRealEcosystemBuildRequestRecord
} from "@/lib/engine/first-real-ecosystem-build-request";
import {
  loadProjectMemory,
  updateProjectMemoryFromFirstRealBuildLoopRun,
  updateProjectMemoryFromFirstRealBuildResultIntake
} from "@/lib/engine/project-memory";

export type FirstRealBuildLoopRunStepStatus = "completed" | "waiting_on_builder_output" | "needs_verification" | "blocked";

export type FirstRealBuildLoopRunStep = {
  key:
    | "source_request"
    | "packet_draft"
    | "build_execution_request"
    | "exported_builder_handoff"
    | "builder_result_intake_placeholder"
    | "verification_review_placeholder"
    | "portfolio_update"
    | "project_memory_update"
    | "audit_trail_update";
  label: string;
  status: FirstRealBuildLoopRunStepStatus;
  summary: string;
  evidenceId: string | null;
};

export type FirstRealBuildResultIntakeSummary = {
  kind: "first_real_build_result_intake";
  id: string;
  importedAt: string;
  prNumber: number | null;
  branch: string | null;
  changedFiles: string[];
  verificationCommandsRun: string[];
  passFailStatus: BuildExecutionBuilderResultIntake["passFailStatus"];
  blockers: string[];
  reviewUrl: string | null;
  nextSafeAction: string;
  ownerReadableSummary: string;
};

export type FirstRealBuildVerificationReview = {
  status: "passed" | "failed" | "needs_verification";
  lifeCoreSliceReviewReady: boolean;
  failedOrMissingVerification: string[];
  summary: string;
};

export type FirstRealBuildLoopRunRecord = {
  id: string;
  kind: "first_real_build_loop_run";
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  target: {
    appName: "Life Produces Life Core";
    ecosystem: "United Under God ecosystem foundation";
    slice: "First ecosystem build slice";
  };
  sourceRequest: {
    id: string;
    preparedHandoffId: string;
  };
  packetDraft: {
    id: string;
    title: FirstEcosystemBuildPacketDraftRecord["title"];
    status: FirstEcosystemBuildPacketDraftRecord["status"];
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
  builderResultIntakePlaceholder: {
    status: "waiting_on_builder_output" | "result_received";
    summary: string;
  };
  verificationReviewPlaceholder: {
    status: "waiting_on_builder_output" | "completed" | "needs_verification" | "blocked";
    summary: string;
  };
  builderResultIntake: FirstRealBuildResultIntakeSummary | null;
  verificationReview: FirstRealBuildVerificationReview | null;
  portfolioUpdate: {
    appEngineStatus: string;
    lifeCoreStatus: string;
    nextSafeAction: string;
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
  steps: FirstRealBuildLoopRunStep[];
  nextSafeAction:
    | "copy_builder_prompt_and_wait_for_builder_result"
    | "review_life_core_slice_for_merge_decision"
    | "resolve_builder_result_blockers"
    | "review_missing_verification_evidence";
  ownerReadableSummary: string;
  guardrails: ReturnType<typeof firstRealBuildLoopRunGuardrails>;
};

type FirstRealBuildLoopRunStore = {
  schemaVersion: 1;
  records: FirstRealBuildLoopRunRecord[];
};

export function firstRealBuildLoopRunGuardrails() {
  return {
    ...durableStateGuardrails(),
    ownerFacingControlledUseOnly: true,
    usesExistingLifeCorePacketDraft: true,
    createsBuildExecutionRequest: true,
    exportsBuilderHandoffForCopyOnly: true,
    builderResultIntakeIsPlaceholder: true,
    builderResultIntakeCanCompleteFromOwnerPaste: true,
    verificationReviewIsPlaceholder: true,
    verificationReviewCanCompleteFromOwnerPaste: true,
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

export async function listFirstRealBuildLoopRuns() {
  const store = await readFirstRealBuildLoopRunStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function runFirstRealBuildLoopRun(now = new Date()) {
  const createdAt = now.toISOString();
  const sourceRequest = await ensureFirstRealEcosystemBuildRequest(now);
  const packetDraft = await ensureFirstEcosystemBuildPacketDraft(sourceRequest, now);
  const buildRequest = await createBuildExecutionRequest({ sourceId: packetDraft.sourcePreparedHandoffId }, now);
  const { record: exportedBuildRequest, handoff, exportOutput } = await reviewBuildExecutionRequest(
    {
      requestId: buildRequest.id,
      reviewStatus: "owner_approved",
      note:
        "First real Life Produces Life build loop run approved for copy-only builder handoff export. Do not trigger Codex automatically."
    },
    now
  );
  const exactBuilderPrompt =
    exportedBuildRequest.exportedBuilderHandoff?.exactBuilderPrompt ||
    exportOutput?.exactBuilderPrompt ||
    packetDraft.copyableNextAppEnginePrompt;
  const [portfolioRegistry, projectMemory, auditEvents] = await Promise.all([
    loadOwnerPortfolioRegistry(),
    loadProjectMemory(),
    getAppEngineAuditTrail().list()
  ]);
  const appEngineEntry = portfolioRegistry.apps.find((entry) => entry.slug === "appengine-core") || portfolioRegistry.apps[0] || null;
  const lifeCoreEntry = portfolioRegistry.apps.find((entry) => entry.slug === "life-produces-life-core") || null;
  const record: FirstRealBuildLoopRunRecord = {
    id: `first_real_build_loop_${randomUUID()}`,
    kind: "first_real_build_loop_run",
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
    target: {
      appName: "Life Produces Life Core",
      ecosystem: "United Under God ecosystem foundation",
      slice: "First ecosystem build slice"
    },
    sourceRequest: {
      id: sourceRequest.id,
      preparedHandoffId: sourceRequest.preparedHandoff.id
    },
    packetDraft: {
      id: packetDraft.id,
      title: packetDraft.title,
      status: packetDraft.status
    },
    buildExecutionRequest: {
      id: exportedBuildRequest.id,
      executionStatus: exportedBuildRequest.executionStatus,
      reviewStatus: exportedBuildRequest.reviewStatus
    },
    exportedBuilderHandoff: {
      id: exportedBuildRequest.exportedBuilderHandoffId || handoff?.id || "not_exported",
      handoffInboxId: handoff?.id || exportedBuildRequest.exportedBuilderHandoff?.handoffInboxId || null,
      exactBuilderPrompt
    },
    builderResultIntakePlaceholder: {
      status: "waiting_on_builder_output",
      summary: "Builder result intake is waiting for Lincoln to paste the builder/Codex result after the prompt is used."
    },
    verificationReviewPlaceholder: {
      status: "waiting_on_builder_output",
      summary: "Verification review is waiting for builder output, changed files, check results, blockers, and any review URL."
    },
    builderResultIntake: null,
    verificationReview: null,
    portfolioUpdate: {
      appEngineStatus: appEngineEntry?.status || "AppEngine portfolio state not visible yet",
      lifeCoreStatus: lifeCoreEntry?.status || "Life Core portfolio state not visible yet",
      nextSafeAction: appEngineEntry?.nextSafeAction || lifeCoreEntry?.nextSafeAction || "await_owner_review"
    },
    projectMemoryUpdate: {
      currentState: projectMemory.latestProjectState.currentState,
      recommendedNextAction: projectMemory.latestProjectState.recommendedNextAction,
      lastHandoffId: projectMemory.latestProjectState.lastHandoffId
    },
    auditTrailUpdate: {
      eventCount: auditEvents.length,
      latestEventTypes: auditEvents.slice(-6).map((event) => event.type)
    },
    steps: buildSteps(sourceRequest, packetDraft, exportedBuildRequest, handoff?.id || null, projectMemory.updatedAt, auditEvents.length),
    nextSafeAction: "copy_builder_prompt_and_wait_for_builder_result",
    ownerReadableSummary:
      "First real Life Produces Life Core build loop run is prepared. AppEngine created the source request, packet draft, build execution request, and exported builder handoff, then stopped for owner-controlled builder output.",
    guardrails: firstRealBuildLoopRunGuardrails()
  };

  await writeFirstRealBuildLoopRun(record);
  await updateProjectMemoryFromFirstRealBuildLoopRun(record);
  await getAppEngineAuditTrail().append({
    type: "first_real_build_loop_run_prepared",
    actor: { type: "owner", id: "Lincoln" },
    summary: record.ownerReadableSummary,
    subjectId: record.id,
    metadata: {
      sourceRequestId: record.sourceRequest.id,
      packetDraftId: record.packetDraft.id,
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

  return record;
}

export async function intakeFirstRealBuildResult(input: { runId?: unknown; resultText?: unknown } = {}, now = new Date()) {
  const runId = typeof input.runId === "string" ? input.runId.trim() : "";
  const resultText = typeof input.resultText === "string" ? input.resultText.trim() : "";

  if (resultText.length < 20) {
    throw new Error("Paste the actual builder/Codex result before importing the first real build result.");
  }

  const store = await readFirstRealBuildLoopRunStore();
  const existing = runId ? store.records.find((record) => record.id === runId) : store.records[0];

  if (!existing) {
    throw new Error("Prepare the first real build loop run before importing a builder result.");
  }

  const { record: buildExecutionRequest, builderResult } = await intakeBuilderResult(
    {
      requestId: existing.buildExecutionRequest.id,
      resultText
    },
    now
  );
  const [portfolioRegistry, projectMemory, auditEvents] = await Promise.all([
    loadOwnerPortfolioRegistry(),
    loadProjectMemory(),
    getAppEngineAuditTrail().list()
  ]);
  const appEngineEntry = portfolioRegistry.apps.find((entry) => entry.slug === "appengine-core") || portfolioRegistry.apps[0] || null;
  const lifeCoreEntry = portfolioRegistry.apps.find((entry) => entry.slug === "life-produces-life-core") || null;
  const resultSummary = summarizeFirstRealBuildResult(builderResult);
  const verificationReview = createFirstRealBuildVerificationReview(builderResult);
  const nextSafeAction = determineFirstRealBuildResultNextSafeAction(verificationReview);
  const updated: FirstRealBuildLoopRunRecord = {
    ...existing,
    updatedAt: now.toISOString(),
    buildExecutionRequest: {
      id: buildExecutionRequest.id,
      executionStatus: buildExecutionRequest.executionStatus,
      reviewStatus: buildExecutionRequest.reviewStatus
    },
    builderResultIntakePlaceholder: {
      status: "result_received",
      summary: builderResult.ownerReadableSummary
    },
    verificationReviewPlaceholder: {
      status: verificationReview.lifeCoreSliceReviewReady
        ? "completed"
        : verificationReview.status === "failed"
          ? "blocked"
          : "needs_verification",
      summary: verificationReview.summary
    },
    builderResultIntake: resultSummary,
    verificationReview,
    portfolioUpdate: {
      appEngineStatus: appEngineEntry?.status || "AppEngine portfolio state not visible yet",
      lifeCoreStatus: lifeCoreEntry?.status || "Life Core portfolio state not visible yet",
      nextSafeAction:
        lifeCoreEntry?.nextSafeAction ||
        appEngineEntry?.nextSafeAction ||
        builderResult.nextSafeAction
    },
    projectMemoryUpdate: {
      currentState: projectMemory.latestProjectState.currentState,
      recommendedNextAction: projectMemory.latestProjectState.recommendedNextAction,
      lastHandoffId: projectMemory.latestProjectState.lastHandoffId
    },
    auditTrailUpdate: {
      eventCount: auditEvents.length,
      latestEventTypes: auditEvents.slice(-6).map((event) => event.type)
    },
    steps: buildResultSteps(existing, buildExecutionRequest, builderResult, verificationReview, projectMemory.updatedAt, auditEvents.length),
    nextSafeAction,
    ownerReadableSummary: verificationReview.lifeCoreSliceReviewReady
      ? "First real Life Produces Life Core build result is imported and review-ready. AppEngine has parsed builder evidence, verification, portfolio, memory, and audit state, and it is still waiting for owner merge/release decisions."
      : `First real Life Produces Life Core build result is imported but not review-ready yet. ${verificationReview.summary}`,
    guardrails: firstRealBuildLoopRunGuardrails()
  };

  await writeFirstRealBuildLoopRun(updated);
  await updateProjectMemoryFromFirstRealBuildResultIntake(updated, builderResult);
  await getAppEngineAuditTrail().append({
    type: "first_real_build_result_intake_received",
    actor: { type: "owner", id: "Lincoln" },
    summary: updated.ownerReadableSummary,
    subjectId: updated.id,
    metadata: {
      runId: updated.id,
      buildExecutionRequestId: buildExecutionRequest.id,
      builderResultId: builderResult.id,
      prNumber: builderResult.prNumber,
      branch: builderResult.branch,
      passFailStatus: builderResult.passFailStatus,
      lifeCoreSliceReviewReady: verificationReview.lifeCoreSliceReviewReady,
      reviewUrl: builderResult.reviewUrl,
      autoMerged: false,
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
    record: updated,
    builderResult,
    buildExecutionRequest,
    portfolioRegistry: await loadOwnerPortfolioRegistry(),
    projectMemory: await loadProjectMemory(),
    auditEvents: await getAppEngineAuditTrail().list()
  };
}

async function ensureFirstRealEcosystemBuildRequest(now: Date) {
  const existing = await listFirstRealEcosystemBuildRequests();
  return existing[0] || runFirstRealEcosystemBuildRequest(now);
}

async function ensureFirstEcosystemBuildPacketDraft(sourceRequest: FirstRealEcosystemBuildRequestRecord, now: Date) {
  const existing = await listFirstEcosystemBuildPacketDrafts();
  const matching = existing.find((draft) => draft.sourceBuildRequestId === sourceRequest.id) || existing[0] || null;
  return matching || createFirstEcosystemBuildPacketDraft({ sourceBuildRequestId: sourceRequest.id }, now);
}

function buildSteps(
  sourceRequest: FirstRealEcosystemBuildRequestRecord,
  packetDraft: FirstEcosystemBuildPacketDraftRecord,
  buildRequest: BuildExecutionRequestRecord,
  handoffId: string | null,
  projectMemoryUpdatedAt: string,
  auditEventCount: number
): FirstRealBuildLoopRunStep[] {
  return [
    step("source_request", "Source request", "completed", "Life Produces Life Core source request is prepared.", sourceRequest.id),
    step("packet_draft", "Packet draft", "completed", "Life Produces Life Core packet draft is ready for this run.", packetDraft.id),
    step(
      "build_execution_request",
      "Build execution request",
      "completed",
      `Build execution request is ${buildRequest.executionStatus.replaceAll("_", " ")}.`,
      buildRequest.id
    ),
    step(
      "exported_builder_handoff",
      "Exported builder handoff",
      "completed",
      "Owner-approved builder handoff is exported to the Handoff Inbox for copy-only use.",
      handoffId || buildRequest.exportedBuilderHandoffId
    ),
    step(
      "builder_result_intake_placeholder",
      "Builder result intake placeholder",
      "waiting_on_builder_output",
      "Waiting for Lincoln to paste builder/Codex result after the prompt is used.",
      null
    ),
    step(
      "verification_review_placeholder",
      "Verification review placeholder",
      "waiting_on_builder_output",
      "Waiting for verification evidence from the builder result.",
      null
    ),
    step("portfolio_update", "Portfolio update", "completed", "Portfolio Dashboard can derive the build execution state.", "app_portfolio_registry"),
    step("project_memory_update", "Project memory update", "completed", "Project Memory has current build-loop context.", projectMemoryUpdatedAt),
    step("audit_trail_update", "Audit trail update", "completed", `${auditEventCount} audit events existed before this run record was saved.`, String(auditEventCount))
  ];
}

function buildResultSteps(
  existing: FirstRealBuildLoopRunRecord,
  buildRequest: BuildExecutionRequestRecord,
  builderResult: BuildExecutionBuilderResultIntake,
  verificationReview: FirstRealBuildVerificationReview,
  projectMemoryUpdatedAt: string,
  auditEventCount: number
): FirstRealBuildLoopRunStep[] {
  return [
    step("source_request", "Source request", "completed", "Life Produces Life Core source request remains attached.", existing.sourceRequest.id),
    step("packet_draft", "Packet draft", "completed", "Life Produces Life Core packet draft remains attached.", existing.packetDraft.id),
    step(
      "build_execution_request",
      "Build execution request",
      "completed",
      `Build execution request is now ${buildRequest.executionStatus.replaceAll("_", " ")}.`,
      buildRequest.id
    ),
    step(
      "exported_builder_handoff",
      "Exported builder handoff",
      "completed",
      "Builder handoff was exported before this result was imported.",
      existing.exportedBuilderHandoff.id
    ),
    step(
      "builder_result_intake_placeholder",
      "Builder result intake",
      "completed",
      builderResult.ownerReadableSummary,
      builderResult.id
    ),
    step(
      "verification_review_placeholder",
      "Verification review",
      verificationReview.lifeCoreSliceReviewReady ? "completed" : verificationReview.status === "failed" ? "blocked" : "needs_verification",
      verificationReview.summary,
      builderResult.id
    ),
    step("portfolio_update", "Portfolio update", "completed", "Portfolio Dashboard can now derive state from the imported builder result.", "app_portfolio_registry"),
    step("project_memory_update", "Project memory update", "completed", "Project Memory includes the imported first build result.", projectMemoryUpdatedAt),
    step("audit_trail_update", "Audit trail update", "completed", `${auditEventCount} audit events were visible after the result import.`, String(auditEventCount))
  ];
}

function step(
  key: FirstRealBuildLoopRunStep["key"],
  label: string,
  status: FirstRealBuildLoopRunStepStatus,
  summary: string,
  evidenceId: string | null
): FirstRealBuildLoopRunStep {
  return {
    key,
    label,
    status,
    summary,
    evidenceId
  };
}

function summarizeFirstRealBuildResult(builderResult: BuildExecutionBuilderResultIntake): FirstRealBuildResultIntakeSummary {
  return {
    kind: "first_real_build_result_intake",
    id: builderResult.id,
    importedAt: builderResult.createdAt,
    prNumber: builderResult.prNumber,
    branch: builderResult.branch,
    changedFiles: builderResult.changedFiles,
    verificationCommandsRun: builderResult.verificationCommandsRun,
    passFailStatus: builderResult.passFailStatus,
    blockers: builderResult.blockers,
    reviewUrl: builderResult.reviewUrl,
    nextSafeAction: builderResult.nextSafeAction,
    ownerReadableSummary: builderResult.ownerReadableSummary
  };
}

function createFirstRealBuildVerificationReview(builderResult: BuildExecutionBuilderResultIntake): FirstRealBuildVerificationReview {
  const failedOrMissingVerification = [
    ...builderResult.blockers,
    ...(builderResult.passFailStatus === "failed" ? ["Builder result reported failed verification."] : []),
    ...(builderResult.passFailStatus === "needs_verification" ? ["Builder result did not clearly prove verification passed."] : []),
    ...(builderResult.reviewUrl ? [] : ["Review URL was not found in the builder result."])
  ];
  const lifeCoreSliceReviewReady =
    builderResult.passFailStatus === "passed" && builderResult.blockers.length === 0 && Boolean(builderResult.reviewUrl);
  const status = lifeCoreSliceReviewReady ? "passed" : builderResult.passFailStatus === "failed" ? "failed" : "needs_verification";

  return {
    status,
    lifeCoreSliceReviewReady,
    failedOrMissingVerification,
    summary: lifeCoreSliceReviewReady
      ? "Verification passed, a review URL was captured, and the Life Core slice is ready for owner review. Auto-merge, deploy, and Codex execution remain blocked."
      : `Life Core slice is not review-ready yet: ${failedOrMissingVerification.join(" ") || "additional verification evidence is needed."}`
  };
}

function determineFirstRealBuildResultNextSafeAction(review: FirstRealBuildVerificationReview): FirstRealBuildLoopRunRecord["nextSafeAction"] {
  if (review.lifeCoreSliceReviewReady) return "review_life_core_slice_for_merge_decision";
  if (review.status === "failed") return "resolve_builder_result_blockers";
  return "review_missing_verification_evidence";
}

async function readFirstRealBuildLoopRunStore(): Promise<FirstRealBuildLoopRunStore> {
  return getAppEngineStateAdapter().readJson<FirstRealBuildLoopRunStore>(
    { kind: "internal_controlled_use_trials", key: "first-real-build-loop-run" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeFirstRealBuildLoopRun(record: FirstRealBuildLoopRunRecord) {
  const store = await readFirstRealBuildLoopRunStore();
  await getAppEngineStateAdapter().writeJson(
    { kind: "internal_controlled_use_trials", key: "first-real-build-loop-run" },
    {
      schemaVersion: 1,
      records: [record, ...store.records.filter((item) => item.id !== record.id)].slice(0, 12)
    }
  );
}
