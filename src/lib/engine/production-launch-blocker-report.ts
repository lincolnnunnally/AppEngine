import { loadAuditTrailOwnerVisibilityReport } from "./audit-trail-owner-visibility";
import { appEngineStateStores } from "./durable-state-adapter";
import { neonPersistenceAdapterDraftConfig, validateNeonPersistenceConnectionStub } from "./neon-persistence-adapter-draft";
import { createProductionAuthReadinessReport } from "./production-auth-readiness";
import { createRuntimeMonitoringLiteReport } from "./runtime-monitoring-lite";

export type ProductionLaunchBlockerSeverity = "critical_blocker" | "launch_blocker" | "post_launch_improvement";
export type ProductionLaunchBlockerEffort = "small" | "medium" | "large";

export type ProductionLaunchBlocker = {
  id: string;
  label: string;
  severity: ProductionLaunchBlockerSeverity;
  category:
    | "security"
    | "auth_admin_protection"
    | "persistence_database"
    | "monitoring_logging"
    | "deployment_readiness"
    | "orchestrator_autonomy"
    | "user_experience"
    | "operational_risk";
  summary: string;
  evidence: string[];
  estimatedEffort: ProductionLaunchBlockerEffort;
  recommendedNextAction: string;
};

export type ProductionLaunchBlockerReport = {
  kind: "production_launch_blocker_report";
  schemaVersion: 1;
  generatedAt: string;
  status: "not_ready_for_real_users";
  ownerReadableSummary: string;
  sourceInputs: {
    productionReadinessSnapshot: string;
    authReadiness: {
      kind: "production_auth_readiness";
      status: string;
      missingEnvAssumptions: string[];
    };
    runtimeMonitoring: {
      kind: "runtime_monitoring_lite";
      status: string;
      componentsNeedingAttention: string[];
    };
    auditTrail: {
      kind: "audit_trail_owner_visibility";
      storage: "local_mock_jsonl";
      visibleEventCount: number;
    };
    persistence: {
      providerRecommendation: "neon";
      activeProvider: "local_mock";
      neonAdapterEnabled: false;
      productionRequiredStoreCount: number;
      sensitiveStoreCount: number;
    };
  };
  criticalBlockers: ProductionLaunchBlocker[];
  launchBlockers: ProductionLaunchBlocker[];
  postLaunchImprovements: ProductionLaunchBlocker[];
  launchSequence: string[];
  nextSafeAction: string;
  guardrails: {
    noProductionDeploy: true;
    noPaidResources: true;
    noMigrations: true;
    noSecretsOrEnvChanges: true;
    repositoryVisibilityUnchanged: true;
    noCodexAutoExecution: true;
    noGitHubIssueCreation: true;
    noLabelChanges: true;
    noGeneratedAppAutoMerge: true;
  };
};

