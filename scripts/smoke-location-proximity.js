import fs from "node:fs";
import path from "node:path";

// Structural smoke for the Location & Proximity module: the staged schema, the
// TS client, and the catalog entry stay in sync on the contracts that protect
// privacy (fuzz-at-write, band-only person distances, RLS default-deny).
// Run: node scripts/smoke-location-proximity.js
const repoRoot = process.cwd();
let failures = 0;

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`missing ${label}: ${JSON.stringify(needle)}`);
  }
}

runStep("schema declares the geo tables, trigger, and RPC surface", () => {
  const sql = read("db/location-proximity-schema.sql");
  for (const needle of [
    "CREATE EXTENSION IF NOT EXISTS postgis",
    "CREATE TABLE IF NOT EXISTS geo_places",
    "CREATE TABLE IF NOT EXISTS geo_zip_centroids",
    "fuzzed_location  geography(Point, 4326)",
    "FUNCTION geo_fuzz_point",
    "FUNCTION geo_distance_band",
    "FUNCTION geo_upsert_place",
    "FUNCTION geo_search",
    "FUNCTION geo_near_me",
    "FUNCTION geo_distance_between",
    "FUNCTION geo_clear_place",
    "CREATE TRIGGER geo_places_write"
  ]) {
    assertIncludes(sql, needle, "schema element");
  }
});

runStep("schema enforces the privacy doctrine", () => {
  const sql = read("db/location-proximity-schema.sql");
  // visibility tiers + default
  assertIncludes(sql, "CHECK (visibility IN ('exact', 'neighborhood', 'city', 'hidden'))", "visibility tiers");
  // RLS default-deny; RPCs are the door
  assertIncludes(sql, "ALTER TABLE geo_places ENABLE ROW LEVEL SECURITY", "RLS on geo_places");
  assertIncludes(sql, "REVOKE ALL ON geo_places FROM anon, authenticated", "table access revoked");
  // deterministic write-time fuzz, seeded by row id
  assertIncludes(sql, "geo_fuzz_point(NEW.location, NEW.id", "write-time deterministic fuzz");
  // numeric distance only for exact rows; everyone else gets bands
  assertIncludes(sql, "CASE WHEN gp.visibility = 'exact'", "exact-only numeric distance");
  // hidden rows never searchable
  assertIncludes(sql, "gp.visibility <> 'hidden'", "hidden excluded from search");
  // search runs against the fuzzed column, never the exact one
  assertIncludes(sql, "ST_DWithin(gp.fuzzed_location", "search against fuzzed point");
  // v1 grant model: entire RPC surface is service-role-only (app_slug is
  // caller-supplied — a grant to authenticated enables cross-app enumeration)
  assertIncludes(sql, "REVOKE ALL ON FUNCTION geo_search", "geo_search revoked");
  if (/GRANT EXECUTE ON FUNCTION geo_search/.test(sql)) {
    throw new Error("geo_search must not be granted to client roles in v1");
  }
  // device-precise points must never downgrade to zip centroids on upsert
  assertIncludes(sql, "EXCLUDED.geocode_source = 'zip_centroid' AND gp.geocode_source = 'device'", "no zip downgrade of device point");
});

runStep("TS client exposes the module contract without coordinates", () => {
  const ts = read("src/lib/geo/location-proximity.ts");
  for (const sym of [
    "export function createGeoClient",
    "export function bandForMeters",
    "export function milesToMeters",
    "export const GEO_BAND_THRESHOLDS_M",
    "async upsertPlace",
    "async search",
    "async nearMe",
    "async distanceBetween",
    "async clearPlace"
  ]) {
    assertIncludes(ts, sym, "export");
  }
  // band thresholds mirror geo_distance_band() in the SQL (5/10/25/50 mi)
  for (const threshold of ["8047", "16093", "40234", "80467"]) {
    assertIncludes(ts, threshold, "band threshold");
  }
  for (const rpcName of ["geo_upsert_place", "geo_search", "geo_near_me", "geo_distance_between", "geo_clear_place"]) {
    assertIncludes(ts, rpcName, "rpc wiring");
  }
});

runStep("module catalog lists location-proximity with the mined sources", () => {
  const catalog = read("src/lib/engine/module-catalog.ts");
  assertIncludes(catalog, 'slug: "location-proximity"', "catalog slug");
  assertIncludes(catalog, "db/location-proximity-schema.sql", "primarySource schema");
  assertIncludes(catalog, "ChurchConnect backend/utils/geo.py", "mined ChurchConnect source");
});

runStep("band helper thresholds are ordered and labeled", () => {
  const ts = read("src/lib/geo/location-proximity.ts");
  const bands = ["< 5 mi", "5-10 mi", "10-25 mi", "25-50 mi", "50+ mi"];
  for (const band of bands) {
    assertIncludes(ts, band, "band label");
  }
  const sql = read("db/location-proximity-schema.sql");
  for (const band of bands) {
    assertIncludes(sql, band, "sql band label");
  }
});

if (failures > 0) {
  console.error(`\n${failures} step(s) failed`);
  process.exit(1);
}
console.log("\nlocation-proximity smoke: all steps passed");
