import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-trial-result-review-"));

runStep("trial result review source and UI are discoverable", () => {
  assertFileIncludes("source-of-truth/trial-result-review-loop.md", ["trial_result_review", "ready_for_next_packet"]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/trial-result-review-loop.md", "trial_result_review"]);
  assertFileIncludes("agents/context/output-contracts.md", ["trial_result_review"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["Trial Result Review Loop", "trial_result_review"]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["trial_result_review"]);
  assertFileIncludes("src/lib/engine/real-project-trial.ts", ["TrialResultReview", "createTrialResultReview"]);
  assertFileIncludes("src/lib/engine/project-memory.ts", ["updateProjectMemoryFromTrialReview"]);
  assertFileIncludes("src/app/api/engine/real-project-trial/reviews/route.ts", ["saveTrialResultReview", "updateProjectMemoryFromTrialReview"]);
  assertFileIncludes("src/components/engine/handoff-relay-control-center.tsx", [
    "data-testid=\"trial-result-review\"",
    "Save Trial Review",
    "Copy Review Prompt"
  ]);
});

const trial = createSparkTrial();

runStep("ready for next packet review creates improvement candidate and memory update", () => {
  const { review, memory } = runReview("ready-review", {
    trial,
    projectMemory: {
      kind: "project_memory",
      latestProjectState: {
        recommendedNextAction: "Use Spark trial feedback to decide next packet."
      },
      summaries: {
        executive: "Spark of Hope trial is visible and ready for owner feedback."
      }
    },
    review: {
      trialId: trial.id,
      status: "ready_for_next_packet",
      note: "Useful direction. Next packet should include pastoral review boundaries."
    }
  });

  assertEqual(review.kind, "trial_result_review", "artifact kind");
  assertEqual(review.reviewStatus, "ready_for_next_packet", "review status");
  assertEqual(review.improvementCandidate.candidateType, "packet_progression", "candidate type");
  assertIncludes(review.nextPrompt.prompt, "pastoral review boundaries", "owner note in prompt");
  assertIncludes(review.nextPrompt.prompt, "Do not trigger Codex automatically", "guardrail in prompt");
  assertEqual(review.guardrails.noGitHubIssueCreation, true, "no GitHub issue guardrail");
  assertIncludes(memory.latestProjectState.currentState, "ready for next packet", "memory current state");
  assertArrayTextIncludes(memory.futureImprovements, "proceed to next packet", "memory future improvement");
});

runStep("wrong direction review creates correction candidate", () => {
  const { review } = runReview("wrong-direction-review", {
    trial,
    review: {
      trialId: trial.id,
      status: "wrong_direction",
      note: "This is solving the wrong next step; revisit the audience and boundaries."
    }
  });

  assertEqual(review.improvementCandidate.candidateType, "direction_correction", "correction candidate");
  assertArrayIncludes(review.concerns, "Owner marked the trial direction wrong.", "wrong direction concern");
  assertIncludes(review.nextPrompt.expectedOutcome, "Re-route", "reroute next action");
});

runStep("design mismatch review creates design correction candidate", () => {
  const { review } = runReview("design-mismatch-review", {
    trial,
    review: {
      trialId: trial.id,
      status: "design_mismatch",
      note: "The result feels too operational; Spark needs warmer ministry/community language."
    }
  });

  assertEqual(review.improvementCandidate.candidateType, "design_correction", "design candidate");
  assertIncludes(review.nextPrompt.expectedOutcome, "Update design intent", "design next action");
});

runStep("missing trial and unsupported status fail honestly", () => {
  assertThrows(() => {
    runReview("missing-trial", {
      review: {
        status: "useful"
      }
    });
  }, "needs a real project trial");

  assertThrows(() => {
    runReview("bad-status", {
      trial,
      review: {
        trialId: trial.id,
        status: "auto_merge_this"
      }
    });
  }, "Unsupported trial result review status");
});

console.log(`trial-result-review smoke ok (${smokeRoot})`);

function createSparkTrial() {
  const inputPath = path.join(smokeRoot, "spark-trial-input.json");
  const outputPath = path.join(smokeRoot, "spark-trial.json");

  writeJson(inputPath, { selectedCandidateSlug: "spark-of-hope-intake-lite" });
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

function runReview(name, input) {
  const inputPath = path.join(smokeRoot, `${name}.json`);
  const reviewOutput = path.join(smokeRoot, `${name}-review.json`);
  const memoryOutput = path.join(smokeRoot, `${name}-memory.json`);

  writeJson(inputPath, input);
  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-trial-result-review.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      TRIAL_RESULT_REVIEW_INPUT: inputPath,
      TRIAL_RESULT_REVIEW_OUTPUT: reviewOutput,
      TRIAL_RESULT_REVIEW_MEMORY_OUTPUT: memoryOutput
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return {
    review: JSON.parse(fs.readFileSync(reviewOutput, "utf8")),
    memory: JSON.parse(fs.readFileSync(memoryOutput, "utf8"))
  };
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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

function assertArrayIncludes(values, expected, message) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(values)} to include ${JSON.stringify(expected)}`);
  }
}

function assertArrayTextIncludes(values, expected, message) {
  if (!Array.isArray(values) || !values.some((entry) => String(entry.text || entry).includes(expected))) {
    throw new Error(`${message}: expected ${JSON.stringify(values)} to include text ${JSON.stringify(expected)}`);
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
