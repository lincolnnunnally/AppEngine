import fs from "node:fs";
import path from "node:path";

const combinedOutput = process.env.APP_PORTFOLIO_REGISTRY_OUTPUT || "";
const registryOutput = process.env.APP_PORTFOLIO_REGISTRY_ARTIFACT_OUTPUT || "";
const markdownOutput = process.env.APP_PORTFOLIO_REGISTRY_MARKDOWN_OUTPUT || "";
const followUpsOutput = process.env.APP_PORTFOLIO_REGISTRY_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.APP_PORTFOLIO_REGISTRY_INPUT || "";

const input = readInput(inputPath);
const appsInput = Array.isArray(input.apps) ? input.apps : defaultAppsFromEnv(input);
const generatedAt = input.generatedAt || new Date().toISOString();
const owner = input.owner || process.env.APP_PORTFOLIO_OWNER || "Lincoln";

const registry = buildPortfolioRegistry({
  owner,
  generatedAt,
  apps: appsInput
});
const followUpTasks = buildFollowUpTasks(registry);

const output = {
  agent: "planner",
  status: followUpTasks.length ? "needs_follow_up" : "completed",
  summary: `Created App Portfolio Registry for ${registry.summary.totalApps} managed app${registry.summary.totalApps === 1 ? "" : "s"}.`,
  artifacts: [
    {
      kind: "app_portfolio_registry",
      title: "App Portfolio Registry",
      content: registry
    }
  ],
  findings: [],
  followUpTasks,
  handoffTo: ["monitor", "planner", "code_reviewer"]
};

validatePortfolioRegistry(registry);

if (combinedOutput) writeJson(combinedOutput, output);
if (registryOutput) writeJson(registryOutput, registry);
if (markdownOutput) writeText(markdownOutput, renderPortfolioMarkdown(registry));
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks });

console.log(`app-portfolio-registry ok: ${registry.summary.totalApps} app${registry.summary.totalApps === 1 ? "" : "s"}`);
console.log(`blocked: ${registry.summary.blockedApps}`);

function buildPortfolioRegistry({ owner = "Lincoln", generatedAt = new Date().toISOString(), apps = [] } = {}) {
  const normalizedApps = apps.map((app) => normalizeAppEntry(app, generatedAt));

  return {
    kind: "app_portfolio_registry",
    schemaVersion: 1,
    generatedAt,
    owner,
    summary: summarizeApps(normalizedApps),
    apps: normalizedApps,
    guardrails: {
      noSecretsInRegistry: true,
      noPrivateUserData: true,
      productionApprovalRequired: true,
      protectedPreviewBypassLinksBlocked: true,
      appBoundariesRequired: true
    }
  };
}

function validatePortfolioRegistry(registry) {
  const missing = [];

  for (const [label, value] of [
    ["kind", registry.kind],
    ["schemaVersion", registry.schemaVersion],
    ["generatedAt", registry.generatedAt],
    ["owner", registry.owner],
    ["summary", registry.summary],
    ["guardrails", registry.guardrails]
  ]) {
    if (value === undefined || value === null || value === "") missing.push(label);
  }

  if (!Array.isArray(registry.apps)) missing.push("apps");

  for (const [index, app] of (registry.apps || []).entries()) {
    for (const [label, value] of [
      ["name", app.name],
      ["slug", app.slug],
      ["reviewUrl", app.reviewUrl],
      ["productionUrl", app.productionUrl],
      ["currentVersion", app.currentVersion],
      ["deploymentState", app.deploymentState],
      ["buildState", app.buildState],
      ["nextSafeAction", app.nextSafeAction]
    ]) {
      if (value === undefined || value === null || value === "") missing.push(`apps[${index}].${label}`);
    }

    for (const [label, value] of [
      ["sourceOfTruthFiles", app.sourceOfTruthFiles],
      ["linkedIssues", app.linkedIssues],
      ["linkedPRs", app.linkedPRs],
      ["blockers", app.blockers],
      ["evidenceLinks", app.evidenceLinks]
    ]) {
      if (!Array.isArray(value)) missing.push(`apps[${index}].${label}`);
    }

    if (app.deploymentState === "review_ready" && !isKnownUrl(app.reviewUrl)) {
      missing.push(`apps[${index}].reviewUrl.review_ready`);
    }

    if (app.deploymentState === "production_live" && !isKnownUrl(app.productionUrl)) {
      missing.push(`apps[${index}].productionUrl.production_live`);
    }
  }

  if (
    !registry.guardrails?.noSecretsInRegistry ||
    !registry.guardrails?.noPrivateUserData ||
    !registry.guardrails?.productionApprovalRequired ||
    !registry.guardrails?.protectedPreviewBypassLinksBlocked ||
    !registry.guardrails?.appBoundariesRequired
  ) {
    missing.push("guardrails.required");
  }

  if (missing.length) throw new Error(`App Portfolio Registry is missing required fields: ${missing.join(", ")}`);
}

