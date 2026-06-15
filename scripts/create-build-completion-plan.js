import fs from "node:fs";
import path from "node:path";
import { applyCostGovernanceToDecision, buildCostGovernance, validateCostGovernance } from "./lib/cost-governance.js";
import { buildDeploymentLifecycle, ownerReviewRouteUrl, validDeploymentStates, validateDeploymentLifecycle } from "./lib/deployment-lifecycle.js";

const combinedOutput = process.env.BUILD_COMPLETION_OUTPUT || "";
const planOutput = process.env.BUILD_COMPLETION_PLAN_OUTPUT || "";
const followUpsOutput = process.env.BUILD_COMPLETION_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.BUILD_COMPLETION_INPUT || "";
const packetPath = process.env.BUILD_COMPLETION_PACKET || "";
const previewVerificationPath = process.env.PREVIEW_VERIFICATION_INPUT || "";
const costGovernancePath = process.env.COST_GOVERNANCE_INPUT || "";
const deploymentLifecyclePath = process.env.DEPLOYMENT_LIFECYCLE_INPUT || "";

const input = readInput(inputPath);
const packet = readInput(packetPath);
const previewVerification = readInput(previewVerificationPath);
const costGovernanceInput = input.costGovernance || readInput(costGovernancePath);
const deploymentLifecycleInput = input.deploymentLifecycle || input.deployment_lifecycle || readInput(deploymentLifecyclePath);

const packetApp = packet.app || packet.content?.app || {};
const appName = input.appName || input.name || packetApp.name || process.env.APP_NAME || "Example App";
const slug = input.appSlug || input.slug || packetApp.slug || process.env.APP_SLUG || slugify(appName);
const sourceIssue =
  input.sourceIssue ||
  packet.sourceIssue ||
  packet.issue ||
  sourceIssueFromEnv() ||
  {};
const currentPhase = input.currentPhase || process.env.BUILD_CURRENT_PHASE || firstOpenPhase(packet) || "planning";
const currentState = normalizeState(input.currentState || process.env.BUILD_CURRENT_STATE || inferInitialState({ packet, currentPhase }));
const relatedPr = input.relatedPr || process.env.BUILD_RELATED_PR || "";
const rawRelatedPreviewUrl =
  input.relatedPreviewUrl ||
  process.env.BUILD_RELATED_PREVIEW_URL ||
  previewVerification.checkedUrl ||
  previewVerification.previewRootUrl ||
  "";
const deploymentLifecycle = buildDeploymentLifecycle({
  input: deploymentLifecycleInput,
  packet,
  previewVerification,
  appName,
  slug,
  relatedPreviewUrl: rawRelatedPreviewUrl
});
validateDeploymentLifecycle(deploymentLifecycle);
const relatedPreviewUrl = rawRelatedPreviewUrl || (deploymentLifecycle.discovery.deploymentUrlKnown ? deploymentLifecycle.deploymentUrl : "");
const requiredGates = normalizeGateList(input.requiredGates || defaultRequiredGates(packet));
const passedGates = normalizeGateList(input.passedGates || gatesFromEnv("BUILD_PASSED_GATES"));
const failedGates = normalizeGateList(input.failedGates || gatesFromEnv("BUILD_FAILED_GATES")).map(markGateFailed);
const ownerApprovalRequired = booleanFrom(input.ownerApprovalRequired, process.env.OWNER_APPROVAL_REQUIRED, false);
const safety = buildSafety(input.safety || {});
const baseNextSafeAction = determineNextSafeAction({
  currentState,
  currentPhase,
  packet,
  previewVerification,
  relatedPr,
  relatedPreviewUrl,
  requiredGates,
  passedGates,
  failedGates,
  ownerApprovalRequired,
  safety,
  deploymentLifecycle
});
const costGovernance = buildCostGovernance({
  input: costGovernanceInput,
  context: {
    appName,
    slug,
    sourceIssue,
    currentPhase,
    currentState,
    nextSafeAction: baseNextSafeAction.action,
    taskType: input.taskType || process.env.APPENGINE_TASK_TYPE || currentPhase
  }
});
validateCostGovernance(costGovernance);
const nextSafeAction = applyCostGovernanceToDecision(baseNextSafeAction, costGovernance);
const plan = buildCompletionPlan({
  appName,
  slug,
  sourceIssue,
  currentPhase,
  currentState: nextSafeAction.state,
  nextSafeAction: nextSafeAction.action,
  blockedReason: nextSafeAction.blockedReason,
  ownerApprovalRequired: nextSafeAction.ownerApprovalRequired,
  relatedPr,
  relatedPreviewUrl,
  requiredGates,
  passedGates,
  failedGates: nextSafeAction.failedGates,
  safety,
  costGovernance,
  previewVerification,
  deploymentLifecycle,
  followUpTasks: buildFollowUpTasks({
    appName,
    slug,
    action: nextSafeAction.action,
    blockedReason: nextSafeAction.blockedReason,
    currentPhase,
    costGovernance,
    deploymentLifecycle,
    previewVerification,
    relatedPr,
    relatedPreviewUrl
  })
});

