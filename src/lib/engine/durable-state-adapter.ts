import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type AppEngineStateKind =
  | "handoff_relay"
  | "project_memory"
  | "orchestrator_runs"
  | "orchestrator_action_queue"
  | "real_project_trials"
  | "trial_result_reviews"
  | "opportunity_intake"
  | "opportunity_clarification"
  | "opportunity_solution_path"
  | "problem_intake"
  | "problem_intake_feedback"
  | "spark_story_submissions"
  | "spark_review_queue"
  | "spark_reminder_queue"
  | "internal_controlled_use_trials"
  | "development_projects";

export type AppEngineStateSensitivity = "public_safe" | "internal" | "private" | "sensitive";

export type AppEngineStateStoreDefinition = {
  kind: AppEngineStateKind;
  owner: string;
  currentStorage: "local_json" | "browser_local_storage" | "memory_fallback";
  durableTarget: "app_engine_database";
  sensitivity: AppEngineStateSensitivity;
  containsUserProvidedContent: boolean;
  productionRequired: boolean;
  notes: string;
};

export type AppEngineStateScope = {
  kind: AppEngineStateKind;
  key?: string;
};

export type AppEngineStateAdapterDescription = {
  adapter: "local_mock" | "database_disabled";
  durable: boolean;
  enabled: boolean;
  root: string;
  supports: {
    readJson: boolean;
    writeJson: boolean;
    appendJson: boolean;
    transactions: boolean;
  };
  guardrails: DurableStateGuardrails;
};

export type DurableStateGuardrails = {
  productionDeployBlocked: true;
  paidResourcesBlocked: true;
  migrationsBlocked: true;
  secretsOrEnvChangesBlocked: true;
  repositoryVisibilityUnchanged: true;
  codexAutoExecutionBlocked: true;
  githubIssueCreationBlocked: true;
  labelChangesBlocked: true;
};

export type AppEngineStateAdapter = {
  describe(): AppEngineStateAdapterDescription;
  readJson<T>(scope: AppEngineStateScope, fallback: T): Promise<T>;
  writeJson<T>(scope: AppEngineStateScope, value: T): Promise<T>;
  appendJson<T>(scope: AppEngineStateScope, value: T): Promise<T[]>;
};

export type DatabaseStateAdapterConfig = {
  connectionStringEnvName: "DATABASE_URL";
  schemaName: "app_engine_state";
  tablePlan: {
    stateRecordsTable: "state_records";
    auditEventsTable: "audit_events";
  };
  enabled: false;
};

export const appEngineStateStores: AppEngineStateStoreDefinition[] = [
  store("handoff_relay", "Handoff Relay", "local_json", "private", true, true, "Prepared prompts and pasted handoffs may include private project context."),
  store("project_memory", "Project Memory", "local_json", "private", true, true, "Project history, decisions, blockers, and next actions."),
  store("orchestrator_runs", "Manual Orchestrator", "local_json", "internal", false, true, "Run artifacts and decision traces."),
  store("orchestrator_action_queue", "Manual Orchestrator", "local_json", "internal", false, true, "Queued next-safe actions and prepared handoff status."),
  store("real_project_trials", "Real Project Trial", "local_json", "private", true, true, "Trial summaries may include app ideas and user/audience descriptions."),
  store("trial_result_reviews", "Trial Result Review", "local_json", "private", true, true, "Owner review notes and improvement candidates."),
  store("opportunity_intake", "Opportunity Intake", "local_json", "sensitive", true, true, "Customer-facing problem, opportunity, and solution-path intake records."),
  store("opportunity_clarification", "Opportunity Clarification", "local_json", "sensitive", true, true, "Clarified opportunity profiles generated from submitted Opportunity Intake records."),
  store("opportunity_solution_path", "Opportunity Solution Path", "local_json", "sensitive", true, true, "Owner-reviewable route decisions generated from clarified opportunities."),
  store("problem_intake", "Problem Intake Lite", "local_json", "sensitive", true, true, "Submitted problems and visions can contain personal stories or private operations context."),
  store("problem_intake_feedback", "Problem Intake Lite", "local_json", "private", true, false, "Owner feedback about intake quality and missing context."),
  store("spark_story_submissions", "Spark of Hope Intake Lite", "local_json", "sensitive", true, true, "Hope stories and intake details require privacy boundaries."),
  store("spark_review_queue", "Spark of Hope Intake Lite", "browser_local_storage", "sensitive", true, true, "Review statuses and moderation notes currently live in browser-local state."),
  store("spark_reminder_queue", "Spark of Hope Intake Lite", "browser_local_storage", "sensitive", true, true, "Reminder preferences stay local/mock and must not send messages automatically."),
  store("internal_controlled_use_trials", "Internal Controlled Use", "local_json", "internal", false, true, "Owner-run first trial state for proving AppEngine can operate internally with adapter-backed stores."),
  store("development_projects", "Engine Development Store", "local_json", "internal", false, false, "Legacy engine project dev store.")
];

