import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const agentRunDir = path.resolve(process.env.AGENT_RUN_DIR || "agent-run");
const pilotDir = path.resolve(process.env.PILOT_ARTIFACT_DIR || path.join(agentRunDir, "pilot"));
const summaryOutput = path.resolve(process.env.AGENT_RUN_SUMMARY_OUTPUT || path.join(agentRunDir, "artifact-summary.md"));
const followUpTasksOutput = path.resolve(process.env.FOLLOW_UP_TASKS_OUTPUT || path.join(agentRunDir, "follow-up-tasks.json"));
const dryRunIssuesOutput = path.resolve(process.env.FOLLOW_UP_DRY_RUN_OUTPUT || path.join(agentRunDir, "follow-up-issues-dry-run.json"));
const runUrl = process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : "";

fs.mkdirSync(agentRunDir, { recursive: true });

const pilotPath = path.join(pilotDir, "pilot-app-build.json");
const dryRunPath = path.join(pilotDir, "follow-up-issues.json");
const pilot = readJsonIfExists(pilotPath);
const dryRun = readJsonIfExists(dryRunPath);
const followUpTasks = normalizeFollowUpTasks(dryRun, pilot);

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

writeText(summaryOutput, renderSummary({ pilot, followUpTasks }));

console.log(`agent-run summary: ${displayPath(summaryOutput)}`);
if (followUpTasks.length) console.log(`follow-up tasks: ${displayPath(followUpTasksOutput)} (${followUpTasks.length})`);

function renderSummary({ pilot, followUpTasks }) {
  const lines = [
    "## Durable Agent-Run Artifacts",
    "",
    "Download the GitHub Actions artifact named `agent-run` for durable files from this run.",
    runUrl ? `Run: ${runUrl}` : "",
    "",
    "### Files In Artifact",
    "- `orchestration-plan.json`",
    "- `generated-codex-prompt.md`",
    "- `codex-output.md`",
    "- `codex.patch`"
  ].filter(Boolean);

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

function normalizeFollowUpTasks(dryRun, pilot) {
  const issues = Array.isArray(dryRun?.issues) ? dryRun.issues : [];
  if (issues.length) {
    return issues.map((issue) => ({
      title: String(issue.title || "AppEngine follow-up task"),
      body: String(issue.body || "Follow-up task created from an AppEngine dry-run pilot."),
      recommendedLabel: String(issue.label || issue.recommendedLabel || "ai:plan")
    }));
  }

  const pilotIssues = Array.isArray(pilot?.workflow?.followUpIssues) ? pilot.workflow.followUpIssues : [];
  return pilotIssues.map((issue) => ({
    title: String(issue.title || "AppEngine follow-up task"),
    body: "Follow-up task created from an AppEngine dry-run pilot.",
    recommendedLabel: String(issue.label || issue.recommendedLabel || "ai:plan")
  }));
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