validateBuildCompletionPlan(plan);

const output = {
  agent: "planner",
  status: plan.blockedReason ? "needs_follow_up" : "completed",
  summary: [
    `Created build completion plan for ${appName}; next safe action: ${plan.nextSafeAction}.`,
    ownerFacingUrlSummary(deploymentLifecycle, previewVerification)
  ].join(" "),
  artifacts: [
    {
      kind: "deployment_lifecycle",
      title: `${appName} Deployment Lifecycle`,
      content: deploymentLifecycle
    },
    {
      kind: "build_completion_plan",
      title: `${appName} Build Completion Plan`,
      content: plan
    }
  ],
  findings: plan.failedGates.map((gate) => ({
    severity: "medium",
    title: `${gate.id} failed`,
    details: gate.reason || "Gate failed or needs follow-up.",
    recommendedLabel: "ai:fix"
  })).concat(costGovernanceFinding(plan.costGovernance)),
  followUpTasks: plan.followUpTasks,
  handoffTo: handoffForAction(plan.nextSafeAction)
};

if (combinedOutput) writeJson(combinedOutput, output);
if (planOutput) writeJson(planOutput, plan);
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks: plan.followUpTasks });

console.log(`build-completion ok: ${appName} (${slug})`);
console.log(`state: ${plan.currentState}`);
console.log(`next: ${plan.nextSafeAction}`);

function buildCompletionPlan({
  appName,
  slug,
  sourceIssue,
  currentPhase,
  currentState,
  nextSafeAction,
  blockedReason,
  ownerApprovalRequired,
  relatedPr,
  relatedPreviewUrl,
  requiredGates,
  passedGates,
  failedGates,
  safety,
  costGovernance,
  deploymentLifecycle,
  previewVerification,
  followUpTasks
}) {
  return {
    kind: "build_completion_plan",
    schemaVersion: 1,
    app: {
      name: appName,
      slug
    },
    sourceIssue: normalizeSourceIssue(sourceIssue),
    currentPhase,
    currentState,
    nextSafeAction,
    blockedReason,
    ownerApprovalRequired,
    relatedPr: relatedPr || null,
    relatedPreviewUrl: relatedPreviewUrl || null,
    reviewUrl: ownerFacingReviewUrl(deploymentLifecycle, previewVerification),
    productionUrl: deploymentLifecycle.productionUrl,
    deploymentState: deploymentLifecycle.deploymentState,
    currentVersion: deploymentLifecycle.currentVersion,
    deploymentLifecycle,
    requiredGates,
    passedGates,
    failedGates,
    followUpTasks,
    evidenceLinks: buildEvidenceLinks({ sourceIssue, relatedPr, relatedPreviewUrl, previewVerification, deploymentLifecycle }),
    safety,
    costGovernance,
    budgetAwareNextSafeAction: costGovernance.nextBudgetAction,
    previewVerification: previewVerification.kind === "preview_verification" ? previewVerification : null,
    guardrails: {
      productionDeployBlocked: true,
      paidResourcesBlocked: true,
      migrationsBlocked: true,
      autoMergeBlocked: true,
      protectedPreviewBypassLinksPubliclyBlocked: true
    },
    timestamps: {
      createdAt: new Date().toISOString()
    }
  };
}

function costGovernanceFinding(costGovernance) {
  if (!costGovernance || costGovernance.nextBudgetAction === "continue") return [];
  return [
    {
      severity: costGovernance.nextBudgetAction === "continue_with_cheaper_model" ? "medium" : "high",
      title: "AI/API cost governance threshold reached",
      details: costGovernance.blockedReason || "Review cost governance before continuing.",
      recommendedLabel: costGovernance.nextBudgetAction === "continue_with_cheaper_model" ? "ai:plan" : "ai:review"
    }
  ];
}