export const disabledDatabaseStateAdapterConfig: DatabaseStateAdapterConfig = {
  connectionStringEnvName: "DATABASE_URL",
  schemaName: "app_engine_state",
  tablePlan: {
    stateRecordsTable: "state_records",
    auditEventsTable: "audit_events"
  },
  enabled: false
};

export function createLocalMockStateAdapter(root = defaultLocalStateRoot()): AppEngineStateAdapter {
  return {
    describe() {
      return {
        adapter: "local_mock",
        durable: false,
        enabled: true,
        root,
        supports: {
          readJson: true,
          writeJson: true,
          appendJson: true,
          transactions: false
        },
        guardrails: durableStateGuardrails()
      };
    },
    async readJson<T>(scope: AppEngineStateScope, fallback: T) {
      try {
        const raw = await readFile(resolveLocalStatePath(root, scope), "utf8");
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    async writeJson<T>(scope: AppEngineStateScope, value: T) {
      const filePath = resolveLocalStatePath(root, scope);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      return value;
    },
    async appendJson<T>(scope: AppEngineStateScope, value: T) {
      const current = await this.readJson<T[]>(scope, []);
      const next = [...current, value];
      await this.writeJson(scope, next);
      return next;
    }
  };
}

function defaultLocalStateRoot() {
  if (process.env.APPENGINE_STATE_ROOT) return process.env.APPENGINE_STATE_ROOT;
  if (process.env.VERCEL === "1") return join(tmpdir(), "app-engine", "state");
  return join(process.cwd(), ".app-engine", "state");
}

export function createDisabledDatabaseStateAdapter(config = disabledDatabaseStateAdapterConfig): AppEngineStateAdapter {
  return {
    describe() {
      return {
        adapter: "database_disabled",
        durable: true,
        enabled: false,
        root: `${config.connectionStringEnvName}:${config.schemaName}`,
        supports: {
          readJson: false,
          writeJson: false,
          appendJson: false,
          transactions: true
        },
        guardrails: durableStateGuardrails()
      };
    },
    async readJson() {
      throw new Error("Database state adapter is defined for future work but is disabled until migrations and owner approval exist.");
    },
    async writeJson() {
      throw new Error("Database state adapter is defined for future work but is disabled until migrations and owner approval exist.");
    },
    async appendJson() {
      throw new Error("Database state adapter is defined for future work but is disabled until migrations and owner approval exist.");
    }
  };
}

export function getAppEngineStateAdapter(mode = process.env.APPENGINE_STATE_ADAPTER || "local_mock") {
  if (mode === "local_mock" || mode === "mock" || mode === "local") {
    return createLocalMockStateAdapter();
  }

  if (mode === "database") {
    return createDisabledDatabaseStateAdapter();
  }

  throw new Error(`Unsupported AppEngine state adapter: ${mode}`);
}

export function resolveLocalStatePath(root: string, scope: AppEngineStateScope) {
  return join(root, sanitizePathSegment(scope.kind), `${sanitizePathSegment(scope.key || "default")}.json`);
}

export function durableStateGuardrails(): DurableStateGuardrails {
  return {
    productionDeployBlocked: true,
    paidResourcesBlocked: true,
    migrationsBlocked: true,
    secretsOrEnvChangesBlocked: true,
    repositoryVisibilityUnchanged: true,
    codexAutoExecutionBlocked: true,
    githubIssueCreationBlocked: true,
    labelChangesBlocked: true
  };
}

function store(
  kind: AppEngineStateKind,
  owner: string,
  currentStorage: AppEngineStateStoreDefinition["currentStorage"],
  sensitivity: AppEngineStateSensitivity,
  containsUserProvidedContent: boolean,
  productionRequired: boolean,
  notes: string
): AppEngineStateStoreDefinition {
  return {
    kind,
    owner,
    currentStorage,
    durableTarget: "app_engine_database",
    sensitivity,
    containsUserProvidedContent,
    productionRequired,
    notes
  };
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "default";
}
