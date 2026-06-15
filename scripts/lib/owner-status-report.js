import fs from "node:fs";
import path from "node:path";
import { ownerReviewRouteUrl } from "./deployment-lifecycle.js";

const UNKNOWN = new Set(["", "unknown", "pending", "planned", "not_applicable", "none", "null"]);

export function buildOwnerStatusReport({
  buildCompletionPlan = null,
  deploymentLifecycle = null,
  previewVerification = null,
  costGovernance = null,
  orchestrationPlan = null,
  phoneFirstPreflight = null,
  context = {}
} = {}) {
  const app = {
    name: firstKnown([
      buildCompletionPlan?.app?.name,
      deploymentLifecycle?.app?.name,
      previewVerification?.deploymentLifecycle?.app?.name,
      costGovernance?.app?.name,
      context.appName,
      orchestrationPlan?.source?.issueTitle,
      "AppEngine"
    ]),
    slug: firstKnown([
      buildCompletionPlan?.app?.slug,
      deploymentLifecycle?.app?.slug,
      previewVerification?.deploymentLifecycle?.app?.slug,
      costGovernance?.app?.slug,
      context.appSlug,
      "appengine"
    ])
  };
  const lifecycle = deploymentLifecycle || buildCompletionPlan?.deploymentLifecycle || previewVerification?.deploymentLifecycle || null;
  const route = previewVerification?.expectedRoute || context.expectedRoute || "/";
  const reviewUrl = firstKnown([
    buildCompletionPlan?.reviewUrl,
    exactReviewUrl(lifecycle, route),
    previewVerification?.checkedUrl,
    lifecycle?.reviewUrl
  ]);
  const productionUrl = firstKnown([
    buildCompletionPlan?.productionUrl,
    lifecycle?.productionUrl,
    previewVerification?.productionUrl,
    "approval-gated"
  ]);
  const deploymentUrl = firstKnown([
    buildCompletionPlan?.relatedPreviewUrl,
    lifecycle?.deploymentUrl,
    previewVerification?.previewRootUrl
  ]);
  const currentState = firstKnown([
    buildCompletionPlan?.currentState,
    lifecycle?.deploymentState,
    previewVerification?.status === "passed" ? "review_ready" : "",
    previewVerification?.status === "failed" ? "failed_needs_fix" : "",
    "planned"
  ]);
  const deploymentState = firstKnown([buildCompletionPlan?.deploymentState, lifecycle?.deploymentState, "production_blocked"]);
  const currentVersion = firstKnown([
    buildCompletionPlan?.currentVersion,
    lifecycle?.currentVersion,
    previewVerification?.currentVersion,
    "v1"
  ]);
  const nextSafeAction = firstKnown([
    buildCompletionPlan?.nextSafeAction,
    inferNextSafeAction({ currentState, deploymentState, previewVerification, reviewUrl }),
    "create_planning_issue"
  ]);
  const ownerApprovalRequired = Boolean(buildCompletionPlan?.ownerApprovalRequired || lifecycle?.approvalRequired || false);
  const blockers = collectBlockers({
    buildCompletionPlan,
    deploymentLifecycle: lifecycle,
    previewVerification,
    costGovernance,
    reviewUrl
  });
  const sourceIssue = normalizeSourceIssue(
    buildCompletionPlan?.sourceIssue ||
      costGovernance?.sourceIssue ||
      orchestrationPlan?.source ||
      phoneFirstPreflight?.issue ||
      context.sourceIssue
  );
  const evidenceLinks = collectEvidenceLinks({
    buildCompletionPlan,
    previewVerification,
    deploymentLifecycle: lifecycle,
    orchestrationPlan,
    phoneFirstPreflight,
    context
  });
  const status = inferStatus({ blockers, currentState, nextSafeAction });

  return {
    kind: "owner_status_report",
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    app,
    sourceIssue,
    ownerReadable: {
      whereIsTheApp: isKnownUrl(reviewUrl) ? `Review here: ${reviewUrl}` : "Review URL is unknown or blocked.",
      state: `${currentState} / ${deploymentState}`,
      version: currentVersion,
      blockingProgress: blockers.length ? blockers.join("; ") : "No blocker recorded.",
      nextSafeAction
    },
    status,
    currentPhase: buildCompletionPlan?.currentPhase || orchestrationPlan?.workflow?.primaryAgent || phoneFirstPreflight?.selectedMode || "unknown",
    currentState,
    deploymentState,
    currentVersion,
    reviewVersion: firstKnown([lifecycle?.reviewVersion, currentVersion]),
    productionVersion: firstKnown([lifecycle?.productionVersion, "not_released"]),
    reviewUrl,
    productionUrl,
    deploymentUrl,
    checkedUrl: previewVerification?.checkedUrl || null,
    relatedPr: buildCompletionPlan?.relatedPr || context.relatedPr || null,
    ownerApprovalRequired,
    blockedReason: blockers[0] || "",
    blockers,
    nextSafeAction,
    requiredGates: normalizeArray(buildCompletionPlan?.requiredGates),
    passedGates: normalizeArray(buildCompletionPlan?.passedGates),
    failedGates: normalizeArray(buildCompletionPlan?.failedGates),
    previewVerification: previewVerification
      ? {
          status: previewVerification.status,
          summary: previewVerification.summary,
          expectedRoute: previewVerification.expectedRoute,
          checkedUrl: previewVerification.checkedUrl,
          deploymentState: previewVerification.deploymentState,
          failedChecks: normalizeArray(previewVerification.checks).filter((check) => check.status === "failed")
        }
      : null,
    costGovernance: costGovernance
      ? {
          thresholdStatus: costGovernance.thresholdStatus,
          nextBudgetAction: costGovernance.nextBudgetAction,
          remainingBudget: costGovernance.remainingBudget,
          estimatedNextSpend: costGovernance.estimatedNextSpend,
          modelRouting: costGovernance.modelRouting
            ? {
                taskClass: costGovernance.modelRouting.taskClass,
                recommendedClass: costGovernance.modelRouting.recommendedClass
              }
            : null
        }
      : null,
    evidenceLinks,
    sourceArtifacts: {
      buildCompletionPlan: Boolean(buildCompletionPlan),
      deploymentLifecycle: Boolean(lifecycle),
      previewVerification: Boolean(previewVerification),
      costGovernance: Boolean(costGovernance),
      orchestrationPlan: Boolean(orchestrationPlan),
      phoneFirstPreflight: Boolean(phoneFirstPreflight)
    },
    guardrails: {
      productionDeployBlocked: true,
      paidResourcesBlocked: true,
      migrationsBlocked: true,
      autoMergeBlocked: true,
      protectedPreviewBypassLinksPubliclyBlocked: true,
      noSecretsInOutput: true
    }
  };
}

