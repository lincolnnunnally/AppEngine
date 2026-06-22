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
  | "escalated"
  // Non-build (process / workflow / human-responsibility) loops.
  | "ready_to_run"
  | "running"
  | "completed";

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

// Canonical execution record: the single execution trail from an approved packet
// to a verified result. Stored under the loop_run_records store (key
// "execution-loops") so loop_run_records is the one canonical execution record.
export type AppEngineLoopExecutionRecord = {
  id: string;
  kind: "appengine_loop_execution_record";
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  runId: string;
  appSlug: string;
  gatePacketId: string;
  candidatePacketId: string;
  priorWorkVerdict: string;
  packetKind: string;
  solutionClass: "non_build" | "software";
  goal: string;
  acceptanceCriteria: string[];
  status: AppEngineLoopStatus;
  cycleCount: number;
  result: "pending" | "verified" | "failed";
  blockers: string[];
  nextAction: string;
  evidence: string[];
  statusHistory: Array<{ status: AppEngineLoopStatus; at: string; note: string }>;
  guardrails: ReturnType<typeof loopRunGuardrails>;
  ownerReadableSummary: string;
};

type LoopExecutionStore = {
  schemaVersion: 1;
  records: AppEngineLoopExecutionRecord[];
};

type CreateLoopFromPacketInput = {
  gatePacketId?: unknown;
  appSlug?: unknown;
  appName?: unknown;
  packetKind?: unknown;
  goal?: unknown;
  acceptanceCriteria?: unknown;
  priorWork?: { verdict?: unknown; passed?: unknown };
  candidatePacketId?: unknown;
};

