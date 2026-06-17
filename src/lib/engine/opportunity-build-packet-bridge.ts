import { randomUUID } from "node:crypto";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import {
  getOpportunityAppEngineCandidate,
  opportunityAppEngineCandidateGuardrails,
  type OpportunityAppEngineCandidateRecord,
  type OpportunityAppEngineCandidateType
} from "@/lib/engine/opportunity-appengine-candidate";

export type OpportunityBuildPacketDraftKind =
  | "app_build_packet_draft"
  | "workflow_solution_plan_draft"
  | "content_resource_plan_draft"
  | "community_model_plan_draft";

export type OpportunityBuildPacketOwnerApprovalStatus = "owner_review_required" | "needs_more_information";

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
  sourceOpportunityReferences: OpportunityBuildPacketSourceReferences;
  candidateSummary: string;
  selectedSolutionType: OpportunityAppEngineCandidateType;
  recommendedPacket: OpportunityBuildPacketDraftKind;
  packetDraft: OpportunityBuildPacketDraft;
  missingInformation: string[];
  ownerApprovalStatus: OpportunityBuildPacketOwnerApprovalStatus;
  nextAppEngineStep: string;
  copyableNextAppEnginePrompt: string;
  safetyNotes: string[];
  artifact: OpportunityBuildPacketBridgeArtifact;
};

export type OpportunityBuildPacketSourceReferences = {
  opportunityIntakeId: string;
  clarificationId: string;
  solutionPathId: string;
  actionPlanId: string;
  candidateId: string;
};

export type OpportunityBuildPacketDraft = {
  kind: OpportunityBuildPacketDraftKind;
  schemaVersion: 1;
  status: "review_ready_draft";
  source: "opportunity_build_packet_bridge";
  title: string;
  summary: string;
  selectedSolutionType: OpportunityAppEngineCandidateType;
  recommendedNextStep: "review_packet_draft";
  ownerApprovalRequired: true;
  finalPacketCreated: false;
  phaseIssuesCreated: false;
  sourceOpportunityReferences: OpportunityBuildPacketSourceReferences;
  fields: {
    purpose: string;
    audience: string;
    needAddressed: string;
    desiredTransformation: string;
    barrierRemoved: string;
    boundaries: string[];
    nextPlanningArtifact: string;
  };
};

export type OpportunityBuildPacketBridgeArtifact = {
  kind: "opportunity_build_packet_bridge";
  schemaVersion: 1;
  sourceArtifact: {
    kind: "opportunity_appengine_candidate";
    candidateId: string;
    candidateType: OpportunityAppEngineCandidateType;
    actionPlanId: string;
    solutionPathId: string;
    clarificationId: string;
    intakeId: string;
  };
  candidate: {
    summary: string;
    selectedSolutionType: OpportunityAppEngineCandidateType;
    proposedAppEngineWorkType: string;
    recommendedArtifactToCreateNext: string;
    confidenceLevel: string;
  };
  selectedDraft: {
    kind: OpportunityBuildPacketDraftKind;
    reason: string;
    ownerApprovalRequired: true;
  };
  packetDraft: OpportunityBuildPacketDraft;
  decision: {
    bridgeStatus: "draft_ready" | "needs_more_information";
    ownerApprovalStatus: OpportunityBuildPacketOwnerApprovalStatus;
    nextSafeAction: "review_packet_draft" | "collect_missing_information";
    finalPacketCreated: false;
    buildPacketCreated: false;
    phaseIssuesCreated: false;
    codexTriggered: false;
    githubIssuesCreated: false;
    labelsApplied: false;
  };
  sourceOfTruthFiles: string[];
  guardrails: ReturnType<typeof opportunityBuildPacketBridgeGuardrails>;
  ownerReadableReport: string;
  copyableNextAppEnginePrompt: string;
};

type OpportunityBuildPacketBridgeStore = {
  schemaVersion: 1;
  records: OpportunityBuildPacketBridgeRecord[];
};

