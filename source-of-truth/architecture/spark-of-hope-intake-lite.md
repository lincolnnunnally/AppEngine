# Architecture Plan: Spark of Hope Intake Lite

## Context Gate

- Decision: Go for architecture planning only.
- Source issue: `#40`.
- Trigger label: `ai:plan`.
- App: Spark of Hope Intake Lite.
- App slug: `spark-of-hope-intake-lite`.
- Charter: `source-of-truth/charters/spark-of-hope-intake-lite.md`.
- Live GitHub verification: blocked by sandbox network restrictions during `npm run source:check`.
- Local source check: `SOURCE_CHECK_OFFLINE=true npm run source:check` passed.
- Local alignment: `HEAD` and `origin/main` both resolved to `f4badc7ad19eb3a937a6f8e90c3199e09eff3cdd`.

## Required Source Files Read

- `agents/manifest.yaml`
- `agents/prompts/planner.md`
- `agents/context/output-contracts.md`
- `source-of-truth/00-why-we-build.md`
- `source-of-truth/01-ecosystem-philosophy.md`
- `source-of-truth/02-global-principles.md`
- `source-of-truth/03-life-produces-life.md`
- `source-of-truth/04-app-purpose-rules.md`
- `source-of-truth/05-ecosystem-design-gates.md`
- `source-of-truth/charters/spark-of-hope-intake-lite.md`
- `source-of-truth/app-build-packet.md`
- `source-of-truth/identity-auth-standard.md`
- `source-of-truth/super-admin-registry.md`
- `source-of-truth/operations-cost-provider-strategy.md`
- `source-of-truth/deployment-environment-standard.md`
- `source-of-truth/design-quality-gate.md`
- `source-of-truth/compatibility-standard.md`
- `source-of-truth/release-gate-standard.md`

## Scope

This architecture phase defines the planned shape of Spark of Hope Intake Lite. It does not create generated app routes, database migrations, provider resources, deployment configuration, secrets, or production changes.

First useful architecture scope:

- Public story intake concept.
- Protected account and story status surfaces.
- Protected review and encouragement response surfaces.
- API surfaces for later implementation.
- Health, status, logs, incident, and follow-up touchpoints for AppEngine Super Admin.
- Preview-oriented deployment assumptions for Vercel, Neon, and Auth.js.

## Non-Goals

- Do not build the MVP.
- Do not create app route files or API handlers in this phase.
- Do not add database migrations, seed data, or generated app schemas.
- Do not provision Vercel, Neon, email, storage, AI, analytics, monitoring, or other provider resources.
- Do not create production deployment paths.
- Do not collect real story data.
- Do not turn this pilot into the full Spark of Hope product.
- Do not add payments, donations, public story feeds, church CRM, crisis response, counseling, medical, legal, or emergency support workflows.
- Do not share identity, story, billing, or admin data across unrelated apps.

## Route Plan

These routes are planned architecture only. Later build phases must choose exact filenames and framework conventions before implementation.

### Public Story Intake

| Planned route | Purpose | Access |
| --- | --- | --- |
| `/spark-of-hope-intake-lite` | Public first screen for the pilot app with the story intake entry point. | Public |
| `/spark-of-hope-intake-lite/share` | Public story intake form with consent, privacy copy, and validation. | Public |
| `/spark-of-hope-intake-lite/share/thanks` | Submission confirmation and next-step expectations. | Public |
| `/spark-of-hope-intake-lite/privacy` | Plain-language privacy and consent explanation for story sharers. | Public |

Public intake must avoid account friction for the first story submission unless a later identity/auth phase documents a reason to require sign-in. The public form must collect only minimum data needed for review and encouragement.

### Authenticated Customer And Account Surfaces

| Planned route | Purpose | Access |
| --- | --- | --- |
| `/app/spark-of-hope-intake-lite` | Optional story sharer workspace for viewing own submitted story status when accounts are enabled. | `owner`, `admin`, `customer` |
| `/app/spark-of-hope-intake-lite/stories/:storyId` | Authenticated customer view of their own story status and response, if the workflow exposes status. | Story owner, `owner`, `admin` |
| `/account` | Existing AppEngine account surface for profile/session controls. | Authenticated users |

