import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  absorbArtifact,
  buildOwnerStatusReport,
  collectArtifactsFromAgentRun,
  renderOwnerStatusMarkdown,
  validateOwnerStatusReport
} from "./lib/owner-status-report.js";

const repoRoot = process.cwd();
const agentRunDir = path.resolve(process.env.AGENT_RUN_DIR || "agent-run");
const pilotDir = path.resolve(process.env.PILOT_ARTIFACT_DIR || path.join(agentRunDir, "pilot"));
const summaryOutput = path.resolve(process.env.AGENT_RUN_SUMMARY_OUTPUT || path.join(agentRunDir, "artifact-summary.md"));
const followUpTasksOutput = path.resolve(process.env.FOLLOW_UP_TASKS_OUTPUT || path.join(agentRunDir, "follow-up-tasks.json"));
const dryRunIssuesOutput = path.resolve(process.env.FOLLOW_UP_DRY_RUN_OUTPUT || path.join(agentRunDir, "follow-up-issues-dry-run.json"));
const ownerStatusOutput = path.resolve(process.env.OWNER_STATUS_REPORT_OUTPUT || path.join(agentRunDir, "owner-status-report.json"));
const ownerStatusMarkdownOutput = path.resolve(process.env.OWNER_STATUS_REPORT_MARKDOWN_OUTPUT || path.join(agentRunDir, "owner-status-report.md"));
const runUrl = process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : "";

fs.mkdirSync(agentRunDir, { recursive: true });

const pilotPath = path.join(pilotDir, "pilot-app-build.json");
const dryRunPath = path.join(pilotDir, "follow-up-issues.json");
const codexOutputPath = path.join(agentRunDir, "codex-output.md");
const pilot = readJsonIfExists(pilotPath);
const dryRun = readJsonIfExists(dryRunPath);
const followUpTasks = normalizeFollowUpTasks(dryRun, pilot, extractNestedFollowUpTasks());
const orchestrationPlan = readJsonIfExists(path.join(agentRunDir, "orchestration-plan.json"));
const phoneFirstPreflight = readJsonIfExists(path.join(agentRunDir, "phone-first-preflight.json"));
const ownerArtifacts = collectArtifactsFromAgentRun(agentRunDir, codexOutputPath);
absorbArtifact(ownerArtifacts, orchestrationPlan);
absorbArtifact(ownerArtifacts, phoneFirstPreflight);
const ownerStatusReport = buildOwnerStatusReport({
  ...ownerArtifacts,
  orchestrationPlan,
  phoneFirstPreflight,
  context: {
    sourceIssueUrl: process.env.SOURCE_ISSUE_URL || "",
    workflowRunUrl: runUrl
  }
});

validateOwnerStatusReport(ownerStatusReport);
writeJson(ownerStatusOutput, ownerStatusReport);
writeText(ownerStatusMarkdownOutput, renderOwnerStatusMarkdown(ownerStatusReport));

if (followUpTasks.length) {
  writeJson(followUpTasksOutput, {
    kind: "follow_up_tasks",
    schemaVersion: 1,
    mode: "dry_run",
    source: {
      issueNumber: process.env.SOURCE_ISSUE_NUMBER || pilot?.issue?.number || "",
      issueUrl: process.env.SOURCE_ISSUE_URL || pilot?.issue?.url || "",
      pilot: pilot?.pilot?.slug || ""
    },
    followUpTasks
  });

  writeJson(dryRunIssuesOutput, {
    mode: "dry-run",
    issues: followUpTasks.map((task) => ({
      title: task.title,
      label: task.recommendedLabel,
      body: task.body
    }))
  });
}

writeText(summaryOutput, renderSummary({ pilot, followUpTasks, ownerStatusReport, phoneFirstPreflight }));

console.log(`agent-run summary: ${displayPath(summaryOutput)}`);
if (followUpTasks.length) console.log(`follow-up tasks: ${displayPath(followUpTasksOutput)} (${followUpTasks.length})`);
console.log(`owner status report: ${displayPath(ownerStatusOutput)}`);

