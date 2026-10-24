-- NOT APPLIED. Do not run this file against production from the app.
-- Apply 012_crm_directory_functions.sql first.
-- Run this statement by itself. CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- After it finishes, check indisvalid:
--   select indexrelid::regclass, indisvalid
--     from pg_index
--    where indexrelid = 'public.cc_churches_service_providers_idx'::regclass;
-- indisvalid = false means the index is not usable. Drop it and run this statement again.
-- Do not wrap this file in BEGIN/COMMIT.
--
-- Provider type per service, and "served by someone else", use jsonb containment
-- on service_providers. One GIN index covers those filters.

create index concurrently if not exists cc_churches_service_providers_idx
  on public.cc_churches using gin ((coalesce(doc -> 'service_providers', '{}'::jsonb)) jsonb_path_ops);