const sourceOfTruthFiles = [
  "source-of-truth/00-why-we-build.md",
  "source-of-truth/01-ecosystem-philosophy.md",
  "source-of-truth/02-global-principles.md",
  "source-of-truth/03-life-produces-life.md",
  "source-of-truth/04-app-purpose-rules.md",
  "source-of-truth/05-ecosystem-design-gates.md",
  "source-of-truth/opportunity-intake-foundation.md",
  "source-of-truth/opportunity-clarification-engine.md",
  "source-of-truth/opportunity-solution-path-router.md",
  "source-of-truth/opportunity-action-plan-draft.md",
  "source-of-truth/opportunity-appengine-candidate-bridge.md",
  "source-of-truth/opportunity-build-packet-bridge.md",
  "source-of-truth/problem-to-solution-intake-standard.md",
  "source-of-truth/problem-portfolio-routing-standard.md",
  "source-of-truth/candidate-to-packet-bridge.md",
  "source-of-truth/packet-draft-approval-gate.md",
  "source-of-truth/final-packet-materialization.md",
  "source-of-truth/app-build-packet.md",
  "source-of-truth/app-portfolio-registry.md"
];

export function opportunityBuildPacketBridgeGuardrails() {
  return {
    ...durableStateGuardrails(),
    ...opportunityAppEngineCandidateGuardrails(),
    usesOpportunityAppEngineCandidateAsInput: true,
    adapterBackedLocalMockPersistence: true,
    reusesExistingPacketStandards: true,
    noParallelPacketSystem: true,
    noBuildPacketsCreated: true,
    noFinalPacketsCreated: true,
    noCodexAutoExecution: true,
    noGithubIssueCreation: true,
    noLabelChanges: true,
    noDeploymentsCreated: true,
    ownerReviewRequiredBeforeFinalPacket: true
  };
}

export async function listOpportunityBuildPacketBridges() {
  const store = await readOpportunityBuildPacketBridgeStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createOpportunityBuildPacketBridge(input: { candidateId?: unknown }) {
  const candidateId = typeof input.candidateId === "string" ? input.candidateId.trim() : "";

  if (!candidateId) {
    throw new Error("Choose an Opportunity AppEngine candidate before creating a packet bridge.");
  }

  const candidate = await getOpportunityAppEngineCandidate(candidateId);

  if (!candidate) {
    throw new Error("That Opportunity AppEngine candidate could not be found.");
  }

  const now = new Date().toISOString();
  const sourceOpportunityReferences = buildSourceReferences(candidate);
  const recommendedPacket = chooseRecommendedPacket(candidate);
  const missingInformation = chooseMissingInformation(candidate);
  const ownerApprovalStatus: OpportunityBuildPacketOwnerApprovalStatus =
    candidate.candidateType === "needs_more_info" ? "needs_more_information" : "owner_review_required";
  const nextAppEngineStep =
    ownerApprovalStatus === "needs_more_information" ? "collect_missing_information" : "review_packet_draft";
  const packetDraft = buildPacketDraft({
    candidate,
    sourceOpportunityReferences,
    recommendedPacket
  });
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
    sourceOpportunityReferences,
    candidateSummary: candidate.actionPlanSummary,
    selectedSolutionType: candidate.candidateType,
    recommendedPacket,
    packetDraft,
    missingInformation,
    ownerApprovalStatus,
    nextAppEngineStep,
    safetyNotes: [
      "This bridge uses opportunity_appengine_candidate as input and remains owner-reviewable.",
      "It creates a draft recommendation only; no final packet, build packet, Codex run, GitHub issue, label, deployment, migration, paid resource, secret, or env change is triggered.",
      "It reuses the existing packet approval path instead of creating a parallel planning system."
    ]
  };
  const copyableNextAppEnginePrompt = buildNextPrompt(base, candidate);
  const artifact = buildOpportunityBuildPacketBridgeArtifact({ ...base, copyableNextAppEnginePrompt }, candidate);
  const record: OpportunityBuildPacketBridgeRecord = {
    ...base,
    copyableNextAppEnginePrompt,
    artifact
  };
  const store = await readOpportunityBuildPacketBridgeStore();
  const records = [record, ...store.records.filter((item) => item.candidateId !== candidate.id)];

  await writeOpportunityBuildPacketBridgeStore({
    schemaVersion: 1,
    records
  });

  return record;
}

