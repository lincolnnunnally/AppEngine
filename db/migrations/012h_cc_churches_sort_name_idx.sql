-- NOT APPLIED. Do not run this file against production from the app.
-- Apply 012_crm_directory_functions.sql first.
-- Run this statement by itself. CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- After it finishes, check indisvalid:
--   select indexrelid::regclass, indisvalid
--     from pg_index
--    where indexrelid = 'public.cc_churches_sort_name_id_idx'::regclass;
-- indisvalid = false means the index is not usable. Drop it and run this statement again.
-- Do not wrap this file in BEGIN/COMMIT.
-- This is the normalized sort name (blank and null are ''). It is not
-- cc_churches_name_id_idx and it does not replace cc_churches_name_i.

create index concurrently if not exists cc_churches_sort_name_id_idx
  on public.cc_churches (public.crm_church_sort_name(doc), id);
