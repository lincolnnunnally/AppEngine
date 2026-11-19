import { sqlForUrl } from "@/lib/db/postgres";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";

// App Engine's own data lives in the LPL Supabase (schema `appengine`); see postgres.ts.
export function getDatabase() {
  const databaseUrl = getConfiguredDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL or POSTGRES_URL must be a PostgreSQL connection string before App Engine can use its database.");
  }

  return sqlForUrl(databaseUrl);
}
