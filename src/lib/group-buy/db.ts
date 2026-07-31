// Group Buy persistence. The gb_* tables live in the shared LPL Supabase
// (ecosystem DB policy: shared identity apps share Supabase; Neon is for
// customer-generated apps). Every table is RLS-on with no policies, so the only
// way in is the service role key from the server — a browser holding the anon
// key gets nothing.
//
// PostgREST over fetch, matching lib/solution-engine/db.ts: no dependency, and
// one obvious place to look when a query misbehaves.

export type GroupBuyDbConfig = {
  url: string;
  serviceKey: string;
};

export function getGroupBuyDbConfig(env: NodeJS.ProcessEnv = process.env): GroupBuyDbConfig | null {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "").trim();

  if (!url || !serviceKey) {
    return null;
  }

  return { url, serviceKey };
}

export function isGroupBuyConfigured(env: NodeJS.ProcessEnv = process.env) {
  return getGroupBuyDbConfig(env) !== null;
}

export class GroupBuyDbError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "GroupBuyDbError";
    this.status = status;
    this.detail = detail;
  }
}

function requireConfig(): GroupBuyDbConfig {
  const config = getGroupBuyDbConfig();

  if (!config) {
    throw new GroupBuyDbError("Group Buy storage is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).", 503);
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

    throw new GroupBuyDbError(`Group Buy storage rejected ${init.method || "GET"} ${table}`, response.status, detail);
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

export async function upsertRow<T>(table: string, values: Record<string, unknown>, onConflict: string): Promise<T> {
  const rows = await rest<T[]>(table, {
    method: "POST",
    query: `on_conflict=${onConflict}`,
    body: [values],
    prefer: "return=representation,resolution=merge-duplicates"
  });

  return rows[0];
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
    throw new GroupBuyDbError(`Group Buy storage updated nothing on ${table}`, 404, query);
  }

  return rows[0];
}

export async function deleteRows(table: string, query: string): Promise<void> {
  await rest(table, { method: "DELETE", query });
}
