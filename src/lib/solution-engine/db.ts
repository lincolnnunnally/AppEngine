// Solution Engine persistence. The se_* tables live in the shared LPL Supabase
// (ecosystem DB policy: shared identity apps share Supabase; Neon is for
// customer-generated apps). Every table is RLS-on with no policies, so the only
// way in is the service role key from the server — a browser holding the anon key
// gets nothing.
//
// PostgREST over fetch is the established ecosystem pattern here (see
// lib/geo/location-proximity.ts); it keeps this app dependency-free.

export type SolutionEngineDbConfig = {
  url: string;
  serviceKey: string;
};

export function getSolutionEngineDbConfig(env: NodeJS.ProcessEnv = process.env): SolutionEngineDbConfig | null {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "").trim();

  if (!url || !serviceKey) {
    return null;
  }

  return { url, serviceKey };
}

export function isSolutionEngineConfigured(env: NodeJS.ProcessEnv = process.env) {
  return getSolutionEngineDbConfig(env) !== null;
}

export class SolutionEngineDbError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "SolutionEngineDbError";
    this.status = status;
    this.detail = detail;
  }
}

function requireConfig(): SolutionEngineDbConfig {
  const config = getSolutionEngineDbConfig();

  if (!config) {
    throw new SolutionEngineDbError("Solution Engine storage is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).", 503);
  }

  return config;
}

type RestInit = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: string;
  body?: unknown;
  prefer?: string;
};

async function rest<T>(table: string, init: RestInit = {}): Promise<T> {
  const config = requireConfig();
  const query = init.query ? `?${init.query}` : "";
  const headers: Record<string, string> = {
    apikey: config.serviceKey,
    authorization: `Bearer ${config.serviceKey}`,
    "content-type": "application/json"
  };

  if (init.prefer) {
    headers.prefer = init.prefer;
  }

  const response = await fetch(`${config.url}/rest/v1/${table}${query}`, {
    method: init.method || "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store"
  });

  const text = await response.text();

  if (!response.ok) {
    let detail = text;

    try {
      const parsed = JSON.parse(text) as { message?: string; details?: string; hint?: string };
      detail = parsed.message || parsed.details || parsed.hint || text;
    } catch {
      // keep the raw body
    }

    throw new SolutionEngineDbError(`Solution Engine storage rejected ${init.method || "GET"} ${table}`, response.status, detail);
  }

  if (!text) {
    return [] as unknown as T;
  }

  return JSON.parse(text) as T;
}

export async function selectRows<T>(table: string, query: string): Promise<T[]> {
  return rest<T[]>(table, { query });
}

export async function selectOne<T>(table: string, query: string): Promise<T | null> {
  const rows = await selectRows<T>(table, `${query}&limit=1`);
  return rows[0] || null;
}

export async function insertRow<T>(table: string, values: Record<string, unknown>): Promise<T> {
  const rows = await rest<T[]>(table, {
    method: "POST",
    body: [values],
    prefer: "return=representation"
  });

  return rows[0];
}

export async function insertRows<T>(table: string, values: Record<string, unknown>[]): Promise<T[]> {
  if (values.length === 0) {
    return [];
  }

  return rest<T[]>(table, {
    method: "POST",
    body: values,
    prefer: "return=representation"
  });
}

export async function updateRows<T>(table: string, query: string, values: Record<string, unknown>): Promise<T[]> {
  return rest<T[]>(table, {
    method: "PATCH",
    query,
    body: values,
    prefer: "return=representation"
  });
}

export async function updateOne<T>(table: string, query: string, values: Record<string, unknown>): Promise<T> {
  const rows = await updateRows<T>(table, query, values);

  if (!rows[0]) {
    throw new SolutionEngineDbError(`Solution Engine storage updated nothing on ${table}`, 404, query);
  }

  return rows[0];
}

export async function deleteRows(table: string, query: string): Promise<void> {
  await rest(table, { method: "DELETE", query });
}

export async function countRows(table: string, query: string): Promise<number> {
  const config = requireConfig();
  const response = await fetch(`${config.url}/rest/v1/${table}?${query}&select=id`, {
    method: "HEAD",
    headers: {
      apikey: config.serviceKey,
      authorization: `Bearer ${config.serviceKey}`,
      prefer: "count=exact"
    },
    cache: "no-store"
  });

  const range = response.headers.get("content-range") || "";
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? total : 0;
}
