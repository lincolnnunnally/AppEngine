import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.ORCHESTRATOR_RUN_INPUT || "";
const outputPath = process.env.ORCHESTRATOR_RUN_OUTPUT || "";
const memoryOutputPath = process.env.ORCHESTRATOR_RUN_MEMORY_OUTPUT || "";

if (!inputPath || !fs.existsSync(path.resolve(inputPath))) {
  throw new Error("Orchestrator run needs an input JSON file.");
}

const input = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
const projectMemory = normalizeMemory(input.projectMemory || input.project_memory || createEmptyMemory());
const handoffs = Array.isArray(input.handoffs) ? input.handoffs : input.handoff ? [input.handoff] : [];
const trials = Array.isArray(input.trials) ? input.trials : input.trial ? [input.trial] : [];
const run = createOrchestratorRun({ projectMemory, handoffs, trials });
const memory = updateMemory(projectMemory, run);

if (outputPath) writeJson(outputPath, run);
if (memoryOutputPath) writeJson(memoryOutputPath, memory);

console.log(`orchestrator-run ok: ${run.selectedNextSafeAction} -> ${run.status}`);

function createOrchestratorRun({ projectMemory, handoffs, trials }) {
  const latestHandoff = newest(handoffs, "receivedAt");
  const latestTrial = newest(trials, "createdAt");
  const blockers = (projectMemory.currentBlockers || [])
    .map((item) => item.text)
    .filter((text) => text && isActionableBlocker(text))
    .slice(0, 5);
  const decision = chooseNextAction({ projectMemory, latestHandoff, latestTrial, blockers });
  const createdAt = new Date().toISOString();

  return {
    kind: "orchestrator_run",
    schemaVersion: 1,
    id: `orchestrator_run_${Date.now().toString(36)}`,
    createdAt,
    status: decision.status,
    selectedNextSafeAction: decision.action,
    reason: decision.reason,
    projectStateSummary: {
      currentState: projectMemory.latestProjectState.currentState,
      latestProgress: projectMemory.latestProjectState.latestProgress,
      currentBlockers: blockers,
      recommendedNextAction: projectMemory.latestProjectState.recommendedNextAction
    },
    inputArtifacts: buildInputArtifacts({ projectMemory, latestHandoff, latestTrial }),
    nextActionPrompt: buildPrompt({ decision, projectMemory, latestHandoff, latestTrial }),
    evidence: decision.evidence,
    ownerReadableSummary: `AppEngine chose ${decision.action.replace(/_/g, " ")} because ${decision.reason}`,
    guardrails: defaultGuardrails()
  };
}

function chooseNextAction({ projectMemory, latestHandoff, latestTrial, blockers }) {
  if (blockers.length) {
    return {
      status: "blocked",
      action: "resolve_current_blocker",
      reason: "Project Memory has an active blocker, so AppEngine should not start a new phase.",
      evidence: blockers
    };
  }

  const handoffBlockers = latestHandoff?.extracted?.blockers?.filter(isActionableBlocker) || [];

  if (handoffBlockers.length) {
    return {
      status: "blocked",
      action: "resolve_handoff_blocker",
      reason: "The latest handoff contains unresolved blocker language.",
      evidence: handoffBlockers.slice(0, 5)
    };
  }

  if (latestHandoff?.extracted?.prNumber && latestHandoff.extracted.mergeStatus !== "merged") {
    return {
      status: "needs_owner_approval",
      action: "review_open_pr_before_next_work",
      reason: `The latest handoff points to PR #${latestHandoff.extracted.prNumber}, which should stay owner-reviewed before AppEngine advances.`,
      evidence: [latestHandoff.ownerReadableSummary, latestHandoff.projectState?.recommendedNextAction].filter(Boolean)
    };
  }

  if (latestTrial) {
    return {
      status: "ran_successfully",
      action: "review_latest_trial_and_prepare_next_packet",
      reason: `${latestTrial.project.name} already has a real-project trial, so the safest next step is owner-reviewed packet progression.`,
      evidence: [latestTrial.ownerReadableSummary, latestTrial.nextSafeAction].filter(Boolean)
    };
  }

  const memoryNext = projectMemory.latestProjectState.recommendedNextAction;
  if (memoryNext && !/paste a handoff|start project memory/i.test(memoryNext)) {
    return {
      status: "ran_successfully",
      action: "follow_project_memory_next_action",
      reason: "Project Memory already has a recorded next safe action.",
      evidence: [memoryNext, projectMemory.summaries.executive].filter(Boolean)
    };
  }

  return {
    status: "ran_successfully",
    action: "create_real_project_trial",
    reason: "No blocker, open PR handoff, or recent trial was found, so the safest useful action is a real-project trial.",
    evidence: ["No active blockers found.", "No recent trial found.", "No open PR handoff requiring owner approval found."]
  };
}

function buildInputArtifacts({ projectMemory, latestHandoff, latestTrial }) {
  return {
    projectMemory: artifact("project_memory", "available", projectMemory.summaries.executive, ["source-of-truth/project-memory-engine.md"]),
    handoffRelaySummary: artifact(
      "handoff_relay_summary",
      latestHandoff ? "available" : "missing",
      latestHandoff?.ownerReadableSummary || "No pasted handoff has been captured yet.",
      ["source-of-truth/handoff-relay-reducer.md"]
    ),
    realProjectTrial: artifact(
      "real_project_trial",
      latestTrial ? "available" : "missing",
      latestTrial?.ownerReadableSummary || "No real-project trial has been generated yet.",
      ["source-of-truth/real-project-trial-runner.md"]
    ),
    designIntentProfile: artifact(
      "design_intent_profile",
      "derived",
      latestTrial?.designIntent || "Use AppEngine's warm, approachable, clean, practical, trustworthy default design intent.",
      ["source-of-truth/design-intent-engine.md"]
    ),
    appPortfolioRegistry: artifact(
      "app_portfolio_registry",
      "derived",
      latestTrial ? `${latestTrial.project.name} is represented as the active portfolio candidate.` : "Portfolio registry should be loaded before packet work.",
      ["source-of-truth/app-portfolio-registry.md"]
    )
  };
}

