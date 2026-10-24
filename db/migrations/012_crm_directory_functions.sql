-- NOT APPLIED. Do not run this file against production from the app.
--
-- Helpers and crm_directory_page for the owner /crm directory list.
-- The list calls this function and does not fall back to the slow PostgREST
-- or() keyset. Until this file is applied by hand, that list fails closed.
--
-- State is matched on a normalized two-letter code, so "Georgia" and "GA"
-- use the same index. Name, AVL fit, and last contact each have one sort
-- expression, and that same expression is the cursor. Empty names are ''.
-- Fit is numeric. Last contact is the later of last_invited_at and
-- last_contact_at.
--
-- Do not create cc_churches_name_id_idx. Production already has
-- cc_churches_name_i on (doc->>'name'). The sort index in 012h is the
-- normalized name (blank and null share ''), which is a different key.
--
-- Expression indexes that call these helpers are 012b–012t. Provider filters
-- use 012u (jsonb containment) and 012v (vendor names). Apply this file
-- first, then 012a (pg_trgm in the extensions schema), then each index file
-- on its own with no transaction, and check indisvalid after each.
-- service_role is granted execute on every helper below, not only the page function.
-- This file is a normal function migration. It is not CREATE INDEX CONCURRENTLY.

create or replace function public.crm_church_state_code(p text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select case upper(btrim(coalesce(p, '')))
    when 'AL' then 'AL' when 'ALABAMA' then 'AL'
    when 'AK' then 'AK' when 'ALASKA' then 'AK'
    when 'AZ' then 'AZ' when 'ARIZONA' then 'AZ'
    when 'AR' then 'AR' when 'ARKANSAS' then 'AR'
    when 'CA' then 'CA' when 'CALIFORNIA' then 'CA'
    when 'CO' then 'CO' when 'COLORADO' then 'CO'
    when 'CT' then 'CT' when 'CONNECTICUT' then 'CT'
    when 'DE' then 'DE' when 'DELAWARE' then 'DE'
    when 'DC' then 'DC' when 'DISTRICT OF COLUMBIA' then 'DC'
    when 'FL' then 'FL' when 'FLORIDA' then 'FL'
    when 'GA' then 'GA' when 'GEORGIA' then 'GA'
    when 'HI' then 'HI' when 'HAWAII' then 'HI'
    when 'ID' then 'ID' when 'IDAHO' then 'ID'
    when 'IL' then 'IL' when 'ILLINOIS' then 'IL'
    when 'IN' then 'IN' when 'INDIANA' then 'IN'
    when 'IA' then 'IA' when 'IOWA' then 'IA'
    when 'KS' then 'KS' when 'KANSAS' then 'KS'
    when 'KY' then 'KY' when 'KENTUCKY' then 'KY'
    when 'LA' then 'LA' when 'LOUISIANA' then 'LA'
    when 'ME' then 'ME' when 'MAINE' then 'ME'
    when 'MD' then 'MD' when 'MARYLAND' then 'MD'
    when 'MA' then 'MA' when 'MASSACHUSETTS' then 'MA'
    when 'MI' then 'MI' when 'MICHIGAN' then 'MI'
    when 'MN' then 'MN' when 'MINNESOTA' then 'MN'
    when 'MS' then 'MS' when 'MISSISSIPPI' then 'MS'
    when 'MO' then 'MO' when 'MISSOURI' then 'MO'
    when 'MT' then 'MT' when 'MONTANA' then 'MT'
    when 'NE' then 'NE' when 'NEBRASKA' then 'NE'
    when 'NV' then 'NV' when 'NEVADA' then 'NV'
    when 'NH' then 'NH' when 'NEW HAMPSHIRE' then 'NH'
    when 'NJ' then 'NJ' when 'NEW JERSEY' then 'NJ'
    when 'NM' then 'NM' when 'NEW MEXICO' then 'NM'
    when 'NY' then 'NY' when 'NEW YORK' then 'NY'
    when 'NC' then 'NC' when 'NORTH CAROLINA' then 'NC'
    when 'ND' then 'ND' when 'NORTH DAKOTA' then 'ND'
    when 'OH' then 'OH' when 'OHIO' then 'OH'
    when 'OK' then 'OK' when 'OKLAHOMA' then 'OK'
    when 'OR' then 'OR' when 'OREGON' then 'OR'
    when 'PA' then 'PA' when 'PENNSYLVANIA' then 'PA'
    when 'RI' then 'RI' when 'RHODE ISLAND' then 'RI'
    when 'SC' then 'SC' when 'SOUTH CAROLINA' then 'SC'
    when 'SD' then 'SD' when 'SOUTH DAKOTA' then 'SD'
    when 'TN' then 'TN' when 'TENNESSEE' then 'TN'
    when 'TX' then 'TX' when 'TEXAS' then 'TX'
    when 'UT' then 'UT' when 'UTAH' then 'UT'
    when 'VT' then 'VT' when 'VERMONT' then 'VT'
    when 'VA' then 'VA' when 'VIRGINIA' then 'VA'
    when 'WA' then 'WA' when 'WASHINGTON' then 'WA'
    when 'WV' then 'WV' when 'WEST VIRGINIA' then 'WV'
    when 'WI' then 'WI' when 'WISCONSIN' then 'WI'
    when 'WY' then 'WY' when 'WYOMING' then 'WY'
    else ''
  end;
$$;

create or replace function public.crm_church_sort_name(doc jsonb)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(btrim(coalesce(doc->>'name', '')), ''),
    nullif(btrim(coalesce(doc->>'church_name', '')), ''),
    ''
  );