function determineNextSafeAction({
  currentState,
  currentPhase,
  packet,
  previewVerification,
  deploymentLifecycle,
  relatedPr,
  relatedPreviewUrl,
  requiredGates,
  passedGates,
  failedGates,
  ownerApprovalRequired,
  safety
}) {
  const safetyBlocker = safetyBlockReason(safety);

  if (safetyBlocker || ownerApprovalRequired || currentState === "owner_approval_required") {
    return {
      action: "stop_for_owner_approval",
      state: "owner_approval_required",
      blockedReason: safetyBlocker || "Owner approval is required before this action can continue.",
      ownerApprovalRequired: true,
      failedGates
    };
  }

  if (previewVerification.kind === "preview_verification" && previewVerification.status === "failed") {
    return {
      action: "create_fix_issue",
      state: "failed_needs_fix",
      blockedReason: previewVerification.summary || "Preview verification failed.",
      ownerApprovalRequired: false,
      failedGates: addFailedGate(failedGates, "preview_verification", previewVerification.summary)
    };
  }

  if (failedGates.length) {
    return {
      action: "create_fix_issue",
      state: "failed_needs_fix",
      blockedReason: "One or more required gates failed.",
      ownerApprovalRequired: false,
      failedGates
    };
  }

  if (!hasPacket(packet)) {
    return action("create_planning_issue", "planned", "App Build Packet or vNext Packet is missing.");
  }

  if (deploymentLifecycle.deploymentState === "failed_needs_fix") {
    return action("create_fix_issue", "failed_needs_fix", "Deployment lifecycle is failed and needs a focused fix.");
  }
  if (deploymentLifecycle.deploymentState === "review_blocked" && ["draft_pr_open", "preview_pending", "preview_verified", "build_preview"].includes(currentState)) {
    return action("create_fix_issue", "review_blocked", "Owner review URL is missing, unknown, or not accessible.");
  }
  if (currentState === "build_preview") {
    return deploymentLifecycle.discovery.reviewUrlKnown
      ? action("verify_review_url", "build_preview", "")
      : action("create_fix_issue", "review_blocked", "Owner review URL is not recorded.");
  }
  if (currentState === "review_ready") {
    return action("await_owner_review", "review_ready", "Owner review is required before release approval.");
  }
  if (currentState === "production_blocked") {
    return {
      action: "stop_for_owner_approval",
      state: "owner_approval_required",
      blockedReason: "Production remains blocked until owner approval is recorded.",
      ownerApprovalRequired: true,
      failedGates
    };
  }
  if (currentState === "production_live") return action("create_vnext_packet", "ready_for_vnext", "");
  if (currentState === "approved_for_release") return action("prepare_release_gate", "approved_for_release", "");

  if (currentState === "ready_for_vnext") return action("create_vnext_packet", "ready_for_vnext", "");
  if (currentState === "failed_needs_fix" || currentState === "review_blocked") {
    return action("create_fix_issue", currentState, "The current build state is blocked and needs a fix.");
  }
  if (currentState === "release_blocked") {
    return {
      action: "stop_for_owner_approval",
      state: "owner_approval_required",
      blockedReason: "Release is blocked until owner approval is recorded.",
      ownerApprovalRequired: true,
      failedGates
    };
  }
  if (currentState === "draft_pr_open") {
    return relatedPreviewUrl
      ? action("verify_preview", "preview_pending", "")
      : action("wait_for_preview", "preview_pending", "Draft PR exists, but no preview URL is recorded.");
  }
  if (currentState === "preview_pending") {
    return relatedPreviewUrl
      ? action("verify_preview", "preview_pending", "")
      : action("wait_for_preview", "preview_pending", "Preview URL is not recorded yet.");
  }
  if (currentState === "preview_verified") {
    if (!deploymentLifecycle.discovery.reviewUrlKnown) {
      return action("create_fix_issue", "review_blocked", "Preview is verified, but no owner review URL is recorded.");
    }
    const missingReviewGates = requiredGates.filter((gate) => gate.phase === "review" && !passedGates.some((passed) => passed.id === gate.id));
    return missingReviewGates.length
      ? action("run_review_gates", "preview_verified", "")
      : action("await_owner_review", "review_ready", "Owner review is required before release approval.");
  }
  if (currentState === "ready_for_build") return action("create_implementation_issue", "ready_for_build", "");

  if (["mvp_build", "implementation", "testing"].includes(currentPhase)) {
    return relatedPr ? action("wait_for_preview", "draft_pr_open", "") : action("create_draft_pr", "ready_for_build", "");
  }

  return action("create_planning_issue", currentState, "");

  function action(nextAction, state, blockedReason) {
    return {
      action: nextAction,
      state,
      blockedReason,
      ownerApprovalRequired: false,
      failedGates
    };
  }
}

