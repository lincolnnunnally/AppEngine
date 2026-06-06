import { neon } from "@neondatabase/serverless";
import { isUsableDatabaseUrl } from "@/lib/engine/local-mode";

export function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL?.trim() || "";

  if (!isUsableDatabaseUrl(databaseUrl)) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string before App Engine can use Neon persistence.");
  }

  return neon(databaseUrl);
}
