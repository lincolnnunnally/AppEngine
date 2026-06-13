import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const outputFile = process.env.CODEX_OUTPUT_FILE || "";
const repo = process.env.GITHUB_REPOSITORY || "lincolnnunnally/AppEngine";
const sourceIssueNumber = process.env.SOURCE_ISSUE_NUMBER || "";
const sourceIssueUrl = process.env.SOURCE_ISSUE_URL || "";
const maxFollowUps = Number.parseInt(process.env.MAX_FOLLOW_UP_ISSUES || "5", 10);
const followUpMode = normalizeFollowUpMode();
const dryRun = followUpMode !== "create";
const dryRunOutput = process.env.FOLLOW_UP_OUTPUT || "";
const tasksFile = process.env.FOLLOW_UP_TASKS_FILE || "";
const patchFile = process.env.CODEX_PATCH_FILE || path.join(path.dirname(path.resolve(outputFile || "agent-run/codex-output.md")), "codex.patch");
const dispatchWorkflows = process.env.FOLLOW_UP_DISPATCH_WORKFLOWS === "true";
const dispatchRef = process.env.FOLLOW_UP_REF || process.env.GITHUB_REF_NAME || "main";
const maxDispatches = Number.parseInt(process.env.MAX_FOLLOW_UP_WORKFLOW_DISPATCHES || "1", 10);
const allowedLabels = new Set(["ai:plan", "ai:build", "ai:review", "ai:fix", "ai:growth", "ai:monitor"]);
const labelModes = new Map([
  ["ai:plan", "planner"],
  ["ai:build", "builder"],
  ["ai:review", "code-reviewer"],
  ["ai:fix", "fixer"],
  ["ai:growth", "growth"],
  ["ai:monitor", "monitor"]
]);
const labelMetadata = new Map([
  ["ai:plan", { color: "5319e7", description: "Run planner workflow." }],
  ["ai:build", { color: "0e8a16", description: "Run builder/Codex workflow." }],
  ["ai:review", { color: "1d76db", description: "Run code review workflow." }],
  ["ai:fix", { color: "d93f0b", description: "Run fixer/Codex repair workflow." }],
  ["ai:growth", { color: "fbca04", description: "Run growth opportunity workflow." }],
  ["ai:monitor", { color: "006b75", description: "Run monitor workflow." }]
]);
const ensuredLabels = new Set();
let dispatchedCount = 0;

if (!outputFile || !fs.existsSync(outputFile)) {
  console.log("No Codex output file found for follow-up issue creation.");
  process.exit(0);
}

const output = fs.readFileSync(outputFile, "utf8");
const tasks = loadFollowUpTasks({ output, tasksFile }).slice(0, maxFollowUps);

if (!tasks.length) {
  console.log("No structured follow-up tasks found.");
  process.exit(0);
}

const preparedIssues = [];
const createdIssues = [];

for (const task of tasks) {
  const title = normalizeTitle(task.title);
  const label = normalizeLabel(task.recommendedLabel || task.label || task.labels?.[0] || "ai:plan");
  const body = buildIssueBody(task);

  if (dryRun) {
    preparedIssues.push({ title, label, body });
    console.log(`Dry run follow-up issue: ${title} (${label})`);
    continue;
  }

  const bodyPath = path.join(os.tmpdir(), `appengine-follow-up-${Date.now()}-${Math.random().toString(16).slice(2)}.md`);
  fs.writeFileSync(bodyPath, body);

  ensureLabel(label);
  const issueUrl = createIssue({ title, bodyPath, label });
  createdIssues.push({ title, label, body, url: issueUrl });
  console.log(`Created follow-up issue: ${title} (${label})`);
  dispatchFollowUpWorkflow({ issueUrl, title, body, label });
}

if (dryRunOutput) {
  fs.mkdirSync(path.dirname(path.resolve(dryRunOutput)), { recursive: true });
  fs.writeFileSync(
    path.resolve(dryRunOutput),
    `${JSON.stringify({ mode: followUpMode, issues: dryRun ? preparedIssues : createdIssues }, null, 2)}\n`
  );
}

function normalizeFollowUpMode() {
  const value = String(process.env.FOLLOW_UP_MODE || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

  if (value === "create" || value === "create-issues") return "create";
  if (value === "dry-run" || value === "dryrun" || value === "preview") return "dry-run";
  if (process.env.FOLLOW_UP_CREATE_ISSUES === "true") return "create";
  if (process.env.FOLLOW_UP_DRY_RUN === "false") return "create";
  return "dry-run";
}

function buildIssueBody(task) {
  const baseBody = stripGeneratedSourceSections(
    task.body || task.details || "Follow-up task created from an AppEngine agent run."
  );
  const sourceSection = [
    "## Source",
    sourceIssueNumber ? `- Source issue: #${sourceIssueNumber}` : "",
    sourceIssueUrl ? `- Source URL: ${sourceIssueUrl}` : "",
    "- Created by AppEngine orchestration follow-up parser."
  ]
    .filter(Boolean)
    .join("\n");

  return [baseBody, "", sourceSection].filter(Boolean).join("\n");
}

function stripGeneratedSourceSections(body) {
  const lines = String(body || "").split(/\r?\n/);
  const kept = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index];

    if (line.trim() === "## Source") {
      let nextIndex = index + 1;
      while (nextIndex < lines.length && !/^##\s+/.test(lines[nextIndex])) {
        nextIndex += 1;
      }

      const section = lines.slice(index, nextIndex).join("\n");
      if (section.includes("Created by AppEngine orchestration follow-up parser.")) {
        index = nextIndex;
        continue;
      }
    }

    kept.push(line);
    index += 1;
  }

  return kept.join("\n").trimEnd();
}

