const DEPLOYMENT_STATES = new Set([
  "build_preview",
  "review_ready",
  "review_blocked",
  "approved_for_release",
  "production_live",
  "production_blocked",
  "failed_needs_fix"
]);

const UNKNOWN_VALUES = new Set(["", "unknown", "planned", "pending", "not_applicable", "none", "null"]);

export function buildDeploymentLifecycle({ input = {}, packet = {}, previewVerification = {}, env = process.env, appName, slug, relatedPreviewUrl = "" } = {}) {
  const packetApp = packet.app || packet.content?.app || {};
  const lifecycleInput = input.deploymentLifecycle || input.deployment_lifecycle || input;
  const existing = packetApp.deploymentLifecycle || packetApp.deployment_lifecycle || {};
  const deploymentEnvironment = packetApp.deploymentEnvironment || {};
  const frontend = deploymentEnvironment.frontend || {};
  const registryDeployment = packetApp.superAdminRegistry?.deployment || {};
  const registryRelease = packetApp.superAdminRegistry?.release || {};
  const resolvedAppName = appName || lifecycleInput.appName || lifecycleInput.name || packetApp.name || "Example App";
  const resolvedSlug = slug || lifecycleInput.appSlug || lifecycleInput.slug || packetApp.slug || slugify(resolvedAppName);

  const reviewUrl = firstKnownUrl([
    [lifecycleInput.reviewUrl, "input.reviewUrl"],
    [existing.reviewUrl, "packet.deploymentLifecycle.reviewUrl"],
    [env.APP_REVIEW_URL, "APP_REVIEW_URL"],
    [env.OWNER_REVIEW_URL, "OWNER_REVIEW_URL"],
    [previewVerification.reviewUrl, "previewVerification.reviewUrl"],
    [frontend.reviewUrl, "deploymentEnvironment.frontend.reviewUrl"],
    [registryDeployment.reviewUrl, "superAdminRegistry.deployment.reviewUrl"]
  ]);
  const productionUrl = firstKnownValue([
    [lifecycleInput.productionUrl, "input.productionUrl"],
    [existing.productionUrl, "packet.deploymentLifecycle.productionUrl"],
    [env.APP_PRODUCTION_URL, "APP_PRODUCTION_URL"],
    [env.PRODUCTION_URL, "PRODUCTION_URL"],
    [previewVerification.productionUrl, "previewVerification.productionUrl"],
    [frontend.productionUrl, "deploymentEnvironment.frontend.productionUrl"],
    [registryDeployment.productionUrl, "superAdminRegistry.deployment.productionUrl"]
  ]);
  const deploymentUrl = firstKnownUrl([
    [lifecycleInput.deploymentUrl || lifecycleInput.currentDeploymentUrl, "input.deploymentUrl"],
    [existing.deploymentUrl || existing.currentDeploymentUrl, "packet.deploymentLifecycle.deploymentUrl"],
    [env.APP_DEPLOYMENT_URL, "APP_DEPLOYMENT_URL"],
    [env.DEPLOYMENT_URL, "DEPLOYMENT_URL"],
    [relatedPreviewUrl, "relatedPreviewUrl"],
    [previewVerification.previewRootUrl, "previewVerification.previewRootUrl"],
    [frontend.previewUrl, "deploymentEnvironment.frontend.previewUrl"],
    [registryDeployment.previewUrl, "superAdminRegistry.deployment.previewUrl"]
  ]);
  const currentVersion = firstKnownValue([
    [lifecycleInput.currentVersion, "input.currentVersion"],
    [existing.currentVersion, "packet.deploymentLifecycle.currentVersion"],
    [env.APP_CURRENT_VERSION, "APP_CURRENT_VERSION"],
    [previewVerification.currentVersion, "previewVerification.currentVersion"],
    [packetApp.version, "packet.app.version"],
    [deploymentEnvironment.app?.version, "deploymentEnvironment.app.version"],
    [registryRelease.version, "superAdminRegistry.release.version"]
  ]);
  const reviewVersion = firstKnownValue([
    [lifecycleInput.reviewVersion, "input.reviewVersion"],
    [existing.reviewVersion, "packet.deploymentLifecycle.reviewVersion"],
    [env.APP_REVIEW_VERSION, "APP_REVIEW_VERSION"],
    [previewVerification.reviewVersion, "previewVerification.reviewVersion"],
    [currentVersion.value, "currentVersion"]
  ]);
  const productionVersion = firstKnownValue([
    [lifecycleInput.productionVersion, "input.productionVersion"],
    [existing.productionVersion, "packet.deploymentLifecycle.productionVersion"],
    [env.APP_PRODUCTION_VERSION, "APP_PRODUCTION_VERSION"],
    [previewVerification.productionVersion, "previewVerification.productionVersion"],
    [registryRelease.productionVersion, "superAdminRegistry.release.productionVersion"],
    ["not_released", "default"]
  ]);
  const approvalRequired = booleanFrom(
    lifecycleInput.approvalRequired ?? existing.approvalRequired,
    env.OWNER_APPROVAL_REQUIRED || env.PRODUCTION_APPROVAL_REQUIRED,
    true
  );
  const lastDeploymentTimestamp =
    lifecycleInput.lastDeploymentTimestamp ||
    existing.lastDeploymentTimestamp ||
    env.APP_LAST_DEPLOYMENT_TIMESTAMP ||
    previewVerification.checkedAt ||
    new Date().toISOString();
  const deploymentState = normalizeDeploymentState(
    lifecycleInput.deploymentState ||
      existing.deploymentState ||
      env.APP_DEPLOYMENT_STATE ||
      env.DEPLOYMENT_LIFECYCLE_STATE ||
      inferDeploymentState({
        previewVerification,
        reviewUrl: reviewUrl.value,
        deploymentUrl: deploymentUrl.value,
        approvalRequired
      })
  );

  return {
    kind: "deployment_lifecycle",
    schemaVersion: 1,
    app: {
      name: resolvedAppName,
      slug: resolvedSlug
    },
    reviewUrl: reviewUrl.value || "unknown",
    productionUrl: productionUrl.value || "approval-gated",
    deploymentUrl: deploymentUrl.value || "unknown",
    deploymentState,
    currentVersion: currentVersion.value || "v1",
    reviewVersion: reviewVersion.value || currentVersion.value || "v1",
    productionVersion: productionVersion.value || "not_released",
    approvalRequired,
    lastDeploymentTimestamp,
    discovery: {
      reviewUrlKnown: isKnownUrl(reviewUrl.value),
      productionUrlKnown: isKnownUrl(productionUrl.value),
      deploymentUrlKnown: isKnownUrl(deploymentUrl.value),
      reviewUrlSource: reviewUrl.source || null,
      productionUrlSource: productionUrl.source || null,
      deploymentUrlSource: deploymentUrl.source || null
    },
    guardrails: {
      productionDeployBlockedUntilApproval: true,
      paidResourcesBlockedUntilApproval: true,
      migrationsBlockedUntilApproval: true,
      generatedCodeAutoMergeBlocked: true,
      protectedPreviewBypassLinksPubliclyBlocked: true
    }
  };
}

