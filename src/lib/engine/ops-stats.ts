// Ops stats collector — the "run the business" layer. AppEngine doesn't just
// build apps; it reports how each live app is DOING: user counts, open support
// tickets, recent orders. Generated apps expose /api/admin/stats (token-gated;
// the token is injected at deploy and kept on the build job), this collector
// polls those endpoints, caches the readings (self-creating table, same pattern
// as build jobs), and serves them to the owner dashboard. Apps that don't share
// stats yet are reported honestly as "Not reporting yet" — never a fake number.
// Counts only, never personal data, and tokens never leave the server. SERVER ONLY.
import { getDatabase } from "@/lib/db/client";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";
import { listDeployedBuildJobs } from "@/lib/engine/build-jobs";
import { listOwnerRegisteredApps } from "@/lib/engine/portfolio-registrations";
import { collectAttentionForApp, collectVercelDeployAttention, sortAttentionItems, type OpsAttentionItem } from "@/lib/engine/ops-attention";

// One day of app activity: customer events (payments + support tickets for
// generated apps; builds for AppEngine itself) counted per calendar day.
export type OpsActivityDay = { date: string; count: number };

export type AppOpsStats = {
  users: number | null;
  ticketsOpen: number | null;
  ordersRecent: number | null;
  // Deep-dive additions (2026-07-04). All optional-by-null: an app that
  // reports the original three keeps reporting; null renders as "Not
  // reported", never as zero — a fake number is worse than a blank.
  revenueCentsRecent: number | null; // sum of paid payments, last 30 days, minor units
  revenueCurrency: string | null; // ISO code the sum is in ("usd"); one currency per app
  activity: OpsActivityDay[] | null; // trailing 14 days of events, oldest first
};

export type OpsStatsRecord = {
  key: string; // stable cache key: "self", "app:<slug>", "job:<id>", "env:<host>"
  slug: string; // portfolio slug when known ("" when unknown)
  name: string;
  url: string; // base URL polled ("" for the in-process self reading)
  reporting: boolean; // true = the stats below are real, read from the app
  stats: AppOpsStats;
  note: string; // honest owner-readable state when not (fully) reporting
  needs: OpsAttentionItem[]; // what this app needs from the owner (attention checks)
  checkedAt: string | null;
};

export type OpsStatsSnapshot = {
  kind: "app_ops_stats";
  generatedAt: string;
  totalApps: number;
  reportingApps: number;
  apps: OpsStatsRecord[];
  // Every app's needs rolled into one sorted queue: act-on-this first.
  attention: OpsAttentionItem[];
};

// A reading older than this is re-polled on the next dashboard load; no cron
// needed on the free tier — reads refresh the cache when it goes stale.
const STALE_AFTER_MS = 10 * 60 * 1000;
// How long a last-good reading may stand in for a failing app before the
// display degrades to "not reporting" — smoothing one bad poll must never
// hide a real outage indefinitely.
const LAST_GOOD_MAX_AGE_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;

type OpsTarget = {
  key: string;
  slug: string;
  name: string;
  url: string;
  kind: "self" | "remote";
  token?: string;
  pollable: boolean;
  note: string;
  vercelProject?: string; // engine-deployed apps: enables the env-name audit
  generatedApp: boolean; // true = we know its required env contract
  live: boolean;
};

function emptyStats(): AppOpsStats {
  return { users: null, ticketsOpen: null, ordersRecent: null, revenueCentsRecent: null, revenueCurrency: null, activity: null };
}

function hostOf(value: string): string {
  try {
    return /^https?:\/\//.test(value) ? new URL(value).host.toLowerCase() : "";
  } catch {
    return "";
  }
}

function asCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}

function asCurrency(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z]{3}$/.test(value.trim()) ? value.trim().toLowerCase() : null;
}

