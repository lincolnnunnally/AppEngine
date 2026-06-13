-- Synthetic fixtures for Spark of Hope Intake Lite review.
-- These are fake records for local/preview validation only. Do not use real
-- names, real emails, real phones, real stories, secrets, or production URLs.

insert into soh_lite_organizations (id, slug, name, status, retention_days)
values (
  '10000000-0000-4000-8000-000000000001',
  'example-hope-team',
  'Example Hope Team',
  'active',
  180
)
on conflict (slug) do update
set
  name = excluded.name,
  status = excluded.status,
  retention_days = excluded.retention_days,
  updated_at = now();

insert into soh_lite_users (id, auth_user_id, email_normalized, display_name, status)
values
  ('10000000-0000-4000-8000-000000000101', 'fixture-owner', 'owner@example.invalid', 'Example Owner', 'active'),
  ('10000000-0000-4000-8000-000000000102', 'fixture-reviewer', 'reviewer@example.invalid', 'Example Reviewer', 'active'),
  ('10000000-0000-4000-8000-000000000103', 'fixture-volunteer', 'volunteer@example.invalid', 'Example Volunteer', 'active'),
  ('10000000-0000-4000-8000-000000000104', null, 'story.sharer@example.invalid', 'Example Story Sharer', 'active')
on conflict (id) do update
set
  auth_user_id = excluded.auth_user_id,
  email_normalized = excluded.email_normalized,
  display_name = excluded.display_name,
  status = excluded.status,
  updated_at = now();

insert into soh_lite_memberships (id, organization_id, user_id, status, created_by_user_id)
values
  (
    '10000000-0000-4000-8000-000000000201',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000101',
    'active',
    '10000000-0000-4000-8000-000000000101'
  ),
  (
    '10000000-0000-4000-8000-000000000202',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000102',
    'active',
    '10000000-0000-4000-8000-000000000101'
  ),
  (
    '10000000-0000-4000-8000-000000000203',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000103',
    'active',
    '10000000-0000-4000-8000-000000000101'
  ),
  (
    '10000000-0000-4000-8000-000000000204',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000104',
    'active',
    '10000000-0000-4000-8000-000000000101'
  )
on conflict (organization_id, user_id) do update
set
  status = excluded.status,
  created_by_user_id = excluded.created_by_user_id,
  updated_at = now();

insert into soh_lite_roles (key, name, scope, description, system_role)
values
  ('owner', 'Owner', 'ecosystem', 'Approves production and manages high-risk app actions.', true),
  ('admin', 'Admin', 'app', 'Manages the app workflow inside the app boundary.', true),
  ('customer', 'Customer', 'app', 'Views only their own account and submitted story status when enabled.', true),
  ('reviewer', 'Reviewer', 'organization', 'Reviews assigned or authorized story submissions.', true),
  ('encouragement_volunteer', 'Encouragement Volunteer', 'organization', 'Prepares assigned encouragement responses with limited context.', true)
on conflict (key) do update
set
  name = excluded.name,
  scope = excluded.scope,
  description = excluded.description,
  system_role = excluded.system_role;

insert into soh_lite_permissions (key, description, system_permission)
values
  ('story.create_public', 'Create a public story submission with consent.', true),
  ('story.read_own', 'Read only the current user story status.', true),
  ('story.read_assigned', 'Read assigned story context.', true),
  ('story.read_all_private', 'Read private story submissions inside the app boundary.', true),
  ('story.manage_status', 'Move an assigned or managed story through review statuses.', true),
  ('story.read_contact', 'Read contact details when policy allows it.', true),
  ('review.assign', 'Assign story review work.', true),
  ('review.write_assigned', 'Write review notes for assigned work.', true),
  ('response.prepare_assigned', 'Prepare assigned encouragement responses.', true),
  ('response.approve', 'Approve prepared encouragement responses.', true),
  ('membership.manage', 'Manage app-scoped memberships and role grants.', true),
  ('audit.read', 'Read private-safe audit and status events.', true),
  ('export.request_own', 'Request export for own story data.', true),
  ('export.prepare_admin', 'Prepare verified app-scoped exports.', true),
  ('deletion.request_own', 'Request deletion or redaction for own story data.', true),
  ('deletion.complete_admin', 'Complete verified deletion or redaction requests.', true),
  ('settings.manage', 'Manage app-scoped settings.', true),
  ('super_admin.status_read', 'Read Super Admin operational status.', true),
  ('incident.manage', 'Create and manage app incidents.', true),
  ('follow_up.create', 'Create scoped follow-up work.', true)
