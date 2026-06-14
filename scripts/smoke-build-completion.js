import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const repoRoot = process.cwd();
const execFileAsync = promisify(execFile);
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-build-completion-"));
const packetOutput = path.join(smokeRoot, "app-build-packet.json");
const completionOutput = path.join(smokeRoot, "build-completion-output.json");
const completionPlanOutput = path.join(smokeRoot, "build-completion-plan.json");
const completionFollowUpsOutput = path.join(smokeRoot, "build-completion-follow-ups.json");
const previewFailOutput = path.join(smokeRoot, "preview-fail-output.json");
const previewFailArtifactOutput = path.join(smokeRoot, "preview-fail-artifact.json");
const previewPassOutput = path.join(smokeRoot, "preview-pass-output.json");
const previewPassArtifactOutput = path.join(smokeRoot, "preview-pass-artifact.json");
const previewCompletionOutput = path.join(smokeRoot, "preview-completion-plan.json");
const safetyPlanOutput = path.join(smokeRoot, "safety-plan.json");

const server = await startPreviewServer();

try {
  await runStep("app build packet creates build completion plan", async () => {
    await runNode("scripts/create-app-build-packet.js", {
      APP_BUILD_PACKET_OUTPUT: packetOutput,
      APP_NAME: "Spark of Hope Intake Lite",
      APP_SLUG: "spark-of-hope-intake-lite",
      APP_PURPOSE: "Help people share one hopeful story privately so care can be prepared.",
      APP_AUDIENCE: "story sharers|care team",
      APP_SUCCESS_DEFINITION: "A person can submit one private preview story and understand what happens next.",
      APP_PREVIEW_URL: "https://spark-preview.example.test",
      APP_PRODUCTION_URL: "approval-gated"
    });

    await runNode("scripts/create-build-completion-plan.js", {
      BUILD_COMPLETION_PACKET: packetOutput,
      BUILD_COMPLETION_OUTPUT: completionOutput,
      BUILD_COMPLETION_PLAN_OUTPUT: completionPlanOutput,
      BUILD_COMPLETION_FOLLOWUPS_OUTPUT: completionFollowUpsOutput,
      BUILD_CURRENT_STATE: "ready_for_build",
      BUILD_CURRENT_PHASE: "mvp_build",
      SOURCE_ISSUE_NUMBER: "56",
      SOURCE_ISSUE_URL: "https://github.com/lincolnnunnally/AppEngine/issues/56"
    });

    const combined = readJson(completionOutput);
    const plan = readJson(completionPlanOutput);
    const followUps = readJson(completionFollowUpsOutput);

    assertArrayIncludes(combined.artifacts.map((artifact) => artifact.kind), "build_completion_plan", "combined output includes build completion artifact");
    assertEqual(plan.kind, "build_completion_plan", "plan artifact kind");
    assertEqual(plan.app.slug, "spark-of-hope-intake-lite", "plan app slug");
    assertEqual(plan.currentState, "ready_for_build", "plan state");
    assertEqual(plan.nextSafeAction, "create_implementation_issue", "ready for build action");
    assertEqual(plan.costGovernance.kind, "cost_governance", "plan embeds cost governance");
    assertEqual(plan.budgetAwareNextSafeAction, "continue", "plan records budget action");
    assertArrayIncludes(plan.requiredGates.map((gate) => gate.id), "cost_governance", "plan requires cost governance gate");
    assertEqual(plan.guardrails.productionDeployBlocked, true, "production blocked");
    assertEqual(plan.guardrails.paidResourcesBlocked, true, "paid resources blocked");
    assertEqual(plan.guardrails.migrationsBlocked, true, "migrations blocked");
    assertEqual(plan.guardrails.autoMergeBlocked, true, "auto merge blocked");
    assertEqual(followUps.followUpTasks.length, 1, "follow-up count");
    assertIncludes(followUps.followUpTasks[0].body, "Do not merge generated app code automatically", "follow-up blocks auto merge");
  });

  await runStep("preview verification fails when route returns 404", async () => {
    await runNode("scripts/verify-preview.js", {
      PREVIEW_URL: server.url,
      EXPECTED_ROUTE: "/missing-route",
      EXPECTED_MARKER: "Spark of Hope Intake Lite",
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
      EXPECTED_ROUTE: "/spark-of-hope-intake-lite",
      EXPECTED_MARKER: "data-app-marker=\"spark-of-hope-intake-lite\"",
      EXPECTED_API_URL: `${server.url}/api/spark-of-hope-intake-lite/stories`,
      EXPECTED_API_JSON: JSON.stringify({ ok: true, mode: "preview_mock", stored: false }),
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