function buildFollowUpTasks({ appName, slug, action, blockedReason, currentPhase, costGovernance, deploymentLifecycle, previewVerification, relatedPr, relatedPreviewUrl }) {
  const titlePrefix = `[${slug}]`;
  const sharedGuardrails = [
    "## Guardrails",
    "- Do not deploy production.",
    "- Do not create paid resources.",
    "- Do not apply migrations.",
    "- Do not merge generated app code automatically.",
    "- Do not post protected Vercel bypass/share links publicly.",
    "- Do not continue burning AI/API credits beyond configured cost governance thresholds."
  ].join("\n");
  const costGovernanceSummary = costGovernance?.kind === "cost_governance"
    ? [
        "## Cost Governance",
        `- Monthly budget: ${formatMoney(costGovernance.monthlyBudget)}`,
        `- Monthly spend: ${formatMoney(costGovernance.monthlySpend)}`,
        `- Project spend: ${formatMoney(costGovernance.projectSpend)}`,
        `- App spend: ${formatMoney(costGovernance.appSpend)}`,
        `- Issue spend: ${formatMoney(costGovernance.issueSpend)}`,
        `- Remaining budget: ${formatMoney(costGovernance.remainingBudget)}`,
        `- Estimated next spend: ${formatMoney(costGovernance.estimatedNextSpend)}`,
        `- Threshold status: ${costGovernance.thresholdStatus}`,
        `- Budget action: ${costGovernance.nextBudgetAction}`,
        `- Model route: ${costGovernance.modelRouting.taskClass} -> ${costGovernance.modelRouting.recommendedClass}`
      ].join("\n")
    : "";
  const deploymentLifecycleSummary = deploymentLifecycle?.kind === "deployment_lifecycle"
    ? [
        "## Deployment Lifecycle",
        `- Review URL: ${deploymentLifecycle.reviewUrl}`,
        `- Production URL: ${deploymentLifecycle.productionUrl}`,
        `- Current deployment URL: ${deploymentLifecycle.deploymentUrl}`,
        `- Deployment state: ${deploymentLifecycle.deploymentState}`,
        `- Current version: ${deploymentLifecycle.currentVersion}`,
        `- Review version: ${deploymentLifecycle.reviewVersion}`,
        `- Production version: ${deploymentLifecycle.productionVersion}`,
        `- Approval required: ${deploymentLifecycle.approvalRequired}`
      ].join("\n")
    : "";

  const tasks = {
    create_planning_issue: {
      title: `${titlePrefix} Continue build planning`,
      recommendedLabel: "ai:plan",
      body: [
        `Continue AppEngine build planning for ${appName}.`,
        "",
        `Current phase: ${currentPhase}`,
        blockedReason ? `Blocked reason: ${blockedReason}` : "",
        "",
        requiredSourceFiles(),
        "",
        deploymentLifecycleSummary,
        deploymentLifecycleSummary ? "" : "",
        costGovernanceSummary,
        costGovernanceSummary ? "" : "",
        sharedGuardrails
      ].filter(Boolean).join("\n")
    },
    pause_for_budget: {
      title: `${titlePrefix} Pause for AI/API budget threshold`,
      recommendedLabel: "ai:review",
      body: [
        `Pause AppEngine work for ${appName} because cost governance reached a pause threshold.`,
        "",
        blockedReason ? `Blocked reason: ${blockedReason}` : "Blocked reason: AI/API spend threshold reached.",
        "",
        "Record owner approval, a lower-cost route, or an updated budget before continuing.",
        "",
        requiredSourceFiles(),
        "",
        deploymentLifecycleSummary,
        deploymentLifecycleSummary ? "" : "",
        costGovernanceSummary,
        "",
        sharedGuardrails
      ].filter(Boolean).join("\n")
    },
    request_budget_approval: {
      title: `${titlePrefix} AI/API budget approval required`,
      recommendedLabel: "ai:review",
      body: [
        `Owner approval is required before ${appName} continues consuming AI/API credits.`,
        "",
        blockedReason ? `Blocked reason: ${blockedReason}` : "Blocked reason: AI/API budget approval threshold reached.",
        "",
        "Record approved budget, spend cap, or a cheaper model routing decision before continuing.",
        "",
        requiredSourceFiles(),
        "",
        deploymentLifecycleSummary,
        deploymentLifecycleSummary ? "" : "",
        costGovernanceSummary,
        "",
        sharedGuardrails
      ].filter(Boolean).join("\n")
    },
    create_implementation_issue: {
      title: `${titlePrefix} Create bounded implementation slice`,
      recommendedLabel: "ai:build",
      body: [
        `Create the next bounded implementation slice for ${appName}.`,
        "",
        "The slice must produce reviewable generated app code in a draft PR path only.",
        "",
        deploymentLifecycleSummary,
        deploymentLifecycleSummary ? "" : "",
        requiredSourceFiles(),
        "",
        sharedGuardrails
      ].join("\n")
    },
    create_draft_pr: {
      title: `${titlePrefix} Open draft implementation PR`,
      recommendedLabel: "ai:build",
      body: [
        `Open or update a draft implementation PR for ${appName}.`,
        "",
        "The PR must remain draft until preview verification and review gates pass.",
        "",
        deploymentLifecycleSummary,
        deploymentLifecycleSummary ? "" : "",
        requiredSourceFiles(),
        "",
        sharedGuardrails
      ].join("\n")
    },
    wait_for_preview: {
      title: `${titlePrefix} Wait for preview deployment`,
      recommendedLabel: "ai:review",
      body: [
        `Wait for a preview deployment for ${appName}.`,
        "",
        relatedPr ? `Related PR: ${relatedPr}` : "Related PR: not recorded",
        relatedPreviewUrl ? `Preview URL: ${relatedPreviewUrl}` : "Preview URL: not recorded",
        `Review URL: ${ownerFacingReviewUrl(deploymentLifecycle, previewVerification)}`,
        "",
        requiredSourceFiles(),
        "",
        sharedGuardrails
      ].join("\n")
    },
    verify_preview: {
      title: `${titlePrefix} Verify preview route`,
      recommendedLabel: "ai:review",
      body: [
        `Verify the preview deployment for ${appName}.`,
        "",
        relatedPreviewUrl ? `Preview URL: ${relatedPreviewUrl}` : "Preview URL: not recorded",
        `Review URL: ${ownerFacingReviewUrl(deploymentLifecycle, previewVerification)}`,
        "Preview success must check the expected route, marker content, commit SHA, and mock/API JSON when applicable.",
        "",
        requiredSourceFiles(),
        "",
        sharedGuardrails
      ].join("\n")
    },
    run_review_gates: {
      title: `${titlePrefix} Run review gates`,
      recommendedLabel: "ai:review",
      body: [
        `Run design, customer perspective, compatibility, workflow, code, and release-blocking review gates for ${appName}.`,
        "",
        deploymentLifecycleSummary,
        deploymentLifecycleSummary ? "" : "",
        requiredSourceFiles(),
        "",
        sharedGuardrails
      ].join("\n")
    },
    create_fix_issue: {
      title: `${titlePrefix} Fix build completion blocker`,
      recommendedLabel: "ai:fix",
      body: [
        `Fix the current AppEngine build completion blocker for ${appName}.`,
        "",
        blockedReason ? `Blocked reason: ${blockedReason}` : "",
        previewVerification.kind === "preview_verification" ? `Preview status: ${previewVerification.status}` : "",
        deploymentLifecycleSummary,
        deploymentLifecycleSummary ? "" : "",
        "",
        requiredSourceFiles(),
        "",
        sharedGuardrails
      ].filter(Boolean).join("\n")
    },
    stop_for_owner_approval: {
      title: `${titlePrefix} Owner approval required`,
      recommendedLabel: "ai:review",
      body: [
        `Owner approval is required before ${appName} can continue.`,
        "",
        blockedReason ? `Blocked reason: ${blockedReason}` : "Blocked reason: approval gate reached.",
        "",
        "Record explicit owner approval before production, paid resources, migrations, secrets/env changes, or merge actions.",
        "",
        deploymentLifecycleSummary,
        deploymentLifecycleSummary ? "" : "",
        requiredSourceFiles(),
        "",
        sharedGuardrails
      ].filter(Boolean).join("\n")
    },
    prepare_release_gate: {
      title: `${titlePrefix} Prepare release gate`,
      recommendedLabel: "ai:review",
      body: [
        `Prepare the release gate for ${appName}.`,
        "",
        "Production remains blocked until owner approval is recorded.",
        "",
        deploymentLifecycleSummary,
        deploymentLifecycleSummary ? "" : "",
        requiredSourceFiles(),
        "",
        sharedGuardrails
      ].join("\n")
    },
    create_vnext_packet: {
      title: `${titlePrefix} Create vNext packet`,
      recommendedLabel: "ai:plan",
      body: [
        `Create a vNext packet for ${appName}.`,
        "",
        "Load the existing charter, registry entry, monitoring data, known issues, release history, and current version before planning changes.",
        "",
        deploymentLifecycleSummary,
        deploymentLifecycleSummary ? "" : "",
        requiredSourceFiles(),
        "",
        sharedGuardrails
      ].join("\n")
    },
    verify_review_url: {
      title: `${titlePrefix} Verify owner review URL`,
      recommendedLabel: "ai:review",
      body: [
        `Verify the owner review URL for ${appName}.`,
        "",
        `Review URL: ${ownerFacingReviewUrl(deploymentLifecycle, previewVerification)}`,
        `Deployment state: ${deploymentLifecycle?.deploymentState || "unknown"}`,
        "The review URL must be accessible without protected bypass links and must show the expected app route/version.",
        "",
        requiredSourceFiles(),
        "",
        sharedGuardrails
      ].join("\n")
    },
    await_owner_review: {
      title: `${titlePrefix} Await owner review`,
      recommendedLabel: "ai:review",
      body: [
        `${appName} is ready for owner review.`,
        "",
        `Review here: ${ownerFacingReviewUrl(deploymentLifecycle, previewVerification)}`,
        `Production: ${formatOwnerProductionStatus(deploymentLifecycle)}`,
        `Deployment state: ${deploymentLifecycle?.deploymentState || "unknown"}`,
        `Current version: ${deploymentLifecycle?.currentVersion || "unknown"}`,
        "",
        "Do not promote production until owner approval is recorded.",
        "",
        requiredSourceFiles(),
        "",
        sharedGuardrails
      ].join("\n")
    }
  };

  return tasks[action] ? [tasks[action]] : [];
}

