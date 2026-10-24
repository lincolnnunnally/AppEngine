-- NOT APPLIED. Do not run this file against production from the app.
-- Apply 012_crm_directory_functions.sql first. The report's WHERE matches this predicate.
-- Run this statement by itself. CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- After it finishes, check indisvalid:
--   select indexrelid::regclass, indisvalid
--     from pg_index
--    where indexrelid = 'public.cc_churches_service_providers_present_idx'::regclass;
-- indisvalid = false means the index is not usable. Drop it and run this statement again.
-- Do not wrap this file in BEGIN/COMMIT.
--
-- crm_service_provider_report only counts churches that already have service_providers.
-- This partial index keeps that read off the rest of cc_churches.

create index concurrently if not exists cc_churches_service_providers_present_idx
  on public.cc_churches (id)
  where doc ? 'service_providers';