Customer surfaces are optional for the first implementation if public confirmation is enough. If built, they require server-side ownership checks and must not expose another sharer's submission.

### Admin And Review Surfaces

| Planned route | Purpose | Access |
| --- | --- | --- |
| `/admin/apps/spark-of-hope-intake-lite` | App admin overview, status, queue summary, and Super Admin entry point. | `owner`, `admin` |
| `/admin/apps/spark-of-hope-intake-lite/stories` | Review queue for submitted stories. | `owner`, `admin`, `reviewer` |
| `/admin/apps/spark-of-hope-intake-lite/stories/:storyId` | Review detail, status transitions, privacy notes, and audit timeline. | `owner`, `admin`, assigned `reviewer` |
| `/admin/apps/spark-of-hope-intake-lite/responses` | Encouragement response work queue. | `owner`, `admin`, `reviewer`, `encouragement_volunteer` |
| `/admin/apps/spark-of-hope-intake-lite/responses/:responseId` | Draft, review, approve, or mark an encouragement response prepared. | `owner`, `admin`, assigned `reviewer`, assigned `encouragement_volunteer` |
| `/admin/apps/spark-of-hope-intake-lite/users` | App-scoped membership and role management. | `owner`, `admin` |
| `/admin/apps/spark-of-hope-intake-lite/settings` | App privacy, retention, assignment, and response workflow settings. | `owner`, `admin` |

Admin and review surfaces must have server-side role checks. Volunteer-style response work must receive the minimum story context needed to prepare encouragement and must not include unnecessary private contact data.

### API Surfaces

| Planned route | Purpose | Access |
| --- | --- | --- |
| `POST /api/spark-of-hope-intake-lite/stories` | Create a public story submission with consent and validation. | Public, rate limited |
| `GET /api/customer/spark-of-hope-intake-lite/stories` | List the authenticated customer's own submissions if customer accounts are enabled. | Story owner, `owner`, `admin` |
| `GET /api/customer/spark-of-hope-intake-lite/stories/:storyId` | Read one authenticated customer's own story status. | Story owner, `owner`, `admin` |
| `GET /api/admin/spark-of-hope-intake-lite/stories` | List review queue with filtering by review status and assignment. | `owner`, `admin`, `reviewer` |
| `GET /api/admin/spark-of-hope-intake-lite/stories/:storyId` | Read review detail and audit/status timeline. | `owner`, `admin`, assigned `reviewer` |
| `PATCH /api/admin/spark-of-hope-intake-lite/stories/:storyId/status` | Move a story through review status transitions. | `owner`, `admin`, assigned `reviewer` |
| `POST /api/admin/spark-of-hope-intake-lite/stories/:storyId/responses` | Create an encouragement response draft. | `owner`, `admin`, assigned `reviewer`, assigned `encouragement_volunteer` |
| `PATCH /api/admin/spark-of-hope-intake-lite/responses/:responseId` | Update response draft, assignment, review status, or prepared status. | `owner`, `admin`, assigned `reviewer`, assigned `encouragement_volunteer` |
| `GET /api/admin/spark-of-hope-intake-lite/audit` | Read app-scoped audit/status events. | `owner`, `admin` |
| `GET /api/admin/spark-of-hope-intake-lite/memberships` | List app-scoped users, roles, and assignments. | `owner`, `admin` |
| `PATCH /api/admin/spark-of-hope-intake-lite/memberships/:membershipId` | Grant or revoke app-scoped roles. | `owner`, `admin` |

All mutating APIs must validate input, enforce server-side permissions, record audit/status events, and avoid logging story content or private contact values.

### Health And Status

| Planned route | Purpose | Access |
| --- | --- | --- |
| `GET /api/engine/apps/spark-of-hope-intake-lite/health` | App-owned health check for preview, Super Admin, and monitoring. | Public-safe status, no private data |
| `GET /api/engine/apps/spark-of-hope-intake-lite/status` | Operational status summary for Super Admin. | `owner`, `admin`, Super Admin service path |

Health output must contain only safe status, version, dependency readiness, and timestamp fields. It must not include secrets, private story data, user data, database URLs, provider tokens, or stack traces.