function validateBuildCompletionPlan(plan) {
  const missing = [];

  for (const [label, value] of [
    ["kind", plan.kind],
    ["app.name", plan.app?.name],
    ["app.slug", plan.app?.slug],
    ["currentPhase", plan.currentPhase],
    ["currentState", plan.currentState],
    ["nextSafeAction", plan.nextSafeAction],
    ["reviewUrl", plan.reviewUrl],
    ["productionUrl", plan.productionUrl],
    ["deploymentState", plan.deploymentState],
    ["currentVersion", plan.currentVersion],
    ["deploymentLifecycle", plan.deploymentLifecycle],
    ["safety", plan.safety],
    ["costGovernance", plan.costGovernance],
    ["budgetAwareNextSafeAction", plan.budgetAwareNextSafeAction],
    ["guardrails", plan.guardrails]
  ]) {
    if (!value) missing.push(label);
  }

  if (!validStates().has(plan.currentState)) missing.push(`currentState:${plan.currentState}`);
  if (!validActions().has(plan.nextSafeAction)) missing.push(`nextSafeAction:${plan.nextSafeAction}`);
  if (!validDeploymentStates().has(plan.deploymentState)) missing.push(`deploymentState:${plan.deploymentState}`);
  if (!Array.isArray(plan.requiredGates)) missing.push("requiredGates");
  if (!Array.isArray(plan.passedGates)) missing.push("passedGates");
  if (!Array.isArray(plan.failedGates)) missing.push("failedGates");
  if (!Array.isArray(plan.followUpTasks)) missing.push("followUpTasks");

  if (
    !plan.guardrails.productionDeployBlocked ||
    !plan.guardrails.paidResourcesBlocked ||
    !plan.guardrails.migrationsBlocked ||
    !plan.guardrails.autoMergeBlocked
  ) {
    missing.push("guardrails.blocking");
  }

  if (missing.length) throw new Error(`Build completion plan is missing required fields: ${missing.join(", ")}`);
}