function renderPortfolioMarkdown(registry) {
  const lines = [
    "# App Portfolio Registry",
    "",
    `Generated: ${registry.generatedAt}`,
    `Owner: ${registry.owner}`,
    "",
    "## Summary",
    "",
    `- Apps tracked: ${registry.summary.totalApps}`,
    `- Review ready: ${registry.summary.reviewReadyApps}`,
    `- Production live: ${registry.summary.productionLiveApps}`,
    `- Blocked: ${registry.summary.blockedApps}`,
    "",
    "## Apps"
  ];

  for (const app of registry.apps) {
    lines.push(
      "",
      `### ${app.name}`,
      "",
      `- Slug: ${app.slug}`,
      `- Review: ${app.reviewUrl}`,
      `- Production: ${app.productionUrl}`,
      `- Version: ${app.currentVersion}`,
      `- State: ${app.deploymentState} / ${app.buildState}`,
      `- Next safe action: ${app.nextSafeAction}`,
      `- Source files: ${app.sourceOfTruthFiles.length ? app.sourceOfTruthFiles.join(", ") : "missing"}`,
      `- Linked issues: ${app.linkedIssues.length ? app.linkedIssues.map(formatLinkedItem).join(", ") : "none"}`,
      `- Linked PRs: ${app.linkedPRs.length ? app.linkedPRs.map(formatLinkedItem).join(", ") : "none"}`,
      `- Blockers: ${app.blockers.length ? app.blockers.join("; ") : "none"}`
    );
  }

  lines.push(
    "",
    "## Safety",
    "",
    "- No secrets in registry.",
    "- No private user data in registry.",
    "- Production remains approval-gated.",
    "- Protected preview bypass/share links are not valid owner review URLs.",
    "- App boundaries remain required."
  );

  return `${lines.join("\n")}\n`;
}

function normalizeAppEntry(app, generatedAt) {
  const slug = firstKnown([app.slug, app.app?.slug, slugify(app.name || app.app?.name || "app")]);
  const name = firstKnown([app.name, app.app?.name, titleFromSlug(slug)]);
  const deploymentLifecycle = app.deploymentLifecycle || app.deployment_lifecycle || {};
  const buildCompletionPlan = app.buildCompletionPlan || app.build_completion_plan || {};
  const ownerStatusReport = app.ownerStatusReport || app.owner_status_report || {};
  const superAdminRegistryEntry = app.superAdminRegistryEntry || app.super_admin_registry_entry || {};

  const reviewUrl = firstKnown([
    app.reviewUrl,
    buildCompletionPlan.reviewUrl,
    deploymentLifecycle.reviewUrl,
    ownerStatusReport.reviewUrl,
    superAdminRegistryEntry.deployment?.previewUrl,
    "unknown"
  ]);
  const productionUrl = firstKnown([
    app.productionUrl,
    buildCompletionPlan.productionUrl,
    deploymentLifecycle.productionUrl,
    ownerStatusReport.productionUrl,
    superAdminRegistryEntry.deployment?.productionUrl,
    "approval-gated"
  ]);
  const deploymentState = normalizeState(
    firstKnown([app.deploymentState, buildCompletionPlan.deploymentState, deploymentLifecycle.deploymentState, ownerStatusReport.deploymentState, "unknown"]),
    allowedDeploymentStates()
  );
  const buildState = normalizeState(
    firstKnown([app.buildState, buildCompletionPlan.currentState, ownerStatusReport.currentState, superAdminRegistryEntry.release?.gateStatus, "unknown"]),
    allowedBuildStates()
  );

  return {
    name,
    slug,
    reviewUrl,
    productionUrl,
    currentVersion: firstKnown([
      app.currentVersion,
      app.version,
      buildCompletionPlan.currentVersion,
      deploymentLifecycle.currentVersion,
      ownerStatusReport.currentVersion,
      superAdminRegistryEntry.release?.version,
      "v1"
    ]),
    deploymentState,
    buildState,
    nextSafeAction: normalizeState(
      firstKnown([app.nextSafeAction, buildCompletionPlan.nextSafeAction, ownerStatusReport.nextSafeAction, inferNextSafeAction({ reviewUrl, deploymentState, buildState })]),
      allowedNextSafeActions()
    ),
    sourceOfTruthFiles: normalizeStrings([
      ...normalizeArray(app.sourceOfTruthFiles),
      ...normalizeArray(app.source_of_truth_files),
      superAdminRegistryEntry.app?.charterPath,
      app.charterPath
    ]),
    linkedIssues: normalizeLinkedItems(app.linkedIssues || app.issues),
    linkedPRs: normalizeLinkedItems(app.linkedPRs || app.pullRequests || app.prs),
    blockers: collectBlockers({ app, reviewUrl, productionUrl, deploymentState, buildState }),
    evidenceLinks: normalizeLinkedItems(app.evidenceLinks || app.evidence),
    lastUpdated: firstKnown([app.lastUpdated, ownerStatusReport.generatedAt, deploymentLifecycle.lastDeploymentTimestamp, generatedAt])
  };
}

