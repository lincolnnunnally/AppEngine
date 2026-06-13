# Data Model Plan: Spark of Hope Intake Lite

## Context Gate

- Decision: Go for data-model planning only.
- Source issue: `#44`.
- Trigger label: `ai:plan`.
- App: Spark of Hope Intake Lite.
- App slug: `spark-of-hope-intake-lite`.
- Charter: `source-of-truth/charters/spark-of-hope-intake-lite.md`.
- Architecture plan: `source-of-truth/architecture/spark-of-hope-intake-lite.md`.
- Tool classification: Direct Transformation Tool.
- Live GitHub verification: blocked by sandbox network restrictions during `npm run source:check`.
- Local source check: `SOURCE_CHECK_OFFLINE=true npm run source:check` passed.
- Local alignment: `HEAD` and `origin/main` both resolved to `77f0f88596ccdad68071b942dff1d854fe6a91ec`.

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
- `source-of-truth/architecture/spark-of-hope-intake-lite.md`
- `source-of-truth/app-build-packet.md`
- `source-of-truth/identity-auth-standard.md`
- `source-of-truth/deployment-environment-standard.md`

## Phase Scope

This phase defines the planned data model for Spark of Hope Intake Lite. It may inform a later migration, generated app schema, or seed plan, but it does not create or apply migrations, provision Neon, create app routes, create API handlers, seed real data, or collect real user data.

First useful data-model scope:

- Public story submissions with consent and privacy status.
- Contact details separated from story content.
- Review assignments and review status history.
- Encouragement response drafts, assignments, and response status history.
- Audit/status events that avoid private story text and contact values.
- App-scoped identity objects, memberships, roles, and permissions.
- Retention, deletion, export, rollback, and privacy rules for the later build phase.

## Ecosystem Design Gates

| Gate | Answer |
| --- | --- |
| What barrier does this remove? | It removes the barrier of scattered, informal, or unsafe story storage by defining a private, bounded, reviewable data shape before implementation. |
| What need does this address? | Story sharers need trust and privacy; church teams need enough structured data to review and encourage responsibly without over-collecting. |
| How does this help someone move toward life? | It lets a story be received with care instead of being lost, exposed, or mishandled, creating a safe path toward encouragement. |
| How does this help someone become a source of life for others? | It gives approved reviewers and volunteers enough context to prepare encouragement while protecting the story sharer's dignity and agency. |

## Data Model Principles

- Story data is private by default.
- Story content is separate from contact details.
- Consent records are explicit and versioned.
- Review and response work is app-scoped and assignment-aware.
- Volunteers receive minimum necessary story context and no broad contact access by default.
- Audit and status events record workflow metadata, not full story text, raw contact values, secrets, tokens, or request payloads.
- App identity, memberships, roles, permissions, and story data stay separate from the full Spark of Hope product and unrelated ecosystem apps.
- No table in this plan authorizes public story feeds, social sharing, donations, crisis response, counseling, medical, legal, emergency support, or cross-app user/story reuse.

## Planned Tables

Names use the `soh_lite_` prefix to keep the pilot app separate from any future full Spark of Hope schema.

### `soh_lite_organizations`

Purpose: app-scoped church, ministry, or pilot workspace boundary.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Internal stable identifier. |
| `slug` | text unique | App-scoped workspace slug. |
| `name` | text | Organization display name. |
| `status` | enum | `active`, `paused`, `archived`. |
| `retention_days` | integer nullable | Default story retention rule; null means use app default. |
| `created_at` | timestamp | Creation timestamp. |
| `updated_at` | timestamp | Last update timestamp. |

Ownership: owner/admin managed. Story data belongs inside one organization boundary unless the later build phase intentionally supports solo story submissions without an organization.

### `soh_lite_users`

Purpose: app-scoped user identity row linked to Auth.js identity in the selected generated app database.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | App-scoped user id. |
| `auth_user_id` | text unique nullable | Auth provider user id or adapter id; nullable only for planned/local setup before auth is configured. |
| `email_normalized` | text unique nullable | Needed for owner/admin bootstrap and login matching; do not expose broadly. |
| `display_name` | text nullable | Admin/reviewer display. |
| `status` | enum | `invited`, `active`, `disabled`, `deleted`. |
| `created_at` | timestamp | Creation timestamp. |
| `updated_at` | timestamp | Last update timestamp. |