type CompleteLoopOutcome = {
  result?: "verified" | "failed";
  evidence?: unknown;
  blockers?: unknown;
  nextAction?: unknown;
  cycleCount?: unknown;
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

export async function listLoopExecutionRecords() {
  const store = await readExecutionStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLoopExecutionRecord(runId: string) {
  const store = await readExecutionStore();
  return store.records.find((record) => record.runId === runId || record.id === runId) || null;
}

// Canonical execution path: an approved packet creates exactly one loop execution
// record (idempotent per gatePacketId). No execution may happen without one.
// Non-build solution kinds: a process/workflow or human-responsibility loop that
// solves a problem without shipping software. These never create a software
// build packet.
const NON_BUILD_PACKET_KINDS = new Set([
  "workflow_process",
  "human_responsibility_loop",
  "content_resource",
  "ministry_community_model"
]);

export async function createLoopRunFromPacket(input: CreateLoopFromPacketInput, now = new Date()) {
  // Fail closed: a canonical execution record requires every approval —
  // gatePacketId, a passed prior_work_check, an approved candidate packet, and
  // acceptance criteria. Any missing approval blocks creation.
  const gatePacketId = cleanText(input.gatePacketId);
  if (!gatePacketId) {
    throw new Error("createLoopRunFromPacket blocked: gatePacketId is required (problem_intake_gate first).");
  }

  const packetKind = cleanText(input.packetKind) || "app_build_packet";
  const isNonBuild = NON_BUILD_PACKET_KINDS.has(packetKind);
  const solutionClass: "non_build" | "software" = isNonBuild ? "non_build" : "software";

  const priorWorkVerdict = cleanText(input.priorWork?.verdict);
  const priorWorkPassed = input.priorWork?.passed === true;
  // A software build requires a passed build/extend verdict. A non-build process
  // loop does not build software, so it is not gated on a build verdict (it still
  // requires the gate, an approved candidate, and acceptance criteria below).
  if (!isNonBuild && (!priorWorkPassed || (priorWorkVerdict !== "build_new" && priorWorkVerdict !== "extend_existing"))) {
    throw new Error(
      "createLoopRunFromPacket blocked: a passed prior_work_check verdict (build_new or extend_existing) is required for a software build."
    );
  }

  const candidatePacketId = cleanText(input.candidatePacketId);
  if (!candidatePacketId) {
    throw new Error("createLoopRunFromPacket blocked: an approved candidate packet (candidatePacketId) is required.");
  }

  const acceptanceCriteria = splitCriteria(input.acceptanceCriteria);
  if (!acceptanceCriteria.length) {
    throw new Error("createLoopRunFromPacket blocked: at least one acceptance criterion is required.");
  }

  const at = now.toISOString();
  const appSlug = slugify(cleanText(input.appSlug) || cleanText(input.appName) || gatePacketId);
  const goal = cleanText(input.goal) || `Execute ${packetKind} for ${appSlug}`;
  const initialStatus: AppEngineLoopStatus = isNonBuild ? "ready_to_run" : "ready_to_build";

  const store = await readExecutionStore();
  const existing = store.records.find((record) => record.gatePacketId === gatePacketId);
  if (existing) return existing;

  const runId = `exec-${at.slice(0, 10)}-${appSlug}-${randomUUID().slice(0, 8)}`;
  const record: AppEngineLoopExecutionRecord = {
    id: runId,
    kind: "appengine_loop_execution_record",
    schemaVersion: 1,
    createdAt: at,
    updatedAt: at,
    runId,
    appSlug,
    gatePacketId,
    candidatePacketId,
    priorWorkVerdict,
    packetKind,
    solutionClass,
    goal,
    acceptanceCriteria,
    status: initialStatus,
    cycleCount: 0,
    result: "pending",
    blockers: [],
    nextAction: isNonBuild ? "begin_process" : "begin_execution",
    evidence: [],
    statusHistory: [{ status: initialStatus, at, note: `${isNonBuild ? "Non-build process" : "Loop execution"} record created from approved candidate.` }],
    guardrails: loopRunGuardrails(),
    ownerReadableSummary: `${isNonBuild ? "Non-build process" : "Execution"} loop for ${appSlug} (${packetKind}) is ${initialStatus} from approved candidate ${candidatePacketId}.`
  };
  store.records.unshift(record);
  await writeExecutionStore(store);
  return record;
}

// Fail-closed guard: no execution without a canonical loop_run_record.
export async function requireLoopRunForExecution(runId: string) {
  const record = await getLoopExecutionRecord(runId);
  if (!record) {
    throw new Error(
      "No loop_run_record exists for this execution. Create one from the approved packet (createLoopRunFromPacket) before executing."
    );
  }
  return record;
}

// Every completed loop writes evidence back into loop_run_records AND the
// canonical app_portfolio_registry (success -> verified; failure -> blocker + next action).
export async function completeLoopRun(runId: string, outcome: CompleteLoopOutcome = {}, now = new Date()) {
  const store = await readExecutionStore();
  const record = store.records.find((item) => item.runId === runId || item.id === runId);
  if (!record) {
    throw new Error("No loop_run_record exists for this execution. Create one from the approved packet before completing.");
  }

  const at = now.toISOString();
  const verified = outcome.result !== "failed";
  const blockers = arrFrom(outcome.blockers, []);
  const isNonBuild = record.solutionClass === "non_build";

  record.result = verified ? "verified" : "failed";
  record.status = verified ? (isNonBuild ? "completed" : "deployed") : "needs_fix";
  record.cycleCount = typeof outcome.cycleCount === "number" ? outcome.cycleCount : record.cycleCount + 1;
  record.evidence = arrFrom(outcome.evidence, record.evidence);
  record.blockers = verified ? [] : blockers.length ? blockers : ["Loop did not verify; see review."];
  record.nextAction = verified ? "registry_updated_completed" : cleanText(outcome.nextAction) || "create_fix_issue";
  record.updatedAt = at;
  record.statusHistory.push({
    status: record.status,
    at,
    note: verified ? "Loop verified and completed." : "Loop failed; blocker and next action recorded."
  });
  await writeExecutionStore(store);

  await attachCompletedLoop(
    record.appSlug,
    {
      runId: record.runId,
      goal: record.goal,
      status: record.status,
      gatePacketId: record.gatePacketId,
      cycleCount: record.cycleCount,
      evidence: record.evidence,
      blockers: record.blockers,
      nextAction: record.nextAction,
      solutionClass: record.solutionClass
    },
    now
  );

  return record;
}

function executionStoreScope() {
  return { kind: "loop_run_records" as const, key: "execution-loops" };
}

async function readExecutionStore(): Promise<LoopExecutionStore> {
  return getAppEngineStateAdapter().readJson<LoopExecutionStore>(executionStoreScope(), { schemaVersion: 1, records: [] });
}

async function writeExecutionStore(store: LoopExecutionStore) {
  await getAppEngineStateAdapter().writeJson(executionStoreScope(), store);
}

function arrFrom(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean);
  if (typeof value === "string") return splitCriteria(value);
  return fallback;
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
  const lines = Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : ""))
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];

  return lines
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
