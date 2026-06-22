import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { writeTestVerdict } from "./lib/require-prior-work.js";

const repoRoot = process.cwd();
const execFileAsync = promisify(execFile);
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-build-completion-"));
const priorWorkVerdict = writeTestVerdict("build_new", smokeRoot);
const packetOutput = path.join(smokeRoot, "app-build-packet.json");
const completionOutput = path.join(smokeRoot, "build-completion-output.json");
const completionPlanOutput = path.join(smokeRoot, "build-completion-plan.json");
const completionFollowUpsOutput = path.join(smokeRoot, "build-completion-follow-ups.json");
const lifecycleOutput = path.join(smokeRoot, "deployment-lifecycle-output.json");
const lifecycleArtifactOutput = path.join(smokeRoot, "deployment-lifecycle-artifact.json");
const previewMissingReviewOutput = path.join(smokeRoot, "preview-missing-review-output.json");
const previewMissingReviewArtifactOutput = path.join(smokeRoot, "preview-missing-review-artifact.json");
const previewFailOutput = path.join(smokeRoot, "preview-fail-output.json");
const previewFailArtifactOutput = path.join(smokeRoot, "preview-fail-artifact.json");
const previewPassOutput = path.join(smokeRoot, "preview-pass-output.json");
const previewPassArtifactOutput = path.join(smokeRoot, "preview-pass-artifact.json");
const previewCompletionOutput = path.join(smokeRoot, "preview-completion-plan.json");
const reviewReadyPlanOutput = path.join(smokeRoot, "review-ready-plan.json");
const reviewReadyCombinedOutput = path.join(smokeRoot, "review-ready-output.json");
const safetyPlanOutput = path.join(smokeRoot, "safety-plan.json");

const server = await startPreviewServer();