function loadFollowUpTasks({ output, tasksFile }) {
  if (tasksFile && fs.existsSync(tasksFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(tasksFile, "utf8"));
      const tasks = normalizeTaskPayload(parsed);
      if (tasks.length) return tasks;
    } catch {
      console.warn(`Could not parse structured follow-up task file: ${tasksFile}`);
    }
  }

  const outputTasks = extractFollowUpTasks(output);
  if (outputTasks.length) return outputTasks;

  if (patchFile && fs.existsSync(patchFile)) {
    const patchTasks = extractFollowUpTasksFromPatch(fs.readFileSync(patchFile, "utf8"));
    if (patchTasks.length) return patchTasks;
  }

  return [];
}

function normalizeTaskPayload(parsed) {
  return collectFollowUpTasks(parsed);
}

function extractFollowUpTasks(text) {
  const jsonBlocks = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)].map((match) => match[1]);
  const tasks = [];

  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(block);
      tasks.push(...normalizeTaskPayload(parsed));
    } catch {
      // Keep looking for the next structured block.
    }
  }

  return dedupeTasks(tasks);
}

function extractFollowUpTasksFromPatch(patchText) {
  const addedLines = [];

  for (const line of String(patchText || "").split(/\r?\n/)) {
    if (!line.startsWith("+") || line.startsWith("+++") || line.startsWith("+\\ No newline")) continue;
    addedLines.push(line.slice(1));
  }

  return extractFollowUpTasks(addedLines.join("\n"));
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
    if (isFollowUpTask(item)) tasks.push(item);
  }
}

function isFollowUpTask(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (!("title" in value) || !("body" in value || "details" in value)) return false;

  const label = value.recommendedLabel || value.label || value.labels?.[0] || "ai:plan";
  return allowedLabels.has(String(label).trim()) || !label;
}

function dedupeTasks(tasks) {
  const seen = new Set();
  const unique = [];

  for (const task of tasks) {
    const title = normalizeTitle(task.title);
    const body = String(task.body || task.details || "").trim();
    const key = `${title}\n${body}`;
    if (!title || !body || seen.has(key)) continue;
    seen.add(key);
    unique.push(task);
  }

  return unique;
}

function normalizeTitle(title) {
  const value = String(title || "AppEngine follow-up task").replace(/\s+/g, " ").trim();
  return value.slice(0, 120);
}

function normalizeLabel(label) {
  const value = String(label || "ai:plan").trim();
  return allowedLabels.has(value) ? value : "ai:plan";
}

function ensureLabel(label) {
  if (ensuredLabels.has(label)) return;

  const metadata = labelMetadata.get(label) || labelMetadata.get("ai:plan");

  try {
    execFileSync(
      "gh",
      ["label", "create", label, "--repo", repo, "--color", metadata.color, "--description", metadata.description],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
  } catch (caught) {
    const stderr = String(caught?.stderr || caught?.message || "");
    if (!/already exists|Name already exists/i.test(stderr)) {
      console.warn(`Could not ensure GitHub label "${label}"; issue creation will retry without the label if needed.`);
    }
  }

  ensuredLabels.add(label);
}

function createIssue({ title, bodyPath, label }) {
  try {
    return execFileSync("gh", ["issue", "create", "--repo", repo, "--title", title, "--body-file", bodyPath, "--label", label], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (caught) {
    const stderr = String(caught?.stderr || caught?.message || "");
    if (!/label.*not found|could not add label/i.test(stderr)) throw caught;

    console.warn(`GitHub label "${label}" was unavailable; creating follow-up issue without a label.`);
    return execFileSync("gh", ["issue", "create", "--repo", repo, "--title", title, "--body-file", bodyPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  }
}

function dispatchFollowUpWorkflow({ issueUrl, title, body, label }) {
  if (!dispatchWorkflows) return;
  if (dispatchedCount >= maxDispatches) return;

  const mode = labelModes.get(label);
  const issueNumber = extractIssueNumber(issueUrl);

  if (!mode || !issueNumber) {
    console.warn(`Skipping follow-up workflow dispatch for "${title}" because mode or issue number was unavailable.`);
    return;
  }

  const task = [
    title,
    "",
    body,
    "",
    "## Follow-Up Trigger",
    `- Created from source issue: ${sourceIssueNumber ? `#${sourceIssueNumber}` : "unknown"}`,
    `- Recommended label: ${label}`
  ].join("\n");

  execFileSync(
    "gh",
    [
      "workflow",
      "run",
      "ai-prompt-factory.yml",
      "--repo",
      repo,
      "--ref",
      dispatchRef,
      "-f",
      `mode=${mode}`,
      "-f",
      `task=${task}`,
      "-f",
      `issue_number=${issueNumber}`
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  dispatchedCount += 1;
  console.log(`Dispatched follow-up workflow for issue #${issueNumber} in ${mode} mode.`);
}

function extractIssueNumber(issueUrl) {
  const match = String(issueUrl || "").match(/\/issues\/(\d+)\s*$/);
  return match ? match[1] : "";
}
