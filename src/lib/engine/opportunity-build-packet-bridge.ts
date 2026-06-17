import { randomUUID } from "node:crypto";
import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import {
  getOpportunityAppEngineCandidate,
  type OpportunityAppEngineCandidateRecord,
  type OpportunityAppEngineCandidateType
} from "@/lib/engine/opportunity-appengine-candidate";
import { updateProjectMemoryFromOpportunityBuildPacketBridge } from "@/lib/engine/project-memory";

export type OpportunityBuildPacketBridgeDraftKind =
  | "app_build_packet_draft"
  | "workflow_solution_plan_draft"
  | "content_resource_plan_draft"
  | "community_model_plan_draft";

export type OpportunityBuildPacketBridgeStatus = "draft_ready" | "blocked_by_candidate" | "owner_approval_required";

export type OpportunityBuildPacketBridgeRecord = {
  id: string;
  candidateId: string;
  actionPlanId: string;
  solutionPathId: string;
  clarificationId: string;
  intakeId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  status: OpportunityBuildPacketBridgeStatus;
  packetDraftStatus: "review_ready_draft";
  packetType: OpportunityBuildPacketBridgeDraftKind;
  sourceCandidate: OpportunityBuildPacketBridgeSourceCandidate;
  packetDraft: OpportunityBuildPacketBridgePacketDraft;
  missingInformation: string[];
  nextSafeAction: "review_packet_draft";
  ownerApprovalStatus: "owner_approved_for_packet_draft";
  sourceArtifactEvidence: OpportunityBuildPacketBridgeSourceEvidence[];
  ownerReadableSummary: string;
  copyableNextAppEnginePrompt: string;
  guardrails: ReturnType<typeof opportunityBuildPacketBridgeGuardrails>;
  artifact: OpportunityBuildPacketBridgeArtifact;
};

export type OpportunityBuildPacketBridgeSourceCandidate = {
  id: string;
  title: string;
  candidateType: OpportunityAppEngineCandidateType;
  proposedAppEngineWorkType: string;
  confidenceLevel: OpportunityAppEngineCandidateRecord["confidenceLevel"];
  actionPlanSummary: string;
};

export type OpportunityBuildPacketBridgePacketDraft = {
  kind: OpportunityBuildPacketBridgeDraftKind;
  schemaVersion: 1;
  status: "review_ready_draft";
  sourceCandidateId: string;
  sourceOpportunityIntakeId: string;
  title: string;
  summary: string;
  recommendedNextStep: "review_packet_draft";
  finalPacketCreated: false;
  phaseIssuesCreated: false;
  codexTriggered: false;
};

export type OpportunityBuildPacketBridgeSourceEvidence = {
  kind:
    | "opportunity_appengine_candidate"
    | "opportunity_action_plan"
    | "opportunity_solution_path"
    | "opportunity_clarification"
    | "opportunity_intake"
    | "candidate_packet_bridge_standard";
  id?: string;
  summary: string;
};

export type OpportunityBuildPacketBridgeArtifact = {
  kind: "opportunity_build_packet_bridge";
  schemaVersion: 1;
  sourceArtifact: {
    kind: "opportunity_appengine_candidate";
    candidateId: string;
    actionPlanId: string;
    solutionPathId: string;
    clarificationId: string;
    intakeId: string;
  };
  existingBridgeStandard: {
    kind: "candidate_packet_bridge";
    sourceOfTruthFile: "source-of-truth/candidate-to-packet-bridge.md";
    reusedForOpportunity: true;
  };
  selectedDraft: {
    kind: OpportunityBuildPacketBridgeDraftKind;
    reason: string;
    ownerApprovalRequired: true;
  };
  packetDraft: OpportunityBuildPacketBridgePacketDraft;
  decision: {
    bridgeStatus: "draft_ready";
    nextSafeAction: "review_packet_draft";
    finalPacketsCreated: false;
    phaseIssuesCreated: false;
    codexBuildTriggered: false;
    githubIssuesCreated: false;
    ownerApprovalRecorded: true;
  };
  ownerReadableReport: string;
  sourceArtifactEvidence: OpportunityBuildPacketBridgeSourceEvidence[];
  guardrails: ReturnType<typeof opportunityBuildPacketBridgeGuardrails>;
};

type OpportunityBuildPacketBridgeStore = {
  schemaVersion: 1;
  records: OpportunityBuildPacketBridgeRecord[];
};

export function opportunityBuildPacketBridgeGuardrails() {
  return {
    ...durableStateGuardrails(),
    usesOpportunityAppEngineCandidateAsInput: true,
    reusesCandidatePacketBridgeStandard: true,
    adapterBackedLocalMockPersistence: true,
    ownerApprovalRequired: true,
    noFinalPacketsCreated: true,
    noCodexAutoExecution: true,
    noGitHubIssueCreation: true,
    noLabelChanges: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true
  };
}