function buildOpportunityBuildPacketBridgeArtifact(
  record: Omit<OpportunityBuildPacketBridgeRecord, "artifact">,
  candidate: OpportunityAppEngineCandidateRecord
): OpportunityBuildPacketBridgeArtifact {
  const bridgeStatus = record.ownerApprovalStatus === "needs_more_information" ? "needs_more_information" : "draft_ready";
  const nextSafeAction = record.ownerApprovalStatus === "needs_more_information" ? "collect_missing_information" : "review_packet_draft";

  return {
    kind: "opportunity_build_packet_bridge",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "opportunity_appengine_candidate",
      candidateId: candidate.id,
      candidateType: candidate.candidateType,
      actionPlanId: candidate.actionPlanId,
      solutionPathId: candidate.solutionPathId,
      clarificationId: candidate.clarificationId,
      intakeId: candidate.intakeId
    },
    candidate: {
      summary: record.candidateSummary,
      selectedSolutionType: record.selectedSolutionType,
      proposedAppEngineWorkType: candidate.proposedAppEngineWorkType,
      recommendedArtifactToCreateNext: candidate.recommendedArtifactToCreateNext,
      confidenceLevel: candidate.confidenceLevel
    },
    selectedDraft: {
      kind: record.recommendedPacket,
      reason: selectedDraftReason(candidate),
      ownerApprovalRequired: true
    },
    packetDraft: record.packetDraft,
    decision: {
      bridgeStatus,
      ownerApprovalStatus: record.ownerApprovalStatus,
      nextSafeAction,
      finalPacketCreated: false,
      buildPacketCreated: false,
      phaseIssuesCreated: false,
      codexTriggered: false,
      githubIssuesCreated: false,
      labelsApplied: false
    },
    sourceOfTruthFiles,
    guardrails: opportunityBuildPacketBridgeGuardrails(),
    ownerReadableReport: renderOwnerReport(record, candidate),
    copyableNextAppEnginePrompt: record.copyableNextAppEnginePrompt
  };
}

function buildSourceReferences(candidate: OpportunityAppEngineCandidateRecord): OpportunityBuildPacketSourceReferences {
  return {
    opportunityIntakeId: candidate.intakeId,
    clarificationId: candidate.clarificationId,
    solutionPathId: candidate.solutionPathId,
    actionPlanId: candidate.actionPlanId,
    candidateId: candidate.id
  };
}

function chooseRecommendedPacket(candidate: OpportunityAppEngineCandidateRecord): OpportunityBuildPacketDraftKind {
  const map: Record<OpportunityAppEngineCandidateType, OpportunityBuildPacketDraftKind> = {
    app_build_candidate: "app_build_packet_draft",
    workflow_candidate: "workflow_solution_plan_draft",
    content_resource_candidate: "content_resource_plan_draft",
    community_model_candidate: "community_model_plan_draft",
    ecosystem_service_later_candidate: "workflow_solution_plan_draft",
    needs_more_info: "workflow_solution_plan_draft"
  };

  return map[candidate.candidateType];
}

