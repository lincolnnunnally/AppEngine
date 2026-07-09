import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Scalable gate for the whole module library: auto-discovers every module file in
// src/lib/engine/modules/, validates each against the AppModule contract, and
// checks cross-module invariants (no duplicate emitted paths, no colliding schema
// tables, every module registered, no module path shadowing a base-generator or
// foundation-modules file unless deliberately listed). Grows automatically as
// modules are added.
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

// Base-schema tables the modules must not collide with.
const baseTables = new Set([
  "users", "accounts", "sessions", "verification_token", "app_user_profiles", "organizations",
  "organization_memberships", "app_projects", "app_templates", "app_tasks", "agent_runs", "artifacts",
  "products", "support_tickets", "email_log", "payments"
]);

const files = fs.readdirSync(modulesDir).filter((f) => f.endsWith(".ts") && !["types.ts", "registry.ts"].includes(f));
const allPaths = new Map(); // emitted path -> module slug
const allTables = new Map(); // table name -> module slug
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

ok(`discovered ${moduleCount} modules, ${allPaths.size} emitted files, ${allTables.size} module tables (no collisions)`);

if (failures) { console.error(`\nmodules-registry smoke FAILED (${failures})`); process.exit(1); }
console.log("\nmodules-registry smoke ok");
