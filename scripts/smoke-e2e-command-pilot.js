import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-e2e-command-pilot-"));
const agentRunRoot = path.join(smokeRoot, "agent-run");
const pilotRoot = path.join(agentRunRoot, "pilot");
const pilotOutput = path.join(pilotRoot, "pilot-app-build.json");

runNode("scripts/run-e2e-command-pilot.js", {
  AGENT_RUN_DIR: agentRunRoot,
  GITHUB_ACTIONS: "true",
  PILOT_APP_NAME: "Spark of Hope Intake Lite",
  PILOT_APP_SLUG: "spark-of-hope-intake-lite",
  SOURCE_ISSUE_NUMBER: "3100",
  SOURCE_ISSUE_URL: "https://github.com/lincolnnunnally/AppEngine/issues/3100"
});

const pilot = readJson(pilotOutput);
const issueBody = fs.readFileSync(path.join(pilotRoot, "chatgpt-handoff-issue.md"), "utf8");
const handoffPacket = readJson(path.join(pilotRoot, "chatgpt-handoff-packet.json"));
const intakePacket = readJson(path.join(pilotRoot, "intake-packet.json"));
const buildPacket = readJson(path.join(pilotRoot, "app-build-packet.json"));
const dryRun = readJson(path.join(pilotRoot, "follow-up-issues.json"));
const followUpTasks = readJson(path.join(pilotRoot, "follow-up-tasks.json"));

runNode("scripts/persist-agent-run-artifacts.js", {
  AGENT_RUN_DIR: agentRunRoot,
  GITHUB_REPOSITORY: "lincolnnunnally/AppEngine",
  GITHUB_RUN_ID: "999",
  SOURCE_ISSUE_NUMBER: "3100",
  SOURCE_ISSUE_URL: "https://github.com/lincolnnunnally/AppEngine/issues/3100"
});

const artifactSummary = fs.readFileSync(path.join(agentRunRoot, "artifact-summary.md"), "utf8");
const durableFollowUpTasks = readJson(path.join(agentRunRoot, "follow-up-tasks.json"));
const durableDryRun = readJson(path.join(agentRunRoot, "follow-up-issues-dry-run.json"));

assertEqual(pilot.kind, "pilot_app_build", "pilot artifact kind");
assertEqual(pilot.pilot.mode, "dry_run", "pilot is dry run");
assertEqual(pilot.pilot.slug, "spark-of-hope-intake-lite", "pilot slug");
assertEqual(pilot.issue.label, "ai:plan", "pilot issue label");
assertIncludes(issueBody, "## Machine Handoff", "issue body includes handoff JSON");
assertEqual(handoffPacket.kind, "chatgpt_handoff_packet", "handoff packet kind");
assertEqual(intakePacket.kind, "intake_packet", "intake packet kind");
assertEqual(intakePacket.selectedWorkflow.packetKind, "app_build_packet", "intake selects app build packet");
assertEqual(buildPacket.kind, "app_build_packet", "app build packet kind");
assertEqual(pilot.workflow.selectedPacket, "app_build_packet", "pilot selected packet");
assertEqual(pilot.release.status, "not_deployed", "pilot release status");
assertEqual(pilot.release.productionDeployAllowed, false, "pilot blocks production");
assertEqual(pilot.artifacts.structuredFollowUpTasks, "follow-up-tasks.json", "pilot records structured follow-up tasks");
assertEqual(pilot.guardrails.dryRunOnly, true, "pilot dry run guardrail");
assertEqual(pilot.guardrails.noProductionDeploy, true, "pilot production guardrail");
assertEqual(pilot.guardrails.noPaidResources, true, "pilot paid resources guardrail");
assertEqual(pilot.guardrails.noGeneratedCodeMergeWithoutReview, true, "pilot code merge guardrail");
assertEqual(followUpTasks.kind, "follow_up_tasks", "pilot writes structured follow-up task file");
assertEqual(followUpTasks.followUpTasks.length, 6, "pilot writes first six structured follow-up tasks");
assertIncludes(artifactSummary, "Download the GitHub Actions artifact named `agent-run`", "artifact summary points to durable action artifact");
assertIncludes(artifactSummary, "pilot/pilot-app-build.json", "artifact summary lists pilot artifact");
assertEqual(durableFollowUpTasks.followUpTasks.length, 6, "durable follow-up task file is persisted");
assertEqual(durableDryRun.issues.length, 6, "durable dry-run issue preview is persisted");
assertArrayIncludes(dryRun.issues.map((issue) => issue.title), "[spark-of-hope-intake-lite] Phase: Discovery", "dry run creates discovery issue");
assertArrayIncludes(dryRun.issues.map((issue) => issue.title), "[spark-of-hope-intake-lite] Phase: Charter", "dry run creates charter issue");
assertArrayIncludes(dryRun.issues.map((issue) => issue.title), "[spark-of-hope-intake-lite] Phase: Provider/Cost", "dry run creates provider cost issue");
assertArrayIncludes(dryRun.issues.map((issue) => issue.label), "ai:plan", "dry run includes plan issue");
assertIncludes(JSON.stringify(pilot), "Review dry-run follow-up issues", "pilot records next action");

console.log(`e2e-command-pilot smoke ok (${smokeRoot})`);

function runNode(scriptPath, env) {
  return execFileSync(process.execPath, [path.join(repoRoot, scriptPath)], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(value, expected, message) {
  if (!String(value).includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(value)} to include ${JSON.stringify(expected)}`);
  }
}

function assertArrayIncludes(values, expected, message) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(values)} to include ${JSON.stringify(expected)}`);
  }
}