Privacy: user rows must not store OAuth secrets, session secrets, provider tokens, passwords, or credentials.

### `soh_lite_memberships`

Purpose: connect users to the app organization and define app-scoped participation.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Membership id. |
| `organization_id` | uuid foreign key | References `soh_lite_organizations.id`. |
| `user_id` | uuid foreign key | References `soh_lite_users.id`. |
| `status` | enum | `invited`, `active`, `suspended`, `revoked`. |
| `created_by_user_id` | uuid nullable | Owner/admin who created it. |
| `created_at` | timestamp | Creation timestamp. |
| `updated_at` | timestamp | Last update timestamp. |

Access boundary: membership does not grant access by itself; effective permissions come from roles and permissions.

### `soh_lite_roles`

Purpose: app-scoped role catalog.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Role id. |
| `key` | text unique | `owner`, `admin`, `customer`, `reviewer`, `encouragement_volunteer`. |
| `name` | text | Human-readable label. |
| `scope` | enum | `ecosystem`, `app`, `organization`. |
| `description` | text nullable | Role intent. |
| `system_role` | boolean | Prevent deletion of required roles. |

Boundary: `owner` and `admin` can grant or revoke reviewer and volunteer access. `customer`, `reviewer`, and `encouragement_volunteer` cannot grant roles.

### `soh_lite_permissions`

Purpose: app-scoped permission catalog for route/API enforcement.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Permission id. |
| `key` | text unique | Example: `story.read_assigned`, `story.manage_all`, `response.prepare_assigned`. |
| `description` | text nullable | Permission intent. |
| `system_permission` | boolean | Prevent deletion of required permissions. |

### `soh_lite_role_permissions`

Purpose: map roles to permissions.

| Field | Type intent | Notes |
| --- | --- | --- |
| `role_id` | uuid foreign key | References `soh_lite_roles.id`. |
| `permission_id` | uuid foreign key | References `soh_lite_permissions.id`. |
| `created_at` | timestamp | Assignment timestamp. |

Suggested composite primary key: `role_id`, `permission_id`.

### `soh_lite_membership_roles`

Purpose: assign roles to active memberships.

| Field | Type intent | Notes |
| --- | --- | --- |
| `membership_id` | uuid foreign key | References `soh_lite_memberships.id`. |
| `role_id` | uuid foreign key | References `soh_lite_roles.id`. |
| `assigned_by_user_id` | uuid nullable | Owner/admin grant source. |
| `assigned_at` | timestamp | Assignment timestamp. |
| `revoked_at` | timestamp nullable | Revocation timestamp. |

Access boundary: server-side checks must require active membership and active, unrevoked role assignment.

### `soh_lite_story_submissions`

Purpose: private story content and workflow state.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Internal id. |
| `public_reference` | text unique | Non-guessable reference for confirmation or support. |
| `organization_id` | uuid nullable foreign key | References `soh_lite_organizations.id`; nullable only if the pilot supports global intake before workspace selection. |
| `submitter_user_id` | uuid nullable foreign key | References `soh_lite_users.id` when an authenticated customer submits. |
| `title` | text nullable | Optional short title or admin label. |
| `story_body` | text | Private story text. |
| `hope_summary` | text nullable | Optional reviewer-created short summary; never public by default. |
| `source` | enum | `public_form`, `admin_entry`, `imported_test_fixture`. |
| `review_status` | enum | `new`, `in_review`, `needs_follow_up`, `approved_for_response`, `response_prepared`, `closed`, `deleted`. |
| `privacy_status` | enum | `private`, `restricted`, `redacted`, `deleted`. |
| `submitted_at` | timestamp | Submission timestamp. |
| `created_at` | timestamp | Creation timestamp. |
| `updated_at` | timestamp | Last update timestamp. |
| `deleted_at` | timestamp nullable | Soft deletion marker. |

Privacy: never public by default. Story body must not be written to operational logs, audit details, health checks, Super Admin status, issue bodies, or follow-up task text.

