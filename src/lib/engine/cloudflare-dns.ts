// Cloudflare DNS adapter — gives ecosystem apps a subdomain on unitedundergod.org,
// the owner's DNS hub (source-of-truth/unitedundergod-subdomain-dns-plan.md). This
// is the "small Cloudflare DNS adapter, sibling to the Vercel deploy adapter" that
// runbook promised: create the CNAME, attach the domain, and every app that goes
// official gets <slug>.unitedundergod.org with no human step.
//
// SAFETY — NON-NEGOTIABLE: the unitedundergod.org zone also hosts the owner's LIVE
// WordPress site and EMAIL (MX / SPF / DKIM). This module is ADD-ONLY BY
// CONSTRUCTION: it can create a NEW record for a name that has none, and it exposes
// NO update or delete capability of any kind (no PUT/PATCH/DELETE anywhere). If ANY
// record already exists under a requested name — even one we created earlier — it is
// left untouched and we report instead. Infra labels (www, mail, …) are refused
// outright as a second fence in front of the list-first check.
//
// Token: CLOUDFLARE_API_TOKEN — a universal engine-runtime key (env-vault KNOWN_KEYS):
// the owner saves it once on /integrations and the vault mirrors it into the
// factory's own hosting env. CLOUDFLARE_ZONE_ID is optional (looked up by zone name
// when absent). SERVER ONLY.
import { attachDomainToVercelProject } from "./domains.ts";

const CF_API = "https://api.cloudflare.com/client/v4";
export const ECOSYSTEM_ZONE_NAME = "unitedundergod.org";
// Other zones in the same Cloudflare account this adapter may add to. Same
// add-only rules apply. easypeazy.site carries the EasyPeazy product hosts
// (wp.easypeazy.site = WP Easy Peazy, owner decision 2026-11-03).
// vidalia.pro carries the Vidalia Pro trade pages and one-business lead sites
// (handyman., signs.), all served by the Vercel project `operate` (2026-11-05).
export const ALLOWED_ZONES = new Set([ECOSYSTEM_ZONE_NAME, "easypeazy.site", "vidalia.pro"]);
// Vercel's universal CNAME target — the grey-cloud (DNS-only) record the host asks for.
const VERCEL_CNAME_TARGET = "cname.vercel-dns.com";

// Names that belong to the site/email infrastructure. All of them already have
// records (so the list-first check would refuse anyway), but a hardcoded fence
// costs nothing and survives someone deleting a record by hand.
const RESERVED_LABELS = new Set([
  "", "www", "mail", "webmail", "mailboxes", "smtp", "imap", "pop", "pop3", "mx",
  "ftp", "ssh", "mysql", "autoconfig", "autodiscover", "ns1", "ns2",
  // Email-auth labels, both raw and as normalization renders them ("_dmarc" -> "dmarc").
  "_dmarc", "dmarc", "_domainkey", "domainkey"
]);

function cfToken(): string {
  return process.env.CLOUDFLARE_API_TOKEN?.trim() || "";
}

export function cloudflareDnsConfigured(): boolean {
  return Boolean(cfToken());
}

// "wesucceed-my-church-app-a1b2c3" (vercel-deploy's projectNameFromSlug shape)
// -> "my-church-app". Non-generated project names pass through normalized, so the
// same call works for hand-made projects too.
export function subdomainLabelFromProjectName(projectName: string): string {
  let label = (projectName || "")
    .toLowerCase()
    .replace(/^wesucceed-/, "")
    .replace(/-[0-9a-f]{6}$/, "");
  label = label.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return label.slice(0, 63).replace(/-$/, "");
}

export type SubdomainDnsResult = {
  ok: boolean;
  fqdn?: string;
  created?: boolean;
  message: string;
};

async function cfGet(path: string): Promise<{ status: number; data: CfResponse }> {
  const response = await fetch(`${CF_API}${path}`, {
    headers: { authorization: `Bearer ${cfToken()}` }
  });
  return { status: response.status, data: (await response.json().catch(() => ({}))) as CfResponse };
}

type CfResponse = {
  success?: boolean;
  result?: Array<Record<string, unknown>> | Record<string, unknown>;
  errors?: Array<{ message?: string }>;
};

