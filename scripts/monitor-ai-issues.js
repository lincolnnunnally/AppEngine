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

writeReport();

if (shouldComment) {
  for (const issue of report.issues) {
    if (commentsCreated >= maxCommentsPerRun) break;
    commentIfNeeded(issue);
  }
}

// Dispatch mode (report-and-dispatch): acts on stalled/failed work per the
// dispatch rules in monitor.config.yaml. Both the config flag AND the
// MONITOR_DISPATCH env must be true; dry-run logs without executing. Retry
// caps persist via dispatch marker comments (issues) and GitHub's own run
// attempt counter (workflow reruns). Every action lands in report.actions.
const dispatchMarker = "<!-- appengine-monitor-dispatch";
const shouldDispatch = config.dispatch.enabled && process.env.MONITOR_DISPATCH === "true";

if (shouldDispatch) {
  runDispatchRules();
  writeReport();
}

function writeReport() {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote monitor report to ${outputPath}`);
}

function runDispatchRules() {
  // Cost governance kill switch: when the owner (or the pipeline) sets the
  // APPENGINE_COST_GOVERNANCE_PAUSED repository variable to "true", dispatch
  // drops back to report-only — a budget pause must never be re-triggered as if
  // it were a stall. Suppression itself is recorded so the owner sees it.
  if (config.dispatch.respectCostGovernance && process.env.APPENGINE_COST_GOVERNANCE_PAUSED === "true") {
    recordAction("cost_governance", "all rules", "dispatch suppressed: pause_for_budget active, owner approval required", 0, false);
    return;
  }

  const maxDispatchesPerRun = 5;
  // Dispatch acts only on FRESH stalls (stale >= stale_hours but updated within a
  // week). Ancient backlog issues stay report-only so activation does not create a
  // burst of retries/recovery issues for long-abandoned work.
  const dispatchWindowHours = 24 * 7;
  const isFreshStall = (issue) => issue.isStale && issue.hoursSinceUpdated <= dispatchWindowHours;
  let dispatched = 0;

  // Rule: stalled_build — an ai:* issue that never started a workflow and went
  // stale gets its label re-applied (fires the prompt factory's `labeled` event).
  for (const issue of report.issues) {
    if (dispatched >= maxDispatchesPerRun) break;
    if (!isFreshStall(issue) || !issue.workflowVisibility?.needsWorkflowStartAttention) continue;

    const retries = countDispatchComments(issue.number, "stalled_build");
    if (retries >= config.dispatch.maxRetries.stalled_build) {
      recordAction("stalled_build", `issue #${issue.number}`, `max retries reached (${retries})`, retries, false);
      continue;
    }

    const aiLabel = issue.labels?.map((label) => String(label.name || "")).find((name) => name.startsWith("ai:"));
    if (!aiLabel) continue;

    if (dryRun) {
      console.log(`Dry run: would re-apply ${aiLabel} on issue #${issue.number} (retry ${retries + 1}).`);
      recordAction("stalled_build", `issue #${issue.number}`, `dry run: would re-apply ${aiLabel}`, retries + 1, false);
      continue;
    }

    try {
      execFileSync("gh", ["issue", "edit", String(issue.number), "--repo", repo, "--remove-label", aiLabel], ghOptions());
      execFileSync("gh", ["issue", "edit", String(issue.number), "--repo", repo, "--add-label", aiLabel], ghOptions());
      addDispatchComment(issue.number, "stalled_build", retries + 1, `Re-applied \`${aiLabel}\` to restart the stalled phase.`);
      recordAction("stalled_build", `issue #${issue.number}`, `re-applied ${aiLabel}`, retries + 1, true);
      dispatched += 1;
    } catch (error) {
      recordAction("stalled_build", `issue #${issue.number}`, `dispatch failed: ${describeError(error)}`, retries, false);
    }
  }

  // Rule: failed_workflow — re-run a failed pipeline run ONCE (first attempt
  // only; GitHub's attempt counter enforces once-only across monitor runs).
  // Release/production/deploy workflows are never auto-rerun.
  const skipPatterns = config.dispatch.skipWorkflowNamePatterns;
  const rerunPatterns = config.dispatch.rerunWorkflowNamePatterns;
  for (const run of report.failedWorkflowRuns) {
    if (dispatched >= maxDispatchesPerRun) break;
    const name = String(run.name || "");
    // Allowlist first: only pipeline workflows are rerun candidates at all
    // (a failed PR verification is a code failure, not a stall).
    if (!rerunPatterns.some((pattern) => name.toLowerCase().includes(pattern))) continue;
    if (skipPatterns.some((pattern) => name.toLowerCase().includes(pattern))) {
      recordAction("failed_workflow", name, "skipped by safety name pattern", 0, false);
      continue;
    }

    let attempt = 0;
    try {
      attempt = Number(JSON.parse(execFileSync("gh", ["run", "view", String(run.databaseId), "--repo", repo, "--json", "attempt"], ghOptions())).attempt || 0);
    } catch {
      continue;
    }
    if (attempt !== 1) {
      recordAction("failed_workflow", `${name} #${run.databaseId}`, `already retried (attempt ${attempt})`, attempt - 1, false);
      continue;
    }

    if (dryRun) {
      console.log(`Dry run: would re-run failed workflow ${name} (#${run.databaseId}).`);
      recordAction("failed_workflow", `${name} #${run.databaseId}`, "dry run: would re-run", 1, false);
      continue;
    }

    try {
      execFileSync("gh", ["run", "rerun", String(run.databaseId), "--repo", repo, "--failed"], ghOptions());
      recordAction("failed_workflow", `${name} #${run.databaseId}`, "re-ran failed jobs once", 1, true);
      dispatched += 1;
    } catch (error) {
      recordAction("failed_workflow", `${name} #${run.databaseId}`, `rerun failed: ${describeError(error)}`, 0, false);
    }
  }

  // Rule: incomplete_phase — a stale issue that DID start a workflow but never
  // produced a follow-up gets one recovery issue for the fix agent.
  let recoveriesCreated = 0;
  for (const issue of report.issues) {
    if (dispatched >= maxDispatchesPerRun || recoveriesCreated >= 2) break;
    const visibility = issue.workflowVisibility || {};
    if (!isFreshStall(issue) || !visibility.hasPromptFactoryComment || visibility.needsWorkflowStartAttention) continue;
    // Never create a recovery for a recovery — caps the chain at one generation.
    if (/^Recovery: issue #\d+ stalled/.test(issue.title || "")) continue;

    const retries = countDispatchComments(issue.number, "incomplete_phase");
    if (retries >= config.dispatch.maxRetries.incomplete_phase) continue;

    if (dryRun) {
      console.log(`Dry run: would create a recovery issue for #${issue.number}.`);
      recordAction("incomplete_phase", `issue #${issue.number}`, "dry run: would create recovery issue", retries + 1, false);
      continue;
    }

    try {
      const body = [
        `Issue #${issue.number} started a workflow but stalled without a follow-up (stale for ${issue.hoursSinceUpdated} hours).`,
        "",
        "Diagnose the stall, finish or re-run the phase, and produce the follow-up handoff.",
        "",
        `Created automatically by the orchestration monitor (rule: incomplete_phase).`
      ].join("\n");
      execFileSync(
        "gh",
        ["issue", "create", "--repo", repo, "--title", `Recovery: issue #${issue.number} stalled after phase start`, "--label", "ai:fix", "--body", body],
        ghOptions()
      );
      addDispatchComment(issue.number, "incomplete_phase", retries + 1, "Created a recovery issue for this stalled phase.");
      recordAction("incomplete_phase", `issue #${issue.number}`, "created recovery issue", retries + 1, true);
      dispatched += 1;
      recoveriesCreated += 1;
    } catch (error) {
      recordAction("incomplete_phase", `issue #${issue.number}`, `recovery creation failed: ${describeError(error)}`, retries, false);
    }
  }

  console.log(`Dispatch pass complete: ${dispatched} action(s) executed, ${report.actions.length} recorded.`);
}

