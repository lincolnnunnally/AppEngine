import { randomUUID } from "node:crypto";
import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import {
  listFirstEcosystemBuildPacketDrafts,
  type FirstEcosystemBuildPacketDraftRecord
} from "@/lib/engine/first-ecosystem-build-packet-draft";
import {
  listFirstRealEcosystemBuildRequests,
  type FirstRealEcosystemBuildRequestRecord
} from "@/lib/engine/first-real-ecosystem-build-request";
import { listHandoffRelaySummaries, type HandoffRelaySummary } from "@/lib/engine/handoff-relay";
import { updateProjectMemoryFromBuildExecutionRequest } from "@/lib/engine/project-memory";

export type BuildExecutionRequestStatus =
  | "draft"
  | "owner_approved"
  | "ready_for_builder"
  | "builder_running_external"
  | "result_received"
  | "verification_needed"
  | "completed"
  | "blocked";

export type BuildExecutionOwnerApprovalStatus = "owner_review_required" | "owner_approved" | "rejected";

export type BuildExecutionHandoffSourceKind =
  | "handoff_inbox"
  | "opportunity_ready_appengine_handoff"
  | "first_ecosystem_build_request_handoff"
  | "first_ecosystem_build_packet_draft";

export type BuildExecutionPacketDraftSource = {
  id: string;
  kind: FirstEcosystemBuildPacketDraftRecord["kind"];
  title: string;
  status: FirstEcosystemBuildPacketDraftRecord["status"];
  ownerReadableSummary: string;
  nextSafeAction: FirstEcosystemBuildPacketDraftRecord["nextSafeAction"];
};

export type BuildExecutionHandoffSource = {
  id: string;
  sourceHandoffId: string;
  sourceKind: BuildExecutionHandoffSourceKind;
  title: string;
  receivedAt: string;
  targetProjectSlice: string;
  requestedWork: string;
  guardrails: string[];
  verificationCommands: string[];
  expectedResult: string;
  ownerReadableSummary: string;
  sourcePacketDraft: BuildExecutionPacketDraftSource | null;
};

export type BuildExecutionRequestRecord = {
  id: string;
  kind: "build_execution_request";
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  sourceHandoff: {
    id: string;
    sourceKind: BuildExecutionHandoffSourceKind;
    title: string;
    receivedAt: string;
  };
  sourcePacketDraft: BuildExecutionPacketDraftSource | null;
  targetProjectSlice: string;
  requestedWork: string;
  guardrails: string[];
  verificationCommands: string[];
  expectedResult: string;
  ownerApprovalStatus: BuildExecutionOwnerApprovalStatus;
  executionStatus: BuildExecutionRequestStatus;
  statusHistory: {
    status: BuildExecutionRequestStatus;
    at: string;
    note: string;
  }[];
  ownerReadableSummary: string;
  nextSafeAction: "owner_review_build_execution_request";
  artifact: {
    kind: "build_execution_request";
    schemaVersion: 1;
    sourceHandoffId: string;
    sourcePacketDraftId: string | null;
    executionStatus: BuildExecutionRequestStatus;
    ownerApprovalStatus: BuildExecutionOwnerApprovalStatus;
    codexTriggered: false;
    githubIssuesCreated: false;
    labelsApplied: false;
    productionDeployed: false;
  };
  guardrailState: ReturnType<typeof buildExecutionRequestGuardrails>;
};

type BuildExecutionRequestStore = {
  schemaVersion: 1;
  records: BuildExecutionRequestRecord[];
};

export function buildExecutionRequestGuardrails() {
  return {
    ...durableStateGuardrails(),
    draftConnectorOnly: true,
    ownerApprovalRequired: true,
    noCodexAutoExecution: true,
    noGitHubIssueCreation: true,
    noLabelChanges: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noLiveMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true
  };
}

