import fs from "node:fs";
import path from "node:path";
import {
  canAccessConsumerSurfaceForRole,
  getPublicAccessMode,
  isCustomerAllowlisted,
  parseCustomerAllowlist
} from "../src/lib/auth/roles.ts";

// Smoke for the staged go-public consumer-surface gate (Step 6). Proves the
// access decision table AND that the gates are wired the way the scope requires:
// default closed, operators always in, GET list-all stays owner-only, operator
// pages re-gate themselves. Run: node scripts/smoke-consumer-access.js
const repoRoot = process.cwd();

runStep("default + unknown modes fail closed to owner", () => {
  assertEqual(getPublicAccessMode({}), "owner", "empty env");
  assertEqual(getPublicAccessMode({ APP_ENGINE_PUBLIC_ACCESS: "" }), "owner", "blank");
  assertEqual(getPublicAccessMode({ APP_ENGINE_PUBLIC_ACCESS: "nonsense" }), "owner", "unknown");
  assertEqual(getPublicAccessMode({ APP_ENGINE_PUBLIC_ACCESS: "PUBLIC" }), "public", "case-insensitive");
});

runStep("allowlist parsing is delimiter- and case-tolerant", () => {
  assertEqual(parseCustomerAllowlist("a@x.com, b@x.com; c@x.com").join("|"), "a@x.com|b@x.com|c@x.com", "split");
  assertEqual(isCustomerAllowlisted("B@X.com", { APP_ENGINE_CUSTOMER_ALLOWLIST: "a@x.com,b@x.com" }), true, "hit");
  assertEqual(isCustomerAllowlisted("z@x.com", { APP_ENGINE_CUSTOMER_ALLOWLIST: "a@x.com,b@x.com" }), false, "miss");
  assertEqual(isCustomerAllowlisted("", { APP_ENGINE_CUSTOMER_ALLOWLIST: "a@x.com" }), false, "empty email");
});

runStep("operators always reach the consumer surface, in every mode", () => {
  for (const mode of ["owner", "allowlist", "public"]) {
    const env = { APP_ENGINE_PUBLIC_ACCESS: mode };
    assertEqual(canAccessConsumerSurfaceForRole("owner", null, env), true, `owner/${mode}`);
    assertEqual(canAccessConsumerSurfaceForRole("admin", null, env), true, `admin/${mode}`);
  }
});

runStep("default (owner) mode is closed to non-owners — merging changes nothing live", () => {
  const env = { APP_ENGINE_PUBLIC_ACCESS: "owner" };
  assertEqual(canAccessConsumerSurfaceForRole("customer", "a@x.com", env), false, "customer");
  assertEqual(canAccessConsumerSurfaceForRole("vendor", "a@x.com", env), false, "vendor");
  assertEqual(canAccessConsumerSurfaceForRole("customer", "a@x.com", {}), false, "no env at all");
});

runStep("allowlist rung admits only approved customers", () => {
  const env = { APP_ENGINE_PUBLIC_ACCESS: "allowlist", APP_ENGINE_CUSTOMER_ALLOWLIST: "ok@x.com" };
  assertEqual(canAccessConsumerSurfaceForRole("customer", "ok@x.com", env), true, "approved");
  assertEqual(canAccessConsumerSurfaceForRole("customer", "no@x.com", env), false, "not approved");
});

runStep("public rung admits any signed-in customer/vendor, never anonymous", () => {
  const env = { APP_ENGINE_PUBLIC_ACCESS: "public" };
  assertEqual(canAccessConsumerSurfaceForRole("customer", "a@x.com", env), true, "customer");
  assertEqual(canAccessConsumerSurfaceForRole("vendor", null, env), true, "vendor");
  assertEqual(canAccessConsumerSurfaceForRole(undefined, "a@x.com", env), false, "no role");
  assertEqual(canAccessConsumerSurfaceForRole(null, "a@x.com", env), false, "null role");
});

runStep("gates are wired to the consumer-surface helper", () => {
  assertFileIncludes("src/app/(cockpit)/layout.tsx", ["canAccessEngineConsumerSurface", "isOperator"]);
  assertFileIncludes("src/app/(cockpit)/problem-intake-lite/page.tsx", ["canAccessEngineConsumerSurface"]);
});

runStep("intake POST opens to customers while GET list-all stays owner-only", () => {
  for (const route of ["src/app/api/problem-intake-lite/route.ts", "src/app/api/opportunity-intake/route.ts"]) {
    const text = read(route);
    assertIncludes(text, "canAccessEngineConsumerSurface", `${route} POST gate`);
    const getBlock = text.slice(text.indexOf("export async function GET"), text.indexOf("export async function POST"));
    assertIncludes(getBlock, "canAccessEngineOwner", `${route} GET stays owner-only`);
  }
});

runStep("operator pages re-gate themselves (defense in depth)", () => {
  assertFileIncludes("src/app/(cockpit)/builder/page.tsx", ["canAccessEngineAdmin", "redirect"]);
  assertFileIncludes("src/app/(cockpit)/life-core/page.tsx", ["canAccessEngineAdmin", "redirect"]);
});

runStep("consumer rail shows no operator jargon", () => {
  const text = read("src/components/engine/app-shell.tsx");
  assertIncludes(text, "CONSUMER_GROUPS", "consumer rail exists");
  const consumerBlock = text.slice(text.indexOf("CONSUMER_GROUPS"), text.indexOf("OPERATOR_BRAND"));
  for (const jargon of ["Orchestrator", "Builder", "Admin", "Module catalog", "Owner control", "Canonical status"]) {
    if (consumerBlock.includes(jargon)) {
      throw new Error(`consumer rail leaks operator item "${jargon}"`);
    }
  }
});

runStep("soft-launch copy is mode-aware and dormant by default", () => {
  const text = read("src/app/soft-launch/page.tsx");
  assertIncludes(text, "getPublicAccessMode", "reads the access mode");
  for (const mode of ["owner:", "allowlist:", "public:"]) {
    assertIncludes(text, mode, `COPY has ${mode} variant`);
  }
  // owner (default) keeps the current private soft-launch copy — flip changes nothing live
  assertIncludes(text, "Owner-only soft launch", "owner copy preserved");
  // public-facing variants use the consumer brand, never operator/infra jargon
  assertIncludes(text, "We Succeed", "public variants use consumer brand");
  for (const jargon of ["Neon", "Supabase", "Vercel", "provider", "App Engine"]) {
    if (text.includes(jargon)) {
      throw new Error(`soft-launch leaks infrastructure/operator jargon "${jargon}"`);
    }
  }
});

console.log("consumer-access smoke ok");

function read(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

function assertFileIncludes(filePath, expected) {
  const text = read(filePath);
  for (const phrase of expected) {
    assertIncludes(text, phrase, filePath);
  }
}

function assertIncludes(value, phrase, label) {
  if (!String(value).includes(phrase)) {
    throw new Error(`${label}: expected to contain "${phrase}"`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function runStep(label, fn) {
  try {
    fn();
    console.log(`ok - ${label}`);
  } catch (error) {
    console.error(`not ok - ${label}`);
    throw error;
  }
}
