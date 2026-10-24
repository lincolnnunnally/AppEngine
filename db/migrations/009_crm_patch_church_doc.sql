-- NOT APPLIED. Do not run this file.
--
-- ChurchConnect church_crm.py sets doc.updated_at on its own clock, so a
-- compare-and-swap on that field rejects a good write. This function merges
-- a patch on the server:
--   doc = coalesce(doc, '{}') || patch
-- Other keys stay as they are at update time. The import sends only
-- staff_contacts, crm_signals, and updated_at. Until this function is
-- applied, the import falls back to the compare-and-swap write.
--
-- Default privileges can grant EXECUTE on a function created later to
-- public, anon, and authenticated. The revoke below covers this function
-- only and does not change schema-wide default privileges.

create or replace function public.crm_patch_church_doc(p_id uuid, p_patch jsonb)
returns table (id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update public.cc_churches
     set doc = coalesce(cc_churches.doc, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
   where cc_churches.id = p_id
  returning cc_churches.id;
end $$;

revoke all on function public.crm_patch_church_doc(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.crm_patch_church_doc(uuid, jsonb) to service_role;
