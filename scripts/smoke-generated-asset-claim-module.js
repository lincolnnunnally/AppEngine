import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// Verifies the asset-claim module emits a complete, feature-flagged claim flow into
// a generated app: a per-asset claim (single-use token + human code + /claim/{token}
// URL), a public claim page that assigns the asset + records a destination, a public
// read-only /my-asset/{token} status page scoped to one asset, and an admin console —
// generalized from the toner-management-app printer claim pattern. Every emitted file
// is transpiled so a quoting slip in the string-emitted code fails here, not in a
// generated app. Run: node scripts/smoke-generated-asset-claim-module.js

const root = process.cwd();
let failures = 0;
function ok(l) { console.log(`ok - ${l}`); }
function bad(l, d) { failures++; console.error(`not ok - ${l}${d ? " :: " + d : ""}`); }
function has(h, n, l) { h.includes(n) ? ok(l) : bad(l, `missing: ${n}`); }
function lacks(h, n, l) { h.includes(n) ? bad(l, `must NOT contain: ${n}`) : ok(l); }

const { assetClaimModule } = await import(pathToFileURL(path.join(root, "src/lib/engine/modules/asset-claim.ts")).href);

const emitted = assetClaimModule.files({});
const files = Object.fromEntries(emitted.map((f) => [f.path, f.content]));
const get = (p) => { const c = files[p]; if (c == null) { bad(`emits ${p}`, "not emitted"); return ""; } ok(`emits ${p}`); return c; };

// --- every emitted file must be syntactically valid TS/TSX ----------------------
for (const f of emitted) {
  const compilerOptions = { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext };
  if (f.path.endsWith(".tsx")) compilerOptions.jsx = ts.JsxEmit.Preserve;
  const result = ts.transpileModule(f.content, { reportDiagnostics: true, fileName: f.path, compilerOptions });
  const syntactic = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (syntactic.length) {
    bad(`${f.path} transpiles cleanly`, ts.flattenDiagnosticMessageText(syntactic[0].messageText, " "));
  } else {
    ok(`${f.path} transpiles cleanly`);
  }
}

const tokens = get("src/lib/asset-claim/tokens.ts");
const lib = get("src/lib/db/asset-claim.ts");
const apiList = get("src/app/api/asset-claim/route.ts");
const apiDetail = get("src/app/api/asset-claim/[id]/route.ts");
const apiClaim = get("src/app/api/claim/[token]/route.ts");
const apiStatus = get("src/app/api/my-asset/[token]/route.ts");
const claimForm = get("src/components/asset-claim/claim-form.tsx");
const claimPage = get("src/app/claim/[token]/page.tsx");
const statusPage = get("src/app/my-asset/[token]/page.tsx");
const consolePage = get("src/app/asset-claims/page.tsx");
const consoleActions = get("src/app/asset-claims/actions.tsx");

// tokens — hashed, single-use vs persistent, node:crypto
has(tokens, "createHash", "tokens: tokens are sha256-hashed");
has(tokens, "randomBytes(4).toString(\"hex\").toUpperCase()", "tokens: human 8-hex claim code");
has(tokens, "/claim/", "tokens: builds the claim URL");
has(tokens, "/my-asset/", "tokens: builds the status URL");

// lib — the four primitives + safety invariants
has(lib, "export async function createClaim", "lib: admin mints a per-asset claim");
has(lib, "export async function submitClaim", "lib: public claim assigns + records destination");
has(lib, "export async function getAssetStatus", "lib: persistent read-only status");
has(lib, "status_token_hash", "lib: mints a persistent read-only status token");
has(lib, "hashToken(token)", "lib: only the token hash ever touches the DB");
has(lib, "or c.claim_token_hash = ${tokenHash}", "lib: status accepts the claim token as fallback");
has(lib, "on_device_ref is not null", "lib: soft on-device hook, surfaced as a boolean");
lacks(lib, "insert into users", "lib: anonymous claimants never become auth users");
lacks(lib, "unit_cost", "lib: no cost columns anywhere near the status read");
lacks(lib, "price", "lib: no price data in the status read");
has(lib, 'process.env.FEATURE_ASSET_CLAIM', "lib: honors the feature flag");

