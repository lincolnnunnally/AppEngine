// Pure fold for customer-website traffic — no fetch, no env, no `@/` imports,
// so `node --test` can exercise the real module. The rows are the `site_view`
// events AI Website Design writes to public.lpl_events (app_slug "aiwebsite"),
// one per page view on a live customer site, counting since 2026-10-22.
//
// Same rules as the app's own fold (ai-website-design src/lib/site-analytics.ts):
// a row without a site_id is skipped, a visitor is a distinct daily anon_id,
// "from search" is google + search_other. Counts only — no PII ever reaches here.

export const SITE_VIEW_APP_SLUG = "aiwebsite";
export const SITE_VIEW_EVENT = "site_view";
export const SITE_TRAFFIC_STARTED = "2026-10-22";

export type SiteViewRow = {
  anon_id: string | null;
  props: { site_id?: unknown; host?: unknown; source?: unknown } | null;
  created_at: string;
};

export type SiteTrafficTotals = {
  visits: number;
  visitors: number; // distinct daily visitor hashes in the window
  fromGoogle: number;
  fromSearch: number; // google + other search engines
  fromSocial: number;
  direct: number;
};

export type SiteTrafficRow = {
  siteId: string;
  host: string; // the host the most recent visit landed on
  visits: number;
  visitors: number;
  fromSearch: number;
  lastVisit: string; // ISO timestamp
};

export type SiteTrafficFold = {
  totals: SiteTrafficTotals;
  daily: Array<{ date: string; visits: number }>; // oldest first, one per UTC day, zero-filled
  sites: SiteTrafficRow[]; // most visits first
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function aggregateSiteVisits(rows: SiteViewRow[], opts: { days: number; now?: Date }): SiteTrafficFold {
  const now = opts.now ?? new Date();
  const days = Math.max(1, Math.floor(opts.days));
  const daily = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    daily.set(new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10), 0);
  }

  const totals: SiteTrafficTotals = { visits: 0, visitors: 0, fromGoogle: 0, fromSearch: 0, fromSocial: 0, direct: 0 };
  const everyone = new Set<string>();
  const perSite = new Map<string, SiteTrafficRow & { seen: Set<string> }>();

  for (const row of rows) {
    const props = row.props ?? {};
    const siteId = text(props.site_id);
    if (!siteId) continue;
    const source = text(props.source);
    const host = text(props.host);
    const searched = source === "google" || source === "search_other";

    totals.visits += 1;
    if (row.anon_id) everyone.add(row.anon_id);
    if (source === "google") totals.fromGoogle += 1;
    if (searched) totals.fromSearch += 1;
    if (source === "social") totals.fromSocial += 1;
    if (source === "direct") totals.direct += 1;

    let site = perSite.get(siteId);
    if (!site) {
      site = { siteId, host, visits: 0, visitors: 0, fromSearch: 0, lastVisit: "", seen: new Set() };
      perSite.set(siteId, site);
    }
    site.visits += 1;
    if (row.anon_id) site.seen.add(row.anon_id);
    if (searched) site.fromSearch += 1;
    if (!site.lastVisit || row.created_at > site.lastVisit) {
      site.lastVisit = row.created_at;
      if (host) site.host = host;
    }

    const day = (row.created_at || "").slice(0, 10);
    if (daily.has(day)) daily.set(day, (daily.get(day) ?? 0) + 1);
  }

  totals.visitors = everyone.size;
  const sites = [...perSite.values()]
    .map(({ seen, ...site }) => ({ ...site, visitors: seen.size }))
    .sort((a, b) => b.visits - a.visits || b.lastVisit.localeCompare(a.lastVisit));
  return { totals, daily: [...daily.entries()].map(([date, visits]) => ({ date, visits })), sites };
}

// awd_sites ids are uuids; anything else never reaches a PostgREST in.() list.
export function nameableSiteIds(sites: SiteTrafficRow[], limit: number): string[] {
  return sites
    .map((site) => site.siteId)
    .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    .slice(0, limit);
}
