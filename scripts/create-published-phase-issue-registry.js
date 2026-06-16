import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.PUBLISHED_PHASE_ISSUE_REGISTRY_INPUT || "";
const registryOutput = process.env.PUBLISHED_PHASE_ISSUE_REGISTRY_OUTPUT || "";
const markdownOutput = process.env.PUBLISHED_PHASE_ISSUE_REGISTRY_MARKDOWN_OUTPUT || "";
const issuesOutput = process.env.PUBLISHED_PHASE_ISSUE_REGISTRY_ISSUES_OUTPUT || "";

const input = readInput(inputPath);
const manualPublish = input.phaseIssuePublisherManual || input.phase_issue_publisher_manual || input.manualPublish || input;
const registry = buildPublishedPhaseIssueRegistry(manualPublish);

validatePublishedPhaseIssueRegistry(registry);

if (registryOutput) writeJson(registryOutput, registry);
if (markdownOutput) writeText(markdownOutput, renderRegistryMarkdown(registry));
if (issuesOutput) writeJson(issuesOutput, { publishedIssues: registry.publishedIssues });

console.log(`published-phase-issue-registry ok: ${registry.candidate.slug} -> ${registry.publishedIssues.length} issues tracked`);
console.log(`next safe action: ${registry.nextSafeAction}`);

function buildPublishedPhaseIssueRegistry(manualPublish) {
  validateManualPublishInput(manualPublish);

  const publishedIssues = manualPublish.publishResults.map((result) => normalizePublishedIssue(result, manualPublish));
  validatePublishedIssues(publishedIssues, manualPublish.phaseOrder);

  const registry = {
    kind: "published_phase_issue_registry",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "phase_issue_publisher_manual",
      candidateSlug: manualPublish.candidate.slug,
      candidateType: manualPublish.candidate.type,
      finalPacketType: manualPublish.sourceFinalPacket.kind,
      publishStatus: manualPublish.decision.publishStatus
    },
    sourcePacket: {
      kind: manualPublish.sourceFinalPacket.kind,
      status: manualPublish.sourceFinalPacket.status
    },
    candidate: {
      name: manualPublish.candidate.name,
      slug: manualPublish.candidate.slug,
      type: manualPublish.candidate.type,
      summary: manualPublish.candidate.summary,
      needAddressed: manualPublish.candidate.needAddressed,
      desiredTransformation: manualPublish.candidate.desiredTransformation
    },
    publishedIssues,
    phaseOrder: manualPublish.phaseOrder,
    issueLabels: uniqueLabels(publishedIssues.map((issue) => ({ labels: issue.labels }))),
    guardrails: requiredGuardrails(),
    currentStatus: "published_tracking_only",
    nextSafeAction: "review_published_phase_issues",
    decision: {
      registryStatus: "published_phase_issues_tracked",
      githubIssuesCreatedByRegistry: false,
      labelsAddedByRegistry: false,
      codexBuildTriggered: false,
      ownerApprovalRequiredBeforeExecution: true,
      reason: "Completed manual publish output was recorded for tracking only."
    },
    ownerReadableReport: ""
  };

  registry.ownerReadableReport = renderOwnerReport(registry);

  return registry;
}

