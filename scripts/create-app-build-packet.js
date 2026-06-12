import fs from "node:fs";
import path from "node:path";

const packetOutput = process.env.APP_BUILD_PACKET_OUTPUT || "";
const followUpsOutput = process.env.APP_BUILD_PACKET_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.APP_BUILD_PACKET_INPUT || "";

const input = readInput(inputPath);
const appName = input.name || process.env.APP_NAME || "Example App";
const slug = input.slug || process.env.APP_SLUG || slugify(appName);
const charterPath = input.charterPath || process.env.APP_CHARTER_PATH || `source-of-truth/charters/${slug}.md`;
const purpose = input.purpose || process.env.APP_PURPOSE || "Describe why this app exists.";
const audience = input.audience || listFromEnv("APP_AUDIENCE", ["Primary users"]);
const helped = input.helped || listFromEnv("APP_HELPED", ["People or organizations helped by this app"]);
const boundaries = input.boundaries || listFromEnv("APP_BOUNDARIES", ["Do not absorb unrelated app goals or audiences."]);
const successDefinition = input.successDefinition || process.env.APP_SUCCESS_DEFINITION || "Define the measurable outcome that proves the app is useful.";
const deploymentTarget = input.deploymentTarget || process.env.APP_DEPLOYMENT_TARGET || "Vercel preview first; production only after human approval.";
const dataPrivacyNotes = input.dataPrivacyNotes || process.env.APP_DATA_PRIVACY_NOTES || "Document ownership, retention, access, and privacy expectations before launch.";
const mvpStages = input.mvpStages || defaultMvpStages(appName);
const identityAuth =
  input.identityAuth ||
  buildIdentityAuthPlan({
    appName,
    slug,
    provider: process.env.APP_AUTH_PROVIDER || "Auth.js",
    sessionStrategy:
      process.env.APP_AUTH_SESSION_STRATEGY ||
      "Server-side session checks with app-scoped roles and memberships.",
    ownerSource: process.env.APP_AUTH_OWNER_SOURCE || "APP_ENGINE_OWNER_EMAIL",
    localMode:
      process.env.APP_AUTH_LOCAL_MODE ||
      "Setup user allowed only before production auth is configured.",
    roles: listFromEnv("APP_AUTH_ROLES", ["owner", "admin", "customer"]),
    protectedRoutes: listFromEnv("APP_AUTH_PROTECTED_ROUTES", ["/app", "/account", "/admin", "/api/customer/*", "/api/admin/*"])
  });
const superAdminRequirements =
  input.superAdminRequirements ||
  listFromEnv("APP_SUPER_ADMIN_REQUIREMENTS", [
    "management",
    "monitoring",
    "health",
    "logs",
    "users",
    "billing/status if needed",
    "admin actions",
    "deployment/environment status"
  ]);
const superAdminRegistry =
  input.superAdminRegistry ||
  buildSuperAdminRegistry({
    appName,
    slug,
    charterPath,
    repo: process.env.APP_REPOSITORY || "lincolnnunnally/AppEngine",
    owner: process.env.APP_REGISTRY_OWNER || "APP_ENGINE_OWNER_EMAIL",
    status: process.env.APP_REGISTRY_STATUS || "planned",
    environment: process.env.APP_REGISTRY_ENVIRONMENT || "preview",
    deploymentProvider: process.env.APP_DEPLOYMENT_PROVIDER || "Vercel",
    previewUrl: process.env.APP_PREVIEW_URL || "planned",
    productionUrl: process.env.APP_PRODUCTION_URL || "approval-gated",
    healthUrl: process.env.APP_HEALTH_URL || `/api/engine/apps/${slug}/health`,
    logsProvider: process.env.APP_LOGS_PROVIDER || "Vercel",
    logsUrl: process.env.APP_LOGS_URL || "planned",
    adminUrl: process.env.APP_ADMIN_URL || `/admin/apps/${slug}`,
    userManagement: process.env.APP_USER_MANAGEMENT_URL || "planned",
    billingStatus: process.env.APP_BILLING_STATUS || "not_applicable",
    authProvider: identityAuth.auth.provider,
    roles: identityAuth.roles.map((role) => role.role)
  });

const packet = {
  kind: "app_build_packet",
  schemaVersion: 1,
  app: {
    name: appName,
    slug,
    charterPath,
    purpose,
    audience,
    helped,
    boundaries,
    successDefinition,
    deploymentTarget,
    dataPrivacyNotes,
    mvpStages,
    identityAuth,
    superAdminIntegration: {
      required: true,
      dashboard: "AppEngine Super Admin",
      requirements: superAdminRequirements
    },
    superAdminRegistry
  },
  guardrails: {
    noGiantCodexTask: true,
    preventGoalBleed: true,
    requireContextGate: true,
    requirePhaseFollowUps: true,
    noProductionDeployWithoutApproval: true,
    notes: [
      "Keep this app inside its charter.",
      "Create phased follow-up issues instead of one giant Codex task.",
      "Define identity/auth before app build or launch work.",
      "Register management, monitoring, health, logs, users, billing/status if needed, and admin actions with Super Admin."
    ]
  },
  phases: buildPhases(slug),
  followUpTasks: []
};

