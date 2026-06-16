import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HandoffRelaySummary } from "./handoff-relay";
import type { OrchestratorActionQueueItem, OrchestratorRun } from "./orchestrator-run";
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
  if (process.env.VERCEL === "1") return memoryStore;

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
  if (process.env.VERCEL === "1") {
    memoryStore = store;
    return;
  }

  await mkdir(storeDir, { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
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
