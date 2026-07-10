// Domain inventory — ONE place for every domain Lincoln owns, whichever
// registrar holds it (Spaceship, eNom, DreamHost, …). DB-backed (house
// lazy-ensure pattern, same as env-vault); seeded suggestions come from the
// facts already recorded in source-of-truth docs and the URL-status registry,
// and Cloudflare can be pulled live (its token is already an engine-runtime
// key). Registrars without a usable API (eNom, DreamHost) stay manual entry.
// SERVER ONLY.
import { getDatabase } from "@/lib/db/client";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";

function hasDatabase(): boolean {
  return Boolean(getConfiguredDatabaseUrl());
}

export type DomainRecord = {
  domain: string;
  registrar: string;
  dnsHost: string;
  appSlug: string;
  status: string;
  expiresOn: string | null; // ISO date
  nameServers: string; // comma-separated, from RDAP/Cloudflare or hand-entered
  notes: string;
  updatedAt: string | null;
};

// What the ecosystem already knows (source-of-truth/ecosystem-portfolio-registry.json,
// unitedundergod-subdomain-dns-plan.md, ecosystem-completion-prep.md — facts as of
// 2026-07-09). Rendered as one-click "add to inventory" suggestions, NOT auto-written.
export const KNOWN_DOMAIN_SEEDS: ReadonlyArray<Omit<DomainRecord, "updatedAt" | "nameServers">> = [
  { domain: "unitedundergod.org", registrar: "Spaceship", dnsHost: "Cloudflare", appSlug: "united-under-god", status: "live (WordPress + app subdomains)", expiresOn: null, notes: "NS moved to Cloudflare 2026-07; WP + mail stay on DreamHost hosts" },
  { domain: "we-succeed.org", registrar: "Spaceship", dnsHost: "Vercel", appSlug: "appengine", status: "live (to be repurposed)", expiresOn: null, notes: "Owner: will be used for something else; cockpit moves to appengine.unitedundergod.org" },
  { domain: "churchconnect.cloud", registrar: "Spaceship", dnsHost: "Vercel", appSlug: "churchconnect", status: "live", expiresOn: null, notes: "" },
  { domain: "kidsneeddad.com", registrar: "eNom", dnsHost: "Netlify", appSlug: "kids-need-dads", status: "live (Netlify)", expiresOn: "2027-03-01", notes: "Singular; the plural kidsneeddads.com was never ours" },
  { domain: "easypeazy.site", registrar: "Spaceship", dnsHost: "Cloudflare", appSlug: "easy-peasy-website", status: "live", expiresOn: null, notes: "" },
  { domain: "live-on-mission.com", registrar: "Spaceship", dnsHost: "Cloudflare", appSlug: "live-on-mission", status: "live", expiresOn: null, notes: ".org variant unregistered" },
  { domain: "best-life.us", registrar: "DreamHost", dnsHost: "DreamHost", appSlug: "best-life", status: "owned, parked", expiresOn: null, notes: "" },
  { domain: "milstead.us", registrar: "Spaceship", dnsHost: "LiteSpeed host", appSlug: "milstead", status: "owned, WordPress stub", expiresOn: "2027-01-09", notes: "Community site — distinct from milstead.church" },
  { domain: "milstead.church", registrar: "DreamHost", dnsHost: "DreamHost", appSlug: "milstead-church", status: "owned", expiresOn: null, notes: "Church tenant — distinct from milstead.us" },
  { domain: "snip.show", registrar: "Spaceship", dnsHost: "—", appSlug: "snip-show", status: "owned, nothing serving", expiresOn: null, notes: "" },
  { domain: "toner.management", registrar: "Spaceship", dnsHost: "Vercel", appSlug: "toner-management", status: "live", expiresOn: null, notes: "" },
  { domain: "engrave.market", registrar: "DreamHost", dnsHost: "DreamHost", appSlug: "laser-engrave-market", status: "owned, DNS set, nothing serving", expiresOn: null, notes: "laser.engrave.market is the intended app host" },
  { domain: "spark-of-hope.com", registrar: "Spaceship", dnsHost: "—", appSlug: "spark-of-hope", status: "owned, zero DNS", expiresOn: null, notes: "Registrar per D9 decision doc" }
];

let ensured = false;
async function ensureTable() {
  if (ensured || !hasDatabase()) return;
  const sql = getDatabase();
  await sql`
    create table if not exists app_domain_inventory (
      domain text primary key,
      registrar text not null default '',
      dns_host text not null default '',
      app_slug text not null default '',
      status text not null default '',
      expires_on date,
      notes text not null default '',
      updated_at timestamptz not null default now()
    )
  `;
  // Columns added after first ship (safe on every start).
  await sql`alter table app_domain_inventory add column if not exists name_servers text not null default ''`;
  ensured = true;
}

export function domainInventoryAvailable(): boolean {
  return hasDatabase();
}

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