export function validateDeploymentLifecycle(lifecycle) {
  const missing = [];

  for (const [label, value] of [
    ["kind", lifecycle.kind],
    ["app.name", lifecycle.app?.name],
    ["app.slug", lifecycle.app?.slug],
    ["reviewUrl", lifecycle.reviewUrl],
    ["productionUrl", lifecycle.productionUrl],
    ["deploymentUrl", lifecycle.deploymentUrl],
    ["deploymentState", lifecycle.deploymentState],
    ["currentVersion", lifecycle.currentVersion],
    ["reviewVersion", lifecycle.reviewVersion],
    ["productionVersion", lifecycle.productionVersion],
    ["lastDeploymentTimestamp", lifecycle.lastDeploymentTimestamp],
    ["guardrails", lifecycle.guardrails]
  ]) {
    if (!value) missing.push(label);
  }

  if (!DEPLOYMENT_STATES.has(lifecycle.deploymentState)) missing.push(`deploymentState:${lifecycle.deploymentState}`);

  if (!lifecycle.guardrails?.productionDeployBlockedUntilApproval) missing.push("guardrails.productionDeployBlockedUntilApproval");
  if (!lifecycle.guardrails?.paidResourcesBlockedUntilApproval) missing.push("guardrails.paidResourcesBlockedUntilApproval");
  if (!lifecycle.guardrails?.migrationsBlockedUntilApproval) missing.push("guardrails.migrationsBlockedUntilApproval");
  if (!lifecycle.guardrails?.generatedCodeAutoMergeBlocked) missing.push("guardrails.generatedCodeAutoMergeBlocked");

  if (missing.length) throw new Error(`Deployment lifecycle is missing required fields: ${missing.join(", ")}`);
}

export function validDeploymentStates() {
  return new Set(DEPLOYMENT_STATES);
}

export function isKnownUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\/[^/]+/i.test(url) && !url.includes("vercel.app/__/auth") && !url.includes("x-vercel-protection-bypass=");
}

export function ownerReviewRouteUrl(reviewUrl, expectedRoute = "/") {
  const root = stripTrailingSlash(reviewUrl);
  const route = normalizeRoute(expectedRoute);
  if (!root) return "";
  if (route !== "/" && root.endsWith(route)) return root;
  return `${root}${route}`;
}

function inferDeploymentState({ previewVerification, reviewUrl, deploymentUrl, approvalRequired }) {
  if (previewVerification.kind === "preview_verification" && previewVerification.status === "failed") return "failed_needs_fix";
  if (previewVerification.kind === "preview_verification" && previewVerification.status === "passed") {
    return isKnownUrl(reviewUrl) ? "review_ready" : "review_blocked";
  }
  if (isKnownUrl(deploymentUrl)) return "build_preview";
  return approvalRequired ? "production_blocked" : "approved_for_release";
}

function normalizeDeploymentState(value) {
  const state = String(value || "").trim().toLowerCase();
  return DEPLOYMENT_STATES.has(state) ? state : "production_blocked";
}

function firstKnownUrl(values) {
  for (const [rawValue, source] of values) {
    const value = normalizeValue(rawValue);
    if (isKnownUrl(value)) return { value, source };
  }
  return { value: "", source: "" };
}

function firstKnownValue(values) {
  for (const [rawValue, source] of values) {
    const value = normalizeValue(rawValue);
    if (value && !UNKNOWN_VALUES.has(value.toLowerCase())) return { value, source };
  }
  return { value: "", source: "" };
}

function normalizeValue(value) {
  return String(value || "").trim();
}

function booleanFrom(inputValue, envValue, fallback) {
  if (typeof inputValue === "boolean") return inputValue;
  const value = String(envValue || "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "true" || value === "1" || value === "yes";
}

function normalizeRoute(route) {
  const value = String(route || "/").trim();
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function slugify(value) {
  return String(value || "app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "app";
}