function countDispatchComments(issueNumber, rule) {
  return readIssueComments(issueNumber).filter((comment) => (comment.body || "").includes(`${dispatchMarker} rule:${rule}`)).length;
}

function addDispatchComment(issueNumber, rule, retry, message) {
  const body = [`${dispatchMarker} rule:${rule} retry:${retry} -->`, message, `Retry ${retry} of ${config.dispatch.maxRetries[rule]}.`].join("\n");
  execFileSync("gh", ["issue", "comment", String(issueNumber), "--repo", repo, "--body", body], ghOptions());
}

function recordAction(rule, target, detail, retryCount, executed) {
  report.actions.push({ rule, target, detail, retryCount, executed, at: new Date().toISOString() });
  console.log(`[dispatch:${rule}] ${target} — ${detail}`);
}

function describeError(error) {
  return error instanceof Error ? error.message.split("\n")[0] : "unknown error";
}

function ghOptions() {
  return { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
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
    labels: [],
    dispatch: parseDispatchConfig("")
  };

  if (!fs.existsSync(configPath)) return fallback;

  const source = fs.readFileSync(configPath, "utf8");
  const configResult = { ...fallback, dispatch: parseDispatchConfig(source) };
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

// Parses only the dispatch section (nested YAML the line parser above skips).
// Defaults are dispatch-disabled with conservative retry caps.
function parseDispatchConfig(source) {
  const dispatch = {
    enabled: false,
    respectCostGovernance: true,
    maxRetries: { stalled_build: 3, failed_workflow: 1, incomplete_phase: 1 },
    skipWorkflowNamePatterns: ["release", "production", "deploy"],
    // Reruns are ALLOWLISTED to pipeline workflows: a failed PR verification or
    // other code-failure workflow is not a stall and must not be auto-rerun.
    rerunWorkflowNamePatterns: ["ai prompt factory"]
  };

  const block = source.match(/^dispatch:\r?\n((?:[ ]{2,}.*\r?\n?)*)/m)?.[1];
  if (!block) return dispatch;

  dispatch.enabled = /^\s*enabled:\s*true\s*$/m.test(block);
  // Default is true; only an explicit false in the safety block turns it off.
  dispatch.respectCostGovernance = !/^\s*respect_cost_governance:\s*false\s*$/m.test(block);

  const rerunBlock = block.match(/rerun_workflow_name_patterns:\r?\n((?:\s+-\s*.+\r?\n?)*)/)?.[1];
  if (rerunBlock) {
    const patterns = [...rerunBlock.matchAll(/-\s*(.+)/g)].map((match) => match[1].trim().toLowerCase()).filter(Boolean);
    if (patterns.length) dispatch.rerunWorkflowNamePatterns = patterns;
  }

  for (const rule of block.matchAll(/- trigger:\s*(\w+)[\s\S]*?max_retries:\s*(\d+)/g)) {
    const trigger = rule[1];
    const retries = Number.parseInt(rule[2], 10);
    if (trigger in dispatch.maxRetries && Number.isFinite(retries)) {
      dispatch.maxRetries[trigger] = retries;
    }
  }

  const patternsBlock = block.match(/skip_workflow_name_patterns:\r?\n((?:\s+-\s*.+\r?\n?)*)/)?.[1];
  if (patternsBlock) {
    const patterns = [...patternsBlock.matchAll(/-\s*(.+)/g)].map((match) => match[1].trim().toLowerCase()).filter(Boolean);
    if (patterns.length) dispatch.skipWorkflowNamePatterns = patterns;
  }

  return dispatch;
}