function renderSummary({ pilot, followUpTasks, ownerStatusReport, phoneFirstPreflight }) {
  const lines = [
    "## Durable Agent-Run Artifacts",
    "",
    "Download the GitHub Actions artifact named `agent-run` for durable files from this run.",
    runUrl ? `Run: ${runUrl}` : "",
    "",
    "### Files In Artifact",
    "- `orchestration-plan.json`",
    "- `phone-first-preflight.json`",
    "- `phone-first-preflight.md`",
    "- `generated-codex-prompt.md`",
    "- `codex-output.md`",
    "- `owner-status-report.json`",
    "- `owner-status-report.md`",
    "- `codex.patch`"
  ].filter(Boolean);

  if (phoneFirstPreflight) {
    lines.push(
      "",
      "### Phone-First Preflight",
      `- Trigger: ${phoneFirstPreflight.trigger?.eventName || "unknown"}/${phoneFirstPreflight.trigger?.eventAction || "manual"}`,
      `- Selected mode: ${phoneFirstPreflight.selectedMode || "unknown"}`,
      `- Selected label: ${phoneFirstPreflight.selectedLabel || "unknown"}`,
      `- Follow-up mode: ${phoneFirstPreflight.followUpMode || "dry-run"}`,
      `- Artifact target: ${phoneFirstPreflight.artifactTarget || "agent-run"}`
    );
  }

  lines.push(
    "",
    "### Owner Status",
    `- ${ownerStatusReport.ownerReadable.whereIsTheApp}`,
    `- State: ${ownerStatusReport.ownerReadable.state}`,
    `- Version: ${ownerStatusReport.ownerReadable.version}`,
    `- Blocking progress: ${ownerStatusReport.ownerReadable.blockingProgress}`,
    `- Next safe action: ${ownerStatusReport.ownerReadable.nextSafeAction}`
  );

  if (pilot) {
    lines.push(
      "- `pilot/pilot-app-build.json`",
      "- `pilot/chatgpt-handoff-packet.json`",
      "- `pilot/intake-packet.json`",
      "- `pilot/app-build-packet.json`",
      "- `pilot/follow-up-issues.json`",
      "- `pilot/follow-up-tasks.json`",
      "",
      "### Pilot",
      `- Name: ${pilot.pilot?.name || "unknown"}`,
      `- Slug: ${pilot.pilot?.slug || "unknown"}`,
      `- Mode: ${pilot.pilot?.mode || "unknown"}`,
      `- Release status: ${pilot.release?.status || "unknown"}`,
      `- Production deploy allowed: ${String(Boolean(pilot.release?.productionDeployAllowed))}`
    );
  }

  lines.push(
    "",
    "### Follow-Up Mode",
    "- Default: dry-run follow-up preview only.",
    "- To create real GitHub follow-up issues, set repository variable `APPENGINE_FOLLOW_UP_MODE` to `create`.",
    "- Production deployment and paid provider creation remain blocked by the packet guardrails."
  );

  if (followUpTasks.length) {
    lines.push("", "### Follow-Up Tasks", ...followUpTasks.map((task, index) => `${index + 1}. ${task.title} - ${task.recommendedLabel}`));
  } else {
    lines.push("", "### Follow-Up Tasks", "No structured follow-up tasks were found.");
  }

  return `${lines.join("\n")}\n`;
}

function normalizeFollowUpTasks(dryRun, pilot, nestedTasks = []) {
  const issues = Array.isArray(dryRun?.issues) ? dryRun.issues : [];
  if (issues.length) {
    return issues.map((issue) => ({
      title: String(issue.title || "AppEngine follow-up task"),
      body: String(issue.body || "Follow-up task created from an AppEngine dry-run pilot."),
      recommendedLabel: String(issue.label || issue.recommendedLabel || "ai:plan")
    }));
  }

  if (nestedTasks.length) return nestedTasks;

  const pilotIssues = Array.isArray(pilot?.workflow?.followUpIssues) ? pilot.workflow.followUpIssues : [];
  return pilotIssues.map((issue) => ({
    title: String(issue.title || "AppEngine follow-up task"),
    body: "Follow-up task created from an AppEngine dry-run pilot.",
    recommendedLabel: String(issue.label || issue.recommendedLabel || "ai:plan")
  }));
}

function extractNestedFollowUpTasks() {
  const tasks = [];

  if (fs.existsSync(codexOutputPath)) {
    tasks.push(...extractFollowUpTasksFromText(fs.readFileSync(codexOutputPath, "utf8")));
  }

  for (const filePath of listChangedArtifactFiles()) {
    tasks.push(...extractFollowUpTasksFromText(fs.readFileSync(filePath, "utf8")));
  }

  return dedupeTasks(tasks);
}

function listChangedArtifactFiles() {
  if (process.env.FOLLOW_UP_SCAN_CHANGED_FILES === "false") return [];

  let status = "";
  try {
    status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch {
    return [];
  }

  return status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .map((filePath) => filePath.split(" -> ").pop())
    .map((filePath) => filePath.replace(/^"|"$/g, ""))
    .filter((filePath) => /\.(md|json)$/i.test(filePath))
    .filter((filePath) => !filePath.startsWith("agent-run/") && !filePath.includes("/node_modules/"))
    .map((filePath) => path.resolve(repoRoot, filePath))
    .filter((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).isFile());
}

function extractFollowUpTasksFromText(text) {
  const tasks = [];
  const jsonBlocks = [...String(text || "").matchAll(/```json\s*([\s\S]*?)```/gi)].map((match) => match[1]);

  for (const block of jsonBlocks) {
    try {
      tasks.push(...collectFollowUpTasks(JSON.parse(block)));
    } catch {
      // Keep looking for the next structured block.
    }
  }

  return dedupeTasks(tasks);
}

function collectFollowUpTasks(value, tasks = []) {
  if (Array.isArray(value)) {
    collectTaskArray(value, tasks);
    for (const item of value) collectFollowUpTasks(item, tasks);
    return dedupeTasks(tasks);
  }

  if (!value || typeof value !== "object") return dedupeTasks(tasks);

  for (const key of ["followUpTasks", "follow_up_tasks", "followups", "issues"]) {
    if (Array.isArray(value[key])) collectTaskArray(value[key], tasks);
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") collectFollowUpTasks(child, tasks);
  }

  return dedupeTasks(tasks);
}

function collectTaskArray(values, tasks) {
  for (const item of values) {
    if (isFollowUpTask(item)) tasks.push(normalizeTask(item));
  }
}

function isFollowUpTask(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return "title" in value && ("body" in value || "details" in value);
}

function normalizeTask(task) {
  return {
    title: String(task.title || "AppEngine follow-up task"),
    body: String(task.body || task.details || "Follow-up task created from an AppEngine agent run."),
    recommendedLabel: String(task.recommendedLabel || task.label || task.labels?.[0] || "ai:plan")
  };
}

function dedupeTasks(tasks) {
  const seen = new Set();
  const unique = [];

  for (const task of tasks) {
    const normalized = normalizeTask(task);
    const key = `${normalized.title}\n${normalized.body}`;
    if (!normalized.title || !normalized.body || seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function displayPath(filePath) {
  const relative = path.relative(repoRoot, filePath);
  return relative && !relative.startsWith("..") ? relative : filePath;
}
