import { neon } from "@neondatabase/serverless";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";

export function getDatabase() {
  const databaseUrl = getConfiguredDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL or POSTGRES_URL must be a PostgreSQL connection string before App Engine can use Neon persistence.");
  }

  return neon(databaseUrl);
}
