import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repo = process.env.GITHUB_REPOSITORY || "lincolnnunnally/AppEngine";
const config = readMonitorConfig();
const outputPath = path.resolve(process.cwd(), process.env.MONITOR_OUTPUT || "orchestration-monitor-report.json");
const shouldComment = process.env.MONITOR_COMMENT === "true";
const dryRun = process.env.MONITOR_DRY_RUN ? process.env.MONITOR_DRY_RUN === "true" : config.dryRunDefault;
const labels = config.labels.length ? config.labels : ["ai:plan", "ai:build", "ai:review", "ai:fix", "ai:growth", "ai:monitor"];
const staleHours = config.staleHours;
const maxCommentsPerRun = config.maxCommentsPerRun;
const marker = "<!-- appengine-orchestration-monitor -->";
const issues = new Map();
let commentsCreated = 0;

for (const label of labels) {
  const listed = JSON.parse(
    execFileSync(
      "gh",
      ["issue", "list", "--repo", repo, "--state", "open", "--label", label, "--json", "number,title,labels,updatedAt,url", "--limit", "100"],
      { encoding: "utf8" }
    )
  );

  for (const issue of listed) {
    issues.set(issue.number, issue);
  }
}

const pullRequests = listPullRequests();
const failedWorkflowRuns = listFailedWorkflowRuns();
const recentlyMergedPullRequests = listRecentlyMergedPullRequests();
const sourceOfTruthChanges = detectSourceOfTruthChanges();
const now = new Date();
const report = {
  createdAt: now.toISOString(),
  repo,
  dryRun,
  staleHours,
  monitoredLabels: labels,
  openAiIssueCount: issues.size,
  openPullRequestCount: pullRequests.length,
  failedWorkflowRunCount: failedWorkflowRuns.length,
  recentlyMergedPullRequestCount: recentlyMergedPullRequests.length,
  sourceOfTruthChanges,
  issues: [...issues.values()]
    .sort((a, b) => a.number - b.number)
    .map((issue) => withWorkflowVisibility(withStaleState(issue, now))),
  pullRequests: pullRequests.map((pullRequest) => withStaleState(pullRequest, now)),
  failedWorkflowRuns,
  recentlyMergedPullRequests,
  actions: []
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote monitor report to ${outputPath}`);

if (shouldComment) {
  for (const issue of report.issues) {
    if (commentsCreated >= maxCommentsPerRun) break;
    commentIfNeeded(issue);
  }
}

function commentIfNeeded(issue) {
  const alreadyCommented = issue.workflowVisibility?.monitorMarkerPresent;

  if (alreadyCommented) {
    console.log(`Issue #${issue.number} already has monitor marker.`);
    return;
  }

  const body = [
    marker,
    `AppEngine orchestration monitor saw this open AI-labeled issue on ${new Date().toISOString()}.`,
    "",
    `Labels: ${issue.labels.map((label) => `\`${label.name}\``).join(", ") || "none"}`,
    issue.isStale ? `Stale check: no update for ${issue.hoursSinceUpdated} hours.` : "Stale check: recently updated.",
    issue.workflowVisibility?.needsWorkflowStartAttention
      ? "Workflow start: no AI Prompt Factory issue comment was found yet."
      : "Workflow start: AI Prompt Factory issue comment found or not required.",
    "",
    "If this issue has not started a workflow, confirm it has an `ai:*` label and that the AI Prompt Factory workflow includes the `opened` trigger.",
    dryRun ? "" : "",
    dryRun ? "Dry run: no durable action was taken." : ""
  ].join("\n");

  if (dryRun) {
    console.log(`Dry run: would add monitor marker to issue #${issue.number}.`);
    return;
  }

  execFileSync("gh", ["issue", "comment", String(issue.number), "--repo", repo, "--body", body], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  commentsCreated += 1;
  console.log(`Added monitor marker to issue #${issue.number}.`);
}

