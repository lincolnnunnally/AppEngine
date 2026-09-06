import { pathToFileURL } from "node:url";
import path from "node:path";

// Smoke for the existing soft-launch email door. Proves leftover-preview hosts
// keep a session cookie, reserved test addresses never look like "unconfigured",
// and the Resend From address stays on the verified subdomain.
const repoRoot = process.cwd();
const email = await importModule("src/lib/auth/email.ts");
const hosts = await importModule("src/lib/auth/hosts.ts");

runStep("normalizeSignInEmail accepts a plain address and angled From", () => {
  assertEqual(email.normalizeSignInEmail("  You@Your-Email.com "), "you@your-email.com", "plain");
  assertEqual(
    email.normalizeSignInEmail("We Succeed <signin@we-succeed.org>"),
    "signin@we-succeed.org",
    "angled"
  );
  assertEqual(email.normalizeSignInEmail(""), undefined, "empty");
  assertEqual(email.normalizeSignInEmail("not-an-email"), undefined, "invalid");
});

runStep("reserved leftover-walk placeholders are rejected before Resend", () => {
  assertEqual(email.isReservedTestEmail("you@example.com"), true, "example.com");
  assertEqual(email.isReservedTestEmail("you@example.org"), true, "example.org");
  assertEqual(email.isReservedTestEmail("lincoln@unitedundergod.org"), false, "real address");
});

runStep("EMAIL_FROM rewrites off the unverified we-succeed.org sender", () => {
  assertEqual(
    email.resolveAuthEmailFrom({ EMAIL_FROM: "We Succeed <signin@we-succeed.org>" }),
    `We Succeed <signin@${email.VERIFIED_RESEND_FROM_DOMAIN}>`,
    "rewrite verified subdomain"
  );
  assertEqual(
    email.resolveAuthEmailFrom({ EMAIL_FROM: `AppEngine <hello@${email.VERIFIED_RESEND_FROM_DOMAIN}>` }),
    `AppEngine <hello@${email.VERIFIED_RESEND_FROM_DOMAIN}>`,
    "keep already-verified From"
  );
  assertEqual(email.resolveAuthEmailFrom({}), undefined, "missing From");
});

runStep("email sign-in is dormant without a database URL", () => {
  const keys = {
    AUTH_RESEND_KEY: "re_test",
    EMAIL_FROM: `AppEngine <signin@${email.VERIFIED_RESEND_FROM_DOMAIN}>`
  };
  assertEqual(email.hasEmailSignInConfig(keys), false, "no database");
  assertEqual(
    email.hasEmailSignInConfig({
      ...keys,
      DATABASE_URL: "postgresql://user:pass@host.neon.tech/app_engine?sslmode=require"
    }),
    true,
    "database + Resend + From"
  );
});

runStep("leftover-preview hosts are allowed auth origins", () => {
  assertEqual(
    hosts.isAllowedAuthOrigin("https://appengine.unitedundergod.org"),
    true,
    "factory"
  );
  assertEqual(
    hosts.isAllowedAuthOrigin("https://app-engine-git-cursor-soft-launch-email-signin-8752-life-produces-life.vercel.app"),
    true,
    "leftover-preview alias"
  );
  assertEqual(
    hosts.isAllowedAuthOrigin("https://some-other-app.vercel.app"),
    false,
    "foreign vercel.app"
  );
  assertEqual(
    hosts.isAllowedAuthOrigin("https://app-engine-abc123-life-produces-life.vercel.app", {
      VERCEL_URL: "app-engine-abc123-life-produces-life.vercel.app"
    }),
    true,
    "VERCEL_URL host"
  );
});

runStep("session cookie Domain is only pinned on unitedundergod.org", () => {
  assertEqual(
    hosts.sessionCookieDomainForHost("appengine.unitedundergod.org"),
    ".unitedundergod.org",
    "factory host"
  );
  assertEqual(
    hosts.sessionCookieDomainForHost("dashboard.unitedundergod.org"),
    ".unitedundergod.org",
    "desk host"
  );
  assertEqual(
    hosts.sessionCookieDomainForHost("app-engine-leftover-preview-life-produces-life.vercel.app"),
    undefined,
    "leftover-preview stays host-only"
  );
});

console.log("email-signin smoke ok");

async function importModule(relativePath) {
  return import(pathToFileURL(path.join(repoRoot, relativePath)).href);
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
