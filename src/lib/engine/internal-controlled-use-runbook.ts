import { getAppEngineAuditTrail } from "./audit-trail-lite.ts";
import { loadAuditTrailOwnerVisibilityReport, type AuditTrailOwnerVisibilityReport } from "./audit-trail-owner-visibility.ts";
import { getAppEngineStateAdapter } from "./durable-state-adapter.ts";
import {
  approveAndExportPreparedHandoff,
  listHandoffRelaySummaries,
  savePreparedHandoffFromOrchestratorRun,
  type HandoffRelaySummary,
  type OrchestratorApprovedHandoffExport
} from "./handoff-relay.ts";
import {
  listOrchestratorActionQueue,
  listOrchestratorRuns,
  markOrchestratorActionPreparedHandoff,
  saveOrchestratorRun,
  type OrchestratorActionQueueItem,
  type OrchestratorRun
} from "./orchestrator-run.ts";
import {
  addProjectMemoryFeedback,
  loadProjectMemory,
  updateProjectMemoryFromOrchestratorAction,
  updateProjectMemoryFromOrchestratorRun,
  type ProjectMemory
} from "./project-memory.ts";
import { listRealProjectTrials } from "./real-project-trial.ts";
import { submitStoryIntake } from "../spark-of-hope-intake-lite/intake.ts";
import {
  createSparkReviewQueueItem,
  updateSparkReviewQueueFollowUp,
  updateSparkReviewQueueStatus,
  type SparkReviewQueueItem
} from "../spark-of-hope-intake-lite/review-queue.ts";

export type InternalControlledUseStepId =
  | "submit_spark_test_story"
  | "review_spark_story"
  | "approve_spark_preview"
  | "run_orchestrator_next_safe_step"
  | "prepare_export_handoff"
  | "update_project_memory"
  | "review_audit_trail";

export type InternalControlledUseStepStatus = "pending" | "ready" | "complete" | "blocked";
export type InternalControlledUseTrialStatus = "not_started" | "in_progress" | "completed" | "blocked";

export type InternalControlledUseRunbookStep = {
  id: InternalControlledUseStepId;
  order: number;
  title: string;
  description: string;
  ownerAction: string;
  status: InternalControlledUseStepStatus;
  canRun: boolean;
  evidence: string[];
};

export type InternalControlledUseTrial = {
  kind: "internal_controlled_use_trial";
  schemaVersion: 1;
  id: "spark_of_hope_first_trial";
  appName: "Spark of Hope Intake Lite";
  appSlug: "spark-of-hope-intake-lite";
  status: InternalControlledUseTrialStatus;
  updatedAt: string;
  completedAt: string | null;
  sparkReviewItem: SparkReviewQueueItem | null;
  orchestratorRunId: string | null;
  preparedHandoffId: string | null;
  exportedHandoffId: string | null;
  projectMemoryUpdatedAt: string | null;
  auditReviewedAt: string | null;
  evidence: string[];
  guardrails: {
    noProductionDeploy: true;
    noPaidResources: true;
    noLiveMigrations: true;
    noSecretsOrEnvChanges: true;
    repositoryVisibilityUnchanged: true;
    noCodexAutoExecution: true;
    noGitHubIssueCreation: true;
    noLabelChanges: true;
  };
};

export type InternalControlledUseRunbook = {
  kind: "internal_controlled_use_runbook";
  schemaVersion: 1;
  generatedAt: string;
  ownerReadableSummary: string;
  currentStatus: InternalControlledUseTrialStatus;
  internalTrialCompleted: boolean;
  nextStep: InternalControlledUseRunbookStep | null;
  steps: InternalControlledUseRunbookStep[];
  trial: InternalControlledUseTrial;
  guardrails: InternalControlledUseTrial["guardrails"];
};

export type InternalControlledUseRunbookPayload = {
  runbook: InternalControlledUseRunbook;
  projectMemory: ProjectMemory;
  handoffs: HandoffRelaySummary[];
  orchestratorRuns: OrchestratorRun[];
  orchestratorActionQueue: OrchestratorActionQueueItem[];
  auditTrailReport: AuditTrailOwnerVisibilityReport;
  exportOutput?: OrchestratorApprovedHandoffExport;
  storage: "adapter_local_mock";
};

type InternalControlledUseTrialStore = {
  trials: InternalControlledUseTrial[];
};

const stateAdapter = getAppEngineStateAdapter();

