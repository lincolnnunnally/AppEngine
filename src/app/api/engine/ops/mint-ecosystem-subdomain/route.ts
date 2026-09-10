import { NextResponse } from "next/server";
import { cloudflareDnsConfigured, publishEcosystemSubdomain } from "@/lib/engine/cloudflare-dns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-shot allowlist mint used by the AppEngine adapter path
// (publishEcosystemSubdomain = attach domain + add-only CNAME).
// Add-only: existing DNS records are never updated or deleted.
// `project` is the Vercel project name; `label` is the UUG hostname.
const APPS = [
  { project: "porchlight", label: "porchlight" },
  { project: "rally", label: "rally" },
  { project: "selah", label: "selah" },
  { project: "singtrue-vocal-coach", label: "singtrue" },
  { project: "lincoln-nunnally-resume", label: "resume" },
] as const;
const NONCE = "uug-mint-2026-09-06-prs";

function authorized(request: Request) {
  return (request.headers.get("x-uug-mint") || "") === NONCE;
}

function vercelToken() {
  return process.env.VERCEL_TOKEN?.trim() || "";
}

function teamQuery() {
  const team = process.env.VERCEL_ORG_ID?.trim();
  return team ? `teamId=${encodeURIComponent(team)}` : "";
}

async function vercel(path: string, init?: RequestInit) {
  const url = new URL(`https://api.vercel.com${path}`);
  const team = teamQuery();
  if (team && !url.searchParams.has("teamId")) {
    const [k, v] = team.split("=");
    url.searchParams.set(k, decodeURIComponent(v));
  }
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
  for (const app of APPS) {
    const dns = await publishEcosystemSubdomain(app.project, app.label);
    const fqdn = `${app.label}.unitedundergod.org`;
    const cert = dns.ok ? await ensureCert(fqdn) : { ok: false, issued: false, message: "skipped cert (DNS/attach failed)" };
    results.push({ slug: app.label, project: app.project, fqdn, dns, cert });
  }
  return NextResponse.json({ ok: results.every((row) => row.dns.ok && row.cert.ok), results });
}
