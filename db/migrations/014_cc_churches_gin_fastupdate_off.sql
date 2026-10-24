-- NOT APPLIED. Do not run this file against production from the app.
-- Owner-run. Run it in a quiet window, one statement at a time.
--
-- cc_churches is about 151k rows. Five GIN indexes still have fastupdate on
-- (the default). A single-row update can take about 9 seconds when one of
-- those pending lists flushes. That is past the Supabase REST authenticator
-- role's 8s statement_timeout, so crm_patch_church_doc returns 500 during a
-- bulk import.
--
-- fastupdate = off makes later inserts maintain the main GIN structure
-- directly, instead of appending to a pending list. ALTER INDEX SET
-- (fastupdate) takes an AccessExclusiveLock on that index. While the lock
-- is held, every query on cc_churches waits. Do not wrap this file in
-- BEGIN/COMMIT. Each ALTER is its own statement and must be its own
-- transaction so the lock is released before the next index is touched.
-- Run each pair below as its own execute_sql call (SET, then that one
-- ALTER). lock_timeout is 2s: if the lock is not free, that statement
-- fails instead of queueing behind live traffic.
--
-- Turning fastupdate off does not flush entries already in the pending list.
-- Those entries stay until 014a (gin_clean_pending_list) or
-- VACUUM (ANALYZE) public.cc_churches. This file does not rebuild the index.
--
-- ALTER INDEX IF EXISTS skips a missing index with a notice.
-- Running a statement again takes AccessExclusiveLock again, even when
-- fastupdate is already off. Skip a statement that has already been applied.
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
--
-- Down (do not run as part of this file). Same quiet window, one statement
-- per transaction, SET lock_timeout = '2s' in that same call. Skip any
-- index that is missing:
--   alter index public.cc_churches_doc_gin set (fastupdate = on);
--   alter index public.cc_churches_name_trgm_idx set (fastupdate = on);
--   alter index public.cc_churches_church_name_trgm_idx set (fastupdate = on);
--   alter index public.cc_churches_city_trgm_idx set (fastupdate = on);
--   alter index public.cc_churches_service_providers_idx set (fastupdate = on);

-- 1. public.cc_churches_doc_gin
SET lock_timeout = '2s';
ALTER INDEX IF EXISTS public.cc_churches_doc_gin SET (fastupdate = off);

-- 2. public.cc_churches_name_trgm_idx
SET lock_timeout = '2s';
ALTER INDEX IF EXISTS public.cc_churches_name_trgm_idx SET (fastupdate = off);

-- 3. public.cc_churches_church_name_trgm_idx
SET lock_timeout = '2s';
ALTER INDEX IF EXISTS public.cc_churches_church_name_trgm_idx SET (fastupdate = off);

-- 4. public.cc_churches_city_trgm_idx
SET lock_timeout = '2s';
ALTER INDEX IF EXISTS public.cc_churches_city_trgm_idx SET (fastupdate = off);

-- 5. public.cc_churches_service_providers_idx
SET lock_timeout = '2s';
ALTER INDEX IF EXISTS public.cc_churches_service_providers_idx SET (fastupdate = off);
