import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("build gate guard enforces gate clearance before build", () => {
  assertFileIncludes("src/lib/engine/build-gate.ts", [
    "export function evaluateBuildGate",
    "export async function assertProjectBuildAllowed",
    "export class BuildGateError",
    "export function isBuildGateError",
    '"build_new"',
    '"extend_existing"',
    "missing_passing_prior_work_check",
    "missing_problem_intake_gate_reference",
    "missing_clarification",
    "Build blocked"
  ]);
});

runStep("every legacy build trigger calls the guard", () => {
  assertFileIncludes("src/lib/engine/execution.ts", [
    'import { assertProjectBuildAllowed } from "./build-gate"',
    'assertProjectBuildAllowed(projectId, "run_project_agents")',
    'assertProjectBuildAllowed(projectId, "run_project_automation")',
    'assertProjectBuildAllowed(projectId, "prepare_project_deployment")'
  ]);
  assertFileIncludes("src/lib/engine/app-generator.ts", [
    'assertProjectBuildAllowed(projectId, "generate_project_app")'
  ]);
  assertFileIncludes("src/lib/engine/autopilot.ts", [
    'assertProjectBuildAllowed(projectId, "run_project_autopilot")'
  ]);
});

runStep("build routes return 403 for a blocked build", () => {
  for (const route of [
    "src/app/api/engine/projects/[projectId]/runs/route.ts",
    "src/app/api/engine/projects/[projectId]/autopilot/route.ts",
    "src/app/api/engine/projects/[projectId]/exports/route.ts",
    "src/app/api/engine/projects/[projectId]/deployments/route.ts",
    "src/app/api/engine/projects/[projectId]/agents/route.ts"
  ]) {
    assertFileIncludes(route, ["isBuildGateError", "status: 403", "problem_intake_gate"]);
  }
});

runStep("analyze is planning-only and cannot trigger a build", () => {
  assertFileIncludes("src/app/api/engine/analyze/route.ts", [
    "planningOnly: true",
    "No build is created or triggered here"
  ]);
  assertFileExcludes("src/app/api/engine/analyze/route.ts", [
    "runProjectAgents",
    "generateProjectApp",
    "runProjectAutomation",
    "runProjectAutopilot"
  ]);
});

runStep("codex build prompt generation fails closed in the manifest path", () => {
  assertFileIncludes("scripts/make-codex-prompt.js", [
    'import { assertBuildPromptGate } from "./lib/gate-evidence.js"',
    "assertBuildPromptGate({"
  ]);
});

console.log("build-gate smoke ok");

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