export async function loadInternalControlledUseRunbook(now = new Date()): Promise<InternalControlledUseRunbookPayload> {
  const [trial, projectMemory, handoffs, orchestratorRuns, orchestratorActionQueue, auditTrailReport] = await Promise.all([
    loadSparkInternalTrial(now),
    loadProjectMemory(),
    listHandoffRelaySummaries(),
    listOrchestratorRuns(),
    listOrchestratorActionQueue(),
    loadAuditTrailOwnerVisibilityReport()
  ]);

  return {
    runbook: createInternalControlledUseRunbook(trial, now),
    projectMemory,
    handoffs,
    orchestratorRuns,
    orchestratorActionQueue,
    auditTrailReport,
    storage: "adapter_local_mock"
  };
}

export async function runInternalControlledUseStep(
  stepId: InternalControlledUseStepId,
  now = new Date()
): Promise<InternalControlledUseRunbookPayload> {
  const current = await loadSparkInternalTrial(now);
  const steps = createInternalControlledUseRunbook(current, now).steps;
  const step = steps.find((candidate) => candidate.id === stepId);

  if (!step) throw new Error(`Unknown internal controlled-use step: ${stepId}`);
  if (!step.canRun) throw new Error(`${step.title} is not ready yet. Complete the earlier steps first.`);

  let trial = current;
  let exportOutput: OrchestratorApprovedHandoffExport | undefined;

  if (stepId === "submit_spark_test_story") {
    trial = await submitSparkTestStoryStep(current, now);
  } else if (stepId === "review_spark_story") {
    trial = await reviewSparkStoryStep(current, now);
  } else if (stepId === "approve_spark_preview") {
    trial = await approveSparkPreviewStep(current, now);
  } else if (stepId === "run_orchestrator_next_safe_step") {
    trial = await runOrchestratorStep(current, now);
  } else if (stepId === "prepare_export_handoff") {
    const result = await prepareExportHandoffStep(current, now);
    trial = result.trial;
    exportOutput = result.exportOutput;
  } else if (stepId === "update_project_memory") {
    trial = await updateMemoryStep(current, now);
  } else if (stepId === "review_audit_trail") {
    trial = await reviewAuditTrailStep(current, now);
  }

  const payload = await loadInternalControlledUseRunbook(now);

  return {
    ...payload,
    exportOutput
  };
}

export function createInternalControlledUseRunbook(trial: InternalControlledUseTrial, now = new Date()): InternalControlledUseRunbook {
  const steps = createSteps(trial);
  const nextStep = steps.find((step) => step.status === "ready") || null;

  return {
    kind: "internal_controlled_use_runbook",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    ownerReadableSummary: trial.completedAt
      ? "Spark of Hope completed the first internal controlled-use flow. AppEngine has evidence for intake, review, preview approval, orchestrator handoff, memory update, and audit review."
      : nextStep
        ? `Spark of Hope internal controlled-use trial is ready for: ${nextStep.title}.`
        : "Spark of Hope internal controlled-use trial is waiting for earlier evidence before continuing.",
    currentStatus: trial.status,
    internalTrialCompleted: Boolean(trial.completedAt),
    nextStep,
    steps,
    trial,
    guardrails: defaultGuardrails()
  };
}

async function submitSparkTestStoryStep(trial: InternalControlledUseTrial, now: Date) {
  const reference = `SOH-INTERNAL-${now.getTime().toString(36)}`;
  const result = await submitStoryIntake(
    {
      preferredName: "Internal preview tester",
      storyTitle: "A small spark of hope",
      categoryOrStruggle: "Discouragement",
      hopeOutcome: "A clear next step toward hope",
      storyBody:
        "This is a safe internal test story for AppEngine controlled use. It proves the intake flow can receive a hopeful story without storing private production data or sending notifications.",
      mayReview: true,
      mayContact: false,
      mayPrepareEncouragement: true
    },
    {
      env: {
        ...process.env,
        SPARK_INTAKE_MODE: "preview_mock"
      },
      reference,
      now
    }
  );

  if (!result.body.ok) {
    throw new Error(result.body.message || "Spark test story intake failed.");
  }

  const item = createSparkReviewQueueItem({
    reference: result.body.reference,
    preferredName: result.body.received?.preferredName,
    storyTitle: result.body.received?.storyTitle,
    categoryOrStruggle: result.body.received?.categoryOrStruggle,
    hopeOutcome: result.body.received?.hopeOutcome,
    submittedAt: now.toISOString()
  });

  await getAppEngineAuditTrail().append(
    {
      type: "intake_submitted",
      actor: { type: "owner", id: "internal-controlled-use" },
      subjectId: item.safeIdentifier,
      summary: "Spark internal test story submitted in preview mock mode.",
      metadata: {
        app: trial.appSlug,
        stored: result.body.stored,
        mode: result.body.mode,
        reviewStatus: result.body.reviewStatus || "not_started"
      }
    },
    now
  );

  return saveTrial({
    ...trial,
    status: "in_progress",
    updatedAt: now.toISOString(),
    sparkReviewItem: item,
    evidence: mergeEvidence(trial.evidence, [
      `Submitted Spark test story ${item.safeIdentifier} in preview mock mode.`,
      "No production data, email, notification, migration, or paid resource was touched."
    ])
  });
}

