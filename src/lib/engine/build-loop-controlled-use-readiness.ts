import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import { loadOwnerPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";
import {
  loadBuildLoopCompletionDashboard,
  listBuildExecutionRequests,
  type BuildLoopCompletionStepId
} from "@/lib/engine/build-execution-request";
import { durableStateGuardrails } from "@/lib/engine/durable-state-adapter";
import { loadProjectMemory } from "@/lib/engine/project-memory";

export type BuildLoopControlledUseReadinessStatus =
  | "ready_for_internal_controlled_build_use"
  | "blocked_for_autonomous_build_execution"
  | "blocked_for_public_customer_use";

export type BuildLoopControlledUseCheckStatus = "confirmed" | "missing" | "blocked";

export type BuildLoopControlledUseCheck = {
  key:
    | "source_request"
    | "packet_draft"
    | "build_execution_request"
    | "exported_builder_handoff"
    | "builder_result_intake"
    | "verification_review"
    | "portfolio_update"
    | "project_memory_update"
    | "audit_trail_update";
  label: string;
  status: BuildLoopControlledUseCheckStatus;
  summary: string;
  evidenceKind: string;
  evidenceId: string | null;
};

export type BuildLoopControlledUseStatusReport = {
  status: BuildLoopControlledUseReadinessStatus;
  label: string;
  summary: string;
  blockers: string[];
};

export type BuildLoopControlledUseReadiness = {
  kind: "build_loop_controlled_use_readiness";
  schemaVersion: 1;
  generatedAt: string;
  ownerReadableSummary: string;
  statuses: BuildLoopControlledUseStatusReport[];
  buildLoopChecks: BuildLoopControlledUseCheck[];
  exactBlockers: string[];
  nextOperationalAction: "run_one_real_life_produces_life_build_request_through_completed_build_loop";
  copyableNextAction: string;
  latestEvidence: {
    buildExecutionRequestId: string | null;
    buildLoopDashboardRequestId: string | null;
    latestBuilderResultId: string | null;
    portfolioSource: string;
    projectMemoryUpdatedAt: string;
    auditEventCount: number;
  };
  guardrails: ReturnType<typeof buildLoopControlledUseReadinessGuardrails>;
};

const publicAndAutonomyBlockers = [
  "Codex/GitHub execution still manual",
  "stable public review URLs missing",
  "durable production persistence not activated",
  "production auth/env confirmation needed",
  "privacy/data retention not finalized"
];

export function buildLoopControlledUseReadinessGuardrails() {
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

export async function loadBuildLoopControlledUseReadiness(now = new Date()): Promise<BuildLoopControlledUseReadiness> {
  const [requests, dashboard, portfolioRegistry, projectMemory, auditEvents] = await Promise.all([
    listBuildExecutionRequests(),
    loadBuildLoopCompletionDashboard(now),
    loadOwnerPortfolioRegistry(),
    loadProjectMemory(),
    getAppEngineAuditTrail().list()
  ]);
  const latestRequest = requests[0] || null;
  const latestResult = latestRequest?.latestBuilderResult || null;
  const appEngineEntry = portfolioRegistry.apps.find((entry) => entry.slug === "appengine-core") || portfolioRegistry.apps[0] || null;
  const buildLoopAuditEvents = auditEvents.filter(
    (event) =>
      event.type === "build_execution_request_created" ||
      event.type === "build_execution_request_exported" ||
      event.type === "builder_result_intake_received" ||
      event.type === "build_loop_completion_recorded"
  );
  const memoryMentionsBuildLoop =
    projectMemory.latestProjectState.currentState.toLowerCase().includes("build loop") ||
    projectMemory.progressHistory.some(
      (item) => item.tags.includes("builder-result-intake") || item.tags.includes("build-loop-completion")
    );
  const portfolioHasBuildExecution =
    appEngineEntry?.sourceArtifact.kind === "build_execution_request" ||
    Boolean(appEngineEntry?.evidenceLinks.some((link) => link.label.toLowerCase().includes("build execution")));

  const buildLoopChecks: BuildLoopControlledUseCheck[] = [
    checkFromDashboardStep("source_request", "Source request", dashboard, "source_request"),
    checkFromDashboardStep("packet_draft", "Packet draft", dashboard, "packet_draft"),
    {
      key: "build_execution_request",
      label: "Build execution request",
      status: latestRequest ? "confirmed" : "missing",
      summary: latestRequest
        ? latestRequest.ownerReadableSummary
        : "No build execution request has been created yet.",
      evidenceKind: "build_execution_request",
      evidenceId: latestRequest?.id || null
    },
    checkFromDashboardStep("exported_builder_handoff", "Exported builder handoff", dashboard, "exported_builder_handoff"),
    {
      key: "builder_result_intake",
      label: "Builder result intake",
      status: latestResult ? "confirmed" : "missing",
      summary: latestResult
        ? latestResult.ownerReadableSummary
        : "No builder result has been imported into AppEngine yet.",
      evidenceKind: "builder_result_intake",
      evidenceId: latestResult?.id || null
    },
    {
      key: "verification_review",
      label: "Verification review",
      status: latestResult ? "confirmed" : "missing",
      summary: latestResult
        ? `${latestResult.passFailStatus.replaceAll("_", " ")}: ${latestResult.nextSafeAction}`
        : "Verification review starts after builder result intake.",
      evidenceKind: "builder_result_intake",
      evidenceId: latestResult?.id || null
    },
    {
      key: "portfolio_update",
      label: "Portfolio update",
      status: portfolioHasBuildExecution ? "confirmed" : "missing",
      summary: portfolioHasBuildExecution
        ? `Portfolio shows build execution state from ${appEngineEntry?.sourceArtifact.kind}.`
        : "Portfolio Dashboard does not yet show build execution evidence.",
      evidenceKind: "app_portfolio_registry",
      evidenceId: appEngineEntry?.slug || null
    },
    {
      key: "project_memory_update",
      label: "Project memory update",
      status: memoryMentionsBuildLoop ? "confirmed" : "missing",
      summary: memoryMentionsBuildLoop
        ? projectMemory.latestProjectState.currentState
        : "Project Memory has not recorded build-loop progress yet.",
      evidenceKind: "project_memory",
      evidenceId: "AppEngine"
    },
    {
      key: "audit_trail_update",
      label: "Audit trail update",
      status: buildLoopAuditEvents.length ? "confirmed" : "missing",
      summary: buildLoopAuditEvents.length
        ? `${buildLoopAuditEvents.length} build-loop audit event${buildLoopAuditEvents.length === 1 ? "" : "s"} recorded.`
        : "No build-loop audit event has been recorded yet.",
      evidenceKind: "app_engine_audit_event",
      evidenceId: buildLoopAuditEvents[buildLoopAuditEvents.length - 1]?.id || null
    }
  ];
  const missingInternalChecks = buildLoopChecks.filter((item) => item.status !== "confirmed").map((item) => item.label);

  return {
    kind: "build_loop_controlled_use_readiness",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    ownerReadableSummary:
      "AppEngine can be used internally as an owner-controlled build workflow tool when the build loop evidence is complete. Autonomous execution and public/customer use remain blocked by explicit safety gaps.",
    statuses: [
      {
        status: "ready_for_internal_controlled_build_use",
        label: "Internal controlled build use",
        summary: missingInternalChecks.length
          ? "Build workflow tools are present, but the latest loop still has missing evidence before it can be treated as a completed controlled-use run."
          : "Build workflow evidence is complete enough for internal controlled use with owner review.",
        blockers: missingInternalChecks
      },
      {
        status: "blocked_for_autonomous_build_execution",
        label: "Autonomous build execution blocked",
        summary:
          "AppEngine can prepare and review build work, but Codex/GitHub execution remains manual and owner-approved.",
        blockers: ["Codex/GitHub execution still manual"]
      },
      {
        status: "blocked_for_public_customer_use",
        label: "Public/customer use blocked",
        summary:
          "The build workflow should not serve public/customer traffic until URLs, durable persistence, production auth/env, and privacy/data retention are finalized.",
        blockers: publicAndAutonomyBlockers.filter((blocker) => blocker !== "Codex/GitHub execution still manual")
      }
    ],
    buildLoopChecks,
    exactBlockers: publicAndAutonomyBlockers,
    nextOperationalAction: "run_one_real_life_produces_life_build_request_through_completed_build_loop",
    copyableNextAction: buildCopyableNextAction(buildLoopChecks, latestRequest?.id || null),
    latestEvidence: {
      buildExecutionRequestId: latestRequest?.id || null,
      buildLoopDashboardRequestId: dashboard.requestId,
      latestBuilderResultId: latestResult?.id || null,
      portfolioSource: appEngineEntry?.stateSource || "not_visible",
      projectMemoryUpdatedAt: projectMemory.updatedAt,
      auditEventCount: buildLoopAuditEvents.length
    },
    guardrails: buildLoopControlledUseReadinessGuardrails()
  };
}

function checkFromDashboardStep(
  key: BuildLoopControlledUseCheck["key"],
  label: string,
  dashboard: Awaited<ReturnType<typeof loadBuildLoopCompletionDashboard>>,
  stepId: BuildLoopCompletionStepId
): BuildLoopControlledUseCheck {
  const step = dashboard.steps.find((candidate) => candidate.id === stepId) || null;
  const confirmed = step?.status === "completed";

  return {
    key,
    label,
    status: confirmed ? "confirmed" : step?.status === "blocked" ? "blocked" : "missing",
    summary: step?.summary || `${label} has not been produced yet.`,
    evidenceKind: "build_loop_completion_dashboard",
    evidenceId: dashboard.requestId
  };
}

function buildCopyableNextAction(buildLoopChecks: BuildLoopControlledUseCheck[], latestRequestId: string | null) {
  const missing = buildLoopChecks.filter((item) => item.status !== "confirmed").map((item) => item.label);

  return `Run one real Life Produces Life build request through the completed AppEngine build loop.\n\nLatest build execution request: ${latestRequestId || "none yet"}\nMissing/unchecked stages: ${missing.join(", ") || "None"}\nNext action: run one real Life Produces Life build request from source request through packet draft, build execution request, exported builder handoff, builder result intake, verification review, portfolio update, Project Memory, and Audit Trail.\n\nGuardrails: No production deploy, paid resources, live migrations, secrets/env changes, repo visibility changes, Codex auto-execution, GitHub issue creation, label changes, or auto-merge.`;
}
