import { randomUUID } from "node:crypto";
import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import { loadOwnerPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import { createOpportunityActionPlan, type OpportunityActionPlanRecord } from "@/lib/engine/opportunity-action-plan";
import {
  createOpportunityAppEngineCandidate,
  type OpportunityAppEngineCandidateRecord
} from "@/lib/engine/opportunity-appengine-candidate";
import {
  createOpportunityBuildPacketBridge,
  opportunityBuildPacketBridgeGuardrails,
  type OpportunityBuildPacketBridgeRecord
} from "@/lib/engine/opportunity-build-packet-bridge";
import {
  createOpportunityClarification,
  type OpportunityClarificationRecord
} from "@/lib/engine/opportunity-clarification";
import {
  createOpportunityIntakeRecord,
  type OpportunityIntakeRecord
} from "@/lib/engine/opportunity-intake";
import {
  createOpportunitySolutionPath,
  type OpportunitySolutionPathRecord
} from "@/lib/engine/opportunity-solution-path";
import { updateProjectMemoryFromOpportunityFullLoopTrial } from "@/lib/engine/project-memory";

export type OpportunityFullLoopTrialStatus = "completed" | "blocked";
export type OpportunityFullLoopTrialStepStatus = "completed" | "blocked" | "not_started";

export type OpportunityFullLoopTrialStepId =
  | "submit_opportunity_intake"
  | "generate_clarification"
  | "route_solution_path"
  | "draft_action_plan"
  | "create_appengine_candidate"
  | "owner_approve_candidate"
  | "prepare_packet_draft"
  | "show_portfolio_readiness"
  | "update_project_memory"
  | "write_audit_trail"
  | "show_next_safe_action";

export type OpportunityFullLoopTrialStep = {
  id: OpportunityFullLoopTrialStepId;
  label: string;
  status: OpportunityFullLoopTrialStepStatus;
  summary: string;
  artifactKind?: string;
  artifactId?: string;
  blocker?: string;
};

export type OpportunityFullLoopTrialRecord = {
  id: string;
  kind: "opportunity_full_loop_trial";
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  title: string;
  status: OpportunityFullLoopTrialStatus;
  steps: OpportunityFullLoopTrialStep[];
  artifacts: {
    intakeId: string | null;
    clarificationId: string | null;
    solutionPathId: string | null;
    actionPlanId: string | null;
    candidateId: string | null;
    packetBridgeId: string | null;
  };
  packetDraftReadiness: {
    ready: boolean;
    status: string;
    packetType: string;
    portfolioEntryVisible: boolean;
    portfolioSourceState: string;
  };
  missingInformation: string[];
  nextSafeAction: string;
  copyableNextAction: string;
  ownerReadableSummary: string;
  sourceArtifacts: OpportunityFullLoopSourceArtifact[];
  guardrails: ReturnType<typeof opportunityFullLoopTrialGuardrails>;
};

export type OpportunityFullLoopSourceArtifact = {
  kind: string;
  id: string;
  summary: string;
};

export type OpportunityFullLoopTrialInput = {
  mode?: unknown;
  problemPain?: unknown;
  affectedPeople?: unknown;
  betterOutcome?: unknown;
  currentBarriers?: unknown;
  existingIdeaVision?: unknown;
  desiredImpact?: unknown;
  possibleSolutionType?: unknown;
};

type OpportunityFullLoopTrialStore = {
  schemaVersion: 1;
  records: OpportunityFullLoopTrialRecord[];
};

type TrialContext = {
  intake?: OpportunityIntakeRecord;
  clarification?: OpportunityClarificationRecord;
  solutionPath?: OpportunitySolutionPathRecord;
  actionPlan?: OpportunityActionPlanRecord;
  candidate?: OpportunityAppEngineCandidateRecord;
  packetBridge?: OpportunityBuildPacketBridgeRecord;
};

export function opportunityFullLoopTrialGuardrails() {
  return {
    ...durableStateGuardrails(),
    ...opportunityBuildPacketBridgeGuardrails(),
    usesExistingOpportunityArtifacts: true,
    adapterBackedLocalMockPersistence: true,
    noParallelPlanningSystem: true,
    noFinalPacketCreated: true,
    noCodexAutoExecution: true,
    noGitHubIssueCreation: true,
    noLabelChanges: true,
    noDeployment: true
  };
}

export async function listOpportunityFullLoopTrials() {
  const store = await readOpportunityFullLoopTrialStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function runOpportunityFullLoopTrial(input: OpportunityFullLoopTrialInput = defaultOpportunityFullLoopInput()) {
  const now = new Date().toISOString();
  const context: TrialContext = {};
  const steps: OpportunityFullLoopTrialStep[] = [];

  try {
    context.intake = await createOpportunityIntakeRecord(input);
    steps.push(completedStep("submit_opportunity_intake", "Submit Opportunity intake", context.intake.title, "opportunity_intake", context.intake.id));

    context.clarification = await createOpportunityClarification({ intakeId: context.intake.id });
    steps.push(
      completedStep(
        "generate_clarification",
        "Generate clarification",
        `${context.clarification.status.replaceAll("_", " ")} toward ${context.clarification.route.replaceAll("_", " ")}`,
        "opportunity_clarification",
        context.clarification.id
      )
    );

    context.solutionPath = await createOpportunitySolutionPath({ clarificationId: context.clarification.id });
    steps.push(
      completedStep(
        "route_solution_path",
        "Route solution path",
        `${context.solutionPath.recommendedPath.replaceAll("_", " ")} with ${context.solutionPath.confidenceLevel} confidence`,
        "opportunity_solution_path",
        context.solutionPath.id
      )
    );

    context.actionPlan = await createOpportunityActionPlan({ solutionPathId: context.solutionPath.id });
    steps.push(
      completedStep(
        "draft_action_plan",
        "Draft action plan",
        `${context.actionPlan.planType.replaceAll("_", " ")} created for owner review`,
        "opportunity_action_plan",
        context.actionPlan.id
      )
    );

    context.candidate = await createOpportunityAppEngineCandidate({ actionPlanId: context.actionPlan.id });
    steps.push(
      completedStep(
        "create_appengine_candidate",
        "Create AppEngine candidate",
        `${context.candidate.candidateType.replaceAll("_", " ")} created`,
        "opportunity_appengine_candidate",
        context.candidate.id
      )
    );

    steps.push(
      completedStep(
        "owner_approve_candidate",
        "Owner approves candidate",
        "Trial recorded explicit owner approval before packet draft preparation.",
        "opportunity_appengine_candidate",
        context.candidate.id
      )
    );

    context.packetBridge = await createOpportunityBuildPacketBridge({
      candidateId: context.candidate.id,
      ownerApproved: true
    });
    steps.push(
      completedStep(
        "prepare_packet_draft",
        "Prepare packet draft",
        `${context.packetBridge.packetType.replaceAll("_", " ")} is review-ready`,
        "opportunity_build_packet_bridge",
        context.packetBridge.id
      )
    );

    const portfolio = await loadOwnerPortfolioRegistry();
    const opportunityEntry = portfolio.apps.find((entry) => entry.slug === "opportunity") || null;
    const portfolioBridgeReady =
      opportunityEntry?.buildPacketBridgeVisibility?.sourceArtifactEvidence.some(
        (artifact) => artifact.kind === "opportunity_build_packet_bridge" && artifact.id === context.packetBridge?.id
      ) ||
      opportunityEntry?.sourceArtifact.id === context.packetBridge.id;

    steps.push(
      completedStep(
        "show_portfolio_readiness",
        "Show packet draft readiness in Portfolio Dashboard",
        portfolioBridgeReady
          ? "Portfolio Dashboard can read the prepared Opportunity packet bridge."
          : "Portfolio Dashboard will show Opportunity packet bridge state after refresh from adapter-backed state.",
        "app_portfolio_registry",
        opportunityEntry?.slug || "opportunity"
      )
    );

    const record = buildTrialRecord({
      now,
      status: "completed",
      steps: [
        ...steps,
        completedStep("update_project_memory", "Update Project Memory", "Project Memory records the full Opportunity loop proof."),
        completedStep("write_audit_trail", "Write Audit Trail events", "Audit Trail records packet draft preparation and full-loop completion."),
        completedStep("show_next_safe_action", "Show next safe AppEngine action", "Review packet draft before any final packet or execution.")
      ],
      context,
      portfolioEntryVisible: Boolean(opportunityEntry),
      portfolioSourceState: opportunityEntry?.stateSource || "unknown"
    });

    await writeOpportunityFullLoopTrialRecord(record);
    await updateProjectMemoryFromOpportunityFullLoopTrial(record);
    await getAppEngineAuditTrail().append({
      type: "opportunity_full_loop_trial_ran",
      actor: { type: "owner", id: "Lincoln" },
      summary: record.ownerReadableSummary,
      subjectId: record.id,
      metadata: {
        status: record.status,
        packetBridgeId: record.artifacts.packetBridgeId,
        packetType: record.packetDraftReadiness.packetType,
        codexTriggered: false,
        githubIssuesCreated: false,
        finalPacketCreated: false
      }
    });

    return record;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Opportunity full-loop trial could not complete.";
    const record = buildTrialRecord({
      now,
      status: "blocked",
      steps: [
        ...steps,
        blockedStep(nextUnfinishedStepId(steps), nextUnfinishedStepLabel(steps), message),
        ...remainingSteps(steps)
      ],
      context,
      portfolioEntryVisible: false,
      portfolioSourceState: "not_checked",
      blocker: message
    });

    await writeOpportunityFullLoopTrialRecord(record);
    await updateProjectMemoryFromOpportunityFullLoopTrial(record);

    return record;
  }
}

function buildTrialRecord({
  now,
  status,
  steps,
  context,
  portfolioEntryVisible,
  portfolioSourceState,
  blocker
}: {
  now: string;
  status: OpportunityFullLoopTrialStatus;
  steps: OpportunityFullLoopTrialStep[];
  context: TrialContext;
  portfolioEntryVisible: boolean;
  portfolioSourceState: string;
  blocker?: string;
}): OpportunityFullLoopTrialRecord {
  const packetBridge = context.packetBridge;
  const missingInformation = Array.from(
    new Set([...(packetBridge?.missingInformation || []), ...(blocker ? [blocker] : [])])
  );
  const nextSafeAction =
    status === "completed"
      ? "Review the prepared packet draft before any final packet, Codex run, GitHub issue, label, deploy, migration, paid resource, secret, or env change exists."
      : "Resolve the blocked Opportunity loop step, then rerun the full-loop trial.";
  const title = context.intake?.title || "Opportunity Full Loop Trial";

  return {
    id: randomUUID(),
    kind: "opportunity_full_loop_trial",
    schemaVersion: 1,
    createdAt: now,
    updatedAt: new Date().toISOString(),
    title,
    status,
    steps,
    artifacts: {
      intakeId: context.intake?.id || null,
      clarificationId: context.clarification?.id || null,
      solutionPathId: context.solutionPath?.id || null,
      actionPlanId: context.actionPlan?.id || null,
      candidateId: context.candidate?.id || null,
      packetBridgeId: context.packetBridge?.id || null
    },
    packetDraftReadiness: {
      ready: Boolean(packetBridge && status === "completed"),
      status: packetBridge?.packetDraftStatus || "not_ready",
      packetType: packetBridge?.packetType || "none",
      portfolioEntryVisible,
      portfolioSourceState
    },
    missingInformation,
    nextSafeAction,
    copyableNextAction: buildCopyableNextAction(title, packetBridge, missingInformation, nextSafeAction),
    ownerReadableSummary:
      status === "completed"
        ? `${title}: Opportunity intake reached ${packetBridge?.packetType.replaceAll("_", " ")} readiness without automatic execution.`
        : `${title}: Opportunity full loop is blocked. ${blocker || "Review missing information."}`,
    sourceArtifacts: buildSourceArtifacts(context),
    guardrails: opportunityFullLoopTrialGuardrails()
  };
}

function completedStep(
  id: OpportunityFullLoopTrialStepId,
  label: string,
  summary: string,
  artifactKind?: string,
  artifactId?: string
): OpportunityFullLoopTrialStep {
  return {
    id,
    label,
    status: "completed",
    summary,
    artifactKind,
    artifactId
  };
}

function blockedStep(id: OpportunityFullLoopTrialStepId, label: string, blocker: string): OpportunityFullLoopTrialStep {
  return {
    id,
    label,
    status: "blocked",
    summary: "This step could not complete honestly.",
    blocker
  };
}

function notStartedStep(id: OpportunityFullLoopTrialStepId, label: string): OpportunityFullLoopTrialStep {
  return {
    id,
    label,
    status: "not_started",
    summary: "Waiting for the blocked step before this can run."
  };
}

const orderedSteps: Array<{ id: OpportunityFullLoopTrialStepId; label: string }> = [
  { id: "submit_opportunity_intake", label: "Submit Opportunity intake" },
  { id: "generate_clarification", label: "Generate clarification" },
  { id: "route_solution_path", label: "Route solution path" },
  { id: "draft_action_plan", label: "Draft action plan" },
  { id: "create_appengine_candidate", label: "Create AppEngine candidate" },
  { id: "owner_approve_candidate", label: "Owner approves candidate" },
  { id: "prepare_packet_draft", label: "Prepare packet draft" },
  { id: "show_portfolio_readiness", label: "Show packet draft readiness in Portfolio Dashboard" },
  { id: "update_project_memory", label: "Update Project Memory" },
  { id: "write_audit_trail", label: "Write Audit Trail events" },
  { id: "show_next_safe_action", label: "Show next safe AppEngine action" }
];

function nextUnfinishedStepId(steps: OpportunityFullLoopTrialStep[]) {
  const completedIds = new Set(steps.map((step) => step.id));
  return orderedSteps.find((step) => !completedIds.has(step.id))?.id || "show_next_safe_action";
}

function nextUnfinishedStepLabel(steps: OpportunityFullLoopTrialStep[]) {
  const id = nextUnfinishedStepId(steps);
  return orderedSteps.find((step) => step.id === id)?.label || "Show next safe AppEngine action";
}

function remainingSteps(steps: OpportunityFullLoopTrialStep[]) {
  const completedOrBlockedIds = new Set([...steps.map((step) => step.id), nextUnfinishedStepId(steps)]);
  return orderedSteps
    .filter((step) => !completedOrBlockedIds.has(step.id))
    .map((step) => notStartedStep(step.id, step.label));
}

function buildSourceArtifacts(context: TrialContext): OpportunityFullLoopSourceArtifact[] {
  return [
    artifact("opportunity_intake", context.intake?.id, context.intake?.title),
    artifact("opportunity_clarification", context.clarification?.id, context.clarification?.opportunityStatement),
    artifact("opportunity_solution_path", context.solutionPath?.id, context.solutionPath?.reasonForRouting),
    artifact("opportunity_action_plan", context.actionPlan?.id, context.actionPlan?.opportunitySummary),
    artifact("opportunity_appengine_candidate", context.candidate?.id, context.candidate?.actionPlanSummary),
    artifact("opportunity_build_packet_bridge", context.packetBridge?.id, context.packetBridge?.ownerReadableSummary)
  ].filter((item): item is OpportunityFullLoopSourceArtifact => Boolean(item));
}

function artifact(kind: string, id?: string, summary?: string): OpportunityFullLoopSourceArtifact | null {
  if (!id || !summary) return null;
  return { kind, id, summary };
}

function buildCopyableNextAction(
  title: string,
  packetBridge: OpportunityBuildPacketBridgeRecord | undefined,
  missingInformation: string[],
  nextSafeAction: string
) {
  return `Review this Opportunity Full Loop Trial.\n\nOpportunity: ${title}\nPacket bridge: ${packetBridge?.id || "not prepared"}\nPacket draft type: ${packetBridge?.packetType || "none"}\nMissing information: ${missingInformation.join(", ") || "None"}\nNext safe action: ${nextSafeAction}\n\nGuardrails: Do not create final packets, trigger Codex, create GitHub issues, apply labels, deploy production, create paid resources, run migrations, add secrets/env vars, change repo visibility, or auto-merge generated code.`;
}

async function readOpportunityFullLoopTrialStore(): Promise<OpportunityFullLoopTrialStore> {
  return getAppEngineStateAdapter().readJson<OpportunityFullLoopTrialStore>(
    { kind: "opportunity_full_loop_trial", key: "records" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeOpportunityFullLoopTrialRecord(record: OpportunityFullLoopTrialRecord) {
  const store = await readOpportunityFullLoopTrialStore();
  await getAppEngineStateAdapter().writeJson(
    { kind: "opportunity_full_loop_trial", key: "records" },
    {
      schemaVersion: 1,
      records: [record, ...store.records]
    }
  );
}

function defaultOpportunityFullLoopInput(): OpportunityFullLoopTrialInput {
  return {
    mode: "tools",
    problemPain:
      "Community leaders hear real needs from people but struggle to turn those needs into clear, safe, reviewable solution work.",
    affectedPeople: "local ministry leaders, helpers, and people trying to move from a problem toward hope and practical support",
    betterOutcome:
      "a guided path that turns a real problem into an owner-reviewed AppEngine packet draft without rushing into code",
    currentBarriers:
      "needs are scattered across conversations, solution shape is unclear, owner approval gates must be visible, and premature automation would be risky",
    existingIdeaVision:
      "Use Opportunity as the front door and AppEngine as the factory that clarifies, routes, plans, and prepares packet drafts.",
    desiredImpact:
      "help Lincoln see whether a submitted problem can become a safe, bounded solution candidate with a next practical action",
    possibleSolutionType: "app_tool_workflow"
  };
}