// Sanitizes a reported activity series: only well-formed {date, count} days
// survive, capped at 31 entries, oldest first. Anything else is null — a
// malformed series from a remote app must not reach the dashboard.
function asActivity(value: unknown): OpsActivityDay[] | null {
  if (!Array.isArray(value)) return null;
  const days: OpsActivityDay[] = [];
  for (const entry of value.slice(0, 31)) {
    if (!entry || typeof entry !== "object") continue;
    const date = (entry as Record<string, unknown>).date;
    const count = asCount((entry as Record<string, unknown>).count);
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && count !== null) {
      days.push({ date, count });
    }
  }
  if (!days.length) return null;
  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  return days;
}

// Reads one target's /api/admin/stats with its bearer token. Best-effort: a
// down app or a bad token is a "not reporting" answer, never an exception.
export async function fetchStatsFromApp(
  baseUrl: string,
  token: string
): Promise<{ ok: boolean; stats?: AppOpsStats; error?: string }> {
  const statsUrl = `${baseUrl.replace(/\/+$/, "")}/api/admin/stats`;
  try {
    const response = await fetch(statsUrl, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store"
    });
    if (!response.ok) {
      return { ok: false, error: `the stats endpoint answered ${response.status}` };
    }
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      reporting?: boolean;
      users?: unknown;
      ticketsOpen?: unknown;
      ordersRecent?: unknown;
      revenueCentsRecent?: unknown;
      revenueCurrency?: unknown;
      activity?: unknown;
    } | null;
    if (!data || data.ok !== true) {
      return { ok: false, error: "the stats endpoint returned an unexpected payload" };
    }
    if (data.reporting === false) {
      return { ok: false, error: "the app answered but has no database connected yet" };
    }
    // Apps deployed before the deep-dive fields shipped simply omit them —
    // that parses to null, which the dashboard shows as "Not reported".
    // A revenue sum without its currency is not a fact: both or neither.
    const revenueCents = asCount(data.revenueCentsRecent);
    const revenueCurrency = asCurrency(data.revenueCurrency);
    const revenueReported = revenueCents !== null && revenueCurrency !== null;
    return {
      ok: true,
      stats: {
        users: asCount(data.users),
        ticketsOpen: asCount(data.ticketsOpen),
        ordersRecent: asCount(data.ordersRecent),
        revenueCentsRecent: revenueReported ? revenueCents : null,
        revenueCurrency: revenueReported ? revenueCurrency : null,
        activity: asActivity(data.activity)
      }
    };
  } catch {
    return { ok: false, error: "the app didn't answer its stats endpoint" };
  }
}

async function countOrNull(query: () => Promise<unknown>): Promise<number | null> {
  try {
    const rows = (await query()) as Array<Record<string, unknown>>;
    return rows.length ? Number(rows[0].n || 0) : 0;
  } catch {
    return null;
  }
}

async function activityOrNull(query: () => Promise<unknown>): Promise<OpsActivityDay[] | null> {
  try {
    const rows = (await query()) as Array<Record<string, unknown>>;
    return asActivity(rows.map((row) => ({ date: String(row.date || ""), count: Number(row.count || 0) })));
  } catch {
    return null;
  }
}

