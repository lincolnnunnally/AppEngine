# Production Auth Readiness Check

## Goal

Before AppEngine is used in production, the owner needs a clear report that answers:

- Are admin and owner routes protected?
- Is the two-door soft-launch entry protected?
- Are Opportunity/problem intake routes and APIs protected?
- Are admin-only APIs protected?
- Are local/dev bypasses safely blocked for production?
- Which auth environment assumptions are still missing?

This is a readiness report only. It does not deploy, change auth settings, add secrets, or change environment variables.

## Artifact

`production_auth_readiness`

Required fields:

- `kind`
- `schemaVersion`
- `generatedAt`
- `status`
- `ownerReadableSummary`
- `protectedRoutes`
- `ownerOnlyApis`
- `adminOnlyApis`
- `checks`
- `missingEnvAssumptions`
- `devBypassRisks`
- `guardrails`

## Required Checks

The report must check:

- `AUTH_SECRET` production guard
- `APP_ENGINE_OWNER_EMAIL` owner/admin identity
- OAuth provider readiness
- protected owner/admin routes
- protected soft-launch entry and intake surfaces
- owner-only intake APIs
- admin-only engine APIs
- development/setup bypass risk

## Production Blocking Rules

Production auth is blocked when:

- `AUTH_SECRET` is missing
- `APP_ENGINE_OWNER_EMAIL` is missing
- development or setup bypass is enabled in production
- admin-only APIs are not gated
- protected owner/admin pages are not gated
- the two-door entry or intake routes can be reached without owner access during soft launch

OAuth provider setup may be `needs_owner_confirmation` until the owner selects GitHub, Google, or another provider path.

## Guardrails

This readiness check must not:

- deploy production
- create paid resources
- apply migrations
- add secrets or environment variables
- change repository visibility
- trigger Codex automatically
- create GitHub issues
- apply labels
