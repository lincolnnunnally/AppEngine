import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  BuildExecutionBuilderHandoffExport,
  BuildExecutionBuilderResultIntake,
  BuildLoopCompletionDashboard,
  BuildExecutionRequestRecord
} from "./build-execution-request";
import type { FirstRealBuildLoopRunRecord } from "./first-real-build-loop-run";
import type { FirstEcosystemBuildPacketDraftRecord } from "./first-ecosystem-build-packet-draft";
import type { HandoffRelaySummary, OrchestratorApprovedHandoffExport } from "./handoff-relay";
import type { OpportunityBuildPacketBridgeRecord } from "./opportunity-build-packet-bridge";
import type { OpportunityFullLoopTrialRecord } from "./opportunity-full-loop-trial";
import type { OrchestratorActionQueueItem, OrchestratorRun } from "./orchestrator-run";
import { createAdapterReadyStore } from "./persistence-adapter-readiness.ts";
import type { RealOpportunityExampleRunRecord } from "./real-opportunity-example-runner";
import type { RealOpportunityResultReviewRecord } from "./real-opportunity-result-review";
import type { TrialResultReview } from "./real-project-trial";

export type ProjectMemoryFeedbackChoice =
  | "important_decision"
  | "lesson_learned"
  | "bad_direction"
  | "keep_doing_this"
  | "future_improvement";

export type ProjectMemoryItemCategory =
  | "major_decision"
  | "accepted_approach"
  | "rejected_approach"
  | "completed_milestone"
  | "current_blocker"
  | "open_question"
  | "architecture_decision"
  | "design_preference"
  | "lesson_learned"
  | "future_improvement"
  | "progress";

export type ProjectMemoryItem = {
  id: string;
  category: ProjectMemoryItemCategory;
  text: string;
  source: "handoff" | "owner_feedback" | "system";
  sourceHandoffId: string | null;
  createdAt: string;
  tags: string[];
};

