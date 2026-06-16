import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HandoffRelaySummary } from "./handoff-relay";
import type { PendingCheckResolution } from "./pending-check-resolution";
import type { ProjectMemory } from "./project-memory";
import type { RealProjectTrialSummary } from "./real-project-trial";

export type OrchestratorRunStatus = "ready_to_run" | "ran_successfully" | "needs_owner_approval" | "blocked" | "failed_honestly";
export type OrchestratorConfidenceLevel = "low" | "medium" | "high";
export type OrchestratorActionStatus = "queued" | "prepared_handoff" | "owner_approved" | "blocked" | "completed";

export type OrchestratorDecisionTrace = {
  inputsConsidered: Array<{
    kind: string;
    status: OrchestratorInputReference["status"];
    summary: string;
  }>;
  currentProjectState: OrchestratorRun["projectStateSummary"];
  blockersFound: string[];
  selectedAction: string;
  selectionReason: string;
  confidenceLevel: OrchestratorConfidenceLevel;
  confidenceReason: string;
  evidence: string[];
  guardrailsConsidered: string[];
};

export type OrchestratorActionQueueItem = {
  id: string;
  sourceRunId: string;
  action: string;
  title: string;
  status: OrchestratorActionStatus;
  reason: string;
  ownerApprovalRequired: boolean;
  prompt: string;
  expectedOutcome: string;
  dependencies: string[];
  guardrails: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  storage: "local_mock";
};

