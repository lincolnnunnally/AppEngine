import fs from "node:fs";
import path from "node:path";

const packetOutput = process.env.VNEXT_PACKET_OUTPUT || "";
const followUpsOutput = process.env.VNEXT_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.VNEXT_INPUT || "";
const coreSourceOfTruthFiles = [
  "source-of-truth/00-why-we-build.md",
  "source-of-truth/01-ecosystem-philosophy.md",
  "source-of-truth/02-global-principles.md",
  "source-of-truth/03-life-produces-life.md",
  "source-of-truth/04-app-purpose-rules.md",
  "source-of-truth/05-ecosystem-design-gates.md",
  "source-of-truth/build-completion-orchestrator.md"
];

const input = readInput(inputPath);
const appName = input.name || process.env.APP_NAME || "Existing App";
const slug = input.slug || process.env.APP_SLUG || slugify(appName);
const currentVersion = input.currentVersion || process.env.APP_CURRENT_VERSION || "v1";
const targetVersion = input.targetVersion || process.env.APP_TARGET_VERSION || nextVersion(currentVersion);
const requestType = input.requestType || process.env.APP_IMPROVEMENT_TYPE || "feature";
const summary = input.summary || process.env.APP_IMPROVEMENT_SUMMARY || "Improve the existing app without restarting the whole build.";
const feedbackSource = input.feedbackSource || process.env.APP_FEEDBACK_SOURCE || "Lincoln request or GitHub issue";
const barrierRemoved = input.barrierRemoved || process.env.APP_BARRIER_REMOVED || "Name the barrier this improvement removes.";
const needAddressed = input.needAddressed || process.env.APP_NEED_ADDRESSED || "Name the need this improvement addresses.";
const movementTowardLife = input.movementTowardLife || process.env.APP_MOVEMENT_TOWARD_LIFE || "Describe how this improvement helps someone move toward life.";
const transformationOutcome = input.transformationOutcome || process.env.APP_TRANSFORMATION_OUTCOME || "Describe the transformation this improvement supports.";
const toolClassification = input.toolClassification || process.env.APP_TOOL_CLASSIFICATION || "unclassified";
const charterPath = input.charterPath || process.env.APP_CHARTER_PATH || `source-of-truth/charters/${slug}.md`;
const registrySource = input.registrySource || process.env.APP_REGISTRY_SOURCE || "Super Admin registry";
const monitoringSource = input.monitoringSource || process.env.APP_MONITORING_SOURCE || "monitoring data or known issue list";
const releaseHistorySource = input.releaseHistorySource || process.env.APP_RELEASE_HISTORY_SOURCE || "release history";
const knownIssues = input.knownIssues || listFromEnv("APP_KNOWN_ISSUES", ["Known issues must be loaded before planning."]);
const nonGoals = input.nonGoals || listFromEnv("APP_IMPROVEMENT_NON_GOALS", ["Do not restart the whole app.", "Do not import unrelated app goals."]);
const newPaidResourcesExpected = booleanFrom(input.newPaidResourcesExpected, process.env.APP_NEW_PAID_RESOURCES_EXPECTED, false);

const packet = buildVNextPacket({
  appName,
  slug,
  currentVersion,
  targetVersion,
  requestType,
  summary,
  feedbackSource,
  barrierRemoved,
  needAddressed,
  movementTowardLife,
  transformationOutcome,
  toolClassification,
  charterPath,
  registrySource,
  monitoringSource,
  releaseHistorySource,
  knownIssues,
  nonGoals,
  newPaidResourcesExpected
});

packet.followUpTasks = packet.phases.map((phase) => toFollowUpTask(packet, phase));

validateVNextPacket(packet);

if (packetOutput) writeJson(packetOutput, packet);
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks: packet.followUpTasks });

console.log(`vnext-packet ok: ${packet.app.name} (${packet.app.slug})`);
console.log(`target: ${packet.app.currentVersion} -> ${packet.app.targetVersion}`);

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

