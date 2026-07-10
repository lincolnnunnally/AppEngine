import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Scalable gate for the whole module library: auto-discovers every module file in
// src/lib/engine/modules/, validates each against the AppModule contract, and
// checks cross-module invariants (no duplicate emitted paths, no colliding schema
// tables, every module registered, no module path shadowing a base-generator or
// foundation-modules file unless deliberately listed). Grows automatically as
// modules are added.
//
// Also composes the FULL generated-app schema (base-schema.ts + foundation +
// every module's schemaSql) and type-checks it: every foreign key must point at
// a table+column that exists, in the same type family (uuid vs integer vs text —
// Postgres refuses cross-family FKs at apply time), every user FK must be uuid
// (the T12 identity decision: users.id is uuid everywhere), and a module may
// only FK its own tables or base/foundation tables (anything else breaks apps
// that compose a subset of modules). This is the gate that would have caught the
// original `users.id serial` vs `user_id uuid references users(id)` mismatch.
// Optionally set SMOKE_SCHEMA_DATABASE_URL to also apply the composed schema to
// a real scratch Postgres inside a rolled-back transaction (needs psql).
// Run: node scripts/smoke-modules-registry.js

const root = process.cwd();
const modulesDir = path.join(root, "src/lib/engine/modules");
let failures = 0;
const ok = (l) => console.log(`ok - ${l}`);
const bad = (l, d) => { failures++; console.error(`not ok - ${l}${d ? " :: " + d : ""}`); };

const registrySrc = fs.readFileSync(path.join(modulesDir, "registry.ts"), "utf8");
const ctx = {
  projectName: "Smoke App",
  roles: ["owner", "admin", "customer", "vendor"],
  roleMatrix: [{ role: "owner", can: ["manage app operations"] }, { role: "customer", can: ["manage own account"] }],
  protectedRoutes: [{ path: "/app", access: ["owner", "admin", "customer"] }, { path: "/admin", access: ["owner", "admin"] }]
};

// ---- schema parsing helpers ----------------------------------------------------
// Small, deliberately strict SQL parser for the schema dialect this repo emits
// (create table if not exists / column-per-line / alter table add column). It
// builds table→column→type maps and the FK edge list the consistency checks run
// on. If the emitted SQL style drifts past what this parses, the staleness
// sanity checks below fail loudly rather than silently checking nothing.

