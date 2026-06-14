import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-vnext-packet-"));
const packetOutput = path.join(smokeRoot, "vnext-packet.json");
const followUpsOutput = path.join(smokeRoot, "vnext-follow-ups.json");
const codexOutput = path.join(smokeRoot, "codex-output.md");
const issuesOutput = path.join(smokeRoot, "dry-run-issues.json");

const requiredPhaseIds = [
  "current_state",
  "change_scope",
  "provider_cost_delta",
  "design_update",
  "build_update",
  "regression_testing",
  "release_gate",
  "monitoring_update"
];

runStep("vNext packet creation", () => {
  runNode("scripts/create-vnext-packet.js", {
    VNEXT_PACKET_OUTPUT: packetOutput,
    VNEXT_FOLLOWUPS_OUTPUT: followUpsOutput,
    APP_NAME: "Spark of Hope",
    APP_SLUG: "spark-of-hope",
    APP_CURRENT_VERSION: "v1",
    APP_TARGET_VERSION: "v1.1",
    APP_IMPROVEMENT_TYPE: "ux",
    APP_IMPROVEMENT_SUMMARY: "Make the story intake flow easier for churches to use.",
    APP_FEEDBACK_SOURCE: "Lincoln request",
    APP_BARRIER_REMOVED: "Remove mobile friction in the story intake path.",
    APP_NEED_ADDRESSED: "Church teams need a clearer story intake flow for people using phones.",
    APP_MOVEMENT_TOWARD_LIFE: "Story sharers can move from hesitation toward being heard and encouraged.",
    APP_TRANSFORMATION_OUTCOME: "Church teams become more capable of receiving hope-filled stories with care.",
    APP_TOOL_CLASSIFICATION: "direct_transformation",
    APP_KNOWN_ISSUES: "mobile intake friction|church admin needs clearer next action",
    APP_IMPROVEMENT_NON_GOALS: "do not rebuild the whole app|do not add unrelated church CRM features"
  });

  const packet = readJson(packetOutput);

  assertEqual(packet.kind, "vnext_packet", "vNext kind");
  assertEqual(packet.app.currentVersion, "v1", "current version");
  assertEqual(packet.app.targetVersion, "v1.1", "target version");
  assertEqual(packet.context.charterLoaded, true, "charter loaded");
  assertEqual(packet.context.registryLoaded, true, "registry loaded");
  assertEqual(packet.context.monitoringLoaded, true, "monitoring loaded");
  assertEqual(packet.context.knownIssuesLoaded, true, "known issues loaded");
  assertEqual(packet.context.releaseHistoryLoaded, true, "release history loaded");
  assertEqual(packet.providerCostDelta.costReviewRequired, true, "cost delta required");
  assertEqual(packet.change.barrierRemoved, "Remove mobile friction in the story intake path.", "vNext barrier removed");
  assertEqual(packet.change.toolClassification, "direct_transformation", "vNext tool classification");
  assertArrayIncludes(packet.sourceOfTruth.requiredFiles, "source-of-truth/00-why-we-build.md", "vNext requires why we build");
  assertArrayIncludes(packet.sourceOfTruth.requiredFiles, "source-of-truth/cost-governance-model-routing.md", "vNext requires cost governance standard");
  assertEqual(packet.buildCompletion.costGovernanceRequired, true, "vNext build completion requires cost governance");
  assertEqual(packet.guardrails.doNotRestartWholeApp, true, "does not restart app");
  assertEqual(packet.guardrails.preventGoalBleed, true, "prevents goal bleed");
  assertIncludes(packet.change.nonGoals.join(" "), "do not rebuild the whole app", "non-goal prevents rebuild");

  for (const id of requiredPhaseIds) {
    assertArrayIncludes(packet.phases.map((phase) => phase.id), id, `vNext includes ${id}`);
  }

  assertEqual(packet.followUpTasks.length, requiredPhaseIds.length, "one follow-up per vNext phase");
});

runStep("vNext follow-up dry run creates issues", () => {
  const packet = readJson(packetOutput);
  const followUps = readJson(followUpsOutput);

  fs.writeFileSync(
    codexOutput,
    [
      "vNext packet follow-up output",
      "",
      "```json",
      JSON.stringify(
        {
          agent: "planner",
          status: "needs_follow_up",
          summary: "Created a vNext packet.",
          artifacts: [
            {
              kind: "vnext_packet",
              title: "Spark of Hope vNext Packet",
              content: packet
            }
          ],
          findings: [],
          followUpTasks: followUps.followUpTasks,
          handoffTo: ["planner", "designer", "builder", "workflow_tester", "monitor"]
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
    MAX_FOLLOW_UP_ISSUES: "20",
    SOURCE_ISSUE_NUMBER: "1006",
    SOURCE_ISSUE_URL: "https://github.com/lincolnnunnally/AppEngine/issues/1006"
  });

  const dryRun = readJson(issuesOutput);
  assertEqual(dryRun.issues.length, requiredPhaseIds.length, "vNext dry run issue count");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.title), "[spark-of-hope] vNext: Current State Review", "dry run creates current state issue");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.title), "[spark-of-hope] vNext: Provider/Cost Delta", "dry run creates provider cost issue");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.title), "[spark-of-hope] vNext: Build Update", "dry run creates build issue");
  assertIncludes(dryRun.issues[0].body, "Current version: v1", "dry run includes current version");
  assertIncludes(dryRun.issues[0].body, "Target version: v1.1", "dry run includes target version");
  assertIncludes(dryRun.issues[0].body, "source-of-truth/00-why-we-build.md", "dry run includes why we build");
  assertIncludes(dryRun.issues[0].body, "source-of-truth/cost-governance-model-routing.md", "dry run includes cost governance standard");
  assertIncludes(dryRun.issues[0].body, "Tool classification: direct_transformation", "dry run includes classification");
  assertIncludes(dryRun.issues[0].body, "Do not restart the whole app.", "dry run includes restart guardrail");
  assertIncludes(dryRun.issues[0].body, "Source issue: #1006", "dry run includes source issue");
});

console.log(`vnext-packet smoke ok (${smokeRoot})`);

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