function buildVNextPacket({
  appName,
  slug,
  currentVersion,
  targetVersion,
  requestType,
  summary,
  feedbackSource,
  barrierRemoved,
  needAddressed,
  movementTowardLife,
  transformationOutcome,
  toolClassification,
  charterPath,
  registrySource,
  monitoringSource,
  releaseHistorySource,
  knownIssues,
  nonGoals,
  newPaidResourcesExpected
}) {
  return {
    kind: "vnext_packet",
    schemaVersion: 1,
    app: {
      name: appName,
      slug,
      currentVersion,
      targetVersion,
      charterPath
    },
    context: {
      charterLoaded: true,
      registryLoaded: true,
      monitoringLoaded: true,
      knownIssuesLoaded: true,
      releaseHistoryLoaded: true,
      registrySource,
      monitoringSource,
      releaseHistorySource,
      knownIssues
    },
    sourceOfTruth: {
      requiredFiles: [...coreSourceOfTruthFiles, charterPath]
    },
    change: {
      requestType,
      summary,
      feedbackSource,
      barrierRemoved,
      needAddressed,
      movementTowardLife,
      transformationOutcome,
      toolClassification,
      nonGoals
    },
    providerCostDelta: {
      newPaidResourcesExpected,
      costReviewRequired: true,
      approvalRequiredForNewPaidResources: true
    },
    buildCompletion: {
      kind: "build_completion_plan",
      required: true,
      initialState: "planned",
      nextSafeAction: "create_planning_issue"
    },
    phases: buildPhases(),
    followUpTasks: [],
    guardrails: {
      doNotRestartWholeApp: true,
      preventGoalBleed: true,
      preserveAppPurpose: true,
      preserveExistingCharter: true,
      releaseGateRequired: true,
      monitoringUpdateRequired: true
    }
  };
}

function buildPhases() {
  return [
    phase("current_state", "Current State Review", "context_gate", "ai:plan", "Load existing charter, registry, current version, monitoring data, known issues, and release history."),
    phase("change_scope", "Improvement Scope", "planner", "ai:plan", "Define the requested improvement, non-goals, affected workflows, and acceptance criteria."),
    phase("provider_cost_delta", "Provider/Cost Delta", "systems", "ai:plan", "Confirm whether the improvement needs new paid resources or provider changes."),
    phase("design_update", "Design Update", "designer", "ai:review", "Review UX/design impact without redesigning unrelated app areas."),
    phase("build_update", "Build Update", "builder", "ai:build", "Implement the scoped improvement inside existing app boundaries."),
    phase("regression_testing", "Regression Testing", "workflow_tester", "ai:review", "Test changed workflows plus core existing workflows that must not regress."),
    phase("release_gate", "Improvement Release Gate", "workflow_tester", "ai:review", "Approve target version, release notes, rollback notes, monitoring update, and Super Admin status."),
    phase("monitoring_update", "Monitoring Update", "monitor", "ai:monitor", "Watch the improved version and create follow-up work from user feedback or incidents.")
  ];
}

function phase(id, name, agent, label, goal) {
  return {
    id,
    name,
    agent,
    label,
    goal,
    acceptanceCriteria: [
      `${name} stays inside the existing app charter.`,
      `${name} records blockers as follow-up work instead of expanding scope.`
    ]
  };
}