function summarizeApps(apps) {
  return {
    totalApps: apps.length,
    reviewReadyApps: apps.filter((app) => app.deploymentState === "review_ready").length,
    productionLiveApps: apps.filter((app) => app.deploymentState === "production_live").length,
    blockedApps: apps.filter((app) => app.blockers.length || app.deploymentState.includes("blocked") || app.buildState.includes("blocked") || app.deploymentState === "failed_needs_fix" || app.buildState === "failed_needs_fix").length,
    byDeploymentState: countBy(apps, "deploymentState"),
    byBuildState: countBy(apps, "buildState"),
    nextSafeActions: countBy(apps, "nextSafeAction")
  };
}

function buildFollowUpTasks(registry) {
  const tasks = [];

  for (const app of registry.apps) {
    if (!app.sourceOfTruthFiles.length) {
      tasks.push(followUp(app, "Add missing source-of-truth files", "Document the app charter, packet, vNext packet, or other source-of-truth files that explain this app's current portfolio state."));
    }

    if (app.deploymentState === "review_ready" && !isKnownUrl(app.reviewUrl)) {
      tasks.push(followUp(app, "Fix missing owner review URL", "The app is marked review-ready, but the portfolio registry does not have a normal public owner review URL."));
    }

    if (app.deploymentState === "production_live" && !isKnownUrl(app.productionUrl)) {
      tasks.push(followUp(app, "Fix missing production URL", "The app is marked production-live, but the portfolio registry does not have an approved production URL."));
    }

    if (!app.linkedIssues.length && !app.linkedPRs.length) {
      tasks.push(followUp(app, "Link app issues and pull requests", "Connect the active GitHub issues and pull requests that prove this app's current state."));
    }
  }

  return tasks;
}

function followUp(app, title, detail) {
  return {
    title: `[${app.slug}] Portfolio registry: ${title}`,
    recommendedLabel: "ai:plan",
    body: [
      `Update the App Portfolio Registry evidence for ${app.name}.`,
      "",
      "## Problem",
      detail,
      "",
      "## Current Portfolio Entry",
      `- App: ${app.name}`,
      `- Slug: ${app.slug}`,
      `- Review URL: ${app.reviewUrl}`,
      `- Production URL: ${app.productionUrl}`,
      `- Version: ${app.currentVersion}`,
      `- Deployment state: ${app.deploymentState}`,
      `- Build state: ${app.buildState}`,
      `- Next safe action: ${app.nextSafeAction}`,
      "",
      "## Required Source Of Truth To Load",
      "- source-of-truth/00-why-we-build.md",
      "- source-of-truth/01-ecosystem-philosophy.md",
      "- source-of-truth/02-global-principles.md",
      "- source-of-truth/03-life-produces-life.md",
      "- source-of-truth/04-app-purpose-rules.md",
      "- source-of-truth/05-ecosystem-design-gates.md",
      "- source-of-truth/app-portfolio-registry.md",
      "- relevant app charter",
      "- relevant build_completion_plan, deployment_lifecycle, owner_status_report, issues, and PRs",
      "",
      "## Guardrails",
      "- Do not expose secrets, private user data, protected preview bypass links, or private billing details.",
      "- Do not deploy production, create paid resources, apply migrations, or auto-merge generated app code."
    ].join("\n")
  };
}

function collectBlockers({ app, reviewUrl, productionUrl, deploymentState, buildState }) {
  const blockers = [...normalizeStrings(app.blockers)];
  if (deploymentState === "review_ready" && !isKnownUrl(reviewUrl)) blockers.push("Review-ready app is missing an owner review URL.");
  if (deploymentState === "production_live" && !isKnownUrl(productionUrl)) blockers.push("Production-live app is missing an approved production URL.");
  if (!normalizeArray(app.sourceOfTruthFiles).length && !normalizeArray(app.source_of_truth_files).length && !app.charterPath) blockers.push("Source-of-truth files are missing.");
  if (deploymentState === "failed_needs_fix" || buildState === "failed_needs_fix") blockers.push("Focused fix is required.");
  return dedupe(blockers);
}

