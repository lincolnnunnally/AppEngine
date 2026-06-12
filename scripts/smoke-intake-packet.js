import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-intake-packet-"));
const newInput = path.join(smokeRoot, "new-app-input.json");
const newPacketOutput = path.join(smokeRoot, "new-app-intake.json");
const newFollowUpsOutput = path.join(smokeRoot, "new-app-follow-ups.json");
const existingInput = path.join(smokeRoot, "existing-app-input.json");
const existingPacketOutput = path.join(smokeRoot, "existing-app-intake.json");
const existingFollowUpsOutput = path.join(smokeRoot, "existing-app-follow-ups.json");
const featureInput = path.join(smokeRoot, "feature-input.json");
const featurePacketOutput = path.join(smokeRoot, "feature-intake.json");
const multiInput = path.join(smokeRoot, "multi-app-input.json");
const multiPacketOutput = path.join(smokeRoot, "multi-app-intake.json");
const codexOutput = path.join(smokeRoot, "codex-output.md");
const issuesOutput = path.join(smokeRoot, "dry-run-issues.json");

const knownApps = [
  {
    name: "Spark of Hope",
    slug: "spark-of-hope",
    aliases: ["spark", "spark stories"],
    currentVersion: "v1",
    charterPath: "source-of-truth/charters/spark-of-hope.md",
    registrySource: "Super Admin registry: spark-of-hope",
    releaseHistorySource: "Release history: spark-of-hope",
    monitoringSource: "Monitoring report: spark-of-hope",
    openIssuesSource: "GitHub issues: app:spark-of-hope",
    knownIssues: ["story intake needs clearer church workflow"]
  },
  {
    name: "Toner Management",
    slug: "toner-management",
    aliases: ["toner", "printer toner"],
    currentVersion: "v1",
    charterPath: "source-of-truth/charters/toner-management.md",
    registrySource: "Super Admin registry: toner-management",
    releaseHistorySource: "Release history: toner-management",
    monitoringSource: "Monitoring report: toner-management",
    openIssuesSource: "GitHub issues: app:toner-management",
    knownIssues: ["service package chooser needs follow-up"]
  }
];

runStep("new app intake routes to App Build Packet", () => {
  writeJson(newInput, {
    rawRequest: "Build a Hope Stories app for churches",
    source: {
      type: "github_issue",
      issueNumber: "2001",
      issueUrl: "https://github.com/lincolnnunnally/AppEngine/issues/2001"
    },
    knownApps: []
  });

  runNode("scripts/create-intake-packet.js", {
    INTAKE_INPUT: newInput,
    INTAKE_PACKET_OUTPUT: newPacketOutput,
    INTAKE_FOLLOWUPS_OUTPUT: newFollowUpsOutput
  });

  const packet = readJson(newPacketOutput);
  const followUps = readJson(newFollowUpsOutput);

  assertEqual(packet.kind, "intake_packet", "new app intake kind");
  assertEqual(packet.requestType, "new_app", "new app request type");
  assertEqual(packet.inferredApp.status, "new", "new app selection status");
  assertEqual(packet.selectedWorkflow.packetKind, "app_build_packet", "new app routes to app build packet");
  assertEqual(packet.selectedWorkflow.nextGenerator, "scripts/create-app-build-packet.js", "new app next generator");
  assertArrayIncludes(packet.nextIssueLabels, "ai:plan", "new app next label");
  assertEqual(packet.guardrails.newAppsRequireAppBuildPacket, true, "new app requires packet guardrail");
  assertIncludes(followUps.followUpTasks[0].title, "App Build Packet", "new app follow-up title");
  assertIncludes(followUps.followUpTasks[0].body, "Do not build the app directly from this raw request.", "new app follow-up blocks raw build");
});

runStep("existing app intake routes to vNext Packet after context load", () => {
  writeJson(existingInput, {
    rawRequest: "Improve Spark of Hope story intake for churches",
    source: {
      type: "github_issue",
      issueNumber: "2002",
      issueUrl: "https://github.com/lincolnnunnally/AppEngine/issues/2002"
    },
    knownApps
  });

  runNode("scripts/create-intake-packet.js", {
    INTAKE_INPUT: existingInput,
    INTAKE_PACKET_OUTPUT: existingPacketOutput,
    INTAKE_FOLLOWUPS_OUTPUT: existingFollowUpsOutput
  });

  const packet = readJson(existingPacketOutput);
  const followUps = readJson(existingFollowUpsOutput);

  assertEqual(packet.kind, "intake_packet", "existing app intake kind");
  assertEqual(packet.requestType, "improvement", "existing app request type");
  assertEqual(packet.inferredApp.status, "existing", "existing app selection status");
  assertEqual(packet.inferredApp.slug, "spark-of-hope", "existing app slug");
  assertEqual(packet.selectedWorkflow.packetKind, "vnext_packet", "existing app routes to vNext");
  assertEqual(packet.selectedWorkflow.nextGenerator, "scripts/create-vnext-packet.js", "existing app next generator");
  assertEqual(packet.missingContext.length, 0, "existing app missing context");
  assertEqual(packet.appContext.charterLoaded, true, "existing app charter loaded");
  assertEqual(packet.appContext.registryLoaded, true, "existing app registry loaded");
  assertEqual(packet.appContext.currentVersionLoaded, true, "existing app current version loaded");
  assertEqual(packet.appContext.releaseHistoryLoaded, true, "existing app release history loaded");
  assertEqual(packet.appContext.monitoringLoaded, true, "existing app monitoring loaded");
  assertEqual(packet.appContext.openIssuesLoaded, true, "existing app open issues loaded");
  assertArrayIncludes(packet.requiredExistingAppContext, "open issues", "existing app requires open issues");
  assertIncludes(followUps.followUpTasks[0].title, "vNext Packet", "existing app follow-up title");
  assertIncludes(followUps.followUpTasks[0].body, "Do not restart the whole app.", "existing app follow-up blocks restart");
});