### `soh_lite_story_contacts`

Purpose: contact details separated from story body.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Contact id. |
| `story_submission_id` | uuid foreign key | References `soh_lite_story_submissions.id`. |
| `preferred_name` | text nullable | Name the story sharer chooses to provide. |
| `email` | text nullable | Contact email when provided. |
| `phone` | text nullable | Contact phone when provided; optional for MVP. |
| `preferred_contact_method` | enum nullable | `email`, `phone`, `none`. |
| `safe_to_contact` | boolean | Must be explicit, default false unless consent grants it. |
| `created_at` | timestamp | Creation timestamp. |
| `updated_at` | timestamp | Last update timestamp. |
| `deleted_at` | timestamp nullable | Soft deletion marker. |

Access boundary: owner/admin may view when needed. Reviewers may view only when granted by policy. Encouragement volunteers do not receive contact data by default.

### `soh_lite_story_consents`

Purpose: capture consent choices and privacy copy version at submission time.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Consent id. |
| `story_submission_id` | uuid foreign key | References `soh_lite_story_submissions.id`. |
| `privacy_copy_version` | text | Version of privacy/consent language shown. |
| `may_review` | boolean | Required for submission processing. |
| `may_contact` | boolean | Controls follow-up contact. |
| `may_prepare_encouragement` | boolean | Controls volunteer response workflow. |
| `may_share_beyond_pilot` | boolean | Default false; future full Spark of Hope reuse requires explicit consent and later integration approval. |
| `submitted_by_ip_hash` | text nullable | Optional abuse-prevention hash only, not raw IP. |
| `user_agent_hash` | text nullable | Optional abuse-prevention hash only, not raw user agent. |
| `consented_at` | timestamp | Consent timestamp. |
| `revoked_at` | timestamp nullable | Consent revocation timestamp. |

Boundary: `may_share_beyond_pilot` does not itself create integration permission. It only records consent eligibility for a later approved integration.

### `soh_lite_review_assignments`

Purpose: assign story review work to owner/admin/reviewer memberships.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Assignment id. |
| `story_submission_id` | uuid foreign key | References `soh_lite_story_submissions.id`. |
| `assigned_to_membership_id` | uuid foreign key | References `soh_lite_memberships.id`. |
| `assigned_by_user_id` | uuid nullable | Owner/admin/reviewer assignment source. |
| `status` | enum | `assigned`, `accepted`, `completed`, `revoked`. |
| `assigned_at` | timestamp | Assignment timestamp. |
| `completed_at` | timestamp nullable | Completion timestamp. |
| `revoked_at` | timestamp nullable | Revocation timestamp. |

Access boundary: assigned reviewers can read assigned submissions and write review notes/status only within granted permissions.

### `soh_lite_story_reviews`

Purpose: review notes, decision metadata, and reviewer outcome.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Review id. |
| `story_submission_id` | uuid foreign key | References `soh_lite_story_submissions.id`. |
| `reviewer_membership_id` | uuid foreign key | References `soh_lite_memberships.id`. |
| `decision` | enum | `needs_more_review`, `ready_for_response`, `close_without_response`, `delete_or_redact`. |
| `review_notes` | text nullable | Private admin/reviewer notes; not visible to volunteers by default. |
| `created_at` | timestamp | Creation timestamp. |
| `updated_at` | timestamp | Last update timestamp. |

Privacy: notes may contain sensitive judgement context and must stay admin/reviewer-only unless a later policy grants narrower visibility.

### `soh_lite_encouragement_responses`

Purpose: response draft and preparation workflow.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Response id. |
| `story_submission_id` | uuid foreign key | References `soh_lite_story_submissions.id`. |
| `created_by_membership_id` | uuid foreign key | Creator membership. |
| `assigned_to_membership_id` | uuid nullable foreign key | Volunteer or reviewer assigned to prepare it. |
| `status` | enum | `draft`, `needs_review`, `approved`, `prepared`, `sent_elsewhere`, `closed`. |
| `response_body` | text | Encouragement draft or prepared response. |
| `delivery_channel` | enum nullable | `admin_manual`, `email_planned`, `phone_planned`, `none`. MVP should not send automatically unless later approved. |
| `created_at` | timestamp | Creation timestamp. |
| `updated_at` | timestamp | Last update timestamp. |
| `prepared_at` | timestamp nullable | Prepared timestamp. |

