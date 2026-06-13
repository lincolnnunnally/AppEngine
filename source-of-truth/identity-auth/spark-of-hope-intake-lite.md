# Identity/Auth Plan: Spark of Hope Intake Lite

## Context Gate

- Decision: Go for identity/auth planning only.
- Source issue: `#50`.
- Trigger label: `ai:plan`.
- Agent mode: `systems`.
- App: Spark of Hope Intake Lite.
- App slug: `spark-of-hope-intake-lite`.
- Charter: `source-of-truth/charters/spark-of-hope-intake-lite.md`.
- Architecture plan: `source-of-truth/architecture/spark-of-hope-intake-lite.md`.
- Data model plan: `source-of-truth/data-model/spark-of-hope-intake-lite.md`.
- Tool classification: Direct Transformation Tool.
- Live GitHub verification: blocked by sandbox network restrictions during `npm run source:check`.
- Local source check: `SOURCE_CHECK_OFFLINE=true npm run source:check` passed.
- Local alignment: `HEAD` and `origin/main` both resolved to `09cbc62f99592d9617983973ea21728767e6160c`.
- Phase boundary: identity/auth artifact only. No auth code, routes, database migrations, provider resources, secrets, preview deployment, production deployment, or generated app merge occurred.

## Required Source Files Read

- `agents/manifest.yaml`
- `agents/prompts/systems.md`
- `agents/context/output-contracts.md`
- `source-of-truth/00-why-we-build.md`
- `source-of-truth/01-ecosystem-philosophy.md`
- `source-of-truth/02-global-principles.md`
- `source-of-truth/03-life-produces-life.md`
- `source-of-truth/04-app-purpose-rules.md`
- `source-of-truth/05-ecosystem-design-gates.md`
- `source-of-truth/charters/spark-of-hope-intake-lite.md`
- `source-of-truth/architecture/spark-of-hope-intake-lite.md`
- `source-of-truth/data-model/spark-of-hope-intake-lite.md`
- `source-of-truth/identity-auth-standard.md`
- `source-of-truth/super-admin-registry.md`
- `source-of-truth/provider-cost/spark-of-hope-intake-lite.md`

## Ecosystem Design Gates

| Gate | Answer |
| --- | --- |
| What barrier does this remove? | It removes the barrier of private story, review, and encouragement work being protected only by convention or UI hiding instead of server-side authorization. |
| What need does this address? | Story sharers need privacy and agency; reviewers, admins, and volunteers need clear access boundaries before implementation. |
| How does this help someone move toward life? | A person can share a hopeful story with trust that it will be stewarded carefully and not exposed beyond the intended workflow. |
| How does this help someone become a source of life for others? | Approved reviewers and encouragement volunteers can help prepare encouragement with only the access needed for their assignment. |

## System Map

| Area | Boundary | Identity/Auth implication |
| --- | --- | --- |
| Public story intake | Public, unprivileged, rate-limited submission path. | Public sharing remains unprivileged. Submitting a story does not create admin, reviewer, volunteer, or customer access. |
| Customer workspace | Optional authenticated status/export/deletion path for a story sharer. | Requires authenticated session plus story ownership or owner/admin role. |
| Review workflow | App-scoped staff review of submissions. | Requires active membership, role permission, and assignment or broad review permission. |
| Encouragement workflow | Assigned response preparation with minimum necessary story context. | Requires active membership and response assignment. Volunteers do not receive contact details by default. |
| Membership and role management | Owner/admin management of app-scoped users, roles, assignments, and settings. | Requires owner/admin server-side checks and auditable grant/revoke events. |
| Super Admin status | Operational metadata, health, logs, deployment, incidents, and follow-ups. | Requires owner/admin access except public-safe health. Must not expose story content or contact values. |
| Provider boundary | Auth.js and app-scoped Postgres/Neon planning. | Reuse existing provider strategy. No paid auth provider, new database resource, or production secrets are created in this phase. |

## Data Boundaries

