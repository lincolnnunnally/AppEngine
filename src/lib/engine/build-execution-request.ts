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
import {
  listHandoffRelaySummaries,
  savePreparedHandoffFromBuildExecutionExport,
  type HandoffRelaySummary
} from "@/lib/engine/handoff-relay";
import {
  updateProjectMemoryFromBuildExecutionRequest,
  updateProjectMemoryFromBuildExecutionRequestExport
} from "@/lib/engine/project-memory";

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
export type BuildExecutionRequestReviewStatus = "needs_review" | "owner_approved" | "blocked" | "exported_for_builder";

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
  designIntent: FirstEcosystemBuildPacketDraftRecord["designIntent"] | null;
};

export type BuildExecutionBuilderHandoffExport = {
  kind: "build_execution_builder_handoff_export";
  schemaVersion: 1;
  id: string;
  createdAt: string;
  requestId: string;
  sourceHandoffId: string;
  sourceOpportunityOrEcosystemRequest: string;
  sourcePacketDraft: BuildExecutionPacketDraftSource | null;
  targetProjectSlice: string;
  requestedBuildWork: string;
  designIntent: FirstEcosystemBuildPacketDraftRecord["designIntent"] | ReturnType<typeof defaultDesignIntent>;
  guardrails: string[];
  verificationCommands: string[];
  expectedResult: string;
  exactBuilderPrompt: string;
  handoffInboxId: string | null;
  execution: {
    codexTriggered: false;
    githubIssuesCreated: false;
    labelsApplied: false;
    productionDeployed: false;
    paidResourcesCreated: false;
    migrationsApplied: false;
    secretsOrEnvChanged: false;
    repositoryVisibilityChanged: false;
  };
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
  reviewStatus: BuildExecutionRequestReviewStatus;
  exportedBuilderHandoffId: string | null;
  exportedBuilderHandoff: BuildExecutionBuilderHandoffExport | null;
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
    reviewStatus: BuildExecutionRequestReviewStatus;
    builderHandoffExported: boolean;
    builderHandoffId: string | null;
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
    reviewAndExportOwnerControlled: true,
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
    reviewStatus: "needs_review",
    exportedBuilderHandoffId: null,
    exportedBuilderHandoff: null,
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
      reviewStatus: "needs_review",
      builderHandoffExported: false,
      builderHandoffId: null,
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

export async function reviewBuildExecutionRequest(
  input: { requestId?: unknown; reviewStatus?: unknown; note?: unknown } = {},
  now = new Date()
) {
  const requestId = typeof input.requestId === "string" ? input.requestId.trim() : "";
  const reviewStatus = parseReviewStatus(input.reviewStatus);
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 600) : "";

  if (!requestId) {
    throw new Error("Choose a build execution request to review.");
  }

  if (!reviewStatus) {
    throw new Error("Choose a valid build execution review status.");
  }

  const store = await readBuildExecutionRequestStore();
  const index = store.records.findIndex((record) => record.id === requestId);

  if (index === -1) {
    throw new Error("Build execution request not found.");
  }

  const existing = store.records[index];

  if (reviewStatus === "blocked") {
    const reviewedAt = now.toISOString();
    const blocked = {
      ...existing,
      updatedAt: reviewedAt,
      ownerApprovalStatus: "rejected" as const,
      executionStatus: "blocked" as const,
      reviewStatus: "blocked" as const,
      ownerReadableSummary: `Build execution request for ${existing.targetProjectSlice} is blocked pending owner review.`,
      statusHistory: [
        {
          status: "blocked" as const,
          at: reviewedAt,
          note: note || "Owner marked this build execution request blocked. No builder handoff was exported."
        },
        ...existing.statusHistory
      ],
      artifact: {
        ...existing.artifact,
        executionStatus: "blocked" as const,
        ownerApprovalStatus: "rejected" as const,
        reviewStatus: "blocked" as const
      }
    } satisfies BuildExecutionRequestRecord;

    store.records[index] = blocked;
    await writeBuildExecutionRequestStore(store);
    await updateProjectMemoryFromBuildExecutionRequest(blocked);
    await getAppEngineAuditTrail().append({
      type: "build_execution_request_reviewed",
      actor: { type: "owner", id: "Lincoln" },
      summary: blocked.ownerReadableSummary,
      subjectId: blocked.id,
      metadata: {
        reviewStatus: blocked.reviewStatus,
        executionStatus: blocked.executionStatus,
        codexTriggered: false,
        githubIssuesCreated: false,
        labelsApplied: false,
        productionDeployed: false
      }
    });

    return { record: blocked, handoff: null, exportOutput: null };
  }

  if (reviewStatus === "needs_review") {
    const reviewedAt = now.toISOString();
    const reviewed = {
      ...existing,
      updatedAt: reviewedAt,
      reviewStatus: "needs_review" as const,
      ownerReadableSummary: `Build execution request for ${existing.targetProjectSlice} still needs owner review.`,
      statusHistory: [
        {
          status: existing.executionStatus,
          at: reviewedAt,
          note: note || "Owner kept this build execution request in review."
        },
        ...existing.statusHistory
      ],
      artifact: {
        ...existing.artifact,
        reviewStatus: "needs_review" as const
      }
    } satisfies BuildExecutionRequestRecord;

    store.records[index] = reviewed;
    await writeBuildExecutionRequestStore(store);
    return { record: reviewed, handoff: null, exportOutput: null };
  }

  const exportOutput = createBuilderHandoffExport(existing, now);
  const handoff = await savePreparedHandoffFromBuildExecutionExport(exportOutput, now);
  const exportedAt = now.toISOString();
  const exported = {
    ...existing,
    updatedAt: exportedAt,
    ownerApprovalStatus: "owner_approved" as const,
    executionStatus: "ready_for_builder" as const,
    reviewStatus: "exported_for_builder" as const,
    exportedBuilderHandoffId: handoff.id,
    exportedBuilderHandoff: {
      ...exportOutput,
      handoffInboxId: handoff.id
    },
    statusHistory: [
      {
        status: "ready_for_builder" as const,
        at: exportedAt,
        note:
          note ||
          `Owner approved this request and exported builder handoff ${handoff.id}. Codex was not triggered automatically.`
      },
      {
        status: "owner_approved" as const,
        at: exportedAt,
        note: "Owner approved this build execution request for manual builder handoff export."
      },
      ...existing.statusHistory
    ],
    ownerReadableSummary: `Build execution request for ${existing.targetProjectSlice} is owner-approved and exported to the Handoff Inbox as ${handoff.id}.`,
    artifact: {
      ...existing.artifact,
      executionStatus: "ready_for_builder" as const,
      ownerApprovalStatus: "owner_approved" as const,
      reviewStatus: "exported_for_builder" as const,
      builderHandoffExported: true,
      builderHandoffId: handoff.id
    }
  } satisfies BuildExecutionRequestRecord;

  store.records[index] = exported;
  await writeBuildExecutionRequestStore(store);
  await updateProjectMemoryFromBuildExecutionRequestExport(exported, exported.exportedBuilderHandoff);
  await getAppEngineAuditTrail().append({
    type: "build_execution_request_exported",
    actor: { type: "owner", id: "Lincoln" },
    summary: exported.ownerReadableSummary,
    subjectId: exported.id,
    metadata: {
      sourceHandoffId: exported.sourceHandoff.id,
      sourcePacketDraftId: exported.sourcePacketDraft?.id || null,
      exportedHandoffId: handoff.id,
      reviewStatus: exported.reviewStatus,
      executionStatus: exported.executionStatus,
      codexTriggered: false,
      githubIssuesCreated: false,
      labelsApplied: false,
      productionDeployed: false,
      paidResourcesCreated: false,
      migrationsApplied: false,
      secretsOrEnvChanged: false,
      repositoryVisibilityChanged: false
    }
  });

  return { record: exported, handoff, exportOutput: exported.exportedBuilderHandoff };
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
    nextSafeAction: draft.nextSafeAction,
    designIntent: draft.designIntent
  };
}

