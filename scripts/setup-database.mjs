import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import pg from "pg";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

await loadEnvFile(".env.local");
await loadEnvFile(".env");

const databaseUrl = getConfiguredDatabaseUrl();

if (!databaseUrl) {
  console.error("DATABASE_URL or POSTGRES_URL must point to App Engine's database (LPL Supabase, schema appengine) before running setup.");
  process.exit(1);
}

// App Engine's own data lives in the LPL Supabase (schema `appengine`, login
// `appengine_app`); a Neon URL is still accepted for older deployments.
const sql = /\.neon\.tech[:/]/i.test(databaseUrl) ? neon(databaseUrl) : await pgRunner(databaseUrl);
const files = [
  "db/migrations/001_initial.sql",
  "db/seeds/001_core_templates.sql",
  "db/seeds/002_agent_roles.sql"
];

for (const file of files) {
  const fullPath = join(rootDir, file);
  const contents = await readFile(fullPath, "utf8");
  const statements = splitSqlStatements(contents);

  console.log(`Applying ${file}`);

  for (const statement of statements) {
    await sql.query(statement);
  }
}

await sql.end?.();
console.log("Database setup complete.");

async function pgRunner(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  parsed.searchParams.delete("ssl");
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.searchParams.has("host");
  const client = new pg.Client({ connectionString: parsed.toString(), ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  await client.query("set search_path to appengine, public");
  return { query: (text, params) => client.query(text, params), end: () => client.end() };
}

function splitSqlStatements(contents) {
  const statements = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let previous = "";

  for (const character of contents) {
    current += character;

    if (character === "'" && !inDoubleQuote && previous !== "\\") {
      inSingleQuote = !inSingleQuote;
    } else if (character === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (character === ";" && !inSingleQuote && !inDoubleQuote) {
      const statement = current.trim();

      if (statement) {
        statements.push(statement);
      }

      current = "";
    }

    previous = character;
  }

  const finalStatement = current.trim();

  if (finalStatement) {
    statements.push(finalStatement);
  }

  return statements;
}

async function loadEnvFile(fileName) {
  try {
    const contents = await readFile(join(rootDir, fileName), "utf8");

    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);

      if (!match || line.trim().startsWith("#")) {
        continue;
      }

      const [, key, rawValue] = match;
      let value = rawValue.trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] ??= value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function getConfiguredDatabaseUrl() {
  const keys = ["APP_ENGINE_DATABASE_URL", "DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING", "NEON_DATABASE_URL"];

  for (const key of keys) {
    const value = process.env[key]?.trim();

    if (
      value &&
      !value.includes("USER:PASSWORD@HOST") &&
      !value.startsWith("replace-with") &&
      /^postgres(?:ql)?:\/\//i.test(value)
    ) {
      return value;
    }
  }

  return undefined;
}