- Identity objects are app-scoped to Spark of Hope Intake Lite and must not reuse unrelated app user tables, roles, billing state, or memberships without a later approved integration packet.
- Story data remains private by default and separate from contact details.
- Consent controls review, contact, and encouragement preparation eligibility but does not grant cross-app reuse by itself.
- Reviewers can access assigned stories or authorized review queues according to permissions.
- Encouragement volunteers can access assigned response work and minimum necessary story context only.
- Volunteers do not receive contact details by default.
- Audit and status events must contain private-safe metadata only.
- Health, logs, Super Admin status, issue comments, follow-up tasks, and monitoring summaries must not include story body, contact values, session data, provider tokens, stack traces with secrets, or raw request payloads.

## Auth Provider And Session Strategy

- Provider: Auth.js.
- Persistence: app-scoped Postgres tables through the selected generated app database, aligned with the `soh_lite_*` data model.
- Owner source: `APP_ENGINE_OWNER_EMAIL`.
- Session strategy: server-side session checks for protected pages and route handlers.
- Authorization strategy: active session plus active app membership plus role/permission checks plus ownership or assignment checks where required.
- Public intake strategy: no sign-in required for `POST /api/spark-of-hope-intake-lite/stories`, but validation, consent, abuse controls, and private-by-default persistence are required in the build phase.
- Production auth gate: public deployments must require configured Auth.js behavior for every protected page, protected API, mutating admin API, mutating customer API, and Super Admin status surface.

## Identity Objects

| Object | Planned table or source | Purpose |
| --- | --- | --- |
| Auth user | Auth.js adapter identity | Login identity and session subject. |
| App user | `soh_lite_users` | App-scoped user row linked to Auth.js identity or local setup planning. |
| Profile | `soh_lite_users.display_name` or later profile table if needed | Human display and support context. |
| Organization/workspace | `soh_lite_organizations` | Church, ministry, or pilot workspace boundary. |
| Membership | `soh_lite_memberships` | Connects user to organization and app participation status. |
| Role | `soh_lite_roles` and `soh_lite_membership_roles` | Owner, admin, customer, reviewer, and encouragement volunteer access. |
| Permission | `soh_lite_permissions` and `soh_lite_role_permissions` | Route/API enforcement and review/response assignment rules. |
| Review assignment | `soh_lite_review_assignments` | Limits reviewer access to assigned stories when broad review access is not granted. |
| Response assignment | `soh_lite_response_assignments` | Limits volunteer access to assigned encouragement response work. |

## Roles

| Role | Scope | Can | Cannot |
| --- | --- | --- | --- |
| `owner` | Ecosystem/app | Approve production deployment, manage registry status, manage owner/admin access, view health/logs/incidents, manage all app data, perform high-risk admin actions. | Bypass release gates, expose secrets, share data across apps without approval, or deploy production without recorded approval. |
| `admin` | App | Manage story review workflow, users, assignments, settings, incidents, exports, deletion requests, and support actions inside the app boundary. | Approve production on behalf of owner unless a later durable policy says so, or share data outside the app boundary. |
| `customer` | App | Use authenticated customer workspace if enabled, view own story status, request own export/deletion, manage own account. | Read other stories, review queues, audit logs, membership lists, or admin status. |
| `reviewer` | App/organization | Review assigned or authorized stories, write assigned review notes, update permitted review status, prepare or assign response work only if granted. | Manage memberships, broad audit logs, retention settings, owner/admin roles, deletion completion, or volunteer access grants. |
| `encouragement_volunteer` | App/organization | Prepare assigned encouragement responses using minimum necessary story context. | View broad story queues, contact details by default, review notes by default, audit logs, memberships, settings, or deletion/export workflows. |
| `public_story_sharer` | Public intake state, not a privileged role | Submit one story through public intake with consent and validation. | Access protected pages or APIs merely because a story was submitted. |

## Permission Model

