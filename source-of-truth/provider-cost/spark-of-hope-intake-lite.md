# Provider/Cost Review: Spark of Hope Intake Lite

## Context Gate

- Decision: Go for provider/cost planning only.
- Source issue: `#43`.
- Trigger label: `ai:plan`.
- Agent: Planner.
- App: Spark of Hope Intake Lite.
- App slug: `spark-of-hope-intake-lite`.
- Charter: `source-of-truth/charters/spark-of-hope-intake-lite.md`.
- Architecture plan: `source-of-truth/architecture/spark-of-hope-intake-lite.md`.
- Live GitHub verification: blocked by sandbox network restrictions during `npm run source:check`.
- Local source check: `SOURCE_CHECK_OFFLINE=true npm run source:check` passed.

## Required Source Files Read

- `agents/manifest.yaml`
- `agents/prompts/planner.md`
- `agents/context/output-contracts.md`
- `source-of-truth/global-principles.md`
- `source-of-truth/life-produces-life.md`
- `source-of-truth/charters/spark-of-hope-intake-lite.md`
- `source-of-truth/architecture/spark-of-hope-intake-lite.md`
- `source-of-truth/operations-cost-provider-strategy.md`
- `source-of-truth/deployment-environment-standard.md`
- `source-of-truth/release-gate-standard.md`

## Scope

This phase names provider choices, reuse assumptions, cost posture, upgrade triggers, and owner approval gates for the Spark of Hope Intake Lite pilot.

This phase creates a `provider_cost_review` artifact only. It does not deploy, provision, create paid resources, add secrets, configure provider accounts, write app code, create migrations, or merge generated app output.

## Provider Assumptions

| Area | Preferred provider | Reuse/default strategy | New paid resource allowed now |
| --- | --- | --- | --- |
| Frontend | Vercel | Reuse the existing approved AppEngine/Vercel account path and use preview-first deployment planning. | No |
| API/backend | Vercel Functions | Use Next.js route handlers on Vercel Functions for MVP. A separate Render or always-on backend is not required initially. | No |
| Database | Neon | Use a generated-app branch or app-scoped database plan before considering a new project. No database branch, schema, or migration is created in this phase. | No |
| Logs | Vercel logs and AppEngine Super Admin status/log links | Use provider logs and planned Super Admin status links before adding paid observability. | No |
| Health | App-owned health route | Plan `/api/engine/apps/spark-of-hope-intake-lite/health` with public-safe status only. | No |
| Email/notifications | Not required initially | Do not add email or notification providers until the response workflow requires actual message sending and owner approval records the provider choice. | No |
| File storage | Not required initially | No uploads in MVP. Add storage only through a later approved phase if file uploads become part of scope. | No |
| Payments/billing | Not applicable for MVP | The app must not become a donor, billing, fundraising, or payment system in this pilot. | No |
| AI/model calls | Not required initially | Do not add model calls or AI provider costs for the pilot. | No |
| Monitoring/logs | Built-in Vercel signals, health route, and AppEngine monitor planning | Use free or built-in visibility first. Paid analytics or monitoring requires a later provider/cost delta and owner approval. | No |

## Cost Posture

- Preview: `free_or_low_cost`.
- Production: `approval_required`.
- Pilot dry-run monthly ceiling: zero paid resources.
- Production monthly ceiling: owner-defined before production approval.
- Upgrade trigger: usage, reliability, support burden, ministry/customer value, or revenue justifies a paid provider resource and owner approval is recorded.
- Provider reuse rule: reuse existing approved provider accounts, preview deployments, branches, and app-scoped resources before creating anything new.
- Release rule: this review blocks provider provisioning and Release Gate approval until owner approval exists for any paid production resource.

## Non-Goals

- Do not deploy preview or production.
- Do not create or configure Vercel, Render, Neon, storage, email, payment, AI, analytics, or monitoring resources.
- Do not create database branches, schemas, migrations, or seed data.
- Do not add provider tokens, API keys, credentials, connection strings, or secret values to any artifact.
- Do not implement generated app code.
- Do not expand the pilot into the full Spark of Hope product or a separate paid platform.

## Acceptance Criteria

- Frontend, API/backend, database, logs, health, email, storage, payment, AI, analytics, and monitoring assumptions are named.
- Preview and production cost posture are separated.
- The pilot dry run keeps a zero-paid-resource ceiling.
- New paid resource creation remains blocked without owner approval.
- Provider reuse and branch/app-scoped resource preference are explicit.
- No providers were provisioned.
- No secrets are included.

## Verification

- `npm run source:check` was attempted and blocked by sandbox network restrictions.
- `SOURCE_CHECK_OFFLINE=true npm run source:check` passed.
- `npm run smoke:provider-cost` passed.
- Embedded `provider_cost_review` JSON parses and includes required provider areas.
- Documentation-only change; `npm run typecheck` and `npm run build` are not required by the repo instructions for docs-only work.

## Recommended Next Step

