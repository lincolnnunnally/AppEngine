import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.TRIAL_RESULT_REVIEW_INPUT || "";
const outputPath = process.env.TRIAL_RESULT_REVIEW_OUTPUT || "";
const memoryOutputPath = process.env.TRIAL_RESULT_REVIEW_MEMORY_OUTPUT || "";

if (!inputPath || !fs.existsSync(path.resolve(inputPath))) {
  throw new Error("Trial result review needs an input JSON file.");
}

const input = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
const trials = Array.isArray(input.trials) ? input.trials : input.trial ? [input.trial] : [];
const projectMemory = input.projectMemory || input.project_memory || null;
const reviewInput = input.review || input.trialResultReview || input.trial_result_review || input;
const review = createTrialResultReview(reviewInput, trials, projectMemory);
const memory = updateProjectMemory(projectMemory || createEmptyMemory(), review);

if (outputPath) writeJson(outputPath, review);
if (memoryOutputPath) writeJson(memoryOutputPath, memory);

console.log(`trial-result-review ok: ${review.project.slug} -> ${review.reviewStatus}`);

function createTrialResultReview(input, trials, projectMemory) {
  const trial = resolveTrial(input, trials);
  const reviewStatus = normalizeReviewStatus(input.status || input.reviewStatus);
  const ownerNote = String(input.note || input.ownerNote || "").trim().slice(0, 1600);
  const createdAt = new Date().toISOString();
  const improvementCandidate = buildImprovementCandidate({ trial, reviewStatus, ownerNote });
  const nextPrompt = buildNextPrompt({ trial, reviewStatus, ownerNote, projectMemory, improvementCandidate });

  return {
    kind: "trial_result_review",
    schemaVersion: 1,
    id: `trial_review_${trial.project.slug}_${Date.now().toString(36)}`,
    createdAt,
    trialId: trial.id,
    project: trial.project,
    reviewStatus,
    ownerNote,
    usefulSignals: ["useful", "ready_for_next_packet"].includes(reviewStatus)
      ? [
          `Problem is clear: ${trial.problemBeingSolved}`,
          `Audience is clear: ${trial.targetAudience}`,
          `Recommended packet type is ${formatPacketType(trial.recommendedPacketType)}.`
        ]
      : [],
    concerns: concernsFor(reviewStatus, ownerNote),
    improvementCandidate,
    nextPrompt,
    ownerReadableSummary: `${trial.project.name} review marked ${reviewStatus.replace(/_/g, " ")}. Next: ${nextPrompt.expectedOutcome}`,
    guardrails: defaultGuardrails()
  };
}

function resolveTrial(input, trials) {
  const trial = input.trialId ? trials.find((candidate) => candidate.id === input.trialId) : trials[0];
  if (!trial) throw new Error("Trial result review needs a real project trial to review.");
  return trial;
}

function normalizeReviewStatus(value) {
  const normalized = String(value || "").trim();
  const allowed = ["useful", "needs_clarification", "wrong_direction", "missing_requirement", "design_mismatch", "ready_for_next_packet"];
  if (!allowed.includes(normalized)) {
    throw new Error(`Unsupported trial result review status: ${normalized || "missing"}`);
  }
  return normalized;
}

function buildImprovementCandidate({ trial, reviewStatus, ownerNote }) {
  const defaults = {
    useful: ["packet_progression", `${trial.project.name}: preserve useful trial direction`, "Owner marked the trial result useful."],
    needs_clarification: [
      "clarification",
      `${trial.project.name}: clarify trial result before packet work`,
      "Owner needs clearer problem, audience, scope, risks, or next action before packet work."
    ],
    wrong_direction: [
      "direction_correction",
      `${trial.project.name}: correct trial direction`,
      "Owner marked the trial direction wrong. Re-check source-of-truth and app boundaries before proceeding."
    ],
    missing_requirement: [
      "requirement_gap",
      `${trial.project.name}: add missing trial requirement`,
      "Owner found a missing requirement that must be added before next packet work."
    ],
    design_mismatch: [
      "design_correction",
      `${trial.project.name}: correct design intent mismatch`,
      "Owner found a design mismatch. Update design intent before UI or packet progression."
    ],
    ready_for_next_packet: [
      "packet_progression",
      `${trial.project.name}: proceed to next packet`,
      `Owner marked the trial ready for ${formatPacketType(trial.recommendedPacketType)} progression.`
    ]
  };
  const [candidateType, title, summary] = defaults[reviewStatus];

  return {
    title,
    summary: ownerNote || summary,
    candidateType
  };
}