export function validateOwnerStatusReport(report) {
  const missing = [];

  for (const [label, value] of [
    ["kind", report.kind],
    ["app.name", report.app?.name],
    ["app.slug", report.app?.slug],
    ["ownerReadable.whereIsTheApp", report.ownerReadable?.whereIsTheApp],
    ["ownerReadable.state", report.ownerReadable?.state],
    ["ownerReadable.version", report.ownerReadable?.version],
    ["ownerReadable.nextSafeAction", report.ownerReadable?.nextSafeAction],
    ["currentState", report.currentState],
    ["deploymentState", report.deploymentState],
    ["currentVersion", report.currentVersion],
    ["nextSafeAction", report.nextSafeAction],
    ["guardrails", report.guardrails]
  ]) {
    if (value === undefined || value === null || value === "") missing.push(label);
  }

  if (!Array.isArray(report.blockers)) missing.push("blockers");
  if (!Array.isArray(report.evidenceLinks)) missing.push("evidenceLinks");
  if (
    !report.guardrails?.productionDeployBlocked ||
    !report.guardrails?.paidResourcesBlocked ||
    !report.guardrails?.migrationsBlocked ||
    !report.guardrails?.autoMergeBlocked
  ) {
    missing.push("guardrails.blocking");
  }

  if (missing.length) throw new Error(`Owner status report is missing required fields: ${missing.join(", ")}`);
}

