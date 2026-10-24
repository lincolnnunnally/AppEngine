-- NOT APPLIED. Do not run this file against production from the app.
--
-- Name, church name, and city search on the directory list uses pg_trgm.
-- The extension lives in the extensions schema. Index files 012j, 012k, and
-- 012l qualify extensions.gin_trgm_ops. Run this before those indexes.
-- It is not CREATE INDEX CONCURRENTLY.
-- If pg_trgm is already installed in another schema, this moves it.

create schema if not exists extensions;

do $$
declare
  ext_schema text;
begin
  select n.nspname into ext_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';
  if ext_schema is null then
    execute 'create extension pg_trgm with schema extensions';
  elsif ext_schema is distinct from 'extensions' then
    execute 'alter extension pg_trgm set schema extensions';
  end if;
end $$;
