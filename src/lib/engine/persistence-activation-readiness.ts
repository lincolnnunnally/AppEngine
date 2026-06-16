import { appEngineStateStores, type AppEngineStateKind } from "./durable-state-adapter";
import { neonPersistenceAdapterDraftConfig, validateNeonPersistenceConnectionStub } from "./neon-persistence-adapter-draft";

export type PersistenceActivationStatus = "blocked_pending_prerequisites" | "ready_for_owner_review";

export type PersistenceStoreActivationMap = {
  kind: AppEngineStateKind;
  owner: string;
  currentStorage: string;
  sensitivity: string;
  containsUserProvidedContent: boolean;
  productionRequired: boolean;
  durableAdapterSupport: "adapter_interface_ready" | "needs_adapter_wrapper" | "browser_storage_needs_server_store";
  durableTarget: "neon_app_engine_state";
  activationRisk: "low" | "medium" | "high";
  nextStep: string;
};

export type PersistenceActivationChecklistItem = {
  id: string;
  label: string;
  status: "complete" | "blocked" | "needs_owner_approval";
  evidence: string;
};

export type PersistenceActivationReadiness = {
  kind: "persistence_activation_readiness";
  schemaVersion: 1;
  generatedAt: string;
  status: PersistenceActivationStatus;
  primaryProvider: "Neon Postgres";
  fallbackProvider: "local_mock file storage";
  activeAdapter: "local_mock";
  targetAdapter: "neon_disabled";
  ownerReadableSummary: string;
  activationChecklist: PersistenceActivationChecklistItem[];
  localMockStores: PersistenceStoreActivationMap[];
  requiredEnvVarNames: string[];
  guardrails: {
    noLiveDatabaseConnection: true;
    noMigrations: true;
    noProductionDeploy: true;
    noPaidResources: true;
    noSecretsOrEnvChanges: true;
    repositoryVisibilityUnchanged: true;
    noCodexAutoExecution: true;
    noGitHubIssueCreation: true;
    noLabelChanges: true;
  };
};

const adapterReadyStores: AppEngineStateKind[] = ["project_memory", "handoff_relay", "orchestrator_action_queue"];

export function createPersistenceActivationReadiness(now = new Date()): PersistenceActivationReadiness {
  const connectionValidation = validateNeonPersistenceConnectionStub({}, now);
  const localMockStores = appEngineStateStores.map(mapStore);
  const activationChecklist = buildActivationChecklist();
  const blocked = activationChecklist.some((item) => item.status === "blocked");

  return {
    kind: "persistence_activation_readiness",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status: blocked ? "blocked_pending_prerequisites" : "ready_for_owner_review",
    primaryProvider: "Neon Postgres",
    fallbackProvider: "local_mock file storage",
    activeAdapter: "local_mock",
    targetAdapter: neonPersistenceAdapterDraftConfig.adapter,
    ownerReadableSummary:
      "Durable persistence activation is not ready to enable. Neon is the recommended provider, but schema design, migrations, env configuration, export/rollback, and owner approval must happen first.",
    activationChecklist,
    localMockStores,
    requiredEnvVarNames: connectionValidation.missingEnvVarNames.length
      ? neonPersistenceAdapterDraftConfig.requiredEnvVarNames
      : neonPersistenceAdapterDraftConfig.requiredEnvVarNames,
    guardrails: {
      noLiveDatabaseConnection: true,
      noMigrations: true,
      noProductionDeploy: true,
      noPaidResources: true,
      noSecretsOrEnvChanges: true,
      repositoryVisibilityUnchanged: true,
      noCodexAutoExecution: true,
      noGitHubIssueCreation: true,
      noLabelChanges: true
    }
  };
}

function mapStore(store: (typeof appEngineStateStores)[number]): PersistenceStoreActivationMap {
  return {
    kind: store.kind,
    owner: store.owner,
    currentStorage: store.currentStorage,
    sensitivity: store.sensitivity,
    containsUserProvidedContent: store.containsUserProvidedContent,
    productionRequired: store.productionRequired,
    durableAdapterSupport: classifyAdapterSupport(store.kind, store.currentStorage),
    durableTarget: "neon_app_engine_state",
    activationRisk: classifyRisk(store.sensitivity, store.containsUserProvidedContent, store.currentStorage),
    nextStep: nextStepForStore(store.kind, store.currentStorage)
  };
}

function buildActivationChecklist(): PersistenceActivationChecklistItem[] {
  return [
    {
      id: "provider_selected",
      label: "Primary provider selected",
      status: "complete",
      evidence: "Storage Provider Selection recommends Neon Postgres with local_mock fallback."
    },
    {
      id: "adapter_interface_exists",
      label: "Durable adapter interface exists",
      status: "complete",
      evidence: "Durable State Adapter and disabled Neon adapter draft exist."
    },
    {
      id: "schema_design_reviewed",
      label: "Schema design reviewed",
      status: "blocked",
      evidence: "No reviewed app_engine_state schema exists yet."
    },
    {
      id: "migration_plan_reviewed",
      label: "Migration and rollback plan reviewed",
      status: "blocked",
      evidence: "No migration SQL, dry run, export plan, or rollback plan has been approved."
    },
    {
      id: "env_config_owner_managed",
      label: "Environment configuration owner-managed",
      status: "needs_owner_approval",
      evidence: "Env var names are known, but values must be owner-managed and never committed."
    },
    {
      id: "sensitive_store_privacy_review",
      label: "Sensitive store privacy review",
      status: "blocked",
      evidence: "Problem intake and Spark story/review stores require explicit privacy review before durable writes."
    },
    {
      id: "activation_flag_blocked",
      label: "Activation flag remains blocked",
      status: "complete",
      evidence: "Local/mock remains default; Neon adapter is disabled and never connects."
    }
  ];
}

function classifyAdapterSupport(kind: AppEngineStateKind, currentStorage: string): PersistenceStoreActivationMap["durableAdapterSupport"] {
  if (adapterReadyStores.includes(kind)) return "adapter_interface_ready";
  if (currentStorage === "browser_local_storage") return "browser_storage_needs_server_store";
  return "needs_adapter_wrapper";
}

function classifyRisk(sensitivity: string, containsUserProvidedContent: boolean, currentStorage: string): PersistenceStoreActivationMap["activationRisk"] {
  if (sensitivity === "sensitive" || currentStorage === "browser_local_storage") return "high";
  if (sensitivity === "private" || containsUserProvidedContent) return "medium";
  return "low";
}

function nextStepForStore(kind: AppEngineStateKind, currentStorage: string) {
  if (adapterReadyStores.includes(kind)) return "Add read/write integration tests behind local_mock before any database mode.";
  if (currentStorage === "browser_local_storage") return "Move this store to a server-owned local/mock adapter seam before durable database work.";
  return `Create adapter wrapper for ${kind} while keeping local_mock default.`;
}
