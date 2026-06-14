import fs from "node:fs";
import path from "node:path";

const combinedOutput = process.env.BUILD_COMPLETION_OUTPUT || "";
const planOutput = process.env.BUILD_COMPLETION_PLAN_OUTPUT || "";
const followUpsOutput = process.env.BUILD_COMPLETION_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.BUILD_COMPLETION_INPUT || "";
const packetPath = process.env.BUILD_COMPLETION_PACKET || "";
const previewVerificationPath = process.env.PREVIEW_VERIFICATION_INPUT || "";

const input = readInput(inputPath);
const packet = readInput(packetPath);
const previewVerification = readInput(previewVerificationPath);

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
const relatedPreviewUrl =
  input.relatedPreviewUrl ||
  process.env.BUILD_RELATED_PREVIEW_URL ||
  previewVerification.checkedUrl ||
  previewVerification.previewRootUrl ||
  "";
const requiredGates = normalizeGateList(input.requiredGates || defaultRequiredGates(packet));
const passedGates = normalizeGateList(input.passedGates || gatesFromEnv("BUILD_PASSED_GATES"));
const failedGates = normalizeGateList(input.failedGates || gatesFromEnv("BUILD_FAILED_GATES")).map(markGateFailed);
const ownerApprovalRequired = booleanFrom(input.ownerApprovalRequired, process.env.OWNER_APPROVAL_REQUIRED, false);
const safety = buildSafety(input.safety || {});
const nextSafeAction = determineNextSafeAction({
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
  safety
});
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
  previewVerification,
  followUpTasks: buildFollowUpTasks({
    appName,
    slug,
    action: nextSafeAction.action,
    blockedReason: nextSafeAction.blockedReason,
    currentPhase,
    previewVerification,
    relatedPr,
    relatedPreviewUrl
  })
});

validateBuildCompletionPlan(plan);

const output = {
  agent: "planner",
  status: plan.blockedReason ? "needs_follow_up" : "completed",
  summary: `Created build completion plan for ${appName}; next safe action: ${plan.nextSafeAction}.`,
  artifacts: [
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
  })),
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
    requiredGates,
    passedGates,
    failedGates,
    followUpTasks,
    evidenceLinks: buildEvidenceLinks({ sourceIssue, relatedPr, relatedPreviewUrl, previewVerification }),
    safety,
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

function determineNextSafeAction({
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
    const missingReviewGates = requiredGates.filter((gate) => gate.phase === "review" && !passedGates.some((passed) => passed.id === gate.id));
    return missingReviewGates.length
      ? action("run_review_gates", "preview_verified", "")
      : action("prepare_release_gate", "release_blocked", "Release gate must stop before production approval.");
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

function buildFollowUpTasks({ appName, slug, action, blockedReason, currentPhase, previewVerification, relatedPr, relatedPreviewUrl }) {
  const titlePrefix = `[${slug}]`;
  const sharedGuardrails = [
    "## Guardrails",
    "- Do not deploy production.",
    "- Do not create paid resources.",
    "- Do not apply migrations.",
    "- Do not merge generated app code automatically.",
    "- Do not post protected Vercel bypass/share links publicly."
  ].join("\n");

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
    ["safety", plan.safety],
    ["guardrails", plan.guardrails]
  ]) {
    if (!value) missing.push(label);
  }

  if (!validStates().has(plan.currentState)) missing.push(`currentState:${plan.currentState}`);
  if (!validActions().has(plan.nextSafeAction)) missing.push(`nextSafeAction:${plan.nextSafeAction}`);
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
    gate("app_build_packet", "planning"),
    gate("provider_cost_review", "planning"),
    gate("deployment_environment", "planning"),
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
    run_review_gates: ["designer", "customer_perspective", "workflow_tester", "code_reviewer"],
    create_fix_issue: ["fixer"],
    stop_for_owner_approval: ["code_reviewer"],
    prepare_release_gate: ["workflow_tester", "monitor"],
    create_vnext_packet: ["planner"]
  };

  return handoffs[action] || ["planner"];
}

function buildEvidenceLinks({ sourceIssue, relatedPr, relatedPreviewUrl, previewVerification }) {
  return {
    sourceIssueUrl: normalizeSourceIssue(sourceIssue).url || null,
    relatedPrUrl: relatedPr || null,
    previewUrl: relatedPreviewUrl || null,
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
    "review_blocked",
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
    "run_review_gates",
    "create_fix_issue",
    "stop_for_owner_approval",
    "prepare_release_gate",
    "create_vnext_packet"
  ]);
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