// AppEngine's own reading, straight from its own tables (no HTTP hop). The
// factory's "orders" are builds started in the last 30 days and its activity
// trend counts builds per day; it has no customer ticket queue yet, so that
// stays honestly null — as does revenue until the billing tables carry money.
export async function getSelfOpsStats(): Promise<{ reporting: boolean; stats: AppOpsStats; note: string }> {
  if (!getConfiguredDatabaseUrl()) {
    return { reporting: false, stats: emptyStats(), note: "Not reporting yet — no durable database in this environment." };
  }
  const sql = getDatabase();
  const users = await countOrNull(() => sql`select count(*)::int as n from users`);
  const buildsRecent = await countOrNull(
    () => sql`select count(*)::int as n from app_build_jobs where created_at > now() - interval '30 days'`
  );
  // Absent billing tables answer null (not zero): AppEngine reports revenue
  // the day real payment rows exist, and says "Not reported" until then.
  const revenueCents = await countOrNull(
    () => sql`select coalesce(sum(amount_cents), 0)::int as n from payments where status = 'paid' and created_at > now() - interval '30 days'`
  );
  const activity = await activityOrNull(
    () => sql`
      select to_char(created_at, 'YYYY-MM-DD') as date, count(*)::int as count
      from app_build_jobs
      where created_at > now() - interval '14 days'
      group by 1
      order by 1
    `
  );
  if (users === null && buildsRecent === null) {
    return { reporting: false, stats: emptyStats(), note: "Not reporting yet — couldn't read the platform database." };
  }
  return {
    reporting: true,
    stats: {
      users,
      ticketsOpen: null,
      ordersRecent: buildsRecent,
      revenueCentsRecent: revenueCents,
      revenueCurrency: revenueCents === null ? null : "usd",
      activity
    },
    note: ""
  };
}

// Optional, env-configured targets: lets any app that adopted the stats
// endpoint (e.g. an ecosystem app hosted elsewhere) report without a code
// change. JSON array: [{ "slug": "churchconnect", "name": "...", "url":
// "https://...", "token": "..." }]. Secrets stay in the environment, never git.
type EnvOpsTarget = { name: string; slug: string; url: string; token: string; vercelProject: string; used?: boolean };

function parseEnvTargets(): EnvOpsTarget[] {
  const raw = (process.env.APP_ENGINE_OPS_TARGETS || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map((entry) => ({
        name: typeof entry.name === "string" ? entry.name.trim() : "",
        slug: typeof entry.slug === "string" ? entry.slug.trim() : "",
        url: typeof entry.url === "string" ? entry.url.trim() : "",
        token: typeof entry.token === "string" ? entry.token.trim() : "",
        vercelProject: typeof entry.vercelProject === "string" ? entry.vercelProject.trim() : ""
      }))
      // A token makes the app pollable; a vercelProject alone still opts it
      // into the env-name audit — either is a valid reason to keep the entry.
      .filter((entry) => entry.url && (entry.token || entry.vercelProject));
  } catch {
    return [];
  }
}