export async function listBuildExecutionRequests() {
  const store = await readBuildExecutionRequestStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listBuildExecutionHandoffSources() {
  const [handoffs, firstBuildRequests, firstPacketDrafts] = await Promise.all([
    listHandoffRelaySummaries(),
    listFirstRealEcosystemBuildRequests(),
    listFirstEcosystemBuildPacketDrafts()
  ]);
  const firstBuildRequestByHandoffId = new Map(firstBuildRequests.map((request) => [request.preparedHandoff.id, request]));
  const firstPacketDraftByHandoffId = new Map<string, FirstEcosystemBuildPacketDraftRecord>();
  for (const draft of firstPacketDrafts) {
    if (!firstPacketDraftByHandoffId.has(draft.sourcePreparedHandoffId)) {
      firstPacketDraftByHandoffId.set(draft.sourcePreparedHandoffId, draft);
    }
  }
  const handoffSources = handoffs.map((handoff) =>
    buildSourceFromHandoff(
      handoff,
      firstBuildRequestByHandoffId.get(handoff.id) || null,
      firstPacketDraftByHandoffId.get(handoff.id) || null
    )
  );
  const syntheticFirstBuildSources = firstBuildRequests
    .filter((request) => !handoffs.some((handoff) => handoff.id === request.preparedHandoff.id))
    .map((request) => buildSourceFromFirstBuildRequest(request, firstPacketDraftByHandoffId.get(request.preparedHandoff.id) || null));
  const syntheticPacketDraftSources = firstPacketDrafts
    .filter((draft) => !handoffs.some((handoff) => handoff.id === draft.sourcePreparedHandoffId))
    .filter((draft) => !firstBuildRequests.some((request) => request.preparedHandoff.id === draft.sourcePreparedHandoffId))
    .map(buildSourceFromPacketDraft);

  return uniqueSources([...handoffSources, ...syntheticFirstBuildSources, ...syntheticPacketDraftSources]).sort((a, b) =>
    b.receivedAt.localeCompare(a.receivedAt)
  );
}

export async function createBuildExecutionRequest(input: { sourceId?: unknown } = {}, now = new Date()) {
  const sources = await listBuildExecutionHandoffSources();
  const sourceId = typeof input.sourceId === "string" ? input.sourceId.trim() : "";
  const source = sourceId ? sources.find((candidate) => candidate.id === sourceId || candidate.sourceHandoffId === sourceId) : sources[0];

  if (!source) {
    throw new Error("Prepare a handoff before creating a build execution request.");
  }

  const createdAt = now.toISOString();
  const record: BuildExecutionRequestRecord = {
    id: `build_execution_${randomUUID()}`,
    kind: "build_execution_request",
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
    sourceHandoff: {
      id: source.sourceHandoffId,
      sourceKind: source.sourceKind,
      title: source.title,
      receivedAt: source.receivedAt
    },
    sourcePacketDraft: source.sourcePacketDraft,
    targetProjectSlice: source.targetProjectSlice,
    requestedWork: source.requestedWork,
    guardrails: source.guardrails,
    verificationCommands: source.verificationCommands,
    expectedResult: source.expectedResult,
    ownerApprovalStatus: "owner_review_required",
    executionStatus: "draft",
    statusHistory: [
      {
        status: "draft",
        at: createdAt,
        note: "Build execution request drafted from prepared handoff. Codex is not triggered automatically."
      }
    ],
    ownerReadableSummary: `Build execution request drafted for ${source.targetProjectSlice}. It is waiting for owner review before any builder execution.`,
    nextSafeAction: "owner_review_build_execution_request",
    artifact: {
      kind: "build_execution_request",
      schemaVersion: 1,
      sourceHandoffId: source.sourceHandoffId,
      sourcePacketDraftId: source.sourcePacketDraft?.id || null,
      executionStatus: "draft",
      ownerApprovalStatus: "owner_review_required",
      codexTriggered: false,
      githubIssuesCreated: false,
      labelsApplied: false,
      productionDeployed: false
    },
    guardrailState: buildExecutionRequestGuardrails()
  };
  const store = await readBuildExecutionRequestStore();

  await writeBuildExecutionRequestStore({
    schemaVersion: 1,
    records: [record, ...store.records.filter((item) => item.sourceHandoff.id !== record.sourceHandoff.id)].slice(0, 50)
  });
  await updateProjectMemoryFromBuildExecutionRequest(record);
  await getAppEngineAuditTrail().append({
    type: "build_execution_request_created",
    actor: { type: "owner", id: "Lincoln" },
    summary: record.ownerReadableSummary,
    subjectId: record.id,
    metadata: {
      sourceHandoffId: record.sourceHandoff.id,
      sourcePacketDraftId: record.sourcePacketDraft?.id || null,
      targetProjectSlice: record.targetProjectSlice,
      ownerApprovalStatus: record.ownerApprovalStatus,
      executionStatus: record.executionStatus,
      codexTriggered: false,
      githubIssuesCreated: false,
      labelsApplied: false,
      productionDeployed: false
    }
  });

  return record;
}

function buildSourceFromHandoff(
  handoff: HandoffRelaySummary,
  firstBuildRequest: FirstRealEcosystemBuildRequestRecord | null,
  firstPacketDraft: FirstEcosystemBuildPacketDraftRecord | null
): BuildExecutionHandoffSource {
  const sourceKind: BuildExecutionHandoffSourceKind = firstPacketDraft
    ? "first_ecosystem_build_packet_draft"
    : firstBuildRequest
      ? "first_ecosystem_build_request_handoff"
      : handoff.source === "opportunity_prepared_handoff"
        ? "opportunity_ready_appengine_handoff"
        : "handoff_inbox";
  const targetProjectSlice = firstPacketDraft || firstBuildRequest
    ? "Life Produces Life Core / first ecosystem build slice"
    : deriveTargetProjectSlice(handoff);

  return {
    id: handoff.id,
    sourceHandoffId: handoff.id,
    sourceKind,
    title: handoff.extracted.prTitle || "Prepared AppEngine handoff",
    receivedAt: handoff.receivedAt,
    targetProjectSlice,
    requestedWork: firstPacketDraft?.copyableNextAppEnginePrompt || handoff.nextPrompt.prompt,
    guardrails: normalizeGuardrails(handoff.extracted.guardrailsPreserved),
    verificationCommands: normalizeVerification(handoff.extracted.verificationResults),
    expectedResult:
      firstPacketDraft?.ownerReadableSummary ||
      handoff.nextPrompt.expectedOutcome,
    ownerReadableSummary: firstPacketDraft
      ? `${firstPacketDraft.ownerReadableSummary} Source handoff: ${handoff.ownerReadableSummary}`
      : handoff.ownerReadableSummary,
    sourcePacketDraft: firstPacketDraft ? packetDraftSource(firstPacketDraft) : null
  };
}

function buildSourceFromFirstBuildRequest(
  request: FirstRealEcosystemBuildRequestRecord,
  firstPacketDraft: FirstEcosystemBuildPacketDraftRecord | null
): BuildExecutionHandoffSource {
  return {
    id: request.preparedHandoff.id,
    sourceHandoffId: request.preparedHandoff.id,
    sourceKind: firstPacketDraft ? "first_ecosystem_build_packet_draft" : "first_ecosystem_build_request_handoff",
    title: firstPacketDraft?.title || "Prepared AppEngine handoff: Life Produces Life Core",
    receivedAt: request.createdAt,
    targetProjectSlice: "Life Produces Life Core / first ecosystem build slice",
    requestedWork: firstPacketDraft?.copyableNextAppEnginePrompt || request.preparedHandoff.prompt,
    guardrails: defaultGuardrailText(),
    verificationCommands: defaultVerificationCommands(),
    expectedResult: firstPacketDraft?.ownerReadableSummary || request.preparedHandoff.expectedOutcome,
    ownerReadableSummary: firstPacketDraft
      ? `${firstPacketDraft.ownerReadableSummary} Source build request: ${request.ownerReadableSummary}`
      : request.ownerReadableSummary,
    sourcePacketDraft: firstPacketDraft ? packetDraftSource(firstPacketDraft) : null
  };
}

function buildSourceFromPacketDraft(draft: FirstEcosystemBuildPacketDraftRecord): BuildExecutionHandoffSource {
  return {
    id: draft.id,
    sourceHandoffId: draft.sourcePreparedHandoffId,
    sourceKind: "first_ecosystem_build_packet_draft",
    title: draft.title,
    receivedAt: draft.createdAt,
    targetProjectSlice: "Life Produces Life Core / first ecosystem build slice",
    requestedWork: draft.copyableNextAppEnginePrompt,
    guardrails: normalizeGuardrails(draft.guardrailNotes),
    verificationCommands: defaultVerificationCommands(),
    expectedResult: draft.ownerReadableSummary,
    ownerReadableSummary: draft.ownerReadableSummary,
    sourcePacketDraft: packetDraftSource(draft)
  };
}

function packetDraftSource(draft: FirstEcosystemBuildPacketDraftRecord): BuildExecutionPacketDraftSource {
  return {
    id: draft.id,
    kind: draft.kind,
    title: draft.title,
    status: draft.status,
    ownerReadableSummary: draft.ownerReadableSummary,
    nextSafeAction: draft.nextSafeAction
  };
}

function deriveTargetProjectSlice(handoff: HandoffRelaySummary) {
  const text = `${handoff.rawText}\n${handoff.nextPrompt.prompt}\n${handoff.projectState.currentStatus}`.toLowerCase();

  if (text.includes("life produces life") || text.includes("life core")) {
    return "Life Produces Life Core / ecosystem slice";
  }

  if (text.includes("spark of hope")) {
    return "Spark of Hope / app slice";
  }

  if (handoff.source === "opportunity_prepared_handoff") {
    return "Opportunity / next AppEngine action";
  }

  return handoff.extracted.prTitle || "AppEngine / prepared handoff";
}

function normalizeVerification(values: string[]) {
  const commands = [...values, ...defaultVerificationCommands()]
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(commands)).slice(0, 10);
}

