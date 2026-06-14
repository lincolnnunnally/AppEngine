-- Spark of Hope Intake Lite generated-app schema.
-- Review-only migration slice for issue #54. Do not apply to production from an
-- agent workflow. This file is not wired into npm run db:setup.

create extension if not exists pgcrypto;

create table if not exists soh_lite_organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  retention_days integer check (retention_days is null or retention_days > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists soh_lite_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text unique,
  email_normalized text unique,
  display_name text,
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists soh_lite_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references soh_lite_organizations(id) on delete cascade,
  user_id uuid not null references soh_lite_users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended', 'revoked')),
  created_by_user_id uuid references soh_lite_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists soh_lite_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  scope text not null check (scope in ('ecosystem', 'app', 'organization')),
  description text,
  system_role boolean not null default false
);

create table if not exists soh_lite_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  system_permission boolean not null default false
);

create table if not exists soh_lite_role_permissions (
  role_id uuid not null references soh_lite_roles(id) on delete cascade,
  permission_id uuid not null references soh_lite_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists soh_lite_membership_roles (
  membership_id uuid not null references soh_lite_memberships(id) on delete cascade,
  role_id uuid not null references soh_lite_roles(id) on delete cascade,
  assigned_by_user_id uuid references soh_lite_users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (membership_id, role_id)
);

create table if not exists soh_lite_story_submissions (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null unique,
  organization_id uuid references soh_lite_organizations(id) on delete set null,
  submitter_user_id uuid references soh_lite_users(id) on delete set null,
  title text,
  story_body text not null,
  hope_summary text,
  source text not null default 'public_form' check (source in ('public_form', 'admin_entry', 'imported_test_fixture')),
  review_status text not null default 'new' check (
    review_status in (
      'new',
      'in_review',
      'needs_follow_up',
      'approved_for_response',
      'response_prepared',
      'closed',
      'deleted'
    )
  ),
  privacy_status text not null default 'private' check (privacy_status in ('private', 'restricted', 'redacted', 'deleted')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists soh_lite_story_contacts (
  id uuid primary key default gen_random_uuid(),
  story_submission_id uuid not null references soh_lite_story_submissions(id) on delete cascade,
  preferred_name text,
  email text,
  phone text,
  preferred_contact_method text check (preferred_contact_method is null or preferred_contact_method in ('email', 'phone', 'none')),
  safe_to_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists soh_lite_story_consents (
  id uuid primary key default gen_random_uuid(),
  story_submission_id uuid not null references soh_lite_story_submissions(id) on delete cascade,
  privacy_copy_version text not null,
  may_review boolean not null default false,
  may_contact boolean not null default false,
  may_prepare_encouragement boolean not null default false,
  may_share_beyond_pilot boolean not null default false,
  submitted_by_ip_hash text,
  user_agent_hash text,
  consented_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists soh_lite_review_assignments (
  id uuid primary key default gen_random_uuid(),
  story_submission_id uuid not null references soh_lite_story_submissions(id) on delete cascade,
  assigned_to_membership_id uuid not null references soh_lite_memberships(id) on delete cascade,
  assigned_by_user_id uuid references soh_lite_users(id) on delete set null,
  status text not null default 'assigned' check (status in ('assigned', 'accepted', 'completed', 'revoked')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  revoked_at timestamptz
);

create table if not exists soh_lite_story_reviews (
  id uuid primary key default gen_random_uuid(),
  story_submission_id uuid not null references soh_lite_story_submissions(id) on delete cascade,
  reviewer_membership_id uuid not null references soh_lite_memberships(id) on delete cascade,
  decision text not null check (decision in ('needs_more_review', 'ready_for_response', 'close_without_response', 'delete_or_redact')),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists soh_lite_encouragement_responses (
  id uuid primary key default gen_random_uuid(),
  story_submission_id uuid not null references soh_lite_story_submissions(id) on delete cascade,
  created_by_membership_id uuid not null references soh_lite_memberships(id) on delete cascade,
  assigned_to_membership_id uuid references soh_lite_memberships(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'approved', 'prepared', 'sent_elsewhere', 'closed')),
  response_body text not null,
  delivery_channel text check (delivery_channel is null or delivery_channel in ('admin_manual', 'email_planned', 'phone_planned', 'none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  prepared_at timestamptz
);

create table if not exists soh_lite_response_assignments (
  id uuid primary key default gen_random_uuid(),
  encouragement_response_id uuid not null references soh_lite_encouragement_responses(id) on delete cascade,
  assigned_to_membership_id uuid not null references soh_lite_memberships(id) on delete cascade,
  assigned_by_user_id uuid references soh_lite_users(id) on delete set null,
  status text not null default 'assigned' check (status in ('assigned', 'accepted', 'completed', 'revoked')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  revoked_at timestamptz
);

create table if not exists soh_lite_status_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (
    entity_type in (
      'story_submission',
      'review_assignment',
      'story_review',
      'encouragement_response',
      'response_assignment',
      'membership'
    )
  ),
  entity_id uuid not null,
  from_status text,
  to_status text not null,
  actor_user_id uuid references soh_lite_users(id) on delete set null,
  actor_membership_id uuid references soh_lite_memberships(id) on delete set null,
  reason_code text,
  safe_summary text,
  created_at timestamptz not null default now()
);

create table if not exists soh_lite_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references soh_lite_organizations(id) on delete set null,
  actor_user_id uuid references soh_lite_users(id) on delete set null,
  actor_membership_id uuid references soh_lite_memberships(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  safe_metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists soh_lite_export_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references soh_lite_organizations(id) on delete set null,
  story_submission_id uuid references soh_lite_story_submissions(id) on delete set null,
  requested_by_user_id uuid references soh_lite_users(id) on delete set null,
  requested_by_contact_email text,
  status text not null default 'requested' check (status in ('requested', 'verified', 'prepared', 'completed', 'denied', 'expired')),
  export_scope text not null check (export_scope in ('single_story', 'organization_admin', 'audit_only')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists soh_lite_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references soh_lite_organizations(id) on delete set null,
  story_submission_id uuid not null references soh_lite_story_submissions(id) on delete cascade,
  requested_by_user_id uuid references soh_lite_users(id) on delete set null,
  requested_by_contact_email text,
  request_type text not null check (request_type in ('delete_story', 'redact_contact', 'revoke_consent', 'delete_account_link')),
  status text not null default 'requested' check (status in ('requested', 'verified', 'completed', 'denied')),
  verified_by_user_id uuid references soh_lite_users(id) on delete set null,
  completed_by_user_id uuid references soh_lite_users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists soh_lite_memberships_org_status_idx
  on soh_lite_memberships(organization_id, status);

create index if not exists soh_lite_memberships_user_idx
  on soh_lite_memberships(user_id);

create index if not exists soh_lite_story_submissions_org_status_idx
  on soh_lite_story_submissions(organization_id, review_status, submitted_at desc)
  where deleted_at is null;

create index if not exists soh_lite_story_submissions_privacy_idx
  on soh_lite_story_submissions(privacy_status, submitted_at desc);

create index if not exists soh_lite_story_contacts_story_idx
  on soh_lite_story_contacts(story_submission_id)
  where deleted_at is null;

create index if not exists soh_lite_story_consents_story_idx
  on soh_lite_story_consents(story_submission_id, consented_at desc);

create index if not exists soh_lite_review_assignments_story_idx
  on soh_lite_review_assignments(story_submission_id, status);

create index if not exists soh_lite_review_assignments_assignee_idx
  on soh_lite_review_assignments(assigned_to_membership_id, status, assigned_at desc);

create index if not exists soh_lite_story_reviews_story_idx
  on soh_lite_story_reviews(story_submission_id, created_at desc);

create index if not exists soh_lite_encouragement_responses_story_idx
  on soh_lite_encouragement_responses(story_submission_id, status);

create index if not exists soh_lite_encouragement_responses_assignee_idx
  on soh_lite_encouragement_responses(assigned_to_membership_id, status, updated_at desc);

create index if not exists soh_lite_response_assignments_response_idx
  on soh_lite_response_assignments(encouragement_response_id, status);

create index if not exists soh_lite_response_assignments_assignee_idx
  on soh_lite_response_assignments(assigned_to_membership_id, status, assigned_at desc);

create index if not exists soh_lite_status_events_entity_idx
  on soh_lite_status_events(entity_type, entity_id, created_at desc);

create index if not exists soh_lite_status_events_actor_idx
  on soh_lite_status_events(actor_user_id, created_at desc);

create index if not exists soh_lite_audit_events_org_idx
  on soh_lite_audit_events(organization_id, created_at desc);

create index if not exists soh_lite_audit_events_target_idx
  on soh_lite_audit_events(target_type, target_id, created_at desc);

create index if not exists soh_lite_export_requests_story_idx
  on soh_lite_export_requests(story_submission_id, status);

create index if not exists soh_lite_deletion_requests_story_idx
  on soh_lite_deletion_requests(story_submission_id, status);
