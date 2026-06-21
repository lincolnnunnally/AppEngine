import { randomUUID } from "node:crypto";
import { attachCompletedLoop } from "@/lib/engine/app-portfolio-registry-store";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";

export type AppEngineLoopStatus =
  | "idea"
  | "scoped"
  | "ready_to_build"
  | "building"
  | "testing"
  | "needs_fix"
  | "ready_to_deploy"
  | "deployed"
  | "improving"
  | "blocked"
  | "escalated";

export type AppEngineLoopRunRecord = {
  id: string;
  kind: "appengine_loop_run_record";
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  runId: string;
  goal: string;
  appIdea: string;
  problemBeingSolved: string;
  targetUser: string;
  acceptanceCriteria: string[];
  status: Extract<AppEngineLoopStatus, "scoped">;
  statusHistory: Array<{
    status: Extract<AppEngineLoopStatus, "idea" | "scoped">;
    at: string;
    decision: string;
  }>;
  agentAssigned: "manual_owner_review";
  cycleCount: 0;
  workCompleted: string[];
  testsRun: Array<{ command: string; result: string }>;
  issuesFound: string[];
  nextAction: "manual_review_before_ready_to_build";
  decisionMade: string;
  circuitBreaker: {
    maxCycles: 3;
    currentCycle: 0;
    actionIfFailedAfterMax: "escalated";
  };
  sourceOfTruthFiles: string[];
  guardrails: ReturnType<typeof loopRunGuardrails>;
  ownerReadableSummary: string;
};

type LoopRunStore = {
  schemaVersion: 1;
  records: AppEngineLoopRunRecord[];
};

type CreateLoopRunInput = {
  appIdea?: unknown;
  problemBeingSolved?: unknown;
  targetUser?: unknown;
  acceptanceCriteria?: unknown;
};

const sourceOfTruthFiles = [
  "APPENGINE_LOOP_SYSTEM.md",
  "agents/context/source-of-truth.md",
  "agents/manifest.yaml",
  "AGENTS.md",
  "docs/AGENT_ARCHITECTURE.md",
  "loop-runs/RUN_RECORD_TEMPLATE.md"
];

export function loopRunGuardrails() {
  return {
    ...durableStateGuardrails(),
    manualOnly: true,
    acceptanceCriteriaRequiredBeforeBuild: true,
    maxBuildTestReviewCycles: 3,
    circuitBreakerEscalatesAfterMaxCycles: true,
    noPullRequestCreation: true,
    noThinRouterScript: true,
    noEventTriggeredAutomation: true,
    ownerReviewRequiredBeforeBuild: true
  };
}

export async function listAppEngineLoopRunRecords() {
  const store = await readLoopRunStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Reposition a loop run as completed-loop evidence on the canonical
// app_portfolio_registry. The loop record stays the run ledger; the registry is
// the source of truth that shows the app/project plus its completed loops.
export async function attachLoopRunToRegistry(runId: string, options: { appSlug?: string; status?: string } = {}) {
  const store = await readLoopRunStore();
  const record = store.records.find((item) => item.runId === runId || item.id === runId);

  if (!record) {
    throw new Error("Loop run record not found.");
  }

  const slug = options.appSlug || slugify(record.appIdea);
  return attachCompletedLoop(slug, {
    runId: record.runId,
    goal: record.goal,
    status: options.status || "completed",
    cycleCount: record.cycleCount,
    evidence: record.acceptanceCriteria
  });
}

export async function createAppEngineLoopRunRecord(input: CreateLoopRunInput, now = new Date()) {
  const createdAt = now.toISOString();
  const normalized = normalizeLoopRunInput(input);
  const slug = slugify(normalized.appIdea);
  const runId = `loop-${createdAt.slice(0, 10)}-${slug}-${randomUUID().slice(0, 8)}`;
  const goal = `Create ${normalized.appIdea}`;
  const record: AppEngineLoopRunRecord = {
    id: runId,
    kind: "appengine_loop_run_record",
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
    runId,
    goal,
    ...normalized,
    status: "scoped",
    statusHistory: [
      {
        status: "idea",
        at: createdAt,
        decision: "Idea captured by internal AppEngine loop intake."
      },
      {
        status: "scoped",
        at: createdAt,
        decision: "Problem, target user, and acceptance criteria were captured before any build work."
      }
    ],
    agentAssigned: "manual_owner_review",
    cycleCount: 0,
    workCompleted: ["Loop run record saved from internal intake before build work started."],
    testsRun: [],
    issuesFound: [],
    nextAction: "manual_review_before_ready_to_build",
    decisionMade: "Scoped for owner review. No build, worker, issue, label, pull request, deploy, migration, paid resource, or secret change was triggered.",
    circuitBreaker: {
      maxCycles: 3,
      currentCycle: 0,
      actionIfFailedAfterMax: "escalated"
    },
    sourceOfTruthFiles,
    guardrails: loopRunGuardrails(),
    ownerReadableSummary: `${normalized.appIdea} is scoped with ${normalized.acceptanceCriteria.length} acceptance criteria. Next: manual review before ready_to_build.`
  };

  const store = await readLoopRunStore();
  store.records.unshift(record);
  await writeLoopRunStore(store);
  return record;
}

function normalizeLoopRunInput(input: CreateLoopRunInput) {
  const appIdea = cleanText(input.appIdea);
  const problemBeingSolved = cleanText(input.problemBeingSolved);
  const targetUser = cleanText(input.targetUser);
  const acceptanceCriteria = splitCriteria(input.acceptanceCriteria);
  const missing = [];

  if (appIdea.length < 4) missing.push("app idea");
  if (problemBeingSolved.length < 8) missing.push("problem being solved");
  if (targetUser.length < 4) missing.push("target user");
  if (!acceptanceCriteria.length) missing.push("at least one acceptance criterion");

  if (missing.length) {
    throw new Error(`Please add: ${missing.join(", ")}.`);
  }

  return {
    appIdea,
    problemBeingSolved,
    targetUser,
    acceptanceCriteria
  };
}

async function readLoopRunStore(): Promise<LoopRunStore> {
  return getAppEngineStateAdapter().readJson<LoopRunStore>(loopRunStoreScope(), {
    schemaVersion: 1,
    records: []
  });
}

async function writeLoopRunStore(store: LoopRunStore) {
  await getAppEngineStateAdapter().writeJson(loopRunStoreScope(), store);
}

function loopRunStoreScope() {
  return { kind: "loop_run_records" as const, key: "manual-loop-runs" };
}

function splitCriteria(value: unknown) {
  if (typeof value !== "string") return [];

  return value
    .split(/\r?\n/)
    .map((item) => cleanText(item.replace(/^[-*]\s*/, "")))
    .filter((item) => item.length >= 4);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);

  return slug || "manual-run";
}
