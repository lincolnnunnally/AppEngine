import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/problem-to-solution-intake-standard.md", [
    "problem_first",
    "vision_first",
    "hybrid",
    "problem_solution_intake",
    "multi_part_ecosystem_solution"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/problem-to-solution-intake-standard.md"]);
  assertFileIncludes("agents/context/output-contracts.md", ["problem_solution_intake"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["Problem-To-Solution Intake Standard"]);
});

runStep("problem-first artifact validates", () => {
  validateProblemSolutionIntake({
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
    vision: {
      summary: "",
      proposedSolution: "",
      firstUsefulScope: "",
      nonGoals: []
    },
    solutionShape: {
      primary: "workflow_process",
      secondary: ["app"],
      rationale: "Clarify the care workflow before building software.",
      existingAppFit: {
        status: "ambiguous",
        candidateApps: [],
        reason: "No existing app selected yet."
      }
    },
    questions: {
      answered: ["problem.summary", "problem.affectedPeople", "problem.barriers"],
      missing: ["current follow-up process", "privacy constraints"]
    },
    routing: {
      nextAgent: "discovery",
      recommendedLabel: "ai:plan",
      nextArtifact: "discovery_plan",
      nextSafeAction: "create_planning_issue",
      reason: "Discovery should clarify workflow and root causes before build packet."
    },
    ownerReadableSummary: "Mode: problem_first. Recommended solution shape: workflow_process + app. Next: create discovery issue.",
    guardrails: requiredGuardrails()
  });
});

runStep("vision-first artifact validates", () => {
  validateProblemSolutionIntake({
    kind: "problem_solution_intake",
    schemaVersion: 1,
    mode: "vision_first",
    rawRequest: "Build Spark of Hope Intake Lite so people can share hopeful stories safely.",
    problem: {
      summary: "People need a safe way to share hope stories for private encouragement.",
      affectedPeople: ["story sharers", "review team"],
      currentWorkaround: "unstructured messages",
      barriers: ["privacy concern", "unclear review flow"],
      possibleRootCauses: ["no bounded intake path"],
      needAddressed: "safe story intake",
      desiredTransformation: "people can share hope and receive encouragement",
      movementTowardLife: "people move from private burden to supported hope",
      helpsPeopleHelpOthers: "reviewers can respond with care"
    },
    vision: {
      summary: "Create a small story intake flow with review-gated persistence.",
      proposedSolution: "public preview route with safe intake and private review path",
      firstUsefulScope: "story form, consent, mock or controlled persistence, review evidence",
      nonGoals: ["public story publishing", "production launch", "paid resources"]
    },
    solutionShape: {
      primary: "app",
      secondary: ["workflow_process"],
      rationale: "The solution needs a route, API, consent, and review workflow.",
      existingAppFit: {
        status: "existing",
        candidateApps: ["spark-of-hope-intake-lite"],
        reason: "Known app and vNext path already exist."
      }
    },
    questions: {
      answered: ["vision.proposedSolution", "vision.firstUsefulScope", "problem.needAddressed"],
      missing: ["final persistence provider approval"]
    },
    routing: {
      nextAgent: "planner",
      recommendedLabel: "ai:plan",
      nextArtifact: "vnext_packet",
      nextSafeAction: "create_vnext_packet",
      reason: "Known existing app can move to vNext planning before implementation."
    },
    ownerReadableSummary: "Mode: vision_first. Recommended solution shape: app + workflow_process. Next: create vNext packet.",
    guardrails: requiredGuardrails()
  });
});

runStep("hybrid artifact validates", () => {
  validateProblemSolutionIntake({
    kind: "problem_solution_intake",
    schemaVersion: 1,
    mode: "hybrid",
    rawRequest: "People need encouragement, and Spark of Hope may help with stories, content, and community.",
    problem: {
      summary: "People need encouragement and a path to hope.",
      affectedPeople: ["people seeking hope", "encouragers", "community leaders"],
      currentWorkaround: "scattered conversations and content",
      barriers: ["low trust", "unclear first step", "limited follow-up"],
      possibleRootCauses: ["lack of belonging", "no simple hope intake path"],
      needAddressed: "hope, belonging, and encouragement",
      desiredTransformation: "people move toward hope and connection",
      movementTowardLife: "people move from survival to hope and participation",
      helpsPeopleHelpOthers: "encouraged people can share testimony and encourage others"
    },
    vision: {
      summary: "Use Spark of Hope as one part of a larger encouragement path.",
      proposedSolution: "story intake plus content and community follow-up",
      firstUsefulScope: "compare app, content, and community pieces before build",
      nonGoals: ["single giant build", "production launch"]
    },
    solutionShape: {
      primary: "multi_part_ecosystem_solution",
      secondary: ["app", "content_resource", "community_ministry_model"],
      rationale: "The need may require an app plus content and relational follow-up.",
      existingAppFit: {
        status: "ambiguous",
        candidateApps: ["spark-of-hope-intake-lite"],
        reason: "Spark may be one component, but the full solution shape needs validation."
      }
    },
    questions: {
      answered: ["problem.summary", "vision.summary"],
      missing: ["audience segment", "community ownership", "content scope"]
    },
    routing: {
      nextAgent: "systems",
      recommendedLabel: "ai:plan",
      nextArtifact: "solution_options_map",
      nextSafeAction: "create_planning_issue",
      reason: "Compare ecosystem solution paths before selecting implementation."
    },
    ownerReadableSummary: "Mode: hybrid. Recommended solution shape: multi_part_ecosystem_solution. Next: create planning issue.",
    guardrails: requiredGuardrails()
  });
});