export async function createProductionLaunchBlockerReport(now = new Date()): Promise<ProductionLaunchBlockerReport> {
  const [authReadiness, runtimeMonitoring, auditTrail] = await Promise.all([
    Promise.resolve(createProductionAuthReadinessReport({ NODE_ENV: "production" }, now)),
    createRuntimeMonitoringLiteReport(now),
    loadAuditTrailOwnerVisibilityReport(12, now)
  ]);
  const neonValidation = validateNeonPersistenceConnectionStub({}, now);
  const productionRequiredStores = appEngineStateStores.filter((store) => store.productionRequired);
  const sensitiveStores = appEngineStateStores.filter((store) => store.sensitivity === "sensitive");

  const blockers = buildBlockers({
    authStatus: authReadiness.status,
    authMissingEnv: authReadiness.missingEnvAssumptions,
    runtimeStatus: runtimeMonitoring.status,
    runtimeNeedsAttention: runtimeMonitoring.components
      .filter((component) => component.status !== "healthy")
      .map((component) => component.label),
    auditEventCount: auditTrail.events.length,
    productionRequiredStoreCount: productionRequiredStores.length,
    sensitiveStoreCount: sensitiveStores.length,
    neonMissingEnv: neonValidation.missingEnvVarNames
  });

  const criticalBlockers = blockers.filter((blocker) => blocker.severity === "critical_blocker");
  const launchBlockers = blockers.filter((blocker) => blocker.severity === "launch_blocker");
  const postLaunchImprovements = blockers.filter((blocker) => blocker.severity === "post_launch_improvement");

  return {
    kind: "production_launch_blocker_report",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status: "not_ready_for_real_users",
    ownerReadableSummary: buildOwnerSummary(criticalBlockers, launchBlockers),
    sourceInputs: {
      productionReadinessSnapshot: "source-of-truth/production-readiness-snapshot.md",
      authReadiness: {
        kind: authReadiness.kind,
        status: authReadiness.status,
        missingEnvAssumptions: authReadiness.missingEnvAssumptions
      },
      runtimeMonitoring: {
        kind: runtimeMonitoring.kind,
        status: runtimeMonitoring.status,
        componentsNeedingAttention: runtimeMonitoring.components.filter((component) => component.status !== "healthy").map((component) => component.id)
      },
      auditTrail: {
        kind: auditTrail.kind,
        storage: auditTrail.storage,
        visibleEventCount: auditTrail.events.length
      },
      persistence: {
        providerRecommendation: neonPersistenceAdapterDraftConfig.provider,
        activeProvider: "local_mock",
        neonAdapterEnabled: neonPersistenceAdapterDraftConfig.enabled,
        productionRequiredStoreCount: productionRequiredStores.length,
        sensitiveStoreCount: sensitiveStores.length
      }
    },
    criticalBlockers,
    launchBlockers,
    postLaunchImprovements,
    launchSequence: [
      "Activate durable persistence planning: finalize schema, privacy review, migration plan, rollback plan, and owner approval.",
      "Configure production auth assumptions and confirm owner/admin sign-in without development bypasses.",
      "Move critical local/mock stores behind durable storage while keeping migrations review-gated.",
      "Add durable monitoring/audit visibility for owner review before serving real users.",
      "Run a limited owner-approved preview trial before any production release.",
      "Use release gate approval before promoting production."
    ],
    nextSafeAction: "Finish durable persistence activation readiness, then prepare an owner-approved database schema and migration plan without applying migrations.",
    guardrails: {
      noProductionDeploy: true,
      noPaidResources: true,
      noMigrations: true,
      noSecretsOrEnvChanges: true,
      repositoryVisibilityUnchanged: true,
      noCodexAutoExecution: true,
      noGitHubIssueCreation: true,
      noLabelChanges: true,
      noGeneratedAppAutoMerge: true
    }
  };
}

