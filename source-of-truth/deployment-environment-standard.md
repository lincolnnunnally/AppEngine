# Deployment Environment Standard

Every generated app must define its deployment environment before preview or production release work begins.

The standard keeps frontend hosting, API hosting, database targets, environment variables, logs, health checks, domains, and rollback notes visible before an agent tries to launch anything.

## Required Decisions

Each app must declare:

- Frontend provider
- API/backend provider when needed
- Database provider
- Required environment variable names without secret values
- Preview URL or planned preview URL
- Owner review URL or planned review URL
- Production URL or approval-gated production status
- Custom domain or subdomain plan
- Health check path
- Logs provider and logs URL or planned link
- Rollback notes
- Production deploy approval requirement

## Default Pattern

Use this default unless the App Build Packet documents a different stack:

- Frontend: Vercel preview first
- API/backend: Vercel functions for simple apps, Render service when a separate API/backend is needed
- Database: Neon branch or app-scoped database for generated apps
- Preview URL: created before production
- Owner review URL: stable current review location for Lincoln
- Production URL: approval-gated until Release Gate approval
- Custom domain/subdomain: planned before production
- Logs: Vercel logs and Render logs when a Render backend exists
- Health: app-owned health path, usually `/api/health` or a generated-app-specific health route
- Rollback: revert app version, deployment, env var change, or database migration according to the packet

## Preview Access Policy

Preview deployments are public by default so Lincoln, reviewers, and agents can quickly see and verify the work.

Public previews must stay safe:

- No secrets in preview pages, API responses, logs, issue comments, or artifacts.
- No real user data, private story data, production customer data, or private billing data.
- No exposed admin dashboards unless the app has an approved preview-safe admin surface with mock or synthetic data.
- No paid provider actions, production writes, real migrations, or provider provisioning from preview verification.
- Production deployment remains blocked until the Release Gate and owner approval are recorded.

Agents should not use protected Vercel bypass/share links as proof of preview readiness. Preview verification must use a normal public preview URL unless an app-specific charter explicitly records a different owner-approved policy.

## Environment Variable Rules

Agents must define variable names, scopes, and owners. Agents must not write secret values into prompts, issues, docs, registry entries, generated artifacts, or pull requests.

Each variable must state:

- Name
- Scope: `frontend_public`, `server`, `database`, `provider`, or `monitoring`
- Target: Vercel, Render, database provider, GitHub Actions, or local development
- Required: true or false
- Secret: true or false
- Purpose

Public browser variables must use the app's framework convention, such as `NEXT_PUBLIC_` for Next.js. Server secrets, API keys, OAuth secrets, database URLs, and provider tokens must stay server-side.

## Guardrails

Agents must stop or create follow-up work when:

- A generated app has no deployment environment plan.
- A preview deploy is requested without required environment variables listed.
- A preview or review-ready state is claimed without a known owner review URL.
- Production deploy is requested without release-gate approval.
- Production URL, custom domain, health, logs, or rollback notes are missing.
- A backend/API service is needed but no provider, health check, logs path, or env var inventory exists.
- Database provider, migration path, seed path, or rollback note is missing.
- Any secret value appears in generated output.

## Machine Shape

Agents should produce deployment environment artifacts with this shape:

```json
{
  "kind": "deployment_environment_plan",
  "schemaVersion": 1,
  "app": {
    "name": "App name",
    "slug": "app-slug",
    "version": "v1"
  },
  "frontend": {
    "provider": "Vercel",
    "previewUrl": "planned",
    "reviewUrl": "planned",
    "previewAccess": "public_by_default",
    "productionUrl": "approval-gated",
    "customDomain": "planned",
    "logsUrl": "planned",
    "healthPath": "/api/health"
  },
  "apiBackend": {
    "required": false,
    "provider": "Vercel Functions or Render",
    "previewUrl": "planned",
    "healthPath": "/api/health",
    "logsUrl": "planned"
  },
  "database": {
    "provider": "Neon",
    "strategy": "generated-app branch or app-scoped database",
    "migrationPath": "planned",
    "seedPath": "planned",
    "rollbackNotes": "Record migration rollback or restore point before production."
  },
  "environmentVariables": [
    {
      "name": "DATABASE_URL",
      "scope": "database",
      "target": "Vercel/Render server env",
      "required": true,
      "secret": true,
      "purpose": "Database connection string."
    }
  ],
  "rollback": {
    "preview": "Close or update the preview PR and rerun checks.",
    "production": "Revert to the last approved release and apply documented data rollback if needed."
  },
  "guardrails": {
    "previewBeforeProduction": true,
    "publicPreviewByDefault": true,
    "productionRequiresReleaseGate": true,
    "noSecretsInOutput": true,
    "rollbackNotesRequired": true
  }
}
```
