import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Verifies the content-edit module (Divi-style visual editing, Phase 1) emits a
// complete, owner-gated, feature-flagged click-to-edit layer into a generated
// app: a public read / admin-only write API, a template mount on every page, a
// runtime that applies stored overrides for all visitors and offers Edit mode
// only when the SERVER says canEdit, plus the /admin/content management page.
// Run: node scripts/smoke-generated-content-edit-module.js

const root = process.cwd();
let failures = 0;
function ok(l) { console.log(`ok - ${l}`); }
function bad(l, d) { failures++; console.error(`not ok - ${l}${d ? " :: " + d : ""}`); }
function has(h, n, l) { h.includes(n) ? ok(l) : bad(l, `missing: ${n}`); }
function lacks(h, n, l) { h.includes(n) ? bad(l, `must NOT contain: ${n}`) : ok(l); }

const { contentEditModule } = await import(pathToFileURL(path.join(root, "src/lib/engine/modules/content-edit.ts")).href);

const files = Object.fromEntries(contentEditModule.files({}).map((f) => [f.path, f.content]));
const get = (p) => { const c = files[p]; if (c == null) { bad(`emits ${p}`, "not emitted"); return ""; } ok(`emits ${p}`); return c; };

const lib = get("src/lib/db/content-overrides.ts");
const api = get("src/app/api/content-overrides/route.ts");
const template = get("src/app/template.tsx");
const runtime = get("src/components/content-edit/runtime.tsx");
const adminPage = get("src/app/admin/content/page.tsx");
const deleteButton = get("src/app/admin/content/override-delete-button.tsx");

// lib — model + queries
has(lib, "export async function listOverrides", "lib: per-page override reads");
has(lib, "export async function upsertOverride", "lib: upsert keyed by (page, element path)");
has(lib, "export async function deleteOverride", "lib: reset removes the stored row");
has(lib, "on conflict (page, element_path) do update", "lib: one row per element, updated in place");
lacks(lib.split("on conflict (page, element_path) do update")[1] || "", "original_text = excluded", "lib: first-saved original_text is never overwritten");
has(lib, "export function isValidElementPath", "lib: element paths validated against the minted shape");
has(lib, "export function normalizePage", "lib: page keys normalized the same way everywhere");
has(lib, 'process.env.FEATURE_CONTENT_EDIT', "lib: honors the feature flag");

// api — public read, admin-only writes
has(api, "export async function GET", "api: read endpoint exists");
has(api, "canEdit: canAccessAdmin(user?.role)", "api: canEdit decided server-side from the session role");
has(api, '"Cache-Control": "no-store"', "api: override reads are never cached stale");
const postBody = api.split("export async function POST")[1] || "";
has(postBody, "canAccessAdmin", "api: saving an edit is owner/admin-only");
const deleteBody = api.split("export async function DELETE")[1] || "";
has(deleteBody, "canAccessAdmin", "api: removing an edit is owner/admin-only");
has(api, "isValidElementPath(elementPath)", "api: rejects element paths we did not mint");
has(api, "OVERRIDE_SIZES", "api: style tokens validated against the allowed sets");

// template — the collision-free every-page mount
has(template, "ContentEditRuntime", "template: mounts the runtime on every route");
has(template, "{children}", "template: passes the page through untouched");

// runtime — applies for everyone, edits only for confirmed editors
has(runtime, '"use client"', "runtime: client component");
has(runtime, "data.canEdit === true", "runtime: edit affordances wait for the server's canEdit");
has(runtime, "{canEdit ? (", "runtime: anonymous visitors render zero edit UI");
has(runtime, "textContent", "runtime: text applied via textContent (no markup injection)");
lacks(runtime, "innerHTML", "runtime: never touches innerHTML");
has(runtime, "nth-of-type", "runtime: stable tag:nth-of-type element paths");
has(runtime, "data-ce-size", "runtime: size applied as a token attribute");
has(runtime, 'SIZE_CHOICES', "runtime: S/M/L/XL size choices");
has(runtime, "var(--ce-accent, var(--accent", "runtime: colors resolve through theme CSS variables");
has(runtime, 'contenteditable", "plaintext-only', "runtime: inline editing is plain text");
has(runtime, '"Edit page"', "runtime: plain-copy toggle");
has(runtime, "usePathname", "runtime: re-applies per page");

// admin management page
has(adminPage, "requireAdminAccess", "admin page: requires owner/admin");
has(adminPage, "listAllOverrides", "admin page: lists every stored edit");
has(adminPage, "No edits yet", "admin page: honest empty state");
has(adminPage, "contentEditEnabled()", "admin page: off-switch respected");
has(deleteButton, '"use client"', "admin page: remove button is interactive");
has(deleteButton, "Keep the edit", "admin page: removal asks before restoring");

// module contributions
const schema = contentEditModule.schemaSql?.() ?? "";
has(schema, "create table if not exists content_overrides", "schema: content_overrides table");
has(schema, "unique (page, element_path)", "schema: one row per (page, element path)");
has(schema, "original_text", "schema: original text kept for reset");
const env = (contentEditModule.envLines?.() ?? []).join("\n");
has(env, "FEATURE_CONTENT_EDIT", "env: documents the feature flag");
if (contentEditModule.tier === "optional") ok("module: optional tier (apps opt in)");
else bad("module: optional tier (apps opt in)", `tier is ${contentEditModule.tier}`);

// registry has the module
const reg = fs.readFileSync(path.join(root, "src/lib/engine/modules/registry.ts"), "utf8");
has(reg, "contentEditModule", "registry: content-edit registered");

if (failures) { console.error(`\ngenerated-content-edit-module smoke FAILED (${failures})`); process.exit(1); }
console.log("\ngenerated-content-edit-module smoke ok");
