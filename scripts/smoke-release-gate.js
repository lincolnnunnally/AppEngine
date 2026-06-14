import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-release-gate-"));
const packetOutput = path.join(smokeRoot, "app-build-packet.json");
const packetFollowUpsOutput = path.join(smokeRoot, "packet-follow-ups.json");
const releaseOutput = path.join(smokeRoot, "release-gate-output.json");
const deploymentOutput = path.join(smokeRoot, "deployment-environment.json");
const releasePlanOutput = path.join(smokeRoot, "release-plan.json");
const releaseFollowUpsOutput = path.join(smokeRoot, "release-follow-ups.json");
const codexOutput = path.join(smokeRoot, "codex-output.md");
const issuesOutput = path.join(smokeRoot, "dry-run-issues.json");

runStep("packet embeds deployment and release gate", () => {
  runNode("scripts/create-app-build-packet.js", {
    APP_BUILD_PACKET_OUTPUT: packetOutput,
    APP_BUILD_PACKET_FOLLOWUPS_OUTPUT: packetFollowUpsOutput,
    APP_NAME: "Kind Help Desk",
    APP_SLUG: "kind-help-desk",
    APP_PURPOSE: "Help small service teams receive requests, organize follow-up, and serve people clearly.",
    APP_AUDIENCE: "small nonprofit teams|church staff|service coordinators",
    APP_SUCCESS_DEFINITION: "A coordinator can receive, triage, assign, resolve, and monitor one request.",
    APP_BACKEND_REQUIRED: "true",
    APP_BACKEND_PROVIDER: "Render",
    APP_PREVIEW_URL: "https://kind-help-desk-preview.vercel.app",
    APP_PRODUCTION_URL: "approval-gated",
    APP_CUSTOM_DOMAIN: "help.example.org",
    APP_LOGS_URL: "planned",
    APP_FILE_UPLOADS_USED: "true",
    APP_PAYMENTS_USED: "true"
  });

  const packet = readJson(packetOutput);
  const phaseIds = packet.phases.map((phase) => phase.id);
  const deploymentPhase = packet.followUpTasks.find((task) => task.title.includes("Deployment Environment"));
  const releasePhase = packet.followUpTasks.find((task) => task.title.includes("Release Gate"));

  assertArrayIncludes(phaseIds, "deployment_environment", "packet includes deployment environment phase");
  assertArrayIncludes(phaseIds, "release_gate", "packet includes release gate phase");
  assertEqual(packet.app.deploymentEnvironment.apiBackend.required, true, "packet marks backend required");
  assertEqual(packet.app.deploymentEnvironment.apiBackend.provider, "Render", "packet backend provider");
  assertEqual(packet.app.deploymentEnvironment.frontend.previewUrl, "https://kind-help-desk-preview.vercel.app", "packet preview URL");
  assertEqual(packet.app.deploymentEnvironment.frontend.productionUrl, "approval-gated", "packet production URL gated");
  assertEqual(packet.app.releaseGate.versioning.launchVersion, "v1", "packet v1 version");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "provider_cost_review", "packet provider cost gate");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "cost_governance", "packet cost governance gate");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "design_quality", "packet design gate");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "customer_perspective_review", "packet customer perspective gate");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "compatibility", "packet compatibility gate");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "safari_mobile", "packet Safari mobile gate");
  assertEqual(packet.app.releaseGate.guardrails.designReviewBeforeRelease, true, "packet release requires design review");
  assertEqual(packet.app.releaseGate.guardrails.costReviewBeforeProvisioning, true, "packet release requires cost review");
  assertEqual(packet.app.releaseGate.guardrails.costGovernanceBeforeModelHeavyWork, true, "packet release requires cost governance");
  assertEqual(packet.app.releaseGate.guardrails.compatibilityBeforeRelease, true, "packet release requires compatibility");
  assertEqual(packet.app.releaseGate.automationContracts.previewDeploy.deploysProduction, false, "preview deploy avoids production");
  assertEqual(packet.app.releaseGate.automationContracts.compatibilityTesting.blocksReleaseApproval, true, "compatibility blocks release approval");
  assertEqual(packet.app.releaseGate.automationContracts.productionApproval.requiresHumanApproval, true, "production requires approval");
  assertIncludes(deploymentPhase.body, "Env vars", "deployment phase includes env var inventory");
  assertIncludes(deploymentPhase.body, "Do not include secret values", "deployment phase prevents secret values");
  assertIncludes(releasePhase.body, "Production approval required", "release phase includes production approval");
  assertIncludes(releasePhase.body, "vNext", "release phase includes vNext rule");
});