function buildBlockers(input: {
  authStatus: string;
  authMissingEnv: string[];
  runtimeStatus: string;
  runtimeNeedsAttention: string[];
  auditEventCount: number;
  productionRequiredStoreCount: number;
  sensitiveStoreCount: number;
  neonMissingEnv: string[];
}): ProductionLaunchBlocker[] {
  return [
    {
      id: "durable_persistence_not_active",
      label: "Durable persistence is not active",
      severity: "critical_blocker",
      category: "persistence_database",
      summary: "AppEngine still relies on local/mock and browser-local storage for production-required state. Real users require durable storage before launch.",
      evidence: [
        `productionRequiredStores=${input.productionRequiredStoreCount}`,
        `sensitiveStores=${input.sensitiveStoreCount}`,
        "activeProvider=local_mock",
        "neonAdapterEnabled=false",
        `neonMissingEnv=${input.neonMissingEnv.join(",") || "none recorded by stub"}`
      ],
      estimatedEffort: "large",
      recommendedNextAction: "Complete durable persistence activation readiness, schema planning, privacy review, and migration approval before production use."
    },
    {
      id: "production_auth_not_owner_confirmed",
      label: "Production auth is not owner-confirmed",
      severity: input.authStatus === "blocked_in_production" ? "critical_blocker" : "launch_blocker",
      category: "auth_admin_protection",
      summary: "Owner/admin access must be configured and confirmed before real users or production admin surfaces are exposed.",
      evidence: [`authStatus=${input.authStatus}`, `missingEnvAssumptions=${input.authMissingEnv.join(",") || "none"}`, "dev/setup bypasses must stay off in production"],
      estimatedEffort: "medium",
      recommendedNextAction: "Confirm AUTH_SECRET, owner identity, OAuth provider choice, and no production bypass before launch."
    },
    {
      id: "production_release_not_approved",
      label: "Production release remains blocked",
      severity: "critical_blocker",
      category: "deployment_readiness",
      summary: "AppEngine can prepare reviewable work, but production promotion must remain blocked until release gate evidence and owner approval exist.",
      evidence: ["releaseGate=approval_required", "noProductionDeploy=true", "generatedAppAutoMerge=false"],
      estimatedEffort: "medium",
      recommendedNextAction: "Keep using preview/review URLs until release gate criteria and owner approval are recorded."
    },
    {
      id: "monitoring_is_local_lite",
      label: "Monitoring is local/mock only",
      severity: "launch_blocker",
      category: "monitoring_logging",
      summary: "Runtime Monitoring Lite can read local/mock state, but real-user operation needs durable health and incident visibility.",
      evidence: [`runtimeStatus=${input.runtimeStatus}`, `runtimeNeedsAttention=${input.runtimeNeedsAttention.join(",") || "none"}`],
      estimatedEffort: "medium",
      recommendedNextAction: "Add durable runtime and incident reporting after persistence activation planning."
    },
    {
      id: "audit_trail_not_durable",
      label: "Audit trail is owner-visible but not durable",
      severity: "launch_blocker",
      category: "operational_risk",
      summary: "Audit Trail Lite filters owner-visible events, but the trail still uses local/mock JSONL storage.",
      evidence: [`visibleAuditEvents=${input.auditEventCount}`, "storage=local_mock_jsonl", "sensitive fields filtered before owner display"],
      estimatedEffort: "medium",
      recommendedNextAction: "Move audit events into durable append-only storage after schema and migration approval."
    },
    {
      id: "spark_trial_still_preview_only",
      label: "Spark remains limited-preview only",
      severity: "launch_blocker",
      category: "user_experience",
      summary: "Spark of Hope has useful preview slices, but real-user trial requires durable review state, privacy confirmation, and safety copy review.",
      evidence: ["approved preview only", "no public publishing by default", "no real notification sending"],
      estimatedEffort: "medium",
      recommendedNextAction: "Run limited public-trial readiness after durable storage and owner safety review."
    },
    {
      id: "orchestrator_still_manual",
      label: "Orchestrator execution is still owner-mediated",
      severity: "post_launch_improvement",
      category: "orchestrator_autonomy",
      summary: "The action queue and handoff export reduce relay work, but AppEngine still does not safely execute the next step without owner action.",
      evidence: ["noCodexAutoExecution=true", "noGitHubIssueCreation=true", "noLabelChanges=true"],
      estimatedEffort: "large",
      recommendedNextAction: "After production safety is stronger, automate the lowest-risk handoff point first with explicit owner approval."
    },
    {
      id: "readiness_reporting_needs_owner_cadence",
      label: "Owner readiness reporting needs a regular cadence",
      severity: "post_launch_improvement",
      category: "operational_risk",
      summary: "Readiness reports exist, but production operation should produce recurring owner-readable status snapshots.",
      evidence: ["production_readiness_snapshot exists", "owner_status_report exists", "runtime_monitoring_lite exists"],
      estimatedEffort: "small",
      recommendedNextAction: "Create a scheduled owner status/reporting cadence after durable state exists."
    }
  ];
}

function buildOwnerSummary(criticalBlockers: ProductionLaunchBlocker[], launchBlockers: ProductionLaunchBlocker[]) {
  return [
    "AppEngine should not serve real users yet.",
    `${criticalBlockers.length} critical blocker${criticalBlockers.length === 1 ? "" : "s"} and ${launchBlockers.length} launch blocker${
      launchBlockers.length === 1 ? "" : "s"
    } remain.`,
    "The highest-risk blocker is durable persistence: production-required and sensitive state still depends on local/mock storage.",
    "The next safe action is persistence activation readiness, not production deployment."
  ].join(" ");
}
