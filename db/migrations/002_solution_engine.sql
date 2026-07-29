-- Solution Engine (se_*) — the public front door for AppEngine.
--
-- Owner definition: life-produces-life/_SOURCE_OF_TRUTH/08_SOLUTION_ENGINE__OWNER_DEFINITION.md
-- Applied to the shared LPL Supabase (project uqhqulrqcygsmmzdzemx) on 2026-07-29.
-- Kept here so the schema is reproducible from the repo, not only from the dashboard.
--
-- Two rules in this file are enforced by the DATABASE, not just the app, because
-- the owner definition calls them non-negotiable:
--   * se_guard_closure  — a case cannot be closed without a human connection (§7)
--   * se_guard_delivery — a case cannot be delivered with unproven acceptance lines
--
-- Every table is RLS-on with no policies: the only way in is the service role from
-- the server. A browser holding the anon key gets nothing.

create extension if not exists pgcrypto;

-- The case is the aggregate. One person, one problem, one loop through the journey.
create table if not exists se_cases (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  state text not null default 'intake',

  contact_name text,
  contact_email text,
  contact_phone text,
  contact_channel text default 'email',
  region text,
  postal_code text,

  -- The three diagnostic layers. functional_problem and root_class are NEVER
  -- rendered to the person (§4b, "never diagnose out loud").
  stated_problem text,
  functional_problem text,
  root_class text,
  problem_class text,

  triage text,
  triage_signals jsonb not null default '{}'::jsonb,
  triage_decided_at timestamptz,

  reflection text,
  reflection_confirmed_at timestamptz,

  solution_type text,
  offer jsonb,
  offer_made_at timestamptz,
  offer_accepted_at timestamptz,
  offer_declined_at timestamptz,

  build_ref text,
  build_started_at timestamptz,
  promised_for date,
  artifact_url text,
  walkthrough_url text,
  delivered_at timestamptz,

  safety_flagged boolean not null default false,
  safety_reason text,

  intro_attempts integer not null default 0,
  closed_at timestamptz,
  paused_at timestamptz,

  exchange_count integer not null default 0,
  anon_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists se_cases_state_idx on se_cases (state);
create index if not exists se_cases_created_idx on se_cases (created_at desc);
create index if not exists se_cases_triage_idx on se_cases (triage);
create index if not exists se_cases_email_idx on se_cases (lower(contact_email));
create index if not exists se_cases_problem_class_idx on se_cases (problem_class, region);

create table if not exists se_case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references se_cases(id) on delete cascade,
  turn_index integer not null,
  role text not null,
  body text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (case_id, turn_index)
);

create index if not exists se_case_messages_case_idx on se_case_messages (case_id, turn_index);

create table if not exists se_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references se_cases(id) on delete cascade,
  from_state text,
  to_state text not null,
  reason text,
  actor text not null default 'system',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists se_case_events_case_idx on se_case_events (case_id, created_at desc);

create table if not exists se_covenants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references se_cases(id) on delete cascade,
  we_bring text[] not null default '{}',
  they_bring text not null,
  first_step text not null,
  cadence text not null default 'weekly',
  agreed_at timestamptz,
  declined_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  unique (case_id)
);

create table if not exists se_commitments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references se_cases(id) on delete cascade,
  covenant_id uuid not null references se_covenants(id) on delete cascade,
  period_index integer not null,
  description text not null,
  due_on date not null,
  status text not null default 'pending',
  responded_at timestamptz,
  note text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (covenant_id, period_index)
);

create index if not exists se_commitments_due_idx on se_commitments (due_on) where status = 'pending';

create table if not exists se_connection_pool (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  contact_email text,
  contact_phone text,
  channel text not null default 'email',
  region text,
  problem_classes text[] not null default '{}',
  stage text not null default 'one_step_ahead',
  source text not null default 'volunteer',
  story text,
  capacity integer not null default 3,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists se_connection_pool_active_idx on se_connection_pool (active, stage);

create table if not exists se_intros (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references se_cases(id) on delete cascade,
  match_id uuid references se_connection_pool(id) on delete set null,
  attempt_number integer not null default 1,
  state text not null default 'drafted',
  draft text not null,
  person_confirmed_at timestamptz,
  match_confirmed_at timestamptz,
  contact_shared_at timestamptz,
  declined_at timestamptz,
  declined_by text,
  created_at timestamptz not null default now(),
  unique (case_id, attempt_number)
);

create index if not exists se_intros_case_idx on se_intros (case_id, attempt_number desc);

create table if not exists se_followups (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references se_cases(id) on delete cascade,
  kind text not null default 'two_week',
  due_at timestamptz not null,
  sent_at timestamptz,
  answered_at timestamptz,
  still_working boolean,
  still_meeting boolean,
  testimony text,
  created_at timestamptz not null default now()
);

create index if not exists se_followups_due_idx on se_followups (due_at) where answered_at is null;

-- The durable asset (principle 3). Outlives the code it describes.
create table if not exists se_knowledge_records (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references se_cases(id) on delete cascade,
  stated_problem text,
  functional_problem text,
  root_class text,
  triage text,
  solution_type text,
  build_minutes integer,
  intake_to_delivery_hours integer,
  usage_at_two_weeks boolean,
  commitment_streak integer,
  connection_outcome text,
  testimony text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id)
);

