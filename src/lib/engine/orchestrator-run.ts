import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HandoffRelaySummary } from "./handoff-relay";
import type { ProjectMemory } from "./project-memory";
import type { RealProjectTrialSummary } from "./real-project-trial";

export type OrchestratorRunStatus = "ready_to_run" | "ran_successfully" | "needs_owner_approval" | "blocked" | "failed_honestly";

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
};

const storeDir = join(process.cwd(), ".app-engine");
const storePath = join(storeDir, "orchestrator-runs.json");
let memoryStore: StoreShape = { runs: [] };

export async function listOrchestratorRuns() {
  const store = await readStore();

  return store.runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveOrchestratorRun(input: OrchestratorInput) {
  const store = await readStore();
  const run = createOrchestratorRun(input);
  store.runs = [run, ...store.runs].slice(0, 50);
  await writeStore(store);

  return run;
}

export function createOrchestratorRun(input: OrchestratorInput, now = new Date()): OrchestratorRun {
  const projectMemory = input.projectMemory;
  const latestHandoff = newest(input.handoffs || [], "receivedAt");
  const latestTrial = newest(input.trials || [], "createdAt");
  const blockers = projectMemory.currentBlockers
    .map((item) => item.text)
    .filter((text) => text && isActionableBlocker(text))
    .slice(0, 5);
  const decision = chooseNextAction({ projectMemory, latestHandoff, latestTrial, blockers });
  const createdAt = now.toISOString();
  const id = `orchestrator_run_${now.getTime().toString(36)}`;

  return {
    kind: "orchestrator_run",
    schemaVersion: 1,
    id,
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
    inputArtifacts: buildInputReferences({ projectMemory, latestHandoff, latestTrial }),
    nextActionPrompt: buildNextPrompt({ decision, projectMemory, latestHandoff, latestTrial }),
    evidence: decision.evidence,
    ownerReadableSummary: `AppEngine chose ${decision.action.replace(/_/g, " ")} because ${decision.reason}`,
    guardrails: defaultGuardrails()
  };
}

function chooseNextAction({
  projectMemory,
  latestHandoff,
  latestTrial,
  blockers
}: {
  projectMemory: ProjectMemory;
  latestHandoff: HandoffRelaySummary | null;
  latestTrial: RealProjectTrialSummary | null;
  blockers: string[];
}) {
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
  latestTrial
}: {
  decision: ReturnType<typeof chooseNextAction>;
  projectMemory: ProjectMemory;
  latestHandoff: HandoffRelaySummary | null;
  latestTrial: RealProjectTrialSummary | null;
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
      "source-of-truth/app-portfolio-registry.md"
    ]
  };
}

function buildInputReferences({
  projectMemory,
  latestHandoff,
  latestTrial
}: {
  projectMemory: ProjectMemory;
  latestHandoff: HandoffRelaySummary | null;
  latestTrial: RealProjectTrialSummary | null;
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
    create_real_project_trial: "Generate a real-project trial summary before packet or build work."
  };

  return outcomes[action] || "Produce the next owner-reviewed AppEngine action without external side effects.";
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
      runs: Array.isArray(parsed.runs) ? parsed.runs.map(normalizeRun).filter(isOrchestratorRun) : []
    };
  } catch {
    return { runs: [] };
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
    guardrails: defaultGuardrails()
  };
}

function isOrchestratorRun(value: OrchestratorRun | null): value is OrchestratorRun {
  return Boolean(value);
}

function isRunStatus(value: string): value is OrchestratorRunStatus {
  return ["ready_to_run", "ran_successfully", "needs_owner_approval", "blocked", "failed_honestly"].includes(value);
}
