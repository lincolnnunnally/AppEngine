import fs from "node:fs";
import path from "node:path";

const combinedOutput = process.env.RELEASE_GATE_OUTPUT || "";
const environmentOutput = process.env.DEPLOYMENT_ENVIRONMENT_OUTPUT || "";
const releaseOutput = process.env.RELEASE_PLAN_OUTPUT || "";
const followUpsOutput = process.env.RELEASE_GATE_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.RELEASE_GATE_INPUT || "";

const input = readInput(inputPath);
const appName = input.name || process.env.APP_NAME || "Example App";
const slug = input.slug || process.env.APP_SLUG || slugify(appName);
const version = input.version || process.env.APP_RELEASE_VERSION || "v1";
const frontendProvider = input.frontendProvider || process.env.APP_FRONTEND_PROVIDER || "Vercel";
const backendRequired = booleanFrom(input.backendRequired, process.env.APP_BACKEND_REQUIRED, false);
const backendProvider = input.backendProvider || process.env.APP_BACKEND_PROVIDER || (backendRequired ? "Render" : "Vercel Functions");
const databaseProvider = input.databaseProvider || process.env.APP_DATABASE_PROVIDER || "Neon";
const previewUrl = input.previewUrl || process.env.APP_PREVIEW_URL || "planned";
const productionUrl = input.productionUrl || process.env.APP_PRODUCTION_URL || "approval-gated";
const customDomain = input.customDomain || process.env.APP_CUSTOM_DOMAIN || "planned";
const healthPath = input.healthPath || process.env.APP_HEALTH_PATH || "/api/health";
const logsUrl = input.logsUrl || process.env.APP_LOGS_URL || "planned";

const deploymentEnvironment =
  input.deploymentEnvironment ||
  buildDeploymentEnvironment({
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
  });

const releaseGate =
  input.releaseGate ||
  buildReleaseGate({
    appName,
    slug,
    version,
    deploymentEnvironment
  });

const followUpTasks = buildFollowUpTasks({ appName, slug, deploymentEnvironment, releaseGate });
const output = {
  agent: "planner",
  status: "needs_follow_up",
  summary: `Created Deployment Environment and Release Gate plans for ${appName}.`,
  artifacts: [
    {
      kind: "deployment_environment_plan",
      title: `${appName} Deployment Environment Plan`,
      content: deploymentEnvironment
    },
    {
      kind: "release_gate_plan",
      title: `${appName} Release Gate Plan`,
      content: releaseGate
    }
  ],
  findings: [],
  followUpTasks,
  handoffTo: ["builder", "workflow_tester", "monitor"]
};

validateDeploymentEnvironment(deploymentEnvironment);
validateReleaseGate(releaseGate);

if (combinedOutput) writeJson(combinedOutput, output);
if (environmentOutput) writeJson(environmentOutput, deploymentEnvironment);
if (releaseOutput) writeJson(releaseOutput, releaseGate);
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks });

console.log(`release-gate ok: ${appName} (${slug})`);
console.log(`version: ${releaseGate.app.version}`);
console.log(`preview: ${deploymentEnvironment.frontend.previewUrl}`);