Boundary: MVP prepares encouragement; it does not require automated email/SMS delivery. If later automation is added, provider/cost and release gates must approve it.

### `soh_lite_response_assignments`

Purpose: track response preparation assignments separately from review assignments.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Assignment id. |
| `encouragement_response_id` | uuid foreign key | References `soh_lite_encouragement_responses.id`. |
| `assigned_to_membership_id` | uuid foreign key | Volunteer or reviewer membership. |
| `assigned_by_user_id` | uuid nullable | Owner/admin/reviewer assignment source. |
| `status` | enum | `assigned`, `accepted`, `completed`, `revoked`. |
| `assigned_at` | timestamp | Assignment timestamp. |
| `completed_at` | timestamp nullable | Completion timestamp. |
| `revoked_at` | timestamp nullable | Revocation timestamp. |

Access boundary: volunteers can read only assigned response work and minimum necessary story context.

### `soh_lite_status_events`

Purpose: normalized workflow status history for story, review, response, assignment, and membership state changes.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Event id. |
| `entity_type` | enum | `story_submission`, `review_assignment`, `story_review`, `encouragement_response`, `response_assignment`, `membership`. |
| `entity_id` | uuid | Referenced entity id. |
| `from_status` | text nullable | Previous status. |
| `to_status` | text | New status. |
| `actor_user_id` | uuid nullable | Acting user when authenticated. |
| `actor_membership_id` | uuid nullable | Acting membership when applicable. |
| `reason_code` | text nullable | Machine-friendly reason. |
| `safe_summary` | text nullable | Short private-safe summary with no story body/contact values. |
| `created_at` | timestamp | Event timestamp. |

Privacy: safe summaries must avoid story text, contact values, secrets, and raw request payloads.

### `soh_lite_audit_events`

Purpose: security and administrative audit trail.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Audit event id. |
| `organization_id` | uuid nullable foreign key | Organization boundary. |
| `actor_user_id` | uuid nullable | Acting user when authenticated. |
| `actor_membership_id` | uuid nullable | Acting membership when applicable. |
| `action` | text | Example: `story.created`, `story.status_changed`, `role.granted`. |
| `target_type` | text | Audited entity type. |
| `target_id` | uuid nullable | Audited entity id. |
| `risk_level` | enum | `low`, `medium`, `high`. |
| `safe_metadata` | jsonb nullable | IDs, status values, and policy decisions only. |
| `created_at` | timestamp | Event timestamp. |

Privacy: do not store story body, contact values, provider tokens, session secrets, API keys, raw headers, raw IPs, or raw user agents in audit metadata.

### `soh_lite_export_requests`

Purpose: track owner/admin or story-sharer export requests without exposing private data in logs.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Export request id. |
| `organization_id` | uuid nullable foreign key | Organization boundary. |
| `story_submission_id` | uuid nullable foreign key | Specific story export when requested. |
| `requested_by_user_id` | uuid nullable | Requesting user. |
| `requested_by_contact_email` | text nullable | Public story sharer email for manual verification if no account exists. |
| `status` | enum | `requested`, `verified`, `prepared`, `completed`, `denied`, `expired`. |
| `export_scope` | enum | `single_story`, `organization_admin`, `audit_only`. |
| `expires_at` | timestamp nullable | Expiration for prepared export. |
| `created_at` | timestamp | Request timestamp. |
| `completed_at` | timestamp nullable | Completion timestamp. |

Boundary: exported files, if later implemented, must be short-lived, protected, and excluded from public URLs. This plan does not create export files.

### `soh_lite_deletion_requests`

Purpose: track deletion, redaction, and consent revocation requests.

