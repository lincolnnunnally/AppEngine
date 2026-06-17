import { randomUUID } from "node:crypto";
import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import { loadOwnerPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";
import {
  createBuildExecutionRequest,
  reviewBuildExecutionRequest,
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
import { loadProjectMemory, updateProjectMemoryFromFirstRealBuildLoopRun } from "@/lib/engine/project-memory";

export type FirstRealBuildLoopRunStepStatus = "completed" | "waiting_on_builder_output" | "blocked";

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
    status: "waiting_on_builder_output";
    summary: string;
  };
  verificationReviewPlaceholder: {
    status: "waiting_on_builder_output";
    summary: string;
  };
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
  nextSafeAction: "copy_builder_prompt_and_wait_for_builder_result";
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
    verificationReviewIsPlaceholder: true,
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
      records: [record, ...store.records].slice(0, 12)
    }
  );
}
