# Production Auth Owner Confirmation

## Purpose

Production Auth Owner Confirmation is the owner-facing checkpoint before AppEngine can be considered ready for first controlled production use.

The earlier `production_auth_readiness` report checks the code and assumptions. This confirmation report records whether the owner has confirmed the production auth configuration and protected surfaces.

It must fail honestly when confirmation is incomplete.

## Artifact

Use artifact kind:

```text
production_auth_owner_confirmation
```

Required fields:

- status
- required environment variable names
- protected routes
- owner-only APIs
- admin-only APIs
- confirmation checklist
- missing owner confirmations
- owner-readable summary
- guardrails

## Required Owner Confirmations

Before controlled production use, the owner must confirm:

- `AUTH_SECRET` is configured in production and managed outside the repo
- `APP_ENGINE_OWNER_EMAIL` is configured in production
- an auth provider path is selected
- protected owner/admin routes are reviewed
- admin-only APIs are reviewed
- development/setup bypasses do not grant production access
- owner approval notes are recorded

## Required Protected Routes

The confirmation must include:

- `/`
- `/opportunity-intake`
- `/problem-intake-lite`
- `/owner-control-center`
- `/admin`

## Required Protected APIs

The confirmation must include owner-only intake APIs such as:

- `/api/opportunity-intake`
- `/api/problem-intake-lite`

The confirmation must include engine admin APIs such as:


- `/api/engine/health`
- `/api/engine/setup-profile`
- `/api/engine/audit-trail`
- `/api/engine/handoff-relay`
- `/api/engine/project-memory`
- `/api/engine/orchestrator-run`
- `/api/engine/real-project-trial`

## Guardrails

This checkpoint must not:

- deploy production
- read or expose secret values
- add or change secrets/env vars
- create paid resources
- apply migrations
- change repository visibility
- trigger Codex automatically
- create GitHub issues
- apply labels
