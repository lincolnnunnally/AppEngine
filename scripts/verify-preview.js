import fs from "node:fs";
import path from "node:path";

const combinedOutput = process.env.PREVIEW_VERIFICATION_OUTPUT || "";
const verificationOutput = process.env.PREVIEW_VERIFICATION_ARTIFACT_OUTPUT || "";
const previewRootUrl = requiredEnv("PREVIEW_URL");
const expectedRoute = normalizeRoute(process.env.EXPECTED_ROUTE || "/");
const expectedMarker = process.env.EXPECTED_MARKER || process.env.EXPECTED_TEST_ID || "";
const apiUrl = process.env.EXPECTED_API_URL || "";
const expectedApiJson = parseExpectedJson(process.env.EXPECTED_API_JSON || "");
const commitSha = process.env.COMMIT_SHA || process.env.GITHUB_SHA || "";
const deploymentState = process.env.VERCEL_DEPLOYMENT_STATE || process.env.DEPLOYMENT_STATE || "";
const timeoutMs = Number.parseInt(process.env.PREVIEW_VERIFY_TIMEOUT_MS || "12000", 10);

const verification = await verifyPreview({
  previewRootUrl,
  expectedRoute,
  expectedMarker,
  apiUrl,
  expectedApiJson,
  commitSha,
  deploymentState,
  timeoutMs
});
const output = {
  agent: "workflow_tester",
  status: verification.status === "passed" ? "completed" : "needs_follow_up",
  summary: verification.summary,
  artifacts: [
    {
      kind: "preview_verification",
      title: `${expectedRoute} Preview Verification`,
      content: verification
    }
  ],
  findings:
    verification.status === "passed"
      ? []
      : [
          {
            severity: "high",
            title: "Preview verification failed",
            details: verification.summary,
            recommendedLabel: "ai:fix"
          }
        ],
  followUpTasks:
    verification.status === "passed"
      ? []
      : [
          {
            title: `Fix preview route ${expectedRoute}`,
            recommendedLabel: "ai:fix",
            body: buildFailureIssueBody(verification)
          }
        ],
  handoffTo: verification.status === "passed" ? ["designer", "customer_perspective", "workflow_tester", "code_reviewer"] : ["fixer"]
};

if (combinedOutput) writeJson(combinedOutput, output);
if (verificationOutput) writeJson(verificationOutput, verification);

console.log(`preview-verification ${verification.status}: ${verification.checkedUrl}`);
if (verification.status !== "passed") {
  console.log(verification.summary);
}

async function verifyPreview({ previewRootUrl, expectedRoute, expectedMarker, apiUrl, expectedApiJson, commitSha, deploymentState, timeoutMs }) {
  const checkedAt = new Date().toISOString();
  const rootUrl = stripTrailingSlash(previewRootUrl);
  const checkedUrl = `${rootUrl}${expectedRoute}`;
  const checks = [];

  checks.push(check("vercel_deployment_ready", deploymentState === "READY", `Deployment state: ${deploymentState || "missing"}`));

  const rootResult = await fetchText(rootUrl, timeoutMs);
  checks.push(check("preview_root_available", rootResult.status >= 200 && rootResult.status < 400, `Root status: ${rootResult.status}`));

  const routeResult = await fetchText(checkedUrl, timeoutMs);
  checks.push(check("expected_route_http_200", routeResult.status === 200, `Route status: ${routeResult.status}`));
  checks.push(check("expected_route_not_root_only", routeResult.finalUrl === checkedUrl || routeResult.finalUrl.endsWith(expectedRoute), `Final URL: ${routeResult.finalUrl}`));
  checks.push(check("expected_marker_present", Boolean(expectedMarker) && routeResult.body.includes(expectedMarker), expectedMarker ? `Marker: ${expectedMarker}` : "Expected marker is missing."));

  let apiResult = null;
  if (apiUrl) {
    apiResult = await fetchJson(apiUrl, timeoutMs);
    checks.push(check("expected_api_http_200", apiResult.status === 200, `API status: ${apiResult.status}`));
    if (expectedApiJson) {
      checks.push(check("expected_api_json", jsonSubsetMatches(apiResult.json, expectedApiJson), `Expected API subset: ${JSON.stringify(expectedApiJson)}`));
    }
  }

  checks.push(check("commit_sha_recorded", Boolean(commitSha), commitSha ? `Commit: ${commitSha}` : "Commit SHA is missing."));

  const failedChecks = checks.filter((item) => item.status === "failed");
  const status = failedChecks.length ? "failed" : "passed";

  return {
    kind: "preview_verification",
    schemaVersion: 1,
    status,
    summary:
      status === "passed"
        ? `Preview route ${expectedRoute} passed route-specific verification.`
        : `Preview route ${expectedRoute} failed: ${failedChecks.map((item) => item.id).join(", ")}.`,
    previewRootUrl: rootUrl,
    expectedRoute,
    checkedUrl,
    commitSha,
    deploymentState: deploymentState || "missing",
    checkedAt,
    checks,
    http: {
      root: {
        status: rootResult.status,
        finalUrl: rootResult.finalUrl
      },
      route: {
        status: routeResult.status,
        finalUrl: routeResult.finalUrl,
        markerFound: Boolean(expectedMarker) && routeResult.body.includes(expectedMarker),
        bodySample: routeResult.body.slice(0, 500)
      },
      api: apiResult
        ? {
            status: apiResult.status,
            finalUrl: apiResult.finalUrl,
            json: apiResult.json
          }
        : null
    },
    guardrails: {
      rootUrlAloneCannotPass: true,
      route404Fails: true,
      markerRequired: true,
      commitShaRequired: true,
      productionDeployBlocked: true,
      paidResourcesBlocked: true,
      migrationsBlocked: true,
      protectedPreviewBypassLinksPubliclyBlocked: true
    }
  };
}