packet.followUpTasks = packet.phases.map((phase) => toFollowUpTask(packet, phase));

validatePacket(packet);

if (packetOutput) {
  writeJson(packetOutput, packet);
}

if (followUpsOutput) {
  writeJson(followUpsOutput, { followUpTasks: packet.followUpTasks });
}

console.log(`app-build-packet ok: ${packet.app.name} (${packet.app.slug})`);
console.log(`phases: ${packet.phases.map((phase) => phase.id).join(", ")}`);

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

function defaultMvpStages(name) {
  return [
    {
      id: "chartered-intake",
      name: "Chartered Intake",
      goal: `Confirm ${name}'s audience, boundaries, success definition, and first useful workflow.`
    },
    {
      id: "working-mvp",
      name: "Working MVP",
      goal: "Build the smallest end-to-end workflow that helps the primary audience."
    },
    {
      id: "managed-preview",
      name: "Managed Preview",
      goal: "Connect preview deployment, Super Admin status, monitoring, and review gates."
    }
  ];
}

function buildPhases(slug) {
  return [
    phase("discovery", "Discovery", "discovery", "ai:plan", "Clarify the problem, audience, alternatives, and opportunity.", [
      "Problem and primary audience are named.",
      "Alternatives and underserved gaps are documented."
    ]),
    phase("charter", "Charter", "planner", "ai:plan", "Create the app charter, boundaries, success definition, and MVP stages.", [
      `Charter exists at source-of-truth/charters/${slug}.md or a specific planned path.`,
      "Boundaries state what this app must not become."
    ]),
    phase("architecture", "Architecture", "systems", "ai:plan", "Define stack, routes, permissions, integrations, and Super Admin registration plan.", [
      "Architecture identifies generated-app services and central AppEngine touchpoints.",
      "No production deploy path is enabled without approval."
    ]),
    phase("data_model", "Data Model", "builder", "ai:build", "Define database schema, ownership, privacy, seed data, and migrations.", [
      "Data ownership and privacy notes are explicit.",
      "Generated schema can be applied safely to a preview database."
    ]),
    phase("identity_auth", "Identity/Auth", "builder", "ai:build", "Define auth provider, roles, memberships, permissions, protected routes, and server-side guards.", [
      "Identity/Auth plan includes provider, session strategy, roles, memberships, permissions, and protected routes.",
      "Production auth gates and local setup behavior are explicit."
    ]),
    phase("ui_design", "UI Design", "designer", "ai:build", "Define user flows, screens, copy, accessibility, and design direction.", [
      "Primary workflow is visible and testable.",
      "Design supports the app audience and charter."
    ]),
    phase("mvp_build", "MVP Build", "builder", "ai:build", "Build the first useful scope without absorbing later phases.", [
      "MVP implements the chartered workflow only.",
      "Build remains reviewable in a focused pull request."
    ]),
    phase("testing", "Testing", "workflow_tester", "ai:review", "Verify workflows, acceptance criteria, permissions, and edge cases.", [
      "Full user journey is tested.",
      "Failures create ai:fix follow-up tasks."
    ]),
    phase("review", "Review", "code_reviewer", "ai:review", "Review code, security, maintainability, scope, and app-boundary risks.", [
      "Security and maintainability risks are recorded.",
      "App-goal bleeding is checked before merge."
    ]),
    phase("deployment", "Deployment", "workflow_tester", "ai:review", "Prepare preview deployment gates and production approval notes.", [
      "Preview deployment target is documented.",
      "Production deploy remains approval-gated."
    ]),
    phase("monitoring", "Monitoring", "monitor", "ai:monitor", "Define health checks, logs, incidents, alerts, and monitor follow-ups.", [
      "Health and logs are visible from Super Admin or linked from it.",
      "Incident follow-up path is documented."
    ]),
    phase("super_admin_registration", "Super Admin Registration", "builder", "ai:build", "Register management, monitoring, health, logs, users, billing/status if needed, and admin actions.", [
      "App appears or is planned in AppEngine Super Admin.",
      "Admin actions and status links are defined."
    ])
  ];
}

function phase(id, name, agent, label, goal, acceptanceCriteria) {
  return {
    id,
    name,
    agent,
    label,
    goal,
    deliverables: [
      `${name} notes`,
      `${name} acceptance criteria`,
      `${name} handoff summary`
    ],
    acceptanceCriteria
  };
}

