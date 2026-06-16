# Storage Provider Selection And Configuration Plan

## Purpose

AppEngine needs a durable storage path before it can move beyond local/mock state. This plan chooses the first provider path without creating paid resources, applying migrations, adding secrets, or changing environments.

## Options Compared

| Option | Strengths | Risks | Fit |
| --- | --- | --- | --- |
| Neon | Already part of AppEngine environment model, strong Postgres fit, branch-based workflows, aligns with existing `DATABASE_URL` and generated-app database strategy. | Requires reviewed schema/migrations before use; must avoid mixing AppEngine factory state with generated-app data by accident. | Primary provider. |
| Supabase | Postgres-based, useful auth/storage ecosystem, familiar app platform. | Adds another provider surface for AppEngine core state; could duplicate Neon responsibilities and increase operational overhead. | Secondary option, not first path. |
| Local file fallback | Already works for local/mock and offline development, zero provider cost. | Not durable in cloud, not phone-first reliable, not safe as production source of truth. | Fallback only. |

## Recommendation

Primary durable provider:

```text
Neon Postgres
```

Fallback:

```text
local_mock file storage
```

Supabase remains a future option for app-specific products when its platform services are the right fit, but AppEngine core state should avoid splitting durable state across two Postgres providers early.

## Required Environment Variables

Names only. Do not add or commit secret values.

- `DATABASE_URL`
- `APPENGINE_STATE_ADAPTER`
- `APPENGINE_STATE_DATABASE_SCHEMA`
- `APPENGINE_STATE_MIGRATIONS_ENABLED`
- `APPENGINE_STATE_READ_FALLBACK`

Future provider-management variables may include:

- `NEON_API_KEY`
- `NEON_PROJECT_ID`
- `NEON_DATABASE_NAME`
- `NEON_ROLE_NAME`

These variables must remain unset or existing-owner-managed until an approved migration PR exists.

## Schema Areas Needed

The durable schema must support:

- project memory
- handoffs
- orchestrator queue
- audit trail
- Spark submissions and reviews

Initial logical areas:

- `state_records`: generic state records for low-risk internal/private stores
- `audit_events`: append-only audit trail
- `spark_submissions`: sensitive Spark intake records
- `spark_review_events`: Spark review and moderation history
- `orchestrator_actions`: queued/prepared/completed action state

## Migration / No-Migration Safety Path

Current stage:

```text
no_migration
```

Allowed now:

- document provider choice
- define env var names
- define schema areas
- keep local/mock fallback
- prepare adapter-readiness wrappers

Blocked now:

- creating Neon/Supabase resources
- applying migrations
- changing env vars
- writing production data
- enabling database adapter
- dual-writing state

Next safe stage:

```text
schema_design_pr
```

That later PR must include reviewed SQL, dry-run migration checks, export/rollback plan, privacy classification, and owner approval before any database writes occur.

## Guardrails

This plan must not:

- deploy production
- create paid resources
- apply migrations
- add secrets or environment variables
- change repository visibility
- trigger Codex automatically
- create GitHub issues
- apply labels