| Permission | Owner | Admin | Customer | Reviewer | Encouragement volunteer |
| --- | --- | --- | --- | --- | --- |
| `story.create_public` | yes | yes | yes | no | no |
| `story.read_own` | yes | yes | own only | no | no |
| `story.read_assigned` | yes | yes | no | assigned only | limited assigned context only |
| `story.read_all_private` | yes | yes | no | if explicitly granted | no |
| `story.manage_status` | yes | yes | no | assigned only | no |
| `story.read_contact` | yes | yes | own only | policy-gated | no by default |
| `review.assign` | yes | yes | no | if granted | no |
| `review.write_assigned` | yes | yes | no | assigned only | no |
| `response.prepare_assigned` | yes | yes | no | assigned only | assigned only |
| `response.approve` | yes | yes | no | if granted | no |
| `membership.manage` | yes | yes | no | no | no |
| `audit.read` | yes | yes | no | no | no |
| `export.request_own` | yes | yes | own only | no | no |
| `export.prepare_admin` | yes | yes | no | no | no |
| `deletion.request_own` | yes | yes | own only | no | no |
| `deletion.complete_admin` | yes | yes | no | no | no |
| `settings.manage` | yes | yes | no | no | no |
| `super_admin.status_read` | yes | yes | no | no | no |
| `incident.manage` | yes | yes | no | no | no |
| `follow_up.create` | yes | yes | no | no | no |

## Protected Page Matrix

| Planned page | Required roles | Required permission or condition | Server-side check |
| --- | --- | --- | --- |
| `/spark-of-hope-intake-lite` | Public | none | Public-safe page; no private data. |
| `/spark-of-hope-intake-lite/share` | Public | none | Public-safe page; no private data. |
| `/spark-of-hope-intake-lite/share/thanks` | Public | non-guessable reference only if used | Must not reveal story details or internal ids. |
| `/spark-of-hope-intake-lite/privacy` | Public | none | Public-safe page. |
| `/app/spark-of-hope-intake-lite` | `owner`, `admin`, `customer` | active membership; customer sees own records only | Required. |
| `/app/spark-of-hope-intake-lite/stories/:storyId` | `owner`, `admin`, `customer` | owner/admin or authenticated story owner | Required. |
| `/account` | authenticated users | own account only | Required. |
| `/admin/apps/spark-of-hope-intake-lite` | `owner`, `admin` | app admin access | Required. |
| `/admin/apps/spark-of-hope-intake-lite/stories` | `owner`, `admin`, `reviewer` | `story.read_all_private` or assigned queue policy | Required. |
| `/admin/apps/spark-of-hope-intake-lite/stories/:storyId` | `owner`, `admin`, assigned `reviewer` | `story.read_all_private` or active review assignment | Required. |
| `/admin/apps/spark-of-hope-intake-lite/responses` | `owner`, `admin`, `reviewer`, `encouragement_volunteer` | `response.prepare_assigned` or admin access | Required. |
| `/admin/apps/spark-of-hope-intake-lite/responses/:responseId` | `owner`, `admin`, assigned `reviewer`, assigned `encouragement_volunteer` | active response assignment or admin access | Required. |
| `/admin/apps/spark-of-hope-intake-lite/users` | `owner`, `admin` | `membership.manage` | Required. |
| `/admin/apps/spark-of-hope-intake-lite/settings` | `owner`, `admin` | `settings.manage` | Required. |
| `/admin/apps/spark-of-hope-intake-lite/incidents` | `owner`, `admin` | `incident.manage` | Required. |
| `/admin/apps/spark-of-hope-intake-lite/follow-ups` | `owner`, `admin` | `follow_up.create` | Required. |

## Protected API Matrix

