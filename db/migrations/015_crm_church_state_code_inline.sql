-- APPLIED to production (LPL Supabase uqhqulrqcygsmmzdzemx) on 2026-11-10.
--
-- crm_church_state_code was declared with "set search_path". Postgres never inlines a SQL
-- function that has a SET clause, so every call started the function executor and rebuilt
-- its 100-branch CASE. Measured on production, 2026-11-10: a filter on
-- crm_church_state_code(doc->>'state') over the 107k churches with an email took 5.7 s;
-- the same body without the SET clause is inlined into the query and takes 0.4 s. That one
-- call was most of the time in 15 of the 20 statements averaging over 2 s in
-- pg_stat_statements (the ChurchConnect outreach candidate queries; worst mean 6.6 s).
--
-- The body is unchanged apart from pg_catalog. on the three built-ins, which is what
-- cc_church_lat_v2 already does in place of a SET clause. Checked before applying: the
-- inlinable body returns the same code as the old function for every row of cc_churches
-- (0 of 344,024 differ), so cc_churches_state_code_id_idx (012b) stays correct and needs
-- no rebuild. The planner still matches that index: it inlines the index expression too.
--
-- Supabase's "function_search_path_mutable" lint will list this function. That is expected:
-- it calls nothing outside pg_catalog. Do not add the SET clause back.
-- This file is a normal function migration. It is not CREATE INDEX CONCURRENTLY.

create or replace function public.crm_church_state_code(p text)
returns text
language sql
immutable
parallel safe
as $$
  select case pg_catalog.upper(pg_catalog.btrim(coalesce(p, '')))
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

