import {
  listOrchestratorActionQueue,
  updateOrchestratorActionStatus,
  type OrchestratorActionQueueItem,
  type OrchestratorBatchDryRun
} from "./orchestrator-run";
import { savePreparedHandoffFromOrchestratorBatchDraft, type HandoffRelaySummary } from "./handoff-relay";
import { updateProjectMemoryFromOrchestratorAction } from "./project-memory";

export type OrchestratorBatchHandoffPrepare = {
  kind: "orchestrator_batch_handoff_prepare";
  schemaVersion: 1;
  id: string;
  createdAt: string;
  status: "prepared" | "failed_honestly";
  sourceDryRunId: string;
  storage: "local_mock";
  selectionLimit: 3;
  selectedActionIds: string[];
  preparedHandoffs: Array<{
    id: string;
    sourceActionId: string;
    sourceRunId: string;
    title: string;
    status: "prepared_handoff";
  }>;
  updatedActions: Array<{
    id: string;
    sourceRunId: string;
    status: OrchestratorActionQueueItem["status"];
    updatedAt: string;
  }>;
  skippedActions: Array<{
    actionId: string;
    reason: string;
  }>;
  execution: {
    codexTriggered: false;
    githubIssuesCreated: false;
    labelsApplied: false;
    productionDeployed: false;
    paidResourcesCreated: false;
    migrationsApplied: false;
    secretsOrEnvChanged: false;
    repositoryVisibilityChanged: false;
    autoMerged: false;
  };
  nextSafeAction: string;
  ownerReadableSummary: string;
  guardrails: {
    ownerApprovalOnly: true;
    noAutomaticCodexExecution: true;
    noGitHubIssueCreation: true;
    noLabelChanges: true;
    noProductionDeploy: true;
    noPaidResources: true;
    noMigrations: true;
    noSecretsOrEnvChanges: true;
    repositoryVisibilityUnchanged: true;
    noGeneratedAppAutoMerge: true;
  };
};

export async function prepareOrchestratorBatchHandoffs(
  dryRun: OrchestratorBatchDryRun,
  now = new Date()
): Promise<OrchestratorBatchHandoffPrepare> {
  const createdAt = now.toISOString();

  if (dryRun.kind !== "orchestrator_batch_dry_run" || dryRun.status !== "prepared" || dryRun.dryRunOnly !== true) {
    return failedPrepare({
      dryRun,
      createdAt,
      reason: "The source dry-run artifact is not prepared, valid, and dry-run-only."
    });
  }

  const currentQueue = await listOrchestratorActionQueue();
  const queueById = new Map(currentQueue.map((action) => [action.id, action]));
  const drafts = dryRun.preparedHandoffDrafts.slice(0, 3);
  const preparedHandoffs: OrchestratorBatchHandoffPrepare["preparedHandoffs"] = [];
  const updatedActions: OrchestratorBatchHandoffPrepare["updatedActions"] = [];
  const skippedActions: OrchestratorBatchHandoffPrepare["skippedActions"] = [];

  for (const draft of drafts) {
    const currentAction = queueById.get(draft.sourceActionId);

    if (!currentAction) {
      skippedActions.push({
        actionId: draft.sourceActionId,
        reason: "Skipped because the queued action is no longer present in local/mock storage."
      });
      continue;
    }

    if (currentAction.status !== "queued") {
      skippedActions.push({
        actionId: draft.sourceActionId,
        reason: `Skipped because the queued action is now ${currentAction.status}.`
      });
      continue;
    }

    const updatedAction = await updateOrchestratorActionStatus(draft.sourceActionId, "prepared_handoff", now);

    if (!updatedAction) {
      skippedActions.push({
        actionId: draft.sourceActionId,
        reason: "Skipped because the action could not be updated to prepared_handoff."
      });
      continue;
    }

    const handoff = await savePreparedHandoffFromOrchestratorBatchDraft(draft, now);
    await updateProjectMemoryFromOrchestratorAction(updatedAction);
    updatedActions.push(formatUpdatedAction(updatedAction));
    preparedHandoffs.push(formatPreparedHandoff(handoff, draft.sourceActionId, draft.sourceRunId));
  }

  const status = preparedHandoffs.length ? "prepared" : "failed_honestly";

  return {
    kind: "orchestrator_batch_handoff_prepare",
    schemaVersion: 1,
    id: `orchestrator_batch_handoff_prepare_${now.getTime().toString(36)}`,
    createdAt,
    status,
    sourceDryRunId: dryRun.id,
    storage: "local_mock",
    selectionLimit: 3,
    selectedActionIds: preparedHandoffs.map((handoff) => handoff.sourceActionId),
    preparedHandoffs,
    updatedActions,
    skippedActions,
    execution: defaultExecution(),
    nextSafeAction: status === "prepared" ? "owner_reviews_batch_handoffs_in_inbox" : "rerun_batch_dry_run_after_queue_review",
    ownerReadableSummary:
      status === "prepared"
        ? `Prepared ${preparedHandoffs.length} batch handoff${preparedHandoffs.length === 1 ? "" : "s"} in the Handoff Inbox. Nothing was sent or executed.`
        : "No batch handoffs were prepared because the selected actions were missing or no longer queued.",
    guardrails: defaultGuardrails()
  };
}

function failedPrepare({
  dryRun,
  createdAt,
  reason
}: {
  dryRun: OrchestratorBatchDryRun;
  createdAt: string;
  reason: string;
}): OrchestratorBatchHandoffPrepare {
  return {
    kind: "orchestrator_batch_handoff_prepare",
    schemaVersion: 1,
    id: `orchestrator_batch_handoff_prepare_${Date.parse(createdAt).toString(36)}`,
    createdAt,
    status: "failed_honestly",
    sourceDryRunId: dryRun.id,
    storage: "local_mock",
    selectionLimit: 3,
    selectedActionIds: [],
    preparedHandoffs: [],
    updatedActions: [],
    skippedActions: dryRun.preparedHandoffDrafts.slice(0, 3).map((draft) => ({
      actionId: draft.sourceActionId,
      reason
    })),
    execution: defaultExecution(),
    nextSafeAction: "rerun_batch_dry_run_after_queue_review",
    ownerReadableSummary: reason,
    guardrails: defaultGuardrails()
  };
}

function formatPreparedHandoff(
  handoff: HandoffRelaySummary,
  sourceActionId: string,
  sourceRunId: string
): OrchestratorBatchHandoffPrepare["preparedHandoffs"][number] {
  return {
    id: handoff.id,
    sourceActionId,
    sourceRunId,
    title: handoff.extracted.prTitle,
    status: "prepared_handoff"
  };
}

function formatUpdatedAction(action: OrchestratorActionQueueItem): OrchestratorBatchHandoffPrepare["updatedActions"][number] {
  return {
    id: action.id,
    sourceRunId: action.sourceRunId,
    status: action.status,
    updatedAt: action.updatedAt
  };
}

function defaultExecution(): OrchestratorBatchHandoffPrepare["execution"] {
  return {
    codexTriggered: false,
    githubIssuesCreated: false,
    labelsApplied: false,
    productionDeployed: false,
    paidResourcesCreated: false,
    migrationsApplied: false,
    secretsOrEnvChanged: false,
    repositoryVisibilityChanged: false,
    autoMerged: false
  };
}

function defaultGuardrails(): OrchestratorBatchHandoffPrepare["guardrails"] {
  return {
    ownerApprovalOnly: true,
    noAutomaticCodexExecution: true,
    noGitHubIssueCreation: true,
    noLabelChanges: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noGeneratedAppAutoMerge: true
  };
}
