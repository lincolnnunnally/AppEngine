import fs from "node:fs";
import path from "node:path";
import { buildCostGovernance, validateCostGovernance } from "./lib/cost-governance.js";

const combinedOutput = process.env.COST_GOVERNANCE_OUTPUT || "";
const artifactOutput = process.env.COST_GOVERNANCE_ARTIFACT_OUTPUT || "";
const followUpsOutput = process.env.COST_GOVERNANCE_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.COST_GOVERNANCE_INPUT || "";

const input = readInput(inputPath);
const appName = input.appName || input.name || process.env.APP_NAME || "AppEngine";
const slug = input.appSlug || input.slug || process.env.APP_SLUG || slugify(appName);
const sourceIssue = sourceIssueFromEnv() || input.sourceIssue || {};

const costGovernance = buildCostGovernance({
  input,
  context: {
    appName,
    slug,
    sourceIssue,
    currentPhase: input.currentPhase || process.env.BUILD_CURRENT_PHASE,
    nextSafeAction: input.nextSafeAction || process.env.BUILD_NEXT_SAFE_ACTION,
    taskType: input.taskType || process.env.APPENGINE_TASK_TYPE
  }
});

validateCostGovernance(costGovernance);

const followUpTasks = buildFollowUpTasks(costGovernance);
const output = {
  agent: "systems",
  status: costGovernance.nextBudgetAction === "pause" || costGovernance.nextBudgetAction === "request_approval" ? "blocked" : "completed",
  summary: `Created cost governance artifact for ${appName}; budget action: ${costGovernance.nextBudgetAction}.`,
  artifacts: [
    {
      kind: "cost_governance",
      title: `${appName} Cost Governance`,
      content: costGovernance
    }
  ],
  findings: buildFindings(costGovernance),
  followUpTasks,
  handoffTo: handoffForBudgetAction(costGovernance.nextBudgetAction)
};

if (combinedOutput) writeJson(combinedOutput, output);
if (artifactOutput) writeJson(artifactOutput, costGovernance);
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks });

console.log(`cost-governance ok: ${appName} (${slug})`);
console.log(`budget action: ${costGovernance.nextBudgetAction}`);
console.log(`model route: ${costGovernance.modelRouting.taskClass} -> ${costGovernance.modelRouting.recommendedClass}`);

function buildFindings(costGovernance) {
  if (costGovernance.nextBudgetAction === "continue") return [];

  return [
    {
      severity: costGovernance.nextBudgetAction === "continue_with_cheaper_model" ? "medium" : "high",
      title: "AI/API spend threshold reached",
      details: costGovernance.blockedReason || "Cost governance requires attention before continuing.",
      recommendedLabel: costGovernance.nextBudgetAction === "request_approval" ? "ai:review" : "ai:plan"
    }
  ];
}

function buildFollowUpTasks(costGovernance) {
  if (costGovernance.nextBudgetAction === "continue") return [];

  const shared = [
    "",
    "## Cost Governance",
    `- Monthly budget: ${formatMoney(costGovernance.monthlyBudget)}`,
    `- Monthly spend: ${formatMoney(costGovernance.monthlySpend)}`,
    `- Project spend: ${formatMoney(costGovernance.projectSpend)}`,
    `- App spend: ${formatMoney(costGovernance.appSpend)}`,
    `- Issue spend: ${formatMoney(costGovernance.issueSpend)}`,
    `- Remaining budget: ${formatMoney(costGovernance.remainingBudget)}`,
    `- Estimated next spend: ${formatMoney(costGovernance.estimatedNextSpend)}`,
    `- Threshold status: ${costGovernance.thresholdStatus}`,
    `- Task class: ${costGovernance.modelRouting.taskClass}`,
    `- Recommended model class: ${costGovernance.modelRouting.recommendedClass}`,
    "",
    "## Guardrails",
    "- Do not expose secrets, API keys, tokens, or private billing data.",
    "- Do not deploy production.",
    "- Do not create paid resources.",
    "- Do not apply migrations.",
    "- Do not auto-merge generated app code."
  ];

  if (costGovernance.nextBudgetAction === "continue_with_cheaper_model") {
    return [
      {
        title: `[${costGovernance.app.slug}] Continue with cheaper model`,
        recommendedLabel: "ai:plan",
        body: [
          `Continue work for ${costGovernance.app.name}, but route the next task to the cheapest capable model or deterministic script.`,
          costGovernance.blockedReason ? `Blocked reason: ${costGovernance.blockedReason}` : "",
          ...shared
        ].filter(Boolean).join("\n")
      }
    ];
  }

  return [
    {
      title: `[${costGovernance.app.slug}] AI/API budget approval required`,
      recommendedLabel: "ai:review",
      body: [
        `Owner approval is required before ${costGovernance.app.name} continues consuming AI/API credits.`,
        costGovernance.blockedReason ? `Blocked reason: ${costGovernance.blockedReason}` : "",
        "",
        "Record the approved budget, spend cap, or model routing change before continuing.",
        ...shared
      ].filter(Boolean).join("\n")
    }
  ];
}

function handoffForBudgetAction(action) {
  if (action === "continue_with_cheaper_model") return ["planner"];
  if (action === "pause" || action === "request_approval") return ["code_reviewer"];
  return ["planner"];
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

function sourceIssueFromEnv() {
  const source = {
    number: process.env.SOURCE_ISSUE_NUMBER || "",
    title: process.env.SOURCE_ISSUE_TITLE || "",
    url: process.env.SOURCE_ISSUE_URL || ""
  };

  return source.number || source.title || source.url ? source : null;
}

function formatMoney(value) {
  return value === null || value === undefined ? "not configured" : String(value);
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "app";
}
