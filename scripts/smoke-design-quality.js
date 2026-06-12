import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-design-quality-"));
const packetOutput = path.join(smokeRoot, "app-build-packet.json");
const packetFollowUpsOutput = path.join(smokeRoot, "packet-follow-ups.json");
const designOutput = path.join(smokeRoot, "design-review-output.json");
const designArtifactOutput = path.join(smokeRoot, "design-review.json");
const designFollowUpsOutput = path.join(smokeRoot, "design-follow-ups.json");
const codexOutput = path.join(smokeRoot, "codex-output.md");
const issuesOutput = path.join(smokeRoot, "dry-run-issues.json");

runStep("packet produces design quality phases", () => {
  runNode("scripts/create-app-build-packet.js", {
    APP_BUILD_PACKET_OUTPUT: packetOutput,
    APP_BUILD_PACKET_FOLLOWUPS_OUTPUT: packetFollowUpsOutput,
    APP_NAME: "Kind Help Desk",
    APP_SLUG: "kind-help-desk",
    APP_PURPOSE: "Help small service teams receive requests, organize follow-up, and serve people clearly.",
    APP_AUDIENCE: "small nonprofit teams|church staff|service coordinators",
    APP_EMOTIONAL_FIT: "Warm, calm, trustworthy, and practical for service coordinators.",
    APP_SUCCESS_DEFINITION: "A coordinator can receive, triage, assign, resolve, and monitor one request."
  });

  const packet = readJson(packetOutput);
  const phaseIds = packet.phases.map((phase) => phase.id);
  const designIssue = packet.followUpTasks.find((task) => task.title.includes("Design Quality"));
  const uxIssue = packet.followUpTasks.find((task) => task.title.includes("UX Review"));

  assertArrayIncludes(phaseIds, "design_quality", "packet includes design quality phase");
  assertArrayIncludes(phaseIds, "ux_review", "packet includes UX review phase");
  assertEqual(packet.app.designReview.kind, "design_review", "packet embeds design review artifact");
  assertEqual(packet.app.designReview.reviewers.designerRequired, true, "packet requires designer");
  assertEqual(packet.app.designReview.reviewers.customerPerspectiveRequired, true, "packet requires customer perspective");
  assertArrayIncludes(packet.app.designReview.qualityChecks.map((check) => check.id), "simple_navigation", "packet simple navigation check");
  assertArrayIncludes(packet.app.designReview.qualityChecks.map((check) => check.id), "clear_primary_action", "packet primary action check");
  assertArrayIncludes(packet.app.designReview.qualityChecks.map((check) => check.id), "mobile_first_layout", "packet mobile check");
  assertArrayIncludes(packet.app.designReview.stateChecks, "empty states", "packet empty state check");
  assertArrayIncludes(packet.app.designReview.stateChecks, "error states", "packet error state check");
  assertArrayIncludes(packet.app.designReview.stateChecks, "onboarding", "packet onboarding check");
  assertArrayIncludes(packet.app.designReview.stateChecks, "admin screens", "packet admin screen check");
  assertEqual(packet.app.designReview.guardrails.blocksUglyOrConfusingApps, true, "packet blocks ugly confusing apps");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "design_quality", "release gate includes design quality");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "customer_perspective_review", "release gate includes customer perspective");
  assertIncludes(designIssue.body, "Designer review", "design phase requires designer review");
  assertIncludes(designIssue.body, "Customer Perspective review", "design phase requires customer perspective review");
  assertIncludes(uxIssue.body, "empty states", "UX issue includes empty states");
  assertIncludes(uxIssue.body, "admin screens", "UX issue includes admin screens");
});

runStep("standalone design generator creates follow-ups", () => {
  runNode("scripts/create-design-quality-standard.js", {
    DESIGN_REVIEW_OUTPUT: designOutput,
    DESIGN_REVIEW_ARTIFACT_OUTPUT: designArtifactOutput,
    DESIGN_REVIEW_FOLLOWUPS_OUTPUT: designFollowUpsOutput,
    APP_NAME: "Kind Help Desk",
    APP_SLUG: "kind-help-desk",
    APP_AUDIENCE: "small nonprofit teams|church staff|service coordinators",
    APP_EMOTIONAL_FIT: "Warm, calm, trustworthy, and practical for service coordinators."
  });

  const design = readJson(designArtifactOutput);
  const combined = readJson(designOutput);

  assertEqual(design.kind, "design_review", "design artifact kind");
  assertArrayIncludes(design.qualityChecks.map((check) => check.id), "trust_building_elements", "design trust check");
  assertArrayIncludes(design.workflowTestChecks, "mobile", "design mobile workflow check");
  assertArrayIncludes(design.workflowTestChecks, "empty states", "design empty state workflow check");
  assertArrayIncludes(design.workflowTestChecks, "error states", "design error state workflow check");
  assertArrayIncludes(design.workflowTestChecks, "onboarding", "design onboarding workflow check");
  assertArrayIncludes(design.workflowTestChecks, "admin screens", "design admin workflow check");
  assertEqual(design.guardrails.blocksReleaseGateApproval, true, "design blocks release approval");
  assertEqual(combined.followUpTasks.length, 3, "design follow-up count");
});

runStep("design follow-up dry run creates issues", () => {
  const combined = readJson(designOutput);

  fs.writeFileSync(
    codexOutput,
    [
      "Design Quality Gate follow-up output",
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
    SOURCE_ISSUE_NUMBER: "1003",
    SOURCE_ISSUE_URL: "https://github.com/lincolnnunnally/AppEngine/issues/1003"
  });

  const dryRun = readJson(issuesOutput);
  assertEqual(dryRun.issues.length, 3, "dry run creates design issues");
  assertIncludes(dryRun.issues[0].title, "Design Quality Gate", "dry run creates design gate issue");
  assertIncludes(dryRun.issues[0].body, "ugly, confusing", "design issue blocks ugly/confusing apps");
  assertIncludes(dryRun.issues[1].title, "Customer Perspective UX review", "dry run creates customer perspective issue");
  assertIncludes(dryRun.issues[1].body, "Emotional fit", "customer perspective issue includes emotional fit");
  assertIncludes(dryRun.issues[2].title, "UX workflow test checks", "dry run creates workflow checks issue");
  assertIncludes(dryRun.issues[2].body, "empty state", "workflow issue includes empty states");
  assertIncludes(dryRun.issues[0].body, "Source issue: #1003", "dry run includes source issue");
});

console.log(`design-quality smoke ok (${smokeRoot})`);

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
