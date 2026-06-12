import fs from "node:fs";
import path from "node:path";

const combinedOutput = process.env.IDENTITY_REGISTRY_OUTPUT || "";
const identityOutput = process.env.IDENTITY_AUTH_OUTPUT || "";
const registryOutput = process.env.SUPER_ADMIN_REGISTRY_OUTPUT || "";
const followUpsOutput = process.env.IDENTITY_REGISTRY_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.IDENTITY_REGISTRY_INPUT || "";

const input = readInput(inputPath);
const appName = input.name || process.env.APP_NAME || "Example App";
const slug = input.slug || process.env.APP_SLUG || slugify(appName);
const repo = input.repo || process.env.APP_REPOSITORY || process.env.GITHUB_REPOSITORY || "lincolnnunnally/AppEngine";
const charterPath = input.charterPath || process.env.APP_CHARTER_PATH || `source-of-truth/charters/${slug}.md`;
const owner = input.owner || process.env.APP_REGISTRY_OWNER || "APP_ENGINE_OWNER_EMAIL";
const provider = input.authProvider || process.env.APP_AUTH_PROVIDER || "Auth.js";
const roles = input.roles || listFromEnv("APP_AUTH_ROLES", ["owner", "admin", "customer"]);
const protectedRoutes =
  input.protectedRoutes || listFromEnv("APP_AUTH_PROTECTED_ROUTES", ["/app", "/account", "/admin", "/api/customer/*", "/api/admin/*"]);

const identityAuthPlan =
  input.identityAuthPlan ||
  buildIdentityAuthPlan({
    appName,
    slug,
    provider,
    sessionStrategy:
      input.sessionStrategy ||
      process.env.APP_AUTH_SESSION_STRATEGY ||
      "Server-side session checks with app-scoped roles and memberships.",
    ownerSource: input.ownerSource || process.env.APP_AUTH_OWNER_SOURCE || "APP_ENGINE_OWNER_EMAIL",
    localMode:
      input.localMode ||
      process.env.APP_AUTH_LOCAL_MODE ||
      "Setup user allowed only before production auth is configured.",
    roles,
    protectedRoutes
  });

const superAdminRegistryEntry =
  input.superAdminRegistryEntry ||
  buildSuperAdminRegistry({
    appName,
    slug,
    charterPath,
    repo,
    owner,
    status: input.status || process.env.APP_REGISTRY_STATUS || "planned",
    environment: input.environment || process.env.APP_REGISTRY_ENVIRONMENT || "preview",
    deploymentProvider: input.deploymentProvider || process.env.APP_DEPLOYMENT_PROVIDER || "Vercel",
    previewUrl: input.previewUrl || process.env.APP_PREVIEW_URL || "planned",
    productionUrl: input.productionUrl || process.env.APP_PRODUCTION_URL || "approval-gated",
    healthUrl: input.healthUrl || process.env.APP_HEALTH_URL || `/api/engine/apps/${slug}/health`,
    logsProvider: input.logsProvider || process.env.APP_LOGS_PROVIDER || "Vercel",
    logsUrl: input.logsUrl || process.env.APP_LOGS_URL || "planned",
    adminUrl: input.adminUrl || process.env.APP_ADMIN_URL || `/admin/apps/${slug}`,
    userManagement: input.userManagement || process.env.APP_USER_MANAGEMENT_URL || "planned",
    billingStatus: input.billingStatus || process.env.APP_BILLING_STATUS || "not_applicable",
    authProvider: identityAuthPlan.auth.provider,
    roles: identityAuthPlan.roles.map((role) => role.role)
  });

const followUpTasks = buildFollowUpTasks({ appName, slug, identityAuthPlan, superAdminRegistryEntry });
const output = {
  agent: "planner",
  status: "needs_follow_up",
  summary: `Created Identity/Auth and Super Admin Registry standards for ${appName}.`,
  artifacts: [
    {
      kind: "identity_auth_plan",
      title: `${appName} Identity/Auth Plan`,
      content: identityAuthPlan
    },
    {
      kind: "super_admin_registry_entry",
      title: `${appName} Super Admin Registry Entry`,
      content: superAdminRegistryEntry
    }
  ],
  findings: [],
  followUpTasks,
  handoffTo: ["builder", "workflow_tester", "code_reviewer"]
};

validateIdentityAuthPlan(identityAuthPlan);
validateSuperAdminRegistry(superAdminRegistryEntry);

if (combinedOutput) writeJson(combinedOutput, output);
if (identityOutput) writeJson(identityOutput, identityAuthPlan);
if (registryOutput) writeJson(registryOutput, superAdminRegistryEntry);
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks });

