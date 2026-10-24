-- NOT APPLIED. Do not run this file against production from the app.
-- Run this statement by itself. CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- After it finishes, check indisvalid:
--   select indexrelid::regclass, indisvalid
--     from pg_index
--    where indexrelid = 'public.cc_churches_zip_norm_id_idx'::regclass;
-- indisvalid = false means the index is not usable. Drop it and run this statement again.
-- Do not wrap this file in BEGIN/COMMIT.

create index concurrently if not exists cc_churches_zip_norm_id_idx
  on public.cc_churches ((regexp_replace(coalesce(doc->>'zip_code', ''), '\D', '', 'g')), id);
