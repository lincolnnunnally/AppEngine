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
const releaseVersion = input.version || process.env.APP_RELEASE_VERSION || "v1";
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
    roles: identityAuth.roles.map((role) => role.role),
    version: releaseVersion
  });
const deploymentEnvironment =
  input.deploymentEnvironment ||
  buildDeploymentEnvironment({
    appName,
    slug,
    version: releaseVersion,
    frontendProvider: process.env.APP_FRONTEND_PROVIDER || "Vercel",
    backendRequired: process.env.APP_BACKEND_REQUIRED === "true",
    backendProvider: process.env.APP_BACKEND_PROVIDER || (process.env.APP_BACKEND_REQUIRED === "true" ? "Render" : "Vercel Functions"),
    databaseProvider: process.env.APP_DATABASE_PROVIDER || "Neon",
    previewUrl: process.env.APP_PREVIEW_URL || "planned",
    productionUrl: process.env.APP_PRODUCTION_URL || "approval-gated",
    customDomain: process.env.APP_CUSTOM_DOMAIN || "planned",
    healthPath: process.env.APP_HEALTH_PATH || `/api/engine/apps/${slug}/health`,
    logsUrl: process.env.APP_LOGS_URL || "planned"
  });
const releaseGate =
  input.releaseGate ||
  buildReleaseGate({
    appName,
    slug,
    version: deploymentEnvironment.app.version,
    deploymentEnvironment
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
    superAdminRegistry,
    deploymentEnvironment,
    releaseGate
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
      "Register management, monitoring, health, logs, users, billing/status if needed, and admin actions with Super Admin.",
      "Define deployment environment and release gates before preview or production launch.",
      "Launch MVP as v1 and route later improvements to vNext packets or follow-up issues."
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
    phase("deployment_environment", "Deployment Environment", "builder", "ai:build", "Define frontend, backend if needed, database, env vars, preview/production URLs, custom domain, logs, health, and rollback.", [
      "Deployment environment plan includes frontend, backend if needed, database, environment variable names, URLs, logs, health, and rollback notes.",
      "No secret values are written into the plan."
    ]),
    phase("deployment", "Deployment", "workflow_tester", "ai:review", "Prepare preview deployment gates and production approval notes.", [
      "Preview deployment target is documented.",
      "Production deploy remains approval-gated."
    ]),
    phase("release_gate", "Release Gate", "workflow_tester", "ai:review", "Confirm v1 launch rules, preview deploy, production approval, monitoring, and vNext follow-up path.", [
      "Preview deploy contract and production approval gate are explicit.",
      "Post-launch monitoring and vNext follow-up rules are defined."
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
      "## Deployment Environment",
      `- Frontend: ${app.deploymentEnvironment.frontend.provider}`,
      `- API/backend required: ${app.deploymentEnvironment.apiBackend.required}`,
      `- API/backend provider: ${app.deploymentEnvironment.apiBackend.provider}`,
      `- Database: ${app.deploymentEnvironment.database.provider}`,
      `- Preview URL: ${app.deploymentEnvironment.frontend.previewUrl}`,
      `- Production URL: ${app.deploymentEnvironment.frontend.productionUrl}`,
      `- Custom domain/subdomain: ${app.deploymentEnvironment.frontend.customDomain}`,
      `- Health: ${app.deploymentEnvironment.frontend.healthPath}`,
      `- Logs: ${app.deploymentEnvironment.frontend.logsUrl}`,
      `- Env vars: ${app.deploymentEnvironment.environmentVariables.map((item) => item.name).join(", ")}`,
      "",
      "## Release Gate",
      `- Launch version: ${app.releaseGate.versioning.launchVersion}`,
      `- Future work: ${app.releaseGate.versioning.futureWork}`,
      "- Preview before production: true",
      "- Production approval required: true",
      "- Post-launch monitoring required: true",
      "",
      "## Guardrails",
      "- Do not turn this phase into a full-app build.",
      "- Do not import unrelated app goals, audiences, data, or features.",
      "- Do not invent auth outside the Identity/Auth Standard.",
      "- Do not skip Super Admin registry planning.",
      "- Do not include secret values in deployment environment output.",
      "- Keep production deployment approval-gated.",
      "- Launch MVP as v1 and route later improvements to vNext packets or follow-up issues.",
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
    "deployment_environment",
    "deployment",
    "release_gate",
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
    ["app.superAdminRegistry.status", packet.app.superAdminRegistry?.status],
    ["app.deploymentEnvironment.frontend.provider", packet.app.deploymentEnvironment?.frontend?.provider],
    ["app.deploymentEnvironment.frontend.previewUrl", packet.app.deploymentEnvironment?.frontend?.previewUrl],
    ["app.releaseGate.versioning.launchVersion", packet.app.releaseGate?.versioning?.launchVersion]
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
    ["app.superAdminRegistry.superAdminActions", packet.app.superAdminRegistry?.superAdminActions],
    ["app.deploymentEnvironment.environmentVariables", packet.app.deploymentEnvironment?.environmentVariables],
    ["app.releaseGate.gates", packet.app.releaseGate?.gates]
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

  if (!packet.app.deploymentEnvironment.guardrails.previewBeforeProduction || !packet.app.deploymentEnvironment.guardrails.productionRequiresReleaseGate) {
    throw new Error("App Build Packet must require a Deployment Environment plan with preview-before-production guardrails.");
  }

  if (!packet.app.releaseGate.guardrails.previewBeforeProduction || !packet.app.releaseGate.guardrails.ownerApprovalBeforeProduction) {
    throw new Error("App Build Packet must require a Release Gate with owner approval before production.");
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
  roles,
  version
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
    release: {
      version,
      gateStatus: "preview_pending",
      productionApproval: "required"
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

function buildDeploymentEnvironment({
  appName,
  slug,
  version,
  frontendProvider,
  backendRequired,
  backendProvider,
  databaseProvider,
  previewUrl,
  productionUrl,
  customDomain,
  healthPath,
  logsUrl
}) {
  return {
    kind: "deployment_environment_plan",
    schemaVersion: 1,
    app: {
      name: appName,
      slug,
      version
    },
    frontend: {
      provider: frontendProvider,
      previewUrl,
      productionUrl,
      customDomain,
      logsUrl,
      healthPath
    },
    apiBackend: {
      required: backendRequired,
      provider: backendProvider,
      previewUrl: backendRequired ? "planned" : "not_applicable",
      healthPath,
      logsUrl: backendRequired ? "planned" : "not_applicable"
    },
    database: {
      provider: databaseProvider,
      strategy: "generated-app branch or app-scoped database",
      migrationPath: "planned",
      seedPath: "planned",
      rollbackNotes: "Record migration rollback or restore point before production."
    },
    environmentVariables: defaultEnvironmentVariables({ backendRequired }),
    rollback: {
      preview: "Close or update the preview PR and rerun checks.",
      production: "Revert to the last approved release and apply documented data rollback if needed."
    },
    guardrails: {
      previewBeforeProduction: true,
      productionRequiresReleaseGate: true,
      noSecretsInOutput: true,
      rollbackNotesRequired: true
    }
  };
}

function defaultEnvironmentVariables({ backendRequired }) {
  const variables = [
    variable("DATABASE_URL", "database", "Vercel/Render server env", true, true, "Database connection string."),
    variable("AUTH_SECRET", "server", "Vercel/Render server env", true, true, "Auth session secret."),
    variable("AUTH_URL", "server", "Vercel/Render server env", true, false, "Canonical app URL for auth callbacks."),
    variable("APP_ENGINE_OWNER_EMAIL", "server", "Vercel/Render server env", true, false, "Owner/admin bootstrap email."),
    variable("NEXT_PUBLIC_APP_URL", "frontend_public", "Vercel preview/production env", false, false, "Browser-visible app URL.")
  ];

  if (backendRequired) {
    variables.push(
      variable("RENDER_SERVICE_URL", "server", "Vercel server env", true, false, "API backend base URL."),
      variable("RENDER_API_KEY", "provider", "GitHub Actions or secure deployment env", false, true, "Render automation token when automation is approved.")
    );
  }

  return variables;
}

function variable(name, scope, target, required, secret, purpose) {
  return {
    name,
    scope,
    target,
    required,
    secret,
    purpose
  };
}

function buildReleaseGate({ appName, slug, version, deploymentEnvironment }) {
  return {
    kind: "release_gate_plan",
    schemaVersion: 1,
    app: {
      name: appName,
      slug,
      version,
      targetStatus: "preview"
    },
    versioning: {
      launchVersion: version,
      futureWork: "vNext packets or follow-up issues after v1 launch"
    },
    gates: [
      gate("app_build_packet", "required", "app_build_packet"),
      gate("identity_auth", "required", "identity_auth_plan"),
      gate("super_admin_registry", "required", "super_admin_registry_entry"),
      gate("deployment_environment", "required", "deployment_environment_plan"),
      gate("preview_deploy", "required", deploymentEnvironment.frontend.previewUrl),
      gate("preview_health_logs", "required", "health checks and logs"),
      gate("production_approval", "blocked_until_owner_approval", "owner approval comment or release issue"),
      gate("v1_launch", "blocked_until_release_gate_passes", version),
      gate("post_launch_monitoring", "required", "ai:monitor follow-up")
    ],
    automationContracts: {
      previewDeploy: {
        recommendedLabel: "ai:review",
        deploysProduction: false,
        updatesSuperAdminStatus: "preview"
      },
      productionApproval: {
        recommendedLabel: "ai:review",
        requiresHumanApproval: true,
        deploysProduction: false
      },
      postLaunchMonitoring: {
        recommendedLabel: "ai:monitor",
        checks: ["health", "logs", "user workflow", "admin workflow"]
      },
      superAdminStatusUpdate: {
        statuses: ["planned", "building", "preview", "production", "paused", "retired"]
      }
    },
    guardrails: {
      previewBeforeProduction: true,
      ownerApprovalBeforeProduction: true,
      postLaunchMonitoringRequired: true,
      vNextAfterV1: true,
      noSecretsInOutput: true
    }
  };
}

function gate(id, status, evidence) {
  return { id, status, evidence };
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