function normalizeGuardrails(values: string[]) {
  const guardrails = values.length ? values : defaultGuardrailText();
  return Array.from(new Set([...guardrails, ...defaultGuardrailText()])).slice(0, 12);
}

function defaultVerificationCommands() {
  return [
    "npm run source:check",
    "npm run smoke:build-execution-request",
    "npm run smoke:first-ecosystem-build-packet-draft",
    "npm run typecheck",
    "npm run build"
  ];
}

function defaultGuardrailText() {
  return [
    "No Codex auto-execution.",
    "No GitHub issue creation.",
    "No label changes.",
    "No production deploy.",
    "No paid resources.",
    "No live migrations.",
    "No secrets/env changes.",
    "No repository visibility changes."
  ];
}

function uniqueSources(sources: BuildExecutionHandoffSource[]) {
  const seen = new Set<string>();

  return sources.filter((source) => {
    if (seen.has(source.sourceHandoffId)) return false;
    seen.add(source.sourceHandoffId);
    return true;
  });
}

async function readBuildExecutionRequestStore(): Promise<BuildExecutionRequestStore> {
  return getAppEngineStateAdapter().readJson<BuildExecutionRequestStore>(
    { kind: "build_execution_requests", key: "records" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeBuildExecutionRequestStore(store: BuildExecutionRequestStore) {
  await getAppEngineStateAdapter().writeJson({ kind: "build_execution_requests", key: "records" }, store);
}
