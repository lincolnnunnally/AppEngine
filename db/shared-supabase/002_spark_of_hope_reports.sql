-- Spark of Hope MVP v0.1 safety report records.
-- Apply to the shared Life Produces Life Supabase DEV project first, after 001_spark_of_hope_mvp.sql.
-- This file is intentionally not wired into npm run db:setup, which targets the App Engine database.

do $$
begin
  if to_regclass('public.person') is null then
    raise exception 'Spark of Hope reports require public.person from TASK-003 shared identity schema.';
  end if;

  if to_regclass('public.testimony') is null then
    raise exception 'Spark of Hope reports require public.testimony from TASK-003 shared identity schema.';
  end if;

  if to_regclass('public.testimony_encouragement') is null then
    raise exception 'Spark of Hope reports require public.testimony_encouragement from 001_spark_of_hope_mvp.sql.';
  end if;

  if to_regprocedure('private.current_person_id()') is null then
    raise exception 'Spark of Hope reports require private.current_person_id() from TASK-003 shared identity schema.';
  end if;
end $$;

create table if not exists public.testimony_report (
  id uuid primary key default gen_random_uuid(),
  testimony_id uuid not null references public.testimony(id) on delete cascade,
  encouragement_id uuid references public.testimony_encouragement(id) on delete cascade,
  reporter_person_id uuid not null references public.person(id) on delete cascade,
  reason text not null default 'reported_by_reader',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint testimony_report_reason_length check (char_length(reason) between 3 and 120),
  constraint testimony_report_status_check check (status in ('new', 'reviewing', 'resolved', 'dismissed'))
);

create index if not exists testimony_report_testimony_created_idx
  on public.testimony_report (testimony_id, created_at desc);

create index if not exists testimony_report_encouragement_idx
  on public.testimony_report (encouragement_id)
  where encouragement_id is not null;

create index if not exists testimony_report_reporter_created_idx
  on public.testimony_report (reporter_person_id, created_at desc);

create index if not exists testimony_report_status_created_idx
  on public.testimony_report (status, created_at desc);

alter table public.testimony_report enable row level security;

revoke all on public.testimony_report from anon;
revoke all on public.testimony_report from authenticated;
grant insert on public.testimony_report to authenticated;
grant all on public.testimony_report to service_role;

drop policy if exists testimony_report_insert_own_visible_target on public.testimony_report;

create policy testimony_report_insert_own_visible_target
  on public.testimony_report
  for insert
  to authenticated
  with check (
    reporter_person_id = (select private.current_person_id())
    and exists (
      select 1
      from public.testimony t
      where t.id = testimony_report.testimony_id
        and (
          t.visibility = 'public'
          or t.person_id = (select private.current_person_id())
          or (
            t.visibility = 'org'
            and t.organization_id is not null
            and (select private.is_org_member(t.organization_id))
          )
          or (
            t.visibility = 'group'
            and t.group_id is not null
            and (select private.is_group_member(t.group_id))
          )
        )
    )
    and (
      encouragement_id is null
      or exists (
        select 1
        from public.testimony_encouragement e
        where e.id = testimony_report.encouragement_id
          and e.testimony_id = testimony_report.testimony_id
      )
    )
  );

comment on table public.testimony_report is
  'Spark of Hope MVP v0.1 reader safety flags for testimonies and encouragement notes.';

-- Verification:
-- select relname, relrowsecurity from pg_class where relname = 'testimony_report';
-- select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'testimony_report';
