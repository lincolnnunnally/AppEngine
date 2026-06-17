import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import { loadOwnerPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";
import { durableStateGuardrails } from "@/lib/engine/durable-state-adapter";
import { listHandoffRelaySummaries } from "@/lib/engine/handoff-relay";
import { loadProjectMemory } from "@/lib/engine/project-memory";
import { listRealOpportunityExamples } from "@/lib/engine/real-opportunity-example-runner";
import { listRealOpportunityResultReviews } from "@/lib/engine/real-opportunity-result-review";

export type OpportunityInternalUseCompletionStatus =
  | "usable_for_internal_controlled_use"
  | "blocked_for_public_customer_use"
  | "blocked_for_autonomous_execution";

export type OpportunityInternalUseCompletionCheckStatus = "confirmed" | "missing";

export type OpportunityInternalUseCompletionPathCheck = {
  key:
    | "real_opportunity_example"
    | "result_review"
    | "ready_for_next_appengine_action"
    | "prepared_handoff_in_handoff_inbox"
    | "portfolio_updated"
    | "project_memory_updated"
    | "audit_trail_updated";
  label: string;
  status: OpportunityInternalUseCompletionCheckStatus;
  summary: string;
  evidenceKind: string;
  evidenceId: string | null;
};

export type OpportunityInternalUseCompletionStatusReport = {
  status: OpportunityInternalUseCompletionStatus;
  label: string;
  evidenceState: "confirmed" | "blocked";
  summary: string;
  blockers: string[];
};

export type OpportunityInternalUseCompletionCheck = {
  kind: "opportunity_internal_use_completion_check";
  schemaVersion: 1;
  generatedAt: string;
  ownerReadableSummary: string;
  statuses: OpportunityInternalUseCompletionStatusReport[];
  fullPathChecks: OpportunityInternalUseCompletionPathCheck[];
  exactRemainingBlockers: string[];
  nextOperationalInstruction: "Run one real ecosystem build request through Opportunity, then use prepared handoff to begin AppEngine build work.";
  latestEvidence: {
    realOpportunityExampleId: string | null;
    realOpportunityResultReviewId: string | null;
    preparedHandoffId: string | null;
    opportunityPortfolioSource: string;
    projectMemoryLastHandoffId: string | null;
    auditEventCount: number;
  };
  guardrails: ReturnType<typeof opportunityInternalUseCompletionGuardrails>;
};

const exactRemainingBlockers = [
  "stable review URLs/public deployment",
  "durable production persistence",
  "production auth/env confirmation",
  "privacy/data retention",
  "Codex auto-execution permissions"
];

export function opportunityInternalUseCompletionGuardrails() {
  return {
    ...durableStateGuardrails(),
    completionCheckOnly: true,
    ownerVisibleReportOnly: true,
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

export async function loadOpportunityInternalUseCompletionCheck(
  now = new Date()
): Promise<OpportunityInternalUseCompletionCheck> {
  const [examples, reviews, handoffs, portfolioRegistry, projectMemory, auditEvents] = await Promise.all([
    listRealOpportunityExamples(),
    listRealOpportunityResultReviews(),
    listHandoffRelaySummaries(),
    loadOwnerPortfolioRegistry(),
    loadProjectMemory(),
    getAppEngineAuditTrail().list()
  ]);

  const latestExample = examples[0] || null;
  const latestReview = reviews[0] || null;
  const readyReview = reviews.find((review) => review.reviewStatus === "ready_for_next_appengine_action") || null;
  const preparedHandoff =
    handoffs.find(
      (handoff) =>
        handoff.source === "opportunity_prepared_handoff" &&
        (!readyReview || handoff.id.includes(readyReview.id))
    ) || handoffs.find((handoff) => handoff.source === "opportunity_prepared_handoff") || null;
  const opportunityEntry = portfolioRegistry.apps.find((entry) => entry.slug === "opportunity") || null;
  const opportunityAuditEvents = auditEvents.filter(
    (event) =>
      event.type === "real_opportunity_example_ran" ||
      event.type === "real_opportunity_result_reviewed" ||
      event.type === "handoff_prepared"
  );
  const projectMemoryHasPreparedHandoff =
    Boolean(preparedHandoff && projectMemory.latestProjectState.lastHandoffId === preparedHandoff.id) ||
    projectMemory.latestProjectState.currentState.toLowerCase().includes("opportunity") ||
    projectMemory.progressHistory.some((item) => item.tags.some((tag) => tag.includes("handoff") || tag.includes("opportunity")));
  const portfolioShowsPreparedHandoff =
    opportunityEntry?.sourceArtifact.kind === "handoff_relay_summary" ||
    opportunityEntry?.status.toLowerCase().includes("handoff") ||
    opportunityEntry?.nextSafeAction === "await_owner_review";

  const fullPathChecks: OpportunityInternalUseCompletionPathCheck[] = [
    check({
      key: "real_opportunity_example",
      label: "Real Opportunity example",
      evidenceId: latestExample?.id || null,
      evidenceKind: "real_opportunity_example_runner",
      summary: latestExample?.ownerReadableSummary
    }),
    check({
      key: "result_review",
      label: "Result review",
      evidenceId: latestReview?.id || null,
      evidenceKind: "real_opportunity_result_review",
      summary: latestReview?.ownerReadableSummary
    }),
    check({
      key: "ready_for_next_appengine_action",
      label: "Ready for next AppEngine action",
      evidenceId: readyReview?.id || null,
      evidenceKind: "real_opportunity_result_review",
      summary: readyReview
        ? "The real Opportunity result review is marked ready_for_next_appengine_action."
        : "No real Opportunity result review is marked ready_for_next_appengine_action yet."
    }),
    check({
      key: "prepared_handoff_in_handoff_inbox",
      label: "Prepared handoff in Handoff Inbox",
      evidenceId: preparedHandoff?.id || null,
      evidenceKind: "handoff_relay_summary",
      summary: preparedHandoff?.ownerReadableSummary
    }),
    check({
      key: "portfolio_updated",
      label: "Portfolio updated",
      evidenceId: portfolioShowsPreparedHandoff ? opportunityEntry?.slug || null : null,
      evidenceKind: "app_portfolio_registry",
      summary: portfolioShowsPreparedHandoff
        ? opportunityEntry?.status || "Opportunity portfolio entry reflects the prepared handoff."
        : "Opportunity portfolio does not yet show prepared handoff state."
    }),
    check({
      key: "project_memory_updated",
      label: "Project Memory updated",
      evidenceId: projectMemoryHasPreparedHandoff ? projectMemory.latestProjectState.lastHandoffId || "project_memory" : null,
      evidenceKind: "project_memory",
      summary: projectMemoryHasPreparedHandoff
        ? projectMemory.latestProjectState.currentState
        : "Project Memory does not yet show the prepared Opportunity handoff path."
    }),
    check({
      key: "audit_trail_updated",
      label: "Audit Trail updated",
      evidenceId: opportunityAuditEvents[opportunityAuditEvents.length - 1]?.id || null,
      evidenceKind: "app_engine_audit_event",
      summary: opportunityAuditEvents.length
        ? `${opportunityAuditEvents.length} Opportunity completion-path audit event${
            opportunityAuditEvents.length === 1 ? "" : "s"
          } recorded.`
        : "No Opportunity completion-path audit events are recorded yet."
    })
  ];
  const missingChecks = fullPathChecks.filter((item) => item.status === "missing");
  const internalUseComplete = missingChecks.length === 0;

  return {
    kind: "opportunity_internal_use_completion_check",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    ownerReadableSummary: internalUseComplete
      ? "Opportunity is usable for internal controlled use: a real example can reach a ready review, prepared handoff, portfolio update, project memory update, and audit trail evidence."
      : "Opportunity is close, but internal controlled use is not complete until the full real-example-to-prepared-handoff evidence chain is present.",
    statuses: [
      {
        status: "usable_for_internal_controlled_use",
        label: "Usable for internal controlled use",
        evidenceState: internalUseComplete ? "confirmed" : "blocked",
        summary: internalUseComplete
          ? "The real Opportunity controlled-use path has end-to-end evidence inside AppEngine."
          : `Missing internal evidence: ${missingChecks.map((item) => item.label).join(", ")}.`,
        blockers: internalUseComplete ? [] : missingChecks.map((item) => item.label)
      },
      {
        status: "blocked_for_public_customer_use",
        label: "Blocked for public/customer use",
        evidenceState: "blocked",
        summary:
          "Opportunity should remain internal until public deployment, production persistence, auth/env, privacy, and retention decisions are completed.",
        blockers: exactRemainingBlockers.filter((blocker) => blocker !== "Codex auto-execution permissions")
      },
      {
        status: "blocked_for_autonomous_execution",
        label: "Blocked for autonomous execution",
        evidenceState: "blocked",
        summary: "Prepared handoffs remain owner-reviewed and copyable; Codex execution permissions are still intentionally manual.",
        blockers: ["Codex auto-execution permissions"]
      }
    ],
    fullPathChecks,
    exactRemainingBlockers,
    nextOperationalInstruction:
      "Run one real ecosystem build request through Opportunity, then use prepared handoff to begin AppEngine build work.",
    latestEvidence: {
      realOpportunityExampleId: latestExample?.id || null,
      realOpportunityResultReviewId: readyReview?.id || latestReview?.id || null,
      preparedHandoffId: preparedHandoff?.id || null,
      opportunityPortfolioSource: opportunityEntry?.stateSource || "not_visible",
      projectMemoryLastHandoffId: projectMemory.latestProjectState.lastHandoffId,
      auditEventCount: opportunityAuditEvents.length
    },
    guardrails: opportunityInternalUseCompletionGuardrails()
  };
}

function check({
  key,
  label,
  evidenceId,
  evidenceKind,
  summary
}: {
  key: OpportunityInternalUseCompletionPathCheck["key"];
  label: string;
  evidenceId: string | null;
  evidenceKind: string;
  summary?: string;
}): OpportunityInternalUseCompletionPathCheck {
  return {
    key,
    label,
    status: evidenceId ? "confirmed" : "missing",
    summary: evidenceId ? summary || `${label} evidence exists.` : summary || `${label} has not been completed yet.`,
    evidenceKind,
    evidenceId
  };
}
