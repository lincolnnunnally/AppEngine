import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const outputFile = process.env.CODEX_OUTPUT_FILE || "";
const repo = process.env.GITHUB_REPOSITORY || "lincolnnunnally/AppEngine";
const sourceIssueNumber = process.env.SOURCE_ISSUE_NUMBER || "";
const sourceIssueUrl = process.env.SOURCE_ISSUE_URL || "";
const maxFollowUps = Number.parseInt(process.env.MAX_FOLLOW_UP_ISSUES || "5", 10);
const allowedLabels = new Set(["ai:plan", "ai:build", "ai:review", "ai:fix", "ai:growth", "ai:monitor"]);
const labelMetadata = new Map([
  ["ai:plan", { color: "5319e7", description: "Run planner workflow." }],
  ["ai:build", { color: "0e8a16", description: "Run builder/Codex workflow." }],
  ["ai:review", { color: "1d76db", description: "Run code review workflow." }],
  ["ai:fix", { color: "d93f0b", description: "Run fixer/Codex repair workflow." }],
  ["ai:growth", { color: "fbca04", description: "Run growth opportunity workflow." }],
  ["ai:monitor", { color: "006b75", description: "Run monitor workflow." }]
]);
const ensuredLabels = new Set();

if (!outputFile || !fs.existsSync(outputFile)) {
  console.log("No Codex output file found for follow-up issue creation.");
  process.exit(0);
}

const output = fs.readFileSync(outputFile, "utf8");
const tasks = extractFollowUpTasks(output).slice(0, maxFollowUps);

if (!tasks.length) {
  console.log("No structured follow-up tasks found.");
  process.exit(0);
}

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
  const bodyPath = path.join(os.tmpdir(), `appengine-follow-up-${Date.now()}-${Math.random().toString(16).slice(2)}.md`);
  fs.writeFileSync(bodyPath, body);

  ensureLabel(label);
  createIssue({ title, bodyPath, label });
  console.log(`Created follow-up issue: ${title} (${label})`);
}

function extractFollowUpTasks(text) {
  const jsonBlocks = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)].map((match) => match[1]);

  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(block);
      const tasks = parsed.followUpTasks || parsed.follow_up_tasks || parsed.followups || [];
      if (Array.isArray(tasks)) return tasks.filter((task) => task && typeof task === "object");
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
    execFileSync("gh", ["issue", "create", "--repo", repo, "--title", title, "--body-file", bodyPath, "--label", label], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (caught) {
    const stderr = String(caught?.stderr || caught?.message || "");
    if (!/label.*not found|could not add label/i.test(stderr)) throw caught;

    console.warn(`GitHub label "${label}" was unavailable; creating follow-up issue without a label.`);
    execFileSync("gh", ["issue", "create", "--repo", repo, "--title", title, "--body-file", bodyPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  }
}