| API route | Access | Required permission or condition | Server-side check |
| --- | --- | --- | --- |
| `POST /api/spark-of-hope-intake-lite/stories` | Public, rate limited | `story.create_public`, consent, validation, abuse controls | Required validation; no privileged session required. |
| `GET /api/customer/spark-of-hope-intake-lite/stories` | `owner`, `admin`, `customer` | owner/admin or story owner list | Required. |
| `GET /api/customer/spark-of-hope-intake-lite/stories/:storyId` | `owner`, `admin`, `customer` | owner/admin or authenticated story owner | Required. |
| `POST /api/customer/spark-of-hope-intake-lite/export-requests` | `owner`, `admin`, `customer` | `export.request_own` or admin export request policy | Required. |
| `POST /api/customer/spark-of-hope-intake-lite/deletion-requests` | `owner`, `admin`, `customer` | `deletion.request_own` or admin deletion request policy | Required. |
| `GET /api/admin/spark-of-hope-intake-lite/stories` | `owner`, `admin`, `reviewer` | `story.read_all_private` or assigned queue policy | Required. |
| `GET /api/admin/spark-of-hope-intake-lite/stories/:storyId` | `owner`, `admin`, assigned `reviewer` | `story.read_all_private` or active review assignment | Required. |
| `PATCH /api/admin/spark-of-hope-intake-lite/stories/:storyId/status` | `owner`, `admin`, assigned `reviewer` | `story.manage_status`; reviewer limited to assigned story and permitted transitions | Required. |
| `POST /api/admin/spark-of-hope-intake-lite/stories/:storyId/responses` | `owner`, `admin`, assigned `reviewer`, assigned `encouragement_volunteer` | `response.prepare_assigned` or admin access; story consent allows encouragement | Required. |
| `PATCH /api/admin/spark-of-hope-intake-lite/responses/:responseId` | `owner`, `admin`, assigned `reviewer`, assigned `encouragement_volunteer` | `response.prepare_assigned`; approval requires `response.approve` | Required. |
| `GET /api/admin/spark-of-hope-intake-lite/audit` | `owner`, `admin` | `audit.read` | Required. |
| `GET /api/admin/spark-of-hope-intake-lite/memberships` | `owner`, `admin` | `membership.manage` | Required. |
| `PATCH /api/admin/spark-of-hope-intake-lite/memberships/:membershipId` | `owner`, `admin` | `membership.manage`; role grant/revoke boundaries apply | Required. |
| `POST /api/admin/spark-of-hope-intake-lite/export-requests/:requestId/prepare` | `owner`, `admin` | `export.prepare_admin` | Required. |
| `POST /api/admin/spark-of-hope-intake-lite/deletion-requests/:requestId/complete` | `owner`, `admin` | `deletion.complete_admin` | Required. |
| `GET /api/engine/apps/spark-of-hope-intake-lite/health` | Public-safe status | no private data | Must return safe status only. |
| `GET /api/engine/apps/spark-of-hope-intake-lite/status` | `owner`, `admin`, Super Admin service path | `super_admin.status_read` | Required. |
| `GET /api/engine/apps/spark-of-hope-intake-lite/logs` | `owner`, `admin` | `super_admin.status_read` | Required; no raw private logs in response. |
| `GET /api/engine/apps/spark-of-hope-intake-lite/deployment` | `owner`, `admin` | `super_admin.status_read` | Required. |
| `POST /api/engine/apps/spark-of-hope-intake-lite/incidents` | `owner`, `admin` | `incident.manage` | Required. |
| `POST /api/engine/apps/spark-of-hope-intake-lite/follow-ups` | `owner`, `admin` | `follow_up.create` | Required. |

All mutating API routes must validate input, enforce server-side authorization, write private-safe audit/status events, and avoid logging story content, contact values, secrets, session payloads, provider credentials, raw headers, raw IPs, or raw user agents.

## Grant And Revoke Boundaries

- Owner bootstrap comes from `APP_ENGINE_OWNER_EMAIL`.
- Owners can grant and revoke `owner`, `admin`, `customer`, `reviewer`, and `encouragement_volunteer` roles inside the app boundary.
- Admins can grant and revoke `customer`, `reviewer`, and `encouragement_volunteer` roles inside the app boundary.
- Admins must not grant or revoke `owner` unless a later durable policy explicitly allows owner delegation.
- Reviewers and encouragement volunteers cannot grant or revoke roles.
- Role grants and revocations must write `soh_lite_status_events` and `soh_lite_audit_events` entries with private-safe metadata.
- Revoked or suspended memberships must immediately lose protected page/API access.
- Disabled or deleted users must fail session authorization even if a browser still has a session cookie.

## Reviewer And Volunteer Assignment Boundaries

- Reviewer access must check active membership, reviewer role, required permission, and either assigned story or explicit broad review permission.
- Reviewer status transitions must be limited to assigned stories unless owner/admin access is present.
- Encouragement volunteer access must check active membership, volunteer role, `response.prepare_assigned`, and active response assignment.
- Encouragement volunteers can see only the response task and minimum necessary story context.
- Contact values are hidden from volunteers by default.
- Review notes are hidden from volunteers by default unless a later policy grants a redacted summary.
- Assignment revocation immediately removes access to the story or response task.

## Local Setup Behavior