function createBuilderHandoffExport(request: BuildExecutionRequestRecord, now = new Date()): BuildExecutionBuilderHandoffExport {
  const designIntent = request.sourcePacketDraft?.designIntent || defaultDesignIntent();
  const createdAt = now.toISOString();
  const exportOutput: Omit<BuildExecutionBuilderHandoffExport, "exactBuilderPrompt"> = {
    kind: "build_execution_builder_handoff_export",
    schemaVersion: 1,
    id: `build_execution_export_${randomUUID()}`,
    createdAt,
    requestId: request.id,
    sourceHandoffId: request.sourceHandoff.id,
    sourceOpportunityOrEcosystemRequest: `${request.sourceHandoff.title} (${request.sourceHandoff.sourceKind.replaceAll("_", " ")})`,
    sourcePacketDraft: request.sourcePacketDraft,
    targetProjectSlice: request.targetProjectSlice,
    requestedBuildWork: request.requestedWork,
    designIntent,
    guardrails: request.guardrails,
    verificationCommands: request.verificationCommands,
    expectedResult: request.expectedResult,
    handoffInboxId: null,
    execution: {
      codexTriggered: false,
      githubIssuesCreated: false,
      labelsApplied: false,
      productionDeployed: false,
      paidResourcesCreated: false,
      migrationsApplied: false,
      secretsOrEnvChanged: false,
      repositoryVisibilityChanged: false
    }
  };

  return {
    ...exportOutput,
    exactBuilderPrompt: buildExactBuilderPrompt(exportOutput)
  };
}