function concernsFor(reviewStatus, ownerNote) {
  const concerns = {
    useful: [],
    ready_for_next_packet: [],
    needs_clarification: ["Owner needs clarification before packet work."],
    wrong_direction: ["Owner marked the trial direction wrong."],
    missing_requirement: ["Owner identified a missing requirement."],
    design_mismatch: ["Owner identified a design mismatch."]
  }[reviewStatus];

  return [...concerns, ...(ownerNote ? [`Owner note: ${ownerNote}`] : [])];
}

function buildNextPrompt({ trial, reviewStatus, ownerNote, projectMemory, improvementCandidate }) {
  const actionByStatus = {
    useful: `Preserve the useful direction and prepare the next ${formatPacketType(trial.recommendedPacketType)} checkpoint.`,
    needs_clarification: "Create a clarification-only pass before packet work.",
    wrong_direction: "Re-route the trial through source-of-truth and candidate review before packet work.",
    missing_requirement: "Update the trial requirements before packet work.",
    design_mismatch: "Update design intent before packet work or UI work.",
    ready_for_next_packet: `Prepare the next ${formatPacketType(trial.recommendedPacketType)} path for owner review.`
  };
  const memorySummary = projectMemory?.summaries?.executive || projectMemory?.latestProjectState?.recommendedNextAction || "Project memory not loaded.";

  return {
    prompt: [
      `Review the trial result for ${trial.project.name}.`,
      "",
      "Owner review:",
      `- Status: ${reviewStatus.replace(/_/g, " ")}`,
      `- Note: ${ownerNote || "No owner note provided."}`,
      `- Improvement candidate: ${improvementCandidate.title}`,
      `- Candidate type: ${improvementCandidate.candidateType}`,
      "",
      "Trial summary:",
      `- Problem: ${trial.problemBeingSolved}`,
      `- Audience: ${trial.targetAudience}`,
      `- Desired transformation: ${trial.desiredTransformation}`,
      `- Design intent: ${trial.designIntent}`,
      `- Current stage: ${trial.currentStage}`,
      `- Recommended packet type: ${formatPacketType(trial.recommendedPacketType)}`,
      "",
      "Next safe action:",
      actionByStatus[reviewStatus],
      "",
      "Project memory snapshot:",
      memorySummary,
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
      "- Do not auto-merge generated app code."
    ].join("\n"),
    reason: `Owner marked the trial as ${reviewStatus.replace(/_/g, " ")}, so AppEngine should convert that feedback into a bounded improvement candidate before further work.`,
    expectedOutcome: actionByStatus[reviewStatus],
    dependencies: [...(trial.nextPrompt?.dependencies || []), "source-of-truth/trial-result-review-loop.md"]
  };
}

function updateProjectMemory(current, review) {
  const memory = {
    ...createEmptyMemory(),
    ...(current || {}),
    updatedAt: review.createdAt,
    latestProjectState: {
      currentState: `${review.project.name} trial reviewed as ${review.reviewStatus.replace(/_/g, " ")}`,
      latestProgress: review.ownerReadableSummary,
      recommendedNextAction: review.nextPrompt.expectedOutcome,
      lastHandoffId: current?.latestProjectState?.lastHandoffId || null
    },
    completedMilestones: [{ text: review.ownerReadableSummary }, ...(current?.completedMilestones || [])],
    currentBlockers: review.concerns.map((text) => ({ text })),
    futureImprovements: [{ text: review.improvementCandidate.title }, ...(current?.futureImprovements || [])],
    ownerFeedback: [{ text: `${review.reviewStatus.replace(/_/g, " ")}: ${review.ownerNote || review.improvementCandidate.summary}` }, ...(current?.ownerFeedback || [])],
    progressHistory: [{ text: review.nextPrompt.expectedOutcome }, ...(current?.progressHistory || [])],
    guardrails: defaultGuardrails()
  };

  memory.summaries = {
    executive: `AppEngine is ${memory.latestProjectState.currentState}. Latest progress: ${memory.latestProjectState.latestProgress} Next: ${memory.latestProjectState.recommendedNextAction}`,
    technical: `Latest trial review: ${review.improvementCandidate.title}.`,
    projectStatus: `Current blocker: ${memory.currentBlockers[0]?.text || "No active blocker recorded."} Open questions: ${memory.openQuestions?.length || 0}. Recent progress items: ${memory.progressHistory.length}.`
  };

  return memory;
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

function formatPacketType(value) {
  return (
    {
      app_build_packet: "App Build Packet",
      vnext_packet: "vNext Packet",
      non_app_solution_plan: "Non-App Solution Plan"
    }[value] || value
  );
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

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}