export async function listOpportunityBuildPacketBridges() {
  const store = await readOpportunityBuildPacketBridgeStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createOpportunityBuildPacketBridge(input: { candidateId?: unknown; ownerApproved?: unknown }) {
  const candidateId = typeof input.candidateId === "string" ? input.candidateId.trim() : "";

  if (!candidateId) {
    throw new Error("Choose an Opportunity AppEngine candidate before preparing a packet draft.");
  }

  if (input.ownerApproved !== true) {
    throw new Error("Owner approval is required before preparing a packet draft.");
  }

  const candidate = await getOpportunityAppEngineCandidate(candidateId);

  if (!candidate) {
    throw new Error("That Opportunity AppEngine candidate could not be found.");
  }

  const packetType = choosePacketDraftKind(candidate.candidateType);

  if (!packetType) {
    throw new Error(`Candidate type ${candidate.candidateType} is not ready for a packet draft. Clarify or route it before preparing a packet draft.`);
  }

  const now = new Date().toISOString();
  const sourceCandidate = summarizeCandidate(candidate);
  const missingInformation = chooseMissingInformation(candidate);
  const packetDraft = buildPacketDraft(candidate, packetType);
  const sourceArtifactEvidence = buildSourceEvidence(candidate);
  const ownerReadableSummary = `${candidate.title}: ${packetType.replaceAll("_", " ")} prepared for owner review.`;
  const base = {
    id: randomUUID(),
    candidateId: candidate.id,
    actionPlanId: candidate.actionPlanId,
    solutionPathId: candidate.solutionPathId,
    clarificationId: candidate.clarificationId,
    intakeId: candidate.intakeId,
    createdAt: now,
    updatedAt: now,
    title: candidate.title,
    status: "draft_ready" as const,
    packetDraftStatus: "review_ready_draft" as const,
    packetType,
    sourceCandidate,
    packetDraft,
    missingInformation,
    nextSafeAction: "review_packet_draft" as const,
    ownerApprovalStatus: "owner_approved_for_packet_draft" as const,
    sourceArtifactEvidence,
    ownerReadableSummary,
    copyableNextAppEnginePrompt: buildNextPrompt(candidate, packetType, missingInformation),
    guardrails: opportunityBuildPacketBridgeGuardrails()
  };
  const artifact = buildArtifact(base, candidate, packetType);
  const record: OpportunityBuildPacketBridgeRecord = {
    ...base,
    artifact
  };
  const store = await readOpportunityBuildPacketBridgeStore();
  const records = [record, ...store.records.filter((bridge) => bridge.candidateId !== candidate.id)];

  await writeOpportunityBuildPacketBridgeStore({
    schemaVersion: 1,
    records
  });
  await updateProjectMemoryFromOpportunityBuildPacketBridge(record);
  await getAppEngineAuditTrail().append({
    type: "opportunity_packet_draft_prepared",
    actor: { type: "owner", id: "Lincoln" },
    summary: `${record.packetType.replaceAll("_", " ")} prepared from Opportunity candidate ${record.title}.`,
    subjectId: record.id,
    metadata: {
      candidateId: record.candidateId,
      packetType: record.packetType,
      status: record.status,
      finalPacketCreated: false,
      codexTriggered: false
    }
  });

  return record;
}

function choosePacketDraftKind(candidateType: OpportunityAppEngineCandidateType): OpportunityBuildPacketBridgeDraftKind | null {
  const map: Partial<Record<OpportunityAppEngineCandidateType, OpportunityBuildPacketBridgeDraftKind>> = {
    app_build_candidate: "app_build_packet_draft",
    workflow_candidate: "workflow_solution_plan_draft",
    content_resource_candidate: "content_resource_plan_draft",
    community_model_candidate: "community_model_plan_draft"
  };

  return map[candidateType] || null;
}

function summarizeCandidate(candidate: OpportunityAppEngineCandidateRecord): OpportunityBuildPacketBridgeSourceCandidate {
  return {
    id: candidate.id,
    title: candidate.title,
    candidateType: candidate.candidateType,
    proposedAppEngineWorkType: candidate.proposedAppEngineWorkType,
    confidenceLevel: candidate.confidenceLevel,
    actionPlanSummary: candidate.actionPlanSummary
  };
}

function chooseMissingInformation(candidate: OpportunityAppEngineCandidateRecord) {
  return Array.from(
    new Set([
      ...candidate.missingOwnerDecisions,
      ...candidate.risksBlockers,
      "Review this packet draft before any final packet, phase issue, GitHub issue, label, Codex run, or deploy exists."
    ])
  );
}

function buildPacketDraft(
  candidate: OpportunityAppEngineCandidateRecord,
  packetType: OpportunityBuildPacketBridgeDraftKind
): OpportunityBuildPacketBridgePacketDraft {
  return {
    kind: packetType,
    schemaVersion: 1,
    status: "review_ready_draft",
    sourceCandidateId: candidate.id,
    sourceOpportunityIntakeId: candidate.intakeId,
    title: candidate.title,
    summary: candidate.actionPlanSummary,
    recommendedNextStep: "review_packet_draft",
    finalPacketCreated: false,
    phaseIssuesCreated: false,
    codexTriggered: false
  };
}

function buildSourceEvidence(candidate: OpportunityAppEngineCandidateRecord): OpportunityBuildPacketBridgeSourceEvidence[] {
  return [
    { kind: "opportunity_appengine_candidate", id: candidate.id, summary: candidate.title },
    { kind: "opportunity_action_plan", id: candidate.actionPlanId, summary: candidate.actionPlanSummary },
    { kind: "opportunity_solution_path", id: candidate.solutionPathId, summary: candidate.solutionPath.reasonForRouting },
    { kind: "opportunity_clarification", id: candidate.clarificationId, summary: candidate.clarifiedProblem.coreProblem },
    { kind: "opportunity_intake", id: candidate.intakeId, summary: candidate.sourceOpportunityIntake.title },
    {
      kind: "candidate_packet_bridge_standard",
      summary: "Reuses source-of-truth/candidate-to-packet-bridge.md for draft-only packet guardrails."
    }
  ];
}

function buildArtifact(
  record: Omit<OpportunityBuildPacketBridgeRecord, "artifact">,
  candidate: OpportunityAppEngineCandidateRecord,
  packetType: OpportunityBuildPacketBridgeDraftKind
): OpportunityBuildPacketBridgeArtifact {
  return {
    kind: "opportunity_build_packet_bridge",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "opportunity_appengine_candidate",
      candidateId: candidate.id,
      actionPlanId: candidate.actionPlanId,
      solutionPathId: candidate.solutionPathId,
      clarificationId: candidate.clarificationId,
      intakeId: candidate.intakeId
    },
    existingBridgeStandard: {
      kind: "candidate_packet_bridge",
      sourceOfTruthFile: "source-of-truth/candidate-to-packet-bridge.md",
      reusedForOpportunity: true
    },
    selectedDraft: {
      kind: packetType,
      reason: selectedDraftReason(packetType),
      ownerApprovalRequired: true
    },
    packetDraft: record.packetDraft,
    decision: {
      bridgeStatus: "draft_ready",
      nextSafeAction: "review_packet_draft",
      finalPacketsCreated: false,
      phaseIssuesCreated: false,
      codexBuildTriggered: false,
      githubIssuesCreated: false,
      ownerApprovalRecorded: true
    },
    ownerReadableReport: record.ownerReadableSummary,
    sourceArtifactEvidence: record.sourceArtifactEvidence,
    guardrails: record.guardrails
  };
}

