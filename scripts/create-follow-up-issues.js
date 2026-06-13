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
  const body = [
    task.body || task.details || "Follow-up task created from an AppEngine agent run.",
    "",
    "## Source",
    sourceIssueNumber ? `- Source issue: #${sourceIssueNumber}` : "",
    sourceIssueUrl ? `- Source URL: ${sourceIssueUrl}` : "",
    "- Created by AppEngine orchestration follow-up parser."
  ]
    .filter(Boolean)
    .join("\n");

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

  return extractFollowUpTasks(output);
}

function normalizeTaskPayload(parsed) {
  const tasks = Array.isArray(parsed) ? parsed : parsed.followUpTasks || parsed.follow_up_tasks || parsed.followups || parsed.issues || [];
  return Array.isArray(tasks) ? tasks.filter((task) => task && typeof task === "object") : [];
}

function extractFollowUpTasks(text) {
  const jsonBlocks = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)].map((match) => match[1]);

  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(block);
      const tasks = normalizeTaskPayload(parsed);
      if (tasks.length) return tasks;
    } catch {
      // Keep looking for the next structured block.
    }
  }

  return [];
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
