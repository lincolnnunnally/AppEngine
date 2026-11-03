import { NextResponse } from "next/server";
import { cloudflareDnsConfigured, ensureEcosystemSubdomain } from "@/lib/engine/cloudflare-dns";
import { vercelTeamId } from "@/lib/engine/domains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-shot allowlist mint: add-only CNAME to Vercel, then make sure a cert exists.
// Add-only: existing DNS records are never updated or deleted.
// WP Easy Peazy (owner decision 2026-11-03): both hosts are already attached to
// easypeazy-web (wp.unitedundergod.org as a 308 redirect to wp.easypeazy.site),
// so this run only adds the DNS records and checks certs.
const HOSTS = [
  { label: "wp", zone: "easypeazy.site", project: "easypeazy-web" },
  { label: "wp", zone: "unitedundergod.org", project: "easypeazy-web" }
] as const;
const NONCE = "uug-mint-2026-11-03-wp-easy-peazy";

function authorized(request: Request) {
  return (request.headers.get("x-uug-mint") || "") === NONCE;
}

function vercelToken() {
  return process.env.VERCEL_TOKEN?.trim() || "";
}

async function vercel(path: string, init?: RequestInit) {
  const url = new URL(`https://api.vercel.com${path}`);
  url.searchParams.set("teamId", vercelTeamId());
  return fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${vercelToken()}`,
      "content-type": "application/json",
      ...(init?.headers || {})
    }
  });
}

async function ensureCert(fqdn: string) {
  const list = await vercel(`/v8/certs?domain=${encodeURIComponent(fqdn)}`);
  const data = (await list.json().catch(() => ({}))) as { certs?: unknown[] };
  const certs = Array.isArray(data.certs) ? data.certs : Array.isArray(data) ? (data as unknown[]) : [];
  if (certs.length > 0) {
    return { ok: true, issued: false, message: `${fqdn} already has a cert.` };
  }
  const issue = await vercel("/v8/certs", {
    method: "POST",
    body: JSON.stringify({ cns: [fqdn] })
  });
  const body = (await issue.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!issue.ok) {
    return { ok: false, issued: false, message: body.error?.message || `Couldn't issue cert (${issue.status}).` };
  }
  return { ok: true, issued: true, message: `${fqdn} cert issued.` };
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  if (!cloudflareDnsConfigured()) {
    return NextResponse.json(
      { ok: false, missingVaultKey: "CLOUDFLARE_API_TOKEN", message: "DNS isn't configured (CLOUDFLARE_API_TOKEN)." },
      { status: 503 }
    );
  }
  if (!vercelToken()) {
    return NextResponse.json(
      { ok: false, missingVaultKey: "VERCEL_TOKEN", message: "Hosting isn't configured (VERCEL_TOKEN)." },
      { status: 503 }
    );
  }

  const results = [];
  for (const host of HOSTS) {
    const dns = await ensureEcosystemSubdomain(host.label, host.zone);
    const fqdn = `${host.label}.${host.zone}`;
    const cert = dns.ok ? await ensureCert(fqdn) : { ok: false, issued: false, message: "skipped cert (DNS failed)" };
    results.push({ fqdn, project: host.project, dns, cert });
  }
  return NextResponse.json({
    ok: results.every((row) => row.dns.ok && row.cert.ok),
    teamLooksLikeTeamId: vercelTeamId().startsWith("team_"),
    results
  });
}