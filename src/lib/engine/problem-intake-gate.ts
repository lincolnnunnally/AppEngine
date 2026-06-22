import { randomUUID } from "node:crypto";
import { registerAppProject } from "@/lib/engine/app-portfolio-registry-store";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";

// Problem Intake Gate.
//
// The official AppEngine front door. When Lincoln enters a problem, opportunity,
// app idea, feature request, or improvement request, AppEngine must NOT begin
// planning or building. It must first produce an intake packet that identifies
// the request, names the applicable control gates, and routes only to a safe
// pre-build phase. Architecture, design, and implementation are blocked actions
// at intake; they become reachable only after the named control gates run.

export type ProblemIntakeRequestType =
  | "problem"
  | "opportunity"
  | "app_idea"
  | "feature_request"
  | "improvement_request"
  | "fix"
  | "ambiguous";

// The intake gate may only ever route to a pre-build phase. Architecture,
// design, and implementation are intentionally NOT representable here.
export type ProblemIntakeNextPhase = "clarify_problem" | "prior_work_check" | "solution_candidate_review";

export type ProblemIntakeStatus = "scoped" | "needs_clarification";

export type ProblemIntakeLikelyApp = {
  name: string;
  slug: string;
  status: "new" | "existing" | "unknown";
};

export type ProblemIntakeGateRecord = {
  id: string;
  kind: "problem_intake_gate";
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  rawRequest: string;
  problemBeingSolved: string;
  intendedPerson: string;
  likelyApp: ProblemIntakeLikelyApp;
  requestType: ProblemIntakeRequestType;
  missingContext: string[];
  requiredSourceOfTruthFiles: string[];
  applicableControlGates: string[];
  blockedActions: string[];
  recommendedNextLabel: "ai:plan";
  nextSafePhase: ProblemIntakeNextPhase;
  status: ProblemIntakeStatus;
  ownerReadableSummary: string;
  guardrails: ReturnType<typeof problemIntakeGuardrails>;
};

type ProblemIntakeStore = {
  schemaVersion: 1;
  records: ProblemIntakeGateRecord[];
};

type CreateProblemIntakeInput = {
  rawRequest?: unknown;
  problemBeingSolved?: unknown;
  intendedPerson?: unknown;
  requestType?: unknown;
  appName?: unknown;
  knownApps?: unknown;
};

type SolutionPath = "new_app" | "existing_app_improvement" | "clarify_first";

const REQUEST_TYPES: ProblemIntakeRequestType[] = [
  "problem",
  "opportunity",
  "app_idea",
  "feature_request",
  "improvement_request",
  "fix",
  "ambiguous"
];

// Phases that are never reachable directly from intake. Kept as data so the
// guarantee is explicit and testable: intake never routes to a build phase.
export const BUILD_PHASES_BLOCKED_AT_INTAKE = [
  "architecture",
  "ui_design",
  "design",
  "data_model",
  "mvp_build",
  "implementation",
  "deployment"
] as const;

const REQUIRED_SOURCE_OF_TRUTH_FILES = [
  "source-of-truth/00-why-we-build.md",
  "source-of-truth/01-ecosystem-philosophy.md",
  "source-of-truth/02-global-principles.md",
  "source-of-truth/03-life-produces-life.md",
  "source-of-truth/04-app-purpose-rules.md",
  "source-of-truth/05-ecosystem-design-gates.md",
  "source-of-truth/problem-intake-gate.md",
  "source-of-truth/problem-to-solution-intake-standard.md",
  "source-of-truth/intake-command-standard.md",
  "source-of-truth/app-selection-standard.md",
  "source-of-truth/prior-work-check-gate.md",
  "source-of-truth/problem-portfolio-routing-standard.md",
  "source-of-truth/chatgpt-handoff-issue-standard.md"
];

const BLOCKED_ACTIONS = [
  "begin_architecture",
  "begin_design",
  "begin_implementation",
  "create_app_code_from_conversation",
  "create_app_build_packet_before_prior_work_check",
  "production_deploy",
  "create_paid_resources",
  "run_migrations",
  "change_secrets_or_env",
  "codex_auto_execution",
  "create_github_issue_without_owner_approval",
  "skip_intake"
];

const KNOWN_ECOSYSTEM_APPS = [
  "ChurchConnect",
  "Spark of Hope",
  "Live On Mission",
  "Best Life",
  "Kindred",
  "United Under God",
  "Toner Management",
  "Opportunity"
];

export function problemIntakeGuardrails() {
  return {
    ...durableStateGuardrails(),
    intakeFirstRequired: true,
    noBuildBeforeIntake: true,
    noArchitectureDesignImplementationFromConversation: true,
    controlGatesRequiredBeforeBuild: true,
    ownerReviewRequiredBeforeBuild: true
  };
}