try {
  await runStep("app build packet creates build completion plan", async () => {
    await runNode("scripts/create-app-build-packet.js", {
      APP_BUILD_PACKET_PRIOR_WORK: priorWorkVerdict,
      APP_BUILD_PACKET_OUTPUT: packetOutput,
      APP_NAME: "Spark of Hope Intake Lite",
      APP_SLUG: "spark-of-hope-intake-lite",
      APP_PURPOSE: "Help people share one hopeful story privately so care can be prepared.",
      APP_AUDIENCE: "story sharers|care team",
      APP_SUCCESS_DEFINITION: "A person can submit one private preview story and understand what happens next.",
      APP_PREVIEW_URL: "https://spark-preview.example.test",
      APP_REVIEW_URL: "https://review.spark-of-hope.example.test",
      APP_PRODUCTION_URL: "https://spark-of-hope.example.test"
    });

    await runNode("scripts/create-build-completion-plan.js", {
      BUILD_COMPLETION_PACKET: packetOutput,
      BUILD_COMPLETION_OUTPUT: completionOutput,
      BUILD_COMPLETION_PLAN_OUTPUT: completionPlanOutput,
      BUILD_COMPLETION_FOLLOWUPS_OUTPUT: completionFollowUpsOutput,
      BUILD_CURRENT_STATE: "ready_for_build",
      BUILD_CURRENT_PHASE: "mvp_build",
      APP_REVIEW_URL: "https://review.spark-of-hope.example.test",
      APP_PRODUCTION_URL: "https://spark-of-hope.example.test",
      SOURCE_ISSUE_NUMBER: "56",
      SOURCE_ISSUE_URL: "https://github.com/lincolnnunnally/AppEngine/issues/56"
    });

    const combined = readJson(completionOutput);
    const plan = readJson(completionPlanOutput);
    const followUps = readJson(completionFollowUpsOutput);

    assertArrayIncludes(combined.artifacts.map((artifact) => artifact.kind), "build_completion_plan", "combined output includes build completion artifact");
    assertArrayIncludes(combined.artifacts.map((artifact) => artifact.kind), "deployment_lifecycle", "combined output includes deployment lifecycle artifact");
    assertArrayIncludes(combined.artifacts.map((artifact) => artifact.kind), "owner_status_report", "combined output includes owner status artifact");
    const ownerStatus = combined.artifacts.find((artifact) => artifact.kind === "owner_status_report")?.content;
    assertEqual(plan.kind, "build_completion_plan", "plan artifact kind");
    assertEqual(plan.app.slug, "spark-of-hope-intake-lite", "plan app slug");
    assertEqual(plan.reviewUrl, "https://review.spark-of-hope.example.test", "plan review URL");
    assertEqual(plan.productionUrl, "https://spark-of-hope.example.test", "plan production URL");
    assertEqual(plan.currentVersion, "v1", "plan current version");
    assertEqual(plan.deploymentLifecycle.kind, "deployment_lifecycle", "plan embeds deployment lifecycle");
    assertEqual(plan.deploymentLifecycle.discovery.reviewUrlKnown, true, "plan knows review URL");
    assertEqual(plan.deploymentLifecycle.discovery.productionUrlKnown, true, "plan knows production URL");
    assertEqual(plan.currentState, "ready_for_build", "plan state");
    assertEqual(plan.nextSafeAction, "create_implementation_issue", "ready for build action");
    assertEqual(plan.costGovernance.kind, "cost_governance", "plan embeds cost governance");
    assertEqual(plan.budgetAwareNextSafeAction, "continue", "plan records budget action");
    assertEqual(ownerStatus.kind, "owner_status_report", "owner status artifact kind");
    assertEqual(ownerStatus.reviewUrl, "https://review.spark-of-hope.example.test", "owner status review URL");
    assertEqual(ownerStatus.nextSafeAction, "create_implementation_issue", "owner status next safe action");
    assertArrayIncludes(plan.requiredGates.map((gate) => gate.id), "cost_governance", "plan requires cost governance gate");
    assertEqual(plan.guardrails.productionDeployBlocked, true, "production blocked");
    assertEqual(plan.guardrails.paidResourcesBlocked, true, "paid resources blocked");
    assertEqual(plan.guardrails.migrationsBlocked, true, "migrations blocked");
    assertEqual(plan.guardrails.autoMergeBlocked, true, "auto merge blocked");
    assertEqual(followUps.followUpTasks.length, 1, "follow-up count");
    assertIncludes(followUps.followUpTasks[0].body, "Do not merge generated app code automatically", "follow-up blocks auto merge");
  });

  await runStep("deployment lifecycle artifact records owner review and production URLs", async () => {
    await runNode("scripts/create-deployment-lifecycle.js", {
      DEPLOYMENT_LIFECYCLE_PACKET: packetOutput,
      DEPLOYMENT_LIFECYCLE_OUTPUT: lifecycleOutput,
      DEPLOYMENT_LIFECYCLE_ARTIFACT_OUTPUT: lifecycleArtifactOutput,
      APP_REVIEW_URL: "https://review.spark-of-hope.example.test",
      APP_PRODUCTION_URL: "https://spark-of-hope.example.test",
      APP_DEPLOYMENT_URL: "https://spark-build-preview.example.test",
      APP_DEPLOYMENT_STATE: "build_preview",
      APP_CURRENT_VERSION: "v1",
      APP_REVIEW_VERSION: "v1",
      APP_PRODUCTION_VERSION: "not_released"
    });

    const output = readJson(lifecycleOutput);
    const lifecycle = readJson(lifecycleArtifactOutput);

    assertArrayIncludes(output.artifacts.map((artifact) => artifact.kind), "deployment_lifecycle", "combined output includes lifecycle artifact");
    assertEqual(lifecycle.kind, "deployment_lifecycle", "lifecycle artifact kind");
    assertEqual(lifecycle.reviewUrl, "https://review.spark-of-hope.example.test", "lifecycle review URL");
    assertEqual(lifecycle.productionUrl, "https://spark-of-hope.example.test", "lifecycle production URL");
    assertEqual(lifecycle.deploymentUrl, "https://spark-build-preview.example.test", "lifecycle deployment URL");
    assertEqual(lifecycle.deploymentState, "build_preview", "lifecycle deployment state");
    assertEqual(lifecycle.currentVersion, "v1", "lifecycle current version");
    assertEqual(lifecycle.approvalRequired, true, "lifecycle approval required");
  });

  await runStep("preview verification fails when owner review URL is missing", async () => {
    await runNode("scripts/verify-preview.js", {
      PREVIEW_URL: server.url,
      EXPECTED_ROUTE: "/spark-of-hope-intake-lite",
      EXPECTED_MARKER: "data-app-marker=\"spark-of-hope-intake-lite\"",
      COMMIT_SHA: "abc1234",
      VERCEL_DEPLOYMENT_STATE: "READY",
      PREVIEW_VERIFICATION_OUTPUT: previewMissingReviewOutput,
      PREVIEW_VERIFICATION_ARTIFACT_OUTPUT: previewMissingReviewArtifactOutput
    });

    const artifact = readJson(previewMissingReviewArtifactOutput);

    assertEqual(artifact.kind, "preview_verification", "preview artifact kind");
    assertEqual(artifact.status, "failed", "missing review URL fails");
    assertArrayIncludes(artifact.checks.filter((item) => item.status === "failed").map((item) => item.id), "review_url_known", "review URL known check fails");
    assertEqual(artifact.deploymentLifecycle.deploymentState, "failed_needs_fix", "missing review URL creates failed lifecycle state");
  });

  await runStep("preview verification fails when route returns 404", async () => {
    await runNode("scripts/verify-preview.js", {
      PREVIEW_URL: server.url,
      REVIEW_URL: server.url,
      EXPECTED_ROUTE: "/missing-route",
      EXPECTED_MARKER: "Spark of Hope Intake Lite",
      APP_PRODUCTION_URL: "https://spark-of-hope.example.test",
      COMMIT_SHA: "abc1234",
      VERCEL_DEPLOYMENT_STATE: "READY",
      PREVIEW_VERIFICATION_OUTPUT: previewFailOutput,
      PREVIEW_VERIFICATION_ARTIFACT_OUTPUT: previewFailArtifactOutput
    });

    const output = readJson(previewFailOutput);
    const artifact = readJson(previewFailArtifactOutput);

    assertEqual(artifact.kind, "preview_verification", "preview artifact kind");
    assertEqual(artifact.status, "failed", "missing route fails");
    assertArrayIncludes(artifact.checks.filter((item) => item.status === "failed").map((item) => item.id), "expected_route_http_200", "404 check fails");
    assertEqual(output.followUpTasks.length, 1, "failed preview creates follow-up");
    assertIncludes(output.followUpTasks[0].body, "Route status: 404", "failure issue records 404");
  });

  await runStep("preview verification passes only when route marker and API JSON match", async () => {
    await runNode("scripts/verify-preview.js", {
      PREVIEW_URL: server.url,
      REVIEW_URL: server.url,
      EXPECTED_ROUTE: "/spark-of-hope-intake-lite",
      EXPECTED_MARKER: "data-app-marker=\"spark-of-hope-intake-lite\"",
      EXPECTED_API_URL: `${server.url}/api/spark-of-hope-intake-lite/stories`,
      EXPECTED_API_JSON: JSON.stringify({ ok: true, mode: "preview_mock", stored: false }),
      APP_PRODUCTION_URL: "https://spark-of-hope.example.test",
      APP_CURRENT_VERSION: "v1",
      COMMIT_SHA: "abc1234",
      VERCEL_DEPLOYMENT_STATE: "READY",
      PREVIEW_VERIFICATION_OUTPUT: previewPassOutput,
      PREVIEW_VERIFICATION_ARTIFACT_OUTPUT: previewPassArtifactOutput
    });

    const output = readJson(previewPassOutput);
    const artifact = readJson(previewPassArtifactOutput);

    assertEqual(artifact.status, "passed", "preview passes");
    assertEqual(artifact.http.route.status, 200, "route status 200");
    assertEqual(artifact.http.route.markerFound, true, "marker found");
    assertEqual(artifact.http.api.json.stored, false, "mock API confirms no storage");
    assertEqual(artifact.reviewUrl, server.url, "preview records review URL");
    assertEqual(artifact.productionUrl, "https://spark-of-hope.example.test", "preview records production URL");
    assertEqual(artifact.deploymentLifecycle.deploymentState, "review_ready", "passed preview creates review-ready lifecycle");
    assertEqual(artifact.deploymentLifecycle.currentVersion, "v1", "preview records current version");
    assertEqual(output.followUpTasks.length, 0, "passed preview does not create fix follow-up");
  });

  await runStep("failed preview drives build completion fix action", async () => {
    await runNode("scripts/create-build-completion-plan.js", {
      BUILD_COMPLETION_PACKET: packetOutput,
      PREVIEW_VERIFICATION_INPUT: previewFailArtifactOutput,
      BUILD_COMPLETION_PLAN_OUTPUT: previewCompletionOutput,
      BUILD_CURRENT_STATE: "preview_pending",
      BUILD_RELATED_PREVIEW_URL: `${server.url}/missing-route`
    });

    const plan = readJson(previewCompletionOutput);

    assertEqual(plan.currentState, "failed_needs_fix", "failed preview changes state");
    assertEqual(plan.nextSafeAction, "create_fix_issue", "failed preview creates fix action");
    assertArrayIncludes(plan.failedGates.map((gate) => gate.id), "preview_verification", "preview failure becomes failed gate");
  });

  await runStep("review-ready deployment waits for owner review", async () => {
    await runNode("scripts/create-build-completion-plan.js", {
      BUILD_COMPLETION_PACKET: packetOutput,
      PREVIEW_VERIFICATION_INPUT: previewPassArtifactOutput,
      BUILD_COMPLETION_OUTPUT: reviewReadyCombinedOutput,
      BUILD_COMPLETION_PLAN_OUTPUT: reviewReadyPlanOutput,
      BUILD_CURRENT_STATE: "preview_verified",
      BUILD_PASSED_GATES: "design_quality,designer_review,customer_perspective_review,ux_state_review,compatibility,safari_mobile,common_browsers,touch_forms_auth_admin,code_review",
      APP_REVIEW_URL: server.url,
      APP_PRODUCTION_URL: "https://spark-of-hope.example.test"
    });

    const plan = readJson(reviewReadyPlanOutput);
    const combined = readJson(reviewReadyCombinedOutput);

    assertEqual(plan.currentState, "review_ready", "verified preview advances to review-ready state");
    assertEqual(plan.nextSafeAction, "await_owner_review", "review-ready state awaits owner review");
    assertEqual(plan.reviewUrl, `${server.url}/spark-of-hope-intake-lite`, "review-ready plan records exact review URL");
    assertEqual(plan.productionUrl, "https://spark-of-hope.example.test", "review-ready plan records production URL");
    assertEqual(plan.deploymentState, "review_ready", "review-ready plan records lifecycle state");
    assertEqual(plan.currentVersion, "v1", "review-ready plan records current version");
    assertEqual(plan.guardrails.productionDeployBlocked, true, "production remains blocked");
    assertIncludes(combined.summary, `Review here: ${server.url}/spark-of-hope-intake-lite`, "owner-facing summary names review URL");
    assertIncludes(combined.summary, "Production: blocked/not live yet", "owner-facing summary says production is blocked");
    assertIncludes(plan.followUpTasks[0].body, `Review here: ${server.url}/spark-of-hope-intake-lite`, "owner-facing follow-up names review URL");
    assertIncludes(plan.followUpTasks[0].body, "Production: blocked/not live yet", "owner-facing follow-up says production is blocked");
  });

  await runStep("owner-only actions remain blocked", async () => {
    await runNode("scripts/create-build-completion-plan.js", {
      BUILD_COMPLETION_PACKET: packetOutput,
      BUILD_COMPLETION_PLAN_OUTPUT: safetyPlanOutput,
      BUILD_CURRENT_STATE: "release_blocked",
      PRODUCTION_DEPLOY_ALLOWED: "true",
      PAID_RESOURCES_ALLOWED: "true",
      MIGRATIONS_ALLOWED: "true",
      AUTO_MERGE_ALLOWED: "true"
    });

    const plan = readJson(safetyPlanOutput);

    assertEqual(plan.currentState, "owner_approval_required", "owner approval state");
    assertEqual(plan.nextSafeAction, "stop_for_owner_approval", "owner approval action");
    assertEqual(plan.ownerApprovalRequired, true, "owner approval required");
    assertEqual(plan.guardrails.productionDeployBlocked, true, "production deploy remains blocked");
    assertEqual(plan.guardrails.paidResourcesBlocked, true, "paid resources remain blocked");
    assertEqual(plan.guardrails.migrationsBlocked, true, "migrations remain blocked");
    assertEqual(plan.guardrails.autoMergeBlocked, true, "generated code auto merge remains blocked");
  });

  console.log(`build-completion smoke ok (${smokeRoot})`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

async function runStep(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

async function runNode(scriptPath, env) {
  const result = await execFileAsync(process.execPath, [path.join(repoRoot, scriptPath)], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8"
  });

  return result.stdout;
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

async function startPreviewServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");

    if (url.pathname === "/") {
      sendHtml(response, 200, "<main><h1>AppEngine root</h1></main>");
      return;
    }

    if (url.pathname === "/spark-of-hope-intake-lite") {
      sendHtml(
        response,
        200,
        '<main data-app-marker="spark-of-hope-intake-lite"><h1>Spark of Hope Intake Lite</h1><p>Private preview</p></main>'
      );
      return;
    }

    if (url.pathname === "/api/spark-of-hope-intake-lite/stories") {
      sendJson(response, 200, { ok: true, mode: "preview_mock", stored: false });
      return;
    }

    sendHtml(response, 404, "<main><h1>404</h1></main>");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  server.url = `http://127.0.0.1:${address.port}`;
  return server;
}

function sendHtml(response, status, body) {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
