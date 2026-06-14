const CHEAP_TASKS = new Set([
  "artifact_cleanup",
  "formatting",
  "issue_routing",
  "label_selection",
  "metadata_cleanup",
  "prompt_packaging"
]);

const MEDIUM_TASKS = new Set([
  "review",
  "summarization",
  "validation",
  "workflow_test",
  "source_check",
  "preview_verification"
]);

const EXPENSIVE_TASKS = new Set([
  "architecture",
  "debugging",
  "design_generation",
  "implementation",
  "mvp_build",
  "schema_design",
  "ui_design"
]);

export function buildCostGovernance({ input = {}, context = {}, env = process.env } = {}) {
  const monthlyBudget = numberOrNull(input.monthlyBudget ?? env.APPENGINE_MONTHLY_AI_BUDGET);
  const monthlySpend = numberOrZero(input.monthlySpend ?? env.APPENGINE_MONTHLY_AI_SPEND);
  const projectSpend = numberOrZero(input.projectSpend ?? env.APPENGINE_PROJECT_AI_SPEND);
  const appSpend = numberOrZero(input.appSpend ?? env.APPENGINE_APP_AI_SPEND);
  const issueSpend = numberOrZero(input.issueSpend ?? env.APPENGINE_ISSUE_AI_SPEND);
  const taskType = normalizeTaskType(input.taskType || context.taskType || context.currentPhase || context.nextSafeAction || "issue_routing");
  const taskClass = classifyTask(taskType);
  const estimatedNextSpend = numberOrZero(input.estimatedNextSpend ?? env.APPENGINE_ESTIMATED_NEXT_AI_SPEND);
  const thresholds = normalizeThresholds(input.spendThresholds || {}, env);
  const budgetConfigured = typeof monthlyBudget === "number" && Number.isFinite(monthlyBudget) && monthlyBudget > 0;
  const remainingBudget = budgetConfigured ? roundCurrency(Math.max(monthlyBudget - monthlySpend, 0)) : null;
  const projectedMonthlySpend = budgetConfigured ? roundCurrency(monthlySpend + estimatedNextSpend) : null;
  const projectedSpendRatio = budgetConfigured ? projectedMonthlySpend / monthlyBudget : null;
  const thresholdStatus = determineThresholdStatus({
    budgetConfigured,
    projectedSpendRatio,
    monthlyBudget,
    estimatedNextSpend,
    remainingBudget,
    thresholds
  });
  const nextBudgetAction = determineNextBudgetAction({
    taskClass,
    thresholdStatus,
    budgetConfigured,
    enforcementMode: normalizeEnforcementMode(input.enforcementMode || env.APPENGINE_COST_GOVERNANCE_MODE)
  });

  return {
    kind: "cost_governance",
    schemaVersion: 1,
    app: {
      name: context.appName || input.appName || env.APP_NAME || "Example App",
      slug: context.slug || input.appSlug || env.APP_SLUG || "example-app"
    },
    sourceIssue: normalizeSourceIssue(context.sourceIssue || input.sourceIssue),
    monthlyBudget,
    monthlySpend: roundCurrency(monthlySpend),
    projectSpend: roundCurrency(projectSpend),
    appSpend: roundCurrency(appSpend),
    issueSpend: roundCurrency(issueSpend),
    remainingBudget,
    estimatedNextSpend: roundCurrency(estimatedNextSpend),
    projectedMonthlySpend,
    projectedSpendRatio: projectedSpendRatio === null ? null : roundRatio(projectedSpendRatio),
    spendThresholds: thresholds,
    thresholdStatus,
    modelRouting: buildModelRouting(taskType, taskClass, nextBudgetAction),
    nextBudgetAction,
    ownerApprovalRequired: nextBudgetAction === "request_approval",
    blockedReason: budgetBlockedReason({ nextBudgetAction, thresholdStatus, taskClass, budgetConfigured }),
    guardrails: {
      noSecretsInOutput: true,
      noCreditBurnWithoutArtifact: true,
      useCheapestCapableModel: true,
      ownerApprovalBeforePauseOrApprovalThreshold: true,
      productionDeployBlocked: true,
      paidResourcesBlocked: true,
      migrationsBlocked: true,
      autoMergeBlocked: true
    }
  };
}