async function reviewSparkStoryStep(trial: InternalControlledUseTrial, now: Date) {
  if (!trial.sparkReviewItem) throw new Error("Submit the Spark test story before reviewing it.");

  const reviewed = updateSparkReviewQueueFollowUp(updateSparkReviewQueueStatus(trial.sparkReviewItem, "needs_review"), {
    followUpNotes: "Internal controlled-use review checked consent, safety language, preview boundaries, and no private data exposure.",
    recommendedNextStep: "Approve this safe internal test item for preview evidence only."
  });

  await getAppEngineAuditTrail().append(
    {
      type: "spark_item_reviewed",
      actor: { type: "owner", id: "internal-controlled-use" },
      subjectId: reviewed.safeIdentifier,
      summary: "Spark internal test story reviewed for controlled-use safety.",
      metadata: {
        status: reviewed.status,
        publicSharing: false,
        mentorMatching: false
      }
    },
    now
  );

  return saveTrial({
    ...trial,
    status: "in_progress",
    updatedAt: now.toISOString(),
    sparkReviewItem: reviewed,
    evidence: mergeEvidence(trial.evidence, [`Reviewed Spark test story ${reviewed.safeIdentifier} for safe preview boundaries.`])
  });
}

async function approveSparkPreviewStep(trial: InternalControlledUseTrial, now: Date) {
  if (!trial.sparkReviewItem) throw new Error("Review the Spark test story before approving it for preview.");

  const approved = updateSparkReviewQueueFollowUp(updateSparkReviewQueueStatus(trial.sparkReviewItem, "approved_for_preview"), {
    followUpNotes: "Approved for owner-visible preview evidence only. This does not publish a story publicly.",
    recommendedNextStep: "Run the Manual Orchestrator next safe step from updated AppEngine state."
  });

  await getAppEngineAuditTrail().append(
    {
      type: "spark_item_reviewed",
      actor: { type: "owner", id: "internal-controlled-use" },
      subjectId: approved.safeIdentifier,
      summary: "Spark internal test story approved for preview evidence only.",
      metadata: {
        status: approved.status,
        publicPublishing: false,
        privateDataExposed: false
      }
    },
    now
  );

  return saveTrial({
    ...trial,
    status: "in_progress",
    updatedAt: now.toISOString(),
    sparkReviewItem: approved,
    evidence: mergeEvidence(trial.evidence, [`Approved Spark test story ${approved.safeIdentifier} for preview evidence only.`])
  });
}

async function runOrchestratorStep(trial: InternalControlledUseTrial, now: Date) {
  const [projectMemory, handoffs, trials] = await Promise.all([loadProjectMemory(), listHandoffRelaySummaries(), listRealProjectTrials()]);
  const run = await saveOrchestratorRun({ projectMemory, handoffs, trials });
  await updateProjectMemoryFromOrchestratorRun(run);

  await getAppEngineAuditTrail().append(
    {
      type: "orchestrator_action_queued",
      actor: { type: "system", id: "manual-orchestrator" },
      subjectId: run.id,
      summary: `Manual Orchestrator selected ${run.selectedNextSafeAction.replace(/_/g, " ")} for owner review.`,
      metadata: {
        status: run.status,
        action: run.selectedNextSafeAction,
        queueItems: run.actionQueue.items.length
      }
    },
    now
  );

  return saveTrial({
    ...trial,
    status: "in_progress",
    updatedAt: now.toISOString(),
    orchestratorRunId: run.id,
    evidence: mergeEvidence(trial.evidence, [`Ran Manual Orchestrator and queued ${run.selectedNextSafeAction.replace(/_/g, " ")}.`])
  });
}