### Super Admin Touchpoints

| Planned route or action | Purpose | Access |
| --- | --- | --- |
| `/admin/apps/spark-of-hope-intake-lite` | Management entry and app overview. | `owner`, `admin` |
| `/admin/apps/spark-of-hope-intake-lite/users` | User/admin management status. | `owner`, `admin` |
| `/admin/apps/spark-of-hope-intake-lite/incidents` | Incident list and incident creation handoff. | `owner`, `admin` |
| `/admin/apps/spark-of-hope-intake-lite/follow-ups` | Follow-up work handoff surface. | `owner`, `admin` |
| `GET /api/engine/apps/spark-of-hope-intake-lite/health` | Health check. | Public-safe status |
| `GET /api/engine/apps/spark-of-hope-intake-lite/logs` | Planned logs link or summarized provider log status. | `owner`, `admin` |
| `GET /api/engine/apps/spark-of-hope-intake-lite/deployment` | Preview/deployment status, version, and release-gate state. | `owner`, `admin` |
| `POST /api/engine/apps/spark-of-hope-intake-lite/incidents` | Create an incident or monitoring follow-up. | `owner`, `admin` |
| `POST /api/engine/apps/spark-of-hope-intake-lite/follow-ups` | Create scoped follow-up work from Super Admin. | `owner`, `admin` |

Super Admin status must include management, monitoring, health, logs, users/admin, deployment/status, incidents, follow-up work, and billing/status as `not_applicable` for MVP.

## Data Boundary Plan

| Data area | Planned objects | Owner | Boundary |
| --- | --- | --- | --- |
| Story submissions | `story_submission`, `story_contact`, `story_consent` | Story sharer and app-scoped ministry workflow | Private by default; no public feed; no cross-app reuse without explicit consent and documented integration approval. |
| Review workflow | `story_review`, `review_assignment`, `review_status_event` | App-scoped owner/admin/reviewer team | Reviewers only see assigned or authorized submissions; all status changes are audited. |
| Encouragement responses | `encouragement_response`, `response_assignment`, `response_status_event` | App-scoped owner/admin/reviewer/assigned volunteer | Volunteers see minimum necessary story context and do not get broad story or contact access by default. |
| Audit and status events | `audit_event`, `status_event` | App-scoped owner/admin | Events record who/what/when/status, not full story body or sensitive contact values. |
| App-scoped identity | `user`, `profile`, `account_or_organization`, `membership`, `role`, `permission` | App-scoped identity/auth model | No reuse of unrelated app user tables, roles, billing state, or memberships without documented integration approval. |
| Super Admin registry/status | `super_admin_registry_entry`, `health_status`, `deployment_status`, `incident`, `follow_up_task` | AppEngine Super Admin | Contains operational metadata only; no story content, secrets, or private credentials. |

Privacy defaults:

- Submissions are private by default.
- Public intake must include consent and expectation-setting copy.
- Data-model work must define retention, deletion, export, redaction, review-status history, and admin access rules before migrations.
- Logs and audit events must avoid private story text, contact values, tokens, provider credentials, and raw request payloads.
- Story data must remain separate from the full Spark of Hope product unless a later packet documents consent, integration purpose, and data boundaries.

## Auth And Role Boundaries

Auth provider: Auth.js.

Session strategy: server-side session checks with app-scoped roles and memberships.

Owner source: `APP_ENGINE_OWNER_EMAIL`.

Planned roles:

| Role | Scope | Can |
| --- | --- | --- |
| `owner` | Ecosystem/app | Approve production deployment, manage registry status, manage app admins, review health/logs/incidents, perform high-risk admin actions. |
| `admin` | App | Manage story review workflow, users, assignments, settings, incidents, and support actions inside the app boundary. |
| `customer` | App | Use authenticated customer workspace if enabled and manage only own account or own submitted story status. |
| `reviewer` | App | Review assigned or authorized stories, update review notes/status, assign or prepare response work if granted. |
| `encouragement_volunteer` | App | Prepare assigned encouragement responses with minimum necessary story context. |
| `public_story_sharer` | Public intake state, not a privileged role | Submit one story through public intake with consent and validation. |

