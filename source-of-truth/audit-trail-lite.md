# Audit Trail Lite

## Purpose

AppEngine needs an append-only record of important owner and system actions before it can operate reliably in production. This first slice defines a local/mock audit trail only. It does not introduce an external logging service or database migration.

## Storage

Current storage:

```text
local_mock_jsonl
```

The audit trail writes JSON lines under `.app-engine/audit-trail/events.jsonl` when used locally.

## Tracked Events

Audit Trail Lite supports these event types:

- `intake_submitted`
- `handoff_prepared`
- `orchestrator_action_queued`
- `orchestrator_action_exported`
- `spark_item_reviewed`
- `readiness_snapshot_generated`

## Event Shape

Each event records:

- event id
- event type
- actor type and id
- summary
- subject id when available
- safe metadata
- timestamp
- storage mode
- guardrails

Secret-like metadata keys must be redacted.

## Guardrails

This slice must not:

- use an external logging service
- deploy production
- create paid resources
- apply migrations
- add secrets or environment variables
- change repository visibility
- trigger Codex automatically
- create GitHub issues
- apply labels

## Success

Audit Trail Lite succeeds when AppEngine can append and read local/mock audit events for the core workflow moments that matter, while preserving all production-safety guardrails.