function defaultAppsFromEnv(input) {
  if (input.name || process.env.APP_NAME) {
    return [
      {
        name: input.name || process.env.APP_NAME,
        slug: input.slug || process.env.APP_SLUG,
        reviewUrl: input.reviewUrl || process.env.APP_REVIEW_URL,
        productionUrl: input.productionUrl || process.env.APP_PRODUCTION_URL,
        currentVersion: input.currentVersion || process.env.APP_CURRENT_VERSION,
        deploymentState: input.deploymentState || process.env.APP_DEPLOYMENT_STATE,
        buildState: input.buildState || process.env.APP_BUILD_STATE,
        nextSafeAction: input.nextSafeAction || process.env.APP_NEXT_SAFE_ACTION,
        sourceOfTruthFiles: input.sourceOfTruthFiles || listFromEnv("APP_SOURCE_OF_TRUTH_FILES"),
        linkedIssues: input.linkedIssues || linkedItemsFromEnv("APP_LINKED_ISSUES"),
        linkedPRs: input.linkedPRs || linkedItemsFromEnv("APP_LINKED_PRS")
      }
    ];
  }

  return [];
}

function readInput(filePath) {
  if (!filePath) return {};
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return {};
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, value);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null) : [];
}

function normalizeStrings(value) {
  return dedupe(normalizeArray(value).map((item) => String(item).trim()).filter(Boolean));
}

function normalizeLinkedItems(value) {
  return normalizeArray(value).map((item) => {
    if (typeof item === "string") return { title: item, url: "" };
    return {
      number: item.number || item.id || "",
      title: item.title || item.name || item.label || "",
      url: item.url || item.htmlUrl || "",
      state: item.state || ""
    };
  });
}

function linkedItemsFromEnv(name) {
  return listFromEnv(name).map((item) => {
    const [number, title, url, state] = item.split("|").map((part) => part.trim());
    return { number, title, url, state };
  });
}

function listFromEnv(name, fallback = []) {
  const raw = process.env[name] || "";
  if (!raw.trim()) return fallback;
  return raw
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstKnown(values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function normalizeState(value, allowed) {
  return allowed.includes(value) ? value : "unknown";
}

function allowedDeploymentStates() {
  return ["build_preview", "review_ready", "review_blocked", "approved_for_release", "production_live", "production_blocked", "failed_needs_fix", "unknown"];
}

function allowedBuildStates() {
  return ["planned", "ready_for_build", "draft_pr_open", "preview_pending", "preview_verified", "review_blocked", "release_blocked", "owner_approval_required", "ready_for_vnext", "failed_needs_fix", "unknown"];
}

function allowedNextSafeActions() {
  return ["create_planning_issue", "create_implementation_issue", "create_draft_pr", "wait_for_preview", "verify_preview", "verify_review_url", "run_review_gates", "create_fix_issue", "await_owner_review", "stop_for_owner_approval", "pause_for_budget", "request_budget_approval", "prepare_release_gate", "create_vnext_packet", "unknown"];
}

function inferNextSafeAction({ reviewUrl, deploymentState, buildState }) {
  if (deploymentState === "failed_needs_fix" || buildState === "failed_needs_fix") return "create_fix_issue";
  if (deploymentState === "review_ready" && isKnownUrl(reviewUrl)) return "await_owner_review";
  if (buildState === "preview_pending") return "verify_preview";
  if (buildState === "ready_for_build") return "create_implementation_issue";
  if (buildState === "ready_for_vnext") return "create_vnext_packet";
  if (deploymentState === "production_blocked" || buildState === "release_blocked") return "stop_for_owner_approval";
  return "create_planning_issue";
}

function isKnownUrl(value) {
  return /^https?:\/\//i.test(String(value || "")) && !/vercel\.live\/open-feedback|bypass|share/i.test(String(value || ""));
}

function countBy(apps, key) {
  return apps.reduce((counts, app) => {
    const value = app[key] || "unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function formatLinkedItem(item) {
  if (item.number && item.url) return `#${item.number}`;
  if (item.number) return `#${item.number}`;
  return item.title || item.url || "linked item";
}

function titleFromSlug(slug) {
  return String(slug)
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "app";
}

function dedupe(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