function listPullRequests() {
  try {
    return JSON.parse(
      execFileSync(
        "gh",
        [
          "pr",
          "list",
          "--repo",
          repo,
          "--state",
          "open",
          "--json",
          "number,title,updatedAt,url,isDraft,reviewDecision,headRefName",
          "--limit",
          "100"
        ],
        { encoding: "utf8" }
      )
    );
  } catch {
    return [];
  }
}

function listFailedWorkflowRuns() {
  try {
    return JSON.parse(
      execFileSync(
        "gh",
        ["run", "list", "--repo", repo, "--status", "failure", "--json", "databaseId,name,conclusion,status,createdAt,url,headBranch", "--limit", "10"],
        { encoding: "utf8" }
      )
    );
  } catch {
    return [];
  }
}

function listRecentlyMergedPullRequests() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    return JSON.parse(
      execFileSync(
        "gh",
        ["pr", "list", "--repo", repo, "--state", "merged", "--search", `merged:>=${since}`, "--json", "number,title,mergedAt,url,headRefName", "--limit", "20"],
        { encoding: "utf8" }
      )
    );
  } catch {
    return [];
  }
}

function detectSourceOfTruthChanges() {
  try {
    const changedFiles = execFileSync("git", ["diff", "--name-only", "HEAD~1", "HEAD", "--", "source-of-truth", "agents", "docs/AGENT_ARCHITECTURE.md"], {
      encoding: "utf8"
    })
      .split(/\r?\n/)
      .filter(Boolean);

    return {
      changed: changedFiles.length > 0,
      files: changedFiles
    };
  } catch {
    return {
      changed: false,
      files: []
    };
  }
}

function withStaleState(item, date) {
  const updatedAt = item.updatedAt || item.createdAt || item.mergedAt;
  const hoursSinceUpdated = updatedAt ? Math.round((date.getTime() - new Date(updatedAt).getTime()) / 36_000) / 100 : 0;

  return {
    ...item,
    hoursSinceUpdated,
    isStale: hoursSinceUpdated >= staleHours
  };
}

function withWorkflowVisibility(issue) {
  const comments = readIssueComments(issue.number);
  const hasPromptFactoryComment = comments.some((comment) => /AI prompt factory (finished|failed)/i.test(comment.body || ""));
  const hasWorkflowRunLink = comments.some((comment) => /\/actions\/runs\//i.test(comment.body || ""));
  const monitorMarkerPresent = comments.some((comment) => comment.body?.includes(marker));
  const hasAiLabel = issue.labels?.some((label) => String(label.name || "").startsWith("ai:"));

  return {
    ...issue,
    workflowVisibility: {
      hasPromptFactoryComment,
      hasWorkflowRunLink,
      monitorMarkerPresent,
      needsWorkflowStartAttention: Boolean(hasAiLabel && !hasPromptFactoryComment)
    }
  };
}

function readIssueComments(issueNumber) {
  try {
    const details = JSON.parse(
      execFileSync("gh", ["issue", "view", String(issueNumber), "--repo", repo, "--json", "comments"], {
        encoding: "utf8"
      })
    );
    return Array.isArray(details.comments) ? details.comments : [];
  } catch {
    return [];
  }
}

function readMonitorConfig() {
  const configPath = path.join(process.cwd(), "monitor.config.yaml");
  const fallback = {
    staleHours: 24,
    maxCommentsPerRun: 10,
    dryRunDefault: false,
    labels: []
  };

  if (!fs.existsSync(configPath)) return fallback;

  const source = fs.readFileSync(configPath, "utf8");
  const configResult = { ...fallback };
  let section = "";

  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const topLevel = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (topLevel) {
      section = topLevel[1];
      const value = topLevel[2].trim();
      if (section === "stale_hours") configResult.staleHours = Number.parseInt(value, 10) || fallback.staleHours;
      if (section === "max_comments_per_run") configResult.maxCommentsPerRun = Number.parseInt(value, 10) || fallback.maxCommentsPerRun;
      if (section === "dry_run_default") configResult.dryRunDefault = value === "true";
      continue;
    }

    if (section === "labels") {
      const item = line.match(/^  -\s*(.+)$/)?.[1]?.trim();
      if (item) configResult.labels.push(item);
    }
  }

  return configResult;
}
