-- NOT APPLIED. Do not run this file against production from the app.
--
-- Adds lead fields to the church doc merge. CREATE OR REPLACE keeps the
-- existing (text, jsonb, text) function, so the service_role grant from 009
-- stays. The revoke and grant below are repeated so a database that only has
-- this file is still locked to service_role. Do not drop the function.
--
-- Keys copied when present in p_patch:
--   staff_contacts, crm_signals
--   crm_status, lead_class, jev_avl_fit, jev_project_stage, crm_offers
--   building_stage, building_stage_recorded_at
--   service_opportunities (website, toner, laser, churchconnect, local_mission only)
--   service_providers (av plus those five). Each value keeps only
--     provider_type (us, vendor, other, unknown), vendor_name when vendor,
--     other_name when other, note, learned_from, and learned_at.
-- updated_at is copied only when another allowlisted key is copied. A patch
-- that this function does not persist (including updated_at alone, or a
-- status the function ignores) writes nothing and does not bump updated_at.
-- That guard lived briefly in 009. 009 stays the applied body. This file
-- replaces the function, so the guard lives here.
-- Omitting a key leaves it. The older avl_existing_relationship,
-- avl_existing_relationship_note, and avl_project_status keys are not copied.
-- A stale doc.updated_at returns no row. cc_churches.id stays text.
-- These owner fields are not the pipeline status. Contact status stays crm_status.

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
  if p_patch ? 'building_stage' then
    allowed := allowed || jsonb_build_object('building_stage', p_patch -> 'building_stage');
  end if;
  if p_patch ? 'building_stage_recorded_at' then
    allowed := allowed || jsonb_build_object('building_stage_recorded_at', p_patch -> 'building_stage_recorded_at');
  end if;
  if p_patch ? 'service_opportunities' and jsonb_typeof(p_patch -> 'service_opportunities') = 'object' then
    allowed := allowed || jsonb_build_object(
      'service_opportunities',
      coalesce(
        (
          select jsonb_object_agg(entry.key, entry.value)
          from jsonb_each(p_patch -> 'service_opportunities') as entry
          where entry.key in ('website', 'toner', 'laser', 'churchconnect', 'local_mission')
        ),
        '{}'::jsonb
      )
    );
  end if;
  if p_patch ? 'service_providers' and jsonb_typeof(p_patch -> 'service_providers') = 'object' then
    allowed := allowed || jsonb_build_object(
      'service_providers',
      coalesce(
        (
          select jsonb_object_agg(
            entry.key,
            jsonb_build_object(
              'provider_type', case
                when lower(btrim(coalesce(entry.value->>'provider_type', ''))) in ('us', 'vendor', 'other', 'unknown')
                then lower(btrim(entry.value->>'provider_type'))
                else 'unknown'
              end,
              'vendor_name', case
                when lower(btrim(coalesce(entry.value->>'provider_type', ''))) = 'vendor'
                then left(btrim(coalesce(entry.value->>'vendor_name', '')), 200)
                else ''
              end,
              'other_name', case
                when lower(btrim(coalesce(entry.value->>'provider_type', ''))) = 'other'
                then left(btrim(coalesce(entry.value->>'other_name', '')), 200)
                else ''
              end,
              'note', left(btrim(coalesce(entry.value->>'note', '')), 500),
              'learned_from', left(btrim(coalesce(entry.value->>'learned_from', '')), 200),
              'learned_at', case
                when btrim(coalesce(entry.value->>'learned_at', '')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
                then left(btrim(entry.value->>'learned_at'), 10)
                else ''
              end
            )
          )
          from jsonb_each(p_patch -> 'service_providers') as entry
          where entry.key in ('av', 'website', 'toner', 'laser', 'churchconnect', 'local_mission')
            and jsonb_typeof(entry.value) = 'object'
        ),
        '{}'::jsonb
      )
    );
  end if;
  if allowed <> '{}'::jsonb and p_patch ? 'updated_at' then
    allowed := allowed || jsonb_build_object('updated_at', p_patch -> 'updated_at');
  end if;
  if allowed = '{}'::jsonb then
    return;
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
