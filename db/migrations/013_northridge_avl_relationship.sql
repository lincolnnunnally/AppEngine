-- NOT APPLIED. Do not run this file against production from the app.
-- Owner-run and idempotent. Run it only after 011 is applied.
--
-- Northridge Christian, Milledgeville (fb3d153f-dac5-49fc-ad9f-2f594d4dcc24):
-- AV provider is the vendor Messenger AVL, with a note that AVL is already
-- engaged on the current project. Written through crm_patch_church_doc.
-- Contact status is not changed. A blank crm_status stays Not contacted.
-- Other services already on service_providers are left in place.
--
-- A provider_type Lincoln already set on AV (including unknown) is left alone.
-- Running this again changes nothing and does not move updated_at.

do $$
declare
  church_id text := 'fb3d153f-dac5-49fc-ad9f-2f594d4dcc24';
  current_doc jsonb;
  providers jsonb;
  av_type text;
  expected text;
  patch jsonb := '{}'::jsonb;
  written text;
begin
  select doc into current_doc from public.cc_churches where id = church_id;
  if not found then
    raise notice 'Northridge % is not in cc_churches. Nothing changed.', church_id;
    return;
  end if;

  providers := case
    when current_doc is null or jsonb_typeof(current_doc->'service_providers') is distinct from 'object'
    then '{}'::jsonb
    else current_doc->'service_providers'
  end;
  av_type := lower(btrim(coalesce(providers->'av'->>'provider_type', '')));
  if av_type <> '' then
    raise notice 'Northridge already has an AV provider. Nothing changed.';
    return;
  end if;

  providers := providers || jsonb_build_object(
    'av',
    jsonb_build_object(
      'provider_type', 'vendor',
      'vendor_name', 'Messenger AVL',
      'other_name', '',
      'note', 'AVL is already engaged on the current project',
      'learned_from', '',
      'learned_at', ''
    )
  );
  expected := current_doc->>'updated_at';
  patch := jsonb_build_object(
    'service_providers', providers,
    'updated_at', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
  select patched.id into written from public.crm_patch_church_doc(church_id, patch, expected) as patched;
  if written is null then
    raise notice 'Northridge changed while this ran. Nothing else was written. Run it again.';
  end if;
end $$;
