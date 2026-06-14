# Spark of Hope Intake Lite Schema Slice

This folder contains reviewable generated-app database files for the MVP build phase. They are not wired into `npm run db:setup`, and this task did not apply migrations, provision Neon, create paid resources, deploy, or use real user/story data.

## Files

- `001_schema.sql`: forward Postgres schema for the approved data model.
- `002_synthetic_fixtures.sql`: fake local/preview fixtures using `example.invalid` addresses and synthetic story text.
- `999_rollback.sql`: destructive rollback for disposable local/preview databases only.

## Source Alignment

The schema follows `source-of-truth/data-model/spark-of-hope-intake-lite.md` and represents:

- story submissions, contacts, consents, review assignments, story reviews
- encouragement responses and response assignments
- audit events and status events
- organizations, users, memberships, roles, permissions, role permissions, membership roles
- export and deletion request tracking

Approved implementation choices:

- Text values with `check` constraints are used instead of Postgres enum types so review/rollback stays simple.
- `soh_lite_status_events.entity_id` is polymorphic and intentionally has no single foreign key.
- Contact details remain separated from story body.
- Audit/status metadata fields are private-safe and must not contain story text, contact values, secrets, tokens, raw headers, raw IPs, or raw user agents.

## Rollback Notes

Preview/local rollback:

1. Confirm the target database is disposable preview or local data only.
2. Run `999_rollback.sql`.
3. Re-run `001_schema.sql` and `002_synthetic_fixtures.sql` only if fixtures are still needed.
4. Re-run verification queries below.

Production rollback:

- Production remains blocked for this phase.
- Do not run these files against production from an agent workflow.
- Before any production migration is allowed, a Release Gate must record owner approval, backup or restore-point expectations, data preservation behavior, rollback order, and Super Admin status update requirements.

## Verification Queries

Run these only against a local or disposable preview database after manually applying the schema and synthetic fixtures:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'soh_lite_%'
order by table_name;

select count(*) as soh_lite_table_count
from information_schema.tables
where table_schema = 'public'
  and table_name like 'soh_lite_%';

select public_reference, review_status, privacy_status
from soh_lite_story_submissions
where source = 'imported_test_fixture';

select submissions.public_reference, contacts.email, consents.may_review, consents.may_prepare_encouragement
from soh_lite_story_submissions submissions
join soh_lite_story_contacts contacts on contacts.story_submission_id = submissions.id
join soh_lite_story_consents consents on consents.story_submission_id = submissions.id
where submissions.public_reference = 'SOH-LITE-EXAMPLE-001';

select roles.key as role_key, permissions.key as permission_key
from soh_lite_roles roles
join soh_lite_role_permissions role_permissions on role_permissions.role_id = roles.id
join soh_lite_permissions permissions on permissions.id = role_permissions.permission_id
order by roles.key, permissions.key;

select safe_summary
from soh_lite_status_events
where safe_summary ilike '%story body%'
   or safe_summary ilike '%@%';

select safe_metadata
from soh_lite_audit_events
where safe_metadata::text ilike '%story.sharer@example.invalid%'
   or safe_metadata::text ilike '%Synthetic fixture story%';
```

Expected results:

- The table count query returns `18`.
- The fixture story query returns `SOH-LITE-EXAMPLE-001` with `approved_for_response` and `private`.
- The contact/consent query returns only synthetic `example.invalid` data.
- The role/permission query shows owner/admin broad access, customer own-story access, reviewer assignment-oriented access, and volunteer response-preparation access.
- The status and audit privacy checks return zero rows.
