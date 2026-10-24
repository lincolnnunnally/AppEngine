-- NOT APPLIED. Do not run this file against production from the app.
-- Owner-run and idempotent. An index that is not in pg_class is skipped.
--
-- cc_churches is about 151k rows. Five GIN indexes still have fastupdate on
-- (the default). A single-row update can take about 9 seconds when one of
-- those pending lists flushes. That is past the Supabase REST authenticator
-- role's 8s statement_timeout, so crm_patch_church_doc returns 500 during a
-- bulk import.
--
-- fastupdate = off makes later inserts maintain the main GIN structure
-- directly, instead of appending to a pending list that a later statement
-- has to flush inside the same 8s budget. Setting the parameter does not
-- itself flush a pending list already stored. The next insert into that
-- index, or vacuum, still cleans it. This file does not rebuild the index.
--
-- Indexes:
--   public.cc_churches_doc_gin
--     production jsonb GIN on doc; not created by an earlier migration
--   public.cc_churches_name_trgm_idx          (012j)
--   public.cc_churches_church_name_trgm_idx   (012k)
--   public.cc_churches_city_trgm_idx          (012l)
--   public.cc_churches_service_providers_idx  (012u)
--
-- Btree indexes, including cc_churches_service_providers_present_idx and the
-- vendor-name indexes, are not GIN and are not changed.
-- This is not CREATE INDEX CONCURRENTLY. It can run inside a transaction.
--
-- Down (do not run as part of this file). Skip any index that is missing:
--   alter index public.cc_churches_doc_gin set (fastupdate = on);
--   alter index public.cc_churches_name_trgm_idx set (fastupdate = on);
--   alter index public.cc_churches_church_name_trgm_idx set (fastupdate = on);
--   alter index public.cc_churches_city_trgm_idx set (fastupdate = on);
--   alter index public.cc_churches_service_providers_idx set (fastupdate = on);

do $$
declare
  index_name text;
  index_options text[];
begin
  foreach index_name in array array[
    'cc_churches_doc_gin',
    'cc_churches_name_trgm_idx',
    'cc_churches_church_name_trgm_idx',
    'cc_churches_city_trgm_idx',
    'cc_churches_service_providers_idx'
  ]
  loop
    index_options := null;
    select c.reloptions
      into index_options
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = index_name
       and c.relkind = 'i';
    if not found then
      raise notice 'Index public.% is missing. Skipped.', index_name;
      continue;
    end if;
    if index_options is not null and 'fastupdate=off' = any (index_options) then
      raise notice 'Index public.% already has fastupdate off.', index_name;
      continue;
    end if;
    execute format('alter index %I.%I set (fastupdate = off)', 'public', index_name);
    raise notice 'Set fastupdate=off on public.%.', index_name;
  end loop;
end $$;
