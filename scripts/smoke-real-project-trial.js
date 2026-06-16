import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-real-project-trial-"));

runStep("real project trial source and UI are discoverable", () => {
  assertFileIncludes("source-of-truth/real-project-trial-runner.md", ["real_project_trial", "Spark of Hope Intake Lite"]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/real-project-trial-runner.md", "real_project_trial"]);
  assertFileIncludes("agents/context/output-contracts.md", ["real_project_trial"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["Real Project Trial Runner", "real_project_trial"]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["real_project_trial"]);
  assertFileIncludes("src/lib/engine/real-project-trial.ts", ["Spark of Hope Intake Lite", "createRealProjectTrial"]);
  assertFileIncludes("src/app/api/engine/real-project-trial/route.ts", ["saveRealProjectTrial", "canAccessEngineAdmin"]);
  assertFileIncludes("src/components/engine/handoff-relay-control-center.tsx", [
    "data-testid=\"real-project-trial-runner\"",
    "Generate Trial Summary",
    "Copy Trial Prompt"
  ]);
});

runStep("Spark of Hope produces a vNext trial summary", () => {
  const outputPath = path.join(smokeRoot, "spark-trial.json");
  const trial = runTrial("spark-input.json", outputPath, {
    selectedCandidateSlug: "spark-of-hope-intake-lite",
    projectMemory: {
      kind: "project_memory",
      latestProjectState: {
        recommendedNextAction: "Use the merged preview slice as the first real project trial."
      },
      summaries: {
        executive: "Spark of Hope reached a verified preview and is ready for controlled vNext planning."
      }
    }
  });

  assertEqual(trial.kind, "real_project_trial", "artifact kind");
  assertEqual(trial.project.slug, "spark-of-hope-intake-lite", "Spark slug");
  assertEqual(trial.recommendedPacketType, "vnext_packet", "Spark recommended packet");
  assertIncludes(trial.problemBeingSolved, "share a story", "Spark problem");
  assertIncludes(trial.designIntent, "ministry_community", "Spark design intent");
  assertIncludes(trial.nextPrompt.prompt, "Do not trigger Codex automatically", "prompt guardrail");
  assertIncludes(trial.nextPrompt.prompt, "source-of-truth/charters/spark-of-hope-intake-lite.md", "prompt source");
  assertEqual(trial.artifactInputs.projectMemory.status, "available", "project memory input available");
  assertEqual(trial.guardrails.noGitHubIssueCreation, true, "no GitHub issue guardrail");
  assertEqual(trial.guardrails.noLabelChanges, true, "no label guardrail");
});

runStep("manual project produces an App Build Packet recommendation", () => {
  const outputPath = path.join(smokeRoot, "manual-trial.json");
  const trial = runTrial("manual-input.json", outputPath, {
    manualProject: {
      name: "Neighborhood Resource Map",
      problem: "Families do not know which local help options are available or trustworthy.",
      targetAudience: "Families, churches, and community helpers coordinating local support.",
      desiredTransformation: "Move from confusion to a clear next step and warm connection.",
      designIntent: "warm_approachable, ministry_community, simple, trustworthy, mobile-first"
    }
  });

  assertEqual(trial.project.slug, "neighborhood-resource-map", "manual slug");
  assertEqual(trial.recommendedPacketType, "app_build_packet", "manual recommended packet");
  assertEqual(trial.artifactInputs.problemPortfolioRouting.status, "needed", "manual routing needed");
  assertIncludes(trial.nextPrompt.prompt, "Route through problem-to-solution intake", "manual next action");
});

runStep("missing manual fields fail honestly", () => {
  const inputPath = path.join(smokeRoot, "missing-input.json");
  const outputPath = path.join(smokeRoot, "missing-output.json");
  writeJson(inputPath, {
    manualProject: {
      name: "Missing Trial"
    }
  });

  assertThrows(() => {
    execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-real-project-trial.js")], {
      cwd: repoRoot,
      env: {
        ...process.env,
        REAL_PROJECT_TRIAL_INPUT: inputPath,
        REAL_PROJECT_TRIAL_OUTPUT: outputPath
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  }, "manualProject.problem");
});

console.log(`real-project-trial smoke ok (${smokeRoot})`);

function runTrial(inputName, outputPath, input) {
  const inputPath = path.join(smokeRoot, inputName);
  writeJson(inputPath, input);

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-real-project-trial.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      REAL_PROJECT_TRIAL_INPUT: inputPath,
      REAL_PROJECT_TRIAL_OUTPUT: outputPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return JSON.parse(fs.readFileSync(outputPath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function assertFileIncludes(relativePath, expectedValues) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

  for (const expected of expectedValues) {
    assertIncludes(content, expected, `${relativePath} includes ${expected}`);
  }
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

function assertThrows(fn, expectedMessage) {
  try {
    fn();
  } catch (caught) {
    const message = caught.stderr ? String(caught.stderr) : caught.message;
    assertIncludes(message, expectedMessage, "expected thrown message");
    return;
  }

  throw new Error(`expected function to throw ${expectedMessage}`);
}