Proceed to the Data Model phase, then Identity/Auth and UI Design, as separate scoped phases. Do not proceed to provider provisioning, preview deployment, production deployment, or MVP build from this Provider/Cost phase alone.

## Machine Artifact

```json
{
  "agent": "planner",
  "status": "completed",
  "summary": "Provider/Cost phase completed for Spark of Hope Intake Lite as documentation only. No provider provisioning, paid resource creation, deployment, database migration, secret handling, or generated app implementation occurred.",
  "artifacts": [
    {
      "kind": "provider_cost_review",
      "title": "Spark of Hope Intake Lite Provider and Cost Review",
      "content": {
        "kind": "provider_cost_review",
        "schemaVersion": 1,
        "app": {
          "name": "Spark of Hope Intake Lite",
          "slug": "spark-of-hope-intake-lite"
        },
        "costPosture": {
          "preview": "free_or_low_cost",
          "production": "approval_required",
          "monthlyCeiling": "zero paid resources during pilot dry run; owner-defined before production approval",
          "upgradeTrigger": "Usage, reliability, support burden, ministry/customer value, or revenue justifies a paid provider resource and owner approval is recorded."
        },
        "providers": [
          {
            "area": "frontend",
            "preferred": "Vercel",
            "strategy": "Reuse the existing approved AppEngine/Vercel account path where practical; use preview-first deployment planning.",
            "newPaidResourceAllowed": false
          },
          {
            "area": "api_backend",
            "preferred": "Vercel Functions",
            "strategy": "Use Next.js route handlers on Vercel Functions for MVP. Do not create a separate Render or always-on backend unless a later phase proves it is required.",
            "newPaidResourceAllowed": false
          },
          {
            "area": "database",
            "preferred": "Neon",
            "strategy": "Use a generated-app branch or app-scoped database plan before considering a new project. Do not create branches, schemas, migrations, or seed data in this phase.",
            "newPaidResourceAllowed": false
          },
          {
            "area": "logs",
            "preferred": "Vercel logs and AppEngine Super Admin status/log links",
            "strategy": "Use built-in provider logs and planned Super Admin status links before adding paid observability.",
            "newPaidResourceAllowed": false
          },
          {
            "area": "health",
            "preferred": "App-owned health route",
            "strategy": "Plan `/api/engine/apps/spark-of-hope-intake-lite/health` with public-safe status only.",
            "newPaidResourceAllowed": false
          },
          {
            "area": "email_notifications",
            "preferred": "not_required_initially",
            "strategy": "Do not add email or notification providers until the response workflow requires actual message sending and owner approval records the provider choice.",
            "newPaidResourceAllowed": false
          },
          {
            "area": "storage",
            "preferred": "not_required_initially",
            "strategy": "No uploads in MVP. Add storage only through a later approved phase if file uploads become part of scope.",
            "newPaidResourceAllowed": false
          },
          {
            "area": "payments",
            "preferred": "not_applicable_for_mvp",
            "strategy": "Do not add payment or billing providers during this pilot.",
            "newPaidResourceAllowed": false
          },
          {
            "area": "ai_models",
            "preferred": "not_required_initially",
            "strategy": "Do not add model calls or AI provider costs for the pilot.",
            "newPaidResourceAllowed": false
          },
          {
            "area": "monitoring_logs",
            "preferred": "built_in_vercel_signals_health_route_and_appengine_monitor_planning",
            "strategy": "Use free or built-in visibility first. Paid analytics or monitoring requires a later provider/cost delta and owner approval.",
            "newPaidResourceAllowed": false
          }
        ],
        "checks": [
          {
            "id": "reuse_before_create",
            "status": "required",
            "question": "Can this app reuse existing approved provider accounts, preview deployments, branches, and app-scoped resources before creating anything new?"
          },
          {
            "id": "preview_before_paid",
            "status": "required",
            "question": "Can preview run free or low-cost before production resources are approved?"
          },
          {
            "id": "database_branch_before_project",
            "status": "required",
            "question": "Can the app use a generated-app branch or app-scoped database instead of a new paid project?"
          },
          {
            "id": "backend_only_if_required",
            "status": "required",
            "question": "Is an always-on backend truly required for this version?"
          },
          {
            "id": "storage_email_payments_ai_only_if_used",
            "status": "required",
            "question": "Are storage, email, payments, and AI excluded until the app actually uses them and owner approval exists?"
          },
          {
            "id": "owner_approval_before_paid",
            "status": "required",
            "question": "Is owner approval required before any paid production resource is created?"
          },
          {
            "id": "no_secrets_in_artifacts",
            "status": "required",
            "question": "Do all provider, deployment, and cost artifacts list names and strategies only, without secret values?"
          }
        ],
        "guardrails": {
          "blocksProvisioning": true,
          "blocksReleaseGateApproval": true,
          "noPaidResourcesWithoutApproval": true,
          "reuseBeforeCreate": true,
          "dryRunOnlyForPilot": true,
          "noSecretsInOutput": true
        }
      }
    }
  ],
  "findings": [],
  "followUpTasks": [],
  "handoffTo": [
    "planner"
  ]
}
```
