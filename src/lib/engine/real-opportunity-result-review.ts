import { randomUUID } from "node:crypto";
import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import {
  listRealOpportunityExamples,
  type RealOpportunityExampleRunRecord
} from "@/lib/engine/real-opportunity-example-runner";

export type RealOpportunityResultReviewStatus =
  | "useful"
  | "needs_clarification"
  | "wrong_direction"
  | "missing_requirement"
  | "ready_for_next_appengine_action";

export type RealOpportunityResultReviewInput = {
  exampleId?: unknown;
  status?: unknown;
  ownerNotes?: unknown;
};

export type RealOpportunityResultReviewRecord = {
  id: string;
  kind: "real_opportunity_result_review";
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  exampleId: string;
  fullLoopTrialId: string;
  reviewStatus: RealOpportunityResultReviewStatus;
  ownerNotes: string;
  resultSnapshot: {
    originalProblemOrVision: string;
    affectedPeople: string;
    desiredBetterFuture: string;
    barriers: string;
    desiredImpact: string;
    clarification: string;
    solutionPath: string;
    actionPlan: string;
    appEngineCandidate: string;
    packetDraftBridgeState: string;
    nextSafeAction: string;
  };
  usefulSignals: string[];
  concerns: string[];
  portfolioStateUpdate: {
    shouldUpdate: boolean;
    status: string;
    nextSafeAction: string;
    blocker: string | null;
  };
  nextAppEngineAction: {
    prompt: string;
    reason: string;
    expectedOutcome: string;
    dependencies: string[];
  };
  ownerReadableSummary: string;
  guardrails: ReturnType<typeof realOpportunityResultReviewGuardrails>;
};

type RealOpportunityResultReviewStore = {
  schemaVersion: 1;
  records: RealOpportunityResultReviewRecord[];
};