console.log(`identity-registry ok: ${appName} (${slug})`);
console.log(`roles: ${identityAuthPlan.roles.map((role) => role.role).join(", ")}`);
console.log(`registry: ${superAdminRegistryEntry.app.status} via ${superAdminRegistryEntry.deployment.provider}`);

function readInput(filePath) {
  if (!filePath) return {};
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return {};
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function listFromEnv(name, fallback) {
  const raw = process.env[name] || "";
  if (!raw.trim()) return fallback;
  return raw
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildIdentityAuthPlan({ appName, slug, provider, sessionStrategy, ownerSource, localMode, roles, protectedRoutes }) {
  const roleDetails = buildRoles(roles);

  return {
    kind: "identity_auth_plan",
    schemaVersion: 1,
    app: {
      name: appName,
      slug
    },
    auth: {
      provider,
      sessionStrategy,
      localMode,
      ownerSource
    },
    identityObjects: ["user", "profile", "organization/account", "membership", "role", "permission"],
    roles: roleDetails,
    protectedRoutes: protectedRoutes.map((route) => ({
      path: route,
      access: accessForRoute(route, roleDetails.map((role) => role.role))
    })),
    dataBoundaries: [
      "Users and memberships are app-scoped unless an approved integration says otherwise.",
      "Admin and owner actions must be enforced server-side, not only hidden in the UI."
    ],
    guardrails: {
      serverSideChecksRequired: true,
      noCrossAppUserBleed: true,
      noSecretsInOutput: true,
      productionRequiresConfiguredAuth: true
    }
  };
}

function buildRoles(roles) {
  const uniqueRoles = Array.from(new Set(roles.filter(Boolean)));
  for (const requiredRole of ["owner", "admin", "customer"]) {
    if (!uniqueRoles.includes(requiredRole)) uniqueRoles.push(requiredRole);
  }

  return uniqueRoles.map((role) => {
    if (role === "owner") {
      return {
        role,
        scope: "ecosystem",
        can: ["manage app registry", "approve production deployment", "manage high-risk admin actions"]
      };
    }

    if (role === "admin") {
      return {
        role,
        scope: "app",
        can: ["manage app users", "manage app workflows", "review logs and incidents"]
      };
    }

    if (role === "customer") {
      return {
        role,
        scope: "app",
        can: ["use app workflow", "manage own account"]
      };
    }

    return {
      role,
      scope: "app",
      can: ["access documented app-specific workflow"]
    };
  });
}

function accessForRoute(route, roles) {
  if (route.includes("/admin") || route.includes("/api/admin")) {
    return roles.filter((role) => role === "owner" || role === "admin");
  }

  return roles;
}

function buildSuperAdminRegistry({
  appName,
  slug,
  charterPath,
  repo,
  owner,
  status,
  environment,
  deploymentProvider,
  previewUrl,
  productionUrl,
  healthUrl,
  logsProvider,
  logsUrl,
  adminUrl,
  userManagement,
  billingStatus,
  authProvider,
  roles
}) {
  return {
    kind: "super_admin_registry_entry",
    schemaVersion: 1,
    app: {
      name: appName,
      slug,
      status,
      owner,
      repo,
      charterPath,
      packetPath: "source-of-truth/app-build-packet.md",
      environment
    },
    deployment: {
      provider: deploymentProvider,
      previewUrl,
      productionUrl,
      productionApprovalRequired: true
    },
    operations: {
      healthUrl,
      healthStatus: "unknown",
      logsProvider,
      logsUrl,
      adminUrl,
      userManagement,
      billingStatus
    },
    auth: {
      provider: authProvider,
      roles
    },
    superAdminActions: ["open app", "open admin", "view health", "view logs", "manage users", "create incident"],
    guardrails: {
      noSecretsInRegistry: true,
      requiresIdentityAuthPlan: true,
      requiresReleaseGateForProduction: true
    }
  };
}

function buildFollowUpTasks({ appName, slug, identityAuthPlan, superAdminRegistryEntry }) {
  return [
    {
      title: `[${slug}] Identity/Auth standard`,
      recommendedLabel: "ai:build",
      body: [
        `Build or update the Identity/Auth foundation for ${appName}.`,
        "",
        "## Identity/Auth",
        `- Provider: ${identityAuthPlan.auth.provider}`,
        `- Session strategy: ${identityAuthPlan.auth.sessionStrategy}`,
        `- Owner source: ${identityAuthPlan.auth.ownerSource}`,
        `- Roles: ${identityAuthPlan.roles.map((role) => role.role).join(", ")}`,
        `- Identity objects: ${identityAuthPlan.identityObjects.join(", ")}`,
        `- Protected routes: ${identityAuthPlan.protectedRoutes.map((route) => route.path).join(", ")}`,
        "",
        "## Guardrails",
        "- Enforce access server-side.",
        "- Do not share user, membership, role, or billing data across unrelated apps.",
        "- Do not include secrets in code, issues, prompts, or outputs."
      ].join("\n")
    },
    {
      title: `[${slug}] Super Admin Registry entry`,
      recommendedLabel: "ai:build",
      body: [
        `Create or update the Super Admin registry entry for ${appName}.`,
        "",
        "## Super Admin Registry",
        `- Status: ${superAdminRegistryEntry.app.status}`,
        `- Repo: ${superAdminRegistryEntry.app.repo}`,
        `- Environment: ${superAdminRegistryEntry.app.environment}`,
        `- Deployment provider: ${superAdminRegistryEntry.deployment.provider}`,
        `- Health: ${superAdminRegistryEntry.operations.healthUrl}`,
        `- Logs: ${superAdminRegistryEntry.operations.logsUrl}`,
        `- Admin: ${superAdminRegistryEntry.operations.adminUrl}`,
        `- Users: ${superAdminRegistryEntry.operations.userManagement}`,
        `- Billing/status: ${superAdminRegistryEntry.operations.billingStatus}`,
        "",
        "## Guardrails",
        "- Keep the registry entry secret-free.",
        "- Keep production status blocked until release-gate approval.",
        "- Keep registry links scoped to this app unless an integration is documented."
      ].join("\n")
    },
    {
      title: `[${slug}] Release and operations gate`,
      recommendedLabel: "ai:review",
      body: [
        `Review release readiness for ${appName} using the Identity/Auth plan and Super Admin registry entry.`,
        "",
        "## Review Checks",
        "- Auth provider, roles, memberships, permissions, and protected routes are defined.",
        "- Super Admin status, health, logs, admin, users, billing/status if needed, and actions are defined.",
        "- Production deploy remains approval-gated.",
        "- Missing launch pieces create follow-up issues instead of expanding this task."
      ].join("\n")
    }
  ];
}

function validateIdentityAuthPlan(plan) {
  const missing = [];

  for (const [label, value] of [
    ["kind", plan.kind],
    ["app.name", plan.app?.name],
    ["app.slug", plan.app?.slug],
    ["auth.provider", plan.auth?.provider],
    ["auth.sessionStrategy", plan.auth?.sessionStrategy],
    ["auth.ownerSource", plan.auth?.ownerSource]
  ]) {
    if (!value) missing.push(label);
  }

  for (const [label, value] of [
    ["identityObjects", plan.identityObjects],
    ["roles", plan.roles],
    ["protectedRoutes", plan.protectedRoutes],
    ["dataBoundaries", plan.dataBoundaries]
  ]) {
    if (!Array.isArray(value) || value.length === 0) missing.push(label);
  }

  for (const requiredRole of ["owner", "admin", "customer"]) {
    if (!plan.roles?.some((role) => role.role === requiredRole)) missing.push(`roles.${requiredRole}`);
  }

  if (!plan.guardrails?.serverSideChecksRequired || !plan.guardrails?.productionRequiresConfiguredAuth) {
    missing.push("guardrails");
  }

  if (missing.length) throw new Error(`Identity/Auth plan is missing required fields: ${missing.join(", ")}`);
}

function validateSuperAdminRegistry(entry) {
  const missing = [];

  for (const [label, value] of [
    ["kind", entry.kind],
    ["app.name", entry.app?.name],
    ["app.slug", entry.app?.slug],
    ["app.status", entry.app?.status],
    ["app.owner", entry.app?.owner],
    ["app.repo", entry.app?.repo],
    ["deployment.provider", entry.deployment?.provider],
    ["operations.healthUrl", entry.operations?.healthUrl],
    ["operations.logsUrl", entry.operations?.logsUrl],
    ["operations.adminUrl", entry.operations?.adminUrl],
    ["auth.provider", entry.auth?.provider]
  ]) {
    if (!value) missing.push(label);
  }

  for (const [label, value] of [
    ["auth.roles", entry.auth?.roles],
    ["superAdminActions", entry.superAdminActions]
  ]) {
    if (!Array.isArray(value) || value.length === 0) missing.push(label);
  }

  if (!entry.guardrails?.noSecretsInRegistry || !entry.guardrails?.requiresIdentityAuthPlan) {
    missing.push("guardrails");
  }

  if (missing.length) throw new Error(`Super Admin registry entry is missing required fields: ${missing.join(", ")}`);
}

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "app";
}
