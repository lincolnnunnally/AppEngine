import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { Pool, type PoolClient } from "pg";

// App Engine's own data (the owner dashboard, its sign-in, tasks, inbox, billing)
// lives in the shared LPL Supabase, schema `appengine`, like every other app of
// Lincoln's. Neon is only for apps AppEngine customers create. Owner directive
// 2026-11-19: "all my apps live on supabase".
//
// The `neon()` HTTP driver only speaks to Neon, so a Supabase URL goes through
// `pg` instead. Both are wrapped to the same surface the code already uses:
//   await sql`select ... where id = ${id}`      -> row array
//   await sql.query("select ... $1", [id])      -> row array
// A Neon URL still gets the Neon driver, so nothing changes for a deployment
// that has not moved yet.

export type Sql = NeonQueryFunction<false, false>;

const globalRef = globalThis as typeof globalThis & { __appEnginePgPools__?: Map<string, Pool> };

export function isNeonUrl(databaseUrl: string) {
  try {
    return new URL(databaseUrl).hostname.endsWith(".neon.tech");
  } catch {
    return /\.neon\.tech[:/]/i.test(databaseUrl);
  }
}

/** One small pool per URL per process; serverless instances reuse it while warm. */
export function getPgPool(databaseUrl: string): Pool {
  const pools = (globalRef.__appEnginePgPools__ ??= new Map());
  let pool = pools.get(databaseUrl);

  if (!pool) {
    pool = new Pool({
      connectionString: connectionStringForPg(databaseUrl),
      // Supabase's pooler certificate chain is not in Node's trust store.
      // `sslmode=disable` (local test databases only) turns TLS off.
      ssl: /[?&]sslmode=disable\b/i.test(databaseUrl) ? false : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000
    });
    // The login role's default search_path is `appengine, public`; setting it on
    // each new connection as well keeps that true if the role default is ever lost.
    pool.on("connect", (client: PoolClient) => {
      void client.query("set search_path to appengine, public").catch(() => undefined);
    });
    pool.on("error", () => undefined);
    pools.set(databaseUrl, pool);
  }

  return pool;
}

export function sqlForUrl(databaseUrl: string): Sql {
  if (isNeonUrl(databaseUrl)) {
    return neon(databaseUrl);
  }

  const pool = getPgPool(databaseUrl);
  const run = async (text: string, params: unknown[] = []) => (await pool.query(text, params as unknown[])).rows;
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    for (let index = 0; index < values.length; index += 1) {
      text += `$${index + 1}${strings[index + 1]}`;
    }
    return run(text, values);
  };
  sql.query = (text: string, params?: unknown[]) => run(text, params ?? []);

  return sql as unknown as Sql;
}

// Modern `pg` reads sslmode=require as verify-full and then ignores the ssl
// object above, so the URL's sslmode is dropped and the object decides.
export function connectionStringForPg(databaseUrl: string) {
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    return url.toString();
  } catch {
    return databaseUrl.replace(/[?&]sslmode=[^&]*/gi, "");
  }
}
