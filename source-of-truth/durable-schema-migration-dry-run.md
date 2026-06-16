# Durable State Schema and Migration Dry Run

## Purpose

This standard defines the first durable AppEngine state schema and a migration dry run. It is not a live migration.

The goal is to make durable storage concrete enough to review while keeping AppEngine safe:

- no live database connection
- no production database writes
- no migration application
- no secrets or environment changes
- local/mock remains the active default

## Artifact

Use artifact kind:

```text
durable_schema_migration_dry_run
```

Required fields:

- provider
- schema name
- tables
- store mappings
- dry-run checks
- rollback notes
- owner-readable summary
- guardrails

## Required State Coverage

The schema plan must cover:

- handoffs
- project memory
- orchestrator runs
- orchestrator action queue
- audit trail
- problem intake and feedback
- real project trials and reviews
- Spark story submissions
- Spark review queue
- Spark reminder queue

General state may use a typed JSON `state_records` table. Sensitive Spark story submission and review workflows should use explicit tables so privacy, moderation, and future review queries are not hidden inside generic blobs.

## Dry-Run Rules

The dry run may inspect SQL text and validate expected tables, indexes, mappings, and guardrails.

The dry run must not:

- open a Neon connection
- run SQL against any database
- apply migrations
- create paid resources
- change environment variables
- deploy production
- trigger Codex automatically
- create GitHub issues
- apply labels

## Required Tables

The first schema draft should include:

- `app_engine_state.state_records`
- `app_engine_state.audit_events`
- `app_engine_state.spark_story_submissions`
- `app_engine_state.spark_review_items`

## Rollback Notes

Before any future live migration:

- export local/mock state to durable backup artifacts
- keep `APPENGINE_STATE_ADAPTER` on `local_mock` until verification passes
- include reversible SQL and verification queries
- require owner approval before switching durable mode
