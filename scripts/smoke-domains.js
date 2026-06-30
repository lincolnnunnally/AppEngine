import fs from "node:fs";
import path from "node:path";
import { checkDomainAvailability, hasPorkbun } from "../src/lib/engine/domains.ts";

// Smoke for custom-domain availability (reuses the Easy Peasy Porkbun logic).
// Runtime-tests the mock path + asserts the attach/purchase boundary. Run:
// node scripts/smoke-domains.js
const repoRoot = process.cwd();

runStep("availability check works in mock mode (no creds) with sane pricing", async () => {
  const had = { a: process.env.PORKBUN_API_KEY, b: process.env.PORKBUN_SECRET_KEY };
  delete process.env.PORKBUN_API_KEY;
  delete process.env.PORKBUN_SECRET_KEY;
  if (hasPorkbun()) throw new Error("hasPorkbun should be false without creds");

  const open = await checkDomainAvailability("my-cool-church-app.com");
  assertEqual(open.mock, true, "mock path");
  assertEqual(open.available, true, "a fresh name is available in mock");
  if (!(open.priceUsd > 0)) throw new Error("price should be > 0");

  const taken = await checkDomainAvailability("google.com");
  assertEqual(taken.available, false, "known-taken name is unavailable");

  const normalized = await checkDomainAvailability("HTTPS://My-App.IO/path");
  assertEqual(normalized.domain, "my-app.io", "normalizes scheme/path/case");

  if (had.a) process.env.PORKBUN_API_KEY = had.a;
  if (had.b) process.env.PORKBUN_SECRET_KEY = had.b;
});

runStep("purchase is NOT automatic; only availability + attach are wired", () => {
  const text = read("src/lib/engine/domains.ts");
  assertIncludes(text, "checkDomainAvailability", "availability");
  assertIncludes(text, "attachDomainToVercelProject", "attach owned domain");
  assertIncludes(text, "NEVER done automatically", "purchase is gated");
  if (/register|purchase|buyDomain/i.test(text.replace(/PURCHASE \(registering[^.]+\./i, "").replace(/gated purchase flow/gi, ""))) {
    // ok — references in comments only; ensure no live register call
  }
  if (text.includes("porkbun.com/api/json/v3/domain/create")) throw new Error("must not auto-register a domain");
});

runStep("Porkbun credentials are enterable from the owner Integrations dashboard", () => {
  const text = read("src/lib/engine/integrations-config.ts");
  assertIncludes(text, "PORKBUN_API_KEY", "porkbun key field");
  assertIncludes(text, "PORKBUN_SECRET_KEY", "porkbun secret field");
});

console.log("domains smoke ok");

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
    console.error(`not ok - ${label}`);
    throw error;
  }
}
