// CRM pass secret — SERVER ONLY. The owner desk signs each ChurchConnect pass
// with one shared secret. It comes from APPENGINE_CC_CRM_SECRET when that env
// var is set, otherwise from the `cc_crm_owner_desk` row of
// `app_shared_secrets` in the shared database, read with this deploy's own
// server key and kept in memory for a few minutes. The table has row security
// on and no policies, so only server keys can read it. The value is never
// logged, returned to a page, or sent anywhere except as a pass signature.
// When neither source is available (an AppEngine preview has no server key),
// this returns "" and saving fails closed.

export const CRM_SECRET_ROW = "cc_crm_owner_desk";
export const CRM_SECRET_CACHE_MS = 5 * 60 * 1000;
export const CRM_SECRET_MISS_CACHE_MS = 30 * 1000;
export const CRM_SECRET_MIN_LENGTH = 32;

type Env = Record<string, string | undefined>;
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

let cache: { value: string; until: number } = { value: "", until: 0 };

export function clearCrmSecretCache(): void {
  cache = { value: "", until: 0 };
}

function serverKeyConfig(env: Env): { url: string; key: string } | null {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "").trim();
  if (!/^https:\/\//.test(url) || !key) return null;
  return { url, key };
}

async function readSecretRow(env: Env, fetcher: Fetcher): Promise<string> {
  const config = serverKeyConfig(env);
  if (!config) return "";
  try {
    const response = await fetcher(`${config.url}/rest/v1/app_shared_secrets?name=eq.${CRM_SECRET_ROW}&select=value&limit=1`, {
      method: "GET",
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return "";
    const rows = (await response.json()) as { value?: unknown }[];
    return typeof rows?.[0]?.value === "string" ? rows[0].value.trim() : "";
  } catch {
    return "";
  }
}

/** The pass secret, or "" when this deploy can't sign passes. Never throws. */
export async function resolveCrmSecret(env: Env = process.env, fetcher: Fetcher = fetch, now: number = Date.now()): Promise<string> {
  const fromEnv = (env.APPENGINE_CC_CRM_SECRET || "").trim();
  if (fromEnv) return fromEnv.length >= CRM_SECRET_MIN_LENGTH ? fromEnv : "";
  if (now < cache.until) return cache.value;
  const fromDb = await readSecretRow(env, fetcher);
  const value = fromDb.length >= CRM_SECRET_MIN_LENGTH ? fromDb : "";
  cache = { value, until: now + (value ? CRM_SECRET_CACHE_MS : CRM_SECRET_MISS_CACHE_MS) };
  return value;
}
