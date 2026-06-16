import { createOrchestratorAutonomyRoadmap } from "./orchestrator-autonomy-roadmap";
import { createPersistenceActivationReadiness } from "./persistence-activation-readiness";
import { createProductionLaunchBlockerReport, type ProductionLaunchBlocker } from "./production-launch-blocker-report";

export type FinalClosureRequirement = {
  id: string;
  title: string;
  source: "persistence_activation_readiness" | "orchestrator_autonomy_roadmap" | "production_launch_blocker_report";
  whyItMatters: string;
  requiredBefore: "controlled_production_use" | "real_customer_user_use" | "post_launch";
  estimatedEffort: "small" | "medium" | "large";
};

export type RecommendedClosurePr = {
  order: number;
  title: string;
  goal: string;
  requiredBefore: "controlled_production_use" | "real_customer_user_use";
  expectedOutcome: string;
  guardrails: string[];
};

export type FinalProductionClosurePlan = {
  kind: "final_production_closure_plan";
  schemaVersion: 1;
  generatedAt: string;
  status: "planning_only";
  ownerReadableSummary: string;
  productionReadyEnoughForFirstControlledUse: string[];
  autonomousEnoughForFirstControlledUse: string[];
  remainingBlockersInOrder: FinalClosureRequirement[];
  requiredBeforeControlledProductionUse: FinalClosureRequirement[];
  requiredBeforeRealCustomerUserUse: FinalClosureRequirement[];
  postLaunchImprovements: FinalClosureRequirement[];
  estimatedImplementationSequence: string[];
  risksOfStoppingTooEarly: string[];
  risksOfOverbuildingTooLong: string[];
  recommendedNextThreePrs: RecommendedClosurePr[];
  sourceArtifacts: {
    persistenceActivationReadiness: string;
    orchestratorAutonomyRoadmap: string;
    productionLaunchBlockerReport: string;
  };
  guardrails: {
    planningOnly: true;
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

export async function createFinalProductionClosurePlan(now = new Date()): Promise<FinalProductionClosurePlan> {
  const [persistence, autonomy, launchBlockers] = await Promise.all([
    Promise.resolve(createPersistenceActivationReadiness(now)),
    Promise.resolve(createOrchestratorAutonomyRoadmap(now)),
    createProductionLaunchBlockerReport(now)
  ]);

  const requirements = [
    requirementFromBlocker(launchBlockers.criticalBlockers.find((blocker) => blocker.id === "durable_persistence_not_active"), {
      id: "durable_persistence_activation",
      title: "Activate durable persistence safely",
      source: "persistence_activation_readiness",
      whyItMatters:
        "Production-required and sensitive state must survive laptop/browser/session loss before AppEngine can be trusted for controlled real use.",
      requiredBefore: "controlled_production_use",
      estimatedEffort: "large"
    }),
    {
      id: "schema_and_migration_dry_run",
      title: "Create reviewed schema and migration dry-run",
      source: "persistence_activation_readiness",
      whyItMatters: "The Neon adapter is intentionally disabled until schema, export, rollback, and owner approval exist.",
      requiredBefore: "controlled_production_use",
      estimatedEffort: "large"
    },
    requirementFromBlocker(launchBlockers.criticalBlockers.find((blocker) => blocker.id === "production_auth_not_owner_confirmed"), {
      id: "production_auth_owner_confirmation",
      title: "Confirm production owner/admin auth",
      source: "production_launch_blocker_report",
      whyItMatters: "Owner/admin access must work without development bypasses before production surfaces are reachable.",
      requiredBefore: "controlled_production_use",
      estimatedEffort: "medium"
    }),
    requirementFromBlocker(launchBlockers.criticalBlockers.find((blocker) => blocker.id === "production_release_not_approved"), {
      id: "controlled_release_gate",
      title: "Add controlled-use release gate evidence",
      source: "production_launch_blocker_report",
      whyItMatters: "A production URL should not change until owner approval, route verification, auth readiness, and rollback notes are visible.",
      requiredBefore: "controlled_production_use",
      estimatedEffort: "medium"
    }),
    requirementFromBlocker(launchBlockers.launchBlockers.find((blocker) => blocker.id === "monitoring_is_local_lite"), {
      id: "durable_monitoring_status",
      title: "Make monitoring durable enough for owner review",
      source: "production_launch_blocker_report",
      whyItMatters: "Controlled production use needs owner-visible health and incident status that does not disappear with local/mock state.",
      requiredBefore: "real_customer_user_use",
      estimatedEffort: "medium"
    }),
    requirementFromBlocker(launchBlockers.launchBlockers.find((blocker) => blocker.id === "audit_trail_not_durable"), {
      id: "durable_audit_trail",
      title: "Move audit trail toward durable append-only storage",
      source: "production_launch_blocker_report",
      whyItMatters: "Real user workflows need durable accountability for important actions and state changes.",
      requiredBefore: "real_customer_user_use",
      estimatedEffort: "medium"
    }),
    requirementFromBlocker(launchBlockers.launchBlockers.find((blocker) => blocker.id === "spark_trial_still_preview_only"), {
      id: "spark_limited_trial_readiness",
      title: "Prepare Spark for limited real-user trial",
      source: "production_launch_blocker_report",
      whyItMatters: "Spark can prove the factory with real usefulness only after privacy, safety, review state, and public-trial boundaries are confirmed.",
      requiredBefore: "real_customer_user_use",
      estimatedEffort: "medium"
    }),
    {
      id: "structured_result_ingestion",
      title: "Ingest execution results into Project Memory",
      source: "orchestrator_autonomy_roadmap",
      whyItMatters:
        "Lincoln stays the memory system until PR/workflow results can update memory and owner status without manual translation.",
      requiredBefore: "real_customer_user_use",
      estimatedEffort: "medium"
    },
    {
      id: "owner_approved_dispatch_dry_run",
      title: "Add owner-approved execution dispatch dry-run",
      source: "orchestrator_autonomy_roadmap",
      whyItMatters:
        "Autonomy should advance by replacing copy/paste with prepared dispatch payloads before anything is allowed to execute automatically.",
      requiredBefore: "post_launch",
      estimatedEffort: "large"
    },
    {
      id: "recurring_readiness_cadence",
      title: "Add recurring readiness and owner-status cadence",
      source: "production_launch_blocker_report",
      whyItMatters: "After launch, AppEngine should keep telling Lincoln what changed, what is blocked, and what needs approval.",
      requiredBefore: "post_launch",
      estimatedEffort: "small"
    }
  ] satisfies FinalClosureRequirement[];

  return {
    kind: "final_production_closure_plan",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status: "planning_only",
    ownerReadableSummary:
      "Finish AppEngine by closing the smallest production safety loop first: durable persistence, production auth confirmation, controlled release evidence, then durable monitoring/audit and Spark limited trial readiness. Do not keep adding foundation layers until these are closed.",
    productionReadyEnoughForFirstControlledUse: [
      "AppEngine can run on a production URL behind owner/admin auth without development bypasses.",
      "Production-required AppEngine state uses owner-approved durable storage or is explicitly excluded from controlled use.",
      "Migrations have been reviewed, dry-run verified, and remain gated before application.",
      "Owner Control Center shows state, blockers, next safe action, release status, and rollback notes.",
      "Production deployment is still owner-approved and reversible."
    ],
    autonomousEnoughForFirstControlledUse: [
      "Intake, memory, orchestrator, action queue, handoff, result summary, and memory update are visible in Owner Control Center.",
      "AppEngine can recommend and prepare the next safe action without Lincoln interpreting every artifact.",
      "Any execution remains owner-approved; no Codex auto-execution, issue creation, label mutation, or auto-merge is required for first controlled use.",
      "Results can be captured back into Project Memory with a clear owner status report."
    ],
    remainingBlockersInOrder: requirements,
    requiredBeforeControlledProductionUse: requirements.filter((requirement) => requirement.requiredBefore === "controlled_production_use"),
    requiredBeforeRealCustomerUserUse: requirements.filter((requirement) => requirement.requiredBefore === "real_customer_user_use"),
    postLaunchImprovements: requirements.filter((requirement) => requirement.requiredBefore === "post_launch"),
    estimatedImplementationSequence: [
      "Durable State Schema and Migration Dry Run",
      "Production Auth Owner Confirmation",
      "Controlled Production Release Gate",
      "Durable Monitoring and Audit Trail",
      "Spark Limited Trial Readiness",
      "Structured Result Ingestion",
      "Owner-Approved Dispatch Dry Run"
    ],
    risksOfStoppingTooEarly: [
      "Local/mock state loss could erase handoffs, memory, audit events, Spark reviews, or queued actions.",
      "Production admin surfaces could be reachable without fully confirmed owner auth.",
      "A preview-ready app could be mistaken for a production-ready system.",
      "Lincoln would remain the hidden memory and handoff layer."
    ],
    risksOfOverbuildingTooLong: [
      "AppEngine could keep adding governance without proving controlled real use.",
      "Spark of Hope could stall in preview instead of becoming the first useful trial.",
      "Autonomy work could drift into unsafe execution before persistence and auth are ready.",
      "The system could optimize for perfect architecture instead of reducing Lincoln's actual relay burden."
    ],
    recommendedNextThreePrs: recommendedNextThreePrs(persistence.status, autonomy.rankedAutomationValue[0]?.id),
    sourceArtifacts: {
      persistenceActivationReadiness: persistence.kind,
      orchestratorAutonomyRoadmap: autonomy.kind,
      productionLaunchBlockerReport: launchBlockers.kind
    },
    guardrails: {
      planningOnly: true,
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

function requirementFromBlocker(
  blocker: ProductionLaunchBlocker | undefined,
  fallback: FinalClosureRequirement
): FinalClosureRequirement {
  if (!blocker) return fallback;

  return {
    ...fallback,
    title: blocker.label,
    whyItMatters: blocker.summary,
    estimatedEffort: blocker.estimatedEffort
  };
}

function recommendedNextThreePrs(_persistenceStatus: string, _topAutonomyPoint: string | undefined): RecommendedClosurePr[] {
  return [
    {
      order: 1,
      title: "Durable State Schema and Migration Dry Run",
      goal: "Define the app_engine_state schema, export plan, rollback plan, and migration dry run without applying migrations.",
      requiredBefore: "controlled_production_use",
      expectedOutcome: "AppEngine has a reviewed durable-state plan that can be owner-approved before any live database activation.",
      guardrails: ["No live migration", "No paid resource creation", "No secrets committed", "Local/mock remains default"]
    },
    {
      order: 2,
      title: "Production Auth Owner Confirmation",
      goal: "Verify production owner/admin auth assumptions, required env names, protected surfaces, and bypass-off behavior.",
      requiredBefore: "controlled_production_use",
      expectedOutcome: "Owner/admin access is ready for controlled production use without development bypasses.",
      guardrails: ["No env values committed", "No provider secrets added", "No production deploy", "No public admin bypass"]
    },
    {
      order: 3,
      title: "Controlled Production Release Gate",
      goal: "Create the owner-facing controlled-use release checklist tying durable state, auth, monitoring, rollback, and review URL evidence together.",
      requiredBefore: "controlled_production_use",
      expectedOutcome: "Lincoln can decide whether AppEngine is ready for first controlled production use from one release gate artifact.",
      guardrails: ["No automatic production promotion", "No auto-merge", "No Codex auto-execution", "No label changes"]
    }
  ];
}