export function renderOwnerStatusMarkdown(report) {
  const lines = [
    "## Owner Status Report",
    "",
    `- App: ${report.app.name}`,
    `- State: ${report.ownerReadable.state}`,
    `- Version: ${report.ownerReadable.version}`,
    `- Review: ${report.ownerReadable.whereIsTheApp}`,
    `- Production: ${formatProduction(report)}`,
    `- Next safe action: ${report.ownerReadable.nextSafeAction}`,
    "",
    "### Blockers",
    ...(report.blockers.length ? report.blockers.map((blocker) => `- ${blocker}`) : ["- No blocker recorded."]),
    "",
    "### Evidence",
    ...(report.evidenceLinks.length ? report.evidenceLinks.map((link) => `- ${link.label}: ${link.url || link.value}`) : ["- No evidence link recorded."]),
    "",
    "### Safety",
    "- Production deploy: blocked until owner approval.",
    "- Paid resources: blocked until owner approval.",
    "- Migrations: blocked until owner approval.",
    "- Generated app auto-merge: blocked.",
    "- Protected preview bypass links: not public evidence."
  ];

  return `${lines.join("\n")}\n`;
}

export function collectArtifactsFromAgentRun(agentRunDir, codexOutputFile) {
  const artifacts = {};

  for (const filePath of listJsonFiles(agentRunDir)) {
    absorbArtifact(artifacts, readJsonIfExists(filePath));
  }

  const codexText = codexOutputFile && fs.existsSync(codexOutputFile) ? fs.readFileSync(codexOutputFile, "utf8") : "";
  for (const value of extractJsonBlocks(codexText)) absorbArtifact(artifacts, value);

  return artifacts;
}

export function absorbArtifact(target, value) {
  if (!value || typeof value !== "object") return target;

  if (value.kind) assignArtifact(target, value);
  if (value.content?.kind) assignArtifact(target, value.content);
  if (Array.isArray(value.artifacts)) {
    for (const artifact of value.artifacts) {
      if (artifact?.content?.kind) assignArtifact(target, artifact.content);
      if (artifact?.kind && artifact?.content && !artifact.content.kind) {
        assignArtifact(target, { kind: artifact.kind, ...artifact.content });
      }
    }
  }

  for (const nestedKey of ["buildCompletionPlan", "build_completion_plan", "deploymentLifecycle", "deployment_lifecycle", "previewVerification", "preview_verification", "costGovernance", "cost_governance"]) {
    if (value[nestedKey] && typeof value[nestedKey] === "object") absorbArtifact(target, value[nestedKey]);
  }

  return target;
}

function assignArtifact(target, artifact) {
  const key = String(artifact.kind || "");
  if (key === "build_completion_plan") target.buildCompletionPlan = artifact;
  if (key === "deployment_lifecycle") target.deploymentLifecycle = artifact;
  if (key === "preview_verification") target.previewVerification = artifact;
  if (key === "cost_governance") target.costGovernance = artifact;
  if (key === "orchestration_plan") target.orchestrationPlan = artifact;
  if (key === "phone_first_preflight") target.phoneFirstPreflight = artifact;
}

function listJsonFiles(root) {
  if (!root || !fs.existsSync(root)) return [];
  const files = [];

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) files.push(fullPath);
  }

  return files;
}

