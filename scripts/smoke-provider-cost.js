import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-provider-cost-"));
const outputPath = path.join(smokeRoot, "provider-cost-output.json");
const reviewPath = path.join(smokeRoot, "provider-cost-review.json");
const followUpsPath = path.join(smokeRoot, "provider-cost-follow-ups.json");
const codexOutput = path.join(smokeRoot, "codex-output.md");
const issuesOutput = path.join(smokeRoot, "dry-run-issues.json");

runStep("provider cost generator creates review", () => {
  runNode("scripts/create-provider-cost-standard.js", {
    PROVIDER_COST_OUTPUT: outputPath,
    PROVIDER_COST_REVIEW_OUTPUT: reviewPath,
    PROVIDER_COST_FOLLOWUPS_OUTPUT: followUpsPath,
    APP_NAME: "Kind Help Desk",
    APP_SLUG: "kind-help-desk",
    APP_BACKEND_REQUIRED: "true",
    APP_FILE_UPLOADS_USED: "true",
    APP_PAYMENTS_USED: "true",
    APP_AI_USED: "true",
    APP_MONTHLY_COST_CEILING: "owner-approved"
  });

  const review = readJson(reviewPath);
  const output = readJson(outputPath);

  assertEqual(review.kind, "provider_cost_review", "provider artifact kind");
  assertEqual(review.costPosture.preview, "free_or_low_cost", "preview cost posture");
  assertEqual(review.costPosture.production, "approval_required", "production cost posture");
  assertArrayIncludes(review.providers.map((item) => item.area), "frontend", "frontend provider");
  assertArrayIncludes(review.providers.map((item) => item.area), "api_backend", "backend provider");
  assertArrayIncludes(review.providers.map((item) => item.area), "database", "database provider");
  assertArrayIncludes(review.providers.map((item) => item.area), "payments", "payment provider");
  assertArrayIncludes(review.providers.map((item) => item.area), "ai_models", "AI provider");
  assertArrayIncludes(review.checks.map((item) => item.id), "reuse_before_create", "reuse check");
  assertArrayIncludes(review.checks.map((item) => item.id), "owner_approval_before_paid", "owner approval check");
  assertEqual(review.guardrails.noPaidResourcesWithoutApproval, true, "paid resources require approval");
  assertEqual(output.followUpTasks.length, 2, "provider follow-up count");
});

runStep("provider cost follow-up dry run creates issues", () => {
  const output = readJson(outputPath);
  fs.writeFileSync(
    codexOutput,
    [
      "Provider cost follow-up output",
      "",
      "```json",
      JSON.stringify(output, null, 2),
      "```",
      ""
    ].join("\n")
  );

  runNode("scripts/create-follow-up-issues.js", {
    CODEX_OUTPUT_FILE: codexOutput,
    FOLLOW_UP_DRY_RUN: "true",
    FOLLOW_UP_OUTPUT: issuesOutput,
    MAX_FOLLOW_UP_ISSUES: "10",
    SOURCE_ISSUE_NUMBER: "1005",
    SOURCE_ISSUE_URL: "https://github.com/lincolnnunnally/AppEngine/issues/1005"
  });

  const dryRun = readJson(issuesOutput);
  assertEqual(dryRun.issues.length, 2, "provider dry run issue count");
  assertIncludes(dryRun.issues[0].title, "Provider and cost review", "provider review issue title");
  assertIncludes(dryRun.issues[0].body, "Do not create paid provider resources", "provider issue approval guardrail");
  assertIncludes(dryRun.issues[1].title, "Provider provisioning approval", "provider approval issue title");
  assertIncludes(dryRun.issues[1].body, "Vercel, Render, database", "provider issue names provider classes");
  assertIncludes(dryRun.issues[0].body, "Source issue: #1005", "provider dry run includes source issue");
});

console.log(`provider-cost smoke ok (${smokeRoot})`);

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
