import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-problem-portfolio-routing-"));

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/problem-portfolio-routing-standard.md", [
    "problem_solution_intake",
    "app_portfolio_registry",
    "problem_portfolio_routing",
    "new_app_candidate",
    "existing_app_improvement",
    "multi_part_ecosystem_solution"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/problem-portfolio-routing-standard.md"]);
  assertFileIncludes("agents/context/output-contracts.md", ["problem_portfolio_routing"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["problem_portfolio_routing"]);
});

runStep("problem-first workflow candidate routes to portfolio", () => {
  const result = runRouting("problem-first.json", problemFirstIntake());

  assertEqual(result.kind, "problem_portfolio_routing", "routing artifact kind");
  assertEqual(result.sourceArtifact.kind, "problem_solution_intake", "source artifact kind");
  assertEqual(result.candidate.type, "workflow_process_candidate", "workflow candidate type");
  assertArrayIncludes(result.candidate.secondaryTypes, "new_app_candidate", "secondary app candidate");
  assertEqual(result.portfolioDestination.kind, "app_portfolio_registry", "portfolio destination");
  assertEqual(result.portfolioDestination.action, "add_candidate", "portfolio action");
  assertArrayIncludes(result.requiredReviewGates.map((gate) => gate.id), "portfolio_registry_gate", "portfolio gate");
  assertArrayIncludes(result.requiredReviewGates.map((gate) => gate.id), "process_owner_gate", "process gate");
  assertEqual(result.routing.nextSafeAction, "create_planning_issue", "next safe action");
  assertEqual(result.guardrails.noPublicIntakeUi, true, "public UI guardrail");
});

runStep("vision-first existing app routes to vNext candidate", () => {
  const result = runRouting("vision-first.json", visionFirstIntake());

  assertEqual(result.candidate.type, "existing_app_improvement", "existing app candidate type");
  assertEqual(result.portfolioDestination.action, "link_existing_app", "portfolio existing app action");
  assertEqual(result.routing.nextSafeAction, "create_vnext_packet", "vNext next safe action");
  assertArrayIncludes(result.requiredReviewGates.map((gate) => gate.id), "existing_app_context_gate", "existing app context gate");
  assertArrayIncludes(result.requiredReviewGates.map((gate) => gate.id), "vnext_packet_gate", "vNext packet gate");
});

runStep("hybrid multi-part solution routes to split candidate", () => {
  const result = runRouting("hybrid.json", hybridIntake());

  assertEqual(result.candidate.type, "multi_part_ecosystem_solution", "multi-part candidate type");
  assertEqual(result.portfolioDestination.action, "split_candidate", "split candidate action");
  assertArrayIncludes(result.requiredReviewGates.map((gate) => gate.id), "solution_split_gate", "solution split gate");
  assertArrayIncludes(result.requiredReviewGates.map((gate) => gate.id), "systems_review_gate", "systems review gate");
});

runStep("missing required input fields fail honestly", () => {
  assertThrows(() => {
    runRouting("invalid.json", {
      kind: "problem_solution_intake",
      mode: "problem_first",
      rawRequest: "Something is wrong.",
      problem: {
        summary: "Something is wrong.",
        affectedPeople: [],
        barriers: [],
        needAddressed: "",
        desiredTransformation: "",
        movementTowardLife: ""
      },
      solutionShape: {
        primary: "workflow_process",
        rationale: ""
      },
      routing: {
        nextSafeAction: ""
      },
      guardrails: {
        planningOnly: true
      }
    });
  }, "problem.affectedPeople");
});

console.log(`problem-portfolio-routing smoke ok (${smokeRoot})`);

function runRouting(name, artifact) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-routing.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-routing.md"));
  const followUpsPath = path.join(smokeRoot, name.replace(".json", "-followups.json"));

  writeJson(inputPath, artifact);

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-problem-portfolio-routing.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PROBLEM_PORTFOLIO_ROUTING_INPUT: inputPath,
      PROBLEM_PORTFOLIO_ROUTING_OUTPUT: outputPath,
      PROBLEM_PORTFOLIO_ROUTING_MARKDOWN_OUTPUT: markdownPath,
      PROBLEM_PORTFOLIO_ROUTING_FOLLOWUPS_OUTPUT: followUpsPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const result = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const followUps = readJson(followUpsPath);

  assertIncludes(markdown, "Problem Intake To Portfolio Routing", "markdown owner report");
  assertEqual(followUps.followUpTasks.length, 1, "routing follow-up count");
  assertIncludes(followUps.followUpTasks[0].body, "source-of-truth/problem-portfolio-routing-standard.md", "follow-up source files");

  return result;
}

