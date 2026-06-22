import { randomUUID } from "node:crypto";
import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";

// NON-CANONICAL: real_opportunity_example_runner is an example runner / test
// fixture. The canonical execution record is loop_run_records
// (createLoopRunFromPacket / completeLoopRun); this runner is read-only evidence
// and must not create competing execution records.
export const CANONICAL_EXECUTION_NOTE =
  "loop_run_records is the canonical execution record; real_opportunity_example_runner is a read-only example fixture.";
import {
  runOpportunityFullLoopTrial,
  type OpportunityFullLoopTrialInput,
  type OpportunityFullLoopTrialRecord
} from "@/lib/engine/opportunity-full-loop-trial";
import { updateProjectMemoryFromRealOpportunityExample } from "@/lib/engine/project-memory";

export type RealOpportunityExampleContext = "lincoln_ecosystem" | "outside_customer_community_leader";
export type RealOpportunityExampleStatus = "completed" | "blocked";

export type RealOpportunityExampleInput = {
  problemOrVision?: unknown;
  affectedPeople?: unknown;
  betterFuture?: unknown;
  barriers?: unknown;
  desiredImpact?: unknown;
  exampleContext?: unknown;
};

export type RealOpportunityExampleRunRecord = {
  id: string;
  kind: "real_opportunity_example_runner";
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  status: RealOpportunityExampleStatus;
  exampleContext: RealOpportunityExampleContext;
  sourceInput: {
    problemOrVision: string;
    affectedPeople: string;
    betterFuture: string;
    barriers: string;
    desiredImpact: string;
  };
  fullLoopTrial: OpportunityFullLoopTrialRecord;
  fullLoopTrialId: string;
  artifacts: OpportunityFullLoopTrialRecord["artifacts"];
  steps: OpportunityFullLoopTrialRecord["steps"];
  missingInformation: string[];
  nextSafeAction: string;
  ownerReadableSummary: string;
  copyableNextAction: string;
  guardrails: ReturnType<typeof realOpportunityExampleGuardrails>;
};

type RealOpportunityExampleStore = {
  schemaVersion: 1;
  records: RealOpportunityExampleRunRecord[];
};

