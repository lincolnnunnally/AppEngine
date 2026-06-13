# Provider/Cost Review: Spark of Hope Intake Lite

## Context Gate

- Decision: Go for provider/cost planning only.
- Source issue: `#43`.
- Trigger label: `ai:plan`.
- App: Spark of Hope Intake Lite.
- App slug: `spark-of-hope-intake-lite`.
- Charter: `source-of-truth/charters/spark-of-hope-intake-lite.md`.
- Architecture plan: `source-of-truth/architecture/spark-of-hope-intake-lite.md`.
- Tool classification: Direct Transformation Tool.
- Live GitHub verification: blocked by sandbox network restrictions during `npm run source:check`.
- Local source check: `SOURCE_CHECK_OFFLINE=true npm run source:check` passed.
- Phase boundary: provider/cost artifact only. No provider provisioning, deployment, paid resource creation, secrets, environment value changes, migrations, or app code implementation.

## Required Source Files Read

- `agents/manifest.yaml`
- `agents/context/output-contracts.md`
- `source-of-truth/00-why-we-build.md`
- `source-of-truth/01-ecosystem-philosophy.md`
- `source-of-truth/02-global-principles.md`
- `source-of-truth/03-life-produces-life.md`
- `source-of-truth/04-app-purpose-rules.md`
- `source-of-truth/05-ecosystem-design-gates.md`
- `source-of-truth/charters/spark-of-hope-intake-lite.md`
- `source-of-truth/architecture/spark-of-hope-intake-lite.md`
- `source-of-truth/operations-cost-provider-strategy.md`
- `source-of-truth/deployment-environment-standard.md`
- `source-of-truth/release-gate-standard.md`

## Ecosystem Design Gate Answers

- Barrier removed: scattered, informal, or unsafe story collection is replaced with a planned, bounded, private intake and response path.
- Need addressed: story sharers need a trusted way to share hope, and church teams need a responsible way to review stories, protect privacy, and prepare encouragement.
- Movement toward life: the app helps someone move from holding a story alone toward being heard, stewarded, and encouraged.
- Source of life for others: the app helps church staff and encouragement volunteers respond carefully so received hope can become encouragement for another person.

## Provider Assumptions

| Area | Preferred provider | Strategy | Paid resource allowed in pilot dry run |
| --- | --- | --- | --- |
| Frontend | Vercel | Reuse existing approved Vercel account/project where practical; preview planning first. | No |
| API/backend | Vercel Functions through Next.js route handlers | Separate Render or always-on backend is not required for MVP. Add only if later architecture proves it is needed. | No |
| Database | Neon | Use generated-app branch or app-scoped database planning before any separate project. No branch, schema, migration, or seed action in this phase. | No |
| Auth/session | Auth.js | Use app-scoped roles and memberships; cost impact is expected to come from app database/session storage, not a separate paid auth provider. | No |
| Logs | Vercel logs or planned Super Admin log link | Use built-in provider logs and Super Admin status before adding paid observability. Logs must not include story content, secrets, tokens, or private contact values. | No |
| Health | App-owned health route | Planned route: `/api/engine/apps/spark-of-hope-intake-lite/health`. Health output must be public-safe and contain no private data or secrets. | No |
| Email/notifications | Not required initially | Do not add transactional email until a later response-delivery scope is approved. The pilot may prepare encouragement responses without sending messages. | No |
| Storage/uploads | Not required initially | Do not create file storage. The MVP does not require uploads. | No |
| Payments/billing | Not applicable | No donations, payments, billing, fundraising, or campaign-management scope in MVP. | No |
| AI/model calls | Not required initially | Do not add model calls or model-provider costs. Encouragement response preparation remains human-reviewed unless a later approved packet adds AI. | No |
| Analytics | Not required initially | Do not add paid analytics. Any future analytics must be privacy-preserving and app-boundary-safe. | No |
| Monitoring | AppEngine Super Admin status plus built-in provider health/log checks | Use planned health/status routes, release gate checks, and post-launch monitoring tasks before adding paid monitoring. | No |

## Cost Posture

- Preview: `free_or_low_cost`.
- Production: `approval_required`.
- Pilot dry-run monthly ceiling: zero paid resources.
- Production monthly ceiling: owner-defined before production approval.
- Upgrade trigger: usage, reliability, customer value, or revenue justifies paid resources and owner approval is recorded.
- New paid provider resources: blocked until provider/cost review, release gate requirements, and owner approval are recorded in durable source of truth.

## Release And Provisioning Blocks