function problemFirstIntake() {
  return {
    kind: "problem_solution_intake",
    schemaVersion: 1,
    mode: "problem_first",
    rawRequest: "Churches keep dropping follow-up after someone asks for help.",
    problem: {
      summary: "Church follow-up falls through after help requests.",
      affectedPeople: ["people asking for help", "church staff", "volunteers"],
      currentWorkaround: "manual memory and scattered messages",
      barriers: ["ownership gaps", "visibility gaps"],
      possibleRootCauses: ["no shared care workflow"],
      needAddressed: "timely care coordination",
      desiredTransformation: "people receive timely care and stay connected",
      movementTowardLife: "people move from isolated need to supported care",
      helpsPeopleHelpOthers: "volunteers can respond and follow through"
    },
    vision: { summary: "", proposedSolution: "", firstUsefulScope: "", nonGoals: [] },
    solutionShape: {
      primary: "workflow_process",
      secondary: ["app"],
      rationale: "Clarify the care workflow before building software.",
      existingAppFit: { status: "ambiguous", candidateApps: [], reason: "No existing app selected." }
    },
    questions: { answered: ["problem.summary"], missing: ["privacy constraints"] },
    routing: { nextSafeAction: "create_planning_issue" },
    guardrails: { planningOnly: true }
  };
}

function visionFirstIntake() {
  return {
    ...problemFirstIntake(),
    mode: "vision_first",
    rawRequest: "Improve Spark of Hope Intake Lite with controlled persistence.",
    problem: {
      ...problemFirstIntake().problem,
      summary: "Spark needs controlled preview persistence for story submissions.",
      needAddressed: "safe preview persistence",
      desiredTransformation: "stories can be reviewed privately without production launch"
    },
    vision: {
      summary: "Improve Spark of Hope Intake Lite.",
      proposedSolution: "Controlled preview persistence",
      firstUsefulScope: "server-gated preview storage and verification evidence",
      nonGoals: ["production launch", "paid resources"]
    },
    solutionShape: {
      primary: "app",
      secondary: [],
      rationale: "This improves a known existing app path.",
      existingAppFit: { status: "existing", candidateApps: ["spark-of-hope-intake-lite"], reason: "Known app." }
    },
    routing: { nextSafeAction: "create_vnext_packet" }
  };
}

function hybridIntake() {
  return {
    ...problemFirstIntake(),
    mode: "hybrid",
    rawRequest: "People need encouragement, and Spark of Hope may help with stories, content, and community.",
    problem: {
      ...problemFirstIntake().problem,
      summary: "People need encouragement and a path to hope.",
      needAddressed: "hope, belonging, and encouragement",
      desiredTransformation: "people move toward hope and connection"
    },
    vision: {
      summary: "Use Spark as one part of a larger encouragement path.",
      proposedSolution: "story intake plus content and community follow-up",
      firstUsefulScope: "compare app, content, and community pieces before build",
      nonGoals: ["single giant build"]
    },
    solutionShape: {
      primary: "multi_part_ecosystem_solution",
      secondary: ["app", "content_resource", "community_ministry_model"],
      rationale: "The need may require an app plus content and relational follow-up.",
      existingAppFit: { status: "ambiguous", candidateApps: ["spark-of-hope-intake-lite"], reason: "Spark may be one component." }
    },
    routing: { nextSafeAction: "create_planning_issue" }
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertFileIncludes(relativePath, expectedValues) {
  const text = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  for (const expected of expectedValues) assertIncludes(text, expected, `${relativePath} includes ${expected}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(value, expected, message) {
  if (!String(value).includes(expected)) {
    throw new Error(`${message}: expected content to include ${JSON.stringify(expected)}`);
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