function buildExactBuilderPrompt(exportOutput: Omit<BuildExecutionBuilderHandoffExport, "exactBuilderPrompt">) {
  return [
    "# AppEngine Builder Handoff",
    "",
    "Use this owner-approved build execution request as the source of truth.",
    "",
    `Target project/slice: ${exportOutput.targetProjectSlice}`,
    `Source Opportunity / ecosystem request: ${exportOutput.sourceOpportunityOrEcosystemRequest}`,
    `Source packet draft: ${exportOutput.sourcePacketDraft?.title || "No packet draft attached"}`,
    "",
    "## Requested Build Work",
    exportOutput.requestedBuildWork,
    "",
    "## Design Intent",
    `Profile: ${exportOutput.designIntent.profile}`,
    `Emotional experience: ${exportOutput.designIntent.emotionalExperience.join(", ")}`,
    `Style notes: ${exportOutput.designIntent.styleNotes.join(" | ")}`,
    `Avoid: ${exportOutput.designIntent.avoid.join(" | ")}`,
    "",
    "## Guardrails",
    ...exportOutput.guardrails.map((guardrail) => `- ${guardrail}`),
    "",
    "## Verification",
    ...exportOutput.verificationCommands.map((command) => `- ${command}`),
    "",
    "## Expected Result",
    exportOutput.expectedResult,
    "",
    "Do not trigger Codex automatically from AppEngine, create GitHub issues, apply labels, deploy production, create paid resources, apply live migrations, change secrets/env vars, change repository visibility, or auto-merge generated app code."
  ].join("\n");
}

function parseReviewStatus(value: unknown): BuildExecutionRequestReviewStatus | null {
  if (
    value === "needs_review" ||
    value === "owner_approved" ||
    value === "blocked" ||
    value === "exported_for_builder"
  ) {
    return value;
  }

  return null;
}

function defaultDesignIntent() {
  return {
    profile: "ministry_community" as const,
    emotionalExperience: ["warm", "hopeful", "clear", "trustworthy"],
    styleNotes: ["Use plain language.", "Make the next step obvious.", "Keep phone review comfortable."],
    avoid: ["cold technical tone", "generic dashboard feel", "claims that unfinished ecosystem services are live"]
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
