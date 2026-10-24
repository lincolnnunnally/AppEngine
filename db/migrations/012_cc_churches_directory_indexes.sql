-- NOT APPLIED. Do not run this file against production from the app.
--
-- Expression indexes for the /crm directory list. The default first page
-- orders by id and uses the primary key, so it does not need these.
-- Name, state, county, ZIP, status, lead class, AVL fit, and last invite
-- sorts and filters use these once someone applies the file by hand.
--
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction. Run each
-- statement on its own. Do not wrap this file in BEGIN/COMMIT.

create index concurrently if not exists cc_churches_name_id_idx
  on public.cc_churches ((doc->>'name'), id);

create index concurrently if not exists cc_churches_state_id_idx
  on public.cc_churches ((doc->>'state'), id);

create index concurrently if not exists cc_churches_county_id_idx
  on public.cc_churches ((doc->>'county'), id);

create index concurrently if not exists cc_churches_region_id_idx
  on public.cc_churches ((doc->>'region'), id);

create index concurrently if not exists cc_churches_zip_id_idx
  on public.cc_churches ((doc->>'zip_code'), id);

create index concurrently if not exists cc_churches_status_id_idx
  on public.cc_churches ((doc->>'crm_status'), id);

create index concurrently if not exists cc_churches_lead_class_id_idx
  on public.cc_churches ((doc->>'lead_class'), id);

create index concurrently if not exists cc_churches_fit_id_idx
  on public.cc_churches ((doc->>'jev_avl_fit'), id);

create index concurrently if not exists cc_churches_last_invite_id_idx
  on public.cc_churches ((doc->>'last_invited_at'), id);