function typeFamily(rawType) {
  const t = rawType.toLowerCase().trim();
  if (/^(smallserial|serial|bigserial|smallint|integer|int2|int4|int8|int|bigint)\b/.test(t)) return "integer";
  if (/^uuid\b/.test(t)) return "uuid";
  if (/^(text|varchar|character varying|character|char|citext)/.test(t)) return "text";
  if (/^(timestamptz|timestamp|date|time)\b/.test(t)) return "time";
  if (/^(numeric|decimal|real|double precision|money)/.test(t)) return "numeric";
  if (/^(bool|boolean)\b/.test(t)) return "boolean";
  if (/^(jsonb|json)\b/.test(t)) return "json";
  return t.split(/[\s(]/)[0];
}

// Parses one schema-SQL string. Returns { tables: Map<table, Map<column, type>>,
// fks: [{table, column, refTable, refColumn}] }.
function parseSchemaSql(sql) {
  const tables = new Map();
  const fks = [];
  const typePattern = /^(character varying(\(\d+\))?|double precision|[a-z]+(\(\d+(,\s*\d+)?\))?(\[\])?)/i;

  for (const tableMatch of sql.matchAll(/create table if not exists\s+"?([a-z_]+)"?\s*\(([\s\S]*?)\n\)/gi)) {
    const tableName = tableMatch[1].toLowerCase();
    const columns = tables.get(tableName) ?? new Map();
    tables.set(tableName, columns);
    for (const rawLine of tableMatch[2].split("\n")) {
      const line = rawLine.trim().replace(/,$/, "");
      if (!line || line.startsWith("--")) continue;
      // Table-level constraints, not column definitions.
      const constraintMatch = line.match(/^foreign key\s*\(\s*"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\)\s*references\s+"?([a-z_]+)"?\s*(?:\(\s*"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\))?/i);
      if (constraintMatch) {
        fks.push({ table: tableName, column: constraintMatch[1], refTable: constraintMatch[2].toLowerCase(), refColumn: constraintMatch[3] || "id" });
        continue;
      }
      if (/^(primary key|unique|check|constraint|exclude)\b/i.test(line)) continue;
      const columnMatch = line.match(/^"?([A-Za-z_][A-Za-z0-9_]*)"?\s+(.*)$/);
      if (!columnMatch) continue;
      const typeMatch = columnMatch[2].match(typePattern);
      if (!typeMatch) continue;
      columns.set(columnMatch[1], typeMatch[1]);
      const refMatch = columnMatch[2].match(/references\s+"?([a-z_]+)"?\s*(?:\(\s*"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\))?/i);
      if (refMatch) {
        fks.push({ table: tableName, column: columnMatch[1], refTable: refMatch[1].toLowerCase(), refColumn: refMatch[2] || "id" });
      }
    }
  }

  for (const alterMatch of sql.matchAll(/alter table\s+"?([a-z_]+)"?\s+add column if not exists\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s+([a-z][a-z ]*(\(\d+(,\s*\d+)?\))?)/gi)) {
    const columns = tables.get(alterMatch[1].toLowerCase()) ?? new Map();
    tables.set(alterMatch[1].toLowerCase(), columns);
    columns.set(alterMatch[2], alterMatch[3].trim());
    const refMatch = alterMatch[0].match(/references\s+"?([a-z_]+)"?\s*(?:\(\s*"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\))?/i);
    if (refMatch) fks.push({ table: alterMatch[1].toLowerCase(), column: alterMatch[2], refTable: refMatch[1].toLowerCase(), refColumn: refMatch[2] || "id" });
  }

  return { tables, fks };
}

// Base + foundation schema, imported from the same sources the generator
// composes, so the reserved-table set and the type map can never drift from the
// real emitted SQL (the old hand-maintained base-table list missed six tables).
const { baseSchemaSql } = await import(pathToFileURL(path.join(root, "src/lib/engine/base-schema.ts")).href);
const { foundationSchemaSql } = await import(pathToFileURL(path.join(root, "src/lib/engine/foundation-modules.ts")).href);
const baseParsed = parseSchemaSql(baseSchemaSql());
const foundationParsed = parseSchemaSql(foundationSchemaSql());
const baseTables = new Set([...baseParsed.tables.keys(), ...foundationParsed.tables.keys()]);

// Staleness guards: if the parser stops seeing the schema we know is there, the
// checks below would pass vacuously — fail instead.
if (baseParsed.tables.size < 15) bad("base schema parses from base-schema.ts", `only ${baseParsed.tables.size} tables — parser or schema moved`);
if (foundationParsed.tables.size < 3) bad("foundation schema parses from foundation-modules.ts", `only ${foundationParsed.tables.size} tables`);
if (typeFamily(baseParsed.tables.get("users")?.get("id") ?? "") !== "uuid") {
  bad("users.id is uuid (T12 identity decision)", `parsed type: ${baseParsed.tables.get("users")?.get("id")}`);
}

const files = fs.readdirSync(modulesDir).filter((f) => f.endsWith(".ts") && !["types.ts", "registry.ts"].includes(f));
const allPaths = new Map(); // emitted path -> module slug
const allTables = new Map(); // table name -> module slug
const moduleSchemas = []; // { slug, sql, parsed } for the composed FK/type checks
const moduleSeeds = []; // { slug, sql } for the statement-split check
let moduleCount = 0;

for (const fileName of files) {
  const mod = await import(pathToFileURL(path.join(modulesDir, fileName)).href);
  const entry = Object.values(mod).find((v) => v && typeof v === "object" && typeof v.slug === "string" && typeof v.files === "function");
  if (!entry) { bad(`${fileName}: exports an AppModule`, "no AppModule export found"); continue; }
  moduleCount++;
  const tag = `[${entry.slug}]`;

  // contract basics
  if (!entry.name) bad(`${tag} has a name`);
  if (!["foundation", "optional"].includes(entry.tier)) bad(`${tag} valid tier`, entry.tier);
  if (entry.tier === "optional" && !entry.featureFlagEnv) bad(`${tag} optional module has a feature flag`);

  // registered
  const varName = Object.keys(mod).find((k) => mod[k] === entry);
  registrySrc.includes(varName) ? ok(`${tag} registered in registry.ts`) : bad(`${tag} registered in registry.ts`, `${varName} not referenced`);

  // files
  let emitted;
  try { emitted = entry.files(ctx); } catch (e) { bad(`${tag} files() runs`, String(e).slice(0, 120)); continue; }
  if (!Array.isArray(emitted) || emitted.length === 0) { bad(`${tag} emits files`); continue; }
  for (const f of emitted) {
    if (!f || typeof f.path !== "string" || typeof f.content !== "string" || !f.content.trim()) { bad(`${tag} emits valid file`, JSON.stringify(f?.path)); continue; }
    if (allPaths.has(f.path)) bad(`${tag} no path collision`, `${f.path} also from [${allPaths.get(f.path)}]`);
    else allPaths.set(f.path, entry.slug);
  }
  ok(`${tag} emits ${emitted.length} files`);

  // schema tables — parse + collision check
  const schema = entry.schemaSql?.() ?? "";
  const tableNames = [...schema.matchAll(/create table if not exists\s+([a-z_]+)/gi)].map((m) => m[1].toLowerCase());
  for (const t of tableNames) {
    if (baseTables.has(t)) bad(`${tag} table ${t} collides with a base table`);
    else if (allTables.has(t)) bad(`${tag} table ${t} collides with [${allTables.get(t)}]`);
    else allTables.set(t, entry.slug);
  }
  if (schema) moduleSchemas.push({ slug: entry.slug, sql: schema, parsed: parseSchemaSql(schema) });
  const seed = entry.seedSql?.() ?? "";
  if (seed) moduleSeeds.push({ slug: entry.slug, sql: seed });
  if (entry.tier === "optional" && entry.envLines && !(entry.envLines().join("\n")).includes(entry.featureFlagEnv)) {
    bad(`${tag} envLines documents its feature flag`);
  }
}

// ---- module paths vs base-generator / foundation paths ------------------------
// The generator resolves base/module path overlaps module-wins (buildGeneratedFiles
// in ../app-generator.ts filters same-path base entries when a module emits that
// path). Every overlap must therefore be deliberate and listed here — otherwise a
// module file could silently replace a base page nobody meant it to (or, before
// the module-wins rule, be silently overwritten by a base placeholder).
const intendedBaseOverrides = new Map([
  // purpose-onboarding's real onboarding flow replaces the base placeholder page.
  ["src/app/onboarding/page.tsx", "purpose-onboarding"]
]);

const generatorSrc = fs.readFileSync(path.join(root, "src/lib/engine/app-generator.ts"), "utf8");
// File entries use `path: "src/..."`; route strings (`path: "/app"`) start with "/".
const basePaths = new Set([...generatorSrc.matchAll(/path: "([^"]+)"/g)].map((m) => m[1]).filter((p) => !p.startsWith("/")));
const foundationSrc = fs.readFileSync(path.join(root, "src/lib/engine/foundation-modules.ts"), "utf8");
const foundationPaths = new Set([...foundationSrc.matchAll(/file\("([^"]+)"/g)].map((m) => m[1]));

if (basePaths.size < 10) bad("base-generator paths parse from app-generator.ts", `only ${basePaths.size} found — extraction regex likely stale`);
if (foundationPaths.size < 5) bad("foundation paths parse from foundation-modules.ts", `only ${foundationPaths.size} found — extraction regex likely stale`);

let overlapCount = 0;
for (const [emittedPath, owner] of allPaths) {
  const collidesWith = basePaths.has(emittedPath) ? "base-generator" : foundationPaths.has(emittedPath) ? "foundation-modules" : null;
  if (!collidesWith) continue;
  overlapCount++;
  if (intendedBaseOverrides.get(emittedPath) === owner) ok(`[${owner}] intentionally overrides ${collidesWith} file ${emittedPath}`);
  else bad(`[${owner}] path ${emittedPath} shadows a ${collidesWith} file`, "list it in intendedBaseOverrides only if the module file should win");
}
for (const [overridePath, owner] of intendedBaseOverrides) {
  if (allPaths.get(overridePath) !== owner) bad(`intendedBaseOverrides is stale: ${overridePath} is not emitted by [${owner}]`);
  else if (!basePaths.has(overridePath) && !foundationPaths.has(overridePath)) bad(`intendedBaseOverrides is stale: ${overridePath} is no longer a base/foundation path`);
}
// The resolution mechanism itself must stay in the generator, or the overrides
// above silently flip back to base-wins (files are written sequentially).
if (generatorSrc.includes("moduleFileEntries.has(file) || !moduleFilePaths.has(file.path)")) {
  ok("app-generator resolves base/module path overlaps module-wins");
} else {
  bad("app-generator resolves base/module path overlaps module-wins", "filter missing from buildGeneratedFiles");
}
ok(`checked ${allPaths.size} module paths against ${basePaths.size} base + ${foundationPaths.size} foundation paths (${overlapCount} intentional overlaps)`);

// ---- composed-schema FK/type consistency ---------------------------------------
// Compose the schema exactly the way buildSchemaSql does (base + foundation +
// every module) and verify every foreign key would actually apply on Postgres:
// the target table+column must exist and the column types must share a family
// (uuid→serial is the mismatch that shipped unapplyable schemas until T12).
const sources = [
  { label: "base-schema", parsed: baseParsed, own: new Set(baseParsed.tables.keys()) },
  { label: "foundation", parsed: foundationParsed, own: new Set(foundationParsed.tables.keys()) },
  ...moduleSchemas.map((m) => ({ label: m.slug, parsed: m.parsed, own: new Set(m.parsed.tables.keys()), isModule: true }))
];
const composedTypes = new Map(); // table -> Map(column -> type)
for (const source of sources) {
  for (const [table, columns] of source.parsed.tables) {
    const merged = composedTypes.get(table) ?? new Map();
    for (const [column, type] of columns) merged.set(column, type);
    composedTypes.set(table, merged);
  }
}

let fkCount = 0;
let userFkCount = 0;
let fkFailures = 0;
for (const source of sources) {
  for (const fk of source.parsed.fks) {
    fkCount++;
    const label = `[${source.label}] ${fk.table}.${fk.column} -> ${fk.refTable}(${fk.refColumn})`;
    // A module may only FK its own tables or base/foundation tables — an FK into
    // another module's table breaks every app that composes a subset of modules.
    if (source.isModule && !source.own.has(fk.refTable) && !baseTables.has(fk.refTable)) {
      bad(`${label} crosses into another module's table`, "modules must be composable independently"); fkFailures++; continue;
    }
    const refColumns = composedTypes.get(fk.refTable);
    if (!refColumns) { bad(`${label} references a table that no source creates`); fkFailures++; continue; }
    const refType = refColumns.get(fk.refColumn);
    if (!refType) { bad(`${label} references a column that doesn't exist`); fkFailures++; continue; }
    const columnType = composedTypes.get(fk.table)?.get(fk.column);
    if (!columnType) { bad(`${label} column type didn't parse`); fkFailures++; continue; }
    const from = typeFamily(columnType);
    const to = typeFamily(refType);
    if (from !== to) { bad(`${label} type mismatch`, `${columnType} (${from}) cannot FK ${refType} (${to})`); fkFailures++; continue; }
    if (fk.refTable === "users") {
      userFkCount++;
      // The identity decision, enforced: user identity is uuid EVERYWHERE.
      if (from !== "uuid") { bad(`${label} user FK must be uuid (T12)`, columnType); fkFailures++; }
    }
  }
}
if (fkCount < 100) bad("composed schema FK extraction", `only ${fkCount} FKs parsed — parser likely stale`);
if (!fkFailures) ok(`composed schema: ${fkCount} FKs consistent across ${composedTypes.size} tables (${userFkCount} user FKs, all uuid)`);

// ---- db:setup statement-split integrity ----------------------------------------
// Generated apps apply schema.sql/seed.sql through the emitted setup-database.mjs,
// which splits on ";" outside quotes. That splitter must understand "--" line
// comments (module comments contain prose semicolons and apostrophes) — checked
// structurally on the generator source, then behaviorally by splitting the real
// composed schema + seeds the same way and requiring every resulting statement
// to start with a SQL keyword. A comment tail surfacing as a bare statement (the
// pre-T12 failure) starts with prose and fails the keyword test. If schema SQL
// ever adds constructs this split can't handle (dollar-quoted bodies, block
// comments), this check is the tripwire to upgrade the emitted splitter too.
function splitSqlStatements(contents) {
  const statements = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let previous = "";
  for (const character of contents) {
    current += character;
    if (inLineComment) {
      if (character === "\n") inLineComment = false;
    } else if (character === "-" && previous === "-" && !inSingleQuote && !inDoubleQuote) {
      inLineComment = true;
    } else if (character === "'" && !inDoubleQuote && previous !== "\\") {
      inSingleQuote = !inSingleQuote;
    } else if (character === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (character === ";" && !inSingleQuote && !inDoubleQuote) {
      const statement = current.trim();
      if (statement.replace(/^\s*--.*$/gm, "").trim()) statements.push(statement);
      current = "";
    }
    previous = character;
  }
  const finalStatement = current.trim();
  if (finalStatement.replace(/^\s*--.*$/gm, "").trim()) statements.push(finalStatement);
  return statements;
}

if (!generatorSrc.includes("inLineComment")) {
  bad("emitted setup-database.mjs splitter is comment-aware", "inLineComment handling missing from app-generator.ts");
}
const { foundationSeedSql } = await import(pathToFileURL(path.join(root, "src/lib/engine/foundation-modules.ts")).href);
const composedForSplit = [
  baseSchemaSql(), foundationSchemaSql(), ...moduleSchemas.map((m) => m.sql),
  foundationSeedSql?.() ?? "", ...moduleSeeds.map((m) => m.sql)
].join("\n");
const SQL_KEYWORD = /^(--[^\n]*\n|\s)*(create|alter|insert|update|delete|drop|with|do|grant|revoke|comment|select|truncate)\b/i;
const splitStatements = splitSqlStatements(composedForSplit);
const badStatements = splitStatements.filter((statement) => !SQL_KEYWORD.test(statement));
if (splitStatements.length < 200) bad("db:setup split extraction", `only ${splitStatements.length} statements — split or composition stale`);
for (const statement of badStatements.slice(0, 5)) {
  bad("db:setup split yields a non-SQL statement", JSON.stringify(statement.slice(0, 100)));
}
if (!badStatements.length) ok(`db:setup split integrity: ${splitStatements.length} statements, all start with SQL keywords`);

// Optional gold-standard check: apply the composed schema to a real scratch
// Postgres and roll back. Opt-in (needs a database nothing cares about):
//   SMOKE_SCHEMA_DATABASE_URL=postgres://... node scripts/smoke-modules-registry.js
const scratchUrl = process.env.SMOKE_SCHEMA_DATABASE_URL;
if (scratchUrl) {
  const { spawnSync } = await import("node:child_process");
  const os = await import("node:os");
  const composedSql = [baseSchemaSql(), foundationSchemaSql(), ...moduleSchemas.map((m) => m.sql)].join("\n");
  const sqlFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "appengine-schema-")), "composed-schema.sql");
  fs.writeFileSync(sqlFile, `begin;\n${composedSql}\nrollback;\n`);
  const result = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", sqlFile, scratchUrl], { encoding: "utf8" });
  if (result.error) bad("composed schema applies to scratch Postgres", `psql not runnable: ${result.error.message}`);
  else if (result.status !== 0) bad("composed schema applies to scratch Postgres", (result.stderr || "").trim().slice(0, 300));
  else ok("composed schema applies to scratch Postgres (rolled back)");
  fs.rmSync(path.dirname(sqlFile), { recursive: true, force: true });
} else {
  ok("scratch-Postgres apply skipped (set SMOKE_SCHEMA_DATABASE_URL to enable)");
}

ok(`discovered ${moduleCount} modules, ${allPaths.size} emitted files, ${allTables.size} module tables (no collisions)`);

if (failures) { console.error(`\nmodules-registry smoke FAILED (${failures})`); process.exit(1); }
console.log("\nmodules-registry smoke ok");