runStep("standalone release generator creates follow-ups", () => {
  runNode("scripts/create-release-gate-standard.js", {
    RELEASE_GATE_OUTPUT: releaseOutput,
    DEPLOYMENT_ENVIRONMENT_OUTPUT: deploymentOutput,
    RELEASE_PLAN_OUTPUT: releasePlanOutput,
    RELEASE_GATE_FOLLOWUPS_OUTPUT: releaseFollowUpsOutput,
    APP_NAME: "Kind Help Desk",
    APP_SLUG: "kind-help-desk",
    APP_RELEASE_VERSION: "v1",
    APP_FRONTEND_PROVIDER: "Vercel",
    APP_BACKEND_REQUIRED: "true",
    APP_BACKEND_PROVIDER: "Render",
    APP_DATABASE_PROVIDER: "Neon",
    APP_PREVIEW_URL: "https://kind-help-desk-preview.vercel.app",
    APP_PRODUCTION_URL: "approval-gated",
    APP_CUSTOM_DOMAIN: "help.example.org",
    APP_HEALTH_PATH: "/api/health",
    APP_LOGS_URL: "planned",
    APP_FILE_UPLOADS_USED: "true",
    APP_PAYMENTS_USED: "true"
  });

  const deployment = readJson(deploymentOutput);
  const release = readJson(releasePlanOutput);
  const combined = readJson(releaseOutput);

  assertEqual(deployment.kind, "deployment_environment_plan", "deployment artifact kind");
  assertEqual(deployment.frontend.provider, "Vercel", "deployment frontend provider");
  assertEqual(deployment.apiBackend.provider, "Render", "deployment backend provider");
  assertEqual(deployment.database.provider, "Neon", "deployment database provider");
  assertArrayIncludes(deployment.environmentVariables.map((item) => item.name), "DATABASE_URL", "deployment env vars include database");
  assertEqual(deployment.guardrails.previewBeforeProduction, true, "deployment preview before production");
  assertEqual(deployment.guardrails.productionRequiresReleaseGate, true, "deployment requires release gate");

  assertEqual(release.kind, "release_gate_plan", "release artifact kind");
  assertEqual(release.app.version, "v1", "release version");
  assertArrayIncludes(release.gates.map((gate) => gate.id), "provider_cost_review", "release provider cost gate");
  assertArrayIncludes(release.gates.map((gate) => gate.id), "cost_governance", "release cost governance gate");
  assertArrayIncludes(release.gates.map((gate) => gate.id), "preview_deploy", "release preview gate");
  assertArrayIncludes(release.gates.map((gate) => gate.id), "design_quality", "release design gate");
  assertArrayIncludes(release.gates.map((gate) => gate.id), "customer_perspective_review", "release customer perspective gate");
  assertArrayIncludes(release.gates.map((gate) => gate.id), "compatibility", "release compatibility gate");
  assertArrayIncludes(release.gates.map((gate) => gate.id), "safari_mobile", "release Safari mobile gate");
  assertArrayIncludes(release.gates.map((gate) => gate.id), "common_browsers", "release common browsers gate");
  assertArrayIncludes(release.gates.map((gate) => gate.id), "production_approval", "release production approval gate");
  assertEqual(release.automationContracts.providerCostReview.noPaidResourcesWithoutApproval, true, "release provider cost blocks paid resources");
  assertEqual(release.automationContracts.costGovernance.blocksModelSpendBeyondThreshold, true, "release cost governance blocks threshold spend");
  assertEqual(release.automationContracts.designReview.blocksReleaseApproval, true, "release design review blocks approval");
  assertEqual(release.automationContracts.compatibilityTesting.blocksReleaseApproval, true, "release compatibility blocks approval");
  assertEqual(release.automationContracts.compatibilityTesting.requiresSafariMobile, true, "release compatibility requires Safari mobile");
  assertEqual(release.automationContracts.previewDeploy.deploysProduction, false, "release preview does not deploy production");
  assertEqual(release.automationContracts.productionApproval.requiresHumanApproval, true, "release approval requires human");
  assertEqual(release.guardrails.costReviewBeforeProvisioning, true, "release guardrail requires cost review");
  assertEqual(release.guardrails.costGovernanceBeforeModelHeavyWork, true, "release guardrail requires cost governance");
  assertEqual(release.guardrails.designReviewBeforeRelease, true, "release guardrail requires design review");
  assertEqual(release.guardrails.compatibilityBeforeRelease, true, "release guardrail requires compatibility");
  assertEqual(release.guardrails.vNextAfterV1, true, "release vNext guardrail");
  assertArrayIncludes(combined.artifacts.map((artifact) => artifact.kind), "provider_cost_review", "release output includes provider cost artifact");
  assertArrayIncludes(combined.artifacts.map((artifact) => artifact.kind), "design_review", "release output includes design review artifact");
  assertArrayIncludes(combined.artifacts.map((artifact) => artifact.kind), "compatibility_test_plan", "release output includes compatibility artifact");

  assertEqual(combined.followUpTasks.length, 7, "release generator follow-up count");
  assertArrayIncludes(combined.followUpTasks.map((task) => task.recommendedLabel), "ai:build", "release follow-ups include build");
  assertArrayIncludes(combined.followUpTasks.map((task) => task.recommendedLabel), "ai:review", "release follow-ups include review");
  assertArrayIncludes(combined.followUpTasks.map((task) => task.recommendedLabel), "ai:monitor", "release follow-ups include monitor");
});