// Every app the owner could care about, with a token when we have one:
// AppEngine itself, owner-registered live apps, engine-deployed builds, and
// env-configured extras — deduped by URL host so one app never shows twice.
async function collectOpsTargets(): Promise<OpsTarget[]> {
  const targets: OpsTarget[] = [
    { key: "self", slug: "appengine-core", name: "AppEngine Core", url: "", kind: "self", pollable: true, note: "", generatedApp: false, live: true }
  ];

  const envTargets = parseEnvTargets();
  const jobs = await listDeployedBuildJobs().catch(() => []);

  const jobByHost = new Map<string, { token: string | null; vercelProject: string | null }>();
  for (const job of jobs) {
    const info = { token: job.statsToken, vercelProject: job.vercelProject };
    const host = hostOf(job.url || "");
    if (host) jobByHost.set(host, info);
    if (job.vercelProject) jobByHost.set(`${job.vercelProject}.vercel.app`.toLowerCase(), info);
  }

  const seenHosts = new Set<string>();
  // One app must never appear twice: a registered app on a custom domain and
  // its engine build job share no host, but they do share a Vercel project.
  const seenProjects = new Set<string>();
  const registered = await listOwnerRegisteredApps().catch(() => []);
  for (const app of registered) {
    if (app.appStatus !== "live") continue;
    const host = hostOf(app.liveUrl);
    const envMatch = envTargets.find((entry) => (app.slug && entry.slug === app.slug) || (host && hostOf(entry.url) === host));
    if (envMatch) envMatch.used = true;
    const jobInfo = host ? jobByHost.get(host) : undefined;
    const url = app.liveUrl || envMatch?.url || "";
    const token = envMatch?.token || jobInfo?.token || undefined;
    const vercelProject = envMatch?.vercelProject || jobInfo?.vercelProject || undefined;
    if (host) seenHosts.add(host);
    if (vercelProject) seenProjects.add(vercelProject);
    targets.push({
      key: `app:${app.slug}`,
      slug: app.slug,
      name: app.name,
      url,
      kind: "remote",
      token,
      pollable: Boolean(token && url),
      note: token && url ? "" : "Not reporting yet — this app doesn't share ops stats with AppEngine.",
      vercelProject,
      generatedApp: Boolean(jobInfo),
      live: true
    });
  }

  for (const entry of envTargets) {
    if (entry.used) continue;
    const host = hostOf(entry.url);
    if (!host || seenHosts.has(host)) continue;
    seenHosts.add(host);
    if (entry.vercelProject) seenProjects.add(entry.vercelProject);
    targets.push({
      key: `env:${host}`,
      slug: entry.slug,
      name: entry.name || host,
      url: entry.url,
      kind: "remote",
      token: entry.token || undefined,
      pollable: Boolean(entry.token),
      note: entry.token ? "" : "Not reporting yet — this app doesn't share ops stats with AppEngine.",
      vercelProject: entry.vercelProject || undefined,
      generatedApp: false,
      live: true
    });
  }

  for (const job of jobs) {
    const host = hostOf(job.url || "");
    if (!host || seenHosts.has(host)) continue;
    if (job.vercelProject && seenProjects.has(job.vercelProject)) continue;
    seenHosts.add(host);
    targets.push({
      key: `job:${job.id}`,
      slug: "",
      name: job.vercelProject || job.idea.slice(0, 60) || job.id,
      url: job.url || "",
      kind: "remote",
      token: job.statsToken || undefined,
      pollable: Boolean(job.statsToken && job.url),
      note: job.statsToken ? "" : "Not reporting yet — this app was deployed before ops reporting shipped.",
      vercelProject: job.vercelProject || undefined,
      generatedApp: true,
      // A job mid-deploy or failed being unreachable is normal, not attention.
      live: job.status === "live"
    });
  }

  return targets;
}

// ---- cache (self-creating table on prod, in-memory map without a DB) ----------

const memoryCache = new Map<string, OpsStatsRecord>();