function ownerFacingUrlSummary(deploymentLifecycle, previewVerification = {}) {
  return [
    `Review here: ${ownerFacingReviewUrl(deploymentLifecycle, previewVerification)}.`,
    `Production: ${formatOwnerProductionStatus(deploymentLifecycle)}.`
  ].join(" ");
}

function ownerFacingReviewUrl(deploymentLifecycle, previewVerification = {}) {
  if (!deploymentLifecycle?.discovery?.reviewUrlKnown) return "unknown";
  return ownerReviewRouteUrl(deploymentLifecycle.reviewUrl, previewVerification.expectedRoute || "/") || deploymentLifecycle.reviewUrl;
}

function formatOwnerProductionStatus(deploymentLifecycle) {
  if (!deploymentLifecycle || deploymentLifecycle.deploymentState !== "production_live") return "blocked/not live yet";
  return deploymentLifecycle.productionUrl || "live";
}

function buildSafety(safetyInput) {
  return {
    productionDeployAllowed: booleanFrom(safetyInput.productionDeployAllowed, process.env.PRODUCTION_DEPLOY_ALLOWED, false),
    paidResourcesAllowed: booleanFrom(safetyInput.paidResourcesAllowed, process.env.PAID_RESOURCES_ALLOWED, false),
    migrationsAllowed: booleanFrom(safetyInput.migrationsAllowed, process.env.MIGRATIONS_ALLOWED, false),
    autoMergeAllowed: booleanFrom(safetyInput.autoMergeAllowed, process.env.AUTO_MERGE_ALLOWED, false)
  };
}

