import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.includes("USER:PASSWORD@HOST")) {
  console.error("DATABASE_URL must point to your Neon database before running setup.");
  process.exit(1);
}

const sql = neon(databaseUrl);
const files = [
  "db/migrations/001_initial.sql",
  "db/seeds/001_core_templates.sql",
  "db/seeds/002_agent_roles.sql"
];

for (const file of files) {
  const fullPath = join(rootDir, file);
  const contents = await readFile(fullPath, "utf8");

  console.log(`Applying ${file}`);
  await sql.query(contents);
}

console.log("Database setup complete.");