- Local setup may use a development-only setup user before production auth is configured.
- Any local setup bypass must be disabled for public preview and production.
- Local setup must not create production bypass credentials, hard-coded passwords, real OAuth credentials, provider tokens, or seeded real users.
- Synthetic local users may be used only when a later build issue explicitly authorizes test fixtures.
- Public deployments must fail closed for protected routes if Auth.js configuration or owner bootstrap is missing.

## Production And Preview Gates

- Production remains blocked.
- Preview remains blocked until Provider/Cost, Data Model, Identity/Auth, UI Design, review, compatibility, deployment environment, and release gates pass.
- No paid resources are approved by this identity/auth plan.
- No production secrets, production deployments, real user data, or unreviewed generated app merges are allowed.
- Protected route/API implementation must be tested before preview.
- Super Admin registry/status surfaces must reflect identity/auth roles and planned user-management state before release approval.

## Provider/Cost Review

Existing provider/cost artifact: `source-of-truth/provider-cost/spark-of-hope-intake-lite.md`.

Identity/Auth cost posture:

- Auth/session provider: Auth.js.
- New paid auth provider: not required for MVP.
- Database/session storage: planned app-scoped Postgres/Neon strategy; no branch, schema, migration, or provider provisioning is created in this phase.
- OAuth providers: optional later setup only; this phase lists variable names and behavior expectations, not credential values.
- Preview posture: `free_or_low_cost`.
- Production posture: `approval_required`.
- Upgrade trigger: usage, reliability, customer value, or revenue justifies paid resources and owner approval is recorded.
- Blocker: any request to add a paid auth provider, email magic-link provider, SMS provider, paid database resource, or production OAuth setup must route to provider/cost review before provisioning.

## Dependency Map

| Dependency | Status | Must wait for |
| --- | --- | --- |
| Charter | Complete | None. |
| Architecture plan | Complete | None. |
| Provider/cost review | Complete as planning artifact | Owner approval before paid resources. |
| Data model plan | Complete | Migration/build issue before implementation. |
| Identity/Auth plan | This artifact | None for planning; build must wait for explicit build issue. |
| UI Design | Pending | Should use this identity/auth matrix for screens, states, and role-specific navigation. |
| Deployment environment | Pending | Must list auth/database env var names without values before preview. |
| MVP build | Blocked | Provider/cost, data model, identity/auth, UI design, review path, and explicit build issue. |
| Preview deployment | Blocked | Build, tests, design review, UX review, compatibility, release gate, health/logs/status. |
| Production deployment | Blocked | Preview evidence, release gate, owner approval, rollback notes, Super Admin status update. |

Parallelizable next work:

- UI Design can proceed from this identity/auth matrix.
- Deployment Environment planning can proceed using the env var names and protected surface map.
- Compatibility planning can proceed for auth flows, forms, mobile, and admin surfaces.
- Super Admin registration planning can proceed with status, health, logs, admin, users, incidents, and follow-up surfaces.

Must wait:

- Auth implementation must wait for an explicit `ai:build` issue.
- Database migration must wait for an explicit build issue and migration rollback plan.
- Preview deployment must wait for release-gate prerequisites.
- Paid provider work and production OAuth/provider setup must wait for provider/cost approval and owner approval.

## Failure Modes And Reroutes

| Failure mode | Risk | Reroute |
| --- | --- | --- |
| Public story submission silently creates privileged access | Private workflow exposure | Fix before build/release; public sharing remains unprivileged. |
| UI hides admin links but APIs lack server-side checks | Data exposure | Route to `ai:fix`; release blocker. |
| Reviewer can read unassigned stories without explicit permission | Purpose and privacy breach | Route to `ai:fix`; tighten assignment checks. |
| Volunteer can see contact values by default | Overexposure of private data | Route to `ai:fix`; enforce minimum necessary context. |
| Revoked membership keeps access through stale session | Unauthorized access | Route to `ai:fix`; session authorization must re-check active status. |
| Owner bootstrap missing in preview | Admin lockout or unsafe bypass temptation | Route to deployment/auth planning; fail closed. |
| OAuth secrets or provider tokens appear in docs, issues, logs, or artifacts | Secret exposure | Stop, redact, and rotate if needed; route to security fix. |
| Health/status/logs expose story content or stack traces | Privacy and trust breach | Route to `ai:fix`; health/status must be public-safe. |
| Cross-app Spark of Hope identity or story reuse is assumed | Purpose bleed | Route to planning/integration issue; require documented consent and boundary. |
| Auth implementation proceeds before this plan, UI design, data model, and release gates are acknowledged | Giant-task drift | Pause build and split into scoped follow-up issues. |

