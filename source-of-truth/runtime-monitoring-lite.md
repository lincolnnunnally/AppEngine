# Runtime Monitoring Lite

## Goal

AppEngine needs a simple owner-readable runtime health summary before production use.

This first version is local/mock only. It does not connect to an external monitoring service, create alerts, deploy production, or change infrastructure.

## Artifact

`runtime_monitoring_lite`

Required fields:

- `kind`
- `schemaVersion`
- `generatedAt`
- `status`
- `ownerReadableSummary`
- `components`
- `guardrails`

## Components Tracked

Runtime Monitoring Lite must track:

- persistence adapter
- orchestrator
- handoff relay
- audit trail
- Spark review flow

Each component should include:

- status
- storage mode
- summary
- evidence
- next safe action

## Statuses

- `healthy`: local/mock state is readable and no immediate blocker is known.
- `needs_attention`: the component works for local/mock review but still needs durable/production work.
- `blocked`: the component cannot be read or should not be treated as healthy.

## Guardrails

This monitoring layer must not:

- deploy production
- create paid resources
- apply migrations
- add secrets or environment variables
- change repository visibility
- trigger Codex automatically
- create GitHub issues
- apply labels
- connect to external monitoring/logging services

## Success Criteria

1. AppEngine can summarize local/mock runtime health.
2. The owner can see what is healthy, what needs attention, and what is blocked.
3. Spark review flow is tracked as local/browser mock until durable review storage is approved.
4. No external monitoring provider is required.