function safetyBlockReason(safety) {
  if (safety.productionDeployAllowed) return "Production deploy requires explicit owner approval.";
  if (safety.paidResourcesAllowed) return "Paid resources require explicit owner approval.";
  if (safety.migrationsAllowed) return "Database migrations require explicit owner approval.";
  if (safety.autoMergeAllowed) return "Generated app code must not auto-merge.";
  return "";
}

function defaultRequiredGates(packet) {
  const packetGates = packet.app?.releaseGate?.gates || packet.content?.app?.releaseGate?.gates;
  if (Array.isArray(packetGates) && packetGates.length) {
    return packetGates.map((gate) => ({
      id: String(gate.id || gate.name || "gate"),
      phase: classifyGatePhase(gate.id || gate.name || "gate"),
      status: String(gate.status || "required")
    }));
  }

  return [
    gate("source_of_truth", "planning"),
    gate("cost_governance", "planning"),
    gate("app_build_packet", "planning"),
    gate("provider_cost_review", "planning"),
    gate("deployment_environment", "planning"),
    gate("deployment_lifecycle", "preview"),
    gate("preview_verification", "preview"),
    gate("design_review", "review"),
    gate("customer_perspective_review", "review"),
    gate("compatibility", "review"),
    gate("code_review", "review"),
    gate("release_gate", "release"),
    gate("production_approval", "release")
  ];
}

function normalizeGateList(values) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => {
    if (typeof value === "string") return gate(value, classifyGatePhase(value));
    return {
      id: String(value.id || value.name || "gate"),
      phase: String(value.phase || classifyGatePhase(value.id || value.name || "gate")),
      status: String(value.status || "required"),
      reason: value.reason ? String(value.reason) : undefined
    };
  });
}

function gate(id, phase) {
  return { id, phase, status: "required" };
}

function markGateFailed(gate) {
  return {
    ...gate,
    status: "failed"
  };
}

function addFailedGate(failedGates, id, reason) {
  if (failedGates.some((gate) => gate.id === id)) return failedGates;
  return [...failedGates, { id, phase: classifyGatePhase(id), status: "failed", reason }];
}

function classifyGatePhase(id) {
  const value = String(id || "").toLowerCase();
  if (value.includes("preview")) return "preview";
  if (value.includes("design") || value.includes("compat") || value.includes("code") || value.includes("customer")) return "review";
  if (value.includes("release") || value.includes("production")) return "release";
  return "planning";
}

