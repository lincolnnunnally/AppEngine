// Which host is this request on? App Engine stays the customer builder.
// dashboard.unitedundergod.org is the private internal desk.
// GitHub OAuth callback URLs for these hosts live in github-oauth.ts.
import { headers } from "next/headers";

export const FACTORY_HOST = "appengine.unitedundergod.org";
export const DASHBOARD_HOST = "dashboard.unitedundergod.org";
export const FACTORY_ORIGIN = `https://${FACTORY_HOST}`;
export const DASHBOARD_ORIGIN = `https://${DASHBOARD_HOST}`;

const LEGACY_FACTORY_HOSTS = new Set(["we-succeed.org", "www.we-succeed.org"]);

export function hostFromHeader(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().split(":")[0];
}

export function isDashboardHostName(host: string): boolean {
  return host === DASHBOARD_HOST || host === "dashboard.localhost" || host.startsWith("dashboard.");
}

export function isFactoryHostName(host: string): boolean {
  return host === FACTORY_HOST || LEGACY_FACTORY_HOSTS.has(host);
}

type RuntimeEnv = Record<string, string | undefined>;

export function isAppEngineVercelHost(host: string): boolean {
  const normalized = hostFromHeader(host);
  return normalized.endsWith(".vercel.app") && normalized.startsWith("app-engine");
}

export function sessionCookieDomainForHost(host: string): string | undefined {
  const normalized = hostFromHeader(host);

  if (normalized === "unitedundergod.org" || normalized.endsWith(".unitedundergod.org")) {
    return ".unitedundergod.org";
  }

  return undefined;
}

function vercelDeploymentHosts(env: RuntimeEnv): string[] {
  return [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.replace(/^https?:\/\//i, "").toLowerCase().split(":")[0]);
}

export function isAllowedAuthHost(host: string, env: RuntimeEnv = process.env): boolean {
  const normalized = hostFromHeader(host);

  return (
    normalized === DASHBOARD_HOST ||
    normalized === FACTORY_HOST ||
    LEGACY_FACTORY_HOSTS.has(normalized) ||
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    isAppEngineVercelHost(normalized) ||
    vercelDeploymentHosts(env).includes(normalized)
  );
}

export function isAllowedAuthOrigin(origin: string, env: RuntimeEnv = process.env): boolean {
  try {
    return isAllowedAuthHost(new URL(origin).hostname, env);
  } catch {
    return false;
  }
}

export async function requestHost(): Promise<string> {
  return hostFromHeader((await headers()).get("host"));
}

export async function isDashboardRequest(): Promise<boolean> {
  return isDashboardHostName(await requestHost());
}
