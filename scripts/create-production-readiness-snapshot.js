import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.PRODUCTION_READINESS_SNAPSHOT_INPUT || "";
const outputPath = process.env.PRODUCTION_READINESS_SNAPSHOT_OUTPUT || "agent-run/production-readiness-snapshot.json";
const markdownOutputPath = process.env.PRODUCTION_READINESS_SNAPSHOT_MARKDOWN_OUTPUT || "";

const input = inputPath && fs.existsSync(path.resolve(inputPath)) ? JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8")) : {};
const artifact = createProductionReadinessSnapshot(input, new Date(input.now || Date.now()));

writeJson(outputPath, artifact);
if (markdownOutputPath) writeText(markdownOutputPath, renderMarkdown(artifact));

console.log(`production-readiness-snapshot ok: ${artifact.status}`);
console.log(`next: ${artifact.nextSafeAction}`);

function createProductionReadinessSnapshot(input, now) {
  const categories = normalizeCategories(input.categories || {});
  const blockers = collectBlockers(categories, input.remainingBlockers || []);
  const status = decideStatus(categories, blockers);
  const nextSafeAction = chooseNextSafeAction(status, categories, blockers, input.nextSafeAction);
  const highestLeverageImprovements = normalizeImprovements(input.highestLeverageImprovements || [], categories, blockers);

  return {
    kind: "production_readiness_snapshot",
    schemaVersion: 1,
    id: `production_readiness_snapshot_${now.getTime().toString(36)}`,
    createdAt: input.createdAt || now.toISOString(),
    system: {
      name: input.system?.name || "AppEngine",
      slug: input.system?.slug || "appengine"
    },
    status,
    confidence: input.confidence || confidenceFor(status),
    categories,
    remainingBlockers: blockers,
    highestLeverageImprovements,
    nextSafeAction,
    evidenceLinks: normalizeStringList(input.evidenceLinks || input.sourceFiles || [
      "source-of-truth/production-readiness-snapshot.md",
      "agents/context/output-contracts.md",
      "source-of-truth/context-checklist.md"
    ]),
    ownerReadableSummary: buildOwnerSummary(status, blockers, highestLeverageImprovements, nextSafeAction),
    guardrails: defaultGuardrails()
  };
}

function normalizeCategories(categories) {
  const defaults = {
    authAdminProtection: "needs_review",
    persistence: "needs_review",
    privacySecurity: "needs_review",
    deploymentReadiness: "needs_review",
    monitoringLogging: "needs_review",
    costResourceRisk: "needs_review",
    userFacingUx: "needs_review"
  };

  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
      const input = categories[key] || {};
      const status = normalizeCategoryStatus(input.status || fallback);

      return [
        key,
        {
          status,
          summary: String(input.summary || defaultCategorySummary(key, status)),
          evidence: normalizeStringList(input.evidence || []),
          blocker: status === "blocked" ? String(input.blocker || defaultCategoryBlocker(key)) : String(input.blocker || "")
        }
      ];
    })
  );
}

function normalizeCategoryStatus(value) {
  const allowed = ["ready", "needs_review", "blocked"];
  return allowed.includes(value) ? value : "needs_review";
}

function collectBlockers(categories, explicitBlockers) {
  return [
    ...normalizeStringList(explicitBlockers),
    ...Object.entries(categories)
      .filter(([, category]) => category.status === "blocked")
      .map(([key, category]) => `${formatCategory(key)}: ${category.blocker || category.summary}`)
  ];
}

function decideStatus(categories, blockers) {
  if (blockers.length) return "blocked";
  const statuses = Object.values(categories).map((category) => category.status);
  if (statuses.every((status) => status === "ready")) return "ready_for_limited_owner_review";
  if (statuses.some((status) => status === "ready")) return "partially_ready";
  return "not_ready";
}

function chooseNextSafeAction(status, categories, blockers, override) {
  if (override) return String(override);
  if (blockers.length) return `Resolve blocker: ${blockers[0]}`;

  const nextCategory = Object.entries(categories).find(([, category]) => category.status !== "ready");
  if (nextCategory) return `Improve ${formatCategory(nextCategory[0])} before production readiness.`;

  if (status === "ready_for_limited_owner_review") return "Owner may review readiness evidence, but production remains blocked until explicit release approval.";

  return "Create a focused readiness improvement PR before production use.";
}

function normalizeImprovements(improvements, categories, blockers) {
  const provided = normalizeStringList(improvements);
  if (provided.length) return provided;
  if (blockers.length) return [`Remove blocker: ${blockers[0]}`];

  return Object.entries(categories)
    .filter(([, category]) => category.status !== "ready")
    .map(([key]) => `Improve ${formatCategory(key)}`)
    .slice(0, 5);
}

function buildOwnerSummary(status, blockers, improvements, nextSafeAction) {
  const blockerText = blockers.length ? `Blockers: ${blockers.join(" | ")}.` : "No hard blocker was recorded in this snapshot.";
  const improvementText = improvements.length ? `Highest leverage: ${improvements[0]}.` : "No improvement was suggested.";

  return `Production readiness is ${status.replace(/_/g, " ")}. ${blockerText} ${improvementText} Next safe action: ${nextSafeAction}`;
}

function renderMarkdown(artifact) {
  return [
    "# Production Readiness Snapshot",
    "",
    `Status: ${artifact.status}`,
    `Confidence: ${artifact.confidence}`,
    "",
    "## Categories",
    ...Object.entries(artifact.categories).map((entry) => `- ${formatCategory(entry[0])}: ${entry[1].status} - ${entry[1].summary}`),
    "",
    "## Remaining Blockers",
    ...(artifact.remainingBlockers.length ? artifact.remainingBlockers.map((blocker) => `- ${blocker}`) : ["- None recorded."]),
    "",
    "## Next Safe Action",
    artifact.nextSafeAction,
    "",
    "## Guardrails",
    "- Production remains blocked.",
    "- Paid resources remain blocked.",
    "- Migrations remain blocked.",
    "- Secrets/env changes remain blocked."
  ].join("\n");
}

function confidenceFor(status) {
  if (status === "ready_for_limited_owner_review") return "medium";
  if (status === "blocked") return "high";
  return "medium";
}

function defaultCategorySummary(key, status) {
  return `${formatCategory(key)} is ${status.replace(/_/g, " ")}.`;
}

function defaultCategoryBlocker(key) {
  return `${formatCategory(key)} has a blocker that must be resolved before production readiness.`;
}

function formatCategory(value) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()).trim();
}

function normalizeStringList(values) {
  return Array.isArray(values) ? values.map((value) => String(value).trim()).filter(Boolean) : [];
}

function defaultGuardrails() {
  return {
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noGitHubIssueCreation: true,
    noLabelChanges: true,
    noCodexAutoExecution: true,
    noGeneratedAppAutoMerge: true
  };
}

function writeJson(filePath, value) {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(path.resolve(filePath), value, "utf8");
}