function extractJsonBlocks(text) {
  return [...String(text || "").matchAll(/```json\s*([\s\S]*?)```/gi)]
    .map((match) => {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function collectBlockers({ buildCompletionPlan, deploymentLifecycle, previewVerification, costGovernance, reviewUrl }) {
  const blockers = [];
  if (!isKnownUrl(reviewUrl)) blockers.push("Owner review URL is unknown or inaccessible.");
  if (buildCompletionPlan?.blockedReason) blockers.push(buildCompletionPlan.blockedReason);
  for (const gate of normalizeArray(buildCompletionPlan?.failedGates)) {
    blockers.push(gate.reason ? `${gate.id}: ${gate.reason}` : `${gate.id} failed.`);
  }
  if (previewVerification?.status === "failed") {
    blockers.push(previewVerification.summary || "Preview verification failed.");
    for (const check of normalizeArray(previewVerification.checks).filter((item) => item.status === "failed")) {
      blockers.push(`${check.id}: ${check.details}`);
    }
  }
  if (deploymentLifecycle?.deploymentState === "review_blocked") blockers.push("Deployment lifecycle is blocked before owner review.");
  if (deploymentLifecycle?.deploymentState === "failed_needs_fix") blockers.push("Deployment lifecycle failed and needs a focused fix.");
  if (costGovernance?.nextBudgetAction && costGovernance.nextBudgetAction !== "continue") {
    blockers.push(costGovernance.blockedReason || `Cost governance action: ${costGovernance.nextBudgetAction}.`);
  }

  return dedupe(blockers.filter(Boolean));
}

function collectEvidenceLinks({ buildCompletionPlan, previewVerification, deploymentLifecycle, orchestrationPlan, phoneFirstPreflight, context }) {
  const links = [];
  const evidence = normalizeArray(buildCompletionPlan?.evidenceLinks);
  for (const item of evidence) {
    if (typeof item === "string") links.push({ label: "Evidence", value: item });
    else if (item?.url || item?.value) links.push({ label: item.label || item.kind || "Evidence", url: item.url, value: item.value });
  }
  pushLink(links, "Source issue", buildCompletionPlan?.sourceIssue?.url || orchestrationPlan?.source?.issueUrl || phoneFirstPreflight?.issue?.url || context.sourceIssueUrl);
  pushLink(links, "Related PR", buildCompletionPlan?.relatedPr || context.relatedPr);
  pushLink(links, "Review URL", buildCompletionPlan?.reviewUrl || deploymentLifecycle?.reviewUrl);
  pushLink(links, "Checked URL", previewVerification?.checkedUrl);
  pushLink(links, "Workflow run", phoneFirstPreflight?.workflowRunUrl || context.workflowRunUrl);
  return dedupeLinks(links);
}

function exactReviewUrl(lifecycle, route) {
  if (!lifecycle?.reviewUrl) return "";
  return ownerReviewRouteUrl(lifecycle.reviewUrl, route);
}

function inferNextSafeAction({ currentState, deploymentState, previewVerification, reviewUrl }) {
  if (previewVerification?.status === "failed" || deploymentState === "failed_needs_fix") return "create_fix_issue";
  if (!isKnownUrl(reviewUrl)) return "create_fix_issue";
  if (currentState === "review_ready" || deploymentState === "review_ready") return "await_owner_review";
  if (currentState === "preview_pending") return "verify_preview";
  if (currentState === "draft_pr_open") return "wait_for_preview";
  if (currentState === "ready_for_build") return "create_implementation_issue";
  return "create_planning_issue";
}

function inferStatus({ blockers, currentState, nextSafeAction }) {
  if (blockers.length || nextSafeAction.includes("fix") || nextSafeAction.includes("approval") || nextSafeAction.includes("pause")) return "blocked";
  if (currentState === "review_ready" || nextSafeAction === "await_owner_review") return "ready_for_owner_review";
  return "in_progress";
}

function normalizeSourceIssue(source) {
  if (!source || typeof source !== "object") return {};
  return {
    number: source.number || source.issueNumber || null,
    title: source.title || source.issueTitle || null,
    url: source.url || source.issueUrl || source.htmlUrl || null
  };
}

function formatProduction(report) {
  if (report.deploymentState !== "production_live") return "blocked/not live yet";
  return report.productionUrl || "live";
}

function firstKnown(values) {
  for (const raw of values) {
    const value = String(raw || "").trim();
    if (value && !UNKNOWN.has(value.toLowerCase())) return value;
  }
  return "unknown";
}

function isKnownUrl(value) {
  return /^https?:\/\/[^/]+/i.test(String(value || ""));
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function pushLink(links, label, url) {
  if (url) links.push({ label, url });
}

function dedupe(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function dedupeLinks(links) {
  const seen = new Set();
  return links.filter((link) => {
    const key = `${link.label}:${link.url || link.value || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}
