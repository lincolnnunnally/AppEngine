-- Spark of Hope MVP v0.1 shared Supabase extension.
-- Apply to the shared Life Produces Life Supabase DEV project first.
-- This file is intentionally not wired into npm run db:setup, which targets the App Engine database.

do $$
begin
  if to_regclass('public.person') is null then
    raise exception 'Spark of Hope MVP requires public.person from TASK-003 shared identity schema.';
  end if;

  if to_regclass('public.testimony') is null then
    raise exception 'Spark of Hope MVP requires public.testimony from TASK-003 shared identity schema.';
  end if;

  if to_regprocedure('private.current_person_id()') is null then
    raise exception 'Spark of Hope MVP requires private.current_person_id() from TASK-003 shared identity schema.';
  end if;
end $$;

create table if not exists public.testimony_encouragement (
  id uuid primary key default gen_random_uuid(),
  testimony_id uuid not null references public.testimony(id) on delete cascade,
  person_id uuid not null references public.person(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  constraint testimony_encouragement_note_length check (note is null or char_length(note) <= 220),
  constraint testimony_encouragement_unique_person unique (testimony_id, person_id)
);

create index if not exists testimony_encouragement_testimony_created_idx
  on public.testimony_encouragement (testimony_id, created_at desc);

create index if not exists testimony_encouragement_person_idx
  on public.testimony_encouragement (person_id);

alter table public.testimony_encouragement enable row level security;

revoke all on public.testimony_encouragement from anon;
revoke all on public.testimony_encouragement from authenticated;
grant select, insert, update, delete on public.testimony_encouragement to authenticated;
grant all on public.testimony_encouragement to service_role;

drop policy if exists testimony_encouragement_read on public.testimony_encouragement;
drop policy if exists testimony_encouragement_insert_own on public.testimony_encouragement;
drop policy if exists testimony_encouragement_update_own on public.testimony_encouragement;
drop policy if exists testimony_encouragement_delete_own on public.testimony_encouragement;

create policy testimony_encouragement_read
  on public.testimony_encouragement
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.testimony t
      where t.id = testimony_encouragement.testimony_id
        and (
          t.person_id = (select private.current_person_id())
          or t.visibility = 'public'
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
          or (select private.is_ecosystem_owner())
        )
    )
  );

create policy testimony_encouragement_insert_own
  on public.testimony_encouragement
  for insert
  to authenticated
  with check (
    person_id = (select private.current_person_id())
    and exists (
      select 1
      from public.testimony t
      where t.id = testimony_encouragement.testimony_id
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
  );

create policy testimony_encouragement_update_own
  on public.testimony_encouragement
  for update
  to authenticated
  using (person_id = (select private.current_person_id()))
  with check (person_id = (select private.current_person_id()));

create policy testimony_encouragement_delete_own
  on public.testimony_encouragement
  for delete
  to authenticated
  using (person_id = (select private.current_person_id()));

comment on table public.testimony_encouragement is
  'Spark of Hope MVP v0.1 encouragements on shared testimonies; one encouragement per person per testimony.';

-- Verification:
-- select relname, relrowsecurity from pg_class where relname = 'testimony_encouragement';
-- select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'testimony_encouragement';