function validateManualPublishInput(manualPublish) {
  const missing = [];

  for (const [label, value] of [
    ["kind", manualPublish.kind],
    ["schemaVersion", manualPublish.schemaVersion],
    ["sourceArtifact.kind", manualPublish.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", manualPublish.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", manualPublish.sourceArtifact?.candidateType],
    ["sourceArtifact.finalPacketType", manualPublish.sourceArtifact?.finalPacketType],
    ["candidate.name", manualPublish.candidate?.name],
    ["candidate.slug", manualPublish.candidate?.slug],
    ["candidate.type", manualPublish.candidate?.type],
    ["candidate.summary", manualPublish.candidate?.summary],
    ["candidate.needAddressed", manualPublish.candidate?.needAddressed],
    ["candidate.desiredTransformation", manualPublish.candidate?.desiredTransformation],
    ["sourceFinalPacket.kind", manualPublish.sourceFinalPacket?.kind],
    ["sourceFinalPacket.status", manualPublish.sourceFinalPacket?.status],
    ["decision.publishStatus", manualPublish.decision?.publishStatus],
    ["decision.nextSafeAction", manualPublish.decision?.nextSafeAction],
    ["ownerReadableReport", manualPublish.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (manualPublish.kind !== "phase_issue_publisher_manual") missing.push("kind.phase_issue_publisher_manual");
  if (manualPublish.sourceArtifact?.kind !== "phase_issue_publisher_dry_run") missing.push("sourceArtifact.kind.phase_issue_publisher_dry_run");
  if (!finalPacketTypes().includes(manualPublish.sourceFinalPacket?.kind)) missing.push("sourceFinalPacket.kind.allowed");
  if (manualPublish.decision?.publishStatus !== "manual_publish_completed") missing.push("decision.publishStatus.manual_publish_completed");
  if (manualPublish.decision?.githubIssuesCreated !== true) missing.push("decision.githubIssuesCreated.true");
  if (manualPublish.decision?.mockIssuesCreated === true) missing.push("decision.mockIssuesCreated.false");
  if (manualPublish.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");
  if (!Array.isArray(manualPublish.publishResults) || manualPublish.publishResults.length === 0) missing.push("publishResults");
  if (!Array.isArray(manualPublish.phaseOrder) || manualPublish.phaseOrder.length === 0) missing.push("phaseOrder");
  if (!Array.isArray(manualPublish.labelsToApply) || manualPublish.labelsToApply.length === 0) missing.push("labelsToApply");
  if (manualPublish.guardrails?.manualPublishingOnly !== true) missing.push("guardrails.manualPublishingOnly");

  for (const [label, value] of Object.entries(manualPublishRequiredGuardrails())) {
    if (manualPublish.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Cannot create published phase issue registry: missing ${missing.join(", ")}`);
}

function normalizePublishedIssue(result, manualPublish) {
  validatePublishResult(result);

  return {
    issueNumber: result.issueNumber,
    url: result.url,
    title: result.title,
    phase: result.phase,
    phaseOrder: result.phaseOrder,
    labels: result.appliedLabels,
    sourceDryRunPayload: {
      sourceArtifact: manualPublish.sourceArtifact.kind,
      sourceCandidateSlug: manualPublish.sourceArtifact.candidateSlug,
      sourceFinalPacketType: manualPublish.sourceArtifact.finalPacketType,
      requestedLabels: result.requestedLabels,
      appliedLabels: result.appliedLabels,
      blockedLabels: result.blockedLabels
    },
    sourcePacket: {
      kind: manualPublish.sourceFinalPacket.kind,
      status: manualPublish.sourceFinalPacket.status
    },
    guardrails: {
      noCodexBuildTriggered: true,
      noProductionDeploy: true,
      noPaidResources: true,
      noMigrations: true
    },
    currentStatus: "published_tracking_only",
    nextSafeAction: "review_published_phase_issue"
  };
}

function validatePublishResult(result) {
  const missing = [];

  for (const [label, value] of [
    ["title", result.title],
    ["phase", result.phase],
    ["phaseOrder", result.phaseOrder],
    ["issueNumber", result.issueNumber],
    ["url", result.url]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (result.created !== true) missing.push("created.true");
  if (result.mocked === true) missing.push("mocked.false");
  if (!Array.isArray(result.requestedLabels)) missing.push("requestedLabels");
  if (!Array.isArray(result.appliedLabels) || result.appliedLabels.length === 0) missing.push("appliedLabels");
  if (!Array.isArray(result.blockedLabels)) missing.push("blockedLabels");
  if (!Number.isInteger(Number(result.issueNumber)) || Number(result.issueNumber) <= 0) missing.push("issueNumber.valid");
  if (!isGithubIssueUrl(result.url)) missing.push("url.githubIssue");

  const unsafeLabels = unsafeLabelFindings(result.appliedLabels || []);
  if (unsafeLabels.length) missing.push(...unsafeLabels.map((label) => `labels.${label}`));

  if (missing.length) throw new Error(`Cannot create published phase issue registry: publish result ${result.title || "unknown"} missing ${missing.join(", ")}`);
}

function validatePublishedIssues(issues, phaseOrder) {
  const missing = [];

  if (issues.length !== phaseOrder.length) missing.push("publishedIssues.matchesPhaseOrderLength");

  issues.forEach((issue, index) => {
    if (phaseOrder[index] !== issue.phase) missing.push(`publishedIssues.${index}.phaseOrder.matchesSource`);
    if (issue.labels.includes("ai:build")) missing.push(`publishedIssues.${index}.labels.aiBuildBlocked`);
    if (issue.labels.includes("ai:fix")) missing.push(`publishedIssues.${index}.labels.aiFixBlocked`);
    if (issue.sourceDryRunPayload.sourceArtifact !== "phase_issue_publisher_dry_run") missing.push(`publishedIssues.${index}.sourceDryRunPayload.sourceArtifact`);
    if (!isPresent(issue.sourceDryRunPayload.sourceCandidateSlug)) missing.push(`publishedIssues.${index}.sourceDryRunPayload.sourceCandidateSlug`);
    if (!isPresent(issue.sourceDryRunPayload.sourceFinalPacketType)) missing.push(`publishedIssues.${index}.sourceDryRunPayload.sourceFinalPacketType`);
  });

  if (missing.length) throw new Error(`Cannot create published phase issue registry: missing ${missing.join(", ")}`);
}

function validatePublishedPhaseIssueRegistry(registry) {
  const missing = [];

  for (const [label, value] of [
    ["kind", registry.kind],
    ["schemaVersion", registry.schemaVersion],
    ["sourceArtifact.kind", registry.sourceArtifact?.kind],
    ["sourceArtifact.candidateSlug", registry.sourceArtifact?.candidateSlug],
    ["sourceArtifact.candidateType", registry.sourceArtifact?.candidateType],
    ["sourceArtifact.finalPacketType", registry.sourceArtifact?.finalPacketType],
    ["sourcePacket.kind", registry.sourcePacket?.kind],
    ["sourcePacket.status", registry.sourcePacket?.status],
    ["candidate.name", registry.candidate?.name],
    ["candidate.slug", registry.candidate?.slug],
    ["candidate.type", registry.candidate?.type],
    ["currentStatus", registry.currentStatus],
    ["nextSafeAction", registry.nextSafeAction],
    ["ownerReadableReport", registry.ownerReadableReport]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  if (registry.kind !== "published_phase_issue_registry") missing.push("kind.published_phase_issue_registry");
  if (registry.sourceArtifact?.kind !== "phase_issue_publisher_manual") missing.push("sourceArtifact.kind.phase_issue_publisher_manual");
  if (!Array.isArray(registry.publishedIssues) || registry.publishedIssues.length === 0) missing.push("publishedIssues");
  if (!Array.isArray(registry.phaseOrder) || registry.phaseOrder.length === 0) missing.push("phaseOrder");
  if (!Array.isArray(registry.issueLabels) || registry.issueLabels.length === 0) missing.push("issueLabels");
  if (registry.decision?.githubIssuesCreatedByRegistry !== false) missing.push("decision.githubIssuesCreatedByRegistry.false");
  if (registry.decision?.labelsAddedByRegistry !== false) missing.push("decision.labelsAddedByRegistry.false");
  if (registry.decision?.codexBuildTriggered !== false) missing.push("decision.codexBuildTriggered.false");

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (registry.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  validatePublishedIssues(registry.publishedIssues || [], registry.phaseOrder || []);

  if (missing.length) throw new Error(`Published phase issue registry artifact missing required fields: ${missing.join(", ")}`);
}

function renderOwnerReport(registry) {
  const lines = [
    "Published Phase Issue Registry",
    "",
    `Candidate: ${registry.candidate.name}`,
    `Issues tracked: ${registry.publishedIssues.length}`,
    `Current status: ${registry.currentStatus}`,
    `Next safe action: ${registry.nextSafeAction}`,
    "Codex build triggered: no",
    "",
    "Published issues:"
  ];

  registry.publishedIssues.forEach((issue, index) => {
    lines.push(`${index + 1}. ${issue.title}`);
    lines.push(`   Phase: ${issue.phase}`);
    lines.push(`   Issue: #${issue.issueNumber}`);
    lines.push(`   URL: ${issue.url}`);
    lines.push(`   Labels: ${issue.labels.join(", ")}`);
  });

  lines.push("", "Guardrails: registry only, no labels added, no Codex build, no deploy");

  return lines.join("\n");
}

function renderRegistryMarkdown(registry) {
  return `${registry.ownerReadableReport}\n`;
}

function manualPublishRequiredGuardrails() {
  return {
    manualPublishingOnly: true,
    defaultDryRunNoop: true,
    noUi: true,
    noCodexBuildTriggered: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noGeneratedCodeAutoMerge: true
  };
}

function requiredGuardrails() {
  return {
    registryOnly: true,
    noUi: true,
    noGithubIssuesCreated: true,
    noLabelsAdded: true,
    noCodexBuildTriggered: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noGeneratedCodeAutoMerge: true
  };
}

function unsafeLabelFindings(labels) {
  const blocked = new Set(["ai:build", "ai:fix"]);
  return labels.filter((label) => blocked.has(label));
}

function finalPacketTypes() {
  return ["app_build_packet", "vnext_packet", "non_app_solution_plan"];
}

function uniqueLabels(items) {
  return [...new Set(items.flatMap((item) => item.labels || []))];
}

function isGithubIssueUrl(value) {
  return /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/\d+$/i.test(String(value || ""));
}

function isPresent(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
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
