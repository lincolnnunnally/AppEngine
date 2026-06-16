# Persistence Adapter Integration Readiness

## Purpose

Before AppEngine moves state into a database, the existing local/mock stores need adapter-ready seams. This lets the system change storage later without rewriting every workflow at once.

This slice prepares wrappers only. It does not enable the database adapter, apply migrations, change existing store behavior, or write production data.

## First Stores

The first stores to prepare are:

1. Project Memory
2. Handoff Relay
3. Orchestrator Action Queue

These have the highest autonomy value and lower user-data risk than problem intake or Spark story submissions.

## Adapter-Ready Wrapper Requirements

Each wrapper must record:

- current owner file
- durable state adapter kind
- first integration step
- active adapter
- database enabled status
- migration requirement before database use

The active adapter must remain:

```text
local_mock
```

The database adapter must remain:

```text
disabled
```

## Later Integration Order

1. Wrap Project Memory reads/writes.
2. Wrap Handoff Relay reads/writes.
3. Extract Orchestrator Action Queue read/write/update operations.
4. Add dry-run migration tests.
5. Add reviewed schema.
6. Enable database adapter only after owner approval.

## Guardrails

This readiness slice must not:

- deploy production
- create paid resources
- apply migrations
- add secrets or environment variables
- change repository visibility
- trigger Codex automatically
- create GitHub issues
- apply labels
