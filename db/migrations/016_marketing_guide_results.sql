-- Guide results for /marketing (owner, 2026-11-24): "make sure we can track the traffic we get from these
-- posts and we can learn from what gets the most attention ... and actually get customers."
--
-- Site keys are lpl_articles.app; tracker slugs from scripts/lib/ecosystem-apps.mjs (rally and spark-of-hope
-- have no tracker yet). One row per guide per site, from the shared first-party tracker (public.lpl_events) and the shared
-- library (public.lpl_articles), over the last p_days:
--   views      page_view rows on /guides/<slug> (any prefix, any trailing slash)
--   visitors   distinct anon_ids among those views
--   clicks     visits that landed from the guide's call-to-action (utm_source=guide, utm_campaign=<slug>;
--              the Ideas app tags every business guide's CTA link this way)
--   signups    distinct visitors with signup_completed who came from this guide: either the event carries
--              the guide's utm, or the same visitor viewed the guide earlier on the same site
--   payments   the same, for payment_completed
-- Hand-written guides (not in lpl_articles) still get a row from their page views; their title is null.
-- Titles and counts only: no visitor ids leave the function. Service role only.
-- One visitor can be credited to every guide they read, so per-guide sign-ups and sales can overlap; site
-- totals come from marketing_site_results below, which counts each visitor once per site and has no limit.

