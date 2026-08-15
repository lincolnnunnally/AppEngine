// Attach dashboard.unitedundergod.org to the App Engine Vercel project and
// mint the add-only Cloudflare CNAME. No secrets printed.
const TEAM = process.env.VERCEL_ORG_ID || process.env.VERCEL_TEAM_ID || "team_iwReH8IpDY3Fvt0BITPC4F80";
const PROJECT = process.env.VERCEL_PROJECT_ID || "prj_exEf0usb6mtXlPrRnwHYUHaSA7L6";
const DOMAIN = "dashboard.unitedundergod.org";
const CF_API = "https://api.cloudflare.com/client/v4";

async function attachVercel() {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) return { ok: false, message: "VERCEL_TOKEN missing" };
  const url = `https://api.vercel.com/v10/projects/${PROJECT}/domains?teamId=${encodeURIComponent(TEAM)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ name: DOMAIN })
  });
  const data = await response.json().catch(() => ({}));
  if (response.ok || /already/i.test(JSON.stringify(data))) {
    return { ok: true, message: `Vercel: ${DOMAIN} attached (${response.status})` };
  }
  return { ok: false, message: `Vercel attach failed ${response.status}: ${data.error?.message || "unknown"}` };
}

async function mintDns() {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) return { ok: false, message: "CLOUDFLARE_API_TOKEN missing" };
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  let zone = zoneId;
  if (!zone) {
    const listed = await fetch(`${CF_API}/zones?name=unitedundergod.org`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = await listed.json().catch(() => ({}));
    zone = body.result?.[0]?.id;
  }
  if (!zone) return { ok: false, message: "Could not find the unitedundergod.org zone" };
  const existing = await fetch(`${CF_API}/zones/${zone}/dns_records?name=${DOMAIN}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  const have = await existing.json().catch(() => ({}));
  const records = Array.isArray(have.result) ? have.result : [];
  if (records.length > 0) {
    const already = records.some((row) => row.type === "CNAME" && String(row.content).toLowerCase() === "cname.vercel-dns.com");
    return already
      ? { ok: true, message: `${DOMAIN} already points at Vercel — left as is.` }
      : { ok: false, message: `${DOMAIN} already has a DNS record — left untouched.` };
  }
  const create = await fetch(`${CF_API}/zones/${zone}/dns_records`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      type: "CNAME",
      name: DOMAIN,
      content: "cname.vercel-dns.com",
      proxied: false,
      ttl: 1,
      comment: "AppEngine internal desk (add-only)"
    })
  });
  const created = await create.json().catch(() => ({}));
  if (!create.ok || !created.success) {
    return { ok: false, message: `DNS create failed: ${created.errors?.[0]?.message || create.status}` };
  }
  return { ok: true, message: `${DOMAIN} created (DNS-only CNAME to Vercel).` };
}

const vercel = await attachVercel();
console.log(vercel.message);
const dns = await mintDns();
console.log(dns.message);
if (!vercel.ok || !dns.ok) process.exitCode = 1;
