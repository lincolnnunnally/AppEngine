// Customer-website traffic for the owner cockpit. Reads the `site_view` rows
// AI Website Design records on every live customer site (public.lpl_events on
// the shared LPL Supabase) and folds the last 30 days into totals, a daily
// series, and the busiest sites, named from awd_sites. Counts only — the row
// select never asks for path, referrer, country, or device. SERVER ONLY.
import { getLplConfig } from "@/lib/engine/lpl-ops-stats";
import {
  aggregateSiteVisits,
  nameableSiteIds,
  SITE_TRAFFIC_STARTED,
  SITE_VIEW_APP_SLUG,
  SITE_VIEW_EVENT,
  type SiteTrafficRow,
  type SiteTrafficTotals,
  type SiteViewRow
} from "@/lib/engine/site-traffic-core";

export { SITE_TRAFFIC_STARTED };

const WINDOW_DAYS = 30;
const PAGE = 1000;
const MAX_ROWS = 50_000;
const NAMED_SITES = 25;

export type NamedSiteTraffic = SiteTrafficRow & {
  name: string | null;
  address: string; // custom domain when set, else the host the visits landed on
};

export type SiteTrafficReport =
  | {
      state: "ok";
      days: number;
      since: string;
      totals: SiteTrafficTotals;
      daily: Array<{ date: string; visits: number }>;
      sites: NamedSiteTraffic[]; // top NAMED_SITES by visits
      siteCount: number; // every site with at least one visit
      truncated: boolean; // hit MAX_ROWS — numbers are a floor
    }
  | { state: "not_connected" }
  | { state: "error"; message: string };

function headers(serviceKey: string): Record<string, string> {
  return { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, accept: "application/json" };
}

export async function loadSiteTraffic(): Promise<SiteTrafficReport> {
  const config = getLplConfig();
  if (!config) return { state: "not_connected" };
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

  const rows: SiteViewRow[] = [];
  let truncated = false;
  try {
    const base =
      `${config.url}/rest/v1/lpl_events?app_slug=eq.${SITE_VIEW_APP_SLUG}` +
      `&event_name=eq.${SITE_VIEW_EVENT}&created_at=gte.${encodeURIComponent(since)}` +
      `&select=anon_id,props,created_at&order=created_at.asc`;
    for (let offset = 0; ; offset += PAGE) {
      if (offset >= MAX_ROWS) {
        truncated = true;
        break;
      }
      const response = await fetch(`${base}&limit=${PAGE}&offset=${offset}`, {
        headers: headers(config.serviceKey),
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) return { state: "error", message: `lpl_events answered ${response.status}` };
      const page = (await response.json()) as SiteViewRow[];
      rows.push(...page);
      if (page.length < PAGE) break;
    }
  } catch (error) {
    return { state: "error", message: error instanceof Error ? error.message : "lpl_events did not answer" };
  }

  const fold = aggregateSiteVisits(rows, { days: WINDOW_DAYS });
  const top = fold.sites.slice(0, NAMED_SITES);
  const names = await loadSiteNames(config.url, config.serviceKey, nameableSiteIds(top, NAMED_SITES));
  return {
    state: "ok",
    days: WINDOW_DAYS,
    since,
    totals: fold.totals,
    daily: fold.daily,
    sites: top.map((site) => {
      const named = names.get(site.siteId);
      return { ...site, name: named?.name ?? null, address: named?.custom_domain || site.host };
    }),
    siteCount: fold.sites.length,
    truncated
  };
}

type SiteName = { id: string; name: string | null; slug: string | null; custom_domain: string | null };

// A name lookup that fails leaves the row on its host — never a guessed name.
async function loadSiteNames(url: string, serviceKey: string, ids: string[]): Promise<Map<string, SiteName>> {
  const out = new Map<string, SiteName>();
  if (!ids.length) return out;
  try {
    const response = await fetch(
      `${url}/rest/v1/awd_sites?id=in.(${ids.join(",")})&select=id,name,slug,custom_domain`,
      { headers: headers(serviceKey), cache: "no-store", signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return out;
    const data = (await response.json()) as SiteName[];
    for (const row of Array.isArray(data) ? data : []) out.set(row.id, row);
  } catch {
    // names are a nicety; the counts stand without them
  }
  return out;
}