Role guardrails:

- Public story sharers are not admins and do not get protected access by submitting a story.
- Reviewer and volunteer roles are app-scoped additions to the default Identity/Auth role model.
- Only `owner` and `admin` can grant or revoke reviewer and volunteer access.
- Admin access must be enforced on the server, not only hidden in the UI.
- Production preview or launch must be blocked until protected route/API checks are implemented and tested.

## Preview And Deployment Assumptions

Frontend:

- Provider: Vercel preview first.
- Production URL: approval-gated until Release Gate approval.
- Custom domain/subdomain: planned before production, not part of this phase.

API/backend:

- Expected provider: Next.js route handlers on Vercel Functions for MVP.
- Separate Render or always-on backend: not required initially.

Database:

- Provider: Neon planning only.
- Strategy: generated-app branch or app-scoped database.
- No migrations or database resources are created in this phase.

Environment variable inventory:

| Variable | Scope | Target | Required | Secret | Purpose |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | `database` | Vercel server env/local development | true | true | App-scoped database connection. |
| `AUTH_SECRET` | `server` | Vercel server env/local development | true | true | Auth.js session/signing secret. |
| `AUTH_URL` | `server` | Vercel server env/local development | true | false | Auth.js canonical app URL. |
| `APP_ENGINE_OWNER_EMAIL` | `server` | Vercel server env/GitHub Actions/local development | true | false | Owner bootstrap source. |
| `NEXT_PUBLIC_APP_URL` | `frontend_public` | Vercel frontend/local development | false | false | Public app base URL for links. |
| `NEON_API_KEY` | `provider` | GitHub Actions/AppEngine provisioning path | false | true | Later generated-app branch automation, not used in this phase. |
| `NEON_PROJECT_ID` | `provider` | GitHub Actions/AppEngine provisioning path | false | false | Later generated-app branch automation, not used in this phase. |

Logs and health:

- Health path: `/api/engine/apps/spark-of-hope-intake-lite/health`.
- Logs provider: Vercel logs or planned Super Admin log link.
- Health and logs must not expose private data or secrets.

Rollback notes:

- Preview rollback: close/update the preview PR, revert the app version, and rerun checks.
- Database rollback: data-model phase must define migration rollback or restore-point rules before any migration is allowed.
- Production rollback: blocked until production approval, rollback notes, and release gate exist.

## Acceptance Criteria

- Routes are named and grouped by public, authenticated customer/user, admin/review, API, health, and Super Admin surfaces.
- Data ownership and privacy boundaries are explicit for submissions, reviewers, responses, audits, memberships, and Super Admin registry/status.
- Auth requirements are tied to Auth.js, app-scoped roles, memberships, permissions, protected routes, and server-side checks.
- Super Admin management, health, logs, users/admin, deployment/status, incidents, and follow-up work touchpoints are explicit.
- Preview and deployment assumptions are explicit without deploying or provisioning anything.
- Follow-up tasks are scoped to Provider/Cost, Data Model, Identity/Auth, and UI Design.
- No implementation, production deployment, paid resources, database migrations, secrets, or generated app code merge occurs in this phase.

## Test And Verification Path

- Documentation verification: confirm this file contains route groups, data boundaries, auth roles, Super Admin touchpoints, deployment assumptions, acceptance criteria, and non-goals.
- Source verification: run `SOURCE_CHECK_OFFLINE=true npm run source:check` when network is unavailable; run `npm run source:check` when network is available.
- Later provider/cost phase: verify provider reuse, cost posture, paid-resource blocks, and upgrade triggers.
- Later data-model phase: verify schema ownership, privacy, retention, audit events, migrations, seed data, and rollback.
- Later identity/auth phase: verify server-side route/API guards for owner, admin, customer, reviewer, and volunteer roles.
- Later UI design phase: verify mobile-first story intake, review queue, response workflow, trust copy, empty/error states, and admin screens.

## Recommended Next Step

Proceed to Provider/Cost planning, then Data Model, Identity/Auth, and UI Design. Keep each as a scoped follow-up issue. Do not proceed directly to MVP build from this architecture plan.