// admin API — gated create + claim + revoke
has(apiList, "canAccessAdmin", "api list: admin-gated");
has(apiList.split("export async function POST")[1] || "", "createClaim", "api: POST can mint a claim");
has(apiDetail, "canAccessAdmin", "api detail: revoke is admin-gated");
has(apiDetail, "revokeClaim", "api detail: revoke wired");

// public claim API — honeypot, no auth needed, scoped submit
has(apiClaim, "export async function GET", "public claim: readable by token");
has(apiClaim, "export async function POST", "public claim: submittable by token");
has(apiClaim, "body.hp", "public claim: honeypot on the write path");
lacks(apiClaim, "canAccessAdmin", "public claim: intentionally not admin-gated");

// public status API — read-only, no auth
has(apiStatus, "getAssetStatus", "public status: read-only status by token");
lacks(apiStatus, "export async function POST", "public status: read-only (no writes)");

// client files must never pull the db driver into the bundle
for (const [name, content] of [["claim-form", claimForm], ["actions", consoleActions]]) {
  has(content, '"use client"', `${name}: client component`);
  lacks(content, "@/lib/db/", `${name}: no db import in the client bundle`);
}
has(claimForm, 'name="hp"', "claim form: renders the honeypot field");
has(claimForm, "no login needed", "claim form: surfaces the bookmarkable status link");

// pages — feature flag + gating + public entry
has(claimPage, "assetClaimEnabled()", "claim page: off-switch respected");
has(statusPage, "assetClaimEnabled()", "status page: off-switch respected");
has(consolePage, "requireCustomerAccess", "console: requires a signed-in customer");
has(consolePage, "canAccessAdmin", "console: admin-only management");

// schema — four prefixed tables, ordered, with the status-token index + soft hook
const schema = assetClaimModule.schemaSql?.() ?? "";
for (const t of ["asset_claim_locations", "asset_claim_assets", "asset_claim_claims", "asset_claim_assignment_history"]) {
  has(schema, `create table if not exists ${t}`, `schema: ${t} table`);
}
has(schema, "claim_token_hash text not null unique", "schema: single-use claim token hash");
has(schema, "status_token_hash text", "schema: persistent status token hash");
has(schema, "asset_claim_claims_status_token_uq", "schema: status token partial-unique index");
has(schema, "on_device_ref text", "schema: soft on-device hook column (not an FK)");
lacks(schema, "references fleet_monitoring_agent", "schema: no cross-module FK into fleet tables");
// locations must be created before assets/claims that reference them.
const posLoc = schema.indexOf("create table if not exists asset_claim_locations");
const posAsset = schema.indexOf("create table if not exists asset_claim_assets");
const posClaim = schema.indexOf("create table if not exists asset_claim_claims");
(posLoc < posAsset && posAsset < posClaim) ? ok("schema: tables ordered so FKs apply in sequence") : bad("schema: tables ordered so FKs apply in sequence");

const env = (assetClaimModule.envLines?.() ?? []).join("\n");
has(env, "FEATURE_ASSET_CLAIM", "env: documents the feature flag");
if (assetClaimModule.tier === "optional") ok("module: optional tier (apps opt in)");
else bad("module: optional tier (apps opt in)", `tier is ${assetClaimModule.tier}`);

const reg = fs.readFileSync(path.join(root, "src/lib/engine/modules/registry.ts"), "utf8");
has(reg, "assetClaimModule", "registry: asset-claim registered");

if (failures) { console.error(`\ngenerated-asset-claim-module smoke FAILED (${failures})`); process.exit(1); }
console.log("\ngenerated-asset-claim-module smoke ok");