function toFollowUpTask(packet, phase) {
  const app = packet.app;
  return {
    title: `[${app.slug}] Phase: ${phase.name}`,
    recommendedLabel: phase.label,
    body: [
      `Run the ${phase.name} phase from the App Build Packet for ${app.name}.`,
      "",
      "## App Build Packet",
      `- App: ${app.name}`,
      `- Slug: ${app.slug}`,
      `- Charter: ${app.charterPath}`,
      `- Purpose: ${app.purpose}`,
      `- Audience: ${app.audience.join(", ")}`,
      `- Success: ${app.successDefinition}`,
      `- Deployment target: ${app.deploymentTarget}`,
      "",
      "## Phase",
      `- Phase id: ${phase.id}`,
      `- Agent: ${phase.agent}`,
      `- Goal: ${phase.goal}`,
      `- Deliverables: ${phase.deliverables.join("; ")}`,
      `- Acceptance criteria: ${phase.acceptanceCriteria.join("; ")}`,
      "",
      "## Super Admin",
      `- Required: ${app.superAdminIntegration.required}`,
      `- Dashboard: ${app.superAdminIntegration.dashboard}`,
      `- Requirements: ${app.superAdminIntegration.requirements.join(", ")}`,
      `- Registry status: ${app.superAdminRegistry.status}`,
      `- Registry health: ${app.superAdminRegistry.operations.healthUrl}`,
      `- Registry logs: ${app.superAdminRegistry.operations.logsUrl}`,
      `- Registry admin: ${app.superAdminRegistry.operations.adminUrl}`,
      "",
      "## Identity/Auth",
      `- Provider: ${app.identityAuth.auth.provider}`,
      `- Session strategy: ${app.identityAuth.auth.sessionStrategy}`,
      `- Roles: ${app.identityAuth.roles.map((role) => role.role).join(", ")}`,
      `- Protected routes: ${app.identityAuth.protectedRoutes.map((route) => route.path).join(", ")}`,
      "",
      "## Guardrails",
      "- Do not turn this phase into a full-app build.",
      "- Do not import unrelated app goals, audiences, data, or features.",
      "- Do not invent auth outside the Identity/Auth Standard.",
      "- Do not skip Super Admin registry planning.",
      "- Keep production deployment approval-gated.",
      "- Create follow-up issues for later phases instead of expanding this task."
    ].join("\n")
  };
}

function validatePacket(packet) {
  const requiredPhaseIds = [
    "discovery",
    "charter",
    "architecture",
    "data_model",
    "identity_auth",
    "ui_design",
    "mvp_build",
    "testing",
    "review",
    "deployment",
    "monitoring",
    "super_admin_registration"
  ];

  const missingFields = [];
  for (const [label, value] of [
    ["app.name", packet.app.name],
    ["app.slug", packet.app.slug],
    ["app.charterPath", packet.app.charterPath],
    ["app.purpose", packet.app.purpose],
    ["app.successDefinition", packet.app.successDefinition],
    ["app.deploymentTarget", packet.app.deploymentTarget],
    ["app.identityAuth.auth.provider", packet.app.identityAuth?.auth?.provider],
    ["app.superAdminRegistry.status", packet.app.superAdminRegistry?.status]
  ]) {
    if (!value) missingFields.push(label);
  }

  for (const [label, value] of [
    ["app.audience", packet.app.audience],
    ["app.boundaries", packet.app.boundaries],
    ["app.mvpStages", packet.app.mvpStages],
    ["app.superAdminIntegration.requirements", packet.app.superAdminIntegration.requirements],
    ["app.identityAuth.roles", packet.app.identityAuth?.roles],
    ["app.identityAuth.protectedRoutes", packet.app.identityAuth?.protectedRoutes],
    ["app.superAdminRegistry.superAdminActions", packet.app.superAdminRegistry?.superAdminActions]
  ]) {
    if (!Array.isArray(value) || value.length === 0) missingFields.push(label);
  }

  if (missingFields.length) {
    throw new Error(`App Build Packet is missing required fields: ${missingFields.join(", ")}`);
  }

  for (const id of requiredPhaseIds) {
    if (!packet.phases.some((phase) => phase.id === id)) {
      throw new Error(`App Build Packet is missing required phase: ${id}`);
    }
  }

  if (!packet.guardrails.noGiantCodexTask || !packet.guardrails.preventGoalBleed) {
    throw new Error("App Build Packet guardrails must prevent giant tasks and app-goal bleeding.");
  }

  if (!packet.app.superAdminIntegration.required) {
    throw new Error("App Build Packet must require Super Admin integration.");
  }

  if (!packet.app.identityAuth.required || !packet.app.identityAuth.guardrails.serverSideChecksRequired) {
    throw new Error("App Build Packet must require an Identity/Auth plan with server-side checks.");
  }

  if (!packet.app.superAdminRegistry.required || !packet.app.superAdminRegistry.guardrails.requiresIdentityAuthPlan) {
    throw new Error("App Build Packet must require a Super Admin registry entry connected to Identity/Auth.");
  }
}

function buildIdentityAuthPlan({ appName, slug, provider, sessionStrategy, ownerSource, localMode, roles, protectedRoutes }) {
  const roleDetails = buildRoles(roles);

  return {
    kind: "identity_auth_plan",
    schemaVersion: 1,
    required: true,
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
  const requiredRoles = ["owner", "admin", "customer"];

  for (const requiredRole of requiredRoles) {
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
    required: true,
    status,
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