const cachedZoneIds = new Map<string, string>();
async function zoneId(zoneName: string = ECOSYSTEM_ZONE_NAME): Promise<string | null> {
  // CLOUDFLARE_ZONE_ID names the unitedundergod.org zone only.
  const fromEnv = zoneName === ECOSYSTEM_ZONE_NAME ? process.env.CLOUDFLARE_ZONE_ID?.trim() : "";
  if (fromEnv) return fromEnv;
  const cached = cachedZoneIds.get(zoneName);
  if (cached) return cached;
  const { data } = await cfGet(`/zones?name=${zoneName}`);
  const zone = Array.isArray(data.result) ? data.result[0] : undefined;
  const id = typeof zone?.id === "string" ? zone.id : null;
  if (id) cachedZoneIds.set(zoneName, id);
  return id;
}

// Creates <label>.unitedundergod.org as a DNS-only CNAME to Vercel — ONLY if no
// record of any type already exists under that exact name. Never modifies anything.
export async function ensureEcosystemSubdomain(
  labelOrSlug: string,
  zoneName: string = ECOSYSTEM_ZONE_NAME
): Promise<SubdomainDnsResult> {
  if (!ALLOWED_ZONES.has(zoneName)) {
    return { ok: false, message: `${zoneName} is not a zone this adapter may add to.` };
  }
  const label = subdomainLabelFromProjectName(labelOrSlug);
  if (RESERVED_LABELS.has(label) || label.startsWith("_")) {
    return { ok: false, message: `"${label}" is reserved for site/email infrastructure — pick another name.` };
  }
  const fqdn = `${label}.${zoneName}`;
  if (!cloudflareDnsConfigured()) {
    return { ok: false, fqdn, message: "DNS isn't configured (CLOUDFLARE_API_TOKEN)." };
  }

  try {
    const zone = await zoneId(zoneName);
    if (!zone) {
      return { ok: false, fqdn, message: `Couldn't find the ${zoneName} zone with this token.` };
    }

    // ADD-ONLY fence: list first; ANY existing record under this name wins.
    const existing = await cfGet(`/zones/${zone}/dns_records?name=${fqdn}`);
    const records = Array.isArray(existing.data.result) ? existing.data.result : [];
    if (records.length > 0) {
      const already = records.some(
        (r) => r.type === "CNAME" && String(r.content).toLowerCase() === VERCEL_CNAME_TARGET
      );
      return already
        ? { ok: true, fqdn, created: false, message: `${fqdn} already points at Vercel — left as is.` }
        : { ok: false, fqdn, created: false, message: `${fqdn} already has a DNS record — left untouched. Pick another name.` };
    }

    const create = await fetch(`${CF_API}/zones/${zone}/dns_records`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfToken()}`, "content-type": "application/json" },
      body: JSON.stringify({
        type: "CNAME",
        name: fqdn,
        content: VERCEL_CNAME_TARGET,
        proxied: false, // grey cloud — Vercel terminates TLS, per the runbook
        ttl: 1, // auto
        comment: "AppEngine auto-subdomain (add-only adapter)"
      })
    });
    const created = (await create.json().catch(() => ({}))) as CfResponse;
    if (!create.ok || !created.success) {
      const why = created.errors?.[0]?.message || `HTTP ${create.status}`;
      return { ok: false, fqdn, message: `Couldn't create the DNS record: ${why}` };
    }
    return { ok: true, fqdn, created: true, message: `${fqdn} created (DNS-only CNAME to Vercel).` };
  } catch (error) {
    return { ok: false, fqdn, message: error instanceof Error ? error.message : "DNS error." };
  }
}

// The full "publish at <slug>.unitedundergod.org" step from the runbook: attach the
// domain to the app's Vercel project, then mint the CNAME. Best-effort by design —
// callers treat a failure as "no subdomain yet", never as a failed deploy.
export async function publishEcosystemSubdomain(
  projectName: string,
  labelOverride?: string
): Promise<SubdomainDnsResult & { url?: string }> {
  if (!cloudflareDnsConfigured()) {
    return { ok: false, message: "DNS isn't configured (CLOUDFLARE_API_TOKEN)." };
  }
  const label = labelOverride || subdomainLabelFromProjectName(projectName);
  const fqdn = `${label}.${ECOSYSTEM_ZONE_NAME}`;

  // Attach on the host first (same order as the manual runbook flow). An
  // "already exists on this project" answer is fine — re-publishing is idempotent.
  const attach = await attachDomainToVercelProject(projectName, fqdn);
  if (!attach.ok && !/already/i.test(attach.message)) {
    return { ok: false, fqdn, message: `Couldn't attach ${fqdn} to the app: ${attach.message}` };
  }

  const dns = await ensureEcosystemSubdomain(label);
  if (!dns.ok) return dns;
  return { ...dns, url: `https://${fqdn}` };
}
