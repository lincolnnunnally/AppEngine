import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type AppEngineAuditEventType =
  | "intake_submitted"
  | "handoff_prepared"
  | "build_execution_request_created"
  | "build_execution_request_reviewed"
  | "build_execution_request_exported"
  | "builder_result_intake_received"
  | "build_loop_completion_recorded"
  | "orchestrator_action_queued"
  | "orchestrator_action_exported"
  | "opportunity_packet_draft_prepared"
  | "opportunity_full_loop_trial_ran"
  | "real_opportunity_example_ran"
  | "real_opportunity_result_reviewed"
  | "ecosystem_build_start_prepared"
  | "first_real_build_loop_run_prepared"
  | "first_real_build_result_intake_received"
  | "spark_item_reviewed"
  | "readiness_snapshot_generated";

export type AppEngineAuditActor = {
  type: "owner" | "system" | "agent" | "anonymous_user";
  id: string;
};

export type AppEngineAuditEventInput = {
  type: AppEngineAuditEventType;
  actor: AppEngineAuditActor;
  summary: string;
  subjectId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

export type AppEngineAuditEvent = {
  kind: "app_engine_audit_event";
  schemaVersion: 1;
  id: string;
  type: AppEngineAuditEventType;
  actor: AppEngineAuditActor;
  summary: string;
  subjectId: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
  storage: "local_mock_jsonl";
  guardrails: AuditTrailGuardrails;
};

export type AuditTrailGuardrails = {
  appendOnly: true;
  noExternalLoggingService: true;
  noProductionDeploy: true;
  noPaidResources: true;
  noMigrations: true;
  noSecretsOrEnvChanges: true;
  repositoryVisibilityUnchanged: true;
  noCodexAutoExecution: true;
  noGitHubIssueCreation: true;
  noLabelChanges: true;
};

export type AppEngineAuditTrail = {
  append(input: AppEngineAuditEventInput, now?: Date): Promise<AppEngineAuditEvent>;
  list(): Promise<AppEngineAuditEvent[]>;
  describe(): {
    storage: "local_mock_jsonl";
    appendOnly: true;
    eventTypes: AppEngineAuditEventType[];
    guardrails: AuditTrailGuardrails;
  };
};

export const supportedAuditEventTypes: AppEngineAuditEventType[] = [
  "intake_submitted",
  "handoff_prepared",
  "build_execution_request_created",
  "build_execution_request_reviewed",
  "build_execution_request_exported",
  "builder_result_intake_received",
  "build_loop_completion_recorded",
  "orchestrator_action_queued",
  "orchestrator_action_exported",
  "opportunity_packet_draft_prepared",
  "opportunity_full_loop_trial_ran",
  "real_opportunity_example_ran",
  "real_opportunity_result_reviewed",
  "ecosystem_build_start_prepared",
  "first_real_build_loop_run_prepared",
  "first_real_build_result_intake_received",
  "spark_item_reviewed",
  "readiness_snapshot_generated"
];

export function createAuditEvent(input: AppEngineAuditEventInput, now = new Date()): AppEngineAuditEvent {
  if (!supportedAuditEventTypes.includes(input.type)) {
    throw new Error(`Unsupported audit event type: ${input.type}`);
  }

  const summary = input.summary.trim();
  if (!summary) {
    throw new Error("Audit event summary is required.");
  }

  return {
    kind: "app_engine_audit_event",
    schemaVersion: 1,
    id: `audit_${now.getTime().toString(36)}_${hashText(`${input.type}:${summary}`).slice(0, 8)}`,
    type: input.type,
    actor: {
      type: input.actor.type,
      id: input.actor.id.trim().slice(0, 120) || "unknown"
    },
    summary: summary.slice(0, 500),
    subjectId: input.subjectId?.trim().slice(0, 160) || null,
    metadata: sanitizeMetadata(input.metadata || {}),
    createdAt: now.toISOString(),
    storage: "local_mock_jsonl",
    guardrails: auditTrailGuardrails()
  };
}

export function createLocalMockAuditTrail(filePath = join(process.cwd(), ".app-engine", "audit-trail", "events.jsonl")): AppEngineAuditTrail {
  return {
    async append(input, now = new Date()) {
      const event = createAuditEvent(input, now);
      await mkdir(dirname(filePath), { recursive: true });
      await appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
      return event;
    },
    async list() {
      try {
        const raw = await readFile(filePath, "utf8");
        return raw
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line) as AppEngineAuditEvent);
      } catch {
        return [];
      }
    },
    describe() {
      return {
        storage: "local_mock_jsonl",
        appendOnly: true,
        eventTypes: supportedAuditEventTypes,
        guardrails: auditTrailGuardrails()
      };
    }
  };
}

export function getAppEngineAuditTrail() {
  return createLocalMockAuditTrail();
}

export function auditTrailGuardrails(): AuditTrailGuardrails {
  return {
    appendOnly: true,
    noExternalLoggingService: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noCodexAutoExecution: true,
    noGitHubIssueCreation: true,
    noLabelChanges: true
  };
}

function sanitizeMetadata(metadata: Record<string, string | number | boolean | null | undefined>) {
  const safe: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = key.trim().slice(0, 80);
    if (!normalizedKey) continue;

    if (/secret|token|password|credential|api[_-]?key|auth/i.test(normalizedKey)) {
      safe[normalizedKey] = "[redacted]";
      continue;
    }

    if (typeof value === "string") safe[normalizedKey] = value.slice(0, 500);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) safe[normalizedKey] = value;
  }

  return safe;
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
