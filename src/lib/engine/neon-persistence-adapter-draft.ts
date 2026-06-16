import { type AppEngineStateAdapter, type AppEngineStateScope, durableStateGuardrails } from "./durable-state-adapter";

export type NeonPersistenceAdapterDraftConfig = {
  provider: "neon";
  adapter: "neon_disabled";
  enabled: false;
  connectionStringEnvName: "DATABASE_URL";
  schemaEnvName: "APPENGINE_STATE_DATABASE_SCHEMA";
  migrationsEnabledEnvName: "APPENGINE_STATE_MIGRATIONS_ENABLED";
  requiredEnvVarNames: Array<"DATABASE_URL" | "APPENGINE_STATE_ADAPTER" | "APPENGINE_STATE_DATABASE_SCHEMA" | "APPENGINE_STATE_MIGRATIONS_ENABLED">;
  schemaAreas: Array<"project_memory" | "handoffs" | "orchestrator_queue" | "audit_trail" | "spark_submissions_reviews">;
};

export type NeonPersistenceConnectionValidation = {
  kind: "neon_persistence_connection_validation";
  provider: "neon";
  checkedAt: string;
  attemptedConnection: false;
  canAttemptConnection: false;
  missingEnvVarNames: string[];
  migrationState: "blocked";
  result: "disabled_until_owner_approved_schema_and_migration";
  guardrails: ReturnType<typeof durableStateGuardrails>;
};

export const neonPersistenceAdapterDraftConfig: NeonPersistenceAdapterDraftConfig = {
  provider: "neon",
  adapter: "neon_disabled",
  enabled: false,
  connectionStringEnvName: "DATABASE_URL",
  schemaEnvName: "APPENGINE_STATE_DATABASE_SCHEMA",
  migrationsEnabledEnvName: "APPENGINE_STATE_MIGRATIONS_ENABLED",
  requiredEnvVarNames: ["DATABASE_URL", "APPENGINE_STATE_ADAPTER", "APPENGINE_STATE_DATABASE_SCHEMA", "APPENGINE_STATE_MIGRATIONS_ENABLED"],
  schemaAreas: ["project_memory", "handoffs", "orchestrator_queue", "audit_trail", "spark_submissions_reviews"]
};

export function createDisabledNeonPersistenceAdapter(config = neonPersistenceAdapterDraftConfig): AppEngineStateAdapter {
  return {
    describe() {
      return {
        adapter: "database_disabled",
        durable: true,
        enabled: config.enabled,
        root: `${config.connectionStringEnvName}:${config.schemaEnvName}:neon_disabled`,
        supports: {
          readJson: false,
          writeJson: false,
          appendJson: false,
          transactions: true
        },
        guardrails: durableStateGuardrails()
      };
    },
    async readJson<T>(_scope: AppEngineStateScope, _fallback: T): Promise<T> {
      throw disabledNeonError();
    },
    async writeJson<T>(_scope: AppEngineStateScope, _value: T): Promise<T> {
      throw disabledNeonError();
    },
    async appendJson<T>(_scope: AppEngineStateScope, _value: T): Promise<T[]> {
      throw disabledNeonError();
    }
  };
}

export function validateNeonPersistenceConnectionStub(
  env: Record<string, string | undefined> = process.env,
  now = new Date()
): NeonPersistenceConnectionValidation {
  const missingEnvVarNames = neonPersistenceAdapterDraftConfig.requiredEnvVarNames.filter((name) => !env[name]);

  return {
    kind: "neon_persistence_connection_validation",
    provider: "neon",
    checkedAt: now.toISOString(),
    attemptedConnection: false,
    canAttemptConnection: false,
    missingEnvVarNames,
    migrationState: "blocked",
    result: "disabled_until_owner_approved_schema_and_migration",
    guardrails: durableStateGuardrails()
  };
}

function disabledNeonError() {
  return new Error(
    "Neon persistence adapter is a disabled draft. It cannot read, write, connect, or migrate until owner-approved schema and migration work exists."
  );
}
