-- NOT APPLIED. Do not run this file against production from the app.
-- Run this after 014, in the same quiet window.
--
-- fastupdate = off does not flush entries already in a GIN pending list.
-- Those entries stay until each list is cleaned. Run this file as the
-- postgres role (the owner of the indexes), with statement_timeout off.
-- Do not run it as the Supabase REST authenticator role: that role's 8s
-- statement_timeout will cancel the cleanup.
--
-- One statement per index. Run each pair as its own execute_sql call so a
-- long cleanup holds only that index. A missing index errors; skip that
-- pair. gin_clean_pending_list returns the number of pending pages removed.
-- Zero means the list was already empty.
--
-- Alternative, also as postgres with no statement_timeout, after 014:
--   VACUUM (ANALYZE) public.cc_churches;

-- 1. public.cc_churches_doc_gin
SET statement_timeout = 0;
SELECT gin_clean_pending_list('public.cc_churches_doc_gin'::regclass);

-- 2. public.cc_churches_name_trgm_idx
SET statement_timeout = 0;
SELECT gin_clean_pending_list('public.cc_churches_name_trgm_idx'::regclass);

-- 3. public.cc_churches_church_name_trgm_idx
SET statement_timeout = 0;
SELECT gin_clean_pending_list('public.cc_churches_church_name_trgm_idx'::regclass);

-- 4. public.cc_churches_city_trgm_idx
SET statement_timeout = 0;
SELECT gin_clean_pending_list('public.cc_churches_city_trgm_idx'::regclass);

-- 5. public.cc_churches_service_providers_idx
SET statement_timeout = 0;
SELECT gin_clean_pending_list('public.cc_churches_service_providers_idx'::regclass);