export function realOpportunityExampleGuardrails() {
  return {
    ...durableStateGuardrails(),
    ownerEnteredExampleOnly: true,
    usesOpportunityControlledUseFlow: true,
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

export async function listRealOpportunityExamples() {
  const store = await readRealOpportunityExampleStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function runRealOpportunityExample(input: RealOpportunityExampleInput) {
  const normalized = normalizeRealOpportunityExample(input);
  const fullLoopTrial = await runOpportunityFullLoopTrial(toOpportunityFullLoopInput(normalized));
  const now = new Date().toISOString();
  const record: RealOpportunityExampleRunRecord = {
    id: randomUUID(),
    kind: "real_opportunity_example_runner",
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    status: fullLoopTrial.status,
    exampleContext: normalized.exampleContext,
    sourceInput: {
      problemOrVision: normalized.problemOrVision,
      affectedPeople: normalized.affectedPeople,
      betterFuture: normalized.betterFuture,
      barriers: normalized.barriers,
      desiredImpact: normalized.desiredImpact
    },
    fullLoopTrial,
    fullLoopTrialId: fullLoopTrial.id,
    artifacts: fullLoopTrial.artifacts,
    steps: fullLoopTrial.steps,
    missingInformation: fullLoopTrial.missingInformation,
    nextSafeAction: fullLoopTrial.nextSafeAction,
    ownerReadableSummary:
      fullLoopTrial.status === "completed"
        ? `${contextLabel(normalized.exampleContext)} real Opportunity example reached packet draft readiness.`
        : `${contextLabel(normalized.exampleContext)} real Opportunity example is blocked before packet draft readiness.`,
    copyableNextAction: buildCopyableNextAction(normalized, fullLoopTrial),
    guardrails: realOpportunityExampleGuardrails()
  };

  await writeRealOpportunityExample(record);
  await updateProjectMemoryFromRealOpportunityExample(record);
  await getAppEngineAuditTrail().append({
    type: "real_opportunity_example_ran",
    actor: { type: "owner", id: "Lincoln" },
    summary: record.ownerReadableSummary,
    subjectId: record.id,
    metadata: {
      status: record.status,
      exampleContext: record.exampleContext,
      fullLoopTrialId: record.fullLoopTrialId,
      packetBridgeId: record.artifacts.packetBridgeId,
      codexTriggered: false,
      githubIssuesCreated: false,
      finalPacketCreated: false
    }
  });

  return record;
}

function normalizeRealOpportunityExample(input: RealOpportunityExampleInput) {
  const normalized = {
    problemOrVision: cleanRequiredText(input.problemOrVision, "problem or vision", 12),
    affectedPeople: cleanRequiredText(input.affectedPeople, "who is affected", 6),
    betterFuture: cleanRequiredText(input.betterFuture, "desired better future", 8),
    barriers: cleanRequiredText(input.barriers, "barriers", 6),
    desiredImpact: cleanRequiredText(input.desiredImpact, "desired impact", 8),
    exampleContext: parseExampleContext(input.exampleContext)
  };

  return normalized;
}

function toOpportunityFullLoopInput(input: ReturnType<typeof normalizeRealOpportunityExample>): OpportunityFullLoopTrialInput {
  return {
    mode: "tools",
    problemPain: input.problemOrVision,
    affectedPeople: input.affectedPeople,
    betterOutcome: input.betterFuture,
    currentBarriers: input.barriers,
    existingIdeaVision: `${contextLabel(input.exampleContext)}. Owner-entered real example: ${input.problemOrVision}`,
    desiredImpact: input.desiredImpact,
    possibleSolutionType: "app_tool_workflow"
  };
}

function buildCopyableNextAction(
  input: ReturnType<typeof normalizeRealOpportunityExample>,
  fullLoopTrial: OpportunityFullLoopTrialRecord
) {
  return `Review this real Opportunity example.\n\nContext: ${contextLabel(input.exampleContext)}\nProblem or vision: ${input.problemOrVision}\nAffected people: ${input.affectedPeople}\nDesired better future: ${input.betterFuture}\nBarriers: ${input.barriers}\nDesired impact: ${input.desiredImpact}\n\nFull-loop status: ${fullLoopTrial.status}\nPacket bridge: ${fullLoopTrial.artifacts.packetBridgeId || "not prepared"}\nMissing information: ${fullLoopTrial.missingInformation.join(", ") || "None"}\nNext safe action: ${fullLoopTrial.nextSafeAction}\n\nGuardrails: Do not create final packets, trigger Codex, create GitHub issues, apply labels, deploy production, create paid resources, run live migrations, add secrets/env vars, change repo visibility, or auto-merge generated code.`;
}

function cleanRequiredText(value: unknown, label: string, minLength: number) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

  if (text.length < minLength) {
    throw new Error(`Add a clearer ${label} before running the real Opportunity example.`);
  }

  return text.slice(0, 1600);
}

function parseExampleContext(value: unknown): RealOpportunityExampleContext {
  if (value === "outside_customer_community_leader") return "outside_customer_community_leader";
  return "lincoln_ecosystem";
}

function contextLabel(value: RealOpportunityExampleContext) {
  if (value === "outside_customer_community_leader") return "Outside customer/community leader";
  return "Lincoln ecosystem";
}

async function readRealOpportunityExampleStore(): Promise<RealOpportunityExampleStore> {
  return getAppEngineStateAdapter().readJson<RealOpportunityExampleStore>(
    { kind: "real_opportunity_example_runner", key: "records" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeRealOpportunityExample(record: RealOpportunityExampleRunRecord) {
  const store = await readRealOpportunityExampleStore();
  await getAppEngineStateAdapter().writeJson(
    { kind: "real_opportunity_example_runner", key: "records" },
    {
      schemaVersion: 1,
      records: [record, ...store.records]
    }
  );
}
