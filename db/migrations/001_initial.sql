create extension if not exists pgcrypto;

create table verification_token (
  identifier text not null,
  expires timestamptz not null,
  token text not null,
  primary key (identifier, token)
);

create table users (
  id serial primary key,
  name varchar(255),
  email varchar(255),
  "emailVerified" timestamptz,
  image text
);

create table accounts (
  id serial primary key,
  "userId" integer not null references users(id) on delete cascade,
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

create table sessions (
  id serial primary key,
  "userId" integer not null references users(id) on delete cascade,
  expires timestamptz not null,
  "sessionToken" varchar(255) not null unique
);

create table app_user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id integer not null references users(id) on delete cascade,
  role text not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(auth_user_id)
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id integer references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

create table app_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  name text not null,
  idea text not null,
  target_customer text,
  problem_statement text,
  revenue_model text,
  app_type text,
  build_target text,
  recommended_target text,
  readiness_score integer not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  status text not null default 'draft',
  created_by_user_id integer references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  description text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table project_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  template_id uuid not null references app_templates(id) on delete cascade,
  selected_reason text,
  created_at timestamptz not null default now(),
  unique(project_id, template_id)
);

create table agent_roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  purpose text not null,
  default_model text,
  system_prompt text not null,
  created_at timestamptz not null default now()
);

create table app_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  agent_role_id uuid references agent_roles(id),
  title text not null,
  description text not null,
  status text not null default 'todo',
  priority text not null default 'medium',
  acceptance_criteria jsonb not null default '[]'::jsonb,
  depends_on uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  task_id uuid references app_tasks(id) on delete set null,
  agent_role_id uuid references agent_roles(id),
  status text not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table artifacts (
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

create table qa_checks (
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

create table deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_projects(id) on delete cascade,
  provider text not null default 'vercel',
  environment text not null default 'preview',
  status text not null default 'queued',
  url text,
  commit_sha text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references app_projects(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  actor_user_id integer references users(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index users_email_idx on users(email);
create index accounts_user_idx on accounts("userId");
create index accounts_provider_account_idx on accounts(provider, "providerAccountId");
create index sessions_user_idx on sessions("userId");
create index app_user_profiles_role_idx on app_user_profiles(role);
create index organization_memberships_user_idx on organization_memberships(user_id);
create index app_projects_org_status_idx on app_projects(organization_id, status);
create index app_tasks_project_status_idx on app_tasks(project_id, status);
create index agent_runs_project_status_idx on agent_runs(project_id, status);
create index artifacts_project_type_idx on artifacts(project_id, artifact_type);
create index qa_checks_project_status_idx on qa_checks(project_id, status);
create index deployments_project_environment_idx on deployments(project_id, environment);
create index audit_events_project_idx on audit_events(project_id, created_at desc);
create index project_templates_project_idx on project_templates(project_id);
