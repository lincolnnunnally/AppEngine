# Durable State Adapter Foundation

## Purpose

AppEngine currently uses local/mock state for several owner-facing workflows. That is useful for preview work, but it blocks production readiness because AppEngine cannot reliably operate away from a local machine if project memory, handoffs, action queues, trial data, and Spark review state are temporary.

This standard adds a storage adapter boundary before any migration or database work begins.

## Current Default

The default adapter remains:

```text
local_mock
```

It writes JSON under `.app-engine/state` and keeps the same safety posture as the existing local/mock stores.

## Future Database Shape

The future database adapter is defined but disabled.

Planned shape:

- connection source: `DATABASE_URL`
- schema: `app_engine_state`
- state records table: `state_records`
- audit events table: `audit_events`

The database adapter must remain disabled until there is:

- owner approval
- reviewed schema
- reviewed migration
- rollback plan
- privacy/data-retention review
- production release gate evidence

## Covered State

The durable-state boundary covers:

- handoffs
- project memory
- orchestrator runs
- orchestrator action queue
- real project trials
- trial result reviews
- problem intake submissions
- problem intake feedback
- Spark story submissions
- Spark review queue
- Spark reminder queue
- legacy development projects

## Guardrails

This foundation must not:

- apply migrations
- create paid resources
- deploy production
- add secrets or environment variables
- change repository visibility
- trigger Codex automatically
- create GitHub issues
- apply labels

## Success

AppEngine succeeds when it has a clear adapter interface, local/mock remains the default, future database persistence is shaped but disabled, and the next migration work can be planned without changing live state behavior.