let cacheTableReady: Promise<void> | null = null;
async function ensureCacheTable(sql: ReturnType<typeof getDatabase>): Promise<void> {
  if (!cacheTableReady) {
    cacheTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS app_ops_stats_cache (
          app_key text PRIMARY KEY,
          slug text NOT NULL DEFAULT '',
          name text NOT NULL DEFAULT '',
          url text NOT NULL DEFAULT '',
          reporting boolean NOT NULL DEFAULT false,
          users integer,
          tickets_open integer,
          orders_recent integer,
          note text NOT NULL DEFAULT '',
          checked_at timestamptz
        )
      `;
      // Self-applying column add for caches created before the attention checks shipped.
      await sql`ALTER TABLE app_ops_stats_cache ADD COLUMN IF NOT EXISTS needs jsonb`;
      // Self-applying columns for the deep-dive fields (2026-07-04): rows
      // written before then read back as NULL = "not reported", never zero.
      await sql`ALTER TABLE app_ops_stats_cache ADD COLUMN IF NOT EXISTS revenue_cents_recent integer`;
      await sql`ALTER TABLE app_ops_stats_cache ADD COLUMN IF NOT EXISTS revenue_currency text`;
      await sql`ALTER TABLE app_ops_stats_cache ADD COLUMN IF NOT EXISTS activity jsonb`;
    })().catch((error) => {
      cacheTableReady = null;
      throw error;
    });
  }
  return cacheTableReady;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function rowToRecord(row: Record<string, unknown>): OpsStatsRecord {
  // A row written before the attention checks shipped has needs = NULL — that
  // is "never checked", NOT "checked and all clear". Marking it stale (no
  // checkedAt) forces a real check on the next load instead of a false blank.
  const needsMissing = !Array.isArray(row.needs);
  return {
    key: String(row.app_key),
    slug: String(row.slug || ""),
    name: String(row.name || ""),
    url: String(row.url || ""),
    reporting: Boolean(row.reporting),
    stats: {
      users: asCount(row.users === null ? undefined : Number(row.users)),
      ticketsOpen: asCount(row.tickets_open === null ? undefined : Number(row.tickets_open)),
      ordersRecent: asCount(row.orders_recent === null ? undefined : Number(row.orders_recent)),
      revenueCentsRecent: asCount(row.revenue_cents_recent === null ? undefined : Number(row.revenue_cents_recent)),
      revenueCurrency: asCurrency(row.revenue_currency),
      activity: asActivity(row.activity)
    },
    note: String(row.note || ""),
    needs: needsMissing ? [] : (row.needs as OpsAttentionItem[]),
    checkedAt: needsMissing ? null : toIso(row.checked_at)
  };
}

async function readCache(): Promise<Map<string, OpsStatsRecord>> {
  if (!getConfiguredDatabaseUrl()) return new Map(memoryCache);
  try {
    const sql = getDatabase();
    await ensureCacheTable(sql);
    const rows = (await sql`select * from app_ops_stats_cache limit 200`) as Array<Record<string, unknown>>;
    return new Map(rows.map((row) => [String(row.app_key), rowToRecord(row)]));
  } catch {
    return new Map(memoryCache);
  }
}

async function writeCache(records: OpsStatsRecord[]): Promise<void> {
  for (const record of records) memoryCache.set(record.key, record);
  if (!getConfiguredDatabaseUrl() || !records.length) return;
  try {
    const sql = getDatabase();
    await ensureCacheTable(sql);
    for (const record of records) {
      await sql`
        insert into app_ops_stats_cache (app_key, slug, name, url, reporting, users, tickets_open, orders_recent,
                                         revenue_cents_recent, revenue_currency, activity, note, needs, checked_at)
        values (${record.key}, ${record.slug}, ${record.name}, ${record.url}, ${record.reporting},
                ${record.stats.users}, ${record.stats.ticketsOpen}, ${record.stats.ordersRecent},
                ${record.stats.revenueCentsRecent}, ${record.stats.revenueCurrency},
                ${record.stats.activity === null ? null : JSON.stringify(record.stats.activity)}::jsonb,
                ${record.note}, ${JSON.stringify(record.needs)}::jsonb, ${record.checkedAt})
        on conflict (app_key) do update set
          slug = excluded.slug,
          name = excluded.name,
          url = excluded.url,
          reporting = excluded.reporting,
          users = excluded.users,
          tickets_open = excluded.tickets_open,
          orders_recent = excluded.orders_recent,
          revenue_cents_recent = excluded.revenue_cents_recent,
          revenue_currency = excluded.revenue_currency,
          activity = excluded.activity,
          note = excluded.note,
          needs = excluded.needs,
          checked_at = excluded.checked_at
      `;
    }
  } catch {
    // The cache is best-effort; a failed write just means a re-poll next time.
  }
}

// ---- the snapshot the dashboard reads -----------------------------------------

async function pollTarget(target: OpsTarget, cached: OpsStatsRecord | null): Promise<OpsStatsRecord> {
  const base = { key: target.key, slug: target.slug, name: target.name, url: target.url };

  let reporting = false;
  let stats = emptyStats();
  let note = target.note;
  // What actually happened THIS cycle — the attention checks get this truth,
  // never the display flag (a cached last-good reading must not convince the
  // unreachable check that a dead app is alive).
  let answeredThisCycle = false;
  let checkedAt = new Date().toISOString();

  if (target.kind === "self") {
    const self = await getSelfOpsStats();
    reporting = self.reporting;
    answeredThisCycle = self.reporting;
    stats = self.stats;
    note = self.note;
  } else if (target.pollable) {
    const result = await fetchStatsFromApp(target.url, target.token || "");
    const lastGoodAgeMs = cached?.reporting && cached.checkedAt ? Date.now() - Date.parse(cached.checkedAt) : Number.POSITIVE_INFINITY;
    if (result.ok && result.stats) {
      reporting = true;
      answeredThisCycle = true;
      stats = result.stats;
      note = "";
    } else if (cached && cached.reporting && lastGoodAgeMs < LAST_GOOD_MAX_AGE_MS) {
      // Keep the last good reading rather than blanking the card on one bad
      // poll — but keep ITS timestamp (the "as of" stays honest) so the cache
      // row stays stale and the next load re-polls immediately.
      reporting = true;
      stats = cached.stats;
      note = `Couldn't reach it just now (${result.error || "no answer"}) — showing the last good reading.`;
      checkedAt = cached.checkedAt || checkedAt;
    } else if (cached && cached.reporting) {
      // It has now been failing for over an hour: stop presenting old numbers.
      note = `Not reporting — it stopped answering (last good reading ${cached.checkedAt || "unknown"}).`;
    } else {
      note = `Not reporting yet — ${result.error || "the app didn't answer"}.`;
    }
  }

  // Attention checks run for EVERY app with something to check — pollable or
  // not, an unreachable live URL or a missing env var is exactly what Lincoln
  // must not have to dig for.
  const needs = await collectAttentionForApp(
    {
      appKey: target.key,
      slug: target.slug,
      appName: target.name,
      url: target.url,
      vercelProject: target.vercelProject,
      generatedApp: target.generatedApp,
      live: target.live,
      reporting: answeredThisCycle,
      everReporting: answeredThisCycle || Boolean(cached?.reporting)
    },
    cached?.needs || []
  ).catch(() => [] as OpsAttentionItem[]);

  return { ...base, reporting, stats, note, needs, checkedAt };
}

