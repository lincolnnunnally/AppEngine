-- Spark of Hope MVP v0.1 public theme feed.
-- Apply to the shared Life Produces Life Supabase DEV project after 001-004.
-- This file is intentionally not wired into npm run db:setup, which targets the App Engine database.

do $$
begin
  if to_regclass('public.testimony') is null then
    raise exception 'Spark of Hope public theme feed requires public.testimony from TASK-003 shared identity schema.';
  end if;

  if to_regclass('public.testimony_encouragement') is null then
    raise exception 'Spark of Hope public theme feed requires public.testimony_encouragement from 001_spark_of_hope_mvp.sql.';
  end if;
end $$;

alter table public.testimony
  add column if not exists needs_categories text[] not null default '{}';

create index if not exists testimony_spark_needs_categories_idx
  on public.testimony using gin (needs_categories)
  where kind = 'spark_of_hope_story'
    and visibility = 'public'
    and is_approved = true;

grant select (
  id,
  content,
  kind,
  visibility,
  needs_categories,
  is_approved,
  is_anonymous,
  created_at
) on public.testimony to anon;

grant select (
  id,
  testimony_id,
  note,
  is_approved,
  created_at
) on public.testimony_encouragement to anon;

drop policy if exists testimony_read_public_approved_spark on public.testimony;
drop policy if exists testimony_encouragement_read_public_approved_spark on public.testimony_encouragement;

create policy testimony_read_public_approved_spark
  on public.testimony
  for select
  to anon
  using (
    kind = 'spark_of_hope_story'
    and visibility = 'public'
    and is_approved = true
  );

create policy testimony_encouragement_read_public_approved_spark
  on public.testimony_encouragement
  for select
  to anon
  using (
    (note is null or is_approved)
    and exists (
      select 1
      from public.testimony t
      where t.id = testimony_encouragement.testimony_id
        and t.kind = 'spark_of_hope_story'
        and t.visibility = 'public'
        and t.is_approved = true
    )
  );

comment on column public.testimony.needs_categories is
  'Harvested need/theme tags used by Spark of Hope to match testimonies to what a reader is carrying.';

-- Verification:
-- select column_name from information_schema.columns where table_schema = 'public' and table_name = 'testimony' and column_name = 'needs_categories';
-- select policyname, roles, cmd from pg_policies where schemaname = 'public' and tablename in ('testimony', 'testimony_encouragement') and policyname like '%public%approved%spark%';