async function fetchText(url, timeoutMs) {
  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      body: await response.text()
    };
  } catch (caught) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      body: String(caught?.message || caught || "request failed")
    };
  }
}

async function fetchJson(url, timeoutMs) {
  const result = await fetchText(url, timeoutMs);
  try {
    return {
      ...result,
      json: JSON.parse(result.body)
    };
  } catch {
    return {
      ...result,
      json: null
    };
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "AppEnginePreviewVerifier/1.0"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

function check(id, passed, details) {
  return {
    id,
    status: passed ? "passed" : "failed",
    details
  };
}

function jsonSubsetMatches(actual, expected) {
  if (!expected || typeof expected !== "object") return true;
  if (!actual || typeof actual !== "object") return false;

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];
    if (expectedValue && typeof expectedValue === "object" && !Array.isArray(expectedValue)) {
      if (!jsonSubsetMatches(actualValue, expectedValue)) return false;
      continue;
    }
    if (Array.isArray(expectedValue)) {
      if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) return false;
      continue;
    }
    if (actualValue !== expectedValue) return false;
  }

  return true;
}

function buildFailureIssueBody(verification) {
  return [
    `Preview verification failed for route \`${verification.expectedRoute}\`.`,
    "",
    "## Evidence",
    `- Deployment state: ${verification.deploymentState}`,
    `- Root URL: ${verification.previewRootUrl}`,
    `- Checked URL: ${verification.checkedUrl}`,
    `- Route status: ${verification.http.route.status}`,
    `- Marker found: ${verification.http.route.markerFound}`,
    `- Commit SHA: ${verification.commitSha || "missing"}`,
    `- Checked at: ${verification.checkedAt}`,
    "",
    "## Failed Checks",
    verification.checks.filter((item) => item.status === "failed").map((item) => `- ${item.id}: ${item.details}`).join("\n"),
    "",
    "## Required Source Of Truth To Load",
    "- source-of-truth/00-why-we-build.md",
    "- source-of-truth/01-ecosystem-philosophy.md",
    "- source-of-truth/02-global-principles.md",
    "- source-of-truth/03-life-produces-life.md",
    "- source-of-truth/04-app-purpose-rules.md",
    "- source-of-truth/05-ecosystem-design-gates.md",
    "- source-of-truth/build-completion-orchestrator.md",
    "- source-of-truth/deployment-environment-standard.md",
    "- source-of-truth/release-gate-standard.md",
    "- agents/context/output-contracts.md",
    "",
    "## Guardrails",
    "- Do not deploy production.",
    "- Do not create paid resources.",
    "- Do not apply migrations.",
    "- Do not merge generated app code automatically.",
    "- Do not post protected Vercel bypass/share links publicly."
  ].join("\n");
}

function normalizeRoute(route) {
  const value = String(route || "/").trim();
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function parseExpectedJson(value) {
  if (!value.trim()) return null;
  return JSON.parse(value);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}
