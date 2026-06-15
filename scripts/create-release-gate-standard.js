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
const reviewUrl = input.reviewUrl || process.env.APP_REVIEW_URL || process.env.OWNER_REVIEW_URL || "planned";
const productionUrl = input.productionUrl || process.env.APP_PRODUCTION_URL || "approval-gated";
const customDomain = input.customDomain || process.env.APP_CUSTOM_DOMAIN || "planned";
const healthPath = input.healthPath || process.env.APP_HEALTH_PATH || "/api/health";
const logsUrl = input.logsUrl || process.env.APP_LOGS_URL || "planned";
const audience = input.audience || listFromEnv("APP_AUDIENCE", ["Primary users"]);
const emotionalFit =
  input.emotionalFit ||
  process.env.APP_EMOTIONAL_FIT ||
  "Clear, trustworthy, calm, and fitted to the audience's real-life context.";
const fileUploadsUsed = booleanFrom(input.fileUploadsUsed, process.env.APP_FILE_UPLOADS_USED, false);
const paymentsUsed = booleanFrom(input.paymentsUsed, process.env.APP_PAYMENTS_USED, false);
const aiUsed = booleanFrom(input.aiUsed, process.env.APP_AI_USED, false);
const monthlyCostCeiling = input.monthlyCeiling || process.env.APP_MONTHLY_COST_CEILING || "owner-defined";

const providerCostReview =
  input.providerCostReview ||
  buildProviderCostReview({
    appName,
    slug,
    monthlyCeiling: monthlyCostCeiling,
    backendRequired,
    fileUploadsUsed,
    paymentsUsed,
    aiUsed
  });
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
    reviewUrl,
    productionUrl,
    customDomain,
    healthPath,
    logsUrl
  });
const designReview =
  input.designReview ||
  buildDesignReview({
    appName,
    slug,
    audience,
    emotionalFit
  });
const compatibilityTestPlan =
  input.compatibilityTestPlan ||
  buildCompatibilityTestPlan({
    appName,
    slug,
    fileUploadsUsed,
    paymentsUsed
  });

const releaseGate =
  input.releaseGate ||
  buildReleaseGate({
    appName,
    slug,
    version,
    providerCostReview,
    deploymentEnvironment,
    designReview,
    compatibilityTestPlan
  });