export type ProjectMemory = {
  kind: "project_memory";
  schemaVersion: 1;
  projectName: "AppEngine";
  updatedAt: string;
  latestProjectState: {
    currentState: string;
    latestProgress: string;
    recommendedNextAction: string;
    lastHandoffId: string | null;
  };
  majorDecisions: ProjectMemoryItem[];
  acceptedApproaches: ProjectMemoryItem[];
  rejectedApproaches: ProjectMemoryItem[];
  completedMilestones: ProjectMemoryItem[];
  currentBlockers: ProjectMemoryItem[];
  openQuestions: ProjectMemoryItem[];
  architectureDecisions: ProjectMemoryItem[];
  designPreferences: ProjectMemoryItem[];
  lessonsLearned: ProjectMemoryItem[];
  futureImprovements: ProjectMemoryItem[];
  progressHistory: ProjectMemoryItem[];
  ownerFeedback: ProjectMemoryItem[];
  summaries: {
    executive: string;
    technical: string;
    projectStatus: string;
  };
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

type StoreShape = {
  memory: ProjectMemory;
};

const storeDir = join(process.cwd(), ".app-engine");
const storePath = join(storeDir, "project-memory.json");
let memoryStore: StoreShape = { memory: createEmptyProjectMemory() };
const projectMemoryStateStore = createAdapterReadyStore<StoreShape | null>("project_memory");

export async function loadProjectMemory() {
  const store = await readStore();
  return normalizeProjectMemory(store.memory);
}

export async function updateProjectMemoryFromHandoff(handoff: HandoffRelaySummary) {
  const current = await loadProjectMemory();
  const handoffItems = buildItemsFromHandoff(handoff);
  const next: ProjectMemory = {
    ...current,
    updatedAt: handoff.receivedAt,
    latestProjectState: {
      currentState: handoff.projectState.currentStatus,
      latestProgress: handoff.projectState.latestCompletedMilestone,
      recommendedNextAction: handoff.projectState.recommendedNextAction,
      lastHandoffId: handoff.id
    },
    majorDecisions: mergeItems(current.majorDecisions, handoffItems.majorDecisions),
    acceptedApproaches: mergeItems(current.acceptedApproaches, handoffItems.acceptedApproaches),
    rejectedApproaches: mergeItems(current.rejectedApproaches, handoffItems.rejectedApproaches),
    completedMilestones: mergeItems(current.completedMilestones, handoffItems.completedMilestones),
    currentBlockers: handoffItems.currentBlockers.length ? handoffItems.currentBlockers : [],
    openQuestions: mergeItems(current.openQuestions, handoffItems.openQuestions),
    architectureDecisions: mergeItems(current.architectureDecisions, handoffItems.architectureDecisions),
    designPreferences: mergeItems(current.designPreferences, handoffItems.designPreferences),
    lessonsLearned: mergeItems(current.lessonsLearned, handoffItems.lessonsLearned),
    futureImprovements: current.futureImprovements,
    progressHistory: mergeItems(current.progressHistory, handoffItems.progressHistory, 30),
    ownerFeedback: current.ownerFeedback,
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function addProjectMemoryFeedback({
  choices,
  note,
  sourceHandoffId
}: {
  choices: ProjectMemoryFeedbackChoice[];
  note: string;
  sourceHandoffId?: string | null;
}) {
  const current = await loadProjectMemory();
  const safeChoices = choices.filter(isProjectMemoryFeedbackChoice);
  const safeNote = note.trim().slice(0, 1200);

  if (!safeChoices.length && !safeNote) {
    throw new Error("Add a memory feedback choice or note first.");
  }

  const createdAt = new Date().toISOString();
  const feedbackItems = buildItemsFromFeedback({ choices: safeChoices, note: safeNote, sourceHandoffId: sourceHandoffId || null, createdAt });
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    majorDecisions: mergeItems(current.majorDecisions, feedbackItems.majorDecisions),
    acceptedApproaches: mergeItems(current.acceptedApproaches, feedbackItems.acceptedApproaches),
    rejectedApproaches: mergeItems(current.rejectedApproaches, feedbackItems.rejectedApproaches),
    lessonsLearned: mergeItems(current.lessonsLearned, feedbackItems.lessonsLearned),
    futureImprovements: mergeItems(current.futureImprovements, feedbackItems.futureImprovements),
    ownerFeedback: mergeItems(current.ownerFeedback, feedbackItems.ownerFeedback, 30),
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromTrialReview(review: TrialResultReview) {
  const current = await loadProjectMemory();
  const createdAt = review.createdAt;
  const memoryItems = buildItemsFromTrialReview(review);
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState: `${review.project.name} trial reviewed as ${review.reviewStatus.replace(/_/g, " ")}`,
      latestProgress: review.ownerReadableSummary,
      recommendedNextAction: review.nextPrompt.expectedOutcome,
      lastHandoffId: current.latestProjectState.lastHandoffId
    },
    majorDecisions: mergeItems(current.majorDecisions, memoryItems.majorDecisions),
    acceptedApproaches: mergeItems(current.acceptedApproaches, memoryItems.acceptedApproaches),
    rejectedApproaches: mergeItems(current.rejectedApproaches, memoryItems.rejectedApproaches),
    completedMilestones: mergeItems(current.completedMilestones, memoryItems.completedMilestones),
    currentBlockers: memoryItems.currentBlockers.length ? memoryItems.currentBlockers : current.currentBlockers,
    openQuestions: mergeItems(current.openQuestions, memoryItems.openQuestions),
    designPreferences: mergeItems(current.designPreferences, memoryItems.designPreferences),
    lessonsLearned: mergeItems(current.lessonsLearned, memoryItems.lessonsLearned),
    futureImprovements: mergeItems(current.futureImprovements, memoryItems.futureImprovements),
    progressHistory: mergeItems(current.progressHistory, memoryItems.progressHistory, 30),
    ownerFeedback: mergeItems(current.ownerFeedback, memoryItems.ownerFeedback, 30),
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromOrchestratorRun(run: OrchestratorRun) {
  const current = await loadProjectMemory();
  const createdAt = run.createdAt;
  const memoryItems = buildItemsFromOrchestratorRun(run);
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState: `Manual orchestrator ${run.status.replace(/_/g, " ")}`,
      latestProgress: run.ownerReadableSummary,
      recommendedNextAction: run.nextActionPrompt.expectedOutcome,
      lastHandoffId: current.latestProjectState.lastHandoffId
    },
    majorDecisions: mergeItems(current.majorDecisions, memoryItems.majorDecisions),
    acceptedApproaches: mergeItems(current.acceptedApproaches, memoryItems.acceptedApproaches),
    rejectedApproaches: current.rejectedApproaches,
    completedMilestones: mergeItems(current.completedMilestones, memoryItems.completedMilestones),
    currentBlockers: memoryItems.currentBlockers.length ? memoryItems.currentBlockers : current.currentBlockers,
    openQuestions: mergeItems(current.openQuestions, memoryItems.openQuestions),
    architectureDecisions: current.architectureDecisions,
    designPreferences: mergeItems(current.designPreferences, memoryItems.designPreferences),
    lessonsLearned: mergeItems(current.lessonsLearned, memoryItems.lessonsLearned),
    futureImprovements: mergeItems(current.futureImprovements, memoryItems.futureImprovements),
    progressHistory: mergeItems(current.progressHistory, memoryItems.progressHistory, 30),
    ownerFeedback: current.ownerFeedback,
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromOrchestratorAction(action: OrchestratorActionQueueItem) {
  const current = await loadProjectMemory();
  const createdAt = action.updatedAt;
  const completed = action.status === "completed";
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      ...current.latestProjectState,
      currentState: completed ? "Orchestrator action completed" : `Orchestrator action ${action.status.replace(/_/g, " ")}`,
      latestProgress: `${action.title} is ${action.status.replace(/_/g, " ")}.`,
      recommendedNextAction: completed
        ? "Run the Manual Orchestrator again to choose the next safe action from updated Project Memory."
        : action.expectedOutcome
    },
    completedMilestones: completed
      ? mergeItems(
          current.completedMilestones,
          [item("completed_milestone", `Completed queued orchestrator action: ${action.title}.`, null, createdAt, ["orchestrator-action-queue"], "system")]
        )
      : current.completedMilestones,
    futureImprovements: completed
      ? current.futureImprovements
      : mergeItems(
          current.futureImprovements,
          [item("future_improvement", `Queued orchestrator action: ${action.title}.`, null, createdAt, ["orchestrator-action-queue"], "system")]
        ),
    progressHistory: mergeItems(
      current.progressHistory,
      [
        item(
          "progress",
          `Orchestrator action ${action.id} moved to ${action.status.replace(/_/g, " ")}: ${action.expectedOutcome}`,
          null,
          createdAt,
          ["orchestrator-action-queue", action.status],
          "system"
        )
      ],
      30
    ),
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromPreparedHandoff(handoff: HandoffRelaySummary, run: OrchestratorRun) {
  const current = await loadProjectMemory();
  const createdAt = handoff.receivedAt;
  const handoffItems = buildItemsFromHandoff(handoff);
  const bridgeItems = buildItemsFromPreparedHandoff(handoff, run);
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState: "Prepared Codex handoff waiting for owner review",
      latestProgress: handoff.ownerReadableSummary,
      recommendedNextAction: "Open the Handoff Inbox, review the prepared Codex prompt, and copy it manually if it is right.",
      lastHandoffId: handoff.id
    },
    majorDecisions: mergeItems(current.majorDecisions, [...bridgeItems.majorDecisions, ...handoffItems.majorDecisions]),
    acceptedApproaches: mergeItems(current.acceptedApproaches, [...bridgeItems.acceptedApproaches, ...handoffItems.acceptedApproaches]),
    rejectedApproaches: mergeItems(current.rejectedApproaches, handoffItems.rejectedApproaches),
    completedMilestones: mergeItems(current.completedMilestones, [...bridgeItems.completedMilestones, ...handoffItems.completedMilestones]),
    currentBlockers: handoffItems.currentBlockers.length ? handoffItems.currentBlockers : current.currentBlockers,
    openQuestions: mergeItems(current.openQuestions, handoffItems.openQuestions),
    architectureDecisions: mergeItems(current.architectureDecisions, bridgeItems.architectureDecisions),
    designPreferences: mergeItems(current.designPreferences, handoffItems.designPreferences),
    lessonsLearned: mergeItems(current.lessonsLearned, [...bridgeItems.lessonsLearned, ...handoffItems.lessonsLearned]),
    futureImprovements: current.futureImprovements,
    progressHistory: mergeItems(current.progressHistory, [...bridgeItems.progressHistory, ...handoffItems.progressHistory], 30),
    ownerFeedback: current.ownerFeedback,
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromHandoffExport(handoff: HandoffRelaySummary, exportOutput: OrchestratorApprovedHandoffExport) {
  const current = await loadProjectMemory();
  const createdAt = exportOutput.createdAt;
  const tags = ["orchestrator-approved-handoff-export", handoff.id];
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState: "Approved handoff export ready",
      latestProgress: exportOutput.ownerReadableSummary,
      recommendedNextAction: "Lincoln may copy the exported Codex-ready prompt from the Handoff Inbox and send it manually.",
      lastHandoffId: handoff.id
    },
    majorDecisions: mergeItems(current.majorDecisions, [
      item("major_decision", `Prepared handoff ${handoff.id} was owner-approved for manual Codex prompt export.`, handoff.id, createdAt, tags)
    ]),
    acceptedApproaches: mergeItems(current.acceptedApproaches, [
      item(
        "accepted_approach",
        "Use owner-approved handoff exports to create copyable Codex-ready prompts without triggering Codex automatically.",
        handoff.id,
        createdAt,
        tags
      )
    ]),
    completedMilestones: mergeItems(current.completedMilestones, [
      item("completed_milestone", `Export-ready handoff created for ${handoff.extracted.prTitle}.`, handoff.id, createdAt, tags)
    ]),
    currentBlockers: current.currentBlockers,
    openQuestions: current.openQuestions,
    architectureDecisions: mergeItems(current.architectureDecisions, [
      item(
        "architecture_decision",
        "Owner-approved handoff exports store exact prompts, verification, expected result, and guardrails while preserving manual execution.",
        handoff.id,
        createdAt,
        tags
      )
    ]),
    lessonsLearned: mergeItems(current.lessonsLearned, [
      item(
        "lesson_learned",
        "A prepared handoff becomes safer when export approval is explicit and recorded before Lincoln copies the prompt.",
        handoff.id,
        createdAt,
        tags
      )
    ]),
    futureImprovements: current.futureImprovements,
    progressHistory: mergeItems(
      current.progressHistory,
      [
        item("progress", exportOutput.ownerReadableSummary, handoff.id, createdAt, tags),
        item("progress", `Expected result: ${exportOutput.expectedResult}`, handoff.id, createdAt, tags)
      ],
      30
    ),
    ownerFeedback: current.ownerFeedback,
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromBuildExecutionRequest(request: BuildExecutionRequestRecord) {
  const current = await loadProjectMemory();
  const createdAt = request.createdAt;
  const tags = ["build-execution-request", request.executionStatus, request.sourceHandoff.sourceKind];
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState: "Build execution request drafted",
      latestProgress: request.ownerReadableSummary,
      recommendedNextAction: "Review the build execution request before any builder execution, GitHub issue, label, or deploy happens.",
      lastHandoffId: request.sourceHandoff.id
    },
    majorDecisions: mergeItems(current.majorDecisions, [
      item(
        "major_decision",
        `Prepared handoff ${request.sourceHandoff.id} was converted into a build execution request draft.`,
        request.sourceHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    acceptedApproaches: mergeItems(current.acceptedApproaches, [
      item(
        "accepted_approach",
        "Treat builder execution as an owner-visible AppEngine workflow state before automating Codex, GitHub issues, labels, or deploys.",
        request.sourceHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    completedMilestones: mergeItems(current.completedMilestones, [
      item("completed_milestone", request.ownerReadableSummary, request.sourceHandoff.id, createdAt, tags, "system")
    ]),
    currentBlockers: mergeItems(
      current.currentBlockers,
      [
        item(
          "current_blocker",
          "Build execution request remains draft until owner approves the next builder step.",
          request.sourceHandoff.id,
          createdAt,
          tags,
          "system"
        )
      ],
      20
    ),
    openQuestions: current.openQuestions,
    architectureDecisions: mergeItems(current.architectureDecisions, [
      item(
        "architecture_decision",
        "Build execution requests connect Handoff Inbox output to future builder execution while keeping Codex execution, GitHub issues, labels, deploys, paid resources, migrations, and secrets blocked.",
        request.sourceHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    designPreferences: current.designPreferences,
    lessonsLearned: mergeItems(current.lessonsLearned, [
      item(
        "lesson_learned",
        "The manual Codex side channel can be made visible first, then automated later only after owner-approved workflow states exist.",
        request.sourceHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    futureImprovements: current.futureImprovements,
    progressHistory: mergeItems(
      current.progressHistory,
      [
        item("progress", request.ownerReadableSummary, request.sourceHandoff.id, createdAt, tags, "system"),
        item("progress", `Target project/slice: ${request.targetProjectSlice}.`, request.sourceHandoff.id, createdAt, tags, "system")
      ],
      30
    ),
    ownerFeedback: current.ownerFeedback,
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromBuildExecutionRequestExport(
  request: BuildExecutionRequestRecord,
  exportOutput: BuildExecutionBuilderHandoffExport
) {
  const current = await loadProjectMemory();
  const createdAt = exportOutput.createdAt;
  const tags = ["build-execution-request-export", request.reviewStatus, request.sourceHandoff.sourceKind];
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState: "Build execution request exported for builder handoff",
      latestProgress: request.ownerReadableSummary,
      recommendedNextAction: "Open the Handoff Inbox, review the exported builder prompt, and copy it manually only if it is right.",
      lastHandoffId: request.exportedBuilderHandoffId || request.sourceHandoff.id
    },
    majorDecisions: mergeItems(current.majorDecisions, [
      item(
        "major_decision",
        `Build execution request ${request.id} was owner-approved and exported as a manual builder handoff.`,
        request.exportedBuilderHandoffId || request.sourceHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    acceptedApproaches: mergeItems(current.acceptedApproaches, [
      item(
        "accepted_approach",
        "Export builder-ready prompts into the Handoff Inbox before any Codex auto-execution exists.",
        request.exportedBuilderHandoffId || request.sourceHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    completedMilestones: mergeItems(current.completedMilestones, [
      item("completed_milestone", exportOutput.expectedResult, request.exportedBuilderHandoffId || request.sourceHandoff.id, createdAt, tags, "system")
    ]),
    currentBlockers: mergeItems(
      current.currentBlockers,
      [
        item(
          "current_blocker",
          "Builder handoff is exported, but Codex execution remains manual until Lincoln copies and sends the prompt.",
          request.exportedBuilderHandoffId || request.sourceHandoff.id,
          createdAt,
          tags,
          "system"
        )
      ],
      20
    ),
    openQuestions: current.openQuestions,
    architectureDecisions: mergeItems(current.architectureDecisions, [
      item(
        "architecture_decision",
        "Build execution exports bridge owner-approved requests to Handoff Relay without creating issues, labels, deployments, migrations, secrets, or automatic Codex runs.",
        request.exportedBuilderHandoffId || request.sourceHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    designPreferences: current.designPreferences,
    lessonsLearned: mergeItems(current.lessonsLearned, [
      item(
        "lesson_learned",
        "The next safe step after packet draft readiness is an owner-approved builder handoff, not direct automation.",
        request.exportedBuilderHandoffId || request.sourceHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    futureImprovements: current.futureImprovements,
    progressHistory: mergeItems(
      current.progressHistory,
      [
        item("progress", request.ownerReadableSummary, request.exportedBuilderHandoffId || request.sourceHandoff.id, createdAt, tags, "system"),
        item("progress", `Exported prompt target: ${exportOutput.targetProjectSlice}.`, request.exportedBuilderHandoffId || request.sourceHandoff.id, createdAt, tags, "system")
      ],
      30
    ),
    ownerFeedback: current.ownerFeedback,
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromBuilderResultIntake(
  request: BuildExecutionRequestRecord,
  result: BuildExecutionBuilderResultIntake
) {
  const current = await loadProjectMemory();
  const createdAt = result.createdAt;
  const tags = ["builder-result-intake", result.passFailStatus, request.executionStatus];
  const needsFollowUp = Boolean(result.followUpPrompt);
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState: `Builder result ${request.executionStatus.replace(/_/g, " ")}`,
      latestProgress: result.ownerReadableSummary,
      recommendedNextAction: result.nextSafeAction,
      lastHandoffId: request.exportedBuilderHandoffId || request.sourceHandoff.id
    },
    majorDecisions: current.majorDecisions,
    acceptedApproaches: mergeItems(current.acceptedApproaches, [
      item(
        "accepted_approach",
        "Builder results are imported back into AppEngine for verification review before any merge or deployment decision.",
        request.exportedBuilderHandoffId || request.sourceHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    rejectedApproaches: current.rejectedApproaches,
    completedMilestones:
      request.executionStatus === "completed"
        ? mergeItems(current.completedMilestones, [
            item("completed_milestone", result.ownerReadableSummary, request.exportedBuilderHandoffId || request.sourceHandoff.id, createdAt, tags, "system")
          ])
        : current.completedMilestones,
    currentBlockers: needsFollowUp
      ? mergeItems(
          current.currentBlockers,
          result.blockers.length
            ? result.blockers.map((blocker) => item("current_blocker", blocker, request.exportedBuilderHandoffId || request.sourceHandoff.id, createdAt, tags, "system"))
            : [
                item(
                  "current_blocker",
                  "Builder result needs verification before owner can decide whether to merge.",
                  request.exportedBuilderHandoffId || request.sourceHandoff.id,
                  createdAt,
                  tags,
                  "system"
                )
              ],
          20
        )
      : current.currentBlockers,
    openQuestions: current.openQuestions,
    architectureDecisions: mergeItems(current.architectureDecisions, [
      item(
        "architecture_decision",
        "Builder result intake stores PR/branch evidence, verification output, blockers, review URL, and next safe action without auto-merging or triggering Codex.",
        request.exportedBuilderHandoffId || request.sourceHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    designPreferences: current.designPreferences,
    lessonsLearned: mergeItems(current.lessonsLearned, [
      item(
        "lesson_learned",
        "The builder loop is not complete until the result is imported and verified inside AppEngine.",
        request.exportedBuilderHandoffId || request.sourceHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    futureImprovements: current.futureImprovements,
    progressHistory: mergeItems(
      current.progressHistory,
      [
        item("progress", result.ownerReadableSummary, request.exportedBuilderHandoffId || request.sourceHandoff.id, createdAt, tags, "system"),
        item("progress", `Next safe action: ${result.nextSafeAction}`, request.exportedBuilderHandoffId || request.sourceHandoff.id, createdAt, tags, "system")
      ],
      30
    ),
    ownerFeedback: current.ownerFeedback,
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromBuildLoopCompletion(
  request: BuildExecutionRequestRecord,
  dashboard: BuildLoopCompletionDashboard
) {
  const current = await loadProjectMemory();
  const createdAt = dashboard.generatedAt;
  const sourceId = request.exportedBuilderHandoffId || request.sourceHandoff.id;
  const tags = ["build-loop-completion", request.executionStatus, dashboard.verificationStatus];
  const terminalSummary =
    request.executionStatus === "completed"
      ? `Build loop completed for ${request.targetProjectSlice}. ${dashboard.nextSafeAction}`
      : `Build loop blocked for ${request.targetProjectSlice}. ${dashboard.nextSafeAction}`;
  const blockerItems = dashboard.blockers.length
    ? dashboard.blockers.map((blocker) => item("current_blocker", blocker, sourceId, createdAt, tags, "system"))
    : request.executionStatus === "blocked"
      ? [item("current_blocker", "Build loop is blocked and needs owner review.", sourceId, createdAt, tags, "system")]
      : [];

  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState: `Build loop ${request.executionStatus.replace(/_/g, " ")}`,
      latestProgress: dashboard.ownerReadableSummary,
      recommendedNextAction: dashboard.nextSafeAction,
      lastHandoffId: sourceId
    },
    majorDecisions: current.majorDecisions,
    acceptedApproaches: mergeItems(current.acceptedApproaches, [
      item(
        "accepted_approach",
        "Build loop completion is now judged from source request, packet draft, execution request, exported handoff, imported builder result, verification evidence, portfolio state, and next safe action together.",
        sourceId,
        createdAt,
        tags,
        "system"
      )
    ]),
    rejectedApproaches: current.rejectedApproaches,
    completedMilestones:
      request.executionStatus === "completed"
        ? mergeItems(current.completedMilestones, [
            item("completed_milestone", terminalSummary, sourceId, createdAt, tags, "system")
          ])
        : current.completedMilestones,
    currentBlockers: blockerItems.length ? mergeItems(current.currentBlockers, blockerItems, 20) : current.currentBlockers,
    openQuestions: current.openQuestions,
    architectureDecisions: current.architectureDecisions,
    designPreferences: current.designPreferences,
    lessonsLearned: mergeItems(current.lessonsLearned, [
      item(
        "lesson_learned",
        "A build request is not complete until the builder result is imported, verification state is visible, and the next safe action is clear in Owner Control Center.",
        sourceId,
        createdAt,
        tags,
        "system"
      )
    ]),
    futureImprovements: current.futureImprovements,
    progressHistory: mergeItems(
      current.progressHistory,
      [
        item("progress", terminalSummary, sourceId, createdAt, tags, "system"),
        item("progress", `Build loop dashboard request: ${dashboard.requestId || "none"}.`, sourceId, createdAt, tags, "system")
      ],
      30
    ),
    ownerFeedback: current.ownerFeedback,
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromOpportunityBuildPacketBridge(bridge: OpportunityBuildPacketBridgeRecord) {
  const current = await loadProjectMemory();
  const createdAt = bridge.createdAt;
  const tags = ["opportunity-build-packet-bridge", bridge.packetType, bridge.candidateId];
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState: "Opportunity packet draft prepared for owner review",
      latestProgress: bridge.ownerReadableSummary,
      recommendedNextAction: "Review the prepared packet draft before any final packet, Codex run, GitHub issue, label, or deploy exists.",
      lastHandoffId: current.latestProjectState.lastHandoffId
    },
    majorDecisions: mergeItems(current.majorDecisions, [
      item(
        "major_decision",
        `Owner approved Opportunity candidate ${bridge.sourceCandidate.title} for ${bridge.packetType.replace(/_/g, " ")} preparation.`,
        null,
        createdAt,
        tags,
        "system"
      )
    ]),
    acceptedApproaches: mergeItems(current.acceptedApproaches, [
      item(
        "accepted_approach",
        "Prepare Opportunity packet drafts through the existing candidate packet bridge standard while keeping final packets, Codex, issues, labels, and deploys blocked.",
        null,
        createdAt,
        tags,
        "system"
      )
    ]),
    completedMilestones: mergeItems(current.completedMilestones, [
      item("completed_milestone", bridge.ownerReadableSummary, null, createdAt, tags, "system")
    ]),
    currentBlockers: bridge.missingInformation.length
      ? mergeItems(
          current.currentBlockers,
          bridge.missingInformation.map((missing) => item("current_blocker", missing, null, createdAt, tags, "system")),
          20
        )
      : current.currentBlockers,
    openQuestions: current.openQuestions,
    architectureDecisions: mergeItems(current.architectureDecisions, [
      item(
        "architecture_decision",
        "Opportunity build packet bridge stores adapter-backed local/mock packet draft records and reuses source-of-truth/candidate-to-packet-bridge.md.",
        null,
        createdAt,
        tags,
        "system"
      )
    ]),
    lessonsLearned: mergeItems(current.lessonsLearned, [
      item(
        "lesson_learned",
        "Owner-visible packet draft preparation is useful only when it records source evidence, missing information, and next safe action.",
        null,
        createdAt,
        tags,
        "system"
      )
    ]),
    futureImprovements: current.futureImprovements,
    progressHistory: mergeItems(
      current.progressHistory,
      [
        item("progress", bridge.ownerReadableSummary, null, createdAt, tags, "system"),
        item("progress", `Next safe action: ${bridge.nextSafeAction.replace(/_/g, " ")}.`, null, createdAt, tags, "system")
      ],
      30
    ),
    ownerFeedback: current.ownerFeedback,
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromOpportunityFullLoopTrial(trial: OpportunityFullLoopTrialRecord) {
  const current = await loadProjectMemory();
  const createdAt = trial.createdAt;
  const tags = ["opportunity-full-loop-trial", trial.status, trial.artifacts.packetBridgeId || "no-packet-bridge"];
  const completedSteps = trial.steps.filter((step) => step.status === "completed").length;
  const blockedSteps = trial.steps.filter((step) => step.status === "blocked");
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState:
        trial.status === "completed"
          ? "Opportunity full loop reached packet draft readiness"
          : "Opportunity full loop trial is blocked",
      latestProgress: trial.ownerReadableSummary,
      recommendedNextAction: trial.nextSafeAction,
      lastHandoffId: current.latestProjectState.lastHandoffId
    },
    majorDecisions: mergeItems(
      current.majorDecisions,
      trial.status === "completed"
        ? [
            item(
              "major_decision",
              "Opportunity can now be rehearsed from public intake through owner-approved packet draft readiness without automatic execution.",
              null,
              createdAt,
              tags,
              "system"
            )
          ]
        : []
    ),
    acceptedApproaches: mergeItems(current.acceptedApproaches, [
      item(
        "accepted_approach",
        "Use existing Opportunity artifacts and packet bridge state for full-loop trials instead of creating a parallel planning system.",
        null,
        createdAt,
        tags,
        "system"
      )
    ]),
    rejectedApproaches: current.rejectedApproaches,
    completedMilestones:
      trial.status === "completed"
        ? mergeItems(current.completedMilestones, [
            item("completed_milestone", trial.ownerReadableSummary, null, createdAt, tags, "system")
          ])
        : current.completedMilestones,
    currentBlockers: blockedSteps.length
      ? mergeItems(
          current.currentBlockers,
          blockedSteps.map((step) =>
            item(
              "current_blocker",
              `${step.label}: ${step.blocker || "blocked"}`,
              null,
              createdAt,
              tags,
              "system"
            )
          ),
          20
        )
      : current.currentBlockers,
    openQuestions: current.openQuestions,
    architectureDecisions: mergeItems(current.architectureDecisions, [
      item(
        "architecture_decision",
        "Opportunity Full Loop Trial writes one adapter-backed trial record plus existing opportunity_intake, clarification, solution path, action plan, candidate, packet bridge, memory, and audit artifacts.",
        null,
        createdAt,
        tags,
        "system"
      )
    ]),
    designPreferences: current.designPreferences,
    lessonsLearned: mergeItems(current.lessonsLearned, [
      item(
        "lesson_learned",
        `Opportunity full-loop trial completed ${completedSteps} of ${trial.steps.length} steps and reports missing information honestly.`,
        null,
        createdAt,
        tags,
        "system"
      )
    ]),
    futureImprovements: current.futureImprovements,
    progressHistory: mergeItems(
      current.progressHistory,
      [
        item("progress", trial.ownerReadableSummary, null, createdAt, tags, "system"),
        item("progress", `Next safe action: ${trial.nextSafeAction}`, null, createdAt, tags, "system")
      ],
      30
    ),
    ownerFeedback: current.ownerFeedback,
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromRealOpportunityExample(example: RealOpportunityExampleRunRecord) {
  const current = await loadProjectMemory();
  const createdAt = example.createdAt;
  const tags = ["real-opportunity-example", example.exampleContext, example.fullLoopTrialId];
  const blockedSteps = example.steps.filter((step) => step.status === "blocked");
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState:
        example.status === "completed"
          ? "Real Opportunity example reached packet draft readiness"
          : "Real Opportunity example is blocked",
      latestProgress: example.ownerReadableSummary,
      recommendedNextAction: example.nextSafeAction,
      lastHandoffId: current.latestProjectState.lastHandoffId
    },
    majorDecisions: mergeItems(current.majorDecisions, [
      item(
        "major_decision",
        `Real Opportunity example accepted for controlled-use run: ${example.sourceInput.problemOrVision}`,
        null,
        createdAt,
        tags,
        "system"
      )
    ]),
    acceptedApproaches: mergeItems(current.acceptedApproaches, [
      item(
        "accepted_approach",
        "Run real owner-entered Opportunity examples through the existing controlled-use pipeline before enabling public/customer use or autonomous execution.",
        null,
        createdAt,
        tags,
        "system"
      )
    ]),
    rejectedApproaches: current.rejectedApproaches,
    completedMilestones:
      example.status === "completed"
        ? mergeItems(current.completedMilestones, [
            item("completed_milestone", example.ownerReadableSummary, null, createdAt, tags, "system")
          ])
        : current.completedMilestones,
    currentBlockers: blockedSteps.length
      ? mergeItems(
          current.currentBlockers,
          blockedSteps.map((step) =>
            item("current_blocker", `${step.label}: ${step.blocker || step.summary}`, null, createdAt, tags, "system")
          ),
          20
        )
      : current.currentBlockers,
    openQuestions: current.openQuestions,
    architectureDecisions: current.architectureDecisions,
    designPreferences: current.designPreferences,
    lessonsLearned: mergeItems(current.lessonsLearned, [
      item(
        "lesson_learned",
        `Real Opportunity example ran with ${example.steps.filter((step) => step.status === "completed").length} completed steps and ${example.missingInformation.length} missing-information items.`,
        null,
        createdAt,
        tags,
        "system"
      )
    ]),
    futureImprovements: current.futureImprovements,
    progressHistory: mergeItems(
      current.progressHistory,
      [
        item("progress", example.ownerReadableSummary, null, createdAt, tags, "system"),
        item("progress", `Next safe action: ${example.nextSafeAction}`, null, createdAt, tags, "system")
      ],
      30
    ),
    ownerFeedback: current.ownerFeedback,
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromRealOpportunityResultReview(review: RealOpportunityResultReviewRecord) {
  const current = await loadProjectMemory();
  const createdAt = review.createdAt;
  const tags = ["real-opportunity-result-review", review.reviewStatus, review.exampleId];
  const ready = review.reviewStatus === "ready_for_next_appengine_action";
  const ownerNoteItem = review.ownerNotes
    ? [item("progress", `Owner note on real Opportunity result: ${review.ownerNotes}`, null, createdAt, tags, "owner_feedback")]
    : [];
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState: ready
        ? "Real Opportunity result is ready for the next AppEngine action"
        : `Real Opportunity result reviewed as ${review.reviewStatus.replace(/_/g, " ")}`,
      latestProgress: review.ownerReadableSummary,
      recommendedNextAction: review.nextAppEngineAction.expectedOutcome,
      lastHandoffId: current.latestProjectState.lastHandoffId
    },
    majorDecisions: ready
      ? mergeItems(current.majorDecisions, [
          item(
            "major_decision",
            "Owner approved a real Opportunity result as ready for the next AppEngine action.",
            null,
            createdAt,
            tags,
            "owner_feedback"
          )
        ])
      : current.majorDecisions,
    acceptedApproaches:
      review.reviewStatus === "useful" || ready
        ? mergeItems(current.acceptedApproaches, [
            item(
              "accepted_approach",
              "Review real Opportunity examples before preparing the next AppEngine action.",
              null,
              createdAt,
              tags,
              "owner_feedback"
            )
          ])
        : current.acceptedApproaches,
    rejectedApproaches:
      review.reviewStatus === "wrong_direction"
        ? mergeItems(current.rejectedApproaches, [
            item(
              "rejected_approach",
              `Real Opportunity result direction rejected: ${review.resultSnapshot.originalProblemOrVision}`,
              null,
              createdAt,
              tags,
              "owner_feedback"
            )
          ])
        : current.rejectedApproaches,
    completedMilestones: ready
      ? mergeItems(current.completedMilestones, [
          item("completed_milestone", review.ownerReadableSummary, null, createdAt, tags, "owner_feedback")
        ])
      : current.completedMilestones,
    currentBlockers: review.portfolioStateUpdate.blocker
      ? mergeItems(
          current.currentBlockers,
          [item("current_blocker", review.portfolioStateUpdate.blocker, null, createdAt, tags, "owner_feedback")],
          20
        )
      : current.currentBlockers,
    openQuestions:
      review.reviewStatus === "needs_clarification"
        ? mergeItems(current.openQuestions, [
            item(
              "open_question",
              `Clarify real Opportunity result: ${review.resultSnapshot.originalProblemOrVision}`,
              null,
              createdAt,
              tags,
              "owner_feedback"
            )
          ])
        : current.openQuestions,
    architectureDecisions: current.architectureDecisions,
    designPreferences: current.designPreferences,
    lessonsLearned: mergeItems(current.lessonsLearned, [
      item(
        "lesson_learned",
        `Real Opportunity result review captured ${review.reviewStatus.replace(/_/g, " ")} with ${review.concerns.length} concern(s).`,
        null,
        createdAt,
        tags,
        "owner_feedback"
      )
    ]),
    futureImprovements:
      review.reviewStatus === "missing_requirement"
        ? mergeItems(current.futureImprovements, [
            item(
              "future_improvement",
              review.ownerNotes || "Add the missing requirement before the real Opportunity result advances.",
              null,
              createdAt,
              tags,
              "owner_feedback"
            )
          ])
        : current.futureImprovements,
    progressHistory: mergeItems(
      current.progressHistory,
      [
        item("progress", review.ownerReadableSummary, null, createdAt, tags, "owner_feedback"),
        item("progress", `Next AppEngine action: ${review.nextAppEngineAction.expectedOutcome}`, null, createdAt, tags, "owner_feedback"),
        ...ownerNoteItem
      ],
      30
    ),
    ownerFeedback: mergeItems(
      current.ownerFeedback,
      [
        item(
          "progress",
          `Real Opportunity result review: ${review.reviewStatus.replace(/_/g, " ")}${review.ownerNotes ? ` - ${review.ownerNotes}` : ""}`,
          null,
          createdAt,
          tags,
          "owner_feedback"
        )
      ],
      30
    ),
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromFirstEcosystemBuildPacketDraft(draft: FirstEcosystemBuildPacketDraftRecord) {
  const current = await loadProjectMemory();
  const createdAt = draft.createdAt;
  const tags = ["first-ecosystem-build-packet-draft", "life-core", draft.sourcePreparedHandoffId];
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState: "First ecosystem build packet draft ready for owner review",
      latestProgress: draft.ownerReadableSummary,
      recommendedNextAction: "Review the Life Produces Life Core packet draft before any final packet or implementation begins.",
      lastHandoffId: draft.sourcePreparedHandoffId
    },
    majorDecisions: mergeItems(current.majorDecisions, [
      item(
        "major_decision",
        "Convert the prepared Life Produces Life Core handoff into the first ecosystem build packet draft before implementation.",
        draft.sourcePreparedHandoffId,
        createdAt,
        tags,
        "system"
      )
    ]),
    acceptedApproaches: mergeItems(current.acceptedApproaches, [
      item(
        "accepted_approach",
        "Keep Life Produces Life Core as the shared ecosystem foundation where transformation is the product and apps are tools.",
        draft.sourcePreparedHandoffId,
        createdAt,
        tags,
        "system"
      )
    ]),
    rejectedApproaches: current.rejectedApproaches,
    completedMilestones: mergeItems(current.completedMilestones, [
      item("completed_milestone", draft.ownerReadableSummary, draft.sourcePreparedHandoffId, createdAt, tags, "system")
    ]),
    currentBlockers: current.currentBlockers,
    openQuestions: current.openQuestions,
    architectureDecisions: mergeItems(current.architectureDecisions, [
      item(
        "architecture_decision",
        "The first ecosystem build packet draft must remain owner-reviewable and cannot create final packets, phase issues, Codex runs, labels, or deploys automatically.",
        draft.sourcePreparedHandoffId,
        createdAt,
        tags,
        "system"
      )
    ]),
    designPreferences: mergeItems(current.designPreferences, [
      item(
        "design_preference",
        `Life Core design intent: ${draft.designIntent.emotionalExperience.join(", ")}.`,
        draft.sourcePreparedHandoffId,
        createdAt,
        tags,
        "system"
      )
    ]),
    lessonsLearned: mergeItems(current.lessonsLearned, [
      item(
        "lesson_learned",
        "The completed Opportunity flow can now produce a concrete packet draft from a real ecosystem handoff without triggering implementation.",
        draft.sourcePreparedHandoffId,
        createdAt,
        tags,
        "system"
      )
    ]),
    futureImprovements: current.futureImprovements,
    progressHistory: mergeItems(
      current.progressHistory,
      [
        item("progress", draft.ownerReadableSummary, draft.sourcePreparedHandoffId, createdAt, tags, "system"),
        item("progress", `Next safe action: ${draft.nextSafeAction.replace(/_/g, " ")}.`, draft.sourcePreparedHandoffId, createdAt, tags, "system")
      ],
      30
    ),
    ownerFeedback: current.ownerFeedback,
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

export async function updateProjectMemoryFromFirstRealBuildLoopRun(run: FirstRealBuildLoopRunRecord) {
  const current = await loadProjectMemory();
  const createdAt = run.createdAt;
  const tags = ["first-real-build-loop-run", "life-core", "build-loop", run.exportedBuilderHandoff.id];
  const next: ProjectMemory = {
    ...current,
    updatedAt: createdAt,
    latestProjectState: {
      currentState: "First real Life Produces Life build loop run prepared",
      latestProgress: run.ownerReadableSummary,
      recommendedNextAction: "Copy the exported builder prompt, run the builder manually, then paste the result into Builder Result Intake.",
      lastHandoffId: run.exportedBuilderHandoff.handoffInboxId || run.exportedBuilderHandoff.id
    },
    majorDecisions: mergeItems(current.majorDecisions, [
      item(
        "major_decision",
        "Use the completed AppEngine build loop for the first real Life Produces Life Core build request under internal controlled use.",
        run.exportedBuilderHandoff.handoffInboxId || run.exportedBuilderHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    acceptedApproaches: mergeItems(current.acceptedApproaches, [
      item(
        "accepted_approach",
        "First real build loop runs may prepare source request, packet draft, build execution request, and copy-only builder handoff, then stop before Codex execution.",
        run.exportedBuilderHandoff.handoffInboxId || run.exportedBuilderHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    rejectedApproaches: current.rejectedApproaches,
    completedMilestones: mergeItems(current.completedMilestones, [
      item("completed_milestone", "First real build-loop handoff exported for Life Produces Life Core.", run.exportedBuilderHandoff.id, createdAt, tags, "system")
    ]),
    currentBlockers: mergeItems(current.currentBlockers, [
      item(
        "current_blocker",
        "First real build loop is waiting on builder output before result intake and verification review can complete.",
        run.exportedBuilderHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    openQuestions: current.openQuestions,
    architectureDecisions: current.architectureDecisions,
    designPreferences: current.designPreferences,
    lessonsLearned: mergeItems(current.lessonsLearned, [
      item(
        "lesson_learned",
        "The AppEngine build loop is usable internally when it can prepare the exact builder prompt and stop for owner-controlled result intake.",
        run.exportedBuilderHandoff.id,
        createdAt,
        tags,
        "system"
      )
    ]),
    futureImprovements: current.futureImprovements,
    progressHistory: mergeItems(
      current.progressHistory,
      [
        item("progress", run.ownerReadableSummary, run.exportedBuilderHandoff.id, createdAt, tags, "system"),
        item("progress", `Next safe action: ${run.nextSafeAction.replace(/_/g, " ")}`, run.exportedBuilderHandoff.id, createdAt, tags, "system")
      ],
      30
    ),
    ownerFeedback: current.ownerFeedback,
    guardrails: defaultGuardrails()
  };

  const summarized = withSummaries(next);
  await writeStore({ memory: summarized });

  return summarized;
}

function buildItemsFromHandoff(handoff: HandoffRelaySummary) {
  const createdAt = handoff.receivedAt;
  const sourceHandoffId = handoff.id;
  const rawLines = handoff.rawText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length > 3);

  return {
    majorDecisions: [
      ...itemsFromLines(rawLines, ["decision", "approved", "merged", "owner approval"], "major_decision", sourceHandoffId, createdAt),
      item("major_decision", `Handoff recorded for ${formatPr(handoff)} with status ${handoff.extracted.mergeStatus}.`, sourceHandoffId, createdAt, [
        "handoff",
        "status"
      ])
    ],
    acceptedApproaches: itemsFromLines(
      rawLines,
      ["accepted", "preserve", "keep", "use ", "using ", "guardrail", "standard"],
      "accepted_approach",
      sourceHandoffId,
      createdAt
    ),
    rejectedApproaches: itemsFromLines(rawLines, ["rejected", "do not", "avoid", "blocked"], "rejected_approach", sourceHandoffId, createdAt),
    completedMilestones: [
      item("completed_milestone", handoff.projectState.latestCompletedMilestone, sourceHandoffId, createdAt, ["milestone"]),
      ...handoff.extracted.completedWork.map((line) => item("completed_milestone", line, sourceHandoffId, createdAt, ["completed"]))
    ],
    currentBlockers: handoff.extracted.blockers.map((line) => item("current_blocker", line, sourceHandoffId, createdAt, ["blocker"])),
    openQuestions: [
      ...handoff.extracted.dependencies.map((line) => item("open_question", `Confirm dependency: ${line}`, sourceHandoffId, createdAt, ["dependency"])),
      ...itemsFromLines(rawLines, ["open question", "unknown", "needs clarification"], "open_question", sourceHandoffId, createdAt)
    ],
    architectureDecisions: itemsFromLines(
      rawLines,
      ["architecture", "route", "api", "schema", "auth", "deployment", "store", "artifact"],
      "architecture_decision",
      sourceHandoffId,
      createdAt
    ),
    designPreferences: itemsFromLines(rawLines, ["design", "mobile", "warm", "clean", "approachable", "layout", "ui"], "design_preference", sourceHandoffId, createdAt),
    lessonsLearned: itemsFromLines(rawLines, ["lesson", "learned", "proved", "confirmed"], "lesson_learned", sourceHandoffId, createdAt),
    progressHistory: [
      item("progress", handoff.ownerReadableSummary, sourceHandoffId, createdAt, ["handoff"]),
      item("progress", handoff.projectState.recommendedNextAction, sourceHandoffId, createdAt, ["next-action"])
    ]
  };
}

function buildItemsFromPreparedHandoff(handoff: HandoffRelaySummary, run: OrchestratorRun) {
  const createdAt = handoff.receivedAt;
  const sourceHandoffId = handoff.id;
  const sourceTags = ["orchestrator-handoff-bridge", run.selectedNextSafeAction];

  return {
    majorDecisions: [
      item(
        "major_decision",
        `Manual Orchestrator output ${run.id} was saved as prepared handoff ${handoff.id}.`,
        sourceHandoffId,
        createdAt,
        sourceTags
      )
    ],
    acceptedApproaches: [
      item(
        "accepted_approach",
        "Use the Handoff Inbox as the owner-reviewed relay for Manual Orchestrator prompts.",
        sourceHandoffId,
        createdAt,
        sourceTags
      )
    ],
    completedMilestones: [
      item("completed_milestone", handoff.ownerReadableSummary, sourceHandoffId, createdAt, sourceTags),
      item(
        "completed_milestone",
        `Prepared handoff includes current state, reason, prompt, guardrails, verification, and expected result for ${run.selectedNextSafeAction.replace(/_/g, " ")}.`,
        sourceHandoffId,
        createdAt,
        sourceTags
      )
    ],
    architectureDecisions: [
      item(
        "architecture_decision",
        "Manual Orchestrator outputs become handoff_relay_summary records before Lincoln copies the prompt; they do not trigger Codex or GitHub work.",
        sourceHandoffId,
        createdAt,
        sourceTags
      )
    ],
    lessonsLearned: [
      item(
        "lesson_learned",
        "A generated next safe action is more useful when it can be reviewed and copied from the Handoff Inbox.",
        sourceHandoffId,
        createdAt,
        sourceTags
      )
    ],
    progressHistory: [
      item("progress", handoff.ownerReadableSummary, sourceHandoffId, createdAt, sourceTags),
      item("progress", handoff.nextPrompt.expectedOutcome, sourceHandoffId, createdAt, sourceTags)
    ]
  };
}

function buildItemsFromFeedback({
  choices,
  note,
  sourceHandoffId,
  createdAt
}: {
  choices: ProjectMemoryFeedbackChoice[];
  note: string;
  sourceHandoffId: string | null;
  createdAt: string;
}) {
  const feedbackText = note || "Owner marked this memory category.";
  const ownerFeedback = choices.length
    ? choices.map((choice) =>
        item(feedbackCategory(choice), `${formatFeedbackChoice(choice)}: ${feedbackText}`, sourceHandoffId, createdAt, ["owner-feedback"], "owner_feedback")
      )
    : [item("future_improvement", feedbackText, sourceHandoffId, createdAt, ["owner-feedback"], "owner_feedback")];

  return {
    majorDecisions: ownerFeedback.filter((entry) => entry.category === "major_decision"),
    acceptedApproaches: ownerFeedback.filter((entry) => entry.category === "accepted_approach"),
    rejectedApproaches: ownerFeedback.filter((entry) => entry.category === "rejected_approach"),
    lessonsLearned: ownerFeedback.filter((entry) => entry.category === "lesson_learned"),
    futureImprovements: ownerFeedback.filter((entry) => entry.category === "future_improvement"),
    ownerFeedback
  };
}

function buildItemsFromTrialReview(review: TrialResultReview) {
  const createdAt = review.createdAt;
  const note = review.ownerNote || review.improvementCandidate.summary;
  const ownerFeedback = item(
    "future_improvement",
    `${review.project.name} trial review (${review.reviewStatus.replace(/_/g, " ")}): ${note}`,
    null,
    createdAt,
    ["trial-review", review.reviewStatus],
    "system"
  );

  return {
    majorDecisions:
      review.reviewStatus === "ready_for_next_packet"
        ? [item("major_decision", `${review.project.name} is ready for the next packet path.`, null, createdAt, ["trial-review"], "system")]
        : [],
    acceptedApproaches: ["useful", "ready_for_next_packet"].includes(review.reviewStatus)
      ? review.usefulSignals.map((signal) => item("accepted_approach", signal, null, createdAt, ["trial-review"], "system"))
      : [],
    rejectedApproaches:
      review.reviewStatus === "wrong_direction"
        ? [item("rejected_approach", review.improvementCandidate.summary, null, createdAt, ["trial-review"], "system")]
        : [],
    completedMilestones: [item("completed_milestone", review.ownerReadableSummary, null, createdAt, ["trial-review"], "system")],
    currentBlockers: ["needs_clarification", "wrong_direction", "missing_requirement", "design_mismatch"].includes(review.reviewStatus)
      ? review.concerns.map((concern) => item("current_blocker", concern, null, createdAt, ["trial-review"], "system"))
      : [],
    openQuestions:
      review.reviewStatus === "needs_clarification"
        ? [item("open_question", review.improvementCandidate.summary, null, createdAt, ["trial-review"], "system")]
        : [],
    designPreferences:
      review.reviewStatus === "design_mismatch"
        ? [item("design_preference", review.improvementCandidate.summary, null, createdAt, ["trial-review"], "system")]
        : [],
    lessonsLearned: [item("lesson_learned", `Trial feedback: ${review.improvementCandidate.summary}`, null, createdAt, ["trial-review"], "system")],
    futureImprovements: [item("future_improvement", review.improvementCandidate.title, null, createdAt, ["trial-review"], "system")],
    progressHistory: [
      item("progress", review.ownerReadableSummary, null, createdAt, ["trial-review"], "system"),
      item("progress", review.nextPrompt.expectedOutcome, null, createdAt, ["trial-review"], "system")
    ],
    ownerFeedback: [ownerFeedback]
  };
}

function buildItemsFromOrchestratorRun(run: OrchestratorRun) {
  const createdAt = run.createdAt;
  const sourceTags = ["manual-orchestrator", run.selectedNextSafeAction];
  const blockerItems =
    run.status === "blocked"
      ? run.evidence.map((line) => item("current_blocker", line, null, createdAt, sourceTags, "system"))
      : [];
  const queuedItems = run.actionQueue.items.filter((action) => action.status === "queued" || action.status === "prepared_handoff");
  const completedItems = run.actionQueue.items.filter((action) => action.status === "completed");

  return {
    majorDecisions: [
      item(
        "major_decision",
        `Manual orchestrator selected ${run.selectedNextSafeAction.replace(/_/g, " ")} with status ${run.status.replace(/_/g, " ")}.`,
        null,
        createdAt,
        sourceTags,
        "system"
      )
    ],
    acceptedApproaches: [
      item("accepted_approach", "Keep manual orchestrator runs owner-reviewed and side-effect free.", null, createdAt, sourceTags, "system")
    ],
    completedMilestones: [
      item("completed_milestone", run.ownerReadableSummary, null, createdAt, sourceTags, "system"),
      ...completedItems.map((action) =>
        item("completed_milestone", `Completed queued orchestrator action: ${action.title}.`, null, createdAt, sourceTags, "system")
      )
    ],
    currentBlockers: blockerItems,
    openQuestions:
      run.status === "needs_owner_approval"
        ? [item("open_question", "Owner approval is needed before this orchestrator-selected action proceeds.", null, createdAt, sourceTags, "system")]
        : [],
    designPreferences: [
      item(
        "design_preference",
        run.inputArtifacts.designIntentProfile.summary,
        null,
        createdAt,
        ["manual-orchestrator", "design-intent"],
        "system"
      )
    ],
    lessonsLearned: [
      item("lesson_learned", `Manual orchestrator evidence: ${run.evidence.join(" | ")}`, null, createdAt, sourceTags, "system"),
      item(
        "lesson_learned",
        `Manual orchestrator confidence: ${run.decisionTrace.confidenceLevel} - ${run.decisionTrace.confidenceReason}`,
        null,
        createdAt,
        sourceTags,
        "system"
      )
    ],
    futureImprovements: [
      item("future_improvement", run.nextActionPrompt.expectedOutcome, null, createdAt, sourceTags, "system"),
      ...queuedItems.map((action) =>
        item("future_improvement", `Queued orchestrator action: ${action.title}.`, null, createdAt, sourceTags, "system")
      )
    ],
    progressHistory: [
      item("progress", run.ownerReadableSummary, null, createdAt, sourceTags, "system"),
      item("progress", run.nextActionPrompt.expectedOutcome, null, createdAt, sourceTags, "system"),
      item(
        "progress",
        `Decision trace considered ${run.decisionTrace.inputsConsidered.length} input(s) and selected ${run.decisionTrace.selectedAction}.`,
        null,
        createdAt,
        sourceTags,
        "system"
      ),
      ...run.actionQueue.items.map((action) =>
        item(
          "progress",
          `Action queue item ${action.id} is ${action.status.replace(/_/g, " ")}: ${action.expectedOutcome}`,
          null,
          createdAt,
          sourceTags,
          "system"
        )
      )
    ]
  };
}

function itemsFromLines(
  lines: string[],
  keywords: string[],
  category: ProjectMemoryItemCategory,
  sourceHandoffId: string,
  createdAt: string
) {
  return lines
    .filter((line) => keywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase())))
    .map((line) => item(category, line, sourceHandoffId, createdAt, keywords.slice(0, 3)));
}

function item(
  category: ProjectMemoryItemCategory,
  text: string,
  sourceHandoffId: string | null,
  createdAt: string,
  tags: string[] = [],
  source: ProjectMemoryItem["source"] = sourceHandoffId ? "handoff" : "owner_feedback"
): ProjectMemoryItem {
  const cleanText = text.trim().slice(0, 360);

  return {
    id: `memory_${category}_${hashText(`${category}:${cleanText}:${createdAt}`)}`,
    category,
    text: cleanText || "Memory item captured.",
    source,
    sourceHandoffId,
    createdAt,
    tags
  };
}

function withSummaries(memory: ProjectMemory): ProjectMemory {
  const latestProgress = firstText(memory.completedMilestones) || memory.latestProjectState.latestProgress || "No completed milestone recorded yet.";
  const currentBlocker = firstText(memory.currentBlockers) || "No active blocker recorded.";
  const decision = firstText(memory.majorDecisions) || "No major decision recorded yet.";
  const nextAction = memory.latestProjectState.recommendedNextAction || "Review current memory and decide the next safe action.";

  return {
    ...memory,
    summaries: {
      executive: `${memory.projectName} is ${memory.latestProjectState.currentState}. Latest progress: ${latestProgress} Next: ${nextAction}`,
      technical: `Latest decision: ${decision} Architecture notes: ${memory.architectureDecisions
        .slice(0, 2)
        .map((entry) => entry.text)
        .join(" | ") || "none recorded yet"}.`,
      projectStatus: `Current blocker: ${currentBlocker} Open questions: ${memory.openQuestions.length}. Recent progress items: ${memory.progressHistory.length}.`
    }
  };
}

function createEmptyProjectMemory(): ProjectMemory {
  const now = new Date(0).toISOString();

  return withSummaries({
    kind: "project_memory",
    schemaVersion: 1,
    projectName: "AppEngine",
    updatedAt: now,
    latestProjectState: {
      currentState: "No project memory captured yet",
      latestProgress: "No handoff has updated memory yet",
      recommendedNextAction: "Paste a handoff or add owner feedback to start project memory.",
      lastHandoffId: null
    },
    majorDecisions: [],
    acceptedApproaches: [],
    rejectedApproaches: [],
    completedMilestones: [],
    currentBlockers: [],
    openQuestions: [],
    architectureDecisions: [],
    designPreferences: [],
    lessonsLearned: [],
    futureImprovements: [],
    progressHistory: [],
    ownerFeedback: [],
    summaries: {
      executive: "",
      technical: "",
      projectStatus: ""
    },
    guardrails: defaultGuardrails()
  });
}

function normalizeProjectMemory(memory: Partial<ProjectMemory> | undefined): ProjectMemory {
  const empty = createEmptyProjectMemory();
  const normalized: ProjectMemory = {
    ...empty,
    ...(memory || {}),
    latestProjectState: {
      ...empty.latestProjectState,
      ...(memory?.latestProjectState || {})
    },
    summaries: {
      ...empty.summaries,
      ...(memory?.summaries || {})
    },
    guardrails: defaultGuardrails()
  };

  for (const key of [
    "majorDecisions",
    "acceptedApproaches",
    "rejectedApproaches",
    "completedMilestones",
    "currentBlockers",
    "openQuestions",
    "architectureDecisions",
    "designPreferences",
    "lessonsLearned",
    "futureImprovements",
    "progressHistory",
    "ownerFeedback"
  ] as const) {
    normalized[key] = Array.isArray(memory?.[key]) ? memory[key] : [];
  }

  return withSummaries(normalized);
}

function mergeItems(current: ProjectMemoryItem[], incoming: ProjectMemoryItem[], limit = 20) {
  const seen = new Set<string>();
  const merged: ProjectMemoryItem[] = [];

  for (const entry of [...incoming, ...current]) {
    const key = `${entry.category}:${normalizeText(entry.text)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  return merged.slice(0, limit);
}

function defaultGuardrails(): ProjectMemory["guardrails"] {
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

async function readStore(): Promise<StoreShape> {
  if (process.env.APPENGINE_STATE_ADAPTER === "memory_fallback") return memoryStore;

  const adapterStore = await projectMemoryStateStore.read(null);
  if (adapterStore?.memory) {
    return {
      memory: normalizeProjectMemory(adapterStore.memory)
    };
  }

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;

    return {
      memory: normalizeProjectMemory(parsed.memory)
    };
  } catch {
    return { memory: createEmptyProjectMemory() };
  }
}

async function writeStore(store: StoreShape) {
  const normalizedStore = {
    memory: normalizeProjectMemory(store.memory)
  };

  if (process.env.APPENGINE_STATE_ADAPTER === "memory_fallback") {
    memoryStore = normalizedStore;
    return;
  }

  await projectMemoryStateStore.write(normalizedStore);
}

function firstText(items: ProjectMemoryItem[]) {
  return items[0]?.text || "";
}

function cleanLine(line: string) {
  return line
    .replace(/^[-*]\s*/, "")
    .replace(/^#+\s*/, "")
    .replace(/^>\s*/, "")
    .replace(/`/g, "")
    .trim();
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function formatPr(handoff: HandoffRelaySummary) {
  return handoff.extracted.prNumber ? `PR #${handoff.extracted.prNumber}` : "the pasted handoff";
}

function feedbackCategory(choice: ProjectMemoryFeedbackChoice): ProjectMemoryItemCategory {
  const categories: Record<ProjectMemoryFeedbackChoice, ProjectMemoryItemCategory> = {
    important_decision: "major_decision",
    lesson_learned: "lesson_learned",
    bad_direction: "rejected_approach",
    keep_doing_this: "accepted_approach",
    future_improvement: "future_improvement"
  };

  return categories[choice];
}

function formatFeedbackChoice(choice: ProjectMemoryFeedbackChoice) {
  return choice.replace(/_/g, " ");
}

function isProjectMemoryFeedbackChoice(value: string): value is ProjectMemoryFeedbackChoice {
  return ["important_decision", "lesson_learned", "bad_direction", "keep_doing_this", "future_improvement"].includes(value);
}
