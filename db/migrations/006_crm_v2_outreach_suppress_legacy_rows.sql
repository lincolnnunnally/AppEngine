-- Applied to LPL Supabase (uqhqulrqcygsmmzdzemx) as migration 20261017155802 "crm_v2_outreach_suppress_legacy_rows" on 2026-10-17.
-- Body copied verbatim from supabase_migrations.schema_migrations. Already applied; do not re-run by hand.

-- A desk claim added to a pre-claims desk row (source crm_visit:X, claims empty) keeps X as a claim too.
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
        claims = case when v_desk and not (excluded.source = any(t.claims)) then (case when cardinality(t.claims) = 0 and coalesce(t.source, '') like 'crm_visit:%' and t.source <> excluded.source then array[t.source] when cardinality(t.claims) = 0 and t.source = excluded.source then '{}'::text[] else t.claims end) || excluded.source else t.claims end,
        reason = case when not v_desk and coalesce(t.source, '') like 'crm_visit:%' then excluded.reason else t.reason end,
        source = case when not v_desk and coalesce(t.source, '') like 'crm_visit:%' then excluded.source else t.source end
      returning t.id, t.source, t.reason, t.claims;
  elsif p_domain is not null then
    return query insert into public.outreach_suppressions as t (domain, brand, reason, source, claims)
      values (p_domain, 'all', p_reason, p_source, v_claims)
      on conflict ((lower(domain))) where domain is not null do update set
        claims = case when v_desk and not (excluded.source = any(t.claims)) then (case when cardinality(t.claims) = 0 and coalesce(t.source, '') like 'crm_visit:%' and t.source <> excluded.source then array[t.source] when cardinality(t.claims) = 0 and t.source = excluded.source then '{}'::text[] else t.claims end) || excluded.source else t.claims end,
        reason = case when not v_desk and coalesce(t.source, '') like 'crm_visit:%' then excluded.reason else t.reason end,
        source = case when not v_desk and coalesce(t.source, '') like 'crm_visit:%' then excluded.source else t.source end
      returning t.id, t.source, t.reason, t.claims;
  else
    return query insert into public.outreach_suppressions as t (phone, brand, reason, source, claims)
      values (p_phone, 'all', p_reason, p_source, v_claims)
      on conflict (phone) where phone is not null do update set
        claims = case when v_desk and not (excluded.source = any(t.claims)) then (case when cardinality(t.claims) = 0 and coalesce(t.source, '') like 'crm_visit:%' and t.source <> excluded.source then array[t.source] when cardinality(t.claims) = 0 and t.source = excluded.source then '{}'::text[] else t.claims end) || excluded.source else t.claims end,
        reason = case when not v_desk and coalesce(t.source, '') like 'crm_visit:%' then excluded.reason else t.reason end,
        source = case when not v_desk and coalesce(t.source, '') like 'crm_visit:%' then excluded.source else t.source end
      returning t.id, t.source, t.reason, t.claims;
  end if;
end $$;

revoke all on function public.outreach_suppress(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.outreach_suppress(text, text, text, text, text) to service_role;
