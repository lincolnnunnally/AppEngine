import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outputPath = path.resolve(process.env.PHONE_FIRST_PREFLIGHT_OUTPUT || "agent-run/phone-first-preflight.json");
const markdownOutputPath = path.resolve(process.env.PHONE_FIRST_PREFLIGHT_MARKDOWN_OUTPUT || "agent-run/phone-first-preflight.md");
const labels = parseJsonArray(process.env.ISSUE_LABELS_JSON || "[]");
const selectedMode = process.env.AGENT_MODE || "";
const selectedLabel = process.env.TRIGGER_LABEL || labels.find((label) => label.startsWith("ai:")) || "";
const workflowAgents = String(process.env.WORKFLOW_AGENTS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const taskBody = process.env.TASK_BODY || "";
const sharedContextFiles = parseSharedContextFiles();
const hasAiLabel = labels.some((label) => label.startsWith("ai:"));
const eventAction = process.env.GITHUB_EVENT_ACTION || "";
const eventName = process.env.GITHUB_EVENT_NAME || "";
const runUrl = workflowRunUrl();

const preflight = {
  kind: "phone_first_preflight",
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  issue: {
    number: process.env.TASK_NUMBER || "",
    title: process.env.TASK_TITLE || "",
    url: process.env.TASK_URL || "",
    labels
  },
  trigger: {
    eventName,
    eventAction,
    selectedLabel,
    openedIssueCanRunWithoutRelabeling: eventName === "issues" && eventAction === "opened" ? hasAiLabel : true
  },
  selectedMode,
  selectedLabel,
  workflowAgents,
  handoffDetected: looksLikeChatGptHandoff(taskBody),
  sourceOfTruth: {
    sourceCheck: "passed by previous workflow step",
    manifest: "agents/manifest.yaml",
    sharedContextFiles
  },
  followUpMode: process.env.FOLLOW_UP_MODE || "dry-run",
  artifactTarget: "GitHub Actions artifact: agent-run",
  workflowRunUrl: runUrl,
  ownerVisibleStatus: {
    whereToLook: runUrl || "GitHub Actions run URL unavailable",
    currentState: "prompt_factory_preflight_passed",
    nextSafeAction: "run_selected_agent"
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

validate(preflight);
writeJson(outputPath, preflight);
writeText(markdownOutputPath, renderMarkdown(preflight));
console.log(`phone-first preflight ok: ${outputPath}`);

function validate(value) {
  const missing = [];
  if (!value.issue.number) missing.push("issue.number");
  if (!value.selectedMode) missing.push("selectedMode");
  if (!value.selectedLabel) missing.push("selectedLabel");
  if (!value.sourceOfTruth.sharedContextFiles.length) missing.push("sourceOfTruth.sharedContextFiles");
  if (value.trigger.eventAction === "opened" && !value.trigger.openedIssueCanRunWithoutRelabeling) missing.push("openedIssueCanRunWithoutRelabeling");
  if (missing.length) throw new Error(`Phone-first preflight is missing required fields: ${missing.join(", ")}`);
}

function renderMarkdown(value) {
  return [
    "## Phone-First Preflight",
    "",
    `- Issue: #${value.issue.number} ${value.issue.title}`,
    `- Trigger: ${value.trigger.eventName}/${value.trigger.eventAction || "manual"}`,
    `- Selected mode: ${value.selectedMode}`,
    `- Selected label: ${value.selectedLabel}`,
    `- Follow-up mode: ${value.followUpMode}`,
    `- Artifact target: ${value.artifactTarget}`,
    `- Workflow run: ${value.workflowRunUrl || "unknown"}`,
    `- ChatGPT handoff detected: ${String(value.handoffDetected)}`,
    `- Opened issue can run without relabeling: ${String(value.trigger.openedIssueCanRunWithoutRelabeling)}`,
    "",
    "### Source Of Truth",
    `- Manifest: ${value.sourceOfTruth.manifest}`,
    ...value.sourceOfTruth.sharedContextFiles.map((filePath) => `- ${filePath}`),
    "",
    "### Guardrails",
    "- Production deploy: blocked.",
    "- Paid resources: blocked.",
    "- Migrations: blocked.",
    "- Generated app auto-merge: blocked.",
    "- Protected preview bypass/share links: not public evidence."
  ].join("\n") + "\n";
}

function looksLikeChatGptHandoff(value) {
  const text = String(value || "");
  return /chatgpt_handoff_packet|## Machine Handoff|Raw Conversation Summary|Recommended Label/i.test(text);
}

function parseSharedContextFiles() {
  const manifestPath = path.join(repoRoot, "agents", "manifest.yaml");
  if (!fs.existsSync(manifestPath)) return [];
  const source = fs.readFileSync(manifestPath, "utf8");
  const files = [];
  let inSection = false;

  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("shared_context_files:")) {
      inSection = true;
      continue;
    }
    if (inSection && /^[a-zA-Z_]+:/.test(line)) break;
    if (inSection) {
      const match = line.match(/^  -\s*(.+)$/);
      if (match) files.push(match[1].trim());
    }
  }

  return files;
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeJson(filePath, value) {
  writeText(path.resolve(filePath), `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(path.resolve(filePath), value);
}

function workflowRunUrl() {
  if (!process.env.GITHUB_REPOSITORY || !process.env.GITHUB_RUN_ID) return "";
  return `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
}
