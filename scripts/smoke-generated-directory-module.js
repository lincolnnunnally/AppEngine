import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Verifies the directory-community module — ported from ChurchConnect's real
// people directory (people.py + ChurchDirectory.tsx) — emits a complete,
// usable, auth-gated, feature-flagged directory into a generated app.
// Run: node scripts/smoke-generated-directory-module.js

const root = process.cwd();
let failures = 0;
function ok(l) { console.log(`ok - ${l}`); }
function bad(l, d) { failures++; console.error(`not ok - ${l}${d ? " :: " + d : ""}`); }
function has(h, n, l) { h.includes(n) ? ok(l) : bad(l, `missing: ${n}`); }

const { directoryCommunityModule } = await import(pathToFileURL(path.join(root, "src/lib/engine/modules/directory-community.ts")).href);

const files = Object.fromEntries(directoryCommunityModule.files({}).map((f) => [f.path, f.content]));
const get = (p) => { const c = files[p]; if (c == null) { bad(`emits ${p}`, "not emitted"); return ""; } ok(`emits ${p}`); return c; };

const lib = get("src/lib/db/directory.ts");
const api = get("src/app/api/directory/route.ts");
const detailApi = get("src/app/api/directory/[id]/route.ts");
const listPage = get("src/app/directory/page.tsx");
const profilePage = get("src/app/directory/[id]/page.tsx");

// lib — ported model + queries
has(lib, "export async function listDirectory", "lib: list + search");
has(lib, "export async function getPerson", "lib: profile lookup");
has(lib, "export async function upsertPerson", "lib: admin upsert");
has(lib, "calculateDataQuality", "lib: data-quality score (ported from people.py)");
has(lib, "from directory_people", "lib: reads the directory table");
has(lib, "order by data_quality_score desc", "lib: highest-quality first (matches source)");
has(lib, "fallbackPeople", "lib: graceful sample-data fallback with no DB");
has(lib, 'process.env.FEATURE_DIRECTORY', "lib: honors the feature flag");

// APIs — gated
has(api, "canAccessCustomerArea", "api: list is sign-in gated");
has(api, "canAccessAdmin", "api: create is admin-only");
has(api, "directoryEnabled()", "api: respects the feature flag");
has(detailApi, "canAccessCustomerArea", "api: profile is sign-in gated");

// pages — usable
has(listPage, "requireCustomerAccess", "page: directory requires sign-in");
has(listPage, 'role="search"', "page: accessible search form");
has(listPage, "No one", "page: honest empty state");
has(listPage, "directoryEnabled()", "page: off-switch respected");
has(profilePage, "notFound()", "page: 404s a missing profile");

// module contributions
const schema = directoryCommunityModule.schemaSql?.() ?? "";
has(schema, "create table if not exists directory_people", "schema: directory_people table");
has(schema, "directory_people_email_idx", "schema: email index");
const env = (directoryCommunityModule.envLines?.() ?? []).join("\n");
has(env, "FEATURE_DIRECTORY", "env: documents the feature flag");
const home = (directoryCommunityModule.homeLinks?.() ?? []).join("\n");
has(home, "/directory", "nav: linked from the home page");

// generator composes modules generically (structural)
const gen = fs.readFileSync(path.join(root, "src/lib/engine/app-generator.ts"), "utf8");
has(gen, "composeModuleFiles(", "generator: composes all registered modules");
has(gen, "composeModuleSchemaSql(", "generator: composes module schemas");
has(gen, "composeModuleSeedSql(", "generator: composes module seed data");

// registry has both live modules
const reg = fs.readFileSync(path.join(root, "src/lib/engine/modules/registry.ts"), "utf8");
has(reg, "identityAuthModule", "registry: auth registered");
has(reg, "directoryCommunityModule", "registry: directory registered");

if (failures) { console.error(`\ngenerated-directory-module smoke FAILED (${failures})`); process.exit(1); }
console.log("\ngenerated-directory-module smoke ok");