runStep("existing feature request keeps app boundary", () => {
  writeJson(featureInput, {
    rawRequest: "Add service reminders to Toner Management",
    knownApps
  });

  runNode("scripts/create-intake-packet.js", {
    INTAKE_INPUT: featureInput,
    INTAKE_PACKET_OUTPUT: featurePacketOutput
  });

  const packet = readJson(featurePacketOutput);

  assertEqual(packet.requestType, "feature", "feature request type");
  assertEqual(packet.inferredApp.slug, "toner-management", "feature app slug");
  assertEqual(packet.selectedWorkflow.packetKind, "vnext_packet", "feature routes to vNext");
  assertEqual(packet.guardrails.existingAppsRequireVNextPacket, true, "feature requires vNext guardrail");
});

runStep("multi-app intake requires clarification", () => {
  writeJson(multiInput, {
    rawRequest: "Improve Spark of Hope and Toner Management",
    knownApps
  });

  runNode("scripts/create-intake-packet.js", {
    INTAKE_INPUT: multiInput,
    INTAKE_PACKET_OUTPUT: multiPacketOutput
  });

  const packet = readJson(multiPacketOutput);

  assertEqual(packet.requestType, "multi_app", "multi-app request type");
  assertEqual(packet.inferredApp.status, "multi_app", "multi-app status");
  assertEqual(packet.inferredApp.candidates.length, 2, "multi-app candidates");
  assertEqual(packet.selectedWorkflow.packetKind, "intake_clarification", "multi-app clarifies");
  assertEqual(packet.guardrails.blocksMultiAppRequests, true, "multi-app guardrail");
  assertArrayIncludes(packet.missingContext, "single selected app", "multi-app missing selected app");
});

runStep("intake follow-up dry run creates packet issues", () => {
  const newPacket = readJson(newPacketOutput);
  const existingPacket = readJson(existingPacketOutput);

  fs.writeFileSync(
    codexOutput,
    [
      "Intake packet follow-up output",
      "",
      "```json",
      JSON.stringify(
        {
          agent: "planner",
          status: "needs_follow_up",
          summary: "Created intake packets for new and existing app requests.",
          artifacts: [
            {
              kind: "intake_packet",
              title: "New App Intake Packet",
              content: newPacket
            },
            {
              kind: "intake_packet",
              title: "Existing App Intake Packet",
              content: existingPacket
            }
          ],
          findings: [],
          followUpTasks: [...newPacket.followUpTasks, ...existingPacket.followUpTasks],
          handoffTo: ["planner"]
        },
        null,
        2
      ),
      "```",
      ""
    ].join("\n")
  );

  runNode("scripts/create-follow-up-issues.js", {
    CODEX_OUTPUT_FILE: codexOutput,
    FOLLOW_UP_DRY_RUN: "true",
    FOLLOW_UP_OUTPUT: issuesOutput,
    MAX_FOLLOW_UP_ISSUES: "10",
    SOURCE_ISSUE_NUMBER: "2000",
    SOURCE_ISSUE_URL: "https://github.com/lincolnnunnally/AppEngine/issues/2000"
  });

  const dryRun = readJson(issuesOutput);

  assertEqual(dryRun.issues.length, 2, "intake dry run issue count");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.title), "[hope-stories] Intake: Create App Build Packet", "dry run creates app build packet issue");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.title), "[spark-of-hope] Intake: Create vNext Packet", "dry run creates vNext issue");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.label), "ai:plan", "dry run labels intake follow-ups");
  assertIncludes(dryRun.issues[0].body, "Source issue: #2000", "dry run includes source issue");
});

console.log(`intake-packet smoke ok (${smokeRoot})`);

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function runNode(scriptPath, env) {
  return execFileSync(process.execPath, [path.join(repoRoot, scriptPath)], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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