| Field | Type intent | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Request id. |
| `organization_id` | uuid nullable foreign key | Organization boundary. |
| `story_submission_id` | uuid foreign key | Story targeted for deletion/redaction. |
| `requested_by_user_id` | uuid nullable | Requesting user when authenticated. |
| `requested_by_contact_email` | text nullable | Public story sharer email for manual verification if no account exists. |
| `request_type` | enum | `delete_story`, `redact_contact`, `revoke_consent`, `delete_account_link`. |
| `status` | enum | `requested`, `verified`, `completed`, `denied`. |
| `verified_by_user_id` | uuid nullable | Owner/admin verifier. |
| `completed_by_user_id` | uuid nullable | Owner/admin completer. |
| `created_at` | timestamp | Request timestamp. |
| `completed_at` | timestamp nullable | Completion timestamp. |

Deletion boundary: story deletion should soft-delete first, then hard-delete or anonymize according to retention and backup limits defined before production.

## Suggested Permission Matrix

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

## Access Boundary Rules

- Public story sharers can create submissions but do not receive protected access by submitting a story.
- Authenticated customers can access only their own story status and export/deletion requests when customer workspace is enabled.
- Reviewers can access assigned stories or authorized review queues according to permissions.
- Encouragement volunteers can access assigned response tasks and minimum necessary story context only.
- Volunteers do not receive contact details by default.
- Only owners/admins can manage memberships, grant roles, revoke roles, complete deletion requests, prepare admin exports, view broad audit logs, or change retention settings.
- Super Admin surfaces expose operational metadata, health, deployment, logs/status links, incidents, users/admin status, and billing/status as `not_applicable`; they do not expose story content.

## Retention Plan

- Default pilot retention should be conservative and explicit before implementation, with an app-level default such as 180 days for story submissions unless owner/admin policy chooses a shorter value.
- Contact details should have equal or shorter retention than the story body.
- Audit/status events may be retained longer for accountability, but must contain private-safe metadata only.
- Export files, if later implemented, should expire quickly and be deleted automatically.
- Deleted stories should be hidden immediately from workflow queues through `deleted_at` and `privacy_status = deleted`.
- Hard deletion or anonymization timing must be documented before production because database backups may preserve deleted rows temporarily.

## Deletion And Redaction Plan

- Story sharers must have a documented way to request story deletion, contact redaction, or consent revocation.
- Public deletion requests require manual verification when no authenticated customer account exists.
- Deletion should remove or redact `story_body`, `hope_summary`, contact values, consent flags as appropriate, response drafts tied to the story, and unnecessary review notes.
- Audit/status events should preserve private-safe accountability metadata but must not preserve the deleted story text or contact values.
- Deletion completion should create a `soh_lite_status_events` row and a `soh_lite_audit_events` row with private-safe metadata only.

## Export Plan

- Story sharers may request an export of their story, consent record, contact values, review status summary, and prepared encouragement response if visible to them.
- Owner/admin organization exports may include workflow metadata needed for stewardship, but should exclude unrelated app data and secrets.
- Volunteer-visible exports are not planned for MVP.
- Exports must be protected, short-lived, and generated only after identity or manual verification in a later approved build phase.
- This phase does not create export files or storage.

## Rollback Plan

No migration is created in this phase. Before any later migration is applied, the build issue must define:

- Forward migration file path.
- Reverse migration or rollback procedure.
- Pre-migration backup or restore point expectation for production.
- Seed data policy using synthetic fixtures only.
- Verification query list.
- Data preservation behavior for existing preview records.
- Owner approval requirement before production migration.

Preview rollback should revert the PR, rerun checks, and reset preview data if test data was created. Production rollback remains blocked until release gate approval exists.

## Index And Constraint Notes

- Use foreign keys between organization, membership, story, assignment, response, status, and audit records where practical.
- Use `public_reference` as a non-guessable public support reference; do not expose internal ids in public confirmation screens.
- Index review queues by `organization_id`, `review_status`, `submitted_at`, and assignment.
- Index response queues by `status`, `assigned_to_membership_id`, and `updated_at`.
- Enforce unique active role assignment per membership and role.
- Prefer soft deletion plus filtered queries for workflow records; document any later hard-delete job before launch.

## Seed Data Policy

