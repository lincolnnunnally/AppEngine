import { appEngineStateStores, durableStateGuardrails, type AppEngineStateKind } from "./durable-state-adapter";

export type DurableSchemaTableName =
  | "app_engine_state.state_records"
  | "app_engine_state.audit_events"
  | "app_engine_state.spark_story_submissions"
  | "app_engine_state.spark_review_items";

export type DurableSchemaStoreMapping = {
  stateKind: AppEngineStateKind;
  table: DurableSchemaTableName;
  reason: string;
};

export type DurableSchemaMigrationDryRun = {
  kind: "durable_schema_migration_dry_run";
  schemaVersion: 1;
  generatedAt: string;
  status: "dry_run_passed_no_database_touched" | "dry_run_failed";
  attemptedConnection: false;
  appliedMigration: false;
  productionWrites: false;
  provider: "Neon Postgres";
  schemaName: "app_engine_state";
  tables: DurableSchemaTableName[];
  storeMappings: DurableSchemaStoreMapping[];
  checks: Array<{
    id: string;
    status: "passed" | "failed";
    evidence: string;
  }>;
  rollbackNotes: string[];
  ownerReadableSummary: string;
  guardrails: ReturnType<typeof durableStateGuardrails> & {
    noLiveDatabaseConnection: true;
    dryRunOnly: true;
  };
};

export const durableStateSchemaSql = `
CREATE SCHEMA IF NOT EXISTS app_engine_state;

CREATE TABLE IF NOT EXISTS app_engine_state.state_records (
  id text PRIMARY KEY,
  state_kind text NOT NULL,
  state_key text NOT NULL DEFAULT 'default',
  owner text NOT NULL,
  sensitivity text NOT NULL,
  production_required boolean NOT NULL DEFAULT false,
  contains_user_provided_content boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_kind, state_key)
);

CREATE TABLE IF NOT EXISTS app_engine_state.audit_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  subject_id text,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_engine_state.spark_story_submissions (
  id text PRIMARY KEY,
  safe_identifier text NOT NULL,
  category text,
  hope_outcome text,
  consent_status text NOT NULL DEFAULT 'preview_only',
  contact_preference text,
  private_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_engine_state.spark_review_items (
  id text PRIMARY KEY,
  submission_id text NOT NULL REFERENCES app_engine_state.spark_story_submissions(id) ON DELETE CASCADE,
  review_status text NOT NULL,
  moderation_note text,
  follow_up_note text,
  recommended_next_step text,
  owner_visible_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS state_records_kind_idx ON app_engine_state.state_records (state_kind);
CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON app_engine_state.audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS spark_submissions_status_idx ON app_engine_state.spark_story_submissions (status);
CREATE INDEX IF NOT EXISTS spark_review_items_status_idx ON app_engine_state.spark_review_items (review_status);
`.trim();

const genericStateKinds: AppEngineStateKind[] = [
  "handoff_relay",
  "project_memory",
  "orchestrator_runs",
  "orchestrator_action_queue",
  "real_project_trials",
  "trial_result_reviews",
  "problem_intake_gate",
  "problem_intake",
  "problem_intake_feedback",
  "spark_reminder_queue",
  "development_projects"
];

const explicitTableMappings: DurableSchemaStoreMapping[] = [
  ...genericStateKinds.map((stateKind) => ({
    stateKind,
    table: "app_engine_state.state_records" as const,
    reason: "General AppEngine state can be stored as typed JSON records behind the durable adapter."
  })),
  {
    stateKind: "spark_story_submissions",
    table: "app_engine_state.spark_story_submissions",
    reason: "Spark story submissions carry sensitive payloads and need an explicit private table before real trials."
  },
  {
    stateKind: "spark_review_queue",
    table: "app_engine_state.spark_review_items",
    reason: "Spark review queue needs review-status fields and moderation/follow-up notes outside browser local storage."
  }
];

export function createDurableSchemaMigrationDryRun(now = new Date(), sql = durableStateSchemaSql): DurableSchemaMigrationDryRun {
  const tables: DurableSchemaTableName[] = [
    "app_engine_state.state_records",
    "app_engine_state.audit_events",
    "app_engine_state.spark_story_submissions",
    "app_engine_state.spark_review_items"
  ];
  const checks = [
    check("schema_declared", /CREATE SCHEMA IF NOT EXISTS app_engine_state/i.test(sql), "Schema app_engine_state is declared."),
    ...tables.map((table) => check(`table_${table.split(".")[1]}`, includesCreateTable(sql, table), `Table ${table} is declared.`)),
    check("jsonb_payloads", /payload jsonb NOT NULL/i.test(sql), "State tables store structured JSON payloads."),
    check("audit_append_ready", /app_engine_state\.audit_events/i.test(sql), "Audit events have a dedicated table."),
    check("spark_submission_review_ready", /spark_story_submissions/i.test(sql) && /spark_review_items/i.test(sql), "Spark submission and review tables are declared."),
    check("no_destructive_sql", !/\b(DROP|TRUNCATE|DELETE)\b/i.test(sql), "Dry-run SQL contains no DROP, TRUNCATE, or DELETE statements."),
    check(
      "all_state_kinds_mapped",
      appEngineStateStores.every((store) => explicitTableMappings.some((mapping) => mapping.stateKind === store.kind)),
      "Every AppEngine state store is mapped to a durable table."
    )
  ];
  const failed = checks.some((item) => item.status === "failed");

  return {
    kind: "durable_schema_migration_dry_run",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status: failed ? "dry_run_failed" : "dry_run_passed_no_database_touched",
    attemptedConnection: false,
    appliedMigration: false,
    productionWrites: false,
    provider: "Neon Postgres",
    schemaName: "app_engine_state",
    tables,
    storeMappings: explicitTableMappings,
    checks,
    rollbackNotes: [
      "Do not apply this schema until owner approval exists.",
      "Before live activation, export local/mock state to durable backup artifacts.",
      "If live activation fails later, keep APPENGINE_STATE_ADAPTER on local_mock and do not switch production traffic.",
      "A future live migration PR must include reversible SQL and verification queries before owner approval."
    ],
    ownerReadableSummary:
      "Durable schema dry-run passed only as a static review artifact. No database connection was opened, no migration was applied, and local/mock remains the default.",
    guardrails: {
      ...durableStateGuardrails(),
      noLiveDatabaseConnection: true,
      dryRunOnly: true
    }
  };
}

function check(id: string, passed: boolean, evidence: string): DurableSchemaMigrationDryRun["checks"][number] {
  return {
    id,
    status: passed ? "passed" : "failed",
    evidence
  };
}

function includesCreateTable(sql: string, table: DurableSchemaTableName) {
  const escaped = table.replace(".", "\\.");
  return new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${escaped}`, "i").test(sql);
}
