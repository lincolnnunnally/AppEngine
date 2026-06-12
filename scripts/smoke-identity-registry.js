import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-identity-registry-"));
const combinedOutput = path.join(smokeRoot, "identity-registry-output.json");
const identityOutput = path.join(smokeRoot, "identity-auth-plan.json");
const registryOutput = path.join(smokeRoot, "super-admin-registry.json");
const followUpsOutput = path.join(smokeRoot, "identity-registry-follow-ups.json");
const codexOutput = path.join(smokeRoot, "codex-output.md");
const issuesOutput = path.join(smokeRoot, "dry-run-issues.json");

runStep("identity and registry creation", () => {
  runNode("scripts/create-identity-registry-standard.js", {
    IDENTITY_REGISTRY_OUTPUT: combinedOutput,
    IDENTITY_AUTH_OUTPUT: identityOutput,
    SUPER_ADMIN_REGISTRY_OUTPUT: registryOutput,
    IDENTITY_REGISTRY_FOLLOWUPS_OUTPUT: followUpsOutput,
    APP_NAME: "Kind Help Desk",
    APP_SLUG: "kind-help-desk",
    APP_REPOSITORY: "lincolnnunnally/AppEngine",
    APP_AUTH_PROVIDER: "Auth.js",
    APP_AUTH_ROLES: "owner|admin|customer|coordinator",
    APP_AUTH_PROTECTED_ROUTES: "/app|/account|/admin|/api/customer/*|/api/admin/*|/api/billing/*",
    APP_REGISTRY_STATUS: "planned",
    APP_DEPLOYMENT_PROVIDER: "Vercel",
    APP_HEALTH_URL: "/api/engine/apps/kind-help-desk/health",
    APP_ADMIN_URL: "/admin/apps/kind-help-desk",
    APP_LOGS_URL: "planned"
  });

  const identity = readJson(identityOutput);
  const registry = readJson(registryOutput);
  const combined = readJson(combinedOutput);

  assertEqual(identity.kind, "identity_auth_plan", "identity artifact kind");
  assertEqual(identity.schemaVersion, 1, "identity schema version");
  assertEqual(identity.auth.provider, "Auth.js", "identity provider");
  assertArrayIncludes(identity.identityObjects, "membership", "identity membership object");
  assertArrayIncludes(identity.roles.map((role) => role.role), "owner", "identity owner role");
  assertArrayIncludes(identity.roles.map((role) => role.role), "admin", "identity admin role");
  assertArrayIncludes(identity.roles.map((role) => role.role), "customer", "identity customer role");
  assertArrayIncludes(identity.roles.map((role) => role.role), "coordinator", "identity custom role");
  assertArrayIncludes(identity.protectedRoutes.map((route) => route.path), "/admin", "identity admin route");
  assertArrayIncludes(identity.protectedRoutes.map((route) => route.path), "/api/billing/*", "identity billing route");
  assertEqual(identity.guardrails.serverSideChecksRequired, true, "identity requires server checks");
  assertEqual(identity.guardrails.productionRequiresConfiguredAuth, true, "identity requires production auth");

  assertEqual(registry.kind, "super_admin_registry_entry", "registry artifact kind");
  assertEqual(registry.schemaVersion, 1, "registry schema version");
  assertEqual(registry.app.slug, "kind-help-desk", "registry slug");
  assertEqual(registry.app.status, "planned", "registry status");
  assertEqual(registry.deployment.provider, "Vercel", "registry deployment provider");
  assertEqual(registry.deployment.productionApprovalRequired, true, "registry production approval gate");
  assertEqual(registry.operations.healthUrl, "/api/engine/apps/kind-help-desk/health", "registry health URL");
  assertEqual(registry.operations.adminUrl, "/admin/apps/kind-help-desk", "registry admin URL");
  assertArrayIncludes(registry.auth.roles, "coordinator", "registry custom role");
  assertArrayIncludes(registry.superAdminActions, "view logs", "registry logs action");
  assertEqual(registry.guardrails.requiresIdentityAuthPlan, true, "registry requires identity plan");

  assertEqual(combined.artifacts.length, 2, "combined output has two artifacts");
  assertArrayIncludes(combined.artifacts.map((artifact) => artifact.kind), "identity_auth_plan", "combined identity artifact");
  assertArrayIncludes(combined.artifacts.map((artifact) => artifact.kind), "super_admin_registry_entry", "combined registry artifact");
  assertEqual(combined.followUpTasks.length, 3, "combined follow-up count");
});

runStep("identity and registry follow-up dry run", () => {
  const combined = readJson(combinedOutput);

  fs.writeFileSync(
    codexOutput,
    [
      "Identity/Auth and Super Admin Registry follow-up output",
      "",
      "```json",
      JSON.stringify(combined, null, 2),
      "```",
      ""
    ].join("\n")
  );

  runNode("scripts/create-follow-up-issues.js", {
    CODEX_OUTPUT_FILE: codexOutput,
    FOLLOW_UP_DRY_RUN: "true",
    FOLLOW_UP_OUTPUT: issuesOutput,
    MAX_FOLLOW_UP_ISSUES: "10",
    SOURCE_ISSUE_NUMBER: "1001",
    SOURCE_ISSUE_URL: "https://github.com/lincolnnunnally/AppEngine/issues/1001"
  });

  const dryRun = readJson(issuesOutput);
  assertEqual(dryRun.issues.length, 3, "dry run creates identity/registry/release issues");
  assertIncludes(dryRun.issues[0].title, "Identity/Auth", "first dry-run issue is identity/auth");
  assertIncludes(dryRun.issues[0].body, "Protected routes", "identity issue includes protected routes");
  assertIncludes(dryRun.issues[1].title, "Super Admin Registry", "second dry-run issue is registry");
  assertIncludes(dryRun.issues[1].body, "Health", "registry issue includes health");
  assertIncludes(dryRun.issues[2].title, "Release and operations gate", "third dry-run issue is release gate");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.label), "ai:build", "dry-run issues include build label");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.label), "ai:review", "dry-run issues include review label");
  assertIncludes(dryRun.issues[0].body, "Source issue: #1001", "dry-run issue includes source issue");
});

console.log(`identity-registry smoke ok (${smokeRoot})`);

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function runNode(scriptPath, env) {
  return execFileSync(process.execPath, [path.join(repoRoot, scriptPath)], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(value, expected, message) {
  if (!String(value).includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(value)} to include ${JSON.stringify(expected)}`);
  }
}

function assertArrayIncludes(values, expected, message) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(values)} to include ${JSON.stringify(expected)}`);
  }
}