function buildPacketDraft({
  candidate,
  sourceOpportunityReferences,
  recommendedPacket
}: {
  candidate: OpportunityAppEngineCandidateRecord;
  sourceOpportunityReferences: OpportunityBuildPacketSourceReferences;
  recommendedPacket: OpportunityBuildPacketDraftKind;
}): OpportunityBuildPacketDraft {
  const clarified = candidate.clarifiedProblem;
  const intake = candidate.sourceOpportunityIntake;

  return {
    kind: recommendedPacket,
    schemaVersion: 1,
    status: "review_ready_draft",
    source: "opportunity_build_packet_bridge",
    title: candidate.title,
    summary: candidate.actionPlanSummary,
    selectedSolutionType: candidate.candidateType,
    recommendedNextStep: "review_packet_draft",
    ownerApprovalRequired: true,
    finalPacketCreated: false,
    phaseIssuesCreated: false,
    sourceOpportunityReferences,
    fields: {
      purpose: candidate.actionPlanSummary,
      audience: clarified.affectedPeople || intake.affectedPeople,
      needAddressed: clarified.opportunityStatement || intake.betterOutcome,
      desiredTransformation: clarified.desiredBetterFuture || intake.betterOutcome,
      barrierRemoved: clarified.rootBarriers.join("; ") || intake.currentBarriers,
      boundaries: [
        "Draft only until owner review and existing packet approval gates approve the next step.",
        "Do not create final packets, phase issues, GitHub issues, labels, deployments, or Codex work from this bridge."
      ],
      nextPlanningArtifact: candidate.recommendedArtifactToCreateNext
    }
  };
}

function chooseMissingInformation(candidate: OpportunityAppEngineCandidateRecord) {
  const missing = [...candidate.missingOwnerDecisions, ...candidate.clarifiedProblem.missingInformation];

  if (candidate.candidateType === "needs_more_info") {
    missing.push("answer missing context before packet draft review can advance");
  }

  return Array.from(new Set(missing));
}

function selectedDraftReason(candidate: OpportunityAppEngineCandidateRecord) {
  const reasons: Record<OpportunityAppEngineCandidateType, string> = {
    app_build_candidate: "Opportunity candidate points toward a new app/tool and should reuse the existing App Build Packet draft path.",
    workflow_candidate: "Opportunity candidate points toward a workflow/tool solution and should become a workflow solution plan draft before packet approval.",
    content_resource_candidate: "Opportunity candidate points toward a content/resource solution and should become a content resource plan draft.",
    community_model_candidate: "Opportunity candidate points toward a community/ministry model and should become a community model plan draft.",
    ecosystem_service_later_candidate: "Opportunity candidate may route to an ecosystem service later, so it should stay a workflow readiness draft until the destination is verified.",
    needs_more_info: "Opportunity candidate needs more information before any packet can advance."
  };

  return reasons[candidate.candidateType];
}

function renderOwnerReport(
  record: Omit<OpportunityBuildPacketBridgeRecord, "artifact">,
  candidate: OpportunityAppEngineCandidateRecord
) {
  return [
    "Opportunity Candidate to Build Packet Bridge",
    "",
    `Candidate: ${candidate.title}`,
    `Selected solution type: ${record.selectedSolutionType}`,
    `Recommended packet draft: ${record.recommendedPacket}`,
    `Owner approval status: ${record.ownerApprovalStatus}`,
    `Next AppEngine step: ${record.nextAppEngineStep}`,
    "Guardrails: draft only, no final packet, no phase issues, no Codex, no deploy"
  ].join("\n");
}

function buildNextPrompt(
  record: Omit<OpportunityBuildPacketBridgeRecord, "artifact" | "copyableNextAppEnginePrompt">,
  candidate: OpportunityAppEngineCandidateRecord
) {
  return `Review this opportunity_build_packet_bridge for AppEngine.\n\nSource artifact: opportunity_appengine_candidate ${candidate.id}\nCandidate summary: ${record.candidateSummary}\nSelected solution type: ${record.selectedSolutionType}\nRecommended packet draft: ${record.recommendedPacket}\nOwner approval status: ${record.ownerApprovalStatus}\nMissing information: ${record.missingInformation.join(", ") || "None"}\nNext AppEngine step: ${record.nextAppEngineStep}\n\nGoal: Decide whether this packet draft recommendation should move into the existing packet draft approval path, needs more information, or should pause. Do not create build packets automatically.\n\nGuardrails: Do not trigger Codex, create GitHub issues, apply labels, deploy production, create paid resources, run migrations, add secrets/env vars, change repo visibility, create final packets, create phase issues, or assume ecosystem apps are fully built.`;
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
