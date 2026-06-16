import fs from "node:fs";
import path from "node:path";

const packetOutput = process.env.APP_BUILD_PACKET_OUTPUT || "";
const followUpsOutput = process.env.APP_BUILD_PACKET_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.APP_BUILD_PACKET_INPUT || "";

const input = readInput(inputPath);
const coreSourceOfTruthFiles = [
  "source-of-truth/00-why-we-build.md",
  "source-of-truth/01-ecosystem-philosophy.md",
  "source-of-truth/02-global-principles.md",
  "source-of-truth/03-life-produces-life.md",
  "source-of-truth/04-app-purpose-rules.md",
  "source-of-truth/05-ecosystem-design-gates.md",
  "source-of-truth/build-completion-orchestrator.md",
  "source-of-truth/app-url-lifecycle-standard.md",
  "source-of-truth/cost-governance-model-routing.md",
  "source-of-truth/design-intent-engine.md"
];
const appName = input.name || process.env.APP_NAME || "Example App";
const slug = input.slug || process.env.APP_SLUG || slugify(appName);
const charterPath = input.charterPath || process.env.APP_CHARTER_PATH || `source-of-truth/charters/${slug}.md`;
const purpose = input.purpose || process.env.APP_PURPOSE || "Describe why this app exists.";
const audience = input.audience || listFromEnv("APP_AUDIENCE", ["Primary users"]);
const helped = input.helped || listFromEnv("APP_HELPED", ["People or organizations helped by this app"]);
const barrierRemoved = input.barrierRemoved || process.env.APP_BARRIER_REMOVED || "Name the barrier this app removes.";
const needAddressed = input.needAddressed || process.env.APP_NEED_ADDRESSED || "Name the human, ministry, business, or workflow need this app addresses.";
const movementTowardLife = input.movementTowardLife || process.env.APP_MOVEMENT_TOWARD_LIFE || "Describe how this app helps someone move from survival toward life.";
const transformationOutcome = input.transformationOutcome || process.env.APP_TRANSFORMATION_OUTCOME || "Describe the transformation this app exists to support.";
const toolClassification = input.toolClassification || process.env.APP_TOOL_CLASSIFICATION || "unclassified";
const boundaries = input.boundaries || listFromEnv("APP_BOUNDARIES", ["Do not absorb unrelated app goals or audiences."]);
const successDefinition = input.successDefinition || process.env.APP_SUCCESS_DEFINITION || "Define the measurable outcome that proves the app is useful.";
const deploymentTarget = input.deploymentTarget || process.env.APP_DEPLOYMENT_TARGET || "Vercel preview first; production only after human approval.";
const dataPrivacyNotes = input.dataPrivacyNotes || process.env.APP_DATA_PRIVACY_NOTES || "Document ownership, retention, access, and privacy expectations before launch.";
const mvpStages = input.mvpStages || defaultMvpStages(appName);
const releaseVersion = input.version || process.env.APP_RELEASE_VERSION || "v1";
const fileUploadsUsed = booleanFrom(input.fileUploadsUsed, process.env.APP_FILE_UPLOADS_USED, false);
const paymentsUsed = booleanFrom(input.paymentsUsed, process.env.APP_PAYMENTS_USED, false);
const aiUsed = booleanFrom(input.aiUsed, process.env.APP_AI_USED, false);
const monthlyCostCeiling = input.monthlyCeiling || process.env.APP_MONTHLY_COST_CEILING || "owner-defined";
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
const providerCostReview =
  input.providerCostReview ||
  buildProviderCostReview({
    appName,
    slug,
    monthlyCeiling: monthlyCostCeiling,
    backendRequired: process.env.APP_BACKEND_REQUIRED === "true",
    fileUploadsUsed,
    paymentsUsed,
    aiUsed
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
    reviewUrl: process.env.APP_REVIEW_URL || process.env.OWNER_REVIEW_URL || "planned",
    productionUrl: process.env.APP_PRODUCTION_URL || "approval-gated",
    customDomain: process.env.APP_CUSTOM_DOMAIN || "planned",
    healthPath: process.env.APP_HEALTH_PATH || `/api/engine/apps/${slug}/health`,
    logsUrl: process.env.APP_LOGS_URL || "planned"
  });