## Machine Artifact

```json
{
  "agent": "planner",
  "status": "completed",
  "summary": "Architecture phase completed for Spark of Hope Intake Lite as documentation only. No implementation, provider provisioning, database migration, production deployment, paid resource creation, or generated app code merge occurred.",
  "artifacts": [
    {
      "kind": "architecture_plan",
      "title": "Spark of Hope Intake Lite Architecture Plan",
      "content": {
        "schemaVersion": 1,
        "app": {
          "name": "Spark of Hope Intake Lite",
          "slug": "spark-of-hope-intake-lite",
          "charterPath": "source-of-truth/charters/spark-of-hope-intake-lite.md",
          "sourceIssue": 40,
          "sourceIssueUrl": "https://github.com/lincolnnunnally/AppEngine/issues/40",
          "phase": "architecture",
          "targetVersion": "v1",
          "decision": "proceed_to_provider_cost_data_model_identity_auth_and_ui_design_follow_ups"
        },
        "routes": {
          "public": [
            "/spark-of-hope-intake-lite",
            "/spark-of-hope-intake-lite/share",
            "/spark-of-hope-intake-lite/share/thanks",
            "/spark-of-hope-intake-lite/privacy"
          ],
          "authenticatedCustomer": [
            "/app/spark-of-hope-intake-lite",
            "/app/spark-of-hope-intake-lite/stories/:storyId",
            "/account"
          ],
          "adminReview": [
            "/admin/apps/spark-of-hope-intake-lite",
            "/admin/apps/spark-of-hope-intake-lite/stories",
            "/admin/apps/spark-of-hope-intake-lite/stories/:storyId",
            "/admin/apps/spark-of-hope-intake-lite/responses",
            "/admin/apps/spark-of-hope-intake-lite/responses/:responseId",
            "/admin/apps/spark-of-hope-intake-lite/users",
            "/admin/apps/spark-of-hope-intake-lite/settings"
          ],
          "api": [
            "POST /api/spark-of-hope-intake-lite/stories",
            "GET /api/customer/spark-of-hope-intake-lite/stories",
            "GET /api/customer/spark-of-hope-intake-lite/stories/:storyId",
            "GET /api/admin/spark-of-hope-intake-lite/stories",
            "GET /api/admin/spark-of-hope-intake-lite/stories/:storyId",
            "PATCH /api/admin/spark-of-hope-intake-lite/stories/:storyId/status",
            "POST /api/admin/spark-of-hope-intake-lite/stories/:storyId/responses",
            "PATCH /api/admin/spark-of-hope-intake-lite/responses/:responseId",
            "GET /api/admin/spark-of-hope-intake-lite/audit",
            "GET /api/admin/spark-of-hope-intake-lite/memberships",
            "PATCH /api/admin/spark-of-hope-intake-lite/memberships/:membershipId"
          ],
          "healthStatus": [
            "GET /api/engine/apps/spark-of-hope-intake-lite/health",
            "GET /api/engine/apps/spark-of-hope-intake-lite/status"
          ],
          "superAdmin": [
            "/admin/apps/spark-of-hope-intake-lite",
            "/admin/apps/spark-of-hope-intake-lite/users",
            "/admin/apps/spark-of-hope-intake-lite/incidents",
            "/admin/apps/spark-of-hope-intake-lite/follow-ups",
            "GET /api/engine/apps/spark-of-hope-intake-lite/logs",
            "GET /api/engine/apps/spark-of-hope-intake-lite/deployment",
            "POST /api/engine/apps/spark-of-hope-intake-lite/incidents",
            "POST /api/engine/apps/spark-of-hope-intake-lite/follow-ups"
          ]
        },
        "dataBoundaries": [
          "Story submissions are private by default and belong to the story sharer and app-scoped ministry workflow authorized to review them.",
          "Reviewers and volunteers only receive authorized or assigned story context.",
          "Encouragement volunteers receive minimum necessary story context and no broad contact-data access by default.",
          "Audit/status events record workflow metadata without full story body, secret values, or sensitive contact values.",
          "Identity, membership, role, permission, billing, and story data stay app-scoped unless a later approved integration documents otherwise.",
          "Super Admin registry/status data contains operational metadata only."
        ],
        "auth": {
          "provider": "Auth.js",
          "sessionStrategy": "Server-side session checks with app-scoped roles and memberships.",
          "ownerSource": "APP_ENGINE_OWNER_EMAIL",
          "roles": [
            "owner",
            "admin",
            "customer",
            "reviewer",
            "encouragement_volunteer",
            "public_story_sharer"
          ],
          "productionAuthGate": "Public deployments require configured auth for protected customer, admin, review, volunteer, and Super Admin surfaces."
        },
        "deploymentAssumptions": {
          "frontend": "Vercel preview first",
          "apiBackend": "Vercel Functions for MVP; separate backend not required initially",
          "database": "Neon generated-app branch or app-scoped database planning only",
          "healthPath": "/api/engine/apps/spark-of-hope-intake-lite/health",
          "production": "blocked until Release Gate and owner approval",
          "newPaidResourcesAllowed": false
        },
        "guardrails": {
          "architectureOnly": true,
          "noImplementation": true,
          "noDatabaseMigrations": true,
          "noProviderProvisioning": true,
          "noPaidResources": true,
          "noProductionDeploy": true,
          "noSecretsInOutput": true,
          "preserveAppBoundary": true,
          "keepSeparateFromFullSparkOfHope": true
        }
      }
    }
  ],
  "findings": [],
  "followUpTasks": [
    {
      "title": "[spark-of-hope-intake-lite] Phase: Provider/Cost",
      "recommendedLabel": "ai:plan",
      "body": "## Provider/Cost Phase: Spark of Hope Intake Lite\n\nRun the Provider/Cost phase from the App Build Packet and architecture plan.\n\n## Required Source Of Truth To Load\n- source-of-truth/00-why-we-build.md\n- source-of-truth/01-ecosystem-philosophy.md\n- source-of-truth/02-global-principles.md\n- source-of-truth/03-life-produces-life.md\n- source-of-truth/04-app-purpose-rules.md\n- source-of-truth/05-ecosystem-design-gates.md\n- source-of-truth/charters/spark-of-hope-intake-lite.md\n- source-of-truth/architecture/spark-of-hope-intake-lite.md\n- source-of-truth/operations-cost-provider-strategy.md\n- source-of-truth/deployment-environment-standard.md\n- source-of-truth/release-gate-standard.md\n- agents/manifest.yaml\n- agents/context/output-contracts.md\n\n## Phase Goal\nCreate a provider_cost_review artifact only. Confirm provider reuse, preview and production cost posture, zero paid resources during pilot dry run, upgrade triggers, and owner approval requirements before any provisioning.\n\n## Acceptance Criteria\n- Frontend, API/backend, database, logs, health, email/storage/payment/AI/monitoring assumptions are named.\n- Preview and production cost posture are separated.\n- New paid resource creation remains blocked without owner approval.\n- No providers are provisioned and no secrets are included.\n\n## Guardrails\nDo not deploy, provision, create paid resources, add secrets, or implement app code."
    },
    {
      "title": "[spark-of-hope-intake-lite] Phase: Data Model",
      "recommendedLabel": "ai:build",
      "body": "## Data Model Phase: Spark of Hope Intake Lite\n\nDefine the app data model from the charter and architecture plan. This phase may create a schema plan, but must not apply migrations or provision databases unless a later approved build task explicitly authorizes it.\n\n## Required Source Of Truth To Load\n- source-of-truth/00-why-we-build.md\n- source-of-truth/01-ecosystem-philosophy.md\n- source-of-truth/02-global-principles.md\n- source-of-truth/03-life-produces-life.md\n- source-of-truth/04-app-purpose-rules.md\n- source-of-truth/05-ecosystem-design-gates.md\n- source-of-truth/charters/spark-of-hope-intake-lite.md\n- source-of-truth/architecture/spark-of-hope-intake-lite.md\n- source-of-truth/app-build-packet.md\n- source-of-truth/identity-auth-standard.md\n- source-of-truth/deployment-environment-standard.md\n- agents/manifest.yaml\n- agents/context/output-contracts.md\n\n## Phase Goal\nDefine tables or model objects for story submissions, consent/contact, review assignments, encouragement responses, audit/status events, app-scoped memberships, roles, and permissions.\n\n## Acceptance Criteria\n- Ownership, retention, deletion, privacy, export, audit, and rollback notes are explicit.\n- Story data stays private by default and separate from the full Spark of Hope product.\n- Reviewer and volunteer data access boundaries are explicit.\n- No migration is applied and no real user data is created.\n\n## Guardrails\nDo not provision Neon, apply migrations, add seed data with real people, expose secrets, or implement UI/API routes."
    },
    {
      "title": "[spark-of-hope-intake-lite] Phase: Identity/Auth",
      "recommendedLabel": "ai:build",
      "body": "## Identity/Auth Phase: Spark of Hope Intake Lite\n\nCreate the identity_auth_plan for the planned route/API surfaces.\n\n## Required Source Of Truth To Load\n- source-of-truth/00-why-we-build.md\n- source-of-truth/01-ecosystem-philosophy.md\n- source-of-truth/02-global-principles.md\n- source-of-truth/03-life-produces-life.md\n- source-of-truth/04-app-purpose-rules.md\n- source-of-truth/05-ecosystem-design-gates.md\n- source-of-truth/charters/spark-of-hope-intake-lite.md\n- source-of-truth/architecture/spark-of-hope-intake-lite.md\n- source-of-truth/identity-auth-standard.md\n- source-of-truth/super-admin-registry.md\n- agents/manifest.yaml\n- agents/context/output-contracts.md\n\n## Phase Goal\nDefine Auth.js provider behavior, session strategy, identity objects, app-scoped memberships, roles, permissions, protected route/API matrix, local setup behavior, and production auth gates for owner, admin, customer, reviewer, and encouragement volunteer access.\n\n## Acceptance Criteria\n- Each protected page and API route has required roles.\n- Server-side checks are required for all protected and mutating surfaces.\n- Public story sharing remains unprivileged unless the phase explicitly changes that with a reason.\n- Owner/admin role grant and revoke boundaries are documented.\n- No secrets or OAuth credential values are included.\n\n## Guardrails\nDo not implement auth code unless the active issue explicitly asks for build work; do not create production bypasses or cross-app identity sharing."
    },
    {
      "title": "[spark-of-hope-intake-lite] Phase: UI Design",
      "recommendedLabel": "ai:build",
      "body": "## UI Design Phase: Spark of Hope Intake Lite\n\nCreate a UI design brief from the charter and architecture plan before MVP implementation.\n\n## Required Source Of Truth To Load\n- source-of-truth/00-why-we-build.md\n- source-of-truth/01-ecosystem-philosophy.md\n- source-of-truth/02-global-principles.md\n- source-of-truth/03-life-produces-life.md\n- source-of-truth/04-app-purpose-rules.md\n- source-of-truth/05-ecosystem-design-gates.md\n- source-of-truth/charters/spark-of-hope-intake-lite.md\n- source-of-truth/architecture/spark-of-hope-intake-lite.md\n- source-of-truth/design-quality-gate.md\n- source-of-truth/ux-review-standard.md\n- source-of-truth/compatibility-standard.md\n- agents/manifest.yaml\n- agents/context/output-contracts.md\n\n## Phase Goal\nDefine mobile-first flows, screens, content hierarchy, trust copy, empty states, error states, loading states, onboarding, admin/review screens, response workflow screens, and Super Admin status surfaces.\n\n## Acceptance Criteria\n- Public story intake, thank-you, optional account status, review queue, review detail, response work queue, admin settings/users, and Super Admin status surfaces are covered.\n- Primary actions are clear for story sharers, reviewers, admins, and volunteers.\n- Mobile-first behavior, accessibility, contrast, spacing, and touch targets are addressed.\n- Empty, error, loading, onboarding, and admin states are included.\n- No implementation or generated app code is created.\n\n## Guardrails\nDo not build the UI, deploy previews, create production assets, or expand into the full Spark of Hope product."
    }
  ],
  "handoffTo": [
    "systems",
    "builder",
    "designer"
  ]
}
```
