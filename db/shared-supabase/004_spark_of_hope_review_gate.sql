-- Spark of Hope MVP v0.1 review-gate hardening.
-- Apply to the shared Life Produces Life Supabase DEV project after 001-003.
-- This file is intentionally not wired into npm run db:setup, which targets the App Engine database.

do $$
begin
  if to_regclass('public.person') is null then
    raise exception 'Spark of Hope review gate requires public.person from TASK-003 shared identity schema.';
  end if;

  if to_regclass('public.testimony') is null then
    raise exception 'Spark of Hope review gate requires public.testimony from TASK-003 shared identity schema.';
  end if;

  if to_regclass('public.testimony_encouragement') is null then
    raise exception 'Spark of Hope review gate requires public.testimony_encouragement from 001_spark_of_hope_mvp.sql.';
  end if;

  if to_regclass('public.person_consent') is null then
    raise exception 'Spark of Hope review gate requires public.person_consent from TASK-003 shared identity schema.';
  end if;

  if to_regprocedure('private.current_person_id()') is null then
    raise exception 'Spark of Hope review gate requires private.current_person_id() from TASK-003 shared identity schema.';
  end if;
end $$;

alter table public.testimony
  add column if not exists is_approved boolean not null default false,
  add column if not exists is_anonymous boolean not null default true;

create index if not exists testimony_spark_approved_created_idx
  on public.testimony (created_at desc)
  where kind = 'spark_of_hope_story'
    and visibility = 'public'
    and is_approved = true;

alter table public.testimony_encouragement
  add column if not exists is_approved boolean not null default false;

alter table public.person_consent
  drop constraint if exists person_consent_scope_check;

alter table public.person_consent
  add constraint person_consent_scope_check
  check (
    scope = any (
      array[
        'ai_matching'::text,
        'care_team'::text,
        'aggregate_reporting'::text,
        'testimony_sharing'::text,
        'spark_story_share_v0_1'::text
      ]
    )
  );

revoke all on public.testimony_encouragement from anon;
revoke all on public.testimony_encouragement from authenticated;
grant select, insert, delete on public.testimony_encouragement to authenticated;
grant update (note) on public.testimony_encouragement to authenticated;
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
    person_id = (select private.current_person_id())
    or (
      (note is null or is_approved)
      and exists (
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
    )
  );

create policy testimony_encouragement_insert_own
  on public.testimony_encouragement
  for insert
  to authenticated
  with check (
    person_id = (select private.current_person_id())
    and is_approved = false
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
  with check (
    person_id = (select private.current_person_id())
    and is_approved = false
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

create policy testimony_encouragement_delete_own
  on public.testimony_encouragement
  for delete
  to authenticated
  using (person_id = (select private.current_person_id()));

comment on column public.testimony.is_approved is
  'Spark of Hope safety gate: stories stay private until explicitly approved for public feed use.';

comment on column public.testimony.is_anonymous is
  'Spark of Hope dignity gate: public story cards default to an anonymous author label.';

comment on column public.testimony_encouragement.is_approved is
  'Spark of Hope note safety gate: encouragement notes are private to the writer until approved.';

comment on constraint person_consent_scope_check on public.person_consent is
  'Allowed shared consent scopes, including Spark of Hope v0.1 story sharing consent.';

-- Verification:
-- select column_name from information_schema.columns where table_schema = 'public' and table_name = 'testimony' and column_name in ('is_approved', 'is_anonymous');
-- select column_name from information_schema.columns where table_schema = 'public' and table_name = 'testimony_encouragement' and column_name = 'is_approved';
-- select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'testimony_encouragement';
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'person_consent_scope_check';