runStep("missing required fields fail validation", () => {
  assertThrows(() => {
    validateProblemSolutionIntake({
      kind: "problem_solution_intake",
      schemaVersion: 1,
      mode: "problem_first",
      rawRequest: "Something is broken.",
      problem: {
        summary: "Something is broken.",
        affectedPeople: [],
        barriers: [],
        needAddressed: "",
        desiredTransformation: "",
        movementTowardLife: ""
      },
      solutionShape: {
        primary: "app",
        rationale: ""
      },
      questions: {
        answered: [],
        missing: []
      },
      routing: {
        nextAgent: "",
        recommendedLabel: "",
        nextSafeAction: ""
      },
      ownerReadableSummary: "",
      guardrails: {}
    });
  }, "problem.affectedPeople");
});

console.log("problem-solution-intake smoke ok");

function validateProblemSolutionIntake(artifact) {
  const missing = [];

  for (const [label, value] of [
    ["kind", artifact.kind],
    ["schemaVersion", artifact.schemaVersion],
    ["mode", artifact.mode],
    ["rawRequest", artifact.rawRequest],
    ["problem.summary", artifact.problem?.summary],
    ["problem.needAddressed", artifact.problem?.needAddressed],
    ["problem.desiredTransformation", artifact.problem?.desiredTransformation],
    ["problem.movementTowardLife", artifact.problem?.movementTowardLife],
    ["solutionShape.primary", artifact.solutionShape?.primary],
    ["solutionShape.rationale", artifact.solutionShape?.rationale],
    ["routing.nextAgent", artifact.routing?.nextAgent],
    ["routing.recommendedLabel", artifact.routing?.recommendedLabel],
    ["routing.nextSafeAction", artifact.routing?.nextSafeAction],
    ["ownerReadableSummary", artifact.ownerReadableSummary]
  ]) {
    if (value === undefined || value === null || value === "") missing.push(label);
  }

  for (const [label, value] of [
    ["problem.affectedPeople", artifact.problem?.affectedPeople],
    ["problem.barriers", artifact.problem?.barriers],
    ["questions.answered", artifact.questions?.answered],
    ["questions.missing", artifact.questions?.missing]
  ]) {
    if (!Array.isArray(value) || value.length === 0) missing.push(label);
  }

  if (artifact.mode === "vision_first") {
    for (const [label, value] of [
      ["vision.summary", artifact.vision?.summary],
      ["vision.proposedSolution", artifact.vision?.proposedSolution],
      ["vision.firstUsefulScope", artifact.vision?.firstUsefulScope],
      ["vision.nonGoals", artifact.vision?.nonGoals]
    ]) {
      if (Array.isArray(value) ? value.length === 0 : !value) missing.push(label);
    }
  }

  if (!["problem_first", "vision_first", "hybrid"].includes(artifact.mode)) missing.push("mode.allowed");
  if (!allowedSolutionShapes().includes(artifact.solutionShape?.primary)) missing.push("solutionShape.primary.allowed");

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (artifact.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) throw new Error(`Problem-to-solution intake missing required fields: ${missing.join(", ")}`);
}

function requiredGuardrails() {
  return {
    planningOnly: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    noGeneratedCodeAutoMerge: true,
    noPublicIntakeUiYet: true,
    repositoryVisibilityUnchanged: true,
    requiresPacketBeforeBuild: true
  };
}

function allowedSolutionShapes() {
  return ["app", "website", "workflow_process", "automation", "content_resource", "community_ministry_model", "multi_part_ecosystem_solution"];
}

function assertFileIncludes(relativePath, expectedValues) {
  const text = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  for (const expected of expectedValues) assertIncludes(text, expected, `${relativePath} includes ${expected}`);
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

function assertIncludes(value, expected, message) {
  if (!String(value).includes(expected)) {
    throw new Error(`${message}: expected content to include ${JSON.stringify(expected)}`);
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