- No seed data with real people is allowed.
- Later build phases may use synthetic fixtures such as "Example Story Sharer" and "Example Reviewer" only if the issue explicitly asks for seed fixtures.
- Synthetic story text must be clearly fake and must not copy private, pastoral, medical, legal, or sensitive real-world narratives.
- Seeds must not include real emails, real phone numbers, API keys, provider tokens, passwords, OAuth secrets, session secrets, private credentials, or production URLs.

## Non-Goals

- Do not apply migrations.
- Do not provision Neon or any provider resource.
- Do not create generated app code, UI routes, API routes, health routes, or admin screens.
- Do not create seed data with real people.
- Do not create public story feeds, social sharing, payments, donations, email/SMS sending, file uploads, AI workflows, crisis response, counseling, medical, legal, or emergency support data models.
- Do not share story, identity, role, permission, contact, billing, or admin data with the full Spark of Hope product or unrelated apps without a later approved integration packet.

## Acceptance Criteria

- Ownership, retention, deletion, privacy, export, audit, and rollback notes are explicit.
- Story submissions, consent/contact, review assignments, encouragement responses, audit/status events, app-scoped memberships, roles, and permissions are defined.
- Story data stays private by default and separate from the full Spark of Hope product.
- Reviewer and volunteer data access boundaries are explicit.
- No migration is applied.
- No real user data, seed data, provider resources, UI routes, or API routes are created.

## Test And Verification Path

- Documentation verification: confirm this file includes planned tables, ownership, retention, deletion, privacy, export, audit, rollback, access boundaries, non-goals, and acceptance criteria.
- Source verification: run `SOURCE_CHECK_OFFLINE=true npm run source:check` when network is unavailable; run `npm run source:check` when network is available.
- Later build verification: migration diff must match this data model or explain deviations in the build issue and PR.
- Later identity/auth verification: route/API guards must enforce the permission matrix server-side.
- Later privacy verification: logs, health, Super Admin status, audit metadata, and follow-up tasks must not include story body or contact values.

## Recommended Next Step

Proceed to Identity/Auth planning and UI Design planning before MVP build. The first implementation task should create a migration or schema file from this plan only after provider/cost, identity/auth, and deployment environment gates are satisfied for preview work.

## Build Spec

```json
{
  "kind": "build_spec",
  "schemaVersion": 1,
  "app": {
    "name": "Spark of Hope Intake Lite",
    "slug": "spark-of-hope-intake-lite",
    "charterPath": "source-of-truth/charters/spark-of-hope-intake-lite.md",
    "architecturePath": "source-of-truth/architecture/spark-of-hope-intake-lite.md",
    "dataModelPath": "source-of-truth/data-model/spark-of-hope-intake-lite.md",
    "sourceIssue": 44,
    "targetVersion": "v1",
    "toolClassification": "direct_transformation",
    "purpose": "Help a person or church collect one hopeful story, preserve the story safely, and prepare a small encouragement response workflow.",
    "audience": ["story sharers", "church staff reviewers", "encouragement volunteers", "AppEngine owner/admin users"],
    "barrierRemoved": "Scattered, informal, or unsafe story collection and storage.",
    "needAddressed": "Trusted private story sharing, responsible review, and careful encouragement preparation.",
    "movementTowardLife": "A story can be heard and stewarded with care instead of being lost or exposed.",
    "transformationOutcome": "Hope is received responsibly and encouragement can be prepared safely.",
    "appBoundaries": [
      "Not the full Spark of Hope product.",
      "Not a public social network or testimony feed.",
      "Not a counseling, crisis response, medical, legal, or emergency support system.",
      "No cross-app story, identity, billing, role, or admin data sharing without a later approved integration."
    ]
  },
  "scope": {
    "phase": "data_model",
    "status": "completed_as_plan",
    "nextWorkflow": "identity_auth_and_ui_design_before_mvp_build",
    "tables": [
      "soh_lite_organizations",
      "soh_lite_users",
      "soh_lite_memberships",
      "soh_lite_roles",
      "soh_lite_permissions",
      "soh_lite_role_permissions",
      "soh_lite_membership_roles",
      "soh_lite_story_submissions",
      "soh_lite_story_contacts",
      "soh_lite_story_consents",
      "soh_lite_review_assignments",
      "soh_lite_story_reviews",
      "soh_lite_encouragement_responses",
      "soh_lite_response_assignments",
      "soh_lite_status_events",
      "soh_lite_audit_events",
      "soh_lite_export_requests",
      "soh_lite_deletion_requests"
    ]
  },
  "acceptanceCriteria": [
    "Ownership, retention, deletion, privacy, export, audit, and rollback notes are explicit.",
    "Story data is private by default and separate from the full Spark of Hope product.",
    "Reviewer and volunteer access boundaries are explicit.",
    "No migration is applied and no real user data is created."
  ],
  "guardrails": {
    "planningOnly": true,
    "noMigrationsApplied": true,
    "noProviderProvisioning": true,
    "noRealSeedData": true,
    "noUiOrApiImplementation": true,
    "noSecretsInOutput": true,
    "preventPurposeBleed": true
  }
}
```