function readInput(filePath) {
  if (!filePath) return {};
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return {};
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function booleanFrom(inputValue, envValue, fallback) {
  if (typeof inputValue === "boolean") return inputValue;
  const value = String(envValue || "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "true" || value === "1" || value === "yes";
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

function buildFollowUpTasks({ appName, slug, deploymentEnvironment, releaseGate }) {
  return [
    {
      title: `[${slug}] Deployment Environment plan`,
      recommendedLabel: "ai:build",
      body: [
        `Create or update the Deployment Environment plan for ${appName}.`,
        "",
        "## Deployment Environment",
        `- Frontend: ${deploymentEnvironment.frontend.provider}`,
        `- API/backend required: ${deploymentEnvironment.apiBackend.required}`,
        `- API/backend provider: ${deploymentEnvironment.apiBackend.provider}`,
        `- Database: ${deploymentEnvironment.database.provider}`,
        `- Preview URL: ${deploymentEnvironment.frontend.previewUrl}`,
        `- Production URL: ${deploymentEnvironment.frontend.productionUrl}`,
        `- Custom domain/subdomain: ${deploymentEnvironment.frontend.customDomain}`,
        `- Health: ${deploymentEnvironment.frontend.healthPath}`,
        `- Logs: ${deploymentEnvironment.frontend.logsUrl}`,
        `- Env vars: ${deploymentEnvironment.environmentVariables.map((item) => item.name).join(", ")}`,
        "",
        "## Guardrails",
        "- List environment variable names only, never secret values.",
        "- Keep production deployment blocked until the Release Gate passes.",
        "- Include rollback notes before production."
      ].join("\n")
    },
    {
      title: `[${slug}] Preview deploy contract`,
      recommendedLabel: "ai:review",
      body: [
        `Prepare the preview deploy contract for ${appName}.`,
        "",
        "## Preview Contract",
        `- Version: ${releaseGate.versioning.launchVersion}`,
        `- Target status: ${releaseGate.app.targetStatus}`,
        "- Deploys production: false",
        "- Run smoke checks against preview.",
        "- Update Super Admin status to preview when checks pass.",
        "",
        "## Guardrails",
        "- Do not deploy production from this task.",
        "- Missing preview health or logs should create ai:fix follow-up work."
      ].join("\n")
    },
    {
      title: `[${slug}] Production Release Gate`,
      recommendedLabel: "ai:review",
      body: [
        `Review production release readiness for ${appName}.`,
        "",
        "## Release Gate",
        `- Launch version: ${releaseGate.versioning.launchVersion}`,
        "- Production approval required: true",
        "- Preview must pass before production.",
        "- Rollback notes must exist.",
        "- Super Admin status update must be planned.",
        "- Improvements after v1 become vNext packets or follow-up issues.",
        "",
        "## Guardrails",
        "- Do not mark production approved without owner approval.",
        "- Do not expand v1 with unrelated vNext work."
      ].join("\n")
    },
    {
      title: `[${slug}] Post-launch monitoring`,
      recommendedLabel: "ai:monitor",
      body: [
        `Monitor ${appName} after v1 launch.`,
        "",
        "## Monitoring",
        `- Version: ${releaseGate.versioning.launchVersion}`,
        `- Checks: ${releaseGate.automationContracts.postLaunchMonitoring.checks.join(", ")}`,
        "- Watch health, logs, user workflow, admin workflow, incidents, and Super Admin status drift.",
        "- Create ai:fix or ai:growth follow-up work when signals appear."
      ].join("\n")
    }
  ];
}

function validateDeploymentEnvironment(plan) {
  const missing = [];

  for (const [label, value] of [
    ["kind", plan.kind],
    ["app.name", plan.app?.name],
    ["app.slug", plan.app?.slug],
    ["app.version", plan.app?.version],
    ["frontend.provider", plan.frontend?.provider],
    ["frontend.previewUrl", plan.frontend?.previewUrl],
    ["frontend.productionUrl", plan.frontend?.productionUrl],
    ["frontend.customDomain", plan.frontend?.customDomain],
    ["frontend.logsUrl", plan.frontend?.logsUrl],
    ["frontend.healthPath", plan.frontend?.healthPath],
    ["database.provider", plan.database?.provider],
    ["database.rollbackNotes", plan.database?.rollbackNotes],
    ["rollback.production", plan.rollback?.production]
  ]) {
    if (!value) missing.push(label);
  }

  if (!Array.isArray(plan.environmentVariables) || plan.environmentVariables.length === 0) missing.push("environmentVariables");

  if (!plan.guardrails?.previewBeforeProduction || !plan.guardrails?.productionRequiresReleaseGate || !plan.guardrails?.rollbackNotesRequired) {
    missing.push("guardrails");
  }

  if (missing.length) throw new Error(`Deployment Environment plan is missing required fields: ${missing.join(", ")}`);
}

function validateReleaseGate(plan) {
  const missing = [];

  for (const [label, value] of [
    ["kind", plan.kind],
    ["app.name", plan.app?.name],
    ["app.slug", plan.app?.slug],
    ["app.version", plan.app?.version],
    ["versioning.launchVersion", plan.versioning?.launchVersion],
    ["versioning.futureWork", plan.versioning?.futureWork]
  ]) {
    if (!value) missing.push(label);
  }

  if (!Array.isArray(plan.gates) || plan.gates.length === 0) missing.push("gates");
  if (!plan.gates?.some((gate) => gate.id === "production_approval")) missing.push("gates.production_approval");
  if (!plan.automationContracts?.previewDeploy || !plan.automationContracts?.productionApproval || !plan.automationContracts?.postLaunchMonitoring) {
    missing.push("automationContracts");
  }

  if (!plan.guardrails?.previewBeforeProduction || !plan.guardrails?.ownerApprovalBeforeProduction || !plan.guardrails?.postLaunchMonitoringRequired) {
    missing.push("guardrails");
  }

  if (missing.length) throw new Error(`Release Gate plan is missing required fields: ${missing.join(", ")}`);
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
