import { getAppEngineAuditTrail } from "./audit-trail-lite";
import { getAppEngineStateAdapter } from "./durable-state-adapter";
import { listHandoffRelaySummaries } from "./handoff-relay";
import { listOrchestratorActionQueue, listOrchestratorRuns } from "./orchestrator-run";
import { sparkReviewQueueGuardrails, sparkReviewStatuses } from "@/lib/spark-of-hope-intake-lite/review-queue";

export type RuntimeMonitoringLiteStatus = "healthy" | "needs_attention" | "blocked";

export type RuntimeMonitoringLiteComponent = {
  id: "persistence_adapter" | "orchestrator" | "handoff_relay" | "audit_trail" | "spark_review_flow";
  label: string;
  status: RuntimeMonitoringLiteStatus;
  storage: "local_mock" | "local_mock_jsonl" | "browser_local_storage" | "database_disabled";
  summary: string;
  evidence: string[];
  nextSafeAction: string;
};

export type RuntimeMonitoringLiteReport = {
  kind: "runtime_monitoring_lite";
  schemaVersion: 1;
  generatedAt: string;
  status: RuntimeMonitoringLiteStatus;
  ownerReadableSummary: string;
  components: RuntimeMonitoringLiteComponent[];
  guardrails: {
    localMockOnly: true;
    noExternalMonitoringService: true;
    noProductionDeploy: true;
    noPaidResources: true;
    noMigrations: true;
    noSecretsOrEnvChanges: true;
    repositoryVisibilityUnchanged: true;
    noCodexAutoExecution: true;
    noGitHubIssueCreation: true;
    noLabelChanges: true;
  };
};

export async function createRuntimeMonitoringLiteReport(now = new Date()): Promise<RuntimeMonitoringLiteReport> {
  const components = await Promise.all([
    inspectPersistenceAdapter(),
    inspectOrchestrator(),
    inspectHandoffRelay(),
    inspectAuditTrail(),
    inspectSparkReviewFlow()
  ]);
  const status = summarizeStatus(components);

  return {
    kind: "runtime_monitoring_lite",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status,
    ownerReadableSummary: buildOwnerSummary(status, components),
    components,
    guardrails: runtimeMonitoringLiteGuardrails()
  };
}

