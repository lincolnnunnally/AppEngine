// The generated-app BASE schema — the NextAuth adapter tables plus the shared
// app tables (profiles/orgs/projects/requests/notifications/audits) every
// generated app ships with. Lives in its own file (like foundation-modules.ts)
// so app-generator.ts stays legible AND so smoke-modules-registry.js can import
// the real text and type-check the fully composed schema (base + foundation +
// modules) without regex-scraping generator source.

export function baseSchemaSql(): string {
  return `create extension if not exists pgcrypto;

create table if not exists verification_token (
  identifier text not null,
  expires timestamptz not null,
  token text not null,
  primary key (identifier, token)
);

-- Identity type decision (T12, 2026-07-10): user identity is uuid EVERYWHERE in
-- a generated app. users.id is uuid (gen_random_uuid()); every user FK — these
-- base tables and every module's schemaSql — is uuid to match. @auth/pg-adapter
-- never writes an explicit id, so the column default mints it and NextAuth
-- carries it as a string. Do not reintroduce serial/integer user ids: the
-- modules-registry smoke fails any FK whose type-family differs from its target.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name varchar(255),
  email varchar(255) unique,
  "emailVerified" timestamptz,
  image text
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references users(id) on delete cascade,
  type varchar(255) not null,
  provider varchar(255) not null,
  "providerAccountId" varchar(255) not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  id_token text,
  scope text,
  session_state text,
  token_type text
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references users(id) on delete cascade,
  expires timestamptz not null,
  "sessionToken" varchar(255) not null unique
);

create table if not exists app_user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references users(id) on delete cascade,
  role text not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(auth_user_id)
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

create table if not exists app_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  name text not null,
  summary text,
  customer_goal text,
  status text not null default 'planned',
  readiness_score integer not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, name)
);

create table if not exists app_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  description text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists app_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'medium',
  acceptance_criteria jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  task_id uuid references app_tasks(id) on delete set null,
  agent_name text not null,
  status text not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  task_id uuid references app_tasks(id) on delete set null,
  agent_run_id uuid references agent_runs(id) on delete set null,
  artifact_type text not null,
  title text not null,
  content text,
  uri text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists qa_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  task_id uuid references app_tasks(id) on delete set null,
  title text not null,
  status text not null default 'pending',
  severity text not null default 'medium',
  details text,
  reproduction_steps jsonb not null default '[]'::jsonb,
  evidence_artifact_id uuid references artifacts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  provider text not null default 'vercel',
  environment text not null default 'preview',
  status text not null default 'queued',
  url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists customer_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  created_by_user_id uuid references users(id) on delete set null,
  title text not null,
  summary text,
  priority text not null default 'medium',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique(organization_id, title)
);

create table if not exists subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price text not null,
  audience text,
  includes jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  title text not null,
  body text not null,
  channel text not null default 'in-app',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(organization_id, title)
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  actor_user_id uuid references users(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx on users(email);
create index if not exists accounts_user_idx on accounts("userId");
create index if not exists accounts_provider_account_idx on accounts(provider, "providerAccountId");
create index if not exists sessions_user_idx on sessions("userId");

-- Ops reporting: a join timestamp so the owner dashboard can show new-user growth
-- (who joined this week vs last). Added by ALTER, not in the CREATE, so it applies
-- uniformly to apps built before this shipped. Existing rows stay NULL (join date
-- unknown) instead of backfilling to now() — that would fake a "everyone joined
-- this week" spike. New sign-ups get now() via the default. NextAuth's pg-adapter
-- never sets this column, so the default always fills it.
alter table users add column if not exists created_at timestamptz;
alter table users alter column created_at set default now();
create index if not exists users_created_at_idx on users(created_at);
create index if not exists app_user_profiles_role_idx on app_user_profiles(role);
create index if not exists organizations_owner_idx on organizations(owner_user_id);
create index if not exists organization_memberships_user_idx on organization_memberships(user_id);
create index if not exists app_projects_org_status_idx on app_projects(organization_id, status);
create index if not exists app_tasks_project_status_idx on app_tasks(project_id, status);
create index if not exists agent_runs_project_status_idx on agent_runs(project_id, status);
create index if not exists artifacts_project_type_idx on artifacts(project_id, artifact_type);
create index if not exists qa_checks_project_status_idx on qa_checks(project_id, status);
create index if not exists deployments_project_environment_idx on deployments(project_id, environment);
create index if not exists customer_requests_org_status_idx on customer_requests(organization_id, status);
create index if not exists notifications_org_read_idx on notifications(organization_id, read_at);
create index if not exists audit_events_org_idx on audit_events(organization_id, created_at desc);
`;
}
