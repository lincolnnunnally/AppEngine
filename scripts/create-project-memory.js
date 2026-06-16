import fs from "node:fs";
import path from "node:path";

const handoffPath = process.env.PROJECT_MEMORY_HANDOFF || "";
const existingPath = process.env.PROJECT_MEMORY_INPUT || "";
const outputPath = process.env.PROJECT_MEMORY_OUTPUT || "";
const feedbackChoices = (process.env.PROJECT_MEMORY_FEEDBACK_CHOICES || "")
  .split(",")
  .map((choice) => choice.trim())
  .filter(Boolean);
const feedbackNote = (process.env.PROJECT_MEMORY_FEEDBACK_NOTE || "").trim();

if (!handoffPath && !feedbackChoices.length && !feedbackNote) {
  throw new Error("Project memory needs a handoff summary or owner feedback.");
}

const existing = existingPath && fs.existsSync(path.resolve(existingPath)) ? JSON.parse(fs.readFileSync(path.resolve(existingPath), "utf8")) : createEmptyMemory();
const handoff = handoffPath ? JSON.parse(fs.readFileSync(path.resolve(handoffPath), "utf8")) : null;
const memory = updateMemory(existing.kind === "project_memory" ? existing : existing.memory || createEmptyMemory(), handoff, feedbackChoices, feedbackNote);

if (outputPath) {
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(memory, null, 2)}\n`);
}

console.log(`project-memory ok: ${memory.latestProjectState.currentState}`);

function updateMemory(current, handoff, choices, note) {
  const now = new Date().toISOString();
  const next = {
    ...createEmptyMemory(),
    ...current,
    updatedAt: handoff?.receivedAt || now,
    guardrails: defaultGuardrails()
  };

  if (handoff) {
    next.latestProjectState = {
      currentState: handoff.projectState?.currentStatus || "Captured for review",
      latestProgress: handoff.projectState?.latestCompletedMilestone || handoff.ownerReadableSummary || "Handoff captured",
      recommendedNextAction: handoff.projectState?.recommendedNextAction || "Review next safe action.",
      lastHandoffId: handoff.id || null
    };
    next.majorDecisions = mergeItems(next.majorDecisions, [
      item("major_decision", `${formatPr(handoff)} recorded with status ${handoff.extracted?.mergeStatus || "unknown"}.`, handoff.id, handoff.receivedAt)
    ]);
    next.completedMilestones = mergeItems(next.completedMilestones, [
      item("completed_milestone", next.latestProjectState.latestProgress, handoff.id, handoff.receivedAt),
      ...(handoff.extracted?.completedWork || []).map((line) => item("completed_milestone", line, handoff.id, handoff.receivedAt))
    ]);
    next.currentBlockers = (handoff.extracted?.blockers || []).map((line) => item("current_blocker", line, handoff.id, handoff.receivedAt));
    next.openQuestions = mergeItems(
      next.openQuestions,
      (handoff.extracted?.dependencies || []).map((line) => item("open_question", `Confirm dependency: ${line}`, handoff.id, handoff.receivedAt))
    );
    next.architectureDecisions = mergeItems(
      next.architectureDecisions,
      findLines(handoff.rawText || "", ["architecture", "route", "api", "schema", "auth", "artifact"]).map((line) =>
        item("architecture_decision", line, handoff.id, handoff.receivedAt)
      )
    );
    next.designPreferences = mergeItems(
      next.designPreferences,
      findLines(handoff.rawText || "", ["design", "mobile", "warm", "clean", "approachable", "ui"]).map((line) =>
        item("design_preference", line, handoff.id, handoff.receivedAt)
      )
    );
    next.progressHistory = mergeItems(next.progressHistory, [
      item("progress", handoff.ownerReadableSummary || next.latestProjectState.latestProgress, handoff.id, handoff.receivedAt),
      item("progress", next.latestProjectState.recommendedNextAction, handoff.id, handoff.receivedAt)
    ]);
  }

  if (choices.length || note) {
    const feedbackItems = choices.length
      ? choices.map((choice) => item(feedbackCategory(choice), `${choice.replace(/_/g, " ")}: ${note || "Owner marked this memory category."}`, null, now))
      : [item("future_improvement", note, null, now)];

    next.majorDecisions = mergeItems(next.majorDecisions, feedbackItems.filter((entry) => entry.category === "major_decision"));
    next.acceptedApproaches = mergeItems(next.acceptedApproaches, feedbackItems.filter((entry) => entry.category === "accepted_approach"));
    next.rejectedApproaches = mergeItems(next.rejectedApproaches, feedbackItems.filter((entry) => entry.category === "rejected_approach"));
    next.lessonsLearned = mergeItems(next.lessonsLearned, feedbackItems.filter((entry) => entry.category === "lesson_learned"));
    next.futureImprovements = mergeItems(next.futureImprovements, feedbackItems.filter((entry) => entry.category === "future_improvement"));
    next.ownerFeedback = mergeItems(next.ownerFeedback, feedbackItems, 30);
  }

  next.summaries = summaries(next);
  return next;
}

function createEmptyMemory() {
  return {
    kind: "project_memory",
    schemaVersion: 1,
    projectName: "AppEngine",
    updatedAt: new Date(0).toISOString(),
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
  };
}

function summaries(memory) {
  const latestProgress = memory.completedMilestones[0]?.text || memory.latestProjectState.latestProgress;
  const currentBlocker = memory.currentBlockers[0]?.text || "No active blocker recorded.";
  const decision = memory.majorDecisions[0]?.text || "No major decision recorded yet.";

  return {
    executive: `AppEngine is ${memory.latestProjectState.currentState}. Latest progress: ${latestProgress} Next: ${memory.latestProjectState.recommendedNextAction}`,
    technical: `Latest decision: ${decision} Architecture notes: ${memory.architectureDecisions.map((entry) => entry.text).slice(0, 2).join(" | ") || "none recorded yet"}.`,
    projectStatus: `Current blocker: ${currentBlocker} Open questions: ${memory.openQuestions.length}. Recent progress items: ${memory.progressHistory.length}.`
  };
}

function item(category, text, sourceHandoffId, createdAt) {
  const cleanText = String(text || "").trim().slice(0, 360) || "Memory item captured.";

  return {
    id: `memory_${category}_${hashText(`${category}:${cleanText}:${createdAt}`)}`,
    category,
    text: cleanText,
    source: sourceHandoffId ? "handoff" : "owner_feedback",
    sourceHandoffId: sourceHandoffId || null,
    createdAt: createdAt || new Date().toISOString(),
    tags: []
  };
}

function mergeItems(current, incoming, limit = 20) {
  const seen = new Set();
  const merged = [];

  for (const entry of [...incoming, ...current]) {
    const key = `${entry.category}:${entry.text.toLowerCase().replace(/\s+/g, " ").trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  return merged.slice(0, limit);
}

function findLines(text, keywords) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").replace(/^#+\s*/, "").replace(/`/g, "").trim())
    .filter((line) => line.length > 3 && keywords.some((keyword) => line.toLowerCase().includes(keyword)));
}

function feedbackCategory(choice) {
  return (
    {
      important_decision: "major_decision",
      lesson_learned: "lesson_learned",
      bad_direction: "rejected_approach",
      keep_doing_this: "accepted_approach",
      future_improvement: "future_improvement"
    }[choice] || "future_improvement"
  );
}

function formatPr(handoff) {
  return handoff.extracted?.prNumber ? `PR #${handoff.extracted.prNumber}` : "Handoff";
}

function hashText(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function defaultGuardrails() {
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