export function isValidDomainName(raw: string): boolean {
  const domain = normalizeDomain(raw);
  return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain);
}

export async function listDomainInventory(): Promise<DomainRecord[]> {
  if (!hasDatabase()) return [];
  await ensureTable();
  const sql = getDatabase();
  const rows = await sql`select * from app_domain_inventory order by domain asc`;
  return rows.map((row) => ({
    domain: String(row.domain),
    registrar: String(row.registrar || ""),
    dnsHost: String(row.dns_host || ""),
    appSlug: String(row.app_slug || ""),
    status: String(row.status || ""),
    // The driver returns DATE columns as JS Date objects — format locally
    // (toISOString would shift a day in negative-UTC-offset timezones).
    nameServers: String(row.name_servers || ""),
    expiresOn:
      row.expires_on instanceof Date
        ? `${row.expires_on.getFullYear()}-${String(row.expires_on.getMonth() + 1).padStart(2, "0")}-${String(row.expires_on.getDate()).padStart(2, "0")}`
        : row.expires_on
          ? String(row.expires_on).slice(0, 10)
          : null,
    notes: String(row.notes || ""),
    updatedAt: row.updated_at ? String(row.updated_at) : null
  }));
}

export async function upsertDomain(input: Partial<DomainRecord> & { domain: string }): Promise<{ ok: boolean; message: string }> {
  if (!hasDatabase()) return { ok: false, message: "Domain storage isn't available (no database)." };
  const domain = normalizeDomain(input.domain);
  if (!isValidDomainName(domain)) return { ok: false, message: `"${input.domain}" doesn't look like a domain name.` };
  await ensureTable();
  const sql = getDatabase();
  // COALESCE against the existing row so a partial update (e.g. the Cloudflare
  // pull knowing only dns_host) never blanks fields entered by hand.
  await sql`
    insert into app_domain_inventory (domain, registrar, dns_host, app_slug, status, expires_on, name_servers, notes, updated_at)
    values (
      ${domain}, ${input.registrar ?? ""}, ${input.dnsHost ?? ""}, ${input.appSlug ?? ""},
      ${input.status ?? ""}, ${input.expiresOn ?? null}, ${input.nameServers ?? ""}, ${input.notes ?? ""}, now()
    )
    on conflict (domain) do update set
      registrar = case when ${input.registrar === undefined} then app_domain_inventory.registrar else excluded.registrar end,
      dns_host = case when ${input.dnsHost === undefined} then app_domain_inventory.dns_host else excluded.dns_host end,
      app_slug = case when ${input.appSlug === undefined} then app_domain_inventory.app_slug else excluded.app_slug end,
      status = case when ${input.status === undefined} then app_domain_inventory.status else excluded.status end,
      expires_on = case when ${input.expiresOn === undefined} then app_domain_inventory.expires_on else excluded.expires_on end,
      name_servers = case when ${input.nameServers === undefined} then app_domain_inventory.name_servers else excluded.name_servers end,
      notes = case when ${input.notes === undefined} then app_domain_inventory.notes else excluded.notes end,
      updated_at = now()
  `;
  return { ok: true, message: `${domain} saved.` };
}

export async function removeDomain(domain: string): Promise<void> {
  if (!hasDatabase()) return;
  await ensureTable();
  const sql = getDatabase();
  await sql`delete from app_domain_inventory where domain = ${normalizeDomain(domain)}`;
}

// Live pull: every zone in the Cloudflare account (the token already manages
// unitedundergod.org and other moved zones). Upserts dns_host/status only —
// registrar and app fields stay whatever the owner recorded. eNom and DreamHost
// have no usable API here; those stay manual, as does Spaceship until its list
// endpoint is wired.
export async function pullCloudflareZones(): Promise<{ ok: boolean; message: string; found: number }> {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) return { ok: false, message: "Cloudflare token isn't available to the engine yet (add CLOUDFLARE_API_TOKEN in Your keys).", found: 0 };
  if (!hasDatabase()) return { ok: false, message: "Domain storage isn't available (no database).", found: 0 };
  try {
    // Paginate — one page would silently drop zones past 50 while reporting success.
    const zones: Array<{ name?: string; status?: string; original_registrar?: string | null; name_servers?: string[] }> = [];
    for (let page = 1; page <= 10; page += 1) {
      const response = await fetch(`https://api.cloudflare.com/client/v4/zones?per_page=50&page=${page}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (!response.ok) return { ok: false, message: `Cloudflare said ${response.status} — check the token's zone permissions.`, found: 0 };
      const data = (await response.json()) as {
        result?: Array<{ name?: string; status?: string; original_registrar?: string | null; name_servers?: string[] }>;
        result_info?: { page?: number; total_pages?: number };
      };
      zones.push(...(data.result ?? []));
      const totalPages = data.result_info?.total_pages ?? 1;
      if ((data.result_info?.page ?? page) >= totalPages) break;
    }
    for (const zone of zones) {
      if (!zone.name) continue;
      await upsertDomain({
        domain: zone.name,
        dnsHost: "Cloudflare",
        status: zone.status === "active" ? "DNS on Cloudflare" : `Cloudflare: ${zone.status ?? "unknown"}`,
        ...(zone.original_registrar ? { registrar: zone.original_registrar } : {}),
        ...(zone.name_servers?.length ? { nameServers: zone.name_servers.join(", ") } : {})
      });
    }
    return { ok: true, message: `Pulled ${zones.length} zone${zones.length === 1 ? "" : "s"} from Cloudflare.`, found: zones.length };
  } catch {
    return { ok: false, message: "Couldn't reach Cloudflare just now — try again.", found: 0 };
  }
}