function buildPrompt({ decision, projectMemory, latestHandoff, latestTrial }) {
  const expectedOutcome = expectedOutcomeFor(decision.action);
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
    latestHandoff ? `- ${latestHandoff.ownerReadableSummary}` : "- No handoff relay summary is available.",
    "",
    "Latest real project trial:",
    latestTrial ? `- ${latestTrial.ownerReadableSummary}` : "- No real project trial is available.",
    "",
    "Use these existing AppEngine artifacts where possible:",
    "- project_memory",
    "- handoff_relay_summary",
    "- real_project_trial",
    "- design_intent_profile",
    "- app_portfolio_registry",
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
    expectedOutcome
  ].join("\n");

  return {
    prompt,
    reason: decision.reason,
    expectedOutcome,
    dependencies: [
      "source-of-truth/manual-orchestrator-run-button.md",
      "source-of-truth/project-memory-engine.md",
      "source-of-truth/handoff-relay-reducer.md",
      "source-of-truth/real-project-trial-runner.md",
      "source-of-truth/design-intent-engine.md",
      "source-of-truth/app-portfolio-registry.md"
    ]
  };
}

function updateMemory(memory, run) {
  const progress = item("progress", run.ownerReadableSummary, run.createdAt, ["manual-orchestrator"]);

  return {
    ...memory,
    updatedAt: run.createdAt,
    latestProjectState: {
      ...memory.latestProjectState,
      currentState: `Manual orchestrator ${run.status.replace(/_/g, " ")}`,
      latestProgress: run.ownerReadableSummary,
      recommendedNextAction: run.nextActionPrompt.expectedOutcome
    },
    completedMilestones: [item("completed_milestone", run.ownerReadableSummary, run.createdAt, ["manual-orchestrator"]), ...memory.completedMilestones].slice(0, 20),
    currentBlockers:
      run.status === "blocked"
        ? [...run.evidence.map((line) => item("current_blocker", line, run.createdAt, ["manual-orchestrator"])), ...memory.currentBlockers].slice(0, 20)
        : memory.currentBlockers,
    progressHistory: [progress, ...memory.progressHistory].slice(0, 30),
    futureImprovements: [item("future_improvement", run.nextActionPrompt.expectedOutcome, run.createdAt, ["manual-orchestrator"]), ...memory.futureImprovements].slice(0, 20),
    guardrails: defaultGuardrails(),
    summaries: {
      executive: `AppEngine is ${run.status.replace(/_/g, " ")}. Latest progress: ${run.ownerReadableSummary} Next: ${run.nextActionPrompt.expectedOutcome}`,
      technical: `Manual orchestrator used ${Object.keys(run.inputArtifacts).join(", ")} and selected ${run.selectedNextSafeAction}.`,
      projectStatus: `Current blockers: ${run.projectStateSummary.currentBlockers.length}. Evidence: ${run.evidence.length}.`
    }
  };
}

function expectedOutcomeFor(action) {
  const outcomes = {
    resolve_current_blocker: "Create or request a focused blocker-resolution step before new work proceeds.",
    resolve_handoff_blocker: "Create or request a focused handoff blocker fix before new work proceeds.",
    review_open_pr_before_next_work: "Owner reviews the open PR and decides whether it is ready before AppEngine advances.",
    review_latest_trial_and_prepare_next_packet: "Owner reviews the latest trial and prepares the correct packet path without starting implementation.",
    follow_project_memory_next_action: "Carry out the next Project Memory action in owner-review mode only.",
    create_real_project_trial: "Generate a real-project trial summary before packet or build work."
  };

  return outcomes[action] || "Produce the next owner-reviewed AppEngine action without external side effects.";
}

function artifact(kind, status, summary, sourceFiles) {
  return { kind, status, summary, sourceFiles };
}

function newest(items, key) {
  return [...items].sort((a, b) => String(b[key] || "").localeCompare(String(a[key] || "")))[0] || null;
}

function isActionableBlocker(value) {
  const text = String(value || "").toLowerCase();
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

function normalizeMemory(memory) {
  const empty = createEmptyMemory();
  return {
    ...empty,
    ...memory,
    latestProjectState: {
      ...empty.latestProjectState,
      ...(memory.latestProjectState || {})
    },
    summaries: {
      ...empty.summaries,
      ...(memory.summaries || {})
    },
    guardrails: defaultGuardrails()
  };
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
      executive: "No project memory captured yet.",
      technical: "No technical memory captured yet.",
      projectStatus: "No status memory captured yet."
    },
    guardrails: defaultGuardrails()
  };
}

function item(category, text, createdAt, tags) {
  return {
    id: `memory_${category}_${Math.abs(hashText(`${category}:${text}:${createdAt}`)).toString(36)}`,
    category,
    text,
    source: "system",
    sourceHandoffId: null,
    createdAt,
    tags
  };
}

function defaultGuardrails() {
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(path.resolve(filePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashText(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return hash;
}
