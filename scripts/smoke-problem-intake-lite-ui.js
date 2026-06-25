import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("soft-launch problem intake route is discoverable and owner-gated", () => {
  assertFileIncludes("src/app/(cockpit)/problem-intake-lite/page.tsx", [
    "canAccessEngineOwner",
    "/soft-launch",
    "ProblemIntakeForm"
  ]);
  assertFileIncludes("src/components/problem-intake-lite/problem-intake-form.tsx", [
    "data-testid=\"problem-intake-lite-page\"",
    "Solve a problem",
    "Describe what",
    "mode: \"problem_first\"",
    "Saved. We'll clarify the next step, check what already exists, then route it toward the right build, workflow, or improvement path.",
    "Save for review"
  ]);
  // The user already chose the problem door, so the form must not re-ask
  // problem-vs-vision: the redundant "Start Here" mode selector is gone and
  // every submission defaults to problem_first.
  assertFileExcludes("src/components/problem-intake-lite/problem-intake-form.tsx", [
    "Start Here",
    "intake-choice-grid",
    "I noticed a problem",
    "No build",
    "paid resource",
    "execution label"
  ]);
});

runStep("owner control center is discoverable", () => {
  assertFileIncludes("src/app/(cockpit)/owner-control-center/page.tsx", [
    "OwnerControlCenter",
    "listProblemIntakeRecords"
  ]);
  assertFileIncludes("src/components/problem-intake-lite/owner-control-center.tsx", [
    "data-testid=\"owner-control-center-page\"",
    "What failed or felt confusing?",
    "Save feedback draft",
    "Draft Artifacts"
  ]);
});

runStep("engine artifacts and guardrails are stored", () => {
  assertFileIncludes("src/lib/engine/problem-intake-lite.ts", [
    "problem_solution_intake",
    "problem_portfolio_routing",
    "solution_candidate_review",
    "app_portfolio_registry",
    "owner_feedback_improvement_candidate",
    "noAutomaticCodexTrigger",
    "noExecutionLabels",
    "noProductionDeploy",
    "noPaidResources",
    "noMigrations"
  ]);
});

runStep("api routes do not trigger execution work", () => {
  assertFileIncludes("src/app/api/problem-intake-lite/route.ts", [
    "canAccessEngineOwner",
    "Unauthorized",
    "createProblemIntakeRecord",
    "listProblemIntakeRecords",
    "Cache-Control"
  ]);
  assertFileIncludes("src/app/api/problem-intake-lite/feedback/route.ts", [
    "addOwnerFeedbackImprovementCandidate",
    "Cache-Control"
  ]);
  assertFileExcludes("src/lib/engine/problem-intake-lite.ts", [
    "ai:build",
    "ai:fix",
    "APPENGINE_FOLLOW_UP_MODE=create",
    "gh issue create",
    "vercel deploy --prod"
  ]);
});

console.log("problem-intake-lite-ui smoke ok");

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
  const content = readFile(relativePath);

  for (const expected of expectedValues) {
    if (!content.includes(expected)) {
      throw new Error(`${relativePath} should include ${JSON.stringify(expected)}`);
    }
  }
}

function assertFileExcludes(relativePath, blockedValues) {
  const content = readFile(relativePath);

  for (const blocked of blockedValues) {
    if (content.includes(blocked)) {
      throw new Error(`${relativePath} should not include ${JSON.stringify(blocked)}`);
    }
  }
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}