function handoffForAction(action) {
  const handoffs = {
    create_planning_issue: ["planner"],
    create_implementation_issue: ["builder"],
    create_draft_pr: ["builder"],
    wait_for_preview: ["workflow_tester"],
    verify_preview: ["workflow_tester"],
    verify_review_url: ["workflow_tester"],
    run_review_gates: ["designer", "customer_perspective", "workflow_tester", "code_reviewer"],
    create_fix_issue: ["fixer"],
    await_owner_review: ["code_reviewer"],
    stop_for_owner_approval: ["code_reviewer"],
    pause_for_budget: ["code_reviewer"],
    request_budget_approval: ["code_reviewer"],
    prepare_release_gate: ["workflow_tester", "monitor"],
    create_vnext_packet: ["planner"]
  };

  return handoffs[action] || ["planner"];
}

function buildEvidenceLinks({ sourceIssue, relatedPr, relatedPreviewUrl, previewVerification, deploymentLifecycle }) {
  return {
    sourceIssueUrl: normalizeSourceIssue(sourceIssue).url || null,
    relatedPrUrl: relatedPr || null,
    previewUrl: relatedPreviewUrl || null,
    reviewUrl: ownerFacingReviewUrl(deploymentLifecycle, previewVerification),
    productionUrl: deploymentLifecycle?.productionUrl || null,
    previewCheckedUrl: previewVerification.checkedUrl || null,
    previewArtifact: previewVerification.kind === "preview_verification" ? "preview_verification" : null
  };
}

function requiredSourceFiles() {
  return [
    "## Required Source Of Truth To Load",
    "- source-of-truth/00-why-we-build.md",
    "- source-of-truth/01-ecosystem-philosophy.md",
    "- source-of-truth/02-global-principles.md",
    "- source-of-truth/03-life-produces-life.md",
    "- source-of-truth/04-app-purpose-rules.md",
    "- source-of-truth/05-ecosystem-design-gates.md",
    "- source-of-truth/build-completion-orchestrator.md",
    "- source-of-truth/app-url-lifecycle-standard.md",
    "- source-of-truth/cost-governance-model-routing.md",
    "- source-of-truth/app-build-packet.md",
    "- source-of-truth/deployment-environment-standard.md",
    "- source-of-truth/release-gate-standard.md",
    "- agents/manifest.yaml",
    "- agents/context/output-contracts.md"
  ].join("\n");
}

function hasPacket(packet) {
  return packet.kind === "app_build_packet" || packet.kind === "vnext_packet" || packet.app || packet.content?.app;
}

function firstOpenPhase(packet) {
  const phases = packet.phases || packet.content?.phases || [];
  if (!Array.isArray(phases) || !phases.length) return "";
  const open = phases.find((phase) => !["completed", "passed"].includes(String(phase.status || "").toLowerCase()));
  return String(open?.id || phases[0]?.id || "");
}

function inferInitialState({ packet, currentPhase }) {
  if (!hasPacket(packet)) return "planned";
  if (["mvp_build", "implementation"].includes(currentPhase)) return "ready_for_build";
  return "planned";
}

function normalizeState(value) {
  const state = String(value || "planned").trim().toLowerCase();
  return validStates().has(state) ? state : "planned";
}

function validStates() {
  return new Set([
    "planned",
    "ready_for_build",
    "draft_pr_open",
    "preview_pending",
    "preview_verified",
    "build_preview",
    "review_ready",
    "review_blocked",
    "approved_for_release",
    "production_live",
    "production_blocked",
    "release_blocked",
    "owner_approval_required",
    "ready_for_vnext",
    "failed_needs_fix"
  ]);
}

function validActions() {
  return new Set([
    "create_planning_issue",
    "create_implementation_issue",
    "create_draft_pr",
    "wait_for_preview",
    "verify_preview",
    "verify_review_url",
    "run_review_gates",
    "create_fix_issue",
    "await_owner_review",
    "stop_for_owner_approval",
    "pause_for_budget",
    "request_budget_approval",
    "prepare_release_gate",
    "create_vnext_packet"
  ]);
}

function formatMoney(value) {
  return value === null || value === undefined ? "not configured" : String(value);
}

function gatesFromEnv(name) {
  return String(process.env[name] || "")
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSourceIssue(source) {
  if (!source || typeof source !== "object") return {};
  return {
    number: source.number || source.issueNumber || null,
    title: source.title || null,
    url: source.url || source.htmlUrl || null
  };
}

function sourceIssueFromEnv() {
  const source = {
    number: process.env.SOURCE_ISSUE_NUMBER || "",
    title: process.env.SOURCE_ISSUE_TITLE || "",
    url: process.env.SOURCE_ISSUE_URL || ""
  };

  return source.number || source.title || source.url ? source : null;
}

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
