import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-portfolio-registry-"));
const inputPath = path.join(smokeRoot, "portfolio-input.json");
const combinedOutput = path.join(smokeRoot, "portfolio-output.json");
const registryOutput = path.join(smokeRoot, "app-portfolio-registry.json");
const markdownOutput = path.join(smokeRoot, "app-portfolio-registry.md");
const followUpsOutput = path.join(smokeRoot, "portfolio-follow-ups.json");

runStep("portfolio registry creation", () => {
  writeJson(inputPath, {
    owner: "Lincoln",
    generatedAt: "2026-06-15T12:00:00.000Z",
    apps: [
      {
        name: "Spark of Hope Intake Lite",
        slug: "spark-of-hope-intake-lite",
        reviewUrl: "https://review.spark-of-hope.example.test/spark-of-hope",
        productionUrl: "approval-gated",
        currentVersion: "v1.1",
        deploymentState: "review_ready",
        buildState: "preview_verified",
        nextSafeAction: "await_owner_review",
        sourceOfTruthFiles: [
          "source-of-truth/charters/spark-of-hope-intake-lite.md",
          "source-of-truth/vnext/spark-of-hope-intake-lite-vnext-1.md"
        ],
        linkedIssues: [
          {
            number: 63,
            title: "Spark of Hope Intake Lite vNext 1",
            url: "https://github.com/lincolnnunnally/AppEngine/issues/63"
          }
        ],
        linkedPRs: [
          {
            number: 74,
            title: "Spark of Hope Intake Lite vNext: controlled preview persistence",
            url: "https://github.com/lincolnnunnally/AppEngine/pull/74",
            state: "merged"
          }
        ]
      },
      {
        name: "Kindred Connection",
        slug: "kindred-connection",
        reviewUrl: "unknown",
        productionUrl: "approval-gated",
        currentVersion: "v1",
        deploymentState: "production_blocked",
        buildState: "planned",
        nextSafeAction: "create_planning_issue",
        sourceOfTruthFiles: ["source-of-truth/charters/kindred-connection.md"],
        linkedIssues: [],
        linkedPRs: []
      }
    ]
  });

  runNode("scripts/create-app-portfolio-registry-standard.js", {
    APP_PORTFOLIO_REGISTRY_INPUT: inputPath,
    APP_PORTFOLIO_REGISTRY_OUTPUT: combinedOutput,
    APP_PORTFOLIO_REGISTRY_ARTIFACT_OUTPUT: registryOutput,
    APP_PORTFOLIO_REGISTRY_MARKDOWN_OUTPUT: markdownOutput,
    APP_PORTFOLIO_REGISTRY_FOLLOWUPS_OUTPUT: followUpsOutput
  });

  const combined = readJson(combinedOutput);
  const registry = readJson(registryOutput);
  const followUps = readJson(followUpsOutput);
  const markdown = fs.readFileSync(markdownOutput, "utf8");

  assertEqual(registry.kind, "app_portfolio_registry", "registry artifact kind");
  assertEqual(registry.schemaVersion, 1, "registry schema version");
  assertEqual(registry.owner, "Lincoln", "registry owner");
  assertEqual(registry.summary.totalApps, 2, "registry app count");
  assertEqual(registry.summary.reviewReadyApps, 1, "review-ready count");
  assertEqual(registry.summary.productionLiveApps, 0, "production-live count");
  assertEqual(registry.summary.blockedApps, 1, "blocked count");
  assertEqual(registry.apps[0].slug, "spark-of-hope-intake-lite", "spark slug");
  assertEqual(registry.apps[0].deploymentState, "review_ready", "spark deployment state");
  assertEqual(registry.apps[0].buildState, "preview_verified", "spark build state");
  assertEqual(registry.apps[0].nextSafeAction, "await_owner_review", "spark next safe action");
  assertArrayIncludes(registry.apps[0].sourceOfTruthFiles, "source-of-truth/vnext/spark-of-hope-intake-lite-vnext-1.md", "spark source files");
  assertEqual(registry.apps[0].linkedIssues[0].number, 63, "spark linked issue");
  assertEqual(registry.apps[0].linkedPRs[0].number, 74, "spark linked PR");
  assertEqual(registry.guardrails.noSecretsInRegistry, true, "secret guardrail");
  assertEqual(registry.guardrails.productionApprovalRequired, true, "production guardrail");

  assertEqual(combined.artifacts.length, 1, "combined artifact count");
  assertEqual(combined.artifacts[0].kind, "app_portfolio_registry", "combined artifact kind");
  assertEqual(followUps.followUpTasks.length, 1, "one follow-up for missing linked items");
  assertIncludes(followUps.followUpTasks[0].title, "kindred-connection", "follow-up includes app slug");
  assertIncludes(followUps.followUpTasks[0].body, "source-of-truth/app-portfolio-registry.md", "follow-up includes registry source");
  assertIncludes(markdown, "Spark of Hope Intake Lite", "markdown includes Spark");
  assertIncludes(markdown, "Kindred Connection", "markdown includes Kindred");
});

runStep("portfolio registry fails review-ready apps without review URL", () => {
  const badInputPath = path.join(smokeRoot, "bad-portfolio-input.json");
  const badOutputPath = path.join(smokeRoot, "bad-portfolio-output.json");

  writeJson(badInputPath, {
    apps: [
      {
        name: "Missing Review URL",
        slug: "missing-review-url",
        reviewUrl: "unknown",
        productionUrl: "approval-gated",
        currentVersion: "v1",
        deploymentState: "review_ready",
        buildState: "preview_verified",
        nextSafeAction: "await_owner_review",
        sourceOfTruthFiles: ["source-of-truth/charters/missing-review-url.md"],
        linkedIssues: [{ number: 1, title: "Missing review URL", url: "https://github.com/example/repo/issues/1" }],
        linkedPRs: [{ number: 2, title: "Missing review URL", url: "https://github.com/example/repo/pull/2" }]
      }
    ]
  });

  assertThrows(() => {
    runNode("scripts/create-app-portfolio-registry-standard.js", {
      APP_PORTFOLIO_REGISTRY_INPUT: badInputPath,
      APP_PORTFOLIO_REGISTRY_ARTIFACT_OUTPUT: badOutputPath
    });
  }, "review_ready");
});

console.log(`portfolio-registry smoke ok (${smokeRoot})`);

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

function assertThrows(fn, expectedMessage) {
  try {
    fn();
  } catch (caught) {
    assertIncludes(caught.message, expectedMessage, "expected thrown message");
    return;
  }

  throw new Error(`expected function to throw ${expectedMessage}`);
}