function toFollowUpTask(packet, phase) {
  return {
    title: `[${packet.app.slug}] vNext: ${phase.name}`,
    recommendedLabel: phase.label,
    body: [
      `Run the ${phase.name} phase for ${packet.app.name} ${packet.app.currentVersion} -> ${packet.app.targetVersion}.`,
      "",
      "## vNext Packet",
      `- App: ${packet.app.name}`,
      `- Slug: ${packet.app.slug}`,
      `- Current version: ${packet.app.currentVersion}`,
      `- Target version: ${packet.app.targetVersion}`,
      `- Charter: ${packet.app.charterPath}`,
      `- Request type: ${packet.change.requestType}`,
      `- Summary: ${packet.change.summary}`,
      `- Feedback source: ${packet.change.feedbackSource}`,
      `- Barrier removed: ${packet.change.barrierRemoved}`,
      `- Need addressed: ${packet.change.needAddressed}`,
      `- Movement toward life: ${packet.change.movementTowardLife}`,
      `- Transformation outcome: ${packet.change.transformationOutcome}`,
      `- Tool classification: ${packet.change.toolClassification}`,
      `- Known issues: ${packet.context.knownIssues.join("; ")}`,
      `- Non-goals: ${packet.change.nonGoals.join("; ")}`,
      "",
      "## Required Source Of Truth To Load",
      ...packet.sourceOfTruth.requiredFiles.map((filePath) => `- ${filePath}`),
      "- source-of-truth/app-improvement-vnext-packet.md",
      "- agents/manifest.yaml",
      "- agents/context/output-contracts.md",
      "",
      "## Required Loaded Context",
      `- Registry: ${packet.context.registrySource}`,
      `- Monitoring: ${packet.context.monitoringSource}`,
      `- Release history: ${packet.context.releaseHistorySource}`,
      "",
      "## Provider/Cost Delta",
      `- New paid resources expected: ${packet.providerCostDelta.newPaidResourcesExpected}`,
      "- Cost review required: true",
      "",
      "## Guardrails",
      "- Do not restart the whole app.",
      "- Treat transformation as the product and people as the purpose.",
      "- Preserve the app's specific purpose; apps share philosophy but do not share purpose.",
      "- Do not import unrelated app goals, audiences, data, or workflows.",
      "- Preserve the existing charter and current version history.",
      "- Create or update the build completion plan before implementation, preview, review, release, or monitoring work advances.",
      "- Do not claim preview success without route-specific preview verification.",
      "- Route broad rebuilds into a separate App Build Packet or explicit v2 packet.",
      "- Release through the improvement release gate and update monitoring."
    ].join("\n")
  };
}

function validateVNextPacket(packet) {
  const requiredPhases = ["current_state", "change_scope", "provider_cost_delta", "design_update", "build_update", "regression_testing", "release_gate", "monitoring_update"];
  const missing = [];

  for (const [label, value] of [
    ["kind", packet.kind],
    ["app.name", packet.app?.name],
    ["app.slug", packet.app?.slug],
    ["app.currentVersion", packet.app?.currentVersion],
    ["app.targetVersion", packet.app?.targetVersion],
    ["change.requestType", packet.change?.requestType],
    ["change.summary", packet.change?.summary],
    ["change.barrierRemoved", packet.change?.barrierRemoved],
    ["change.needAddressed", packet.change?.needAddressed],
    ["change.movementTowardLife", packet.change?.movementTowardLife],
    ["change.transformationOutcome", packet.change?.transformationOutcome],
    ["change.toolClassification", packet.change?.toolClassification]
  ]) {
    if (!value) missing.push(label);
  }

  for (const flag of ["charterLoaded", "registryLoaded", "monitoringLoaded", "knownIssuesLoaded", "releaseHistoryLoaded"]) {
    if (!packet.context?.[flag]) missing.push(`context.${flag}`);
  }

  if (!Array.isArray(packet.phases) || packet.phases.length === 0) missing.push("phases");
  if (!Array.isArray(packet.followUpTasks) || packet.followUpTasks.length === 0) missing.push("followUpTasks");

  for (const id of requiredPhases) {
    if (!packet.phases?.some((phase) => phase.id === id)) missing.push(`phases.${id}`);
  }

  if (!packet.providerCostDelta?.costReviewRequired || !packet.providerCostDelta?.approvalRequiredForNewPaidResources) {
    missing.push("providerCostDelta");
  }

  if (!packet.buildCompletion?.required || packet.buildCompletion?.kind !== "build_completion_plan") {
    missing.push("buildCompletion");
  }

  if (!packet.guardrails?.doNotRestartWholeApp || !packet.guardrails?.preventGoalBleed || !packet.guardrails?.releaseGateRequired) {
    missing.push("guardrails");
  }

  for (const filePath of coreSourceOfTruthFiles) {
    if (!packet.sourceOfTruth?.requiredFiles?.includes(filePath)) missing.push(`sourceOfTruth.${filePath}`);
  }

  if (missing.length) throw new Error(`vNext packet is missing required fields: ${missing.join(", ")}`);
}

function nextVersion(version) {
  const match = String(version).match(/^v(\d+)(?:\.(\d+))?$/);
  if (!match) return "vNext";
  const major = Number(match[1]);
  const minor = Number(match[2] || 0) + 1;
  return `v${major}.${minor}`;
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