on conflict (key) do update
set
  description = excluded.description,
  system_permission = excluded.system_permission;

insert into soh_lite_role_permissions (role_id, permission_id)
select roles.id, permissions.id
from soh_lite_roles roles
join soh_lite_permissions permissions on permissions.key = any (
  case roles.key
    when 'owner' then array[
      'story.create_public',
      'story.read_own',
      'story.read_assigned',
      'story.read_all_private',
      'story.manage_status',
      'story.read_contact',
      'review.assign',
      'review.write_assigned',
      'response.prepare_assigned',
      'response.approve',
      'membership.manage',
      'audit.read',
      'export.request_own',
      'export.prepare_admin',
      'deletion.request_own',
      'deletion.complete_admin',
      'settings.manage',
      'super_admin.status_read',
      'incident.manage',
      'follow_up.create'
    ]
    when 'admin' then array[
      'story.create_public',
      'story.read_own',
      'story.read_assigned',
      'story.read_all_private',
      'story.manage_status',
      'story.read_contact',
      'review.assign',
      'review.write_assigned',
      'response.prepare_assigned',
      'response.approve',
      'membership.manage',
      'audit.read',
      'export.request_own',
      'export.prepare_admin',
      'deletion.request_own',
      'deletion.complete_admin',
      'settings.manage',
      'super_admin.status_read',
      'incident.manage',
      'follow_up.create'
    ]
    when 'customer' then array[
      'story.create_public',
      'story.read_own',
      'export.request_own',
      'deletion.request_own'
    ]
    when 'reviewer' then array[
      'story.read_assigned',
      'story.manage_status',
      'review.write_assigned',
      'response.prepare_assigned',
      'response.approve'
    ]
    when 'encouragement_volunteer' then array[
      'story.read_assigned',
      'response.prepare_assigned'
    ]
    else array[]::text[]
  end
)
on conflict do nothing;

insert into soh_lite_membership_roles (membership_id, role_id, assigned_by_user_id)
select membership_id, roles.id, '10000000-0000-4000-8000-000000000101'
from (
  values
    ('10000000-0000-4000-8000-000000000201'::uuid, 'owner'),
    ('10000000-0000-4000-8000-000000000202'::uuid, 'reviewer'),
    ('10000000-0000-4000-8000-000000000203'::uuid, 'encouragement_volunteer'),
    ('10000000-0000-4000-8000-000000000204'::uuid, 'customer')
) as grants(membership_id, role_key)
join soh_lite_roles roles on roles.key = grants.role_key
on conflict do nothing;

insert into soh_lite_story_submissions (
  id,
  public_reference,
  organization_id,
  submitter_user_id,
  title,
  story_body,
  hope_summary,
  source,
  review_status,
  privacy_status
)
values (
  '10000000-0000-4000-8000-000000000301',
  'SOH-LITE-EXAMPLE-001',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000104',
  'Synthetic hopeful story',
  'Synthetic fixture story: a person noticed a small moment of hope and wanted it reviewed privately by the pilot team.',
  'Synthetic private summary for review only.',
  'imported_test_fixture',
  'approved_for_response',
  'private'
)
on conflict (public_reference) do update
set
  title = excluded.title,
  story_body = excluded.story_body,
  hope_summary = excluded.hope_summary,
  source = excluded.source,
  review_status = excluded.review_status,
  privacy_status = excluded.privacy_status,
  updated_at = now();

insert into soh_lite_story_contacts (
  id,
  story_submission_id,
  preferred_name,
  email,
  phone,
  preferred_contact_method,
  safe_to_contact
)
values (
  '10000000-0000-4000-8000-000000000302',
  '10000000-0000-4000-8000-000000000301',
  'Example Story Sharer',
  'story.sharer@example.invalid',
  null,
  'email',
  true
)
on conflict (id) do update
set
  preferred_name = excluded.preferred_name,
  email = excluded.email,
  phone = excluded.phone,
  preferred_contact_method = excluded.preferred_contact_method,
  safe_to_contact = excluded.safe_to_contact,
  updated_at = now();

insert into soh_lite_story_consents (
  id,
  story_submission_id,
  privacy_copy_version,
  may_review,
  may_contact,
  may_prepare_encouragement,
  may_share_beyond_pilot,
  submitted_by_ip_hash,
  user_agent_hash
)
values (
  '10000000-0000-4000-8000-000000000303',
  '10000000-0000-4000-8000-000000000301',
  'fixture-v1',
  true,
  true,
  true,
  false,
  'fixture-ip-hash',
  'fixture-user-agent-hash'
)
on conflict (id) do update
set
  privacy_copy_version = excluded.privacy_copy_version,
  may_review = excluded.may_review,
  may_contact = excluded.may_contact,
  may_prepare_encouragement = excluded.may_prepare_encouragement,
  may_share_beyond_pilot = excluded.may_share_beyond_pilot,
  submitted_by_ip_hash = excluded.submitted_by_ip_hash,
  user_agent_hash = excluded.user_agent_hash;

