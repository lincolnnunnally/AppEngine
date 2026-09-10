import { NextResponse } from "next/server";
import { cloudflareDnsConfigured, publishEcosystemSubdomain } from "@/lib/engine/cloudflare-dns";
import { vercelTeamId } from "@/lib/engine/domains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-shot allowlist mint used by the AppEngine adapter path
// (publishEcosystemSubdomain = attach domain + add-only CNAME).
// Add-only: existing DNS records are never updated or deleted.
// `project` is the Vercel project id (stable); `name` is the project name.
const APPS = [
  { project: "prj_2TvscItZmLyq2jvPD0W1Ce9n5Exb", name: "porchlight", label: "porchlight" },
  { project: "prj_xnPf03EadncVsDu8UpE8fwecstnl", name: "rally", label: "rally" },
  { project: "prj_jbtscxIKC8hiq1speVWPg0ernaDq", name: "selah", label: "selah" },
  { project: "prj_jIygvY1T7B5C738lK4Eb4w4VLrWY", name: "singtrue-vocal-coach", label: "singtrue" },
  { project: "prj_YZbZrN4jfL5SrUndRjOr5hYpmH8d", name: "lincoln-nunnally-resume", label: "resume" }
] as const;
const NONCE = "uug-mint-2026-09-06-prs";

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

  const probeProject = APPS[3].project;
  const probe = await vercel(`/v9/projects/${encodeURIComponent(probeProject)}`);
  const probeBody = (await probe.json().catch(() => ({}))) as { name?: string; error?: { message?: string } };

  const results = [];
  for (const app of APPS) {
    const dns = await publishEcosystemSubdomain(app.project, app.label);
    const fqdn = `${app.label}.unitedundergod.org`;
    const cert = dns.ok ? await ensureCert(fqdn) : { ok: false, issued: false, message: "skipped cert (DNS/attach failed)" };
    results.push({ slug: app.label, project: app.name, fqdn, dns, cert });
  }
  return NextResponse.json({
    ok: results.every((row) => row.dns.ok && row.cert.ok),
    teamLooksLikeTeamId: vercelTeamId().startsWith("team_"),
    probe: {
      project: probeProject,
      status: probe.status,
      name: probeBody.name || null,
      message: probeBody.error?.message || null
    },
    results
  });
}