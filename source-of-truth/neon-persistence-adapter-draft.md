# Neon Persistence Adapter Draft

## Goal

Prepare AppEngine for a future durable Neon persistence adapter without connecting to a live database, creating resources, applying migrations, or adding secrets.

## Current Status

```text
adapter: neon_disabled
enabled: false
default: local_mock
```

Local/mock storage remains the active default.

## Environment Variable Names

Names only. Do not add or commit secret values.

- `DATABASE_URL`
- `APPENGINE_STATE_ADAPTER`
- `APPENGINE_STATE_DATABASE_SCHEMA`
- `APPENGINE_STATE_MIGRATIONS_ENABLED`

## Schema Areas

The future Neon adapter must support:

- project memory
- handoffs
- orchestrator queue
- audit trail
- Spark submissions and reviews

## Safe Connection Validation Stub

The current validation step may check whether required environment variable names are present.

It must not:

- print secret values
- open a database connection
- run SQL
- apply migrations
- create Neon branches, databases, roles, or paid resources

The only valid result today is:

```text
disabled_until_owner_approved_schema_and_migration
```

## Future Enablement Requirements

Before a real Neon adapter can be enabled, AppEngine must have:

- reviewed schema design
- reviewed migration SQL
- rollback/export plan
- privacy classification
- owner approval
- migration dry run
- production deployment approval

## Guardrails

This draft must not:

- deploy production
- create paid resources
- apply migrations
- add secrets or environment variables
- change repository visibility
- trigger Codex automatically
- create GitHub issues
- apply labels