function selectedDraftReason(packetType: OpportunityBuildPacketBridgeDraftKind) {
  const reasons: Record<OpportunityBuildPacketBridgeDraftKind, string> = {
    app_build_packet_draft: "Owner-approved Opportunity candidate is ready for an App Build Packet draft.",
    workflow_solution_plan_draft: "Owner-approved Opportunity candidate is a workflow/tool solution path, not a full app build yet.",
    content_resource_plan_draft: "Owner-approved Opportunity candidate is a content/resource solution path.",
    community_model_plan_draft: "Owner-approved Opportunity candidate is a community/ministry model solution path."
  };

  return reasons[packetType];
}

function buildNextPrompt(
  candidate: OpportunityAppEngineCandidateRecord,
  packetType: OpportunityBuildPacketBridgeDraftKind,
  missingInformation: string[]
) {
  return `Review this opportunity_build_packet_bridge for AppEngine.\n\nSource candidate: ${candidate.title} (${candidate.id})\nPacket draft type: ${packetType}\nCandidate type: ${candidate.candidateType}\nAction plan summary: ${candidate.actionPlanSummary}\nMissing information: ${missingInformation.join(", ")}\n\nGoal: Review the packet draft and decide whether it should advance to packet_draft_approval, needs revision, or should pause.\n\nGuardrails: Do not create final packets, trigger Codex, create GitHub issues, apply labels, deploy production, create paid resources, run migrations, add secrets/env vars, change repo visibility, or auto-merge generated code.`;
}

async function readOpportunityBuildPacketBridgeStore(): Promise<OpportunityBuildPacketBridgeStore> {
  return getAppEngineStateAdapter().readJson<OpportunityBuildPacketBridgeStore>(
    { kind: "opportunity_build_packet_bridge", key: "records" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeOpportunityBuildPacketBridgeStore(store: OpportunityBuildPacketBridgeStore) {
  return getAppEngineStateAdapter().writeJson({ kind: "opportunity_build_packet_bridge", key: "records" }, store);
}
