import fs from "node:fs";
import path from "node:path";

const combinedOutput = process.env.PROVIDER_COST_OUTPUT || "";
const reviewOutput = process.env.PROVIDER_COST_REVIEW_OUTPUT || "";
const followUpsOutput = process.env.PROVIDER_COST_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.PROVIDER_COST_INPUT || "";

const input = readInput(inputPath);
const appName = input.name || process.env.APP_NAME || "Example App";
const slug = input.slug || process.env.APP_SLUG || slugify(appName);
const monthlyCeiling = input.monthlyCeiling || process.env.APP_MONTHLY_COST_CEILING || "owner-defined";
const backendRequired = booleanFrom(input.backendRequired, process.env.APP_BACKEND_REQUIRED, false);
const fileUploadsUsed = booleanFrom(input.fileUploadsUsed, process.env.APP_FILE_UPLOADS_USED, false);
const paymentsUsed = booleanFrom(input.paymentsUsed, process.env.APP_PAYMENTS_USED, false);
const aiUsed = booleanFrom(input.aiUsed, process.env.APP_AI_USED, false);

const providerCostReview =
  input.providerCostReview ||
  buildProviderCostReview({
    appName,
    slug,
    monthlyCeiling,
    backendRequired,
    fileUploadsUsed,
    paymentsUsed,
    aiUsed
  });

const followUpTasks = buildFollowUpTasks({ appName, slug, providerCostReview });
const output = {
  agent: "systems",
  status: "needs_follow_up",
  summary: `Created provider/cost review for ${appName}.`,
  artifacts: [
    {
      kind: "provider_cost_review",
      title: `${appName} Provider and Cost Review`,
      content: providerCostReview
    }
  ],
  findings: [],
  followUpTasks,
  handoffTo: ["planner", "builder", "workflow_tester"]
};

validateProviderCostReview(providerCostReview);

if (combinedOutput) writeJson(combinedOutput, output);
if (reviewOutput) writeJson(reviewOutput, providerCostReview);
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks });

console.log(`provider-cost ok: ${appName} (${slug})`);
console.log(`providers: ${providerCostReview.providers.map((item) => item.area).join(", ")}`);

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
      provider("email_notifications", "approved transactional provider", "Use only when the workflow sends messages.", false),
      provider("payments", paymentsUsed ? "Stripe" : "not_required_initially", paymentsUsed ? "Create payment resources only after billing scope and test mode are approved." : "Do not create payment provider until billing is used.", paymentsUsed),
      provider("ai_models", aiUsed ? "OpenAI or approved model provider" : "not_required_initially", aiUsed ? "Use existing approved project/key routing and cap usage during preview." : "Do not add model costs until model calls are required.", aiUsed),
      provider("monitoring_logs", "Vercel/Render/Super Admin", "Use built-in logs and health checks before adding paid observability.", false)
    ],
    checks: [
      check("reuse_before_create", "Can this app reuse an existing approved provider resource?"),
      check("preview_before_paid", "Can preview run free or low-cost before production resources are approved?"),
      check("database_branch_before_project", "Can the app use a branch or app-scoped database instead of a new paid project?"),
      check("backend_only_if_required", "Is an always-on backend truly required for this version?"),
      check("storage_email_payments_ai_only_if_used", "Are paid add-ons only included when the app uses them?"),
      check("owner_approval_before_paid", "Is owner approval required before paid production resources are created?")
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

function check(id, question) {
  return { id, status: "required", question };
}

function buildFollowUpTasks({ appName, slug, providerCostReview }) {
  return [
    {
      title: `[${slug}] Provider and cost review`,
      recommendedLabel: "ai:plan",
      body: [
        `Run provider and cost review for ${appName}.`,
        "",
        "## Cost Posture",
        `- Preview: ${providerCostReview.costPosture.preview}`,
        `- Production: ${providerCostReview.costPosture.production}`,
        `- Monthly ceiling: ${providerCostReview.costPosture.monthlyCeiling}`,
        `- Upgrade trigger: ${providerCostReview.costPosture.upgradeTrigger}`,
        "",
        "## Providers",
        providerCostReview.providers.map((item) => `- ${item.area}: ${item.preferred}; ${item.strategy}`).join("\n"),
        "",
        "## Guardrails",
        "- Do not create paid provider resources without owner approval.",
        "- Prefer reuse, branches, preview resources, and free/low-cost defaults before new services.",
        "- Create ai:fix or ai:plan follow-up work when provider choice is unclear."
      ].join("\n")
    },
    {
      title: `[${slug}] Provider provisioning approval`,
      recommendedLabel: "ai:review",
      body: [
        `Review provider provisioning approval for ${appName}.`,
        "",
        "## Approval Checks",
        "- Are any new paid Vercel, Render, database, storage, email, payment, AI, analytics, or monitoring resources needed?",
        "- Can existing resources or preview branches be reused?",
        "- Is production cost approval recorded?",
        "",
        "## Guardrails",
        "- Block provisioning if cost owner, monthly ceiling, or upgrade trigger is missing.",
        "- Do not include secret values or private billing details."
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

  for (const [label, value] of [
    ["providers", review.providers],
    ["checks", review.checks]
  ]) {
    if (!Array.isArray(value) || value.length === 0) missing.push(label);
  }

  for (const area of ["frontend", "api_backend", "database", "monitoring_logs"]) {
    if (!review.providers?.some((item) => item.area === area)) missing.push(`providers.${area}`);
  }

  if (!review.guardrails?.blocksProvisioning || !review.guardrails?.blocksReleaseGateApproval || !review.guardrails?.noPaidResourcesWithoutApproval) {
    missing.push("guardrails");
  }

  if (missing.length) throw new Error(`Provider/cost review is missing required fields: ${missing.join(", ")}`);
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
