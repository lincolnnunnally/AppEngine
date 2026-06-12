import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-compatibility-"));
const packetOutput = path.join(smokeRoot, "app-build-packet.json");
const packetFollowUpsOutput = path.join(smokeRoot, "packet-follow-ups.json");
const compatibilityOutput = path.join(smokeRoot, "compatibility-output.json");
const compatibilityPlanOutput = path.join(smokeRoot, "compatibility-plan.json");
const compatibilityFollowUpsOutput = path.join(smokeRoot, "compatibility-follow-ups.json");
const codexOutput = path.join(smokeRoot, "codex-output.md");
const issuesOutput = path.join(smokeRoot, "dry-run-issues.json");

runStep("packet produces compatibility phase and artifact", () => {
  runNode("scripts/create-app-build-packet.js", {
    APP_BUILD_PACKET_OUTPUT: packetOutput,
    APP_BUILD_PACKET_FOLLOWUPS_OUTPUT: packetFollowUpsOutput,
    APP_NAME: "Kind Help Desk",
    APP_SLUG: "kind-help-desk",
    APP_PURPOSE: "Help small service teams receive requests, organize follow-up, and serve people clearly.",
    APP_AUDIENCE: "small nonprofit teams|church staff|service coordinators",
    APP_SUCCESS_DEFINITION: "A coordinator can receive, triage, assign, resolve, and monitor one request.",
    APP_FILE_UPLOADS_USED: "true",
    APP_PAYMENTS_USED: "true"
  });

  const packet = readJson(packetOutput);
  const phaseIds = packet.phases.map((phase) => phase.id);
  const compatibilityIssue = packet.followUpTasks.find((task) => task.title.includes("Compatibility"));

  assertArrayIncludes(phaseIds, "compatibility", "packet includes compatibility phase");
  assertEqual(packet.app.compatibilityTestPlan.kind, "compatibility_test_plan", "packet embeds compatibility artifact");
  assertArrayIncludes(packet.app.compatibilityTestPlan.browserSupport.map((item) => item.id), "iphone_safari", "packet checks iPhone Safari");
  assertArrayIncludes(packet.app.compatibilityTestPlan.browserSupport.map((item) => item.id), "ipad_safari", "packet checks iPad Safari");
  assertArrayIncludes(packet.app.compatibilityTestPlan.browserSupport.map((item) => item.id), "chrome_desktop", "packet checks Chrome desktop");
  assertArrayIncludes(packet.app.compatibilityTestPlan.checks.map((check) => check.id), "touch_targets", "packet touch targets check");
  assertArrayIncludes(packet.app.compatibilityTestPlan.checks.map((check) => check.id), "forms_validation", "packet forms check");
  assertArrayIncludes(packet.app.compatibilityTestPlan.checks.map((check) => check.id), "auth_flows", "packet auth flow check");
  assertArrayIncludes(packet.app.compatibilityTestPlan.checks.map((check) => check.id), "file_uploads_if_used", "packet upload check");
  assertArrayIncludes(packet.app.compatibilityTestPlan.checks.map((check) => check.id), "payments_if_used", "packet payment check");
  assertArrayIncludes(packet.app.compatibilityTestPlan.checks.map((check) => check.id), "admin_screens", "packet admin check");
  assertEqual(packet.app.compatibilityTestPlan.guardrails.blocksReleaseGateApproval, true, "packet compatibility blocks release");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "compatibility", "release gate includes compatibility");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "safari_mobile", "release gate includes Safari/mobile");
  assertEqual(packet.app.releaseGate.guardrails.compatibilityBeforeRelease, true, "release gate requires compatibility");
  assertIncludes(compatibilityIssue.body, "iPhone Safari", "compatibility issue includes iPhone Safari");
  assertIncludes(compatibilityIssue.body, "touch targets", "compatibility issue includes touch targets");
});

runStep("standalone compatibility generator creates follow-ups", () => {
  runNode("scripts/create-compatibility-standard.js", {
    COMPATIBILITY_OUTPUT: compatibilityOutput,
    COMPATIBILITY_PLAN_OUTPUT: compatibilityPlanOutput,
    COMPATIBILITY_FOLLOWUPS_OUTPUT: compatibilityFollowUpsOutput,
    APP_NAME: "Kind Help Desk",
    APP_SLUG: "kind-help-desk",
    APP_FILE_UPLOADS_USED: "true",
    APP_PAYMENTS_USED: "true"
  });

  const compatibility = readJson(compatibilityPlanOutput);
  const combined = readJson(compatibilityOutput);

  assertEqual(compatibility.kind, "compatibility_test_plan", "compatibility artifact kind");
  assertArrayIncludes(compatibility.viewports, "390x844", "compatibility mobile viewport");
  assertArrayIncludes(compatibility.workflowTestChecks, "iPhone Safari", "compatibility workflow iPhone Safari");
  assertArrayIncludes(compatibility.workflowTestChecks, "Firefox desktop", "compatibility workflow Firefox");
  assertEqual(compatibility.conditionalChecks.fileUploadsUsed, true, "compatibility records upload usage");
  assertEqual(compatibility.conditionalChecks.paymentsUsed, true, "compatibility records payment usage");
  assertEqual(compatibility.guardrails.unresolvedCompatibilityIssuesBlockRelease, true, "compatibility blocks unresolved issues");
  assertEqual(combined.followUpTasks.length, 3, "compatibility follow-up count");
});

runStep("compatibility follow-up dry run creates issues", () => {
  const combined = readJson(compatibilityOutput);

  fs.writeFileSync(
    codexOutput,
    [
      "Compatibility follow-up output",
      "",
      "```json",
      JSON.stringify(combined, null, 2),
      "```",
      ""
    ].join("\n")
  );

  runNode("scripts/create-follow-up-issues.js", {
    CODEX_OUTPUT_FILE: codexOutput,
    FOLLOW_UP_DRY_RUN: "true",
    FOLLOW_UP_OUTPUT: issuesOutput,
    MAX_FOLLOW_UP_ISSUES: "10",
    SOURCE_ISSUE_NUMBER: "1004",
    SOURCE_ISSUE_URL: "https://github.com/lincolnnunnally/AppEngine/issues/1004"
  });

  const dryRun = readJson(issuesOutput);
  assertEqual(dryRun.issues.length, 3, "dry run creates compatibility issues");
  assertIncludes(dryRun.issues[0].title, "Compatibility Test Plan", "dry run creates compatibility plan issue");
  assertIncludes(dryRun.issues[0].body, "Safari, mobile", "compatibility issue blocks Safari/mobile issues");
  assertIncludes(dryRun.issues[1].title, "Safari and mobile", "dry run creates Safari mobile issue");
  assertIncludes(dryRun.issues[1].body, "iPhone Safari", "Safari issue includes iPhone Safari");
  assertIncludes(dryRun.issues[2].title, "Common browser", "dry run creates common browser issue");
  assertIncludes(dryRun.issues[2].body, "Firefox desktop", "browser issue includes Firefox");
  assertIncludes(dryRun.issues[0].body, "Source issue: #1004", "dry run includes source issue");
});

console.log(`compatibility smoke ok (${smokeRoot})`);

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