export function applyCostGovernanceToDecision(decision, costGovernance) {
  if (!costGovernance || costGovernance.kind !== "cost_governance") return decision;

  if (costGovernance.nextBudgetAction === "request_approval") {
    return {
      ...decision,
      action: "request_budget_approval",
      state: "owner_approval_required",
      blockedReason: costGovernance.blockedReason || "AI/API budget approval is required before this action can continue.",
      ownerApprovalRequired: true,
      failedGates: addBudgetGate(decision.failedGates, costGovernance)
    };
  }

  if (costGovernance.nextBudgetAction === "pause") {
    return {
      ...decision,
      action: "pause_for_budget",
      state: "owner_approval_required",
      blockedReason: costGovernance.blockedReason || "AI/API spend threshold requires a pause before continuing.",
      ownerApprovalRequired: true,
      failedGates: addBudgetGate(decision.failedGates, costGovernance)
    };
  }

  return decision;
}

export function validateCostGovernance(costGovernance) {
  const missing = [];

  for (const [label, value] of [
    ["kind", costGovernance.kind],
    ["app.name", costGovernance.app?.name],
    ["app.slug", costGovernance.app?.slug],
    ["monthlySpend", costGovernance.monthlySpend],
    ["projectSpend", costGovernance.projectSpend],
    ["appSpend", costGovernance.appSpend],
    ["issueSpend", costGovernance.issueSpend],
    ["modelRouting", costGovernance.modelRouting],
    ["nextBudgetAction", costGovernance.nextBudgetAction],
    ["guardrails", costGovernance.guardrails]
  ]) {
    if (value === undefined || value === null || value === "") missing.push(label);
  }

  if (!["continue", "continue_with_cheaper_model", "pause", "request_approval"].includes(costGovernance.nextBudgetAction)) {
    missing.push(`nextBudgetAction:${costGovernance.nextBudgetAction}`);
  }

  for (const key of ["cheap", "medium", "expensive"]) {
    if (!Array.isArray(costGovernance.modelRouting?.strategy?.[key]?.tasks)) {
      missing.push(`modelRouting.strategy.${key}`);
    }
  }

  if (
    !costGovernance.guardrails.noCreditBurnWithoutArtifact ||
    !costGovernance.guardrails.useCheapestCapableModel ||
    !costGovernance.guardrails.ownerApprovalBeforePauseOrApprovalThreshold
  ) {
    missing.push("guardrails.costControls");
  }

  if (missing.length) throw new Error(`Cost governance artifact is missing required fields: ${missing.join(", ")}`);
}

function normalizeThresholds(input, env) {
  return {
    warningPercent: numberOrDefault(input.warningPercent ?? env.APPENGINE_AI_BUDGET_WARNING_PERCENT, 0.5),
    pausePercent: numberOrDefault(input.pausePercent ?? env.APPENGINE_AI_BUDGET_PAUSE_PERCENT, 0.8),
    ownerApprovalPercent: numberOrDefault(input.ownerApprovalPercent ?? env.APPENGINE_AI_BUDGET_APPROVAL_PERCENT, 0.9)
  };
}

function determineThresholdStatus({ budgetConfigured, projectedSpendRatio, estimatedNextSpend, remainingBudget, thresholds }) {
  if (!budgetConfigured) return "budget_not_configured";
  if (estimatedNextSpend > remainingBudget) return "owner_approval";
  if (projectedSpendRatio >= thresholds.ownerApprovalPercent) return "owner_approval";
  if (projectedSpendRatio >= thresholds.pausePercent) return "pause";
  if (projectedSpendRatio >= thresholds.warningPercent) return "warning";
  return "within_budget";
}