create or replace function public.marketing_guide_results(p_days integer default 30)
returns table (
  site text, slug text, title text, published_at timestamptz,
  views bigint, visitors bigint, clicks bigint, signups bigint, payments bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with map(site, app_slug) as (
    values ('furfriend', 'furfriend'), ('kidsafe', 'kidsafe'), ('laser', 'laser'), ('easypeazy', 'easypeazy'),
           ('ai-website-design', 'aiwebsite'), ('churchconnect', 'churchconnect'), ('uug', 'uug'),
           ('sanctuary-avl', 'sanctuary-avl'), ('commons', 'commons'),
           ('kids-need-dads', 'knd'), ('best-life', 'bestlife')
  ),
  ev as (
    select m.site, e.event_name, e.anon_id, e.session_id, e.path, e.utm, e.created_at
    from public.lpl_events e
    join map m on m.app_slug = e.app_slug
    where e.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
  ),
  guide_views as (
    -- /guides/<slug> on the business sites, /articles/<slug> where a site publishes there (uug)
    select site, substring(path from '/(?:guides|articles)/([^/?#]+)') as slug, anon_id, created_at
    from ev
    where event_name = 'page_view' and path ~ '/(guides|articles)/[^/?#]+'
  ),
  views as (
    select site, slug, count(*)::bigint as views, count(distinct anon_id)::bigint as visitors
    from guide_views group by 1, 2
  ),
  clicks as (
    select site, utm->>'utm_campaign' as slug, count(distinct coalesce(session_id, anon_id))::bigint as clicks
    from ev
    where event_name = 'page_view' and utm->>'utm_source' = 'guide' and coalesce(utm->>'utm_campaign', '') <> ''
    group by 1, 2
  ),
  first_view as (
    select site, slug, anon_id, min(created_at) as first_at
    from guide_views where anon_id is not null group by 1, 2, 3
  ),
  converted as (
    -- came through the guide's tagged link
    select site, utm->>'utm_campaign' as slug, anon_id, event_name
    from ev
    where event_name in ('signup_completed', 'payment_completed')
      and utm->>'utm_source' = 'guide' and coalesce(utm->>'utm_campaign', '') <> ''
    union
    -- read the guide first, converted later on the same site
    select f.site, f.slug, c.anon_id, c.event_name
    from first_view f
    join ev c on c.site = f.site and c.anon_id = f.anon_id and c.created_at >= f.first_at
    where c.event_name in ('signup_completed', 'payment_completed')
  ),
  conv as (
    select site, slug,
           count(distinct anon_id) filter (where event_name = 'signup_completed')::bigint as signups,
           count(distinct anon_id) filter (where event_name = 'payment_completed')::bigint as payments
    from converted group by 1, 2
  ),
  keys as (
    select site, slug from views
    union select site, slug from clicks
    union select site, slug from conv
    union
    select a.app, a.slug from public.lpl_articles a
    join map m on m.site = a.app
    where a.status = 'published'
      and coalesce(a.published_at, a.publish_at) > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
      and coalesce(a.published_at, a.publish_at) <= now()
  )
  select k.site, k.slug, a.title, coalesce(a.published_at, a.publish_at),
         coalesce(v.views, 0), coalesce(v.visitors, 0), coalesce(c.clicks, 0),
         coalesce(cv.signups, 0), coalesce(cv.payments, 0)
  from keys k
  left join public.lpl_articles a on a.app = k.site and a.slug = k.slug and a.status = 'published'
  left join views v on v.site = k.site and v.slug = k.slug
  left join clicks c on c.site = k.site and c.slug = k.slug
  left join conv cv on cv.site = k.site and cv.slug = k.slug
  where k.slug is not null and k.slug <> ''
  order by coalesce(cv.payments, 0) desc, coalesce(cv.signups, 0) desc, coalesce(c.clicks, 0) desc,
           coalesce(v.views, 0) desc
  limit 300;
$$;

revoke all on function public.marketing_guide_results(integer) from public, anon, authenticated;
grant execute on function public.marketing_guide_results(integer) to service_role;

-- Per site, over the last p_days: guide/article views, clicks through tagged guide links, and distinct
-- visitors who signed up or paid after coming through a guide link or reading a guide first.
create or replace function public.marketing_site_results(p_days integer default 30)
returns table (site text, guides bigint, views bigint, clicks bigint, signups bigint, payments bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with map(site, app_slug) as (
    values ('furfriend', 'furfriend'), ('kidsafe', 'kidsafe'), ('laser', 'laser'), ('easypeazy', 'easypeazy'),
           ('ai-website-design', 'aiwebsite'), ('churchconnect', 'churchconnect'), ('uug', 'uug'),
           ('sanctuary-avl', 'sanctuary-avl'), ('commons', 'commons'),
           ('kids-need-dads', 'knd'), ('best-life', 'bestlife')
  ),
  ev as (
    select m.site, e.event_name, e.anon_id, e.session_id, e.path, e.utm, e.created_at
    from public.lpl_events e
    join map m on m.app_slug = e.app_slug
    where e.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
  ),
  guide_views as (
    select site, substring(path from '/(?:guides|articles)/([^/?#]+)') as slug, anon_id, created_at
    from ev
    where event_name = 'page_view' and path ~ '/(guides|articles)/[^/?#]+'
  ),
  readers as (
    select site, anon_id, min(created_at) as first_at
    from guide_views where anon_id is not null group by 1, 2
  ),
  converted as (
    select site, anon_id, event_name
    from ev
    where event_name in ('signup_completed', 'payment_completed')
      and utm->>'utm_source' = 'guide' and coalesce(utm->>'utm_campaign', '') <> ''
    union
    select r.site, c.anon_id, c.event_name
    from readers r
    join ev c on c.site = r.site and c.anon_id = r.anon_id and c.created_at >= r.first_at
    where c.event_name in ('signup_completed', 'payment_completed')
  )
  select m.site,
         (select count(distinct slug) from guide_views g where g.site = m.site)::bigint,
         (select count(*) from guide_views g where g.site = m.site)::bigint,
         (select count(distinct coalesce(session_id, anon_id)) from ev e
           where e.site = m.site and e.event_name = 'page_view' and e.utm->>'utm_source' = 'guide'
             and coalesce(e.utm->>'utm_campaign', '') <> '')::bigint,
         (select count(distinct anon_id) from converted c where c.site = m.site and c.event_name = 'signup_completed')::bigint,
         (select count(distinct anon_id) from converted c where c.site = m.site and c.event_name = 'payment_completed')::bigint
  from (select distinct site from map) m;
$$;

revoke all on function public.marketing_site_results(integer) from public, anon, authenticated;
grant execute on function public.marketing_site_results(integer) to service_role;
