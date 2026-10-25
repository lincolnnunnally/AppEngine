import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// C5: every customer app gets its own database. Fakes Neon's REST API and its
// SQL-over-HTTP endpoint, then runs the same calls a customer build makes
// (provision the URL for the deploy, then load the schema) and checks:
//   - one Neon PROJECT per app (free plan: 100), not a branch of a shared one;
//   - provision + setup in one build reuse that project (they used to create two,
//     wiring the app to the empty one);
//   - the schema goes into public, where the generated app queries it;
//   - when a scratch Postgres is available (SMOKE_SCHEMA_DATABASE_URL, or a local
//     PostgreSQL 16 we can start), those exact statements apply cleanly.
process.env.APP_ENGINE_LOCAL_MODE = "true";
process.env.NEON_API_KEY = "test-neon-key";
delete process.env.NEON_PROJECT_ID;

const calls = { projects: 0, sql: [] };
let projectCounter = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const method = (init.method || "GET").toUpperCase();
  const reply = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  if (url.startsWith("https://console.neon.tech/api/v2/")) {
    if (method === "POST" && url.endsWith("/projects")) {
      calls.projects += 1;
      projectCounter += 1;
      const id = `proj-${projectCounter}`;
      return reply({
        project: { id },
        branch: { id: `br-${projectCounter}`, name: "main" },
        endpoints: [{ id: `ep-${projectCounter}`, type: "read_write" }],
        databases: [{ name: "neondb" }],
        roles: [{ name: "neondb_owner" }],
        operations: [{ id: `op-${projectCounter}` }]
      });
    }
    if (url.includes("/operations/")) return reply({ operation: { status: "finished" } });
    if (url.includes("/connection_uri")) {
      const id = url.match(/projects\/([^/]+)\//)[1];
      return reply({ uri: `postgresql://neondb_owner:pw@ep-${id}.us-east-2.aws.neon.tech/neondb?sslmode=require` });
    }
    throw new Error(`unexpected Neon API call ${method} ${url}`);
  }
  if (/neon\.tech\/sql$/.test(url)) {
    const body = JSON.parse(init.body);
    calls.sql.push(body.query);
    return reply({ fields: [], rows: [], command: "OK", rowCount: 0, rowAsArray: false });
  }
  return realFetch(input, init);
};

let failures = 0;
function check(ok, message) {
  if (ok) console.log(`ok - ${message}`);
  else {
    failures += 1;
    console.error(`not ok - ${message}`);
  }
}

const { createLocalPlannedProject } = await import("../src/lib/engine/development-store.ts");
const { generateProjectApp } = await import("../src/lib/engine/app-generator.ts");
const { generatedAppDatabaseConfigured, provisionGeneratedAppDatabaseUrl, setupGeneratedAppDatabase } = await import(
  "../src/lib/engine/database-setup.ts"
);

async function build(name, moduleSlugs) {
  const created = await createLocalPlannedProject(
    { idea: `${name} needs events and giving for its people`, name, moduleSlugs },
    {
      customerEmail: "smoke@example.com",
      gateClearance: { intakeGateId: `smoke:${name}`, clarified: true, priorWork: { passed: true, verdict: "build_new" } }
    }
  );
  const id = created.project.id;
  await generateProjectApp(id);
  // Exactly the order runCustomerBuildJob uses.
  const url = await provisionGeneratedAppDatabaseUrl(id, name);
  const { setup } = await setupGeneratedAppDatabase(id);
  return { id, url, setup };
}

check(generatedAppDatabaseConfigured(), "a Neon API key alone counts as a configured database service");

const first = await build("Grace Chapel", ["website-builder", "events-scheduling", "payments-billing"]);
check(calls.projects === 1, `one build creates exactly one Neon project (created ${calls.projects})`);
check(first.url && first.url.includes("ep-proj-1."), "the deploy is wired to that project's database");
check(first.setup.status === "database_ready", `schema loaded into it (status ${first.setup.status}: ${first.setup.details})`);
check(first.setup.metadata?.generatedSchema === "public", "a dedicated database keeps its tables in public");
check(first.setup.metadata?.source === "neon_project", "the target is a per-app Neon project, not a branch");

const statements = [...calls.sql];
check(statements.some((q) => /create table if not exists\s+app_users\b/i.test(q) || /create table if not exists\s+\w+/i.test(q)), "schema statements were sent");
check(!statements.some((q) => /"generated_[a-z0-9_]+"\./i.test(q) || /create schema/i.test(q)), "no statement is rewritten into a side schema");

const second = await build("Joe's Handyman", ["website-builder", "crm-follow-up"]);
check(calls.projects === 2 && second.url.includes("ep-proj-2."), "a second app gets its own, separate project");

// Replay the exact statements into a real Postgres when one is available.
let pgUrl = process.env.SMOKE_SCHEMA_DATABASE_URL || "";
let stopPg = null;
const pgBin = "/usr/lib/postgresql/16/bin";
if (!pgUrl && fs.existsSync(`${pgBin}/initdb`) && process.getuid && process.getuid() !== 0) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gen-app-db-"));
  execFileSync(`${pgBin}/initdb`, ["-D", dir, "--auth-local=trust", "--no-sync", "--username=postgres"], { stdio: "ignore" });
  execFileSync(`${pgBin}/pg_ctl`, ["-D", dir, "-o", `-p 5547 -k ${dir}`, "-w", "start"], { stdio: "ignore" });
  pgUrl = `postgresql://postgres@localhost:5547/postgres?host=${dir}`;
  stopPg = () => execFileSync(`${pgBin}/pg_ctl`, ["-D", dir, "-m", "immediate", "stop"], { stdio: "ignore" });
}
if (pgUrl) {
  try {
    const firstAppSql = statements.join(";\n") + ";\n";
    execFileSync("psql", [pgUrl, "-v", "ON_ERROR_STOP=1", "-q", "-c", "drop schema public cascade; create schema public;"], { stdio: "ignore" });
    execFileSync("psql", [pgUrl, "-v", "ON_ERROR_STOP=1", "-q"], { input: firstAppSql, stdio: ["pipe", "ignore", "pipe"] });
    const tables = execFileSync("psql", [pgUrl, "-Atc", "select count(*) from information_schema.tables where table_schema = 'public'"]).toString().trim();
    check(Number(tables) > 10, `the statements apply to a real Postgres and land in public (${tables} tables)`);
  } catch (error) {
    check(false, `the statements apply to a real Postgres (${String(error.stderr || error.message).slice(0, 300)})`);
  } finally {
    stopPg?.();
  }
} else {
  console.log("ok - real-Postgres replay skipped (set SMOKE_SCHEMA_DATABASE_URL or run as non-root with PostgreSQL 16)");
}

if (failures) {
  console.error(`generated-app-database smoke failed (${failures})`);
  process.exit(1);
}
console.log("generated-app-database smoke ok");