create index if not exists se_knowledge_root_idx on se_knowledge_records (root_class);

create table if not exists se_groups (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  problem_class text not null,
  case_ids uuid[] not null default '{}',
  state text not null default 'proposed',
  logistics jsonb not null default '{}'::jsonb,
  proposed_at timestamptz not null default now(),
  unique (region, problem_class)
);

create table if not exists se_safety_escalations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references se_cases(id) on delete cascade,
  category text not null,
  detected_by text not null default 'screen',
  excerpt text,
  notified_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists se_safety_open_idx on se_safety_escalations (created_at desc) where acknowledged_at is null;

-- The first-attempt spine: what we decided instead of stopping to ask, and what
-- "finished" will mean. See src/lib/solution-engine/first-attempt.ts.
create table if not exists se_assumptions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references se_cases(id) on delete cascade,
  question text not null,
  assumed text not null,
  rationale text,
  confidence text not null default 'medium',
  status text not null default 'assumed',
  corrected_to text,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists se_assumptions_case_idx on se_assumptions (case_id, created_at);
create index if not exists se_assumptions_open_idx on se_assumptions (status) where status = 'assumed';

create table if not exists se_acceptance_checks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references se_cases(id) on delete cascade,
  step_index integer not null,
  description text not null,
  status text not null default 'pending',
  evidence text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (case_id, step_index)
);

create index if not exists se_acceptance_case_idx on se_acceptance_checks (case_id, step_index);

alter table se_cases enable row level security;
alter table se_case_messages enable row level security;
alter table se_case_events enable row level security;
alter table se_covenants enable row level security;
alter table se_commitments enable row level security;
alter table se_connection_pool enable row level security;
alter table se_intros enable row level security;
alter table se_followups enable row level security;
alter table se_knowledge_records enable row level security;
alter table se_groups enable row level security;
alter table se_safety_escalations enable row level security;
alter table se_assumptions enable row level security;
alter table se_acceptance_checks enable row level security;

-- §7: connection is in the delivery path, not bolted on. Safety-escalated cases
-- are exempt — they left the solution flow and belong to a human now (§4d).
create or replace function se_guard_closure() returns trigger
language plpgsql
as $$
begin
  if new.closed_at is not null and old.closed_at is null and new.state <> 'escalated' then
    if new.intro_attempts < 3
       and not exists (select 1 from se_intros i where i.case_id = new.id and i.state = 'accepted')
    then
      raise exception
        'se_cases %: cannot close — the connection step is not satisfied (no accepted intro, only % logged attempt(s))',
        new.id, new.intro_attempts;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists se_cases_closure_guard on se_cases;
create trigger se_cases_closure_guard
  before update on se_cases
  for each row execute function se_guard_closure();

-- Delivery is not a matter of opinion either.
create or replace function se_guard_delivery() returns trigger
language plpgsql
as $$
declare
  unproven integer;
  total integer;
begin
  if new.delivered_at is not null and old.delivered_at is null then
    select count(*) filter (where status <> 'passing'), count(*)
      into unproven, total
      from se_acceptance_checks
     where case_id = new.id;

    if total > 0 and unproven > 0 then
      raise exception
        'se_cases %: cannot deliver — % of % acceptance checks are not passing yet',
        new.id, unproven, total;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists se_cases_delivery_guard on se_cases;
create trigger se_cases_delivery_guard
  before update on se_cases
  for each row execute function se_guard_delivery();

create or replace function se_touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists se_cases_touch on se_cases;
create trigger se_cases_touch before update on se_cases
  for each row execute function se_touch_updated_at();

drop trigger if exists se_pool_touch on se_connection_pool;
create trigger se_pool_touch before update on se_connection_pool
  for each row execute function se_touch_updated_at();

drop trigger if exists se_knowledge_touch on se_knowledge_records;
create trigger se_knowledge_touch before update on se_knowledge_records
  for each row execute function se_touch_updated_at();