async function prepareExportHandoffStep(trial: InternalControlledUseTrial, now: Date) {
  if (!trial.orchestratorRunId) throw new Error("Run the Manual Orchestrator before preparing a handoff.");

  const runs = await listOrchestratorRuns();
  const run = runs.find((candidate) => candidate.id === trial.orchestratorRunId);
  if (!run) throw new Error("The stored orchestrator run could not be found.");

  const handoff = await savePreparedHandoffFromOrchestratorRun(run);
  const queuedAction = await markOrchestratorActionPreparedHandoff(run.id, now);
  if (queuedAction) await updateProjectMemoryFromOrchestratorAction(queuedAction);
  const exportOutput = await approveAndExportPreparedHandoff(handoff.id, now);

  await getAppEngineAuditTrail().append(
    {
      type: "handoff_prepared",
      actor: { type: "system", id: "handoff-relay" },
      subjectId: handoff.id,
      summary: "Prepared internal controlled-use Codex handoff for owner review.",
      metadata: {
        sourceRunId: run.id,
        mergeStatus: handoff.extracted.mergeStatus,
        codexTriggered: false
      }
    },
    now
  );
  await getAppEngineAuditTrail().append(
    {
      type: "orchestrator_action_exported",
      actor: { type: "owner", id: "internal-controlled-use" },
      subjectId: exportOutput.id,
      summary: "Owner-approved handoff export created for copy-only controlled use.",
      metadata: {
        handoffId: handoff.id,
        codexTriggered: false,
        githubIssuesCreated: false,
        labelsApplied: false
      }
    },
    now
  );

  return {
    exportOutput,
    trial: await saveTrial({
      ...trial,
      status: "in_progress",
      updatedAt: now.toISOString(),
      preparedHandoffId: handoff.id,
      exportedHandoffId: exportOutput.id,
      evidence: mergeEvidence(trial.evidence, [
        `Prepared handoff ${handoff.id} from orchestrator run ${run.id}.`,
        `Exported owner-approved copy-only handoff ${exportOutput.id}.`
      ])
    })
  };
}

async function updateMemoryStep(trial: InternalControlledUseTrial, now: Date) {
  const memory = await addProjectMemoryFeedback({
    choices: ["important_decision", "lesson_learned", "keep_doing_this"],
    note:
      "Internal controlled use trial for Spark of Hope reached intake, review, preview approval, orchestrator handoff, and export through adapter-backed stores.",
    sourceHandoffId: trial.preparedHandoffId
  });

  return saveTrial({
    ...trial,
    status: "in_progress",
    updatedAt: now.toISOString(),
    projectMemoryUpdatedAt: memory.updatedAt,
    evidence: mergeEvidence(trial.evidence, ["Updated Project Memory with internal controlled-use trial evidence."])
  });
}

async function reviewAuditTrailStep(trial: InternalControlledUseTrial, now: Date) {
  const report = await loadAuditTrailOwnerVisibilityReport();
  if (!report.events.length) throw new Error("No audit events are visible yet. Complete earlier controlled-use steps first.");

  return saveTrial({
    ...trial,
    status: "completed",
    updatedAt: now.toISOString(),
    completedAt: now.toISOString(),
    auditReviewedAt: now.toISOString(),
    evidence: mergeEvidence(trial.evidence, [`Reviewed ${report.events.length} owner-visible audit event(s).`])
  });
}

async function loadSparkInternalTrial(now: Date) {
  const store = await readTrialStore();
  const existing = store.trials.find((trial) => trial.id === "spark_of_hope_first_trial");
  return existing ? normalizeTrial(existing, now) : createEmptyTrial(now);
}

async function saveTrial(trial: InternalControlledUseTrial) {
  const store = await readTrialStore();
  const normalized = normalizeTrial(trial, new Date(trial.updatedAt));
  const nextTrials = [normalized, ...store.trials.filter((candidate) => candidate.id !== normalized.id)];
  await stateAdapter.writeJson<InternalControlledUseTrialStore>({ kind: "internal_controlled_use_trials" }, { trials: nextTrials });
  return normalized;
}

async function readTrialStore() {
  const store = await stateAdapter.readJson<InternalControlledUseTrialStore | null>({ kind: "internal_controlled_use_trials" }, null);

  return {
    trials: Array.isArray(store?.trials) ? store.trials.map((trial) => normalizeTrial(trial, new Date())) : []
  };
}