## Operating Assumptions

- This pilot is not the full Spark of Hope product.
- Auth.js remains the default auth provider.
- Public story intake stays account-free unless a later phase documents a reason to require sign-in.
- Story data is private by default.
- Owner/admin/reviewer/volunteer access is app-scoped and permission-based.
- Reviewer and volunteer access is assignment-aware.
- AppEngine Super Admin receives operational metadata, not story content.
- No production bypass, secrets, OAuth credentials, provider tokens, paid resources, real user data, or deployment actions are included in this artifact.

## Acceptance Criteria Evidence

- Each protected page and API route has required roles and permissions.
- Server-side checks are required for all protected and mutating surfaces.
- Public story sharing remains unprivileged.
- Owner/admin role grant and revoke boundaries are documented.
- Reviewer and volunteer access follows the data model assignment boundaries.
- Provider/cost impact is reviewed against the existing provider/cost artifact.
- Failure modes and reroutes are named.
- No secrets or OAuth credential values are included.
- No auth code, provider resources, migrations, preview deploys, or production deploys were created.

## Machine Artifact

```json
{
  "agent": "systems",
  "status": "completed",
  "summary": "Identity/Auth phase completed for Spark of Hope Intake Lite as a planning artifact only. No auth code, routes, database migrations, provider resources, secrets, preview deployment, production deployment, real user data, paid resources, or generated app merge occurred.",
  "artifacts": [
    {
      "kind": "identity_auth_plan",
      "title": "Spark of Hope Intake Lite Identity/Auth Plan",
      "content": {
        "schemaVersion": 1,
        "app": {
          "name": "Spark of Hope Intake Lite",
          "slug": "spark-of-hope-intake-lite",
          "charterPath": "source-of-truth/charters/spark-of-hope-intake-lite.md",
          "architecturePath": "source-of-truth/architecture/spark-of-hope-intake-lite.md",
          "dataModelPath": "source-of-truth/data-model/spark-of-hope-intake-lite.md",
          "providerCostPath": "source-of-truth/provider-cost/spark-of-hope-intake-lite.md",
          "sourceIssue": 50,
          "targetVersion": "v1",
          "toolClassification": "direct_transformation"
        },
        "auth": {
          "provider": "Auth.js",
          "sessionStrategy": "Server-side session checks with active app-scoped membership, role, permission, ownership, and assignment checks.",
          "localMode": "Development-only setup user may exist before production auth is configured; public preview and production must fail closed without configured auth.",
          "ownerSource": "APP_ENGINE_OWNER_EMAIL",
          "publicStorySharing": "Unprivileged public intake with validation, consent, abuse controls, and no protected access grant."
        },
        "identityObjects": [
          "Auth.js user",
          "soh_lite_users",
          "soh_lite_organizations",
          "soh_lite_memberships",
          "soh_lite_roles",
          "soh_lite_permissions",
          "soh_lite_role_permissions",
          "soh_lite_membership_roles",
          "soh_lite_review_assignments",
          "soh_lite_response_assignments"
        ],
        "roles": [
          {
            "role": "owner",
            "scope": "ecosystem/app",
            "can": [
              "approve production deployment",
              "manage registry status",
              "manage owner/admin access",
              "manage all app data",
              "perform high-risk admin actions"
            ]
          },
          {
            "role": "admin",
            "scope": "app",
            "can": [
              "manage story review workflow",
              "manage users and assignments",
              "manage settings",
              "manage incidents",
              "prepare exports and complete deletion requests"
            ]
          },
          {
            "role": "customer",
            "scope": "app",
            "can": [
              "view own story status when customer workspace is enabled",
              "request own export or deletion",
              "manage own account"
            ]
          },
          {
            "role": "reviewer",
            "scope": "app/organization",
            "can": [
              "review assigned or authorized stories",
              "write assigned review notes",
              "update permitted review status",
              "prepare response work if granted"
            ]
          },
          {
            "role": "encouragement_volunteer",
            "scope": "app/organization",
            "can": [
              "prepare assigned encouragement responses with minimum necessary story context"
            ]
          }
        ],
        "protectedRoutes": [
          {
            "path": "/app/spark-of-hope-intake-lite",
            "access": ["owner", "admin", "customer"],
            "condition": "active membership; customer sees own records only"
          },
          {
            "path": "/admin/apps/spark-of-hope-intake-lite",
            "access": ["owner", "admin"],
            "condition": "app admin access"
          },
          {
            "path": "/admin/apps/spark-of-hope-intake-lite/stories/:storyId",
            "access": ["owner", "admin", "assigned reviewer"],
            "condition": "story.read_all_private or active review assignment"
          },
          {
            "path": "/admin/apps/spark-of-hope-intake-lite/responses/:responseId",
            "access": ["owner", "admin", "assigned reviewer", "assigned encouragement_volunteer"],
            "condition": "active response assignment or admin access"
          }
        ],
        "protectedApis": [
          {
            "path": "POST /api/spark-of-hope-intake-lite/stories",
            "access": ["public"],
            "condition": "validation, consent, abuse controls, and no privileged role grant"
          },
          {
            "path": "PATCH /api/admin/spark-of-hope-intake-lite/stories/:storyId/status",
            "access": ["owner", "admin", "assigned reviewer"],
            "condition": "story.manage_status; reviewer limited to assigned story and permitted transitions"
          },
          {
            "path": "PATCH /api/admin/spark-of-hope-intake-lite/responses/:responseId",
            "access": ["owner", "admin", "assigned reviewer", "assigned encouragement_volunteer"],
            "condition": "response.prepare_assigned; approval requires response.approve"
          },
          {
            "path": "PATCH /api/admin/spark-of-hope-intake-lite/memberships/:membershipId",
            "access": ["owner", "admin"],
            "condition": "membership.manage; role grant and revoke boundaries apply"
          }
        ],
        "dataBoundaries": [
          "Users and memberships are app-scoped unless an approved integration says otherwise.",
          "Story data is private by default.",
          "Contact details are separated from story body.",
          "Reviewer and volunteer access is assignment-aware.",
          "Volunteers do not receive contact details by default.",
          "Audit/status events contain private-safe metadata only.",
          "Super Admin surfaces expose operational metadata only."
        ],
        "providerCostReview": {
          "kind": "provider_cost_review",
          "path": "source-of-truth/provider-cost/spark-of-hope-intake-lite.md",
          "status": "existing_review_applies",
          "authProvider": "Auth.js",
          "newPaidAuthProviderRequired": false,
          "newPaidResourceAllowed": false,
          "preview": "free_or_low_cost",
          "production": "approval_required"
        },
        "dependencyMap": {
          "parallelizable": [
            "ui_design",
            "deployment_environment_planning",
            "compatibility_planning",
            "super_admin_registration_planning"
          ],
          "blockedUntilLater": [
            "auth_implementation",
            "database_migration",
            "preview_deployment",
            "production_deployment",
            "paid_provider_work"
          ]
        },
        "guardrails": {
          "serverSideChecksRequired": true,
          "publicStorySharingUnprivileged": true,
          "assignmentChecksRequired": true,
          "noCrossAppUserBleed": true,
          "noSecretsInOutput": true,
          "noProductionBypass": true,
          "productionRequiresConfiguredAuth": true,
          "noProviderProvisioning": true,
          "noPaidResourcesWithoutApproval": true
        }
      }
    },
    {
      "kind": "provider_cost_review",
      "title": "Identity/Auth Provider Cost Delta",
      "content": {
        "schemaVersion": 1,
        "status": "existing_provider_cost_review_applies",
        "path": "source-of-truth/provider-cost/spark-of-hope-intake-lite.md",
        "delta": "No new paid auth provider, email/SMS provider, database resource, OAuth setup, deployment, or monitoring resource is approved by this phase."
      }
    }
  ],
  "findings": [],
  "followUpTasks": [],
  "handoffTo": ["designer", "planner"]
}
```
