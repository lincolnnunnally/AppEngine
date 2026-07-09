import fs from "node:fs";
import path from "node:path";
import {
  cloudflareDnsConfigured,
  ensureEcosystemSubdomain,
  subdomainLabelFromProjectName
} from "../src/lib/engine/cloudflare-dns.ts";

// Smoke for the Cloudflare DNS adapter (auto <slug>.unitedundergod.org subdomains).
// The zone hosts the owner's LIVE WordPress + email, so most of this smoke exists
// to prove the adapter is ADD-ONLY: it never updates or deletes, and any existing
// record under a name makes it back off. Network is mocked. Run:
// node scripts/smoke-cloudflare-dns.js
const repoRoot = process.cwd();

const savedEnv = { token: process.env.CLOUDFLARE_API_TOKEN, zone: process.env.CLOUDFLARE_ZONE_ID };
const realFetch = globalThis.fetch;

await runStep("unconfigured (no token) means a quiet no, not a crash", async () => {
  delete process.env.CLOUDFLARE_API_TOKEN;
  if (cloudflareDnsConfigured()) throw new Error("should be unconfigured without the token");
  const result = await ensureEcosystemSubdomain("some-app");
  assertEqual(result.ok, false, "unconfigured result");
  assertIncludes(result.message, "CLOUDFLARE_API_TOKEN", "message names the missing key");
});

await runStep("label derivation: generated project names -> clean slugs", () => {
  assertEqual(subdomainLabelFromProjectName("wesucceed-my-church-app-a1b2c3"), "my-church-app", "strips prefix + hex suffix");
  assertEqual(subdomainLabelFromProjectName("laser-engrave-market"), "laser-engrave-market", "plain names pass through");
  assertEqual(subdomainLabelFromProjectName("My App!!"), "my-app", "normalizes to a DNS label");
});

await runStep("infrastructure labels are refused outright (www, mail, ...)", async () => {
  process.env.CLOUDFLARE_API_TOKEN = "smoke-test-token";
  for (const label of ["www", "mail", "webmail", "ftp", "_dmarc"]) {
    const result = await ensureEcosystemSubdomain(label);
    assertEqual(result.ok, false, `${label} refused`);
    assertIncludes(result.message, "reserved", `${label} message says reserved`);
  }
});

await runStep("ADD-ONLY fence: an existing record under the name means back off", async () => {
  process.env.CLOUDFLARE_API_TOKEN = "smoke-test-token";
  process.env.CLOUDFLARE_ZONE_ID = "zone-smoke";
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method || "GET" });
    if (String(url).includes("dns_records?name=")) {
      return jsonResponse({ success: true, result: [{ type: "A", content: "67.205.20.0" }] });
    }
    throw new Error(`unexpected call: ${url}`);
  };
  const result = await ensureEcosystemSubdomain("taken-name");
  assertEqual(result.ok, false, "existing record wins");
  assertIncludes(result.message, "left untouched", "reports it backed off");
  if (calls.some((c) => c.method !== "GET")) throw new Error("must not write when the name is taken");
});

await runStep("fresh name -> exactly one POST, DNS-only CNAME to Vercel", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method || "GET", body: init?.body ? JSON.parse(init.body) : null });
    if (String(url).includes("dns_records?name=")) return jsonResponse({ success: true, result: [] });
    if (init?.method === "POST") return jsonResponse({ success: true, result: { id: "rec1" } });
    throw new Error(`unexpected call: ${url}`);
  };
  const result = await ensureEcosystemSubdomain("fresh-app");
  assertEqual(result.ok, true, "created");
  assertEqual(result.created, true, "created flag");
  assertEqual(result.fqdn, "fresh-app.unitedundergod.org", "fqdn");
  const writes = calls.filter((c) => c.method !== "GET");
  assertEqual(writes.length, 1, "exactly one write");
  assertEqual(writes[0].method, "POST", "the write is a create");
  assertEqual(writes[0].body.type, "CNAME", "CNAME record");
  assertEqual(writes[0].body.content, "cname.vercel-dns.com", "Vercel target");
  assertEqual(writes[0].body.proxied, false, "grey cloud / DNS-only per the runbook");
});

await runStep("add-only BY CONSTRUCTION: no update/delete verbs exist in the module", () => {
  const text = read("src/lib/engine/cloudflare-dns.ts");
  for (const verb of ['"PUT"', '"PATCH"', '"DELETE"', "'PUT'", "'PATCH'", "'DELETE'"]) {
    if (text.includes(verb)) throw new Error(`adapter must not contain ${verb}`);
  }
  assertIncludes(text, "ADD-ONLY", "safety contract documented");
  assertIncludes(text, "proxied: false", "grey-cloud default");
});

await runStep("promote hook: going official publishes the subdomain, best-effort", () => {
  const text = read("src/lib/engine/vercel-deploy.ts");
  assertIncludes(text, "publishEcosystemSubdomain", "promote calls the adapter");
  assertIncludes(text, "cloudflareDnsConfigured", "silent skip when unconfigured");
  assertIncludes(text, "subdomainUrl", "result carries the subdomain");
});

await runStep("CLOUDFLARE_API_TOKEN is a universal engine-runtime vault key", () => {
  const text = read("src/lib/engine/env-vault.ts");
  assertIncludes(text, '"CLOUDFLARE_API_TOKEN"', "known key");
});

globalThis.fetch = realFetch;
if (savedEnv.token) process.env.CLOUDFLARE_API_TOKEN = savedEnv.token; else delete process.env.CLOUDFLARE_API_TOKEN;
if (savedEnv.zone) process.env.CLOUDFLARE_ZONE_ID = savedEnv.zone; else delete process.env.CLOUDFLARE_ZONE_ID;
console.log("cloudflare-dns smoke ok");

function jsonResponse(body) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
function read(p) {
  return fs.readFileSync(path.join(repoRoot, p), "utf8");
}
function assertIncludes(value, phrase, label) {
  if (!String(value).includes(phrase)) throw new Error(`${label}: expected to contain "${phrase}"`);
}
function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
async function runStep(label, fn) {
  try {
    await fn();
    console.log(`ok - ${label}`);
  } catch (error) {
    console.error(`FAIL - ${label}: ${error.message}`);
    process.exit(1);
  }
}
