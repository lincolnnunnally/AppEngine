-- NOT APPLIED. Do not run this file against production from the app.
--
-- cc_churches.id is text in production. A uuid argument fails on PostgreSQL 16
-- with "operator does not exist: text = uuid". The parameter and the returned
-- id are text, same as the column.
--
-- ChurchConnect church_crm.py sets doc.updated_at on its own clock, so a
-- compare-and-swap on that field rejects a good write. This function merges
-- a patch on the server:
--   doc = coalesce(doc, '{}') || allowed
-- Only staff_contacts, crm_signals, and updated_at are copied out of p_patch.
-- Any other key is ignored. Until this function is applied, the import falls
-- back to compare-and-swap only when PostgREST says the function is not
-- installed. Any other error stops the import.
--
-- Default privileges can grant EXECUTE on a function created later to
-- public, anon, and authenticated. The revoke below covers this function
-- only and does not change schema-wide default privileges.

drop function if exists public.crm_patch_church_doc(uuid, jsonb);

create or replace function public.crm_patch_church_doc(p_id text, p_patch jsonb)
returns table (id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed jsonb := '{}'::jsonb;
begin
  if p_patch ? 'staff_contacts' then
    allowed := allowed || jsonb_build_object('staff_contacts', p_patch -> 'staff_contacts');
  end if;
  if p_patch ? 'crm_signals' then
    allowed := allowed || jsonb_build_object('crm_signals', p_patch -> 'crm_signals');
  end if;
  if p_patch ? 'updated_at' then
    allowed := allowed || jsonb_build_object('updated_at', p_patch -> 'updated_at');
  end if;
  return query
  update public.cc_churches
     set doc = coalesce(cc_churches.doc, '{}'::jsonb) || allowed
   where cc_churches.id = p_id
  returning cc_churches.id;
end $$;

revoke all on function public.crm_patch_church_doc(text, jsonb) from public, anon, authenticated;
grant execute on function public.crm_patch_church_doc(text, jsonb) to service_role;