- Provider provisioning is blocked in this phase.
- Production deployment is blocked until Release Gate approval and owner approval are recorded.
- Release Gate approval is blocked until this provider/cost review, deployment environment plan, identity/auth plan, Super Admin registry plan, design review, UX review, and compatibility plan are complete.
- Any later request for Vercel paid plan changes, Render, Neon paid resources, storage, email, payments, AI, analytics, or monitoring must create a scoped approval follow-up before provisioning.

## Acceptance Criteria Evidence

- Frontend named: Vercel preview planning with reuse-first strategy.
- API/backend named: Next.js route handlers on Vercel Functions; separate backend not required initially.
- Database named: Neon generated-app branch or app-scoped database planning; no provisioning in this phase.
- Logs named: Vercel logs or planned Super Admin log link.
- Health named: `/api/engine/apps/spark-of-hope-intake-lite/health`.
- Email, storage, payments, AI, analytics, and paid monitoring named as not required initially.
- Preview and production cost posture are separated.
- New paid resources remain blocked without owner approval.
- No provider resources were provisioned.
- No secrets or private credentials are included.

## Machine Artifact

```json
{
  "agent": "planner",
  "status": "completed",
  "summary": "Provider/cost phase completed for Spark of Hope Intake Lite as a planning artifact only. No provider provisioning, deployment, paid resource creation, secrets, environment value changes, migrations, or app code implementation occurred.",
  "artifacts": [
    {
      "kind": "provider_cost_review",
      "title": "Spark of Hope Intake Lite Provider and Cost Review",
      "content": {
        "kind": "provider_cost_review",
        "schemaVersion": 1,
        "app": {
          "name": "Spark of Hope Intake Lite",
          "slug": "spark-of-hope-intake-lite",
          "charterPath": "source-of-truth/charters/spark-of-hope-intake-lite.md",
          "architecturePath": "source-of-truth/architecture/spark-of-hope-intake-lite.md",
          "sourceIssue": 43,
          "sourceIssueUrl": "https://github.com/lincolnnunnally/AppEngine/issues/43",
          "targetVersion": "v1",
          "toolClassification": "direct_transformation"
        },
        "purpose": "Help a person or church collect one hopeful story, preserve the story safely, and prepare a small encouragement response workflow.",
        "audience": [
          "People sharing hopeful stories",
          "Church staff reviewing submitted stories",
          "Encouragement volunteers preparing a response",
          "AppEngine owner/admin users monitoring the pilot through Super Admin"
        ],
        "barrierRemoved": "Scattered, informal, or unsafe story collection.",
        "needAddressed": "A trusted way to share hopeful experiences and a responsible church-team workflow for review, privacy, and encouragement preparation.",
        "movementTowardLife": "Moves a story sharer from holding a story alone toward being heard, stewarded, and encouraged.",
        "transformationOutcome": "A calm, trusted story-intake workflow where hope is received responsibly and encouragement can be prepared safely.",
        "costPosture": {
          "preview": "free_or_low_cost",
          "production": "approval_required",
          "pilotDryRunMonthlyCeiling": "zero_paid_resources",
          "productionMonthlyCeiling": "owner-defined before production approval",
          "upgradeTrigger": "Usage, reliability, customer value, or revenue justifies paid resources and owner approval is recorded."
        },
        "providers": [
          {
            "area": "frontend",
            "preferred": "Vercel",
            "strategy": "Reuse existing approved Vercel account/project where practical; preview planning first.",
            "newPaidResourceAllowed": false,
            "status": "planned_only"
          },
          {
            "area": "api_backend",
            "preferred": "Vercel Functions through Next.js route handlers",
            "strategy": "Use serverless route handlers for MVP. Do not add Render or an always-on backend unless a later approved phase proves the need.",
            "newPaidResourceAllowed": false,
            "status": "planned_only"
          },
          {
            "area": "database",
            "preferred": "Neon",
            "strategy": "Use generated-app branch or app-scoped database planning before any separate project. Do not create branches, schemas, migrations, or seed data in this phase.",
            "newPaidResourceAllowed": false,
            "status": "planned_only"
          },
          {
            "area": "auth_session",
            "preferred": "Auth.js",
            "strategy": "Use app-scoped roles, memberships, and server-side session checks. Do not add a separate paid auth provider for MVP.",
            "newPaidResourceAllowed": false,
            "status": "planned_only"
          },
          {
            "area": "monitoring_logs",
            "preferred": "Vercel logs or planned Super Admin log link",
            "strategy": "Use built-in logs and Super Admin status before adding paid observability. Logs must exclude story content, private contact values, secrets, and provider credentials.",
            "newPaidResourceAllowed": false,
            "status": "planned_only"
          },
          {
            "area": "health",
            "preferred": "App-owned health route",
            "strategy": "Plan `/api/engine/apps/spark-of-hope-intake-lite/health` with public-safe status only.",
            "newPaidResourceAllowed": false,
            "status": "planned_only"
          },
          {
            "area": "email_notifications",
            "preferred": "not_required_initially",
            "strategy": "Do not add transactional email until a later response-delivery scope is approved.",
            "newPaidResourceAllowed": false,
            "status": "not_required_for_mvp"
          },
          {
            "area": "storage_uploads",
            "preferred": "not_required_initially",
            "strategy": "Do not create storage; MVP does not require file uploads.",
            "newPaidResourceAllowed": false,
            "status": "not_required_for_mvp"
          },
          {
            "area": "payments_billing",
            "preferred": "not_applicable",
            "strategy": "No payments, donations, billing, fundraising, or campaign-management scope in MVP.",
            "newPaidResourceAllowed": false,
            "status": "not_applicable"
          },
          {
            "area": "ai_models",
            "preferred": "not_required_initially",
            "strategy": "Do not add model calls or model-provider costs. Encouragement response preparation remains human-reviewed unless a later approved packet adds AI.",
            "newPaidResourceAllowed": false,
            "status": "not_required_for_mvp"
          },
          {
            "area": "analytics",
            "preferred": "not_required_initially",
            "strategy": "Do not add paid analytics. Any future analytics must be privacy-preserving and app-boundary-safe.",
            "newPaidResourceAllowed": false,
            "status": "not_required_for_mvp"
          },
          {
            "area": "paid_monitoring",
            "preferred": "not_required_initially",
            "strategy": "Use AppEngine Super Admin status, planned health checks, release gate checks, and built-in provider logs before paid monitoring.",
            "newPaidResourceAllowed": false,
            "status": "not_required_for_mvp"
          }
        ],
        "checks": [
          {
            "id": "reuse_before_create",
            "status": "passed_planned",
            "question": "Can this app reuse existing approved provider resources before creating new services?"
          },
          {
            "id": "preview_before_paid",
            "status": "passed_planned",
            "question": "Can preview run free or low-cost before production resources are approved?"
          },
          {
            "id": "zero_paid_resources_during_pilot_dry_run",
            "status": "passed",
            "question": "Does the pilot dry run block every paid resource?"
          },
          {
            "id": "database_branch_before_project",
            "status": "passed_planned",
            "question": "Can the app use a Neon branch or app-scoped database instead of a new paid project?"
          },
          {
            "id": "backend_only_if_required",
            "status": "passed_planned",
            "question": "Is a separate always-on backend unnecessary for this version?"
          },
          {
            "id": "storage_email_payments_ai_only_if_used",
            "status": "passed",
            "question": "Are storage, email, payments, AI, analytics, and paid monitoring excluded until approved scope requires them?"
          },
          {
            "id": "owner_approval_before_paid",
            "status": "required",
            "question": "Is owner approval required before any paid production resource is created?"
          },
          {
            "id": "no_secrets_in_output",
            "status": "passed",
            "question": "Does this artifact avoid secret values, provider tokens, private credentials, and private billing data?"
          }
        ],
        "approvalRequirements": {
          "beforeProviderProvisioning": [
            "Confirm provider reuse is insufficient or unsafe.",
            "Record owner approval for any new paid resource.",
            "Record production monthly ceiling or owner-approved budget.",
            "Confirm release gate dependency is satisfied for the requested environment."
          ],
          "beforeProductionRelease": [
            "Complete release gate.",
            "Complete deployment environment plan.",
            "Confirm health and logs paths.",
            "Confirm rollback notes.",
            "Record owner approval."
          ]
        },
        "guardrails": {
          "blocksProvisioning": true,
          "blocksReleaseGateApproval": true,
          "noPaidResourcesWithoutApproval": true,
          "reuseBeforeCreate": true,
          "zeroPaidResourcesDuringPilotDryRun": true,
          "noProductionDeploy": true,
          "noSecretsInOutput": true,
          "noProviderTokensInOutput": true,
          "noPrivateBillingDataInOutput": true,
          "preserveAppBoundary": true,
          "keepSeparateFromFullSparkOfHope": true
        },
        "verification": {
          "sourceCheck": "SOURCE_CHECK_OFFLINE=true npm run source:check",
          "liveGitHubCheck": "blocked_by_network_restrictions_in_current_sandbox",
          "artifactReview": "Confirmed provider areas, cost posture split, paid-resource block, upgrade trigger, owner approval requirement, and no secret values."
        }
      }
    }
  ],
  "findings": [],
  "followUpTasks": [],
  "handoffTo": [
    "planner",
    "builder",
    "designer"
  ]
}
```