function createSteps(trial: InternalControlledUseTrial): InternalControlledUseRunbookStep[] {
  const submitted = Boolean(trial.sparkReviewItem);
  const reviewed = Boolean(trial.sparkReviewItem && trial.sparkReviewItem.status !== "new");
  const approved = trial.sparkReviewItem?.status === "approved_for_preview";
  const orchestrated = Boolean(trial.orchestratorRunId);
  const handedOff = Boolean(trial.preparedHandoffId && trial.exportedHandoffId);
  const memoryUpdated = Boolean(trial.projectMemoryUpdatedAt);
  const auditReviewed = Boolean(trial.auditReviewedAt);

  return [
    step("submit_spark_test_story", 1, "Submit a Spark intake/test story", "Create a safe preview mock Spark story and review queue item.", "Submit test story", submitted, true, trial, [
      trial.sparkReviewItem ? `Story ${trial.sparkReviewItem.safeIdentifier}` : ""
    ]),
    step("review_spark_story", 2, "Review the Spark story", "Review the safe queue item for consent, moderation, and no private exposure.", "Review item", reviewed, submitted, trial, [
      trial.sparkReviewItem?.status ? `Status: ${trial.sparkReviewItem.status}` : ""
    ]),
    step("approve_spark_preview", 3, "Approve it for preview", "Mark the safe item approved_for_preview without public publishing.", "Approve preview", approved, reviewed, trial, [
      approved ? "approved_for_preview" : ""
    ]),
    step("run_orchestrator_next_safe_step", 4, "Run orchestrator next safe step", "Run the Manual Orchestrator from current adapter-backed state.", "Run orchestrator", orchestrated, approved, trial, [
      trial.orchestratorRunId || ""
    ]),
    step("prepare_export_handoff", 5, "Prepare/export handoff", "Create a prepared Handoff Inbox entry and owner-approved copy-only export.", "Prepare/export", handedOff, orchestrated, trial, [
      trial.preparedHandoffId || "",
      trial.exportedHandoffId || ""
    ]),
    step("update_project_memory", 6, "Update project memory", "Record the controlled-use trial lesson in Project Memory.", "Update memory", memoryUpdated, handedOff, trial, [
      trial.projectMemoryUpdatedAt || ""
    ]),
    step("review_audit_trail", 7, "Review audit trail", "Confirm owner-visible audit events exist for the safe trial.", "Review audit", auditReviewed, memoryUpdated, trial, [
      trial.auditReviewedAt || ""
    ])
  ];
}

function step(
  id: InternalControlledUseStepId,
  order: number,
  title: string,
  description: string,
  ownerAction: string,
  complete: boolean,
  prerequisiteMet: boolean,
  trial: InternalControlledUseTrial,
  evidence: string[]
): InternalControlledUseRunbookStep {
  const status: InternalControlledUseStepStatus = complete ? "complete" : prerequisiteMet ? "ready" : trial.status === "blocked" ? "blocked" : "pending";

  return {
    id,
    order,
    title,
    description,
    ownerAction,
    status,
    canRun: status === "ready",
    evidence: evidence.filter(Boolean)
  };
}

function createEmptyTrial(now: Date): InternalControlledUseTrial {
  return {
    kind: "internal_controlled_use_trial",
    schemaVersion: 1,
    id: "spark_of_hope_first_trial",
    appName: "Spark of Hope Intake Lite",
    appSlug: "spark-of-hope-intake-lite",
    status: "not_started",
    updatedAt: now.toISOString(),
    completedAt: null,
    sparkReviewItem: null,
    orchestratorRunId: null,
    preparedHandoffId: null,
    exportedHandoffId: null,
    projectMemoryUpdatedAt: null,
    auditReviewedAt: null,
    evidence: [],
    guardrails: defaultGuardrails()
  };
}

function normalizeTrial(trial: Partial<InternalControlledUseTrial>, now: Date): InternalControlledUseTrial {
  const empty = createEmptyTrial(now);
  const normalized = {
    ...empty,
    ...trial,
    kind: "internal_controlled_use_trial" as const,
    schemaVersion: 1 as const,
    id: "spark_of_hope_first_trial" as const,
    appName: "Spark of Hope Intake Lite" as const,
    appSlug: "spark-of-hope-intake-lite" as const,
    evidence: Array.isArray(trial.evidence) ? trial.evidence.slice(0, 30) : [],
    guardrails: defaultGuardrails()
  };

  if (normalized.completedAt) normalized.status = "completed";
  else if (normalized.sparkReviewItem || normalized.orchestratorRunId || normalized.preparedHandoffId || normalized.projectMemoryUpdatedAt) {
    normalized.status = "in_progress";
  }

  return normalized;
}

function mergeEvidence(current: string[], incoming: string[]) {
  return [...new Set([...incoming, ...current].map((item) => item.trim()).filter(Boolean))].slice(0, 30);
}

function defaultGuardrails(): InternalControlledUseTrial["guardrails"] {
  return {
    noProductionDeploy: true,
    noPaidResources: true,
    noLiveMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noCodexAutoExecution: true,
    noGitHubIssueCreation: true,
    noLabelChanges: true
  };
}