export async function listProblemIntakeGateRecords() {
  const store = await readStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getProblemIntakeGateRecord(gatePacketId: string) {
  const store = await readStore();
  return store.records.find((record) => record.id === gatePacketId) || null;
}

export function buildProblemIntakeGateRecord(input: CreateProblemIntakeInput, now = new Date()): ProblemIntakeGateRecord {
  const createdAt = now.toISOString();
  const rawRequest = cleanText(input.rawRequest);

  if (rawRequest.length < 4) {
    throw new Error("Please describe the request (raw request is required).");
  }

  const problemBeingSolved = cleanText(input.problemBeingSolved);
  const intendedPerson = cleanText(input.intendedPerson);
  const knownApps = normalizeKnownApps(input.knownApps);
  const requestType = classifyRequestType(rawRequest, input.requestType);
  const likelyApp = inferLikelyApp({ rawRequest, appName: input.appName, knownApps, requestType });
  const path = solutionPathFor(requestType, likelyApp);

  const missingContext = collectMissingContext({ problemBeingSolved, intendedPerson, requestType, likelyApp });
  const status: ProblemIntakeStatus = missingContext.length ? "needs_clarification" : "scoped";
  const applicableControlGates = controlGatesFor(path);
  const nextSafePhase = nextPhaseFor(status, path);
  const slug = likelyApp.slug;
  const runId = `intake-${createdAt.slice(0, 10)}-${slug}-${randomUUID().slice(0, 8)}`;

  return {
    id: runId,
    kind: "problem_intake_gate",
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
    rawRequest,
    problemBeingSolved: problemBeingSolved || "not_provided_yet",
    intendedPerson: intendedPerson || "not_provided_yet",
    likelyApp,
    requestType,
    missingContext,
    requiredSourceOfTruthFiles: REQUIRED_SOURCE_OF_TRUTH_FILES,
    applicableControlGates,
    blockedActions: BLOCKED_ACTIONS,
    recommendedNextLabel: "ai:plan",
    nextSafePhase,
    status,
    ownerReadableSummary: buildOwnerSummary({ requestType, likelyApp, nextSafePhase, applicableControlGates, status }),
    guardrails: problemIntakeGuardrails()
  };
}

export async function createProblemIntakeGateRecord(input: CreateProblemIntakeInput, now = new Date()) {
  const record = buildProblemIntakeGateRecord(input, now);
  const store = await readStore();
  store.records.unshift(record);
  await writeStore(store);

  // Resolve the gated request against the canonical app_portfolio_registry: a
  // known/likely app/project registers (upserts) so prior_work_check and the
  // owner registry can find it. "unknown" apps are left to clarification first.
  if (record.likelyApp.status !== "unknown") {
    await registerAppProject({
      slug: record.likelyApp.slug,
      name: record.likelyApp.name,
      type: record.likelyApp.status === "existing" ? "existing_app" : "new_app_candidate",
      // A new candidate is an in-flight gated_intake. An EXISTING app keeps its
      // real lifecycle status (e.g. active_product) — the gate must not downgrade
      // a built app to a placeholder, or prior_work_check would stop reusing it.
      status: record.likelyApp.status === "existing" ? undefined : "gated_intake",
      gatePacketId: record.id,
      sourceOfTruthFiles: record.requiredSourceOfTruthFiles
    });
  }

  return record;
}

function classifyRequestType(rawRequest: string, explicit: unknown): ProblemIntakeRequestType {
  const requested = typeof explicit === "string" ? explicit.trim() : "";
  if (REQUEST_TYPES.includes(requested as ProblemIntakeRequestType) && requested !== "ambiguous") {
    return requested as ProblemIntakeRequestType;
  }

  const text = rawRequest.toLowerCase();
  if (/\b(fix|bug|broken|crash|error|not working|regression|fails?)\b/.test(text)) return "fix";
  if (/\b(improve|improvement|easier|better|polish|refine|enhance|clean ?up|streamline)\b/.test(text)) return "improvement_request";
  if (/\b(add|feature|support for|ability to|allow (?:users|people) to|new option|integrate)\b/.test(text)) return "feature_request";
  if (/\b(build|create|launch|app idea|an app|new app|tool that|platform|website|system to)\b/.test(text)) return "app_idea";
  if (/\bopportunit/.test(text)) return "opportunity";
  if (/\b(problem|struggl\w*|can'?t|cannot|need help|pain|frustrat|hard to|inconsistent|consistently|keep(?:s)? (?:dropping|missing|losing))\b/.test(text)) {
    return "problem";
  }
  return "ambiguous";
}

function inferLikelyApp({
  rawRequest,
  appName,
  knownApps,
  requestType
}: {
  rawRequest: string;
  appName: unknown;
  knownApps: string[];
  requestType: ProblemIntakeRequestType;
}): ProblemIntakeLikelyApp {
  const explicitName = cleanText(appName);
  if (explicitName) {
    return { name: explicitName, slug: slugify(explicitName), status: "existing" };
  }

  const haystack = rawRequest.toLowerCase();
  const candidates = [...knownApps, ...KNOWN_ECOSYSTEM_APPS];
  for (const candidate of candidates) {
    if (candidate && haystack.includes(candidate.toLowerCase())) {
      return { name: candidate, slug: slugify(candidate), status: "existing" };
    }
  }

  if (requestType === "app_idea" || requestType === "opportunity") {
    return { name: deriveAppName(rawRequest), slug: slugify(deriveAppName(rawRequest)), status: "new" };
  }

  return { name: "unknown", slug: "unknown", status: "unknown" };
}

function solutionPathFor(requestType: ProblemIntakeRequestType, likelyApp: ProblemIntakeLikelyApp): SolutionPath {
  if (likelyApp.status === "existing" || requestType === "feature_request" || requestType === "improvement_request" || requestType === "fix") {
    return "existing_app_improvement";
  }
  if (likelyApp.status === "new" || requestType === "app_idea") {
    return "new_app";
  }
  return "clarify_first";
}

function controlGatesFor(path: SolutionPath): string[] {
  const base = ["source_of_truth_gate", "prior_work_check_gate", "owner_review_gate"];

  if (path === "new_app") {
    return [
      ...base,
      "problem_portfolio_routing",
      "solution_candidate_review_gate",
      "packet_draft_approval_gate",
      "app_build_packet_gate",
      "identity_auth_gate",
      "super_admin_gate",
      "provider_cost_gate",
      "design_quality_gate",
      "compatibility_gate",
      "release_gate"
    ];
  }

  if (path === "existing_app_improvement") {
    return [
      ...base,
      "problem_portfolio_routing",
      "solution_candidate_review_gate",
      "packet_draft_approval_gate",
      "vnext_packet_gate",
      "design_quality_gate",
      "compatibility_gate",
      "release_gate"
    ];
  }

  return [...base, "opportunity_clarification", "problem_portfolio_routing", "solution_candidate_review_gate"];
}

function nextPhaseFor(status: ProblemIntakeStatus, path: SolutionPath): ProblemIntakeNextPhase {
  if (status === "needs_clarification" || path === "clarify_first") {
    return "clarify_problem";
  }
  return "prior_work_check";
}

function collectMissingContext({
  problemBeingSolved,
  intendedPerson,
  requestType,
  likelyApp
}: {
  problemBeingSolved: string;
  intendedPerson: string;
  requestType: ProblemIntakeRequestType;
  likelyApp: ProblemIntakeLikelyApp;
}): string[] {
  const missing: string[] = [];
  if (problemBeingSolved.length < 8) missing.push("problem being solved");
  if (intendedPerson.length < 3) missing.push("intended person/customer");
  if (requestType === "ambiguous") missing.push("request type (problem, opportunity, app idea, feature, improvement, or fix)");
  if (likelyApp.status === "unknown") missing.push("which existing app this affects, or whether it is a new app");
  return missing;
}

function buildOwnerSummary({
  requestType,
  likelyApp,
  nextSafePhase,
  applicableControlGates,
  status
}: {
  requestType: ProblemIntakeRequestType;
  likelyApp: ProblemIntakeLikelyApp;
  nextSafePhase: ProblemIntakeNextPhase;
  applicableControlGates: string[];
  status: ProblemIntakeStatus;
}) {
  const appLabel = likelyApp.status === "unknown" ? "an unconfirmed app" : `${likelyApp.status} app ${likelyApp.name}`;
  return `${requestType} captured for ${appLabel}. Status: ${status}. Next safe phase: ${nextSafePhase}. ${applicableControlGates.length} control gates must pass before any architecture, design, or build work.`;
}

async function readStore(): Promise<ProblemIntakeStore> {
  return getAppEngineStateAdapter().readJson<ProblemIntakeStore>(storeScope(), {
    schemaVersion: 1,
    records: []
  });
}

async function writeStore(store: ProblemIntakeStore) {
  await getAppEngineStateAdapter().writeJson(storeScope(), store);
}

function storeScope() {
  return { kind: "problem_intake_gate" as const, key: "intake-gate-records" };
}

function normalizeKnownApps(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[|,\n]/)
      .map((item) => cleanText(item))
      .filter(Boolean);
  }
  return [];
}

function deriveAppName(rawRequest: string) {
  const words = rawRequest
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(" ");
  return words || "New App";
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
  return slug || "intake";
}