const followUpTasks = buildFollowUpTasks({ appName, slug, providerCostReview, deploymentEnvironment, compatibilityTestPlan, releaseGate });
const output = {
  agent: "planner",
  status: "needs_follow_up",
  summary: `Created Deployment Environment and Release Gate plans for ${appName}.`,
  artifacts: [
    {
      kind: "provider_cost_review",
      title: `${appName} Provider and Cost Review`,
      content: providerCostReview
    },
    {
      kind: "deployment_environment_plan",
      title: `${appName} Deployment Environment Plan`,
      content: deploymentEnvironment
    },
    {
      kind: "design_review",
      title: `${appName} Design Review`,
      content: designReview
    },
    {
      kind: "compatibility_test_plan",
      title: `${appName} Compatibility Test Plan`,
      content: compatibilityTestPlan
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

validateProviderCostReview(providerCostReview);
validateDeploymentEnvironment(deploymentEnvironment);
validateCompatibilityTestPlan(compatibilityTestPlan);
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

function listFromEnv(name, fallback) {
  const raw = process.env[name] || "";
  if (!raw.trim()) return fallback;
  return raw
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
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
  reviewUrl,
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
      reviewUrl,
      previewAccess: "public_by_default",
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
      publicPreviewByDefault: true,
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

function buildDesignReview({ appName, slug, audience, emotionalFit }) {
  return {
    kind: "design_review",
    schemaVersion: 1,
    app: {
      name: appName,
      slug,
      audience
    },
    reviewers: {
      designerRequired: true,
      customerPerspectiveRequired: true,
      designerStatus: "required",
      customerPerspectiveStatus: "required"
    },
    qualityChecks: [
      qualityCheck("simple_navigation", "Can the user understand where they are and where to go next?"),
      qualityCheck("clear_primary_action", "Is the next best action obvious on the main workflow screens?"),
      qualityCheck("mobile_first_layout", "Does the workflow feel complete and comfortable on mobile?"),
      qualityCheck("readable_copy", "Is the copy clear, human, and free of unnecessary technical language?"),
      qualityCheck("accessible_spacing_contrast", "Are spacing, contrast, and text size comfortable and accessible?"),
      qualityCheck("trust_building_elements", "Does the interface explain status, privacy, next steps, and safety where trust matters?"),
      qualityCheck("audience_emotional_fit", "Does the experience feel emotionally right for the people this app serves?")
    ],
    stateChecks: ["mobile", "empty states", "error states", "loading states", "onboarding", "admin screens", "Super Admin status"],
    uxReview: {
      required: true,
      status: "required",
      surfaces: ["first screen", "main workflow", "mobile", "empty states", "error states", "onboarding", "admin screens"],
      emotionalFit,
      releaseBlockingIssues: []
    },
    workflowTestChecks: ["mobile", "empty states", "error states", "onboarding", "admin screens"],
    guardrails: {
      blocksReleaseGateApproval: true,
      requiresDesignerReview: true,
      requiresCustomerPerspectiveReview: true,
      blocksUglyOrConfusingApps: true
    }
  };
}

function qualityCheck(id, question) {
  return {
    id,
    status: "required",
    question
  };
}

function buildProviderCostReview({ appName, slug, monthlyCeiling, backendRequired, fileUploadsUsed, paymentsUsed, aiUsed }) {
  return {
    kind: "provider_cost_review",
    schemaVersion: 1,
    app: {
      name: appName,
      slug
    },
    costPosture: {
      preview: "free_or_low_cost",
      production: "approval_required",
      monthlyCeiling,
      upgradeTrigger: "Usage, reliability, customer value, or revenue justifies paid resources."
    },
    providers: [
      provider("frontend", "Vercel", "Reuse existing Vercel account/project where practical; preview first.", false),
      provider("api_backend", backendRequired ? "Render or Vercel Functions" : "not_required_initially", backendRequired ? "Prefer serverless or free/low-cost preview before always-on services." : "Do not create backend service until required.", backendRequired),
      provider("database", "Neon", "Use branch or app-scoped database before creating separate paid projects.", false),
      provider("storage", fileUploadsUsed ? "Vercel Blob or approved storage" : "not_required_initially", fileUploadsUsed ? "Add storage only after upload scope is approved." : "Do not create storage provider until uploads are used.", fileUploadsUsed),
      provider("payments", paymentsUsed ? "Stripe" : "not_required_initially", paymentsUsed ? "Create payment resources only after billing scope and test mode are approved." : "Do not create payment provider until billing is used.", paymentsUsed),
      provider("ai_models", aiUsed ? "OpenAI or approved model provider" : "not_required_initially", aiUsed ? "Use existing approved project/key routing and cap usage during preview." : "Do not add model costs until model calls are required.", aiUsed),
      provider("monitoring_logs", "Vercel/Render/Super Admin", "Use built-in logs and health checks before adding paid observability.", false)
    ],
    checks: [
      costCheck("reuse_before_create", "Can this app reuse an existing approved provider resource?"),
      costCheck("preview_before_paid", "Can preview run free or low-cost before production resources are approved?"),
      costCheck("database_branch_before_project", "Can the app use a branch or app-scoped database instead of a new paid project?"),
      costCheck("backend_only_if_required", "Is an always-on backend truly required for this version?"),
      costCheck("storage_email_payments_ai_only_if_used", "Are paid add-ons only included when the app uses them?"),
      costCheck("owner_approval_before_paid", "Is owner approval required before paid production resources are created?")
    ],
    guardrails: {
      blocksProvisioning: true,
      blocksReleaseGateApproval: true,
      noPaidResourcesWithoutApproval: true,
      reuseBeforeCreate: true,
      noSecretsInOutput: true
    }
  };
}

function provider(area, preferred, strategy, newPaidResourceAllowed) {
  return {
    area,
    preferred,
    strategy,
    newPaidResourceAllowed
  };
}

function costCheck(id, question) {
  return {
    id,
    status: "required",
    question
  };
}

function buildReleaseGate({ appName, slug, version, providerCostReview, deploymentEnvironment, designReview, compatibilityTestPlan }) {
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
      gate("provider_cost_review", "required", providerCostReview.kind),
      gate("cost_governance", "required", "cost_governance"),
      gate("provider_provisioning_approval", "blocked_until_owner_approval", providerCostReview.costPosture.production),
      gate("deployment_environment", "required", "deployment_environment_plan"),
      gate("deployment_lifecycle", "required", "deployment_lifecycle"),
      gate("design_quality", "required", designReview.kind),
      gate("designer_review", "required", designReview.reviewers.designerStatus),
      gate("customer_perspective_review", "required", designReview.reviewers.customerPerspectiveStatus),
      gate("ux_state_review", "required", designReview.workflowTestChecks.join(", ")),
      gate("compatibility", "required", compatibilityTestPlan.kind),
      gate("safari_mobile", "required", "iPhone Safari, iPad Safari, desktop Safari"),
      gate("common_browsers", "required", compatibilityTestPlan.browserSupport.map((item) => item.id).join(", ")),
      gate("touch_forms_auth_admin", "required", "touch targets, forms, auth flows, admin screens"),
      gate("preview_deploy", "required", deploymentEnvironment.frontend.previewUrl),
      gate("preview_health_logs", "required", "health checks and logs"),
      gate("production_approval", "blocked_until_owner_approval", "owner approval comment or release issue"),
      gate("v1_launch", "blocked_until_release_gate_passes", version),
      gate("post_launch_monitoring", "required", "ai:monitor follow-up")
    ],
    automationContracts: {
      previewDeploy: {
        recommendedLabel: "ai:review",
        previewAccess: "public_by_default",
        deploysProduction: false,
        updatesSuperAdminStatus: "preview"
      },
      providerCostReview: {
        recommendedLabel: "ai:plan",
        blocksProvisioning: true,
        noPaidResourcesWithoutApproval: true,
        costPosture: providerCostReview.costPosture
      },
      costGovernance: {
        recommendedLabel: "ai:review",
        blocksModelSpendBeyondThreshold: true,
        requiresOwnerApprovalAtApprovalThreshold: true
      },
      designReview: {
        recommendedLabel: "ai:review",
        requiresDesignerReview: true,
        requiresCustomerPerspectiveReview: true,
        blocksReleaseApproval: true
      },
      compatibilityTesting: {
        recommendedLabel: "ai:review",
        requiresSafariMobile: true,
        requiresCommonBrowsers: true,
        blocksReleaseApproval: true,
        checks: compatibilityTestPlan.workflowTestChecks
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
      costReviewBeforeProvisioning: true,
      costGovernanceBeforeModelHeavyWork: true,
      designReviewBeforeRelease: true,
      compatibilityBeforeRelease: true,
      postLaunchMonitoringRequired: true,
      vNextAfterV1: true,
      noSecretsInOutput: true
    }
  };
}

function gate(id, status, evidence) {
  return { id, status, evidence };
}

function buildCompatibilityTestPlan({ appName, slug, fileUploadsUsed, paymentsUsed }) {
  return {
    kind: "compatibility_test_plan",
    schemaVersion: 1,
    app: {
      name: appName,
      slug
    },
    browserSupport: [
      browserTarget("iphone_safari", "Safari", "iPhone", "390x844", true),
      browserTarget("ipad_safari", "Safari", "iPad", "768x1024", true),
      browserTarget("desktop_safari", "Safari", "macOS desktop", "1440x900", true),
      browserTarget("chrome_mobile", "Chrome", "Android or iOS mobile", "390x844", true),
      browserTarget("chrome_desktop", "Chrome", "desktop", "1440x900", true),
      browserTarget("edge_desktop", "Edge", "desktop", "1280x720", false),
      browserTarget("firefox_desktop", "Firefox", "desktop", "1280x720", false)
    ],
    viewports: ["360x640", "390x844", "430x932", "768x1024", "1024x768", "1280x720", "1440x900"],
    checks: [
      compatibilityCheck("mobile_first_layout", "Does the main workflow work cleanly at mobile widths?"),
      compatibilityCheck("responsive_navigation", "Does navigation remain usable across phone, tablet, and desktop?"),
      compatibilityCheck("touch_targets", "Can the primary workflow be completed comfortably with touch?"),
      compatibilityCheck("forms_validation", "Can required forms be completed and corrected on mobile and desktop browsers?"),
      compatibilityCheck("auth_flows", "Do sign-in, sign-out, protected routes, and redirects work across Safari and common browsers?"),
      compatibilityCheck("file_uploads_if_used", "If the app uses uploads, do uploads work on mobile Safari and desktop browsers?"),
      compatibilityCheck("payments_if_used", "If the app uses payments, do payment flows work on mobile Safari and common browsers?"),
      compatibilityCheck("admin_screens", "Can admins use required screens on tablet and desktop without layout or control issues?"),
      compatibilityCheck("super_admin_status", "Is Super Admin status readable and actionable across common viewports?"),
      compatibilityCheck("browser_api_fallbacks", "Are browser-specific APIs guarded with practical fallbacks?")
    ],
    conditionalChecks: {
      fileUploadsIfUsed: true,
      fileUploadsUsed,
      paymentsIfUsed: true,
      paymentsUsed
    },
    workflowTestChecks: ["iPhone Safari", "iPad Safari", "desktop Safari", "Chrome mobile", "Chrome desktop", "Edge desktop", "Firefox desktop", "touch targets", "forms", "auth flows", "admin screens"],
    guardrails: {
      blocksReleaseGateApproval: true,
      safariMobileRequired: true,
      commonBrowsersRequired: true,
      touchTargetsRequired: true,
      formsRequired: true,
      authFlowsRequired: true,
      adminScreensRequired: true,
      unresolvedCompatibilityIssuesBlockRelease: true
    }
  };
}

function browserTarget(id, browser, platform, viewport, required) {
  return {
    id,
    browser,
    platform,
    viewport,
    required,
    status: "required"
  };
}

function compatibilityCheck(id, question) {
  return {
    id,
    status: "required",
    question
  };
}

function buildFollowUpTasks({ appName, slug, providerCostReview, deploymentEnvironment, compatibilityTestPlan, releaseGate }) {
  return [
    {
      title: `[${slug}] Provider and cost review`,
      recommendedLabel: "ai:plan",
      body: [
        `Review provider strategy and cost posture for ${appName}.`,
        "",
        "## Cost Posture",
        `- Preview: ${providerCostReview.costPosture.preview}`,
        `- Production: ${providerCostReview.costPosture.production}`,
        `- Monthly ceiling: ${providerCostReview.costPosture.monthlyCeiling}`,
        `- Upgrade trigger: ${providerCostReview.costPosture.upgradeTrigger}`,
        "",
        "## Guardrails",
        "- Do not create paid provider resources without owner approval.",
        "- Prefer reuse, branches, preview resources, and free/low-cost defaults before new services.",
        "- Keep production deployment blocked until provider/cost review passes."
      ].join("\n")
    },
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
        `- Review URL: ${deploymentEnvironment.frontend.reviewUrl}`,
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
      title: `[${slug}] Design Quality Gate`,
      recommendedLabel: "ai:review",
      body: [
        `Run Designer and Customer Perspective review for ${appName} before Release Gate approval.`,
        "",
        "## Design Quality",
        "- Designer review: required",
        "- Customer Perspective review: required",
        "- Check simple navigation, clear primary action, mobile-first layout, readable copy, spacing, contrast, trust-building elements, and audience-specific emotional fit.",
        "- Check mobile, empty states, error states, onboarding, and admin screens.",
        "",
        "## Guardrails",
        "- Block Release Gate approval if the app is technically working but ugly, confusing, inaccessible, or emotionally mismatched.",
        "- Create ai:fix follow-up work for release-blocking UX issues."
      ].join("\n")
    },
    {
      title: `[${slug}] Compatibility Test Plan`,
      recommendedLabel: "ai:review",
      body: [
        `Run compatibility checks for ${appName} before Release Gate approval.`,
        "",
        "## Compatibility",
        `- Browsers/platforms: ${compatibilityTestPlan.browserSupport.map((item) => `${item.platform} ${item.browser}`).join(", ")}`,
        `- Viewports: ${compatibilityTestPlan.viewports.join(", ")}`,
        "- Check mobile-first layout, touch targets, forms, auth flows, file uploads if used, payments if used, admin screens, and Super Admin status.",
        "",
        "## Guardrails",
        "- Block Release Gate approval while Safari, mobile, common browser, form, auth, upload, payment, touch-target, or admin issues remain unresolved.",
        "- Create ai:fix follow-up work for release-blocking compatibility issues."
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

function validateProviderCostReview(review) {
  const missing = [];

  for (const [label, value] of [
    ["kind", review.kind],
    ["app.name", review.app?.name],
    ["app.slug", review.app?.slug],
    ["costPosture.preview", review.costPosture?.preview],
    ["costPosture.production", review.costPosture?.production],
    ["costPosture.monthlyCeiling", review.costPosture?.monthlyCeiling],
    ["costPosture.upgradeTrigger", review.costPosture?.upgradeTrigger]
  ]) {
    if (!value) missing.push(label);
  }

  if (!Array.isArray(review.providers) || review.providers.length === 0) missing.push("providers");
  if (!Array.isArray(review.checks) || review.checks.length === 0) missing.push("checks");

  if (!review.guardrails?.blocksProvisioning || !review.guardrails?.blocksReleaseGateApproval || !review.guardrails?.noPaidResourcesWithoutApproval) {
    missing.push("guardrails");
  }

  if (missing.length) throw new Error(`Provider/cost review is missing required fields: ${missing.join(", ")}`);
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
    ["frontend.reviewUrl", plan.frontend?.reviewUrl],
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

  if (
    !plan.guardrails?.previewBeforeProduction ||
    !plan.guardrails?.publicPreviewByDefault ||
    !plan.guardrails?.productionRequiresReleaseGate ||
    !plan.guardrails?.rollbackNotesRequired
  ) {
    missing.push("guardrails");
  }

  if (missing.length) throw new Error(`Deployment Environment plan is missing required fields: ${missing.join(", ")}`);
}

function validateCompatibilityTestPlan(plan) {
  const missing = [];

  for (const [label, value] of [
    ["kind", plan.kind],
    ["app.name", plan.app?.name],
    ["app.slug", plan.app?.slug]
  ]) {
    if (!value) missing.push(label);
  }

  for (const [label, value] of [
    ["browserSupport", plan.browserSupport],
    ["viewports", plan.viewports],
    ["checks", plan.checks],
    ["workflowTestChecks", plan.workflowTestChecks]
  ]) {
    if (!Array.isArray(value) || value.length === 0) missing.push(label);
  }

  for (const id of ["iphone_safari", "ipad_safari", "desktop_safari", "chrome_mobile", "chrome_desktop"]) {
    if (!plan.browserSupport?.some((item) => item.id === id)) missing.push(`browserSupport.${id}`);
  }

  for (const id of ["touch_targets", "forms_validation", "auth_flows", "admin_screens"]) {
    if (!plan.checks?.some((check) => check.id === id)) missing.push(`checks.${id}`);
  }

  if (
    !plan.guardrails?.blocksReleaseGateApproval ||
    !plan.guardrails?.safariMobileRequired ||
    !plan.guardrails?.commonBrowsersRequired ||
    !plan.guardrails?.unresolvedCompatibilityIssuesBlockRelease
  ) {
    missing.push("guardrails");
  }

  if (missing.length) throw new Error(`Compatibility test plan is missing required fields: ${missing.join(", ")}`);
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
  if (!plan.gates?.some((gate) => gate.id === "design_quality")) missing.push("gates.design_quality");
  if (!plan.gates?.some((gate) => gate.id === "customer_perspective_review")) missing.push("gates.customer_perspective_review");
  if (!plan.gates?.some((gate) => gate.id === "provider_cost_review")) missing.push("gates.provider_cost_review");
  if (!plan.gates?.some((gate) => gate.id === "cost_governance")) missing.push("gates.cost_governance");
  if (!plan.gates?.some((gate) => gate.id === "compatibility")) missing.push("gates.compatibility");
  if (!plan.gates?.some((gate) => gate.id === "safari_mobile")) missing.push("gates.safari_mobile");
  if (!plan.gates?.some((gate) => gate.id === "common_browsers")) missing.push("gates.common_browsers");
  if (!plan.gates?.some((gate) => gate.id === "production_approval")) missing.push("gates.production_approval");
  if (!plan.automationContracts?.previewDeploy || !plan.automationContracts?.providerCostReview || !plan.automationContracts?.costGovernance || !plan.automationContracts?.designReview || !plan.automationContracts?.compatibilityTesting || !plan.automationContracts?.productionApproval || !plan.automationContracts?.postLaunchMonitoring) {
    missing.push("automationContracts");
  }

  if (
    !plan.guardrails?.previewBeforeProduction ||
    !plan.guardrails?.ownerApprovalBeforeProduction ||
    !plan.guardrails?.costReviewBeforeProvisioning ||
    !plan.guardrails?.costGovernanceBeforeModelHeavyWork ||
    !plan.guardrails?.designReviewBeforeRelease ||
    !plan.guardrails?.compatibilityBeforeRelease ||
    !plan.guardrails?.postLaunchMonitoringRequired
  ) {
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