function determineNextBudgetAction({ taskClass, thresholdStatus, budgetConfigured, enforcementMode }) {
  if (!budgetConfigured && enforcementMode === "enforced" && taskClass === "expensive") return "request_approval";
  if (thresholdStatus === "owner_approval") return "request_approval";
  if (thresholdStatus === "pause") return "pause";
  if (thresholdStatus === "warning" && taskClass !== "cheap") return "continue_with_cheaper_model";
  return "continue";
}

function buildModelRouting(taskType, taskClass, nextBudgetAction) {
  const recommendedClass = nextBudgetAction === "continue_with_cheaper_model" ? cheaperClass(taskClass) : taskClass;

  return {
    taskType,
    taskClass,
    recommendedClass,
    strategy: {
      cheap: {
        modelTier: "cheap",
        tasks: [...CHEAP_TASKS].sort(),
        rule: "Use deterministic scripts, cached artifacts, or the least expensive capable model."
      },
      medium: {
        modelTier: "medium",
        tasks: [...MEDIUM_TASKS].sort(),
        rule: "Use balanced models for review, summarization, and validation where quality matters but broad generation is not needed."
      },
      expensive: {
        modelTier: "expensive",
        tasks: [...EXPENSIVE_TASKS].sort(),
        rule: "Use higher-capability models only for architecture, implementation, debugging, and design generation that genuinely need them."
      }
    }
  };
}

function classifyTask(value) {
  const taskType = normalizeTaskType(value);
  if (CHEAP_TASKS.has(taskType)) return "cheap";
  if (MEDIUM_TASKS.has(taskType)) return "medium";
  if (EXPENSIVE_TASKS.has(taskType)) return "expensive";
  if (taskType.includes("review") || taskType.includes("verify") || taskType.includes("validation")) return "medium";
  if (taskType.includes("build") || taskType.includes("implement") || taskType.includes("debug") || taskType.includes("design")) return "expensive";
  return "cheap";
}

function cheaperClass(taskClass) {
  if (taskClass === "expensive") return "medium";
  if (taskClass === "medium") return "cheap";
  return "cheap";
}

function budgetBlockedReason({ nextBudgetAction, thresholdStatus, taskClass, budgetConfigured }) {
  if (nextBudgetAction === "request_approval") {
    if (!budgetConfigured) return `AI/API budget is not configured and the requested task is ${taskClass}; owner approval is required.`;
    return "AI/API spend is at or above the owner approval threshold.";
  }

  if (nextBudgetAction === "pause") return "AI/API spend is at or above the pause threshold.";
  if (nextBudgetAction === "continue_with_cheaper_model") return "AI/API spend is at the warning threshold; continue only with a cheaper capable model.";
  if (thresholdStatus === "budget_not_configured") return "AI/API budget is not configured; continue in advisory mode and record spend awareness.";
  return "";
}

function addBudgetGate(failedGates = [], costGovernance) {
  const gates = Array.isArray(failedGates) ? failedGates : [];
  if (gates.some((gate) => gate.id === "cost_governance")) return gates;
  return [
    ...gates,
    {
      id: "cost_governance",
      phase: "planning",
      status: "failed",
      reason: costGovernance.blockedReason || "AI/API budget threshold blocked continuation."
    }
  ];
}

function normalizeTaskType(value) {
  return String(value || "issue_routing")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeEnforcementMode(value) {
  const mode = String(value || "advisory").trim().toLowerCase();
  return mode === "enforced" || mode === "strict" ? "enforced" : "advisory";
}

function normalizeSourceIssue(source) {
  if (!source || typeof source !== "object") return {};
  return {
    number: source.number || source.issueNumber || null,
    title: source.title || null,
    url: source.url || source.htmlUrl || null
  };
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value) {
  return numberOrDefault(value, 0);
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function roundRatio(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}
