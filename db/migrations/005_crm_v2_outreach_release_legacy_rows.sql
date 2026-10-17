-- Applied to LPL Supabase (uqhqulrqcygsmmzdzemx) as migration 20261017155733 "crm_v2_outreach_release_legacy_rows" on 2026-10-17.
-- Body copied verbatim from supabase_migrations.schema_migrations. Already applied; do not re-run by hand.

-- Rows written the old way (raw insert, source = the desk claim, claims empty) still count as that claim,
-- so an undo after this change can release a stop made before it.
create or replace function public.outreach_release(p_claim text)
returns table (released integer, deleted integer, remaining integer)
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare v_ids uuid[]; v_deleted int; v_remaining int;
begin
  if coalesce(p_claim, '') not like 'crm_visit:%' then
    raise exception 'outreach_release: only owner-desk claims (crm_visit:...) can be released';
  end if;
  with touched as (
    update public.outreach_suppressions s set
      claims = array_remove(s.claims, p_claim),
      source = case when s.source = p_claim and cardinality(array_remove(s.claims, p_claim)) > 0
                    then (array_remove(s.claims, p_claim))[1] else s.source end
    where p_claim = any(s.claims) or (s.source = p_claim and cardinality(s.claims) = 0)
    returning s.id
  ) select coalesce(array_agg(touched.id), '{}') into v_ids from touched;
  delete from public.outreach_suppressions s
   where s.id = any(v_ids) and cardinality(s.claims) = 0 and coalesce(s.source, '') like 'crm_visit:%';
  get diagnostics v_deleted = row_count;
  select count(*) into v_remaining from public.outreach_suppressions s
   where p_claim = any(s.claims) or (s.source = p_claim and cardinality(s.claims) = 0);
  return query select cardinality(v_ids), v_deleted, v_remaining;
end $$;
revoke all on function public.outreach_release(text) from public, anon, authenticated;
grant execute on function public.outreach_release(text) to service_role;
comment on function public.outreach_release(text) is 'Removes one owner-desk claim (also a pre-claims row whose source is that claim); deletes a row only when no claims remain and its source is still crm_visit:%.';