export function runtimeMonitoringLiteGuardrails(): RuntimeMonitoringLiteReport["guardrails"] {
  return {
    localMockOnly: true,
    noExternalMonitoringService: true,
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

async function inspectPersistenceAdapter(): Promise<RuntimeMonitoringLiteComponent> {
  try {
    const description = getAppEngineStateAdapter().describe();

    return {
      id: "persistence_adapter",
      label: "Persistence adapter",
      status: description.enabled ? "healthy" : "needs_attention",
      storage: description.adapter === "local_mock" ? "local_mock" : "database_disabled",
      summary: description.enabled
        ? "Local/mock persistence adapter is available. Durable database mode remains disabled."
        : "Persistence adapter is defined but disabled.",
      evidence: [
        `adapter=${description.adapter}`,
        `durable=${description.durable}`,
        `readJson=${description.supports.readJson}`,
        `writeJson=${description.supports.writeJson}`,
        `appendJson=${description.supports.appendJson}`
      ],
      nextSafeAction: "Keep local/mock as default until owner-approved durable schema and migration work exists."
    };
  } catch (caught) {
    return blockedComponent("persistence_adapter", "Persistence adapter", "local_mock", caught);
  }
}

async function inspectOrchestrator(): Promise<RuntimeMonitoringLiteComponent> {
  try {
    const [runs, queue] = await Promise.all([listOrchestratorRuns(), listOrchestratorActionQueue()]);

    return {
      id: "orchestrator",
      label: "Manual orchestrator",
      status: "healthy",
      storage: "local_mock",
      summary: `Orchestrator local/mock store is readable with ${runs.length} run(s) and ${queue.length} queued action(s).`,
      evidence: [`runs=${runs.length}`, `queuedActions=${queue.length}`, "manual owner review remains required"],
      nextSafeAction: "Continue using owner-reviewed manual orchestrator runs; do not auto-trigger Codex."
    };
  } catch (caught) {
    return blockedComponent("orchestrator", "Manual orchestrator", "local_mock", caught);
  }
}

async function inspectHandoffRelay(): Promise<RuntimeMonitoringLiteComponent> {
  try {
    const handoffs = await listHandoffRelaySummaries();

    return {
      id: "handoff_relay",
      label: "Handoff relay",
      status: "healthy",
      storage: "local_mock",
      summary: `Handoff Relay local/mock store is readable with ${handoffs.length} handoff(s).`,
      evidence: [`handoffs=${handoffs.length}`, "prepared prompts remain copy-only"],
      nextSafeAction: "Keep prepared handoffs owner-approved and copy-only until explicit automation approval exists."
    };
  } catch (caught) {
    return blockedComponent("handoff_relay", "Handoff relay", "local_mock", caught);
  }
}

async function inspectAuditTrail(): Promise<RuntimeMonitoringLiteComponent> {
  try {
    const trail = getAppEngineAuditTrail();
    const events = await trail.list();

    return {
      id: "audit_trail",
      label: "Audit trail",
      status: "healthy",
      storage: "local_mock_jsonl",
      summary: `Audit Trail Lite is readable with ${events.length} append-only event(s).`,
      evidence: [`events=${events.length}`, `appendOnly=${trail.describe().appendOnly}`, "external logging disabled"],
      nextSafeAction: "Keep local/mock audit trail visible to owner while durable audit storage is planned."
    };
  } catch (caught) {
    return blockedComponent("audit_trail", "Audit trail", "local_mock_jsonl", caught);
  }
}

async function inspectSparkReviewFlow(): Promise<RuntimeMonitoringLiteComponent> {
  return {
    id: "spark_review_flow",
    label: "Spark review flow",
    status: "needs_attention",
    storage: "browser_local_storage",
    summary: "Spark review flow exists with local/browser mock storage; durable owner review storage is still future work.",
    evidence: [
      `statuses=${sparkReviewStatuses.join(",")}`,
      `guardrails=${sparkReviewQueueGuardrails.length}`,
      "approved_for_preview is the only public preview status"
    ],
    nextSafeAction: "Move Spark review state behind the durable adapter after schema and migration approval."
  };
}

function blockedComponent(
  id: RuntimeMonitoringLiteComponent["id"],
  label: string,
  storage: RuntimeMonitoringLiteComponent["storage"],
  caught: unknown
): RuntimeMonitoringLiteComponent {
  return {
    id,
    label,
    status: "blocked",
    storage,
    summary: `${label} health check failed honestly.`,
    evidence: [caught instanceof Error ? caught.message : "Unknown monitoring error"],
    nextSafeAction: "Create a focused fix before treating runtime health as ready."
  };
}

function summarizeStatus(components: RuntimeMonitoringLiteComponent[]): RuntimeMonitoringLiteStatus {
  if (components.some((component) => component.status === "blocked")) return "blocked";
  if (components.some((component) => component.status === "needs_attention")) return "needs_attention";
  return "healthy";
}

function buildOwnerSummary(status: RuntimeMonitoringLiteStatus, components: RuntimeMonitoringLiteComponent[]) {
  const blocked = components.filter((component) => component.status === "blocked").length;
  const needsAttention = components.filter((component) => component.status === "needs_attention").length;

  if (status === "blocked") {
    return `${blocked} runtime component${blocked === 1 ? "" : "s"} are blocked. Fix those before claiming AppEngine runtime health.`;
  }

  if (status === "needs_attention") {
    return `${needsAttention} runtime component${needsAttention === 1 ? "" : "s"} need attention, but local/mock monitoring can read core AppEngine state.`;
  }

  return "Runtime Monitoring Lite can read all tracked local/mock AppEngine components.";
}
