// Which host is this request on? App Engine stays the customer builder.
// dashboard.unitedundergod.org is the private internal desk.
import { headers } from "next/headers";

export const FACTORY_HOST = "appengine.unitedundergod.org";
export const DASHBOARD_HOST = "dashboard.unitedundergod.org";
export const FACTORY_ORIGIN = `https://${FACTORY_HOST}`;
export const DASHBOARD_ORIGIN = `https://${DASHBOARD_HOST}`;

export function hostFromHeader(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().split(":")[0];
}

export function isDashboardHostName(host: string): boolean {
  return host === DASHBOARD_HOST || host === "dashboard.localhost" || host.startsWith("dashboard.");
}

export function isFactoryHostName(host: string): boolean {
  return host === FACTORY_HOST || host === "www.we-succeed.org" || host === "we-succeed.org";
}

export async function requestHost(): Promise<string> {
  return hostFromHeader((await headers()).get("host"));
}

export async function isDashboardRequest(): Promise<boolean> {
  return isDashboardHostName(await requestHost());
}