export function realOpportunityResultReviewGuardrails() {
  return {
    ...durableStateGuardrails(),
    ownerReviewOnly: true,
    updatesProjectMemory: true,
    writesAuditTrailEvent: true,
    updatesPortfolioStateWhenReady: true,
    adapterBackedLocalMockPersistence: true,
    noFinalPacketCreated: true,
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

export async function listRealOpportunityResultReviews() {
  const store = await readRealOpportunityResultReviewStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createRealOpportunityResultReview(input: RealOpportunityResultReviewInput) {
  const examples = await listRealOpportunityExamples();
  const example = resolveExample(input.exampleId, examples);
  const reviewStatus = parseReviewStatus(input.status);
  const ownerNotes = cleanOwnerNotes(input.ownerNotes);
  const now = new Date().toISOString();
  const resultSnapshot = buildResultSnapshot(example);
  const portfolioStateUpdate = buildPortfolioStateUpdate(reviewStatus);
  const nextAppEngineAction = buildNextAppEngineAction({
    example,
    ownerNotes,
    portfolioStateUpdate,
    resultSnapshot,
    reviewStatus
  });
  const record: RealOpportunityResultReviewRecord = {
    id: randomUUID(),
    kind: "real_opportunity_result_review",
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    exampleId: example.id,
    fullLoopTrialId: example.fullLoopTrialId,
    reviewStatus,
    ownerNotes,
    resultSnapshot,
    usefulSignals: buildUsefulSignals(reviewStatus, resultSnapshot),
    concerns: buildConcerns(reviewStatus, ownerNotes, resultSnapshot),
    portfolioStateUpdate,
    nextAppEngineAction,
    ownerReadableSummary: buildOwnerReadableSummary(reviewStatus, resultSnapshot, portfolioStateUpdate),
    guardrails: realOpportunityResultReviewGuardrails()
  };

  await writeRealOpportunityResultReview(record);
  await getAppEngineAuditTrail().append({
    type: "real_opportunity_result_reviewed",
    actor: { type: "owner", id: "Lincoln" },
    summary: record.ownerReadableSummary,
    subjectId: record.id,
    metadata: {
      reviewStatus: record.reviewStatus,
      exampleId: record.exampleId,
      fullLoopTrialId: record.fullLoopTrialId,
      readyForNextAppEngineAction: record.reviewStatus === "ready_for_next_appengine_action",
      codexTriggered: false,
      finalPacketCreated: false,
      githubIssuesCreated: false
    }
  });

  return record;
}

function resolveExample(exampleId: unknown, examples: RealOpportunityExampleRunRecord[]) {
  const requestedId = typeof exampleId === "string" ? exampleId.trim() : "";
  const example = requestedId ? examples.find((candidate) => candidate.id === requestedId) : examples[0];

  if (!example) {
    throw new Error("Run a real Opportunity example before reviewing its result.");
  }

  return example;
}

function parseReviewStatus(value: unknown): RealOpportunityResultReviewStatus {
  if (typeof value === "string" && isReviewStatus(value)) return value;
  throw new Error(`Unsupported real Opportunity result review status: ${String(value || "missing")}`);
}

function isReviewStatus(value: string): value is RealOpportunityResultReviewStatus {
  return [
    "useful",
    "needs_clarification",
    "wrong_direction",
    "missing_requirement",
    "ready_for_next_appengine_action"
  ].includes(value);
}

function cleanOwnerNotes(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 1800) : "";
}

function buildResultSnapshot(example: RealOpportunityExampleRunRecord): RealOpportunityResultReviewRecord["resultSnapshot"] {
  return {
    originalProblemOrVision: example.sourceInput.problemOrVision,
    affectedPeople: example.sourceInput.affectedPeople,
    desiredBetterFuture: example.sourceInput.betterFuture,
    barriers: example.sourceInput.barriers,
    desiredImpact: example.sourceInput.desiredImpact,
    clarification: sourceArtifactSummary(example, "opportunity_clarification"),
    solutionPath: sourceArtifactSummary(example, "opportunity_solution_path"),
    actionPlan: sourceArtifactSummary(example, "opportunity_action_plan"),
    appEngineCandidate: sourceArtifactSummary(example, "opportunity_appengine_candidate"),
    packetDraftBridgeState:
      sourceArtifactSummary(example, "opportunity_build_packet_bridge") ||
      `${example.fullLoopTrial.packetDraftReadiness.status.replaceAll("_", " ")} · ${example.fullLoopTrial.packetDraftReadiness.packetType.replaceAll("_", " ")}`,
    nextSafeAction: example.nextSafeAction
  };
}

function sourceArtifactSummary(example: RealOpportunityExampleRunRecord, kind: string) {
  return example.fullLoopTrial.sourceArtifacts.find((artifact) => artifact.kind === kind)?.summary || "Not available yet.";
}

function buildPortfolioStateUpdate(reviewStatus: RealOpportunityResultReviewStatus) {
  if (reviewStatus === "ready_for_next_appengine_action") {
    return {
      shouldUpdate: true,
      status: "real Opportunity result reviewed and ready for next AppEngine action",
      nextSafeAction: "continue_internal_trial",
      blocker: null
    };
  }

  const blockerByStatus: Record<Exclude<RealOpportunityResultReviewStatus, "ready_for_next_appengine_action">, string> = {
    useful: "Owner marked the result useful, but has not approved the next AppEngine action yet.",
    needs_clarification: "Owner needs clarification before the result can advance.",
    wrong_direction: "Owner marked the result as the wrong direction.",
    missing_requirement: "Owner identified a missing requirement before next action."
  };

  return {
    shouldUpdate: false,
    status: `real Opportunity result reviewed as ${reviewStatus.replaceAll("_", " ")}`,
    nextSafeAction: "await_owner_review",
    blocker: blockerByStatus[reviewStatus]
  };
}

function buildNextAppEngineAction({
  example,
  ownerNotes,
  portfolioStateUpdate,
  resultSnapshot,
  reviewStatus
}: {
  example: RealOpportunityExampleRunRecord;
  ownerNotes: string;
  portfolioStateUpdate: ReturnType<typeof buildPortfolioStateUpdate>;
  resultSnapshot: RealOpportunityResultReviewRecord["resultSnapshot"];
  reviewStatus: RealOpportunityResultReviewStatus;
}): RealOpportunityResultReviewRecord["nextAppEngineAction"] {
  const prompt = [
    "Review the real Opportunity example result.",
    "",
    `Review status: ${reviewStatus.replaceAll("_", " ")}`,
    `Original problem or vision: ${resultSnapshot.originalProblemOrVision}`,
    `Clarification: ${resultSnapshot.clarification}`,
    `Solution path: ${resultSnapshot.solutionPath}`,
    `Action plan: ${resultSnapshot.actionPlan}`,
    `AppEngine candidate: ${resultSnapshot.appEngineCandidate}`,
    `Packet draft bridge: ${resultSnapshot.packetDraftBridgeState}`,
    `Owner notes: ${ownerNotes || "None"}`,
    "",
    "Next safe action:",
    portfolioStateUpdate.shouldUpdate
      ? "Prepare the next owner-reviewed AppEngine action from the packet draft bridge. Do not create final packets or trigger Codex automatically."
      : portfolioStateUpdate.blocker || "Keep this result in owner review.",
    "",
    "Guardrails:",
    "- Do not trigger Codex automatically.",
    "- Do not create final packets automatically.",
    "- Do not create GitHub issues.",
    "- Do not apply labels.",
    "- Do not deploy production.",
    "- Do not create paid resources.",
    "- Do not run live migrations.",
    "- Do not add secrets or env vars.",
    "- Do not change repository visibility."
  ].join("\n");

  return {
    prompt,
    reason: portfolioStateUpdate.shouldUpdate
      ? "Lincoln marked the real Opportunity result ready for the next AppEngine action."
      : "Lincoln's review requires clarification or correction before the result advances.",
    expectedOutcome: portfolioStateUpdate.shouldUpdate
      ? "A prepared owner-reviewed next action that still requires explicit approval before execution."
      : "A corrected or clarified Opportunity result before packet/action progression.",
    dependencies: [
      `real_opportunity_example_runner:${example.id}`,
      `opportunity_full_loop_trial:${example.fullLoopTrialId}`,
      ...(example.artifacts.packetBridgeId ? [`opportunity_build_packet_bridge:${example.artifacts.packetBridgeId}`] : [])
    ]
  };
}

function buildUsefulSignals(
  reviewStatus: RealOpportunityResultReviewStatus,
  snapshot: RealOpportunityResultReviewRecord["resultSnapshot"]
) {
  if (!["useful", "ready_for_next_appengine_action"].includes(reviewStatus)) return [];

  return [
    `Problem/vision is reviewable: ${snapshot.originalProblemOrVision}`,
    `Clarification exists: ${snapshot.clarification}`,
    `Packet bridge state exists: ${snapshot.packetDraftBridgeState}`
  ];
}

function buildConcerns(
  reviewStatus: RealOpportunityResultReviewStatus,
  ownerNotes: string,
  snapshot: RealOpportunityResultReviewRecord["resultSnapshot"]
) {
  const concerns: string[] = [];
  if (reviewStatus === "needs_clarification") concerns.push("Clarify the result before it advances.");
  if (reviewStatus === "wrong_direction") concerns.push("Re-check the opportunity direction before packet/action progression.");
  if (reviewStatus === "missing_requirement") concerns.push("Add the missing requirement before packet/action progression.");
  if (ownerNotes) concerns.push(`Owner note: ${ownerNotes}`);
  if (snapshot.packetDraftBridgeState === "Not available yet.") concerns.push("Packet draft bridge evidence is missing.");
  return concerns;
}

function buildOwnerReadableSummary(
  reviewStatus: RealOpportunityResultReviewStatus,
  snapshot: RealOpportunityResultReviewRecord["resultSnapshot"],
  portfolioStateUpdate: ReturnType<typeof buildPortfolioStateUpdate>
) {
  return `Real Opportunity result for "${snapshot.originalProblemOrVision}" reviewed as ${reviewStatus.replaceAll(
    "_",
    " "
  )}. Next: ${portfolioStateUpdate.shouldUpdate ? "ready for the next owner-approved AppEngine action" : portfolioStateUpdate.blocker}.`;
}

async function readRealOpportunityResultReviewStore(): Promise<RealOpportunityResultReviewStore> {
  return getAppEngineStateAdapter().readJson<RealOpportunityResultReviewStore>(
    { kind: "real_opportunity_result_review", key: "records" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeRealOpportunityResultReview(record: RealOpportunityResultReviewRecord) {
  const store = await readRealOpportunityResultReviewStore();
  await getAppEngineStateAdapter().writeJson(
    { kind: "real_opportunity_result_review", key: "records" },
    {
      schemaVersion: 1,
      records: [record, ...store.records]
    }
  );
}
