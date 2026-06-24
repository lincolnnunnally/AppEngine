import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("readiness artifact covers auth routes and API gates", () => {
  assertFileIncludes("src/lib/engine/production-auth-readiness.ts", [
    "production_auth_readiness",
    '"/"',
    "/opportunity-intake",
    "/problem-intake-lite",
    "/owner-control-center",
    "ownerOnlyApis",
    "/api/opportunity-intake",
    "/api/problem-intake-lite",
    "/api/engine/health",
    "/api/engine/setup-profile",
    "/api/engine/audit-trail",
    "owner/admin access checks"
  ]);
});

runStep("readiness report fails honestly for missing production assumptions", () => {
  assertFileIncludes("src/lib/engine/production-auth-readiness.ts", [
    "blocked_in_production",
    "missingEnvAssumptions",
    "AUTH_SECRET",
    "APP_ENGINE_OWNER_EMAIL",
    "APP_ENGINE_DEV_ADMIN_BYPASS",
    "APP_ENGINE_SETUP_ADMIN_BYPASS"
  ]);
});

runStep("source of truth documents checks and blockers", () => {
  assertFileIncludes("source-of-truth/production-auth-readiness.md", [
    "Production Auth Readiness Check",
    "`AUTH_SECRET` production guard",
    "two-door soft-launch entry",
    "Opportunity/problem intake routes and APIs",
    "owner-only intake APIs",
    "admin-only engine APIs",
    "development/setup bypass risk",
    "Production auth is blocked"
  ]);
});

runStep("existing auth hardening remains in place", () => {
  assertFileIncludes("src/lib/auth/config.ts", ["AUTH_SECRET is required in production", "app-engine-local-development-secret"]);
  assertFileIncludes("src/lib/auth/access.ts", ["canAccessEngineOwner", 'process.env.NODE_ENV === "development"', "APP_ENGINE_SETUP_ADMIN_BYPASS"]);
  assertFileIncludes("src/app/(cockpit)/layout.tsx", ["canAccessEngineOwner", "/soft-launch"]);
  assertFileIncludes("src/app/problem-intake-lite/page.tsx", ["canAccessEngineOwner", "/soft-launch"]);
  assertFileIncludes("src/app/api/opportunity-intake/route.ts", ["canAccessEngineOwner", "Unauthorized"]);
  assertFileIncludes("src/app/api/problem-intake-lite/route.ts", ["canAccessEngineOwner", "Unauthorized"]);
  assertFileIncludes("src/app/api/engine/health/route.ts", ["canAccessEngineAdmin", "Unauthorized"]);
  assertFileIncludes("src/app/api/engine/setup-profile/route.ts", ["canAccessEngineAdmin", "Unauthorized"]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:production-auth-readiness"]);
});

console.log("production-auth-readiness smoke ok");

function assertFileIncludes(filePath, expected) {
  const source = fs.readFileSync(path.join(root, filePath), "utf8");
  for (const phrase of expected) {
    if (!source.includes(phrase)) {
      throw new Error(`${filePath} missing ${phrase}`);
    }
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
