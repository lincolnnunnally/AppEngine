import type { AppEngineStateAdapter, AppEngineStateKind } from "./durable-state-adapter";
import { getAppEngineStateAdapter } from "./durable-state-adapter";

export type AdapterReadyStoreKind = "project_memory" | "handoff_relay" | "orchestrator_action_queue";

export type AdapterReadyStoreDefinition = {
  kind: AdapterReadyStoreKind;
  currentOwnerFile: string;
  stateAdapterKind: AppEngineStateKind;
  firstIntegrationStep: string;
  activeAdapter: "local_mock";
  databaseEnabled: false;
  migrationRequiredBeforeDatabase: true;
};

export type AdapterReadyStore<T> = {
  definition: AdapterReadyStoreDefinition;
  read(fallback: T): Promise<T>;
  write(value: T): Promise<T>;
  append<Item>(value: Item): Promise<Item[]>;
};

export const adapterReadyStoreDefinitions: AdapterReadyStoreDefinition[] = [
  {
    kind: "project_memory",
    currentOwnerFile: "src/lib/engine/project-memory.ts",
    stateAdapterKind: "project_memory",
    firstIntegrationStep: "Wrap Project Memory reads/writes behind the adapter while preserving existing local/mock behavior.",
    activeAdapter: "local_mock",
    databaseEnabled: false,
    migrationRequiredBeforeDatabase: true
  },
  {
    kind: "handoff_relay",
    currentOwnerFile: "src/lib/engine/handoff-relay.ts",
    stateAdapterKind: "handoff_relay",
    firstIntegrationStep: "Wrap Handoff Relay list/save/update paths behind the adapter while preserving existing local/mock behavior.",
    activeAdapter: "local_mock",
    databaseEnabled: false,
    migrationRequiredBeforeDatabase: true
  },
  {
    kind: "orchestrator_action_queue",
    currentOwnerFile: "src/lib/engine/orchestrator-run.ts",
    stateAdapterKind: "orchestrator_action_queue",
    firstIntegrationStep: "Extract action queue state operations behind the adapter before durable queue storage is enabled.",
    activeAdapter: "local_mock",
    databaseEnabled: false,
    migrationRequiredBeforeDatabase: true
  }
];

export function createAdapterReadyStore<T>(
  kind: AdapterReadyStoreKind,
  adapter: AppEngineStateAdapter = getAppEngineStateAdapter()
): AdapterReadyStore<T> {
  const definition = findAdapterReadyStoreDefinition(kind);

  return {
    definition,
    read(fallback) {
      return adapter.readJson<T>({ kind: definition.stateAdapterKind }, fallback);
    },
    write(value) {
      return adapter.writeJson<T>({ kind: definition.stateAdapterKind }, value);
    },
    append<Item>(value: Item) {
      return adapter.appendJson<Item>({ kind: definition.stateAdapterKind }, value);
    }
  };
}

export function findAdapterReadyStoreDefinition(kind: AdapterReadyStoreKind) {
  const definition = adapterReadyStoreDefinitions.find((entry) => entry.kind === kind);
  if (!definition) throw new Error(`Unsupported adapter-ready store: ${kind}`);
  return definition;
}

export function persistenceAdapterReadinessSummary() {
  return {
    kind: "persistence_adapter_readiness",
    schemaVersion: 1,
    activeAdapter: "local_mock" as const,
    databaseEnabled: false as const,
    migrationsApplied: false as const,
    firstStores: adapterReadyStoreDefinitions.map((definition) => ({
      kind: definition.kind,
      currentOwnerFile: definition.currentOwnerFile,
      stateAdapterKind: definition.stateAdapterKind,
      firstIntegrationStep: definition.firstIntegrationStep,
      databaseEnabled: definition.databaseEnabled
    })),
    guardrails: {
      noProductionDeploy: true,
      noPaidResources: true,
      noMigrations: true,
      noSecretsOrEnvChanges: true,
      repositoryVisibilityUnchanged: true,
      noCodexAutoExecution: true,
      noGitHubIssueCreation: true,
      noLabelChanges: true
    }
  };
}