const designIntent =
  input.designIntent ||
  input.design_intent_profile ||
  buildDesignIntentProfile({
    appName,
    slug,
    audience,
    styleProfile: process.env.APP_DESIGN_STYLE_PROFILE || "warm_approachable",
    emotionalExperience:
      process.env.APP_DESIGN_FEELING ||
      "warm, approachable, clean, hopeful, practical, trustworthy",
    trustNeeds: process.env.APP_DESIGN_TRUST_NEEDS || "clear state, visible guardrails, honest blockers, next safe action",
    accessibilityNeeds: process.env.APP_DESIGN_ACCESSIBILITY || "mobile-first, readable contrast, large touch targets, plain language",
    thingsToAvoid: process.env.APP_DESIGN_AVOID || "cold, generic, over-complicated, decorative clutter"
  });
const designReview =
  input.designReview ||
  buildDesignReview({
    appName,
    slug,
    audience,
    emotionalFit:
      process.env.APP_EMOTIONAL_FIT ||
      "Clear, trustworthy, calm, and fitted to the audience's real-life context."
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
    version: deploymentEnvironment.app.version,
    providerCostReview,
    deploymentEnvironment,
    designIntent,
    designReview,
    compatibilityTestPlan
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
    barrierRemoved,
    needAddressed,
    movementTowardLife,
    transformationOutcome,
    toolClassification,
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
    providerCostReview,
    deploymentEnvironment,
    designIntent,
    designReview,
    compatibilityTestPlan,
    releaseGate
  },
  sourceOfTruth: {
    requiredFiles: [...coreSourceOfTruthFiles, charterPath]
  },
  guardrails: {
    noGiantCodexTask: true,
    preventGoalBleed: true,
    requireContextGate: true,
    requirePhaseFollowUps: true,
    noProductionDeployWithoutApproval: true,
    notes: [
      "Keep this app inside its charter.",
      "Treat transformation as the product and people as the purpose.",
      "Apps share philosophy but do not share purpose.",
      "Answer the ecosystem design gates before implementation: barrier removed, need addressed, movement toward life, and source-of-life multiplication.",
      "Create phased follow-up issues instead of one giant Codex task.",
      "Define identity/auth before app build or launch work.",
      "Register management, monitoring, health, logs, users, billing/status if needed, and admin actions with Super Admin.",
      "Review provider strategy and cost before creating new paid resources.",
      "Track AI/API credit spend with cost governance before autonomous model-heavy work continues.",
      "Define deployment environment and release gates before preview or production launch.",
      "Capture design intent before generated UI, visual polish, or design review.",
      "Require Designer and Customer Perspective review before release approval.",
      "Block technically working but ugly, confusing, inaccessible, or emotionally mismatched apps.",
      "Block release when Safari, mobile, touch, form, auth, upload, payment, or common browser issues remain unresolved.",
      "Block purpose bleed between apps unless a documented integration approves it.",
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

function booleanFrom(inputValue, envValue, fallback) {
  if (typeof inputValue === "boolean") return inputValue;
  const value = String(envValue || "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "true" || value === "1" || value === "yes";
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
    phase("provider_cost", "Provider/Cost", "systems", "ai:plan", "Review operations, provider reuse, estimated cost tier, new paid resources, and upgrade triggers before provisioning.", [
      "Provider/cost review exists or blockers are recorded.",
      "No new paid provider resource is approved without owner approval, cost posture, and upgrade trigger."
    ]),
    phase("data_model", "Data Model", "builder", "ai:build", "Define database schema, ownership, privacy, seed data, and migrations.", [
      "Data ownership and privacy notes are explicit.",
      "Generated schema can be applied safely to a preview database."
    ]),
    phase("identity_auth", "Identity/Auth", "builder", "ai:build", "Define auth provider, roles, memberships, permissions, protected routes, and server-side guards.", [
      "Identity/Auth plan includes provider, session strategy, roles, memberships, permissions, and protected routes.",
      "Production auth gates and local setup behavior are explicit."
    ]),
    phase("design_intent", "Design Intent", "designer", "ai:plan", "Capture audience, feeling, trust, accessibility, visual style, references, and things to avoid before UI design.", [
      "Design Intent profile exists or missing fields are recorded.",
      "Profile includes audience, user sophistication, desired emotional experience, trust needs, accessibility needs, visual style preference, and things to avoid."
    ]),
    phase("ui_design", "UI Design", "designer", "ai:build", "Define user flows, screens, copy, accessibility, and design direction.", [
      "Primary workflow is visible and testable.",
      "Design supports the app audience, charter, and Design Intent profile."
    ]),
    phase("design_quality", "Design Quality", "designer", "ai:review", "Review navigation, primary actions, mobile layout, copy, spacing, contrast, trust, and emotional fit.", [
      "Designer review is complete or release-blocking issues are recorded.",
      "Design quality checks cover simple navigation, clear primary action, mobile, readable copy, spacing, contrast, trust, and audience fit."
    ]),
    phase("ux_review", "UX Review", "customer_perspective", "ai:review", "Review mobile, empty states, error states, onboarding, admin screens, and release-blocking UX confusion.", [
      "Customer Perspective review is complete or release-blocking issues are recorded.",
      "UX review covers mobile, empty states, error states, onboarding, and admin screens."
    ]),
    phase("compatibility", "Compatibility", "workflow_tester", "ai:review", "Test mobile-first responsiveness, Safari, Chrome, Edge, Firefox, touch targets, forms, auth, uploads/payments if used, and admin screens.", [
      "Compatibility Test Plan exists or release-blocking issues are recorded.",
      "Checks cover iPhone/iPad Safari, desktop Safari, Chrome mobile/desktop, common desktop browsers, touch targets, forms, auth, and admin screens."
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
      `- Barrier removed: ${app.barrierRemoved}`,
      `- Need addressed: ${app.needAddressed}`,
      `- Movement toward life: ${app.movementTowardLife}`,
      `- Transformation outcome: ${app.transformationOutcome}`,
      `- Tool classification: ${app.toolClassification}`,
      `- Success: ${app.successDefinition}`,
      `- Deployment target: ${app.deploymentTarget}`,
      "",
      "## Required Source Of Truth To Load",
      ...packet.sourceOfTruth.requiredFiles.map((filePath) => `- ${filePath}`),
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
      "## Provider/Cost",
      `- Preview cost posture: ${app.providerCostReview.costPosture.preview}`,
      `- Production cost posture: ${app.providerCostReview.costPosture.production}`,
      `- Monthly ceiling: ${app.providerCostReview.costPosture.monthlyCeiling}`,
      `- Upgrade trigger: ${app.providerCostReview.costPosture.upgradeTrigger}`,
      `- Providers: ${app.providerCostReview.providers.map((item) => `${item.area}:${item.preferred}`).join(", ")}`,
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
      "## Design Intent",
      `- Style profile: ${app.designIntent.visualStylePreference}`,
      `- Audience: ${app.designIntent.targetAudience.join(", ")}`,
      `- Desired feeling: ${app.designIntent.desiredEmotionalExperience.join(", ")}`,
      `- Trust needs: ${app.designIntent.trustNeeds.join(", ")}`,
      `- Avoid: ${app.designIntent.thingsToAvoid.join(", ")}`,
      "",
      "## Design Quality",
      `- Designer review: ${app.designReview.reviewers.designerStatus}`,
      `- Customer Perspective review: ${app.designReview.reviewers.customerPerspectiveStatus}`,
      `- Checks: ${app.designReview.qualityChecks.map((check) => check.id).join(", ")}`,
      `- State checks: ${app.designReview.stateChecks.join(", ")}`,
      "",
      "## Compatibility",
      `- Browsers/platforms: ${app.compatibilityTestPlan.browserSupport.map((item) => `${item.platform} ${item.browser}`).join(", ")}`,
      `- Viewports: ${app.compatibilityTestPlan.viewports.join(", ")}`,
      `- Checks: ${app.compatibilityTestPlan.checks.map((check) => check.id).join(", ")}`,
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
      "- Treat transformation as the product and people as the purpose.",
      "- Preserve this app's specific purpose; apps share philosophy but do not share purpose.",
      "- Do not import unrelated app goals, audiences, data, or features.",
      "- Do not invent auth outside the Identity/Auth Standard.",
      "- Do not skip Super Admin registry planning.",
      "- Do not create new paid provider resources without provider/cost review and owner approval.",
      "- Do not continue model-heavy agent work when cost governance says to pause or request owner approval.",
      "- Do not include secret values in deployment environment output.",
      "- Do not approve release for technically working but ugly, confusing, inaccessible, or emotionally mismatched UX.",
      "- Require Designer and Customer Perspective review before Release Gate approval.",
      "- Do not approve release with unresolved Safari, mobile, touch-target, form, auth, upload, payment, or common browser issues.",
      "- Do not advance planning, implementation, preview, review, release, or vNext work without a build completion plan naming the next safe action.",
      "- Do not claim preview success unless preview verification checks the expected route, app marker, commit SHA, and mock/API JSON when applicable.",
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
    "provider_cost",
    "data_model",
    "identity_auth",
    "design_intent",
    "ui_design",
    "design_quality",
    "ux_review",
    "compatibility",
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
    ["app.barrierRemoved", packet.app.barrierRemoved],
    ["app.needAddressed", packet.app.needAddressed],
    ["app.movementTowardLife", packet.app.movementTowardLife],
    ["app.transformationOutcome", packet.app.transformationOutcome],
    ["app.toolClassification", packet.app.toolClassification],
    ["app.successDefinition", packet.app.successDefinition],
    ["app.deploymentTarget", packet.app.deploymentTarget],
    ["app.identityAuth.auth.provider", packet.app.identityAuth?.auth?.provider],
    ["app.superAdminRegistry.status", packet.app.superAdminRegistry?.status],
    ["app.providerCostReview.costPosture.preview", packet.app.providerCostReview?.costPosture?.preview],
    ["app.deploymentEnvironment.frontend.provider", packet.app.deploymentEnvironment?.frontend?.provider],
    ["app.deploymentEnvironment.frontend.previewUrl", packet.app.deploymentEnvironment?.frontend?.previewUrl],
    ["app.deploymentEnvironment.frontend.reviewUrl", packet.app.deploymentEnvironment?.frontend?.reviewUrl],
    ["app.designIntent.kind", packet.app.designIntent?.kind],
    ["app.designIntent.visualStylePreference", packet.app.designIntent?.visualStylePreference],
    ["app.designIntent.ownerReadableSummary", packet.app.designIntent?.ownerReadableSummary],
    ["app.designReview.reviewers.designerStatus", packet.app.designReview?.reviewers?.designerStatus],
    ["app.designReview.reviewers.customerPerspectiveStatus", packet.app.designReview?.reviewers?.customerPerspectiveStatus],
    ["app.compatibilityTestPlan.kind", packet.app.compatibilityTestPlan?.kind],
    ["app.releaseGate.versioning.launchVersion", packet.app.releaseGate?.versioning?.launchVersion]
  ]) {
    if (!value) missingFields.push(label);
  }

  for (const [label, value] of [
    ["app.audience", packet.app.audience],
    ["app.boundaries", packet.app.boundaries],
    ["sourceOfTruth.requiredFiles", packet.sourceOfTruth?.requiredFiles],
    ["app.mvpStages", packet.app.mvpStages],
    ["app.superAdminIntegration.requirements", packet.app.superAdminIntegration.requirements],
    ["app.identityAuth.roles", packet.app.identityAuth?.roles],
    ["app.identityAuth.protectedRoutes", packet.app.identityAuth?.protectedRoutes],
    ["app.superAdminRegistry.superAdminActions", packet.app.superAdminRegistry?.superAdminActions],
    ["app.providerCostReview.providers", packet.app.providerCostReview?.providers],
    ["app.providerCostReview.checks", packet.app.providerCostReview?.checks],
    ["app.deploymentEnvironment.environmentVariables", packet.app.deploymentEnvironment?.environmentVariables],
    ["app.designIntent.targetAudience", packet.app.designIntent?.targetAudience],
    ["app.designIntent.desiredEmotionalExperience", packet.app.designIntent?.desiredEmotionalExperience],
    ["app.designIntent.brandPersonality", packet.app.designIntent?.brandPersonality],
    ["app.designIntent.trustNeeds", packet.app.designIntent?.trustNeeds],
    ["app.designIntent.accessibilityNeeds", packet.app.designIntent?.accessibilityNeeds],
    ["app.designIntent.thingsToAvoid", packet.app.designIntent?.thingsToAvoid],
    ["app.designReview.qualityChecks", packet.app.designReview?.qualityChecks],
    ["app.designReview.stateChecks", packet.app.designReview?.stateChecks],
    ["app.compatibilityTestPlan.browserSupport", packet.app.compatibilityTestPlan?.browserSupport],
    ["app.compatibilityTestPlan.checks", packet.app.compatibilityTestPlan?.checks],
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

  for (const filePath of coreSourceOfTruthFiles) {
    if (!packet.sourceOfTruth.requiredFiles.includes(filePath)) {
      throw new Error(`App Build Packet must require source-of-truth file: ${filePath}`);
    }
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

  if (!packet.app.providerCostReview.guardrails.blocksProvisioning || !packet.app.providerCostReview.guardrails.noPaidResourcesWithoutApproval) {
    throw new Error("App Build Packet must require provider/cost review before provisioning.");
  }

  if (
    !packet.app.deploymentEnvironment.guardrails.previewBeforeProduction ||
    !packet.app.deploymentEnvironment.guardrails.publicPreviewByDefault ||
    !packet.app.deploymentEnvironment.guardrails.productionRequiresReleaseGate
  ) {
    throw new Error("App Build Packet must require a Deployment Environment plan with preview-before-production guardrails.");
  }

  if (
    packet.app.designIntent.kind !== "design_intent_profile" ||
    !packet.app.designIntent.guardrails.foundationOnly ||
    !packet.app.designIntent.guardrails.noAutomaticCodexBuild
  ) {
    throw new Error("App Build Packet must require a Design Intent profile before UI work.");
  }

  if (!packet.app.designReview.guardrails.blocksReleaseGateApproval || !packet.app.designReview.guardrails.requiresDesignerReview) {
    throw new Error("App Build Packet must require a Design Quality Gate that blocks release approval.");
  }

  if (!packet.app.compatibilityTestPlan.guardrails.blocksReleaseGateApproval || !packet.app.compatibilityTestPlan.guardrails.safariMobileRequired) {
    throw new Error("App Build Packet must require a Compatibility Test Plan that blocks release approval.");
  }

  if (
    !packet.app.releaseGate.guardrails.previewBeforeProduction ||
    !packet.app.releaseGate.guardrails.ownerApprovalBeforeProduction ||
    !packet.app.releaseGate.guardrails.costReviewBeforeProvisioning ||
    !packet.app.releaseGate.guardrails.costGovernanceBeforeModelHeavyWork ||
    !packet.app.releaseGate.guardrails.designReviewBeforeRelease ||
    !packet.app.releaseGate.guardrails.compatibilityBeforeRelease
  ) {
    throw new Error("App Build Packet must require a Release Gate with design review, compatibility, and owner approval before production.");
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

function buildReleaseGate({ appName, slug, version, providerCostReview, deploymentEnvironment, designIntent, designReview, compatibilityTestPlan }) {
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
      gate("design_intent", "required", designIntent.kind),
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
      designReview: {
        recommendedLabel: "ai:review",
        requiresDesignerReview: true,
        requiresCustomerPerspectiveReview: true,
        blocksReleaseApproval: true
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
      designIntent: {
        recommendedLabel: "ai:plan",
        requiredBeforeUiDesign: true,
        requiredBeforeUiBuild: true,
        requiredBeforeDesignReview: true,
        artifact: designIntent.kind
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

function gate(id, status, evidence) {
  return { id, status, evidence };
}

function buildDesignIntentProfile({ appName, slug, audience, styleProfile, emotionalExperience, trustNeeds, accessibilityNeeds, thingsToAvoid }) {
  return {
    kind: "design_intent_profile",
    schemaVersion: 1,
    app: {
      name: appName,
      slug,
      context: "App Build Packet design intent before UI generation"
    },
    targetAudience: normalizeList(audience),
    userSophisticationLevel: "mixed",
    desiredEmotionalExperience: normalizeList(emotionalExperience),
    brandPersonality: ["approachable", "practical", "trustworthy"],
    trustNeeds: normalizeList(trustNeeds),
    accessibilityNeeds: normalizeList(accessibilityNeeds),
    visualStylePreference: styleProfile,
    examplesOrReferences: [],
    thingsToAvoid: normalizeList(thingsToAvoid),
    outputGuidance: {
      colors: "Use an audience-specific palette with clear status colors and accessible contrast.",
      typography: "Use readable type with hierarchy appropriate to the app context.",
      spacing: "Use mobile-first spacing that is comfortable without wasting operational space.",
      cards: "Use cards for repeated items and framed tools; avoid nested cards.",
      forms: "Use plain-language labels, supportive validation, and visible safety notes.",
      dashboards: "Show state, blockers, next action, evidence, owner review URL, and version when relevant.",
      navigation: "Use short labels and obvious owner/user paths.",
      buttons: "Make the primary action clear and keep secondary actions restrained.",
      emptyStates: "Explain what is missing and what the next safe action is.",
      mobileLayout: "Avoid horizontal overflow; keep touch targets large and Safari-safe."
    },
    ownerReadableSummary: `${appName} should have an audience-specific UI that feels ${normalizeList(emotionalExperience).join(", ")} and avoids ${normalizeList(thingsToAvoid).join(", ")}.`,
    guardrails: {
      foundationOnly: true,
      noUiRedesign: true,
      noProductionDeploy: true,
      noPaidResources: true,
      noMigrations: true,
      noSecretsOrEnvChanges: true,
      repositoryVisibilityUnchanged: true,
      noAutomaticCodexBuild: true
    }
  };
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  return [];
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
