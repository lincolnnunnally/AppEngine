-- Applied to LPL Supabase (uqhqulrqcygsmmzdzemx) as migration 20261017155329 "crm_v2_outreach_suppression_claims" on 2026-10-17.
-- Body copied verbatim from supabase_migrations.schema_migrations. Already applied; do not re-run by hand.

-- crm_v2_outreach_suppression_claims
-- One row per address on the shared do-not-contact list (the unique indexes stay as they are).
-- Owner-desk stops ("crm_visit:%") are claims on a row, so two desk stops sharing an email each own
-- their claim, and an undo removes only its own claim. A real reason (opt-out, bounce, anything whose
-- source is not crm_visit:%) takes over a desk row and is never replaced by a desk claim.

alter table public.outreach_suppressions add column if not exists claims text[] not null default '{}';
update public.outreach_suppressions set claims = array[source] where source like 'crm_visit:%' and not (source = any(claims));

create or replace function public.outreach_suppress(p_email text, p_domain text, p_phone text, p_reason text, p_source text)
returns table (id uuid, source text, reason text, claims text[])
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_desk boolean := coalesce(p_source, '') like 'crm_visit:%';
  v_claims text[] := case when coalesce(p_source, '') like 'crm_visit:%' then array[p_source] else '{}'::text[] end;
begin
  if (p_email is not null)::int + (p_domain is not null)::int + (p_phone is not null)::int <> 1 then
    raise exception 'outreach_suppress: give exactly one of email, domain, phone';
  end if;
  if p_email is not null then
    return query insert into public.outreach_suppressions as t (email, brand, reason, source, claims)
      values (p_email, 'all', p_reason, p_source, v_claims)
      on conflict ((lower(email))) where email is not null do update set
        claims = case when v_desk and not (excluded.source = any(t.claims)) then t.claims || excluded.source else t.claims end,
        reason = case when not v_desk and coalesce(t.source, '') like 'crm_visit:%' then excluded.reason else t.reason end,
        source = case when not v_desk and coalesce(t.source, '') like 'crm_visit:%' then excluded.source else t.source end
      returning t.id, t.source, t.reason, t.claims;
  elsif p_domain is not null then
    return query insert into public.outreach_suppressions as t (domain, brand, reason, source, claims)
      values (p_domain, 'all', p_reason, p_source, v_claims)
      on conflict ((lower(domain))) where domain is not null do update set
        claims = case when v_desk and not (excluded.source = any(t.claims)) then t.claims || excluded.source else t.claims end,
        reason = case when not v_desk and coalesce(t.source, '') like 'crm_visit:%' then excluded.reason else t.reason end,
        source = case when not v_desk and coalesce(t.source, '') like 'crm_visit:%' then excluded.source else t.source end
      returning t.id, t.source, t.reason, t.claims;
  else
    return query insert into public.outreach_suppressions as t (phone, brand, reason, source, claims)
      values (p_phone, 'all', p_reason, p_source, v_claims)
      on conflict (phone) where phone is not null do update set
        claims = case when v_desk and not (excluded.source = any(t.claims)) then t.claims || excluded.source else t.claims end,
        reason = case when not v_desk and coalesce(t.source, '') like 'crm_visit:%' then excluded.reason else t.reason end,
        source = case when not v_desk and coalesce(t.source, '') like 'crm_visit:%' then excluded.source else t.source end
      returning t.id, t.source, t.reason, t.claims;
  end if;
end $$;

-- Remove one desk claim everywhere. A row is deleted only when no claims remain and its source is still a desk claim.
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
    where p_claim = any(s.claims)
    returning s.id
  ) select coalesce(array_agg(touched.id), '{}') into v_ids from touched;
  delete from public.outreach_suppressions s
   where s.id = any(v_ids) and cardinality(s.claims) = 0 and coalesce(s.source, '') like 'crm_visit:%';
  get diagnostics v_deleted = row_count;
  select count(*) into v_remaining from public.outreach_suppressions s where p_claim = any(s.claims);
  return query select cardinality(v_ids), v_deleted, v_remaining;
end $$;

revoke all on function public.outreach_suppress(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.outreach_release(text) from public, anon, authenticated;
grant execute on function public.outreach_suppress(text, text, text, text, text) to service_role;
grant execute on function public.outreach_release(text) to service_role;

comment on column public.outreach_suppressions.claims is 'Owner-desk claims (crm_visit:...) on this row. Write only through outreach_suppress(); release with outreach_release().';
comment on function public.outreach_suppress(text, text, text, text, text) is 'The one way to add to the do-not-contact list. Real reasons (source not crm_visit:%) take over a desk row; desk claims never replace a real reason and are tracked in claims.';
comment on function public.outreach_release(text) is 'Removes one owner-desk claim; deletes a row only when no claims remain and its source is still crm_visit:%.';