// Account-wide deploy sweep, memory-cached on the same staleness window as the
// app cache — one cheap Vercel call, but no need to repeat it on every read.
// (collectVercelDeployAttention never throws; a failed sweep comes back as an
// honest watch item, and caching that failure for the window is fine.)
let deploySweepCache: { items: OpsAttentionItem[]; at: number } | null = null;

async function getDeploySweep(refresh: boolean): Promise<OpsAttentionItem[]> {
  if (!refresh && deploySweepCache && Date.now() - deploySweepCache.at < STALE_AFTER_MS) return deploySweepCache.items;
  const items = await collectVercelDeployAttention().catch(() => [] as OpsAttentionItem[]);
  deploySweepCache = { items, at: Date.now() };
  return items;
}

export async function getOpsSnapshot(options: { refresh?: boolean } = {}): Promise<OpsStatsSnapshot> {
  const targets = await collectOpsTargets();
  const cache = await readCache();
  const now = Date.now();
  const polled: OpsStatsRecord[] = [];

  const [records, deployAttention] = await Promise.all([
    Promise.all(
      targets.map(async (target) => {
        const cached = cache.get(target.key) || null;
        const freshEnough = Boolean(
          cached && cached.checkedAt && now - Date.parse(cached.checkedAt) < STALE_AFTER_MS
        );
        if (cached && freshEnough && !options.refresh) {
          return { ...cached, slug: target.slug, name: target.name, url: target.url };
        }
        const record = await pollTarget(target, cached);
        polled.push(record);
        return record;
      })
    ),
    getDeploySweep(Boolean(options.refresh))
  ]);

  await writeCache(polled);

  return {
    kind: "app_ops_stats",
    generatedAt: new Date().toISOString(),
    totalApps: records.length,
    reportingApps: records.filter((record) => record.reporting).length,
    apps: records,
    attention: sortAttentionItems([...records.flatMap((record) => record.needs), ...deployAttention])
  };
}