## Work Breakdown

1. Identity/Auth phase: convert the role and permission matrix into server-side route/API guard requirements.
2. UI Design phase: design public intake, review, response, empty/error/loading states, and admin/Super Admin surfaces around this data boundary.
3. MVP Build phase: create migration/schema files, synthetic fixtures if approved, data access helpers, and server-side policies from this plan.
4. Testing phase: verify story privacy, assignment boundaries, deletion/export behavior, audit-safe metadata, and rollback notes.
5. Review phase: review migration safety, privacy, secrets handling, app-boundary risks, and Super Admin operational metadata before preview.

## Codex-Ready Prompt

```text
Build only the approved schema/migration portion for Spark of Hope Intake Lite from source-of-truth/data-model/spark-of-hope-intake-lite.md after loading the required source-of-truth files. Preserve the app boundary: this is not the full Spark of Hope product, story data is private by default, and reviewer/volunteer access is assignment-scoped. Create migration/schema files and synthetic fixtures only if the active issue explicitly authorizes build work. Do not provision Neon, apply migrations to a real database, create real user data, expose secrets, implement UI/API routes, deploy, or create paid resources. Include rollback notes and verification steps in the PR.
```

## Machine Artifact

```json
{
  "agent": "planner",
  "status": "completed",
  "summary": "Data Model phase completed for Spark of Hope Intake Lite as documentation only. No migrations, provider provisioning, seed data, generated app code, UI/API routes, production deployment, paid resources, or real user data were created.",
  "artifacts": [
    {
      "kind": "build_spec",
      "title": "Spark of Hope Intake Lite Data Model Plan",
      "content": {
        "schemaVersion": 1,
        "app": {
          "name": "Spark of Hope Intake Lite",
          "slug": "spark-of-hope-intake-lite",
          "charterPath": "source-of-truth/charters/spark-of-hope-intake-lite.md",
          "architecturePath": "source-of-truth/architecture/spark-of-hope-intake-lite.md",
          "dataModelPath": "source-of-truth/data-model/spark-of-hope-intake-lite.md",
          "sourceIssue": 44,
          "targetVersion": "v1",
          "toolClassification": "direct_transformation"
        },
        "decision": "proceed_to_identity_auth_and_ui_design_before_mvp_build",
        "dataBoundaries": [
          "Story data is private by default.",
          "Contact details are separated from story body.",
          "Consent is explicit and versioned.",
          "Reviewer and volunteer access is app-scoped, role-scoped, and assignment-aware.",
          "Audit/status events contain private-safe metadata only.",
          "Pilot data stays separate from the full Spark of Hope product and unrelated ecosystem apps."
        ],
        "tables": [
          "soh_lite_organizations",
          "soh_lite_users",
          "soh_lite_memberships",
          "soh_lite_roles",
          "soh_lite_permissions",
          "soh_lite_role_permissions",
          "soh_lite_membership_roles",
          "soh_lite_story_submissions",
          "soh_lite_story_contacts",
          "soh_lite_story_consents",
          "soh_lite_review_assignments",
          "soh_lite_story_reviews",
          "soh_lite_encouragement_responses",
          "soh_lite_response_assignments",
          "soh_lite_status_events",
          "soh_lite_audit_events",
          "soh_lite_export_requests",
          "soh_lite_deletion_requests"
        ],
        "guardrails": {
          "planningOnly": true,
          "noMigrationsApplied": true,
          "noProviderProvisioning": true,
          "noRealSeedData": true,
          "noUiOrApiImplementation": true,
          "noSecretsInOutput": true,
          "keepSeparateFromFullSparkOfHope": true
        }
      }
    }
  ],
  "findings": [],
  "followUpTasks": [
    {
      "title": "[spark-of-hope-intake-lite] Phase: Identity/Auth",
      "recommendedLabel": "ai:build",
      "body": "## Identity/Auth Phase: Spark of Hope Intake Lite\n\nCreate the identity_auth_plan from the charter, architecture plan, and data model plan.\n\n## Required Source Of Truth To Load\n- source-of-truth/00-why-we-build.md\n- source-of-truth/01-ecosystem-philosophy.md\n- source-of-truth/02-global-principles.md\n- source-of-truth/03-life-produces-life.md\n- source-of-truth/04-app-purpose-rules.md\n- source-of-truth/05-ecosystem-design-gates.md\n- source-of-truth/charters/spark-of-hope-intake-lite.md\n- source-of-truth/architecture/spark-of-hope-intake-lite.md\n- source-of-truth/data-model/spark-of-hope-intake-lite.md\n- source-of-truth/identity-auth-standard.md\n- source-of-truth/super-admin-registry.md\n- agents/manifest.yaml\n- agents/context/output-contracts.md\n\n## Phase Goal\nDefine Auth.js provider behavior, session strategy, identity objects, app-scoped memberships, roles, permissions, protected route/API matrix, local setup behavior, and production auth gates for owner, admin, customer, reviewer, and encouragement volunteer access.\n\n## Acceptance Criteria\n- Each protected page and API route has required roles and permissions.\n- Server-side checks are required for all protected and mutating surfaces.\n- Public story sharing remains unprivileged unless the phase explicitly changes that with a reason.\n- Owner/admin role grant and revoke boundaries are documented.\n- Reviewer and volunteer access follows the data model assignment boundaries.\n- No secrets or OAuth credential values are included.\n\n## Guardrails\nDo not implement auth code unless the active issue explicitly asks for build work; do not create production bypasses or cross-app identity sharing."
    },
    {
      "title": "[spark-of-hope-intake-lite] Phase: MVP Schema Build",
      "recommendedLabel": "ai:build",
      "body": "## MVP Schema Build Phase: Spark of Hope Intake Lite\n\nCreate the first migration/schema files from the approved data model after Identity/Auth and provider/deployment gates are satisfied for preview work.\n\n## Required Source Of Truth To Load\n- source-of-truth/00-why-we-build.md\n- source-of-truth/01-ecosystem-philosophy.md\n- source-of-truth/02-global-principles.md\n- source-of-truth/03-life-produces-life.md\n- source-of-truth/04-app-purpose-rules.md\n- source-of-truth/05-ecosystem-design-gates.md\n- source-of-truth/charters/spark-of-hope-intake-lite.md\n- source-of-truth/architecture/spark-of-hope-intake-lite.md\n- source-of-truth/data-model/spark-of-hope-intake-lite.md\n- source-of-truth/identity-auth-standard.md\n- source-of-truth/deployment-environment-standard.md\n- source-of-truth/release-gate-standard.md\n- agents/manifest.yaml\n- agents/context/output-contracts.md\n\n## Phase Goal\nTranslate the approved data model into migration/schema files and synthetic fixtures only. Include rollback notes and verification queries.\n\n## Acceptance Criteria\n- Migration/schema files match the data model or document approved deviations.\n- Story/contact/consent/review/response/audit/status/membership/role/permission tables are represented.\n- Rollback notes and verification queries are included.\n- No real user data, real story data, secrets, production deployment, or provider provisioning occurs.\n\n## Guardrails\nDo not apply migrations to a real database, provision Neon, create paid resources, implement UI/API routes, expose secrets, or merge generated app code without review."
    }
  ],
  "handoffTo": ["builder", "designer"]
}
```
