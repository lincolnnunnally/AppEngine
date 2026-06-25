import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("standard declares the official intake gate and its rule", () => {
  assertFileIncludes("source-of-truth/problem-intake-gate.md", [
    "Problem Intake Gate",
    "All new work starts here",
    "raw request",
    "problem being solved",
    "intended person/customer",
    "likely app or new app",
    "request type",
    "missing context",
    "required source-of-truth files",
    "applicable control gates",
    "blocked actions",
    "recommended next issue label",
    "next safe phase",
    "Architecture, design, and implementation remain blocked until the intake packet and control gates exist."
  ]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/problem-intake-gate.md"]);
});

runStep("engine only ever routes to a pre-build phase", () => {
  assertFileIncludes("src/lib/engine/problem-intake-gate.ts", [
    'export type ProblemIntakeNextPhase = "clarify_problem" | "prior_work_check" | "solution_candidate_review"',
    "BUILD_PHASES_BLOCKED_AT_INTAKE",
    '"architecture"',
    '"implementation"',
    '"mvp_build"'
  ]);
  // The next-phase type must not admit a build phase.
  assertFileExcludes("src/lib/engine/problem-intake-gate.ts", [
    'ProblemIntakeNextPhase = "architecture"',
    'nextSafePhase: "mvp_build"',
    'nextSafePhase: "implementation"'
  ]);
});

runStep("engine produces every required intake-packet field", () => {
  assertFileIncludes("src/lib/engine/problem-intake-gate.ts", [
    "rawRequest",
    "problemBeingSolved",
    "intendedPerson",
    "likelyApp",
    "requestType",
    "missingContext",
    "requiredSourceOfTruthFiles",
    "applicableControlGates",
    "blockedActions",
    'recommendedNextLabel: "ai:plan"',
    "nextSafePhase"
  ]);
});

runStep("classifies a bare human/ministry problem as problem (not app_idea)", () => {
  // "struggling ... consistently" must read as a problem signal, not fall through
  // to ambiguous and never to app_idea, so a bare problem stays in clarification.
  assertFileIncludes("src/lib/engine/problem-intake-gate.ts", ["struggl\\w*", "consistently", 'return "problem"']);
});

runStep("engine blocks build actions and names control gates", () => {
  assertFileIncludes("src/lib/engine/problem-intake-gate.ts", [
    '"begin_architecture"',
    '"begin_design"',
    '"begin_implementation"',
    '"create_app_code_from_conversation"',
    '"create_app_build_packet_before_prior_work_check"',
    '"prior_work_check_gate"',
    '"solution_candidate_review_gate"',
    '"release_gate"'
  ]);
});

runStep("intake is persisted behind the durable adapter", () => {
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", ["problem_intake_gate"]);
  assertFileIncludes("src/lib/engine/problem-intake-gate.ts", ['kind: "problem_intake_gate" as const']);
});

runStep("owner-gated API exposes the gate", () => {
  assertFileIncludes("src/app/api/engine/problem-intake-gate/route.ts", [
    "canAccessEngineAdmin",
    "createProblemIntakeGateRecord",
    "listProblemIntakeGateRecords",
    "Cache-Control"
  ]);
});

runStep("intake UI captures the request and shows the packet", () => {
  assertFileIncludes("src/app/(cockpit)/problem-intake/page.tsx", [
    "canAccessEngineAdmin",
    "ProblemIntakeForm",
    "listProblemIntakeGateRecords"
  ]);
  assertFileIncludes("src/components/engine/problem-intake-form.tsx", [
    'data-testid="problem-intake-gate-page"',
    "Raw request",
    "Problem being solved",
    "Intended person/customer",
    "Request type",
    "/api/engine/problem-intake-gate",
    "Control gates before build"
  ]);
});

runStep("the main entry route offers the two doors", () => {
  // The entry page is the two-door front door (PR #177). Both doors flow through
  // the problem_intake_gate behind the scenes: problem -> consumer problem intake
  // (/problem-intake-lite), build -> /opportunity-intake.
  assertFileIncludes("src/app/(cockpit)/page.tsx", [
    'href="/problem-intake-lite"',
    'href="/opportunity-intake"',
    'data-testid="entry-door-problem"',
    'data-testid="entry-door-build"'
  ]);
});

console.log("problem-intake-gate smoke ok");

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
