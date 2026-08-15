// Which host is this request on? App Engine stays the customer builder.
// dashboard.unitedundergod.org is the private internal desk.
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

export function isAllowedAuthOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === DASHBOARD_HOST ||
      host === FACTORY_HOST ||
      LEGACY_FACTORY_HOSTS.has(host) ||
      host === "localhost" ||
      host === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

// GitHub's OAuth app callback is registered on the factory host. Auth.js
// only starts OAuth on POST, so the desk uses a factory page that POSTs
// there in the browser (PKCE stays on the host GitHub will call back).
export function githubSignInHref(fromDashboard: boolean): string {
  return fromDashboard ? `${FACTORY_ORIGIN}/oauth/desk` : "";
}

export async function requestHost(): Promise<string> {
  return hostFromHeader((await headers()).get("host"));
}

export async function isDashboardRequest(): Promise<boolean> {
  return isDashboardHostName(await requestHost());
}