export type OrchestratorBatchDryRun = {
  kind: "orchestrator_batch_dry_run";
  schemaVersion: 1;
  id: string;
  createdAt: string;
  status: "prepared" | "no_safe_actions";
  storage: "local_mock";
  dryRunOnly: true;
  selectionLimit: 3;
  selectedActionIds: string[];
  preparedHandoffDrafts: Array<{
    sourceActionId: string;
    sourceRunId: string;
    title: string;
    action: string;
    reason: string;
    prompt: string;
    expectedOutcome: string;
    dependencies: string[];
    guardrails: string[];
    confidenceLevel: OrchestratorConfidenceLevel;
    dryRunOnly: true;
  }>;
  skippedActions: Array<{
    actionId: string;
    status: OrchestratorActionStatus;
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
  guardrails: OrchestratorGuardrails;
};

export type OrchestratorRun = {
  kind: "orchestrator_run";
  schemaVersion: 1;
  id: string;
  createdAt: string;
  status: OrchestratorRunStatus;
  selectedNextSafeAction: string;
  reason: string;
  projectStateSummary: {
    currentState: string;
    latestProgress: string;
    currentBlockers: string[];
    recommendedNextAction: string;
  };
  inputArtifacts: {
    projectMemory: OrchestratorInputReference;
    handoffRelaySummary: OrchestratorInputReference;
    realProjectTrial: OrchestratorInputReference;
    designIntentProfile: OrchestratorInputReference;
    appPortfolioRegistry: OrchestratorInputReference;
    pendingCheckResolution: OrchestratorInputReference;
  };
  decisionTrace: OrchestratorDecisionTrace;
  actionQueue: {
    kind: "orchestrator_action_queue";
    schemaVersion: 1;
    storage: "local_mock";
    items: OrchestratorActionQueueItem[];
    ownerReadableSummary: string;
    guardrails: OrchestratorGuardrails;
  };
  nextActionPrompt: {
    prompt: string;
    reason: string;
    expectedOutcome: string;
    dependencies: string[];
  };
  evidence: string[];
  ownerReadableSummary: string;
  guardrails: OrchestratorGuardrails;
};

export type OrchestratorInput = {
  projectMemory: ProjectMemory;
  handoffs?: HandoffRelaySummary[];
  trials?: RealProjectTrialSummary[];
  pendingCheckResolution?: PendingCheckResolution;
};

type OrchestratorInputReference = {
  kind: string;
  status: "available" | "derived" | "missing";
  summary: string;
  sourceFiles: string[];
};

type OrchestratorGuardrails = {
  manualButtonOnly: true;
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

type StoreShape = {
  runs: OrchestratorRun[];
  actionQueue: OrchestratorActionQueueItem[];
};

const storeDir = join(process.cwd(), ".app-engine");
const storePath = join(storeDir, "orchestrator-runs.json");
let memoryStore: StoreShape = { runs: [], actionQueue: [] };

export async function listOrchestratorRuns() {
  const store = await readStore();

  return store.runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listOrchestratorActionQueue() {
  const store = await readStore();

  return store.actionQueue.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createStoredOrchestratorBatchDryRun(now = new Date()) {
  const store = await readStore();

  return createOrchestratorBatchDryRun(store.actionQueue, store.runs, now);
}

export async function saveOrchestratorRun(input: OrchestratorInput) {
  const store = await readStore();
  const run = createOrchestratorRun(input);
  store.runs = [run, ...store.runs].slice(0, 50);
  store.actionQueue = mergeActionQueue(store.actionQueue, run.actionQueue.items).slice(0, 100);
  await writeStore(store);

  return run;
}

export async function updateOrchestratorActionStatus(
  actionId: string,
  status: OrchestratorActionStatus,
  now = new Date()
) {
  const store = await readStore();
  const updatedAt = now.toISOString();
  let updatedAction: OrchestratorActionQueueItem | null = null;

  store.actionQueue = store.actionQueue.map((action) => {
    if (action.id !== actionId) return action;

    updatedAction = {
      ...action,
      status,
      updatedAt,
      completedAt: status === "completed" ? updatedAt : action.completedAt
    };

    return updatedAction;
  });

  store.runs = store.runs.map((run) => ({
    ...run,
    actionQueue: {
      ...run.actionQueue,
      items: run.actionQueue.items.map((action) =>
        action.id === actionId && updatedAction
          ? {
              ...action,
              status,
              updatedAt,
              completedAt: status === "completed" ? updatedAt : action.completedAt
            }
          : action
      )
    }
  }));

  await writeStore(store);

  return updatedAction;
}

export function createOrchestratorBatchDryRun(
  actions: OrchestratorActionQueueItem[],
  runs: OrchestratorRun[] = [],
  now = new Date()
): OrchestratorBatchDryRun {
  const createdAt = now.toISOString();
  const normalizedActions = actions.map(normalizeActionQueueItem).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selectedActions = normalizedActions.filter(isSafeQueuedBatchAction).slice(0, 3);
  const selectedIds = new Set(selectedActions.map((action) => action.id));
  const runById = new Map(runs.map((run) => [run.id, run]));
  const skippedActions = normalizedActions
    .filter((action) => !selectedIds.has(action.id))
    .map((action) => ({
      actionId: action.id,
      status: action.status,
      reason:
        action.status !== "queued"
          ? `Skipped because status is ${action.status}.`
          : !action.prompt.trim()
            ? "Skipped because the queued action has no prompt to prepare."
            : selectedActions.length >= 3
              ? "Skipped because the dry-run batch limit is three actions."
              : "Skipped because the action was not considered safe for batch preparation."
    }));
  const preparedHandoffDrafts = selectedActions.map((action) => {
    const sourceRun = runById.get(action.sourceRunId);

    return {
      sourceActionId: action.id,
      sourceRunId: action.sourceRunId,
      title: `Prepared dry-run handoff: ${action.title}`,
      action: action.action,
      reason: action.reason,
      prompt: buildBatchDryRunPrompt(action),
      expectedOutcome: action.expectedOutcome,
      dependencies: action.dependencies,
      guardrails: [...action.guardrails, "Dry-run batch only. Do not execute, send, publish, label, deploy, migrate, or merge."],
      confidenceLevel: sourceRun?.decisionTrace.confidenceLevel || "medium",
      dryRunOnly: true as const
    };
  });
  const status = preparedHandoffDrafts.length ? "prepared" : "no_safe_actions";

  return {
    kind: "orchestrator_batch_dry_run",
    schemaVersion: 1,
    id: `orchestrator_batch_dry_run_${now.getTime().toString(36)}`,
    createdAt,
    status,
    storage: "local_mock",
    dryRunOnly: true,
    selectionLimit: 3,
    selectedActionIds: selectedActions.map((action) => action.id),
    preparedHandoffDrafts,
    skippedActions,
    execution: {
      codexTriggered: false,
      githubIssuesCreated: false,
      labelsApplied: false,
      productionDeployed: false,
      paidResourcesCreated: false,
      migrationsApplied: false,
      secretsOrEnvChanged: false,
      repositoryVisibilityChanged: false,
      autoMerged: false
    },
    nextSafeAction: status === "prepared" ? "owner_reviews_prepared_batch_handoffs" : "queue_safe_actions_before_batch_dry_run",
    ownerReadableSummary:
      status === "prepared"
        ? `Prepared ${preparedHandoffDrafts.length} dry-run handoff draft${preparedHandoffDrafts.length === 1 ? "" : "s"} from queued orchestrator actions. Nothing was executed.`
        : "No safe queued orchestrator actions were available for batch dry-run preparation.",
    guardrails: defaultGuardrails()
  };
}

export async function markOrchestratorActionPreparedHandoff(runId: string, now = new Date()) {
  const store = await readStore();
  const action = store.actionQueue.find((candidate) => candidate.sourceRunId === runId);

  if (!action) return null;

  return updateOrchestratorActionStatus(action.id, "prepared_handoff", now);
}

export function createOrchestratorRun(input: OrchestratorInput, now = new Date()): OrchestratorRun {
  const projectMemory = input.projectMemory;
  const latestHandoff = newest(input.handoffs || [], "receivedAt");
  const latestTrial = newest(input.trials || [], "createdAt");
  const pendingCheckResolution = input.pendingCheckResolution;
  const blockers = projectMemory.currentBlockers
    .map((item) => item.text)
    .filter((text) => text && isActionableBlocker(text))
    .slice(0, 5);
  const decision = chooseNextAction({ projectMemory, latestHandoff, latestTrial, pendingCheckResolution, blockers });
  const createdAt = now.toISOString();
  const id = `orchestrator_run_${now.getTime().toString(36)}`;
  const projectStateSummary = {
    currentState: projectMemory.latestProjectState.currentState,
    latestProgress: projectMemory.latestProjectState.latestProgress,
    currentBlockers: blockers,
    recommendedNextAction: projectMemory.latestProjectState.recommendedNextAction
  };
  const inputArtifacts = buildInputReferences({ projectMemory, latestHandoff, latestTrial, pendingCheckResolution });
  const nextActionPrompt = buildNextPrompt({ decision, projectMemory, latestHandoff, latestTrial, pendingCheckResolution });
  const decisionTrace = buildDecisionTrace({
    decision,
    projectStateSummary,
    inputArtifacts,
    blockers,
    latestHandoff,
    pendingCheckResolution
  });
  const actionQueue = buildActionQueue({ runId: id, createdAt, decision, nextActionPrompt });

  return {
    kind: "orchestrator_run",
    schemaVersion: 1,
    id,
    createdAt,
    status: decision.status,
    selectedNextSafeAction: decision.action,
    reason: decision.reason,
    projectStateSummary,
    inputArtifacts,
    decisionTrace,
    actionQueue,
    nextActionPrompt,
    evidence: decision.evidence,
    ownerReadableSummary: `AppEngine chose ${decision.action.replace(/_/g, " ")} because ${decision.reason}`,
    guardrails: defaultGuardrails()
  };
}

function buildDecisionTrace({
  decision,
  projectStateSummary,
  inputArtifacts,
  blockers,
  latestHandoff,
  pendingCheckResolution
}: {
  decision: ReturnType<typeof chooseNextAction>;
  projectStateSummary: OrchestratorRun["projectStateSummary"];
  inputArtifacts: OrchestratorRun["inputArtifacts"];
  blockers: string[];
  latestHandoff: HandoffRelaySummary | null;
  pendingCheckResolution?: PendingCheckResolution;
}): OrchestratorDecisionTrace {
  const handoffBlockers = latestHandoff?.extracted.blockers.filter(isActionableBlocker) || [];
  const blockersFound = [...blockers, ...handoffBlockers];
  const confidence = confidenceFor({ decision, inputArtifacts, blockersFound, pendingCheckResolution });

  return {
    inputsConsidered: Object.values(inputArtifacts).map((artifact) => ({
      kind: artifact.kind,
      status: artifact.status,
      summary: artifact.summary
    })),
    currentProjectState: projectStateSummary,
    blockersFound,
    selectedAction: decision.action,
    selectionReason: decision.reason,
    confidenceLevel: confidence.level,
    confidenceReason: confidence.reason,
    evidence: decision.evidence,
    guardrailsConsidered: [
      "manual button only",
      "owner approval only",
      "no Codex auto-execution",
      "no GitHub issue creation",
      "no label changes",
      "no production deploy",
      "no paid resources",
      "no migrations",
      "no secrets/env changes",
      "no repository visibility changes",
      "no generated app auto-merge"
    ]
  };
}

function buildActionQueue({
  runId,
  createdAt,
  decision,
  nextActionPrompt
}: {
  runId: string;
  createdAt: string;
  decision: ReturnType<typeof chooseNextAction>;
  nextActionPrompt: OrchestratorRun["nextActionPrompt"];
}): OrchestratorRun["actionQueue"] {
  const status: OrchestratorActionStatus = decision.status === "blocked" ? "blocked" : "queued";
  const action: OrchestratorActionQueueItem = {
    id: `orchestrator_action_${runId.replace(/^orchestrator_run_/, "")}_${hashText(decision.action)}`,
    sourceRunId: runId,
    action: decision.action,
    title: decision.action.replace(/_/g, " "),
    status,
    reason: decision.reason,
    ownerApprovalRequired: decision.status !== "ran_successfully",
    prompt: nextActionPrompt.prompt,
    expectedOutcome: nextActionPrompt.expectedOutcome,
    dependencies: nextActionPrompt.dependencies,
    guardrails: [
      "Do not trigger Codex automatically.",
      "Do not create GitHub issues.",
      "Do not apply labels.",
      "Do not deploy production.",
      "Do not create paid resources.",
      "Do not apply migrations.",
      "Do not add secrets or env vars.",
      "Do not change repository visibility.",
      "Do not auto-merge generated app code."
    ],
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
    storage: "local_mock"
  };

  return {
    kind: "orchestrator_action_queue",
    schemaVersion: 1,
    storage: "local_mock",
    items: [action],
    ownerReadableSummary:
      status === "blocked"
        ? `Action ${action.title} is blocked and must not advance until the blocker is resolved.`
        : `Action ${action.title} is queued for owner review. It will not trigger Codex or mutate GitHub automatically.`,
    guardrails: defaultGuardrails()
  };
}

function chooseNextAction({
  projectMemory,
  latestHandoff,
  latestTrial,
  pendingCheckResolution,
  blockers
}: {
  projectMemory: ProjectMemory;
  latestHandoff: HandoffRelaySummary | null;
  latestTrial: RealProjectTrialSummary | null;
  pendingCheckResolution?: PendingCheckResolution;
  blockers: string[];
}) {
  if (pendingCheckResolution) {
    if (pendingCheckResolution.status === "blocked_by_failed_check") {
      return {
        status: "blocked" as const,
        action: "fix_failed_check_before_review",
        reason: "Pending Check Resolution found a failed check, and failing checks must not be bypassed.",
        evidence: pendingCheckResolution.evidence
      };
    }

    if (pendingCheckResolution.status === "blocked_by_required_pending") {
      return {
        status: "blocked" as const,
        action: "wait_for_required_checks",
        reason: "Required or blocking checks have not passed yet.",
        evidence: pendingCheckResolution.evidence
      };
    }

    if (pendingCheckResolution.status === "waiting_for_timeout") {
      return {
        status: "needs_owner_approval" as const,
        action: "wait_for_external_pending_timeout",
        reason: "An external advisory check is still pending but has not exceeded the configured stale-check threshold.",
        evidence: pendingCheckResolution.evidence
      };
    }

    if (pendingCheckResolution.status === "review_ready_with_advisory_pending") {
      return {
        status: "needs_owner_approval" as const,
        action: "owner_review_with_advisory_pending_check",
        reason: "Required checks passed and the only unresolved signal is an external advisory status pending beyond the timeout.",
        evidence: pendingCheckResolution.evidence
      };
    }
  }

  if (blockers.length) {
    return {
      status: "blocked" as const,
      action: "resolve_current_blocker",
      reason: "Project Memory has an active blocker, so AppEngine should not start a new phase.",
      evidence: blockers
    };
  }

  const handoffBlockers = latestHandoff?.extracted.blockers.filter(isActionableBlocker) || [];

  if (handoffBlockers.length) {
    return {
      status: "blocked" as const,
      action: "resolve_handoff_blocker",
      reason: "The latest handoff contains unresolved blocker language.",
      evidence: handoffBlockers.slice(0, 5)
    };
  }

  if (latestHandoff && latestHandoff.extracted.mergeStatus !== "merged" && latestHandoff.extracted.prNumber) {
    return {
      status: "needs_owner_approval" as const,
      action: "review_open_pr_before_next_work",
      reason: `The latest handoff points to PR #${latestHandoff.extracted.prNumber}, which should stay owner-reviewed before AppEngine advances.`,
      evidence: [latestHandoff.ownerReadableSummary, latestHandoff.projectState.recommendedNextAction]
    };
  }

  if (latestTrial) {
    return {
      status: "ran_successfully" as const,
      action: "review_latest_trial_and_prepare_next_packet",
      reason: `${latestTrial.project.name} already has a real-project trial, so the safest next step is owner-reviewed packet progression.`,
      evidence: [latestTrial.ownerReadableSummary, latestTrial.nextSafeAction]
    };
  }

  const memoryNext = projectMemory.latestProjectState.recommendedNextAction;

  if (memoryNext && !/paste a handoff|start project memory/i.test(memoryNext)) {
    return {
      status: "ran_successfully" as const,
      action: "follow_project_memory_next_action",
      reason: "Project Memory already has a recorded next safe action.",
      evidence: [memoryNext, projectMemory.summaries.executive]
    };
  }

  return {
    status: "ran_successfully" as const,
    action: "create_real_project_trial",
    reason: "No blocker, open PR handoff, or recent trial was found, so the safest useful action is a real-project trial.",
    evidence: ["No active blockers found.", "No recent trial found.", "No open PR handoff requiring owner approval found."]
  };
}

function buildNextPrompt({
  decision,
  projectMemory,
  latestHandoff,
  latestTrial,
  pendingCheckResolution
}: {
  decision: ReturnType<typeof chooseNextAction>;
  projectMemory: ProjectMemory;
  latestHandoff: HandoffRelaySummary | null;
  latestTrial: RealProjectTrialSummary | null;
  pendingCheckResolution?: PendingCheckResolution;
}): OrchestratorRun["nextActionPrompt"] {
  const prompt = [
    "Proceed with the next AppEngine safe action selected by the Manual Orchestrator.",
    "",
    "Selected next safe action:",
    decision.action,
    "",
    "Why AppEngine selected it:",
    decision.reason,
    "",
    "Current project memory:",
    `- State: ${projectMemory.latestProjectState.currentState}`,
    `- Latest progress: ${projectMemory.latestProjectState.latestProgress}`,
    `- Recommended next action: ${projectMemory.latestProjectState.recommendedNextAction}`,
    "",
    "Latest handoff context:",
    latestHandoff
      ? `- ${latestHandoff.ownerReadableSummary}\n- Merge status: ${latestHandoff.extracted.mergeStatus}\n- Branch: ${latestHandoff.extracted.branch}`
      : "- No handoff relay summary is available.",
    "",
    "Latest real project trial:",
    latestTrial
      ? `- ${latestTrial.ownerReadableSummary}\n- Next safe action: ${latestTrial.nextSafeAction}\n- Recommended packet: ${latestTrial.recommendedPacketType}`
      : "- No real project trial is available.",
    "",
    "Pending check context:",
    pendingCheckResolution
      ? `- ${pendingCheckResolution.ownerReadableSummary}\n- Status: ${pendingCheckResolution.status}\n- Next safe action: ${pendingCheckResolution.nextSafeAction}`
      : "- No pending_check_resolution artifact is available.",
    "",
    "Use these existing AppEngine artifacts where possible:",
    "- project_memory",
    "- handoff_relay_summary",
    "- real_project_trial",
    "- design_intent_profile",
    "- app_portfolio_registry",
    "- pending_check_resolution when PR checks are stuck pending",
    "",
    "Guardrails:",
    "- Do not trigger Codex automatically.",
    "- Do not create GitHub issues.",
    "- Do not apply labels.",
    "- Do not deploy production.",
    "- Do not create paid resources.",
    "- Do not apply migrations.",
    "- Do not add secrets or env vars.",
    "- Do not change repository visibility.",
    "- Do not auto-merge generated app code.",
    "",
    "Expected outcome:",
    expectedOutcomeFor(decision.action)
  ].join("\n");

  return {
    prompt,
    reason: decision.reason,
    expectedOutcome: expectedOutcomeFor(decision.action),
    dependencies: [
      "source-of-truth/manual-orchestrator-run-button.md",
      "source-of-truth/project-memory-engine.md",
      "source-of-truth/handoff-relay-reducer.md",
      "source-of-truth/real-project-trial-runner.md",
      "source-of-truth/design-intent-engine.md",
      "source-of-truth/app-portfolio-registry.md",
      "source-of-truth/pending-check-resolution-policy.md"
    ]
  };
}

function buildInputReferences({
  projectMemory,
  latestHandoff,
  latestTrial,
  pendingCheckResolution
}: {
  projectMemory: ProjectMemory;
  latestHandoff: HandoffRelaySummary | null;
  latestTrial: RealProjectTrialSummary | null;
  pendingCheckResolution?: PendingCheckResolution;
}): OrchestratorRun["inputArtifacts"] {
  return {
    projectMemory: {
      kind: "project_memory",
      status: "available",
      summary: projectMemory.summaries.executive,
      sourceFiles: ["source-of-truth/project-memory-engine.md"]
    },
    handoffRelaySummary: {
      kind: "handoff_relay_summary",
      status: latestHandoff ? "available" : "missing",
      summary: latestHandoff?.ownerReadableSummary || "No pasted handoff has been captured yet.",
      sourceFiles: ["source-of-truth/handoff-relay-reducer.md"]
    },
    realProjectTrial: {
      kind: "real_project_trial",
      status: latestTrial ? "available" : "missing",
      summary: latestTrial?.ownerReadableSummary || "No real-project trial has been generated yet.",
      sourceFiles: ["source-of-truth/real-project-trial-runner.md"]
    },
    designIntentProfile: {
      kind: "design_intent_profile",
      status: "derived",
      summary: latestTrial?.designIntent || "Use AppEngine's warm, approachable, clean, practical, trustworthy default design intent.",
      sourceFiles: ["source-of-truth/design-intent-engine.md"]
    },
    appPortfolioRegistry: {
      kind: "app_portfolio_registry",
      status: "derived",
      summary: latestTrial
        ? `${latestTrial.project.name} is represented as the active portfolio candidate.`
        : "Portfolio registry should be loaded before new app or vNext packet work.",
      sourceFiles: ["source-of-truth/app-portfolio-registry.md"]
    },
    pendingCheckResolution: {
      kind: "pending_check_resolution",
      status: pendingCheckResolution ? "available" : "missing",
      summary: pendingCheckResolution?.ownerReadableSummary || "No stale/pending check resolution has been produced for this orchestrator run.",
      sourceFiles: ["source-of-truth/pending-check-resolution-policy.md"]
    }
  };
}

function expectedOutcomeFor(action: string) {
  const outcomes: Record<string, string> = {
    resolve_current_blocker: "Create or request a focused blocker-resolution step before new work proceeds.",
    resolve_handoff_blocker: "Create or request a focused handoff blocker fix before new work proceeds.",
    review_open_pr_before_next_work: "Owner reviews the open PR and decides whether it is ready before AppEngine advances.",
    review_latest_trial_and_prepare_next_packet: "Owner reviews the latest trial and prepares the correct packet path without starting implementation.",
    follow_project_memory_next_action: "Carry out the next Project Memory action in owner-review mode only.",
    create_real_project_trial: "Generate a real-project trial summary before packet or build work.",
    fix_failed_check_before_review: "Fix the failed check before review or merge decisions continue.",
    wait_for_required_checks: "Wait for required checks to pass or create a focused check-resolution task.",
    wait_for_external_pending_timeout: "Wait until the advisory external pending status crosses the configured timeout.",
    owner_review_with_advisory_pending_check: "Owner may review the PR with the stale external status clearly marked advisory, but AppEngine must not auto-merge."
  };

  return outcomes[action] || "Produce the next owner-reviewed AppEngine action without external side effects.";
}

function confidenceFor({
  decision,
  inputArtifacts,
  blockersFound,
  pendingCheckResolution
}: {
  decision: ReturnType<typeof chooseNextAction>;
  inputArtifacts: OrchestratorRun["inputArtifacts"];
  blockersFound: string[];
  pendingCheckResolution?: PendingCheckResolution;
}): { level: OrchestratorConfidenceLevel; reason: string } {
  if (decision.status === "blocked") {
    return {
      level: "high",
      reason: blockersFound.length || pendingCheckResolution ? "The decision is based on explicit blocker evidence." : "The orchestrator selected a blocked state."
    };
  }

  if (decision.status === "needs_owner_approval") {
    return {
      level: "high",
      reason: "The decision preserves owner review before any external action can happen."
    };
  }

  if (decision.action === "create_real_project_trial") {
    return {
      level: "medium",
      reason: "The decision is useful and safe, but it depends on missing context being filled by the next owner-reviewed step."
    };
  }

  return {
    level: "high",
    reason: "The decision is supported by current Project Memory and available AppEngine artifacts."
  };
}

function mergeActionQueue(existing: OrchestratorActionQueueItem[], incoming: OrchestratorActionQueueItem[]) {
  const byId = new Map<string, OrchestratorActionQueueItem>();

  for (const action of [...incoming, ...existing]) {
    byId.set(action.id, normalizeActionQueueItem(action));
  }

  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function newest<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return (
    [...items].sort((a, b) => String(b[key] || "").localeCompare(String(a[key] || "")))[0] ||
    null
  ) as T | null;
}

function isActionableBlocker(value: string) {
  const text = value.toLowerCase();
  const guardrailOnly = [
    "production remains blocked",
    "production blocked",
    "paid resources remain blocked",
    "real migrations remain review-gated",
    "migrations remain blocked",
    "no production deploy",
    "no paid resources",
    "no migrations",
    "no secrets",
    "no env changes",
    "no auto-merge",
    "guardrail",
    "what changed:",
    "project memory has an active blocker"
  ];

  if (guardrailOnly.some((phrase) => text.includes(phrase))) return false;

  return true;
}

function defaultGuardrails(): OrchestratorGuardrails {
  return {
    manualButtonOnly: true,
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

async function readStore(): Promise<StoreShape> {
  if (process.env.VERCEL === "1") return memoryStore;

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;

    return {
      runs: Array.isArray(parsed.runs) ? parsed.runs.map(normalizeRun).filter(isOrchestratorRun) : [],
      actionQueue: Array.isArray(parsed.actionQueue) ? parsed.actionQueue.map(normalizeActionQueueItem) : []
    };
  } catch {
    return { runs: [], actionQueue: [] };
  }
}

async function writeStore(store: StoreShape) {
  if (process.env.VERCEL === "1") {
    memoryStore = store;
    return;
  }

  await mkdir(storeDir, { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function normalizeRun(value: unknown): OrchestratorRun | null {
  if (!value || typeof value !== "object") return null;
  const run = value as OrchestratorRun;
  if (run.kind !== "orchestrator_run" || !run.id || !run.createdAt) return null;

  return {
    ...run,
    status: isRunStatus(run.status) ? run.status : "failed_honestly",
    decisionTrace: normalizeDecisionTrace(run),
    actionQueue: normalizeRunActionQueue(run),
    guardrails: defaultGuardrails()
  };
}

function isOrchestratorRun(value: OrchestratorRun | null): value is OrchestratorRun {
  return Boolean(value);
}

function isRunStatus(value: string): value is OrchestratorRunStatus {
  return ["ready_to_run", "ran_successfully", "needs_owner_approval", "blocked", "failed_honestly"].includes(value);
}

function normalizeDecisionTrace(run: OrchestratorRun): OrchestratorDecisionTrace {
  if (run.decisionTrace?.selectedAction) {
    return {
      ...run.decisionTrace,
      confidenceLevel: isConfidenceLevel(run.decisionTrace.confidenceLevel) ? run.decisionTrace.confidenceLevel : "medium",
      guardrailsConsidered: Array.isArray(run.decisionTrace.guardrailsConsidered)
        ? run.decisionTrace.guardrailsConsidered
        : []
    };
  }

  return {
    inputsConsidered: Object.values(run.inputArtifacts || {}).map((artifact) => ({
      kind: artifact.kind,
      status: artifact.status,
      summary: artifact.summary
    })),
    currentProjectState: run.projectStateSummary,
    blockersFound: run.status === "blocked" ? run.evidence : run.projectStateSummary.currentBlockers,
    selectedAction: run.selectedNextSafeAction,
    selectionReason: run.reason,
    confidenceLevel: "medium",
    confidenceReason: "Legacy run normalized without an original decision trace.",
    evidence: run.evidence,
    guardrailsConsidered: []
  };
}

function normalizeRunActionQueue(run: OrchestratorRun): OrchestratorRun["actionQueue"] {
  if (run.actionQueue?.kind === "orchestrator_action_queue") {
    return {
      ...run.actionQueue,
      storage: "local_mock",
      items: Array.isArray(run.actionQueue.items) ? run.actionQueue.items.map(normalizeActionQueueItem) : [],
      guardrails: defaultGuardrails()
    };
  }

  return buildActionQueue({
    runId: run.id,
    createdAt: run.createdAt,
    decision: {
      status:
        run.status === "blocked"
          ? "blocked"
          : run.status === "needs_owner_approval"
            ? "needs_owner_approval"
            : "ran_successfully",
      action: run.selectedNextSafeAction,
      reason: run.reason,
      evidence: run.evidence
    },
    nextActionPrompt: run.nextActionPrompt
  });
}

function normalizeActionQueueItem(value: unknown): OrchestratorActionQueueItem {
  const action = value as Partial<OrchestratorActionQueueItem>;
  const createdAt = action.createdAt || new Date(0).toISOString();

  return {
    id: action.id || `orchestrator_action_${hashText(`${action.sourceRunId}:${action.action}:${createdAt}`)}`,
    sourceRunId: action.sourceRunId || "unknown_orchestrator_run",
    action: action.action || "unknown_next_safe_action",
    title: action.title || String(action.action || "unknown next safe action").replace(/_/g, " "),
    status: isActionStatus(action.status || "") ? (action.status as OrchestratorActionStatus) : "queued",
    reason: action.reason || "No action reason was recorded.",
    ownerApprovalRequired: Boolean(action.ownerApprovalRequired),
    prompt: action.prompt || "",
    expectedOutcome: action.expectedOutcome || "Review this queued action before any external work proceeds.",
    dependencies: Array.isArray(action.dependencies) ? action.dependencies : [],
    guardrails: Array.isArray(action.guardrails) ? action.guardrails : [],
    createdAt,
    updatedAt: action.updatedAt || createdAt,
    completedAt: action.completedAt || null,
    storage: "local_mock"
  };
}

function isSafeQueuedBatchAction(action: OrchestratorActionQueueItem) {
  return action.status === "queued" && Boolean(action.prompt.trim());
}

function buildBatchDryRunPrompt(action: OrchestratorActionQueueItem) {
  return [
    action.prompt,
    "",
    "Batch dry-run wrapper:",
    "- This is a prepared handoff draft only.",
    "- Do not trigger Codex automatically.",
    "- Do not create GitHub issues.",
    "- Do not apply labels.",
    "- Do not deploy production.",
    "- Do not create paid resources.",
    "- Do not apply migrations.",
    "- Do not add secrets or env vars.",
    "- Do not change repository visibility.",
    "- Do not auto-merge generated app code.",
    "",
    "Dry-run expected outcome:",
    action.expectedOutcome
  ].join("\n");
}

function isActionStatus(value: string): value is OrchestratorActionStatus {
  return ["queued", "prepared_handoff", "owner_approved", "blocked", "completed"].includes(value);
}

function isConfidenceLevel(value: string): value is OrchestratorConfidenceLevel {
  return ["low", "medium", "high"].includes(value);
}

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}