runStep("release follow-up dry run creates issues without production deploy", () => {
  const combined = readJson(releaseOutput);

  fs.writeFileSync(
    codexOutput,
    [
      "Deployment Environment and Release Gate follow-up output",
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
    SOURCE_ISSUE_NUMBER: "1002",
    SOURCE_ISSUE_URL: "https://github.com/lincolnnunnally/AppEngine/issues/1002"
  });

  const dryRun = readJson(issuesOutput);
  assertEqual(dryRun.issues.length, 7, "dry run creates release issues");
  assertIncludes(dryRun.issues[0].title, "Provider and cost review", "dry run creates provider cost issue");
  assertIncludes(dryRun.issues[0].body, "Do not create paid provider resources", "provider cost issue blocks paid resources");
  assertIncludes(dryRun.issues[1].title, "Deployment Environment", "dry run creates deployment issue");
  assertIncludes(dryRun.issues[2].title, "Preview deploy", "dry run creates preview issue");
  assertIncludes(dryRun.issues[2].body, "Deploys production: false", "preview issue avoids production");
  assertIncludes(dryRun.issues[3].title, "Design Quality Gate", "dry run creates design gate issue");
  assertIncludes(dryRun.issues[3].body, "Customer Perspective review", "design gate requires customer perspective");
  assertIncludes(dryRun.issues[4].title, "Compatibility Test Plan", "dry run creates compatibility issue");
  assertIncludes(dryRun.issues[4].body, "Safari, mobile", "compatibility gate blocks Safari mobile issues");
  assertIncludes(dryRun.issues[5].title, "Production Release Gate", "dry run creates production gate issue");
  assertIncludes(dryRun.issues[5].body, "Production approval required: true", "production gate requires approval");
  assertIncludes(dryRun.issues[6].title, "Post-launch monitoring", "dry run creates monitor issue");
  assertIncludes(dryRun.issues[0].body, "Source issue: #1002", "dry run includes source issue");
});

console.log(`release-gate smoke ok (${smokeRoot})`);

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
