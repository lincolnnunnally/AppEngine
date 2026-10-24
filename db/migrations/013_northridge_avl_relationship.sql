-- NOT APPLIED. Do not run this file against production from the app.
-- Owner-run and idempotent. Run it only after 011 is applied.
--
-- Northridge Christian, Milledgeville (fb3d153f-dac5-49fc-ad9f-2f594d4dcc24):
-- set existing AVL relationship = yes and current project = AVL already engaged
-- through crm_patch_church_doc. Contact status is not changed. A blank
-- crm_status stays Not contacted.
--
-- A field Lincoln already set (including relationship = no, or project = none)
-- is left alone. Running this again changes nothing.

do $$
declare
  church_id text := 'fb3d153f-dac5-49fc-ad9f-2f594d4dcc24';
  current_doc jsonb;
  expected text;
  patch jsonb := '{}'::jsonb;
  written text;
begin
  select doc into current_doc from public.cc_churches where id = church_id;
  if not found then
    raise notice 'Northridge % is not in cc_churches. Nothing changed.', church_id;
    return;
  end if;

  if current_doc is null
     or not (current_doc ? 'avl_existing_relationship')
     or jsonb_typeof(current_doc->'avl_existing_relationship') = 'null'
  then
    patch := patch || jsonb_build_object('avl_existing_relationship', true);
  end if;

  if current_doc is null
     or not (current_doc ? 'avl_project_status')
     or jsonb_typeof(current_doc->'avl_project_status') = 'null'
     or nullif(btrim(current_doc->>'avl_project_status'), '') is null
  then
    patch := patch || jsonb_build_object('avl_project_status', 'avl_already_engaged');
  end if;

  if patch = '{}'::jsonb then
    raise notice 'Northridge already has the owner fields. Nothing changed.';
    return;
  end if;

  expected := current_doc->>'updated_at';
  patch := patch || jsonb_build_object('updated_at', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  select patched.id into written from public.crm_patch_church_doc(church_id, patch, expected) as patched;
  if written is null then
    raise notice 'Northridge changed while this ran. Nothing else was written. Run it again.';
  end if;
end $$;
