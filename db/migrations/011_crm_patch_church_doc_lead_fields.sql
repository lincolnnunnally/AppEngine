-- NOT APPLIED. Do not run this file against production from the app.
--
-- Adds lead fields to the church doc merge. CREATE OR REPLACE keeps the
-- existing (text, jsonb, text) function, so the service_role grant from 009
-- stays. The revoke and grant below are repeated so a database that only has
-- this file is still locked to service_role.
--
-- Keys copied when present in p_patch:
--   staff_contacts, crm_signals, updated_at (already in 009)
--   crm_status, lead_class, jev_avl_fit, jev_project_stage, crm_offers
-- Omitting a key leaves it. Any other key is ignored. A stale doc.updated_at
-- returns no row. cc_churches.id stays text.

create or replace function public.crm_patch_church_doc(p_id text, p_patch jsonb, p_expected text)
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
  if p_patch ? 'crm_status' then
    allowed := allowed || jsonb_build_object('crm_status', p_patch -> 'crm_status');
  end if;
  if p_patch ? 'lead_class' then
    allowed := allowed || jsonb_build_object('lead_class', p_patch -> 'lead_class');
  end if;
  if p_patch ? 'jev_avl_fit' then
    allowed := allowed || jsonb_build_object('jev_avl_fit', p_patch -> 'jev_avl_fit');
  end if;
  if p_patch ? 'jev_project_stage' then
    allowed := allowed || jsonb_build_object('jev_project_stage', p_patch -> 'jev_project_stage');
  end if;
  if p_patch ? 'crm_offers' then
    allowed := allowed || jsonb_build_object('crm_offers', p_patch -> 'crm_offers');
  end if;
  return query
  update public.cc_churches
     set doc = coalesce(cc_churches.doc, '{}'::jsonb) || allowed
   where cc_churches.id = p_id
     and cc_churches.doc->>'updated_at' is not distinct from p_expected
  returning cc_churches.id;
end $$;

revoke all on function public.crm_patch_church_doc(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.crm_patch_church_doc(text, jsonb, text) to service_role;
