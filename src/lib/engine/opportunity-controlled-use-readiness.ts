import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import { loadOwnerPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";
import { durableStateGuardrails } from "@/lib/engine/durable-state-adapter";
import { listOpportunityActionPlans } from "@/lib/engine/opportunity-action-plan";
import { listOpportunityAppEngineCandidates } from "@/lib/engine/opportunity-appengine-candidate";
import { listOpportunityBuildPacketBridges } from "@/lib/engine/opportunity-build-packet-bridge";
import { listOpportunityClarifications } from "@/lib/engine/opportunity-clarification";
import { listOpportunityFullLoopTrials } from "@/lib/engine/opportunity-full-loop-trial";
import { listOpportunityIntakeRecords } from "@/lib/engine/opportunity-intake";
import { listOpportunitySolutionPaths } from "@/lib/engine/opportunity-solution-path";
import { loadProjectMemory } from "@/lib/engine/project-memory";

export type OpportunityControlledUseReadinessStatus =
  | "ready_for_internal_controlled_use"
  | "blocked_for_public_use"
  | "blocked_for_autonomous_execution";

export type OpportunityControlledUseCheckStatus = "confirmed" | "not_run_yet" | "blocked";

export type OpportunityControlledUseCheck = {
  key:
    | "intake"
    | "clarification"
    | "solution_path"
    | "action_plan"
    | "appengine_candidate"
    | "packet_draft_bridge"
    | "portfolio_visibility"
    | "audit_trail"
    | "project_memory";
  label: string;
  status: OpportunityControlledUseCheckStatus;
  summary: string;
  evidenceKind: string;
  evidenceId: string | null;
};

export type OpportunityControlledUseStatusReport = {
  status: OpportunityControlledUseReadinessStatus;
  label: string;
  summary: string;
  blockers: string[];
};

export type OpportunityControlledUseReadiness = {
  kind: "opportunity_controlled_use_readiness";
  schemaVersion: 1;
  generatedAt: string;
  ownerReadableSummary: string;
  statuses: OpportunityControlledUseStatusReport[];
  fullLoopStatus: OpportunityControlledUseCheck[];
  exactBlockers: string[];
  nextOperationalAction: "run_one_real_internal_opportunity_example_through_the_full_loop";
  copyableNextAction: string;
  latestEvidence: {
    latestFullLoopTrialId: string | null;
    latestPacketBridgeId: string | null;
    opportunityPortfolioSource: string;
    auditEventCount: number;
    projectMemoryUpdatedAt: string;
  };
  guardrails: ReturnType<typeof opportunityControlledUseReadinessGuardrails>;
};

const exactPublicAndAutonomyBlockers = [
  "stable public review URLs",
  "durable production persistence",
  "production auth confirmation",
  "customer privacy/data retention",
  "Codex auto-execution still disabled"
];

export function opportunityControlledUseReadinessGuardrails() {
  return {
    ...durableStateGuardrails(),
    reportOnly: true,
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

export async function loadOpportunityControlledUseReadiness(now = new Date()): Promise<OpportunityControlledUseReadiness> {
  const [
    intakes,
    clarifications,
    solutionPaths,
    actionPlans,
    candidates,
    packetBridges,
    fullLoopTrials,
    portfolioRegistry,
    auditEvents,
    projectMemory
  ] = await Promise.all([
    listOpportunityIntakeRecords(),
    listOpportunityClarifications(),
    listOpportunitySolutionPaths(),
    listOpportunityActionPlans(),
    listOpportunityAppEngineCandidates(),
    listOpportunityBuildPacketBridges(),
    listOpportunityFullLoopTrials(),
    loadOwnerPortfolioRegistry(),
    getAppEngineAuditTrail().list(),
    loadProjectMemory()
  ]);

  const latestFullLoopTrial = fullLoopTrials[0] || null;
  const latestPacketBridge = packetBridges[0] || null;
  const opportunityEntry = portfolioRegistry.apps.find((entry) => entry.slug === "opportunity") || null;
  const opportunityAuditEvents = auditEvents.filter(
    (event) =>
      event.type === "opportunity_full_loop_trial_ran" ||
      event.type === "opportunity_packet_draft_prepared" ||
      event.type === "intake_submitted"
  );
  const memoryMentionsOpportunityLoop =
    projectMemory.latestProjectState.currentState.toLowerCase().includes("opportunity") ||
    projectMemory.progressHistory.some((item) => item.tags.some((tag) => tag.includes("opportunity")));

  const fullLoopStatus: OpportunityControlledUseCheck[] = [
    check("intake", "Intake", intakes[0]?.id || null, "opportunity_intake", intakes[0]?.title),
    check(
      "clarification",
      "Clarification",
      clarifications[0]?.id || null,
      "opportunity_clarification",
      clarifications[0]?.opportunityStatement
    ),
    check(
      "solution_path",
      "Solution path",
      solutionPaths[0]?.id || null,
      "opportunity_solution_path",
      solutionPaths[0]?.reasonForRouting
    ),
    check(
      "action_plan",
      "Action plan",
      actionPlans[0]?.id || null,
      "opportunity_action_plan",
      actionPlans[0]?.opportunitySummary
    ),
    check(
      "appengine_candidate",
      "AppEngine candidate",
      candidates[0]?.id || null,
      "opportunity_appengine_candidate",
      candidates[0]?.actionPlanSummary
    ),
    check(
      "packet_draft_bridge",
      "Packet draft bridge",
      latestPacketBridge?.id || null,
      "opportunity_build_packet_bridge",
      latestPacketBridge?.ownerReadableSummary
    ),
    {
      key: "portfolio_visibility",
      label: "Portfolio visibility",
      status: opportunityEntry?.buildPacketBridgeVisibility ? "confirmed" : "not_run_yet",
      summary: opportunityEntry?.buildPacketBridgeVisibility
        ? `Opportunity portfolio shows ${opportunityEntry.buildPacketBridgeVisibility.buildPacketBridgeState}.`
        : "Opportunity portfolio is available, but no packet bridge is visible yet.",
      evidenceKind: "app_portfolio_registry",
      evidenceId: opportunityEntry?.slug || null
    },
    {
      key: "audit_trail",
      label: "Audit trail",
      status: opportunityAuditEvents.length ? "confirmed" : "not_run_yet",
      summary: opportunityAuditEvents.length
        ? `${opportunityAuditEvents.length} Opportunity audit event${opportunityAuditEvents.length === 1 ? "" : "s"} recorded.`
        : "No Opportunity audit events are recorded yet.",
      evidenceKind: "app_engine_audit_event",
      evidenceId: opportunityAuditEvents[opportunityAuditEvents.length - 1]?.id || null
    },
    {
      key: "project_memory",
      label: "Project memory",
      status: memoryMentionsOpportunityLoop ? "confirmed" : "not_run_yet",
      summary: memoryMentionsOpportunityLoop
        ? projectMemory.latestProjectState.currentState
        : "Project Memory is available, but no Opportunity full-loop memory update is recorded yet.",
      evidenceKind: "project_memory",
      evidenceId: "AppEngine"
    }
  ];

  return {
    kind: "opportunity_controlled_use_readiness",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    ownerReadableSummary:
      "Opportunity is ready for internal controlled use with owner review and local/mock persistence. Public/customer use and autonomous execution remain blocked by explicit safety gaps.",
    statuses: [
      {
        status: "ready_for_internal_controlled_use",
        label: "Ready for internal controlled use",
        summary:
          "Owner can run one real internal Opportunity example through intake, clarification, routing, action plan, candidate, packet draft bridge, memory, audit, and portfolio review.",
        blockers: []
      },
      {
        status: "blocked_for_public_use",
        label: "Blocked for public use",
        summary:
          "Opportunity should not serve public/customer traffic until production persistence, auth, privacy, retention, and stable review URL decisions are complete.",
        blockers: exactPublicAndAutonomyBlockers.filter((blocker) => blocker !== "Codex auto-execution still disabled")
      },
      {
        status: "blocked_for_autonomous_execution",
        label: "Blocked for autonomous execution",
        summary:
          "Opportunity can prepare reviewable packet draft work, but Codex execution, GitHub issues, labels, final packets, and deploys remain owner/manual gated.",
        blockers: ["Codex auto-execution still disabled"]
      }
    ],
    fullLoopStatus,
    exactBlockers: exactPublicAndAutonomyBlockers,
    nextOperationalAction: "run_one_real_internal_opportunity_example_through_the_full_loop",
    copyableNextAction: buildCopyableNextAction(fullLoopStatus, latestFullLoopTrial?.id || null),
    latestEvidence: {
      latestFullLoopTrialId: latestFullLoopTrial?.id || null,
      latestPacketBridgeId: latestPacketBridge?.id || null,
      opportunityPortfolioSource: opportunityEntry?.stateSource || "not_visible",
      auditEventCount: opportunityAuditEvents.length,
      projectMemoryUpdatedAt: projectMemory.updatedAt
    },
    guardrails: opportunityControlledUseReadinessGuardrails()
  };
}

function check(
  key: OpportunityControlledUseCheck["key"],
  label: string,
  evidenceId: string | null,
  evidenceKind: string,
  summary?: string
): OpportunityControlledUseCheck {
  return {
    key,
    label,
    status: evidenceId ? "confirmed" : "not_run_yet",
    summary: evidenceId ? summary || `${label} evidence exists.` : `${label} has not been produced yet.`,
    evidenceKind,
    evidenceId
  };
}

function buildCopyableNextAction(fullLoopStatus: OpportunityControlledUseCheck[], latestTrialId: string | null) {
  const missing = fullLoopStatus.filter((item) => item.status !== "confirmed").map((item) => item.label);

  return `Run one real internal Opportunity example through the full loop.\n\nLatest trial: ${latestTrialId || "none yet"}\nMissing/unchecked stages: ${missing.join(", ") || "None"}\nNext action: submit one real internal Opportunity example, run clarification, solution path, action plan, AppEngine candidate, owner-approved packet draft bridge, then review Portfolio, Project Memory, and Audit Trail.\n\nGuardrails: No production deploy, paid resources, live migrations, secrets/env changes, repo visibility changes, Codex auto-execution, GitHub issue creation, label changes, final packet creation, or autonomous execution.`;
}