// One-click sweep: refresh every row's public-registry facts, stalest first so
// repeated clicks rotate through the whole inventory even when one click can't
// cover it all. Gentle on rdap.org: sequential with ~1s spacing, capped per
// click to stay inside the serverless time budget.
export async function refreshAllDomainFacts(limit = 15): Promise<{ ok: boolean; message: string }> {
  const rows = await listDomainInventory();
  if (!rows.length) return { ok: false, message: "Nothing to refresh — the inventory is empty." };
  const timeOf = (row: DomainRecord) => (row.updatedAt ? new Date(row.updatedAt).getTime() || 0 : 0);
  const targets = [...rows].sort((a, b) => timeOf(a) - timeOf(b)).slice(0, limit);
  let refreshed = 0;
  let covered = 0;
  const noAnswer: string[] = [];
  // Hard wall-clock budget UNDER the route's maxDuration: slow registries must
  // end with an honest "click again", never a platform kill mid-sweep.
  const startedAt = Date.now();
  const TIME_BUDGET_MS = 40_000;
  for (const [index, row] of targets.entries()) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
    const result = await refreshDomainFacts(row.domain);
    covered += 1;
    if (result.ok) refreshed += 1;
    else noAnswer.push(row.domain);
  }
  const rest = rows.length - covered;
  const parts = [`Refreshed ${refreshed} of ${covered} domain${covered === 1 ? "" : "s"} from the public registry`];
  if (noAnswer.length) {
    parts.push(`no usable answer for ${noAnswer.slice(0, 5).join(", ")}${noAnswer.length > 5 ? ` +${noAnswer.length - 5} more` : ""}`);
  }
  if (rest > 0) parts.push(`${rest} more not covered this pass — click again to continue (stalest first)`);
  return { ok: refreshed > 0, message: `${parts.join(" · ")}.` };
}

// Public registry facts for ANY domain via RDAP (the WHOIS successor — no keys):
// registrar, expiration date, and current name servers. rdap.org redirects to
// the authoritative registry server; fetch follows it. Best-effort: only the
// fields actually found are written, everything else on the row is untouched.
export async function refreshDomainFacts(domain: string): Promise<{ ok: boolean; message: string }> {
  const clean = domain.trim().toLowerCase();
  if (!isValidDomainName(clean)) return { ok: false, message: `"${domain}" doesn't look like a domain name.` };
  try {
    // Timeout so one silent registry can't hang a refresh-all sweep.
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(clean)}`, {
      headers: { accept: "application/rdap+json, application/json" },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      return { ok: false, message: `The public registry didn't answer for ${clean} (${response.status}) — enter facts by hand.` };
    }
    const data = (await response.json()) as {
      events?: Array<{ eventAction?: string; eventDate?: string }>;
      entities?: Array<{ roles?: string[]; vcardArray?: [string, Array<[string, unknown, string, unknown]>] }>;
      nameservers?: Array<{ ldhName?: string }>;
    };
    const expiry = data.events?.find((event) => event.eventAction === "expiration")?.eventDate?.slice(0, 10);
    const registrarEntity = data.entities?.find((entity) => entity.roles?.includes("registrar"));
    const registrar = registrarEntity?.vcardArray?.[1]?.find((field) => field[0] === "fn")?.[3];
    const nameServers = (data.nameservers ?? [])
      .map((ns) => (ns.ldhName || "").toLowerCase())
      .filter(Boolean)
      .join(", ");
    const found: string[] = [];
    const update: Partial<DomainRecord> & { domain: string } = { domain: clean };
    if (registrar && typeof registrar === "string") { update.registrar = registrar; found.push(`registrar: ${registrar}`); }
    if (expiry) { update.expiresOn = expiry; found.push(`expires: ${expiry}`); }
    if (nameServers) { update.nameServers = nameServers; found.push("name servers"); }
    if (!found.length) return { ok: false, message: `${clean}: the registry answered but published no usable facts.` };
    const saved = await upsertDomain(update);
    if (!saved.ok) return saved;
    return { ok: true, message: `${clean} refreshed from the public registry — ${found.join(" · ")}.` };
  } catch {
    return { ok: false, message: `Couldn't reach the public registry for ${clean} — try again.` };
  }
}