insert into soh_lite_review_assignments (
  id,
  story_submission_id,
  assigned_to_membership_id,
  assigned_by_user_id,
  status
)
values (
  '10000000-0000-4000-8000-000000000401',
  '10000000-0000-4000-8000-000000000301',
  '10000000-0000-4000-8000-000000000202',
  '10000000-0000-4000-8000-000000000101',
  'completed'
)
on conflict (id) do update
set status = excluded.status;

insert into soh_lite_story_reviews (
  id,
  story_submission_id,
  reviewer_membership_id,
  decision,
  review_notes
)
values (
  '10000000-0000-4000-8000-000000000402',
  '10000000-0000-4000-8000-000000000301',
  '10000000-0000-4000-8000-000000000202',
  'ready_for_response',
  'Synthetic note: ready for a careful encouragement response.'
)
on conflict (id) do update
set
  decision = excluded.decision,
  review_notes = excluded.review_notes,
  updated_at = now();

insert into soh_lite_encouragement_responses (
  id,
  story_submission_id,
  created_by_membership_id,
  assigned_to_membership_id,
  status,
  response_body,
  delivery_channel
)
values (
  '10000000-0000-4000-8000-000000000501',
  '10000000-0000-4000-8000-000000000301',
  '10000000-0000-4000-8000-000000000202',
  '10000000-0000-4000-8000-000000000203',
  'draft',
  'Synthetic encouragement draft prepared for review.',
  'admin_manual'
)
on conflict (id) do update
set
  assigned_to_membership_id = excluded.assigned_to_membership_id,
  status = excluded.status,
  response_body = excluded.response_body,
  delivery_channel = excluded.delivery_channel,
  updated_at = now();

insert into soh_lite_response_assignments (
  id,
  encouragement_response_id,
  assigned_to_membership_id,
  assigned_by_user_id,
  status
)
values (
  '10000000-0000-4000-8000-000000000502',
  '10000000-0000-4000-8000-000000000501',
  '10000000-0000-4000-8000-000000000203',
  '10000000-0000-4000-8000-000000000101',
  'assigned'
)
on conflict (id) do update
set status = excluded.status;

insert into soh_lite_status_events (
  id,
  entity_type,
  entity_id,
  from_status,
  to_status,
  actor_user_id,
  actor_membership_id,
  reason_code,
  safe_summary
)
values (
  '10000000-0000-4000-8000-000000000601',
  'story_submission',
  '10000000-0000-4000-8000-000000000301',
  'in_review',
  'approved_for_response',
  '10000000-0000-4000-8000-000000000102',
  '10000000-0000-4000-8000-000000000202',
  'fixture_review_complete',
  'Synthetic status event without story body or contact values.'
)
on conflict (id) do nothing;

insert into soh_lite_audit_events (
  id,
  organization_id,
  actor_user_id,
  actor_membership_id,
  action,
  target_type,
  target_id,
  risk_level,
  safe_metadata
)
values (
  '10000000-0000-4000-8000-000000000602',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000102',
  '10000000-0000-4000-8000-000000000202',
  'story.status_changed',
  'story_submission',
  '10000000-0000-4000-8000-000000000301',
  'low',
  '{"fromStatus":"in_review","toStatus":"approved_for_response","fixture":true}'::jsonb
)
on conflict (id) do nothing;

insert into soh_lite_export_requests (
  id,
  organization_id,
  story_submission_id,
  requested_by_user_id,
  requested_by_contact_email,
  status,
  export_scope
)
values (
  '10000000-0000-4000-8000-000000000701',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000301',
  '10000000-0000-4000-8000-000000000104',
  'story.sharer@example.invalid',
  'requested',
  'single_story'
)
on conflict (id) do update
set status = excluded.status;

insert into soh_lite_deletion_requests (
  id,
  organization_id,
  story_submission_id,
  requested_by_user_id,
  requested_by_contact_email,
  request_type,
  status
)
values (
  '10000000-0000-4000-8000-000000000702',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000301',
  '10000000-0000-4000-8000-000000000104',
  'story.sharer@example.invalid',
  'redact_contact',
  'requested'
)
on conflict (id) do update
set status = excluded.status;
