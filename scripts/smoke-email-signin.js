import fs from "node:fs";
import path from "node:path";

// Smoke for the existing soft-launch email door. File-content checks so leftover
// walks cannot regress to Auth.js Configuration / pinned .unitedundergod.org
// cookies on *.vercel.app. Run: npm run smoke:email-signin
const repoRoot = process.cwd();

runStep("email helpers exist and stay aligned with Resend + the adapter", () => {
  assertFileIncludes("src/lib/auth/email.ts", [
    "example.com",
    "emails.unitedundergod.org",
    "export function normalizeSignInEmail",
    "export function isReservedTestEmail",
    "export function resolveAuthEmailFrom",
    "export function hasEmailSignInConfig",
    "getConfiguredDatabaseUrl"
  ]);
});

runStep("factory sign-in rejects reserved leftover-walk addresses before Resend", () => {
  assertFileIncludes("src/app/signin/page.tsx", [
    "InvalidEmail",
    "isReservedTestEmail",
    "normalizeSignInEmail",
    "Use a real email address",
    "you@your-email.com"
  ]);
  assertFileDoesNotInclude("src/app/signin/page.tsx", "you@example.com");
});

runStep("email door and Resend provider require the database adapter", () => {
  assertFileIncludes("src/lib/auth/access.ts", ["hasEmailSignInConfig"]);
  assertFileIncludes("src/auth.ts", [
    "resolveAuthEmailFrom",
    "normalizeIdentifier",
    "sessionCookieDomainForHost"
  ]);
  assertFileDoesNotInclude("src/auth.ts", 'domain: ".unitedundergod.org"');
});

runStep("leftover-preview hosts are first-class auth origins", () => {
  assertFileIncludes("src/lib/auth/hosts.ts", [
    "isAppEngineVercelHost",
    "sessionCookieDomainForHost",
    "VERCEL_URL",
    ".vercel.app",
    "app-engine"
  ]);
});

runStep("reserved leftover placeholders are rejected; verified From is rewritten", () => {
  assertEqual(normalizeSignInEmail("  You@Your-Email.com "), "you@your-email.com", "plain");
  assertEqual(normalizeSignInEmail("We Succeed <signin@we-succeed.org>"), "signin@we-succeed.org", "angled");
  assertEqual(isReservedTestEmail("you@example.com"), true, "example.com");
  assertEqual(isReservedTestEmail("lincoln@unitedundergod.org"), false, "real address");
  assertEqual(
    resolveAuthEmailFrom("We Succeed <signin@we-succeed.org>"),
    "We Succeed <signin@emails.unitedundergod.org>",
    "rewrite From"
  );
  assertEqual(sessionCookieDomainForHost("appengine.unitedundergod.org"), ".unitedundergod.org", "factory cookie");
  assertEqual(sessionCookieDomainForHost("app-engine-leftover.vercel.app"), undefined, "preview cookie");
  assertEqual(isAppEngineVercelHost("app-engine-git-cursor-soft-launch-email-signin-8752-life-produces-life.vercel.app"), true, "preview host");
  assertEqual(isAppEngineVercelHost("other-app.vercel.app"), false, "foreign preview");
});

console.log("email-signin smoke ok");

function normalizeSignInEmail(value) {
  const raw = String(value ?? "").trim();
  const angled = raw.match(/<([^>]+)>/);
  const candidate = (angled ? angled[1] : raw).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate)) return undefined;
  const [local, domain] = candidate.split("@");
  if (!local || !domain) return undefined;
  return `${local.replace(/\s/g, "").replace(/,/g, ".")}@${domain.split(",")[0]}`;
}

function isReservedTestEmail(address) {
  return new Set(["example.com", "example.net", "example.org", "example.edu", "localhost", "invalid", "test"]).has(
    address.split("@")[1] ?? ""
  );
}

function resolveAuthEmailFrom(raw) {
  const parsed = normalizeSignInEmail(raw);
  if (!parsed) return undefined;
  const domain = parsed.split("@")[1];
  if (domain === "emails.unitedundergod.org") return raw;
  const display = raw.match(/^([^<]+)</)?.[1]?.trim() || "AppEngine";
  return `${display} <${parsed.split("@")[0]}@emails.unitedundergod.org>`;
}

function sessionCookieDomainForHost(host) {
  const normalized = host.toLowerCase();
  if (normalized === "unitedundergod.org" || normalized.endsWith(".unitedundergod.org")) {
    return ".unitedundergod.org";
  }
  return undefined;
}

function isAppEngineVercelHost(host) {
  return host.endsWith(".vercel.app") && host.startsWith("app-engine");
}

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

function assertFileIncludes(rel, needles) {
  const text = read(rel);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${rel} is missing ${JSON.stringify(needle)}`);
    }
  }
}

function assertFileDoesNotInclude(rel, needle) {
  if (read(rel).includes(needle)) {
    throw new Error(`${rel} should not contain ${JSON.stringify(needle)}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok  ${name}`);
  } catch (error) {
    console.error(`fail  ${name}`);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
