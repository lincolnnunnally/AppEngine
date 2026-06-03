import { neon } from "@neondatabase/serverless";

export function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect App Engine to Neon.");
  }

  return neon(databaseUrl);
}