$$;

create or replace function public.crm_church_fit(doc jsonb)
returns numeric
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select case
    when btrim(coalesce(doc->>'jev_avl_fit', '')) ~ '^[0-9]+(\.[0-9]+)?$'
    then case
      when (btrim(doc->>'jev_avl_fit'))::numeric between 0 and 4
      then (btrim(doc->>'jev_avl_fit'))::numeric
      else null
    end
    else null
  end;
$$;

create or replace function public.crm_church_last_contact(doc jsonb)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select greatest(
    coalesce(nullif(btrim(coalesce(doc->>'last_invited_at', '')), ''), ''),
    coalesce(nullif(btrim(coalesce(doc->>'last_contact_at', '')), ''), '')
  );
$$;

create or replace function public.crm_church_has_staff(doc jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select (
    jsonb_typeof(doc->'staff_contacts') = 'array'
    and jsonb_array_length(doc->'staff_contacts') > 0
  )
  or btrim(coalesce(doc->>'pastor_name', '')) <> ''
  or btrim(coalesce(doc->>'contact_name', '')) <> ''
  or btrim(coalesce(doc->>'secretary_name', '')) <> '';
$$;

create or replace function public.crm_church_building_stage(doc jsonb)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select case lower(btrim(coalesce(doc->>'building_stage', '')))
    when 'none' then 'none'
    when 'exploring' then 'exploring'
    when 'campaign_planning' then 'campaign_planning'
    when 'design' then 'design'
    when 'under_construction' then 'under_construction'
    when 'recently_completed' then 'recently_completed'
    else ''
  end;
$$;

-- Effective owner opportunity. A saved status wins, including unknown.
-- other_services with nothing saved: ChurchConnect, website, and laser are possible.
-- A church already on ChurchConnect, with nothing saved for that service, is an active customer.
-- Indexes 012p–012t call this with a constant service name. Apply this file before those indexes.
-- The report is owner-only. Vendor-name indexes are 012v–012za, one service each.
create or replace function public.crm_church_opportunity_status(doc jsonb, service text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select case
    when lower(btrim(coalesce(doc->'service_opportunities'->service->>'status', ''))) in
      ('unknown', 'possible', 'interested', 'active_customer', 'not_a_fit')
    then lower(btrim(doc->'service_opportunities'->service->>'status'))
    when service = 'churchconnect' and (
      lower(btrim(coalesce(doc->>'is_customer', ''))) in ('true', 'yes', 'y', '1')
      or lower(btrim(coalesce(doc->>'signed_up', ''))) in ('true', 'yes', 'y', '1')
      or lower(btrim(coalesce(doc->>'invite_status', ''))) = 'accepted'
    ) then 'active_customer'
    when service in ('churchconnect', 'website', 'laser')
      and lower(btrim(coalesce(doc->>'lead_class', ''))) = 'other_services'
    then 'possible'
    else 'unknown'
  end;
$$;

create or replace function public.crm_service_provider_report()
returns table (service text, provider_type text, vendor_name text, churches bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    entry.key,
    lower(btrim(coalesce(entry.value->>'provider_type', ''))),
    case
      when lower(btrim(coalesce(entry.value->>'provider_type', ''))) = 'vendor'
      then left(btrim(coalesce(entry.value->>'vendor_name', '')), 200)
      else ''
    end,
    count(*)::bigint
  from public.cc_churches c
  cross join lateral jsonb_each(coalesce(c.doc->'service_providers', '{}'::jsonb)) as entry
  where entry.key in ('av', 'website', 'toner', 'laser', 'churchconnect', 'local_mission')
    and lower(btrim(coalesce(entry.value->>'provider_type', ''))) in ('us', 'vendor', 'other', 'unknown')
  group by 1, 2, 3
  order by 1, 2, 4 desc;
$$;

drop function if exists public.crm_directory_page(text, text, text, text, text, boolean, numeric, text, text, text, text, text, text, text, integer, text);

create or replace function public.crm_directory_page(
  p_q text default '',
  p_state text default '',
  p_county text default '',
  p_status text default '',
  p_lead_class text default '',
  p_staff boolean default false,
  p_fit_min numeric default null,
  p_contacted text default '',
  p_contacted_on text default '',
  p_building_stage text default '',
  p_sort text default 'id',
  p_dir text default 'asc',
  p_cursor_id text default '',
  p_cursor_value text default '',
  p_limit integer default 41,
  p_opportunity text default '',
  p_provider text default '',
  p_vendor text default '',
  p_other_service text default '',
  p_opening text default ''
)
returns table (
  id text,
  name text,
  church_name text,
  city text,
  state text,
  zip_code text,
  county text,
  region text,
  crm_status text,
  lead_class text,
  jev_avl_fit text,
  jev_project_stage text,
  last_invited_at text,
  last_contact_at text,
  pastor_name text,
  contact_name text,
  secretary_name text,
  has_staff boolean,
  merged_into text,
  deleted_at text,
  avl_existing_relationship text,
  avl_existing_relationship_note text,
  avl_project_status text,
  building_stage text,
  building_stage_recorded_at text,
  sort_name text,
  sort_fit numeric,
  sort_contact text,
  service_opportunities jsonb,
  is_customer text,
  signed_up text,
  invite_status text,
  service_providers jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 41), 1), 100);
  q text := left(regexp_replace(btrim(coalesce(p_q, '')), '[%_\\]', '', 'g'), 80);
  zip text := regexp_replace(q, '\D', '', 'g');
  st text := upper(left(btrim(coalesce(p_state, '')), 2));
  county text := left(btrim(coalesce(p_county, '')), 80);
  status text := left(btrim(coalesce(p_status, '')), 80);
  lead text := left(btrim(coalesce(p_lead_class, '')), 80);
  contacted text := left(btrim(coalesce(p_contacted, '')), 20);
  contacted_on text := left(btrim(coalesce(p_contacted_on, '')), 10);
  stage text := left(btrim(coalesce(p_building_stage, '')), 40);
  opportunity text := lower(left(btrim(coalesce(p_opportunity, '')), 80));
  opp_service text := split_part(opportunity, ':', 1);
  opp_status text := split_part(opportunity, ':', 2);
  provider text := lower(left(btrim(coalesce(p_provider, '')), 80));
  prov_service text := split_part(provider, ':', 1);
  prov_type text := split_part(provider, ':', 2);
  vendor text := left(btrim(coalesce(p_vendor, '')), 200);
  other_service text := lower(left(btrim(coalesce(p_other_service, '')), 40));
  opening text := lower(left(btrim(coalesce(p_opening, '')), 40));
  sort text := case when p_sort in ('id', 'name', 'fit', 'contact', 'tier') then p_sort else 'id' end;
  dir text := case when lower(coalesce(p_dir, 'asc')) = 'desc' then 'desc' else 'asc' end;
  cursor_id text := left(btrim(coalesce(p_cursor_id, '')), 80);
  cursor_value text := left(coalesce(p_cursor_value, ''), 80);
  clauses text := 'true';
  ord text;
  key_pred text := 'true';
  sql text;
begin
  if sort = 'tier' then
    sort := 'id';
  end if;

  if q <> '' then
    clauses := clauses || format(
      ' and (coalesce(c.doc->>''name'', '''') ilike %L or coalesce(c.doc->>''church_name'', '''') ilike %L or coalesce(c.doc->>''city'', '''') ilike %L',
      '%' || q || '%', '%' || q || '%', '%' || q || '%'
    );
    if zip ~ '^[0-9]{5}([0-9]{4})?$' then
      clauses := clauses || format(
        ' or regexp_replace(coalesce(c.doc->>''zip_code'', ''''), ''\D'', '''', ''g'') = %L',
        zip
      );
    end if;
    clauses := clauses || ')';
  end if;

  if st ~ '^[A-Z]{2}$' then
    clauses := clauses || format(' and public.crm_church_state_code(c.doc->>''state'') = %L', st);
  end if;

  if county <> '' then
    clauses := clauses || format(
      ' and (lower(btrim(coalesce(c.doc->>''county'', ''''))) = lower(%L) or lower(btrim(coalesce(c.doc->>''region'', ''''))) = lower(%L))',
      county, county
    );
  end if;

  if status = 'not_contacted' then
    clauses := clauses || ' and coalesce(nullif(btrim(coalesce(c.doc->>''crm_status'', '''')), ''''), '''') = ''''';
  elsif status <> '' then
    clauses := clauses || format(' and lower(btrim(coalesce(c.doc->>''crm_status'', ''''))) = lower(%L)', status);
  end if;

  if lead = 'unset' then
    clauses := clauses || ' and coalesce(nullif(btrim(coalesce(c.doc->>''lead_class'', '''')), ''''), '''') = ''''';
  elsif lead <> '' then
    clauses := clauses || format(
      ' and coalesce(nullif(btrim(coalesce(c.doc->>''lead_class'', '''')), ''''), '''') = %L',
      lead
    );
  end if;

  if coalesce(p_staff, false) then
    clauses := clauses || ' and public.crm_church_has_staff(c.doc)';
  end if;

  if p_fit_min is not null then
    clauses := clauses || format(' and public.crm_church_fit(c.doc) >= %s', p_fit_min);
  end if;

  if contacted = 'never' then
    clauses := clauses || ' and public.crm_church_last_contact(c.doc) = ''''';
  elsif contacted in ('since', 'before') and contacted_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    if contacted = 'since' then
      clauses := clauses || format(
        ' and public.crm_church_last_contact(c.doc) >= %L and public.crm_church_last_contact(c.doc) <> ''''',
        contacted_on
      );
    else
      clauses := clauses || format(
        ' and public.crm_church_last_contact(c.doc) <> '''' and public.crm_church_last_contact(c.doc) < %L',
        contacted_on
      );
    end if;
  end if;

  if stage = 'none' then
    clauses := clauses || ' and public.crm_church_building_stage(c.doc) in (''none'', '''')';
  elsif stage <> '' then
    clauses := clauses || format(' and public.crm_church_building_stage(c.doc) = %L', stage);
  end if;

  if opportunity <> '' then
    if opp_service in ('website', 'toner', 'laser', 'churchconnect', 'local_mission')
       and opp_status in ('unknown', 'possible', 'interested', 'active_customer', 'not_a_fit')
    then
      clauses := clauses || format(
        ' and public.crm_church_opportunity_status(c.doc, %L) = %L',
        opp_service, opp_status
      );
    else
      clauses := clauses || ' and false';
    end if;
  end if;

  if provider <> '' then
    if prov_service in ('av', 'website', 'toner', 'laser', 'churchconnect', 'local_mission')
       and prov_type in ('us', 'vendor', 'other', 'unknown')
    then
      clauses := clauses || format(
        ' and coalesce(c.doc -> ''service_providers'', ''{}''::jsonb) @> jsonb_build_object(%L, jsonb_build_object(''provider_type'', %L))',
        prov_service, prov_type
      );
    else
      clauses := clauses || ' and false';
    end if;
  end if;

  if vendor <> '' then
    clauses := clauses || format(
      ' and ((lower(btrim(coalesce(c.doc #>> ''{service_providers,av,provider_type}'', ''''))) = ''vendor'' and lower(btrim(coalesce(c.doc #>> ''{service_providers,av,vendor_name}'', ''''))) = lower(%L)) or (lower(btrim(coalesce(c.doc #>> ''{service_providers,website,provider_type}'', ''''))) = ''vendor'' and lower(btrim(coalesce(c.doc #>> ''{service_providers,website,vendor_name}'', ''''))) = lower(%L)) or (lower(btrim(coalesce(c.doc #>> ''{service_providers,toner,provider_type}'', ''''))) = ''vendor'' and lower(btrim(coalesce(c.doc #>> ''{service_providers,toner,vendor_name}'', ''''))) = lower(%L)) or (lower(btrim(coalesce(c.doc #>> ''{service_providers,laser,provider_type}'', ''''))) = ''vendor'' and lower(btrim(coalesce(c.doc #>> ''{service_providers,laser,vendor_name}'', ''''))) = lower(%L)) or (lower(btrim(coalesce(c.doc #>> ''{service_providers,churchconnect,provider_type}'', ''''))) = ''vendor'' and lower(btrim(coalesce(c.doc #>> ''{service_providers,churchconnect,vendor_name}'', ''''))) = lower(%L)) or (lower(btrim(coalesce(c.doc #>> ''{service_providers,local_mission,provider_type}'', ''''))) = ''vendor'' and lower(btrim(coalesce(c.doc #>> ''{service_providers,local_mission,vendor_name}'', ''''))) = lower(%L)))',
      vendor, vendor, vendor, vendor, vendor, vendor
    );
  end if;

  if other_service <> '' then
    if other_service in ('av', 'website', 'toner', 'laser', 'churchconnect', 'local_mission') then
      clauses := clauses || format(
        ' and (coalesce(c.doc -> ''service_providers'', ''{}''::jsonb) @> jsonb_build_object(%L, jsonb_build_object(''provider_type'', ''vendor'')) or coalesce(c.doc -> ''service_providers'', ''{}''::jsonb) @> jsonb_build_object(%L, jsonb_build_object(''provider_type'', ''other'')))',
        other_service, other_service
      );
    else
      clauses := clauses || ' and false';
    end if;
  end if;

  if opening <> '' then
    if opening in ('website', 'toner', 'laser', 'churchconnect', 'local_mission') then
      clauses := clauses || format(
        ' and public.crm_church_opportunity_status(c.doc, %L) in (''possible'', ''interested'')',
        opening
      );
    else
      clauses := clauses || ' and false';
    end if;
  end if;

  if sort = 'name' then
    ord := 'public.crm_church_sort_name(c.doc) ' || dir || ', c.id ' || dir;
    if cursor_id <> '' then
      if dir = 'desc' then
        key_pred := format('(public.crm_church_sort_name(c.doc), c.id) < (%L, %L)', cursor_value, cursor_id);
      else
        key_pred := format('(public.crm_church_sort_name(c.doc), c.id) > (%L, %L)', cursor_value, cursor_id);
      end if;
    end if;
  elsif sort = 'fit' then
    ord := 'coalesce(public.crm_church_fit(c.doc), -1) ' || dir || ', c.id ' || dir;
    if cursor_id <> '' then
      if cursor_value !~ '^-?[0-9]+(\.[0-9]+)?$' then
        cursor_value := '-1';
      end if;
      if dir = 'desc' then
        key_pred := format('(coalesce(public.crm_church_fit(c.doc), -1), c.id) < (%s, %L)', cursor_value, cursor_id);
      else
        key_pred := format('(coalesce(public.crm_church_fit(c.doc), -1), c.id) > (%s, %L)', cursor_value, cursor_id);
      end if;
    end if;
  elsif sort = 'contact' then
    ord := 'public.crm_church_last_contact(c.doc) ' || dir || ', c.id ' || dir;
    if cursor_id <> '' then
      if dir = 'desc' then
        key_pred := format('(public.crm_church_last_contact(c.doc), c.id) < (%L, %L)', cursor_value, cursor_id);
      else
        key_pred := format('(public.crm_church_last_contact(c.doc), c.id) > (%L, %L)', cursor_value, cursor_id);
      end if;
    end if;
  else
    ord := 'c.id ' || dir;
    if cursor_id <> '' then
      if dir = 'desc' then
        key_pred := format('c.id < %L', cursor_id);
      else
        key_pred := format('c.id > %L', cursor_id);
      end if;
    end if;
  end if;

  sql := format($q$
    select
      c.id,
      c.doc->>'name',
      c.doc->>'church_name',
      c.doc->>'city',
      c.doc->>'state',
      c.doc->>'zip_code',
      c.doc->>'county',
      c.doc->>'region',
      c.doc->>'crm_status',
      c.doc->>'lead_class',
      c.doc->>'jev_avl_fit',
      c.doc->>'jev_project_stage',
      c.doc->>'last_invited_at',
      c.doc->>'last_contact_at',
      c.doc->>'pastor_name',
      c.doc->>'contact_name',
      c.doc->>'secretary_name',
      public.crm_church_has_staff(c.doc),
      c.doc->>'merged_into',
      c.doc->>'deleted_at',
      c.doc->>'avl_existing_relationship',
      c.doc->>'avl_existing_relationship_note',
      c.doc->>'avl_project_status',
      c.doc->>'building_stage',
      c.doc->>'building_stage_recorded_at',
      public.crm_church_sort_name(c.doc),
      coalesce(public.crm_church_fit(c.doc), -1),
      public.crm_church_last_contact(c.doc),
      c.doc->'service_opportunities',
      c.doc->>'is_customer',
      c.doc->>'signed_up',
      c.doc->>'invite_status',
      c.doc->'service_providers'
    from public.cc_churches c
    where %s
      and %s
    order by %s
    limit %s
  $q$, clauses, key_pred, ord, lim);

  return query execute sql;
end
$$;

revoke all on function public.crm_church_state_code(text) from public, anon, authenticated;
revoke all on function public.crm_church_sort_name(jsonb) from public, anon, authenticated;
revoke all on function public.crm_church_fit(jsonb) from public, anon, authenticated;
revoke all on function public.crm_church_last_contact(jsonb) from public, anon, authenticated;
revoke all on function public.crm_church_has_staff(jsonb) from public, anon, authenticated;
revoke all on function public.crm_church_building_stage(jsonb) from public, anon, authenticated;
revoke all on function public.crm_church_opportunity_status(jsonb, text) from public, anon, authenticated;
revoke all on function public.crm_service_provider_report() from public, anon, authenticated;
revoke all on function public.crm_directory_page(text, text, text, text, text, boolean, numeric, text, text, text, text, text, text, text, integer, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.crm_church_state_code(text) to service_role;
grant execute on function public.crm_church_sort_name(jsonb) to service_role;
grant execute on function public.crm_church_fit(jsonb) to service_role;
grant execute on function public.crm_church_last_contact(jsonb) to service_role;
grant execute on function public.crm_church_has_staff(jsonb) to service_role;
grant execute on function public.crm_church_building_stage(jsonb) to service_role;
grant execute on function public.crm_church_opportunity_status(jsonb, text) to service_role;
grant execute on function public.crm_service_provider_report() to service_role;
grant execute on function public.crm_directory_page(text, text, text, text, text, boolean, numeric, text, text, text, text, text, text, text, integer, text, text, text, text, text) to service_role;
