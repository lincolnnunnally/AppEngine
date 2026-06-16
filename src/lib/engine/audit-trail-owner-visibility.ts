import { getAppEngineAuditTrail, type AppEngineAuditEvent, type AuditTrailGuardrails } from "./audit-trail-lite";

export type OwnerVisibleAuditEvent = {
  id: string;
  eventTime: string;
  eventType: AppEngineAuditEvent["type"];
  source: AppEngineAuditEvent["actor"]["type"];
  sourceId: string;
  subjectId: string | null;
  summary: string;
  safeStatus: "safe_for_owner_review";
  privateFieldsFiltered: boolean;
  metadataPreview: Array<{
    key: string;
    value: string;
  }>;
};

export type AuditTrailOwnerVisibilityReport = {
  kind: "audit_trail_owner_visibility";
  schemaVersion: 1;
  generatedAt: string;
  storage: "local_mock_jsonl";
  ownerReadableSummary: string;
  events: OwnerVisibleAuditEvent[];
  guardrails: AuditTrailGuardrails & {
    ownerVisibleOnly: true;
    sensitiveFieldsFiltered: true;
  };
};

const sensitiveMetadataPattern = /secret|token|password|credential|api[_-]?key|auth|email|phone|contact|story|private|raw|message|note/i;
const privateValuePattern = /@|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|sk-[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9_]+/i;

export async function loadAuditTrailOwnerVisibilityReport(limit = 12, now = new Date()) {
  const trail = getAppEngineAuditTrail();
  const events = await trail.list();

  return createAuditTrailOwnerVisibilityReport(events, limit, now);
}

export function createAuditTrailOwnerVisibilityReport(events: AppEngineAuditEvent[], limit = 12, now = new Date()): AuditTrailOwnerVisibilityReport {
  const visibleEvents = [...events]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, Math.max(1, limit))
    .map(toOwnerVisibleAuditEvent);

  return {
    kind: "audit_trail_owner_visibility",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    storage: "local_mock_jsonl",
    ownerReadableSummary: visibleEvents.length
      ? `${visibleEvents.length} recent local/mock audit event${visibleEvents.length === 1 ? "" : "s"} are visible to the owner. Sensitive/private fields are filtered before display.`
      : "No audit events are stored yet. AppEngine will show local/mock owner-visible events here as they are recorded.",
    events: visibleEvents,
    guardrails: {
      ...getAppEngineAuditTrail().describe().guardrails,
      ownerVisibleOnly: true,
      sensitiveFieldsFiltered: true
    }
  };
}

function toOwnerVisibleAuditEvent(event: AppEngineAuditEvent): OwnerVisibleAuditEvent {
  const metadataPreview: OwnerVisibleAuditEvent["metadataPreview"] = [];
  let privateFieldsFiltered = false;

  for (const [key, value] of Object.entries(event.metadata)) {
    if (sensitiveMetadataPattern.test(key)) {
      privateFieldsFiltered = true;
      continue;
    }

    if (typeof value === "string" && (sensitiveMetadataPattern.test(value) || privateValuePattern.test(value))) {
      privateFieldsFiltered = true;
      continue;
    }

    metadataPreview.push({
      key: key.slice(0, 60),
      value: formatMetadataValue(value)
    });
  }

  return {
    id: event.id,
    eventTime: event.createdAt,
    eventType: event.type,
    source: event.actor.type,
    sourceId: safeSourceId(event.actor.type, event.actor.id),
    subjectId: event.subjectId,
    summary: safeSummary(event.summary),
    safeStatus: "safe_for_owner_review",
    privateFieldsFiltered,
    metadataPreview: metadataPreview.slice(0, 4)
  };
}

function formatMetadataValue(value: string | number | boolean | null) {
  if (value === null) return "none";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).slice(0, 100);
}

function safeSourceId(source: AppEngineAuditEvent["actor"]["type"], sourceId: string) {
  if (!sourceId || sourceId === "anonymous") return source;
  if (privateValuePattern.test(sourceId)) return `${source}_id_filtered`;
  return sourceId.slice(0, 80);
}

function safeSummary(summary: string) {
  if (privateValuePattern.test(summary)) return "Audit summary contained private-looking content and was filtered for owner visibility.";
  return summary.slice(0, 220);
}
